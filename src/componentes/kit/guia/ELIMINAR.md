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

