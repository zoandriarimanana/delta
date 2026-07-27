# Delta — Architecture technique

Stack : **FastAPI + SQLAlchemy (ORM) + Alembic (migrations) + PostgreSQL** côté backend,
**React + TypeScript + Tailwind + Axios** côté frontend.

## Règle non négociable : SRP (Single Responsibility Principle)

Un fichier ne traite jamais deux entités différentes, à aucun niveau de la stack.
Si un doute survient sur où placer du code, la question à se poser est : "ce code
concerne-t-il une seule entité métier, ou plusieurs ?" Si plusieurs : c'est un
signe qu'il faut soit un fichier par entité avec une couche d'orchestration à part,
soit repenser le découpage.

## Base de données locale (Docker)

Le `docker-compose.yml` à la racine fournit un PostgreSQL 16 de développement,
exposé sur **`localhost:5433`** — l'adresse attendue par le `DATABASE_URL` de
`backend/.env.example`. Le port 5433 et non 5432 : un PostgreSQL installé sur la
machine occupe généralement 5432, et il n'a pas à être arrêté pour Delta.

```bash
docker compose up -d --wait   # démarre postgres et attend qu'il soit prêt
docker compose logs -f postgres
docker compose down           # arrête (les données survivent)
docker compose down -v        # arrête ET efface le volume de données
```

Le `--wait` s'appuie sur le healthcheck `pg_isready` du service : la commande ne
rend la main qu'une fois la base réellement en état d'accepter des connexions,
ce qui évite un `alembic upgrade head` lancé trop tôt.

Le compose lit ses identifiants dans `backend/.env` via `env_file` : les clés
`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` y vivent à côté de
`DATABASE_URL`, et doivent rester cohérentes avec lui — c'est la même base. Aucune
valeur par défaut n'est codée dans le compose : si une clé manque, le conteneur
échoue bruyamment au lieu de démarrer avec des identifiants inventés.

Avant tout démarrage, copier le gabarit : `cp backend/.env.example backend/.env`.

Ces trois clés sont déclarées dans `Settings` (`core/config.py`) bien que
l'application ne les utilise pas — elle passe exclusivement par `DATABASE_URL`.
C'est volontaire : le `.env` reste ainsi intégralement validé, et une clé mal
orthographiée échoue au démarrage de l'API avec un message clair plutôt que
silencieusement au `docker compose up`.

## Backend — arborescence

```
app/
├── core/
│   ├── config.py            # settings (pydantic-settings)
│   └── database.py          # session SQLAlchemy
├── models/                  # 1 fichier = 1 entite (mapping SQLAlchemy)
│   ├── client.py
│   ├── client_particulier.py
│   ├── client_entreprise.py
│   ├── beneficiaire.py
│   ├── personnel.py
│   ├── domaine_formation.py
│   ├── formation.py
│   ├── session_formation.py
│   ├── categorie_produit.py
│   ├── produit.py
│   ├── salle.py
│   ├── logement.py
│   ├── abonnement.py
│   ├── consommation_repas.py
│   ├── commande.py
│   ├── ligne_commande.py
│   ├── demande_personnalisation.py
│   ├── reservation.py
│   ├── livraison.py
│   └── avis.py
├── schemas/                  # miroir de models/, schemas Pydantic (Create/Read/Update)
│   └── ... (meme decoupage que models/)
├── repositories/
│   ├── base_repository.py    # classe mere generique
│   ├── salle_repository.py   # herite de BaseRepository
│   ├── produit_repository.py
│   └── ...                   # 1 fichier par entite
├── services/                  # logique metier, orchestre les repositories
│   ├── salle_service.py
│   ├── reservation_service.py
│   └── ...
├── routers/                   # endpoints FastAPI, 1 fichier par entite
│   ├── salle_router.py
│   ├── produit_router.py
│   └── ...
└── main.py                    # assemble uniquement les routers
alembic/
└── versions/                  # migrations generees
```

### Pattern repository

`base_repository.py` porte tout le CRUD générique (create, get_by_id, list, update,
delete) via une classe générique paramétrée par le modèle SQLAlchemy. Chaque
repository spécifique hérite de cette base et **n'ajoute que les méthodes qui
dépassent le CRUD générique** :

- `salle_repository.py` → hérite + `verifier_disponibilite(date_debut, date_fin)`
- `abonnement_repository.py` → hérite + `calculer_total_consomme(id_abonnement)`
- `produit_repository.py` → hérite + `rechercher_par_categorie(id_categorie)`

Ne jamais réécrire `create`/`get_by_id`/`list`/`update`/`delete` dans un repository
spécifique — c'est le signe que l'héritage n'est pas utilisé correctement.

### Suppression logique, suppression réelle, anonymisation

Les 20 entités portent `supprime_le` via `SoftDeleteMixin` (`core/database.py`).
`BaseRepository` en tire trois opérations qu'il ne faut pas confondre.

**`delete()` archive.** Aucun `DELETE` SQL n'est émis : la ligne reste,
horodatée. C'est le seul chemin que doivent emprunter les règles métier.

**`get_by_id()` et `list()` filtrent par défaut.** Une entité archivée est
invisible, exactement comme une entité qui n'a jamais existé.
`inclure_supprimes=True` lève le filtre — paramètre explicite, jamais implicite,
pour que la consultation d'archives se lise dans le code appelant.

**`restaurer()` peut échouer légitimement.** Les index uniques étant partiels, la
valeur libérée par l'archivage a pu être réattribuée ; la restauration créerait
alors un doublon actif, et la base la refuse. Le service traduit — voir
`ClientService.restaurer`.

**`supprimer_definitivement()` est le vrai `DELETE`.** Il reste nécessaire parce
que l'archivage, à lui seul, ne satisfait aucun droit à l'effacement : la donnée
est toujours là. Il est réservé aux entités **sans valeur probante** — le
catalogue, pour l'essentiel — et ne doit jamais être exposé sur un endpoint sans
une protection explicite et tracée.

**Pour `CLIENT`, c'est `ClientService.anonymiser()` et rien d'autre.** Un client
est référencé par des réservations et des avis en `ON DELETE RESTRICT` : le
`DELETE` serait refusé, et il serait de toute façon la mauvaise réponse. Une
réservation honorée est une preuve de transaction, généralement soumise à une
obligation de conservation qui prime sur le droit à l'effacement.
`anonymiser()` réécrit les données personnelles, conserve `id_client` et
`type_client`, pose `supprime_le`, et ne touche à aucun enregistrement lié.

L'adresse générée utilise le domaine `delta.invalid`, réservé par la RFC 2606.
Deux conséquences voulues : elle n'est jamais routable, et `EmailStr` la refuse
en entrée — personne ne peut donc la soumettre pour usurper un compte anonymisé.
C'est aussi pourquoi `ClientRead.email` est typé `str` et non `EmailStr` : un
schema de sortie n'a pas à revalider une valeur issue de notre propre base, et
le faire ferait échouer en 500 toute lecture d'un compte anonymisé.

**Conséquence transverse, la plus lourde** : un archivage étant un `UPDATE`, ni
les `ON DELETE RESTRICT` ni les `ON DELETE CASCADE` du schéma ne se déclenchent.
Refuser l'archivage d'un parent encore référencé, et propager l'archivage à ses
enfants, deviennent des responsabilités de service. Voir la règle transverse de
`docs/roadmap.md`.

### Couches et responsabilités

| Couche | Responsabilité |
|---|---|
| `models/` | Mapping table ↔ classe Python (SQLAlchemy) |
| `schemas/` | Validation et sérialisation (Pydantic), jamais de logique métier |
| `repositories/` | Accès aux données uniquement (requêtes SQL via l'ORM) |
| `services/` | Logique métier, règles de gestion, orchestration de plusieurs repositories |
| `routers/` | Endpoints HTTP, validation d'entrée, appel au service correspondant |

### Authentification des endpoints protégés

`core/deps.py` porte les dépendances FastAPI transverses. La première,
`get_current_client`, est le **socle réutilisé par tous les endpoints protégés
des sprints suivants** : elle lit l'en-tête `Authorization: Bearer`, valide le
jeton via `decoder_jeton_acces`, charge le `CLIENT` correspondant au `sub` et le
retourne. Elle lève `AuthentificationInvalide` — traduite en 401 par les
gestionnaires globaux de `main.py` — si le jeton est absent, invalide, expiré,
ou si le client qu'il désigne n'existe plus en base. Ce dernier cas compte : un
jeton reste cryptographiquement valide jusqu'à son expiration, même après la
suppression du compte.

Un endpoint s'y branche ainsi :

```python
ClientConnecte = Annotated[Client, Depends(get_current_client)]

@router.post("/produit")
def creer(donnees: ProduitCreate, client: ClientConnecte, db: SessionBase): ...
```

**Pourquoi `core/deps.py` et non `core/security.py`.** `security.py` ne connaît
ni FastAPI ni la base : il manipule des chaînes et des dates, et reste testable
sans serveur ni session. `get_current_client` a besoin des trois — le framework
pour la déclaration de dépendance, la session pour charger le client, le
repository pour la requête. Les mélanger ferait de `security.py` un module
couplé à toute la stack.

**Cette dépendance authentifie, elle n'autorise pas.** Le schéma n'a aucune
notion de rôle : `CLIENT` ne porte pas de drapeau administrateur, et `PERSONNEL`
n'a pas de mot de passe, donc ne peut pas se connecter. Tout client inscrit,
particulier ou entreprise, est donc équivalent du point de vue des droits. Les
écritures du catalogue produit reposent sur cette seule barrière au sprint 1 —
report inscrit en dette technique dans `docs/roadmap.md`, à résorber avec
l'authentification `PERSONNEL` du sprint 3.

## Frontend — arborescence

```
src/
├── main.tsx                  # point d'entree Vite/React
├── index.css                 # entree Tailwind (@import "tailwindcss")
├── vite-env.d.ts             # types Vite
├── lib/
│   ├── axiosClient.ts        # instance axios unique, intercepteurs
│   └── tokenStorage.ts       # lecture/ecriture du jeton d'acces
├── layouts/
│   └── MainLayout.tsx        # structure de page transverse (nav, pied de page)
├── pages/                    # pages transverses, hors module metier
│   ├── AccueilPage.tsx
│   └── NonTrouveePage.tsx
├── features/
│   ├── salle/
│   │   ├── salle.types.ts    # interfaces TypeScript
│   │   ├── salle.api.ts      # appels axios purs, rien d'autre
│   │   ├── salle.service.ts  # logique d'orchestration
│   │   ├── salle.hooks.ts    # useSalle, useSalles (state + effets)
│   │   └── pages/
│   │       ├── SalleListPage.tsx
│   │       ├── SalleDetailPage.tsx
│   │       └── SalleReservationForm.tsx   # composant separe, pas fondu dans la page
│   ├── produit/
│   │   └── ... (meme structure)
│   ├── formation/
│   ├── abonnement/
│   ├── reservation/
│   └── ... (1 dossier par module metier)
└── App.tsx
```

Règle de découpe : dès qu'une page approche ~500 lignes, extraire un sous-composant
dans `pages/` ou un sous-dossier `components/` local au module — jamais dans un
fichier partagé fourre-tout.

### `src/layouts/`

Contient la **structure de page transverse** : navigation, en-tête, pied de page,
conteneur dans lequel le routeur injecte la page courante. C'est le seul endroit
où un composant a le droit de ne se rattacher à aucun module métier — précisément
parce qu'il les enveloppe tous.

En contrepartie, un layout ne porte **jamais** la logique métier d'un module
donné : pas d'appel à l'API produit, pas de calcul de panier. S'il faut afficher
une donnée métier dans la navigation (nombre d'articles du panier, nom du client
connecté), elle vient d'un hook exposé par le module concerné, que le layout
consomme sans rien savoir de son implémentation.

`src/layouts/` est au même niveau que `src/features/`, pas dedans : un layout
n'appartient à aucun module. Ce n'est pas non plus un `src/components/`
fourre-tout — seule la structure de page y a sa place.

### Client HTTP et stockage du jeton

`lib/axiosClient.ts` porte l'**unique** instance axios. Les fichiers `*.api.ts`
des modules l'importent et ne créent jamais la leur : c'est ce qui garantit qu'un
seul endroit détient l'URL de base (`VITE_API_URL`, préfixe `/api/v1` compris),
l'injection du jeton et le traitement des erreurs d'authentification.

Deux règles de comportement des intercepteurs :

- Un **401** efface le jeton et émet l'événement `delta:non-authentifie`, auquel
  le layout réagit par une redirection. L'intercepteur ne connaît pas le routeur :
  la couche HTTP ne doit pas dépendre de la navigation.
- Un 401 venant de `/auth/connexion` ou `/auth/inscription` est **exclu** de ce
  traitement : c'est une réponse métier (« mot de passe faux »), pas une session
  expirée. Sans cette exception, un utilisateur déjà connecté qui se trompe en
  saisissant un second compte se ferait déconnecter.

L'erreur continue de remonter dans tous les cas : l'intercepteur nettoie, il ne
décide pas du message à afficher à la place du module appelant.

`lib/tokenStorage.ts` isole le support de stockage — actuellement `localStorage`.
**Conséquence de sécurité** : le jeton est lisible par tout script exécuté dans la
page, donc exposé en cas de faille XSS. Un cookie `httpOnly` supprimerait ce
risque mais impose un travail côté API (émission du cookie, protection CSRF).
Report inscrit en dette technique dans `docs/roadmap.md`.

### `src/pages/` — pages transverses

Accueil, 404, mentions légales : des pages qui n'appartiennent à **aucun** module
métier. Elles ne peuvent pas vivre dans `features/<module>/pages/`, qui reste
réservé aux pages d'un module donné (`features/produit/pages/ProduitListPage.tsx`).

Critère de placement, en une question : *cette page disparaîtrait-elle si on
retirait un module du produit ?* Si oui, elle va dans `features/<module>/pages/`.
Sinon, dans `src/pages/`.

Ce dossier n'est pas une porte de sortie pour les pages qu'on ne sait pas classer :
une page de connexion, par exemple, appartient à `features/auth/` dès que ce module
existe — elle n'est en `src/pages/` au Sprint 0 que parce qu'aucun module n'est
encore créé.

### Fichiers d'entrée

`main.tsx`, `index.css`, `index.html` et `vite-env.d.ts` ne sont pas des choix
d'architecture : ce sont les points d'entrée standard imposés par Vite et React.
Ils sont listés ci-dessus pour que l'arborescence soit complète, pas parce qu'ils
relèvent d'une décision de conception.

## Correspondance modules ↔ tables du MLD

| Module (dossier) | Tables du MLD concernées |
|---|---|
| `client` | CLIENT, CLIENT_PARTICULIER, CLIENT_ENTREPRISE |
| `personnel` | PERSONNEL |
| `produit` | CATEGORIE_PRODUIT, PRODUIT |
| `commande` | COMMANDE, LIGNE_COMMANDE, DEMANDE_PERSONNALISATION |
| `livraison` | LIVRAISON |
| `formation` | DOMAINE_FORMATION, FORMATION, SESSION_FORMATION |
| `salle` | SALLE |
| `logement` | LOGEMENT |
| `reservation` | RESERVATION |
| `abonnement` | ABONNEMENT, BENEFICIAIRE, CONSOMMATION_REPAS |
| `avis` | AVIS |

Voir `docs/mld.md` pour le détail des colonnes de chaque table.
Voir `docs/roadmap.md` pour l'ordre de développement de ces modules.
