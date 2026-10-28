import { createProduct, getProduct, updateProductField } from '../../../services/products';
import { uploadFile } from '../../../services/firebase/storage';
import { getCombosCrear, guardarComboCrear } from '../../../services/combosCrear';

/*
 * Una sola vez: el cuadro, el mousepad y el tomatodo de Yoryo como prendas de
 * Crear (tipo "producto"), el Pack de oficina como combo de Crear, y sus
 * productos de la tienda con "Personalizar" llevando a ellos. Corre con la
 * sesión del admin (las reglas de siempre), desde ImportarPlantillasYoryo.
 *
 * Las zonas se midieron sobre la foto principal de cada producto de la tienda
 * (1086 × 1448, 28-10-2026). Si cambian las fotos, se ajustan en Admin →
 * Prendas de Crear como cualquier prenda.
 */

const PIEZAS = [
  {
    clave: 'cuadro', id: 'yoryo-crear-cuadro', tiendaId: 'skvYfJMys4BbuS4gI8QY', nombre: 'Cuadro personalizado', tecnica: 'impresion',
    // El interior del marco: 31 × 25 cm.
    zona: { id: 'cuadro-lamina', nombre: 'Lámina', x: 98 / 1086, y: 359.6 / 1448, w: 890 / 1086, proporcion: 25 / 31 },
    referencia: { x1: 98 / 1086, y1: 0.5, x2: 988 / 1086, y2: 0.5, cm: 31 },
  },
  {
    clave: 'mousepad', id: 'yoryo-crear-mousepad', tiendaId: 'MOpmYdM4GyLpU9ZIO55D', nombre: 'Mousepad personalizado', tecnica: 'impresion',
    // El diseño llega hasta la orilla y el borde cosido va encima: así se nota.
    encima: true,
    // Toda la cara del mousepad: 23.5 × 19.5 cm.
    // Sus esquinas son redondas (unos 68 px de radio en la foto): lo que sale
    // de ellas no se ve.
    zona: { id: 'mousepad-cara', nombre: 'Mousepad', x: 38 / 1086, y: 304 / 1448, w: 1010 / 1086, proporcion: 19.5 / 23.5, radio: 0.065 },
    referencia: { x1: 38 / 1086, y1: 0.5, x2: 1048 / 1086, y2: 0.5, cm: 23.5 },
  },
  {
    clave: 'tomatodo', id: 'yoryo-crear-tomatodo', tiendaId: 'BDKN8114eHsDIwAD8OVc', nombre: 'Tomatodo grabado', tecnica: 'laser',
    // Solo con sus plantillas de equipos: el cliente cambia el nombre y la frase.
    soloPlantillas: true,
    // La cara del cuerpo que se ve de frente. El cuerpo mide unos 10 cm de
    // ancho (estimado: confirmarlo con el taller y ajustar la línea en el admin).
    zona: { id: 'tomatodo-grabado', nombre: 'Grabado', x: 315 / 1086, y: 330 / 1448, w: 395 / 1086, proporcion: 550 / 395 },
    referencia: { x1: 270 / 1086, y1: 600 / 1448, x2: 755 / 1086, y2: 600 / 1448, cm: 10 },
  },
];
const PACK_TIENDA = 'mMPc5TIGZtB4S0t247BQ';
// La proporción de la zona del tomatodo en la primera versión (28-10-2026).
const ZONA_TOMATODO_ANTERIOR = 360 / 295;
export const IDS_CREAR_YORYO = Object.fromEntries(PIEZAS.map((p) => [p.clave, p.id]));

const cargar = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('No se pudo cargar la foto del producto.'));
  img.src = src;
});

/**
 * La foto con el fondo blanco transparente: se borra el blanco que toca el
 * borde (relleno desde las orillas), así el blanco de adentro (la lámina del
 * cuadro, la cara del mousepad) se queda. Luego se recorta al producto (con
 * un margen) para que en el estudio se vea grande. Devuelve también el
 * recorte, para pasar las medidas de la foto original a la nueva.
 */
async function fotoSinFondo(src) {
  const img = await cargar(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const lienzo = document.createElement('canvas');
  lienzo.width = W;
  lienzo.height = H;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const datos = ctx.getImageData(0, 0, W, H);
  const d = datos.data;
  const blanco = (p) => d[p * 4] > 238 && d[p * 4 + 1] > 238 && d[p * 4 + 2] > 238;
  const visto = new Uint8Array(W * H);
  const pila = [];
  for (let x = 0; x < W; x++) pila.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) pila.push(y * W, y * W + W - 1);
  while (pila.length) {
    const p = pila.pop();
    if (visto[p] || !blanco(p)) continue;
    visto[p] = 1;
    d[p * 4 + 3] = 0;
    const x = p % W;
    if (x > 0) pila.push(p - 1);
    if (x < W - 1) pila.push(p + 1);
    if (p >= W) pila.push(p - W);
    if (p < W * (H - 1)) pila.push(p + W);
  }
  ctx.putImageData(datos, 0, 0);
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let p = 0; p < W * H; p++) {
    if (!d[p * 4 + 3]) continue;
    const x = p % W, y = (p - x) / W;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const margen = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  x0 = Math.max(0, x0 - margen); y0 = Math.max(0, y0 - margen);
  x1 = Math.min(W - 1, x1 + margen); y1 = Math.min(H - 1, y1 + margen);
  const recorte = x1 - x0 + 1, alto = y1 - y0 + 1;
  // Un producto alto (el tomatodo) no queda más angosto que 3:4, la
  // proporción de las fotos de la tienda: si no, sus vistas previas salen
  // flacas y con franjas a los lados.
  const ancho = Math.max(recorte, Math.round(alto * PROPORCION_MINIMA));
  const relleno = (ancho - recorte) / 2;
  const recortada = document.createElement('canvas');
  recortada.width = ancho;
  recortada.height = alto;
  recortada.getContext('2d').drawImage(lienzo, x0, y0, recorte, alto, relleno, 0, recorte, alto);
  const blob = await new Promise((resolve, reject) => recortada.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo preparar la foto.'))), 'image/png'));
  // Una fracción de la foto original → la de la recortada.
  const fx = (f) => (f * W - x0 + relleno) / ancho;
  const fy = (f) => (f * H - y0) / alto;
  return { blob, ancho, alto, fx, fy, escala: W / ancho };
}

const PROPORCION_MINIMA = 3 / 4;

/**
 * La foto ya creada con la primera versión, ensanchada a 3:4 con aire
 * transparente a los lados. Devuelve cómo pasar una fracción horizontal.
 */
async function ensancharFoto(url) {
  const bitmap = await createImageBitmap(await fetch(url).then((r) => r.blob()));
  const W = bitmap.width;
  const H = bitmap.height;
  const ancho = Math.round(H * PROPORCION_MINIMA);
  const relleno = (ancho - W) / 2;
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = H;
  lienzo.getContext('2d').drawImage(bitmap, relleno, 0);
  bitmap.close?.();
  const blob = await new Promise((resolve, reject) => lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo preparar la foto.'))), 'image/png'));
  return { blob, ancho, alto: H, fx: (f) => (f * W + relleno) / ancho, escala: W / ancho };
}

/**
 * Lo oscuro de la foto (el borde cosido del mousepad) sobre transparente,
 * para dibujarlo encima del diseño. Mismo tamaño que la foto.
 */
async function bordeOscuro(blob) {
  const bitmap = await createImageBitmap(blob);
  const lienzo = document.createElement('canvas');
  lienzo.width = bitmap.width;
  lienzo.height = bitmap.height;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
  const d = datos.data;
  for (let i = 0; i < d.length; i += 4) {
    if ((d[i] + d[i + 1] + d[i + 2]) / 3 > 110) d[i + 3] = 0;
  }
  ctx.putImageData(datos, 0, 0);
  return new Promise((resolve, reject) => lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo preparar el borde.'))), 'image/png'));
}

const subirBorde = async (piezaId, blob) => {
  const archivo = new File([await bordeOscuro(blob)], 'encima.png', { type: 'image/png' });
  const { url, error } = await uploadFile(archivo, `productos_v2/${piezaId}/crear_${Date.now()}_encima.png`);
  if (error || !url) throw new Error(error || 'No se pudo subir el borde.');
  return url;
};

const fotoPrincipal = (p) => {
  const v = (p.variants || []).find((x) => String(x.id) === String(p.defaultVariantId)) || p.variants?.[0];
  return v?.imageUrl || p.mainImage || '';
};

/**
 * Crea lo que falte (no repite: las prendas tienen id fijo y el combo se busca
 * por sus piezas). Devuelve { cuadro, mousepad, tomatodo, pack } con los ids.
 */
export async function crearProductosYoryo({ onPaso = () => {} } = {}) {
  const ids = {};
  for (const pieza of PIEZAS) {
    ids[pieza.clave] = pieza.id;
    const existe = await getProduct(pieza.id);
    const { data: tienda } = await getProduct(pieza.tiendaId);
    if (!tienda) throw new Error(`No encontré el producto de la tienda de ${pieza.nombre}.`);
    if (existe.data && existe.data.deleted !== true) {
      // La primera versión creó la zona del tomatodo más chica: si nadie la
      // tocó todavía, se cambia por la de ahora.
      const vistas = existe.data.prendaBase?.vistas || [];
      const anterior = vistas[0]?.zonas?.[0];
      const cambios = {};
      if (anterior?.id === pieza.zona.id && Math.abs(Number(anterior.proporcion) - ZONA_TOMATODO_ANTERIOR) < 0.01) {
        const { fx, fy, escala } = await fotoSinFondo(fotoPrincipal(tienda));
        const zona = { ...pieza.zona, x: fx(pieza.zona.x), y: fy(pieza.zona.y), w: pieza.zona.w * escala, angulo: 0 };
        cambios.vistas = [{ ...vistas[0], zonas: [zona] }, ...vistas.slice(1)];
      }
      if (pieza.soloPlantillas && existe.data.prendaBase?.soloPlantillas !== true) cambios.soloPlantillas = true;
      let vistasHoy = cambios.vistas || vistas;
      const v0 = vistasHoy[0];
      if (v0?.imagen && Number(v0.anchoImg) / Number(v0.altoImg) < PROPORCION_MINIMA - 0.02) {
        const { blob, ancho, alto, fx, escala } = await ensancharFoto(v0.imagen);
        const archivo = new File([blob], `${pieza.clave}.png`, { type: 'image/png' });
        const { url, error } = await uploadFile(archivo, `productos_v2/${pieza.id}/crear_${Date.now()}_${pieza.clave}.png`);
        if (error || !url) throw new Error(error || 'No se pudo subir la foto.');
        const r = v0.referencia;
        vistasHoy = [{
          ...v0, imagen: url, anchoImg: ancho, altoImg: alto,
          zonas: (v0.zonas || []).map((z) => ({ ...z, x: fx(z.x), w: z.w * escala })),
          ...(r && { referencia: { ...r, x1: fx(r.x1), x2: fx(r.x2) } }),
        }, ...vistasHoy.slice(1)];
        cambios.vistas = vistasHoy;
        const colores = existe.data.prendaBase?.colores || {};
        cambios.colores = Object.fromEntries(Object.entries(colores).map(([vid, c]) => [vid, { ...c, fotos: { ...(c.fotos || {}), ...(c.fotos?.[v0.id] && { [v0.id]: url }) } }]));
      }
      const zonaHoy = vistasHoy[0]?.zonas?.[0];
      if (pieza.zona.radio && zonaHoy && !zonaHoy.radio) {
        vistasHoy = [{ ...vistasHoy[0], zonas: [{ ...zonaHoy, radio: pieza.zona.radio }, ...vistasHoy[0].zonas.slice(1)] }, ...vistasHoy.slice(1)];
        cambios.vistas = vistasHoy;
      }
      if (pieza.encima && vistasHoy[0]?.imagen && !vistasHoy[0].encima) {
        const foto = await fetch(vistasHoy[0].imagen).then((r) => r.blob());
        cambios.vistas = [{ ...vistasHoy[0], encima: await subirBorde(pieza.id, foto) }, ...vistasHoy.slice(1)];
      }
      if (Object.keys(cambios).length) {
        await updateProductField(pieza.id, { prendaBase: { ...existe.data.prendaBase, ...cambios } });
        onPaso(`${pieza.nombre}: actualizado`);
      } else onPaso(`${pieza.nombre}: ya existía`);
      continue;
    }
    onPaso(`${pieza.nombre}: preparando la foto…`);
    const { blob, ancho, alto, fx, fy, escala } = await fotoSinFondo(fotoPrincipal(tienda));
    const zona = { ...pieza.zona, x: fx(pieza.zona.x), y: fy(pieza.zona.y), w: pieza.zona.w * escala, angulo: 0 };
    const r = pieza.referencia;
    const referencia = { x1: fx(r.x1), y1: fy(r.y1), x2: fx(r.x2), y2: fy(r.y2), cm: r.cm };
    const archivo = new File([blob], `${pieza.clave}.png`, { type: 'image/png' });
    const { url, error } = await uploadFile(archivo, `productos_v2/${pieza.id}/crear_${Date.now()}_${pieza.clave}.png`);
    if (error || !url) throw new Error(error || 'No se pudo subir la foto.');
    const encima = pieza.encima ? await subirBorde(pieza.id, blob) : '';
    const variantes = (tienda.variants || []).map((v) => ({ id: v.id, name: v.name, colorHex: v.colorHex, imageUrl: '', images: [], sizes: [] }));
    onPaso(`${pieza.nombre}: creando…`);
    await createProduct({
      name: pieza.nombre,
      description: tienda.description || '',
      price: tienda.price,
      salePrice: tienda.salePrice || 0,
      inStock: null,
      brandId: tienda.brandId || '',
      categories: [],
      mainImage: '',
      hasVariants: true,
      variants: variantes,
      defaultVariantId: tienda.defaultVariantId || variantes[0]?.id || '',
      esPrendaBase: true,
      visible: true,
      isV2: true,
      prendaBase: {
        tipo: 'producto',
        ...(pieza.tecnica === 'laser' && { tecnica: 'laser' }),
        ...(pieza.soloPlantillas && { soloPlantillas: true }),
        vistas: [{ id: 'frente', nombre: 'Frente', imagen: url, ...(encima && { encima }), anchoImg: ancho, altoImg: alto, referencia, zonas: [zona] }],
        colores: Object.fromEntries(variantes.map((v) => [v.id, { fotos: { frente: url } }])),
      },
    }, pieza.id);
  }

  const piezas = PIEZAS.map((p) => ({ prendaId: p.id }));
  const { data: combos } = await getCombosCrear({ incluirBorradores: true });
  let pack = (combos || []).find((c) => c.piezas?.length === 3 && piezas.every((p, i) => c.piezas[i]?.prendaId === p.prendaId))?.id;
  if (pack) onPaso('Pack de oficina: ya existía');
  else {
    onPaso('Pack de oficina: creando…');
    const { data: tiendaPack } = await getProduct(PACK_TIENDA);
    pack = await guardarComboCrear(null, {
      name: 'Pack de oficina personalizado',
      description: tiendaPack?.description || 'Tomatodo, cuadro y mousepad, cada uno con tu diseño.',
      price: tiendaPack?.price || 149,
      salePrice: tiendaPack?.salePrice || 0,
      mainImage: tiendaPack?.mainImage || '',
      publicado: true,
      piezas,
      tallas: 'auto',
    });
  }
  ids.pack = pack;

  onPaso('Enlazando los productos de la tienda…');
  for (const pieza of PIEZAS) await updateProductField(pieza.tiendaId, { personalizarEn: `/crear/${pieza.id}` });
  await updateProductField(PACK_TIENDA, { personalizarEn: `/combo/${pack}` });
  onPaso('Listo');
  return ids;
}
