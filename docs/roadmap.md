# Delta — Roadmap agile (sprints à taille variable)

Ordre de priorisation : dépendances techniques d'abord, puis cœur transactionnel,
puis modules métier du plus généraliste au plus spécifique, paiement en ligne et
back-office avancé en dernier.

**Sprint courant : Sprint 1.** Mettre à jour cette ligne à chaque changement de sprint.

Avant de commencer une tâche : vérifier la Definition of Ready dans `CONTRIBUTING.md`.
Avant de clore une tâche : vérifier la Definition of Done dans `CONTRIBUTING.md`.

**Règle de persistance du plan** : dès qu'un découpage détaillé de sprint est validé,
il est écrit ici *avant* la première ligne de code, sous la section du sprint concerné.
Un plan qui n'existe que dans une conversation est un plan perdu.

---

## Sprint 0 — Fondations techniques

- [x] Structure du repo backend (FastAPI) : `routers/` / `services/` / `repositories/` / `models/` / `schemas/`
- [x] Connexion PostgreSQL + modèles SQLAlchemy à partir des 20 tables du MLD (`docs/mld.md`)
- [x] `base_repository.py` générique (CRUD de base)
- [x] Initialisation Alembic + migration de base (schéma complet)
- [x] Configuration environnement (`.env`, `pydantic-settings`)
- [x] Authentification JWT (inscription/connexion `CLIENT_PARTICULIER`)
- [x] Structure du repo frontend (React + Vite + Tailwind)
- [x] Client Axios centralisé (base URL, intercepteur token, gestion erreurs)
- [x] Squelette de layout (navigation, pages vides)

### Découpage détaillé validé (T0.1 → T0.11)

Ordre d'implémentation contraint par les dépendances. Un arrêt de validation par tâche.

- [x] **T0.1 — Configuration environnement** : `core/config.py`, `.env`, `.env.example`,
      `pyproject.toml`, `.gitignore`. En premier, tout en dépend.
- [x] **T0.2 — Connexion base & socle SQLAlchemy** : `core/database.py` (engine,
      `SessionLocal`, `Base`, `get_db`). Après T0.1.
- [x] **T0.3 — Modèles SQLAlchemy des 20 tables** : `models/`, un fichier par entité,
      ordre : tables sans FK sortante d'abord, puis les dépendantes. Mapping
      `CLIENT_PARTICULIER` / `CLIENT_ENTREPRISE` en 1-1 explicite (pas de polymorphisme
      SQLAlchemy natif). `CheckConstraint` `RESERVATION` et `AVIS` posées ici.
- [x] **T0.4 — `BaseRepository` générique** : `repositories/base_repository.py`,
      générique typé, `create` / `get_by_id` / `list` / `update` / `delete` uniquement.
      Après T0.3.
- [x] **T0.5 — Init Alembic + migration de base** : après T0.3/T0.4. `env.py` doit
      importer `app.models`. Relire la migration générée à la main.
- [x] **T0.6 — Auth JWT (`CLIENT_PARTICULIER` uniquement)** : `security.py`, schemas,
      `client_repository.py`, `auth_service.py`, `auth_router.py`. Après T0.4.
- [ ] **T0.7 — Trigger d'exclusivité `CLIENT`** *(reporté — voir section Dette
      technique)* : **REPORTÉ pour ce sprint.** Garde
      uniquement la validation applicative dans `auth_service` (création `CLIENT` +
      ligne fille dans une seule transaction). Voir « Dette technique » en fin de
      document.
- [x] **T0.8 — `main.py`** : assemble uniquement les routers, CORS, `auth_router`
      seulement à ce stade. Après T0.6.
- [x] **T0.9 — Structure frontend** : `package.json`, `vite.config.ts`, `tsconfig.json`
      (`strict: true`), `tailwind.config.js`, eslint/prettier.
- [x] **T0.10 — Client Axios centralisé** : `lib/axiosClient.ts`, intercepteurs token
      + gestion 401.
- [x] **T0.11 — Squelette de layout** : nav, pages vides, react-router. Pas de dossiers
      `features/` métier à ce stade.

## Sprint 1 — Comptes clients & catalogue produits

- [ ] CRUD `CATEGORIE_PRODUIT`, `PRODUIT` (admin)
- [ ] Inscription/connexion `CLIENT_ENTREPRISE` (distinct du particulier)
- [ ] Catalogue public : liste + fiche produit (React)
- [ ] Recherche / filtre par catégorie

## Sprint 2 — Commande & panier (cœur transactionnel)

- [ ] Création `COMMANDE` + `LIGNE_COMMANDE`, calcul `montant_total`
- [ ] Parcours commande invité (sans compte) vs connecté
- [ ] Panier + tunnel de commande (React)
- [ ] Historique des commandes du client

## Sprint 3 — Personnel, personnalisation & livraison

- [ ] `PERSONNEL` : CRUD générique **complet** (toutes fonctions : Formateur, Livreur,
      Cuisinier, Réceptionniste) — **à traiter en premier dans ce sprint**, car
      `SESSION_FORMATION` (sprint 4) en dépend
- [ ] `DEMANDE_PERSONNALISATION` rattachée à une ligne de commande
- [ ] `LIVRAISON` : création automatique si commande livrable, affectation livreur
      — ⚠️ la cohérence fonction du personnel (Formateur/Livreur) doit être vérifiée
      dans le service au moment de l'affectation, ce n'est pas garanti par la FK.
      `LIVRAISON.#id_personnel` pointe vers `PERSONNEL` tout entier : rien en base
      n'empêche d'affecter un cuisinier à une livraison.
- [ ] Suivi de statut livraison côté client

## Sprint 4 — Formation

- [ ] CRUD `DOMAINE_FORMATION`, `FORMATION`, `SESSION_FORMATION` (admin)
      — ⚠️ la cohérence fonction du personnel (Formateur/Livreur) doit être vérifiée
      dans le service au moment de l'affectation, ce n'est pas garanti par la FK.
      `SESSION_FORMATION.#id_formateur` pointe vers `PERSONNEL` tout entier : rien en
      base n'empêche d'affecter un livreur comme formateur.
- [ ] `RESERVATION` type = Formation, décrément `places_restantes`
- [ ] Option hébergement liée à une réservation formation
- [ ] Catalogue et réservation formation (React)

## Sprint 5 — Salle & logement

- [ ] CRUD `SALLE`, `LOGEMENT` (admin)
- [ ] `RESERVATION` type = Salle / Logement + vérification de chevauchement de dates
- [ ] Interface de réservation (React)

## Sprint 6 — Restauration sur place

- [ ] `RESERVATION` type = Table
- [ ] Lien `RESERVATION → COMMANDE` (le client réserve, puis commande sur place)
- [ ] Interface simplifiée côté personnel pour prise de commande sur place

## Sprint 7 — Abonnement cantine (B2B)

- [ ] `ABONNEMENT`, `BENEFICIAIRE`, `CONSOMMATION_REPAS`
- [ ] Gestion des deux modes (`mode_suivi`, `type_facturation`)
- [ ] Interface admin : gestion des abonnements entreprise + suivi de consommation

## Sprint 8 — Avis clients

- [ ] `AVIS` (produit / service), contrôle : uniquement si statut Livrée/Honorée
- [ ] Affichage note moyenne sur fiche produit / page service

## Sprint 9 — Paiement en ligne *(reporté, non prioritaire au départ)*

- [ ] Intégration passerelle (carte + mobile money)
- [ ] Webhook de confirmation, mise à jour statut commande

## Sprint 10 — Back-office avancé & reporting

- [ ] Interface complète de gestion `PERSONNEL` (tableau de bord — le CRUD de base
      est déjà fait au sprint 3, ne pas le refaire)
- [ ] Tableau de bord commandes/réservations/abonnements

---

## Règle transverse — suppression d'une entité référencée

Toute suppression d'une entité référencée par une FK NOT NULL doit être catchée
côté service (`IntegrityError` → message métier propre), à traiter dans le sprint
qui implémente le CRUD delete de cette entité.

Les FK NOT NULL du schéma sont en `ON DELETE RESTRICT` : PostgreSQL **refuse** la
suppression du parent au lieu de tenter un SET NULL impossible. Le service ne doit
donc jamais laisser remonter l'erreur brute — il traduit « cette catégorie contient
encore des produits », pas une trace SQL. La liste des FK concernées est figée par
`backend/tests/test_schema_integrity.py`.

## Dette technique

Report assumé, à résorber avant mise en production. Toute dette ajoutée ici doit
nommer sa tâche d'origine et sa condition de résorption.

| Origine | Dette | Condition de résorption |
|---|---|---|
| T0.10 (Sprint 0) | Le jeton d'accès est stocké en `localStorage` (`frontend/src/lib/tokenStorage.ts`) : lisible par tout script de la page, donc exfiltrable en cas de faille XSS. | Basculer sur un cookie `httpOnly` + `SameSite`, ce qui suppose de faire émettre le cookie par l'API et d'ajouter une protection CSRF. **À arbitrer avant mise en prod.** |
| T0.6 (Sprint 0) | Aucune limitation de tentatives sur `/auth/connexion` : ni rate limiting par IP, ni verrouillage temporaire du compte après N échecs. Le hachage bcrypt ralentit une attaque par force brute sans l'empêcher, et rien ne freine le bourrage d'identifiants (credential stuffing). | Ajouter une limitation de débit et un verrouillage progressif. **À traiter avant mise en prod.** |
| T0.5 (Sprint 0) | `docker-compose.yml` lit `backend/.env` via `env_file` : le conteneur postgres reçoit donc aussi `SECRET_KEY` et `DATABASE_URL`, dont il n'a aucun usage. Surface d'exposition inutile. | Séparer les identifiants du compose dans un `.env` dédié, dès qu'un second service rejoint l'infrastructure — et **au plus tard avant mise en prod**. |
| T0.7 (Sprint 0) | Exclusivité `CLIENT` (`CLIENT_PARTICULIER` xor `CLIENT_ENTREPRISE`) garantie uniquement au niveau applicatif, dans `auth_service`. L'invariant est contournable par tout écrivain qui ne passe pas par l'API : import SQL, script de seed, correction manuelle en base. | Ajouter le trigger PL/pgSQL prévu par `docs/mld.md` (contrainte n°1) dans une migration Alembic dédiée. **À durcir avant mise en prod.** |

## Traçabilité MLD → sprints (à retenir)

Chaque table du MLD doit être couverte par au moins un sprint avant qu'on considère
la roadmap close. Toute table ajoutée au MLD après coup doit immédiatement être
ajoutée à un sprint ici — ne jamais laisser une table orpheline.
