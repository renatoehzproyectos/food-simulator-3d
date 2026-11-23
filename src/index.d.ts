// Tipos de la API pública (REQ-API-001). Escritos a mano a partir de src/core/simulator.js y src/food/rice.js.
// Unidades SI internamente (K, kg, m, s, W); las entradas llevan el sufijo de unidad en el nombre.

export const ENGINE_VERSION: string;

export interface Issue { code: string; path: string; message: string; hint: string }
export class ValidationError extends Error { errors: Issue[] }
export function validateSimulationInput(input: unknown): { ok: boolean; errors: Issue[]; warnings: Issue[] };

export type RiceType = 'long_grain' | 'medium_grain' | 'short_grain' | 'basmati' | 'jasmine';
export type OutcomeLabel = 'duro' | 'cocido' | 'blando' | 'sobrecocido' | 'quemado';

export interface SimulationInput {
  food: 'rice' | (string & {});
  riceType?: RiceType;
  ingredients?: { rice?: { mass_g: number }; water?: { mass_g: number; T_C?: number } };
  grain?: { length_mm?: number; width_mm?: number; thickness_mm?: number; thickness_factor?: number; initialMoisture_wb?: number };
  vessel?: { material?: string; mass_kg?: number; base_area_m2?: number; height_m?: number; lid?: { closed?: boolean } };
  heating?: { mode: 'power'; power_W: number; intensity?: number } | { mode: 'temperature'; cookingTemperature_C: number };
  environment?: { T_ambient_C?: number; initialTemperature_C?: number; cookingTemperature_C?: number; h_conv_W_m2K?: number; duration_s?: number };
  simulation?: { timeStep_s?: number; seed?: number };
  /** Sobrescribe parámetros de RICE_PARAMS (avanzado). */
  params?: Partial<RiceParams>;
}

export interface RiceParams { rho_grain: number; rho_bulk: number; cp_dry: number; rho_w: number; k_dry: number; k_wet_bed: number; k_wet_water: number; boil_mix: number; boil_tau_s: number; rohsenow: boolean; roh_Csf: number; stir_gain: number; stir_tau_s: number; eps_vessel: number; h_top_closed: number; h_top_open: number; efficiency: number; h_m: number; leak: number; dz: number; height_m: number; nShells: number; aw_half: number; RH: number; pH: number }
export const RICE_PARAMS: RiceParams;
export const RICE_TYPES: Record<RiceType, { L: number; W: number }>;
export const MATERIALS: Record<string, { rho: number; cp: number; k: number }>;
/** Registra un material de recipiente (REQ-EXT-001). Lanza ValidationError si los valores no son > 0. */
export function registerMaterial(name: string, def: { rho: number; cp: number; k: number }): { rho: number; cp: number; k: number };

export interface Outcome { label: OutcomeLabel; confidence: number; score: number; reasons: string[] }

export type Command =
  | { type: 'ADD_INGREDIENT'; containerId?: string; ingredient: 'rice'; mass_kg: number }
  | { type: 'POUR_LIQUID'; fromId?: string; toId?: string; liquid?: 'water'; mass_kg?: number; volume_m3?: number; T_C?: number }
  | { type: 'PLACE_ON_HEAT'; containerId?: string; sourceId?: string; power_W?: number }
  | { type: 'SET_HEAT'; sourceId?: string; power_W: number }
  | { type: 'REMOVE_FROM_HEAT' }
  | { type: 'SET_LID'; closed: boolean }
  | { type: 'STIR'; containerId?: string; intensity?: number };

export interface SimEvent { type: 'BOIL_START' | 'WATER_DEPLETED' | 'SIZZLE' | 'BURN_ONSET' | 'OVERFLOW' | 'WARN' | (string & {}); t_s: number; [k: string]: unknown }

export interface RiceState {
  alpha_mean: number; M_mean_db: number; B_mean: number; B_bottom: number; burnHold_s: number; hardness_N: number; riceMass_kg: number;
  bottomT_K: number; waterT_K: number; freeWater_kg: number; absorbedWater_kg: number; vaporLost_kg: number; level_m: number; bedHeight_m: number;
  grainSwell_V: number; evap_kg_s: number; boilGen_kg_s: number; heat: { on: boolean; mode: 'power' | 'temperature'; power_W: number; intensity: number; T_set_K: number };
  lid: boolean; stir: number; T_profile_K: Float32Array; freeWater_profile_kg: Float32Array;
}

export interface Snapshot {
  readonly t_s: number; readonly step: number;
  containers: { id: string; T_wall_K: number; lid: boolean; liquids: { kind: string; mass_kg: number; T_K: number; volume_m3: number }[]; contents: string[] }[];
  foods: { id: string; grid: { nx: number }; fields: { T_K: Float32Array; moisture_db: Float32Array; gelatinization: Float32Array; browning: Float32Array };
           scalars: { mass_kg: number; hardness_N: number; stickiness: number; doneness: number }; outcome: Outcome }[];
  state: RiceState; outcome: Outcome;
  balances: { massError_rel: number; energyError_rel: number };
}

export interface Session {
  readonly t_s: number; readonly step: number; readonly dt_s: number; readonly events: SimEvent[];
  on(type: 'event' | SimEvent['type'], fn: (e: SimEvent) => void): this;
  /** Encola un comando; el núcleo decide el efecto físico. */
  command(cmd: Command): void;
  /** Desde el render: acumula dt·timeScale y da hasta 2000 pasos fijos. */
  advance(simDt_s: number): number;
  /** Como advance, pero con presupuesto de CPU (Worker). Descarta solo deuda > maxBacklog_s. */
  advanceFor(simDt_s: number, budget_ms: number, opts?: { maxBacklog_s?: number; now?: () => number }): number;
  /** Avanza exactamente dur_s. */
  advanceSim(dur_s: number): void;
  snapshot(): Snapshot;
}

export interface SimulationResult {
  meta: { engineVersion: string; models: Record<string, string>; dt_s: number; seed: number };
  validation: { ok: boolean; errors: Issue[]; warnings: Issue[] };
  initial: Snapshot; timeline: Snapshot[]; final: Snapshot; events: SimEvent[];
}

export interface FoodDefinition { name: string; version: string; init(input: any, rng?: () => number): any; step(state: any, dt: number, ctx: any): void; snapshot(state: any): any; command?(state: any, cmd: any, ctx: any): void; invariants?(state: any): { massError_rel: number; energyError_rel: number } }

export class FoodSimulator {
  registerFood(def: FoodDefinition): this;
  createSession(input: SimulationInput, opts?: { skipValidation?: boolean }): Session;
  /** Modo batch. Lanza ValidationError si la entrada es inválida. */
  simulate(input: SimulationInput, opts?: { sampleEvery_s?: number }): Promise<SimulationResult>;
}
export function createFoodSimulator(): FoodSimulator;

export const riceFood: FoodDefinition;
export function classifyRice(v: { alpha_mean: number; M_mean_db: number; B_bottom: number; B_mean: number; burnHold_s: number; hardness_N: number }, params?: typeof CLASS_PARAMS): Outcome;
export const CLASS_PARAMS: { alpha_min: number; M_min: number; M_max: number; H_min: number; B_burn: number; T_burn_K: number; burn_hold_s: number };
export const SCENARIOS: Record<'S1' | 'S2' | 'S3' | 'S4' | 'S5', { expected: OutcomeLabel[]; input: SimulationInput }>;

/** Cliente para la UI: Worker si existe, hilo principal si no. */
export function createSimClient(input: SimulationInput, opts?: { useWorker?: boolean; skipValidation?: boolean; maxPending_s?: number; onError?: (...a: unknown[]) => void }): {
  readonly mode: 'worker' | 'main'; stats: { steps: number; ms: number; mode: string }; ready(): boolean;
  command(cmd: Command): void; advance(simDt_s: number): void; snapshot(): Snapshot | null; on(fn: (e: SimEvent) => void): void; dispose(): void;
};
