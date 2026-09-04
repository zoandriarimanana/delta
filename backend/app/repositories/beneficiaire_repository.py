"""Repository de l'entité BENEFICIAIRE."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.abonnement import Abonnement
from app.models.beneficiaire import Beneficiaire, StatutBeneficiaire
from app.repositories.base_repository import BaseRepository


class BeneficiaireRepository(BaseRepository[Beneficiaire]):
    """CRUD générique, plus les recherches par abonnement et par entreprise."""

    modele = Beneficiaire

    def par_abonnement(
        self, id_abonnement: int, inclure_supprimes: bool = False
    ) -> Sequence[Beneficiaire]:
        """Bénéficiaires d'un abonnement donné, triés par nom."""
        requete = select(Beneficiaire).where(
            Beneficiaire.id_abonnement == id_abonnement
        )
        if not inclure_supprimes:
            requete = requete.where(Beneficiaire.supprime_le.is_(None))
        requete = requete.order_by(Beneficiaire.nom, Beneficiaire.prenom)
        return self.db.scalars(requete).all()

    def existe_actif_pour_abonnement(self, id_abonnement: int) -> bool:
        """Indique si l'abonnement couvre au moins un bénéficiaire `Actif`.

        Un bénéficiaire `Inactif` ou `Suspendu` n'empêche pas de clore
        l'abonnement — seul un bénéficiaire réellement couvert le doit.
        Un bénéficiaire archivé n'est de toute façon plus couvert, quel
        qu'ait été son dernier statut : le filtre sur `supprime_le` reste
        appliqué même si le statut valait `Actif` avant l'archivage.
        """
        requete = (
            select(Beneficiaire.id_beneficiaire)
            .where(
                Beneficiaire.id_abonnement == id_abonnement,
                Beneficiaire.supprime_le.is_(None),
                Beneficiaire.statut == StatutBeneficiaire.ACTIF,
            )
            .limit(1)
        )
        return self.db.scalars(requete).first() is not None

    def par_client_entreprise(
        self, id_client_entreprise: int, inclure_supprimes: bool = False
    ) -> Sequence[Beneficiaire]:
        """Bénéficiaires de tous les abonnements d'une entreprise cliente.

        Jointure vers `ABONNEMENT` : `BENEFICIAIRE` ne connaît pas
        directement l'entreprise, seulement l'abonnement qui la porte. Reste
        une méthode de lecture pure, pas une décision métier — c'est le
        service qui vérifie la propriété.
        """
        requete = (
            select(Beneficiaire)
            .join(Abonnement, Beneficiaire.id_abonnement == Abonnement.id_abonnement)
            .where(Abonnement.id_client_entreprise == id_client_entreprise)
        )
        if not inclure_supprimes:
            requete = requete.where(Beneficiaire.supprime_le.is_(None))
        requete = requete.order_by(Beneficiaire.nom, Beneficiaire.prenom)
        return self.db.scalars(requete).all()
