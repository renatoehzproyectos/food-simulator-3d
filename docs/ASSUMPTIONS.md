# ASSUMPTIONS (parámetros sin fuente verificada)
Se resuelven en Fases 6–8 con búsqueda bibliográfica; hasta entonces están marcados `ASSUMPTION` en el código.

| Parámetro | Valor | Dónde | Motivo / rango de la spec |
|---|---|---|---|
| D₀, Eₐ difusividad de humedad en grano | 8.7e-7 m²/s, 26 kJ/mol → D(100 °C)=2e-10 m²/s | `physics/moisture.js` | Spec 10.4: 1e-11–1e-9 m²/s, creciente con T. **Pendiente de calibrar**: con estos valores R²/D ≈ 2 h para R=1.2 mm, quizá lento frente a una cocción real |
| M de saturación del grano | 1.8 kg/kg b.s. (constante) | `physics/moisture.js` | Spec: 1.5–2.5, verificar; en realidad depende de T |
| ρ sólido seco del grano | 1450 kg/m³ | `physics/moisture.js` | Spec: grano 1400–1500 |
| cp del agua | 4180 J/kgK | `physics/evaporation.js` | Spec 10.4 (valor de tabla estándar) |
| h_m (transferencia de masa superficial) | lo fija quien llama | `surfaceEvaporation` | Sin valor por defecto a propósito |
| k efectivo del agua en el test de ebullición | 20 W/mK | `tests/moisture.test.js` | Solo para el test (mezcla convectiva) |
Fuente verificada: Antoine del agua (constantes NIST, 1–100 °C), validado en test contra 101.3 kPa a 100 °C.

## Fases 6–7
| Parámetro | Valor | Dónde | Estado |
|---|---|---|---|
| k_ref gelatinización | 0.03 1/s a 74.2 °C | `chemistry/starch.js` | **Calibración**: reproduce pico DSC ≈74 °C a 10 K/min (Kissinger). Ea y T_break sí tienen fuente (ver MODELS.md) |
| f(M) del almidón | rampa M0=0.25 → M1=0.8 kg/kg b.s. | `starch.js` | Forma cualitativa; valores sin verificar |
| Proteínas: k_ref, Ea=300 kJ/mol, pH_slope | 1e-3 1/s a 75 °C, … | `proteins.js` | Placeholders de orden de magnitud |
| Maillard: k_ref, Ea=110 kJ/mol, ancho de g(aw)=0.2, órdenes 1 | … | `maillard.js` | ASSUMPTION; solo el máximo de g(aw) a ≈0.6–0.7 es conocimiento clásico |
| Caramelización: k(160 °C)=1e-3 1/s, Ea=200 kJ/mol | … | `caramelization.js` | ASSUMPTION; umbral ~160 °C de la spec |
| Oxidación: k_ref, Ea=60 kJ/mol, m=1 | … | `oxidation.js` | ASSUMPTION |
| Textura: H_raw=100 N, H_gel=20 N, p=2, λ=0.6, H_burn=40 N, ventana M 0.5–1.2 | … | `food/texture.js` | ASSUMPTION; calibrar con texturometría (Fase 14) |

## Fases 8–12
| Parámetro | Valor | Dónde | Estado |
|---|---|---|---|
| Difusividad D(T) | D₀=3.4e-7, Eₐ=26 kJ/mol → 7.8e-11 m²/s a 100 °C | `physics/moisture.js` | **Calibrado** a ~14 min de cocción a 100 °C (criterio tiempo típico 12–18 min); Eₐ cercana a 25–33 kJ/mol de Bello et al. |
| M_eq(T) | 0.45 (20 °C) → 2.5 (100 °C), lineal | `physics/moisture.js` | ASSUMPTION |
| Umbrales del clasificador | ver D20 | `food/classifier.js` | ASSUMPTION fijado a priori |
| k_eff del lecho/agua con mezcla | 5 / 20 W/mK (×(1+STIR)); 0.2 seco | `food/rice.js` | ASSUMPTION (convección/burbujeo); k seco en rango 0.1–0.6 de la spec |
| Eficiencia placa→olla, h_conv, ε recipiente | 0.8, 10 W/m²K, 0.3 | `food/rice.js` | ASSUMPTION |
| h_m, RH, fuga de tapa | 0.005 m/s, 0.5, 0.1 | `food/rice.js` | ASSUMPTION |
| Dimensiones de grano por tipo | ver RICE_TYPES | `food/rice.js` | ASSUMPTION (típicas) |
| aw(M)=M/(M+0.08) | — | `food/rice.js` | ASSUMPTION (aw≈0.63 a 12 % b.h.) |
| Mapeos visuales (burbujas/vapor/brillo) | ver adapter | `output/adapter.js` | Visuales, no físicos |

- `boil_mix = 40`, `boil_tau_s = 5` (RICE_PARAMS): factor de mejora de k efectivo por mezcla de ebullición nucleada. Sin fuente; orden de magnitud para que el agua en ebullición sea casi isoterma. Calibrado cualitativamente (agua ≈ 99 °C durante la ebullición). Verificar con literatura de transferencia de calor en ebullición.
