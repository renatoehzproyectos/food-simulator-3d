// @ts-check
// Evaporación superficial, ebullición y tapa. REQ-EVAP-001.
import { R_GAS, L_V_WATER, T_BOIL_K } from '../core/units.js';
export const CP_WATER = 4180;        // J/(kg K) — spec 10.4 (verificar contra tablas)
export const M_WATER = 0.018015;     // kg/mol

/** Presión de saturación del agua (Pa). Ecuación de Antoine, constantes NIST (1–100 °C):
 *  log10(P/mmHg) = 8.07131 − 1730.63/(233.426 + T/°C). */
export function pSatWater_Pa(T_K) { const Tc = T_K - 273.15; return 133.322 * 10 ** (8.07131 - 1730.63 / (233.426 + Tc)); }
/** Densidad de vapor saturado (kg/m³), gas ideal. */
export const rhoVaporSat = (T_K) => pSatWater_Pa(T_K) * M_WATER / (R_GAS * T_K);

/**
 * Evaporación bajo ebullición: ṁ = h_m·A·(ρ_v,sat(T_s) − RH·ρ_v,sat(T_amb)). Con tapa cerrada solo escapa leakFraction;
 * el resto condensa y retorna al agua libre.
 * @returns {{evaporated_kg_s:number, lost_kg_s:number, returned_kg_s:number}}
 */
export function surfaceEvaporation({ T_surface_K, T_ambient_K, RH = 0.5, area_m2, h_m_m_s, lid = { closed: false, leakFraction: 1 } }) {
  const raw = h_m_m_s * area_m2 * (rhoVaporSat(T_surface_K) - RH * rhoVaporSat(T_ambient_K));
  const evaporated = Math.max(0, raw);
  const f = lid.closed ? lid.leakFraction : 1;
  return { evaporated_kg_s: evaporated, lost_kg_s: evaporated * f, returned_kg_s: evaporated * (1 - f) };
}

/**
 * Ebullición por balance de energía (formulación entálpica aplicada a posteriori, conservativa): el exceso de energía
 * sobre T_boil se convierte en vapor: m_v = m·cp·(T − T_b)/L_v; la celda queda en T_b con masa m − m_v.
 * Modifica T_K y m_kg in place. Devuelve el vapor total perdido (kg). Si todo el agua se evapora, T no se clampa (celda seca).
 */
export function boilExcess(T_K, m_kg, { cp = CP_WATER, Lv = L_V_WATER, Tb = T_BOIL_K } = {}) {
  let vapor = 0;
  for (let i = 0; i < T_K.length; i++) {
    if (T_K[i] <= Tb || m_kg[i] <= 0) continue;
    const mv = m_kg[i] * cp * (T_K[i] - Tb) / Lv;
    if (mv >= m_kg[i]) { vapor += m_kg[i]; m_kg[i] = 0; continue; }
    vapor += mv; m_kg[i] -= mv; T_K[i] = Tb;
  }
  return vapor;
}
