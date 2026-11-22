// Escenarios de aceptación S1–S5 (sec. 14.1). 200 g de arroz. Decisiones de entrada no dadas por la spec: ver docs/DECISIONS.md D21.
const base = (water_g, extra) => ({ food: 'rice', riceType: 'long_grain', ingredients: { rice: { mass_g: 200 }, water: { mass_g: water_g, T_C: 20 } },
  vessel: { material: 'steel', base_area_m2: 0.03, mass_kg: 0.6, lid: { closed: true } }, environment: { T_ambient_C: 20 }, simulation: { timeStep_s: 0.5, seed: 1 }, ...extra });
const merge = (a, b) => ({ ...a, ...b, vessel: { ...a.vessel, ...(b.vessel ?? {}) }, environment: { ...a.environment, ...(b.environment ?? {}) } });
export const SCENARIOS = {
  S1: { expected: ['duro', 'quemado'], input: merge(base(120), { heating: { mode: 'power', power_W: 2000, intensity: 0.5 }, environment: { duration_s: 1200 } }) },          // fuego medio, tapa
  S2: { expected: ['cocido'], input: merge(base(300), { environment: { cookingTemperature_C: 100, duration_s: 1080 } }) },                                                 // 100 °C, 18 min, tapa
  S3: { expected: ['blando', 'sobrecocido'], input: merge(base(600), { environment: { cookingTemperature_C: 100, duration_s: 2700 } }) },                                  // tapa (decisión D21)
  S4: { expected: ['quemado'], input: merge(base(150), { heating: { mode: 'power', power_W: 2000, intensity: 1 }, vessel: { lid: { closed: false } }, environment: { duration_s: 3600 } }) }, // potencia alta, sin tapa
  S5: { expected: ['duro'], input: merge(base(300), { environment: { cookingTemperature_C: 60, duration_s: 1200 } }) },                                                    // 60 °C
};
