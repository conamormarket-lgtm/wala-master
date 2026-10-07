/**
 * Borrador de fondo del apartado Crear: la lógica de píxeles, sin React.
 *
 * Lo que el cliente hace se guarda como una lista de operaciones con
 * coordenadas relativas (0–1). Así se ven en una vista previa liviana y,
 * al aplicar, se repiten sobre la imagen a tamaño de impresión: el borde
 * queda nítido aunque la vista previa sea más chica.
 *
 *   { t: 'fondo', color: [r,g,b], tol }       fondo conectado al borde
 *   { t: 'varita', x, y, tol }                zona del color tocado
 *   { t: 'trazo', modo: 'borrar'|'restaurar', r, puntos: [{x,y}] }
 *
 * La máscara (0 = borrado, 255 = se ve) multiplica la transparencia
 * original de cada píxel.
 */

export const TOLERANCIA_INICIAL = 35;
// Tolerancia de la interfaz (5–100) → distancia de color RGB.
const umbral = (tol) => tol * 2;
// Banda de borde suave: los píxeles del contorno que casi coinciden quedan
// semitransparentes (bordes antialiasados de un logo sobre blanco).
const SUAVE = 28;
// Un píxel casi transparente cuenta como fondo.
const ALFA_FONDO = 20;

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

/** Índices de los píxeles del borde de la imagen. */
const indicesDelBorde = (w, h) => {
  const lista = [];
  for (let x = 0; x < w; x += 1) {
    lista.push(x);
    if (h > 1) lista.push((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y += 1) {
    lista.push(y * w);
    if (w > 1) lista.push(y * w + w - 1);
  }
  return lista;
};

/**
 * Color del fondo según el borde de la imagen: el color más repetido y qué
 * tan parejo es (fracción del borde que se le parece). `transparente` es la
 * fracción del borde que ya no tiene fondo.
 */
export const analizarBorde = ({ d, w, h }) => {
  const borde = indicesDelBorde(w, h);
  const cubetas = new Uint32Array(4096);
  let transparentes = 0;
  for (const i of borde) {
    const o = i * 4;
    if (d[o + 3] < ALFA_FONDO) { transparentes += 1; continue; }
    cubetas[((d[o] >> 4) << 8) | ((d[o + 1] >> 4) << 4) | (d[o + 2] >> 4)] += 1;
  }
  const opacos = borde.length - transparentes;
  if (!opacos) return { color: null, uniforme: 0, transparente: 1 };
  let mejor = 0;
  for (let k = 1; k < 4096; k += 1) if (cubetas[k] > cubetas[mejor]) mejor = k;
  let r = 0; let g = 0; let b = 0; let n = 0;
  for (const i of borde) {
    const o = i * 4;
    if (d[o + 3] < ALFA_FONDO) continue;
    if ((((d[o] >> 4) << 8) | ((d[o + 1] >> 4) << 4) | (d[o + 2] >> 4)) !== mejor) continue;
    r += d[o]; g += d[o + 1]; b += d[o + 2]; n += 1;
  }
  const color = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  const t2 = umbral(TOLERANCIA_INICIAL) ** 2;
  let parecidos = 0;
  for (const i of borde) {
    const o = i * 4;
    if (d[o + 3] < ALFA_FONDO) continue;
    const dr = d[o] - color[0]; const dg = d[o + 1] - color[1]; const db = d[o + 2] - color[2];
    if (dr * dr + dg * dg + db * db < t2) parecidos += 1;
  }
  return { color, uniforme: parecidos / opacos, transparente: transparentes / borde.length };
};

/** ¿Conviene quitar el fondo apenas se abre? Solo si el borde es de un color parejo. */
export const fondoAutomatico = (img) => {
  const { color, uniforme, transparente } = analizarBorde(img);
  if (!color || transparente > 0.5 || uniforme < 0.7) return null;
  return { t: 'fondo', color, tol: TOLERANCIA_INICIAL };
};

const distancia2 = (d, o, [r, g, b]) => {
  const dr = d[o] - r; const dg = d[o + 1] - g; const db = d[o + 2] - b;
  return dr * dr + dg * dg + db * db;
};

/**
 * Relleno por líneas desde las semillas: marca los píxeles conectados que
 * se parecen al color de referencia (o ya son transparentes) y los borra de
 * la máscara, con un borde suave de un píxel.
 */
const rellenar = ({ d, w, h }, mascara, semillas, color, tol) => {
  const thr = umbral(tol);
  const t2 = thr * thr;
  const coincide = (i) => {
    const o = i * 4;
    return d[o + 3] < ALFA_FONDO || distancia2(d, o, color) < t2;
  };
  const visto = new Uint8Array(w * h);
  const pila = semillas.filter((i) => coincide(i));
  while (pila.length) {
    const p = pila.pop();
    if (visto[p]) continue;
    const y = Math.floor(p / w);
    let x = p - y * w;
    let i = p;
    while (x > 0 && !visto[i - 1] && coincide(i - 1)) { i -= 1; x -= 1; }
    let arriba = false;
    let abajo = false;
    for (; x < w && !visto[i] && coincide(i); x += 1, i += 1) {
      visto[i] = 1;
      if (y > 0) {
        const u = i - w;
        const c = !visto[u] && coincide(u);
        if (c && !arriba) pila.push(u);
        arriba = c;
      }
      if (y < h - 1) {
        const u = i + w;
        const c = !visto[u] && coincide(u);
        if (c && !abajo) pila.push(u);
        abajo = c;
      }
    }
  }
  const total = w * h;
  for (let k = 0; k < total; k += 1) if (visto[k]) mascara[k] = 0;
  // Borde suave: vecinos del relleno que casi coinciden.
  for (let k = 0; k < total; k += 1) {
    if (!visto[k]) continue;
    const y = Math.floor(k / w);
    const x = k - y * w;
    const vecinos = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1];
    for (const n of vecinos) {
      if (n < 0 || visto[n]) continue;
      const v = (Math.sqrt(distancia2(d, n * 4, color)) - thr) / SUAVE;
      if (v < 1) mascara[n] = Math.min(mascara[n], Math.round(255 * Math.max(0, v)));
    }
  }
};

/** Un toque de pincel: centro (cx, cy) y radio en píxeles, con borde suave. */
const estampar = ({ w, h }, mascara, cx, cy, r, modo) => {
  const x0 = Math.max(0, Math.floor(cx - r)); const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)); const y1 = Math.min(h - 1, Math.ceil(cy + r));
  const duro = r * 0.6;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > r) continue;
      const fuerza = dist <= duro ? 1 : 1 - (dist - duro) / (r - duro);
      const k = y * w + x;
      if (modo === 'borrar') mascara[k] = Math.min(mascara[k], Math.round(255 * (1 - fuerza)));
      else mascara[k] = Math.max(mascara[k], Math.round(255 * fuerza));
    }
  }
};

/** Pinta el tramo de un trazo desde el punto `desde` (para dibujar mientras se arrastra). */
export const pintarTrazo = (img, mascara, op, desde = 0) => {
  const lado = Math.max(img.w, img.h);
  const r = Math.max(1, op.r * lado);
  const pts = op.puntos.map((p) => ({ x: p.x * img.w, y: p.y * img.h }));
  for (let k = Math.max(0, desde); k < pts.length; k += 1) {
    const a = pts[k - 1] || pts[k];
    const b = pts[k];
    const pasos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (r * 0.25)));
    for (let s = k === 0 ? 0 : 1; s <= pasos; s += 1) {
      estampar(img, mascara, a.x + ((b.x - a.x) * s) / pasos, a.y + ((b.y - a.y) * s) / pasos, r, op.modo);
    }
  }
};

export const aplicarOperacion = (img, mascara, op) => {
  const { d, w, h } = img;
  if (op.t === 'fondo') {
    rellenar(img, mascara, indicesDelBorde(w, h), op.color, op.tol);
  } else if (op.t === 'varita') {
    const x = limitar(Math.floor(op.x * w), 0, w - 1);
    const y = limitar(Math.floor(op.y * h), 0, h - 1);
    const i = y * w + x;
    rellenar(img, mascara, [i], [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]], op.tol);
  } else if (op.t === 'trazo') {
    pintarTrazo(img, mascara, op);
  }
};

/** Máscara desde cero con todas las operaciones (para deshacer o a tamaño real). */
export const reconstruir = (img, ops) => {
  const mascara = new Uint8Array(img.w * img.h).fill(255);
  ops.forEach((op) => aplicarOperacion(img, mascara, op));
  return mascara;
};

/** Escribe en `destino` (ImageData del mismo tamaño) la imagen con la máscara aplicada. */
export const componer = (img, mascara, destino) => {
  const { d } = img;
  const out = destino.data;
  const total = img.w * img.h;
  for (let k = 0; k < total; k += 1) {
    const o = k * 4;
    out[o] = d[o]; out[o + 1] = d[o + 1]; out[o + 2] = d[o + 2];
    out[o + 3] = (d[o + 3] * mascara[k]) / 255;
  }
  return destino;
};

/** ¿Quedó algo visible? */
export const quedaAlgo = (img, mascara) => {
  const total = img.w * img.h;
  for (let k = 0; k < total; k += 1) if (mascara[k] > 12 && img.d[k * 4 + 3] > 12) return true;
  return false;
};
