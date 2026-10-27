"""Schemas Pydantic de l'entité ABONNEMENT (cantine B2B)."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.abonnement import ModeSuivi, TypeFacturation

TARIF_MAX_CHIFFRES = 10
TARIF_DECIMALES = 2


class AbonnementCreate(BaseModel):
    """Charge utile de création, côté client entreprise.

    `id_client_entreprise` n'y figure pas : il vient du jeton, jamais du
    corps — même règle que `COMMANDE.#id_client`. Un client entreprise ne peut
    souscrire que pour lui-même.

    Les deux validateurs dupliquent les `CHECK` posés en base
    (`dates_coherentes`, `tarif_selon_facturation`) : la base reste la garantie
    réelle, ceux-ci ne font que produire un 422 lisible avant qu'elle ait à
    trancher.
    """

    date_debut: date
    date_fin: date
    type_facturation: TypeFacturation
    mode_suivi: ModeSuivi
    nombre_repas_inclus: int | None = Field(default=None, gt=0)
    tarif_forfait: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=TARIF_MAX_CHIFFRES,
        decimal_places=TARIF_DECIMALES,
    )
    tarif_unitaire_repas: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=TARIF_MAX_CHIFFRES,
        decimal_places=TARIF_DECIMALES,
    )

    @model_validator(mode="after")
    def _dates_coherentes(self) -> "AbonnementCreate":
        if self.date_fin <= self.date_debut:
            raise ValueError("La date de fin doit être postérieure à la date de début.")
        return self

    @model_validator(mode="after")
    def _tarif_selon_facturation(self) -> "AbonnementCreate":
        if (
            self.type_facturation == TypeFacturation.FORFAIT
            and self.tarif_forfait is None
        ):
            raise ValueError(
                "Un abonnement facturé au forfait doit porter un tarif_forfait."
            )
        if (
            self.type_facturation == TypeFacturation.CONSOMMATION_REELLE
            and self.tarif_unitaire_repas is None
        ):
            raise ValueError(
                "Un abonnement facturé à la consommation réelle doit porter "
                "un tarif_unitaire_repas."
            )
        return self


class AbonnementCreateAdmin(AbonnementCreate):
    """Charge utile de création, côté personnel administrateur.

    Seule différence avec `AbonnementCreate` : `id_client_entreprise` est
    explicite, l'administrateur pouvant créer l'abonnement de n'importe quelle
    entreprise cliente. Hérite des mêmes validateurs de cohérence.
    """

    id_client_entreprise: int


class AbonnementUpdate(BaseModel):
    """Mise à jour partielle. `id_client_entreprise` n'est jamais réassignable.

    Les deux validateurs ne s'appliquent qu'aux champs fournis : une mise à
    jour partielle qui ne touche ni aux dates ni aux tarifs n'a pas à les
    revalider contre des valeurs qu'elle ne change pas. Le service, qui
    connaît l'état courant, reprend la vérification croisée (cf.
    `docs/architecture.md`, pattern `ProduitService.modifier`).
    """

    date_debut: date | None = None
    date_fin: date | None = None
    type_facturation: TypeFacturation | None = None
    mode_suivi: ModeSuivi | None = None
    nombre_repas_inclus: int | None = Field(default=None, gt=0)
    tarif_forfait: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=TARIF_MAX_CHIFFRES,
        decimal_places=TARIF_DECIMALES,
    )
    tarif_unitaire_repas: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=TARIF_MAX_CHIFFRES,
        decimal_places=TARIF_DECIMALES,
    )

    @model_validator(mode="after")
    def _dates_coherentes_si_fournies(self) -> "AbonnementUpdate":
        if (
            self.date_debut is not None
            and self.date_fin is not None
            and self.date_fin <= self.date_debut
        ):
            raise ValueError("La date de fin doit être postérieure à la date de début.")
        return self


class AbonnementRead(BaseModel):
    """Abonnement en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    id_abonnement: int
    date_debut: date
    date_fin: date
    type_facturation: TypeFacturation
    mode_suivi: ModeSuivi
    nombre_repas_inclus: int | None = None
    tarif_forfait: Decimal | None = None
    tarif_unitaire_repas: Decimal | None = None
    id_client_entreprise: int
