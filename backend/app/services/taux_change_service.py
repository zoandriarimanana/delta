"""Service métier de TAUX_CHANGE — et la conversion d'un montant en devise."""

from collections.abc import Sequence
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import ReferenceInvalide, RessourceIntrouvable
from app.models.taux_change import DEVISE_DE_REFERENCE, Devise, TauxChange
from app.repositories.taux_change_repository import TauxChangeRepository
from app.schemas.taux_change import TauxChangeUpdate

UN = Decimal("1")
CENTIME = Decimal("0.01")

#: Plus petit montant encaissable dans une devise étrangère. En dessous, une
#: carte internationale refuse la transaction (Stripe : 0,50 EUR / 0,50 USD) ;
#: l'accepter produirait une commande impayable.
MONTANT_MINIMUM_ETRANGER = Decimal("0.50")


class TauxChangeService:
    """Lecture et réglage des taux, et la seule règle de conversion."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.taux = TauxChangeRepository(db)

    def lister(self) -> Sequence[TauxChange]:
        """Les taux actifs, un par devise étrangère."""
        return self.taux.list()

    def obtenir(self, devise: Devise) -> TauxChange:
        """Le taux de `devise` — 404, la devise vient de l'URL."""
        taux = self.taux.par_devise(devise)
        if taux is None:
            raise RessourceIntrouvable(f"Aucun taux pour la devise {devise.value}.")
        return taux

    def modifier(self, devise: Devise, donnees: TauxChangeUpdate) -> TauxChange:
        """Règle le taux de `devise`.

        Sans effet sur les commandes passées : leur taux est figé.
        """
        taux = self.obtenir(devise)
        self.taux.update(taux, {"ariary_par_unite": donnees.ariary_par_unite})
        self.db.commit()
        self.db.refresh(taux)
        return taux

    def convertir(
        self, montant_ariary: Decimal, devise: Devise
    ) -> tuple[Decimal, Decimal]:
        """Convertit `montant_ariary` dans `devise`.

        Renvoie `(taux, montant)` : le taux appliqué (Ariary par unité, 1 pour
        l'Ariary) et le montant arrondi au centime, au demi supérieur. **Le
        seul endroit** où la règle vit — la commande les fige tous deux.

        **422** si la devise n'a pas de taux (elle vient du corps de la
        commande) ou si le montant converti est trop faible pour être
        encaissé par carte internationale.
        """
        if devise == DEVISE_DE_REFERENCE:
            return UN, montant_ariary.quantize(CENTIME, rounding=ROUND_HALF_UP)
        taux = self.taux.par_devise(devise)
        if taux is None:
            raise ReferenceInvalide(
                f"La devise {devise.value} n'est pas proposée pour le moment."
            )
        montant = (montant_ariary / taux.ariary_par_unite).quantize(
            CENTIME, rounding=ROUND_HALF_UP
        )
        if montant < MONTANT_MINIMUM_ETRANGER:
            raise ReferenceInvalide(
                f"Le montant de cette commande ({montant} {devise.value}) est trop "
                f"faible pour un paiement en {devise.value} : le minimum est "
                f"{MONTANT_MINIMUM_ETRANGER} {devise.value}. Choisissez l'Ariary."
            )
        return taux.ariary_par_unite, montant
