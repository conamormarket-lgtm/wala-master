/**
 * generarArchivosCreacionSecure: para la app, el servidor dibuja los archivos de una creación de Crear (opción B de
 * wala-mobile/docs/CREAR.md) con el mismo código de fabric que la web (crearRender.js) y la deja guardada.
 *
 * Solo el dueño, solo `tipo: 'crear'` sin combo. Las fotos del diseño deben ser archivos del propio cliente en Storage
 * (`designs/{uid}/…`) y se leen del bucket, nunca de una URL cualquiera; las fotos de la prenda vienen de la
 * configuración del producto. Las capas se validan antes de dibujar. Los archivos quedan en las mismas rutas que usa
 * la web (`designs/{uid}/crear/impresion|previas/…`), así el pago móvil y congelarDisenos los reconocen.
 */
const { randomUUID } = require('node:crypto');

const MAX_CAPAS = 40;
const MAX_TEXTO = 120;
const MAX_IMAGEN = 25 * 1024 * 1024;
const BLOQUEO_MS = 3 * 60 * 1000;
const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
const finito = (n) => typeof n === 'number' && Number.isFinite(n);

/** La ruta en el bucket de una URL de descarga de Storage, solo si es del propio cliente. */
function rutaPropia(url, uid, bucket) {
  const m = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?]+)(\?.*)?$/.exec(String(url || ''));
  if (!m || m[1] !== bucket) return null;
  const ruta = decodeURIComponent(m[2]);
  return ruta.startsWith(`designs/${uid}/`) && !ruta.includes('..') ? ruta : null;
}

/** Capas que se pueden dibujar: zonas de la prenda, tipos conocidos, números finitos, fotos propias. */
function validarCapas(capas, zonasValidas, uid, bucket, fail) {
  if (!capas || typeof capas !== 'object' || Array.isArray(capas)) fail('El diseño no tiene capas.');
  let total = 0;
  const limpias = {};
  for (const [zonaId, lista] of Object.entries(capas)) {
    if (!Array.isArray(lista) || !lista.length) continue;
    if (!zonasValidas.has(zonaId)) fail('El diseño usa una zona que la prenda ya no tiene. Ábrelo y vuelve a guardarlo.');
    total += lista.length;
    if (total > MAX_CAPAS) fail('El diseño tiene demasiadas capas.');
    limpias[zonaId] = lista.map((capa) => {
      if (!capa || typeof capa !== 'object' || !['left', 'top', 'escalaX', 'escalaY'].every((k) => finito(capa[k]))
        || (capa.angulo != null && !finito(capa.angulo)) || Math.abs(capa.escalaX) > 1000 || Math.abs(capa.escalaY) > 1000) fail('Una capa del diseño no es válida.');
      if (capa.type === 'image') {
        if (!rutaPropia(capa.src, uid, bucket) || !(capa.anchoNatural > 0) || !(capa.altoNatural > 0)) fail('Una foto del diseño no es tuya o no terminó de subirse.');
        return capa;
      }
      if (capa.type === 'text') {
        if (typeof capa.text !== 'string' || capa.text.length > MAX_TEXTO || !(capa.tamano > 0) || capa.tamano > 2000) fail('Un texto del diseño no es válido.');
        return capa;
      }
      return fail('Una capa del diseño no es válida.');
    });
  }
  if (!Object.keys(limpias).length) fail('Agrega un texto o una foto antes de guardar.');
  return limpias;
}

/**
 * deps: { db, bucket, FieldValue, render (crearRender), descargar(url) → Buffer, ahora() }.
 * Devuelve lo que se guardó en el diseño.
 */
async function generarArchivosCreacion({ uid, designId, deps, fail }) {
  if (!uid) fail('Inicia sesión para guardar tu creación.', 'unauthenticated');
  if (!validId(designId)) fail('No encontramos esa creación.');
  const { db, bucket, FieldValue, render, descargar, ahora = Date.now } = deps;
  const ref = db.collection('designs').doc(designId);
  // Un dibujo a la vez por creación (es pesado): se marca y se suelta al terminar.
  const diseno = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : null;
    if (!d || d.userId !== uid) fail('No encontramos esa creación.', 'not-found');
    if (d.tipo !== 'crear' || (d.combo && typeof d.combo === 'object')) fail('Esta creación se guarda en wala.pe.');
    if (d.generandoDesde && ahora() - d.generandoDesde < BLOQUEO_MS) fail('Ya estamos preparando esta creación. Espera un momento.', 'resource-exhausted');
    tx.update(ref, { generandoDesde: ahora() });
    return d;
  });
  try {
    const productoSnap = await db.collection('productos_wala').doc(String(diseno.productId || '')).get();
    const producto = productoSnap.exists ? productoSnap.data() : null;
    if (!producto || producto.esPrendaBase !== true || producto.deleted === true || producto.visible === false) fail('La prenda de esta creación ya no está disponible.');
    const colorId = diseno.color && diseno.color.id != null ? String(diseno.color.id) : '';
    const { vistas, color } = render.leerPrenda(producto, colorId);
    if (!color) fail('El color de esta creación ya no está disponible. Elige otro y vuelve a guardar.');
    const zonas = new Set(vistas.flatMap((v) => v.zonas.map((z) => z.id)));
    const capas = validarCapas(diseno.layersByView, zonas, uid, bucket.name, fail);
    const fotosPrenda = new Set(vistas.flatMap((v) => [color.fotos[v.id], v.imagen, v.encima].filter(Boolean)));
    const cargar = async (src) => {
      const ruta = rutaPropia(src, uid, bucket.name);
      if (ruta) {
        const [buffer] = await bucket.file(ruta).download();
        if (buffer.length > MAX_IMAGEN) fail('Una foto del diseño pesa demasiado.');
        return buffer;
      }
      if (!fotosPrenda.has(src)) fail('Una imagen del diseño no es válida.');
      return descargar(src);
    };
    const out = await render.generarArchivos({ producto, colorId, capas, cargar });

    const marca = ahora();
    const subir = async (buffer, ruta, contentType) => {
      const token = randomUUID();
      await bucket.file(ruta).save(buffer, { resumable: false, contentType, metadata: { cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: token } } });
      return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`;
    };
    const archivosImpresion = [];
    for (const archivo of out.impresion) {
      archivosImpresion.push({ ...archivo.datos, url: await subir(archivo.buffer, `designs/${uid}/crear/impresion/${marca}_${archivo.zonaId}.png`, 'image/png') });
    }
    const vistasPrevias = [];
    for (const previa of out.previas) {
      vistasPrevias.push({ ...previa.datos, url: await subir(previa.buffer, `designs/${uid}/crear/previas/${marca}_${previa.vistaId}.jpg`, 'image/jpeg') });
    }
    const imagenConjunta = await subir(out.conjunta, `designs/${uid}/crear/previas/${marca}_conjunto.jpg`, 'image/jpeg');
    const previewUrl = vistasPrevias[0] ? vistasPrevias[0].url : imagenConjunta;
    const cambios = { archivosImpresion, vistasPrevias, imagenConjunta, previewUrl, estado: 'guardada', miniaturas: FieldValue.delete(),
      color: { id: color.id, nombre: color.nombre, hex: color.hex, ...(color.hex2 && { hex2: color.hex2 }) },
      productName: producto.name || diseno.productName || '', generandoDesde: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() };
    await ref.update(cambios);

    // Los archivos anteriores se borran, salvo si la creación ya está en un pedido (congelarDisenos copió los suyos).
    if (diseno.enPedido !== true) {
      const viejos = [...(diseno.archivosImpresion || []), ...(diseno.vistasPrevias || [])].map((a) => a && a.url).concat(diseno.imagenConjunta)
        .map((url) => rutaPropia(url, uid, bucket.name)).filter((ruta) => ruta && ruta.startsWith(`designs/${uid}/crear/`));
      await Promise.all(viejos.map((ruta) => bucket.file(ruta).delete().catch(() => null)));
    }
    return { archivosImpresion, vistasPrevias, imagenConjunta, previewUrl };
  } catch (error) {
    await ref.update({ generandoDesde: FieldValue.delete() }).catch(() => null);
    throw error;
  }
}

module.exports = { generarArchivosCreacion, rutaPropia, validarCapas };
