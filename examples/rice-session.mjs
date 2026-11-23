// Modo incremental: la interacción solo emite comandos; el núcleo decide el efecto físico.
// 200 g de arroz + 400 g de agua a 1000 W, sin tapa, durante 40 min simulados.
import { createFoodSimulator, registerMaterial } from '../src/index.js';

registerMaterial('copper', { rho: 8960, cp: 385, k: 400 });      // REQ-EXT-001: material nuevo sin tocar el núcleo
const session = createFoodSimulator().createSession(
  { food: 'rice', vessel: { material: 'copper', base_area_m2: 0.0266, height_m: 0.14, mass_kg: 0.8, lid: { closed: false } },
    environment: { T_ambient_C: 20, duration_s: 86400 }, simulation: { timeStep_s: 0.5, seed: 1 } }, { skipValidation: true });
session.on('event', (e) => console.log(`  evento ${e.type} a los ${(e.t_s / 60).toFixed(1)} min`));
session.command({ type: 'ADD_INGREDIENT', ingredient: 'rice', mass_kg: 0.2 });
session.command({ type: 'POUR_LIQUID', liquid: 'water', mass_kg: 0.4 });
session.command({ type: 'PLACE_ON_HEAT', power_W: 1000 });
for (let min = 10; min <= 40; min += 10) {
  session.advanceSim(600); const s = session.snapshot().state;
  console.log(`${min} min · fondo ${(s.bottomT_K - 273.15).toFixed(0)} °C · libre ${(s.freeWater_kg * 1000).toFixed(0)} g · α ${s.alpha_mean.toFixed(2)} · ${session.snapshot().outcome.label}`);
}
