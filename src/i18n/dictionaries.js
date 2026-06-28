// ──────────────────────────────────────────────────────────────────────────────
// Diccionarios i18n GRATIS para Walá (sin dependencias externas ni API de pago)
//
// Sólo cubrimos los strings VISIBLES principales (navegación y CTAs). El resto del
// contenido lo traduce GRATIS el traductor nativo del navegador, que se activa al
// fijar `document.documentElement.lang` (lo hace LanguageContext al cambiar idioma).
//
// Convención de claves: "seccion.nombre" en camelCase. Para añadir un idioma nuevo
// basta con agregar otra entrada al objeto `dictionaries`.
// ──────────────────────────────────────────────────────────────────────────────

export const dictionaries = {
  // ── Español (idioma original / fallback) ──────────────────────────────────
  es: {
    'nav.tienda': 'Tienda',
    'nav.crear': 'Crear',
    'nav.categorias': 'Categorías',
    'nav.minijuegos': 'Minijuegos',
    'nav.cuenta': 'Cuenta',
    'nav.admin': 'Admin',

    'cta.addToCart': 'Al carrito',
    'cta.buyNow': 'Comprar',

    'account.misCompras': 'Mis Compras',
    'account.wishlist': 'Lista de Deseos',

    'common.search': 'Buscar',
    'common.viewCart': 'Ver carrito',
    'common.checkout': 'Pagar',

    'lang.popupTitle': '¿Ver Walá en tu idioma?',
    'lang.popupYes': 'Sí, cambiar idioma',
    'lang.popupOriginal': 'Ver en Español',
  },

  // ── Inglés ────────────────────────────────────────────────────────────────
  en: {
    'nav.tienda': 'Shop',
    'nav.crear': 'Create',
    'nav.categorias': 'Categories',
    'nav.minijuegos': 'Mini-games',
    'nav.cuenta': 'Account',
    'nav.admin': 'Admin',

    'cta.addToCart': 'Add to cart',
    'cta.buyNow': 'Buy now',

    'account.misCompras': 'My Purchases',
    'account.wishlist': 'Wishlist',

    'common.search': 'Search',
    'common.viewCart': 'View cart',
    'common.checkout': 'Checkout',

    'lang.popupTitle': 'View Walá in your language?',
    'lang.popupYes': 'Yes, switch language',
    'lang.popupOriginal': 'View in Spanish',
  },

  // ── Portugués ─────────────────────────────────────────────────────────────
  pt: {
    'nav.tienda': 'Loja',
    'nav.crear': 'Criar',
    'nav.categorias': 'Categorias',
    'nav.minijuegos': 'Minijogos',
    'nav.cuenta': 'Conta',
    'nav.admin': 'Admin',

    'cta.addToCart': 'Adicionar ao carrinho',
    'cta.buyNow': 'Comprar',

    'account.misCompras': 'Minhas Compras',
    'account.wishlist': 'Lista de Desejos',

    'common.search': 'Buscar',
    'common.viewCart': 'Ver carrinho',
    'common.checkout': 'Finalizar compra',

    'lang.popupTitle': 'Ver Walá no seu idioma?',
    'lang.popupYes': 'Sim, mudar idioma',
    'lang.popupOriginal': 'Ver em Espanhol',
  },
};

export default dictionaries;
