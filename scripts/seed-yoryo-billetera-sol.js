/**
 * Yoryo · billetera y lentes de sol (2 productos nuevos)
 * ────────────────────────────────────────────────────────────────────────────
 * Cierra la segunda tanda de fotos con los dos productos que faltaban, ya
 * confirmados por el dueño:
 *
 *   B1  Billetera Yoryo Cónsul      — UNA sola billetera, no dos: las 4 fotos
 *                                     de "FONDO BLANCO" son del mismo producto
 *                                     (cerrada, abierta x2 y el tarjetero
 *                                     metálico). Portada: la cerrada.
 *   LS1 Lentes de Sol Yoryo Obsidiana — el cristal negro va como producto
 *                                     aparte y no como variante del Diamante:
 *                                     su canto es liso, sin las facetas
 *                                     talladas que definen a aquel.
 *
 * Mismos campos que el resto del catálogo Yoryo (ver seed-yoryo-relojes-lentes):
 * marca Yoryo, categoría "Relojes y accesorios", tipo "Accesorio", colección
 * "Yoryo Lujo", cumplimiento en stock, 4 unidades, visibles.
 *
 * Las fotos de la billetera son de estudio en fondo blanco, a diferencia del
 * resto del catálogo (madera + estuche). Se suben así a propósito: es lo que
 * hay, y el dueño está al tanto de que desentonan en la parrilla.
 *
 * Imágenes: mismo pipeline que el seed (WebP 0.82, máx 2000 px, copias de
 * 160/400/800 y mapa imagesVariantes por URL).
 *
 * USO:
 *   node scripts/seed-yoryo-billetera-sol.js            (dry-run)
 *   node scripts/seed-yoryo-billetera-sol.js --confirm   (escribe)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const CONFIRMED = process.argv.includes('--confirm');

const SCRATCH = 'C:\\Users\\Isaac\\AppData\\Local\\Temp\\claude\\C--Users-Isaac-Desktop-wala-master\\a4d85752-9071-4cd1-87ab-4878e8761066\\scratchpad';
const CROPS = path.join(SCRATCH, 'crops2');
const sharp = require(path.join(SCRATCH, 'node_modules', 'sharp'));
const admin = require(require.resolve('firebase-admin', { paths: [fnModules] }));

const sa = JSON.parse(fs.readFileSync(path.join(ROOT, 'serviceAccountKey.json'), 'utf8'));
const BUCKET_NAME = 'sistema-gestion-3b225.firebasestorage.app';
admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: sa.project_id,
  storageBucket: BUCKET_NAME,
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

const COLLECTION = 'productos_wala';
const BRAND_ID = 'rEPEpl4Hvzi6ogOBHn7x';
const CATEGORY_ID = 'accesorios';
const PRODUCT_TYPE_ID = 'rffUNjWeEeqrw1CCzIRN';
const COLLECTION_ID = 'OtqZTlqk7ZEFMMebTtkF';   // Yoryo Lujo
const DEFAULT_VENDOR_ID = 'casa';
const DEFAULT_NICHE_ID = 'regala-con-amor';
const STOCK = 4;

// ── Búsqueda — copiado literal de src/services/products.js ─────────────────
const MAX_SEARCH_TOKENS = 60, MIN_TOKEN_LEN = 2, MAX_PREFIX_LEN = 12;
const normalizeSearchText = (s) => String(s == null ? '' : s)
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ').trim();
function buildSearchTokens(...parts) {
  const text = parts.map(normalizeSearchText).filter(Boolean).join(' ');
  if (!text) return [];
  const words = Array.from(new Set(text.split(' ').filter((w) => w.length >= MIN_TOKEN_LEN)));
  const tokens = new Set();
  for (const w of words) {
    const upper = Math.min(w.length, MAX_PREFIX_LEN);
    for (let len = MIN_TOKEN_LEN; len <= upper; len++) tokens.add(w.slice(0, len));
    if (w.length > MAX_PREFIX_LEN) tokens.add(w);
    if (tokens.size >= MAX_SEARCH_TOKENS) break;
  }
  return Array.from(tokens).slice(0, MAX_SEARCH_TOKENS);
}

// ── Imagen ─────────────────────────────────────────────────────────────────
const MAX_LADO = 2000, ANCHOS_VARIANTE = [160, 400, 800], CALIDAD = 82;
const rutaDeVariante = (p, a) => p.replace(/\.[^./]+$/, '') + `_${a}.webp`;

async function subirBuffer(buffer, destPath) {
  const token = crypto.randomUUID();
  await bucket.file(destPath).save(buffer, {
    resumable: false,
    metadata: {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(destPath)}?alt=media&token=${token}`;
}

async function subirFoto(nombreCrop, destPathBase) {
  const local = path.join(CROPS, `${nombreCrop}.jpg`);
  if (!fs.existsSync(local)) throw new Error(`falta el recorte ${nombreCrop}.jpg`);
  const meta = await sharp(local).metadata();
  const escala = Math.min(1, MAX_LADO / Math.max(meta.width, meta.height));
  const w = Math.round(meta.width * escala), h = Math.round(meta.height * escala);
  const proporcion = meta.height / meta.width;
  const principalPath = destPathBase.replace(/\.[^./]+$/, '') + '.webp';

  if (!CONFIRMED) {
    console.log(`      · ${nombreCrop} → ${w}x${h} webp + ${ANCHOS_VARIANTE.filter((a) => a < w).length} copias`);
    return { url: `(dry-run) ${principalPath}`, variantes: {} };
  }

  const buf = await sharp(local).resize({ width: w, height: h }).webp({ quality: CALIDAD }).toBuffer();
  const url = await subirBuffer(buf, principalPath);
  const variantes = {};
  for (const ancho of ANCHOS_VARIANTE) {
    if (ancho >= w) continue;
    try {
      const b = await sharp(local).resize({ width: ancho, height: Math.round(ancho * proporcion) })
        .webp({ quality: CALIDAD }).toBuffer();
      variantes[ancho] = await subirBuffer(b, rutaDeVariante(destPathBase, ancho));
    } catch (e) { console.warn(`      ⚠ copia ${ancho}px falló: ${e.message}`); }
  }
  console.log(`      · ${nombreCrop} → ${w}x${h} webp + ${Object.keys(variantes).length} copias`);
  return { url, variantes };
}

// ── Catálogo ───────────────────────────────────────────────────────────────
const P = (s) => `<p>${s}</p>`;

const PRODUCTOS = [
  {
    key: 'B1', draft: 'yoryo-b1',
    name: 'Billetera Yoryo Cónsul', sku: 'YRY-BIL-CON',
    price: 109, salePrice: 89,
    // "Billetera" y "Para regalar" ya existían; no se inventan etiquetas.
    tags: ['0HqKLuQ6bi0fszscs8rm', 'Mq0pd8fbDEi319lis7Mj'],
    description:
      P('Billetera de cuero azul marino que se abre en tres, con tarjetero metálico deslizante, cremallera para monedas y ventana para el documento.') +
      P('Perfil delgado: entra en el bolsillo sin deformar el saco.'),
    variants: [
      { name: 'Azul Marino', colorHex: '#1B2A4A', main: 'BIL_3', gallery: ['BIL_1', 'BIL_2', 'BIL_4'] },
    ],
  },
  {
    key: 'LS1', draft: 'yoryo-ls1',
    name: 'Lentes de Sol Yoryo Obsidiana', sku: 'YRY-SOL-OBS',
    price: 129, salePrice: 99,
    tags: [null /* Lentes: se resuelve por nombre abajo */, 'Mq0pd8fbDEi319lis7Mj'],
    tagsPorNombre: ['Lentes'],
    description:
      P('Montura al aire en dorado con filigrana labrada en las varillas y cristal negro de sol. Sin marco: todo el peso se lo lleva el cristal, no la cara.') +
      P('Incluye estuche rígido Yoryo.'),
    variants: [
      { name: 'Negro Obsidiana', colorHex: '#111111', main: 'LSOL_negro', gallery: [] },
    ],
  },
];

(async () => {
  console.log(CONFIRMED ? '🚀 SUBIENDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para subir\n');

  // Resolver por nombre las etiquetas que hagan falta (evita ids a ciegas).
  const tagsSnap = await db.collection('tags').get();
  const tagPorNombre = new Map();
  tagsSnap.forEach((d) => tagPorNombre.set(String(d.data().name || '').trim().toLowerCase(), d.id));

  for (const prod of PRODUCTOS) {
    // Guardarraíl: no duplicar si ya existe uno con ese SKU.
    const yaHay = await db.collection(COLLECTION)
      .where('brandId', '==', BRAND_ID).where('sku', '==', prod.sku).get();
    if (!yaHay.empty) {
      console.error(`❌ Ya existe ${prod.sku} (${yaHay.docs[0].id}) — lo salto para no duplicar.`);
      continue;
    }

    const tags = (prod.tags || []).filter(Boolean);
    for (const nombre of (prod.tagsPorNombre || [])) {
      const id = tagPorNombre.get(nombre.toLowerCase());
      if (id) tags.push(id);
      else console.warn(`   ⚠ no existe la etiqueta "${nombre}", se omite`);
    }

    console.log(`\n▶ ${prod.key} · ${prod.name}  (S/${prod.price} → S/${prod.salePrice})`);
    const ts = Date.now();
    const cache = new Map();
    const subirUnaVez = async (n, dest) => {
      if (!cache.has(n)) cache.set(n, await subirFoto(n, dest));
      return cache.get(n);
    };

    const variants = [];
    for (let i = 0; i < prod.variants.length; i++) {
      const v = prod.variants[i];
      const variantId = `variant_${ts}_${prod.key.toLowerCase()}_${i}`;
      const imagesVariantes = {};

      const principal = await subirUnaVez(v.main, `productos_v2/${prod.draft}/main_${variantId}_${ts}_${v.main}.jpg`);
      if (Object.keys(principal.variantes).length) imagesVariantes[principal.url] = principal.variantes;

      const images = [];
      for (const g of v.gallery) {
        const foto = await subirUnaVez(g, `productos_v2/${prod.draft}/gallery_${ts}_${g}.jpg`);
        images.push(foto.url);
        if (Object.keys(foto.variantes).length) imagesVariantes[foto.url] = foto.variantes;
      }

      variants.push({
        id: variantId, name: v.name, imageUrl: principal.url,
        sizes: [], images, galleryImages: images,
        thumbnailCrop: null, imagesCrops: {}, imagesVariantes,
        colorHex: v.colorHex,
      });
    }

    const imagesByColor = {};
    variants.forEach((v) => { if (v.imageUrl) imagesByColor[v.name] = [v.imageUrl]; });

    const doc = {
      name: prod.name,
      nameLower: normalizeSearchText(prod.name),
      searchTokens: buildSearchTokens(prod.name, BRAND_ID, PRODUCT_TYPE_ID),
      categories: [CATEGORY_ID],
      collections: [COLLECTION_ID],
      tags,
      characters: [],
      vendors: [],
      sku: prod.sku,
      whatsappEnabled: true, whatsappNumber: '', whatsappMessage: '',
      productType: PRODUCT_TYPE_ID,
      brandId: BRAND_ID,
      vendorId: DEFAULT_VENDOR_ID,
      nicheId: DEFAULT_NICHE_ID,
      fulfillmentType: 'stock',
      price: prod.price,
      salePrice: prod.salePrice < prod.price ? prod.salePrice : null,
      images: [variants[0].imageUrl].filter(Boolean),
      imagesByColor,
      description: prod.description,
      inStock: STOCK,
      customizable: false,
      hasVariants: true,
      mainImage: '', mainSizes: [],
      variants,
      defaultVariantId: variants[0].id,
      variantDisplayBehavior: 'default_only',
      behaviorImpressionsThreshold: 3,
      customizationViews: [], productCliparts: [],
      featured: false, featuredOrder: 0,
      visible: true,
      isComboProduct: false,
      comboPreviewImage: '', thumbnailWithDesignUrl: '',
      isV2: true,
    };

    console.log(`   → ${variants.length} variante(s), ${variants.reduce((n, v) => n + 1 + v.images.length, 0)} fotos, ${tags.length} etiquetas`);

    if (!CONFIRMED) continue;

    const ref = await db.collection(COLLECTION).add({
      ...doc,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`   ✅ ${ref.id}`);
  }

  console.log(CONFIRMED ? '\n🎉 Listo.' : '\n🧪 Dry-run terminado, nada se escribió.');
  process.exit(0);
})().catch((e) => {
  console.error('\n❌ Falló:', e.message);
  process.exit(1);
});
