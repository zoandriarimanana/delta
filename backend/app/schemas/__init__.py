"""Schemas Pydantic : validation d'entrée et sérialisation de sortie.

Miroir de `app/models/` — un fichier par entité, plus `auth.py` pour les charges
utiles propres au parcours d'authentification, qui traversent deux entités
(`CLIENT` et `CLIENT_PARTICULIER`) et n'appartiennent donc à aucune des deux.
Aucune logique métier ici.
"""
