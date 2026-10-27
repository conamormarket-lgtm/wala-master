import { subirRecursoPlantillaYoryo } from './crearArchivos';

/** Solo recorta alfa cero. Nunca interpreta blanco/crema como fondo. */
export async function prepararRecursoPlantillaYoryo(file, tipo) {
  if (file.size > 25 * 1024 * 1024 || file.type !== 'image/png') throw new Error('Sube un PNG de hasta 25 MB.');
  const local = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = local; await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    if (w * h > 25000000) throw new Error('El recurso supera los 25 megapíxeles.');
    const lienzo = document.createElement('canvas'); lienzo.width = w; lienzo.height = h;
    const ctx = lienzo.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, w, h).data;
    let x1 = w, y1 = h, x2 = -1, y2 = -1, alfa = 255;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = pixels[(y * w + x) * 4 + 3]; alfa = Math.min(alfa, a);
      if (a) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
    }
    if (x2 < 0) throw new Error('El PNG está vacío.');
    if (['escudo', 'pincelada'].includes(tipo) && alfa === 255) throw new Error('Esta capa debe tener transparencia real. Sube el PNG recortado.');
    const salida = document.createElement('canvas');
    const cw = x2 - x1 + 1, ch = y2 - y1 + 1;
    let visible = [0, 0, 1, 1];
    if (tipo === 'escudo') {
      salida.width = 1000; salida.height = 1400;
      const k = Math.min(940 / cw, 1340 / ch), dw = cw * k, dh = ch * k;
      const dx = (1000 - dw) / 2, dy = (1400 - dh) / 2;
      salida.getContext('2d').drawImage(lienzo, x1, y1, cw, ch, dx, dy, dw, dh);
      visible = [dx / 1000, dy / 1400, dw / 1000, dh / 1400];
    } else if (tipo === 'pincelada') {
      salida.width = cw + 24; salida.height = ch + 24;
      salida.getContext('2d').drawImage(lienzo, x1, y1, cw, ch, 12, 12, cw, ch);
      visible = [12 / salida.width, 12 / salida.height, cw / salida.width, ch / salida.height];
    } else {
      salida.width = w; salida.height = h; salida.getContext('2d').drawImage(lienzo, 0, 0);
    }
    const blob = await new Promise((r) => salida.toBlob(r, 'image/png'));
    if (!blob) throw new Error('No pudimos preparar el recurso.');
    return { blob, originalSize: [w, h], size: [salida.width, salida.height], visible };
  } finally { URL.revokeObjectURL(local); }
}

export async function cargarRecursoPlantillaYoryo(file, tipo) {
  const { blob, ...meta } = await prepararRecursoPlantillaYoryo(file, tipo);
  const [original, url] = await Promise.all([subirRecursoPlantillaYoryo(file, `original-${tipo}`), subirRecursoPlantillaYoryo(blob, tipo)]);
  return { ...meta, original, url };
}
