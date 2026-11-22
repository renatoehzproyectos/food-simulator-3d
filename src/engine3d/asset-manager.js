// Carga bajo demanda con caché y conteo de referencias (sec. 13). Si un GLB falla, cae a la primitiva con la misma interfaz.
import * as THREE from 'three';
import { MANIFEST } from './manifest.js';
import { makePrimitive, hasPrimitive } from './primitives.js';

/** Normaliza un objeto cargado: escala por el eje indicado y coloca el origen en el centro-base. Usa el bbox en MUNDO (los GLB traen escalas en los nodos). */
export function normalizeObject(root, fit, anchor = 'bottom-center') {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  const s = fit ? fit.size_m / size[fit.axis] : 1;
  const wrap = new THREE.Group(); wrap.add(root); root.scale.multiplyScalar(s); wrap.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(wrap), c = b2.getCenter(new THREE.Vector3());
  root.position.x -= c.x; root.position.z -= c.z; root.position.y -= anchor === 'bottom-center' ? b2.min.y : c.y;
  wrap.updateMatrixWorld(true); return wrap;
}
const dispose = (obj) => obj.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose?.()); });

export class AssetManager {
  /** @param {{manifest?:any, baseUrl?:string, fetchGLTF?:(url:string)=>Promise<any>}} [o] */
  constructor({ manifest = MANIFEST, baseUrl = '', fetchGLTF } = {}) {
    this.manifest = manifest; this.baseUrl = baseUrl;
    this.fetchGLTF = fetchGLTF ?? (async (url) => { const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js'); return new GLTFLoader().loadAsync(url); });
    /** @type {Map<string, {promise:Promise<any>, refs:number, scene:any, fallback:boolean}>} */ this.cache = new Map(); // por URL: sin duplicados entre ids que comparten archivo
    this.requests = []; this.loadedBytes = 0;
  }
  /** Devuelve un clon listo para la escena. userData.setLid(bool) oculta/muestra la tapa si el asset la define. */
  async load(id) {
    const e = this.manifest[id]; if (!e) throw new Error(`asset desconocido: ${id}`);
    let ent = this.cache.get(e.url);
    if (!ent) {
      this.requests.push(e.url);
      ent = { refs: 0, scene: null, fallback: false, promise: null };
      ent.promise = this.fetchGLTF(this.baseUrl + e.url).then((g) => { ent.scene = g.scene; this.loadedBytes += e.sizeBytes ?? 0; })
        .catch((err) => { if (!e.fallback || !hasPrimitive(e.fallback)) throw err; ent.fallback = true; });
      this.cache.set(e.url, ent);
    }
    await ent.promise; ent.refs++;
    let obj;
    if (ent.fallback) obj = makePrimitive(e.fallback);
    else { obj = normalizeObject(ent.scene.clone(true), e.fit, e.anchor); obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }
    obj.userData.assetId = id; obj.userData.url = e.url; obj.userData.fallback = ent.fallback;
    const lidNodes = []; if (!ent.fallback && e.lidMeshes) obj.traverse((o) => { if (e.lidMeshes.includes(o.name)) lidNodes.push(o); });
    obj.userData.setLid = (closed) => { lidNodes.forEach((n) => { n.visible = closed; }); obj.userData.parts?.lid && (obj.userData.parts.lid.visible = closed); };
    obj.userData.lidNodes = lidNodes;
    return obj;
  }
  release(obj) {
    const ent = this.cache.get(obj.userData.url); if (!ent) return; ent.refs = Math.max(0, ent.refs - 1);
    obj.removeFromParent?.(); if (obj.userData.fallback) dispose(obj);
    if (ent.refs === 0 && ent.scene) { dispose(ent.scene); this.cache.delete(obj.userData.url); }
  }
  dispose() { for (const ent of this.cache.values()) ent.scene && dispose(ent.scene); this.cache.clear(); }
  stats() { return { cached: this.cache.size, requests: [...this.requests], loadedBytes: this.loadedBytes, refs: Object.fromEntries([...this.cache].map(([u, e]) => [u, e.refs])) }; }
}
