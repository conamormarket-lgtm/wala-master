/**
 * Landing COMBO Reloj + Billetera (K-CHERO) — usa las imágenes de
 * public/landing-matador (relojes img-01..14, billeteras img-15..25,
 * arte promo img-26).
 *
 * Escribe por código (NO desde el admin CMS):
 *   - landingPages/{LP_ID}
 *   - pages/{SLUG}  (secciones del editor visual)
 *   - productos_wala/{PRODUCT_ID}
 *
 * Emulador (default, seguro):
 *   npm run seed:landing-combo
 *
 * Firebase REAL (usa serviceAccountKey.json en la raíz):
 *   npm run seed:landing-combo:prod
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
  console.error("\n⚠️  Seed a Firebase REAL. Confirma con:\n      npm run seed:landing-combo:prod\n");
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

// ── Constantes de la promo ───────────────────────────────────────────────────
const SLUG = "combo-reloj-billetera-2026";
const LP_ID = "lp-combo-reloj-billetera-2026";
const PRODUCT_ID = "combo-reloj-billetera-2026";
const PAY_ANCHOR = "#pagar-ahora";
const MEDIA = "/landing-matador";
const WHATSAPP = "51924426791";

const PRICE_PEN = 199;
const PRECIO_ORIGINAL = 279;
const AHORRO = PRECIO_ORIGINAL - PRICE_PEN; // 80
const OFFER_HOURS = 1;
const OFFER_BADGE = "OFERTA ESPECIAL";
const PRICE_LABEL = `S/${PRICE_PEN}`;
const ORIGINAL_LABEL = `S/${PRECIO_ORIGINAL}`;

const img = (n) => `${MEDIA}/img-${n}.jpeg`;
const VIDEO_1 = `${MEDIA}/video/video-01.mp4`;

// ── Relojes (14 acabados reales) ─────────────────────────────────────────────
const WATCHES = [
  { key: "hero", n: "01", brand: "Ben Yi", label: "Ben Yi · Negro Oro Rosa", blurb: "Cuadrado cronógrafo negro mate, índices oro rosa y correa metal negra.", accent: "#e10600" },
  { key: "bluePoedagar", n: "02", brand: "Poedagar", label: "Poedagar · Azul Bicolor", blurb: "Dial azul sunburst, día-fecha y brazalete bicolor plata con eslabones dorados.", accent: "#2f6fed" },
  { key: "navyGold", n: "03", brand: "Ben Yi", label: "Ben Yi · Navy Oro Rosa", blurb: "Cuadrado navy con cronógrafo, detalles oro rosa y fecha al costado.", accent: "#fb7185" },
  { key: "currenGunmetal", n: "04", brand: "Curren", label: "Curren · Gunmetal Fecha", blurb: "Acabado gunmetal, dial negro y rueda de fecha visible estilo deportivo.", accent: "#9aa4b2" },
  { key: "currenBlue", n: "05", brand: "Curren", label: "Curren · Azul Sport", blurb: "Look militar azul/negro, correa silicona azul y cronógrafo funcional.", accent: "#2f6fed" },
  { key: "blackSilver", n: "06", brand: "Poedagar", label: "Poedagar · Negro Plata", blurb: "Esfera negra, números plata, día-fecha y brazalete acero.", accent: "#9aa4b2" },
  { key: "squareBlue", n: "07", brand: "Poedagar", label: "Poedagar · Cuadrado Azul", blurb: "Caja cuadrada azul navy, 3 subesferas cronógrafo y brazalete plata.", accent: "#2f6fed" },
  { key: "currenYellow", n: "08", brand: "Curren", label: "Curren · Negro Amarillo", blurb: "Deportivo negro con acentos amarillos, correa silicona y fecha al 3.", accent: "#f0b429" },
  { key: "twoTone", n: "09", brand: "Poedagar", label: "Poedagar · Bicolor Oro Negro", blurb: "Esfera negra, brazalete plata+oro y bisel facetado; variante premium.", accent: "#c9a66b" },
  { key: "silverClassic", n: "10", brand: "Poedagar", label: "Poedagar · Plata Clásico", blurb: "Dial plata con números arábigos, día-fecha y brazalete acero pulido.", accent: "#9aa4b2" },
  { key: "goldWomen", n: "11", brand: "Luifudo", label: "Luifudo · Dorado Minimal", blurb: "Cuadrado dorado minimalista, esfera negra lisa y brazalete joya.", accent: "#f0b429" },
  { key: "blackGold", n: "12", brand: "Curren", label: "Curren · Negro Oro Cuadrado", blurb: "Cronógrafo cuadrado negro, índices dorados y brazalete metal negro.", accent: "#f0b429" },
  { key: "currenGrey", n: "13", brand: "Curren", label: "Curren · Gris Sport", blurb: "Estilo cronómetro gris/negro, correa silicona gris y dial multifunción.", accent: "#9aa4b2" },
  { key: "navyRose", n: "14", brand: "Ben Yi", label: "Ben Yi · Navy Brazalete Negro", blurb: "Cuadrado navy oro rosa con brazalete negro brillante y cronógrafo.", accent: "#fb7185" },
];

// ── Billeteras (3 colores reales) ────────────────────────────────────────────
const WALLETS = [
  { id: "negro", label: "Negro", imageUrl: img("18"), blurb: "Negro clásico: combina con todo. Cierre para monedas, porta-DNI y 6 ranuras para tarjetas." },
  { id: "marron", label: "Marrón", imageUrl: img("17"), blurb: "Marrón cuero: el más elegante. Cierre para monedas, porta-DNI y 6 ranuras para tarjetas." },
  { id: "azul", label: "Azul Navy", imageUrl: img("23"), blurb: "Azul navy: discreto y distinto. Cierre para monedas, porta-DNI y 6 ranuras para tarjetas." },
];

const COMMENTS = [
  { name: "Carlos R.", city: "Arequipa", product: "Combo · Poedagar + Billetera Negra", stars: 5, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop&crop=face&auto=format&q=80", text: "Pedí el combo y llegó todo. El reloj se ve carísimo y la billetera es de buen cuero. Por S/199 es un regalazo." },
  { name: "María Fernanda", city: "Trujillo", product: "Combo · Ben Yi + Billetera Marrón", stars: 5, avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop&crop=face&auto=format&q=80", text: "Se lo regalé a mi novio por su cumple. La caja quedó perfecta, no tuve que comprar nada más." },
  { name: "Jhonatan M.", city: "Lima", product: "Combo · Curren + Billetera Azul", stars: 5, avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&crop=face&auto=format&q=80", text: "Elegí el reloj negro y la billetera azul. Llegó en 2 días a Lima. Recomendado al 100%." },
  { name: "Valeria S.", city: "Chiclayo", product: "Combo · Curren + Billetera Negra", stars: 5, avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=160&fit=crop&crop=face&auto=format&q=80", text: "Pensé que la billetera iba a ser barata pero no, tiene porta DNI y cierre. Muy buena compra." },
  { name: "Kevin A.", city: "Cusco", product: "Combo · Poedagar + Billetera Marrón", stars: 5, avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=160&h=160&fit=crop&crop=face&auto=format&q=80", text: "Ahorré S/80 comprando el combo en vez de por separado. Los dos productos son premium." },
  { name: "Luciana P.", city: "Huancayo", product: "Combo · Ben Yi + Billetera Negra", stars: 5, avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=160&h=160&fit=crop&crop=face&auto=format&q=80", text: "Regalo de aniversario. Mi enamorado no se lo quita. Ideal para regalar, viene listo." },
];

let _order = 0;
const next = () => _order++;
const sid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function setDoc(coll, id, data) {
  await db.collection(coll).doc(id).set(data, { merge: true });
}

(async () => {
  const offerEnds = new Date(Date.now() + OFFER_HOURS * 3600 * 1000).toISOString();

  // ── PRODUCTO (combo) ──────────────────────────────────────────────────────
  await setDoc("productos_wala", PRODUCT_ID, {
    name: "Combo Reloj + Billetera K-CHERO",
    sku: "COMBO-RELOJ-BILLETERA-2026",
    description: [
      "<p><strong>Reloj premium + billetera de cuero, en un solo pack.</strong> El regalo que ya viene listo: dos productos que se notan, por menos de lo que cuestan por separado.</p>",
      "<ul>",
      `<li><strong>Ahorras S/ ${AHORRO}</strong> frente a comprarlos por separado (${ORIGINAL_LABEL} → ${PRICE_LABEL}).</li>`,
      "<li><strong>Reloj:</strong> acero inoxidable, cronógrafo y fecha funcionales, resistente al agua. <strong>14 modelos</strong> a elegir.</li>",
      "<li><strong>Billetera:</strong> cuero premium con porta-DNI, cierre para monedas y 6 ranuras para tarjetas. <strong>3 colores</strong>: negro, marrón y azul navy.</li>",
      "<li><strong>Ideal para regalo:</strong> llega presentado y listo para entregar.</li>",
      "<li><strong>Garantía 12 meses</strong> y devolución fácil.</li>",
      "</ul>",
      "<p>Envío a todo el Perú · Pago con tarjeta o Yape · También puedes coordinarlo por WhatsApp.</p>",
    ].join(""),
    // price = original (tachado), salePrice = oferta. El carrito cobra salePrice.
    price: PRECIO_ORIGINAL,
    salePrice: PRICE_PEN,
    compareAtPrice: PRECIO_ORIGINAL,
    precioOriginal: PRECIO_ORIGINAL,
    // No usamos img-26 (arte promo): trae precios antiguos grabados (S/250 / S/51).
    mainImage: img("01"),
    images: [img("01"), img("18"), img("17"), img("23"), img("12"), img("05")],
    visible: true,
    deleted: false,
    featured: true,
    featuredOrder: 1,
    vendorId: "casa",
    nicheId: "regala-con-amor",
    fulfillmentType: "stock",
    customizable: false,
    hasVariants: false,
    inStock: 80,
    categories: ["accesorios"],
    tags: ["reloj", "billetera", "combo", "kchero", "regalo"],
    searchTokens: [
      "co", "com", "comb", "combo",
      "re", "rel", "relo", "reloj",
      "bi", "bil", "bill", "bille", "billet", "billete", "billeter", "billetera",
      "kc", "kch", "kche", "kcher", "kchero", "ch", "che", "cher", "chero",
      "re", "reg", "rega", "regal", "regalo",
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isV2: true,
  });

  await setDoc("landingPages", LP_ID, {
    title: "Combo Reloj + Billetera K-CHERO — Landing",
    slug: SLUG,
    brandId: "",
    hideHeader: true,
    hideFooter: true,
    themeId: "",
    linkedProducts: [{ productId: PRODUCT_ID, stockType: "global", allocatedStock: 0 }],
    updatedAt: new Date().toISOString(),
  });

  // ── SECCIONES ─────────────────────────────────────────────────────────────
  const sections = [
    {
      id: sid("ann"),
      type: "announcement_bar",
      order: next(),
      settings: {
        messages: [
          { text: `ENVÍO GRATIS A TODO EL PERÚ · AHORRA S/ ${AHORRO} CON EL COMBO`, link: PAY_ANCHOR, textAlign: "center" },
        ],
        speed: 4000,
        bgColor: "#050505",
        textColor: "#e8e8ea",
      },
    },

    {
      id: sid("hero-h"),
      type: "header",
      order: next(),
      settings: {
        compact: true,
        title: "Reloj + Billetera",
        subtitle: `Los dos por ${PRICE_LABEL}. Ahorras S/ ${AHORRO}. Ideal para regalar.`,
        titleHighlight: "+",
        titleHighlightColor: "#d4af37",
        backgroundColor: "#070708",
        titleColor: "#f5f5f5",
        subtitleColor: "#a1a1aa",
        textAlign: "center",
        titleFontSize: "clamp(1.5rem, 6.5vw, 2.1rem)",
        titleFontWeight: "900",
        subtitleFontSize: "0.95rem",
        paddingTop: "1.1rem",
        paddingBottom: "0.55rem",
      },
    },

    // NOTA: aquí había un bloque `image` con el arte promocional (img-26). Se
    // eliminó a propósito: ese arte tiene grabados precios ANTIGUOS
    // ("Precio regular S/250 · Ahorra S/51") que contradicen la oferta real
    // (S/199 antes S/279, ahorra S/80) y confundían al cliente.

    {
      id: sid("vid"),
      type: "video",
      order: next(),
      settings: {
        url: VIDEO_1,
        poster: img("01"),
        aspectRatio: "9:16",
        backgroundColor: "#050505",
        paddingTop: "0.25rem",
        paddingBottom: "0.25rem",
      },
    },

    // ═══ CONVERSIÓN: elige reloj + elige billetera ═══════════════════════════
    {
      id: sid("fold"),
      type: "conversion_fold",
      order: next(),
      settings: {
        brandName: "CHERO",
        brandMark: "K",
        badge: "COMBO 2026",
        imageUrl: img("01"),
        imageAlt: "Combo reloj + billetera",
        title: "",
        subtitle: "",
        variants: WATCHES.map((w) => ({
          id: w.key,
          imageUrl: img(w.n),
          label: w.label,
          brand: w.brand,
          tagline: `${w.brand} · img-${w.n}`,
          blurb: w.blurb,
          accent: w.accent,
        })),
        // Selector de billetera (lo lee ConversionFold)
        wallets: WALLETS,
        walletTitle: "Ahora elige tu billetera",
        walletSubtitle: "Incluida en el combo · cuero premium con porta-DNI y cierre",
        socialProofBadge: "+1.800 combos vendidos este mes",
        endTime: offerEnds,
        offerHours: OFFER_HOURS,
        countdownLabel: "OFERTA POR TIEMPO LIMITADO",
        montoPEN: PRICE_PEN,
        precioOriginal: PRECIO_ORIGINAL,
        discountLabel: OFFER_BADGE,
        rating: 4.9,
        reviewCount: "1,240",
        miniTrust: ["Diseños premium", "Excelente calidad", "Listo para regalar"],
        customerComments: COMMENTS,
        ctaPrimaryText: "Lo quiero comprar ya",
        ctaPrimarySub: "Envío gratis · Pago seguro",
        ctaPrimaryLink: PAY_ANCHOR,
        secureText: "COMPRA 100% SEGURA",
        paymentLogos: ["VISA", "MC", "AMEX", "YAPE", "BCP"],
        trustText: "Envío gratis a todo el Perú",
        showWhatsApp: true,
        whatsappNumber: WHATSAPP,
        whatsappMessage: "Hola, me interesa el Combo Reloj + Billetera",
        accentColor: "#d4af37",
        backgroundColor: "#070708",
      },
    },

    // ═══ CHECKOUT ═══════════════════════════════════════════════════════════
    {
      id: sid("pay"),
      type: "landing_payment",
      order: next(),
      settings: {
        title: "Finaliza tu compra",
        subtitle: `Combo Reloj + Billetera · ${OFFER_BADGE}`,
        concepto: `Combo Reloj + Billetera — ${OFFER_BADGE}`,
        montoPEN: PRICE_PEN,
        precioOriginal: PRECIO_ORIGINAL,
        showPriceBlock: false,
        peruOnly: true,
        showCulqi: true,
        showPayPal: false,
        montoUSD: 0,
        stickyCTA: "Continuar al pago",
        whatsappNumber: WHATSAPP,
        showWallet: true, // muestra la billetera elegida en "TU PEDIDO" y en el pedido
        adelantoMonto: 10,
        // Popup de salida (exit-intent) con copy del COMBO, no solo del reloj
        exitTitle: "¿Te vas sin tu pack, K-CHERO? 😏",
        exitText: `Tu reloj y tu billetera están apartados. Llévate los dos por ${PRICE_LABEL} y ahorra S/ ${AHORRO} — pero la oferta se cae cuando acabe el contador.`,
        exitCta: "Cerrar mi pack por WhatsApp",
        exitSecondary: "Seguir viendo modelos",
        exitProof: `+1.800 combos vendidos · Ahorras S/ ${AHORRO} · Ideal para regalar`,
        productId: PRODUCT_ID,
        anchorId: "pagar-ahora",
        backgroundColor: "#f8fafc",
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
            question: "¿Qué incluye exactamente el combo?",
            answer:
              "Un reloj (el modelo que elijas entre los 14 del carrusel) y una billetera de cuero (negro, marrón o azul navy). Ambos llegan juntos, presentados y listos para regalar. No necesitas comprar nada aparte.",
          },
          {
            question: "¿De verdad puedo pagar al recibir?",
            answer:
              "Sí. Trabajamos con pago contra entrega verificado: liquidas el total cuando el courier te entrega el pedido en mano. Si quieres asegurar tu combo antes del despacho, puedes separarlo con un adelanto de S/ 10 (reserva de stock) y completar el saldo al recibir. Puedes anular sin penalidad antes de que salga de almacén.",
          },
          {
            question: "¿Cuánto demora el delivery?",
            answer:
              "En Lima Metropolitana entregamos en un máximo de 48 horas hábiles desde la confirmación. A provincias, entre 3 y 5 días hábiles. Te enviamos seguimiento por WhatsApp cuando el paquete sale de almacén.",
          },
          {
            question: "¿Cuánto ahorro comprando el combo?",
            answer:
              `Comprados por separado suman ${ORIGINAL_LABEL}. En el combo pagas ${PRICE_LABEL}, así que ahorras S/ ${AHORRO}. Es la forma más barata de llevarte ambos.`,
          },
          {
            question: "¿Y si me equivoco de modelo o color?",
            answer:
              "Antes de despachar validamos contigo por WhatsApp el reloj y el color de billetera que elegiste. Si algo no calza, lo cambiamos sin costo. Además tienes garantía de 12 meses y devolución fácil.",
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
  console.log(`✓ Landing COMBO + producto (${TO_PROD ? "PRODUCCIÓN" : "emulador"})`);
  console.log(`  Producto:       productos_wala/${PRODUCT_ID}`);
  console.log(`  Landing doc:    landingPages/${LP_ID}`);
  console.log(`  Secciones:      pages/${SLUG} (${sections.length} bloques)`);
  console.log(`  Precio:         ${PRICE_LABEL} (antes ${ORIGINAL_LABEL}, ahorra S/ ${AHORRO})`);
  console.log(`  Relojes:        ${WATCHES.length}  |  Billeteras: ${WALLETS.length}`);
  console.log(`  Landing URL:    ${baseUrl}/${SLUG}`);
  console.log(`  Ficha PDP:      ${baseUrl}/producto/${PRODUCT_ID}`);
  console.log("");
  process.exit(0);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
