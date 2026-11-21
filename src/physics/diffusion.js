// @ts-check
// Ley de Fick: ∂M/∂t = ∇·(D(T,M)∇M). Mismo solver conservativo que el calor con C=1. REQ-MOIST-001.
import { makeGrid, stepFV, stableDt, inventory } from './fv1d.js';
import { R_GAS } from '../core/units.js';
export { makeGrid };
/** D = D0·exp(−Ea/(R·T)) */
export const arrhenius = (D0, Ea_J_mol, T_K) => D0 * Math.exp(-Ea_J_mol / (R_GAS * T_K));
/** bcs: {type:'dirichlet',T:M_surf} | {type:'neumann',flux} (flux en [M]·m/s, positivo hacia dentro). */
export function stepFick(grid, M, D_m2_s, bcs, dt_s, opts = {}) {
  const ones = new Float64Array(grid.n).fill(1);
  return stepFV(grid, M, ones, D_m2_s, bcs, dt_s, opts);
}
/** Inventario Σ M·V (m³·[M]); multiplicar por ρ_seco para kg de agua. */
export const moistureInventory = (grid, M) => inventory(grid, new Float64Array(grid.n).fill(1), M);
export { stableDt };
