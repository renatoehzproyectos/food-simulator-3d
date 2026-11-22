// @ts-check
// Lógica del Web Worker de simulación, sin globals del navegador (testeable en Node). Protocolo:
//   main → worker: {t:'init', input} · {t:'cmd', cmd} · {t:'tick', simDt}
//   worker → main: {t:'snap', snap, events, steps, ms} · {t:'error', message}
import { createFoodSimulator } from '../registry.js';

/** Recoge los ArrayBuffer de typed arrays (sin duplicados) para transferirlos en vez de copiarlos. */
export function collectBuffers(obj, out = new Set(), seen = new Set()) {
  if (!obj || typeof obj !== 'object' || seen.has(obj)) return out;
  seen.add(obj);
  if (ArrayBuffer.isView(obj)) { out.add(obj.buffer); return out; }
  for (const k of Object.keys(obj)) collectBuffers(obj[k], out, seen);
  return out;
}

/** @param {{post:(msg:any, transfer?:any[])=>void, now?:()=>number, budget_ms?:number, maxBacklog_s?:number, factory?:any}} o */
export function createWorkerHandler({ post, now = () => globalThis.performance.now(), budget_ms = 10, maxBacklog_s = 30, factory = createFoodSimulator }) {
  /** @type {any} */ let session = null; let events = [];
  const send = (steps, ms) => {
    const snap = session.snapshot(); const ev = events; events = [];
    post({ t: 'snap', snap, events: ev, steps, ms }, [...collectBuffers(snap)]);
  };
  return function onMessage(msg) {
    try {
      switch (msg.t) {
        case 'init': session = factory().createSession(msg.input, { skipValidation: !!msg.skipValidation }); events = []; session.on('event', (e) => events.push(e)); send(0, 0); break;
        case 'cmd': session?.command(msg.cmd); break;
        case 'tick': { if (!session) break; const t0 = now(); const n = session.advanceFor(msg.simDt, budget_ms, { maxBacklog_s, now }); send(n, now() - t0); break; }
        default: post({ t: 'error', message: `mensaje desconocido: ${msg.t}` });
      }
    } catch (e) { post({ t: 'error', message: String(e?.message ?? e) }); }
  };
}
