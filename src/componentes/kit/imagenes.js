/*
 * Lo común de las piezas que trabajan con los píxeles de una imagen
 * (RecortarFoto en modo libre, QuitarFondo): cargarla, saber qué parte se ve
 * y recortarla en PNG para no perder la transparencia. Sin React.
 */

/** Carga una imagen (con CORS, para poder leer sus píxeles). */
export const cargarImagen = (src) => new Promise((resolver, rechazar) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.onload = () => resolver(img);
  img.onerror = () => rechazar(new Error('No se pudo cargar la imagen'));
  img.src = src;
});

const ladoDe = (f) => ({ w: f.naturalWidth || f.width, h: f.naturalHeight || f.height });

/**
 * El rectángulo que de verdad se ve (alfa > 8), en píxeles de la imagen, o
 * null si no tiene bordes transparentes que quitar (o está vacía).
 */
export const cajaVisible = (fuente) => {
  const { w, h } = ladoDe(fuente);
  if (!w || !h) return null;
  const lienzo = document.createElement('canvas');
  lienzo.width = w;
  lienzo.height = h;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(fuente, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const caja = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  return caja.w === w && caja.h === h ? null : caja;
};

/** Recorta `caja` (px) de la imagen o lienzo en un PNG: { blob, ancho, alto }. */
export const recortarImagen = async (fuente, caja) => {
  const { w, h } = ladoDe(fuente);
  const c = caja || { x: 0, y: 0, w, h };
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.max(1, Math.round(c.w));
  lienzo.height = Math.max(1, Math.round(c.h));
  lienzo.getContext('2d').drawImage(fuente, c.x, c.y, c.w, c.h, 0, 0, lienzo.width, lienzo.height);
  const blob = await new Promise((r) => { lienzo.toBlob(r, 'image/png'); });
  return { blob, ancho: lienzo.width, alto: lienzo.height };
};
