/**
 * Lumi · Catálogo desde el Excel (LUMI_Base_Productos.xlsx) — 2026-11-06
 * ────────────────────────────────────────────────────────────────────────────
 * Lee scripts/data/lumi-catalogo-excel.json (armado a partir del Excel y de las
 * fotos de WhatsApp del 2026-11-05) y, en Firebase REAL:
 *
 *   1. Categorías de Lumi: crea "Contorno de ojos" (tipo Belleza), renombra
 *      "Tónicos" a "Tónicos y esencias" y deja el menú de la marca
 *      (tienda_brands.categoryNav) en el orden del JSON.
 *   2. Colecciones por problema de piel (Anti-edad, Manchas, Acné, Piel
 *      sensible, Piel deshidratada), solo de la marca Lumi.
 *   3. Los 34 productos que ya existían: SKU MUSSA- → LUMI-, precio del Excel,
 *      descripción (la de una línea se reemplaza; a la completa solo se le
 *      agrega "Cómo usarlo"), categoría y colecciones. NO toca fotos, nombre,
 *      stock ni el id del documento (cambiarlo rompería carritos, pedidos y
 *      links ya compartidos).
 *   4. Los productos nuevos: sube su foto (fondo blanco, WebP + copias de
 *      160/400/800 como uploadFile) a productos_v2/{id}/ y crea la ficha con la
 *      misma forma que guarda el admin (una variante "Principal"). Stock 4.
 *
 * Se puede correr dos veces: lo que ya está hecho se salta.
 *
 * USO:
 *   node scripts/lumi-catalogo-excel.js --fotos <carpeta>            (prueba, no escribe)
 *   node scripts/lumi-catalogo-excel.js --fotos <carpeta> --confirm  (escribe de verdad)
 *   La carpeta tiene {foto}.webp y {foto}_160/_400/_800.webp por cada nuevo.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const CONFIRMED = process.argv.includes('--confirm');
const iFotos = process.argv.indexOf('--fotos');
const FOTOS = iFotos > -1 ? process.argv[iFotos + 1] : null;
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'lumi-catalogo-excel.json'), 'utf8'));

const admin = require(require.resolve('firebase-admin', { paths: [fnModules] }));
const saPath = path.join(ROOT, 'serviceAccountKey.json');
if (!fs.existsSync(saPath)) {
  console.error('❌ No existe serviceAccountKey.json en la raíz del repo.');
  process.exit(1);
}
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
const BUCKET_NAME = 'sistema-gestion-3b225.firebasestorage.app';
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id, storageBucket: BUCKET_NAME });
const db = admin.firestore();
const bucket = admin.storage().bucket();
const FieldValue = admin.firestore.FieldValue;

const LUMI = 'pMujqcyIIDUF2EdSSX5V';
const BELLEZA = '1qa4PI0MNmOwrzyQ4In5';
const ANCHOS = [160, 400, 800];

// ── Búsqueda — igual a src/services/products.js (copiado de seed-mussa-kbeauty-extra.js)
const MAX_SEARCH_TOKENS = 60;
const MIN_TOKEN_LEN = 2;
const MAX_PREFIX_LEN = 12;
function normalizeSearchText(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
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
    metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: token } },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(destPath)}?alt=media&token=${token}`;
}

const deLumi = (d) => Array.isArray(d.brandIds) && d.brandIds.includes(LUMI);
const nuevoId = (ref) => (CONFIRMED ? ref.id : '(nueva)');

async function main() {
  console.log(CONFIRMED ? '→ ESCRIBIENDO en Firebase real' : '→ PRUEBA (no escribe nada; --confirm para aplicar)');

  // ── 1) Categorías ───────────────────────────────────────────────────────
  const cats = (await db.collection('tienda_categories').get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter(deLumi);
  const catPorNombre = new Map(cats.map((c) => [c.name, c]));
  for (const { de, a } of DATA.categorias.renombrar) {
    if (catPorNombre.has(a)) continue;
    const c = catPorNombre.get(de);
    if (!c) throw new Error(`No existe la categoría "${de}" de Lumi`);
    console.log(`  categoría "${de}" → "${a}"`);
    if (CONFIRMED) await db.collection('tienda_categories').doc(c.id).update({ name: a, updatedAt: FieldValue.serverTimestamp() });
    catPorNombre.delete(de);
    catPorNombre.set(a, { ...c, name: a });
  }
  const maxOrden = Math.max(0, ...(await db.collection('tienda_categories').get()).docs.map((d) => Number(d.data().order) || 0));
  for (const { nombre } of DATA.categorias.crear) {
    if (catPorNombre.has(nombre)) continue;
    const ref = db.collection('tienda_categories').doc();
    console.log(`  categoría nueva "${nombre}" (Belleza)`);
    if (CONFIRMED) {
      await ref.set({ name: nombre, imageUrl: '', order: maxOrden + 1, brandIds: [LUMI], productType: BELLEZA, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    }
    catPorNombre.set(nombre, { id: nuevoId(ref), name: nombre });
  }
  const catId = (nombre) => {
    const c = catPorNombre.get(nombre);
    if (!c) throw new Error(`Falta la categoría "${nombre}"`);
    return c.id;
  };
  // Menú de la marca: el orden del JSON; cada entrada conserva su imagen.
  const marcaRef = db.collection('tienda_brands').doc(LUMI);
  const navAntes = (await marcaRef.get()).data().categoryNav || [];
  const nav = DATA.categorias.menu.map((nombre, order) => {
    const id = catId(nombre);
    const antes = navAntes.find((n) => n.categoryId === id) || {};
    return { categoryId: id, name: nombre, imageUrl: antes.imageUrl || '', order };
  });
  console.log(`  menú de Lumi: ${nav.map((n) => n.name).join(' · ')}`);
  if (CONFIRMED) await marcaRef.update({ categoryNav: nav, updatedAt: FieldValue.serverTimestamp() });

  // ── 2) Colecciones ──────────────────────────────────────────────────────
  const cols = (await db.collection('tienda_collections').get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter(deLumi);
  const colId = {};
  for (const [order, nombre] of DATA.colecciones.entries()) {
    const ya = cols.find((c) => c.name === nombre);
    if (ya) { colId[nombre] = ya.id; continue; }
    const ref = db.collection('tienda_collections').doc();
    console.log(`  colección nueva "${nombre}"`);
    if (CONFIRMED) await ref.set({ name: nombre, imageUrl: '', order, brandIds: [LUMI], createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    colId[nombre] = nuevoId(ref);
  }

  // ── 3) Los que ya existían ──────────────────────────────────────────────
  console.log('\n→ Productos que ya existían:');
  for (const r of DATA.existentes) {
    const ref = db.collection('productos_wala').doc(r.id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`No existe ${r.id}`);
    const p = snap.data();
    const cambios = {};
    const nota = [];
    if (p.sku !== r.sku.despues) { cambios.sku = r.sku.despues; nota.push(`SKU ${p.sku}→${r.sku.despues}`); }
    if (r.precio && p.price !== r.precio.despues) { cambios.price = r.precio.despues; nota.push(`S/ ${p.price}→${r.precio.despues}`); }
    if (r.descripcion) {
      if (r.descripcion.modo === 'reemplazar' && !String(p.description || '').includes('Cómo usarlo')) {
        cambios.description = r.descripcion.html; nota.push('descripción nueva');
      } else if (r.descripcion.modo === 'agregar uso' && !String(p.description || '').includes('Cómo usarlo')) {
        cambios.description = String(p.description || '') + r.descripcion.html; nota.push('+ cómo usarlo');
      }
    }
    if (r.categoria) {
      const id = catId(r.categoria.despues);
      if ((p.categories || [])[0] !== id) { cambios.categories = [id]; nota.push(`categoría → ${r.categoria.despues}`); }
    }
    const quiere = r.colecciones.map((n) => colId[n]);
    const actuales = Array.isArray(p.collections) ? p.collections : [];
    const juntas = Array.from(new Set([...actuales, ...quiere]));
    if (juntas.length !== actuales.length) { cambios.collections = juntas; nota.push(`colecciones: ${r.colecciones.join(', ')}`); }
    console.log(`  ${r.nombre}: ${nota.length ? nota.join(' · ') : 'sin cambios'}`);
    if (CONFIRMED && Object.keys(cambios).length) await ref.update({ ...cambios, updatedAt: FieldValue.serverTimestamp() });
  }

  // ── 4) Nuevos ───────────────────────────────────────────────────────────
  console.log('\n→ Productos nuevos:');
  const tags = (await db.collection('tags').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  for (const n of DATA.nuevos) {
    const ref = db.collection('productos_wala').doc(n.id);
    if ((await ref.get()).exists) { console.log(`  ${n.nombre}: ya existe, se salta`); continue; }
    const tag = tags.find((t) => t.name === n.linea);
    if (!tag) throw new Error(`Falta la etiqueta "${n.linea}"`);
    if (!FOTOS) throw new Error('Falta --fotos <carpeta>');
    const local = path.join(FOTOS, `${n.foto}.webp`);
    const copiasLocales = ANCHOS.map((a) => [a, path.join(FOTOS, `${n.foto}_${a}.webp`)]);
    for (const f of [local, ...copiasLocales.map((c) => c[1])]) if (!fs.existsSync(f)) throw new Error(`No está ${f}`);

    let url = `(foto ${n.foto} tras --confirm)`;
    const copias = {};
    if (CONFIRMED) {
      const base = `productos_v2/${n.id}/main_${Date.now()}_${n.id}`;
      url = await uploadImage(local, `${base}.webp`);
      for (const [a, f] of copiasLocales) copias[a] = await uploadImage(f, `${base}_${a}.webp`);
    }
    const varId = `var_${Date.now()}`;
    const colecciones = n.colecciones.map((c) => colId[c]);
    const doc = {
      name: n.nombre,
      nameLower: normalizeSearchText(n.nombre),
      searchTokens: buildSearchTokens(n.nombre, LUMI, BELLEZA),
      categories: [catId(n.categoria)],
      collections: colecciones,
      tags: [tag.id],
      characters: [],
      vendors: [],
      sku: n.sku,
      whatsappEnabled: true,
      whatsappNumber: '',
      whatsappMessage: '',
      productType: BELLEZA,
      brandId: LUMI,
      vendorId: 'casa',
      nicheId: 'regala-con-amor',
      fulfillmentType: 'stock',
      price: n.precio,
      salePrice: null,
      images: [url],
      imagesByColor: { Principal: [url] },
      imagesVariantes: { [url]: copias },
      description: n.descripcion,
      inStock: DATA.stockNuevos,
      customizable: false,
      esPrendaBase: false,
      hasVariants: true,
      mainImage: '',
      mainSizes: [],
      variants: [{
        id: varId, name: 'Principal', imageUrl: url, sizes: [], images: [], galleryImages: [],
        thumbnailCrop: null, imagesCrops: {}, imagesVariantes: { [url]: copias }, sizeLabel: 'Talla', colorHex: '#cccccc',
      }],
      defaultVariantId: varId,
      variantDisplayBehavior: 'default_only',
      behaviorImpressionsThreshold: 3,
      customizationViews: [],
      productCliparts: [],
      featured: false,
      featuredOrder: 0,
      visible: true,
      publico: 'unisex',
      edadMinima: 0,
      isComboProduct: false,
      comboPreviewImage: '',
      thumbnailWithDesignUrl: '',
      personalizarEn: '',
    };
    console.log(`  ${n.id}  "${n.nombre}"  S/ ${n.precio}  ${n.categoria}  [${n.linea}]  foto ${n.foto}  colecciones: ${n.colecciones.join(', ') || '—'}`);
    if (CONFIRMED) {
      const now = FieldValue.serverTimestamp();
      await ref.set({ ...doc, createdAt: now, updatedAt: now, createdAtMs: Date.now() });
    }
  }
  console.log(CONFIRMED ? '\n✓ Listo.' : '\n(prueba terminada: no se escribió nada)');
}

main().then(() => process.exit(0)).catch((err) => { console.error('❌', err.message || err); process.exit(1); });
