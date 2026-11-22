// Líquido: malla cilíndrica con nivel = nivel calculado por el core; burbujas y vapor como partículas instanciadas cuya tasa viene del flujo de vapor calculado.
import * as THREE from 'three';
import { mulberry32 } from '../core/prng.js';
import { liquidLevel, bubbleRate, steamRate } from '../output/adapter.js';
import { POT_R_IN, POT_H } from './scene.js';
import { FLOOR_Y } from './food-visuals.js';
const NB = 160, NS = 70;

export class LiquidSystem {
  constructor() {
    this.group = new THREE.Group();
    this.water = new THREE.Mesh(new THREE.CylinderGeometry(POT_R_IN - 0.005, POT_R_IN - 0.005, 1, 40), new THREE.MeshPhysicalMaterial({ color: 0x8fc4e8, transparent: true, opacity: 0.5, roughness: 0.08, metalness: 0, clearcoat: 0.6 }));
    this.water.visible = false; this.group.add(this.water);
    this.bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.8 }), NB); this.bubbles.count = 0; this.bubbles.frustumCulled = false; this.group.add(this.bubbles);
    this.steam = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }), NS); this.steam.count = 0; this.steam.frustumCulled = false; this.group.add(this.steam);
    this.rnd = mulberry32(11); this.b = []; this.s = []; this._accB = 0; this._accS = 0; this._d = new THREE.Object3D(); this.level = 0;
  }
  /** snap: snapshot del core; dt: segundos de PARED (la animación visual no se acelera con timeScale). */
  update(snap, dt, { lidClosed = false } = {}) {
    const st = snap.state, level = liquidLevel(st); this.level = level;
    this.water.visible = level > 0.0005; this.water.scale.y = Math.max(level, 1e-4); this.water.position.y = FLOOR_Y + level / 2;
    const burn = Math.max(0, Math.min(1, st.B_bottom ?? 0)), br = bubbleRate(st), sr = Math.max(steamRate(st), burn > 0.05 ? 30 * burn : 0);
    this.steam.material.color.setRGB(1 - 0.8 * burn, 1 - 0.8 * burn, 1 - 0.8 * burn);   // humo oscuro al quemarse el fondo (B_bottom del core)
    this._accB += br * dt; while (this._accB >= 1 && this.b.length < NB) { this._accB -= 1; const r = Math.sqrt(this.rnd()) * (POT_R_IN - 0.01), th = this.rnd() * 6.283; this.b.push({ x: Math.cos(th) * r, z: Math.sin(th) * r, y: FLOOR_Y + 0.002, v: 0.08 + this.rnd() * 0.1 }); }
    if (this._accB > 1) this._accB = 0;
    this.b = this.b.filter((p) => (p.y += p.v * dt) < FLOOR_Y + level);
    const d = this._d; this.bubbles.count = this.b.length; this.b.forEach((p, i) => { d.position.set(p.x, p.y, p.z); d.scale.setScalar(1); d.updateMatrix(); this.bubbles.setMatrixAt(i, d.matrix); }); this.bubbles.instanceMatrix.needsUpdate = true;
    this._accS += sr * dt; while (this._accS >= 1 && this.s.length < NS) { this._accS -= 1; const r = Math.sqrt(this.rnd()) * POT_R_IN * 0.8, th = this.rnd() * 6.283; this.s.push({ x: Math.cos(th) * r, z: Math.sin(th) * r, y: POT_H + 0.01, age: 0, v: 0.06 + this.rnd() * 0.05 }); }
    if (this._accS > 1) this._accS = 0;
    this.s = this.s.filter((p) => { p.age += dt; p.y += p.v * dt; return p.age < 2.2; });
    this.steam.count = this.s.length; this.s.forEach((p, i) => { d.position.set(p.x + Math.sin(p.age * 2) * 0.01, p.y, p.z); d.scale.setScalar(0.5 + p.age * 0.6); d.updateMatrix(); this.steam.setMatrixAt(i, d.matrix); }); this.steam.instanceMatrix.needsUpdate = true;
    return { bubbles: this.b.length, steam: this.s.length, level };
  }
  setWaterVisible(v) { this._hidden = !v; this.water.visible = v && this.level > 0.0005; }
  dispose() { for (const m of [this.water, this.bubbles, this.steam]) { m.geometry.dispose(); m.material.dispose(); } }
}
