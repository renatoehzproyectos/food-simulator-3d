// @ts-check
// Absorción de agua en el grano (esfera, Fick radial) con balance contra el agua libre. REQ-MOIST-001.
import { makeGrid, arrhenius, stepFick, moistureInventory } from './diffusion.js';

/** Parámetros de partida del arroz. ASSUMPTION: órdenes de magnitud de la spec 10.4 (D 1e-11–1e-9 m²/s creciente con T;
 *  saturación 1.5–2.5 kg/kg b.s.); sin fuente puntual todavía → ver docs/ASSUMPTIONS.md. D(373.15 K)=2e-10 m²/s. */
export const RICE_GRAIN_DEFAULTS = {
  D0_m2_s: 8.7e-7, Ea_J_mol: 26e3,       // ASSUMPTION
  Meq_db: () => 1.8,                       // ASSUMPTION: M de saturación (kg/kg b.s.), constante
  rho_dry_kg_m3: 1450,                     // ASSUMPTION: densidad del sólido seco del grano (spec: grano ~1400–1500)
};

/** Grano esférico equivalente. M en base seca (kg agua/kg sólido seco). */
export function createGrain({ radius_m, n = 20, M0_db }) {
  const grid = makeGrid({ n, length_m: radius_m, geometry: 'spherical', measure: 4 * Math.PI });
  return { grid, M: new Float64Array(n).fill(M0_db), radius_m };
}
export const grainWater_kg = (g, p = RICE_GRAIN_DEFAULTS) => p.rho_dry_kg_m3 * moistureInventory(g.grid, g.M);
export function meanMoisture_db(g) { return moistureInventory(g.grid, g.M) / (4 / 3 * Math.PI * g.radius_m ** 3); }

/**
 * Avanza el grano dt. wet=true: la superficie toca agua líquida (M_surf = M_eq(T)) y el agua sale de `availableWater_kg`
 * (repartida entre nGrains). Si no alcanza, el flujo se limita para conservar masa exactamente.
 * wet=false: flujo de evaporación superficial `evapFlux_kg_m2s` (≥0, hacia fuera).
 * @returns {{uptake_kg:number, limited:boolean}} uptake total (todos los granos); negativo si el grano pierde agua.
 */
export function stepGrain(g, { T_K, wet, dt_s, availableWater_kg = Infinity, nGrains = 1, evapFlux_kg_m2s = 0, params = RICE_GRAIN_DEFAULTS }) {
  const D = new Float64Array(g.grid.n).fill(arrhenius(params.D0_m2_s, params.Ea_J_mol, T_K));
  const before = grainWater_kg(g, params);
  const area = 4 * Math.PI * g.radius_m ** 2;
  let limited = false, res;
  if (wet) {
    res = stepFick(g.grid, g.M, D, { right: { type: 'dirichlet', T: params.Meq_db(T_K) } }, dt_s, { scheme: 'implicit' });
    const up = (p, r) => p.rho_dry_kg_m3 * moistureInventory(g.grid, r.T) - before;
    if (up(params, res) * nGrains > availableWater_kg) {
      limited = true; // flujo de entrada [M·m/s] = agua disponible por grano / (ρ_seco·área·dt)
      const q = Math.max(0, availableWater_kg) / nGrains / (params.rho_dry_kg_m3 * area * dt_s);
      res = stepFick(g.grid, g.M, D, { right: { type: 'neumann', flux: q } }, dt_s, { scheme: 'implicit' });
    }
  } else {
    const q = -evapFlux_kg_m2s / params.rho_dry_kg_m3;
    res = stepFick(g.grid, g.M, D, { right: { type: 'neumann', flux: q } }, dt_s, { scheme: 'implicit' });
  }
  g.M = res.T;
  return { uptake_kg: (grainWater_kg(g, params) - before) * nGrains, limited };
}
