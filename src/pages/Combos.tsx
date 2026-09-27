import { useState } from 'react';
import raw from '../data/combos.gen.json';
import type { ProfileApi } from '../state/profile';

interface Combo {
  code: string;
  server: string;
  rv: number;
  title: string;
  description: string;
  author?: string;
  added: string;
}
const COMBOS = (raw as { combos: Combo[] }).combos;
const SUBMIT = 'https://github.com/arthurroux99/AniiGuide/issues/new?template=combo.yml';

/** Bibliothèque de codes combo partagés par les joueurs, par serveur et par niveau. */
export function Combos({ api }: { api: ProfileApi }) {
  const rv = api.profile.rv;
  const servers = [...new Set(COMBOS.map((c) => c.server))].sort();
  const [server, setServer] = useState('');
  const [upTo, setUpTo] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const list = COMBOS.filter((c) => (!server || c.server === server) && (!upTo || c.rv <= rv)).sort((a, b) => b.rv - a.rv);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch {
      prompt('Copie ce code :', code);
    }
  };

  return (
    <div className="page">
      <section className="card">
        <h2>Codes combo du logis</h2>
        <p className="hint">
          Un combo enregistre un groupe d'éléments posés en mode Construire (2 à 500). Son code de 8 caractères s'importe via « Importer » et
          replace tout d'un coup.
        </p>
        <p className="hint">
          <b>Pourquoi AniiGuide ne fabrique pas de code ?</b> Le code n'est qu'un identifiant : le placement lui-même est gardé sur le serveur du
          jeu, et seul le jeu peut en créer. Un code inventé répond « Ce code de combo n'existe pas », et un vrai code ne marche que sur le
          serveur où il a été créé.
        </p>
        <p className="hint">
          À la place : la page <a href="#plan">Optimiser</a> donne le plan des zones climatiques (quelles cultures autour de quel appareil).
          Pose-le une fois, enregistre-le en combo et partage son code ici pour les joueurs de ton serveur.
        </p>
        <a className="btn btn--primary" href={SUBMIT} target="_blank" rel="noreferrer">
          Proposer un combo
        </a>
      </section>

      <section className="card">
        <div className="toolbar">
          <select value={server} onChange={(e) => setServer(e.target.value)} aria-label="Serveur">
            <option value="">Tous les serveurs</option>
            {servers.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label>
            <input type="checkbox" checked={upTo} onChange={(e) => setUpTo(e.target.checked)} /> Jusqu'à mon niveau ({rv})
          </label>
        </div>
        {list.length === 0 ? (
          <p className="muted">
            {COMBOS.length === 0
              ? 'La bibliothèque est encore vide : sois le premier à proposer ton combo !'
              : 'Aucun combo pour ce filtre.'}
          </p>
        ) : (
          <ul className="codes">
            {list.map((c) => (
              <li key={`${c.server}:${c.code}`} className="code">
                <div className="code__main">
                  <strong>{c.title}</strong>
                  <span className="badge">RV {c.rv}</span>
                  <span className="badge">{c.server}</span>
                </div>
                <div className="code__main">
                  <code className="code__text">{c.code}</code>
                  <button type="button" className="btn btn--primary" onClick={() => copy(c.code)}>
                    {copied === c.code ? 'Copié ✓' : 'Copier'}
                  </button>
                </div>
                <p className="muted">
                  {c.description}
                  {c.author && ` · par ${c.author}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
