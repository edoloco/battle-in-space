// Tienda, gemas y piezas de la nave — diseñado por Víctor
// Precios y efectos tal como él los describió.

export const PIEZAS = {
  elitras: [
    { id: 'simples', nombre: 'Élitras simples', desc: 'La nave se hace más liviana y más rápida', precio: 100 },
    { id: 'protectoras', nombre: 'Élitras protectoras', desc: 'Poder de escudo por tiempo limitado', precio: 309 },
    { id: 'pesadas', nombre: 'Élitras pesadas', desc: 'Más lenta, pero se defiende mucho mejor', precio: 500 },
    { id: 'avanzadas', nombre: 'Élitras avanzadas', desc: 'Botón ⚡ que te hace más rápido por 10 segundos', precio: 400 },
    { id: 'protectoras2', nombre: 'Élitras protectoras 2', desc: 'Escudo más fuerte que dura más segundos', precio: 480 },
  ],
  tirador: [
    { id: 'triple', nombre: 'Tirador de fuego triple', desc: 'Dispara tres láseres a la vez', precio: 260 },
    { id: 'rapido', nombre: 'Tirador de fuego rápido', desc: 'Muy rápido, pero hay que recargar', precio: 100 },
    { id: 'laser', nombre: 'Tirador de fuego láser', desc: 'Tira un láser muy largo que dura poco', precio: 480 },
    { id: 'ametralladora', nombre: 'Ametralladora láser', desc: 'Chain gun amarilla: 150 disparos seguidos; se recarga sola mientras no la usas', precio: 701 },
  ],
  misiles: [
    { id: 'triplesVerdes', nombre: 'Misiles triples verdes', desc: 'Tres misiles verdes que se esparcen', precio: 100 },
    { id: 'arcoiris', nombre: 'Proyectiles arcoíris', desc: 'Si le das a una nave, explota con arcoíris y brillantina', precio: 690 },
  ],
};

export const RANURAS = [
  { id: 'elitras', nombre: 'ÉLITRAS' },
  { id: 'central', nombre: 'ZONA CENTRAL' },
  { id: 'tirador', nombre: 'TIRADOR DE FUEGO' },
  { id: 'misiles', nombre: 'MISILES' },
];

// Ítems que se gastan (se pueden comprar varias veces)
export const CONSUMIBLES = [
  { id: 'botiquin', nombre: 'Botiquín de energía', desc: 'Botón 🩹 en la partida: recupera parte de tu energía', precio: 50 },
];

export const GEMAS_POR_DERRIBO = 5;
export const GEMAS_POR_CRISTAL = 2;

const CLAVE = 'bis-tienda';
// se empieza el juego con 5 gemas
export const tienda = { gemas: 5, compradas: [], botiquines: 0, equipo: { elitras: null, tirador: null, central: null, misiles: null } };
try {
  const g = JSON.parse(localStorage.getItem(CLAVE) || '{}');
  if (typeof g.gemas === 'number') tienda.gemas = g.gemas;
  if (Array.isArray(g.compradas)) tienda.compradas = g.compradas;
  if (typeof g.botiquines === 'number') tienda.botiquines = g.botiquines;
  if (g.equipo) Object.assign(tienda.equipo, g.equipo);
} catch (e) {}

export function guardarTienda() {
  try { localStorage.setItem(CLAVE, JSON.stringify(tienda)); } catch (e) {}
}

export function sumarGemas(n) { tienda.gemas += n; guardarTienda(); }

export function comprar(pieza) {
  if (tienda.compradas.includes(pieza.id) || tienda.gemas < pieza.precio) return false;
  tienda.gemas -= pieza.precio;
  tienda.compradas.push(pieza.id);
  guardarTienda();
  return true;
}

export function comprarConsumible(c) {
  if (tienda.gemas < c.precio) return false;
  tienda.gemas -= c.precio;
  tienda.botiquines += 1;
  guardarTienda();
  return true;
}

export const pieza = (ranura, id) => (PIEZAS[ranura] || []).find(p => p.id === id) || null;
