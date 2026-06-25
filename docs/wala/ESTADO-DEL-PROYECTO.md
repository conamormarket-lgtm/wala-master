# Estado del proyecto WALA — Panorama ejecutivo

> Documento vivo de **estado general**. Resume qué es Wala, qué trabajo se ha hecho en esta
> iniciativa, en qué fase estamos, qué hay realmente desplegado y qué falta. Es el punto de
> entrada de alto nivel; el detalle vive en [PLAN-MAESTRO.md](./PLAN-MAESTRO.md),
> [FASE-0-SEGURIDAD.md](./FASE-0-SEGURIDAD.md), [MODELO-DATOS.md](./MODELO-DATOS.md),
> [BASELINE-PRODUCCION.md](./BASELINE-PRODUCCION.md), [DESPLIEGUE.md](./DESPLIEGUE.md) y la
> carpeta [`fases/`](./fases/README.md).
>
> **Convención de estado:** ✅ **HECHO** · 🔧 **EN PROGRESO / PARCIAL** · ⬜ **POR HACER**.
> En lo HECHO se anota además el estado real: **cerrado**, **parcial** o **residual**.

> ## 📌 Banner de estado (actualizado 2026-06-24)
>
> **Fases 0, 1, 2, 2b, 3 (core + split de pago), 4 (base) y 5 (base) están HECHAS y
> VERIFICADAS EN LOCAL** sobre el **emulador de Firebase** (proyecto `demo-wala`), en la
> rama `fase-0-seguridad`. La verificación es **build (Vite) + emulador**, con pruebas E2E
> de los flujos núcleo (carrito → orden multi-vendedor → subórdenes → pago simulado →
> payouts; cofre diario; segmentación RFM).
>
> ⚠️ **Actualizado 2026-06-25 — EN PRODUCCIÓN.** El **frontend (Vite) está en vivo en Vercel**
> (wala.pe) y el **backend ya se desplegó al proyecto CORRECTO `sistema-gestion-3b225`**:
> **Cloud Functions ✅** (arregla el Kapi/juegos) e **índices ✅** (Wordle). **Pendiente:** secretos
> de Functions (Culqi/ERP), **fusión** de reglas con las del ERP/CRM (NO desplegar tal cual),
> admin claims, y re-promover el frontend `35ba2a2` (iconos/placeholders). El cobro real, la
> búsqueda externa, el push y los schedulers siguen requiriendo servicios externos.
>
> 👉 **Estado de despliegue detallado y "qué toca hacer": [DESPLIEGUE-ESTADO.md](./DESPLIEGUE-ESTADO.md).**
>
> **Super usuario local (solo emulador):** `admin@wala.test` / `wala1234` (admin) ·
> `cliente@wala.test` / `wala1234` (cliente).

> ## 🚨 Incidente 2026-06-25 — Deploy al proyecto equivocado
>
> - **Frontend en producción:** el frontend nuevo (migrado a Vite) **ya está desplegado en
>   producción en Vercel**. Esto actualiza el estado previo de "nada desplegado": el web ya
>   salió a producción.
> - **Error de topología en el backend:** hubo un **deploy al proyecto Firebase equivocado
>   (`pruebas-cd728`)**. El proyecto **correcto y ÚNICO de producción es
>   `sistema-gestion-3b225`** (portal + ERP comparten ese proyecto y su base Firestore).
>   `pruebas-cd728` **NO debe usarse**.
> - **Pendiente:** **re-desplegar el backend** (reglas Firestore, Cloud Functions, índices) a
>   `sistema-gestion-3b225`, asegurando que las reglas cubren tanto las colecciones del portal
>   como las del ERP (`pedidos`, `pedidos_web`) y las de analytics (`analytics_*`), que viven
>   todas en ese mismo proyecto. Ver [DESPLIEGUE.md](./DESPLIEGUE.md) (topología + deploy
>   granular desde Google Cloud Shell) y [MODELO-DATOS.md](./MODELO-DATOS.md).

---

## 1. Qué es Wala

Wala (marca legal **CATAS GROUP S.A.C. / "CON AMOR"**, también referida como "Regala Con
Amor") es un **marketplace peruano** construido sobre **React + Vite + Firebase +
Capacitor**, con el proyecto Firebase de producción `sistema-gestion-3b225` (portal + ERP
comparten ese proyecto y base Firestore; `pruebas-cd728` NO se usa). Hoy es, en la práctica,
una **tienda mono-marca con personalización print-on-demand 2D** más un sistema de
**fidelización diaria** ya en producción, y el objetivo de la iniciativa es convertirla en
un **marketplace multi-vendedor / multi-nicho estilo MercadoLibre + Temu con fidelización
diaria** (juegos, misiones, rachas, doble moneda canjeable).

Los tres **activos diferenciales** ya construidos son:

1. **Editor POD 2D** (fabric.js) — texto enriquecido, imágenes, cliparts, formas,
   multi-vista frente/espalda, zonas de impresión, undo/redo. Un mini-Printful funcional.
2. **Gamificación de retención** — Wordle diario, Ruleta semanal, Ball Sort, mascota
   KapiPet, retos, referidos y doble moneda (`monedas`/WalaCoins con TTL + `kapiCoins`).
3. **Page-builder no-code** + analytics/heatmap propios.

El diagnóstico completo (stack, capas, deuda técnica) está en
[PLAN-MAESTRO.md §1–§2](./PLAN-MAESTRO.md).

---

## 2. Cronología del trabajo realizado en esta iniciativa

Todo lo siguiente se realizó **en esta iniciativa**, en la rama `fase-0-seguridad`, y está
**verificado en LOCAL** (no desplegado — ver §5). El orden refleja la secuencia real de
trabajo.

### Paso 1 — Análisis multi-agente del repositorio *(✅ HECHO)*

- Auditoría estructurada de los **10 subsistemas** del repo mediante agentes, volcada en
  [`docs/wala/analisis-subsistemas.json`](./analisis-subsistemas.json) (1419 líneas).
- Resultado: el diagnóstico honesto del estado real (tienda mono-marca, economía en
  cliente, reglas Firestore desalineadas, CRA deprecado, `pruebas-cd728` como prod) que
  alimentó el plan maestro y el runbook de seguridad.

### Paso 2 — Respaldo, documentación y runbooks operativos *(✅ HECHO)*

- Commit **`c7c29ce`**: se creó toda la base documental y operativa de `docs/wala/` y
  `ops/`:
  - Documentos: `PLAN-MAESTRO.md`, `BASELINE-PRODUCCION.md`, `MODELO-DATOS.md`,
    `FASE-0-SEGURIDAD.md` (runbook con 11 hallazgos **H-01..H-11**), `DESPLIEGUE.md`,
    `README.md`, `analisis-subsistemas.json`.
  - Runbooks PowerShell en `ops/`: respaldo (`ops/backup/`), restauración
    (`ops/restore/`) y despliegue (`ops/deploy/`).
  - Infraestructura de despliegue: `firestore.indexes.json` (46 líneas) y ajuste de
    `firebase.json`.
- Filosofía fijada: **producción primero se respalda, después se toca** (ver
  [README.md](./README.md)).

### Paso 3 — Fase 0: Estabilización y seguridad *(✅ HECHO — parcial sobre 11 hallazgos)*

Tres commits que atacan los hallazgos críticos del runbook
[FASE-0-SEGURIDAD.md](./FASE-0-SEGURIDAD.md):

- **`3d53501`** — elimina el backdoor admin, introduce **custom claims**, valida pedidos
  ERP y reescribe reglas Firestore/Storage. Cierra/avanza **H-01, H-03, H-07, H-08, H-09**.
- **`9e84990`** — **economía server-authoritative**: mueve earn/spend/freeze/claim a Cloud
  Functions (+360 líneas en `functions/index.js`), adelgaza `AuthContext.jsx`, reescribe
  ruleta y ballSort para no escribir saldo desde el cliente. Avanza **H-02, H-05, H-06**.
- **`f0e4aa0`** — H-03 reforzado + fixes de revisión adversarial + **tests de economía**
  (`functions/test/economyLogic.test.js`, 44/44 verdes), extrae `functions/economyLogic.js`
  y endurece reglas.

Estado por hallazgo en §6. El **password = DNI** quedó resuelto migrando a magic link / set-password.

### Paso 4 — Fase 1: Plataforma y datos base *(🔧 EN PROGRESO)*

Cuatro commits que preparan el terreno multi-vendor y la velocidad:

- **`a3c4d66`** — **migración CRA → Vite** (build verificado). `public/index.html` → raíz,
  `package.json`/`package-lock.json` reescritos, `vite.config.js` nuevo (dev en puerto
  **3000**), `vercel.json` ajustado.
- **`a652f60`** — **base multi-vendor / multi-nicho + capa de búsqueda** (aditivo, no
  destructivo): `src/constants/marketplace.js` (defaults vendor `casa`, nicho
  `regala-con-amor`, `fulfillmentType`), servicios `niches.js`/`vendors.js`/`search.js` y
  extensión de `products.js`, `scripts/backfill-vendor-niche.js`, +1 línea en
  `firebase/firestore.rules`.
- **`f188260`** — **fix de runtime**: elimina los `require()` CommonJS que rompían con Vite
  en `Footer.jsx`, `TiendaPage.jsx` y `firebase/config.js`.
- **`0f2414f`** — **cablea búsqueda / nichos / vendedor a la UI**: rutas/páginas nuevas
  `SearchPage.jsx`, `NichePage.jsx`, `VendorPanel.jsx` y su registro en `App.jsx`.

### Paso 5 — Fases 2, 2b, 3, 4 y 5 sobre emulador *(✅ HECHO — verificado en LOCAL)*

Con la plataforma base lista, se construyó y **verificó E2E sobre el emulador `demo-wala`**
el núcleo del marketplace y la fidelización:

- **Fase 2 / 2b — Fidelización unificada (✅ base, local):** economía sobre `loyaltyLedger`,
  misiones/rachas y configuración de fidelización; consolidación en 2b.
- **Fase 3 — Marketplace multi-vendor (✅ core + split de pago, local):**
  `createOrderWithSubordersSecure` (recompute server-side, agrupado por vendedor, comisión y
  payout), colecciones `orders`/`subOrders`/`shippingZones`/`payouts`, UI `/admin/envios`,
  `/admin/payouts` y `VendorPanel`, y **split de pago Mercado Pago Marketplace en modo
  simulado** (`createCheckoutPreferenceSecure`, `confirmPaymentSecure`, `mercadoPagoWebhook`,
  rutas `/checkout-demo` y `/pago-demo/:orderId`). Detalle en §3.1.
- **Fase 4 — POD / arte de producción (🔧 base, local):** colección `blueprints` (CRUD
  `/admin/blueprints`, seed `bp-polo`) y `src/utils/productionArt.js` (DPI/export/validación).
- **Fase 5 — Impulso e inteligencia (✅ base, local):** `openDailyChestSecure` (cofre
  diario), `computeSegmentsSecure` (RFM solo admin) y `flashOffers` (CRUD `/admin/flash-offers`
  + vitrina `/ofertas`).

Verificado con el super usuario local `admin@wala.test` / `wala1234` (y cliente
`cliente@wala.test` / `wala1234`). Lo que falta para producción (cobro real, búsqueda
externa, push, schedulers, integración de editor/checkout) está en §7.

---

## 3. Tabla resumen de fases (0–5)

> Todo lo marcado ✅ está **verificado en LOCAL (emulador `demo-wala`)**, **no desplegado**.

| Fase | Objetivo | Estado | Entregables principales |
|------|----------|--------|-------------------------|
| **0 — Estabilización y seguridad** | Sellar dinero/puntos manipulables, eliminar backdoor, reglas reales, economía server-side. Bloqueante de todo lo demás. | ✅ **HECHO (parcial sobre 11 hallazgos)** | Commits `3d53501`, `9e84990`, `f0e4aa0`; custom claims; `firestore.rules`/`storage.rules` reescritas; CFs de economía + 44 tests; `scripts/set-admin-claims.js`. |
| **1 — Plataforma y datos base** | Migrar CRA→Vite, introducir `vendorId`/`nicheId`/`fulfillmentType` aditivos, búsqueda y paginación. | ✅ **HECHO (búsqueda externa pendiente)** | Commits `a3c4d66`, `a652f60`, `f188260`, `0f2414f`; `vite.config.js`; servicios niches/vendors/search; `backfill-vendor-niche.js`; páginas Search/Niche/Vendor. |
| **2 — Fidelización unificada** | Economía única sobre `loyaltyLedger`, misiones diarias, racha global, tiers/XP, push v2. | ✅ **HECHO (base, local)** | `loyaltyLedger`, misiones/rachas y configuración de fidelización verificadas en emulador. Push FCM v1 y campañas programadas pendientes (→ Fase 5 / Qué falta). |
| **2b — Refuerzo de fidelización** | Ajustes y consolidación sobre la base de Fase 2. | ✅ **HECHO (local)** | Verificado en emulador. |
| **3 — Marketplace multi-vendor** | Entidad `vendors` + panel, `orders`/`subOrders`, split de pago, payouts, envíos por zona. | ✅ **HECHO (core + split de pago, local)** | `createOrderWithSubordersSecure`; colecciones `orders`/`subOrders`/`shippingZones`/`payouts`; UI `/admin/envios`, `/admin/payouts`, `VendorPanel`; **split Mercado Pago Marketplace simulado** (`createCheckoutPreferenceSecure`, `confirmPaymentSecure`, `mercadoPagoWebhook`). Cobro REAL, Algolia, rol vendor por claims e integración de `CheckoutPage` pendientes. |
| **4 — Personalizados como nicho POD** | Arte de producción real (DPI/PDF), `blueprints` reutilizables, consolidar editores. | 🔧 **PARCIAL (base, local)** | `blueprints` (CRUD `/admin/blueprints` + seed `bp-polo`); `src/utils/productionArt.js` (`pxFromCm`, `exportProductionArtPNG`, `validatePrintResolution`). Integración con `EditorPage`, PDF de producción y fix de `finalCustomizedImage` pendientes. |
| **5 — Impulso, FOMO e inteligencia** | Cofres diarios, segmentación RFM, campañas programables, ofertas flash, antifraude. | ✅ **HECHO (base, local)** | `openDailyChestSecure` (cofre diario), `computeSegmentsSecure` (RFM solo admin), `flashOffers` (CRUD `/admin/flash-offers` + vitrina `/ofertas`). Push segmentado (FCM), campañas (Cloud Scheduler), recomendación IA y countdown en home pendientes. |

El detalle de cada fase está en la sección 6 del [PLAN-MAESTRO.md](./PLAN-MAESTRO.md) y en
el índice de [`fases/`](./fases/README.md).

### 3.1 Estado de implementación por fase (detalle verificado en emulador)

Leyenda: ✅ hecho y verificado · 🔧 parcial · ⬜ por hacer.

**Fase 3 — Marketplace multi-vendor (core local ✅ verificado E2E):**

- ✅ `createOrderWithSubordersSecure(items, shippingZoneId)`: recalcula precios server-side,
  agrupa por `vendorId`, crea `orders` (maestro) + `subOrders` con `vendorSubtotal`,
  `commissionPct`, `commissionAmount`, `vendorPayoutAmount`; envío por zona.
- ✅ Colecciones: `orders` `{ buyerUid, status, totals:{subtotal,shipping,commissionTotal,total}, subOrderIds }`,
  `subOrders` `{ orderId, buyerUid, vendorId, nicheId, items[], vendorSubtotal, commissionPct, commissionAmount, vendorPayoutAmount, status }`,
  `shippingZones` `{ name, departamento, cost, etaDays, active, order }`,
  `payouts` `{ vendorId, orderId, subOrderId, amount, status }`.
- ✅ UI: `/admin/envios` (AdminEnviosZonas), `/admin/payouts` (AdminPayouts), `VendorPanel`
  ve sus subórdenes; servicios `orders`/`shippingZones`/`payouts`.
- ✅ Reglas: `subOrders` (dueño/admin), `shippingZones` (pública/admin), `payouts` (admin),
  `orders` legible por `buyerUid`.
- ✅ Verificado E2E: carrito p1 (casa) + p3×2 (estampados-lima) → 1 `order` + 2 `subOrders`
  (casa com 0 / payout 49.9; estampados-lima com 12% = 14.38 / payout 105.42), envío 10,
  total **179.7**.
- ✅ **Split de pago (Mercado Pago Marketplace, simulado):** `createCheckoutPreferenceSecure`
  (`order` `pending_payment` + subórdenes; con `MERCADOPAGO_ACCESS_TOKEN` crea preferencia
  real con `marketplace_fee` = comisión total; sin token → `init_point` simulado
  `/pago-demo/:orderId`), `confirmPaymentSecure` (marca `paid` + crea payouts por vendedor,
  idempotente), `mercadoPagoWebhook` (HTTP, para producción). `services/payments.js`; rutas
  `/checkout-demo` y `/pago-demo/:orderId`. Verificado simulado: order 179.7 / comisión
  14.38 → `paid` + 2 payouts (49.9, 105.42).
- ⬜ Pendiente (servicios externos): cobro **REAL** (`MERCADOPAGO_ACCESS_TOKEN`,
  `MP_WEBHOOK_URL`, `MP_BACK_URL_BASE`), búsqueda Algolia/Typesense on-write, rol `vendor`
  por claims, integrar el checkout **REAL** (`CheckoutPage`) a este flujo.

**Fase 4 — POD / arte de producción (base ✅ verificada):**

- ✅ `blueprints` (colección, lectura pública / escritura admin):
  `{ name, baseGarment, printAreas:[{name,widthCm,heightCm,dpi}], decorationMethods:[], basePrintCost, active, order }`.
  `/admin/blueprints` (CRUD) + `services/blueprints.js`. Seed `bp-polo` (Polo clásico, 2
  áreas Frente/Espalda 30×40 cm @300 dpi).
- ✅ `src/utils/productionArt.js`: `pxFromCm(cm,dpi)`, `exportProductionArtPNG(fabricCanvas,{dpiMultiplier})`
  (export alta resolución), `validatePrintResolution({imgWidthPx,areaWidthCm,dpi})`.
  Verificado: 30 cm @300 dpi = 3543 px.
- ⬜ Pendiente (requiere editor/navegador): integrar `productionArt` en `EditorPage` (generar
  arte de producción al agregar al carrito, recorte por área del blueprint, validar
  resolución), generación de **PDF de producción**, fix de `finalCustomizedImage` para
  productos simples.

**Fase 5 — Impulso e inteligencia (base ✅ verificada E2E):**

- ✅ `openDailyChestSecure` (cofre diario): recompensa determinista 5–20 monedas una vez al
  día (Lima), idempotente por `lastChestDate`, ledger `source 'cofre_diario'`. Verificado:
  50 → 68 + 2ª apertura `alreadyOpened`.
- ✅ `computeSegmentsSecure` (**solo admin**): RFM sobre `orders` pagadas → segmento
  `vip` (monetary≥500 o freq≥3) / `activo` (freq≥1 y recency≤60) / `en_riesgo` (pedidos y
  recency>60) / `nuevo` (sin pedidos); escribe `portal_clientes_users/{uid}.segment`.
  Verificado: processed 2 → `{activo:1, nuevo:1}`, cliente = `activo`; cliente sin permiso →
  `PERMISSION_DENIED`.
- ✅ `flashOffers` (pública / admin): `{ title, productId, discountPct, startsAt, endsAt, active, order }`.
  `/admin/flash-offers` (CRUD + botón "Recalcular segmentos") + `/ofertas` (vitrina pública
  + botón Cofre diario). Servicios `flashOffers`/`chest`/`intelligence`. Reglas: `segment` y
  `lastChestDate` bloqueados al cliente (server-only). Seed de 2 ofertas.
- ⬜ Pendiente (servicios externos/scheduler): push segmentado (FCM), campañas programadas
  (Cloud Scheduler), recomendación por IA, countdown de ofertas flash en home.

---

## 4. Inventario de commits (rama `fase-0-seguridad`, `origin/master..HEAD`)

Del más nuevo al más viejo. Los stats son los reales del repositorio. Esta tabla cubre la
base de **fases 0–1**; el trabajo de fases 2–5 (núcleo de marketplace, pago simulado, POD y
fidelización) se resume en §2 (Paso 5) y §3.1.

| # | Commit | Fase | Qué hizo | Archivos clave |
|---|--------|------|----------|----------------|
| 8 | `0f2414f` | 1 | Cablea búsqueda/nichos/vendedor a la UI (rutas nuevas). | `src/App.jsx`, `src/pages/SearchPage.jsx`, `src/pages/NichePage.jsx`, `src/pages/VendorPanel.jsx` |
| 7 | `f188260` | 1 (fix) | Elimina `require()` CommonJS que rompía en runtime con Vite. | `src/components/common/Footer/Footer.jsx`, `src/pages/Tienda/TiendaPage.jsx`, `src/services/firebase/config.js` |
| 6 | `a652f60` | 1 | Base multi-vendor/multi-nicho + capa de búsqueda (aditivo). | `firebase/firestore.rules`, `scripts/backfill-vendor-niche.js`, `src/constants/marketplace.js`, `src/services/{niches,search,vendors,products}.js` |
| 5 | `a3c4d66` | 1 | Migración CRA → Vite (build verificado). | `index.html` (movido de `public/`), `package.json`, `package-lock.json`, `vercel.json`, `vite.config.js` |
| 4 | `f0e4aa0` | 0 | H-03 + fixes de revisión adversarial + tests de economía. | `firebase/firestore.rules`, `functions/economyLogic.js`, `functions/index.js`, `functions/test/economyLogic.test.js`, `src/App.jsx`, `src/components/common/Header/Header.jsx`, `src/services/accountFromOrder.js`, `src/services/firebase/ruleta.js` |
| 3 | `9e84990` | 0 | Economía server-authoritative (H-06). | `firebase/firestore.rules`, `functions/index.js` (+360), `src/contexts/AuthContext.jsx`, `src/pages/SubscriptionSurveyPage.jsx`, `src/services/firebase/ballSort.js`, `src/services/firebase/ruleta.js`, `src/services/referrals.js` |
| 2 | `3d53501` | 0 | Elimina backdoor admin, custom claims, valida pedidos ERP y reglas. | `firebase/firestore.rules`, `firebase/storage.rules`, `functions/index.js`, `functions/notificationsEngine.js`, `scripts/set-admin-claims.js`, `src/contexts/AuthContext.jsx`, `src/pages/LoginPage.jsx`, `src/services/referrals.js` |
| 1 | `c7c29ce` | Docs/Ops | Plan maestro, baseline, runbooks de respaldo/despliegue + índices. | `docs/wala/*` (7 docs + JSON), `firebase.json`, `firestore.indexes.json`, `ops/backup/*`, `ops/deploy/deploy.ps1`, `ops/restore/*` |

---

## 5. Estado de despliegue

> ⚠️ **Actualización 2026-06-25 (ver incidente arriba):** el **frontend (Vite) YA está en
> producción en Vercel**. El **backend** (reglas, functions, índices) **aún NO está bien
> desplegado**: hubo un deploy al proyecto equivocado (`pruebas-cd728`) y queda **pendiente
> re-desplegarlo al proyecto correcto y único de producción `sistema-gestion-3b225`** (portal
> + ERP comparten ese proyecto y base Firestore). El texto de emulador que sigue describe el
> estado de verificación previo del backend; tenlo en cuenta junto con esta actualización.

Todo el trabajo de las fases **0, 1, 2, 2b, 3 (core + pago), 4 (base) y 5 (base)** está
**verificado únicamente en LOCAL**, sobre el **emulador de Firebase** (proyecto demo
`demo-wala`):

- `vite build` ejecuta correctamente (migración Vite verificada).
- Servidor de desarrollo en **http://localhost:3000** (`vite.config.js` → `server.port: 3000`).
- **Emulador de Firebase (`demo-wala`)** con datos sembrados (seeds) y los flujos núcleo
  probados **E2E**: carrito → `order` multi-vendedor → `subOrders` → pago simulado →
  `payouts`; cofre diario; segmentación RFM.
- **Super usuario / usuarios de prueba (solo emulador):** `admin@wala.test` / `wala1234`
  (admin) · `cliente@wala.test` / `wala1234` (cliente).
- Tests de economía: **44/44 verdes** (`npm run test:functions`).
- Revisión adversarial con agentes sobre los cambios de seguridad.

Consecuencias mientras no haya acceso a Firebase:

- Las **reglas Firestore/Storage** reescritas en el repo **no están desplegadas**: el riesgo
  de "reglas fantasma" (repo ≠ producción) sigue vigente hasta que se desplieguen desde el
  repo (ver [DESPLIEGUE.md](./DESPLIEGUE.md)).
- Las **Cloud Functions** de economía existen y pasan tests, pero **no corren en producción**;
  la economía real sigue gobernada por lo que esté desplegado hoy.
- Los scripts que requieren credenciales (`scripts/set-admin-claims.js`,
  `scripts/backfill-vendor-niche.js`) **no se han ejecutado**: necesitan
  `GOOGLE_APPLICATION_CREDENTIALS` apuntando a la cuenta de servicio de `sistema-gestion-3b225`.
- El backfill multi-vendor/nicho **no se ha aplicado**; en runtime los productos sin
  `vendorId`/`nicheId` se leen con los defaults de `src/constants/marketplace.js`.

Secuencia de salida a producción cuando haya acceso: **respaldar** (`ops/backup/`) →
**staging** → **desplegar** reglas/functions/hosting por separado (`ops/deploy/`,
[DESPLIEGUE.md](./DESPLIEGUE.md)) → **verificar** → **rollback** si falla (`ops/restore/`).

---

## 6. Riesgos residuales vigentes

Estos riesgos **siguen abiertos** (residuales o parciales), aun con las fases 0–5 ya
construidas y verificadas en emulador, y deben cerrarse **al desplegar**. Referencias al
runbook [FASE-0-SEGURIDAD.md](./FASE-0-SEGURIDAD.md).

| Riesgo | Hallazgo | Estado | Nota |
|--------|----------|--------|------|
| **Reglas no desplegadas (repo ≠ prod)** | H-07/H-09 | 🔧 residual | Reescritas en repo, pero sin acceso a Firebase no están en producción; el desfase real persiste hasta desplegar. |
| **`orders`/pedidos con `create` público** | — | ⬜ abierto | La creación de pedidos sigue abierta; debe pasar por CF con recompute de totales server-side. |
| **`product_reviews` con `update` laxo** | — | ⬜ abierto | La actualización de reseñas no está suficientemente restringida; riesgo de manipulación de rating. |
| **Desync `monedas` vs `monedasActivas`** | H-06 | 🔧 parcial | La economía se movió a CF, pero la dualidad escalar (`monedas`) vs lotes TTL (`monedasActivas`) sigue; se resuelve al adoptar `loyaltyLedger` (Fase 2). |
| **Desync `monedas` (gastable) vs `kapiCoins` (XP)** | H-06 | ⬜ abierto | El header suma ambas pero solo `monedas` se gasta; unificación pendiente (Fase 2). |
| **Verificación real de retos/misiones** | H-04/H-06 | ⬜ abierto | Los `actionType` (compra/reseña/visita/compartir) aún no tienen emisor verificado server-side; antifraude pendiente. |
| **PayPal capturado en cliente / precio confiado al cliente** | H-11 | 🔧 parcial | El nuevo flujo seguro **recalcula precios y comisiones server-side** (`createOrderWithSubordersSecure` / `createCheckoutPreferenceSecure`, Fase 3), pero el checkout REAL aún no está integrado y la captura/validación de pago real (Mercado Pago/PayPal) sigue pendiente de configurar. |
| **FCM `sendToDevice` deprecado** | H-10 | ⬜ abierto | Migración a `sendEachForMulticast` (HTTP v1) pendiente (Fase 2). |
| **Password = DNI en webhook de cuentas** | H-03 | ✅ cerrado | Resuelto migrando a **magic link / set-password**; webhook con secreto y CORS restringido. |
| **Backdoor admin / emails hardcodeados** | H-01 | ✅ cerrado | Eliminado; admin vía custom claims (`scripts/set-admin-claims.js` para bootstrap). Queda pendiente **ejecutar** el bootstrap cuando haya acceso. |

---

## 7. Qué falta (bloqueado por servicios externos / despliegue)

Lo construido en las fases 3–5 funciona **en el emulador**; lo siguiente queda pendiente
porque depende de **acceso a Firebase, credenciales o servicios externos** que aún no están
configurados:

| Pendiente | Fase | Por qué falta |
|-----------|------|---------------|
| **Re-desplegar backend a producción** (reglas, functions, índices) al proyecto correcto `sistema-gestion-3b225` | Global | Hubo un deploy al proyecto equivocado (`pruebas-cd728`); el backend debe re-desplegarse a `sistema-gestion-3b225` (portal + ERP comparten proyecto y base Firestore). El frontend ya está en Vercel. Ver incidente 2026-06-25. |
| **Cobro REAL con Mercado Pago Marketplace** | 3 | Falta configurar `MERCADOPAGO_ACCESS_TOKEN`, `MP_WEBHOOK_URL`, `MP_BACK_URL_BASE`. Hoy el split funciona en modo **simulado**. |
| **Integrar el checkout REAL (`CheckoutPage`)** al flujo de subórdenes/split | 3 | El flujo verificado usa rutas demo (`/checkout-demo`, `/pago-demo/:orderId`); falta cablear el checkout de producción. |
| **Búsqueda con índice externo (Algolia / Typesense)** on-write | 1 / 3 | Requiere servicio externo y credenciales; hoy la búsqueda es la capa interna. |
| **Rol `vendor` por custom claims** | 3 | Requiere desplegar y emitir claims con credenciales de servicio. |
| **Push segmentado (FCM HTTP v1)** | 2 / 5 | Requiere credenciales y dispositivos reales; `sendToDevice` deprecado por migrar. |
| **Campañas programadas (Cloud Scheduler)** | 5 | Requiere infraestructura GCP desplegada. |
| **Recomendación por IA / countdown de ofertas flash en home** | 5 | Funcionalidad de producto pendiente sobre la base ya verificada. |
| **Integrar `productionArt` en `EditorPage`, PDF de producción, fix `finalCustomizedImage`** | 4 | Requiere trabajo en el editor/navegador; hoy existe la **base** (`blueprints` + utilidades). |
| **Bootstrap de admin y backfill multi-vendor/nicho en prod** | 0 / 1 | `scripts/set-admin-claims.js` y `scripts/backfill-vendor-niche.js` necesitan `GOOGLE_APPLICATION_CREDENTIALS` de `sistema-gestion-3b225`. |

Riesgos residuales de seguridad siguen en §6.

---

## 8. Cómo correr en local

Requisitos: **Node.js** (no instalado actualmente en la máquina del usuario — instalar
primero). Desde la raíz del repo:

```bash
npm install                 # instala dependencias (Vite + React)
npm run dev                 # servidor de desarrollo -> http://localhost:3000
npm run build               # build de producción (Vite) — verificado
npm run preview             # sirve el build para revisión
npm run test:functions      # tests de economía de Cloud Functions (44/44)
```

Scripts adicionales relevantes (`package.json`): `dev:3001` (Vite en puerto 3001),
`deploy:firestore-rules`, `deploy:storage-rules`, `deploy:functions`, `deploy:vercel` /
`deploy:vercel:prod` (estos de despliegue **no se usan todavía** — sin acceso a Firebase/Vercel).

**Variables de entorno (`.env`):** la app sigue usando el prefijo **`REACT_APP_*`** (no se
renombró a `VITE_*` en la migración; ver nota en `vite.config.js`). Se necesitan las claves
de Firebase del Portal (`REACT_APP_FIREBASE_*`), del ERP (`REACT_APP_ERP_FIREBASE_*`) y de
pagos/Cloudinary. Sin un `.env` válido la app arranca pero no conecta a backend.

Scripts con credenciales (requieren `GOOGLE_APPLICATION_CREDENTIALS` → service account de
`sistema-gestion-3b225`; **no ejecutados aún**):

```bash
node scripts/set-admin-claims.js yorh001@gmail.com heyeru24@gmail.com   # bootstrap admin
node scripts/backfill-vendor-niche.js --dry                            # simula backfill
node scripts/backfill-vendor-niche.js                                  # aplica backfill
```

---

## 9. Próximos pasos

El **núcleo de las fases 0–5 ya está construido y verificado en el emulador**; el siguiente
gran salto es **salir del emulador a producción** y conectar los servicios externos (ver §7).

1. **Re-desplegar el backend al proyecto correcto** `sistema-gestion-3b225` (NO `pruebas-cd728`) — el deploy se hace desde Google Cloud Shell (ya autenticado). Ver incidente 2026-06-25 y [DESPLIEGUE.md](./DESPLIEGUE.md).
2. **Respaldar producción** con `ops/backup/` y fijar el baseline
   ([BASELINE-PRODUCCION.md](./BASELINE-PRODUCCION.md)).
3. **Desplegar a staging y luego a prod** (reglas → functions → hosting, una pieza a la vez,
   [DESPLIEGUE.md](./DESPLIEGUE.md)); **ejecutar el bootstrap de admin** y verificar que las
   reglas desplegadas coinciden con el repo (cierra el riesgo de reglas fantasma).
4. **Cerrar residuales de Fase 0**: `orders create` público, `product_reviews update`,
   FCM v1, PayPal/precio server-side.
5. **Activar el cobro REAL (Fase 3):** configurar `MERCADOPAGO_ACCESS_TOKEN`,
   `MP_WEBHOOK_URL`, `MP_BACK_URL_BASE` e integrar `CheckoutPage` al flujo de subórdenes/split.
6. **Conectar servicios externos:** índice de búsqueda (Algolia/Typesense), push FCM v1,
   Cloud Scheduler para campañas; ejecutar `backfill-vendor-niche.js` y emitir el rol `vendor`.
7. **Cerrar Fase 4:** integrar `productionArt` en `EditorPage`, generar el PDF de producción
   y arreglar `finalCustomizedImage`.

Ver roadmap completo y decisiones técnicas en [PLAN-MAESTRO.md](./PLAN-MAESTRO.md).
