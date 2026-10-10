/**
 * Limpia las cuentas viejas del "Portal Clientes" que creaba el ERP en
 * portal_clientes_users: documentos con id = CORREO y `password` = DNI en texto
 * plano. Ni Walá ni el ERP los leen (Walá usa el uid como id, que nunca lleva "@")
 * y, con las reglas abiertas, dejaban el DNI de cada cliente a la vista.
 * Desde el commit b3e2b747 del ERP ya no se crean.
 *
 * Solo toca documentos cuyo id tiene "@" y que NO parecen un perfil de Walá
 * (sin monedas, uid ni role). Nada más.
 *
 * Requisitos: cuenta de servicio del proyecto sistema-gestion-3b225 en
 * GOOGLE_APPLICATION_CREDENTIALS (NO la subas al repo).
 *
 * Uso (PowerShell):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\serviceAccount.json"
 *   node scripts/limpiar-portal-legacy.js                       # simulación: solo cuenta
 *   node scripts/limpiar-portal-legacy.js --quitar-password --respaldo C:\respaldos\portal.json
 *   node scripts/limpiar-portal-legacy.js --borrar --respaldo C:\respaldos\portal.json
 *
 * --quitar-password  borra solo el campo `password` (el documento queda).
 * --borrar           borra los documentos completos.
 * --respaldo         obligatorio con cualquiera de los dos: antes de tocar nada
 *                    guarda ahí los documentos tal como están. El respaldo tiene
 *                    DNIs: guárdalo fuera del repo y bórralo cuando ya no sirva.
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS (ruta al JSON de la cuenta de servicio).");
  process.exit(1);
}

const args = process.argv.slice(2);
const quitarPassword = args.includes("--quitar-password");
const borrar = args.includes("--borrar");
const iRespaldo = args.indexOf("--respaldo");
const respaldo = iRespaldo >= 0 ? args[iRespaldo + 1] : null;

if (quitarPassword && borrar) {
  console.error("Elige uno: --quitar-password o --borrar.");
  process.exit(1);
}
if ((quitarPassword || borrar) && !respaldo) {
  console.error("Indica dónde guardar el respaldo: --respaldo C:\\ruta\\portal.json");
  process.exit(1);
}
if (respaldo && path.resolve(respaldo).startsWith(path.resolve(__dirname, ".."))) {
  console.error("El respaldo tiene DNIs: guárdalo FUERA del repo.");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const esLegacy = (doc) => {
  const d = doc.data() || {};
  return doc.id.includes("@") && d.monedas === undefined && !d.uid && !d.role;
};
const enmascarar = (id) => id.replace(/^(.).*(@.*)$/, "$1***$2");

(async () => {
  const snap = await db.collection("portal_clientes_users").get();
  const legacy = snap.docs.filter(esLegacy);
  const conPassword = legacy.filter((d) => d.data().password !== undefined);
  console.log(`portal_clientes_users: ${snap.size} documentos.`);
  console.log(`Viejos del ERP (id = correo): ${legacy.length}; con DNI como contraseña: ${conPassword.length}.`);
  legacy.slice(0, 5).forEach((d) => console.log("  ejemplo:", enmascarar(d.id)));

  if (!quitarPassword && !borrar) {
    console.log("\nSimulación: no se cambió nada. Usa --quitar-password o --borrar con --respaldo.");
    return;
  }

  const objetivo = quitarPassword ? conPassword : legacy;
  fs.writeFileSync(respaldo, JSON.stringify(objetivo.map((d) => ({ id: d.id, data: d.data() })), null, 2));
  console.log(`\nRespaldo de ${objetivo.length} documentos en ${respaldo}`);

  let hechos = 0;
  for (let i = 0; i < objetivo.length; i += 400) {
    const batch = db.batch();
    objetivo.slice(i, i + 400).forEach((d) => {
      if (borrar) batch.delete(d.ref);
      else batch.update(d.ref, { password: admin.firestore.FieldValue.delete() });
    });
    await batch.commit();
    hechos += Math.min(400, objetivo.length - i);
  }
  console.log(borrar ? `Borrados: ${hechos}.` : `Contraseña (DNI) quitada de: ${hechos}.`);
})().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
