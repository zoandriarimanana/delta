"""Tests de **contrat** de `PasserellePaiement`.

Écrits contre l'interface, pas contre `PasserelleSimulee` : n'importe quelle
future implémentation réelle n'a qu'à être ajoutée à `IMPLEMENTATIONS`
ci-dessous pour être vérifiée par la même suite, sans qu'aucun test — ni
aucun appelant — n'ait à changer. C'est la preuve concrète que rien ne
dépend de `PasserelleSimulee` par son nom, seulement du contrat.
"""

from decimal import Decimal

import pytest

from app.models.paiement import FournisseurPaiement, MethodePaiement, StatutPaiement
from app.services.passerelle_paiement import PasserellePaiement
from app.services.passerelle_paiement_simulee import PasserelleSimulee

#: Une seule implémentation pour l'instant. Un vrai fournisseur (Mvola,
#: Stripe...) s'ajoute ici une fois ses accès API obtenus — jamais en
#: réécrivant les tests ci-dessous.
IMPLEMENTATIONS: list[PasserellePaiement] = [PasserelleSimulee()]


@pytest.fixture(params=IMPLEMENTATIONS, ids=lambda impl: type(impl).__name__)
def passerelle(request: pytest.FixtureRequest) -> PasserellePaiement:
    return request.param


def test_initier_retourne_toujours_en_attente(passerelle: PasserellePaiement) -> None:
    """Garantie du contrat, pas un détail d'implémentation : carte comme
    mobile money confirment de façon asynchrone, jamais dans la même
    requête que l'initiation (cf. `docs/mld.md`)."""
    resultat = passerelle.initier(
        Decimal("5000.00"), MethodePaiement.MOBILE_MONEY, FournisseurPaiement.MVOLA
    )

    assert resultat.statut == StatutPaiement.EN_ATTENTE


def test_initier_retourne_une_reference_non_vide(
    passerelle: PasserellePaiement,
) -> None:
    resultat = passerelle.initier(
        Decimal("5000.00"), MethodePaiement.CARTE, FournisseurPaiement.STRIPE
    )

    assert resultat.reference_externe != ""


def test_initier_retourne_une_reference_distincte_a_chaque_appel(
    passerelle: PasserellePaiement,
) -> None:
    """Deux paiements distincts ne doivent jamais partager une référence :
    `PAIEMENT.reference_externe` est UNIQUE en base (cf. `docs/mld.md`)."""
    premiere = passerelle.initier(
        Decimal("1000.00"), MethodePaiement.MOBILE_MONEY, FournisseurPaiement.MVOLA
    )
    seconde = passerelle.initier(
        Decimal("1000.00"), MethodePaiement.MOBILE_MONEY, FournisseurPaiement.MVOLA
    )

    assert premiere.reference_externe != seconde.reference_externe


def test_verifier_signature_accepte_une_signature_valide(
    passerelle: PasserellePaiement,
) -> None:
    if not isinstance(passerelle, PasserelleSimulee):
        pytest.skip("nécessite de produire une signature réelle")

    # Chaque implémentation doit pouvoir produire une signature qu'elle
    # reconnaît elle-même : on ne présuppose aucun mécanisme de signature
    # précis, seulement que produire puis vérifier sont cohérents.
    charge_utile, signature = passerelle.simuler_confirmation("ref-1")

    assert passerelle.verifier_signature(charge_utile, signature)


def test_verifier_signature_rejette_une_signature_invalide(
    passerelle: PasserellePaiement,
) -> None:
    assert not passerelle.verifier_signature(b"charge utile", "signature-invalide")


def test_verifier_signature_rejette_une_charge_utile_modifiee(
    passerelle: PasserellePaiement,
) -> None:
    """Une charge utile altérée après signature doit être détectée : sans
    cela, n'importe qui pourrait rejouer une signature valide sur un montant
    ou un statut différent."""
    if not isinstance(passerelle, PasserelleSimulee):
        pytest.skip("nécessite de produire une signature réelle")

    charge_utile, signature = passerelle.simuler_confirmation("ref-2")
    charge_utile_modifiee = charge_utile.replace(b"ref-2", b"ref-3")

    assert not passerelle.verifier_signature(charge_utile_modifiee, signature)
