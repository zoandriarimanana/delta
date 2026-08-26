"""
Seed complet pour l'audit visuel : toutes les pages React avec cas limites.

Crée :
- 3 clients (particulier, entreprise, anonyme)
- Produits : stock nominal, rupture, personnalisable, non-livrable
- Salles : tarif horaire + journée, tarif horaire seul, tarif journée seul
- Logements : chaque statut (Disponible, En_maintenance, Hors_service)
- Formations : avec/sans hébergement
- Commandes : chaque statut, types divers
- Réservations : chaque type (Formation, Salle, Logement, Table)
- Livraisons : chaque statut, dont Echouee
"""

from decimal import Decimal
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import hacher_mot_de_passe
from app.models import (
    Client,
    ClientParticulier,
    ClientEntreprise,
    Personnel,
    CategorieProduit,
    Produit,
    Salle,
    Logement,
    DomaineFormation,
    Formation,
    SessionFormation,
    Commande,
    LigneCommande,
    DemandePersonnalisation,
    Reservation,
    Livraison,
)
from app.models.client import TypeClient
from app.models.personnel import FonctionPersonnel
from app.models.commande import TypeCommande, StatutCommande
from app.models.reservation import TypeReservation, StatutReservation
from app.models.logement import StatutLogement
from app.models.livraison import StatutLivraison
from app.models.session_formation import StatutSessionFormation


def _email_unique(prefix: str) -> str:
    """Adresse unique pour chaque utilisateur."""
    return f"{prefix}_{uuid4().hex[:6]}@example.mg"


def seed_audit():
    db = SessionLocal()
    try:
        # --- Clients ---
        client_particulier = Client(
            type_client=TypeClient.PARTICULIER,
            email=_email_unique("alice"),
            telephone="032 1234567",
            adresse="Rue de la Paix, Antananarivo",
            mot_de_passe=hacher_mot_de_passe("password123"),
        )
        db.add(client_particulier)
        db.flush()
        db.add(ClientParticulier(
            id_client=client_particulier.id_client,
            nom="Dupont",
            prenom="Alice",
            date_naissance=datetime(1990, 5, 15),
        ))

        client_entreprise = Client(
            type_client=TypeClient.ENTREPRISE,
            email=_email_unique("entreprise"),
            telephone="032 9876543",
            adresse="Lot 123 Andohalo, Antananarivo",
            mot_de_passe=hacher_mot_de_passe("password123"),
        )
        db.add(client_entreprise)
        db.flush()
        db.add(ClientEntreprise(
            id_client=client_entreprise.id_client,
            raison_sociale="Tech Innovations SARL",
            numero_id_fiscal="123456789012",
            secteur_activite="Informatique",
            nom_contact_referent="Bob Marchand",
        ))

        # --- Personnels ---
        formateur = Personnel(
            nom="Martin",
            prenom="Sylvain",
            fonction=FonctionPersonnel.FORMATEUR,
            est_administrateur=False,
            email=_email_unique("formateur"),
            telephone="032 5555555",
            date_embauche=datetime(2023, 1, 1),
            specialite="Pâtisserie avancée",
            mot_de_passe=hacher_mot_de_passe("password123"),
        )
        db.add(formateur)

        livreur = Personnel(
            nom="Rakoto",
            prenom="Jean",
            fonction=FonctionPersonnel.LIVREUR,
            est_administrateur=False,
            email=_email_unique("livreur"),
            telephone="032 6666666",
            date_embauche=datetime(2023, 6, 1),
            zone_livraison="Analamanga",
            mot_de_passe=hacher_mot_de_passe("password123"),
        )
        db.add(livreur)

        # --- Catégories & Produits ---
        cat_patisserie = CategorieProduit(libelle="Pâtisserie")
        cat_boulangerie = CategorieProduit(libelle="Boulangerie")
        db.add_all([cat_patisserie, cat_boulangerie])
        db.flush()

        # Stock nominal
        eclair = Produit(
            nom="Éclair au chocolat",
            description="Léger et gourmand",
            prix_unitaire=Decimal("3.50"),
            unite_mesure="pièce",
            stock_disponible=15,
            est_personnalisable=False,
            est_livrable=True,
            id_categorie=cat_patisserie.id_categorie,
        )
        # Rupture de stock
        mille_feuille = Produit(
            nom="Mille-feuille",
            description="Classique intemporel",
            prix_unitaire=Decimal("5.00"),
            unite_mesure="pièce",
            stock_disponible=0,
            est_personnalisable=False,
            est_livrable=True,
            id_categorie=cat_patisserie.id_categorie,
        )
        # Personnalisable
        gateau_anniversaire = Produit(
            nom="Gâteau d'anniversaire",
            description="Personnalisable à votre guise",
            prix_unitaire=Decimal("25.00"),
            unite_mesure="pièce",
            stock_disponible=8,
            est_personnalisable=True,
            supplement_personnalisation=Decimal("5.00"),
            est_livrable=True,
            id_categorie=cat_patisserie.id_categorie,
        )
        # Non-livrable
        pain_sur_commande = Produit(
            nom="Pain de mie maison",
            description="Retrait sur place uniquement",
            prix_unitaire=Decimal("2.50"),
            unite_mesure="pièce",
            stock_disponible=20,
            est_personnalisable=False,
            est_livrable=False,
            id_categorie=cat_boulangerie.id_categorie,
        )
        db.add_all([eclair, mille_feuille, gateau_anniversaire, pain_sur_commande])

        # --- Salles ---
        # Tarif horaire + journée
        salle_conference = Salle(
            nom="Salle de conférence",
            capacite=50,
            tarif_horaire=Decimal("150.00"),
            tarif_journee=Decimal("800.00"),
            equipements="Vidéoprojecteur, tableau blanc, climatisation",
        )
        # Tarif horaire seul
        salle_reunion = Salle(
            nom="Petite salle de réunion",
            capacite=10,
            tarif_horaire=Decimal("50.00"),
            tarif_journee=None,
            equipements="Table ronde, chaises",
        )
        # Tarif journée seul
        salle_evenement = Salle(
            nom="Grande salle événements",
            capacite=200,
            tarif_horaire=None,
            tarif_journee=Decimal("2000.00"),
            equipements="Scène, système audio, éclairage",
        )
        db.add_all([salle_conference, salle_reunion, salle_evenement])

        # --- Logements ---
        logement_disponible = Logement(
            type_chambre="Double",
            capacite=2,
            tarif_nuitee=Decimal("45.00"),
            statut=StatutLogement.DISPONIBLE,
        )
        logement_maintenance = Logement(
            type_chambre="Simple",
            capacite=1,
            tarif_nuitee=Decimal("25.00"),
            statut=StatutLogement.EN_MAINTENANCE,
        )
        logement_hors_service = Logement(
            type_chambre="Double",
            capacite=2,
            tarif_nuitee=Decimal("50.00"),
            statut=StatutLogement.HORS_SERVICE,
        )
        db.add_all([logement_disponible, logement_maintenance, logement_hors_service])

        # --- Formations ---
        domaine_pate = DomaineFormation(
            libelle="Pâtisserie",
            description="Techniques de base en pâtisserie",
        )
        db.add(domaine_pate)
        db.flush()

        formation_avec_hebergement = Formation(
            titre="Masterclass pâtisserie 3 jours",
            niveau="Avancé",
            duree_heures=12,
            prix=Decimal("300.00"),
            capacite_max=20,
            propose_hebergement=True,
            id_domaine=domaine_pate.id_domaine,
        )
        formation_sans_hebergement = Formation(
            titre="Atelier flash 2h",
            niveau="Débutant",
            duree_heures=2,
            prix=Decimal("45.00"),
            capacite_max=15,
            propose_hebergement=False,
            id_domaine=domaine_pate.id_domaine,
        )
        db.add_all([formation_avec_hebergement, formation_sans_hebergement])
        db.flush()

        now = datetime.now(timezone.utc)
        session_pleine = SessionFormation(
            date_debut=now + timedelta(days=7),
            date_fin=now + timedelta(days=10),
            places_restantes=0,  # Complète
            statut=StatutSessionFormation.OUVERTE,
            id_formation=formation_avec_hebergement.id_formation,
            id_formateur=formateur.id_personnel,
        )
        session_libre = SessionFormation(
            date_debut=now + timedelta(days=14),
            date_fin=now + timedelta(days=17),
            places_restantes=10,
            statut=StatutSessionFormation.OUVERTE,
            id_formation=formation_avec_hebergement.id_formation,
            id_formateur=formateur.id_personnel,
        )
        db.add_all([session_pleine, session_libre])

        db.flush()

        # --- Commandes (tous les statuts) ---
        commande_en_attente = Commande(
            date_commande=now,
            type_commande=TypeCommande.EN_LIGNE,
            statut=StatutCommande.EN_ATTENTE,
            montant_total=Decimal("10.50"),
            id_client=client_particulier.id_client,
            adresse_livraison="10 rue du Test, Antananarivo",
        )
        db.add(commande_en_attente)
        db.flush()
        db.add(LigneCommande(
            quantite=3,
            prix_unitaire_applique=Decimal("3.50"),
            id_commande=commande_en_attente.id_commande,
            id_produit=eclair.id_produit,
        ))

        commande_confirme = Commande(
            date_commande=now - timedelta(days=1),
            type_commande=TypeCommande.EN_LIGNE,
            statut=StatutCommande.CONFIRMEE,
            montant_total=Decimal("25.00"),
            id_client=client_particulier.id_client,
            adresse_livraison="10 rue du Test, Antananarivo",
        )
        db.add(commande_confirme)
        db.flush()
        db.add(LigneCommande(
            quantite=1,
            prix_unitaire_applique=Decimal("25.00"),
            id_commande=commande_confirme.id_commande,
            id_produit=gateau_anniversaire.id_produit,
        ))

        commande_livree = Commande(
            date_commande=now - timedelta(days=5),
            type_commande=TypeCommande.EN_LIGNE,
            statut=StatutCommande.LIVREE,
            montant_total=Decimal("7.00"),
            id_client=client_particulier.id_client,
            adresse_livraison="10 rue du Test, Antananarivo",
        )
        db.add(commande_livree)
        db.flush()
        db.add(LigneCommande(
            quantite=2,
            prix_unitaire_applique=Decimal("3.50"),
            id_commande=commande_livree.id_commande,
            id_produit=eclair.id_produit,
        ))

        commande_invitee = Commande(
            date_commande=now - timedelta(days=2),
            reference_publique=str(uuid4()),
            type_commande=TypeCommande.EN_LIGNE,
            statut=StatutCommande.EN_ATTENTE,
            montant_total=Decimal("5.00"),
            nom_invite="Bob Martin",
            contact_invite="bob@example.mg",
            adresse_livraison="20 rue Invité, Antananarivo",
        )
        db.add(commande_invitee)
        db.flush()
        db.add(LigneCommande(
            quantite=1,
            prix_unitaire_applique=Decimal("5.00"),
            id_commande=commande_invitee.id_commande,
            id_produit=eclair.id_produit,
        ))

        db.flush()

        # --- Livraisons (tous les statuts) ---
        livraison_en_attente = Livraison(
            adresse_livraison="10 rue du Test, Antananarivo",
            statut=StatutLivraison.EN_ATTENTE,
            id_commande=commande_en_attente.id_commande,
        )
        db.add(livraison_en_attente)

        livraison_livree = Livraison(
            adresse_livraison="10 rue du Test, Antananarivo",
            date_heure_prevue=now - timedelta(days=5, hours=2),
            date_heure_reelle=now - timedelta(days=5),
            statut=StatutLivraison.LIVREE,
            id_commande=commande_livree.id_commande,
            id_personnel=livreur.id_personnel,
        )
        db.add(livraison_livree)

        livraison_echouee = Livraison(
            adresse_livraison="20 rue Invité, Antananarivo",
            date_heure_prevue=now - timedelta(days=1, hours=14),
            date_heure_reelle=now - timedelta(days=1, hours=13),
            statut=StatutLivraison.ECHOUEE,
            id_commande=commande_invitee.id_commande,
            id_personnel=livreur.id_personnel,
        )
        db.add(livraison_echouee)

        # --- Réservations (tous les types) ---
        reservation_formation = Reservation(
            type_reservation=TypeReservation.FORMATION,
            date_debut=now + timedelta(days=14),
            date_fin=now + timedelta(days=17),
            nombre_personnes=2,
            statut=StatutReservation.CONFIRMEE,
            avec_hebergement=True,
            id_client=client_particulier.id_client,
            id_session=session_libre.id_session,
        )
        db.add(reservation_formation)

        reservation_salle = Reservation(
            type_reservation=TypeReservation.SALLE,
            date_debut=now + timedelta(days=30),
            date_fin=now + timedelta(days=31),
            nombre_personnes=40,
            statut=StatutReservation.EN_ATTENTE,
            id_client=client_particulier.id_client,
            id_salle=salle_conference.id_salle,
        )
        db.add(reservation_salle)

        reservation_logement = Reservation(
            type_reservation=TypeReservation.LOGEMENT,
            date_debut=now + timedelta(days=45),
            date_fin=now + timedelta(days=47),
            nombre_personnes=2,
            statut=StatutReservation.EN_ATTENTE,
            id_client=client_entreprise.id_client,
            id_logement=logement_disponible.id_logement,
        )
        db.add(reservation_logement)

        reservation_table = Reservation(
            type_reservation=TypeReservation.TABLE,
            date_debut=now + timedelta(days=7),
            date_fin=now + timedelta(days=7, hours=3),
            nombre_personnes=6,
            statut=StatutReservation.CONFIRMEE,
            id_client=client_particulier.id_client,
        )
        db.add(reservation_table)

        db.commit()
        print("✅ Seed audit visuel complété avec succès !")
        print(f"   - 2 clients (particulier + entreprise)")
        print(f"   - 4 produits (nominal, rupture, personnalisable, non-livrable)")
        print(f"   - 3 salles (tarifs variés)")
        print(f"   - 3 logements (chaque statut)")
        print(f"   - 2 formations + 2 sessions")
        print(f"   - 4 commandes (tous statuts)")
        print(f"   - 3 livraisons (incluant Echouee)")
        print(f"   - 4 réservations (tous types)")

    except Exception as e:
        db.rollback()
        print(f"❌ Erreur lors du seed : {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_audit()
