"""Service métier de ABONNEMENT.

Deux chemins de création, deux populations : un client entreprise souscrit
pour lui-même, un administrateur souscrit pour n'importe quelle entreprise
cliente. Aucune identité ne vient jamais du corps de la requête côté client —
même règle que `COMMANDE.#id_client`.
"""

from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.core.exceptions import (
    AutorisationInsuffisante,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.models.abonnement import Abonnement, TypeFacturation
from app.models.client import Client, TypeClient
from app.repositories.abonnement_repository import AbonnementRepository
from app.repositories.client_entreprise_repository import ClientEntrepriseRepository
from app.schemas.abonnement import (
    AbonnementCreate,
    AbonnementCreateAdmin,
    AbonnementUpdate,
)

MESSAGE_RESERVE_ENTREPRISE = (
    "Seul un compte entreprise peut souscrire un abonnement cantine."
)


class AbonnementService:
    """Cycle de vie d'un abonnement cantine B2B."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.abonnements = AbonnementRepository(db)
        self.clients_entreprise = ClientEntrepriseRepository(db)

    # --- Lecture --------------------------------------------------------------

    def obtenir(self, id_abonnement: int) -> Abonnement:
        """Retourne un abonnement, ou lève `RessourceIntrouvable` (404).

        Réservé à l'administrateur : aucun contrôle de propriété ici.
        """
        abonnement = self.abonnements.get_by_id(id_abonnement)
        if abonnement is None:
            raise RessourceIntrouvable("Abonnement introuvable.")
        return abonnement

    def obtenir_du_client_entreprise(
        self, id_abonnement: int, client: Client
    ) -> Abonnement:
        """Retourne un abonnement du client entreprise connecté, ou 404.

        **404 et non 403** sur l'abonnement d'une autre entreprise : confirmer
        son existence renseignerait déjà. Même règle que
        `ReservationService.obtenir_du_client`.
        """
        abonnement = self.obtenir(id_abonnement)
        if abonnement.id_client_entreprise != client.id_client:
            raise RessourceIntrouvable("Abonnement introuvable.")
        return abonnement

    def lister(self) -> Sequence[Abonnement]:
        """Tous les abonnements, actifs. Réservé à l'administrateur."""
        return self.abonnements.list()

    def lister_du_client_entreprise(self, client: Client) -> Sequence[Abonnement]:
        """Abonnements du client entreprise connecté, les plus récents d'abord."""
        return self.abonnements.par_client_entreprise(client.id_client)

    # --- Création ---------------------------------------------------------

    def creer(self, donnees: AbonnementCreate, client: Client) -> Abonnement:
        """Souscrit un abonnement pour le client entreprise connecté.

        `id_client_entreprise` est dérivé du jeton, jamais accepté depuis le
        corps — un client ne doit pas pouvoir souscrire au nom d'une autre
        entreprise. Refuse en 403 un client particulier : la cantine B2B n'a
        pas de sens pour un compte individuel.
        """
        if client.type_client != TypeClient.ENTREPRISE:
            raise AutorisationInsuffisante(MESSAGE_RESERVE_ENTREPRISE)

        abonnement = self.abonnements.create(
            {**donnees.model_dump(), "id_client_entreprise": client.id_client}
        )
        self.db.commit()
        return abonnement

    def creer_pour_entreprise(self, donnees: AbonnementCreateAdmin) -> Abonnement:
        """Souscrit un abonnement pour l'entreprise cliente désignée.

        Réservé à l'administrateur. `id_client_entreprise` vient du corps —
        c'est justement ce qui distingue ce chemin du précédent — et doit
        désigner une entreprise cliente active, sous peine de 422 : la
        référence vient du corps, pas de l'URL (cf. `docs/architecture.md`,
        codes d'erreur 404 contre 422).
        """
        if self.clients_entreprise.get_by_id(donnees.id_client_entreprise) is None:
            raise ReferenceInvalide("L'entreprise cliente désignée n'existe pas.")

        abonnement = self.abonnements.create(donnees.model_dump())
        self.db.commit()
        return abonnement

    # --- Modification -------------------------------------------------------

    def modifier(self, id_abonnement: int, donnees: AbonnementUpdate) -> Abonnement:
        """Met à jour un abonnement, en revalidant la cohérence tarif/facturation.

        Réservé à l'administrateur : `id_client_entreprise` n'est de toute
        façon jamais réassignable, la charge utile ne le porte pas.
        """
        abonnement = self.obtenir(id_abonnement)
        modifications = donnees.model_dump(exclude_unset=True)

        self._verifier_coherence_tarif(abonnement, modifications)
        self._verifier_coherence_dates(abonnement, modifications)

        self.abonnements.update(abonnement, modifications)
        self.db.commit()
        return abonnement

    def _verifier_coherence_tarif(
        self, abonnement: Abonnement, modifications: dict
    ) -> None:
        """Refuse en 422 une combinaison type/tarif incohérente après fusion.

        Vit ici et non dans `AbonnementUpdate` : la règle croise la charge
        utile et l'état courant — passer de `Consommation_reelle` à `Forfait`
        est légitime si l'abonnement porte déjà un `tarif_forfait`. Même
        raisonnement que `ProduitService._verifier_coherence_personnalisation`.
        """
        type_facturation = modifications.get(
            "type_facturation", abonnement.type_facturation
        )
        tarif_forfait = modifications.get("tarif_forfait", abonnement.tarif_forfait)
        tarif_unitaire = modifications.get(
            "tarif_unitaire_repas", abonnement.tarif_unitaire_repas
        )

        if type_facturation == TypeFacturation.FORFAIT and tarif_forfait is None:
            raise ReferenceInvalide(
                "Un abonnement facturé au forfait doit porter un tarif_forfait."
            )
        if (
            type_facturation == TypeFacturation.CONSOMMATION_REELLE
            and tarif_unitaire is None
        ):
            raise ReferenceInvalide(
                "Un abonnement facturé à la consommation réelle doit porter "
                "un tarif_unitaire_repas."
            )

    def _verifier_coherence_dates(
        self, abonnement: Abonnement, modifications: dict
    ) -> None:
        """Refuse en 422 une fin antérieure ou égale au début, après fusion."""
        date_debut = modifications.get("date_debut", abonnement.date_debut)
        date_fin = modifications.get("date_fin", abonnement.date_fin)
        if date_fin <= date_debut:
            raise ReferenceInvalide(
                "La date de fin doit être postérieure à la date de début."
            )

    # --- Suppression ----------------------------------------------------------

    def supprimer(self, id_abonnement: int) -> Abonnement:
        """Archive un abonnement.

        **Pas encore de contrôle des bénéficiaires/consommations actifs** :
        `BeneficiaireRepository` et `ConsommationRepasRepository` n'existent
        pas à ce stade du sprint (7.1.2 et 7.1.3). Tant qu'ils ne sont pas
        livrés, archiver un abonnement encore couvert ne les archive pas et ne
        le refuse pas non plus — à corriger dès 7.1.2, sur le modèle de la
        règle transverse de `docs/roadmap.md` (refuser puis propager).
        """
        abonnement = self.obtenir(id_abonnement)
        self.abonnements.delete(abonnement)
        self.db.commit()
        return abonnement
