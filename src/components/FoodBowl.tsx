import { HOMELAND, itemName } from '../data/homeland';
import type { Plan } from '../engine/homeland/optimize';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const STAYS = [
  { label: '8 h', hours: 8 },
  { label: '24 h', hours: 24 },
  { label: '3 jours', hours: 72 },
];

/** Gamelle : ce que mangent les Aniimo du logis et les plats que le plan leur réserve. */
export function FoodBowl({ food }: { food: NonNullable<Plan['food']> }) {
  const eaters = Math.round(food.eaters);
  const total = food.dishes.reduce((s, d) => s + d.perHour, 0);
  return (
    <section className="card">
      <h2>Gamelle</h2>
      <p className="hint">
        Chaque Aniimo du logis mange 10 de nourriture par minute : {eaters} Aniimo, soit <b>{nf.format(food.perHour)} par heure</b>. Gamelle
        vide, ils ralentissent fortement ou s'arrêtent. Le plan prélève donc sur sa production les plats qui coûtent le moins en ventes
        perdues (déjà déduits des pièces/h).
      </p>
      <ul className="plain">
        {food.dishes.map((d) => (
          <li key={d.item}>
            <b>{itemName(d.item).name}</b> <span className="muted">({nf.format(HOMELAND.food[d.item])} de nourriture chacun)</span>
            <br />
            {STAYS.map((st, i) => (
              <span key={st.label}>
                {i > 0 && ' · '}
                {/* Part de ce plat dans la ration, sur toute la durée, arrondie au plat près. */}
                pour {st.label} : <b>{nf.format(Math.ceil((d.perHour / total) * ((food.perHour * st.hours) / HOMELAND.food[d.item])))}</b>
              </span>
            ))}
          </li>
        ))}
      </ul>
      <p className="hint">Avant une longue absence, remplis la gamelle pour la durée voulue. Valeurs nourrissantes : données du jeu relevées par Wikily.</p>
    </section>
  );
}
