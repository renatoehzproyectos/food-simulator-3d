import { describe, it, expect } from 'vitest';
import * as U from '../src/core/units.js';
import { validateSimulationInput } from '../src/core/validation.js';
import { mulberry32 } from '../src/core/prng.js';
const ok = () => ({ food: 'rice', ingredients: { rice: { mass_g: 200 }, water: { mass_g: 300, T_C: 20 } }, environment: { duration_s: 1200 } });
describe('REQ-UNIT-001', () => {
  it('conversiones', () => {
    expect(U.C_to_K(100)).toBeCloseTo(373.15, 12); expect(U.K_to_C(273.15)).toBeCloseTo(0, 12);
    expect(U.g_to_kg(200)).toBe(0.2); expect(U.min_to_s(20)).toBe(1200); expect(U.L_to_m3(1)).toBe(0.001);
  });
  it('base húmeda <-> seca son inversas', () => { for (const wb of [0.1, 0.12, 0.6]) expect(U.db_to_wb(U.wb_to_db(wb))).toBeCloseTo(wb, 14); });
});
describe('REQ-VAL-001', () => {
  it('entrada válida', () => { const v = validateSimulationInput(ok()); expect(v.ok).toBe(true); expect(v.warnings).toEqual([]); });
  it('errores accionables con code/path/message/hint', () => {
    const v = validateSimulationInput({ food: 'rice', ingredients: { rice: { mass_g: -5 }, water: { T_C: -3 } }, environment: {} });
    expect(v.ok).toBe(false);
    for (const e of v.errors) for (const k of ['code', 'path', 'message', 'hint']) expect(e[k]).toBeTruthy();
    expect(v.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['ingredients.rice.mass_g', 'ingredients.water.mass_g', 'environment.duration_s']));
  });
  it('T < 0 °C es error', () => {
    const i = ok(); i.ingredients.water.T_C = -1;
    expect(validateSimulationInput(i).errors.some((e) => e.code === 'E_PHYS')).toBe(true);
  });
  it('agua/arroz < 1 es advertencia, no error', () => {
    const i = ok(); i.ingredients.water.mass_g = 120; const v = validateSimulationInput(i);
    expect(v.ok).toBe(true); expect(v.warnings[0].code).toBe('W_DRY');
  });
  it('entrada no objeto', () => { expect(validateSimulationInput(null).ok).toBe(false); });
});
describe('REQ-DET-001', () => {
  it('misma semilla, misma secuencia; distinta semilla, distinta', () => {
    const a = mulberry32(7), b = mulberry32(7), c = mulberry32(8);
    const sa = [a(), a(), a()], sb = [b(), b(), b()];
    expect(sa).toEqual(sb); expect(sa).not.toEqual([c(), c(), c()]);
    expect(sa.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});
