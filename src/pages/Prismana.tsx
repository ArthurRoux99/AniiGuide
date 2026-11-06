import { useEffect, useState } from 'react';
import { ANIIMO, ANIIMO_BY_ID } from '../data/aniimo';
import { PRISMANA_SOURCE, PRISMANA_WEEKS } from '../data/prismana';
import {
  ENERGY_FULL,
  ENERGY_STATES,
  SERVER_NAME,
  chanceWithin,
  energyState,
  luckyTier,
  superTier,
  toFull,
  untilGuaranteed,
  weekStart,
  type Server,
  type Tier,
} from '../engine/lucky';
import type { LuckyCounter, ProfileApi } from '../state/profile';

const pct = (p: number) => `${(p * 100).toLocaleString('fr-FR', { maximumFractionDigits: p < 0.01 ? 2 : 0 })} %`;
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const day = (iso: string, shift = 0) => new Date(Date.parse(iso + 'T12:00:00Z') + shift * 86400e3).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/** Prismana : planning de la semaine, compteur Lucky / Super Lucky, énergie de zone, liste des formes. */
export function Prismana({ api }: { api: ProfileApi }) {
  const now = Date.now();
  const server: Server = api.profile.lucky?.server ?? 'eu';
  const week = weekStart(now, server);
  const fresh = (s: Server): LuckyCounter => ({ server: s, week: weekStart(now, s), lucky: 0, superLucky: 0, sinceLucky: 0, sinceSuper: 0 });
  const saved = api.profile.lucky;
  // Nouvelle semaine : les compteurs de la semaine repartent de zéro (pas les captures depuis le dernier).
  const c: LuckyCounter = !saved ? fresh(server) : saved.week < week ? { ...saved, week, lucky: 0, superLucky: 0 } : saved;
  useEffect(() => {
    if (saved && saved.week < week) api.setLucky(c);
  });
  const set = (patch: Partial<LuckyCounter>) => api.setLucky({ ...c, ...patch });
  const caught = (n: number) => set({ sinceLucky: c.sinceLucky + n, sinceSuper: c.sinceSuper + n });

  const lt = luckyTier(c.lucky);
  const st = superTier(c.superLucky);
  const [energy, setEnergy] = useState(0);
  const [abundance, setAbundance] = useState(false);
  const need = toFull(energy, abundance);

  const current = PRISMANA_WEEKS.find((w) => now >= Date.parse(w.from) && now < Date.parse(w.to));
  const prismana = ANIIMO.filter((a) => a.prismana).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  return (
    <div className="page">
      <section className="card">
        <h2>Prismana de la semaine</h2>
        {current ? (
          <div className="row">
            {current.ids.map((id) => {
              const a = ANIIMO_BY_ID.get(id);
              return (
                a && (
                  <a key={id} className="chip" href={`#aniidex/${id}`}>
                    <img src={a.image} alt="" width={40} height={40} referrerPolicy="no-referrer" loading="lazy" /> {a.name} prismana
                  </a>
                )
              );
            })}
          </div>
        ) : (
          <p className="hint">Pas de Prismana annoncé pour cette semaine.</p>
        )}
        <ul className="plain">
          {PRISMANA_WEEKS.map((w) => (
            <li key={w.from} className={w === current ? '' : 'muted'}>
              {w === current ? '▶ ' : ''}
              {day(w.from)} – {day(w.to, -1)} : {w.ids.map((id) => ANIIMO_BY_ID.get(id)?.name ?? id).join(', ')}
            </li>
          ))}
        </ul>
        <p className="hint">
          Planning de l'
          <a href={PRISMANA_SOURCE} target="_blank" rel="noreferrer">
            annonce officielle
          </a>{' '}
          (mise à jour du 29 octobre). Chaque semaine commence le lundi à 4 h, heure du serveur.
        </p>
      </section>

      <section className="card">
        <h2>Compteur Lucky</h2>
        <p className="hint">
          Chaque capture réussie peut donner un <b>Super Lucky</b> (tiré en premier) ou un <b>Lucky</b>. La chance baisse avec le nombre déjà obtenu dans la
          semaine, mais une garantie le donne au plus tard au bout d'un nombre fixe de captures. Note tes captures ici pour savoir où tu en es. Un lancer
          raté ne compte pas.
        </p>
        <label className="stat">
          <span>Serveur (remise à zéro le lundi 4 h)</span>
          <select value={server} onChange={(e) => set({ server: e.target.value as Server, week: weekStart(now, e.target.value as Server) })}>
            {(Object.keys(SERVER_NAME) as Server[]).map((s) => (
              <option key={s} value={s}>
                {SERVER_NAME[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <button type="button" className="btn btn--primary" onClick={() => caught(1)}>
            +1 capture
          </button>
          <button type="button" className="btn" onClick={() => caught(10)}>
            +10
          </button>
          <button type="button" className="btn" onClick={() => set({ lucky: c.lucky + 1, sinceLucky: 0, sinceSuper: c.sinceSuper + 1 })}>
            ✨ J'ai eu un Lucky
          </button>
          <button type="button" className="btn" onClick={() => set({ superLucky: c.superLucky + 1, sinceSuper: 0, sinceLucky: c.sinceLucky + 1 })}>
            🌟 J'ai eu un Super Lucky
          </button>
        </div>
        <div className="form-grid">
          <Odds label="Lucky" got={c.lucky} since={c.sinceLucky} tier={lt} onSince={(n) => set({ sinceLucky: n })} />
          <Odds label="Super Lucky" got={c.superLucky} since={c.sinceSuper} tier={st} onSince={(n) => set({ sinceSuper: n })} />
        </div>
        <button type="button" className="btn" onClick={() => api.setLucky(fresh(server))}>
          Tout remettre à zéro
        </button>
        <p className="hint">
          Lucky : 1 % (garanti à la 200e capture) pour les 10 premiers de la semaine, puis 0,5 % (garanti à la 400e). Super Lucky : 0,2 % (500e) le
          premier de la semaine, 0,1 % (1 000e) le deuxième, puis 0,05 % (3 000e). Un Lucky ou Super Lucky obtenu dans le monde d'un ami remplit l'énergie
          de <b>ton</b> monde. Le jeu ne dit pas si les captures en cours vers la garantie repartent de zéro le lundi : on les garde.
        </p>
        <p className="hint">
          Sources : annonce officielle des chances, reprise par{' '}
          <a href="https://aniidex.com/guides/lucky-catch-rate/" target="_blank" rel="noreferrer">
            Aniidex
          </a>{' '}
          et{' '}
          <a href="https://aniimoguide.com/news/aniimo-lucky-strike-super-lucky-odds" target="_blank" rel="noreferrer">
            aniimoguide
          </a>
          .
        </p>
      </section>

      <section className="card">
        <h2>Énergie prismatique d'une zone</h2>
        <p className="hint">
          Chaque zone a sa jauge. Pleine ({nf.format(ENERGY_FULL)}), elle fait apparaître un Prismana à coup sûr. Un Lucky ajoute 302 en moyenne (275 à
          500), un Super Lucky 1 500, un Nourrissage de la Branche 480 (+50 % pendant l'Abondance de la Veine).
        </p>
        <div className="form-grid">
          <label className="stat">
            <span>Jauge affichée en jeu</span>
            <select value={energy} onChange={(e) => setEnergy(Number(e.target.value))}>
              {ENERGY_STATES.map(([min, name]) => (
                <option key={min} value={min}>
                  {name} (dès {nf.format(min)})
                </option>
              ))}
            </select>
          </label>
          <label className="toggles">
            <input type="checkbox" checked={abundance} onChange={(e) => setAbundance(e.target.checked)} /> Abondance de la Veine
          </label>
        </div>
        {need.left > 0 ? (
          <p>
            Jauge « {energyState(energy)} » : il manque au plus <b>{nf.format(need.left)}</b>, soit environ <b>{need.lucky} Lucky</b>, ou{' '}
            <b>{need.superLucky} Super Lucky</b>, ou <b>{need.nurture} Nourrissages</b>.
          </p>
        ) : (
          <p>Jauge pleine : le Prismana de la zone apparaît.</p>
        )}
      </section>

      <section className="card">
        <h2>Formes Prismana ({prismana.length})</h2>
        <ul className="plain">
          {prismana.map((a) => (
            <li key={a.id}>
              <a href={`#aniidex/${a.id}`}>{a.name}</a> <span className="muted">· {a.habitats.length ? a.habitats.join(', ') : 'lieu non publié'}</span>
            </li>
          ))}
        </ul>
        <p className="hint">Lieux : wiki officiel. Les formes Prismana des Aniimo de la semaine n'apparaissent souvent qu'en événement.</p>
      </section>
    </div>
  );
}

function Odds({ label, got, since, tier, onSince }: { label: string; got: number; since: number; tier: Tier; onSince: (n: number) => void }) {
  const left = untilGuaranteed(tier, since);
  return (
    <div className="stat" style={{ minWidth: 0 }}>
      <span>
        {label} : {got} cette semaine
      </span>
      <label>
        Captures depuis le dernier{' '}
        <input type="number" min={0} inputMode="numeric" style={{ width: '100%', boxSizing: 'border-box' }} value={since} onChange={(e) => onSince(Math.max(0, Number(e.target.value) || 0))} />
      </label>
      <span>
        Chance par capture : <b>{pct(tier.p)}</b> · garanti dans <b>{left}</b> captures
      </span>
      <span className="muted">
        Dans les 50 prochaines : {pct(chanceWithin(tier, since, 50))} · 100 : {pct(chanceWithin(tier, since, 100))}
      </span>
    </div>
  );
}
