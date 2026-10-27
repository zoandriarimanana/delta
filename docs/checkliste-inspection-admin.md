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

**Note d'environnement (avant de lire les cases ci-dessous)** : l'inspection de cette
section a lieu après les chantiers photo/badge personnel et après la section 2
(RESERVATION). Vérifié explicitement qu'aucun personnel de test créé/supprimé
pendant ces chantiers n'a laissé de trace dans `commande`/`livraison`/`paiement`
(comptage des FK à zéro avant chaque suppression, tout au long de ces chantiers).
En revanche, l'état des commandes a **dérivé** par rapport au seed d'origine, par
un usage réel de l'écran (pas une pollution technique) : la commande #2, seed en
`Confirmee`, est maintenant `Annulee` et remboursée ; une 8ᵉ commande (#8, invité
« Andry », 1 000,00 Ar, 10× « Mofo Gasy ») a été créée après le seed — ce
5ᵉ produit n'existait pas non plus au seed initial. Les cases ci-dessous reflètent
l'état **actuel** de l'environnement, pas les valeurs d'origine.

### 3.1 Ce qu'on doit VOIR

| État | Vérification |
|---|---|
| ✅ | 8 commandes (7 au seed + 1 créée depuis) ; statuts représentés : `En_attente` (×3), `Annulee` (×2, dont une remboursée), `En_preparation`, `Livree`, `Servie` — `Confirmee` n'est plus représenté, la commande qui le portait (#2) a été annulée depuis le seed |
| ⚠️ | Montants : #1 En_attente 10,50 ✓, #2 **Annulee (remboursée)** 25,00 (portait `Confirmee` au seed), #3 En_preparation 5,00 ✓, #4 Livree 7,00 ✓, #5 Annulee 12,00 ✓, #6 En_attente (invitée) 5,00 ✓, #7 Servie (sur place) 7,00 ✓, #8 En_attente 1 000,00 (nouvelle, hors seed) |
| ❌ | **La commande invitée n'affiche « Bob Martin » nulle part** — ni dans la liste, ni sur la fiche (`CommandeDetailAdministrationPage.tsx`). Vérifié dans le code : `nom_invite`/`contact_invite` sont bien exposés par `CommandeRead` (backend) et typés côté frontend (`commande.types.ts`), mais **aucun composant ne les affiche** sur cet écran admin. Un administrateur consultant une commande invitée ne peut donc pas savoir pour qui elle a été passée, ni comment la contacter, sans passer par `/docs`. |
| ❌→ℹ️ | **La commande `Servie` n'affiche aucun vendeur.** Pas un oubli d'affichage cette fois : `CommandeRead` (backend, `app/schemas/commande.py`) **n'expose pas `id_personnel` du tout** — la donnée n'atteint jamais le frontend. Case reformulée : l'attente initiale (« affiche le vendeur ») ne correspond à aucun contrat d'API existant. |
| ✅ | Le filtre par statut existe et réduit la liste (côté client) |
| ✅ | Les liens « Voir les abonnements » et « Voir les réservations » sont présents en haut de la liste |
| ⚠️ | Le récapitulatif « 1 gâteau d'anniversaire × 25,00 » est toujours visible sur la fiche de la commande #2 — mais celle-ci est maintenant `Annulee`, plus `Confirmee` (cf. note d'environnement). Le contenu de la ligne, lui, n'a pas bougé. |

### 3.2 Ce qu'on doit pouvoir FAIRE

| État | Action |
|---|---|
| ✅ | Annuler une commande `En_preparation` (#3) depuis sa fiche — passe à `Annulee`, seul « Marquer remboursée » reste |
| ✅ | Relancer la livraison de la commande invitée (#6, seule livraison `Echouee`) — passe à `En_attente`, bouton « Relancer » disparaît de la fiche |
| ✅ | Marquer remboursée une commande jamais payée (#1, `En_attente`, aucun `PAIEMENT` associé) — acceptée sans condition, horodatage affiché (« Remboursée le … ») |

### 3.3 Cas limites à tester

| État | Cas |
|---|---|
| ✅ | Sur la commande `Servie` (#7) : le bouton « Annuler » est **absent** |
| ✅ | Sur la commande `Annulee` (#3, #5) : le bouton « Annuler » est **absent**, seul « Marquer remboursée » reste |
| ✅ | Sur une commande sans livraison `Echouee` : le bouton « Relancer la livraison » est **absent** — confirmé sur #7 (`Sur_place`, aucune livraison du tout, pas d'adresse) |
| ✅ | « Marquer remboursée » reste toujours proposé, y compris sur une commande déjà annulée — badge « (remboursée) » confirmé dans la liste après coup |
| ✅ | Rejouer « Relancer la livraison » une deuxième fois (après repassage à `En_attente`) est refusé en 409, message repris tel quel : « Cette livraison est « En_attente » : seule une livraison échouée peut être relancée. » |
| ✅ | Annuler une commande déjà `Annulee` via un appel direct à l'API répond 409 : « Cette commande est déjà annulée. » |

---

## 4. ABONNEMENT (+ BENEFICIAIRE + CONSOMMATION_REPAS) — `personnel/abonnements` (liste) + `.../:id` (fiche)

**Note d'environnement** : données `ABONNEMENT`/`BENEFICIAIRE`/`CONSOMMATION_REPAS`
identiques au seed d'origine au moment de commencer cette section — aucune dérive
constatée (contrairement aux sections 2 et 3). `nombre_repas_inclus` de TechQA a
été porté à 250 pendant la vérification du point 4.2 (« Repas restants » = 248
depuis, pas 198) ; documenté ici pour la même raison que les sections précédentes.

### 4.1 Ce qu'on doit VOIR

| État | Vérification |
|---|---|
| ✅ | 2 abonnements : TechQA SARL (Forfait, Individuel) et LogiQA SA (Consommation réelle, Global) |
| ✅ | Fiche TechQA : montant facturé = tarif forfait (1 500 000,00) |
| ❌ | **Aucun des deux bénéficiaires de TechQA n'est affiché en tant que tel** — ni badge, ni statut, nulle part sur la fiche. Vérifié dans le code (`AbonnementDetailAdministrationPage.tsx`) : `beneficiaires` n'est passé qu'à `TableauConsommation`, pour résoudre un nom en face d'une ligne de consommation existante — il n'existe **aucune liste de bénéficiaires** sur cette fiche, ni ailleurs dans l'app (aucune page `beneficiaires` n'existe). Conséquence directe, testée empiriquement : un bénéficiaire **sans aucune consommation enregistrée** (Andrianarivo Njaka, `Suspendu`) est **totalement invisible** sur cet écran — son nom n'apparaît dans aucune requête réseau visible côté admin. Voir aussi 4.2, où ce même problème rend un ajout de bénéficiaire indétectable après coup. |
| ✅ | Tableau de consommation TechQA : 2 lignes, toutes deux imputées à « Lova Rakotoson » (prénom nom, pas nom prénom — ordre d'affichage différent du seed, sans conséquence) |
| ✅ | Fiche LogiQA : aucune colonne bénéficiaire dans le tableau de consommation (mode Global), 1 ligne, quantité 12 |
| ✅ | Solde LogiQA affiché : 180 000,00 = 15 000,00 × 12 (tarif unitaire × consommé) ; aucune ligne « Repas restants » (propre à TechQA, `Forfait`) |

### 4.2 Ce qu'on doit pouvoir FAIRE

| État | Action |
|---|---|
| ✅ | Modifier un abonnement existant : `nombre_repas_inclus` de TechQA porté de 200 à 250, « Repas restants » recalculé à 248 (250 − 2 déjà consommés) |
| ❌ | **Ajouter un bénéficiaire sur TechQA « réussit » côté serveur (201, confirmé en base) mais reste invisible sur l'écran qui vient de le créer** — aucune confirmation visuelle, aucune trace dans la liste ni le tableau de consommation. Un administrateur qui vient d'ajouter un badge n'a aucun moyen de vérifier depuis cet écran que l'opération a réellement eu lieu. Conséquence directe du constat 4.1 : c'est la même absence de liste de bénéficiaires, pas un second défaut distinct. |
| ⚠️ | « Créer un nouvel abonnement » : non testé avec des dates valides sur cette passe (le seul test réalisé porte volontairement sur un chevauchement, cf. 4.3, pour ne pas laisser un troisième abonnement de test dans l'environnement partagé) |
| ⚠️ | « Archiver un abonnement » : non testé directement sur TechQA/LogiQA — **irréversible et sans bouton Restaurer** (cf. 4.3), le risque de perdre des données de seed de référence n'était pas justifié pour cette case. Testé à la place sur un abonnement jetable créé puis détruit pour l'occasion (cf. 4.3, cas du bénéficiaire actif) — le chemin d'archivage lui-même fonctionne (409 avec garde, pas un succès silencieux), donc cette action est indirectement confirmée. |

### 4.3 Cas limites à tester

| État | Cas |
|---|---|
| ✅ | Sur la fiche LogiQA (`mode_suivi = Global`), le bouton « Ajouter un bénéficiaire » est absent |
| ✅ | Aucun bouton « Restaurer » nulle part sur cette section — confirmé à la fois par une recherche dans toute la page et par le code (`AdministrationAbonnementsPage.tsx` documente explicitement l'absence, `GET /abonnements/administration` ne renvoie que les actifs) |
| ✅ | Créer un abonnement sur TechQA avec des dates chevauchant l'existant (2026-09-01 → 2027-01-01, chevauche 2026-08-10 → 2027-08-10) est refusé, message repris tel quel : « Cette entreprise a déjà un abonnement actif sur cette période. » |
| ✅ | Archiver un abonnement portant un bénéficiaire encore `Actif` est refusé en 409, message repris tel quel : « Cet abonnement couvre encore au moins un bénéficiaire actif : il ne peut pas être archivé. » — testé sur un abonnement jetable (créé puis détruit après coup), pas sur TechQA, justement à cause de l'irréversibilité notée ci-dessus |
| ✅ | Aucune action nulle part ne permet d'enregistrer une nouvelle consommation — confirmé dans le code, `TableauConsommation.tsx` ne porte aucun bouton |

---

## 5. PRODUIT / CATEGORIE_PRODUIT — `personnel/catalogue` + `personnel/categories`

**Note d'environnement** : 5 produits actifs au moment de cette section, pas 4
— `Mofo Gasy` (100,00 Ar, catégorie Pâtisserie QA) existe depuis la section 3
(créé par un test réel de commande invitée, cf. sa note d'environnement), pas
par cette section. Les cases ci-dessous en tiennent compte.

### 5.1 Ce qu'on doit VOIR

| État | Vérification |
|---|---|
| ⚠️ | 5 produits actifs, pas 4 (cf. note ci-dessus) : Éclair au chocolat (stock 15), Mille-feuille (stock **0** au départ de cette section, modifié à 3 en 5.2), Gâteau d'anniversaire (personnalisable, supplément 5,00), Pain de mie maison (non livrable), Mofo Gasy (hors seed initial) |
| ✅ | 2 catégories : « Pâtisserie QA », « Boulangerie QA », toutes deux actives |
| ✅ | Les liens croisés existent et fonctionnent dans les deux sens — libellés réels : « Gérer les catégories » (catalogue → catégories) et « Retour au catalogue » (catégories → catalogue), pas les libellés supposés initialement |

### 5.2 Ce qu'on doit pouvoir FAIRE

| État | Action |
|---|---|
| ✅ | Créer un nouveau produit, rattaché à Boulangerie QA — apparaît immédiatement dans le catalogue |
| ✅ | Modifier un produit existant — stock du Mille-feuille changé de 0 à 3 |
| ✅ | Archiver puis restaurer un produit — disparaît de la liste active, apparaît dans « Afficher les archives », redevient actif après restauration (testé sur le produit créé pour l'occasion, supprimé après coup) |
| ✅ | Créer une nouvelle catégorie — confirmé via la création de deux catégories jetables en 5.3 (201 les deux fois) |
| ✅ | Renommer une catégorie existante — `PUT /categories-produit/{id}` répond 200 (testé en renommant Boulangerie QA vers son propre libellé, sans conséquence visible) |
| ✅ | Archiver puis restaurer une catégorie — confirmé sur une catégorie jetable (204 à l'archivage), la restauration elle-même est couverte par le cas limite ci-dessous (refusée uniquement parce que le libellé a été repris entre-temps — sur un cas sans conflit, le même endpoint réussit) |

### 5.3 Cas limites à tester

| État | Cas |
|---|---|
| ✅ | Le Mille-feuille reste visible et modifiable côté admin quel que soit son stock (vérifié avec 0, puis avec 3 après la modification de 5.2) |
| ✅ | Archiver une catégorie qui contient encore des produits actifs (Pâtisserie QA, 4 produits actifs désormais — cf. note d'environnement) est **refusé explicitement**, pas silencieux : 409, message repris tel quel « Cette catégorie contient encore des produits. » |
| ✅ | Restaurer une catégorie dont le libellé a été repris par une nouvelle catégorie active est refusé en 409, message repris tel quel : « Une catégorie active porte déjà ce libellé, restauration impossible. » — testé sur une catégorie jetable créée puis archivée puis recréée avec le même libellé, plutôt que sur Pâtisserie QA/Boulangerie QA |
| ✅ | Créer un produit personnalisable sans supplément est refusé — **à deux niveaux** : le bouton « Créer » du formulaire reste désactivé tant que le supplément est vide (`tarifManquant` dans `FormulaireProduit.tsx`, jamais soumis), et un appel direct à l'API contournant ce garde-fou confirme le 422 côté serveur : « Un produit personnalisable doit porter un supplement_personnalisation. » |

---

## 6. Hors périmètre de cette inspection frontend

**Aucune interface d'administration n'existe** pour les modules suivants — le CRUD backend est complet et protégé, mais rien n'est cliquable dans le navigateur. À vérifier uniquement via `/docs` (Swagger, http://localhost:8000/docs) si tu veux les couvrir quand même ; sinon, marquer explicitement **hors périmètre** de cette passe d'inspection manuelle et ne pas chercher les écrans correspondants.

**Reconfirmé** (`src/App.tsx`, liste exhaustive des routes) : les seules routes
`personnel/*` existant dans l'application sont `connexion`, `commandes` (prise de
commande), `catalogue`, `categories`, `abonnements` (+fiche), `administration`
(personnel, +fiche), `reservations`, `commandes/administration` (+fiche) — la
même liste qu'à l'inventaire d'origine. Aucune route `personnel/salles`,
`personnel/logements`, `personnel/formations`, `personnel/paiements` ni
`personnel/avis` n'a été ajoutée depuis (chantiers photo/badge inclus, qui ne
touchent que `PERSONNEL`).

| État | Module |
|---|---|
| ✅ | **SALLE** — toujours hors périmètre, aucune route ajoutée |
| ✅ | **LOGEMENT** — toujours hors périmètre, aucune route ajoutée |
| ✅ | **FORMATION** (+ DOMAINE_FORMATION + SESSION_FORMATION) — toujours hors périmètre, aucune route ajoutée |
| ✅ | **PAIEMENT** — toujours hors périmètre côté admin, aucune route ajoutée |
| ✅ | **AVIS** — toujours hors périmètre côté admin, aucune route ajoutée |

---

## 7. Test de séparation des droits — à faire en dernier

**Le test le plus sensible de toute l'inspection** — vérifié de bout en bout via
un vrai navigateur (Playwright), requêtes réseau et contenu de page capturés à
chaque étape, pas seulement des captures d'écran. Une correction d'hypothèse
importante ressort du point 4 ci-dessous — lire sa note avant de considérer ce
point comme acquis pour une future passe.

| État | Étape |
|---|---|
| ✅ | Connexion `receptionniste-qa@delta.mg` / `MotDePasseQA123!` réussie (bouton « Déconnexion » visible juste après) |
| ✅ | La nav affiche **tous** les liens `personnel/*` : Prise de commande, Catalogue, Abonnements, Personnel, Réservations, Commandes — aucun n'est masqué, confirmé un par un |
| ✅ | « Prise de commande » (`personnel/commandes`) s'affiche normalement, aucune alerte — seul écran n'exigeant que `PersonnelConnecte` |
| ❌→ℹ️ | **« Catalogue » et « Catégories » échouent dès le chargement de la liste, pas seulement à l'écriture** — l'hypothèse initiale de ce point (« lecture publique de `GET /produits` ») était fausse. `AdministrationProduitsPage`/`AdministrationCategoriesPage` appellent en réalité `GET /produits/administration` et `GET /categories-produit/administration`, tous deux réservés `PersonnelAdministrateur` (confirmé dans `produit_router.py`) — parce que ces vues doivent aussi montrer les archives, contrairement au catalogue public consulté par un client. Vérifié par les requêtes réseau réelles : les deux appels répondent 403 **au chargement**, avant toute tentative d'écriture. Le message reste malgré tout lisible et uniforme (« Cette action est réservée aux administrateurs. »), le tableau retombe proprement sur « Aucun produit à afficher. »/« Aucune catégorie à afficher. » plutôt qu'une page cassée — donc le comportement observé est correct, seule la description initiale du chemin de lecture était erronée. |
| ✅ | « Personnel » (`personnel/administration`) : la liste se charge normalement (`GET /personnel` → 200, `PersonnelConnecte` suffit, confirmé par la requête réseau) ; tenter d'archiver un membre échoue en 403, message « Cette action est réservée aux administrateurs. » |
| ✅ | « Abonnements », « Réservations », « Commandes » échouent bien dès le chargement de la liste (confirmé par les requêtes réseau : `GET .../administration` → 403 sur les trois, avant tout rendu de données) ; message identique et lisible sur les trois écrans, tableau vide affiché proprement (« Aucun(e) … à afficher »), aucune page blanche ni trace technique |
| ✅ | Aucune des tentatives refusées en 403 ne déconnecte la session — confirmé de deux façons : le bouton « Déconnexion » reste visible après chaque refus (7 écrans testés), et un appel direct à `GET /auth/moi` **après tous les refus** répond toujours 200 avec `{"type":"personnel"}`, la session n'a jamais été invalidée |

---

## 8. Améliorations UX mineures relevées — pas urgent, pas bloquant

Constats faits en dehors de cette checklist (pendant la vérification empirique
du chantier « photo de profil »), consignés ici plutôt que perdus. Aucun n'est
un défaut fonctionnel — le comportement observé reste correct — seulement une
petite redondance d'affichage à nettoyer un jour.

| État | Constat |
|---|---|
| ⚠️ | `PersonnelDetailAdministrationPage.tsx` affiche son propre message d'erreur (`erreurAction`) **et** le repasse en prop `erreur` à `FormulairePersonnel`, qui l'affiche aussi — tout refus lors d'une modification (texte ou photo) s'affiche donc **deux fois** dans le DOM. Constaté à l'étape « rejet d'un fichier photo invalide » de la vérification du chantier photo, mais le doublon est **préexistant** au chantier photo et concerne toute erreur de modification. Correctif suggéré : ne garder qu'un seul point d'affichage (probablement celui de `FormulairePersonnel`, déjà cohérent avec la création). |
