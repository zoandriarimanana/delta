"""Service métier de AVIS.

Lecture publique, création réservée au client connecté et propriétaire de la
cible — un avis sur la commande d'un tiers n'a pas de sens. Le contrôle
d'éligibilité (statut Livrée/Honorée de la cible) est traité à part, en 8.2 :
cette version ne vérifie que la propriété, pas encore l'état de la cible.
"""

from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, ReferenceInvalide, RessourceIntrouvable
from app.models.avis import Avis, TypeAvis
from app.models.client import Client
from app.repositories.avis_repository import AvisRepository
from app.repositories.ligne_commande_repository import LigneCommandeRepository
from app.repositories.reservation_repository import ReservationRepository
from app.schemas.avis import AvisCreate

MESSAGE_LIGNE_INVALIDE = "Aucune ligne de commande ne porte l'identifiant {id}."
MESSAGE_RESERVATION_INVALIDE = "Aucune réservation ne porte l'identifiant {id}."
MESSAGE_DEJA_NOTE = "Un avis a déjà été déposé sur cette cible."

_CONTRAINTES_UNICITE = {"uq_avis_client_ligne", "uq_avis_client_reservation"}


def _viole_unicite(erreur: IntegrityError) -> bool:
    """Distingue un doublon d'avis d'une autre violation d'intégrité.

    Même raisonnement que `AbonnementService._viole_exclusion` : sans ce
    test, le service traduirait n'importe quelle `IntegrityError` en
    « déjà noté », y compris une clé étrangère cassée.
    """
    nom = getattr(getattr(erreur.orig, "diag", None), "constraint_name", None)
    return nom in _CONTRAINTES_UNICITE


class AvisService:
    """Cycle de vie d'un avis client."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.avis = AvisRepository(db)
        self.lignes = LigneCommandeRepository(db)
        self.reservations = ReservationRepository(db)

    # --- Lecture, publique -----------------------------------------------

    def obtenir(self, id_avis: int) -> Avis:
        """Retourne un avis, ou lève `RessourceIntrouvable` (404) — l'identifiant
        vient de l'URL."""
        avis = self.avis.get_by_id(id_avis)
        if avis is None:
            raise RessourceIntrouvable("Avis introuvable.")
        return avis

    def lister(self) -> Sequence[Avis]:
        return self.avis.list()

    def lister_par_ligne(self, id_ligne: int) -> Sequence[Avis]:
        return self.avis.par_ligne(id_ligne)

    def lister_par_reservation(self, id_reservation: int) -> Sequence[Avis]:
        return self.avis.par_reservation(id_reservation)

    # --- Création -----------------------------------------------------------

    def creer(self, donnees: AvisCreate, client: Client) -> Avis:
        """Crée un avis pour le client connecté.

        **422** si la cible désignée n'existe pas ou n'appartient pas au
        client : même message dans les deux cas, une référence de corps ne
        doit pas confirmer l'existence du bien d'autrui — même règle que
        `CommandeService._verifier_reservation`. **409** si un avis existe déjà
        pour ce client sur cette cible, traduit depuis l'index unique partiel.
        """
        if donnees.type_avis == TypeAvis.PRODUIT:
            self._verifier_ligne(donnees.id_ligne, client)
        else:
            self._verifier_reservation(donnees.id_reservation, client)

        avis = Avis(
            type_avis=donnees.type_avis,
            note=donnees.note,
            commentaire=donnees.commentaire,
            id_ligne=donnees.id_ligne,
            id_reservation=donnees.id_reservation,
            id_client=client.id_client,
        )
        self.db.add(avis)
        try:
            self.db.flush()
        except IntegrityError as erreur:
            self.db.rollback()
            if _viole_unicite(erreur):
                raise ConflitMetier(MESSAGE_DEJA_NOTE) from erreur
            raise
        self.db.commit()
        return avis

    def _verifier_ligne(self, id_ligne: int | None, client: Client) -> None:
        assert id_ligne is not None  # garanti par AvisCreate._cible_xor
        ligne = self.lignes.get_by_id(id_ligne)
        if ligne is None or ligne.commande.id_client != client.id_client:
            raise ReferenceInvalide(MESSAGE_LIGNE_INVALIDE.format(id=id_ligne))

    def _verifier_reservation(self, id_reservation: int | None, client: Client) -> None:
        assert id_reservation is not None  # garanti par AvisCreate._cible_xor
        reservation = self.reservations.get_by_id(id_reservation)
        if reservation is None or reservation.id_client != client.id_client:
            raise ReferenceInvalide(
                MESSAGE_RESERVATION_INVALIDE.format(id=id_reservation)
            )
