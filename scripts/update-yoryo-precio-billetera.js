/**
 * Yoryo · la billetera sube a S/120 y los combos se recalculan
 * ────────────────────────────────────────────────────────────────────────────
 * La Billetera Cónsul queda al mismo precio que los relojes de vestir y los
 * lentes (S/120), no en los S/90 de la tanda anterior.
 *
 * El combo se rehace con la MISMA regla del dueño (−20 por producto, −10 la
 * billetera):
 *       reloj     120 − 20 = 100
 *     + esclava    50 − 20 =  30
 *     + billetera 120 − 10 = 110
 *                           ─────
 *                     total   240   (sueltos suman 290: se ahorra S/50, igual
 *                                    que antes)
 *
 * También reescribe la frase del ahorro en la descripción de cada combo, que
 * si no se queda citando los montos viejos (S/260 y S/210).
 *
 * USO:
 *   node scripts/update-yoryo-precio-billetera.js            (dry-run)
 *   node scripts/update-yoryo-precio-billetera.js --confirm   (escribe)
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
const ID_BILLETERA = 'NEtavILSA0EoxJgGD7ou';

const PRECIO_BILLETERA = 120;
const PRECIO_COMBO = 240;
const SUELTOS = 290;   // 120 reloj + 50 esclava + 120 billetera

(async () => {
  console.log(CONFIRMED ? '🚀 ACTUALIZANDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para escribir\n');

  // ── Billetera ───────────────────────────────────────────────────────────
  const refBil = db.collection(COLLECTION).doc(ID_BILLETERA);
  const bil = (await refBil.get()).data();
  console.log(`▶ ${bil.name}: S/${bil.price} ⇒ S/${PRECIO_BILLETERA} (sin oferta)`);
  if (CONFIRMED) {
    await refBil.update({
      price: PRECIO_BILLETERA,
      salePrice: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('   ✅ actualizada');
  }

  // ── Combos ──────────────────────────────────────────────────────────────
  const combos = await db.collection(COLLECTION)
    .where('brandId', '==', BRAND_ID)
    .where('isComboProduct', '==', true)
    .get();

  console.log(`\n▶ Combos encontrados: ${combos.size}`);

  for (const doc of combos.docs) {
    const x = doc.data();
    // La frase del ahorro se reescribe entera para no dejar montos viejos.
    const nuevaFrase = `<p>Comprados por separado suman S/${SUELTOS}. En el combo se van en S/${PRECIO_COMBO}.</p>`;
    const descripcion = String(x.description || '')
      .replace(/<p>Comprados por separado[^<]*<\/p>/, nuevaFrase);

    const citaVieja = /S\/\s*(260|210)\b/.test(descripcion);
    console.log(`   ${x.name}`);
    console.log(`      S/${x.price} ⇒ S/${PRECIO_COMBO}${citaVieja ? '   ⚠ la descripción aún cita montos viejos' : ''}`);

    if (!CONFIRMED) continue;
    await doc.ref.update({
      price: PRECIO_COMBO,
      salePrice: null,
      description: descripcion,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('      ✅ actualizado');
  }

  // ── Verificación ────────────────────────────────────────────────────────
  if (CONFIRMED) {
    console.log('\n── verificación ──');
    const b = (await refBil.get()).data();
    let mal = (b.price === PRECIO_BILLETERA && !b.salePrice) ? 0 : 1;
    if (mal) console.log(`  ❌ billetera: price=${b.price} salePrice=${b.salePrice}`);

    const after = await db.collection(COLLECTION)
      .where('brandId', '==', BRAND_ID).where('isComboProduct', '==', true).get();
    after.forEach((d) => {
      const y = d.data();
      const ok = y.price === PRECIO_COMBO && !y.salePrice && !/S\/\s*(260|210)\b/.test(y.description || '');
      if (!ok) { mal++; console.log(`  ❌ ${y.name}: price=${y.price} salePrice=${y.salePrice}`); }
    });
    console.log(mal === 0
      ? `  ✅ billetera a S/${PRECIO_BILLETERA} y los ${after.size} combos a S/${PRECIO_COMBO}, sin ofertas ni montos viejos`
      : `  ❌ ${mal} con problemas`);
  }

  console.log(CONFIRMED ? '\n🎉 Listo.' : '\n🧪 Dry-run terminado, nada se escribió.');
  process.exit(0);
})().catch((e) => { console.error('\n❌ Falló:', e.message); process.exit(1); });
