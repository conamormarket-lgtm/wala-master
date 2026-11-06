/**
 * Lumi · Precios del Excel de márgenes (LUMI_Base_Productos_margenes.xlsx) — 2026-11-06
 * ────────────────────────────────────────────────────────────────────────────
 * Lee scripts/data/lumi-precios-margenes.json (columna "PRECIO LIVE" del Excel)
 * y deja en productos_wala el precio de cada producto de Lumi. A los que traen
 * `descripcion` (TXA Capsule Cream, TXA 15 Serum y Pore + Dark Spot Sunscreen,
 * que antes tenían un texto provisional) se les cambia también la descripción.
 * No toca fotos, nombres, stock, categorías ni colecciones.
 *
 * USO:
 *   node scripts/lumi-precios-margenes.js            (prueba, no escribe)
 *   node scripts/lumi-precios-margenes.js --confirm  (escribe de verdad)
 */
'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const CONFIRMED = process.argv.includes('--confirm');
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'lumi-precios-margenes.json'), 'utf8'));
const admin = require(require.resolve('firebase-admin', { paths: [path.join(ROOT, 'functions', 'node_modules')] }));
const sa = JSON.parse(fs.readFileSync(path.join(ROOT, 'serviceAccountKey.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
const db = admin.firestore();
const LUMI = 'pMujqcyIIDUF2EdSSX5V';

async function main() {
  console.log(CONFIRMED ? '→ ESCRIBIENDO en Firebase real' : '→ PRUEBA (no escribe nada; --confirm para aplicar)');
  let n = 0;
  for (const r of DATA.productos) {
    const ref = db.collection('productos_wala').doc(r.id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`No existe ${r.id}`);
    const p = snap.data();
    if (p.brandId !== LUMI) throw new Error(`${r.id} no es de Lumi`);
    const cambios = {};
    const nota = [];
    if (p.price !== r.precio) { cambios.price = r.precio; nota.push(`S/ ${p.price}→${r.precio}`); }
    // Una oferta igual o mayor al precio nuevo dejaría de ser oferta: se quita.
    if (cambios.price && Number(p.salePrice) > 0 && Number(p.salePrice) >= r.precio) { cambios.salePrice = 0; nota.push('sin oferta'); }
    if (r.descripcion && p.description !== r.descripcion) { cambios.description = r.descripcion; nota.push('descripción del Excel'); }
    if (!nota.length) continue;
    n++;
    console.log(`  [${r.codigo}] ${p.name}: ${nota.join(' · ')}`);
    if (CONFIRMED) await ref.update({ ...cambios, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  }
  console.log(`\n${n} productos ${CONFIRMED ? 'actualizados' : 'por actualizar'}.`);
}

main().then(() => process.exit(0)).catch((err) => { console.error('❌', err.message || err); process.exit(1); });
