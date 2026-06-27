<!-- Generado 2026-06-27. Estado: DESPLEGADO Y FUNCIONANDO (con bug corregido pendiente de redeploy de la CF; drag-and-drop ✅ HECHO y rediseñado). Plan de los features "Mis fechas especiales" + "Agregar todo al carrito" para la wishlist. El estado REAL del código está documentado al final, en la sección "ESTADO Y FUNCIONAMIENTO — Registro de regalos por fecha (/regalar)". -->

# Plan — "Mis fechas especiales" + "Agregar todo al carrito"

## 1. Resumen y objetivos

Agregar dos botones en la cabecera de `/cuenta/wishlist` (`src/pages/cuenta/WishlistPage.jsx`, fila `headerRow`, líneas 42-53), al lado de "Compartir mi lista":

- **Feature A — "Agregar todo al carrito"**: agrega de un golpe todos los productos NO regalados de la wishlist personal del usuario logueado a su propio carrito. Es un atajo de compra para uno mismo (no es modo regalo).
- **Feature B — "Mis fechas especiales"**: copia/abre una URL pública (tipo `/regalar/:referralCode`) que funciona como **registro de regalos por fecha**. Quien la abre ve las fechas especiales del dueño (de la encuesta/perfil) + su wishlist, elige una fecha de entrega y un regalo, y compra. El pedido viaja al checkout en Modo Regalo con `deliveryDate` y el dueño como destinatario.

Principio rector: **reutilizar lo existente** — el patrón `isWishlistGift` + `wishlistUserCode` (ya en `WishlistPublic.jsx` y consumido en `CheckoutPage.jsx`), el `giftMode` del checkout, el `referralCode` del perfil, y `getWishlistByUserCode()` / `markItemAsGifted()` de `src/services/wishlist.js`. Feature B es esencialmente `WishlistPublic` + una capa de selección de fecha.

Estado objetivo: ✅ Feature A (bajo riesgo, solo frontend). 🔧 Feature B (frontend + 1 campo nuevo en checkout/pedido; Cloud Function opcional en fase 2).

---

## 2. Feature A — Agregar todo al carrito

### Flujo
1. Usuario en `/cuenta/wishlist` pulsa "Agregar todo al carrito".
2. Se filtran los `wishlistItems` con `isGifted !== true` (no tiene sentido recomprar lo ya regalado; ofrecer toggle "incluir regalados" como mejora futura).
3. Para cada item, se resuelve el producto completo (con precio) y se llama `addToCart`.
4. Toast de resumen: "N productos agregados al carrito" (+ aviso si alguno se omitió).

### Cómo obtener el precio
`WishlistPage.jsx` ya carga **todos** los productos vía `useProducts([])` (línea 12, `allProducts`) y hace `allProducts.find(p => p.id === item.productId)` para renderizar cada `ProductCard` (línea 78). **Ese mismo `fullProduct` ya trae `price`/`salePrice`/`mainImage`**, así que NO hace falta llamar `getProduct()` por item: reutilizar `allProducts` evita N lecturas a Firestore.

- Fuente del precio: `fullProduct.salePrice || fullProduct.price` (mismo criterio que `WishlistPublic.jsx` línea 77).
- Fallback defensivo: si por timing `allProducts` no contiene el item (producto recién agregado / paginación), llamar `getProduct(item.productId)` de `src/services/products.js` (línea 276, retorna `{data, error}`) solo para esos casos.

### El bucle de addToCart
Firma real (`src/contexts/CartContext.jsx`): `addToCart(product, variant={}, customization=null, quantity=1, comboData=null)`. El `product` necesita `id`, `name`, `price`, `mainImage`.

```js
const handleAddAll = async () => {
  setAddingAll(true);
  const pending = wishlistItems.filter(i => !i.isGifted);
  let added = 0, skipped = 0;

  for (const item of pending) {
    let p = allProducts?.find(fp => fp.id === item.productId);
    if (!p) {
      const { data } = await getProduct(item.productId); // fallback solo si falta
      p = data;
    }
    if (!p) { skipped++; continue; }            // producto borrado
    if (p.stock === 0 || p.isActive === false) { skipped++; continue; } // sin stock
    addToCart(
      { id: p.id, name: p.name, price: p.salePrice || p.price, mainImage: p.mainImage },
      {}, null, 1
    );
    added++;
  }

  setAddingAll(false);
  addToast(
    skipped
      ? `${added} productos agregados. ${skipped} omitidos (sin stock o no disponibles).`
      : `${added} productos agregados al carrito 🛒`,
    added ? 'success' : 'info'
  );
};
```

> Importante: NO se ponen los flags `isWishlistGift`/`wishlistUserCode`. Feature A es compra para uno mismo, no regalo. Esos flags son exclusivos de Feature B / WishlistPublic.

### Manejo de duplicados
Verificar el comportamiento de `addToCart` en `CartContext.jsx` ante un `id` ya presente:
- Si **incrementa cantidad**: pulsar dos veces duplica cantidades. Mitigar deshabilitando el botón mientras corre (`addingAll`) y, opcionalmente, saltando items cuyo `id` ya esté en el carrito (`cartItems.some(ci => ci.productId === p.id)`).
- Si **ignora duplicados**: no hay problema; documentar la decisión.

### UX del botón
- Ubicación: dentro de `headerRow` (líneas 42-53), agrupar ambos botones nuevos + el de compartir en un contenedor flex (`gap`), botón secundario para no competir con el CTA de compartir.
- Estados: `disabled` + texto "Agregando…" mientras `addingAll === true`; ocultar si `wishlistItems.length === 0` (igual que el botón de compartir).
- Opcional: tras terminar, ofrecer toast/acción "Ir al carrito" (navegar a `/carrito`).

### Edge cases
- Lista vacía → botón oculto.
- Todos regalados → toast "No hay productos disponibles para agregar".
- Producto borrado del catálogo (`fullProduct` undefined) → omitir + contar en `skipped` (ya se omite en el render, línea 80-82).
- Sin stock / inactivo → omitir.
- Variantes obligatorias: si un producto requiere elegir talla/color, el `addToCart` con `variant={}` puede crear un item inválido. Decisión: para v1 agregar con variante por defecto/base; si el catálogo tiene productos con variante obligatoria, marcar esos como `skipped` y avisar "Tiene opciones, agrégalo desde su ficha".

### Archivos a editar (Feature A)
- `src/pages/cuenta/WishlistPage.jsx` — único archivo. Importar `useCart` (`../../contexts/CartContext`) y `getProduct` (`../../services/products`); añadir estado `addingAll`, función `handleAddAll`, y el botón en `headerRow`.
- (Opcional) `src/pages/cuenta/WishlistPage.module.css` — estilo `secondaryBtn` y contenedor de botones.

---

## 3. Feature B — Mis fechas especiales (registro de regalos por fecha)

### 3.1 Modelo de datos (de dónde salen las fechas)
Fuente de verdad confirmada: colección **`portal_clientes_users`**, documento del dueño, campo **`giftRecipients[]`** (guardado por `SubscriptionSurveyPage.jsx` líneas 269-294 vía `updateUserProfile`; editable en `CuentaFechasImportantesPage.jsx`).

Estructura:
```
giftRecipients: [
  { id, roleKey, roleDisplay, name, gender,
    events: [ { id, type: 'Cumpleaños'|'Aniversario'|'Fecha Especial', date: 'YYYY-MM-DD', customName } ] }
]
```

Para esta feature, **el dueño es regalado a sí mismo**: el registro muestra las fechas del propio usuario (las de su perfil). El comprador externo elige una de esas fechas como **fecha de entrega**. Para v1 mostrar las fechas del recipient que sea el propio dueño (o todas, agrupadas por recipient, dejando que el comprador elija a quién/cuándo — decisión abierta, ver §6).

Reutilizable: `getUserDates()` en `src/services/fechasImportantes.js` (líneas 34-71) ya aplana `giftRecipients[].events[]` a `{recipientName, eventType, eventDate, ...}` pero requiere conocer al usuario. Para la ruta pública conviene una función nueva por `referralCode` (ver §3.3).

### 3.2 La URL pública compartible
Ruta nueva (no existe hoy): **`/regalar/:referralCode`** (alternativa `/fechas/:code` o `/gift-registry/:code`; recomiendo `/regalar/:referralCode` por claridad en español).

- Registrar en `src/App.jsx` junto a `/wishlist/:userCode` (línea 259).
- `referralCode` = `userProfile.referralCode` (formato `KS-XXXXXX`), el mismo que usa la wishlist pública. Así un solo código sirve para ambas vistas.

### 3.3 La página pública — `GiftRegistryPage`
Nuevo componente `src/pages/GiftRegistry/GiftRegistryPage.jsx` (+ `.module.css`). Estructura, modelada sobre `WishlistPublic.jsx`:

1. **Cargar dueño + datos**:
   - Wishlist del dueño: `getWishlistByUserCode(referralCode)` → `data.userId`, `data.items`.
   - Perfil del dueño: `getDoc(doc(db, 'portal_clientes_users', data.userId))` (mismo patrón que `WishlistPublic.jsx` líneas 40-49) para leer `displayName`/`name` y `giftRecipients`.
   - Aplanar `giftRecipients[].events[]` a una lista de fechas seleccionables `{ eventId, label, date }` con label tipo `"14/02 — Cumpleaños de Juan"` (usar `customName` si existe).
2. **UI**:
   - Cabecera: "Regálale a {ownerName} en su fecha especial".
   - **Selector de fecha de entrega**: lista/cards de las fechas especiales del dueño (radio buttons o chips). Filtrar fechas pasadas del año en curso o normalizar al próximo aniversario (decisión §6). El checkout ya avisa 7-30 días hábiles (`CheckoutPage.jsx` línea 638), así que advertir si la fecha elegida está a menos de ~30 días.
   - **Wishlist del dueño**: grid de `ProductCard` (reutilizar el de `WishlistPublic`), con botón "Regalar esto 🎁" por producto, deshabilitado para `isGifted`.
3. **Acción "Regalar esto"** (extensión de `handleGift` de `WishlistPublic.jsx` líneas 75-92): exige que haya una fecha seleccionada; agrega al carrito el `productMock` con flags extendidos:

```js
const productMock = {
  id: fullProduct.id,
  name: fullProduct.name,
  mainImage: fullProduct.mainImage,
  price: fullProduct.salePrice || fullProduct.price || 0,
  isWishlistGift: true,
  wishlistUserCode: referralCode,
  // NUEVO:
  deliveryDate: selectedEvent.date,        // 'YYYY-MM-DD'
  deliveryEventLabel: selectedEvent.label, // 'Cumpleaños de Juan'
  deliveryRecipient: ownerName             // dueño = destinatario
};
addToCart(productMock, {}, null, 1);
navigate('/carrito');
```

### 3.4 Propagación carrito → checkout
- `src/contexts/CartContext.jsx`: el `cartItem` (líneas 157-178) debe **conservar** los campos nuevos `deliveryDate`, `deliveryEventLabel`, `deliveryRecipient` cuando vengan en el producto (igual que ya hace falta que conserve `isWishlistGift`/`wishlistUserCode`). Añadirlos al objeto que se guarda en el item.

### 3.5 Integración con el Checkout (`src/pages/CheckoutPage.jsx`)
Reutilizar el **Modo Regalo** existente (`giftMode` Formik línea 182; campos `giftRecipientName`, `giftMessage`, `giftSticker`):
- Al detectar en el carrito items con `isWishlistGift` (ya se hace para `markItemAsGifted`, líneas 573-579): **preseleccionar `giftMode = true`** y `giftRecipientName = deliveryRecipient` (el dueño).
- Añadir al schema Formik (líneas 70-80) y al estado un campo **`deliveryDate`** (ISO), inicializado desde el item del carrito que lo traiga. Mostrarlo como solo-lectura ("Entrega programada para: {fecha}") cuando viene de `/regalar/:code`, o como `<input type="date">` opcional en flujo normal.
- Validación: si `deliveryDate` existe, debe ser ≥ hoy + ventana mínima (alinear con el aviso de 7-30 días, línea 638).
- Persistir en `giftDetails` del `webOrderPayload` (líneas 549-556), que hoy es `{isGift, recipientName, message, sticker}` → extender a:

```js
giftDetails: {
  isGift: true,
  recipientName: deliveryRecipient,
  message, sticker,
  deliveryDate,          // ISO — qué día entregar
  deliveryEventLabel,    // contexto humano
  wishlistUserCode       // dueño, para markItemAsGifted y notificación
}
```

- Tras crear el pedido, mantener la llamada existente `markItemAsGifted(wishlistUserCode, productId, buyerName)` (`src/services/wishlist.js` línea 101) para marcar el producto como regalado y notificar al dueño (ya envía notificación, líneas 117-130).

### 3.6 ¿Requiere Cloud Functions?
- **v1: NO.** Con persistir `deliveryDate` en el pedido basta — el ERP/operaciones procesa la fecha de entrega manualmente, y `markItemAsGifted` ya notifica al dueño. (El proyecto Firebase es único `sistema-gestion-3b225`, prod+ERP juntos.)
- **v2 (opcional):** una Cloud Function programada (scheduler) que, según `giftDetails.deliveryDate`, dispare recordatorio/preparación X días antes, o un trigger `onCreate` de la orden que valide la ventana de entrega. Va en `functions/` (verificar estructura antes de tocar). No bloquea v1.

### 3.7 Archivos a crear/editar (Feature B)
Crear:
- `src/pages/GiftRegistry/GiftRegistryPage.jsx`
- `src/pages/GiftRegistry/GiftRegistryPage.module.css`
- (opcional) en `src/services/wishlist.js` o `fechasImportantes.js`: `getGiftRegistryByCode(referralCode)` que combine wishlist + `giftRecipients` del dueño en una sola lectura coherente.

Editar:
- `src/App.jsx` (línea ~259) — ruta `/regalar/:referralCode`.
- `src/pages/cuenta/WishlistPage.jsx` — botón "Mis fechas especiales" en `headerRow` que copie/abra `${origin}/regalar/${userProfile.referralCode}` (clon de `handleCopyLink`, líneas 21-27).
- `src/contexts/CartContext.jsx` — conservar `deliveryDate`/`deliveryEventLabel`/`deliveryRecipient`/`isWishlistGift`/`wishlistUserCode` en el `cartItem`.
- `src/pages/CheckoutPage.jsx` — campo `deliveryDate`, preselección de `giftMode`, y `giftDetails` extendido en el payload.

---

## 4. Cambios en datos/colecciones (Firestore) y reglas

- **No** hace falta colección nueva. Se reutiliza:
  - `wishlists` (items + `isGifted`/`giftedBy`).
  - `portal_clientes_users.giftRecipients[].events[]` (fechas, solo lectura pública por `referralCode`).
- **Pedido**: el documento de orden gana sub-objeto `giftDetails.deliveryDate`, `deliveryEventLabel`, `wishlistUserCode`. Es aditivo, sin migración.
- **Reglas Firestore (crítico)**: la ruta pública `/regalar/:referralCode` debe **leer `giftRecipients` de un doc de `portal_clientes_users` ajeno** (el del dueño) sin estar autenticado como él. Hoy `WishlistPublic` ya lee `displayName`/`name` de ese doc, pero exponer `giftRecipients` (nombres y fechas de familiares) es **PII sensible** y conecta directo con el hallazgo de reglas abiertas (H-07/H-09, ver `docs/wala/PLAN-SEGURIDAD-REGLAS.md`). Opciones:
  1. **Recomendada**: una Cloud Function `getPublicGiftRegistry(referralCode)` que devuelva SOLO `{ownerName, dates:[{label,date}], items}` — nada de emails, teléfonos ni datos de otros recipients. Así las reglas de `portal_clientes_users` quedan cerradas y el cliente nunca lee el doc completo.
  2. Alternativa frágil: regla que permita leer solo ciertos campos por `referralCode` — Firestore no filtra por campo, así que NO sirve para ocultar PII. Descartar.
- Decisión de privacidad: exponer fechas/labels mínimos; nunca el año de nacimiento real ni nombres completos de terceros si no es necesario (usar solo el label de evento del dueño).

---

## 5. Orden de implementación recomendado (incremental, bajo riesgo)

1. **Feature A** (solo `WishlistPage.jsx`, sin tocar datos ni checkout). Bajo riesgo. **Deploy por Vercel** (frontend). → cierra el atajo de compra.
2. **CartContext: conservar flags y campos nuevos** en el `cartItem`. Cambio aditivo, frontend. **Vercel.**
3. **Checkout: campo `deliveryDate` + preselección giftMode + giftDetails extendido**. Frontend, aditivo. **Vercel.** (Probar con un item `isWishlistGift` simulado.)
4. **Ruta + página pública `GiftRegistryPage`** consumiendo wishlist + fechas. **Vercel.** En esta etapa, si aún no existe la CF, leer `giftRecipients` directo (solo en STAGING) para validar UX.
5. **Endurecer privacidad**: Cloud Function `getPublicGiftRegistry` + cierre de reglas de `portal_clientes_users`. Esto va por **Cloud Shell / Firebase** (`functions/` + `firestore.rules`), siguiendo `docs/wala/DESPLIEGUE.md` y `PLAN-SEGURIDAD-REGLAS.md`. **No publicar la ruta pública en producción hasta cerrar este paso.**
6. **(Opcional) CF de entrega programada/notificación** por `deliveryDate`. **Cloud Shell.**

Reparto de despliegue:
- **Vercel** (wala.pe, frontend): pasos 1-4 (componentes React, rutas, checkout).
- **Cloud Shell / Firebase** (`sistema-gestion-3b225`): pasos 5-6 (Cloud Functions, `firestore.rules`, índices).

Flujo obligatorio por `docs/wala/README.md`: RESPALDAR → STAGING → CAMBIO → DEPLOY → VERIFICAR. Documentar en `ESTADO-DEL-PROYECTO.md` §2/§4/§7, actualizar `FUNCIONES-CLIENTE.md` §31, y crear `docs/wala/PLAN-WISHLIST-REGALO.md` con esta spec.

---

## 6. Riesgos y decisiones abiertas para el usuario

1. **Privacidad de fechas (alto)**: ¿OK exponer públicamente las fechas especiales del dueño por `referralCode`? Recomiendo Cloud Function que devuelva solo datos mínimos y **no** desplegar la ruta pública hasta cerrar reglas (ligado a H-07/H-09). **Requiere tu visto bueno.**
2. **¿Qué fechas mostrar?** ¿Solo las del propio dueño, o todas las de sus `giftRecipients` (familiares)? El objetivo dice "fechas que el dueño llenó en la encuesta" → propongo mostrar las del dueño (regalar al dueño en su fecha). Confirmar.
3. **Fechas pasadas / recurrencia**: las fechas son `YYYY-MM-DD`. ¿Normalizar al próximo aniversario (mismo día/mes, año siguiente) o mostrar la literal? Recomiendo próximo aniversario para cumpleaños/aniversarios.
4. **Ventana de entrega**: el checkout dice 7-30 días hábiles. Si la fecha elegida está muy cerca, ¿bloquear, advertir, o permitir? Propongo advertir y permitir.
5. **Comportamiento de `addToCart` con duplicados** (Feature A): confirmar en `CartContext` si incrementa o ignora, para decidir si saltamos items ya en carrito.
6. **Productos con variante obligatoria** en "Agregar todo": ¿agregar con base, u omitir y avisar? Propongo omitir + aviso.
7. **Texto de los botones**: "Agregar todo al carrito" y "Mis fechas especiales" (este último abre/copia el link del registro). ¿Copiar al portapapeles como "Compartir mi lista", o navegar a una vista previa del registro? Recomiendo: copiar link + abrir en nueva pestaña.

Archivos clave referenciados (rutas absolutas):
- `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\pages\cuenta\WishlistPage.jsx`
- `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\pages\WishlistPublic\WishlistPublic.jsx`
- `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\services\wishlist.js`
- `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\services\fechasImportantes.js`
- `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\services\products.js`
- `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\contexts\CartContext.jsx`
- `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\pages\CheckoutPage.jsx`
- `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\pages\SubscriptionSurveyPage.jsx`
- `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\App.jsx`
- A crear: `src\pages\GiftRegistry\GiftRegistryPage.jsx`, `...GiftRegistryPage.module.css`, `docs\wala\PLAN-WISHLIST-REGALO.md`

---

# ESTADO Y FUNCIONAMIENTO — Registro de regalos por fecha (`/regalar`)

> **Actualizado 2026-06-27.** Esta sección refleja el estado REAL del código (verificado leyendo los archivos), no el plan. La feature pasó de "por implementar" a **desplegada y funcionando**, con un bug de carga ya corregido (pendiente de redeploy de la Cloud Function) y el **drag-and-drop ✅ HECHO y rediseñado** (modelo de asignación por fecha con miniaturas + "Proceder a regalar"). Las secciones 1-6 de arriba son el plan original; lo que sigue es lo que de verdad está construido.

## A. Cómo funciona (flujo paso a paso)

1. **El dueño comparte el enlace.** En `/cuenta/wishlist` (`src/pages/cuenta/WishlistPage.jsx`), el botón **"📅 Mis fechas especiales"** (`handleShareGiftRegistry`, líneas 41-46) copia al portapapeles `${origin}/regalar/${userProfile.referralCode}` y lo abre en una pestaña nueva. El `referralCode` (formato `KS-XXXXXX`) es el mismo que usa la wishlist pública.
2. **La ruta carga la página pública.** `/regalar/:referralCode` está cableada en `src/App.jsx` (línea 261) → `GiftRegistryPage`.
3. **La página pide los datos a la Cloud Function.** `GiftRegistryPage` (`src/pages/GiftRegistry/GiftRegistryPage.jsx`) llama `httpsCallable(getFunctions(), 'getPublicGiftRegistry')({ referralCode })` (líneas 83-84). **No lee Firestore directamente** (privacidad). La CF devuelve `{ ok, ownerName, dates, wishlistItems }`.
4. **La CF resuelve dueño + fechas + wishlist** (`functions/index.js`, `getPublicGiftRegistry`, línea 2471):
   - Normaliza el `referralCode` a mayúsculas.
   - **Estrategia 1:** query `wishlists where userCode == referralCode` → de ahí saca `userId` (= `doc.id`) y los `items`.
   - **Estrategia 2 (respaldo de userId):** si no hubo wishlist, query `portal_clientes_users where referralCode == code` para resolver el `userId`.
   - **Respaldo CONFIABLE de items (el fix, ver §C):** si no trajo items pero sí hay `userId`, lee `wishlists/{userId}` directo por `doc.id`.
   - Lee el perfil del dueño (`portal_clientes_users/{userId}`) y aplana `giftRecipients[].events[]` → `dates[]` con `{ type, date, label, recipientName }`. Devuelve SOLO datos mínimos (sin email/teléfono/dni).
   - De cada item de la wishlist expone `{ productId, productName, productImage, isGifted }` — `isGifted` es disponibilidad (marca "ya regalado"), NO PII. No expone `giftedBy`/`addedAt`.
5. **El comprador ve fechas (columnas/zonas de drop) + wishlist (tarjetas arrastrables).** La página muestra (a) las fechas del dueño como **columnas** que son **zonas de drop** (`data-date-key`, preselecciona la primera) y (b) la wishlist como grilla de **tarjetas a medida** (`GiftProductCard`), enriquecidas con precio/imagen del catálogo vía `useProducts([])` (evita N lecturas). En cada tarjeta: la **imagen es la zona de arrastre** y el **nombre es un `<Link>` al detalle** (`/producto/:id`). Cada tarjeta conserva el botón fallback **"Regalar este 🎁"**, deshabilitado si no hay fecha elegida o si el item ya está `isGifted`.
6. **Drag-and-drop = ASIGNAR a una fecha (no agrega al carrito todavía).** Soltar una tarjeta sobre una columna de fecha crea una **asignación** (estado `assignments[dateKey]`, `assignToDate`/`handleCardDrop`): debajo de esa fecha aparece una **tira de miniaturas** del/los producto(s) asignado(s), cada una con **× para quitar** (`unassign`). **ENCIMA** de la fecha aparece un botón **"Proceder a regalar (N) 🎁"** (`proceedDate`): recién al pulsarlo los regalos de esa fecha se agregan al carrito en silencio (en Modo Regalo, con esa `deliveryDate`) y se navega a `/carrito`. El botón fallback **"Regalar este"** (`handleGift`) sigue agregando 1 regalo directo con la fecha seleccionada. Ambos caminos construyen el mismo `productMock` (helper `addGiftToCart`) con los flags `isWishlistGift: true`, `wishlistUserCode: referralCode` (idéntico a `WishlistPublic`) MÁS el contexto nuevo `deliveryDate`, `deliveryEventLabel` y `deliveryRecipient` (el dueño), y llaman `addToCart`.
7. **El carrito conserva el contexto de regalo.** `src/contexts/CartContext.jsx` (`addToCart`, líneas 172-180) copia `isWishlistGift`/`wishlistUserCode` y `deliveryDate`/`deliveryEventLabel`/`deliveryRecipient` al `cartItem` SOLO si vienen en el producto. Además, un item de regalo **siempre crea una línea nueva** (no se fusiona con un item normal del mismo producto, líneas 238-246), para no perder esos campos al deduplicar.
8. **El checkout preselecciona Modo Regalo y consume la fecha.** `src/pages/CheckoutPage.jsx`:
   - Detecta el primer item con `isWishlistGift && deliveryDate` (líneas 183-185) y de ahí saca `registryDeliveryDate`, `registryRecipient`, `registryEventLabel`.
   - Preselecciona `isGiftMode = true` y `giftRecipientName = deliveryRecipient`, e inicializa `deliveryDate` en Formik (líneas 254-259).
   - Avisa (no bloquea) si la fecha está a menos de 7 días hábiles (`businessDaysUntil`, líneas 214-236).
   - Persiste en el payload del pedido `giftDetails: { isGift, recipientName, message, sticker, deliveryDate?, deliveryEventLabel?, wishlistUserCode? }` (líneas 623-639) y lo incluye en el mensaje de WhatsApp ("📅 Entrega programada", líneas 694-699).
9. **Se marca el regalo y se notifica al dueño.** Tras crear el pedido, el checkout recorre los items con `isWishlistGift && wishlistUserCode` y llama `markItemAsGifted(wishlistUserCode, productId, customerName)` (líneas 657-660). En `src/services/wishlist.js` (línea 101) esa función marca `isGifted = true` + `giftedBy`, y crea una notificación en `users/{userId}/notifications` para el dueño. Va dentro de un `try/catch` tolerante: si falla, el pedido igual se procesa.

## B. Qué funciona hoy (desplegado)

- ✅ Ruta pública `/regalar/:referralCode` cableada en `src/App.jsx` y renderizando `GiftRegistryPage`.
- ✅ Botón **"📅 Mis fechas especiales"** en la wishlist: copia el link y lo abre en pestaña nueva.
- ✅ Botón **"🛒 Agregar todo al carrito"** en la wishlist (Feature A): agrega los productos no regalados al carrito propio; omite borrados, sin stock/inactivos y los que ya están en el carrito; muestra un toast resumen (`handleAddAll`, líneas 52-79).
- ✅ Cloud Function `getPublicGiftRegistry` **desplegada** y devolviendo fechas + wishlist con datos mínimos (privacidad). Tolerante a errores: ante fallo o código inexistente responde `{ ok: false }` y la página muestra "Registro no encontrado".
- ✅ La página muestra las **fechas especiales del dueño** (de `giftRecipients[].events[]`) como **columnas / zonas de drop**, con la primera preseleccionada.
- ✅ La página muestra la **wishlist** como **tarjetas a medida** (`GiftProductCard`) con precio/imagen reales del catálogo y marca **"¡Ya regalado!"** los items con `isGifted`.
- ✅ **Drag-and-drop HECHO y rediseñado (modelo de asignación).** Cada tarjeta se arrastra **desde su imagen**; el **nombre** es un `<Link>` al detalle. Soltar sobre una fecha **ASIGNA** el producto a ese día (no lo agrega al carrito directo): aparece una **miniatura** debajo de la fecha (con × para quitar) y un botón **"Proceder a regalar (N)"** ENCIMA de la fecha que recién entonces agrega esos regalos al carrito (Modo Regalo, con esa fecha) y abre `/carrito`. Se conserva el botón fallback **"Regalar este"**.
- ✅ **Bug del drag nativo corregido.** El arrastre lo gestiona un `motion.div` padre y la `<img>` lleva `draggable={false}` + CSS `-webkit-user-drag:none`, lo que **eliminó la "imagen fantasma con URL" / cursor "denegado"** del drag nativo del navegador. (Por eso NO se reutilizó `ProductCard`, que envuelve todo en un `<Link>` y conserva el drag nativo de su `<img>`.)
- ✅ Flujo de compra completo: asignar por drag (o "Regalar este") → "Proceder a regalar" → carrito en **Modo Regalo** con `deliveryDate` → checkout preselecciona Modo Regalo y la fecha → pedido con `giftDetails.deliveryDate` → `markItemAsGifted` notifica al dueño.
- ✅ Privacidad: la página NO lee Firestore directo; la CF nunca expone email/teléfono/dni del dueño ni datos sensibles de terceros.

## C. Qué NO funciona / bugs

- 🐛 **Bug encontrado y arreglado — los productos de la wishlist no cargaban en `/regalar`** (salía "Esta lista está vacía por ahora" aunque el dueño SÍ tenía productos).
  - **Causa:** la CF leía los items SOLO con la query `wishlists where userCode == referralCode`. Si esa query no matcheaba (el campo `userCode` con casing distinto, ausente, o la lista creada de otra forma) pero el `userId` SÍ se resolvía por el perfil, los items quedaban en `[]`.
  - **Fix (ya en el código, `functions/index.js` líneas 2543-2558):** si tras la query no hay items pero sí hay `userId`, la CF lee la wishlist directo por `wishlists/{userId}` (lectura confiable por `doc.id`). Las fechas no se veían afectadas porque salen del perfil, no de la wishlist — por eso "cargaban las fechas pero no los productos".
  - **⚠️ Pendiente del usuario:** REDESPLEGAR la Cloud Function por Cloud Shell para que el fix llegue a producción:
    ```
    firebase deploy --only functions:getPublicGiftRegistry --project sistema-gestion-3b225
    ```
    Hasta ese redeploy, en producción sigue corriendo la versión vieja y algunas listas pueden verse vacías.

## D. Qué falta agregar

> El **drag-and-drop** ya NO está pendiente: pasó a ✅ HECHO (ver §B). Lo que sigue son decisiones abiertas.

- ⬜ **Decisiones abiertas (de §6 de este plan):**
  1. **¿Qué fechas mostrar?** Hoy la CF aplana **todas** las fechas de `giftRecipients[]` (las del dueño y las de sus familiares). Falta decidir si mostrar solo las del propio dueño o mantener todas las del registro.
  2. **Recurrencia / fechas pasadas.** Las fechas son `YYYY-MM-DD` literales. No se normaliza al próximo aniversario ni se filtran las ya pasadas; falta esa lógica.
  3. **Validación de la ventana de entrega.** Hoy el checkout solo **avisa** (no bloquea) si la fecha está a menos de 7 días hábiles, y no valida que no sea una fecha pasada ni que respete los 7-30 días hábiles. Falta endurecer.
  4. **UX de la fecha preseleccionada.** Se preselecciona siempre la primera fecha del arreglo; falta decidir si conviene otro criterio (la más próxima, ninguna, etc.).
  5. **Reconciliación si `markItemAsGifted` falla.** Hoy es tolerante (try/catch que solo loguea). Falta un mecanismo de reintento/reconciliación para no dejar un regalo comprado sin marcar.
  6. **Persistir el monto/USD estructurado en el pago.** El `giftDetails` guarda metadatos de entrega pero no un monto estructurado; falta definir si el pago debe llevar el monto/USD del regalo de forma estructurada.

## E. Archivos involucrados (rutas absolutas)

- Página pública: `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\pages\GiftRegistry\GiftRegistryPage.jsx` (+ `GiftRegistryPage.module.css`)
- Cloud Function: `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\functions\index.js` → `getPublicGiftRegistry` (línea 2471)
- Botones de la wishlist: `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\pages\cuenta\WishlistPage.jsx`
- Servicio de wishlist: `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\services\wishlist.js` (`getWishlistByUserCode`, `markItemAsGifted`)
- Carrito: `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\contexts\CartContext.jsx` (preserva `deliveryDate`/`isWishlistGift`/etc. en el `cartItem`)
- Checkout: `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\pages\CheckoutPage.jsx` (consume `deliveryDate`, preselecciona Modo Regalo, `giftDetails`, `markItemAsGifted`)
- Ruta: `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master\src\App.jsx` (línea 261)