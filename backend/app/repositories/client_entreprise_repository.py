"""Repository de l'entité CLIENT_ENTREPRISE."""

from sqlalchemy import select

from app.models.client_entreprise import ClientEntreprise
from app.repositories.base_repository import BaseRepository


class ClientEntrepriseRepository(BaseRepository[ClientEntreprise]):
    """CRUD générique, plus la recherche par numéro d'identification fiscale."""

    modele = ClientEntreprise

    def get_by_numero_id_fiscal(
        self, numero_id_fiscal: str, inclure_supprimes: bool = False
    ) -> ClientEntreprise | None:
        """Retourne l'entreprise **active** portant ce numéro fiscal, ou None.

        Le filtre sur `supprime_le` est de même nature que celui de
        `ClientRepository.get_by_email`, et pour la même raison :
        `uq_client_entreprise_numero_id_fiscal` est un index *partiel*, donc
        plusieurs lignes peuvent partager un numéro — une active et autant
        d'archivées qu'on veut. Sans lui, `one_or_none()` lèverait
        `MultipleResultsFound` dès la première réinscription d'une société dont
        le compte a été archivé.

        C'est aussi ce filtre qui rend la réinscription possible : un numéro
        fiscal désigne une personne morale de façon permanente, une société
        archivée doit pouvoir revenir avec le sien.
        """
        requete = select(ClientEntreprise).where(
            ClientEntreprise.numero_id_fiscal == numero_id_fiscal
        )
        if not inclure_supprimes:
            requete = requete.where(ClientEntreprise.supprime_le.is_(None))
            return self.db.scalars(requete).one_or_none()
        return self.db.scalars(requete).first()
