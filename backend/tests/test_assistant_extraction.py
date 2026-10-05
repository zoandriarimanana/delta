"""Extraction du texte des documents téléversés (Sprint 12, 12.9).

Les fichiers PDF et Word sont **fabriqués dans le test** — minimaux mais
réels — plutôt que versionnés : on voit ce qu'ils contiennent, et aucun
binaire opaque n'entre dans le dépôt.
"""

import io
import zipfile

import pytest

from app.ai_langchain.extraction import (
    LONGUEUR_MAX_TEXTE,
    TAILLE_MAX_OCTETS,
    detecter_type,
    extraire,
)
from app.core.exceptions import ErreurMetier
from app.models.document_connaissance import TypeFichier


def pdf_avec_texte(texte: str) -> bytes:
    """PDF d'une page portant `texte`, écrit à la main (objets et xref)."""
    flux = f"BT /F1 12 Tf 72 720 Td ({texte}) Tj ET".encode("latin-1")
    objets = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(flux) + flux + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    sortie = io.BytesIO()
    sortie.write(b"%PDF-1.4\n")
    positions = []
    for numero, objet in enumerate(objets, start=1):
        positions.append(sortie.tell())
        sortie.write(b"%d 0 obj\n" % numero + objet + b"\nendobj\n")
    debut_xref = sortie.tell()
    sortie.write(b"xref\n0 %d\n0000000000 65535 f \n" % (len(objets) + 1))
    for position in positions:
        sortie.write(b"%010d 00000 n \n" % position)
    sortie.write(
        b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n"
        % (len(objets) + 1, debut_xref)
    )
    return sortie.getvalue()


def docx_avec_texte(texte: str) -> bytes:
    """Document Word minimal : une archive ZIP et son `word/document.xml`."""
    sortie = io.BytesIO()
    with zipfile.ZipFile(sortie, "w") as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/'
            'package/2006/content-types"><Default Extension="xml" '
            'ContentType="application/xml"/></Types>',
        )
        archive.writestr(
            "word/document.xml",
            '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats'
            '.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'
            f"{texte}</w:t></w:r></w:p></w:body></w:document>",
        )
    return sortie.getvalue()


def test_un_pdf_reel_est_reconnu_et_lu() -> None:
    type_fichier, texte = extraire(pdf_avec_texte("Horaires du comptoir"), "a.pdf")

    assert type_fichier is TypeFichier.PDF
    assert "Horaires du comptoir" in texte


def test_un_docx_reel_est_reconnu_et_lu() -> None:
    type_fichier, texte = extraire(docx_avec_texte("Procédure de caisse"), "a.docx")

    assert type_fichier is TypeFichier.DOCX
    assert texte == "Procédure de caisse"


@pytest.mark.parametrize(
    ("nom", "attendu"), [("notes.txt", TypeFichier.TXT), ("Guide.MD", TypeFichier.MD)]
)
def test_texte_et_markdown(nom: str, attendu: TypeFichier) -> None:
    type_fichier, texte = extraire(b"Livraison du mardi.\r\n\r\n\r\n\r\nFin.", nom)

    assert type_fichier is attendu
    assert texte == "Livraison du mardi.\n\nFin.", "lignes vides superflues retirées"


def test_le_format_vient_des_octets_pas_du_nom() -> None:
    """Un exécutable renommé en .pdf est refusé ; un vrai PDF mal nommé passe."""
    with pytest.raises(ErreurMetier, match="Format non pris en charge"):
        detecter_type(b"MZ\x90\x00binaire", "faux.pdf")
    assert detecter_type(pdf_avec_texte("ok"), "sans_extension") is TypeFichier.PDF


def test_une_archive_zip_qui_n_est_pas_un_docx_est_refusee() -> None:
    sortie = io.BytesIO()
    with zipfile.ZipFile(sortie, "w") as archive:
        archive.writestr("photo.jpg", b"...")

    with pytest.raises(ErreurMetier, match="Format non pris en charge"):
        detecter_type(sortie.getvalue(), "faux.docx")


def test_un_binaire_nomme_txt_est_refuse() -> None:
    with pytest.raises(ErreurMetier):
        detecter_type(b"texte\x00binaire", "notes.txt")


def test_un_texte_qui_n_est_pas_en_utf8_est_refuse_avec_un_message_clair() -> None:
    with pytest.raises(ErreurMetier, match="UTF-8"):
        detecter_type("Crème brûlée".encode("cp1252"), "recette.txt")


def test_fichier_vide_ou_trop_lourd() -> None:
    with pytest.raises(ErreurMetier, match="vide"):
        extraire(b"", "a.txt")
    with pytest.raises(ErreurMetier, match="5 Mio"):
        extraire(b"a" * (TAILLE_MAX_OCTETS + 1), "a.txt")


def test_un_pdf_sans_texte_est_refuse_comme_un_scan() -> None:
    with pytest.raises(ErreurMetier, match="scanné"):
        extraire(pdf_avec_texte(""), "scan.pdf")


def test_un_texte_trop_long_doit_etre_decoupe() -> None:
    with pytest.raises(ErreurMetier, match="découpez-le"):
        extraire(b"mot " * (LONGUEUR_MAX_TEXTE // 3), "long.txt")


def test_un_pdf_endommage_est_refuse_sans_erreur_500() -> None:
    with pytest.raises(ErreurMetier):
        extraire(b"%PDF-1.4\nceci n'est pas un pdf", "casse.pdf")
