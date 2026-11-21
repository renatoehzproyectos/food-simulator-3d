// @ts-check
// Desnaturalización de proteínas: dN/dt = −k_d(T,pH)·N (1.er orden, Arrhenius). Sec. 8.
import { defineReaction, arrheniusRef } from './reactions.js';
import { pHFactor } from './ph.js';
/** ASSUMPTION (todos): sin valores verificados para proteínas de arroz. Forma de Arrhenius y 1.er orden son el estándar de la literatura;
 *  los números son placeholders de orden de magnitud y deben sustituirse al calibrar. */
export const PROTEIN_PARAMS = { k_ref_s: 1e-3, T_ref_K: 348.15, Ea_J_mol: 300e3, pH_ref: 6.5, pH_slope: 0.3 };
export const kDenat = (T_K, pH, p = PROTEIN_PARAMS) => arrheniusRef(p.k_ref_s, p.T_ref_K, p.Ea_J_mol, T_K) * pHFactor(pH, { pH_ref: p.pH_ref, slope: p.pH_slope });
export const denaturation = defineReaction({ id: 'protein_denaturation', consumes: ['N'], params: PROTEIN_PARAMS,
  source: 'ASSUMPTION (ver docs/ASSUMPTIONS.md)', rate: (T, s, p, env) => kDenat(T, env.pH ?? p.pH_ref, p) * s.N });
export const proteinModel = { name: 'proteins', version: '0.1.0', equations: 'dN/dt = −k_d(T,pH)·N', parameters: PROTEIN_PARAMS, reaction: denaturation };
