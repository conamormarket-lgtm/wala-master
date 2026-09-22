/**
 * Yoryo · el hero pasa de banner fijo a carrusel (con una sola imagen)
 * ────────────────────────────────────────────────────────────────────────────
 * El dueño quiere la funcionalidad de carrusel disponible —poder ir sumando
 * banners de promos— pero que MIENTRAS HAYA UNA SOLA IMAGEN se vea y funcione
 * igual que hoy.
 *
 * Eso sale gratis: HeroCarousel ya se comporta así con un solo slide. Los
 * controles están detrás de `filteredSlides.length > 1` (HeroCarousel.jsx:257)
 * y el autoplay sale temprano con `filteredSlides.length <= 1` (línea 65). O
 * sea: sin flechas, sin puntos y sin transiciones hasta que haya una segunda.
 *
 * Lo que sí hay que traducir son los defaults, que NO coinciden con los del
 * banner y si no cambiarían la pinta de la página:
 *
 *   hero_banner                     hero_carousel (default)   se fuerza a
 *   ───────────────────────────     ──────────────────────    ────────────
 *   a sangre (sin padding)          4vw a los lados           fullWidth: true
 *   minHeight 600px                 450px escritorio          heightDesktop 600px
 *                                   350px móvil               heightMobile 600px
 *   sin esquinas redondeadas        borderRadius 16px         borderRadius '0'
 *
 * El resto (imagen, título, subtítulo, botón, colores y la opacidad 40 del
 * velo) se copia tal cual del banner al primer slide.
 *
 * Se conservan el id (sec_hero) y el order (0) de la sección, y las otras 5
 * secciones de la página no se tocan. Antes de escribir se guarda una copia
 * del documento en pages_backup/.
 *
 * USO:
 *   node scripts/update-yoryo-hero-carousel.js            (dry-run)
 *   node scripts/update-yoryo-hero-carousel.js --confirm   (escribe)
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

(async () => {
  console.log(CONFIRMED ? '🚀 ESCRIBIENDO DE VERDAD\n' : '🧪 DRY-RUN — usa --confirm para escribir\n');

  const ref = db.collection('pages').doc(PAGE_ID);
  const snap = await ref.get();
  if (!snap.exists) { console.error(`❌ No existe pages/${PAGE_ID}`); process.exit(1); }

  const page = snap.data();
  const sections = Array.isArray(page.sections) ? page.sections : [];

  const idx = sections.findIndex((s) => s.type === 'hero_banner');
  if (idx === -1) {
    const yaCarrusel = sections.find((s) => s.type === 'hero_carousel');
    console.log(yaCarrusel
      ? `Ya es un carrusel (${(yaCarrusel.settings?.slides || []).length} slide(s)). Nada que hacer.`
      : 'No hay ninguna sección hero en esta página.');
    process.exit(0);
  }

  const vieja = sections[idx];
  const s = vieja.settings || {};

  const slide = {
    imageUrl: s.mediaUrl || '',
    mobileImageUrl: '',
    link: '',
    alt: s.title || 'Yoryo',
    title: s.title || '',
    subtitle: s.subtitle || '',
    buttonText: s.buttonText || '',
    buttonLink: s.buttonLink || '',
    // El banner centraba el texto (textPosition/textAlign: 'center').
    contentPosition: s.textAlign || s.textPosition || 'center',
    verticalPosition: 'center',
    imagePosition: 'center center',
    titleColor: s.titleColor || '#ffffff',
    subtitleColor: s.subtitleColor || '#ffffff',
    buttonBgColor: s.buttonBgColor || '#ffffff',
    buttonTextColor: s.buttonTextColor || '#111827',
    overlayColor: '#111827',
    overlayOpacity: typeof s.overlayOpacity === 'number' ? s.overlayOpacity : 20,
  };

  const nueva = {
    ...vieja,                 // conserva id y order
    type: 'hero_carousel',
    settings: {
      slides: [slide],
      autoPlay: true,
      autoPlaySpeed: 5000,
      pauseOnHover: true,
      showArrows: true,
      showDots: true,
      // Igualar la pinta del banner (ver cabecera).
      fullWidth: true,
      heightDesktop: s.minHeight || '600px',
      heightMobile: s.minHeight || '600px',
      borderRadius: '0',
      // Fondo de sección, por si el editor lo había puesto.
      ...(s.backgroundColor ? { backgroundColor: s.backgroundColor } : {}),
      ...(s.paddingTop ? { paddingTop: s.paddingTop } : {}),
      ...(s.paddingBottom ? { paddingBottom: s.paddingBottom } : {}),
    },
  };

  console.log(`▶ pages/${PAGE_ID} — sección [${idx}] "${vieja.id}"`);
  console.log(`   hero_banner ⇒ hero_carousel con 1 slide`);
  console.log(`   imagen:   ${slide.imageUrl.slice(0, 92)}…`);
  console.log(`   texto:    "${slide.title}" / "${slide.subtitle}" / botón "${slide.buttonText}" → ${slide.buttonLink}`);
  console.log(`   alto:     ${nueva.settings.heightDesktop} (escritorio) · ${nueva.settings.heightMobile} (móvil)`);
  console.log(`   a sangre: ${nueva.settings.fullWidth} · esquinas: ${nueva.settings.borderRadius}`);
  console.log(`\n   Las otras ${sections.length - 1} secciones quedan igual: ${sections.filter((_, i) => i !== idx).map((x) => x.type).join(', ')}`);

  if (!CONFIRMED) {
    console.log('\n🧪 Dry-run terminado, nada se escribió.');
    process.exit(0);
  }

  // Copia de seguridad del documento entero antes de tocarlo.
  await db.collection('pages_backup').doc(`${PAGE_ID}_${Date.now()}`).set({
    ...page,
    _backupDe: `pages/${PAGE_ID}`,
    _backupEn: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('\n   💾 copia de seguridad guardada en pages_backup/');

  const nuevas = [...sections];
  nuevas[idx] = nueva;
  await ref.update({ sections: nuevas });

  // Verificación
  const after = (await ref.get()).data();
  const hero = (after.sections || []).find((x) => x.id === vieja.id);
  const ok = hero?.type === 'hero_carousel'
    && (hero.settings?.slides || []).length === 1
    && hero.settings.slides[0].imageUrl === slide.imageUrl
    && (after.sections || []).length === sections.length;
  console.log(ok
    ? `   ✅ guardado: hero_carousel con 1 slide, ${after.sections.length} secciones intactas`
    : '   ❌ algo no cuadra, revisar');

  console.log('\n🎉 Listo. Para que empiece a moverse, agrega más diapositivas desde el editor visual.');
  process.exit(0);
})().catch((e) => { console.error('\n❌ Falló:', e.message); process.exit(1); });
