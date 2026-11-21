// @ts-check
// Fachada sobre @tangent.to/ode (vendorizado en /vendor/ode) — REQ-NUM-001.
import { rk45, rosenbrock, euler, rk2, rk4 } from '../../vendor/ode/index.js';

const FIXED = { euler, rk2, rk4 };

/**
 * Integra y' = f(t, y).
 * method: 'auto' (no rígido → rk45; stiff:true → rosenbrock) | euler | rk2 | rk4 | rk45 | rosenbrock.
 * Resultado: {t, y (componente-mayor), events:[{t:[],y:[]}], method, ...}
 * @param {(t:number, y:number[]) => number[]} f
 * @param {[number, number]} tSpan
 * @param {number[]} y0
 * @param {any} [opts]
 */
export function solveODE(f, tSpan, y0, opts = {}) {
  const { method = 'auto', stiff = false, events, ...rest } = opts;
  const m = method === 'auto' ? (stiff ? 'rosenbrock' : 'rk45') : method;
  if (m in FIXED) return { ...FIXED[m](f, tSpan, y0, rest), method: m };
  if (m === 'rk45') return { ...rk45(f, tSpan, y0, { ...rest, events }), method: m };
  if (m === 'rosenbrock') {
    if (!events) return { ...rosenbrock(f, tSpan, y0, rest), method: m };
    return rosenbrockWithEvents(f, tSpan, y0, rest, events);
  }
  throw new Error(`solveODE: método desconocido '${method}'`);
}

/** Eventos para Rosenbrock (el paquete no los soporta): integración por tramos + bisección. */
function rosenbrockWithEvents(f, tSpan, y0, opts, events) {
  const gs = Array.isArray(events) ? events : [events];
  const { eventChunks = 200, ...ropts } = opts;
  const [t0, t1] = tSpan;
  const h = (t1 - t0) / eventChunks;
  const ts = [t0]; const ys = [y0.slice()];
  const found = gs.map(() => ({ t: [], y: [] }));
  const adv = (ta, ya, tb) => rosenbrock(f, [ta, tb], ya, ropts).y.map((c) => c[c.length - 1]);
  let t = t0, y = y0.slice(); const gPrev = gs.map((g) => g(t, y));
  for (let k = 0; k < eventChunks; k++) {
    const tn = k === eventChunks - 1 ? t1 : t + h; const yn = adv(t, y, tn);
    gs.forEach((g, i) => {
      const gn = g(tn, yn);
      if (gPrev[i] * gn < 0) {
        let lo = t, hi = tn, ylo = y;
        for (let it = 0; it < 50; it++) {
          const mid = 0.5 * (lo + hi); const ym = adv(lo, ylo, mid);
          if (g(lo, ylo) * g(mid, ym) <= 0) hi = mid; else { lo = mid; ylo = ym; }
        }
        const te = 0.5 * (lo + hi); found[i].t.push(te); found[i].y.push(adv(lo, ylo, te));
      }
      gPrev[i] = gn;
    });
    t = tn; y = yn; ts.push(t); ys.push(y.slice());
  }
  return { t: ts, y: y0.map((_, i) => ys.map((v) => v[i])), events: found, success: true, method: 'rosenbrock' };
}
