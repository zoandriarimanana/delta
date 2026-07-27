"""Repository de l'entité CLIENT."""

from sqlalchemy import select

from app.models.client import Client
from app.repositories.base_repository import BaseRepository


class ClientRepository(BaseRepository[Client]):
    """CRUD générique de CLIENT, plus la recherche par e-mail.

    L'e-mail est l'identifiant de connexion (`UNIQUE` en base, cf.
    `docs/mld.md`) : cette recherche est donc le point d'entrée de tout le
    parcours d'authentification.
    """

    modele = Client

    def get_by_email(
        self, email: str, inclure_supprimes: bool = False
    ) -> Client | None:
        """Retourne le client **actif** portant cet e-mail, ou None.

        Le filtre sur `supprime_le` n'est pas cosmétique : `uq_client_email` est
        un index *partiel*, donc plusieurs lignes peuvent légitimement partager
        un e-mail — une active et autant d'archivées qu'on veut. Sans ce filtre,
        `one_or_none()` lèverait `MultipleResultsFound` dès la première
        réinscription après archivage.

        Avec le filtre, `one_or_none()` reste juste : l'index partiel garantit
        au plus une ligne active par e-mail.

        `inclure_supprimes=True` lève ce filtre — et peut alors remonter
        plusieurs lignes. Réservé aux parcours d'archive, qui doivent gérer ce
        cas eux-mêmes.
        """
        requete = select(Client).where(Client.email == email)
        if not inclure_supprimes:
            requete = requete.where(Client.supprime_le.is_(None))
            return self.db.scalars(requete).one_or_none()
        return self.db.scalars(requete).first()
