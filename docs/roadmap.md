# Delta — Roadmap agile (sprints à taille variable)

Ordre de priorisation : dépendances techniques d'abord, puis cœur transactionnel,
puis modules métier du plus généraliste au plus spécifique, paiement en ligne et
back-office avancé en dernier.

**Sprint courant : Sprint 6.** Mettre à jour cette ligne à chaque changement de sprint.

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
- [ ] Socle d'authentification `PERSONNEL` côté frontend — **en deuxième**
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
      du catalogue relevé en #58.
- [ ] `RESERVATION` type = Table
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
- [ ] Lien `RESERVATION → COMMANDE` (le client réserve, puis commande sur place)
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
      pas de l'URL.
- [ ] Interface simplifiée côté personnel pour prise de commande sur place
      — **Dépend du socle d'authentification** ci-dessus : premier écran du
      projet réservé au personnel.
      — Commande `Sur_place`, **sans** `adresse_livraison`, donc **sans
      `LIVRAISON`** — c'est la présence de l'adresse, et elle seule, qui la
      déclenche. Statut terminal `Servie`, lu dans `STATUT_TERMINAL`.
      — Le jeton du salarié **n'identifie pas l'acheteur** : la commande est
      passée en mode invité, ou rattachée à un client que le salarié nomme.

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
      — Porte les **trois actions administratives** laissées en suspens par #25
      (Sprint 3) sur une livraison `Echouee` : **relancer la livraison**,
      **rembourser**, **annuler la commande**. Elles n'existent nulle part
      aujourd'hui, et c'était un manque volontaire adossé à cette case — un
      tableau de bord n'est pas qu'un outil de lecture, il porte aussi ces
      écritures.
      — Rappel de la règle de #25 : la synchronisation reste à **sens unique**.
      Ces actions écrivent `COMMANDE.statut` depuis une décision humaine, elles
      ne rétablissent pas une propagation automatique depuis `LIVRAISON`.

**Non planifié, à rattacher ici ou ailleurs — voir #58.** L'**administration du
catalogue produit** n'a aucune interface React : le CRUD API existe et est
protégé par `get_current_personnel_administrateur` depuis le Sprint 3, mais
aucun écran ne le consomme, et un administrateur en est réduit à `curl`. Les
deux cases ci-dessus nomment le tableau de bord `PERSONNEL` et celui des
commandes — pas le catalogue.

Le morceau réel n'est d'ailleurs pas le formulaire produit mais le **socle
d'authentification `PERSONNEL` côté frontend**, qui n'existe pas : `lib/
tokenStorage.ts` ne connaît qu'un seul jeton, sans la revendication `type` qui
sépare les deux populations depuis #23. Ce socle est la dépendance commune de
tout écran réservé au personnel, celui du Sprint 10 compris — d'où la note ici
plutôt qu'une case inventée dans un sprint qui ne l'a pas prévue.

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
