/**
 * Landing Reloj Matador Pro — con imágenes y videos propios (public/landing-matador)
 *
 * Uso: npm run seed:landing-balvi  (requiere emuladores activos)
 *
 * Clasificación de medios (carpeta imagenes/ + video/):
 *   RELOJ: img-01..14  |  NO USAR (billeteras/promos): img-15..26
 *   VIDEO: video-01, video-02 (ambos son reloj)
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "localhost:9099";

const path = require("path");
const admin = require(require.resolve("firebase-admin", {
  paths: [path.join(__dirname, "..", "functions", "node_modules")],
}));
admin.initializeApp({ projectId: "demo-wala" });
const db = admin.firestore();

const SLUG = "reloj-matador-pro-2026";
const LP_ID = "lp-reloj-matador-2026";
const PRODUCT_ID = "reloj-matador-pro-2026";
const LINK = `/producto/${PRODUCT_ID}`;
const PAY_ANCHOR = "#pagar-ahora";
const MEDIA = "/landing-matador";

// Solo fotos de RELOJ (excluye billeteras img-15..23,25 y promos img-24,26)
const IMG = {
  hero: `${MEDIA}/img-01.jpeg`, // negro cronógrafo — hero
  bluePoedagar: `${MEDIA}/img-02.jpeg`,
  navyGold: `${MEDIA}/img-03.jpeg`,
  currenGunmetal: `${MEDIA}/img-04.jpeg`,
  currenBlue: `${MEDIA}/img-05.jpeg`,
  blackSilver: `${MEDIA}/img-06.jpeg`,
  squareBlue: `${MEDIA}/img-07.jpeg`,
  currenYellow: `${MEDIA}/img-08.jpeg`,
  twoTone: `${MEDIA}/img-09.jpeg`,
  silverClassic: `${MEDIA}/img-10.jpeg`,
  goldWomen: `${MEDIA}/img-11.jpeg`,
  blackGold: `${MEDIA}/img-12.jpeg`,
  currenGrey: `${MEDIA}/img-13.jpeg`,
  navyRose: `${MEDIA}/img-14.jpeg`,
};

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
  const offerEnds = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

  // Categoría propia para que aparezca filtrable en el catálogo de productos
  await setDoc("tienda_categories", "accesorios", {
    name: "Accesorios",
    imageUrl: IMG.hero,
    order: 2,
  });

  await setDoc("productos_wala", PRODUCT_ID, {
    name: "Reloj Matador Pro 2026 — Edición Limitada",
    sku: "RELOJ-MATADOR-2026",
    description:
      "<p>Reloj premium de acero: acabado cronógrafo, fecha, correa metálica o silicona. El regalo que se nota en la muñeca.</p>",
    price: 89.9,
    salePrice: 89.9,
    compareAtPrice: 149.9,
    precioOriginal: 149.9,
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
    tags: ["reloj", "matador", "accesorio", "regalo"],
    // Tokens para búsqueda (misma lógica que buildSearchTokens en products.js)
    searchTokens: [
      "re", "rel", "relo", "reloj",
      "ma", "mat", "mata", "matad", "matado", "matador",
      "pr", "pro", "2026",
      "ac", "acc", "acce", "acces", "acceso", "accesor", "accesori", "accesorio",
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isV2: true,
  });

  await setDoc("landingPages", LP_ID, {
    title: "Reloj Matador Pro 2026 — Landing Balvi",
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
    // ═══ PRIMERA IMPRESIÓN ═════════════════════════════════════════════════
    {
      id: sid("fold"),
      type: "conversion_fold",
      order: next(),
      settings: {
        imageUrl: IMG.hero,
        imageAlt: "Reloj Matador Pro 2026 — cronógrafo negro",
        imageCaption: "Acero premium · Cronógrafo · Fecha",
        title: "Reloj Matador Pro 2026",
        subtitle:
          "Diseño elegante, cronógrafo funcional y acabado premium. Parece de S/400, pero hoy lo llevas por S/89.90.",
        socialProofBadge: "+2.400 clientes ya lo eligieron",
        endTime: offerEnds,
        countdownLabel: "Oferta termina en",
        montoPEN: 89.9,
        precioOriginal: 149.9,
        discountLabel: "40% OFF",
        rating: 5,
        reviewCount: "1,867",
        ctaPrimaryText: "Comprar ahora — S/89.90",
        ctaPrimarySub: "Envíos 24–48h · Pago seguro",
        ctaPrimaryLink: PAY_ANCHOR,
        ctaSecondaryText: "Ver acabados",
        ctaSecondaryLink: "#acabados",
        trustText: "Compra segura · Atención por WhatsApp",
        showWhatsApp: true,
        whatsappMessage: "Hola, me interesa el Reloj Matador Pro 2026",
        accentColor: "#d91f2b",
        backgroundColor: "#ffffff",
      },
    },

    {
      id: sid("ann"),
      type: "announcement_bar",
      order: next(),
      settings: {
        messages: [
          { text: "Envío gratis Lima · Paga al recibir · 40% OFF", link: PAY_ANCHOR, textAlign: "center" },
        ],
        speed: 4000,
        bgColor: "#0f1115",
        textColor: "#d4af37",
      },
    },

    // ═══ VIDEO 1 — producto en movimiento ══════════════════════════════════
    hdr("Míralo de cerca", "Detalle del acabado bajo la luz", BG.dark, {
      title: "#f5f5f5",
      sub: "#a1a1aa",
      padTop: "1.25rem",
      padBottom: "0.35rem",
    }),
    videoSection(VID.v1, IMG.hero, { aspect: "9:16", bg: BG.dark, pb: "1rem" }),

    // ═══ BENEFICIOS ════════════════════════════════════════════════════════
    {
      id: sid("feat1"),
      type: "feature_list",
      order: next(),
      settings: {
        title: "Diseño premium sin pagar precio de lujo",
        subtitle: "Un reloj elegante, resistente y listo para usar todos los días.",
        imageUrl: IMG.navyRose,
        imageAlt: "Reloj navy con detalles oro rosa",
        items: [
          { icon: "✓", text: "Cronógrafo funcional + ventana de fecha" },
          { icon: "✓", text: "Acabado premium en negro, plata u oro" },
          { icon: "✓", text: "Resistente para uso diario" },
          { icon: "✓", text: "Listo para regalar" },
          { icon: "✓", text: "Parece de S/400, hoy pagas S/89.90" },
        ],
        backgroundColor: BG.white,
      },
    },

    // ═══ VIDEO 2 ═══════════════════════════════════════════════════════════
    hdr("En acción", "Así se ve cuando lo usas", BG.gray, {
      title: "#0f1115",
      sub: "#6b7280",
      padTop: "1.15rem",
      padBottom: "0.35rem",
    }),
    videoSection(VID.v2, IMG.currenBlue, { aspect: "9:16", bg: BG.gray, pb: "1rem" }),

    // ═══ COLORES / VARIANTES ═══════════════════════════════════════════════
    {
      id: sid("acab"),
      type: "header",
      order: next(),
      settings: {
        compact: true,
        title: "Elige tu acabado",
        subtitle: "Negro · Azul · Plata · Oro — desliza para ver todos",
        backgroundColor: "#f8fafc",
        titleColor: "#0f1115",
        subtitleColor: "#6b7280",
        textAlign: "center",
        paddingTop: "1.25rem",
        paddingBottom: "0.45rem",
      },
    },

    {
      id: sid("colors"),
      type: "bestsellers_row",
      order: next(),
      settings: {
        backgroundColor: "#f8fafc",
        paddingTop: "0",
        paddingBottom: "1rem",
        anchorId: "acabados",
        cards: [
          { id: "01", title: "Negro Elite", subtitle: "S/89.90 · Más vendido", imageUrl: IMG.hero, link: PAY_ANCHOR },
          { id: "02", title: "Azul Clásico", subtitle: "S/89.90", imageUrl: IMG.bluePoedagar, link: PAY_ANCHOR },
          { id: "03", title: "Navy Gold", subtitle: "S/89.90 · Premium", imageUrl: IMG.navyGold, link: PAY_ANCHOR },
          { id: "04", title: "Gunmetal", subtitle: "S/89.90 · Sport", imageUrl: IMG.currenGunmetal, link: PAY_ANCHOR },
          { id: "05", title: "Azul Sport", subtitle: "S/89.90", imageUrl: IMG.currenBlue, link: PAY_ANCHOR },
          { id: "06", title: "Negro Plata", subtitle: "S/89.90 · Ejecutivo", imageUrl: IMG.blackSilver, link: PAY_ANCHOR },
          { id: "07", title: "Cuadrado Azul", subtitle: "S/89.90 · Moderno", imageUrl: IMG.squareBlue, link: PAY_ANCHOR },
          { id: "08", title: "Negro Amarillo", subtitle: "S/89.90 · Bold", imageUrl: IMG.currenYellow, link: PAY_ANCHOR },
          { id: "09", title: "Two-tone", subtitle: "S/89.90 · Elegante", imageUrl: IMG.twoTone, link: PAY_ANCHOR },
          { id: "10", title: "Plata Clásico", subtitle: "S/89.90", imageUrl: IMG.silverClassic, link: PAY_ANCHOR },
          { id: "11", title: "Oro Dama", subtitle: "S/89.90", imageUrl: IMG.goldWomen, link: PAY_ANCHOR },
          { id: "12", title: "Negro Oro", subtitle: "S/89.90 · Lujo", imageUrl: IMG.blackGold, link: PAY_ANCHOR },
          { id: "13", title: "Gris Sport", subtitle: "S/89.90", imageUrl: IMG.currenGrey, link: PAY_ANCHOR },
          { id: "14", title: "Navy Rose", subtitle: "S/89.90 · Premium", imageUrl: IMG.navyRose, link: PAY_ANCHOR },
        ],
      },
    },

    // ═══ GALERÍA COMPACTA ══════════════════════════════════════════════════
    {
      id: sid("gal"),
      type: "feature_list",
      order: next(),
      settings: {
        title: "Más estilos disponibles",
        subtitle: "Indica tu color al pedir o por WhatsApp",
        imageUrl: IMG.squareBlue,
        imageAlt: "Reloj cuadrado azul plata",
        items: [
          { icon: "✓", text: "Cuadrado o redondo — varios modelos" },
          { icon: "✓", text: "Correa metal o silicona" },
          { icon: "✓", text: "Detalles oro, plata o negro" },
        ],
        backgroundColor: "#ffffff",
      },
    },

    {
      id: sid("gal2"),
      type: "feature_list",
      order: next(),
      settings: {
        title: "",
        subtitle: "",
        imageUrl: IMG.blackGold,
        imageAlt: "Reloj negro con detalles dorados",
        items: [],
        quote: "Se ve mucho más caro de lo que cuesta. Llegó bien embalado.",
        quoteAuthor: "Diego R. · Lima",
        backgroundColor: "#ffffff",
      },
    },

    // ═══ TESTIMONIOS ═══════════════════════════════════════════════════════
    {
      id: sid("rev"),
      type: "testimonials",
      order: next(),
      settings: {
        title: "Clientes que ya lo usan",
        subtitle: "Opiniones reales de compradores en Perú",
        testimonials: [
          {
            text: "Me llegó en 24h. Pagué al recibir y el reloj se ve mucho más caro. 10/10.",
            author: "Camila M.",
            city: "San Isidro, Lima",
            rating: 5,
            avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop&crop=face&auto=format&q=80",
          },
          {
            text: "Calidad premium, precio justo. Lo uso todos los días al trabajo.",
            author: "Marco V.",
            city: "Miraflores, Lima",
            rating: 5,
            avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop&crop=face&auto=format&q=80",
          },
          {
            text: "Se lo regalé a mi papá y no se lo quitó en todo el mes.",
            author: "Jorge T.",
            city: "Arequipa",
            rating: 5,
            avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&crop=face&auto=format&q=80",
          },
          {
            text: "Dudé por el precio, pero la calidad me sorprendió. Ya recomendé a 3 amigas.",
            author: "Lucía P.",
            city: "Trujillo",
            rating: 5,
            avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=160&h=160&fit=crop&crop=face&auto=format&q=80",
          },
          {
            text: "Se ve mucho más caro de lo que cuesta. Llegó bien embalado.",
            author: "Valentina R.",
            city: "Cusco",
            rating: 5,
            avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&h=160&fit=crop&crop=face&auto=format&q=80",
          },
        ],
        backgroundColor: "#f8fafc",
        paddingTop: "0.75rem",
        paddingBottom: "0.75rem",
      },
    },

    // ═══ SEGURIDAD ═════════════════════════════════════════════════════════
    {
      id: sid("trust"),
      type: "feature_list",
      order: next(),
      settings: {
        title: "Compra segura y entrega confiable",
        subtitle: "Tu dinero protegido hasta que lo tengas en mano",
        imageUrl: IMG.silverClassic,
        imageAlt: "Reloj plata clásico",
        items: [
          { icon: "✓", text: "Pago seguro con Culqi o PayPal" },
          { icon: "✓", text: "Envíos a Lima y provincias" },
          { icon: "✓", text: "Atención por WhatsApp" },
          { icon: "✓", text: "Garantía por fallas de fábrica" },
          { icon: "✓", text: "Producto revisado antes del envío" },
        ],
        backgroundColor: "#ffffff",
      },
    },

    // ═══ CHECKOUT ══════════════════════════════════════════════════════════
    {
      id: sid("pay"),
      type: "landing_payment",
      order: next(),
      settings: {
        title: "Finaliza tu compra",
        subtitle: "Reloj Matador Pro 2026 · Oferta 40% OFF",
        concepto: "Reloj Matador Pro 2026 — Oferta 40% OFF",
        montoPEN: 89.9,
        montoUSD: 23.99,
        precioOriginal: 149.9,
        showPriceBlock: false,
        hideCheckoutHeader: false,
        stickyCTA: "Comprar ahora",
        productId: PRODUCT_ID,
        showCulqi: true,
        showPayPal: true,
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
          { question: "¿De verdad pago al recibir?", answer: "Sí. En Lima pagas cuando el courier te lo entrega." },
          { question: "¿Cuánto demora el envío?", answer: "Lima: 24–48h · Provincia: 3–5 días hábiles." },
          { question: "¿Y si no me gusta?", answer: "30 días de garantía. Escríbenos y lo resolvemos." },
          { question: "¿Puedo elegir color?", answer: "Sí. Indica el color al comprar o por WhatsApp." },
        ],
        defaultOpen: true,
        backgroundColor: "#ffffff",
      },
    },

    hdr(
      "Últimas unidades",
      "Cuando se agoten, el precio vuelve a S/149.90",
      BG.dark,
      { title: "#f5f5f5", sub: "#a1a1aa", padTop: "1.35rem", padBottom: "0.65rem" },
      { text: "Comprar ahora — S/89.90", link: PAY_ANCHOR }
    ),
  ];

  await setDoc("pages", SLUG, { sections });

  console.log("");
  console.log("✓ Landing + producto en catálogo");
  console.log(`  Producto:       productos_wala/${PRODUCT_ID}`);
  console.log("  Categoría:      accesorios (+ polos)");
  console.log("  Relojes usados: img-01..14");
  console.log("  Videos:         video-01, video-02");
  console.log("  Excluidos:      img-15..26 (billeteras / promos)");
  console.log(`  Secciones:      ${sections.length}`);
  console.log(`  Landing:        http://localhost:3001/${SLUG}`);
  console.log(`  Ficha PDP:      http://localhost:3001/producto/${PRODUCT_ID}`);
  console.log("");
  process.exit(0);
})().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
