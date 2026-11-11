/**
 * Promo "Tu primera compra puede salir gratis" · config inicial — 2026-11-11
 * ────────────────────────────────────────────────────────────────────────────
 * Deja en loyaltyConfig/primeraCompra lo que la promo necesita antes de
 * prenderse, SIN prenderla (activa queda como esté; nueva = apagada):
 *  - los costos por producto de Lumi (scripts/data/lumi-costos.json, del
 *    Excel de márgenes): con ellos el filtro de S/ 15 usa el margen real;
 *  - Lumi y Daida con 100 % pagable con saldo (desde el 2026-11-11; antes 10 %)
 *    y un margen conservador para los productos sin costo (las demás marcas
 *    usan 66,67 % y 100 % por defecto).
 * Se puede volver a correr: solo pisa costos y las filas de esas dos marcas.
 *
 * USO:
 *   node scripts/primera-compra-config.js            (prueba, no escribe)
 *   node scripts/primera-compra-config.js --confirm  (escribe de verdad)
 */
'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const CONFIRMED = process.argv.includes('--confirm');
const COSTOS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'lumi-costos.json'), 'utf8'));
const admin = require(require.resolve('firebase-admin', { paths: [path.join(ROOT, 'functions', 'node_modules')] }));
const sa = JSON.parse(fs.readFileSync(path.join(ROOT, 'serviceAccountKey.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
const db = admin.firestore();

const LUMI = 'pMujqcyIIDUF2EdSSX5V';
// Margen y % pagable con saldo (2026-11-11: el saldo paga el 100 % también en Lumi y Daida).
const AJUSTES = { lumi: { margenPct: 25, saldoPct: 100 }, daida: { margenPct: 20, saldoPct: 100 } };

async function main() {
  console.log(CONFIRMED ? '→ ESCRIBIENDO en Firebase real' : '→ PRUEBA (no escribe nada; --confirm para aplicar)');
  const marcas = await db.collection('tienda_brands').get();
  const daida = marcas.docs.filter((d) => /daida/i.test(String(d.get('name') || d.get('nombre') || '')));
  if (!marcas.docs.some((d) => d.id === LUMI)) throw new Error('No encuentro la marca Lumi');
  if (daida.length !== 1) throw new Error(`Esperaba una marca Daida, hay ${daida.length}`);
  console.log(`Lumi: ${LUMI} · Daida: ${daida[0].id} (${daida[0].get('name') || daida[0].get('nombre')})`);

  const costos = {};
  for (const p of COSTOS.productos) {
    const snap = await db.collection('productos_wala').doc(p.id).get();
    if (!snap.exists) throw new Error(`No existe ${p.id}`);
    if (snap.get('brandId') !== LUMI) throw new Error(`${p.id} no es de Lumi`);
    costos[p.id] = p.costo;
  }
  console.log(`${Object.keys(costos).length} costos de Lumi listos.`);

  const ref = db.collection('loyaltyConfig').doc('primeraCompra');
  const actual = await ref.get();
  const marcasActuales = (actual.exists && actual.get('marcas')) || {};
  const nuevas = { ...marcasActuales, [LUMI]: AJUSTES.lumi, [daida[0].id]: AJUSTES.daida };
  console.log('Promo:', actual.exists ? (actual.get('activa') ? 'PRENDIDA' : 'apagada') : 'nueva (queda apagada)');
  if (!CONFIRMED) return;
  await ref.set({
    ...(actual.exists ? {} : { activa: false }),
    costos,
    marcas: nuevas,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('Listo.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
