// Fase 12 (sec. 13): carga bajo demanda, caché sin duplicados, escala real, referencias, respaldo, eventos→audio.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import path from 'node:path';
import * as THREE from 'three';
import { AssetManager } from '../src/engine3d/asset-manager.js';
import { MANIFEST, AUDIO } from '../src/engine3d/manifest.js';
import { AudioManager } from '../src/engine3d/audio.js';
import { nodeFetcher, PUBLIC } from './helpers3d.js';

const size = (o) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
describe('manifest', () => {
  it('cada entrada apunta a un archivo existente y su tamaño declarado coincide', () => {
    for (const [id, e] of Object.entries(MANIFEST)) { const f = path.join(PUBLIC, e.url); expect(fs.existsSync(f), id).toBe(true); expect(fs.statSync(f).size, id).toBe(e.sizeBytes); }
    for (const [id, a] of Object.entries(AUDIO)) expect(fs.existsSync(path.join(PUBLIC, a.url)), id).toBe(true);
  });
  it('sin duplicados en public/assets (mismo contenido)', async () => {
    const crypto = await import('node:crypto'); const seen = new Map();
    for (const d of ['models', 'audio']) for (const f of fs.readdirSync(path.join(PUBLIC, 'assets', d))) { const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(PUBLIC, 'assets', d, f))).digest('hex'); expect(seen.has(h), `${f} duplica ${seen.get(h)}`).toBe(false); seen.set(h, f); }
  });
  it('presupuesto: assets incluidos < 3 MB (red móvil)', () => { let t = 0; for (const e of Object.values(MANIFEST)) t += e.sizeBytes; for (const a of Object.values(AUDIO)) t += fs.statSync(path.join(PUBLIC, a.url)).size; expect(t).toBeLessThan(3e6); });
});

describe('AssetManager', () => {
  it('carga bajo demanda: crear el manager no lee nada; load lee una vez por URL', async () => {
    const f = nodeFetcher(), am = new AssetManager({ fetchGLTF: f }); expect(f.counter.n).toBe(0);
    await am.load('pot'); await am.load('pot'); expect(f.counter.n).toBe(1); expect(am.stats().refs['assets/models/Pot_1.glb']).toBe(2);
  });
  it('dos ids con el mismo archivo comparten una sola lectura (sin duplicados)', async () => {
    const f = nodeFetcher(), am = new AssetManager({ fetchGLTF: f, manifest: { a: { ...MANIFEST.spoon }, b: { ...MANIFEST.spoon, fit: { axis: 'y', size_m: 0.1 } } } });
    await am.load('a'); await am.load('b'); expect(f.counter.n).toBe(1);
  });
  it('escala y orientación reales: olla ≈ 0.2 m de cuerpo y ~0.15 m de alto; quemador, cuchara, botella y frasco con tamaños plausibles', async () => {
    const am = new AssetManager({ fetchGLTF: nodeFetcher() });
    const pot = await am.load('pot'), s = size(pot); expect(s.x).toBeCloseTo(0.2786, 3); expect(s.y).toBeGreaterThan(0.14); expect(s.y).toBeLessThan(0.24);
    const bb = new THREE.Box3().setFromObject(pot); expect(bb.min.y).toBeCloseTo(0, 6); expect((bb.min.x + bb.max.x) / 2).toBeCloseTo(0, 4);
    expect(size(await am.load('burner')).x).toBeCloseTo(0.883 * 0.763, 3); expect(size(await am.load('spoon')).y).toBeCloseTo(0.326 * 0.763, 3);
    expect(size(await am.load('bottle')).y).toBeCloseTo(0.26, 3); expect(size(await am.load('jar')).y).toBeCloseTo(0.22, 3);
  });
  it('la tapa de la olla se localiza y se puede ocultar', async () => {
    const am = new AssetManager({ fetchGLTF: nodeFetcher() }), pot = await am.load('pot');
    expect(pot.userData.lidNodes.length).toBe(2); pot.userData.setLid(false); expect(pot.userData.lidNodes.every((n) => !n.visible)).toBe(true); pot.userData.setLid(true); expect(pot.userData.lidNodes.every((n) => n.visible)).toBe(true);
  });
  it('release descuenta referencias y libera la caché al llegar a 0', async () => {
    const am = new AssetManager({ fetchGLTF: nodeFetcher() }), a = await am.load('spoon'), b = await am.load('spoon');
    am.release(a); expect(am.stats().cached).toBe(1); am.release(b); expect(am.stats().cached).toBe(0);
  });
  it('si el GLB falla, usa la primitiva de respaldo con la misma interfaz', async () => {
    const am = new AssetManager({ fetchGLTF: async () => { throw new Error('404'); } }), pot = await am.load('pot');
    expect(pot.userData.fallback).toBe(true); expect(size(pot).x).toBeGreaterThan(0.15); pot.userData.setLid(false); expect(pot.userData.parts.lid.visible).toBe(false);
  });
  it('asset desconocido falla con error claro', async () => { await expect(new AssetManager({ fetchGLTF: nodeFetcher() }).load('nada')).rejects.toThrow(/desconocido/); });
});

describe('audio: eventos del core → sonido', () => {
  const fakeCtx = () => { const log = { started: 0, gains: [] }; const mk = () => ({ gain: { value: 0, setTargetAtTime: (v) => log.gains.push(v) }, connect() {} });
    return { log, ctx: { state: 'suspended', currentTime: 0, destination: {}, resume() { this.state = 'running'; return Promise.resolve(); }, decodeAudioData: async () => ({}), createBufferSource: () => ({ connect() {}, start() { log.started++; }, loop: false }), createGain: mk } }; };
  it('no crea AudioContext hasta el gesto del usuario', async () => { const { ctx } = fakeCtx(); let made = 0; const a = new AudioManager({ makeContext: () => { made++; return ctx; }, fetchBuffer: async () => new ArrayBuffer(1) }); a.onEvent({ type: 'BOIL_START' }); expect(made).toBe(0); await a.unlock(); expect(made).toBe(1); expect(ctx.state).toBe('running'); });
  it('BOIL_START inicia el lazo y el volumen sigue el flujo de vapor calculado', async () => {
    const { ctx, log } = fakeCtx(), a = new AudioManager({ makeContext: () => ctx, fetchBuffer: async () => new ArrayBuffer(1) }); await a.unlock(); a.onEvent({ type: 'BOIL_START' }); await new Promise((r) => setTimeout(r, 5));
    expect(log.started).toBe(1); a.update({ boilGen_kg_s: 4e-4, freeWater_kg: 0.2, bottomT_K: 373 }); const hi = log.gains.at(-1); a.update({ boilGen_kg_s: 0, freeWater_kg: 0.2, bottomT_K: 373 }); expect(hi).toBeGreaterThan(0.5); expect(log.gains.at(-1)).toBe(0);
  });
  it('SIZZLE inicia el chisporroteo y no suena con agua libre', async () => {
    const { ctx, log } = fakeCtx(), a = new AudioManager({ makeContext: () => ctx, fetchBuffer: async () => new ArrayBuffer(1) }); await a.unlock(); a.onEvent({ type: 'SIZZLE' }); await new Promise((r) => setTimeout(r, 5));
    a.update({ boilGen_kg_s: 0, freeWater_kg: 0.2, bottomT_K: 500 }); expect(log.gains.at(-1)).toBe(0); a.update({ boilGen_kg_s: 0, freeWater_kg: 0, bottomT_K: 500 }); expect(log.gains.at(-1)).toBeGreaterThan(0);
  });
});
