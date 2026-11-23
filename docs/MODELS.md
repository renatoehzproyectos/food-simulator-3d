# MODELS — ecuaciones, fuentes y límites
Leyenda: **fuente** = citada en este archivo; **ASSUMPTION** = sin fuente verificada (ver `ASSUMPTIONS.md`). Los datos experimentales de comparación están pendientes: `tests/reference-data/`.

## Calor (`physics/heat.js`, `fv1d.js`) — REQ-HEAT-001
ρcp·∂T/∂t = ∇·(k∇T) + Q, volúmenes finitos 1D (planar/cilíndrico/esférico), k variable (media armónica), esquema θ (explícito/CN/implícito).
Tests: erf semi-infinito, convergencia 2.º orden, estado estacionario con fuente, balance de energía <1e-9, estabilidad. Límite: coeficientes rezagados por paso.

## Humedad (`diffusion.js`, `moisture.js`) — REQ-MOIST-001
∂M/∂t = ∇·(D∇M), D = D₀exp(−Eₐ/RT), grano esférico, M_surf=M_eq en contacto con agua, flujo limitado por agua libre disponible (conservación exacta).
Fuente cualitativa de Eₐ de difusión: ≈25–33 kJ/mol (Bello et al. 2010, J Food Eng 97:95, 32.5 kJ/mol; Bello et al. LWT 40:313, 25.4–30.0 kJ/mol; tesis Khao Hang: 26.5 kJ/mol). **D₀ y M_eq: ASSUMPTION.**

## Evaporación y ebullición (`evaporation.js`) — REQ-EVAP-001
Antoine (NIST) para P_sat; ṁ = h_m·A·(ρ_v,sat − RH·ρ_v,sat,amb); tapa con leakFraction; ebullición conservativa m_v = m·cp·ΔT/L_v.

## Ebullición nucleada en el fondo (`physics/boiling.js`) — D32
Con el fondo sobre T_sat (sobretemperatura ΔT_e ≥ 4 K) el flujo fondo→agua lo limita la correlación de Rohsenow: q'' = μ_l h_fg [g(ρ_l−ρ_v)/σ]^½ [c_pl ΔT_e/(C_sf h_fg Pr_l)]³ (agua: s=1), con C_sf = 0.013 (agua sobre cobre liso, Rohsenow 1952 citado en Saiz Jabardo et al.), tope en el flujo crítico de Zuber (≈1.1 MW/m²). Para agua a 100 °C: q'' ≈ 138·ΔT_e³ W/m². Se aplica como resistencia de interfaz (ajuste de k de la celda del fondo, solo en modo potencia). Resultado: a 800 W en la olla (A=0.0266 m²) el fondo se estabiliza a ≈106 °C (ΔT_e≈6 K), igual que la inversa de la correlación (test).
**Límites:** propiedades de saturación de tabla estándar (Incropera A.6) sin re-verificar; C_sf de cobre usado para acero (ASSUMPTION); ebullición subenfriada (agua fría con fondo >100 °C) tratada como saturada (conservador); sin ebullición de transición/película; el mezclado del seno del líquido (`boil_mix`) sigue siendo un supuesto sin fuente.

## Gelatinización (`chemistry/starch.js`)
dα/dt = k(T)·f(M)·(1−α), 1.er orden irreversible (Ahromrit 2006, DOI 10.1016/j.jfoodeng.2006.03.003; revisión Processes 2023, 11, 1464).
Ea: 187 kJ/mol (<85 °C) y 99 kJ/mol (>85 °C) según la revisión Processes 2023. **La literatura es muy dispersa**: 32–42 kJ/mol (reología no isotérmica), 37.9 (Ahromrit, 20–70 °C), 76–108, 139 (masa de pan, Zanoni 1995), 289 (Bello, <60 °C). Se eligió la serie coherente con DSC (pico 74.2 °C, Food Hydrocolloids 2007). Consecuencia importante: sobre ~75 °C la reacción es rápida y la cocción queda **limitada por la difusión de agua** (coincide con Elbert, Suárez, Tolaba 2001, Drying Technol 19:571: límite por difusión sobre 77 °C).
k_ref = calibración (ver ASSUMPTIONS).

## Proteínas, Maillard, caramelización, oxidación
Formas cinéticas estándar (Arrhenius, 1.er orden, g(aw) en campana para Maillard); **parámetros ASSUMPTION**.

## Textura (`food/texture.js`)
hardness = g(M)·[H_gel + (H_raw−H_gel)(1−α)^p] + H_burn·B^q. Extiende la forma sugerida con el piso H_gel. Monótona (property tests). Parámetros ASSUMPTION.

## Arroz (`food/rice.js`) — REQ-RICE-001 (Fase 8)
Olla = columna 1D vertical (celda 0 = fondo de acero con inercia y pérdida por radiación; celdas 1..n = lecho/agua, Δz=2.5 mm). Cada celda con arroz lleva un grano esférico equivalente (radio R=3V/A del elipsoide, Knud-Thomsen) resuelto con Fick radial (8 capas), α por capa (almidón) y B (Maillard, dB/dt=k(1−B)², solución exacta). El agua cae por gravedad; evaporación superficial (hasta T_amb) y ebullición conservativa; k efectivo alto con agua líquida (mezcla/burbujeo) y bajo en seco: de ahí emerge el quemado. Bajo ebullición, k efectivo se multiplica por (1+`boil_mix`) con relajación τ=5 s (D26, **ASSUMPTION** sin fuente: hace el agua casi isoterma a ~100 °C; conserva energía porque solo cambia k).
Balances: masa (agua libre + absorbida + vapor perdido + sólidos) ≤1e-9 y energía ≤1e-6 (medidos ~1e-13 / 1e-13) en toda la evolución.
**Clasificador** (`food/classifier.js`): quemado > duro > sobrecocido/blando > cocido, por umbrales parametrizados (D20).
**Escenarios:** S1 quemado, S2 cocido, S3 blando, S4 quemado, S5 duro. Márgenes ajustados en S3 (dureza 5.8 N vs umbral 6 N) y en M de S2 (1.59 en [1.2, 2.3]).
**Límites conocidos:** temperaturas con olla seca sin tope realista (solo radiación y h_conv: llegan a cientos de °C); lecho sin expansión (el hinchamiento solo se refleja en visuales), sin presión, sin lixiviación de amilosa, sin pérdida de humedad del grano en seco.

## Capa 3D (Fases 9–12)
`output/adapter.js` (mapeos puros snapshot→visual), `engine3d/` (escena, asset-manager con caché/refcount/respaldo, granos instanciados, líquido con burbujas/vapor, vista térmica por DataTexture, interacción por Pointer Events que SOLO emite comandos, audio por eventos). Assets VRChef: ver NOTICE y D24.

## Rendimiento (Fase 13)
Worker + `Session.advanceFor` (ver `ARCHITECTURE.md`). Medido en un Android (Chrome), 60× : coste de tick 0.1–3.1 ms, 60 fps. Memoria: columna de ~60 celdas × 8 capas de grano por celda con arroz, Float64Array; snapshots de ~KB. **No medido** a 600× ni en gama baja.

## Cómo se valida (resumen)
Analíticos: erf semi-infinito, estacionario con fuente, convergencia 2.º orden, Antoine contra 101.3 kPa a 100 °C, Kissinger para pico DSC. Invariantes: balance de masa <1e-9 y energía <1e-6 en toda la evolución, monotonías (α, dureza), determinismo por semilla. Escenarios: S1–S5. Faltan comparaciones con datos publicados (todo en `reference-data`).
