"""Repository générique : tout le CRUD de base, une fois pour toutes.

Chaque entité du MLD a son repository dans `app/repositories/`, qui hérite de
`BaseRepository` et **n'ajoute que les méthodes dépassant le CRUD générique** :

    class SalleRepository(BaseRepository[Salle]):
        modele = Salle

        def verifier_disponibilite(self, debut: datetime, fin: datetime) -> ...:
            ...

Redéfinir `create` / `get_by_id` / `list` / `update` / `delete` dans un
repository spécifique est le signe que l'héritage n'est pas utilisé
correctement (cf. `docs/architecture.md`).
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import Base

ModeleType = TypeVar("ModeleType", bound=Base)


class BaseRepository(Generic[ModeleType]):
    """CRUD générique paramétré par un modèle SQLAlchemy.

    Aucune méthode ne valide la transaction (`commit`). Le repository se
    contente d'un `flush` quand il a besoin que la base attribue les valeurs
    générées (clé primaire, `server_default`). La frontière transactionnelle
    appartient à la couche `services/`, seule à connaître l'unité de travail
    métier : une commande et ses lignes, par exemple, se valident ensemble ou
    pas du tout.
    """

    #: Modèle SQLAlchemy piloté par ce repository. À définir dans chaque sous-classe.
    modele: type[ModeleType]

    def __init__(self, db: Session) -> None:
        """Mémorise la session à utiliser pour toutes les opérations.

        La session est celle de la requête HTTP en cours, injectée par
        `get_db` puis transmise par le service.
        """
        self.db = db

    def create(self, donnees: dict[str, Any]) -> ModeleType:
        """Crée une entité et la place dans la session, sans valider.

        Le `flush` déclenche l'INSERT : l'objet retourné porte donc déjà sa
        clé primaire, utilisable pour créer des entités liées dans la même
        transaction.
        """
        objet = self.modele(**donnees)
        self.db.add(objet)
        self.db.flush()
        return objet

    def get_by_id(self, identifiant: Any) -> ModeleType | None:
        """Retourne l'entité correspondant à la clé primaire, ou None.

        S'appuie sur `Session.get`, qui sert l'objet depuis l'identity map
        sans requête si la session le connaît déjà.
        """
        return self.db.get(self.modele, identifiant)

    def list(self, skip: int = 0, limit: int | None = None) -> Sequence[ModeleType]:
        """Retourne les entités, avec pagination optionnelle.

        Par défaut la collection complète est retournée : la pagination est un
        choix du service appelant, pas une valeur imposée ici.
        """
        requete = select(self.modele).offset(skip)
        if limit is not None:
            requete = requete.limit(limit)
        return self.db.scalars(requete).all()

    def update(self, objet: ModeleType, donnees: dict[str, Any]) -> ModeleType:
        """Applique une mise à jour partielle sur une entité déjà chargée.

        Seules les clés présentes dans `donnees` sont écrites : le service doit
        donc lui transmettre un dictionnaire déjà filtré (côté Pydantic,
        `model_dump(exclude_unset=True)`), sous peine d'écraser des colonnes
        avec des valeurs par défaut non voulues.
        """
        for attribut, valeur in donnees.items():
            setattr(objet, attribut, valeur)
        self.db.flush()
        return objet

    def delete(self, objet: ModeleType) -> None:
        """Marque une entité déjà chargée comme supprimée, sans valider."""
        self.db.delete(objet)
        self.db.flush()
