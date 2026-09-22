/**
 * Reparación: reconstruir `imagesVariantes` de los productos Yoryo
 * ────────────────────────────────────────────────────────────────────────────
 * Las copias pequeñas (160/400/800 px) SÍ están en Storage, pero el Magnate se
 * quedó sin el mapa que las declara —se perdió al copiar el doc de `products` a
 * `productos_wala`— y sin ese mapa OptimizedImage no puede armar el srcSet: la
 * tarjeta de ~320 px descarga la foto de 1500 px.
 *
 * En vez de volver a subir nada, este script mira qué copias existen ya en
 * Storage para cada URL de cada variante, lee su token de descarga real y
 * rehace el mapa { [urlPrincipal]: { 160, 400, 800 } } con la misma forma que
 * escribe uploadFile (services/firebase/storage.js).
 *
 * Es idempotente: solo escribe los productos a los que les falta algo.
 *
 * USO:
 *   node scripts/fix-yoryo-imagesvariantes.js            (dry-run)
 *   node scripts/fix-yoryo-imagesvariantes.js --confirm   (escribe)
 */
'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const CONFIRMED = process.argv.includes('--confirm');

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
const ANCHOS = [160, 400, 800];

/** De una URL de descarga saca la ruta del objeto en el bucket. */
function rutaDeUrl(url) {
  const m = String(url || '').split('/o/')[1];
  if (!m) return null;
  return decodeURIComponent(m.split('?')[0]);
}

function urlDeRuta(ruta, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`;
}

/** Devuelve { 160: url, ... } con las copias que EXISTEN para esa imagen. */
async function copiasDe(url) {
  const ruta = rutaDeUrl(url);
  if (!ruta) return {};
  const base = ruta.replace(/\.[^./]+$/, '');
  const out = {};
  for (const ancho of ANCHOS) {
    const rutaCopia = `${base}_${ancho}.webp`;
    const file = bucket.file(rutaCopia);
    try {
      const [existe] = await file.exists();
      if (!existe) continue;
      const [meta] = await file.getMetadata();
      const token = meta.metadata && meta.metadata.firebaseStorageDownloadTokens;
      if (!token) continue;
      out[ancho] = urlDeRuta(rutaCopia, String(token).split(',')[0]);
    } catch (e) {
      console.warn(`   ⚠ no se pudo leer ${rutaCopia}: ${e.message}`);
    }
  }
  return out;
}

(async () => {
  console.log(CONFIRMED ? '🚀 REPARANDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para escribir\n');

  const snap = await db.collection(COLLECTION).where('brandId', '==', BRAND_ID).get();
  let tocados = 0;

  for (const doc of snap.docs) {
    const prod = doc.data();
    if (prod.deleted === true) continue;

    let cambio = false;
    const variants = [];

    for (const v of (prod.variants || [])) {
      const mapa = { ...(v.imagesVariantes || {}) };
      const urls = [v.imageUrl, ...(v.images || [])].filter(Boolean);

      for (const u of urls) {
        if (mapa[u] && Object.keys(mapa[u]).length) continue;  // ya declarado
        const copias = await copiasDe(u);
        if (Object.keys(copias).length) { mapa[u] = copias; cambio = true; }
      }

      variants.push({
        ...v,
        imagesCrops: v.imagesCrops || {},
        imagesVariantes: mapa,
      });
    }

    const antes = (prod.variants || []).reduce((n, v) => n + Object.keys(v.imagesVariantes || {}).length, 0);
    const despues = variants.reduce((n, v) => n + Object.keys(v.imagesVariantes || {}).length, 0);

    if (!cambio) {
      console.log(`  ✔ ${prod.name.padEnd(32)} ya completo (${antes} imágenes declaradas)`);
      continue;
    }

    console.log(`  ⟳ ${prod.name.padEnd(32)} ${antes} → ${despues} imágenes con copias declaradas`);
    tocados++;

    if (CONFIRMED) {
      await doc.ref.update({ variants, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      // Releer para confirmar que Firestore de verdad lo guardó.
      const check = (await doc.ref.get()).data();
      const real = (check.variants || []).reduce((n, v) => n + Object.keys(v.imagesVariantes || {}).length, 0);
      console.log(real === despues ? '     ✅ guardado y verificado' : `     ❌ guardó ${real}, esperaba ${despues}`);
    }
  }

  console.log(tocados === 0 ? '\nNada que reparar.' : `\n${CONFIRMED ? '🎉 Reparados' : 'Se repararían'}: ${tocados} producto(s).`);
  process.exit(0);
})().catch((e) => {
  console.error('\n❌ Falló:', e.message);
  process.exit(1);
});
