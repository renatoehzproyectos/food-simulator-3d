// @ts-check
// Infraestructura de reacciones como DATOS (REQ-EXT-001): añadir una reacción = añadir un objeto.
import { R_GAS } from '../core/units.js';
import { solveODE } from '../numerical/ode.js';

/** k = A·exp(−Ea/(R·T)) */
export const arrheniusK = (A, Ea_J_mol, T_K) => A * Math.exp(-Ea_J_mol / (R_GAS * T_K));
/** k = k_ref·exp(−Ea/R·(1/T − 1/T_ref)) (equivalente, más legible con una k de referencia) */
export const arrheniusRef = (k_ref, T_ref_K, Ea_J_mol, T_K) => k_ref * Math.exp(-Ea_J_mol / R_GAS * (1 / T_K - 1 / T_ref_K));
/** Solución exacta de dα/dt = k(1−α) con k constante en el paso. */
export const exactFirstOrderFill = (alpha, k, dt) => 1 - (1 - alpha) * Math.exp(-k * dt);

/**
 * @typedef {{id:string, rate:(T_K:number, s:Record<string,number>, params:any, env:any)=>number,
 *   consumes?:Array<string|{name:string,n:number}>, produces?:Array<string|{name:string,n:number}>, source:string, params?:any}} Reaction
 */
export function defineReaction(r) {
  for (const k of ['id', 'rate', 'source']) if (!r?.[k]) throw new Error(`defineReaction: falta '${k}'`);
  return { consumes: [], produces: [], params: {}, ...r };
}
const norm = (x) => (typeof x === 'string' ? { name: x, n: 1 } : x);

/** Construye f(t, y) del sistema a partir de reacciones. */
export function buildRhs(reactions, species, T_K, env) {
  const idx = Object.fromEntries(species.map((s, i) => [s, i]));
  return (t, y) => {
    const s = Object.fromEntries(species.map((n, i) => [n, y[i]])); const T = T_K(t), e = env(t);
    const dy = new Array(species.length).fill(0);
    for (const r of reactions) {
      const rate = r.rate(T, s, r.params, e);
      for (const c of r.consumes.map(norm)) dy[idx[c.name]] -= c.n * rate;
      for (const p of r.produces.map(norm)) dy[idx[p.name]] += p.n * rate;
    }
    return dy;
  };
}

/**
 * Integra un conjunto de reacciones. y0: {especie: valor}. T_K y env: funciones del tiempo (o constantes).
 * @returns {{t:number[], y:Record<string,number[]>, method:string}}
 */
export function integrateReactions(reactions, y0, { T_K, env = {}, tSpan, stiff = false, method = 'auto', ...rest }) {
  const species = Object.keys(y0);
  for (const r of reactions) for (const n of [...r.consumes, ...r.produces].map(norm).map((x) => x.name))
    if (!species.includes(n)) throw new Error(`reacción '${r.id}' usa la especie '${n}' que no está en y0`);
  const fT = typeof T_K === 'function' ? T_K : () => T_K, fE = typeof env === 'function' ? env : () => env;
  const sol = solveODE(buildRhs(reactions, species, fT, fE), tSpan, species.map((n) => y0[n]), { stiff, method, ...rest });
  return { t: sol.t, y: Object.fromEntries(species.map((n, i) => [n, sol.y[i]])), method: sol.method };
}
