# Delta — Modèle Logique de Données (MLD)

Source de vérité du schéma relationnel. SGBD cible : PostgreSQL.
Notation : `TABLE(cle_primaire, attribut, ..., #cle_etrangere)`.

## Acteurs

```
CLIENT(id_client, type_client, email, telephone, adresse, mot_de_passe, date_creation_compte)
CLIENT_PARTICULIER(#id_client, nom, prenom, date_naissance)
CLIENT_ENTREPRISE(#id_client, raison_sociale, numero_id_fiscal, secteur_activite, nom_contact_referent)
BENEFICIAIRE(id_beneficiaire, nom, prenom, identifiant_badge, statut, #id_abonnement)
PERSONNEL(id_personnel, nom, prenom, fonction, est_administrateur, mot_de_passe, email, telephone, date_embauche, specialite, zone_livraison)
```

`CLIENT_PARTICULIER` et `CLIENT_ENTREPRISE` sont des sous-types exclusifs de `CLIENT`
(class table inheritance : `id_client` est à la fois PK et FK vers `CLIENT`).
Contrainte à porter au niveau applicatif ou trigger : un `CLIENT` a exactement une
ligne dans l'une des deux tables filles, jamais les deux, jamais aucune.

- `CLIENT.email` est **unique**. Présente au dictionnaire de données d'origine,
  omise ici par erreur de transcription ; rétablie. Règle métier associée :
  **un e-mail correspond à une seule identité `CLIENT`** — particulier *ou*
  entreprise, jamais les deux comptes séparément. Une même personne physique qui
  représente aussi une société doit donc utiliser deux adresses distinctes.
  C'est aussi l'identifiant de connexion (voir `docs/roadmap.md`, T0.6).

- `PERSONNEL.fonction` ∈ {Formateur, Livreur, Cuisinier, Receptionniste, Autre}.
  Domaine formel, `CHECK` en base, et non chaîne libre : deux règles de service
  le comparent — un cuisinier ne peut pas être affecté à une livraison
  (`LIVRAISON.#id_personnel`), un livreur ne peut pas être formateur
  (`SESSION_FORMATION.#id_formateur`). Ces clés étrangères pointent vers
  `PERSONNEL` tout entier : **rien en base ne garantit la cohérence de
  fonction**, la vérification revient au service. Sur une chaîne libre, elle
  comparerait « livreur », « Livreur » et « Livreur » avec une espace finale
  comme trois valeurs distinctes, et laisserait passer l'affectation sans rien
  signaler. `Autre` est délibéré : un poste non prévu ne doit pas bloquer une
  embauche ni forcer une migration.

- `PERSONNEL.est_administrateur` est un booléen `NOT NULL DEFAULT false`,
  **orthogonal à `fonction`** : l'un porte un droit, l'autre un métier. Un
  formateur peut administrer le catalogue produit, un cuisinier non — dériver
  les droits de la fonction confondrait les deux notions et rendrait ce cumul
  inexprimable.

  Le `DEFAULT false` est posé en base et pas seulement dans l'application : une
  insertion hors API — script de seed, correction manuelle — ne doit pas pouvoir
  créer un administrateur par omission. Le sens de la valeur par défaut n'est pas
  neutre ici, il est le moins privilégié.

  Absent du dictionnaire de données d'origine, comme `COMMANDE.date_commande` :
  le MLD ne portait aucune notion de droits, et les écritures du catalogue
  étaient de ce fait ouvertes à tout client authentifié (dette du Sprint 1).

  **Ni cette colonne ni `mot_de_passe` ne sont exposées par l'API** — elles sont
  absentes des schemas d'entrée comme de sortie. Le seul chemin d'écriture est le
  script d'amorçage `backend/scripts/creer_admin.py`, hors HTTP (voir
  `docs/architecture.md`).

- `PERSONNEL.mot_de_passe` est **nullable**, contrairement à `CLIENT.mot_de_passe`.
  La différence est structurelle et non un oubli : tout `CLIENT` se connecte —
  c'est la raison d'être du compte — alors que certaines fonctions du personnel
  n'ont aucun besoin de le faire. `NULL` signifie « pas de compte de connexion »
  et non « mot de passe vide » : l'authentification est refusée, avec le même
  message uniforme que tout autre refus.

  Absente du dictionnaire de données d'origine, pour la même raison
  qu'`est_administrateur` : le MLD ne faisait de `PERSONNEL` qu'une entité
  référencée, jamais une identité de connexion.

## Catalogue formation

```
DOMAINE_FORMATION(id_domaine, libelle, description)
FORMATION(id_formation, titre, niveau, duree_heures, prix, capacite_max, propose_hebergement, #id_domaine)
SESSION_FORMATION(id_session, date_debut, date_fin, places_restantes, statut, #id_formation, #id_formateur)
```

- `SESSION_FORMATION.#id_formateur` référence `PERSONNEL` (fonction = Formateur).
  **Rien en base ne le garantit** : la clé étrangère pointe vers `PERSONNEL` tout
  entier, et la vérification revient au service — le même que celui de
  `LIVRAISON.#id_personnel`, dont c'est exactement le même problème. `NULL`
  signifie « pas encore affecté ».

- `SESSION_FORMATION.statut` ∈ {Planifiee, Ouverte, Terminee, Annulee}.
  Domaine formel, `CHECK` en base, même traitement que `COMMANDE.statut` et
  `LIVRAISON.statut` : le service compare ces valeurs pour décider ce qu'une
  session autorise encore.

  **Pas de statut « Complete », délibérément.** Une session pleine se lit sur
  `places_restantes = 0` ; l'inscrire aussi dans le statut créerait deux sources
  pour un même fait, qui divergeraient à la première annulation de réservation.

- `SESSION_FORMATION.places_restantes` est initialisé depuis
  `FORMATION.capacite_max` à la création, par le serveur et **jamais depuis la
  requête** — même règle que `COMMANDE.montant_total` et
  `LIGNE_COMMANDE.prix_unitaire_applique`. L'accepter permettrait d'ouvrir une
  session à mille places sur une formation qui en compte douze.

  Il **diverge ensuite** de `capacite_max`, et c'est voulu : le premier est un
  compteur qui vit au rythme des réservations, le second une propriété du
  catalogue. Modifier la capacité d'une formation ne rétroagit pas sur les
  sessions déjà ouvertes.

## Catalogue produits / espace

```
CATEGORIE_PRODUIT(id_categorie, libelle)
PRODUIT(id_produit, nom, description, prix_unitaire, unite_mesure, stock_disponible, est_personnalisable, supplement_personnalisation, est_livrable, #id_categorie)
SALLE(id_salle, nom, capacite, tarif_horaire, tarif_journee, equipements)
LOGEMENT(id_logement, type_chambre, capacite, tarif_nuitee, statut)
```

- `LOGEMENT.statut` ∈ {Disponible, En_maintenance, Hors_service}. Domaine
  formel, `CHECK` en base, même traitement que `COMMANDE.statut` et
  `LIVRAISON.statut`.

  **Il décrit l'état du bien, jamais son occupation.** Aucune valeur
  « Occupé » : savoir si une chambre est prise à une date donnée se déduit des
  `RESERVATION` actives couvrant cette période. L'inscrire aussi dans le statut
  créerait deux sources pour un même fait, qui divergeraient à la première
  annulation — exactement la raison pour laquelle `SESSION_FORMATION` n'a pas de
  statut « Complete », et pour laquelle `places_restantes` est un compteur et non
  un état.

  La distinction est concrète : un logement `Disponible` peut être réservé demain
  sans cesser d'être disponible ; un logement `En_maintenance` ne peut pas
  l'être, même si aucune réservation ne le couvre.

  `En_maintenance` et `Hors_service` ne font pas double emploi : l'un dit que le
  bien revient, l'autre qu'il est retiré de l'offre. Les confondre effacerait la
  seule information utile au moment de planifier.

- `SALLE.tarif_horaire` et `SALLE.tarif_journee` sont nullables
  **individuellement**, mais **pas ensemble** : une salle en porte toujours au
  moins un.

  ```sql
  CHECK (tarif_horaire IS NOT NULL OR tarif_journee IS NOT NULL)
  ```

  Présente au dictionnaire de données d'origine, jamais portée en contrainte ;
  rétablie. Même cas que l'unicité de `CLIENT.email` et les bornes d'`AVIS.note`
  — une omission de transcription, pas une règle nouvelle.

  Une disjonction et non deux `NOT NULL` : une salle louée à l'heure seulement,
  ou à la journée seulement, est le cas courant. C'est l'absence des **deux** qui
  pose problème.

  Sans cette contrainte, une salle dépourvue de tarif serait louable
  **gratuitement** sans que personne l'ait décidé, et rien ne distinguerait
  « gratuit » d'un « tarif oublié à la saisie ». Avec elle, la gratuité doit
  s'écrire `0.00` : elle devient une décision, plus une absence.

  La contrainte est en base et pas seulement dans le schema d'entrée : une
  reprise de données ou une correction manuelle ne doit pas pouvoir créer ce
  trou. Elle est répétée côté API pour produire un 422 lisible plutôt qu'une
  erreur d'intégrité.

- `PRODUIT.supplement_personnalisation` est le tarif de la personnalisation,
  **par produit et par unité** — comme `prix_unitaire`, dont il est le voisin
  direct. Il est fixé au catalogue par un administrateur, et **jamais** soumis
  par le client : l'accepter depuis une commande reviendrait à le laisser fixer
  ce qu'il paie.

  Absent du dictionnaire de données d'origine, qui portait
  `est_personnalisable` sans jamais dire ce que la personnalisation coûte. Sans
  cette colonne, `DEMANDE_PERSONNALISATION.supplement_prix` n'avait aucune
  source : il valait `0`, et toute personnalisation était de fait gratuite.

  `NULL` signifie « produit non personnalisable », et rien d'autre. La colonne
  est nullable, mais pas librement — un `CHECK` interdit qu'un produit
  personnalisable soit dépourvu de tarif :

  ```sql
  CHECK (NOT est_personnalisable OR supplement_personnalisation IS NOT NULL)
  ```

  Une implication et non une équivalence : un produit **non** personnalisable a
  le droit de conserver un tarif dormant, par exemple après avoir été retiré de
  la personnalisation sans qu'on efface son prix. L'inverse — personnalisable
  sans tarif — est le seul cas dangereux, puisqu'il rendrait la personnalisation
  gratuite sans que personne l'ait décidé.

  La contrainte est en base et pas seulement dans le schema d'entrée : une
  reprise de données ou une correction manuelle ne doit pas pouvoir créer ce
  trou. Elle est répétée côté API pour produire un 422 lisible plutôt qu'une
  erreur d'intégrité.

  Le montant est **recopié** dans `DEMANDE_PERSONNALISATION.supplement_prix` à
  la commande, puis figé — même règle que `LIGNE_COMMANDE.prix_unitaire_applique` :
  une évolution du catalogue ne rétroagit pas sur les commandes passées.

## Abonnement (cantine B2B)

```
ABONNEMENT(id_abonnement, date_debut, date_fin, type_facturation, mode_suivi, nombre_repas_inclus, tarif_forfait, tarif_unitaire_repas, #id_client_entreprise)
CONSOMMATION_REPAS(id_consommation, date_consommation, quantite, #id_abonnement, #id_beneficiaire)
```

- `type_facturation` ∈ {Forfait, Consommation_reelle}
- `mode_suivi` ∈ {Individuel, Global} — si Global, `#id_beneficiaire` est NULL.

- **Cohérence `#id_beneficiaire` / `mode_suivi`** : si l'abonnement est en mode
  `Individuel`, chaque consommation doit nommer un bénéficiaire ; en mode
  `Global`, aucun. Cette règle croise deux tables (`CONSOMMATION_REPAS.#id_beneficiaire`
  et `ABONNEMENT.mode_suivi`) : aucun `CHECK` ne peut la comparer, et un trigger
  au prix d'une logique métier en PL/pgSQL serait hors de sa couche. Le service
  (`ConsommationRepasService.enregistrer_consommation()`) est donc le seul point
  d'application — et il n'y a pas de redondance de défense ici, à l'identique du
  contrôle de capacité SALLE en #47. La base ne garantit rien ; la vérification
  revient au service.

## Transactions

```
COMMANDE(id_commande, date_commande, reference_publique, adresse_livraison, nom_invite, contact_invite, type_commande, statut, montant_total, #id_client, #id_reservation, #id_personnel)
LIGNE_COMMANDE(id_ligne, quantite, prix_unitaire_applique, #id_commande, #id_produit)
DEMANDE_PERSONNALISATION(id_personnalisation, description_demande, ingredients_specifiques, supplement_prix, #id_ligne, #id_produit_base)
RESERVATION(id_reservation, type_reservation, date_debut, date_fin, nombre_personnes, statut, avec_hebergement, #id_client, #id_session, #id_salle, #id_logement, #id_reservation_hebergement)
```

- `COMMANDE.date_commande` est un `TIMESTAMPTZ NOT NULL DEFAULT now()`, posé par
  la base et non par l'application : c'est l'horloge du serveur qui fait foi.
  Elle était **absente du dictionnaire de données d'origine** ; ce n'est pas une
  omission de transcription comme `CLIENT.email` ou `AVIS.note`, mais un manque
  réel, relevé au sprint 2 en construisant l'historique client.

  Deux besoins l'imposent. L'historique se trie du plus récent au plus ancien :
  sans date, l'ordre reposait sur `id_commande DESC`, qui n'est un proxy de la
  chronologie que tant que les identifiants restent séquentiels — une reprise de
  données ou une insertion hors API le fausserait sans que rien ne le signale.
  Et un client doit pouvoir lire *quand* il a commandé ; un numéro de commande
  ne le lui dit pas.

  Ne pas confondre avec `supprime_le` : l'une date la création du fait, l'autre
  son archivage. Une commande porte toujours la première, rarement la seconde.
- `COMMANDE.adresse_livraison` est **nullable**, et sa présence est ce qui
  déclenche la création d'une `LIVRAISON`. `NULL` signifie « pas de livraison
  demandée » : retrait sur place ou à emporter.

  Elle ne se déduit **pas** de `CLIENT.adresse`. Celle-ci est l'adresse de
  profil, distincte de l'adresse d'une commande précise — on se fait livrer au
  bureau, chez un tiers, ailleurs qu'à son domicile. Et une commande invitée n'a
  aucun `CLIENT` d'où la tirer : c'était le trou relevé à l'ouverture du sprint 3,
  du même genre que `date_commande` au sprint 2.

  Elle est donc saisie au tunnel, pour **tout** client, invité comme connecté.
  `LIVRAISON.adresse_livraison` en hérite à la création, puis vit sa vie : la
  livraison est un fait logistique, la commande un fait commercial.

- `COMMANDE.#id_client` est NULL si commande en mode invité (`nom_invite`/`contact_invite` alors renseignés).
- `COMMANDE.reference_publique` est un **UUID généré uniquement en mode invité**,
  NULL sinon. C'est le seul moyen pour un invité de revenir sur sa commande : il
  n'a pas de compte, donc pas de jeton. Un UUID et non l'identifiant séquentiel,
  qui serait énumérable. Contrainte `UNIQUE (reference_publique)` **globale** et
  non partielle : un UUID n'est jamais réattribué, il n'y a donc aucune valeur à
  libérer à l'archivage.
- `COMMANDE.#id_personnel` est le salarié qui a **saisi** la commande, `NULL`
  si le client l'a passée lui-même.

  `NULL` a un sens précis et unique : la commande vient du **parcours client**.
  C'est le cas de toutes les commandes antérieures au sprint 6, et il reste le
  cas courant. Une valeur ne peut venir que de `POST /commandes/personnel`.

  **L'identifiant est dérivé du jeton, jamais transmis dans le corps** — même
  règle que `#id_client`, et pour la même raison : une identité qui vient de la
  requête est une identité qu'on peut usurper. Le laisser saisir permettrait
  d'attribuer une commande à un collègue.

  `ON DELETE RESTRICT` : un salarié ne s'efface pas, il s'anonymise. La commande
  garde alors un identifiant devenu anonyme, comme `LIVRAISON.#id_personnel` et
  `SESSION_FORMATION.#id_formateur`. Un `CASCADE` effacerait des commandes —
  donc des preuves de transaction — pour le départ d'un salarié.

  Absent du dictionnaire de données d'origine, comme `COMMANDE.date_commande` :
  celui-ci ne prévoyait pas qu'une commande puisse être saisie par un tiers.
  Rien ne disait donc *qui* l'avait prise, ce qui compte pour une caisse.

- `COMMANDE.type_commande` ∈ {En_ligne, Sur_place, A_emporter}
- `COMMANDE.statut` ∈ {En_attente, Confirmee, En_preparation, Livree, Servie, Annulee}
  Règle de service, **non exprimable en `CHECK`** puisqu'elle croise deux
  colonnes : une commande `Sur_place` se termine sur `Servie`, les deux autres
  types sur `Livree`.
- `COMMANDE.montant_total` est **figé à la création** : il vaut la somme des
  lignes au moment où la commande est passée, et n'est jamais recalculé. Une
  ligne archivée ensuite ne le modifie pas — c'est une donnée d'archive, pas une
  vue dérivée de `LIGNE_COMMANDE`.
- `COMMANDE.#id_reservation` est NULL sauf si la commande découle d'une
  réservation de table. La colonne existait dès l'origine ; le chemin qui la
  renseigne date du sprint 6.

  **La réservation doit être `Confirmee` ou `Honoree`.** La formulation d'origine
  disait « honorée », mais l'ordre chronologique et l'ordre des statuts ne
  coïncident pas : on commande **pendant** le service, quand la réservation est
  encore `Confirmee`, et elle ne passera `Honoree` qu'après. Exiger `Honoree`
  rendrait la règle inapplicable au moment même où elle sert. Ce n'est pas une
  omission rétablie comme l'unicité de `CLIENT.email` : le dictionnaire d'origine
  décrivait le cas d'usage, pas un contrôle de statut.

  `En_attente` est refusé — la réservation n'est pas acquise, et l'accepter la
  confirmerait par un chemin détourné ; `Annulee` aussi, elle n'existe plus
  fonctionnellement.

  **Seule une réservation de type `Table` peut porter une commande**, et elle
  doit appartenir à l'acheteur. Une réservation inexistante, archivée, ou
  appartenant à un autre client reçoivent le **même** message : un message
  distinct confirmerait l'existence de la réservation d'autrui.

  Une commande **invitée** ne peut pas en porter : `RESERVATION.#id_client` est
  NOT NULL, réserver exige un compte, et un invité n'a pas de propriétaire à
  comparer.
- `RESERVATION.type_reservation` ∈ {Formation, Salle, Logement, Table}.

- `RESERVATION.statut` ∈ {En_attente, Confirmee, Honoree, Annulee}. Domaine
  formel, `CHECK` en base, même traitement que `COMMANDE.statut` et
  `LIVRAISON.statut` : le service compare ces valeurs pour décider si une place
  doit être restituée.

  `Honoree` et `Annulee` sont deux fins qui ne sont **pas** interchangeables, et
  la différence est comptable : **seule `Annulee` restitue la place**. Un
  stagiaire venu a consommé la sienne ; la lui rendre ferait réapparaître une
  place déjà utilisée.

- **Le compteur `SESSION_FORMATION.places_restantes` est tenu par
  `ReservationService`**, et par lui seul. Une réservation le décrémente à la
  création, par un `UPDATE` conditionnel atomique — c'est PostgreSQL qui arbitre
  entre deux réservations simultanées sur la dernière place, comme pour
  `PRODUIT.stock_disponible`.

  Le symétrique n'est pas optionnel : l'annulation **et** l'archivage rendent les
  places. Sans lui, chaque annulation en perdrait une définitivement, et la
  session finirait par afficher complet alors que la salle est vide — sans que
  rien dans les données ne dise pourquoi.

  La restitution est **idempotente** : elle n'a lieu qu'au passage d'un statut
  occupant vers `Annulee`. Rejouer l'opération ne crédite pas deux fois.

- **Aucun bien n'est réservé deux fois sur le même créneau.** Deux contraintes
  d'exclusion PostgreSQL le garantissent, une par cible :

  ```sql
  EXCLUDE USING gist (id_salle WITH =, tstzrange(date_debut, date_fin) WITH &&)
     WHERE (id_salle IS NOT NULL AND supprime_le IS NULL AND statut <> 'Annulee')
  ```

  `tstzrange` a des bornes `[)` — début inclus, fin exclue. Deux créneaux
  **adjacents** ne se chevauchent donc pas : une salle libérée à midi est
  réservable à midi. Le contraire imposerait un trou artificiel entre deux
  locations.

  Le prédicat écarte les réservations **annulées et archivées** : sans lui, une
  annulation condamnerait le créneau à jamais — même raisonnement que la
  restitution des places d'une session.

  C'est une contrainte **en base** et non une vérification applicative, parce
  qu'il n'y a ici aucun compteur sur lequel poser un verrou de ligne,
  contrairement à `places_restantes` et `stock_disponible`. Deux requêtes
  simultanées passeraient toutes deux un contrôle applicatif. Le service en fait
  un quand même, mais pour produire un 409 lisible, pas pour garantir.

  `USING gist` avec l'opérateur `=` sur un entier exige l'extension
  `btree_gist`, créée par la migration. Elle est *trusted* depuis PostgreSQL 13 :
  un rôle disposant du seul privilège `CREATE` sur la base suffit.

  Cette contrainte et le `CHECK` d'exclusivité (n°2) portent sur la même table
  sans se gêner : l'une interdit deux **lignes** sur le même créneau, l'autre
  deux **cibles** sur une même ligne.

- `RESERVATION.avec_hebergement` dit que le client **souhaite** être hébergé.
  Depuis le sprint 6, le serveur tente d'honorer ce souhait — mais le drapeau
  reste une **demande**, jamais la preuve qu'une chambre est attribuée. C'est
  `#id_reservation_hebergement` qui porte cette preuve, et lui seul.

  Écrire la nuance ici est nécessaire, faute de quoi elle disparaîtra à la
  première relecture : le nom de la colonne suggère un hébergement acquis.

  L'option n'est acceptée que si `FORMATION.propose_hebergement` vaut `true` —
  propriété du catalogue et non préférence du client, même raisonnement que
  `PRODUIT.est_personnalisable`. Elle est refusée sur tout type de réservation
  autre que `Formation`.

- `RESERVATION.#id_reservation_hebergement` est l'**auto-référence** qui lie une
  réservation de formation à la réservation de logement qui l'accompagne.
  `NULL` signifie « pas d'hébergement attribué » — soit qu'il n'ait pas été
  demandé, soit qu'aucune chambre n'ait été libre.

  **Le couplage passe par deux lignes, jamais par une seule.** La contrainte
  n°2 interdit qu'une même ligne porte à la fois `#id_session` et
  `#id_logement` ; c'est elle qui impose la seconde ligne, et non un choix de
  confort.

  **Le lien est porté par la ligne de formation.** La formation est ce que le
  client réserve, l'hébergement en est l'accessoire. Le porter à l'envers le
  ferait tenir par la ligne la plus susceptible d'être annulée seule.

  La chambre est choisie **par le serveur** — la première `Disponible`, libre
  sur les dates de la session et d'une capacité suffisante. Le client ne la
  choisit pas : aucun endpoint ne publie de vue de disponibilité, et lui en
  demander une reviendrait à inventer cette API pour un accessoire.

  Les dates sont **celles de la session**. Un décalage d'une nuit — arrivée la
  veille pour une formation qui commence tôt — serait une règle d'accueil que
  personne n'a énoncée.

  **Quand aucune chambre n'est libre, la réservation de formation est acceptée
  quand même**, et `#id_reservation_hebergement` reste `NULL`. Refuser
  trancherait à la place de l'administrateur, et obligerait à rendre la place de
  formation tout juste décrémentée — défaire une écriture réussie pour cause
  d'échec d'une écriture accessoire. Aucun état n'est inventé pour autant : pas
  de file d'attente, pas de statut « hébergement en attente ». Même raisonnement
  que `LIVRAISON.Echouee`, qui ne bascule pas la commande vers `Annulee`.

  Deux `CHECK` encadrent la colonne :

  ```sql
  CHECK (id_reservation_hebergement IS NULL OR type_reservation = 'Formation')
  CHECK (id_reservation_hebergement IS NULL
         OR id_reservation_hebergement <> id_reservation)
  ```

  Le premier parce qu'un lien porté par une réservation de salle n'aurait aucun
  sens interprétable ; le second parce qu'une ligne liée à elle-même produirait
  une boucle que toute propagation d'annulation suivrait indéfiniment.

  **L'annulation de la formation annule l'hébergement**, dans la même
  transaction : laisser une chambre retenue pour une formation annulée
  immobiliserait une ressource sans raison active. L'archivage se propage de
  même — un archivage est un `UPDATE`, aucun `CASCADE` ne se déclenche.

  **La propagation est unidirectionnelle.** Annuler le seul hébergement ne
  touche pas à la formation : un stagiaire qui se loge ailleurs garde sa place.
  Même forme que la synchronisation `LIVRAISON → COMMANDE`.

- Une réservation de type `Formation` **exige** `#id_session`. Le `CHECK`
  d'exclusivité (contrainte n°2) ne peut pas l'imposer : il autorise zéro colonne
  cible renseignée, ce qu'il faut pour une réservation de table. La règle croise
  deux colonnes, elle vit donc dans le schema d'entrée.

## Logistique / Avis

```
LIVRAISON(id_livraison, adresse_livraison, date_heure_prevue, date_heure_reelle, statut, #id_commande, #id_personnel)
AVIS(id_avis, type_avis, note, commentaire, date_avis, #id_client, #id_ligne, #id_reservation)
```

- `#id_personnel` référence `PERSONNEL` (fonction = Livreur). **Rien en base ne
  le garantit** : la clé étrangère pointe vers `PERSONNEL` tout entier, et la
  vérification revient au service. `NULL` signifie « pas encore affectée ».

- `LIVRAISON.date_heure_prevue` est **nullable**, ce qui corrige le dictionnaire
  d'origine. La livraison naît avec la commande, alors qu'aucune tournée n'est
  planifiée : la garder obligatoire forcerait à inventer une date, c'est-à-dire
  à écrire une promesse que rien ne garantit. `NULL` signifie « pas encore
  planifiée », exactement comme `#id_personnel` signifie « pas encore affectée ».

- `LIVRAISON.statut` ∈ {En_attente, En_cours, Livree, Echouee, Annulee}.
  Domaine formel, `CHECK` en base, même traitement que `COMMANDE.statut` et
  `PERSONNEL.fonction` : le service compare ces valeurs pour décider ce qu'une
  livraison autorise encore.

  `Echouee` et `Annulee` ne font pas double emploi : l'une dit que la tournée a
  eu lieu sans aboutir — client absent, adresse introuvable —, l'autre qu'elle
  n'aura pas lieu. Les confondre effacerait la seule information utile au moment
  de relancer.
- `AVIS.type_avis` ∈ {Produit, Service}.
- `AVIS.note` ∈ [1, 5] — notation sur 5, bornes incluses. Présente au dictionnaire
  de données d'origine, omise ici par erreur de transcription ; rétablie.

## Contraintes d'exclusivité à implémenter en `CHECK` / trigger (pas de l'algèbre relationnelle pure)

1. **CLIENT** : exactement une ligne fille (`CLIENT_PARTICULIER` xor `CLIENT_ENTREPRISE`).
2. **RESERVATION** : au plus une des colonnes `id_session` / `id_salle` / `id_logement`
   est renseignée (aucune si `type_reservation = Table`).
   ```sql
   CHECK (
     (id_session IS NOT NULL)::int +
     (id_salle IS NOT NULL)::int +
     (id_logement IS NOT NULL)::int <= 1
   )
   ```
3. **AVIS** : exactement une des colonnes `id_ligne` / `id_reservation` est renseignée (XOR).
   ```sql
   CHECK (
     (id_ligne IS NOT NULL) <> (id_reservation IS NOT NULL)
   )
   ```
4. **AVIS** : la note est bornée.
   ```sql
   CHECK (note BETWEEN 1 AND 5)
   ```
5. **COMMANDE** : une commande est passée par un client identifié **ou** par un
   invité, jamais les deux, jamais ni l'un ni l'autre.
   ```sql
   CHECK ((id_client IS NOT NULL) <> (nom_invite IS NOT NULL))
   ```
   Contrairement à la contrainte n°1, celle-ci n'est **pas** reportée au niveau
   applicatif : l'insertion d'une commande se fait en un seul temps, la
   contrainte n'a aucun état transitoire à tolérer.

   `contact_invite` n'y figure pas — un `CHECK` à trois colonnes se lirait mal
   pour ce qu'il apporte. Son caractère obligatoire en mode invité est porté par
   le schema d'entrée, qui refuse la charge utile avant la base.

## Cardinalités (1,1) traduites en contrainte `UNIQUE`

Le schéma conceptuel porte déjà ces cardinalités ; la notation `TABLE(...)` ci-dessus
ne les rend pas visibles, puisqu'une clé étrangère seule autorise le 1-N. Les deux
`UNIQUE` suivants sont la traduction relationnelle de cette cardinalité, pas un ajout
de règle métier.

| Colonne | Cardinalité conceptuelle | Contrainte |
|---|---|---|
| `LIVRAISON.#id_commande` | une commande donne lieu à au plus une livraison | `UNIQUE (id_commande)` |
| `DEMANDE_PERSONNALISATION.#id_ligne` | une ligne de commande porte au plus une demande de personnalisation | `UNIQUE (id_ligne)` |
| `RESERVATION.#id_reservation_hebergement` | une réservation d'hébergement appartient à au plus une formation | `UNIQUE (id_reservation_hebergement)` |

## Unicités métier explicitées

Même traitement que le tableau précédent : ces règles étaient implicites dans le
schéma conceptuel, elles sont ici écrites noir sur blanc parce qu'une colonne seule
n'exprime aucune unicité. Ce ne sont pas des règles nouvelles.

| Colonne | Règle métier | Contrainte |
|---|---|---|
| `PERSONNEL.email` | l'adresse professionnelle identifie un membre du personnel | `UNIQUE (email)` |
| `CLIENT_ENTREPRISE.numero_id_fiscal` | un numéro d'identification fiscale désigne une seule entreprise | `UNIQUE (numero_id_fiscal)` |
| `BENEFICIAIRE.identifiant_badge` | un badge est nominatif, deux bénéficiaires ne peuvent le partager | `UNIQUE (identifiant_badge)` |
| `CATEGORIE_PRODUIT.libelle` | pas deux catégories de même nom au catalogue | `UNIQUE (libelle)` |
| `DOMAINE_FORMATION.libelle` | pas deux domaines de formation de même nom | `UNIQUE (libelle)` |

Le cas de `CLIENT.email` est traité à part, dans la section « Acteurs » : il porte une
règle d'identité, pas seulement une unicité de libellé.

## Suppression logique — `supprime_le`

**Les 20 tables portent une colonne `supprime_le TIMESTAMPTZ NULL.`** `NULL`
signifie « ligne active » ; une date signifie « ligne archivée ». C'est la seule
colonne transverse du schéma, et elle n'apparaît pas dans les notations
`TABLE(...)` ci-dessus pour ne pas les alourdir vingt fois.

Aucune exception : `CLIENT_PARTICULIER` et `CLIENT_ENTREPRISE` la portent aussi,
bien qu'elles n'aient pas de cycle de vie propre. Deux raisons — un index partiel
ne peut pas référencer la colonne d'une autre table, or
`CLIENT_ENTREPRISE.numero_id_fiscal` en a besoin ; et une entité sans la colonne
forcerait un filtrage conditionnel dans le repository générique. En contrepartie,
l'archivage d'un `CLIENT` et celui de sa ligne fille se font dans **une seule
transaction**, comme leur création.

### Index uniques partiels

Six unicités d'identité métier sont des **index uniques partiels**
`WHERE supprime_le IS NULL`, et non des contraintes `UNIQUE` :

| Index | Colonne | Pourquoi partiel |
|---|---|---|
| `uq_client_email` | `CLIENT.email` | un compte archivé bloquerait à vie la réinscription |
| `uq_personnel_email` | `PERSONNEL.email` | départ puis retour d'un salarié |
| `uq_client_entreprise_numero_id_fiscal` | `CLIENT_ENTREPRISE.numero_id_fiscal` | la même société doit pouvoir se réinscrire |
| `uq_beneficiaire_identifiant_badge` | `BENEFICIAIRE.identifiant_badge` | un badge est réattribué |
| `uq_categorie_produit_libelle` | `CATEGORIE_PRODUIT.libelle` | une catégorie archivée puis recréée |
| `uq_domaine_formation_libelle` | `DOMAINE_FORMATION.libelle` | idem |

Les noms sont ceux des anciennes contraintes, délibérément : PostgreSQL remonte
le nom de l'**index** dans `diag.constraint_name`, dont dépend la traduction des
conflits en HTTP 409.

**Les trois `UNIQUE` de cardinalité restent globales** — `LIVRAISON.#id_commande`,
`DEMANDE_PERSONNALISATION.#id_ligne` et
`RESERVATION.#id_reservation_hebergement`. Elles n'expriment pas une identité mais
une propriété structurelle : rendues partielles, la table pourrait contenir cinq
livraisons archivées et une active pour la même commande, et toute requête
omettant le filtre produirait des totaux faux.

### Trois façons d'effacer, qui ne sont pas interchangeables

| Opération | Effet | Pour quoi |
|---|---|---|
| `delete()` | `supprime_le = now()` | l'archivage courant, réversible |
| `supprimer_definitivement()` | `DELETE` réel, irréversible | entités **sans valeur probante** : `PRODUIT`, `CATEGORIE_PRODUIT`, `SALLE`, `LOGEMENT`, `FORMATION`, `DOMAINE_FORMATION` |
| `ClientService.anonymiser()` | réécrit les données personnelles, archive, **conserve la ligne** | seul chemin de conformité pour `CLIENT` |

`supprimer_definitivement()` n'est **pas** applicable à un `CLIENT` : les FK en
`ON DELETE RESTRICT` de `RESERVATION` et `AVIS` le refuseraient, et effacer une
réservation honorée ou un avis reviendrait à détruire une preuve de transaction,
généralement soumise à une obligation de conservation qui prime sur le droit à
l'effacement. L'anonymisation conserve `id_client` et `type_client`, et ne touche
à aucun enregistrement lié : ceux-ci gardent leur `#id_client`, désormais anonyme.

## Hypothèse de travail à surveiller

`RESERVATION.#id_client` est actuellement NOT NULL (compte obligatoire pour réserver,
contrairement à `COMMANDE` qui autorise l'invité). Si cette règle métier change,
ajouter `nom_invite`/`contact_invite` sur `RESERVATION` à l'identique de `COMMANDE`
et rendre `#id_client` nullable.
