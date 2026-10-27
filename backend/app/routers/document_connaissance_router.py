"""Endpoints de DOCUMENT_CONNAISSANCE — base de connaissances de l'assistant IA.

**Toutes les opérations sont réservées aux administrateurs.** Un document
téléversé change ce que l'assistant répond aux visiteurs : c'est une écriture
du même ordre que le catalogue.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.models.document_connaissance import PublicCible
from app.schemas.document_connaissance import DocumentConnaissanceRead
from app.services.document_connaissance_service import DocumentConnaissanceService

router = APIRouter(prefix="/assistant/administration/documents", tags=["assistant"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get(
    "",
    response_model=list[DocumentConnaissanceRead],
    summary="Lister les documents de la base de connaissances",
)
def lister(
    _admin: PersonnelAdministrateur,
    db: SessionBase,
    inclure_archives: Annotated[bool, Query()] = False,
) -> list[DocumentConnaissanceRead]:
    return [
        DocumentConnaissanceRead.model_validate(document)
        for document in DocumentConnaissanceService(db).lister(inclure_archives)
    ]


@router.post(
    "",
    response_model=DocumentConnaissanceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Téléverser un document (PDF, Word, texte, Markdown)",
)
def televerser(
    admin: PersonnelAdministrateur,
    db: SessionBase,
    titre: Annotated[str, Form()],
    public_cible: Annotated[PublicCible, Form()],
    fichier: Annotated[
        UploadFile, File(description="PDF, .docx, .txt ou .md, 5 Mio max.")
    ],
) -> DocumentConnaissanceRead:
    """Contrôle le contenu réel du fichier, en extrait le texte, l'enregistre
    puis l'indexe. `nombre_fragments = 0` dans la réponse : le document est
    enregistré mais son indexation a échoué — relancer une réindexation."""
    contenu = fichier.file.read()
    return DocumentConnaissanceRead.model_validate(
        DocumentConnaissanceService(db).televerser(
            contenu, fichier.filename or "document", titre, public_cible, admin
        )
    )


@router.delete(
    "/{id_document}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver un document (et le retirer de l'index)",
)
def archiver(
    id_document: int, _admin: PersonnelAdministrateur, db: SessionBase
) -> None:
    DocumentConnaissanceService(db).supprimer(id_document)


@router.post(
    "/{id_document}/restauration",
    response_model=DocumentConnaissanceRead,
    summary="Restaurer un document archivé (et le réindexer)",
)
def restaurer(
    id_document: int, _admin: PersonnelAdministrateur, db: SessionBase
) -> DocumentConnaissanceRead:
    return DocumentConnaissanceRead.model_validate(
        DocumentConnaissanceService(db).restaurer(id_document)
    )
