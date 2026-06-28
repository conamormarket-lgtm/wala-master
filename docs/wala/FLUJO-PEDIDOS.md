# Flujo de pedidos WALA — ciclo completo (creación → pago → estado → visibilidad)

> Documento de lógica/flujo del PEDIDO del portal WALA. Fuente: lectura directa del
> código (`src/pages/CheckoutPage.jsx`, `src/services/erp/firebase.js`,
> `src/utils/estadoCompra.js`, `src/utils/pedidos.js`, `src/hooks/usePedidos.js`,
> `src/services/adminOrders.js`, `src/components/CulqiCustomCheckout/`,
> `src/components/PaypalCheckout/`, `functions/index.js`).
>
> **Complementa a [MODELO-DATOS.md](./MODELO-DATOS.md)** (que describe las COLECCIONES
> `pedidos`/`pedidos_web` y sus índices). Aquí se documenta el CICLO de vida: en qué
> momento exacto se crea el documento, qué pasa con cada método de pago, cómo se DERIVA
> el estado para la vista y dónde se ve el pedido (cliente vs admin).
>
> **⚠️ Topología:** el ERP (`pedidos`/`pedidos_web`) comparte el MISMO proyecto Firebase
> y la misma base Firestore que el portal: todo vive en `sistema-gestion-3b225`. El ERP es
> un **negocio aparte** cuyas colecciones MEZCLAN pedidos nativos del ERP con los del
> portal WALA; por eso casi todas las lecturas del portal filtran con `esPedidoWala`.

---

## 0. Mapa de un vistazo

```
  CARRITO ──► CheckoutPage (form)
                  │  formik.onSubmit("Generar pedido")   ← ÚNICO punto de creación
                  ▼
         createWebOrder(payload)  ──►  Firestore: pedidos_web/{autoId}
                  │                       estadoGeneral:'Nuevo'
                  │                       estadoValidacion:'pendiente'
                  │                       montoPendiente = montoTotal  (aún sin pagar)
                  │
          ¿id OK? ── NO ─► toast.error + ABORTA (no abre WhatsApp/Culqi/PayPal)
                  │
                 SÍ
                  ▼
        Paso "Opciones de pago"  (setPaymentStepData)
                  │
      ┌───────────┼─────────────────────────────┐
      ▼           ▼                              ▼
  WhatsApp      Culqi (PE)                   PayPal (intl)
  abre wa.me   processCulqiPayment          captura USD
  NO marca     COBRA + marca pagado         marca pagado
  pagado       (montoPendiente:0)           (montoDeuda:0/conDeuda:false
  (asesor      [+ webhook respaldo]          ó server-side con flag)
   confirma)
                  │
                  ▼
       ESTADO en "Mis Compras" / "Recepción":
       derivarEstadoCompra(pedido)  =  eje PRODUCCIÓN (estadoGeneral)  ×  eje PAGO (esPagado)
```

Dos ejes ortogonales gobiernan TODO lo visible:

1. **Producción** — `estadoGeneral` (`'Nuevo'` → etapas del ERP → `'Entregado'`/`'Anulado'`).
2. **Pago** — señales `pagado`/`estadoPago`/`montoPendiente`/`historialPagos`.

`derivarEstadoCompra` (en `src/utils/estadoCompra.js`) los COMBINA en una etiqueta legible.

---

## 1. CREACIÓN del pedido (único punto)

### 1.1 Dónde y cuándo

El pedido se crea en **un solo lugar**: el `onSubmit` de Formik del checkout, disparado por
el botón **"Generar pedido"**.

- `src/pages/CheckoutPage.jsx:374` — `onSubmit: async (values) => { … }`.
- La creación ocurre **ANTES** de elegir método de pago: primero se guarda el pedido y
  recién después la UI avanza al paso "Opciones de pago" (`setPaymentStepData`,
  `CheckoutPage.jsx:1027`).
- El botón de **WhatsApp** del paso de pago **no crea nada**: solo abre `wa.me`
  (`window.open(link, …)`, ver `CheckoutPage.jsx:139`, `:160`, `:886`). El registro ya
  existe desde el `onSubmit`.

### 1.2 La escritura: `createWebOrder` → `pedidos_web`

`onSubmit` arma el `webOrderPayload` (`CheckoutPage.jsx:616`) y lo guarda con:

- `createWebOrder(webOrderPayload)` — `src/services/erp/firebase.js:387`.
- Escribe en la colección **`pedidos_web`** (cola web pendiente de validación manual),
  NO en `pedidos` (ERP "oficial"/validado). `addDoc` → id autogenerado
  (`erp/firebase.js:413`).
- La función AÑADE al payload: `web:true`, `estadoValidacion:'pendiente'`,
  `createdAt`/`updatedAt: serverTimestamp()` (`erp/firebase.js:393-399`).

### 1.3 Campos del pedido (payload del checkout)

Construido en `CheckoutPage.jsx:616-769`. Los más relevantes para el ciclo:

| Campo | Valor / origen | Línea | Para qué |
|---|---|---|---|
| `numeroPedido` / `portalPseudoOrderId` | `PD-<base36(Date.now())>` (`pseudoOrderId`) | `:385`, `:618`, `:751` | Clave de negocio visible; dedup en Recepción. |
| `canalVenta` | `'Portal Web'` | `:652` | Marca el pedido como de WALA (`esPedidoWala`). |
| `web` | `true` | `:653` | Idem (y lo refuerza `createWebOrder`). |
| `activador` | `'portal_web'` | `:654` | Idem. |
| `vendedor` | `'Portal Web'` | `:655` | Idem. |
| `estadoGeneral` / `status` | `'Nuevo'` | `:667-668` | Eje de PRODUCCIÓN inicial. |
| `estadoValidacion` | `'pendiente'` (lo pone `createWebOrder`) | `erp/firebase.js:396` | Cola de validación del asesor. |
| `montoTotal` | `total` (con descuento + envío) | `:659` | Total a cobrar. |
| `montoPendiente` | `total` (= sin pagar todavía) | `:661` | Eje de PAGO: > 0 ⇒ pendiente. |
| `montoAdelanto` | `0` | `:660` | — |
| `costoEnvio` | `shipping` | `:662` | Para cuadrar el desglose del detalle. |
| `clienteNumeroDocumento` / `dni` | `values.dni` **normalizado** + `dniRaw` | `:621`, `:631`, ver §4.1 | Visibilidad en "Mis Compras". |
| `productos` | **MAPA** `item_0`, `item_1`, … (no array) | `:577`, `:595`, `:673` | Líneas del pedido. |
| `productos.item_N.brandId` | `item.brandId \|\| null` | `:581`, `:599` | Enruta el WhatsApp al asesor por marca. |
| `giftDetails` | solo si `isGiftMode` (`deliveryDate`, etc.) | `:752-768` | Modo regalo / entrega programada. |
| `createdAt` | `serverTimestamp()` (lo pone `createWebOrder`) | `erp/firebase.js:397` | Orden y filtros por fecha. |

> **Formato `productos`:** es un **mapa** `{ item_0:{…}, item_1:{…} }`, NO un array. Los
> lectores deben soportar ambos: lo hace `getProductosPedido` (`estadoCompra.js:34`), que
> con `Object.values(...)` convierte el mapa a array.

### 1.4 La creación NO se traga (fix `de1594b`)

Antes, si `createWebOrder` fallaba el error se silenciaba (`console.warn`) y el flujo abría
WhatsApp igual → el cliente creía haber comprado pero **nada quedaba guardado**. Ahora:

- `onSubmit` evalúa `webOrderOk`/`webOrderId`; si la escritura no devuelve `id`
  (error O id ausente) **muestra `toast.error` y ABORTA con `return`** ANTES del paso de
  pago — `CheckoutPage.jsx:776-801`.
- Así no se abre WhatsApp ni se muestra Culqi/PayPal "fingiendo éxito". El camino de éxito
  queda idéntico.

---

## 2. PAGO por método

El pedido nace **sin pagar** (`montoPendiente = montoTotal`, sin `pagado`/`estadoPago`).
Cada método lo cierra distinto:

### 2.1 WhatsApp — queda "por confirmar"

- El botón solo abre `https://wa.me/<numero>?text=…` con un mensaje pre-armado
  (`CheckoutPage.jsx:886`; helper por marca `buildMessageForItems`, `:892`; en modo
  multimarca cada marca con número recibe su propio mensaje, `:936-981`).
- **No escribe pago.** El pedido permanece `montoPendiente = total` y sin `pagado`.
- Lo CONFIRMA luego el ASESOR (manualmente en el ERP o en Recepción). Hasta entonces el
  estado derivado es **"Por confirmar pago"** (§3) — y para Yape/Plin/transferencia la
  etiqueta de pago es **"Por validar (Yape/Plin/transf.)"** (`estadoCompra.js:115-117`).

### 2.2 Culqi (Perú) — cobra y marca pagado (fix `e84b6b1`)

- UI: `CulqiCustomCheckout` se abre automáticamente en el paso de pago para PE
  (`CheckoutPage.jsx:1271`, `autoOpen`).
- Tokeniza la tarjeta y llama a la Cloud Function `processCulqiPayment`
  (`CulqiCustomCheckout.jsx:139-151`), pasando `metadata.pedidoId`.
- La Cloud Function **COBRA** y, en la rama de ÉXITO (bajo el lock de idempotencia
  `culqiCharges/{tokenId}`), marca el pedido en `pedidos_web`/`pedidos` con **7 campos**
  (`functions/index.js`, fix `e84b6b1`):

  ```jsonc
  { "pagado": true, "estadoPago": "pagado", "culqiChargeId": "<charge>",
    "montoPagado": <céntimos>, "montoPendiente": 0,
    "pagadoAt": serverTimestamp(), "metodoPago": "culqi" }
  ```

  Es **best-effort** (try/catch: el cobro ya ocurrió, un fallo aquí no rompe la respuesta) e
  **idempotente** (`set … {merge:true}`, mismos campos que el webhook).
- **`culqiWebhook` es el respaldo**: hace exactamente lo mismo si llega el evento de Culqi
  (hoy no está registrado en Culqi, por eso el marcado va en la propia función — de ahí el
  fix). Como ambos escriben los mismos campos, no hay conflicto.
- Tras `onSuccess`: `emitPurchaseComplete('culqi')` + `clearSelectedItems()` +
  navega a `/cuenta/pedidos` (`CheckoutPage.jsx:1275-1280`).

> Antes del fix `e84b6b1`, Culqi cobraba pero NUNCA actualizaba el pedido → un pagado
> quedaba indistinguible de uno sin pagar (`montoPendiente = total`) y Recepción no podía
> separar pagados de "por confirmar".

### 2.3 PayPal (internacional) — cliente o servidor según flag

- UI: `PaypalCheckout` (Culqi oculto para no-PE) — `CheckoutPage.jsx:1294`. Cobra SIEMPRE
  en USD (`amountUsd = penToUsd(total, fx)`); la moneda local es solo display.
- Flag `VITE_PAYPAL_SERVER_SIDE` (`PaypalCheckout.jsx:13`):
  - **OFF (default):** el cliente captura el pago y luego hace `updateDoc` directo sobre
    `pedidos_web/{webOrderId}` (`PaypalCheckout.jsx:185-201`) con
    `{ montoDeuda:0, conDeuda:false, historialPagos:[…{estado:'Aprobado', metodo:'PayPal'}] }`
    (`PaypalCheckout.jsx:171-176`). El fallo de esa escritura no rompe el flujo (el cobro ya
    se hizo): se loguea y `onSuccess` corre igual.
  - **ON (server-side, S-1):** la captura y el marcado de pagado los hace el SERVIDOR
    (idempotente por `reference_id`), igual que Culqi.
- Tras `onSuccess`: `emitPurchaseComplete('paypal')` + `clearSelectedItems()` + navega a
  `/cuenta/pedidos` (`CheckoutPage.jsx:1305-1310`).

> Nota: PayPal marca el pago vía `montoDeuda:0`/`conDeuda:false`/`historialPagos`, no con
> `pagado:true`. La derivación de estado (§3) reconoce ESTAS señales también
> (`conDeuda === false` y `historialPagos` con estado `/aprob/i`).

---

## 3. ESTADO: dos ejes combinados (`derivarEstadoCompra`)

Toda la UI de estado (cliente y admin) pasa por **`derivarEstadoCompra(pedido)`**
(`src/utils/estadoCompra.js:144`). Combina:

### 3.1 Eje 1 — producción

`estadoToKey(estadoGeneral || status || estado)` (`estadoCompra.js:148`):

- Inicial: `'Nuevo'`/`'Pendiente'`/`''` → no entró a producción.
- Intermedio: cualquier etapa → **"En preparación"** (o **"En camino"** si `reparto`).
- Terminal: `entregado`/`finalizado`/`completado` → **"Entregado"** (asume pago hecho);
  `anulado`/`cancelado` → **"Anulado"**.

### 3.2 Eje 2 — pago (`esPagado`)

`esPagado(pedido)` (`estadoCompra.js:74`) devuelve `true` si CUALQUIERA:

- `pagado === true` (lo pone Culqi), o
- `estadoPago === 'pagado'` (Culqi), o
- `web === false` (un pedido NO-web ya pasó por caja del ERP), o
- `conDeuda === false` (lo pone PayPal cliente), o
- algún `historialPagos[i].estado` que matchee `/aprob/i` (PayPal: `'Aprobado'`).

### 3.3 Combinación → etiqueta

Orden de prioridad en `derivarEstadoCompra` (`estadoCompra.js:162-201`):

| Condición | `key` | `label` | Color |
|---|---|---|---|
| anulado | `anulado` | Anulado | gris |
| entregado/finalizado | `entregado` | Entregado | verde |
| etapa intermedia | `en_preparacion` | En preparación / En camino | violeta |
| pagado (sin etapa avanzada) | `pago_confirmado` | Pago confirmado | azul |
| recién creado, sin pago | `por_confirmar_pago` | Por confirmar pago | ámbar |

Además `derivarMetodoPago` (`estadoCompra.js:95`) deriva una etiqueta de método legible
(tarjeta/Culqi, PayPal, "Por validar (Yape/Plin/transf.)", "Pendiente de pago") leyendo
`metodoPago` o el último `historialPagos[].metodo`.

---

## 4. VISIBILIDAD del pedido

### 4.1 "Mis Compras" (cliente) — filtra por DNI normalizado

- Página: `src/pages/cuenta/CuentaPedidosPage.jsx`. Toma el DNI **del perfil**
  (`userProfile.dni`, `CuentaPedidosPage.jsx:113`) y llama `usePedidos(dni)` (`:114`).
- Hook: `src/hooks/usePedidos.js` → `searchOrdersByDniInERP(dni)`
  (`usePedidos.js:76`).
- Búsqueda (`erp/firebase.js:126`): query exacta
  `where('clienteNumeroDocumento','==', dniNorm)` (y fallback a `where('dni','==',…)`)
  sobre `pedidos` Y `pedidos_web`. `dniNorm = dni.trim().replace(/\s/g,'')`.
- **Por qué se normaliza al CREAR (fix `de1594b`):** el filtro es un `where` EXACTO; si el
  checkout guardaba el documento sin normalizar y el perfil filtra normalizado, no casaban
  y el pedido no aparecía. Por eso `createWebOrder` normaliza `clienteNumeroDocumento`/`dni`
  y conserva el tecleado en **`dniRaw`** (`erp/firebase.js:404-410`), igual que
  `createOrderInERP` (`erp/firebase.js:96-98`).
- **Fallback crudo:** si la búsqueda normalizada da 0, reintenta con el DNI **crudo** del
  perfil (rescata pedidos históricos guardados antes de normalizar) — `erp/firebase.js:158-208`.
- Tras traer, `usePedidos` FILTRA con `esPedidoWala` (`usePedidos.js:33`, `:85`) ANTES de
  normalizar (el ERP mezcla pedidos nativos + del portal).

### 4.2 "Recepción de Pedidos" (admin) — todos los del portal

- Servicio: `getWalaOrdersForAdmin` (`src/services/adminOrders.js:372`), vía hook
  `useAdminWalaOrders` (`src/hooks/useAdminWalaOrders.js`). Solo rutas `/admin*` (claim admin);
  **NO filtra por usuario**: trae TODOS los pedidos del portal.
- Lee `pedidos_web` y `pedidos` con `orderBy('createdAt','desc')` + `limit(200)`
  (`adminOrders.js:303-316`, `LIMIT_DEFAULT = 200`). Si se pide `sinceDays`, intenta filtro
  indexado `where createdAt >=` con fallback en memoria.
- Filtra con **`esPedidoWala`** (`adminOrders.js:408`).
- **Dedup por `numeroPedido`** (clave de negocio), con fallback a `portalPseudoOrderId`/`id`
  (`adminOrders.js:415-422`): un pedido del portal puede existir a la vez en `pedidos_web` y
  en `pedidos` (al validarse se crea un doc NUEVO con id distinto pero mismo `numeroPedido`);
  deduplicar por id mostraría duplicados e inflaría KPIs. Como `pedidos_web` se lee primero,
  su versión gana el empate.
- Normaliza con `normalizarPedidoRecepcion` (que usa `derivarEstadoCompra`,
  `adminOrders.js:227`) y arma un `resumen` (porEntregar / pendientesPago / enProduccion /
  entregados / montoTotal).
- Acceso: enlace **"📦 Recepción de Pedidos"** en el sidebar admin, debajo de Dashboard
  Analítica (`AdminLayout.jsx`, fix `09d86a9`). Ruta `/admin/dashboard/recepcion`.

---

## 5. Gotchas (trampas conocidas)

### 5.1 `normalizarPedidoParaVista` DESCARTA campos → usar `_raw`

`normalizarPedidoParaVista` (`src/utils/pedidos.js:244`) **no hace spread** del pedido crudo:
construye un objeto explícito. Por eso NO sobreviven a la normalización:
`pagado`, `estadoPago`, `web`, `numeroPedido`, `portalPseudoOrderId`, `metodoPago`,
`estadoValidacion` ni el mapa `productos`. SÍ sobreviven: `estado`/`estadoGeneral`, `id`,
`createdAt`, `historialPagos`, `marca` (+ dirección/montos).

**Mitigación:** `usePedidos` adjunta el documento CRUDO como **`_raw`** al normalizado
(`usePedidos.js:88-91`). Las páginas que necesiten productos / método de pago / `numeroPedido`
deben leer del **pedido CRUDO** (`pedido._raw`), no del normalizado. Esto también lo advierte
el comentario de cabecera de `estadoCompra.js:7-15`.

### 5.2 `estadoToKey('Entregado')` → `'tregado'` (mitigado)

`estadoToKey` recorta el prefijo `"en "` y corrompe literales como `"Entregado"` →
`"tregado"`. Por eso `derivarEstadoCompra` NO confía solo en la key: comprueba también el
texto CRUDO con regex para terminal/anulado —
`esFinalizadoRaw = /entreg|finaliz|complet/` y `esAnuladoRaw = /anul|cancel/`
(`estadoCompra.js:151-153`, usados en `:162` y `:169`). Así "Entregado" se detecta aunque la
key salga corrupta.

### 5.3 Dos colecciones para el mismo pedido

`pedidos_web` (cola web, `estadoValidacion:'pendiente'`) y `pedidos` (ERP validado) pueden
contener el MISMO pedido del portal con docs distintos pero mismo `numeroPedido`. Recepción
deduplica por `numeroPedido` (§4.2). El detalle del cliente
(`getOrderByIdAnyCollection`, `erp/firebase.js:301`) busca primero en `pedidos` y luego en
`pedidos_web`, devolviendo el doc crudo con `_coleccion`.

### 5.4 PayPal vs Culqi marcan el pago distinto

Culqi usa `pagado:true`/`estadoPago:'pagado'`/`montoPendiente:0`; PayPal (cliente) usa
`montoDeuda:0`/`conDeuda:false`/`historialPagos`. Ambos son reconocidos por `esPagado` (§3.2),
pero al leer/filtrar pagos hay que recordar que **no comparten el mismo conjunto de campos**.

---

## 6. Referencias de archivos

| Archivo | Rol en el flujo |
|---|---|
| `src/pages/CheckoutPage.jsx` | Único punto de creación (`onSubmit`), payload, abort, paso de pago. |
| `src/services/erp/firebase.js` | `createWebOrder` (escritura), `searchOrdersByDniInERP` (Mis Compras), `getOrderByIdAnyCollection` (detalle). |
| `src/components/CulqiCustomCheckout/CulqiCustomCheckout.jsx` | Tokeniza y llama `processCulqiPayment`. |
| `functions/index.js` | `processCulqiPayment` (cobra + marca pagado), `culqiWebhook` (respaldo). |
| `src/components/PaypalCheckout/PaypalCheckout.jsx` | Captura PayPal (USD); marca pagado en cliente o server-side (flag). |
| `src/utils/estadoCompra.js` | `derivarEstadoCompra`/`esPagado`/`getProductosPedido` (estado y líneas). |
| `src/utils/pedidos.js` | `normalizarPedidoParaVista` (descarta campos → `_raw`). |
| `src/hooks/usePedidos.js` | Mis Compras: busca por DNI, filtra `esPedidoWala`, adjunta `_raw`. |
| `src/services/adminOrders.js` + `src/hooks/useAdminWalaOrders.js` | Recepción admin: lee, filtra, dedup, normaliza, resume. |
| `src/pages/cuenta/CuentaPedidosPage.jsx` | Vista "Mis Compras" (toma DNI del perfil). |
| `src/components/AdminLayout/AdminLayout.jsx` | Enlace de sidebar a Recepción. |

---

## 7. Commits relevantes (recientes)

- `de1594b` — fix(pedidos): visibilidad — normaliza DNI al crear + no traga el fallo de
  guardado (abort con toast).
- `e84b6b1` — fix(pagos): Culqi marca el pedido como pagado tras el cobro exitoso.
- `09d86a9` — feat(admin): enlace "Recepción de Pedidos" en el sidebar.
