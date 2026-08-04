"""Schemas Pydantic de l'entité PERSONNEL."""

from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.personnel import FonctionPersonnel

# Bornes alignées sur les `String(n)` du modèle. Les dupliquer ici est
# volontaire : le schema rejette en 422 avant que la base n'ait à trancher, avec
# un message exploitable côté client.
LONGUEUR_NOM = 100
LONGUEUR_EMAIL = 255
LONGUEUR_TELEPHONE = 30
LONGUEUR_SPECIALITE = 100


class PersonnelCreate(BaseModel):
    """Charge utile de création d'un membre du personnel.

    `fonction` est typée par l'énumération : une valeur hors domaine est refusée
    en 422 par le schema, avant même le `CHECK` de la base. Les deux servent —
    le schema donne un message lisible, le `CHECK` couvre les écritures qui ne
    passent pas par l'API.
    """

    nom: str = Field(min_length=1, max_length=LONGUEUR_NOM)
    prenom: str = Field(min_length=1, max_length=LONGUEUR_NOM)
    fonction: FonctionPersonnel
    email: EmailStr = Field(max_length=LONGUEUR_EMAIL)
    telephone: str | None = Field(default=None, max_length=LONGUEUR_TELEPHONE)
    date_embauche: date | None = None
    #: N'a de sens que pour un formateur, mais reste libre : le MLD ne
    #: conditionne pas ces colonnes à la fonction, et une règle de service qui
    #: les refuserait ailleurs serait une invention.
    specialite: str | None = Field(default=None, max_length=LONGUEUR_SPECIALITE)
    zone_livraison: str | None = Field(default=None, max_length=LONGUEUR_SPECIALITE)
    #: Par défaut `False` : le défaut d'un droit est de ne pas l'accorder.
    est_administrateur: bool = False


class PersonnelUpdate(BaseModel):
    """Mise à jour partielle : seuls les champs fournis sont écrits."""

    nom: str | None = Field(default=None, min_length=1, max_length=LONGUEUR_NOM)
    prenom: str | None = Field(default=None, min_length=1, max_length=LONGUEUR_NOM)
    fonction: FonctionPersonnel | None = None
    email: EmailStr | None = Field(default=None, max_length=LONGUEUR_EMAIL)
    telephone: str | None = Field(default=None, max_length=LONGUEUR_TELEPHONE)
    date_embauche: date | None = None
    specialite: str | None = Field(default=None, max_length=LONGUEUR_SPECIALITE)
    zone_livraison: str | None = Field(default=None, max_length=LONGUEUR_SPECIALITE)
    est_administrateur: bool | None = None


class PersonnelRead(BaseModel):
    """Membre du personnel en sortie d'API.

    `email` est typé `str` et non `EmailStr`, pour la même raison que
    `ClientRead.email` : un schema de sortie n'a pas à revalider une valeur
    issue de notre propre base, et le faire ferait échouer en 500 la lecture
    d'une ligne anonymisée (adresse en `delta.invalid`, refusée par `EmailStr`).
    L'anonymisation de `PERSONNEL` arrive avec l'authentification (#23) ; le
    schema est écrit dès maintenant pour ne pas avoir à le corriger après coup.
    """

    model_config = ConfigDict(from_attributes=True)

    id_personnel: int
    nom: str
    prenom: str
    fonction: FonctionPersonnel
    email: str
    telephone: str | None = None
    date_embauche: date | None = None
    specialite: str | None = None
    zone_livraison: str | None = None
    est_administrateur: bool
