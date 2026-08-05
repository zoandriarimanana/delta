"""Tests du repository DEMANDE_PERSONNALISATION, contre PostgreSQL uniquement.

Ce repository n'ajoute qu'une méthode au CRUD générique, `get_by_ligne`. Elle
mérite ses tests parce que son filtrage diffère de celui des autres recherches
du projet : `UNIQUE (id_ligne)` est **globale** et non partielle, ce qui change
ce qui peut arriver.

Même contrainte que `test_commande_service.py` : la chaîne remonte à `COMMANDE`,
qui référence `RESERVATION`, dont le `CHECK` d'exclusivité utilise la syntaxe
PostgreSQL `(colonne IS NOT NULL)::int`. SQLite refuse la table et résout la clé
étrangère à l'insertion même lorsque la colonne est NULL. Contourner supposerait
de créer `RESERVATION` sans sa contrainte ou de désactiver les clés étrangères —
dans les deux cas, le test ne vérifierait plus le schéma de production.
"""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.categorie_produit import CategorieProduit
from app.models.commande import Commande, StatutCommande, TypeCommande
from app.models.ligne_commande import LigneCommande
from app.models.produit import Produit
from app.repositories.demande_personnalisation_repository import (
    DemandePersonnalisationRepository,
)

pytestmark = pytest.mark.postgres


@pytest.fixture
def db(session_postgres: Session) -> Session:
    """Alias local : tous les tests de ce module passent par PostgreSQL."""
    return session_postgres


@pytest.fixture
def depot(db: Session) -> DemandePersonnalisationRepository:
    return DemandePersonnalisationRepository(db)


@pytest.fixture
def ligne(db: Session) -> LigneCommande:
    categorie = CategorieProduit(libelle="Pâtisserie")
    db.add(categorie)
    db.flush()
    produit = Produit(
        nom="Gâteau",
        prix_unitaire=Decimal("25.00"),
        unite_mesure="piece",
        stock_disponible=10,
        est_personnalisable=True,
        id_categorie=categorie.id_categorie,
    )
    db.add(produit)
    db.flush()
    commande = Commande(
        type_commande=TypeCommande.EN_LIGNE,
        statut=StatutCommande.EN_ATTENTE,
        montant_total=Decimal("25.00"),
        nom_invite="Rakoto",
        contact_invite="+261340000000",
    )
    db.add(commande)
    db.flush()
    creee = LigneCommande(
        id_commande=commande.id_commande,
        id_produit=produit.id_produit,
        quantite=1,
        prix_unitaire_applique=Decimal("25.00"),
    )
    db.add(creee)
    db.commit()
    return creee


def _demande(depot: DemandePersonnalisationRepository, ligne: LigneCommande):
    creee = depot.create(
        {
            "id_ligne": ligne.id_ligne,
            "id_produit_base": ligne.id_produit,
            "description_demande": "Sans sucre",
            "supplement_prix": Decimal("0"),
        }
    )
    depot.db.commit()
    return creee


def test_get_by_ligne_trouve_une_demande_active(
    depot: DemandePersonnalisationRepository, ligne: LigneCommande
) -> None:
    _demande(depot, ligne)

    assert depot.get_by_ligne(ligne.id_ligne) is not None


def test_get_by_ligne_ignore_une_demande_archivee(
    depot: DemandePersonnalisationRepository, ligne: LigneCommande
) -> None:
    """Une demande archivée sous une ligne encore active ne doit pas remonter."""
    demande = _demande(depot, ligne)
    depot.delete(demande)
    depot.db.commit()

    assert depot.get_by_ligne(ligne.id_ligne) is None


def test_get_by_ligne_inclure_supprimes_remonte_l_archive(
    depot: DemandePersonnalisationRepository, ligne: LigneCommande
) -> None:
    demande = _demande(depot, ligne)
    depot.delete(demande)
    depot.db.commit()

    assert depot.get_by_ligne(ligne.id_ligne, inclure_supprimes=True) is not None


def test_get_by_ligne_sans_demande_retourne_none(
    depot: DemandePersonnalisationRepository, ligne: LigneCommande
) -> None:
    """La plupart des lignes n'en portent aucune : ce n'est pas une erreur."""
    assert depot.get_by_ligne(ligne.id_ligne) is None


def test_l_unicite_reste_globale_malgre_l_archivage(
    depot: DemandePersonnalisationRepository, ligne: LigneCommande, db: Session
) -> None:
    """La différence avec `uq_personnel_email`, qui est partiel.

    Ici l'unicité exprime une cardinalité (1,1), pas une identité métier :
    archiver une demande **ne libère pas** la place. Rendue partielle, la table
    pourrait porter cinq demandes archivées et une active pour la même ligne, et
    toute requête omettant le filtre produirait des totaux faux.
    """
    demande = _demande(depot, ligne)
    demande.supprime_le = datetime.now(UTC)
    db.commit()

    with pytest.raises(IntegrityError):
        _demande(depot, ligne)
    db.rollback()
