// @ts-check
// Cliente de simulación para la UI: misma interfaz con Worker (preferido) o en el hilo principal (respaldo).
// advance(dt) acumula tiempo simulado y lo envía cuando el Worker está libre; snapshot() devuelve el último recibido.
import { createFoodSimulator } from '../registry.js';

export function createSimClient(input, { useWorker = true, skipValidation = true, maxPending_s = 120, onError = console.warn } = {}) {
  const listeners = []; let snap = null, pending = 0, inflight = false, worker = null, local = null, dead = false;
  const stats = { steps: 0, ms: 0, mode: 'main' };
  const fire = (events) => { for (const e of events) for (const l of listeners) l(e); };
  if (useWorker && typeof Worker !== 'undefined') {
    try { worker = new Worker(new URL('./sim-worker.js', import.meta.url), { type: 'module' }); } catch (e) { onError('Worker no disponible, simulación en el hilo principal', e); worker = null; }
  }
  if (worker) {
    stats.mode = 'worker';
    const flush = () => { if (dead || inflight || pending <= 0) return; inflight = true; const dt = pending; pending = 0; worker.postMessage({ t: 'tick', simDt: dt }); };
    worker.onmessage = (e) => { const m = e.data;
      if (m.t === 'snap') { snap = m.snap; inflight = false; stats.steps = m.steps; stats.ms = m.ms; fire(m.events); flush(); }
      else if (m.t === 'error') onError('sim-worker:', m.message); };
    worker.onerror = (e) => { onError('sim-worker falló', e.message); };
    inflight = true; worker.postMessage({ t: 'init', input, skipValidation });   // la 1.ª respuesta es el snapshot inicial
    return {
      get mode() { return 'worker'; }, stats, ready: () => snap !== null,
      command: (cmd) => worker.postMessage({ t: 'cmd', cmd }),
      advance: (dt) => { pending = Math.min(maxPending_s, pending + dt); flush(); },
      snapshot: () => snap, on: (fn) => { listeners.push(fn); },
      dispose: () => { dead = true; worker.terminate(); },
    };
  }
  local = createFoodSimulator().createSession(input, { skipValidation });
  local.on('event', (e) => fire([e])); snap = local.snapshot();
  return {
    get mode() { return 'main'; }, stats, ready: () => true,
    command: (cmd) => local.command(cmd),
    advance: (dt) => { const t0 = performance.now(); stats.steps = local.advanceFor(dt, 8); stats.ms = performance.now() - t0; snap = local.snapshot(); },
    snapshot: () => snap, on: (fn) => { listeners.push(fn); }, dispose: () => { dead = true; },
  };
}
