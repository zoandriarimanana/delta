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

    **`est_administrateur` et `mot_de_passe` sont délibérément absents.** Ce sont
    les deux seules colonnes de `PERSONNEL` qu'aucune requête HTTP ne peut
    écrire, quel que soit l'appelant. Un champ qu'on n'expose pas est un champ
    qu'aucune faille d'autorisation ne peut atteindre : la protection ne dépend
    pas de la dépendance branchée sur l'endpoint, elle est structurelle.

    Pydantic ignore silencieusement les clés inconnues : un corps qui force
    `est_administrateur` à `true` est accepté, mais la valeur n'atteint jamais le
    modèle. Le comportement est verrouillé par un test — il tient à un défaut de
    Pydantic, pas à une intention lisible dans le code.

    L'amorçage du premier administrateur passe par
    `backend/scripts/creer_admin.py` (voir `docs/architecture.md`). La promotion
    d'un membre existant fera l'objet d'une route dédiée, protégée par
    `get_current_personnel_administrateur`, en #23.
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


class PersonnelUpdate(BaseModel):
    """Mise à jour partielle : seuls les champs fournis sont écrits.

    Même absence volontaire que dans `PersonnelCreate` : ni `est_administrateur`
    ni `mot_de_passe`. Une modification ne doit pas être une porte dérobée vers
    ce que la création interdit.
    """

    nom: str | None = Field(default=None, min_length=1, max_length=LONGUEUR_NOM)
    prenom: str | None = Field(default=None, min_length=1, max_length=LONGUEUR_NOM)
    fonction: FonctionPersonnel | None = None
    email: EmailStr | None = Field(default=None, max_length=LONGUEUR_EMAIL)
    telephone: str | None = Field(default=None, max_length=LONGUEUR_TELEPHONE)
    date_embauche: date | None = None
    specialite: str | None = Field(default=None, max_length=LONGUEUR_SPECIALITE)
    zone_livraison: str | None = Field(default=None, max_length=LONGUEUR_SPECIALITE)


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


class FormateurPublic(BaseModel):
    """Formateur tel qu'un visiteur le voit sur une fiche de session.

    Schema **distinct** de `PersonnelRead` et non un filtrage à l'affichage :
    un oubli de condition est invisible, un mauvais schema se voit dans la
    signature de l'endpoint. Même approche que `LivraisonPublique` en #25.

    La frontière est tracée ailleurs que pour le livreur, et pour une raison
    métier. Le nom d'un formateur est un **argument commercial** — il exerce
    publiquement devant ses stagiaires, et son expérience décide un client à
    s'inscrire. Ses **coordonnées professionnelles** restent en revanche
    internes : les publier l'exposerait au démarchage direct sans qu'il l'ait
    choisi.

    Ni `email`, ni `telephone`, ni `est_administrateur`, ni `date_embauche`,
    ni `zone_livraison` — cette dernière n'ayant de toute façon aucun sens pour
    un formateur.
    """

    model_config = ConfigDict(from_attributes=True)

    nom: str
    prenom: str
    #: Ce qu'il enseigne. `None` si la fiche du salarié ne le précise pas.
    specialite: str | None = None
