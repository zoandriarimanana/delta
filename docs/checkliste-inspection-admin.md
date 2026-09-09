# Checklist d'inspection manuelle — compte admin QA

Rapport d'assurance qualité, distinct de `docs/roadmap.md` (qui documente les
sprints de développement) — celui-ci suit l'état d'une inspection manuelle
en cours, pas un plan de construction. Référence les identifiants et
données exactes du seed `backend/scripts/seed_qa_complet.py`, pour que
chaque case « à voir » soit vérifiable contre une valeur connue, pas une
impression.

**Légende** : `☐` à faire · `✅` conforme · `❌` non conforme (voir note) ·
`⚠️` à investiguer (voir note).

---

## 1. PERSONNEL — `personnel/administration` (liste) + `personnel/administration/:id` (fiche)

### 1.1 Ce qu'on doit VOIR

| État | Vérification |
|---|---|
| ✅ | La liste affiche 5 lignes : Rabearison Tiana (Formateur), Andriatsitohaina Mamy (Livreur), Ravelojaona Solo (Cuisinier), Randrianasolo Fara (Receptionniste), Rasolofo Admin (Autre) |
| ✅ | Le filtre « Fonction » réduit correctement la liste à chaque valeur (Formateur, Livreur, Cuisinier, Receptionniste, Autre) — vérifié sur « Livreur », ne laisse plus qu'Andriatsitohaina Mamy |
| ✅ | La fiche de chaque membre affiche fonction, e-mail, téléphone, date d'embauche cohérents avec le seed (ex. `formateur-qa@delta.mg`, spécialité « Pâtisserie française ») |
| ✅ | Le livreur affiche sa zone de livraison (« Analamanga ») ; les autres affichent `—` pour ce champ |
| ✅ | Aucun mot de passe ni droit `est_administrateur` n'est visible nulle part dans la liste ou la fiche (vérifié sur le HTML brut de la page, aucune occurrence) |

### 1.2 Ce qu'on doit pouvoir FAIRE

| État | Action |
|---|---|
| ✅ | Créer un nouveau membre depuis la liste (« Nouveau membre ») — apparaît ensuite dans le tableau |
| ✅ | Modifier un membre depuis sa fiche — les changements persistent après retour à la liste |
| ✅ | Archiver un membre depuis sa fiche |
| ✅ | Anonymiser un membre depuis sa fiche (nom/prénom/e-mail réécrits, `fonction` et ancienneté conservées) |
| ✅ | Restaurer un membre juste après l'avoir archivé (bouton visible seulement après archivage/anonymisation) — **uniquement sans navigation intermédiaire**, voir cas limite ci-dessous |

### 1.3 Cas limites à tester

| État | Cas |
|---|---|
| ⚠️ | Après archivage ou anonymisation, la fiche continue d'afficher les dernières données connues **tant qu'on reste sur la même page** (état local en mémoire) — mais une navigation fraîche vers la même URL (nouvel onglet, F5, ou retour après être passé par la liste) donne « Membre du personnel introuvable. », sans bouton Restaurer. Comportement cohérent avec la dette documentée en 10.1 (absence de `GET /personnel?inclure_supprimes`), mais plus strict que la formulation initiale de ce point : ce n'est pas juste « pas de 404 brutal », c'est bien un 404 dès que l'état local est perdu. Restaurer un membre archivé par erreur suppose donc de le faire **sans quitter la page**, ou de rejouer l'action via `/docs`/l'API directement. |
| ✅ | Une fois archivé/anonymisé, les boutons Modifier/Archiver/Anonymiser disparaissent, seul « Restaurer » reste (vérifié sans navigation intermédiaire) |
| ✅ | Un membre archivé **ne réapparaît plus** dans la liste principale après un rechargement (F5) — cohérent avec l'absence de vue d'archives documentée comme dette |
| ✅ | Créer un membre avec un e-mail déjà utilisé (ex. `client-qa@delta.mg`) est accepté (table différente) ; réessayer avec un e-mail personnel déjà pris (ex. `formateur-qa@delta.mg`) refuse avec le message clair « Un membre du personnel actif utilise déjà cette adresse. » |
| ✅ | Anonymiser deux fois de suite le même membre ne provoque pas d'erreur — vérifié via deux appels directs à `POST /personnel/{id}/anonymisation`, les deux répondent 200 avec un résultat identique (idempotent, aucune garde supplémentaire nécessaire) |

**Note d'environnement** : l'inspection a aussi révélé 2 lignes en base sans rapport avec le seed QA (`id_personnel` 6 et 14, restes d'anonymisations de tests antérieurs) — nettoyées après vérification, aucun lien FK (`livraison`/`session_formation`/`commande`) ne les référençait. La base reflète maintenant exactement les 5 lignes du seed, plus un compte personnel réel de l'équipe (`id_personnel` 10, non touché).

---

## 2. RESERVATION — `personnel/reservations` (page unique, actions en ligne)

### 2.1 Ce qu'on doit VOIR

| État | Vérification |
|---|---|
| ✅ | 7 réservations au total, les 4 types représentés : Formation (1), Salle (2), Logement (2, dont l'hébergement lié), Table (2) |
| ⚠️ | Réservation Formation : le seed la crée `Confirmee`, mais elle est **déjà `Annulee`** dans cet environnement — annulée lors d'une passe d'inspection antérieure à cette fenêtre (cf. 2.2 ci-dessous, qui confirme que la restitution de places a bien eu lieu à ce moment-là). Pas une anomalie : la fiche affiche cohéremment son hébergement lié (id 7) également `Annulee`, mêmes dates — la propagation formation → hébergement (`docs/architecture.md`) fonctionne. |
| ✅ | Réservation Salle n°1 : `En_attente`, 40 personnes (avant mutation, voir 2.2) — **la cible s'affiche `Salle n° 1`, pas le nom du catalogue** : choix délibéré de `reservation.service.ts::libelleCible`, documenté dans son commentaire (éviter une requête par ligne, dette N+1 déjà connue) — le libellé du seed dans ce document supposait à tort un nom affiché, corrigé ici. |
| ✅ | Réservation Salle n°2 : `Annulee`, cible affichée `Salle n° 2` (même convention ci-dessus) |
| ✅ | Réservation Logement (entreprise A) : `En_attente` avant mutation (voir 2.2) |
| ✅ | Réservation Table n°1 (10 sept.) : `Confirmee` |
| ✅ | Réservation Table n°2 (6 sept.) : `Honoree` |
| ✅ | Réservation Logement liée à l'hébergement de la formation (id 7) : dates identiques à la session (23 sept.) — statut `Annulee` et non `Confirmee`, cohérent avec l'annulation de la formation constatée ci-dessus (propagation correcte, pas une valeur du seed) |
| ✅ | Le filtre Type et le filtre Statut existent tous les deux sur la page (présence confirmée ; combinaison non testée en détail) |

### 2.2 Ce qu'on doit pouvoir FAIRE

| État | Action |
|---|---|
| ✅ | Marquer « honorée » la réservation Salle `En_attente` (Salle n° 1) — passe bien à `Honoree`, bouton « Annuler » seul restant |
| ✅ | Annuler la réservation Logement `En_attente` (Hébergement n° 2) — passe bien à `Annulee`, boutons disparus |
| ✅ | La restitution de places lors de l'annulation Formation constatée en 2.1 est **confirmée en base** : `session_formation.places_restantes` vaut 12 alors que le seed l'initialisait à 10 — soit +2, exactement `nombre_personnes` de la réservation annulée, pas +1 forfaitaire |

### 2.3 Cas limites à tester

| État | Cas |
|---|---|
| ✅ | Sur la réservation `Annulee` (Salle n°2) : **aucun** bouton d'action n'apparaît (0 bouton constaté) |
| ✅ | Sur la réservation `Honoree` (Table n°2) : seul « Annuler » apparaît, pas « Marquer honorée » |
| ✅ | Marquer honorée une réservation déjà `Annulee` via un appel direct à l'API répond **409**, message repris tel quel : « Cette réservation est annulée : son statut ne peut plus changer. » |
| ❌→ℹ️ | **Rejouer exactement le même statut (`Annulee` → `Annulee`) répond 200, pas 409.** Vérifié en rejouant l'annulation sur la réservation Salle n°2, déjà `Annulee` : succès silencieux, aucun changement d'état. Ce n'est **pas un défaut** — `ReservationService.changer_statut()` court-circuite délibérément quand `statut is reservation.statut` avant même de vérifier si la réservation est terminale, précisément pour que rejouer l'action ne crédite pas les places deux fois (idempotence documentée dans sa propre docstring). Le 409 ne se déclenche que pour une transition vers une **valeur différente** sur une réservation déjà `Annulee` (cas testé juste au-dessus, confirmé 409). La formulation initiale de ce point supposait à tort un refus systématique — corrigée ici. |

---

## 3. COMMANDE (+ LIVRAISON) — `personnel/commandes/administration` (liste) + `.../:id` (fiche)

### 3.1 Ce qu'on doit VOIR

| État | Vérification |
|---|---|
| ☐ | 7 commandes, les 6 statuts représentés : `En_attente` (×2 : une client, une invité), `Confirmee`, `En_preparation`, `Livree`, `Annulee`, `Servie` |
| ☐ | Montants cohérents : En_attente 10,50 ; Confirmee 25,00 ; En_preparation 5,00 ; Livree 7,00 ; Annulee 12,00 ; invitée 5,00 ; sur place 7,00 (2× éclair) |
| ☐ | La commande invitée affiche bien le nom « Bob Martin », pas de client rattaché |
| ☐ | La commande `Servie` affiche le vendeur : saisie par la réceptionniste (Randrianasolo Fara), liée à la réservation Table `Confirmee` |
| ☐ | Le filtre par statut réduit correctement la liste (côté client) |
| ☐ | Les liens « Voir les abonnements » et « Voir les réservations » en haut de la liste mènent bien aux bons écrans |
| ☐ | Sur la fiche de la commande `Confirmee` : le récapitulatif affiche 1 gâteau d'anniversaire à 25,00 |

### 3.2 Ce qu'on doit pouvoir FAIRE

| État | Action |
|---|---|
| ☐ | Annuler une commande `En_attente` ou `En_preparation` depuis sa fiche |
| ☐ | Relancer la livraison de la commande invitée (seule commande avec une livraison `Echouee`) |
| ☐ | Marquer remboursée n'importe quelle commande, y compris une jamais payée (ex. la commande `En_attente` sans paiement associé) |
| ☐ | Après relance, vérifier que la livraison repasse à `En_attente` et que le bouton « Relancer » disparaît de la fiche |

### 3.3 Cas limites à tester

| État | Cas |
|---|---|
| ☐ | Sur la commande `Livree` ou `Servie` : le bouton « Annuler » est **absent** (statut terminal) |
| ☐ | Sur la commande `Annulee` : le bouton « Annuler » est **absent** |
| ☐ | Sur les commandes sans livraison `Echouee` (5 des 7) : le bouton « Relancer la livraison » est **absent** — en particulier sur `commande_sur_place`, qui n'a aucune livraison du tout (pas d'adresse) |
| ☐ | « Marquer remboursée » reste toujours proposé, y compris après un « Annuler » — vérifier que le badge « (remboursée) » apparaît ensuite dans la liste |
| ☐ | Rejouer « Relancer la livraison » une deuxième fois sur la même commande (après qu'elle soit repassée `En_attente`) doit être refusé en 409 |
| ☐ | Tenter d'annuler une commande déjà `Annulee` par un appel direct (docs Swagger) doit répondre 409 |

---

## 4. ABONNEMENT (+ BENEFICIAIRE + CONSOMMATION_REPAS) — `personnel/abonnements` (liste) + `.../:id` (fiche)

### 4.1 Ce qu'on doit VOIR

| État | Vérification |
|---|---|
| ☐ | 2 abonnements : TechQA SARL (Forfait, Individuel) et LogiQA SA (Consommation réelle, Global) |
| ☐ | Fiche TechQA : montant facturé = tarif forfait (1 500 000,00), période commencée il y a 30 jours |
| ☐ | Fiche TechQA : 2 bénéficiaires — Rakotoson Lova (badge QA-BADGE-001, Actif), Andrianarivo Njaka (badge QA-BADGE-002, Suspendu) |
| ☐ | Tableau de consommation TechQA : 2 lignes, toutes deux imputées à Rakotoson Lova (le bénéficiaire actif) |
| ☐ | Fiche LogiQA : **aucun bénéficiaire affiché** (mode Global), tableau de consommation avec 1 ligne, quantité 12, colonne bénéficiaire absente |
| ☐ | Solde LogiQA : calculé sur tarif unitaire (15 000,00) × repas consommés, pas de « repas restants » (pas de `nombre_repas_inclus` en mode Consommation_reelle) |

### 4.2 Ce qu'on doit pouvoir FAIRE

| État | Action |
|---|---|
| ☐ | Créer un nouvel abonnement pour une des deux entreprises, dates ne chevauchant pas l'existant |
| ☐ | Modifier un abonnement existant (ex. changer `nombre_repas_inclus` sur TechQA) |
| ☐ | Ajouter un bénéficiaire sur l'abonnement TechQA (bouton visible seulement parce que `mode_suivi = Individuel`) |
| ☐ | Archiver un abonnement (navigue automatiquement vers la liste après succès) |

### 4.3 Cas limites à tester

| État | Cas |
|---|---|
| ☐ | Sur la fiche LogiQA (`mode_suivi = Global`), le bouton « Ajouter un bénéficiaire » est **absent** |
| ☐ | **Aucun bouton « Restaurer »** n'existe nulle part sur cette section — vérifier qu'un abonnement archivé disparaît définitivement de la liste, sans recours dans l'UI |
| ☐ | Tenter de créer un abonnement sur TechQA avec des dates chevauchant l'existant doit être refusé en 409 (contrainte d'exclusion PostgreSQL) |
| ☐ | Tenter d'archiver un abonnement portant un bénéficiaire encore `Actif` — vérifier le message repris tel quel (« Cet abonnement couvre encore au moins un bénéficiaire actif ») s'il y a une garde à ce niveau, sinon noter que l'archivage passe silencieusement |
| ☐ | **Aucune action nulle part ne permet d'enregistrer une nouvelle consommation** — confirmer que `TableauConsommation` reste strictement en lecture, aucun bouton « Ajouter une consommation » n'existe |

---

## 5. PRODUIT / CATEGORIE_PRODUIT — `personnel/catalogue` + `personnel/categories`

### 5.1 Ce qu'on doit VOIR

| État | Vérification |
|---|---|
| ☐ | 4 produits : Éclair au chocolat (stock 15), Mille-feuille (stock **0**), Gâteau d'anniversaire (personnalisable, supplément 5,00), Pain de mie maison (non livrable) |
| ☐ | 2 catégories : « Pâtisserie QA », « Boulangerie QA », toutes deux `Active` |
| ☐ | Le lien « Voir les catégories » depuis le catalogue, et « Voir le catalogue » depuis les catégories, fonctionnent dans les deux sens |

### 5.2 Ce qu'on doit pouvoir FAIRE

| État | Action |
|---|---|
| ☐ | Créer un nouveau produit, le rattacher à une des deux catégories QA |
| ☐ | Modifier un produit existant (ex. changer le stock du Mille-feuille) |
| ☐ | Archiver puis restaurer un produit |
| ☐ | Créer une nouvelle catégorie |
| ☐ | Renommer une catégorie existante |
| ☐ | Archiver puis restaurer une catégorie |

### 5.3 Cas limites à tester

| État | Cas |
|---|---|
| ☐ | Le Mille-feuille (stock 0) reste visible et modifiable côté admin, même s'il n'est pas achetable côté client |
| ☐ | Tenter d'archiver une catégorie qui contient encore des produits actifs (Pâtisserie QA en a 3) — vérifier si un refus explicite apparaît ou si l'archivage est silencieusement accepté (comportement à documenter, pas juste à constater) |
| ☐ | Restaurer une catégorie dont le libellé a depuis été repris par une nouvelle catégorie active doit être refusé (index unique partiel) |
| ☐ | Créer un produit personnalisable **sans** renseigner de supplément doit être refusé en 422 |

---

## 6. Hors périmètre de cette inspection frontend

**Aucune interface d'administration n'existe** pour les modules suivants — le CRUD backend est complet et protégé, mais rien n'est cliquable dans le navigateur. À vérifier uniquement via `/docs` (Swagger, http://localhost:8000/docs) si tu veux les couvrir quand même ; sinon, marquer explicitement **hors périmètre** de cette passe d'inspection manuelle et ne pas chercher les écrans correspondants.

| État | Module |
|---|---|
| ☐ | **SALLE** — hors périmètre (aucun écran ; CRUD via `/docs` uniquement) |
| ☐ | **LOGEMENT** — hors périmètre (aucun écran ; CRUD via `/docs` uniquement) |
| ☐ | **FORMATION** (+ DOMAINE_FORMATION + SESSION_FORMATION) — hors périmètre (aucun écran ; CRUD via `/docs` uniquement) |
| ☐ | **PAIEMENT** — hors périmètre côté admin (le seul écran, `FormulairePaiement`, vit côté client sur l'historique de commandes — à tester séparément dans un parcours client, pas dans cette inspection admin) |
| ☐ | **AVIS** — hors périmètre côté admin (dépôt uniquement côté client, aucune modération) |

---

## 7. Test de séparation des droits — à faire en dernier

| État | Étape |
|---|---|
| ☐ | Se déconnecter du compte admin |
| ☐ | Se connecter avec `receptionniste-qa@delta.mg` / `MotDePasseQA123!` (non-admin) |
| ☐ | Confirmer que la nav affiche **tous** les liens `personnel/*` (Prise de commande, Catalogue, Abonnements, Personnel, Réservations, Commandes) — la nav se base sur `useEstPersonnelConnecte()`, pas sur le droit admin, donc **aucun lien n'est masqué** à ce niveau |
| ☐ | Cliquer sur « Prise de commande » (`personnel/commandes`) : doit s'afficher normalement — seul endpoint qui n'exige que `PersonnelConnecte` |
| ☐ | Cliquer sur « Catalogue » (`personnel/catalogue`) : la page se charge (lecture publique de `GET /produits`), mais tenter de créer/modifier/archiver un produit doit échouer en **403**, message affiché à l'écran |
| ☐ | Cliquer sur « Personnel » (`personnel/administration`) : vérifier si la lecture de la liste elle-même échoue en 403 (l'endpoint `GET /personnel` exige `PersonnelConnecte` seulement d'après le routeur — donc la liste devrait s'afficher) mais toute action d'écriture (créer/modifier/archiver/anonymiser) doit échouer en 403 |
| ☐ | Cliquer sur « Abonnements », « Réservations », « Commandes » : la lecture (`GET .../administration`) exige `PersonnelAdministrateur` — vérifier que ces trois écrans échouent dès le **chargement de la liste**, pas seulement sur les actions, et que le message d'erreur affiché reste lisible (pas une page blanche ni une trace technique) |
| ☐ | Confirmer qu'aucune des tentatives refusées en 403 ne déconnecte la session (contrairement à un 401) — la réceptionniste doit rester connectée après chaque refus |

---

## 8. Améliorations UX mineures relevées — pas urgent, pas bloquant

Constats faits en dehors de cette checklist (pendant la vérification empirique
du chantier « photo de profil »), consignés ici plutôt que perdus. Aucun n'est
un défaut fonctionnel — le comportement observé reste correct — seulement une
petite redondance d'affichage à nettoyer un jour.

| État | Constat |
|---|---|
| ⚠️ | `PersonnelDetailAdministrationPage.tsx` affiche son propre message d'erreur (`erreurAction`) **et** le repasse en prop `erreur` à `FormulairePersonnel`, qui l'affiche aussi — tout refus lors d'une modification (texte ou photo) s'affiche donc **deux fois** dans le DOM. Constaté à l'étape « rejet d'un fichier photo invalide » de la vérification du chantier photo, mais le doublon est **préexistant** au chantier photo et concerne toute erreur de modification. Correctif suggéré : ne garder qu'un seul point d'affichage (probablement celui de `FormulairePersonnel`, déjà cohérent avec la création). |
