import { useMemo, useState } from 'react';
import { ANIIMO, OFFICIAL_FETCHED_AT, levelOf, matches } from '../data/aniimo';
import { ABILITIES, type AbilityId } from '../engine/abilities';
import type { ProfileApi } from '../state/profile';
import { AbilityList, Avatar } from '../components/ui';

type Forms = 'toutes' | 'sans-prismana' | 'base';

/** Encyclopédie des ouvriers : tous les Aniimo et leurs capacités de logis (wiki officiel). */
export function Ouvriers({ api }: { api: ProfileApi }) {
  const { profile } = api;
  const [query, setQuery] = useState('');
  const [ability, setAbility] = useState<AbilityId | ''>('');
  const [minLevel, setMinLevel] = useState(1);
  const [forms, setForms] = useState<Forms>('sans-prismana');
  const owned = useMemo(() => new Set(profile.workers.map((w) => w.aniimoId)), [profile.workers]);

  const list = useMemo(() => {
    const out = ANIIMO.filter(
      (a) =>
        matches(a, query) &&
        (!ability || levelOf(a, ability) >= minLevel) &&
        (forms === 'toutes' || (forms === 'base' ? !a.form : !a.prismana)),
    );
    return ability ? [...out].sort((x, y) => levelOf(y, ability) - levelOf(x, ability)) : out;
  }, [query, ability, minLevel, forms]);

  return (
    <div className="page">
      <section className="card">
        <h2>Aniimo ouvriers</h2>
        <p className="hint">
          Capacités de logis de chaque Aniimo et de chacune de ses formes, d'après le wiki officiel (relevé du{' '}
          {new Date(OFFICIAL_FETCHED_AT).toLocaleDateString('fr-FR')}). Le niveau 4 n'existe que sur les formes prismana.
        </p>
        <div className="toolbar">
          <input type="search" placeholder="Rechercher un Aniimo" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={ability} onChange={(e) => setAbility(e.target.value as AbilityId | '')} aria-label="Capacité">
            <option value="">Toutes capacités</option>
            {ABILITIES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
          {ability && (
            <select value={minLevel} onChange={(e) => setMinLevel(Number(e.target.value))} aria-label="Niveau minimum">
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  niv. ≥ {n}
                </option>
              ))}
            </select>
          )}
          <select value={forms} onChange={(e) => setForms(e.target.value as Forms)} aria-label="Formes">
            <option value="sans-prismana">Sans prismana</option>
            <option value="toutes">Toutes les formes</option>
            <option value="base">Formes de base</option>
          </select>
        </div>
        <p className="muted">{list.length} résultat{list.length > 1 ? 's' : ''}</p>
      </section>

      <ul className="grid">
        {list.map((a) => (
          <li key={a.id} className={`tile${owned.has(a.id) ? ' tile--owned' : ''}`}>
            <Avatar aniimo={a} size={72} />
            <strong>{a.name}</strong>
            <small className="muted">{a.form ?? 'Forme de base'}</small>
            <AbilityList levels={a.homeland} />
            {owned.has(a.id) && <span className="owned">Dans mon logis</span>}
            {a.habitats.length > 0 && <small className="habitats">📍 {a.habitats.join(' · ')}</small>}
          </li>
        ))}
      </ul>
    </div>
  );
}
