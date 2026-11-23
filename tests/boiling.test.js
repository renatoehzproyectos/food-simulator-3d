// REQ-HEAT-001 / D32: ebullición nucleada (Rohsenow + Zuber) y su acoplamiento al fondo de la olla.
import { describe, it, expect } from 'vitest';
import { rohsenowFlux, boilingH, criticalHeatFlux, superheatForFlux } from '../src/physics/boiling.js';
import { createFoodSimulator } from '../src/registry.js';

describe('physics/boiling', () => {
  it('Rohsenow para agua (Csf=0.013) a ΔTe=10 K: ≈1.38e5 W/m² (cálculo manual con propiedades de tabla)', () => {
    const q = rohsenowFlux(10); expect(q / 1.383e5).toBeGreaterThan(0.97); expect(q / 1.383e5).toBeLessThan(1.03);
  });
  it('escala con ΔTe³ y es 0 sin sobretemperatura', () => {
    expect(rohsenowFlux(0)).toBe(0); expect(rohsenowFlux(-3)).toBe(0); expect(rohsenowFlux(8) / rohsenowFlux(4)).toBeCloseTo(8, 9);
  });
  it('Zuber: flujo crítico del agua ≈1.1 MW/m²; h se limita a él', () => {
    const qc = criticalHeatFlux(); expect(qc).toBeGreaterThan(1.0e6); expect(qc).toBeLessThan(1.25e6);
    expect(boilingH(60) * 60).toBeCloseTo(qc, 3);
  });
  it('superheatForFlux es la inversa de rohsenowFlux', () => { for (const dT of [3, 6, 12, 18]) expect(superheatForFlux(rohsenowFlux(dT))).toBeCloseTo(dT, 9); });
});

describe('fondo de la olla en ebullición', () => {
  const run = (rohsenow) => {
    const s = createFoodSimulator().createSession({ food: 'rice', riceType: 'long_grain', params: rohsenow === undefined ? undefined : { rohsenow },
      vessel: { material: 'steel', base_area_m2: 0.0266, height_m: 0.14, mass_kg: 0.6, lid: { closed: false } }, environment: { T_ambient_C: 20, duration_s: 1e5 }, simulation: { timeStep_s: 0.5, seed: 1 } }, { skipValidation: true });
    s.command({ type: 'ADD_INGREDIENT', ingredient: 'rice', mass_kg: 0.2 }); s.command({ type: 'POUR_LIQUID', mass_kg: 1.5 }); s.command({ type: 'PLACE_ON_HEAT', power_W: 1000 });
    for (let i = 0; i < 40; i++) s.advanceSim(60); return s.snapshot();
  };
  it('la sobretemperatura del fondo coincide con Rohsenow para el flujo aplicado (±1.5 K)', () => {
    const st = run().state, A = 0.0266, q = 1000 * 0.8 / A;               // flujo de entrada ≈ flujo al agua (pérdidas pequeñas con agua a 100 °C)
    const dTe = st.bottomT_K - 373.15, pred = superheatForFlux(q * 0.97);   // ~3 % de pérdidas laterales/radiación
    expect(Math.abs(dTe - pred)).toBeLessThan(1.5);
  });
  it('conserva masa y energía', () => { const b = run().balances; expect(b.massError_rel).toBeLessThan(1e-9); expect(b.energyError_rel).toBeLessThan(1e-6); });
});
