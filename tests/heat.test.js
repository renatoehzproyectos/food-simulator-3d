// Fase 4 (REQ-HEAT-001): solución analítica, convergencia, conservación de energía, estabilidad.
import { describe, it, expect } from 'vitest';
import { makeGrid, stepHeat, stableDt, heatContent } from '../src/physics/heat.js';
import { erf, fill, maxAbs } from './helpers.js';

describe('conducción vs analítica', () => {
  it('sólido semi-infinito con T superficial fija (erf)', () => {
    const k = 0.6, rc = 1e6, a = k / rc, N = 600, g = makeGrid({ n: N, length_m: 0.3 });
    let T = fill(N, 300); const props = { rho_cp_J_m3K: fill(N, rc), k_W_mK: fill(N, k) };
    const dt = 0.5, tEnd = 600; for (let t = 0; t < tEnd - 1e-9; t += dt) T = stepHeat(g, T, props, { left: { type: 'dirichlet', T: 400 } }, dt, { scheme: 'implicit' }).T;
    const err = maxAbs(T, (i) => 400 + (300 - 400) * erf(g.xc[i] / (2 * Math.sqrt(a * tEnd))));
    expect(err / 100).toBeLessThan(0.005);
  });
  it('slab con Dirichlet 0: modo sin(πx/L) decae como exp(−α(π/L)²t)', () => {
    const run = (n, dt) => {
      const L = 0.1, k = 0.6, rc = 1e6, a = k / rc, tEnd = 800, g = makeGrid({ n, length_m: L });
      let T = Float64Array.from(g.xc, (x) => Math.sin(Math.PI * x / L)); const p = { rho_cp_J_m3K: fill(n, rc), k_W_mK: fill(n, k) };
      for (let i = 0; i < Math.round(tEnd / dt); i++) T = stepHeat(g, T, p, { left: { type: 'dirichlet', T: 0 }, right: { type: 'dirichlet', T: 0 } }, dt, { scheme: 'cn' }).T;
      return maxAbs(T, (i) => Math.exp(-a * (Math.PI / L) ** 2 * tEnd) * Math.sin(Math.PI * g.xc[i] / L));
    };
    const e1 = run(20, 40), e2 = run(40, 20), e3 = run(80, 10);
    expect(e1 / e2).toBeGreaterThan(3.5); expect(e2 / e3).toBeGreaterThan(3.5); // 2.º orden en dx y dt
  });
  it.each([['cylindrical', 4], ['spherical', 6]])('estado estacionario con fuente en %s', (geometry, div) => {
    const R = 0.05, k = 0.6, Qv = 1000, Ts = 300, n = 100, g = makeGrid({ n, length_m: R, geometry });
    let T = fill(n, Ts); const p = { rho_cp_J_m3K: fill(n, 1e6), k_W_mK: fill(n, k) };
    for (let i = 0; i < 20; i++) T = stepHeat(g, T, p, { right: { type: 'dirichlet', T: Ts } }, 1e6, { scheme: 'implicit', Q: fill(n, Qv) }).T;
    const err = maxAbs(T, (i) => Ts + Qv * (R * R - g.xc[i] ** 2) / (div * k));
    expect(err / (Qv * R * R / (div * k))).toBeLessThan(1e-3);
  });
});

describe('conservación de energía', () => {
  it.each(['cn', 'implicit', 'explicit'])('balance con Robin + flujo + fuente + k variable (%s)', (scheme) => {
    const n = 50, g = makeGrid({ n, length_m: 0.1, x0_m: 0.02, geometry: 'cylindrical', measure: 2 * Math.PI * 0.2 });
    const rc = Float64Array.from({ length: n }, (_, i) => 1e6 + 2e5 * Math.sin(i)), k = Float64Array.from({ length: n }, (_, i) => 0.4 + 0.3 * Math.cos(i / 5) ** 2);
    const p = { rho_cp_J_m3K: rc, k_W_mK: k }, bcs = { left: { type: 'robin', h: 50, Tinf: 450 }, right: { type: 'neumann', flux: 300 } };
    let T = Float64Array.from({ length: n }, (_, i) => 300 + 10 * Math.sin(i / 3)); const E0 = heatContent(g, p, T);
    const dt = scheme === 'explicit' ? 0.5 * stableDt(g, rc, k, bcs) : 5; let inflow = 0; const steps = scheme === 'explicit' ? 2000 : 200;
    for (let i = 0; i < steps; i++) { const r = stepHeat(g, T, p, bcs, dt, { scheme, Q: fill(n, 2000) }); expect(r.scheme).toBe(scheme); T = r.T; inflow += r.boundaryEnergy + r.sourceEnergy; }
    const dE = heatContent(g, p, T) - E0;
    expect(Math.abs(dE - inflow) / Math.abs(inflow)).toBeLessThan(1e-9);
  });
});

describe('estabilidad numérica', () => {
  const n = 40, g = makeGrid({ n, length_m: 0.04 }), p = { rho_cp_J_m3K: fill(n, 1e6), k_W_mK: fill(n, 0.6) };
  const bcs = { left: { type: 'dirichlet', T: 500 }, right: { type: 'dirichlet', T: 300 } };
  const T0 = Float64Array.from({ length: n }, (_, i) => (i % 7 ? 300 : 320));
  it('explícito con dt > dt_estable cambia a implícito y no explota (principio del máximo)', () => {
    const dt = 50 * stableDt(g, p.rho_cp_J_m3K, p.k_W_mK, bcs); const r = stepHeat(g, T0, p, bcs, dt, { scheme: 'explicit' });
    expect(r.switched).toBe(true); expect(r.scheme).toBe('implicit');
    for (const v of r.T) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(300 - 1e-9); expect(v).toBeLessThanOrEqual(500 + 1e-9); }
  });
  it('dt estable explícito ≈ criterio α·dt/dx² ≤ 1/2 en interior', () => { // k=0.6, rho_cp=1e6, dx=1e-3 → 0.5·dx²/α ≈ 0.83 s (borde Dirichlet lo reduce)
    const dts = stableDt(g, p.rho_cp_J_m3K, p.k_W_mK, bcs); expect(dts).toBeLessThanOrEqual(0.5 * (1e-3) ** 2 / 6e-7 + 1e-12); expect(dts).toBeGreaterThan(0.2);
  });
  it('explícito estable coincide con implícito de paso pequeño', () => {
    const dt = 0.9 * stableDt(g, p.rho_cp_J_m3K, p.k_W_mK, bcs); let A = T0, B = T0;
    for (let i = 0; i < 200; i++) A = stepHeat(g, A, p, bcs, dt, { scheme: 'explicit' }).T;
    for (let i = 0; i < 800; i++) B = stepHeat(g, B, p, bcs, dt / 4, { scheme: 'implicit' }).T;
    expect(maxAbs(A, (i) => B[i])).toBeLessThan(1.5);
  });
  it('auto: informa el esquema usado', () => { expect(['cn', 'implicit']).toContain(stepHeat(g, T0, p, bcs, 1, { scheme: 'auto' }).scheme); });
});
