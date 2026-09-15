/**
 * Siembra 4 recompensas de ejemplo en el Catálogo de Recompensas
 * (rewardsCatalog), una de cada tipo, para poder probar el flujo completo:
 * ver el catálogo en /cuenta/catalogo, canjear, y confirmar en /cuenta/cupones
 * que el cupón se aplica solo (o pide un asesor, para la de tipo 'manual').
 *
 * IDs fijos (reward-envio-gratis, etc.): correrlo dos veces actualiza los
 * mismos documentos en vez de duplicarlos.
 *
 * Emulador (default, seguro):
 *   npm run seed:recompensas
 *
 * Firebase REAL (usa serviceAccountKey.json en la raíz del repo):
 *   npm run seed:recompensas:prod
 */
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const TO_PROD = args.includes("--prod");
const CONFIRMED = args.includes("--confirm");
const PROD_PROJECT_ID = "sistema-gestion-3b225";
const ROOT = path.join(__dirname, "..");
const fnModules = path.join(ROOT, "functions", "node_modules");

const SA_CANDIDATES = [
  path.join(ROOT, "serviceAccountKey.json"),
  path.join(ROOT, "firebase-service-account.json"),
  path.join(ROOT, "service-account.json"),
  path.join(ROOT, "credentials.json"),
];

function loadServiceAccount() {
  for (const p of SA_CANDIDATES) {
    if (fs.existsSync(p)) {
      return { path: p, data: JSON.parse(fs.readFileSync(p, "utf8")) };
    }
  }
  return null;
}

if (TO_PROD && !CONFIRMED) {
  console.error("");
  console.error("⚠️  Seed a Firebase REAL (sistema-gestion-3b225).");
  console.error("    Esto crea/actualiza 4 recompensas en producción.");
  console.error("");
  console.error("    Confirma con:");
  console.error("      npm run seed:recompensas:prod");
  console.error("");
  process.exit(1);
}

if (!TO_PROD) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
} else {
  delete process.env.FIRESTORE_EMULATOR_HOST;
}

let db;
if (TO_PROD) {
  const sa = loadServiceAccount();
  if (!sa) {
    console.error("");
    console.error("❌ No hay credenciales para Firebase real.");
    console.error("");
    console.error("Haz esto UNA vez:");
    console.error("  1. Entra a https://console.firebase.google.com/");
    console.error("  2. Proyecto: sistema-gestion-3b225 (wala.pe)");
    console.error("  3. ⚙ Project settings → Service accounts");
    console.error("  4. Generate new private key");
    console.error("  5. Guarda el JSON en la raíz del repo como serviceAccountKey.json");
    console.error("  6. Vuelve a correr: npm run seed:recompensas:prod");
    console.error("");
    process.exit(1);
  }

  const admin = require(require.resolve("firebase-admin", { paths: [fnModules] }));
  admin.initializeApp({
    credential: admin.credential.cert(sa.data),
    projectId: sa.data.project_id || PROD_PROJECT_ID,
  });
  db = admin.firestore();
  console.log(`→ Sembrando en Firebase REAL: ${sa.data.project_id || PROD_PROJECT_ID}`);
  console.log(`  Credenciales: ${path.basename(sa.path)}`);
} else {
  const admin = require(require.resolve("firebase-admin", { paths: [fnModules] }));
  admin.initializeApp({ projectId: "demo-wala" });
  db = admin.firestore();
  console.log("→ Sembrando en EMULADOR local (demo-wala)");
}

const RECOMPENSAS = [
  {
    id: "reward-envio-gratis",
    title: "Envío gratis en tu próximo pedido",
    description: "Anula el costo de envío de tu siguiente compra en Walá.",
    cost: 15,
    order: 1,
    active: true,
    tipo: "envio_gratis",
    descuentoPct: 0,
    descuentoMonto: 0,
    topeDescuento: 0,
    productId: "",
    productName: "",
    vigenciaDias: 30,
    imageUrl: "",
    value: "",
  },
  {
    id: "reward-descuento-10",
    title: "S/10 de descuento",
    description: "Descuento fijo de S/10 sobre el total de tu pedido.",
    cost: 30,
    order: 2,
    active: true,
    tipo: "descuento",
    descuentoPct: 0,
    descuentoMonto: 10,
    topeDescuento: 0,
    productId: "",
    productName: "",
    vigenciaDias: 30,
    imageUrl: "",
    value: "",
  },
  {
    id: "reward-descuento-15pct",
    title: "15% de descuento",
    description: "15% de descuento en tu pedido, hasta S/30.",
    cost: 60,
    order: 3,
    active: true,
    tipo: "descuento",
    descuentoPct: 15,
    descuentoMonto: 0,
    topeDescuento: 30,
    productId: "",
    productName: "",
    vigenciaDias: 30,
    imageUrl: "",
    value: "",
  },
  {
    id: "reward-stickers",
    title: "Pack de stickers Walá",
    description: "Un pack de stickers coleccionables de Kapi, enviado a tu domicilio.",
    cost: 20,
    order: 4,
    active: true,
    tipo: "manual",
    descuentoPct: 0,
    descuentoMonto: 0,
    topeDescuento: 0,
    productId: "",
    productName: "",
    vigenciaDias: 30,
    imageUrl: "",
    value: "Se coordina el envío con un asesor tras el canje.",
  },
];

async function main() {
  for (const { id, ...data } of RECOMPENSAS) {
    await db.collection("rewardsCatalog").doc(id).set(data, { merge: true });
    console.log(`  ✓ ${id} — ${data.title}`);
  }
  console.log("\nListo. Revisa /admin/recompensas y /cuenta/catalogo.");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error al sembrar recompensas:", e);
  process.exit(1);
});
