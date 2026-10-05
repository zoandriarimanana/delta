"""Schemas de l'assistant IA (Sprint 12).

Aucune entité du MLD derrière : l'assistant lit le catalogue public au travers
de son index, il n'a ni table ni identifiant propre.
"""

from pydantic import BaseModel, Field, field_validator

# Assez pour une vraie question, trop peu pour coller un document entier dans
# le prompt — chaque caractère est envoyé, et facturé, au fournisseur.
LONGUEUR_MAX_QUESTION = 500


class QuestionAssistant(BaseModel):
    """Question posée à l'assistant."""

    question: str = Field(min_length=1, max_length=LONGUEUR_MAX_QUESTION)

    @field_validator("question")
    @classmethod
    def _pas_vide(cls, valeur: str) -> str:
        """Refuse une question faite d'espaces : 422 plutôt qu'un appel inutile."""
        valeur = valeur.strip()
        if not valeur:
            raise ValueError("La question est vide.")
        return valeur


class SourceAssistant(BaseModel):
    """Fiche du catalogue dont provient une partie de la réponse.

    Type et identifiant, pour que le frontend renvoie vers la fiche exacte.
    """

    type_contenu: str
    id_contenu: int
    # Absent des fragments indexés avant l'ajout du titre : le frontend
    # retombe alors sur un libellé générique (« Voir le produit »).
    titre: str | None = None


class ReponseAssistant(BaseModel):
    reponse: str
    sources: list[SourceAssistant]


class DisponibiliteAssistant(BaseModel):
    """Lue par le frontend pour afficher ou non la bulle de discussion.

    Ne dit rien d'autre que l'activation : aucun nom de modèle ni de
    fournisseur à un visiteur anonyme.
    """

    actif: bool


class EtatAssistant(BaseModel):
    """Tableau de bord de l'administration."""

    actif: bool
    llm_joignable: bool
    modele_llm: str
    modele_embeddings: str
    fragments_par_type: dict[str, int]
    total_fragments: int


class CompteIndexation(BaseModel):
    elements: int
    fragments: int


class ReindexationAssistant(BaseModel):
    par_type: dict[str, CompteIndexation]
    total_fragments: int
