// assetId → ruta, categoría, tamaño, dependencias, ajuste de escala/orientación y LOD (sec. 13). Los GLB de VRChef no traen texturas (solo materiales).
// 'fit' normaliza en tiempo de ejecución con el bbox en mundo (los GLB mezclan unidades: cm, pulgadas, m); ver tests/assets.test.js.
export const SCENE_SCALE = 1; // escala global de la escena (1 unidad = 1 m)
export const MANIFEST = {
  pot:    { url: 'assets/models/Pot_1.glb', category: 'recipiente', sizeBytes: 347180, deps: [], fit: { axis: 'x', size_m: 0.2 / 0.262 * 0.365 }, anchor: 'bottom-center', lidMeshes: ['Sphere01', 'Line01'], fallback: 'pot' },
  burner: { url: 'assets/models/hotplate_oven.glb', category: 'fuente de calor', sizeBytes: 176408, deps: [], fit: { axis: 'x', size_m: 0.883 * 0.763 }, anchor: 'bottom-center', fallback: 'burner' },
  spoon:  { url: 'assets/models/Spoon.glb', category: 'utensilio', sizeBytes: 298624, deps: [], fit: { axis: 'y', size_m: 0.326 * 0.763 }, anchor: 'bottom-center', fallback: 'spoon' },
  bottle: { url: 'assets/models/bottle.glb', category: 'recipiente', sizeBytes: 258376, deps: [], fit: { axis: 'y', size_m: 0.26 }, anchor: 'bottom-center', fallback: 'bottle' },
  jar:    { url: 'assets/models/jar.glb', category: 'recipiente', sizeBytes: 362924, deps: [], fit: { axis: 'y', size_m: 0.22 }, anchor: 'bottom-center', fallback: 'jar' },
};
export const AUDIO = {
  boil:   { url: 'assets/audio/boiling_water.mp3', event: 'BOIL_START', loop: true },
  sizzle: { url: 'assets/audio/frying_sound.mp3', event: 'SIZZLE', loop: true },
};
// Huecos conocidos (sin asset en VRChef): grano de arroz, vapor, burbujas, sonido de verter/agitar → procedurales (ver docs/DECISIONS.md D3).
// Descartados por escala/uso: Table_1 (0.55 m, no es una mesada), Counter/Heat (planos de 0 de espesor, otro formato de unidades).
