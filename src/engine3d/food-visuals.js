// Granos de arroz: InstancedMesh con muestra representativa; color/escala vienen del adapter (que lee el snapshot del core).
import * as THREE from 'three';
import { mulberry32 } from '../core/prng.js';
import { grainColor, grainOpacity, grainScale, grainRoughness, visibleGrains } from '../output/adapter.js';
import { POT_R_IN } from './scene.js';
export const FLOOR_Y = 0.004, MAX_GRAINS = 2200;

export class RiceVisual {
  constructor() {
    const geo = new THREE.SphereGeometry(0.5, 8, 6); // elipsoide por escala de instancia
    this.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, transparent: true, opacity: 1 });
    this.mesh = new THREE.InstancedMesh(geo, this.material, MAX_GRAINS); this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.count = 0; this.mesh.frustumCulled = false;
    const rnd = mulberry32(7); this.u = []; // posiciones normalizadas deterministas
    for (let i = 0; i < MAX_GRAINS; i++) this.u.push({ r: Math.sqrt(rnd()) * 0.93, th: rnd() * Math.PI * 2, h: rnd(), yaw: rnd() * Math.PI, tilt: (rnd() - 0.5) * 0.8 });
    this._key = ''; this._dummy = new THREE.Object3D(); this._col = new THREE.Color(); this.last = null;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_GRAINS * 3), 3);
  }
  /** snapshot = session.snapshot() */
  update(snap) {
    const st = snap.state, food = snap.foods[0], nb = food.grid.nx, n = nb ? visibleGrains(st.riceMass_kg / 0.88 * 0.88) : 0, sc = grainScale(st.grainSwell_V);
    this.mesh.count = n; if (!n) { this.last = { n }; return; }
    const bedH = Math.min(0.13, Math.max(0.006, st.bedHeight_m * (1 + (st.grainSwell_V - 1) * 0.8))), size = 0.0062 * sc * 1.6;
    const key = `${n}|${bedH.toFixed(4)}|${size.toFixed(5)}`;
    if (key !== this._key) {
      this._key = key; const d = this._dummy;
      for (let i = 0; i < n; i++) { const g = this.u[i]; d.position.set(Math.cos(g.th) * g.r * (POT_R_IN - 0.012), FLOOR_Y + size * 0.4 + g.h * bedH, Math.sin(g.th) * g.r * (POT_R_IN - 0.012));
        d.rotation.set(g.tilt, g.yaw, 0); d.scale.set(size, size * 0.34, size * 0.34); d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix); }
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    const gel = food.fields.gelatinization, brn = food.fields.browning, ca = this.mesh.instanceColor.array;
    for (let i = 0; i < n; i++) { const cell = Math.min(nb - 1, Math.floor(this.u[i].h * nb)); const c = grainColor(gel[cell], brn[cell]); ca[i * 3] = c[0]; ca[i * 3 + 1] = c[1]; ca[i * 3 + 2] = c[2]; }
    this.mesh.instanceColor.needsUpdate = true;
    const a = food.scalars.doneness; this.material.opacity = grainOpacity(st.alpha_mean); this.material.roughness = grainRoughness(st.M_mean_db, st.hardness_N);
    this.last = { n, bedH, size, meanAlpha: st.alpha_mean };
  }
  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); this.mesh.dispose?.(); }
}
