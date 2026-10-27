"""Tests propres à `PasserelleSimulee` — tout ce qui n'appartient pas au
contrat `PasserellePaiement` (cf. `test_passerelle_paiement_contrat.py`).
"""

import json

from app.models.paiement import StatutPaiement
from app.services.passerelle_paiement_simulee import (
    ComportementSimulation,
    PasserelleSimulee,
)


def test_comportement_par_defaut_est_toujours_reussi() -> None:
    passerelle = PasserelleSimulee()

    _, signature = passerelle.simuler_confirmation("ref-defaut")
    charge_utile, _ = passerelle.simuler_confirmation("ref-defaut")

    assert json.loads(charge_utile)["statut"] == StatutPaiement.REUSSI.value


def test_comportement_toujours_reussi_est_deterministe() -> None:
    passerelle = PasserelleSimulee(ComportementSimulation.TOUJOURS_REUSSI)

    resultats = {
        json.loads(passerelle.simuler_confirmation(f"ref-{i}")[0])["statut"]
        for i in range(10)
    }

    assert resultats == {StatutPaiement.REUSSI.value}


def test_comportement_toujours_echoue_est_deterministe() -> None:
    passerelle = PasserelleSimulee(ComportementSimulation.TOUJOURS_ECHOUE)

    resultats = {
        json.loads(passerelle.simuler_confirmation(f"ref-{i}")[0])["statut"]
        for i in range(10)
    }

    assert resultats == {StatutPaiement.ECHOUE.value}


def test_comportement_aleatoire_produit_les_deux_issues() -> None:
    """Un seul tirage ne prouverait rien : sur un nombre suffisant d'essais,
    les deux issues doivent apparaître — sinon `aleatoire` ne serait qu'un
    des deux autres comportements déguisé."""
    passerelle = PasserelleSimulee(ComportementSimulation.ALEATOIRE)

    resultats = {
        json.loads(passerelle.simuler_confirmation(f"ref-{i}")[0])["statut"]
        for i in range(50)
    }

    assert resultats == {StatutPaiement.REUSSI.value, StatutPaiement.ECHOUE.value}


def test_simuler_confirmation_porte_la_reference_demandee() -> None:
    passerelle = PasserelleSimulee(ComportementSimulation.TOUJOURS_REUSSI)

    charge_utile, _ = passerelle.simuler_confirmation("ref-precise")

    assert json.loads(charge_utile)["reference_externe"] == "ref-precise"


def test_deux_appels_signent_differemment_deux_charges_utiles_differentes() -> None:
    """La signature dépend de la charge utile, pas d'un compteur interne ou
    d'un état partagé — deux passerelles indépendantes doivent s'accorder
    sur la même signature pour la même charge utile."""
    charge_utile_1, signature_1 = PasserelleSimulee().simuler_confirmation("ref-a")
    charge_utile_2, signature_2 = PasserelleSimulee().simuler_confirmation("ref-b")

    assert charge_utile_1 != charge_utile_2
    assert signature_1 != signature_2


def test_signature_reste_valide_pour_une_autre_instance() -> None:
    """Une instance distincte de `PasserelleSimulee` doit reconnaître une
    signature produite par une autre — la clé n'est pas propre à une
    instance, sans quoi un webhook reçu après un redémarrage du processus
    serait injustement rejeté."""
    charge_utile, signature = PasserelleSimulee().simuler_confirmation("ref-c")

    assert PasserelleSimulee().verifier_signature(charge_utile, signature)
