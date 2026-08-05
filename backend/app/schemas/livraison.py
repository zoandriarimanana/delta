"""Schemas Pydantic de l'entité LIVRAISON."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.livraison import StatutLivraison


class LivraisonRead(BaseModel):
    """Livraison en sortie d'API, **pour le personnel**.

    Porte l'identité du livreur affecté. Ne jamais utiliser ce schema sur un
    endpoint public : voir `LivraisonPublique`.
    """

    model_config = ConfigDict(from_attributes=True)

    id_livraison: int
    adresse_livraison: str
    statut: StatutLivraison
    date_heure_prevue: datetime | None = None
    date_heure_reelle: datetime | None = None
    id_commande: int
    #: `None` tant qu'aucun livreur n'est affecté.
    id_personnel: int | None = None


class LivraisonPublique(BaseModel):
    """Livraison telle qu'un client la voit — **statut et rien d'autre**.

    Schema distinct de `LivraisonRead` et non un filtrage à l'affichage : la page
    accessible par `reference_publique` n'a **aucune authentification**, un UUID
    suffit à l'ouvrir. Y exposer l'identité ou le contact du livreur reviendrait
    à publier la donnée personnelle d'un tiers qui n'y a pas consenti.

    L'adresse n'y figure pas non plus : le client la connaît déjà, et l'afficher
    la rendrait lisible par quiconque détient l'URL.

    Deux schemas plutôt qu'un champ conditionnel : un oubli de condition est
    invisible, un mauvais schema se voit à la lecture de la signature.
    """

    model_config = ConfigDict(from_attributes=True)

    statut: StatutLivraison
    date_heure_prevue: datetime | None = None
    date_heure_reelle: datetime | None = None


class LivraisonAffectation(BaseModel):
    """Affectation d'un livreur à une livraison."""

    id_personnel: int


class LivraisonPlanification(BaseModel):
    """Planification de la tournée."""

    date_heure_prevue: datetime


class LivraisonChangementStatut(BaseModel):
    """Changement de statut d'une livraison."""

    statut: StatutLivraison
