"""Service métier de PRODUIT."""

from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ReferenceInvalide, RessourceIntrouvable
from app.core.integrite import viole_contrainte
from app.models.produit import Produit
from app.repositories.categorie_produit_repository import CategorieProduitRepository
from app.repositories.produit_repository import ProduitRepository
from app.schemas.produit import ProduitCreate, ProduitUpdate

CONTRAINTE_PRODUIT_CATEGORIE = "fk_produit_id_categorie_categorie_produit"


class ProduitService:
    """Règles de gestion des produits du catalogue."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.produits = ProduitRepository(db)
        self.categories = CategorieProduitRepository(db)

    def lister(self, id_categorie: int | None = None) -> Sequence[Produit]:
        """Retourne les produits, filtrés par catégorie si demandé.

        Sans filtre, retourne tout le catalogue. Une catégorie inexistante donne
        une liste vide plutôt qu'une erreur : c'est un critère de recherche, pas
        une ressource désignée par l'URL.
        """
        if id_categorie is None:
            return self.produits.list()
        return self.produits.rechercher_par_categorie(id_categorie)

    def obtenir(self, id_produit: int) -> Produit:
        """Retourne un produit, ou lève `RessourceIntrouvable` (404)."""
        produit = self.produits.get_by_id(id_produit)
        if produit is None:
            raise RessourceIntrouvable("Produit introuvable.")
        return produit

    def _verifier_categorie(self, id_categorie: int) -> None:
        """Lève `ReferenceInvalide` (422) si la catégorie visée n'existe pas.

        422 et non 404 : l'URL est valide, c'est le corps de la requête qui
        l'est pas (cf. `docs/architecture.md`).
        """
        if self.categories.get_by_id(id_categorie) is None:
            raise ReferenceInvalide(
                f"Aucune catégorie ne porte l'identifiant {id_categorie}."
            )

    def creer(self, donnees: ProduitCreate) -> Produit:
        """Crée un produit rattaché à une catégorie existante.

        Même double protection qu'ailleurs : le pré-contrôle donne un message
        clair, l'interception de l'`IntegrityError` couvre la course où la
        catégorie disparaît entre la vérification et le `commit`.
        """
        self._verifier_categorie(donnees.id_categorie)
        try:
            produit = self.produits.create(donnees.model_dump())
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_PRODUIT_CATEGORIE):
                raise ReferenceInvalide(
                    f"Aucune catégorie ne porte l'identifiant {donnees.id_categorie}."
                ) from erreur
            raise
        return produit

    def modifier(self, id_produit: int, donnees: ProduitUpdate) -> Produit:
        """Met à jour un produit, en revalidant la catégorie si elle change."""
        produit = self.obtenir(id_produit)
        modifications = donnees.model_dump(exclude_unset=True)

        if "id_categorie" in modifications:
            self._verifier_categorie(modifications["id_categorie"])

        self._verifier_coherence_personnalisation(produit, modifications)

        try:
            self.produits.update(produit, modifications)
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_PRODUIT_CATEGORIE):
                raise ReferenceInvalide("La catégorie visée n'existe pas.") from erreur
            raise
        return produit

    def _verifier_coherence_personnalisation(
        self, produit: Produit, modifications: dict
    ) -> None:
        """Refuse en 422 un produit personnalisable laissé sans tarif.

        La vérification vit ici et non dans `ProduitUpdate` parce qu'elle croise
        la charge utile et l'**état courant** : rendre un produit
        personnalisable sans fournir de tarif est parfaitement légitime s'il en
        porte déjà un en base. Le schema, qui ne voit que les champs envoyés, ne
        peut pas en juger.

        Deux chemins mènent au trou, et un seul test les couvre tous les deux :
        activer `est_personnalisable` sans tarif, ou effacer le tarif d'un
        produit qui reste personnalisable.

        Le `CHECK` en base dit la même chose et reste la garantie réelle ; ceci
        produit un message lisible avant qu'il ne se déclenche.
        """
        personnalisable = modifications.get(
            "est_personnalisable", produit.est_personnalisable
        )
        supplement = modifications.get(
            "supplement_personnalisation", produit.supplement_personnalisation
        )

        if personnalisable and supplement is None:
            raise ReferenceInvalide(
                "Un produit personnalisable doit porter un "
                "supplement_personnalisation."
            )

    def supprimer(self, id_produit: int) -> None:
        """Supprime un produit du catalogue."""
        produit = self.obtenir(id_produit)
        self.produits.delete(produit)
        self.db.commit()
