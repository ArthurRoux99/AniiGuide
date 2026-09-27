import { useEffect, useMemo, useState } from 'react';
import { ANIIMO, ANIIMO_BY_ID, fullName, matches, type Aniimo } from '../data/aniimo';
import rawDetails from '../data/aniimo-details.gen.json';
import rawSources from '../data/tierlists.gen.json';
import { ABILITIES, type AbilityId } from '../engine/abilities';
import { effectiveness, ELEMENT_IDS } from '../engine/combat';
import { consensus, type TierSource } from '../engine/tierlist';
import type { ProfileApi } from '../state/profile';
import { AbilityList, Avatar } from '../components/ui';
import { ELEMENTS, ROLES } from './TierList';

interface Skill {
  name: string;
  description: string;
  icon: string;
}
interface EvoNode {
  name: string;
  icon: string;
  stage: number;
  variant: boolean;
  children: EvoNode[];
}
interface Details {
  description: string;
  stats: Record<'total' | 'hp' | 'physicalAttack' | 'magicAttack' | 'physicalDefense' | 'magicDefense' | 'haste', number>;
  weight: { min: number; max: number } | null;
  genders: string[];
  traits: Skill[];
  mobility: Skill[];
  evolution: EvoNode | null;
}
const DETAILS = rawDetails as unknown as Record<string, Details>;
const TIERS = new Map(consensus(rawSources as TierSource[], 1).map((e) => [e.id, e]));

const STATS: [keyof Details['stats'], string][] = [
  ['hp', 'PV'],
  ['physicalAttack', 'Attaque physique'],
  ['magicAttack', 'Attaque magique'],
  ['physicalDefense', 'Défense physique'],
  ['magicDefense', 'Défense magique'],
  ['haste', 'Vitesse'],
];
/** Valeur la plus haute de chaque stat, pour les barres. */
const STAT_MAX = Object.fromEntries(STATS.map(([k]) => [k, Math.max(...Object.values(DETAILS).map((d) => d.stats?.[k] ?? 0))]));

const idFromHash = () => {
  const id = decodeURIComponent(location.hash.split('/')[1] ?? '');
  return ANIIMO_BY_ID.has(id) ? id : null;
};

/** Aniidex : toutes les fiches officielles, en français, avec ce qui sert au logis et au combat. */
export function Aniidex({ api }: { api: ProfileApi }) {
  const [open, setOpen] = useState<string | null>(idFromHash);
  const [query, setQuery] = useState('');
  const [element, setElement] = useState('');
  const [ability, setAbility] = useState<AbilityId | ''>('');
  const [forms, setForms] = useState<'all' | 'base'>('base');

  useEffect(() => {
    const onHash = () => setOpen(idFromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (open) scrollTo({ top: 0 });
  }, [open]);

  const list = useMemo(
    () =>
      ANIIMO.filter(
        (a) => matches(a, query) && (!element || a.elements.includes(element)) && (!ability || a.homeland[ability]) && (forms === 'all' || !a.form || query),
      ),
    [query, element, ability, forms],
  );

  if (open) return <Sheet aniimo={ANIIMO_BY_ID.get(open)!} api={api} />;

  return (
    <div className="page">
      <section className="card">
        <h2>Aniidex</h2>
        <p className="hint">Les {ANIIMO.length} fiches du wiki officiel : stats, talents, évolutions, habitats, capacités de logis et faiblesses.</p>
        <div className="toolbar">
          <input type="search" placeholder="Rechercher (FR ou EN)" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={element} onChange={(e) => setElement(e.target.value)} aria-label="Élément">
            <option value="">Tous les éléments</option>
            {Object.entries(ELEMENTS).map(([id, e]) => (
              <option key={id} value={id}>
                {e.icon} {e.name}
              </option>
            ))}
          </select>
          <select value={ability} onChange={(e) => setAbility(e.target.value as AbilityId | '')} aria-label="Capacité de logis">
            <option value="">Toutes capacités</option>
            {ABILITIES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
          <select value={forms} onChange={(e) => setForms(e.target.value as 'all' | 'base')} aria-label="Formes">
            <option value="base">Formes de base</option>
            <option value="all">Toutes les formes</option>
          </select>
        </div>
      </section>
      <ul className="dex-grid">
        {list.map((a) => (
          <li key={a.id}>
            <a className="tier-tile" href={`#aniidex/${encodeURIComponent(a.id)}`}>
              <Avatar aniimo={a} size={56} />
              <span className="tier-tile__name">{a.name}</span>
              <small className="muted">
                n° {a.number} {a.elements.map((e) => ELEMENTS[e]?.icon).join('')}
              </small>
              {a.form && <small className="muted">{a.form.replace(/^Forme (de la |des |de |du )?/, '')}</small>}
            </a>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="card empty">Aucun Aniimo ne correspond.</p>}
    </div>
  );
}

function Sheet({ aniimo: a, api }: { aniimo: Aniimo; api: ProfileApi }) {
  const d = DETAILS[a.id];
  const tier = TIERS.get(a.id);
  const forms = ANIIMO.filter((x) => x.number === a.number);
  const workers = api.profile.workers.filter((w) => w.aniimoId === a.id).length;
  const owned = api.profile.collection.includes(a.id);
  const defense = ELEMENT_IDS.map((e) => ({ e, m: effectiveness(e, a.elements) })).filter((x) => Math.abs(x.m - 1) > 0.01);

  return (
    <div className="page">
      <a className="link" href="#aniidex">
        ← Aniidex
      </a>
      <section className="card sheet">
        <img className="sheet__img" src={a.image} alt={fullName(a)} referrerPolicy="no-referrer" />
        <div>
          <h2>
            {fullName(a)} <span className="muted">n° {a.number}</span>
          </h2>
          <p className="muted">
            {a.nameEn} · {a.elements.map((e) => `${ELEMENTS[e]?.icon} ${ELEMENTS[e]?.name}`).join(' · ')}
            {a.roles.length > 0 && ` · ${a.roles.map((r) => ROLES[r] ?? r).join(', ')}`}
            {tier && (
              <>
                {' · '}
                <a href="#tier" className="tier-badge tier-badge--sm">
                  {tier.tier}
                </a>
              </>
            )}
          </p>
          {d?.description && <p>{d.description}</p>}
          <div className="row">
            <button type="button" className="btn" onClick={() => api.addWorker(a.id)}>
              + Au logis {workers > 0 && `(${workers})`}
            </button>
            <button type="button" className="btn" onClick={() => (owned ? api.removeFromCollection(a.id) : api.addToCollection(a.id))}>
              {owned ? '✓ Dans ma collection' : '+ Collection de combat'}
            </button>
          </div>
        </div>
      </section>

      {forms.length > 1 && (
        <section className="card">
          <h2>Formes</h2>
          <div className="chips">
            {forms.map((f) => (
              <a key={f.id} className={`chip chip--btn${f.id === a.id ? ' is-active' : ''}`} href={`#aniidex/${encodeURIComponent(f.id)}`}>
                {f.form ? f.form.replace(/^Forme (de la |des |de |du )?/, '') : 'Base'}
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2>Logis</h2>
        {Object.keys(a.homeland).length ? <AbilityList levels={a.homeland} /> : <p className="muted">Aucune capacité de logis.</p>}
        {d?.mobility.length > 0 && (
          <>
            <h3>Exploration</h3>
            <SkillList skills={d.mobility} />
          </>
        )}
      </section>

      {d?.stats && (
        <section className="card">
          <h2>
            Stats <span className="muted">(total {d.stats.total})</span>
          </h2>
          <ul className="stat-bars">
            {STATS.map(([k, label]) => (
              <li key={k}>
                <span>{label}</span>
                <div className="bar">
                  <div className="bar__fill" style={{ width: `${(d.stats[k] / STAT_MAX[k]) * 100}%` }} />
                </div>
                <b>{d.stats[k]}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d?.traits.length > 0 && (
        <section className="card">
          <h2>Talents</h2>
          <SkillList skills={d.traits} />
        </section>
      )}

      <section className="card">
        <h2>En combat</h2>
        <p>
          Faible contre :{' '}
          <b>
            {defense
              .filter((x) => x.m > 1)
              .map((x) => `${ELEMENTS[x.e].icon} ${ELEMENTS[x.e].name} ×${x.m.toFixed(2).replace('.', ',')}`)
              .join(' · ') || '—'}
          </b>
        </p>
        <p className="muted">
          Résiste à :{' '}
          {defense
            .filter((x) => x.m < 1)
            .map((x) => `${ELEMENTS[x.e].icon} ${ELEMENTS[x.e].name} ×${x.m.toFixed(2).replace('.', ',')}`)
            .join(' · ') || '—'}
        </p>
      </section>

      {d?.evolution && (d.evolution.children.length > 0 || d.evolution.stage > 1) && (
        <section className="card">
          <h2>Évolutions</h2>
          <Evolution node={d.evolution} number={a.number} />
        </section>
      )}

      {(a.habitats.length > 0 || d?.weight) && (
        <section className="card">
          <h2>Où le trouver</h2>
          {a.habitats.length > 0 ? <p>📍 {a.habitats.join(' · ')}</p> : <p className="muted">Habitat non indiqué par le wiki.</p>}
          {d?.weight && (
            <p className="muted">
              Poids : {d.weight.min.toLocaleString('fr-FR')} à {d.weight.max.toLocaleString('fr-FR')} kg
              {d.genders.length === 1 && ` · ${d.genders[0] === 'male' ? 'mâle uniquement' : 'femelle uniquement'}`}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function SkillList({ skills }: { skills: Skill[] }) {
  return (
    <ul className="skills">
      {skills.map((s) => (
        <li key={s.name}>
          <img src={s.icon} alt="" width={36} height={36} referrerPolicy="no-referrer" loading="lazy" />
          <div>
            <strong>{s.name}</strong>
            <p className="muted">{s.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Chaîne d'évolution : chaque étape renvoie vers sa fiche quand on la retrouve. */
function Evolution({ node, number }: { node: EvoNode; number: string }) {
  const target = ANIIMO.find((x) => x.name === node.name && !x.form) ?? ANIIMO.find((x) => x.name === node.name);
  const label = (
    <>
      <img src={node.icon} alt="" width={48} height={48} referrerPolicy="no-referrer" loading="lazy" />
      <span>{node.name}</span>
    </>
  );
  return (
    <div className="evo">
      {target ? (
        <a className={`evo__node${target.number === number && target.name === node.name ? ' is-active' : ''}`} href={`#aniidex/${encodeURIComponent(target.id)}`}>
          {label}
        </a>
      ) : (
        <span className="evo__node">{label}</span>
      )}
      {node.children.length > 0 && (
        <div className="evo__children">
          {node.children.map((c) => (
            <div key={c.name} className="evo__step">
              <span className="evo__arrow" aria-hidden>
                →
              </span>
              <Evolution node={c} number={number} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
