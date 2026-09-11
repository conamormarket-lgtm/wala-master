/**
 * Catálogo Mussa · Skincare coreano (K-beauty)
 * ────────────────────────────────────────────────────────────────────────────
 * Crea, en Firebase REAL (usa service account), los 29 productos de skincare
 * mapeados desde las fotos en:
 *   C:\Users\Isaac\Downloads\FOTOS CON FONDO BLANCO PARA MERCADO LIBRE
 *
 * Reusa el patrón EXACTO de normalizeProductPayload (src/services/products.js):
 * mismos nombres de campo, mismos helpers de búsqueda (normalizeSearchText /
 * buildSearchTokens, copiados literales de scripts/backfill-search-tokens.js).
 *
 * Decisiones confirmadas con el dueño (no inventadas):
 *   - Marca (tienda): "MUSSA" — YA EXISTE en tienda_brands, se reusa tal cual.
 *   - Precio: S/79.90 para los 29 productos (sin precio de oferta).
 *   - Stock inicial: 4 unidades cada producto.
 *   - Cada línea real (Anua, SKIN1004, Dr.Althea, medicube, mixsoon, celimax,
 *     Centellian24, numbuzin, JUMISO, K-Secret · Seoul 1988, Beauty of Joseon)
 *     se crea como ETIQUETA nueva — en este sistema "marca" = tienda/vendedor,
 *     no fabricante (mismo patrón que "Universitario"/"Alianza Lima" bajo la
 *     marca "Con Amor Equipos").
 *   - Categorías: se reusan las 5 que ya existen (Hidratantes, Protectores
 *     solares, Mascarillas, Limpiadores, Sérums y tratamientos). El único caso
 *     sin categoría existente es el tónico de celimax — el dueño autorizó
 *     crear categorías nuevas cuando falten, así que se crea "Tónicos".
 *   - `characters` queda vacío en los 29: no aplica (son personajes de
 *     animes/clubes, no de skincare).
 *   - Son productos simples (sin variantes de color/talla): se usa el patrón
 *     `mainImage` (no `variants[]`), una sola foto por producto — la que mejor
 *     representa el empaque (para el Vitamin C Serum de Dr.Althea, que tiene
 *     2 fotos, se usa la toma limpia sin banner publicitario).
 *
 * USO:
 *   node scripts/seed-mussa-skincare.js            (dry-run, no escribe)
 *   node scripts/seed-mussa-skincare.js --confirm   (escribe de verdad)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const IMAGES_DIR = 'C:\\Users\\Isaac\\Downloads\\FOTOS CON FONDO BLANCO PARA MERCADO LIBRE';
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
// (IDÉNTICA a src/services/products.js) ──
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

async function uploadImage(localFile, destPath) {
  const token = crypto.randomUUID();
  await bucket.upload(localFile, {
    destination: destPath,
    metadata: {
      contentType: 'image/jpeg',
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

const PRICE = 79.90;
const STOCK = 4;

// ── Las 29 fichas ─────────────────────────────────────────────────────────
const PRODUCTS = [
  {
    id: 'mussa-anua-azelaic-acid-serum',
    sku: 'MUSSA-ANUA-AZE10',
    name: 'Anua Azelaic Acid 10+ Hyaluron Redness Soothing Serum',
    line: 'Anua',
    category: 'Sérums y tratamientos',
    file: 'Gemini_Generated_Image_18q8ky18q8ky18q8.jpg',
    description: '<p><strong>Anua Azelaic Acid 10+ Hyaluron Redness Soothing Serum</strong>, sérum calmante para rojeces con Azelaic Acid 10% + Hyaluron.</p><p>30 ml / 1.01 fl. oz.</p>',
  },
  {
    id: 'mussa-anua-niacinamide-txa4-serum',
    sku: 'MUSSA-ANUA-NIA10',
    name: 'Anua Niacinamide 10 + TXA4 Serum',
    line: 'Anua',
    category: 'Sérums y tratamientos',
    file: 'Gemini_Generated_Image_5hekxa5hekxa5hek.jpg',
    description: '<p><strong>Anua Niacinamide 10 + TXA4 Serum</strong>, sérum para unificar el tono de la piel.</p><p>30 ml / 1.01 fl. oz.</p>',
  },
  {
    id: 'mussa-kseoul1988-serum-retinal-liposome',
    sku: 'MUSSA-KSEC-SER2',
    name: 'K-Secret Seoul 1988 Serum: Retinal Liposome 2% + Black Ginseng',
    line: 'K-Secret · Seoul 1988',
    category: 'Sérums y tratamientos',
    file: 'Gemini_Generated_Image_67s8yk67s8yk67s8.jpg',
    description: '<p><strong>K-Secret Seoul 1988 Serum</strong>: Retinal Liposome 2% + Black Ginseng.</p><p>30 ml / 1.01 fl. oz.</p>',
  },
  {
    id: 'mussa-kseoul1988-eye-cream-retinal-liposome',
    sku: 'MUSSA-KSEC-EYE4',
    name: 'K-Secret Seoul 1988 Eye Cream: Retinal Liposome 4% + Fermented Bean',
    line: 'K-Secret · Seoul 1988',
    category: 'Sérums y tratamientos',
    file: 'Gemini_Generated_Image_6tvjmg6tvjmg6tvj.jpg',
    description: '<p><strong>K-Secret Seoul 1988 Eye Cream</strong>: Retinal Liposome 4% + Fermented Bean.</p><p>30 ml / 1.01 fl. oz.</p>',
  },
  {
    id: 'mussa-centellian24-360-shot-eye-cream',
    sku: 'MUSSA-CENT24-360',
    name: 'Centellian24 360° Shot PDRN Lifting Eye Cream',
    line: 'Centellian24',
    category: 'Sérums y tratamientos',
    file: 'Gemini_Generated_Image_m73kh7m73kh7m73k.jpg',
    description: '<p><strong>Centellian24 360° Shot PDRN Lifting Eye Cream</strong>, con TECA + 2X PDRN, 3D Retinol y Phyto Collagen.</p><p>30 ml / 1.01 fl. oz.</p>',
  },
  {
    id: 'mussa-skin1004-centella-soothing-cream',
    sku: 'MUSSA-SK1004-SOOTH',
    name: 'SKIN1004 Madagascar Centella Soothing Cream',
    line: 'SKIN1004',
    category: 'Hidratantes',
    file: 'Gemini_Generated_Image_s3qib1s3qib1s3qi.jpg',
    description: '<p><strong>SKIN1004 Madagascar Centella Soothing Cream</strong>, hecha con Centella pura de Madagascar. Calmante e hidratante.</p><p>75 ml / 2.53 fl. oz.</p>',
  },
  {
    id: 'mussa-skin1004-centella-ampoule',
    sku: 'MUSSA-SK1004-AMP',
    name: 'SKIN1004 Madagascar Centella Ampoule',
    line: 'SKIN1004',
    category: 'Sérums y tratamientos',
    file: 'Gemini_Generated_Image_b6jry4b6jry4b6jr.jpg',
    description: '<p><strong>SKIN1004 Madagascar Centella Ampoule</strong>, hecha con Centella pura de Madagascar.</p><p>100 ml / 3.38 fl. oz.</p>',
  },
  {
    id: 'mussa-skin1004-poremizing-ampoule',
    sku: 'MUSSA-SK1004-PORE',
    name: 'SKIN1004 Madagascar Centella Poremizing Fresh Ampoule',
    line: 'SKIN1004',
    category: 'Sérums y tratamientos',
    file: 'Gemini_Generated_Image_z9eajbz9eajbz9ea.jpg',
    description: '<p><strong>SKIN1004 Madagascar Centella Poremizing Fresh Ampoule</strong>, para minimizar la apariencia de los poros.</p><p>100 ml / 3.38 fl. oz.</p>',
  },
  {
    id: 'mussa-skin1004-tone-brightening-cleansing-foam',
    sku: 'MUSSA-SK1004-TBFOAM',
    name: 'SKIN1004 Madagascar Centella Tone Brightening Cleansing Gel Foam',
    line: 'SKIN1004',
    category: 'Limpiadores',
    file: 'Gemini_Generated_Image_25hgg925hgg925hg.jpg',
    description: '<p><strong>SKIN1004 Tone Brightening Cleansing Gel Foam</strong>, hecha con Centella pura de Madagascar.</p><p>125 ml / 4.22 fl. oz.</p>',
  },
  {
    id: 'mussa-skin1004-teatrica-bha-foam',
    sku: 'MUSSA-SK1004-BHA',
    name: 'SKIN1004 Madagascar Centella Tea-Trica BHA Foam',
    line: 'SKIN1004',
    category: 'Limpiadores',
    file: 'Gemini_Generated_Image_jxg2g0jxg2g0jxg2.jpg',
    description: '<p><strong>SKIN1004 Tea-Trica BHA Foam</strong>, limpiador en espuma con BHA.</p><p>128 ml / 4.22 fl. oz.</p>',
  },
  {
    id: 'mussa-skin1004-teatrica-sun-milk-spf50',
    sku: 'MUSSA-SK1004-SUNMILK',
    name: 'SKIN1004 Madagascar Centella Tea-Trica Soothing Sun Milk SPF50+ PA++++',
    line: 'SKIN1004',
    category: 'Protectores solares',
    file: 'Gemini_Generated_Image_gq13aqgq13aqgq13.jpg',
    description: '<p><strong>SKIN1004 Tea-Trica Soothing Sun Milk SPF50+ PA++++</strong>, protector solar calmante.</p><p>50 ml / 1.69 fl. oz.</p>',
  },
  {
    id: 'mussa-skin1004-hyalucica-sun-serum-spf50',
    sku: 'MUSSA-SK1004-SUNSERUM',
    name: 'SKIN1004 Madagascar Centella Hyalu-Cica Water-Fit Sun Serum SPF50+ PA++++',
    line: 'SKIN1004',
    category: 'Protectores solares',
    file: 'Gemini_Generated_Image_kdkkhckdkkhckdkk.jpg',
    description: '<p><strong>SKIN1004 Hyalu-Cica Water-Fit Sun Serum SPF50+ PA++++</strong>, protector solar en textura de sérum.</p><p>50 ml / 1.69 fl. oz.</p>',
  },
  {
    id: 'mussa-dralthea-aqua-marine-deep-serum',
    sku: 'MUSSA-DRALT-AQDEEP',
    name: 'Dr.Althea Aqua Marine Deep Serum',
    line: 'Dr.Althea',
    category: 'Sérums y tratamientos',
    file: 'Gemini_Generated_Image_896i01896i01896i.jpg',
    description: '<p><strong>Dr.Althea Aqua Marine Deep Serum</strong>, formulado con 70% Bambusa Vulgaris Water para hidratación profunda.</p><p>30 ml / 1.01 fl. oz.</p>',
  },
  {
    id: 'mussa-dralthea-aqua-marine-watery-cream',
    sku: 'MUSSA-DRALT-AQCREAM',
    name: 'Dr.Althea Aqua Marine Watery Cream',
    line: 'Dr.Althea',
    category: 'Hidratantes',
    file: 'Gemini_Generated_Image_epujo5epujo5epuj.jpg',
    description: '<p><strong>Dr.Althea Aqua Marine Watery Cream</strong>, con 70% Bambusa Vulgaris Water. Para piel seca/normal.</p><p>50 ml / 1.69 fl. oz.</p>',
  },
  {
    id: 'mussa-dralthea-pure-grinding-cleansing-balm',
    sku: 'MUSSA-DRALT-BALM',
    name: 'Dr.Althea Pure Grinding Cleansing Balm',
    line: 'Dr.Althea',
    category: 'Limpiadores',
    file: 'Gemini_Generated_Image_dljbwidljbwidljb.jpg',
    description: '<p><strong>Dr.Althea Pure Grinding Cleansing Balm</strong>, bálsamo limpiador desmaquillante.</p><p>50 ml / 1.69 fl. oz.</p>',
  },
  {
    id: 'mussa-dralthea-gentle-vitamin-c-serum',
    sku: 'MUSSA-DRALT-VITC',
    name: 'Dr.Althea Gentle Vitamin C Serum 20%',
    line: 'Dr.Althea',
    category: 'Sérums y tratamientos',
    file: 'Gemini_Generated_Image_8xnwzn8xnwzn8xnw.jpg',
    description: '<p><strong>Dr.Althea Gentle Vitamin C Serum</strong>, sérum diario suave con 20% Hippophae Rhamnoides Fruit Water.</p><p>30 ml / 1.01 fl. oz.</p>',
  },
  {
    id: 'mussa-dralthea-147-barrier-cream',
    sku: 'MUSSA-DRALT-147',
    name: 'Dr.Althea 147 Barrier Cream',
    line: 'Dr.Althea',
    category: 'Hidratantes',
    file: 'Gemini_Generated_Image_bk8madbk8madbk8m (1).jpg',
    description: '<p><strong>Dr.Althea 147 Barrier Cream</strong>, para piel normal a seca, cuidado reparador de la barrera cutánea.</p></p>',
  },
  {
    id: 'mussa-dralthea-345-relief-cream',
    sku: 'MUSSA-DRALT-345',
    name: 'Dr.Althea 345 Relief Cream',
    line: 'Dr.Althea',
    category: 'Hidratantes',
    file: 'Gemini_Generated_Image_xlpjibxlpjibxlpj.jpg',
    description: '<p><strong>Dr.Althea 345 Relief Cream</strong>, para todo tipo de piel, libre de fragancia artificial.</p>',
  },
  {
    id: 'mussa-medicube-collagen-jelly-cream',
    sku: 'MUSSA-MEDICUBE-JELLY',
    name: 'medicube Collagen Jelly Cream',
    line: 'medicube',
    category: 'Hidratantes',
    file: 'Gemini_Generated_Image_38l69g38l69g38l6.jpg',
    description: '<p><strong>medicube Collagen Jelly Cream</strong>, con Collagen + Soluble Collagen + Hydrolyzed Collagen.</p><p>110 ml / 3.71 fl. oz.</p>',
  },
  {
    id: 'mussa-medicube-collagen-glow-booster-serum',
    sku: 'MUSSA-MEDICUBE-GLOW',
    name: 'medicube Collagen Glow Booster Serum',
    line: 'medicube',
    category: 'Sérums y tratamientos',
    file: 'Gemini_Generated_Image_6rtudk6rtudk6rtu.jpg',
    description: '<p><strong>medicube Collagen Glow Booster Serum</strong>, con Hydrolyzed Collagen 1% + Milk Protein Extract 1%.</p><p>15 ml / 0.50 fl. oz.</p>',
  },
  {
    id: 'mussa-medicube-pdrn-pink-peptide-serum',
    sku: 'MUSSA-MEDICUBE-PDRNSER',
    name: 'medicube PDRN Pink Peptide Serum',
    line: 'medicube',
    category: 'Sérums y tratamientos',
    file: 'Gemini_Generated_Image_guswfuguswfugusw.jpg',
    description: '<p><strong>medicube PDRN Pink Peptide Serum</strong>, con PDRN (Sodium DNA) 1% + complejo de 5 péptidos.</p><p>30 ml / 1.01 fl. oz.</p>',
  },
  {
    id: 'mussa-medicube-pdrn-pink-collagen-gel-mask',
    sku: 'MUSSA-MEDICUBE-PDRNMASK',
    name: 'medicube PDRN Pink Collagen Gel Mask',
    line: 'medicube',
    category: 'Mascarillas',
    file: 'Gemini_Generated_Image_jxg2g0jxg2g0jxg2 (2).jpg',
    description: '<p><strong>medicube PDRN Pink Collagen Gel Mask</strong>, mascarilla en gel con Sodium DNA, Niacinamide e Hydrolyzed Collagen.</p><p>28 g (1 unidad).</p>',
  },
  {
    id: 'mussa-mixsoon-collagen-glass-skin-mask',
    sku: 'MUSSA-MIXSOON-GLASSMASK',
    name: 'mixsoon Collagen Glass Skin Mask',
    line: 'mixsoon',
    category: 'Mascarillas',
    file: 'Gemini_Generated_Image_a4suaaa4suaaa4su.jpg',
    description: '<p><strong>mixsoon Collagen Glass Skin Mask</strong>, mascarilla peel-off con Hydrolysed Collagen, péptidos y Hyaluronic Acid.</p><p>80 ml / 2.70 fl. oz.</p>',
  },
  {
    id: 'mussa-mixsoon-centella-cleansing-foam',
    sku: 'MUSSA-MIXSOON-FOAM',
    name: 'mixsoon Centella Cleansing Foam',
    line: 'mixsoon',
    category: 'Limpiadores',
    file: 'Gemini_Generated_Image_s66g9ss66g9ss66g.jpg',
    description: '<p><strong>mixsoon Centella Cleansing Foam</strong>, limpiador facial suave.</p><p>150 ml / 5.07 fl. oz.</p>',
  },
  {
    id: 'mussa-celimax-jojoba-cleansing-oil',
    sku: 'MUSSA-CELIMAX-JOJOBA',
    name: 'celimax Derma Nature Fresh Blackhead Jojoba Cleansing Oil',
    line: 'celimax',
    category: 'Limpiadores',
    file: 'Gemini_Generated_Image_6ddkse6ddkse6ddk.jpg',
    description: '<p><strong>celimax Derma Nature Fresh Blackhead Jojoba Cleansing Oil</strong>, desmaquillante que disuelve puntos negros con aceite de jojoba.</p>',
  },
  {
    id: 'mussa-celimax-noni-toner',
    sku: 'MUSSA-CELIMAX-NONI',
    name: 'celimax Noni Toner',
    line: 'celimax',
    category: 'Tónicos',
    file: 'Gemini_Generated_Image_snsyl8snsyl8snsy.jpg',
    description: '<p><strong>celimax The Real Noni Moisture Balancing Toner</strong>, tónico equilibrante e hidratante.</p><p>150 ml.</p>',
  },
  {
    id: 'mussa-numbuzin-no9-eye-cream',
    sku: 'MUSSA-NUMBUZIN-NO9',
    name: 'numbuzin No.9 NAD+ Retinol Volumetox Eye Cream',
    line: 'numbuzin',
    category: 'Sérums y tratamientos',
    file: 'Gemini_Generated_Image_hjcs33hjcs33hjcs.jpg',
    description: '<p><strong>numbuzin No.9 Eye Cream</strong>, con NAD+ + Retinol + 50 péptidos.</p><p>10 ml / 0.33 fl. oz.</p>',
  },
  {
    id: 'mussa-jumiso-niacinamide-20-serum',
    sku: 'MUSSA-JUMISO-NIA20',
    name: 'JUMISO Niacinamide 20 Serum',
    line: 'JUMISO',
    category: 'Sérums y tratamientos',
    file: 'Gemini_Generated_Image_z7aa1uz7aa1uz7aa.jpg',
    description: '<p><strong>JUMISO Niacinamide 20 Serum</strong>, reduce manchas oscuras e hiperpigmentación.</p><p>40 ml / 1.35 fl. oz.</p>',
  },
  {
    id: 'mussa-beautyofjoseon-relief-sun-rice',
    sku: 'MUSSA-BOJ-RELIEFSUN',
    name: 'Beauty of Joseon Relief Sun: Rice + Probiotics SPF50+ PA++++',
    line: 'Beauty of Joseon',
    category: 'Protectores solares',
    file: 'Gemini_Generated_Image_zb7o2tzb7o2tzb7o.jpg',
    description: '<p><strong>Beauty of Joseon Relief Sun: Rice + Probiotics SPF50+ PA++++</strong>, protector solar con arroz y probióticos.</p>',
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
      const dest = `products/${p.id}/main.jpg`;
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

  // ── 5) Construir y escribir los 29 productos ────────────────────────────
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
    ? '✅ Listo. Revisa los 29 productos en el panel admin (precio S/79.90 y stock 4 son provisionales, ajústalos si hace falta).'
    : '(dry-run) Nada se escribió. Vuelve a correr con --confirm para crear todo esto de verdad.');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
