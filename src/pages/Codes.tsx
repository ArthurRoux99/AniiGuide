import { useState } from 'react';
import raw from '../data/codes.gen.json';
import type { ProfileApi } from '../state/profile';

interface Code {
  code: string;
  rewards: { qty: number; item: string }[];
  note: string | null;
  added: string | null;
  sources: string[];
}
const DATA = raw as { fetchedAt: string; sources: { name: string; url: string }[]; active: Code[]; expired: Code[] };

/** Noms français des récompenses quand on les connaît ; sinon le nom anglais est gardé. */
const ITEMS: Record<string, string> = { Credits: 'Crédits', 'Aniipod Pro': 'Aniipod pro' };
const NOTES: Record<string, string> = { 'US only': 'États-Unis seulement' };

const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const fmtQty = (n: number) => n.toLocaleString('fr-FR');

/** Codes cadeaux : liste relevée chaque jour, copie en un geste, cases « déjà utilisé » gardées dans le profil. */
export function Codes({ api }: { api: ProfileApi }) {
  const used = new Set(api.profile.usedCodes);
  const [copied, setCopied] = useState<string | null>(null);
  const [showUsed, setShowUsed] = useState(false);
  const todo = DATA.active.filter((c) => !used.has(c.code.toLowerCase()));
  const done = DATA.active.filter((c) => used.has(c.code.toLowerCase()));

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch {
      prompt('Copie ce code :', code);
    }
  };

  const row = (c: Code) => {
    const isUsed = used.has(c.code.toLowerCase());
    return (
      <li key={c.code} className={`code${isUsed ? ' code--used' : ''}`}>
        <div className="code__main">
          <code className="code__text">{c.code}</code>
          <button type="button" className="btn btn--primary" onClick={() => copy(c.code)}>
            {copied === c.code ? 'Copié ✓' : 'Copier'}
          </button>
          <label className="code__used">
            <input type="checkbox" checked={isUsed} onChange={() => api.toggleCode(c.code)} /> utilisé
          </label>
        </div>
        <div className="muted">
          {c.rewards.length ? c.rewards.map((r) => `${fmtQty(r.qty)} ${ITEMS[r.item] ?? r.item}`).join(' · ') : 'Récompenses non précisées'}
          {c.added && ` · ajouté le ${fmtDate(c.added)}`}
          {c.note && (
            <>
              {' · '}
              <span className="badge">{NOTES[c.note] ?? c.note}</span>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="page">
      <section className="card">
        <div className="card__head">
          <h2>Codes cadeaux</h2>
          <span className="badge">{todo.length} à utiliser</span>
        </div>
        <ol className="steps">
          <li>
            En jeu, ouvre les <b>Paramètres</b> (roue dentée), onglet <b>Compte</b>, puis <b>Gift Code Redemption</b> (échange de code cadeau).
          </li>
          <li>Colle le code : les majuscules comptent, mieux vaut copier que retaper.</li>
          <li>
            La récompense arrive dans ta <b>boîte aux lettres</b> : pense à la réclamer.
          </li>
        </ol>
        <p className="hint">
          Coche « utilisé » pour ranger un code : c'est gardé sur cet appareil, avec ton profil. Un message « Redemption Limit Reached » veut dire
          que le code est déjà utilisé sur ton compte ou épuisé.
        </p>
      </section>

      <section className="card">
        {todo.length ? <ul className="codes">{todo.map(row)}</ul> : <p className="muted">Tu as utilisé tous les codes connus. 🎉</p>}
        {done.length > 0 && (
          <>
            <button type="button" className="link" onClick={() => setShowUsed(!showUsed)}>
              {showUsed ? 'Masquer' : 'Afficher'} les {done.length} codes déjà utilisés
            </button>
            {showUsed && <ul className="codes">{done.map(row)}</ul>}
          </>
        )}
      </section>

      {DATA.expired.length > 0 && (
        <section className="card">
          <h2>Codes expirés</h2>
          <p className="muted">{DATA.expired.map((c) => c.code).join(' · ')}</p>
        </section>
      )}

      <section className="card">
        <p className="hint">
          Liste recoupée entre{' '}
          {DATA.sources.map((s, i) => (
            <span key={s.name}>
              {i > 0 && ' et '}
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.name}
              </a>
            </span>
          ))}
          , relevée le {new Date(DATA.fetchedAt).toLocaleDateString('fr-FR')}. Les codes sont liés au serveur du jeu : AniiGuide ne peut ni en
          créer ni en vérifier la validité, seulement relayer ceux qui sont publiés.
        </p>
      </section>
    </div>
  );
}
