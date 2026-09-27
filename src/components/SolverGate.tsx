import { useEffect, useState, type ReactNode } from 'react';

/**
 * Charge le solveur HiGHS (3,5 Mo) seulement pour les pages qui calculent : le reste du site
 * s'affiche tout de suite, même sur mobile.
 */
export function SolverGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | Error>('loading');
  useEffect(() => {
    let alive = true;
    Promise.all([import('../engine/lp'), import('highs/runtime?url')])
      .then(([lp, wasm]) => lp.initSolver(wasm.default))
      .then(
      () => alive && setState('ready'),
      (err) => alive && setState(err instanceof Error ? err : new Error(String(err))),
    );
    return () => {
      alive = false;
    };
  }, []);
  if (state === 'ready') return <>{children}</>;
  return <p className="loading">{state === 'loading' ? 'Chargement du calculateur…' : `Impossible de charger le calculateur : ${state.message}`}</p>;
}
