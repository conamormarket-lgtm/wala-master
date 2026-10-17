# Lo viejo que se borra al final de la migración

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
| `.product-detail-page` (clase global en `ProductDetail.jsx`, `CreacionPage.jsx`, `ComboCrearPage.jsx`) | solo la usaba la regla de `App.css` de arriba | la ruta, en `FlotantesDeLaTienda.jsx` | — | al borrar esa regla, quitar la clase de las tres páginas (o al migrarlas) |
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
| `pages/Crear/CapaModal.jsx` (fondo de las ventanas de Crear) | eliminar creación, comunidad y "llevar en combo" (ya con el kit) | `Confirmar` / `HojaInferior` | `CrearStudioPage.jsx` (5), `ComboCrearPage.jsx` (2), `AtajosTeclado.jsx`, `RecorteImagen.jsx`, `QuitarFondo.jsx` | cuando migren el estudio y el combo (paso 6, CREAR.md) |
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

## Paso 5: secciones del builder (todas las páginas menos el cacherito)

Desde el 2026-10-17 todos los tipos del builder van con el kit en todas las
páginas, salvo las del cacherito (`esDelCacherito`): ahí, y con el
interruptor `seccionesViejo`, siguen los componentes viejos, que carga
`pages/Tienda/services/seccionesPorTipo.jsx`. Lo que el cacherito usa
(`announcement_bar`, `header`, `video`, `faq_accordion`, `conversion_fold`,
`landing_payment`) **no se borra** mientras esa landing exista; el resto, al
retirar `seccionesViejo`.

| Qué | Lo usaba | Se reemplazó con | Quién más lo importa | Cuándo se puede borrar |
|---|---|---|---|---|
| `pages/Tienda/components/AnnouncementBar/` | `announcement_bar` | `BarraAnuncios` (`SeccionDelKit`) | `seccionesPorTipo.jsx` (cacherito y `seccionesViejo`) | cuando no quede el cacherito y se retire `seccionesViejo` |
| `pages/Tienda/components/HeroCarousel/` | `hero_carousel` | `HeroCarrusel` | ídem | ídem |
| `pages/Tienda/components/TrustBadges/` | `trust_badges` | `InsigniasConfianza` | ídem | ídem |
| `pages/Tienda/components/Testimonials/` | `testimonials` | `Testimonios` | ídem y `VisualEditorPanel.jsx` (editor viejo, paso 8) | ídem y con el editor del kit |
| `pages/Tienda/components/FaqAccordion/` | `faq_accordion` | `PreguntasFrecuentes` (sin Kapi con sesión) | ídem | ídem |
| `pages/Tienda/components/ProductQueryCarousel/` | `new_arrivals_carousel`, `sale_carousel`, `category_carousel` | `CarruselProductos` con las mismas consultas (`query-carousel`) hechas en `TiendaPage` (las de categoría con `useQueries`) | `seccionesPorTipo.jsx` (`seccionesViejo`) | al retirar `seccionesViejo` |
| `pages/Tienda/components/FeaturedCarousel/` (en secciones) | `featured_carousel` del inicio | `CarruselProductos` | `ProductQueryCarousel`, `ProductDetail.jsx` (relacionados, solo con `fichaVieja`: la ficha nueva usa `Carrusel` + `TarjetaDeProducto`), `CuentaCompraDetallePage.jsx`, `seccionesPorTipo.jsx` | al retirar `fichaVieja`, cuando migren el detalle del pedido y las demás páginas |
| `pages/Tienda/components/BannerGrid/` | `banner_grid` del inicio | `MosaicoBanners` (con `marcas` de la consulta `['brands']`) | `seccionesPorTipo.jsx` (`seccionesViejo`) | al retirar `seccionesViejo` |
| `pages/Tienda/components/CategoryGrid/` | `category_grid` del inicio | `GrillaCategorias` + `categoriasDeGrilla` (misma cuenta, foto y orden) | `seccionesPorTipo.jsx` (`/tienda` y marcas: `migrateHomeCategoryGrid`) | ídem |
| `pages/Tienda/components/HeaderBlock/` | `header` (`/tienda`, marcas) | `Encabezado` ("Nuestra Tienda" si no hay título) | `seccionesPorTipo.jsx` (cacherito: "Elige tu acabado"…), `services/storefront.js` (solo el nombre del tipo) | cuando no quede el cacherito y se retire `seccionesViejo` |
| `pages/Tienda/components/BrandMarquee/` (con su `.module.css`) | `marquee` | `MarcasMarquesina` | `seccionesPorTipo.jsx`; `services/brands.js` solo lo nombra en un comentario | ídem |
| `pages/Tienda/components/HeroBanner.jsx` y `HeroBanner.module.css` | `hero_banner` (marcas) | `BannerPrincipal` (`onClicBoton` → `trackBannerClick`) | `seccionesPorTipo.jsx`. `HeroBannerMediaUploader` de `VisualEditorPanel.jsx` es otra cosa (el editor viejo) | ídem |
| `pages/Tienda/components/VisualCategoryNav/` | `categories_nav` (marcas) | `NavCategorias` (`estilo` de la marca, `cargando`) | `seccionesPorTipo.jsx`; `SidebarCatalogLayout.jsx` solo lo nombra en un comentario | ídem |
| `pages/Tienda/components/SidebarCatalogLayout.jsx` y `.module.css` | `sidebar_catalog` (`/tienda`, marcas) | `CatalogoConFiltros` con el estado en `TiendaPage` (`filtrosKit`, `categoriaKit`, consultas `collections`/`tags`/`characters`/`productTypes`/`brands`/`storefront-category-grid-products`) | **`pages/SearchPage.jsx`** (la búsqueda, `/buscar`), `seccionesPorTipo.jsx`; los textos `cat.*` de `i18n/dictionaries.js` | cuando pase la búsqueda (BUSCAR.md) y se retire `seccionesViejo`; con él, las claves `cat.*` que nadie más use |
| `pages/Tienda/components/ProductGrid/` | `product_grid` y el catálogo (`/tienda`, marcas) | `GrillaProductos` | `SidebarCatalogLayout.jsx` (la búsqueda), `featured_products` (aún viejo, en `TiendaPage`), `seccionesPorTipo.jsx` | cuando pasen la búsqueda y `featured_products` |
| `landing-mobile.css`: `.heroContainer`, `.title`, `.subtitle`, `.actionButton` dentro de `@media (max-width: 768px)` | el `HeroBanner` viejo en las landings | — (el kit no usa esas clases) | revisar si el cacherito las usa antes de borrar | cuando no quede `HeroBanner` en ninguna landing |
| `TiendaPage.jsx`: `catalogSectionRef` y las ramas viejas de `renderSection` (`case 'header'`, `'marquee'`, `'sidebar_catalog'`, `'product_grid'`, `'hero_banner'`, `'categories_nav'`…) | lo de antes | `seccionDelKit` | el interruptor y el cacherito | junto con sus componentes |
| `pages/Tienda/components/TextBlock/` | `text` | `BloqueTexto` | `seccionesPorTipo.jsx` (`seccionesViejo`) | al retirar `seccionesViejo` |
| `pages/Tienda/components/ImageBlock/` | `image` | `BloqueImagen` | ídem | ídem |
| `TiendaPage.jsx`: `case 'video'` (el video armado a mano, con el salto de `video-02.mp4` del reloj) | `video` | `BloqueVideo` | el cacherito | cuando no quede el cacherito |
| `pages/Tienda/components/BestSellersRow/` | `bestsellers_row` | `FilaDestacados` | `seccionesPorTipo.jsx` (`seccionesViejo`) | al retirar `seccionesViejo` |
| `pages/Tienda/components/FeatureList/` | `feature_list` | `ListaBeneficios` | ídem | ídem |
| `pages/Tienda/components/MapLocation/` | `map_location` | `Ubicacion` | ídem | ídem |
| `pages/Tienda/components/CollectionCarousel/` | `collection_carousel` | `CarruselProductos` con las consultas `collection-products` / `collection-details` en `TiendaPage` | ídem | ídem |
| `pages/Tienda/components/FlashSales/` | `flash_sales` | `OfertaRelampago` con la consulta `flash-sales` en `TiendaPage` | ídem | ídem |
| `TiendaPage.jsx`: `case 'featured_products'` | `featured_products` | `GrillaProductos` | — | al retirar `seccionesViejo`; con él, `ProductGrid` queda solo para la búsqueda |
| `landing-mobile.css`: el tema oscuro de `.landing-page-wrapper` | todas las landings | las sin marca con el kit llevan `landing-store-page` | el cacherito | **no borrar**: es el tema del cacherito |

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
