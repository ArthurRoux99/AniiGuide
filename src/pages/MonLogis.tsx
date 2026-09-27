import { useMemo, useRef, useState } from 'react';
import { ANIIMO, ANIIMO_BY_ID, fullName } from '../data/aniimo';
import { ABILITY_BY_ID, abilityDistribution, type AbilityId } from '../engine/abilities';
import { parsePersonality } from '../engine/personality';
import { findGaps } from '../engine/roster';
import { maxAniimo } from '../engine/rv';
import { exampleProfile, sanitizeProfile, type ProfileApi, type Worker } from '../state/profile';
import { AniimoPicker } from '../components/AniimoPicker';
import { AbilityList, Avatar, Badge, Distribution } from '../components/ui';
import { SyncCard } from '../components/SyncCard';

export function MonLogis({ api }: { api: ProfileApi }) {
  const { profile } = api;
  const [picking, setPicking] = useState(false);
  const [filter, setFilter] = useState<AbilityId | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const levels = useMemo(() => profile.workers.map((w) => ANIIMO_BY_ID.get(w.aniimoId)!.homeland), [profile.workers]);
  const gaps = useMemo(() => findGaps(levels, ANIIMO), [levels]);
  const counts = abilityDistribution(levels);
  const cap = maxAniimo(profile.rv);
  const used = profile.workers.length + profile.shinies;
  const shown = filter ? profile.workers.filter((w) => ANIIMO_BY_ID.get(w.aniimoId)!.homeland[filter]) : profile.workers;
  const missingPersonality = profile.workers.filter((w) => !w.personality).length;

  const exportProfile = () => {
    const blob = new Blob([JSON.stringify(profile, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aniiguide-logis-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importProfile = async (file: File) => {
    try {
      api.replace(sanitizeProfile(JSON.parse(await file.text())));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import impossible.');
    }
  };

  return (
    <div className="page">
      <section className="card hero">
        <div className="hero__stats">
          <label className="stat">
            <span>Camping-car</span>
            <select value={profile.rv} onChange={(e) => api.setRv(Number(e.target.value))}>
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  niv. {n}
                </option>
              ))}
            </select>
          </label>
          <div className="stat">
            <span>Aniimo au logis</span>
            <strong className={used > cap.value ? 'over' : ''}>
              {used}/{cap.value}
            </strong>
            <Badge kind={cap.confidence} />
          </div>
          <label className="stat">
            <span>Éclatants (zone de construction)</span>
            <input type="number" min={0} value={profile.shinies} onChange={(e) => api.setShinies(Number(e.target.value))} />
          </label>
        </div>
        {profile.shinies > 0 && (
          <p className="hint">
            Les éclatants produisent des Tickets bourgeon (décorations) mais occupent chacun une place d'ouvrier.
          </p>
        )}
      </section>

      <section className="card">
        <div className="card__head">
          <h2>Distribution des capacités</h2>
          {filter && (
            <button type="button" className="link" onClick={() => setFilter(null)}>
              Tout afficher
            </button>
          )}
        </div>
        <Distribution counts={counts} active={filter} onPick={(id) => setFilter(filter === id ? null : id)} />
      </section>

      <section className="card">
        <div className="card__head">
          <h2>
            Mes ouvriers <small>({profile.workers.length})</small>
          </h2>
          <button type="button" className="btn btn--primary" onClick={() => setPicking(true)}>
            + Ajouter
          </button>
        </div>
        {missingPersonality > 0 && profile.workers.length > 0 && (
          <p className="hint">
            {missingPersonality} ouvrier{missingPersonality > 1 ? 's' : ''} sans personnalité : saisis les 4 lettres (ex. ENTP) visibles sur
            leur fiche, elles donnent +20 % dans certaines installations.
          </p>
        )}
        {profile.workers.length === 0 ? (
          <div className="empty">
            <p>Aucun ouvrier pour l'instant.</p>
            <button type="button" className="btn" onClick={() => api.replace(exampleProfile())}>
              Charger l'exemple (logis RV 8)
            </button>
          </div>
        ) : (
          <ul className="workers">
            {shown.map((w) => (
              <WorkerCard key={w.uid} worker={w} api={api} />
            ))}
          </ul>
        )}
      </section>

      {gaps.length > 0 && profile.workers.length > 0 && (
        <section className="card">
          <h2>Capacités à renforcer</h2>
          <p className="hint">Capacités absentes ou sous le niveau 3, et les Aniimo qui les apportent (formes de base d'abord).</p>
          <ul className="gaps">
            {gaps.map((g) => (
              <li key={g.ability} className="gap">
                <div className="gap__title">
                  <span style={{ color: ABILITY_BY_ID[g.ability].color }}>{ABILITY_BY_ID[g.ability].icon}</span>
                  <strong>{ABILITY_BY_ID[g.ability].name}</strong>
                  <span className="muted">{g.count === 0 ? 'aucun ouvrier' : `max niv. ${g.best} (${g.count} ouvrier${g.count > 1 ? 's' : ''})`}</span>
                </div>
                <div className="gap__suggestions">
                  {g.suggestions.map((s) => {
                    const a = ANIIMO_BY_ID.get(s.id)!;
                    return (
                      <div key={s.id} className="mini" title={a.habitats.length ? `Habitats : ${a.habitats.join(', ')}` : undefined}>
                        <Avatar aniimo={a} size={40} />
                        <span>
                          {fullName(a)} <b>niv. {a.homeland[g.ability]}</b>
                          {a.habitats.length > 0 && <small className="muted"> · {a.habitats.slice(0, 2).join(', ')}</small>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Sauvegarde</h2>
        <p className="hint">Ton logis est enregistré dans ce navigateur. Pour le passer de l'iPhone au PC (ou l'inverse), utilise la synchro par QR code ou un fichier.</p>
        <SyncCard profile={profile} />
        <div className="row">
          <button type="button" className="btn" onClick={exportProfile}>
            Exporter
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            Importer
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importProfile(e.target.files[0])} />
        </div>
      </section>

      {picking && (
        <AniimoPicker
          onClose={() => setPicking(false)}
          onPick={(id) => {
            api.addWorker(id);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function WorkerCard({ worker, api }: { worker: Worker; api: ProfileApi }) {
  const a = ANIIMO_BY_ID.get(worker.aniimoId)!;
  const [draft, setDraft] = useState(worker.personality ?? '');
  const valid = draft === '' || parsePersonality(draft) !== null;

  return (
    <li className="worker">
      <Avatar aniimo={a} size={56} />
      <div className="worker__body">
        <strong>{a.name}</strong>
        {a.form && <small className="muted">{a.form}</small>}
        <AbilityList levels={a.homeland} />
      </div>
      <div className="worker__side">
        <input
          className={`personality${valid ? '' : ' invalid'}`}
          aria-label={`Personnalité de ${a.name}`}
          placeholder="····"
          title="4 lettres de personnalité, ex. ENTP"
          maxLength={7}
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          onBlur={() => {
            const p = draft ? parsePersonality(draft) : null;
            if (p || !draft) api.setPersonality(worker.uid, p);
            setDraft(p ?? draft);
          }}
        />
        <button type="button" className="icon-btn" aria-label={`Retirer ${a.name}`} onClick={() => api.removeWorker(worker.uid)}>
          ✕
        </button>
      </div>
    </li>
  );
}
