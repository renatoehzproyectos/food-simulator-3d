// Fase 8 (REQ-RICE-001, REQ-BAL-001): escenarios S1–S5 sin tocar el clasificador, balances, comandos, física cualitativa.
import { describe, it, expect } from 'vitest';
import { createFoodSimulator } from '../src/registry.js';
import { SCENARIOS } from '../src/food/scenarios.js';
import { classifyRice, CLASS_PARAMS as CP } from '../src/food/classifier.js';
import { grainGeometry, RICE_TYPES } from '../src/food/rice.js';
import { ValidationError } from '../src/core/validation.js';

const sim = createFoodSimulator();
const results = {};
const run = async (id) => (results[id] ??= await sim.simulate(SCENARIOS[id].input, { sampleEvery_s: 60 }));

describe('escenarios de aceptación (clasificador intacto)', () => {
  for (const id of Object.keys(SCENARIOS)) it(`${id} → ${SCENARIOS[id].expected.join(' o ')}`, async () => {
    const r = await run(id), o = r.final.foods[0].outcome;
    expect(SCENARIOS[id].expected).toContain(o.label); expect(o.reasons.length).toBeGreaterThan(0);
    expect(o.score).toBeGreaterThanOrEqual(0); expect(o.score).toBeLessThanOrEqual(1);
  });
  it.each(Object.keys(SCENARIOS))('%s: balances de masa ≤ 1e-9 y energía ≤ 1e-6 en toda la evolución', async (id) => {
    const r = await run(id);
    for (const s of r.timeline) { expect(s.balances.massError_rel).toBeLessThan(1e-9); expect(s.balances.energyError_rel).toBeLessThan(1e-6); }
  });
  it('quemado explicado por variables: fondo seco, agua agotada y eventos en orden', async () => {
    const r = await run('S4'); const ev = r.events.map((e) => e.type);
    expect(ev).toEqual(expect.arrayContaining(['BOIL_START', 'WATER_DEPLETED', 'SIZZLE', 'BURN_ONSET']));
    expect(ev.indexOf('BOIL_START')).toBeLessThan(ev.indexOf('WATER_DEPLETED')); expect(ev.indexOf('WATER_DEPLETED')).toBeLessThan(ev.indexOf('BURN_ONSET'));
    expect(r.final.state.freeWater_kg).toBeLessThan(1e-6); expect(r.final.state.B_bottom).toBeGreaterThan(CP.B_burn);
  });
  it('S5 (60 °C): el agua nunca hierve y no hay eventos de ebullición', async () => { const r = await run('S5'); expect(r.events.some((e) => e.type === 'BOIL_START')).toBe(false); });
  it('determinismo: dos corridas dan el mismo estado final', async () => {
    const a = await sim.simulate(SCENARIOS.S2.input), b = await sim.simulate(SCENARIOS.S2.input);
    expect(a.final.state.M_mean_db).toBe(b.final.state.M_mean_db); expect(a.final.state.alpha_mean).toBe(b.final.state.alpha_mean);
  });
});

describe('física cualitativa', () => {
  it('α y M medias crecen monótonamente mientras hay agua (S2)', async () => {
    const r = await run('S2'); let a = -1, m = -1;
    for (const s of r.timeline) { expect(s.state.alpha_mean).toBeGreaterThanOrEqual(a - 1e-12); expect(s.state.M_mean_db).toBeGreaterThanOrEqual(m - 1e-12); a = s.state.alpha_mean; m = s.state.M_mean_db; }
  });
  it('más agua ⇒ más humedad final; la tapa pierde menos agua que sin tapa', async () => {
    const f = async (w, lid) => { const i = structuredClone(SCENARIOS.S2.input); i.ingredients.water.mass_g = w; i.vessel.lid.closed = lid; i.environment.duration_s = 900; return (await sim.simulate(i)).final.state; };
    expect((await f(350, true)).M_mean_db).toBeGreaterThan((await f(250, true)).M_mean_db);
    const heat = (lid) => { const i = structuredClone(SCENARIOS.S1.input); i.ingredients.water.mass_g = 300; i.vessel.lid.closed = lid; i.environment.duration_s = 600; return sim.simulate(i).then((r) => r.final.state.vaporLost_kg); };
    expect(await heat(true)).toBeLessThan(await heat(false));
  });
  it('con potencia, el agua líquida no supera 100 °C mientras queda agua en la celda', async () => {
    const r = await sim.simulate({ ...SCENARIOS.S4.input, environment: { T_ambient_C: 20, duration_s: 150 } }, { sampleEvery_s: 5 });
    for (const s of r.timeline) if (s.state.freeWater_kg > 0.01) expect(s.state.waterT_K).toBeLessThanOrEqual(373.15 + 1e-6);
  });
  it('temperatura de fondo acotada (radiación): < 1100 K incluso en seco', async () => { const r = await run('S4'); expect(r.final.state.bottomT_K).toBeLessThan(1100); });
  it('tipos de arroz: geometría distinta ⇒ radio equivalente distinto', () => {
    const R = Object.keys(RICE_TYPES).map((t) => grainGeometry(t).R_eq); expect(new Set(R.map((x) => x.toFixed(6))).size).toBeGreaterThan(2);
    for (const x of R) { expect(x).toBeGreaterThan(5e-4); expect(x).toBeLessThan(2e-3); }
  });
  it('convergencia en dt: M media a dt=0.25 vs dt=1 difiere < 3 %', async () => {
    const m = async (dt) => { const i = structuredClone(SCENARIOS.S2.input); i.simulation.timeStep_s = dt; i.environment.duration_s = 600; return (await sim.simulate(i)).final.state.M_mean_db; };
    const a = await m(0.25), b = await m(1); expect(Math.abs(a - b) / a).toBeLessThan(0.03);
  });
});

describe('modo interactivo (comandos)', () => {
  const empty = () => sim.createSession({ food: 'rice', environment: { duration_s: 3600 }, simulation: { timeStep_s: 0.5 } }, { skipValidation: true });
  it('añadir arroz + verter agua + poner al fuego → hierve; masa y energía conservadas', () => {
    const s = empty(); s.command({ type: 'ADD_INGREDIENT', containerId: 'pot', ingredient: 'rice', mass_kg: 0.2 });
    s.command({ type: 'POUR_LIQUID', fromId: 'jug', toId: 'pot', liquid: 'water', volume_m3: 0.0003, T_C: 20 }); s.command({ type: 'PLACE_ON_HEAT', containerId: 'pot', sourceId: 'burner', power_W: 1500 });
    s.advanceSim(900); const snap = s.snapshot();
    expect(s.events.some((e) => e.type === 'BOIL_START')).toBe(true); expect(snap.state.absorbedWater_kg).toBeGreaterThan(0.03);
    expect(snap.balances.massError_rel).toBeLessThan(1e-9); expect(snap.balances.energyError_rel).toBeLessThan(1e-6);
    expect(snap.state.freeWater_kg + snap.state.absorbedWater_kg + snap.state.vaporLost_kg + 0.2 * 0.88).toBeCloseTo(0.2 + 0.3 * 0.998, 6);
  });
  it('sin fuego no hay calentamiento; SET_HEAT sube la potencia; REMOVE_FROM_HEAT la quita', () => {
    const s = empty(); s.command({ type: 'POUR_LIQUID', liquid: 'water', mass_kg: 0.3 }); s.advanceSim(60); expect(s.snapshot().state.waterT_K).toBeLessThan(293.5);
    s.command({ type: 'PLACE_ON_HEAT', power_W: 500 }); s.command({ type: 'SET_HEAT', power_W: 1500 }); s.advanceSim(120); expect(s.snapshot().state.waterT_K).toBeGreaterThan(300);
    expect(s.snapshot().state.heat.power_W).toBe(1500);
    s.command({ type: 'REMOVE_FROM_HEAT' }); s.advanceSim(1); expect(s.snapshot().state.heat.on).toBe(false);
  });
  it('STIR acelera el calentamiento del lecho', () => {
    const heat = (stir) => { const s = empty(); s.command({ type: 'ADD_INGREDIENT', ingredient: 'rice', mass_kg: 0.2 }); s.command({ type: 'POUR_LIQUID', liquid: 'water', mass_kg: 0.3 });
      s.command({ type: 'PLACE_ON_HEAT', power_W: 300 }); for (let k = 0; k < 120; k++) { if (stir) s.command({ type: 'STIR', intensity: 1 }); s.advanceSim(1); } return s.snapshot().state.T_profile_K[5]; };
    expect(heat(true)).toBeGreaterThan(heat(false));
  });
  it('verter más agua de la que cabe emite OVERFLOW y no rompe el balance', () => {
    const s = empty(); s.command({ type: 'POUR_LIQUID', liquid: 'water', mass_kg: 50 }); s.advanceSim(1);
    expect(s.events.some((e) => e.type === 'OVERFLOW')).toBe(true); expect(s.snapshot().balances.massError_rel).toBeLessThan(1e-9);
  });
  it('comando desconocido no lanza: emite WARN', () => { const s = empty(); s.command({ type: 'NOPE' }); s.advanceSim(1); expect(s.events.some((e) => e.type === 'WARN')).toBe(true); });
  it('la entrada inválida sigue fallando con error accionable', () => { expect(() => sim.createSession({ food: 'rice' })).toThrow(ValidationError); });
});

describe('clasificador (explícito, por umbrales)', () => {
  const v = (o) => ({ alpha_mean: 1, M_mean_db: 1.5, hardness_N: 10, B_bottom: 0, burnHold_s: 0, ...o });
  it.each([[{}, 'cocido'], [{ alpha_mean: 0.5 }, 'duro'], [{ M_mean_db: 0.8 }, 'duro'], [{ M_mean_db: 2.6 }, 'sobrecocido'], [{ hardness_N: 4 }, 'blando'],
    [{ B_bottom: 0.5 }, 'quemado'], [{ burnHold_s: 120 }, 'quemado']])('%j → %s', (o, label) => expect(classifyRice(v(o)).label).toBe(label));
  it('quemado tiene precedencia y la confianza ∈ [0,1]', () => { const c = classifyRice(v({ alpha_mean: 0.2, B_bottom: 0.9 })); expect(c.label).toBe('quemado'); expect(c.confidence).toBeGreaterThanOrEqual(0); expect(c.confidence).toBeLessThanOrEqual(1); });
});
