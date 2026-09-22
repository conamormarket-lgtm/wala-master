/**
 * Yoryo · repartir el catálogo en categorías por tipo
 * ────────────────────────────────────────────────────────────────────────────
 * Para poder armar la página como novarisperu.com —una fila de productos por
 * tipo— hace falta que los productos estén EN categorías distintas. Hoy los 14
 * visibles de Yoryo están todos en "Relojes y accesorios" (accesorios), así
 * que cuatro secciones "Carrusel por categoría" mostrarían las cuatro lo
 * mismo.
 *
 * Esto no requiere ningún cambio de código: el builder ya trae la sección
 * "Carrusel por categoría" (SECTION_TYPES en Tienda/services/storefront.js) y
 * ProductQueryCarousel la acota sola a la marca de la página. Lo único que
 * faltaba eran los datos.
 *
 * Se crean 4 categorías habilitadas para Yoryo (brandIds) y se reasigna cada
 * producto. Una sola categoría por producto: es lo que guarda el formulario
 * del admin (categories: [form.category] en AdminProductoFormV2), así que
 * repartirlos así no se pisa con una edición posterior.
 *
 * A cada categoría se le pone de imagen la foto de un producto suyo, porque
 * "Navegación por categorías" y "Cuadrícula de Categorías" las pintan con
 * imagen y si no se ven vacías.
 *
 * La esclava NO se toca: está oculta (visible:false) y getProductsByCategory
 * descarta lo no visible, así que no aparecería en ningún carrusel.
 *
 * USO:
 *   node scripts/seed-yoryo-categorias.js            (dry-run)
 *   node scripts/seed-yoryo-categorias.js --confirm   (escribe)
 */
'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const fnModules = path.join(ROOT, 'functions', 'node_modules');
const CONFIRMED = process.argv.includes('--confirm');

const admin = require(require.resolve('firebase-admin', { paths: [fnModules] }));
const sa = JSON.parse(fs.readFileSync(path.join(ROOT, 'serviceAccountKey.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
const db = admin.firestore();

const PRODUCTOS = 'productos_wala';
const CATEGORIAS = 'tienda_categories';
const BRAND_ID = 'rEPEpl4Hvzi6ogOBHn7x';

// Cada grupo: la categoría que se crea y los productos que se mueven a ella.
// `portada` es el producto del que se toma la imagen de la categoría.
const GRUPOS = [
  {
    nombre: 'Relojes', portada: 'foF1l7x33v3zFmRs2CVG',
    productos: [
      ['foF1l7x33v3zFmRs2CVG', 'Reloj Yoryo Magnate'],
      ['BrSFBNeep6FXODg4Pqyp', 'Reloj Yoryo Monarca'],
      ['AuBNmqrZQkgLeXk2MBnp', 'Reloj Yoryo Titán'],
      ['qVKdfMI5ZMXaBGwkNmoF', 'Reloj Yoryo Expedición'],
      ['z4CmzlhW29u3eOdIlNfw', 'Reloj Yoryo Eclipse'],
      ['NubeDxyOrTMwZDnjmrUL', 'Set Yoryo Alianza · Él & Ella'],
    ],
  },
  {
    nombre: 'Lentes', portada: 'R78pH03QLmHwpSAuGI7o',
    productos: [
      ['R78pH03QLmHwpSAuGI7o', 'Lentes Yoryo Diamante'],
      ['OvGYD9qhSz7kUxdCBjEn', 'Lentes Yoryo Versalles'],
      ['L2lHIqgLxxqIgp6KONaI', 'Lentes Yoryo Imperial'],
      ['JbO3IFaCRX57CwGtSIj5', 'Lentes de Sol Yoryo Obsidiana'],
    ],
  },
  {
    nombre: 'Billeteras', portada: 'NEtavILSA0EoxJgGD7ou',
    productos: [
      ['NEtavILSA0EoxJgGD7ou', 'Billetera Yoryo Cónsul'],
    ],
  },
  {
    nombre: 'Combos', portada: 'ZEz7WkCa6bsvWh8Feikn',
    productos: [
      ['ZEz7WkCa6bsvWh8Feikn', 'Combo Ónix'],
      ['xpRJ063Yl1NNIgSQ8KcY', 'Combo Oro'],
      ['d5D5duDB8Ess8dSRuGnU', 'Combo Medianoche'],
    ],
  },
];

/** Imagen representativa de un producto (portada de su primera variante). */
function fotoDe(prod) {
  if (prod?.comboPreviewImage) return prod.comboPreviewImage;
  const v = (prod?.variants || [])[0];
  return v?.imageUrl || (prod?.images || [])[0] || prod?.mainImage || '';
}

(async () => {
  console.log(CONFIRMED ? '🚀 ESCRIBIENDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para escribir\n');

  // Categorías que ya existen, por nombre.
  const catSnap = await db.collection(CATEGORIAS).get();
  const porNombre = new Map();
  catSnap.forEach((d) => porNombre.set(String(d.data().name || '').trim().toLowerCase(), { id: d.id, ...d.data() }));

  for (const g of GRUPOS) {
    console.log(`\n▶ ${g.nombre}  (${g.productos.length} producto${g.productos.length === 1 ? '' : 's'})`);

    // Foto de portada de la categoría.
    const portadaDoc = await db.collection(PRODUCTOS).doc(g.portada).get();
    const imageUrl = fotoDe(portadaDoc.data());

    // ── Categoría: crear o habilitar para Yoryo si ya existía ──────────────
    let catId;
    const existente = porNombre.get(g.nombre.toLowerCase());
    if (existente) {
      catId = existente.id;
      const brandIds = Array.isArray(existente.brandIds) ? existente.brandIds : [];
      if (!brandIds.includes(BRAND_ID)) {
        console.log(`   categoría "${g.nombre}" ya existe (${catId}) — se le añade Yoryo a brandIds`);
        if (CONFIRMED) await db.collection(CATEGORIAS).doc(catId).update({ brandIds: [...brandIds, BRAND_ID] });
      } else {
        console.log(`   categoría "${g.nombre}" ya existe y ya es de Yoryo (${catId})`);
      }
    } else if (CONFIRMED) {
      const ref = await db.collection(CATEGORIAS).add({
        name: g.nombre,
        imageUrl,
        brandIds: [BRAND_ID],
      });
      catId = ref.id;
      console.log(`   ✅ categoría creada (${catId})`);
    } else {
      catId = '(dry-run)';
      console.log(`   categoría SE CREARÍA — brandIds:[Yoryo], imagen del ${g.portada}`);
    }

    // ── Productos ──────────────────────────────────────────────────────────
    for (const [id, nombre] of g.productos) {
      const ref = db.collection(PRODUCTOS).doc(id);
      const snap = await ref.get();
      if (!snap.exists) { console.error(`   ❌ no existe ${id} (${nombre})`); continue; }
      const antes = (snap.data().categories || []).join(', ') || '(sin categoría)';
      console.log(`      ${nombre.padEnd(32)} [${antes}] ⇒ ${g.nombre}`);
      if (CONFIRMED) {
        await ref.update({
          categories: [catId],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }

  // ── Verificación ─────────────────────────────────────────────────────────
  if (CONFIRMED) {
    console.log('\n── verificación ──');
    let mal = 0;
    for (const g of GRUPOS) {
      const cat = (await db.collection(CATEGORIAS).get()).docs
        .find((d) => String(d.data().name || '').trim().toLowerCase() === g.nombre.toLowerCase());
      if (!cat) { mal++; console.log(`  ❌ falta la categoría ${g.nombre}`); continue; }

      // La misma query que hace el carrusel de la tienda.
      const q = await db.collection(PRODUCTOS).where('categories', 'array-contains', cat.id).get();
      const visiblesYoryo = q.docs.filter((d) => d.data().brandId === BRAND_ID && d.data().visible !== false);
      const ok = visiblesYoryo.length === g.productos.length;
      if (!ok) mal++;
      console.log(`  ${ok ? '✅' : '❌'} ${g.nombre.padEnd(12)} el carrusel traería ${visiblesYoryo.length} producto(s), esperados ${g.productos.length}`);
    }

    // Nada debe quedar huérfano en la categoría vieja.
    const viejos = await db.collection(PRODUCTOS)
      .where('categories', 'array-contains', 'accesorios').get();
    const quedan = viejos.docs.filter((d) => d.data().brandId === BRAND_ID && d.data().visible !== false);
    console.log(quedan.length === 0
      ? '  ✅ no queda ningún producto visible de Yoryo en "Relojes y accesorios"'
      : `  ⚠ quedan ${quedan.length} en "Relojes y accesorios": ${quedan.map((d) => d.data().name).join(', ')}`);

    console.log(mal === 0 ? '\n🎉 Listo.' : `\n❌ ${mal} grupo(s) con problemas.`);
  } else {
    console.log('\n🧪 Dry-run terminado, nada se escribió.');
  }
  process.exit(0);
})().catch((e) => { console.error('\n❌ Falló:', e.message); process.exit(1); });
