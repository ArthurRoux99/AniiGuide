import { HOMELAND, SEASON_CURRENCY, facilityName, itemName, seasonLive } from '../data/homeland';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/**
 * Commandes de saison : deux par jour, payées bien au-dessus du prix de vente. Le plan vise la
 * vente au marché ; ces commandes se remplissent en plus, avec quelques plats gardés de côté.
 */
export function SeasonOrders({ rv }: { rv: number }) {
  const orders = HOMELAND.season.orders;
  if (!orders?.length || !seasonLive() || rv < HOMELAND.season.minHomeLevel) return null;
  const rows = orders
    .map((o) => {
      const recipe = HOMELAND.recipes.find((r) => r.season && r.output.item === o.item);
      const sale = HOMELAND.items[o.item].sellValue * o.qty;
      return { ...o, recipe, sale, ratio: o.coins / sale };
    })
    .sort((a, b) => b.coins - a.coins);
  return (
    <details className="card">
      <summary>
        <strong>Commandes de saison</strong> <span className="muted">jusqu'à {nf.format(rows[0].coins)} pièces la commande, 2 par jour</span>
      </summary>
      <p className="hint">
        Chaque jour, deux commandes de la {HOMELAND.season.name} : elles paient plusieurs fois le prix de vente et rapportent aussi des {SEASON_CURRENCY} pour
        les graines. Garde de côté les plats demandés avant de vendre le reste.
      </p>
      <div className="table-scroll">
        <table className="roadmap">
          <thead>
            <tr>
              <th>Commande</th>
              <th>Pièces</th>
              <th>Vendu au marché</th>
              <th>{SEASON_CURRENCY}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.item}>
                <td>
                  {o.qty} × {itemName(o.item).name}
                  {o.recipe && (
                    <div className="muted">
                      {facilityName(o.recipe.facility).name} niv. {o.recipe.level}
                      {HOMELAND.season.recipeNotes.includes(o.recipe.id) ? ' · Note de recette' : ' · recette offerte'}
                    </div>
                  )}
                </td>
                <td className="num">{nf.format(o.coins)}</td>
                <td className="num">
                  {nf.format(o.sale)} <span className="muted">(×{o.ratio.toFixed(1)})</span>
                </td>
                <td className="num">{o.beans}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Récompenses relevées en jeu par aniimoguide.com ; prix de vente : Wikily (données du jeu).</p>
    </details>
  );
}
