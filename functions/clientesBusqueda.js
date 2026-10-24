// ════════════════════════════════════════════════════════════════════════════
// Búsqueda de clientes en Resultados › Clientes. Cada perfil de
// portal_clientes_users guarda `busqueda`: los comienzos (2 a 20 letras) de su
// nombre, correo, DNI y teléfono, sin tildes ni mayúsculas. Así el admin busca
// entre TODOS los clientes con una sola consulta (array-contains), no solo
// entre los que tiene cargados.
//   - indexarBusquedaCliente: al guardar un perfil, recalcula `busqueda`
//     (solo escribe si cambió: no se dispara en bucle).
//   - reindexarBusquedaClientes: callable solo-admin para llenar los perfiles
//     que ya existían. No toca updatedAt (el listado ordena por esa fecha).
// ════════════════════════════════════════════════════════════════════════════

const functions = require("firebase-functions");
const admin = require("firebase-admin");

const COLECCION = "portal_clientes_users";
const MIN = 2;
const MAX = 20;
const TOPE = 300;

// MANTENER EN SYNC con normalizarBusqueda de src/services/adminUserInsights.js.
function normalizarBusqueda(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function prefijos(palabra, out) {
  const p = palabra.slice(0, MAX);
  for (let i = MIN; i <= p.length; i++) out.add(p.slice(0, i));
}

/** Comienzos de búsqueda de un perfil (orden estable para comparar). */
function prefijosBusqueda(perfil = {}) {
  const out = new Set();
  const nombre = normalizarBusqueda(perfil.displayName || perfil.nombre || "");
  nombre.split(/[^a-z0-9]+/).filter(Boolean).forEach((w) => prefijos(w, out));
  const correo = normalizarBusqueda(perfil.email || "");
  if (correo) {
    prefijos(correo, out);
    const local = correo.split("@")[0];
    local.split(/[^a-z0-9]+/).filter(Boolean).forEach((w) => prefijos(w, out));
  }
  const dni = String(perfil.dni || perfil.clienteNumeroDocumento || "").replace(/\s/g, "").toLowerCase();
  if (dni) prefijos(dni, out);
  const telefono = String((perfil.phoneIntl && perfil.phoneIntl.full) || perfil.phone || "").replace(/\D/g, "");
  if (telefono) {
    prefijos(telefono, out);
    // Sin código de país (51…): se busca como lo escribe la gente.
    if (telefono.length > 9) prefijos(telefono.slice(-9), out);
  }
  return [...out].sort().slice(0, TOPE);
}

const igual = (a = [], b = []) => a.length === b.length && a.every((x, i) => x === b[i]);

exports.indexarBusquedaCliente = functions.firestore
  .document(`${COLECCION}/{uid}`)
  .onWrite(async (change) => {
    if (!change.after.exists) return null;
    const datos = change.after.data() || {};
    const nuevos = prefijosBusqueda(datos);
    if (igual(nuevos, Array.isArray(datos.busqueda) ? datos.busqueda : [])) return null;
    await change.after.ref.update({ busqueda: nuevos });
    return null;
  });

exports.reindexarBusquedaClientes = functions
  .runWith({ memory: "512MB", timeoutSeconds: 540 })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
    }
    if (context.auth.token.admin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Solo un administrador puede preparar la búsqueda.");
    }
    const db = admin.firestore();
    let revisados = 0;
    let actualizados = 0;
    let ultimo = null;
    for (;;) {
      let q = db.collection(COLECCION).orderBy(admin.firestore.FieldPath.documentId()).limit(400);
      if (ultimo) q = q.startAfter(ultimo);
      const snap = await q.get();
      if (snap.empty) break;
      const lote = db.batch();
      let enLote = 0;
      snap.docs.forEach((d) => {
        revisados += 1;
        const datos = d.data() || {};
        const nuevos = prefijosBusqueda(datos);
        if (!igual(nuevos, Array.isArray(datos.busqueda) ? datos.busqueda : [])) {
          lote.update(d.ref, { busqueda: nuevos });
          enLote += 1;
        }
      });
      if (enLote) await lote.commit();
      actualizados += enLote;
      ultimo = snap.docs[snap.docs.length - 1];
      if (snap.size < 400) break;
    }
    return { revisados, actualizados };
  });

exports._internals = { normalizarBusqueda, prefijosBusqueda };
