# Delta — Roadmap agile (sprints à taille variable)

Ordre de priorisation : dépendances techniques d'abord, puis cœur transactionnel,
puis modules métier du plus généraliste au plus spécifique, paiement en ligne et
back-office avancé en dernier.

**Sprint courant : Sprint 0.** Mettre à jour cette ligne à chaque changement de sprint.

Avant de commencer une tâche : vérifier la Definition of Ready dans `CONTRIBUTING.md`.
Avant de clore une tâche : vérifier la Definition of Done dans `CONTRIBUTING.md`.

---

## Sprint 0 — Fondations techniques

- [ ] Structure du repo backend (FastAPI) : `routers/` / `services/` / `repositories/` / `models/` / `schemas/`
- [ ] Connexion PostgreSQL + modèles SQLAlchemy à partir des 20 tables du MLD (`docs/mld.md`)
- [ ] `base_repository.py` générique (CRUD de base)
- [ ] Initialisation Alembic + migration de base (schéma complet)
- [ ] Configuration environnement (`.env`, `pydantic-settings`)
- [ ] Authentification JWT (inscription/connexion `CLIENT_PARTICULIER`)
- [ ] Structure du repo frontend (React + Vite + Tailwind)
- [ ] Client Axios centralisé (base URL, intercepteur token, gestion erreurs)
- [ ] Squelette de layout (navigation, pages vides)

## Sprint 1 — Comptes clients & catalogue produits

- [ ] CRUD `CATEGORIE_PRODUIT`, `PRODUIT` (admin)
- [ ] Inscription/connexion `CLIENT_ENTREPRISE` (distinct du particulier)
- [ ] Catalogue public : liste + fiche produit (React)
- [ ] Recherche / filtre par catégorie

## Sprint 2 — Commande & panier (cœur transactionnel)

- [ ] Création `COMMANDE` + `LIGNE_COMMANDE`, calcul `montant_total`
- [ ] Parcours commande invité (sans compte) vs connecté
- [ ] Panier + tunnel de commande (React)
- [ ] Historique des commandes du client

## Sprint 3 — Personnel, personnalisation & livraison

- [ ] `PERSONNEL` : CRUD générique **complet** (toutes fonctions : Formateur, Livreur,
      Cuisinier, Réceptionniste) — **à traiter en premier dans ce sprint**, car
      `SESSION_FORMATION` (sprint 4) en dépend
- [ ] `DEMANDE_PERSONNALISATION` rattachée à une ligne de commande
- [ ] `LIVRAISON` : création automatique si commande livrable, affectation livreur
- [ ] Suivi de statut livraison côté client

## Sprint 4 — Formation

- [ ] CRUD `DOMAINE_FORMATION`, `FORMATION`, `SESSION_FORMATION` (admin)
- [ ] `RESERVATION` type = Formation, décrément `places_restantes`
- [ ] Option hébergement liée à une réservation formation
- [ ] Catalogue et réservation formation (React)

## Sprint 5 — Salle & logement

- [ ] CRUD `SALLE`, `LOGEMENT` (admin)
- [ ] `RESERVATION` type = Salle / Logement + vérification de chevauchement de dates
- [ ] Interface de réservation (React)

## Sprint 6 — Restauration sur place

- [ ] `RESERVATION` type = Table
- [ ] Lien `RESERVATION → COMMANDE` (le client réserve, puis commande sur place)
- [ ] Interface simplifiée côté personnel pour prise de commande sur place

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

---

## Traçabilité MLD → sprints (à retenir)

Chaque table du MLD doit être couverte par au moins un sprint avant qu'on considère
la roadmap close. Toute table ajoutée au MLD après coup doit immédiatement être
ajoutée à un sprint ici — ne jamais laisser une table orpheline.
