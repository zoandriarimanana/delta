"""Assistant IA générative de Delta (Sprint 12, docs/roadmap.md).

RAG LangChain : le catalogue public est découpé, vectorisé (Hugging Face) et
rangé dans PostgreSQL (pgvector) ; une question remonte les fragments les plus
proches, que le LLM (Groq) reformule en réponse.

Repris d'un module écrit et validé sur un autre projet du même auteur, adapté
à Delta : contenu, prompt, collection, conventions de nommage. Ses dépendances
vivent dans `requirements-ai.txt`, et `Settings.AI_ENABLED` le désactive
entièrement.

Ce que l'index a le droit de contenir est fixé dans `docs/roadmap.md`,
Sprint 12 — catalogue public uniquement, jamais une donnée personnelle, jamais
un prix ou un stock présenté comme un fait.
"""
