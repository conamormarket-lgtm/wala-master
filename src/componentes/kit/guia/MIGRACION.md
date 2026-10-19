# Llevar el kit a la tienda (en marcha: pasos 1 a 5 hechos; el 6, página por página)

Lo común a todas las páginas: qué ya usa la tienda, cómo se importa y en qué
orden se migraría. El detalle de cada página (reemplazos con archivo y línea,
de dónde sale cada dato, comportamiento que no se puede perder) está en su
ficha: [INICIO.md](INICIO.md#llevar-a-la-tienda-a-futuro-todavía-no-se-hace).

Este es el único orden oficial. Las fichas de cada página lo siguen y solo
agregan lo propio de esa página.

## Cómo se importa

En la tienda, importar **directo del archivo** (`componentes/kit/Boton`), no
de `kit/index.js`: el índice arrastraría el CSS de todo el kit al paquete
principal (y a la APK de Capacitor).

## Ya en la tienda

| Qué | Dónde |
|---|---|
| `ProveedorEnlaces` (envuelve el router) | `src/App.jsx` |
| `ProveedorTraduccion` (los textos del kit pasan por el mismo motor que `<T>`) | `src/App.jsx` |
| `ProveedorToasts`: `ToastProvider` es un puente, así que todos los `useGlobalToast()` ya muestran los toasts del kit | `src/contexts/ToastContext.jsx` |
| `Boton` en carrito y checkout (el verde de WhatsApp y "Aplicar" del cupón siguen igual) | `pages/CartPage.jsx`, `pages/CheckoutPage.jsx`, `pages/Tienda/components/Cart/Cart.jsx` |
| Monedas que vuelan (`showFlyingCoins` / `volarMonedasGanadas`): en arco, girando, con "+N" y el saldo que late; mismos eventos para la cabecera | `src/utils/animations.js` (toda la tienda) |
| `IconoWala` y `Trazo` en referidos | `components/common/AvisoInvitacion/AvisoInvitacion.jsx`, `pages/cuenta/components/GrupoReferidos.jsx`, `pages/cuenta/CuentaReferidosPage.jsx` |
| `PaginaCuentaInvitado`: solo /cuenta sin sesión (la pestaña "Cuenta"); cada sección (/cuenta/pedidos…) es una página privada y va al login con `?redirect=` (`utils/rutaPrivada.js`), así que la variante `pedidos` ya no se usa. `CuentaLoginPrompt` y `PedidosLoginPrompt` quedan sin usar hasta borrarlos; los textos del `accountPopup` del editor visual siguen solo en el pop-up de la cabecera | `pages/CuentaLayout.jsx` |
| Marco (paso 2), cada pieza con su conector en `src/components/marco/`: `AvisoSistema` (`AvisoDelSistema.jsx`), `BarraAdmin` `fija` (`BarraDeAdmin.jsx`; publica `--admin-bar-height` para la cabecera), `AvisoIdioma` `flotante` (`AvisoDeIdioma.jsx`), `VentanaCampana` (`AnuncioDeCampana.jsx`), la pila de flotantes (`FlotantesDeLaTienda.jsx`: `PilaFlotante`, `BotonWhatsApp` con `useWhatsAppDeLaRuta.js`, `PildoraRecompensa` y Kapi en `Kapi.jsx` con `KapiFlotante` + `VentanaKapi` y las caras 3D) | `src/App.jsx` |
| `BannerApp` (`components/marco/BannerDeLaApp.jsx`, montado donde siempre, con su portal antes de la cabecera) | `pages/Tienda/TiendaPage.jsx` |
| `TarjetaProducto` por `components/producto/TarjetaDeProducto.jsx` (paso 4) | `ProductGrid`, `FeaturedCarousel`, `CollectionCarousel`, `FlashSales` |
| Secciones del builder con `SeccionDelKit` (paso 5): todas las páginas menos el cacherito; `TIPOS_DEL_KIT` y `esDelCacherito` (`pages/Tienda/services/seccionesDelKit.js`) dicen qué; el catálogo con `CatalogoConFiltros` y su estado en la página | `pages/Tienda/TiendaPage.jsx`, `DynamicLandingPage.jsx` (fondo), `services/startup.js` (precarga) |
| `PieLegal` (`pieLegalDesdeEmpresa`) dentro del pie viejo; las columnas y su editor siguen igual. El bloque viejo queda apagado con `PIE_LEGAL_EN_EL_KIT` | `components/common/Footer/Footer.jsx` |
| La píldora "Gana 15 monedas" de la cabecera vieja, apagada con `PILDORA_EN_EL_KIT` (la dibuja `FlotantesDeLaTienda`) | `components/common/Header/Header.jsx` |
| La ficha de producto (paso 6): `PaginaProducto` por `components/producto/FichaDeProducto.jsx` (con `usePiezasDelCombo.js` y `eleccionCarrito.js`); `ProductDetail` baja solo con `fichaVieja` | `pages/ProductPage.jsx` |
| El carrito (paso 6): `PaginaCarrito` por `components/carrito/CarritoDeTienda.jsx` (`itemCarritoDesde`); `Cart.jsx` baja solo con `carritoViejo` | `pages/CartPage.jsx` |
| El checkout (paso 6): `PaginaCheckout` por `components/checkout/CheckoutDeTienda.jsx`; el pedido con `services/pedidoCheckout.js` (compartido con la página de antes); Culqi con `renderBoton`, PayPal con `soloBotones`; la página de antes baja solo con `pagosViejo` | `pages/CheckoutPage.jsx` |
| El pago rápido (paso 6): `PaginaPagoRapido` por `components/pago/PagoRapidoDeTienda.jsx` (`enlacePagoDesde`; Culqi con `renderBoton`, PayPal con `soloBotones` y lazy); la página de antes baja solo con `pagosViejo` | `pages/PagoRapidoPage.jsx` |
| La lista de deseos de otra persona (paso 6): `PaginaListaPublica` por `components/regalar/ListaPublicaDeTienda.jsx` (`itemRegaloDesde`, lo compartido en `regaloDeLista.js`); cada producto con `getProduct`, no el catálogo; la página de antes baja solo con `regalarViejo` | `pages/WishlistPublic/WishlistPublic.jsx` |
| Regalar para una fecha (paso 6): `PaginaRegalar` por `components/regalar/RegalarDeTienda.jsx` (`fechaEntregaDesde`, sin el arrastre); la página de antes baja solo con `regalarViejo` | `pages/GiftRegistry/GiftRegistryPage.jsx` |
| Abrir el regalo (paso 6): `PaginaRegaloSorpresa` por `components/regalar/RegaloSorpresaDeTienda.jsx`; sin el Kapi flotante en `/regalo/`; la página de antes baja solo con `regalarViejo` | `pages/GiftExperiencePage.jsx` |
| El marco de la cuenta, el resumen y los ajustes (paso 6): `MarcoCuenta`, `PaginaResumenCuenta` y `PaginaAjustes` por `components/cuenta/` (`MarcoDeCuenta`, `ResumenDeCuenta`, `AjustesDeCuenta`, `gruposDeCuenta`); las demás secciones, las de antes dentro del marco nuevo; lo de antes baja solo con `cuentaVieja` | `pages/CuentaLayout.jsx`, `pages/cuenta/CuentaResumenPage.jsx`, `pages/cuenta/CuentaAjustesPage.jsx` |
| Mis creaciones (paso 6): `PaginaCreaciones` por `components/cuenta/CreacionesDeCuenta.jsx`; "Comprado" de `enPedido` (sin pedir los pedidos), eliminar con una sola confirmación, combos, borradores y diseños de antes completos, `VersionesAnteriores`; lo de antes baja solo con `cuentaVieja` | `pages/cuenta/MisCreacionesPage.jsx` |
| Fechas importantes (paso 6): `PaginaFechas` por `components/cuenta/FechasDeCuenta.jsx`; guardar conserva lo de la encuesta, varios paquetes por persona, lo que pide talla abre Agregar rápido; lo de antes baja solo con `cuentaVieja` | `pages/cuenta/CuentaFechasImportantesPage.jsx` |
| Lista de deseos (paso 6): `PaginaListaDeseos` por `components/cuenta/ListaDeseosDeCuenta.jsx` con `TarjetaDeProducto` en el hueco `tarjeta`; los productos uno por uno (no el catálogo entero); los links con `https://wala.pe` en la app; lo de antes baja solo con `cuentaVieja` | `pages/cuenta/WishlistPage.jsx` |
| Mis referidos (paso 6): `PaginaReferidos` por `components/cuenta/ReferidosDeCuenta.jsx` (los pedidos por reclamar y el ranking al acercarse); `linkInvitacion`/`linkProducto` con `https://wala.pe` en la app; lo de antes baja solo con `cuentaVieja` | `pages/cuenta/CuentaReferidosPage.jsx` |
| Catálogo, Mis cupones y Misiones (paso 6): `PaginaCatalogo`, `PaginaCupones` y `PaginaMisiones` por `components/cuenta/CatalogoDeCuenta.jsx`, `CuponesDeCuenta.jsx` y `MisionesDeCuenta.jsx` (`misionDesdeServidor`, `nivelesDesdeTiers`); lo de antes baja solo con `cuentaVieja` | `pages/cuenta/CatalogReward.jsx`, `MisCuponesPage.jsx`, `MisionesPage.jsx` |
| Mi perfil y Mis direcciones (paso 6): `PaginaPerfil` y `PaginaDirecciones` por `components/cuenta/PerfilDeCuenta.jsx` y `DireccionesDeCuenta.jsx` (`perfilDesdeUsuario`, `direccionDesdeFirestore`/`direccionAFirestore`); lo de antes baja solo con `cuentaVieja` | `pages/cuenta/PerfilPage.jsx`, `pages/cuenta/MisDireccionesPage.jsx` |
| "Agregar rápido" (`AgregarRapido`) en todas las tarjetas: "Elegir…" abre la hoja (`components/producto/AgregarRapidoDeProducto.jsx`, en su propio paquete) | `components/producto/TarjetaDeProducto.jsx` |

Cada pieza del marco tiene un conector chico en `src/components/marco/`: lee
lo de la tienda (Firestore, rutas, sesión) y dibuja la pieza del kit. Lo viejo
queda en su sitio hasta el final ([ELIMINAR.md](ELIMINAR.md)).

Cambiar `Boton`, `Feedback`, `Enlace`, `IconosWala`, `Marca`, `Traduccion`,
`piezas/Marco`, `piezas/Flotantes`, `piezas/VentanaKapi`, `piezas/RetoSemanal`
(y lo que usan: `BarraProgreso`, `CuentaRegresiva`, `Etiquetas`, `Formulario`)
o los adaptadores del marco ya cambia la tienda real: revisar también esas
pantallas. (`Feedback` usa `Efectos`:
`useCerrarConAtras` ahora cierra solo la hoja de encima cuando hay dos.) (`Marca.jsx` ahora también
exporta `Sello`; agregarlo no cambió nada de lo que ya usa la tienda.) `Feedback` usa
`piezas/FotoProducto` para la foto de los toasts, así que esa pieza (y el
token `--escenario-foto` de `tokens.css`) también está ya en la tienda.
Desde el paso 5 también `Secciones`, `SeccionesExtra`, `SeccionesContenido`,
`Seccion`, `Acordeon`, `Marquesina` y las piezas que usan (`OpcionesFiltro`,
`TarjetaCategoria`, `LogoMarca`…). `EstadoVacio` acepta `imagen={null}`
(sin Kapi, un sello) y `BloqueSeccion` marca su `<section>` con
`data-kit-seccion` (lo usa `landing-mobile.css`).
Desde el checkout (paso 6), `paginas/Checkout`, `piezas/Checkout`,
`piezas/Direccion` (`CamposDireccion`) y `ListaEleccion` (con `accion`).
Desde el pago rápido (paso 6), `paginas/PagoRapido` y `piezas/Pago`
(`PagoTarjeta` controlado, `PagoPaypal`).
Desde el carrito (paso 6), `paginas/Carrito` y `Pedido` (`ItemCarrito`,
`BarraEnvioGratis`, `ResumenPedido`); `FotoProducto` acepta `srcSet` y
`Casilla` traduce su etiqueta.
Desde la ficha (paso 6) también `paginas/Producto`, `piezas/Ficha`,
`GaleriaProducto`, `OpcionesProducto`, `Opiniones`, `AgregarRapido`,
`Carrusel`, `Acordeon` y `Esqueletos` (`Hueso`, `EsqueletoPagina forma="producto"`).
`SelectorColor` y `SelectorTalla` (`Formulario`) ahora pasan su etiqueta por
`<Texto>` (en español no cambia nada).

## Orden

Cada paso en su propio commit, verificable por separado.

1. ✓ Proveedores y `Boton` (arriba). `ProveedorTraduccion` ya está en `App.jsx`, dentro de
   `ProveedorEnlaces`, con `useTranslatedText` y `useTranslatedHtml` (TRADUCCION.md). No cambia
   nada en español.
2. ✓ **Marco** (2026-10-16, un commit por pieza): `BarraAdmin`, `AvisoSistema`, `BannerApp`, flotantes
   (`PilaFlotante` y compañía; Kapi con su ventana, KAPI.md), `PieLegal`,
   `VentanaCampana`, `AvisoIdioma`. Cada uno con su conector en
   `src/components/marco/` (arriba). Lo viejo, en [ELIMINAR.md](ELIMINAR.md).
3. ✓ **Avisos y hojas** (2026-10-16): `Aviso`, `HojaInferior` y `Confirmar` en lugar de los modales
   sueltos de la tienda. Hecho: el `Modal` común (registro y las 5 ventanas de
   `PedidoAcciones`), los `confirm()` / `alert()` (con `useConfirmar` y toasts),
   las ventanas compartidas de Crear (eliminar creación, comunidad, llevar en
   combo) y la pantalla de Culqi mientras cobra (`CapaCargando`). Esperan a su
   página: las ventanas del estudio y del combo, los juegos, los sorteos, Fechas
   importantes, el recorte de la foto de perfil, la cabecera (paso 7) y los
   filtros del catálogo (paso 5).
4. ✓ **`TarjetaProducto`** en carruseles y grillas (2026-10-16), con `tarjetaDesdeProducto`:
   `components/producto/TarjetaDeProducto.jsx` (mismas props que
   `PremiumProductCard`) en `ProductGrid`, `FeaturedCarousel`,
   `CollectionCarousel` y `FlashSales`. "Elegir" sigue llevando a la ficha
   (decidido: `AgregarRapido` llega con la ficha, paso 6: ✓ 2026-10-17). Las listas de deseos,
   `/regalar` y Fechas importantes cambian de tarjeta con su página.
5. **Secciones del builder**, página por página, con `RenderSecciones` (o
   `PaginaTienda`) + `respaldo`. Primero el inicio (INICIO.md), después
   `/tienda` con el catálogo (TIENDA.md). Comparar capturas antes y después.
   ✓ **El inicio** (2026-10-16): sus 10 tipos con `SeccionDelKit` dentro del
   mismo bucle de `TiendaPage` (carga diferida, editor, mapa de calor y
   secciones que no se dibujan siguen como estaban), solo con `pageId ===
   'home'` (lista `TIPOS_DEL_KIT`). Las tarjetas de los carruseles son
   `TarjetaDeProducto` (prop `tarjeta`).
   ✓ **`/tienda` y las páginas de marca** (2026-10-16): se suman `header`,
   `marquee`, `sidebar_catalog`, `product_grid`, `hero_banner`,
   `categories_nav` y `category_carousel`. Las páginas: `PAGINAS_DEL_KIT`
   (`home`, `tienda`) más toda landing con marca que no sea del reloj
   (`esPaginaDeMarca`). El catálogo guarda su estado en `TiendaPage`
   (TIENDA.md); `landing-mobile.css` ya no pisa los títulos del kit.
   ✓ **El resto** (2026-10-17): todas las páginas del builder van con el
   kit salvo las del cacherito (`esDelCacherito`: el slug del reloj o una
   sección `conversion_fold` / `landing_payment`), y se suman
   `featured_products`, `collection_carousel`, `flash_sales`, `text`,
   `image`, `video`, `bestsellers_row`, `feature_list` y `map_location`.
   La lista está en `pages/Tienda/services/seccionesDelKit.js` (la usa
   también el arranque, para no bajar el código viejo). Las landings sin
   marca toman el fondo de la tienda (`landing-store-page`). De paso, lo
   que llega del builder (anuncios, diapositivas, insignias, testimonios,
   preguntas…) volvió a pasar por la traducción, que se había perdido en el
   inicio. Queda para después: las landings de marca con `PaginaMarca`
   (identidad + plantilla) cuando el admin de marcas guarde `identidad`
   (NAVEGAR.md).
6. **Páginas propias** (no son del builder): la ficha de producto
   (`PaginaProducto`, PRODUCTO.md; `onVariante` lleva `recordVariantViewTime`
   y `onPagarCarrito` el `selectAllItems`), el carrito (`PaginaCarrito`, CARRITO.md), el checkout
   (`PaginaCheckout`, CHECKOUT.md), regalar y el pago rápido (REGALAR.md; el pago rápido primero:
   usa las piezas de pago que después van al checkout),
   la cuenta (`MarcoCuenta` y sus 12 páginas, Mis pedidos incluida:
   CUENTA.md, un módulo a la vez), la Zona Arcade (`PaginaMinijuegos`,
   MINIJUEGOS.md), la búsqueda (`PaginaBusqueda`, BUSCAR.md) y la encuesta
   (`PaginaEncuesta`, ENCUESTA.md; después de Fechas importantes: comparten
   `HojaPersona`) y el acceso (login, registro, recuperar y completar
   perfil: ACCESO.md; chicas y aisladas, buenas para empezar) y Crear
   (`PaginaCrear`, CREAR.md; después de Mis creaciones: comparten
   `TarjetaCreacion`) y las legales (privacidad y
   términos con `PaginaLegal`, el libro con `PaginaReclamaciones`:
   LEGALES.md; chicas y aisladas) y los juegos por dentro (las bolitas, la
   ruleta y la palabra con `MarcoJuego`: JUEGOS.md; después de la Zona Arcade)
   y las campañas (el aviso de la invitación primero, luego Link en bio, las
   landings y los sorteos: CAMPANAS.md) y las generales (no encontrada y
   descargar la app, GENERALES.md; chicas, pero no encontrada cambia a dónde
   van las landings que no existen: revisarlas antes).
   ✓ **La ficha de producto** (2026-10-17): `FichaDeProducto` con el kit, y
   "Agregar rápido" en todas las tarjetas. Lo de abajo (opiniones y
   relacionados) se pide al acercarse y las fotos bajan en su tamaño
   (PRODUCTO.md, "En la tienda"). Interruptor `fichaVieja`.
   ✓ **El carrito** (2026-10-17): `CarritoDeTienda` con el kit; el catálogo
   se lee una vez por cambio, los combos no piden sus prendas y "También te
   puede gustar" se pide al acercarse (CARRITO.md, "En la tienda").
   Interruptor `carritoViejo` para toda la página.
   ✓ **El pago rápido** (2026-10-17, antes que el checkout: estrena las
   piezas de pago): `PagoRapidoDeTienda`, `PagoTarjeta` controlado con la
   ventana de Culqi de siempre (`renderBoton`, sin ella nada cambia) y PayPal
   solo con sus botones (REGALAR.md, "Pago rápido en la tienda").
   Interruptor `pagosViejo`.
   ✓ **El checkout** (2026-10-17): `CheckoutDeTienda`; el armado del pedido
   en `services/pedidoCheckout.js` (sacado tal cual, lo usan las dos
   páginas), las reglas de dirección de la tienda (`reglas="checkout"`) y el
   paquete de 43,5 a 28,4 KB gzip (CHECKOUT.md, "En la tienda"). Interruptor
   `pagosViejo`.
   ✓ **La lista pública** (2026-10-17): `ListaPublicaDeTienda`; ya no baja el
   catálogo entero, las tarjetas se ven al tiro con lo que guardó la lista y
   cada producto llega solo, con la caché de la ficha (REGALAR.md, "La lista
   pública en la tienda"). Interruptor `regalarViejo`.
   ✓ **Regalar para una fecha** (2026-10-17): `RegalarDeTienda`; se toca la
   fecha y "Regalar esto" (sin el arrastre), el registro con la caché de la
   lista pública y los productos uno por uno (REGALAR.md, "Regalar para una
   fecha en la tienda"). Interruptor `regalarViejo`.
   ✓ **Abrir el regalo** (2026-10-17): `RegaloSorpresaDeTienda`; "Descargar
   Walá" sin recargar y un solo Kapi (REGALAR.md, "Abrir el regalo en la
   tienda"). Interruptor `regalarViejo`.
   ✓ **La cuenta: el marco, el resumen y los ajustes** (2026-10-17): pasos 1
   y 2 de CUENTA.md; las demás secciones siguen con su diseño dentro del
   marco nuevo y migran una por una (CUENTA.md, "El marco, el resumen y los
   ajustes en la tienda"). Interruptor `cuentaVieja`.
   ✓ **Mi perfil y Mis direcciones** (2026-10-17): paso 3 de CUENTA.md, con
   los mismos campos guardados, la foto recortada en el kit, la libreta que no
   se pisa si no se pudo leer y el distrito del lugar (CUENTA.md, "Mi perfil y
   Mis direcciones en la tienda"). Interruptor `cuentaVieja`.
   ✓ **Catálogo, Mis cupones y Misiones** (2026-10-17): paso 4 de CUENTA.md;
   el catálogo en caché, check-in y misiones a la vez, los niveles desde
   `constants/tiers.js` (CUENTA.md, "Catálogo, Cupones y Misiones en la
   tienda"). Interruptor `cuentaVieja`.
   ✓ **Mis referidos** (2026-10-19): paso 5 de CUENTA.md; los mismos grupos y
   estados, lo que faltaba en el kit (privacidad, anulado, anónimo, monedas
   desde el botón), el link con `https://wala.pe` en la app y los pedidos solo
   de lo que falta reclamar (CUENTA.md, "Mis referidos en la tienda").
   Interruptor `cuentaVieja`.
   ✓ **Lista de deseos** (2026-10-19): paso 6 de CUENTA.md; la tarjeta de la
   tienda, solo los productos de la lista, el link con `https://wala.pe` en
   la app y el consejo del cumpleaños también con la lista vacía (CUENTA.md,
   "Lista de deseos en la tienda"). Interruptor `cuentaVieja`.
   ✓ **Fechas importantes** (2026-10-19): paso 6 de CUENTA.md; guardar sin
   perder lo de la encuesta ni los gustos apagados, varios paquetes por
   persona, Agregar rápido para lo que pide talla, fotos chicas y los días
   de aviso del admin (CUENTA.md, "Fechas importantes en la tienda").
   Interruptor `cuentaVieja`.
   ✓ **Mis creaciones** (2026-10-19): paso 6 de CUENTA.md; "Comprado" de
   `enPedido`, eliminar con una sola confirmación y los textos reales,
   combos, borradores y diseños de antes, versiones anteriores, la vuelta
   del estudio y las creaciones en caché (CUENTA.md, "Mis creaciones en la
   tienda"). Interruptor `cuentaVieja`.
7. **Cargando** (`PantallaCarga`, `Cargando`, `EsqueletoPagina`: CARGA.md; el
   splash de `index.html` cambia en el mismo commit), **`BarraInferior` y luego `Cabecera`**: la más conectada (AuthContext,
   CartContext, WishlistContext, notificaciones y la configuración de
   Firestore).
8. **Editor del kit** (`PanelEditor`) en lugar de `VisualEditorPanel`.

## Interruptores (volver a lo de antes sin publicar)

Para lo delicado (pagos, carrito, checkout): `useLoViejo(nombre)`
(`src/hooks/useLoViejo.js`). Se encienden para todos con un admin en
Firestore, `configuracion/kit_interruptores` → `<nombre>Viejo: true` (las
reglas ya permiten leerlo y solo el admin lo escribe; no hay que desplegar
nada), o en un solo navegador con `localStorage.wala_kit_viejo = "pagos,carrito"`.

| Interruptor | Qué vuelve a lo de antes |
|---|---|
| `pagosViejo` | la ventana "Pagar saldo" de Mis pedidos (`Modal` viejo), la pantalla de Culqi mientras cobra, el pago rápido entero (`PagoRapidoViejo.jsx`) y el checkout entero (`CheckoutViejo.jsx`) |
| `cuentaVieja` (`useLoViejo('cuenta')`: en Firestore el campo es `cuentaViejo: true`; en localStorage, `"cuenta"`) | la cuenta: el marco (`CuentaLayoutViejo.jsx`), el resumen (`CuentaResumenViejo.jsx`) y los ajustes (`CuentaAjustesViejo.jsx`), Mi perfil (`PerfilViejo.jsx`), Mis direcciones (`MisDireccionesViejo.jsx`), el catálogo (`CatalogRewardViejo.jsx`), Mis cupones (`MisCuponesViejo.jsx`), Misiones (`MisionesViejo.jsx`), Mis referidos (`CuentaReferidosViejo.jsx`) la lista de deseos (`WishlistViejo.jsx`) Fechas importantes (`CuentaFechasImportantesViejo.jsx`) y Mis creaciones (`MisCreacionesViejo.jsx`); después, cada sección que migre |
| `carritoViejo` | todo el carrito (`Cart.jsx` y `CartItem.jsx`, con sus preguntas por `window.confirm`) |
| `regalarViejo` | regalarle a alguien: su lista de deseos (`WishlistPublicViejo.jsx`), regalar para una fecha (`GiftRegistryPageViejo.jsx`, con el arrastre) y abrir el regalo (`GiftExperienceViejo.jsx`) |
| `tarjetasViejo` | la tarjeta de producto (`PremiumProductCard`) en carruseles y grillas |
| `fichaVieja` (`useLoViejo('ficha')`: en Firestore el campo es `fichaViejo: true`; en localStorage, `"ficha"`) | la ficha de producto (`ProductDetail` y `ProductReviews`) y que "Elegir" de las tarjetas lleve a la ficha en vez de abrir "Agregar rápido" |
| `seccionesViejo` | las secciones del builder de todas las páginas (inicio, `/tienda`, marcas y landings; el cacherito nunca dejó lo de antes): los componentes de `seccionesPorTipo.jsx`, con `SidebarCatalogLayout`, y el fondo negro en las landings sin marca |

Se retiran cuando lo nuevo lleve un tiempo en producción (y con ellos lo viejo
de [ELIMINAR.md](ELIMINAR.md)).

## Volver atrás

Cada paso en su propio commit, y el componente viejo no se borra hasta que el
nuevo lleve un tiempo en producción: revertir el commit devuelve la tienda
como estaba. Lo que cambió dentro de un archivo viejo (la píldora de
`Header.jsx`, el pie legal de `Footer.jsx`) queda detrás de una constante:
en `false` vuelve lo de antes sin revertir nada.
