import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import wasmUrl from 'highs/runtime?url';
import { App } from './App';
import { initSolver } from './engine/lp';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
root.render(<p className="loading">Chargement du solveur…</p>);

initSolver(wasmUrl)
  .then(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch((err) => root.render(<p className="loading">Impossible de charger le solveur : {String(err)}</p>));
