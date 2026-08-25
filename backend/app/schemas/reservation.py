"""Schemas Pydantic de l'entité RESERVATION."""

from datetime import datetime
from typing import ClassVar

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
    #: Obligatoire pour une réservation de type `Salle`.
    id_salle: int | None = None
    #: Obligatoire pour une réservation de type `Logement`.
    id_logement: int | None = None
    #: **Drapeau informatif** : le client dit qu'il souhaite être hébergé.
    #: Aucune chambre n'est réservée ni même vérifiée disponible — ce mécanisme
    #: n'existe pas encore, il arrive au sprint 5 avec `LOGEMENT`.
    avec_hebergement: bool = False

    #: Cible attendue pour chaque type. `Table` n'en a aucune : une réservation
    #: de table ne désigne rien, c'est le cas que le `CHECK` d'exclusivité
    #: autorise en laissant les trois colonnes nulles.
    _CIBLES: ClassVar[dict[TypeReservation, str]] = {
        TypeReservation.FORMATION: "id_session",
        TypeReservation.SALLE: "id_salle",
        TypeReservation.LOGEMENT: "id_logement",
    }

    @model_validator(mode="after")
    def _exiger_une_cible_coherente(self) -> "ReservationCreate":
        """Chaque type désigne sa cible, et elle seule.

        Le `CHECK` d'exclusivité du MLD (contrainte n°2) garantit qu'**au plus
        une** colonne cible est renseignée. Il ne peut pas garantir la
        **bonne** : il autorise zéro colonne — ce qu'il faut pour une
        réservation de table — et ne sait pas laquelle correspond au type.
        La règle croise deux colonnes, elle vit donc ici.

        Deux erreurs sont refusées : une cible manquante, et une cible qui ne
        correspond pas au type — réserver une salle en désignant un logement.
        """
        attendue = self._CIBLES.get(self.type_reservation)

        for type_reservation, colonne in self._CIBLES.items():
            valeur = getattr(self, colonne)
            if colonne == attendue:
                if valeur is None:
                    raise ValueError(
                        f"Une réservation de type "
                        f"« {self.type_reservation.value} » doit désigner "
                        f"un(e) {type_reservation.value.lower()}."
                    )
            elif valeur is not None:
                raise ValueError(
                    f"Une réservation de type "
                    f"« {self.type_reservation.value} » ne peut pas désigner "
                    f"un(e) {type_reservation.value.lower()}."
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
    id_salle: int | None = None
    id_logement: int | None = None


class ReservationChangementStatut(BaseModel):
    """Changement de statut d'une réservation."""

    statut: StatutReservation
