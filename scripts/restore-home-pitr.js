/**
 * Restaurar la portada (pages/home) desde el historial de Firestore
 * ────────────────────────────────────────────────────────────────────────────
 * La home se sobrescribió con la configuración de la landing de Yoryo: quedó
 * con las mismas 6 secciones y los mismos ids que pages/yoryo. La original
 * tenía 10 (barra de anuncios, hero, mosaico de banners, cuadrícula de
 * categorías, destacados, novedades, ofertas, íconos de confianza, testimonios
 * y FAQ).
 *
 * La base tiene Point-in-time recovery ACTIVO con 7 días de retención
 * (pointInTimeRecoveryEnablement: ENABLED, versionRetentionPeriod: 604800s),
 * así que se puede leer el documento tal y como estaba antes.
 *
 * OJO con el SDK: `db.getAll(ref, { readTime })` del Admin SDK de Node IGNORA
 * el readTime en silencio y devuelve el estado actual — se comprobó pidiendo
 * pages/yoryo a una hora en la que aún era hero_banner y devolviendo
 * hero_carousel. Por eso aquí se va por la API REST, que sí lo respeta:
 *   GET …/documents/pages/home?readTime=<RFC3339>
 * El control con pages/yoryo por REST sí devuelve la estructura vieja.
 *
 * Antes de escribir se guarda el estado ACTUAL en pages_backup/, para poder
 * deshacer esta misma restauración.
 *
 * USO:
 *   node scripts/restore-home-pitr.js                    (dry-run)
 *   node scripts/restore-home-pitr.js --confirm          (restaura)
 *   node scripts/restore-home-pitr.js --at=<RFC3339>     (otro momento)
 */
'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const CONFIRMED = process.argv.includes('--confirm');
const argAt = (process.argv.find((a) => a.startsWith('--at=')) || '').slice(5);
// Momento en el que la home todavía estaba entera (se pisó entre 19:00 y 19:45 UTC).
const READ_TIME = argAt || '2026-09-22T19:00:00Z';

const admin = require(require.resolve('firebase-admin', { paths: [fnModules] }));
const sa = JSON.parse(fs.readFileSync(path.join(ROOT, 'serviceAccountKey.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
const db = admin.firestore();

/** Value de la API REST -> valor JS. */
function deValor(v) {
  if (v === null || v === undefined) return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return admin.firestore.Timestamp.fromDate(new Date(v.timestampValue));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(deValor);
  if ('mapValue' in v) return deDocumento(v.mapValue.fields || {});
  if ('bytesValue' in v) return v.bytesValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('referenceValue' in v) return v.referenceValue;
  return null;
}
const deDocumento = (fields) =>
  Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, deValor(v)]));

async function leerEnElPasado(docPath, readTime, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}`
    + `/databases/(default)/documents/${docPath}?readTime=${encodeURIComponent(readTime)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  if (!r.ok) throw new Error(`${docPath} @ ${readTime}: ${(j.error && j.error.message) || r.status}`);
  return deDocumento(j.fields);
}

(async () => {
  console.log(CONFIRMED ? '🚀 RESTAURANDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para restaurar\n');
  console.log('Momento a recuperar:', READ_TIME, '\n');

  const token = (await admin.credential.cert(sa).getAccessToken()).access_token;

  const ahora = (await db.collection('pages').doc('home').get()).data() || {};
  const antes = await leerEnElPasado('pages/home', READ_TIME, token);

  const tipos = (x) => (x.sections || []).map((s) => s.type);
  console.log('AHORA  :', (ahora.sections || []).length, 'secciones →', tipos(ahora).join(', '));
  console.log('ANTES  :', (antes.sections || []).length, 'secciones →', tipos(antes).join(', '));

  if ((antes.sections || []).length === 0) {
    console.error('\n❌ El estado recuperado no tiene secciones. Aborto.');
    process.exit(1);
  }
  if (JSON.stringify(tipos(ahora)) === JSON.stringify(tipos(antes))) {
    console.log('\nYa coinciden: nada que restaurar.');
    process.exit(0);
  }

  if (!CONFIRMED) {
    console.log('\n🧪 Dry-run. Con --confirm se guardaría el estado actual en pages_backup/ y se restauraría el de arriba.');
    process.exit(0);
  }

  // Red de seguridad: poder deshacer esta restauración.
  await db.collection('pages_backup').doc(`home_prerestore_${Date.now()}`).set({
    ...ahora,
    _backupDe: 'pages/home',
    _backupEn: admin.firestore.FieldValue.serverTimestamp(),
    _nota: 'estado con la config de Yoryo, justo antes de restaurar desde PITR',
  });
  console.log('\n💾 estado actual guardado en pages_backup/');

  await db.collection('pages').doc('home').set(antes);

  const check = (await db.collection('pages').doc('home').get()).data() || {};
  const ok = JSON.stringify(tipos(check)) === JSON.stringify(tipos(antes));
  console.log(ok
    ? `✅ restaurada: ${(check.sections || []).length} secciones → ${tipos(check).join(', ')}`
    : '❌ no coincide tras escribir, revisar');

  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('\n❌ Falló:', e.message); process.exit(1); });
