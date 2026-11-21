// @ts-check
// Conducción de calor transitoria: ρ·cp·∂T/∂t = ∇·(k∇T) + Q (forma conservativa, k variable). REQ-HEAT-001.
import { makeGrid, stepFV, stableDt, inventory } from './fv1d.js';
export { makeGrid, stableDt };

/** Paso de calor. props = { rho_cp_J_m3K: Float64Array, k_W_mK: Float64Array }. bcs: {left,right} con
 *  {type:'dirichlet',T} | {type:'robin',h,Tinf} | {type:'neumann',flux} (W/m² hacia el dominio). */
export function stepHeat(grid, T_K, props, bcs, dt_s, opts = {}) {
  return stepFV(grid, T_K, props.rho_cp_J_m3K, props.k_W_mK, bcs, dt_s, opts);
}
/** Energía interna total (J, referencia 0 K) Σ ρcp·V·T. */
export const heatContent = (grid, props, T_K) => inventory(grid, props.rho_cp_J_m3K, T_K);
