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
    'cta.payNow': 'Pagar',
    'cta.goToCart': 'Ir al carrito',

    'account.misCompras': 'Mis Compras',
    'account.wishlist': 'Lista de Deseos',
    'account.creaciones': 'Mis Creaciones',
    'account.referidos': 'Mis Referidos',
    'account.fechas': 'Fechas Importantes',
    'account.misiones': 'Misiones',
    'account.catalogo': 'Catálogo Recompensas',
    'account.perfil': 'Mi Perfil',

    'common.search': 'Buscar',
    'common.viewCart': 'Ver carrito',
    'common.checkout': 'Pagar',
    'common.save': 'Guardar',
    'common.edit': 'Editar',
    'common.logout': 'Cerrar sesión',
    'common.add': 'Agregar',
    'common.continue': 'Continuar',
    'common.cancel': 'Cancelar',

    'lang.popupTitle': '¿Ver Walá en tu idioma?',
    'lang.popupYes': 'Sí, cambiar idioma',
    'lang.popupOriginal': 'Ver en Español',

    // Nombres legibles de cada idioma (para selectores / accesibilidad).
    'lang.name.es': 'Español',
    'lang.name.en': 'Inglés',
    'lang.name.pt': 'Portugués (Brasil)',
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
    'cta.payNow': 'Pay',
    'cta.goToCart': 'Go to cart',

    'account.misCompras': 'My Purchases',
    'account.wishlist': 'Wishlist',
    'account.creaciones': 'My Creations',
    'account.referidos': 'My Referrals',
    'account.fechas': 'Important Dates',
    'account.misiones': 'Missions',
    'account.catalogo': 'Rewards Catalog',
    'account.perfil': 'My Profile',

    'common.search': 'Search',
    'common.viewCart': 'View cart',
    'common.checkout': 'Checkout',
    'common.save': 'Save',
    'common.edit': 'Edit',
    'common.logout': 'Log out',
    'common.add': 'Add',
    'common.continue': 'Continue',
    'common.cancel': 'Cancel',

    'lang.popupTitle': 'View Walá in your language?',
    'lang.popupYes': 'Yes, switch language',
    'lang.popupOriginal': 'View in Spanish',

    // Nombres legibles de cada idioma (para selectores / accesibilidad).
    'lang.name.es': 'Spanish',
    'lang.name.en': 'English',
    'lang.name.pt': 'Portuguese (Brazil)',
  },

  // ── Portugués de Brasil (pt-BR) ───────────────────────────────────────────
  // Todas las traducciones de esta sección son pt-BR. El código de idioma sigue
  // siendo 'pt'; navigator.language 'pt-BR'/'pt' se normaliza a 'pt'.
  pt: {
    'nav.tienda': 'Loja',
    'nav.crear': 'Criar',
    'nav.categorias': 'Categorias',
    'nav.minijuegos': 'Minijogos',
    'nav.cuenta': 'Conta',
    'nav.admin': 'Admin',

    'cta.addToCart': 'Adicionar ao carrinho',
    'cta.buyNow': 'Comprar',
    'cta.payNow': 'Pagar',
    'cta.goToCart': 'Ir para o carrinho',

    'account.misCompras': 'Minhas Compras',
    'account.wishlist': 'Lista de Desejos',
    'account.creaciones': 'Minhas Criações',
    'account.referidos': 'Minhas Indicações',
    'account.fechas': 'Datas Importantes',
    'account.misiones': 'Missões',
    'account.catalogo': 'Catálogo de Recompensas',
    'account.perfil': 'Meu Perfil',

    'common.search': 'Buscar',
    'common.viewCart': 'Ver carrinho',
    'common.checkout': 'Finalizar compra',
    'common.save': 'Salvar',
    'common.edit': 'Editar',
    'common.logout': 'Sair',
    'common.add': 'Adicionar',
    'common.continue': 'Continuar',
    'common.cancel': 'Cancelar',

    'lang.popupTitle': 'Ver Walá no seu idioma?',
    'lang.popupYes': 'Sim, mudar idioma',
    'lang.popupOriginal': 'Ver em Espanhol',

    // Nombres legibles de cada idioma (para selectores / accesibilidad).
    'lang.name.es': 'Espanhol',
    'lang.name.en': 'Inglês',
    'lang.name.pt': 'Português (Brasil)',
  },
};

export default dictionaries;
