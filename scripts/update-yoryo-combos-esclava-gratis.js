/**
 * Yoryo · los combos anuncian la esclava como regalo
 * ────────────────────────────────────────────────────────────────────────────
 * El dueño quiere que el gancho del combo sea "la esclava va gratis". No hace
 * falta tocar el precio: con la lista actual la cuenta cierra sola.
 *
 *       reloj      S/120
 *     + billetera  S/120
 *                  ─────
 *       combo      S/240   ← lo que ya cuesta
 *     + esclava    S/ 50   de regalo
 *
 * Antes la descripción lo contaba como un descuento repartido entre las tres
 * piezas ("comprados por separado suman S/290..."), que decía lo mismo pero se
 * entendía peor. Solo se reescribe el texto: precio, piezas y stock no cambian.
 *
 * Ojo: esto se lee en la FICHA del producto. La tarjeta del catálogo sigue
 * mostrando el riel "Incluye" con las tres piezas, sin la palabra "gratis".
 *
 * USO:
 *   node scripts/update-yoryo-combos-esclava-gratis.js            (dry-run)
 *   node scripts/update-yoryo-combos-esclava-gratis.js --confirm   (escribe)
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
const BRAND_ID = 'rEPEpl4Hvzi6ogOBHn7x';

// Resumen de piezas por SKU, para no perder la primera frase al reescribir.
const RESUMEN = {
  'YRY-COMBO-ONIX': 'reloj de acero con esfera negra, esclava de cuero y billetera negra',
  'YRY-COMBO-ORO': 'reloj bicolor acero y oro, esclava de cuero y billetera marrón',
  'YRY-COMBO-NOCHE': 'reloj cuadrado de esfera azul con caja oro rosa, esclava de cuero y billetera azul',
};

function nuevaDescripcion(sku) {
  const resumen = RESUMEN[sku] || 'reloj, esclava y billetera';
  return (
    `<p>Tres piezas que se llevan juntas: ${resumen}.</p>` +
    `<p><strong>La esclava va gratis.</strong> Pagas el reloj y la billetera —S/240 las dos— y la esclava de cuero trenzado con placa de acero, que cuesta S/50, entra de regalo.</p>`
  );
}

(async () => {
  console.log(CONFIRMED ? '🚀 ACTUALIZANDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para escribir\n');

  const combos = await db.collection(COLLECTION)
    .where('brandId', '==', BRAND_ID)
    .where('isComboProduct', '==', true)
    .get();

  console.log(`Combos: ${combos.size}\n`);

  for (const doc of combos.docs) {
    const x = doc.data();
    const desc = nuevaDescripcion(x.sku);

    console.log(`▶ ${x.name}  (S/${x.price}, no cambia)`);
    console.log(`   antes:   ${String(x.description || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 110)}…`);
    console.log(`   después: ${desc.replace(/<[^>]+>/g, ' ').trim().slice(0, 110)}…`);

    if (!CONFIRMED) continue;
    await doc.ref.update({
      description: desc,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('   ✅ actualizado');
  }

  if (CONFIRMED) {
    console.log('\n── verificación ──');
    const after = await db.collection(COLLECTION)
      .where('brandId', '==', BRAND_ID).where('isComboProduct', '==', true).get();
    let mal = 0;
    after.forEach((d) => {
      const y = d.data();
      const dice = /esclava va gratis/i.test(y.description || '');
      const sinViejos = !/S\/\s*(260|210|290)\b/.test(y.description || '');
      const precioOk = y.price === 240 && !y.salePrice;
      if (!(dice && sinViejos && precioOk)) {
        mal++;
        console.log(`  ❌ ${y.name}: gratis=${dice} sinMontosViejos=${sinViejos} precio=${y.price}`);
      }
    });
    console.log(mal === 0
      ? `  ✅ los ${after.size} combos anuncian la esclava gratis, siguen a S/240 y sin montos viejos`
      : `  ❌ ${mal} con problemas`);
  }

  console.log(CONFIRMED ? '\n🎉 Listo.' : '\n🧪 Dry-run terminado, nada se escribió.');
  process.exit(0);
})().catch((e) => { console.error('\n❌ Falló:', e.message); process.exit(1); });
