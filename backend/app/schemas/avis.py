"""Schemas Pydantic de l'entité AVIS."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.avis import TypeAvis

NOTE_MIN = 1
NOTE_MAX = 5


class AvisCreate(BaseModel):
    """Charge utile de création.

    `id_client` n'y figure pas : il vient du jeton, jamais du corps — même
    règle que `COMMANDE.#id_client`. Exactement une des deux cibles
    (`id_ligne` / `id_reservation`) doit être renseignée, et cohérente avec
    `type_avis` — les deux validateurs dupliquent les `CHECK` posés en base
    (`cible_xor`, `type_coherent_avec_cible`) : la base reste la garantie
    réelle, ceux-ci ne font que produire un 422 lisible avant qu'elle ait à
    trancher.

    Pas de `AvisUpdate` : un avis ne se corrige pas, il se remplace — la
    modération l'archive et un nouveau peut être déposé, cf. `docs/mld.md`.
    """

    type_avis: TypeAvis
    note: int = Field(ge=NOTE_MIN, le=NOTE_MAX)
    commentaire: str | None = None
    id_ligne: int | None = None
    id_reservation: int | None = None

    @model_validator(mode="after")
    def _cible_xor(self) -> "AvisCreate":
        if (self.id_ligne is not None) == (self.id_reservation is not None):
            raise ValueError(
                "Un avis porte sur une ligne de commande ou une réservation, "
                "jamais les deux ni aucune des deux."
            )
        return self

    @model_validator(mode="after")
    def _type_coherent_avec_cible(self) -> "AvisCreate":
        if (self.type_avis == TypeAvis.PRODUIT) != (self.id_ligne is not None):
            raise ValueError(
                "Un avis « Produit » porte sur id_ligne, un avis « Service » "
                "sur id_reservation."
            )
        return self


class AvisRead(BaseModel):
    """Avis en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    id_avis: int
    type_avis: TypeAvis
    note: int
    commentaire: str | None
    date_avis: datetime
    id_client: int
    id_ligne: int | None
    id_reservation: int | None
