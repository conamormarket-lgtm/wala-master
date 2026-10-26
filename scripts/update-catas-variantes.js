/**
 * Disponibilidad de adultos, según las láminas del proveedor del 26/10/2026.
 * Solo actualiza los cuatro productos existentes; conserva precios y stock.
 * XXL depende del color. No registra prendas infantiles ni recolorea fotos.
 *
 * node scripts/update-catas-variantes.js "<carpeta de láminas>" [--confirm]
 * SHARP_PATH puede indicar una instalación de sharp compatible con el equipo.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..');
const FOLDER = process.argv.slice(2).find(a => !a.startsWith('--'));
const CONFIRM = process.argv.includes('--confirm');
const PROJECT = 'sistema-gestion-3b225';
const BUCKET = `${PROJECT}.firebasestorage.app`;
const BRAND = 'XivhXo5IVUvksIehFt0z';
const SIZES = ['S', 'M', 'L', 'XL'];
const COLORS = { Negro: '#101010', Blanco: '#F3F3F3', 'Melange 3%': '#C8CACB', Acero: '#0F1E37', Guinda: '#651322', Rosado: '#FDA9C9', Celeste: '#A9D5F6', Perla: '#EAE6E1', Anaranjado: '#F76C0C' };
const sheet = suffix => `WhatsApp Image 2026-10-26 at ${suffix}.jpeg`;
const PRODUCTS = [
  { id: 'catas-polera-capucha-blanca', name: 'Polera con capucha Catas',
    colors: ['Blanco', 'Negro', 'Melange 3%', 'Acero', 'Guinda', 'Rosado', 'Celeste'], xxl: ['Blanco', 'Negro'],
    regular: sheet('5.16.10 PM (1)'), extra: sheet('5.16.10 PM (3)'),
    description: 'Polera con capucha, cordones, bolsillo canguro y puños. Diseño liso, sin estampado.' },
  { id: 'catas-casaca-cierre-blanca', name: 'Casaca con cierre Catas',
    colors: ['Blanco', 'Guinda', 'Rosado', 'Celeste', 'Perla', 'Anaranjado', 'Acero', 'Negro'], xxl: ['Blanco', 'Negro'],
    regular: sheet('5.16.09 PM'), extra: sheet('5.16.10 PM'),
    description: 'Casaca con capucha, cordones, cierre frontal y bolsillos. Diseño liso, sin estampado.' },
  { id: 'catas-polo-basico-blanco', name: 'Polo básico Catas',
    colors: ['Blanco', 'Negro', 'Acero', 'Guinda', 'Celeste'], xxl: [],
    regular: sheet('5.16.10 PM (4)'),
    description: 'Polo de manga corta y cuello redondo. Diseño liso, sin estampado.' },
  { id: 'catas-jogger-blanco', name: 'Jogger Catas',
    colors: ['Negro', 'Perla', 'Acero', 'Celeste', 'Guinda', 'Rosado'], xxl: ['Negro'],
    regular: sheet('5.16.10 PM (6)'), extra: sheet('5.16.11 PM'),
    description: 'Jogger con cintura elástica y cordón de ajuste. Diseño liso, sin estampado.' },
];
const normalize = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const slug = s => normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function searchTokens(...parts) {
  const tokens = new Set();
  for (const w of new Set(parts.map(normalize).join(' ').split(' ').filter(w => w.length >= 2))) {
    for (let len = 2; len <= Math.min(w.length, 12); len++) tokens.add(w.slice(0, len));
    if (w.length > 12) tokens.add(w);
    if (tokens.size >= 60) break;
  }
  return [...tokens].slice(0, 60);
}
const sizesFor = (product, color) => [...SIZES, ...(product.xxl.includes(color) ? ['XXL'] : [])];
const availability = variants => variants.map(v => ({ name: v.name, sizes: v.sizes }));
async function main() {
  assert.ok(FOLDER && fs.existsSync(FOLDER), 'Indica la carpeta de láminas.');
  const sharp = require(process.env.SHARP_PATH || 'sharp');
  const admin = require(require.resolve('firebase-admin', { paths: [path.join(ROOT, 'functions/node_modules')] }));
  const sa = JSON.parse(fs.readFileSync(path.join(ROOT, 'serviceAccountKey.json'), 'utf8'));
  assert.equal(sa.project_id, PROJECT);
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: PROJECT, storageBucket: BUCKET });
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const FV = admin.firestore.FieldValue;
  const docs = await db.getAll(...PRODUCTS.map(p => db.collection('productos_wala').doc(p.id)));
  const brand = await db.collection('tienda_brands').doc(BRAND).get();
  assert.equal(brand.data()?.name, 'Catas');
  const pending = [];
  for (const [i, p] of PRODUCTS.entries()) {
    const doc = docs[i];
    assert.ok(doc.exists, `Falta ${p.id}`);
    const data = doc.data();
    assert.equal(data.brandId, BRAND); assert.equal(data.visible, true); assert.notEqual(data.deleted, true);
    const target = p.colors.map(name => ({ name, sizes: sizesFor(p, name) }));
    console.log(p.name, JSON.stringify(target));
    if (data.name === p.name && JSON.stringify(availability(data.variants)) === JSON.stringify(target)) {
      console.log('  Ya actualizado; no se modifica.'); continue;
    }
    for (const file of [p.regular, p.extra].filter(Boolean)) {
      const meta = await sharp(path.join(FOLDER, file)).metadata();
      assert.ok(meta.width > 0 && meta.height > 0);
    }
    pending.push({ p, doc, data });
  }
  if (!pending.length || !CONFIRM) {
    console.log(`${pending.length} productos pendientes. ${CONFIRM ? '' : 'Solo lectura; usa --confirm para aplicar.'}`); return;
  }
  const backupDir = path.join(ROOT, 'ops/backup/snapshots');
  fs.mkdirSync(backupDir, { recursive: true });
  const backup = path.join(backupDir, `catas-variantes-${Date.now()}.json`);
  fs.writeFileSync(backup, JSON.stringify({ project: PROJECT, date: new Date().toISOString(), documents: [...docs, brand].map(doc => ({ path: doc.ref.path, data: doc.data() })) }, null, 2));
  console.log('Respaldo:', backup);
  const batch = db.batch();
  for (const { p, doc, data } of pending) {
    const uploads = [];
    for (const file of [p.regular, p.extra].filter(Boolean)) {
      const source = fs.readFileSync(path.join(FOLDER, file));
      const destination = `productos_v2/${p.id}/disponibilidad-${crypto.randomUUID()}`;
      const save = async (buffer, suffix) => {
        const token = crypto.randomUUID();
        const target = `${destination}${suffix}.webp`;
        await bucket.file(target).save(buffer, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: {
          contentType: 'image/webp', cacheControl: 'public,max-age=31536000', metadata: { firebaseStorageDownloadTokens: token },
        } });
        return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(target)}?alt=media&token=${token}`;
      };
      const url = await save(await sharp(source).webp({ quality: 92 }).toBuffer(), '');
      const copies = {};
      for (const width of [160, 400, 800]) copies[width] = await save(await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 92 }).toBuffer(), `_${width}`);
      uploads.push({ url, copies });
    }
    const variants = p.colors.map(color => {
      const original = data.variants.find(v => v.name === color);
      // Solo blanco cuenta con una foto individual verificada. Los otros
      // colores muestran la lámina del proveedor, sin usar la foto blanca.
      const keep = color === 'Blanco' && original?.imageUrl;
      const sheets = p.xxl.includes(color) ? uploads : uploads.slice(0, 1);
      const imageUrl = keep ? original.imageUrl : uploads[0].url;
      const images = [...new Set([...(keep ? original.images || [] : []), ...sheets.map(s => s.url)])].filter(u => u !== imageUrl);
      const imagesVariantes = { ...(keep ? original.imagesVariantes : {}), ...Object.fromEntries(sheets.map(s => [s.url, s.copies])) };
      return { ...(keep ? original : {}), id: original?.id || slug(color), name: color, colorHex: COLORS[color],
        imageUrl, images, galleryImages: images, imagesVariantes, sizes: sizesFor(p, color), sizeLabel: 'Talla', showSizeConfig: true,
        thumbnailCrop: keep ? original.thumbnailCrop || null : null, imagesCrops: keep ? original.imagesCrops || {} : {} };
    });
    const defaultVariant = variants.find(v => v.id === data.defaultVariantId) || variants[0];
    const images = [...new Set([defaultVariant.imageUrl, ...defaultVariant.images])];
    const patch = {
      name: p.name, nameLower: normalize(p.name), searchTokens: searchTokens(p.name, BRAND, data.productType),
      description: `<p>${p.description}</p><p>Colores: ${p.colors.join(', ')}.</p><p>Tallas S, M, L y XL en todos los colores.${p.xxl.length ? ` XXL disponible únicamente en ${p.xxl.join(' y ')}.` : ''}</p>`,
      variants, defaultVariantId: defaultVariant.id, images, imagesByColor: Object.fromEntries(variants.map(v => [v.name, [v.imageUrl, ...v.images]])),
      updatedAt: FV.serverTimestamp(),
    };
    batch.update(doc.ref, patch, { lastUpdateTime: doc.updateTime });
    console.log('Listo para guardar:', p.name, variants.length, 'colores');
  }
  await batch.commit();
  const after = await db.getAll(...docs.map(d => d.ref));
  for (const [i, doc] of after.entries()) {
    const data = doc.data();
    const before = docs[i].data();
    assert.deepEqual(availability(data.variants), PRODUCTS[i].colors.map(name => ({ name, sizes: sizesFor(PRODUCTS[i], name) })));
    for (const field of ['sku', 'price', 'salePrice', 'inStock', 'categories', 'collections', 'tags', 'characters', 'createdAt', 'esPrendaBase', 'customizable', 'visible']) assert.deepEqual(data[field], before[field], `Cambió ${field}`);
  }
  console.log('Verificado: disponibilidad actualizada en 4 productos; precios, stock e identidad conservados.');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { PRODUCTS, SIZES, sizesFor };
