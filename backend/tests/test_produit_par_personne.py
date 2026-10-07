"""Produits vendus à la personne : minimum, prix, stock en produits entiers.

Décision du 7 octobre 2026 : le client choisit le nombre de personnes
(`LIGNE_COMMANDE.quantite`), le prix est par personne, et le stock compte des
produits entiers — une ligne en consomme **un**. PostgreSQL réel.
"""

from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, ReferenceInvalide
from app.core.security import hacher_mot_de_passe
from app.models.categorie_produit import CategorieProduit
from app.models.client import Client, TypeClient
from app.models.commande import TypeCommande
from app.models.produit import Produit
from app.schemas.commande import CommandeCreate
from app.schemas.demande_personnalisation import DemandePersonnalisationCreate
from app.schemas.ligne_commande import LigneCommandeCreate
from app.schemas.produit import ProduitCreate, ProduitUpdate
from app.services.commande_service import CommandeService
from app.services.produit_service import ProduitService


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def categorie(db: Session) -> CategorieProduit:
    objet = CategorieProduit(libelle=f"Gâteaux {uuid4().hex[:8]}")
    db.add(objet)
    db.commit()
    return objet


@pytest.fixture
def gateau(db: Session, categorie: CategorieProduit) -> Produit:
    objet = Produit(
        nom="Gâteau d'anniversaire",
        prix_unitaire=Decimal("5000.00"),
        unite_mesure="personne",
        stock_disponible=3,
        est_personnalisable=True,
        supplement_personnalisation=Decimal("500.00"),
        vendu_par_personne=True,
        personnes_min=4,
        id_categorie=categorie.id_categorie,
    )
    db.add(objet)
    db.commit()
    return objet


@pytest.fixture
def client(db: Session) -> Client:
    compte = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"pers_{uuid4().hex[:8]}@exemple.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(compte)
    db.commit()
    return compte


def _commander(db: Session, client: Client, produit: Produit, personnes: int, **ligne):
    return CommandeService(db).creer(
        CommandeCreate(
            type_commande=TypeCommande.A_EMPORTER,
            lignes=[
                LigneCommandeCreate(
                    id_produit=produit.id_produit, quantite=personnes, **ligne
                )
            ],
        ),
        client,
    )


# --- Commande -----------------------------------------------------------------


def test_le_prix_est_compte_par_personne_et_le_stock_par_gateau(
    db: Session, client: Client, gateau: Produit
) -> None:
    commande = _commander(db, client, gateau, 8)

    assert commande.montant_total == Decimal("40000.00")
    assert commande.lignes[0].quantite == 8
    db.refresh(gateau)
    assert gateau.stock_disponible == 2, "un gâteau de 8 personnes, pas 8 gâteaux"


def test_sous_le_minimum_la_commande_est_refusee(
    db: Session, client: Client, gateau: Produit
) -> None:
    with pytest.raises(ReferenceInvalide, match="4 personnes au minimum"):
        _commander(db, client, gateau, 3)


def test_le_minimum_lui_meme_est_accepte(
    db: Session, client: Client, gateau: Produit
) -> None:
    assert _commander(db, client, gateau, 4).montant_total == Decimal("20000.00")


def test_plus_de_gateau_en_stock_refuse_quel_que_soit_le_nombre_de_personnes(
    db: Session, client: Client, gateau: Produit
) -> None:
    gateau.stock_disponible = 0
    db.commit()

    with pytest.raises(ConflitMetier, match="Stock insuffisant"):
        _commander(db, client, gateau, 4)


def test_beaucoup_de_personnes_ne_vident_pas_le_stock(
    db: Session, client: Client, gateau: Produit
) -> None:
    """30 personnes avec 3 gâteaux en stock : accepté, il en reste 2."""
    _commander(db, client, gateau, 30)

    db.refresh(gateau)
    assert gateau.stock_disponible == 2


def test_le_supplement_de_personnalisation_compte_par_personne(
    db: Session, client: Client, gateau: Produit
) -> None:
    commande = _commander(
        db,
        client,
        gateau,
        6,
        personnalisation=DemandePersonnalisationCreate(
            description_demande="Message à écrire : Bonne fête"
        ),
    )

    # 6 × 5 000 + 6 × 500.
    assert commande.montant_total == Decimal("33000.00")


def test_un_produit_a_l_unite_garde_son_comportement(
    db: Session, client: Client, categorie: CategorieProduit
) -> None:
    eclair = Produit(
        nom="Éclair",
        prix_unitaire=Decimal("3.50"),
        unite_mesure="pièce",
        stock_disponible=10,
        id_categorie=categorie.id_categorie,
    )
    db.add(eclair)
    db.commit()

    _commander(db, client, eclair, 3)

    db.refresh(eclair)
    assert eclair.stock_disponible == 7


# --- Cohérence du produit -----------------------------------------------------


def test_creer_un_produit_vendu_a_la_personne_exige_un_minimum(
    categorie: CategorieProduit,
) -> None:
    with pytest.raises(ValidationError, match="personnes_min"):
        ProduitCreate(
            nom="Gâteau",
            prix_unitaire=Decimal("5000.00"),
            unite_mesure="personne",
            vendu_par_personne=True,
            id_categorie=categorie.id_categorie,
        )


def test_activer_la_vente_a_la_personne_sans_minimum_est_refuse(
    db: Session, categorie: CategorieProduit
) -> None:
    service = ProduitService(db)
    produit = service.creer(
        ProduitCreate(
            nom="Tarte",
            prix_unitaire=Decimal("4000.00"),
            unite_mesure="pièce",
            id_categorie=categorie.id_categorie,
        )
    )

    with pytest.raises(ReferenceInvalide, match="personnes_min"):
        service.modifier(produit.id_produit, ProduitUpdate(vendu_par_personne=True))

    modifie = service.modifier(
        produit.id_produit, ProduitUpdate(vendu_par_personne=True, personnes_min=6)
    )
    assert modifie.vendu_par_personne and modifie.personnes_min == 6


def test_la_base_refuse_un_produit_vendu_a_la_personne_sans_minimum(
    db: Session, gateau: Produit
) -> None:
    gateau.personnes_min = None
    with pytest.raises(IntegrityError, match="vendu_par_personne_a_un_minimum"):
        db.flush()
