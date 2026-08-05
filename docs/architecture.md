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

### Codes d'erreur : 404 contre 422

Une référence à une entité liée inexistante dans le corps d'une requête renvoie
**422**, jamais 404 — réservé aux ressources absentes de l'URL.

Autrement dit : `GET /produits/999` sur un produit inconnu donne 404, la
ressource demandée par l'URL n'existe pas. `POST /produits` avec un
`id_categorie` inconnu donne 422, la ressource visée par l'URL existe et c'est
le contenu envoyé qui est invalide — au même titre qu'un prix négatif. La règle
vaut pour toute FK traversée par une charge utile : `id_formation` d'une
session, `id_salle` d'une réservation, `id_produit` d'une ligne de commande.

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

### Lectures publiques, lectures protégées

Le catalogue produit expose ses **lectures** publiquement : un visiteur doit
pouvoir parcourir les produits sans compte ; ses **écritures** sont réservées aux
administrateurs. `PERSONNEL` va plus loin — **toutes ses opérations exigent un
jeton, lectures comprises**, la lecture étant ouverte à tout salarié et l'écriture
aux seuls administrateurs. Un annuaire de salariés
porte des noms, des adresses professionnelles, des téléphones et des dates
d'embauche ; rien n'y a vocation à être lisible anonymement.

Le critère n'est donc pas « lecture contre écriture » mais **la nature de la
donnée**. Une entité dont la lecture publique n'a pas de sens métier ne doit pas
hériter du réglage du catalogue par simple imitation.

### Amorçage du premier administrateur

`PERSONNEL.est_administrateur` n'est exposé par **aucun** endpoint : ni
`PersonnelCreate` ni `PersonnelUpdate` ne le portent, et `PERSONNEL.mot_de_passe`
non plus. Un champ qu'on n'expose pas est un champ qu'aucune faille
d'autorisation ne peut atteindre — la protection est structurelle, elle ne dépend
pas de la dépendance branchée sur l'endpoint.

Reste la question de l'œuf et de la poule : créer le premier administrateur
supposerait d'en être déjà un. Elle se résout **hors de l'API**, par
`backend/scripts/creer_admin.py`, qui écrit directement en base :

```bash
cd backend
.venv/bin/python -m scripts.creer_admin \
    --email chef@delta.mg --nom Rakoto --prenom Jean --fonction Autre
```

Sans terminal interactif — conteneur, CI — le mot de passe se transmet par
l'environnement :

```bash
DELTA_ADMIN_MOT_DE_PASSE='…' .venv/bin/python -m scripts.creer_admin \
    --email chef@delta.mg --nom Rakoto --prenom Jean --fonction Autre
```

**Le mot de passe n'est jamais un argument de ligne de commande.** Il resterait
en clair dans `~/.bash_history` et serait visible de tout utilisateur de la
machine dans la sortie de `ps`. Le script ne propose donc pas l'option, et un
test le vérifie — la commodité serait ici une régression de sécurité.

Exécuter ce script suppose un accès au serveur et aux identifiants de la base,
c'est-à-dire un niveau de privilège qui rend la question de l'élévation sans
objet. C'est ce qui le distingue d'un endpoint, et pourquoi il passe par le
repository plutôt que par `PersonnelService` : le service est consommé par le
router, et y placer une opération qui accorde des droits inviterait tôt ou tard
à l'exposer.

`mot_de_passe` est **nullable** : certaines fonctions n'ont structurellement pas
besoin d'un compte de connexion. `NULL` signifie « pas de compte » et non « mot
de passe vide » — `get_current_personnel` refusera l'authentification, avec le
même message uniforme que les autres refus.

**Cette dépendance authentifie, elle n'autorise pas.** Aucun droit ne se dérive
d'un compte client : tout client inscrit, particulier ou entreprise, est
équivalent. Les opérations réservées passent par
`get_current_personnel_administrateur`.

### Deux populations, deux jetons

`CLIENT` et `PERSONNEL` sont deux tables distinctes dont **les clés primaires se
recouvrent** : le client n°5 et le salarié n°5 existent tous les deux. Un jeton
ne portant que `sub` serait donc ambigu, et `get_current_client` chargerait un
client à partir du jeton d'un salarié. Ce n'est pas un inconfort de typage, c'est
une confusion d'identité.

Le jeton porte donc une revendication **`type`**, valant `client` ou `personnel`,
fixée à l'émission et vérifiée à chaque lecture. Chaque dépendance exige la
sienne et **rejette celle de l'autre**, avec le message uniforme habituel.

`creer_jeton_acces` prend le type en paramètre **obligatoire, sans valeur par
défaut** : un défaut ferait qu'un futur point d'émission produirait un jeton
client sans que personne s'en aperçoive.

Un jeton **sans** revendication `type` est refusé. Il ne peut venir que d'une
version antérieure à ce cloisonnement, et le lire par défaut comme un jeton
client rouvrirait exactement la confusion qu'on ferme. Le coût est une
reconnexion des sessions ouvertes — ce qu'une expiration aurait imposé de toute
façon.

| Dépendance | Exige | Refuse |
|---|---|---|
| `get_current_client` | `type = client`, compte actif | jeton personnel, compte archivé |
| `get_current_personnel` | `type = personnel`, compte actif, `mot_de_passe` non nul | jeton client, compte sans connexion |
| `get_current_personnel_administrateur` | ci-dessus **plus** `est_administrateur` | salarié sans droit → **403** |

### Authentifier n'est pas autoriser : 401 contre 403

Les deux premières dépendances **authentifient** : à leur échec, on ne sait pas
qui appelle, c'est un **401**. La troisième **autorise** : l'appelant est
identifié, il lui manque un droit, c'est un **403** (`AutorisationInsuffisante`).

Les deux codes ne se substituent pas. Répondre 401 à un salarié non
administrateur l'inviterait à se reconnecter pour un problème que sa reconnexion
ne réglera pas. Le 403 ne porte pas d'en-tête `WWW-Authenticate`, qui réclame des
identifiants alors que les siens sont valides.

Le droit vient de `est_administrateur` et **jamais de `fonction`** : l'un porte un
droit, l'autre un métier (cf. `docs/mld.md`). Un formateur peut administrer le
catalogue, un cuisinier non.

### Anonymisation du personnel

`PersonnelService.anonymiser()` est à `PERSONNEL` ce que `ClientService.anonymiser()`
est à `CLIENT` : le seul chemin de conformité au droit à l'effacement. L'archivage
seul ne suffit pas — la ligne reste, et avec elle le nom, l'adresse
professionnelle et le téléphone.

Sont conservés `id_personnel`, `fonction` et `date_embauche` : ni la fonction ni
l'ancienneté n'identifient quelqu'un, et les livraisons comme les sessions
gardent leur `#id_personnel`, désormais anonyme. `est_administrateur` repasse à
`false` — un compte anonymisé ne porte plus aucun droit.

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
│   │   ├── produit.types.ts
│   │   ├── produit.api.ts
│   │   ├── produit.service.ts
│   │   ├── produit.hooks.ts
│   │   ├── components/          # sous-composants locaux au module
│   │   └── pages/
│   │       ├── ProduitListPage.tsx
│   │       └── ProduitDetailPage.tsx
│   ├── commande/
│   │   ├── commande.types.ts
│   │   ├── commande.api.ts
│   │   ├── commande.service.ts    # regles de panier, fonctions pures
│   │   ├── commande.panier.ts     # persistance du panier + abonnement
│   │   ├── commande.hooks.ts
│   │   ├── components/
│   │   └── pages/
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

### Le panier n'a pas d'entité serveur

`docs/mld.md` ne comporte **aucune table panier** : il vit dans le navigateur
jusqu'à la validation, qui crée la `COMMANDE` et ses `LIGNE_COMMANDE`. Deux
conséquences assumées — le panier est perdu au changement d'appareil, et il est
lisible par tout script de la page, comme le jeton.

`commande.panier.ts` est un magasin externe minimal (`useSyncExternalStore`)
plutôt qu'un contexte React : le compteur de la barre de navigation et la page
panier doivent partager le même état sans qu'un fournisseur enveloppe toute
l'application. C'est aussi ce qui permet au layout de n'afficher qu'une valeur
issue d'un hook du module, sans logique métier propre.

**Le total affiché par le panier est indicatif.** Le montant enregistré est
calculé par le serveur à partir des prix du catalogue au moment de la commande :
le panier est un brouillon, pas un engagement de prix.

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
