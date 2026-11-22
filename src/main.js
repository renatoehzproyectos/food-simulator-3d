import * as THREE from 'three';
import { createSimClient } from './worker/sim-client.js';
import { buildWorld, createRenderer, createControls, DynamicResolution, potView, POT_AREA_M2 } from './engine3d/scene.js';
import { AssetManager } from './engine3d/asset-manager.js';
import { AudioManager } from './engine3d/audio.js';
import { RiceVisual } from './engine3d/food-visuals.js';
import { LiquidSystem } from './engine3d/liquid-system.js';
import { ThermalView } from './engine3d/thermal-visualization.js';
import { Interaction } from './engine3d/interaction.js';
import { nextHeat } from './engine3d/interaction-logic.js';
import { burnerGlow, OUTCOME_ES } from './output/adapter.js';

const $ = (id) => document.getElementById(id);
const BURNER = { x: 0, z: -0.05 };
const mobile = matchMedia('(pointer:coarse)').matches;
const SESSION_INPUT = { food: 'rice', riceType: 'long_grain', vessel: { material: 'steel', base_area_m2: POT_AREA_M2, height_m: 0.14, mass_kg: 0.6, lid: { closed: true } },
  environment: { T_ambient_C: 20, duration_s: 86400 }, simulation: { timeStep_s: 0.5, seed: 1 } };
let session, timeScale = 60, paused = false, power = 500, lidClosed = true, last = performance.now(), hudT = 0, toastT = 0, snap;

async function boot() {
  const canvas = $('c'), renderer = await createRenderer(canvas, { mobile }), res = new DynamicResolution(renderer);
  const { scene, camera } = buildWorld({ shadowMap: mobile ? 512 : 1024 }), controls = await createControls(camera, canvas);
  const assets = new AssetManager({ baseUrl: import.meta.env.BASE_URL }), audio = new AudioManager({ baseUrl: import.meta.env.BASE_URL });
  const load = async (id) => { try { return await assets.load(id); } catch (e) { console.warn('asset', id, e); return null; } };
  // recursos críticos primero, el resto en segundo plano (carga bajo demanda)
  const [pot, burner] = await Promise.all([load('pot'), load('burner')]);
  // Los GLB de VRChef traen materiales negros sin textura y la escena no tiene mapa de entorno: la olla salía como silueta. Entorno procedural + acero.
  { const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js'); const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6; pm.dispose();
    if (pot && !pot.userData?.fallback) pot.traverse((o) => { if (o.isMesh && !['Sphere01', 'Line01'].includes(o.name)) { const dark = o.name.startsWith('Rectangle1') && o.geometry.attributes.position.count < 1000; o.material = new THREE.MeshStandardMaterial({ color: dark ? 0x2a2a2c : 0x8d9399, metalness: 0.75, roughness: 0.38, side: THREE.DoubleSide }); } else if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.35 }); }); }
  $('load').textContent = 'Listo'; 
  burner.position.set(BURNER.x, 0, BURNER.z); scene.add(burner); const heatY = new THREE.Box3().setFromObject(burner).max.y;
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.11, 40), new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.set(BURNER.x, heatY + 0.001, BURNER.z); scene.add(glow);
  const potGroup = new THREE.Group(); potGroup.add(pot); potGroup.position.set(0, 0, 0.2); scene.add(potGroup);
  const liquid = new LiquidSystem(), rice = new RiceVisual(), thermal = new ThermalView(); potGroup.add(liquid.group, rice.mesh, thermal.column); thermal.bindPot(pot);
  const items = { pot: potGroup }; scene.add(potGroup);
  const place = (obj, x, z) => { obj.position.set(x, 0, z); scene.add(obj); return obj; };
  const bottle = place(new THREE.Group(), -0.55, 0.12), jar = place(new THREE.Group(), 0.55, 0.12), spoon = place(new THREE.Group(), 0.4, 0.32);
  items.bottle = bottle; items.jar = jar; items.spoon = spoon;
  for (const [id, g] of [['bottle', bottle], ['jar', jar], ['spoon', spoon]]) load(id).then((o) => { if (o) g.add(o); });

  const emit = (cmd) => session.command(cmd);
  const inter = new Interaction({ dom: canvas, camera, controls, items, burner: BURNER, emit, getPower: () => power }); inter.heatY = heatY; inter.home.pot.set(0, 0, 0.2);
  inter.potPos = { x: 0, z: 0.2 };

  function newSession() {
    session?.dispose(); session = createSimClient(SESSION_INPUT);
    session.on((e) => { audio.onEvent(e); const msg = { BOIL_START: '¡Hierve! Baja el fuego para que no se seque', WATER_DEPLETED: 'Se acabó el agua libre', SIZZLE: 'El fondo chisporrotea', BURN_ONSET: '¡Empieza a quemarse!', OVERFLOW: 'La olla está llena', WARN: e.message }[e.type]; if (msg) toast(msg); });
    session.command({ type: 'SET_LID', closed: lidClosed });
  }
  function toast(m) { const t = $('toast'); t.textContent = m; t.style.opacity = 1; toastT = 2.4; }
  newSession();

  // HUD
  const btn = (id, fn) => $(id).addEventListener('click', fn);
  btn('bRice', () => emit({ type: 'ADD_INGREDIENT', containerId: 'pot', ingredient: 'rice', mass_kg: 0.1 }));
  btn('bWater', () => emit({ type: 'POUR_LIQUID', liquid: 'water', mass_kg: 0.1, T_C: 20 }));
  btn('bFire', () => { inter.placePot(!inter.onHeat); $('bFire').classList.toggle('on', inter.onHeat); });
  btn('bLid', () => { lidClosed = !lidClosed; emit({ type: 'SET_LID', closed: lidClosed }); pot.userData.setLid(lidClosed); $('bLid').classList.toggle('on', lidClosed); });
  btn('bStir', () => emit({ type: 'STIR', containerId: 'pot', intensity: 1 }));
  btn('bTherm', () => { thermal.setEnabled(!thermal.enabled); liquid.setWaterVisible(!thermal.enabled); rice.mesh.visible = !thermal.enabled; $('bTherm').classList.toggle('on', thermal.enabled); });
  btn('bView', () => potView(camera, controls, potGroup.position));
  btn('bPause', () => { paused = !paused; $('bPause').textContent = paused ? '▶' : '⏸'; });
  btn('bSnd', async () => { audio.setEnabled(!audio.enabled); $('bSnd').textContent = audio.enabled ? '🔊' : '🔇'; });
  btn('bReset', () => { newSession(); inter.placePot(false); potGroup.position.set(0, 0, 0.2); $('bFire').classList.remove('on'); toast('Reiniciado'); });
  btn('bHelp', () => $('help').classList.add('show')); btn('hClose', () => $('help').classList.remove('show'));
  document.querySelectorAll('[data-ts]').forEach((b) => b.addEventListener('click', () => { timeScale = +b.dataset.ts; document.querySelectorAll('[data-ts]').forEach((x) => x.classList.toggle('on', x === b)); }));
  const setPower = (w) => { power = w; $('power').value = w; $('pw').textContent = `${w} W`; if (inter.onHeat) emit({ type: 'SET_HEAT', sourceId: 'burner', power_W: w }); };
  $('power').addEventListener('input', (e) => setPower(+e.target.value));
  addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (e.target.tagName === 'INPUT') return;
    if (k === 'r') $('bRice').click(); else if (k === 'w') $('bWater').click(); else if (k === 'f') $('bFire').click(); else if (k === 'l') $('bLid').click(); else if (k === 's') $('bStir').click();
    else if (k === 't') $('bTherm').click(); else if (k === ' ') { e.preventDefault(); $('bPause').click(); } else if (k === 'h') $('bHelp').click();
    else if (k === 'arrowup') setPower(nextHeat(power, 1)); else if (k === 'arrowdown') setPower(nextHeat(power, -1)); else if ('1234'.includes(k) && k) document.querySelectorAll('[data-ts]')[+k - 1]?.click(); });
  const unlock = () => audio.unlock(); $('go').addEventListener('click', async () => { await unlock(); $('start').style.display = 'none'; });
  canvas.addEventListener('pointerdown', unlock, { once: true });
  const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 62 : 45; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();

  function frame(now) {
    const dtMs = now - last, dt = Math.min(0.1, dtMs / 1000); last = now; res.frame(dtMs);
    if (!paused) session.advance(dt * timeScale);
    snap = session.snapshot() ?? snap; inter.update(dt);
    if (!snap) { requestAnimationFrame(frame); return; }   // el Worker aún no envió el snapshot inicial
    const st = snap.state, lq = liquid.update(snap, dt); rice.update(snap); thermal.update(snap); audio.update(st);
    glow.material.opacity = burnerGlow(st) * (inter.onHeat ? 0.85 : 0);
    controls.update(); renderer.render(scene, camera);
    toastT -= dt; if (toastT < 0) $('toast').style.opacity = 0;
    hudT -= dt; if (hudT < 0) { hudT = 0.2; hud(snap, 1000 / Math.max(1, dtMs)); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
function hud(s, fps) {
  const st = s.state, o = s.outcome, m = Math.floor(s.t_s / 60), sec = Math.floor(s.t_s % 60), K = (x) => `${(x - 273.15).toFixed(0)}°C`;
  $('t').textContent = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`; $('fps').textContent = `${fps.toFixed(0)} fps · sim ${session.mode === 'worker' ? 'W' : 'M'} ${session.stats.ms.toFixed(1)} ms`;
  $('Tw').textContent = st.freeWater_kg > 1e-4 ? K(st.waterT_K) : '—'; $('Tb').textContent = K(st.bottomT_K); $('fw').textContent = (st.freeWater_kg * 1000).toFixed(0);
  $('M').textContent = st.riceMass_kg ? st.M_mean_db.toFixed(2) : '–'; $('a').textContent = st.riceMass_kg ? st.alpha_mean.toFixed(2) : '–';
  const el = $('state'); if (!st.riceMass_kg) { el.textContent = 'Sin arroz'; el.className = ''; $('why').textContent = 'Añade arroz y agua'; return; }
  el.textContent = OUTCOME_ES[o.label]; el.className = o.label === 'cocido' ? 'ok' : o.label === 'quemado' ? 'q' : 'warn'; $('why').textContent = o.reasons[0] ?? '';
}
boot().catch((e) => { console.error(e); $('load').textContent = 'Error: ' + e.message; });
