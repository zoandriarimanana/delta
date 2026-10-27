"""Amorçage du premier administrateur — exécution manuelle, hors API HTTP.

`est_administrateur` n'est exposé par **aucun** endpoint : ni `PersonnelCreate`
ni `PersonnelUpdate` ne le portent. C'est délibéré — un champ qu'on n'expose pas
est un champ qu'aucune faille d'autorisation ne peut atteindre. Il reste donc à
répondre à la question de l'œuf et de la poule : comment créer le tout premier
administrateur, puisqu'il faudrait déjà en être un.

Réponse : ici, par un script qui parle à la base et jamais à l'API. Y accéder
suppose un accès au serveur et aux identifiants de la base — c'est-à-dire un
niveau de privilège qui rend la question de l'élévation sans objet.

Le mot de passe n'est **jamais** un argument de ligne de commande : il resterait
en clair dans l'historique du shell (`~/.bash_history`), et serait visible de
tout utilisateur de la machine dans la sortie de `ps`. Il est lu soit en saisie
interactive masquée, soit dans la variable d'environnement
`DELTA_ADMIN_MOT_DE_PASSE`.

Usage :

    cd backend
    .venv/bin/python -m scripts.creer_admin \\
        --email chef@delta.mg --nom Rakoto --prenom Jean --fonction Autre

    # ou, sans terminal interactif (CI, conteneur) :
    DELTA_ADMIN_MOT_DE_PASSE='…' .venv/bin/python -m scripts.creer_admin \\
        --email chef@delta.mg --nom Rakoto --prenom Jean --fonction Autre

Voir `docs/architecture.md`, section « Amorçage du premier administrateur ».
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import LONGUEUR_MAX_MOT_DE_PASSE_OCTETS, hacher_mot_de_passe
from app.models.personnel import FonctionPersonnel, Personnel
from app.repositories.personnel_repository import PersonnelRepository

VARIABLE_MOT_DE_PASSE = "DELTA_ADMIN_MOT_DE_PASSE"
LONGUEUR_MIN_MOT_DE_PASSE = 12


class AmorcageImpossible(Exception):
    """Le script ne peut pas aboutir. Message destiné à l'opérateur."""


def lire_mot_de_passe() -> str:
    """Lit le mot de passe sans jamais le faire transiter par la ligne de commande.

    La variable d'environnement a la priorité : c'est le seul chemin utilisable
    sans terminal interactif. À défaut, saisie masquée avec confirmation — une
    faute de frappe sur un compte qu'on ne peut pas recréer par l'API coûterait
    cher.
    """
    depuis_environnement = os.environ.get(VARIABLE_MOT_DE_PASSE)
    if depuis_environnement:
        return depuis_environnement

    if not sys.stdin.isatty():
        raise AmorcageImpossible(
            "Aucun terminal interactif : renseignez "
            f"{VARIABLE_MOT_DE_PASSE} dans l'environnement."
        )

    mot_de_passe = getpass.getpass("Mot de passe : ")
    if mot_de_passe != getpass.getpass("Confirmation : "):
        raise AmorcageImpossible("Les deux saisies diffèrent.")
    return mot_de_passe


def valider_mot_de_passe(mot_de_passe: str) -> None:
    """Applique les mêmes bornes que l'inscription d'un client.

    La borne haute n'est pas une préférence : bcrypt **tronque silencieusement**
    au-delà de 72 octets. Accepter plus long donnerait l'illusion d'un secret
    plus fort que celui réellement vérifié.
    """
    if len(mot_de_passe) < LONGUEUR_MIN_MOT_DE_PASSE:
        raise AmorcageImpossible(
            f"Mot de passe trop court ({LONGUEUR_MIN_MOT_DE_PASSE} caractères "
            "au minimum)."
        )
    if len(mot_de_passe.encode("utf-8")) > LONGUEUR_MAX_MOT_DE_PASSE_OCTETS:
        raise AmorcageImpossible(
            f"Mot de passe trop long (maximum "
            f"{LONGUEUR_MAX_MOT_DE_PASSE_OCTETS} octets)."
        )


def creer_administrateur(
    db: Session,
    *,
    email: str,
    nom: str,
    prenom: str,
    fonction: FonctionPersonnel,
    mot_de_passe: str,
) -> Personnel:
    """Crée un membre du personnel administrateur, avec son mot de passe.

    Passe par le repository et non par `PersonnelService` : le service est
    consommé par le router, et y placer une opération qui accorde des droits
    inviterait tôt ou tard à l'exposer. Ce chemin d'écriture doit rester sans
    surface HTTP.

    Refuse si l'adresse est déjà prise par une ligne **active** — l'index
    `uq_personnel_email` étant partiel, un homonyme archivé ne bloque pas.
    """
    valider_mot_de_passe(mot_de_passe)

    depot = PersonnelRepository(db)
    if depot.get_by_email(email) is not None:
        raise AmorcageImpossible(
            f"Un membre du personnel actif utilise déjà l'adresse {email}."
        )

    personnel = depot.create(
        {
            "nom": nom,
            "prenom": prenom,
            "fonction": fonction,
            "email": email,
            "est_administrateur": True,
            "mot_de_passe": hacher_mot_de_passe(mot_de_passe),
        }
    )
    db.commit()
    return personnel


def _analyser(argv: list[str] | None = None) -> argparse.Namespace:
    analyseur = argparse.ArgumentParser(
        prog="creer_admin",
        description="Crée le premier administrateur. Hors API, exécution manuelle.",
        epilog=(
            "Le mot de passe n'est jamais un argument : saisie interactive "
            f"masquée, ou variable {VARIABLE_MOT_DE_PASSE}."
        ),
    )
    analyseur.add_argument("--email", required=True)
    analyseur.add_argument("--nom", required=True)
    analyseur.add_argument("--prenom", required=True)
    analyseur.add_argument(
        "--fonction",
        required=True,
        type=FonctionPersonnel,
        choices=list(FonctionPersonnel),
        help="Fonction exercée. Orthogonale au droit d'administration.",
    )
    return analyseur.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Point d'entrée. Retourne un code de sortie, ne lève pas."""
    arguments = _analyser(argv)
    try:
        mot_de_passe = lire_mot_de_passe()
        with SessionLocal() as db:
            personnel = creer_administrateur(
                db,
                email=arguments.email,
                nom=arguments.nom,
                prenom=arguments.prenom,
                fonction=arguments.fonction,
                mot_de_passe=mot_de_passe,
            )
    except AmorcageImpossible as erreur:
        print(f"Échec : {erreur}", file=sys.stderr)
        return 1

    print(
        f"Administrateur créé : #{personnel.id_personnel} "
        f"{personnel.prenom} {personnel.nom} <{personnel.email}> "
        f"[{personnel.fonction.value}]"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
