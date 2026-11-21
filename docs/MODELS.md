# MODELS — ecuaciones, fuentes y límites (se completa en Fase 14)

## Calor (`physics/heat.js`, `fv1d.js`) — REQ-HEAT-001
ρcp·∂T/∂t = ∇·(k∇T) + Q, volúmenes finitos 1D (planar/cilíndrico/esférico), k variable (media armónica), esquema θ (explícito/CN/implícito).
Tests: erf semi-infinito, convergencia 2.º orden, estado estacionario con fuente, balance de energía <1e-9, estabilidad. Límite: coeficientes rezagados por paso.

## Humedad (`diffusion.js`, `moisture.js`) — REQ-MOIST-001
∂M/∂t = ∇·(D∇M), D = D₀exp(−Eₐ/RT), grano esférico, M_surf=M_eq en contacto con agua, flujo limitado por agua libre disponible (conservación exacta).
Fuente cualitativa de Eₐ de difusión: ≈25–33 kJ/mol (Bello et al. 2010, J Food Eng 97:95, 32.5 kJ/mol; Bello et al. LWT 40:313, 25.4–30.0 kJ/mol; tesis Khao Hang: 26.5 kJ/mol). **D₀ y M_eq: ASSUMPTION.**

## Evaporación y ebullición (`evaporation.js`) — REQ-EVAP-001
Antoine (NIST) para P_sat; ṁ = h_m·A·(ρ_v,sat − RH·ρ_v,sat,amb); tapa con leakFraction; ebullición conservativa m_v = m·cp·ΔT/L_v.

## Gelatinización (`chemistry/starch.js`)
dα/dt = k(T)·f(M)·(1−α), 1.er orden irreversible (Ahromrit 2006, DOI 10.1016/j.jfoodeng.2006.03.003; revisión Processes 2023, 11, 1464).
Ea: 187 kJ/mol (<85 °C) y 99 kJ/mol (>85 °C) según la revisión Processes 2023. **La literatura es muy dispersa**: 32–42 kJ/mol (reología no isotérmica), 37.9 (Ahromrit, 20–70 °C), 76–108, 139 (masa de pan, Zanoni 1995), 289 (Bello, <60 °C). Se eligió la serie coherente con DSC (pico 74.2 °C, Food Hydrocolloids 2007). Consecuencia importante: sobre ~75 °C la reacción es rápida y la cocción queda **limitada por la difusión de agua** (coincide con Elbert, Suárez, Tolaba 2001, Drying Technol 19:571: límite por difusión sobre 77 °C).
k_ref = calibración (ver ASSUMPTIONS).

## Proteínas, Maillard, caramelización, oxidación
Formas cinéticas estándar (Arrhenius, 1.er orden, g(aw) en campana para Maillard); **parámetros ASSUMPTION**.

## Textura (`food/texture.js`)
hardness = g(M)·[H_gel + (H_raw−H_gel)(1−α)^p] + H_burn·B^q. Extiende la forma sugerida con el piso H_gel. Monótona (property tests). Parámetros ASSUMPTION.
