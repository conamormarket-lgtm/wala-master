/**
 * Yoryo · gancho de venta en la tarjeta de los combos
 * ────────────────────────────────────────────────────────────────────────────
 * Hasta ahora "la esclava va gratis" solo se leía en la ficha: la tarjeta del
 * catálogo mostraba un S/240 limpio y nada más. El dueño quiere que el gancho
 * se vea desde la parrilla, así que se tiran las dos palancas que la tarjeta
 * entiende sin tocar código:
 *
 *   1. El NOMBRE lo anuncia   → "... + Esclava GRATIS"
 *   2. El PRECIO se tacha     → price 290, salePrice 240, que enciende el
 *                               badge OFERTA y el tachado.
 *
 * Lo que se cobra NO cambia: siguen siendo S/240. El 290 tachado es el precio
 * real de las tres piezas sueltas (120 reloj + 50 esclava + 120 billetera), no
 * un ancla inventada.
 *
 * Esto es la excepción a "no habrán ofertas": aplica SOLO a los 3 combos, que
 * es donde el ahorro existe de verdad. Los 11 productos sueltos siguen sin
 * salePrice.
 *
 * Al cambiar el nombre hay que rehacer nameLower y searchTokens, que son
 * campos derivados: si no, el buscador de la tienda seguiría indexando el
 * nombre viejo (ver normalizeProductPayload en src/services/products.js).
 *
 * USO:
 *   node scripts/update-yoryo-combos-gancho.js            (dry-run)
 *   node scripts/update-yoryo-combos-gancho.js --confirm   (escribe)
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

const COLLECTION = 'productos_wala';
const BRAND_ID = 'rEPEpl4Hvzi6ogOBHn7x';
const TIPO_COMBO = 'N2rTN3na2tb7LrZqL8E9';

const PRECIO_LISTA = 290;   // 120 + 50 + 120, las tres piezas sueltas
const PRECIO_COMBO = 240;   // lo que realmente se cobra

// Nombre nuevo por SKU, con el gancho DELANTE.
//
// El título de la tarjeta está recortado a 2 líneas (-webkit-line-clamp: 2).
// Con el gancho al final —"... + Reloj + Billetera + Esclava GRATIS"— se
// perdía justo donde más se ve: medido en la tienda, en el carrusel "Ofertas"
// el título mide 137 px y los tres quedaban cortados en "COMBO YORYO
// MEDIANOCHE ·…", y en la parrilla (237 px) se cortaba el Medianoche. Delante
// entra siempre, incluso en la tarjeta más angosta.
//
// Las piezas que incluye no se pierden: la tarjeta ya las lista en su riel
// "Incluye" (Reloj / Esclava / Billetera) encima del título.
const NOMBRES = {
  'YRY-COMBO-ONIX': 'Esclava GRATIS · Combo Yoryo Ónix',
  'YRY-COMBO-ORO': 'Esclava GRATIS · Combo Yoryo Oro',
  'YRY-COMBO-NOCHE': 'Esclava GRATIS · Combo Yoryo Medianoche',
};

// ── Búsqueda — copiado literal de src/services/products.js ─────────────────
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

(async () => {
  console.log(CONFIRMED ? '🚀 ACTUALIZANDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para escribir\n');

  const combos = await db.collection(COLLECTION)
    .where('brandId', '==', BRAND_ID)
    .where('isComboProduct', '==', true)
    .get();

  console.log(`Combos: ${combos.size}\n`);

  for (const doc of combos.docs) {
    const x = doc.data();
    const nombre = NOMBRES[x.sku];
    if (!nombre) { console.error(`   ⚠ sin nombre nuevo para SKU ${x.sku} — lo salto`); continue; }

    console.log(`▶ ${x.name}`);
    console.log(`   nombre  ⇒ ${nombre}`);
    console.log(`   precio  ⇒ S/${PRECIO_COMBO} con S/${PRECIO_LISTA} tachado (badge OFERTA)`);

    if (!CONFIRMED) continue;

    await doc.ref.update({
      name: nombre,
      nameLower: normalizeSearchText(nombre),
      searchTokens: buildSearchTokens(nombre, BRAND_ID, TIPO_COMBO),
      price: PRECIO_LISTA,
      salePrice: PRECIO_COMBO,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('   ✅ actualizado');
  }

  if (CONFIRMED) {
    console.log('\n── verificación ──');
    let mal = 0;

    const after = await db.collection(COLLECTION)
      .where('brandId', '==', BRAND_ID).where('isComboProduct', '==', true).get();
    after.forEach((d) => {
      const y = d.data();
      const ok = y.price === PRECIO_LISTA
        && y.salePrice === PRECIO_COMBO
        && /GRATIS/.test(y.name)
        && y.nameLower === normalizeSearchText(y.name)
        && (y.searchTokens || []).includes('gratis');
      if (!ok) {
        mal++;
        console.log(`  ❌ ${y.name}: price=${y.price} sale=${y.salePrice} tokensOk=${(y.searchTokens || []).includes('gratis')}`);
      }
    });
    console.log(mal === 0 ? `  ✅ los ${after.size} combos con gancho, S/${PRECIO_COMBO} sobre S/${PRECIO_LISTA} tachado y búsqueda reindexada` : `  ❌ ${mal} con problemas`);

    // Los sueltos NO deben haberse contagiado de la oferta.
    const sueltos = await db.collection(COLLECTION)
      .where('brandId', '==', BRAND_ID).where('isComboProduct', '==', false).get();
    const conOferta = sueltos.docs.filter((d) => d.data().deleted !== true && d.data().salePrice);
    console.log(conOferta.length === 0
      ? '  ✅ ningún producto suelto quedó con oferta'
      : `  ❌ ${conOferta.length} sueltos con oferta: ${conOferta.map((d) => d.data().name).join(', ')}`);
  }

  console.log(CONFIRMED ? '\n🎉 Listo.' : '\n🧪 Dry-run terminado, nada se escribió.');
  process.exit(0);
})().catch((e) => { console.error('\n❌ Falló:', e.message); process.exit(1); });
