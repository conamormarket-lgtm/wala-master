/**
 * Cloud Functions de "Diseños de la comunidad". La lógica pura y el porqué
 * están en ./comunidadLogic.js.
 *
 * Todo lo que escribe pasa por aquí (firebase-admin): las reglas de Firestore
 * no se pueden desplegar desde este repo (la base es compartida con el ERP),
 * así que el permiso de admin se comprueba en el servidor y la galería se
 * lee también desde aquí, sin depender de las reglas vivas.
 *
 *   publicarEnComunidad({ designId })     admin · publica o actualiza
 *   retirarDeComunidad({ designId })      admin · la oculta (no borra archivos)
 *   listarComunidad()                     público · la galería
 *   obtenerDisenoComunidad({ id })        público · una, con sus capas
 *   registrarUsoComunidad({ id })         con sesión · +1 uso por cuenta
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const c = require("./comunidadLogic");
const { puedeUsarPuente } = require("./adminAuth");

// Como en index.js: FieldValue de firebase-admin/firestore (admin.firestore.FieldValue
// puede ser undefined en el emulador).
const { FieldValue } = require("firebase-admin/firestore");

const db = () => admin.firestore();

// La galería se cachea en cada instancia: la abren muchos y cambia poco.
// Cada función corre en su propia instancia, así que publicar/retirar no
// pueden vaciar la caché de listarComunidad: suben una versión en
// comunidad_meta/galeria y la caché solo vale mientras esa versión no cambie
// (una lectura por visita en vez de cientos).
const CACHE_MS = 10 * 60 * 1000;
let cacheGaleria = null;
const metaGaleria = () => db().collection("comunidad_meta").doc("galeria");
const cambioGaleria = () => metaGaleria().set({ version: FieldValue.increment(1) }, { merge: true });

async function esAdminComunidad(context) {
  const auth = context && context.auth;
  if (!auth) return false;
  if (auth.token && auth.token.admin === true) return true;
  // adminUsers/adminRoles se pueden escribir desde el navegador mientras las
  // reglas compartidas sigan abiertas: solo valen para ADMIN_BRIDGE_EMAILS.
  if (!puedeUsarPuente(auth.token)) return false;
  try {
    const snap = await db().collection("adminUsers").doc(auth.uid).get();
    if (snap.exists && snap.data().role === "admin") return true;
  } catch (e) { /* sigue con adminRoles */ }
  const email = String((auth.token && auth.token.email) || "").toLowerCase();
  if (!email) return false;
  try {
    const rol = await db().collection("adminRoles").doc(email).get();
    return rol.exists && c.rolPermiteComunidad(rol.data());
  } catch (e) {
    return false;
  }
}

async function exigirAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Inicia sesión.");
  }
  if (!(await esAdminComunidad(context))) {
    throw new functions.https.HttpsError("permission-denied", "Por ahora solo los administradores publican diseños.");
  }
  return context.auth.uid;
}

function idValido(v) {
  const id = String(v || "");
  return /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
}

/**
 * Copia un archivo de la creación a comunidad/{pubId}/… y devuelve su URL de
 * descarga. Si ya se copió antes (al actualizar), reutiliza la copia.
 */
async function copiarArchivo(pubId, url) {
  const ruta = c.rutaDeUrlStorage(url);
  const destinoPath = ruta && c.destinoComunidad(pubId, ruta.path);
  if (!destinoPath) return url;
  const bucket = admin.storage().bucket(ruta.bucket);
  const destino = bucket.file(destinoPath);
  const [existe] = await destino.exists();
  if (existe) {
    const [meta] = await destino.getMetadata();
    const token = String((meta.metadata && meta.metadata.firebaseStorageDownloadTokens) || "").split(",")[0];
    if (token) return c.urlDescarga(ruta.bucket, destinoPath, token);
  } else {
    await bucket.file(ruta.path).copy(destino);
  }
  const token = crypto.randomUUID();
  await destino.setMetadata({
    cacheControl: "public, max-age=31536000",
    metadata: { firebaseStorageDownloadTokens: token },
  });
  return c.urlDescarga(ruta.bucket, destinoPath, token);
}

exports.publicarEnComunidad = functions
  .runWith({ timeoutSeconds: 120, memory: "512MB" })
  .https.onCall(async (data, context) => {
    const uid = await exigirAdmin(context);
    const designId = idValido(data && data.designId);
    if (!designId) throw new functions.https.HttpsError("invalid-argument", "Creación no válida.");

    const disenoRef = db().collection("designs").doc(designId);
    const snap = await disenoRef.get();
    const diseno = snap.exists ? { id: snap.id, ...snap.data() } : null;
    const motivo = c.motivoNoPublicable(diseno, uid);
    if (motivo) throw new functions.https.HttpsError("failed-precondition", motivo);

    const mapa = {};
    try {
      for (const url of c.urlsACopiar(diseno, uid)) {
        mapa[url] = await copiarArchivo(designId, url);
      }
    } catch (e) {
      console.error("publicarEnComunidad: no se pudo copiar un archivo:", e && e.message);
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Faltan imágenes de esta creación. Ábrela en el estudio, guárdala de nuevo y vuelve a publicarla."
      );
    }

    const pubRef = db().collection(c.COLECCION).doc(designId);
    const previa = await pubRef.get();
    const datos = c.datosPublicacion(diseno, mapa, { autorUid: uid, autorNombre: "Walá" });
    await pubRef.set({
      ...datos,
      estado: "publicada",
      actualizadoEn: FieldValue.serverTimestamp(),
      ...(previa.exists && previa.data().publicadoEn ? {} : { publicadoEn: FieldValue.serverTimestamp(), usos: 0 }),
      retiradoEn: FieldValue.delete(),
    }, { merge: true });
    // Marca en la creación original, para la insignia "Publicada" (sin tocar
    // updatedAt: publicar no es editarla).
    await disenoRef.update({ comunidad: "publicada" });
    await cambioGaleria();
    return { ok: true, id: designId, actualizada: previa.exists };
  });

exports.retirarDeComunidad = functions.https.onCall(async (data, context) => {
  await exigirAdmin(context);
  const designId = idValido(data && data.designId);
  if (!designId) throw new functions.https.HttpsError("invalid-argument", "Publicación no válida.");
  const pubRef = db().collection(c.COLECCION).doc(designId);
  const pub = await pubRef.get();
  if (!pub.exists) throw new functions.https.HttpsError("not-found", "Esa publicación no existe.");
  // Solo se oculta: los archivos se quedan, porque las creaciones que otros
  // hicieron a partir de ella los siguen usando.
  await pubRef.update({ estado: "retirada", retiradoEn: FieldValue.serverTimestamp() });
  const disenoRef = db().collection("designs").doc(designId);
  const diseno = await disenoRef.get();
  if (diseno.exists) await disenoRef.update({ comunidad: "retirada" });
  await cambioGaleria();
  return { ok: true };
});

exports.listarComunidad = functions.https.onCall(async (data) => {
  if (data && data.ping) return { ok: true };
  try {
    const meta = await metaGaleria().get();
    const version = (meta.exists && meta.data().version) || 0;
    if (cacheGaleria && cacheGaleria.version === version && Date.now() - cacheGaleria.en < CACHE_MS) {
      return { disenos: cacheGaleria.disenos };
    }
    const snap = await db().collection(c.COLECCION).where("estado", "==", "publicada").limit(300).get();
    const pubs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Solo las de prendas que hoy se pueden diseñar.
    const prendaIds = [...new Set(pubs.map((p) => p.productId).filter(Boolean))];
    const prendas = prendaIds.length
      ? await db().getAll(...prendaIds.map((id) => db().collection("productos_wala").doc(id)))
      : [];
    const disponibles = new Set(prendas.filter((p) => p.exists && c.prendaDisponible(p.data())).map((p) => p.id));
    const disenos = c.ordenarGaleria(
      pubs.filter((p) => disponibles.has(p.productId)).map((p) => c.serializarPublica(p.id, p))
    );
    cacheGaleria = { en: Date.now(), version, disenos };
    return { disenos };
  } catch (e) {
    console.error("listarComunidad error:", e);
    throw new functions.https.HttpsError("internal", "No se pudo cargar la galería.");
  }
});

exports.obtenerDisenoComunidad = functions.https.onCall(async (data) => {
  const id = idValido(data && data.id);
  if (!id) return { diseno: null };
  const snap = await db().collection(c.COLECCION).doc(id).get();
  if (!snap.exists || snap.data().estado !== "publicada") return { diseno: null };
  return { diseno: c.serializarPublica(id, snap.data(), { conCapas: true }) };
});

exports.registrarUsoComunidad = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Inicia sesión.");
  const id = idValido(data && data.id);
  if (!id) return { ok: false };
  const pubRef = db().collection(c.COLECCION).doc(id);
  const usoRef = pubRef.collection("usos").doc(context.auth.uid);
  // Una vez por cuenta: abrir el mismo diseño muchas veces no infla el contador.
  await db().runTransaction(async (t) => {
    const [pub, uso] = await Promise.all([t.get(pubRef), t.get(usoRef)]);
    if (!pub.exists || uso.exists) return;
    t.set(usoRef, { en: FieldValue.serverTimestamp() });
    t.update(pubRef, { usos: FieldValue.increment(1) });
  });
  return { ok: true };
});
