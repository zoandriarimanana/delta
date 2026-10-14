"""Endpoints des photos du catalogue — salles, logements, formations, produits,
catégories (exemples de réalisations), et modèles choisis par les clients.

**Lecture publique, écriture réservée aux administrateurs** — même réglage que
le catalogue lui-même : un visiteur doit voir les lieux et les produits avant
de réserver ou de commander.

Les fichiers vivent dans `static/upload/<partie>/`, nommés `<id>-<n>.<ext>`
(voir `GalerieService`). Pas de montage `StaticFiles` : une route dédiée
refuse la photo d'un élément archivé et filtre le nom de fichier avant de
toucher au disque.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.schemas.galerie import PhotoRead
from app.services.galerie_service import GalerieService, Partie

router = APIRouter(tags=["galerie"])

SessionBase = Annotated[Session, Depends(get_db)]
FichierPhoto = Annotated[
    UploadFile, File(description="Image JPEG, PNG ou WebP, 5 Mio max.")
]


# Une route **explicite** par partie (`/salles/{id_salle}/photos`, …) plutôt
# qu'un `/{partie}/{id}/photos` générique : celui-ci capterait n'importe quel
# préfixe, et le contrat public (`tests/test_main.py`) ne dirait plus quels
# chemins existent réellement. Les deux corps sont mis en commun ci-dessous.


def _lister(db: Session, partie: Partie, identifiant: int) -> list[PhotoRead]:
    return [
        PhotoRead(fichier=nom) for nom in GalerieService(db).lister(partie, identifiant)
    ]


def _ajouter(
    db: Session, partie: Partie, identifiant: int, fichier: UploadFile
) -> PhotoRead:
    nom = GalerieService(db).ajouter(
        partie, identifiant, fichier.file.read(), fichier.content_type
    )
    return PhotoRead(fichier=nom)


LISTER = {
    "response_model": list[PhotoRead],
    "description": "Dans l'ordre des numéros ; la première sert de couverture. "
    "404 si l'élément est inconnu ou archivé.",
}
AJOUTER = {
    "response_model": PhotoRead,
    "status_code": status.HTTP_201_CREATED,
    "description": "Range le fichier sous `static/upload/<partie>/<id>-<n>.<ext>`.",
}


@router.get(
    "/salles/{id_salle}/photos", summary="Lister les photos d'un(e) salle", **LISTER
)
def lister_photos_salle(id_salle: int, db: SessionBase) -> list[PhotoRead]:
    return _lister(db, Partie.SALLES, id_salle)


@router.post(
    "/salles/{id_salle}/photos", summary="Ajouter une photo à un(e) salle", **AJOUTER
)
def ajouter_photo_salle(
    id_salle: int,
    admin: PersonnelAdministrateur,
    db: SessionBase,
    fichier: FichierPhoto,
) -> PhotoRead:
    return _ajouter(db, Partie.SALLES, id_salle, fichier)


@router.get(
    "/logements/{id_logement}/photos",
    summary="Lister les photos d'un(e) logement",
    **LISTER,
)
def lister_photos_logement(id_logement: int, db: SessionBase) -> list[PhotoRead]:
    return _lister(db, Partie.LOGEMENTS, id_logement)


@router.post(
    "/logements/{id_logement}/photos",
    summary="Ajouter une photo à un(e) logement",
    **AJOUTER,
)
def ajouter_photo_logement(
    id_logement: int,
    admin: PersonnelAdministrateur,
    db: SessionBase,
    fichier: FichierPhoto,
) -> PhotoRead:
    return _ajouter(db, Partie.LOGEMENTS, id_logement, fichier)


@router.get(
    "/formations/{id_formation}/photos",
    summary="Lister les photos d'un(e) formation",
    **LISTER,
)
def lister_photos_formation(id_formation: int, db: SessionBase) -> list[PhotoRead]:
    return _lister(db, Partie.FORMATIONS, id_formation)


@router.post(
    "/formations/{id_formation}/photos",
    summary="Ajouter une photo à un(e) formation",
    **AJOUTER,
)
def ajouter_photo_formation(
    id_formation: int,
    admin: PersonnelAdministrateur,
    db: SessionBase,
    fichier: FichierPhoto,
) -> PhotoRead:
    return _ajouter(db, Partie.FORMATIONS, id_formation, fichier)


@router.get(
    "/produits/{id_produit}/photos",
    summary="Lister les photos d'un(e) produit",
    **LISTER,
)
def lister_photos_produit(id_produit: int, db: SessionBase) -> list[PhotoRead]:
    return _lister(db, Partie.PRODUITS, id_produit)


@router.post(
    "/produits/{id_produit}/photos",
    summary="Ajouter une photo à un(e) produit",
    **AJOUTER,
)
def ajouter_photo_produit(
    id_produit: int,
    admin: PersonnelAdministrateur,
    db: SessionBase,
    fichier: FichierPhoto,
) -> PhotoRead:
    return _ajouter(db, Partie.PRODUITS, id_produit, fichier)


@router.get(
    "/categories-produit/{id_categorie}/photos",
    summary="Lister les exemples de réalisations d'une catégorie",
    **LISTER,
)
def lister_photos_categorie(id_categorie: int, db: SessionBase) -> list[PhotoRead]:
    return _lister(db, Partie.CATEGORIES, id_categorie)


@router.post(
    "/categories-produit/{id_categorie}/photos",
    summary="Ajouter un exemple de réalisation à une catégorie",
    **AJOUTER,
)
def ajouter_photo_categorie(
    id_categorie: int,
    fichier: FichierPhoto,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> PhotoRead:
    return _ajouter(db, Partie.CATEGORIES, id_categorie, fichier)


@router.get(
    "/photos/{partie}/couvertures",
    response_model=dict[int, str],
    summary="Première photo de chaque élément d'une partie",
)
def couvertures(partie: Partie, db: SessionBase) -> dict[int, str]:
    """`{identifiant: fichier}` en une requête, pour les cartes d'une liste.
    Déclarée **avant** `/photos/{partie}/{fichier}`, qui la capterait."""
    return GalerieService(db).couvertures(partie)


@router.get(
    "/photos/{partie}/{fichier}",
    response_class=FileResponse,
    summary="Obtenir l'image d'une photo",
)
def obtenir_photo(partie: Partie, fichier: str, db: SessionBase) -> FileResponse:
    """Sert le fichier avec son type.

    `no-cache` et non un cache long : un numéro libéré par un retrait peut
    être réattribué à une autre image, l'URL ne désigne donc pas toujours le
    même contenu. Le navigateur revalide (ETag), sans retélécharger une image
    inchangée.
    """
    chemin, type_mime = GalerieService(db).chemin(partie, fichier)
    return FileResponse(
        chemin, media_type=type_mime, headers={"Cache-Control": "no-cache"}
    )


@router.delete(
    "/photos/{partie}/{fichier}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Retirer une photo",
)
def supprimer_photo(
    partie: Partie, fichier: str, admin: PersonnelAdministrateur, db: SessionBase
) -> None:
    """Supprime le fichier du disque."""
    GalerieService(db).supprimer(partie, fichier)
