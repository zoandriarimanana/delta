"""Texte indexable de chaque entité du catalogue public — un fichier par entité.

Chaque module expose :
- `TYPE_CONTENU`, la valeur de la métadonnée `type_contenu` de ses fragments ;
- `construire_texte(entite)`, le texte confié à l'index ;
- `titre(entite)`, le nom affiché dans les sources d'une réponse ;
- `est_indexable(entite)`, qui dit si l'entité doit y figurer ;
- `synchroniser_<entite>(entite)`, appelé par le service après son `commit`.

Règles communes, fixées dans `docs/roadmap.md` (Sprint 12) :
- **jamais un prix, un stock, un tarif ni un nombre de places** : ces valeurs
  changent à chaque vente, un fragment figé répondrait faux ;
- **jamais le nom d'une personne**, même public : un salarié anonymisé
  resterait nommé dans l'index ;
- **jamais une entité archivée**.
"""
