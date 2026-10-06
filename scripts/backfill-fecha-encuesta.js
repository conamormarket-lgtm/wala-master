/**
 * Backfill de `surveyCompletedAt` (epoch ms) en portal_clientes_users.
 * ────────────────────────────────────────────────────────────────────────────
 * Hasta el 2026-10-06 la encuesta solo marcaba `hasCompletedSurvey: true`, sin
 * fecha. Desde entonces la pone grantSurveyRewardSecure. Para los anteriores se
 * reconstruye así (y se guarda de dónde salió en `surveyCompletedAtSource`):
 *
 *   'monedas'  → fecha EXACTA: el movimiento de loyaltyLedger con source
 *                'encuesta' (premio por completarla; existe desde el 2026-06-29).
 *   'estimada' → la visita a /encuesta-suscripcion (analytics_events) en la que
 *                más tiempo pasó (route_dwell con mayor dwellMs): ahí la llenó.
 *                Contra los 70 con fecha exacta acierta en 69 (< 1 h de error).
 *                Sin route_dwell, la última visita a la encuesta.
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
const RUTA_ENCUESTA = '/encuesta-suscripcion';

(async () => {
  const usuarios = await db.collection('portal_clientes_users').where('hasCompletedSurvey', '==', true).get();
  const pendientes = usuarios.docs.filter((d) => !d.data().surveyCompletedAt);
  console.log(`Completaron la encuesta: ${usuarios.size}. Sin fecha: ${pendientes.length}.`);
  if (!pendientes.length) return;

  // Fecha exacta: primer premio de encuesta por usuario.
  const ledger = await db.collection('loyaltyLedger').where('source', '==', 'encuesta').get();
  const porMonedas = new Map();
  ledger.forEach((d) => {
    const x = d.data();
    const t = x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0;
    if (!x.uid || !t) return;
    if (!porMonedas.has(x.uid) || t < porMonedas.get(x.uid)) porMonedas.set(x.uid, t);
  });

  // Estimada: visitas a la página de la encuesta.
  const eventos = await db.collection('analytics_events')
    .where('path', '==', RUTA_ENCUESTA)
    .select('uid', 'type', 'clientTsMs', 'dwellMs')
    .get();
  const visitas = new Map();
  eventos.forEach((d) => {
    const x = d.data();
    if (!x.uid || !x.clientTsMs) return;
    if (!visitas.has(x.uid)) visitas.set(x.uid, []);
    visitas.get(x.uid).push(x);
  });
  const estimar = (uid) => {
    const lista = visitas.get(uid);
    if (!lista || !lista.length) return 0;
    const dwell = lista.filter((x) => x.type === 'route_dwell')
      .sort((a, b) => (b.dwellMs || 0) - (a.dwellMs || 0))[0];
    if (dwell) return dwell.clientTsMs;
    return Math.max(...lista.map((x) => x.clientTsMs));
  };

  const cambios = [];
  const sinDatos = [];
  pendientes.forEach((d) => {
    const exacta = porMonedas.get(d.id);
    if (exacta) return cambios.push({ ref: d.ref, surveyCompletedAt: exacta, surveyCompletedAtSource: 'monedas' });
    const estimada = estimar(d.id);
    if (estimada) return cambios.push({ ref: d.ref, surveyCompletedAt: estimada, surveyCompletedAtSource: 'estimada' });
    sinDatos.push(d.id);
  });

  const cuenta = (f) => cambios.filter((c) => c.surveyCompletedAtSource === f).length;
  console.log(`Exacta (monedas): ${cuenta('monedas')}. Estimada (visitas): ${cuenta('estimada')}. Sin forma de saber: ${sinDatos.length}.`);
  const fechas = cambios.map((c) => c.surveyCompletedAt).sort((a, b) => a - b);
  if (fechas.length) {
    console.log(`Rango: ${new Date(fechas[0]).toISOString()} → ${new Date(fechas[fechas.length - 1]).toISOString()}`);
  }
  if (sinDatos.length) console.log('Sin datos:', sinDatos.join(', '));

  if (!APLICAR) {
    console.log('\nSimulación: no se escribió nada. Corre con --aplicar para guardar.');
    return;
  }
  for (let i = 0; i < cambios.length; i += 400) {
    const lote = db.batch();
    cambios.slice(i, i + 400).forEach(({ ref, surveyCompletedAt, surveyCompletedAtSource }) => {
      lote.update(ref, { surveyCompletedAt, surveyCompletedAtSource });
    });
    await lote.commit();
  }
  console.log(`\nGuardado en ${cambios.length} usuarios.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
