# Delta — Charte de travail d'équipe

Ce document fixe les règles communes à toute l'équipe pour développer la plateforme Delta
en méthode agile, en cohérence avec l'architecture définie (SRP stricte, repository
générique, découpage par module métier).

---

## 1. Modèle de branches

| Branche | Rôle |
|---|---|
| `main` | Code de production. Toujours stable et déployable. Jamais de commit direct. |
| `develop` | Branche d'intégration de tous les sprints en cours. |
| `feature/<sprint>-<module>-<description>` | Une fonctionnalité, un module. |
| `fix/<module>-<description>` | Correction de bug hors urgence. |
| `hotfix/<description>` | Correction urgente directement sur `main`, puis répercutée sur `develop`. |

**Exemples** :
```
feature/sprint2-commande-creation
feature/sprint4-formation-session
fix/produit-validation-prix
hotfix/livraison-statut-bloque
```

Règle d'or : **une branche = un seul module métier**, sauf pour les tâches du Sprint 0
(fondations transverses).

### Point de départ obligatoire : `origin/develop`, jamais la `develop` locale

```bash
git fetch origin && git checkout -b feature/sprintN-module-description origin/develop
```

Et **non** `git checkout -b <branche> develop`.

La différence n'est pas cosmétique. Une `develop` locale peut diverger
**silencieusement** — travail exploratoire non poussé, autre outil, autre
session ouverte sur le même dépôt — et rien ne le signale au moment de brancher.
La nouvelle branche embarque alors ces commits, la PR les présente comme siens,
et le mélange n'est attrapé qu'en aval, par la CI, sur des fichiers que l'auteur
n'a jamais touchés.

C'est arrivé : une PR de documentation d'une ligne s'est retrouvée à porter onze
commits de refonte visuelle et à échouer sur `prettier --check`, pour du code
qui n'était pas le sien. La CI a fait son travail — elle a arrêté le mélange
avant `develop` — mais le diagnostic a coûté plus cher que la règle.

Partir de `origin/develop` rend la divergence **impossible à embarquer par
accident** : la branche naît exactement de ce que le dépôt distant contient, qui
est aussi la base contre laquelle la PR sera comparée.

Avant d'ouvrir une PR, vérifier ce qu'elle apporte réellement :

```bash
git log --oneline origin/develop..HEAD    # doit ne montrer que vos commits
git diff --stat origin/develop..HEAD      # doit ne montrer que vos fichiers
```

---

## 2. Convention de commits (Conventional Commits)

```
<type>(<scope>): <description courte à l'impératif>
```

- **Types** : `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`
- **Scope** : nom du module concerné (`salle`, `produit`, `reservation`, `abonnement`...)
  — ça rend l'historique Git directement lisible par module, comme le code.

**Exemples** :
```
feat(salle): ajoute la verification de disponibilite
fix(commande): corrige le calcul du montant_total
refactor(reservation): extrait la logique d'exclusivite dans le service
test(produit): ajoute les tests du repository
```

---

## 3. Règles de Pull Request

- **Une PR = une tâche de sprint = un module.** Pas de PR touchant plusieurs entités
  métier à la fois (sauf Sprint 0).
- Titre de PR = même convention que les commits.
- Description obligatoire : *quoi*, *pourquoi*, *comment tester*.
- Lien vers l'issue GitHub correspondante (voir §10).
- **Revue obligatoire** : au moins 1 relecteur avant merge (2 si la PR touche une
  dépendance partagée, ex. `BaseRepository`).
- **CI verte obligatoire** avant merge — aucune exception.
- Stratégie de merge : *squash and merge* vers `develop` (historique propre, un commit
  = une PR).
- Suppression de la branche après merge.

---

## 4. Definition of Ready (avant de commencer une tâche)

- [ ] Table(s) du MLD concernée(s) clairement identifiée(s)
- [ ] Dépendances (autres modules requis) déjà livrées ou explicitement notées comme bloquantes
- [ ] Critères d'acceptation écrits noir sur blanc dans l'issue

## 5. Definition of Done (avant de clore une tâche)

- [ ] Code respecte la SRP (repository/service/router séparés, un fichier par entité)
- [ ] Le repository spécifique hérite de `BaseRepository`, ne redéfinit que le nécessaire
- [ ] Tests unitaires écrits et passants
- [ ] Migration Alembic générée et testée si le schéma a changé
- [ ] Lint backend (`ruff` + `black`) et frontend (`eslint` + `prettier`) sans erreur
- [ ] Docstring / commentaire minimal sur les méthodes non triviales
- [ ] PR revue, approuvée, CI verte, mergée

---

## 6. Standards de code

### Backend (Python / FastAPI)
- Formatter : `black`
- Linter : `ruff`
- Tri des imports : `ruff` (isort intégré)
- Type hints obligatoires sur toutes les fonctions et méthodes publiques
- Docstring obligatoire sur chaque méthode ajoutée dans un repository/service spécifique

### Frontend (React / TypeScript / Tailwind)
- Formatter : `prettier`
- Linter : `eslint` (règles strictes, `no-unused-vars`, `react-hooks/exhaustive-deps`)
- `strict: true` dans `tsconfig.json`
- `noUncheckedIndexedAccess: true` en plus de `strict: true` : un accès indexé
  (`tableau[0]`, `objet[cle]`) est typé `T | undefined` et doit être traité.
  C'est ce qui attrape les accès hors bornes et les clés absentes, que `strict`
  seul laisse passer. Règle d'équipe, pas une option laissée au hasard d'un
  fichier de config.
- Un composant = un fichier. Page approchant ~500 lignes → extraction obligatoire
  d'un sous-composant dans le module concerné.

---

## 7. Tests

- **Backend** : `pytest`, un fichier de test miroir par repository/service
  (`test_salle_repository.py`, `test_salle_service.py`...). Couverture visée : 70 %
  minimum sur la couche `services/` (logique métier).
- **Frontend** : tests sur les hooks et la logique métier critique
  (`vitest` + `react-testing-library`) — pas d'obligation de couvrir 100 % des
  composants purement visuels.

---

## 8. Intégration continue (GitHub Actions)

Pipeline déclenché à chaque Pull Request vers `develop` :

1. Installation des dépendances (backend + frontend)
2. Lint backend (`ruff`, `black --check`) + lint frontend (`eslint`)
3. Tests backend (`pytest`) + tests frontend (`vitest`)
4. Build frontend (vérifie que le projet compile)

**Le merge est bloqué si une seule étape échoue.**

### Rejouer la CI en local avant de pousser

Les commandes ci-dessous sont **exactement** celles de
`.github/workflows/ci.yml`. Les rejouer intégralement avant de pousser, sans en
retirer un répertoire ni une étape.

Backend, depuis `backend/` (préfixer par `.venv/bin/` selon l'installation) :

```bash
ruff check app tests alembic
black --check app tests alembic
alembic upgrade head        # sur une base VIERGE, pas celle de développement
alembic check
pytest -q
```

Frontend, depuis `frontend/` :

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

**Les répertoires font partie de la commande.** `ruff check app tests` passe là
où `ruff check app tests alembic` échoue : un fichier de migration mal trié
n'est vu que par la seconde. C'est arrivé — la PR #69 a échoué sur un `I001`
dans une migration après une vérification locale annoncée verte.

Et comme le lint s'arrête au premier échec, **rien de ce qui suit ne tourne** :
migration et tests restent inconnus. Vérifier un sous-ensemble puis conclure
« c'est vert » est pire que ne rien vérifier, cela transforme une incertitude en
fausse certitude.

**`alembic upgrade head` se joue sur une base vierge**, comme en CI, et jamais
sur la base de développement : celle-ci peut porter des données de seed qui font
échouer des tests sans que le code soit en cause (voir #68). Devant un échec
local, le reproduire sur une base neuve avant de conclure :

```bash
docker compose exec postgres psql -U delta_user -d postgres -c "CREATE DATABASE delta_ci_local OWNER delta_user;"
DATABASE_URL="postgresql+psycopg2://delta_user:...@localhost:5433/delta_ci_local" alembic upgrade head
DATABASE_URL="..." pytest -q
```

Ne pas composer ces commandes de mémoire : `.github/workflows/ci.yml` en est la
seule source de vérité, et c'est lui qui décide du merge.

---

## 9. Gestion des tâches (GitHub Projects)

- Un tableau Kanban : `Backlog` → `Sprint courant` → `En cours` → `En revue` → `Terminé`
- Chaque **sprint** défini dans la checklist devient un **Milestone** GitHub
- Chaque ligne de checklist devient une **Issue**, taguée :
  - par module (`label: salle`, `label: produit`, `label: reservation`...)
  - par type (`label: backend`, `label: frontend`)
  - rattachée au Milestone du sprint correspondant

---

## 10. Rappel des règles d'architecture (SRP)

- **Backend** : un fichier = une entité, à chaque niveau (`models/`, `schemas/`,
  `repositories/`, `services/`, `routers/`). Aucun fichier ne mélange deux entités.
- **Frontend** : un dossier `features/<module>/` par module métier, avec fichiers
  séparés (`*.api.ts`, `*.service.ts`, `*.hooks.ts`, `*.types.ts`, `pages/`).
- Le `BaseRepository` porte tout le CRUD générique. Les repositories spécifiques
  n'ajoutent que ce qui dépasse (ex. `verifier_disponibilite` pour `SALLE`).

---

## 11. Rituels agile (recommandés)

- **Daily** (15 min) : avancement, bloquants
- **Revue de sprint** : démonstration des tâches passées en `Terminé`
- **Rétrospective** : ce qui a bien/mal fonctionné, ajustements pour le sprint suivant
