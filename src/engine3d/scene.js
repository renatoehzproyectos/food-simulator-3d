// Entorno, cámara, luces y bucle (REQ-3D-001). buildWorld() no necesita WebGL (testeable en Node); createRenderer() sí.
import * as THREE from 'three';
export const COUNTER = { w: 1.8, d: 0.9, y: 0 };
export const POT_R_IN = 0.0977, POT_H = 0.14;   // coherente con vessel.base_area_m2 = 0.03 y height_m = 0.14 de la simulación

export function buildWorld({ shadowMap = 1024 } = {}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1d1a17); scene.fog = new THREE.Fog(0x1d1a17, 2.5, 6);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 20); camera.position.set(0.0, 0.62, 0.78); camera.lookAt(0, 0.08, 0);
  scene.add(new THREE.HemisphereLight(0xfff1de, 0x3a2f27, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(0.6, 1.4, 0.8); sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMap, shadowMap); Object.assign(sun.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1, near: 0.2, far: 4 }); sun.shadow.bias = -0.0004; scene.add(sun);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(COUNTER.w, 0.04, COUNTER.d), new THREE.MeshStandardMaterial({ color: 0x8a7966, roughness: 0.7 }));
  counter.position.y = -0.02; counter.receiveShadow = true; counter.name = 'counter'; scene.add(counter);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(COUNTER.w, 1.2), new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.9 })); wall.position.set(0, 0.6, -COUNTER.d / 2); wall.receiveShadow = true; scene.add(wall);
  return { scene, camera, sun, counter };
}
export async function createRenderer(canvas, { mobile = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  return renderer;
}
/** Resolución dinámica: baja el pixel ratio si el frame excede el presupuesto y lo sube cuando hay holgura. */
export class DynamicResolution {
  constructor(renderer, { max = 2, min = 0.6, budget_ms = 28 } = {}) { this.r = renderer; this.max = Math.min(max, globalThis.devicePixelRatio ?? 1); this.min = min; this.budget = budget_ms; this.scale = this.max; this.avg = 16; r_apply(this); }
  frame(dt_ms) { this.avg = this.avg * 0.92 + dt_ms * 0.08; if (this.avg > this.budget && this.scale > this.min) { this.scale = Math.max(this.min, this.scale * 0.9); r_apply(this); this.avg = this.budget * 0.8; } else if (this.avg < this.budget * 0.55 && this.scale < this.max) { this.scale = Math.min(this.max, this.scale * 1.05); r_apply(this); } }
}
function r_apply(d) { d.r.setPixelRatio(d.scale); }
export async function createControls(camera, dom) {
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
  const c = new OrbitControls(camera, dom); c.target.set(0, 0.08, 0); c.enableDamping = true; c.minDistance = 0.35; c.maxDistance = 1.8; c.minPolarAngle = 0.15; c.maxPolarAngle = Math.PI / 2 - 0.05;
  c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }; c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }; c.update(); return c;
}
/** "Vista de olla": acerca la cámara al contenido. */
export function potView(camera, controls, potPos) { camera.position.set(potPos.x, 0.34, potPos.z + 0.34); controls.target.set(potPos.x, 0.05, potPos.z); controls.update(); }
