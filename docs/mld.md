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

- `ABONNEMENT.date_fin` est **`NOT NULL`**. Un abonnement B2B a une échéance
  contractuelle — contrairement à `RESERVATION`, dont certains types n'ont pas
  de borne fixée a priori.

  ```sql
  CHECK (date_fin > date_debut)
  ```

  Décidé en construisant le Sprint 7 : le modèle du Sprint 0 la portait
  `nullable`, faute d'avoir encore un service pour l'exploiter. Ce n'est pas une
  omission de transcription comme l'unicité de `CLIENT.email` — c'est une
  décision prise en connaissance de cause, une fois le cas d'usage écrit.

- `ABONNEMENT.tarif_forfait` et `ABONNEMENT.tarif_unitaire_repas` sont nullables
  **individuellement**, mais le tarif correspondant au `type_facturation`
  choisi doit être renseigné.

  ```sql
  CHECK (
    (type_facturation = 'Forfait' AND tarif_forfait IS NOT NULL)
    OR (type_facturation = 'Consommation_reelle' AND tarif_unitaire_repas IS NOT NULL)
  )
  ```

  Une implication par branche du domaine, pas une contrainte symétrique :
  contrairement à `SALLE` (« au moins un des deux »), les deux types de
  facturation sont mutuellement exclusifs, donc chaque branche exige son propre
  tarif. Même pattern que `PRODUIT.supplement_personnalisation` — le tarif
  inutilisé peut rester dormant, c'est l'absence du tarif actif qui est
  dangereuse : elle rendrait la facturation gratuite sans que personne l'ait
  décidé.

  Contrairement à la cohérence `CONSOMMATION_REPAS.#id_beneficiaire` /
  `ABONNEMENT.mode_suivi` ci-dessous, cette règle ne croise **pas** de table :
  `type_facturation` et les deux tarifs vivent tous trois sur `ABONNEMENT`. Rien
  n'empêche donc de la poser en `CHECK`, et c'est ce qui est fait — la garantie
  structurelle est préférée à la seule validation de service dès qu'elle est
  techniquement possible.

- `BENEFICIAIRE.statut` ∈ {Actif, Inactif, Suspendu}. Domaine formel, `CHECK`
  en base, même traitement que `PERSONNEL.fonction` et `RESERVATION.statut`.

  Décidé en construisant le Sprint 7 : le modèle du Sprint 0 le portait en
  chaîne libre, faute d'avoir encore un service pour comparer ses valeurs. Ce
  n'est pas un désaccord avec le commentaire d'origine (« le MLD n'en fixe pas
  le domaine ») — c'était une précision qui n'avait pas encore été tranchée, pas
  une décision contraire.

- **Aucun chevauchement entre deux abonnements actifs d'une même entreprise.**
  Contrainte d'exclusion PostgreSQL, même mécanique que `RESERVATION` sur
  `SALLE`/`LOGEMENT` (#47) :

  ```sql
  EXCLUDE USING gist (id_client_entreprise WITH =,
     daterange(date_debut, date_fin) WITH &&)
     WHERE (supprime_le IS NULL)
  ```

  Décidé en construisant le Sprint 7 : `ABONNEMENT` n'a qu'un lien vers
  `CLIENT_ENTREPRISE`, aucune notion de site ou de département qui
  justifierait deux abonnements actifs simultanés. Sans cette garantie,
  `CONSOMMATION_REPAS.#id_abonnement` n'aurait aucun moyen de départager quel
  abonnement décompte un repas un jour couvert par deux contrats à la fois.

  `daterange` a des bornes `[)` — début inclus, fin exclue — comme
  `tstzrange` pour `RESERVATION` : un renouvellement qui commence le jour où
  l'ancien abonnement se termine n'est **pas** un chevauchement, c'est le cas
  courant d'un contrat qui en remplace un autre.

  La règle ne croise **aucune** autre table : `date_debut`, `date_fin` et
  `id_client_entreprise` vivent tous sur `ABONNEMENT`. Rien n'empêche donc de
  la poser en base, et c'est ce qui est fait — la garantie structurelle est
  préférée à la seule validation de service dès qu'elle est techniquement
  possible, même raisonnement que `tarif_selon_facturation` ci-dessus. Le
  service fait tout de même un pré-contrôle, mais pour produire un 409
  lisible, pas pour garantir — la base reste le seul arbitre en cas de course
  entre deux créations simultanées.

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

- `COMMANDE.rembourse_le` est un `TIMESTAMPTZ NULL`, ajouté au Sprint 10.5.
  **Miroir direct de `supprime_le` dans sa forme**, mais sans aucun rapport
  avec l'archivage : une commande remboursée reste active, visible, et
  continue de porter son historique normalement.

  **C'est un geste manuel simplifié, et délibérément pas une intégration
  réelle remboursement↔`PAIEMENT`.** Poser cette date ne touche à **aucune**
  ligne de `PAIEMENT`, ni à son domaine de statut — qui ne porte
  délibérément aucune valeur `Rembourse` (voir plus bas, section Paiement).
  Le remboursement effectif se traite hors système — espèces, virement — et
  ce marqueur n'en garde que la trace, posée par un administrateur depuis le
  tableau de bord commandes.

  La question `type_operation` documentée en attente dans la section
  Paiement (distinguer `Paiement`/`Remboursement` sur la ligne `PAIEMENT`
  elle-même) reste une dette **distincte et non résolue** par ce marqueur :
  les deux ne se substituent pas l'un à l'autre. `rembourse_le` répond au
  besoin immédiat d'un tableau de bord — savoir qu'un remboursement a eu
  lieu — sans trancher la question, plus large, de comment le modéliser
  proprement côté paiement.

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

  **`Honoree` ne peut être posé que par un administrateur**, jamais par le
  client propriétaire — corrigé au Sprint 10.2. Le domaine formel garantit
  qu'une valeur hors des quatre n'est pas acceptée, mais ne dit rien de *qui*
  a le droit de choisir laquelle : jusqu'ici, l'unique point d'écriture
  (`PUT /reservations/{id}/statut`, réservé au client) acceptait les quatre
  valeurs sans distinction. Un client pouvait donc se déclarer lui-même
  « servi » sans prestation réelle, ce qui débloquait un avis de service
  (`AVIS.type_avis = Service` exige `RESERVATION.statut = Honoree`, voir
  `avis_service.py`) sur une réservation jamais honorée. Ce n'était pas une
  omission de transcription comme l'unicité de `CLIENT.email` : le MLD
  d'origine ne portait aucune notion de droits, la faille est apparue en
  construisant l'usage réel du domaine. Le client ne peut désormais plus
  demander que `Annulee` sur cet endpoint ; `Honoree` vit sur
  `PUT /reservations/administration/{id}/statut`, réservé
  `PersonnelAdministrateur`.

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

- `AVIS.type_avis` est cohérent avec la cible renseignée — `Produit` implique
  `#id_ligne`, `Service` implique `#id_reservation`, et réciproquement. Décidé en
  construisant le Sprint 8 : le modèle initial portait la contrainte n°3
  (exactement une cible, XOR) sans jamais dire laquelle des deux `type_avis`
  doit l'accompagner — ce n'est pas une omission de transcription, c'est une
  précision qui n'avait pas encore été tranchée.

  ```sql
  CHECK ((type_avis = 'Produit') = (id_ligne IS NOT NULL))
  ```

  Une équivalence et non deux implications séparées : combinée à la contrainte
  n°3 (`cible_xor`, qui garantit qu'une seule des deux colonnes est renseignée),
  elle suffit à couvrir les deux sens à la fois — `Produit` sans `#id_ligne` est
  refusé, tout comme `Service` avec `#id_ligne`.

  Cette règle **ne croise aucune autre table** : `type_avis`, `#id_ligne` et
  `#id_reservation` vivent tous les trois sur `AVIS`. Contrairement à la
  cohérence `CONSOMMATION_REPAS.#id_beneficiaire` / `ABONNEMENT.mode_suivi`, qui
  traverse deux tables et n'est vérifiable qu'en service, celle-ci tient sur une
  seule ligne : rien n'empêche de la poser en `CHECK`, et c'est ce qui est fait
  — même raisonnement que `ABONNEMENT.tarif_selon_facturation`.

- **Un seul avis actif par client et par cible.** Deux index uniques
  **partiels** `WHERE supprime_le IS NULL`, et non des contraintes `UNIQUE`
  globales — même traitement que `uq_beneficiaire_identifiant_badge` :

  ```sql
  CREATE UNIQUE INDEX uq_avis_client_ligne
    ON avis (id_client, id_ligne)
    WHERE supprime_le IS NULL AND id_ligne IS NOT NULL;

  CREATE UNIQUE INDEX uq_avis_client_reservation
    ON avis (id_client, id_reservation)
    WHERE supprime_le IS NULL AND id_reservation IS NOT NULL;
  ```

  Partiels et non globaux parce qu'un avis retiré pour **modération** — le seul
  cas d'usage qui archive un `AVIS` — doit pouvoir être remplacé par un nouveau :
  un badge est réattribué, un avis modéré doit de même pouvoir être réécrit.
  Une contrainte globale bloquerait cette réécriture à vie, exactement comme
  elle bloquerait à vie la réinscription d'un `CLIENT` archivé. Ce n'est pas le
  cas des trois `UNIQUE` de cardinalité restées globales (`LIVRAISON.#id_commande`
  et les deux autres) : celles-ci expriment une propriété structurelle jamais
  réattribuée, pas une identité métier susceptible d'être reprise.

## Paiement

```
PAIEMENT(id_paiement, montant, methode, fournisseur, statut, reference_externe, date_paiement, #id_commande)
```

Absente du dictionnaire de données d'origine et de tout sprint jusqu'ici : le
Sprint 9 introduit la première entité entièrement nouvelle depuis le schéma
initial, pas la correction d'une omission comme `AVIS` ou `COMMANDE.date_commande`.

- **Plusieurs paiements sont possibles pour une même commande** :
  `#id_commande` n'est **pas** une clé étrangère unique. Décision actée en
  ouvrant le Sprint 9, pour couvrir nativement les tentatives échouées — une
  carte refusée, un mobile money interrompu — sans qu'aucune ligne ne
  représente le paiement effectif tant qu'elle n'est pas `Reussi`.

  Une **exception** existe malgré tout : un index unique **partiel**
  interdit plus d'un paiement `Reussi` actif par commande.

  ```sql
  CREATE UNIQUE INDEX uq_paiement_commande_reussi
    ON paiement (id_commande)
    WHERE statut = 'Reussi' AND supprime_le IS NULL;
  ```

  Même architecture à deux niveaux que le chevauchement `ABONNEMENT` (#97) et
  les créneaux `SALLE`/`LOGEMENT` (#47) : un service pré-contrôle pour
  produire un 409 lisible, mais c'est l'index qui tranche en cas de course.

  **La course se situe entre deux confirmations, pas deux initiations.**
  `PasserellePaiement.initier()` écrit toujours `statut=En_attente` — jamais
  `Reussi` — donc l'initiation elle-même ne peut jamais violer cet index.
  C'est la confirmation (webhook, Sprint 9.4), qui fait passer un paiement à
  `Reussi`, qui doit pré-contrôler et retomber sur l'index en cas de course
  entre deux confirmations concurrentes pour la même commande — pas
  `PaiementService.initier()` (Sprint 9.3), qui ne fait que le pré-contrôle
  applicatif (refuser une nouvelle initiation si un paiement est déjà
  `Reussi`), sans jamais pouvoir déclencher lui-même cette contrainte.

- `PAIEMENT.methode` ∈ {Carte, Mobile_money}. Domaine formel, `CHECK` en
  base, même traitement que `COMMANDE.type_commande`.

- `PAIEMENT.fournisseur` ∈ {Mvola, Orange_money, Airtel_money, Stripe}.
  Domaine formel et non chaîne libre, même raisonnement que
  `PERSONNEL.fonction` : une chaîne libre laisserait passer un identifiant de
  fournisseur mal orthographié sans rien signaler. Liste **fermée**, décidée
  en ouvrant le sprint ; un fournisseur non prévu impose une migration,
  délibérément.

- `PAIEMENT.statut` ∈ {En_attente, Reussi, Echoue}. Domaine formel, `CHECK`
  en base, même traitement que `COMMANDE.statut`.

  **Pas de valeur « Rembourse »**, délibérément : le remboursement est **hors
  périmètre du Sprint 9**. Le roadmap ne porte que l'intégration passerelle
  et le webhook de confirmation — rien sur le remboursement. L'ajouter
  maintenant mélangerait sur une même ligne deux cycles de vie distincts (un
  encaissement, puis un reversement), même écueil que celui déjà évité pour
  `SESSION_FORMATION`, qui n'a pas de statut « Complete ».

  **Note pour le sprint qui traitera le remboursement** : ne pas ajouter
  `Rembourse` au domaine existant. Un remboursement inverse le sens de
  l'argent ; le traiter comme un quatrième statut de la ligne de paiement
  d'origine confondrait « ce paiement a eu lieu » (fait immuable) et « il a
  depuis été reversé » (fait distinct, sur une opération distincte). La
  question a été anticipée et délibérément reportée en construisant le
  Sprint 9, pas oubliée — voir si une colonne `type_operation` distinguant
  `Paiement`/`Remboursement` est la meilleure réponse, plutôt que de
  réutiliser `statut`.

  **Reste distincte de `COMMANDE.rembourse_le`** (Sprint 10.5, section
  Transactions ci-dessus) : ce marqueur est un geste manuel simplifié posé
  côté commande, sans écriture sur `PAIEMENT` — il ne répond pas à cette
  question, il la contourne pour le besoin immédiat d'un tableau de bord.

- `PAIEMENT.reference_externe` est l'identifiant de transaction attribué par
  le fournisseur — simulé pour ce sprint, `FournisseurPaiement` n'ayant pas
  encore d'implémentation réelle. C'est la clé de corrélation du webhook : la
  confirmation reçue ne porte que cette référence, jamais `id_paiement`, qui
  n'a aucun sens hors de la plateforme.

  `UNIQUE` en base et **globale**, non partielle, contrairement à
  `identifiant_badge` : une référence de transaction n'est **jamais**
  réattribuée par un fournisseur, y compris pour un paiement archivé — même
  raisonnement que `LIVRAISON.#id_commande`, une propriété structurelle et
  non une identité métier susceptible d'être reprise.

- **Synchronisation `PAIEMENT → COMMANDE`, à sens unique**, même patron que
  `LIVRAISON → COMMANDE` (Sprint 3) : un paiement passant à `Reussi` fait
  progresser `COMMANDE.statut` (`En_attente` → `Confirmee`) dans la même
  transaction. Rien sur `COMMANDE` ne modifie jamais `PAIEMENT` en retour. Un
  paiement `Echoue` n'a **aucun** effet sur la commande — la marchandise
  n'est pas encore engagée, retenter est une décision du client, pas un
  changement d'état automatique.

- **Déclenchement séparé du tunnel de commande**, décidé en ouvrant le
  Sprint 9 : l'initiation d'un paiement n'est **pas** intégrée à
  `POST /commandes`. Une commande naît dans son cycle de vie actuel, inchangé
  ; le paiement s'initie ensuite, depuis un écran dédié sur une commande déjà
  créée. Objectif explicite : isoler tout le risque de la simulation — et de
  son remplacement futur par une vraie passerelle — du tunnel de commande
  déjà stable et testé, plutôt que de le modifier pour un mécanisme encore
  simulé.

- **`POST /paiements/{id_paiement}/simuler-confirmation`**, décidé en
  construisant 9.5 : un paiement initié reste `En_attente` tant qu'aucun
  webhook ne le confirme (cf. ci-dessus), et rien n'expose de moyen de
  déclencher cette confirmation simulée depuis l'écran de paiement. Cet
  endpoint rejoue le chemin du webhook (`PaiementService.confirmer`) sans
  rien dupliquer, réservé au client propriétaire du paiement.

  **C'est le seul endroit du code applicatif qui référence
  `PasserelleSimulee` par son nom** plutôt que par le contrat
  `PasserellePaiement` — délibérément : sa raison d'être (fabriquer la
  confirmation qu'un vrai fournisseur enverrait de lui-même) est un
  comportement propre à la simulation, absent de toute vraie passerelle.

  **Fermé par défaut derrière `Settings.ENVIRONMENT`** : l'endpoint refuse
  en dehors de `developpement`, avec le **même 404 générique** qu'un
  paiement introuvable — pour ne pas même laisser deviner son existence une
  fois une vraie passerelle en place. Le défaut de `ENVIRONMENT` est
  `production` : un déploiement qui omettrait la variable reste protégé par
  omission plutôt qu'exposé par omission. La garde vit dans le routeur, pas
  dans un bouton caché côté frontend, qui ne protégerait rien face à un
  appel direct.

  Le bouton « Simuler la confirmation » de `FormulairePaiement` (Sprint 9.5
  frontend) est malgré tout **masqué** hors `VITE_ENVIRONMENT=developpement`
  — un **confort d'affichage ajouté après coup**, pas une protection : sans
  lui, un clic sur ce bouton en production échouerait de toute façon en 404
  identique, mais un client le verrait échouer silencieusement, ce qui
  donne l'impression d'une fonctionnalité cassée plutôt
  qu'intentionnellement absente. Retirer ce masquage n'affaiblirait aucune
  garantie ; l'ajouter n'en crée aucune — la seule vraie garantie reste
  `Settings.ENVIRONMENT` côté serveur, ci-dessus.

  **Dette technique assumée malgré cette garde, pas un oubli** : cet
  endpoint n'a de sens que tant qu'aucune vraie passerelle n'est branchée,
  et la garde `ENVIRONMENT` ne le retire pas — elle empêche seulement qu'il
  réponde en production. Rien n'empêche non plus qu'il continue de
  fonctionner en environnement `developpement` une fois une vraie
  passerelle branchée dans cet environnement — décision actée en
  construisant 9.5 : retirer le code lui-même reste la responsabilité du
  sprint qui branchera un vrai fournisseur, pas de cette garde. Voir
  `docs/roadmap.md`, section Dette technique.

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

**Les 21 tables portent une colonne `supprime_le TIMESTAMPTZ NULL.`** `NULL`
signifie « ligne active » ; une date signifie « ligne archivée ». C'est la seule
colonne transverse du schéma, et elle n'apparaît pas dans les notations
`TABLE(...)` ci-dessus pour ne pas les alourdir vingt-et-une fois.

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
| `uq_avis_client_ligne` | `AVIS.(#id_client, #id_ligne)` | un avis retiré pour modération doit pouvoir être remplacé |
| `uq_avis_client_reservation` | `AVIS.(#id_client, #id_reservation)` | idem |

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
