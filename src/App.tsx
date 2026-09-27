import { lazy, Suspense, useEffect, useState } from 'react';
import { useProfile } from './state/profile';
import { MonLogis } from './pages/MonLogis';
import { Ouvriers } from './pages/Ouvriers';
import { SolverGate } from './components/SolverGate';

// Les pages de calcul (et le solveur qu'elles utilisent) ne sont chargées qu'à l'ouverture.
const PlanPage = lazy(() => import('./pages/Plan').then((m) => ({ default: m.PlanPage })));
const Recruter = lazy(() => import('./pages/Recruter').then((m) => ({ default: m.Recruter })));
import { TierList } from './pages/TierList';
import { Equipes } from './pages/Equipes';
import { Codes } from './pages/Codes';
import { Combos } from './pages/Combos';

const PAGES = [
  { id: 'logis', label: 'Mon logis', icon: '🏡' },
  { id: 'plan', label: 'Optimiser', icon: '📈' },
  { id: 'recruter', label: 'Recruter', icon: '🎯' },
  { id: 'combos', label: 'Combos', icon: '🧩' },
  { id: 'tier', label: 'Tier list', icon: '🏆' },
  { id: 'equipes', label: 'Équipes', icon: '⚔️' },
  { id: 'ouvriers', label: 'Ouvriers', icon: '🐾' },
  { id: 'codes', label: 'Codes', icon: '🎁' },
] as const;
type PageId = (typeof PAGES)[number]['id'];

const fromHash = (): PageId => (PAGES.some((p) => `#${p.id}` === location.hash) ? (location.hash.slice(1) as PageId) : 'logis');

export function App() {
  const api = useProfile();
  const [page, setPage] = useState<PageId>(fromHash);

  useEffect(() => {
    const onHash = () => setPage(fromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  return (
    <>
      <header className="topbar">
        <span className="brand">
          Anii<b>Guide</b> 
        </span>
        <nav className="tabs">
          {PAGES.map((p) => (
            <a key={p.id} href={`#${p.id}`} className={page === p.id ? 'is-active' : ''} aria-current={page === p.id ? 'page' : undefined}>
              <span aria-hidden>{p.icon}</span> {p.label}
            </a>
          ))}
        </nav>
      </header>
      <main>
        {page === 'logis' && <MonLogis api={api} />}
        {(page === 'plan' || page === 'recruter') && (
          <Suspense fallback={<p className="loading">Chargement…</p>}>
            <SolverGate>{page === 'plan' ? <PlanPage api={api} /> : <Recruter api={api} />}</SolverGate>
          </Suspense>
        )}
        {page === 'tier' && <TierList profile={api.profile} />}
        {page === 'equipes' && <Equipes api={api} />}
        {page === 'ouvriers' && <Ouvriers profile={api.profile} />}
        {page === 'codes' && <Codes api={api} />}
        {page === 'combos' && <Combos rv={api.profile.rv} />}
      </main>
      <footer className="footer">
        Projet de fans non officiel · Aniimo © Pawprint Studio / FunPlus · Images et noms : wiki officiel
      </footer>
    </>
  );
}
