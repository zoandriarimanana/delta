"""Service métier de PAIEMENT.

L'initiation d'un paiement est une action **séparée** du tunnel de commande
(décidé en ouvrant le Sprint 9) : la commande existe déjà, avec son
`montant_total` déjà figé, quand ce service intervient. Le contrôle de
propriété de la commande est porté par le routeur (même mécanique que
`GET /commandes/{id}/livraison`) — ce service ne connaît que les règles
propres à `PAIEMENT`.
"""

from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier
from app.models.commande import Commande, StatutCommande
from app.models.paiement import Paiement
from app.repositories.paiement_repository import PaiementRepository
from app.schemas.paiement import PaiementCreate
from app.services.passerelle_paiement import PasserellePaiement
from app.services.passerelle_paiement_simulee import PasserelleSimulee

MESSAGE_COMMANDE_ANNULEE = (
    "Cette commande est annulée : impossible d'y associer un paiement."
)
MESSAGE_DEJA_PAYEE = "Cette commande a déjà été payée."


class PaiementService:
    """Cycle de vie d'un paiement, via une passerelle simulée en attendant
    les accès API réels aux fournisseurs (cf. `docs/mld.md`)."""

    def __init__(
        self, db: Session, passerelle: PasserellePaiement | None = None
    ) -> None:
        self.db = db
        self.paiements = PaiementRepository(db)
        # Le paramètre n'existe que pour les tests : la production ne passe
        # jamais de passerelle explicite, elle obtient toujours celle par
        # défaut. Voir `docs/mld.md` — aucun accès réel n'est encore branché.
        self.passerelle = passerelle if passerelle is not None else PasserelleSimulee()

    def initier(self, commande: Commande, donnees: PaiementCreate) -> Paiement:
        """Initie un paiement pour `commande`, déjà vérifiée comme
        appartenant à l'appelant par le routeur.

        **409** si la commande est `Annulee`, ou si elle porte déjà un
        paiement `Reussi` — dans les deux cas, la référence est valide,
        c'est l'état actuel qui s'y oppose.

        Ce contrôle n'a ici qu'un pré-contrôle applicatif, **sans** filet
        d'`IntegrityError` : `initier()` écrit toujours `statut=En_attente`
        (garanti par le contrat `PasserellePaiement`), jamais `Reussi` —
        elle ne peut donc jamais violer l'index unique partiel
        `uq_paiement_commande_reussi` elle-même. La course qu'il protège se
        situe entre deux *confirmations* concurrentes, pas deux initiations
        : c'est au point qui fera passer un paiement à `Reussi` (le
        webhook, Sprint 9.4) qu'il faudra traduire cette `IntegrityError`
        — voir `docs/mld.md`.
        """
        if commande.statut == StatutCommande.ANNULEE:
            raise ConflitMetier(MESSAGE_COMMANDE_ANNULEE)

        if self.paiements.existe_reussi_pour_commande(commande.id_commande):
            raise ConflitMetier(MESSAGE_DEJA_PAYEE)

        resultat = self.passerelle.initier(
            commande.montant_total, donnees.methode, donnees.fournisseur
        )

        paiement = Paiement(
            montant=commande.montant_total,
            methode=donnees.methode,
            fournisseur=donnees.fournisseur,
            statut=resultat.statut,
            reference_externe=resultat.reference_externe,
            id_commande=commande.id_commande,
        )
        self.db.add(paiement)
        self.db.commit()
        return paiement
