import { describe, it, expect } from 'vitest';
import { FoodSimulator } from '../src/core/simulator.js';
import { ValidationError } from '../src/core/validation.js';
// Alimento de juguete: solo para probar el contrato de sesión (no es un modelo científico).
const toy = { name: 'rice', version: '0.0-toy',
  init: () => ({ x: 1, heat: 0 }),
  step: (s, dt, ctx) => { s.x *= Math.exp(-0.01 * dt * (1 + s.heat)); if (s.x < 0.5 && !s.done) { s.done = true; ctx.emit('HALF'); } },
  command: (s, c) => { if (c.type === 'SET_HEAT') s.heat = c.power_W; },
  snapshot: (s) => ({ x: s.x }) };
const input = { food: 'rice', ingredients: { rice: { mass_g: 200 }, water: { mass_g: 300 } }, environment: { duration_s: 100 }, simulation: { timeStep_s: 0.5, seed: 3 } };
describe('contrato de sesión', () => {
  const sim = new FoodSimulator().registerFood(toy);
  it('entrada inválida → ValidationError accionable', () => { expect(() => sim.createSession({ food: 'rice' })).toThrow(ValidationError); });
  it('alimento no registrado', () => { expect(() => new FoodSimulator().createSession(input)).toThrow(/no registrado/); });
  it('determinismo: dos corridas idénticas', async () => {
    const a = await sim.simulate(input), b = await sim.simulate(input);
    expect(a.final.x).toBe(b.final.x); expect(a.final.t_s).toBeCloseTo(100, 9);
  });
  it('pasos fijos independientes del framerate', () => {
    const s1 = sim.createSession(input), s2 = sim.createSession(input);
    for (let i = 0; i < 100; i++) s1.advance(0.1); s2.advance(10);
    expect(s1.snapshot().x).toBeCloseTo(s2.snapshot().x, 12); expect(s1.step).toBe(s2.step);
  });
  it('comandos y eventos; snapshot congelado', () => {
    const s = sim.createSession(input); const got = []; s.on('HALF', (e) => got.push(e));
    s.command({ type: 'SET_HEAT', power_W: 100 }); s.advance(50);
    expect(got.length).toBe(1); const snap = s.snapshot();
    expect(Object.isFrozen(snap)).toBe(true); expect(snap.balances).toBeDefined();
  });
  it('tope de pasos por advance (no bloquea la UI)', () => { const s = sim.createSession(input); expect(s.advance(1e6)).toBe(2000); });
  it('comando sin type falla', () => { expect(() => sim.createSession(input).command({})).toThrow(ValidationError); });
});
