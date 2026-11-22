// Lógica pura de interacción (testeable sin DOM/WebGL). La interacción SOLO emite comandos; el core decide el efecto físico (sec. 4.1, 12).
export const POUR = { water_m3_s: 1.0e-4, rice_kg_s: 0.08, tiltMax: 1.9, overRadius: 0.13, snapRadius: 0.14 };
export const HEAT_MAX_W = 2000, HEAT_STEP_W = 250;
export const dist2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const isOver = (pos, target, r = POUR.overRadius) => dist2D(pos, target) < r;
export const clampToCounter = (p, w = 1.8, d = 0.9, m = 0.12) => ({ x: Math.min(w / 2 - m, Math.max(-w / 2 + m, p.x)), z: Math.min(d / 2 - m, Math.max(-d / 2 + m, p.z)) });
export const nextHeat = (power_W, dir) => Math.min(HEAT_MAX_W, Math.max(0, Math.round((power_W + dir * HEAT_STEP_W) / HEAT_STEP_W) * HEAT_STEP_W));
/** Inclinación objetivo del vertedor: se inclina cuanto más cerca esté del centro de la olla. */
export const tiltFor = (pos, pot, held) => (!held || !isOver(pos, pot) ? 0 : POUR.tiltMax * (1 - dist2D(pos, pot) / POUR.overRadius * 0.5));
/** Caudal derivado de la inclinación (no de un timer): 0 bajo ~35 % del tilt máximo. */
export const flowFraction = (tilt) => Math.max(0, Math.min(1, (tilt / POUR.tiltMax - 0.35) / 0.65));
/** Comando de vertido/aporte para este frame (dt en segundos de pared). */
export function pourCommand(kind, tilt, dt) {
  const f = flowFraction(tilt); if (f <= 0) return null;
  return kind === 'water' ? { type: 'POUR_LIQUID', fromId: 'bottle', toId: 'pot', liquid: 'water', volume_m3: POUR.water_m3_s * f * dt, T_C: 20 }
    : { type: 'ADD_INGREDIENT', containerId: 'pot', ingredient: 'rice', mass_kg: POUR.rice_kg_s * f * dt };
}
/** ¿Soltó la olla sobre el quemador? → comandos y posición final. */
export function dropPot(pos, burner, wasOnHeat, power_W) {
  if (isOver(pos, burner, POUR.snapRadius)) return { onHeat: true, pos: { x: burner.x, z: burner.z }, cmds: [{ type: 'PLACE_ON_HEAT', containerId: 'pot', sourceId: 'burner', power_W }] };
  return { onHeat: false, pos: clampToCounter(pos), cmds: wasOnHeat ? [{ type: 'REMOVE_FROM_HEAT', sourceId: 'burner' }] : [] };
}
export const stirCommand = (t, last, period = 0.25) => (t - last >= period ? { type: 'STIR', containerId: 'pot', intensity: 1 } : null);
