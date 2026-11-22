// Primitivas de respaldo con la misma interfaz que los GLB (el asset-manager devuelve Object3D con userData.parts).
import * as THREE from 'three';
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1, ...o });
function shadowed(g) { g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; }
const makers = {
  pot() { const g = new THREE.Group(), steel = std(0xb9bec5, { metalness: 0.85, roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.15, 40, 1, true), steel); body.position.y = 0.075; body.material.side = THREE.DoubleSide;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.004, 40), steel); base.position.y = 0.002;
    const lid = new THREE.Group(); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2.4), steel); dome.scale.y = 0.35; const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), std(0x222222)); knob.position.y = 0.04;
    lid.add(dome, knob); lid.position.y = 0.15; lid.name = 'lid'; g.add(body, base, lid);
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.02), std(0x222222)); h.position.set(s * 0.13, 0.12, 0); g.add(h); }
    g.userData.parts = { lid }; return shadowed(g); },
  burner() { const g = new THREE.Group(); const plate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.6), std(0x1b1b1d, { roughness: 0.3 })); plate.position.y = 0.01;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.008, 8, 40), std(0x333333)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.022; g.add(plate, ring); return shadowed(g); },
  spoon() { const g = new THREE.Group(); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.2, 10), std(0x8b5a2b)); h.position.y = 0.1; const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), std(0x8b5a2b)); b.scale.set(1, 0.4, 1.3); b.position.y = 0.21; g.add(h, b); return shadowed(g); },
  bottle() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.17, 20), std(0x9fd3ff, { transparent: true, opacity: 0.6 })); b.position.y = 0.085; const n = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.07, 14), std(0x9fd3ff, { transparent: true, opacity: 0.6 })); n.position.y = 0.205; g.add(b, n); return shadowed(g); },
  jar() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 20), std(0xeeeeee, { transparent: true, opacity: 0.55 })); b.position.y = 0.1; const f = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.14, 20), std(0xf0e7d0)); f.position.y = 0.075; g.add(b, f); return shadowed(g); },
};
export const makePrimitive = (name) => makers[name]();
export const hasPrimitive = (name) => name in makers;
