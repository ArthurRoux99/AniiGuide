import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import { useProfile, type ProfileApi } from './state/profile';
import { MonLogis } from './pages/MonLogis';
import { SolverGate } from './components/SolverGate';
import { ImportBanner } from './components/ImportBanner';

// Seule la page « Mon logis » est dans le fichier principal : les autres (et leurs données) se
// chargent à l'ouverture, puis restent en cache (hors ligne compris).
const page = <K extends string>(load: () => Promise<Record<K, ComponentType<{ api: ProfileApi }>>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const Aujourdhui = page(() => import('./pages/Aujourdhui'), 'Aujourdhui');
const PlanPage = page(() => import('./pages/Plan'), 'PlanPage');
const Recruter = page(() => import('./pages/Recruter'), 'Recruter');
const Combos = page(() => import('./pages/Combos'), 'Combos');
const Ouvriers = page(() => import('./pages/Ouvriers'), 'Ouvriers');
const Aniidex = page(() => import('./pages/Aniidex'), 'Aniidex');
const OuTrouver = page(() => import('./pages/OuTrouver'), 'OuTrouver');
const TierList = page(() => import('./pages/TierList'), 'TierList');
const Equipes = page(() => import('./pages/Equipes'), 'Equipes');
const Codes = page(() => import('./pages/Codes'), 'Codes');
const Oeufs = page(() => import('./pages/Oeufs'), 'Oeufs');
const Mesures = page(() => import('./pages/Mesures'), 'Mesures');

const PAGES = [
  { id: 'jour', label: "Aujourd'hui", icon: '☀️', Page: Aujourdhui },
  { id: 'logis', label: 'Mon logis', icon: '🏡', Page: MonLogis },
  { id: 'plan', label: 'Optimiser', icon: '📈', Page: PlanPage, solver: true },
  { id: 'recruter', label: 'Recruter', icon: '🎯', Page: Recruter, solver: true },
  { id: 'combos', label: 'Combos', icon: '🧩', Page: Combos },
  { id: 'ouvriers', label: 'Ouvriers', icon: '🐾', Page: Ouvriers },
  { id: 'aniidex', label: 'Aniidex', icon: '📖', Page: Aniidex },
  { id: 'carte', label: 'Où trouver', icon: '🗺️', Page: OuTrouver },
  { id: 'tier', label: 'Tier list', icon: '🏆', Page: TierList },
  { id: 'equipes', label: 'Équipes', icon: '⚔️', Page: Equipes },
  { id: 'oeufs', label: 'Opération Œufs', icon: '🥚', Page: Oeufs },
  { id: 'codes', label: 'Codes', icon: '🎁', Page: Codes },
  { id: 'mesures', label: 'Vérifier', icon: '⏱️', Page: Mesures, hidden: true },
] as const;
type PageId = (typeof PAGES)[number]['id'];

/** « #aniidex/005-basic-form » → page « aniidex » ; page par défaut : Aujourd'hui. */
const fromHash = (): PageId => {
  const id = location.hash.slice(1).split('/')[0];
  return PAGES.some((p) => p.id === id) ? (id as PageId) : 'jour';
};

export function App() {
  const api = useProfile();
  const [current, setCurrent] = useState<PageId>(fromHash);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const onHash = () => {
      setCurrent(fromHash());
      scrollTo({ top: 0 });
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    nav.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [current]);

  const p = PAGES.find((x) => x.id === current)!;
  const body = <p.Page api={api} />;
  return (
    <>
      <header className="topbar">
        <span className="brand">
          Anii<b>Guide</b>
        </span>
        <nav className="tabs" ref={nav}>
          {PAGES.filter((x) => !('hidden' in x) || current === x.id).map((x) => (
            <a key={x.id} href={`#${x.id}`} className={current === x.id ? 'is-active' : ''} aria-current={current === x.id ? 'page' : undefined}>
              <span aria-hidden>{x.icon}</span> {x.label}
            </a>
          ))}
        </nav>
      </header>
      <main>
        <ImportBanner api={api} />
        <Suspense fallback={<p className="loading">Chargement…</p>}>{'solver' in p ? <SolverGate>{body}</SolverGate> : body}</Suspense>
      </main>
      <footer className="footer">
        Projet de fans non officiel · Aniimo © Pawprint Studio / FunPlus · Images et noms : wiki officiel
      </footer>
    </>
  );
}
