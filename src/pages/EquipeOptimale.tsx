import { useEffect, useMemo, useState } from 'react';
import { ANIIMO, ANIIMO_BY_ID, fullName } from '../data/aniimo';
import { plan, rosterPool, setupForRv } from '../engine/homeland/optimize';
import { candidateProfiles } from '../engine/homeland/recruit';
import { diffTeam, optimalTeam, type TeamMember, type TeamResult } from '../engine/homeland/team';
import { MAX_ANIIMO_BY_RV } from '../engine/rv';
import type { ProfileApi } from '../state/profile';
import { AbilityList, Avatar } from '../components/ui';
import { facilityName } from '../data/homeland';
import { fmtDuration } from '../components/format';

const BASE_OPTS = { watering: true, includeUnverified: false };

/** L'équipe d'Aniimo optimale pour un niveau de Camping-car, et comment y arriver depuis la sienne. */
export function EquipeOptimale({ api }: { api: ProfileApi }) {
  const { profile } = api;
  const OPTS = BASE_OPTS;
  const [rv, setRv] = useState(Math.min(19, Math.max(2, profile.rv)));
  const [personality, setPersonality] = useState(false);
  const [prismana, setPrismana] = useState(false);
  const [keep, setKeep] = useState(true);
  const useStock = rv === profile.rv;
  const stock = useStock ? { coins: profile.coins ?? 0, items: profile.stock } : { coins: 0, items: {} };
  const cap = MAX_ANIIMO_BY_RV[rv] - profile.shinies;
  const current = useMemo(
    () => profile.workers.map((w) => ({ homeland: ANIIMO_BY_ID.get(w.aniimoId)!.homeland, personality: w.personality })),
    [profile.workers],
  );

  const result = useMemo(
    () => optimalTeam({ rv, candidates: candidateProfiles(ANIIMO, prismana), cap, personality, stock, opts: OPTS, current: keep ? current : undefined }),
    [rv, cap, personality, prismana, keep, current, useStock, profile.coins, profile.stock, OPTS], // `stock` en découle
  );
  const mine = useMemo(
    () => (current.length ? plan({ ...OPTS, setup: setupForRv(rv), workers: rosterPool(current), goal: { kind: 'levelUp', stock } }) : null),
    [current, rv, useStock, profile.coins, profile.stock, OPTS], // `stock` en découle
  );
  const diff = useMemo(() => (current.length ? diffTeam(current, result.members) : null), [current, result.members]);

  return (
    <>
      <section className="card">
        <h2>Équipe optimale par niveau</h2>
        <p className="hint">
          L'optimiseur choisit en même temps quoi produire et quels Aniimo recruter, pour passer le niveau le plus vite possible avec les
          installations de ce niveau. Il garde le moins d'Aniimo possible à rythme égal, et au moins un Aniimo Plante, Ténèbres, Terre, Eau
          et Transport pour les champs.
        </p>
        <div className="form-grid">
          <label className="stat">
            <span>Niveau à passer</span>
            <select value={rv} onChange={(e) => setRv(Number(e.target.value))}>
              {Array.from({ length: 18 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n} → {n + 1}
                  {n === profile.rv ? ' (le mien)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row toggles">
          <label>
            <input type="checkbox" checked={personality} onChange={(e) => setPersonality(e.target.checked)} /> Supposer la bonne personnalité à chaque poste
          </label>
          <label>
            <input type="checkbox" checked={prismana} onChange={(e) => setPrismana(e.target.checked)} /> Autoriser les formes prismana
          </label>
          {current.length > 0 && (
            <label>
              <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Garder au maximum mon équipe (moins de recrues, même rythme)
            </label>
          )}
        </div>
      </section>

      <TeamSummary result={result} mine={mine?.hours ?? null} cap={cap} rv={rv} useStock={useStock} />
      <TeamList members={result.members} owned={new Set(profile.workers.map((w) => w.aniimoId))} />
      <WhyThisTeam result={result} />
      {rv < 19 && cap - result.size > 0 && (
        <PrepareNext rv={rv} team={result} cap={cap} shinies={profile.shinies} personality={personality} prismana={prismana} opts={OPTS} />
      )}
      {diff && (diff.recruit.length > 0 || diff.release.length > 0) && <TeamDiffView diff={diff} api={api} cap={cap} />}
      <TeamRoadmap current={current} shinies={profile.shinies} personality={personality} prismana={prismana} opts={OPTS} />
    </>
  );
}

function TeamSummary({ result, mine, cap, rv, useStock }: { result: TeamResult; mine: number | null; cap: number; rv: number; useStock: boolean }) {
  const free = cap - result.size;
  return (
    <section className="card result">
      <div className="form-grid">
        <div className="headline">
          <span>
            Équipe optimale · niv. {rv} → {rv + 1}
          </span>
          <strong>{fmtDuration(result.plan.hours)}</strong>
          <span className="muted">
            {result.size} Aniimo · {Math.round(result.plan.coinsPerHour).toLocaleString('fr-FR')} pièces/h{useStock ? ' · avec ton stock' : ' · en partant de zéro'}
          </span>
        </div>
        {mine != null && (
          <div className="headline">
            <span>Ton équipe actuelle</span>
            <strong className="muted">{fmtDuration(mine)}</strong>
            <span className="muted">
              {result.plan.hours != null && mine > result.plan.hours + 1 / 60 ? `${fmtDuration(mine - result.plan.hours)} de plus` : 'déjà optimale pour ce niveau'}
            </span>
          </div>
        )}
      </div>
      {free > 0 && (
        <p className="hint">
          {free} place{free > 1 ? 's' : ''} libre{free > 1 ? 's' : ''} sur {cap} : elles n'accélèrent pas ce niveau. Garde-les pour des éclatants, ou
          prépare le niveau suivant.
        </p>
      )}
    </section>
  );
}

function TeamList({ members, owned }: { members: TeamMember[]; owned: Set<string> }) {
  return (
    <section className="card">
      <h2>La composition</h2>
      <ul className="team">
        {members.map((m) => {
          const species = m.candidate.ids.map((id) => ANIIMO_BY_ID.get(id)!);
          return (
            <li key={m.candidate.ids.join()} className="team__row">
              <span className="team__count">{m.count}×</span>
              <div className="recruit__body">
                <AbilityList levels={m.candidate.homeland} />
                <div className="recruit__species">
                  {species.slice(0, 5).map((a) => (
                    <a key={a.id} className="mini" href={`#aniidex/${encodeURIComponent(a.id)}`} title={a.habitats.length ? `Habitats : ${a.habitats.join(', ')}` : undefined}>
                      <Avatar aniimo={a} size={36} />
                      <span>
                        {fullName(a)}
                        {owned.has(a.id) ? <small className="muted"> · au logis</small> : a.habitats[0] && <small className="muted"> · 📍 {a.habitats[0]}</small>}
                      </span>
                    </a>
                  ))}
                  {species.length > 5 && <span className="muted">+{species.length - 5} autres</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="hint">
        Toutes les espèces d'une ligne ont exactement les mêmes capacités de logis : prends celle que tu as ou que tu trouves le plus facilement.
        Touche un Aniimo pour sa fiche, ou vois <a href="#carte">Où trouver</a> pour les zones à visiter.
      </p>
    </section>
  );
}

function TeamDiffView({ diff, api, cap }: { diff: NonNullable<ReturnType<typeof diffTeam>>; api: ProfileApi; cap: number }) {
  const name = (i: number) => fullName(ANIIMO_BY_ID.get(api.profile.workers[i].aniimoId)!);
  const recruits = diff.recruit.reduce((s, k) => s + k.count, 0);
  const toFree = Math.max(0, api.profile.workers.length + recruits - cap);
  return (
    <section className="card">
      <h2>Depuis ton équipe actuelle</h2>
      <div className="diff">
        <div>
          <h3>✅ Garder ({diff.keep.reduce((s, k) => s + k.count, 0)})</h3>
          <ul className="plain">
            {diff.keep.map((k) => (
              <li key={k.candidate.ids.join()}>
                {k.count}× <AbilityList levels={k.candidate.homeland} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>🎯 Recruter ({recruits})</h3>
          <ul className="plain">
            {diff.recruit.map((k) => (
              <li key={k.candidate.ids.join()}>
                {k.count}× {k.candidate.ids.slice(0, 3).map((id) => fullName(ANIIMO_BY_ID.get(id)!)).join(', ')}
                {k.candidate.ids.length > 3 ? '…' : ''} <AbilityList levels={k.candidate.homeland} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>💤 Inutiles à ce niveau ({diff.release.length})</h3>
          <p className="hint">
            {toFree > 0
              ? `Libères-en ${toFree} pour faire de la place aux recrues.`
              : 'Tu as assez de place : pas besoin de les libérer, ils peuvent servir à un autre niveau.'}
          </p>
          <ul className="plain">
            {diff.release.map((i) => (
              <li key={i}>{name(i)}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Pour chaque niveau : durée avec l'équipe optimale et avec l'équipe actuelle, calculé niveau par niveau. */
function TeamRoadmap({ current, shinies, personality, prismana, opts: OPTS }: { current: { homeland: Record<string, number>; personality: string | null }[]; shinies: number; personality: boolean; prismana: boolean; opts: typeof BASE_OPTS }) {
  const [rows, setRows] = useState<{ rv: number; best: number | null; size: number; mine: number | null }[]>([]);
  const [run, setRun] = useState(false);
  useEffect(() => {
    if (!run) return;
    setRows([]);
    let rv = 2;
    let cancelled = false;
    const step = () => {
      if (cancelled || rv > 19) return;
      const cap = MAX_ANIIMO_BY_RV[rv] - shinies;
      const t = optimalTeam({ rv, candidates: candidateProfiles(ANIIMO, prismana), cap, personality, stock: { coins: 0, items: {} }, opts: OPTS });
      const mine = current.length ? plan({ ...OPTS, setup: setupForRv(rv), workers: rosterPool(current), goal: { kind: 'levelUp', stock: { coins: 0, items: {} } } }).hours : null;
      const row = { rv, best: t.plan.hours, size: t.size, mine };
      setRows((r) => [...r, row]);
      rv++;
      setTimeout(step, 0);
    };
    step();
    return () => {
      cancelled = true;
    };
  }, [run, current, shinies, personality, prismana, OPTS]);

  return (
    <section className="card">
      <div className="card__head">
        <h2>Tous les niveaux</h2>
        {!run && (
          <button type="button" className="btn" onClick={() => setRun(true)}>
            Calculer
          </button>
        )}
      </div>
      <p className="hint">Durée de chaque niveau (en partant de zéro) avec son équipe optimale, et avec ton équipe actuelle.</p>
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="roadmap">
            <thead>
              <tr>
                <th>Niveau</th>
                <th className="num">Équipe optimale</th>
                <th className="num">Taille</th>
                <th className="num">Mon équipe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rv}>
                  <td>
                    {r.rv} → {r.rv + 1}
                  </td>
                  <td className="num">{fmtDuration(r.best)}</td>
                  <td className="num muted">{r.size}</td>
                  <td className="num muted">{fmtDuration(r.mine)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Pourquoi cette taille d'équipe : ce qui tourne à plein (et fixe le rythme), ce qui tourne peu. */
function WhyThisTeam({ result }: { result: TeamResult }) {
  const use = result.plan.facilityUse.filter((f) => !['heat-furnace', 'cooling-unit', 'sunlamp'].includes(f.facility));
  const processors = new Set(result.plan.rows.filter((r) => r.recipe.kind === 'processor').map((r) => r.recipe.facility));
  const isProcessor = (id: string) => processors.has(id) || ['carousel-mill', 'crafting-table', 'claw-game-cooker', 'jukebox-dryer', 'simmering-pot', 'phonolfactory-table', 'bouncy-brew-keg', 'blazing-stove', 'pickling-jar', 'joy-wheel-loom', 'dance-pad-polisher', 'aniipod-maker', 'woodworking-bench', 'chimney-kiln'].includes(id);
  const full = use.filter((f) => !isProcessor(f.facility) && f.used >= f.count - 0.01);
  const partial = use.filter((f) => isProcessor(f.facility) && f.used > 0.001);
  const idle = use.filter((f) => isProcessor(f.facility) && f.used <= 0.001);
  const name = (id: string) => facilityName(id).name;
  return (
    <section className="card">
      <details>
        <summary>
          <strong>Pourquoi cette équipe ?</strong>
        </summary>
        <p className="hint">
          Ce qui fixe le rythme, ce sont les installations qui tournent à 100 % : ajouter des Aniimo ne les fait pas aller plus vite. Les ateliers
          transforment en une ou deux minutes ce qu'un champ produit en 30 : ils attendent leurs ingrédients.
        </p>
        <ul className="plain">
          <li>
            <b>À 100 % :</b> {full.map((f) => `${name(f.facility)} ×${f.count}`).join(', ') || '—'}
          </li>
          <li>
            <b>Utilisées en partie :</b>{' '}
            {partial.map((f) => `${name(f.facility)} (${Math.max(1, Math.round((f.used / f.count) * 100))} % du temps)`).join(', ') || '—'}
          </li>
          <li>
            <b>Pas utilisées :</b> {idle.map((f) => name(f.facility)).join(', ') || '—'}
            {idle.length > 0 && <span className="muted"> — leurs recettes rapportent moins que les autres chaînes pour les mêmes récoltes.</span>}
          </li>
        </ul>
      </details>
    </section>
  );
}

/** Utiliser les places libres pour préparer le niveau suivant. */
function PrepareNext({ rv, team, cap, shinies, personality, prismana, opts }: { rv: number; team: TeamResult; cap: number; shinies: number; personality: boolean; prismana: boolean; opts: typeof BASE_OPTS }) {
  const free = cap - team.size;
  const next = useMemo(() => {
    const current = team.members.flatMap((m) => Array.from({ length: m.count }, () => ({ homeland: m.candidate.homeland })));
    const t = optimalTeam({ rv: rv + 1, candidates: candidateProfiles(ANIIMO, prismana), cap: MAX_ANIIMO_BY_RV[rv + 1] - shinies, personality, stock: { coins: 0, items: {} }, opts, current });
    return diffTeam(current, t.members).recruit;
  }, [rv, team, shinies, personality, prismana, opts]);
  const picks: typeof next = [];
  let left = free;
  for (const k of next) {
    if (left <= 0) break;
    const count = Math.min(k.count, left);
    picks.push({ ...k, count });
    left -= count;
  }
  if (!picks.length) return null;
  return (
    <section className="card tip">
      <h2>
        💡 {free} place{free > 1 ? 's' : ''} libre{free > 1 ? 's' : ''} : prépare le niveau {rv + 1} → {rv + 2}
      </h2>
      <p className="hint">Ces Aniimo ne servent pas encore, mais l'équipe optimale du niveau suivant en aura besoin :</p>
      <ul className="plain">
        {picks.map((k) => (
          <li key={k.candidate.ids.join()}>
            {k.count}× {k.candidate.ids.slice(0, 3).map((id) => fullName(ANIIMO_BY_ID.get(id)!)).join(', ')} <AbilityList levels={k.candidate.homeland} />
          </li>
        ))}
      </ul>
    </section>
  );
}
