# Delta — Modèle Logique de Données (MLD)

Source de vérité du schéma relationnel. SGBD cible : PostgreSQL.
Notation : `TABLE(cle_primaire, attribut, ..., #cle_etrangere)`.

## Acteurs

```
CLIENT(id_client, type_client, email, telephone, adresse, mot_de_passe, date_creation_compte)
CLIENT_PARTICULIER(#id_client, nom, prenom, date_naissance)
CLIENT_ENTREPRISE(#id_client, raison_sociale, numero_id_fiscal, secteur_activite, nom_contact_referent, pays)
BENEFICIAIRE(id_beneficiaire, nom, prenom, identifiant_badge, statut, #id_abonnement)
PERSONNEL(id_personnel, nom, prenom, fonction, est_administrateur, mot_de_passe, email, telephone, date_embauche, specialite, zone_livraison, photo_chemin)
```

`CLIENT_PARTICULIER` et `CLIENT_ENTREPRISE` sont des sous-types exclusifs de `CLIENT`
(class table inheritance : `id_client` est à la fois PK et FK vers `CLIENT`).
Un `CLIENT` a exactement une ligne dans l'une des deux tables filles, jamais les
deux, jamais aucune.

Garanti par un **trigger différé** (Sprint 11, dette technique T0.7 résorbée) :
`verifier_exclusivite_client()`, attaché aux trois tables (`client`,
`client_particulier`, `client_entreprise`) via `CREATE CONSTRAINT TRIGGER ...
DEFERRABLE INITIALLY DEFERRED AFTER INSERT`, compte au **commit** de la
transaction les lignes filles pour le `id_client` concerné et rejette si le
total diffère de 1.

Différé, et non immédiat : au moment précis où `CLIENT` est inséré, aucune
ligne fille n'existe encore — l'application les insère juste après, dans la
même transaction. Un trigger immédiat échouerait donc systématiquement, y
compris sur le chemin normal de l'API. Attaché aux **trois** tables, et non à
`CLIENT` seule : un trigger sur `CLIENT` seule couvrirait « aucune ligne
fille » mais pas « les deux » ajoutées dans deux transactions distinctes après
coup ; un trigger sur les deux tables filles seules couvrirait l'inverse.

La fonction ouvre par `pg_advisory_xact_lock(id_client)`, indispensable et pas
décoratif : sans lui, deux transactions concurrentes ajoutant chacune une
ligne fille différente au même client (orphelin par exemple) peuvent chacune
compter `0+1=1` avant que l'autre ne committe, laissant passer les deux — race
empiriquement reproduite (deux connexions, deux transactions synchronisées) en
construisant cette migration. Un `SELECT ... FOR UPDATE` sur la ligne `CLIENT`
semblait une alternative plus simple, mais entre en **deadlock** avec le
verrou `FOR KEY SHARE` que PostgreSQL pose déjà implicitement sur cette même
ligne pour honorer les FK de `client_particulier`/`client_entreprise` au
moment de l'`INSERT` — chaque transaction détient `KEY SHARE` et tente
d'upgrader vers `UPDATE`, cycle classique, également confirmé empiriquement.
Le verrou consultatif est indépendant de ce système de verrous de lignes/FK.

La garantie applicative reste la première ligne de défense — `AuthService`
crée toujours `CLIENT` et sa ligne fille dans une seule transaction, le
trigger ne devrait jamais se déclencher sur ce chemin. C'est un filet contre
tout écrivain qui ne passe pas par l'API : import SQL, script de seed,
correction manuelle en base — la menace documentée depuis le Sprint 0.

Hors périmètre, assumé : une suppression manuelle d'une ligne fille existante
n'est pas couverte (seul `AFTER INSERT` est visé) — cohérent avec la menace
ci-dessus, des écritures erronées, pas des suppressions, et `CLIENT` n'est de
toute façon jamais soumis à `supprimer_definitivement()`.

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

- `PERSONNEL.photo_chemin` est un `VARCHAR(255)` **nullable**, ajouté hors
  sprint (chantier « photo de profil »). `NULL` signifie « pas de photo » —
  l'avatar générique s'affiche côté frontend, jamais un espace vide.

  Stocke un **nom de fichier généré** (UUID + extension déduite du format
  d'image réellement détecté), jamais un chemin absolu ni le nom d'origine
  envoyé par le client : ferme à la fois les collisions et toute tentative de
  traversée de chemin. Le fichier lui-même vit sur disque, dans un dossier
  dédié du backend (`Settings.PHOTO_STORAGE_DIR`) — **pas** en blob dans cette
  colonne, et pas d'infrastructure de stockage d'objets externe pour
  l'instant : scope volontairement réduit à ce que le besoin actuel demande.

  **Jamais exposée par `PersonnelRead`.** La photo se lit via
  `GET /personnel/{id}/photo`, une route authentifiée dédiée (même niveau que
  `GET /personnel` — tout salarié connecté, pas seulement un administrateur) :
  exposer le nom de fichier lui-même n'aurait aucun intérêt côté client, qui
  ne peut de toute façon pas accéder au disque du serveur, et un montage de
  fichiers statiques classique n'aurait pu passer par cette authentification
  — la doctrine déjà écrite pour `PERSONNEL` (« rien n'y a vocation à être
  exposé anonymement », cf. `docs/architecture.md`) l'interdit.

  **Traitée comme donnée personnelle par `PersonnelService.anonymiser()`** :
  au même titre que le nom, l'e-mail ou le téléphone, le fichier est supprimé
  du disque et la colonne remise à `NULL` — une photo de profil identifie au
  moins autant qu'un nom. Un archivage simple (`supprimer()`), en revanche,
  ne touche pas à la photo : l'archivage reste réversible
  (`restaurer()`), et une restauration qui ferait perdre la photo serait une
  perte de donnée non voulue par la seule réversibilité de l'archivage.

- `CLIENT_ENTREPRISE.pays` est le pays de la société, code **ISO 3166-1
  alpha-2** (`MG`, `FR`, `US`…), `NOT NULL DEFAULT 'MG'` — ajouté le
  8 octobre 2026 (ouverture internationale), hors sprint. Les sociétés déjà
  inscrites étaient toutes malgaches, d'où la valeur par défaut.

  ```sql
  CHECK (length(pays) = 2 AND pays = upper(pays))
  ```

  Écrit sans expression régulière pour rester valable sous SQLite (tests) ;
  le schema d'entrée, lui, exige `^[A-Z]{2}$`. Le code n'est pas confronté à
  la liste ISO en base : c'est le sélecteur du frontend qui la porte, et un
  code bien formé mais inexistant ne casse rien.

  `numero_id_fiscal` garde son nom et son unicité : pour une société
  étrangère il porte son identifiant fiscal national (n° de TVA, EIN…).

## Catalogue formation

```
DOMAINE_FORMATION(id_domaine, libelle, description)
FORMATION(id_formation, titre, niveau, duree_heures, prix, capacite_max, propose_hebergement, description, #id_domaine)
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

## Formation sur commande

```
DEMANDE_FORMATION(id_demande, sujet, nombre_participants, niveau, periode_souhaitee, lieu, message, nom_contact, contact, statut, note_interne, date_demande, #id_client)
```

Ajoutée le 14 octobre 2026, retour du client après la présentation : un
visiteur demande une formation **qui n'est pas au catalogue** (« Vous ne
trouvez pas votre formation ? »). Entité nouvelle, pas la correction d'une
omission.

- **Envoyée avec ou sans compte.** `#id_client` est **déduit de la
  session**, jamais du corps — même règle que `COMMANDE.#id_client` ;
  `NULL` pour un visiteur. `nom_contact` et `contact` sont exigés même pour
  un client connecté : il peut vouloir être rappelé ailleurs.
  `ON DELETE RESTRICT`, comme toute trace d'un client.
- `statut` ∈ {Nouvelle, En_discussion, Planifiee, Refusee}, domaine formel,
  `CHECK` en base. Une demande naît `Nouvelle` ; seule l'administration le
  fait évoluer, dans les deux sens — rien n'est engagé tant qu'aucune
  session n'est créée au catalogue. `Planifiee` dit que la formation a été
  montée, par les écrans existants du catalogue.
- `lieu` ∈ {Chez_delta, En_entreprise, Indifferent}, domaine formel.
- `note_interne` appartient à l'administration et n'est jamais renvoyée au
  demandeur : l'envoi ne lui rend qu'un accusé (`id_demande`,
  `date_demande`).
- `CHECK (nombre_participants >= 1)`.
- **Lecture réservée à l'administration** : la demande porte le nom et le
  contact d'une personne. L'envoi est public, débit limité par IP.

## Catalogue produits / espace

```
CATEGORIE_PRODUIT(id_categorie, libelle)
PRODUIT(id_produit, nom, description, prix_unitaire, unite_mesure, stock_disponible, est_personnalisable, supplement_personnalisation, est_livrable, vendu_par_personne, personnes_min, #id_categorie)
SALLE(id_salle, nom, capacite, tarif_horaire, tarif_journee, equipements, description)
LOGEMENT(id_logement, type_chambre, capacite, tarif_nuitee, statut, description)
```

- `SALLE.description`, `LOGEMENT.description` et `FORMATION.description`
  (ajoutée ensuite, même demande étendue aux formations) sont des `TEXT` **nullables**,
  ajoutés hors sprint avec la galerie (demande du 5 octobre 2026) : une
  présentation libre affichée sur la fiche publique. `NULL` signifie « pas
  encore rédigée » — la fiche l'annonce, elle n'affiche jamais un paragraphe
  vide. Bornée à 4 000 caractères **côté API seulement** : une fiche se lit,
  elle ne doit pas devenir un document. Absente du dictionnaire d'origine,
  comme `PRODUIT.description` qui, elle, y figurait.

- **Photos du catalogue : aucune table, des fichiers sur disque.** Les
  photos des salles, logements, formations et produits sont rangées dans
  `backend/static/upload/<partie>/` (`salles/`, `logements/`, `formations/`,
  `produits/`), chacune nommée **`<id>-<n>.<ext>`** — `3-2.jpg` est la
  deuxième photo de la salle n°3. L'ordre est celui de `n`, la première sert
  de couverture. Décision de l'utilisateur (5 octobre 2026) : pouvoir lire,
  ranger et déposer les fichiers soi-même.

  Une table `PHOTO_BIEN` (photos en `bytea`) a existé brièvement le même jour
  (migrations `e2cb623114f8` et `263370ab6692`) ; elle est **retirée** par
  `4e4ce0aaf1ea`, avec les seules photos de test qu'elle contenait. Les
  colonnes `description` sont conservées.

  Sans table, rien en base ne relie un fichier à son élément : c'est le
  **nom** qui porte le lien, et `GalerieService` qui le vérifie (élément
  actif, motif `^\d+-\d+\.(jpg|png|webp)$`). Archiver un élément rend ses
  photos invisibles sans toucher aux fichiers ; le restaurer les fait
  réapparaître. **Supprimer définitivement** un élément laisse en revanche ses
  fichiers orphelins sur disque — aucun `CASCADE` ne les atteint. Sans
  conséquence visible (un fichier dont l'identifiant n'existe plus n'est
  jamais servi), mais un identifiant n'étant jamais réattribué par PostgreSQL,
  ils ne ressortiront pas.

  **Catégories et modèles** (14 octobre 2026) : deux parties s'ajoutent.
  `categories/` porte les **exemples de réalisations** d'une catégorie,
  montrés au client ; `modeles/` porte la **copie** du modèle qu'un client
  a choisi parmi eux en personnalisant, nommée d'après sa demande
  (`<id_personnalisation>-1.<ext>`). Copiée et non référencée : un numéro
  libéré par un retrait peut être réattribué à une autre image, et le
  modèle doit rester celui que le client a vu.
  `DEMANDE_PERSONNALISATION.photo_modele` (`VARCHAR(100)`, nullable) porte
  le nom de cette copie ; le serveur vérifie que la source appartient au
  **produit commandé** ou à **sa catégorie** (422 sinon), jamais un nom
  recopié tel quel depuis la requête. La requête dit d'où vient la photo
  (`source_modele` : `produits` ou `categories`, défaut `categories`) ; ce
  choix n'est pas stocké, seule la copie l'est.

  **Limite majeure, acceptée par l'utilisateur** : le disque d'un service
  Render est effacé à chaque déploiement. Voir la dette « Photos du catalogue
  sur disque » dans `docs/roadmap.md`.

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

- `PRODUIT.vendu_par_personne` (booléen, défaut `false`) et
  `PRODUIT.personnes_min` (nullable), ajoutés le 7 octobre 2026 (hors
  sprint), sur décision de l'utilisateur : un gâteau se vend **au nombre de
  personnes**. Pour un tel produit :

  - `prix_unitaire` est un prix **par personne**, et
    `LIGNE_COMMANDE.quantite` compte des **personnes** ;
  - `stock_disponible` compte des **produits entiers** : une ligne de
    commande en consomme **un**, quel que soit le nombre de personnes — un
    gâteau pour 8 n'est pas 8 gâteaux. Pour deux gâteaux, deux commandes ;
  - une commande sous `personnes_min` est refusée en 422 ;
  - `supplement_personnalisation` reste compté par unité, donc **par
    personne**.

  ```sql
  CHECK ((personnes_min IS NULL OR personnes_min >= 1)
     AND (NOT vendu_par_personne OR personnes_min IS NOT NULL))
  ```

  Le `IS NOT NULL` est indispensable : une première écriture,
  `NOT vendu_par_personne OR personnes_min >= 1`, laissait passer un minimum
  `NULL` — la comparaison vaut alors `NULL`, et un `CHECK` à `NULL` passe.
  Trouvé par le test qui viole la contrainte volontairement. Répétée dans
  `ProduitCreate` et `ProduitService.modifier` pour un 422 lisible, même
  architecture que `personnalisable_a_un_supplement`.

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
COMMANDE(id_commande, date_commande, reference_publique, adresse_livraison, nom_invite, contact_invite, type_commande, statut, montant_total, frais_livraison, devise, taux_change, montant_total_devise, #id_client, #id_reservation, #id_personnel)
LIGNE_COMMANDE(id_ligne, quantite, prix_unitaire_applique, #id_commande, #id_produit)
DEMANDE_PERSONNALISATION(id_personnalisation, description_demande, ingredients_specifiques, photo_modele, supplement_prix, #id_ligne, #id_produit_base)
RESERVATION(id_reservation, type_reservation, date_debut, date_fin, date_reservation, nombre_personnes, statut, avec_hebergement, montant_total, montant_acompte, #id_client, #id_session, #id_salle, #id_logement, #id_reservation_hebergement)
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

  **L'administration fait avancer une commande d'une étape à la fois**
  (13 octobre 2026) : `En_attente → Confirmee → En_preparation →` terminal,
  calculé par le serveur et jamais choisi par la requête. Jusque-là, seul un
  paiement en ligne confirmait une commande et seule une livraison la
  terminait : une commande payée en espèces ou retirée en boutique restait
  en attente pour toujours. Une commande **avec livraison** s'arrête à
  `En_preparation` — sa fin reste la livraison marquée livrée, pour qu'il
  n'existe pas deux façons de dire « livrée ».

  **« Supprimer » une commande, c'est l'archiver** (13 octobre 2026) :
  `supprime_le` posé sur la commande, ses lignes et ses personnalisations,
  jamais un `DELETE` — une commande est une preuve de vente, référencée par
  ses paiements et sa livraison, qui restent tels quels. Réservé aux
  commandes terminées ou annulées (409 sinon), réversible par restauration.
- `COMMANDE.montant_total` est **figé à la création** : il vaut la somme des
  lignes au moment où la commande est passée, **plus `frais_livraison`**
  depuis le 7 octobre 2026, et n'est jamais recalculé. C'est ce total que
  `PAIEMENT` encaisse.

- `COMMANDE.frais_livraison` est un `NUMERIC(10,2) NOT NULL DEFAULT 0`,
  ajouté avec `TARIF_LIVRAISON` (voir plus bas). Il vaut le forfait en
  vigueur **si une `adresse_livraison` est donnée**, `0` sinon — ou si la
  livraison est offerte. Calculé par le serveur, **jamais accepté depuis la
  requête**, recopié puis **figé** : même règle que
  `LIGNE_COMMANDE.prix_unitaire_applique`, changer le tarif ne rétroagit pas.
  Les commandes antérieures valent `0` : elles n'ont jamais payé de
  livraison, et leur `montant_total` reste juste. Une
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
- **Impayés : expiration et acompte** (13 octobre 2026, décisions de
  l'utilisateur pour limiter les abus — faux comptes qui bloquent stock et
  créneaux —, préférées à des frais d'inscription) :

  - une commande `En_attente` passée par un client est **annulée après
    2 h** sans paiement (`COMMANDE_DELAI_PAIEMENT_MINUTES`) ; une commande
    saisie par le personnel (`#id_personnel`) n'expire jamais, elle se règle
    au comptoir ;
  - **une commande annulée rend son stock**, par l'expiration comme par
    l'administration — symétrique du décrément, comme les places d'une
    session. Jusqu'ici, annuler laissait le stock bloqué ;
  - `RESERVATION.montant_total` est le prix de la prestation, **calculé par
    le serveur et figé** à la création : salle au moins cher entre heures
    entamées × tarif horaire et jours entamés × tarif journalier, chambre
    aux nuits entamées × tarif (une au moins), formation au prix × personnes.
    `NULL` pour une table et pour les réservations antérieures ;
  - `RESERVATION.montant_acompte` vaut **30 %** du prix
    (`ACOMPTE_POURCENTAGE`), arrondi au centime. `NULL` : aucun acompte —
    table, prix nul, chambre réservée avec une formation (elle suit sa
    formation), réservation antérieure.
    `CHECK (montant_acompte IS NULL OR (montant_total IS NOT NULL AND
    montant_acompte >= 0 AND montant_acompte <= montant_total))` ;
  - un acompte payé (`PAIEMENT` sur `#id_reservation`, statut `Reussi`)
    **confirme** la réservation et sa chambre liée ; sans acompte, la
    réservation est **annulée après 24 h**
    (`RESERVATION_DELAI_ACOMPTE_HEURES`), places rendues et chambre liée
    annulée ;
  - `RESERVATION.date_reservation` (`DEFAULT now()`, posé par la base) fait
    courir ce délai : `date_debut` dit quand a lieu la prestation, rien ne
    disait quand elle avait été réservée ;
  - un paiement initié depuis moins de 30 min épargne l'expiration : le
    client est peut-être en train de valider sur son téléphone.

  L'API expose les échéances (`COMMANDE.paiement_avant`,
  `RESERVATION.acompte_avant`, calculées, non stockées) pour que l'écran
  les affiche sans recalculer la règle.

- **« Supprimer » une réservation, c'est l'archiver** (14 octobre 2026),
  même règle que `COMMANDE` : `supprime_le` posé sur la réservation et son
  hébergement lié, jamais un `DELETE`. Réservé aux réservations **honorées
  ou annulées** (409 sinon), sans rendre de place — une honorée a consommé
  la sienne, une annulée l'a déjà rendue. Réversible par restauration, sauf
  si le créneau a été repris entre-temps (contrainte d'exclusion, 409) ou si
  la réservation était encore en cours quand son client l'a archivée.

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

## Tarif de livraison

```
TARIF_LIVRAISON(id_tarif, forfait, seuil_gratuite)
```

Ajoutée le 7 octobre 2026 (hors sprint), sur décision de l'utilisateur :
**forfait unique**, compté **une fois par commande** quel que soit le nombre
d'articles, **offert** dès que les produits atteignent `seuil_gratuite`,
**réglé par l'administrateur**. Valeurs posées par la migration (5 000 Ar,
offerte dès 100 000 Ar), modifiables ensuite.

- **Une seule ligne**, `id_tarif = 1`, posée par la migration et jamais
  créée par l'API : `CHECK (id_tarif = 1)`. Une table de réglage, pas un
  catalogue — une seconde ligne ne dirait pas laquelle appliquer.
- `forfait >= 0` ; `seuil_gratuite` est `NULL` (« jamais offerte ») ou
  strictement positif. Un seuil à `0` rendrait la livraison toujours
  gratuite : c'est `forfait = 0` qui exprime cela.
- **Le seuil se compare aux produits seuls** (personnalisations comprises),
  jamais à un total qui contiendrait déjà les frais — sinon le forfait
  aiderait à atteindre sa propre gratuité.
- Aucun historique : le montant appliqué est figé dans
  `COMMANDE.frais_livraison`.

## Taux de change

```
TAUX_CHANGE(id_taux, devise, ariary_par_unite, mis_a_jour_le)
```

Ajoutée le 8 octobre 2026 (ouverture internationale), hors sprint :
**paiement réel en devise**, décision de l'utilisateur. Le client choisit
MGA, EUR ou USD ; le catalogue reste tenu en Ariary — un prix n'existe
qu'une fois — et la conversion se fait à la commande.

- `devise` ∈ {MGA, EUR, USD} (codes ISO 4217). Domaine formel **fermé**, même
  traitement que `PAIEMENT.fournisseur` : une devise non prévue suppose un
  taux et un moyen de paiement capable de l'encaisser, elle impose donc une
  migration, délibérément. `UNIQUE` : une ligne par devise.

- **Pas de ligne pour l'Ariary**, garanti en base :

  ```sql
  CHECK (devise <> 'MGA')
  CHECK (ariary_par_unite > 0)
  ```

  Le taux de l'Ariary vaut 1 par définition ; le stocker permettrait de le
  rendre faux. Les lignes EUR et USD sont posées par la migration ; aucun
  endpoint n'en crée ni n'en supprime, l'administrateur ne fait que régler
  `ariary_par_unite` (Ariary pour **une** unité de devise, quatre décimales).

- `mis_a_jour_le` est montré au client : un taux n'a de sens qu'avec sa date.

- **Le taux est recopié puis figé** dans `COMMANDE.taux_change` à la
  commande, même règle que `TARIF_LIVRAISON` → `COMMANDE.frais_livraison` :
  régler un taux ne rétroagit jamais sur une commande passée. Aucun
  historique n'est donc nécessaire ici.

Côté `COMMANDE` (section Transactions) :

- `devise` — `NOT NULL DEFAULT 'MGA'`, même domaine. **Seul le choix** de la
  devise vient de la requête.
- `taux_change` — `NUMERIC(14,4) NOT NULL DEFAULT 1`, lu dans `TAUX_CHANGE`
  et figé, **jamais** accepté du client (il fixerait ce qu'il paie).
- `montant_total_devise` — `montant_total` (frais de livraison compris)
  divisé par le taux, arrondi au centime au demi supérieur, **figé**. C'est
  ce que le client paie et ce que `PAIEMENT` encaisse. `montant_total` reste
  la référence comptable en Ariary.

  ```sql
  CHECK (devise <> 'MGA' OR taux_change = 1)
  CHECK (taux_change > 0)
  ```

  Les commandes antérieures sont en Ariary, au taux 1, et la migration a posé
  `montant_total_devise = montant_total`.

- **Montant minimum hors Ariary : 0,50** dans la devise — en dessous, une
  carte internationale refuse la transaction (minimum Stripe). Règle de
  service, refus en 422 : une commande impayable ne doit pas naître.

## Paiement

```
PAIEMENT(id_paiement, montant, devise, methode, fournisseur, statut, reference_externe, date_paiement, #id_commande, #id_reservation)
```

Absente du dictionnaire de données d'origine et de tout sprint jusqu'ici : le
Sprint 9 introduit la première entité entièrement nouvelle depuis le schéma
initial, pas la correction d'une omission comme `AVIS` ou `COMMANDE.date_commande`.

- **Un paiement règle une commande ou l'acompte d'une réservation**
  (13 octobre 2026) : `#id_commande` est devenu nullable, `#id_reservation`
  s'y ajoute, tous deux en `ON DELETE RESTRICT`.

  ```sql
  CHECK ((id_commande IS NOT NULL) <> (id_reservation IS NOT NULL))
  ```

  Un index unique partiel `uq_paiement_reservation_reussi`, pendant de
  `uq_paiement_commande_reussi`, interdit deux acomptes réussis pour une même
  réservation. L'acompte est toujours en Ariary, comme les tarifs.

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
  base, même traitement que `COMMANDE.type_commande`. `Carte` désigne la
  **carte bancaire internationale** (Visa, Mastercard, American Express) —
  libellé précisé côté client le 8 octobre 2026, valeur inchangée.

  **Cohérence méthode / fournisseur** (8 octobre 2026) : `Carte` passe par
  `Stripe`, `Mobile_money` par `Mvola`, `Orange_money` ou `Airtel_money`.
  Portée par le schema d'entrée (422) : toute combinaison croisée serait
  impayable.

- `PAIEMENT.devise` — la devise de `montant`, recopiée de
  `COMMANDE.devise` ; `montant` vaut `COMMANDE.montant_total_devise`. Un
  montant sans devise ne dit pas ce qui a été encaissé. **Le mobile money
  n'est accepté qu'en Ariary** : les portefeuilles malgaches n'opèrent pas
  en devise. Une commande en EUR ou USD se paie par carte (422 sinon —
  règle de service, elle croise `PAIEMENT` et `COMMANDE`).

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

- **Une commande invitée se paie aussi** (9 octobre 2026) :
  `POST /commandes/invite/{reference}/paiements`, sans authentification — la
  clé est la référence publique, l'UUID qui permet déjà à l'invité de lire sa
  commande. Débit limité par IP. Mêmes règles qu'un client connecté.

- **Numéro mobile money : exigé, vérifié, jamais stocké.** Le portefeuille à
  débiter est transmis à la passerelle (c'est lui qui reçoit la demande de
  validation de l'opérateur), mais `PAIEMENT` n'a **aucune colonne** pour
  lui : `reference_externe` suffit à retrouver la transaction chez
  l'opérateur. Minimisation des données personnelles — un numéro qu'on ne
  garde pas ne peut pas fuir. Le préfixe doit correspondre à l'opérateur
  choisi (034/038 MVola, 032/037 Orange Money, 033 Airtel Money ; pas de
  portabilité des numéros à Madagascar), 422 sinon.

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

## Assistant IA — base de connaissances

```
DOCUMENT_CONNAISSANCE(id_document, titre, nom_fichier, type_fichier, taille_octets, public_cible, texte_extrait, date_ajout, #id_personnel)
```

Ajoutée au Sprint 12 (12.9) : documents téléversés par l'administration pour
enrichir la base de connaissances de l'assistant IA. Entité entièrement
nouvelle, comme `PAIEMENT` au Sprint 9 — pas la correction d'une omission.

- **Le texte extrait est stocké, pas le fichier.** Le disque d'un service
  Render est effacé à chaque redéploiement : un fichier rangé sur disque
  disparaîtrait, et l'index vectoriel ne pourrait plus être reconstruit. Le
  texte suffit à réindexer à tout moment. Contrepartie assumée : le fichier
  d'origine n'est pas re-téléchargeable depuis la plateforme — l'administration
  en garde sa copie.

  ```sql
  CHECK (length(texte_extrait) > 0)
  ```

  Un document sans texte (PDF scanné) n'apporterait rien à l'index : il est
  refusé au téléversement, et la base le refuse aussi.

- `DOCUMENT_CONNAISSANCE.public_cible` ∈ {Client, Personnel}. Domaine formel,
  `CHECK` en base. **C'est la valeur qui décide si un contenu peut ressortir
  dans la bulle publique du site** : elle devient la métadonnée `audience` des
  fragments indexés, et l'assistant client ne recherche que l'audience
  `client`. Une chaîne libre laisserait passer « client » ou « Clients » sans
  que le filtre les reconnaisse.

- `DOCUMENT_CONNAISSANCE.type_fichier` ∈ {pdf, docx, txt, md}. **Déduit des
  octets** du fichier, jamais de son nom ni du `Content-Type` déclaré — même
  règle que `PERSONNEL.photo_chemin`. `nom_fichier` garde le nom d'origine pour
  l'affichage ; il n'est jamais utilisé comme chemin.

- `DOCUMENT_CONNAISSANCE.#id_personnel` est le salarié qui a téléversé,
  **dérivé du jeton, jamais du corps** — même règle que `COMMANDE.#id_personnel`.
  `ON DELETE RESTRICT` : un salarié s'anonymise, il ne s'efface pas.

- **Pas de modification** : un document se remplace — archiver l'ancien,
  téléverser le nouveau. Archiver le retire de l'index, restaurer l'y remet.

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

**Les 23 tables portent une colonne `supprime_le TIMESTAMPTZ NULL.`** `NULL`
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

## Hors MLD — index vectoriel de l'assistant IA (Sprint 12)

Deux tables existent en base **sans appartenir au MLD** :
`langchain_pg_collection` et `langchain_pg_embedding`. Elles portent l'index
vectoriel de l'assistant IA, et sont créées puis gérées par la bibliothèque
`langchain-postgres` — leur schéma suit la version de cette bibliothèque, pas
une décision métier. Exception **explicite** à la règle « toute modification du
schéma passe par ce document et une migration », écrite ici pour qu'elle ne se
confonde pas avec un oubli.

Ce qui reste sous la règle commune : l'extension **`vector`** (pgvector) dont
elles dépendent est créée par une migration Alembic (`5f032c8475f6`), jamais
par la bibliothèque au premier appel. Et `alembic/env.py` exclut ces deux tables
de la comparaison (`include_object`) — sans quoi `alembic check` conclurait
qu'il faut les supprimer, vérifié empiriquement.

Ce ne sont **pas des entités** : aucune clé étrangère vers ou depuis le MLD,
pas de `supprime_le`, et elles ne comptent pas parmi les 23 tables. Elles ne
contiennent **aucune donnée d'origine** — seulement des fragments de texte
dérivés du catalogue public, et leurs vecteurs. Elles sont donc
**reconstructibles à tout moment** depuis la base métier, et une perte de leur
contenu n'est jamais une perte de donnée.

Ce qu'elles ont le droit de contenir est fixé dans `docs/roadmap.md`, Sprint 12 :
uniquement ce que l'API expose déjà anonymement, jamais une donnée personnelle,
jamais une entité archivée, et jamais un prix, un stock ou un nombre de places
présenté comme un fait — ces valeurs changent à chaque vente.

## Hypothèse de travail à surveiller

`RESERVATION.#id_client` est actuellement NOT NULL (compte obligatoire pour réserver,
contrairement à `COMMANDE` qui autorise l'invité). Si cette règle métier change,
ajouter `nom_invite`/`contact_invite` sur `RESERVATION` à l'identique de `COMMANDE`
et rendre `#id_client` nullable.
