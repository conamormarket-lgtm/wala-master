# Llevar el kit a la tienda (en marcha: pasos 1 a 4 hechos; el 5, en el inicio)

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
| `PieLegal` (`pieLegalDesdeEmpresa`) dentro del pie viejo; las columnas y su editor siguen igual. El bloque viejo queda apagado con `PIE_LEGAL_EN_EL_KIT` | `components/common/Footer/Footer.jsx` |
| La píldora "Gana 15 monedas" de la cabecera vieja, apagada con `PILDORA_EN_EL_KIT` (la dibuja `FlotantesDeLaTienda`) | `components/common/Header/Header.jsx` |

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
   (decidido: `AgregarRapido` llega con la ficha, paso 6). Las listas de deseos,
   `/regalar` y Fechas importantes cambian de tarjeta con su página.
5. **Secciones del builder**, página por página, con `RenderSecciones` (o
   `PaginaTienda`) + `respaldo`. Primero el inicio (INICIO.md), después
   `/tienda` con el catálogo (TIENDA.md). Comparar capturas antes y después.
   ✓ **El inicio** (2026-10-16): sus 10 tipos con `SeccionDelKit` dentro del
   mismo bucle de `TiendaPage` (carga diferida, editor, mapa de calor y
   secciones que no se dibujan siguen como estaban), solo con `pageId ===
   'home'` (lista `TIPOS_DEL_KIT`). Las tarjetas de los carruseles son
   `TarjetaDeProducto` (prop `tarjeta`). Falta: `/tienda`, las marcas y las
   landings (agregar sus tipos a la lista y quitar la condición del inicio).
   Las landings de marca, con `PaginaMarca` (identidad + plantilla) cuando
   el admin de marcas guarde `identidad` (NAVEGAR.md).
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
| `pagosViejo` | la ventana "Pagar saldo" de Mis pedidos (`Modal` viejo) y la pantalla de Culqi mientras cobra |
| `carritoViejo` | las preguntas del carrito (quitar seleccionados, vaciar) con `window.confirm` |
| `tarjetasViejo` | la tarjeta de producto (`PremiumProductCard`) en carruseles y grillas |
| `seccionesViejo` | las secciones del builder del inicio (los componentes de `seccionesPorTipo.jsx`) |

Se retiran cuando lo nuevo lleve un tiempo en producción (y con ellos lo viejo
de [ELIMINAR.md](ELIMINAR.md)).

## Volver atrás

Cada paso en su propio commit, y el componente viejo no se borra hasta que el
nuevo lleve un tiempo en producción: revertir el commit devuelve la tienda
como estaba. Lo que cambió dentro de un archivo viejo (la píldora de
`Header.jsx`, el pie legal de `Footer.jsx`) queda detrás de una constante:
en `false` vuelve lo de antes sin revertir nada.
