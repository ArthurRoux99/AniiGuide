import { useEffect, useMemo, useState } from 'react';
import { ANIIMO_BY_ID } from '../data/aniimo';
import { FACILITY_BY_ID, HOMELAND, facilityName, itemName } from '../data/homeland';
import { ABILITY_BY_ID, type AbilityId } from '../engine/abilities';
import { PERSONALITY_BONUS as LETTERS } from '../engine/personality';
import { ENV_STAFF, idealPool, plan, roadmap, rosterPool, setupWithOverrides, wholeUnits, type Plan as PlanResult, type PlanOptions, type PlanRow } from '../engine/homeland/optimize';
import { MAX_ANIIMO_BY_RV } from '../engine/rv';
import type { ProfileApi } from '../state/profile';
import { AbilityChip, Badge } from '../components/ui';
import { fmtDuration } from '../components/format';
import { climateLayout, type ClimateZone } from '../engine/homeland/climate';
import { HomelandMap } from '../components/HomelandMap';
import { MyFacilities, Upgrades } from '../components/Upgrades';
import { Comeback } from '../components/Comeback';
import { FoodBowl } from '../components/FoodBowl';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });


function Name({ id, kind }: { id: string; kind: 'facility' | 'item' }) {
  const n = kind === 'facility' ? facilityName(id) : itemName(id);
  return <span title={n.fr ? undefined : 'Nom anglais : nom français pas encore relevé en jeu'}>{n.name}</span>;
}

export function PlanPage({ api }: { api: ProfileApi }) {
  const { profile } = api;
  const hasRoster = profile.workers.length > 0;
  const [goal, setGoal] = useState<Goal>('levelUp');
  const [seasonOn, setSeasonOn] = useState(false);
  const [notes, setNotes] = useState(false);
  const [wheatPerDay, setWheatPerDay] = useState<number | null>(null);
  const [who, setWho] = useState<'roster' | 'ideal'>(hasRoster ? 'roster' : 'ideal');
  const [watering, setWatering] = useState(true);
  const [unverified, setUnverified] = useState(false);
  const [feeding, setFeeding] = useState(true);
  const [electric, setElectric] = useState(true);
  const rv = profile.rv;
  const maxed = rv >= 20;
  const seasonOpen = rv >= HOMELAND.season.minHomeLevel;
  // L'objectif « points » suppose la saison active.
  const seasonActive = seasonOpen && (seasonOn || goal === 'points');

  const roster = useMemo(
    () => rosterPool(profile.workers.map((w) => ({ homeland: ANIIMO_BY_ID.get(w.aniimoId)!.homeland, personality: w.personality }))),
    [profile.workers],
  );
  const pool = useMemo(
    () => (who === 'roster' && hasRoster ? roster : idealPool(MAX_ANIIMO_BY_RV[rv] - profile.shinies)),
    [who, hasRoster, roster, rv, profile.shinies],
  );
  const target = HOMELAND.levelUp[String(rv + 1)];

  const options = useMemo(
    (): PlanOptions => {
      const season = seasonActive ? { notes, wheatPerDay } : undefined;
      return {
        setup: setupWithOverrides(rv, profile.facilities),
        workers: pool,
        goal: goal === 'levelUp' && !maxed ? { kind: 'levelUp', stock: { coins: profile.coins ?? 0, items: profile.stock } } : goal === 'points' && season ? { kind: 'points' } : { kind: 'coins' },
        watering,
        includeUnverified: unverified,
        feeding,
        season,
        electric,
      };
    },
    [rv, goal, maxed, pool, watering, unverified, feeding, electric, seasonActive, notes, wheatPerDay, profile.coins, profile.stock, profile.facilities],
  );
  // Calcul rapide tout de suite, puis le calcul exact (machines dédiées, parcelles entières,
  // paires d'appareils ; jusqu'à une seconde) quand la saisie s'arrête.
  const quick = useMemo(() => plan(options), [options]);
  const [exact, setExact] = useState<{ options: PlanOptions; result: PlanResult } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setExact({ options, result: plan({ ...options, exact: true, pairs: true }) }), 400);
    return () => clearTimeout(t);
  }, [options]);
  const result = exact?.options === options && exact.result.feasible ? exact.result : quick;

  return (
    <div className="page">
      <section className="card">
        <h2>Optimiser mon logis</h2>
        <p className="hint">
          Calcule quoi produire dans chaque installation pour atteindre le prochain niveau du Camping-car le plus vite possible, puis
          gagner un maximum de pièces. Par défaut, les installations sont supposées toutes posées et améliorées au maximum de ton niveau : corrige-les dans « Mes installations ».
        </p>
        <div className="form-grid">
          <label className="stat">
            <span>Camping-car</span>
            <select value={rv} onChange={(e) => api.setRv(Number(e.target.value))}>
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  niv. {n}
                </option>
              ))}
            </select>
          </label>
          <label className="stat">
            <span>Objectif</span>
            <select value={goal} onChange={(e) => setGoal(e.target.value as Goal)}>
              <option value="levelUp" disabled={maxed}>
                Monter au niv. {Math.min(20, rv + 1)} au plus vite
              </option>
              <option value="coins">Un maximum de pièces</option>
              <option value="points" disabled={!seasonOpen}>
                Points de la Lune des moissons{seasonOpen ? '' : ` (dès le niv. ${HOMELAND.season.minHomeLevel})`}
              </option>
            </select>
          </label>
          <label className="stat">
            <span>Ouvriers</span>
            <select value={who} onChange={(e) => setWho(e.target.value as 'roster' | 'ideal')}>
              <option value="roster" disabled={!hasRoster}>
                Mes ouvriers ({profile.workers.length})
              </option>
              <option value="ideal">Idéaux (niv. 3, bonne personnalité)</option>
            </select>
          </label>
        </div>
        <div className="row toggles">
          <label>
            <input type="checkbox" checked={watering} onChange={(e) => setWatering(e.target.checked)} /> Arrosage par les Aniimo Eau
          </label>
          <label>
            <input type="checkbox" checked={unverified} onChange={(e) => setUnverified(e.target.checked)} /> Inclure les recettes non vérifiées
          </label>
          <label>
            <input type="checkbox" checked={feeding} onChange={(e) => setFeeding(e.target.checked)} /> Nourrir les Aniimo avec la production
          </label>
          {rv >= 12 && (
            <label>
              <input type="checkbox" checked={electric} onChange={(e) => setElectric(e.target.checked)} /> Mode électrique
            </label>
          )}
          {seasonOpen && (
            <label>
              <input type="checkbox" checked={seasonActive} disabled={goal === 'points'} onChange={(e) => setSeasonOn(e.target.checked)} /> Lune des moissons (saison)
            </label>
          )}
        </div>
        {seasonActive && (
          <div className="form-grid">
            <label className="stat">
              <span>Blé de rayon de lune par jour pour les graines</span>
              <input
                type="number"
                min={0}
                step={10}
                inputMode="numeric"
                placeholder="sans limite"
                value={wheatPerDay ?? ''}
                onChange={(e) => setWheatPerDay(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
              />
            </label>
            <label className="toggles">
              <input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} /> J'ai les Notes de recette de saison
            </label>
          </div>
        )}
      </section>

      {goal === 'levelUp' && target && (
        <section className="card">
          <h2>Ce que j'ai déjà pour le niv. {rv + 1}</h2>
          <div className="form-grid">
            <label className="stat">
              <span>Pièces</span>
              <input type="number" min={0} value={profile.coins ?? 0} onChange={(e) => api.setCoins(Number(e.target.value))} />
            </label>
            {Object.keys(target.items).map((id) => (
              <label key={id} className="stat">
                <span>
                  <Name id={id} kind="item" />
                </span>
                <input type="number" min={0} value={profile.stock[id] ?? 0} onChange={(e) => api.setStock(id, Number(e.target.value))} />
              </label>
            ))}
          </div>
        </section>
      )}

      <MyFacilities api={api} />

      <Result result={result} goal={goal} rv={rv} who={who} />

      {result.feasible && <Upgrades options={options} />}

      {result.feasible && result.food && <FoodBowl food={result.food} />}

      {result.feasible && <Comeback result={result} setup={options.setup} />}

      <Roadmap rv={rv} pool={who === 'roster' && hasRoster ? roster : null} shinies={profile.shinies} watering={watering} unverified={unverified} />

      <section className="card">
        <details>
          <summary>
            <strong>Hypothèses du calcul</strong>
          </summary>
          <ul className="assumptions">
            <li>Données de production : projet Aniimax (MIT), vérifiées en jeu installation par installation ; formules de vitesse relevées en jeu.</li>
            <li>Production continue : tu récoltes assez souvent pour que rien ne déborde, et les graines sont achetées au besoin.</li>
            <li>Parcelles entières, et chaque machine de transformation réglée sur une seule recette (l'Établi de menuiserie et le Four de cheminée alternent entre leurs paliers), comme en jeu.</li>
            <li>Les Aniimo passent d'une installation à l'autre selon les besoins : un Aniimo n'est compté qu'une fois, au niveau et avec la personnalité qu'il a vraiment.</li>
            <li>Le semis, l'arrosage et la récolte occupent des Aniimo quelques secondes par récolte : ce temps est décompté de tes ouvriers.</li>
            <li>Mode électrique (niveau 12 et plus) : durée des lots et consommation par niveau d'installation tirées des données du jeu (Wikily). Le Générateur crépitant occupe un Aniimo Foudre ; tenu par un Aniimo Foudre de niveau trop bas, il est compté à la puissance du niveau de générateur que cet Aniimo suffit à tenir (estimation). Taux d'alimentation = production ÷ consommation, plafonné à 120 % (relevé en jeu) : avec une consommation sous 83 % de la production, toutes les installations électriques vont 20 % plus vite, et le plan en tient compte. Installations à poser dans la portée du Générateur (11 cases) ou d'un Poteau électrique crépitant (7 cases).</li>
            <li>Zone des appareils climatiques : 9×9 cases, une parcelle compte dès qu'elle la touche (jusqu'à 32 Fermes ou 12 Pépinières par appareil). Coûts d'amélioration des installations et durée d'amélioration du Camping-car non inclus.</li>
            <li>
              Un écart avec le jeu ? <a href="#mesures">Vérifie une durée en jeu</a> et signale-le.
            </li>
          </ul>
        </details>
      </section>
    </div>
  );
}

type Goal = 'levelUp' | 'coins' | 'points';

function Result({ result, goal, rv, who }: { result: PlanResult; goal: Goal; rv: number; who: 'roster' | 'ideal' }) {
  const whole = useMemo(() => wholeUnits(result.rows), [result.rows]);
  if (!result.feasible) {
    return (
      <section className="card">
        <h2>Pas de plan possible</h2>
        <p className="hint">
          {rv === 1
            ? 'Au niveau 1, les Blocs de bois demandés ne se produisent pas encore au logis (pas de Pépinière) : ils viennent des quêtes.'
            : "Aucune combinaison de recettes n'atteint l'objectif avec ces installations et ces ouvriers."}
        </p>
        {result.blockers.length > 0 && <p className="hint">Capacités manquantes : {result.blockers.map((b) => b.replace(':', ' niv. ')).join(', ')}</p>}
      </section>
    );
  }

  const byFacility = new Map<string, PlanRow[]>();
  for (const r of result.rows) byFacility.set(r.recipe.facility, [...(byFacility.get(r.recipe.facility) ?? []), r]);
  const missingBonus = [...byFacility.entries()]
    .map(([f, rows]) => ({ f, letter: FACILITY_BY_ID.get(f)?.personality, rows: rows.filter((r) => r.recipe.kind !== 'grower' && !r.personalityBonus && !r.electric) }))
    .filter((x) => x.letter && x.rows.length);
  const idle = result.facilityUse.filter((f) => {
    if (['heat-furnace', 'cooling-unit', 'sunlamp'].includes(f.facility)) return false;
    const processor = HOMELAND.recipes.some((r) => r.facility === f.facility && r.kind === 'processor');
    return processor ? f.used < 0.01 : f.used < f.count - 0.5;
  });

  return (
    <>
      <section className="card result">
        {goal === 'levelUp' && result.hours != null ? (
          <div className="headline">
            <span>Camping-car niv. {rv + 1} dans</span>
            <strong>{fmtDuration(result.hours)}</strong>
            <span className="muted">de production · {nf.format(result.coinsPerHour)} pièces/h</span>
          </div>
        ) : goal === 'points' && result.season ? (
          <div className="headline">
            <span>Lune des moissons</span>
            <strong>{nf.format(result.season.pointsPerHour)} points/h</strong>
            <span className="muted">
              {nf.format(result.season.pointsPerHour * 24)} par jour · {nf.format(result.coinsPerHour)} pièces/h
            </span>
          </div>
        ) : (
          <div className="headline">
            <span>Revenu maximal</span>
            <strong>{nf.format(result.coinsPerHour)} pièces/h</strong>
            <span className="muted">{nf.format(result.coinsPerHour * 24)} par jour</span>
          </div>
        )}
        {result.electric && (
          <p className="hint">
            ⚡ Mode électrique : un Générateur crépitant niv. {result.electric.level} tenu par un Aniimo Foudre niv. {result.electric.lightning}, {nf.format(result.electric.used)} W
            consommés sur {nf.format(result.electric.power)} W, taux d'alimentation{' '}
            {result.electric.rate > 1 ? '120 % (marge gardée exprès : +20 % de vitesse)' : '100 %'}. Les productions marquées ⚡ tournent sur le réseau, sans Aniimo.
          </p>
        )}
        {result.season && (
          <p className="hint">
            Lune des moissons : {nf.format(result.season.pointsPerHour * 24)} points et{' '}
            <b>{nf.format(result.season.wheatPerHour * 24)} Blé de rayon de lune</b> en graines par jour.
          </p>
        )}
        {result.target && result.remaining && goal === 'levelUp' && (
          <ul className="needs">
            <Need label="Pièces" need={result.target.coins} left={result.remaining.coins} rate={result.coinsPerHour} />
            {Object.entries(result.target.items).map(([id, n]) => (
              <Need key={id} label={<Name id={id} kind="item" />} need={n} left={result.remaining!.items[id]} rate={result.stockPerHour[id] ?? 0} />
            ))}
          </ul>
        )}
      </section>

      {missingBonus.length > 0 && (
        <section className="card tip">
          <h2>💡 Gagne +20 % avec la bonne personnalité</h2>
          <p className="hint">
            Place sur ces installations un Aniimo qui a la bonne lettre de personnalité
            {who === 'roster' ? ' (saisis les 4 lettres de tes ouvriers dans « Mon logis » pour que le calcul en tienne compte)' : ''} :
          </p>
          <ul className="plain">
            {missingBonus.map(({ f, letter }) => (
              <li key={f}>
                <b>
                  <Name id={f} kind="facility" />
                </b>{' '}
                → <b>{letter}</b> <span className="muted">({LETTERS[letter!].name})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Le plan, installation par installation</h2>
        <ul className="plan">
          {[...byFacility.entries()].map(([f, rows]) => {
            const fac = FACILITY_BY_ID.get(f)!;
            const use = result.facilityUse.find((u) => u.facility === f);
            const grower = rows[0].recipe.kind !== 'processor';
            return (
              <li key={f} className="plan__facility">
                <div className="plan__head">
                  <strong>
                    <Name id={f} kind="facility" />
                  </strong>
                  {fac.ability && <AbilityChip id={fac.ability as AbilityId} />}
                  {use && <span className="muted">{grower ? `${use.count} posé${use.count > 1 ? 's' : ''}` : `occupé ${Math.round((use.used / use.count) * 100)} % du temps`}</span>}
                </div>
                <table>
                  <tbody>
                    {rows.filter((r) => !grower || whole.get(r)! > 0).map((r) => (
                      <tr key={`${r.recipe.id}${r.covered}${r.workerLevel}${r.personalityBonus}${r.electric ?? ''}`}>
                        <td>
                          <Name id={r.recipe.output.item} kind="item" />
                          {r.recipe.environment && (
                            <small className="muted"> · {r.covered ? `zone ${envFr(r.recipe.environment)}` : `hors zone (${envFr(r.recipe.environment)})`}</small>
                          )}
                        </td>
                        <td className="num">
                          {grower
                            ? `× ${whole.get(r)}`
                            : result.machines?.[r.recipe.id]
                              ? `${result.machines[r.recipe.id]} machine${result.machines[r.recipe.id] > 1 ? 's' : ''} · ${Math.max(1, Math.round((r.units / result.machines[r.recipe.id]) * 100))} %`
                              : `${Math.max(1, Math.round((r.units / (use?.count ?? 1)) * 100))} %`}
                        </td>
                        <td className="num muted">{fmtDuration(r.cycleSeconds / 3600)}</td>
                        <td className="num muted">{nf1.format(r.outputPerHour)}/h</td>
                        <td className="muted">{r.electric ? <span title="Mode électrique : sans Aniimo">⚡</span> : r.workerLevel ? `niv. ${r.workerLevel}${r.personalityBonus ? ' +20 %' : ''}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </li>
            );
          })}
        </ul>
        {idle.length > 0 && (
          <p className="hint">
            Inutile pour cet objectif : {idle.map((f, i) => (
              <span key={f.facility}>
                {i > 0 && ', '}
                <Name id={f.facility} kind="facility" /> ({nf1.format(f.count - f.used)} libre{f.count - f.used >= 2 ? 's' : ''})
              </span>
            ))}
            .
          </p>
        )}
      </section>

      {(result.climate.length > 0 || result.pairs.length > 0) && <ClimatePlan result={result} whole={whole} />}

      <HomelandMap result={result} whole={whole} rv={rv} />

      <section className="card">
        <h2>À vendre</h2>
        <ul className="sales">
          {result.sales.filter((s) => s.coinsPerHour >= Math.max(10, result.coinsPerHour * 0.005)).slice(0, 12).map((s) => (
            <li key={s.item}>
              <Name id={s.item} kind="item" />
              <span className="muted">{nf1.format(s.perHour)}/h</span>
              <b>{nf.format(s.coinsPerHour)} p/h</b>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

const ENV_ICON: Record<string, string> = { Warm: '🌤️', Scorching: '🔥', Cool: '🍃', Freeze: '❄️', Adequate: '💡' };

/** Plan des zones climatiques : où poser les cultures couvertes autour de chaque appareil. */
function ClimatePlan({ result, whole }: { result: PlanResult; whole: Map<PlanRow, number> }) {
  const layout = useMemo(() => climateLayout(result, result.rows, whole), [result, whole]);
  const zones = layout.zones.filter((z) => z.plots.length);
  if (!zones.length) return null;
  return (
    <section className="card">
      <h2>Placement autour des appareils climatiques</h2>
      <p className="hint">
        Règle chaque appareil sur le climat indiqué, puis pose les parcelles exactement comme sur le schéma (1 carreau = 1 case du mode
        Construire). Une parcelle compte dès qu'elle <b>touche</b> la zone (pointillés) : c'est ce qui permet jusqu'à 32 Fermes ou 12
        Pépinières par appareil. Le jeu confirme avec « Conditions remplies » sur chaque parcelle. Une fois posé, enregistre-le en combo.
      </p>
      <div className="zones">
        {zones.map((z, i) => (
          <ZoneMap key={i} zone={z} />
        ))}
      </div>
      {layout.overflow.length > 0 && (
        <p className="hint">
          Arrondi des parcelles :{' '}
          {layout.overflow.map((o, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {o.count} × <Name id={o.crop} kind="item" />
            </span>
          ))}{' '}
          ne tiennent pas dans les zones : pose-les juste au bord, elles pousseront un peu moins vite.
        </p>
      )}
      <p className="hint">Règles de couverture : projet Aniimax (MIT), vérifiées sur une capture du jeu ; placements calculés par AniiGuide.</p>
    </section>
  );
}

const PLOT_FILL: Record<string, string> = { farmland: '#b07a3a', woodland: '#3f8f4f', big: '#7c6cf0' };
const ENV_STROKE: Record<string, string> = { Warm: '#f5a623', Scorching: '#e5484d', Cool: '#46a7a0', Freeze: '#3e8ed0', Adequate: '#d6b800' };

/** Schéma à l'échelle d'une zone : appareil, carré couvert, parcelles numérotées par culture. */
function ZoneMap({ zone: z }: { zone: ClimateZone }) {
  const c = z.size / 2, R = 4.5;
  // Paire : la Climatisation (2×2) à l'écart dx, dy, avec son propre carré.
  const cool = z.pair ? { x: z.pair.dx, y: z.pair.dy, cx: z.pair.dx + 1, cy: z.pair.dy + 1 } : null;
  const xs = [c - R, c + R, ...(cool ? [cool.cx - R, cool.cx + R] : []), ...z.plots.flatMap((p) => [p.x, p.x + p.size])];
  const ys = [c - R, c + R, ...(cool ? [cool.cy - R, cool.cy + R] : []), ...z.plots.flatMap((p) => [p.y, p.y + p.size])];
  const [x0, x1, y0, y1] = [Math.floor(Math.min(...xs)) - 1, Math.ceil(Math.max(...xs)) + 1, Math.floor(Math.min(...ys)) - 1, Math.ceil(Math.max(...ys)) + 1];
  const crops = [...new Set(z.plots.map((p) => `${p.kind}|${p.crop}`))];
  const letter = (p: { kind: string; crop: string }) => String.fromCharCode(65 + crops.indexOf(`${p.kind}|${p.crop}`));
  return (
    <figure className={`zone zone--${z.env.toLowerCase()}`}>
      <figcaption>
        {ENV_ICON[z.env]} <Name id={z.device} kind="facility" /> réglée sur <b>{envFr(z.env)}</b>
        {z.pair && (
          <>
            {' + '}
            {ENV_ICON[z.pair.cool]} <Name id="cooling-unit" kind="facility" /> réglée sur <b>{envFr(z.pair.cool)}</b> : la zone commune devient{' '}
            <b>{envFr(z.pair.both)}</b>
          </>
        )}
        <small className="muted">
          {' '}
          · occupe {z.pair ? '1 Aniimo Feu et 1 Aniimo Glace' : `1 Aniimo ${ABILITY_BY_ID[ENV_STAFF[z.device]].name}`}
        </small>
      </figcaption>
      <svg className="zone-map" viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} role="img" aria-label="Schéma de placement">
        {Array.from({ length: x1 - x0 + 1 }, (_, k) => (
          <line key={`v${k}`} x1={x0 + k} x2={x0 + k} y1={y0} y2={y1} className="zone-map__grid" />
        ))}
        {Array.from({ length: y1 - y0 + 1 }, (_, k) => (
          <line key={`h${k}`} y1={y0 + k} y2={y0 + k} x1={x0} x2={x1} className="zone-map__grid" />
        ))}
        <rect x={c - R} y={c - R} width={2 * R} height={2 * R} fill={ENV_STROKE[z.env]} fillOpacity={0.12} stroke={ENV_STROKE[z.env]} strokeWidth={0.12} strokeDasharray="0.4 0.25" />
        {cool && z.pair && (
          <rect x={cool.cx - R} y={cool.cy - R} width={2 * R} height={2 * R} fill={ENV_STROKE[z.pair.cool]} fillOpacity={0.12} stroke={ENV_STROKE[z.pair.cool]} strokeWidth={0.12} strokeDasharray="0.4 0.25" />
        )}
        {z.plots.map((p, k) => (
          <g key={k}>
            <rect x={p.x + 0.06} y={p.y + 0.06} width={p.size - 0.12} height={p.size - 0.12} rx={0.25} fill={PLOT_FILL[p.kind]} fillOpacity={0.85} />
            <text x={p.x + p.size / 2} y={p.y + p.size / 2} className="zone-map__label" fontSize={p.size >= 4 ? 1.6 : 0.95}>
              {letter(p)}
            </text>
          </g>
        ))}
        <rect x={0} y={0} width={z.size} height={z.size} fill="#fff" stroke={ENV_STROKE[z.env]} strokeWidth={0.15} />
        <text x={c} y={c} className="zone-map__device" fontSize={z.size > 1 ? 1.2 : 0.8}>
          {ENV_ICON[z.env]}
        </text>
        {cool && z.pair && (
          <>
            <rect x={cool.x} y={cool.y} width={2} height={2} fill="#fff" stroke={ENV_STROKE[z.pair.cool]} strokeWidth={0.15} />
            <text x={cool.cx} y={cool.cy} className="zone-map__device" fontSize={1.2}>
              {ENV_ICON[z.pair.cool]}
            </text>
          </>
        )}
      </svg>
      <ul className="zone-legend">
        {crops.map((k) => {
          const [kind, crop] = k.split('|');
          const n = z.plots.filter((p) => `${p.kind}|${p.crop}` === k).length;
          return (
            <li key={k}>
              <span className="zone-legend__key" style={{ background: PLOT_FILL[kind] }}>
                {letter({ kind, crop })}
              </span>
              {n} × <Name id={crop} kind="item" />
              {z.pair && <span className="muted"> · {envFr(z.plots.find((p) => p.crop === crop)?.env ?? z.env)}</span>} <span className="muted">({kind === 'farmland' ? 'Ferme' : kind === 'woodland' ? 'Pépinière' : <Name id={z.plots.find((p) => p.crop === crop)!.facility} kind="facility" />})</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

function Need({ label, need, left, rate }: { label: React.ReactNode; need: number; left: number; rate: number }) {
  const pct = need ? Math.round(((need - left) / need) * 100) : 100;
  return (
    <li className="need">
      <div className="need__label">
        {label}
        <span className="muted">
          {nf.format(need - left)} / {nf.format(need)}
        </span>
      </div>
      <div className="bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <small className="muted">{left > 0 ? `+${nf.format(rate)}/h · ${fmtDuration(left / Math.max(rate, 1e-9))}` : '✓ réuni'}</small>
    </li>
  );
}

const envFr = (e: string) => ({ Warm: 'chaude', Scorching: 'brûlante', Cool: 'fraîche', Freeze: 'gel', Adequate: 'lumière' })[e] ?? e;

function Roadmap({ rv, pool, shinies, watering, unverified }: { rv: number; pool: ReturnType<typeof rosterPool> | null; shinies: number; watering: boolean; unverified: boolean }) {
  const [show, setShow] = useState(false);
  const steps = useMemo(
    () => (show ? roadmap(Math.max(2, rv), (r) => pool ?? idealPool(MAX_ANIIMO_BY_RV[r] - shinies), { watering, includeUnverified: unverified }) : []),
    [show, rv, pool, shinies, watering, unverified],
  );
  let total = 0;
  return (
    <section className="card">
      <div className="card__head">
        <h2>Feuille de route jusqu'au niv. 20</h2>
        {!show && (
          <button type="button" className="btn" onClick={() => setShow(true)}>
            Calculer
          </button>
        )}
      </div>
      <p className="hint">
        Durée de production de chaque niveau en partant de zéro, avec le logis complet du niveau{pool ? ' et tes ouvriers actuels' : ' et des ouvriers idéaux'}.
      </p>
      {show && (
        <div className="table-wrap">
          <table className="roadmap">
            <thead>
              <tr>
                <th>Niveau</th>
                <th>Coût</th>
                <th className="num">Durée</th>
                <th className="num">Cumul</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => {
                total += s.hours ?? 0;
                return (
                  <tr key={s.rv} className={s.rv === rv ? 'is-current' : ''}>
                    <td>
                      {s.rv} → {s.rv + 1}
                    </td>
                    <td>
                      {nf.format(s.cost.coins)} p
                      {Object.entries(s.cost.items).map(([id, n]) => (
                        <small key={id} className="muted">
                          {' '}
                          · {nf.format(n)} <Name id={id} kind="item" />
                        </small>
                      ))}
                    </td>
                    <td className="num">{fmtDuration(s.hours)}</td>
                    <td className="num muted">{fmtDuration(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint">
        <Badge kind="communaute" /> Coûts de niveau : données communautaires, niv. 9 vérifié en jeu.
      </p>
    </section>
  );
}

