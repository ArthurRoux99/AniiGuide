import { useMemo, useState } from 'react';
import { facilityName, itemName, RECIPES, type Recipe } from '../data/homeland';
import { wateredSeconds, workSeconds } from '../engine/homeland/speed';
import type { ProfileApi } from '../state/profile';
import { fmtDuration, parseDuration } from '../components/format';

const REPORT = 'https://github.com/arthurroux99/AniiGuide/issues/new';

/** Durée prévue par AniiGuide pour un lot, selon le niveau de l'Aniimo et son bonus de personnalité. */
function predicted(r: Recipe, level: number, bonus: boolean, watered: boolean): number {
  if (r.kind === 'grower') return watered ? wateredSeconds(r.seconds!) : r.seconds!;
  return workSeconds({ facility: r.facility, workload: r.workload!, required: r.abilityLevel ?? 1, level, personality: bonus, gathering: r.kind === 'gatherer' });
}


/**
 * Vérifier en jeu : on relève la durée d'un lot, AniiGuide la compare à son calcul. Un écart se
 * signale en un geste (formulaire GitHub prérempli) pour corriger les formules pour tout le monde.
 */
export function Mesures({ api }: { api: ProfileApi }) {
  const facilities = useMemo(() => [...new Set(RECIPES.map((r) => r.facility))].sort((a, b) => facilityName(a).name.localeCompare(facilityName(b).name, 'fr')), []);
  const [facility, setFacility] = useState(facilities[0]);
  const recipes = RECIPES.filter((r) => r.facility === facility);
  const [recipeId, setRecipeId] = useState('');
  const recipe = recipes.find((r) => r.id === recipeId) ?? recipes[0];
  const [chosenLevel, setLevel] = useState(1);
  const level = Math.max(chosenLevel, recipe.abilityLevel ?? 1);
  const [bonus, setBonus] = useState(false);
  const [watered, setWatered] = useState(false);
  const [observed, setObserved] = useState('');

  const expected = predicted(recipe, level, bonus, watered);
  const obs = parseDuration(observed);
  const gap = obs ? obs / expected - 1 : null;
  const report =
    obs &&
    `${REPORT}?${new URLSearchParams({
      template: 'mesure.yml',
      title: `Mesure : ${facilityName(recipe.facility).name} · ${itemName(recipe.output.item).name}`,
      recette: recipe.id,
      conditions: recipe.kind === 'grower' ? (watered ? 'arrosé' : 'sans arrosage') : `Aniimo niv. ${level}${bonus ? ', bonne personnalité' : ''}`,
      observe: `${Math.round(obs)} s`,
      prevu: `${Math.round(expected)} s`,
      rv: String(api.profile.rv),
    })}`;

  return (
    <div className="page">
      <section className="card">
        <h2>Vérifier en jeu</h2>
        <p className="hint">
          Les calculs reposent sur des formules relevées par des joueurs. Chronomètre un lot en jeu (durée affichée sur l'installation) et
          compare : si l'écart dépasse quelques pourcents, signale-le, la correction profitera à tous.
        </p>
        <div className="form-grid">
          <label className="stat">
            <span>Installation</span>
            <select
              value={facility}
              onChange={(e) => {
                setFacility(e.target.value);
                setRecipeId('');
              }}
            >
              {facilities.map((f) => (
                <option key={f} value={f}>
                  {facilityName(f).name}
                </option>
              ))}
            </select>
          </label>
          <label className="stat">
            <span>Recette</span>
            <select value={recipe.id} onChange={(e) => setRecipeId(e.target.value)}>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {itemName(r.output.item).name} (installation niv. {r.level})
                </option>
              ))}
            </select>
          </label>
          {recipe.kind === 'grower' ? (
            <label className="stat">
              <span>Arrosage</span>
              <select value={watered ? '1' : '0'} onChange={(e) => setWatered(e.target.value === '1')}>
                <option value="0">Sans</option>
                <option value="1">Arrosé 2 fois</option>
              </select>
            </label>
          ) : (
            <>
              <label className="stat">
                <span>Niveau de l'Aniimo (requis : {recipe.abilityLevel ?? 1})</span>
                <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
                  {[1, 2, 3, 4].filter((l) => l >= (recipe.abilityLevel ?? 1)).map((l) => (
                    <option key={l} value={l}>
                      niv. {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stat">
                <span>Personnalité</span>
                <select value={bonus ? '1' : '0'} onChange={(e) => setBonus(e.target.value === '1')}>
                  <option value="0">Sans bonus</option>
                  <option value="1">Bonne lettre (+20 %)</option>
                </select>
              </label>
            </>
          )}
          <label className="stat">
            <span>Durée observée d'un lot</span>
            <input placeholder="ex. 1:30 ou 90 s" value={observed} onChange={(e) => setObserved(e.target.value)} />
          </label>
        </div>
        <p className="estimate">
          AniiGuide prévoit <strong>{fmtDuration(expected / 3600)}</strong> <span className="muted">({Math.round(expected)} s)</span>
          {!recipe.verified && <span className="badge">recette non vérifiée</span>}
        </p>
        {gap != null && (
          <p className={Math.abs(gap) <= 0.05 ? 'good' : 'bad'}>
            {Math.abs(gap) <= 0.05
              ? `✓ Conforme (écart ${Math.round(gap * 100)} %). Merci !`
              : `Écart de ${gap > 0 ? '+' : ''}${Math.round(gap * 100)} % : le calcul est à corriger.`}
          </p>
        )}
        {report && gap != null && Math.abs(gap) > 0.05 && (
          <a className="btn btn--primary" href={report} target="_blank" rel="noreferrer">
            Signaler cet écart
          </a>
        )}
      </section>

      <section className="card">
        <h2>Autres points à confirmer</h2>
        <ul className="plain">
          <li>Zones climatiques : une parcelle qui touche seulement le bord de la zone affiche-t-elle bien « Conditions remplies » ?</li>
          <li>Mode électrique : production d'un Générateur crépitant tenu par un Aniimo Foudre de niveau inférieur au niveau recommandé.</li>
          <li>Gamelle vide : les Aniimo ralentissent-ils (×0,2) ou s'arrêtent-ils ?</li>
          <li>Durée d'amélioration du Camping-car.</li>
        </ul>
        <p className="hint">
          Une capture suffit :{' '}
          <a href={`${REPORT}?template=mesure.yml&title=${encodeURIComponent('Mesure : ')}`} target="_blank" rel="noreferrer">
            ouvrir le formulaire
          </a>
          .
        </p>
      </section>
    </div>
  );
}
