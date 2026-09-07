"""Service métier de PAIEMENT.

L'initiation d'un paiement est une action **séparée** du tunnel de commande
(décidé en ouvrant le Sprint 9) : la commande existe déjà, avec son
`montant_total` déjà figé, quand ce service intervient. Le contrôle de
propriété de la commande est porté par le routeur (même mécanique que
`GET /commandes/{id}/livraison`) — ce service ne connaît que les règles
propres à `PAIEMENT`.
"""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, ReferenceInvalide
from app.models.commande import Commande, StatutCommande
from app.models.paiement import Paiement, StatutPaiement
from app.repositories.paiement_repository import PaiementRepository
from app.schemas.paiement import PaiementCreate
from app.services.passerelle_paiement import PasserellePaiement
from app.services.passerelle_paiement_simulee import PasserelleSimulee

MESSAGE_COMMANDE_ANNULEE = (
    "Cette commande est annulée : impossible d'y associer un paiement."
)
MESSAGE_DEJA_PAYEE = "Cette commande a déjà été payée."
MESSAGE_REFERENCE_INCONNUE = "Aucun paiement ne porte la référence {reference}."

_CONTRAINTE_UNICITE_REUSSI = "uq_paiement_commande_reussi"


def _viole_double_paiement(erreur: IntegrityError) -> bool:
    """Distingue le blocage du double paiement d'une autre violation
    d'intégrité.

    Même raisonnement que `AbonnementService._viole_exclusion` : sans ce
    test, le service traduirait n'importe quelle `IntegrityError` en
    « déjà payée », y compris une clé étrangère cassée.
    """
    nom = getattr(getattr(erreur.orig, "diag", None), "constraint_name", None)
    return nom == _CONTRAINTE_UNICITE_REUSSI


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

        Pré-contrôle applicatif seulement, **sans** filet d'`IntegrityError` :
        `initier()` écrit toujours `statut=En_attente` (garanti par le
        contrat `PasserellePaiement`), jamais `Reussi` — elle ne peut donc
        jamais violer l'index unique partiel `uq_paiement_commande_reussi`
        elle-même. Cette traduction vit dans `confirmer()`, seule méthode
        qui écrit `Reussi` (cf. `docs/mld.md`).
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

    def confirmer(self, reference_externe: str, statut: StatutPaiement) -> Paiement:
        """Applique la confirmation reçue par webhook — la **signature** est
        vérifiée par l'appelant (le routeur) avant tout appel à cette
        méthode, jamais ici : ce n'est pas une règle de `PAIEMENT`, c'est la
        condition d'accès au webhook lui-même.

        **422** si `reference_externe` ne désigne aucun paiement — elle vient
        du corps de la requête, pas de l'URL.

        **Idempotent** : un paiement déjà `Reussi` ou `Echoue` ne rejoue
        rien, quel que soit le contenu de cette confirmation — un webhook
        peut être livré plusieurs fois par le fournisseur, et le rejouer ne
        doit ni re-décrémenter ni re-propager. Même raisonnement que
        `LivraisonService._refuser_si_terminee`.

        Un paiement `Reussi` fait progresser `COMMANDE.statut`
        (`En_attente` → `Confirmee`), à sens unique, dans la même
        transaction (cf. `docs/mld.md`). **409** en cas de course entre deux
        confirmations concurrentes pour la même commande — c'est ici, et
        nulle part ailleurs, que l'index unique partiel
        `uq_paiement_commande_reussi` peut être violé (cf. `initier`).
        """
        paiement = self.paiements.par_reference_externe(reference_externe)
        if paiement is None:
            raise ReferenceInvalide(
                MESSAGE_REFERENCE_INCONNUE.format(reference=reference_externe)
            )

        if paiement.statut != StatutPaiement.EN_ATTENTE:
            return paiement

        try:
            paiement.statut = statut
            if statut == StatutPaiement.REUSSI:
                # À l'intérieur du bloc, pas avant : `paiement.commande` est
                # un accès paresseux qui peut déclencher un autoflush,
                # c'est-à-dire écrire la ligne — et donc faire fuir cette
                # même `IntegrityError` hors du filet si l'accès a lieu
                # avant qu'il ne soit posé.
                self._propager_sur_la_commande(paiement)
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if _viole_double_paiement(erreur):
                raise ConflitMetier(MESSAGE_DEJA_PAYEE) from erreur
            raise
        return paiement

    def _propager_sur_la_commande(self, paiement: Paiement) -> None:
        """Fait avancer `COMMANDE.statut` quand le paiement est réussi.

        Ne régresse jamais un statut déjà plus avancé : seule une commande
        encore `En_attente` passe à `Confirmee`. Une confirmation arrivant
        tard, sur une commande déjà `Servie` par exemple, ne doit pas la
        ramener en arrière.
        """
        commande = paiement.commande
        if commande.statut == StatutCommande.EN_ATTENTE:
            commande.statut = StatutCommande.CONFIRMEE
