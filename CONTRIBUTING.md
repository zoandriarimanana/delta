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
