/**
 * Mis creaciones desde la app: borrar una creación o un "Mi combo" y "Llevar en combo". Hace lo mismo que la web
 * (services/designs.js eliminarCreacion, misCombos.js eliminarMiComboConPrendas y copiarCreacionParaCombo), pero en el
 * servidor: solo el dueño, sin borrar archivos que otro diseño suyo use ni los de un pedido, y las copias de un combo
 * llevan sus archivos de impresión (que el cliente no escribe).
 */
const { rutaPropia, urlsDeDiseno } = require('./crearArchivosServidor');

const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
/** Todo lo que un diseño usa de su carpeta: archivos, vistas previas, fotos de "Mi combo" y las fotos de sus capas. */
function rutasDeDiseno(d, uid, bucket) {
  const urls = [...urlsDeDiseno(d)];
  const capas = [...(Array.isArray(d.layers) ? d.layers : []), ...Object.values(d.layersByView || {}).flat()];
  for (const capa of capas) if (capa && capa.type === 'image') urls.push(capa.src);
  return new Set(urls.map((url) => rutaPropia(url, uid, bucket)).filter(Boolean));
}
const esMiCombo = (d) => d && d.tipo === 'comboCrear';
const usadaPorCombo = (disenos, designId, excepto = null) => disenos.some(([id, d]) => id !== excepto && esMiCombo(d)
  && Array.isArray(d.piezas) && d.piezas.some((p) => p && p.designId === designId));
/** sePuedeBorrarSola de la web, sin el carrito (la app quita sus líneas después). */
const sePuedeBorrar = (d) => d.enPedido !== true && d.comunidad !== 'publicada';

async function disenosDe(db, uid) {
  const snap = await db.collection('designs').where('userId', '==', uid).get();
  const lista = [];
  snap.forEach((doc) => lista.push([doc.id, doc.data() || {}]));
  return lista;
}
/** Borra los archivos de esos diseños que ningún otro diseño del cliente usa (nunca si alguno está en un pedido). */
async function borrarArchivos({ bucket, uid, disenos, borrados }) {
  const quedan = new Set();
  for (const [id, d] of disenos) if (!borrados.has(id)) rutasDeDiseno(d, uid, bucket.name).forEach((r) => quedan.add(r));
  const rutas = new Set();
  for (const [id, d] of disenos) if (borrados.has(id) && d.enPedido !== true) rutasDeDiseno(d, uid, bucket.name).forEach((r) => { if (!quedan.has(r)) rutas.add(r); });
  await Promise.all([...rutas].map((ruta) => bucket.file(ruta).delete().catch(() => null)));
  return rutas.size;
}

/**
 * Elimina una creación (y sus archivos que nadie más usa, salvo si está en un pedido) o un "Mi combo" con sus prendas
 * hechas para él. Una prenda de un combo no se borra sola. Un "Mi combo" en un pedido, o con una prenda que no se puede
 * borrar, se archiva en vez de borrarse (como la web).
 */
async function eliminarCreacion({ uid, designId, deps, fail }) {
  if (!uid) fail('Inicia sesión para continuar.', 'unauthenticated');
  if (!validId(designId)) fail('No encontramos esa creación.');
  const { db, bucket, FieldValue, ahora = Date.now } = deps;
  const disenos = await disenosDe(db, uid);
  const diseno = disenos.find(([id]) => id === designId)?.[1];
  if (!diseno || diseno.userId !== uid) fail('No encontramos esa creación.', 'not-found');
  const ref = db.collection('designs').doc(designId);

  if (esMiCombo(diseno)) {
    const ids = [...new Set((diseno.piezas || []).map((p) => p && p.designId).filter(validId))];
    const propias = ids.filter((id) => !usadaPorCombo(disenos, id, designId))
      .map((id) => disenos.find(([x]) => x === id)).filter((par) => par && par[1].userId === uid && par[1].combo && par[1].combo.id);
    const quedan = propias.filter(([, d]) => !sePuedeBorrar(d));
    const archivar = diseno.enPedido === true || quedan.length > 0;
    if (archivar) await ref.update({ archivado: true, archivadoEn: ahora(), updatedAt: FieldValue.serverTimestamp() });
    else await ref.delete();
    const borrables = propias.filter(([, d]) => sePuedeBorrar(d));
    await Promise.all(borrables.map(([id]) => db.collection('designs').doc(id).delete()));
    const borrados = new Set([...(archivar ? [] : [designId]), ...borrables.map(([id]) => id)]);
    await borrarArchivos({ bucket, uid, disenos, borrados });
    return { archivado: archivar, prendasBorradas: borrables.map(([id]) => id) };
  }

  if (usadaPorCombo(disenos, designId)) fail('Esta prenda es parte de tu combo: quítala del combo o borra el combo.');
  await ref.delete();
  const archivos = await borrarArchivos({ bucket, uid, disenos, borrados: new Set([designId]) });
  return { archivado: false, archivosBorrados: archivos };
}

/**
 * "Llevar en combo": una copia de la creación en cada pieza del combo que es su misma prenda (se diseña, no va tal
 * cual), con su diseño, color, talla y archivos, y un "Mi combo" nuevo con esas piezas. La creación sigue igual.
 */
async function llevarEnCombo({ uid, designId, comboId, deps, fail }) {
  if (!uid) fail('Inicia sesión para continuar.', 'unauthenticated');
  if (!validId(designId) || !validId(comboId)) fail('No encontramos esa creación o ese combo.');
  const { db, FieldValue } = deps;
  const [snap, comboSnap] = await Promise.all([db.collection('designs').doc(designId).get(), db.collection('productos_wala').doc(comboId).get()]);
  const d = snap.exists ? snap.data() : null;
  if (!d || d.userId !== uid) fail('No encontramos esa creación.', 'not-found');
  if (d.tipo !== 'crear' || (d.combo && typeof d.combo === 'object')) fail('Esta creación no se puede llevar a un combo.');
  if (d.estado === 'borrador' || !(d.archivosImpresion || []).length || !(d.vistasPrevias || []).length) fail('Termina y guarda tu creación antes de llevarla en combo.');
  const combo = comboSnap.exists ? comboSnap.data() : null;
  const piezas = combo && combo.esComboCrear === true && combo.deleted !== true && combo.comboCrear && combo.comboCrear.publicado === true
    && Array.isArray(combo.comboCrear.piezas) ? combo.comboCrear.piezas : [];
  const indices = piezas.map((p, i) => (p && !p.fija && p.prendaId === d.productId ? i : -1)).filter((i) => i >= 0);
  if (piezas.length < 2 || !indices.length) fail('Ese combo ya no está disponible para esta prenda.');
  const nombre = String(combo.name || 'Combo').slice(0, 120);
  const ahora = FieldValue.serverTimestamp();
  const lote = db.batch();
  const copias = new Map();
  for (const pieza of indices) {
    const copia = db.collection('designs').doc();
    copias.set(pieza, copia.id);
    lote.set(copia, Object.fromEntries(Object.entries({ userId: uid, tipo: 'crear', estado: d.estado, productId: d.productId, productName: d.productName,
      layers: d.layers, layersByView: d.layersByView, variant: d.variant, name: d.name, previewUrl: d.previewUrl, color: d.color,
      archivosImpresion: d.archivosImpresion, vistasPrevias: d.vistasPrevias, imagenConjunta: d.imagenConjunta, miniatura: d.miniatura, miniaturas: d.miniaturas,
      basadoEn: d.basadoEn, combo: { id: comboId, nombre, pieza }, createdAt: ahora, updatedAt: ahora }).filter(([, v]) => v !== undefined && v !== null && v !== '')));
  }
  const vistas = (d.vistasPrevias || []).map((v) => v && v.url).filter(Boolean);
  const talla = d.variant && typeof d.variant.size === 'string' ? d.variant.size : '';
  const lista = piezas.map((p, i) => {
    if (copias.has(i)) return { designId: copias.get(i), prendaId: p.prendaId, nombre: p.nombre || d.productName || '', ...(talla && { talla }),
      ...(vistas[0] && { frente: vistas[0] }), ...(vistas[1] && { espalda: vistas[1] }), ...(d.color && { color: d.color }) };
    if (p.fija) return { prendaId: p.prendaId, fija: true, nombre: p.nombre || '', ...(p.imagen && { frente: p.imagen }), ...(p.color && { color: p.color }) };
    return { prendaId: p.prendaId, nombre: p.nombre || '' };
  });
  const mio = db.collection('designs').doc();
  const listo = lista.every((p) => p.fija || p.designId);
  lote.set(mio, { userId: uid, tipo: 'comboCrear', name: nombre.slice(0, 60), estado: listo ? 'guardada' : 'borrador', comboId, comboNombre: nombre,
    piezas: lista, createdAt: ahora, updatedAt: ahora });
  await lote.commit();
  return { miComboId: mio.id, piezas: [...copias.keys()] };
}

module.exports = { eliminarCreacion, llevarEnCombo };
