import { facilityName, itemName } from '../data/homeland';
import { autonomy } from '../engine/homeland/autonomy';
import type { Plan, Setup } from '../engine/homeland/optimize';
import { fmtDuration } from './format';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** « Quand revenir ? » : combien de temps chaque production tient avant que son stock soit plein. */
export function Comeback({ result, setup }: { result: Plan; setup: Setup }) {
  const list = autonomy(result, setup);
  if (!list.length) return null;
  const first = list[0];
  const at = (h: number) => new Date(Date.now() + h * 3600e3).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return (
    <details className="card">
      <summary>
        <strong>Quand revenir ?</strong>{' '}
        <span className="muted">
          première installation pleine dans {fmtDuration(first.hours)} (vers {at(first.hours)})
        </span>
      </summary>
      <p className="hint">
        Une installation garde ce qu'elle produit jusqu'à son stock maximal, puis s'arrête jusqu'à ce qu'un transporteur la vide vers
        l'Entrepôt. Si tes transporteurs ne suivent pas (trop peu d'Aniimo Transport, gamelle vide), voici quand chaque production s'arrête.
        Améliorer une installation augmente son stock.
      </p>
      <div className="table-scroll">
        <table className="roadmap">
          <thead>
            <tr>
              <th>Installation</th>
              <th>Stock</th>
              <th>Par heure</th>
              <th>Pleine dans</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={`${a.facility}|${a.item}`}>
                <td>
                  {facilityName(a.facility).name}
                  <div className="muted">{itemName(a.item).name}</div>
                </td>
                <td className="num">{a.stock}</td>
                <td className="num">{nf.format(a.perHour)}</td>
                <td className="num">
                  {fmtDuration(a.hours)} <span className="muted">({at(a.hours)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Stocks par niveau : données du jeu relevées par Wikily. Par exemplaire de l'installation, en travail continu.</p>
    </details>
  );
}
