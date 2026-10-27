"""Modèle SQLAlchemy de l'entité CATEGORIE_PRODUIT."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.produit import Produit


class CategorieProduit(SoftDeleteMixin, Base):
    """Catégorie de produit (pâtisserie, boulangerie, confiture...)."""

    __tablename__ = "categorie_produit"

    __table_args__ = (
        # Index unique PARTIEL, et non contrainte UNIQUE : deux lignes peuvent
        # partager cette valeur si l'une est archivee. Sans ca, une ligne
        # supprimee bloquerait sa propre valeur a jamais.
        # Le nom est conserve a l'identique : PostgreSQL le remonte dans
        # `diag.constraint_name`, dont depend la traduction des conflits en 409.
        # `sqlite_where` double `postgresql_where` — sans lui l'index serait
        # global sur SQLite et les tests vaudraient l'inverse de ce qu'ils disent.
        Index(
            "uq_categorie_produit_libelle",
            "libelle",
            unique=True,
            postgresql_where=text("supprime_le IS NULL"),
            sqlite_where=text("supprime_le IS NULL"),
        ),
    )

    id_categorie: Mapped[int] = mapped_column(primary_key=True)
    libelle: Mapped[str] = mapped_column(String(100), nullable=False)

    produits: Mapped[list[Produit]] = relationship(
        back_populates="categorie", passive_deletes=True
    )
