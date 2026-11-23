// Modo batch: simula el escenario S2 (200 g de arroz, 300 g de agua, placa a 100 °C, 18 min, con tapa).
// Ejecutar: npm run example
import { createFoodSimulator, SCENARIOS } from '../src/index.js';

const sim = createFoodSimulator();
const result = await sim.simulate(SCENARIOS.S2.input);
const { label, score, reasons } = result.final.outcome;
console.log(`Resultado: ${label} (score ${score.toFixed(2)})`);
console.log(`Motivos:   ${reasons.join(' · ')}`);
console.log(`Eventos:   ${result.events.map((e) => `${e.type}@${(e.t_s / 60).toFixed(1)}min`).join(', ') || '—'}`);
const b = result.final.balances;
console.log(`Balances:  masa ${b.massError_rel.toExponential(1)}, energía ${b.energyError_rel.toExponential(1)}`);
