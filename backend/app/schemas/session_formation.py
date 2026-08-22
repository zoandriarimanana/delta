"""Schemas Pydantic de l'entité SESSION_FORMATION."""

from datetime import date

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.session_formation import StatutSessionFormation
from app.schemas.personnel import FormateurPublic


class SessionFormationCreate(BaseModel):
    """Charge utile de création d'une session.

    Deux champs du modèle sont délibérément absents.

    `places_restantes` est initialisé par le serveur depuis
    `FORMATION.capacite_max` : l'accepter permettrait d'ouvrir une session à
    mille places sur une formation qui en compte douze — même raison que
    `montant_total` et `prix_unitaire_applique`.

    `statut` naît toujours `Planifiee` : c'est un cycle de vie, pas une donnée
    d'entrée. Il avance ensuite par un endpoint dédié.
    """

    date_debut: date
    date_fin: date
    id_formation: int
    #: Facultatif à la création : une session se planifie souvent avant qu'un
    #: formateur ne soit désigné.
    id_formateur: int | None = None

    @model_validator(mode="after")
    def _refuser_un_intervalle_inverse(self) -> "SessionFormationCreate":
        """Refuse une session qui se termine avant d'avoir commencé.

        Une égalité reste permise : une session d'une journée a la même date de
        début et de fin.
        """
        if self.date_fin < self.date_debut:
            raise ValueError("La date de fin ne peut pas précéder la date de début.")
        return self


class SessionFormationUpdate(BaseModel):
    """Mise à jour partielle : seuls les champs fournis sont écrits.

    Ni `places_restantes` ni `statut` : le premier appartient au compteur de
    réservations, le second à un endpoint dédié. Une modification ne doit pas
    être une porte dérobée vers ce que la création interdit.

    La cohérence des dates **ne peut pas** être vérifiée ici : une mise à jour
    partielle ne porte que l'une des deux, et l'autre est en base. Seul le
    service, qui voit l'état courant, peut trancher.
    """

    date_debut: date | None = None
    date_fin: date | None = None
    id_formateur: int | None = None


class SessionFormationChangementStatut(BaseModel):
    """Changement de statut d'une session."""

    statut: StatutSessionFormation


class SessionFormationAffectation(BaseModel):
    """Affectation d'un formateur à une session."""

    id_personnel: int


class SessionFormationRead(BaseModel):
    """Session en sortie d'API.

    Le formateur est porté par `FormateurPublic` et **jamais** par
    `PersonnelRead` : le catalogue de formation est public, et l'adresse
    professionnelle comme le téléphone d'un salarié n'ont pas à y figurer.
    """

    model_config = ConfigDict(from_attributes=True)

    id_session: int
    date_debut: date
    date_fin: date
    places_restantes: int
    statut: StatutSessionFormation
    id_formation: int
    #: `None` tant qu'aucun formateur n'est affecté.
    formateur: FormateurPublic | None = None
