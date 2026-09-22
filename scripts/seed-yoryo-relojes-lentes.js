/**
 * Catálogo YORYO · 6 relojes + 3 lentes
 * ────────────────────────────────────────────────────────────────────────────
 * Crea, en Firebase REAL (usa service account), los 9 primeros productos de la
 * marca "Yoryo" (rEPEpl4Hvzi6ogOBHn7x, que ya existía vacía). Son los primeros
 * productos isV2 del catálogo: el resto (130) son pre-V2 y no tienen brandId.
 *
 * Fotos originales en C:\Users\Isaac\Downloads\YORYO-20260922T140934Z-1-001\YORYO
 * — venían sin nombre, sin precio y en tres proporciones distintas (1:1, 9:16 y
 * 4000x2252 con orientación EXIF 6). Se recortaron a 3:4 —el aspecto de
 * PremiumProductCard, el mismo que bloquea ThumbnailCropEditor— en
 * YORYO-3x4\, revisando foto por foto que el recorte no cortara el producto.
 * Los 13 archivos "Copia de ..." del folder reloj eran duplicados byte a byte.
 *
 * Decisiones confirmadas con el dueño (no inventadas):
 *   - Marca: "Yoryo" (ya existe). Categoría: "Relojes y accesorios"
 *     (accesorios) en los 9 — es la única que la marca tiene habilitada y que
 *     los cubre. Tipo de producto: "Accesorio" (ya existe).
 *   - Precios y nombres: los del mapeo que aprobó, sin cambios.
 *   - Stock: 4 en los 9 productos (inStock es por producto, no por variante:
 *     el modelo solo tiene stock por talla dentro de la variante y estos no
 *     llevan tallas).
 *   - Esclava de cuero + placa incluida en R1 y R2, en TODAS sus variantes —
 *     no solo en las que la muestran en foto: si el contenido de la caja
 *     dependiera del color elegido serían reclamos seguros. No es un combo:
 *     un solo SKU, un solo precio, la esclava va dicha en la descripción.
 *   - R6 es un set de pareja (él + ella) y también va como producto único,
 *     no combo.
 *   - Se crea UNA colección nueva, "Yoryo Lujo", con los 9: ninguna de las 5
 *     existentes encaja y ninguna estaba habilitada para esta marca.
 *   - Etiquetas: se reusan las que ya existen (Reloj, Para regalar, Joyas,
 *     Amor) y solo se crea "Lentes", que no existía. Sin personajes.
 *   - Marcas de terceros (CURREN, pordogor, WEIGUAN, Chenxi) visibles en las
 *     esferas: el dueño está al tanto, se suben tal cual.
 *
 * Las imágenes se suben replicando prepararSubida/uploadFile de
 * services/firebase/storage.js: principal en WebP calidad 0.82 limitada a
 * MAX_LADO=2000, más las copias de 160/400/800 px (solo las que de verdad son
 * más chicas que la principal), y el mapa imagesVariantes por URL que lee
 * OptimizedImage para armar el srcSet.
 *
 * OJO con la colección: la tienda y el formulario V2 del admin viven en
 * `productos_wala` (COLLECTION en src/services/products.js), NO en `products`
 * —que existe con 130 docs viejos pero ya no la lee nadie: las únicas
 * ocurrencias de 'products' en el código son queryKeys de react-query—. La
 * primera corrida de este script escribió en `products` y no se veía nada en
 * la tienda; scripts/fix-yoryo-coleccion.js movió los 9 productos.
 *
 * USO:
 *   node scripts/seed-yoryo-relojes-lentes.js            (dry-run, no escribe)
 *   node scripts/seed-yoryo-relojes-lentes.js --confirm   (escribe de verdad)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const CONFIRMED = process.argv.includes('--confirm');

// Recortes 3:4 ya revisados (ver cabecera).
const CROPS = 'C:\\Users\\Isaac\\Downloads\\YORYO-20260922T140934Z-1-001\\YORYO-3x4';
// sharp vive en el scratchpad de la sesión: el del repo (0.32.6) quedó sin su
// binario y el que sí está (@img/sharp-win32-x64 0.35.4) no le corresponde.
const SHARP_PATH = 'C:\\Users\\Isaac\\AppData\\Local\\Temp\\claude\\C--Users-Isaac-Desktop-wala-master\\a4d85752-9071-4cd1-87ab-4878e8761066\\scratchpad\\node_modules\\sharp';

const sharp = require(SHARP_PATH);
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

const COLLECTION = 'productos_wala';        // la que lee la tienda (ver cabecera)
const BRAND_ID = 'rEPEpl4Hvzi6ogOBHn7x';   // Yoryo
const CATEGORY_ID = 'accesorios';           // Relojes y accesorios
const PRODUCT_TYPE_ID = 'rffUNjWeEeqrw1CCzIRN'; // Accesorio
const DEFAULT_VENDOR_ID = 'casa';
const DEFAULT_NICHE_ID = 'regala-con-amor';

// ── Búsqueda — copiado literal de src/services/products.js ──────────────────
const MAX_SEARCH_TOKENS = 60;
const MIN_TOKEN_LEN = 2;
const MAX_PREFIX_LEN = 12;
const normalizeSearchText = (s) =>
  String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function buildSearchTokens(...parts) {
  const text = parts.map((p) => normalizeSearchText(p)).filter(Boolean).join(' ');
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

// ── Subida — replica prepararSubida/uploadFile de firebase/storage.js ───────
const MAX_LADO = 2000;
const ANCHOS_VARIANTE = [160, 400, 800];
const CALIDAD = 82; // 0.82 en el front, que usa canvas.toBlob

const rutaDeVariante = (p, ancho) => p.replace(/\.[^./]+$/, '') + `_${ancho}.webp`;

async function subirBuffer(buffer, destPath, contentType) {
  const token = crypto.randomUUID();
  const file = bucket.file(destPath);
  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(destPath)}?alt=media&token=${token}`;
}

/**
 * Sube una foto local y sus copias pequeñas.
 * Devuelve { url, variantes: { 160: url, 400: url, 800: url } } — la misma
 * forma que uploadFile, para que imagesVariantes quede idéntico a lo que
 * escribe el formulario.
 */
async function subirFoto(localFile, destPathBase) {
  const meta = await sharp(localFile).metadata();
  const anchoOriginal = meta.width;
  const altoOriginal = meta.height;
  const proporcion = altoOriginal / anchoOriginal;

  const escala = Math.min(1, MAX_LADO / Math.max(anchoOriginal, altoOriginal));
  const anchoPrincipal = Math.round(anchoOriginal * escala);
  const altoPrincipal = Math.round(altoOriginal * escala);

  const principalPath = destPathBase.replace(/\.[^./]+$/, '') + '.webp';
  const bufPrincipal = await sharp(localFile)
    .resize({ width: anchoPrincipal, height: altoPrincipal })
    .webp({ quality: CALIDAD })
    .toBuffer();

  if (!CONFIRMED) {
    const variantes = {};
    for (const ancho of ANCHOS_VARIANTE) {
      if (ancho >= anchoPrincipal) continue;
      variantes[ancho] = `(dry-run) ${rutaDeVariante(destPathBase, ancho)}`;
    }
    console.log(`      · ${path.basename(localFile)} → ${anchoPrincipal}x${altoPrincipal} webp ${(bufPrincipal.length / 1024).toFixed(0)}KB + ${Object.keys(variantes).length} copias`);
    return { url: `(dry-run) ${principalPath}`, variantes };
  }

  const url = await subirBuffer(bufPrincipal, principalPath, 'image/webp');

  const variantes = {};
  for (const ancho of ANCHOS_VARIANTE) {
    if (ancho >= anchoPrincipal) continue;
    try {
      const buf = await sharp(localFile)
        .resize({ width: ancho, height: Math.round(ancho * proporcion) })
        .webp({ quality: CALIDAD })
        .toBuffer();
      variantes[ancho] = await subirBuffer(buf, rutaDeVariante(destPathBase, ancho), 'image/webp');
    } catch (e) {
      // Igual que en el front: si una copia falla no tumba la subida principal.
      console.warn(`      ⚠ la copia de ${ancho}px falló: ${e.message}`);
    }
  }
  console.log(`      · ${path.basename(localFile)} → ${anchoPrincipal}x${altoPrincipal} webp + ${Object.keys(variantes).length} copias`);
  return { url, variantes };
}

// ── Catálogo ────────────────────────────────────────────────────────────────
const P = (s) => `<p>${s}</p>`;

const INCLUYE_ESCLAVA = 'Incluye esclava de cuero trenzado con placa de acero: las dos piezas en un solo pedido.';

const PRODUCTOS = [
  {
    key: 'R1', name: 'Reloj Yoryo Magnate', sku: 'YRY-MAG', price: 149, salePrice: 119,
    tags: ['Reloj', 'Para regalar', 'Joyas'],
    description: P('Silueta clásica de caja facetada y calendario doble. Acero pulido, corona lateral y brazalete jubilee: el reloj que va con terno y con jean.') + P(INCLUYE_ESCLAVA),
    variants: [
      { name: 'Acero Ónix', colorHex: '#2E2E2E', main: 'R1_acero-onix', gallery: ['R1_oro-imperial_muneca', 'R1_platino-perla_muneca'] },
      { name: 'Oro Imperial', colorHex: '#C9A24B', main: 'R1_oro-imperial', gallery: ['R1_oro-imperial_muneca', 'R1_platino-perla_muneca'] },
      { name: 'Platino Perla', colorHex: '#D9DCE1', main: 'R1_platino-perla', gallery: ['R1_platino-perla_muneca', 'R1_oro-imperial_muneca'] },
    ],
  },
  {
    key: 'R2', name: 'Reloj Yoryo Monarca', sku: 'YRY-MON', price: 189, salePrice: 155,
    tags: ['Reloj', 'Para regalar', 'Joyas'],
    description: P('Caja cuadrada de líneas rectas con tres contadores sobre esfera azul medianoche. Presencia de reloj grande sin perder la elegancia.') + P(INCLUYE_ESCLAVA),
    variants: [
      { name: 'Oro Rosa Medianoche', colorHex: '#B76E51', main: 'R2_oro-rosa', gallery: ['R2_acero_muneca'] },
      { name: 'Acero Medianoche', colorHex: '#1B2A4A', main: 'R2_acero', gallery: ['R2_acero_muneca'] },
    ],
  },
  {
    key: 'R3', name: 'Reloj Yoryo Titán', sku: 'YRY-TIT', price: 179, salePrice: 145,
    tags: ['Reloj', 'Para regalar'],
    description: P('Bisel de buceo, escala interior en cobre y brazalete de acero macizo. Construido para verse fuerte en la muñeca.'),
    variants: [
      { name: 'Negro Cobre', colorHex: '#1A1A1A', main: 'R3_negro-cobre', gallery: [] },
      { name: 'Acero Grafito', colorHex: '#4A4E54', main: 'R3_acero-grafito', gallery: [] },
      { name: 'Azul Abismo', colorHex: '#16315C', main: 'R3_azul-abismo', gallery: [] },
    ],
  },
  {
    key: 'R4', name: 'Reloj Yoryo Expedición', sku: 'YRY-EXP', price: 129, salePrice: 99,
    tags: ['Reloj', 'Para regalar'],
    description: P('Caja negra mate y correa de silicona suave, con calendario y escala cronométrica. El de uso diario, de la oficina al fin de semana.'),
    variants: [
      { name: 'Verde Militar', colorHex: '#2F4F3A', main: 'R4_verde-militar', gallery: [] },
      { name: 'Azul Marino', colorHex: '#1F3A63', main: 'R4_azul-marino', gallery: [] },
      { name: 'Grafito', colorHex: '#6E7176', main: 'R4_grafito', gallery: [] },
    ],
  },
  {
    key: 'R5', name: 'Reloj Yoryo Eclipse', sku: 'YRY-ECL', price: 159, salePrice: 129,
    tags: ['Reloj', 'Para regalar'],
    description: P('Todo negro, sin agujas: lectura digital sobre cristal curvo y brazalete de acero negro. Discreto hasta que alguien lo mira de cerca.'),
    variants: [
      { name: 'Negro Total', colorHex: '#121212', main: 'R5_negro-total', gallery: [] },
    ],
  },
  {
    key: 'R6', name: 'Set Yoryo Alianza · Él & Ella', sku: 'YRY-ALI-SET', price: 259, salePrice: 219,
    tags: ['Reloj', 'Para regalar', 'Amor'],
    description: P('Dos relojes hechos para llevarse juntos: caja bicolor acero y oro, esfera champagne con detalles brillantes y calendario.') + P('Los dos vienen en un mismo estuche, en un solo pedido.'),
    variants: [
      { name: 'Bicolor Champagne', colorHex: '#C9A24B', main: 'R6_bicolor-champagne', gallery: [] },
    ],
  },
  {
    key: 'L1', name: 'Lentes Yoryo Diamante', sku: 'YRY-LEN-DIA', price: 139, salePrice: 109,
    tags: ['Lentes', 'Para regalar'],
    description: P('Montura al aire con el canto del lente tallado en facetas que atrapan la luz. Puente doble en metal dorado y degradé azul.') + P('Incluye estuche rígido Yoryo.'),
    variants: [
      { name: 'Oro Cristal Azul', colorHex: '#C9A24B', main: 'L1_oro-cristal-azul_b', gallery: ['L1_oro-cristal-azul_a'] },
    ],
  },
  {
    key: 'L2', name: 'Lentes Yoryo Versalles', sku: 'YRY-LEN-VER', price: 119, salePrice: 95,
    tags: ['Lentes', 'Para regalar'],
    description: P('Montura al aire en dorado con filigrana labrada a lo largo de las varillas. Liviana, sin marco, con lente transparente.') + P('Incluye estuche rígido Yoryo.'),
    variants: [
      { name: 'Oro Labrado', colorHex: '#C9A24B', main: 'L2_oro-labrado', gallery: [] },
    ],
  },
  {
    key: 'L3', name: 'Lentes Yoryo Imperial', sku: 'YRY-LEN-IMP', price: 119, salePrice: 95,
    tags: ['Lentes', 'Para regalar'],
    description: P('Montura al aire en plata con grabado fino en las varillas y terminales pulidos. Perfil bajo, acabado sobrio.') + P('Incluye estuche rígido Yoryo.'),
    variants: [
      { name: 'Plata Grabado', colorHex: '#D9DCE1', main: 'L3_plata-grabado', gallery: [] },
    ],
  },
];

const STOCK = 4;

// ── Taxonomía: resolver ids de etiquetas y crear lo que falte ───────────────
async function resolverTags() {
  const snap = await db.collection('tags').get();
  const porNombre = new Map();
  snap.forEach((d) => porNombre.set(String(d.data().name || '').trim().toLowerCase(), d.id));

  const necesarias = new Set();
  PRODUCTOS.forEach((p) => p.tags.forEach((t) => necesarias.add(t)));

  const mapa = {};
  for (const nombre of necesarias) {
    const existente = porNombre.get(nombre.toLowerCase());
    if (existente) {
      mapa[nombre] = existente;
      console.log(`  tag "${nombre}" → ya existe (${existente})`);
      continue;
    }
    if (!CONFIRMED) {
      mapa[nombre] = `(dry-run nuevo tag ${nombre})`;
      console.log(`  tag "${nombre}" → SE CREARÍA`);
      continue;
    }
    // Genérica como "Reloj" o "Joyas": sin brandIds, visible para toda marca.
    const ref = await db.collection('tags').add({ name: nombre, brandIds: [] });
    mapa[nombre] = ref.id;
    console.log(`  tag "${nombre}" → creada (${ref.id})`);
  }
  return mapa;
}

async function resolverColeccion() {
  const NOMBRE = 'Yoryo Lujo';
  const snap = await db.collection('tienda_collections').get();
  const existente = snap.docs.find((d) => String(d.data().name || '').trim().toLowerCase() === NOMBRE.toLowerCase());
  if (existente) {
    console.log(`  colección "${NOMBRE}" → ya existe (${existente.id})`);
    return existente.id;
  }
  if (!CONFIRMED) {
    console.log(`  colección "${NOMBRE}" → SE CREARÍA (brandIds: [Yoryo])`);
    return '(dry-run nueva colección)';
  }
  const ref = await db.collection('tienda_collections').add({
    name: NOMBRE,
    imageUrl: '',
    order: 0,
    brandIds: [BRAND_ID],
  });
  console.log(`  colección "${NOMBRE}" → creada (${ref.id})`);
  return ref.id;
}

// ── Armado del documento de producto ────────────────────────────────────────
function rutaCrop(nombre) {
  const p = path.join(CROPS, `${nombre}.jpg`);
  if (!fs.existsSync(p)) throw new Error(`falta el recorte ${nombre}.jpg en ${CROPS}`);
  return p;
}

async function construirProducto(prod, tagIds, collectionId) {
  console.log(`\n▶ ${prod.key} · ${prod.name}  (S/${prod.price} → S/${prod.salePrice}, ${prod.variants.length} variante(s))`);
  const draftId = `yoryo-${prod.key.toLowerCase()}`;
  const ts = Date.now();

  // Una misma foto puede ir en la galería de varias variantes (las de muñeca de
  // R1 y R2 van en todas, para que la esclava se vea siempre). Hay que subirla
  // UNA vez y reusar su URL: si se subiera por variante, cada subida al mismo
  // path reemplaza los metadatos del objeto y con ellos el token de descarga,
  // dejando muertas las URLs que ya se habían guardado en las variantes
  // anteriores.
  const subidas = new Map();
  const subirUnaVez = async (nombre, destPath) => {
    if (!subidas.has(nombre)) subidas.set(nombre, await subirFoto(rutaCrop(nombre), destPath));
    return subidas.get(nombre);
  };

  const variants = [];
  for (let i = 0; i < prod.variants.length; i++) {
    const v = prod.variants[i];
    const variantId = `variant_${ts}_${prod.key.toLowerCase()}_${i}`;
    const imagesVariantes = {};

    const principal = await subirUnaVez(
      v.main,
      `productos_v2/${draftId}/main_${variantId}_${ts}_${v.main}.jpg`
    );
    if (Object.keys(principal.variantes).length) imagesVariantes[principal.url] = principal.variantes;

    const images = [];
    for (const g of v.gallery) {
      const foto = await subirUnaVez(
        g,
        `productos_v2/${draftId}/gallery_${ts}_${g}.jpg`
      );
      images.push(foto.url);
      if (Object.keys(foto.variantes).length) imagesVariantes[foto.url] = foto.variantes;
    }

    variants.push({
      id: variantId,
      name: v.name,
      imageUrl: principal.url,
      sizes: [],                 // relojes y lentes: talla única
      images,
      galleryImages: images,     // compat: la tienda vieja lee galleryImages
      thumbnailCrop: null,       // las fotos YA vienen recortadas a 3:4
      imagesCrops: {},
      imagesVariantes,
      colorHex: v.colorHex,
    });
  }

  const imagesByColor = {};
  variants.forEach((v) => { if (v.imageUrl) imagesByColor[v.name] = [v.imageUrl]; });

  return {
    name: prod.name,
    nameLower: normalizeSearchText(prod.name),
    searchTokens: buildSearchTokens(prod.name, BRAND_ID, PRODUCT_TYPE_ID),
    categories: [CATEGORY_ID],
    collections: [collectionId],
    tags: prod.tags.map((t) => tagIds[t]),
    characters: [],
    vendors: [],
    sku: prod.sku,
    whatsappEnabled: true,
    whatsappNumber: '',
    whatsappMessage: '',
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
    mainImage: '',              // con hasVariants manda la variante
    mainSizes: [],
    variants,
    defaultVariantId: variants[0].id,
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
    isV2: true,
  };
}

(async () => {
  console.log(CONFIRMED ? '🚀 SUBIENDO DE VERDAD\n' : '🧪 DRY-RUN (no escribe nada) — usa --confirm para subir\n');

  // Guardarraíl: no duplicar si el seed ya corrió.
  const yaHay = await db.collection(COLLECTION).where('brandId', '==', BRAND_ID).get();
  if (!yaHay.empty) {
    console.error(`❌ La marca Yoryo ya tiene ${yaHay.size} producto(s). Aborto para no duplicar.`);
    yaHay.forEach((d) => console.error(`   - ${d.data().name} (${d.id})`));
    process.exit(1);
  }

  console.log('── Taxonomía ──');
  const tagIds = await resolverTags();
  const collectionId = await resolverColeccion();

  console.log('\n── Productos ──');
  const docs = [];
  for (const prod of PRODUCTOS) {
    docs.push({ key: prod.key, doc: await construirProducto(prod, tagIds, collectionId) });
  }

  if (!CONFIRMED) {
    console.log('\n🧪 Dry-run terminado. Resumen:');
    docs.forEach(({ key, doc }) => {
      const fotos = doc.variants.reduce((n, v) => n + 1 + v.images.length, 0);
      console.log(`  ${key.padEnd(3)} ${doc.name.padEnd(34)} S/${String(doc.price).padStart(3)} → S/${String(doc.salePrice).padStart(3)} | ${doc.variants.length} var | ${fotos} fotos | stock ${doc.inStock}`);
    });
    console.log('\nNada se escribió. Corre con --confirm para subir.');
    process.exit(0);
  }

  console.log('\n── Guardando en Firestore ──');
  for (const { key, doc } of docs) {
    const ref = await db.collection(COLLECTION).add({
      ...doc,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
    console.log(`  ✅ ${key} · ${doc.name} → ${ref.id}`);
  }

  console.log('\n🎉 Listo: 9 productos de Yoryo publicados.');
  process.exit(0);
})().catch((e) => {
  console.error('\n❌ Falló:', e.message);
  console.error(e.stack);
  process.exit(1);
});
