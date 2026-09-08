"""Service métier de BENEFICIAIRE.

Un bénéficiaire est toujours créé au titre d'un abonnement désigné dans la
charge utile — `id_abonnement` n'est l'identité de personne, c'est une
référence à vérifier, comme `COMMANDE.#id_reservation`. Ce qui distingue le
chemin client du chemin administrateur est la vérification de propriété
faite ici, pas la forme de la requête.
"""

from collections.abc import Sequence
from datetime import date

from sqlalchemy.orm import Session

from app.core.exceptions import ReferenceInvalide, RessourceIntrouvable
from app.models.abonnement import Abonnement
from app.models.beneficiaire import Beneficiaire
from app.models.client import Client
from app.repositories.abonnement_repository import AbonnementRepository
from app.repositories.beneficiaire_repository import BeneficiaireRepository
from app.schemas.beneficiaire import BeneficiaireCreate, BeneficiaireUpdate

MESSAGE_ABONNEMENT_EXPIRE = (
    "Cet abonnement est arrivé à échéance : aucun bénéficiaire ne peut y être ajouté."
)


class BeneficiaireService:
    """Cycle de vie d'un bénéficiaire couvert par un abonnement cantine."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.beneficiaires = BeneficiaireRepository(db)
        self.abonnements = AbonnementRepository(db)

    # --- Lecture --------------------------------------------------------------

    def obtenir(self, id_beneficiaire: int) -> Beneficiaire:
        """Retourne un bénéficiaire, ou lève `RessourceIntrouvable` (404).

        Réservé à l'administrateur : aucun contrôle de propriété ici.
        """
        beneficiaire = self.beneficiaires.get_by_id(id_beneficiaire)
        if beneficiaire is None:
            raise RessourceIntrouvable("Bénéficiaire introuvable.")
        return beneficiaire

    def obtenir_du_client_entreprise(
        self, id_beneficiaire: int, client: Client
    ) -> Beneficiaire:
        """Retourne un bénéficiaire d'un abonnement du client connecté, ou 404.

        **404 et non 403** sur le bénéficiaire d'une autre entreprise :
        confirmer son existence renseignerait déjà. Même règle que
        `AbonnementService.obtenir_du_client_entreprise`.
        """
        beneficiaire = self.obtenir(id_beneficiaire)
        if beneficiaire.abonnement.id_client_entreprise != client.id_client:
            raise RessourceIntrouvable("Bénéficiaire introuvable.")
        return beneficiaire

    def lister(self, id_abonnement: int | None = None) -> Sequence[Beneficiaire]:
        """Bénéficiaires actifs, filtrés par abonnement si fourni. Réservé à
        l'administrateur.

        `id_abonnement` optionnel : sans lui, comportement inchangé (liste
        complète). Avec lui, délègue à `par_abonnement()` — déjà écrite en
        7.1.2 pour le repository, jamais câblée jusqu'ici à un endpoint
        atteignable par l'administrateur. Sans ce filtre, une fiche
        abonnement devrait télécharger tous les bénéficiaires de toutes les
        entreprises pour n'en garder qu'une poignée.
        """
        if id_abonnement is not None:
            return self.beneficiaires.par_abonnement(id_abonnement)
        return self.beneficiaires.list()

    def lister_du_client_entreprise(self, client: Client) -> Sequence[Beneficiaire]:
        """Bénéficiaires de tous les abonnements du client entreprise connecté."""
        return self.beneficiaires.par_client_entreprise(client.id_client)

    # --- Création ---------------------------------------------------------

    def creer(self, donnees: BeneficiaireCreate, client: Client) -> Beneficiaire:
        """Ajoute un bénéficiaire à un abonnement du client entreprise connecté.

        **404** si l'abonnement désigné n'appartient pas au client connecté,
        ou n'existe pas, ou est archivé — `get_by_id` filtre déjà les lignes
        archivées, qui redeviennent donc indiscernables d'une absence, même
        raisonnement que `obtenir_du_client_entreprise`. **422** si
        l'abonnement est arrivé à échéance : contrairement à l'archivage, ce
        n'est pas un fait qui rend l'abonnement invisible, juste inapte à
        recevoir un nouveau bénéficiaire.
        """
        abonnement = self._abonnement_du_client(donnees.id_abonnement, client)
        self._verifier_abonnement_ouvert(abonnement)
        return self._creer(donnees)

    def creer_administration(self, donnees: BeneficiaireCreate) -> Beneficiaire:
        """Ajoute un bénéficiaire à l'abonnement désigné. Réservé à l'administrateur.

        **422** si `id_abonnement` ne désigne aucun abonnement — actif ou
        archivé, `get_by_id` ne les distingue pas ici — ou si l'abonnement est
        arrivé à échéance : la référence vient du corps, pas de l'URL (cf.
        `docs/architecture.md`, 404 contre 422).
        """
        abonnement = self.abonnements.get_by_id(donnees.id_abonnement)
        if abonnement is None:
            raise ReferenceInvalide("L'abonnement désigné n'existe pas.")
        self._verifier_abonnement_ouvert(abonnement)
        return self._creer(donnees)

    def _abonnement_du_client(self, id_abonnement: int, client: Client) -> Abonnement:
        abonnement = self.abonnements.get_by_id(id_abonnement)
        if abonnement is None or abonnement.id_client_entreprise != client.id_client:
            raise RessourceIntrouvable("Abonnement introuvable.")
        return abonnement

    def _verifier_abonnement_ouvert(self, abonnement: Abonnement) -> None:
        """Refuse en 422 un abonnement arrivé à échéance.

        L'archivage n'est **pas** revérifié ici : `get_by_id` (appelé par les
        deux méthodes de création avant celle-ci) filtre déjà les lignes
        archivées par défaut, la branche serait donc du code mort.
        """
        if abonnement.date_fin < date.today():
            raise ReferenceInvalide(MESSAGE_ABONNEMENT_EXPIRE)

    def _creer(self, donnees: BeneficiaireCreate) -> Beneficiaire:
        beneficiaire = self.beneficiaires.create(donnees.model_dump())
        self.db.commit()
        return beneficiaire

    # --- Modification -------------------------------------------------------

    def modifier(
        self, id_beneficiaire: int, donnees: BeneficiaireUpdate
    ) -> Beneficiaire:
        """Met à jour un bénéficiaire. Réservé à l'administrateur.

        `id_abonnement` n'est de toute façon jamais réassignable, la charge
        utile ne le porte pas.
        """
        beneficiaire = self.obtenir(id_beneficiaire)
        modifications = donnees.model_dump(exclude_unset=True)
        self.beneficiaires.update(beneficiaire, modifications)
        self.db.commit()
        return beneficiaire

    # --- Suppression ----------------------------------------------------------

    def supprimer(self, id_beneficiaire: int) -> Beneficiaire:
        """Archive un bénéficiaire.

        Les consommations passées restent imputées à l'abonnement :
        `CONSOMMATION_REPAS.#id_beneficiaire` n'est pas `ON DELETE RESTRICT`
        et l'archivage ne les touche pas (cf. `docs/mld.md`).
        """
        beneficiaire = self.obtenir(id_beneficiaire)
        self.beneficiaires.delete(beneficiaire)
        self.db.commit()
        return beneficiaire
