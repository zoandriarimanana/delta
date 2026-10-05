"""Reconstruit l'index de l'assistant IA depuis la base (Sprint 12).

À lancer au premier déploiement, après un changement de modèle d'embeddings,
ou si l'index a pris du retard (panne d'un fournisseur pendant des
modifications du catalogue) :

    cd backend
    .venv/bin/python -m scripts.reindexer_assistant

Exige `AI_ENABLED=true` et les clés dans `.env`. Sans danger à rejouer :
chaque type de contenu est vidé puis reconstruit.
"""

import sys

from app.ai_langchain.reindexation import reindexer_tout
from app.core.database import SessionLocal
from app.core.exceptions import ServiceIndisponible


def main() -> int:
    with SessionLocal() as db:
        try:
            resultats = reindexer_tout(db)
        except ServiceIndisponible as erreur:
            print(f"Réindexation impossible : {erreur}", file=sys.stderr)
            return 1
    for type_contenu, compte in resultats.items():
        print(
            f"{type_contenu:<20} {compte['elements']:>4} élément(s)"
            f"  {compte['fragments']:>4} fragment(s)"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
