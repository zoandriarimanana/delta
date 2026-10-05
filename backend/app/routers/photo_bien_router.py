"""Endpoints de PHOTO_BIEN — galerie des salles, logements et formations.

**Lecture publique, écriture réservée aux administrateurs** — même réglage que
le catalogue des salles et des logements, dont la galerie fait partie : un
visiteur doit voir les lieux avant de réserver.

Un seul routeur pour les trois, comme une seule entité : `/salles/{id}/photos`,
`/logements/{id}/photos` et `/formations/{id}/photos` désignent la galerie de
chacun, `/photos-biens/{id}` une photo quel que soit son élément.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.schemas.photo_bien import LONGUEUR_LEGENDE, PhotoBienRead
from app.services.photo_bien_service import PhotoBienService

router = APIRouter(tags=["photo_bien"])

SessionBase = Annotated[Session, Depends(get_db)]
FichierPhoto = Annotated[
    UploadFile, File(description="Image JPEG, PNG ou WebP, 5 Mio max.")
]
Legende = Annotated[str | None, Form(max_length=LONGUEUR_LEGENDE)]


@router.get(
    "/salles/{id_salle}/photos",
    response_model=list[PhotoBienRead],
    summary="Lister les photos d'une salle",
)
def lister_photos_salle(id_salle: int, db: SessionBase) -> list[PhotoBienRead]:
    """Galerie publique, dans l'ordre d'ajout. 404 si la salle est inconnue
    ou archivée."""
    photos = PhotoBienService(db).lister_pour_salle(id_salle)
    return [PhotoBienRead.model_validate(p) for p in photos]


@router.post(
    "/salles/{id_salle}/photos",
    response_model=PhotoBienRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter une photo à une salle",
)
def ajouter_photo_salle(
    id_salle: int,
    admin: PersonnelAdministrateur,
    db: SessionBase,
    fichier: FichierPhoto,
    legende: Legende = None,
) -> PhotoBienRead:
    """Voir `PhotoBienService._enregistrer` pour les trois contrôles."""
    photo = PhotoBienService(db).ajouter_a_salle(
        id_salle, fichier.file.read(), fichier.content_type, legende
    )
    return PhotoBienRead.model_validate(photo)


@router.get(
    "/logements/{id_logement}/photos",
    response_model=list[PhotoBienRead],
    summary="Lister les photos d'un logement",
)
def lister_photos_logement(id_logement: int, db: SessionBase) -> list[PhotoBienRead]:
    """Galerie publique, dans l'ordre d'ajout."""
    photos = PhotoBienService(db).lister_pour_logement(id_logement)
    return [PhotoBienRead.model_validate(p) for p in photos]


@router.post(
    "/logements/{id_logement}/photos",
    response_model=PhotoBienRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter une photo à un logement",
)
def ajouter_photo_logement(
    id_logement: int,
    admin: PersonnelAdministrateur,
    db: SessionBase,
    fichier: FichierPhoto,
    legende: Legende = None,
) -> PhotoBienRead:
    """Voir `PhotoBienService._enregistrer` pour les trois contrôles."""
    photo = PhotoBienService(db).ajouter_a_logement(
        id_logement, fichier.file.read(), fichier.content_type, legende
    )
    return PhotoBienRead.model_validate(photo)


@router.get(
    "/formations/{id_formation}/photos",
    response_model=list[PhotoBienRead],
    summary="Lister les photos d'une formation",
)
def lister_photos_formation(id_formation: int, db: SessionBase) -> list[PhotoBienRead]:
    """Galerie publique, dans l'ordre d'ajout."""
    photos = PhotoBienService(db).lister_pour_formation(id_formation)
    return [PhotoBienRead.model_validate(p) for p in photos]


@router.post(
    "/formations/{id_formation}/photos",
    response_model=PhotoBienRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter une photo à une formation",
)
def ajouter_photo_formation(
    id_formation: int,
    admin: PersonnelAdministrateur,
    db: SessionBase,
    fichier: FichierPhoto,
    legende: Legende = None,
) -> PhotoBienRead:
    """Voir `PhotoBienService._enregistrer` pour les trois contrôles."""
    photo = PhotoBienService(db).ajouter_a_formation(
        id_formation, fichier.file.read(), fichier.content_type, legende
    )
    return PhotoBienRead.model_validate(photo)


@router.get(
    "/photos-biens/{id_photo}",
    response_class=Response,
    summary="Obtenir l'image d'une photo",
)
def obtenir_photo(id_photo: int, db: SessionBase) -> Response:
    """Sert les octets avec le type **détecté** à l'upload.

    Cache long et `immutable` : une photo ne se remplace pas, elle se retire
    puis s'ajoute sous un nouvel identifiant. Le contenu d'une URL donnée ne
    change donc jamais — contrairement à la photo du personnel, servie en
    `no-store` parce qu'elle se remplace à URL constante.
    """
    contenu, type_mime = PhotoBienService(db).obtenir_contenu(id_photo)
    return Response(
        content=contenu,
        media_type=type_mime,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.delete(
    "/photos-biens/{id_photo}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Retirer une photo",
)
def supprimer_photo(
    id_photo: int, admin: PersonnelAdministrateur, db: SessionBase
) -> None:
    """Suppression définitive — voir `PhotoBienService.supprimer`."""
    PhotoBienService(db).supprimer(id_photo)
