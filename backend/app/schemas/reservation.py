"""Schemas Pydantic de l'entité RESERVATION."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.reservation import StatutReservation, TypeReservation


class ReservationCreate(BaseModel):
    """Charge utile de création d'une réservation.

    Deux champs du modèle sont délibérément absents.

    `statut` naît toujours `En_attente` : c'est un cycle de vie, pas une donnée
    d'entrée — même règle que `COMMANDE.statut` et `SESSION_FORMATION.statut`.

    `id_client` est déduit du jeton, jamais du corps. L'accepter permettrait de
    réserver au nom d'autrui.
    """

    type_reservation: TypeReservation
    date_debut: datetime
    date_fin: datetime
    #: Chaque personne consomme une place de la session.
    nombre_personnes: int = Field(default=1, gt=0)
    #: Obligatoire pour une réservation de type `Formation` — voir le validateur.
    id_session: int | None = None
    #: **Drapeau informatif** : le client dit qu'il souhaite être hébergé.
    #: Aucune chambre n'est réservée ni même vérifiée disponible — ce mécanisme
    #: n'existe pas encore, il arrive au sprint 5 avec `LOGEMENT`.
    avec_hebergement: bool = False

    @model_validator(mode="after")
    def _exiger_une_cible_coherente(self) -> "ReservationCreate":
        """Refuse une réservation de formation sans session.

        Le `CHECK` d'exclusivité du MLD (contrainte n°2) autorise **zéro**
        colonne cible renseignée — c'est ce qu'il faut pour une réservation de
        table. Il ne peut donc pas exiger `id_session` pour le type `Formation`,
        qui croiserait deux colonnes. La règle vit ici.

        Les types `Salle` et `Logement` sont refusés tant que le sprint 5 ne les
        a pas livrés : accepter une réservation qu'aucun service ne sait honorer
        laisserait une ligne orpheline en base.
        """
        if self.type_reservation is TypeReservation.FORMATION:
            if self.id_session is None:
                raise ValueError(
                    "Une réservation de formation doit désigner une session."
                )
        elif self.id_session is not None:
            raise ValueError(
                "Seule une réservation de formation peut désigner une session."
            )

        if self.type_reservation in (
            TypeReservation.SALLE,
            TypeReservation.LOGEMENT,
        ):
            raise ValueError(
                f"Les réservations de type « {self.type_reservation.value} » "
                "ne sont pas encore disponibles."
            )
        return self

    @model_validator(mode="after")
    def _refuser_un_hebergement_hors_formation(self) -> "ReservationCreate":
        """Refuse l'hébergement sur une réservation qui n'est pas une formation.

        L'option est adossée à `FORMATION.propose_hebergement` : elle n'a de sens
        que pour un stage, où l'on loge le stagiaire le temps de la session. Un
        hébergement lié à une table n'aurait rien pour le valider.

        La vérification que la formation le propose **réellement** ne peut pas
        se faire ici — elle demande la base. Elle vit dans le service.
        """
        if (
            self.avec_hebergement
            and self.type_reservation is not TypeReservation.FORMATION
        ):
            raise ValueError(
                "L'hébergement n'est proposé que sur une réservation de formation."
            )
        return self

    @model_validator(mode="after")
    def _refuser_un_intervalle_inverse(self) -> "ReservationCreate":
        if self.date_fin < self.date_debut:
            raise ValueError("La date de fin ne peut pas précéder la date de début.")
        return self


class ReservationRead(BaseModel):
    """Réservation en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    id_reservation: int
    type_reservation: TypeReservation
    date_debut: datetime
    date_fin: datetime
    nombre_personnes: int
    statut: StatutReservation
    avec_hebergement: bool
    id_client: int
    id_session: int | None = None


class ReservationChangementStatut(BaseModel):
    """Changement de statut d'une réservation."""

    statut: StatutReservation
