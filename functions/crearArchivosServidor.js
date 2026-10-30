/**
 * generarArchivosCreacionSecure: para la app, el servidor dibuja los archivos de una creación de Crear (opción B de
 * wala-mobile/docs/CREAR.md) con el mismo código de fabric que la web (crearRender.js) y la deja guardada.
 *
 * Solo el dueño y solo `tipo: 'crear'`; una prenda de un combo (`combo: {id, pieza}`) debe ser una pieza que se diseña de
 * ese combo. Las fotos del diseño deben ser archivos del propio cliente en Storage (`designs/{uid}/…`), las del diseño de
 * la comunidad del que parte (`comunidad/{basadoEn}/…`) o las de las plantillas del producto; las propias y las de la
 * comunidad se leen del bucket, nunca de una URL cualquiera; las fotos de la prenda vienen de la configuración del producto. Las capas se validan antes de dibujar. Los archivos quedan en las mismas rutas que usa
 * la web (`designs/{uid}/crear/impresion|previas/…`), así el pago móvil y congelarDisenos los reconocen.
 */
const { randomUUID } = require('node:crypto');

const MAX_CAPAS = 40;
const MAX_TEXTO = 120;
const MAX_IMAGEN = 25 * 1024 * 1024;
const BLOQUEO_MS = 3 * 60 * 1000;
const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
const finito = (n) => typeof n === 'number' && Number.isFinite(n);

/**
 * node-canvas solo lee PNG y JPEG: una foto en otro formato (las de productos_v2 son WebP; también AVIF, GIF, TIFF)
 * pasa a PNG con sharp antes de dibujar. Un PNG o JPEG va tal cual.
 */
const esPngOJpeg = (b) => b.length > 3 && ((b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) || (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff));
async function paraCanvas(buffer, convertir) {
  if (esPngOJpeg(buffer)) return buffer;
  try {
    return await convertir(buffer);
  } catch {
    return buffer;
  }
}
const aPng = (buffer) => require('sharp')(buffer, { limitInputPixels: 40_000_000 }).png().toBuffer();

/** La ruta en el bucket de una URL de descarga de Storage, solo si está bajo esa carpeta. */
function rutaEn(url, bucket, carpeta) {
  const m = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?]+)(\?.*)?$/.exec(String(url || ''));
  if (!m || m[1] !== bucket) return null;
  let ruta;
  try { ruta = decodeURIComponent(m[2]); } catch { return null; }
  return ruta.startsWith(carpeta) && !ruta.includes('..') ? ruta : null;
}
/** La ruta en el bucket de una URL de descarga de Storage, solo si es del propio cliente. */
const rutaPropia = (url, uid, bucket) => rutaEn(url, bucket, `designs/${uid}/`);
/** Las fotos del diseño publicado en la comunidad del que parte esta creación (basadoEn). */
const rutaComunidad = (url, basadoEn, bucket) => (validId(basadoEn) ? rutaEn(url, bucket, `comunidad/${basadoEn}/`) : null);

/** Todas las URL de archivos que usa un diseño (o un "Mi combo"): no se borran mientras otro las use. */
function urlsDeDiseno(d) {
  const urls = [d.previewUrl, d.imagenConjunta, d.miniatura, ...(Array.isArray(d.previas) ? d.previas : [])];
  for (const lista of [d.archivosImpresion, d.vistasPrevias, d.miniaturas]) if (Array.isArray(lista)) urls.push(...lista.map((a) => a && a.url));
  if (Array.isArray(d.piezas)) for (const p of d.piezas) urls.push(p && p.frente, p && p.espalda);
  return urls.filter((u) => typeof u === 'string' && u);
}

/** Las imágenes de las plantillas del producto ("Empieza con un diseño": la flecha de la esclava, un marco): las pone el admin. */
function imagenesDePlantillas(producto) {
  const plantillas = Array.isArray(producto?.prendaBase?.plantillas) ? producto.prendaBase.plantillas : [];
  const srcs = new Set();
  for (const p of plantillas) for (const lista of Object.values(p?.capas || {})) {
    if (Array.isArray(lista)) for (const c of lista) if (c?.type === 'image' && typeof c.src === 'string' && /^https:\/\//.test(c.src)) srcs.add(c.src);
  }
  return srcs;
}

/** Capas que se pueden dibujar: zonas de la prenda, tipos conocidos, números finitos, fotos propias, de su diseño de la comunidad o de las plantillas del producto. */
function validarCapas(capas, zonasValidas, uid, bucket, fail, deProducto = new Set(), basadoEn = null) {
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
        if (!(rutaPropia(capa.src, uid, bucket) || rutaComunidad(capa.src, basadoEn, bucket) || deProducto.has(capa.src)) || !(capa.anchoNatural > 0) || !(capa.altoNatural > 0)) {
          fail('Una foto del diseño no es tuya o no terminó de subirse.');
        }
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
 * deps: { db, bucket, FieldValue, render (crearRender), descargar(url) → Buffer, ahora(), convertir(buffer) → PNG (sharp) }.
 * Devuelve lo que se guardó en el diseño.
 */
async function generarArchivosCreacion({ uid, designId, deps, fail }) {
  if (!uid) fail('Inicia sesión para guardar tu creación.', 'unauthenticated');
  if (!validId(designId)) fail('No encontramos esa creación.');
  const { db, bucket, FieldValue, render, descargar, ahora = Date.now, convertir = aPng } = deps;
  const ref = db.collection('designs').doc(designId);
  // Un dibujo a la vez por creación (es pesado): se marca y se suelta al terminar.
  const diseno = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : null;
    if (!d || d.userId !== uid) fail('No encontramos esa creación.', 'not-found');
    if (d.tipo !== 'crear') fail('Esta creación se guarda en wala.pe.');
    if (d.generandoDesde && ahora() - d.generandoDesde < BLOQUEO_MS) fail('Ya estamos preparando esta creación. Espera un momento.', 'resource-exhausted');
    tx.update(ref, { generandoDesde: ahora() });
    return d;
  });
  try {
    const productoSnap = await db.collection('productos_wala').doc(String(diseno.productId || '')).get();
    const producto = productoSnap.exists ? productoSnap.data() : null;
    if (!producto || producto.esPrendaBase !== true || producto.deleted === true || producto.visible === false) fail('La prenda de esta creación ya no está disponible.');
    // Una prenda de un combo: el combo existe y esa pieza es esta prenda y se diseña (no una que se vende tal cual).
    if (diseno.combo && typeof diseno.combo === 'object') {
      const comboId = String(diseno.combo.id || ''); const pieza = diseno.combo.pieza;
      if (!validId(comboId) || !Number.isInteger(pieza) || pieza < 0 || pieza > 3) fail('Esta prenda no pertenece a un combo válido.');
      const comboSnap = await db.collection('productos_wala').doc(comboId).get();
      const combo = comboSnap.exists ? comboSnap.data() : null;
      const esperada = combo && combo.esComboCrear === true && combo.deleted !== true && combo.comboCrear && Array.isArray(combo.comboCrear.piezas)
        ? combo.comboCrear.piezas[pieza] : null;
      if (!esperada || esperada.fija || esperada.prendaId !== diseno.productId) fail('Esta prenda ya no está en ese combo.');
    }
    const colorId = diseno.color && diseno.color.id != null ? String(diseno.color.id) : '';
    const { vistas, color } = render.leerPrenda(producto, colorId);
    if (!color) fail('El color de esta creación ya no está disponible. Elige otro y vuelve a guardar.');
    const zonas = new Set(vistas.flatMap((v) => v.zonas.map((z) => z.id)));
    const dePlantillas = imagenesDePlantillas(producto);
    const basadoEn = typeof diseno.basadoEn === 'string' ? diseno.basadoEn : null;
    const capas = validarCapas(diseno.layersByView, zonas, uid, bucket.name, fail, dePlantillas, basadoEn);
    const fotosPrenda = new Set([...vistas.flatMap((v) => [color.fotos[v.id], v.imagen, v.encima].filter(Boolean)), ...dePlantillas]);
    const cargar = async (src) => {
      const ruta = rutaPropia(src, uid, bucket.name) || rutaComunidad(src, basadoEn, bucket.name);
      if (ruta) {
        const [buffer] = await bucket.file(ruta).download();
        if (buffer.length > MAX_IMAGEN) fail('Una foto del diseño pesa demasiado.');
        return paraCanvas(buffer, convertir);
      }
      if (!fotosPrenda.has(src)) fail('Una imagen del diseño no es válida.');
      return paraCanvas(await descargar(src), convertir);
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

    // Los archivos anteriores se borran, salvo si la creación ya está en un pedido (congelarDisenos copió los suyos) o si
    // otro diseño del cliente los usa (las copias de un combo y "Llevar en combo" comparten los mismos archivos).
    if (diseno.enPedido !== true) {
      const viejos = [...(diseno.archivosImpresion || []), ...(diseno.vistasPrevias || [])].map((a) => a && a.url).concat(diseno.imagenConjunta)
        .map((url) => rutaPropia(url, uid, bucket.name)).filter((ruta) => ruta && ruta.startsWith(`designs/${uid}/crear/`));
      if (viejos.length) {
        const otros = await db.collection('designs').where('userId', '==', uid).get();
        const enUso = new Set();
        otros.forEach((doc) => { if (doc.id !== designId) urlsDeDiseno(doc.data() || {}).forEach((url) => { const ruta = rutaPropia(url, uid, bucket.name); if (ruta) enUso.add(ruta); }); });
        await Promise.all(viejos.filter((ruta) => !enUso.has(ruta)).map((ruta) => bucket.file(ruta).delete().catch(() => null)));
      }
    }
    return { archivosImpresion, vistasPrevias, imagenConjunta, previewUrl };
  } catch (error) {
    await ref.update({ generandoDesde: FieldValue.delete() }).catch(() => null);
    throw error;
  }
}

/**
 * generarMiniaturasBorradorSecure: las miniaturas de un borrador de la app (la web las dibuja en el navegador al
 * autoguardar). Se dibujan con el mismo código de las vistas previas, a 420 px, y se guardan como la web: `miniatura` y
 * `miniaturas[{vista, nombre, url}]` con la imagen dentro (data URL). Solo el dueño y solo borradores; si el diseño
 * cambió mientras se dibujaba, no se escriben (la próxima llamada las pone al día).
 */
async function generarMiniaturasBorrador({ uid, designId, deps, fail }) {
  if (!uid) fail('Inicia sesión para guardar tu borrador.', 'unauthenticated');
  if (!validId(designId)) fail('No encontramos ese borrador.');
  const { db, bucket, render, descargar, convertir = aPng } = deps;
  const ref = db.collection('designs').doc(designId);
  const snap = await ref.get();
  const diseno = snap.exists ? snap.data() : null;
  if (!diseno || diseno.userId !== uid) fail('No encontramos ese borrador.', 'not-found');
  if (diseno.tipo !== 'crear' || diseno.estado !== 'borrador') return { miniaturas: [] };
  const productoSnap = await db.collection('productos_wala').doc(String(diseno.productId || '')).get();
  const producto = productoSnap.exists ? productoSnap.data() : null;
  if (!producto || producto.esPrendaBase !== true || producto.deleted === true) fail('La prenda de este borrador ya no está disponible.');
  const colorId = diseno.color && diseno.color.id != null ? String(diseno.color.id) : '';
  const { vistas, color } = render.leerPrenda(producto, colorId);
  if (!color) fail('El color de este borrador ya no está disponible.');
  const zonas = new Set(vistas.flatMap((v) => v.zonas.map((z) => z.id)));
  const capasGuardadas = diseno.layersByView && typeof diseno.layersByView === 'object' ? diseno.layersByView : {};
  const hayCapas = Object.values(capasGuardadas).some((lista) => Array.isArray(lista) && lista.length);
  const dePlantillas = imagenesDePlantillas(producto);
  const basadoEn = typeof diseno.basadoEn === 'string' ? diseno.basadoEn : null;
  const capas = hayCapas ? validarCapas(capasGuardadas, zonas, uid, bucket.name, fail, dePlantillas, basadoEn) : {};
  const fotosPrenda = new Set([...vistas.flatMap((v) => [color.fotos[v.id], v.imagen, v.encima].filter(Boolean)), ...dePlantillas]);
  const cargar = async (src) => {
    const ruta = rutaPropia(src, uid, bucket.name) || rutaComunidad(src, basadoEn, bucket.name);
    if (ruta) {
      const [buffer] = await bucket.file(ruta).download();
      if (buffer.length > MAX_IMAGEN) fail('Una foto del diseño pesa demasiado.');
      return paraCanvas(buffer, convertir);
    }
    if (!fotosPrenda.has(src)) fail('Una imagen del diseño no es válida.');
    return paraCanvas(await descargar(src), convertir);
  };
  const dibujos = await render.generarMiniaturas({ producto, colorId, capas, cargar });
  const miniaturas = dibujos.map((m) => ({ vista: m.vistaId, nombre: m.nombre, url: `data:image/jpeg;base64,${m.buffer.toString('base64')}` }));
  const firma = JSON.stringify(capasGuardadas);
  const escritas = await db.runTransaction(async (tx) => {
    const ahora = await tx.get(ref);
    const d = ahora.exists ? ahora.data() : null;
    if (!d || d.userId !== uid || d.estado !== 'borrador' || JSON.stringify(d.layersByView || {}) !== firma) return false;
    tx.update(ref, { miniatura: miniaturas[0] ? miniaturas[0].url : '', miniaturas });
    return true;
  });
  return { miniaturas: escritas ? miniaturas.map(({ vista, nombre }) => ({ vista, nombre })) : [] };
}

module.exports = { generarArchivosCreacion, generarMiniaturasBorrador, rutaPropia, validarCapas, urlsDeDiseno };
