// JUGAR EN LÍNEA — salas con código, hasta 8 jugadores.
// Usa PeerJS (WebRTC): internet solo para encontrarse; el juego va directo entre los teléfonos.
// Topología: el anfitrión (host) está conectado con todos y reenvía los mensajes.

const PREFIJO = 'battleinspace-edoloco-';
export const MAX_JUGADORES = 8;
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I ni O para no confundir

export const red = {
  activa: false, host: false, miId: null, codigo: null,
  sala: [],                                  // [{ id, nombre, piloto, equipo }]
  ajustes: { modo: 'todos', bots: 4, vidas: 5 },
  enJuego: false,
  peer: null, conns: new Map(), conn: null,
  cb: {},
};

function opcionesPeer() {
  // para pruebas: ?peerhost=localhost&peerport=9000 usa un servidor propio
  const q = new URLSearchParams(location.search);
  const o = { debug: 0 };
  if (q.get('peerhost')) Object.assign(o, { host: q.get('peerhost'), port: Number(q.get('peerport')) || 9000, path: '/', secure: false });
  return o;
}
const ClasePeer = () => (window.peerjs && window.peerjs.Peer) || window.Peer;
const codigoAlAzar = () => Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');

function error(txt) { if (red.cb.onError) red.cb.onError(txt); }

function mensajeError(e) {
  const t = e && e.type;
  if (t === 'peer-unavailable') return 'No existe una sala con ese código';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Sin conexión a internet';
  if (t === 'browser-incompatible') return 'Este teléfono no permite jugar en línea';
  return 'Error de conexión' + (t ? ` (${t})` : '');
}

// ---------------- ANFITRIÓN ----------------
export function crearSala(yo, cb, intento = 0) {
  salir();
  red.cb = cb;
  const Peer = ClasePeer();
  if (!Peer) { error('Falta la librería de red'); return; }
  const codigo = codigoAlAzar();
  const peer = new Peer(PREFIJO + codigo, opcionesPeer());
  red.peer = peer;
  peer.on('open', (id) => {
    Object.assign(red, { activa: true, host: true, miId: id, codigo, enJuego: false });
    red.sala = [{ id, ...yo }];
    enviarSala();
  });
  peer.on('connection', (conn) => {
    conn.on('data', (m) => alRecibirHost(conn, m));
    conn.on('close', () => quitarJugador(conn.peer));
    conn.on('error', () => quitarJugador(conn.peer));
  });
  peer.on('error', (e) => {
    if (e.type === 'unavailable-id' && intento < 5) { crearSala(yo, cb, intento + 1); return; }
    error(mensajeError(e));
  });
  peer.on('disconnected', () => { if (red.activa && !peer.destroyed) peer.reconnect(); });
}

function alRecibirHost(conn, m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hola') {
    if (red.sala.length >= MAX_JUGADORES) { conn.send({ t: 'lleno', txt: 'La sala está llena (máximo 8)' }); setTimeout(() => conn.close(), 300); return; }
    if (red.enJuego) { conn.send({ t: 'lleno', txt: 'La partida ya empezó, espera a que termine' }); setTimeout(() => conn.close(), 300); return; }
    red.conns.set(conn.peer, conn);
    red.sala = red.sala.filter(j => j.id !== conn.peer);
    red.sala.push({ id: conn.peer, nombre: String(m.nombre || 'Jugador').slice(0, 14), piloto: m.piloto, equipo: m.equipo || {} });
    enviarSala();
    return;
  }
  if (!red.conns.has(conn.peer)) return;
  if (m.t === 'yo') { if (red.cb.onEstado) red.cb.onEstado([m.s]); return; }
  if (m.t === 'ev') {
    for (const [id, c] of red.conns) if (id !== conn.peer && c.open) c.send(m); // reenviar a los demás
    if (red.cb.onEvento) red.cb.onEvento(m.ev);
  }
}

function quitarJugador(id) {
  if (!red.conns.has(id)) return;
  red.conns.delete(id);
  red.sala = red.sala.filter(j => j.id !== id);
  enviarSala();
  if (red.cb.onEvento) red.cb.onEvento({ tipo: 'seFue', id });
  difundir({ t: 'ev', ev: { tipo: 'seFue', id } });
}

function difundir(m) { for (const c of red.conns.values()) if (c.open) c.send(m); }

export function enviarSala() {
  if (!red.host) return;
  difundir({ t: 'sala', sala: red.sala, ajustes: red.ajustes, codigo: red.codigo });
  if (red.cb.onSala) red.cb.onSala();
}

export function empezarPartida(info) { // solo anfitrión
  red.enJuego = true;
  difundir({ t: 'inicio', info });
  if (red.cb.onInicio) red.cb.onInicio(info);
}
export function volverASala() { red.enJuego = false; if (red.host) difundir({ t: 'aSala' }); }

// ---------------- INVITADO ----------------
export function unirse(codigo, yo, cb) {
  salir();
  red.cb = cb;
  const Peer = ClasePeer();
  if (!Peer) { error('Falta la librería de red'); return; }
  const peer = new Peer(undefined, opcionesPeer());
  red.peer = peer;
  peer.on('open', (id) => {
    red.miId = id;
    const conn = peer.connect(PREFIJO + codigo.toUpperCase(), { reliable: true });
    red.conn = conn;
    const espera = setTimeout(() => { if (!red.activa) error('No se pudo conectar a la sala'); }, 12000);
    conn.on('open', () => {
      clearTimeout(espera);
      Object.assign(red, { activa: true, host: false, codigo: codigo.toUpperCase() });
      conn.send({ t: 'hola', ...yo });
    });
    conn.on('data', (m) => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'sala') { red.sala = m.sala; red.ajustes = m.ajustes; if (red.cb.onSala) red.cb.onSala(); }
      else if (m.t === 'inicio') { red.enJuego = true; if (red.cb.onInicio) red.cb.onInicio(m.info); }
      else if (m.t === 'estado') { if (red.cb.onEstado) red.cb.onEstado(m.n); }
      else if (m.t === 'ev') { if (red.cb.onEvento) red.cb.onEvento(m.ev); }
      else if (m.t === 'aSala') { red.enJuego = false; if (red.cb.onASala) red.cb.onASala(); }
      else if (m.t === 'lleno') { error(m.txt); salir(); }
    });
    conn.on('close', () => { if (red.activa) { const cb = red.cb; salir(); if (cb.onCerrado) cb.onCerrado('El anfitrión cerró la sala'); } });
  });
  peer.on('error', (e) => error(mensajeError(e)));
}

// ---------------- COMÚN ----------------
export function enviarEstado(lista) { // host: todas las naves · invitado: solo la suya
  if (!red.activa) return;
  if (red.host) difundir({ t: 'estado', n: lista });
  else if (red.conn && red.conn.open) red.conn.send({ t: 'yo', s: lista[0] });
}
export function enviarEv(ev) {
  if (!red.activa) return;
  if (red.host) difundir({ t: 'ev', ev });
  else if (red.conn && red.conn.open) red.conn.send({ t: 'ev', ev });
}

export function salir() {
  red.activa = false; red.enJuego = false;
  try { if (red.conn) red.conn.close(); } catch (e) {}
  for (const c of red.conns.values()) { try { c.close(); } catch (e) {} }
  red.conns.clear(); red.conn = null;
  try { if (red.peer) red.peer.destroy(); } catch (e) {}
  red.peer = null; red.host = false; red.sala = []; red.codigo = null; red.miId = null;
}
