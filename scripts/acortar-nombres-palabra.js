/**
 * Nombres cortos en el ranking de La Palabra del Día.
 * ────────────────────────────────────────────────────────────────────────────
 * Hasta el 2026-11-07 la colección pública `wordle` (partidas del día y
 * `<uid>_stats`) guardaba el nombre completo de la cuenta de Google ("Jorge
 * Ramírez Soto") o "Anónimo" si no había. Desde entonces guarda el nombre corto
 * de las Bolitas ("Jorge R."): el de la ficha y, si no tiene, el de la cuenta.
 *
 * Esto reescribe `displayName` en los documentos que ya estaban, con la misma
 * regla (src/utils/nombrePublico.mjs). Sin nombre en ningún lado, null (la
 * pantalla pone "Anónimo"). Solo toca ese campo.
 *
 * Uso (desde la raíz; usa firebase-admin de functions/):
 *   node scripts/acortar-nombres-palabra.js            → simula y muestra el resumen
 *   node scripts/acortar-nombres-palabra.js --aplicar  → escribe
 * Credenciales: serviceAccountKey.json en la raíz o GOOGLE_APPLICATION_CREDENTIALS.
 */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const llave = path.join(__dirname, '..', 'serviceAccountKey.json');
admin.initializeApp(fs.existsSync(llave)
  ? { credential: admin.credential.cert(require(llave)) }
  : { credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const APLICAR = process.argv.includes('--aplicar');
const trozos = (lista, n) => Array.from({ length: Math.ceil(lista.length / n) }, (_, k) => lista.slice(k * n, k * n + n));

(async () => {
  const { nombrePublico, acortarNombre } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'utils', 'nombrePublico.mjs')).href);

  const snap = await db.collection('wordle').get();
  const docs = snap.docs.filter((d) => d.data().userId);
  const uids = [...new Set(docs.map((d) => d.data().userId))];
  console.log(`Documentos en wordle: ${snap.size} (${docs.length} con userId), de ${uids.length} personas.`);

  // Nombre de cada persona: la ficha, luego la cuenta de Google.
  const nombres = new Map();
  for (const grupo of trozos(uids, 100)) {
    const perfiles = await db.getAll(...grupo.map((uid) => db.collection('portal_clientes_users').doc(uid)));
    perfiles.forEach((p, k) => { if (p.exists) nombres.set(grupo[k], nombrePublico(p.data())); });
    const { users } = await admin.auth().getUsers(grupo.filter((uid) => !nombres.get(uid)).map((uid) => ({ uid })));
    users.forEach((u) => nombres.set(u.uid, nombrePublico({ displayName: u.displayName })));
  }

  const cambios = [];
  docs.forEach((d) => {
    const f = d.data();
    // Sin ficha ni cuenta (cuenta borrada): al menos, lo que ya tenía en corto.
    const nuevo = nombres.get(f.userId) || acortarNombre(f.displayName) || null;
    if ((f.displayName ?? null) !== nuevo) cambios.push({ ref: d.ref, antes: f.displayName ?? null, nuevo });
  });

  console.log(`Por cambiar: ${cambios.length}.`);
  const ejemplos = new Map();
  cambios.forEach((c) => { if (!ejemplos.has(c.nuevo)) ejemplos.set(c.nuevo, c.antes); });
  [...ejemplos].slice(0, 15).forEach(([nuevo, antes]) => console.log(`  ${JSON.stringify(antes)} → ${JSON.stringify(nuevo)}`));

  if (!APLICAR) {
    console.log('Simulación: nada escrito. Corre con --aplicar para escribir.');
    return;
  }
  for (const grupo of trozos(cambios, 400)) {
    const batch = db.batch();
    grupo.forEach((c) => batch.update(c.ref, { displayName: c.nuevo }));
    await batch.commit();
  }
  console.log(`Listo: ${cambios.length} documentos actualizados.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
