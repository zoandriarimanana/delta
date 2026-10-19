# Delta — Déploiement par Docker

Mise en ligne de Delta sur un serveur, avec Docker. Trois conteneurs :

| Conteneur | Rôle |
|---|---|
| `db` | PostgreSQL 16 avec pgvector (l'assistant IA en a besoin) |
| `backend` | API FastAPI ; applique les migrations à chaque démarrage |
| `site` | Caddy : sert le site, relaie `/api` au backend, gère le HTTPS |

Le site et l'API partagent **le même domaine** : `https://delta.mg/` pour le
site, `https://delta.mg/api/v1/...` pour l'API. Seul `site` est joignable
depuis Internet (ports 80 et 443) ; la base et le backend ne le sont pas.

Fichiers : `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/Caddyfile`,
`docker-compose.prod.yml` et `.env.production.example`, à la racine.
`docker-compose.yml` reste la base de **développement** locale, sans rapport.

## 1. Préparer le serveur

1. Un serveur Linux avec **Docker** et le plugin **Docker Compose** installés
   (`docker compose version` doit répondre).
2. Les ports **80** et **443** ouverts dans le pare-feu.
3. Le **nom de domaine** pointé vers l'adresse IP du serveur
   (enregistrement DNS de type A). Sans cela, Caddy ne peut pas obtenir le
   certificat HTTPS.

## 2. Installer

```bash
git clone <adresse du dépôt> delta
cd delta
cp .env.production.example .env.production
nano .env.production        # remplir : voir ci-dessous
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

À remplir dans `.env.production` :

- `DOMAINE` : le nom de domaine, sans `https://` (ex. `delta.mg`) ;
- `POSTGRES_PASSWORD` et `SECRET_KEY` : deux secrets longs et différents.
  Les générer :
  ```bash
  python3 -c "import secrets; print(secrets.token_hex(24))"       # POSTGRES_PASSWORD
  python3 -c "import secrets; print(secrets.token_urlsafe(48))"   # SECRET_KEY
  ```
  Le mot de passe de la base : lettres et chiffres seulement (il entre dans
  une URL de connexion) ;
- `SMTP_*` : **obligatoire en production**. Sans envoi d'e-mails, aucun
  client ne peut recevoir son code et activer son compte ;
- `GROQ_API_KEY` et `JINA_API_KEY` : pour l'assistant IA (il reste éteint
  sans elles) ;
- `VITE_FACEBOOK_URL`, `VITE_TELEPHONE_FORMATION` : facultatifs.

`.env.production` contient des secrets : il est ignoré par Git et ne doit
jamais être commité ni partagé.

Le premier démarrage prend quelques minutes (construction des images). Pour
suivre :

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
```

Le site répond ensuite sur `https://<DOMAINE>/`.

Pour raccourcir les commandes, on peut définir un alias :

```bash
alias delta='docker compose --env-file .env.production -f docker-compose.prod.yml'
delta ps
delta logs -f backend
```

Les commandes ci-dessous l'utilisent.

## 3. Créer le premier administrateur

Aucun compte du personnel n'existe au départ. Le premier administrateur se
crée par le script prévu (le mot de passe est demandé, jamais passé en
argument) :

```bash
delta exec backend python -m scripts.creer_admin \
    --email chef@delta.mg --nom Rakoto --prenom Jean --fonction Autre
```

Il se connecte ensuite par « Administration », en bas du site, et crée les
autres salariés depuis l'écran « Personnel ».

## 4. Remplir l'assistant IA

Une fois le catalogue saisi (et après chaque grosse modification) :

```bash
delta exec backend python -m scripts.reindexer_assistant
```

La réindexation est aussi possible depuis la page « Assistant IA » de
l'administration.

## 5. Mettre à jour le site

```bash
git pull
delta up -d --build
```

Les migrations de la base s'appliquent toutes seules au redémarrage du
backend. Les données, les photos et les certificats sont dans des volumes
Docker : une mise à jour ne les touche pas.

Les variables `VITE_*` sont figées dans le site à sa construction : les
modifier dans `.env.production` demande `delta up -d --build`.

## 6. Sauvegarder

À faire régulièrement (idéalement chaque nuit, par `cron`) et à copier
**hors du serveur**.

```bash
# Base de données
delta exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
    > sauvegarde-$(date +%F).dump

# Photos du catalogue et du personnel
delta exec -T backend tar czf - -C /app static/upload stockage \
    > photos-$(date +%F).tar.gz
```

## 7. Restaurer

```bash
# Base de données (remplace le contenu actuel)
delta exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
    < sauvegarde-AAAA-MM-JJ.dump

# Photos
delta exec -T backend tar xzf - -C /app < photos-AAAA-MM-JJ.tar.gz
```

## 8. À savoir

- **Un seul processus backend.** Les limites anti-abus (connexion,
  inscription…) comptent en mémoire ; plusieurs processus les
  multiplieraient. Suffisant pour Delta ; voir la dette T0.6 dans
  `docs/roadmap.md` avant de vouloir monter en charge.
- **Paiement en ligne.** Aucune vraie passerelle (MVola, Orange Money,
  Airtel Money, carte) n'est encore branchée, et la simulation de paiement
  est fermée en production. Les clients peuvent commander et réserver, mais
  le paiement en ligne n'aboutira pas tant qu'un opérateur n'est pas
  intégré ; les paiements se règlent alors au comptoir et l'administration
  confirme les commandes à la main.
- **Tâche d'expiration.** Le backend annule toutes les 5 minutes les
  commandes non payées depuis 2 h et les réservations sans acompte depuis
  24 h. Avec le paiement en ligne indisponible, régler
  `EXPIRATION_AUTOMATIQUE=false` dans `.env.production` évite d'annuler des
  commandes qui seront payées sur place.
- **Ne jamais lancer** `delta down -v` : l'option `-v` efface les volumes,
  donc la base et toutes les photos.
