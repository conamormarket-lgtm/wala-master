"use strict";

// ── ¿Quién es admin? ─────────────────────────────────────────────────────────
// La prueba es el custom claim `admin: true` del token: solo se puede poner con
// el Admin SDK (setAdminClaim / scripts/set-admin-claims.js).
//
// Los documentos adminUsers/{uid} y adminRoles/{email} NO prueban nada mientras
// las reglas compartidas con el ERP dejen escribir cualquier colección a quien
// tenga sesión: cualquiera podía crearse adminUsers/{su uid} con role 'admin' y
// pasar por admin en estas funciones. adminUsers se acepta solo para las
// cuentas de ADMIN_BRIDGE_EMAILS (correo verificado). adminRoles ya está
// cerrado en las reglas vivas: vale por grupo (adminConPermiso, abajo).

function correosPuente() {
  return new Set(
    String(process.env.ADMIN_BRIDGE_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** El token puede usar los documentos de admin como respaldo del claim. */
function puedeUsarPuente(token) {
  if (!token || token.email_verified !== true) return false;
  const email = String(token.email || "").trim().toLowerCase();
  return !!email && correosPuente().has(email);
}

function tieneClaimAdmin(context) {
  return !!(context && context.auth && context.auth.token && context.auth.token.admin === true);
}

// ── Equipo del panel (Configuración › Equipo) ────────────────────────────────
// adminRoles/{correo} = { permissions: [...] }. Desde que las reglas vivas
// tienen adminRoles en esSoloWala, solo un admin lo escribe, y las reglas ya
// le dan acceso al panel a quien tenga ese doc con el correo verificado: las
// funciones lo reconocen igual, pero por grupo (antes lo rechazaban siempre y
// esa persona veía "permission-denied" en Opiniones, canjes, sorteos…).
// Los grupos son los del menú (src/componentes/kit/adaptadoresAdmin.js);
// 'superadmin' lo abre todo. Los permisos de antes se traducen igual que allí.
const PERMISOS_DE_ANTES = {
  manage_design: ["pedidos", "campanas", "premios", "paginas", "ajustes", "resultados"],
  manage_products: ["catalogo"],
  manage_inventory: ["inventario"],
  manage_clients: ["clientes", "premios", "campanas", "resultados"],
  manage_landing_pages: ["campanas", "paginas"],
  diseno: ["premios"],
};

function permisosEfectivos(permisos) {
  const lista = Array.isArray(permisos) ? permisos.filter((p) => typeof p === "string" && p) : [];
  return [...new Set(lista.flatMap((p) => [p, ...(PERMISOS_DE_ANTES[p] || [])]))];
}

/** ¿Estos permisos del panel abren algo que pide `grupos`? [] = solo superadmin. */
function permisosAlcanzan(permisos, grupos) {
  const efectivos = permisosEfectivos(permisos);
  if (efectivos.includes("superadmin")) return true;
  return Array.isArray(grupos) && grupos.some((g) => efectivos.includes(g));
}

/** Los permisos del panel de quien llama (correo verificado), o [] si no tiene. */
async function permisosDelPanel(db, token) {
  if (!token || token.email_verified !== true) return [];
  const email = String(token.email || "").trim().toLowerCase();
  if (!email) return [];
  try {
    const snap = await db.collection("adminRoles").doc(email).get();
    return snap.exists ? permisosEfectivos((snap.data() || {}).permissions) : [];
  } catch (e) {
    return [];
  }
}

/**
 * ¿Quien llama puede usar una función de estos grupos del panel?
 *  - claim admin: siempre (las cuentas principales).
 *  - adminUsers/{uid} con role 'admin': solo ADMIN_BRIDGE_EMAILS (como antes).
 *  - adminRoles/{correo}: si sus permisos alcanzan `grupos`. Con `grupos`
 *    null la función es solo para cuentas principales (mantenimiento,
 *    marcas de admin): el equipo no entra.
 */
async function adminConPermiso(db, context, grupos) {
  const auth = context && context.auth;
  if (!auth) return false;
  if (tieneClaimAdmin(context)) return true;
  if (puedeUsarPuente(auth.token)) {
    try {
      const snap = await db.collection("adminUsers").doc(auth.uid).get();
      if (snap.exists && (snap.data() || {}).role === "admin") return true;
    } catch (e) { /* sigue con adminRoles */ }
  }
  if (grupos === null || grupos === undefined) return false;
  return permisosAlcanzan(await permisosDelPanel(db, auth.token), grupos);
}

module.exports = {
  correosPuente, puedeUsarPuente, tieneClaimAdmin,
  permisosEfectivos, permisosAlcanzan, permisosDelPanel, adminConPermiso,
};
