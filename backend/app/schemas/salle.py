"""Schemas Pydantic de l'entité SALLE."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Bornes alignées sur les colonnes du modèle. Les dupliquer ici est volontaire :
# le schema rejette en 422 avec un message exploitable, avant que la base n'ait à
# trancher.
TARIF_MAX_CHIFFRES = 10
TARIF_DECIMALES = 2
LONGUEUR_NOM = 100


class SalleCreate(BaseModel):
    """Charge utile de création d'une salle.

    Les deux tarifs sont facultatifs **individuellement**, mais pas ensemble :
    voir le validateur. Le `CHECK` en base dit la même chose et reste la
    garantie réelle ; celui-ci produit un 422 lisible plutôt qu'une erreur
    d'intégrité traduite après coup.
    """

    nom: str = Field(min_length=1, max_length=LONGUEUR_NOM)
    # Une salle de zéro place n'est pas une salle.
    capacite: int = Field(gt=0)
    # `ge=0` et non `gt=0` : la gratuité est un cas légitime, mais elle doit
    # s'écrire `0.00`. C'est justement ce que le validateur ci-dessous impose —
    # une absence de tarif ne peut plus tenir lieu de gratuité.
    tarif_horaire: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=TARIF_MAX_CHIFFRES,
        decimal_places=TARIF_DECIMALES,
    )
    tarif_journee: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=TARIF_MAX_CHIFFRES,
        decimal_places=TARIF_DECIMALES,
    )
    equipements: str | None = None

    @model_validator(mode="after")
    def _exiger_au_moins_un_tarif(self) -> "SalleCreate":
        """Refuse une salle dépourvue des deux tarifs.

        Sans cette règle, la salle serait louable gratuitement sans que personne
        l'ait décidé, et rien ne distinguerait « gratuit » d'un oubli de saisie.
        """
        if self.tarif_horaire is None and self.tarif_journee is None:
            raise ValueError(
                "Une salle doit porter au moins un tarif, horaire ou journalier. "
                "Pour une salle gratuite, indiquer 0.00."
            )
        return self


class SalleUpdate(BaseModel):
    """Mise à jour partielle : toute clé absente laisse la colonne inchangée.

    La cohérence des tarifs **ne peut pas** être vérifiée ici : une mise à jour
    partielle ne porte souvent qu'un des deux, l'autre étant en base. Effacer le
    tarif horaire d'une salle qui porte un tarif journalier est parfaitement
    légitime. Seul le service, qui voit l'état courant, peut trancher — voir
    `SalleService.modifier`.
    """

    nom: str | None = Field(default=None, min_length=1, max_length=LONGUEUR_NOM)
    capacite: int | None = Field(default=None, gt=0)
    tarif_horaire: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=TARIF_MAX_CHIFFRES,
        decimal_places=TARIF_DECIMALES,
    )
    tarif_journee: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=TARIF_MAX_CHIFFRES,
        decimal_places=TARIF_DECIMALES,
    )
    equipements: str | None = None


class SalleRead(BaseModel):
    """Salle en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    id_salle: int
    nom: str
    capacite: int
    tarif_horaire: Decimal | None = None
    tarif_journee: Decimal | None = None
    equipements: str | None = None
