/**
 * Backfill de `surveyCompletedAt` (epoch ms) en portal_clientes_users.
 * ────────────────────────────────────────────────────────────────────────────
 * Hasta el 2026-10-06 la encuesta solo marcaba `hasCompletedSurvey: true`, sin
 * fecha. Desde entonces la pone grantSurveyRewardSecure. Para los anteriores
 * SOLO se usan fechas reales: el movimiento de loyaltyLedger con source
 * 'encuesta' (el premio que el servidor paga en el mismo momento en que se
 * completa; existe desde el 2026-06-29). Se guarda con
 * `surveyCompletedAtSource: 'monedas'`.
 *
 * Quien la completó antes de eso queda SIN fecha (en el admin: "Fecha
 * desconocida"). A propósito no se estima nada: se necesitan datos reales.
 *
 * Solo toca usuarios con la encuesta completa y SIN surveyCompletedAt. Escribe
 * únicamente esos dos campos.
 *
 * Uso (desde la raíz; usa firebase-admin de functions/):
 *   node scripts/backfill-fecha-encuesta.js            → simula y muestra el resumen
 *   node scripts/backfill-fecha-encuesta.js --aplicar  → escribe
 * Credenciales: serviceAccountKey.json en la raíz o GOOGLE_APPLICATION_CREDENTIALS.
 */
const path = require('path');
const fs = require('fs');

const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const llave = path.join(__dirname, '..', 'serviceAccountKey.json');
admin.initializeApp(fs.existsSync(llave)
  ? { credential: admin.credential.cert(require(llave)) }
  : { credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const APLICAR = process.argv.includes('--aplicar');

(async () => {
  const usuarios = await db.collection('portal_clientes_users').where('hasCompletedSurvey', '==', true).get();
  const pendientes = usuarios.docs.filter((d) => !d.data().surveyCompletedAt);
  console.log(`Completaron la encuesta: ${usuarios.size}. Sin fecha: ${pendientes.length}.`);
  if (!pendientes.length) return;

  // Fecha real: primer premio de encuesta por usuario.
  const ledger = await db.collection('loyaltyLedger').where('source', '==', 'encuesta').get();
  const porMonedas = new Map();
  ledger.forEach((d) => {
    const x = d.data();
    const t = x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0;
    if (!x.uid || !t) return;
    if (!porMonedas.has(x.uid) || t < porMonedas.get(x.uid)) porMonedas.set(x.uid, t);
  });

  const cambios = pendientes
    .filter((d) => porMonedas.has(d.id))
    .map((d) => ({ ref: d.ref, surveyCompletedAt: porMonedas.get(d.id) }));

  console.log(`Con fecha real: ${cambios.length}. Quedan como fecha desconocida: ${pendientes.length - cambios.length}.`);
  const fechas = cambios.map((c) => c.surveyCompletedAt).sort((a, b) => a - b);
  if (fechas.length) {
    console.log(`Rango: ${new Date(fechas[0]).toISOString()} → ${new Date(fechas[fechas.length - 1]).toISOString()}`);
  }

  if (!APLICAR) {
    console.log('\nSimulación: no se escribió nada. Corre con --aplicar para guardar.');
    return;
  }
  for (let i = 0; i < cambios.length; i += 400) {
    const lote = db.batch();
    cambios.slice(i, i + 400).forEach(({ ref, surveyCompletedAt }) => {
      lote.update(ref, { surveyCompletedAt, surveyCompletedAtSource: 'monedas' });
    });
    await lote.commit();
  }
  console.log(`\nGuardado en ${cambios.length} usuarios.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
