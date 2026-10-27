"""Service métier de DEMANDE_FORMATION (14 octobre 2026)."""

from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.core.exceptions import RessourceIntrouvable
from app.models.client import Client
from app.models.demande_formation import DemandeFormation
from app.repositories.demande_formation_repository import (
    DemandeFormationRepository,
)
from app.schemas.demande_formation import (
    DemandeFormationCreate,
    DemandeFormationSuivi,
)


class DemandeFormationService:
    """Envoi d'une demande par un visiteur, suivi par l'administration."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.demandes = DemandeFormationRepository(db)

    def envoyer(
        self, donnees: DemandeFormationCreate, client: Client | None
    ) -> DemandeFormation:
        """Enregistre la demande, toujours `Nouvelle`. Le client est celui de
        la session s'il y en a une, jamais une valeur du corps."""
        demande = self.demandes.create(
            {
                **donnees.model_dump(),
                "id_client": client.id_client if client is not None else None,
            }
        )
        self.db.commit()
        self.db.refresh(demande)
        return demande

    def lister(self) -> Sequence[DemandeFormation]:
        return self.demandes.lister_recentes()

    def obtenir(self, id_demande: int) -> DemandeFormation:
        demande = self.demandes.get_by_id(id_demande)
        if demande is None:
            raise RessourceIntrouvable("Demande de formation introuvable.")
        return demande

    def suivre(
        self, id_demande: int, donnees: DemandeFormationSuivi
    ) -> DemandeFormation:
        """Pose l'avancement et la note interne. Tous les statuts sont
        permis dans les deux sens : une demande refusée peut être reprise si
        le client rappelle — rien n'est engagé tant qu'aucune session n'est
        créée au catalogue."""
        demande = self.obtenir(id_demande)
        demande.statut = donnees.statut
        demande.note_interne = donnees.note_interne
        self.db.commit()
        return demande

    def archiver(self, id_demande: int) -> None:
        self.demandes.delete(self.obtenir(id_demande))
        self.db.commit()
