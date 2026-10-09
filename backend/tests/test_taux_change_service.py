"""Ouverture internationale : taux de change, commande en devise, paiement.

PostgreSQL réel (`session_postgres`) : les lignes EUR et USD de
`TAUX_CHANGE` sont celles que pose la migration. Chaque test fixe ses
propres taux, et la transaction est annulée à la fin.
"""

from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ReferenceInvalide
from app.core.security import hacher_mot_de_passe
from app.models.categorie_produit import CategorieProduit
from app.models.client import Client, TypeClient
from app.models.commande import Commande, TypeCommande
from app.models.paiement import FournisseurPaiement, MethodePaiement
from app.models.produit import Produit
from app.models.taux_change import Devise, TauxChange
from app.schemas.commande import CommandeCreate
from app.schemas.ligne_commande import LigneCommandeCreate
from app.schemas.paiement import PaiementCreate
from app.schemas.taux_change import TauxChangeUpdate
from app.services.commande_service import CommandeService
from app.services.paiement_service import PaiementService
from app.services.taux_change_service import TauxChangeService


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def taux(db: Session) -> TauxChangeService:
    service = TauxChangeService(db)
    service.modifier(Devise.EUR, TauxChangeUpdate(ariary_par_unite=Decimal("5000")))
    service.modifier(Devise.USD, TauxChangeUpdate(ariary_par_unite=Decimal("4500")))
    return service


@pytest.fixture
def client(db: Session) -> Client:
    compte = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"devise_{uuid4().hex[:8]}@exemple.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(compte)
    db.commit()
    return compte


@pytest.fixture
def gateau(db: Session) -> Produit:
    categorie = CategorieProduit(libelle=f"Gâteaux {uuid4().hex[:8]}")
    db.add(categorie)
    db.flush()
    produit = Produit(
        nom="Gâteau",
        prix_unitaire=Decimal("25000.00"),
        unite_mesure="piece",
        stock_disponible=20,
        id_categorie=categorie.id_categorie,
    )
    db.add(produit)
    db.commit()
    return produit


def _commander(
    db: Session, client: Client, produit: Produit, devise: Devise, quantite: int = 1
) -> Commande:
    return CommandeService(db).creer(
        CommandeCreate(
            type_commande=TypeCommande.A_EMPORTER,
            devise=devise,
            lignes=[
                LigneCommandeCreate(id_produit=produit.id_produit, quantite=quantite)
            ],
        ),
        client,
    )


# --- Conversion -----------------------------------------------------------------


def test_l_ariary_se_convertit_en_lui_meme(taux: TauxChangeService) -> None:
    assert taux.convertir(Decimal("25000"), Devise.MGA) == (
        Decimal("1"),
        Decimal("25000.00"),
    )


def test_une_devise_etrangere_divise_par_le_taux(taux: TauxChangeService) -> None:
    assert taux.convertir(Decimal("25000"), Devise.EUR) == (
        Decimal("5000"),
        Decimal("5.00"),
    )


def test_l_arrondi_se_fait_au_centime_au_demi_superieur(
    taux: TauxChangeService,
) -> None:
    # 10 000 / 4 500 = 2,2222… → 2,22 ; 10 025 / 4 500 = 2,2277… → 2,23
    assert taux.convertir(Decimal("10000"), Devise.USD)[1] == Decimal("2.22")
    assert taux.convertir(Decimal("10025"), Devise.USD)[1] == Decimal("2.23")


def test_un_montant_trop_faible_en_devise_est_refuse(taux: TauxChangeService) -> None:
    """2 000 Ar = 0,40 EUR : sous le minimum d'une carte internationale."""
    with pytest.raises(ReferenceInvalide, match="minimum"):
        taux.convertir(Decimal("2000"), Devise.EUR)


def test_une_devise_sans_taux_actif_est_refusee(
    db: Session, taux: TauxChangeService
) -> None:
    eur = taux.obtenir(Devise.EUR)
    taux.taux.delete(eur)
    db.commit()

    with pytest.raises(ReferenceInvalide, match="EUR"):
        taux.convertir(Decimal("25000"), Devise.EUR)


# --- Contraintes en base --------------------------------------------------------


def test_la_base_refuse_un_taux_pour_l_ariary(db: Session) -> None:
    db.add(TauxChange(devise=Devise.MGA, ariary_par_unite=Decimal("1")))
    with pytest.raises(IntegrityError):
        db.flush()


def test_la_base_refuse_un_taux_nul(db: Session, taux: TauxChangeService) -> None:
    eur = taux.obtenir(Devise.EUR)
    eur.ariary_par_unite = Decimal("0")
    with pytest.raises(IntegrityError):
        db.flush()


def test_la_base_refuse_une_commande_en_ariary_avec_un_autre_taux(
    db: Session, taux: TauxChangeService, client: Client, gateau: Produit
) -> None:
    commande = _commander(db, client, gateau, Devise.MGA)
    commande.taux_change = Decimal("5000")
    with pytest.raises(IntegrityError):
        db.flush()


# --- Commande en devise ---------------------------------------------------------


def test_une_commande_en_euros_fige_taux_et_montant(
    db: Session, taux: TauxChangeService, client: Client, gateau: Produit
) -> None:
    commande = _commander(db, client, gateau, Devise.EUR, quantite=2)

    assert commande.montant_total == Decimal("50000.00")
    assert commande.devise == Devise.EUR
    assert commande.taux_change == Decimal("5000")
    assert commande.montant_total_devise == Decimal("10.00")


def test_changer_le_taux_ne_retroagit_pas(
    db: Session, taux: TauxChangeService, client: Client, gateau: Produit
) -> None:
    commande = _commander(db, client, gateau, Devise.EUR)

    taux.modifier(Devise.EUR, TauxChangeUpdate(ariary_par_unite=Decimal("2500")))
    db.refresh(commande)

    assert commande.taux_change == Decimal("5000")
    assert commande.montant_total_devise == Decimal("5.00")


def test_une_commande_sans_devise_reste_en_ariary(
    db: Session, taux: TauxChangeService, client: Client, gateau: Produit
) -> None:
    commande = CommandeService(db).creer(
        CommandeCreate(
            type_commande=TypeCommande.A_EMPORTER,
            lignes=[LigneCommandeCreate(id_produit=gateau.id_produit, quantite=1)],
        ),
        client,
    )

    assert commande.devise == Devise.MGA
    assert commande.taux_change == Decimal("1")
    assert commande.montant_total_devise == commande.montant_total


# --- Paiement ------------------------------------------------------------------


def test_le_paiement_encaisse_le_montant_dans_la_devise(
    db: Session, taux: TauxChangeService, client: Client, gateau: Produit
) -> None:
    commande = _commander(db, client, gateau, Devise.USD)

    paiement = PaiementService(db).initier(
        commande,
        PaiementCreate(
            methode=MethodePaiement.CARTE, fournisseur=FournisseurPaiement.STRIPE
        ),
    )

    assert paiement.devise == Devise.USD
    assert paiement.montant == Decimal("5.56")  # 25 000 / 4 500


def test_le_mobile_money_est_refuse_hors_ariary(
    db: Session, taux: TauxChangeService, client: Client, gateau: Produit
) -> None:
    commande = _commander(db, client, gateau, Devise.EUR)

    with pytest.raises(ReferenceInvalide, match="Ariary"):
        PaiementService(db).initier(
            commande,
            PaiementCreate(
                methode=MethodePaiement.MOBILE_MONEY,
                fournisseur=FournisseurPaiement.MVOLA,
                numero_mobile_money="0341234567",
            ),
        )


def test_le_mobile_money_reste_possible_en_ariary(
    db: Session, taux: TauxChangeService, client: Client, gateau: Produit
) -> None:
    commande = _commander(db, client, gateau, Devise.MGA)

    paiement = PaiementService(db).initier(
        commande,
        PaiementCreate(
            methode=MethodePaiement.MOBILE_MONEY,
            fournisseur=FournisseurPaiement.MVOLA,
            numero_mobile_money="0341234567",
        ),
    )

    assert paiement.devise == Devise.MGA
    assert paiement.montant == Decimal("25000.00")


@pytest.mark.parametrize(
    ("methode", "fournisseur"),
    [
        (MethodePaiement.CARTE, FournisseurPaiement.MVOLA),
        (MethodePaiement.MOBILE_MONEY, FournisseurPaiement.STRIPE),
    ],
)
def test_une_methode_et_un_fournisseur_incoherents_sont_refuses(
    methode: MethodePaiement, fournisseur: FournisseurPaiement
) -> None:
    with pytest.raises(ValidationError):
        PaiementCreate(methode=methode, fournisseur=fournisseur)
