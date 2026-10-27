"""Mise en forme des montants dans le texte indexé.

Lisible par un humain **et** par le modèle d'embeddings : « 25 000 Ar »
plutôt que `Decimal('25000.00')`. Les centimes ne sont écrits que s'ils
existent — l'ariary ne s'en sert pratiquement jamais.
"""

from decimal import Decimal

DEVISE = "Ar"


def formater_ariary(montant: Decimal) -> str:
    entier = montant == montant.to_integral_value()
    texte = f"{montant:,.0f}" if entier else f"{montant:,.2f}"
    # Séparateurs à la française : espace pour les milliers, virgule décimale.
    texte = texte.replace(",", " ").replace(".", ",")
    return f"{texte} {DEVISE}"
