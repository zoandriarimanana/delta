# Delta — Architecture technique

Stack : **FastAPI + SQLAlchemy (ORM) + Alembic (migrations) + PostgreSQL** côté backend,
**React + TypeScript + Tailwind + Axios** côté frontend.

## Règle non négociable : SRP (Single Responsibility Principle)

Un fichier ne traite jamais deux entités différentes, à aucun niveau de la stack.
Si un doute survient sur où placer du code, la question à se poser est : "ce code
concerne-t-il une seule entité métier, ou plusieurs ?" Si plusieurs : c'est un
signe qu'il faut soit un fichier par entité avec une couche d'orchestration à part,
soit repenser le découpage.

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

### Couches et responsabilités

| Couche | Responsabilité |
|---|---|
| `models/` | Mapping table ↔ classe Python (SQLAlchemy) |
| `schemas/` | Validation et sérialisation (Pydantic), jamais de logique métier |
| `repositories/` | Accès aux données uniquement (requêtes SQL via l'ORM) |
| `services/` | Logique métier, règles de gestion, orchestration de plusieurs repositories |
| `routers/` | Endpoints HTTP, validation d'entrée, appel au service correspondant |

## Frontend — arborescence

```
src/
├── lib/
│   └── axiosClient.ts        # instance axios unique, intercepteurs
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
