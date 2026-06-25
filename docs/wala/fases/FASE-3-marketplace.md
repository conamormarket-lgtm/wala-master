# FASE 3 — Marketplace multi-vendor

> **Estado global: CORE LOCAL ✅ HECHO y verificado E2E en emulador** (`demo-wala`, rama
> `fase-0-seguridad`, NO desplegado): pedido maestro + sub-órdenes por vendedor con
> comisión/payout, zonas de envío, pagos a vendedores, **y SPLIT DE PAGO (Mercado Pago
> Marketplace) verificado en modo simulado**. Ver §9 "Estado de implementación" y `CHANGELOG.md`.
> ⬜ Pendiente (REQUIERE SERVICIOS EXTERNOS): cobro REAL (configurar `MERCADOPAGO_ACCESS_TOKEN` /
> webhooks), búsqueda Algolia/Typesense on-write, rol `vendor` por claims, integrar el checkout
> REAL (`CheckoutPage`) a este flujo, y despliegue.
> Documento de diseño a profundidad. Fuente: `docs/wala/PLAN-MAESTRO.md` §5 y §6 (FASE 3), `docs/wala/MODELO-DATOS.md` §3, y lectura directa del código real (`functions/index.js`, `src/services/{orders,payments,shippingZones,payouts,vendors,niches,search,products}.js`, `src/constants/marketplace.js`, `src/pages/{SearchPage,NichePage,VendorPanel,CheckoutDemoPage,PagoDemo}.jsx`, `src/pages/admin/{AdminEnviosZonas,AdminPayouts}.jsx`, `firebase/firestore.rules`).
>
> **Base ya colocada por Fase 1** (commits `a652f60`, `0f2414f`): existen `src/services/vendors.js` (entidad con `ownerUid/status/type/commissionPct/payout/niches`), `src/services/niches.js` (colección `niches`), `src/constants/marketplace.js` (`DEFAULT_VENDOR_ID='casa'`, `DEFAULT_NICHE_ID='regala-con-amor'`, `FULFILLMENT_TYPES`), `src/services/search.js` (búsqueda facetada en memoria con **seam documentado** para Algolia/Typesense), `scripts/backfill-vendor-niche.js`, y la UI cableada (`SearchPage`, `NichePage`, `VendorPanel`). Fase 3 **convierte esa base aditiva en un marketplace operativo con dinero real** — CORE ya construido y verificado en emulador (ver §9).
>
> **Convención de estado:** ✅ hecho y verificado · 🔧 parcial · ⬜ por hacer.

---

## 0. Punto de partida real (qué ya existe vs qué falta)

| Pieza | Estado real | Archivo |
|---|---|---|
| Entidad `vendors` (no tag-string) | 🔧 CRUD existe; falta rol/claims `vendor` | `src/services/vendors.js` |
| Colección `niches` | 🔧 CRUD existe; falta storefront por nicho | `src/services/niches.js` |
| Campos `vendorId`/`nicheId`/`fulfillmentType` en producto | 🔧 defaults aditivos + backfill listo; falta correr backfill en prod | `src/constants/marketplace.js`, `scripts/backfill-vendor-niche.js` |
| Búsqueda facetada + paginación | 🔧 funciona en memoria; **seam** para servicio externo declarado | `src/services/search.js:8-11` |
| Panel `/vendedor` | 🔧 `VendorPanel.jsx` ve sus sub-órdenes (verificado); falta CRUD propio de catálogo completo | `src/pages/VendorPanel.jsx` |
| `order` maestro + `subOrders` | ✅ HECHO y verificado E2E (emulador) | `functions/index.js` (`createOrderWithSubordersSecure`), `src/services/orders.js` |
| Split de pago (Mercado Pago Marketplace) | ✅ HECHO y verificado simulado (emulador) | `functions/index.js` (`createCheckoutPreferenceSecure`/`confirmPaymentSecure`/`mercadoPagoWebhook`), `src/services/payments.js` |
| `payouts` por vendedor | ✅ HECHO y verificado; admin `/admin/payouts` | `functions/index.js`, `src/services/payouts.js`, `src/pages/admin/AdminPayouts.jsx` |
| Envíos por zona (`shippingZones`) | ✅ HECHO y verificado; admin `/admin/envios` | `src/services/shippingZones.js`, `src/pages/admin/AdminEnviosZonas.jsx` |
| `ledger` contable inmutable | ⬜ POR HACER (los `payouts` ya registran monto/estado; falta libro contable separado) | — |
| Pago online real (gate de email) en `CheckoutPage` | ⬜ POR HACER — flujo real bloqueado tras `user.email === 'pruebas001@gmail.com'`; el split nuevo vive en `/checkout-demo`+`/pago-demo` | `CheckoutPage` / pasarelas |
| Pagos server-side seguros (Culqi monto validado, PayPal capturado en CF) | 🔧 Fase 0 endureció `processCulqiPayment` (H-11); PayPal sigue capturado en cliente | `functions/index.js:624` (`processCulqiPayment`) |

---

## 1. Objetivo

Convertir Wala de **tienda mono-vendedor** a **marketplace multi-vendor / multi-nicho operativo**, con:

1. **Vendedores reales** con cuenta, rol (`vendor` por custom claim), panel propio y comisión.
2. **Pedido maestro + sub-pedidos por vendedor**, con **recompute server-side** de subtotales, envío, descuento (puntos), comisión y payout — **nunca confiando en el total del cliente**.
3. **Split de pago** (Mercado Pago Marketplace o Stripe Connect), **payouts** automáticos y **ledger contable inmutable** conciliable contra el `charge_id` de la pasarela.
4. **Envíos por zona reales** (`shippingZones`) por departamento/provincia/distrito/agencia, por vendedor.
5. **Búsqueda escalable** (Algolia/Typesense) alimentada on-write, reemplazando el filtrado en memoria.
6. **Páginas de nicho y vendedor** y **jerarquía de categorías**.
7. **Pago online real habilitado** (quitar el gate de email) con webhooks idempotentes.

---

## 2. Alcance / entregables (POR HACER)

- Rol `vendor` (custom claim) + función de onboarding/aprobación; panel `/vendedor` completo (catálogo propio filtrado por `vendorId`, reusando `AdminProductoFormV2`, vista de ventas y payouts).
- Carrito **segmentado por vendedor**; checkout que crea `orders` (maestro) + `subOrders` (por vendor).
- CF `createOrderSecure`: recomputa todo desde catálogo + `shippingZones` + `loyaltyConfig`, crea order + cargo, calcula comisión y payout por sub-orden.
- Integración de **split de pago** + colección `payouts` + `ledger` contable.
- Colección `shippingZones` + admin real `AdminEnviosZonas` (distinto del actual `AdminZonas`, que es layout de tienda).
- Adaptador de búsqueda externo (Algolia/Typesense) + CF de sync on-write; conmutar `src/services/search.js` por el adaptador **sin cambiar la firma de `searchCatalog()`**.
- Páginas `/nicho/:slug` y `/vendedor/:slug` con storefront por nicho (reusa page-builder); jerarquía de categorías (`parentId`, `level`, `nicheId`).
- Habilitar pago online: quitar gate `pruebas001@gmail.com`; webhooks Culqi/PayPal con idempotencia; PayPal capturado/validado en CF.
- Webhook de vuelta del ERP para conciliar estado de sub-orden y `monedasEnEspera → monedas`.

---

## 3. Modelo de datos

Referencia: `docs/wala/MODELO-DATOS.md` §3.2. Marcado **POR HACER** salvo donde se indique EN PROGRESO.

### 3.1 `vendors/{vendorId}` — rediseño a entidad (EN PROGRESO → completar)

Ya existe en `src/services/vendors.js`. Campos: `name`, `displayName`, `ownerUid`, `status` (`active`\|`pending`\|`suspended`), `type` (`house`\|`pod`\|`reseller`\|`self-fulfill`), `niches[]`, `commissionPct`, `payout {method, cci, walletPhone}`, `slug`, `logoUrl`. **Añadir en Fase 3:** `ratings {avg,count}`, `payoutAccountId` (id de la cuenta conectada en MP/Stripe), `kycStatus`, `balancePending`.

### 3.2 `niches/{nicheId}` (EN PROGRESO → completar)

Existe en `src/services/niches.js`: `slug`, `name`, `type`, `commissionPct`, `imageUrl`, `active`, `order`. **Añadir:** `storefrontConfigId` (FK a una página del page-builder), `theme`.

### 3.3 `orders/{orderId}` — pedido maestro (POR HACER)

| Campo | Tipo | Descripción |
|---|---|---|
| `buyerUid` | string | Comprador. |
| `status` | string | `pending_payment` \| `paid` \| `partially_fulfilled` \| `fulfilled` \| `cancelled` \| `refunded`. |
| `totals` | map | `{ itemsSubtotal, shipping, pointsDiscount, grandTotal }` **recomputados server-side**. |
| `loyalty` | map | `{ coinsSpent, coinsEarned }`. |
| `subOrderIds` | array | Ids de las sub-órdenes. |
| `payment` | map | `{ provider, chargeId, status, idempotencyKey }`. |
| `shippingAddress` | map | departamento/provincia/distrito/agencia. |
| `createdAt` | timestamp | — |

### 3.4 `subOrders/{id}` — split por vendedor (POR HACER)

| Campo | Tipo | Descripción |
|---|---|---|
| `orderId` | string | FK al maestro. |
| `vendorId` | string | Vendedor dueño. |
| `nicheId` | string | Nicho. |
| `items[]` | array | `{ productId, vendorSku, name, qty, unitPrice, lineTotal, customizationRef }`. |
| `fulfillmentType` | string | De `FULFILLMENT_TYPES`. |
| `vendorSubtotal` | number | Suma de líneas. |
| `shippingAmount` | number | Envío de este vendedor (de `shippingZones`). |
| `commissionAmount` | number | `vendorSubtotal * commissionPct` (override producto > vendor > nicho). |
| `vendorPayoutAmount` | number | `vendorSubtotal + shipping − commission` (la parte cubierta por puntos la asume la casa). |
| `productionStage` | string | Mapea etapas ERP: diseño→preparación→estampado→empaquetado→reparto. |
| `erpPedidoId` | string | FK a `pedidos_web` (ERP). |
| `payoutId` | string\|null | FK a `payouts` cuando se liquida. |

### 3.5 `payouts/{id}` y `ledger/{id}` (contable, POR HACER)

- **`payouts/{id}`**: `{ vendorId, period, amount, subOrderIds[], status (pending|sent|failed), providerTransferId, createdAt, sentAt }`.
- **`ledger/{id}`** (contable inmutable, distinto de `loyaltyLedger`): `{ type (sale|commission|payout|refund), vendorId, orderId, subOrderId, amount, chargeId, providerRef, createdAt }` — concilia contra el `charge_id` de la pasarela.

### 3.6 `shippingZones/{id}` (POR HACER)

| Campo | Tipo | Descripción |
|---|---|---|
| `vendorId` | string | Vendedor (o `casa`). |
| `departamento` / `provincia` / `distrito` | string | Jerarquía geográfica peruana. |
| `agencia` | string\|null | Agencia de envío. |
| `cost` | number | Costo de envío. |
| `etaDays` | number | Tiempo estimado. |
| `freeFrom` | number\|null | Umbral de envío gratis. |

Sustituye la regla global única (S/15 / gratis > S/100) hoy **duplicada y divergente** entre `Cart.jsx` y `CheckoutPage.jsx`.

### 3.7 `searchIndex` (externo Algolia/Typesense, POR HACER)

Docs planos con facets `nicheId`, `vendorId`, `categories`, `fulfillmentType`, `customizable`, `price`, `rating`, `salesCount`. Alimentado por CF on-write de `productos_wala`. Reemplaza `fetchAll()` en `src/services/search.js` (seam ya marcado en `:8-11`).

### 3.8 Índices compuestos (añadir a `firestore.indexes.json`)

| Colección | Query | Índice |
|---|---|---|
| `productos_wala` | catálogo por nicho ordenado por ventas | `nicheId ASC, salesCount DESC` |
| `productos_wala` | productos visibles de un vendedor, recientes | `vendorId ASC, visible ASC, createdAt DESC` |
| `subOrders` | cola de producción por vendedor | `vendorId ASC, productionStage ASC, createdAt ASC` |
| `subOrders` | sub-órdenes de un pedido | `orderId ASC, vendorId ASC` |
| `payouts` | payouts pendientes por vendedor | `vendorId ASC, status ASC, createdAt ASC` |
| `shippingZones` | zona por vendedor + ubicación | `vendorId ASC, departamento ASC, provincia ASC` |

---

## 4. Tareas detalladas (checklist) — POR HACER

### Bloque A — Vendedores y rol
- [ ] A1. Custom claim `vendor` + `vendorId` en el token; CF `setVendorClaim` (reusa el patrón de `setAdminClaim`, `functions/index.js:692`).
- [ ] A2. Onboarding de vendedor (alta `vendors` con `status=pending`) + aprobación admin (`status=active`).
- [ ] A3. Panel `/vendedor`: completar `VendorPanel.jsx` con CRUD de **su** catálogo (query `where vendorId == claim.vendorId`, reusar `AdminProductoFormV2`), vista de ventas (sus `subOrders`) y payouts.
- [ ] A4. Reglas Firestore: un vendedor solo lee/escribe productos con su `vendorId`; solo lee sus `subOrders`/`payouts`.
- [ ] A5. Correr `scripts/backfill-vendor-niche.js` en prod (cuando haya acceso a Firebase) para poblar `vendorId='casa'`/`nicheId='regala-con-amor'`.

### Bloque B — Pedido maestro, split y recompute
- [ ] B1. Carrito segmentado por vendedor en `CartContext`.
- [ ] B2. CF `createOrderSecure`: recomputa items desde catálogo, envío desde `shippingZones`, descuento de puntos vía `loyaltyLedger`/`loyaltyConfig` (Fase 2), comisión y payout por sub-orden; crea `orders` + `subOrders` en transacción. **Ignora cualquier total del cliente.**
- [ ] B3. Emitir el evento `make_purchase` de misiones (Fase 2) y `coinsEarned` al ledger al confirmarse el pago.
- [ ] B4. Enviar cada sub-orden POD al ERP (`pedidos_web`) etiquetada con `vendorId`; guardar `erpPedidoId`.

### Bloque C — Pagos reales y split
- [ ] C1. Quitar el gate `user.email === 'pruebas001@gmail.com'` detrás de un **feature flag** por entorno (conservar WhatsApp como opción durante la transición).
- [ ] C2. Elegir e integrar **Mercado Pago Marketplace** (muy usado en Perú) o **Stripe Connect** (deps ya presentes): cuentas conectadas por vendedor, retención de comisión, payouts.
- [ ] C3. Webhooks de pago **idempotentes** (Culqi/PayPal/MP): el estado `paid` solo lo fija el webhook verificado (cierra definitivamente H-08; PayPal deja de capturarse en cliente).
- [ ] C4. PayPal capturado/validado en CF (hoy 100% en cliente).
- [ ] C5. `ledger` contable: registrar `sale`/`commission` al cobrar; `payout` al liquidar; `refund` en devoluciones.
- [ ] C6. CF `runPayouts` (cron): agrupa `subOrders` liquidables por vendedor, crea `payouts`, dispara la transferencia del proveedor.

### Bloque D — Envíos
- [ ] D1. Colección `shippingZones` + seed por departamento/provincia/distrito.
- [ ] D2. Admin `AdminEnviosZonas` real (renombrar/aclarar el actual `AdminZonas` que es layout de tienda).
- [ ] D3. Unificar el cálculo de envío en una sola fuente (elimina la divergencia `Cart.jsx` vs `CheckoutPage.jsx`).

### Bloque E — Búsqueda y descubrimiento
- [ ] E1. Aprovisionar Algolia/Typesense/Meilisearch; definir el esquema `searchIndex`.
- [ ] E2. CF de sync on-write de `productos_wala` → índice (incluye desnormalizar `ratingAverage`/`salesCount`/`viewsCount`).
- [ ] E3. Implementar el adaptador en `src/services/search.js` respetando la firma de `searchCatalog()` (seam `:8-11`); conmutar por feature flag.
- [ ] E4. Paginación real con `getProductsPaginated` (ya existe, no usado).

### Bloque F — Páginas y categorías
- [ ] F1. `/nicho/:slug` y `/vendedor/:slug` con storefront por nicho (reusa page-builder vía `storefrontConfigId`).
- [ ] F2. Jerarquía de categorías (`parentId`, `level`, `nicheId`); consolidar `categories` vs `tienda_categories`.

### Bloque G — Conciliación ERP
- [ ] G1. Webhook de vuelta del ERP → CF que actualiza `subOrder.productionStage` y, al completar, convierte `monedasEnEspera → monedas` (ledger).

---

## 5. Criterios de aceptación

1. Un comprador con productos de 2 vendedores genera **1 `order` + 2 `subOrders`**, cada una con su comisión y payout correctos.
2. El total cobrado se **recomputa server-side**; manipular el precio/total en el cliente no cambia el cargo.
3. El estado `paid` solo cambia tras **webhook verificado**; PayPal ya no se captura en el cliente.
4. Un vendedor en su panel ve **solo** su catálogo, sus ventas y sus payouts; no puede leer datos de otro vendedor (verificado en Rules Playground / emulador).
5. El envío se calcula desde `shippingZones` por vendedor y ubicación; no quedan reglas de envío divergentes en el front.
6. La búsqueda devuelve resultados con facets y paginación desde el índice externo; agregar/editar un producto se refleja en el índice sin recargar todo el catálogo.
7. `runPayouts` genera `payouts` conciliables 1:1 contra entradas `ledger` y `charge_id` del proveedor.
8. Al completar el ERP, las monedas en espera del comprador se acreditan automáticamente.

---

## 6. Dependencias

- **Depende de Fase 0** (HECHO): custom claims (para el rol `vendor`), `processCulqiPayment` endurecido (H-11), reglas base.
- **Depende de Fase 1** (HECHO): `vendors`/`niches`/`search`/`fulfillmentType`, backfill aditivo, panel `VendorPanel` cableado.
- **Se apoya en Fase 2** para el descuento de puntos en checkout (`loyaltyLedger`/`loyaltyConfig`) y el cupón de envío gratis. Puede empezar en paralelo, pero la integración de puntos en `createOrderSecure` requiere el ledger de Fase 2.
- **Habilita Fase 4** (POD como nicho) y **Fase 5** (campañas por nicho/ciudad, segmentación).

---

## 7. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Backfill multi-vendor rompe el catálogo vivo | Caída de la tienda | Estrategia aditiva con defaults (ya implementada); backup previo; correr en staging primero. |
| Split de pago: ningún proveedor encaja perfecto en Perú | Bloqueo de payouts | PoC temprano de MP Marketplace y Stripe Connect; decidir por cobertura/KYC peruano; fallback a payouts manuales conciliados por `ledger`. |
| Cambio de canal (WhatsApp → online) friccion a usuarios | Caída de conversión | Feature flag de pago online; mantener WhatsApp durante transición. |
| Inconsistencia order↔subOrder↔ERP (estados descoordinados) | Pedidos colgados | Transacciones en `createOrderSecure`; webhook de vuelta del ERP; estado idempotente. |
| Costo del servicio de búsqueda externo | Gasto recurrente | Empezar con Typesense/Meilisearch self-host o plan básico Algolia; sync incremental. |
| Comisión mal calculada (precedencia override) | Pérdida o disputa con vendedor | Orden de precedencia explícito y testeado: producto > vendor > nicho. |

---

## 8. Esfuerzo estimado

**~5–6 semanas** (coincide con PLAN-MAESTRO §6, FASE 3).

| Bloque | Estimado |
|---|---|
| A — Vendedores y rol | ~1 sem |
| B — Order maestro + split + recompute | ~1.5 sem |
| C — Pagos reales y split de pago | ~1.5 sem |
| D — Envíos por zona | ~0.5 sem |
| E — Búsqueda externa | ~1 sem |
| F — Páginas/categorías | ~0.5 sem |
| G — Conciliación ERP | ~0.5 sem |

> Punto fino del cronograma: integración del split de pago (C2) y su KYC; presupuestar holgura por dependencia externa del proveedor.

---

## 9. Estado de implementación (local, verificado)

> Todo lo siguiente está **construido y verificado en el EMULADOR local** (proyecto `demo-wala`,
> rama `fase-0-seguridad`). **NO está desplegado.** Verificación hecha con super usuario local
> `admin@wala.test` / `wala1234` y cliente `cliente@wala.test` / `wala1234`. Build con Vite +
> emulador de Firebase.

### 9.1 Pedido maestro + sub-órdenes por vendedor — ✅ verificado E2E

- **CF `createOrderWithSubordersSecure(items, shippingZoneId)`** (`functions/index.js`): **recalcula
  precios server-side** desde `productos_wala`, agrupa los items por `vendorId`, y crea en una
  operación el `order` (maestro) + los `subOrders` (uno por vendedor), con
  `vendorSubtotal` / `commissionPct` / `commissionAmount` / `vendorPayoutAmount`. El **envío se
  resuelve por zona** (`shippingZoneId`). **Ignora cualquier total del cliente.**
- **Colecciones creadas:**
  - `orders` → `{ buyerUid, status, totals:{ subtotal, shipping, commissionTotal, total }, subOrderIds }`.
  - `subOrders` → `{ orderId, buyerUid, vendorId, nicheId, items[], vendorSubtotal, commissionPct, commissionAmount, vendorPayoutAmount, status }`.
  - `shippingZones` → `{ name, departamento, cost, etaDays, active, order }`.
  - `payouts` → `{ vendorId, orderId, subOrderId, amount, status }`.
- **Servicios cliente:** `src/services/orders.js`, `src/services/shippingZones.js`,
  `src/services/payouts.js`.
- **UI:** `/admin/envios` (`AdminEnviosZonas` — CRUD de zonas), `/admin/payouts`
  (`AdminPayouts`), y `VendorPanel` muestra las sub-órdenes del vendedor.
- **Reglas Firestore** (`firebase/firestore.rules`): `subOrders` legible por dueño/admin;
  `shippingZones` lectura pública / escritura admin; `payouts` solo admin; `orders` legible por su
  `buyerUid`.
- **Verificación E2E:** carrito con `p1` (vendedor `casa`) + `p3 ×2` (vendedor `estampados-lima`)
  → **1 `order` + 2 `subOrders`**:
  - `casa`: comisión 0 → payout **49.9**.
  - `estampados-lima`: comisión **12% = 14.38** → payout **105.42**.
  - shipping **10**, **total 179.7**.

### 9.2 Split de pago (Mercado Pago Marketplace) — ✅ verificado simulado

- **CF `createCheckoutPreferenceSecure({ items, shippingZoneId })`** (`functions/index.js`): usa el
  **mismo recálculo server-side** que `createOrderWithSubordersSecure`; crea el `order`
  (`status: 'pending_payment'`) + sus `subOrders`.
  - **Con `MERCADOPAGO_ACCESS_TOKEN`** configurado → crea la **preferencia real** en Mercado Pago
    con `marketplace_fee = comisión total` (split de pago del marketplace).
  - **Sin token** → devuelve un `init_point` **simulado** apuntando a `/pago-demo/:orderId`.
- **CF `confirmPaymentSecure({ orderId })`**: marca el `order` como `'paid'` y **crea los `payouts`
  por vendedor**. Es **idempotente** (no duplica payouts si se reinvoca).
- **CF `mercadoPagoWebhook`** (`onRequest`, HTTP): pensada para **producción** — dispara
  `confirmPayment` desde la notificación verificada de Mercado Pago.
- **Servicio cliente:** `src/services/payments.js`. **Rutas:** `/checkout-demo`
  (`CheckoutDemoPage`) y `/pago-demo/:orderId` (`PagoDemo`).
- **Verificación simulada:** `order` **179.7** / comisión **14.38** → tras confirmar pasa a
  **`paid`** + se generan **2 `payouts`** (**49.9** y **105.42**).

---

## 10. Pendiente (⬜ requiere servicios externos / integración)

> Lo construido vive en el flujo **demo** (`/checkout-demo` + `/pago-demo`) y en el emulador. Lo
> que falta requiere cuentas/servicios externos, claims, o conmutar el checkout real.

- **Cobro REAL con Mercado Pago:** configurar `MERCADOPAGO_ACCESS_TOKEN`, `MP_WEBHOOK_URL` y
  `MP_BACK_URL_BASE` para que `createCheckoutPreferenceSecure` genere la preferencia real y
  `mercadoPagoWebhook` reciba y verifique las notificaciones.
- **Integrar el checkout REAL:** conectar `CheckoutPage` (flujo de producción, hoy detrás del gate
  `pruebas001@gmail.com`) a este flujo de `orders`/`subOrders`/split, en lugar del demo.
- **Búsqueda escalable:** índice Algolia/Typesense alimentado **on-write** (CF de sync de
  `productos_wala`), reemplazando el filtrado en memoria de `src/services/search.js` (seam ya
  marcado).
- **Rol `vendor` por custom claims:** `setVendorClaim`, onboarding/aprobación, y restringir el
  panel `/vendedor` a su propio catálogo (hoy `VendorPanel` ya ve sus sub-órdenes, falta el CRUD
  propio del catálogo).
- **`ledger` contable inmutable** separado (`sale`/`commission`/`payout`/`refund`) conciliable
  contra el `charge_id` de la pasarela; hoy los `payouts` registran monto/estado pero no hay libro
  contable aparte.
- **`runPayouts` (cron)** que agrupe y dispare transferencias reales al proveedor.
- **Despliegue:** sin acceso a Firebase aún; todo verificado solo en build (Vite) + emulador.

> Nota: las piezas heredadas de Fase 1 que siguen 🔧 (entidad `vendors`, `niches`, búsqueda en
> memoria, backfill en prod) se detallan en §0 y §4.
