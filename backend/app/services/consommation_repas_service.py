"""Service métier de CONSOMMATION_REPAS.

Cohérence `#id_beneficiaire` / `mode_suivi` : si l'abonnement est en mode
`Individuel`, chaque consommation doit nommer un bénéficiaire ; en mode
`Global`, aucun. Cette règle croise deux tables — aucun `CHECK` ne peut la
comparer, et un trigger PL/pgSQL serait hors de sa couche. Ce service est
donc le **seul** point d'application, même raisonnement que le contrôle de
capacité SALLE en #47 (cf. `docs/mld.md`).
"""

from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.core.exceptions import ReferenceInvalide, RessourceIntrouvable
from app.models.abonnement import Abonnement, ModeSuivi, TypeFacturation
from app.models.client import Client
from app.models.consommation_repas import ConsommationRepas
from app.repositories.abonnement_repository import AbonnementRepository
from app.repositories.beneficiaire_repository import BeneficiaireRepository
from app.repositories.consommation_repas_repository import (
    ConsommationRepasRepository,
)
from app.schemas.consommation_repas import (
    ConsommationRepasCreate,
    ConsommationRepasUpdate,
    SoldeAbonnement,
)

MESSAGE_BENEFICIAIRE_REQUIS = (
    "Un abonnement en mode de suivi Individuel exige un bénéficiaire pour "
    "chaque consommation."
)
MESSAGE_BENEFICIAIRE_INTERDIT = (
    "Un abonnement en mode de suivi Global n'accepte aucun bénéficiaire " "nominatif."
)
MESSAGE_BENEFICIAIRE_HORS_ABONNEMENT = (
    "Ce bénéficiaire n'est pas couvert par l'abonnement désigné."
)


class ConsommationRepasService:
    """Enregistrement des repas consommés au titre d'un abonnement."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.consommations = ConsommationRepasRepository(db)
        self.abonnements = AbonnementRepository(db)
        self.beneficiaires = BeneficiaireRepository(db)

    # --- Lecture --------------------------------------------------------------

    def obtenir(self, id_consommation: int) -> ConsommationRepas:
        """Retourne une consommation, ou lève `RessourceIntrouvable` (404).

        Réservé à l'administrateur : aucun contrôle de propriété ici.
        """
        consommation = self.consommations.get_by_id(id_consommation)
        if consommation is None:
            raise RessourceIntrouvable("Consommation introuvable.")
        return consommation

    def obtenir_du_client_entreprise(
        self, id_consommation: int, client: Client
    ) -> ConsommationRepas:
        """Retourne une consommation d'un abonnement du client connecté, ou 404."""
        consommation = self.obtenir(id_consommation)
        if consommation.abonnement.id_client_entreprise != client.id_client:
            raise RessourceIntrouvable("Consommation introuvable.")
        return consommation

    def lister(self) -> Sequence[ConsommationRepas]:
        """Toutes les consommations actives. Réservé à l'administrateur."""
        return self.consommations.list()

    def lister_du_client_entreprise(
        self, client: Client
    ) -> Sequence[ConsommationRepas]:
        """Consommations de tous les abonnements du client entreprise connecté."""
        abonnements = self.abonnements.par_client_entreprise(client.id_client)
        resultat: list[ConsommationRepas] = []
        for abonnement in abonnements:
            resultat.extend(self.consommations.par_abonnement(abonnement.id_abonnement))
        resultat.sort(key=lambda c: c.date_consommation, reverse=True)
        return resultat

    # --- Enregistrement ---------------------------------------------------

    def enregistrer(self, donnees: ConsommationRepasCreate) -> ConsommationRepas:
        """Enregistre une consommation. Opérationnel : ouvert à tout personnel.

        **422** si `id_abonnement` ne désigne aucun abonnement, si
        `id_beneficiaire` est incohérent avec `mode_suivi`, ou si le
        bénéficiaire désigné n'appartient pas à l'abonnement visé — les trois
        références viennent du corps, pas de l'URL (cf.
        `docs/architecture.md`, 404 contre 422).
        """
        abonnement = self.abonnements.get_by_id(donnees.id_abonnement)
        if abonnement is None:
            raise ReferenceInvalide("L'abonnement désigné n'existe pas.")

        if abonnement.mode_suivi == ModeSuivi.INDIVIDUEL:
            if donnees.id_beneficiaire is None:
                raise ReferenceInvalide(MESSAGE_BENEFICIAIRE_REQUIS)
            beneficiaire = self.beneficiaires.get_by_id(donnees.id_beneficiaire)
            if (
                beneficiaire is None
                or beneficiaire.id_abonnement != abonnement.id_abonnement
            ):
                raise ReferenceInvalide(MESSAGE_BENEFICIAIRE_HORS_ABONNEMENT)
        elif donnees.id_beneficiaire is not None:
            raise ReferenceInvalide(MESSAGE_BENEFICIAIRE_INTERDIT)

        consommation = self.consommations.create(donnees.model_dump())
        self.db.commit()
        return consommation

    # --- Modification et suppression --------------------------------------

    def modifier(
        self, id_consommation: int, donnees: ConsommationRepasUpdate
    ) -> ConsommationRepas:
        """Corrige la date ou la quantité d'une consommation. Réservé à
        l'administrateur. `id_abonnement` et `id_beneficiaire` ne sont jamais
        réassignables, la charge utile ne les porte pas."""
        consommation = self.obtenir(id_consommation)
        modifications = donnees.model_dump(exclude_unset=True)
        self.consommations.update(consommation, modifications)
        self.db.commit()
        return consommation

    def supprimer(self, id_consommation: int) -> ConsommationRepas:
        """Archive une consommation. Réservé à l'administrateur."""
        consommation = self.obtenir(id_consommation)
        self.consommations.delete(consommation)
        self.db.commit()
        return consommation

    # --- Solde --------------------------------------------------------------

    def calculer_solde(self, id_abonnement: int) -> SoldeAbonnement:
        """Calcule le solde d'un abonnement, à la demande.

        Aucune entité `FACTURE` : le montant dû n'est jamais stocké, il se
        recalcule à chaque appel à partir de `ABONNEMENT` et de la somme des
        `CONSOMMATION_REPAS` actives (cf. `docs/roadmap.md`, décision 7.2).

        **404** si l'abonnement n'existe pas — appelée par l'administrateur
        sans autre contrôle de propriété, comme `AbonnementService.obtenir`.
        """
        abonnement = self.abonnements.get_by_id(id_abonnement)
        if abonnement is None:
            raise RessourceIntrouvable("Abonnement introuvable.")
        return self._solde(abonnement)

    def calculer_solde_du_client_entreprise(
        self, id_abonnement: int, client: Client
    ) -> SoldeAbonnement:
        """Calcule le solde d'un abonnement du client entreprise connecté.

        **404 et non 403** sur l'abonnement d'une autre entreprise : même
        raisonnement que `AbonnementService.obtenir_du_client_entreprise`.
        """
        abonnement = self.abonnements.get_by_id(id_abonnement)
        if abonnement is None or abonnement.id_client_entreprise != client.id_client:
            raise RessourceIntrouvable("Abonnement introuvable.")
        return self._solde(abonnement)

    def _solde(self, abonnement: Abonnement) -> SoldeAbonnement:
        """Calcule les champs du solde selon `type_facturation`.

        **Forfait** : le montant facturé est le tarif fixe, indépendant de la
        consommation — c'est la définition même d'un forfait. `repas_restants`
        peut être négatif si le forfait est dépassé : ce n'est pas plafonné à
        zéro, un dépassement doit rester visible.

        **Consommation_reelle** : pas de quota, donc pas de `repas_restants` —
        `None` et non `0`, pour ne pas laisser croire à un quota épuisé qui
        n'existe pas dans ce mode. Le montant facturé est le tarif unitaire
        multiplié par la quantité consommée.
        """
        repas_consommes = self.consommations.total_quantite(abonnement.id_abonnement)

        if abonnement.type_facturation == TypeFacturation.FORFAIT:
            repas_inclus = abonnement.nombre_repas_inclus
            repas_restants = (
                repas_inclus - repas_consommes if repas_inclus is not None else None
            )
            montant_facture = abonnement.tarif_forfait
        else:
            repas_inclus = None
            repas_restants = None
            montant_facture = abonnement.tarif_unitaire_repas * repas_consommes

        return SoldeAbonnement(
            id_abonnement=abonnement.id_abonnement,
            type_facturation=abonnement.type_facturation,
            repas_consommes=repas_consommes,
            repas_inclus=repas_inclus,
            repas_restants=repas_restants,
            montant_facture=montant_facture,
        )
