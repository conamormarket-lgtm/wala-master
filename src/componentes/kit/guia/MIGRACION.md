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
| `IconoWala` y `Trazo` en referidos | `components/common/AvisoInvitacion/AvisoInvitacion.jsx`, `pages/cuenta/components/GrupoReferidos.jsx`, `pages/cuenta/CuentaReferidosPage.jsx` |

Cambiar `Boton`, `Feedback`, `Enlace`, `IconosWala` o `Marca` ya cambia la
tienda real: revisar también esas pantallas. `Feedback` usa
`piezas/FotoProducto` para la foto de los toasts, así que esa pieza (y el
token `--escenario-foto` de `tokens.css`) también está ya en la tienda.

## Orden

Cada paso en su propio commit, verificable por separado.

1. ✓ Proveedores y `Boton` (arriba).
2. **Marco**: `BarraAdmin`, `AvisoSistema`, `BannerApp`, flotantes
   (`PilaFlotante` y compañía), `PieLegal`, `VentanaCampana`, `AvisoIdioma`.
   Bajo riesgo: cada uno reemplaza a un componente y sirve en todas las
   páginas.
3. **Avisos y hojas**: `Aviso` y `HojaInferior` en lugar de los modales
   sueltos de la tienda.
4. **`TarjetaProducto`** en carruseles y grillas, con `tarjetaDesdeProducto`
   (antes, lo que le falta: favorito controlado e impresión; ver INICIO.md).
5. **Secciones del builder**, página por página, con `RenderSecciones` (o
   `PaginaTienda`) + `respaldo`. Primero el inicio (INICIO.md), después
   `/tienda` con el catálogo (TIENDA.md). Comparar capturas antes y después.
6. **Carrito, checkout y Mis pedidos** (`PaginaCarrito`, `PaginaPedidos` y las
   piezas de `Pedido.jsx`). Sus fichas (P1, P2) todavía faltan.
7. **`BarraInferior` y luego `Cabecera`**: la más conectada (AuthContext,
   CartContext, WishlistContext, notificaciones y la configuración de
   Firestore).
8. **Editor del kit** (`PanelEditor`) en lugar de `VisualEditorPanel`.

## Volver atrás

Cada paso en su propio commit, y el componente viejo no se borra hasta que el
nuevo lleve un tiempo en producción: revertir el commit devuelve la tienda
como estaba.
