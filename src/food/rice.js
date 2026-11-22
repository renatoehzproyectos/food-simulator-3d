// @ts-check
// Modelo de ARROZ (REQ-RICE-001). Olla = columna 1D vertical (celda 0 = fondo de acero; celdas 1..n = contenido).
// Cada celda lleva: agua libre, arroz (sólidos secos) con UN grano esférico equivalente (Fick radial con 8 capas), α por capa y B (Maillard).
// El agua cae por gravedad hacia las celdas con hueco; el lecho no se expande (el hinchamiento solo se refleja en las salidas).
import { makeGrid, stepHeat } from '../physics/heat.js';
import { createGrain, stepGrain, grainWater_kg, RICE_GRAIN_DEFAULTS } from '../physics/moisture.js';
import { CP_WATER, surfaceEvaporation } from '../physics/evaporation.js';
import { L_V_WATER, T_BOIL_K, C_to_K, g_to_kg, SIGMA_SB } from '../core/units.js';
import { stepStarch } from '../chemistry/starch.js';
import { kMaillard } from '../chemistry/maillard.js';
import { hardness_N, doneness, stickiness } from './texture.js';
import { classifyRice, CLASS_PARAMS } from './classifier.js';

/** Propiedades típicas de libro (no calibradas). */
export const MATERIALS = {
  steel: { rho: 7850, cp: 500, k: 16 }, aluminum: { rho: 2700, cp: 900, k: 205 }, cast_iron: { rho: 7200, cp: 460, k: 52 },
  ceramic: { rho: 2400, cp: 800, k: 1.5 }, glass: { rho: 2500, cp: 840, k: 1.0 } };
/** ASSUMPTION: dimensiones típicas del grano (mm) por tipo; espesor = 0.8·ancho. */
export const RICE_TYPES = { long_grain: { L: 6.5, W: 2.0 }, medium_grain: { L: 5.5, W: 2.5 }, short_grain: { L: 5.0, W: 2.7 }, basmati: { L: 7.0, W: 1.8 }, jasmine: { L: 6.8, W: 2.0 } };
/** ASSUMPTION (salvo ρ del agua y L_v): ver docs/ASSUMPTIONS.md. */
export const RICE_PARAMS = { rho_grain: 1450, rho_bulk: 850, cp_dry: 1500, rho_w: 998, k_dry: 0.2, k_wet_bed: 5, k_wet_water: 20, boil_mix: 40, boil_tau_s: 5, stir_gain: 1, stir_tau_s: 15,
  eps_vessel: 0.3, h_top_closed: 4, h_top_open: 8, efficiency: 0.8, h_m: 0.005, leak: 0.1, dz: 0.0025, height_m: 0.1, nShells: 8, aw_half: 0.08, RH: 0.5, pH: 6.5 };

const NS = () => RICE_PARAMS.nShells;
/** Radio de la esfera con la misma razón V/A que el elipsoide del grano (Knud-Thomsen para A). */
export function grainGeometry(type, thicknessFactor = 0.8) {
  const d = RICE_TYPES[type]; const a = d.L / 2e3, b = d.W / 2e3, c = d.W * thicknessFactor / 2e3, p = 1.6075;
  const V = 4 / 3 * Math.PI * a * b * c, A = 4 * Math.PI * (((a * b) ** p + (a * c) ** p + (b * c) ** p) / 3) ** (1 / p);
  return { V, A, R_eq: 3 * V / A };
}

export const riceFood = {
  name: 'rice', version: '0.1.0',
  /** input validado (o vacío en modo interactivo). Crea una olla vacía y aplica los ingredientes como comandos en t=0. */
  init(input) {
    const P = { ...RICE_PARAMS, ...(input.params ?? {}) };
    const v = input.vessel ?? {}, mat = MATERIALS[v.material ?? 'steel'];
    const A = v.base_area_m2 ?? 0.03, dz = P.dz, n = Math.min(80, Math.ceil((v.height_m ?? P.height_m) / dz)) + 1;
    const mass = v.mass_kg ?? 0.6;
    const Tamb = C_to_K(input.environment?.T_ambient_C ?? input.environment?.initialTemperature_C ?? 20);
    const s = { P, A, dz, n, mat, Tamb, h_conv: input.environment?.h_conv_W_m2K ?? 10, perim: 2 * Math.sqrt(Math.PI * A),
      capPlate: mass * mat.cp, kPlate: mat.k, lid: v.lid?.closed ?? true, riceType: input.riceType ?? 'long_grain', wb0: input.grain?.initialMoisture_wb ?? 0.12,
      T: new Float64Array(n).fill(Tamb), mw: new Float64Array(n), r: new Float64Array(n), cap: new Float64Array(n),
      grains: /** @type {any[]} */ (new Array(n).fill(null)), nBed: 0, grids: new Map(), stir: 0,
      heat: { on: false, mode: 'power', power_W: 0, intensity: 1, T_set_K: Tamb },
      burnHold_s: 0, boilAct: 0, flags: { boil: false, depleted: false, burn: false, sizzle: false },
      led: { massIn: 0, E0: mass * mat.cp * Tamb, Eadded: 0, Ein: 0, Evap: 0, vaporLost: 0, spilled: 0 },
      lastEvap_kg_s: 0, lastGen_kg_s: 0, t: 0 };
    const gg = grainGeometry(s.riceType, input.grain?.thickness_factor);
    if (input.grain?.length_mm) { const r = grainGeometryFromDims(input.grain); Object.assign(gg, r); }
    s.gg = gg; s.rhoDry = (1 - s.wb0) * P.rho_grain; s.M0 = s.wb0 / (1 - s.wb0);
    s.gp = { ...RICE_GRAIN_DEFAULTS, rho_dry_kg_m3: s.rhoDry };
    s.nEffPerKg = (gg.V / (4 / 3 * Math.PI * gg.R_eq ** 3)) / (s.rhoDry * gg.V); // granos efectivos de la esfera por kg de sólido seco
    for (let i = 1; i < n; i++) s.cap[i] = P.rho_w * A * dz;
    const h = input.heating, ct = input.environment?.cookingTemperature_C;
    if (h?.mode === 'power') { s.heat = { on: true, mode: 'power', power_W: h.power_W, intensity: h.intensity ?? 1, T_set_K: Tamb }; }
    else if (h?.mode === 'temperature' || ct !== undefined) { s.heat = { on: true, mode: 'temperature', power_W: 0, intensity: 1, T_set_K: C_to_K(h?.cookingTemperature_C ?? ct) }; }
    if (input.ingredients?.rice?.mass_g > 0) addRice(s, g_to_kg(input.ingredients.rice.mass_g));
    if (input.ingredients?.water?.mass_g > 0) pourWater(s, g_to_kg(input.ingredients.water.mass_g), C_to_K(input.ingredients.water.T_C ?? 20));
    return s;
  },

  command(s, c, ctx) {
    switch (c.type) {
      case 'ADD_INGREDIENT': if (c.ingredient === 'rice') addRice(s, c.mass_kg); else ctx.emit('WARN', { message: `ingrediente no soportado: ${c.ingredient}` }); break;
      case 'POUR_LIQUID': { const m = c.mass_kg ?? c.volume_m3 * s.P.rho_w; const left = pourWater(s, m, C_to_K(c.T_C ?? 20)); if (left > 1e-9) ctx.emit('OVERFLOW', { spilled_kg: left }); break; }
      case 'PLACE_ON_HEAT': s.heat = { on: true, mode: 'power', power_W: c.power_W ?? s.heat.power_W, intensity: 1, T_set_K: s.heat.T_set_K }; break;
      case 'SET_HEAT': s.heat.power_W = c.power_W; s.heat.mode = 'power'; break;
      case 'REMOVE_FROM_HEAT': s.heat.on = false; break;
      case 'SET_LID': s.lid = !!c.closed; break;
      case 'STIR': s.stir = Math.max(s.stir, Math.min(1, Math.max(0, c.intensity ?? 1))); break;
      default: ctx.emit('WARN', { message: `comando desconocido: ${c.type}` });
    }
  },

  step(s, dt, ctx) { stepRice(s, dt, ctx); },
  snapshot(s) { return snapshotRice(s); },
  invariants(s) { return balances(s); },
};

function grainGeometryFromDims(g) { const a = g.length_mm / 2e3, b = g.width_mm / 2e3, c = (g.thickness_mm ?? g.width_mm * 0.8) / 2e3, p = 1.6075;
  const V = 4 / 3 * Math.PI * a * b * c, A = 4 * Math.PI * (((a * b) ** p + (a * c) ** p + (b * c) ** p) / 3) ** (1 / p); return { V, A, R_eq: 3 * V / A }; }

const capC = (s, i) => i === 0 ? s.capPlate : (s.mw[i] + absorbed(s, i)) * CP_WATER + s.r[i] * s.P.cp_dry;
function absorbed(s, i) { const g = s.grains[i]; return g ? g.nEff * grainWater_kg(g.g, s.gp) : 0; }
function mixIn(s, i, m_kg, T_in, extraQ = 0) { // añade m_kg de agua líquida a T_in en la celda i, conservando energía
  const C = capC(s, i); s.T[i] = (C * s.T[i] + m_kg * CP_WATER * T_in + extraQ) / (C + m_kg * CP_WATER); s.mw[i] += m_kg;
}
function moveWater(s, from, to, q) { // el agua que se mueve lleva su energía; la celda origen conserva su T
  const C = capC(s, to); s.T[to] = (C * s.T[to] + q * CP_WATER * s.T[from]) / (C + q * CP_WATER); s.mw[to] += q; s.mw[from] -= q;
}
function addRice(s, mass_kg) { // el arroz cae sobre la celda superior del lecho: la rellena (mezclando estados de grano) y después abre una celda nueva
  const P = s.P, cellV = s.A * s.dz, roomPer = cellV * P.rho_bulk * (1 - s.wb0), Tin = s.Tamb, solidTotal = mass_kg * (1 - s.wb0);
  let rem = solidTotal;
  while (rem > 1e-12) {
    let i = s.nBed;
    if (i === 0 || s.r[i] >= roomPer - 1e-12) { if (i + 1 >= s.n) break; i = ++s.nBed; s.grains[i] = { g: createGrain({ radius_m: s.gg.R_eq, n: P.nShells, M0_db: s.M0 }), nEff: 0, alpha: new Float64Array(P.nShells), B: 0 }; }
    const gr = s.grains[i], q = Math.min(rem, roomPer - s.r[i]), w = q / (s.r[i] + q);
    const C = capC(s, i), Cr = q * P.cp_dry + q * s.M0 * CP_WATER; s.T[i] = (C * s.T[i] + Cr * Tin) / (C + Cr);
    if (s.r[i] > 0) { for (let j = 0; j < P.nShells; j++) { gr.g.M[j] = (1 - w) * gr.g.M[j] + w * s.M0; gr.alpha[j] *= 1 - w; } gr.B *= 1 - w; }
    s.r[i] += q; gr.nEff += q * s.nEffPerKg; s.cap[i] = Math.max(0, P.rho_w * (cellV - s.r[i] / s.rhoDry)); rem -= q;
  }
  const solid = solidTotal - rem; s.led.massIn += solid / (1 - s.wb0); s.led.Eadded += solid * (P.cp_dry + s.M0 * CP_WATER) * Tin; rebalanceWater(s);
}
function pourWater(s, m, T_in) { // llena huecos de abajo hacia arriba; devuelve lo que no cupo
  let left = m;
  for (let i = 1; i < s.n && left > 1e-15; i++) { const room = s.cap[i] - s.mw[i]; if (room <= 0) continue; const q = Math.min(room, left); mixIn(s, i, q, T_in); left -= q; }
  const added = m - left; s.led.massIn += added; s.led.Eadded += added * CP_WATER * T_in; return left;
}
function rebalanceWater(s) { // gravedad: lo que sobra sube a la celda de arriba; los huecos de abajo se rellenan desde arriba
  for (let i = 1; i < s.n - 1; i++) { const ex = s.mw[i] - s.cap[i]; if (ex > 1e-15) moveWater(s, i, i + 1, ex); }
  for (let i = 1; i < s.n; i++) { let def = s.cap[i] - s.mw[i];
    for (let j = s.n - 1; j > i && def > 1e-15; j--) { if (s.mw[j] <= 1e-15) continue; const q = Math.min(def, s.mw[j]); moveWater(s, j, i, q); def -= q; } }
}
function removeVapor(s, i, m) { // m kg salen de la celda i como vapor; devuelve la energía latente que se llevan (referencia 0 K)
  const C = capC(s, i), T = s.T[i], Eout = m * (L_V_WATER + CP_WATER * T);
  s.T[i] = T - m * L_V_WATER / (C - m * CP_WATER); s.mw[i] -= m; return { Eout, Tpre: T };
}

function stepRice(s, dt, ctx) {
  const P = s.P, n = s.n, A = s.A, dz = s.dz;
  let top = 0; for (let i = n - 1; i >= 1; i--) if (s.r[i] > 0 || s.mw[i] > 1e-12) { top = i; break; }
  const na = top + 1; let grid = s.grids.get(na); if (!grid) { grid = makeGrid({ n: na, length_m: na * dz, measure: A }); s.grids.set(na, grid); }
  s.stir *= Math.exp(-dt / P.stir_tau_s); const mix = (1 + P.stir_gain * s.stir) * (1 + P.boil_mix * s.boilAct); // ASSUMPTION (D15/D26): la ebullición nucleada mezcla el líquido → k efectivo ×(1+boil_mix)
  const rc = new Float64Array(na), k = new Float64Array(na), Q = new Float64Array(na), T0 = s.T.subarray(0, na);
  for (let i = 0; i < na; i++) {
    rc[i] = Math.max(capC(s, i), 1e-6) / (A * dz);
    if (i === 0) k[i] = s.kPlate; else { const wet = s.mw[i] > 1e-9; k[i] = wet ? (s.r[i] > 0 ? P.k_wet_bed : P.k_wet_water) * mix : (s.r[i] > 0 ? P.k_dry : 0.03); }
    Q[i] = -s.h_conv * s.perim * (T0[i] - s.Tamb) / A;                       // pérdida lateral W/m³
    if (i === 0) Q[0] -= P.eps_vessel * SIGMA_SB * 2 * (T0[0] ** 4 - s.Tamb ** 4) / dz; // radiación del recipiente (A_rad≈2·A_base), evita T irreales en seco
  }
  const h = s.heat; let left = { type: 'neumann', flux: 0 };
  if (h.on) left = h.mode === 'temperature' ? { type: 'dirichlet', T: h.T_set_K } : { type: 'neumann', flux: h.power_W * h.intensity * P.efficiency / A };
  const res = stepHeat(grid, T0, { rho_cp_J_m3K: rc, k_W_mK: k }, { left, right: { type: 'robin', h: s.lid ? P.h_top_closed : P.h_top_open, Tinf: s.Tamb } }, dt, { scheme: 'implicit', Q });
  s.T.set(res.T); s.led.Ein += res.boundaryEnergy + res.sourceEnergy;

  // granos: absorción (Fick), gelatinización por capa, Maillard
  for (let i = 1; i <= top; i++) { const gr = s.grains[i]; if (!gr) continue;
    const wet = s.mw[i] > 1e-9, T = s.T[i];
    const r = stepGrain(gr.g, { T_K: T, wet, dt_s: dt, availableWater_kg: s.mw[i], nGrains: gr.nEff, params: s.gp });
    s.mw[i] = Math.max(0, s.mw[i] - Math.max(0, r.uptake_kg));
    for (let j = 0; j < P.nShells; j++) gr.alpha[j] = stepStarch(gr.alpha[j], T, gr.g.M[j], dt);
    const Mm = meanM(gr), aw = wet ? 1 : Mm / (Mm + P.aw_half), kM = kMaillard(T, aw, P.pH);
    gr.B = 1 - 1 / (1 / (1 - gr.B) + kM * dt);                               // dB/dt = k(1−B)² (S=AA=1−B), solución exacta
  }
  // evaporación superficial (solo sale lo que escapa de la tapa) y ebullición conservativa
  let topWet = 0; for (let i = top; i >= 1; i--) if (s.mw[i] > 1e-12) { topWet = i; break; }
  let esc = 0, gen = 0;
  if (topWet > 0) {
    const ev = surfaceEvaporation({ T_surface_K: s.T[topWet], T_ambient_K: s.Tamb, RH: P.RH, area_m2: A, h_m_m_s: P.h_m, lid: { closed: s.lid, leakFraction: P.leak } });
    const Ct = capC(s, topWet), dTe = Math.max(0, s.T[topWet] - s.Tamb);   // la evaporación no puede enfriar la celda bajo T_amb (evita vaciarla con NaN)
    const m = Math.min(ev.lost_kg_s * dt, s.mw[topWet], dTe * Ct / (L_V_WATER + CP_WATER * dTe)); if (m > 0) { const o = removeVapor(s, topWet, m); s.led.Evap += o.Eout; s.led.vaporLost += m; esc += m; }
  }
  for (let i = 1; i <= top; i++) { if (s.T[i] <= T_BOIL_K || s.mw[i] <= 0) continue;
    const C = capC(s, i), dT = s.T[i] - T_BOIL_K; let m = dT * C / (L_V_WATER + CP_WATER * dT); m = Math.min(m, s.mw[i]);
    const o = removeVapor(s, i, m); gen += m; esc += m; s.led.Evap += o.Eout; s.led.vaporLost += m;   // todo el vapor de ebullición sale: el calor que devolvería la tapa se re-evaporaría (presión no modelada)
    }
  s.boilAct += ((gen > 0 ? 1 : 0) - s.boilAct) * (1 - Math.exp(-dt / P.boil_tau_s));
  if (!s.flags.boil && gen > 0 && topWet > 0 && s.T[topWet] >= T_BOIL_K - 3) { s.flags.boil = true; ctx.emit('BOIL_START', { containerId: 'pot' }); }
  rebalanceWater(s);
  s.lastEvap_kg_s = esc / dt; s.lastGen_kg_s = gen / dt;
  // indicadores de quemado y eventos
  const bot = s.grains[1], dryBottom = s.mw[1] < 1e-6;
  if (bot && dryBottom && s.T[1] > CLASS_PARAMS.T_burn_K) s.burnHold_s += dt; else if (!dryBottom) s.burnHold_s = 0;
  const tot = s.mw.reduce((a, b) => a + b, 0);
  if (!s.flags.depleted && s.led.massIn > 0 && s.flags.hadWater && tot < 1e-6) { s.flags.depleted = true; ctx.emit('WATER_DEPLETED', { containerId: 'pot' }); }
  if (tot > 1e-4) s.flags.hadWater = true;
  if (!s.flags.sizzle && bot && dryBottom && s.T[1] > T_BOIL_K + 5) { s.flags.sizzle = true; ctx.emit('SIZZLE', { containerId: 'pot' }); }
  if (!s.flags.burn && bot && bot.B > 0.1) { s.flags.burn = true; ctx.emit('BURN_ONSET', { containerId: 'pot' }); }
  s.t += dt;
}
function meanM(gr) { const M = gr.g.M, g = gr.g.grid; let s = 0; for (let j = 0; j < M.length; j++) s += M[j] * g.V[j]; return s / g.V.reduce((a, b) => a + b, 0); }
function meanAlpha(gr) { const V = gr.g.grid.V; let s = 0; for (let j = 0; j < V.length; j++) s += gr.alpha[j] * V[j]; return s / V.reduce((a, b) => a + b, 0); }

/** Variables derivadas globales (medias ponderadas por masa de sólido). */
export function riceVars(s) {
  let r = 0, a = 0, M = 0, B = 0;
  for (let i = 1; i < s.n; i++) { const g = s.grains[i]; if (!g) continue; r += s.r[i]; a += s.r[i] * meanAlpha(g); M += s.r[i] * meanM(g); B += s.r[i] * g.B; }
  const alpha_mean = r ? a / r : 0, M_mean_db = r ? M / r : s.M0, B_mean = r ? B / r : 0, B_bottom = s.grains[1]?.B ?? 0;
  return { alpha_mean, M_mean_db, B_mean, B_bottom, burnHold_s: s.burnHold_s, hardness_N: hardness_N(alpha_mean, M_mean_db, B_mean), riceMass_kg: r };
}
function balances(s) {
  let mFree = 0, mAbs = 0, mSolid = 0, E = capC(s, 0) * s.T[0];
  for (let i = 1; i < s.n; i++) { mFree += s.mw[i]; mAbs += absorbed(s, i); mSolid += s.r[i]; E += capC(s, i) * s.T[i]; }
  const L = s.led, massErr = L.massIn > 0 ? Math.abs(mFree + mAbs + mSolid + L.vaporLost - L.massIn) / L.massIn : 0;
  const dE = E + L.Evap - L.E0 - L.Eadded - L.Ein, den = Math.max(Math.abs(L.Ein), Math.abs(E - L.E0), 1);
  return { massError_rel: massErr, energyError_rel: Math.abs(dE) / den };
}
function snapshotRice(s) {
  const v = riceVars(s), P = s.P, n = s.n;
  let mFree = 0, mAbs = 0, topWet = 0, tw = 0;
  for (let i = 1; i < n; i++) { mFree += s.mw[i]; mAbs += absorbed(s, i); if (s.mw[i] > 1e-12) { topWet = i; } }
  const nb = s.nBed, T_K = new Float32Array(n), freeWater = new Float32Array(n), M_db = new Float32Array(nb), alpha = new Float32Array(nb), B = new Float32Array(nb);
  for (let i = 0; i < n; i++) { T_K[i] = s.T[i]; freeWater[i] = s.mw[i]; }
  for (let i = 1; i <= nb; i++) { const g = s.grains[i]; M_db[i - 1] = g ? meanM(g) : 0; alpha[i - 1] = g ? meanAlpha(g) : 0; B[i - 1] = g ? g.B : 0; }
  const frac = topWet ? Math.min(1, (s.mw[topWet] / P.rho_w + s.r[topWet] / s.rhoDry) / (s.A * s.dz)) : 0;
  const level_m = topWet ? (topWet - 1) * s.dz + frac * s.dz : 0;
  let swT = 0, swM = 0; for (let i = 1; i < n; i++) if (s.mw[i] > 1e-12) { swT += s.mw[i] * s.T[i]; swM += s.mw[i]; }
  const Twater = swM > 0 ? swT / swM : s.T[0];   // T media del agua libre ponderada por masa (la celda superior parcial daba lecturas ruidosas)
  const swell = 1 + (v.M_mean_db - s.M0) * s.rhoDry / P.rho_w;               // V/V0 del grano
  const outcome = classifyRice(v);
  return { containers: [{ id: 'pot', T_wall_K: s.T[0], lid: s.lid, liquids: [{ kind: 'water', mass_kg: mFree, T_K: Twater, volume_m3: mFree / P.rho_w }], contents: nb ? ['rice'] : [] }],
    foods: [{ id: 'rice', grid: { nx: nb }, fields: { T_K: T_K.subarray(1), moisture_db: M_db, gelatinization: alpha, browning: B },
      scalars: { mass_kg: v.riceMass_kg / (1 - s.wb0) + mAbs - v.riceMass_kg * s.M0, hardness_N: v.hardness_N, stickiness: stickiness(v.alpha_mean, v.M_mean_db), doneness: doneness(v.alpha_mean, v.M_mean_db) }, outcome }],
    state: { ...v, bottomT_K: s.T[0], waterT_K: Twater, freeWater_kg: mFree, absorbedWater_kg: mAbs, vaporLost_kg: s.led.vaporLost, level_m, bedHeight_m: nb * s.dz,
      grainSwell_V: swell, evap_kg_s: s.lastEvap_kg_s, boilGen_kg_s: s.lastGen_kg_s, heat: { ...s.heat }, lid: s.lid, stir: s.stir, T_profile_K: T_K, freeWater_profile_kg: freeWater },
    outcome, events: undefined };
}
