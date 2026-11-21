// Fase 5 (REQ-MOIST-001, REQ-EVAP-001, REQ-BAL-001): difusión, absorción, evaporación, ebullición.
import { describe, it, expect } from 'vitest';
import { createGrain, stepGrain, grainWater_kg, meanMoisture_db, RICE_GRAIN_DEFAULTS as P } from '../src/physics/moisture.js';
import { stepFick, makeGrid, arrhenius } from '../src/physics/diffusion.js';
import { pSatWater_Pa, surfaceEvaporation, boilExcess, CP_WATER } from '../src/physics/evaporation.js';
import { makeGrid as mg, stepHeat } from '../src/physics/heat.js';
import { L_V_WATER, T_BOIL_K } from '../src/core/units.js';
import { fill } from './helpers.js';

describe('Fick en esfera vs serie analítica', () => {
  it('M media del grano con superficie a M_eq', () => {
    const R = 1.2e-3, D = 2e-10, M0 = 0.136, Ms = 1.8, tEnd = 3000, dt = 2, n = 60;
    const g = makeGrid({ n, length_m: R, geometry: 'spherical', measure: 4 * Math.PI }); let M = fill(n, M0); const Dv = fill(n, D);
    for (let t = 0; t < tEnd - 1e-9; t += dt) M = stepFick(g, M, Dv, { right: { type: 'dirichlet', T: Ms } }, dt, { scheme: 'implicit' }).T;
    let inv = 0; for (let i = 0; i < n; i++) inv += M[i] * g.V[i]; const mean = inv / (4 / 3 * Math.PI * R ** 3);
    let s = 0; for (let k = 1; k <= 200; k++) s += Math.exp(-k * k * Math.PI ** 2 * D * tEnd / R ** 2) / (k * k);
    const exact = Ms - (Ms - M0) * 6 / Math.PI ** 2 * s;
    expect(Math.abs(mean - exact) / (Ms - M0)).toBeLessThan(0.01);
  });
  it('límite estacionario: M → M_eq', () => {
    const g = createGrain({ radius_m: 1e-3, M0_db: 0.1 }); for (let i = 0; i < 400; i++) stepGrain(g, { T_K: 373.15, wet: true, dt_s: 100 });
    expect(Math.max(...g.M)).toBeLessThanOrEqual(1.8 + 1e-9); expect(meanMoisture_db(g)).toBeCloseTo(1.8, 3);
  });
  it('D crece con T (Arrhenius)', () => { expect(arrhenius(P.D0_m2_s, P.Ea_J_mol, 373.15)).toBeCloseTo(2e-10, 11); expect(arrhenius(P.D0_m2_s, P.Ea_J_mol, 373.15)).toBeGreaterThan(arrhenius(P.D0_m2_s, P.Ea_J_mol, 293.15)); });
});

describe('absorción y balance de masa', () => {
  it('monótona, con agua libre limitada: masa total conservada y agua libre ≥ 0', () => {
    const g = createGrain({ radius_m: 1.2e-3, M0_db: 0.136 }), N = 5000; let pool = 0.4 * N * grainWater_kg(g) / 0.136 * 0.3; // agua escasa
    const total0 = pool + N * grainWater_kg(g); let prev = meanMoisture_db(g), limitedSeen = false;
    for (let i = 0; i < 600; i++) {
      const r = stepGrain(g, { T_K: 373.15, wet: pool > 0, dt_s: 5, availableWater_kg: pool, nGrains: N }); pool -= r.uptake_kg; limitedSeen ||= r.limited;
      expect(pool).toBeGreaterThanOrEqual(-1e-12); const m = meanMoisture_db(g); expect(m).toBeGreaterThanOrEqual(prev - 1e-12); prev = m;
    }
    expect(limitedSeen).toBe(true);
    expect(Math.abs(pool + N * grainWater_kg(g) - total0) / total0).toBeLessThan(1e-12);
  });
  it('sin agua líquida el grano pierde agua por la superficie (flujo evaporativo)', () => {
    const g = createGrain({ radius_m: 1e-3, M0_db: 1.0 }); const w0 = grainWater_kg(g);
    const r = stepGrain(g, { T_K: 373.15, wet: false, dt_s: 10, evapFlux_kg_m2s: 1e-4 });
    const expected = -1e-4 * 4 * Math.PI * 1e-6 * 10; expect(r.uptake_kg).toBeCloseTo(expected, 12); expect(grainWater_kg(g)).toBeLessThan(w0);
  });
});

describe('evaporación (REQ-EVAP-001)', () => {
  it('Antoine: P_sat(100 °C)≈101.3 kPa y P_sat(20 °C)≈2.34 kPa', () => {
    expect(Math.abs(pSatWater_Pa(373.15) - 101325) / 101325).toBeLessThan(0.002); expect(Math.abs(pSatWater_Pa(293.15) - 2339) / 2339).toBeLessThan(0.01);
  });
  const base = { T_ambient_K: 293.15, RH: 0.5, area_m2: 0.03, h_m_m_s: 0.005 };
  it('crece con T, es 0 si el aire está saturado y la tapa reduce la pérdida', () => {
    const a = surfaceEvaporation({ ...base, T_surface_K: 330 }).evaporated_kg_s, b = surfaceEvaporation({ ...base, T_surface_K: 360 }).evaporated_kg_s;
    expect(b).toBeGreaterThan(a); expect(a).toBeGreaterThan(0);
    expect(surfaceEvaporation({ ...base, T_surface_K: 293.15, RH: 1 }).evaporated_kg_s).toBe(0);
    const lid = surfaceEvaporation({ ...base, T_surface_K: 360, lid: { closed: true, leakFraction: 0.1 } });
    expect(lid.lost_kg_s).toBeCloseTo(0.1 * b, 15); expect(lid.lost_kg_s + lid.returned_kg_s).toBeCloseTo(b, 15);
  });
});

describe('ebullición: clamp a 100 °C y balance de energía (REQ-BAL-001)', () => {
  it('columna de agua calentada desde abajo', () => {
    const n = 30, H = 0.01, A = 0.03, g = mg({ n, length_m: H, measure: A }), rho = 958, k = 20; // ASSUMPTION de prueba: k efectivo alto (mezcla convectiva); con k=0.68 el fondo se seca antes
    const m = fill(n, rho * A * H / n); const m0 = m.reduce((a, b) => a + b); let T = fill(n, 293.15);
    const E0 = m.reduce((s, mi, i) => s + mi * CP_WATER * T[i], 0); let Qin = 0, vap = 0, Evap = 0, boiled = false;
    for (let i = 0; i < 1000; i++) {
      const C = Float64Array.from(m, (mi) => mi * CP_WATER / (A * H / n)), kk = fill(n, k);
      const r = stepHeat(g, T, { rho_cp_J_m3K: C, k_W_mK: kk }, { left: { type: 'neumann', flux: 5000 } }, 1, { scheme: 'implicit' });
      T = r.T; Qin += r.boundaryEnergy; const v = boilExcess(T, m); vap += v; Evap += v * (L_V_WATER + CP_WATER * T_BOIL_K); boiled ||= v > 0;
      expect(Math.max(...T)).toBeLessThanOrEqual(T_BOIL_K + 1e-9);
    }
    expect(boiled).toBe(true); expect(Math.min(...m)).toBeGreaterThan(0);
    const Eliq = m.reduce((s, mi, i) => s + mi * CP_WATER * T[i], 0), mNow = m.reduce((a, b) => a + b);
    expect(Math.abs((m0 - mNow) - vap) / m0).toBeLessThan(1e-12);                  // masa
    expect(Math.abs(Eliq + Evap - E0 - Qin) / Qin).toBeLessThan(1e-9);             // energía
  });
  it('exceso energético → vapor = m·cp·ΔT/L_v exacto', () => {
    const T = Float64Array.from([383.15]), m = Float64Array.from([1]); const v = boilExcess(T, m);
    expect(v).toBeCloseTo(CP_WATER * 10 / L_V_WATER, 12); expect(T[0]).toBe(T_BOIL_K); expect(m[0]).toBeCloseTo(1 - v, 14);
  });
});
