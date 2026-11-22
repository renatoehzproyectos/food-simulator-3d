// @ts-check
// Output Adapter (sec. 10.5): funciones PURAS snapshot → parámetros visuales. No importa three. Todo mapeo visual está aquí y se testea.
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Color RGB (0..1) del grano: blanco opaco crudo → translúcido/crema al gelatinizar → marrón → negro al quemarse. */
export function grainColor(alpha, B) {
  const raw = [0.93, 0.9, 0.82], cooked = [0.97, 0.96, 0.93], brown = [0.45, 0.27, 0.1], black = [0.06, 0.04, 0.03];
  const c = mix3(raw, cooked, clamp01(alpha)), b = clamp01(B);
  return b < 0.5 ? mix3(c, brown, b * 2) : mix3(brown, black, (b - 0.5) * 2);
}
/** Opacidad del grano (1 crudo opaco → 0.78 translúcido). */
export const grainOpacity = (alpha) => lerp(1, 0.78, clamp01(alpha));
/** Escala lineal del grano por hinchamiento: (V/V0)^(1/3), con V/V0 del snapshot. */
export const grainScale = (swellV) => Math.cbrt(Math.max(1, swellV));
/** Rugosidad: más húmedo/blando ⇒ más brillante (menos rugoso). */
export const grainRoughness = (M_db, hardness_N) => clamp01(lerp(0.85, 0.35, clamp01(M_db / 2.2)) + (hardness_N > 60 ? 0.1 : 0));
/** Paleta térmica azul→rojo→blanco (T en K). */
export function thermalColor(T_K, T_min = 293.15, T_max = 473.15) {
  const t = clamp01((T_K - T_min) / (T_max - T_min));
  if (t < 0.5) return mix3([0.1, 0.25, 0.9], [0.9, 0.1, 0.1], t * 2);
  return mix3([0.9, 0.1, 0.1], [1, 1, 0.95], (t - 0.5) * 2);
}
/** Altura del nivel del líquido en la escena (m) = nivel de la simulación (coherencia física: baja al evaporarse/absorberse). */
export const liquidLevel = (state) => state.level_m;
/** Tasa de burbujas (1/s): mapeo VISUAL de la tasa de generación de vapor calculada (nunca un timer). */
export const bubbleRate = (state, max = 140) => Math.min(max, Math.max(0, state.boilGen_kg_s) * 3e4);
/** Tasa de partículas de vapor (1/s) a partir del flujo de vapor que escapa. */
export const steamRate = (state, max = 60) => Math.min(max, Math.max(0, state.evap_kg_s) * 4e4);
/** Intensidad del resplandor del quemador 0..1. */
export const burnerGlow = (state) => (state.heat?.on ? clamp01(state.heat.mode === 'power' ? (state.heat.power_W * state.heat.intensity) / 2000 : 0.6) : 0);
/** Número de granos visibles a partir de la masa de arroz (muestra representativa, máx maxGrains). */
export const visibleGrains = (riceMass_kg, maxGrains = 2200) => Math.min(maxGrains, Math.round(riceMass_kg * 11000));
/** Plan de audio a partir del estado: volumen de ebullición ∝ flujo de vapor calculado; chisporroteo con fondo seco y caliente. */
export function audioPlan(state) {
  const boil = clamp01(state.boilGen_kg_s / 4e-4), dryHot = state.freeWater_kg < 1e-4 && state.bottomT_K > 400;
  return { boilVolume: boil * 0.8, sizzleVolume: dryHot ? clamp01((state.bottomT_K - 400) / 200) * 0.7 : 0 };
}
/** Textos de estado (HUD). */
export const OUTCOME_ES = { duro: 'Duro (crudo por dentro)', cocido: 'Cocido', blando: 'Blando', sobrecocido: 'Sobrecocido', quemado: 'Quemado' };
