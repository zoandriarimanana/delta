"""Public d'un fragment de l'index (Sprint 12, 12.8/12.10).

L'assistant du site ne recherche que `AUDIENCE_CLIENT` : un fragment
`AUDIENCE_PERSONNEL` ne peut jamais ressortir dans la bulle publique. Le
catalogue et le guide client sont `client`.

Module à part, **sans aucun import de LangChain** : les textes d'entités en
ont besoin, et les services les importent en permanence — y compris sur un
déploiement sans `requirements-ai.txt`.
"""

AUDIENCE_CLIENT = "client"
AUDIENCE_PERSONNEL = "personnel"
