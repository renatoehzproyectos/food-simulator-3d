// @ts-check
// Ebullición nucleada en recipiente (REQ-HEAT-001 / D32): correlación de Rohsenow para el flujo de pared
// y flujo crítico de Zuber. Solo agua a 1 atm (≈100 °C).
//   q'' = μ_l·h_fg·[g(ρ_l−ρ_v)/σ]^½ · [c_pl·ΔT_e / (C_sf·h_fg·Pr_l^s)]³ , s = 1 para agua.
// Fuente de la forma y de C_sf = 0.013 (agua sobre cobre liso): Rohsenow (1952), citado en Saiz Jabardo et al. (J. Braz. Soc. Mech. Sci. Eng.) y NPTEL.
// Propiedades de saturación a 373 K: valores de tabla estándar (Incropera, tabla A.6); NO se re-verificaron contra la tabla en esta sesión.
// C_sf para acero inoxidable ≠ cobre: ASSUMPTION (se usa 0.013).
// Zuber (1959): q''_max = (π/24)·h_fg·ρ_v^½·[σ g (ρ_l−ρ_v)]^¼ (coeficiente clásico 0.131).
const G = 9.80665;
export const WATER_SAT_100C = { rho_l: 957.9, rho_v: 0.5955, h_fg: 2.257e6, cp_l: 4217, mu_l: 279e-6, Pr_l: 1.76, sigma: 58.9e-3 };
export const ROHSENOW_CSF = 0.013;
/** Sobretemperatura mínima (K) a partir de la cual se aplica el régimen de burbujas (4–10 K: burbujas aisladas, según resúmenes de ebullición nucleada). */
export const NUCLEATE_ONSET_K = 4;

/** Flujo crítico (W/m²), Zuber. */
export function criticalHeatFlux(p = WATER_SAT_100C) {
  return (Math.PI / 24) * p.h_fg * Math.sqrt(p.rho_v) * Math.pow(p.sigma * G * (p.rho_l - p.rho_v), 0.25);
}
/** Flujo de pared Rohsenow (W/m²) para una sobretemperatura ΔT_e (K) > 0, sin tope. */
export function rohsenowFlux(dTe_K, Csf = ROHSENOW_CSF, p = WATER_SAT_100C) {
  if (!(dTe_K > 0)) return 0;
  const a = p.mu_l * p.h_fg * Math.sqrt(G * (p.rho_l - p.rho_v) / p.sigma);
  const b = p.cp_l * dTe_K / (Csf * p.h_fg * p.Pr_l);
  return a * b * b * b;
}
/** Coeficiente de ebullición h = q''/ΔT_e (W/m²K), con el flujo limitado al crítico (no se modela ebullición de transición/película). */
export function boilingH(dTe_K, Csf = ROHSENOW_CSF, p = WATER_SAT_100C) {
  if (!(dTe_K > 0)) return Infinity;
  return Math.min(rohsenowFlux(dTe_K, Csf, p), criticalHeatFlux(p)) / dTe_K;
}
/** Inversa: sobretemperatura (K) que sostiene un flujo q'' (W/m²) en régimen nucleado. */
export function superheatForFlux(q_W_m2, Csf = ROHSENOW_CSF, p = WATER_SAT_100C) {
  const a = p.mu_l * p.h_fg * Math.sqrt(G * (p.rho_l - p.rho_v) / p.sigma), c = p.cp_l / (Csf * p.h_fg * p.Pr_l);
  return Math.cbrt(q_W_m2 / (a * c * c * c));
}
