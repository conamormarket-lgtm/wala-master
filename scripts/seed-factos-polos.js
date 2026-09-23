/**
 * Catálogo Factos · Polos oversize
 * ────────────────────────────────────────────────────────────────────────────
 * Crea, en Firebase REAL (usa service account), los 9 polos Factos mapeados
 * desde las fotos en C:\Users\Isaac\Downloads\factos.
 *
 * Antes hay que correr `python scripts/prep-factos-polos.py`, que deja en
 * factos\webp\<slug>\ las fotos en WebP con sus copias 160/400/800 (lo mismo
 * que genera el admin al subir; aquí no hay sharp para Windows).
 *
 * Decisiones confirmadas con el dueño:
 *   - Marca: "Factos" — YA EXISTE en tienda_brands, se reusa.
 *   - Categoría: "Polos" — YA EXISTE y ya lista a Factos en brandIds.
 *   - Precio S/45, stock 4 TOTAL por polo, tallas S, M, L, XL.
 *   - Etiquetas: se reusan las de Factos (Humor, Frases, Disruptivo,
 *     Cultura de internet, Tendencias).
 *   - Colecciones nuevas: "Adicto a las…" (serie de gatitos) y "Calaveras"
 *     (parcas, esqueletos y figuras religiosas), ligadas a Factos.
 *   - `characters` vacío: no aplica.
 *   - Todos son negros: una sola variante "Negro". Principal = espalda (ahí
 *     va el diseño); galería = frente + foto de campaña.
 *   - Se agrega "Polos" a la barra de categorías de la marca Factos (hoy solo
 *     tiene "Poleras"), para que los polos aparezcan en su página.
 *
 * USO:
 *   node scripts/seed-factos-polos.js            (dry-run, no escribe)
 *   node scripts/seed-factos-polos.js --confirm   (escribe de verdad)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const IMAGES_DIR = 'C:\\Users\\Isaac\\Downloads\\factos\\webp';
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
      contentType: 'image/webp',
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

const PRICE = 45;
const STOCK = 4;
const SIZES = ['S', 'M', 'L', 'XL'];
const VISTAS = ['espalda', 'frente', 'campana']; // la primera es la principal
const ANCHOS_VARIANTE = [160, 400, 800];

const COL_ADICTO = 'Adicto a las…';
const COL_CALAVERAS = 'Calaveras';

const PIE = '<p>Polo oversize negro de Factos.pe. Tallas S, M, L y XL.</p>';

// ── Las 9 fichas ──────────────────────────────────────────────────────────
const PRODUCTS = [
  {
    slug: 'adicto', id: 'factos-polo-adicto-rosaditas', sku: 'FACTOS-ROSADITAS',
    name: 'Polo Adicto a las Rosaditas', collection: COL_ADICTO,
    tags: ['Humor', 'Frases', 'Disruptivo'],
    description: '<p><strong>Adicto a las Rosaditas.</strong> En la espalda, el gatito blanco con la lengua afuera; en el pecho, la lengüita con el logo de Factos.pe.</p>',
  },
  {
    slug: 'chola', id: 'factos-polo-adicto-cholas', sku: 'FACTOS-CHOLAS',
    name: 'Polo Adicto a las Cholas', collection: COL_ADICTO,
    tags: ['Humor', 'Frases', 'Disruptivo'],
    description: '<p><strong>Adicto a las Cholas.</strong> En la espalda, el gatito con chullo andino y letras a todo color; en el pecho, el logo de Factos.pe.</p>',
  },
  {
    slug: 'negras', id: 'factos-polo-adicto-negras', sku: 'FACTOS-NEGRAS',
    name: 'Polo Adicto a las Negras', collection: COL_ADICTO,
    tags: ['Humor', 'Frases', 'Disruptivo'],
    description: '<p><strong>Adicto a las Negras.</strong> En la espalda, el gatito marrón con cadena; en el pecho, el logo de Factos.pe.</p>',
  },
  {
    slug: 'dedo', id: 'factos-polo-groseria-cortesia', sku: 'FACTOS-CORTESIA',
    name: 'Polo Grosería o Cortesía', collection: COL_CALAVERAS,
    tags: ['Humor', 'Frases', 'Disruptivo'],
    description: '<p><strong>"Si sacarte el dedo es grosería, ¿meterlo es cortesía?"</strong> En la espalda, la parca con anillos de calavera; en el pecho, dos manos de esqueleto.</p>',
  },
  {
    slug: 'dificil', id: 'factos-polo-dificil-para-todas', sku: 'FACTOS-DIFICIL',
    name: 'Polo Difícil para Todas', collection: COL_CALAVERAS,
    tags: ['Humor', 'Frases', 'Tendencias'],
    description: '<p><strong>"Difícil para todas, fácil para las culonas."</strong> En la espalda, la parca rezando con rosario; en el pecho, una cruz con el logo de Factos.pe.</p>',
  },
  {
    slug: 'locus', id: 'factos-polo-solo-vine-a-ver', sku: 'FACTOS-SOLOVINE',
    name: 'Polo Solo Vine a Ver', collection: COL_CALAVERAS,
    tags: ['Humor', 'Frases', 'Cultura de internet'],
    description: '<p><strong>"Yo solo vine a ver cul*s."</strong> En la espalda, el esqueleto de terno bajándose los lentes; en el pecho, la mano roja con el logo de Factos.pe.</p>',
  },
  {
    slug: 'moises', id: 'factos-polo-yo-seria-moises', sku: 'FACTOS-MOISES',
    name: 'Polo Yo Sería Moisés', collection: COL_CALAVERAS,
    tags: ['Humor', 'Frases', 'Cultura de internet'],
    description: '<p><strong>"Si tus nalg*s fueran el mar, yo sería Moisés."</strong> En la espalda, el Moisés esqueleto con su bastón; en el pecho, una calavera con el logo de Factos.pe.</p>',
  },
  {
    slug: 'miguel', id: 'factos-polo-devoto-san-miguel', sku: 'FACTOS-SANMIGUEL',
    name: 'Polo Devoto a San Miguel', collection: COL_CALAVERAS,
    tags: ['Humor', 'Frases', 'Disruptivo'],
    description: '<p><strong>"Devoto a San Miguel Arcángel, porque también me gusta pisarle la cabeza a las diablas."</strong> En la espalda, San Miguel con su espada; en el pecho, un diablito con el logo de Factos.pe.</p>',
  },
  {
    slug: 'perro', id: 'factos-polo-lobo-de-la-manada', sku: 'FACTOS-LOBO',
    name: 'Polo Lobo de la Manada', collection: COL_CALAVERAS,
    tags: ['Humor', 'Frases', 'Tendencias'],
    description: '<p><strong>"Pa la manada mi sonrisa, pa las lobas mi longaniza."</strong> En la espalda, el hombre lobo bajo la luna llena; en el pecho, "Cuidado con el perro, pitote que me cargo".</p>',
  },
];

const TAG_NAMES = Array.from(new Set(PRODUCTS.flatMap((p) => p.tags)));
const COLLECTION_NAMES = Array.from(new Set(PRODUCTS.map((p) => p.collection)));

async function main() {
  console.log(CONFIRMED ? '→ Escribiendo en Firebase REAL (sistema-gestion-3b225)...' : '→ DRY-RUN (no escribe nada; usa --confirm para aplicar)');
  console.log('');

  // ── 0) Revisar que estén todas las fotos preparadas ─────────────────────
  for (const p of PRODUCTS) {
    for (const vista of VISTAS) {
      for (const suf of ['', ...ANCHOS_VARIANTE.map((a) => `_${a}`)]) {
        const f = path.join(IMAGES_DIR, p.slug, `${vista}${suf}.webp`);
        if (!fs.existsSync(f)) throw new Error(`Falta ${f}. Corre antes: python scripts/prep-factos-polos.py`);
      }
    }
  }
  console.log('✓ Las 27 fotos (con sus copias 160/400/800) están listas');

  // ── 1) Marca y categoría (deben existir ya) ─────────────────────────────
  const brand = await findByName('tienda_brands', 'Factos');
  if (!brand) throw new Error('No se encontró la marca "Factos".');
  console.log(`✓ Marca "Factos" → ${brand.id}`);

  const catPolos = await findByName('tienda_categories', 'Polos');
  if (!catPolos) throw new Error('No se encontró la categoría "Polos".');
  console.log(`✓ Categoría "Polos" → ${catPolos.id}`);

  // ── 2) Etiquetas (deben existir ya) ─────────────────────────────────────
  const tagIds = {};
  for (const name of TAG_NAMES) {
    const tag = await findByName('tags', name);
    if (!tag) throw new Error(`No se encontró la etiqueta "${name}".`);
    tagIds[name] = tag.id;
    console.log(`✓ Etiqueta "${name}" → ${tag.id}`);
  }

  // ── 3) Colecciones: reusar si existen, crear si faltan ──────────────────
  const collectionIds = {};
  const colsSnap = await db.collection('tienda_collections').get();
  let maxOrder = colsSnap.docs.reduce((m, d) => Math.max(m, Number(d.data().order) || 0), 0);
  for (const name of COLLECTION_NAMES) {
    let col = await findByName('tienda_collections', name);
    if (col) {
      console.log(`✓ Colección "${name}" → ${col.id} (ya existía)`);
    } else {
      console.log(`  + Colección "${name}" no existe, se crea (ligada a Factos).`);
      if (CONFIRMED) {
        maxOrder += 1;
        const ref = await db.collection('tienda_collections').add({
          name,
          imageUrl: '',
          order: maxOrder,
          brandIds: [brand.id],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        col = { id: ref.id };
      } else {
        col = { id: '(nueva-tras---confirm)' };
      }
    }
    collectionIds[name] = col.id;
  }

  // ── 4) "Polos" en la barra de categorías de Factos ──────────────────────
  const nav = Array.isArray(brand.categoryNav) ? brand.categoryNav : [];
  if (nav.some((c) => c.categoryId === catPolos.id)) {
    console.log('✓ "Polos" ya está en la barra de categorías de Factos');
  } else {
    console.log('  + Se agrega "Polos" a la barra de categorías de Factos');
    if (CONFIRMED) {
      const order = nav.reduce((m, c) => Math.max(m, Number(c.order) || 0), -1) + 1;
      await db.collection('tienda_brands').doc(brand.id).update({
        categoryNav: [...nav, { categoryId: catPolos.id, name: 'Polos', imageUrl: '', order }],
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  console.log('');

  // ── 5) Subir fotos y escribir los 9 polos ───────────────────────────────
  console.log('→ Polos a crear/actualizar:');
  for (const p of PRODUCTS) {
    const urls = {};
    const imagesVariantes = {};
    for (const vista of VISTAS) {
      const base = `products/${p.id}/${vista}`;
      if (CONFIRMED) {
        urls[vista] = await uploadImage(path.join(IMAGES_DIR, p.slug, `${vista}.webp`), `${base}.webp`);
        const copias = {};
        for (const ancho of ANCHOS_VARIANTE) {
          copias[ancho] = await uploadImage(path.join(IMAGES_DIR, p.slug, `${vista}_${ancho}.webp`), `${base}_${ancho}.webp`);
        }
        imagesVariantes[urls[vista]] = copias;
      } else {
        urls[vista] = `(url-tras---confirm)/${base}.webp`;
      }
    }

    const principal = urls[VISTAS[0]];
    const galeria = VISTAS.slice(1).map((v) => urls[v]);
    const payload = {
      name: p.name,
      sku: p.sku,
      description: p.description + PIE,
      categories: [catPolos.id],
      collections: [collectionIds[p.collection]],
      tags: p.tags.map((t) => tagIds[t]),
      characters: [],
      vendors: [],
      productType: '',
      brandId: brand.id,
      vendorId: 'casa',
      nicheId: 'regala-con-amor',
      fulfillmentType: 'stock',
      price: PRICE,
      salePrice: null,
      inStock: STOCK,
      customizable: false,
      hasVariants: true,
      mainImage: '',
      mainSizes: [],
      images: [principal],
      imagesByColor: { Negro: [principal] },
      variants: [{
        id: 'negro',
        name: 'Negro',
        colorHex: '#101010',
        imageUrl: principal,
        sizes: SIZES,
        images: galeria,
        galleryImages: galeria,
        thumbnailCrop: null,
        imagesCrops: {},
        imagesVariantes,
      }],
      defaultVariantId: 'negro',
      variantDisplayBehavior: 'default_only',
      behaviorImpressionsThreshold: 3,
      customizationViews: [],
      productCliparts: [],
      featured: false,
      featuredOrder: 0,
      visible: true,
      isComboProduct: false,
      comboPreviewImage: '',
      thumbnailWithDesignUrl: '',
      whatsappEnabled: true,
      whatsappNumber: '',
      whatsappMessage: '',
    };
    payload.nameLower = normalizeSearchText(payload.name);
    payload.searchTokens = buildSearchTokens(payload.name, payload.brandId, payload.productType);

    console.log(`  - ${p.id}  "${p.name}"  S/${PRICE}  stock=${STOCK}  tallas=${SIZES.join('/')}  col="${p.collection}"  tags=${p.tags.join(', ')}`);

    if (CONFIRMED) {
      const now = FieldValue.serverTimestamp();
      await db.collection('productos_wala').doc(p.id).set({ ...payload, createdAt: now, createdAtMs: Date.now(), updatedAt: now });
    }
  }

  console.log('');
  console.log(CONFIRMED
    ? '✅ Listo. Los 9 polos Factos están en el panel admin.'
    : '(dry-run) Nada se escribió. Vuelve a correr con --confirm para crear todo esto de verdad.');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
