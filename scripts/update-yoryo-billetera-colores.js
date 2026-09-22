/**
 * Yoryo · añadir los colores marrón y negro a la Billetera Cónsul
 * ────────────────────────────────────────────────────────────────────────────
 * Es el MISMO modelo que la azul marino que ya está publicada (se compararon
 * las fotos: trifold, cremallera para monedas, ventana de documento y el mismo
 * tarjetero metálico con la banda azul), así que entran como variantes de
 * color y no como productos nuevos.
 *
 * OJO con la numeración de los archivos: NO significa lo mismo en cada
 * carpeta. En la azul 3=cerrada y 4=tarjetero; en la marrón es al revés
 * (4=cerrada, 3=tarjetero) y la negra va 1,2,3,5 sin 4. El mapeo de abajo está
 * hecho mirando cada foto, no por el número.
 *
 * Portada de cada variante: la billetera CERRADA, igual que en la azul.
 *
 * No toca precio, stock, nombre, categoría ni etiquetas del producto.
 * Imágenes: mismo pipeline (WebP 0.82, máx 2000 px, copias 160/400/800 y el
 * mapa imagesVariantes por URL).
 *
 * USO:
 *   node scripts/update-yoryo-billetera-colores.js            (dry-run)
 *   node scripts/update-yoryo-billetera-colores.js --confirm   (escribe)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const CONFIRMED = process.argv.includes('--confirm');

const SCRATCH = 'C:\\Users\\Isaac\\AppData\\Local\\Temp\\claude\\C--Users-Isaac-Desktop-wala-master\\a4d85752-9071-4cd1-87ab-4878e8761066\\scratchpad';
const CROPS = path.join(SCRATCH, 'crops3');
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
const PRODUCTO_ID = 'NEtavILSA0EoxJgGD7ou';   // Billetera Yoryo Cónsul
const DRAFT = 'yoryo-b1';

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

const NUEVAS = [
  {
    name: 'Marrón Coñac', colorHex: '#6B4226',
    main: 'BILMAR_cerrada',
    gallery: ['BILMAR_abierta_a', 'BILMAR_abierta_b', 'BILMAR_tarjetero'],
  },
  {
    name: 'Negro Azabache', colorHex: '#1A1A1A',
    main: 'BILNEG_cerrada',
    gallery: ['BILNEG_abierta_a', 'BILNEG_abierta_b', 'BILNEG_tarjetero'],
  },
];

(async () => {
  console.log(CONFIRMED ? '🚀 ACTUALIZANDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para escribir\n');

  const ref = db.collection(COLLECTION).doc(PRODUCTO_ID);
  const snap = await ref.get();
  if (!snap.exists) { console.error(`❌ No existe el producto ${PRODUCTO_ID}`); process.exit(1); }
  const prod = snap.data();

  console.log(`▶ ${prod.name} — variantes ahora: ${prod.variants.map((v) => v.name).join(', ')}`);

  // Guardarraíl: no volver a añadir un color que ya esté.
  const yaEstan = new Set(prod.variants.map((v) => v.name));
  const pendientes = NUEVAS.filter((v) => !yaEstan.has(v.name));
  if (pendientes.length === 0) {
    console.log('\nNada que añadir: esos colores ya están.');
    process.exit(0);
  }

  const ts = Date.now();
  const nuevasVariantes = [];
  for (let i = 0; i < pendientes.length; i++) {
    const v = pendientes[i];
    const variantId = `variant_${ts}_bil_${i}`;
    const imagesVariantes = {};
    console.log(`\n   ${v.name}`);

    const principal = await subirFoto(v.main, `productos_v2/${DRAFT}/main_${variantId}_${ts}_${v.main}.jpg`);
    if (Object.keys(principal.variantes).length) imagesVariantes[principal.url] = principal.variantes;

    const images = [];
    for (const g of v.gallery) {
      const foto = await subirFoto(g, `productos_v2/${DRAFT}/gallery_${ts}_${g}.jpg`);
      images.push(foto.url);
      if (Object.keys(foto.variantes).length) imagesVariantes[foto.url] = foto.variantes;
    }

    nuevasVariantes.push({
      id: variantId, name: v.name, imageUrl: principal.url,
      sizes: [], images, galleryImages: images,
      thumbnailCrop: null, imagesCrops: {}, imagesVariantes,
      colorHex: v.colorHex,
    });
  }

  const variants = [...prod.variants, ...nuevasVariantes];
  const imagesByColor = {};
  variants.forEach((v) => { if (v.imageUrl) imagesByColor[v.name] = [v.imageUrl]; });

  console.log(`\n   → quedará con ${variants.length} variantes: ${variants.map((v) => v.name).join(', ')}`);

  if (!CONFIRMED) { console.log('\n🧪 Dry-run terminado, nada se escribió.'); process.exit(0); }

  await ref.update({
    variants,
    imagesByColor,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const check = (await ref.get()).data();
  const ok = check.variants.length === variants.length
    && check.variants.every((v) => Object.keys(v.imagesVariantes || {}).length > 0);
  console.log(ok ? '\n🎉 Guardado y verificado.' : '\n❌ Se guardó pero algo no cuadra, revisar.');
  process.exit(0);
})().catch((e) => {
  console.error('\n❌ Falló:', e.message);
  process.exit(1);
});
