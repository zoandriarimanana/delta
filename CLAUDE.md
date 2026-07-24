# Delta — Contexte projet pour Claude Code

Plateforme complète (pas un simple site vitrine) : cantine, restauration, formation
(pâtisserie / cuisine), hébergement, location d'espaces, vente de produits
(pâtisserie, boulangerie, confiture, personnalisables), livraison en interne,
commande en ligne (avec ou sans compte).

## Stack technique

- **Backend** : FastAPI, SQLAlchemy (ORM), Alembic (migrations), PostgreSQL
- **Frontend** : React, TypeScript, Tailwind CSS, Axios
- Attention : Alembic n'est **pas** un ORM, c'est l'outil de migrations. L'ORM est
  SQLAlchemy.

## Règles critiques (ne jamais dévier sans le signaler explicitement)

- **SRP stricte** : un fichier = une entité métier, à tous les niveaux (backend :
  models/schemas/repositories/services/routers ; frontend : un dossier
  `features/<module>/` par module, fichiers séparés api/service/hooks/types/pages).
- **Repository générique** : tout repository spécifique hérite de `BaseRepository`
  et n'ajoute que les méthodes qui dépassent le CRUD de base. Ne jamais réécrire
  create/get/list/update/delete à la main.
- **Frontend** : composant/page approchant ~500 lignes → extraction obligatoire
  d'un sous-composant, jamais de fichier fourre-tout.
- **Ne jamais commencer une tâche hors de `docs/roadmap.md`** sans le signaler et
  demander confirmation — le développement suit un ordre de sprints précis à
  cause des dépendances entre modules (ex. `SESSION_FORMATION` dépend de
  `PERSONNEL` déjà en place).
- Toute modification du schéma de données doit se répercuter dans `docs/mld.md`
  ET dans une migration Alembic — jamais l'un sans l'autre.

## Documentation du projet

@docs/mld.md
@docs/architecture.md
@docs/roadmap.md
@CONTRIBUTING.md
