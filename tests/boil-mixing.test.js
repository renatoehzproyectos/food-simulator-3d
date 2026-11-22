// REQ-HEAT-001 / D26: bajo ebullición el agua es casi isoterma; el arroz no se cuece con agua a 70 °C.
import { describe, it, expect } from 'vitest';
import { createFoodSimulator } from '../src/registry.js';

function run(minutes) {
  const s = createFoodSimulator().createSession({ food: 'rice', simulation: { timeStep_s: 0.5, seed: 1 } }, { skipValidation: true });
  s.command({ type: 'ADD_INGREDIENT', containerId: 'pot', ingredient: 'rice', mass_kg: 0.2 });
  s.command({ type: 'POUR_LIQUID', toId: 'pot', liquid: 'water', mass_kg: 2.7 });
  s.command({ type: 'PLACE_ON_HEAT', containerId: 'pot', sourceId: 'h', power_W: 1000 });
  s.command({ type: 'SET_LID', closed: false });
  for (let i = 0; i < minutes; i++) s.advance(60); return s.snapshot();
}
describe('mezcla por ebullición (D26)', () => {
  it('con el arroz cocido el agua está cerca de 100 °C, no a 70 °C', () => {
    const st = run(30).state;
    expect(st.alpha_mean).toBeGreaterThan(0.95);
    expect(st.waterT_K - 273.15).toBeGreaterThan(95);
  });
  it('balances de masa y energía siguen dentro de tolerancia', () => {
    const b = run(60).balances ?? {}; expect(b.massError_rel ?? 0).toBeLessThan(1e-9); expect(b.energyError_rel ?? 0).toBeLessThan(1e-6);
  });
});
