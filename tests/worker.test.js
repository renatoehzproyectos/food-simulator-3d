// REQ-PERF-002 / Fase 13: lógica del Worker (sin navegador), cliente con respaldo en hilo principal.
import { describe, it, expect } from 'vitest';
import { createWorkerHandler, collectBuffers } from '../src/worker/worker-core.js';
import { createSimClient } from '../src/worker/sim-client.js';
import { createFoodSimulator } from '../src/registry.js';

const INPUT = { food: 'rice', riceType: 'long_grain', vessel: { material: 'steel', base_area_m2: 0.0266, height_m: 0.14, mass_kg: 0.6, lid: { closed: false } },
  environment: { T_ambient_C: 20, duration_s: 86400 }, simulation: { timeStep_s: 0.5, seed: 1 } };
const setup = (s) => { s.command({ type: 'ADD_INGREDIENT', containerId: 'pot', ingredient: 'rice', mass_kg: 0.2 }); s.command({ type: 'POUR_LIQUID', toId: 'pot', liquid: 'water', mass_kg: 0.5 }); s.command({ type: 'PLACE_ON_HEAT', containerId: 'pot', sourceId: 'h', power_W: 1000 }); };
const mk = (o = {}) => { const out = []; const h = createWorkerHandler({ post: (m, tr) => out.push({ m, tr }), ...o }); return { h, out }; };

describe('worker-core', () => {
  it('init responde con el snapshot inicial', () => {
    const { h, out } = mk(); h({ t: 'init', input: INPUT, skipValidation: true });
    expect(out).toHaveLength(1); expect(out[0].m.t).toBe('snap'); expect(out[0].m.snap.t_s).toBe(0);
  });
  it('tick largo se consume entero (sin el tope de 2000 pasos) y es idéntico a advanceSim', () => {
    const { h, out } = mk({ budget_ms: 1e9 }); h({ t: 'init', input: INPUT, skipValidation: true });
    h({ t: 'cmd', cmd: { type: 'ADD_INGREDIENT', containerId: 'pot', ingredient: 'rice', mass_kg: 0.2 } });
    h({ t: 'cmd', cmd: { type: 'POUR_LIQUID', toId: 'pot', liquid: 'water', mass_kg: 0.5 } });
    h({ t: 'cmd', cmd: { type: 'PLACE_ON_HEAT', containerId: 'pot', sourceId: 'h', power_W: 1000 } });
    h({ t: 'tick', simDt: 1800 }); const last = out.at(-1).m;
    expect(last.steps).toBe(3600);
    const ref = createFoodSimulator().createSession(INPUT, { skipValidation: true }); setup(ref); ref.advanceSim(1800);
    expect(last.snap.state.alpha_mean).toBeCloseTo(ref.snapshot().state.alpha_mean, 12);
    expect(last.snap.state.freeWater_kg).toBeCloseTo(ref.snapshot().state.freeWater_kg, 12);
  });
  it('respeta el presupuesto de CPU y conserva la deuda para el siguiente tick', () => {
    let clock = 0; const now = () => (clock += 1);   // cada consulta cuesta 1 ms simulado
    const { h, out } = mk({ now, budget_ms: 5, maxBacklog_s: 1e9 }); h({ t: 'init', input: INPUT, skipValidation: true });
    h({ t: 'tick', simDt: 100 }); const a = out.at(-1).m.steps; expect(a).toBeLessThan(200); expect(a).toBeGreaterThan(0);
    h({ t: 'tick', simDt: 0 }); expect(out.at(-1).m.steps).toBeGreaterThan(0);   // sigue consumiendo la deuda
  });
  it('descarta deuda mayor que maxBacklog_s (dispositivo lento)', () => {
    let clock = 0; const { h, out } = mk({ now: () => (clock += 1), budget_ms: 2, maxBacklog_s: 10 }); h({ t: 'init', input: INPUT, skipValidation: true });
    h({ t: 'tick', simDt: 500 }); h({ t: 'tick', simDt: 0 }); expect(out.at(-1).m.steps).toBe(0);
  });
  it('transfiere ArrayBuffers sin duplicados y emite eventos agrupados', () => {
    const { h, out } = mk({ budget_ms: 1e9 }); h({ t: 'init', input: INPUT, skipValidation: true });
    h({ t: 'cmd', cmd: { type: 'ADD_INGREDIENT', containerId: 'pot', ingredient: 'rice', mass_kg: 0.2 } });
    h({ t: 'cmd', cmd: { type: 'POUR_LIQUID', toId: 'pot', liquid: 'water', mass_kg: 0.5 } });
    h({ t: 'cmd', cmd: { type: 'PLACE_ON_HEAT', containerId: 'pot', sourceId: 'h', power_W: 1500 } });
    h({ t: 'tick', simDt: 900 }); const { m, tr } = out.at(-1);
    expect(tr.length).toBeGreaterThan(0); expect(new Set(tr).size).toBe(tr.length); expect(tr.every((b) => b instanceof ArrayBuffer)).toBe(true);
    expect(m.events.some((e) => e.type === 'BOIL_START')).toBe(true);
    const again = out.at(-1); h({ t: 'tick', simDt: 1 }); expect(out.at(-1).m.events.some((e) => e.type === 'BOIL_START')).toBe(false); expect(again).toBeTruthy();
  });
  it('collectBuffers deduplica vistas del mismo buffer', () => {
    const b = new Float32Array(8); expect(collectBuffers({ a: b, c: b.subarray(1), d: { e: b } }).size).toBe(1);
  });
  it('mensaje desconocido o init inválido responde con error, no lanza', () => {
    const { h, out } = mk(); h({ t: 'zzz' }); h({ t: 'init', input: { food: 'nada' } });
    expect(out.map((o) => o.m.t)).toEqual(['error', 'error']);
  });
});

describe('sim-client (respaldo sin Worker)', () => {
  it('modo main: avanza, entrega snapshot y eventos', () => {
    const c = createSimClient(INPUT, { useWorker: false }); const ev = []; c.on((e) => ev.push(e.type)); setup(c);
    expect(c.mode).toBe('main'); expect(c.snapshot().t_s).toBe(0);
    for (let i = 0; i < 200; i++) c.advance(8); expect(c.snapshot().t_s).toBeGreaterThan(100); expect(ev).toContain('BOIL_START'); c.dispose();
  });
});
