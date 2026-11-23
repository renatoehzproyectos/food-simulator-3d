# ARQUITECTURA

```
main.js (UI) ─ createSimClient ─┬─ Web Worker: worker-core → Session (núcleo)    [preferido]
      │                          └─ hilo principal: Session                       [respaldo]
      ├─ output/adapter.js   mapeos puros snapshot → visual (sin DOM)
      └─ engine3d/           Three.js: scene, asset-manager, food-visuals, liquid-system,
                             thermal-visualization, interaction (SOLO emite comandos), audio
Núcleo (sin DOM/Three):  core → numerical → physics → chemistry → food(rice) 
```
**Capas y reglas** (comprobadas por `tests/layers.test.js`): el núcleo no importa `engine3d` ni globals del navegador; `engine3d` no calcula física, solo lee `snapshot()`; la interacción emite `command()` y el núcleo decide el efecto.

## Flujo de datos
1. La UI llama `client.advance(dt·timeScale)` cada frame; el cliente acumula y envía **un** `tick` al Worker cuando está libre.
2. El Worker ejecuta `Session.advanceFor(dt, 10 ms)`: pasos fijos (`timeStep_s`, por defecto 0.5 s) hasta agotar el tiempo o el presupuesto; deuda > 30 s se descarta.
3. El Worker devuelve `snapshot` (typed arrays transferidos) + eventos acumulados; la UI usa el último.
Determinismo: PRNG con semilla; mismos inputs y `dt` → mismo resultado (testeado, incluido `advanceFor` vs `advanceSim`).

## Núcleo por módulos
- `numerical/` ODE (vendor `@tangent.to/ode`) y matrices tridiagonales.
- `physics/` calor FV 1D (`heat`, `fv1d`), difusión/humedad de grano, evaporación/ebullición conservativa y ebullición nucleada de pared (`boiling`: Rohsenow+Zuber).
- `chemistry/` cinéticas: almidón, Maillard, caramelización, proteínas, oxidación, pH.
- `food/rice.js` olla = columna 1D (fondo de acero + lecho/agua) con grano esférico equivalente por celda; `classifier.js` etiqueta; `texture.js` dureza; `scenarios.js` S1–S5.
- `core/simulator.js` registro de alimentos, validación, `simulate()` (batch) y `Session` (incremental).

## Extensión (REQ-EXT-001)
- `FoodSimulator.registerFood(def)`: nuevo alimento con `init/step/snapshot/command/invariants`.
- `registerMaterial(name, {rho,cp,k})`: materiales de recipiente.
- **No implementados** (sin consumidor real hoy, ver D30): `registerReaction`, `registerLiquid`. Las reacciones existen como `defineReaction`/`integrateReactions` en `chemistry/reactions.js`.

## Desviaciones conocidas respecto a la spec
- El resultado de `simulate()` es `{meta, validation, initial, timeline, final, events}` (ver `index.d.ts`), no el esquema completo con arrays por campo de la spec.
- Un solo alimento (arroz) y un solo recipiente; olla 1D (sin geometría 3D irregular, FEAScript no se adoptó).
- Sin accesibilidad completa (teclado sí; lector de pantalla y contraste no auditados).
