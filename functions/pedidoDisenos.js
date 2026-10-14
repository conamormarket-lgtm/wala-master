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

/**
 * La vista pública de una creación ("wala.pe/ver/<id>"), para el asesor que
 * abre el enlace del WhatsApp: solo lo que se ve (prenda, color, talla y las
 * imágenes de cada lado), nada del cliente. Solo de creaciones que ya están en
 * un pedido o publicadas: el id (20 caracteres al azar) va en el mensaje.
 * Un "Mi combo" se muestra con todas sus prendas.
 */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,128}$/;
const compartible = (d) => d && (d.enPedido === true || d.isPublic === true || d.comunidad === "publicada");
const urlsDe = (lista) => (Array.isArray(lista) ? lista : [])
  .map((v) => (v && typeof v === "object" ? v.url : v))
  .filter((u) => typeof u === "string" && /^https:\/\//.test(u));

/**
 * Los lados de la prenda en su orden (Frente, Espalda…), cada uno con la
 * imagen de su diseño o sin ella: quien mira sabe que la espalda va lisa y no
 * que falta. Sin la lista de la prenda, solo los lados con diseño.
 */
function ladosDe(d, vistasPrenda) {
  const previas = (Array.isArray(d.vistasPrevias) ? d.vistasPrevias : [])
    .filter((v) => v && typeof v.url === "string" && /^https:\/\//.test(v.url));
  if (!previas.length) {
    return urlsDe([d.imagenConjunta, d.previewUrl, d.miniatura]).slice(0, 1).map((url) => ({ nombre: "", url }));
  }
  const lados = vistasPrenda.map((v) => {
    const previa = previas.find((x) => x.vista === v.id);
    return { nombre: v.nombre, url: previa ? previa.url : "" };
  });
  // Lados con diseño que la prenda ya no tiene (la cambiaron después): igual se muestran.
  previas.filter((x) => !vistasPrenda.some((v) => v.id === x.vista))
    .forEach((x) => lados.push({ nombre: String(x.nombre || ""), url: x.url }));
  return lados.slice(0, 6);
}

function prendaVisible(d, vistasPrenda, extra = {}) {
  const color = d.color && typeof d.color === "object" ? d.color : null;
  return {
    nombre: String(d.name || ""),
    prenda: String(d.productName || ""),
    color: color ? String(color.nombre || "") : "",
    colorHex: color ? String(color.hex || "") : "",
    talla: String(extra.talla || (d.variant && d.variant.size) || ""),
    lados: ladosDe(d, vistasPrenda),
  };
}

async function disenoCompartido(db, ids) {
  const lista = [...new Set((Array.isArray(ids) ? ids : [ids]).map(String))].filter((id) => ID_VALIDO.test(id)).slice(0, 4);
  const leer = async (id) => {
    const snap = await db.collection("designs").doc(id).get();
    return snap.exists ? snap.data() : null;
  };
  // Los lados de cada prenda (productos_wala/{id}.prendaBase.vistas), una vez por prenda.
  const prendas = new Map();
  const vistasDe = (prendaId) => {
    const id = String(prendaId || "");
    if (!ID_VALIDO.test(id)) return Promise.resolve([]);
    if (!prendas.has(id)) {
      prendas.set(id, db.collection("productos_wala").doc(id).get()
        .then((snap) => {
          const vistas = snap.exists && snap.data().prendaBase && snap.data().prendaBase.vistas;
          return (Array.isArray(vistas) ? vistas : [])
            .filter((v) => v && v.id)
            .map((v) => ({ id: String(v.id), nombre: String(v.nombre || v.id) }));
        })
        .catch(() => []));
    }
    return prendas.get(id);
  };
  const piezas = [];
  let titulo = "";
  for (const id of lista) {
    const d = await leer(id);
    if (!compartible(d)) continue;
    if (d.tipo === "comboCrear" && Array.isArray(d.piezas)) {
      titulo = titulo || String(d.name || d.comboNombre || "");
      const docs = await Promise.all(d.piezas.map((p) => (p && ID_VALIDO.test(String(p.designId || "")) ? leer(String(p.designId)) : null)));
      for (let i = 0; i < d.piezas.length; i += 1) {
        const p = d.piezas[i];
        if (!p) continue;
        const doc = docs[i] && docs[i].userId === d.userId ? docs[i] : null;
        piezas.push(doc
          ? prendaVisible(doc, await vistasDe(doc.productId || p.prendaId), { talla: p.talla })
          : {
            nombre: String(p.nombre || ""), prenda: "", color: "", colorHex: "", talla: String(p.talla || ""),
            lados: urlsDe([p.frente, p.espalda]).map((url) => ({ nombre: "", url })),
          });
      }
    } else {
      piezas.push(prendaVisible(d, await vistasDe(d.productId)));
    }
  }
  return { titulo, piezas };
}

module.exports = {
  congelarDisenos,
  marcarCreacionesDelPedido,
  disenoCompartido,
  // Para las pruebas.
  destinoPedido,
  urlsDelCliente,
  cambiarUrls,
  creacionesDelPedido,
};
