/**
 * RESCATE DE HISTORIAL — tombstones para productos borrados físicamente.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * POR QUÉ EXISTE
 *   Hasta ahora deleteProduct (src/services/products.js) hacía borrado FÍSICO
 *   del doc en `productos_wala` + sus imágenes de Storage. Todo lo que cruzaba
 *   por productId contra el catálogo vivo quedó roto para esos productos:
 *     - Mis Compras (CuentaPedidosPage cruza productoId → catálogo para la
 *       miniatura/nombre),
 *     - Wishlist / Lista de regalos (WishlistPage/WishlistPublic hacen
 *       `return null` si el producto no está; GiftRegistryPage muestra S/0.00
 *       porque el snapshot de wishlist no guardaba `price`),
 *     - imágenes de wishlist apuntando a Storage borrado (404 → imagen rota).
 *
 *   El borrado NUEVO ya es lógico (tombstone {visible:false, deleted:true,
 *   deletedAt} conservando name/mainImage/images/price/salePrice/brandId).
 *   Este script repara los datos VIEJOS, rotos antes de ese cambio.
 *
 * QUÉ HACE (one-shot, idempotente)
 *   1) Recolecta todos los productoId/productId referenciados en:
 *        - wishlists        → items[].productId
 *        - wala_pedidos     → productos[].productoId (espejo del portal)
 *        - pedidos_web      → productos (map o array) → productoId
 *                             + subProductos de combos → productoId
 *        - pedidos          → ídem, SOLO docs que cumplen esPedidoWala
 *                             (los pedidos aprobados que el ERP movió aquí)
 *   2) Para cada id que NO exista en `productos_wala` crea un TOMBSTONE mínimo:
 *        { name:  mejor nombre disponible (wishlist.productName o
 *                 línea.producto/nombre de pedido),
 *          price: precio de la línea de pedido MÁS RECIENTE con ese id,
 *                 o wishlist.price, o 0,
 *          mainImage: "", visible: false, deleted: true,
 *          deletedAt: <ISO string>, rescatado: true }
 *      (+ brandId si alguna línea de pedido lo traía — ayuda al WhatsApp por
 *       marca en Mis Compras; campo opcional, no rompe nada si falta.)
 *      Con esto los cruces por id vuelven a resolver nombre/precio.
 *   3) Para cada item de wishlist cuyo productImage sea URL de firebasestorage:
 *      verifica con fetch HEAD si responde; si 404/error → productImage: ""
 *      (la UI cae a placeholder limpio). Además backfillea `price` (number) si
 *      falta y hay precio de pedido o de tombstone para ese producto.
 *   4) Reporta resumen contable (ids huérfanos, tombstones creados, imágenes
 *      limpiadas, prices backfilleados).
 *
 * QUÉ ESCRIBE — RESTRICCIÓN ABSOLUTA
 *   SOLO escribe en `productos_wala` y `wishlists` (colecciones del portal).
 *   `pedidos_web`, `pedidos` y `wala_pedidos` se leen en modo SOLO LECTURA.
 *   Jamás toca colecciones del ERP. Batches de 400 ops por commit.
 *
 * IDEMPOTENTE
 *   Segunda corrida: los tombstones ya existen en `productos_wala` (dejan de
 *   ser huérfanos), las imágenes rotas ya están en "" (no son URL de Storage)
 *   y los price ya están puestos → no escribe nada.
 *
 * SEGURIDAD
 *   - DRY-RUN por defecto: lee, calcula, verifica URLs y reporta, NO escribe.
 *   - Para escribir hay que pasar --apply explícitamente.
 *
 * USO EXACTO (Cloud Shell, ya autenticado)
 *   cd ~/wala-master
 *   gcloud config set project sistema-gestion-3b225   # si hace falta
 *
 *   # 1) DRY-RUN (por defecto, NO escribe): muestra qué se crearía/limpiaría.
 *   node scripts/rescate-historial.js --project sistema-gestion-3b225
 *
 *   # 2) APLICAR de verdad (escribe en lotes de 400):
 *   node scripts/rescate-historial.js --project sistema-gestion-3b225 --apply
 *
 *   Local con service account:
 *     export GOOGLE_APPLICATION_CREDENTIALS="/ruta/serviceAccount.json"
 *     node scripts/rescate-historial.js --project sistema-gestion-3b225
 *
 *   Flags:
 *     --apply          Escribe los cambios. Sin este flag = DRY-RUN.
 *     --project <id>   Proyecto destino (default: sistema-gestion-3b225).
 *     --limit <n>      Lee solo los primeros n docs por colección (para probar).
 */

'use strict';

let initializeApp, applicationDefault, getFirestore;
try {
  ({ initializeApp, applicationDefault } = require('firebase-admin/app'));
  ({ getFirestore } = require('firebase-admin/firestore'));
} catch (e) {
  console.error('No se pudo cargar "firebase-admin".');
  console.error('Instálalo dentro de wala-master:  npm install firebase-admin');
  process.exit(1);
}

// ── Constantes ───────────────────────────────────────────────────────────────
const DEFAULT_PROJECT_ID = 'sistema-gestion-3b225'; // producción real (.firebaserc default)
const BATCH_SIZE = 400; // < 500 (límite de Firestore por batch), con margen.
const HEAD_TIMEOUT_MS = 10000; // timeout por verificación de imagen
const HEAD_CONCURRENCIA = 6; // verificaciones de URL en paralelo

// Colecciones del PORTAL (únicas donde se ESCRIBE):
const COLL_PRODUCTOS = 'productos_wala';
const COLL_WISHLISTS = 'wishlists';
// Colecciones SOLO LECTURA (pedidos; wala_pedidos es espejo del portal pero
// aquí también se trata como solo lectura):
const COLL_WALA_PEDIDOS = 'wala_pedidos';
const COLL_PEDIDOS_WEB = 'pedidos_web';
const COLL_PEDIDOS = 'pedidos';

// ── Parseo de argumentos ─────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const getOpt = (name, def = null) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
};

const apply = hasFlag('--apply'); // sin --apply => DRY-RUN
const limit = getOpt('--limit') ? parseInt(getOpt('--limit'), 10) : null;

function resolveProjectId() {
  const fromFlag = getOpt('--project');
  if (fromFlag) return fromFlag;
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  const sa = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (sa) {
    try {
      const fs = require('fs');
      const parsed = JSON.parse(fs.readFileSync(sa, 'utf8'));
      if (parsed && parsed.project_id) return parsed.project_id;
    } catch (e) {
      /* cae al default */
    }
  }
  return DEFAULT_PROJECT_ID;
}

const projectId = resolveProjectId();

// ── Inicializar Admin SDK (API modular) ──────────────────────────────────────
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

// ── Helpers de datos ─────────────────────────────────────────────────────────

/** Convierte createdAt (Timestamp/string/number/Date) a milisegundos; 0 si no hay. */
function aMillis(v) {
  if (v == null) return 0;
  if (typeof v === 'object' && typeof v.toDate === 'function') {
    try { return v.toDate().getTime(); } catch (e) { return 0; }
  }
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

/** Número finito o null (los precios de líneas pueden venir string/null). */
function numeroONull(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * Líneas de producto de un pedido como array, soportando formato array y
 * formato mapa del ERP ({ item_0: {...}, ... }). Mismo criterio que
 * src/services/walaOrders.js → productosComoArray.
 */
function productosComoArray(productos) {
  if (productos == null) return [];
  if (Array.isArray(productos)) return productos.filter(Boolean);
  if (typeof productos === 'object') return Object.values(productos).filter(Boolean);
  return [];
}

/** Misma regla WALA que src/services/adminOrders.js (para filtrar `pedidos`). */
function esPedidoWala(p) {
  return (
    !!p &&
    (p.canalVenta === 'Portal Web' ||
      p.web === true ||
      p.activador === 'portal_web' ||
      p.vendedor === 'Portal Web')
  );
}

/** Id válido como doc id de productos_wala (no vacío, sin '/'). */
function idValido(id) {
  if (id == null) return false;
  const s = String(id).trim();
  return s.length > 0 && !s.includes('/');
}

/** ¿La URL apunta a Firebase Storage? (solo esas se verifican/limpian). */
function esUrlDeStorage(url) {
  return (
    typeof url === 'string' &&
    /^https?:\/\//i.test(url) &&
    (url.includes('firebasestorage.googleapis.com') || url.includes('firebasestorage.app'))
  );
}

// ── Acumuladores globales ────────────────────────────────────────────────────

// id → { nombre, tsNombre, precio, tsPrecio, brandId, tsBrand }
// Nos quedamos con el nombre/precio/brandId de la línea de pedido MÁS RECIENTE.
const infoPedidos = new Map();
// id → { nombre, precio } tomados del snapshot de wishlist (primer no-vacío).
const infoWishlist = new Map();
// Todos los ids referenciados en cualquier fuente.
const idsReferenciados = new Set();

/** Registra una línea de pedido (nombre/precio/brandId con recencia por ts). */
function registrarLinea(id, nombre, precio, brandId, ts) {
  if (!idValido(id)) return;
  const key = String(id).trim();
  idsReferenciados.add(key);
  let info = infoPedidos.get(key);
  if (!info) {
    info = { nombre: null, tsNombre: -1, precio: null, tsPrecio: -1, brandId: null, tsBrand: -1 };
    infoPedidos.set(key, info);
  }
  const nom = nombre == null ? '' : String(nombre).trim();
  if (nom && ts >= info.tsNombre) {
    info.nombre = nom;
    info.tsNombre = ts;
  }
  const pre = numeroONull(precio);
  if (pre != null && ts >= info.tsPrecio) {
    info.precio = pre;
    info.tsPrecio = ts;
  }
  if (brandId && ts >= info.tsBrand) {
    info.brandId = String(brandId);
    info.tsBrand = ts;
  }
}

/** Recorre una colección de pedidos (SOLO LECTURA) y registra sus líneas. */
async function escanearPedidos(coll, soloWala) {
  let q = db.collection(coll);
  if (limit) q = q.limit(limit);
  const snap = await q.get();
  let usados = 0;
  snap.forEach((doc) => {
    const d = doc.data() || {};
    if (soloWala && !esPedidoWala(d)) return; // en `pedidos` conviven pedidos nativos del ERP
    usados += 1;
    const ts = aMillis(d.createdAt ?? d.fecha ?? null);
    for (const l of productosComoArray(d.productos)) {
      // Línea principal (pedidos_web/pedidos: producto · wala_pedidos: nombre).
      registrarLinea(l.productoId ?? l.productId, l.producto ?? l.nombre, l.precio, l.brandId, ts);
      // Sub-productos de combos (sin precio propio; solo nombre para tombstone).
      for (const s of productosComoArray(l.subProductos)) {
        registrarLinea(s.productoId ?? s.productId, s.producto ?? s.nombre, null, s.brandId, ts);
      }
    }
  });
  console.log(`  ${coll}: ${snap.size} docs leídos${soloWala ? `, ${usados} son WALA` : ''}.`);
}

// ── Verificación de imágenes (fetch HEAD con timeout) ────────────────────────

const cacheUrl = new Map(); // url → 'viva' | 'rota' | 'error'

/** Devuelve 'viva' (2xx/3xx), 'rota' (4xx/5xx, p.ej. 404 de Storage borrado) o 'error' (red). */
async function verificarUrl(url) {
  if (cacheUrl.has(url)) return cacheUrl.get(url);
  let estado = 'error';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT_MS);
    try {
      const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow' });
      estado = res.status < 400 ? 'viva' : 'rota';
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    estado = 'error'; // timeout / DNS / red — se trata como rota (spec: 404/error → limpiar)
  }
  cacheUrl.set(url, estado);
  return estado;
}

/** Verifica un lote de URLs únicas con concurrencia limitada. */
async function verificarUrls(urls) {
  const cola = [...urls];
  const workers = [];
  for (let w = 0; w < Math.min(HEAD_CONCURRENCIA, cola.length); w++) {
    workers.push(
      (async () => {
        while (cola.length > 0) {
          const url = cola.shift();
          if (url) await verificarUrl(url);
        }
      })()
    );
  }
  await Promise.all(workers);
}

// ── Flujo principal ──────────────────────────────────────────────────────────
(async () => {
  console.log('────────────────────────────────────────────────────────────');
  console.log(' Rescate de historial · tombstones + wishlist');
  console.log('   Proyecto destino : ' + projectId);
  console.log('   Modo             : ' + (apply ? 'APLICAR (--apply: escribe)' : 'DRY-RUN (no escribe)'));
  if (limit) console.log('   Límite           : primeros ' + limit + ' docs por colección');
  console.log('   Escribe SOLO en  : ' + COLL_PRODUCTOS + ', ' + COLL_WISHLISTS);
  console.log('────────────────────────────────────────────────────────────');

  if (typeof fetch !== 'function') {
    console.error('Este script necesita Node 18+ (fetch global) para verificar imágenes.');
    process.exit(1);
  }

  // ── 0) Catálogo actual: qué ids EXISTEN en productos_wala ──────────────────
  // (sin limit: necesitamos el universo completo para detectar huérfanos)
  const snapProductos = await db.collection(COLL_PRODUCTOS).get();
  const productosExistentes = new Map(); // id → data (para precio de tombstones ya existentes)
  snapProductos.forEach((doc) => productosExistentes.set(doc.id, doc.data() || {}));
  console.log('\nFase 0 · catálogo:');
  console.log(`  ${COLL_PRODUCTOS}: ${productosExistentes.size} docs existentes.`);

  // ── 1) Recolectar referencias ───────────────────────────────────────────────
  console.log('\nFase 1 · recolección de referencias (SOLO LECTURA en pedidos):');

  // 1a) wishlists → items[].productId (+ snapshot nombre/precio) — se guarda
  //     el doc completo para la fase 3.
  let qWs = db.collection(COLL_WISHLISTS);
  if (limit) qWs = qWs.limit(limit);
  const snapWishlists = await qWs.get();
  const wishlistDocs = []; // { ref, id, items }
  let itemsWishlistTotal = 0;
  snapWishlists.forEach((doc) => {
    const data = doc.data() || {};
    const items = Array.isArray(data.items) ? data.items : [];
    itemsWishlistTotal += items.length;
    wishlistDocs.push({ ref: doc.ref, id: doc.id, items });
    for (const item of items) {
      if (!item || !idValido(item.productId)) continue;
      const key = String(item.productId).trim();
      idsReferenciados.add(key);
      const info = infoWishlist.get(key) || { nombre: null, precio: null };
      const nom = item.productName == null ? '' : String(item.productName).trim();
      if (nom && !info.nombre) info.nombre = nom;
      const pre = numeroONull(item.price);
      if (pre != null && info.precio == null) info.precio = pre;
      infoWishlist.set(key, info);
    }
  });
  console.log(`  ${COLL_WISHLISTS}: ${snapWishlists.size} docs, ${itemsWishlistTotal} items.`);

  // 1b) pedidos (espejo del portal + colecciones del ERP, solo lectura).
  await escanearPedidos(COLL_WALA_PEDIDOS, false);
  await escanearPedidos(COLL_PEDIDOS_WEB, false);
  await escanearPedidos(COLL_PEDIDOS, true); // los aprobados que el ERP movió aquí

  console.log(`  → ids de producto referenciados en total: ${idsReferenciados.size}`);

  // ── 2) Tombstones para ids huérfanos ────────────────────────────────────────
  console.log('\nFase 2 · tombstones:');
  const nowIso = new Date().toISOString();
  const tombstones = new Map(); // id → data del tombstone a crear
  for (const id of idsReferenciados) {
    if (productosExistentes.has(id)) continue; // el producto (o su tombstone) existe
    const ws = infoWishlist.get(id);
    const ped = infoPedidos.get(id);
    // Mejor nombre disponible del snapshot: wishlist.productName o línea.producto/nombre.
    const name = (ws && ws.nombre) || (ped && ped.nombre) || 'Producto';
    // Precio: línea de pedido más reciente, o wishlist.price, o 0.
    const price = (ped && ped.precio != null) ? ped.precio : ((ws && ws.precio != null) ? ws.precio : 0);
    const tomb = {
      name,
      price,
      mainImage: '',
      visible: false,
      deleted: true,
      deletedAt: nowIso,
      rescatado: true, // marca de que lo creó este script (no un borrado normal)
    };
    // brandId opcional (para el WhatsApp por marca en Mis Compras).
    if (ped && ped.brandId) tomb.brandId = ped.brandId;
    tombstones.set(id, tomb);
  }
  console.log(`  ids huérfanos (sin doc en ${COLL_PRODUCTOS}): ${tombstones.size}`);
  if (tombstones.size > 0) {
    let mostrados = 0;
    for (const [id, t] of tombstones) {
      if (mostrados >= 10) { console.log('     … (' + (tombstones.size - 10) + ' más)'); break; }
      console.log(`     - ${id}  name="${t.name}"  price=${t.price}${t.brandId ? '  brandId=' + t.brandId : ''}`);
      mostrados += 1;
    }
  }

  // ── 3) Wishlists: limpiar imágenes muertas + backfill de price ─────────────
  console.log('\nFase 3 · wishlists (imágenes + price):');

  // 3a) Verificar de una sola vez todas las URLs de Storage únicas.
  const urlsAChequear = new Set();
  for (const w of wishlistDocs) {
    for (const item of w.items) {
      if (item && esUrlDeStorage(item.productImage)) urlsAChequear.add(item.productImage);
    }
  }
  console.log(`  URLs de Storage únicas a verificar (HEAD): ${urlsAChequear.size}`);
  await verificarUrls(urlsAChequear);
  let vivas = 0, rotas = 0, conError = 0;
  for (const estado of cacheUrl.values()) {
    if (estado === 'viva') vivas += 1;
    else if (estado === 'rota') rotas += 1;
    else conError += 1;
  }
  console.log(`     vivas: ${vivas} · rotas (4xx/5xx): ${rotas} · error de red (se limpian): ${conError}`);

  /** Precio de respaldo para un item: línea de pedido más reciente → tombstone. */
  function precioRespaldo(id) {
    const ped = infoPedidos.get(id);
    if (ped && ped.precio != null) return ped.precio;
    const nuevo = tombstones.get(id);
    if (nuevo && numeroONull(nuevo.price) != null) return nuevo.price;
    const existente = productosExistentes.get(id);
    // Solo tombstones existentes (deleted:true): los productos VIVOS resuelven
    // su precio por el cruce con el catálogo en la UI; no hace falta congelarlo.
    if (existente && existente.deleted === true) {
      const p = numeroONull(existente.price) ?? numeroONull(existente.salePrice);
      if (p != null) return p;
    }
    return null;
  }

  // 3b) Reconstruir items por doc (inmutable: solo cambia lo necesario).
  const updatesWishlist = []; // { ref, id, items, imagenesLimpiadas, pricesPuestos }
  let imagenesLimpiadas = 0;
  let pricesPuestos = 0;
  for (const w of wishlistDocs) {
    let cambiado = false;
    let limpiadasDoc = 0;
    let pricesDoc = 0;
    const nuevosItems = w.items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      let nuevo = item;
      // Imagen de Storage muerta → "" (la UI cae a placeholder limpio).
      if (esUrlDeStorage(item.productImage) && cacheUrl.get(item.productImage) !== 'viva') {
        nuevo = { ...nuevo, productImage: '' };
        cambiado = true;
        limpiadasDoc += 1;
      }
      // Backfill de price si falta y hay tombstone/pedido con precio.
      if (numeroONull(item.price) == null && idValido(item.productId)) {
        const p = precioRespaldo(String(item.productId).trim());
        if (p != null) {
          nuevo = { ...nuevo, price: p };
          cambiado = true;
          pricesDoc += 1;
        }
      }
      return nuevo;
    });
    if (cambiado) {
      imagenesLimpiadas += limpiadasDoc;
      pricesPuestos += pricesDoc;
      updatesWishlist.push({ ref: w.ref, id: w.id, items: nuevosItems, limpiadasDoc, pricesDoc });
    }
  }
  console.log(`  items con imagen a limpiar : ${imagenesLimpiadas}`);
  console.log(`  items con price a backfill : ${pricesPuestos}`);
  console.log(`  docs de wishlist a escribir: ${updatesWishlist.length}`);

  // ── 4) Resumen y escritura ──────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────────────────────────');
  console.log('RESUMEN CONTABLE');
  console.log(`  ids referenciados            : ${idsReferenciados.size}`);
  console.log(`  ids huérfanos                : ${tombstones.size}`);
  console.log(`  tombstones a crear           : ${tombstones.size}  (en ${COLL_PRODUCTOS})`);
  console.log(`  imágenes de wishlist a "" : ${imagenesLimpiadas}`);
  console.log(`  prices de wishlist a poner   : ${pricesPuestos}`);
  console.log('────────────────────────────────────────────────────────────');

  const totalOps = tombstones.size + updatesWishlist.length;
  if (totalOps === 0) {
    console.log('\nNada que escribir. El historial ya está íntegro (o ya se corrió el rescate).');
    process.exit(0);
  }

  if (!apply) {
    console.log('\n[DRY-RUN] No se escribió nada. Repite con  --apply  para aplicar los cambios.');
    process.exit(0);
  }

  // Escritura en lotes de 400 — SOLO en productos_wala y wishlists.
  const ops = [];
  for (const [id, data] of tombstones) {
    ops.push({ tipo: 'set', ref: db.collection(COLL_PRODUCTOS).doc(id), data });
  }
  for (const u of updatesWishlist) {
    ops.push({ tipo: 'update', ref: u.ref, data: { items: u.items } });
  }

  let escritas = 0;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const slice = ops.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const op of slice) {
      if (op.tipo === 'set') batch.set(op.ref, op.data);
      else batch.update(op.ref, op.data);
    }
    await batch.commit();
    escritas += slice.length;
    console.log('  ...escritas ' + escritas + '/' + ops.length + ' ops');
  }

  console.log('\n✅ Listo. ' + tombstones.size + ' tombstones creados y ' +
    updatesWishlist.length + ' wishlists actualizadas en ' + projectId + '.');
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ Error en el rescate:', err && err.message ? err.message : err);
  process.exit(1);
});
