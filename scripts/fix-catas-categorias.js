/**
 * Vuelve la navegación de Catas a /admin/categorias: nombre, imagen y orden
 * salen de tienda_categories; los productos determinan cuáles tienen contenido.
 * No cambia productos ni las categorías compartidas que ya tienen imagen.
 * node scripts/fix-catas-categorias.js [--confirm]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..');
const CONFIRM = process.argv.includes('--confirm');
const BRAND = 'XivhXo5IVUvksIehFt0z';
async function main() {
  const admin = require(require.resolve('firebase-admin', { paths: [path.join(ROOT, 'functions/node_modules')] }));
  const sa = JSON.parse(fs.readFileSync(path.join(ROOT, 'serviceAccountKey.json'), 'utf8'));
  assert.equal(sa.project_id, 'sistema-gestion-3b225');
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
  const db = admin.firestore();
  const brand = await db.collection('tienda_brands').doc(BRAND).get();
  assert.equal(brand.data()?.name, 'Catas');
  const products = await db.collection('productos_wala').where('brandId', '==', BRAND).get();
  const active = products.docs.filter(d => d.data().visible !== false && !d.data().deleted);
  const ids = [...new Set(active.flatMap(d => d.data().categories || []))];
  assert.equal(ids.length, 4);
  const categories = await db.getAll(...ids.map(id => db.collection('tienda_categories').doc(id)));
  const nav = brand.data().categoryNav || [];
  assert.ok(nav.every(c => ids.includes(c.categoryId)), 'La lista manual cambió; revisar antes de eliminarla.');
  const poleras = categories.find(d => d.data()?.name === 'Poleras');
  assert.ok(poleras?.exists && poleras.data().brandIds.includes(BRAND));
  const photo = nav.find(c => c.categoryId === poleras.id)?.imageUrl || active.find(d => d.data().categories.includes(poleras.id))?.data().variants?.find(v => v.name === 'Blanco')?.imageUrl;
  const needsPhoto = !poleras.data().imageUrl && Boolean(photo);
  const sorted = [...categories].sort((a, b) => (Number(a.data().order) || 0) - (Number(b.data().order) || 0) || a.data().name.localeCompare(b.data().name));
  console.log('Categorías del administrador:', sorted.map(d => d.data().name).join(', '));
  console.log('Retirar copia manual:', nav.length > 0, 'Completar imagen de Poleras en el admin:', needsPhoto);
  if (!CONFIRM || (!nav.length && !needsPhoto)) { console.log(CONFIRM ? 'Ya corregido.' : 'Solo lectura.'); return; }
  const backupDir = path.join(ROOT, 'ops/backup/snapshots');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `catas-categorias-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ project: sa.project_id, date: new Date().toISOString(), documents: [brand, ...categories].map(d => ({ path: d.ref.path, data: d.data() })) }, null, 2));
  const batch = db.batch();
  if (nav.length) batch.update(brand.ref, { categoryNav: [], updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { lastUpdateTime: brand.updateTime });
  if (needsPhoto) batch.update(poleras.ref, { imageUrl: photo, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { lastUpdateTime: poleras.updateTime });
  await batch.commit();
  assert.deepEqual((await brand.ref.get()).data().categoryNav, []);
  for (const doc of products.docs) assert.deepEqual((await doc.ref.get()).data(), doc.data(), `Cambió el producto ${doc.id}`);
  console.log('Corregido: categorías automáticas desde el administrador; productos intactos. Respaldo:', backupPath);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
