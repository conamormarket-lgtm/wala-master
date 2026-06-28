/**
 * Migración de datos: normaliza `createdAt` y `visible` en `productos_wala`.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * PROBLEMA QUE RESUELVE (problema de DATOS, no de código)
 *   La paginación de la tienda (Fase 3 · C-1, `getStoreProductsPage`) ordena el
 *   catálogo con `orderBy('createdAt','desc')` para el modo "newest". Pero en
 *   Firestore conviven TRES variantes de `createdAt` según cómo se creó el doc:
 *     1. createDocument()  → Timestamp   (serverTimestamp) — firestore.js:155
 *     2. createProduct(data, explicitId) → String ISO (new Date().toISOString())
 *        vía setDocument()  — products.js:490
 *     3. Docs legacy SIN campo `createdAt`.
 *   Firestore ordena PRIMERO por tipo de dato: los String y los Timestamp quedan
 *   en bloques separados, y los docs sin `createdAt` se EXCLUYEN por completo de
 *   cualquier query ordenada por ese campo. Resultado: productos que nunca
 *   aparecen en la grilla paginada.
 *
 * QUÉ HACE ESTE SCRIPT (no destructivo, idempotente)
 *   1. RESPALDA primero toda la colección a ops/backup/snapshots/ (NDJSON) antes
 *      de tocar nada. Sin respaldo correcto, no escribe.
 *   2. Normaliza `createdAt` a Timestamp consistente:
 *        - ya es Timestamp            → no toca.
 *        - String ISO parseable       → Timestamp.fromDate(new Date(str)).
 *        - falta / inválido / null    → usa, por orden: doc.createTime (instante
 *          real de creación en Firestore) → updatedAt (si es Timestamp) →
 *          FALLBACK_TS fijo. Así el doc deja de quedar excluido del orden.
 *   3. Asegura `visible` booleano explícito: si NO es ya boolean, escribe
 *      `visible: (d.visible !== false)` — preserva la intención de ocultos
 *      (false se queda false) y deja el resto en `true` para un futuro
 *      where('visible','==',true). No bloquea por falta del campo.
 *   No toca `updatedAt` ni ningún otro campo. Solo escribe lo que cambia.
 *
 * SEGURIDAD (ver docs/wala/ESCALABILIDAD.md · Fase 0 y ops/backup/README.md)
 *   - Producción real = `sistema-gestion-3b225` (.firebaserc default).
 *   - Por defecto corre en --dry (simula, no escribe).
 *   - Para APLICAR contra producción exige --confirm explícito, y SIEMPRE crea
 *     el respaldo antes de la primera escritura.
 *   - Recomendado: probar primero en staging/emulador o con --limit, y haber
 *     corrido el respaldo completo de ops/backup/ (gcloud firestore export).
 *
 * REQUISITOS
 *   - Node + `firebase-admin` resoluble (en Cloud Shell suele estar; si no:
 *       npm install firebase-admin
 *     dentro de wala-master, o `npm i -g firebase-admin`).
 *   - Credenciales por Application Default:
 *       * Cloud Shell: ya autenticado; fija el proyecto con
 *           gcloud config set project sistema-gestion-3b225
 *         (o pasa --project).
 *       * Local: $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\serviceAccount.json"
 *
 * USO (PowerShell / Cloud Shell)
 *   # 1) Simular (lee + respalda + reporta, NO escribe):
 *   node scripts/migrate-createdAt-visible.js --dry
 *
 *   # 2) Aplicar en STAGING o contra un proyecto que NO es prod:
 *   node scripts/migrate-createdAt-visible.js --project mi-staging
 *
 *   # 3) Aplicar en PRODUCCIÓN (exige confirmación explícita):
 *   node scripts/migrate-createdAt-visible.js --project sistema-gestion-3b225 --confirm
 *
 *   Flags:
 *     --dry              Simula, no escribe (por defecto si no se pasa --confirm
 *                        ni se está en un proyecto no-prod).
 *     --confirm          Necesario para APLICAR contra el proyecto de producción.
 *     --project <id>     Fuerza el proyecto destino (si no, se infiere del entorno).
 *     --limit <n>        Procesa solo los primeros n docs (pruebas).
 *     --no-backup        Omite el respaldo (NO recomendado; bloqueado en prod).
 *     --backup-dir <ruta> Carpeta de respaldo (def. ops/backup/snapshots).
 */

'use strict';

const fs = require('fs');
const path = require('path');

let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error('No se pudo cargar "firebase-admin".');
  console.error('Instálalo dentro de wala-master:  npm install firebase-admin');
  console.error('(o global:  npm install -g firebase-admin)');
  process.exit(1);
}

// ── Constantes de negocio ───────────────────────────────────────────────────
const COLLECTION = 'productos_wala';
const PROD_PROJECT_ID = 'sistema-gestion-3b225'; // .firebaserc default == producción real

// Valor fijo de respaldo SOLO si no hay createTime ni updatedAt utilizables.
// En la práctica casi nunca se usa: Firestore siempre expone doc.createTime.
const FALLBACK_ISO = '2024-01-01T00:00:00.000Z';

// ── Parseo de argumentos ────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const getOpt = (name, def = null) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
};

const wantDry = hasFlag('--dry');
const confirm = hasFlag('--confirm');
const noBackup = hasFlag('--no-backup');
const limit = getOpt('--limit') ? parseInt(getOpt('--limit'), 10) : null;
const backupDirArg = getOpt('--backup-dir');

// ── Resolver el proyecto destino ────────────────────────────────────────────
function resolveProjectId() {
  const fromFlag = getOpt('--project');
  if (fromFlag) return fromFlag;
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  const sa = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (sa) {
    try {
      return JSON.parse(fs.readFileSync(sa, 'utf8')).project_id || null;
    } catch (e) {
      /* ignora: se reporta más abajo */
    }
  }
  return null;
}

const projectId = resolveProjectId();
if (!projectId) {
  console.error('No se pudo determinar el proyecto destino.');
  console.error('Pásalo con --project <id>, o exporta GOOGLE_CLOUD_PROJECT, o fija');
  console.error('GOOGLE_APPLICATION_CREDENTIALS al JSON del service account.');
  process.exit(1);
}

const isProd = projectId === PROD_PROJECT_ID;
// Es escritura solo si NO es dry. Por seguridad, contra prod sin --confirm → forzamos dry.
let applyWrites = !wantDry;
if (isProd && applyWrites && !confirm) {
  console.error('\n⛔ Destino = PRODUCCIÓN (' + PROD_PROJECT_ID + ') y falta --confirm.');
  console.error('   Corre primero  --dry  para revisar, o añade  --confirm  para aplicar.');
  console.error('   (El respaldo se crea automáticamente antes de la primera escritura.)\n');
  process.exit(1);
}

// ── Inicializar Admin SDK apuntando explícitamente al proyecto resuelto ──────
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId,
});
const db = admin.firestore();
const { Timestamp } = admin.firestore;
const FALLBACK_TS = Timestamp.fromDate(new Date(FALLBACK_ISO));

// ── Helpers ─────────────────────────────────────────────────────────────────
const isTimestamp = (v) =>
  v instanceof Timestamp ||
  (v && typeof v === 'object' && typeof v.toDate === 'function' && typeof v.seconds === 'number');

function parseToTimestamp(str) {
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
}

/**
 * Decide el createdAt normalizado para un doc.
 * @returns {{changed:boolean, value?:Timestamp, reason:string}}
 */
function resolveCreatedAt(data, snap) {
  const cur = data.createdAt;

  if (isTimestamp(cur)) return { changed: false, reason: 'ya-timestamp' };

  if (typeof cur === 'string' && cur.trim()) {
    const ts = parseToTimestamp(cur);
    if (ts) return { changed: true, value: ts, reason: 'string->ts' };
    // string no parseable → cae a derivación
  }

  // Falta, es null, o string inválido: derivar el mejor origen disponible.
  if (snap && isTimestamp(snap.createTime)) {
    return { changed: true, value: snap.createTime, reason: 'desde-createTime' };
  }
  if (isTimestamp(data.updatedAt)) {
    return { changed: true, value: data.updatedAt, reason: 'desde-updatedAt' };
  }
  if (typeof data.updatedAt === 'string' && data.updatedAt.trim()) {
    const ts = parseToTimestamp(data.updatedAt);
    if (ts) return { changed: true, value: ts, reason: 'desde-updatedAt-string' };
  }
  return { changed: true, value: FALLBACK_TS, reason: 'fallback-fijo' };
}

/**
 * Decide el visible normalizado.
 * @returns {{changed:boolean, value?:boolean}}
 */
function resolveVisible(data) {
  if (typeof data.visible === 'boolean') return { changed: false };
  // Cualquier otra cosa (ausente/null/string/número): boolean explícito,
  // preservando intención de oculto (solo el estricto false oculta).
  return { changed: true, value: data.visible !== false };
}

// ── Respaldo de la colección a NDJSON ───────────────────────────────────────
function stamp() {
  // yyyymmdd-hhmmss, consistente con ops/backup/README.md
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

function writeBackup(docs) {
  const dir = backupDirArg
    ? path.resolve(backupDirArg)
    : path.join(__dirname, '..', 'ops', 'backup', 'snapshots');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${COLLECTION}_${projectId}_${stamp()}.ndjson`);

  const lines = docs.map((snap) =>
    JSON.stringify({
      id: snap.id,
      createTime: snap.createTime ? snap.createTime.toDate().toISOString() : null,
      updateTime: snap.updateTime ? snap.updateTime.toDate().toISOString() : null,
      data: snap.data(),
    })
  );
  // Una escritura: catálogo de cientos/miles de docs cabe sin problema.
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
  return { file, count: docs.length };
}

// ── Flujo principal ──────────────────────────────────────────────────────────
(async () => {
  console.log('────────────────────────────────────────────────────────────');
  console.log(' Migración createdAt + visible · ' + COLLECTION);
  console.log('   Proyecto destino : ' + projectId + (isProd ? '  (PRODUCCIÓN)' : ''));
  console.log('   Modo             : ' + (applyWrites ? 'APLICAR (escribe)' : 'DRY (simula)'));
  if (limit) console.log('   Límite           : primeros ' + limit + ' docs');
  console.log('────────────────────────────────────────────────────────────');

  // 1) Leer toda la colección (incluye docs sin createdAt: un get() sin orderBy
  //    NO los excluye; el problema solo aparece al ordenar por createdAt).
  let query = db.collection(COLLECTION);
  if (limit) query = query.limit(limit);
  const snap = await query.get();
  const docs = snap.docs;
  console.log(`Leídos ${docs.length} documentos.`);

  if (docs.length === 0) {
    console.log('Nada que migrar.');
    process.exit(0);
  }

  // 2) Respaldo previo (antes de tocar nada).
  if (noBackup) {
    if (applyWrites && isProd) {
      console.error('⛔ --no-backup está prohibido al APLICAR contra producción.');
      process.exit(1);
    }
    console.log('⚠ Respaldo OMITIDO (--no-backup).');
  } else {
    const { file, count } = writeBackup(docs);
    console.log(`Respaldo OK: ${count} docs → ${file}`);
  }

  // 3) Calcular cambios.
  const reasons = {};
  let createdAtChanges = 0;
  let visibleChanges = 0;
  let pending = []; // { ref, updates }

  for (const d of docs) {
    const data = d.data();
    const updates = {};

    const ca = resolveCreatedAt(data, d);
    if (ca.changed) {
      updates.createdAt = ca.value;
      createdAtChanges++;
      reasons[ca.reason] = (reasons[ca.reason] || 0) + 1;
    }

    const vis = resolveVisible(data);
    if (vis.changed) {
      updates.visible = vis.value;
      visibleChanges++;
    }

    if (Object.keys(updates).length > 0) {
      pending.push({ ref: d.ref, updates });
    }
  }

  console.log('');
  console.log('Resumen de cambios a aplicar:');
  console.log('  createdAt normalizados : ' + createdAtChanges);
  Object.entries(reasons).forEach(([r, n]) => console.log(`      - ${r}: ${n}`));
  console.log('  visible booleano fijado : ' + visibleChanges);
  console.log('  docs con algún cambio   : ' + pending.length);
  console.log('  docs sin cambios        : ' + (docs.length - pending.length));

  if (pending.length === 0) {
    console.log('\nTodo ya está normalizado. Nada que escribir.');
    process.exit(0);
  }

  if (!applyWrites) {
    console.log('\n[DRY] No se escribió nada. Repite con --confirm (prod) o sin --dry para aplicar.');
    process.exit(0);
  }

  // 4) Escribir en lotes (máx. 500 ops por batch; usamos 400 de margen).
  const BATCH = 400;
  let written = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    const batch = db.batch();
    slice.forEach(({ ref, updates }) => batch.update(ref, updates));
    await batch.commit();
    written += slice.length;
    console.log(`  ...escritos ${written}/${pending.length}`);
  }

  console.log(`\n✅ Listo. ${written} documentos actualizados en ${projectId}.`);
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ Error en la migración:', err && err.message ? err.message : err);
  process.exit(1);
});
