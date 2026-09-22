/**
 * Yoryo · corregir la altura del hero tras pasarlo a carrusel
 * ────────────────────────────────────────────────────────────────────────────
 * Al convertir el hero se tomó `minHeight: 600px` de los settings como si
 * fuera la altura del banner, y no lo era: HeroBanner.module.css la calcula
 * con `height: 95vh` y usa los 600px solo como piso. En una pantalla normal
 * eso son ~800px, así que el hero quedó ~200px más bajo de lo que estaba.
 *
 * Reglas reales del banner que hay que replicar:
 *
 *   escritorio   height: 95vh;  min-height: 600px;
 *   ≤768px       height: 78vh;  min-height: 420px;  max-height: 640px;
 *
 * HeroCarousel aplica la altura como `height: var(--hero-height-desktop)`, que
 * acepta cualquier valor CSS, así que los mínimos y máximos se expresan con
 * max() y clamp() en vez de perderse.
 *
 * USO:
 *   node scripts/fix-yoryo-hero-altura.js            (dry-run)
 *   node scripts/fix-yoryo-hero-altura.js --confirm   (escribe)
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

const PAGE_ID = 'yoryo';
// Equivalentes exactos de HeroBanner.module.css.
const ALTO_ESCRITORIO = 'max(95vh, 600px)';
const ALTO_MOVIL = 'clamp(420px, 78vh, 640px)';

(async () => {
  console.log(CONFIRMED ? '🚀 ESCRIBIENDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para escribir\n');

  const ref = db.collection('pages').doc(PAGE_ID);
  const snap = await ref.get();
  const page = snap.data();
  const sections = Array.isArray(page.sections) ? page.sections : [];

  const idx = sections.findIndex((s) => s.type === 'hero_carousel');
  if (idx === -1) { console.error('❌ No hay hero_carousel en esta página.'); process.exit(1); }

  const s = sections[idx].settings || {};
  console.log(`▶ pages/${PAGE_ID} — "${sections[idx].id}"`);
  console.log(`   escritorio: ${s.heightDesktop}  ⇒  ${ALTO_ESCRITORIO}   (el banner era height:95vh, min 600px)`);
  console.log(`   móvil:      ${s.heightMobile}  ⇒  ${ALTO_MOVIL}   (era 78vh, min 420px, max 640px)`);

  if (!CONFIRMED) { console.log('\n🧪 Dry-run terminado, nada se escribió.'); process.exit(0); }

  const nuevas = [...sections];
  nuevas[idx] = {
    ...sections[idx],
    settings: { ...s, heightDesktop: ALTO_ESCRITORIO, heightMobile: ALTO_MOVIL },
  };
  await ref.update({ sections: nuevas });

  const after = (await ref.get()).data();
  const hero = (after.sections || [])[idx];
  const ok = hero.settings.heightDesktop === ALTO_ESCRITORIO
    && hero.settings.heightMobile === ALTO_MOVIL
    && (hero.settings.slides || []).length === (s.slides || []).length
    && after.sections.length === sections.length;
  console.log(ok ? '   ✅ guardado y verificado' : '   ❌ algo no cuadra');
  process.exit(0);
})().catch((e) => { console.error('\n❌ Falló:', e.message); process.exit(1); });
