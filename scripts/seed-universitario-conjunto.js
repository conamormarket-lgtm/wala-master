/**
 * Conjunto Universitario · 100 Años (casaca + polo + jogger + combo)
 * ────────────────────────────────────────────────────────────────────────────
 * Crea, en Firebase REAL (usa service account), el mismo tipo de línea que ya
 * existe para "Alianza Lima": 3 piezas vendibles por separado + 1 producto
 * combo que las junta. Imágenes de C:\Users\Isaac\Downloads\conjunto.
 *
 * Reusa el patrón EXACTO de normalizeProductPayload (src/services/products.js):
 * mismos nombres de campo, mismos helpers de búsqueda (normalizeSearchText /
 * buildSearchTokens, copiados literales de scripts/backfill-search-tokens.js
 * para que quedaran IDÉNTICOS, según indica su propio comentario).
 *
 * Decisiones ya confirmadas con el dueño (no inventadas):
 *   - Categoría nueva "Joggers" para el pantalón (Poleras no le queda).
 *   - Se venden las 3 piezas sueltas Y además el combo.
 *   - Precios: Casaca S/109/119 (igual que Alianza Lima), Polo S/45/59,
 *     Jogger S/79/89, Combo S/199/213.
 *   - Stock inicial: 4 unidades cada producto (igual que Alianza Lima).
 *   - Marca: "Con Amor Equipos" (ya existe, es la misma línea de camisetas de
 *     clubes). NO se crea una marca "Universitario": las marcas en este
 *     sistema son tiendas/vendedores, no equipos con licencia.
 *   - Etiqueta nueva "Universitario" + reusa la etiqueta "Fútbol" existente.
 *   - Personaje nuevo "Lolo Fernández" (solo en la casaca, es quien aparece
 *     retratado en la espalda) — mismo patrón que el "Paolo Guerrero" que ya
 *     existe en el catálogo.
 *
 * Ninguno de los 3 productos usa `customizationViews` (eso fuerza
 * `customizable:true` y muestra el botón "Personalizar", que NO queremos: el
 * diseño ya viene impreso). En vez de eso, la vista de espalda va en
 * `variants[].images` — confirmado en ProductDetail.jsx (buildImages) que la
 * galería igual la muestra sin tocar el flag `customizable`.
 *
 * USO:
 *   node scripts/seed-universitario-conjunto.js            (dry-run, no escribe)
 *   node scripts/seed-universitario-conjunto.js --confirm   (escribe de verdad)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const IMAGES_DIR = 'C:\\Users\\Isaac\\Downloads\\conjunto';
const CONFIRMED = process.argv.includes('--confirm');

const admin = require(require.resolve('firebase-admin', { paths: [fnModules] }));

const saPath = path.join(ROOT, 'serviceAccountKey.json');
if (!fs.existsSync(saPath)) {
  console.error('❌ No existe serviceAccountKey.json en la raíz del repo.');
  process.exit(1);
}
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
const BUCKET_NAME = 'sistema-gestion-3b225.firebasestorage.app';

admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: sa.project_id,
  storageBucket: BUCKET_NAME,
});
const db = admin.firestore();
const bucket = admin.storage().bucket();
const FieldValue = admin.firestore.FieldValue;

// ── Normalización de búsqueda — copiada literal de scripts/backfill-search-tokens.js
// (su propio comentario exige que quede IDÉNTICA a src/services/products.js) ──
const MAX_SEARCH_TOKENS = 60;
const MIN_TOKEN_LEN = 2;
const MAX_PREFIX_LEN = 12;

function normalizeSearchText(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita diacríticos (tildes); ñ→n
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchTokens(...parts) {
  const text = parts.map(normalizeSearchText).filter(Boolean).join(' ');
  if (!text) return [];
  const words = Array.from(new Set(text.split(' ').filter((w) => w.length >= MIN_TOKEN_LEN)));
  const tokens = new Set();
  for (const w of words) {
    const upper = Math.min(w.length, MAX_PREFIX_LEN);
    for (let len = MIN_TOKEN_LEN; len <= upper; len++) {
      tokens.add(w.slice(0, len));
    }
    if (w.length > MAX_PREFIX_LEN) tokens.add(w);
    if (tokens.size >= MAX_SEARCH_TOKENS) break;
  }
  return Array.from(tokens).slice(0, MAX_SEARCH_TOKENS);
}

// ── Sube una imagen local a Storage y devuelve una URL de descarga con el
// mismo formato que getDownloadURL() del SDK cliente (firebasestorage.googleapis.com
// con ?alt=media&token=...) — es el formato que src/utils/imageUrl.js reconoce
// como "de Firebase Storage" y sirve directo. ──
async function uploadImage(localFile, destPath) {
  const token = crypto.randomUUID();
  await bucket.upload(localFile, {
    destination: destPath,
    metadata: {
      contentType: 'image/png',
      cacheControl: 'public, max-age=31536000',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const encodedPath = encodeURIComponent(destPath);
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodedPath}?alt=media&token=${token}`;
}

// ── Busca un doc por `name` exacto en una colección; null si no existe. ──
async function findByName(collection, name) {
  const snap = await db.collection(collection).where('name', '==', name).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function main() {
  console.log(CONFIRMED ? '→ Escribiendo en Firebase REAL (sistema-gestion-3b225)...' : '→ DRY-RUN (no escribe nada; usa --confirm para aplicar)');
  console.log('');

  // ── 1) Taxonomía: reusar lo que exista, crear lo que falte ─────────────────
  const [brandConAmorEquipos, catPoleras, tagFutbol] = await Promise.all([
    findByName('tienda_brands', 'Con Amor Equipos'),
    findByName('tienda_categories', 'Poleras'),
    findByName('tags', 'Fútbol'),
  ]);

  if (!brandConAmorEquipos) throw new Error('No se encontró la marca "Con Amor Equipos". Revisa el nombre exacto en el admin.');
  if (!catPoleras) throw new Error('No se encontró la categoría "Poleras". Revisa el nombre exacto en el admin.');
  if (!tagFutbol) throw new Error('No se encontró la etiqueta "Fútbol". Revisa el nombre exacto en el admin.');

  console.log(`✓ Marca "Con Amor Equipos"  → ${brandConAmorEquipos.id}`);
  console.log(`✓ Categoría "Poleras"       → ${catPoleras.id}`);
  console.log(`✓ Etiqueta "Fútbol"         → ${tagFutbol.id}`);

  let tagUniversitario = await findByName('tags', 'Universitario');
  let charLoloFernandez = await findByName('characters', 'Lolo Fernández');
  let catJoggers = await findByName('tienda_categories', 'Joggers');

  if (!tagUniversitario) {
    console.log('  + Etiqueta "Universitario" no existe, se crea.');
    if (CONFIRMED) {
      const ref = await db.collection('tags').add({
        name: 'Universitario',
        brandIds: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tagUniversitario = { id: ref.id, name: 'Universitario' };
    } else {
      tagUniversitario = { id: '(nuevo-tras---confirm)', name: 'Universitario' };
    }
  } else {
    console.log(`✓ Etiqueta "Universitario"  → ${tagUniversitario.id} (ya existía)`);
  }

  if (!charLoloFernandez) {
    console.log('  + Personaje "Lolo Fernández" no existe, se crea.');
    if (CONFIRMED) {
      const ref = await db.collection('characters').add({
        name: 'Lolo Fernández',
        brandIds: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      charLoloFernandez = { id: ref.id, name: 'Lolo Fernández' };
    } else {
      charLoloFernandez = { id: '(nuevo-tras---confirm)', name: 'Lolo Fernández' };
    }
  } else {
    console.log(`✓ Personaje "Lolo Fernández" → ${charLoloFernandez.id} (ya existía)`);
  }

  if (!catJoggers) {
    console.log('  + Categoría "Joggers" no existe, se crea.');
    if (CONFIRMED) {
      const catsSnap = await db.collection('tienda_categories').get();
      const maxOrder = catsSnap.docs.reduce((m, d) => Math.max(m, Number(d.data().order) || 0), 0);
      const ref = await db.collection('tienda_categories').add({
        name: 'Joggers',
        imageUrl: '',
        order: maxOrder + 1,
        brandIds: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      catJoggers = { id: ref.id, name: 'Joggers' };
    } else {
      catJoggers = { id: '(nuevo-tras---confirm)', name: 'Joggers' };
    }
  } else {
    console.log(`✓ Categoría "Joggers"       → ${catJoggers.id} (ya existía)`);
  }

  console.log('');

  // ── 2) Subir las 6 imágenes ──────────────────────────────────────────────
  const PRODUCT_IDS = {
    casaca: 'universitario-100-anos-casaca',
    polo: 'universitario-100-anos-polo',
    jogger: 'universitario-100-anos-jogger',
    combo: 'universitario-100-anos-combo',
  };

  const IMAGE_FILES = {
    casacaFrente: 'casaca_u_frente.png',
    casacaAtras: 'casaca_u_atrás.png',
    poloFrente: 'polo_u_frente.png',
    poloAtras: 'polo_u_atras.png',
    joggerFrente: 'jogger_u_frente.png',
    joggerAtras: 'jogger_u_atras.png',
  };

  const urls = {};
  if (CONFIRMED) {
    console.log('→ Subiendo imágenes a Storage...');
    for (const [key, filename] of Object.entries(IMAGE_FILES)) {
      const local = path.join(IMAGES_DIR, filename);
      if (!fs.existsSync(local)) throw new Error(`No se encontró ${local}`);
      const productKey = key.startsWith('casaca') ? 'casaca' : key.startsWith('polo') ? 'polo' : 'jogger';
      const side = key.endsWith('Frente') ? 'frente' : 'atras';
      const dest = `products/${PRODUCT_IDS[productKey]}/${side}.png`;
      urls[key] = await uploadImage(local, dest);
      console.log(`  ✓ ${filename} → ${dest}`);
    }
  } else {
    for (const key of Object.keys(IMAGE_FILES)) urls[key] = `(url-tras---confirm)/${key}`;
  }

  console.log('');

  // ── 3) Los 3 productos individuales ──────────────────────────────────────
  const commonTags = [tagFutbol.id, tagUniversitario.id];

  const casacaPayload = {
    name: 'Casaca Universitario · 100 Años Cañonero',
    sku: 'UNI-CASACA-100',
    description:
      '<p><strong>Casaca oficial 100 Años de Universitario de Deportes</strong>, con el histórico "Lolo" Fernández — El Cañonero — en la espalda.</p>' +
      '<ul><li>Frente: escudo, "100 Años Marathon", "Dale U Campeón" en la manga y "Amón EternU".</li>' +
      '<li>Espalda: ilustración de Lolo Fernández con la leyenda "Cañonero".</li>' +
      '<li>Con cierre, capucha y bolsillo canguro.</li></ul>',
    categories: [catPoleras.id],
    collections: [],
    tags: commonTags,
    characters: [charLoloFernandez.id],
    vendors: [],
    productType: '',
    brandId: brandConAmorEquipos.id,
    vendorId: 'casa',
    nicheId: 'regala-con-amor',
    fulfillmentType: 'stock',
    price: 119.0,
    salePrice: 109.0,
    description2: undefined,
    inStock: 4,
    customizable: false,
    hasVariants: true,
    mainImage: '',
    mainSizes: [],
    variants: [
      {
        id: 'blanco',
        name: 'Blanco',
        imageUrl: urls.casacaFrente,
        images: [urls.casacaAtras],
        galleryImages: [urls.casacaAtras],
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        thumbnailCrop: null,
        imagesCrops: {},
      },
    ],
    defaultVariantId: 'blanco',
    variantDisplayBehavior: 'default_only',
    behaviorImpressionsThreshold: 3,
    customizationViews: [],
    productCliparts: [],
    featured: false,
    featuredOrder: 0,
    visible: true,
    isComboProduct: false,
    whatsappEnabled: true,
    whatsappNumber: '',
    whatsappMessage: '',
  };

  const poloPayload = {
    name: 'Polo Universitario · 100 Años',
    sku: 'UNI-POLO-100',
    description:
      '<p><strong>Polo oficial 100 Años de Universitario de Deportes</strong>, granate, con el escudo del club y la firma "Club Universitario de Deportes" en el pecho.</p>',
    categories: [catPoleras.id],
    collections: [],
    tags: commonTags,
    characters: [],
    vendors: [],
    productType: '',
    brandId: brandConAmorEquipos.id,
    vendorId: 'casa',
    nicheId: 'regala-con-amor',
    fulfillmentType: 'stock',
    price: 59.0,
    salePrice: 45.0,
    inStock: 4,
    customizable: false,
    hasVariants: true,
    mainImage: '',
    mainSizes: [],
    variants: [
      {
        id: 'granate',
        name: 'Granate',
        imageUrl: urls.poloFrente,
        images: [urls.poloAtras],
        galleryImages: [urls.poloAtras],
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        thumbnailCrop: null,
        imagesCrops: {},
      },
    ],
    defaultVariantId: 'granate',
    variantDisplayBehavior: 'default_only',
    behaviorImpressionsThreshold: 3,
    customizationViews: [],
    productCliparts: [],
    featured: false,
    featuredOrder: 0,
    visible: true,
    isComboProduct: false,
    whatsappEnabled: true,
    whatsappNumber: '',
    whatsappMessage: '',
  };

  const joggerPayload = {
    name: 'Jogger Universitario · 100 Años',
    sku: 'UNI-JOGGER-100',
    description:
      '<p><strong>Jogger oficial 100 Años de Universitario de Deportes</strong>, blanco, con el escudo del club y la firma "Club Universitario de Deportes".</p>',
    categories: [catJoggers.id],
    collections: [],
    tags: commonTags,
    characters: [],
    vendors: [],
    productType: '',
    brandId: brandConAmorEquipos.id,
    vendorId: 'casa',
    nicheId: 'regala-con-amor',
    fulfillmentType: 'stock',
    price: 89.0,
    salePrice: 79.0,
    inStock: 4,
    customizable: false,
    hasVariants: true,
    mainImage: '',
    mainSizes: [],
    variants: [
      {
        id: 'blanco',
        name: 'Blanco',
        imageUrl: urls.joggerFrente,
        images: [urls.joggerAtras],
        galleryImages: [urls.joggerAtras],
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        thumbnailCrop: null,
        imagesCrops: {},
      },
    ],
    defaultVariantId: 'blanco',
    variantDisplayBehavior: 'default_only',
    behaviorImpressionsThreshold: 3,
    customizationViews: [],
    productCliparts: [],
    featured: false,
    featuredOrder: 0,
    visible: true,
    isComboProduct: false,
    whatsappEnabled: true,
    whatsappNumber: '',
    whatsappMessage: '',
  };

  // Completa los campos derivados (images/imagesByColor/nameLower/searchTokens)
  // EXACTAMENTE como normalizeProductPayload — ver src/services/products.js.
  function finalizeSimpleProduct(p) {
    const v = p.variants[0];
    p.images = [v.imageUrl].filter(Boolean);
    p.imagesByColor = { [v.name]: [v.imageUrl] };
    p.nameLower = normalizeSearchText(p.name);
    p.searchTokens = buildSearchTokens(p.name, p.brandId, p.productType);
    delete p.description2;
    return p;
  }

  [casacaPayload, poloPayload, joggerPayload].forEach(finalizeSimpleProduct);

  console.log('→ Productos individuales a crear/actualizar:');
  console.log(`  - ${PRODUCT_IDS.casaca}  "${casacaPayload.name}"  S/${casacaPayload.salePrice}/${casacaPayload.price}`);
  console.log(`  - ${PRODUCT_IDS.polo}    "${poloPayload.name}"  S/${poloPayload.salePrice}/${poloPayload.price}`);
  console.log(`  - ${PRODUCT_IDS.jogger}  "${joggerPayload.name}"  S/${joggerPayload.salePrice}/${joggerPayload.price}`);

  if (CONFIRMED) {
    const now = FieldValue.serverTimestamp();
    await db.collection('productos_wala').doc(PRODUCT_IDS.casaca).set({ ...casacaPayload, createdAt: now, updatedAt: now });
    await db.collection('productos_wala').doc(PRODUCT_IDS.polo).set({ ...poloPayload, createdAt: now, updatedAt: now });
    await db.collection('productos_wala').doc(PRODUCT_IDS.jogger).set({ ...joggerPayload, createdAt: now, updatedAt: now });
    console.log('  ✓ Escritos.');
  }

  console.log('');

  // ── 4) El combo ───────────────────────────────────────────────────────────
  const comboPayload = {
    name: 'Conjunto Universitario · 100 Años',
    sku: 'UNI-COMBO-100',
    description:
      '<p><strong>Conjunto completo 100 Años de Universitario de Deportes</strong>: casaca + polo + jogger. La casaca lleva a Lolo Fernández "El Cañonero" en la espalda.</p>' +
      '<p>Cómpralo como conjunto o cada pieza por separado.</p>',
    categories: [catPoleras.id, catJoggers.id],
    collections: [],
    tags: commonTags,
    characters: [charLoloFernandez.id],
    vendors: [],
    productType: '',
    brandId: brandConAmorEquipos.id,
    vendorId: 'casa',
    nicheId: 'regala-con-amor',
    fulfillmentType: 'stock',
    price: 213.0,
    salePrice: 199.0,
    inStock: 4,
    customizable: false,
    hasVariants: false,
    mainImage: '',
    mainSizes: [],
    variants: [],
    defaultVariantId: '',
    variantDisplayBehavior: 'default_only',
    behaviorImpressionsThreshold: 3,
    customizationViews: [],
    productCliparts: [],
    featured: false,
    featuredOrder: 0,
    visible: true,
    isComboProduct: true,
    comboLayout: { orientation: 'horizontal', spacing: 20 },
    comboPreviewImage: urls.casacaFrente,
    comboItems: [
      {
        productId: PRODUCT_IDS.casaca,
        name: 'Casaca',
        imageUrl: urls.casacaFrente,
        viewId: 'default',
        position: 0,
        scale: 1,
        customizable: false,
        variantMapping: { color: 'Blanco', allowedColors: ['Blanco'] },
      },
      {
        productId: PRODUCT_IDS.polo,
        name: 'Polo',
        imageUrl: urls.poloFrente,
        viewId: 'default',
        position: 1,
        scale: 1,
        customizable: false,
        variantMapping: { color: 'Granate', allowedColors: ['Granate'] },
      },
      {
        productId: PRODUCT_IDS.jogger,
        name: 'Jogger',
        imageUrl: urls.joggerFrente,
        viewId: 'default',
        position: 2,
        scale: 1,
        customizable: false,
        variantMapping: { color: 'Blanco', allowedColors: ['Blanco'] },
      },
    ],
    images: [urls.casacaFrente],
    imagesByColor: {},
    whatsappEnabled: true,
    whatsappNumber: '',
    whatsappMessage: '',
  };
  comboPayload.nameLower = normalizeSearchText(comboPayload.name);
  comboPayload.searchTokens = buildSearchTokens(comboPayload.name, comboPayload.brandId, comboPayload.productType);

  console.log('→ Combo a crear/actualizar:');
  console.log(`  - ${PRODUCT_IDS.combo}  "${comboPayload.name}"  S/${comboPayload.salePrice}/${comboPayload.price}`);

  if (CONFIRMED) {
    const now = FieldValue.serverTimestamp();
    await db.collection('productos_wala').doc(PRODUCT_IDS.combo).set({ ...comboPayload, createdAt: now, updatedAt: now });
    console.log('  ✓ Escrito.');
  }

  console.log('');
  console.log(CONFIRMED
    ? '✅ Listo. Revisa los 4 productos en el panel admin antes de que un cliente compre (ediciones finas de precio/copy quedan a tu criterio).'
    : '(dry-run) Nada se escribió. Vuelve a correr con --confirm para crear todo esto de verdad.');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
