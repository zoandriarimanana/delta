"""Schemas Pydantic de l'entité BENEFICIAIRE."""

from pydantic import BaseModel, ConfigDict, Field

from app.models.beneficiaire import StatutBeneficiaire

LONGUEUR_NOM = 100
LONGUEUR_BADGE = 50


class BeneficiaireCreate(BaseModel):
    """Charge utile de création, commune aux deux populations.

    `id_abonnement` y figure explicitement dans les deux cas : contrairement à
    `ABONNEMENT.#id_client_entreprise`, ce n'est pas l'identité de l'appelant
    mais une référence à une ressource ciblée — même traitement que
    `COMMANDE.#id_reservation`. Ce qui distingue les deux chemins n'est donc
    pas la charge utile mais la vérification de propriété faite par le
    service appelé.
    """

    id_abonnement: int
    nom: str = Field(min_length=1, max_length=LONGUEUR_NOM)
    prenom: str = Field(min_length=1, max_length=LONGUEUR_NOM)
    identifiant_badge: str = Field(min_length=1, max_length=LONGUEUR_BADGE)
    statut: StatutBeneficiaire = StatutBeneficiaire.ACTIF


class BeneficiaireUpdate(BaseModel):
    """Mise à jour partielle. `id_abonnement` n'est jamais réassignable."""

    nom: str | None = Field(default=None, min_length=1, max_length=LONGUEUR_NOM)
    prenom: str | None = Field(default=None, min_length=1, max_length=LONGUEUR_NOM)
    identifiant_badge: str | None = Field(
        default=None, min_length=1, max_length=LONGUEUR_BADGE
    )
    statut: StatutBeneficiaire | None = None


class BeneficiaireRead(BaseModel):
    """Bénéficiaire en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    id_beneficiaire: int
    nom: str
    prenom: str
    identifiant_badge: str
    statut: StatutBeneficiaire
    id_abonnement: int
