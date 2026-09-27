import { useEffect, useMemo, useState } from 'react';
import { ANIIMO, ANIIMO_BY_ID, fullName } from '../data/aniimo';
import { candidateProfiles, type RecruitInput, type RecruitResult } from '../engine/homeland/recruit';
import { MAX_ANIIMO_BY_RV } from '../engine/rv';
import type { ProfileApi } from '../state/profile';
import { AbilityList, Avatar } from '../components/ui';
import { fmtDuration } from './Plan';
import { EquipeOptimale } from './EquipeOptimale';
import RecruitWorker from '../workers/recruit.worker?worker&inline';
import wasmUrl from 'highs/runtime?url';

type State = { status: 'idle' } | { status: 'running'; done: number; total: number } | { status: 'done'; result: RecruitResult; key: string };

/** Onglet Recruter : l'équipe optimale par niveau, et la meilleure recrue pour l'équipe actuelle. */
export function Recruter({ api }: { api: ProfileApi }) {
  const [tab, setTab] = useState<'team' | 'recruit'>('team');
  return (
    <div className="page">
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'team'} className={tab === 'team' ? 'is-active' : ''} onClick={() => setTab('team')}>
          Équipe optimale
        </button>
        <button type="button" role="tab" aria-selected={tab === 'recruit'} className={tab === 'recruit' ? 'is-active' : ''} onClick={() => setTab('recruit')}>
          Meilleure recrue
        </button>
      </div>
      {tab === 'team' ? <EquipeOptimale api={api} /> : <MeilleureRecrue api={api} />}
    </div>
  );
}

/** « Qui recruter ? » : les Aniimo qui feraient le plus gagner de temps à l'équipe actuelle. */
function MeilleureRecrue({ api }: { api: ProfileApi }) {
  const { profile } = api;
  const [withPrismana, setWithPrismana] = useState(false);
  const [state, setState] = useState<State>({ status: 'idle' });
  const rv = profile.rv;
  const roster = useMemo(
    () => profile.workers.map((w) => ({ homeland: ANIIMO_BY_ID.get(w.aniimoId)!.homeland, personality: w.personality })),
    [profile.workers],
  );
  const key = JSON.stringify([rv, profile.workers, profile.coins, profile.stock, profile.shinies, withPrismana]);

  useEffect(() => {
    if (!roster.length || rv >= 20) return;
    if (state.status === 'done' && state.key === key) return;
    const worker = new RecruitWorker();
    const input: RecruitInput = {
      rv,
      roster,
      candidates: candidateProfiles(ANIIMO, withPrismana),
      stock: { coins: profile.coins ?? 0, items: profile.stock },
      maxAniimo: MAX_ANIIMO_BY_RV[rv],
      shinies: profile.shinies,
      opts: { watering: true, includeUnverified: false },
    };
    setState({ status: 'running', done: 0, total: input.candidates.length + roster.length });
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') setState({ status: 'running', done: e.data.done, total: e.data.total });
      else {
        setState({ status: 'done', result: e.data.result, key });
        worker.terminate();
      }
    };
    worker.postMessage({ wasmUrl: new URL(wasmUrl, location.href).href, input });
    return () => worker.terminate();
  }, [key]); // `key` résume toutes les entrées du calcul

  if (!roster.length) {
    return (
      <>
        <section className="card empty">
          <p>Ajoute d'abord tes ouvriers dans « Mon logis » : les conseils de recrutement partent de ton équipe réelle.</p>
          <a className="btn btn--primary" href="#logis">
            Aller à Mon logis
          </a>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="card">
        <h2>Qui recruter pour aller plus vite ?</h2>
        <p className="hint">
          Chaque profil d'Aniimo est ajouté à ton équipe, puis l'optimiseur recalcule le temps pour passer le niveau {rv} → {rv + 1} (avec ton
          stock) et le niveau {rv + 1} → {rv + 2}. Les Aniimo qui partagent exactement les mêmes capacités sont regroupés.
        </p>
        <label className="row toggles">
          <input type="checkbox" checked={withPrismana} onChange={(e) => setWithPrismana(e.target.checked)} /> Inclure les formes prismana (niv. 4, rares)
        </label>
      </section>

      {state.status === 'running' && (
        <section className="card">
          <p>
            Calcul en cours… {state.done}/{state.total}
          </p>
          <div className="bar">
            <span style={{ width: `${(state.done / Math.max(1, state.total)) * 100}%` }} />
          </div>
        </section>
      )}

      {state.status === 'done' && <Results result={state.result} api={api} rv={rv} />}

      <section className="card">
        <details>
          <summary>
            <strong>Comment lire ces conseils</strong>
          </summary>
          <ul className="assumptions">
            <li>Chaque installation travaillée occupe son propre Aniimo, à son niveau : 5 mines demandent 5 Aniimo Terre.</li>
            <li>La personnalité d'un Aniimo attrapé est aléatoire : « jusqu'à » indique le gain s'il a la bonne lettre pour l'installation où il travaillera.</li>
            <li>Le travail aux champs (défricher, semer, arroser, récolter) demande quelques secondes par récolte : il faut au moins un Aniimo de chaque capacité, mais il en occupe peu. Le Transport n'est pas encore chiffré.</li>
          </ul>
        </details>
      </section>
    </>
  );
}

function Results({ result, api, rv }: { result: RecruitResult; api: ProfileApi; rv: number }) {
  const useful = result.scores.filter((s) => s.now + s.next > 1 / 60 || s.nowBest + s.nextBest > 1 / 60).slice(0, 12);
  const weakest = result.removals[0];
  const weakestWorker = weakest ? api.profile.workers[weakest.index] : null;
  const owned = new Set(api.profile.workers.map((w) => w.aniimoId));

  return (
    <>
      <section className="card">
        <div className="form-grid">
          <div className="stat">
            <span>
              Niv. {rv} → {rv + 1} avec ton équipe
            </span>
            <strong>{fmtDuration(result.base.now)}</strong>
          </div>
          {result.base.next != null && (
            <div className="stat">
              <span>
                Niv. {rv + 1} → {rv + 2} (en partant de zéro)
              </span>
              <strong>{fmtDuration(result.base.next)}</strong>
            </div>
          )}
        </div>
        {result.full && weakestWorker && (
          <p className="hint">
            Ton logis est plein : pour accueillir une recrue, retire l'ouvrier le moins utile,{' '}
            <b>{fullName(ANIIMO_BY_ID.get(weakestWorker.aniimoId)!)}</b>
            {weakest.loss < 1 / 60 ? ' (aucune perte)' : ` (perte ≈ ${fmtDuration(weakest.loss)})`}.
          </p>
        )}
      </section>

      {useful.length === 0 ? (
        <section className="card empty">
          <p>Aucun Aniimo supplémentaire n'accélère ton logis à ces niveaux : ton équipe couvre déjà ce que demandent tes installations.</p>
        </section>
      ) : (
        <ol className="recruits">
          {useful.map((s, rank) => {
            const species = s.candidate.ids.map((id) => ANIIMO_BY_ID.get(id)!);
            const habitats = [...new Set(species.flatMap((a) => a.habitats))].slice(0, 4);
            return (
              <li key={s.candidate.ids.join()} className="card recruit">
                <div className="recruit__rank">#{rank + 1}</div>
                <div className="recruit__body">
                  <AbilityList levels={s.candidate.homeland} />
                  <div className="recruit__species">
                    {species.slice(0, 6).map((a) => (
                      <span key={a.id} className="mini">
                        <Avatar aniimo={a} size={40} />
                        <span>
                          {fullName(a)}
                          {owned.has(a.id) && <small className="muted"> · déjà au logis</small>}
                        </span>
                      </span>
                    ))}
                    {species.length > 6 && <span className="muted">+{species.length - 6}</span>}
                  </div>
                  {habitats.length > 0 && <small className="habitats">📍 {habitats.join(' · ')}</small>}
                </div>
                <div className="recruit__gain">
                  <Gain label={`${rv}→${rv + 1}`} plain={s.now} best={s.nowBest} />
                  {result.base.next != null && <Gain label={`${rv + 1}→${rv + 2}`} plain={s.next} best={s.nextBest} />}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

function Gain({ label, plain, best }: { label: string; plain: number; best: number }) {
  const show = (h: number) => (h < 1 / 60 ? '—' : `−${fmtDuration(h)}`);
  return (
    <div className="gain">
      <small className="muted">niv. {label}</small>
      <b className={plain < 1 / 60 ? 'muted' : undefined}>{show(plain)}</b>
      {best - plain > 1 / 60 && <small className="muted">jusqu'à {show(best)}</small>}
    </div>
  );
}
