import { initSolver } from '../src/engine/lp';

// Les tests utilisent le vrai solveur HiGHS (WebAssembly), chargé une fois par fichier de test.
await initSolver();
