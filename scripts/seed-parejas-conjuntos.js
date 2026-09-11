/**
 * Conjuntos de pareja (poleras/hoodies) · marca "Con Amor Parejas"
 * ────────────────────────────────────────────────────────────────────────────
 * Crea, en Firebase REAL (usa service account), 23 "conjuntos pareja": cada
 * conjunto = 1 producto COMBO visible (isComboProduct:true) que bundlea 2
 * prendas ("Él" + "Ella") — mismo patrón EXACTO que el combo Universitario
 * (scripts/seed-universitario-conjunto.js): las 2 prendas se crean como
 * productos individuales pero OCULTOS (visible:false, no se venden sueltos —
 * a diferencia de las casacas normales, aquí solo se vende el conjunto), y el
 * combo las referencia vía comboItems[].productId.
 *
 * Imágenes en C:\Users\Isaac\Downloads\POLERA PAREJAS-20260911T143759Z-1-001\POLERA PAREJAS
 * — cada foto original trae a Él y a Ella lado a lado; se recortaron en
 * scripts/../scratchpad (crop_parejas.py, sesión de trabajo) en mitad
 * izquierda/derecha por producto.
 *
 * Decisiones confirmadas con el dueño (no inventadas):
 *   - Marca: "Con Amor Parejas" (ya existe).
 *   - Categoría: "Casacas" (misma que usan las casacas normales — es la
 *     categoría real de hoodies en este catálogo, aunque el nombre diga
 *     "Casacas").
 *   - Precio: S/188 fijo, SIN oferta (salePrice null), en los 23 conjuntos.
 *   - Stock: 4 conjuntos cada uno.
 *   - Tallas: S, M, L, XL (sin XXL, a diferencia de las casacas normales).
 *   - Colores: los mismos 9 que ya usan las casacas normales (Blanco, Negro,
 *     Perla, Melange, Azul Acero, Guinda, Naranja, Rosado, Celeste) — mismo
 *     patrón que Alianza Lima: se listan los 9 como opción, pero solo la
 *     variante que coincide con la foto real queda con imageUrl.
 *   - 6 de los 23 diseños (Stitch & Angel x2, Snoopy x2, Pitufos, Spider-Man
 *     mini) son fotos de un pedido personalizado real (nombres "ROUS"/"YORYO"
 *     y fechas quemados en la imagen) — el dueño confirmó subirlas TAL CUAL
 *     como referencia, sin armar personalización todavía; luego reemplaza la
 *     imagen por una en blanco.
 *   - characters/tags: solo se reusan los que YA EXISTEN en el catálogo
 *     (Spider-Man, Dragon Ball, "stitch y angela", personaje Goku) — no se
 *     inventan etiquetas nuevas de IPs (Mario, Snoopy, Pitufos, etc.) esta vez.
 *
 * USO:
 *   node scripts/seed-parejas-conjuntos.js            (dry-run, no escribe)
 *   node scripts/seed-parejas-conjuntos.js --confirm   (escribe de verdad)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const CROPS_DIR = path.join(
  'C:\\Users\\Isaac\\AppData\\Local\\Temp\\claude\\C--Users-Isaac-Desktop-wala-master',
  '26983650-f590-4403-8909-c11361bd564a', 'scratchpad', 'parejas_crops'
);
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

// ── Normalización de búsqueda — copiada literal (IDÉNTICA a src/services/products.js) ──
const MAX_SEARCH_TOKENS = 60;
const MIN_TOKEN_LEN = 2;
const MAX_PREFIX_LEN = 12;
function normalizeSearchText(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
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

async function uploadImage(localFile, destPath) {
  const token = crypto.randomUUID();
  await bucket.upload(localFile, {
    destination: destPath,
    metadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: token } },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(destPath)}?alt=media&token=${token}`;
}

async function findByName(collection, name) {
  const snap = await db.collection(collection).where('name', '==', name).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

const PRICE = 188;
const STOCK = 4;
const SIZES = ['S', 'M', 'L', 'XL'];
const COLOR_PALETTE = [
  { name: 'Blanco', hex: '#F3F3F3' },
  { name: 'Negro', hex: '#101010' },
  { name: 'Perla', hex: '#EAE6E1' },
  { name: 'Melange', hex: '#C8CACB' },
  { name: 'Azul Acero', hex: '#0F1E37' },
  { name: 'Guinda', hex: '#651322' },
  { name: 'Naranja', hex: '#F76C0C' },
  { name: 'Rosado', hex: '#FDA9C9' },
  { name: 'Celeste', hex: '#A9D5F6' },
];
const ALL_COLOR_NAMES = COLOR_PALETTE.map((c) => c.name);

const GENERIC_DESC = (title) =>
  `<p><strong>${title}</strong> — conjunto pareja: 1 polera para Él + 1 polera para Ella.</p>` +
  '<p>Algodón afranelado reactivo 20/1, con capucha y bolsillo canguro. Elige color y talla (S a XL) para cada prenda.</p>';

const REFERENCE_NOTE =
  '<p><em>Foto de referencia de un pedido personalizado — se reemplazará por una imagen en blanco.</em></p>';

// ── Los 23 conjuntos ──────────────────────────────────────────────────────
const DESIGNS = [
  { n: '01', slug: 'moto-copiloto', name: 'Conjunto Pareja · Motoquera y su Copiloto',
    left: '1__1___L.jpg', right: '1__1___R.jpg', leftPerson: 'Ella', rightPerson: 'Él',
    leftColor: 'Blanco', rightColor: 'Blanco', tags: [] },
  { n: '02', slug: 'spiderman-web', name: 'Conjunto Pareja · Spider Web',
    left: '2__1___L.jpg', right: '2__1___R.jpg', leftPerson: 'Ella', rightPerson: 'Él',
    leftColor: 'Blanco', rightColor: 'Negro', tags: ['Spider-Man'] },
  { n: '03', slug: 'gym-spiderman-hellokitty', name: 'Conjunto Pareja · Gym Spider-Man & Hello Kitty',
    left: '3__1___L.jpg', right: '3__1___R.jpg', leftPerson: 'Él', rightPerson: 'Ella',
    leftColor: 'Blanco', rightColor: 'Blanco', tags: ['Spider-Man'] },
  { n: '04', slug: 'chimuelo-dia-noche', name: 'Conjunto Pareja · Chimuelo Día y Noche',
    left: '5__1___L.jpg', right: '5__1___R.jpg', leftPerson: 'Ella', rightPerson: 'Él',
    leftColor: 'Blanco', rightColor: 'Negro', tags: [] },
  { n: '05', slug: 'siluetas-de-amor', name: 'Conjunto Pareja · Siluetas de Amor',
    left: '6__1___L.jpg', right: '6__1___R.jpg', leftPerson: 'Ella', rightPerson: 'Él',
    leftColor: 'Negro', rightColor: 'Negro', tags: [] },
  { n: '06', slug: 'promesa-infinita', name: 'Conjunto Pareja · Promesa Infinita',
    left: '7__1___L.jpg', right: '7__1___R.jpg', leftPerson: 'Ella', rightPerson: 'Él',
    leftColor: 'Rosado', rightColor: 'Negro', tags: [] },
  { n: '07', slug: 'gordita-gordito', name: 'Conjunto Pareja · Gordita y Gordito',
    left: '8__1___L.jpg', right: '8__1___R.jpg', leftPerson: 'Ella', rightPerson: 'Él',
    leftColor: 'Blanco', rightColor: 'Blanco', tags: [] },
  { n: '08', slug: 'opuestos-complementarios', name: 'Conjunto Pareja · Opuestos Complementarios',
    left: '9__1___L.jpg', right: '9__1___R.jpg', leftPerson: 'Él', rightPerson: 'Ella',
    leftColor: 'Blanco', rightColor: 'Negro', tags: [] },
  { n: '09', slug: 'rodar-contigo', name: 'Conjunto Pareja · Rodar Contigo',
    left: '10__1___L.jpg', right: '10__1___R.jpg', leftPerson: 'Ella', rightPerson: 'Él',
    leftColor: 'Melange', rightColor: 'Negro', tags: [] },
  { n: '10', slug: 'dragon-ball', name: 'Conjunto Pareja · Dragon Ball',
    left: '11__1___L.jpg', right: '11__1___R.jpg', leftPerson: 'Ella', rightPerson: 'Él',
    leftColor: 'Blanco', rightColor: 'Blanco', tags: ['Dragon Ball'], rightCharacters: ['Goku'] },
  { n: '11', slug: 'flechazo-de-amor', name: 'Conjunto Pareja · Flechazo de Amor',
    left: '12__1___L.jpg', right: '12__1___R.jpg', leftPerson: 'Ella', rightPerson: 'Él',
    leftColor: 'Blanco', rightColor: 'Negro', tags: [] },
  { n: '12', slug: 'el-mio-ella-mia', name: 'Conjunto Pareja · Él es Mío, Ella es Mía',
    left: '13__1___L.jpg', right: '13__1___R.jpg', leftPerson: 'Ella', rightPerson: 'Él',
    leftColor: 'Rosado', rightColor: 'Negro', tags: [] },
  { n: '13', slug: 'mario-rosalina', name: 'Conjunto Pareja · Mario & Rosalina',
    left: 'Gemini_Generated_Image_36arzv36arzv36ar__L.jpg', right: 'Gemini_Generated_Image_36arzv36arzv36ar__R.jpg',
    leftPerson: 'Él', rightPerson: 'Ella', leftColor: 'Azul Acero', rightColor: 'Azul Acero', tags: [] },
  { n: '14', slug: 'te-prometo', name: 'Conjunto Pareja · Te Prometo',
    left: 'Gemini_Generated_Image_7wp1l07wp1l07wp1__L.jpg', right: 'Gemini_Generated_Image_7wp1l07wp1l07wp1__R.jpg',
    leftPerson: 'Él', rightPerson: 'Ella', leftColor: 'Blanco', rightColor: 'Blanco', tags: [] },
  { n: '15', slug: 'mi-gran-amor', name: 'Conjunto Pareja · Mi Gran Amor',
    left: 'Gemini_Generated_Image_fgegwtfgegwtfgeg__L.jpg', right: 'Gemini_Generated_Image_fgegwtfgegwtfgeg__R.jpg',
    leftPerson: 'Él', rightPerson: 'Ella', leftColor: 'Negro', rightColor: 'Blanco', tags: [] },
  { n: '16', slug: 'bella-bestia', name: 'Conjunto Pareja · Bella y Bestia',
    left: 'Gemini_Generated_Image_ra6j3ra6j3ra6j3r__L.jpg', right: 'Gemini_Generated_Image_ra6j3ra6j3ra6j3r__R.jpg',
    leftPerson: 'Él', rightPerson: 'Ella', leftColor: 'Negro', rightColor: 'Negro', tags: [] },
  { n: '17', slug: 'up-carl-ellie', name: 'Conjunto Pareja · Up: Carl & Ellie',
    left: 'Gemini_Generated_Image_rmt0t0rmt0t0rmt0__L.jpg', right: 'Gemini_Generated_Image_rmt0t0rmt0t0rmt0__R.jpg',
    leftPerson: 'Él', rightPerson: 'Ella', leftColor: 'Celeste', rightColor: 'Rosado', tags: [] },
  { n: '18', slug: 'stitch-angel-sentados', name: 'Conjunto Pareja · Stitch & Angel',
    left: 'WhatsApp_Image_2026_09_07_at_6_34_09_PM__L.jpg', right: 'WhatsApp_Image_2026_09_07_at_6_34_09_PM__R.jpg',
    leftPerson: 'Ella', rightPerson: 'Él', leftColor: 'Celeste', rightColor: 'Celeste',
    tags: ['stitch y angela'], reference: true },
  { n: '19', slug: 'stitch-angel-caritas', name: 'Conjunto Pareja · Stitch & Angel (Caritas)',
    left: 'WhatsApp_Image_2026_09_07_at_6_34_09_PM__1___L.jpg', right: 'WhatsApp_Image_2026_09_07_at_6_34_09_PM__1___R.jpg',
    leftPerson: 'Ella', rightPerson: 'Él', leftColor: 'Celeste', rightColor: 'Celeste',
    tags: ['stitch y angela'], reference: true },
  { n: '20', slug: 'snoopy-y-pareja', name: 'Conjunto Pareja · Snoopy & Su Pareja',
    left: 'WhatsApp_Image_2026_09_07_at_6_34_09_PM__3___L.jpg', right: 'WhatsApp_Image_2026_09_07_at_6_34_09_PM__3___R.jpg',
    leftPerson: 'Ella', rightPerson: 'Él', leftColor: 'Rosado', rightColor: 'Celeste',
    tags: [], reference: true },
  { n: '21', slug: 'snoopy-corazon', name: 'Conjunto Pareja · Snoopy Corazón',
    left: 'WhatsApp_Image_2026_09_07_at_6_34_09_PM__5___L.jpg', right: 'WhatsApp_Image_2026_09_07_at_6_34_09_PM__5___R.jpg',
    leftPerson: 'Ella', rightPerson: 'Él', leftColor: 'Blanco', rightColor: 'Negro',
    tags: [], reference: true },
  { n: '22', slug: 'pitufos', name: 'Conjunto Pareja · Pitufos',
    left: 'WhatsApp_Image_2026_09_07_at_6_34_09_PM__4___L.jpg', right: 'WhatsApp_Image_2026_09_07_at_6_34_09_PM__4___R.jpg',
    leftPerson: 'Ella', rightPerson: 'Él', leftColor: 'Blanco', rightColor: 'Negro',
    tags: [], reference: true },
  { n: '23', slug: 'spiderman-mini', name: 'Conjunto Pareja · Spider-Man Mini',
    left: 'WhatsApp_Image_2026_09_07_at_6_34_09_PM__7___L.jpg', right: 'WhatsApp_Image_2026_09_07_at_6_34_09_PM__7___R.jpg',
    leftPerson: 'Ella', rightPerson: 'Él', leftColor: 'Blanco', rightColor: 'Negro',
    tags: ['Spider-Man'], reference: true },
];

async function main() {
  console.log(CONFIRMED ? '→ Escribiendo en Firebase REAL (sistema-gestion-3b225)...' : '→ DRY-RUN (no escribe nada; usa --confirm para aplicar)');
  console.log('');

  const brand = await findByName('tienda_brands', 'Con Amor Parejas');
  if (!brand) throw new Error('No se encontró la marca "Con Amor Parejas".');
  console.log(`✓ Marca "Con Amor Parejas" → ${brand.id}`);

  const catCasacas = await findByName('tienda_categories', 'Casacas');
  if (!catCasacas) throw new Error('No se encontró la categoría "Casacas".');
  console.log(`✓ Categoría "Casacas" → ${catCasacas.id}`);

  const tagParejas = await findByName('tags', 'Parejas');
  if (!tagParejas) throw new Error('No se encontró la etiqueta "Parejas".');
  console.log(`✓ Etiqueta "Parejas" → ${tagParejas.id}`);

  const extraTagNames = Array.from(new Set(DESIGNS.flatMap((d) => d.tags || [])));
  const extraTagIds = {};
  for (const tn of extraTagNames) {
    const t = await findByName('tags', tn);
    if (!t) throw new Error(`No se encontró la etiqueta "${tn}".`);
    extraTagIds[tn] = t.id;
    console.log(`✓ Etiqueta "${tn}" → ${t.id}`);
  }

  const charGoku = await findByName('characters', 'Goku');
  if (!charGoku) throw new Error('No se encontró el personaje "Goku".');
  console.log(`✓ Personaje "Goku" → ${charGoku.id}`);

  console.log('');

  function buildVariants(imageUrl, colorName) {
    return COLOR_PALETTE.map((c) => ({
      id: c.name.toLowerCase().replace(/\s+/g, '-'),
      name: c.name,
      colorHex: c.hex,
      imageUrl: c.name === colorName ? imageUrl : '',
      sizes: SIZES,
      images: [],
      galleryImages: [],
    }));
  }

  function finalizePiece({ name, sku, imageUrl, colorName, tagIds, characterIds }) {
    const variants = buildVariants(imageUrl, colorName);
    const payload = {
      name,
      sku,
      description: '',
      categories: [catCasacas.id],
      collections: [],
      tags: tagIds,
      characters: characterIds,
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
      images: [imageUrl].filter(Boolean),
      imagesByColor: imageUrl ? { [colorName]: [imageUrl] } : {},
      variants,
      defaultVariantId: colorName.toLowerCase().replace(/\s+/g, '-'),
      variantDisplayBehavior: 'default_only',
      behaviorImpressionsThreshold: 3,
      customizationViews: [],
      productCliparts: [],
      featured: false,
      featuredOrder: 0,
      visible: false, // no se vende suelta: solo existe para alimentar el combo
      isComboProduct: false,
      whatsappEnabled: true,
      whatsappNumber: '',
      whatsappMessage: '',
    };
    payload.nameLower = normalizeSearchText(payload.name);
    payload.searchTokens = buildSearchTokens(payload.name, payload.brandId, payload.productType);
    return payload;
  }

  console.log('→ Conjuntos a crear/actualizar:');
  for (const d of DESIGNS) {
    const elId = `parejas-${d.slug}-el`;
    const ellaId = `parejas-${d.slug}-ella`;
    const comboId = `parejas-${d.slug}-combo`;

    const leftLocal = path.join(CROPS_DIR, d.left);
    const rightLocal = path.join(CROPS_DIR, d.right);
    if (!fs.existsSync(leftLocal)) throw new Error(`No se encontró ${leftLocal}`);
    if (!fs.existsSync(rightLocal)) throw new Error(`No se encontró ${rightLocal}`);

    let leftUrl, rightUrl;
    if (CONFIRMED) {
      leftUrl = await uploadImage(leftLocal, `products/parejas-${d.slug}/${d.leftPerson === 'Él' ? 'el' : 'ella'}.jpg`);
      rightUrl = await uploadImage(rightLocal, `products/parejas-${d.slug}/${d.rightPerson === 'Él' ? 'el' : 'ella'}.jpg`);
    } else {
      leftUrl = `(url-tras---confirm)/${d.slug}-left`;
      rightUrl = `(url-tras---confirm)/${d.slug}-right`;
    }

    const elIsLeft = d.leftPerson === 'Él';
    const elUrl = elIsLeft ? leftUrl : rightUrl;
    const ellaUrl = elIsLeft ? rightUrl : leftUrl;
    const elColor = elIsLeft ? d.leftColor : d.rightColor;
    const ellaColor = elIsLeft ? d.rightColor : d.leftColor;

    const tagIds = [tagParejas.id, ...(d.tags || []).map((t) => extraTagIds[t])];
    // Único caso real en este set: el personaje Goku va en la prenda de Él del diseño "Dragon Ball".
    const elChars = (d.slug === 'dragon-ball') ? [charGoku.id] : [];

    const elPayload = finalizePiece({
      name: `${d.name} · Él`, sku: `CAP-${d.n}-EL`, imageUrl: elUrl, colorName: elColor,
      tagIds, characterIds: elChars,
    });
    const ellaPayload = finalizePiece({
      name: `${d.name} · Ella`, sku: `CAP-${d.n}-ELLA`, imageUrl: ellaUrl, colorName: ellaColor,
      tagIds, characterIds: [],
    });

    const comboDescription = GENERIC_DESC(d.name) + (d.reference ? REFERENCE_NOTE : '');
    const comboPayload = {
      name: d.name,
      sku: `CAP-${d.n}-COMBO`,
      description: comboDescription,
      categories: [catCasacas.id],
      collections: [],
      tags: tagIds,
      characters: elChars,
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
      comboPreviewImage: leftUrl,
      comboItems: [
        {
          productId: ellaId, name: 'Ella', imageUrl: ellaUrl, viewId: 'default', position: 0, scale: 1,
          customizable: false, variantMapping: { color: ellaColor, allowedColors: ALL_COLOR_NAMES },
        },
        {
          productId: elId, name: 'Él', imageUrl: elUrl, viewId: 'default', position: 1, scale: 1,
          customizable: false, variantMapping: { color: elColor, allowedColors: ALL_COLOR_NAMES },
        },
      ],
      images: [leftUrl].filter(Boolean),
      imagesByColor: {},
      whatsappEnabled: true,
      whatsappNumber: '',
      whatsappMessage: '',
    };
    comboPayload.nameLower = normalizeSearchText(comboPayload.name);
    comboPayload.searchTokens = buildSearchTokens(comboPayload.name, comboPayload.brandId, comboPayload.productType);

    console.log(`  - ${comboId}  "${d.name}"  S/${PRICE}  stock=${STOCK}  [Él=${elColor} / Ella=${ellaColor}]${d.reference ? '  (referencia)' : ''}`);

    if (CONFIRMED) {
      const now = FieldValue.serverTimestamp();
      await db.collection('productos_wala').doc(elId).set({ ...elPayload, createdAt: now, updatedAt: now });
      await db.collection('productos_wala').doc(ellaId).set({ ...ellaPayload, createdAt: now, updatedAt: now });
      await db.collection('productos_wala').doc(comboId).set({ ...comboPayload, createdAt: now, updatedAt: now });
    }
  }

  console.log('');
  console.log(CONFIRMED
    ? '✅ Listo. 23 conjuntos (69 documentos: 46 prendas ocultas + 23 combos visibles) creados/actualizados.'
    : '(dry-run) Nada se escribió. Vuelve a correr con --confirm para crear todo esto de verdad.');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
