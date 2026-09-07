"""Implémentation simulée de `PasserellePaiement`.

En attendant les accès API réels aux fournisseurs (Mvola, Orange Money,
Airtel Money, Stripe) — demandés, non encore obtenus au moment d'ouvrir le
Sprint 9 (cf. `docs/mld.md`).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from decimal import Decimal
from enum import StrEnum
from uuid import uuid4

from app.models.paiement import FournisseurPaiement, MethodePaiement, StatutPaiement
from app.services.passerelle_paiement import ResultatInitiation

#: Dev uniquement — n'a jamais vocation à protéger quoi que ce soit de réel :
#: cette passerelle n'existe que le temps de simuler un fournisseur.
_CLE_SIMULEE = b"cle-simulee-dev-uniquement"


class ComportementSimulation(StrEnum):
    """Politique fixée à la **construction** de `PasserelleSimulee`, jamais
    un paramètre d'appel.

    Une vraie passerelle n'a pas de « comportement » à choisir : l'exposer
    sur `initier()` aurait fait fuiter un souci de test dans le contrat
    partagé avec l'appelant, au risque qu'un futur code de production
    s'appuie dessus par accident.
    """

    TOUJOURS_REUSSI = "toujours_reussi"
    TOUJOURS_ECHOUE = "toujours_echoue"
    ALEATOIRE = "aleatoire"


class PasserelleSimulee:
    """Simule une passerelle de paiement.

    `comportement` ne détermine **jamais** ce que retourne `initier()` — une
    vraie passerelle ne résout jamais un paiement dans la même requête que
    son initiation. Il détermine ce que `simuler_confirmation()` produira
    quand on l'appelle, en imitant le webhook qu'un vrai fournisseur
    enverrait plus tard.
    """

    def __init__(
        self,
        comportement: ComportementSimulation = ComportementSimulation.TOUJOURS_REUSSI,
    ) -> None:
        self._comportement = comportement

    def initier(
        self,
        montant: Decimal,
        methode: MethodePaiement,
        fournisseur: FournisseurPaiement,
    ) -> ResultatInitiation:
        return ResultatInitiation(
            reference_externe=f"SIM-{uuid4().hex}",
            statut=StatutPaiement.EN_ATTENTE,
        )

    def verifier_signature(self, charge_utile: bytes, signature: str) -> bool:
        return hmac.compare_digest(signature, self._signer(charge_utile))

    def simuler_confirmation(self, reference_externe: str) -> tuple[bytes, str]:
        """Fabrique l'appel de webhook qu'un vrai fournisseur enverrait pour
        confirmer ou refuser `reference_externe`, selon `comportement`.

        **Hors du contrat `PasserellePaiement`** : un vrai fournisseur ne
        propose jamais de « fabriquer sa propre confirmation », c'est
        justement ce que son webhook fait pour de vrai. Cette méthode
        n'existe que pour piloter la simulation — dans les tests, et dans
        l'écran de paiement le temps qu'un vrai fournisseur soit branché.
        """
        statut = self._resoudre_statut()
        charge_utile = json.dumps(
            {"reference_externe": reference_externe, "statut": statut.value}
        ).encode()
        return charge_utile, self._signer(charge_utile)

    def _resoudre_statut(self) -> StatutPaiement:
        if self._comportement is ComportementSimulation.TOUJOURS_REUSSI:
            return StatutPaiement.REUSSI
        if self._comportement is ComportementSimulation.TOUJOURS_ECHOUE:
            return StatutPaiement.ECHOUE
        return secrets.choice([StatutPaiement.REUSSI, StatutPaiement.ECHOUE])

    def _signer(self, charge_utile: bytes) -> str:
        return hmac.new(_CLE_SIMULEE, charge_utile, hashlib.sha256).hexdigest()
