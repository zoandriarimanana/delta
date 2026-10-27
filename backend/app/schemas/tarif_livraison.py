"""Schemas Pydantic de l'entité TARIF_LIVRAISON."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

MONTANT_MAX_CHIFFRES = 10
SEUIL_MAX_CHIFFRES = 12
DECIMALES = 2


class TarifLivraisonRead(BaseModel):
    """Tarif en sortie d'API — public : le client doit le voir avant d'acheter."""

    model_config = ConfigDict(from_attributes=True)

    forfait: Decimal
    #: `None` : la livraison n'est jamais offerte.
    seuil_gratuite: Decimal | None = None


class TarifLivraisonUpdate(BaseModel):
    """Modification partielle.

    Une clé **absente** laisse la valeur inchangée ; `seuil_gratuite` envoyé à
    `null` **retire** la gratuité — d'où `exclude_unset` côté service, qui
    distingue les deux.
    """

    forfait: Decimal | None = Field(
        default=None, ge=0, max_digits=MONTANT_MAX_CHIFFRES, decimal_places=DECIMALES
    )
    seuil_gratuite: Decimal | None = Field(
        default=None, gt=0, max_digits=SEUIL_MAX_CHIFFRES, decimal_places=DECIMALES
    )
