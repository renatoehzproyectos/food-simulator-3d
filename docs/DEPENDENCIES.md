# DEPENDENCIES — Fase 0 (inspección de repos)

| Repo | Versión | Licencia | Formato | Deps. runtime | Veredicto |
|---|---|---|---|---|---|
| tangent-to/ode (`@tangent.to/ode`) | 0.1.3 | MIT | ESM puro, navegador+Node | ninguna | **ADOPTAR** |
| 2D-Heat-Equation-Solver | — | MIT | 1 HTML (`diffusion.html`) | — | **REFERENCIA** |
| numjs | 0.0.0 (2015) | MIT | UMD (`num.js`), global | — | **DESCARTAR** (por defecto) |
| FEAScript-core | 0.4.1 | MIT | ESM/UMD/worker | mathjs, delaunator, @stdlib/blas-*, robust-predicates, constrainautor | **REFERENCIA / opcional fase avanzada** |
| Food-Chemistry-Digital-Lab | 1.0.0 | **UNLICENSED** | app web + GLB | — | **REFERENCIA solo lectura** (no copiar código ni assets) |

## ode (adoptar)
- Funciones disponibles (`src/index.js`): `solve`, `rk45`, `rosenbrock`, `euler`, `rk2`, `rk4`. ~950 líneas en total.
- Su descripción declara **dense output y detección de eventos** (RK45 y Rosenbrock mencionan "event"). Pendiente en Fase 3: confirmar la API exacta de eventos con un test; si falla, bisección propia en `numerical/ode.js` (REQ-NUM-001).
- Método de líneas: no es una función propia; se arma discretizando y pasando `f(t,y)` al integrador.
- Ojo: `main` apunta a `./dist/index.js`, que se genera con `npm run build:browser` (script `prepare`). Fijar versión y vendorizar `src/` si el build falla.

## 2D-Heat-Equation-Solver (referencia)
Demo HTML, no librería. Se reimplementa en `physics/heat.js` (volúmenes finitos, forma conservativa, axisimétrico) con tests analíticos.

## numjs (descartar)
Librería UMD de 2015 sin mantenimiento. Se usarán `Float64Array` propios + Thomas/Gauss-Seidel (<150 líneas, regla anti-sobreingeniería).

## FEAScript-core (opcional)
Cadena de dependencias pesada (mathjs, stdlib) para móvil. No entra al bundle base. Reevaluar solo si hace falta geometría 3D irregular (cuestión abierta nº 3: por defecto basta axisimétrico 2D + 1D intragrano).

## Food-Chemistry-Digital-Lab (referencia)
`"license": "UNLICENSED"` y sin archivo LICENSE: todos los derechos reservados. Se puede leer para orientarse (fórmulas, bibliografía) y reimplementar ideas propias citando la fuente científica original, **no** el repo. No usar sus GLB/código/datos.
