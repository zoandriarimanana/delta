"""Schemas Pydantic de l'entité CONSOMMATION_REPAS."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.abonnement import TypeFacturation


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


class SoldeAbonnement(BaseModel):
    """Solde calculé à la demande — jamais stocké (cf. `docs/roadmap.md`, 7.2 :
    « pas d'entité FACTURE, calcul à la demande »).

    `repas_restants` n'a de sens que pour un abonnement au forfait : la
    consommation réelle n'a pas de quota à décompter, elle facture ce qui est
    consommé. `None` sur `Consommation_reelle`, jamais `0` — un zéro
    suggérerait un quota épuisé qui n'existe pas dans ce mode.

    `repas_restants` peut être **négatif** sur un forfait dépassé : c'est une
    information, pas une erreur — le service ne plafonne pas à zéro, sous
    peine de masquer un dépassement à l'administrateur.
    """

    id_abonnement: int
    type_facturation: TypeFacturation
    repas_consommes: int
    repas_inclus: int | None = None
    repas_restants: int | None = None
    montant_facture: Decimal
