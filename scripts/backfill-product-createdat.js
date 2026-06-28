/**
 * Backfill de `createdAt` (Timestamp) + `createdAtMs` (epoch ms) en `productos_wala`.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * POR QUÉ EXISTE
 *   La paginación de la tienda ordena el catálogo con orderBy('createdAt','desc')
 *   en el modo "newest". Firestore EXCLUYE de cualquier query ordenada por un
 *   campo a los docs que NO tienen ese campo, y además ordena primero por TIPO de
 *   dato (los String ISO y los Timestamp quedan en bloques separados). Resultado:
 *   productos legacy sin `createdAt` (o con `createdAt` String) pueden desaparecer
 *   o quedar mal ordenados en la grilla paginada.
 *
 *   Este script deja los DATOS listos para un futuro orden consistente:
 *     1. Normaliza `createdAt` a Timestamp (si falta o es String ISO).
 *     2. Escribe SIEMPRE un campo numérico `createdAtMs` (epoch ms) derivado de
 *        ese createdAt. Un campo numérico ordena sin exclusión por tipo y permite
 *        más adelante cambiar el orden a createdAtMs sin sorpresas.
 *     3. Si falta `visible`, lo fija en true (los ocultos deliberados ya tienen
 *        visible:false y NO se tocan).
 *
 *   NOTA: este script NO cambia el código de ordenamiento (eso es un paso
 *   posterior, tras correrlo). Solo deja `createdAtMs` poblado.
 *
 * QUÉ DECIDE PARA `createdAt` (no destructivo, documentado)
 *   - ya es Timestamp                 → no se reescribe createdAt.
 *   - String ISO (u otro parseable)   → Timestamp.fromDate(new Date(valor)).
 *   - falta del todo / null / inválido→ se usa, POR ORDEN:
 *        a) updatedAt si es Timestamp        (instante real más cercano que tenemos)
 *        b) updatedAt si es String parseable
 *        c) doc.createTime (instante de creación real en Firestore, si existe)
 *        d) FALLBACK new Date(0)  ==  1970-01-01  → marca explícitamente "legacy
 *           sin fecha conocida". Se usa epoch 0 a propósito: en orden DESC quedan
 *           al final, sin inventar una fecha falsa más reciente.
 *     (Se sigue la pista del prompt: Timestamp.fromDate(new Date(valor||0)); el
 *      `||0` es justo el caso d.)
 *
 * `createdAtMs`
 *   Siempre = createdAt_resuelto.toMillis()  (número entero, epoch ms).
 *   Es la única razón por la que un doc "ya-timestamp" puede necesitar escritura:
 *   si le falta createdAtMs, se le añade derivándolo del Timestamp existente.
 *
 * IDEMPOTENTE
 *   Un doc se SALTA (no se reescribe) solo si: createdAt ya es Timestamp Y
 *   createdAtMs ya es un número Y (visible ya es boolean O ya es visible). En
 *   cualquier otro caso se calcula el update mínimo necesario. Correrlo dos veces
 *   seguidas: la segunda no escribe nada.
 *
 * SEGURIDAD
 *   - DRY-RUN por defecto: lee, calcula y reporta, pero NO escribe.
 *   - Para escribir hay que pasar --apply explícitamente.
 *   - NO borra ni toca ningún otro campo (precio, nombre, imágenes, etc.).
 *   - Escribe en lotes (batched writes) de 400 ops por commit.
 *
 * REQUISITOS
 *   - Node + firebase-admin resoluble. En Cloud Shell suele estar; si no:
 *       cd wala-master && npm install firebase-admin
 *   - Credenciales por Application Default Credentials:
 *       * Cloud Shell (recomendado): ya estás autenticado. Fija el proyecto:
 *           gcloud config set project sistema-gestion-3b225
 *         (o pásalo con --project sistema-gestion-3b225)
 *       * Local con service account:
 *           PowerShell:  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\serviceAccount.json"
 *           bash:        export GOOGLE_APPLICATION_CREDENTIALS="/ruta/serviceAccount.json"
 *
 * USO EXACTO
 *   # 1) DRY-RUN (por defecto, NO escribe): muestra cuántos docs cambiarían.
 *   node scripts/backfill-product-createdat.js --project sistema-gestion-3b225
 *
 *   # 2) APLICAR de verdad (escribe en lotes):
 *   node scripts/backfill-product-createdat.js --project sistema-gestion-3b225 --apply
 *
 *   Flags:
 *     --apply            Escribe los cambios. Sin este flag = DRY-RUN.
 *     --project <id>     Proyecto destino. Si se omite, se infiere de
 *                        GOOGLE_CLOUD_PROJECT / GCLOUD_PROJECT / del service account.
 *     --limit <n>        Procesa solo los primeros n docs (útil para probar).
 */

'use strict';

let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error('No se pudo cargar "firebase-admin".');
  console.error('Instálalo dentro de wala-master:  npm install firebase-admin');
  process.exit(1);
}

// ── Constantes ───────────────────────────────────────────────────────────────
const COLLECTION = 'productos_wala';
const DEFAULT_PROJECT_ID = 'sistema-gestion-3b225'; // producción real (.firebaserc default)
const BATCH_SIZE = 400; // < 500 (límite de Firestore por batch), con margen.

// ── Parseo de argumentos ─────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const getOpt = (name, def = null) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
};

const apply = hasFlag('--apply'); // sin --apply => DRY-RUN
const limit = getOpt('--limit') ? parseInt(getOpt('--limit'), 10) : null;

// ── Resolver proyecto destino ────────────────────────────────────────────────
function resolveProjectId() {
  const fromFlag = getOpt('--project');
  if (fromFlag) return fromFlag;
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  const sa = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (sa) {
    try {
      const fs = require('fs');
      const parsed = JSON.parse(fs.readFileSync(sa, 'utf8'));
      if (parsed && parsed.project_id) return parsed.project_id;
    } catch (e) {
      /* se reporta abajo / cae al default */
    }
  }
  return DEFAULT_PROJECT_ID;
}

const projectId = resolveProjectId();

// ── Inicializar Admin SDK ────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId,
});
const db = admin.firestore();
const { Timestamp } = admin.firestore;

// ── Helpers de tipos ─────────────────────────────────────────────────────────
const isTimestamp = (v) =>
  v instanceof Timestamp ||
  (v && typeof v === 'object' && typeof v.toDate === 'function' && typeof v.seconds === 'number');

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

function parseToTimestamp(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
}

/**
 * Resuelve el Timestamp de createdAt para un doc.
 * @returns {{ ts: Timestamp, createdAtChanged: boolean, reason: string }}
 *   - ts: el Timestamp final (siempre presente; de él se deriva createdAtMs).
 *   - createdAtChanged: true si hay que ESCRIBIR el campo createdAt.
 */
function resolveCreatedAt(data, snap) {
  const cur = data.createdAt;

  // Ya es Timestamp: respetar, no reescribir createdAt.
  if (isTimestamp(cur)) {
    return { ts: cur, createdAtChanged: false, reason: 'ya-timestamp' };
  }

  // String ISO (u otro parseable): normalizar a Timestamp.
  if (typeof cur === 'string' && cur.trim()) {
    const ts = parseToTimestamp(cur);
    if (ts) return { ts, createdAtChanged: true, reason: 'string->ts' };
  }

  // Falta / null / inválido: derivar el mejor origen disponible.
  if (isTimestamp(data.updatedAt)) {
    return { ts: data.updatedAt, createdAtChanged: true, reason: 'desde-updatedAt' };
  }
  if (typeof data.updatedAt === 'string' && data.updatedAt.trim()) {
    const ts = parseToTimestamp(data.updatedAt);
    if (ts) return { ts, createdAtChanged: true, reason: 'desde-updatedAt-string' };
  }
  if (snap && isTimestamp(snap.createTime)) {
    return { ts: snap.createTime, createdAtChanged: true, reason: 'desde-createTime' };
  }
  // Fallback explícito: epoch 0 (new Date(0) === 1970-01-01). Marca legacy sin
  // fecha conocida; en orden DESC queda al final sin inventar fecha reciente.
  return { ts: Timestamp.fromDate(new Date(0)), createdAtChanged: true, reason: 'fallback-epoch0' };
}

// ── Flujo principal ──────────────────────────────────────────────────────────
(async () => {
  console.log('────────────────────────────────────────────────────────────');
  console.log(' Backfill createdAt + createdAtMs · ' + COLLECTION);
  console.log('   Proyecto destino : ' + projectId);
  console.log('   Modo             : ' + (apply ? 'APLICAR (--apply: escribe)' : 'DRY-RUN (no escribe)'));
  if (limit) console.log('   Límite           : primeros ' + limit + ' docs');
  console.log('────────────────────────────────────────────────────────────');

  // Leer toda la colección. Un get() SIN orderBy NO excluye docs sin createdAt
  // (la exclusión solo ocurre al ordenar por ese campo), así que aquí los vemos
  // todos —que es justo el punto del backfill—.
  let q = db.collection(COLLECTION);
  if (limit) q = q.limit(limit);
  const snap = await q.get();
  const docs = snap.docs;
  console.log('Leídos ' + docs.length + ' documentos.');

  if (docs.length === 0) {
    console.log('Nada que procesar.');
    process.exit(0);
  }

  const reasons = {};
  let createdAtWrites = 0;
  let createdAtMsWrites = 0;
  let visibleWrites = 0;
  const pending = []; // { ref, updates }

  for (const d of docs) {
    const data = d.data();
    const updates = {};

    // 1) createdAt (Timestamp) + de él derivamos createdAtMs.
    const { ts, createdAtChanged, reason } = resolveCreatedAt(data, d);
    if (createdAtChanged) {
      updates.createdAt = ts;
      createdAtWrites++;
      reasons[reason] = (reasons[reason] || 0) + 1;
    }

    // 2) createdAtMs SIEMPRE derivado del Timestamp resuelto. Solo se escribe si
    //    falta o no coincide (idempotente: si ya está correcto, no se reescribe).
    const desiredMs = ts.toMillis();
    if (!isFiniteNumber(data.createdAtMs) || data.createdAtMs !== desiredMs) {
      updates.createdAtMs = desiredMs;
      createdAtMsWrites++;
    }

    // 3) visible: si falta el campo (no es boolean), fijar true. Los ocultos
    //    deliberados ya tienen visible:false (boolean) y NO se tocan.
    if (typeof data.visible !== 'boolean') {
      updates.visible = true;
      visibleWrites++;
    }

    if (Object.keys(updates).length > 0) {
      pending.push({ ref: d.ref, updates });
    }
  }

  console.log('');
  console.log('Resumen de cambios:');
  console.log('  createdAt normalizados a Timestamp : ' + createdAtWrites);
  Object.entries(reasons).forEach(([r, n]) => console.log('      - ' + r + ': ' + n));
  console.log('  createdAtMs escritos/actualizados  : ' + createdAtMsWrites);
  console.log('  visible fijado a true (faltaba)    : ' + visibleWrites);
  console.log('  docs con algún cambio              : ' + pending.length);
  console.log('  docs sin cambios (idempotente)     : ' + (docs.length - pending.length));

  if (pending.length === 0) {
    console.log('\nTodo ya está normalizado. Nada que escribir.');
    process.exit(0);
  }

  if (!apply) {
    console.log('\n[DRY-RUN] No se escribió nada. Repite con  --apply  para aplicar los cambios.');
    process.exit(0);
  }

  // Escritura en lotes (batched writes).
  let written = 0;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const slice = pending.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    slice.forEach(({ ref, updates }) => batch.update(ref, updates));
    await batch.commit();
    written += slice.length;
    console.log('  ...escritos ' + written + '/' + pending.length);
  }

  console.log('\n✅ Listo. ' + written + ' documentos actualizados en ' + projectId + '.');
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ Error en el backfill:', err && err.message ? err.message : err);
  process.exit(1);
});
