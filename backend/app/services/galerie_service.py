"""Photos du catalogue, rangées sur disque — salles, logements, formations, produits.

**Aucune table** : le dossier est la source de vérité. Un sous-dossier par
partie (`static/upload/salles/`, `logements/`, `formations/`, `produits/`), et
chaque photo est un fichier nommé **`<id>-<n>.<ext>`** — `3-2.jpg` est la
deuxième photo de la salle n°3. Décidé ainsi pour qu'un administrateur puisse
lire, ranger ou déposer les fichiers lui-même, sans passer par l'API.

L'ordre est celui de `n` (numérique, `3-10` après `3-9`) ; la première photo
sert de couverture. L'extension vient du **format détecté** dans les octets,
jamais du nom envoyé — même règle que la photo de profil du personnel.

**Limite assumée, décidée par l'utilisateur** : sur Render, le disque est
effacé à chaque déploiement. Voir la dette correspondante dans
`docs/roadmap.md`.
"""

import io
import re
from collections.abc import Callable
from enum import StrEnum
from pathlib import Path

from PIL import Image
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import (
    ConflitMetier,
    ErreurMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.repositories.demande_personnalisation_repository import (
    DemandePersonnalisationRepository,
)
from app.services.categorie_produit_service import CategorieProduitService
from app.services.formation_service import FormationService
from app.services.logement_service import LogementService
from app.services.produit_service import ProduitService
from app.services.salle_service import SalleService


class Partie(StrEnum):
    """Les parties du catalogue qui portent des photos — un dossier chacune."""

    SALLES = "salles"
    LOGEMENTS = "logements"
    FORMATIONS = "formations"
    PRODUITS = "produits"
    #: Exemples de réalisations d'une catégorie (14 octobre 2026) : montrés
    #: au client, et parmi lesquels il choisit un modèle à personnaliser.
    CATEGORIES = "categories"
    #: Copie du modèle choisi par un client, rangée sous le numéro de sa
    #: demande de personnalisation : elle reste celle qu'il a vue, même si la
    #: catégorie change ensuite de photos. Jamais téléversée directement.
    MODELES = "modeles"


#: 5 Mio : une photo prise au téléphone dépasse souvent 2 Mio.
TAILLE_MAX_PHOTO_OCTETS = 5 * 1024 * 1024

#: Au-delà, une galerie ne se regarde plus.
NOMBRE_MAX_PHOTOS = 10

TYPES_MIME_ACCEPTES = {"image/jpeg", "image/png", "image/webp"}
EXTENSION_PAR_FORMAT = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
TYPE_MIME_PAR_EXTENSION = {
    "jpg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}

#: Seuls noms de fichier jamais lus ou écrits : ferme toute traversée de
#: chemin (`../`, `/`, `\`) avant même de toucher au disque.
MOTIF_FICHIER = re.compile(r"^(\d+)-(\d+)\.(jpg|png|webp)$")

MESSAGE_TYPE_INVALIDE = "Seules les images JPEG, PNG et WebP sont acceptées."
MESSAGE_TROP_VOLUMINEUSE = "L'image dépasse la taille maximale autorisée (5 Mio)."
MESSAGE_GALERIE_PLEINE = (
    f"Cet élément porte déjà {NOMBRE_MAX_PHOTOS} photos. "
    "Retirez-en une avant d'en ajouter une autre."
)
MESSAGE_PHOTO_INTROUVABLE = "Photo introuvable."


class GalerieService:
    """Lecture, ajout et retrait des photos d'un élément du catalogue.

    L'élément doit être **actif** pour toute opération : une salle archivée n'a
    pas de fiche publique, ses photos n'ont rien à montrer. Les fichiers
    survivent en revanche à l'archivage — restaurer l'élément les fait
    réapparaître.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self._verifications: dict[Partie, Callable[[int], object]] = {
            Partie.SALLES: SalleService(db).obtenir,
            Partie.LOGEMENTS: LogementService(db).obtenir,
            Partie.FORMATIONS: FormationService(db).obtenir,
            Partie.PRODUITS: ProduitService(db).obtenir,
            Partie.CATEGORIES: CategorieProduitService(db).obtenir,
            Partie.MODELES: self._demande_existante,
        }

    # --- Lecture -------------------------------------------------------------

    def lister(self, partie: Partie, identifiant: int) -> list[str]:
        """Noms des photos d'un élément actif, dans l'ordre ; 404 sinon."""
        self._verifications[partie](identifiant)
        return [chemin.name for chemin in self._fichiers(partie, identifiant)]

    def chemin(self, partie: Partie, fichier: str) -> tuple[Path, str]:
        """Chemin et type MIME d'une photo dont l'élément est actif.

        Le même 404 que le nom soit invalide, le fichier absent ou l'élément
        archivé : une URL de photo ne survit pas à la fiche qui la montrait.
        """
        correspondance = MOTIF_FICHIER.match(fichier)
        if correspondance is None:
            raise RessourceIntrouvable(MESSAGE_PHOTO_INTROUVABLE)
        try:
            self._verifications[partie](int(correspondance.group(1)))
        except RessourceIntrouvable as erreur:
            raise RessourceIntrouvable(MESSAGE_PHOTO_INTROUVABLE) from erreur
        chemin = self._dossier(partie) / fichier
        if not chemin.is_file():
            raise RessourceIntrouvable(MESSAGE_PHOTO_INTROUVABLE)
        return chemin, TYPE_MIME_PAR_EXTENSION[correspondance.group(3)]

    def couvertures(self, partie: Partie) -> dict[int, str]:
        """Première photo de chaque élément de la partie, en **une** lecture
        du dossier — pour qu'une liste montre ses couvertures sans une
        requête par carte (14 octobre 2026).

        Ne vérifie pas que chaque élément est actif : la liste qui les affiche
        ne contient que des éléments actifs, et la route de l'image refuse de
        toute façon celle d'un élément archivé.
        """
        dossier = self._dossier(partie)
        if not dossier.is_dir():
            return {}
        premieres: dict[int, tuple[int, str]] = {}
        for chemin in dossier.iterdir():
            correspondance = MOTIF_FICHIER.match(chemin.name)
            if correspondance is None or not chemin.is_file():
                continue
            identifiant, numero = int(correspondance.group(1)), int(
                correspondance.group(2)
            )
            if identifiant not in premieres or numero < premieres[identifiant][0]:
                premieres[identifiant] = (numero, chemin.name)
        return {identifiant: nom for identifiant, (_, nom) in premieres.items()}

    # --- Écriture ------------------------------------------------------------

    def copier_modele(
        self,
        fichier: str,
        partie: Partie,
        identifiant: int,
        id_personnalisation: int,
    ) -> str:
        """Copie le modèle choisi par un client et retourne le nom de la copie.

        Le modèle doit être une photo **du produit commandé** ou **de sa
        catégorie** (`partie` et `identifiant` le disent) : un nom pris
        ailleurs — un autre produit, une autre catégorie, une salle — est
        refusé en 422, comme toute référence invalide venue du corps de la
        requête.
        """
        correspondance = MOTIF_FICHIER.match(fichier)
        source = self._dossier(partie) / fichier
        if (
            partie not in (Partie.PRODUITS, Partie.CATEGORIES)
            or correspondance is None
            or int(correspondance.group(1)) != identifiant
            or not source.is_file()
        ):
            raise ReferenceInvalide(
                "Ce modèle ne fait pas partie des exemples de ce produit."
            )
        dossier = self._dossier(Partie.MODELES)
        dossier.mkdir(parents=True, exist_ok=True)
        nom = f"{id_personnalisation}-1.{correspondance.group(3)}"
        (dossier / nom).write_bytes(source.read_bytes())
        return nom

    def ajouter(
        self, partie: Partie, identifiant: int, contenu: bytes, type_mime: str | None
    ) -> str:
        """Valide puis range une photo ; retourne le nom du fichier créé.

        Trois contrôles, du moins coûteux au plus coûteux : type déclaré,
        taille réelle, octets via Pillow. Le numéro suit le plus grand
        existant ; la création est **exclusive** (`xb`) : deux envois
        simultanés ne peuvent pas s'écraser, le second prend le numéro suivant.
        """
        self._verifications[partie](identifiant)
        existants = self._fichiers(partie, identifiant)
        if len(existants) >= NOMBRE_MAX_PHOTOS:
            raise ConflitMetier(MESSAGE_GALERIE_PLEINE)
        extension = self._valider(contenu, type_mime)

        dossier = self._dossier(partie)
        dossier.mkdir(parents=True, exist_ok=True)
        numero = max((_numero(c.name) for c in existants), default=0) + 1
        while True:
            nom = f"{identifiant}-{numero}.{extension}"
            try:
                with open(dossier / nom, "xb") as sortie:
                    sortie.write(contenu)
                return nom
            except FileExistsError:
                numero += 1

    def supprimer(self, partie: Partie, fichier: str) -> None:
        """Retire une photo du disque. 404 si elle n'existe pas."""
        chemin, _ = self.chemin(partie, fichier)
        chemin.unlink(missing_ok=True)

    # --- Interne -------------------------------------------------------------

    def _demande_existante(self, id_personnalisation: int) -> object:
        demande = DemandePersonnalisationRepository(self.db).get_by_id(
            id_personnalisation
        )
        if demande is None:
            raise RessourceIntrouvable(MESSAGE_PHOTO_INTROUVABLE)
        return demande

    def _dossier(self, partie: Partie) -> Path:
        return Path(settings.UPLOAD_DIR) / partie.value

    def _fichiers(self, partie: Partie, identifiant: int) -> list[Path]:
        dossier = self._dossier(partie)
        if not dossier.is_dir():
            return []
        trouves = [
            chemin
            for chemin in dossier.iterdir()
            if chemin.is_file()
            and (correspondance := MOTIF_FICHIER.match(chemin.name)) is not None
            and int(correspondance.group(1)) == identifiant
        ]
        return sorted(trouves, key=lambda chemin: _numero(chemin.name))

    def _valider(self, contenu: bytes, type_mime: str | None) -> str:
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
        extension = EXTENSION_PAR_FORMAT.get(format_detecte or "")
        if extension is None:
            raise ErreurMetier(MESSAGE_TYPE_INVALIDE)
        return extension


def _numero(nom: str) -> int:
    correspondance = MOTIF_FICHIER.match(nom)
    return int(correspondance.group(2)) if correspondance else 0
