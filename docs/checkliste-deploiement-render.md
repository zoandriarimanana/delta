# Delta — Checkliste de déploiement sur Render

Cible : **trois services Render** — une base PostgreSQL, un *Web Service* Python
(backend FastAPI), un *Static Site* (frontend Vite). Aucun `Dockerfile` ni
`render.yaml` n'existe dans le dépôt : tout se configure depuis le tableau de
bord Render (ou via un `render.yaml` à écrire plus tard).

Cocher chaque case dans l'ordre. Les sections marquées ⛔ sont **bloquantes** :
sans elles, le site se déploie mais l'authentification ou les données sont
cassées.

---

## 0. Avant de toucher à Render

- [ ] Le code à déployer est mergé sur la branche choisie pour le déploiement
      (`main` via une release explicite, cf. `CONTRIBUTING.md` §1 — jamais une
      branche `feature/*`).
- [ ] La CI de cette branche est verte (les 5 étapes backend + 5 frontend).
- [ ] `alembic upgrade head` passe sur une base **vierge** (c'est ce que fera
      Render).
- [ ] Les dettes « à traiter avant mise en prod » de `docs/roadmap.md` ont été
      relues et soit traitées, soit explicitement acceptées pour ce
      déploiement (simulation de paiement, `SameSite`, verrou
      `changer_statut()`, verrouillage de compte).
- [ ] Choisir les plans Render : le plan gratuit **endort** le backend après
      15 min d'inactivité (premier appel ≈ 30-60 s), sa base PostgreSQL
      **expire au bout de 30 jours**, et il n'offre ni disque persistant ni
      *pre-deploy command*. Pour une vraie mise en ligne : plan payant
      (Starter au minimum) pour le backend et la base.

## 1. ⛔ Topologie : frontend et API sur la même origine

**Pourquoi c'est bloquant.** Les cookies de session (`app/core/cookies.py`)
sont posés **sans attribut `Domain`** et en `SameSite=Lax`, et le frontend
**lit en JS** le cookie `delta_csrf` pour le recopier dans `X-CSRF-Token`.
Or `onrender.com` est sur la *Public Suffix List* : `delta-web.onrender.com`
et `delta-api.onrender.com` sont deux **sites différents**. Conséquences si le
frontend appelle l'API directement :

- `delta_session` n'est pas envoyé sur les requêtes XHR cross-site → 401
  partout ;
- `delta_csrf` est posé sur le domaine de l'API, `document.cookie` du
  frontend ne le voit pas → 403 CSRF sur toute écriture.

**Solution retenue, sans changement de code** : le Static Site **proxifie**
l'API par une règle de *rewrite* (Render accepte une URL publique externe
comme destination). Le navigateur ne voit qu'une seule origine.

- [ ] Sur le Static Site → *Redirects/Rewrites*, **dans cet ordre** :

      | Type | Source | Destination |
      |---|---|---|
      | Rewrite | `/api/*` | `https://<service-backend>.onrender.com/api/*` |
      | Rewrite | `/*` | `/index.html` |

      La seconde règle sert le routage React (`react-router`) : sans elle, un
      F5 sur `/produits/3` répond 404. Elle doit venir **après** `/api/*`.
- [ ] `VITE_API_URL=/api/v1` (chemin relatif, même origine) — voir §4.
- [ ] Alternative si un domaine personnalisé est acheté : `app.delta.mg` et
      `api.delta.mg` sont alors le même site (`SameSite` OK), **mais**
      `delta_csrf` resterait illisible par le frontend sans ajouter
      `domain=".delta.mg"` dans `cookies.py` → changement de code, PR dédiée.
      Le proxy reste plus simple.

## 2. Base de données PostgreSQL

- [ ] Créer une instance *PostgreSQL* (version 16, comme `docker-compose.yml`),
      **même région** que le backend.
- [ ] Noter l'**Internal Database URL** (`postgresql://...`) : c'est elle que
      le backend utilisera. SQLAlchemy accepte `postgresql://` tel quel
      (pilote psycopg2 par défaut).
- [ ] Vérifier que l'extension `btree_gist` est disponible (la migration
      `acadf9ddce27` fait `CREATE EXTENSION IF NOT EXISTS btree_gist`) — elle
      l'est sur Render, mais un échec ici bloque toute la chaîne de
      migrations.
- [ ] Activer les sauvegardes (plans payants) avant d'y mettre de vraies
      données.

## 3. Backend — Web Service (Python)

### Configuration du service

- [ ] *Root Directory* : `backend`
- [ ] *Runtime* : Python. Fixer la version : variable `PYTHON_VERSION=3.13`
      (celle de la CI).
- [ ] *Build Command* : `pip install .`
      (ajouter `&& pip install -r requirements-ai.txt` **uniquement** si
      l'assistant IA du Sprint 12 est inclus dans ce déploiement).
- [ ] *Pre-Deploy Command* (plans payants) : `alembic upgrade head`
      Sur le plan gratuit, à défaut, préfixer la commande de démarrage :
      `alembic upgrade head && uvicorn ...`.
- [ ] *Start Command* :
      ```bash
      uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'
      ```
      **Un seul worker** (pas de `--workers N`) : le rate limiting est en
      mémoire (`memory://`), plusieurs workers multiplieraient la limite
      (dette T0.6).
- [ ] *Health Check Path* : `/docs` (ou un endpoint de santé s'il existe).

### Variables d'environnement

- [ ] `DATABASE_URL` = Internal Database URL de §2
- [ ] ⛔ `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — **obligatoires
      même si inutilisées** : `Settings` les exige, l'API refuse de démarrer
      sans elles. Y mettre les valeurs de la base Render.
- [ ] `SECRET_KEY` = nouvelle clé forte, **jamais** celle du `.env` local :
      `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- [ ] ⛔ `ENVIRONMENT=production` — active `Secure` sur les cookies et ferme
      `POST /paiements/{id}/simuler-confirmation` (404). Ne **jamais** mettre
      `developpement` en ligne.
- [ ] `BACKEND_CORS_ORIGINS=https://<static-site>.onrender.com` (même origine
      grâce au proxy, mais on n'ouvre rien de plus large).
- [ ] `ACCESS_TOKEN_EXPIRE_MINUTES` (défaut 60), `API_V1_PREFIX=/api/v1`.
- [ ] `RATE_LIMIT_STORAGE_URI=memory://` (OK tant qu'il n'y a qu'une instance).
- [ ] Clés API de l'assistant IA, si inclus (jamais dans le dépôt).

### ⛔ Photos de profil PERSONNEL

Le système de fichiers d'un service Render est **éphémère** : tout ce qui est
écrit dans `stockage/personnel_photos` disparaît à chaque déploiement ou
redémarrage.

- [ ] Ajouter un *Persistent Disk* (plan payant), monté par ex. sur
      `/var/data`, et `PHOTO_STORAGE_DIR=/var/data/personnel_photos`.
- [ ] Ou, si pas de disque : accepter explicitement que les photos soient
      perdues à chaque déploiement (l'avatar générique s'affiche alors).
      Conséquence : un disque attaché interdit le *zero-downtime deploy* sur
      Render — à savoir.

### Rate limiting derrière le proxy

Le limiteur identifie le client par `request.client.host`. Derrière le load
balancer Render **et** le rewrite du Static Site, sans `--proxy-headers` toutes
les requêtes auraient la même IP : 5 connexions/minute **pour tout le site**.

- [ ] Après déploiement, vérifier (§6) que deux navigateurs/réseaux différents
      ont bien des budgets séparés. Si ce n'est pas le cas, le limiteur doit
      lire `X-Forwarded-For` → PR dédiée sur `core/rate_limit.py`.

## 4. Frontend — Static Site

- [ ] *Root Directory* : `frontend`
- [ ] *Build Command* : `npm ci && npm run build`
      (le `build` lance `tsc --noEmit` : une erreur de typage bloque le
      déploiement, c'est voulu).
- [ ] *Publish Directory* : `dist`
- [ ] Variable `NODE_VERSION=24` (celle de la CI).
- [ ] `VITE_API_URL=/api/v1` — les variables `VITE_*` sont figées **au build** :
      toute modification impose un redéploiement du Static Site.
- [ ] `VITE_ENVIRONMENT=production` (masque le bouton « Simuler la
      confirmation »).
- [ ] Règles de rewrite de §1 en place.
- [ ] Ne pas commiter `frontend/dist/` ni `frontend/.env`.

## 5. Données initiales

- [ ] Créer le **premier administrateur** — jamais par l'API
      (`docs/architecture.md`, « Amorçage du premier administrateur ») :
      depuis le *Shell* Render du backend (plan payant), ou en local avec
      l'**External Database URL** :
      ```bash
      DATABASE_URL='<external url>' DELTA_ADMIN_MOT_DE_PASSE='…' \
        .venv/bin/python -m scripts.creer_admin \
        --email <email> --nom <nom> --prenom <prénom> --fonction Autre
      ```
      Le mot de passe passe par l'environnement, jamais en argument.
- [ ] ⛔ **Ne pas** lancer `scripts/seed_qa_complet.py` ni aucun seed de test
      sur la base de production.
- [ ] Saisir le catalogue réel (catégories, produits, salles, logements,
      formations) depuis les écrans d'administration.

## 6. Vérifications après déploiement (smoke test)

Dans un navigateur réel, sur l'URL du Static Site :

- [ ] Page d'accueil et catalogue produits s'affichent (lecture publique).
- [ ] F5 sur une page profonde (`/produits/<id>`) → pas de 404.
- [ ] Inscription d'un client → redirection vers la connexion.
- [ ] Connexion client → les cookies `delta_session` (httpOnly, Secure) et
      `delta_csrf` (Secure) apparaissent dans les DevTools **sur le domaine du
      Static Site**.
- [ ] Une écriture (ajout au panier → commande) passe : pas de 403 CSRF.
- [ ] Commande **invitée** → page de suivi par référence publique accessible.
- [ ] Déconnexion → les deux cookies disparaissent.
- [ ] Connexion personnel (admin) → écrans d'administration accessibles ;
      un salarié non admin reçoit 403 sur une écriture catalogue.
- [ ] Upload d'une photo de profil, puis redéploiement → la photo est
      toujours là (si disque persistant).
- [ ] 6 tentatives de connexion ratées en une minute → 429 à la 6e ; depuis un
      autre réseau, la connexion reste possible (cf. §3, rate limiting).
- [ ] `POST /api/v1/paiements/<id>/simuler-confirmation` → **404**.
- [ ] Logs du backend Render : aucune erreur au démarrage ni trace SQL.

## 7. Après la mise en ligne

- [ ] Noter les URLs, plans et région choisis dans `docs/architecture.md`
      (section « Base de données locale » n'en parle que pour Docker).
- [ ] Mettre à jour la dette `SameSite` de `docs/roadmap.md` : la topologie
      est désormais connue (même origine via rewrite).
- [ ] Mettre à jour la dette Redis : rester à **une seule instance** tant que
      `RATE_LIMIT_STORAGE_URI=memory://`.
- [ ] Si la base est en plan gratuit : programmer sa migration avant
      l'expiration des 30 jours.
