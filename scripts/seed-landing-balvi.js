/**
 * Landing Reloj Matador Pro — con imágenes y videos propios (public/landing-matador)
 *
 * Escribe por código (NO desde el admin CMS):
 *   - landingPages/{LP_ID}
 *   - pages/{SLUG}  (secciones del editor visual)
 *   - productos_wala/{PRODUCT_ID}
 *   - tienda_categories/accesorios
 *
 * Emulador (default, seguro):
 *   npm run seed:landing-balvi
 *
 * Firebase REAL (sin gcloud) — usa service account:
 *   1) Firebase Console → Project settings → Service accounts
 *      → Generate new private key → guarda como:
 *         serviceAccountKey.json   (en la raíz del repo; NO lo subas a git)
 *   2) npm run seed:landing-balvi:prod
 *
 * Clasificación de medios:
 *   RELOJ: img-01..14  |  NO USAR: img-15..26
 *   VIDEO: video-01, video-02
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
    if (fs.existsSync(p)) {
      return { path: p, data: JSON.parse(fs.readFileSync(p, "utf8")) };
    }
  }
  return null;
}

if (TO_PROD && !CONFIRMED) {
  console.error("");
  console.error("⚠️  Seed a Firebase REAL (sistema-gestion-3b225).");
  console.error("    Esto crea/actualiza la landing + producto en producción.");
  console.error("");
  console.error("    Confirma con:");
  console.error("      npm run seed:landing-balvi:prod");
  console.error("");
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
    console.error("");
    console.error("❌ No hay credenciales para Firebase real (y no tienes gcloud).");
    console.error("");
    console.error("Haz esto UNA vez:");
    console.error("  1. Entra a https://console.firebase.google.com/");
    console.error("  2. Proyecto: sistema-gestion-3b225 (wala.pe)");
    console.error("  3. ⚙ Project settings → Service accounts");
    console.error("  4. Generate new private key");
    console.error("  5. Guarda el JSON en la raíz del repo como:");
    console.error("       C:\\SpringProjects\\wala-master\\serviceAccountKey.json");
    console.error("  6. Vuelve a correr: npm run seed:landing-balvi:prod");
    console.error("");
    console.error("Ese archivo NO se sube a git (debe estar en .gitignore).");
    console.error("");
    process.exit(1);
  }

  const admin = require(require.resolve("firebase-admin", { paths: [fnModules] }));
  admin.initializeApp({
    credential: admin.credential.cert(sa.data),
    projectId: sa.data.project_id || PROD_PROJECT_ID,
  });
  db = admin.firestore();
  console.log(`→ Sembrando en Firebase REAL: ${sa.data.project_id || PROD_PROJECT_ID}`);
  console.log(`  Credenciales: ${path.basename(sa.path)}`);
} else {
  const admin = require(require.resolve("firebase-admin", { paths: [fnModules] }));
  admin.initializeApp({ projectId: "demo-wala" });
  db = admin.firestore();
  console.log("→ Sembrando en EMULADOR local (demo-wala)");
}

// Marca renombrada a K-CHERO. El slug antiguo (reloj-matador-pro-2026) redirige
// al nuevo desde DynamicLandingPage (src/constants/landingSlugs.js).
const SLUG = "reloj-kchero-2026";
const LP_ID = "lp-reloj-kchero-2026";
const PRODUCT_ID = "reloj-kchero-2026";
const LINK = `/producto/${PRODUCT_ID}`;
const PAY_ANCHOR = "#pagar-ahora";
const MEDIA = "/landing-matador";
const PRICE_PEN = 129.99;
const PRECIO_ORIGINAL = 200;
const OFFER_HOURS = 1;
const PRICE_LABEL = `S/${PRICE_PEN.toFixed(2)}`;
const ORIGINAL_LABEL = `S/${PRECIO_ORIGINAL}`;
const OFFER_BADGE = "OFERTA EXCLUSIVA";

const CUSTOMER_COMMENTS = [
  {
    name: "Carlos R.",
    city: "Arequipa",
    product: "Poedagar · Plata Clásico",
    stars: 5,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop&crop=face&auto=format&q=80",
    text: "Desde que me lo puse, siento que subí de nivel. Ahora sí, modo K-CHERAZO activado.",
  },
  {
    name: "María Fernanda",
    city: "Trujillo",
    product: "Poedagar · Bicolor Oro Negro",
    stars: 5,
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop&crop=face&auto=format&q=80",
    text: "Se lo regalé a mi novio y ahora camina como si fuera famoso jajaja. Pero la verdad, se ve demasiado elegante.",
  },
  {
    name: "Jhonatan M.",
    city: "Lima",
    product: "Ben Yi · Negro Oro Rosa",
    stars: 5,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&crop=face&auto=format&q=80",
    text: "Por fin encontré algo que combina con todo. Me lo puse y ya me sentí más K-CHERO al toque.",
  },
  {
    name: "Valeria S.",
    city: "Chiclayo",
    product: "Curren · Gunmetal Fecha",
    stars: 5,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=160&fit=crop&crop=face&auto=format&q=80",
    text: "Mi novio decía que no necesitaba uno… ahora no se lo quiere quitar. Se cree galán, pero le queda bien.",
  },
  {
    name: "Kevin A.",
    city: "Cusco",
    product: "Curren · Azul Sport",
    stars: 5,
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=160&h=160&fit=crop&crop=face&auto=format&q=80",
    text: "Se ve caro y elegante. Para el precio está demasiado bueno, me dejó sorprendido.",
  },
  {
    name: "Luciana P.",
    city: "Huancayo",
    product: "Poedagar · Negro Plata",
    stars: 5,
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=160&h=160&fit=crop&crop=face&auto=format&q=80",
    text: "Se lo compré a mi enamorado y ahora se arregla más que yo jajaja. Sí cambia bastante el outfit.",
  },
  {
    name: "Diego F.",
    city: "Piura",
    product: "Curren · Negro Amarillo",
    stars: 5,
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=160&h=160&fit=crop&crop=face&auto=format&q=80",
    text: "Me llegó rápido y bien presentado. Apenas me lo puse, mi causa me dijo: “ya te crees K-CHERO”. Recomendado.",
  },
  {
    name: "Andrea M.",
    city: "Ica",
    product: "Poedagar · Azul Bicolor",
    stars: 5,
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&h=160&fit=crop&crop=face&auto=format&q=80",
    text: "Era para regalo y quedó perfecto. Mi novio feliz, ahora hasta posa con la mano para que se vea.",
  },
  {
    name: "Luis G.",
    city: "Arequipa",
    product: "Ben Yi · Navy Oro Rosa",
    stars: 5,
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=160&h=160&fit=crop&crop=face&auto=format&q=80",
    text: "El diseño está brutal. No es exagerado, pero llama la atención. Perfecto para verse más serio y con flow.",
  },
];

// Catálogo real por imagen (marca leída en dial / ficha ML)
const WATCH_CATALOG = [
  {
    key: "hero",
    img: "img-01",
    brand: "Ben Yi Fashion",
    mlTitle: "Cronógrafo cuadrado hombre acero",
    label: "Ben Yi · Negro Oro Rosa",
    blurb: "Cuadrado cronógrafo negro mate, índices oro rosa y correa metal negra.",
  },
  {
    key: "bluePoedagar",
    img: "img-02",
    brand: "Poedagar",
    mlTitle: "Reloj Elegante Para Hombre Poedagar Acero Inoxidable",
    label: "Poedagar · Azul Bicolor",
    blurb: "Dial azul sunburst, día-fecha y brazalete bicolor plata con eslabones dorados.",
  },
  {
    key: "navyGold",
    img: "img-03",
    brand: "Ben Yi Fashion",
    mlTitle: "Cronógrafo cuadrado hombre acero",
    label: "Ben Yi · Navy Oro Rosa",
    blurb: "Cuadrado navy con cronógrafo, detalles oro rosa y fecha al costado.",
  },
  {
    key: "currenGunmetal",
    img: "img-04",
    brand: "Curren",
    mlTitle: "Reloj Curren cronógrafo hombre acero",
    label: "Curren · Gunmetal Fecha",
    blurb: "Acabado gunmetal, dial negro y rueda de fecha visible estilo deportivo.",
  },
  {
    key: "currenBlue",
    img: "img-05",
    brand: "Curren",
    mlTitle: "Reloj Curren deportivo silicona hombre",
    label: "Curren · Azul Sport",
    blurb: "Look militar azul/negro, correa silicona azul y cronógrafo funcional.",
  },
  {
    key: "blackSilver",
    img: "img-06",
    brand: "Poedagar",
    mlTitle: "Reloj Elegante Para Hombre Poedagar Acero Inoxidable",
    label: "Poedagar · Negro Plata",
    blurb: "Variante clásica: esfera negra, números plata, día-fecha y brazalete acero.",
  },
  {
    key: "squareBlue",
    img: "img-07",
    brand: "Poedagar",
    mlTitle: "Reloj Poedagar cuadrado cronógrafo acero",
    label: "Poedagar · Cuadrado Azul",
    blurb: "Caja cuadrada azul navy, 3 subesferas cronógrafo y brazalete plata.",
  },
  {
    key: "currenYellow",
    img: "img-08",
    brand: "Curren",
    mlTitle: "Reloj Curren deportivo silicona hombre",
    label: "Curren · Negro Amarillo",
    blurb: "Deportivo negro con acentos amarillos, correa silicona y fecha al 3.",
  },
  {
    key: "twoTone",
    img: "img-09",
    brand: "Poedagar",
    mlTitle: "Reloj Elegante Para Hombre Poedagar Acero Inoxidable",
    label: "Poedagar · Bicolor Oro Negro",
    blurb: "Esfera negra, brazalete plata+oro y bisel facetado; variante premium.",
  },
  {
    key: "silverClassic",
    img: "img-10",
    brand: "Poedagar",
    mlTitle: "Reloj Elegante Para Hombre Poedagar Acero Inoxidable",
    label: "Poedagar · Plata Clásico",
    blurb: "Dial plata con números arábigos, día-fecha y brazalete acero pulido.",
  },
  {
    key: "goldWomen",
    img: "img-11",
    brand: "Luifudo",
    mlTitle: "Reloj Luifudo cuadrado dorado mujer/hombre",
    label: "Luifudo · Dorado Minimal",
    blurb: "Cuadrado dorado minimalista, esfera negra lisa y brazalete joya.",
  },
  {
    key: "blackGold",
    img: "img-12",
    brand: "Curren",
    mlTitle: "Reloj Curren cuadrado cronógrafo hombre",
    label: "Curren · Negro Oro Cuadrado",
    blurb: "Cronógrafo cuadrado negro, índices dorados y brazalete metal negro.",
  },
  {
    key: "currenGrey",
    img: "img-13",
    brand: "Curren",
    mlTitle: "Reloj Curren deportivo silicona hombre",
    label: "Curren · Gris Sport",
    blurb: "Estilo cronómetro gris/negro, correa silicona gris y dial multifunción.",
  },
  {
    key: "navyRose",
    img: "img-14",
    brand: "Ben Yi Fashion",
    mlTitle: "Cronógrafo cuadrado hombre acero",
    label: "Ben Yi · Navy Brazalete Negro",
    blurb: "Cuadrado navy oro rosa con brazalete negro brillante y cronógrafo.",
  },
];

const IMG = Object.fromEntries(
  WATCH_CATALOG.map((w) => [w.key, `${MEDIA}/${w.img}.jpeg`]),
);

const VID = {
  v1: `${MEDIA}/video/video-01.mp4`,
  v2: `${MEDIA}/video/video-02.mp4`,
};

const BG = {
  dark: "#0a0a0a",
  gold: "#1a1508",
  cream: "#faf8f5",
  white: "#ffffff",
  gray: "#f4f4f5",
};

let _order = 0;
const next = () => _order++;
const sid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function hdr(title, subtitle, bg, colors = {}, btn) {
  return {
    id: sid("h"),
    type: "header",
    order: next(),
    settings: {
      compact: true,
      title,
      subtitle: subtitle || "",
      backgroundColor: bg,
      titleColor: colors.title || "#0a0a0a",
      subtitleColor: colors.sub || "#64748b",
      textAlign: "center",
      paddingTop: colors.padTop || "1rem",
      paddingBottom: colors.padBottom || "0.5rem",
      buttonText: btn?.text || "",
      buttonLink: btn?.link || "",
    },
  };
}

function videoSection(url, poster, opts = {}) {
  return {
    id: sid("vid"),
    type: "video",
    order: next(),
    settings: {
      url,
      poster: poster || "",
      aspectRatio: opts.aspect || "9:16",
      backgroundColor: opts.bg || BG.dark,
      paddingTop: opts.pt || "0.5rem",
      paddingBottom: opts.pb || "0.5rem",
    },
  };
}

async function setDoc(coll, id, data) {
  await db.collection(coll).doc(id).set(data, { merge: true });
}

(async () => {
  const offerEnds = new Date(Date.now() + OFFER_HOURS * 3600 * 1000).toISOString();

  // Categoría propia para que aparezca filtrable en el catálogo de productos
  await setDoc("tienda_categories", "accesorios", {
    name: "Accesorios",
    imageUrl: IMG.hero,
    order: 2,
  });

  await setDoc("productos_wala", PRODUCT_ID, {
    name: "Reloj K-CHERO 2026 — Edición Limitada",
    sku: "RELOJ-KCHERO-2026",
    description: [
      "<p><strong>El reloj que te hace ver K-CHERO.</strong> Acero premium, presencia real en la muñeca y ese detalle que se nota apenas entras.</p>",
      "<ul>",
      "<li><strong>14 acabados oficiales</strong> — cronógrafos, deportivos y ediciones cuadradas. Eliges el tuyo en el carrusel.</li>",
      "<li><strong>Acero inoxidable</strong> con correa metálica o silicona según el modelo.</li>",
      "<li><strong>Cronógrafo y fecha</strong> funcionales, dial multifunción.</li>",
      "<li><strong>Resistente al agua</strong> para el día a día (salpicaduras y lluvia).</li>",
      "<li><strong>Garantía 12 meses</strong> y devolución fácil.</li>",
      "</ul>",
      "<p>Envío a todo el Perú · Pago seguro con tarjeta o Yape · También puedes coordinarlo por WhatsApp.</p>",
    ].join(""),
    // price = ORIGINAL (tachado) y salePrice = OFERTA. La PDP muestra salePrice
    // como precio grande, price como precio tachado y el % de descuento entre
    // ambos (ver ProductDetail: displayPrice=salePrice, originalPrice=price).
    // El carrito cobra salePrice (CartContext), así que el importe sigue siendo
    // la oferta. Antes ambos eran PRICE_PEN → salía "-0%" sin descuento visible.
    price: PRECIO_ORIGINAL,
    salePrice: PRICE_PEN,
    compareAtPrice: PRECIO_ORIGINAL,
    precioOriginal: PRECIO_ORIGINAL,
    mainImage: IMG.hero,
    images: [
      IMG.hero,
      IMG.navyGold,
      IMG.currenBlue,
      IMG.blackSilver,
      IMG.squareBlue,
      IMG.twoTone,
      IMG.blackGold,
      IMG.navyRose,
    ],
    visible: true,
    deleted: false,
    featured: true,
    featuredOrder: 0,
    vendorId: "casa",
    nicheId: "regala-con-amor",
    fulfillmentType: "stock",
    customizable: false,
    hasVariants: false,
    inStock: 120,
    categories: ["accesorios", "polos"],
    tags: ["reloj", "kchero", "chero", "accesorio", "regalo"],
    // Tokens para búsqueda (misma lógica que buildSearchTokens en products.js)
    searchTokens: [
      "re", "rel", "relo", "reloj",
      "kc", "kch", "kche", "kcher", "kchero", "ch", "che", "cher", "chero",
      "pr", "pro", "2026",
      "ac", "acc", "acce", "acces", "acceso", "accesor", "accesori", "accesorio",
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isV2: true,
  });

  await setDoc("landingPages", LP_ID, {
    title: "Reloj K-CHERO 2026 — Landing",
    slug: SLUG,
    brandId: "",
    hideHeader: true,
    hideFooter: true,
    themeId: "",
    linkedProducts: [{ productId: PRODUCT_ID, stockType: "global", allocatedStock: 0 }],
    updatedAt: new Date().toISOString(),
  });

  _order = 0;
  const sections = [
    // ═══ BARRA SUPERIOR ════════════════════════════════════════════════════
    {
      id: sid("ann"),
      type: "announcement_bar",
      order: next(),
      settings: {
        messages: [
          { text: `ENVÍO GRATIS A TODO EL PERÚ · ${OFFER_BADGE}`, link: PAY_ANCHOR, textAlign: "center" },
        ],
        speed: 4000,
        bgColor: "#050505",
        textColor: "#e8e8ea",
      },
    },

    // ═══ 1) TÍTULO HERO ════════════════════════════════════════════════════
    {
      id: sid("hero-h"),
      type: "header",
      order: next(),
      settings: {
        compact: true,
        title: "¿Quieres verte K-CHERO?",
        subtitle: "Empieza por el reloj.",
        titleHighlight: "K",
        titleHighlightColor: "#e10600",
        backgroundColor: "#070708",
        titleColor: "#f5f5f5",
        subtitleColor: "#a1a1aa",
        textAlign: "center",
        titleFontSize: "clamp(1.45rem, 6.2vw, 2rem)",
        titleFontWeight: "900",
        subtitleFontSize: "0.95rem",
        paddingTop: "1.1rem",
        paddingBottom: "0.55rem",
      },
    },

    // ═══ 2) VIDEO ══════════════════════════════════════════════════════════
    videoSection(VID.v1, IMG.hero, {
      aspect: "9:16",
      bg: "#050505",
      pt: "0",
      pb: "0",
    }),

    // ═══ 3) CONVERSIÓN (carrusel + precio + CTA) ═══════════════════════════
    {
      id: sid("fold"),
      type: "conversion_fold",
      order: next(),
      settings: {
        imageUrl: IMG.hero,
        imageAlt: "Reloj K-CHERO 2026 — cronógrafo negro",
        showHeroImage: false,
        coverflow: true,
        brandName: "CHERO",
        brandMark: "K",
        badge: "ACTIVADO 2026",
        title: "",
        subtitle: "",
        features: [],
        variants: WATCH_CATALOG.map((w, i) => ({
          id: w.key,
          imageUrl: IMG[w.key],
          label: w.label,
          brand: w.brand,
          mlTitle: w.mlTitle,
          tagline: `${w.brand} · ${w.img}`,
          blurb: w.blurb,
          accent: ["#e10600", "#2f6fed", "#fb7185", "#9aa4b2", "#2f6fed", "#9aa4b2", "#2f6fed", "#f0b429", "#c9a66b", "#9aa4b2", "#f0b429", "#f0b429", "#9aa4b2", "#fb7185"][i],
        })),
        socialProofBadge: "+2.400 clientes ya lo eligieron",
        endTime: offerEnds,
        // Duración de la cuenta regresiva "evergreen": cuando endTime vence, cada
        // visitante recibe su propia ventana de OFFER_HOURS que se regenera sola.
        offerHours: OFFER_HOURS,
        countdownLabel: "OFERTA POR TIEMPO LIMITADO",
        montoPEN: PRICE_PEN,
        precioOriginal: PRECIO_ORIGINAL,
        discountLabel: OFFER_BADGE,
        rating: 4.9,
        reviewCount: "1,867",
        miniTrust: ["Pago seguro", "Garantía 12 meses", "Devolución fácil"],
        customerComments: CUSTOMER_COMMENTS,
        ctaPrimaryText: "Lo quiero comprar ya",
        ctaPrimarySub: "Envío gratis · Pago seguro",
        ctaPrimaryLink: PAY_ANCHOR,
        secureText: "COMPRA 100% SEGURA",
        paymentLogos: ["VISA", "MC", "AMEX", "YAPE", "BCP"],
        shipBarText: "",
        trustText: "Envío gratis a todo el Perú",
        showWhatsApp: true,
        whatsappMessage: "Hola, me interesa el Reloj K-CHERO 2026",
        accentColor: "#e10600",
        backgroundColor: "#070708",
      },
    },

    // ═══ CHECKOUT ══════════════════════════════════════════════════════════
    {
      id: sid("pay"),
      type: "landing_payment",
      order: next(),
      settings: {
        title: "Finaliza tu compra",
        subtitle: `Reloj K-CHERO 2026 · ${OFFER_BADGE}`,
        concepto: `Reloj K-CHERO 2026 — ${OFFER_BADGE}`,
        montoPEN: PRICE_PEN,
        precioOriginal: PRECIO_ORIGINAL,
        showPriceBlock: false,
        hideCheckoutHeader: false,
        peruOnly: true,
        stickyCTA: "Continuar al pago",
        whatsappNumber: "51924426791", // botón "Comprar por WhatsApp" → wa.me/51924426791
        mascotPhrases: [
          "¡Se ve más caro de lo que cuesta! 🔥",
          "Activado 2026 · tú también te lo mereces",
          "Últimas unidades · no lo pienses mucho",
          "Queda brutal con cualquier outfit 😮‍💨",
        ],
        productId: PRODUCT_ID,
        showCulqi: true,
        showPayPal: false,
        anchorId: "pagar-ahora",
        backgroundColor: "#f8fafc",
        paddingTop: "0.75rem",
        paddingBottom: "0",
      },
    },

    // ═══ FAQ ═══════════════════════════════════════════════════════════════
    {
      id: sid("faq"),
      type: "faq_accordion",
      order: next(),
      settings: {
        title: "Preguntas frecuentes",
        items: [
          {
            question: "¿De verdad puedo pagar al recibir?",
            answer:
              "Sí. Trabajamos con pago contra entrega verificado: liquidas el total cuando el courier te entrega el pedido en mano. Si quieres asegurar tu unidad antes del despacho, puedes separarla con un adelanto de S/ 10 (reserva de stock) y completar el saldo al recibir. Si cambias de opinión antes de que salga de almacén, puedes solicitar la anulación completa del pedido sin penalidad.",
          },
          {
            question: "¿Cuánto demora el delivery?",
            answer:
              "En Lima Metropolitana despachamos en modalidad express: entrega en un máximo de 48 horas hábiles desde la confirmación de tu pedido. Te enviamos seguimiento por WhatsApp en cuanto el paquete sale de nuestro centro de distribución.",
          },
          {
            question: "¿Puedo elegir color o acabado?",
            answer:
              "Sí. El reloj incluye 14 acabados oficiales disponibles en catálogo (variedad de cronógrafos, deportivos y ediciones limitadas). Al comprar indicas la referencia que ves en el carrusel o nos confirmas por WhatsApp; validamos stock del acabado elegido antes del despacho para garantizar que recibes exactamente el modelo que seleccionaste.",
          },
        ],
        defaultOpen: true,
        backgroundColor: "#ffffff",
      },
    },

    hdr(
      "Últimas unidades",
      `Cuando se agoten, el precio vuelve a ${ORIGINAL_LABEL}`,
      BG.dark,
      { title: "#f5f5f5", sub: "#a1a1aa", padTop: "1.35rem", padBottom: "0.65rem" },
      { text: `Comprar ahora — ${PRICE_LABEL}`, link: PAY_ANCHOR }
    ),
  ];

  await setDoc("pages", SLUG, { sections });

  // ── Producto ANTIGUO (slug "matador"): lo ocultamos ──────────────────────
  // La ficha vive ahora en productos_wala/reloj-kchero-2026. El doc viejo se
  // marca oculto/borrado (merge: NO se borra el documento ni otros campos) para
  // que no aparezca en el catálogo ni compita con la nueva ficha. La URL vieja
  // de la landing ya redirige al nuevo slug desde el front.
  const LEGACY_PRODUCT_ID = "reloj-matador-pro-2026";
  if (LEGACY_PRODUCT_ID !== PRODUCT_ID) {
    await setDoc("productos_wala", LEGACY_PRODUCT_ID, {
      visible: false,
      deleted: true,
      updatedAt: new Date().toISOString(),
    });
    console.log(`  Producto viejo oculto: productos_wala/${LEGACY_PRODUCT_ID}`);
  }

  const baseUrl = TO_PROD ? "https://wala.pe" : "http://localhost:3001";
  console.log("");
  console.log(`✓ Landing + producto (${TO_PROD ? "PRODUCCIÓN" : "emulador"})`);
  console.log(`  Destino:        ${TO_PROD ? PROD_PROJECT_ID : "demo-wala (emulator)"}`);
  console.log(`  Producto:       productos_wala/${PRODUCT_ID}`);
  console.log(`  Landing doc:    landingPages/${LP_ID}`);
  console.log(`  Secciones:      pages/${SLUG} (${sections.length} bloques)`);
  console.log(`  Categoría:      accesorios (+ polos)`);
  console.log(`  Landing URL:    ${baseUrl}/${SLUG}`);
  console.log(`  Ficha PDP:      ${baseUrl}/producto/${PRODUCT_ID}`);
  if (TO_PROD) {
    console.log("  Admin:          https://wala.pe/admin/landing-pages");
    console.log("  Nota:           refresca el admin; debe aparecer el slug.");
  }
  console.log("");
  process.exit(0);
})().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
