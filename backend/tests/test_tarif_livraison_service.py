"""Frais de livraison : tarif réglable, calcul, et frais figés sur la commande.

PostgreSQL réel (`session_postgres`) : l'unique ligne de `TARIF_LIVRAISON`
est celle que pose la migration. Chaque test fixe ses propres montants, et
la transaction est annulée à la fin — le tarif réel n'est jamais modifié.
"""

from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hacher_mot_de_passe
from app.models.categorie_produit import CategorieProduit
from app.models.client import Client, TypeClient
from app.models.commande import TypeCommande
from app.models.produit import Produit
from app.models.tarif_livraison import TarifLivraison
from app.schemas.commande import CommandeCreate
from app.schemas.ligne_commande import LigneCommandeCreate
from app.schemas.tarif_livraison import TarifLivraisonUpdate
from app.services.commande_service import CommandeService
from app.services.tarif_livraison_service import TarifLivraisonService

ADRESSE = "Lot II M 45 Antananarivo"


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def tarifs(db: Session) -> TarifLivraisonService:
    service = TarifLivraisonService(db)
    service.modifier(
        TarifLivraisonUpdate(
            forfait=Decimal("5000.00"), seuil_gratuite=Decimal("100000.00")
        )
    )
    return service


@pytest.fixture
def client(db: Session) -> Client:
    compte = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"frais_{uuid4().hex[:8]}@exemple.mg",
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
        nom="Gâteau d'anniversaire",
        prix_unitaire=Decimal("25000.00"),
        unite_mesure="piece",
        stock_disponible=20,
        id_categorie=categorie.id_categorie,
    )
    db.add(produit)
    db.commit()
    return produit


def _commander(
    db: Session, client: Client, produit: Produit, quantite: int, adresse: str | None
):
    return CommandeService(db).creer(
        CommandeCreate(
            type_commande=TypeCommande.EN_LIGNE,
            adresse_livraison=adresse,
            lignes=[
                LigneCommandeCreate(id_produit=produit.id_produit, quantite=quantite)
            ],
        ),
        client,
    )


# --- Calcul -------------------------------------------------------------------


def test_le_forfait_s_applique_sous_le_seuil(tarifs: TarifLivraisonService) -> None:
    assert tarifs.calculer_frais(Decimal("99999.99")) == Decimal("5000.00")


def test_la_livraison_est_offerte_des_le_seuil(tarifs: TarifLivraisonService) -> None:
    assert tarifs.calculer_frais(Decimal("100000.00")) == Decimal("0")


def test_sans_seuil_la_livraison_n_est_jamais_offerte(
    tarifs: TarifLivraisonService,
) -> None:
    tarifs.modifier(TarifLivraisonUpdate(seuil_gratuite=None))

    assert tarifs.obtenir().seuil_gratuite is None
    assert tarifs.calculer_frais(Decimal("9999999.00")) == Decimal("5000.00")


def test_une_cle_absente_laisse_la_valeur_inchangee(
    tarifs: TarifLivraisonService,
) -> None:
    tarifs.modifier(TarifLivraisonUpdate(forfait=Decimal("3000.00")))

    tarif = tarifs.obtenir()
    assert tarif.forfait == Decimal("3000.00")
    assert tarif.seuil_gratuite == Decimal("100000.00")


# --- Frais sur la commande ----------------------------------------------------


def test_une_commande_livree_paie_le_forfait_une_seule_fois(
    db: Session, tarifs: TarifLivraisonService, client: Client, gateau: Produit
) -> None:
    """Deux gâteaux, une tournée : le forfait est compté une fois."""
    commande = _commander(db, client, gateau, 2, ADRESSE)

    assert commande.frais_livraison == Decimal("5000.00")
    assert commande.montant_total == Decimal("55000.00")


def test_le_seuil_se_compare_aux_seuls_produits(
    db: Session, tarifs: TarifLivraisonService, client: Client, gateau: Produit
) -> None:
    """Quatre gâteaux = 100 000 Ar de produits : la livraison est offerte."""
    commande = _commander(db, client, gateau, 4, ADRESSE)

    assert commande.frais_livraison == Decimal("0")
    assert commande.montant_total == Decimal("100000.00")


def test_le_forfait_n_aide_pas_a_atteindre_sa_propre_gratuite(
    db: Session, tarifs: TarifLivraisonService, client: Client, gateau: Produit
) -> None:
    """96 000 Ar de produits + 5 000 de forfait dépassent le seuil, mais les
    produits seuls non : la livraison reste payante."""
    tarifs.modifier(TarifLivraisonUpdate(seuil_gratuite=Decimal("96001.00")))
    gateau.prix_unitaire = Decimal("24000.00")
    db.commit()

    commande = _commander(db, client, gateau, 4, ADRESSE)

    assert commande.frais_livraison == Decimal("5000.00")
    assert commande.montant_total == Decimal("101000.00")


def test_sans_adresse_aucun_frais(
    db: Session, tarifs: TarifLivraisonService, client: Client, gateau: Produit
) -> None:
    commande = _commander(db, client, gateau, 1, None)

    assert commande.frais_livraison == Decimal("0")
    assert commande.montant_total == Decimal("25000.00")


def test_changer_le_tarif_ne_retroagit_pas_sur_une_commande_passee(
    db: Session, tarifs: TarifLivraisonService, client: Client, gateau: Produit
) -> None:
    commande = _commander(db, client, gateau, 1, ADRESSE)

    tarifs.modifier(TarifLivraisonUpdate(forfait=Decimal("9000.00")))
    db.refresh(commande)

    assert commande.frais_livraison == Decimal("5000.00")
    assert commande.montant_total == Decimal("30000.00")


# --- Contraintes en base ------------------------------------------------------


def test_une_seconde_ligne_de_tarif_est_refusee(db: Session) -> None:
    db.add(TarifLivraison(id_tarif=2, forfait=Decimal("1.00")))
    with pytest.raises(IntegrityError, match="ck_tarif_livraison_ligne_unique"):
        db.flush()


@pytest.mark.parametrize(
    ("forfait", "seuil", "contrainte"),
    [
        (Decimal("-1.00"), None, "forfait_positif"),
        (Decimal("1.00"), Decimal("0.00"), "seuil_strictement_positif"),
    ],
)
def test_les_montants_incoherents_sont_refuses_en_base(
    db: Session, forfait: Decimal, seuil: Decimal | None, contrainte: str
) -> None:
    tarif = TarifLivraisonService(db).obtenir()
    tarif.forfait = forfait
    tarif.seuil_gratuite = seuil
    with pytest.raises(IntegrityError, match=contrainte):
        db.flush()
