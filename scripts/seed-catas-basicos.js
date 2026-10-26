/**
 * Catas: cuatro básicos blancos. Precios/ofertas, stock total 4 y tallas
 * S/M/L/XL confirmados por el dueño. Sin composición ni público inferidos.
 * Solo la foto de espalda está disponible para el polo.
 *
 * node scripts/seed-catas-basicos.js "<carpeta>"            (solo lectura)
 * node scripts/seed-catas-basicos.js "<carpeta>" --confirm  (carga real)
 * SHARP_PATH permite usar una instalación compatible con este equipo.
 * Publicación y archivado son atómicos; no vuelve a escribir ni reponer stock
 * en una ejecución posterior. Guarda un respaldo local antes de escribir.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..');
const FOLDER = process.argv.slice(2).find(a => !a.startsWith('--'));
const CONFIRM = process.argv.includes('--confirm');
const BRAND = 'XivhXo5IVUvksIehFt0z';
const PROJECT = 'sistema-gestion-3b225';
const BUCKET = `${PROJECT}.firebasestorage.app`;
const OLD = ['9kdQXxu5ZAp6EsyQKwNs', 'paBUtaDfdHcMWYPfGWYW'];
const SIZES = ['S', 'M', 'L', 'XL'];
const PRODUCTS = [
  { id: 'catas-polera-capucha-blanca', name: 'Polera con capucha blanca Catas', sku: 'CAT-POLERA-01', category: 'Poleras', price: 70, salePrice: 65,
    description: 'Polera blanca con capucha, cordones, bolsillo canguro y puños. Diseño liso, sin estampado.',
    photos: ['Sudadera blanca con capucha, vista frontal.png', 'Sudadera blanca con capucha, vista trasera.png'] },
  { id: 'catas-casaca-cierre-blanca', name: 'Casaca con cierre blanca Catas', sku: 'CAT-CIERRE-01', category: 'Casacas', price: 75, salePrice: 70,
    description: 'Casaca blanca con capucha, cordones, cierre frontal y bolsillos. Diseño liso, sin estampado.',
    photos: ['Sudadera blanca con cremallera, vista frontal.png', 'Sudadera blanca, vista trasera.png'] },
  { id: 'catas-polo-basico-blanco', name: 'Polo básico blanco Catas', sku: 'CAT-POLO-01', category: 'Polos', price: 39, salePrice: 35,
    description: 'Polo blanco de manga corta y cuello redondo. Diseño liso, sin estampado.',
    photos: ['Camiseta blanca básica, vista trasera.png'] },
  { id: 'catas-jogger-blanco', name: 'Jogger blanco Catas', sku: 'CAT-JOGGER-01', category: 'Joggers', price: 60, salePrice: 50,
    description: 'Jogger blanco con cintura elástica, cordón de ajuste y puños en los tobillos. Diseño liso, sin estampado.',
    photos: ['Pantalón jogger blanco, vista frontal.png', 'Jogger blanco, vista trasera.png'] },
];
const normalize = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
function searchTokens(...parts) {
  const tokens = new Set();
  const words = [...new Set(parts.map(normalize).join(' ').split(' ').filter(w => w.length >= 2))];
  for (const word of words) {
    for (let len = 2; len <= Math.min(word.length, 12); len++) tokens.add(word.slice(0, len));
    if (word.length > 12) tokens.add(word);
    if (tokens.size >= 60) break;
  }
  return [...tokens].slice(0, 60);
}
async function main() {
  if (!FOLDER || !fs.existsSync(FOLDER)) throw new Error('Indica la carpeta de imágenes.');
  const sharp = require(process.env.SHARP_PATH || 'sharp');
  const admin = require(require.resolve('firebase-admin', { paths: [path.join(ROOT, 'functions/node_modules')] }));
  const sa = JSON.parse(fs.readFileSync(path.join(ROOT, 'serviceAccountKey.json'), 'utf8'));
  assert.equal(sa.project_id, PROJECT, 'Proyecto inesperado');
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: PROJECT, storageBucket: BUCKET });
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const FV = admin.firestore.FieldValue;
  const batch = db.batch();
  const backup = [];
  const remember = doc => backup.push({ path: doc.ref.path, exists: doc.exists, data: doc.exists ? doc.data() : null });
  const brand = await db.collection('tienda_brands').doc(BRAND).get();
  assert.equal(brand.data()?.name, 'Catas');
  remember(brand);
  const all = await db.collection('productos_wala').where('brandId', '==', BRAND).get();
  const existing = PRODUCTS.map(p => all.docs.find(d => d.id === p.id));
  if (existing.every(Boolean)) {
    for (const d of existing) console.log('Ya existe, no se modifica:', d.id, d.data().name);
    for (const id of OLD) assert.equal(all.docs.find(d => d.id === id)?.data().deleted, true);
    console.log('Carga completada anteriormente; stock y ediciones conservados.');
    return;
  }
  assert.ok(existing.every(d => !d), 'Carga parcial: revisar antes de continuar.');
  for (const p of PRODUCTS) {
    assert.ok(p.price > p.salePrice && p.salePrice > 0);
    assert.ok(!all.docs.some(d => d.data().sku === p.sku), `SKU duplicado: ${p.sku}`);
    const doc = await db.collection('productos_wala').doc(p.id).get();
    assert.equal(doc.exists, false, `ID ya utilizado: ${p.id}`);
    remember(doc);
    for (const photo of p.photos) {
      const meta = await sharp(path.join(FOLDER, photo)).metadata();
      assert.ok(meta.width > 0 && meta.height > 0);
    }
  }
  const active = all.docs.filter(d => d.data().visible !== false && !d.data().deleted);
  assert.deepEqual(active.map(d => d.id).sort(), [...OLD].sort(), 'Cambió el catálogo: revisar productos actuales.');
  for (const id of OLD) remember(all.docs.find(d => d.id === id));
  const taxonomy = {};
  for (const collection of ['tienda_categories', 'tienda_collections', 'tags', 'productTypes']) {
    taxonomy[collection] = (await db.collection(collection).get()).docs;
  }
  function ensure(collection, name) {
    const found = taxonomy[collection].filter(d => !d.data().deleted && normalize(d.data().name) === normalize(name));
    assert.ok(found.length <= 1, `Taxonomía duplicada: ${name}`);
    if (found[0]) {
      const doc = found[0];
      console.log('Reutilizar:', collection, name, doc.id);
      if (collection !== 'productTypes') {
        const brands = doc.data().brandIds;
        if (Array.isArray(brands) && brands.length && !brands.includes(BRAND)) {
          remember(doc);
          batch.update(doc.ref, { brandIds: FV.arrayUnion(BRAND), updatedAt: FV.serverTimestamp() }, { lastUpdateTime: doc.updateTime });
        }
      }
      return doc.id;
    }
    const ref = db.collection(collection).doc();
    backup.push({ path: ref.path, exists: false, data: null });
    const data = { name, createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() };
    if (collection !== 'productTypes') data.brandIds = [BRAND];
    if (collection === 'tienda_categories' || collection === 'tienda_collections') {
      data.imageUrl = '';
      data.order = Math.max(0, ...taxonomy[collection].map(d => Number(d.data().order) || 0)) + 1;
    }
    batch.create(ref, data);
    console.log('Crear:', collection, name);
    return ref.id;
  }
  const categoryIds = Object.fromEntries(PRODUCTS.map(p => [p.category, ensure('tienda_categories', p.category)]));
  const collectionId = ensure('tienda_collections', 'Básicos Catas');
  const tags = [ensure('tags', 'Sin personalizar'), ensure('tags', 'Básicos')];
  const productType = ensure('productTypes', 'Prenda');
  console.table(PRODUCTS.map(p => ({ producto: p.name, base: p.price, oferta: p.salePrice, stock: 4, tallas: SIZES.join('/'), fotos: p.photos.length })));
  if (!CONFIRM) {
    console.log('Solo lectura. Se publicarían 4 productos, 4 accesos por categoría y se archivarían los 2 anteriores.');
    return;
  }
  const backupDir = path.join(ROOT, 'ops/backup/snapshots');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `catas-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ project: PROJECT, date: new Date().toISOString(), documents: backup }, null, 2));
  console.log('Respaldo:', backupPath);
  async function saveImage(buffer, destination) {
    const token = crypto.randomUUID();
    await bucket.file(destination).save(buffer, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: {
      contentType: 'image/webp', cacheControl: 'public,max-age=31536000', metadata: { firebaseStorageDownloadTokens: token },
    } });
    return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(destination)}?alt=media&token=${token}`;
  }
  const covers = {};
  for (const p of PRODUCTS) {
    const photos = [];
    const imagesVariantes = {};
    for (const filename of p.photos) {
      const source = fs.readFileSync(path.join(FOLDER, filename));
      const hash = crypto.createHash('sha256').update(source).digest('hex').slice(0, 12);
      // Ruta única por intento: una subida incompleta no bloquea reintentos.
      const base = `productos_v2/${p.id}/${hash}-${crypto.randomUUID()}`;
      const url = await saveImage(await sharp(source).resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 92 }).toBuffer(), `${base}.webp`);
      const copies = {};
      for (const width of [160, 400, 800]) {
        copies[width] = await saveImage(await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 92 }).toBuffer(), `${base}_${width}.webp`);
      }
      photos.push(url);
      imagesVariantes[url] = copies;
    }
    covers[p.category] = photos[0];
    const gallery = photos.slice(1);
    const data = {
      name: p.name, nameLower: normalize(p.name), searchTokens: searchTokens(p.name, BRAND, productType),
      sku: p.sku, description: `<p>${p.description}</p><p>Color blanco. Tallas S, M, L y XL.</p>`,
      brandId: BRAND, categories: [categoryIds[p.category]], collections: [collectionId], tags, characters: [],
      vendors: [], vendorId: 'casa', nicheId: 'regala-con-amor', productType, fulfillmentType: 'stock',
      price: p.price, salePrice: p.salePrice, inStock: 4,
      images: photos, imagesByColor: { Blanco: photos }, mainImage: '', mainSizes: [],
      variants: [{ id: 'blanco', name: 'Blanco', colorHex: '#F3F3F3', imageUrl: photos[0], images: gallery, galleryImages: gallery,
        imagesVariantes, sizes: SIZES, sizeLabel: 'Talla', showSizeConfig: true, thumbnailCrop: null, imagesCrops: {} }],
      defaultVariantId: 'blanco', hasVariants: true, variantDisplayBehavior: 'default_only', behaviorImpressionsThreshold: 3,
      visible: true, deleted: false, featured: false, featuredOrder: 0, isV2: true, isComboProduct: false,
      esPrendaBase: false, customizable: false, customizationViews: [], productCliparts: [],
      comboPreviewImage: '', thumbnailWithDesignUrl: '', publico: '', equipo: '', edadMinima: '',
      whatsappEnabled: true, whatsappNumber: '', whatsappMessage: '',
      createdAt: FV.serverTimestamp(), createdAtMs: Date.now(), updatedAt: FV.serverTimestamp(),
    };
    batch.create(db.collection('productos_wala').doc(p.id), data);
    console.log('Imágenes listas:', p.name);
  }
  batch.update(brand.ref, { categoryNav: PRODUCTS.map((p, order) => ({ categoryId: categoryIds[p.category], name: p.category, imageUrl: covers[p.category], order })), updatedAt: FV.serverTimestamp() }, { lastUpdateTime: brand.updateTime });
  for (const id of OLD) {
    const old = all.docs.find(d => d.id === id);
    batch.update(old.ref, { visible: false, deleted: true, deletedAt: new Date().toISOString(), searchTokens: [], updatedAt: FV.serverTimestamp() }, { lastUpdateTime: old.updateTime });
  }
  await batch.commit();
  const after = await db.collection('productos_wala').where('brandId', '==', BRAND).get();
  assert.deepEqual(after.docs.filter(d => d.data().visible !== false && !d.data().deleted).map(d => d.id).sort(), PRODUCTS.map(p => p.id).sort());
  for (const p of PRODUCTS) {
    const d = after.docs.find(d => d.id === p.id).data();
    assert.equal(d.price, p.price); assert.equal(d.salePrice, p.salePrice); assert.equal(d.inStock, 4);
    assert.deepEqual(d.variants[0].sizes, SIZES); assert.equal(d.characters.length, 0);
  }
  console.log('Verificado: 4 publicados, 2 archivados, precios/stock/tallas correctos.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
