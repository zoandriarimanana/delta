"""Modèle SQLAlchemy de PHOTO_BIEN — galerie d'une SALLE, d'un LOGEMENT ou
d'une FORMATION.

**Les octets sont stockés en base, pas sur disque.** Le disque d'un service
Render est effacé à chaque redéploiement : une photo rangée sur disque
disparaîtrait sans que la ligne qui la référence le sache. Même raisonnement
que `DOCUMENT_CONNAISSANCE`, qui stocke son texte extrait pour la même raison.

Une seule entité pour les trois éléments du catalogue, et non des tables
jumelles : la règle (formats, taille, nombre maximal, diffusion publique) est
la même, plusieurs copies divergeraient. Le rattachement suit le patron de la
contrainte n°2 de `RESERVATION` — trois clés étrangères nullables, mais ici
**exactement** une renseignée (`CHECK cible_unique`).

« Bien » est pris au sens large depuis l'ajout des formations : ce qui est
présenté en galerie sur une fiche publique.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, LargeBinary, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, deferred, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.formation import Formation
    from app.models.logement import Logement
    from app.models.salle import Salle


class FormatPhoto(StrEnum):
    """Format **détecté** dans les octets, jamais celui que déclare le client.

    Domaine formel : c'est lui qui fixe le `Content-Type` renvoyé à la lecture.
    """

    JPEG = "JPEG"
    PNG = "PNG"
    WEBP = "WEBP"


class PhotoBien(SoftDeleteMixin, Base):
    """Photo d'une salle ou d'un logement, affichée sur sa fiche publique."""

    __tablename__ = "photo_bien"
    __table_args__ = (
        # Exactement un élément — même écriture que la contrainte n°2 de
        # RESERVATION, mais `= 1` et non `<= 1` : une photo orpheline n'a
        # aucune fiche où s'afficher.
        CheckConstraint(
            "(id_salle IS NOT NULL)::int + (id_logement IS NOT NULL)::int"
            " + (id_formation IS NOT NULL)::int = 1",
            name="cible_unique",
        ),
        CheckConstraint("taille_octets > 0", name="taille_positive"),
    )

    id_photo: Mapped[int] = mapped_column(primary_key=True)
    #: `deferred` : une liste de photos ne charge jamais les octets. Seule la
    #: route de diffusion les lit, une photo à la fois.
    contenu: Mapped[bytes] = deferred(mapped_column(LargeBinary, nullable=False))
    format: Mapped[FormatPhoto] = mapped_column(
        SAEnum(
            FormatPhoto,
            native_enum=False,
            create_constraint=True,
            name="format_photo",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    taille_octets: Mapped[int] = mapped_column(nullable=False)
    legende: Mapped[str | None] = mapped_column(String(200))
    date_ajout: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    #: `CASCADE` : une photo n'a aucune valeur probante. Supprimer
    #: définitivement le bien emporte sa galerie, rien d'autre ne la référence.
    id_salle: Mapped[int | None] = mapped_column(
        ForeignKey("salle.id_salle", ondelete="CASCADE")
    )
    id_logement: Mapped[int | None] = mapped_column(
        ForeignKey("logement.id_logement", ondelete="CASCADE")
    )
    id_formation: Mapped[int | None] = mapped_column(
        ForeignKey("formation.id_formation", ondelete="CASCADE")
    )

    salle: Mapped[Salle | None] = relationship()
    logement: Mapped[Logement | None] = relationship()
    formation: Mapped[Formation | None] = relationship()
