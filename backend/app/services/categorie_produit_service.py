"""Service métier de CATEGORIE_PRODUIT."""

from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, RessourceIntrouvable
from app.core.integrite import viole_contrainte
from app.models.categorie_produit import CategorieProduit
from app.repositories.categorie_produit_repository import CategorieProduitRepository
from app.repositories.produit_repository import ProduitRepository
from app.schemas.categorie_produit import (
    CategorieProduitCreate,
    CategorieProduitUpdate,
)

CONTRAINTE_LIBELLE_UNIQUE = "uq_categorie_produit_libelle"
CONTRAINTE_PRODUIT_CATEGORIE = "fk_produit_id_categorie_categorie_produit"

# Fragments par lesquels SQLite designe ces contraintes, faute de les nommer.
INDICE_LIBELLE = "categorie_produit.libelle"


class CategorieProduitService:
    """Règles de gestion des catégories de produit."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.categories = CategorieProduitRepository(db)
        self.produits = ProduitRepository(db)

    def lister(self) -> Sequence[CategorieProduit]:
        """Retourne toutes les catégories du catalogue."""
        return self.categories.list()

    def obtenir(self, id_categorie: int) -> CategorieProduit:
        """Retourne une catégorie, ou lève `RessourceIntrouvable` (404)."""
        categorie = self.categories.get_by_id(id_categorie)
        if categorie is None:
            raise RessourceIntrouvable("Catégorie introuvable.")
        return categorie

    def creer(self, donnees: CategorieProduitCreate) -> CategorieProduit:
        """Crée une catégorie dont le libellé n'est pas déjà pris.

        Double protection, comme pour l'e-mail en T0.6 : le pré-contrôle produit
        un message clair dans le cas courant, l'interception de
        l'`IntegrityError` couvre la course entre deux créations simultanées.
        Seule la contrainte en base tranche réellement.
        """
        if self.categories.get_by_libelle(donnees.libelle) is not None:
            raise ConflitMetier("Une catégorie porte déjà ce libellé.")
        try:
            categorie = self.categories.create(donnees.model_dump())
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_LIBELLE_UNIQUE, INDICE_LIBELLE):
                raise ConflitMetier("Une catégorie porte déjà ce libellé.") from erreur
            raise
        return categorie

    def modifier(
        self, id_categorie: int, donnees: CategorieProduitUpdate
    ) -> CategorieProduit:
        """Met à jour une catégorie. `exclude_unset` garde la mise à jour partielle."""
        categorie = self.obtenir(id_categorie)
        try:
            self.categories.update(categorie, donnees.model_dump(exclude_unset=True))
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_LIBELLE_UNIQUE, INDICE_LIBELLE):
                raise ConflitMetier("Une catégorie porte déjà ce libellé.") from erreur
            raise
        return categorie

    def supprimer(self, id_categorie: int) -> None:
        """Supprime une catégorie, sauf si des produits la référencent.

        `produit.id_categorie` est en `ON DELETE RESTRICT` : PostgreSQL refuse
        la suppression. Le service traduit ce refus en message métier plutôt que
        de laisser remonter une trace SQL (règle transverse de
        `docs/roadmap.md`).
        """
        categorie = self.obtenir(id_categorie)
        if self.produits.rechercher_par_categorie(id_categorie, limit=1):
            raise ConflitMetier("Cette catégorie contient encore des produits.")
        try:
            self.categories.delete(categorie)
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_PRODUIT_CATEGORIE):
                raise ConflitMetier(
                    "Cette catégorie contient encore des produits."
                ) from erreur
            raise

    def restaurer(self, id_categorie: int) -> CategorieProduit:
        """Réactive une catégorie archivée.

        Idempotente : sans effet si la catégorie est déjà active.

        **Peut échouer légitimement**, et c'est ce qui la distingue de
        `ProduitService.restaurer`. `uq_categorie_produit_libelle` est un index
        **partiel** (`WHERE supprime_le IS NULL`) : c'est précisément ce qui
        permet de recréer une catégorie portant le libellé d'une archivée. Le
        libellé a donc pu être réattribué entre-temps, et restaurer créerait deux
        catégories actives homonymes — la base le refuse.

        Ce refus est traduit en message métier, jamais en trace SQL : c'est le
        cas que `docs/architecture.md` annonce sous « `restaurer()` peut échouer
        légitimement ».

        L'`IntegrityError` est le **seul** arbitre possible : vérifier le
        libellé avant l'écriture laisserait passer deux restaurations
        simultanées, comme pour toute unicité.
        """
        categorie = self.categories.get_by_id(id_categorie, inclure_supprimes=True)
        if categorie is None:
            raise RessourceIntrouvable("Catégorie introuvable.")
        if categorie.supprime_le is None:
            return categorie

        try:
            self.categories.restaurer(categorie)
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_LIBELLE_UNIQUE, INDICE_LIBELLE):
                raise ConflitMetier(
                    "Une catégorie active porte déjà ce libellé, "
                    "restauration impossible."
                ) from erreur
            raise
        return categorie

    def lister_pour_administration(self) -> Sequence[CategorieProduit]:
        """Retourne **toutes** les catégories, actives et archivées.

        Même raison que `ProduitService.lister_pour_administration` : rendre
        les archives visibles, donc restaurables.
        """
        return self.categories.list(inclure_supprimes=True)
