# Food Simulator 3D — Arroz
Simulador de cocina con física real (calor, difusión de agua, gelatinización, evaporación, quemado) y escena 3D jugable. El **núcleo es headless** (sin DOM ni Three.js); la capa 3D solo lee snapshots y emite comandos.

## Jugar / desplegar
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 157 tests (+5 pendientes de datos de referencia)
npm run build      # dist/  → Vercel lo detecta como Vite (vercel.json incluido)
npm run example    # simulación batch en consola (S2: cocido)
npm run typecheck  # comprueba src/index.d.ts con examples/types-check.ts
```
**Controles:** arrastra el frasco (arroz) o la botella (agua) sobre la olla para verter; arrastra la olla al quemador; barra de calor; cuchara = agitar. Botones equivalentes para tocar.
Teclado: R +100 g arroz · W +100 mL agua · F fuego · ↑/↓ potencia · L tapa · S agitar · T vista térmica · Espacio pausa · 1–4 velocidad · H ayuda.
Referencia: 200 g de arroz + 300 g de agua ≈ 14 min a 100 °C. Tras hervir **baja el fuego (300–600 W)** o se seca y se quema.

## Usar el motor como librería
```js
import { createFoodSimulator, SCENARIOS } from './src/index.js';
const sim = createFoodSimulator();
const r = await sim.simulate(SCENARIOS.S2.input);          // batch → r.final.outcome.label === 'cocido'
const s = sim.createSession(input);                        // incremental
s.command({ type: 'PLACE_ON_HEAT', power_W: 1000 });       // la interacción solo emite comandos
s.advanceSim(60); s.snapshot();                            // estado inmutable para la capa visual
```
Tipos: `src/index.d.ts`. Ejemplos: `examples/`. Extensión: `registerMaterial(name, {rho, cp, k})`.
Unidades: SI internamente (K, kg, m, s, W); las entradas llevan sufijo (`mass_g`, `T_C`, `duration_s`). Errores de entrada: `ValidationError` con `code`, `path`, `message`, `hint`.

## Estado
Fases 0–14 implementadas. Motor validado con S1–S5, balances de masa y energía ≈1e-13. Render y Worker probados en un Android real (Chrome) a 60 fps / 60×; **sin probar**: 600×, iOS, gama baja. Datos experimentales de referencia pendientes (`tests/reference-data/`). Parámetros sin fuente: `docs/ASSUMPTIONS.md`. Decisiones: `docs/DECISIONS.md`. Arquitectura: `docs/ARCHITECTURE.md`. Ecuaciones y límites: `docs/MODELS.md`.

## Licencias
Ver `LICENSES.md`, `NOTICE` y `LICENSE-VRChef` (Apache 2.0, copia íntegra del repositorio original). El proyecto en sí no declara licencia propia todavía.
