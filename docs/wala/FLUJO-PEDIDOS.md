# Flujo de pedidos WALA — ciclo completo (creación → pago → estado → visibilidad)

> Documento de lógica/flujo del PEDIDO del portal WALA. Fuente: lectura directa del
> código (`src/pages/CheckoutPage.jsx`, `src/services/erp/firebase.js`,
> `src/services/walaOrders.js`, `src/utils/estadoCompra.js`, `src/utils/pedidos.js`,
> `src/hooks/usePedidos.js`, `src/services/adminOrders.js`, `src/components/CulqiCustomCheckout/`,
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
   confirma)         │                            │
                  el pago también pone  wala_pedidos.estadoWala = "pagado"
                  (marcarWalaPedidoPagado — ADITIVO/best-effort, commit 1d8f639, §4-bis.9)
                  │
                  ▼
       ESTADO en "Mis Compras" / "Recepción":
       derivarEstadoCompra(pedido)  =  MÁS AVANZADO entre:
         · ERP  : eje PRODUCCIÓN (estadoGeneral) × eje PAGO (esPagado)   [histórico]
         · WALA : wala_pedidos.estadoWala (FUENTE DE VERDAD propia)      [§4-bis.5]
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

### 3.4 Tercer insumo — `estadoWala` (FUENTE DE VERDAD de WALA)

Desde el 2026-06-29 (commit `1d8f639`), `derivarEstadoCompra` reconoce además el **estado propio
de WALA** que vive en `wala_pedidos.estadoWala` (§4-bis.5). Lo recibe de dos formas:

- en un pedido **solo-espejo** (sin doc vivo del ERP), el propio doc trae `estadoWala`;
- en un pedido **vivo del ERP**, la lectura le **adjunta** `_walaEstado`/`_walaPagado` desde el
  espejo (lo hacen `searchOrdersByDniInERP` y `getWalaOrdersForAdmin`).

`estadoWalaAEstadoCompra` traduce `estadoWala` al mismo vocabulario de `key`
(`pendiente_pago → por_confirmar_pago`, `pagado → pago_confirmado`, `en_preparacion`/`enviado →
en_preparacion`, `entregado → entregado`, `cancelado → anulado`). Cuando hay **dos fuentes**
(ERP vivo + WALA), se muestra el estado **MÁS AVANZADO** por rango
(`por_confirmar_pago < pago_confirmado < en_preparacion < entregado`), con `anulado/cancelado`
como terminal que gana si **cualquiera** lo marca. Así un "Entregado/Finalizado" del ERP **no se
degrada** a "pagado", ni al revés. Para pedidos vivos que **no** son de WALA (sin `estadoWala`)
el comportamiento es **exactamente** el histórico de §3.1–§3.3.

---

## 4. VISIBILIDAD del pedido

### 4.1 "Mis Compras" (cliente) — filtra por DNI normalizado

- Página: `src/pages/cuenta/CuentaPedidosPage.jsx`. Toma el DNI **del perfil**
  (`userProfile.dni`, `CuentaPedidosPage.jsx:113`) y llama `usePedidos(dni, uid)` (pasa también el
  `uid` del usuario logueado para el rescate por `buyerUid` del espejo).
- Hook: `src/hooks/usePedidos.js` → `searchOrdersByDniInERP({ dni, userId })`; la caché en memoria
  se indexa por `dni+userId`.
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
- **Red de seguridad (desde 2026-06-29):** `searchOrdersByDniInERP` además **fusiona el espejo**
  `wala_pedidos` (`getWalaMirrorOrders({ userId, dni })`) y **deduplica por clave de negocio**; un
  pedido que el ERP ya **borró/desmarcó** de `pedidos_web` se **rescata** desde su copia. Ver
  §4-bis.5–§4-bis.7 y [MODELO-DATOS.md §3.7](./MODELO-DATOS.md).

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
- **Red de seguridad (desde 2026-06-29):** además **fusiona el espejo** `wala_pedidos`
  (`getAllWalaMirrorOrders()`, sin filtro de usuario) en la misma dedup, marcado
  **"Procesado en ERP"**, para que un pedido borrado/desmarcado por el ERP **no desaparezca** de
  Recepción (`RecepcionPedidos.jsx`). Ver §4-bis.5–§4-bis.7.
- Acceso: enlace **"📦 Recepción de Pedidos"** en el sidebar admin, debajo de Dashboard
  Analítica (`AdminLayout.jsx`, fix `09d86a9`). Ruta `/admin/dashboard/recepcion`.

---

## 4-bis. Por qué un pedido puede DESAPARECER de la vista (diagnóstico 2026-06-29)

> **Síntoma reportado:** un pedido del portal aparece bien en **"Mis Compras"** y/o en
> **"Recepción"** cuando se crea, pero **días después YA NO se ve** en ninguna de las dos.
> Diagnóstico **concluyente** tras leer todo `src/` + `functions/`. Resumen: **el portal NO
> borra nada y NO es caché** — el documento desaparece (o pierde sus marcadores WALA) **cuando
> el ERP externo procesa el pedido**.

### 4-bis.1 El ciclo: crear → aparece → el ERP lo procesa → desaparece

```
  1) CLIENTE genera el pedido en el portal
       createWebOrder → addDoc REAL en pedidos_web/{autoId}   (§1.2)
       └─ con canalVenta:'Portal Web', web:true, activador:'portal_web', vendedor:'Portal Web'
       └─ si el addDoc falla, el checkout ABORTA antes de pagar (§1.4) → o se guarda, o no hay pedido

  2) APARECE en ambas vistas (leen pedidos_web, filtran esPedidoWala)
       • Mis Compras  → searchOrdersByDniInERP(dni)   (§4.1, where clienteNumeroDocumento exacto)
       • Recepción    → getWalaOrdersForAdmin()        (§4.2, esPedidoWala)

  3) EL OPERADOR DEL ERP externo (aimunayerp.com) "aprueba"/procesa el pedido     ◄── días después
       el ERP comparte el MISMO proyecto sistema-gestion-3b225 (misma base Firestore),
       entra por Admin SDK (ignora las reglas) y, al procesarlo, hace UNA de estas:
         (a) BORRA el doc de pedidos_web, o
         (b) le QUITA los marcadores WALA (web→false, etc.), o
         (c) le CAMBIA el formato del clienteNumeroDocumento (rompe el where exacto del DNI)

  4) DESAPARECE de ambas vistas
       • el doc ya no está en pedidos_web, o ya no cumple esPedidoWala, o ya no casa por DNI
       • el portal está DISEÑADO contando con (a)/(b): CartContext interpreta
         "doc eliminado de pedidos_web  O  web===false  =  pedido APROBADO" (CartContext.jsx:82-85)
```

### 4-bis.2 Lo que NO es (descartado en el código)

- **NO lo borra el portal.** No existe **ni un solo** `deleteDoc`/`.delete()` contra
  `pedidos_web` ni `pedidos` en todo `src/` + `functions/`. Las Cloud Functions
  (`processCulqiPayment`/`culqiWebhook`) solo hacen **`set … {merge:true}` idempotente** para
  marcar el pago (`pagado`/`estadoPago`/`montoPendiente`) — **nunca** borran ni quitan campos.
- **NO es caché.** `createWebOrder` (`erp/firebase.js:413`) hace un **`addDoc` REAL** a la nube,
  y el checkout **aborta antes de pagar** si la escritura falla (§1.4) → el pedido **sí queda
  guardado**. El `cachePedidos` de `usePedidos.js:20` es un **objeto en memoria del módulo, sin
  TTL**, que **muere al recargar la página**: no puede "borrar" nada días después.
- **NO es un fallo de guardado.** Ese caso ya está cubierto (fix `de1594b`, §1.4): si no se
  guarda, no hay pedido **desde el inicio** — no es un pedido que "aparece y luego se va".

### 4-bis.3 Causa raíz: el ERP externo, al procesar, BORRA o desmarca el doc

El **ERP `aimunayerp.com`** (Sistema de Gestión) es un **negocio aparte** que comparte el
**MISMO** proyecto Firebase y la **MISMA** base Firestore que el portal (`sistema-gestion-3b225`,
ver topología en la cabecera de este doc). Entra por **Admin SDK** (sin Firebase Auth →
**ignora las reglas**). Cuando su operador **"aprueba"/procesa** el pedido, el doc de
`pedidos_web` **deja de ser visible para el portal**, y por eso desaparece de **ambas** lecturas,
que **solo** leen `pedidos_web`:

- **Mis Compras** filtra por **DNI exacto** (`searchOrdersByDniInERP`, §4.1): si el ERP cambia
  el formato del `clienteNumeroDocumento`, el `where('==', dniNorm)` deja de casar.
- **Recepción** filtra por **`esPedidoWala`** (`adminOrders.js`, §4.2): es `true` si
  `canalVenta`/`web`/`activador`/`vendedor` valen `'Portal Web'`; si el ERP **borra el doc** o le
  **quita esos marcadores** (p. ej. `web → false`), el pedido **deja de cumplir el filtro**.

Los **"días después"** del síntoma = el momento en que **el operador del ERP procesa** el
pedido. No es un evento del portal: es un evento del **otro** sistema sobre la base compartida.

### 4-bis.4 ¿Se PIERDE el pedido pagado? (probablemente NO)

Lo más probable es que el pedido **no se pierda**: al procesarlo, el ERP normalmente lo **mueve
a la colección `pedidos`** (la "oficial"/validada del ERP). Para **confirmarlo** caso por caso:

- **Script de diagnóstico** (nueva opción `--buscar`, busca en **ambas** colecciones por
  `numeroPedido`/código/DNI):

  ```bash
  node scripts/diagnostico-pedidos.js --project sistema-gestion-3b225 --buscar PD-XXXX
  ```

  (`scripts/diagnostico-pedidos.js:147-192`.) O mirar directamente en la **consola Firestore**.
- **Interpretación del resultado:**
  - aparece en **`pedidos`** → **solo está OCULTO** para las vistas WALA (perdió los marcadores o
    el DNI): es **arreglable desde el lado WALA** (red de seguridad ya desplegada para pedidos
    nuevos, §4-bis.5).
  - **no aparece en NINGUNA** colección → **el ERP lo BORRÓ**: ya **no** es nuestro código,
    hay que **coordinar con el ERP** (FIX raíz, §4-bis.6). El espejo `wala_pedidos` (§4-bis.5) lo
    habría rescatado **si** se creó desde el deploy del 2026-06-29.

### 4-bis.5 DESPLEGADO: `wala_pedidos` como FUENTE DE VERDAD de WALA (espejo + `estadoWala` propio)

> **Estado:** ✅ **desplegado el 2026-06-29**. Dos commits encadenados:
> - `68447dc` — nace el **espejo** `wala_pedidos` (red de seguridad anti-pérdida).
> - `1d8f639` — el espejo **se gradúa a FUENTE DE VERDAD**: gana un **estado propio
>   `estadoWala`** que el portal **no degrada** cuando el ERP toca su doc, y el **pago lo
>   sincroniza el backend** (§4-bis.9).
>
> Ver el flujo del espejo en §4-bis.7, el del estado propio en §4-bis.9 y el modelo de datos
> en [MODELO-DATOS.md §3.7](./MODELO-DATOS.md).

**Decisión del dueño:** la base interna de WALA es la **fuente de verdad** del estado del
pedido; *"ya no importan los pedidos viejos"*. La colección **WALA-only `wala_pedidos`** (el ERP
**no la toca**) deja de ser un mero respaldo y pasa a **gobernar el estado** que ve el cliente,
independiente de lo que el ERP haga con `pedidos_web`. Lo entregado:

- ✅ **Copia propia de WALA** (`wala_pedidos`): la escribe `createWebOrder`
  (`src/services/erp/firebase.js`) en **fire-and-forget best-effort** tras guardar en
  `pedidos_web` (no demora ni rompe el checkout; **no copia secretos de pago**). Servicio
  `src/services/walaOrders.js` (`mirrorWebOrder` / `getWalaMirrorOrders` / `getAllWalaMirrorOrders`).
- ✅ **Estado propio `estadoWala`** (commit `1d8f639`): ciclo
  **`pendiente_pago` → `pagado` → `en_preparacion` → `enviado` → `entregado`**, con
  **`cancelado`** terminal alterno. Al crear nace **`pendiente_pago`**. Helpers en
  `walaOrders.js`: `ESTADOS_WALA`, `updateWalaOrderEstado` (idempotente/best-effort, crea con
  `setDoc{merge}` si no existía), `markWalaOrderPagado`, `estadoWalaADisplay`.
- ✅ **`mirrorWebOrder` NO degrada un pedido ya pagado:** antes de escribir hace `getDoc`; si el
  espejo **ya existe**, **conserva** su `estadoWala`/`pagado`/`createdAt` y **solo refresca los
  campos display** (un reintento/re-mirror **no** revierte a `pendiente_pago`). Si es nuevo, nace
  `pendiente_pago`.
- ✅ **Lectura por `userId`/`buyerUid` además del DNI:** `getWalaMirrorOrders({ userId, dni })`
  busca por `buyerUid` (camino preferente, inmune al cambio de formato del DNI) y por DNI
  (normalizado + crudo). `searchOrdersByDniInERP` acepta `{ userId }`, fusiona el espejo y
  **deduplica por clave de negocio**; una clave "viva" solo cuenta si el doc **sigue siendo WALA**
  (`esPedidoWala`), así un pedido **desmarcado** (`web:false`) **no suprime** su espejo.
- ✅ **Estado MÁS AVANZADO entre las dos fuentes:** `derivarEstadoCompra` (`estadoCompra.js`)
  mapea `estadoWala` (`estadoWalaAEstadoCompra`) y, cuando coexisten el doc vivo del ERP y el
  espejo, muestra el **más avanzado** de ambos (rango
  `por_confirmar_pago < pago_confirmado < en_preparacion < entregado`; `anulado/cancelado` gana
  si cualquiera lo marca). **No degrada** un "Entregado" del ERP a "pagado" ni viceversa. El
  pedido **solo-espejo** se ve **Confirmado/Procesado** (verde), **no** "Pendiente de pago".
  Recepción (`adminOrders.js` + `RecepcionPedidos.jsx`) lo incluye marcado **"Procesado en ERP"**.

**⚠️ LÍMITE (importante):** el espejo se crea **AL MOMENTO de la compra** → **solo protege
pedidos creados DESDE el deploy** (2026-06-29). Los pedidos **previos NO tienen espejo**: si el
ERP ya los borró de `pedidos_web` **y** de `pedidos`, **no se pueden recuperar**.

**FASE SIGUIENTE ⬜ (no implementada — el campo ya está listo):**
- **Endpoint con API KEY para el ERP**: que el ERP **LEA** y **SOLO ACTUALICE** `estadoWala`
  (jamás borre). `estadoWala` + `updateWalaOrderEstado` ya quedan listos; falta el endpoint y la
  credencial.

**Sigue ⬜ (no implementado):**
- **Robustecer `esPedidoWala`** para que **no dependa de `web===true`** (que el ERP puede
  apagar): bastaría con cualquiera de `canalVenta`/`activador`/`vendedor` = `'Portal Web'`.
- **Distinguir "Aprobado" de "no existe"**: hoy `CartContext` trata "doc ausente" como
  "aprobado" (`CartContext.jsx:82-85`); convendría no asumir aprobación por simple ausencia.

### 4-bis.6 FIX raíz (ERP — NO es nuestro código)

El espejo es una **red de seguridad**, no la cura: la causa raíz sigue siendo del ERP. Lo ideal
es que el ERP, **al aprobar, NO borre** el doc de `pedidos_web` sino que lo **marque conservando**
`canalVenta:'Portal Web'` + el `clienteNumeroDocumento` **normalizado** + `createdAt`. Esto
**elimina** la desaparición de raíz; el espejo solo **mitiga** sus efectos (y solo para pedidos
nuevos, ver el límite de §4-bis.5).

### 4-bis.7 Flujo del espejo: crear → copiar → (el ERP borra) → rescatar

```
  1) CLIENTE genera el pedido en el portal
       createWebOrder → addDoc REAL en pedidos_web/{autoId}            (§1.2, doc "vivo")
       └─ y, fire-and-forget best-effort, mirrorWebOrder(...) → wala_pedidos/{numeroPedido}
          (copia ligera WALA-only; si falla, NO afecta al checkout)

  2) APARECE en ambas vistas (leen pedidos_web + AHORA también wala_pedidos)
       • Mis Compras → searchOrdersByDniInERP({ dni, userId })   (fusiona vivo + espejo, dedup)
       • Recepción   → getWalaOrdersForAdmin() + getAllWalaMirrorOrders()

  3) EL OPERADOR DEL ERP "aprueba" → BORRA o desmarca el doc de pedidos_web   ◄── días después

  4) EL PEDIDO NO DESAPARECE:
       • el doc vivo ya no cumple esPedidoWala (o ya no está), PERO
       • la copia en wala_pedidos SIGUE viva (el ERP no la toca) → la vista la rescata
       • derivarEstadoCompra ve fuente:'wala-mirror' → lo muestra CONFIRMADO/Procesado (verde),
         NO "Pendiente de pago"   (estadoCompra.js, rama _fromMirror)
```

**Dedup vivo vs espejo:** la fusión deduplica por **clave de negocio**
(`numeroPedido || portalPseudoOrderId || pedidoWebId || id`). La clave "viva" solo gana si su doc
**sigue siendo WALA** (`esPedidoWala`); en cuanto el ERP lo desmarca (`web:false`), deja de
suprimir el espejo y **este pasa a representar el pedido**. Así no se ven duplicados mientras el
pedido vive, y no se pierde cuando muere.

### 4-bis.8 ⚠️ Aviso de seguridad (reglas de borrado)

Existe `firebase/firestore.rules.produccion:85` con **`delete: if isAuth()`** sobre
`pedidos_web` → **cualquier usuario logueado podría borrar** pedidos. El `firebase.json` apunta a
la versión **restrictiva** `firestore.rules:209-213` (**`delete: if isAdmin()`**). **Confirmar
que en producción esté la restrictiva**, no la de `.produccion` (más laxa). Nota: el ERP entra por
**Admin SDK**, que **ignora** las reglas en cualquier caso — esto es un riesgo aparte, del lado
del **portal**.

### 4-bis.9 El PAGO marca pagado en la FUENTE DE VERDAD (backend — commit `1d8f639`)

> **Requiere redeploy de functions:**
> `firebase deploy --only functions:processCulqiPayment,functions:culqiWebhook,functions:capturePaypalOrderSecure`.

Como `estadoWala` (§4-bis.5) gobierna el estado que ve el cliente, el **pago** también debe
moverlo a `pagado` en `wala_pedidos`, no solo en `pedidos_web`. Para eso, en los **3 puntos de
confirmación de pago** de `functions/index.js` se añadió el helper **`marcarWalaPedidoPagado(...)`**:

- **`processCulqiPayment`** (rama de éxito del cobro Culqi), **`culqiWebhook`** (respaldo del
  evento de Culqi) y **`capturePaypalOrderSecure`** (captura PayPal server-side) llaman a
  `marcarWalaPedidoPagado({ pedidoId, metodoPago, montoPagado })`, que pone en `wala_pedidos`
  **`estadoWala:"pagado"`** (+ `pagado:true`, `pagadoAt`).
- Es **ADITIVO**: corre **además** de marcar `pedidos_web` como hoy (§2.2 / §2.3). **NO toca
  montos, ni la firma del pedido, ni el marcado de `pedidos_web`.**
- Es **IDEMPOTENTE** (`set … {merge:true}`) y **BEST-EFFORT** (try/catch: el cobro ya ocurrió, un
  fallo aquí **no** rompe la respuesta del pago).
- **Localiza** el doc del espejo por `pedidoWebId` **y** por `numeroPedido` (queries de una sola
  condición → sin índice compuesto) y actualiza todos los match; si no halla ninguno, intenta por
  el **id estable saneado** (solo si ya existe); si tampoco, se omite (best-effort).
- Espejo del contrato del cliente: hace **lo mismo** que `markWalaOrderPagado` de
  `src/services/walaOrders.js` (mismos campos), para que el estado quede consistente venga el
  marcado del cliente o del backend.

```
  PAGO confirmado (Culqi éxito / webhook Culqi / PayPal capture server-side)
      │
      ├─► marca pedidos_web   (pagado:true / estadoPago:"pagado" / montoPendiente:0 …)  ← como hoy
      │
      └─► marcarWalaPedidoPagado(pedidoId)  →  wala_pedidos.estadoWala = "pagado"        ← NUEVO (1d8f639)
           (ADITIVO · IDEMPOTENTE · BEST-EFFORT · localiza por pedidoWebId/numeroPedido)
```

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
| `src/services/erp/firebase.js` | `createWebOrder` (escritura + escribe el espejo fire-and-forget), `searchOrdersByDniInERP` (Mis Compras, fusiona el espejo), `getOrderByIdAnyCollection` (detalle). |
| `src/services/walaOrders.js` | **FUENTE DE VERDAD `wala_pedidos`**: `mirrorWebOrder` (escribe la copia, no degrada si ya existe), `getWalaMirrorOrders`/`getAllWalaMirrorOrders` (lectura), `estadoWala`/`ESTADOS_WALA`, `updateWalaOrderEstado`, `markWalaOrderPagado`, `estadoWalaADisplay`. |
| `src/components/CulqiCustomCheckout/CulqiCustomCheckout.jsx` | Tokeniza y llama `processCulqiPayment`. |
| `functions/index.js` | `processCulqiPayment` (cobra + marca pagado), `culqiWebhook` (respaldo), `capturePaypalOrderSecure`; los 3 llaman `marcarWalaPedidoPagado` → `wala_pedidos.estadoWala:"pagado"` (§4-bis.9). |
| `src/components/PaypalCheckout/PaypalCheckout.jsx` | Captura PayPal (USD); marca pagado en cliente o server-side (flag). |
| `src/utils/estadoCompra.js` | `derivarEstadoCompra`/`esPagado`/`getProductosPedido` (estado y líneas). |
| `src/utils/pedidos.js` | `normalizarPedidoParaVista` (descarta campos → `_raw`). |
| `src/hooks/usePedidos.js` | Mis Compras: busca por DNI, filtra `esPedidoWala`, adjunta `_raw`. |
| `src/services/adminOrders.js` + `src/hooks/useAdminWalaOrders.js` | Recepción admin: lee, filtra, dedup, normaliza, resume. |
| `src/pages/cuenta/CuentaPedidosPage.jsx` | Vista "Mis Compras" (toma DNI del perfil). |
| `src/components/AdminLayout/AdminLayout.jsx` | Enlace de sidebar a Recepción. |

---

## 7. Commits relevantes (recientes)

- `1d8f639` — feat(pedidos): `wala_pedidos` pasa de respaldo a **FUENTE DE VERDAD** — nuevo
  `estadoWala` + helpers (`updateWalaOrderEstado`/`markWalaOrderPagado`/`estadoWalaADisplay`),
  `mirrorWebOrder` no degrada un pedido ya pagado, el pago marca `estadoWala:"pagado"` desde
  `functions/index.js` (requiere redeploy), y las vistas muestran el estado **más avanzado** entre
  ERP y WALA. Ver §4-bis.5, §4-bis.9 y §3.4.
- `68447dc` — feat(pedidos): red de seguridad anti-pérdida — espejo `wala_pedidos` (escrito en
  `createWebOrder` fire-and-forget), lectura por `userId`/DNI fusionada en Mis Compras y Recepción,
  estado Confirmado para el pedido solo-espejo. Ver §4-bis.5–§4-bis.7.
- `de1594b` — fix(pedidos): visibilidad — normaliza DNI al crear + no traga el fallo de
  guardado (abort con toast).
- `e84b6b1` — fix(pagos): Culqi marca el pedido como pagado tras el cobro exitoso.
- `09d86a9` — feat(admin): enlace "Recepción de Pedidos" en el sidebar.
