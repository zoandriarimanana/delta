"""Journalisation applicative.

Point d'entrée unique pour obtenir un logger, plutôt qu'un
`logging.getLogger(__name__)` éparpillé : tous les loggers de l'application
vivent sous l'espace de noms `delta`, ce qui permet de régler leur niveau ou
leur sortie en un seul endroit, sans toucher à ceux d'uvicorn ni des
bibliothèques.

Introduit pour l'assistant IA (Sprint 12), dont l'indexation ne doit jamais
faire échouer l'action d'un administrateur : ses pannes ne remontent pas en
exception, elles doivent donc au moins laisser une trace.
"""

import logging

ESPACE_DE_NOMS = "delta"


def get_logger(nom: str) -> logging.Logger:
    """Retourne le logger `delta.<nom>`.

    `nom` est en pratique le `__name__` du module appelant ; le préfixe `app.`
    est retiré pour ne pas l'écrire deux fois (`delta.ai_langchain...`).
    """
    nom_court = nom.removeprefix("app.")
    return logging.getLogger(f"{ESPACE_DE_NOMS}.{nom_court}")
