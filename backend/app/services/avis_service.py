"""Service métier de AVIS.

Lecture publique, création réservée au client connecté et propriétaire de la
cible — un avis sur la commande d'un tiers n'a pas de sens. La cible doit de
surcroît avoir atteint son statut terminal (`Livree`/`Servie` selon
`STATUT_TERMINAL` pour une commande, `Honoree` pour une réservation) : noter
une commande encore `En_attente` ou une réservation seulement `Confirmee`
n'a pas de sens, ce ne sont pas des états d'erreur mais des états trop tôt.
"""

from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, ReferenceInvalide, RessourceIntrouvable
from app.models.avis import Avis, TypeAvis
from app.models.client import Client
from app.models.commande import STATUT_TERMINAL
from app.models.ligne_commande import LigneCommande
from app.models.reservation import Reservation, StatutReservation
from app.repositories.avis_repository import AvisRepository
from app.repositories.ligne_commande_repository import LigneCommandeRepository
from app.repositories.reservation_repository import ReservationRepository
from app.schemas.avis import AvisCreate

MESSAGE_LIGNE_INVALIDE = "Aucune ligne de commande ne porte l'identifiant {id}."
MESSAGE_RESERVATION_INVALIDE = "Aucune réservation ne porte l'identifiant {id}."
MESSAGE_DEJA_NOTE = "Un avis a déjà été déposé sur cette cible."
MESSAGE_COMMANDE_PAS_TERMINEE = (
    "Cette commande n'est pas encore {statut_attendu} : impossible d'y "
    "déposer un avis."
)
MESSAGE_RESERVATION_PAS_HONOREE = (
    "Cette réservation n'est pas honorée : impossible d'y déposer un avis."
)

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
        `CommandeService._verifier_reservation`. **409** si la cible existe et
        appartient au client mais n'a pas atteint son statut terminal, ou si
        un avis existe déjà pour ce client sur cette cible (traduit depuis
        l'index unique partiel) : dans les deux cas la référence est valide,
        c'est l'état actuel qui s'y oppose — même distinction que pour un
        logement non `Disponible`.
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
        self._verifier_commande_terminee(ligne)

    def _verifier_commande_terminee(self, ligne: LigneCommande) -> None:
        """409 : la référence est valide, c'est l'état de la commande qui
        s'y oppose — pas encore `Livree`/`Servie` selon son type
        (`STATUT_TERMINAL`, cf. `docs/mld.md`)."""
        commande = ligne.commande
        statut_attendu = STATUT_TERMINAL[commande.type_commande]
        if commande.statut != statut_attendu:
            raise ConflitMetier(
                MESSAGE_COMMANDE_PAS_TERMINEE.format(
                    statut_attendu=statut_attendu.value
                )
            )

    def _verifier_reservation(self, id_reservation: int | None, client: Client) -> None:
        assert id_reservation is not None  # garanti par AvisCreate._cible_xor
        reservation = self.reservations.get_by_id(id_reservation)
        if reservation is None or reservation.id_client != client.id_client:
            raise ReferenceInvalide(
                MESSAGE_RESERVATION_INVALIDE.format(id=id_reservation)
            )
        self._verifier_reservation_honoree(reservation)

    def _verifier_reservation_honoree(self, reservation: Reservation) -> None:
        """409 : la référence est valide, c'est l'état de la réservation qui
        s'y oppose — pas encore `Honoree`."""
        if reservation.statut != StatutReservation.HONOREE:
            raise ConflitMetier(MESSAGE_RESERVATION_PAS_HONOREE)
