// @ts-check
// Clasificador EXPLÍCITO del estado final del arroz (sec. 10.3). Se aplica a variables continuas calculadas; nunca al tiempo.
// Umbrales fijados ANTES de correr los escenarios S1–S5 y no se tocan para que éstos pasen (ver docs/DECISIONS.md D20).
import { doneness } from './texture.js';

/** ASSUMPTION (todos): α_min=0.95 (spec). M_min=1.2 y M_max=2.3 kg/kg b.s. ≈ 55 % y 70 % b.h., ventana de arroz cocido (rango 60–70 % b.h.
 *  habitual en la literatura de arroz cocido; no verificado con cita puntual). H_min=6 N: dureza residual de la red gelatinizada muy hidratada.
 *  B_burn=0.3 (fracción de precursores convertida), T_burn=150 °C sostenida ≥60 s con agua libre ≈ 0 en el fondo. */
export const CLASS_PARAMS = { alpha_min: 0.95, M_min: 1.2, M_max: 2.3, H_min: 6, B_burn: 0.3, T_burn_K: 423.15, burn_hold_s: 60 };
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * @param {{alpha_mean:number, M_mean_db:number, hardness_N:number, B_bottom:number, burnHold_s:number}} v
 * @returns {{label:'duro'|'cocido'|'blando'|'sobrecocido'|'quemado', confidence:number, score:number, reasons:string[]}}
 */
export function classifyRice(v, P = CLASS_PARAMS) {
  const { alpha_mean: a, M_mean_db: M, hardness_N: H, B_bottom: B, burnHold_s: hold } = v;
  const f = (x, d = 2) => x.toFixed(d);
  // margen normalizado a cada umbral relevante (para confidence)
  const margins = [Math.abs(a - P.alpha_min) / P.alpha_min, Math.abs(M - P.M_min) / P.M_min, Math.abs(M - P.M_max) / P.M_max, Math.abs(B - P.B_burn) / P.B_burn];
  const confidence = clamp01(Math.min(...margins) * 4);
  const burnPenalty = 1 - clamp01(B / P.B_burn), wetPenalty = M > P.M_max ? clamp01(1 - (M - P.M_max) / P.M_max) : 1;
  const score = clamp01(doneness(a, M) * burnPenalty * wetPenalty);
  const reasons = [];
  let label;
  if (B > P.B_burn || hold >= P.burn_hold_s) {
    label = 'quemado';
    if (B > P.B_burn) reasons.push(`pardeamiento del fondo B=${f(B)} > ${P.B_burn}`);
    if (hold >= P.burn_hold_s) reasons.push(`fondo seco y > ${P.T_burn_K - 273.15} °C durante ${f(hold, 0)} s`);
  } else if (a < P.alpha_min || M < P.M_min) {
    label = 'duro';
    if (a < P.alpha_min) reasons.push(`gelatinización media α=${f(a)} < ${P.alpha_min}`);
    if (M < P.M_min) reasons.push(`humedad media M=${f(M)} kg/kg b.s. < ${P.M_min}`);
  } else if (M > P.M_max) {
    label = 'sobrecocido'; reasons.push(`humedad media M=${f(M)} > ${P.M_max} kg/kg b.s. con α=${f(a)}`);
  } else if (H < P.H_min) {
    label = 'blando'; reasons.push(`dureza ${f(H, 1)} N < ${P.H_min} N con α=${f(a)}`);
  } else {
    label = 'cocido'; reasons.push(`α=${f(a)} ≥ ${P.alpha_min}, M=${f(M)} en [${P.M_min}, ${P.M_max}], B=${f(B)} bajo`);
  }
  return { label, confidence, score, reasons };
}
