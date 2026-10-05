"""Modèle SQLAlchemy de PHOTO_BIEN — galerie d'une SALLE ou d'un LOGEMENT.

**Les octets sont stockés en base, pas sur disque.** Le disque d'un service
Render est effacé à chaque redéploiement : une photo rangée sur disque
disparaîtrait sans que la ligne qui la référence le sache. Même raisonnement
que `DOCUMENT_CONNAISSANCE`, qui stocke son texte extrait pour la même raison.

Une seule entité pour les deux biens, et non deux tables jumelles : la règle
(formats, taille, nombre maximal, diffusion publique) est la même, deux copies
divergeraient. Le rattachement suit le patron d'`AVIS` — deux clés étrangères
nullables, exactement une renseignée (`CHECK cible_xor`).
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
        # Exactement un bien — même écriture que la contrainte n°3 d'AVIS.
        CheckConstraint(
            "(id_salle IS NOT NULL) <> (id_logement IS NOT NULL)",
            name="cible_xor",
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

    salle: Mapped[Salle | None] = relationship()
    logement: Mapped[Logement | None] = relationship()
