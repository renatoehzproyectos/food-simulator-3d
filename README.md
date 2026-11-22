# Food Simulator 3D — Arroz
Simulador de cocina con física real (calor, difusión de agua, gelatinización, evaporación, quemado) y escena 3D jugable.

## Jugar / desplegar
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 148 tests
npm run build    # dist/  → Vercel lo detecta como Vite (vercel.json incluido)
```
**Controles:** arrastra el frasco (arroz) o la botella (agua) sobre la olla para verter; arrastra la olla al quemador; barra de calor; cuchara = agitar. Botones equivalentes para tocar.
Teclado: R +100 g arroz · W +100 mL agua · F fuego · ↑/↓ potencia · L tapa · S agitar · T vista térmica · Espacio pausa · 1–4 velocidad · H ayuda.
Referencia: 200 g de arroz + 300 g de agua ≈ 14 min a 100 °C. Tras hervir **baja el fuego (300–600 W)** o se seca y se quema.

## Estado por fases
0–8 motor headless completo y validado (S1–S5) · 9–11 escena, visuales e interacción · 12 assets VRChef integrados.
13: Worker implementado (sin medir en móvil); pendiente 14 (documentación completa). **El render no pudo verificarse visualmente en el entorno de desarrollo** (ver docs/DECISIONS.md D23).

## Estructura
`src/core` · `src/numerical` · `src/physics` · `src/chemistry` · `src/food` · `src/output` (adapter) · `src/engine3d` · `vendor/ode` · `public/assets` · `docs/` · `tests/`.
Licencias: ver `LICENSES.md`, `NOTICE` y `LICENSE-VRChef` (**completar con el texto Apache 2.0 antes de publicar**).
