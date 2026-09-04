"""Schemas Pydantic de l'entité CONSOMMATION_REPAS."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class ConsommationRepasCreate(BaseModel):
    """Charge utile d'enregistrement d'une consommation.

    `id_beneficiaire` est optionnel dans le schema, mais sa présence ou son
    absence est contrainte par le `mode_suivi` de l'abonnement visé — une
    règle qui croise deux tables et ne peut donc pas être un `CHECK` en base
    (cf. `docs/mld.md`). Le service, seul, la vérifie.
    """

    date_consommation: date
    quantite: int = Field(default=1, gt=0)
    id_abonnement: int
    id_beneficiaire: int | None = None


class ConsommationRepasUpdate(BaseModel):
    """Mise à jour partielle. `id_abonnement` et `id_beneficiaire` ne sont
    jamais réassignables : corriger une consommation mal imputée s'archive
    et se recrée, plutôt que de rejouer la cohérence mode_suivi/bénéficiaire
    sur une ligne existante."""

    date_consommation: date | None = None
    quantite: int | None = Field(default=None, gt=0)


class ConsommationRepasRead(BaseModel):
    """Consommation en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    id_consommation: int
    date_consommation: date
    quantite: int
    id_abonnement: int
    id_beneficiaire: int | None = None
