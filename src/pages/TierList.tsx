import { useMemo, useState } from 'react';
import { ANIIMO_BY_ID, fullName, matches, type Aniimo } from '../data/aniimo';
import rawSources from '../data/tierlists.gen.json';
import { CONSENSUS_TIERS, consensus, type ConsensusEntry, type TierSource } from '../engine/tierlist';
import type { Profile } from '../state/profile';
import { AbilityList, Avatar } from '../components/ui';

const SOURCES = rawSources as TierSource[];
const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

export const ELEMENTS: Record<string, { name: string; icon: string }> = {
  fire: { name: 'Feu', icon: '🔥' },
  water: { name: 'Eau', icon: '💧' },
  grass: { name: 'Plante', icon: '🌿' },
  rock: { name: 'Roche', icon: '🪨' },
  electric: { name: 'Foudre', icon: '⚡' },
  wind: { name: 'Vent', icon: '🌀' },
  ice: { name: 'Glace', icon: '❄️' },
  dark: { name: 'Ténèbres', icon: '🌑' },
  holy: { name: 'Lumière', icon: '☀️' },
};

export const ROLES: Record<string, string> = { dps: 'DPS', break: 'Rupture', sup: 'Soutien', heal: 'Soin', energy: 'Énergie' };

const TIER_COLORS: Record<string, string> = { S: '#e5484d', A: '#f5a623', B: '#46a758', C: '#3e8ed0', D: '#8e8ea0' };

/** Nom affiché d'une entrée : fiche officielle, ou nom anglais pour les Aniimo absents du wiki. */
function label(id: string): { aniimo: Aniimo | null; name: string; form: string | null } {
  const a = ANIIMO_BY_ID.get(id);
  if (a) return { aniimo: a, name: a.name, form: a.form };
  const m = id.replace(/^en:/, '').match(/^(.+?)(?: \((.+)\))?$/)!;
  return { aniimo: null, name: m[1], form: m[2] ?? null };
}

export function TierList({ profile }: { profile: Profile }) {
  const [role, setRole] = useState('');
  const [element, setElement] = useState('');
  const [query, setQuery] = useState('');
  const [forms, setForms] = useState<'all' | 'base' | 'no-prismana'>('all');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [minVotes, setMinVotes] = useState(2);
  const [open, setOpen] = useState<ConsensusEntry | null>(null);
  const owned = useMemo(() => new Set(profile.workers.map((w) => w.aniimoId)), [profile.workers]);

  const all = useMemo(() => consensus(SOURCES, minVotes), [minVotes]);
  const list = all.filter((e) => {
    const { aniimo, name, form } = label(e.id);
    if (ownedOnly && !owned.has(e.id)) return false;
    if (forms === 'base' && form) return false;
    if (forms === 'no-prismana' && (aniimo?.prismana || /prismana/i.test(form ?? ''))) return false;
    if (role && !aniimo?.roles.includes(role)) return false;
    if (element && !aniimo?.elements.includes(element)) return false;
    if (query && !(aniimo ? matches(aniimo, query) : name.toLowerCase().includes(query.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="page">
      <section className="card">
        <h2>Tier list combat · consensus</h2>
        <p className="hint">
          {SOURCES.length} tier lists publiées, ramenées sur la même échelle puis moyennées. Chaque source garde son avis : touche un Aniimo
          pour voir le détail. Les classements changent à chaque mise à jour du jeu.
        </p>
        <div className="toolbar">
          <input type="search" placeholder="Rechercher" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rôle">
            <option value="">Tous les rôles</option>
            {Object.entries(ROLES).map(([id, n]) => (
              <option key={id} value={id}>
                {n}
              </option>
            ))}
          </select>
          <select value={element} onChange={(e) => setElement(e.target.value)} aria-label="Élément">
            <option value="">Tous les éléments</option>
            {Object.entries(ELEMENTS).map(([id, e]) => (
              <option key={id} value={id}>
                {e.icon} {e.name}
              </option>
            ))}
          </select>
          <select value={forms} onChange={(e) => setForms(e.target.value as typeof forms)} aria-label="Formes">
            <option value="all">Toutes les formes</option>
            <option value="no-prismana">Sans prismana</option>
            <option value="base">Formes de base</option>
          </select>
          <select value={minVotes} onChange={(e) => setMinVotes(Number(e.target.value))} aria-label="Sources minimum">
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                ≥ {n} source{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="row toggles">
          <label>
            <input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} disabled={!owned.size} /> Seulement mes Aniimo
          </label>
        </div>
      </section>

      {CONSENSUS_TIERS.map((t) => {
        const row = list.filter((e) => e.tier === t);
        if (!row.length) return null;
        return (
          <section key={t} className="card tier-row">
            <div className="tier-row__label" style={{ background: TIER_COLORS[t] }}>
              {t}
            </div>
            <ul className="tier-row__items">
              {row.map((e) => {
                const l = label(e.id);
                return (
                  <li key={e.id}>
                    <button type="button" className={`tier-tile${owned.has(e.id) ? ' tile--owned' : ''}`} onClick={() => setOpen(e)}>
                      {l.aniimo ? <Avatar aniimo={l.aniimo} size={56} /> : <span className="avatar avatar--none">?</span>}
                      <span className="tier-tile__name">{l.name}</span>
                      {l.form && <small className="muted">{l.form.replace(/^Forme (de la |des |de |du )?/, '')}</small>}
                      <small className="tier-tile__votes" title={`${e.votes.length} source(s)`}>
                        {'●'.repeat(e.votes.length)}
                        {e.spread >= 0.5 ? ' ⚖️' : ''}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="card">
        <h2>Sources</h2>
        <ul className="plain">
          {SOURCES.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.source}
              </a>{' '}
              <span className="muted">
                — {s.entries.length} classés, barème {s.scale.join('/')}
                {s.pageDate ? `, page du ${new Date(s.pageDate).toLocaleDateString('fr-FR')}` : ''}
                {s.note ? `. ${s.note}` : ''}
              </span>
            </li>
          ))}
        </ul>
        <p className="hint">
          ● = nombre de sources qui classent l'Aniimo · ⚖️ = sources très partagées. Les Aniimo absents du wiki officiel apparaissent sous leur
          nom anglais. Relevé du {new Date(SOURCES[0]?.fetchedAt ?? Date.now()).toLocaleDateString('fr-FR')}.
        </p>
      </section>

      {open && <Detail entry={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Detail({ entry, onClose }: { entry: ConsensusEntry; onClose: () => void }) {
  const l = label(entry.id);
  const a = l.aniimo;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={l.name} onClick={onClose}>
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>
            {a ? fullName(a) : l.name} <span className="tier-badge" style={{ background: TIER_COLORS[entry.tier] }}>{entry.tier}</span>
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        <div className={`detail${a ? "" : " detail--noimg"}`}>
          {a ? <img className="detail__img" src={a.image} alt={fullName(a)} referrerPolicy="no-referrer" /> : null}
          <div className="detail__body">
            {a && (
              <>
                <p>
                  {a.elements.map((e) => `${ELEMENTS[e]?.icon ?? ''} ${ELEMENTS[e]?.name ?? e}`).join(' · ')}
                  {a.roles.length > 0 && ` — ${a.roles.map((r) => ROLES[r] ?? r).join(', ')}`}
                </p>
                <p className="muted">Capacités de logis :</p>
                <AbilityList levels={a.homeland} />
                {a.habitats.length > 0 && <p className="habitats">📍 {a.habitats.join(' · ')}</p>}
              </>
            )}
            {!a && <p className="hint">Absent du wiki officiel pour l'instant : pas encore d'image ni de nom français.</p>}
            <table className="roadmap">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Rang</th>
                </tr>
              </thead>
              <tbody>
                {entry.votes.map((v) => {
                  const s = SOURCE_BY_ID.get(v.source)!;
                  return (
                    <tr key={v.source}>
                      <td>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.source}
                        </a>
                      </td>
                      <td>
                        <b>{v.tier}</b> <span className="muted">/ {s.scale.join('·')}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="muted">Note moyenne : {Math.round(entry.score * 100)} / 100</p>
          </div>
        </div>
      </div>
    </div>
  );
}
