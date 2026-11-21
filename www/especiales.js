// Pilotos y poderes especiales — diseñados por Víctor
import * as THREE from './lib/three.module.js';

export const PILOTOS = [
  { id: 'victor', nombre: 'Víctor', especial: 'tornado', nombreEspecial: 'Tornado donde mira',
    color: 0x3fa8ff, acento: 0x9fd8ff, cd: 9 },
  { id: 'mspussles', nombre: 'Ms. Pussles', especial: 'rayos', nombreEspecial: 'Rayos donde apunta',
    color: 0x8f97a8, acento: 0x7fc6ff, cd: 7 },
  { id: 'wap', nombre: 'Wap', especial: 'bomba', nombreEspecial: 'Big Bomb verde',
    color: 0xe53935, acento: 0xffffff, cd: 10 },
  { id: 'bigbad', nombre: 'Big Bad', especial: 'huesos', nombreEspecial: 'Montón de huesos',
    color: 0x2b2b2b, acento: 0x7dff9a, cd: 6 },
  { id: 'humatered', nombre: 'Hum-ater-ed Storm', especial: 'misil', nombreEspecial: 'Misil gigante de wither',
    color: 0x3a2a48, acento: 0xd59cff, cd: 10 },
  { id: 'sumperlake', nombre: 'Sumperlake', especial: 'laser', nombreEspecial: 'Láser donde apunta',
    color: 0x252028, acento: 0xd7a3ff, cd: 9 },
  { id: 'tentaclesilla', nombre: 'Tentaclesilla Storm', especial: 'enredo', nombreEspecial: 'Rayo enredante',
    color: 0x3f8f80, acento: 0x9fffe8, cd: 11 },
];

// Distancia/ángulo que usa la máquina para decidir cuándo lanzar cada especial
export const USO_IA = {
  tornado: { dist: 220, ang: 0.3 }, rayos: { dist: 350, ang: 0.45 }, bomba: { dist: 200, ang: 0.2 },
  huesos: { dist: 170, ang: 0.2 }, misil: { dist: 420, ang: 0.8 }, laser: { dist: 320, ang: 0.15 },
  enredo: { dist: 80, ang: Math.PI },
};

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

// distancia de un punto p a un segmento a-b
function distSegmento(p, a, b) {
  _a.subVectors(b, a); _b.subVectors(p, a);
  const t = THREE.MathUtils.clamp(_b.dot(_a) / _a.lengthSq(), 0, 1);
  return _c.copy(a).addScaledVector(_a, t).distanceTo(p);
}

export function crearEspeciales({ scene, naves, asteroides, danar, explosion, sonido, jugador }) {
  const activos = [];
  const rivalesDe = (n) => naves.filter(o => o !== n && o.vivo);
  const cercaDelJugador = (pos) => { const j = jugador(); return j ? Math.max(0.15, 1 - j.pos.distanceTo(pos) / 450) : 1; };
  const tocaAsteroide = (p, extra = 0) => asteroides.some(a => a.mesh.position.distanceToSquared(p) < (a.r + extra) ** 2);

  function mejorObjetivo(n, dir, angMax, distMax) {
    let mejor = null, mejorAng = angMax;
    for (const o of rivalesDe(n)) {
      _a.subVectors(o.pos, n.pos);
      const d = _a.length();
      if (d > distMax) continue;
      const ang = dir.angleTo(_a);
      if (ang < mejorAng) { mejorAng = ang; mejor = o; }
    }
    return mejor;
  }

  function areaDano(centro, radio, dano, dueno) {
    for (const o of naves) {
      if (!o.vivo || o === dueno) continue;
      const d = o.pos.distanceTo(centro);
      if (d < radio) danar(o, dano * (1 - 0.5 * d / radio), dueno);
    }
  }

  function quitar(obj) {
    scene.remove(obj);
    obj.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material.dispose) c.material.dispose(); });
  }

  // ---------------- TORNADO (Víctor) ----------------
  function tornado(n, dir) {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const r = 2.5 + i * 1.6;
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.6, 6, 18),
        new THREE.MeshBasicMaterial({ color: 0x6fb8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = Math.PI / 2; m.position.y = -8 + i * 3.4;
      g.add(m);
    }
    g.position.copy(n.pos).addScaledVector(dir, 12);
    scene.add(g);
    const vel = dir.clone().multiplyScalar(75);
    sonido('turbo');
    return {
      t: 0, dur: 3.8, g,
      update(dt) {
        this.t += dt;
        g.position.addScaledVector(vel, dt);
        g.rotation.y += dt * 9;
        g.children.forEach((c, i) => { c.position.x = Math.sin(this.t * 6 + i) * 0.8; });
        const crece = Math.min(1, this.t * 3);
        g.scale.setScalar(crece);
        for (const o of rivalesDe(n)) {
          const d = o.pos.distanceTo(g.position);
          if (d < 20) {
            danar(o, 32 * dt, n, true);
            o.pos.lerp(g.position, Math.min(1, dt * 2.5)); // lo chupa
            o.yaw += dt * 6; // lo hace girar
          }
        }
        return this.t < this.dur;
      },
      fin() { quitar(g); },
    };
  }

  // ---------------- RAYOS (Ms. Pussles) ----------------
  function crearRayo(desde, hasta, color) {
    const pts = [];
    const pasos = 10;
    for (let i = 0; i <= pasos; i++) {
      const p = desde.clone().lerp(hasta, i / pasos);
      if (i > 0 && i < pasos) p.add(new THREE.Vector3().randomDirection().multiplyScalar(3));
      pts.push(p);
    }
    const curva = new THREE.CatmullRomCurve3(pts);
    return new THREE.Mesh(new THREE.TubeGeometry(curva, 30, 0.45, 5),
      new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  }
  function rayos(n, dir) {
    const g = new THREE.Group(); scene.add(g);
    const descarga = () => {
      if (!n.vivo) return;
      const f = n.adelante(new THREE.Vector3());
      const d0 = dir.clone().lerp(f, 0.6).normalize();
      const origen = n.pos.clone().addScaledVector(d0, 3);
      // cadena: salta de rival en rival
      let actual = mejorObjetivo(n, d0, 0.5, 380);
      const golpeados = [];
      let desde = origen, dano = 22;
      while (actual && golpeados.length < 5) {
        g.add(crearRayo(desde, actual.pos, 0x9fd8ff));
        golpeados.push(actual);
        danar(actual, dano, n);
        explosion(actual.pos.clone(), false, 0x9fd8ff);
        desde = actual.pos.clone(); dano *= 0.75;
        let sig = null, mejorD = 160;
        for (const o of rivalesDe(n)) {
          if (golpeados.includes(o)) continue;
          const dd = o.pos.distanceTo(desde);
          if (dd < mejorD) { mejorD = dd; sig = o; }
        }
        actual = sig;
      }
      // abanico de rayos hacia donde apunta
      for (let i = 0; i < 7; i++) {
        const dr = d0.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(0.28)).normalize();
        const fin = origen.clone().addScaledVector(dr, 140 + Math.random() * 140);
        g.add(crearRayo(origen, fin, i % 2 ? 0xffffff : 0x7fc6ff));
        for (const o of rivalesDe(n)) if (!golpeados.includes(o) && distSegmento(o.pos, origen, fin) < 6) danar(o, 9, n);
      }
      sonido('golpe', cercaDelJugador(origen)); sonido('laser', cercaDelJugador(origen));
    };
    descarga();
    let quedan = 2, tD = 0;
    return {
      t: 0, dur: 0.95,
      update(dt) {
        this.t += dt; tD += dt;
        if (quedan > 0 && tD > 0.28) {
          tD = 0; quedan--;
          for (const c of [...g.children]) { g.remove(c); c.geometry.dispose(); c.material.dispose(); }
          descarga();
        }
        g.children.forEach(c => c.material.opacity = Math.random() > 0.25 ? 1 : 0.2);
        return this.t < this.dur;
      },
      fin() { quitar(g); },
    };
  }

  // ---------------- BIG BOMB (Wap): bomba verde que suelta más bombas verdes ----------------
  const matBombaVerde = new THREE.MeshStandardMaterial({ color: 0x3ccf4e, roughness: 0.35, emissive: 0x0d4a14 });
  function modeloBomba(radio) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(radio, 14, 10), matBombaVerde));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(radio * 1.02, radio * 0.13, 6, 20), new THREE.MeshBasicMaterial({ color: 0xffffff })));
    const mecha = new THREE.Mesh(new THREE.SphereGeometry(radio * 0.27, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd83b }));
    mecha.position.y = radio * 1.08; g.add(mecha);
    g.userData.mecha = mecha;
    return g;
  }
  function explotarVerde(p, radio, dano, n, grande) {
    explosion(p, grande, 0x5cff6e);
    if (grande) for (let i = 0; i < 3; i++) explosion(p.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(radio * 0.3)), true, 0xb6ff5c);
    areaDano(p, radio, dano, n);
    sonido('explosion', cercaDelJugador(p) * (grande ? 1 : 0.6));
  }
  function bombita(n, pos, vel) {
    const g = modeloBomba(1.3);
    g.position.copy(pos); scene.add(g);
    const espera = 0.7 + Math.random() * 0.6;
    return {
      t: 0,
      update(dt) {
        this.t += dt;
        vel.multiplyScalar(1 - dt * 1.5);
        g.position.addScaledVector(vel, dt);
        g.rotation.x += dt * 8;
        g.userData.mecha.visible = Math.floor(this.t * 20) % 2 === 0;
        const choca = rivalesDe(n).some(o => o.pos.distanceTo(g.position) < 6);
        if (choca || this.t >= espera) { explotarVerde(g.position.clone(), 28, 32, n, false); explosion(g.position.clone(), true, 0x5cff6e); return false; }
        return true;
      },
      fin() { quitar(g); },
    };
  }
  function bomba(n, dir) {
    const g = modeloBomba(2.8);
    g.position.copy(n.pos).addScaledVector(dir, 6);
    scene.add(g);
    const vel = dir.clone().multiplyScalar(135).add(n.vel);
    return {
      t: 0, dur: 1.7,
      update(dt) {
        this.t += dt;
        g.position.addScaledVector(vel, dt);
        g.rotation.x += dt * 5; g.rotation.z += dt * 3;
        g.userData.mecha.visible = Math.floor(this.t * 14) % 2 === 0;
        const choca = rivalesDe(n).some(o => o.pos.distanceTo(g.position) < 9) || tocaAsteroide(g.position, 2);
        if (choca || this.t >= this.dur) {
          const p = g.position.clone();
          explotarVerde(p, 50, 65, n, true);
          // suelta 7 bombas verdes más
          for (let i = 0; i < 7; i++) {
            const v = new THREE.Vector3().randomDirection().multiplyScalar(45 + Math.random() * 30);
            activos.push(bombita(n, p.clone(), v));
          }
          return false;
        }
        return true;
      },
      fin() { quitar(g); },
    };
  }

  // ---------------- HUESOS (Big Bad) ----------------
  const matHueso = new THREE.MeshStandardMaterial({ color: 0xf4f1e6, roughness: 0.8 });
  const geoHuesoPalo = new THREE.CylinderGeometry(0.35, 0.35, 3, 6);
  const geoHuesoPunta = new THREE.SphereGeometry(0.6, 6, 4);
  function hueso() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geoHuesoPalo, matHueso));
    for (const y of [-1.5, 1.5]) for (const x of [-0.4, 0.4]) {
      const b = new THREE.Mesh(geoHuesoPunta, matHueso); b.position.set(x, y, 0); g.add(b);
    }
    return g;
  }
  function huesos(n, dir) {
    const lista = [];
    const lanzar = (cuantos) => {
      const d0 = n.vivo ? n.adelante(new THREE.Vector3()) : dir;
      const base = dir.clone().lerp(d0, 0.5).normalize();
      for (let i = 0; i < cuantos; i++) {
        const d = base.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(0.24)).normalize();
        const h = hueso();
        h.position.copy(n.pos).addScaledVector(d, 4 + Math.random() * 3);
        h.rotation.set(Math.random() * 6, Math.random() * 6, 0);
        scene.add(h);
        lista.push({ h, vel: d.multiplyScalar(190 + Math.random() * 60).add(n.vel), vivo: true });
      }
      sonido('laserEnemigo', cercaDelJugador(n.pos));
    };
    lanzar(10);
    let oleadas = 2, tOla = 0;
    return {
      t: 0, dur: 2.2,
      update(dt) {
        this.t += dt;
        tOla += dt;
        if (oleadas > 0 && tOla > 0.18) { tOla = 0; oleadas--; lanzar(9); }
        for (const b of lista) {
          if (!b.vivo) continue;
          b.h.position.addScaledVector(b.vel, dt);
          b.h.rotation.x += dt * 12; b.h.rotation.y += dt * 7;
          for (const o of rivalesDe(n)) {
            if (o.pos.distanceToSquared(b.h.position) < 16) {
              danar(o, 8, n); explosion(b.h.position.clone(), false, 0xf4f1e6);
              b.vivo = false; b.h.visible = false; break;
            }
          }
          if (b.vivo && tocaAsteroide(b.h.position)) { b.vivo = false; b.h.visible = false; }
        }
        return this.t < this.dur && (oleadas > 0 || lista.some(b => b.vivo));
      },
      fin() { for (const b of lista) scene.remove(b.h); },
    };
  }

  // ---------------- MISIL GIGANTE DE WITHER (Hum-ater-ed Storm) ----------------
  function misil(n, dir) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), new THREE.MeshStandardMaterial({ color: 0x241a2c, flatShading: true })));
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xe9c8ff }));
    ojo.position.set(0, 1, 3.05); ojo.scale.z = 0.3; g.add(ojo);
    const dientes = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    for (const x of [-2, -0.7, 0.7, 2]) { const d = dientes.clone(); d.position.set(x, -1.6, 3.1); d.rotation.z = Math.PI; g.add(d); }
    const fuego = new THREE.Mesh(new THREE.ConeGeometry(2, 5, 8), new THREE.MeshBasicMaterial({ color: 0xb04bff, transparent: true, opacity: 0.8 }));
    fuego.rotation.x = -Math.PI / 2; fuego.position.z = -5; g.add(fuego);
    g.position.copy(n.pos).addScaledVector(dir, 8);
    scene.add(g);
    const d = dir.clone();
    let vel = 90;
    const objetivo = mejorObjetivo(n, dir, 0.9, 500) || mejorObjetivo(n, dir, Math.PI, 600);
    sonido('turbo', cercaDelJugador(n.pos));
    return {
      t: 0, dur: 5,
      update(dt) {
        this.t += dt;
        vel = Math.min(150, vel + dt * 40);
        if (objetivo && objetivo.vivo) {
          _a.subVectors(objetivo.pos, g.position).normalize();
          d.lerp(_a, Math.min(1, dt * 2.2)).normalize();
        }
        g.position.addScaledVector(d, vel * dt);
        g.quaternion.setFromUnitVectors(_b.set(0, 0, 1), d);
        fuego.scale.set(1, 0.8 + Math.random() * 0.5, 1);
        if (Math.random() < 0.5) explosion(g.position.clone().addScaledVector(d, -5), false, 0x9b4dff);
        const choca = rivalesDe(n).some(o => o.pos.distanceTo(g.position) < 8) || tocaAsteroide(g.position, 3);
        if (choca || this.t >= this.dur) {
          const p = g.position.clone();
          explosion(p, true, 0xb04bff); explosion(p, true, 0x3a1a4a);
          areaDano(p, 42, 70, n);
          sonido('explosion', cercaDelJugador(p));
          return false;
        }
        return true;
      },
      fin() { quitar(g); },
    };
  }

  // ---------------- LÁSER (Sumperlake) ----------------
  function laser(n) {
    const LARGO = 420;
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(1, 1, LARGO, 10, 1, true);
    geo.rotateX(Math.PI / 2); geo.translate(0, 0, LARGO / 2);
    const exterior = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xb35cff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    exterior.scale.set(2.2, 2.2, 1);
    const nucleo = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    nucleo.scale.set(0.6, 0.6, 1);
    g.add(exterior, nucleo);
    scene.add(g);
    const fin = new THREE.Vector3();
    sonido('turbo', cercaDelJugador(n.pos));
    return {
      t: 0, dur: 1.8,
      update(dt) {
        this.t += dt;
        if (!n.vivo) return false;
        const f = n.adelante(new THREE.Vector3());
        g.position.copy(n.pos).addScaledVector(f, 3);
        g.quaternion.setFromUnitVectors(_b.set(0, 0, 1), f);
        const pulso = 1 + Math.sin(this.t * 40) * 0.15;
        exterior.scale.set(2.2 * pulso, 2.2 * pulso, 1);
        fin.copy(g.position).addScaledVector(f, LARGO);
        for (const o of rivalesDe(n)) if (distSegmento(o.pos, g.position, fin) < 4.5) danar(o, 60 * dt, n, true);
        return this.t < this.dur;
      },
      fin() { quitar(g); },
    };
  }

  // ---------------- RAYO ENREDANTE (Tentaclesilla Storm) ----------------
  function enredo(n) {
    const RADIO = 95;
    const g = new THREE.Group(); scene.add(g);
    const aura = new THREE.Mesh(new THREE.IcosahedronGeometry(RADIO, 1),
      new THREE.MeshBasicMaterial({ color: 0x5fe0c8, wireframe: true, transparent: true, opacity: 0.12, depthWrite: false }));
    g.add(aura);
    const lineas = [];
    const matLinea = new THREE.LineBasicMaterial({ color: 0x9fffe8, transparent: true, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 10; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 12 }, () => new THREE.Vector3()));
      const l = new THREE.Line(geo, matLinea); l.frustumCulled = false; l.visible = false;
      scene.add(l); lineas.push(l);
    }
    sonido('turbo', cercaDelJugador(n.pos));
    return {
      t: 0, dur: 4.5,
      update(dt) {
        this.t += dt;
        if (!n.vivo) return false;
        g.position.copy(n.pos); aura.rotation.y += dt; aura.rotation.x += dt * 0.6;
        aura.scale.setScalar(Math.min(1, this.t * 4));
        let k = 0;
        for (const o of rivalesDe(n)) {
          if (k >= lineas.length) break;
          const d = o.pos.distanceTo(n.pos);
          if (d > RADIO) continue;
          danar(o, 16 * dt, n, true);
          o.lento = 0.3;
          const l = lineas[k++]; l.visible = true;
          const pos = l.geometry.attributes.position;
          for (let i = 0; i < 12; i++) {
            const t = i / 11;
            _a.copy(n.pos).lerp(o.pos, t);
            const ola = Math.sin(t * Math.PI) * 4;
            _a.x += Math.sin(this.t * 12 + i) * ola; _a.y += Math.cos(this.t * 10 + i * 1.3) * ola;
            pos.setXYZ(i, _a.x, _a.y, _a.z);
          }
          pos.needsUpdate = true;
        }
        for (; k < lineas.length; k++) lineas[k].visible = false;
        return this.t < this.dur;
      },
      fin() { quitar(g); for (const l of lineas) { scene.remove(l); l.geometry.dispose(); } },
    };
  }

  const TIPOS = { tornado, rayos, bomba, huesos, misil, laser, enredo };

  return {
    usar(n, tipo, dir) {
      const fn = TIPOS[tipo];
      if (!fn) return;
      activos.push(fn(n, dir ? dir.clone() : n.adelante(new THREE.Vector3())));
    },
    actualizar(dt) {
      for (let i = activos.length - 1; i >= 0; i--) {
        if (!activos[i].update(dt)) { activos[i].fin(); activos.splice(i, 1); }
      }
    },
    limpiar() { for (const a of activos) a.fin(); activos.length = 0; },
  };
}
