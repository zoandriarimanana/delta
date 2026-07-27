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
from datetime import UTC, datetime
from typing import Any, Generic, TypeVar

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.core.database import SoftDeleteMixin

# Borne sur le mixin autant que sur Base : toutes les entites du MLD portent
# `supprime_le`, et le CRUD generique s'appuie dessus.
ModeleType = TypeVar("ModeleType", bound=SoftDeleteMixin)


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

    def get_by_id(
        self, identifiant: Any, inclure_supprimes: bool = False
    ) -> ModeleType | None:
        """Retourne l'entité correspondant à la clé primaire, ou None.

        Les lignes archivées sont exclues par défaut : `get_by_id` sur une
        entité supprimée retourne None, exactement comme sur une entité qui
        n'a jamais existé. `inclure_supprimes=True` les fait remonter — c'est
        le chemin de la restauration et de la consultation d'archives.

        Le filtrage se fait après `Session.get` plutôt que par une clause SQL :
        on conserve ainsi l'identity map, qui sert l'objet sans requête quand la
        session le connaît déjà.
        """
        objet = self.db.get(self.modele, identifiant)
        if objet is None:
            return None
        if not inclure_supprimes and objet.supprime_le is not None:
            return None
        return objet

    def list(
        self,
        skip: int = 0,
        limit: int | None = None,
        inclure_supprimes: bool = False,
    ) -> Sequence[ModeleType]:
        """Retourne les entités actives, avec pagination optionnelle.

        Par défaut la collection complète est retournée : la pagination est un
        choix du service appelant, pas une valeur imposée ici. Les lignes
        archivées sont exclues sauf demande explicite.
        """
        requete = select(self.modele)
        if not inclure_supprimes:
            requete = requete.where(self.modele.supprime_le.is_(None))
        # Tri sur la cle primaire : sans ORDER BY, l'ordre des lignes n'est pas
        # defini par SQL, et `skip`/`limit` deviennent non deterministes — deux
        # pages successives peuvent omettre ou repeter des lignes selon le plan
        # choisi par le moteur.
        requete = requete.order_by(*inspect(self.modele).primary_key).offset(skip)
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

    def delete(self, objet: ModeleType) -> ModeleType:
        """Archive une entité : **soft delete**, aucun DELETE SQL n'est émis.

        La ligne reste en base, horodatée dans `supprime_le`, et disparaît des
        lectures par défaut. C'est le seul chemin de suppression que doivent
        emprunter les règles métier.

        Conséquence à connaître : un soft delete est un `UPDATE`, donc les
        `ON DELETE RESTRICT` et `ON DELETE CASCADE` du schéma **ne se
        déclenchent pas**. La base ne protège plus contre l'archivage d'un
        parent encore référencé, ni ne propage l'archivage à ses enfants : ces
        deux responsabilités passent aux services.
        """
        objet.supprime_le = datetime.now(UTC)
        self.db.flush()
        return objet

    def restaurer(self, objet: ModeleType) -> ModeleType:
        """Annule un archivage en remettant `supprime_le` à NULL.

        Peut échouer sur un index unique partiel : si la valeur archivée a été
        réattribuée entre-temps — même e-mail, même libellé — la restauration
        recréerait un doublon actif. L'`IntegrityError` remonte alors au
        service, à qui il revient de la traduire.
        """
        objet.supprime_le = None
        self.db.flush()
        return objet

    def supprimer_definitivement(self, objet: ModeleType) -> None:
        """Émet un vrai DELETE SQL. Irréversible.

        **Réservé à la conformité** (droit à l'effacement : RGPD, loi malgache
        n°2014-038) et aux entités sans valeur probante — le catalogue, pour
        l'essentiel. Ne jamais l'exposer sur un endpoint sans une protection
        explicite et tracée : c'est le seul chemin par lequel une donnée quitte
        réellement la base.

        Pour un `CLIENT`, ce n'est **pas** le bon outil : les FK en
        `ON DELETE RESTRICT` de `RESERVATION` et `AVIS` le refuseraient, et
        effacer une preuve de transaction serait de toute façon la mauvaise
        réponse. Voir `ClientService.anonymiser`.
        """
        self.db.delete(objet)
        self.db.flush()
