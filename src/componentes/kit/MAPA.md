# Mapa de componentes de la tienda

Inventario de lo que se ve en cada página real de wala.pe, de dónde sale hoy
y con qué se arma en el kit. Sirve de lista de trabajo: cada fila termina en
una pieza, una sección o una página del kit.

Leyenda: ✓ ya existe en el kit · ◐ existe pero le falta algo · ✗ no existe.

## Página de inicio (`/`)

Revisada el 2026-10-13: captura del admin + recorrido de wala.pe en escritorio
(1366) y celular (390) + `pages/home` de Firestore (10 secciones).

### Marco (fuera del builder, igual en todas las páginas)

| # | Apartado | Hoy en la tienda | Visible para | Kit | Falta |
|---|---|---|---|---|---|
| M1 | Aviso del sistema (franja arriba) | `components/common/SystemAlert` · Firestore `configuracion/estado_app` | todos, si está activo | ◐ `Aviso` | Variante de franja para el marco |
| M2 | Banner "Descarga la app" | `pages/Tienda/components/AppDownloadBanner.jsx` | celular web (no en la app) | ✗ | Pieza `BannerApp` |
| M3 | Barra de admin ("Modo Administrador", Panel, Activar Editor Visual) | `components/common/AdminBar` | admins | ✗ | Pieza `BarraAdmin` |
| M4 | Cabecera escritorio: logo, Tienda ▾, Crear, Marcas ▾, Minijuegos, monedas, tema, buscar, campana, avatar, favoritos, carrito | `components/common/Header/Header.jsx` (+ `HeaderSearch`, `NotificationTray`, `ThemeToggle`) · enlaces en `storeConfig/homePage.header.navLinks` | todos (monedas y campana con sesión) | ◐ `Cabecera` + `MenuTienda`, `AyudaMonedas`, `MenuCuenta`, `VistaFavoritos`, `VistaCarrito` | Botón de tema, menú **Marcas**, enlaces con submenú desde la config, buscador como panel (no caja fija) |
| M5 | Cabecera celular: logo + monedas + campana + favoritos + carrito, y debajo la barra "Buscar productos, marcas y categorías" | mismo `Header.jsx` (2 filas) | todos | ◐ `Cabecera` | Segunda fila con buscador, monedas y campana en el celular |
| M6 | Menú de la cuenta (con o sin sesión, idioma, promo "Gana 15 monedas") | `Header.jsx` · `storeConfig/homePage.accountPopup` | todos | ◐ `MenuCuenta` | Selector de idioma |
| M7 | Barra inferior: Inicio, Tienda, Crear, Juegos, Mi cuenta (+ Admin) | `components/common/BottomNav` | celular | ◐ `BarraInferior` | Que navegue por rutas (hoy guarda el activo por dentro), avatar en "Mi cuenta", pestaña Admin |
| M8 | Pie: columnas del builder + contacto, Términos, Políticas, Libro de Reclamaciones, © | `components/common/Footer` · Firestore `pages/footer` + `config/empresa.js` | todos (no en la app) | ◐ `PiePagina` (`footer_columns`) | Pieza `PieLegal` (contacto + enlaces legales + Libro de Reclamaciones) |
| M9 | Botón de WhatsApp flotante | `components/common/WhatsAppButton` · Firestore `messages` | todos (no en admin, checkout ni landings) | ✗ | Pieza `BotonWhatsApp` |
| M10 | Kapi mascota (burbuja con "!", abre su ventana) | `components/common/KapiPet` | con sesión | ✗ | Pieza `KapiFlotante` (la ventana sigue en la tienda) |
| M11 | Burbuja de regalos sugeridos | `components/common/PackageBubble` | con sesión, si hay paquetes nuevos | ✗ | Pieza `BurbujaRegalos` |
| M12 | Píldora "Gana 15 monedas · Completa tu perfil de regalos" | `Header.jsx` 1333-1359 | con sesión, sin encuesta | ✗ | Pieza `PildoraRecompensa` |
| M13 | Pila de flotantes (orden, sobre la barra inferior) | `.floating-action-stack` en `App.jsx` + `App.css` | — | ✗ | Pieza `PilaFlotante` |
| M14 | Popup de campaña (imagen o tarjeta) | `components/common/CampaignPopup` · `storeConfig/popups` | según reglas | ✗ | Pieza `VentanaCampana` (las reglas siguen en la tienda) |
| M15 | Sugerencia de idioma | `components/i18n/LanguagePopup.jsx` | navegador no español | ✗ | Pieza `AvisoIdioma` |
| M16 | Toasts | `contexts/ToastContext.jsx` | — | ✓ `ProveedorToasts` (ya conectado) | — |
| M17 | Carga de la marca / barra de progreso al navegar | `BrandLoaderOverlay`, `NavProgressBar` | — | — | Fuera de alcance (no son contenido) |

### Contenido (secciones del builder, en este orden)

| # | Apartado | `type` | Hoy en la tienda | Kit | Falta |
|---|---|---|---|---|---|
| S1 | Barra de anuncios ("Personaliza un regalo único →", "Compra segura…") | `announcement_bar` | `AnnouncementBar.jsx` | ✓ `BarraAnuncios` | — |
| S2 | Carrusel principal (3 banners, flechas, puntos) | `hero_carousel` | `HeroCarousel` | ✓ `HeroCarrusel` | — |
| S3 | "Explora nuestros mundos": marcas numeradas 01-07 con "Universo Walá" y "Explorar colección" | `banner_grid` (`dataSource: 'brands'`) | `BannerGrid` | ✓ `MosaicoBanners` + `TarjetaMarca` | — |
| S4 | "¿Qué estás buscando?": 6 categorías redondas con cuántos productos | `category_grid` (`cardStyle: 'round'`) | `CategoryGrid` | ✓ `GrillaCategorias` + `TarjetaCategoria` | — |
| S5 | "Lo más buscado en Walá" | `featured_carousel` | `FeaturedCarousel` + `PremiumProductCard` | ◐ `CarruselProductos` + `TarjetaProducto` | Ver tarjeta (abajo) |
| S6 | "Recién llegaron" | `new_arrivals_carousel` | `ProductQueryCarousel` (más nuevos) | ◐ igual | Ver tarjeta |
| S7 | "Ofertas para ti" | `sale_carousel` | `ProductQueryCarousel` (con `salePrice`) | ◐ igual | Ver tarjeta |
| S8 | Íconos de confianza (Pago seguro, Envíos, Personalizados, WhatsApp) | `trust_badges` | `TrustBadges` | ✓ `InsigniasConfianza` + `Beneficio` | — |
| S9 | "Lo que dicen nuestros clientes" | `testimonials` | `Testimonials` | ✓ `Testimonios` + `TarjetaTestimonio` | — |
| S10 | "Preguntas frecuentes" | `faq_accordion` | `FaqAccordion` | ✓ `PreguntasFrecuentes` + `Acordeon` | — |

### La tarjeta de producto de los carruseles

`PremiumProductCard` muestra cosas que la `TarjetaProducto` del kit no tenía:

| Detalle real | En el kit |
|---|---|
| Logo de la marca en la foto (solo en listados de varias marcas) | ✓ `marca` → sello girado |
| "5 DISPONIBLES" en todos los productos | ✓ `stock` → "¡Quedan N!" solo si son pocas (≤ 10): un aviso de urgencia que siempre aparece deja de decir nada |
| "NUEVO" (creado hace menos de 30 días) | ✓ `nuevo` (el adaptador lo calcula con `createdAt`) |
| "OFERTA" | ✓ etiqueta colgante con el % |
| Combo: al pasar el ratón, qué piezas trae | ✓ `piezas` → etiqueta "Combo · N" y "Incluye" al pasar el ratón |
| Categoría del producto | ✓ `categoria` (el adaptador la busca por id) |
| Puntuación inventada a partir del id (`ProductCard.jsx:169`) | No se copia: el kit solo la muestra si se la pasan |

### Qué se construyó (2026-10-13)

Todo está hecho y se ve en `/componentes.html` → Páginas → "Inicio de
wala.pe" (con "Ver como" visitante / con sesión / admin y los extras). La
tienda real no cambió.

1. **Piezas nuevas** (`piezas/`): `BotonWhatsApp`, `KapiFlotante`, `BurbujaRegalos`,
   `PildoraRecompensa`, `PilaFlotante`, `BarraAdmin`, `BannerApp`, `PieLegal`,
   `VentanaCampana`, `AvisoIdioma`, `BotonTema` (`piezas/Flotantes.jsx` y
   `piezas/Marco.jsx`), y `MenuMarcas`.
2. **Piezas que se completan**: `TarjetaProducto` (arriba), `Cabecera` (tema,
   Marcas, buscador en panel, segunda fila en el celular), `BarraInferior`
   (rutas, avatar, Admin). Pendiente: selector de idioma en `MenuCuenta`.
3. **Secciones**: las 10 del inicio ya existen; los carruseles reciben el
   catálogo (marcas y categorías) para armar la tarjeta completa. No hace
   falta ningún tipo nuevo en el builder para esta página.
4. **Página**: `PaginaTienda` = `MarcoTienda` (avisos, cabecera, pie y pie
   legal, barra inferior y flotantes) + las secciones de `pages/home`, con
   los productos repartidos por tipo de sección. La demo usa una copia de
   los datos reales (`demo/inicio.json`: pages/home, pages/footer y una
   muestra de productos y categorías).
