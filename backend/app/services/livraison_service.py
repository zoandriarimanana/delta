"""Service métier de LIVRAISON.

Trois invariants portés ici, qu'aucune contrainte de base ne garantit : le
personnel affecté est un livreur, une livraison terminée ne bouge plus, et une
livraison remise fait avancer sa commande.

Ce dernier traverse deux entités : la règle est écrite une fois dans
`docs/architecture.md`, section « Synchronisation LIVRAISON → COMMANDE ».
"""

from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflitMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.models.commande import STATUT_TERMINAL, Commande
from app.models.livraison import STATUTS_TERMINAUX, Livraison, StatutLivraison
from app.models.personnel import FonctionPersonnel
from app.repositories.livraison_repository import LivraisonRepository
from app.repositories.personnel_repository import PersonnelRepository


class LivraisonService:
    """Cycle de vie d'une livraison : création, affectation, statut."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.livraisons = LivraisonRepository(db)
        self.personnels = PersonnelRepository(db)

    # --- Création -------------------------------------------------------------

    def creer_pour_commande(self, commande: Commande) -> Livraison | None:
        """Crée la livraison d'une commande, si elle en demande une.

        Retourne `None` quand `adresse_livraison` est absente : la commande est
        à retirer, il n'y a rien à livrer. L'appelant n'a pas à tester le cas.

        **Ne commite pas.** L'appel vient de `CommandeService._creer`, qui écrit
        commande, lignes, personnalisations et livraison dans une seule
        transaction : une livraison ne doit pas survivre à une commande qui a
        échoué.

        La livraison naît sans livreur et sans date de tournée — `NULL` signifie
        « pas encore affectée » et « pas encore planifiée ». Les deux viennent
        ensuite, par `affecter_livreur` et `planifier`.
        """
        if commande.adresse_livraison is None:
            return None

        return self.livraisons.create(
            {
                "id_commande": commande.id_commande,
                # Recopiée et non partagée : la livraison est un fait
                # logistique, la commande un fait commercial. Corriger une
                # adresse de tournée ne doit pas réécrire la commande.
                "adresse_livraison": commande.adresse_livraison,
                "statut": StatutLivraison.EN_ATTENTE,
            }
        )

    # --- Lecture --------------------------------------------------------------

    def obtenir(self, id_livraison: int) -> Livraison:
        """Retourne une livraison, ou lève `RessourceIntrouvable` (404)."""
        livraison = self.livraisons.get_by_id(id_livraison)
        if livraison is None:
            raise RessourceIntrouvable("Livraison introuvable.")
        return livraison

    def obtenir_par_commande(self, id_commande: int) -> Livraison:
        """Retourne la livraison d'une commande, ou 404.

        404 et non « None » : l'appelant désigne une ressource par l'URL, et une
        commande sans livraison n'en a pas à montrer.
        """
        livraison = self.livraisons.get_by_commande(id_commande)
        if livraison is None:
            raise RessourceIntrouvable("Cette commande n'a pas de livraison.")
        return livraison

    def lister(self, statut: StatutLivraison | None = None) -> Sequence[Livraison]:
        """Liste les livraisons, filtrées par statut si demandé."""
        return self.livraisons.lister_par_statut(statut)

    # --- Affectation ----------------------------------------------------------

    def affecter_livreur(self, id_livraison: int, id_personnel: int) -> Livraison:
        """Affecte un livreur à une livraison.

        **C'est ici que se joue la cohérence de fonction.**
        `LIVRAISON.#id_personnel` pointe vers `PERSONNEL` tout entier : rien en
        base n'empêche d'y mettre un cuisinier. La vérification ne peut pas être
        déléguée au schéma, elle est faite ici (cf. `docs/roadmap.md`, règle
        rappelée depuis le sprint 0).

        422 et non 404 : l'identifiant vient du corps de la requête, pas de
        l'URL. Un salarié archivé est traité comme inexistant — `get_by_id` le
        filtre —, sinon on affecterait une tournée à quelqu'un qui a quitté
        l'entreprise.

        Réaffecter est permis tant que la livraison n'est pas terminée : un
        livreur peut tomber malade.
        """
        livraison = self.obtenir(id_livraison)
        self._refuser_si_terminee(livraison, "affecter un livreur")

        personnel = self.personnels.get_by_id(id_personnel)
        if personnel is None:
            raise ReferenceInvalide(
                f"Aucun membre du personnel ne porte l'identifiant {id_personnel}."
            )
        if personnel.fonction is not FonctionPersonnel.LIVREUR:
            raise ReferenceInvalide(
                f"{personnel.prenom} {personnel.nom} exerce la fonction "
                f"« {personnel.fonction.value} » et ne peut pas être affecté "
                "à une livraison."
            )

        livraison.id_personnel = personnel.id_personnel
        self.db.commit()
        return livraison

    def planifier(self, id_livraison: int, date_heure_prevue: datetime) -> Livraison:
        """Pose la date de tournée prévue."""
        livraison = self.obtenir(id_livraison)
        self._refuser_si_terminee(livraison, "planifier la tournée")

        livraison.date_heure_prevue = date_heure_prevue
        self.db.commit()
        return livraison

    # --- Statut ---------------------------------------------------------------

    def changer_statut(self, id_livraison: int, statut: StatutLivraison) -> Livraison:
        """Fait avancer le statut d'une livraison.

        Deux règles, toutes deux hors de portée d'un `CHECK` puisqu'elles
        croisent plusieurs colonnes ou l'état antérieur :

        - une livraison **terminée ne bouge plus**. Rouvrir une tournée livrée
          effacerait la trace de ce qui s'est passé ;
        - passer à `En_cours` suppose un livreur affecté — personne ne part en
          tournée sans être désigné.

        `date_heure_reelle` est posée par le serveur au passage à `Livree`, et
        jamais reçue de la requête : c'est l'horloge du serveur qui fait foi,
        même raisonnement que `COMMANDE.date_commande`. Elle reste `NULL` sur un
        échec ou une annulation — il n'y a pas eu de remise.

        Le passage à `Livree` **propage sur la commande**, dans la même
        transaction. Aucun autre statut ne propage : voir
        `_propager_sur_la_commande`.
        """
        livraison = self.obtenir(id_livraison)
        self._refuser_si_terminee(livraison, "changer le statut")

        if statut is StatutLivraison.EN_COURS and livraison.id_personnel is None:
            raise ConflitMetier("Aucun livreur n'est affecté à cette livraison.")

        livraison.statut = statut
        if statut is StatutLivraison.LIVREE:
            livraison.date_heure_reelle = datetime.now(UTC)
            self._propager_sur_la_commande(livraison)
        self.db.commit()
        return livraison

    def _propager_sur_la_commande(self, livraison: Livraison) -> None:
        """Fait avancer `COMMANDE.statut` quand la livraison a été remise.

        **Synchronisation à sens unique, et à un seul déclencheur.** Une
        livraison remise fait avancer sa commande ; rien ne remonte jamais en
        sens inverse, et aucun autre statut de livraison ne propage.

        `Echouee` en particulier **ne touche pas** la commande. Un échec de
        tournée n'est pas une annulation : la marchandise a été préparée, le
        montant reste dû, et ce qu'il convient de faire — relancer, rembourser,
        annuler — est une décision humaine. Basculer automatiquement vers
        `Annulee` trancherait à la place de l'administrateur, et effacerait la
        distinction entre « n'a pas abouti » et « ne se fera pas ».

        Ces trois actions n'existent pas encore : c'est un **manque volontaire**,
        elles relèvent d'un module de gestion administrative des commandes qui
        n'est pas au périmètre du sprint 3. Ne rien faire ici, c'est ne pas
        casser la cohérence en l'attendant — pas la reporter.

        Le statut d'arrivée vient de `STATUT_TERMINAL`, la table posée avec le
        domaine de `COMMANDE` : `Servie` pour une commande sur place, `Livree`
        pour les deux autres types. La branche `Sur_place` est **inatteignable
        ici** — une commande sur place ne peut pas porter d'adresse de livraison,
        donc pas de livraison — mais on lit la table plutôt que d'écrire
        `Livree` en dur : la règle a déjà un seul endroit où vivre.
        """
        commande = livraison.commande
        commande.statut = STATUT_TERMINAL[commande.type_commande]

    def _refuser_si_terminee(self, livraison: Livraison, action: str) -> None:
        """Lève `ConflitMetier` (409) si la livraison est dans un état terminal.

        409 et non 422 : la charge utile est valide, c'est l'état de la
        ressource qui interdit l'opération.
        """
        if livraison.statut in STATUTS_TERMINAUX:
            raise ConflitMetier(
                f"Cette livraison est « {livraison.statut.value} » : "
                f"impossible de {action}."
            )

    # --- Archivage ------------------------------------------------------------

    def supprimer(self, id_livraison: int) -> None:
        """Archive une livraison.

        Aucune propagation : une livraison n'a pas d'enfant. Son archivage ne
        touche pas la commande, qui reste un fait commercial indépendant.
        """
        livraison = self.obtenir(id_livraison)
        self.livraisons.delete(livraison)
        self.db.commit()
