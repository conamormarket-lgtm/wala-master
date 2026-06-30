/**
 * Fase 0 multi-marca — crea las 3 marcas, etiqueta los productos actuales como
 * "Con Amor" y deja lista la página /ConAmor.
 * ────────────────────────────────────────────────────────────────────────────
 * Decisiones del usuario (ver docs/wala/PLAN-MULTIMARCA.md):
 *   - 1 producto = 1 marca (campo brandId = doc id de tienda_brands).
 *   - TODOS los productos actuales son "Con Amor" (backfill a los que tengan brandId vacío).
 *   - 3 primeras marcas: Con Amor (base), MUSSA, MUEBLERIA.
 *
 * QUÉ HACE (idempotente):
 *   1. Crea/encuentra en `tienda_brands` las marcas: Con Amor (slug ConAmor),
 *      MUSSA (slug MUSSA), MUEBLERIA (slug MUEBLERIA). Si ya existe una con ese
 *      nombre o slug, la REUTILIZA (y le añade el slug si le falta). No duplica.
 *   2. Backfill: a cada doc de `productos_wala` con brandId vacío/ausente le pone
 *      brandId = <doc id de Con Amor>. No toca los que ya tienen marca.
 *   3. Crea las landing pages `landingPages/ConAmor`, `landingPages/MUSSA` y
 *      `landingPages/MUEBLERIA` (id === slug) para que las rutas WALA.PE/ConAmor,
 *      WALA.PE/MUSSA y WALA.PE/MUEBLERIA resuelvan vía DynamicLandingPage (/:slug);
 *      las secciones (sidebar_catalog con la marca) las coloca el dueño desde el
 *      editor visual.
 *
 * SEGURIDAD: DRY-RUN por defecto (no escribe). Pasa --apply para aplicar.
 * SOLO toca brandId/slug; NO toca precios, stock ni nada más de los productos.
 *
 * USO (Cloud Shell):
 *   cd ~/wala-master
 *   node scripts/setup-marcas.js --project sistema-gestion-3b225            # revisar
 *   node scripts/setup-marcas.js --project sistema-gestion-3b225 --apply    # aplicar
 */

'use strict';

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const getOpt = (n, d = null) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const apply = has('--apply');
const projectId = getOpt('--project') || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'sistema-gestion-3b225';

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const BATCH = 400;
const norm = (s) => String(s || '').trim().toLowerCase();

// Marcas a garantizar. La PRIMERA (Con Amor) es la marca canónica del catálogo actual.
const MARCAS = [
  { slug: 'ConAmor', name: 'Con Amor' },
  { slug: 'MUSSA', name: 'MUSSA' },
  { slug: 'MUEBLERIA', name: 'MUEBLERIA' },
];

async function garantizarMarca({ slug, name }) {
  // Buscar por slug o por nombre (case-insensitive) para NO duplicar.
  const snap = await db.collection('tienda_brands').get();
  const existente = snap.docs.find((d) => {
    const x = d.data() || {};
    return norm(x.slug) === norm(slug) || norm(x.name) === norm(name);
  });
  if (existente) {
    const data = existente.data() || {};
    const faltaSlug = !data.slug;
    console.log(`  • "${name}": YA existe (id=${existente.id})${faltaSlug ? ' — le falta slug' : ` slug=${data.slug}`}`);
    if (faltaSlug && apply) {
      await existente.ref.set({ slug }, { merge: true });
      console.log(`     ↳ slug '${slug}' añadido`);
    }
    return existente.id;
  }
  console.log(`  • "${name}": NO existe → ${apply ? 'creando' : 'se crearía'} (slug=${slug})`);
  if (!apply) return `(nuevo:${slug})`;
  const ref = await db.collection('tienda_brands').add({
    name, slug, logoUrl: '', order: 0, bgColor: '', bgImage: '', bgOpacity: 0,
    whatsappNumber: '', createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`     ↳ creada id=${ref.id}`);
  return ref.id;
}

async function backfillProductos(conAmorId) {
  const snap = await db.collection('productos_wala').get();
  let total = snap.size, sinMarca = 0, yaTienen = 0;
  const pendientes = [];
  snap.forEach((d) => {
    const b = (d.data() || {}).brandId;
    if (b == null || b === '') { sinMarca += 1; pendientes.push(d.ref); }
    else yaTienen += 1;
  });
  console.log(`  productos_wala: ${total} total · ${yaTienen} ya con marca · ${sinMarca} sin marca → ${apply ? 'asignando' : 'se asignarían'} a Con Amor`);
  if (!apply || !pendientes.length) return { total, sinMarca };
  if (!conAmorId || String(conAmorId).startsWith('(nuevo')) { console.log('  ⚠️ sin id real de Con Amor, no se hace backfill'); return { total, sinMarca }; }
  for (let i = 0; i < pendientes.length; i += BATCH) {
    const batch = db.batch();
    pendientes.slice(i, i + BATCH).forEach((ref) => batch.set(ref, { brandId: conAmorId }, { merge: true }));
    await batch.commit();
    console.log(`     ↳ ${Math.min(i + BATCH, pendientes.length)}/${pendientes.length}`);
  }
  return { total, sinMarca };
}

// Crea (idempotente) la landingPage de una marca con id === slug, para que la ruta
// WALA.PE/<slug> resuelva vía DynamicLandingPage (/:slug). NO toca la página si ya existe.
// Escribe TAMBIÉN brandId = <doc id de la marca> para que la página tenga su marca
// explícita (pageBrandId) sin configurar secciones a mano. Aditivo (merge:true).
async function garantizarLandingMarca({ slug, name }, brandId) {
  const ref = db.collection('landingPages').doc(slug); // id === slug (seguro)
  // brandId real solo si tenemos el id de la marca (no el placeholder de dry-run).
  const tieneBrandId = brandId && !String(brandId).startsWith('(nuevo');
  const snap = await ref.get();
  if (snap.exists) { console.log(`  landingPages/${slug}: ya existe`); return; }
  console.log(`  landingPages/${slug}: ${apply ? 'creando' : 'se crearía'} (para que WALA.PE/${slug} resuelva)${tieneBrandId ? ` · brandId=${brandId}` : ''}`);
  if (apply) {
    const payload = { slug, name, createdAt: FieldValue.serverTimestamp() };
    // brandId explícito (pageBrandId) cuando se conoce el id real de la marca.
    if (tieneBrandId) payload.brandId = brandId;
    await ref.set(payload, { merge: true });
    console.log(`     ↳ creada${tieneBrandId ? ` con brandId=${brandId}` : ''} (las secciones las colocas en el editor visual)`);
  }
}

(async () => {
  console.log(`\nFase 0 multi-marca · proyecto ${projectId} · modo ${apply ? 'APLICAR' : 'DRY-RUN'}\n`);
  console.log('1) Marcas:');
  const ids = {};
  for (const m of MARCAS) ids[m.slug] = await garantizarMarca(m);
  const conAmorId = ids['ConAmor'];
  console.log(`\n2) Backfill de productos → Con Amor (id=${conAmorId}):`);
  await backfillProductos(conAmorId);
  console.log('\n3) Páginas de marca (landingPages, id === slug):');
  // Pasa el id real de cada marca (ids[m.slug]) para guardar brandId en su landingPage.
  for (const m of MARCAS) await garantizarLandingMarca(m, ids[m.slug]);
  console.log(`\n${apply ? '✅ Listo.' : 'DRY-RUN: nada escrito. Repite con --apply para aplicar.'}`);
  console.log(`Con Amor brandId = ${conAmorId}  (úsalo si lo necesitas en el editor)\n`);
  process.exit(0);
})().catch((e) => { console.error('Fallo:', e.message); process.exit(1); });
