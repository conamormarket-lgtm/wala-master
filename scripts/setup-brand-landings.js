/**
 * setup-brand-landings.js
 *
 * Backfill: crea la PÁGINA DE MARCA (landing + layout con catálogo) para TODAS las
 * marcas de `tienda_brands` que aún no la tengan, para que WALA.PE/<slug> muestre
 * solo los productos de esa marca.
 *
 * Por cada marca:
 *   - landingPages/{slug}: { slug, brandId } — conecta la URL con la marca.
 *   - pages/{slug}: layout = encabezado + catálogo (sidebar_catalog con su brandId).
 *     Solo se crea si la página NO tiene secciones (no pisa layouts ya editados).
 *
 * Es IDEMPOTENTE y NO destructivo: no toca productos ni marcas; solo crea las
 * landings/páginas faltantes. Correrlo varias veces no duplica nada.
 *
 * USO (Cloud Shell / producción):
 *   cd ~/wala-master
 *   node scripts/setup-brand-landings.js --project sistema-gestion-3b225           # revisar (dry-run)
 *   node scripts/setup-brand-landings.js --project sistema-gestion-3b225 --apply   # aplicar
 *
 * USO (emulador local):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/setup-brand-landings.js --apply
 */

'use strict';

const path = require('path');
// firebase-admin vive en functions/node_modules en local; en Cloud Shell puede estar
// en la raíz. Resolvemos desde ambos para que el script corra en los dos entornos.
const admin = require(require.resolve('firebase-admin', {
  paths: [path.join(__dirname, '..', 'functions', 'node_modules'), path.join(__dirname, '..')],
}));

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const getOpt = (n, d = null) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const apply = has('--apply');
const projectId = getOpt('--project') || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'demo-wala';

// En emulador basta el projectId (sin credenciales); en producción usa applicationDefault().
const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
admin.initializeApp(isEmulator ? { projectId } : { credential: admin.credential.applicationDefault(), projectId });
const db = admin.firestore();

// Mismo slugify que src/services/brands.js (minúsculas, sin acentos, solo a-z0-9).
const slugify = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '');

const buildBrandCatalogSections = (brandId, name) => ([
  { id: 'sec_header', type: 'header', order: 0, settings: {
    title: name || 'Nuestra Tienda',
    subtitle: name ? `Productos de ${name}` : 'Explora nuestros productos.',
    backgroundColor: 'transparent', titleColor: '#000000', subtitleColor: '#666666',
    textAlign: 'center', paddingTop: '3rem', paddingBottom: '2rem',
    titleAlign: '', titleUnderline: false, titleBg: '', titleLink: '',
  }},
  { id: 'sec_catalog', type: 'sidebar_catalog', order: 1, settings: {
    title: name ? `Productos ${name}` : 'Catálogo', brandId,
    backgroundColor: 'transparent', paddingTop: '2rem', paddingBottom: '2rem',
    titleAlign: '', titleUnderline: false, titleBg: '', titleLink: '', buttonText: '', buttonLink: '',
  }},
]);

// ¿Ya hay una landing (en landingPages) apuntando a este brandId o slug?
async function landingExiste(slug, brandId) {
  const bySlug = await db.collection('landingPages').where('slug', '==', slug).limit(1).get();
  if (!bySlug.empty) return true;
  const byBrand = await db.collection('landingPages').where('brandId', '==', brandId).limit(1).get();
  return !byBrand.empty;
}

(async () => {
  console.log(`\n=== Backfill de landings de marca ===`);
  console.log(`Proyecto: ${projectId} ${isEmulator ? '(EMULADOR)' : '(PRODUCCIÓN)'} | modo: ${apply ? 'APLICAR' : 'DRY-RUN (revisar)'}\n`);

  const marcasSnap = await db.collection('tienda_brands').get();
  if (marcasSnap.empty) { console.log('No hay marcas en tienda_brands.'); process.exit(0); }

  let creadas = 0, yaExistian = 0, sinSlug = 0;

  for (const doc of marcasSnap.docs) {
    const brandId = doc.id;
    const data = doc.data() || {};
    const name = data.name || '';
    const slug = data.slug ? slugify(data.slug) : slugify(name);

    if (!slug) {
      console.log(`  ⚠ "${name || brandId}": sin slug ni nombre válido → OMITIDA`);
      sinSlug++;
      continue;
    }

    const existe = await landingExiste(slug, brandId);
    if (existe) {
      console.log(`  • "${name}" (/${slug}): landing YA existe → se omite`);
      yaExistian++;
      continue;
    }

    if (!apply) {
      console.log(`  + "${name}" (/${slug}): se CREARÍA landing + página (brandId=${brandId})`);
      creadas++;
      continue;
    }

    // 1) landingPages/{slug}
    await db.collection('landingPages').doc(slug).set(
      { slug, brandId, title: name || slug, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    // 2) pages/{slug} — solo si no tiene secciones
    const pageRef = db.collection('pages').doc(slug);
    const pageSnap = await pageRef.get();
    const tieneSecciones = pageSnap.exists && Array.isArray((pageSnap.data() || {}).sections) && (pageSnap.data() || {}).sections.length > 0;
    if (!tieneSecciones) {
      await pageRef.set({ sections: buildBrandCatalogSections(brandId, name), updatedAt: new Date().toISOString() }, { merge: true });
    }
    console.log(`  ✓ "${name}" (/${slug}): landing + página creadas`);
    creadas++;
  }

  console.log(`\nResumen: ${creadas} ${apply ? 'creadas' : 'por crear'} | ${yaExistian} ya existían | ${sinSlug} sin slug`);
  if (!apply) console.log(`\n(dry-run) Vuelve a correr con --apply para aplicar los cambios.\n`);
  process.exit(0);
})().catch((e) => { console.error('Error:', e?.message || e); process.exit(1); });
