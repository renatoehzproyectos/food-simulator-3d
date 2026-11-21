// @ts-check
// Conversores y constantes. Internamente todo es SI (REQ-UNIT-001).
export const R_GAS = 8.314462618;      // J/(mol K)
export const SIGMA_SB = 5.670374419e-8; // W/(m2 K4)
export const L_V_WATER = 2.257e6;      // J/kg a 1 atm
export const T_BOIL_K = 373.15;
export const C_to_K = (c) => c + 273.15;
export const K_to_C = (k) => k - 273.15;
export const g_to_kg = (g) => g / 1000;
export const kg_to_g = (kg) => kg * 1000;
export const min_to_s = (m) => m * 60;
export const L_to_m3 = (l) => l / 1000;
export const mL_to_m3 = (ml) => ml / 1e6;
export const mm_to_m = (mm) => mm / 1000;
/** humedad base húmeda -> base seca (kg agua / kg sólido seco) */
export const wb_to_db = (wb) => wb / (1 - wb);
export const db_to_wb = (db) => db / (1 + db);
