import { useMemo, useState } from 'react';
import { ANIIMO, fullName, levelOf, matches } from '../data/aniimo';
import { ABILITIES, type AbilityId } from '../engine/abilities';
import { AbilityList, Avatar } from './ui';

/** Fenêtre de choix d'un Aniimo : recherche par nom (FR ou EN) et filtre par capacité. */
export function AniimoPicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [ability, setAbility] = useState<AbilityId | ''>('');
  const list = useMemo(
    () => ANIIMO.filter((a) => matches(a, query) && (!ability || levelOf(a, ability) > 0)).slice(0, 80),
    [query, ability],
  );

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Ajouter un Aniimo" onClick={onClose}>
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Ajouter un Aniimo</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        <div className="toolbar">
          <input autoFocus type="search" placeholder="Nom (Magmarex, Turbo…)" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={ability} onChange={(e) => setAbility(e.target.value as AbilityId | '')}>
            <option value="">Toutes capacités</option>
            {ABILITIES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
        </div>
        <p className="hint">La forme compte : choisis celle de ton Aniimo (plages, neiges, prismana…), ses capacités changent.</p>
        <ul className="pick-list">
          {list.map((a) => (
            <li key={a.id}>
              <button type="button" className="pick-row" onClick={() => onPick(a.id)}>
                <Avatar aniimo={a} size={48} />
                <span className="pick-row__text">
                  <strong>{fullName(a)}</strong>
                  <AbilityList levels={a.homeland} />
                </span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="empty">Aucun Aniimo ne correspond.</li>}
        </ul>
      </div>
    </div>
  );
}
