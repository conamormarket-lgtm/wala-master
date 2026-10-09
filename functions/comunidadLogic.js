/**
 * Lógica PURA de "Diseños de la comunidad". Sin firebase-admin: se testea con
 * Node puro (functions/test/comunidadLogic.test.js).
 *
 * Un admin publica una creación suya (designs/{id}, tipo 'crear'). Publicar
 * hace una COPIA independiente en comunidad_disenos/{mismo id}, con sus
 * imágenes copiadas a comunidad/{id}/… en Storage. Así:
 *   - borrar o editar la creación original no rompe la publicación;
 *   - las creaciones que otros hacen a partir de ella siguen viendo sus
 *     imágenes aunque el admin borre la suya (por eso retirar una publicación
 *     solo la oculta y nunca borra sus archivos).
 * La galería es pública (sin iniciar sesión) y solo expone lo de esta lista:
 * nada de uid del autor ni del diseño de origen.
 */

const COLECCION = "comunidad_disenos";
const CARPETA = "comunidad";
const PERMISOS_ADMIN_COMUNIDAD = ["superadmin", "manage_design"];

/**
 * { bucket, path } de una URL de Firebase Storage, o null si no lo es.
 * Acepta las de descarga (firebasestorage.googleapis.com/v0/b/…/o/…) y las
 * públicas de GCS (storage.googleapis.com/{bucket}/{path}).
 */
function rutaDeUrlStorage(url) {
  if (typeof url !== "string" || !/^https:\/\//.test(url)) return null;
  let u;
  try {
    u = new URL(url);
  } catch (e) {
    return null;
  }
  if (u.hostname === "firebasestorage.googleapis.com") {
    const m = u.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (!m) return null;
    try {
      return { bucket: m[1], path: decodeURIComponent(m[2]) };
    } catch (e) {
      return null;
    }
  }
  if (u.hostname === "storage.googleapis.com") {
    const m = u.pathname.match(/^\/([^/]+)\/(.+)$/);
    if (!m) return null;
    try {
      return { bucket: m[1], path: decodeURIComponent(m[2]) };
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Dónde queda la copia de un archivo de la creación. Es SIEMPRE la misma para
 * el mismo archivo: al volver a publicar (actualizar) no se duplica lo que ya
 * se copió. designs/{uid}/crear/originales/123_a.webp → comunidad/{id}/originales/123_a.webp
 */
function destinoComunidad(pubId, path) {
  const partes = String(path || "").split("/").filter(Boolean);
  // Sin designs/{uid}/ (y sin crear/, si está).
  let resto = partes.slice(2);
  if (resto[0] === "crear") resto = resto.slice(1);
  if (!resto.length || resto.some((p) => p === "." || p === "..")) return null;
  return `${CARPETA}/${pubId}/${resto.join("/")}`;
}

function urlDescarga(bucket, path, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

/** Recorre las capas de imagen de layersByView. */
function capasDeImagen(layersByView) {
  const out = [];
  Object.values(layersByView || {}).forEach((capas) => {
    (Array.isArray(capas) ? capas : []).forEach((c) => {
      if (c && c.type === "image" && typeof c.src === "string") out.push(c);
    });
  });
  return out;
}

/**
 * URLs de la creación que hay que copiar: las imágenes de las capas y las
 * vistas previas. No los archivos de impresión: quien usa el diseño genera
 * los suyos al guardar. Solo archivos de la carpeta del AUTOR: lo demás
 * (imágenes de otro lado) no se toca.
 */
function urlsACopiar(diseno, autorUid) {
  const urls = new Set();
  const agregar = (u) => {
    const r = rutaDeUrlStorage(u);
    if (r && r.path.startsWith(`designs/${autorUid}/`)) urls.add(u);
  };
  capasDeImagen(diseno && diseno.layersByView).forEach((c) => agregar(c.src));
  ((diseno && diseno.vistasPrevias) || []).forEach((p) => agregar(p && p.url));
  agregar(diseno && diseno.imagenConjunta);
  agregar(diseno && diseno.previewUrl);
  return [...urls];
}

const cambiar = (mapa, u) => (typeof u === "string" && mapa[u]) || u;

/**
 * El documento de la publicación, con las URLs ya cambiadas a las copias.
 * `mapa` = { urlOriginal: urlCopia }.
 */
function datosPublicacion(diseno, mapa, { autorUid, autorNombre }) {
  const layersByView = {};
  Object.entries(diseno.layersByView || {}).forEach(([zonaId, capas]) => {
    if (!Array.isArray(capas) || !capas.length) return;
    layersByView[zonaId] = capas.map((c) => (c && c.type === "image" ? { ...c, src: cambiar(mapa, c.src) } : c));
  });
  const vistasPrevias = (diseno.vistasPrevias || [])
    .filter((p) => p && p.url)
    .map((p) => ({ ...p, url: cambiar(mapa, p.url) }));
  const imagenConjunta = cambiar(mapa, diseno.imagenConjunta || "");
  return {
    origenDesignId: diseno.id,
    autorUid,
    autorNombre: autorNombre || "Walá",
    nombre: String(diseno.name || "").trim().slice(0, 80) || "Diseño de la comunidad",
    productId: diseno.productId,
    productName: diseno.productName || "",
    color: diseno.color || null,
    layersByView,
    vistasPrevias,
    imagenConjunta,
    previewUrl: cambiar(mapa, diseno.previewUrl || "") || imagenConjunta,
  };
}

/** ¿Se puede publicar esta creación? Devuelve el motivo si no. */
function motivoNoPublicable(diseno, uid) {
  if (!diseno) return "No encontramos esa creación.";
  if (diseno.userId !== uid) return "Solo puedes publicar tus propias creaciones.";
  if (diseno.tipo !== "crear") return "Solo se pueden publicar creaciones del estudio Crear.";
  if (diseno.estado === "borrador") return "Guarda la creación antes de publicarla.";
  if (!diseno.productId) return "La creación no tiene prenda.";
  if (!Object.values(diseno.layersByView || {}).some((c) => Array.isArray(c) && c.length)) {
    return "La creación está vacía.";
  }
  return null;
}

/** Permiso de comunidad por adminRoles/{email} (el mismo RBAC del panel). */
function rolPermiteComunidad(rol) {
  const permisos = Array.isArray(rol && rol.permissions) ? rol.permissions : [];
  return permisos.some((p) => PERMISOS_ADMIN_COMUNIDAD.includes(p));
}

function aMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts._seconds === "number") return ts._seconds * 1000;
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  return null;
}

/** Lo que ve cualquiera. Las capas solo al abrir una (no en la galería). */
function serializarPublica(id, pub, { conCapas = false } = {}) {
  const out = {
    id,
    nombre: pub.nombre || "",
    autorNombre: pub.autorNombre || "Walá",
    productId: pub.productId || "",
    productName: pub.productName || "",
    color: pub.color || null,
    vistasPrevias: (pub.vistasPrevias || []).map((p) => ({ nombre: p.nombre || "", url: p.url })),
    imagenConjunta: pub.imagenConjunta || "",
    previewUrl: pub.previewUrl || "",
    usos: Number(pub.usos) || 0,
    destacado: pub.destacado === true,
    publicadoEn: aMillis(pub.publicadoEn),
  };
  if (conCapas) out.layersByView = pub.layersByView || {};
  return out;
}

/** Destacados primero; luego los más recientes. */
function ordenarGaleria(lista) {
  return [...lista].sort((a, b) => {
    if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
    return (b.publicadoEn || 0) - (a.publicadoEn || 0);
  });
}

/** La prenda de la publicación se puede diseñar hoy (si no, no se muestra). */
function prendaDisponible(prenda) {
  return Boolean(prenda) && prenda.esPrendaBase === true && prenda.deleted !== true && prenda.visible !== false;
}

module.exports = {
  COLECCION,
  CARPETA,
  rutaDeUrlStorage,
  destinoComunidad,
  urlDescarga,
  urlsACopiar,
  datosPublicacion,
  motivoNoPublicable,
  rolPermiteComunidad,
  serializarPublica,
  ordenarGaleria,
  prendaDisponible,
};
