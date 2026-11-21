// Battle in Space — juego de naves 3D
// Idea y diseño: Víctor. Código: Three.js (sin bundler, se carga directo).
import * as THREE from './lib/three.module.js';

// ============================================================
// AJUSTES (se guardan en el teléfono)
// ============================================================
const ajustes = { vidas: 5, rivales: 10 };
try { Object.assign(ajustes, JSON.parse(localStorage.getItem('bis-ajustes') || '{}')); } catch (e) {}
const LIMITES = { vidas: [1, 9], rivales: [1, 20] };
function guardarAjustes() { try { localStorage.setItem('bis-ajustes', JSON.stringify(ajustes)); } catch (e) {} }

const $ = (id) => document.getElementById(id);
const NOMBRES = ['Wither Storm', 'Ms. Pussles', 'Cometa', 'Zorro Rojo', 'Nebulón', 'Galaxia', 'Rayo',
  'Meteoro', 'Pulpo Espacial', 'Capitán Queso', 'Turbo', 'Asteroide', 'Plutón', 'Láser', 'Saturno',
  'Ovni', 'Marciano', 'Nova', 'Quásar', 'Eclipse'];
const COLORES = [0xff4b4b, 0xff9a2e, 0x4bd16b, 0x3fa8ff, 0xff5fd1, 0xffe14b, 0x9a6bff, 0x48e3d6];

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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
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
function crearModeloNave(color, esJugador) {
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
  g.add(new THREE.Mesh(ag, new THREE.MeshStandardMaterial({ color: esJugador ? 0xa259c0 : 0x333333, flatShading: true })));

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
  return g;
}

// ============================================================
// NAVES
// ============================================================
const naves = [];
let jugador = null;

class Nave {
  constructor(nombre, color, esJugador) {
    this.nombre = nombre; this.esJugador = esJugador; this.color = color;
    this.modelo = crearModeloNave(color, esJugador);
    this.obj = new THREE.Group(); this.obj.add(this.modelo); scene.add(this.obj);
    this.obj.rotation.order = 'YXZ';
    this.pos = this.obj.position;
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.alabeo = 0; this.giro = 0; this.giroT = 0;
    this.velocidad = esJugador ? 42 : 34;
    this.hpMax = esJugador ? 100 : 40; this.hp = this.hpMax;
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
    const v = this.velocidad * (this.usandoTurbo ? 1.9 : 1);
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
  const lados = esJ ? [-2.6, 2.6] : [0];
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

// ============================================================
// CONTROLES TÁCTILES + TECLADO
// ============================================================
const input = { x: 0, y: 0, fuego: false, turbo: false };
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
}
window.addEventListener('keydown', (e) => {
  teclas[e.code] = true;
  if (e.code === 'KeyE' || e.code === 'KeyQ') hacerGiro();
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
let vidasRestantes = 0, totalPersonas = 0, tReaparecer = 0, tFin = 0;
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
  crearAsteroides();

  jugador = new Nave('Tú', 0xf2f2f2, true);
  naves.push(jugador);
  jugador.colocarAlAzar();
  const nombres = [...NOMBRES].sort(() => Math.random() - 0.5);
  for (let i = 0; i < ajustes.rivales; i++) {
    const n = new Nave(nombres[i % nombres.length], COLORES[i % COLORES.length], false);
    naves.push(n);
    n.colocarAlAzar();
    n.cdDisparo = 2 + Math.random() * 2;
  }
  vidasRestantes = ajustes.vidas;
  totalPersonas = ajustes.rivales + 1;
  jugador.invulnerable = 3;
  tReaparecer = 0; tFin = 0;
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
  input.fuego = input.turbo = false;
  mostrar('menu');
}

function personasVivas() {
  let n = naves.filter(n => !n.esJugador && n.vivo).length;
  if (vidasRestantes > 0) n += 1;
  return n;
}

function avisar(texto) {
  const d = document.createElement('div');
  d.textContent = texto;
  const feed = $('feed');
  feed.appendChild(d);
  while (feed.children.length > 3) feed.removeChild(feed.firstChild);
  setTimeout(() => d.remove(), 3600);
}

function danar(nave, cant, atacante) {
  if (!nave.vivo || nave.invulnerable > 0) return;
  nave.hp -= cant;
  if (nave.esJugador) sonido('golpe');
  if (nave.hp <= 0) {
    nave.hp = 0; nave.vivo = false; nave.obj.visible = false;
    explosion(nave.pos.clone(), true);
    const dist = jugador ? nave.pos.distanceTo(jugador.pos) : 0;
    sonido('explosion', nave.esJugador ? 1 : Math.max(0.15, 1 - dist / 400));
    if (atacante) atacante.derribos++;
    const quien = atacante ? atacante.nombre : 'un asteroide';
    if (nave.esJugador) {
      vidasRestantes--;
      avisar(`${quien} te derribó`);
      if (vidasRestantes > 0) { tReaparecer = 2.5; $('mensaje').textContent = 'REAPARECIENDO...'; }
    } else {
      avisar(atacante && atacante.esJugador ? `¡Derribaste a ${nave.nombre}!` : `${quien} derribó a ${nave.nombre}`);
    }
    actualizarHUD();
  }
}

function terminar(gano) {
  estado = 'fin';
  const puesto = personasVivas() + (gano ? 0 : 1);
  $('finTitulo').textContent = gano ? '¡GANASTE!' : 'FIN DEL JUEGO';
  $('finTexto').innerHTML = gano
    ? `Fuiste el último en pie.<br>Derribos: ${jugador.derribos}`
    : `Quedaste en el puesto #${puesto} de ${totalPersonas}<br>Derribos: ${jugador.derribos}`;
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

  j.cdDisparo -= dt;
  if (fuego && j.cdDisparo <= 0) {
    let dir = null;
    if (objetivoFijado) {
      const d = objetivoFijado.pos.distanceTo(j.pos);
      dir = _v2.copy(objetivoFijado.pos).addScaledVector(objetivoFijado.vel, d / 280).sub(j.pos).normalize();
    }
    disparar(j, dir);
    j.cdDisparo = 0.16;
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
  $('corazones').textContent = '♥'.repeat(Math.max(0, vidasRestantes));
  $('turboFill').style.width = (jugador.turbo * 100) + '%';
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
        ctx.fillText(n.nombre, x, by - 4 * s);
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
function bucle(ahora) {
  requestAnimationFrame(bucle);
  const dt = Math.min(0.05, (ahora - ultimo) / 1000);
  ultimo = ahora;

  for (const a of asteroides) { a.mesh.rotation.x += a.giro.x * dt; a.mesh.rotation.y += a.giro.y * dt; }

  if (estado === 'jugando') {
    if (jugador.vivo) actualizarJugador(dt);
    else if (vidasRestantes > 0) {
      tReaparecer -= dt;
      if (tReaparecer <= 0) {
        jugador.vivo = true; jugador.hp = jugador.hpMax; jugador.turbo = 1;
        jugador.colocarAlAzar(); jugador.invulnerable = 3;
        $('mensaje').textContent = '';
        posicionarCamara(true);
      }
    }
    for (const n of naves) if (!n.esJugador && n.vivo) actualizarIA(n, dt);
    actualizarBalas(dt);
    choquesNaves();
    if (jugador.vivo) posicionarCamara(false, dt);

    const rivalesVivos = naves.some(n => !n.esJugador && n.vivo);
    if (!rivalesVivos || vidasRestantes <= 0) {
      tFin += dt;
      if (tFin > 1.8) terminar(!rivalesVivos && vidasRestantes > 0);
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
  renderer.render(scene, camera);
  dibujarHUD2D();
}
crearAsteroides();
requestAnimationFrame(bucle);

// ============================================================
// MENÚ Y BOTONES
// ============================================================
function pintarAjustes() { $('vVidas').textContent = ajustes.vidas; $('vRivales').textContent = ajustes.rivales; }
pintarAjustes();

$('titulo').addEventListener('pointerdown', () => { iniciarAudio(); sonido('click'); irAlMenu(); });
for (const f of document.querySelectorAll('.flecha')) {
  f.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); iniciarAudio(); sonido('click');
    const k = f.dataset.opt, [mn, mx] = LIMITES[k];
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
    if (estado === 'jugando' || estado === 'fin') irAlMenu();
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
window.__juego = { get estado() { return estado; }, naves, nuevaPartida, input };
