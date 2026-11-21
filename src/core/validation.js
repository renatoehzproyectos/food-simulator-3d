// @ts-check
import { C_to_K } from './units.js';
/** @typedef {{code:string, path:string, message:string, hint:string}} Issue */

export class ValidationError extends Error {
  /** @param {Issue[]} errors */
  constructor(errors) { super(errors.map((e) => `${e.path}: ${e.message}`).join('; ')); this.name = 'ValidationError'; this.errors = errors; }
}
const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Valida la entrada de simulación (sec. 10.1 / 16). Devuelve {ok, errors, warnings}.
 * @param {any} input
 * @returns {{ok:boolean, errors:Issue[], warnings:Issue[]}}
 */
export function validateSimulationInput(input) {
  /** @type {Issue[]} */ const errors = []; /** @type {Issue[]} */ const warnings = [];
  const err = (code, path, message, hint) => errors.push({ code, path, message, hint });
  const warn = (code, path, message, hint) => warnings.push({ code, path, message, hint });
  if (input == null || typeof input !== 'object') {
    err('E_INPUT', '', 'La entrada debe ser un objeto.', 'Pasa { food, ingredients, environment, simulation }.');
    return { ok: false, errors, warnings };
  }
  if (typeof input.food !== 'string' || !input.food) err('E_FOOD', 'food', 'Falta el alimento.', 'Usa food: "rice".');
  const positive = (path, label, hint) => {
    const v = get(input, path);
    if (!isNum(v)) err('E_REQUIRED', path, `${label} es obligatorio y debe ser un número.`, hint);
    else if (v <= 0) err('E_RANGE', path, `${label} debe ser > 0 (recibido ${v}).`, hint);
    return v;
  };
  const riceG = positive('ingredients.rice.mass_g', 'La masa de arroz', 'Ej.: 200 (gramos).');
  const waterG = positive('ingredients.water.mass_g', 'La masa de agua', 'Ej.: 300 (gramos).');
  const tw = get(input, 'ingredients.water.T_C');
  if (tw !== undefined) {
    if (!isNum(tw)) err('E_TYPE', 'ingredients.water.T_C', 'T_C debe ser numérico.', 'En °C.');
    else if (C_to_K(tw) < 273.15) err('E_PHYS', 'ingredients.water.T_C', `Temperatura bajo 0 °C (${tw}) no es agua líquida.`, 'Usa 0–100 °C.');
    else if (tw > 100) warn('W_STEAM', 'ingredients.water.T_C', 'Agua sobre 100 °C a 1 atm es vapor.', 'Usa ≤ 100 °C.');
  }
  const dur = positive('environment.duration_s', 'La duración', 'En segundos, ej.: 1200.');
  if (isNum(dur) && dur > 86400) warn('W_LONG', 'environment.duration_s', 'Duración mayor a 24 h.', 'Revisa que sean segundos.');
  const ct = get(input, 'environment.cookingTemperature_C');
  if (ct !== undefined) {
    if (!isNum(ct)) err('E_TYPE', 'environment.cookingTemperature_C', 'Debe ser numérico.', 'En °C.');
    else if (C_to_K(ct) < 273.15) err('E_PHYS', 'environment.cookingTemperature_C', 'Temperatura bajo 0 °C.', 'Usa un valor ≥ 0.');
  }
  const dt = get(input, 'simulation.timeStep_s');
  if (dt !== undefined && (!isNum(dt) || dt <= 0)) err('E_RANGE', 'simulation.timeStep_s', 'timeStep_s debe ser > 0.', 'Ej.: 0.1.');
  if (isNum(riceG) && isNum(waterG) && riceG > 0 && waterG / riceG < 1.0)
    warn('W_DRY', 'ingredients.water.mass_g', `Relación agua/arroz ${(waterG / riceG).toFixed(2)} < 1.0: riesgo de arroz duro o quemado.`, 'Sube el agua (típico 1.25–2).');
  return { ok: errors.length === 0, errors, warnings };
}
