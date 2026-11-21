// Battle in Space — juego de naves 3D
// Idea y diseño: Víctor. Código: Three.js (sin bundler, se carga directo).
import * as THREE from './lib/three.module.js';
import { PILOTOS, USO_IA, crearEspeciales } from './especiales.js';
import { PIEZAS, RANURAS, tienda, guardarTienda, sumarGemas, comprar, GEMAS_POR_DERRIBO, GEMAS_POR_CRISTAL } from './tienda.js';

// ============================================================
// AJUSTES (se guardan en el teléfono)
// ============================================================
const ajustes = { vidas: 5, rivales: 10, piloto: 'victor' };
try { Object.assign(ajustes, JSON.parse(localStorage.getItem('bis-ajustes') || '{}')); } catch (e) {}
const LIMITES = { vidas: [1, 9], rivales: [1, 20] };
function guardarAjustes() { try { localStorage.setItem('bis-ajustes', JSON.stringify(ajustes)); } catch (e) {} }

const $ = (id) => document.getElementById(id);
const pilotoPorId = (id) => PILOTOS.find(p => p.id === id) || PILOTOS[0];

// ============================================================
// SONIDOS (generados, sin archivos)
// ============================================================
let actx = null;
function iniciarAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
}
function sonido(tipo, vol = 1) {
  if (!actx) return;
  const t = actx.currentTime;
  const g = actx.createGain();
  g.connect(actx.destination);
  if (tipo === 'laser' || tipo === 'laserEnemigo') {
    const o = actx.createOscillator();
    o.type = 'square';
    const f = tipo === 'laser' ? 1200 : 600;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f / 5, t + 0.12);
    g.gain.setValueAtTime(0.05 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    o.connect(g); o.start(t); o.stop(t + 0.14);
  } else if (tipo === 'explosion' || tipo === 'golpe') {
    const dur = tipo === 'explosion' ? 0.7 : 0.15;
    const buf = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = actx.createBufferSource(); s.buffer = buf;
    const fl = actx.createBiquadFilter(); fl.type = 'lowpass';
    fl.frequency.setValueAtTime(tipo === 'explosion' ? 900 : 2500, t);
    fl.frequency.exponentialRampToValueAtTime(80, t + dur);
    g.gain.setValueAtTime((tipo === 'explosion' ? 0.5 : 0.2) * vol, t);
    s.connect(fl); fl.connect(g); s.start(t);
  } else if (tipo === 'turbo') {
    const o = actx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(500, t + 0.4);
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g); o.start(t); o.stop(t + 0.5);
  } else if (tipo === 'click') {
    const o = actx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(660, t);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); o.start(t); o.stop(t + 0.1);
  }
}

// ============================================================
// ESCENA 3D
// ============================================================
const canvas = $('gl');
let calidad = 1.5;
try { const c = parseFloat(localStorage.getItem('bis-calidad')); if (c > 0) calidad = c; } catch (e) {}
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: calidad > 1, powerPreference: 'high-performance' });
} catch (e) {
  throw new Error('No se pudo iniciar el 3D (WebGL): ' + e.message);
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, calidad));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1d33);
scene.fog = new THREE.FogExp2(0x2a1d33, 0.0016);
const camera = new THREE.PerspectiveCamera(70, 1, 0.5, 3000);

scene.add(new THREE.HemisphereLight(0xe6ccff, 0x3a2448, 1.4));
const sol = new THREE.DirectionalLight(0xffffff, 1.6);
sol.position.set(300, 500, 200);
scene.add(sol);

const R = 520; // radio de la zona de batalla

// Estrellas
{
  const n = 2500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(1400 + Math.random() * 300);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false });
  scene.add(new THREE.Points(g, m));
}

// Textura redonda suave (para nebulosas y chispas)
function texturaRadial(c1, c2) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, c1); gr.addColorStop(1, c2);
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}
const texNebulosa = texturaRadial('rgba(190,110,230,0.55)', 'rgba(190,110,230,0)');
const texChispa = texturaRadial('rgba(255,255,255,1)', 'rgba(255,200,80,0)');

// Nebulosas moradas de fondo
for (let i = 0; i < 9; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texNebulosa, fog: false, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.5 + Math.random() * 0.4,
    color: new THREE.Color().setHSL(0.75 + Math.random() * 0.12, 0.7, 0.6),
  }));
  s.position.copy(new THREE.Vector3().randomDirection().multiplyScalar(1300));
  const t = 500 + Math.random() * 700; s.scale.set(t, t, 1);
  scene.add(s);
}

// Borde de la zona (esfera de malla muy suave)
const borde = new THREE.Mesh(
  new THREE.SphereGeometry(R, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0xc070ff, wireframe: true, transparent: true, opacity: 0.08, fog: false })
);
scene.add(borde);

// Asteroides
const asteroides = [];
const matAst = new THREE.MeshStandardMaterial({ color: 0x8c7a96, flatShading: true, roughness: 1 });
function crearAsteroides() {
  for (const a of asteroides) scene.remove(a.mesh);
  asteroides.length = 0;
  for (let i = 0; i < 45; i++) {
    const r = 6 + Math.random() * 22;
    const geo = new THREE.IcosahedronGeometry(r, 1);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, k).multiplyScalar(0.8 + Math.random() * 0.35);
      p.setXYZ(k, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, matAst);
    let pos;
    do { pos = new THREE.Vector3().randomDirection().multiplyScalar(80 + Math.random() * (R - 100)); }
    while (pos.length() < 80);
    m.position.copy(pos);
    m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    scene.add(m);
    asteroides.push({ mesh: m, r: r * 0.95, giro: new THREE.Vector3(Math.random(), Math.random(), 0).multiplyScalar(0.3) });
  }
}

// ============================================================
// MODELO DE LA NAVE (como el dibujo: ala triangular, cabina negra, fuego atrás)
// ============================================================
function crearModeloNave(color, acento, equipo) {
  const g = new THREE.Group();
  const matCuerpo = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, metalness: 0.2 });
  const matOscuro = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.3, metalness: 0.5 });

  // Ala delta
  const forma = new THREE.Shape();
  forma.moveTo(0, 3.2); forma.lineTo(-4.6, -2.2); forma.lineTo(-1.2, -1.4);
  forma.lineTo(0, -2.0); forma.lineTo(1.2, -1.4); forma.lineTo(4.6, -2.2); forma.closePath();
  const ala = new THREE.ExtrudeGeometry(forma, { depth: 0.35, bevelEnabled: false });
  ala.rotateX(Math.PI / 2); ala.translate(0, 0.17, 0);
  g.add(new THREE.Mesh(ala, matCuerpo));

  // Cuerpo central
  const cuerpo = new THREE.ConeGeometry(1.0, 6.5, 6);
  cuerpo.rotateX(Math.PI / 2);
  const mc = new THREE.Mesh(cuerpo, matCuerpo); mc.position.set(0, 0.3, 0.6); g.add(mc);

  // Cabina negra
  const cab = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), matOscuro);
  cab.scale.set(0.8, 0.6, 1.6); cab.position.set(0, 0.85, 0.4); g.add(cab);

  // Aleta de cola
  const aleta = new THREE.Shape();
  aleta.moveTo(0, 0); aleta.lineTo(-1.8, 0); aleta.lineTo(-2.2, 1.6); aleta.closePath();
  const ag = new THREE.ExtrudeGeometry(aleta, { depth: 0.2, bevelEnabled: false });
  ag.rotateY(Math.PI / 2); ag.translate(-0.1, 0.4, -0.3);
  g.add(new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: acento })));
  // franjas brillantes en las alas (para ver bien las naves oscuras)
  for (const lado of [-1, 1]) {
    const fr = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.35), new THREE.MeshBasicMaterial({ color: acento }));
    fr.position.set(lado * 2.6, 0.38, -1.2); fr.rotation.y = lado * 0.5; g.add(fr);
  }

  // Fuego del motor
  const fuego = new THREE.Group();
  const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.6, 8), new THREE.MeshBasicMaterial({ color: 0xffd83b, transparent: true, opacity: 0.9 }));
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.7, 8), new THREE.MeshBasicMaterial({ color: 0xff3b2e }));
  f1.rotation.x = -Math.PI / 2; f2.rotation.x = -Math.PI / 2;
  f1.position.z = -1.3; f2.position.z = -0.9;
  fuego.add(f1, f2); fuego.position.set(0, 0.3, -2.4);
  g.add(fuego);
  g.userData.fuego = fuego;
  g.userData.materiales = [matCuerpo];
  if (equipo) { agregarPiezas(g, equipo); agregarMisiles(g, equipo); }
  return g;
}

// Piezas compradas en la tienda (se ven en la nave)
function agregarPiezas(g, eq) {
  if (eq.elitras) {
    const colores = { simples: 0xffffff, protectoras: 0xffd83b, pesadas: 0x5a5560 };
    const col = colores[eq.elitras];
    const grosor = eq.elitras === 'pesadas' ? 0.6 : 0.18;
    for (const lado of [-1, 1]) {
      const forma = new THREE.Shape();
      forma.moveTo(0, 2.2); forma.lineTo(lado * 3.4, -1.6); forma.lineTo(lado * 0.6, -1.0); forma.closePath();
      const geo = new THREE.ExtrudeGeometry(forma, { depth: grosor, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);
      const el = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, flatShading: true, side: THREE.DoubleSide, metalness: eq.elitras === 'pesadas' ? 0.6 : 0.1 }));
      el.position.set(lado * 0.6, 0.75 + grosor, -0.2);
      el.rotation.z = lado * 0.22;
      g.add(el);
      // raya azul como en el dibujo
      const raya = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.28), new THREE.MeshBasicMaterial({ color: 0x2f8fff }));
      raya.position.set(lado * 2.1, 0.95 + grosor * 2 + Math.abs(lado) * 0.35, -0.5); raya.rotation.set(0, lado * 0.55, lado * 0.22);
      g.add(raya);
    }
  }
  if (eq.tirador) {
    const matC = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.6, roughness: 0.4 });
    const matP = new THREE.MeshBasicMaterial({ color: 0xffd83b });
    if (eq.tirador === 'laser') matC.color.set(0x7a3fa0);
    const xs = eq.tirador === 'triple' ? [-2.6, 0, 2.6] : eq.tirador === 'laser' ? [0] : eq.tirador === 'ametralladora' ? [-1.7, -1.2, 1.2, 1.7] : [-1.5, 1.5];
    const largo = eq.tirador === 'rapido' ? 3.6 : eq.tirador === 'laser' ? 5 : eq.tirador === 'ametralladora' ? 3 : 2.4;
    for (const x of xs) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, largo, 8), matC);
      c.rotation.x = Math.PI / 2; c.position.set(x, x === 0 ? 1.1 : 0.1, 1.2 + largo / 2 - 0.6); g.add(c);
      const pt = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.3, 8), matP);
      pt.rotation.x = Math.PI / 2; pt.position.set(x, c.position.y, c.position.z + largo / 2); g.add(pt);
    }
  }
}

function agregarMisiles(g, eq) {
  if (eq.misiles !== 'triplesVerdes') return;
  const mat = new THREE.MeshStandardMaterial({ color: 0x3ccf4e, emissive: 0x0d4a14 });
  const matGris = new THREE.MeshStandardMaterial({ color: 0x555555, flatShading: true });
  for (const lado of [-1, 1]) {
    const caja = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 2.4), matGris);
    caja.position.set(lado * 2.2, -0.35, -0.3); g.add(caja);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.6, 8), mat);
    m.rotation.x = Math.PI / 2; m.position.set(lado * 2.2, -0.35, 0.2); g.add(m);
  }
}

// Equipo que realmente puede usar (solo piezas compradas)
function equipoValido() {
  const eq = { ...tienda.equipo };
  for (const k of ['elitras', 'tirador', 'misiles']) if (eq[k] && !tienda.compradas.includes(eq[k])) eq[k] = null;
  if (eq.central && !PILOTOS.some(p => p.id === eq.central)) eq.central = null;
  return eq;
}

// ============================================================
// NAVES
// ============================================================
const naves = [];
let jugador = null;

class Nave {
  constructor(piloto, esJugador, nombre) {
    this.piloto = piloto; this.nombre = nombre || piloto.nombre; this.esJugador = esJugador;
    this.equipo = esJugador ? equipoValido() : {};
    const central = this.equipo.central ? pilotoPorId(this.equipo.central) : null;
    this.color = esJugador ? (central ? central.color : 0xf2f2f2) : piloto.color;
    this.modelo = crearModeloNave(this.color, central ? central.acento : piloto.acento, this.equipo);
    this.obj = new THREE.Group(); this.obj.add(this.modelo); scene.add(this.obj);
    this.obj.rotation.order = 'YXZ';
    this.pos = this.obj.position;
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.alabeo = 0; this.giro = 0; this.giroT = 0;
    this.velocidad = esJugador ? 42 : 34;
    this.hpMax = esJugador ? 100 : 60; this.hp = this.hpMax;
    this.vidas = ajustes.vidas; this.tReaparecer = 0;
    this.cdEspecial = esJugador ? 2 : 4 + Math.random() * 6;
    this.lento = 0;
    // efectos de las piezas
    this.defensa = 1;
    if (this.equipo.elitras === 'simples') this.velocidad *= 1.25;
    if (this.equipo.elitras === 'pesadas') { this.velocidad *= 0.8; this.defensa = 0.5; }
    this.municion = 40; this.recargando = 0;
    this.escudo = 0; this.cdEscudo = 0; this.cdMisil = 0;
    if (this.equipo.tirador === 'ametralladora') this.municion = 20;
    if (this.equipo.elitras === 'protectoras') {
      this.burbuja = new THREE.Mesh(new THREE.SphereGeometry(6.5, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.burbuja.visible = false; this.obj.add(this.burbuja);
    }
    this.vivo = true; this.cdDisparo = 0; this.invulnerable = 0;
    this.turbo = 1; this.usandoTurbo = false;
    this.derribos = 0;
    // IA
    this.objetivo = null; this.tRetarget = 0; this.tEvadir = 0; this.dirEvadir = new THREE.Vector3();
  }
  adelante(v = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return v.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
  }
  colocarAlAzar() {
    let p;
    let intentos = 0;
    do {
      p = new THREE.Vector3().randomDirection().multiplyScalar(R * (0.3 + Math.random() * 0.55));
      intentos++;
    } while (intentos < 30 && (asteroides.some(a => a.mesh.position.distanceTo(p) < a.r + 15) ||
      naves.some(n => n !== this && n.vivo && n.pos.distanceTo(p) < 60)));
    this.pos.copy(p);
    const haciaCentro = p.clone().negate();
    this.yaw = Math.atan2(haciaCentro.x, haciaCentro.z);
    this.pitch = 0;
  }
  girarHacia(dir, rapidez, dt) {
    const yawObj = Math.atan2(dir.x, dir.z);
    const pitchObj = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    let dy = yawObj - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const maxY = rapidez * dt;
    const cambioYaw = THREE.MathUtils.clamp(dy, -maxY, maxY);
    this.yaw += cambioYaw;
    this.pitch += THREE.MathUtils.clamp(pitchObj - this.pitch, -maxY * 0.8, maxY * 0.8);
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.2, 1.2);
    return cambioYaw / Math.max(dt, 1e-4); // velocidad de giro (para inclinar)
  }
  mover(dt, tasaGiro) {
    let v = this.velocidad * (this.usandoTurbo ? 1.9 : 1);
    if (this.lento > 0) { this.lento -= dt; v *= 0.5; }
    this.adelante(this.vel).multiplyScalar(v);
    this.pos.addScaledVector(this.vel, dt);
    // inclinación visual
    const alabeoObj = THREE.MathUtils.clamp(-tasaGiro * 0.5, -0.9, 0.9);
    this.alabeo += (alabeoObj - this.alabeo) * Math.min(1, dt * 6);
    if (this.giroT > 0) {
      this.giroT -= dt;
      this.giro = (1 - Math.max(this.giroT, 0) / 0.6) * Math.PI * 2 * this.giroDir;
      if (this.giroT <= 0) this.giro = 0;
    }
    this.obj.rotation.set(-this.pitch, this.yaw, this.alabeo + this.giro);
    // fuego del motor
    const f = this.modelo.userData.fuego;
    const largo = (this.usandoTurbo ? 2.2 : 1) * (0.85 + Math.random() * 0.3);
    f.scale.set(1, 1, largo);
    // parpadeo si es invulnerable
    if (this.invulnerable > 0) {
      this.invulnerable -= dt;
      this.obj.visible = Math.floor(this.invulnerable * 12) % 2 === 0;
    } else this.obj.visible = true;
  }
}

// ============================================================
// DISPAROS
// ============================================================
const balas = [];
const geoBala = new THREE.BoxGeometry(0.3, 0.3, 4);
const matBalaJ = new THREE.MeshBasicMaterial({ color: 0xff7bff });
const matBalaE = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();

function disparar(nave, dirApuntada) {
  const esJ = nave.esJugador;
  const dir = dirApuntada ? dirApuntada.clone() : nave.adelante();
  if (!esJ) { // los rivales fallan un poco
    dir.x += (Math.random() - 0.5) * 0.06; dir.y += (Math.random() - 0.5) * 0.06; dir.z += (Math.random() - 0.5) * 0.06;
    dir.normalize();
  }
  const lados = !esJ ? [0] : nave.equipo.tirador === 'triple' ? [-2.6, 0, 2.6] : [-2.6, 2.6];
  for (const lado of lados) {
    const m = new THREE.Mesh(geoBala, esJ ? matBalaJ : matBalaE);
    nave.obj.updateMatrixWorld();
    m.position.copy(nave.obj.localToWorld(_v.set(lado, 0.2, 2.5)));
    _q.setFromUnitVectors(_v2.set(0, 0, 1), dir);
    m.quaternion.copy(_q);
    scene.add(m);
    balas.push({ mesh: m, vel: dir.clone().multiplyScalar(280).add(nave.vel), vida: 1.6, dueno: nave, dano: esJ ? 10 : 7 });
  }
  if (esJ) sonido('laser');
  else if (jugador && nave.pos.distanceTo(jugador.pos) < 200) sonido('laserEnemigo', 0.5);
}

// ============================================================
// EXPLOSIONES Y CHISPAS
// ============================================================
const efectos = [];
function explosion(pos, grande = true, color = 0xffaa33) {
  const n = grande ? 60 : 12;
  const p = new Float32Array(n * 3), vels = [];
  for (let i = 0; i < n; i++) {
    p.set([pos.x, pos.y, pos.z], i * 3);
    vels.push(new THREE.Vector3().randomDirection().multiplyScalar((grande ? 18 : 10) + Math.random() * (grande ? 30 : 12)));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ size: grande ? 3.2 : 1.6, map: texChispa, color, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, m);
  scene.add(pts);
  let flash = null;
  if (grande) {
    flash = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }));
    flash.position.copy(pos); scene.add(flash);
  }
  efectos.push({ pts, vels, flash, t: 0, dur: grande ? 1.1 : 0.4 });
}
function actualizarEfectos(dt) {
  for (let i = efectos.length - 1; i >= 0; i--) {
    const e = efectos[i]; e.t += dt;
    const a = e.pts.geometry.attributes.position;
    for (let k = 0; k < e.vels.length; k++) {
      a.setXYZ(k, a.getX(k) + e.vels[k].x * dt, a.getY(k) + e.vels[k].y * dt, a.getZ(k) + e.vels[k].z * dt);
    }
    a.needsUpdate = true;
    const f = e.t / e.dur;
    e.pts.material.opacity = 1 - f;
    if (e.flash) { e.flash.scale.setScalar(2 + f * 14); e.flash.material.opacity = Math.max(0, 0.9 - f * 2); }
    if (f >= 1) {
      scene.remove(e.pts); e.pts.geometry.dispose(); e.pts.material.dispose();
      if (e.flash) { scene.remove(e.flash); e.flash.geometry.dispose(); e.flash.material.dispose(); }
      efectos.splice(i, 1);
    }
  }
}

// Poderes especiales de cada piloto (ver especiales.js)
const especiales = crearEspeciales({ scene, naves, asteroides, danar, explosion, sonido, jugador: () => jugador });

// ============================================================
// CONTROLES TÁCTILES + TECLADO
// ============================================================
const input = { x: 0, y: 0, fuego: false, turbo: false, especial: false, escudo: false, misil: false };
const teclas = {};
{
  const zona = $('joyZona'), base = $('joy'), knob = $('knob');
  let idDedo = null;
  const mover = (e) => {
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width / 2;
    let dx = (e.clientX - cx) / rad, dy = (e.clientY - cy) / rad;
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    input.x = dx; input.y = -dy;
    knob.style.transform = `translate(${dx * rad * 0.65}px, ${dy * rad * 0.65}px)`;
  };
  zona.addEventListener('pointerdown', (e) => { idDedo = e.pointerId; zona.setPointerCapture(e.pointerId); mover(e); e.preventDefault(); });
  zona.addEventListener('pointermove', (e) => { if (e.pointerId === idDedo) mover(e); });
  const soltar = (e) => { if (e.pointerId !== idDedo) return; idDedo = null; input.x = input.y = 0; knob.style.transform = ''; };
  zona.addEventListener('pointerup', soltar); zona.addEventListener('pointercancel', soltar);

  const boton = (el, abajo, arriba) => {
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); el.classList.add('activo'); abajo(); e.preventDefault(); });
    const fin = () => { el.classList.remove('activo'); if (arriba) arriba(); };
    el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin);
  };
  boton($('btnFuego'), () => input.fuego = true, () => input.fuego = false);
  boton($('btnTurbo'), () => input.turbo = true, () => input.turbo = false);
  boton($('btnGiro'), () => hacerGiro(), null);
  boton($('btnEspecial'), () => input.especial = true, null);
  boton($('btnEscudo'), () => input.escudo = true, null);
  boton($('btnMisil'), () => input.misil = true, null);
}
window.addEventListener('keydown', (e) => {
  teclas[e.code] = true;
  if (e.code === 'KeyE' || e.code === 'KeyQ') hacerGiro();
  if (e.code === 'KeyF' || e.code === 'KeyR') input.especial = true;
  if (e.code === 'KeyG') input.escudo = true;
  if (e.code === 'KeyM') input.misil = true;
  if (e.code === 'Escape' && estado === 'jugando') irAlMenu();
});
window.addEventListener('keyup', (e) => { teclas[e.code] = false; });
document.addEventListener('contextmenu', (e) => e.preventDefault());

function hacerGiro() {
  if (estado !== 'jugando' || !jugador || !jugador.vivo || jugador.giroT > 0) return;
  jugador.giroT = 0.6; jugador.giroDir = input.x < 0 ? 1 : -1;
  jugador.invulnerable = Math.max(jugador.invulnerable, 0.6);
  sonido('turbo');
}

// ============================================================
// ESTADO DEL JUEGO
// ============================================================
let estado = 'titulo';
let totalPersonas = 0, tFin = 0, gemasPartida = 0;
let objetivoFijado = null;

function mostrar(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('visible', s.id === id);
}

function nuevaPartida() {
  // limpiar
  for (const n of naves) scene.remove(n.obj);
  naves.length = 0;
  for (const b of balas) scene.remove(b.mesh);
  balas.length = 0;
  especiales.limpiar();
  crearAsteroides();

  const mio = pilotoPorId(ajustes.piloto);
  jugador = new Nave(mio, true, `${mio.nombre} (tú)`);
  naves.push(jugador);
  jugador.colocarAlAzar();
  // los rivales son los otros pilotos (si hay más rivales que pilotos, se repiten con número)
  const otros = PILOTOS.filter(p => p !== mio).sort(() => Math.random() - 0.5);
  const lista = [...otros, mio];
  const veces = {};
  for (let i = 0; i < ajustes.rivales; i++) {
    const pil = lista[i % lista.length];
    veces[pil.id] = (veces[pil.id] || 0) + 1;
    const nombre = veces[pil.id] > 1 || pil === mio ? `${pil.nombre} ${veces[pil.id] + (pil === mio ? 1 : 0)}` : pil.nombre;
    const n = new Nave(pil, false, nombre);
    naves.push(n);
    n.colocarAlAzar();
    n.cdDisparo = 2 + Math.random() * 2;
  }
  totalPersonas = ajustes.rivales + 1;
  jugador.invulnerable = 3;
  tFin = 0; gemasPartida = 0;
  crearCristales();
  $('btnEscudo').style.display = jugador.burbuja ? '' : 'none';
  $('municion').style.display = ['rapido', 'ametralladora'].includes(jugador.equipo.tirador) ? '' : 'none';
  $('btnMisil').style.display = jugador.equipo.misiles ? '' : 'none';
  $('feed').innerHTML = '';
  $('mensaje').textContent = '¡A LUCHAR!';
  setTimeout(() => { if ($('mensaje').textContent === '¡A LUCHAR!') $('mensaje').textContent = ''; }, 1500);
  posicionarCamara(true);
  estado = 'jugando';
  mostrar('hud');
  actualizarHUD();
}

function irAlMenu() {
  estado = 'menu';
  $('gemasMenu').textContent = `💎 ${tienda.gemas}`;
  input.fuego = input.turbo = false;
  mostrar('menu');
}

function personasVivas() {
  return naves.filter(n => n.vidas > 0).length;
}

function avisar(texto) {
  const d = document.createElement('div');
  d.textContent = texto;
  const feed = $('feed');
  feed.appendChild(d);
  while (feed.children.length > 3) feed.removeChild(feed.firstChild);
  setTimeout(() => d.remove(), 3600);
}

function danar(nave, cant, atacante, silencioso) {
  if (!nave.vivo || nave.invulnerable > 0) return;
  if (nave.escudo > 0) return;
  nave.hp -= cant * nave.defensa;
  if (nave.esJugador && !silencioso) sonido('golpe');
  if (nave.hp <= 0) {
    nave.hp = 0; nave.vivo = false; nave.obj.visible = false;
    explosion(nave.pos.clone(), true);
    const dist = jugador ? nave.pos.distanceTo(jugador.pos) : 0;
    sonido('explosion', nave.esJugador ? 1 : Math.max(0.15, 1 - dist / 400));
    if (atacante) atacante.derribos++;
    if (atacante && atacante.esJugador && !nave.esJugador) {
      sumarGemas(GEMAS_POR_DERRIBO); gemasPartida += GEMAS_POR_DERRIBO;
      avisar(`+${GEMAS_POR_DERRIBO} 💎`);
    }
    const quien = atacante ? atacante.nombre : 'un asteroide';
    nave.vidas--;
    if (nave.vidas > 0) nave.tReaparecer = 2.5;
    const resto = nave.vidas > 0 ? ` (le quedan ${nave.vidas} ♥)` : ' ¡ELIMINADO!';
    if (nave.esJugador) {
      avisar(`${quien} te derribó`);
      if (nave.vidas > 0) $('mensaje').textContent = 'REAPARECIENDO...';
    } else {
      avisar((atacante && atacante.esJugador ? `¡Derribaste a ${nave.nombre}!` : `${quien} derribó a ${nave.nombre}`) + resto);
    }
    actualizarHUD();
  }
}

function terminar(gano) {
  estado = 'fin';
  const puesto = personasVivas() + (gano ? 0 : 1);
  $('finTitulo').textContent = gano ? '¡GANASTE!' : 'FIN DEL JUEGO';
  $('finTexto').innerHTML = (gano
    ? `Fuiste el último en pie.<br>Derribos: ${jugador.derribos}`
    : `Quedaste en el puesto #${puesto} de ${totalPersonas}<br>Derribos: ${jugador.derribos}`) +
    `<br>💎 Gemas ganadas: ${gemasPartida} (tienes ${tienda.gemas})`;
  mostrar('fin');
}

// ============================================================
// IA DE LOS RIVALES
// ============================================================
function elegirObjetivo(n) {
  const candidatos = naves.filter(o => o !== n && o.vivo);
  if (!candidatos.length) return null;
  let mejor = null, mejorPuntaje = -Infinity;
  for (const c of candidatos) {
    let p = -c.pos.distanceTo(n.pos) + Math.random() * 150;
    if (c.esJugador) p += 60; // al jugador lo buscan un poquito más
    if (p > mejorPuntaje) { mejorPuntaje = p; mejor = c; }
  }
  return mejor;
}

function evitarAsteroides(n, dir) {
  const f = n.adelante(_v);
  for (const a of asteroides) {
    _v2.subVectors(a.mesh.position, n.pos);
    const d = _v2.length();
    if (d > a.r + 45) continue;
    const delante = _v2.dot(f);
    if (delante < 0) continue;
    const lateral = Math.sqrt(Math.max(0, d * d - delante * delante));
    if (lateral < a.r + 8) { dir.addScaledVector(_v2.normalize(), -2).add(new THREE.Vector3(0, 1.5, 0)); return true; }
  }
  return false;
}

function actualizarIA(n, dt) {
  n.tRetarget -= dt;
  if (!n.objetivo || !n.objetivo.vivo || n.tRetarget <= 0) {
    n.objetivo = elegirObjetivo(n); n.tRetarget = 3 + Math.random() * 4;
  }
  const dir = new THREE.Vector3();
  if (n.tEvadir > 0) {
    n.tEvadir -= dt; dir.copy(n.dirEvadir);
  } else if (n.objetivo) {
    const o = n.objetivo;
    const dist = o.pos.distanceTo(n.pos);
    dir.copy(o.pos).addScaledVector(o.vel, dist / 280).sub(n.pos);
    if (dist < 25) { // muy cerca: se aleja
      n.tEvadir = 1.2 + Math.random();
      n.dirEvadir.randomDirection(); n.dirEvadir.y *= 0.4;
    }
    // disparar si está apuntando
    n.cdDisparo -= dt;
    const ang = n.adelante(_v).angleTo(_v2.copy(dir));
    if (n.cdDisparo <= 0 && ang < 0.14 && dist < 320) {
      disparar(n, _v2.normalize());
      n.cdDisparo = 0.45 + Math.random() * 0.6;
    }
    // poder especial
    n.cdEspecial -= dt;
    const uso = USO_IA[n.piloto.especial];
    if (n.cdEspecial <= 0 && dist < uso.dist && ang < uso.ang) {
      especiales.usar(n, n.piloto.especial, _v2.copy(dir).normalize());
      n.cdEspecial = n.piloto.cd * (1.4 + Math.random());
    }
  } else dir.copy(n.adelante());
  if (n.pos.length() > R * 0.85) dir.copy(n.pos).negate();
  evitarAsteroides(n, dir.normalize());
  const tasa = n.girarHacia(dir, 1.25, dt);
  n.mover(dt, tasa);
}

// ============================================================
// JUGADOR
// ============================================================
function actualizarJugador(dt) {
  const j = jugador;
  let ix = input.x, iy = input.y;
  if (teclas.ArrowLeft || teclas.KeyA) ix = -1;
  if (teclas.ArrowRight || teclas.KeyD) ix = 1;
  if (teclas.ArrowUp || teclas.KeyW) iy = 1;
  if (teclas.ArrowDown || teclas.KeyS) iy = -1;
  const fuego = input.fuego || teclas.Space;
  const turbo = input.turbo || teclas.ShiftLeft || teclas.ShiftRight;

  // fuera de la zona: la nave vuelve sola
  let tasa;
  if (j.pos.length() > R) {
    $('mensaje').textContent = '¡VUELVE A LA ZONA!';
    tasa = j.girarHacia(_v.copy(j.pos).negate().normalize(), 1.6, dt);
    j.fuera = true;
  } else {
    if (j.fuera) { j.fuera = false; if ($('mensaje').textContent === '¡VUELVE A LA ZONA!') $('mensaje').textContent = ''; }
    tasa = -ix * 1.9;
    j.yaw += tasa * dt;
    j.pitch = THREE.MathUtils.clamp(j.pitch + iy * 1.5 * dt, -1.2, 1.2);
    if (Math.abs(iy) < 0.05) j.pitch *= 1 - dt * 0.4; // se nivela solito
  }

  // turbo
  j.usandoTurbo = turbo && j.turbo > 0.02;
  if (j.usandoTurbo) { if (!j.turboAntes) sonido('turbo'); j.turbo = Math.max(0, j.turbo - dt * 0.45); }
  else j.turbo = Math.min(1, j.turbo + dt * 0.2);
  j.turboAntes = j.usandoTurbo;

  j.mover(dt, tasa);

  // ayuda para apuntar: busca un rival en frente
  objetivoFijado = null;
  const f = j.adelante(new THREE.Vector3());
  let mejorAng = 0.22;
  for (const n of naves) {
    if (n === j || !n.vivo) continue;
    _v.subVectors(n.pos, j.pos);
    const d = _v.length();
    if (d > 420) continue;
    const ang = f.angleTo(_v);
    if (ang < mejorAng) { mejorAng = ang; objetivoFijado = n; }
  }

  // poder especial
  j.cdEspecial -= dt;
  if (input.especial) {
    input.especial = false;
    if (j.cdEspecial <= 0) {
      let dir = null;
      if (objetivoFijado) dir = _v2.copy(objetivoFijado.pos).sub(j.pos).normalize();
      especiales.usar(j, j.piloto.especial, dir);
      j.cdEspecial = j.piloto.cd;
    }
  }

  // escudo (élitras protectoras)
  j.cdEscudo -= dt;
  if (j.escudo > 0) { j.escudo -= dt; if (j.escudo <= 0) j.burbuja.visible = false; else j.burbuja.material.opacity = 0.2 + Math.sin(performance.now() / 80) * 0.08; }
  if (input.escudo) {
    input.escudo = false;
    if (j.burbuja && j.cdEscudo <= 0) { j.escudo = 4; j.cdEscudo = 15; j.burbuja.visible = true; sonido('turbo'); }
  }

  // misiles triples verdes
  j.cdMisil -= dt;
  if (input.misil) {
    input.misil = false;
    if (j.equipo.misiles && j.cdMisil <= 0) {
      const dir = objetivoFijado ? _v2.copy(objetivoFijado.pos).sub(j.pos).normalize() : null;
      especiales.usar(j, 'misilesVerdes', dir);
      j.cdMisil = 6;
    }
  }

  const tir = j.equipo.tirador;
  // tirador rápido: hay que recargar
  if (j.recargando > 0) { j.recargando -= dt; if (j.recargando <= 0) j.municion = 40; }
  // ametralladora láser: 20 disparos, se recarga sola mientras no la usas
  if (tir === 'ametralladora') {
    j.sinDisparar = fuego ? 0 : (j.sinDisparar || 0) + dt;
    if (j.sinDisparar > 0.4) j.municion = Math.min(20, j.municion + dt * 12);
  }

  j.cdDisparo -= dt;
  const puede = j.recargando <= 0 && (tir !== 'ametralladora' || j.municion >= 1);
  if (fuego && j.cdDisparo <= 0 && puede) {
    let dir = null;
    if (objetivoFijado) {
      const d = objetivoFijado.pos.distanceTo(j.pos);
      dir = _v2.copy(objetivoFijado.pos).addScaledVector(objetivoFijado.vel, d / 280).sub(j.pos).normalize();
    }
    if (tir === 'laser') {
      dispararHaz(j, dir || j.adelante(new THREE.Vector3()));
      j.cdDisparo = 0.45;
    } else {
      disparar(j, dir);
      j.cdDisparo = tir === 'rapido' ? 0.06 : tir === 'ametralladora' ? 0.05 : 0.16;
    }
    if (tir === 'rapido' && --j.municion <= 0) { j.recargando = 1.8; sonido('turbo'); }
    if (tir === 'ametralladora') j.municion -= 1;
  }
}

// Tirador de fuego láser: un láser muy largo que dura poco
const haces = [];
function dispararHaz(nave, dir) {
  const LARGO = 340;
  const geo = new THREE.CylinderGeometry(0.5, 0.5, LARGO, 8, 1, true);
  geo.rotateX(Math.PI / 2); geo.translate(0, 0, LARGO / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff7bff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(nave.pos).addScaledVector(dir, 3);
  m.quaternion.setFromUnitVectors(_v.set(0, 0, 1), dir);
  scene.add(m);
  const fin = m.position.clone().addScaledVector(dir, LARGO);
  const seg = fin.clone().sub(m.position);
  for (const o of naves) {
    if (o === nave || !o.vivo) continue;
    const t = THREE.MathUtils.clamp(_v.subVectors(o.pos, m.position).dot(seg) / seg.lengthSq(), 0, 1);
    if (_v2.copy(m.position).addScaledVector(seg, t).distanceTo(o.pos) < 4.5) {
      danar(o, 16, nave); explosion(o.pos.clone(), false, 0xff9cff);
    }
  }
  haces.push({ m, t: 0 });
  sonido('laser'); sonido('turbo', 0.4);
}
function actualizarHaces(dt) {
  for (let i = haces.length - 1; i >= 0; i--) {
    const h = haces[i]; h.t += dt;
    h.m.material.opacity = 1 - h.t / 0.22;
    h.m.scale.set(1 + h.t * 6, 1 + h.t * 6, 1);
    if (h.t >= 0.22) { scene.remove(h.m); h.m.geometry.dispose(); h.m.material.dispose(); haces.splice(i, 1); }
  }
}

// ============================================================
// FÍSICA: balas y choques
// ============================================================
function actualizarBalas(dt) {
  for (let i = balas.length - 1; i >= 0; i--) {
    const b = balas[i];
    b.mesh.position.addScaledVector(b.vel, dt);
    b.vida -= dt;
    let choco = false;
    for (const n of naves) {
      if (!n.vivo || n === b.dueno) continue;
      if (n.pos.distanceToSquared(b.mesh.position) < 3.6 * 3.6) {
        danar(n, b.dano, b.dueno); choco = true;
        explosion(b.mesh.position.clone(), false, b.dueno.esJugador ? 0xff9cff : 0xff5050);
        break;
      }
    }
    if (!choco) for (const a of asteroides) {
      if (a.mesh.position.distanceToSquared(b.mesh.position) < a.r * a.r) {
        choco = true; explosion(b.mesh.position.clone(), false, 0xcbb6d6); break;
      }
    }
    if (choco || b.vida <= 0) { scene.remove(b.mesh); balas.splice(i, 1); }
  }
}

function choquesNaves() {
  for (const n of naves) {
    if (!n.vivo) continue;
    for (const a of asteroides) {
      _v.subVectors(n.pos, a.mesh.position);
      const d = _v.length(), min = a.r + 2.2;
      if (d < min) {
        n.pos.addScaledVector(_v.normalize(), min - d + 0.5);
        if (n.invulnerable <= 0) { danar(n, n.esJugador ? 15 : 20, null); if (n.vivo) n.invulnerable = 0.8; }
        if (n.esJugador) sonido('golpe');
        // rebota apuntando hacia afuera
        n.yaw = Math.atan2(_v.x, _v.z); n.pitch = THREE.MathUtils.clamp(Math.asin(_v.y), -1, 1);
      }
    }
  }
}

// ============================================================
// CÁMARA
// ============================================================
const camObjetivo = new THREE.Vector3();
function posicionarCamara(instantanea, dt = 0.016) {
  if (!jugador) return;
  const f = jugador.adelante(new THREE.Vector3());
  const atras = jugador.usandoTurbo ? 17 : 14;
  camObjetivo.copy(jugador.pos).addScaledVector(f, -atras).add(_v.set(0, 4.5, 0));
  if (instantanea) camera.position.copy(camObjetivo);
  else camera.position.lerp(camObjetivo, 1 - Math.exp(-7 * dt));
  camera.lookAt(_v2.copy(jugador.pos).addScaledVector(f, 25));
  const fovObj = jugador.usandoTurbo ? 82 : 70;
  camera.fov += (fovObj - camera.fov) * Math.min(1, dt * 4);
  camera.updateProjectionMatrix();
}

// ============================================================
// HUD
// ============================================================
let vivasAntes = -1;
function actualizarHUD() {
  if (!jugador) return;
  $('vidaFill').style.width = (jugador.hp / jugador.hpMax * 100) + '%';
  const vivas = personasVivas();
  if (vivas !== vivasAntes) {
    $('vivas').innerHTML = `${vivas}/${totalPersonas}<br><small>PERSONAS VIVAS</small>`;
    vivasAntes = vivas;
  }
  $('derribos').textContent = `DERRIBOS ${jugador.derribos}`;
  $('corazones').textContent = '♥'.repeat(Math.max(0, jugador.vidas));
  const btnE = $('btnEspecial');
  const listo = jugador.cdEspecial <= 0;
  const pct = listo ? 100 : 100 - (jugador.cdEspecial / jugador.piloto.cd) * 100;
  btnE.style.setProperty('--carga', pct + '%');
  btnE.classList.toggle('listo', listo);
  $('turboFill').style.width = (jugador.turbo * 100) + '%';
  $('gemasHud').textContent = `💎 ${tienda.gemas}`;
  if (jugador.burbuja) {
    const b = $('btnEscudo'), listoE = jugador.cdEscudo <= 0;
    b.style.setProperty('--carga', (listoE ? 100 : 100 - jugador.cdEscudo / 15 * 100) + '%');
    b.classList.toggle('listo', listoE);
  }
  if (jugador.equipo.tirador === 'rapido') $('municion').textContent = jugador.recargando > 0 ? 'RECARGANDO' : `${jugador.municion}/40`;
  if (jugador.equipo.tirador === 'ametralladora') $('municion').textContent = jugador.municion < 1 ? 'RECARGANDO...' : `${Math.floor(jugador.municion)}/20`;
  if (jugador.equipo.misiles) {
    const b = $('btnMisil'), listoM = jugador.cdMisil <= 0;
    b.style.setProperty('--carga', (listoM ? 100 : 100 - jugador.cdMisil / 6 * 100) + '%');
    b.classList.toggle('listo', listoM);
  }
}

// ============================================================
// GEMAS FLOTANDO EN LA PARTIDA
// ============================================================
const cristales = [];
const geoCristal = new THREE.OctahedronGeometry(1.8, 0);
const matCristal = new THREE.MeshBasicMaterial({ color: 0x5cffe0 });
const matCristalBorde = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
let tNuevoCristal = 0;
function nuevoCristal() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geoCristal, matCristal));
  const b = new THREE.Mesh(geoCristal, matCristalBorde); b.scale.setScalar(1.08); g.add(b);
  g.scale.set(1, 1.6, 1);
  let p;
  do { p = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * (R - 120)); }
  while (asteroides.some(a => a.mesh.position.distanceTo(p) < a.r + 6));
  g.position.copy(p);
  scene.add(g);
  cristales.push({ g, base: p.y, fase: Math.random() * 6 });
}
function crearCristales() {
  for (const c of cristales) scene.remove(c.g);
  cristales.length = 0;
  for (let i = 0; i < 10; i++) nuevoCristal();
  tNuevoCristal = 8;
}
function actualizarCristales(dt) {
  const t = performance.now() / 1000;
  for (let i = cristales.length - 1; i >= 0; i--) {
    const c = cristales[i];
    c.g.rotation.y += dt * 2;
    c.g.position.y = c.base + Math.sin(t * 2 + c.fase) * 1.5;
    if (jugador.vivo && jugador.pos.distanceTo(c.g.position) < 9) {
      scene.remove(c.g); cristales.splice(i, 1);
      sumarGemas(GEMAS_POR_CRISTAL); gemasPartida += GEMAS_POR_CRISTAL;
      explosion(c.g.position.clone(), false, 0x5cffe0);
      sonido('click'); avisar(`+${GEMAS_POR_CRISTAL} 💎`);
    }
  }
  tNuevoCristal -= dt;
  if (tNuevoCristal <= 0) { tNuevoCristal = 8; if (cristales.length < 10) nuevoCristal(); }
}

const hud2d = $('hud2d'), ctx = hud2d.getContext('2d');
function dibujarHUD2D() {
  const W = hud2d.width, H = hud2d.height, s = H / 400;
  ctx.clearRect(0, 0, W, H);
  if (estado !== 'jugando' || !jugador || !jugador.vivo) return;

  // mira
  const f = jugador.adelante(new THREE.Vector3());
  const mira = _v.copy(jugador.pos).addScaledVector(f, 80).project(camera);
  const mx = (mira.x + 1) / 2 * W, my = (1 - mira.y) / 2 * H;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.arc(mx, my, 9 * s, 0, Math.PI * 2); ctx.stroke();

  for (const n of naves) {
    if (n.esJugador || !n.vivo) continue;
    const p = _v2.copy(n.pos).project(camera);
    const detras = p.z > 1;
    let x = (p.x + 1) / 2 * W, y = (1 - p.y) / 2 * H;
    const enPantalla = !detras && x > 0 && x < W && y > 0 && y < H;
    if (enPantalla) {
      // barra de vida sobre el rival (como el dibujo)
      const dist = n.pos.distanceTo(jugador.pos);
      const ancho = THREE.MathUtils.clamp(1600 / dist, 18, 70) * s;
      const by = y - ancho * 0.55;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x - ancho / 2, by, ancho, 5 * s);
      ctx.fillStyle = '#e89cff'; ctx.fillRect(x - ancho / 2, by, ancho * n.hp / n.hpMax, 5 * s);
      if (n === objetivoFijado) {
        ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 3 * s;
        ctx.beginPath(); ctx.arc(x, y, ancho * 0.45, 0, Math.PI * 2); ctx.stroke();
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + performance.now() / 400;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * ancho * 0.55, y + Math.sin(a) * ancho * 0.55);
          ctx.lineTo(x + Math.cos(a) * ancho * 0.75, y + Math.sin(a) * ancho * 0.75);
          ctx.stroke();
        }
      }
      if (dist < 250) {
        ctx.fillStyle = '#fff'; ctx.font = `${11 * s}px Marker, sans-serif`; ctx.textAlign = 'center';
        ctx.fillText(`${n.nombre} ${'♥'.repeat(Math.max(0, n.vidas))}`, x, by - 4 * s);
      }
    } else {
      // triángulo rojo en el borde apuntando al rival
      let dx = x - W / 2, dy = y - H / 2;
      if (detras) { dx = -dx; dy = -dy; }
      const ang = Math.atan2(dy, dx);
      const m = 28 * s;
      const k = Math.min((W / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - m) / Math.abs(Math.sin(ang) || 1e-6));
      const ex = W / 2 + Math.cos(ang) * k, ey = H / 2 + Math.sin(ang) * k;
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
      ctx.fillStyle = '#e8352f'; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(16 * s, 0); ctx.lineTo(-10 * s, -11 * s); ctx.lineTo(-10 * s, 11 * s); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}

// ============================================================
// BUCLE PRINCIPAL
// ============================================================
function redimensionar() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  hud2d.width = w * dpr; hud2d.height = h * dpr;
}
window.addEventListener('resize', redimensionar);
redimensionar();

let ultimo = performance.now();
let hudT = 0;
// Calidad automática: si va lento, baja la resolución (y lo recuerda)
let fpsT = 0, fpsN = 0;
function revisarRendimiento(dtReal) {
  fpsT += dtReal; fpsN++;
  if (fpsT < 3) return;
  const fps = fpsN / fpsT;
  fpsT = 0; fpsN = 0;
  if (fps < 40 && calidad > 0.75) {
    calidad = calidad > 1 ? 1 : 0.75;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, calidad));
    redimensionar();
    try { localStorage.setItem('bis-calidad', String(calidad)); } catch (e) {}
  }
}
function bucle(ahora) {
  requestAnimationFrame(bucle);
  const dtReal = (ahora - ultimo) / 1000;
  const dt = Math.min(0.05, dtReal);
  ultimo = ahora;
  if (estado === 'jugando' && !document.hidden) revisarRendimiento(dtReal);

  for (const a of asteroides) { a.mesh.rotation.x += a.giro.x * dt; a.mesh.rotation.y += a.giro.y * dt; }

  if (estado === 'jugando') {
    if (jugador.vivo) actualizarJugador(dt);
    // reaparecer (jugador y rivales tienen las mismas vidas)
    for (const n of naves) {
      if (n.vivo || n.vidas <= 0) continue;
      n.tReaparecer -= dt;
      if (n.tReaparecer <= 0) {
        n.vivo = true; n.hp = n.hpMax; n.turbo = 1; n.lento = 0;
        n.colocarAlAzar(); n.invulnerable = 3; n.obj.visible = true;
        if (n.esJugador) { $('mensaje').textContent = ''; posicionarCamara(true); }
      }
    }
    for (const n of naves) if (!n.esJugador && n.vivo) actualizarIA(n, dt);
    especiales.actualizar(dt);
    actualizarCristales(dt);
    actualizarHaces(dt);
    actualizarBalas(dt);
    choquesNaves();
    if (jugador.vivo) posicionarCamara(false, dt);

    const rivalesVivos = naves.some(n => !n.esJugador && n.vidas > 0);
    if (!rivalesVivos || jugador.vidas <= 0) {
      tFin += dt;
      if (tFin > 1.8) terminar(!rivalesVivos && jugador.vidas > 0);
    }
    hudT -= dt;
    if (hudT <= 0) { actualizarHUD(); hudT = 0.1; }
  } else if (estado === 'menu' || estado === 'titulo') {
    // cámara girando lenta de fondo
    const t = ahora / 1000 * 0.05;
    camera.position.set(Math.sin(t) * 300, 60, Math.cos(t) * 300);
    camera.lookAt(0, 0, 0);
  }
  actualizarEfectos(dt);
  if (estado === 'editor') {
    if (modeloPreview) modeloPreview.rotation.y += dt * 0.6;
    renderer.render(escenaPreview, camPreview);
  } else renderer.render(scene, camera);
  dibujarHUD2D();
}
crearAsteroides();
requestAnimationFrame(bucle);
window.__juegoListo = true;

// ============================================================
// MENÚ Y BOTONES
// ============================================================
function pintarAjustes() {
  $('vVidas').textContent = ajustes.vidas; $('vRivales').textContent = ajustes.rivales;
  const p = pilotoPorId(ajustes.piloto);
  $('retrato').src = `img/pilotos/${p.id}.png`;
  $('pilotoNombre').textContent = p.nombre;
  $('pilotoEspecial').textContent = p.nombreEspecial;
}
pintarAjustes();

$('titulo').addEventListener('pointerdown', () => { iniciarAudio(); sonido('click'); irAlMenu(); });
for (const f of document.querySelectorAll('.flecha')) {
  f.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); iniciarAudio(); sonido('click');
    const k = f.dataset.opt;
    if (k === 'piloto') {
      const i = PILOTOS.indexOf(pilotoPorId(ajustes.piloto));
      ajustes.piloto = PILOTOS[(i + Number(f.dataset.d) + PILOTOS.length) % PILOTOS.length].id;
      pintarAjustes(); guardarAjustes();
      return;
    }
    const [mn, mx] = LIMITES[k];
    ajustes[k] += Number(f.dataset.d);
    if (ajustes[k] > mx) ajustes[k] = mn;
    if (ajustes[k] < mn) ajustes[k] = mx;
    pintarAjustes(); guardarAjustes();
  });
}
$('btnJugar').addEventListener('click', () => { iniciarAudio(); sonido('click'); nuevaPartida(); });
$('btnOtra').addEventListener('click', () => { sonido('click'); nuevaPartida(); });
$('btnMenu').addEventListener('click', () => { sonido('click'); irAlMenu(); });
$('btnCerrar').addEventListener('click', () => { sonido('click'); irAlMenu(); });
$('btnSalir').addEventListener('click', () => {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (App) App.exitApp(); else { estado = 'titulo'; mostrar('titulo'); }
});

// Botón "atrás" de Android
{
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (App) App.addListener('backButton', () => {
    if (estado === 'jugando' || estado === 'fin' || estado === 'editor' || estado === 'tienda') irAlMenu();
    else if (estado === 'menu') { estado = 'titulo'; mostrar('titulo'); }
    else App.exitApp();
  });
}

// Si se minimiza la app, se pausa el sonido
document.addEventListener('visibilitychange', () => {
  if (!actx) return;
  if (document.hidden) actx.suspend(); else actx.resume();
  input.fuego = input.turbo = false;
});

// Para pruebas
window.__juego = { get calidad() { return calidad; }, get estado() { return estado; }, naves, nuevaPartida, input };

// ============================================================
// BUSCAR ACTUALIZACIONES (consulta la última versión publicada en GitHub)
// ============================================================
const REPO = 'edoloco/battle-in-space';
const URL_APK = `https://github.com/${REPO}/releases/download/ultima/battle-in-space.apk`;
let versionActual = null, versionNueva = null;

async function leerVersionActual() {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (!App || !App.getInfo) return null;
  try { const info = await App.getInfo(); return parseInt(info.build, 10) || null; } catch (e) { return null; }
}

async function buscarActualizacion(manual) {
  const txt = $('txtActualizar'), btn = $('btnActualizar');
  if (versionNueva && manual) { descargarActualizacion(); return; }
  if (manual) txt.textContent = 'BUSCANDO...';
  try {
    if (versionActual === null) versionActual = await leerVersionActual();
    if (versionActual) $('version').textContent = 'v' + versionActual;
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/ultima`, { cache: 'no-store' });
    if (!r.ok) throw new Error('GitHub respondió ' + r.status);
    const datos = await r.json();
    const m = /v(\d+)/.exec(datos.name || '');
    const ultima = m ? parseInt(m[1], 10) : 0;
    if (versionActual === null) {
      txt.textContent = manual ? 'VERSIÓN WEB: YA ES LA ÚLTIMA' : 'BUSCAR ACTUALIZACIONES';
    } else if (ultima > versionActual) {
      versionNueva = ultima;
      txt.textContent = `¡NUEVA v${ultima}! TOCA PARA DESCARGAR`;
      btn.classList.add('nueva');
    } else if (manual) {
      txt.textContent = `TIENES LA ÚLTIMA (v${versionActual})`;
    }
  } catch (e) {
    if (manual) txt.textContent = 'SIN INTERNET, INTENTA DE NUEVO';
  }
  if (manual && !versionNueva) setTimeout(() => { if (!versionNueva) txt.textContent = 'BUSCAR ACTUALIZACIONES'; }, 4000);
}

function descargarActualizacion() {
  const Browser = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
  $('txtActualizar').textContent = 'DESCARGANDO... ABRE EL APK AL TERMINAR';
  if (Browser) Browser.open({ url: URL_APK });
  else window.open(URL_APK, '_blank');
}

$('btnActualizar').addEventListener('click', () => { iniciarAudio(); sonido('click'); buscarActualizacion(true); });
buscarActualizacion(false); // revisa sola al abrir el juego

// ============================================================
// EDITAR NAVE
// ============================================================
const escenaPreview = new THREE.Scene();
escenaPreview.background = new THREE.Color(0xffffff);
escenaPreview.add(new THREE.HemisphereLight(0xffffff, 0x8a7a96, 1.6));
{ const l = new THREE.DirectionalLight(0xffffff, 1.8); l.position.set(5, 10, 6); escenaPreview.add(l); }
const camPreview = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camPreview.position.set(9, 8, 12); camPreview.lookAt(0, 0, 0);
let modeloPreview = null;

function nombreOpcion(ranura, id) {
  if (ranura === 'central') return id ? `Nave de ${pilotoPorId(id).nombre}` : 'Nave blanca';
  if (!id) return ranura === 'tirador' ? 'Normal' : 'Ninguna';
  return (PIEZAS[ranura].find(p => p.id === id) || {}).nombre || id;
}
function opciones(ranura) {
  if (ranura === 'central') return [null, ...PILOTOS.map(p => p.id)];
  return [null, ...PIEZAS[ranura].filter(p => tienda.compradas.includes(p.id)).map(p => p.id)];
}
function pintarEditor() {
  const eq = equipoValido();
  for (const r of RANURAS) {
    const el = document.querySelector(`#ranuras [data-ranura="${r.id}"] .valor`);
    if (!el) continue;
    if (r.pronto) { el.textContent = 'PRONTO'; continue; }
    const ops = opciones(r.id);
    el.textContent = nombreOpcion(r.id, eq[r.id]) + (ops.length <= 1 ? ' (compra en la TIENDA)' : '');
  }
  if (modeloPreview) escenaPreview.remove(modeloPreview);
  const central = eq.central ? pilotoPorId(eq.central) : null;
  modeloPreview = crearModeloNave(central ? central.color : 0xf2f2f2, central ? central.acento : pilotoPorId(ajustes.piloto).acento, eq);
  modeloPreview.userData.fuego.visible = false;
  escenaPreview.add(modeloPreview);
  // la nave se ve en la mitad izquierda de la pantalla
  const w = window.innerWidth, h = window.innerHeight;
  camPreview.aspect = w / h; camPreview.setViewOffset(w, h, w * 0.22, 0, w, h); camPreview.updateProjectionMatrix();
}
function abrirEditor() { estado = 'editor'; mostrar('editor'); pintarEditor(); }

{
  const cont = $('ranuras');
  cont.innerHTML = RANURAS.map(r => `
    <div class="ranura${r.pronto ? ' pronto' : ''}" data-ranura="${r.id}">
      <div class="ranura-nombre">${r.nombre}</div>
      <div class="ranura-fila"><b class="fl" data-d="-1">&lt;</b><span class="valor"></span><b class="fl" data-d="1">&gt;</b></div>
    </div>`).join('');
  for (const fl of cont.querySelectorAll('.fl')) {
    fl.addEventListener('click', () => {
      const r = fl.closest('.ranura').dataset.ranura;
      if (RANURAS.find(x => x.id === r).pronto) return;
      sonido('click');
      const ops = opciones(r);
      const actual = equipoValido()[r];
      const i = Math.max(0, ops.indexOf(actual));
      tienda.equipo[r] = ops[(i + Number(fl.dataset.d) + ops.length) % ops.length];
      guardarTienda(); pintarEditor();
    });
  }
}
$('btnEditar').addEventListener('click', () => { iniciarAudio(); sonido('click'); abrirEditor(); });
$('btnVolverEditor').addEventListener('click', () => { sonido('click'); irAlMenu(); });
$('btnEditorTienda').addEventListener('click', () => { sonido('click'); abrirTienda(); });

// ============================================================
// TIENDA
// ============================================================
function pintarTienda() {
  $('gemasTienda').textContent = `💎 ${tienda.gemas}`;
  $('gemasMenu').textContent = `💎 ${tienda.gemas}`;
  const items = Object.keys(PIEZAS).flatMap(r => PIEZAS[r].map(p => [r, p]));
  $('productos').innerHTML = items.map(([r, p]) => {
    const tiene = tienda.compradas.includes(p.id);
    const alcanza = tienda.gemas >= p.precio;
    return `<div class="producto${tiene ? ' tiene' : ''}">
      <div class="prod-nombre">${p.nombre}</div>
      <div class="prod-desc">${p.desc}</div>
      <button class="prod-btn${!tiene && !alcanza ? ' falta' : ''}" data-id="${p.id}" data-r="${r}">${tiene ? 'COMPRADO ✓' : `💎 ${p.precio}`}</button>
    </div>`;
  }).join('');
  for (const b of $('productos').querySelectorAll('.prod-btn')) {
    b.addEventListener('click', () => {
      const p = PIEZAS[b.dataset.r].find(x => x.id === b.dataset.id);
      if (tienda.compradas.includes(p.id)) return;
      if (comprar(p)) {
        sonido('explosion', 0.3); sonido('click');
        tienda.equipo[b.dataset.r] = p.id; guardarTienda(); // se equipa sola
        $('avisoTienda').textContent = `¡Compraste ${p.nombre}! Ya está puesta en tu nave.`;
      } else {
        sonido('golpe');
        $('avisoTienda').textContent = `Te faltan ${p.precio - tienda.gemas} 💎. Derriba rivales (+${GEMAS_POR_DERRIBO}) y junta cristales (+${GEMAS_POR_CRISTAL}).`;
      }
      pintarTienda();
    });
  }
}
function abrirTienda() { estado = 'tienda'; $('avisoTienda').textContent = ''; mostrar('tienda'); pintarTienda(); }
$('btnTienda').addEventListener('click', () => { iniciarAudio(); sonido('click'); abrirTienda(); });
$('btnVolverTienda').addEventListener('click', () => { sonido('click'); irAlMenu(); });
$('btnTiendaEditor').addEventListener('click', () => { sonido('click'); abrirEditor(); });
pintarTienda();
