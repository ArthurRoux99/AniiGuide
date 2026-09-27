import { useMemo, useState } from 'react';
import { ANIIMO, ANIIMO_BY_ID, fullName } from '../data/aniimo';
import rawSources from '../data/tierlists.gen.json';
import { bestOffense, bestTeams, effectiveness, ELEMENT_IDS, type Fighter, type Team } from '../engine/combat';
import { consensus, tierOf, type TierSource } from '../engine/tierlist';
import type { ProfileApi } from '../state/profile';
import { AniimoPicker } from '../components/AniimoPicker';
import { Avatar } from '../components/ui';
import { ELEMENTS, ROLES } from './TierList';

const CONSENSUS = consensus(rawSources as TierSource[], 1);
const RANKED = new Map(CONSENSUS.map((e) => [e.id, e.score]));
const TOTALS = ANIIMO.map((a) => a.statTotal ?? 0).filter(Boolean);
const [MIN_TOTAL, MAX_TOTAL] = [Math.min(...TOTALS), Math.max(...TOTALS)];
/**
 * Note d'un Aniimo : celle de la tier list de consensus, sinon une note prudente tirée du total de
 * ses stats (0,15 à 0,45 : en dessous de la plupart des Aniimo classés).
 */
const scoreOf = (a: (typeof ANIIMO)[number]) =>
  RANKED.get(a.id) ?? (a.statTotal ? 0.15 + (0.3 * (a.statTotal - MIN_TOTAL)) / Math.max(1, MAX_TOTAL - MIN_TOTAL) : 0.15);

/** Constructeur d'équipes de combat : 4 Aniimo, rôles couverts, ennemi visé. */
export function Equipes({ api }: { api: ProfileApi }) {
  const { profile } = api;
  const [enemy, setEnemy] = useState<string[]>([]);
  const [mine, setMine] = useState(profile.collection.length > 0);
  const [prismana, setPrismana] = useState(false);
  const [locked, setLocked] = useState<string[]>([]);
  const [picking, setPicking] = useState<'collection' | 'lock' | null>(null);

  const pool = useMemo(() => {
    const owned = new Set([...profile.collection, ...profile.workers.map((w) => w.aniimoId)]);
    return ANIIMO.flatMap((a): Fighter[] => {
      if (!a.roles.length) return [];
      if (!prismana && a.prismana && !locked.includes(a.id)) return [];
      if (mine && !owned.has(a.id) && !locked.includes(a.id)) return [];
      return [{ id: a.id, species: a.number, elements: a.elements, roles: a.roles, score: scoreOf(a) }];
    });
  }, [profile.collection, profile.workers, mine, prismana, locked]);

  const teams = useMemo(() => bestTeams(pool, { enemy, locked }), [pool, enemy, locked]);
  const toggleEnemy = (e: string) => setEnemy((cur) => (cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e].slice(-2)));

  return (
    <div className="page">
      <section className="card">
        <h2>Équipes de combat</h2>
        <p className="hint">
          Une équipe compte 4 Aniimo : un attaquant, de la rupture, du soutien ou du soin, et de l'énergie. Le calcul part de la tier list de
          consensus et, si tu choisis l'ennemi, de la table des éléments (×1,6 sur une faiblesse, ×0,625 sur une résistance).
        </p>
        <div className="stat">
          <span>Élément de l'ennemi (jusqu'à 2)</span>
          <div className="chips enemy-picker">
            {ELEMENT_IDS.map((e) => (
              <button key={e} type="button" className={`chip chip--btn${enemy.includes(e) ? ' is-active' : ''}`} onClick={() => toggleEnemy(e)}>
                {ELEMENTS[e].icon} {ELEMENTS[e].name}
              </button>
            ))}
            {enemy.length > 0 && (
              <button type="button" className="link" onClick={() => setEnemy([])}>
                Aucun
              </button>
            )}
          </div>
        </div>
        {enemy.length > 0 && <Counters enemy={enemy} />}
        <div className="row toggles">
          <label>
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Seulement mes Aniimo ({profile.collection.length + profile.workers.length})
          </label>
          <label>
            <input type="checkbox" checked={prismana} onChange={(e) => setPrismana(e.target.checked)} /> Formes prismana
          </label>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => setPicking('lock')}>
            + Imposer un Aniimo
          </button>
          <button type="button" className="btn" onClick={() => setPicking('collection')}>
            + Ajouter à ma collection
          </button>
        </div>
        {locked.length > 0 && (
          <p className="hint">
            Imposés :{' '}
            {locked.map((id) => (
              <button key={id} type="button" className="chip chip--btn" onClick={() => setLocked(locked.filter((x) => x !== id))}>
                {fullName(ANIIMO_BY_ID.get(id)!)} ✕
              </button>
            ))}
          </p>
        )}
      </section>

      {teams.length === 0 ? (
        <section className="card empty">
          <p>Pas assez d'Aniimo classés pour former une équipe. Ajoute des Aniimo à ta collection ou décoche « Seulement mes Aniimo ».</p>
        </section>
      ) : (
        teams.map((t, i) => <TeamCard key={i} team={t} rank={i + 1} enemy={enemy} />)
      )}

      <Collection api={api} />

      {picking && (
        <AniimoPicker
          onClose={() => setPicking(null)}
          onPick={(id) => {
            if (picking === 'lock') setLocked((l) => (l.includes(id) || l.length >= 4 ? l : [...l, id]));
            else api.addToCollection(id);
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

/** Quels éléments frappent l'ennemi sur sa faiblesse, lesquels il encaisse bien. */
function Counters({ enemy }: { enemy: string[] }) {
  const strong = ELEMENT_IDS.filter((e) => effectiveness(e, enemy) > 1.01);
  const weak = ELEMENT_IDS.filter((e) => effectiveness(e, enemy) < 0.99);
  const name = (e: string) => `${ELEMENTS[e].icon} ${ELEMENTS[e].name}`;
  return (
    <p className="hint">
      Efficace : <b>{strong.map(name).join(', ') || '—'}</b> · À éviter : {weak.map(name).join(', ') || '—'}
    </p>
  );
}

function TeamCard({ team, rank, enemy }: { team: Team; rank: number; enemy: string[] }) {
  return (
    <section className="card">
      <div className="card__head">
        <h2>Équipe {rank}</h2>
        {team.missing.length > 0 && <span className="badge">manque : {team.missing.map((r) => ROLES[r]).join(', ')}</span>}
      </div>
      <ul className="fighters">
        {team.members.map((m) => {
          const a = ANIIMO_BY_ID.get(m.id)!;
          const mult = enemy.length ? bestOffense(m.elements, enemy) : null;
          return (
            <li key={m.id} className="fighter">
              <Avatar aniimo={a} size={64} />
              <div>
                <strong>{fullName(a)}</strong>
                <div className="muted">
                  {m.roles.map((r) => ROLES[r] ?? r).join(', ')} · {m.elements.map((e) => ELEMENTS[e]?.icon ?? e).join('')}
                </div>
                <div>
                  {RANKED.has(m.id) ? (
                    <span className="tier-badge tier-badge--sm">{tierOf(m.score)}</span>
                  ) : (
                    <span className="muted" title="Absent des tier lists : note estimée d'après ses stats">non classé</span>
                  )}
                  {mult != null && Math.abs(mult - 1) > 0.01 && (
                    <span className={mult > 1 ? 'good' : 'bad'}> ×{mult.toFixed(2).replace('.', ',')} sur l'ennemi</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {team.threats.length > 0 && (
        <p className="hint">
          Point faible : {team.threats.map((e) => `${ELEMENTS[e].icon} ${ELEMENTS[e].name}`).join(', ')} touche au moins deux membres sur leur faiblesse.
        </p>
      )}
    </section>
  );
}

function Collection({ api }: { api: ProfileApi }) {
  const { collection, workers } = api.profile;
  return (
    <section className="card">
      <h2>Ma collection de combat</h2>
      <p className="hint">
        Les Aniimo que tu possèdes pour combattre. Tes ouvriers du logis comptent aussi ({workers.length}), mais un Aniimo au travail ne peut pas
        combattre en même temps : il faudra le retirer du logis ou en avoir un deuxième.
      </p>
      {collection.length === 0 ? (
        <p className="muted">Collection vide : utilise « Ajouter à ma collection ».</p>
      ) : (
        <div className="chips">
          {collection.map((id) => (
            <button key={id} type="button" className="chip chip--btn" onClick={() => api.removeFromCollection(id)} title="Retirer">
              {fullName(ANIIMO_BY_ID.get(id)!)} ✕
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
