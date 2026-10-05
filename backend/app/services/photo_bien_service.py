"""Service métier de PHOTO_BIEN — galerie des salles et des logements."""

import io
from collections.abc import Sequence

from PIL import Image
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, ErreurMetier, RessourceIntrouvable
from app.models.photo_bien import FormatPhoto, PhotoBien
from app.repositories.photo_bien_repository import PhotoBienRepository
from app.services.logement_service import LogementService
from app.services.salle_service import SalleService

#: 5 Mio : une photo de pièce prise au téléphone dépasse souvent les 2 Mio
#: retenus pour une photo de profil, sans qu'il faille la recompresser.
TAILLE_MAX_PHOTO_OCTETS = 5 * 1024 * 1024

#: Au-delà, une galerie ne se regarde plus — et chaque photo pèse en base.
NOMBRE_MAX_PHOTOS = 10

TYPES_MIME_ACCEPTES = {"image/jpeg", "image/png", "image/webp"}

#: Type renvoyé à la lecture, déduit du format **détecté** à l'upload.
TYPE_MIME_PAR_FORMAT = {
    FormatPhoto.JPEG: "image/jpeg",
    FormatPhoto.PNG: "image/png",
    FormatPhoto.WEBP: "image/webp",
}

MESSAGE_TYPE_INVALIDE = "Seules les images JPEG, PNG et WebP sont acceptées."
MESSAGE_TROP_VOLUMINEUSE = "L'image dépasse la taille maximale autorisée (5 Mio)."
MESSAGE_GALERIE_PLEINE = (
    f"Ce bien porte déjà {NOMBRE_MAX_PHOTOS} photos. "
    "Retirez-en une avant d'en ajouter une autre."
)
MESSAGE_PHOTO_INTROUVABLE = "Photo introuvable."


class PhotoBienService:
    """Règles de la galerie : formats, taille, nombre, diffusion.

    Le bien doit être **actif** pour toute opération : une salle archivée n'a
    pas de fiche publique, sa galerie n'a donc rien à montrer. La galerie
    survit en revanche à l'archivage — restaurer le bien la fait réapparaître,
    même raisonnement que la photo du personnel à l'archivage.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.photos = PhotoBienRepository(db)

    # --- Lecture -------------------------------------------------------------

    def lister_pour_salle(self, id_salle: int) -> Sequence[PhotoBien]:
        """Galerie d'une salle active, ou 404."""
        SalleService(self.db).obtenir(id_salle)
        return self.photos.lister_par_salle(id_salle)

    def lister_pour_logement(self, id_logement: int) -> Sequence[PhotoBien]:
        """Galerie d'un logement actif, ou 404."""
        LogementService(self.db).obtenir(id_logement)
        return self.photos.lister_par_logement(id_logement)

    def obtenir_contenu(self, id_photo: int) -> tuple[bytes, str]:
        """Octets et type MIME d'une photo dont le bien est actif.

        Le même 404 qu'elle n'existe pas ou que son bien soit archivé : une
        URL de photo ne doit pas survivre à la fiche qui la montrait.
        """
        photo = self.photos.obtenir_avec_contenu(id_photo)
        if photo is None:
            raise RessourceIntrouvable(MESSAGE_PHOTO_INTROUVABLE)
        bien = photo.salle if photo.id_salle is not None else photo.logement
        if bien is None or bien.supprime_le is not None:
            raise RessourceIntrouvable(MESSAGE_PHOTO_INTROUVABLE)
        return photo.contenu, TYPE_MIME_PAR_FORMAT[photo.format]

    # --- Écriture ------------------------------------------------------------

    def ajouter_a_salle(
        self, id_salle: int, contenu: bytes, type_mime: str | None, legende: str | None
    ) -> PhotoBien:
        """Ajoute une photo à la galerie d'une salle active."""
        SalleService(self.db).obtenir(id_salle)
        if self.photos.compter_par_salle(id_salle) >= NOMBRE_MAX_PHOTOS:
            raise ConflitMetier(MESSAGE_GALERIE_PLEINE)
        return self._enregistrer(contenu, type_mime, legende, {"id_salle": id_salle})

    def ajouter_a_logement(
        self,
        id_logement: int,
        contenu: bytes,
        type_mime: str | None,
        legende: str | None,
    ) -> PhotoBien:
        """Ajoute une photo à la galerie d'un logement actif."""
        LogementService(self.db).obtenir(id_logement)
        if self.photos.compter_par_logement(id_logement) >= NOMBRE_MAX_PHOTOS:
            raise ConflitMetier(MESSAGE_GALERIE_PLEINE)
        return self._enregistrer(
            contenu, type_mime, legende, {"id_logement": id_logement}
        )

    def supprimer(self, id_photo: int) -> None:
        """Retire une photo **définitivement**.

        Pas d'archivage : une photo n'a aucune valeur probante, et la garder
        archivée laisserait des mégaoctets en base que rien ne relira jamais.
        C'est le cas d'usage que `supprimer_definitivement()` réserve aux
        entités sans valeur probante (`docs/mld.md`).
        """
        photo = self.photos.get_by_id(id_photo)
        if photo is None:
            raise RessourceIntrouvable(MESSAGE_PHOTO_INTROUVABLE)
        self.photos.supprimer_definitivement(photo)
        self.db.commit()

    def _enregistrer(
        self,
        contenu: bytes,
        type_mime: str | None,
        legende: str | None,
        cible: dict[str, int],
    ) -> PhotoBien:
        """Valide les octets puis crée la ligne.

        Mêmes trois contrôles que la photo de profil, du moins coûteux au plus
        coûteux : type déclaré, taille réelle, contenu réel via Pillow. Ni
        l'en-tête ni le nom de fichier ne sont crus — les deux peuvent mentir.
        """
        if type_mime not in TYPES_MIME_ACCEPTES:
            raise ErreurMetier(MESSAGE_TYPE_INVALIDE)
        if len(contenu) > TAILLE_MAX_PHOTO_OCTETS:
            raise ErreurMetier(MESSAGE_TROP_VOLUMINEUSE)

        try:
            image = Image.open(io.BytesIO(contenu))
            # `.format` avant `.verify()` : Pillow interdit tout accès après.
            format_detecte = image.format
            image.verify()
        except OSError as erreur:
            # Un fichier tronqué lève un `OSError` nu, pas seulement
            # `UnidentifiedImageError` — cf. `PersonnelService.remplacer_photo`.
            raise ErreurMetier(MESSAGE_TYPE_INVALIDE) from erreur

        try:
            format_photo = FormatPhoto(format_detecte or "")
        except ValueError as erreur:
            raise ErreurMetier(MESSAGE_TYPE_INVALIDE) from erreur

        legende_propre = legende.strip() if legende is not None else None
        photo = self.photos.create(
            {
                "contenu": contenu,
                "format": format_photo,
                "taille_octets": len(contenu),
                "legende": legende_propre or None,
                **cible,
            }
        )
        self.db.commit()
        return photo
