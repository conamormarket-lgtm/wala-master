/**
 * Yoryo · Pack de Oficina: termo, cuadro y mousepad (sueltos y en combo)
 * ────────────────────────────────────────────────────────────────────────────
 * Los documentos salen con la misma forma que guarda el admin
 * (AdminProductoFormV2 → createProduct → normalizeProductPayload): id propio,
 * fotos en productos_v2/{id}/ en WebP con sus copias de 160/400/800 px (lo que
 * hace uploadFile) y la taxonomía creada como la crean los selectores del form.
 *
 * Precios del dueño (2026-10-23):
 *   termo 120 (por ahora solo personalizado; el liso, S/89, queda pendiente)
 *   cuadro 59 · mousepad 25 · pack 149 (sueltos suman 204)
 *   stock 4 en todos (el del pack es suyo, no descuenta las piezas)
 *
 * Taxonomía (se crea si falta, por nombre):
 *   categoría "Oficina" (Yoryo) para el mousepad
 *   Yoryo se agrega a "Cuadros y decoración"
 *   colección "Pack de Oficina" (Yoryo)
 *   etiquetas "Oficina" y "Cuadro" (Yoryo)
 *
 * USO:
 *   node scripts/seed-yoryo-pack-oficina.js "<carpeta de fotos>"            (dry-run)
 *   node scripts/seed-yoryo-pack-oficina.js "<carpeta de fotos>" --confirm  (escribe)
 * SHARP_PATH apunta a un sharp que cargue (el de node_modules no tiene binario).
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const CONFIRMED = process.argv.includes('--confirm');
const CARPETA = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!CARPETA || !fs.existsSync(CARPETA)) {
  console.error('Uso: node scripts/seed-yoryo-pack-oficina.js "<carpeta de fotos>" [--confirm]');
  process.exit(1);
}

const sharp = require(process.env.SHARP_PATH || 'sharp');
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
const { FieldValue } = admin.firestore;

const COLLECTION = 'productos_wala';
const BRAND_ID = 'rEPEpl4Hvzi6ogOBHn7x'; // Yoryo
const TIPO_ACCESORIO = 'rffUNjWeEeqrw1CCzIRN';
const TIPO_COMBO = 'N2rTN3na2tb7LrZqL8E9';
const CAT_VASOS_TERMOS = '061jWF4fY44miGn8GCxb';
const CAT_CUADROS = 'iA4qMbCrOKACcvru4gpc';
const CAT_COMBOS = 'Lbmxm07yyVq13ZpzC4Ji';
const TAG_TERMICO = '27AUypX9Euouq33w0K2z';
const TAG_VASO_TERMICO = 'gsfP641DFZZSPTXA9ZtX';
const TAG_MOUSEPAD = '2GrgakHJyXOgt6RdAnyP';
const TAG_FOTOS = 'vnAA8lhaENMm0kEt2nB8';
const TAG_PERSONALIZABLE = 'L2Xvnic7GR0HN43o3CWi';
const TAG_PARA_REGALAR = 'Mq0pd8fbDEi319lis7Mj';
const STOCK = 4;

// ── Búsqueda — copiado de src/services/products.js ─────────────────────────
const MAX_SEARCH_TOKENS = 60, MIN_TOKEN_LEN = 2, MAX_PREFIX_LEN = 12;
const normalizeSearchText = (s) => String(s == null ? '' : s)
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
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

// ── Imagen — mismo criterio que prepararSubida (services/firebase/storage.js)
const MAX_LADO = 2000, ANCHOS_VARIANTE = [160, 400, 800], CALIDAD_PNG = 92;
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

/** Sube una foto de la carpeta como lo haría uploadFile: { url, variantes }. */
async function subirFoto(archivo, destPath) {
  const local = path.join(CARPETA, archivo);
  if (!fs.existsSync(local)) throw new Error(`falta la foto "${archivo}"`);
  const meta = await sharp(local).metadata();
  const escala = Math.min(1, MAX_LADO / Math.max(meta.width, meta.height));
  const w = Math.round(meta.width * escala), h = Math.round(meta.height * escala);
  const proporcion = meta.height / meta.width;
  const principalPath = destPath.replace(/\.[^./]+$/, '') + '.webp';
  const anchos = ANCHOS_VARIANTE.filter((a) => a < w);

  if (!CONFIRMED) {
    console.log(`      · ${archivo} → ${w}x${h} webp + ${anchos.length} copias`);
    return { url: `(dry-run) ${principalPath}`, variantes: {} };
  }
  const buf = await sharp(local).resize({ width: w, height: h }).webp({ quality: CALIDAD_PNG }).toBuffer();
  const url = await subirBuffer(buf, principalPath);
  const variantes = {};
  for (const ancho of anchos) {
    const b = await sharp(local).resize({ width: ancho, height: Math.round(ancho * proporcion) })
      .webp({ quality: CALIDAD_PNG }).toBuffer();
    variantes[ancho] = await subirBuffer(b, rutaDeVariante(destPath, ancho));
  }
  console.log(`      · ${archivo} → ${w}x${h} webp + ${Object.keys(variantes).length} copias`);
  return { url, variantes };
}

// ── Taxonomía: busca por nombre (sin tildes ni mayúsculas) o la crea ────────
async function asegurar(coleccion, nombre, extra = {}) {
  const snap = await db.collection(coleccion).get();
  const ya = snap.docs.find((d) => !d.data().deleted && normalizeSearchText(d.data().name) === normalizeSearchText(nombre));
  if (ya) {
    const marcas = ya.data().brandIds || [];
    console.log(`   ${coleccion} "${nombre}": ya existe (${ya.id})`);
    if (marcas.length && !marcas.includes(BRAND_ID)) {
      console.log('      + se le agrega Yoryo');
      if (CONFIRMED) await ya.ref.update({ brandIds: FieldValue.arrayUnion(BRAND_ID), updatedAt: FieldValue.serverTimestamp() });
    }
    return ya.id;
  }
  console.log(`   ${coleccion} "${nombre}": se crea (Yoryo)`);
  if (!CONFIRMED) return `(dry-run ${nombre})`;
  const ref = await db.collection(coleccion).add({
    name: nombre, ...extra, brandIds: [BRAND_ID],
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

const P = (s) => `<p>${s}</p>`;
const UL = (...items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

// ── Los productos ──────────────────────────────────────────────────────────
const PIEZAS = [
  {
    clave: 'termo',
    name: 'Termo Yoryo Personalizado',
    sku: 'YOR-TERMO-01',
    price: 120,
    fulfillmentType: 'print_on_demand',
    categoria: () => CAT_VASOS_TERMOS,
    tags: (t) => [TAG_TERMICO, TAG_VASO_TERMICO, TAG_PERSONALIZABLE, TAG_PARA_REGALAR, t.oficina],
    variante: { name: 'Negro', colorHex: '#000000' },
    principal: 'Vaso térmico negro con asa.png',
    galeria: ['Vaso negro con asa y tapa transparente.png'],
    description:
      P('Tu compañero para las horas de trabajo, con tu sello. Termo negro de acabado texturizado, con borde de acero, asa ergonómica, tapa transparente con boquilla y sorbete incluido.') +
      P('<strong>Personalizado:</strong> lleva tu nombre, una frase o el diseño que quieras. Después de tu compra, envíanos lo que quieres por WhatsApp y lo preparamos para ti.') +
      P('Ideal para la oficina, el estudio o para regalar.'),
  },
  {
    clave: 'cuadro',
    name: 'Cuadro Yoryo Personalizado',
    sku: 'YOR-CUADRO-01',
    price: 59,
    fulfillmentType: 'print_on_demand',
    categoria: () => CAT_CUADROS,
    tags: (t) => [t.cuadro, TAG_FOTOS, TAG_PERSONALIZABLE, TAG_PARA_REGALAR, t.oficina],
    variante: { name: 'Marco negro', colorHex: '#000000' },
    principal: 'Marco negro horizontal sobre fondo blanco.png',
    galeria: ['Marco negro horizontal con interior blanco.png'],
    description:
      P('Convierte tu foto favorita en un cuadro para tu escritorio. Marco negro de líneas limpias con soporte trasero para pararlo sobre la mesa.') +
      P('<strong>Medida:</strong> 25 × 31 cm (horizontal).') +
      P('Después de tu compra, envíanos tu foto o diseño por WhatsApp. Un detalle con mucho significado para tu espacio de trabajo o para regalar.'),
  },
  {
    clave: 'mousepad',
    name: 'Mousepad Yoryo Personalizado',
    sku: 'YOR-MOUSE-01',
    price: 25,
    fulfillmentType: 'print_on_demand',
    categoria: (t) => t.catOficina,
    tags: (t) => [TAG_MOUSEPAD, TAG_PERSONALIZABLE, TAG_PARA_REGALAR, t.oficina],
    variante: { name: 'Blanco con borde negro', colorHex: '#FFFFFF' },
    principal: 'Alfombrilla blanca con borde negro.png',
    galeria: ['Alfombrilla blanca en vista oblicua.png', 'Reverso negro de alfombrilla para ratón.png'],
    description:
      P('Dale tu toque al escritorio. Mousepad con superficie de tela blanca lista para tu diseño, borde negro cosido y base negra.') +
      P('<strong>Medida:</strong> 19.5 × 23.5 cm.') +
      P('Después de tu compra, envíanos tu foto, frase o diseño por WhatsApp y lo imprimimos para ti.'),
  },
];

const PACK = {
  name: 'Pack de Oficina Yoryo',
  sku: 'YOR-PACK-OFI-01',
  price: 149,
  description:
    P('Todo lo que tu escritorio necesita, en un solo pack:') +
    UL(
      '<strong>Termo con asa</strong> personalizado con tu nombre, frase o diseño.',
      '<strong>Cuadro de 25 × 31 cm</strong> con tu foto.',
      '<strong>Mousepad de 19.5 × 23.5 cm</strong> con tu diseño.',
    ) +
    P('Comprados por separado suman S/204. <strong>En el pack pagas S/149 y ahorras S/55.</strong>') +
    P('Después de tu compra, envíanos tus fotos y diseños por WhatsApp. El regalo perfecto para quien pasa el día trabajando o estudiando.'),
};

/** Lo que guarda createProduct para un producto con id propio (normalizeProductPayload). */
function documento(base) {
  return {
    name: base.name,
    nameLower: normalizeSearchText(base.name),
    searchTokens: buildSearchTokens(base.name, BRAND_ID, base.productType),
    categories: base.categories,
    collections: base.collections,
    tags: base.tags,
    characters: [],
    vendors: [],
    sku: base.sku,
    whatsappEnabled: true,
    whatsappNumber: '',
    whatsappMessage: '',
    productType: base.productType,
    brandId: BRAND_ID,
    vendorId: 'casa',
    nicheId: 'regala-con-amor',
    fulfillmentType: base.fulfillmentType,
    price: base.price,
    salePrice: null,
    images: base.images,
    imagesByColor: base.imagesByColor,
    description: base.description,
    inStock: STOCK,
    customizable: false,
    esPrendaBase: false,
    hasVariants: base.hasVariants,
    mainImage: '',
    mainSizes: [],
    variants: base.variants,
    defaultVariantId: base.defaultVariantId,
    variantDisplayBehavior: 'default_only',
    behaviorImpressionsThreshold: 3,
    customizationViews: [],
    productCliparts: [],
    featured: false,
    featuredOrder: 0,
    visible: true,
    publico: 'unisex',
    equipo: null,
    edadMinima: 13,
    isComboProduct: Boolean(base.comboItems),
    ...(base.comboItems && {
      comboLayout: { orientation: 'horizontal', spacing: 20 },
      comboItems: base.comboItems,
      comboTallas: 'porPrenda',
    }),
    comboPreviewImage: '',
    thumbnailWithDesignUrl: '',
    // Como el resto del catálogo Yoryo: la tarjeta toma el hover de images[0].
    isV2: true,
  };
}

async function guardar(id, doc) {
  if (!CONFIRMED) return;
  await db.collection(COLLECTION).doc(id).set({
    ...doc,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function existente(sku) {
  const snap = await db.collection(COLLECTION).where('brandId', '==', BRAND_ID).where('sku', '==', sku).get();
  return snap.docs.find((d) => !d.data().deleted) || null;
}

(async () => {
  console.log(CONFIRMED ? '🚀 ESCRIBIENDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para escribir\n');

  console.log('▶ Taxonomía');
  const catOrden = (await db.collection('tienda_categories').get()).size;
  const tax = {
    catOficina: await asegurar('tienda_categories', 'Oficina', { order: catOrden }),
    cuadros: await asegurar('tienda_categories', 'Cuadros y decoración'),
    coleccion: await asegurar('tienda_collections', 'Pack de Oficina', { order: 0 }),
    oficina: await asegurar('tags', 'Oficina'),
    cuadro: await asegurar('tags', 'Cuadro'),
  };
  if (!String(tax.cuadros).startsWith('(dry-run') && tax.cuadros !== CAT_CUADROS) {
    throw new Error(`"Cuadros y decoración" no es ${CAT_CUADROS}`);
  }

  const creadas = {};
  for (const pz of PIEZAS) {
    console.log(`\n▶ ${pz.name} · S/${pz.price} · stock ${STOCK}`);
    const ya = await existente(pz.sku);
    if (ya) {
      console.log(`   ya existe (${ya.id}) — no lo toco`);
      const v = ya.data().variants?.[0];
      creadas[pz.clave] = { id: ya.id, name: ya.data().name, imageUrl: v?.imageUrl || '', color: v?.name || '' };
      continue;
    }
    const id = db.collection(COLLECTION).doc().id;
    const ts = Date.now();
    const variantId = `var_${ts}`;
    const principal = await subirFoto(pz.principal, `productos_v2/${id}/main_${variantId}_${ts}_${pz.principal}`);
    const imagesVariantes = {};
    if (Object.keys(principal.variantes).length) imagesVariantes[principal.url] = principal.variantes;
    const galeria = [];
    for (const archivo of pz.galeria) {
      const foto = await subirFoto(archivo, `productos_v2/${id}/gallery_${Date.now()}_${archivo}`);
      galeria.push(foto.url);
      if (Object.keys(foto.variantes).length) imagesVariantes[foto.url] = foto.variantes;
    }

    const variants = [{
      id: variantId,
      name: pz.variante.name,
      imageUrl: principal.url,
      sizes: [],
      images: galeria,
      galleryImages: galeria,
      thumbnailCrop: null,
      imagesCrops: {},
      imagesVariantes,
      sizeLabel: 'Talla',
      colorHex: pz.variante.colorHex,
    }];

    const doc = documento({
      name: pz.name,
      sku: pz.sku,
      price: pz.price,
      productType: TIPO_ACCESORIO,
      fulfillmentType: pz.fulfillmentType,
      categories: [pz.categoria(tax)],
      collections: [tax.coleccion],
      tags: pz.tags(tax),
      description: pz.description,
      hasVariants: true,
      variants,
      defaultVariantId: variantId,
      images: [principal.url],
      imagesByColor: { [pz.variante.name]: [principal.url] },
    });
    console.log(`   id ${id} · variante "${pz.variante.name}" · ${galeria.length} foto(s) de galería`);
    await guardar(id, doc);
    if (CONFIRMED) console.log('   ✅ guardado');
    creadas[pz.clave] = { id, name: pz.name, imageUrl: principal.url, color: pz.variante.name };
  }

  console.log(`\n▶ ${PACK.name} · S/${PACK.price} · stock ${STOCK}`);
  const yaPack = await existente(PACK.sku);
  if (yaPack) {
    console.log(`   ya existe (${yaPack.id}) — no lo toco`);
  } else {
    const id = db.collection(COLLECTION).doc().id;
    const comboItems = ['termo', 'cuadro', 'mousepad'].map((clave, position) => ({
      productId: creadas[clave].id,
      name: creadas[clave].name,
      imageUrl: creadas[clave].imageUrl,
      viewId: '',
      position,
      scale: 1,
      customizable: false,
      variantMapping: { color: creadas[clave].color },
    }));
    const doc = documento({
      name: PACK.name,
      sku: PACK.sku,
      price: PACK.price,
      productType: TIPO_COMBO,
      fulfillmentType: 'print_on_demand',
      categories: [CAT_COMBOS],
      collections: [tax.coleccion],
      tags: [tax.oficina, TAG_PARA_REGALAR, TAG_PERSONALIZABLE, TAG_TERMICO, tax.cuadro, TAG_MOUSEPAD],
      description: PACK.description,
      hasVariants: false,
      variants: [],
      defaultVariantId: '',
      images: [],
      imagesByColor: {},
      comboItems,
    });
    comboItems.forEach((i) => console.log(`      - ${i.name} (${i.variantMapping.color})`));
    console.log(`   id ${id}`);
    await guardar(id, doc);
    if (CONFIRMED) console.log('   ✅ guardado');
  }

  console.log(CONFIRMED ? '\n🎉 Listo.' : '\n🧪 Dry-run terminado, nada se escribió.');
  process.exit(0);
})().catch((e) => { console.error('\n❌ Falló:', e.message); process.exit(1); });
