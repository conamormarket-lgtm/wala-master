# Llevar el kit a la tienda (a futuro: TODAVÍA NO se hace)

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
| `ProveedorToasts`: `ToastProvider` es un puente, así que todos los `useGlobalToast()` ya muestran los toasts del kit | `src/contexts/ToastContext.jsx` |
| `Boton` en carrito y checkout (el verde de WhatsApp y "Aplicar" del cupón siguen igual) | `pages/CartPage.jsx`, `pages/CheckoutPage.jsx`, `pages/Tienda/components/Cart/Cart.jsx` |
| Monedas que vuelan (`showFlyingCoins` / `volarMonedasGanadas`): en arco, girando, con "+N" y el saldo que late; mismos eventos para la cabecera | `src/utils/animations.js` (toda la tienda) |
| `IconoWala` y `Trazo` en referidos | `components/common/AvisoInvitacion/AvisoInvitacion.jsx`, `pages/cuenta/components/GrupoReferidos.jsx`, `pages/cuenta/CuentaReferidosPage.jsx` |

Cambiar `Boton`, `Feedback`, `Enlace`, `IconosWala` o `Marca` ya cambia la
tienda real: revisar también esas pantallas. (`Feedback` usa `Efectos`:
`useCerrarConAtras` ahora cierra solo la hoja de encima cuando hay dos.) (`Marca.jsx` ahora también
exporta `Sello`; agregarlo no cambió nada de lo que ya usa la tienda.) `Feedback` usa
`piezas/FotoProducto` para la foto de los toasts, así que esa pieza (y el
token `--escenario-foto` de `tokens.css`) también está ya en la tienda.

## Orden

Cada paso en su propio commit, verificable por separado.

1. ✓ Proveedores y `Boton` (arriba). Falta `ProveedorTraduccion` en `App.jsx`, al lado de
   `ProveedorEnlaces`, con `useTranslatedText` y `useTranslatedHtml` (TRADUCCION.md). No cambia
   nada en español.
2. **Marco**: `BarraAdmin`, `AvisoSistema`, `BannerApp`, flotantes
   (`PilaFlotante` y compañía; Kapi con su ventana, KAPI.md), `PieLegal`,
   `VentanaCampana`, `AvisoIdioma`.
   Bajo riesgo: cada uno reemplaza a un componente y sirve en todas las
   páginas.
3. **Avisos y hojas**: `Aviso` y `HojaInferior` en lugar de los modales
   sueltos de la tienda.
4. **`TarjetaProducto`** en carruseles y grillas, con `tarjetaDesdeProducto`
   (antes, lo que le falta: la impresión; el favorito ya se controla con
   `deseado` + `onDeseo`; ver INICIO.md).
5. **Secciones del builder**, página por página, con `RenderSecciones` (o
   `PaginaTienda`) + `respaldo`. Primero el inicio (INICIO.md), después
   `/tienda` con el catálogo (TIENDA.md). Comparar capturas antes y después.
6. **Páginas propias** (no son del builder): la ficha de producto
   (`PaginaProducto`, PRODUCTO.md), el carrito (`PaginaCarrito`, CARRITO.md), el checkout
   (`PaginaCheckout`, CHECKOUT.md), regalar y el pago rápido (REGALAR.md; el pago rápido primero:
   usa las piezas de pago que después van al checkout),
   la cuenta (`MarcoCuenta` y sus 12 páginas, Mis pedidos incluida:
   CUENTA.md, un módulo a la vez), la Zona Arcade (`PaginaMinijuegos`,
   MINIJUEGOS.md), la búsqueda (`PaginaBusqueda`, BUSCAR.md) y la encuesta
   (`PaginaEncuesta`, ENCUESTA.md; después de Fechas importantes: comparten
   `HojaPersona`) y el acceso (login, registro, recuperar y completar
   perfil: ACCESO.md; chicas y aisladas, buenas para empezar) y Crear
   (`PaginaCrear`, CREAR.md; después de Mis creaciones: comparten
   `TarjetaCreacion`).
7. **Cargando** (`PantallaCarga`, `Cargando`, `EsqueletoPagina`: CARGA.md; el
   splash de `index.html` cambia en el mismo commit), **`BarraInferior` y luego `Cabecera`**: la más conectada (AuthContext,
   CartContext, WishlistContext, notificaciones y la configuración de
   Firestore).
8. **Editor del kit** (`PanelEditor`) en lugar de `VisualEditorPanel`.

## Volver atrás

Cada paso en su propio commit, y el componente viejo no se borra hasta que el
nuevo lleve un tiempo en producción: revertir el commit devuelve la tienda
como estaba.
