/**
 * Siembra 4 misiones diarias de ejemplo en la colección `missions`, para
 * poder probar el flujo completo en /cuenta/misiones y /admin/misiones.
 *
 * IDs fijos (mision-catalogo, etc.): correrlo dos veces actualiza los mismos
 * documentos en vez de duplicarlos.
 *
 * Emulador (default, seguro):
 *   npm run seed:misiones
 *
 * Firebase REAL (usa serviceAccountKey.json en la raíz del repo):
 *   npm run seed:misiones:prod
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
  console.error("    Esto crea/actualiza 4 misiones diarias en producción.");
  console.error("");
  console.error("    Confirma con:");
  console.error("      npm run seed:misiones:prod");
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
    console.error("  6. Vuelve a correr: npm run seed:misiones:prod");
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

const MISIONES = [
  {
    id: "mision-catalogo",
    title: "Visita el Catálogo de Recompensas",
    description: "Dale un vistazo a lo que puedes canjear con tus monedas.",
    rewardPoints: 2,
    order: 1,
    active: true,
    type: "daily",
  },
  {
    id: "mision-lista-deseos",
    title: "Agrega un producto a tu Lista de Deseos",
    description: "Guarda algo que te guste para más adelante.",
    rewardPoints: 3,
    order: 2,
    active: true,
    type: "daily",
  },
  {
    id: "mision-mis-cupones",
    title: "Revisa tus Cupones",
    description: "Mira si tienes algún cupón disponible para usar.",
    rewardPoints: 2,
    order: 3,
    active: true,
    type: "daily",
  },
  {
    id: "mision-minijuegos",
    title: "Explora Minijuegos",
    description: "Entra a la Zona Arcade y juega un rato.",
    rewardPoints: 3,
    order: 4,
    active: true,
    type: "daily",
  },
];

async function main() {
  for (const { id, ...data } of MISIONES) {
    await db.collection("missions").doc(id).set(data, { merge: true });
    console.log(`  ✓ ${id} — ${data.title}`);
  }
  console.log("\nListo. Revisa /admin/misiones y /cuenta/misiones.");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error al sembrar misiones:", e);
  process.exit(1);
});
