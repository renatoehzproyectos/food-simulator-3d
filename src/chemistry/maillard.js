// @ts-check
// Maillard: dB/dt = k(T)·S^a·AA^b·g(aw), consume azúcar reductor S y aminoácido AA (fracciones relativas). Sec. 8.
import { defineReaction, arrheniusRef } from './reactions.js';
import { pHFactor } from './ph.js';
/** g(aw): máximo a aw ≈ 0.6–0.7 y casi nulo con agua abundante (aw≈1) o muy seco: comportamiento cualitativo clásico (Labuza/Eichner).
 *  ASSUMPTION: forma gaussiana, aw_opt=0.65, ancho 0.2; k_ref(150 °C)=1e-4 1/s, Ea=110 kJ/mol, órdenes a=b=1, pH_slope=0.2. */
export const MAILLARD_PARAMS = { k_ref_s: 1e-4, T_ref_K: 423.15, Ea_J_mol: 110e3, a: 1, b: 1, aw_opt: 0.65, aw_width: 0.2, pH_ref: 6.5, pH_slope: 0.2 };
export const gAw = (aw, p = MAILLARD_PARAMS) => Math.exp(-(((aw - p.aw_opt) / p.aw_width) ** 2));
export const kMaillard = (T_K, aw, pH, p = MAILLARD_PARAMS) => arrheniusRef(p.k_ref_s, p.T_ref_K, p.Ea_J_mol, T_K) * gAw(aw, p) * pHFactor(pH, { pH_ref: p.pH_ref, slope: p.pH_slope });
export const maillard = defineReaction({ id: 'maillard', consumes: ['S', 'AA'], produces: ['B'], params: MAILLARD_PARAMS,
  source: 'ASSUMPTION salvo la forma de g(aw) (ver comentario)',
  rate: (T, s, p, env) => kMaillard(T, env.aw ?? 1, env.pH ?? p.pH_ref, p) * Math.max(0, s.S) ** p.a * Math.max(0, s.AA) ** p.b });
export const maillardModel = { name: 'maillard', version: '0.1.0', equations: 'dB/dt = k·S^a·AA^b·g(aw)', parameters: MAILLARD_PARAMS, reaction: maillard };
