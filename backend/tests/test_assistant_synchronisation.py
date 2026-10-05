"""Branchement de l'index de l'assistant IA dans les services (Sprint 12, 12.3).

Vrais services, vraie base (`session_postgres`), mais **indexation
interceptée** : on enregistre ce que les services demandent d'indexer — et le
texte qu'ils auraient envoyé — sans appeler Hugging Face. Ce qui est vérifié ici
est le câblage : quelle écriture déclenche quelle synchronisation, et dans quel
sens.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.ai_langchain import indexation
from app.core.config import settings
from app.models.logement import StatutLogement
from app.models.session_formation import StatutSessionFormation
from app.schemas.categorie_produit import CategorieProduitCreate
from app.schemas.domaine_formation import DomaineFormationCreate
from app.schemas.formation import FormationCreate, FormationUpdate
from app.schemas.logement import LogementCreate, LogementUpdate
from app.schemas.produit import ProduitCreate, ProduitUpdate
from app.schemas.salle import SalleCreate
from app.schemas.session_formation import SessionFormationCreate
from app.services.categorie_produit_service import CategorieProduitService
from app.services.domaine_formation_service import DomaineFormationService
from app.services.formation_service import FormationService
from app.services.logement_service import LogementService
from app.services.produit_service import ProduitService
from app.services.salle_service import SalleService
from app.services.session_formation_service import SessionFormationService


class Journal:
    """Enregistre les demandes d'indexation, texte compris."""

    def __init__(self) -> None:
        self.appels: list[tuple[str, str, int, str | None]] = []
        self.titres: dict[tuple[str, int], str | None] = {}

    def indexer(self, type_contenu, id_contenu, construire_texte, titre=None) -> int:
        self.appels.append(("indexer", type_contenu, id_contenu, construire_texte()))
        self.titres[(type_contenu, id_contenu)] = titre
        return 1

    def desindexer(self, type_contenu, id_contenu) -> int:
        self.appels.append(("desindexer", type_contenu, id_contenu, None))
        return 1

    def pour(self, type_contenu: str, id_contenu: int) -> list[tuple]:
        return [a for a in self.appels if a[1:3] == (type_contenu, id_contenu)]

    def dernier_texte(self, type_contenu: str, id_contenu: int) -> str | None:
        return self.pour(type_contenu, id_contenu)[-1][3]

    def vider(self) -> None:
        self.appels.clear()


@pytest.fixture(autouse=True)
def _comme_en_production(session_postgres: Session) -> None:
    """Aligne la session de test sur `SessionLocal` : `expire_on_commit=False`.

    Sans cela, le `commit` de la fixture expire tout et recharge les
    collections — ce que la production ne fait jamais. C'est exactement ce qui
    avait masqué le bogue des sessions absentes du texte de leur formation,
    découvert en parcours réel (12.3).
    """
    session_postgres.expire_on_commit = False


@pytest.fixture
def journal(monkeypatch: pytest.MonkeyPatch) -> Journal:
    journal = Journal()
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(indexation, "indexer_sans_echec", journal.indexer)
    monkeypatch.setattr(indexation, "desindexer_sans_echec", journal.desindexer)
    return journal


def _categorie(db: Session, libelle: str) -> int:
    return (
        CategorieProduitService(db)
        .creer(CategorieProduitCreate(libelle=libelle))
        .id_categorie
    )


def _produit(db: Session, id_categorie: int, nom: str = "Tarte au citron") -> int:
    return (
        ProduitService(db)
        .creer(
            ProduitCreate(
                nom=nom,
                prix_unitaire=Decimal("12345.67"),
                unite_mesure="pièce",
                stock_disponible=987,
                id_categorie=id_categorie,
            )
        )
        .id_produit
    )


def _domaine(db: Session, libelle: str) -> int:
    return (
        DomaineFormationService(db)
        .creer(DomaineFormationCreate(libelle=libelle))
        .id_domaine
    )


def _formation(db: Session, id_domaine: int) -> int:
    return (
        FormationService(db)
        .creer(
            FormationCreate(
                titre="Initiation à la pâtisserie",
                duree_heures=20,
                prix=Decimal("12345.00"),
                capacite_max=12,
                id_domaine=id_domaine,
            )
        )
        .id_formation
    )


# --- PRODUIT et CATEGORIE ---------------------------------------------------


def test_creer_un_produit_indexe_le_produit_et_sa_categorie(
    session_postgres: Session, journal: Journal
) -> None:
    id_categorie = _categorie(session_postgres, "Pâtisserie IA")
    journal.vider()

    id_produit = _produit(session_postgres, id_categorie)

    assert journal.pour("produit", id_produit)[0][0] == "indexer"
    texte_produit = journal.dernier_texte("produit", id_produit)
    assert "Tarte au citron" in texte_produit
    assert "12345" not in texte_produit and "987" not in texte_produit
    assert "Tarte au citron" in journal.dernier_texte("categorie_produit", id_categorie)


def test_changer_de_categorie_resynchronise_l_ancienne_et_la_nouvelle(
    session_postgres: Session, journal: Journal
) -> None:
    ancienne = _categorie(session_postgres, "Ancienne IA")
    nouvelle = _categorie(session_postgres, "Nouvelle IA")
    id_produit = _produit(session_postgres, ancienne)
    journal.vider()

    ProduitService(session_postgres).modifier(
        id_produit, ProduitUpdate(id_categorie=nouvelle)
    )

    assert "Tarte au citron" in journal.dernier_texte("categorie_produit", nouvelle)
    assert "Tarte au citron" not in journal.dernier_texte("categorie_produit", ancienne)


def test_archiver_un_produit_le_retire_et_le_sort_de_sa_categorie(
    session_postgres: Session, journal: Journal
) -> None:
    id_categorie = _categorie(session_postgres, "Archivage IA")
    id_produit = _produit(session_postgres, id_categorie)
    journal.vider()

    ProduitService(session_postgres).supprimer(id_produit)

    assert journal.pour("produit", id_produit) == [
        ("desindexer", "produit", id_produit, None)
    ]
    assert "Tarte au citron" not in journal.dernier_texte(
        "categorie_produit", id_categorie
    )


def test_restaurer_un_produit_le_reindexe(
    session_postgres: Session, journal: Journal
) -> None:
    id_produit = _produit(session_postgres, _categorie(session_postgres, "Resto IA"))
    service = ProduitService(session_postgres)
    service.supprimer(id_produit)
    journal.vider()

    service.restaurer(id_produit)

    assert journal.pour("produit", id_produit)[0][0] == "indexer"


def test_restaurer_un_produit_deja_actif_ne_reindexe_pas(
    session_postgres: Session, journal: Journal
) -> None:
    id_produit = _produit(session_postgres, _categorie(session_postgres, "Actif IA"))
    journal.vider()

    ProduitService(session_postgres).restaurer(id_produit)

    assert journal.appels == []


def test_archiver_une_categorie_la_retire(
    session_postgres: Session, journal: Journal
) -> None:
    id_categorie = _categorie(session_postgres, "Vide IA")
    journal.vider()

    CategorieProduitService(session_postgres).supprimer(id_categorie)

    assert journal.pour("categorie_produit", id_categorie) == [
        ("desindexer", "categorie_produit", id_categorie, None)
    ]


# --- FORMATION, DOMAINE et SESSION ------------------------------------------


def test_creer_une_formation_indexe_la_formation_et_son_domaine(
    session_postgres: Session, journal: Journal
) -> None:
    id_domaine = _domaine(session_postgres, "Pâtisserie IA")
    journal.vider()

    id_formation = _formation(session_postgres, id_domaine)

    assert "Initiation à la pâtisserie" in journal.dernier_texte(
        "formation", id_formation
    )
    assert "Initiation à la pâtisserie" in journal.dernier_texte(
        "domaine_formation", id_domaine
    )


def test_changer_de_domaine_resynchronise_l_ancien_et_le_nouveau(
    session_postgres: Session, journal: Journal
) -> None:
    ancien = _domaine(session_postgres, "Ancien domaine IA")
    nouveau = _domaine(session_postgres, "Nouveau domaine IA")
    id_formation = _formation(session_postgres, ancien)
    journal.vider()

    FormationService(session_postgres).modifier(
        id_formation, FormationUpdate(id_domaine=nouveau)
    )

    assert "Initiation" in journal.dernier_texte("domaine_formation", nouveau)
    assert "Initiation" not in journal.dernier_texte("domaine_formation", ancien)


def test_les_ecritures_de_session_resynchronisent_leur_formation(
    session_postgres: Session, journal: Journal
) -> None:
    id_formation = _formation(session_postgres, _domaine(session_postgres, "Dom IA"))
    service = SessionFormationService(session_postgres)
    debut = date.today() + timedelta(days=30)
    journal.vider()

    session = service.creer(
        SessionFormationCreate(
            date_debut=debut,
            date_fin=debut + timedelta(days=4),
            id_formation=id_formation,
        )
    )
    assert f"{debut:%d/%m/%Y}" in journal.dernier_texte("formation", id_formation)

    service.changer_statut(session.id_session, StatutSessionFormation.ANNULEE)
    assert f"{debut:%d/%m/%Y}" not in journal.dernier_texte(
        "formation", id_formation
    ), "une session annulée sort du texte de sa formation"
    assert (
        journal.pour("session_formation", session.id_session) == []
    ), "les sessions ne sont jamais indexées à part"


# --- SALLE et LOGEMENT ------------------------------------------------------


def test_une_salle_est_indexee_puis_retiree_a_l_archivage(
    session_postgres: Session, journal: Journal
) -> None:
    service = SalleService(session_postgres)
    id_salle = service.creer(
        SalleCreate(nom="Salle Ravinala", capacite=40, tarif_journee=Decimal("98765"))
    ).id_salle

    service.supprimer(id_salle)

    assert [a[0] for a in journal.pour("salle", id_salle)] == ["indexer", "desindexer"]
    assert "98765" not in journal.pour("salle", id_salle)[0][3]


def test_un_logement_hors_service_sort_de_l_index_et_y_revient(
    session_postgres: Session, journal: Journal
) -> None:
    service = LogementService(session_postgres)
    id_logement = service.creer(
        LogementCreate(type_chambre="double", capacite=2, tarif_nuitee=Decimal("12345"))
    ).id_logement
    journal.vider()

    service.modifier(id_logement, LogementUpdate(statut=StatutLogement.HORS_SERVICE))
    service.modifier(id_logement, LogementUpdate(statut=StatutLogement.DISPONIBLE))

    assert [a[0] for a in journal.pour("logement", id_logement)] == [
        "desindexer",
        "indexer",
    ]


# --- Assistant désactivé, panne ---------------------------------------------


def test_assistant_desactive_aucune_synchronisation(
    session_postgres: Session, journal: Journal, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AI_ENABLED", False)

    id_categorie = _categorie(session_postgres, "Coupé IA")
    id_produit = _produit(session_postgres, id_categorie)
    ProduitService(session_postgres).supprimer(id_produit)

    assert journal.appels == []


def test_une_panne_d_indexation_ne_fait_pas_echouer_l_ecriture(
    session_postgres: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Indexation réelle (`indexer_sans_echec`), mais l'index lui-même en panne."""
    monkeypatch.setattr(settings, "AI_ENABLED", True)

    def en_panne(*args: object, **kwargs: object) -> int:
        raise ConnectionError("Hugging Face hors quota")

    monkeypatch.setattr(indexation, "indexer_texte", en_panne)

    id_categorie = _categorie(session_postgres, "Panne IA")
    id_produit = _produit(session_postgres, id_categorie)

    assert ProduitService(session_postgres).obtenir(id_produit).nom == "Tarte au citron"
