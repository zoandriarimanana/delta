"""Inspection des violations de contrainte remontées par la base.

Une `IntegrityError` ne dit pas d'elle-même *quelle* contrainte a sauté. Sans ce
test, un service traduirait n'importe quelle violation par son message le plus
probable — « e-mail déjà utilisé » pour un conflit de numéro fiscal, par
exemple. Le nom de la contrainte est le seul discriminant fiable.
"""

from sqlalchemy.exc import IntegrityError


def viole_contrainte(
    erreur: IntegrityError, nom_contrainte: str, *indices_sans_nom: str
) -> bool:
    """Indique si l'erreur porte sur la contrainte nommée.

    PostgreSQL expose le nom via `erreur.orig.diag.constraint_name` (psycopg2) :
    c'est le test exact, et le seul qui compte en production. Dès qu'il est
    disponible, il tranche seul. Il vaut aussi bien pour une contrainte que pour
    un **index unique partiel** — vérifié : PostgreSQL y remonte le nom de
    l'index, ce qui permet de conserver les noms d'origine.

    `indices_sans_nom` sert les backends qui ne fournissent pas ce diagnostic —
    SQLite, utilisé par les tests, dit « UNIQUE constraint failed: table.colonne »
    sans jamais nommer la contrainte. On y cherche alors ces fragments, à
    renseigner par l'appelant qui seul sait à quelles colonnes sa contrainte
    correspond. Sans eux, une branche de traduction resterait non testée jusqu'à
    ce qu'elle échoue en production.

    C'est aussi pourquoi les noms de contrainte du schéma suivent une convention
    stricte (`core/database.py`) : ce sont ici des identifiants de comportement,
    pas de simples étiquettes.
    """
    depuis_diag = getattr(getattr(erreur.orig, "diag", None), "constraint_name", None)
    if depuis_diag:
        return depuis_diag == nom_contrainte

    message = str(erreur.orig).lower()
    if nom_contrainte.lower() in message:
        return True
    return any(indice.lower() in message for indice in indices_sans_nom)
