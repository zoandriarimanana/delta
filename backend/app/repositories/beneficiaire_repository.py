"""Repository de l'entité BENEFICIAIRE."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.abonnement import Abonnement
from app.models.beneficiaire import Beneficiaire
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
