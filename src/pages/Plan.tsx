import { useMemo, useState } from 'react';
import { ANIIMO_BY_ID } from '../data/aniimo';
import { FACILITY_BY_ID, HOMELAND, facilityName, itemName } from '../data/homeland';
import type { AbilityId } from '../engine/abilities';
import { PERSONALITY_BONUS as LETTERS } from '../engine/personality';
import { idealPool, plan, roadmap, rosterPool, setupForRv, wholeUnits, type Plan as PlanResult, type PlanRow } from '../engine/homeland/optimize';
import { MAX_ANIIMO_BY_RV } from '../engine/rv';
import type { ProfileApi } from '../state/profile';
import { AbilityChip, Badge } from '../components/ui';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export function fmtDuration(hours: number | null): string {
  if (hours == null || !isFinite(hours)) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m === 60 ? `${h + 1} h` : `${h} h ${String(m).padStart(2, '0')}`;
  }
  const total = Math.round(hours);
  return `${Math.floor(total / 24)} j ${total % 24} h`;
}

function Name({ id, kind }: { id: string; kind: 'facility' | 'item' }) {
  const n = kind === 'facility' ? facilityName(id) : itemName(id);
  return <span title={n.fr ? undefined : 'Nom anglais : nom français pas encore relevé en jeu'}>{n.name}</span>;
}

export function PlanPage({ api }: { api: ProfileApi }) {
  const { profile } = api;
  const hasRoster = profile.workers.length > 0;
  const [goal, setGoal] = useState<'levelUp' | 'coins'>('levelUp');
  const [who, setWho] = useState<'roster' | 'ideal'>(hasRoster ? 'roster' : 'ideal');
  const [watering, setWatering] = useState(true);
  const [unverified, setUnverified] = useState(false);
  const rv = profile.rv;
  const maxed = rv >= 20;

  const roster = useMemo(
    () => rosterPool(profile.workers.map((w) => ({ homeland: ANIIMO_BY_ID.get(w.aniimoId)!.homeland, personality: w.personality }))),
    [profile.workers],
  );
  const pool = useMemo(
    () => (who === 'roster' && hasRoster ? roster : idealPool(MAX_ANIIMO_BY_RV[rv] - profile.shinies)),
    [who, hasRoster, roster, rv, profile.shinies],
  );
  const target = HOMELAND.levelUp[String(rv + 1)];

  const result = useMemo(
    () =>
      plan({
        setup: setupForRv(rv),
        workers: pool,
        goal: goal === 'levelUp' && !maxed ? { kind: 'levelUp', stock: { coins: profile.coins ?? 0, items: profile.stock } } : { kind: 'coins' },
        watering,
        includeUnverified: unverified,
      }),
    [rv, goal, maxed, pool, watering, unverified, profile.coins, profile.stock],
  );

  return (
    <div className="page">
      <section className="card">
        <h2>Optimiser mon logis</h2>
        <p className="hint">
          Calcule quoi produire dans chaque installation pour atteindre le prochain niveau du Camping-car le plus vite possible, puis
          gagner un maximum de pièces. Les installations sont supposées toutes posées et améliorées au maximum de ton niveau.
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
            <select value={goal} onChange={(e) => setGoal(e.target.value as 'levelUp' | 'coins')}>
              <option value="levelUp" disabled={maxed}>
                Monter au niv. {Math.min(20, rv + 1)} au plus vite
              </option>
              <option value="coins">Un maximum de pièces</option>
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
        </div>
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

      <Result result={result} goal={goal} rv={rv} who={who} />

      <Roadmap rv={rv} pool={who === 'roster' && hasRoster ? roster : null} shinies={profile.shinies} watering={watering} unverified={unverified} />

      <section className="card">
        <details>
          <summary>
            <strong>Hypothèses du calcul</strong>
          </summary>
          <ul className="assumptions">
            <li>Données de production : projet Aniimax (MIT), vérifiées en jeu installation par installation ; formules de vitesse relevées en jeu.</li>
            <li>Production continue : tu récoltes assez souvent pour que rien ne déborde, et les graines sont achetées au besoin.</li>
            <li>Chaque installation travaillée reçoit ton meilleur Aniimo dans la capacité demandée (avec le bonus de personnalité s'il en a un).</li>
            <li>Le temps de semis/récolte des champs par les Aniimo n'est pas encore limité par ton nombre d'ouvriers.</li>
            <li>Zone des bâtiments climatiques : environ 9×9 cases (❓ à confirmer). Coûts d'amélioration des installations et durée d'amélioration du Camping-car non inclus.</li>
          </ul>
        </details>
      </section>
    </div>
  );
}

function Result({ result, goal, rv, who }: { result: PlanResult; goal: 'levelUp' | 'coins'; rv: number; who: 'roster' | 'ideal' }) {
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
    .map(([f, rows]) => ({ f, letter: FACILITY_BY_ID.get(f)?.personality, rows: rows.filter((r) => r.recipe.kind !== 'grower' && !r.personalityBonus) }))
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
        ) : (
          <div className="headline">
            <span>Revenu maximal</span>
            <strong>{nf.format(result.coinsPerHour)} pièces/h</strong>
            <span className="muted">{nf.format(result.coinsPerHour * 24)} par jour</span>
          </div>
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
                      <tr key={`${r.recipe.id}${r.covered}${r.workerLevel}${r.personalityBonus}`}>
                        <td>
                          <Name id={r.recipe.output.item} kind="item" />
                          {r.recipe.environment && (
                            <small className="muted"> · {r.covered ? `zone ${envFr(r.recipe.environment)}` : `hors zone (${envFr(r.recipe.environment)})`}</small>
                          )}
                        </td>
                        <td className="num">{grower ? `× ${whole.get(r)}` : `${Math.max(1, Math.round((r.units / (use?.count ?? 1)) * 100))} %`}</td>
                        <td className="num muted">{fmtDuration(r.cycleSeconds / 3600)}</td>
                        <td className="num muted">{nf1.format(r.outputPerHour)}/h</td>
                        <td className="muted">{r.workerLevel ? `niv. ${r.workerLevel}${r.personalityBonus ? ' +20 %' : ''}` : ''}</td>
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

