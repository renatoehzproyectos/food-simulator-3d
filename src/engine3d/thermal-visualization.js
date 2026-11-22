// Vista térmica (REQ-3D-002): solo cambia materiales/visibilidad; NUNCA toca el core. Columna de temperatura con DataTexture + brillo de la pared.
import * as THREE from 'three';
import { thermalColor } from '../output/adapter.js';
import { POT_R_IN } from './scene.js';
import { FLOOR_Y } from './food-visuals.js';
const NCELL = 48;

export class ThermalView {
  constructor() {
    this.data = new Uint8Array(NCELL * 4); this.tex = new THREE.DataTexture(this.data, 1, NCELL, THREE.RGBAFormat); this.tex.magFilter = THREE.LinearFilter; this.tex.minFilter = THREE.LinearFilter; this.tex.needsUpdate = true;
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(POT_R_IN - 0.007, POT_R_IN - 0.007, 1, 32, 1, false), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, opacity: 0.92 }));
    this.column.visible = false; this.enabled = false; this.wallMaterials = []; this._orig = new Map();
  }
  /** Registra los materiales de la pared de la olla para teñirlos (se restauran al desactivar). */
  bindPot(obj) { obj.traverse((o) => { if (o.isMesh && o.material?.emissive) { this.wallMaterials.push(o.material); this._orig.set(o.material, o.material.emissive.clone()); } }); }
  setEnabled(on) { this.enabled = on; this.column.visible = on; if (!on) for (const m of this.wallMaterials) m.emissive.copy(this._orig.get(m)); }
  /** snap.state.T_profile_K: celda 0 = fondo, 1..n contenido. Devuelve true si actualizó. */
  update(snap) {
    if (!this.enabled) return false;
    const P = snap.state.T_profile_K, n = Math.max(1, Math.round(snap.state.level_m / 0.0025) + 1);
    let top = 1; for (let i = P.length - 1; i >= 1; i--) if (snap.state.freeWater_profile_kg[i] > 0 || i <= snap.foods[0].grid.nx) { top = i; break; }
    const h = Math.max(top * 0.0025, 0.004); this.column.scale.y = h; this.column.position.y = FLOOR_Y + h / 2;
    for (let k = 0; k < NCELL; k++) { const idx = 1 + Math.min(top - 1, Math.floor((k / (NCELL - 1)) * (top - 1))); const c = thermalColor(P[Math.min(idx, P.length - 1)]); this.data.set([c[0] * 255, c[1] * 255, c[2] * 255, 255], k * 4); }
    this.tex.needsUpdate = true;
    const w = thermalColor(snap.state.bottomT_K), glow = Math.min(1, Math.max(0, (snap.state.bottomT_K - 330) / 250));
    for (const m of this.wallMaterials) m.emissive.setRGB(w[0] * glow, w[1] * glow, w[2] * glow);
    return true;
  }
  dispose() { this.tex.dispose(); this.column.geometry.dispose(); this.column.material.dispose(); }
}
