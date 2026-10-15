# Regalar y pagar: la lista de otra persona, sus fechas, el regalo y el pago rápido

Cómo verlo en vivo: `npm run dev` → http://localhost:3000/componentes.html →
**Páginas** → **Tienda de prueba**:

- **Regalar**, con "Cómo se abre":
  - su lista de deseos (`/wishlist/:código`);
  - regalar para una fecha (`/regalar/:código`);
  - abrir el regalo (`/regalo/:pedido`).

  Estados: cargando, no encontrada, lista vacía, sin fechas y abierto en la
  app. "Regalar esto" pone el regalo en el carrito de la demo y lleva al
  carrito.
- **Pago rápido** (`/pago-rapido/:id`): en soles con tarjeta o en dólares
  con PayPal. Estados: ya pagado, vencido, no encontrado, el pago falla y
  cargando.

| Regalar para una fecha | Su lista (celular) | El regalo y el pago rápido (celular) |
|---|---|---|
| ![Las fechas especiales y la lista](regalar-fecha.webp) | ![La lista de deseos de otra persona](regalar-lista.webp) | ![El sobre abierto y el pago rápido](regalo-y-pago-rapido.webp) |

Revisado el 2026-10-15 contra estos archivos:

| Página | Archivo | Líneas |
|---|---|---|
| Su lista de deseos | `pages/WishlistPublic/WishlistPublic.jsx` | 242 |
| Regalar para una fecha | `pages/GiftRegistry/GiftRegistryPage.jsx` | 934 (+908 de CSS) |
| Abrir el regalo | `pages/GiftExperiencePage.jsx` | 136 |
| Pago rápido | `pages/PagoRapidoPage.jsx` | 128 |
| Tarjeta | `CulqiCustomCheckout` | 401 |
| PayPal | `PaypalCheckout` y `PaypalEnlaceCheckout` | 180 y 100 |

Los productos de la demo son reales; la persona (Isaac) y sus fechas son de
ejemplo.

## Partes

| Parte | Componente | Piezas que usa | Datos (en la tienda) |
|---|---|---|---|
| P15 Su lista | `PaginaListaPublica` | `TarjetaRegalo` (pieza nueva: `TarjetaProducto sinAccion` + "Regalar esto"), `Sello`, `Trazo`, `EstadoVacio` | `getWishlistByUserCode`, `getPublicGiftRegistry` (el nombre), `useProducts` |
| P15 Regalar para una fecha | `PaginaRegalar` | `FechaEntrega` (pieza nueva: `Avatar`, `HojaCalendario`, `Etiqueta`), `PasoEstudio`, `TarjetaRegalo` | `getPublicGiftRegistry` (fechas y lista), `proximaOcurrencia` |
| P15 Abrir el regalo | `PaginaRegaloSorpresa` | `SobreRegalo` (pieza nueva: Kapi 3D, el sticker en un `Sello`) | `getOrderGiftDetails` |
| P16 Pago rápido | `PaginaPagoRapido` | `PagoTarjeta`, `PagoPaypal` (piezas nuevas), `LogoWala`, `EstadoVacio` | `enlaces_pago/{id}` |
| Pagar (también en el checkout) | `PagoTarjeta`, `PagoPaypal` | `Boton`, `Aviso`, `CapaCargando` | Culqi Checkout v4, el SDK de PayPal |

### Lo que hace

- **Su lista:**
  - "La lista de deseos de Isaac" con el sello del regalo y su trazo.
  - "Elegir el día de entrega" lleva a sus fechas.
  - Cada producto es la tarjeta de la tienda con **"Regalar esto"** debajo,
    siempre a la vista. El ya regalado lleva su sello y no se puede volver a
    regalar. El que salió de la tienda muestra la foto que se guardó, en gris.
- **Regalar para una fecha:**
  - **1. Elige el día de entrega:** cada fecha con la foto o inicial, la
    relación, la ocasión, la hoja de calendario de la próxima vez que cae, "En
    9 días" y sus fechas festivas. Es un grupo de radios.
  - **2. Elige el regalo:** "Regalar esto" lo agrega con esa fecha, y abajo
    dice "Se entrega el 24 de octubre (Cumpleaños) a Isaac".
  - Sin fechas: el aviso, y se regala igual.
- **Abrir el regalo:** el sobre cerrado ("Para María · Toca para abrir"),
  y al abrirlo Kapi con el sticker y el mensaje. Debajo, "Descargar Walá" (en
  la web) o "Ver la tienda" (en la app).
- **Pago rápido:**
  - El logo, "Pago rápido", el concepto, el total y cuándo vence.
  - En soles, `PagoTarjeta`; en dólares, `PagoPaypal`.
  - Pagado: Kapi feliz, "¡Pago recibido!" y el número de operación.
  - Vencido o no encontrado: Kapi triste y "Escribir al asesor".
- **`PagoTarjeta`:**
  - "Pagar S/ x" abre la ventana de Culqi.
  - Mientras cobra, "Confirmando tu pago" a pantalla completa.
  - El error sale debajo, y bajo el mínimo (S/ 3 o US$ 1), el aviso de
    coordinar por WhatsApp.
- **`PagoPaypal`:**
  - "Pagarás US$ x (≈ …)" y los botones del SDK (`botones`); en la demo, un
    botón.
  - Mientras captura, "Procesando el pago… No cierres esta ventana".
  - El error sale debajo, y bajo US$ 1, el aviso.

## Llevar a la tienda (a futuro: TODAVÍA NO se hace)

### Reemplazos

| Hoy | Pasa a (kit) |
|---|---|
| `WishlistPublic` con `PremiumProductCard` y "Regalar esto" | `PaginaListaPublica` + `TarjetaRegalo` |
| `GiftRegistryPage` (fechas arrastrables, `GiftProductCard`) | `PaginaRegalar` + `FechaEntrega` + `TarjetaRegalo` |
| `GiftExperiencePage` (Kapi en CSS, emojis) | `PaginaRegaloSorpresa` + `SobreRegalo` |
| `PagoRapidoPage` (estilos en línea) | `PaginaPagoRapido` |
| El botón y la nota de `CulqiCustomCheckout`; la caja de `PaypalCheckout` | `PagoTarjeta`, `PagoPaypal` |

**Lo que no cambia:** la ventana de Culqi (`culqiSingleton`,
`processCulqiPayment`), los botones del SDK de PayPal (van en `botones`), el
vigía del modal cerrado y el anti doble cobro.

### De dónde sale cada dato

- **`items`:** los de la lista cruzados con `useProducts`
  (`tarjetaDesdeProducto`). `regalado` sale de `isGifted`. `disponible` es
  falso si el producto no existe, si está oculto o si está borrado.
- **`fechas`:** `dates` de `getPublicGiftRegistry`, con `proximaOcurrencia`.
  `festivas` sale de `getGlobalDates(roleKey, gender)`.
- **`onRegalar({ item, fecha })`:** `addToCart` con `isWishlistGift`,
  `wishlistUserCode` y, si hay fecha, `deliveryDate`, `deliveryEventLabel` y
  `deliveryRecipient`; luego, el carrito. El checkout ya lee esos datos (ver
  CHECKOUT.md, `entrega`).
- **Pago rápido:** `enlaces_pago/{id}`. Vence según `expiresAt`, o a las 36 h
  si es un enlace viejo. `pagado` sale de `estado === 'pagado'`.

### Comportamiento que no se puede perder

- `notifyWishlistVisitSecure` (avisarle al dueño que alguien vio su lista).
- `markItemAsGifted` al pagar (lo hace el checkout).
- El código va en mayúsculas al carrito.

### Diferencias a propósito (no "corregirlas" al migrar)

- **Regalar para una fecha:** se toca la fecha y luego "Regalar esto". La
  tienda también deja arrastrar varios productos sobre una fecha y
  mandarlos juntos. Tocar funciona igual con el dedo, y un regalo a la vez es
  lo común.
- Sin emojis (🎁, 🎉, 📅, ⚠️, ✅).
- Los textos de no encontrado dicen qué hacer, y el pago rápido vencido lleva
  a escribirle al asesor.

### Pagar pide una cuenta (2026-10-15)

El enlace se ve sin sesión, pero para pagar hace falta entrar: "Para pagar
necesitas tu cuenta", "Inicia sesión para pagar" y "Crear mi cuenta" (prop
`sesion` de `PaginaPagoRapido`). Al entrar, vuelve al enlace.

La tienda ya lo hace así en `PagoRapidoPage`. Hoy se probó primero con una
sesión anónima justo antes de cobrar (commit 7ec335d), pero se quitó:
pagar pide cuenta, como en el checkout, y no se suma otro uso del login
anónimo.

### Pasos

1. `PaginaPagoRapido` primero: es chica y usa las piezas de pago.
2. La lista pública.
3. Regalar para una fecha (decidir si se mantiene el arrastre).
4. Abrir el regalo.
5. Cambiar el botón de Culqi y la caja de PayPal del checkout y del saldo de
   un pedido por `PagoTarjeta` y `PagoPaypal`.
