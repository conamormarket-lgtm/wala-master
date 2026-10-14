/**
 * Guías inteligentes del estudio (como en Canva): al mover o agrandar un
 * diseño, se pega a los bordes y centros de otros diseños de su zona y a los
 * de la zona, y a espacios iguales entre diseños. Todo se calcula en
 * unidades de la zona (así funciona igual en una manga girada) y devuelve
 * las líneas que hay que dibujar.
 */
import { fabric } from 'fabric';
import { desdeLienzo } from './renderDiseno';

/** Caja de un diseño (o de un grupo elegido) en unidades de su zona. */
export const cajaEnZona = (obj, t) => {
  // Dentro de un grupo, fabric da las esquinas relativas al grupo: se pasan al lienzo.
  const delGrupo = obj.group ? obj.group.calcTransformMatrix() : null;
  const pts = obj.getCoords(true, true)
    .map((pt) => (delGrupo ? fabric.util.transformPoint(pt, delGrupo) : pt))
    .map((pt) => desdeLienzo(t, pt.x, pt.y));
  const xs = pts.map((pt) => pt.left);
  const ys = pts.map((pt) => pt.top);
  return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
};

// Un eje y su cruzado: 'x' alinea en horizontal (líneas verticales).
const EJES = {
  x: { a1: 'x1', a2: 'x2', b1: 'y1', b2: 'y2', largo: 'wu' },
  y: { a1: 'y1', a2: 'y2', b1: 'x1', b2: 'x2', largo: 'hu' },
};
const medio = (c, e) => (c[e.a1] + c[e.a2]) / 2;
const mover = (c, eje, d) => {
  const e = EJES[eje];
  return { ...c, [e.a1]: c[e.a1] + d, [e.a2]: c[e.a2] + d };
};

/** Bordes y centros a los que se puede pegar, en un eje. */
const objetivos = (eje, otras, zona) => {
  const e = EJES[eje];
  const lista = [0, zona[e.largo] / 2, zona[e.largo]].map((valor) => ({ valor, zona: true }));
  otras.forEach((c) => {
    [c[e.a1], medio(c, e), c[e.a2]].forEach((valor) => lista.push({ valor, zona: false }));
  });
  return lista;
};

/** El pegado de alineación más cercano en un eje (o null). */
const mejorAlineacion = (eje, caja, otras, zona, tol, soloBordes = null) => {
  const e = EJES[eje];
  const propios = soloBordes || [caja[e.a1], medio(caja, e), caja[e.a2]];
  let mejor = null;
  objetivos(eje, otras, zona).forEach(({ valor }) => {
    propios.forEach((p) => {
      const d = valor - p;
      if (Math.abs(d) <= tol && (!mejor || Math.abs(d) < Math.abs(mejor.d))) mejor = { d, valor, desde: p };
    });
  });
  return mejor;
};

/**
 * Los espacios entre diseños de la misma fila (o columna): los que ya hay
 * entre otros, y los que quedarían a cada lado del que se mueve.
 */
const fila = (eje, caja, otras) => {
  const e = EJES[eje];
  // Los que se cruzan con el que se mueve en el otro eje (misma fila).
  return otras
    .filter((c) => c[e.b1] < caja[e.b2] && c[e.b2] > caja[e.b1])
    .sort((p, q) => p[e.a1] - q[e.a1]);
};

/** El pegado a un espacio igual más cercano en un eje (o null). */
const mejorEspacio = (eje, caja, otras, tol) => {
  const e = EJES[eje];
  const vecinos = fila(eje, caja, otras);
  if (!vecinos.length) return null;
  const huecos = [];
  for (let i = 1; i < vecinos.length; i += 1) {
    const g = vecinos[i][e.a1] - vecinos[i - 1][e.a2];
    if (g > 0) huecos.push(g);
  }
  const izq = vecinos.filter((c) => c[e.a2] <= caja[e.a1] + tol).sort((p, q) => q[e.a2] - p[e.a2])[0];
  const der = vecinos.filter((c) => c[e.a1] >= caja[e.a2] - tol).sort((p, q) => p[e.a1] - q[e.a1])[0];
  const ancho = caja[e.a2] - caja[e.a1];
  const opciones = [];
  if (izq) huecos.forEach((g) => opciones.push(izq[e.a2] + g - caja[e.a1]));
  if (der) huecos.forEach((g) => opciones.push(der[e.a1] - g - caja[e.a2]));
  // Justo al medio entre dos: el mismo espacio a cada lado.
  if (izq && der && der[e.a1] - izq[e.a2] > ancho) {
    opciones.push((izq[e.a2] + der[e.a1] - ancho) / 2 - caja[e.a1]);
  }
  let mejor = null;
  opciones.forEach((d) => {
    if (Math.abs(d) <= tol && (!mejor || Math.abs(d) < Math.abs(mejor.d))) mejor = { d };
  });
  return mejor;
};

const casi = (a, b) => Math.abs(a - b) < 0.01;

/** Líneas de alineación de la caja ya pegada, en un eje. */
const lineasAlineacion = (eje, caja, otras, zona) => {
  const e = EJES[eje];
  const lineas = [];
  [caja[e.a1], medio(caja, e), caja[e.a2]].forEach((v) => {
    if (lineas.some((l) => casi(l.valor, v))) return;
    const iguales = otras.filter((c) => [c[e.a1], medio(c, e), c[e.a2]].some((w) => casi(w, v)));
    const deZona = [0, zona[e.largo] / 2, zona[e.largo]].some((w) => casi(w, v));
    if (!iguales.length && !deZona) return;
    // Con otros diseños, la línea los une; con la zona, la cruza entera.
    const tramo = [caja, ...iguales];
    const desde = deZona && !iguales.length ? 0 : Math.min(...tramo.map((c) => c[e.b1]));
    const hasta = deZona && !iguales.length ? zona[EJES[eje === 'x' ? 'y' : 'x'].largo] : Math.max(...tramo.map((c) => c[e.b2]));
    lineas.push({ tipo: 'linea', eje, valor: v, desde, hasta });
  });
  return lineas;
};

/** Marcas de espacios iguales de la caja ya pegada, en un eje. */
const marcasEspacio = (eje, caja, otras) => {
  const e = EJES[eje];
  const todos = [...fila(eje, caja, otras), caja].sort((p, q) => p[e.a1] - q[e.a1]);
  const pares = [];
  for (let i = 1; i < todos.length; i += 1) {
    const a = todos[i - 1];
    const b = todos[i];
    const g = b[e.a1] - a[e.a2];
    if (g > 0.01) pares.push({ a, b, g });
  }
  const propios = pares.filter((p) => p.a === caja || p.b === caja);
  const marcas = [];
  propios.forEach((p) => {
    const iguales = pares.filter((q) => casi(q.g, p.g));
    if (iguales.length < 2) return;
    iguales.forEach((q) => {
      if (marcas.some((m) => m.par === q)) return;
      const en = (Math.max(q.a[e.b1], q.b[e.b1]) + Math.min(q.a[e.b2], q.b[e.b2])) / 2;
      marcas.push({ par: q, tipo: 'espacio', eje, desde: q.a[e.a2], hasta: q.b[e.a1], en });
    });
  });
  return marcas.map(({ par, ...m }) => m);
};

/**
 * Al mover: cuánto correr la caja (dx, dy en unidades de la zona) para que
 * se pegue, y las guías a dibujar. `tol` es el alcance del imán.
 */
export const imanAlMover = (caja, otras, zona, tol) => {
  const pegados = {};
  let final = caja;
  ['x', 'y'].forEach((eje) => {
    const al = mejorAlineacion(eje, caja, otras, zona, tol);
    const es = mejorEspacio(eje, caja, otras, tol);
    const elegido = al && (!es || Math.abs(al.d) <= Math.abs(es.d)) ? al : es;
    pegados[eje] = elegido ? elegido.d : 0;
    if (elegido) final = mover(final, eje, elegido.d);
  });
  const guias = ['x', 'y'].flatMap((eje) => [
    ...lineasAlineacion(eje, final, otras, zona),
    ...marcasEspacio(eje, final, otras),
  ]);
  return { dx: pegados.x, dy: pegados.y, guias };
};

/**
 * Al agrandar desde una esquina: el borde que se estira se pega a bordes y
 * centros. `fijo` es la esquina que no se mueve (unidades de la zona).
 * Devuelve el factor de escala a aplicar (1 = nada) y las guías.
 */
export const imanAlEscalar = (caja, fijo, otras, zona, tol) => {
  const bordeX = Math.abs(fijo.left - caja.x1) < Math.abs(fijo.left - caja.x2) ? caja.x2 : caja.x1;
  const bordeY = Math.abs(fijo.top - caja.y1) < Math.abs(fijo.top - caja.y2) ? caja.y2 : caja.y1;
  const enX = mejorAlineacion('x', caja, otras, zona, tol, [bordeX]);
  const enY = mejorAlineacion('y', caja, otras, zona, tol, [bordeY]);
  const elegido = enX && (!enY || Math.abs(enX.d) <= Math.abs(enY.d)) ? { ...enX, eje: 'x' } : enY && { ...enY, eje: 'y' };
  if (!elegido) return { factor: 1, guias: [] };
  const base = elegido.eje === 'x' ? fijo.left : fijo.top;
  const largo = elegido.desde - base;
  const factor = Math.abs(largo) > 0.01 ? (elegido.valor - base) / largo : 1;
  if (!(factor > 0)) return { factor: 1, guias: [] };
  // La caja tal como queda, para la línea.
  const escalar = (v, f) => f + (v - f) * factor;
  const final = {
    x1: escalar(caja.x1, fijo.left), x2: escalar(caja.x2, fijo.left),
    y1: escalar(caja.y1, fijo.top), y2: escalar(caja.y2, fijo.top),
  };
  const guias = lineasAlineacion(elegido.eje, final, otras, zona).filter((l) => casi(l.valor, elegido.valor));
  return { factor, guias };
};

/** Medida en cm para mostrar (con un decimal si hace falta), o '' sin escala. */
export const enCm = (unidades, cmPorUnidad) => {
  if (!(cmPorUnidad > 0)) return '';
  const cm = Math.round(unidades * cmPorUnidad * 10) / 10;
  return `${Number.isInteger(cm) ? cm : cm.toFixed(1)} cm`;
};
