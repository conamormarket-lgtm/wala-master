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

    // ── Catálogo / filtros (SidebarCatalogLayout) ──────────────────────────
    'cat.filtros': 'Filtros',
    'cat.categorias': 'Categorías',
    'cat.todasCategorias': 'Todas las categorías',
    'cat.temporadas': 'Temporadas',
    'cat.todas': 'Todas',
    'cat.colecciones': 'Colecciones',
    'cat.marcas': 'Marcas',
    'cat.tipoProducto': 'Tipo de Producto',
    'cat.etiquetas': 'Etiquetas',
    'cat.personajes': 'Personajes',
    'cat.limpiarFiltros': 'Limpiar filtros',
    'cat.catalogoCompleto': 'Catálogo Completo',

    // ── Cards de producto ──────────────────────────────────────────────────
    'card.disponibles': 'disponibles',
    'card.personalizable': 'Personalizable',
    'card.combo': 'Combo',
    'card.agotado': 'Agotado',
    'card.nuevo': 'NEW IN',
    'card.oferta': 'SALE',
    'card.favorito': 'Agregar a favoritos',
    'card.envioRapido': 'Envío Rápido y Seguro',
    'card.essential': 'Essential',
    // ── Detalle de producto (ProductDetail) ────────────────────────────────
    'card.inicio': 'Inicio',
    'card.compartirGanar': 'Compartir y ganar monedas',
    'card.color': 'Color',
    'card.talla': 'Talla',
    'card.cantidad': 'Cantidad',
    'card.agregarCarrito': 'Agregar al carrito',
    'card.personalizar': 'Personalizar',
    'card.envioPais': 'Envío a todo el país',
    'card.cambiosDevoluciones': 'Cambios y devoluciones',
    'card.pagoSeguro': 'Pago seguro',
    'card.descripcion': 'Descripción',
    'card.noEncontrado': 'Producto no encontrado.',

    // ── Grid / navegación de catálogo ──────────────────────────────────────
    'grid.cargando': 'Cargando productos…',
    'grid.errorCargar': 'No pudimos cargar los productos',
    'grid.proximamente': 'Próximamente más productos',
    'nav.todos': 'Todos',
    'nav.cargandoCategorias': 'Cargando categorías…',

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

    // ── Catálogo / filtros (SidebarCatalogLayout) ──────────────────────────
    'cat.filtros': 'Filters',
    'cat.categorias': 'Categories',
    'cat.todasCategorias': 'All categories',
    'cat.temporadas': 'Seasons',
    'cat.todas': 'All',
    'cat.colecciones': 'Collections',
    'cat.marcas': 'Brands',
    'cat.tipoProducto': 'Product Type',
    'cat.etiquetas': 'Tags',
    'cat.personajes': 'Characters',
    'cat.limpiarFiltros': 'Clear filters',
    'cat.catalogoCompleto': 'Full Catalog',

    // ── Cards de producto ──────────────────────────────────────────────────
    'card.disponibles': 'available',
    'card.personalizable': 'Customizable',
    'card.combo': 'Combo',
    'card.agotado': 'Sold out',
    'card.nuevo': 'NEW IN',
    'card.oferta': 'SALE',
    'card.favorito': 'Add to favorites',
    'card.envioRapido': 'Fast & Secure Shipping',
    'card.essential': 'Essential',
    // ── Detalle de producto (ProductDetail) ────────────────────────────────
    'card.inicio': 'Home',
    'card.compartirGanar': 'Share and earn coins',
    'card.color': 'Color',
    'card.talla': 'Size',
    'card.cantidad': 'Quantity',
    'card.agregarCarrito': 'Add to cart',
    'card.personalizar': 'Customize',
    'card.envioPais': 'Nationwide shipping',
    'card.cambiosDevoluciones': 'Exchanges & returns',
    'card.pagoSeguro': 'Secure payment',
    'card.descripcion': 'Description',
    'card.noEncontrado': 'Product not found.',

    // ── Grid / navegación de catálogo ──────────────────────────────────────
    'grid.cargando': 'Loading products…',
    'grid.errorCargar': 'We couldn’t load the products',
    'grid.proximamente': 'More products coming soon',
    'nav.todos': 'All',
    'nav.cargandoCategorias': 'Loading categories…',

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

    // ── Catálogo / filtros (SidebarCatalogLayout) ──────────────────────────
    'cat.filtros': 'Filtros',
    'cat.categorias': 'Categorias',
    'cat.todasCategorias': 'Todas as categorias',
    'cat.temporadas': 'Temporadas',
    'cat.todas': 'Todas',
    'cat.colecciones': 'Coleções',
    'cat.marcas': 'Marcas',
    'cat.tipoProducto': 'Tipo de Produto',
    'cat.etiquetas': 'Etiquetas',
    'cat.personajes': 'Personagens',
    'cat.limpiarFiltros': 'Limpar filtros',
    'cat.catalogoCompleto': 'Catálogo Completo',

    // ── Cards de producto ──────────────────────────────────────────────────
    'card.disponibles': 'disponíveis',
    'card.personalizable': 'Personalizável',
    'card.combo': 'Combo',
    'card.agotado': 'Esgotado',
    'card.nuevo': 'NOVO',
    'card.oferta': 'PROMO',
    'card.favorito': 'Adicionar aos favoritos',
    'card.envioRapido': 'Envio Rápido e Seguro',
    'card.essential': 'Essencial',
    // ── Detalle de producto (ProductDetail) ────────────────────────────────
    'card.inicio': 'Início',
    'card.compartirGanar': 'Compartilhar e ganhar moedas',
    'card.color': 'Cor',
    'card.talla': 'Tamanho',
    'card.cantidad': 'Quantidade',
    'card.agregarCarrito': 'Adicionar ao carrinho',
    'card.personalizar': 'Personalizar',
    'card.envioPais': 'Envio para todo o país',
    'card.cambiosDevoluciones': 'Trocas e devoluções',
    'card.pagoSeguro': 'Pagamento seguro',
    'card.descripcion': 'Descrição',
    'card.noEncontrado': 'Produto não encontrado.',

    // ── Grid / navegación de catálogo ──────────────────────────────────────
    'grid.cargando': 'Carregando produtos…',
    'grid.errorCargar': 'Não conseguimos carregar os produtos',
    'grid.proximamente': 'Em breve, mais produtos',
    'nav.todos': 'Todos',
    'nav.cargandoCategorias': 'Carregando categorias…',

    // Nombres legibles de cada idioma (para selectores / accesibilidad).
    'lang.name.es': 'Espanhol',
    'lang.name.en': 'Inglês',
    'lang.name.pt': 'Português (Brasil)',
  },
};

export default dictionaries;
