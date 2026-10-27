"""Modèle SQLAlchemy de DOCUMENT_CONNAISSANCE (Sprint 12, 12.9).

Document téléversé par l'administration pour enrichir la base de connaissances
de l'assistant IA. **Le texte extrait est stocké, pas le fichier** : le disque
d'un service Render est effacé à chaque redéploiement, un fichier rangé sur
disque disparaîtrait et l'index ne pourrait plus être reconstruit. Le texte,
lui, suffit à réindexer à tout moment (voir `docs/mld.md`).
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.personnel import Personnel


class PublicCible(StrEnum):
    """À qui l'assistant peut restituer le document.

    Domaine formel, `CHECK` en base : c'est cette valeur qui décide si un
    contenu peut ressortir dans la bulle **publique** du site. Une chaîne libre
    laisserait passer « client » ou « Clients » sans que le filtre de
    l'assistant les reconnaisse.
    """

    CLIENT = "Client"
    PERSONNEL = "Personnel"


class TypeFichier(StrEnum):
    """Formats acceptés — déduits du contenu réel, jamais du nom envoyé."""

    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"
    MD = "md"


def _enum(classe: type[StrEnum], nom: str) -> SAEnum:
    return SAEnum(
        classe,
        native_enum=False,
        create_constraint=True,
        name=nom,
        values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
    )


class DocumentConnaissance(SoftDeleteMixin, Base):
    """Document de la base de connaissances de l'assistant."""

    __tablename__ = "document_connaissance"
    __table_args__ = (
        CheckConstraint("taille_octets > 0", name="taille_positive"),
        CheckConstraint("length(texte_extrait) > 0", name="texte_non_vide"),
    )

    id_document: Mapped[int] = mapped_column(primary_key=True)
    titre: Mapped[str] = mapped_column(String(200), nullable=False)
    #: Nom d'origine, affiché à l'administration — jamais utilisé comme chemin.
    nom_fichier: Mapped[str] = mapped_column(String(255), nullable=False)
    type_fichier: Mapped[TypeFichier] = mapped_column(
        _enum(TypeFichier, "type_fichier_document"), nullable=False
    )
    taille_octets: Mapped[int] = mapped_column(nullable=False)
    public_cible: Mapped[PublicCible] = mapped_column(
        _enum(PublicCible, "public_cible_document"), nullable=False
    )
    texte_extrait: Mapped[str] = mapped_column(Text, nullable=False)
    date_ajout: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    #: Salarié qui a téléversé — dérivé du jeton, jamais du corps de la
    #: requête. `RESTRICT` : un salarié s'anonymise, il ne s'efface pas.
    id_personnel: Mapped[int] = mapped_column(
        ForeignKey("personnel.id_personnel", ondelete="RESTRICT"), nullable=False
    )

    auteur: Mapped[Personnel] = relationship()
