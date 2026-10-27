# Delta — Charte de travail d'équipe

Ce document fixe les règles communes à toute l'équipe pour développer la plateforme Delta
en méthode agile, en cohérence avec l'architecture définie (SRP stricte, repository
générique, découpage par module métier).

---

## 1. Modèle de branches : une seule branche, `main`

**Décision du 27 octobre 2026** (propriétaire du dépôt) : le projet est en
production et ne garde **qu'une branche, `main`** — c'est elle qui tourne sur
le serveur. `develop`, les branches `feature/*`, `fix/*`, `docs/*` et le
circuit branche → PR → `develop` sont **abandonnés** ; leur contenu a été
intégré à `main` (PR #152) ou récupéré avant suppression.

- On **pousse directement sur `main`**. Aucune PR n'est exigée.
- `main` reste protégée contre le **force-push** et la **suppression** : on
  n'efface jamais l'historique de ce qui tourne en production.
- Une branche locale de travail reste possible pour un chantier long, mais
  elle ne vit pas sur GitHub et se fond dans `main` une fois finie.

**Contrepartie assumée : plus rien ne bloque un code cassé avant `main`.** La
CI tourne toujours à chaque push, mais **après coup** : elle signale, elle
n'empêche plus. D'où une règle qui remplace la protection perdue :

> **Rejouer la CI en local (§8) avant chaque `git push`.** Un push sur `main`
> est une mise en production en attente : le prochain `git pull` du serveur
> l'embarque.

Avant de pousser, vérifier ce qui part réellement :

```bash
git fetch origin
git log --oneline origin/main..HEAD    # doit ne montrer que vos commits
git diff --stat origin/main..HEAD      # doit ne montrer que vos fichiers
```

Et ne jamais pousser par `--force` : la protection le refuse, et c'est voulu.

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

## 3. Pull Requests

Plus obligatoires depuis le passage à une seule branche (§1). Une PR vers
`main` reste possible pour faire relire un changement risqué (migration,
`BaseRepository`, authentification) : titre selon la convention des commits,
description *quoi*, *pourquoi*, *comment tester*, et attendre la CI verte
avant de fusionner.

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
- [ ] CI rejouée en local et verte avant le push, puis verte sur GitHub après

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

Pipeline déclenché à chaque push sur `main` (et sur une éventuelle PR vers
`main`) :

1. Installation des dépendances (backend + frontend)
2. Lint backend (`ruff`, `black --check`) + lint frontend (`eslint`)
3. Tests backend (`pytest`) + tests frontend (`vitest`)
4. Build frontend (vérifie que le projet compile)

**Rien n'est plus bloqué** : un push arrive sur `main` même si la CI échoue
ensuite. Un échec se corrige aussitôt par un nouveau commit, avant tout
`git pull` sur le serveur — d'où l'obligation de rejouer la CI en local.

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
