"""Schemas de DOCUMENT_CONNAISSANCE (Sprint 12, 12.9).

Pas de schema de création : le téléversement est un formulaire multipart
(`titre`, `public_cible`, `fichier`), comme la photo de profil. Pas de schema
de modification : un document se remplace — archiver l'ancien, téléverser le
nouveau —, son texte n'est pas éditable en ligne.

`texte_extrait` n'est jamais renvoyé en entier : il peut peser des centaines
de milliers de caractères, l'administration n'en lit qu'un aperçu.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.document_connaissance import PublicCible, TypeFichier

LONGUEUR_APERCU = 300


class DocumentConnaissanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_document: int
    titre: str
    nom_fichier: str
    type_fichier: TypeFichier
    taille_octets: int
    public_cible: PublicCible
    date_ajout: datetime
    id_personnel: int
    supprime_le: datetime | None
    apercu: str
    #: Fragments présents dans l'index ; `None` si l'assistant est coupé.
    #: `0` pour un document actif signale une indexation à relancer.
    nombre_fragments: int | None
