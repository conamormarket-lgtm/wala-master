"use strict";

// ── ¿Quién es admin? ─────────────────────────────────────────────────────────
// La prueba es el custom claim `admin: true` del token: solo se puede poner con
// el Admin SDK (setAdminClaim / scripts/set-admin-claims.js).
//
// Los documentos adminUsers/{uid} y adminRoles/{email} NO prueban nada mientras
// las reglas compartidas con el ERP dejen escribir cualquier colección a quien
// tenga sesión: cualquiera podía crearse adminUsers/{su uid} con role 'admin' y
// pasar por admin en estas funciones. Se aceptan solo para las cuentas de
// ADMIN_BRIDGE_EMAILS (correo verificado), mientras se terminan de asignar los
// claims. Sin esa variable, únicamente cuenta el claim.

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

module.exports = { correosPuente, puedeUsarPuente, tieneClaimAdmin };
