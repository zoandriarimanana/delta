"""Textes indexés par l'assistant IA (Sprint 12, 12.3).

Les règles vérifiées ici sont celles de `docs/roadmap.md` (12.8) : les prix du
catalogue **y figurent**, mais jamais un stock, un nombre de places ni le nom
d'une personne, et jamais une entité archivée. Chaque valeur interdite est
**reconnaissable** (987, 654...) : le test cherche sa trace dans le texte
produit, ce qui attrape aussi un formatage inattendu.

Objets factices (`SimpleNamespace`) plutôt que base de données : un
constructeur de texte ne lit que des attributs, et ces tests restent
instantanés.
"""

import subprocess
import sys
from datetime import date, datetime
from decimal import Decimal
from types import SimpleNamespace as Objet

from app.ai_langchain.textes import (
    categorie_produit,
    domaine_formation,
    formation,
    logement,
    produit,
    salle,
)
from app.models.logement import StatutLogement
from app.models.session_formation import StatutSessionFormation

ARCHIVE = datetime(2026, 1, 1)
AUJOURD_HUI = date(2026, 10, 5)


def _categorie(**kw):
    return Objet(
        **{"id_categorie": 1, "libelle": "Pâtisserie", "supprime_le": None}
        | {"produits": []}
        | kw
    )


def _produit(**kw):
    valeurs = {
        "id_produit": 1,
        "nom": "Tarte au citron",
        "description": "Pâte sablée et meringue.",
        "unite_mesure": "pièce",
        "prix_unitaire": Decimal("12345.67"),
        "stock_disponible": 987,
        "est_personnalisable": True,
        "supplement_personnalisation": Decimal("4321.00"),
        "est_livrable": False,
        "supprime_le": None,
        "categorie": _categorie(),
    }
    return Objet(**valeurs | kw)


def _session(statut, debut, fin, **kw):
    valeurs = {
        "statut": statut,
        "date_debut": debut,
        "date_fin": fin,
        "places_restantes": 987,
        "supprime_le": None,
        "formateur": Objet(nom="Rakotobe", prenom="Haja", specialite="Chocolat"),
    }
    return Objet(**valeurs | kw)


def _formation(sessions=(), **kw):
    valeurs = {
        "id_formation": 1,
        "titre": "Initiation à la pâtisserie",
        "niveau": "Débutant",
        "duree_heures": 20,
        "prix": Decimal("12345.00"),
        "capacite_max": 654,
        "propose_hebergement": True,
        "supprime_le": None,
        "domaine": Objet(libelle="Pâtisserie et cuisine"),
        "sessions": list(sessions),
    }
    return Objet(**valeurs | kw)


# --- PRODUIT ----------------------------------------------------------------


def test_produit_porte_nom_categorie_description_et_modalites() -> None:
    texte = produit.construire_texte(_produit())

    assert "Tarte au citron" in texte
    assert "Pâtisserie" in texte
    assert "Pâte sablée et meringue." in texte
    assert "Prix : 12 345,67 Ar par pièce" in texte
    assert "Personnalisable, supplément de 4 321 Ar par pièce." in texte
    assert "retrait sur place" in texte


def test_produit_n_expose_jamais_le_stock() -> None:
    """Le stock change à chaque commande : un fragment figé répondrait faux."""
    texte = produit.construire_texte(_produit())

    assert "987" not in texte
    assert "stock" not in texte.lower()


def test_produit_non_personnalisable_n_annonce_aucun_supplement() -> None:
    texte = produit.construire_texte(_produit(est_personnalisable=False))

    assert "Non personnalisable." in texte
    assert "4 321" not in texte, "un tarif dormant ne doit pas être annoncé"


def test_produit_sans_description_reste_valide() -> None:
    texte = produit.construire_texte(_produit(description=None))
    assert "Description" not in texte


def test_produit_archive_n_est_pas_indexable() -> None:
    assert produit.est_indexable(_produit()) is True
    assert produit.est_indexable(_produit(supprime_le=ARCHIVE)) is False


# --- CATEGORIE_PRODUIT ------------------------------------------------------


def test_categorie_liste_ses_seuls_produits_actifs_par_ordre_alphabetique() -> None:
    categorie = _categorie(
        produits=[
            Objet(nom="Tarte au citron", supprime_le=None),
            Objet(nom="Éclair retiré", supprime_le=ARCHIVE),
            Objet(nom="Brioche", supprime_le=None),
        ]
    )

    texte = categorie_produit.construire_texte(categorie)

    assert "Produits de cette catégorie : Brioche, Tarte au citron." in texte
    assert "retiré" not in texte


def test_categorie_vide_ne_porte_pas_de_liste() -> None:
    texte = categorie_produit.construire_texte(_categorie())
    assert texte == "Catégorie de produits : Pâtisserie"


# --- FORMATION --------------------------------------------------------------


def test_formation_porte_ses_proprietes_stables() -> None:
    texte = formation.construire_texte(_formation(), AUJOURD_HUI)

    assert "Initiation à la pâtisserie" in texte
    assert "Pâtisserie et cuisine" in texte
    assert "Débutant" in texte
    assert "20 heures" in texte
    assert "Hébergement proposé" in texte


def test_formation_porte_son_prix_mais_ni_capacite_ni_places_ni_formateur() -> None:
    session = _session(
        StatutSessionFormation.OUVERTE, date(2026, 11, 9), date(2026, 11, 13)
    )

    texte = formation.construire_texte(_formation([session]), AUJOURD_HUI)

    assert "Prix : 12 345 Ar par personne" in texte
    for valeur_interdite in ("654", "987"):
        assert valeur_interdite not in texte
    for nom in ("Rakotobe", "Haja", "Chocolat"):
        assert nom not in texte, "aucun nom de personne dans l'index"


def test_formation_ne_liste_que_les_sessions_a_venir_triees() -> None:
    sessions = [
        _session(
            StatutSessionFormation.PLANIFIEE, date(2026, 12, 1), date(2026, 12, 5)
        ),
        _session(StatutSessionFormation.OUVERTE, date(2026, 11, 9), date(2026, 11, 13)),
        _session(StatutSessionFormation.TERMINEE, date(2026, 12, 7), date(2026, 12, 9)),
        _session(
            StatutSessionFormation.ANNULEE, date(2026, 12, 14), date(2026, 12, 16)
        ),
        _session(StatutSessionFormation.OUVERTE, date(2026, 9, 1), date(2026, 9, 3)),
        _session(
            StatutSessionFormation.OUVERTE,
            date(2026, 12, 20),
            date(2026, 12, 22),
            supprime_le=ARCHIVE,
        ),
    ]

    texte = formation.construire_texte(_formation(sessions), AUJOURD_HUI)

    lignes = [ligne for ligne in texte.splitlines() if ligne.startswith("- du")]
    assert lignes == [
        "- du 09/11/2026 au 13/11/2026 (inscriptions ouvertes)",
        "- du 01/12/2026 au 05/12/2026 (planifiée)",
    ]


def test_une_session_en_cours_reste_listee_jusqu_a_sa_fin() -> None:
    en_cours = _session(StatutSessionFormation.OUVERTE, date(2026, 10, 1), AUJOURD_HUI)
    texte = formation.construire_texte(_formation([en_cours]), AUJOURD_HUI)
    assert "- du 01/10/2026 au 05/10/2026" in texte


def test_formation_sans_session_le_dit() -> None:
    texte = formation.construire_texte(_formation(), AUJOURD_HUI)
    assert "Aucune session à venir" in texte


# --- DOMAINE_FORMATION ------------------------------------------------------


def test_domaine_liste_ses_seules_formations_actives() -> None:
    domaine = Objet(
        id_domaine=1,
        libelle="Cuisine",
        description="Cuisine du monde.",
        supprime_le=None,
        formations=[
            Objet(titre="Cuisine malgache", supprime_le=None),
            Objet(titre="Ancienne formation", supprime_le=ARCHIVE),
        ],
    )

    texte = domaine_formation.construire_texte(domaine)

    assert "Domaine de formation : Cuisine" in texte
    assert "Cuisine du monde." in texte
    assert "Formations proposées : Cuisine malgache." in texte
    assert "Ancienne" not in texte


# --- SALLE ------------------------------------------------------------------


def _salle(**kw):
    valeurs = {
        "id_salle": 1,
        "nom": "Salle Ravinala",
        "capacite": 40,
        "equipements": "vidéoprojecteur",
        "tarif_horaire": Decimal("12345.00"),
        "tarif_journee": Decimal("98765.00"),
        "supprime_le": None,
    }
    return Objet(**valeurs | kw)


def test_salle_porte_capacite_equipements_et_tarifs() -> None:
    texte = salle.construire_texte(_salle())

    assert "Salle Ravinala" in texte
    assert "40 personnes" in texte
    assert "vidéoprojecteur" in texte
    assert "Location à l'heure : 12 345 Ar ; à la journée : 98 765 Ar." in texte


def test_salle_le_mode_de_location_suit_les_tarifs_renseignes() -> None:
    assert "Location à la journée : 98 765 Ar." in salle.construire_texte(
        _salle(tarif_horaire=None)
    )
    assert "Location à l'heure : 12 345 Ar." in salle.construire_texte(
        _salle(tarif_journee=None)
    )


def test_une_salle_gratuite_reste_une_location() -> None:
    """`0.00` est un tarif décidé (docs/mld.md), pas une absence de tarif."""
    texte = salle.construire_texte(
        _salle(tarif_horaire=Decimal("0.00"), tarif_journee=None)
    )
    assert "Location à l'heure : gratuit." in texte


# --- LOGEMENT ---------------------------------------------------------------


def _logement(**kw):
    valeurs = {
        "id_logement": 1,
        "type_chambre": "double",
        "capacite": 2,
        "tarif_nuitee": Decimal("12345.00"),
        "statut": StatutLogement.DISPONIBLE,
        "supprime_le": None,
    }
    return Objet(**valeurs | kw)


def test_logement_porte_type_capacite_tarif_et_termes_malgaches() -> None:
    texte = logement.construire_texte(_logement())

    assert "chambre double" in texte
    assert "2 personne(s)" in texte
    assert "efitra fatoriana" in texte
    assert "12 345 Ar la nuit" in texte
    assert "Disponible" not in texte, "le statut décrit un état, il n'est pas figé"


def test_logement_hors_service_ou_archive_sort_de_l_index() -> None:
    assert logement.est_indexable(_logement()) is True
    assert logement.est_indexable(_logement(statut=StatutLogement.EN_MAINTENANCE))
    assert not logement.est_indexable(_logement(statut=StatutLogement.HORS_SERVICE))
    assert not logement.est_indexable(_logement(supprime_le=ARCHIVE))


# --- Isolation de LangChain ---------------------------------------------------


def test_les_textes_et_la_synchronisation_n_importent_pas_langchain() -> None:
    """Les services importent ces modules en permanence : un déploiement sans
    `requirements-ai.txt` doit pouvoir démarrer. Sous-processus, pour partir
    d'un interpréteur où rien n'est encore chargé."""
    code = (
        "import sys\n"
        "import app.services.produit_service, app.services.formation_service\n"
        "import app.services.session_formation_service, app.services.salle_service\n"
        "import app.services.logement_service\n"
        "import app.services.categorie_produit_service\n"
        "import app.services.domaine_formation_service\n"
        "charges = sorted(m for m in sys.modules if m.startswith('langchain'))\n"
        "assert not charges, charges\n"
    )
    resultat = subprocess.run(
        [sys.executable, "-c", code], capture_output=True, text=True, check=False
    )
    assert resultat.returncode == 0, resultat.stderr
