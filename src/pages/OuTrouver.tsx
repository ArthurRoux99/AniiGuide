import { useMemo, useState } from 'react';
import { ANIIMO, ANIIMO_BY_ID, fullName, matches, type Aniimo } from '../data/aniimo';
import { ABILITY_BY_ID } from '../engine/abilities';
import { findGaps } from '../engine/roster';
import type { ProfileApi } from '../state/profile';
import { AbilityList, Avatar } from '../components/ui';

const MAPS = [
  { name: 'questlog.gg', url: 'https://questlog.gg/aniimo/en/map', about: 'apparitions, Alphas, coffres, téléporteurs' },
  { name: 'Game8', url: 'https://game8.co/games/Aniimo/archives/618730', about: 'régions, collectibles, Aniipods' },
  { name: 'AniimoTools', url: 'https://aniimotools.dev/map/', about: 'régions d’Idyll, carte des apparitions' },
  { name: 'aniimo.th.gl', url: 'https://aniimo.th.gl/', about: 'Lumin Amber, sanctuaires, Alpha et Omega' },
];

/** Zones du jeu (habitats du wiki officiel) → Aniimo qu'on y trouve. */
const ZONES: [string, Aniimo[]][] = (() => {
  const m = new Map<string, Aniimo[]>();
  for (const a of ANIIMO) for (const h of a.habitats) m.set(h, [...(m.get(h) ?? []), a]);
  return [...m].sort((x, y) => x[0].localeCompare(y[0], 'fr'));
})();

/**
 * Où trouver : les zones où chercher les Aniimo qui manquent au logis, puis toutes les zones.
 * Les positions exactes sont sur les cartes interactives de la communauté (liens).
 */
export function OuTrouver({ api }: { api: ProfileApi }) {
  const { profile } = api;
  const [query, setQuery] = useState('');
  const owned = useMemo(() => new Set([...profile.workers.map((w) => w.aniimoId), ...profile.collection]), [profile.workers, profile.collection]);

  // Recrues utiles (capacités qui manquent au logis, hors prismana), regroupées par zone.
  const route = useMemo(() => {
    const gaps = findGaps(
      profile.workers.map((w) => ANIIMO_BY_ID.get(w.aniimoId)!.homeland),
      ANIIMO.filter((a) => !a.prismana && a.habitats.length && !owned.has(a.id)),
      3,
      6,
    );
    const why = new Map<string, string[]>();
    for (const g of gaps) for (const s of g.suggestions) why.set(s.id, [...(why.get(s.id) ?? []), ABILITY_BY_ID[g.ability].name]);
    const byZone = new Map<string, Aniimo[]>();
    for (const id of why.keys()) for (const h of ANIIMO_BY_ID.get(id)!.habitats) byZone.set(h, [...(byZone.get(h) ?? []), ANIIMO_BY_ID.get(id)!]);
    return { why, zones: [...byZone].sort((a, b) => b[1].length - a[1].length).slice(0, 5) };
  }, [profile.workers, owned]);

  const found = query ? ANIIMO.filter((a) => matches(a, query)).slice(0, 12) : [];

  return (
    <div className="page">
      <section className="card">
        <h2>Où trouver</h2>
        <p className="hint">Les zones où vit chaque Aniimo, d'après le wiki officiel.</p>
        <input type="search" placeholder="Chercher un Aniimo (FR ou EN)" value={query} onChange={(e) => setQuery(e.target.value)} />
        {found.length > 0 && (
          <ul className="pick-list">
            {found.map((a) => (
              <li key={a.id} className="pick-row">
                <Avatar aniimo={a} size={48} />
                <span className="pick-row__text">
                  <a href={`#aniidex/${encodeURIComponent(a.id)}`}>
                    <strong>{fullName(a)}</strong>
                  </a>
                  <span>{a.habitats.length ? `📍 ${a.habitats.join(' · ')}` : <span className="muted">Zone non indiquée (évolution ou événement)</span>}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {route.zones.length > 0 && (
        <section className="card">
          <h2>Pour compléter ton logis</h2>
          <p className="hint">
            Les zones qui regroupent le plus d'Aniimo utiles à ton logis (capacités qui te manquent ou trop faibles). Pour l'équipe complète,
            vois <a href="#recruter">Recruter</a>.
          </p>
          {route.zones.map(([zone, list]) => (
            <div key={zone} className="zone-route">
              <h3>📍 {zone}</h3>
              <ul className="plain">
                {list.map((a) => (
                  <li key={a.id}>
                    <a href={`#aniidex/${encodeURIComponent(a.id)}`}>{fullName(a)}</a> <AbilityList levels={a.homeland} />{' '}
                    <span className="muted">pour {route.why.get(a.id)!.join(', ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2>Toutes les zones</h2>
        {ZONES.map(([zone, list]) => (
          <details key={zone} className="zone-all">
            <summary>
              <strong>{zone}</strong> <span className="muted">({list.length} Aniimo, {list.filter((a) => owned.has(a.id)).length} à toi)</span>
            </summary>
            <ul className="tier-row__items">
              {list.map((a) => (
                <li key={a.id}>
                  <a className={`tier-tile${owned.has(a.id) ? ' tile--owned' : ''}`} href={`#aniidex/${encodeURIComponent(a.id)}`}>
                    <Avatar aniimo={a} size={48} />
                    <span className="tier-tile__name">{a.name}</span>
                    {a.form && <small className="muted">{a.form.replace(/^Forme (de la |des |de |du )?/, '')}</small>}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>

      <section className="card">
        <h2>Cartes interactives</h2>
        <p className="hint">Pour la position exacte des apparitions, des coffres et des téléporteurs, les cartes de la communauté (en anglais) :</p>
        <ul className="plain">
          {MAPS.map((m) => (
            <li key={m.url}>
              <a href={m.url} target="_blank" rel="noreferrer">
                {m.name}
              </a>{' '}
              <span className="muted">— {m.about}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
