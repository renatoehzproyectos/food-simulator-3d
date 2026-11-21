// @ts-check
// Caramelización: dC/dt = k(T)·(1−C); el "umbral" EMERGE de una Ea alta (sin if). Sec. 8.
import { defineReaction, arrheniusRef } from './reactions.js';
/** Spec: sacarosa ≳160 °C. ASSUMPTION: k(160 °C)=1e-3 1/s, Ea=200 kJ/mol (k cae ~300× entre 160 y 120 °C). */
export const CARAMEL_PARAMS = { sucrose: { k_ref_s: 1e-3, T_ref_K: 433.15, Ea_J_mol: 200e3 } };
export const kCaramel = (T_K, sugar = 'sucrose', P = CARAMEL_PARAMS) => arrheniusRef(P[sugar].k_ref_s, P[sugar].T_ref_K, P[sugar].Ea_J_mol, T_K);
export const caramelization = defineReaction({ id: 'caramelization_sucrose', produces: ['C'], params: CARAMEL_PARAMS,
  source: 'ASSUMPTION; umbral cualitativo ~160 °C de la spec', rate: (T, s, p) => kCaramel(T, 'sucrose', p) * (1 - s.C) });
export const caramelModel = { name: 'caramelization', version: '0.1.0', equations: 'dC/dt = k(T)(1−C)', parameters: CARAMEL_PARAMS, reaction: caramelization };
