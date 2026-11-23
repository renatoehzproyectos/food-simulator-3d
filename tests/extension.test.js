// REQ-EXT-001: registerMaterial sin tocar el núcleo; REQ-VAL-001: material desconocido da error accionable.
import { describe, it, expect } from 'vitest';
import { createFoodSimulator, registerMaterial, ValidationError, MATERIALS } from '../src/index.js';

const input = (material) => ({ food: 'rice', vessel: { material, base_area_m2: 0.0266, height_m: 0.14, mass_kg: 0.8 }, environment: { T_ambient_C: 20 }, simulation: { timeStep_s: 0.5, seed: 1 } });
const run = (material) => { const s = createFoodSimulator().createSession(input(material), { skipValidation: true });
  s.command({ type: 'ADD_INGREDIENT', ingredient: 'rice', mass_kg: 0.2 }); s.command({ type: 'POUR_LIQUID', mass_kg: 0.6 }); s.command({ type: 'PLACE_ON_HEAT', power_W: 1000 }); s.advanceSim(300); return s.snapshot(); };

describe('extensión', () => {
  it('un material registrado se usa y cambia la inercia térmica', () => {
    registerMaterial('test_lead', { rho: 11340, cp: 130, k: 35 });
    expect(MATERIALS.test_lead.k).toBe(35);
    const a = run('steel'), b = run('test_lead');
    expect(b.state.bottomT_K).not.toBe(a.state.bottomT_K);
    expect(b.balances.energyError_rel).toBeLessThan(1e-6);
  });
  it('rechaza materiales inválidos y desconocidos con ValidationError accionable', () => {
    expect(() => registerMaterial('x', { rho: -1, cp: 1, k: 1 })).toThrow(ValidationError);
    try { createFoodSimulator().createSession(input('unobtainium'), { skipValidation: true }); expect.unreachable(); }
    catch (e) { expect(e).toBeInstanceOf(ValidationError); expect(e.errors[0].code).toBe('E_MATERIAL'); expect(e.errors[0].hint).toMatch(/steel/); }
  });
});
