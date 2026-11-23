// Comprobación de tipos de la API pública: `npm run typecheck` (no se ejecuta).
import { createFoodSimulator, registerMaterial, SCENARIOS, type Snapshot, type SimulationResult } from '../src/index.js';
const sim = createFoodSimulator();
registerMaterial('copper', { rho: 8960, cp: 385, k: 400 });
const s = sim.createSession(SCENARIOS.S2.input);
s.command({ type: 'SET_LID', closed: false });
s.on('event', (e) => console.log(e.type, e.t_s));
s.advanceSim(60);
const snap: Snapshot = s.snapshot();
const label: string = snap.outcome.label;
const r: Promise<SimulationResult> = sim.simulate(SCENARIOS.S2.input);
void label; void r;
