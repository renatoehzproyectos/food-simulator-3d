// @ts-check
// Volúmenes finitos 1D conservativos (planar / cilíndrico / esférico) con k variable y esquema θ.
// Base común de calor (heat.js) y difusión de humedad (diffusion.js). REQ-HEAT-001, REQ-MOIST-001.
//   C_i V_i dT_i/dt = Σ_caras G_f (T_vecino − T_i) + flujos de borde + Q_i V_i
import { solveTridiagonal } from '../numerical/matrices.js';

const M_EXP = { planar: 0, cylindrical: 1, spherical: 2 };
/**
 * @param {{n:number, length_m:number, x0_m?:number, geometry?:'planar'|'cylindrical'|'spherical', measure?:number}} o
 * measure: factor global (área m² en planar, 2π·altura en cilindro, 4π en esfera) para obtener magnitudes absolutas.
 */
export function makeGrid({ n, length_m, x0_m = 0, geometry = 'planar', measure = 1 }) {
  const m = M_EXP[geometry]; if (m === undefined) throw new Error(`geometría desconocida: ${geometry}`);
  const dx = length_m / n;
  const xf = new Float64Array(n + 1).map((_, i) => x0_m + i * dx);
  const Af = xf.map((x) => measure * x ** m);
  const V = new Float64Array(n).map((_, i) => measure * (xf[i + 1] ** (m + 1) - xf[i] ** (m + 1)) / (m + 1));
  const xc = new Float64Array(n).map((_, i) => x0_m + (i + 0.5) * dx);
  return { n, dx, geometry, m, xf, Af, V, xc, measure };
}

/** Coeficientes de borde: devuelve {G, Tb, q}. Flujo hacia el dominio = G(Tb − Tcell) + q·A. */
function boundary(bc, k, A, dx) {
  if (!bc || bc.type === 'neumann') return { G: 0, Tb: 0, flux: (bc?.flux ?? 0) * A };
  if (bc.type === 'dirichlet') return { G: k * A / (dx / 2), Tb: bc.T, flux: 0 };
  if (bc.type === 'robin') return { G: A / (1 / bc.h + dx / (2 * k)), Tb: bc.Tinf, flux: 0 };
  throw new Error(`BC desconocida: ${bc.type}`);
}
const harm = (a, b) => 2 * a * b / (a + b);

/** Paso máximo estable del esquema explícito (positividad): min_i C_i V_i / ΣG_i. */
export function stableDt(grid, C, k, bcs = {}) {
  const { n, dx, Af, V } = grid; let dt = Infinity;
  const bl = boundary(bcs.left, k[0], Af[0], dx), br = boundary(bcs.right, k[n - 1], Af[n], dx);
  for (let i = 0; i < n; i++) {
    const gl = i > 0 ? harm(k[i - 1], k[i]) * Af[i] / dx : bl.G;
    const gr = i < n - 1 ? harm(k[i], k[i + 1]) * Af[i + 1] / dx : br.G;
    const s = gl + gr; if (s > 0) dt = Math.min(dt, C[i] * V[i] / s);
  }
  return dt;
}

/**
 * Un paso de tiempo. C: capacidad volumétrica ρ·cp (J/m³K; =1 para difusión), k: conductividad/difusividad por celda
 * (se pueden actualizar en cada paso: coeficientes "rezagados"). Q: fuente volumétrica (W/m³) opcional.
 * scheme: 'explicit' | 'implicit' | 'cn' | 'auto'. Si 'explicit' viola la estabilidad se cambia a 'implicit' (switched=true).
 * 'auto': 'cn' si dt ≤ 4·dt_estable, si no 'implicit' (CN pierde monotonía con pasos muy grandes).
 * @returns {{T:Float64Array, scheme:string, switched:boolean, boundaryEnergy:number, sourceEnergy:number, stableDt:number}}
 */
export function stepFV(grid, T, C, k, bcs, dt, { scheme = 'auto', Q } = {}) {
  const { n, dx, Af, V } = grid;
  const dtS = stableDt(grid, C, k, bcs);
  let used = scheme, switched = false;
  if (scheme === 'explicit' && dt > dtS) { used = 'implicit'; switched = true; }
  if (scheme === 'auto') used = dt <= 4 * dtS ? 'cn' : 'implicit';
  const theta = used === 'explicit' ? 0 : used === 'cn' ? 0.5 : 1;
  const bl = boundary(bcs.left, k[0], Af[0], dx), br = boundary(bcs.right, k[n - 1], Af[n], dx);
  const Gf = new Float64Array(n + 1); // Gf[i] = conductancia de la cara i (i=0 y n: bordes)
  Gf[0] = bl.G; Gf[n] = br.G;
  for (let i = 1; i < n; i++) Gf[i] = harm(k[i - 1], k[i]) * Af[i] / dx;
  const flowIn = (Tv, i) => { // flujo neto hacia la celda i desde caras
    const left = i > 0 ? Gf[i] * (Tv[i - 1] - Tv[i]) : bl.G * (bl.Tb - Tv[0]) + bl.flux;
    const right = i < n - 1 ? Gf[i + 1] * (Tv[i + 1] - Tv[i]) : br.G * (br.Tb - Tv[n - 1]) + br.flux;
    return left + right;
  };
  const bndFlux = (Tv) => bl.G * (bl.Tb - Tv[0]) + bl.flux + br.G * (br.Tb - Tv[n - 1]) + br.flux;
  const a = new Float64Array(n), b = new Float64Array(n), c = new Float64Array(n), d = new Float64Array(n);
  let srcE = 0;
  for (let i = 0; i < n; i++) {
    const cv = C[i] * V[i], q = (Q ? Q[i] : 0) * V[i]; srcE += q * dt;
    const gl = Gf[i], gr = Gf[i + 1];
    a[i] = i > 0 ? -theta * dt * gl : 0; c[i] = i < n - 1 ? -theta * dt * gr : 0;
    b[i] = cv + theta * dt * (gl + gr);
    let rhs = cv * T[i] + dt * q + (1 - theta) * dt * flowIn(T, i);
    if (i === 0) rhs += theta * dt * (bl.G * bl.Tb + bl.flux);
    if (i === n - 1) rhs += theta * dt * (br.G * br.Tb + br.flux);
    d[i] = rhs;
  }
  const Tn = solveTridiagonal(a, b, c, d);
  const boundaryEnergy = dt * (theta * bndFlux(Tn) + (1 - theta) * bndFlux(T));
  return { T: Tn, scheme: used, switched, boundaryEnergy, sourceEnergy: srcE, stableDt: dtS };
}
/** Energía/inventario: Σ C_i V_i T_i. */
export function inventory(grid, C, T) { let s = 0; for (let i = 0; i < grid.n; i++) s += C[i] * grid.V[i] * T[i]; return s; }
