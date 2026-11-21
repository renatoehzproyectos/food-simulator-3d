// @ts-check
// Textura derivada del estado físico-químico (REQ-TEX-001). Nunca almacenada por timer.
/** hardness = g(M)·[H_gel + (H_raw − H_gel)·(1−α)^p] + H_burn·B^q   (p ≥ 1 ⇒ monótona decreciente en α)
 *  Extiende el modelo sugerido de la spec con el piso H_gel: sin él, α=1 daría dureza 0 para cualquier M y no distinguiría cocido de papilla.
 *  g(M) = exp(−λ·max(0, M − M_raw)): decreciente con la humedad absorbida.
 *  ASSUMPTION (todos los valores): H_raw=100 N, H_gel=20 N, p=2, λ=0.6, M_raw=0.12 kg/kg b.s., H_burn=40 N, q=1; M_a=0.5, M_b=1.2 (ventana de doneness).
 *  Pendiente: calibrar contra texturometría publicada (tests/reference-data aún vacío a propósito). */
export const TEXTURE_PARAMS = { H_raw: 100, H_gel: 20, p: 2, lambda: 0.6, M_raw: 0.12, H_burn: 40, q: 1, M_a: 0.5, M_b: 1.2 };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

export const gMoisture = (M, P = TEXTURE_PARAMS) => Math.exp(-P.lambda * Math.max(0, M - P.M_raw));
export function hardness_N(alpha, M_db, B = 0, P = TEXTURE_PARAMS) {
  return gMoisture(M_db, P) * (P.H_gel + (P.H_raw - P.H_gel) * (1 - alpha) ** P.p) + P.H_burn * Math.max(0, B) ** P.q;
}
/** softness ∈ [0,1]: 1 − dureza/H_raw (sin la parte quemada). */
export const softness = (alpha, M_db, P = TEXTURE_PARAMS) => clamp01(1 - hardness_N(alpha, M_db, 0, P) / P.H_raw);
/** doneness ∈ [0,1], continua en α y M. */
export const doneness = (alpha, M_db, P = TEXTURE_PARAMS) => clamp01(alpha) * smooth((M_db - P.M_a) / (P.M_b - P.M_a));
/** stickiness ∈ [0,1]: crece con α y con M (lixiviación de amilosa); ASSUMPTION de forma. */
export const stickiness = (alpha, M_db, P = TEXTURE_PARAMS) => clamp01(alpha) ** 2 * smooth((M_db - P.M_raw) / (P.M_b * 1.5 - P.M_raw));
export const textureOf = (alpha, M_db, B = 0, P = TEXTURE_PARAMS) =>
  ({ hardness_N: hardness_N(alpha, M_db, B, P), softness: softness(alpha, M_db, P), doneness: doneness(alpha, M_db, P), stickiness: stickiness(alpha, M_db, P) });
