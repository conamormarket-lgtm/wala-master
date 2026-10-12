// Pruebas de firebase/firestore.rules en el emulador de Firestore (no despliega nada).
//
// Requisitos: Java 21+ (firebase-tools ya no acepta Java 8) y, en una carpeta aparte:
//   npm i @firebase/rules-unit-testing@4 firebase@11
// Uso (desde esa carpeta, con un firebase.json que apunte a las reglas y el puerto 8089):
//   {"firestore":{"rules":"r.rules"},"emulators":{"firestore":{"port":8089}}}
//   firebase emulators:exec --only firestore --project demo-wala "node reglas.test.mjs r.rules"
//
// OJO: estas pruebas simulan al ERP CON su sesión anónima ya iniciada. El 2026-10-10
// pasaron 44/44 y aun así el ERP se cayó en vivo: falta reproducir el ERP real (ver
// docs/wala/ESTADO-PAGOS-Y-REGLAS.md).

// Pruebas de las reglas fusionadas en el emulador. Uso: node reglas.test.mjs <archivo.rules>
import fs from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, addDoc } from "firebase/firestore";

const rules = fs.readFileSync(process.argv[2], "utf8");
const env = await initializeTestEnvironment({
  projectId: "demo-wala",
  firestore: { rules, host: "127.0.0.1", port: 8089 },
});

// Datos de partida (sin reglas).
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "productos_wala/p1"), { name: "Polo", price: 99 });
  await setDoc(doc(db, "pages/landing-x"), { sections: [] });
  await setDoc(doc(db, "config/fx"), { penPerUsd: 3.7 });
  await setDoc(doc(db, "config/secreto"), { clave: "x" });
  await setDoc(doc(db, "configuracion/general"), { canalesVenta: [] });
  await setDoc(doc(db, "pedidos/12001"), { estadoGeneral: "Nuevo", montoTotal: 129 });
  await setDoc(doc(db, "pedidos_web/PD-1"), { dni: "12345678", montoTotal: 50 });
  await setDoc(doc(db, "users/user-admin-123"), { email: "admin@sistema.com", password: "x" });
  await setDoc(doc(db, "fp_transactions/t1"), { amount: 10 });
  await setDoc(doc(db, "portal_clientes_users/u1"), { email: "cliente@gmail.com", displayName: "A", monedas: 5, dni: "1" });
  await setDoc(doc(db, "portal_clientes_users/u2"), { email: "otro@gmail.com", monedas: 50 });
  await setDoc(doc(db, "checkout_payment_intents/PD-1"), { uid: "u1", status: "prepared" });
  await setDoc(doc(db, "culqiCharges/tkn_1"), { uid: "u1" });
  await setDoc(doc(db, "wala_pedidos/PD-1"), { buyerUid: "u1", estadoWala: "pagado" });
  await setDoc(doc(db, "wala_pedidos/PD-9"), { buyerUid: "otro", estadoWala: "pagado" });
  await setDoc(doc(db, "adminRoles/staff@gmail.com"), { permissions: ["productos"] });
  await setDoc(doc(db, "globals/activeChallenge"), { title: "Reto" });
  await setDoc(doc(db, "pedidos_flujo-abc/1"), { x: 1 });
  await setDoc(doc(db, "stockReview_meta/control"), { enabled: false });
});

const sinSesion = env.unauthenticatedContext().firestore();
const anon = env.authenticatedContext("anon1", { firebase: { sign_in_provider: "anonymous" } }).firestore();
const cliente = env.authenticatedContext("u1", { email: "cliente@gmail.com", email_verified: true }).firestore();
const admin = env.authenticatedContext("adm", { email: "conamormarket@gmail.com", email_verified: true, admin: true }).firestore();
const rolPanel = env.authenticatedContext("r1", { email: "Staff@Gmail.com", email_verified: true }).firestore();
const rolSinVerificar = env.authenticatedContext("r2", { email: "staff@gmail.com", email_verified: false }).firestore();

const casos = [
  ["sin sesión lee el catálogo", true, () => getDoc(doc(sinSesion, "productos_wala/p1"))],
  ["sin sesión lee una landing", true, () => getDoc(doc(sinSesion, "pages/landing-x"))],
  ["sin sesión lee el tipo de cambio", true, () => getDoc(doc(sinSesion, "config/fx"))],
  ["sin sesión lee el reto activo", true, () => getDoc(doc(sinSesion, "globals/activeChallenge"))],
  ["sin sesión NO lee otro doc de config del ERP", false, () => getDoc(doc(sinSesion, "config/secreto"))],
  ["sin sesión lee configuracion (pública de la tienda)", true, () => getDoc(doc(sinSesion, "configuracion/general"))],
  ["sin sesión NO lee pedidos", false, () => getDoc(doc(sinSesion, "pedidos/12001"))],
  ["sin sesión NO lee users (contraseñas del ERP)", false, () => getDoc(doc(sinSesion, "users/user-admin-123"))],
  ["sin sesión NO lee Finanzas", false, () => getDoc(doc(sinSesion, "fp_transactions/t1"))],
  ["sin sesión NO lee perfiles", false, () => getDoc(doc(sinSesion, "portal_clientes_users/u1"))],
  ["sin sesión NO borra productos", false, () => deleteDoc(doc(sinSesion, "productos_wala/p1"))],
  ["sin sesión registra analítica", true, () => addDoc(collection(sinSesion, "analytics_events"), { tipo: "view" })],
  ["sin sesión manda un reclamo (INDECOPI)", true, () => addDoc(collection(sinSesion, "libro_reclamaciones"), { texto: "x" })],

  ["ERP (anónimo) lee pedidos", true, () => getDoc(doc(anon, "pedidos/12001"))],
  ["ERP (anónimo) actualiza un pedido", true, () => updateDoc(doc(anon, "pedidos/12001"), { estadoGeneral: "En Diseño" })],
  ["ERP (anónimo) registra en Finanzas", true, () => setDoc(doc(anon, "fp_transactions/t2"), { amount: 10 })],
  ["ERP (anónimo) lee users para el login", true, () => getDoc(doc(anon, "users/user-admin-123"))],
  ["ERP (anónimo) lee un flujo dinámico", true, () => getDoc(doc(anon, "pedidos_flujo-abc/1"))],
  ["ERP (anónimo) lista pedidos web", true, () => getDocs(collection(anon, "pedidos_web"))],
  ["ERP (anónimo) borra un pedido web al aprobar", true, () => deleteDoc(doc(anon, "pedidos_web/PD-1"))],

  ["anónimo NO lee perfiles", false, () => getDoc(doc(anon, "portal_clientes_users/u1"))],
  ["anónimo NO lista perfiles", false, () => getDocs(collection(anon, "portal_clientes_users"))],
  ["anónimo NO se pone admin (adminUsers)", false, () => setDoc(doc(anon, "adminUsers/anon1"), { role: "admin" })],
  ["anónimo NO se da un rol del panel", false, () => setDoc(doc(anon, "adminRoles/x@gmail.com"), { permissions: ["superadmin"] })],
  ["anónimo NO lee intenciones de pago", false, () => getDoc(doc(anon, "checkout_payment_intents/PD-1"))],
  ["anónimo NO lee cobros de Culqi", false, () => getDoc(doc(anon, "culqiCharges/tkn_1"))],
  ["anónimo NO edita productos", false, () => updateDoc(doc(anon, "productos_wala/p1"), { price: 1 })],
  ["anónimo NO lee la copia wala_pedidos ajena", false, () => getDoc(doc(anon, "wala_pedidos/PD-9"))],
  ["anónimo NO crea una copia wala_pedidos pagada", false, () => setDoc(doc(anon, "wala_pedidos/PD-2"), { pagado: true, estadoWala: "pagado" })],
  ["anónimo crea una copia wala_pedidos SIN pago", true, () => setDoc(doc(anon, "wala_pedidos/PD-3"), { pagado: false, estadoWala: "pendiente_pago" })],

  ["cliente lee su perfil", true, () => getDoc(doc(cliente, "portal_clientes_users/u1"))],
  ["cliente cambia su nombre", true, () => updateDoc(doc(cliente, "portal_clientes_users/u1"), { displayName: "Ana" })],
  ["cliente NO se suma monedas", false, () => updateDoc(doc(cliente, "portal_clientes_users/u1"), { monedas: 999 })],
  ["cliente NO cambia su DNI ya puesto", false, () => updateDoc(doc(cliente, "portal_clientes_users/u1"), { dni: "2" })],
  ["cliente NO lee el perfil de otro", false, () => getDoc(doc(cliente, "portal_clientes_users/u2"))],
  ["cliente lee su copia wala_pedidos", true, () => getDoc(doc(cliente, "wala_pedidos/PD-1"))],
  ["cliente consulta sus copias wala_pedidos", true, () => getDocs(query(collection(cliente, "wala_pedidos"), where("buyerUid", "==", "u1")))],
  ["cliente guarda un diseño", true, () => addDoc(collection(cliente, "designs"), { userId: "u1" })],

  ["admin (claim) edita productos", true, () => updateDoc(doc(admin, "productos_wala/p1"), { price: 89 })],
  ["admin (claim) lista perfiles", true, () => getDocs(collection(admin, "portal_clientes_users"))],
  ["admin (claim) lista wala_pedidos (Recepción)", true, () => getDocs(collection(admin, "wala_pedidos"))],
  ["rol del panel con correo verificado edita productos", true, () => updateDoc(doc(rolPanel, "productos_wala/p1"), { price: 79 })],
  ["rol del panel SIN correo verificado NO edita", false, () => updateDoc(doc(rolSinVerificar, "productos_wala/p1"), { price: 1 })],
  ["nadie desde el navegador lee intenciones de pago (ni admin)", false, () => getDoc(doc(admin, "checkout_payment_intents/PD-1"))],
];

let fallas = 0;
for (const [desc, debe, fn] of casos) {
  try {
    await (debe ? assertSucceeds(fn()) : assertFails(fn()));
    console.log(`OK    ${desc}`);
  } catch (e) {
    fallas++;
    console.log(`FALLA ${desc}  → ${String(e.message).split("\n")[0]}`);
  }
}
console.log(`\n${casos.length - fallas}/${casos.length} casos como se esperaba.`);
await env.cleanup();
process.exit(fallas ? 1 : 0);
