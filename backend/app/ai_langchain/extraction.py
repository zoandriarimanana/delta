"""Extraction du texte d'un document téléversé (Sprint 12, 12.9).

**Le format vient des octets, jamais du nom ni du `Content-Type`** — même
règle que la photo de profil : un en-tête ou une extension peuvent mentir, le
contenu ne ment pas. Seule exception : `.txt` et `.md`, tous deux du texte
brut, que rien dans les octets ne distingue ; l'extension ne sert alors qu'à
choisir l'étiquette, jamais à décider si le fichier est lisible.

Les bibliothèques d'extraction ne sont importées qu'à l'appel : elles vivent
dans `requirements-ai.txt`.
"""

import io
import re
import zipfile

from app.core.exceptions import ErreurMetier
from app.models.document_connaissance import TypeFichier

TAILLE_MAX_OCTETS = 5 * 1024 * 1024
# Au-delà, le document coûterait des centaines d'appels d'embeddings et
# noierait l'index : mieux vaut le découper en plusieurs documents thématiques.
LONGUEUR_MAX_TEXTE = 200_000

MESSAGE_FORMAT = (
    "Format non pris en charge : envoyez un PDF, un document Word (.docx), "
    "un fichier texte (.txt) ou Markdown (.md)."
)
MESSAGE_VIDE = (
    "Aucun texte n'a pu être extrait de ce document. S'il s'agit d'un PDF "
    "scanné (une image de texte), il faut d'abord le convertir en texte."
)


def detecter_type(contenu: bytes, nom_fichier: str) -> TypeFichier:
    """Format réel du fichier, ou `ErreurMetier` (400) s'il n'est pas accepté."""
    if contenu.startswith(b"%PDF-"):
        return TypeFichier.PDF
    if contenu.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(contenu)) as archive:
                if "word/document.xml" in archive.namelist():
                    return TypeFichier.DOCX
        except zipfile.BadZipFile:
            pass
        raise ErreurMetier(MESSAGE_FORMAT)
    extension = nom_fichier.rsplit(".", 1)[-1].lower() if "." in nom_fichier else ""
    if extension in ("txt", "md") and b"\x00" not in contenu:
        try:
            contenu.decode("utf-8")
        except UnicodeDecodeError as erreur:
            raise ErreurMetier(
                "Le fichier texte doit être encodé en UTF-8."
            ) from erreur
        return TypeFichier.MD if extension == "md" else TypeFichier.TXT
    raise ErreurMetier(MESSAGE_FORMAT)


def _texte_pdf(contenu: bytes) -> str:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        lecteur = PdfReader(io.BytesIO(contenu))
        if lecteur.is_encrypted:
            raise ErreurMetier("Ce PDF est protégé par un mot de passe.")
        return "\n\n".join(page.extract_text() or "" for page in lecteur.pages)
    except PdfReadError as erreur:
        raise ErreurMetier("Ce PDF est illisible ou endommagé.") from erreur


def _texte_docx(contenu: bytes) -> str:
    import docx2txt

    return docx2txt.process(io.BytesIO(contenu)) or ""


def _normaliser(texte: str) -> str:
    """Espaces et lignes vides superflus retirés — ils coûtent sans rien dire."""
    texte = texte.replace("\r\n", "\n").replace("\x00", "")
    texte = re.sub(r"[ \t]+", " ", texte)
    texte = re.sub(r"\n\s*\n\s*(\n\s*)+", "\n\n", texte)
    return texte.strip()


def extraire(contenu: bytes, nom_fichier: str) -> tuple[TypeFichier, str]:
    """Contrôle et extrait le texte d'un document. Lève `ErreurMetier` (400).

    Ordre des contrôles : taille, format réel, extraction, texte non vide,
    longueur raisonnable — du moins coûteux au plus coûteux.
    """
    if not contenu:
        raise ErreurMetier("Le fichier est vide.")
    if len(contenu) > TAILLE_MAX_OCTETS:
        raise ErreurMetier("Le fichier dépasse 5 Mio.")
    type_fichier = detecter_type(contenu, nom_fichier)
    if type_fichier is TypeFichier.PDF:
        brut = _texte_pdf(contenu)
    elif type_fichier is TypeFichier.DOCX:
        brut = _texte_docx(contenu)
    else:
        brut = contenu.decode("utf-8")
    texte = _normaliser(brut)
    if not texte:
        raise ErreurMetier(MESSAGE_VIDE)
    if len(texte) > LONGUEUR_MAX_TEXTE:
        raise ErreurMetier(
            "Ce document est trop long pour l'assistant "
            f"(plus de {LONGUEUR_MAX_TEXTE // 1000} 000 caractères) : "
            "découpez-le en plusieurs documents thématiques."
        )
    return type_fichier, texte
