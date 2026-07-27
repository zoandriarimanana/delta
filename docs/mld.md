# Delta — Modèle Logique de Données (MLD)

Source de vérité du schéma relationnel. SGBD cible : PostgreSQL.
Notation : `TABLE(cle_primaire, attribut, ..., #cle_etrangere)`.

## Acteurs

```
CLIENT(id_client, type_client, email, telephone, adresse, mot_de_passe, date_creation_compte)
CLIENT_PARTICULIER(#id_client, nom, prenom, date_naissance)
CLIENT_ENTREPRISE(#id_client, raison_sociale, numero_id_fiscal, secteur_activite, nom_contact_referent)
BENEFICIAIRE(id_beneficiaire, nom, prenom, identifiant_badge, statut, #id_abonnement)
PERSONNEL(id_personnel, nom, prenom, fonction, email, telephone, date_embauche, specialite, zone_livraison)
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
PRODUIT(id_produit, nom, description, prix_unitaire, unite_mesure, stock_disponible, est_personnalisable, est_livrable, #id_categorie)
SALLE(id_salle, nom, capacite, tarif_horaire, tarif_journee, equipements)
LOGEMENT(id_logement, type_chambre, capacite, tarif_nuitee, statut)
```

## Abonnement (cantine B2B)

```
ABONNEMENT(id_abonnement, date_debut, date_fin, type_facturation, mode_suivi, nombre_repas_inclus, tarif_forfait, tarif_unitaire_repas, #id_client_entreprise)
CONSOMMATION_REPAS(id_consommation, date_consommation, quantite, #id_abonnement, #id_beneficiaire)
```

- `type_facturation` ∈ {Forfait, Consommation_reelle}
- `mode_suivi` ∈ {Individuel, Global} — si Global, `#id_beneficiaire` est NULL.

## Transactions

```
COMMANDE(id_commande, nom_invite, contact_invite, type_commande, statut, montant_total, #id_client, #id_reservation)
LIGNE_COMMANDE(id_ligne, quantite, prix_unitaire_applique, #id_commande, #id_produit)
DEMANDE_PERSONNALISATION(id_personnalisation, description_demande, ingredients_specifiques, supplement_prix, #id_ligne, #id_produit_base)
RESERVATION(id_reservation, type_reservation, date_debut, date_fin, nombre_personnes, statut, avec_hebergement, #id_client, #id_session, #id_salle, #id_logement)
```

- `COMMANDE.#id_client` est NULL si commande en mode invité (`nom_invite`/`contact_invite` alors renseignés).
- `COMMANDE.#id_reservation` est NULL sauf si la commande découle d'une réservation de table honorée sur place.
- `RESERVATION.type_reservation` ∈ {Formation, Salle, Logement, Table}.

## Logistique / Avis

```
LIVRAISON(id_livraison, adresse_livraison, date_heure_prevue, date_heure_reelle, statut, #id_commande, #id_personnel)
AVIS(id_avis, type_avis, note, commentaire, date_avis, #id_client, #id_ligne, #id_reservation)
```

- `#id_personnel` référence `PERSONNEL` (fonction = Livreur).
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

## Hypothèse de travail à surveiller

`RESERVATION.#id_client` est actuellement NOT NULL (compte obligatoire pour réserver,
contrairement à `COMMANDE` qui autorise l'invité). Si cette règle métier change,
ajouter `nom_invite`/`contact_invite` sur `RESERVATION` à l'identique de `COMMANDE`
et rendre `#id_client` nullable.
