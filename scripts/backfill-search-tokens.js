/**
 * Backfill de campos de BÚSQUEDA (`nameLower` + `searchTokens`) en `productos_wala`.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * POR QUÉ EXISTE
 *   La búsqueda del marketplace pasó de filtrar TODO el catálogo en memoria (no
 *   escala) a resolverse por Firestore usando dos campos derivados en write-time
 *   (ver src/services/products.js → normalizeProductPayload):
 *     - nameLower    : nombre en minúsculas y SIN tildes/diacríticos. Habilita la
 *                      query por prefijo  where('nameLower','>=',q) &
 *                      where('nameLower','<', q+'')  con orderBy('nameLower').
 *     - searchTokens : array de prefijos (≥2 chars) de cada palabra del nombre +
 *                      marca + tipo, en minúsculas sin tildes. Habilita la query
 *                      where('searchTokens','array-contains', q).
 *
 *   Los productos NUEVOS o EDITADOS ya escriben estos campos solos. Este script
 *   rellena los productos EXISTENTES (legacy) que aún no los tienen, para que la
 *   búsqueda por Firestore los encuentre. Mientras tanto el servicio de búsqueda
 *   cae a memoria como fallback, así que /buscar funciona incluso ANTES de correr
 *   este backfill; correrlo es lo que hace que la búsqueda escale.
 *
 *   La transformación aquí DEBE ser idéntica a la de products.js
 *   (normalizeSearchText + buildSearchTokens). Si cambias una, cambia la otra.
 *
 * QUÉ ESCRIBE (no destructivo)
 *   - nameLower    = normalizeSearchText(name)
 *   - searchTokens = buildSearchTokens(name, brandId, productType)
 *   Usa el MISMO `name` que ya tiene el doc (no lo recalcula ni lo toca). No borra
 *   ni modifica ningún otro campo (precio, imágenes, variantes, etc.).
 *
 * IDEMPOTENTE
 *   Un doc se SALTA si nameLower ya coincide con el esperado Y searchTokens ya
 *   coincide (mismo conjunto de tokens, sin importar el orden). En cualquier otro
 *   caso se escribe el update mínimo. Correrlo dos veces: la segunda no escribe nada.
 *
 * SEGURIDAD
 *   - DRY-RUN por defecto: lee, calcula y reporta, pero NO escribe.
 *   - Para escribir hay que pasar --apply explícitamente.
 *   - Escribe en lotes (batched writes) de 400 ops por commit.
 *
 * REQUISITOS
 *   - Node + firebase-admin resoluble. Si no está:  cd wala-master && npm install firebase-admin
 *   - Credenciales por Application Default Credentials:
 *       * Cloud Shell (recomendado): ya autenticado. Fija el proyecto:
 *           gcloud config set project sistema-gestion-3b225
 *       * Local con service account:
 *           PowerShell:  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\serviceAccount.json"
 *           bash:        export GOOGLE_APPLICATION_CREDENTIALS="/ruta/serviceAccount.json"
 *
 * USO EXACTO
 *   # 1) DRY-RUN (por defecto, NO escribe): muestra cuántos docs cambiarían.
 *   node scripts/backfill-search-tokens.js --project sistema-gestion-3b225
 *
 *   # 2) APLICAR de verdad (escribe en lotes):
 *   node scripts/backfill-search-tokens.js --project sistema-gestion-3b225 --apply
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

// ── Normalización (DEBE coincidir con src/services/products.js) ──────────────
const MAX_SEARCH_TOKENS = 60;
const MIN_TOKEN_LEN = 2;
const MAX_PREFIX_LEN = 12;

function normalizeSearchText(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos (tildes); ñ→n
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchTokens(...parts) {
  const text = parts.map(normalizeSearchText).filter(Boolean).join(' ');
  if (!text) return [];
  const words = Array.from(new Set(text.split(' ').filter((w) => w.length >= MIN_TOKEN_LEN)));
  const tokens = new Set();
  for (const w of words) {
    const upper = Math.min(w.length, MAX_PREFIX_LEN);
    for (let len = MIN_TOKEN_LEN; len <= upper; len++) {
      tokens.add(w.slice(0, len));
    }
    if (w.length > MAX_PREFIX_LEN) tokens.add(w);
    if (tokens.size >= MAX_SEARCH_TOKENS) break;
  }
  return Array.from(tokens).slice(0, MAX_SEARCH_TOKENS);
}

// El nombre efectivo es el mismo fallback que usa normalizeProductPayload.
function effectiveName(data) {
  const n = (data.name == null ? '' : String(data.name)).trim();
  if (n) return n;
  return data.isComboProduct ? 'Combo' : 'Sin nombre';
}

// Compara dos arrays de tokens como CONJUNTOS (orden irrelevante).
function sameTokenSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const t of b) if (!sa.has(t)) return false;
  return true;
}

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

// ── Flujo principal ──────────────────────────────────────────────────────────
(async () => {
  console.log('────────────────────────────────────────────────────────────');
  console.log(' Backfill nameLower + searchTokens · ' + COLLECTION);
  console.log('   Proyecto destino : ' + projectId);
  console.log('   Modo             : ' + (apply ? 'APLICAR (--apply: escribe)' : 'DRY-RUN (no escribe)'));
  if (limit) console.log('   Límite           : primeros ' + limit + ' docs');
  console.log('────────────────────────────────────────────────────────────');

  // get() SIN orderBy ve TODOS los docs (incluidos los que aún no tienen estos
  // campos), que es justo el punto del backfill.
  let q = db.collection(COLLECTION);
  if (limit) q = q.limit(limit);
  const snap = await q.get();
  const docs = snap.docs;
  console.log('Leídos ' + docs.length + ' documentos.');

  if (docs.length === 0) {
    console.log('Nada que procesar.');
    process.exit(0);
  }

  let nameLowerWrites = 0;
  let tokensWrites = 0;
  const pending = []; // { ref, updates }

  for (const d of docs) {
    const data = d.data();
    const updates = {};

    const name = effectiveName(data);
    const desiredNameLower = normalizeSearchText(name);
    const desiredTokens = buildSearchTokens(name, data.brandId, data.productType);

    if (data.nameLower !== desiredNameLower) {
      updates.nameLower = desiredNameLower;
      nameLowerWrites++;
    }
    if (!sameTokenSet(data.searchTokens, desiredTokens)) {
      updates.searchTokens = desiredTokens;
      tokensWrites++;
    }

    if (Object.keys(updates).length > 0) {
      pending.push({ ref: d.ref, updates });
    }
  }

  console.log('');
  console.log('Resumen de cambios:');
  console.log('  nameLower escritos/actualizados    : ' + nameLowerWrites);
  console.log('  searchTokens escritos/actualizados : ' + tokensWrites);
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
