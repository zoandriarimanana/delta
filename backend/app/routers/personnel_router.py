"""Endpoints de PERSONNEL.

**Toutes les opérations exigent une authentification, lectures comprises** — à
la différence du catalogue produit, dont les lectures sont publiques. Un
annuaire du personnel porte des données personnelles de salariés : nom, adresse
professionnelle, téléphone, date d'embauche. Rien n'y a vocation à être exposé
anonymement.

Deux niveaux, et non un seul. **Consulter** l'annuaire est ouvert à tout
salarié authentifié : savoir qui livre ou qui forme fait partie du travail
courant. **L'écrire** — créer, modifier, archiver, restaurer — est réservé aux
administrateurs : c'est de la gestion du personnel, pas de la consultation.

Aucun jeton client n'ouvre plus rien ici : `get_current_personnel` refuse un
jeton émis pour un client, la revendication `type` ne correspondant pas.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur, PersonnelConnecte
from app.models.personnel import FonctionPersonnel
from app.schemas.personnel import PersonnelCreate, PersonnelRead, PersonnelUpdate
from app.services.personnel_service import PersonnelService

router = APIRouter(prefix="/personnel", tags=["personnel"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[PersonnelRead], summary="Lister le personnel")
def lister(
    agent: PersonnelConnecte,
    db: SessionBase,
    fonction: Annotated[
        FonctionPersonnel | None,
        Query(description="Filtre par fonction. Absent : tout le personnel."),
    ] = None,
) -> list[PersonnelRead]:
    """Personnel actif, filtrable par fonction.

    Une fonction sans titulaire donne une liste vide, pas un 404 : le paramètre
    est un critère de recherche, pas la désignation d'une ressource. Une valeur
    hors domaine est refusée en 422 par FastAPI, l'énumération faisant foi.
    """
    personnels = PersonnelService(db).lister(fonction)
    return [PersonnelRead.model_validate(p) for p in personnels]


@router.get(
    "/{id_personnel}",
    response_model=PersonnelRead,
    summary="Obtenir un membre du personnel",
)
def obtenir(
    id_personnel: int, agent: PersonnelConnecte, db: SessionBase
) -> PersonnelRead:
    """404 si l'identifiant de l'URL ne désigne personne, ou une ligne archivée."""
    personnel = PersonnelService(db).obtenir(id_personnel)
    return PersonnelRead.model_validate(personnel)


@router.post(
    "",
    response_model=PersonnelRead,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un membre du personnel",
)
def creer(
    donnees: PersonnelCreate, admin: PersonnelAdministrateur, db: SessionBase
) -> PersonnelRead:
    """409 si l'adresse professionnelle est déjà prise par une ligne active."""
    personnel = PersonnelService(db).creer(donnees)
    return PersonnelRead.model_validate(personnel)


@router.put(
    "/{id_personnel}",
    response_model=PersonnelRead,
    summary="Modifier un membre du personnel",
)
def modifier(
    id_personnel: int,
    donnees: PersonnelUpdate,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> PersonnelRead:
    """Mise à jour partielle : seuls les champs fournis sont écrits."""
    personnel = PersonnelService(db).modifier(id_personnel, donnees)
    return PersonnelRead.model_validate(personnel)


@router.delete(
    "/{id_personnel}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver un membre du personnel",
)
def supprimer(
    id_personnel: int, admin: PersonnelAdministrateur, db: SessionBase
) -> None:
    """Archive la ligne. Aucun `DELETE` SQL n'est émis.

    Les livraisons et sessions de formation qui la référencent sont conservées
    telles quelles : une livraison passée reste un fait après le départ du
    livreur.
    """
    PersonnelService(db).supprimer(id_personnel)


@router.post(
    "/{id_personnel}/restauration",
    response_model=PersonnelRead,
    summary="Restaurer un membre du personnel archivé",
)
def restaurer(
    id_personnel: int, admin: PersonnelAdministrateur, db: SessionBase
) -> PersonnelRead:
    """Réactive une ligne archivée — le retour d'un salarié.

    409 si l'adresse professionnelle a été réattribuée entre-temps : l'index
    unique étant partiel, la valeur a pu être reprise par une ligne active.
    """
    personnel = PersonnelService(db).restaurer(id_personnel)
    return PersonnelRead.model_validate(personnel)


@router.post(
    "/{id_personnel}/anonymisation",
    response_model=PersonnelRead,
    summary="Anonymiser un membre du personnel",
)
def anonymiser(
    id_personnel: int, admin: PersonnelAdministrateur, db: SessionBase
) -> PersonnelRead:
    """Efface les données personnelles d'un salarié — **seul chemin de
    conformité** pour `PERSONNEL` (droit à l'effacement : RGPD, loi malgache
    n°2014-038), voir `PersonnelService.anonymiser`.

    404 si l'identifiant ne désigne personne — y compris une ligne déjà
    archivée : `PersonnelService.anonymiser` accepte volontairement les
    lignes archivées, l'archivage seul n'ayant jamais suffi à effacer les
    données personnelles qu'il laisse en place.

    Idempotent : anonymiser une ligne déjà anonymisée n'a aucun effet
    observable supplémentaire.
    """
    personnel = PersonnelService(db).anonymiser(id_personnel)
    return PersonnelRead.model_validate(personnel)


@router.get(
    "/{id_personnel}/photo",
    summary="Obtenir la photo de profil",
    response_class=FileResponse,
)
def obtenir_photo(
    id_personnel: int, agent: PersonnelConnecte, db: SessionBase
) -> FileResponse:
    """Sert le fichier stocké sur disque — jamais un montage de fichiers
    statiques public, qui n'aurait aucun moyen de passer par `PersonnelConnecte`
    (cf. le premier paragraphe de ce module : aucune lecture de `PERSONNEL`
    n'est anonyme, une photo de profil ne fait pas exception).

    404 aussi bien si le membre n'existe pas que s'il n'a pas de photo — les
    deux cas se traduisent de la même façon côté frontend, l'avatar générique.

    `Cache-Control: no-store` : un remplacement de photo doit être visible
    immédiatement à la même URL, sans dépendre d'un contournement de cache
    côté client.
    """
    chemin = PersonnelService(db).chemin_photo(id_personnel)
    return FileResponse(chemin, headers={"Cache-Control": "no-store"})


@router.post(
    "/{id_personnel}/photo",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Téléverser ou remplacer la photo de profil",
)
def televerser_photo(
    id_personnel: int,
    admin: PersonnelAdministrateur,
    db: SessionBase,
    fichier: Annotated[UploadFile, File(description="Image JPEG ou PNG, 2 Mio max.")],
) -> None:
    """Valide puis stocke la photo — voir `PersonnelService.remplacer_photo`
    pour le détail des trois contrôles appliqués (type déclaré, taille,
    contenu réel des octets).
    """
    contenu = fichier.file.read()
    PersonnelService(db).remplacer_photo(id_personnel, contenu, fichier.content_type)


@router.delete(
    "/{id_personnel}/photo",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Retirer la photo de profil",
)
def supprimer_photo(
    id_personnel: int, admin: PersonnelAdministrateur, db: SessionBase
) -> None:
    """Symétrique de l'upload — supprime le fichier disque, remet la colonne à
    `NULL`. Idempotent : sans effet si aucune photo n'était déjà présente.
    """
    PersonnelService(db).supprimer_photo(id_personnel)


@router.get(
    "/{id_personnel}/badge",
    summary="Télécharger le badge (photo, identité, QR code)",
)
def obtenir_badge(
    id_personnel: int, agent: PersonnelConnecte, db: SessionBase
) -> Response:
    """Compose et renvoie un badge PNG à la volée — jamais stocké sur disque
    ni en base, voir `PersonnelService.generer_badge`.

    En `PersonnelConnecte`, comme la lecture de la fiche et de la photo : le
    badge ne fait que mettre en forme des données déjà lisibles à ce niveau,
    restreindre sa seule mise en forme n'aurait aucune justification métier
    (cf. l'en-tête de ce module : le critère est la nature de la donnée, pas
    l'écran qui l'affiche aujourd'hui).
    """
    contenu = PersonnelService(db).generer_badge(id_personnel)
    return Response(
        content=contenu,
        media_type="image/png",
        headers={
            "Content-Disposition": f'attachment; filename="badge-{id_personnel}.png"',
            "Cache-Control": "no-store",
        },
    )
