// Fase 3: validación vs soluciones analíticas y orden de convergencia (REQ-NUM-001/002).
import { describe, it, expect } from 'vitest';
import { solveODE } from '../src/numerical/ode.js';
import { solveTridiagonal, conjugateGradient } from '../src/numerical/matrices.js';
const k = 2; const f = (t, y) => [-k * y[0]];
const errAt = (method, n) => { const r = solveODE(f, [0, 1], [1], { method, nSteps: n }); return Math.abs(r.y[0].at(-1) - Math.exp(-k)); };
describe('REQ-NUM-001 ODE', () => {
  it('orden de convergencia observado: euler≈1, rk2≈2, rk4≈4', () => {
    for (const [m, p] of [['euler', 1], ['rk2', 2], ['rk4', 4]]) {
      const order = Math.log2(errAt(m, 20) / errAt(m, 40));
      expect(order).toBeGreaterThan(p - 0.2); expect(order).toBeLessThan(p + 0.3);
    }
  });
  it('rk45 adaptativo cumple tolerancia', () => {
    const r = solveODE(f, [0, 5], [1], { method: 'rk45', rtol: 1e-8, atol: 1e-12 });
    expect(Math.abs(r.y[0].at(-1) - Math.exp(-k * 5)) / Math.exp(-k * 5)).toBeLessThan(1e-6);
  });
  it('auto elige rk45 / rosenbrock según rigidez', () => {
    expect(solveODE(f, [0, 1], [1]).method).toBe('rk45');
    expect(solveODE(f, [0, 1], [1], { stiff: true }).method).toBe('rosenbrock');
  });
  it('evento en rk45: y=0.5 en ln2/k', () => {
    const r = solveODE(f, [0, 3], [1], { method: 'rk45', rtol: 1e-9, atol: 1e-12, events: (t, y) => y[0] - 0.5 });
    expect(r.events[0].t[0]).toBeCloseTo(Math.LN2 / k, 6);
  });
  it('evento en rosenbrock (bisección propia)', () => {
    const r = solveODE(f, [0, 3], [1], { method: 'rosenbrock', rtol: 1e-9, atol: 1e-12, events: (t, y) => y[0] - 0.5 });
    expect(r.events[0].t[0]).toBeCloseTo(Math.LN2 / k, 5);
  });
  it('sistema rígido (λ=-1e4) estable con rosenbrock', () => {
    const r = solveODE((t, y) => [-1e4 * (y[0] - Math.cos(t))], [0, 1], [0], { method: 'rosenbrock', rtol: 1e-6, atol: 1e-9 });
    expect(Number.isFinite(r.y[0].at(-1))).toBe(true); expect(r.y[0].at(-1)).toBeCloseTo(Math.cos(1), 2);
  });
  it('método desconocido lanza error', () => { expect(() => solveODE(f, [0, 1], [1], { method: 'x' })).toThrow(); });
});
// Difusión 1D por método de líneas: u_t = D u_xx, u(0)=u(L)=0, u0 = sin(πx/L) → u = exp(-D(π/L)²t) sin(πx/L)
describe('difusión 1D (método de líneas) vs analítica', () => {
  const D = 1e-2, L = 1, N = 41, dx = L / (N + 1), T = 5;
  const rhs = (t, u) => u.map((_, i) => D * ((u[i - 1] ?? 0) - 2 * u[i] + (u[i + 1] ?? 0)) / dx ** 2);
  const x = Array.from({ length: N }, (_, i) => (i + 1) * dx), u0 = x.map((v) => Math.sin(Math.PI * v / L));
  const exact = (i) => Math.exp(-D * (Math.PI / L) ** 2 * T) * u0[i];
  for (const method of ['rk45', 'rosenbrock']) it(`${method}`, () => {
    const r = solveODE(rhs, [0, T], u0, { method, rtol: 1e-8, atol: 1e-10 });
    const mid = N >> 1; expect(Math.abs(r.y[mid].at(-1) - exact(mid))).toBeLessThan(1e-3);
  });
});
describe('REQ-NUM-002 matrices', () => {
  it('Thomas resuelve Poisson 1D con solución conocida', () => {
    const n = 50, h = 1 / (n + 1);
    const a = new Float64Array(n).fill(-1), b = new Float64Array(n).fill(2), c = new Float64Array(n).fill(-1);
    const xs = Array.from({ length: n }, (_, i) => (i + 1) * h);
    const d = Float64Array.from(xs, (x) => h * h * Math.PI ** 2 * Math.sin(Math.PI * x));
    const sol = solveTridiagonal(a, b, c, d);
    expect(Math.max(...Array.from(sol, (v, i) => Math.abs(v - Math.sin(Math.PI * xs[i]))))).toBeLessThan(1e-3);
  });
  it('Thomas no modifica entradas y detecta pivote nulo', () => {
    const b = new Float64Array([2, 2]); const bc = Float64Array.from(b);
    solveTridiagonal(new Float64Array(2), b, new Float64Array(2), new Float64Array([1, 1])); expect(b).toEqual(bc);
    expect(() => solveTridiagonal(new Float64Array(2), new Float64Array([0, 1]), new Float64Array(2), new Float64Array(2))).toThrow();
  });
  it('CG coincide con Thomas', () => {
    const n = 30, mv = (x, o) => { for (let i = 0; i < n; i++) o[i] = 2 * x[i] - (x[i - 1] ?? 0) - (x[i + 1] ?? 0); };
    const b = new Float64Array(n).fill(1);
    const t = solveTridiagonal(new Float64Array(n).fill(-1), new Float64Array(n).fill(2), new Float64Array(n).fill(-1), b);
    const { x, residual } = conjugateGradient(mv, b); expect(residual).toBeLessThan(1e-9);
    x.forEach((v, i) => expect(v).toBeCloseTo(t[i], 7));
  });
});
