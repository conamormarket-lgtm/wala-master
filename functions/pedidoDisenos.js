/**
 * Los diseños de un pedido, a salvo de lo que el cliente haga después.
 *
 * - congelarDisenos: copia los archivos del cliente que usa el pedido (vistas
 *   previas, archivos de impresión, imágenes de las capas: todo lo que viva
 *   en designs/{uid}/…) a pedidos/{pedido}/… y el pedido apunta a la copia.
 *   Así, si el cliente elimina o edita su creación, el taller sigue teniendo
 *   exactamente lo que se compró. Si un archivo no se puede copiar, el pedido
 *   conserva el enlace original (nunca se bloquea la compra). La copia de un
 *   mismo archivo es siempre la misma: repetir no duplica nada.
 * - marcarCreacionesDelPedido: las creaciones del pedido (y su "Mi combo")
 *   quedan marcadas como compradas (enPedido), desde el servidor: antes solo
 *   lo hacía el navegador y se perdía si el pago lo terminaba la pasarela o se
 *   cerraba la pestaña.
 */
const admin = require("firebase-admin");
const crypto = require("crypto");
const { rutaDeUrlStorage, urlDescarga } = require("./comunidadLogic");

const CARPETA = "pedidos";
const EN_PARALELO = 6;

const esObjetoPlano = (v) => v !== null && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype;

/** designs/{uid}/crear/archivos/1_a.png → pedidos/{pedido}/archivos/1_a.png */
function destinoPedido(pedidoId, path) {
  const carpeta = String(pedidoId || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!carpeta) return null;
  const partes = String(path || "").split("/").filter(Boolean);
  let resto = partes.slice(2);
  if (resto[0] === "crear") resto = resto.slice(1);
  if (!resto.length || resto.some((p) => p === "." || p === "..")) return null;
  return `${CARPETA}/${carpeta}/${resto.join("/")}`;
}

/** Las URLs de archivos del cliente (designs/{uid}/…) en cualquier parte del pedido. */
function urlsDelCliente(valor, uid, out = new Set()) {
  if (typeof valor === "string") {
    const r = rutaDeUrlStorage(valor);
    if (r && r.path.startsWith(`designs/${uid}/`)) out.add(valor);
  } else if (Array.isArray(valor)) {
    valor.forEach((v) => urlsDelCliente(v, uid, out));
  } else if (esObjetoPlano(valor)) {
    Object.values(valor).forEach((v) => urlsDelCliente(v, uid, out));
  }
  return out;
}

/** El mismo valor con las URLs cambiadas a sus copias (`mapa`: original → copia). */
function cambiarUrls(valor, mapa) {
  if (typeof valor === "string") return mapa[valor] || valor;
  if (Array.isArray(valor)) return valor.map((v) => cambiarUrls(v, mapa));
  if (esObjetoPlano(valor)) {
    const out = {};
    Object.entries(valor).forEach(([k, v]) => { out[k] = cambiarUrls(v, mapa); });
    return out;
  }
  return valor;
}

/** Copia un archivo a `destinoPath` (o reutiliza la copia) y devuelve su URL de descarga. */
async function copiarA(url, destinoPath) {
  const ruta = rutaDeUrlStorage(url);
  const bucket = admin.storage().bucket(ruta.bucket);
  const destino = bucket.file(destinoPath);
  const [existe] = await destino.exists();
  if (existe) {
    const [meta] = await destino.getMetadata();
    const token = String((meta.metadata && meta.metadata.firebaseStorageDownloadTokens) || "").split(",")[0];
    if (token) return urlDescarga(ruta.bucket, destinoPath, token);
  } else {
    await bucket.file(ruta.path).copy(destino);
  }
  const token = crypto.randomUUID();
  await destino.setMetadata({
    cacheControl: "public, max-age=31536000",
    metadata: { firebaseStorageDownloadTokens: token },
  });
  return urlDescarga(ruta.bucket, destinoPath, token);
}

/** El payload del pedido apuntando a sus propias copias de los diseños. */
async function congelarDisenos(payload, pedidoId, uid) {
  if (!payload || !uid || !pedidoId) return payload;
  const urls = [...urlsDelCliente(payload, uid)];
  if (!urls.length) return payload;
  const mapa = {};
  for (let i = 0; i < urls.length; i += EN_PARALELO) {
    await Promise.all(urls.slice(i, i + EN_PARALELO).map(async (url) => {
      const destinoPath = destinoPedido(pedidoId, rutaDeUrlStorage(url).path);
      if (!destinoPath) return;
      try {
        mapa[url] = await copiarA(url, destinoPath);
      } catch (e) {
        console.warn(`congelarDisenos: ${pedidoId} conserva el original de ${destinoPath}:`, e.message);
      }
    }));
  }
  return Object.keys(mapa).length ? cambiarUrls(payload, mapa) : payload;
}

/** Ids de las creaciones del pedido: cada línea, cada pieza de combo y su "Mi combo". */
function creacionesDelPedido(payload) {
  const ids = new Set();
  const valido = (v) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v) ? v : null);
  Object.values((payload && payload.productos) || {}).forEach((p) => {
    if (!p) return;
    const id = valido(p.designId);
    if (id) ids.add(id);
    const mio = valido(p.comboCrear && p.comboCrear.miComboId);
    if (mio) ids.add(mio);
  });
  return [...ids];
}

/** Marca como compradas las creaciones del pedido que son del comprador. */
async function marcarCreacionesDelPedido(db, payload, uid) {
  if (!uid) return;
  await Promise.all(creacionesDelPedido(payload).map(async (id) => {
    try {
      const ref = db.collection("designs").doc(id);
      const snap = await ref.get();
      if (!snap.exists || snap.data().userId !== uid || snap.data().enPedido === true) return;
      await ref.set({ enPedido: true }, { merge: true });
    } catch (e) {
      console.warn(`marcarCreacionesDelPedido: ${id} no se marcó:`, e.message);
    }
  }));
}

module.exports = {
  congelarDisenos,
  marcarCreacionesDelPedido,
  // Para las pruebas.
  destinoPedido,
  urlsDelCliente,
  cambiarUrls,
  creacionesDelPedido,
};
