// CREAR MUNDO 3D — reglas de Víctor:
// arriba una tabla de formas 3D (círculo, cuadrado, rectángulo, triángulo),
// abajo una tabla de colores, y al lado tres opciones: BORRAR, PROBAR y SALIR Y GUARDAR.
import * as THREE from './lib/three.module.js';

export const FORMAS = [
  { id: 'circulo', nombre: 'Círculo', icono: '●' },
  { id: 'cuadrado', nombre: 'Cuadrado', icono: '■' },
  { id: 'rectangulo', nombre: 'Rectángulo', icono: '▬' },
  { id: 'triangulo', nombre: 'Triángulo', icono: '▲' },
];
export const COLORES = ['#e53935', '#ff9a2e', '#ffe14b', '#4bd16b', '#3fa8ff', '#9a6bff', '#ff5fd1', '#ffffff', '#8c7a96', '#2b2b2b'];
const TAMANOS = [{ n: 'CHICO', t: 14 }, { n: 'MEDIANO', t: 28 }, { n: 'GRANDE', t: 50 }, { n: 'GIGANTE', t: 90 }];
const CLAVE = 'bis-mundo';

export function cargarMundo() {
  try { const m = JSON.parse(localStorage.getItem(CLAVE) || 'null'); return Array.isArray(m) ? m : null; } catch (e) { return null; }
}
function guardarMundo(formas) { try { localStorage.setItem(CLAVE, JSON.stringify(formas)); } catch (e) {} }

// Crea la malla de una forma (se usa en el editor y en la partida)
export function mallaForma(f) {
  let geo;
  if (f.forma === 'circulo') geo = new THREE.SphereGeometry(0.5, 20, 14);
  else if (f.forma === 'cuadrado') geo = new THREE.BoxGeometry(1, 1, 1);
  else if (f.forma === 'rectangulo') geo = new THREE.BoxGeometry(2, 1, 1);
  else geo = new THREE.ConeGeometry(0.6, 1.1, 3);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: f.color, flatShading: f.forma !== 'circulo', roughness: 0.6 }));
  m.scale.setScalar(f.tam);
  m.position.set(f.x, f.y, f.z);
  if (f.forma === 'triangulo') m.position.y += f.tam * 0.05;
  return m;
}

// Zonas de choque de una forma (esferas aproximadas)
export function choquesForma(f) {
  if (f.forma === 'rectangulo') return [
    { pos: new THREE.Vector3(f.x - f.tam * 0.5, f.y, f.z), r: f.tam * 0.58 },
    { pos: new THREE.Vector3(f.x + f.tam * 0.5, f.y, f.z), r: f.tam * 0.58 },
  ];
  const r = f.forma === 'cuadrado' ? 0.62 : 0.5;
  return [{ pos: new THREE.Vector3(f.x, f.y, f.z), r: f.tam * r }];
}

export function crearEditorMundo({ renderer, R, sonido, $, alProbar, alSalir }) {
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x2a1d33);
  escena.add(new THREE.HemisphereLight(0xe6ccff, 0x3a2448, 1.5));
  { const l = new THREE.DirectionalLight(0xffffff, 1.6); l.position.set(300, 500, 200); escena.add(l); }
  escena.add(new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xc070ff, wireframe: true, transparent: true, opacity: 0.12 })));
  const grilla = new THREE.GridHelper(R * 2, 26, 0xffffff, 0x8a6aa0);
  grilla.material.transparent = true; grilla.material.opacity = 0.45;
  escena.add(grilla);
  const planoInvisible = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2), new THREE.MeshBasicMaterial({ visible: false }));
  planoInvisible.rotation.x = -Math.PI / 2; escena.add(planoInvisible);
  // la nave de muestra en el centro, para ver el tamaño
  const naveMuestra = new THREE.Mesh(new THREE.ConeGeometry(4, 9, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
  naveMuestra.rotation.x = Math.PI / 2; escena.add(naveMuestra);

  const cam = new THREE.PerspectiveCamera(55, 1, 1, 5000);
  let theta = 0.6, phi = 0.9, dist = 1050;
  const grupo = new THREE.Group(); escena.add(grupo);

  const ed = { formas: [], forma: 'cuadrado', color: COLORES[4], tam: 1, altura: 0, borrando: false };

  function camara() {
    const w = window.innerWidth, h = window.innerHeight;
    cam.aspect = w / h;
    cam.setViewOffset(w, h, w * 0.21, 0, w, h); // el mundo se ve en la parte izquierda
    cam.position.set(Math.sin(theta) * Math.sin(phi) * dist, Math.cos(phi) * dist, Math.cos(theta) * Math.sin(phi) * dist);
    cam.lookAt(0, ed.altura * 0.5, 0);
    cam.updateProjectionMatrix();
  }

  function redibujar() {
    for (const c of [...grupo.children]) { grupo.remove(c); c.geometry.dispose(); c.material.dispose(); }
    ed.formas.forEach((f, i) => { const m = mallaForma(f); m.userData.i = i; grupo.add(m); });
    grilla.position.y = ed.altura; planoInvisible.position.y = ed.altura;
    $('mundoCuenta').textContent = `${ed.formas.length} formas`;
  }

  function pintarPanel() {
    for (const b of document.querySelectorAll('#tablaFormas button')) b.classList.toggle('sel', b.dataset.f === ed.forma);
    for (const b of document.querySelectorAll('#tablaColores button')) b.classList.toggle('sel', b.dataset.c === ed.color);
    $('vTamano').textContent = TAMANOS[ed.tam].n;
    $('vAltura').textContent = ed.altura > 0 ? `+${ed.altura}` : String(ed.altura);
    $('btnBorrarForma').classList.toggle('activo', ed.borrando);
    $('ayudaMundo').textContent = ed.borrando ? 'Toca una forma para borrarla' : 'Toca la grilla para poner la forma · arrastra para girar';
  }

  // tablas del panel
  $('tablaFormas').innerHTML = FORMAS.map(f => `<button data-f="${f.id}"><span>${f.icono}</span><small>${f.nombre}</small></button>`).join('');
  $('tablaColores').innerHTML = COLORES.map(c => `<button data-c="${c}" style="background:${c}"></button>`).join('');
  for (const b of document.querySelectorAll('#tablaFormas button')) b.addEventListener('click', () => { sonido('click'); ed.forma = b.dataset.f; ed.borrando = false; pintarPanel(); });
  for (const b of document.querySelectorAll('#tablaColores button')) b.addEventListener('click', () => { sonido('click'); ed.color = b.dataset.c; ed.borrando = false; pintarPanel(); });
  for (const b of document.querySelectorAll('[data-mundo]')) b.addEventListener('click', () => {
    sonido('click');
    const d = Number(b.dataset.d);
    if (b.dataset.mundo === 'tam') ed.tam = (ed.tam + d + TAMANOS.length) % TAMANOS.length;
    else { ed.altura = THREE.MathUtils.clamp(ed.altura + d * 40, -320, 320); redibujar(); }
    pintarPanel();
  });
  $('btnBorrarForma').addEventListener('click', () => { sonido('click'); ed.borrando = !ed.borrando; pintarPanel(); });
  $('btnProbarMundo').addEventListener('click', () => { sonido('click'); alProbar(ed.formas.map(f => ({ ...f }))); });
  $('btnGuardarMundo').addEventListener('click', () => { sonido('click'); guardarMundo(ed.formas); alSalir(); });

  // tocar / arrastrar sobre la vista
  const vista = $('vistaMundo');
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let toque = null;
  vista.addEventListener('pointerdown', (e) => { vista.setPointerCapture(e.pointerId); toque = { x: e.clientX, y: e.clientY, movio: false, th: theta, ph: phi }; });
  vista.addEventListener('pointermove', (e) => {
    if (!toque) return;
    const dx = e.clientX - toque.x, dy = e.clientY - toque.y;
    if (Math.hypot(dx, dy) > 8) toque.movio = true;
    if (toque.movio) {
      theta = toque.th - dx * 0.008;
      phi = THREE.MathUtils.clamp(toque.ph - dy * 0.006, 0.15, 1.5);
      camara();
    }
  });
  vista.addEventListener('pointerup', (e) => {
    if (!toque) return;
    const fueToque = !toque.movio; toque = null;
    if (!fueToque) return;
    ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    if (ed.borrando) {
      const hit = ray.intersectObjects(grupo.children)[0];
      if (hit) { ed.formas.splice(hit.object.userData.i, 1); sonido('golpe'); redibujar(); }
      return;
    }
    const hit = ray.intersectObject(planoInvisible)[0];
    if (!hit) return;
    const p = hit.point;
    if (Math.hypot(p.x, p.z, p.y) > R - 25) { sonido('golpe'); return; }
    if (Math.hypot(p.x, p.y, p.z) < 30) { $('ayudaMundo').textContent = 'El centro queda libre para las naves'; return; }
    if (ed.formas.length >= 120) { $('ayudaMundo').textContent = 'Máximo 120 formas'; return; }
    ed.formas.push({ forma: ed.forma, color: ed.color, tam: TAMANOS[ed.tam].t, x: Math.round(p.x), y: ed.altura, z: Math.round(p.z) });
    sonido('click'); redibujar();
  });
  vista.addEventListener('wheel', (e) => { dist = THREE.MathUtils.clamp(dist + e.deltaY, 350, 1700); camara(); }, { passive: true });
  $('btnZoomMas').addEventListener('click', () => { dist = Math.max(350, dist - 200); camara(); });
  $('btnZoomMenos').addEventListener('click', () => { dist = Math.min(1700, dist + 200); camara(); });

  return {
    abrir(formasEnCurso) {
      ed.formas = formasEnCurso || cargarMundo() || [];
      ed.borrando = false;
      camara(); redibujar(); pintarPanel();
    },
    formasActuales: () => ed.formas,
    render() { renderer.render(escena, cam); },
    redimensionar: camara,
  };
}
