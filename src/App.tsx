import { useEffect, useState } from 'react';
import { useProfile } from './state/profile';
import { MonLogis } from './pages/MonLogis';
import { Ouvriers } from './pages/Ouvriers';
import { PlanPage } from './pages/Plan';

const PAGES = [
  { id: 'logis', label: 'Mon logis', icon: '🏡' },
  { id: 'plan', label: 'Optimiser', icon: '📈' },
  { id: 'ouvriers', label: 'Ouvriers', icon: '🐾' },
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
          Anii<b>Guide</b> <small>Logis</small>
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
        {page === 'plan' && <PlanPage api={api} />}
        {page === 'ouvriers' && <Ouvriers profile={api.profile} />}
      </main>
      <footer className="footer">
        Projet de fans non officiel · Aniimo © Pawprint Studio / FunPlus · Images et noms : wiki officiel
      </footer>
    </>
  );
}
