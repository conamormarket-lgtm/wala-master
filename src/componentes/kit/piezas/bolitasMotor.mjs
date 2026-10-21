/*
 * El motor de Las Bolitas de Kapi (/ball-sort): las reglas, los niveles, los
 * obstáculos y el solucionador. Puro (sin React): se prueba con
 * `node --test` (bolitasMotor.test.mjs).
 *
 * Un estado es { capacidad, tubos, cortinas }:
 *  - tubos: [[bola]], cada tubo de abajo hacia arriba
 *  - cortinas: por tubo, el color que lo abre (índice) o null si está abierto
 * Una bola es { id, c, oculta, hielo }:
 *  - c: índice del color en COLORES
 *  - oculta: se ve como "?" hasta que queda arriba de su tubo
 *  - hielo: movimientos que faltan para que se derrita (0, libre)
 *
 * Un movimiento lleva todas las bolitas de arriba del mismo color que quepan
 * (no una sola). Los niveles salen siempre iguales para el mismo número (o el
 * mismo día, en el reto) y el solucionador comprueba que tengan solución.
 */

export const CAPACIDAD = 4;

/** Los colores, en el orden en que entran a los niveles. */
export const COLORES = [
  { hex: '#ef4444', nombre: 'rojo' },
  { hex: '#3b82f6', nombre: 'azul' },
  { hex: '#10b981', nombre: 'verde' },
  { hex: '#facc15', nombre: 'amarillo' },
  { hex: '#8b5cf6', nombre: 'morado' },
  { hex: '#f97316', nombre: 'naranja' },
  { hex: '#ec4899', nombre: 'rosado' },
  { hex: '#38bdf8', nombre: 'celeste' },
  { hex: '#92400e', nombre: 'marrón' },
  { hex: '#a3e635', nombre: 'lima' },
  { hex: '#64748b', nombre: 'gris' },
  { hex: '#f8fafc', nombre: 'blanco' },
];

/** El primer nivel con cada obstáculo (ahí se explica). */
export const PRIMER_NIVEL = { ocultas: 12, cortina: 25, hielo: 40 };

/* ── Azar con semilla ─────────────────────────────────── */

/** Un número de 32 bits a partir de un texto (FNV-1a). */
export function semillaDe(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Números entre 0 y 1 que se repiten con la misma semilla (mulberry32). */
export function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entero = (rnd, min, max) => min + Math.floor(rnd() * (max - min + 1));

function barajar(lista, rnd) {
  for (let i = lista.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

/* ── Reglas ───────────────────────────────────────────── */

const arriba = (tubo) => tubo[tubo.length - 1];

/** Un tubo está listo con todas sus bolitas del mismo color. */
export const tuboListo = (tubo, capacidad = CAPACIDAD) => tubo.length === capacidad && tubo.every((b) => b.c === tubo[0].c);

/** ¿El tubo sigue tras su cortina? */
export const cerrado = (estado, i) => estado.cortinas?.[i] != null;

/** Cuántas bolitas de arriba se moverían juntas (mismo color, sin hielo). */
export function tramo(tubo) {
  let k = 0;
  const color = arriba(tubo)?.c;
  for (let j = tubo.length - 1; j >= 0; j -= 1) {
    if (tubo[j].c !== color || tubo[j].hielo > 0) break;
    k += 1;
  }
  return k;
}

/** ¿Se puede mover de `de` a `a`? (abiertos, algo que mover sin hielo, cabe, y vacío o del mismo color) */
export function puedeMover(estado, de, a) {
  if (de == null || a == null || de === a) return false;
  if (cerrado(estado, de) || cerrado(estado, a)) return false;
  const origen = estado.tubos[de];
  const destino = estado.tubos[a];
  if (!origen?.length || !destino || !tramo(origen) || destino.length >= estado.capacidad) return false;
  return !destino.length || arriba(destino).c === arriba(origen).c;
}

/** Lo que pasa después de cada movimiento: el hielo se derrite, se ve la de arriba y se abren las cortinas. */
function asentar(tubos, cortinas, capacidad, derretir) {
  const sig = tubos.map((t) => t.map((b) => (derretir && b.hielo > 0 ? { ...b, hielo: b.hielo - 1 } : b)));
  const abiertas = cortinas.map((color, i) => {
    if (color == null) return null;
    const hecho = sig.some((t, j) => j !== i && cortinas[j] == null && tuboListo(t, capacidad) && t[0].c === color);
    return hecho ? null : color;
  });
  sig.forEach((t, i) => {
    const b = arriba(t);
    if (b?.oculta && abiertas[i] == null) t[t.length - 1] = { ...b, oculta: false };
  });
  return { capacidad, tubos: sig, cortinas: abiertas };
}

/**
 * Mueve de `de` a `a` (sin mirar las reglas: antes, puedeMover).
 * Devuelve el estado nuevo; `movidas` dice cuántas bolitas viajaron.
 */
export function mover(estado, de, a) {
  const tubos = estado.tubos.map((t) => [...t]);
  const n = Math.min(tramo(tubos[de]), estado.capacidad - tubos[a].length);
  tubos[a].push(...tubos[de].splice(tubos[de].length - n, n));
  return { ...asentar(tubos, estado.cortinas, estado.capacidad, true), movidas: n };
}

/** El nivel está resuelto cuando cada tubo con bolitas está listo. */
export const resuelto = (estado) => estado.tubos.every((t) => !t.length || tuboListo(t, estado.capacidad));

/** Cuántos tubos están listos (el progreso del nivel). */
export const tubosListos = (estado) => estado.tubos.filter((t, i) => !cerrado(estado, i) && tuboListo(t, estado.capacidad)).length;

/** ¿Queda algún movimiento posible? */
export function hayMovimientos(estado) {
  const n = estado.tubos.length;
  for (let de = 0; de < n; de += 1) {
    for (let a = 0; a < n; a += 1) if (puedeMover(estado, de, a)) return true;
  }
  return false;
}

/** Un tubo vacío más (la ayuda "Añadir tubo"). */
export const agregarTubo = (estado) => ({ ...estado, tubos: [...estado.tubos, []], cortinas: [...estado.cortinas, null] });

/**
 * Deshacer vuelve al estado de antes, pero lo que ya se vio queda a la
 * vista: una bolita "?" que se descubrió no se vuelve a tapar.
 */
export function volverA(anterior, actual) {
  const vistas = new Set(actual.tubos.flat().filter((b) => !b.oculta).map((b) => b.id));
  return { ...anterior, tubos: anterior.tubos.map((t) => t.map((b) => (b.oculta && vistas.has(b.id) ? { ...b, oculta: false } : b))) };
}

/* ── Solucionador ─────────────────────────────────────── */

/*
 * Búsqueda en profundidad con memoria de lo visitado: prueba primero lo que
 * suele llevar a la solución (juntar con su color, mejor en un tubo de un
 * solo color) y descarta lo inútil (sacar de un tubo listo, pasar un tubo de
 * un solo color a uno vacío). No busca la solución más corta: busca una, y
 * rápido. Trabaja con números: color + 1 y el hielo en los bits de arriba.
 */

const COLOR = 31;
const HIELO = 5;

function compacto(estado) {
  return {
    tubos: estado.tubos.map((t) => t.map((b) => (b.c + 1) | ((b.hielo > 0 ? b.hielo : 0) << HIELO))),
    cortinas: estado.cortinas.map((c) => (c == null ? -1 : c + 1)),
  };
}

// Los tubos dan igual en qué orden estén: la clave los ordena (un carácter por bola).
function clave(s) {
  const partes = s.tubos.map((t, i) => String.fromCharCode(s.cortinas[i] + 2, ...t.map((v) => v + 48)));
  return partes.sort().join('|');
}

const listoC = (t, cap) => t.length === cap && t.every((v) => (v & COLOR) === (t[0] & COLOR));

function tramoC(t) {
  let k = 0;
  const color = t[t.length - 1] & COLOR;
  for (let j = t.length - 1; j >= 0; j -= 1) {
    if ((t[j] & COLOR) !== color || t[j] >> HIELO) break;
    k += 1;
  }
  return k;
}

function moverC(s, de, a, cap) {
  const tubos = s.tubos.map((t) => [...t]);
  const n = Math.min(tramoC(tubos[de]), cap - tubos[a].length);
  tubos[a].push(...tubos[de].splice(tubos[de].length - n, n));
  for (const t of tubos) {
    for (let j = 0; j < t.length; j += 1) if (t[j] >> HIELO) t[j] -= 1 << HIELO;
  }
  const cortinas = s.cortinas.map((c, i) => {
    if (c < 0) return c;
    const hecho = tubos.some((t, j) => j !== i && s.cortinas[j] < 0 && listoC(t, cap) && (t[0] & COLOR) === c);
    return hecho ? -1 : c;
  });
  return { tubos, cortinas };
}

const resueltoC = (s, cap) => s.tubos.every((t) => !t.length || listoC(t, cap));

function candidatos(s, cap) {
  const lista = [];
  const n = s.tubos.length;
  for (let de = 0; de < n; de += 1) {
    const origen = s.tubos[de];
    if (s.cortinas[de] >= 0 || !origen.length || listoC(origen, cap)) continue;
    const r = tramoC(origen);
    if (!r) continue;
    const color = origen[origen.length - 1] & COLOR;
    const unColor = r === origen.length;
    let vacioVisto = false;
    for (let a = 0; a < n; a += 1) {
      if (a === de || s.cortinas[a] >= 0) continue;
      const destino = s.tubos[a];
      if (destino.length >= cap) continue;
      if (!destino.length) {
        // Los tubos vacíos abiertos dan lo mismo: basta con probar uno.
        if (unColor || vacioVisto) continue;
        vacioVisto = true;
        lista.push([de, a, 1]);
        continue;
      }
      if ((destino[destino.length - 1] & COLOR) !== color) continue;
      const destinoUnColor = destino.every((v) => (v & COLOR) === color);
      // Pasar un tubo de un solo color a otro que no lo es no sirve.
      if (unColor && !destinoUnColor) continue;
      lista.push([de, a, 3 + (destinoUnColor ? 2 : 0) + (cap - destino.length >= r ? 1 : 0)]);
    }
  }
  return lista.sort((x, y) => y[2] - x[2]);
}

/**
 * Una solución desde `estado`: [[de, a], …], [] si ya está resuelto o null si
 * no hay (o si no la encuentra antes de `limite` estados).
 */
export function resolver(estado, { limite = 150000 } = {}) {
  const cap = estado.capacidad;
  const inicio = compacto(estado);
  if (resueltoC(inicio, cap)) return [];
  const vistos = new Set([clave(inicio)]);
  const pila = [{ s: inicio, opciones: candidatos(inicio, cap), k: 0 }];
  const camino = [];
  while (pila.length) {
    const nodo = pila[pila.length - 1];
    if (nodo.k >= nodo.opciones.length) {
      pila.pop();
      camino.pop();
      continue;
    }
    const [de, a] = nodo.opciones[nodo.k];
    nodo.k += 1;
    const sig = moverC(nodo.s, de, a, cap);
    const k = clave(sig);
    if (vistos.has(k)) continue;
    vistos.add(k);
    if (vistos.size > limite) return null;
    camino.push([de, a]);
    if (resueltoC(sig, cap)) return camino;
    pila.push({ s: sig, opciones: candidatos(sig, cap), k: 0 });
  }
  return null;
}

/** La pista: el siguiente movimiento de una solución, o null si desde aquí no hay. */
export function pista(estado, opciones) {
  const sol = resolver(estado, opciones);
  return sol?.length ? sol[0] : null;
}

/* ── Niveles ──────────────────────────────────────────── */

// Colores de los niveles 1 a 10 (el aprendizaje).
const APRENDIZAJE = [2, 3, 3, 4, 4, 5, 5, 6, 6, 7];

/**
 * La curva de dificultad (la misma forma que el juego de referencia): del 1
 * al 10 se aprende (2 a 7 colores), sube hasta el 100 y desde ahí se queda
 * entre 9 y 12 colores con 2 tubos vacíos; lo que cambia son los obstáculos.
 */
export function coloresDelNivel(n, rnd) {
  if (n <= APRENDIZAJE.length) return APRENDIZAJE[n - 1];
  if (n <= 50) return 5 + Math.floor((n - 11) / 20) + entero(rnd, 0, 1);
  if (n <= 100) return 7 + Math.floor((n - 51) / 25) + entero(rnd, 0, 1);
  return 9 + entero(rnd, 0, 3);
}

/**
 * Los obstáculos de un nivel. El primero de cada uno va solo (se explica);
 * después vuelven cada tanto y, más adelante, se juntan.
 */
export function obstaculosDelNivel(n) {
  const primero = Object.entries(PRIMER_NIVEL).find(([, nivel]) => nivel === n);
  if (primero) return [primero[0]];
  const lista = [];
  if (n > PRIMER_NIVEL.ocultas && n % 4 === 0) lista.push('ocultas');
  if (n > PRIMER_NIVEL.cortina && n % 6 === 1) lista.push('cortina');
  if (n > PRIMER_NIVEL.hielo && n % 7 === 5) lista.push('hielo');
  return lista;
}

function repartir({ colores, vacios, capacidad, rnd }) {
  const bolas = [];
  for (let c = 0; c < colores; c += 1) {
    for (let k = 0; k < capacidad; k += 1) bolas.push({ id: `${c}-${k}`, c, oculta: false, hielo: 0 });
  }
  barajar(bolas, rnd);
  const llenos = Array.from({ length: colores }, (_, t) => bolas.slice(t * capacidad, (t + 1) * capacidad));
  return [...llenos, ...Array.from({ length: vacios }, () => [])];
}

function ponerObstaculos(tubos, obstaculos, { capacidad, rnd, intro }) {
  const cortinas = tubos.map(() => null);
  const llenos = tubos.map((t, i) => (t.length ? i : -1)).filter((i) => i >= 0);
  if (obstaculos.includes('cortina')) {
    const cuantas = !intro && llenos.length >= 10 && rnd() < 0.35 ? 2 : 1;
    const elegidos = barajar([...llenos], rnd).slice(0, cuantas);
    const usados = new Set();
    for (const i of elegidos) {
      // El color que la abre no puede estar adentro: nunca se completaría.
      const adentro = new Set(tubos[i].map((b) => b.c));
      const posibles = [...new Set(tubos.flat().map((b) => b.c))].filter((c) => !adentro.has(c) && !usados.has(c));
      if (!posibles.length) continue;
      const color = posibles[entero(rnd, 0, posibles.length - 1)];
      usados.add(color);
      cortinas[i] = color;
    }
  }
  if (obstaculos.includes('hielo')) {
    const cuantas = intro ? 2 : entero(rnd, 2, 4);
    const bolas = barajar(llenos.filter((i) => cortinas[i] == null).flatMap((i) => tubos[i].map((b, k) => [i, k])), rnd).slice(0, cuantas);
    for (const [i, k] of bolas) tubos[i][k] = { ...tubos[i][k], hielo: entero(rnd, 4, 8) };
  }
  if (obstaculos.includes('ocultas')) {
    for (const i of llenos) {
      for (let k = 0; k < tubos[i].length - 1; k += 1) {
        if (intro || rnd() < 0.6) tubos[i][k] = { ...tubos[i][k], oculta: true };
      }
    }
  }
  return { capacidad, tubos, cortinas };
}

/**
 * Arma un nivel con solución: reparte, pone los obstáculos y lo resuelve. Si
 * no tiene solución (o empieza con un tubo ya listo), vuelve a repartir con
 * la siguiente semilla. Siempre sale igual para la misma `semilla`.
 */
export function armarNivel({ semilla, colores, vacios = 2, obstaculos = [], capacidad = CAPACIDAD, intro = false, limite }) {
  for (let intento = 0; intento < 40; intento += 1) {
    const rnd = azar(semillaDe(`${semilla}#${intento}`));
    const tubos = repartir({ colores, vacios, capacidad, rnd });
    if (tubos.some((t) => tuboListo(t, capacidad))) continue;
    const armado = ponerObstaculos(tubos, obstaculos, { capacidad, rnd, intro });
    const estado = asentar(armado.tubos, armado.cortinas, capacidad, false);
    const solucion = resolver(estado, { limite });
    if (solucion) return { estado, solucion, obstaculos };
  }
  // Muy raro: con un tubo vacío más y sin obstáculos siempre se puede.
  if (vacios > 4) throw new Error(`Bolitas: no se pudo armar el nivel ${semilla}`);
  return armarNivel({ semilla: `${semilla}+`, colores, vacios: vacios + 1, capacidad, limite });
}

/** El nivel `n` de la progresión (1, 2, 3…): siempre el mismo. */
export function nivel(n) {
  const rnd = azar(semillaDe(`nivel:${n}`));
  const colores = Math.min(coloresDelNivel(n, rnd), COLORES.length);
  const obstaculos = obstaculosDelNivel(n);
  const intro = Object.values(PRIMER_NIVEL).includes(n);
  return { numero: n, colores, ...armarNivel({ semilla: `nivel:${n}`, colores, vacios: n === 1 ? 1 : 2, obstaculos, intro }) };
}

/** El reto del día (`fecha` como 'AAAA-MM-DD', la de Lima): el mismo para todos. */
export function retoDelDia(fecha) {
  const rnd = azar(semillaDe(`reto:${fecha}`));
  const colores = 10 + entero(rnd, 0, 2);
  const obstaculos = [['ocultas', 'cortina', 'hielo'][entero(rnd, 0, 2)]];
  return { fecha, colores, ...armarNivel({ semilla: `reto:${fecha}`, colores, obstaculos }) };
}
