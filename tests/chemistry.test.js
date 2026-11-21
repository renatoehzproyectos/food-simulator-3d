// Fase 6 (REQ-EXT-001, sec. 8): cinética isotérmica vs analítica, Arrhenius, dependencias T/pH/aw/M/O2.
import { describe, it, expect } from 'vitest';
import { defineReaction, integrateReactions, arrheniusK, arrheniusRef } from '../src/chemistry/reactions.js';
import { R_GAS } from '../src/core/units.js';
import { gelatinization, stepStarch, kGel, fWater, STARCH_PARAMS as SP } from '../src/chemistry/starch.js';
import { denaturation, kDenat } from '../src/chemistry/proteins.js';
import { maillard, kMaillard, gAw } from '../src/chemistry/maillard.js';
import { caramelization, kCaramel } from '../src/chemistry/caramelization.js';
import { oxidation, kOx } from '../src/chemistry/oxidation.js';
import { pHFactor } from '../src/chemistry/ph.js';
const C2K = (c) => c + 273.15;

describe('reactions.js', () => {
  it('Arrhenius: k(T2)/k(T1) = exp(Ea/R·(1/T1 − 1/T2)); A·exp y k_ref coinciden', () => {
    const Ea = 80e3, A = 1e10, T1 = 330, T2 = 360;
    expect(arrheniusK(A, Ea, T2) / arrheniusK(A, Ea, T1)).toBeCloseTo(Math.exp(Ea / R_GAS * (1 / T1 - 1 / T2)), 10);
    expect(arrheniusRef(arrheniusK(A, Ea, T1), T1, Ea, T2)).toBeCloseTo(arrheniusK(A, Ea, T2), 6);
  });
  it('A→B isotérmica vs analítica y conservación A+B', () => {
    const k = 0.01, r = defineReaction({ id: 'AB', source: 'test', consumes: ['A'], produces: ['B'], rate: (T, s) => k * s.A });
    const sol = integrateReactions([r], { A: 1, B: 0 }, { T_K: 300, tSpan: [0, 300], rtol: 1e-9, atol: 1e-12 });
    expect(Math.abs(sol.y.A.at(-1) - Math.exp(-k * 300))).toBeLessThan(1e-7);
    sol.t.forEach((_, i) => expect(sol.y.A[i] + sol.y.B[i]).toBeCloseTo(1, 9));
  });
  it('sistema rígido (k rápida + lenta) con Rosenbrock', () => {
    const r1 = defineReaction({ id: 'fast', source: 't', consumes: ['A'], produces: ['B'], rate: (T, s) => 1e4 * s.A });
    const r2 = defineReaction({ id: 'slow', source: 't', consumes: ['B'], produces: ['C'], rate: (T, s) => 1e-2 * s.B });
    const s = integrateReactions([r1, r2], { A: 1, B: 0, C: 0 }, { T_K: 300, tSpan: [0, 100], stiff: true });
    expect(s.method).toBe('rosenbrock'); expect(s.y.C.at(-1)).toBeCloseTo(1 - Math.exp(-1), 2);
  });
  it('añadir una reacción es añadir un objeto (sin tocar el núcleo) y especie desconocida falla', () => {
    const extra = defineReaction({ id: 'x', source: 't', produces: ['Z'], rate: () => 2 });
    expect(integrateReactions([extra], { Z: 0 }, { T_K: 300, tSpan: [0, 3] }).y.Z.at(-1)).toBeCloseTo(6, 6);
    expect(() => integrateReactions([extra], { Q: 0 }, { T_K: 300, tSpan: [0, 1] })).toThrow(/Z/);
    expect(() => defineReaction({ id: 'bad' })).toThrow();
  });
});

describe('gelatinización (starch.js)', () => {
  it('isotérmica: α(t)=1−exp(−k f t) y paso exacto = integración ODE', () => {
    const T = C2K(90), M = 1.2, k = kGel(T), t = 20;
    const sol = integrateReactions([gelatinization], { alpha: 0 }, { T_K: T, env: { M_db: M }, tSpan: [0, t], rtol: 1e-10, atol: 1e-13 });
    expect(sol.y.alpha.at(-1)).toBeCloseTo(1 - Math.exp(-k * t), 7);
    let a = 0; for (let i = 0; i < 200; i++) a = stepStarch(a, T, M, t / 200); expect(a).toBeCloseTo(1 - Math.exp(-k * t), 12);
  });
  it('k(T) creciente, continua en T_break y con cambio de pendiente (Arrhenius a tramos)', () => {
    let prev = 0; for (let c = 40; c <= 120; c += 5) { const k = kGel(C2K(c)); expect(k).toBeGreaterThan(prev); prev = k; }
    expect(kGel(SP.T_break_K + 1e-9) / kGel(SP.T_break_K - 1e-9)).toBeCloseTo(1, 6);
    expect(kGel(C2K(100)) / kGel(C2K(90))).toBeLessThan(kGel(C2K(70)) / kGel(C2K(60))); // Ea alta abajo, baja arriba
  });
  it('DSC: a 10 K/min con agua en exceso α=0.5 cae en el rango publicado (~65–85 °C; pico Basmati 74.2 °C)', () => {
    const beta = 10 / 60; let a = 0, T = C2K(30), dt = 0.05;
    while (a < 0.5 && T < C2K(120)) { a = stepStarch(a, T, 2, dt); T += beta * dt; }
    expect(T - 273.15).toBeGreaterThan(65); expect(T - 273.15).toBeLessThan(85);
  });
  it('sin agua suficiente no gelatiniza; f(M) monótona en [0,1]', () => {
    expect(stepStarch(0, C2K(100), SP.M0_db - 0.01, 600)).toBe(0);
    let p = -1; for (let M = 0; M < 2; M += 0.05) { const f = fWater(M); expect(f).toBeGreaterThanOrEqual(p); expect(f).toBeLessThanOrEqual(1); p = f; }
  });
  it('a 60 °C la gelatinización es lenta frente a 100 °C (S5: escenario "sin hervir")', () => {
    expect(stepStarch(0, C2K(60), 2, 1200)).toBeLessThan(0.9); expect(stepStarch(0, C2K(100), 2, 60)).toBeGreaterThan(0.99);
  });
  it('α permanece en [0,1]', () => { let a = 0; for (let i = 0; i < 1000; i++) { a = stepStarch(a, C2K(100), 2, 10); expect(a).toBeLessThanOrEqual(1); } expect(a).toBeGreaterThanOrEqual(0); });
});

describe('proteínas, Maillard, caramelización, oxidación', () => {
  it('proteínas: isotérmica analítica; N decrece con T y depende del pH', () => {
    const T = C2K(85), pH = 6.5, k = kDenat(T, pH), sol = integrateReactions([denaturation], { N: 1 }, { T_K: T, env: { pH }, tSpan: [0, 5], rtol: 1e-10, atol: 1e-13 });
    expect(sol.y.N.at(-1)).toBeCloseTo(Math.exp(-k * 5), 8);
    expect(kDenat(C2K(95), 6.5)).toBeGreaterThan(kDenat(C2K(85), 6.5)); expect(kDenat(T, 5.5)).not.toBe(kDenat(T, 7.5));
    expect(pHFactor(6.5, { pH_ref: 6.5, slope: 0.3 })).toBe(1);
  });
  it('Maillard: casi nulo con agua abundante, máximo a aw≈0.65, crece con T; consume precursores y conserva B+S', () => {
    expect(gAw(0.65)).toBeCloseTo(1, 12); expect(kMaillard(C2K(150), 1.0, 6.5)).toBeLessThan(0.1 * kMaillard(C2K(150), 0.65, 6.5));
    expect(kMaillard(C2K(160), 0.65, 6.5)).toBeGreaterThan(kMaillard(C2K(120), 0.65, 6.5));
    const s = integrateReactions([maillard], { S: 1, AA: 1, B: 0 }, { T_K: C2K(160), env: { aw: 0.65, pH: 6.5 }, tSpan: [0, 600], stiff: true });
    expect(s.y.B.at(-1)).toBeGreaterThan(0); expect(s.y.S.at(-1)).toBeLessThan(1); expect(s.y.S.at(-1) + s.y.B.at(-1)).toBeCloseTo(1, 6);
  });
  it('caramelización: umbral emergente (k cae >100× de 160 a 120 °C) e isotérmica analítica', () => {
    expect(kCaramel(C2K(160)) / kCaramel(C2K(120))).toBeGreaterThan(100);
    const T = C2K(165), sol = integrateReactions([caramelization], { C: 0 }, { T_K: T, tSpan: [0, 300], rtol: 1e-10, atol: 1e-13 });
    expect(sol.y.C.at(-1)).toBeCloseTo(1 - Math.exp(-kCaramel(T) * 300), 8);
  });
  it('oxidación: sin O2 no avanza, k ∝ pO2 y crece con T', () => {
    expect(kOx(300, 0)).toBe(0); expect(kOx(300, 0.21) / kOx(300, 0.105)).toBeCloseTo(2, 10); expect(kOx(350, 0.21)).toBeGreaterThan(kOx(300, 0.21));
    const sol = integrateReactions([oxidation], { Ox: 0 }, { T_K: 320, env: { pO2: 0.21 }, tSpan: [0, 1e5], rtol: 1e-9, atol: 1e-12 });
    expect(sol.y.Ox.at(-1)).toBeCloseTo(1 - Math.exp(-kOx(320, 0.21) * 1e5), 6);
  });
});
