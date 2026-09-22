/**
 * Yoryo · añadir colores y subir las fotos de lentes en alta resolución
 * ────────────────────────────────────────────────────────────────────────────
 * Segunda tanda de fotos (Downloads\LENTES-20260922T153707Z-1-001 y la suelta
 * 20260904_165659.jpg). Actualiza productos que YA existen en productos_wala:
 *
 *   R4 Expedición  + variante "Negro Ámbar" (4º color: esfera negra con
 *                    acentos amarillos y correa negra; mismo CURREN de caja
 *                    negra y silicona que los otros tres).
 *   L1 Diamante    pasa de 1 a 3 tintes de cristal — Azul, Humo y Café. La
 *                    montura es la MISMA en los tres (rimless, canto del lente
 *                    tallado en facetas, puente y terminales dorados): se
 *                    comprobó con zoom, lo único que cambia es el cristal.
 *   L1 / L2 / L3   reemplazan sus fotos por las nuevas: las de la primera
 *                    tanda eran de 576x768 (lo que había), estas son de
 *                    2252x4000 y dan 1500x2000 tras el recorte 3:4.
 *
 * NO toca: precios, stock, nombres, categorías, colecciones ni etiquetas.
 * Las fotos viejas quedan en Storage sin referencia (no se borran: sus URLs
 * pueden estar congeladas en pedidos o listas de deseos, mismo criterio que
 * safelyDeleteOldImage en AdminProductoFormV2).
 *
 * Mismo pipeline de imagen que el seed: WebP calidad 0.82 limitado a 2000 px
 * + copias de 160/400/800 y el mapa imagesVariantes por URL.
 *
 * USO:
 *   node scripts/update-yoryo-colores.js            (dry-run)
 *   node scripts/update-yoryo-colores.js --confirm   (escribe de verdad)
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

// ── Imagen: idéntico a seed-yoryo-relojes-lentes.js ────────────────────────
const MAX_LADO = 2000;
const ANCHOS_VARIANTE = [160, 400, 800];
const CALIDAD = 82;
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
  const w = Math.round(meta.width * escala);
  const h = Math.round(meta.height * escala);
  const proporcion = meta.height / meta.width;

  const principalPath = destPathBase.replace(/\.[^./]+$/, '') + '.webp';
  if (!CONFIRMED) {
    const n = ANCHOS_VARIANTE.filter((a) => a < w).length;
    console.log(`      · ${nombreCrop} → ${w}x${h} webp + ${n} copias`);
    return { url: `(dry-run) ${principalPath}`, variantes: {} };
  }

  const buf = await sharp(local).resize({ width: w, height: h }).webp({ quality: CALIDAD }).toBuffer();
  const url = await subirBuffer(buf, principalPath);

  const variantes = {};
  for (const ancho of ANCHOS_VARIANTE) {
    if (ancho >= w) continue;
    try {
      const b = await sharp(local)
        .resize({ width: ancho, height: Math.round(ancho * proporcion) })
        .webp({ quality: CALIDAD }).toBuffer();
      variantes[ancho] = await subirBuffer(b, rutaDeVariante(destPathBase, ancho));
    } catch (e) {
      console.warn(`      ⚠ copia ${ancho}px falló: ${e.message}`);
    }
  }
  console.log(`      · ${nombreCrop} → ${w}x${h} webp + ${Object.keys(variantes).length} copias`);
  return { url, variantes };
}

// ── Qué cambia en cada producto ─────────────────────────────────────────────
// modo 'añadir'    : conserva las variantes que ya tiene y suma las nuevas.
// modo 'reemplazar': rehace la lista de variantes (fotos en alta).
const CAMBIOS = [
  {
    id: 'qVKdfMI5ZMXaBGwkNmoF', etiqueta: 'R4 · Reloj Yoryo Expedición', draft: 'yoryo-r4',
    modo: 'anadir',
    nuevas: [
      { name: 'Negro Ámbar', colorHex: '#1C1C1C', main: 'R4_negro-ambar', gallery: [] },
    ],
  },
  {
    id: 'R78pH03QLmHwpSAuGI7o', etiqueta: 'L1 · Lentes Yoryo Diamante', draft: 'yoryo-l1',
    modo: 'reemplazar',
    nuevas: [
      { name: 'Cristal Azul', colorHex: '#6E8FB8', main: 'L1_azul_a',  gallery: ['L1_azul_b', 'L1_azul_c', 'L1_azul_d'] },
      { name: 'Cristal Humo', colorHex: '#5A5A60', main: 'L1_humo_a',  gallery: ['L1_humo_b'] },
      { name: 'Cristal Café', colorHex: '#8B5E3C', main: 'L1_cafe_a',  gallery: [] },
    ],
  },
  {
    id: 'OvGYD9qhSz7kUxdCBjEn', etiqueta: 'L2 · Lentes Yoryo Versalles', draft: 'yoryo-l2',
    modo: 'reemplazar',
    nuevas: [
      { name: 'Oro Labrado', colorHex: '#C9A24B', main: 'L2_oro_a', gallery: ['L2_oro_b'] },
    ],
  },
  {
    id: 'L2lHIqgLxxqIgp6KONaI', etiqueta: 'L3 · Lentes Yoryo Imperial', draft: 'yoryo-l3',
    modo: 'reemplazar',
    nuevas: [
      { name: 'Plata Grabado', colorHex: '#D9DCE1', main: 'L3_plata_a', gallery: [] },
    ],
  },
];

(async () => {
  console.log(CONFIRMED ? '🚀 ACTUALIZANDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para escribir\n');

  for (const c of CAMBIOS) {
    const ref = db.collection(COLLECTION).doc(c.id);
    const snap = await ref.get();
    if (!snap.exists) { console.error(`❌ No existe ${c.id} (${c.etiqueta}) — lo salto.`); continue; }
    const prod = snap.data();

    console.log(`\n▶ ${c.etiqueta}  [${c.modo}]  variantes ahora: ${(prod.variants || []).length}`);

    const ts = Date.now();
    const cache = new Map();
    const subirUnaVez = async (nombre, destPath) => {
      if (!cache.has(nombre)) cache.set(nombre, await subirFoto(nombre, destPath));
      return cache.get(nombre);
    };

    const nuevasVariantes = [];
    for (let i = 0; i < c.nuevas.length; i++) {
      const v = c.nuevas[i];
      const variantId = `variant_${ts}_${i}`;
      const imagesVariantes = {};

      const principal = await subirUnaVez(v.main, `productos_v2/${c.draft}/main_${variantId}_${ts}_${v.main}.jpg`);
      if (Object.keys(principal.variantes).length) imagesVariantes[principal.url] = principal.variantes;

      const images = [];
      for (const g of v.gallery) {
        const foto = await subirUnaVez(g, `productos_v2/${c.draft}/gallery_${ts}_${g}.jpg`);
        images.push(foto.url);
        if (Object.keys(foto.variantes).length) imagesVariantes[foto.url] = foto.variantes;
      }

      nuevasVariantes.push({
        id: variantId,
        name: v.name,
        imageUrl: principal.url,
        sizes: [],
        images,
        galleryImages: images,
        thumbnailCrop: null,
        imagesCrops: {},
        imagesVariantes,
        colorHex: v.colorHex,
      });
    }

    const variants = c.modo === 'anadir'
      ? [...(prod.variants || []), ...nuevasVariantes]
      : nuevasVariantes;

    const imagesByColor = {};
    variants.forEach((v) => { if (v.imageUrl) imagesByColor[v.name] = [v.imageUrl]; });

    // defaultVariantId debe seguir apuntando a una variante que exista.
    const defaultVariantId = variants.some((v) => v.id === prod.defaultVariantId)
      ? prod.defaultVariantId
      : variants[0].id;

    console.log(`   → quedará con ${variants.length} variante(s): ${variants.map((v) => v.name).join(', ')}`);

    if (!CONFIRMED) continue;

    await ref.update({
      variants,
      imagesByColor,
      defaultVariantId,
      images: [variants[0].imageUrl].filter(Boolean),
      hasVariants: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('   ✅ guardado');
  }

  console.log(CONFIRMED ? '\n🎉 Listo.' : '\n🧪 Dry-run terminado, nada se escribió.');
  process.exit(0);
})().catch((e) => {
  console.error('\n❌ Falló:', e.message);
  process.exit(1);
});
