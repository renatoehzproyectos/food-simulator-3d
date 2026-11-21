// @ts-check
// Gelatinización del almidón: dα/dt = k(T)·f(M)·(1−α)ⁿ, n=1 (primer orden, irreversible). REQ-RICE-001, sec. 8.
import { defineReaction, arrheniusRef, exactFirstOrderFill } from './reactions.js';

/** Parámetros (arroz).
 *  - Orden 1 e irreversible: Ahromrit et al. 2006 J Food Eng (DOI 10.1016/j.jfoodeng.2006.03.003); revisión Processes 2023, 11, 1464.
 *  - Ea: arroz in situ ≈187 kJ/mol por debajo de 85 °C y ≈99 kJ/mol por encima (revisión Processes 2023, 11, 1464, que cita un estudio
 *    primario no identificado aquí); otros trabajos dan 79–289 kJ/mol según T y método → incertidumbre alta.
 *  - T de pico DSC del almidón de arroz Basmati: 74.2 °C (Food Hydrocolloids 2007, DOI 10.1016/j.foodhyd.2006.11.014).
 *  - k_ref ASSUMPTION (calibración): k(74.2 °C)=0.03 1/s ⇒ pico DSC a ~10 K/min cerca de 74 °C (aprox. de Kissinger: k_p = β·Ea/(R·Tp²)).
 *  - f(M): ASSUMPTION rampa lineal M0→M1 (la gelatinización necesita agua; forma cualitativa, Donovan 1979, valores no verificados). */
export const STARCH_PARAMS = {
  k_ref_s: 0.03, T_ref_K: 347.35, Ea_low_J_mol: 187e3, Ea_high_J_mol: 99e3, T_break_K: 358.15, n: 1,
  M0_db: 0.25, M1_db: 0.8,
};
/** k(T): Arrhenius con cambio de pendiente continuo en T_break. */
export function kGel(T_K, p = STARCH_PARAMS) {
  if (T_K <= p.T_break_K) return arrheniusRef(p.k_ref_s, p.T_ref_K, p.Ea_low_J_mol, T_K);
  const kb = arrheniusRef(p.k_ref_s, p.T_ref_K, p.Ea_low_J_mol, p.T_break_K);
  return arrheniusRef(kb, p.T_break_K, p.Ea_high_J_mol, T_K);
}
/** f(M) ∈ [0,1]: 0 sin agua suficiente, satura en 1. */
export const fWater = (M_db, p = STARCH_PARAMS) => Math.min(1, Math.max(0, (M_db - p.M0_db) / (p.M1_db - p.M0_db)));

export const gelatinization = defineReaction({
  id: 'starch_gelatinization', produces: ['alpha'], params: STARCH_PARAMS,
  source: 'Ahromrit 2006; Processes 2023,11,1464; Food Hydrocolloids 2007 (ver comentario de STARCH_PARAMS)',
  rate: (T, s, p, env) => kGel(T, p) * fWater(env.M_db ?? 0, p) * (1 - s.alpha) ** p.n,
});
/** Paso exacto (n=1, T y M constantes en el paso). */
export const stepStarch = (alpha, T_K, M_db, dt_s, p = STARCH_PARAMS) => exactFirstOrderFill(alpha, kGel(T_K, p) * fWater(M_db, p), dt_s);

export const starchModel = { name: 'starch', version: '0.1.0', equations: 'dα/dt = k(T)·f(M)·(1−α)', parameters: STARCH_PARAMS, reaction: gelatinization, step: stepStarch,
  invariants: (alpha) => alpha >= 0 && alpha <= 1 };
