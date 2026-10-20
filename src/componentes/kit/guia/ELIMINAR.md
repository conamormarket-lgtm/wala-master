# Lo viejo que se borra al final de la migración

## Estudio de Crear (migrado, 2026-10-19)

`pages/Crear/CrearStudioViejo.jsx` conserva el estudio anterior completo.
Solo lo carga `CrearStudioPage` con `crearViejo`. Conservarlo hasta validar
en producción y retirar el interruptor. La versión nueva usa su propio
`EstudioDeTienda.module.css` y los controles del kit.

| Qué se conserva | Quién lo necesita | Cuándo revisar su borrado |
|---|---|---|
| `pages/Crear/CrearStudioViejo.jsx` | `CrearStudioPage` con `crearViejo` | al retirar el interruptor |
| `CrearStudioPage.module.css` | el estudio anterior y `ComboCrearViejo` | al retirar ambos respaldos |
| `RecorteImagen`, `QuitarFondo`, `SelectorFuente`, `TamanoLetra`, `AtajosTeclado` y sus CSS | el estudio anterior; comprobar otros imports al retirar | junto al respaldo, solo si ya no tienen consumidores |
| `CapaModal` | las hojas anteriores y `ComboCrearViejo` | junto a sus últimos consumidores |

`fondoPixeles.js`, `renderDiseno.js`, las fuentes y las utilidades del
lienzo siguen en uso en la versión nueva: **no son residuos de la migración**.

Durante la migración ([MIGRACION.md](MIGRACION.md)) no se borra nada: cada
pieza nueva entra en su propio commit y lo viejo queda en su sitio, así que
revertir el commit devuelve la tienda como estaba. Esta lista junta lo que
queda sin uso para borrarlo todo junto cuando la tienda lleve un tiempo con
lo nuevo.

**Cómo se lee "Quién más lo importa":** se busca el nombre del archivo o del
componente en `src/` (sin contar la propia carpeta). Una fila pasa a
**listo para borrar** solo cuando ya nadie lo importa; lo compartido espera a
que migre la última página que lo usa.

**Antes de borrar una fila:** volver a buscar quién lo importa (puede haber
cambiado) y borrar también su CSS.

## Paso 2: marco

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `components/common/SystemAlert/SystemAlert.jsx` + `SystemAlert.css` (franja de aviso del sistema) | `App.jsx` (todas las páginas) | `components/marco/AvisoDelSistema.jsx` → `AvisoSistema` del kit + `avisoDesdeEstadoApp` | nadie | **listo para borrar** |
| `components/common/AdminBar/AdminBar.jsx` + `AdminBar.module.css` (barra de admin) | `App.jsx` (todas las páginas) | `components/marco/BarraDeAdmin.jsx` → `BarraAdmin` del kit (`fija`, `editarEn`) | nadie (solo comentarios en `BrandLoaderOverlay.jsx`, `KapiPet.jsx` y `AuthContext.jsx`: actualizarlos al borrar) | **listo para borrar** |
| `pages/Tienda/components/AppDownloadBanner.jsx` + `AppDownloadBanner.module.css` (banner "Wala App") | `TiendaPage.jsx` (inicio, `/tienda` y marcas, en el celular) | `components/marco/BannerDeLaApp.jsx` → `BannerApp` del kit (`onAccion`) | nadie (solo un comentario en `AvisoInvitacion.jsx`) | **listo para borrar** |
| `components/i18n/LanguagePopup.jsx` + `LanguagePopup.module.css` (sugerencia de idioma) | `App.jsx` (todas las páginas) | `components/marco/AvisoDeIdioma.jsx` → `AvisoIdioma` del kit (`flotante`) | nadie (solo un comentario en `CampaignPopup.jsx`) | **listo para borrar** |
| `components/i18n/FlagIcon.jsx` (banderas SVG) | `LanguagePopup`, `Header.jsx` (selector de idioma), `CuentaAjustesPage.jsx` | el kit usa un sello con el código (`EN`, `PT`) | `Header.jsx`, `CuentaAjustesPage.jsx` | cuando migren la cabecera (paso 7) y Ajustes de la cuenta (paso 6) |
| `components/common/WhatsAppButton/` (`WhatsAppButton.jsx`, `WhatsAppButton.module.css`, `index.js`) | `App.jsx` (`.floating-action-stack`) | `components/marco/useWhatsAppDeLaRuta.js` (mismas reglas) → `BotonWhatsApp` del kit dentro de `FlotantesDeLaTienda.jsx` | nadie (solo comentarios en `AdminWhatsApp.jsx` y `services/products.js`) | **listo para borrar** |
| `App.css`: `.floating-action-stack` y `.App:has(.product-detail-page) .floating-action-stack` (~94-118) | `App.jsx` | `PilaFlotante` del kit (`ocultarEnCelular` en `/producto/`, `/combo/`, `/creacion/`) | nadie | **listo para borrar** |
| `App.css`: variables `--flotante-lado`, `--flotante-abajo`, `--flotante-tam`, `--flotante-gap` (~74-92) | la pila vieja, la píldora de la encuesta (`Header.module.css` ~2143) y `KapiPet.module.css` (`--flotante-tam`) | `PilaFlotante` del kit (sus propias medidas) | `Header.module.css`, `KapiPet.module.css` | cuando no quede la píldora vieja en `Header.module.css` ni `KapiPet` |
| `.product-detail-page` (clase global en `ProductDetail.jsx`, `CreacionViejo.jsx`, `ComboCrearViejo.jsx`) | solo la usaba la regla de `App.css` de arriba | la ruta, en `FlotantesDeLaTienda.jsx` | — | al borrar esa regla, quitar la clase de las tres páginas (o al migrarlas) |
| `Header.jsx`: la píldora "Gana 15 monedas" (bloque `floatingSurvey` al final, estado `surveyFabOculto`, `ocultarFabEncuesta`, `RUTAS_SIN_FAB_ENCUESTA`, `CLAVE_FAB_ENCUESTA` y el interruptor `PILDORA_EN_EL_KIT`) + `Header.module.css` `.floatingSurvey…` (~2141, 21 reglas) | todas las páginas con sesión | `PildoraRecompensa` del kit en `FlotantesDeLaTienda.jsx` (misma clave `surveyFabHiddenUntil`, mismas rutas) | — (está apagada con `PILDORA_EN_EL_KIT = true`; en `false` vuelve la vieja) | con la cabecera vieja (paso 7) |
| `components/common/KapiPet/KapiPet.jsx` + `KapiPet.module.css` (botón y ventana de Kapi) | `App.jsx` (`.floating-action-stack`) | `components/marco/Kapi.jsx` → `KapiFlotante` + `VentanaKapi` del kit (`kapiDesdePerfil`, `retoDesdePerfil`) | nadie (solo comentarios en `RuletaPage.jsx`, `adaptadores.js` y `AdminBar.jsx`) | **listo para borrar** |
| Caras viejas de Kapi `public/assets/kapi/kapi-happy.webp`, `kapi-hungry.webp`, `kapi-sad.webp` | `KapiPet` (botón y ventana) | las 3D del kit (`CARAS_KAPI`, `public/assets/kapi/3d/`) | `hooks/useMascotaImageUrl.js`, `pages/admin/AdminRuletaPage.jsx`, `EstadoVacio` del kit (valor por defecto, Ver diseño) y la demo (`ComponentesPage.jsx`, `DemoSecciones.jsx`) | **no borrar** mientras las usen; revisar al final |
| `components/common/CampaignPopup/CampaignPopup.jsx` (controlador de los popups de campaña) | `App.jsx` | `components/marco/AnuncioDeCampana.jsx` (mismas reglas y métricas) → `VentanaCampana` del kit + `campanaDesdePopup` | nadie | **listo para borrar** |
| `components/common/CampaignPopup/PopupCard.jsx` + `CampaignPopup.module.css` (la tarjeta del popup) | `CampaignPopup.jsx` y la vista previa de `/admin/popups` | `VentanaCampana` del kit + `campanaDesdePopup` (también en la vista previa de `/admin/popups`: el admin queda fuera del kit, pero la vista previa muestra la tienda) | solo `CampaignPopup.jsx` (de arriba, que ya nadie importa) | **listo para borrar** (junto con `CampaignPopup.jsx`; se va la carpeta `CampaignPopup/` entera) |
| `Footer.jsx`: el bloque legal de antes (contacto, enlaces legales con estilos en línea, "📕 Libro de Reclamaciones", copyright), apagado con `PIE_LEGAL_EN_EL_KIT` + `Footer.module.css` `.copyright` | el pie de todas las páginas (no en la app) | `PieLegal` del kit + `pieLegalDesdeEmpresa`, dentro del mismo `Footer.jsx` | — (en `false` vuelve el de antes) | cuando el pie entero pase a `PiePagina` (paso 5); ahí se borra también `Footer.jsx` |

## Paso 3: avisos y hojas

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `components/common/Modal/Modal.jsx` + `Modal.module.css` (el modal común: sin Esc ni botón atrás) | `/registro` (¿Tus datos son correctos?) y las 5 ventanas de `PedidoAcciones` (`/cuenta/pedidos/:id`) | `Confirmar` y `HojaInferior` del kit | `PedidoAcciones.jsx` (solo con el interruptor `pagosViejo`), un comentario en `profile/AvatarCropModal.jsx`, y fuera de la tienda `EditorPage.jsx` y `pages/admin/AdminCrearCuentasPedidos.jsx` | de la tienda, cuando se retire `pagosViejo` y migre Mi perfil (paso 6); el archivo, solo si el editor viejo y el admin dejan de usarlo |
| `RegisterPage.module.css`: `.modalText`, `.modalActions` | la confirmación del registro | `Confirmar` | — | **listo para borrar** |
| `window.confirm` / `alert` de la tienda (carrito, direcciones, fechas importantes, foto de perfil, Mi combo, encuesta, palabra del día) | esas páginas | `useConfirmar` (Confirmar del kit) y toasts | `Cart.jsx` usa `window.confirm` solo con el interruptor `carritoViejo` | al retirar `carritoViejo` |
| `pages/Crear/CapaModal.jsx` (fondo de las ventanas de Crear) | eliminar creación, comunidad y "llevar en combo" (ya con el kit) | `Confirmar` / `HojaInferior` | `CrearStudioViejo.jsx`, `ComboCrearViejo.jsx`, `AtajosTeclado.jsx`, `RecorteImagen.jsx`, `QuitarFondo.jsx` | al retirar `crearViejo` y sus últimos consumidores (CREAR.md) |
| `EliminarCreacion.module.css`: `.capa`, `.caja`, `.icono`, `.titulo`, `.eliminar`, `.cancelar` (la caja de la confirmación) | `useEliminarCreacion` y `AccionesComunidad` | `Confirmar` | el archivo lo siguen importando `TarjetaMiCombo.jsx`, `TusBorradores.jsx` y `MiCreacionCard.jsx` (revisar qué clases usan) | al borrar, solo las clases que nadie use |
| `LlevarEnCombo.module.css`: `.capa`, `.caja`, `.cabecera`, `.titulo`, `.cerrar` | "Llevar en combo" | `HojaInferior` (la lista y la ayuda siguen con sus clases) | — | **listo para borrar** (esas clases) |
| `Comunidad.module.css`: `.iconoComunidad`, `.confirmar`, `.girando` | la confirmación de la comunidad | `Confirmar` | — (revisar que ninguna otra regla las use) | **listo para borrar** |
| `CulqiCustomCheckout`: la pantalla "Confirmando tu pago…" (`.overlay`, `.overlayCard`, `.overlaySpinner`, `.overlayTitle`, `.overlayText`) | checkout, pago rápido y "Pagar saldo" | `CapaCargando` del kit (`pantallaCompleta`, en un portal) | el mismo archivo, solo con el interruptor `pagosViejo` | al retirar `pagosViejo` |

## Paso 4: tarjeta de producto

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/Tienda/components/PremiumProductCard/` (`PremiumProductCard.jsx` + `.module.css`) | `ProductGrid`, `FeaturedCarousel`, `CollectionCarousel`, `FlashSales` (inicio, `/tienda`, `/buscar`, marcas, relacionados de la ficha y del pedido) | `components/producto/TarjetaDeProducto.jsx` → `TarjetaProducto` del kit | `TarjetaDeProducto.jsx` (solo con el interruptor `tarjetasViejo`), `pages/cuenta/WishlistPage.jsx`, `pages/WishlistPublic/WishlistPublic.jsx`; comentarios en `ThumbnailCropEditor.jsx`, `useAlternarFotos.js`, `GiftRegistryPage.jsx`, `TiendaPage.jsx` | cuando migren las listas de deseos (paso 6, CUENTA.md y REGALAR.md) y se retire `tarjetasViejo` |
| `pages/Tienda/components/ProductCard/` (`ProductCard.jsx` + `.module.css`; con reseñas inventadas) | nadie (ya estaba sin uso) | — | nadie | **listo para borrar** |
| `components/common/ProductCardSkeleton/` | `FeaturedCarousel`, `CollectionCarousel`, `FlashSales` mientras cargan | `EsqueletoProducto` del kit | esos tres | con la carga (paso 7, CARGA.md) |

## Paso 5: secciones del builder (todas las páginas)

Desde el 2026-10-17 todos los tipos del builder van con el kit en todas las
páginas. Con el interruptor `seccionesViejo` siguen los componentes viejos,
que carga `pages/Tienda/services/seccionesPorTipo.jsx`: se borran al
retirarlo. (El cacherito, la landing del reloj K-CHERO que seguía con lo de
antes, se retiró el 2026-10-19 y se borró entera: `ConversionFold`,
`LandingPaymentBlock`, `landing-mobile.css` y `landingSlugs.js`.)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/Tienda/components/AnnouncementBar/` | `announcement_bar` | `BarraAnuncios` (`SeccionDelKit`) | `seccionesPorTipo.jsx` (`seccionesViejo`) | al retirar `seccionesViejo` |
| `pages/Tienda/components/HeroCarousel/` | `hero_carousel` | `HeroCarrusel` | ídem | ídem |
| `pages/Tienda/components/TrustBadges/` | `trust_badges` | `InsigniasConfianza` | ídem | ídem |
| `pages/Tienda/components/Testimonials/` | `testimonials` | `Testimonios` | ídem y `VisualEditorPanel.jsx` (editor viejo, paso 8) | ídem y con el editor del kit |
| `pages/Tienda/components/FaqAccordion/` | `faq_accordion` | `PreguntasFrecuentes` (sin Kapi con sesión) | ídem | ídem |
| `pages/Tienda/components/ProductQueryCarousel/` | `new_arrivals_carousel`, `sale_carousel`, `category_carousel` | `CarruselProductos` con las mismas consultas (`query-carousel`) hechas en `TiendaPage` (las de categoría con `useQueries`) | `seccionesPorTipo.jsx` (`seccionesViejo`) | al retirar `seccionesViejo` |
| `pages/Tienda/components/FeaturedCarousel/` (en secciones) | `featured_carousel` del inicio | `CarruselProductos` | `ProductQueryCarousel`, `ProductDetail.jsx` (relacionados, solo con `fichaVieja`: la ficha nueva usa `Carrusel` + `TarjetaDeProducto`), `CuentaCompraDetallePage.jsx`, `seccionesPorTipo.jsx` | al retirar `fichaVieja`, cuando migren el detalle del pedido y las demás páginas |
| `pages/Tienda/components/BannerGrid/` | `banner_grid` del inicio | `MosaicoBanners` (con `marcas` de la consulta `['brands']`) | `seccionesPorTipo.jsx` (`seccionesViejo`) | al retirar `seccionesViejo` |
| `pages/Tienda/components/CategoryGrid/` | `category_grid` del inicio | `GrillaCategorias` + `categoriasDeGrilla` (misma cuenta, foto y orden) | `seccionesPorTipo.jsx` (`/tienda` y marcas: `migrateHomeCategoryGrid`) | ídem |
| `pages/Tienda/components/HeaderBlock/` | `header` (`/tienda`, marcas) | `Encabezado` ("Nuestra Tienda" si no hay título) | `seccionesPorTipo.jsx`, `services/storefront.js` (solo el nombre del tipo) | al retirar `seccionesViejo` |
| `pages/Tienda/components/BrandMarquee/` (con su `.module.css`) | `marquee` | `MarcasMarquesina` | `seccionesPorTipo.jsx`; `services/brands.js` solo lo nombra en un comentario | ídem |
| `pages/Tienda/components/HeroBanner.jsx` y `HeroBanner.module.css` | `hero_banner` (marcas) | `BannerPrincipal` (`onClicBoton` → `trackBannerClick`) | `seccionesPorTipo.jsx`. `HeroBannerMediaUploader` de `VisualEditorPanel.jsx` es otra cosa (el editor viejo) | ídem |
| `pages/Tienda/components/VisualCategoryNav/` | `categories_nav` (marcas) | `NavCategorias` (`estilo` de la marca, `cargando`) | `seccionesPorTipo.jsx`; `SidebarCatalogLayout.jsx` solo lo nombra en un comentario | ídem |
| `pages/Tienda/components/SidebarCatalogLayout.jsx` y `.module.css` | `sidebar_catalog` (`/tienda`, marcas) | `CatalogoConFiltros` con el estado en `TiendaPage` (`filtrosKit`, `categoriaKit`, consultas `collections`/`tags`/`characters`/`productTypes`/`brands`/`storefront-category-grid-products`) | `pages/SearchPageViejo.jsx` (la búsqueda de antes, solo con `busquedaVieja`), `seccionesPorTipo.jsx`; los textos `cat.*` de `i18n/dictionaries.js` | al retirar `busquedaVieja` y `seccionesViejo`; con él, las claves `cat.*` que nadie más use |
| `pages/Tienda/components/ProductGrid/` | `product_grid` y el catálogo (`/tienda`, marcas) | `GrillaProductos` | `SidebarCatalogLayout.jsx` (la búsqueda de antes), `featured_products` (aún viejo, en `TiendaPage`), `seccionesPorTipo.jsx` | cuando pasen la búsqueda y `featured_products` |
| `TiendaPage.jsx`: `catalogSectionRef` y las ramas viejas de `renderSection` (`case 'header'`, `'marquee'`, `'sidebar_catalog'`, `'product_grid'`, `'hero_banner'`, `'categories_nav'`…) | lo de antes | `seccionDelKit` | el interruptor `seccionesViejo` | junto con sus componentes |
| `pages/Tienda/components/TextBlock/` | `text` | `BloqueTexto` | `seccionesPorTipo.jsx` (`seccionesViejo`) | al retirar `seccionesViejo` |
| `pages/Tienda/components/ImageBlock/` | `image` | `BloqueImagen` | ídem | ídem |
| `TiendaPage.jsx`: `case 'video'` (el video armado a mano) | `video` | `BloqueVideo` | `seccionesViejo` | al retirar `seccionesViejo` |
| `pages/Tienda/components/BestSellersRow/` | `bestsellers_row` | `FilaDestacados` | `seccionesPorTipo.jsx` (`seccionesViejo`) | al retirar `seccionesViejo` |
| `pages/Tienda/components/FeatureList/` | `feature_list` | `ListaBeneficios` | ídem | ídem |
| `pages/Tienda/components/MapLocation/` | `map_location` | `Ubicacion` | ídem | ídem |
| `pages/Tienda/components/CollectionCarousel/` | `collection_carousel` | `CarruselProductos` con las consultas `collection-products` / `collection-details` en `TiendaPage` | ídem | ídem |
| `pages/Tienda/components/FlashSales/` | `flash_sales` | `OfertaRelampago` con la consulta `flash-sales` en `TiendaPage` | ídem | ídem |
| `TiendaPage.jsx`: `case 'featured_products'` | `featured_products` | `GrillaProductos` | — | al retirar `seccionesViejo`; con él, `ProductGrid` queda solo para la búsqueda |

## Paso 6: páginas propias

### La ficha de producto (2026-10-17)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/Tienda/components/ProductDetail/` (`ProductDetail.jsx`, `ProductDetail.module.css` de 1111 líneas, `index.js`) | `/producto/:id` | `components/producto/FichaDeProducto.jsx` → `PaginaProducto` del kit | `pages/ProductPage.jsx` (lazy, solo con el interruptor `fichaVieja`); comentarios en `adaptadores.js`, `WhatsAppButton.jsx`, `CartContext.jsx`, `i18n/dictionaries.js`, `WishlistPage.jsx`, `GiftRegistryPage.jsx`, `AdminComboEditor.jsx` | al retirar `fichaVieja` |
| `pages/Tienda/components/ProductReviews/` (`ProductReviews.jsx`, `ProductReviews.module.css` de 598 líneas, `index.js`) | `ProductDetail` | `ResumenOpiniones`, `TarjetaOpinion`, `FormularioOpinion` del kit (`opinionesDesde`) | solo `ProductDetail.jsx` | junto con `ProductDetail` |
| `ProductPage.jsx`: la rama vieja (el `div` "Error al cargar el producto", la tarjeta "ya no está disponible" con estilos en línea y el `Suspense` de `ProductDetail`) | `/producto/:id` | los estados de `PaginaProducto` | — | al retirar `fichaVieja` (las redirecciones a `/crear` y `/combo` se quedan) |
| `TarjetaDeProducto.jsx`: `if (fichaVieja) navigate('/producto/…')` en `alAgregar` | "Elegir…" de las tarjetas | `components/producto/AgregarRapidoDeProducto.jsx` → `AgregarRapido` del kit | — | al retirar `fichaVieja` |
| `components/common/DraggableContainer/` | los colores y tallas de `ProductDetail` | `OpcionesProducto` del kit | `components/editor/ComboUserEditor/ComboUserEditor.jsx`, `pages/EditorPage.jsx` (editor viejo), `hooks/useDragScroll.js` | **no borrar** mientras lo use el editor viejo |
| `useImagePreloader` (en `OptimizedImage.jsx`) | `ProductDetail` (precargaba todas las URLs del producto) | la precarga de `FichaDeProducto` (la primera foto de cada color, hasta 8, en tiempo libre) | `pages/EditorPage.jsx`, `ComboProductImage.jsx` | cuando nadie lo use |
| Textos de `i18n/dictionaries.js` que solo usaba la ficha: `card.descripcion`, `card.envioPais`, `card.cambiosDevoluciones`, `card.pagoSeguro`, `card.comprarCarrito`, `card.compartirGanar`, `card.noEncontrado`, `card.inicio`, `card.cantidad` (y `card.personalizable`, que también usa `PremiumProductCard`) | `ProductDetail` | los textos del kit con `<Texto>` | `card.personalizable`: `PremiumProductCard` | con `ProductDetail` (volver a buscar cada clave antes) |

Siguen en uso y **no** se borran: `HistorialPersonalizacionesModal` y
`YoryoPersonalizadoCliente` (Yoryo queda fuera del kit; los carga
`FichaDeProducto`) y `FeaturedCarousel` (ver el paso 5: ya no lo usa la
ficha nueva, solo `ProductDetail` con `fichaVieja`).

### El carrito (2026-10-17)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/Tienda/components/Cart/` (`Cart.jsx`, `Cart.module.css` de 347 líneas, `index.js`) | `/carrito` | `components/carrito/CarritoDeTienda.jsx` → `PaginaCarrito` del kit | `pages/CartPage.jsx` (lazy, solo con `carritoViejo`) | al retirar `carritoViejo` |
| `pages/Tienda/components/CartItem/` (`CartItem.jsx`, `CartItem.module.css` de 463 líneas) | `Cart.jsx` | `ItemCarrito` + `itemCarritoDesde` | solo `Cart.jsx` | junto con `Cart/` |
| `CartPage.jsx`: la rama vieja (título "Carrito de Compras", "Continuar comprando", `AuroraBackground`) + `CartPage.module.css` | `/carrito` | `PaginaCarrito` (título, "Seguir comprando") | — | al retirar `carritoViejo` |
| `pages/Tienda/components/ComboProductImage/` (en el carrito) | `CartItem.jsx` (pedía las prendas y precargaba sus fotos por línea) | la portada o la foto de la primera prenda (`itemCarritoDesde`) | `ProductTable.jsx` y `AdminProductos.jsx` (admin), `MiCreacionCard.jsx` (cuenta) | **no borrar**: lo usan el admin y la cuenta |

### El pago rápido (2026-10-17)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/PagoRapidoViejo.jsx` (la página de antes, con estilos en línea; copia de lo que era `PagoRapidoPage.jsx`) | `/pago-rapido/:id` | `components/pago/PagoRapidoDeTienda.jsx` → `PaginaPagoRapido` del kit | `pages/PagoRapidoPage.jsx` (lazy, solo con `pagosViejo`) | al retirar `pagosViejo` |
| `PaypalEnlaceCheckout.jsx`: las cajas de error y "Procesando pago..." con estilos en línea (todo menos `botones`) | el pago rápido viejo | `PagoPaypal` del kit (`soloBotones`) | solo `PagoRapidoViejo.jsx` | al retirar `pagosViejo`; queda `soloBotones` como única forma |
| `CulqiCustomCheckout`: el botón y la nota propios (`.payButton`, `.secureNote`, `.spinner` del CSS) | checkout y "Pagar saldo" | `PagoTarjeta` del kit por `renderBoton` | `CheckoutPage.jsx`, `PedidoAcciones.jsx` | cuando todos pasen `renderBoton` |

### El checkout (2026-10-17)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/CheckoutViejo.jsx` (la página de antes, ya sin el armado del pedido) + `pages/CheckoutPage.module.css` (1762 líneas) | `/checkout` | `components/checkout/CheckoutDeTienda.jsx` → `PaginaCheckout` del kit | `pages/CheckoutPage.jsx` (lazy, solo con `pagosViejo`) | al retirar `pagosViejo` |
| `formik` y `yup` (dependencias) | solo el checkout viejo | la validación del kit (`validarDireccion`) | nadie más | con `CheckoutViejo.jsx` (quitarlas de `package.json`) |
| `components/intl/CountrySelect`, `components/intl/PhoneIntlInput` | el checkout viejo y Mi perfil de antes | `Campo` con `paises` y `CampoTelefono` | `RegisterPage.jsx`, `CompleteProfilePage.jsx`, `PerfilViejo.jsx` | cuando migre el acceso |
| `PaypalCheckout.jsx`: las cajas propias (título, monto, error, "Procesando pago...") | el checkout viejo | `PagoPaypal` (`soloBotones`) | "Pagar saldo" (`PedidoAcciones`), `SorteosPage.jsx` | cuando migren "Pagar saldo" y los sorteos |

`services/pedidoCheckout.js` **no se borra**: es el armado del pedido de la
página nueva.

### La lista pública (2026-10-17)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/WishlistPublic/WishlistPublicViejo.jsx` (la página de antes, copia de lo que era `WishlistPublic.jsx`) + `WishlistPublic.module.css` (211 líneas) | `/wishlist/:userCode` | `components/regalar/ListaPublicaDeTienda.jsx` → `PaginaListaPublica` del kit | `WishlistPublic.jsx` (lazy, solo con `regalarViejo`) | al retirar `regalarViejo` |
| `useProducts([], { includeHidden: true })` en esta página (el catálogo entero) | la lista pública vieja | `getProduct` de cada producto (`useProductosDeLista`) | `GiftRegistryPage`, Mis pedidos y la lista propia | **no borrar** `includeHidden`: lo usan otras páginas |
| `PremiumProductCard` en esta página | la lista pública vieja | `TarjetaRegalo` (`TarjetaProducto` del kit) | `TarjetaDeProducto.jsx` (`tarjetasViejo`) y `cuenta/WishlistPage.jsx` | **no borrar**: la usan otros |

### Regalar para una fecha (2026-10-17)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/GiftRegistry/GiftRegistryPageViejo.jsx` (la página de antes: `useGiftDrag`, `DragGhost`, `GiftProductCard`, `getGlobalDates` copiado) + `GiftRegistryPage.module.css` (908 líneas) | `/regalar/:referralCode` | `components/regalar/RegalarDeTienda.jsx` → `PaginaRegalar` del kit (`fechaEntregaDesde`, `festivasDePersona`) | `GiftRegistryPage.jsx` (lazy, solo con `regalarViejo`) | al retirar `regalarViejo` |
| `AuroraBackground`, `GlassCard`, `GlassButton` en esta página | la página vieja | `BloqueSeccion`, `PasoEstudio`, `Boton` | el admin y otras páginas | **no borrar**: los usan otros |

### Abrir el regalo (2026-10-17)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/GiftExperienceViejo.jsx` (la página de antes, con el Kapi en CSS y los emojis) + `GiftExperiencePage.module.css` (274 líneas) | `/regalo/:orderId` | `components/regalar/RegaloSorpresaDeTienda.jsx` → `PaginaRegaloSorpresa` del kit | `GiftExperiencePage.jsx` (lazy, solo con `regalarViejo`) | al retirar `regalarViejo` |

### La cuenta: el marco, el resumen y los ajustes (2026-10-17)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/CuentaLayoutViejo.jsx` (el marco de antes: menú lateral, aviso de perfil) + `pages/CuentaPage.module.css` (475 líneas) | `/cuenta/*` | `components/cuenta/MarcoDeCuenta.jsx` → `MarcoCuenta` del kit | `CuentaLayout.jsx` (lazy, solo con `cuentaVieja`); `CuentaFechasImportantesPage.jsx` solo lo nombra en un comentario | al retirar `cuentaVieja` |
| `pages/cuenta/CuentaResumenViejo.jsx` + `CuentaResumenPage.module.css` (135 líneas) | `/cuenta` | `ResumenDeCuenta.jsx` → `PaginaResumenCuenta` | `CuentaResumenPage.jsx` (lazy, solo con `cuentaVieja`) | al retirar `cuentaVieja` |
| `pages/cuenta/CuentaAjustesViejo.jsx` + `CuentaAjustesPage.module.css` (172 líneas) | `/cuenta/ajustes` | `AjustesDeCuenta.jsx` → `PaginaAjustes` | `CuentaAjustesPage.jsx` (lazy, solo con `cuentaVieja`) | al retirar `cuentaVieja` |
| `ThemeToggle`, `FlagIcon` en Ajustes | Ajustes de antes | `Interruptor` y el código del idioma | `Header.jsx` (y `LanguagePopup.jsx`) | **no borrar**: la cabecera los usa (paso 7) |

`pages/cuenta/useCuentaNavGroups.js` **no se borra**: es la fuente de los
grupos del marco nuevo (`gruposDeCuenta.js`).

### Mi perfil y Mis direcciones (2026-10-17)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/cuenta/PerfilViejo.jsx` + `PerfilPage.module.css` (445 líneas) | `/cuenta/perfil` | `components/cuenta/PerfilDeCuenta.jsx` → `PaginaPerfil` | `PerfilPage.jsx` (lazy, solo con `cuentaVieja`); `CuentaRastreoPage.jsx` solo lo nombra en un comentario | al retirar `cuentaVieja` |
| `components/profile/AvatarStudio.jsx` + `AvatarCropModal.jsx` (y sus CSS, 157 y 111 líneas) | Mi perfil de antes | `IdentidadCuenta` + `RecortarFoto` | solo `PerfilViejo.jsx` (`CuentaFechasImportantesPage.jsx` lo nombra en comentarios) | con `PerfilViejo.jsx`; `react-easy-crop` se queda (`AdminImageCropper`) |
| `pages/cuenta/MisDireccionesViejo.jsx` + `MisDireccionesPage.module.css` (355 líneas) | `/cuenta/direcciones` | `components/cuenta/DireccionesDeCuenta.jsx` → `PaginaDirecciones` | `MisDireccionesPage.jsx` (lazy, solo con `cuentaVieja`) | al retirar `cuentaVieja` |

### Catálogo, Mis cupones y Misiones (2026-10-17)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/cuenta/CatalogRewardViejo.jsx` + `CatalogReward.module.css` (290 líneas) | `/cuenta/catalogo` | `components/cuenta/CatalogoDeCuenta.jsx` → `PaginaCatalogo` | `CatalogReward.jsx` (lazy, solo con `cuentaVieja`) | al retirar `cuentaVieja` |
| `pages/cuenta/MisCuponesViejo.jsx` + `MisCuponesPage.module.css` (245 líneas) + `public/assets/kapi/cupon-ruleta.webp`, `cupon-catalogo.webp` | `/cuenta/cupones` | `CuponesDeCuenta.jsx` → `PaginaCupones` (el talón con `IconoWala`) | `MisCuponesPage.jsx` (lazy, solo con `cuentaVieja`); las imágenes, solo la página de antes | al retirar `cuentaVieja` |
| `pages/cuenta/MisionesViejo.jsx` + `MisionesPage.module.css` (864 líneas) | `/cuenta/misiones` | `MisionesDeCuenta.jsx` → `PaginaMisiones` | `MisionesPage.jsx` (lazy, solo con `cuentaVieja`) | al retirar `cuentaVieja` |
| `tierForXp` y los `icon` (emojis) de `constants/tiers.js` | Misiones de antes | `nivelesDesdeTiers` + `NivelCuenta` | buscar antes de borrar (`TIERS` se queda: es la fuente de los niveles) | con `MisionesViejo.jsx`, si nadie más los usa |

### Mis referidos (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/cuenta/CuentaReferidosViejo.jsx` + `CuentaReferidosPage.module.css` (971 líneas) | `/cuenta/referidos` | `components/cuenta/ReferidosDeCuenta.jsx` → `PaginaReferidos` | `CuentaReferidosPage.jsx` (lazy, solo con `cuentaVieja`) | al retirar `cuentaVieja` |
| `pages/cuenta/components/GrupoReferidos.jsx` + `DetallePedidoReferido.jsx` | la página de antes | `FilaReferido` y `DetallePedidoReferido` del kit (la lógica de estados, en el conector) | solo `CuentaReferidosViejo.jsx` | con la página de antes |
| `components/analytics/ReferralRanking.jsx` + su CSS (213 líneas) | la página de antes | `RankingReferidos` | solo `CuentaReferidosViejo.jsx` | con la página de antes |

### Lista de deseos (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/cuenta/WishlistViejo.jsx` + `WishlistPage.module.css` | `/cuenta/wishlist` | `components/cuenta/ListaDeseosDeCuenta.jsx` → `PaginaListaDeseos` | `WishlistPage.jsx` (lazy, solo con `cuentaVieja`) | al retirar `cuentaVieja` |
| `useProducts([], { includeHidden: true })` en esta página (el catálogo entero) | la página de antes | `useProductosDeLista` (`components/regalar/regaloDeLista.js`) | el hook sigue en la tienda; solo se va su uso aquí | con la página de antes |

### Fechas importantes (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/cuenta/CuentaFechasImportantesViejo.jsx` + `CuentaFechasImportantesPage.module.css` | `/cuenta/fechas-importantes` | `components/cuenta/FechasDeCuenta.jsx` → `PaginaFechas` | `CuentaFechasImportantesPage.jsx` (lazy, solo con `cuentaVieja`) | al retirar `cuentaVieja` |
| `pages/cuenta/FechasFestivasSeccion.jsx` | la página de antes | `AvisoFestiva` | solo `CuentaFechasImportantesViejo.jsx` (usa el mismo CSS) | con la página de antes |
| `components/common/FechaEventoInput/` | el modal de antes | `CampoFecha anioOpcional` | `pages/SubscriptionSurveyPage.jsx` (la encuesta) | cuando ya nadie lo importe |

### Mis creaciones (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/cuenta/MisCreacionesViejo.jsx` | `/cuenta/creaciones` | `components/cuenta/CreacionesDeCuenta.jsx` → `PaginaCreaciones` | `MisCreacionesPage.jsx` (lazy, solo con `cuentaVieja`) | al retirar `cuentaVieja` |
| `pages/cuenta/components/MiCreacionCard.jsx` + `MisCreacionesPage.module.css` | la página de antes | `TarjetaCreacion` (`fechaDeCreacion`/`guardadaHace` → `fechaDeDiseno`/`haceCuanto` en adaptadores) | `PersonalizarPage.jsx` (la tarjeta y `fechaDeCreacion`), `Crear/CreacionPage.jsx` (`fechaDeCreacion`), `Comunidad/ComunidadPage.jsx` (`MiCreacionCardSkeleton`), `Crear/TarjetaMiCombo.jsx` y `TusBorradores.jsx` (estilos y fechas) | cuando Crear y la Comunidad dejen de usarla |
| `pages/Crear/TarjetaMiCombo.jsx`, `TusBorradores.jsx` (el componente; `useBorradoresCrear` se queda) | la página de antes y Crear | `TarjetaCreacion` con `imagenes` / `borrador` | `PersonalizarPage.jsx`; `TarjetaMiCombo.module.css` también lo usan `Comunidad/TarjetaComunidad.jsx` y `Crear/ComboCrearPage.jsx` | cuando Crear pase al kit (el CSS, cuando nadie lo importe) |
| `usePedidos(dni)` en Mis creaciones (y su `purchasedDesignIds`, que nunca encontraba nada) | la página de antes | `design.enPedido` | Mis pedidos sigue usando `usePedidos` | con la página de antes |

### Mis pedidos, la lista (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/cuenta/CuentaRastreoViejo.jsx` + `CuentaRastreoPage.module.css` | `/cuenta/pedidos` | `components/cuenta/PedidosDeCuenta.jsx` → `PaginaPedidos` (`resumirRastreo` → `seguimientoDesdePedido`) | `CuentaRastreoPage.jsx` (lazy, con `cuentaVieja` o `pagosViejo`) | al retirar los dos interruptores para Mis pedidos |
| `pages/cuenta/PedidosPorVerificar.jsx` + su CSS | la página de antes | `PedidosPorVerificar` del kit | solo `CuentaRastreoViejo.jsx` | con la página de antes |
| `pages/PedidosPage.module.css` (`.content`, esqueletos) | la página de antes | el kit | solo `CuentaRastreoViejo.jsx` | con la página de antes |

### Mis pedidos, el detalle (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/cuenta/CuentaCompraDetalleViejo.jsx` + `CuentaCompraDetallePage.module.css` | `/cuenta/pedidos/:id` | `components/cuenta/DetallePedidoDeCuenta.jsx` → `PaginaDetallePedido` | `CuentaCompraDetallePage.jsx` (lazy, con `cuentaVieja` o `pagosViejo`) | al retirar los dos interruptores para Mis pedidos |
| `components/PedidoCard/PedidoAcciones.jsx` + su CSS, `HistorialPagos.jsx` + su CSS | la página de antes | `PagosPedido` y `HojaPagarSaldo` del kit (los datos, en el conector) | solo `CuentaCompraDetalleViejo.jsx` (y un comentario en `App.jsx`) | con la página de antes; ahí se va también el `Modal` viejo de "Pagar saldo" bajo `pagosViejo` |
| `components/Timeline/` | la página de antes | `LineaProduccion` con `hechos` | solo `CuentaCompraDetalleViejo.jsx` | con la página de antes |
| `getOrderByIdAnyCollection` en el detalle (la segunda lectura del pedido) | la página de antes | el pedido de `usePedidos` | revisar con `grep getOrderByIdAnyCollection` (otros usos en el admin) | la función se queda; solo se va su uso aquí |

### La búsqueda (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/SearchPageViejo.jsx` + `pages/SearchPage.module.css` (la página de antes: título, campo, barra con el `<select>`, Modalidad como `gruposExtra` y `SidebarCatalogLayout`) | `/buscar` | `components/busqueda/BusquedaDeTienda.jsx` → `PaginaBusqueda` del kit (`paginas/Busqueda.jsx`) | `pages/SearchPage.jsx` (lazy, solo con el interruptor `busquedaVieja`) | al retirar `busquedaVieja`; con ella, `SidebarCatalogLayout` pierde su último uso fuera de `seccionesViejo` |

### Las campañas (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/InvitarViejo.jsx` | `/invitar/:código` | `components/campanas/InvitacionDeTienda.jsx` → `PaginaInvitacion` | `pages/InvitarPage.jsx` (lazy, solo con `campanasViejo`) | al retirar `campanasViejo` |
| `components/common/AvisoInvitacion/AvisoInvitacion.jsx` (el aviso; `NotaInvitacion` se queda) + su CSS | el aviso sobre la cabecera | `components/marco/AvisoInvitacionDeTienda.jsx` → `AvisoInvitacion` del kit | `AvisoInvitacionDeTienda` (lazy, solo con `campanasViejo`); `NotaInvitacion` la usa `CheckoutViejo.jsx` | el aviso, al retirar `campanasViejo`; `NotaInvitacion`, con `CheckoutViejo` |
| `pages/LinkInBioViejo.jsx` + `LinkInBioPage.module.css` | `/l/:slug` | `components/campanas/EnlacesDeTienda.jsx` → `PaginaEnlaces` | `pages/LinkInBioPage.jsx` (lazy, solo con `campanasViejo`) | al retirar `campanasViejo` (`linkThemes.js` se queda: lo usan el kit y el admin) |
| `pages/SubscriptionLandingViejo.jsx` + `SubscriptionLandingPage.module.css` | `/suscripciones` | `components/campanas/SuscripcionesDeTienda.jsx` → `PaginaSuscripciones` | `pages/SubscriptionLandingPage.jsx` (lazy, solo con `campanasViejo`) | al retirar `campanasViejo` |
| `pages/SorteosViejo.jsx` + `SorteosPage.module.css` (con `CulqiTicketButton`, `PaypalTicketButtons` y `FormularioDatosSorteo`) | `/sorteos`, `/sorteos/:slug` | `components/campanas/SorteoDeTienda.jsx` → `PaginaSorteo`, con `CulqiCustomCheckout` (`cobro`) y `PaypalTicketSorteo` | `pages/SorteosPage.jsx` (lazy, solo con `campanasViejo`) | al retirar `campanasViejo` |

### Los juegos por dentro (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/Minijuegos/BallSortViejo.jsx` + `BallSortPage.module.css` | `/ball-sort` | `components/minijuegos/BolitasDeTienda.jsx` → `PaginaBolitas` | `pages/Minijuegos/BallSortPage.jsx` (lazy, solo con `juegosViejo`) | al retirar `juegosViejo` |
| `pages/Minijuegos/RuletaViejo.jsx` + `RuletaPage.module.css` | `/ruleta` | `components/minijuegos/RuletaDeTienda.jsx` → `PaginaRuleta` | `pages/Minijuegos/RuletaPage.jsx` (lazy, solo con `juegosViejo`) | al retirar `juegosViejo` |
| `pages/Tienda/WordleViejo.jsx` + `WordlePage.module.css` | `/palabra-del-dia` | `components/minijuegos/PalabraDeTienda.jsx` → `PaginaPalabra` | `pages/Tienda/WordlePage.jsx` (lazy, solo con `juegosViejo`) | al retirar `juegosViejo` |
| `components/ruleta/RuedaRuleta.jsx` + su CSS | la ruleta y la vista previa del admin | `RuedaRuleta` del kit (`piezas/Ruleta.jsx`; el admin ya la usa) | solo `RuletaViejo.jsx` | con `RuletaViejo` |
| `pages/Minijuegos/ArcadeShell.jsx` + su CSS | el marco de los tres juegos | `MarcoJuego` | `BallSortViejo`, `RuletaViejo`, `WordleViejo` y `MinijuegosViejo` | al retirar `juegosViejo` y `minijuegosViejo` |
| `hooks/useEntregaMonedas.js` | el bloqueo de los premios | `components/minijuegos/entregarMonedas.js` | solo las tres páginas viejas | con ellas |

### La Zona Arcade (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/Minijuegos/MinijuegosViejo.jsx` + `MinijuegosPage.module.css` (con `JuegoCard`) | `/minijuegos` | `components/minijuegos/MinijuegosDeTienda.jsx` → `PaginaMinijuegos` | `pages/Minijuegos/MinijuegosPage.jsx` (lazy, solo con `minijuegosViejo`) | al retirar `minijuegosViejo` |

Se quedan: `ArcadeShell` (lo usan las tres páginas viejas de los juegos,
con `juegosViejo`: ver arriba) y `Badge` / `Stagger` de `components/ui` (los usan
otras páginas).

### Las legales (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/PoliticasPrivacidadViejo.jsx` y `pages/TerminosCondicionesViejo.jsx` + `pages/PoliticasPrivacidad.module.css` (el texto escrito en el JSX) | `/politicas-privacidad`, `/terminos-y-condiciones` | `components/legales/LegalDeTienda.jsx` → `PaginaLegal`, con el texto en `config/legales/` | las páginas nuevas (lazy, solo con `legalesViejo`) | al retirar `legalesViejo` (un cambio legal ya se hace solo en `config/legales/`) |
| `pages/LibroReclamacionesViejo.jsx` + `pages/LibroReclamaciones.module.css` | `/libro-de-reclamaciones` | `components/legales/ReclamacionesDeTienda.jsx` → `PaginaReclamaciones` | `pages/LibroReclamacionesPage.jsx` (lazy, solo con `legalesViejo`) | al retirar `legalesViejo` |

### La encuesta (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/SubscriptionSurveyViejo.jsx` + `pages/SubscriptionSurveyPage.module.css` | `/encuesta-suscripcion` | `components/encuesta/EncuestaDeTienda.jsx` → `PaginaEncuesta` | `pages/SubscriptionSurveyPage.jsx` (lazy, solo con `encuestaVieja`) | al retirar `encuestaVieja` |
| `components/common/FechaEventoInput/` | la persona de la encuesta de antes (y Fechas importantes de antes) | `CampoFecha` con "No sé el año" (`HojaPersona`) | `SubscriptionSurveyViejo.jsx`, `pages/cuenta/CuentaFechasImportantesViejo.jsx` (volver a buscar) | al retirar `encuestaVieja` y `cuentaVieja` |

Se queda: `getSurveyConfig` (`services/encuestaConfig.js`), que crea el
documento si falta: lo usa el admin (`AdminEncuestas`,
`AdminRespuestasEncuesta`). Quien responde lee con `leerSurveyConfig`.

### El acceso (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/LoginViejo.jsx` + `LoginPage.module.css` | `/login` | `components/acceso/LoginDeTienda.jsx` → `PaginaLogin` | `pages/LoginPage.jsx` (lazy, solo con `accesoViejo`) | al retirar `accesoViejo` |
| `pages/RegisterViejo.jsx` + `RegisterPage.module.css` | `/registro` | `components/acceso/RegistroDeTienda.jsx` → `PaginaRegistro` | `pages/RegisterPage.jsx` (lazy, solo con `accesoViejo`) | al retirar `accesoViejo` |
| `pages/ResetPasswordViejo.jsx` + `ResetPasswordPage.module.css` | `/recuperar-contrasena` | `components/acceso/RecuperarDeTienda.jsx` → `PaginaRecuperar` | `pages/ResetPasswordPage.jsx` (lazy, solo con `accesoViejo`) | al retirar `accesoViejo` |
| `pages/CompleteProfileViejo.jsx` + `CompleteProfilePage.module.css` | `/completar-perfil` | `components/acceso/CompletarPerfilDeTienda.jsx` → `PaginaCompletarPerfil` | `pages/CompleteProfilePage.jsx` (lazy, solo con `accesoViejo`) | al retirar `accesoViejo` |
| `components/intl/CountrySelect.jsx` y `PhoneIntlInput.jsx` (+ CSS) | registro y completar perfil (antes también Mi perfil) | `CamposDatosPersonales` (`ListaOpciones`, `CampoTelefono`) | `RegisterViejo.jsx`, `CompleteProfileViejo.jsx`, `pages/cuenta/PerfilViejo.jsx` | al retirar `accesoViejo` y `cuentaVieja` (volver a buscar) |
| `getPasswordRequirements` e `isPasswordValid` (`utils/helpers.js`) | el registro de antes | `requisitosContrasena` / `contrasenaValida` (`piezas/Acceso.jsx`, la misma lista de símbolos) | solo `RegisterViejo.jsx` | con `RegisterViejo.jsx` |

Se quedan: `EsperaPantalla` (la espera tras entrar, también en
`LoginDeTienda`), `EyeIcon` / `EyeOffIcon` de `common/Icons` (los usa el admin)
y `validateDNI` y compañía (`utils/helpers.js`, los usan otras páginas).

### La carga entre páginas (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `components/common/PageLoading/` (+ CSS) | el `Suspense` de `App.jsx` y `RutaPrivada` | `components/carga/CargandoRuta.jsx` → `EsqueletoPagina` | `CargandoRuta` (con `cargaVieja` y en el admin) | cuando el admin tenga su esqueleto y se retire `cargaVieja` |
| `components/common/Loading/` (el círculo) | `BrandLoaderOverlay` después de la marca; el login, el registro y la contraseña (`fullScreen portal`) | `EsqueletoPagina` de la ruta y `CapaCargando` (`components/carga/EsperaPantalla.jsx`) | `BrandLoaderOverlay` y `EsperaPantalla` (con `cargaVieja`); `WishlistPublicViejo.jsx`; revisar con `grep "common/Loading"` | al retirar `cargaVieja` y la lista pública de antes |
| `components/common/BrandLoader/BrandLoader.jsx` + su CSS | `BrandLoaderOverlay` (la primera vez) | `PantallaCarga` | `BrandLoaderOverlay` (con `cargaVieja`) | al retirar `cargaVieja`; `BrandLoaderOverlay` se queda (decide cuándo y dónde) |
| `components/common/BottomNav/` (`BottomNav.jsx`, `BottomNav.module.css`, `index.js`) | `App.jsx` (todas las páginas) | `components/marco/BarraInferiorDeTienda.jsx` → `BarraInferior` del kit | `BarraInferiorDeTienda` (con `barraVieja`, en su propio archivo); revisar con `grep "BottomNav"` | al retirar `barraVieja` |
| `components/common/Header/` (`Header.jsx`, `Header.module.css`, `NotificationTray.jsx`, `index.js`) | `App.jsx` (todas las páginas) | `components/marco/CabeceraDeTienda.jsx` → `Cabecera` del kit | `CabeceraDeTienda` (con `cabeceraVieja`, en su propio archivo); revisar con `grep "common/Header'"` | al retirar `cabeceraVieja` |
| `components/common/HeaderSearch/` (`HeaderSearch.jsx` + CSS) | `Header.jsx` | el buscador de `Cabecera` con `buscarSugerencias` (`PanelBusqueda`) | solo `Header.jsx` | junto con `Header` |
| `components/common/ThemeToggle/` y `components/i18n/FlagIcon.jsx` | `Header.jsx` (y `CuentaAjustesViejo.jsx`) | `BotonTema` y el idioma de `MenuCuenta` | `CuentaAjustesViejo.jsx` | al retirar `cabeceraVieja` y `cuentaVieja` |
| `pages/Tienda/admin/VisualEditorPanel.jsx` + `components/admin/VisualEditorPanel.module.css` | `App.jsx` (el editor de cada página) | `components/constructor/EditorDeTienda.jsx` → `PanelEditor` del kit | `components/constructor/EditorVisual.jsx` (con `editorViejo`) | al retirar `editorViejo` |
| `pages/Tienda/admin/editor/controls/` `TypographyControl`, `TextStyleControl`, `ButtonFieldsControl` | `VisualEditorPanel.jsx` | los campos del kit (`tipografia`, `estiloTexto`, `boton`) | solo `VisualEditorPanel.jsx` | junto con `VisualEditorPanel` (con `BackgroundStylesControl`: el formulario del cacherito que también lo usaba se retiró) |
| `SeccionVieja` en `components/admin/EditableSection.jsx` + `EditableSection.module.css` | todas las `EditableSection` mientras se edita | `SeccionEditable` del kit (`components/constructor/MarcasDeEdicion.jsx`) | `EditableSection` (con `editorViejo`) | al retirar `editorViejo`; `EditableSection` se queda como el puente |
| `ModuleInserter` de `pages/Tienda/TiendaPage.jsx` y de `components/common/Footer/Footer.jsx`, y el velo "Editar Pie de Página" / la franja "Volver al Cuerpo" del pie | la página y el pie mientras se edita | `InsertarAqui` (`PuntoDeInsercion`) y lo del kit en el pie | `PuntoDeInsercion` y el pie (con `editorViejo`) | al retirar `editorViejo` |

### Crear (2026-10-19)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/PersonalizarViejo.jsx` + `PersonalizarPage.module.css` | `/personalizar` | `components/crear/CrearDeTienda.jsx` → `PaginaCrear` | `pages/PersonalizarPage.jsx` (lazy, solo con `crearViejo`) | al retirar `crearViejo` |
| `pages/Crear/FilaCarrusel.jsx` | las filas de Crear de antes | `Carrusel` del kit | `TusBorradores.jsx` | con `PersonalizarViejo` y `MisCreacionesViejo` (`cuentaVieja`) |
| `pages/Comunidad/ComunidadViejo.jsx` + `TarjetaComunidad.jsx` (y sus reglas de `Comunidad.module.css`) | `/comunidad` y la fila de Crear de antes | `ComunidadDeTienda.jsx` → `PaginaComunidad` (`TarjetaCreacion usar`) | `ComunidadPage.jsx` (lazy, con `crearViejo`), `PersonalizarViejo.jsx` | al retirar `crearViejo` (`useComunidad` se queda) |
| `pages/Crear/VerDisenoViejo.jsx` + `VerDisenoPage.module.css` | `/ver/:id` | `VerDisenoDeTienda.jsx` → `PaginaVerDiseno` | `VerDisenoPage.jsx` (lazy, con `crearViejo`) | al retirar `crearViejo` |
| `pages/Crear/CreacionViejo.jsx` + `CreacionPage.module.css` | `/creacion/:id` | `CreacionDeTienda.jsx` → `PaginaCreacion` | `CreacionPage.jsx` (lazy, con `crearViejo`); el CSS también `ComboCrearViejo.jsx` | al retirar `crearViejo` |
| `pages/Crear/ComboCrearViejo.jsx` + `ComboCrearPage.module.css` | `/combo/:id` | `ComboDeTienda.jsx` (+ `useComboCrear.js`) → `PaginaCombo` | `ComboCrearPage.jsx` (lazy, con `crearViejo`) | al retirar `crearViejo` (`fotosCombo.js` se queda: lo usa el combo del kit) |
| `pages/Crear/NombreEditable.jsx` y `PuntosColor.jsx` | las páginas de antes | `TituloEditable` y la muestra de color del kit | `NombreEditable`: `CrearStudioPage.jsx`, `TarjetaMiCombo.jsx`, `MiCreacionCard.jsx`; `PuntosColor`: `TarjetaComunidad.jsx`, `TarjetaMiCombo.jsx` | cuando migre el estudio y se retiren `crearViejo` y `cuentaVieja` |
| `pages/Comunidad/AccionesComunidad.jsx` | publicar desde las páginas de antes | `comunidadPara` de `useTarjetasCreaciones` y el aviso de cada página del kit | `TarjetaMiCombo.jsx`, `MiCreacionCard.jsx`, `CreacionViejo.jsx`, `ComboCrearViejo.jsx` | al retirar `crearViejo` y `cuentaVieja` |
| `BotonLlevarEnCombo` y `useCombosDePrenda` (en `LlevarEnCombo.jsx`) | las tarjetas de antes | los combos de `TarjetaCreacion` y `PaginaCreacion` | `TusBorradores.jsx`, `MiCreacionCard.jsx` | al retirar `crearViejo` y `cuentaVieja` (`useLlevarEnCombo` se queda) |

Se quedan: `useBorradoresCrear`, `useComunidad`, `useVersionesReemplazadas`,
`useEliminarCreacion`, `useEliminarMiCombo`, `useLlevarEnCombo`,
`crearDesdePlantilla`, `comboCrear.js`, `creacionCarrito.js` y
`fotosCombo.js` (los usan los conectores del kit). `MiCreacionCard`,
`TarjetaMiCombo` y `TusBorradores` siguen en su fila de Mis creaciones
(arriba).

### El pie de página (2026-10-20)

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `components/common/Footer/FooterViejo.jsx` + `Footer.module.css` | todas las páginas | `components/marco/PieDeTienda.jsx` → `MarcoPie` y sus bloques | `Footer.jsx` (lazy, solo con `pieViejo` o `editorViejo`) | al retirar `pieViejo` y `editorViejo` |
| El bloque de antes dentro de `FooterViejo.jsx` (`PIE_LEGAL_EN_EL_KIT` en false) | el pie legal de antes | `PieLegal` | — | con `FooterViejo.jsx` |
