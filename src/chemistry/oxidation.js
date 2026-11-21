// @ts-check
// Oxidación: dOx/dt = k(T)·(pO2/pO2_ref)^m·(1−Ox). Sec. 8.
import { defineReaction, arrheniusRef } from './reactions.js';
/** ASSUMPTION (todos): k_ref(25 °C)=1e-6 1/s, Ea=60 kJ/mol, orden m=1 en O2; referencia pO2=0.21 atm. */
export const OXID_PARAMS = { k_ref_s: 1e-6, T_ref_K: 298.15, Ea_J_mol: 60e3, m: 1, pO2_ref: 0.21 };
export const kOx = (T_K, pO2, p = OXID_PARAMS) => arrheniusRef(p.k_ref_s, p.T_ref_K, p.Ea_J_mol, T_K) * (Math.max(0, pO2) / p.pO2_ref) ** p.m;
export const oxidation = defineReaction({ id: 'oxidation', produces: ['Ox'], params: OXID_PARAMS, source: 'ASSUMPTION',
  rate: (T, s, p, env) => kOx(T, env.pO2 ?? p.pO2_ref, p) * (1 - s.Ox) });
export const oxidationModel = { name: 'oxidation', version: '0.1.0', equations: 'dOx/dt = k(T)(pO2/ref)^m(1−Ox)', parameters: OXID_PARAMS, reaction: oxidation };
