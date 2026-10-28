import { getDocument, updateDocument } from '../../services/firebase/firestore';
import { uploadFile } from '../../services/firebase/storage';
import { clearProductCaches } from '../../services/products';
import { cargarImagen, fotoDeVista, fondoDeVista, medidaZona, listarZonas } from '../../utils/prendaBase';
import { asegurarFuentesDe, renderizarImpresion, renderizarVistaPrevia } from './renderDiseno';
import { capasEnOtraPrenda } from './zonasEquivalentes';

/*
 * Plantillas de un producto de Crear (prendaBase.plantillas): los diseños
 * para empezar del estudio. Sus imágenes viven con el producto
 * (productos_v2/{id}/plantillas/), no en la carpeta de un cliente: así la
 * limpieza de archivos de una creación nunca las toca.
 */

const marca = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const aBlob = (canvas, tipo = 'image/png') => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo preparar la imagen.'))), tipo, 0.9);
});

/** Sube una imagen a la carpeta de plantillas del producto. Devuelve su URL. */
export async function subirAProducto(prendaId, blob, nombre = 'capa') {
  const extension = blob.type === 'image/jpeg' ? 'jpg' : 'png';
  const archivo = new File([blob], `${nombre}.${extension}`, { type: blob.type || 'image/png' });
  const { url, error } = await uploadFile(archivo, `productos_v2/${prendaId}/plantillas/${marca()}_${nombre}.${extension}`);
  if (error || !url) throw new Error(error || 'No se pudo subir la imagen de la plantilla.');
  return url;
}

/** Las imágenes de las capas, copiadas a la carpeta del producto (las de ahí se dejan). */
export async function copiarImagenesAProducto(prendaId, capasPorZona) {
  const copias = new Map();
  const copiar = (src) => {
    if (!src || String(src).includes(`productos_v2%2F${prendaId}%2Fplantillas`)) return Promise.resolve(src);
    if (!copias.has(src)) {
      copias.set(src, fetch(src).then((r) => {
        if (!r.ok) throw new Error('No se pudo copiar una imagen de la plantilla.');
        return r.blob();
      }).then((blob) => subirAProducto(prendaId, blob)));
    }
    return copias.get(src);
  };
  const salida = {};
  for (const [zonaId, capas] of Object.entries(capasPorZona || {})) {
    salida[zonaId] = await Promise.all((capas || []).map(async (c) => (c.type === 'image' ? { ...c, src: await copiar(c.src) } : c)));
  }
  return salida;
}

/**
 * La miniatura de la plantilla: el diseño plano de su zona (sin el marco ni
 * la prenda). Un grabado láser (claro sobre transparente) se ve sobre el
 * producto, que es como se entiende.
 */
export async function miniaturaDePlantilla({ vista, zona, color, capas, laser = false, ancho = 640 }) {
  await asegurarFuentesDe(capas);
  if (laser) {
    // Sobre el producto, en un cuadrado centrado en el grabado: se ve casi
    // todo el tomatodo, como en la tarjeta de los borradores.
    const img = await cargarImagen(fotoDeVista(vista, color));
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const lado = 1200;
    const previa = await renderizarVistaPrevia({
      fuente: fondoDeVista(img, vista, color), anchoImg: W, altoImg: H,
      vista, capasPorZona: capas, srcDe: (c) => c.src, ancho: lado, laser,
    });
    const margen = Math.round(lado * 0.06);
    const k = (lado - margen * 2) / W;
    const zw = zona.w * W * k;
    const zh = zw * zona.proporcion;
    const cx = margen + zona.x * W * k + zw / 2;
    const cy = margen + zona.y * H * k + zh / 2;
    const cw = Math.max(zw, zh) * 2.1;
    const ch = cw;
    const foto = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo leer la miniatura.'));
      i.src = URL.createObjectURL(previa);
    });
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = Math.round((ancho * ch) / cw);
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#F3F1F7';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(foto, cx - cw / 2, cy - ch / 2, cw, ch, 0, 0, lienzo.width, lienzo.height);
    URL.revokeObjectURL(foto.src);
    return aBlob(lienzo, 'image/jpeg');
  }
  const { blob } = await renderizarImpresion(capas[zona.id] || [], zona, (c) => c.src, medidaZona(zona, vista));
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('No se pudo leer la miniatura.'));
    i.src = URL.createObjectURL(blob);
  });
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = Math.round((ancho * img.naturalHeight) / img.naturalWidth);
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  URL.revokeObjectURL(img.src);
  return aBlob(lienzo, 'image/jpeg');
}

/**
 * Cambia la lista de plantillas del producto con `cambiar(actuales)`. Lee el
 * documento tal cual está para no pisar lo que el admin haya cambiado en otra
 * pestaña (o en el estudio). Devuelve la lista nueva.
 */
async function escribirPlantillas(prendaId, cambiar) {
  const { data, error } = await getDocument('productos_wala', prendaId);
  if (error || !data) throw new Error(error || 'No encontré el producto.');
  const plantillas = cambiar(data.prendaBase?.plantillas || []);
  const r = await updateDocument('productos_wala', prendaId, { prendaBase: { ...data.prendaBase, plantillas } });
  if (r.error) throw new Error(r.error);
  clearProductCaches();
  return plantillas;
}

/** Agrega o reemplaza (por id, en su mismo lugar de la lista) plantillas en el producto. */
export async function guardarPlantillasDelProducto(prendaId, nuevas) {
  const porId = new Map(nuevas.map((p) => [p.id, p]));
  return escribirPlantillas(prendaId, (actuales) => [
    ...actuales.map((p) => porId.get(p.id) || p),
    ...nuevas.filter((p) => !actuales.some((a) => a.id === p.id)),
  ]);
}

/** Cambia el nombre o el grupo de una plantilla del producto. */
export const cambiarPlantillaDelProducto = (prendaId, id, cambios) =>
  escribirPlantillas(prendaId, (actuales) => actuales.map((p) => (p.id === id ? { ...p, ...cambios } : p)));

/** Quita una plantilla del producto (sus imágenes se quedan: otra copia puede usarlas). */
export const quitarPlantillaDelProducto = (prendaId, id) =>
  escribirPlantillas(prendaId, (actuales) => actuales.filter((p) => p.id !== id));

/** La primera zona con diseño de unas capas y su vista. */
const zonaConDiseno = (vistas, capas) => {
  const zonas = listarZonas(vistas);
  const zona = zonas.find((z) => (capas[z.id] || []).length);
  return zona ? { zona, vista: vistas.find((v) => v.id === zona.vistaId) } : null;
};

/**
 * "Traer de otro producto": copia plantillas de `origen` (un producto de
 * Crear) a `destinoId`. Cada zona va a la misma o a su equivalente
 * (capasEnOtraPrenda, como "Llevar diseño"); las imágenes se copian a la
 * carpeta del destino y la miniatura se rehace sobre él. Las que no encajan
 * en ninguna zona se saltan. Devuelve { traidas, saltadas }.
 *  - destino: { vistas, colores, laser } (leerPrendaBase del destino)
 */
export async function traerPlantillas({ destinoId, destino, plantillas }) {
  const zonasDestino = listarZonas(destino.vistas);
  const color = destino.colores[0];
  const nuevas = [];
  let saltadas = 0;
  for (const p of plantillas) {
    const encajadas = capasEnOtraPrenda(p.capas, zonasDestino);
    const donde = zonaConDiseno(destino.vistas, encajadas);
    if (!donde) { saltadas += 1; continue; }
    const capas = await copiarImagenesAProducto(destinoId, encajadas);
    const miniatura = await miniaturaDePlantilla({ vista: donde.vista, zona: donde.zona, color, capas, laser: destino.laser });
    const imagen = await subirAProducto(destinoId, miniatura, 'miniatura');
    nuevas.push({ id: `p${marca()}`, nombre: p.nombre, grupo: p.grupo || '', imagen, capas });
  }
  if (nuevas.length) await guardarPlantillasDelProducto(destinoId, nuevas);
  return { traidas: nuevas.length, saltadas };
}

/**
 * La foto de tienda de un color hecha con una plantilla: el producto en ese
 * color con el diseño puesto, en 4:5 sobre blanco (como las vistas previas
 * de los productos de Crear). Devuelve la URL ya subida al producto.
 *  - cfg: { vistas, laser } · color: de leerPrendaBase · plantilla: { capas }
 */
export async function fotoDeTiendaConPlantilla({ prendaId, cfg, color, plantilla }) {
  await asegurarFuentesDe(plantilla.capas);
  const donde = zonaConDiseno(cfg.vistas, plantilla.capas) || { vista: cfg.vistas[0] };
  const vista = donde.vista;
  const img = await cargarImagen(fotoDeVista(vista, color));
  const blob = await renderizarVistaPrevia({
    fuente: fondoDeVista(img, vista, color), anchoImg: img.naturalWidth, altoImg: img.naturalHeight,
    vista, capasPorZona: plantilla.capas, srcDe: (c) => c.src, ancho: 1200, laser: cfg.laser, producto: true,
  });
  return subirAProducto(prendaId, blob, 'foto-tienda');
}
