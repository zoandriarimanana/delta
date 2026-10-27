"""Service métier de CLIENT_ENTREPRISE, côté administration.

Scope volontairement réduit : la seule opération nécessaire aujourd'hui est
de peupler un sélecteur d'entreprise lors de la création d'un abonnement par
un administrateur — rien dans l'API n'exposait jusqu'ici la moindre liste
d'entreprises clientes. Ni recherche ni pagination : au premier besoin réel
d'un annuaire clients, ce service grandira, il ne sera pas réécrit.
"""

from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.models.client_entreprise import ClientEntreprise
from app.repositories.client_entreprise_repository import ClientEntrepriseRepository


class ClientEntrepriseService:
    """Lecture des entreprises clientes, réservée à l'administration."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.clients_entreprise = ClientEntrepriseRepository(db)

    def lister(self) -> Sequence[ClientEntreprise]:
        """Entreprises clientes actives, pour un sélecteur d'administration.

        Les entreprises archivées sont exclues : on ne crée pas de nouvel
        abonnement au nom d'un client qui n'existe plus pour les lectures
        courantes — même filtre par défaut que partout ailleurs.
        """
        return self.clients_entreprise.list()
