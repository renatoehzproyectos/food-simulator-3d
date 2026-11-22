// Audio disparado por EVENTOS del core; volumen modulado por magnitudes calculadas. AudioContext solo tras un gesto del usuario (móvil).
import { AUDIO } from './manifest.js';
import { audioPlan } from '../output/adapter.js';

export class AudioManager {
  constructor({ baseUrl = '', makeContext = () => new (globalThis.AudioContext ?? globalThis.webkitAudioContext)(), fetchBuffer } = {}) {
    this.baseUrl = baseUrl; this.makeContext = makeContext; this.ctx = null; this.loops = {}; this.enabled = true; this.started = new Set();
    this.fetchBuffer = fetchBuffer ?? (async (url) => (await fetch(url)).arrayBuffer());
  }
  /** Llamar desde un handler de pointerdown/click. */
  async unlock() { if (!this.ctx) this.ctx = this.makeContext(); if (this.ctx.state === 'suspended') await this.ctx.resume(); return this.ctx.state; }
  async _loop(name) {
    if (!this.ctx || this.loops[name]) return; const a = AUDIO[name]; this.loops[name] = { pending: true };
    try {
      const buf = await this.ctx.decodeAudioData(await this.fetchBuffer(this.baseUrl + a.url));
      const src = this.ctx.createBufferSource(), gain = this.ctx.createGain(); src.buffer = buf; src.loop = a.loop; gain.gain.value = 0; src.connect(gain); gain.connect(this.ctx.destination); src.start();
      this.loops[name] = { src, gain };
    } catch (e) { delete this.loops[name]; }
  }
  /** Evento del core → inicia el lazo correspondiente (la carga es perezosa). */
  onEvent(e) { for (const [name, a] of Object.entries(AUDIO)) if (a.event === e.type) { this.started.add(name); this._loop(name); } }
  /** Cada frame: volumen según el estado calculado. */
  update(state) {
    if (!this.ctx || !this.enabled) return; const p = audioPlan(state), t = this.ctx.currentTime;
    const vol = { boil: p.boilVolume, sizzle: p.sizzleVolume };
    for (const [name, l] of Object.entries(this.loops)) l.gain?.gain.setTargetAtTime(this.started.has(name) ? vol[name] : 0, t, 0.25);
  }
  setEnabled(on) { this.enabled = on; if (!on) for (const l of Object.values(this.loops)) l.gain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); }
}
