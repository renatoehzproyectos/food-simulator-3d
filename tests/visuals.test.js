// Fases 9–11: adapter puro, visuales acoplados al core, vista térmica sin efecto sobre la simulación, flujo completo de interacción por comandos.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import * as AD from '../src/output/adapter.js';
import { createFoodSimulator } from '../src/registry.js';
import { RiceVisual } from '../src/engine3d/food-visuals.js';
import { LiquidSystem } from '../src/engine3d/liquid-system.js';
import { ThermalView } from '../src/engine3d/thermal-visualization.js';
import { buildWorld } from '../src/engine3d/scene.js';
import { pourCommand, dropPot, nextHeat, tiltFor, flowFraction, stirCommand, clampToCounter, POUR } from '../src/engine3d/interaction-logic.js';
import { SCENARIOS } from '../src/food/scenarios.js';

const sim = createFoodSimulator();
const empty = () => sim.createSession({ food: 'rice', environment: { duration_s: 1e5 }, simulation: { timeStep_s: 0.5, seed: 1 }, vessel: { base_area_m2: 0.03, height_m: 0.14, lid: { closed: true } } }, { skipValidation: true });
const cooking = (secs, water = 0.3) => { const s = empty(); s.command({ type: 'ADD_INGREDIENT', ingredient: 'rice', mass_kg: 0.2 }); s.command({ type: 'POUR_LIQUID', liquid: 'water', mass_kg: water }); s.command({ type: 'PLACE_ON_HEAT', power_W: 1500 }); s.advanceSim(secs); return s; };

describe('adapter (funciones puras)', () => {
  it('color de grano: crudo blanco-crema → cocido más claro → marrón → negro; opacidad baja con α', () => {
    const raw = AD.grainColor(0, 0), cooked = AD.grainColor(1, 0), brown = AD.grainColor(1, 0.5), black = AD.grainColor(1, 1);
    expect(brown[0]).toBeLessThan(cooked[0]); expect(black[0]).toBeLessThan(brown[0]); expect(black[0]).toBeLessThan(0.1); expect(raw[2]).toBeLessThan(cooked[2]);
    expect(AD.grainOpacity(1)).toBeLessThan(AD.grainOpacity(0));
  });
  it('escala por hinchamiento (V/V0)^(1/3) y paleta térmica monótona en rojo→blanco', () => {
    expect(AD.grainScale(8)).toBeCloseTo(2, 12); expect(AD.grainScale(0.5)).toBe(1);
    const c = (T) => AD.thermalColor(T); expect(c(293.15)[2]).toBeGreaterThan(c(293.15)[0]); expect(c(400)[0]).toBeGreaterThan(0.8); expect(c(480)[1]).toBeGreaterThan(c(400)[1]);
  });
  it('tasas de burbujas/vapor y audio son funciones del flujo calculado (0 sin ebullición)', () => {
    expect(AD.bubbleRate({ boilGen_kg_s: 0 })).toBe(0); expect(AD.bubbleRate({ boilGen_kg_s: 1e-3 })).toBeGreaterThan(AD.bubbleRate({ boilGen_kg_s: 1e-4 }));
    expect(AD.steamRate({ evap_kg_s: 0 })).toBe(0); expect(AD.audioPlan({ boilGen_kg_s: 0, freeWater_kg: 1, bottomT_K: 300 }).boilVolume).toBe(0);
  });
  it('no muta el snapshot (congelado) ni importa three', () => { const s = cooking(30).snapshot(); expect(Object.isFrozen(s)).toBe(true); AD.bubbleRate(s.state); AD.burnerGlow(s.state); expect(() => AD.liquidLevel(s.state)).not.toThrow(); });
});

describe('escena y visuales acoplados al core', () => {
  it('buildWorld: cámara perspectiva, luz con sombras, mesada', () => { const w = buildWorld(); expect(w.camera.isPerspectiveCamera).toBe(true); expect(w.sun.castShadow).toBe(true); expect(w.scene.getObjectByName('counter')).toBeTruthy(); });
  it('el nivel del agua en la malla = nivel de la simulación y baja al hervir sin tapa', () => {
    const s = empty(); s.command({ type: 'SET_LID', closed: false }); s.command({ type: 'POUR_LIQUID', liquid: 'water', mass_kg: 0.3 }); s.command({ type: 'PLACE_ON_HEAT', power_W: 2000 }); s.advanceSim(1);
    const L = new LiquidSystem(); const a = L.update(s.snapshot(), 0.016); s.advanceSim(400); const b = L.update(s.snapshot(), 0.016);
    expect(a.level).toBeGreaterThan(0.004); expect(b.level).toBeLessThan(a.level); expect(L.water.scale.y).toBeCloseTo(b.level, 9);
  });
  it('burbujas y vapor aparecen solo con ebullición calculada, no por timer', () => {
    const peak = (sess) => { const L = new LiquidSystem(); let mb = 0, ms = 0; for (let i = 0; i < 200; i++) { const r = L.update(sess.snapshot(), 0.05); mb = Math.max(mb, r.bubbles); ms = Math.max(ms, r.steam); } return { mb, ms }; };
    const cold = peak(cooking(5)), hot = cooking(300, 0.3), h = peak(hot);
    expect(cold).toEqual({ mb: 0, ms: 0 }); expect(hot.snapshot().state.boilGen_kg_s).toBeGreaterThan(0); expect(h.mb).toBeGreaterThan(0); expect(h.ms).toBeGreaterThan(0);
  });
  it('granos: cantidad ∝ masa de arroz y color/escala cambian al cocinar y al quemar', () => {
    const R = new RiceVisual(), raw = cooking(1), cooked = (() => { const x = sim.createSession({ food: 'rice', environment: { duration_s: 1e5, cookingTemperature_C: 100 }, simulation: { timeStep_s: 0.5 }, vessel: { base_area_m2: 0.03, height_m: 0.14, lid: { closed: true } } }, { skipValidation: true }); x.command({ type: 'ADD_INGREDIENT', ingredient: 'rice', mass_kg: 0.2 }); x.command({ type: 'POUR_LIQUID', liquid: 'water', mass_kg: 0.3 }); x.advanceSim(900); return x; })(), burnt = (() => { const s = empty(); s.command({ type: 'ADD_INGREDIENT', ingredient: 'rice', mass_kg: 0.2 }); s.command({ type: 'POUR_LIQUID', liquid: 'water', mass_kg: 0.1 }); s.command({ type: 'PLACE_ON_HEAT', power_W: 2000 }); s.advanceSim(1500); return s; })();
    R.update(raw.snapshot()); const n0 = R.mesh.count, c0 = Array.from(R.mesh.instanceColor.array.slice(0, 3)), s0 = R.last.size;
    R.update(cooked.snapshot()); const s1 = R.last.size, c1 = Array.from(R.mesh.instanceColor.array.slice(0, 3));
    R.update(burnt.snapshot()); const cb = Array.from(R.mesh.instanceColor.array.slice(0, 3));
    expect(n0).toBeGreaterThan(1500); expect(s1).toBeGreaterThan(s0 * 1.2); expect(c1[0]).toBeGreaterThan(c0[0] - 1e-9); expect(cb[0]).toBeLessThan(c1[0]);
    const R2 = new RiceVisual(); const half = empty(); half.command({ type: 'ADD_INGREDIENT', ingredient: 'rice', mass_kg: 0.1 }); half.advanceSim(1); R2.update(half.snapshot()); expect(R2.mesh.count).toBeLessThan(n0);
  });
  it('sin arroz no hay granos', () => { const R = new RiceVisual(); R.update(empty().snapshot()); expect(R.mesh.count).toBe(0); });
  it('vista térmica ON/OFF no altera la simulación (hash del estado idéntico) y refleja T', () => {
    const run = (withView) => { const s = cooking(0.5), T = new ThermalView(); T.setEnabled(withView); for (let i = 0; i < 400; i++) { s.advanceSim(1); if (withView) { T.update(s.snapshot()); if (i % 50 === 0) T.setEnabled(i % 100 !== 0); } } return { s, T }; };
    const a = run(false), b = run(true), hash = (s) => { const st = s.snapshot().state; return [st.waterT_K, st.bottomT_K, st.M_mean_db, st.alpha_mean, st.freeWater_kg, st.vaporLost_kg].map((x) => x.toPrecision(15)).join('|'); };
    expect(hash(a.s)).toBe(hash(b.s));
    const T = new ThermalView(); T.setEnabled(true); T.update(cooking(300).snapshot()); const hotTop = Array.from(T.data.slice(0, 3)), top = Array.from(T.data.slice((48 - 1) * 4, (48 - 1) * 4 + 3)); expect(hotTop).not.toEqual(top);
    T.setEnabled(false); expect(T.update(cooking(10).snapshot())).toBe(false);
  });
});

describe('interacción: solo emite comandos', () => {
  it('verter: sin inclinación no hay flujo; el caudal sale de la inclinación; arroz y agua producen comandos distintos', () => {
    expect(pourCommand('water', 0, 0.016)).toBeNull(); expect(flowFraction(POUR.tiltMax)).toBe(1);
    const w = pourCommand('water', POUR.tiltMax, 0.1), r = pourCommand('rice', POUR.tiltMax, 0.1);
    expect(w.type).toBe('POUR_LIQUID'); expect(w.volume_m3).toBeCloseTo(1e-5, 12); expect(r.type).toBe('ADD_INGREDIENT'); expect(r.mass_kg).toBeCloseTo(0.008, 10);
    expect(tiltFor({ x: 0.9, z: 0 }, { x: 0, z: 0 }, true)).toBe(0); expect(tiltFor({ x: 0.01, z: 0 }, { x: 0, z: 0 }, true)).toBeGreaterThan(1.5);
  });
  it('soltar la olla: sobre el quemador → PLACE_ON_HEAT y se ajusta; fuera → REMOVE_FROM_HEAT solo si estaba en fuego', () => {
    const b = { x: 0, z: -0.05 }, on = dropPot({ x: 0.05, z: -0.02 }, b, false, 1500); expect(on.onHeat).toBe(true); expect(on.pos).toEqual(b); expect(on.cmds[0]).toMatchObject({ type: 'PLACE_ON_HEAT', power_W: 1500 });
    expect(dropPot({ x: 0.5, z: 0.2 }, b, true, 1500).cmds[0].type).toBe('REMOVE_FROM_HEAT'); expect(dropPot({ x: 0.5, z: 0.2 }, b, false, 1500).cmds).toEqual([]);
    expect(clampToCounter({ x: 9, z: -9 })).toEqual({ x: 0.78, z: -0.33 });
  });
  it('potencia en pasos de 250 W acotada a [0, 2000]; agitar con periodo', () => { expect(nextHeat(1500, 1)).toBe(1750); expect(nextHeat(2000, 1)).toBe(2000); expect(nextHeat(0, -1)).toBe(0); expect(stirCommand(0.1, 0)).toBeNull(); expect(stirCommand(0.3, 0).type).toBe('STIR'); });
  it('flujo completo sin DOM: arroz + agua (arrastrando) → olla al fuego → hierve y cocina', () => {
    const s = empty(); let rice = 0, water = 0;
    for (let t = 0; t < 2.6; t += 1 / 60) { const c = pourCommand('rice', POUR.tiltMax * 0.95, 1 / 60); if (c && rice < 0.2) { s.command(c); rice += c.mass_kg; } s.advance(0.5); }
    for (let t = 0; t < 4; t += 1 / 60) { const c = pourCommand('water', POUR.tiltMax * 0.95, 1 / 60); if (c && water < 0.3e-3) { s.command(c); water += c.volume_m3; } s.advance(0.5); }
    dropPot({ x: 0, z: -0.05 }, { x: 0, z: -0.05 }, false, 1500).cmds.forEach((c) => s.command(c)); s.advanceSim(1100);
    const st = s.snapshot().state; expect(st.riceMass_kg).toBeGreaterThan(0.15); expect(s.events.some((e) => e.type === 'BOIL_START')).toBe(true);
    expect(st.alpha_mean).toBeGreaterThan(0.3); expect(s.snapshot().balances.massError_rel).toBeLessThan(1e-9);
  });
});
