"""Abstraction de la passerelle de paiement (carte / mobile money).

Une seule implémentation existe pour l'instant — `PasserelleSimulee`
(`app/services/passerelle_paiement_simulee.py`) — en attendant les accès
réels aux API des fournisseurs (Mvola, Orange Money, Airtel Money, Stripe),
demandés mais non encore obtenus au moment d'ouvrir le Sprint 9. Rien dans le
code appelant ne doit jamais référencer une implémentation par son nom :
c'est ce contrat, et lui seul, qui doit suffire à écrire un service ou un
test — voir `tests/test_passerelle_paiement_contrat.py`, exécutée contre
chaque implémentation disponible.
"""

from __future__ import annotations

from decimal import Decimal
from typing import NamedTuple, Protocol

from app.models.paiement import FournisseurPaiement, MethodePaiement, StatutPaiement


class ResultatInitiation(NamedTuple):
    """Résultat renvoyé par une passerelle à l'initiation d'un paiement.

    `statut` vaut toujours `En_attente` — carte comme mobile money confirment
    de façon **asynchrone**, jamais dans la même requête que l'initiation.
    C'est une garantie du contrat, pas un détail de `PasserelleSimulee` :
    la synchronisation `PAIEMENT → COMMANDE` (cf. `docs/mld.md`) dépend d'une
    confirmation ultérieure, par webhook.
    """

    reference_externe: str
    statut: StatutPaiement


class PasserellePaiement(Protocol):
    """Contrat que toute passerelle de paiement doit honorer.

    Un `Protocol` plutôt qu'une classe abstraite : aucune implémentation n'a
    besoin d'en hériter explicitement, ce qui évite qu'un appelant soit
    tenté d'importer `PasserelleSimulee` pour son type au lieu de ce contrat.
    """

    def initier(
        self,
        montant: Decimal,
        methode: MethodePaiement,
        fournisseur: FournisseurPaiement,
    ) -> ResultatInitiation:
        """Initie un paiement auprès du fournisseur, retourne sa référence
        externe. Le statut retourné est toujours `En_attente` : la
        confirmation arrive plus tard, par webhook."""
        ...

    def verifier_signature(self, charge_utile: bytes, signature: str) -> bool:
        """Vérifie qu'un appel de webhook reçu provient bien du fournisseur.

        Sans cette vérification, n'importe qui connaissant l'URL du webhook
        pourrait confirmer un paiement à sa place — elle n'est donc pas
        optionnelle, y compris en simulation.
        """
        ...
