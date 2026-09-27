import loadHighs from 'highs';

// Résolution des programmes linéaires avec HiGHS (solveur de l'Université d'Édimbourg, compilé en
// WebAssembly, licence MIT). Le modèle garde la forme « JSON » de javascript-lp-solver :
// { optimize, opType, constraints: { nom: { min, max } }, variables: { nom: { attribut: coef } }, ints },
// traduit ici au format texte CPLEX LP que lit HiGHS.

export interface LpModel {
  optimize: string;
  opType: 'max' | 'min';
  constraints: Record<string, { min?: number; max?: number; equal?: number }>;
  variables: Record<string, Record<string, number>>;
  ints?: Record<string, 1>;
}

export type LpResult = Record<string, number> & { feasible: boolean; result: number };

type Highs = Awaited<ReturnType<typeof loadHighs>>;
let highs: Highs | null = null;
let loading: Promise<void> | null = null;

/** Charge le solveur (une fois). `wasmUrl` : adresse du fichier highs.wasm dans le navigateur. */
export function initSolver(wasmUrl?: string): Promise<void> {
  loading ??= loadHighs(wasmUrl ? { locateFile: () => wasmUrl } : {}).then((h) => {
    highs = h;
  });
  return loading;
}

const num = (x: number) => {
  // Le format LP n'accepte pas la notation « 1e-7 » partout : on écrit des décimales.
  const s = Math.abs(x) < 1e-12 ? '0' : x.toFixed(12).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};

function terms(entries: [string, number][]): string {
  const parts = entries.filter(([, c]) => c !== 0).map(([v, c], i) => `${c < 0 ? '-' : i === 0 ? '' : '+'} ${num(Math.abs(c))} ${v}`);
  // Lignes courtes : le lecteur LP limite leur longueur.
  const lines: string[] = [];
  for (let i = 0; i < parts.length; i += 8) lines.push(parts.slice(i, i + 8).join(' '));
  return lines.join('\n   ');
}

export function solveLP(model: LpModel): LpResult {
  if (!highs) throw new Error('Solveur non chargé : appeler initSolver() au démarrage.');
  const varNames = Object.keys(model.variables);
  const vid = new Map(varNames.map((v, i) => [v, `x${i}`]));
  const rows = new Map<string, [string, number][]>();
  const objective: [string, number][] = [];
  for (const [v, col] of Object.entries(model.variables)) {
    for (const [attr, coef] of Object.entries(col)) {
      if (attr === model.optimize) objective.push([vid.get(v)!, coef]);
      if (attr in model.constraints) {
        if (!rows.has(attr)) rows.set(attr, []);
        rows.get(attr)!.push([vid.get(v)!, coef]);
      }
    }
  }
  const lines: string[] = [model.opType === 'max' ? 'Maximize' : 'Minimize'];
  lines.push(` obj: ${objective.length ? terms(objective) : `0 ${vid.get(varNames[0]) ?? 'x0'}`}`);
  lines.push('Subject To');
  let r = 0;
  for (const [name, c] of Object.entries(model.constraints)) {
    const t = rows.get(name)?.filter(([, k]) => k !== 0) ?? [];
    const lo = c.equal ?? c.min;
    const hi = c.equal ?? c.max;
    if (!t.length) {
      // Contrainte sans variable : satisfaite ou impossible.
      if ((lo != null && lo > 1e-9) || (hi != null && hi < -1e-9)) return { feasible: false, result: 0 } as LpResult;
      continue;
    }
    const expr = terms(t);
    if (lo != null && hi != null && lo === hi) lines.push(` r${r++}: ${expr} = ${num(lo)}`);
    else {
      if (lo != null) lines.push(` r${r++}: ${expr} >= ${num(lo)}`);
      if (hi != null) lines.push(` r${r++}: ${expr} <= ${num(hi)}`);
    }
  }
  const generals = Object.keys(model.ints ?? {}).filter((v) => vid.has(v));
  if (generals.length) {
    lines.push('Generals');
    for (let i = 0; i < generals.length; i += 10) lines.push(' ' + generals.slice(i, i + 10).map((v) => vid.get(v)).join(' '));
  }
  lines.push('End');

  const res = highs.solve(lines.join('\n'), { output_flag: false, mip_rel_gap: 1e-3, time_limit: 20 });
  if (res.Status !== 'Optimal' && !(res.Status === 'Time limit reached' && res.Columns)) return { feasible: false, result: 0 } as LpResult;
  const out = { feasible: true, result: res.ObjectiveValue } as LpResult;
  for (const [v, x] of vid) {
    const p = (res.Columns as Record<string, { Primal: number }>)[x]?.Primal ?? 0;
    if (p !== 0) out[v] = p;
  }
  return out;
}
