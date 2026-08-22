"""Service métier de DOMAINE_FORMATION."""

from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, RessourceIntrouvable
from app.core.integrite import viole_contrainte
from app.models.domaine_formation import DomaineFormation
from app.repositories.domaine_formation_repository import DomaineFormationRepository
from app.repositories.formation_repository import FormationRepository
from app.schemas.domaine_formation import (
    DomaineFormationCreate,
    DomaineFormationUpdate,
)

CONTRAINTE_LIBELLE_UNIQUE = "uq_domaine_formation_libelle"

# Fragment par lequel SQLite designe cette contrainte, faute de la nommer.
INDICE_LIBELLE = "domaine_formation.libelle"

MESSAGE_LIBELLE_PRIS = "Un domaine de formation porte déjà ce libellé."
MESSAGE_ENCORE_PEUPLE = "Ce domaine contient encore des formations."


class DomaineFormationService:
    """Règles de gestion des domaines de formation."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.domaines = DomaineFormationRepository(db)
        self.formations = FormationRepository(db)

    def lister(self) -> Sequence[DomaineFormation]:
        """Retourne tous les domaines actifs."""
        return self.domaines.list()

    def obtenir(self, id_domaine: int) -> DomaineFormation:
        """Retourne un domaine, ou lève `RessourceIntrouvable` (404)."""
        domaine = self.domaines.get_by_id(id_domaine)
        if domaine is None:
            raise RessourceIntrouvable("Domaine de formation introuvable.")
        return domaine

    def creer(self, donnees: DomaineFormationCreate) -> DomaineFormation:
        """Crée un domaine dont le libellé n'est pas déjà pris.

        Double protection, comme pour `CATEGORIE_PRODUIT` : le pré-contrôle
        produit un message clair dans le cas courant, l'interception de
        l'`IntegrityError` couvre la course entre deux créations simultanées.
        Seule la contrainte en base tranche réellement.
        """
        if self.domaines.get_by_libelle(donnees.libelle) is not None:
            raise ConflitMetier(MESSAGE_LIBELLE_PRIS)
        try:
            domaine = self.domaines.create(donnees.model_dump())
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_LIBELLE_UNIQUE, INDICE_LIBELLE):
                raise ConflitMetier(MESSAGE_LIBELLE_PRIS) from erreur
            raise
        return domaine

    def modifier(
        self, id_domaine: int, donnees: DomaineFormationUpdate
    ) -> DomaineFormation:
        """Met à jour un domaine. `exclude_unset` garde la mise à jour partielle."""
        domaine = self.obtenir(id_domaine)
        try:
            self.domaines.update(domaine, donnees.model_dump(exclude_unset=True))
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_LIBELLE_UNIQUE, INDICE_LIBELLE):
                raise ConflitMetier(MESSAGE_LIBELLE_PRIS) from erreur
            raise
        return domaine

    def supprimer(self, id_domaine: int) -> None:
        """Archive un domaine, sauf s'il porte encore des formations actives.

        **Le comptage filtre les archivées**, et ce n'est pas un détail : un
        `count()` sans filtre compterait des formations déjà archivées et
        refuserait à tort d'archiver un domaine vide (règle transverse de
        `docs/roadmap.md`).

        L'archivage étant un `UPDATE`, l'`ON DELETE RESTRICT` de la clé
        étrangère **ne se déclenche pas** : le refus est entièrement à la charge
        du service. L'interception de l'`IntegrityError` reste un filet de
        course pour `supprimer_definitivement`, où la base tranche encore.
        """
        domaine = self.obtenir(id_domaine)
        if self.formations.rechercher_par_domaine(id_domaine, limit=1):
            raise ConflitMetier(MESSAGE_ENCORE_PEUPLE)
        self.domaines.delete(domaine)
        self.db.commit()

    def restaurer(self, id_domaine: int) -> DomaineFormation:
        """Réactive un domaine archivé.

        Peut échouer légitimement : `uq_domaine_formation_libelle` étant un index
        *partiel*, le libellé a pu être réattribué entre-temps à un domaine
        actif. La restauration créerait alors deux domaines actifs de même
        libellé, et la base la refuse. Ce refus est traduit en message métier,
        jamais en trace SQL.
        """
        domaine = self.domaines.get_by_id(id_domaine, inclure_supprimes=True)
        if domaine is None:
            raise RessourceIntrouvable("Domaine de formation introuvable.")
        if domaine.supprime_le is None:
            return domaine

        try:
            self.domaines.restaurer(domaine)
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_LIBELLE_UNIQUE, INDICE_LIBELLE):
                raise ConflitMetier(
                    "Un domaine actif porte déjà ce libellé, restauration impossible."
                ) from erreur
            raise
        return domaine
