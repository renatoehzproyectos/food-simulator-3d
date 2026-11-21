// Fase 7 (REQ-TEX-001): propiedades de monotonía (property tests con PRNG con semilla) y límites.
import { describe, it, expect } from 'vitest';
import { hardness_N, softness, doneness, stickiness, textureOf, TEXTURE_PARAMS as P } from '../src/food/texture.js';
import { mulberry32 } from '../src/core/prng.js';
const rnd = mulberry32(42);
describe('textura', () => {
  it('más α ⇒ menor dureza (M, B fijos)', () => { for (let i = 0; i < 500; i++) { const M = 0.1 + 2 * rnd(), a1 = rnd(), a2 = a1 + rnd() * (1 - a1); expect(hardness_N(a2, M)).toBeLessThanOrEqual(hardness_N(a1, M) + 1e-12); } });
  it('más M ⇒ menor dureza (α, B fijos)', () => { for (let i = 0; i < 500; i++) { const a = rnd(), M1 = 0.1 + 2 * rnd(), M2 = M1 + rnd(); expect(hardness_N(a, M2)).toBeLessThanOrEqual(hardness_N(a, M1) + 1e-12); } });
  it('más α y más M ⇒ mayor softness', () => { for (let i = 0; i < 500; i++) { const a1 = rnd(), M1 = 0.1 + rnd(); expect(softness(Math.min(1, a1 + 0.1), M1 + 0.2)).toBeGreaterThanOrEqual(softness(a1, M1) - 1e-12); } });
  it('más pardeamiento B ⇒ más dureza (parte quemada)', () => { expect(hardness_N(1, 1.5, 0.8)).toBeGreaterThan(hardness_N(1, 1.5, 0.1)); });
  it('límites: crudo ≈ H_raw, cocido < crudo, nada negativo ni NaN', () => {
    expect(hardness_N(0, P.M_raw)).toBeCloseTo(P.H_raw, 9); expect(hardness_N(1, 1.5)).toBeLessThan(hardness_N(0, 0.12));
    for (let i = 0; i < 300; i++) { const t = textureOf(rnd(), 3 * rnd(), rnd()); for (const v of Object.values(t)) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); } }
  });
  it('doneness continua, en [0,1], creciente con α; 0 sin gelatinización; cocido con M en ventana', () => {
    expect(doneness(0, 1.5)).toBe(0); expect(doneness(1, 1.5)).toBeGreaterThan(0.9); expect(doneness(1, 0.2)).toBe(0);
    let prev = -1; for (let a = 0; a <= 1.0001; a += 0.05) { const d = doneness(a, 1.2); expect(d).toBeGreaterThanOrEqual(prev); expect(d).toBeLessThanOrEqual(1); prev = d; }
  });
  it('stickiness crece con α y M', () => { expect(stickiness(1, 1.5)).toBeGreaterThan(stickiness(0.3, 1.5)); expect(stickiness(1, 1.5)).toBeGreaterThan(stickiness(1, 0.4)); });
  it('cocido (α≈1, M≈1.4) más blando que firme-crudo y más duro que papilla (α=1, M=3)', () => { expect(hardness_N(1, 3)).toBeLessThan(hardness_N(1, 1.4)); });
});
