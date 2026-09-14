/**
 * Catálogo Mussa · Skincare coreano (K-beauty) — lote extra "Pendientes por subir"
 * ────────────────────────────────────────────────────────────────────────────
 * Crea, en Firebase REAL (usa service account), los 5 productos mapeados desde
 * las fotos en:
 *   C:\Users\Isaac\Downloads\Pendientes por subr-20260911T195024Z-1-001\Pendientes por subr
 *
 * Reusa el patrón EXACTO de scripts/seed-mussa-skincare.js (mismos campos,
 * mismos helpers de búsqueda, misma marca MUSSA).
 *
 * Decisiones confirmadas con el dueño (no inventadas):
 *   - Marca (tienda): "MUSSA" — ya existe en tienda_brands, se reusa tal cual.
 *   - Precio: S/88.50 para los 5 productos (mismo precio vigente que el resto
 *     del catálogo MUSSA skincare — verificado en Firestore, no el S/79.90
 *     original del primer seed).
 *   - Stock inicial: 4 unidades cada producto (mismo stock que el resto).
 *   - Cada línea real (Dr.Althea, mixsoon, Anua ya existen como etiqueta;
 *     COSRX y Abib son líneas nuevas, se crean como etiqueta nueva).
 *   - Categorías: se reusan las que ya existen (Limpiadores, Sérums y
 *     tratamientos, Protectores solares). Ninguna categoría nueva.
 *   - `characters` queda vacío: no aplica (skincare, no personajes).
 *   - Son productos simples (sin variantes): se usa el patrón `mainImage`,
 *     una sola foto por producto.
 *
 * USO:
 *   node scripts/seed-mussa-kbeauty-extra.js            (dry-run, no escribe)
 *   node scripts/seed-mussa-kbeauty-extra.js --confirm   (escribe de verdad)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const IMAGES_DIR = path.join(ROOT, 'tmp_mussa_new');
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

// ── Normalización de búsqueda — copiada literal de scripts/seed-mussa-skincare.js ──
const MAX_SEARCH_TOKENS = 60;
const MIN_TOKEN_LEN = 2;
const MAX_PREFIX_LEN = 12;

function normalizeSearchText(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

function contentTypeFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function uploadImage(localFile, destPath) {
  const token = crypto.randomUUID();
  await bucket.upload(localFile, {
    destination: destPath,
    metadata: {
      contentType: contentTypeFor(localFile),
      cacheControl: 'public, max-age=31536000',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const encodedPath = encodeURIComponent(destPath);
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodedPath}?alt=media&token=${token}`;
}

async function findByName(collection, name) {
  const snap = await db.collection(collection).where('name', '==', name).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

const PRICE = 88.5;
const STOCK = 4;

// ── Las 5 fichas ─────────────────────────────────────────────────────────
const PRODUCTS = [
  {
    id: 'mussa-dralthea-pore-refresh-grinding-cleansing-balm',
    sku: 'MUSSA-DRALT-POREBALM',
    name: 'Dr.Althea Pore Refresh Grinding Cleansing Balm',
    line: 'Dr.Althea',
    category: 'Limpiadores',
    file: 'ChatGPT Image 9 sept 2026, 06_00_20 p.m.png',
    description: '<p><strong>Dr.Althea Pore Refresh Grinding Cleansing Balm</strong>, bálsamo limpiador exfoliante con Centella Asiatica, extracto de berenjena (Solanum Melongena) y Ceramide NP para afinar el poro sin resecar.</p><p>50 ml / 1.69 fl. oz.</p>',
  },
  {
    id: 'mussa-mixsoon-soondy-centella-essence',
    sku: 'MUSSA-MIXSOON-SOONDY',
    name: 'mixsoon Soondy Centella Asiatica Essence',
    line: 'mixsoon',
    category: 'Sérums y tratamientos',
    file: 'ChatGPT Image 9 sept 2026, 06_28_21 p.m.png',
    description: '<p><strong>mixsoon Soondy Centella Asiatica Essence</strong>, esencia calmante con alta concentración de Centella Asiatica, ideal para pieles sensibles e irritadas.</p><p>100 ml / 3.38 fl. oz.</p>',
  },
  {
    id: 'mussa-anua-pdrn-hyaluron-capsule-100-serum',
    sku: 'MUSSA-ANUA-PDRN100',
    name: 'Anua PDRN Hyaluronic Acid Capsule 100 Serum',
    line: 'Anua',
    category: 'Sérums y tratamientos',
    file: 'ChatGPT Image 9 sept 2026, 06_32_50 p.m.png',
    description: '<p><strong>Anua PDRN Hyaluronic Acid Capsule 100 Serum</strong>, sérum reparador con PDRN + Ácido Hialurónico para hidratación profunda y recuperación de la barrera cutánea.</p><p>30 ml / 1.01 fl. oz.</p>',
  },
  {
    id: 'mussa-cosrx-advanced-snail-96-mucin-essence',
    sku: 'MUSSA-COSRX-SNAIL96',
    name: 'COSRX Advanced Snail 96 Mucin Power Essence',
    line: 'COSRX',
    category: 'Sérums y tratamientos',
    file: 'Gemini_Generated_Image_wljs5swljs5swljs (1).jpg',
    description: '<p><strong>COSRX Advanced Snail 96 Mucin Power Essence</strong>, esencia con 96% de mucina de caracol para reparar, hidratar y dar luminosidad a la piel.</p><p>100 ml / 3.38 fl. oz.</p>',
  },
  {
    id: 'mussa-abib-quick-sunstick-protection-bar',
    sku: 'MUSSA-ABIB-SUNSTICK',
    name: 'Abib Quick Sunstick Protection Bar SPF50+ PA++++',
    line: 'Abib',
    category: 'Protectores solares',
    file: 'Gemini_Generated_Image_y73l2ny73l2ny73l.jpg',
    description: '<p><strong>Abib Quick Sunstick Protection Bar SPF50+ PA++++</strong>, protector solar en barra, de aplicación rápida y sin residuo blanco.</p><p>22 g / 0.77 oz.</p>',
  },
];

const LINES = Array.from(new Set(PRODUCTS.map((p) => p.line)));
const CATEGORY_NAMES = Array.from(new Set(PRODUCTS.map((p) => p.category)));

async function main() {
  console.log(CONFIRMED ? '→ Escribiendo en Firebase REAL (sistema-gestion-3b225)...' : '→ DRY-RUN (no escribe nada; usa --confirm para aplicar)');
  console.log('');

  // ── 1) Marca MUSSA (debe existir ya) ────────────────────────────────────
  const brandMussa = await findByName('tienda_brands', 'MUSSA');
  if (!brandMussa) throw new Error('No se encontró la marca "MUSSA". Revisa el nombre exacto en el admin.');
  console.log(`✓ Marca "MUSSA" → ${brandMussa.id}`);

  // ── 2) Categorías: reusar las que existan, crear las que falten ────────
  const categoryIds = {};
  for (const catName of CATEGORY_NAMES) {
    let cat = await findByName('tienda_categories', catName);
    if (!cat) {
      console.log(`  + Categoría "${catName}" no existe, se crea.`);
      if (CONFIRMED) {
        const catsSnap = await db.collection('tienda_categories').get();
        const maxOrder = catsSnap.docs.reduce((m, d) => Math.max(m, Number(d.data().order) || 0), 0);
        const ref = await db.collection('tienda_categories').add({
          name: catName,
          imageUrl: '',
          order: maxOrder + 1,
          brandIds: [],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        cat = { id: ref.id, name: catName };
      } else {
        cat = { id: '(nueva-tras---confirm)', name: catName };
      }
    } else {
      console.log(`✓ Categoría "${catName}" → ${cat.id} (ya existía)`);
    }
    categoryIds[catName] = cat.id;
  }

  console.log('');

  // ── 3) Etiquetas de línea: reusar las que existan, crear las que falten ─
  const tagIds = {};
  for (const lineName of LINES) {
    let tag = await findByName('tags', lineName);
    if (!tag) {
      console.log(`  + Etiqueta "${lineName}" no existe, se crea.`);
      if (CONFIRMED) {
        const ref = await db.collection('tags').add({
          name: lineName,
          brandIds: [],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        tag = { id: ref.id, name: lineName };
      } else {
        tag = { id: '(nueva-tras---confirm)', name: lineName };
      }
    } else {
      console.log(`✓ Etiqueta "${lineName}" → ${tag.id} (ya existía)`);
    }
    tagIds[lineName] = tag.id;
  }

  console.log('');

  // ── 4) Subir imágenes ────────────────────────────────────────────────────
  const imageUrls = {};
  if (CONFIRMED) {
    console.log('→ Subiendo imágenes a Storage...');
    for (const p of PRODUCTS) {
      const local = path.join(IMAGES_DIR, p.file);
      if (!fs.existsSync(local)) throw new Error(`No se encontró ${local}`);
      const ext = path.extname(p.file).toLowerCase() === '.png' ? 'png' : 'jpg';
      const dest = `products/${p.id}/main.${ext}`;
      imageUrls[p.id] = await uploadImage(local, dest);
      console.log(`  ✓ ${p.file} → ${dest}`);
    }
  } else {
    for (const p of PRODUCTS) {
      const local = path.join(IMAGES_DIR, p.file);
      if (!fs.existsSync(local)) throw new Error(`No se encontró ${local}`);
      imageUrls[p.id] = `(url-tras---confirm)/${p.id}`;
    }
  }

  console.log('');

  // ── 5) Construir y escribir los 5 productos ─────────────────────────────
  console.log('→ Productos a crear/actualizar:');
  for (const p of PRODUCTS) {
    const mainImage = imageUrls[p.id];
    const payload = {
      name: p.name,
      sku: p.sku,
      description: p.description,
      categories: [categoryIds[p.category]],
      collections: [],
      tags: [tagIds[p.line]],
      characters: [],
      vendors: [],
      productType: '',
      brandId: brandMussa.id,
      vendorId: 'casa',
      nicheId: 'regala-con-amor',
      fulfillmentType: 'stock',
      price: PRICE,
      salePrice: null,
      inStock: STOCK,
      customizable: false,
      hasVariants: false,
      mainImage,
      mainSizes: [],
      images: [mainImage],
      imagesByColor: { default: mainImage },
      variants: [],
      defaultVariantId: '',
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
    payload.nameLower = normalizeSearchText(payload.name);
    payload.searchTokens = buildSearchTokens(payload.name, payload.brandId, payload.productType);

    console.log(`  - ${p.id}  "${p.name}"  S/${PRICE}  stock=${STOCK}  cat="${p.category}"  tag="${p.line}"`);

    if (CONFIRMED) {
      const now = FieldValue.serverTimestamp();
      await db.collection('productos_wala').doc(p.id).set({ ...payload, createdAt: now, updatedAt: now });
    }
  }

  console.log('');
  console.log(CONFIRMED
    ? '✅ Listo. Revisa los 5 productos en el panel admin.'
    : '(dry-run) Nada se escribió. Vuelve a correr con --confirm para crear todo esto de verdad.');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
