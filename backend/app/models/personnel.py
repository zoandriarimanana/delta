"""Modèle SQLAlchemy de l'entité PERSONNEL."""

from __future__ import annotations

from datetime import date
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, Index, String, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.livraison import Livraison
    from app.models.session_formation import SessionFormation


class FonctionPersonnel(StrEnum):
    """Domaine de `PERSONNEL.fonction` (cf. `docs/mld.md`).

    Un domaine formel et non une chaîne libre : deux règles de service le
    comparent — « ne pas affecter un cuisinier à une livraison » (sprint 3),
    « ne pas affecter un livreur comme formateur » (sprint 4). La FK ne les
    garantit pas, elle pointe vers `PERSONNEL` tout entier. Contre une chaîne
    libre, « livreur », « Livreur » et « Livreur » avec une espace finale
    seraient trois fonctions distinctes, et la vérification passerait à côté
    sans que rien ne le signale.

    `AUTRE` évite que le domaine devienne une camisole : un poste non prévu ne
    doit pas bloquer une embauche ni forcer une migration.
    """

    FORMATEUR = "Formateur"
    LIVREUR = "Livreur"
    CUISINIER = "Cuisinier"
    RECEPTIONNISTE = "Receptionniste"
    AUTRE = "Autre"


class Personnel(SoftDeleteMixin, Base):
    """Membre du personnel, toutes fonctions confondues.

    `specialite` n'a de sens que pour un formateur, `zone_livraison` que pour un
    livreur : les deux sont donc nullables.

    `est_administrateur` est **orthogonal à `fonction`** : le premier porte un
    droit, le second un métier. Un formateur peut administrer le catalogue, un
    cuisinier non — dériver les droits de la fonction confondrait les deux
    notions et interdirait ce cumul.
    """

    __tablename__ = "personnel"

    __table_args__ = (
        # Index unique PARTIEL, et non contrainte UNIQUE : deux lignes peuvent
        # partager cette valeur si l'une est archivee. Sans ca, une ligne
        # supprimee bloquerait sa propre valeur a jamais.
        # Le nom est conserve a l'identique : PostgreSQL le remonte dans
        # `diag.constraint_name`, dont depend la traduction des conflits en 409.
        # `sqlite_where` double `postgresql_where` — sans lui l'index serait
        # global sur SQLite et les tests vaudraient l'inverse de ce qu'ils disent.
        Index(
            "uq_personnel_email",
            "email",
            unique=True,
            postgresql_where=text("supprime_le IS NULL"),
            sqlite_where=text("supprime_le IS NULL"),
        ),
    )

    id_personnel: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    fonction: Mapped[FonctionPersonnel] = mapped_column(
        SAEnum(
            FonctionPersonnel,
            native_enum=False,
            create_constraint=True,
            name="fonction_personnel",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    telephone: Mapped[str | None] = mapped_column(String(30))
    date_embauche: Mapped[date | None] = mapped_column(Date)
    specialite: Mapped[str | None] = mapped_column(String(100))
    zone_livraison: Mapped[str | None] = mapped_column(String(100))
    #: Droit d'administration, distinct du métier. `server_default` et non
    #: seulement `default` : une insertion hors API — seed, correction manuelle
    #: — ne doit pas pouvoir créer un administrateur par omission.
    est_administrateur: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    sessions_formation: Mapped[list[SessionFormation]] = relationship(
        back_populates="formateur"
    )
    livraisons: Mapped[list[Livraison]] = relationship(back_populates="livreur")
