"""Schemas Pydantic de l'entité TAUX_CHANGE."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.taux_change import Devise


class TauxChangeRead(BaseModel):
    """Taux en sortie d'API — public : le client doit voir le prix dans sa
    devise avant d'acheter, et la date du taux qui le calcule."""

    model_config = ConfigDict(from_attributes=True)

    devise: Devise
    ariary_par_unite: Decimal
    mis_a_jour_le: datetime


class TauxChangeUpdate(BaseModel):
    """Nouveau taux d'une devise. La devise vient de l'URL."""

    ariary_par_unite: Decimal = Field(gt=0, max_digits=14, decimal_places=4)
