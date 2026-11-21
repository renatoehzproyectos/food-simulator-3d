// @ts-check
// Núcleo del simulador: registro de alimentos, sesiones incrementales, comandos, eventos, snapshots (secs. 4.1, 4.2, 16).
import { validateSimulationInput, ValidationError } from './validation.js';
import { mulberry32 } from './prng.js';

export const ENGINE_VERSION = '0.1.0';
const MAX_STEPS_PER_ADVANCE = 2000;

/**
 * Definición de alimento (extensible, REQ-EXT-001):
 * { name, version, init(input, rng) → state, step(state, dt_s, ctx) → void, snapshot(state) → objeto plano,
 *   command?(state, cmd, ctx) → void, invariants?(state) → {massError_rel, energyError_rel} }
 * ctx = { emit(type, data), t_s, rng }
 */
export class FoodSimulator {
  constructor() { /** @type {Map<string, any>} */ this.foods = new Map(); }
  registerFood(def) {
    for (const k of ['name', 'version', 'init', 'step', 'snapshot'])
      if (!def?.[k]) throw new Error(`registerFood: falta '${k}'`);
    this.foods.set(def.name, def); return this;
  }
  /** Sesión incremental (createSession). Lanza ValidationError si la entrada es inválida. */
  createSession(input, { skipValidation = false } = {}) {
    const v = skipValidation ? { ok: true, errors: [], warnings: [] } : validateSimulationInput(input);
    if (!v.ok) throw new ValidationError(v.errors);
    const def = this.foods.get(input.food);
    if (!def) throw new ValidationError([{ code: 'E_FOOD_UNKNOWN', path: 'food', message: `Alimento no registrado: '${input.food}'.`, hint: `Registrados: ${[...this.foods.keys()].join(', ') || '(ninguno)'}.` }]);
    return new Session(def, input, v.warnings);
  }
  /** Modo batch: corre toda la duración y devuelve la evolución. */
  async simulate(input, { sampleEvery_s } = {}) {
    const s = this.createSession(input);
    const dur = input.environment.duration_s;
    const every = sampleEvery_s ?? dur / 200;
    const timeline = [s.snapshot()]; let next = every;
    while (s.t_s < dur - 1e-9) {
      s.advanceSim(Math.min(every, dur - s.t_s));
      if (s.t_s + 1e-9 >= next) { timeline.push(s.snapshot()); next += every; }
    }
    const final = s.snapshot();
    return { meta: { engineVersion: ENGINE_VERSION, models: { [s.def.name]: s.def.version }, dt_s: s.dt_s, seed: s.seed },
      validation: { ok: true, errors: [], warnings: s.warnings }, initial: timeline[0], timeline, final, events: s.events.slice() };
  }
}

class Session {
  constructor(def, input, warnings) {
    this.def = def; this.input = input; this.warnings = warnings;
    this.seed = input.simulation?.seed ?? 1; this.dt_s = input.simulation?.timeStep_s ?? 0.1;
    this.rng = mulberry32(this.seed); this.t_s = 0; this.step = 0; this._acc = 0;
    /** @type {any[]} */ this.events = []; this._listeners = []; this._queue = [];
    this.state = def.init(input, this.rng);
  }
  on(type, fn) { this._listeners.push({ type, fn }); return this; }
  emit(type, data = {}) { const e = { type, t_s: this.t_s, ...data }; this.events.push(e); for (const l of this._listeners) if (l.type === type || l.type === 'event') l.fn(e); }
  /** Encola un comando (la interacción nunca toca el estado directamente). */
  command(cmd) {
    if (!cmd || typeof cmd.type !== 'string') throw new ValidationError([{ code: 'E_CMD', path: 'type', message: 'Comando sin type.', hint: 'Ej.: { type: "SET_HEAT", sourceId, power_W }.' }]);
    this._queue.push(cmd);
  }
  /** Avance desde el render: acumula wallDt*timeScale y consume pasos fijos (máx. N por llamada, sec. 4.2). */
  advance(simDt_s) {
    this._acc += simDt_s; let n = 0;
    while (this._acc >= this.dt_s - 1e-12 && n < MAX_STEPS_PER_ADVANCE) { this._stepOnce(); this._acc -= this.dt_s; n++; }
    if (n === MAX_STEPS_PER_ADVANCE) this._acc = 0; // descarta deuda para no bloquear la UI
    return n;
  }
  /** Avanza exactamente `dur_s` (último paso recortado). */
  advanceSim(dur_s) {
    let left = dur_s;
    while (left > 1e-12) { const h = Math.min(this.dt_s, left); this._stepOnce(h); left -= h; }
  }
  _stepOnce(h = this.dt_s) {
    const ctx = { emit: (t, d) => this.emit(t, d), t_s: this.t_s, rng: this.rng };
    while (this._queue.length) this.def.command?.(this.state, this._queue.shift(), ctx);
    this.def.step(this.state, h, ctx);
    this.t_s += h; this.step++;
  }
  /** Snapshot de solo lectura (datos planos; Float32Array transferibles). */
  snapshot() {
    const body = this.def.snapshot(this.state);
    const balances = this.def.invariants?.(this.state) ?? { massError_rel: 0, energyError_rel: 0 };
    return Object.freeze({ t_s: this.t_s, step: this.step, ...body, balances });
  }
}
