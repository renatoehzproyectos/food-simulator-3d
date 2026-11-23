# ASSETS — inventario VRChef (generado por `tools/inventory-assets.mjs`)
Detalle completo: `assets/metadata/inventory.json` (nombre, formato, tamaño, bbox, nº de materiales/texturas, función, categoría, SHA-256).

- 347 archivos, ~403 MB: 100 GLB + 100 FBX (mismos modelos), 115 texturas (57 PNG, 58 JPG), 30 audios (28 WAV, 2 MP3), 2 TXT informativos.
- Cargadores Three.js: GLB → `GLTFLoader`; texturas → `TextureLoader`; audio → `AudioLoader`. FBX no se usa.
- Duplicados por hash: 3 grupos de texturas (p. ej. `Aluminum_Scuffed_Metallic.png` = `water_reflection.png`); se deduplican en el manifest.
- Licencia: Apache 2.0, ver `LICENSE-VRChef` y `NOTICE`.
- Huecos: grano de arroz, vapor/burbujas, audio de verter/agitar. Se cubren con primitivas procedurales.
