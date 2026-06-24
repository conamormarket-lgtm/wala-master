/**
 * Bootstrap de administradores vía Firebase custom claims (Fase 0, H-01/H-09).
 *
 * Asigna el claim { admin: true, role: 'superadmin' } a los usuarios indicados.
 * Necesario UNA VEZ porque al inicio nadie tiene el claim (la Cloud Function
 * setAdminClaim exige que el llamante ya sea admin). Después se gestiona desde el
 * panel con setAdminClaim.
 *
 * Requisitos:
 *   - Una cuenta de servicio del proyecto pruebas-cd728 con permiso de Auth Admin.
 *     Descárgala de: Firebase Console > Configuración del proyecto > Cuentas de servicio
 *     > "Generar nueva clave privada".
 *   - Apunta GOOGLE_APPLICATION_CREDENTIALS a ese JSON (NO lo subas al repo).
 *
 * Uso (PowerShell):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\serviceAccount.json"
 *   node scripts/set-admin-claims.js yorh001@gmail.com heyeru24@gmail.com
 *
 * Para revocar:  node scripts/set-admin-claims.js --revoke alguien@dominio.com
 *
 * Tras ejecutarlo, el usuario debe cerrar sesión y volver a entrar (o refrescar el
 * token) para que el claim surta efecto en el cliente y en las reglas.
 */
const admin = require("firebase-admin");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS (ruta al JSON de la cuenta de servicio).");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const emails = args.filter((a) => a !== "--revoke");

if (emails.length === 0) {
  console.error("Indica al menos un email. Ej: node scripts/set-admin-claims.js admin@dominio.com");
  process.exit(1);
}

(async () => {
  for (const email of emails) {
    try {
      const user = await admin.auth().getUserByEmail(email.trim().toLowerCase());
      const claims = revoke ? { admin: false } : { admin: true, role: "superadmin" };
      await admin.auth().setCustomUserClaims(user.uid, claims);
      console.log(`${revoke ? "Revocado" : "Asignado"} claim admin -> ${email} (uid ${user.uid})`);
    } catch (err) {
      console.error(`Error con ${email}: ${err.message}`);
    }
  }
  console.log("Listo. Los usuarios deben re-loguearse para refrescar el token.");
  process.exit(0);
})();
