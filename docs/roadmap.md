# Delta — Roadmap agile (sprints à taille variable)

Ordre de priorisation : dépendances techniques d'abord, puis cœur transactionnel,
puis modules métier du plus généraliste au plus spécifique, paiement en ligne et
back-office avancé en dernier.

**Sprint courant : Sprint 11.** Mettre à jour cette ligne à chaque changement de sprint.

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
- [x] **T0.7 — Trigger d'exclusivité `CLIENT`** *(reporté — voir section Dette
      technique)* : **REPORTÉ pour ce sprint.** Garde
      uniquement la validation applicative dans `auth_service` (création `CLIENT` +
      ligne fille dans une seule transaction). Voir « Dette technique » en fin de
      document. — **Résorbé au Sprint 11**, voir ce sprint pour le détail.
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
      pas vers `Annulee` — **relancer la livraison, rembourser, annuler** sont
      des décisions humaines. Manque **volontaire**, pas une dette : #25 se
      contente de ne pas casser la cohérence en l'attendant. Règle écrite dans
      `docs/architecture.md`.
      — Ces trois actions sont **nommées au Sprint 10**, sous « Tableau de bord
      commandes/réservations/abonnements ». Le rattachement était jusqu'ici
      implicite, ce qui rendait « manque volontaire » et « dette oubliée »
      indiscernables : une commande dont la livraison a échoué reste figée dans
      un état que personne ne peut faire évoluer, et c'est le comportement
      voulu **tant que quelqu'un finit par pouvoir agir**.
- [x] Suivi de statut livraison, backend **et** React — `LivraisonPublique`
      n'expose que le statut et les dates, jamais le livreur ni l'adresse, et
      `features/livraison/` ne déclare même pas ces champs. La page publique
      accessible par `reference_publique` et l'historique connecté partagent le
      **même** composant : une seconde implémentation divergerait, et c'est sur
      la page sans authentification qu'une divulgation serait la plus grave.

## Sprint 4 — Formation

- [x] CRUD `DOMAINE_FORMATION`, `FORMATION`, `SESSION_FORMATION` (admin)
      — ⚠️ la cohérence de fonction doit être vérifiée dans le service au moment
      de l'affectation, la FK ne la garantissant pas :
      `SESSION_FORMATION.#id_formateur` pointe vers `PERSONNEL` tout entier,
      rien en base n'empêche d'affecter un livreur comme formateur.
      — **Reprendre le mécanisme posé en #25** pour `LIVRAISON`
      (`LivraisonService.affecter_livreur`) : même refus en 422, même exclusion
      d'un salarié archivé, même test paramétré sur les fonctions non
      conformes. Une seconde implémentation divergerait — les deux règles sont
      la même, à la fonction attendue près.
- [x] `RESERVATION` type = Formation, décrément `places_restantes`
      — décrément **atomique et immédiat** à la création (`UPDATE` conditionnel,
      409 si aucune ligne affectée), sur le modèle de `PRODUIT.stock_disponible`.
      — **La restitution est obligatoire et symétrique** : annulation *et*
      archivage rendent les places. Sans elle, chaque annulation en perdrait une
      définitivement. Idempotente : seule la transition d'un statut occupant
      vers `Annulee` crédite.
      — `RESERVATION.statut` est devenu un **domaine formel**. `Honoree` ne
      restitue pas : un stagiaire venu a consommé sa place.
- [x] Option hébergement liée à une réservation formation
      — **Périmètre volontairement réduit** : `avec_hebergement` est un drapeau
      informatif, sans réservation réelle de `LOGEMENT` ni vérification de
      disponibilité. Ce mécanisme n'existe pas encore, il arrive au sprint 5.
      — Refusé si `FORMATION.propose_hebergement` est faux (propriété du
      catalogue, pas préférence du client), et sur tout type autre que
      `Formation`.
      — Le couplage réel — seconde `RESERVATION` de type `Logement`, liée, avec
      contrôle de chevauchement — est la **suite naturelle** de cette tâche une
      fois le sprint 5 livré, pas une dette improvisée. Voir `docs/mld.md`.
- [x] Catalogue et réservation formation (React)
      — `features/formation/` porte le catalogue, `features/reservation/`
      l'écriture : deux entités distinctes, deux modules. La page de formation
      insère le formulaire sans rien savoir de son implémentation.
      — Le formateur est affiché via `FormateurPublic` (nom, prénom,
      spécialité) ; ni e-mail ni téléphone, garantis par le schema de sortie,
      par le type TypeScript et par un test d'injection.
      — Les refus **409** (session complète) et **422** (hébergement non
      proposé) sont repris **tels quels** : ils disent au client quoi corriger.
      Une liste dans `detail` — erreur de validation de schema — retombe en
      revanche sur un message générique, pour ne pas afficher de JSON.

## Sprint 5 — Salle & logement

- [x] CRUD `SALLE`, `LOGEMENT` (admin)
      — `SALLE` porte désormais un `CHECK (tarif_horaire IS NOT NULL OR
      tarif_journee IS NOT NULL)` : règle du dictionnaire d'origine jamais
      portée en contrainte, rétablie. La gratuité doit s'écrire `0.00`.
      — `LOGEMENT.statut` est un **domaine formel** décrivant l'état du bien,
      **jamais son occupation** : celle-ci se déduit des réservations.
- [x] `RESERVATION` type = Salle / Logement + vérification de chevauchement de dates
      — La garantie est une **contrainte d'exclusion PostgreSQL**
      (`EXCLUDE USING gist`), pas une vérification applicative : il n'y a ici
      aucun compteur sur lequel poser un verrou de ligne, contrairement à
      `places_restantes`. Le service fait un pré-contrôle, mais pour produire un
      409 lisible — la base est le seul arbitre.
      — Bornes `[)` : deux créneaux adjacents ne se chevauchent pas. Une
      réservation annulée ou archivée libère son créneau.
      — **Deux règles nouvelles** y ont été décidées, distinctes des corrections
      d'omissions : capacité du bien non dépassée (422), logement non
      `Disponible` non réservable (409). Toutes deux croisent deux tables,
      aucun `CHECK` ne peut les porter — le service est leur seul point
      d'application. Voir `docs/architecture.md`.
- [x] Interface de réservation (React)
      — `features/salle/` et `features/logement/` portent les catalogues,
      `features/reservation/` l'écriture : les fiches montent le formulaire
      sans rien savoir de son implémentation, comme la fiche de formation.
      — **Deux formulaires, un seul hook.** `useValidationReservation` est
      partagé, donc le traitement des refus l'est aussi ; la saisie ne l'est
      pas. Une session impose ses dates et propose l'hébergement, un bien se
      réserve sur un créneau choisi — les fondre aurait produit un composant
      dont la moitié des champs seraient inertes selon le cas.
      — `ReservationEnvoyee` est une **union discriminée** sur
      `type_reservation` : cible absente, double cible, cible d'un autre type
      et `avec_hebergement` hors formation sont refusés **à la compilation**,
      sans attendre le 422 du serveur. Quatre `@ts-expect-error` et un
      contrôle positif le verrouillent.
      — Les refus **409** (créneau déjà pris) et **422** (capacité dépassée)
      sont repris **tels quels** : ils disent au client quoi corriger.

## Sprint 6 — Couplage hébergement & restauration sur place

Deux sujets sans rapport métier dans un même sprint, et c'est assumé : l'ordre
du roadmap suit les **dépendances techniques**, pas l'unité thématique. Le
couplage ne pouvait pas venir plus tôt — il dépend du mécanisme de chevauchement
livré par #47 — et le titre le nomme plutôt que de le laisser deviner du contenu
du Milestone.

**Trois tâches s'y sont ajoutées en cours de route** : la connexion et
l'inscription client, puis l'endpoint de prise de commande par le personnel.
Aucune n'était au plan, et aucune n'est une dérive de périmètre — chacune
comblait un trou qui rendait **inatteignable ce que le sprint composait**. Les
deux premières datent du Sprint 0, la troisième est apparue en préparant le
dernier écran.

Elles sont inscrites ici plutôt que passées sous silence : un sprint dont le
plan ne reflète pas ce qui a été fait ne sert plus à retrouver les décisions.
Huit tâches livrées là où cinq étaient prévues.

- [x] Couplage `RESERVATION` Formation ↔ `LOGEMENT` — **en premier**
      — Suite planifiée de #37, débloquée par #47. `avec_hebergement`
      n'était jusqu'ici qu'un **drapeau informatif** : aucune chambre n'était
      réservée ni même vérifiée disponible.
      — Passe par **deux `RESERVATION` liées**, jamais par une seule : la
      contrainte n°2 interdit qu'une même ligne porte `#id_session` et
      `#id_logement`. Le MLD ne porte **aucune colonne** pour ce lien
      aujourd'hui — c'est cette tâche qui l'ajoute, donc elle qui introduit la
      migration. D'où sa place en tête : les deux tâches `RESERVATION`
      suivantes se rebasent dessus plutôt que l'inverse.
      — **Direction retenue, confirmée en ouvrant #62** : quand aucune chambre
      n'est libre, la réservation de formation est **acceptée quand même**,
      `avec_hebergement` reste non honoré, un administrateur assure le suivi.
      Aucun nouvel état, pas de file d'attente. Même raisonnement que
      `LIVRAISON.Echouee` en #25 : refuser trancherait à la place de
      l'administrateur, et obligerait en prime à rendre la place tout juste
      décrémentée.
      — Le lien est porté par la **ligne de formation**
      (`#id_reservation_hebergement`) : la formation est ce que le client
      réserve, l'hébergement en est l'accessoire. La chambre est choisie
      **côté serveur, la première libre** — laisser choisir supposerait
      d'exposer une disponibilité qu'aucun endpoint ne publie. Les dates sont
      **celles de la session** ; le décalage d'une nuit pour une arrivée la
      veille est une évolution future, pas une règle que quelqu'un ait énoncée.
      — **L'annulation de la formation annule l'hébergement**, dans la même
      transaction : laisser une chambre retenue pour une formation annulée
      immobiliserait une ressource sans raison active. L'inverse n'est pas vrai
      — annuler le seul hébergement reste possible, le stagiaire pouvant se
      loger ailleurs.
      — Livré par #69. `#id_reservation_hebergement` porte le lien, avec une
      `UNIQUE` **globale** — propriété structurelle et non identité métier, même
      raisonnement que `LIVRAISON.#id_commande`. Deux `CHECK` l'encadrent : seul
      un type `Formation` porte un lien, et aucune ligne ne se lie à elle-même,
      une boucle que toute propagation suivrait indéfiniment.
      — L'attribution se fait sous **`SAVEPOINT`** : deux formations simultanées
      peuvent lire la même chambre libre, et c'est la contrainte d'exclusion de
      #47 qui tranche à l'écriture. Sans point de reprise, le `rollback`
      emporterait la réservation de formation et son décrément de places.
      — `test_aucun_logement_n_est_reserve`, posé au Sprint 4 pour figer l'état
      antérieur, portait dans sa docstring l'instruction de le reprendre le jour
      du couplage. Il est **remplacé** par douze tests vérifiant le comportement
      inverse, plus onze sur `LogementRepository.premier_libre` — pas affaibli.
- [x] Socle d'authentification `PERSONNEL` côté frontend — **en deuxième**
      — Sujet **transverse**, sa propre PR, isolément revertible : ce n'est pas
      de la construction sur du vide mais la modification d'un socle en service.
      — Le backend sait déjà tout faire depuis #23 — revendication `type` dans
      le jeton, `get_current_personnel`, `/auth/personnel/connexion`. C'est le
      **frontend** qui ignore la distinction : `lib/tokenStorage.ts` ne connaît
      qu'un seul jeton, sans notion de population.
      — `CLIENT` et `PERSONNEL` ont des **clés primaires qui se recouvrent**.
      Ranger les deux jetons au même endroit sans les distinguer rouvrirait
      côté navigateur la confusion d'identité que le backend a fermée.
      — **Décision actée : un seul jeton typé**, et non deux jetons
      coexistants. Deux jetons obligeraient l'intercepteur HTTP à savoir quelle
      population une requête vise, donc à porter une notion métier que
      `docs/architecture.md` lui interdit. C'est le même principe que la
      revendication `type` côté backend : un mécanisme qui porte le type,
      plutôt que deux mécanismes parallèles. Un salarié ne peut donc pas être
      simultanément client sur le même navigateur — confort perdu, contrainte
      d'architecture préservée.
      — **Aucun écran métier** dans cette tâche : le socle et une page de
      connexion, rien d'autre. Et **aucune autorisation** — le frontend
      n'affiche pas de droits, il affiche ce que le serveur autorise ; masquer
      un bouton est une commodité, jamais une garantie.
      — Dépendance de la dernière tâche du sprint, et réutilisée ensuite par
      tout le back-office du Sprint 10 ainsi que par l'écran d'administration
      du catalogue livré après le sprint (PRs #88, #90, #91).
      — Livré par #73. Deux écarts au plan, décidés en construisant :
      l'événement `delta:non-authentifie` porte désormais la **population**,
      lue avant l'effacement du jeton — sans elle, un salarié déconnecté était
      renvoyé vers la connexion client ; et `/auth/personnel/connexion` rejoint
      les chemins publics de l'intercepteur, sans quoi une faute de frappe
      déconnectait.
      — Une connexion qui **échoue ne touche à rien** : le remplacement de
      session n'a lieu qu'à la réussite. Cette règle a dû être corrigée en
      cours de revue — elle avait d'abord été écrite à l'envers, effaçant la
      session avant de connaître le résultat.
- [x] Connexion `CLIENT` côté frontend — **rattrapage**
      — **Ne figurait pas au plan de ce sprint** : le manque a été découvert
      en ouvrant le socle ci-dessus, en recensant les appelants de la fonction
      qui ouvre une session. Il n'y en avait aucun.
      — `src/pages/ConnexionPage.tsx` était resté le **gabarit du Sprint 0**
      pendant cinq sprints. Un client ne pouvait pas se connecter par
      l'interface, et tout ce qui avait été construit derrière un compte —
      historique, réservations, parcours connecté — était inatteignable. Le
      parcours invité, lui, n'en a jamais dépendu.
      — **Un seul hook derrière les deux connexions.** Elles ne diffèrent que
      par l'endpoint et le type ; deux copies auraient divergé au jour où l'une
      aurait été corrigée sans l'autre — ce qui venait précisément d'arriver
      sur la règle d'échec. Même raisonnement que
      `PersonnelService.obtenir_avec_fonction`.
      — Livré par #75 (issue #72).
- [x] Inscription `CLIENT`, particulier et entreprise — **rattrapage**
      — Même origine que la précédente : les deux endpoints existaient depuis
      le Sprint 0 et le Sprint 1 sans qu'aucun écran ne les consomme. Sans
      elle, un compte restait impossible à créer par l'interface — le même
      trou déplacé d'un cran.
      — **L'inscription n'ouvre aucune session.** L'API ne renvoie pas de
      jeton ; le frontend redirige vers la connexion avec un message de
      confirmation plutôt que d'enchaîner. Enchaîner créerait un second point
      d'émission de jeton, implicite, alors que le serveur n'en expose qu'un.
      Un test verrouille l'absence d'appel à `/auth/connexion`.
      — **Une seule page pour les deux sous-types**, alors que la connexion en
      a deux : le choix client/personnel découle du compte, celui de
      particulier/entreprise est une déclaration du visiteur.
      — Livré par #76 (issue #74).
- [x] `RESERVATION` type = Table
      — Seul type qui ne porte **aucune cible**. La contrainte n°2 l'autorise,
      puisqu'elle dit « au plus une » et non « exactement une ».
      — **Aucune contrainte d'exclusion n'est possible**, et c'est assumé :
      `EXCLUDE USING gist` a besoin d'une colonne désignant le bien, une
      réservation de table n'en a aucune. Il n'y a littéralement rien à
      verrouiller. Un test le nomme explicitement, pour que l'absence se lise
      comme un choix et non comme un oubli.
      — **Décision actée : aucune table physique n'est modélisée.** Le MLD n'en
      porte pas ; en inventer une ici la ferait naître d'un besoin supposé. Si
      le besoin se manifeste, une entité `TABLE` sera une évolution propre — et
      rendra alors la contrainte d'exclusion possible.
      — Livré par #78. Le type **fonctionnait déjà par construction** : rien n'a
      été écrit pour lui, l'aiguillage le traitant par le cas restant. Treize
      tests verrouillent ce qui n'était jusqu'ici qu'un accident heureux, dont
      un qui **nomme** l'absence de contrainte d'exclusion. Ce test tombera le
      jour où une entité `TABLE` sera introduite, et ce sera le bon signal.
- [x] Lien `RESERVATION → COMMANDE` (le client réserve, puis commande sur place)
      — `COMMANDE.#id_reservation` **existe déjà** au MLD et en base : aucune
      migration attendue, à confirmer en inspectant la base plutôt qu'en s'y
      fiant.
      — **Décision actée : la commande est acceptée si la réservation est
      `Confirmee` ou `Honoree`**, refusée sur `En_attente` et `Annulee`. Le MLD
      disait « honorée », mais l'ordre chronologique et l'ordre des statuts ne
      coïncident pas : on commande **pendant** le service, quand la réservation
      est encore `Confirmee` — exiger `Honoree` rendrait la règle inapplicable
      au moment même où elle sert.
      — Une référence invalide donne **422** et non 404 : elle vient du corps,
      pas de l'URL. Un **statut** qui refuse donne en revanche **409** :
      l'identifiant est valide, c'est l'état qui s'y oppose — même traitement
      qu'une session non `Ouverte` ou un logement non `Disponible`.
      — Livré par #79. Aucune migration : la colonne existait, vérifié dans
      `information_schema` et `pg_constraint` plutôt que supposé depuis le MLD.
      Seule une réservation de type `Table` peut porter une commande, et une
      commande **invitée** ne le peut pas — `RESERVATION.#id_client` est NOT
      NULL, réserver exige un compte.
- [x] Endpoint de prise de commande par le personnel — **rattrapage**
      — **Ne figurait pas au plan.** Le manque a été découvert en préparant
      l'écran ci-dessous : `POST /commandes` rejette un jeton personnel, et
      `POST /commandes/invite` refuse `id_reservation`. Un salarié ne pouvait
      donc créer qu'une commande invitée sans réservation — **le parcours que
      ce sprint compose n'était pas atteignable**, alors que ses deux moitiés
      existaient.
      — Contrairement au couplage hébergement, aucun mécanisme sous-jacent ne
      manquait : il s'agissait uniquement de câblage.
      — **Aucune identité ne vient de la requête.** Le salarié vient du jeton,
      l'acheteur est déduit de `reservation.id_client` ou nommé comme invité.
      Deux chemins mutuellement exclusifs, refusés ensemble en 422.
      — `COMMANDE` gagne `#id_personnel` — nullable, `ON DELETE RESTRICT`.
      `NULL` signifie « la commande vient du parcours client ». Rien ne disait
      jusqu'ici *qui* avait pris une commande, ce qui compte pour une caisse.
      — Une **seule implémentation** de la validation de réservation, partagée
      avec le parcours client ; seul le contrôle de propriété reste propre à ce
      dernier, faute d'acheteur authentifié à comparer côté personnel. Un test
      de conception le verrouille.
      — Livré par #81 (issue #80).
- [x] Interface simplifiée côté personnel pour prise de commande sur place
      — **Dépend du socle d'authentification** ci-dessus : premier écran du
      projet réservé au personnel.
      — Commande `Sur_place`, **sans** `adresse_livraison`, donc **sans
      `LIVRAISON`** — c'est la présence de l'adresse, et elle seule, qui la
      déclenche. Statut terminal `Servie`, lu dans `STATUT_TERMINAL`.
      — Le jeton du salarié **n'identifie pas l'acheteur** : il identifie le
      salarié, enregistré dans `#id_personnel`. L'écran ne porte **aucun champ
      « identifiant client »**, ce qui rend la confusion inexprimable.
      — **Deux paniers, et c'est voulu.** Celui du client persiste dans le
      navigateur ; celui du salarié vit dans un `useState` local. Un salarié
      qui enchaîne les commandes ne veut rien retrouver de la précédente, et
      sur un poste partagé le magasin persistant écraserait le panier du
      client. Seules les **fonctions pures** sont partagées — elles opèrent sur
      un tableau, sans rien savoir d'où il est rangé. Règle écrite dans
      `docs/architecture.md`.
      — Livré par #82.

## Sprint 7 — Abonnement cantine (B2B)

- [x] `ABONNEMENT`, `BENEFICIAIRE`, `CONSOMMATION_REPAS`
      — **7.1 (#95)** : CRUD complet des trois entités. Trois divergences avec
      le modèle du Sprint 0 tranchées en construisant : `ABONNEMENT.date_fin`
      passée `NOT NULL` (+ `CHECK dates_coherentes`), `CHECK
      tarif_selon_facturation` ajouté, `BENEFICIAIRE.statut` devenu domaine
      formel. Contrainte d'exclusion PostgreSQL (`EXCLUDE USING gist`)
      interdisant tout chevauchement d'abonnements actifs sur une même
      entreprise. Deux bugs réels trouvés et corrigés en cours de route :
      un piège d'ordre de route répété sur trois routers (`/administration`
      capté par `/{id}`), et du code mort dans `BeneficiaireService`
      (`get_by_id()` filtrant déjà l'archivage, une branche ne pouvait jamais
      s'exécuter).
- [x] Gestion des deux modes (`mode_suivi`, `type_facturation`)
      — Livré avec 7.1 (#95) : `Individuel`/`Global` et
      `Forfait`/`Consommation_reelle` posés dès le modèle et le `CHECK`, pas
      une tâche distincte.
- [x] Interface admin : gestion des abonnements entreprise + suivi de consommation
      — **7.2 (#97)** : `calculer_solde()` — aucune entité `FACTURE`, calcul
      à la demande à partir de `ABONNEMENT` et de la somme des
      `CONSOMMATION_REPAS` actives, jamais stocké. Modèle repris tel quel en
      8.3 pour `note_moyenne`.
      — **7.3 (#100)** : pages d'administration React (liste, détail,
      formulaire partagé création/édition, suivi de consommation). Deux
      correctifs ciblés livrés séparément juste avant, chacun sa propre PR
      plutôt que noyés dans 7.3 : filtre `id_abonnement` optionnel sur les
      listes d'administration (#98), et `GET /clients-entreprise/administration`
      — endpoint qui n'existait pas du tout, nécessaire au sélecteur
      d'entreprise du formulaire (#99).

## Sprint 8 — Avis clients

- [x] `AVIS` (produit / service), contrôle : uniquement si statut Livrée/Honorée
      — Le modèle et ses contraintes structurelles (`cible_xor`, `note_intervalle`,
      domaine `type_avis`) existaient déjà depuis la migration initiale du
      Sprint 0 ; seules les couches applicatives manquaient. Découpé en deux
      PR distinctes plutôt qu'une seule, le contrôle d'éligibilité n'étant pas
      un sous-produit gratuit du CRUD :
      — **8.1 (#101)** : CRUD de base. `CHECK type_coherent_avec_cible`
      (`(type_avis = 'Produit') = (id_ligne IS NOT NULL)`, single-table,
      même raisonnement que `tarif_selon_facturation`) et deux index uniques
      **partiels** (`uq_avis_client_ligne`, `uq_avis_client_reservation`,
      `WHERE supprime_le IS NULL`) — un avis actif par client et par cible,
      remplaçable après archivage pour modération, même traitement que
      `identifiant_badge`. **Pas de `AvisUpdate`** : un avis se remplace, il
      ne se corrige pas. Lecture publique, création réservée au client
      connecté et propriétaire de la cible (422 identique que la cible soit
      inexistante ou appartienne à un tiers).
      — **8.2 (#102)** : contrôle d'éligibilité, séparé du CRUD de base parce
      qu'il ne l'était pas encore en 8.1. Une commande doit avoir atteint son
      statut terminal — `STATUT_TERMINAL[type_commande]` (`Livree` ou
      `Servie` selon le type, jamais une valeur en dur) — et une réservation
      doit être `Honoree`. Refus en **409** et non 422 : la référence est
      valide, c'est l'état actuel qui s'y oppose — même distinction que pour
      un logement non `Disponible`.
- [x] Affichage note moyenne sur fiche produit / page service
      — **8.3 (#103)** : agrégation à la demande, aucune colonne stockée,
      même principe que `calculer_solde()` en 7.2. `note_moyenne`/`nombre_avis`
      ajoutés aux schemas `*Read` de `PRODUIT`/`SALLE`/`LOGEMENT`/`FORMATION`,
      calculés **uniquement sur la fiche** (`GET /{id}`), jamais sur les
      listes, non paginées. `moyenne_par_formation` agrège au niveau de la
      formation, toutes sessions confondues (double jointure
      `AVIS → RESERVATION → SESSION_FORMATION`), décision actée en
      construisant le sprint — pas au niveau de la session individuelle.
      A révélé et corrigé au passage une incompatibilité SQLite préexistante
      dans `test_formation_router.py` (moteur minimal sans `AVIS`/`RESERVATION`,
      basculé sur `session_postgres`).
      — **8.4 (#104)** : `NoteMoyenne` rejoint `components/ui/` — primitive
      purement présentationnelle, testée pour ne connaître aucune entité du
      MLD, même traitement que `Badge`. `null` → « Pas encore noté », jamais
      `0` ni étoiles vides trompeuses. Nouveau module `features/avis/`
      (`FormulaireAvis`, union discriminée sur `type_avis` comme
      `ReservationEnvoyee`, sans mode édition). Bouton « Déposer un avis »
      inséré à l'historique commandes (par ligne, conditionné à
      `estTerminee()`) **et** à l'historique réservations (conditionné à
      `Honoree`) — les deux ensemble dès ce sprint, le backend couvrant les
      deux cibles symétriquement. Messages 409/422 repris tels quels, même
      traitement que `reservation/` au Sprint 5 ; vérifié de bout en bout
      contre le backend réel via navigateur headless, y compris le refus 409
      sur une course affichage/validation reproduite délibérément.

## Sprint 9 — Paiement en ligne

- [x] Intégration passerelle (carte + mobile money)
- [x] Webhook de confirmation, mise à jour statut commande
      — **Simulé**, en attendant l'obtention des accès API réels aux
      fournisseurs (banques, MVOLA, Orange Money, Airtel Money) — décision
      actée en ouvrant le sprint, malgré la mention initiale « reporté, non
      prioritaire au départ » : l'équipe reste demandeuse des deux moyens de
      paiement, seul l'accès aux API réelles manquait, pas la volonté de
      construire le circuit.
      — **9.1 (#106)** : schéma et migration de `PAIEMENT`. `methode` et
      `fournisseur` en domaines formels (`CHECK`), `statut` sans valeur
      `Rembourse` — délibérément, le remboursement restant hors périmètre de
      ce sprint (cf. `docs/mld.md`). Plusieurs paiements possibles par
      commande (pas de `UNIQUE` sur `id_commande`), pour couvrir nativement
      les tentatives échouées ; un index unique **partiel**
      `uq_paiement_commande_reussi` interdit malgré tout plus d'un paiement
      `Reussi` actif par commande — même architecture à deux niveaux que le
      chevauchement `ABONNEMENT` (#97) et les créneaux `SALLE`/`LOGEMENT`
      (#47). `reference_externe` en `UNIQUE` **globale**, jamais réattribuée
      par un fournisseur.
      — **9.2 (#107)** : `PasserellePaiement`, contrat `Protocol` (non `ABC`)
      pour qu'aucun appelant n'ait à importer une implémentation concrète
      pour se typer. `PasserelleSimulee` configurable à la construction
      (`ComportementSimulation` : toujours_reussi/toujours_echoue/aleatoire)
      — `initier()` écrit **toujours** `En_attente`, jamais `Reussi`
      directement : le comportement configuré ne s'exprime que plus tard,
      via `simuler_confirmation()`, hors du contrat public.
      — **9.3 (#108)** : `POST /commandes/{id}/paiements`, réservé au
      propriétaire. **409** si la commande est `Annulee` ou déjà payée —
      pré-contrôle applicatif **seul**, sans filet d'`IntegrityError` :
      `initier()` ne pouvant jamais écrire `Reussi`, elle ne peut jamais
      violer l'index partiel de 9.1 elle-même. Un test avait d'abord prouvé
      qu'un tel filet, copié d'`AbonnementService`, était du code mort — retiré
      avant merge.
      — **9.4 (#109)** : `POST /paiements/webhook`, public — un vrai
      fournisseur ne porte pas notre jeton. Signature vérifiée **avant** tout
      décodage du corps. Synchronisation `PAIEMENT → COMMANDE` à sens unique
      (`En_attente` → `Confirmee`), même patron que `LIVRAISON → COMMANDE`
      (#25) ; ne régresse jamais un statut de commande déjà plus avancé.
      **C'est ici, et nulle part ailleurs**, que la traduction de la course
      entre deux confirmations concurrentes sur `uq_paiement_commande_reussi`
      vit, en **409**. Deux bogues réels trouvés par les tests avant merge :
      un accès paresseux à `paiement.commande` placé avant le bloc
      `try/except` déclenchait un autoflush qui faisait fuir l'erreur hors du
      filet ; et une `ValidationError` Pydantic levée manuellement n'était pas
      auto-traduite par FastAPI en 422, contrairement à un paramètre de route
      typé — les deux corrigés.
      — **9.5 backend (#110)** : `POST /paiements/{id}/simuler-confirmation`,
      pour déclencher depuis l'écran de paiement la confirmation qu'un vrai
      fournisseur enverrait de lui-même. **Fermé par défaut** derrière
      `Settings.ENVIRONMENT` (défaut fermé `production`) : refuse hors
      `developpement` avec le même 404 générique qu'un paiement introuvable.
      Dette technique assumée et non résorbée par cette garde — voir la table
      ci-dessous.
      — **9.5 frontend (#111)** : `features/paiement/`, même structure que
      `features/avis/` (8.4). Formulaire méthode/fournisseur → initiation →
      affichage du statut, bouton de simulation **masqué** hors
      `VITE_ENVIRONMENT=developpement` (confort d'affichage seulement, la
      garde réelle reste le 404 backend de 9.5 backend). `useHistorique`
      gagne `recharger()` pour refléter `COMMANDE.statut` après confirmation.
      Vérifié de bout en bout via navigateur réel contre le backend réel,
      dans les deux environnements.

## Sprint 10 — Back-office avancé & reporting

- [x] Interface complète de gestion `PERSONNEL` (tableau de bord — le CRUD de base
      est déjà fait au sprint 3, ne pas le refaire) — livré par 10.1.
- [x] Tableau de bord commandes/réservations/abonnements — livré par 10.2 à
      10.6 (voir le découpage détaillé ci-dessous).
      — Porte les **trois actions administratives** laissées en suspens par #25
      (Sprint 3) sur une livraison `Echouee` : **relancer la livraison**,
      **rembourser**, **annuler la commande**. Elles n'existent nulle part
      aujourd'hui, et c'était un manque volontaire adossé à cette case — un
      tableau de bord n'est pas qu'un outil de lecture, il porte aussi ces
      écritures.
      — Rappel de la règle de #25 : la synchronisation reste à **sens unique**.
      Ces actions écrivent `COMMANDE.statut` depuis une décision humaine, elles
      ne rétablissent pas une propagation automatique depuis `LIVRAISON`.

### Découpage détaillé validé (10.1 → 10.6)

Établi après un état des lieux vérifié dans le code (routers/services réels,
pas supposés) : l'état du backend diffère significativement entre `PERSONNEL`
(CRUD déjà complet), `ABONNEMENT` (dashboard admin déjà livré au Sprint 7.3)
et `RESERVATION`/`COMMANDE` (aucune route administrative aujourd'hui). D'où un
découpage en six tâches plutôt que les deux lignes ci-dessus, chacune sa
propre PR (backend et frontend séparés pour 10.1, comme pour 9.1/9.2).

- [x] **10.1 — Dashboard `PERSONNEL`** : backend d'abord (#113) — un seul
      endpoint, `POST /personnel/{id}/anonymisation`, admin uniquement,
      expose `PersonnelService.anonymiser()` (déjà implémenté depuis #23,
      jamais exposé par API). Puis frontend — `features/personnel/`,
      même structure que `features/abonnement/` : liste filtrable par
      fonction, fiche, formulaire création/édition, archivage,
      restauration, et le bouton d'anonymisation.
      — **Constat vérifié en construisant le frontend** : `GET /personnel`
      n'expose aucun paramètre `inclure_supprimes` (contrairement à `GET
      /produits/administration`), donc une ligne tout juste archivée ou
      anonymisée redevient introuvable via l'API. La fiche compense en
      gardant sa dernière donnée locale connue plutôt que de recharger
      après ces deux actions, et propose la restauration en **annulation
      immédiate** plutôt qu'une gestion d'archives persistante — décision
      actée avant l'implémentation, pas une dette : aucun endpoint
      `/personnel/administration` n'existe pour lister les archivés, et
      n'en a pas été demandé.
- [x] **10.2 — `RESERVATION` administration (backend)** : `GET
      /reservations/administration` et `/administration/{id}` (les 4 types),
      même ordre de déclaration que `abonnement_router.py`
      (`/administration` avant la route paramétrée). **Corrige un gap
      d'intégrité pré-existant, pas une extension** : `PUT
      /reservations/{id}/statut` (client) n'accepte plus que `Annulee` —
      rien n'empêchait auparavant un client de marquer sa propre réservation
      `Honoree`, ce qui débloquait un avis de service sans prestation réelle
      (cf. `avis_service.py`). `Honoree` devient une transition
      administrative dédiée, `PUT
      /reservations/administration/{id}/statut`, réservée à
      `PersonnelAdministrateur`.
      — La garantie est portée par le **schema**, pas par une vérification
      manuelle dans le routeur : `ReservationAnnulation.statut` est typé
      `Literal[StatutReservation.ANNULEE]`, Pydantic rejetant en 422 toute
      autre valeur avant même d'atteindre le service — même philosophie que
      les champs délibérément absents de `PersonnelCreate`. Vérifié
      empiriquement de bout en bout : un client qui tente `Honoree` reçoit
      422 et la ligne reste inchangée en base ; un administrateur peut la
      marquer `Honoree`, ce qui débloque ensuite avec succès le dépôt d'un
      avis de service sur cette réservation. Documenté dans `docs/mld.md`.
- [x] **10.3 — `RESERVATION` administration (frontend)** : vue
      administration dans `features/reservation/` (le module ne portait
      jusqu'ici que l'écriture client), les 4 types, actions « Marquer
      honorée » / « Annuler » réservées à l'écran admin, consommant 10.2.
      — Une seule page, actions en ligne : pas de fiche séparée comme
      `PERSONNEL`, les deux actions étant de simples transitions de statut.
      — Le filtre type/statut est **côté client** : `GET
      /reservations/administration` ne porte aucun paramètre de filtre
      (contrairement à `GET /personnel`) — décision actée pour ne pas
      rouvrir le backend d'une tâche frontend. Les boutons se masquent
      selon le statut courant (`Annulee` : aucune action ; `Honoree` :
      seule « Annuler » reste) pour ne pas laisser l'utilisateur découvrir
      un refus 409 après coup. Vérifié de bout en bout via navigateur réel
      contre le backend réel.
- [x] **10.4 — `LIVRAISON.relancer()` (backend)** : transition dédiée et
      **unique** `Echouee → En_attente`, `POST
      /livraisons/{id}/relance`, réservée `PersonnelAdministrateur`.
      `STATUTS_TERMINAUX` reste **inchangé** — cette méthode contourne
      délibérément `_refuser_si_terminee`, elle ne l'affaiblit pas : elle
      refuse elle-même (409) toute provenance autre que `Echouee`, avec son
      propre message. `id_personnel` repasse à `NULL` après relance : force
      une réaffectation explicite, cohérence avec le sens déjà établi de
      `NULL` (« pas encore affectée »). Vérifié de bout en bout via un
      serveur réel : refus 409 sur une livraison `En_attente`, relance
      réussie depuis `Echouee` avec `id_personnel` remis à `NULL` en base,
      et rejeu refusé (409) une fois la livraison redevenue `En_attente`.
- [x] **10.5 — `COMMANDE` administration + actions (backend)** : `GET
      /commandes/administration` et `/administration/{id}`. **Annuler** :
      `PUT /commandes/administration/{id}/statut`, schema
      `CommandeAnnulationAdministration.statut: Literal[Annulee]` — même
      garantie structurelle que `ReservationAnnulation` (10.2), Pydantic
      refuse toute autre valeur en 422 avant même d'atteindre le service.
      **409** si déjà `Annulee`, ou déjà au statut terminal de son type
      (`Livree`/`Servie` via `STATUT_TERMINAL`). Aucune propagation vers
      `LIVRAISON` (synchronisation à sens unique, rappel ci-dessus).
      **Rembourser** : `POST
      /commandes/administration/{id}/remboursement`, **ne touche pas
      `PAIEMENT`** — nouvelle colonne `COMMANDE.rembourse_le TIMESTAMPTZ
      NULL`, miroir direct de `supprime_le`. Idempotent, aucun statut exigé
      en préalable. Migration Alembic + mise à jour `docs/mld.md` avec le
      paragraphe explicite : geste manuel simplifié (remboursement traité
      hors système — espèces, virement), **pas** une intégration réelle
      remboursement↔`PAIEMENT`. La question `type_operation` documentée dans
      `docs/mld.md` (section Paiement) reste une dette **distincte et non
      résolue** par ce geste.
      — `docs/architecture.md` corrigé : l'invariant « `COMMANDE.statut`
      n'est écrit qu'à deux endroits » n'est plus exact tel quel depuis ce
      sprint — un troisième chemin existe désormais, mais délibérément
      restreint à la seule valeur `Annulee`, un seul appelant
      (`PersonnelAdministrateur`). Vérifié de bout en bout via un serveur
      réel : 422 sur toute valeur hors `Annulee`, annulation réussie, rejeu
      refusé en 409, remboursement posant l'horodatage sans créer ni
      modifier aucune ligne `PAIEMENT`.
- [x] **10.6 — `COMMANDE` administration (frontend)** : vue administration
      dans `features/commande/` — liste, filtre par statut, fiche avec les
      trois actions (annuler, relancer la livraison via 10.4, marquer
      remboursée via 10.5). Panneau « Réservations » et panneau
      « Abonnements » : **simples liens** vers les écrans de 10.3 et de
      l'administration abonnements déjà livrée au Sprint 7.3 — pas de
      nouvelle page agrégeant les trois domaines.
      — **Liste + fiche, contrairement à 10.3** (une seule page, actions en
      ligne) : les trois actions d'une commande ne sont pas des transitions
      de statut interchangeables — chacune ses propres conditions
      d'apparition —, les regrouper en ligne aurait produit un tableau
      illisible. Même choix que PERSONNEL et ABONNEMENT.
      — **Aucun endpoint « livraison d'une commande » côté personnel** :
      `GET /commandes/{id}/livraison` (client) répond en 401 à un jeton
      personnel, et rien d'équivalent n'existe côté administration. La fiche
      retrouve donc la livraison `Echouee` d'une commande en filtrant
      `GET /livraisons?statut=Echouee` côté client sur `id_commande` — sans
      demander la liste complète, puisque le bouton « Relancer » n'a de sens
      que sur ce seul statut. `LivraisonAdministration` (portant
      `id_livraison`) rejoint `livraison.types.ts` à cette occasion : premier
      type frontend miroir de `LivraisonRead`, `SuiviLivraison` restant celui
      de `LivraisonPublique` pour le parcours client.
      — **Aucun état local à préserver entre actions**, contrairement à
      `PersonnelDetailAdministrationPage` : ni `annuler` ni `rembourser`
      n'archivent la commande (`supprime_le` n'est jamais touché), la fiche
      peut donc simplement se recharger depuis le serveur après chacune.
      — **Bug de nav trouvé et corrigé en construisant** : le nouveau chemin
      `personnel/commandes/administration` partage le préfixe
      `personnel/commandes` avec « Prise de commande » (Sprint 6). Sans
      `end` sur ce `NavLink`, le lien « Prise de commande » restait
      surligné actif sur la fiche d'une commande administrée — corrigé en
      marquant ce lien `exact`, seul touché par la collision de préfixe.
      Constaté par capture d'écran lors de la vérification de bout en bout,
      pas en relisant le code.
      — Vérifié de bout en bout via un serveur réel (Playwright) : liste
      chargée et filtrable, liens Abonnements/Réservations corrects,
      remboursement puis annulation sur une commande sans livraison,
      relance réussie sur une commande à livraison `Echouee` avec
      disparition du bouton une fois la tournée redevenue `En_attente`.

**Travaux hors sprint : administration du catalogue produit.** L'**administration du
catalogue produit** a reçu son interface après le Sprint 6 (PRs #88, #90, #91 le 3 sept).
Le CRUD API était protégé par `get_current_personnel_administrateur` depuis le Sprint 3, mais
aucun écran ne le consommait. Un administrateur en était réduit à `curl`.

Le travail n'était pas planifié au Sprint 7, mais c'était une continuité logique du
Sprint 3 : trois PRs successives ont ajouté la restauration (#88), les listes
d'administration (#90), et l'interface (#91). Le **socle d'authentification
`PERSONNEL` côté frontend (#73)** était la véritable dépendance commune — sans lui,
aucun écran réservé au personnel n'était accessible, y compris celui du catalogue.
C'est pourquoi ce travail a pu démarrer une fois #73 livré, sans attendre un
découpage formel de sprint.

## Sprint 11 — Durcissement pré-production

Le roadmap métier est fonctionnellement complet à l'issue du Sprint 10 : les 21
tables du MLD sont toutes couvertes (voir « Traçabilité MLD → sprints »), et
aucune table n'attend de sprint. Décision actée en clôturant le Sprint 10 :
**pas de nouveau sprint métier** — ce sprint consacre le temps d'équipe à la
dette technique critique accumulée depuis le Sprint 0, listée depuis
plusieurs sprints dans « Dette technique » sans jamais avoir reçu
d'atterrissage explicite, malgré deux échéances déjà écrites et dépassées
(« après validation du Sprint 7 », puis « en parallèle du Sprint 10 »).

Quatre éléments sont **bloquants avant mise en production**. Deux de plus
— déjà dans la table de dette, pas nouveaux — sont ajoutés à ce sprint parce
qu'ils appellent une décision explicite plutôt qu'un oubli silencieux.

Ordre validé (le plus mécanique et le moins risqué d'abord ; T0.10 en
dernier, seul à toucher un mécanisme transverse déjà en place et testé sur
neuf sprints) :

- [x] **T0.5 — Séparation des identifiants dans `docker-compose.yml`**
      (réduction de surface d'exposition). Durée estimée : 0,5 jour.
      — État réel vérifié avant codage (pas seulement le texte du roadmap) :
      `docker-compose.yml` chargeait `backend/.env` en entier via `env_file`,
      donc `SECRET_KEY` et `DATABASE_URL` sans aucun usage pour Postgres.
      `Settings` (`core/config.py`) exige `POSTGRES_USER`/`PASSWORD`/`DB`
      dans `backend/.env` — les en retirer aurait cassé cette validation.
      — Nouveau fichier **dédié**, `docker/.env` (+ `docker/.env.example`,
      `docker/.gitignore`), portant uniquement les trois clés Postgres,
      **dupliquées** de `backend/.env` et non déplacées — les deux fichiers
      restent la source de vérité chacun pour son consommateur.
      `docker-compose.yml` pointe désormais dessus. Aucun code applicatif
      touché.
      — Vérifié de bout en bout : `docker exec delta-postgres env` ne montre
      plus que les trois clés Postgres (`SECRET_KEY`/`DATABASE_URL` absents) ;
      `alembic current` depuis le backend reste inchangé (`fb2aad84bf48`,
      head) — la base et sa connexion applicative n'ont pas bougé ; et
      `docker/.env` absent fait échouer `docker compose up` bruyamment
      (`env file ... not found`), même garantie qu'avant sur `backend/.env`.
- [x] **T0.7 — Trigger PostgreSQL d'exclusivité `CLIENT`** (sécurité de base
      de données). Durée estimée : 0,5 jour. Migration `4cfa278b3371`.
      Purement additif côté application — `auth_service.py` documentait déjà
      l'absence du trigger et la garantie transactionnelle qui tient lieu de
      filet ; même patron à deux niveaux que le chevauchement `ABONNEMENT`
      ou les créneaux `SALLE`/`LOGEMENT`.
      — **Race condition trouvée et fermée avant tout code**, sur demande
      explicite de vérification empirique plutôt que sur le seul
      raisonnement : un trigger différé naïf (`SELECT count(*)`, sans
      verrou) laisse passer deux transactions concurrentes ajoutant chacune
      une ligne fille différente à un même client orphelin — chacune compte
      `0+1=1` avant de voir l'insertion, non commitée, de l'autre.
      Reproduit à 5/5 avec deux connexions réelles synchronisées par
      barrière. Un `SELECT ... FOR UPDATE` sur `client` ferme la race mais
      entre en **deadlock** avec le verrou `FOR KEY SHARE` que PostgreSQL
      pose déjà implicitement sur cette ligne pour les FK des tables filles
      (confirmé empiriquement) — écarté au profit de
      `pg_advisory_xact_lock(id_client)`, indépendant de ce système de
      verrous, qui ferme la race proprement (0 violation sur 10+ runs,
      aucun deadlock).
      — Trois `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`, sur
      `client`, `client_particulier` **et** `client_entreprise` — pas une
      seule table : sur `client` seule, « aucune ligne fille » serait
      couvert mais pas « les deux » ajoutées dans deux transactions
      distinctes après coup ; sur les deux tables filles seules, l'inverse.
      Hors périmètre assumé : une suppression manuelle d'une ligne fille
      existante (seul `AFTER INSERT` est visé) — cohérent avec la menace
      documentée (écritures erronées, pas suppressions).
      — Nouveau fichier `test_client_exclusivite_postgres.py` : les
      scénarios simples utilisent `session_postgres` avec
      `SET CONSTRAINTS ALL IMMEDIATE` pour forcer la vérification différée
      sans vrai commit (le `commit()` de cette fixture n'est qu'un
      `SAVEPOINT`) ; le test de course, lui, ouvre ses deux propres
      connexions réelles — `session_postgres` ne peut structurellement pas
      porter un scénario à deux transactions véritablement séparées.
- [x] **T0.6 — Rate limiting** (`/auth/connexion`, `/auth/personnel/connexion`).
      Durée estimée : 1-2 jours. Prévient le credential stuffing et la force
      brute.
      — **Le verrouillage de compte, nommé dans le titre d'origine, n'est
      pas traité par cette tâche** : le périmètre confirmé avant codage
      portait uniquement sur le rate limiting par IP. C'est une dette
      distincte, non résorbée — voir la note dédiée ci-dessous.
      — **Décision actée : limiteur en mémoire (`memory://`), pas Redis.**
      Aucun plan de déploiement multi-workers/multi-instance n'existe à ce
      jour (aucun `Dockerfile` backend, aucune commande `uvicorn --workers`,
      aucune plateforme cible documentée) — introduire Redis maintenant
      ajouterait un service d'infrastructure réel pour un besoin qui n'existe
      pas encore. Le code (`slowapi`/`limits`) choisit son backend par URI
      (`Settings.RATE_LIMIT_STORAGE_URI`) : passer à `redis://...` le jour
      où le déploiement scale sera un changement de configuration, pas une
      réécriture. Limite condition de résorption ci-dessous.
      — `app/core/rate_limit.py` (nouveau module, même esprit que
      `security.py`/`deps.py`) porte le `Limiter` et la constante
      `LIMITE_CONNEXION = "5/minute"`, partagée par les deux endpoints pour
      qu'ils évoluent ensemble. Traduction dédiée de `RateLimitExceeded` en
      429 dans `main.py`, `{"detail": ...}` plutôt que le `{"error": ...}`
      par défaut de `slowapi`.
      — Piège trouvé en écrivant les tests : le limiteur est un singleton de
      *process*, partagé par tous les tests pytest comme par l'application
      réelle. Sans réinitialisation, un test sans rapport avec le rate
      limiting aurait pu recevoir 429 simplement parce qu'un test antérieur
      avait déjà consommé le budget de la même IP simulée. Autofixture
      `_reinitialiser_le_limiteur` dans `conftest.py`, appliquée à toute la
      suite.
      — Vérifié : les deux endpoints ont des budgets **indépendants** (un
      décorateur par route), un compte inconnu au-delà de la limite répond
      429 avant même d'atteindre `AuthService`, et le message reste dans le
      vocabulaire `{"detail": ...}` du reste de l'API.
- [x] **T0.10 — Jeton en `httpOnly` + CSRF** (`localStorage` → cookie
      sécurisé). Durée estimée à revoir — 2-3 jours ne couvrait que
      l'émission du cookie. Affecte CLIENT et PERSONNEL des deux côtés.
      **Micro-conception écrite exigée avant tout découpage en tâches** :
      contrat du futur endpoint `/auth/moi`, stratégie CSRF, et la façon
      dont `useEstConnecte`/`useEstPersonnelConnecte` deviennent
      asynchrones (état de chargement explicite, plus une lecture
      synchrone de `localStorage`). Décision actée : pas de second cookie
      non-`httpOnly` portant le type de session, ce qui resterait une
      fuite d'information exploitable par XSS et affaiblirait l'objectif
      même de la migration. Rayon d'impact mesuré : 17 fichiers de tests
      backend authentifient via en-tête `Bearer`, 24 fichiers frontend
      touchent `tokenStorage` directement ou indirectement.
      **Migration au déploiement, actée et non un angle mort** : un
      utilisateur porteur d'un ancien jeton en `localStorage` au moment
      du bascule ne bénéficie d'aucun mécanisme de transition — le
      nouveau frontend cesse purement et simplement de lire
      `localStorage`, ce jeton devient donc mort à l'instant du
      déploiement. Au premier chargement post-déploiement, cet
      utilisateur est traité comme non connecté (`GET /auth/moi` répond
      401, faute de cookie) et doit simplement se reconnecter une fois
      via le nouveau flux à cookie. Aucun mécanisme de bascule n'est
      nécessaire ni prévu : le jeton en `localStorage` restait de toute
      façon soumis à expiration (`ACCESS_TOKEN_EXPIRE_MINUTES`), donc à
      une reconnexion déjà attendue à plus ou moins brève échéance —
      cette migration ne fait qu'avancer ce moment pour tout le monde
      simultanément, une seule fois.
      — **Backend livré** : `core/cookies.py` (émission/effacement des deux
      cookies, `Secure` conditionné à `Settings.ENVIRONMENT` comme la garde
      de simulation-paiement) ; `core/security.py` porte désormais une
      revendication `csrf` dans le JWT (`JetonEmis`, générée à l'émission,
      jamais séparément) ; `core/csrf.py` un middleware unique de
      double-submit sur les méthodes mutantes, enregistré **avant**
      `CORSMiddleware` (Starlette empile en ordre inverse d'enregistrement,
      CORS doit envelopper CSRF pour que ses en-têtes atteignent aussi un
      403 anti-CSRF) ; `get_current_client`/`get_current_personnel` lisent
      désormais le cookie `delta_session` plutôt que l'en-tête
      `Authorization` ; nouveau `session_router.py` (`GET /auth/moi`,
      `POST /auth/deconnexion`), séparé des deux routers de connexion
      existants parce qu'aucun des deux n'est le bon propriétaire d'un
      endpoint qui ne connaît la population qu'après lecture du cookie.
      `/auth/connexion` et `/auth/personnel/connexion` ne renvoient plus le
      jeton dans le corps — `SessionActive{type}` remplace `Token`, **le
      même schema** pour la connexion et pour `/auth/moi`, pour que les deux
      ne divergent jamais l'un de l'autre.
      — **Migration des tests, conforme au rayon d'impact mesuré** : les 17
      fichiers de tests backend authentifiant par `Authorization: Bearer`
      sont passés au cookie de session. `authentifier()` (nouveau,
      `conftest.py`) pose `Cookie` comme un **en-tête de requête ordinaire**
      plutôt que sur le cookie-jar partagé du `TestClient` — une première
      version posait la session sur ce jar, qui s'est révélée fausse dès
      qu'un test authentifie deux identités différentes dans le même corps
      (comparer l'entreprise A à l'entreprise B, par exemple) : la seconde
      authentification écrasait la première pour tout appel suivant. Un
      en-tête par requête restaure exactement le modèle de l'ancien
      `Authorization` — un jeton par requête, jamais une session partagée
      entre elles — et rend chaque appel indépendant des autres, quel que
      soit le nombre d'identités qu'un test juxtapose.
      — Vérifié de bout en bout : suite complète verte (1106/1106) sur une
      base fraîchement migrée (`alembic upgrade head` sur une base vierge,
      comme en CI) — les échecs observés en cours de route sur la base de
      développement se sont confirmés comme de la pollution de données
      pré-existante, sans rapport avec cette branche, une fois rejoués sur
      base neuve. `ruff`, `black --check`, `alembic check` propres.
      — **Frontend livré** (PR séparée, même découpage que 9.1/9.2) :
      `lib/tokenStorage.ts` supprimé, remplacé par `lib/session.store.ts` —
      magasin externe minimal (`useSyncExternalStore`), même patron que
      `commande.panier.ts`, mais sans persistance `localStorage` : la source
      de vérité est désormais le cookie, invisible en JS par construction, ce
      magasin n'étant qu'un cache de la dernière réponse serveur.
      `axiosClient.ts` pose `withCredentials: true` et un double-submit
      (lecture du cookie `delta_csrf`, en-tête `X-CSRF-Token`) sur les
      méthodes mutantes ; `/auth/moi` rejoint les chemins publics du 401 — un
      visiteur jamais connecté y reçoit systématiquement 401 à chaque
      chargement de page, ce n'est pas une session qui expire.
      — **Un point d'ambiguïté non couvert par la micro-conception d'origine** :
      celle-ci ne nommait `RoutePersonnel` comme ayant besoin de l'état de
      chargement explicite. Un audit des 9 consommateurs métier de
      `useEstConnecte` a montré que `MesReservationsPage.tsx` gate à la fois
      son rendu et son effet de chargement sur ce booléen — sans traitement
      particulier, un client réellement connecté y aurait vu, à chaque
      chargement de page, un flash « connectez-vous » suivi d'un chargement
      tardif de ses réservations. Décision actée : `useChargementSession()`
      (nouveau) consulté seulement dans ces deux fichiers ; les 7 autres
      consommateurs gardent le booléen simple, leur flash éventuel n'ayant
      qu'un coût cosmétique.
      — **Déconnexion sans rechargement complet**, décidé en construisant :
      `MainLayout.seDeconnecter` portait un commentaire nommant explicitement
      cette dette (« le remplacer par un magasin réactif est une amélioration
      à part entière, pas un préalable ») — ce chantier construisant
      justement ce magasin, le moment était le bon pour la traiter plutôt que
      la reporter encore. `POST /auth/deconnexion` (nécessaire : le cookie
      `httpOnly` ne peut être effacé que par le serveur) puis
      `effacerSession()` puis `naviguer('/')` via React Router — le magasin
      réactif et la navigation suffisent, sans plus jamais recharger la page.
      — Vérifié empiriquement (Playwright, navigateur réel, serveurs de
      développement réels) qu'aucun état résiduel ne survit visuellement à
      cette déconnexion sans rechargement : un article ajouté au panier
      avant la connexion traverse connexion → rechargement de page →
      déconnexion sans en perdre le compte (1 → 1 → 1) — attendu, puisque
      `commande.panier.ts` est un magasin indépendant de la session, jamais
      vidé par elle ; la navigation (liens « Mes commandes », bouton
      « Déconnexion ») se met à jour sans rechargement ; les deux cookies
      disparaissent après déconnexion ; une reconnexion immédiate après
      réussit sans blocage CSRF résiduel.
      — Suite complète verte (439/439, 52 fichiers), `ruff`-équivalents
      (`eslint`, `prettier --check`), `tsc --noEmit` et `vite build` propres.
- [x] **Sprint 9.5 — décision sur `POST /paiements/{id}/simuler-confirmation`** :
      retirer l'endpoint (backend et bouton frontend) maintenant, ou
      confirmer qu'il reste dette active tant qu'aucune vraie passerelle
      n'est branchée. Pas une investigation de code — la garde
      `Settings.ENVIRONMENT` fonctionne comme documenté, c'est un arbitrage
      produit.
      — **Décision actée en clôturant le Sprint 11** : gardé tel quel.
      Aucune vraie passerelle (Mvola, Stripe...) n'est branchée à ce jour ;
      l'endpoint reste le seul moyen de tester le parcours de paiement de
      bout en bout en développement. Le retirer maintenant casserait ce
      test sans rien gagner en sécurité — la garde `Settings.ENVIRONMENT`
      ferme déjà la production. Reste dette active, condition de
      résorption inchangée (voir tableau ci-dessous) : à retirer dès
      qu'une vraie passerelle est branchée, quel que soit l'environnement.
- [x] **Sprint 10.3 — évaluation du verrou de ligne sur `changer_statut()`** :
      traiter maintenant (`UPDATE` conditionnel ou verrou de ligne, même
      patron que le décrément de `places_restantes`) ou documenter
      explicitement comme non urgent selon la taille réelle de l'équipe
      d'administration.
      — **Décision actée en clôturant le Sprint 11** : documenté comme non
      urgent, non traité maintenant. Back-office à faible trafic, peu
      d'administrateurs actifs simultanément — la course reste théorique,
      pas justifiée par un usage observé. Reste dette active, condition de
      résorption inchangée (voir tableau ci-dessous) : à traiter avant mise
      en prod si l'équipe d'administration grossit.

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
| T0.10 (Sprint 0) | Les jetons d'accès **CLIENT et PERSONNEL** sont stockés ensemble en `localStorage` (`frontend/src/lib/tokenStorage.ts`) : lisibles par tout script de la page, donc exfiltrables en cas de faille XSS. La dette s'applique aux deux populations depuis l'ajout de PERSONNEL en #73. | Basculer sur un cookie `httpOnly` + `SameSite`, ce qui suppose de faire émettre le cookie par l'API et d'ajouter une protection CSRF. **À arbitrer avant mise en prod.** |
| T0.6 (Sprint 11) | **Conditionnellement critique.** Rate limiting fonctionnel en mémoire (`RATE_LIMIT_STORAGE_URI=memory://`), correct uniquement pour un déploiement mono-processus/mono-instance. Devient inefficace (limite multipliée par le nombre de workers) dès qu'une mise en production ajoute du scaling horizontal. Pas critique dans l'immédiat : aucun plan de déploiement multi-instance n'existe à ce jour. | Brancher Redis (`RATE_LIMIT_STORAGE_URI=redis://...`) **avant tout déploiement multi-workers** — le code applicatif n'a pas besoin de changer, seule la configuration. |
| T0.10 (Sprint 11, micro-conception) | **Conditionnellement critique.** La micro-conception du cookie de session retient `SameSite=Lax`, qui suppose que frontend et backend restent sur le même site au sens des cookies (même domaine ou sous-domaines d'un même domaine de premier niveau) — aucune topologie de déploiement n'existe à ce jour pour le confirmer (même constat que la dette Redis ci-dessus : aucun `Dockerfile`, aucune plateforme cible documentée). Sous `SameSite=Lax`, un déploiement sur deux domaines de premier niveau distincts empêcherait purement et simplement l'envoi du cookie `delta_session` sur les requêtes cross-site de l'API, cassant l'authentification plutôt que de l'affaiblir silencieusement. | Si frontend et backend finissent sur des domaines de premier niveau différents, revoir `SameSite=None` + renforcer le double-submit — `SameSite=None` exige `Secure` et retire la protection de fait qu'apportait `Lax` contre l'envoi cross-site, le double-submit CSRF devient alors la **seule** défense et non plus une défense en profondeur. **Aucune session déjà ouverte ne bascule automatiquement** : l'attribut `SameSite` est fixé par le serveur au moment où il pose le cookie et ne se réécrit pas rétroactivement sur un cookie déjà émis — un changement de topologie invalide de fait toutes les sessions actives sous l'ancien attribut, qui devront se reconnecter, exactement comme un changement de `SECRET_KEY`. À trancher dès que la topologie de déploiement est connue, avant toute mise en prod. |
| T0.6 (Sprint 0) | Le verrouillage temporaire de compte après N échecs — nommé dans le titre d'origine de T0.6 — reste absent : seul le rate limiting par IP a été traité (ci-dessus). Le hachage bcrypt ralentit une attaque par force brute ciblée sur un seul compte sans l'empêcher. | Ajouter un verrouillage progressif par compte, distinct du rate limiting par IP déjà en place. Pas encore planifié. |
| PR #95 (Sprint 7) | `.github/workflows/ci.yml` utilise `actions/checkout@v4`, `actions/setup-python@v5` et `actions/setup-node@v4`, qui ciblent Node.js 20 — déprécié par GitHub Actions. Chaque run affiche désormais `##[warning] Node.js 20 is deprecated…` sur les deux jobs (Backend et Frontend), sans faire échouer la CI. Constaté en vérifiant les annotations de la PR #95, sans rapport avec le code applicatif. | Mettre à jour ces actions vers une version ciblant Node.js 24. Basse priorité, non bloquant : le warning n'affecte ni le résultat des checks ni le comportement de l'application — à traiter quand une PR touche de toute façon `ci.yml`, plutôt que d'ouvrir un chantier dédié. |
| PR #123/#127 (Sprint 11) | Les checks GitHub d'une PR vers `develop` s'affichent sous le nom **« CI (main) »**, pas « CI (develop) » — alors que le fichier réel exécuté sur `develop` porte bien `name: CI (develop)` (vérifié). GitHub associe le nom affiché d'un workflow à son chemin de fichier à travers tout le dépôt, ancré sur la version du **default branch** (`main`) pour ce chemin, et non sur la branche qui déclenche le run. Purement cosmétique : le job réellement exécuté, ses durées et son contenu sont corrects et inchangés (confirmé via `gh api .../check-runs` et les logs de run). | Donner aux deux workflows des chemins de fichiers distincts (ex. `ci.yml` sur `develop`, `ci-main.yml` sur `main`) pour qu'ils deviennent deux entités « Workflow » GitHub réellement séparées. Basse priorité, non traité pour l'instant — aucun impact sur la fiabilité de la CI, seulement sur l'étiquette affichée. |
| Sprint 9.5 | `POST /paiements/{id_paiement}/simuler-confirmation` déclenche, depuis l'écran de paiement, la confirmation qu'un vrai fournisseur enverrait normalement de lui-même par webhook. Fermé par défaut derrière `Settings.ENVIRONMENT` (défaut `production`, même 404 générique qu'un paiement introuvable hors `developpement`) — mais cette garde ne retire pas le code : si une vraie passerelle (Mvola, Stripe...) est un jour branchée en environnement `developpement`, l'endpoint continuerait d'y répondre à côté d'elle. | Retirer cet endpoint (backend et bouton frontend) dès qu'une vraie passerelle est branchée, quel que soit l'environnement — un vrai fournisseur confirme de lui-même, ce déclencheur manuel n'aurait alors plus de sens et deviendrait une porte dérobée pour confirmer un paiement sans jamais l'avoir réellement payé. `ENVIRONMENT` protège la production dès maintenant ; la suppression du code reste **à traiter avant mise en prod**. |
| Sprint 10.3 | `GET /reservations/administration` (10.2) ne porte aucune pagination ni paramètre de filtre — toute la collection active est renvoyée en un seul appel, et le filtre type/statut de `AdministrationReservationsPage` s'applique côté navigateur sur ce tableau complet. Négligeable aujourd'hui (4 lignes actives en développement), mais même schéma que le filtre `id_abonnement` ajouté après coup en 7.1 (#98) : un trou qui ne coûte rien tant que le volume reste faible. | Ajouter la pagination et/ou des paramètres de filtre serveur (`type_reservation`, `statut`) à `GET /reservations/administration` **si le volume de réservations actives devient un point de lenteur réel** — pas avant : la correction déplacerait une décision d'affichage vers un endpoint qui sert potentiellement d'autres usages. |
| Sprint 10.3 | `ReservationService.changer_statut()` relit la réservation puis écrit son nouveau statut sans verrou de ligne (`SELECT ... FOR UPDATE`) ni `UPDATE` conditionnel atomique — contrairement au décrément de `places_restantes` (`docs/architecture.md`, « Un compteur ne se lit pas avant de s'écrire »). La restitution des places ne s'appuie que sur une idempotence applicative (« relis, vérifie en mémoire, écris »), déjà documentée comme telle. Pas un problème introduit par 10.2/10.3 — ce comportement date du Sprint 4/5 et est partagé avec l'annulation client — mais **10.3 le rend concrètement plus probable** : plusieurs administrateurs peuvent désormais agir sur la même réservation depuis le même tableau de bord, alors qu'avant seul le client pouvait déclencher une double requête sur sa propre réservation. Une course entre deux administrateurs simultanés pourrait théoriquement créditer deux fois les places d'une même annulation. | Faire porter la transition par un `UPDATE` conditionnel (`WHERE statut = :statut_attendu`) ou un verrou de ligne explicite, même patron que le décrément. À évaluer une fois qu'un usage réellement concurrent du tableau de bord (plusieurs administrateurs actifs simultanément) est probable — pas une urgence pour un back-office à faible trafic, mais **à traiter avant mise en prod** si l'équipe d'administration grossit. |
| Inspection QA (`docs/checkliste-inspection-admin.md`, section 3) | **Priorité moyenne.** Sur `personnel/commandes/administration` (liste et fiche), le nom et le contact d'une commande invitée (`nom_invite`/`contact_invite`) ne s'affichent **nulle part** — ni `AdministrationCommandesPage.tsx` ni `CommandeDetailAdministrationPage.tsx` ne les rendent. Pas une absence structurelle comme le vendeur d'une commande `Servie` (`id_personnel`, absent de `CommandeRead` lui-même) : ici, `CommandeRead` (backend) expose bien les deux champs, et `commande.types.ts` les type déjà côté frontend — c'est un vrai trou d'affichage, pas un manque d'API. Un administrateur consultant une commande invitée n'a aujourd'hui aucun moyen de savoir pour qui elle a été passée ni comment la contacter, sans passer par `/docs`. Constaté en vérifiant empiriquement l'écran (pas en supposant), puis confirmé en lisant `app/schemas/commande.py` et `commande.types.ts`. | Ajouter le nom et le contact de l'invité à la fiche (et idéalement à la liste, en substitut du nom client absent sur ces lignes) — changement purement frontend, aucune modification d'API nécessaire. Pas critique avant mise en prod, mais un vrai trou fonctionnel pour la gestion courante des commandes invité : à traiter dès qu'une tâche touche de toute façon cet écran, plutôt que d'ouvrir un chantier dédié pour ce seul point. |
| Inspection QA (`docs/checkliste-inspection-admin.md`, section 4) | **Priorité élevée.** Ajout d'un bénéficiaire réussit silencieusement côté serveur (201) mais reste invisible sur `AbonnementDetailAdministrationPage` — aucun roster de bénéficiaires n'existe (seuls ceux ayant déjà une consommation apparaissent, indirectement, via `TableauConsommation`). Un bénéficiaire `Suspendu` sans consommation n'apparaît nulle part. **C'est un manque d'affichage, pas un bug d'écriture** : le `POST` fonctionne correctement, vérifié en base (`beneficiaire` porte bien la ligne). Risque concret : un administrateur peut croire l'action échouée et la répéter, ou douter du bon fonctionnement du formulaire — sans aucun moyen de le vérifier depuis cet écran. | Ajouter une liste de bénéficiaires à la fiche abonnement (nom, badge, statut), indépendante du tableau de consommation — changement purement frontend, aucune modification d'API nécessaire (`GET /abonnements/administration/{id}` expose déjà la relation). Priorité plus élevée que la dette `nom_invite` voisine : ici l'admin n'a **aucun** moyen de confirmer qu'une action vient de réussir, pas seulement un affichage incomplet. |
| Sprint 10.1 | `GET /personnel` ne porte aucun paramètre `inclure_supprimes`, contrairement à `GET /produits/administration` — aucune route ne permet de lister ou consulter un membre du personnel archivé ou anonymisé. Pourtant `POST /personnel/{id}/restauration` existe et suppose de retrouver cet identifiant : la réversibilité est voulue, mais rien ne permet de la découvrir une fois l'écran quitté. Constaté en construisant le frontend (10.1) : un F5 après archivage/anonymisation fait disparaître la ligne de l'annuaire sans aucune trace, indiscernable d'un identifiant jamais créé ou supprimé définitivement. Ce n'est pas une décision — contrairement à `ABONNEMENT`, dont l'absence d'archives consultables est un choix assumé et documenté (7.1, « CRUD courant, pas d'historique »), cohérent avec l'absence de restauration pour cette entité. `PERSONNEL` a la moitié du mécanisme (restauration) sans l'autre (lecture des archives). Le frontend compense provisoirement par une restauration en « annulation immédiate » (état local, cf. `personnel.administration.ts`), pas une vraie consultation d'archives. | Ajouter `GET /personnel/administration` (archives comprises), miroir de `GET /produits/administration`, ce qui permettrait de remplacer l'« annulation immédiate » du frontend par une vraie vue d'archives consultable à tout moment. Petite tâche indépendante, pas bloquante pour clore 10.1 — mais à faire avant de considérer l'administration du personnel complètement alignée sur le patron déjà établi par PRODUIT. |

## Traçabilité MLD → sprints (à retenir)

Chaque table du MLD doit être couverte par au moins un sprint avant qu'on considère
la roadmap close. Toute table ajoutée au MLD après coup doit immédiatement être
ajoutée à un sprint ici — ne jamais laisser une table orpheline.
