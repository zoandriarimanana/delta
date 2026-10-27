"""Modèle SQLAlchemy de l'entité LIVRAISON."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.commande import Commande
    from app.models.personnel import Personnel


class StatutLivraison(StrEnum):
    """Domaine de `LIVRAISON.statut` (cf. `docs/mld.md`).

    Domaine formel et non chaîne libre, même traitement que `COMMANDE.statut` et
    `PERSONNEL.fonction` : le service compare ces valeurs pour décider ce qu'une
    livraison autorise encore, et « livree » contre « Livree » lui échapperait.

    Deux fins possibles et non une seule. `ECHOUEE` n'est pas un doublon
    d'`ANNULEE` : l'une dit que la tournée a eu lieu sans aboutir — client
    absent, adresse introuvable —, l'autre qu'elle n'aura pas lieu. Les
    confondre effacerait la seule information utile au moment de relancer.
    """

    EN_ATTENTE = "En_attente"
    EN_COURS = "En_cours"
    LIVREE = "Livree"
    ECHOUEE = "Echouee"
    ANNULEE = "Annulee"


#: Statuts terminaux : une livraison qui les porte ne bouge plus.
STATUTS_TERMINAUX: frozenset[StatutLivraison] = frozenset(
    {StatutLivraison.LIVREE, StatutLivraison.ECHOUEE, StatutLivraison.ANNULEE}
)


class Livraison(SoftDeleteMixin, Base):
    """Livraison d'une commande par un membre du personnel.

    `id_personnel` est nullable : la livraison naît avec la commande, et
    l'affectation d'un livreur intervient plus tard. `NULL` signifie « pas
    encore affectée ». La contrainte « le personnel référencé a la fonction
    Livreur » n'est **pas** exprimable en clé étrangère — celle-ci pointe vers
    `PERSONNEL` tout entier — et relève de la couche `services/`.

    `date_heure_prevue` est nullable pour la même raison, et c'est un changement
    du MLD : la livraison étant créée automatiquement avec la commande, aucune
    date de tournée n'existe encore à cet instant. La rendre obligatoire
    forcerait à en inventer une — « dans deux heures » — c'est-à-dire à écrire
    une promesse que rien ne garantit. `NULL` signifie « pas encore planifiée »,
    exactement comme pour le livreur.

    `date_heure_reelle` reste NULL tant que la livraison n'est pas effectuée.
    """

    __tablename__ = "livraison"

    id_livraison: Mapped[int] = mapped_column(primary_key=True)
    adresse_livraison: Mapped[str] = mapped_column(Text, nullable=False)
    date_heure_prevue: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    date_heure_reelle: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    statut: Mapped[StatutLivraison] = mapped_column(
        SAEnum(
            StatutLivraison,
            native_enum=False,
            create_constraint=True,
            name="statut_livraison",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    id_commande: Mapped[int] = mapped_column(
        ForeignKey("commande.id_commande", ondelete="RESTRICT"),
        unique=True,
        nullable=False,
    )
    id_personnel: Mapped[int | None] = mapped_column(
        ForeignKey("personnel.id_personnel")
    )

    commande: Mapped[Commande] = relationship(back_populates="livraison")
    livreur: Mapped[Personnel | None] = relationship(back_populates="livraisons")
