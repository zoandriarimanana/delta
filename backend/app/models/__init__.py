"""Point d'entrée unique du package `models`.

Importer ce module suffit à peupler `Base.metadata` avec les 20 tables du MLD.
C'est indispensable à Alembic (`alembic/env.py`, T0.5) : une entité non importée
ici est une entité invisible à l'autogénération, donc absente des migrations.

Toute nouvelle entité ajoutée à `app/models/` doit être ajoutée ci-dessous.
L'ordre des imports est alphabétique (imposé par `ruff`/isort) et sans incidence :
SQLAlchemy ne résout les relations entre entités qu'à la configuration des
mappers, une fois toutes les classes déclarées.
"""

from app.models.abonnement import Abonnement
from app.models.avis import Avis
from app.models.beneficiaire import Beneficiaire
from app.models.categorie_produit import CategorieProduit
from app.models.client import Client
from app.models.client_entreprise import ClientEntreprise
from app.models.client_particulier import ClientParticulier
from app.models.commande import Commande
from app.models.consommation_repas import ConsommationRepas
from app.models.demande_personnalisation import DemandePersonnalisation
from app.models.domaine_formation import DomaineFormation
from app.models.formation import Formation
from app.models.ligne_commande import LigneCommande
from app.models.livraison import Livraison
from app.models.logement import Logement
from app.models.personnel import Personnel
from app.models.produit import Produit
from app.models.reservation import Reservation
from app.models.salle import Salle
from app.models.session_formation import SessionFormation

__all__ = [
    "Abonnement",
    "Avis",
    "Beneficiaire",
    "CategorieProduit",
    "Client",
    "ClientEntreprise",
    "ClientParticulier",
    "Commande",
    "ConsommationRepas",
    "DemandePersonnalisation",
    "DomaineFormation",
    "Formation",
    "LigneCommande",
    "Livraison",
    "Logement",
    "Personnel",
    "Produit",
    "Reservation",
    "Salle",
    "SessionFormation",
]
