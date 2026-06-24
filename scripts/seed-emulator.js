/**
 * Siembra el EMULADOR de Firebase (proyecto demo 'demo-wala') con datos de ejemplo
 * para ver todo funcionando en local: productos, nichos, vendedores, categorías,
 * ruleta, reto semanal, usuarios (admin + cliente con claim) y un pedido finalizado.
 *
 * Requiere que el emulador esté CORRIENDO (npm run emulators) en otra terminal.
 * Uso:  npm run seed
 *
 * No usa credenciales reales: el Admin SDK se conecta a los emuladores por las
 * variables FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST.
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "localhost:9099";

const path = require("path");
// firebase-admin vive en functions/node_modules (la raíz es la app cliente).
const admin = require(require.resolve("firebase-admin", { paths: [path.join(__dirname, "..", "functions", "node_modules")] }));
admin.initializeApp({ projectId: "demo-wala" });
const db = admin.firestore();
const auth = admin.auth();

const IMG = "https://placehold.co/600x600/7C3AED/FFFFFF/png?text=Wala";

async function setDoc(coll, id, data) {
  await db.collection(coll).doc(id).set(data, { merge: true });
}

async function ensureUser(uid, email, password, claims) {
  try { await auth.getUser(uid); }
  catch { await auth.createUser({ uid, email, password, emailVerified: true }); }
  if (claims) await auth.setCustomUserClaims(uid, claims);
}

(async () => {
  // ── Nichos ──────────────────────────────────────────────────────────────────
  await setDoc("niches", "regala-con-amor", { slug: "regala-con-amor", name: "Regala Con Amor", type: "general", commissionPct: 0, active: true, order: 0, imageUrl: "" });
  await setDoc("niches", "ropa-personalizada", { slug: "ropa-personalizada", name: "Ropa Personalizada", type: "personalizados", commissionPct: 10, active: true, order: 1, imageUrl: "" });

  // ── Vendedores ──────────────────────────────────────────────────────────────
  await setDoc("vendors", "casa", { name: "Casa", displayName: "Wala (Casa)", slug: "casa", type: "house", status: "active", commissionPct: 0, logoUrl: "" });
  await setDoc("vendors", "estampados-lima", { name: "Estampados Lima", displayName: "Estampados Lima", slug: "estampados-lima", type: "pod", status: "active", commissionPct: 12, logoUrl: "" });

  // ── Categorías ──────────────────────────────────────────────────────────────
  await setDoc("tienda_categories", "polos", { name: "Polos", imageUrl: "", order: 0 });
  await setDoc("tienda_categories", "tazas", { name: "Tazas", imageUrl: "", order: 1 });

  // ── Productos ───────────────────────────────────────────────────────────────
  const products = [
    { id: "p1", name: "Polo personalizado", sku: "POLO-001", price: 49.9, vendorId: "casa", nicheId: "ropa-personalizada", fulfillmentType: "print_on_demand", customizable: true, categories: ["polos"] },
    { id: "p2", name: "Taza mágica", sku: "TAZA-001", price: 29.9, vendorId: "casa", nicheId: "regala-con-amor", fulfillmentType: "stock", customizable: false, categories: ["tazas"], inStock: 25 },
    { id: "p3", name: "Polo edición Lima", sku: "POLO-LIM", price: 59.9, vendorId: "estampados-lima", nicheId: "ropa-personalizada", fulfillmentType: "print_on_demand", customizable: true, categories: ["polos"] },
    { id: "p4", name: "Gorro bordado", sku: "GORRO-001", price: 39.9, salePrice: 34.9, vendorId: "estampados-lima", nicheId: "regala-con-amor", fulfillmentType: "stock", customizable: false, inStock: 10 },
  ];
  for (const p of products) {
    await setDoc("productos_wala", p.id, {
      ...p, mainImage: IMG, images: [IMG], visible: true, featured: true,
      createdAt: new Date().toISOString(), isV2: true,
    });
  }

  // ── Ruleta ──────────────────────────────────────────────────────────────────
  await setDoc("ruletaPrizes", "r1", { prize: "5 monedas", type: "Monedas", amount: 5, probability: 50 });
  await setDoc("ruletaPrizes", "r2", { prize: "10 monedas", type: "Monedas", amount: 10, probability: 30 });
  await setDoc("ruletaPrizes", "r3", { prize: "20 monedas", type: "Monedas", amount: 20, probability: 20 });

  // ── Reto semanal activo ───────────────────────────────────────────────────────
  await setDoc("weeklyChallenges", "c1", { title: "Agrega 1 a tu wishlist", description: "Suma productos a tu lista de deseos", actionType: "add_wishlist", goal: 1, rewardCoins: 5, rewardType: "main" });
  await setDoc("globals", "activeChallenge", { challengeId: "c1", title: "Agrega 1 a tu wishlist", description: "Suma productos a tu lista de deseos", actionType: "add_wishlist", goal: 1, rewardCoins: 5, rewardType: "main", startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 864e5).toISOString() });

  // ── Usuarios (Auth + perfil) ──────────────────────────────────────────────────
  await ensureUser("admin-uid", "admin@wala.test", "wala1234", { admin: true, role: "superadmin" });
  await setDoc("adminUsers", "admin-uid", { role: "admin", email: "admin@wala.test" });
  await setDoc("portal_clientes_users", "admin-uid", { email: "admin@wala.test", displayName: "Admin Demo", role: "admin", referralCode: "KS-ADMIN1", monedas: 100 });

  await ensureUser("cliente-uid", "cliente@wala.test", "wala1234", null);
  await setDoc("portal_clientes_users", "cliente-uid", { email: "cliente@wala.test", displayName: "Cliente Demo", dni: "12345678", phone: "999888777", referralCode: "KS-CLI001", monedas: 50, kapiCoins: 3 });

  // ── Pedido finalizado (para probar reclamo de monedas) ────────────────────────
  await setDoc("pedidos_web", "order-1", { userId: "cliente-uid", dni: "12345678", estadoGeneral: "finalizado", total: 120, clienteCorreo: "cliente@wala.test", createdAt: new Date().toISOString() });

  console.log("✓ Emulador sembrado: 4 productos, 2 nichos, 2 vendedores, 2 categorías, ruleta, reto activo, admin@wala.test / cliente@wala.test (pass: wala1234), pedido finalizado order-1.");
  process.exit(0);
})().catch((e) => { console.error("Error sembrando:", e); process.exit(1); });
