/**
 * Yoryo · esclava oculta + 3 combos (reloj + esclava + billetera)
 * ────────────────────────────────────────────────────────────────────────────
 * Mismo patrón que scripts/seed-parejas-conjuntos.js: la pieza que no se vende
 * suelta se crea como producto NORMAL pero OCULTO (visible:false) y el combo
 * la referencia por comboItems[].productId. Así la esclava solo se ve dentro
 * del combo y nunca aparece en el catálogo.
 *
 * Las 3 combinaciones salen de las fotos que mandó el dueño:
 *   1. Magnate "Acero Ónix"          + esclava + Billetera "Negro Azabache"
 *   2. Magnate "Oro Imperial"        + esclava + Billetera "Marrón Coñac"
 *   3. Monarca "Oro Rosa Medianoche" + esclava + Billetera "Deep Blue"
 *
 * Precio (regla del dueño: −20 por producto, −10 la billetera), con la lista
 * nueva de precios y la esclava a S/50:
 *       reloj    120 − 20 = 100
 *     + esclava   50 − 20 =  30
 *     + billetera  90 − 10 =  80
 *                          ─────
 *                    total   210   (se ahorra S/50 frente a comprarlos sueltos)
 *
 * Portada: NO se usan las fotos que mandó el dueño porque son capturas del
 * chat (la menor, 428x315) y se verían borrosas en la tarjeta. Se deja
 * comboPreviewImage vacío y ComboProductImage arma el collage con las fotos en
 * alta de cada pieza (soporta hasta 3, ver su .slice(0, 3)). Si más adelante
 * llegan fotos reales del set, basta con rellenar comboPreviewImage.
 *
 * USO:
 *   node scripts/seed-yoryo-combos.js            (dry-run)
 *   node scripts/seed-yoryo-combos.js --confirm   (escribe)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const CONFIRMED = process.argv.includes('--confirm');

const SCRATCH = 'C:\\Users\\Isaac\\AppData\\Local\\Temp\\claude\\C--Users-Isaac-Desktop-wala-master\\a67bb9b0-aeb6-4bfa-be5c-832a751029c5\\scratchpad';
const CROPS = path.join(SCRATCH, 'crops');
const SHARP_PATH = 'C:\\Users\\Isaac\\AppData\\Local\\Temp\\claude\\C--Users-Isaac-Desktop-wala-master\\a4d85752-9071-4cd1-87ab-4878e8761066\\scratchpad\\node_modules\\sharp';
const sharp = require(SHARP_PATH);
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
const TIPO_ACCESORIO = 'rffUNjWeEeqrw1CCzIRN';
const TIPO_COMBO = 'N2rTN3na2tb7LrZqL8E9';
const COLECCION_LUJO = 'OtqZTlqk7ZEFMMebTtkF';
const TAG_PARA_REGALAR = 'Mq0pd8fbDEi319lis7Mj';
const TAG_RELOJ = 'igb9nsYeBSupAhKTERSr';
const TAG_BILLETERA = '0HqKLuQ6bi0fszscs8rm';
const TAG_JOYAS = 'Pn4HA4LxtPFI9XLKRE5s';
const DEFAULT_VENDOR_ID = 'casa';
const DEFAULT_NICHE_ID = 'regala-con-amor';
const STOCK = 4;

const ID_MAGNATE = 'foF1l7x33v3zFmRs2CVG';
const ID_MONARCA = 'BrSFBNeep6FXODg4Pqyp';
const ID_BILLETERA = 'NEtavILSA0EoxJgGD7ou';
const ID_SET_ALIANZA = 'NubeDxyOrTMwZDnjmrUL';

const PRECIO_ESCLAVA = 50;
const PRECIO_COMBO = 210;

// ── Búsqueda — copiado de src/services/products.js ─────────────────────────
const MAX_SEARCH_TOKENS = 60, MIN_TOKEN_LEN = 2, MAX_PREFIX_LEN = 12;
const normalizeSearchText = (s) => String(s == null ? '' : s)
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
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
    const b = await sharp(local).resize({ width: ancho, height: Math.round(ancho * proporcion) })
      .webp({ quality: CALIDAD }).toBuffer();
    variantes[ancho] = await subirBuffer(b, rutaDeVariante(destPathBase, ancho));
  }
  console.log(`      · ${nombreCrop} → ${w}x${h} webp + ${Object.keys(variantes).length} copias`);
  return { url, variantes };
}

/** Busca una variante por nombre dentro de un producto ya publicado. */
function variantePorNombre(prod, nombre, etiqueta) {
  const v = (prod.variants || []).find((x) => x.name === nombre);
  if (!v) {
    throw new Error(`${etiqueta}: no existe la variante "${nombre}". Hay: ${(prod.variants || []).map((x) => x.name).join(', ')}`);
  }
  return v;
}

const P = (s) => `<p>${s}</p>`;

(async () => {
  console.log(CONFIRMED ? '🚀 ESCRIBIENDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para escribir\n');

  // ── 0. Set Alianza al precio confirmado ─────────────────────────────────
  const refAlianza = db.collection(COLLECTION).doc(ID_SET_ALIANZA);
  const alianza = (await refAlianza.get()).data();
  console.log(`▶ Set Alianza: S/${alianza.price}${alianza.salePrice ? ` → S/${alianza.salePrice}` : ''}  ⇒  S/240 (sin oferta)`);
  if (CONFIRMED) {
    await refAlianza.update({ price: 240, salePrice: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log('   ✅ actualizado');
  }

  // ── 1. Piezas que ya existen ────────────────────────────────────────────
  const magnate = (await db.collection(COLLECTION).doc(ID_MAGNATE).get()).data();
  const monarca = (await db.collection(COLLECTION).doc(ID_MONARCA).get()).data();
  const billetera = (await db.collection(COLLECTION).doc(ID_BILLETERA).get()).data();

  // ── 2. La esclava: producto OCULTO ──────────────────────────────────────
  console.log('\n▶ Esclava (producto oculto, no sale en el catálogo)');
  const yaEsclava = await db.collection(COLLECTION)
    .where('brandId', '==', BRAND_ID).where('sku', '==', 'YRY-ESC-TRZ').get();

  let esclavaId, esclavaUrl;
  if (!yaEsclava.empty) {
    esclavaId = yaEsclava.docs[0].id;
    esclavaUrl = yaEsclava.docs[0].data().variants[0].imageUrl;
    console.log(`   ya existe (${esclavaId}) — la reutilizo`);
  } else {
    const ts = Date.now();
    const variantId = `variant_${ts}_esc_0`;
    const foto = await subirFoto('ESCLAVA', `productos_v2/yoryo-esclava/main_${variantId}_${ts}_esclava.jpg`);
    esclavaUrl = foto.url;
    const imagesVariantes = {};
    if (Object.keys(foto.variantes).length) imagesVariantes[foto.url] = foto.variantes;

    const variants = [{
      id: variantId, name: 'Negro Acero', imageUrl: foto.url,
      sizes: [], images: [], galleryImages: [],
      thumbnailCrop: null, imagesCrops: {}, imagesVariantes,
      colorHex: '#1A1A1A',
    }];

    const doc = {
      name: 'Esclava Yoryo de Cuero Trenzado',
      nameLower: normalizeSearchText('Esclava Yoryo de Cuero Trenzado'),
      searchTokens: buildSearchTokens('Esclava Yoryo de Cuero Trenzado', BRAND_ID, TIPO_ACCESORIO),
      categories: [CATEGORY_ID], collections: [], tags: [TAG_JOYAS], characters: [], vendors: [],
      sku: 'YRY-ESC-TRZ',
      whatsappEnabled: true, whatsappNumber: '', whatsappMessage: '',
      productType: TIPO_ACCESORIO, brandId: BRAND_ID,
      vendorId: DEFAULT_VENDOR_ID, nicheId: DEFAULT_NICHE_ID, fulfillmentType: 'stock',
      price: PRECIO_ESCLAVA, salePrice: null,
      images: [foto.url], imagesByColor: { 'Negro Acero': [foto.url] },
      description: P('Esclava de cuero trenzado negro con placa de acero pulido. Se vende dentro de los combos Yoryo.'),
      inStock: STOCK, customizable: false, hasVariants: true,
      mainImage: '', mainSizes: [], variants, defaultVariantId: variantId,
      variantDisplayBehavior: 'default_only', behaviorImpressionsThreshold: 3,
      customizationViews: [], productCliparts: [],
      featured: false, featuredOrder: 0,
      // Clave: oculta. Solo existe para alimentar los combos.
      visible: false,
      isComboProduct: false, comboPreviewImage: '', thumbnailWithDesignUrl: '',
      isV2: true,
    };

    console.log(`   S/${PRECIO_ESCLAVA} · visible:false · stock ${STOCK}`);
    if (CONFIRMED) {
      const ref = await db.collection(COLLECTION).add({
        ...doc,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAtMs: Date.now(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      esclavaId = ref.id;
      console.log(`   ✅ ${esclavaId}`);
    } else {
      esclavaId = '(dry-run)';
    }
  }

  // ── 3. Los 3 combos ─────────────────────────────────────────────────────
  const COMBOS = [
    {
      sku: 'YRY-COMBO-ONIX', name: 'Combo Yoryo Ónix · Reloj, Esclava y Billetera',
      reloj: { prod: magnate, id: ID_MAGNATE, variante: 'Acero Ónix', etiqueta: 'Reloj Magnate' },
      billeteraVariante: 'Negro Azabache',
      resumen: 'reloj de acero con esfera negra, esclava de cuero y billetera negra',
    },
    {
      sku: 'YRY-COMBO-ORO', name: 'Combo Yoryo Oro · Reloj, Esclava y Billetera',
      reloj: { prod: magnate, id: ID_MAGNATE, variante: 'Oro Imperial', etiqueta: 'Reloj Magnate' },
      billeteraVariante: 'Marrón Coñac',
      resumen: 'reloj bicolor acero y oro, esclava de cuero y billetera marrón',
    },
    {
      sku: 'YRY-COMBO-NOCHE', name: 'Combo Yoryo Medianoche · Reloj, Esclava y Billetera',
      reloj: { prod: monarca, id: ID_MONARCA, variante: 'Oro Rosa Medianoche', etiqueta: 'Reloj Monarca' },
      billeteraVariante: 'Deep Blue',
      resumen: 'reloj cuadrado de esfera azul con caja oro rosa, esclava de cuero y billetera azul',
    },
  ];

  for (const c of COMBOS) {
    console.log(`\n▶ ${c.name}`);
    const yaHay = await db.collection(COLLECTION)
      .where('brandId', '==', BRAND_ID).where('sku', '==', c.sku).get();
    if (!yaHay.empty) { console.error(`   ❌ ya existe (${yaHay.docs[0].id}) — lo salto`); continue; }

    const vReloj = variantePorNombre(c.reloj.prod, c.reloj.variante, c.reloj.etiqueta);
    const vBill = variantePorNombre(billetera, c.billeteraVariante, 'Billetera Cónsul');

    const comboItems = [
      {
        productId: c.reloj.id, name: c.reloj.prod.name, imageUrl: vReloj.imageUrl,
        viewId: 'default', position: 0, scale: 1, customizable: false,
        variantMapping: { color: c.reloj.variante },
      },
      {
        productId: esclavaId, name: 'Esclava Yoryo de Cuero Trenzado', imageUrl: esclavaUrl,
        viewId: 'default', position: 1, scale: 1, customizable: false,
        variantMapping: { color: 'Negro Acero' },
      },
      {
        productId: ID_BILLETERA, name: billetera.name, imageUrl: vBill.imageUrl,
        viewId: 'default', position: 2, scale: 1, customizable: false,
        variantMapping: { color: c.billeteraVariante },
      },
    ];

    const doc = {
      name: c.name,
      nameLower: normalizeSearchText(c.name),
      searchTokens: buildSearchTokens(c.name, BRAND_ID, TIPO_COMBO),
      categories: [CATEGORY_ID], collections: [COLECCION_LUJO],
      tags: [TAG_PARA_REGALAR, TAG_RELOJ, TAG_BILLETERA], characters: [], vendors: [],
      sku: c.sku,
      whatsappEnabled: true, whatsappNumber: '', whatsappMessage: '',
      productType: TIPO_COMBO, brandId: BRAND_ID,
      vendorId: DEFAULT_VENDOR_ID, nicheId: DEFAULT_NICHE_ID, fulfillmentType: 'stock',
      price: PRECIO_COMBO, salePrice: null,
      description:
        P(`Tres piezas que se llevan juntas: ${c.resumen}.`) +
        P('Comprados por separado suman S/260. En el combo se van en S/210.'),
      inStock: STOCK, customizable: false,
      hasVariants: false, mainImage: '', mainSizes: [],
      variants: [], defaultVariantId: '',
      variantDisplayBehavior: 'default_only', behaviorImpressionsThreshold: 3,
      customizationViews: [], productCliparts: [],
      featured: false, featuredOrder: 0,
      visible: true,
      isComboProduct: true,
      comboLayout: { orientation: 'horizontal', spacing: 20 },
      comboItems,
      // Vacío a propósito: ComboProductImage arma el collage con las 3 fotos.
      comboPreviewImage: '',
      thumbnailWithDesignUrl: '',
      images: [vReloj.imageUrl].filter(Boolean),
      imagesByColor: {},
      isV2: true,
    };

    console.log(`   S/${PRECIO_COMBO} · ${comboItems.length} piezas:`);
    comboItems.forEach((i) => console.log(`      - ${i.name} (${i.variantMapping.color})`));

    if (CONFIRMED) {
      const ref = await db.collection(COLLECTION).add({
        ...doc,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAtMs: Date.now(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`   ✅ ${ref.id}`);
    }
  }

  console.log(CONFIRMED ? '\n🎉 Listo.' : '\n🧪 Dry-run terminado, nada se escribió.');
  process.exit(0);
})().catch((e) => { console.error('\n❌ Falló:', e.message); process.exit(1); });
