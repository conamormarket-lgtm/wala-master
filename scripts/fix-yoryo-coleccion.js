/**
 * Corrección: mover los 9 productos Yoryo de `products` a `productos_wala`
 * ────────────────────────────────────────────────────────────────────────────
 * seed-yoryo-relojes-lentes.js los escribió en `products`, que es la colección
 * LEGACY. La tienda (y el formulario V2 del admin) leen y escriben en
 * `productos_wala` — así lo fija COLLECTION en src/services/products.js:7.
 *
 * El documento en sí está bien armado (mismo payload que produce
 * AdminProductoFormV2) y las imágenes ya están subidas a Storage en WebP con
 * sus copias de 160/400/800: se reutilizan las MISMAS URLs, no se vuelve a
 * subir nada.
 *
 * La marca ya tenía 7 productos en productos_wala, pero los 7 están con
 * deleted:true y visible:false (borrados lógicos), así que no hay duplicados.
 *
 * USO:
 *   node scripts/fix-yoryo-coleccion.js            (dry-run)
 *   node scripts/fix-yoryo-coleccion.js --confirm   (mueve de verdad)
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

const BRAND_ID = 'rEPEpl4Hvzi6ogOBHn7x';
const ORIGEN = 'products';
const DESTINO = 'productos_wala';

(async () => {
  console.log(CONFIRMED ? '🚀 MOVIENDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para mover\n');

  const origen = await db.collection(ORIGEN).where('brandId', '==', BRAND_ID).get();
  console.log(`En ${ORIGEN}: ${origen.size} producto(s) de Yoryo`);

  const destino = await db.collection(DESTINO).where('brandId', '==', BRAND_ID).get();
  const activos = destino.docs.filter((d) => d.data().deleted !== true);
  console.log(`En ${DESTINO}: ${destino.size} de Yoryo (${activos.length} activos, ${destino.size - activos.length} borrados lógicos)`);

  if (activos.length > 0) {
    console.error('\n❌ Ya hay productos Yoryo ACTIVOS en el destino. Aborto para no duplicar.');
    activos.forEach((d) => console.error(`   - ${d.data().name} (${d.id})`));
    process.exit(1);
  }

  if (origen.empty) {
    console.log('\nNada que mover.');
    process.exit(0);
  }

  console.log('\n── A mover ──');
  origen.forEach((d) => {
    const x = d.data();
    const fotos = (x.variants || []).reduce((n, v) => n + (v.imageUrl ? 1 : 0) + (v.images || []).length, 0);
    console.log(`  ${x.name.padEnd(34)} S/${String(x.price).padStart(3)} → S/${String(x.salePrice).padStart(3)} | ${(x.variants || []).length} var | ${fotos} fotos`);
  });

  if (!CONFIRMED) {
    console.log(`\n🧪 Dry-run. Se crearían ${origen.size} docs en ${DESTINO} y se borrarían los ${origen.size} de ${ORIGEN}.`);
    process.exit(0);
  }

  console.log(`\n── Creando en ${DESTINO} ──`);
  const creados = [];
  for (const d of origen.docs) {
    const data = { ...d.data() };
    // createdAt/createdAtMs se rehacen: el orden "newest" del catálogo va por
    // createdAt y estos productos se publican ahora.
    data.createdAt = admin.firestore.FieldValue.serverTimestamp();
    data.createdAtMs = Date.now();
    data.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    const ref = await db.collection(DESTINO).add(data);
    creados.push(ref.id);
    console.log(`  ✅ ${data.name} → ${ref.id}`);
  }

  console.log(`\n── Borrando los originales de ${ORIGEN} ──`);
  for (const d of origen.docs) {
    await db.collection(ORIGEN).doc(d.id).delete();
    console.log(`  🗑  ${d.data().name} (${d.id})`);
  }

  console.log(`\n🎉 Listo: ${creados.length} productos ahora viven en ${DESTINO}.`);
  process.exit(0);
})().catch((e) => {
  console.error('\n❌ Falló:', e.message);
  process.exit(1);
});
