import { ABILITIES, ABILITY_BY_ID, type AbilityId, type AbilityLevels } from '../engine/abilities';
import { fullName, type Aniimo } from '../data/aniimo';

export function AbilityChip({ id, level, dim }: { id: AbilityId; level?: number; dim?: boolean }) {
  const a = ABILITY_BY_ID[id];
  return (
    <span className={`chip${dim ? ' chip--dim' : ''}`} style={{ '--c': a.color } as React.CSSProperties} title={`${a.name} — ${a.role}`}>
      <span aria-hidden>{a.icon}</span>
      <span className="chip__name">{a.name}</span>
      {level != null && <b>{level}</b>}
    </span>
  );
}

export function AbilityList({ levels }: { levels: AbilityLevels }) {
  const ids = ABILITIES.map((a) => a.id).filter((id) => levels[id]);
  return (
    <div className="chips">
      {ids.map((id) => (
        <AbilityChip key={id} id={id} level={levels[id]} />
      ))}
    </div>
  );
}

export function Avatar({ aniimo, size = 64 }: { aniimo: Aniimo; size?: number }) {
  return (
    <img
      className="avatar"
      src={aniimo.head ?? aniimo.image}
      alt={fullName(aniimo)}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

export function Badge({ kind, children }: { kind: 'officiel' | 'communaute' | 'a-verifier'; children?: React.ReactNode }) {
  const label = { officiel: '✅ vu en jeu', communaute: '🟡 communauté', 'a-verifier': '❓ à vérifier' }[kind];
  return <span className={`badge badge--${kind}`}>{children ?? label}</span>;
}

/** Barre « Distribution des capacités », comme l'écran du jeu. */
export function Distribution({ counts, onPick, active }: { counts: Record<AbilityId, number>; onPick?: (id: AbilityId) => void; active?: AbilityId | null }) {
  return (
    <div className="distribution">
      {ABILITIES.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`distribution__cell${counts[a.id] === 0 ? ' is-zero' : ''}${active === a.id ? ' is-active' : ''}`}
          style={{ '--c': a.color } as React.CSSProperties}
          onClick={onPick ? () => onPick(a.id) : undefined}
          title={`${a.name} — ${a.role}`}
        >
          <span className="distribution__icon" aria-hidden>
            {a.icon}
          </span>
          <span className="distribution__count">{counts[a.id]}</span>
          <span className="distribution__label">{a.name}</span>
        </button>
      ))}
    </div>
  );
}
