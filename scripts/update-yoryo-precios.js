/**
 * Yoryo · nueva lista de precios, sin ofertas
 * ────────────────────────────────────────────────────────────────────────────
 * El dueño fijó precios redondos por familia y quitó las ofertas: todos los
 * productos pasan a `salePrice: null`, así que la tarjeta deja de mostrar el
 * precio tachado y el badge OFERTA.
 *
 *   Lentes (los 3 de ver + el de sol) ....... S/ 120
 *   Relojes de vestir (Magnate, Monarca,
 *     Eclipse) .............................. S/ 120
 *   Relojes deportivos ...................... S/ 80 a 90
 *       · Titán      S/ 90 — brazalete de acero macizo, la gama alta de los dos
 *       · Expedición S/ 80 — correa de silicona
 *   Billetera Cónsul ........................ S/  90
 *
 * El Set Alianza (dos relojes en un estuche) NO se toca aquí: "relojes 120"
 * no puede aplicarse tal cual a un producto que lleva dos, y el dueño no dio
 * su precio. Queda pendiente de confirmar.
 *
 * USO:
 *   node scripts/update-yoryo-precios.js            (dry-run)
 *   node scripts/update-yoryo-precios.js --confirm   (escribe)
 */
'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const CONFIRMED = process.argv.includes('--confirm');

const admin = require(require.resolve('firebase-admin', { paths: [fnModules] }));
const sa = JSON.parse(fs.readFileSync(path.join(ROOT, 'serviceAccountKey.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
const db = admin.firestore();

const COLLECTION = 'productos_wala';

const PRECIOS = [
  { id: 'R78pH03QLmHwpSAuGI7o', nombre: 'Lentes Yoryo Diamante',        price: 120 },
  { id: 'OvGYD9qhSz7kUxdCBjEn', nombre: 'Lentes Yoryo Versalles',       price: 120 },
  { id: 'L2lHIqgLxxqIgp6KONaI', nombre: 'Lentes Yoryo Imperial',        price: 120 },
  { id: 'JbO3IFaCRX57CwGtSIj5', nombre: 'Lentes de Sol Yoryo Obsidiana', price: 120 },

  { id: 'foF1l7x33v3zFmRs2CVG', nombre: 'Reloj Yoryo Magnate',          price: 120 },
  { id: 'BrSFBNeep6FXODg4Pqyp', nombre: 'Reloj Yoryo Monarca',          price: 120 },
  { id: 'z4CmzlhW29u3eOdIlNfw', nombre: 'Reloj Yoryo Eclipse',          price: 120 },

  { id: 'AuBNmqrZQkgLeXk2MBnp', nombre: 'Reloj Yoryo Titán',            price: 90 },
  { id: 'qVKdfMI5ZMXaBGwkNmoF', nombre: 'Reloj Yoryo Expedición',       price: 80 },

  { id: 'NEtavILSA0EoxJgGD7ou', nombre: 'Billetera Yoryo Cónsul',       price: 90 },
];

(async () => {
  console.log(CONFIRMED ? '🚀 ACTUALIZANDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para escribir\n');
  console.log('producto                          antes            después');
  console.log('─'.repeat(64));

  let cambios = 0;
  for (const p of PRECIOS) {
    const ref = db.collection(COLLECTION).doc(p.id);
    const snap = await ref.get();
    if (!snap.exists) { console.error(`❌ no existe ${p.id} (${p.nombre})`); continue; }
    const x = snap.data();

    const antes = `S/${String(x.price).padStart(3)}${x.salePrice ? ` → S/${x.salePrice}` : ''}`;
    const despues = `S/${String(p.price).padStart(3)} (sin oferta)`;
    const igual = x.price === p.price && (x.salePrice === null || x.salePrice === undefined);

    console.log(`${p.nombre.padEnd(33)} ${antes.padEnd(16)} ${igual ? '— ya estaba' : despues}`);
    if (igual) continue;
    cambios++;

    if (CONFIRMED) {
      await ref.update({
        price: p.price,
        salePrice: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  if (CONFIRMED && cambios) {
    // Releer para confirmar que quedó como se pidió.
    console.log('\n── verificación ──');
    let mal = 0;
    for (const p of PRECIOS) {
      const x = (await db.collection(COLLECTION).doc(p.id).get()).data();
      const ok = x.price === p.price && !x.salePrice;
      if (!ok) { mal++; console.log(`  ❌ ${p.nombre}: price=${x.price} salePrice=${x.salePrice}`); }
    }
    console.log(mal === 0 ? '  ✅ los 10 quedaron con su precio nuevo y sin oferta' : `  ❌ ${mal} con problemas`);
  }

  console.log(`\n${CONFIRMED ? 'Cambiados' : 'Se cambiarían'}: ${cambios} producto(s).`);
  console.log('Pendiente: el Set Alianza (dos relojes) sigue en S/259 → S/219.');
  process.exit(0);
})().catch((e) => { console.error('\n❌ Falló:', e.message); process.exit(1); });
