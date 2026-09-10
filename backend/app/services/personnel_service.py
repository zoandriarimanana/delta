"""Service métier de PERSONNEL."""

import io
import secrets
import unicodedata
from collections.abc import Sequence
from datetime import date
from pathlib import Path
from uuid import uuid4

import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageOps
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import (
    ConflitMetier,
    ErreurMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.core.integrite import viole_contrainte
from app.core.security import hacher_mot_de_passe
from app.models.personnel import FonctionPersonnel, Personnel
from app.repositories.personnel_repository import PersonnelRepository
from app.schemas.personnel import PersonnelCreate, PersonnelUpdate

CONTRAINTE_EMAIL_UNIQUE = "uq_personnel_email"
INDICE_EMAIL = "personnel.email"

MESSAGE_EMAIL_PRIS = "Un membre du personnel actif utilise déjà cette adresse."

# Domaine réservé par la RFC 2606 : jamais routable, et refusé par `EmailStr` en
# entrée — personne ne peut donc soumettre l'adresse d'une ligne anonymisée pour
# usurper le compte. Mêmes valeurs que `ClientService`, même raisonnement.
DOMAINE_ANONYME = "delta.invalid"
MENTION_ANONYME = "Anonymisé"

# --- Photo de profil ---------------------------------------------------------

#: 2 Mio, une photo de profil n'a pas besoin de plus — validé avant codage.
TAILLE_MAX_PHOTO_OCTETS = 2 * 1024 * 1024

#: Formats acceptés, associés à l'extension de fichier stockée. Restreint aux
#: deux formats web courants pour une photo de profil — décidé avant codage,
#: pas une limite technique de Pillow (qui en lit bien davantage).
EXTENSIONS_PAR_FORMAT = {"JPEG": ".jpg", "PNG": ".png"}
TYPES_MIME_ACCEPTES = {"image/jpeg", "image/png"}

MESSAGE_TYPE_PHOTO_INVALIDE = (
    "Seules les images JPEG et PNG sont acceptées pour une photo de profil."
)
MESSAGE_PHOTO_TROP_VOLUMINEUSE = "L'image dépasse la taille maximale autorisée (2 Mio)."
MESSAGE_PAS_DE_PHOTO = "Ce membre du personnel n'a pas de photo de profil."

# --- Badge -------------------------------------------------------------------

#: Reprend la palette de `frontend/src/index.css` (`@theme`) — un badge est
#: une extension de l'identité visuelle du site, pas un artefact à part.
#: Valeurs dupliquées ici volontairement : Pillow ne peut pas lire un fichier
#: CSS, et les deux ne changent de toute façon pas au même rythme qu'une
#: palette de charte graphique.
COULEUR_CREME = (250, 246, 240)
COULEUR_TERRACOTTA = (156, 74, 60)
COULEUR_BLANC = (255, 255, 255)
COULEUR_GRIS_CHAUD_100 = (245, 243, 240)
COULEUR_GRIS_CHAUD_200 = (232, 228, 223)
COULEUR_GRIS_CHAUD_300 = (212, 207, 199)
COULEUR_GRIS_CHAUD_500 = (125, 116, 112)
COULEUR_GRIS_CHAUD_700 = (61, 53, 49)

#: Dimensions du badge, en pixels — pas de gabarit d'impression exact
#: (mm/points) visé pour l'instant, une image suffit.
LARGEUR_BADGE = 700
HAUTEUR_BADGE = 440

#: Carte : cadre blanc à coins arrondis flottant sur le fond crème, même
#: recette que les cartes de l'application (`rounded-xl border
#: border-warm-gray-200 bg-white`, cf. `PersonnelDetailAdministrationPage`).
MARGE_CARTE = 16
RAYON_CARTE = 18
EPAISSEUR_BORDURE_CARTE = 2
PADDING_CARTE = 28

#: Repères verticaux du contenu, dérivés des constantes ci-dessus plutôt que
#: recopiés en dur : un changement de `PADDING_CARTE` ou `MARGE_CARTE` doit se
#: répercuter sans avoir à recalculer chaque zone à la main.
X_GAUCHE = MARGE_CARTE + PADDING_CARTE
X_DROITE = LARGEUR_BADGE - MARGE_CARTE - PADDING_CARTE
Y_HAUT_CONTENU = MARGE_CARTE + PADDING_CARTE
Y_BAS_CONTENU = HAUTEUR_BADGE - MARGE_CARTE - PADDING_CARTE
Y_LIGNE_SEPARATION = Y_HAUT_CONTENU + 68

#: Pied de carte : bande basse séparée par une ligne, sur toute la largeur.
#: Ajoutée après un premier essai trop vide en bas à gauche (colonne
#: identité plus courte que la colonne QR, qui remplit toute sa hauteur avec
#: son propre fond) — un footer partagé referme la carte au lieu de laisser
#: un blanc qui n'a rien à faire là.
HAUTEUR_PIED = 40
Y_LIGNE_PIED = Y_BAS_CONTENU - HAUTEUR_PIED

TAILLE_PHOTO_BADGE = 160
LARGEUR_ZONE_QR = 182
GAP_ZONE_QR = 20
TAILLE_QR_BADGE = 140


class PersonnelService:
    """Règles de gestion du personnel, toutes fonctions confondues.

    Aucune fonction n'est traitée à part : un `Cuisinier` se crée, se modifie et
    s'archive exactement comme un `Formateur`. Les règles qui dépendent de la
    fonction — refuser un cuisinier sur une livraison, un livreur sur une
    session de formation — appartiennent aux services qui font l'affectation
    (#25, sprint 4), pas à celui-ci.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.personnels = PersonnelRepository(db)

    def lister(self, fonction: FonctionPersonnel | None = None) -> Sequence[Personnel]:
        """Retourne le personnel, filtré par fonction si demandé.

        Une fonction sans titulaire donne une liste vide, pas une erreur : c'est
        un critère de recherche, pas une ressource désignée par l'URL.
        """
        if fonction is None:
            return self.personnels.list()
        return self.personnels.lister_par_fonction(fonction)

    def obtenir(self, id_personnel: int) -> Personnel:
        """Retourne un membre du personnel, ou lève `RessourceIntrouvable` (404)."""
        personnel = self.personnels.get_by_id(id_personnel)
        if personnel is None:
            raise RessourceIntrouvable("Membre du personnel introuvable.")
        return personnel

    def obtenir_avec_fonction(
        self, id_personnel: int, fonction: FonctionPersonnel, *, pour: str
    ) -> Personnel:
        """Retourne le salarié **actif** exerçant la fonction attendue, ou 422.

        **Mécanisme partagé de cohérence de fonction.** Deux clés étrangères du
        schéma posent exactement le même problème : `LIVRAISON.#id_personnel` et
        `SESSION_FORMATION.#id_formateur` pointent vers `PERSONNEL` tout entier,
        alors que le métier n'accepte qu'une fonction. Rien en base n'empêche
        d'affecter un cuisinier à une tournée, ni un livreur à une session.

        La règle vit ici, chez `PERSONNEL`, parce qu'elle porte sur lui : c'est
        une propriété du salarié, pas un utilitaire ni une particularité de
        l'entité qui l'affecte. Les deux appelants passent par cette méthode —
        une seconde implémentation ne divergerait qu'au jour où l'une des deux
        serait corrigée sans l'autre.

        422 et non 404 : l'identifiant vient du corps de la requête, pas de
        l'URL (cf. `docs/architecture.md`).

        Un salarié **archivé** est traité comme inexistant, `get_by_id` le
        filtrant. Affecter une tournée ou une session à quelqu'un qui a quitté
        l'entreprise n'aurait pas de sens, et le message ne doit pas non plus
        confirmer qu'il a existé.

        `pour` complète le message d'erreur — « à une livraison », « à une
        session de formation ». Nommer l'affectation **et** la fonction
        constatée est ce qui permet à l'administrateur de comprendre son erreur
        sans aller lire la fiche du salarié.
        """
        personnel = self.personnels.get_by_id(id_personnel)
        if personnel is None:
            raise ReferenceInvalide(
                f"Aucun membre du personnel ne porte l'identifiant {id_personnel}."
            )
        if personnel.fonction is not fonction:
            raise ReferenceInvalide(
                f"{personnel.prenom} {personnel.nom} exerce la fonction "
                f"« {personnel.fonction.value} » et ne peut pas être affecté "
                f"à {pour}."
            )
        return personnel

    def _refuser_email_pris(self, email: str) -> None:
        """Pré-contrôle d'unicité de l'adresse professionnelle.

        Il donne un message clair dans le cas courant, mais ne suffit pas : deux
        créations simultanées le passent toutes les deux. C'est l'interception
        de l'`IntegrityError` qui tranche réellement.
        """
        if self.personnels.get_by_email(email) is not None:
            raise ConflitMetier(MESSAGE_EMAIL_PRIS)

    def creer(self, donnees: PersonnelCreate) -> Personnel:
        """Crée un membre du personnel.

        Double protection sur l'e-mail : le pré-contrôle pour le message, et
        l'interception de la violation d'index pour la course entre deux
        créations concurrentes. L'index étant *partiel*, seule une ligne
        **active** entre en conflit — un homonyme archivé ne bloque pas.
        """
        self._refuser_email_pris(donnees.email)
        try:
            personnel = self.personnels.create(donnees.model_dump())
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_EMAIL_UNIQUE, INDICE_EMAIL):
                raise ConflitMetier(MESSAGE_EMAIL_PRIS) from erreur
            raise
        return personnel

    def modifier(self, id_personnel: int, donnees: PersonnelUpdate) -> Personnel:
        """Met à jour un membre du personnel, en revalidant l'e-mail s'il change."""
        personnel = self.obtenir(id_personnel)
        modifications = donnees.model_dump(exclude_unset=True)

        # Réattribuer à quelqu'un sa propre adresse n'est pas un conflit.
        nouvel_email = modifications.get("email")
        if nouvel_email is not None and nouvel_email != personnel.email:
            self._refuser_email_pris(nouvel_email)

        try:
            self.personnels.update(personnel, modifications)
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_EMAIL_UNIQUE, INDICE_EMAIL):
                raise ConflitMetier(MESSAGE_EMAIL_PRIS) from erreur
            raise
        return personnel

    def supprimer(self, id_personnel: int) -> None:
        """Archive un membre du personnel.

        Archivage et non suppression réelle : `supprimer_definitivement()` est
        **inapplicable** à `PERSONNEL`. Les FK de `LIVRAISON` et
        `SESSION_FORMATION` le refuseraient, et effacer un livreur reviendrait à
        détruire la trace de qui a effectué une livraison — une preuve de
        transaction.

        Conséquence à connaître : les données personnelles du salarié restent
        lisibles en base après ce seul archivage. `anonymiser()`, ci-dessous,
        est le chemin de conformité — un archivage n'y suffit pas à lui seul.

        L'archivage ne se propage à rien : ni `LIVRAISON` ni `SESSION_FORMATION`
        ne disparaissent avec leur titulaire. C'est voulu — une livraison passée
        reste un fait, même après le départ du livreur.
        """
        personnel = self.obtenir(id_personnel)
        self.personnels.delete(personnel)
        self.db.commit()

    def restaurer(self, id_personnel: int) -> Personnel:
        """Réactive un membre du personnel archivé — le retour d'un salarié.

        Sans effet s'il est déjà actif : l'opération est idempotente.

        Peut échouer légitimement. `uq_personnel_email` étant *partiel*,
        l'adresse libérée par l'archivage a pu être réattribuée entre-temps ; la
        restauration créerait alors deux lignes actives de même adresse, et la
        base la refuse. Ce refus est traduit en message métier, jamais en trace
        SQL.
        """
        personnel = self.personnels.get_by_id(id_personnel, inclure_supprimes=True)
        if personnel is None:
            raise RessourceIntrouvable("Membre du personnel introuvable.")
        if personnel.supprime_le is None:
            return personnel

        try:
            self.personnels.restaurer(personnel)
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_EMAIL_UNIQUE, INDICE_EMAIL):
                raise ConflitMetier(
                    "Un membre du personnel actif utilise déjà cette adresse, "
                    "restauration impossible."
                ) from erreur
            raise
        return personnel

    def anonymiser(self, id_personnel: int) -> Personnel:
        """Efface les données personnelles d'un salarié, sans supprimer la ligne.

        **Seul chemin de conformité** pour `PERSONNEL`, comme
        `ClientService.anonymiser` l'est pour `CLIENT` (droit à l'effacement :
        RGPD, loi malgache n°2014-038). L'archivage seul ne suffit pas : la ligne
        reste, et avec elle le nom, l'adresse professionnelle et le téléphone.

        `supprimer_definitivement` ne convient pas davantage. Les FK de
        `LIVRAISON` et `SESSION_FORMATION` le refuseraient, et effacer une
        livraison honorée ou une session dispensée reviendrait à détruire une
        trace d'exécution — généralement soumise à une obligation de
        conservation qui prime sur le droit à l'effacement.

        Ne pas se rabattre non plus sur un détachement des clés étrangères :
        leur `NULL` signifie déjà « pas encore affecté », et le réutiliser pour
        « effacé » rendrait les deux états indistinguables.

        Sont réécrits : nom, prénom, e-mail, téléphone, spécialité, zone de
        livraison, et le mot de passe. Sont conservés : `id_personnel`,
        `fonction`, `date_embauche` — la fonction et l'ancienneté ne sont pas
        des données identifiantes, et les livraisons comme les sessions gardent
        leur `#id_personnel`, désormais anonyme.

        `est_administrateur` est remis à `False` : un compte anonymisé ne doit
        plus porter de droit. Après l'appel, aucune connexion n'est possible —
        le mot de passe est remplacé par le haché d'un secret aléatoire que
        personne ne détient.
        """
        personnel = self.personnels.get_by_id(id_personnel, inclure_supprimes=True)
        if personnel is None:
            raise RessourceIntrouvable("Membre du personnel introuvable.")

        personnel.nom = MENTION_ANONYME
        personnel.prenom = MENTION_ANONYME
        personnel.email = f"supprime+{personnel.id_personnel}@{DOMAINE_ANONYME}"
        personnel.telephone = None
        personnel.specialite = None
        personnel.zone_livraison = None
        personnel.est_administrateur = False
        personnel.mot_de_passe = hacher_mot_de_passe(secrets.token_urlsafe(32))

        # La photo est une donnée personnelle au même titre que le nom ou
        # l'e-mail : l'effacer ici, et pas seulement à l'archivage simple
        # (`supprimer()`, qui reste réversible via `restaurer()`), est ce qui
        # fait de cette méthode le seul chemin de conformité complet.
        ancienne_photo = personnel.photo_chemin
        personnel.photo_chemin = None

        self.personnels.delete(personnel)
        self.db.commit()

        if ancienne_photo is not None:
            self._supprimer_fichier_photo(ancienne_photo)

        return personnel

    # --- Photo de profil -----------------------------------------------------

    def _dossier_photos(self) -> Path:
        """Dossier de stockage, créé au premier besoin s'il n'existe pas encore."""
        dossier = Path(settings.PHOTO_STORAGE_DIR)
        dossier.mkdir(parents=True, exist_ok=True)
        return dossier

    def _supprimer_fichier_photo(self, nom_fichier: str) -> None:
        """Supprime un fichier du disque, sans échouer s'il est déjà absent.

        `missing_ok=True` : un fichier déjà manquant (suppression manuelle,
        disque nettoyé) ne doit pas faire échouer une opération métier qui a
        de toute façon atteint son but — la colonne pointant vers ce fichier
        est de toute façon réécrite par l'appelant.
        """
        (self._dossier_photos() / nom_fichier).unlink(missing_ok=True)

    def remplacer_photo(
        self, id_personnel: int, contenu: bytes, type_mime: str | None
    ) -> Personnel:
        """Valide et stocke une nouvelle photo de profil, remplaçant l'ancienne.

        Trois contrôles, dans cet ordre — du moins coûteux au plus coûteux :
        `Content-Type` déclaré (rejet rapide, avant de lire le corps en
        entier), taille réelle, puis contenu réel des octets via Pillow
        (`Image.open(...).verify()`). Ne fait confiance ni à l'en-tête ni au
        nom de fichier envoyés par le client — les deux peuvent mentir.

        Le nom de fichier stocké est un UUID, avec l'extension déduite du
        **format détecté**, jamais du nom d'origine : ferme à la fois les
        collisions et toute tentative de traversée de chemin.

        L'ancien fichier n'est supprimé qu'**après** que le nouveau soit
        écrit et la base commitée — dans cet ordre, un échec à n'importe
        quelle étape laisse au pire un fichier neuf orphelin sur disque,
        jamais une colonne qui pointe vers un fichier absent.
        """
        personnel = self.obtenir(id_personnel)

        if type_mime not in TYPES_MIME_ACCEPTES:
            raise ErreurMetier(MESSAGE_TYPE_PHOTO_INVALIDE)
        if len(contenu) > TAILLE_MAX_PHOTO_OCTETS:
            raise ErreurMetier(MESSAGE_PHOTO_TROP_VOLUMINEUSE)

        try:
            image = Image.open(io.BytesIO(contenu))
            # `.format` est lu **avant** `.verify()` : Pillow interdit tout
            # nouvel accès à l'image une fois `verify()` appelé.
            format_detecte = image.format
            image.verify()
        except OSError as erreur:
            # `UnidentifiedImageError` (contenu qui n'est pas une image du
            # tout) **hérite** de `OSError` — mais un fichier tronqué, dont
            # l'en-tête reste reconnaissable, lève un `OSError` nu
            # (« Truncated File Read ») directement depuis `verify()`, pas
            # cette sous-classe. Ne capturer que `UnidentifiedImageError`
            # laissait ce cas remonter en 500 au lieu du 400 attendu — trouvé
            # empiriquement avec un vrai fichier tronqué, pas par lecture du
            # code.
            raise ErreurMetier(MESSAGE_TYPE_PHOTO_INVALIDE) from erreur

        extension = EXTENSIONS_PAR_FORMAT.get(format_detecte or "")
        if extension is None:
            raise ErreurMetier(MESSAGE_TYPE_PHOTO_INVALIDE)

        nom_fichier = f"{uuid4().hex}{extension}"
        (self._dossier_photos() / nom_fichier).write_bytes(contenu)

        ancienne_photo = personnel.photo_chemin
        personnel.photo_chemin = nom_fichier
        self.db.commit()

        if ancienne_photo is not None:
            self._supprimer_fichier_photo(ancienne_photo)

        return personnel

    def supprimer_photo(self, id_personnel: int) -> Personnel:
        """Retire la photo de profil, sans rien archiver — symétrique de l'upload.

        Sans effet si le membre n'en avait pas : l'opération est idempotente,
        même traitement que `restaurer()` sur un membre déjà actif.
        """
        personnel = self.obtenir(id_personnel)
        if personnel.photo_chemin is None:
            return personnel

        ancienne_photo = personnel.photo_chemin
        personnel.photo_chemin = None
        self.db.commit()

        self._supprimer_fichier_photo(ancienne_photo)
        return personnel

    def chemin_photo(self, id_personnel: int) -> Path:
        """Chemin disque de la photo active, ou lève `RessourceIntrouvable`.

        Le même refus, qu'aucune photo n'ait jamais été téléversée ou que le
        membre lui-même n'existe pas — `obtenir()` lève déjà ce cas. Rien ne
        distingue les deux côté client : les deux se traduisent par
        l'avatar générique côté frontend.
        """
        personnel = self.obtenir(id_personnel)
        if personnel.photo_chemin is None:
            raise RessourceIntrouvable(MESSAGE_PAS_DE_PHOTO)
        return self._dossier_photos() / personnel.photo_chemin

    def generer_badge(self, id_personnel: int) -> bytes:
        """Compose un badge PNG : en-tête « DELTA », photo (ou initiales sur
        fond de marque), nom, prénom, fonction, et un QR code encodant
        `id_personnel` — dans une carte à cadre reprenant la charte visuelle
        du site (`frontend/src/index.css`, section « Badge » de ce module).

        Généré **à la demande**, jamais stocké ni mis en cache — même
        raisonnement que `calculer_solde()` ou `note_moyenne` : plusieurs
        champs indépendants peuvent changer (identité, fonction, photo), un
        cache imposerait de l'invalider sur chacun pour un coût de génération
        de toute façon négligeable (composition d'une image ~700×440 px).

        Le QR code encode l'identifiant seul, jamais une URL de vérification :
        construire une telle URL supposerait une route **publique**, alors
        que ce module n'expose aucune lecture de `PERSONNEL` anonymement (cf.
        l'en-tête de `personnel_router.py`) — et un ID lisible par un lecteur
        QR n'est de toute façon pas moins falsifiable qu'une URL bâtie autour
        du même ID. La vérification réelle d'un badge reste visuelle (photo +
        nom comparés au porteur) ; le QR n'est qu'une commodité de lookup pour
        un salarié déjà authentifié, via `GET /personnel/{id}`. L'identifiant
        est aussi affiché **en clair** sous le QR, pour rester utilisable si
        le QR ne scanne pas (impression dégradée, lecteur absent).
        """
        personnel = self.obtenir(id_personnel)

        badge = Image.new("RGB", (LARGEUR_BADGE, HAUTEUR_BADGE), COULEUR_CREME)
        dessin = ImageDraw.Draw(badge)

        dessin.rounded_rectangle(
            [
                MARGE_CARTE,
                MARGE_CARTE,
                LARGEUR_BADGE - MARGE_CARTE,
                HAUTEUR_BADGE - MARGE_CARTE,
            ],
            radius=RAYON_CARTE,
            fill=COULEUR_BLANC,
            outline=COULEUR_GRIS_CHAUD_300,
            width=EPAISSEUR_BORDURE_CARTE,
        )

        self._dessiner_entete(dessin)
        self._dessiner_identite(badge, dessin, personnel)
        self._dessiner_zone_qr(badge, dessin, personnel.id_personnel)
        self._dessiner_pied(dessin)

        tampon = io.BytesIO()
        badge.save(tampon, format="PNG")
        return tampon.getvalue()

    def _sans_diacritiques(self, texte: str) -> str:
        """Retire accents et cédille (« é » → « e », « ç » → « c »...).

        La police embarquée de Pillow (`ImageFont.load_default`) n'a **aucun**
        glyphe pour les caractères latins accentués — elle ne lève aucune
        erreur, elle dessine silencieusement un carré « glyphe manquant » à
        la place. Trouvé empiriquement en relisant le badge généré (« Badge
        valide pour l'année » affichait un carré à la place du « é »), pas en
        lisant la documentation Pillow.

        Nom et e-mail sont les deux seuls textes du badge à venir d'une
        saisie libre — la fonction est un domaine fermé sans accent
        (`docs/mld.md`), et les libellés fixes de ce fichier sont écrits pour
        ne jamais en contenir. Une dégradation propre (« Andre » plutôt que
        « André ») reste préférable à un carré illisible, et n'exige aucune
        police à embarquer dans le dépôt.
        """
        decompose = unicodedata.normalize("NFKD", texte)
        return "".join(c for c in decompose if not unicodedata.combining(c))

    def _texte_gras(
        self,
        dessin: ImageDraw.ImageDraw,
        position: tuple[int, int],
        texte: str,
        police: ImageFont.FreeTypeFont,
        fill: tuple[int, int, int],
    ) -> None:
        """Simule un texte gras en dessinant un second tracé décalé d'1 px.

        Pas de fichier de police à embarquer pour une seule graisse : Pillow
        n'expose que `ImageFont.load_default`, toujours dans sa graisse
        normale. Un procédé standard, pas une approximation risquée pour un
        simple en-tête ou un nom en gros caractères.
        """
        x, y = position
        dessin.text((x + 1, y), texte, fill=fill, font=police)
        dessin.text((x, y), texte, fill=fill, font=police)

    def _dessiner_entete(self, dessin: ImageDraw.ImageDraw) -> None:
        self._texte_gras(
            dessin,
            (X_GAUCHE, Y_HAUT_CONTENU),
            "DELTA",
            ImageFont.load_default(size=32),
            COULEUR_TERRACOTTA,
        )
        dessin.text(
            (X_GAUCHE, Y_HAUT_CONTENU + 40),
            "Badge professionnel",
            fill=COULEUR_GRIS_CHAUD_500,
            font=ImageFont.load_default(size=13),
        )
        dessin.line(
            [(X_GAUCHE, Y_LIGNE_SEPARATION), (X_DROITE, Y_LIGNE_SEPARATION)],
            fill=COULEUR_GRIS_CHAUD_200,
            width=1,
        )

    def _dessiner_identite(
        self, badge: Image.Image, dessin: ImageDraw.ImageDraw, personnel: Personnel
    ) -> None:
        y_zone = Y_LIGNE_SEPARATION + 20
        hauteur_zone = Y_LIGNE_PIED - y_zone
        y_photo = y_zone + (hauteur_zone - TAILLE_PHOTO_BADGE) // 2

        masque = Image.new("L", (TAILLE_PHOTO_BADGE, TAILLE_PHOTO_BADGE), 0)
        ImageDraw.Draw(masque).ellipse(
            [0, 0, TAILLE_PHOTO_BADGE, TAILLE_PHOTO_BADGE], fill=255
        )
        badge.paste(self._photo_pour_badge(personnel), (X_GAUCHE, y_photo), mask=masque)

        x_texte = X_GAUCHE + TAILLE_PHOTO_BADGE + 24
        largeur_disponible = (X_DROITE - LARGEUR_ZONE_QR - GAP_ZONE_QR) - x_texte
        nom_complet = self._sans_diacritiques(f"{personnel.prenom} {personnel.nom}")
        nom_affiche, police_nom = self._texte_ajuste_a_la_largeur(
            dessin, nom_complet, taille_depart=26, largeur_max=largeur_disponible
        )
        self._texte_gras(
            dessin,
            (x_texte, y_photo + 12),
            nom_affiche,
            police_nom,
            COULEUR_GRIS_CHAUD_700,
        )
        self._dessiner_pilule_fonction(
            dessin, x_texte, y_photo + 58, personnel.fonction.value
        )

        email_affiche, police_email = self._texte_ajuste_a_la_largeur(
            dessin,
            self._sans_diacritiques(personnel.email),
            taille_depart=14,
            largeur_max=largeur_disponible,
            taille_min=11,
        )
        dessin.text(
            (x_texte, y_photo + 100),
            email_affiche,
            fill=COULEUR_GRIS_CHAUD_500,
            font=police_email,
        )

    def _dessiner_pied(self, dessin: ImageDraw.ImageDraw) -> None:
        """Bande basse commune aux deux colonnes — referme la carte plutôt
        que de laisser un vide, voir la note sur `HAUTEUR_PIED`.
        """
        dessin.line(
            [(X_GAUCHE, Y_LIGNE_PIED), (X_DROITE, Y_LIGNE_PIED)],
            fill=COULEUR_GRIS_CHAUD_200,
            width=1,
        )
        dessin.text(
            (X_GAUCHE, Y_LIGNE_PIED + 12),
            f"Badge valide en {date.today().year}",
            fill=COULEUR_GRIS_CHAUD_500,
            font=ImageFont.load_default(size=12),
        )

    def _texte_ajuste_a_la_largeur(
        self,
        dessin: ImageDraw.ImageDraw,
        texte: str,
        *,
        taille_depart: int,
        largeur_max: float,
        taille_min: int = 14,
    ) -> tuple[str, ImageFont.FreeTypeFont]:
        """Fait entrer `texte` dans `largeur_max`, d'abord en réduisant la
        police par paliers de 2 px, puis — si `taille_min` ne suffit toujours
        pas — en tronquant le texte lui-même avec une ellipse.

        Nécessaire pour le nom complet : c'est le seul texte du badge à
        provenir d'une saisie libre, sans borne de longueur — contrairement à
        la fonction, dont le domaine fermé (`docs/mld.md`) garantit que
        « Receptionniste », la plus longue valeur, tient toujours dans sa
        pilule à taille fixe. Trouvé empiriquement avec un nom composé réel
        (« Marie-Christine Razafindrakoto-Andriamampianina »), qui débordait
        jusque dans la zone QR : la seule réduction de police ne suffisait
        pas non plus, `taille_min` restant encore trop large pour un nom
        aussi long — la troncature est donc une seconde ligne de défense, pas
        un cas théorique.
        """
        taille = taille_depart
        while taille > taille_min:
            police = ImageFont.load_default(size=taille)
            boite = dessin.textbbox((0, 0), texte, font=police)
            if (boite[2] - boite[0]) <= largeur_max:
                return texte, police
            taille -= 2

        police = ImageFont.load_default(size=taille_min)
        tronque = texte
        while len(tronque) > 1:
            boite = dessin.textbbox((0, 0), f"{tronque}…", font=police)
            if (boite[2] - boite[0]) <= largeur_max:
                return f"{tronque}…", police
            tronque = tronque[:-1]
        return tronque, police

    def _dessiner_pilule_fonction(
        self, dessin: ImageDraw.ImageDraw, x: int, y: int, libelle: str
    ) -> None:
        """Pilule de fonction — même langage visuel que `Badge.tsx`/`Bouton.tsx`
        côté frontend (fond terracotta plein, texte blanc), pas un simple
        texte gris comme dans la première version du badge.
        """
        police = ImageFont.load_default(size=14)
        boite = dessin.textbbox((0, 0), libelle, font=police)
        largeur_texte = boite[2] - boite[0]
        hauteur_texte = boite[3] - boite[1]
        pad_x, pad_y = 14, 8
        largeur_pilule = largeur_texte + 2 * pad_x
        hauteur_pilule = hauteur_texte + 2 * pad_y

        dessin.rounded_rectangle(
            [x, y, x + largeur_pilule, y + hauteur_pilule],
            radius=hauteur_pilule // 2,
            fill=COULEUR_TERRACOTTA,
        )
        dessin.text(
            (x + pad_x, y + pad_y - boite[1]),
            libelle,
            fill=COULEUR_BLANC,
            font=police,
        )

    def _photo_pour_badge(self, personnel: Personnel) -> Image.Image:
        """Photo réelle recadrée en carré, ou initiales sur fond de marque.

        Le carré est ensuite rendu circulaire **au collage**, via le masque
        elliptique de l'appelant (`_dessiner_identite`) — pas ici : le même
        mécanisme doit s'appliquer identiquement à une vraie photo comme à un
        repli, sans dupliquer la découpe circulaire dans les deux branches.
        """
        if personnel.photo_chemin is not None:
            chemin = self._dossier_photos() / personnel.photo_chemin
            with Image.open(chemin) as source:
                return ImageOps.fit(
                    source.convert("RGB"), (TAILLE_PHOTO_BADGE, TAILLE_PHOTO_BADGE)
                )
        return self._avatar_initiales(personnel)

    def _avatar_initiales(self, personnel: Personnel) -> Image.Image:
        """Repli quand aucune photo n'existe : initiales blanches sur fond
        terracotta plein — convention courante d'un badge professionnel
        imprimé, plus lisible et plus personnalisée qu'une silhouette
        abstraite à la taille d'impression d'un badge. Délibérément distinct
        du repli `Avatar.tsx` (icône générique) : celui-ci sert un espace de
        saisie temporaire côté web, ce badge est un artefact physique fini où
        « pas de photo » ne doit pas se lire comme « pas d'identité ».
        """
        initiales = (
            self._sans_diacritiques(
                f"{personnel.prenom[:1]}{personnel.nom[:1]}"
            ).upper()
            or "?"
        )
        avatar = Image.new(
            "RGB", (TAILLE_PHOTO_BADGE, TAILLE_PHOTO_BADGE), COULEUR_TERRACOTTA
        )
        dessin = ImageDraw.Draw(avatar)
        police = ImageFont.load_default(size=int(TAILLE_PHOTO_BADGE * 0.35))
        boite = dessin.textbbox((0, 0), initiales, font=police)
        x = (TAILLE_PHOTO_BADGE - (boite[2] - boite[0])) / 2 - boite[0]
        y = (TAILLE_PHOTO_BADGE - (boite[3] - boite[1])) / 2 - boite[1]
        dessin.text((x, y), initiales, fill=COULEUR_BLANC, font=police)
        return avatar

    def _libelle_numero_badge(self, id_personnel: int) -> str:
        """Repli lisible en clair sous le QR, si le QR ne scanne pas.

        Un remplissage de zéros (« N° 001 ») se lit comme un vrai numéro de
        badge, contrairement à un identifiant technique nu (« ID 1 »).
        """
        return f"N° {id_personnel:03d}"

    def _dessiner_zone_qr(
        self, badge: Image.Image, dessin: ImageDraw.ImageDraw, id_personnel: int
    ) -> None:
        """Zone dédiée au QR — fond gris chaud clair, sans le confondre avec
        la carte blanche qui l'entoure : c'est ce fond, et non une bordure
        supplémentaire, qui matérialise la séparation entre zone d'identité
        et zone de vérification.
        """
        x_zone = X_DROITE - LARGEUR_ZONE_QR
        y_zone = Y_LIGNE_SEPARATION + 20
        dessin.rounded_rectangle(
            [x_zone, y_zone, X_DROITE, Y_LIGNE_PIED],
            radius=12,
            fill=COULEUR_GRIS_CHAUD_100,
        )

        x_qr = x_zone + (LARGEUR_ZONE_QR - TAILLE_QR_BADGE) // 2
        y_qr = y_zone + 16
        badge.paste(self._qr_pour_badge(id_personnel), (x_qr, y_qr))

        libelle_id = self._libelle_numero_badge(id_personnel)
        police = ImageFont.load_default(size=13)
        boite = dessin.textbbox((0, 0), libelle_id, font=police)
        x_libelle = x_zone + (LARGEUR_ZONE_QR - (boite[2] - boite[0])) / 2 - boite[0]
        dessin.text(
            (x_libelle, y_qr + TAILLE_QR_BADGE + 10),
            libelle_id,
            fill=COULEUR_GRIS_CHAUD_500,
            font=police,
        )

    def _qr_pour_badge(self, id_personnel: int) -> Image.Image:
        code = qrcode.QRCode(border=1)
        code.add_data(str(id_personnel))
        code.make(fit=True)
        image_qr = code.make_image(
            fill_color=COULEUR_GRIS_CHAUD_700, back_color=COULEUR_BLANC
        )
        return image_qr.convert("RGB").resize((TAILLE_QR_BADGE, TAILLE_QR_BADGE))
