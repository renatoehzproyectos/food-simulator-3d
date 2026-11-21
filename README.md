# Food Simulator 3D
Simulador científico de cocina. Estado: **Fases 0–7** (… + química del almidón y otras reacciones, y textura).

## Uso
```bash
npm install
npm test        # 75 tests (capas, unidades, validación, ODE, matrices, sesión, calor, difusión, evaporación, química, textura)
npm run dev     # página de prueba del motor
npm run build   # → dist/ (Vercel: framework Vite, ya configurado en vercel.json)
```
## Desplegar en Vercel
Sube la carpeta a un repo de GitHub e impórtala en Vercel (detecta Vite). No hace falta configurar nada.

## Estructura
`src/core` (unidades, validación, PRNG, simulador) · `src/numerical` (ODE, matrices) · `src/physics` (calor, Fick, evaporación) · `src/chemistry` · `src/food` (textura) · `vendor/ode` (MIT) · `docs/` (decisiones, dependencias, assets) · `tests/`.
Los assets de VRChef (Apache 2.0) se añaden en la Fase 12; ver `NOTICE` y `LICENSES.md`.
