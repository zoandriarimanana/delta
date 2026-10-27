"""Applique une passe d'expiration des impayés, à la demande.

    cd backend && .venv/bin/python -m scripts.expirer_impayes

Même passe que la tâche périodique du serveur (`EXPIRATION_AUTOMATIQUE`) :
commandes non payées après `COMMANDE_DELAI_PAIEMENT_MINUTES`, réservations
sans acompte après `RESERVATION_DELAI_ACOMPTE_HEURES`. Utile si le serveur
tourne avec la tâche coupée, ou pour vérifier ce qu'une passe annulerait.
"""

from app.core.database import SessionLocal
from app.services.expiration_service import ExpirationService


def main() -> None:
    db = SessionLocal()
    try:
        bilan = ExpirationService(db).expirer()
    finally:
        db.close()
    print(f"Commandes annulées : {bilan.commandes or 'aucune'}")
    print(f"Réservations annulées : {bilan.reservations or 'aucune'}")


if __name__ == "__main__":
    main()
