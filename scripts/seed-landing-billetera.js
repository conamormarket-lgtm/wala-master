/**
 * Landing SOLO BILLETERAS (K-CHERO) — paleta de cuero cálido (café + cognac),
 * sin video (el video no muestra billeteras).
 *
 * Imágenes: public/landing-matador/img-15..23 y img-25 (10 fotos reales).
 *
 * Emulador (default, seguro):   npm run seed:landing-billetera
 * Firebase REAL:                npm run seed:landing-billetera:prod
 */
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const TO_PROD = args.includes("--prod");
const CONFIRMED = args.includes("--confirm");
const PROD_PROJECT_ID = "sistema-gestion-3b225";
const ROOT = path.join(__dirname, "..");
const fnModules = path.join(ROOT, "functions", "node_modules");

const SA_CANDIDATES = [
  path.join(ROOT, "serviceAccountKey.json"),
  path.join(ROOT, "firebase-service-account.json"),
  path.join(ROOT, "service-account.json"),
  path.join(ROOT, "credentials.json"),
];

function loadServiceAccount() {
  for (const p of SA_CANDIDATES) {
    if (fs.existsSync(p)) return { path: p, data: JSON.parse(fs.readFileSync(p, "utf8")) };
  }
  return null;
}

if (TO_PROD && !CONFIRMED) {
  console.error("\n⚠️  Seed a Firebase REAL. Confirma con:\n      npm run seed:landing-billetera:prod\n");
  process.exit(1);
}

if (!TO_PROD) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "localhost:9099";
} else {
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
}

let db;
if (TO_PROD) {
  const sa = loadServiceAccount();
  if (!sa) {
    console.error("\n❌ Falta serviceAccountKey.json en la raíz del repo.\n");
    process.exit(1);
  }
  const admin = require(require.resolve("firebase-admin", { paths: [fnModules] }));
  admin.initializeApp({ credential: admin.credential.cert(sa.data), projectId: sa.data.project_id || PROD_PROJECT_ID });
  db = admin.firestore();
  console.log(`→ Sembrando en Firebase REAL: ${sa.data.project_id || PROD_PROJECT_ID}`);
} else {
  const admin = require(require.resolve("firebase-admin", { paths: [fnModules] }));
  admin.initializeApp({ projectId: "demo-wala" });
  db = admin.firestore();
  console.log("→ Sembrando en EMULADOR local (demo-wala)");
}

// ── Constantes ───────────────────────────────────────────────────────────────
const SLUG = "billetera-kchero-2026";
const LP_ID = "lp-billetera-kchero-2026";
const PRODUCT_ID = "billetera-kchero-2026";
const PAY_ANCHOR = "#pagar-ahora";
const MEDIA = "/landing-matador";
const WHATSAPP = "51924426791";

const PRICE_PEN = 99;
const PRECIO_ORIGINAL = 149;
const AHORRO = PRECIO_ORIGINAL - PRICE_PEN; // 50
const OFFER_HOURS = 1;
const OFFER_BADGE = "OFERTA EXCLUSIVA";
const PRICE_LABEL = `S/${PRICE_PEN}`;
const ORIGINAL_LABEL = `S/${PRECIO_ORIGINAL}`;

const img = (n) => `${MEDIA}/img-${n}.jpeg`;

// ── Paleta CUERO CÁLIDO (distinta al negro/rojo del reloj) ───────────────────
const COGNAC = "#c0733a";      // acento
const ESPRESSO = "#1c120c";    // base del fold
const CACAO = "#2b1b12";       // halo suave
const MIST = "rgba(192, 115, 58, 0.24)";
const TOP = "#231710";
const BOTTOM = "#120b07";
const CREAM = "#f6efe7";       // texto

// Cada variante lleva su mood para que el fondo cambie según el color elegido.
const moodBrown = { soft: CACAO, deep: ESPRESSO };
const moodBlack = { soft: "#1a1a1a", deep: "#0b0b0b" };
const moodNavy = { soft: "#111b2b", deep: "#080d16" };

// ── Billeteras (10 fotos reales) ─────────────────────────────────────────────
const WALLETS = [
  { n: "18", label: "Negro · Cierre",       blurb: "Negro clásico con cierre para monedas. El que combina con todo.", accent: "#8a8a8a", ...moodBlack },
  { n: "17", label: "Marrón · Cierre",      blurb: "Marrón cuero con cierre. El más elegante del catálogo.",           accent: COGNAC,   ...moodBrown },
  { n: "23", label: "Azul Navy · Cierre",   blurb: "Azul navy discreto y distinto. Cierre para monedas.",              accent: "#4d7bc4", ...moodNavy },
  { n: "16", label: "Marrón · Cardholder",  blurb: "Marrón con porta-tarjetas metálico anti-RFID que sube al pulsar.", accent: COGNAC,   ...moodBrown },
  { n: "21", label: "Negro · Cardholder",   blurb: "Negro con porta-tarjetas metálico anti-RFID. Puro estilo.",        accent: "#8a8a8a", ...moodBlack },
  { n: "20", label: "Azul · Cardholder",    blurb: "Azul navy con porta-tarjetas metálico anti-RFID.",                 accent: "#4d7bc4", ...moodNavy },
  { n: "15", label: "Marrón · Bifold",      blurb: "Interior marrón: porta-DNI con ventana y ranuras para tarjetas.",  accent: COGNAC,   ...moodBrown },
  { n: "19", label: "Negro · Bifold",       blurb: "Interior negro: porta-DNI con ventana y ranuras para tarjetas.",   accent: "#8a8a8a", ...moodBlack },
  { n: "22", label: "Azul · Bifold",        blurb: "Interior azul navy: porta-DNI con ventana y ranuras.",             accent: "#4d7bc4", ...moodNavy },
  { n: "25", label: "Marrón · Trifold",     blurb: "Trifold marrón: más compartimentos sin volverse gruesa.",          accent: COGNAC,   ...moodBrown },
];

const COMMENTS = [
  { name: "Diego F.", city: "Piura", product: "Marrón · Cierre", stars: 5, avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=160&h=160&fit=crop&crop=face&auto=format&q=80", text: "Tenía una billetera rota hace años. Esta es cuero de verdad, no cuerina. Por S/99 no me arrepiento." },
  { name: "Andrea M.", city: "Ica", product: "Negro · Cardholder", stars: 5, avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&h=160&fit=crop&crop=face&auto=format&q=80", text: "Se la regalé a mi papá. El porta-tarjetas metálico le encantó, dice que se siente caro." },
  { name: "Luis G.", city: "Arequipa", product: "Azul Navy · Cierre", stars: 5, avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=160&h=160&fit=crop&crop=face&auto=format&q=80", text: "El azul navy no se ve en todas partes, por eso lo elegí. Cabe todo y no se abulta en el bolsillo." },
  { name: "María Fernanda", city: "Trujillo", product: "Marrón · Trifold", stars: 5, avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop&crop=face&auto=format&q=80", text: "Llegó en 2 días. La costura está bien hecha, se nota la calidad. Ya pedí otra para regalo." },
  { name: "Kevin A.", city: "Cusco", product: "Negro · Bifold", stars: 5, avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=160&h=160&fit=crop&crop=face&auto=format&q=80", text: "El porta-DNI con ventana es lo mejor. Ya no saco el documento cada vez que me lo piden." },
  { name: "Valeria S.", city: "Chiclayo", product: "Marrón · Cardholder", stars: 5, avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=160&fit=crop&crop=face&auto=format&q=80", text: "Pedí la marrón con el cardholder. Se ve mucho más cara de lo que costó." },
];

let _order = 0;
const next = () => _order++;
const sid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function setDoc(coll, id, data) {
  await db.collection(coll).doc(id).set(data, { merge: true });
}

(async () => {
  const offerEnds = new Date(Date.now() + OFFER_HOURS * 3600 * 1000).toISOString();

  // ── PRODUCTO ──────────────────────────────────────────────────────────────
  await setDoc("productos_wala", PRODUCT_ID, {
    name: "Billetera K-CHERO — Cuero Premium",
    sku: "BILLETERA-KCHERO-2026",
    description: [
      "<p><strong>Cuero premium, no cuerina.</strong> La billetera que aguanta el día a día y se ve cara desde el primer momento.</p>",
      "<ul>",
      "<li><strong>Porta-DNI con ventana:</strong> muestras el documento sin sacarlo.</li>",
      "<li><strong>Cierre para monedas</strong> y hasta <strong>6 ranuras</strong> para tarjetas.</li>",
      "<li><strong>Porta-tarjetas metálico anti-RFID</strong> (en los modelos cardholder): protege tus tarjetas del clonado.</li>",
      "<li><strong>3 colores:</strong> negro, marrón y azul navy. Bifold, trifold o cardholder.</li>",
      "<li><strong>Slim:</strong> guarda todo sin abultarse en el bolsillo.</li>",
      "<li><strong>Garantía 12 meses</strong> y devolución fácil.</li>",
      "</ul>",
      `<p>Hoy ${PRICE_LABEL} (antes ${ORIGINAL_LABEL}) · Envío a todo el Perú · Tarjeta, Yape o WhatsApp.</p>`,
    ].join(""),
    price: PRECIO_ORIGINAL,
    salePrice: PRICE_PEN,
    compareAtPrice: PRECIO_ORIGINAL,
    precioOriginal: PRECIO_ORIGINAL,
    mainImage: img("17"),
    images: [img("17"), img("16"), img("18"), img("23"), img("21"), img("15"), img("25")],
    visible: true,
    deleted: false,
    featured: true,
    featuredOrder: 2,
    vendorId: "casa",
    nicheId: "regala-con-amor",
    fulfillmentType: "stock",
    customizable: false,
    hasVariants: false,
    inStock: 150,
    categories: ["accesorios"],
    tags: ["billetera", "cuero", "kchero", "regalo", "rfid"],
    searchTokens: [
      "bi", "bil", "bill", "bille", "billet", "billete", "billeter", "billetera",
      "cu", "cue", "cuer", "cuero",
      "kc", "kch", "kche", "kcher", "kchero", "ch", "che", "cher", "chero",
      "rf", "rfi", "rfid",
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isV2: true,
  });

  await setDoc("landingPages", LP_ID, {
    title: "Billetera K-CHERO — Landing",
    slug: SLUG,
    brandId: "",
    hideHeader: true,
    hideFooter: true,
    themeId: "",
    linkedProducts: [{ productId: PRODUCT_ID, stockType: "global", allocatedStock: 0 }],
    updatedAt: new Date().toISOString(),
  });

  // ── SECCIONES (sin video, estructura distinta) ────────────────────────────
  const sections = [
    {
      id: sid("ann"),
      type: "announcement_bar",
      order: next(),
      settings: {
        messages: [
          { text: `CUERO PREMIUM · HOY ${PRICE_LABEL} · AHORRA S/ ${AHORRO}`, link: PAY_ANCHOR, textAlign: "center" },
        ],
        speed: 4000,
        bgColor: "#120b07",
        textColor: "#f0e2d3",
      },
    },

    {
      id: sid("hero-h"),
      type: "header",
      order: next(),
      settings: {
        compact: true,
        title: "¿Sigues con esa billetera rota?",
        subtitle: `Cámbiala por una de cuero premium. Hoy ${PRICE_LABEL} en vez de ${ORIGINAL_LABEL}.`,
        titleHighlight: "rota",
        titleHighlightColor: COGNAC,
        backgroundColor: TOP,
        titleColor: CREAM,
        subtitleColor: "#c8b39d",
        textAlign: "center",
        titleFontSize: "clamp(1.45rem, 6.2vw, 2rem)",
        titleFontWeight: "900",
        subtitleFontSize: "0.95rem",
        paddingTop: "1.15rem",
        paddingBottom: "0.5rem",
      },
    },

    // Hero visual: la billetera con cardholder metálico (la más llamativa)
    {
      id: sid("hero-img"),
      type: "image",
      order: next(),
      settings: {
        url: img("16"),
        alt: "Billetera de cuero con porta-tarjetas metálico anti-RFID",
        maxWidth: "380px",
        alignment: "center",
        borderRadius: "18px",
        backgroundColor: TOP,
        paddingTop: "0.25rem",
        paddingBottom: "0.6rem",
      },
    },

    // ═══ CONVERSIÓN: coverflow de billeteras (paleta cuero) ══════════════════
    {
      id: sid("fold"),
      type: "conversion_fold",
      order: next(),
      settings: {
        brandName: "CHERO",
        brandMark: "K",
        badge: "CUERO PREMIUM",
        imageUrl: img("17"),
        imageAlt: "Billetera de cuero",
        title: "",
        subtitle: "",
        variants: WALLETS.map((w) => ({
          id: `w-${w.n}`,
          imageUrl: img(w.n),
          label: w.label,
          brand: "K-CHERO",
          tagline: `Cuero · img-${w.n}`,
          blurb: w.blurb,
          accent: w.accent,
          soft: w.soft,
          deep: w.deep,
        })),
        // Tema cuero cálido (sobreescribe el negro/rojo del reloj)
        foldTop: TOP,
        foldBottom: BOTTOM,
        foldText: CREAM,
        accentColor: COGNAC,
        socialProofBadge: "+3.100 billeteras vendidas",
        endTime: offerEnds,
        offerHours: OFFER_HOURS,
        countdownLabel: "PRECIO DE LANZAMIENTO",
        montoPEN: PRICE_PEN,
        precioOriginal: PRECIO_ORIGINAL,
        discountLabel: OFFER_BADGE,
        rating: 4.8,
        reviewCount: "2,340",
        miniTrust: ["Cuero premium", "Anti-RFID", "Garantía 12 meses"],
        customerComments: COMMENTS,
        ctaPrimaryText: "La quiero, comprar ya",
        ctaPrimarySub: "Envío gratis · Pago seguro",
        ctaPrimaryLink: PAY_ANCHOR,
        secureText: "COMPRA 100% SEGURA",
        paymentLogos: ["VISA", "MC", "AMEX", "YAPE", "BCP"],
        trustText: "Envío gratis a todo el Perú",
        showWhatsApp: true,
        whatsappNumber: WHATSAPP,
        whatsappMessage: "Hola, me interesa la Billetera K-CHERO de cuero",
        accentColor2: COGNAC,
        backgroundColor: ESPRESSO,
      },
    },

    // ═══ BENEFICIOS (bloque que la landing del reloj NO tiene) ═══════════════
    {
      id: sid("feat"),
      type: "feature_list",
      order: next(),
      settings: {
        title: "Por qué esta y no otra",
        subtitle: "Lo que revisas cuando compras una billetera de verdad",
        imageUrl: img("15"),
        imageAlt: "Interior de la billetera: porta-DNI y ranuras",
        items: [
          { icon: "🪪", text: "Porta-DNI con ventana: no sacas el documento" },
          { icon: "🔒", text: "Cardholder metálico anti-RFID: tus tarjetas protegidas" },
          { icon: "🪙", text: "Cierre para monedas, sin que se abulte" },
          { icon: "💳", text: "Hasta 6 ranuras para tarjetas" },
          { icon: "🧵", text: "Cuero premium con costura reforzada" },
          { icon: "🎁", text: "Llega presentada, lista para regalar" },
        ],
        quote: "Tenía una billetera rota hace años. Esta es cuero de verdad, no cuerina.",
        quoteAuthor: "Diego F. · Piura",
        backgroundColor: "#241811",
        paddingTop: "1.2rem",
        paddingBottom: "1rem",
      },
    },

    // ═══ CHECKOUT ═══════════════════════════════════════════════════════════
    {
      id: sid("pay"),
      type: "landing_payment",
      order: next(),
      settings: {
        title: "Finaliza tu compra",
        subtitle: `Billetera K-CHERO · ${OFFER_BADGE}`,
        concepto: `Billetera K-CHERO — ${OFFER_BADGE}`,
        montoPEN: PRICE_PEN,
        precioOriginal: PRECIO_ORIGINAL,
        showPriceBlock: false,
        peruOnly: true,
        showCulqi: true,
        showPayPal: false,
        montoUSD: 0,
        stickyCTA: "Continuar al pago",
        whatsappNumber: WHATSAPP,
        adelantoMonto: 10,
        productId: PRODUCT_ID,
        anchorId: "pagar-ahora",
        // Popup de salida con copy de billetera
        exitTitle: "¿Te vas con la billetera rota? 😏",
        exitText: `Tu billetera de cuero está apartada por ${PRICE_LABEL} (antes ${ORIGINAL_LABEL}). Cierra tu pedido por WhatsApp antes de que suba el precio.`,
        exitCta: "Cerrar mi pedido por WhatsApp",
        exitSecondary: "Seguir viendo colores",
        exitProof: `+3.100 vendidas · Ahorras S/ ${AHORRO} · Garantía 12 meses`,
        backgroundColor: "#faf6f1",
        paddingTop: "0.75rem",
        paddingBottom: "0",
      },
    },

    // ═══ FAQ ════════════════════════════════════════════════════════════════
    {
      id: sid("faq"),
      type: "faq_accordion",
      order: next(),
      settings: {
        title: "Preguntas frecuentes",
        items: [
          {
            question: "¿Es cuero de verdad o cuerina?",
            answer:
              "Es cuero premium con costura reforzada, no cuerina barata. Se nota en el tacto, en el olor y en cómo aguanta el uso diario. Si al recibirla no te convence, tienes devolución fácil.",
          },
          {
            question: "¿Qué modelos y colores hay?",
            answer:
              "Tres colores: negro, marrón y azul navy. Y tres formatos: bifold clásico, trifold (más compartimentos) y cardholder con porta-tarjetas metálico anti-RFID. Eliges el que quieras en el carrusel.",
          },
          {
            question: "¿Qué es el anti-RFID y para qué sirve?",
            answer:
              "Los modelos cardholder traen una caja metálica que bloquea las señales RFID/NFC, así nadie puede clonar tus tarjetas de contacto sin tocarlas. Además, las tarjetas suben al pulsar la palanquita.",
          },
          {
            question: "¿De verdad puedo pagar al recibir?",
            answer:
              "Sí. Pago contra entrega verificado: pagas cuando el courier te entrega el pedido en mano. Si quieres asegurar tu color antes del despacho, la separas con un adelanto de S/ 10 y completas al recibir. Puedes anular sin penalidad antes de que salga de almacén.",
          },
          {
            question: "¿Cuánto demora el delivery?",
            answer:
              "Lima Metropolitana: máximo 48 horas hábiles. Provincias: 3 a 5 días hábiles. Te mandamos seguimiento por WhatsApp cuando sale de almacén.",
          },
        ],
        defaultOpen: true,
        backgroundColor: "#ffffff",
      },
    },
  ];

  await setDoc("pages", SLUG, { sections });

  const baseUrl = TO_PROD ? "https://wala.pe" : "http://localhost:3000";
  console.log("");
  console.log(`✓ Landing BILLETERA + producto (${TO_PROD ? "PRODUCCIÓN" : "emulador"})`);
  console.log(`  Producto:       productos_wala/${PRODUCT_ID}`);
  console.log(`  Landing doc:    landingPages/${LP_ID}`);
  console.log(`  Secciones:      pages/${SLUG} (${sections.length} bloques, SIN video)`);
  console.log(`  Precio:         ${PRICE_LABEL} (antes ${ORIGINAL_LABEL}, ahorra S/ ${AHORRO})`);
  console.log(`  Billeteras:     ${WALLETS.length} fotos`);
  console.log(`  Paleta:         cuero cálido (${COGNAC} sobre ${ESPRESSO})`);
  console.log(`  Landing URL:    ${baseUrl}/${SLUG}`);
  console.log(`  Ficha PDP:      ${baseUrl}/producto/${PRODUCT_ID}`);
  console.log("");
  process.exit(0);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
