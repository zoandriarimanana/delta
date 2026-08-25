"""Schemas Pydantic de l'entité LOGEMENT."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.logement import StatutLogement

# Bornes alignées sur les colonnes du modèle. Les dupliquer ici est volontaire :
# le schema rejette en 422 avec un message exploitable, avant que la base n'ait à
# trancher.
TARIF_MAX_CHIFFRES = 10
TARIF_DECIMALES = 2
LONGUEUR_TYPE = 50


class LogementCreate(BaseModel):
    """Charge utile de création d'un logement.

    `statut` naît `Disponible` : un logement qu'on ajoute au catalogue est en
    principe louable. Le passer en maintenance est une décision explicite, prise
    ensuite — c'est un cycle de vie, pas une donnée d'entrée.
    """

    type_chambre: str = Field(min_length=1, max_length=LONGUEUR_TYPE)
    # Un logement de zéro place ne loge personne.
    capacite: int = Field(gt=0)
    # `ge=0` et non `gt=0` : un hébergement offert reste un cas légitime, et
    # contrairement à `SALLE` le tarif est ici obligatoire — il n'y a qu'une
    # colonne, l'absence n'est pas représentable.
    tarif_nuitee: Decimal = Field(
        ge=0, max_digits=TARIF_MAX_CHIFFRES, decimal_places=TARIF_DECIMALES
    )


class LogementUpdate(BaseModel):
    """Mise à jour partielle : toute clé absente laisse la colonne inchangée.

    `statut` y figure, contrairement à `LogementCreate` : changer l'état d'un
    bien est précisément ce qu'un administrateur fait au fil du temps.
    """

    type_chambre: str | None = Field(
        default=None, min_length=1, max_length=LONGUEUR_TYPE
    )
    capacite: int | None = Field(default=None, gt=0)
    tarif_nuitee: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=TARIF_MAX_CHIFFRES,
        decimal_places=TARIF_DECIMALES,
    )
    statut: StatutLogement | None = None


class LogementRead(BaseModel):
    """Logement en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    id_logement: int
    type_chambre: str
    capacite: int
    tarif_nuitee: Decimal
    statut: StatutLogement
