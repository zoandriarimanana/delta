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

`#id_formateur` référence `PERSONNEL` (fonction = Formateur).

## Catalogue produits / espace

```
CATEGORIE_PRODUIT(id_categorie, libelle)
PRODUIT(id_produit, nom, description, prix_unitaire, unite_mesure, stock_disponible, est_personnalisable, supplement_personnalisation, est_livrable, #id_categorie)
SALLE(id_salle, nom, capacite, tarif_horaire, tarif_journee, equipements)
LOGEMENT(id_logement, type_chambre, capacite, tarif_nuitee, statut)
```

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

## Transactions

```
COMMANDE(id_commande, date_commande, reference_publique, adresse_livraison, nom_invite, contact_invite, type_commande, statut, montant_total, #id_client, #id_reservation)
LIGNE_COMMANDE(id_ligne, quantite, prix_unitaire_applique, #id_commande, #id_produit)
DEMANDE_PERSONNALISATION(id_personnalisation, description_demande, ingredients_specifiques, supplement_prix, #id_ligne, #id_produit_base)
RESERVATION(id_reservation, type_reservation, date_debut, date_fin, nombre_personnes, statut, avec_hebergement, #id_client, #id_session, #id_salle, #id_logement)
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
- `COMMANDE.type_commande` ∈ {En_ligne, Sur_place, A_emporter}
- `COMMANDE.statut` ∈ {En_attente, Confirmee, En_preparation, Livree, Servie, Annulee}
  Règle de service, **non exprimable en `CHECK`** puisqu'elle croise deux
  colonnes : une commande `Sur_place` se termine sur `Servie`, les deux autres
  types sur `Livree`.
- `COMMANDE.montant_total` est **figé à la création** : il vaut la somme des
  lignes au moment où la commande est passée, et n'est jamais recalculé. Une
  ligne archivée ensuite ne le modifie pas — c'est une donnée d'archive, pas une
  vue dérivée de `LIGNE_COMMANDE`.
- `COMMANDE.#id_reservation` est NULL sauf si la commande découle d'une réservation de table honorée sur place.
- `RESERVATION.type_reservation` ∈ {Formation, Salle, Logement, Table}.

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

**Les deux `UNIQUE` de cardinalité restent globales** — `LIVRAISON.#id_commande`
et `DEMANDE_PERSONNALISATION.#id_ligne`. Elles n'expriment pas une identité mais
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
