# Delta — Roadmap agile (sprints à taille variable)

Ordre de priorisation : dépendances techniques d'abord, puis cœur transactionnel,
puis modules métier du plus généraliste au plus spécifique, paiement en ligne et
back-office avancé en dernier.

**Sprint courant : Sprint 3.** Mettre à jour cette ligne à chaque changement de sprint.

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

- [x] CRUD `CATEGORIE_PRODUIT`, `PRODUIT` (admin)
- [x] Inscription/connexion `CLIENT_ENTREPRISE` (distinct du particulier)
- [x] Catalogue public : liste + fiche produit (React)
- [x] Recherche / filtre par catégorie

## Sprint 2 — Commande & panier (cœur transactionnel)

- [x] Création `COMMANDE` + `LIGNE_COMMANDE`, calcul `montant_total`
- [x] Parcours commande invité (sans compte) vs connecté
- [x] Panier + tunnel de commande (React)
- [x] Historique des commandes du client

`COMMANDE.date_commande` a été ajoutée pendant ce sprint : le MLD n'en portait
aucune, et l'historique se triait faute de mieux sur `id_commande`. Ce n'était
pas une omission de transcription mais un manque réel du dictionnaire de données
d'origine — voir `docs/mld.md`.

## Sprint 3 — Personnel, personnalisation & livraison

- [x] `PERSONNEL` : CRUD générique **complet** (toutes fonctions : Formateur, Livreur,
      Cuisinier, Réceptionniste) — **à traiter en premier dans ce sprint**, car
      `SESSION_FORMATION` (sprint 4) en dépend
      — `fonction` est devenue un **domaine formel** (`StrEnum` + `CHECK`) et non
      plus une chaîne libre, et `est_administrateur` a été ajouté : les deux
      règles d'affectation ci-dessous comparent `fonction`, et une chaîne libre
      les aurait laissées passer à côté. Voir `docs/mld.md`.
      — **Promotion à administrateur non exposée par API** : ni `PersonnelCreate`
      ni `PersonnelUpdate` ne portent `est_administrateur` ou `mot_de_passe`. Le
      seul chemin est le script d'amorçage `backend/scripts/creer_admin.py`
      (cf. `docs/architecture.md`), en attendant une route dédiée et protégée
      par `get_current_personnel_administrateur` en #23.
- [x] Authentification `PERSONNEL` : revendication `type` dans le jeton,
      `get_current_personnel` et `get_current_personnel_administrateur`,
      `PersonnelService.anonymiser()`
      — les deux dettes du Sprint 1 sont levées : les écritures du catalogue
      produit sont désormais réservées aux administrateurs, et `PERSONNEL`
      dispose de son anonymisation.
      — `CLIENT` et `PERSONNEL` ont des clés primaires qui se recouvrent : sans
      la revendication `type`, leurs jetons seraient indiscernables. Chaque
      dépendance rejette le jeton de l'autre.
- [x] `DEMANDE_PERSONNALISATION` rattachée à une ligne de commande
      — **Limite assumée, et non une dette** : une personnalisation se crée
      **uniquement à la création de la commande**, dans la même transaction que
      sa ligne, et son supplément entre dans le calcul unique de
      `montant_total`. Aucun endpoint ne permet d'en ajouter ni d'en modifier
      une après coup. Autoriser l'ajout a posteriori obligerait soit à laisser
      le client payer un supplément invisible dans son montant, soit à
      recalculer `montant_total`, qui est une **donnée d'archive** figée à la
      création (cf. `docs/mld.md`). Ce n'est pas un report : c'est un arbitrage,
      il n'appelle aucune résorption.
      — `supplement_prix` n'est **pas accepté depuis la requête**, pour la même
      raison que `prix_unitaire_applique` : il suffirait d'envoyer `0` pour
      obtenir une personnalisation gratuite. Il est lu sur
      `PRODUIT.supplement_personnalisation`, tarif fixé au catalogue par un
      administrateur, puis recopié et figé. Un `CHECK` garantit qu'un produit
      personnalisable en porte toujours un — voir `docs/mld.md`.
- [x] `LIVRAISON` : création automatique si commande livrable, affectation livreur
      — la cohérence de fonction **est** vérifiée dans le service
      (`LivraisonService.affecter_livreur`), la FK ne la garantissant pas :
      `LIVRAISON.#id_personnel` pointe vers `PERSONNEL` tout entier.
      — **Le déclencheur est `COMMANDE.adresse_livraison`**, et lui seul. Ni
      `type_commande` ni `PRODUIT.est_livrable` ne décident à la place du
      client : ils ne servent qu'à refuser une demande incohérente (422).
      — `LIVRAISON.date_heure_prevue` est devenue **nullable**. La livraison naît
      avec la commande, alors qu'aucune tournée n'est planifiée ; la garder
      obligatoire forçait à inventer une date, donc à écrire une promesse que
      rien ne garantit.
      — **Synchronisation LIVRAISON → COMMANDE** à sens unique : seul le
      passage à `Livree` fait avancer `COMMANDE.statut`. `Echouee` ne bascule
      pas vers `Annulee` — relancer, rembourser ou annuler sont des décisions
      humaines, et ces actions relèvent d'un futur module de gestion
      administrative des commandes. Manque **volontaire**, pas une dette : #25
      se contente de ne pas casser la cohérence en l'attendant. Règle écrite
      dans `docs/architecture.md`.
- [x] Suivi de statut livraison, backend **et** React — `LivraisonPublique`
      n'expose que le statut et les dates, jamais le livreur ni l'adresse, et
      `features/livraison/` ne déclare même pas ces champs. La page publique
      accessible par `reference_publique` et l'historique connecté partagent le
      **même** composant : une seconde implémentation divergerait, et c'est sur
      la page sans authentification qu'une divulgation serait la plus grave.

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

**Cette règle a changé avec l'arrivée du soft delete. La version précédente
affirmait que « PostgreSQL refuse la suppression du parent » : c'est faux dès
qu'on archive au lieu de supprimer.**

Trois chemins coexistent désormais, et ils n'ont pas les mêmes garanties.

| Chemin | Ce que fait la base | Qui protège |
|---|---|---|
| `delete()` — archivage | `UPDATE supprime_le` | **personne** : le service, et lui seul |
| `supprimer_definitivement()` | `DELETE` réel | PostgreSQL, via `ON DELETE RESTRICT` |
| `ClientService.anonymiser()` | `UPDATE` des colonnes personnelles | sans objet : rien n'est supprimé |

**Le point à retenir : un archivage est un `UPDATE`.** Ni les `ON DELETE
RESTRICT` ni les `ON DELETE CASCADE` ne se déclenchent. La base n'empêche donc
plus d'archiver une catégorie qui contient des produits, et n'archive pas non
plus les lignes d'une commande archivée. Ces deux responsabilités — refuser, et
propager — passent intégralement aux services :

- **Refuser** : avant d'archiver un parent, compter ses enfants **actifs** et
  lever un `ConflitMetier`. Un simple `count()` sans filtre sur `supprime_le`
  compterait des enfants déjà archivés et bloquerait à tort.
- **Propager** : archiver explicitement les enfants dans la même transaction, là
  où le schéma prévoyait un `CASCADE`. Quatre FK sont concernées :
  `client_particulier` et `client_entreprise` → `client`, `ligne_commande` →
  `commande`, `demande_personnalisation` → `ligne_commande`.

L'interception de l'`IntegrityError` reste nécessaire, mais comme **filet de
course** : entre le comptage et le `commit`, un enfant a pu apparaître. Le
service traduit alors « cette catégorie contient encore des produits », jamais
une trace SQL. Elle redevient la protection principale sur
`supprimer_definitivement()`, seul chemin où la base tranche encore.

La liste des FK et leurs politiques est figée par
`backend/tests/test_schema_integrity.py`.

## Dette technique

Report assumé, à résorber avant mise en production. Toute dette ajoutée ici doit
nommer sa tâche d'origine et sa condition de résorption.

| Origine | Dette | Condition de résorption |
|---|---|---|
| Sprint 3 (#26) | L'historique émet **une requête de suivi par commande listée** : `HistoriqueCommandesPage` monte un `EncartSuiviCommande` par ligne, et chacun appelle `GET /commandes/{id}/livraison`. Trente commandes affichées font trente requêtes, dont la plupart répondent 404 pour des commandes à retirer. | Inclure le suivi de livraison dans la charge utile de `GET /commandes`, ce qui supprime les appels séparés. À faire **si l'historique devient un point de lenteur réel**, ou lors d'un futur sprint de performance — pas avant : la correction déplace une décision de confidentialité vers un schema qui sert aussi d'autres usages. |
| Sprint 2 (parcours invité) | Une commande passée en invité ne peut pas être rattachée à un compte créé ensuite : le client la perd de vue dès qu'il s'inscrit, alors qu'elle porte le même `contact_invite`. Écarté volontairement du sprint 2. | Le rattachement suppose de faire confiance à une adresse non vérifiée. À traiter avec un mécanisme de vérification d'e-mail, qui n'existe nulle part dans le projet — donc pas avant qu'il soit décidé. |
| T0.10 (Sprint 0) | Le jeton d'accès est stocké en `localStorage` (`frontend/src/lib/tokenStorage.ts`) : lisible par tout script de la page, donc exfiltrable en cas de faille XSS. | Basculer sur un cookie `httpOnly` + `SameSite`, ce qui suppose de faire émettre le cookie par l'API et d'ajouter une protection CSRF. **À arbitrer avant mise en prod.** |
| T0.6 (Sprint 0) | Aucune limitation de tentatives sur `/auth/connexion` : ni rate limiting par IP, ni verrouillage temporaire du compte après N échecs. Le hachage bcrypt ralentit une attaque par force brute sans l'empêcher, et rien ne freine le bourrage d'identifiants (credential stuffing). | Ajouter une limitation de débit et un verrouillage progressif. **À traiter avant mise en prod.** |
| T0.5 (Sprint 0) | `docker-compose.yml` lit `backend/.env` via `env_file` : le conteneur postgres reçoit donc aussi `SECRET_KEY` et `DATABASE_URL`, dont il n'a aucun usage. Surface d'exposition inutile. | Séparer les identifiants du compose dans un `.env` dédié, dès qu'un second service rejoint l'infrastructure — et **au plus tard avant mise en prod**. |
| T0.7 (Sprint 0) | Exclusivité `CLIENT` (`CLIENT_PARTICULIER` xor `CLIENT_ENTREPRISE`) garantie uniquement au niveau applicatif, dans `auth_service`. L'invariant est contournable par tout écrivain qui ne passe pas par l'API : import SQL, script de seed, correction manuelle en base. | Ajouter le trigger PL/pgSQL prévu par `docs/mld.md` (contrainte n°1) dans une migration Alembic dédiée. **À durcir avant mise en prod.** |

## Traçabilité MLD → sprints (à retenir)

Chaque table du MLD doit être couverte par au moins un sprint avant qu'on considère
la roadmap close. Toute table ajoutée au MLD après coup doit immédiatement être
ajoutée à un sprint ici — ne jamais laisser une table orpheline.
