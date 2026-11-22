// Raycasting + arrastre con Pointer Events (ratón y táctil). Emite comandos mediante emit(cmd).
import * as THREE from 'three';
import { tiltFor, pourCommand, stirCommand, dropPot, isOver, clampToCounter } from './interaction-logic.js';

export class Interaction {
  /** items: {pot,bottle,jar,spoon} (Object3D con userData.kind). getHeat(): potencia actual; onHeatChange(on). */
  constructor({ dom, camera, controls, items, burner, emit, getPower }) {
    Object.assign(this, { dom, camera, controls, items, burner, emit, getPower }); this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
    this.drag = null; this.home = {}; this.onHeat = false; this.lastStir = -1; this.clock = 0; this.potPos = { x: 0, z: 0 };
    for (const [k, o] of Object.entries(items)) { o.userData.kind = k; this.home[k] = o.position.clone(); }
    this._down = (e) => this.pointerDown(e); this._move = (e) => this.pointerMove(e); this._up = (e) => this.pointerUp(e);
    dom.addEventListener('pointerdown', this._down); dom.addEventListener('pointermove', this._move); dom.addEventListener('pointerup', this._up); dom.addEventListener('pointercancel', this._up);
  }
  _ndc(e) { const r = this.dom.getBoundingClientRect(); this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.ray.setFromCamera(this.ndc, this.camera); }
  _planePoint(y) { const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null; }
  pointerDown(e) {
    this._ndc(e); const hits = this.ray.intersectObjects(Object.values(this.items), true); if (!hits.length) return;
    let o = hits[0].object; while (o && !o.userData.kind) o = o.parent; if (!o) return;
    const kind = o.userData.kind, lift = kind === 'pot' ? 0.0 : 0.14, pt = this._planePoint(lift) ?? o.position;
    this.drag = { kind, obj: o, lift, off: { x: o.position.x - pt.x, z: o.position.z - pt.z }, id: e.pointerId }; this.controls && (this.controls.enabled = false); this.dom.setPointerCapture?.(e.pointerId);
  }
  pointerMove(e) {
    if (!this.drag || e.pointerId !== this.drag.id) return; this._ndc(e); const p = this._planePoint(this.drag.lift); if (!p) return;
    const c = clampToCounter({ x: p.x + this.drag.off.x, z: p.z + this.drag.off.z }); this.drag.obj.position.set(c.x, this.drag.lift, c.z);
    if (this.drag.kind === 'pot') this.potPos = c;
  }
  pointerUp(e) {
    if (!this.drag || e.pointerId !== this.drag.id) return; const d = this.drag; this.drag = null; this.controls && (this.controls.enabled = true);
    if (d.kind === 'pot') { const r = dropPot(d.obj.position, this.burner, this.onHeat, this.getPower()); this.onHeat = r.onHeat; this.potPos = r.pos; d.obj.position.set(r.pos.x, r.onHeat ? (this.heatY ?? 0.02) : 0, r.pos.z); r.cmds.forEach(this.emit); this.onPotMoved?.(r); }
  }
  /** Atajo accesible (botón/teclado): lleva la olla al fuego o la retira. */
  placePot(on) {
    const o = this.items.pot, r = dropPot(on ? this.burner : { x: 9, z: 9 }, this.burner, this.onHeat, this.getPower());
    const pos = on ? { x: this.burner.x, z: this.burner.z } : { x: this.home.pot.x, z: this.home.pot.z };
    this.onHeat = on; this.potPos = pos; o.position.set(pos.x, on ? (this.heatY ?? 0.02) : 0, pos.z);
    (on ? [{ type: 'PLACE_ON_HEAT', containerId: 'pot', sourceId: 'burner', power_W: this.getPower() }] : [{ type: 'REMOVE_FROM_HEAT', sourceId: 'burner' }]).forEach(this.emit);
  }
  /** Cada frame (dt de pared): inclinación/vertido, agitado, retorno a casa. Devuelve info para HUD. */
  update(dt) {
    this.clock += dt; const pot = this.potPos, out = {};
    for (const k of ['bottle', 'jar', 'spoon']) {
      const o = this.items[k], held = this.drag?.kind === k;
      if (held) {
        if (k === 'spoon') { const over = isOver(o.position, pot, 0.09); o.rotation.z += ((over ? 0.35 : 0) - o.rotation.z) * Math.min(1, dt * 8);
          if (over) { const c = stirCommand(this.clock, this.lastStir); if (c) { this.lastStir = this.clock; this.emit(c); } } }
        else { const tilt = tiltFor(o.position, pot, true); o.rotation.z += (tilt - o.rotation.z) * Math.min(1, dt * 6); const c = pourCommand(k === 'bottle' ? 'water' : 'rice', o.rotation.z, dt); if (c) { this.emit(c); out[k] = true; } }
      } else { o.position.lerp(this.home[k], Math.min(1, dt * 6)); o.rotation.z += (0 - o.rotation.z) * Math.min(1, dt * 6); }
    }
    return out;
  }
  dispose() { this.dom.removeEventListener('pointerdown', this._down); this.dom.removeEventListener('pointermove', this._move); this.dom.removeEventListener('pointerup', this._up); this.dom.removeEventListener('pointercancel', this._up); }
}
