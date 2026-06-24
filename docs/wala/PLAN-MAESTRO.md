Voy a leer el material de referencia de visualización por si fuera necesario, pero primero el foco es el plan. Dado que el output debe ser únicamente el Markdown del plan, procedo a redactarlo directamente a partir del JSON.

# PLAN MAESTRO — WALA: De tienda mono-marca a marketplace de fidelización diaria

> Documento de arquitectura. Basado exclusivamente en el análisis estructurado de los 10 subsistemas. Donde el código actual contradice lo aspiracional, gana lo que dice el código.

---

## 1. Qué es Wala hoy (resumen ejecutivo del estado real)

Wala (marca legal CATAS GROUP S.A.C. / "CON AMOR") es **hoy una tienda mono-marca con personalización print-on-demand 2D, no un marketplace**. Lo que existe realmente:

- **Una sola tienda, un solo vendedor.** El catálogo vive en una única colección Firestore `productos_wala`. El campo `vendors` es solo un **array de strings/etiqueta**; `vendors.js` solo tiene `getVendors`/`createVendor`. No hay cuentas de vendedor, ownership de productos, comisiones ni payouts. El `vendedor` del pedido está **hardcodeado a "Portal Web"**.
- **Un editor de personalización 2D sorprendentemente potente** (fabric.js): texto enriquecido con fuentes propias, imágenes con quitar-fondo/recorte/tinte/máscara, cliparts, formas, multi-vista frente/espalda, zonas de impresión con formas vectoriales y dibujo libre, undo/redo, clipboard cross-view, combos personalizables y buena UX móvil. **Es un mini-Printful funcional** — aunque sin salida de arte de producción real (ver §2).
- **Un sistema de fidelización ya en producción y bastante maduro**: Wordle diario, Ruleta semanal, Ball Sort, mascota KapiPet (claim diario + racha), retos semanales con evidencia y aprobación admin, referidos con embudo de 4 etapas, fechas importantes/wishlist, doble moneda (`monedas`/WalaCoins con TTL + `kapiCoins` con reset mensual) y sumidero real en checkout (1 moneda = S/1, tope 50%).
- **Un motor de notificaciones push server-side** (FCM) con reglas de carrito abandonado (1h/24h/48h), retención Kapi (7d/14d), anti-spam (máx 2/día, ventana 9–21h) y campañas manuales segmentadas.
- **Un page-builder no-code real** (18 tipos de sección, editor visual WYSIWYG sobre iframe+postMessage, landings dinámicas por slug, temas CSS, importación de temas WordPress).
- **Analytics y heatmap propios** (sin GA), con funnel, tiempo real, UTM y geografía.
- **Pagos para el mercado peruano**: Culqi (cargo seguro en Cloud Function), PayPal (captura en cliente), Yape/Plin/transferencia "por WhatsApp", enlaces de pago. **El canal real dominante es cerrar por WhatsApp**; las pasarelas online están gateadas tras `user.email === 'pruebas001@gmail.com'`.
- **Integración con un ERP externo** (segundo proyecto Firebase `erp-firebase`, colecciones `pedidos`/`pedidos_web`) con pipeline de producción granular (diseño → preparación → estampado → empaquetado → reparto). El cierre de venta es semi-manual (validación humana en `pedidos_web`).

**Conclusión honesta:** Wala tiene **tres activos diferenciales ya construidos** (editor POD, gamificación de retención, page-builder) sobre una **base técnica frágil** (CRA deprecado, lógica económica en cliente, reglas Firestore desalineadas, proyecto Firebase llamado `pruebas-cd728` usado como producción). La visión MercadoLibre+Temu **no requiere reescribir los activos**, sino (a) tapar agujeros de seguridad, (b) introducir la entidad vendedor/nicho que hoy no existe, y (c) profesionalizar economía y búsqueda.

---

## 2. Arquitectura actual (stack, capas, riesgos)

### 2.1 Stack

| Capa | Tecnología real |
|---|---|
| Frontend web | Create React App (react-scripts 5.0.1), React 18.3.1, react-router 6 |
| Móvil | Capacitor 8 (Android publicado: versionCode 25, v1.3.21; App Links verificados para wala.pe) |
| Editor | fabric.js 5.5.2 |
| Backend | Cloud Functions (firebase-functions ^4 / firebase-admin ^11, Node 22) + Express mock muerto (`backend/`) |
| Datos | Firestore (2 proyectos: Portal `pruebas-cd728` + ERP `erp-firebase`) |
| Hosting | Vercel **y** Firebase Hosting (doble destino, ambiguo) |
| Pagos | Culqi (server-side), PayPal (client-side), Stripe (deps muertas) |
| Imágenes | Cloudinary + Firebase Storage + residual Google Drive |
| Búsqueda | Ninguna real: descarga toda la colección y filtra en cliente |

### 2.2 Capas lógicas (cómo fluye hoy)

```
Cliente React (CRA/Capacitor)
  ├─ AuthContext  →  TODA la economía de puntos (earn/spend/freeze) escrita desde cliente
  ├─ products.js  →  CRUD directo a Firestore + caché localStorage del catálogo completo
  ├─ CheckoutPage →  arma payload ERP, congela monedas, procesa referidos (≈950 líneas de negocio en UI)
  ├─ erp/firebase.js → escribe DIRECTO al 2º proyecto Firebase del ERP desde el navegador
  └─ Cloud Functions (lo único server-authoritative): Culqi charge, secureClaimMonedas, crons
```

### 2.3 Deuda técnica y riesgos CRÍTICOS (sé honesto)

**Seguridad / autorización**
- **Backdoor de admin hardcodeado** en `LoginPage.jsx` (`AdminWalaPro` / `LaClaveDeWala2020` → `localStorage.adminWalaPro='true'`) y **superadmins por email en el bundle** (`yorh001@`, `heyeru24@`). Cualquiera puede `localStorage.setItem('adminWalaPro','true')` y entrar al panel.
- **Reglas Firestore desincronizadas con la app**: `isAdmin()` lee `adminUsers/{uid}.role=='admin'`, pero el RBAC real vive en `adminRoles` (keyed por email). Probablemente `isAdmin()` **nunca es true** en reglas → o las reglas reales desplegadas son más permisivas que el repo (**configuración fantasma**), o la administración depende solo del gate de UI.
- **Colecciones sin reglas** en el repo: `productos_wala`, `tienda_categories`, `storeConfig`, `pages`, `landingPages`, `tienda_themes`, `adminRoles`, `analytics_*`, etc. Las reglas referencian `products`/`categories` (nombres que la app no usa).
- **Webhook `ensureAccountFromOrder` sin verificar secreto** (CORS `*`); crea cuentas con **contraseña = DNI** (PII adivinable en Perú).
- `enlaces_pago`: regla `allow update, delete: if true` (cualquiera marca pagado/borra).
- **Economía manipulable**: `feedKapi`, `spendMonedas`, `processChallengeEvent`, ruleta y ballSort **escriben monedas desde el cliente**; campos como `kapiCoins`, `weeklyClaimsData`, `lastBallSortReward`, `activeMultiplier` **no están protegidos**. `secureClaimMonedas` tiene la **verificación de propiedad del pedido comentada** → farmeo de monedas con cualquier `pedidoId`.
- PayPal **captura 100% en cliente** sin verificación server-side; el estado `pagado` es manipulable.
- **El precio se confía al cliente**: el monto enviado a Culqi/PayPal sale del front; no hay revalidación contra catálogo.

**Bugs concretos de pérdida de datos / dinero**
- `referrals.js` (`claimReferralCoins`, `updateReferralCode`) escribe en `portal_users` en vez de `portal_clientes_users`: **el saldo real del usuario no se actualiza**.
- `PerfilPage` muestra/copia `KS-<primeros 6 del uid>`, distinto del `referralCode` real (`KS-XXXXXX`) que valida el sistema.
- **Render de producción roto para producto simple**: en `handleAddToCart`, `finalCustomizedImage` solo se genera para combos; en simples `imageURL` queda `null` y el ERP recibe solo JSON de capas → el operario recompone a mano.
- Tres definiciones distintas del premio de referido (10/20 fijo vs `floor(total/100)*5` vs "por cada S/100").
- Cálculo de fecha "hoy" inconsistente (UTC vs local) entre Wordle/Kapi/BallSort → rachas rotas cerca de medianoche en UTC-5.

**Escalabilidad**
- Búsqueda/filtros/orden **client-side sobre toda la colección**; `getProductsPaginated` existe pero no se usa.
- Crons (`notificationEngine` horario, `notifyWishlistBirthdays`, campañas) hacen **full scan** de `portal_clientes_users` cada vez. No escala.
- `messaging.sendToDevice` (**API FCM legacy deprecada**); tokens inválidos nunca se limpian.
- Inventario **plano** (`inStock` entero global); sin stock por talla/variante ni reserva en checkout.

**Plataforma**
- **CRA deprecado** (sin mantenimiento, builds lentos, vulnerabilidades transitivas; `.npmrc` con `legacy-peer-deps=true`).
- Proyecto Firebase de prod se llama `pruebas-cd728`; sin separación dev/staging/prod.
- Sin CI/CD, sin tests, sin `firestore.indexes.json`, sin observabilidad (Sentry/Crashlytics), sin App Check.
- Doble motor de personalización (`editor/` + `YoryoPersonalizado/WALA_Editor_Export/` casi idéntico).
- Archivos basura versionados en raíz (`update*.js`, `patch_*.js`, `scratch/`, `eslint_report.json` 1.7 MB).

---

## 3. Arquitectura objetivo propuesta

### 3.1 Principios rectores

1. **Una cuenta, una economía.** El usuario y su saldo de puntos son **globales y transversales** a todos los nichos y vendedores. La fidelidad **nunca** se segmenta por vendedor; las comisiones se calculan sobre el valor neto pagado descontando la parte cubierta por puntos (a cargo de la casa).
2. **El servidor es la única fuente de verdad para dinero y puntos.** El cliente solo dispara y lee.
3. **Extender, no migrar destructivamente.** Añadir `vendorId`/`nicheId` con defaults (`vendor 'casa'`, nicho `'regala-con-amor'`) y backfill; nunca romper el catálogo en producción.
4. **Tres áreas, un mismo núcleo:** Personalizados (POD), Marketplace general (stock), Juegos/Misiones. Comparten cuenta, economía, checkout, búsqueda y push.

### 3.2 Áreas del producto y cómo se montan sobre lo existente

| Área | Reutiliza | Necesita |
|---|---|---|
| **Personalizados (Printful-like)** | Editor fabric.js, `customizationViews`/`printAreas`/`designs`, pipeline ERP por etapas | `blueprints` reutilizables, salida de arte de producción real (DPI/PDF), `fulfillmentType='print_on_demand'`, vendor POD |
| **Marketplace general (no personalizado)** | Catálogo `productos_wala`, taxonomías, reviews, page-builder | `fulfillmentType='stock'`, stock por variante, envíos por zona, multi-vendor, búsqueda Algolia/Typesense |
| **Juegos / Misiones** | Wordle, Ruleta, Ball Sort, Kapi, retos | Motor `missions` configurable, racha global, tiers/XP, ledger de puntos, antifraude |

### 3.3 Estructura de carpetas/módulos sugerida (post-Vite)

```
src/
  core/                      # transversal a las 3 áreas
    auth/                    # AuthContext slim (solo identidad + lectura de saldo)
    loyalty/                 # cliente del ledger; NUNCA escribe saldo directo
    money/                   # totales, monedas, cupones (lectura)
    api/                     # wrappers de Cloud Functions callable (único canal de escritura sensible)
  features/
    catalog/                 # productos, taxonomías, búsqueda (Algolia/Typesense)
    customizer/              # editor fabric.js UNIFICADO (deprecar YoryoPersonalizado)
    marketplace/             # listados por nicho/vendor, fichas, filtros facetados server-side
    cart-checkout/           # carrito segmentado por vendor + sub-órdenes
    loyalty-games/           # Wordle, Ruleta, BallSort, Kapi, misiones diarias, cofres
    seller/                  # panel del vendedor (catálogo propio, ventas, payouts)
    admin/                   # super-operador (RBAC, page-builder, economía, notificaciones)
    notifications/           # registro tokens, deep links, in-app tray
  config/                    # erp, empresa, loyaltyConfig (lectura)
functions/                   # backend server-authoritative
  loyalty/                   # earn/spend/freeze/claim → ledger (idempotente)
  orders/                    # crear order maestro + split en subOrders + recompute precios
  payments/                  # Culqi/PayPal/webhooks + idempotencia + conciliación
  marketplace/               # comisiones, payouts, sync índice de búsqueda on-write
  missions/                  # generateDailyMissions, rotación, computeSegments
  notifications/             # engine v2 (topics + multicast HTTP v1), campañas programadas
```

### 3.4 Modelo de datos objetivo (Firestore)

**Extender (no migrar) `productos_wala/{id}`** — añadir:
`vendorId` (FK string canónica, NO array), `nicheId`, `fulfillmentType` (`print_on_demand`|`stock`|`made_to_order`|`dropship`), `productionBlueprintId`, `commissionPctOverride`, `vendorSku`, `leadTimeDays`, `shippingProfileId`. Desnormalizar métricas de ranking: `ratingAverage`, `ratingCount`, `salesCount`, `viewsCount`. Reestructurar `sizes` a `[{size, stock}]` (ya previsto en `tienda_producto_schema.json`).

**Colecciones nuevas / rediseñadas:**

- `niches/{nicheId}`: `{ slug, name, type, commissionPct, theme, storefrontConfigId, active, order }`.
- `vendors/{vendorId}` (rediseñar de tag-string a entidad): `{ displayName, ownerUid, status, type ('pod'|'reseller'|'self-fulfill'|'house'), niches[], commissionPct, payout{method,cci,walletPhone}, ratings{avg,count}, slug, logoUrl }`.
- `blueprints/{id}` (evolución de `productTypes`): `{ name, baseGarment, printAreas[], mockupTemplates[], variantMatrix, basePrintCost, decorationMethods[] }`.
- `orders/{orderId}` (maestro, en proyecto principal): `{ buyerUid, status, totals, loyalty{coinsSpent,coinsEarned}, subOrders[] }`.
- `subOrders/{id}`: `{ orderId, vendorId, nicheId, items[], fulfillmentType, vendorSubtotal, commissionAmount, vendorPayoutAmount, productionStage, erpPedidoId }`.
- `payouts/{id}` y `ledger/{id}` (contable inmutable: venta, comisión, payout, reembolso).
- `loyaltyLedger/{id}`: `{ uid, type(earn|spend|expire|adjust), source, amount, currency(points|walacoins|kapicoins), balanceAfter, refId, nicheId, idempotencyKey, createdAt }` — **fuente de verdad del saldo**.
- `missions/{id}` (generaliza `weeklyChallenges`): `{ scope(daily|weekly|seasonal), actionType, goal, rewardPoints, tierMultiplier, segment, nicheTag, activeFrom/To }`.
- `userMissions` (subcolección `users/{uid}/missions/{date}`): instancia diaria con `progress/status/expiresAt`.
- `tiers/{id}`, `rewardsCatalog/{id}`, `userCoupons/{id}`, `dailySpins`/`chests`, `flashOffers`, `segments/{uid}`, `loyaltyConfig/global` (tasas, topes, equivalencia puntos↔soles, feature flags).
- `shippingZones/{id}` (departamento/provincia/distrito/agencia → costo + tiempo, por vendor).
- `searchIndex` (externo Algolia/Typesense): docs planos con facets `nicheId, vendorId, categories, fulfillmentType, customizable, price, rating`.

**Categorías:** jerarquizar (`parentId`, `level`, `nicheId`) y **consolidar** la duplicidad `tienda_categories` vs `categories`.

---

## 4. Sistema de fidelización unificado

### 4.1 Economía de puntos única

- **Decisión:** una sola moneda dura canjeable (mantener **WalaCoins/`monedas`** como "puntos"). `kapiCoins` deja de ser segunda moneda gastable y pasa a ser **XP/racha diaria** que se convierte en puntos. Esto elimina la confusión actual de `Kapicoin`/`Wala Coins`/`WalaCoins`/`monedas` que hoy solo se suman en el header (`Math.floor(monedas)+kapiCoins`) pero solo `monedas` se gasta.
- **`loyaltyLedger` como fuente de verdad.** Todo earn/spend/expire/adjust escribe una entrada inmutable; el saldo se deriva del ledger. Resuelve la dualidad `monedas` (escalar) vs `monedasActivas` (lotes TTL) que hoy divergen (`calculateActiveCoins` ignora la expiración).
- **`loyaltyConfig/global`** centraliza tasas, topes diarios/mensuales y equivalencia puntos↔soles, hoy hardcodeados (`REWARD_AMOUNT=2`, tope 31 kapiCoins, TTL 90 días, costos de catálogo).

### 4.2 Reutilización de lo ya construido

| Activo existente | Rol en el sistema unificado |
|---|---|
| **Wordle** (sin recompensa hoy) | Misión diaria que **sí otorga puntos** |
| **Ball Sort** (+2 monedas/día) | Misión diaria; mantiene su `runTransaction` |
| **Mascota Kapi + feedKapi** | "Home" de misiones diarias; el claim diario alimenta la **racha global** |
| **weeklyClaimsData** | Base de la racha; generalizar a racha transversal con `streak freeze` |
| **Ruleta semanal** (sorteo ponderado) | Reutilizable para **ruleta diaria y cofres** (con pity-timer) |
| **Retos + processChallengeEvent** | Generalizar `weeklyChallenges` → `missions` (daily/weekly/seasonal); cablear los `actionType` ya definidos (compra, reseña, visita, compartir) que hoy no tienen emisor (solo `add_wishlist` está conectado) |
| **Referidos** | Misión social; unificar la fórmula de premio en `loyaltyConfig` |
| **Reseñas** (sin recompensa hoy) | Otorgar puntos por reseña con foto (loop post-compra) |

### 4.3 Misiones diarias, rachas, niveles

- **Misiones diarias:** CF `generateDailyMissions` (cron 00:05 America/Lima) asigna 3 misiones/día por segmento a `users/{uid}/missions`.
- **Racha global** `dailyStreak {count, lastDate, freezeTokens}` desacoplada de la ruleta, con recompensas crecientes (D3/D7/D14/D30) y "streak freeze" para reducir churn. Terminar el `daily_visit` que quedó a medias en `KapiPet.jsx`.
- **Tiers/XP:** `xp` solo-sube → `tier` (bronce/plata/oro/diamante) con beneficios (multiplicador de monedas, envío gratis desde umbral, cofres exclusivos, badge). El multiplicador se aplica **server-side** en cada earn.

### 4.4 Push de retención y mecánicas de impulso (FOMO)

- Conectar copys del admin (`{a,b}`) con el engine (que hoy los lee como string → editar copys no afecta los push reales).
- Cablear **deep link del push** (`pushNotificationActionPerformed` + `data.deepLink` → `DeepLinkHandler`); hoy el tap no navega.
- Impulso: **cashback inmediato** proporcional al monto, banner "te faltan X puntos para [recompensa]", **ofertas relámpago** (`flashOffers`) con stock/contador, ruleta diaria y cofres con llaves.
- `rewardsCatalog` dinámico (hoy hardcodeado en `CatalogReward.jsx`) + emisión de `userCoupons` persistentes integrados al checkout (hoy el canje "gasta" sin generar nada).

### 4.5 Antifraude (transversal)

- **Todo earn/spend pasa por Cloud Functions callable idempotentes** (`idempotencyKey = uid+source+fecha`) que validan topes y escriben ledger en transacción.
- Endurecer reglas: `monedas`/`kapiCoins`/`xp`/`loyaltyPoints` **no escribibles por el cliente**.
- Registrar `deviceIds` (Capacitor), `velocityScore`, límites de velocidad por uid/día.
- Referidos: no acreditar si referrer y referido comparten device/IP; exigir **compra real verificada** antes de acreditar.
- Mover el RNG de la ruleta y la validación de "ganador" del Wordle al servidor.

---

## 5. Marketplace multi-vendor / multi-nicho

### 5.1 De tag-string a entidad vendedor

Hoy no existe nada multi-vendor. Pasos:
1. Backfill: cada producto recibe `vendorId` (default vendor "casa") y `nicheId` (default).
2. Rediseñar `vendors/{vendorId}` con `ownerUid`, `status`, `type`, `commissionPct`, `payout`.
3. Rol `vendor` + panel `/vendedor` con CRUD de **su** catálogo (filtrado por `vendorId`, reusando `AdminProductoFormV2`). Empezar con **vendedores curados** (la casa + 1–2 partners de ropa personalizada).

### 5.2 Carrito, pedido y split

- Carrito **segmentado por vendor** → al checkout se crea **`order` maestro** (proyecto principal) y **`subOrders` por vendor**.
- Una Cloud Function **recomputa subtotal/envío/descuento/comisión desde el catálogo** (nunca confiar en el total del cliente) y crea order + cargo (server-authoritative).
- Cada sub-pedido POD se envía al ERP (`pedidos_web`) etiquetado con `vendorId`; los estados de producción (diseño→preparación→estampado→empaquetado→reparto) se mapean a `subOrder.productionStage`.
- **Conciliación `monedasEnEspera → monedas`** vía CF cuando el ERP marca completado (hoy no hay webhook de vuelta).

### 5.3 Comisiones y payouts

- `commissionAmount`/`vendorPayoutAmount` por sub-pedido; `payouts/{id}` periódicos por vendor; `ledger` inmutable para conciliar contra `charge_id` de la pasarela.
- **Split de pago:** Culqi no soporta marketplace split directo. Evaluar **Mercado Pago Marketplace** (muy usado en Perú) o **Stripe Connect** (ya hay deps de Stripe) para retener comisión y hacer payouts automáticos.

### 5.4 Búsqueda y descubrimiento

- Reemplazar `searchProducts` (descarga toda la colección) por **Algolia/Typesense/Meilisearch**, alimentado por CF on-write, con facets `nicheId/vendorId/categories/fulfillmentType/price/rating` y ranking por relevancia/popularidad/ventas.
- **Paginación real** con `getProductsPaginated` (ya existe, no usado).
- Páginas de nicho (`/nicho/:slug`) y vendor (`/vendedor/:slug`) reutilizando el page-builder (un `storefront/config` por nicho).

### 5.5 Envíos

- `shippingZones` reales por departamento/provincia/distrito/agencia (ya se captura esa data), con costo y tiempo **por vendor**. Renombrar el actual `AdminZonas` (que es **layout de tienda**, no envíos) y crear un `AdminEnviosZonas` real. Sustituir la regla global única (S/15 / gratis > S/100, hoy **duplicada y divergente** entre `Cart.jsx` y `CheckoutPage.jsx`).

### 5.6 Pipeline de producción para personalizados (POD)

- Promover `productTypes` a `blueprints` reutilizables (printAreas + matriz de variantes + costo base de impresión) para que varios vendors POD publiquen sobre el mismo blueprint.
- **Cerrar la brecha de arte de producción** (crítico): generar `finalCustomizedImage` también para productos simples; pipeline de arte separado del thumbnail (PNG transparente a resolución nativa, DPI/sangrado, eventual PDF/SVG); introducir **medidas físicas (cm) y DPI** por `printArea` con validación de baja resolución.

---

## 6. Roadmap por fases

> **Leyenda:** ✅ **YA lo tenemos** (existe en el código) · 🔧 **a corregir/cablear** (existe a medias) · 🆕 **a construir**.

### FASE 0 — Estabilización y seguridad (bloqueante, ~3–4 semanas)
*Por qué primero: hoy el dinero y los puntos son manipulables y la administración depende de un gate de UI. Sin esto, nada del marketplace es confiable.*

- 🔧 Eliminar **backdoor admin** y emails hardcodeados → custom claims de Firebase Auth.
- 🔧 **Reglas Firestore reales y versionadas**: `isAdmin()` desde la misma fuente que la app; cubrir todas las colecciones (`productos_wala`, `tienda_categories`, `storeConfig`, `pages`, `landingPages`, `tienda_themes`, `adminRoles`, `analytics_*`, `loyalty*`); cerrar `enlaces_pago` (`update/delete: if true`).
- 🔧 Asegurar webhook `ensureAccountFromOrder` (HMAC/secreto) y **dejar de usar DNI como contraseña** (magic link / set-password).
- 🔧 Reactivar verificación de propiedad/estado del pedido en `secureClaimMonedas`.
- 🔧 Mover economía (earn/spend/freeze/claim) a **Cloud Functions idempotentes** + `loyaltyLedger`.
- 🔧 Bug `portal_users` → `portal_clientes_users` en `referrals.js`; unificar `referralCode` en `PerfilPage`.
- 🔧 Util único de fecha en **America/Lima** (arregla rachas rotas).
- 🆕 **App Check** (web + Android); separar proyectos Firebase (prod real + staging), dejar de usar `pruebas-cd728`.
- 🆕 CI/CD mínimo (lint+build+tests de reglas), `firestore.indexes.json`, limpiar raíz del repo.

### FASE 1 — Plataforma y datos base (~3–4 semanas)
*Por qué: prepara el terreno para multi-vendor y velocidad sin features visibles aún.*

- 🆕 **Migración CRA → Vite** (plan ya documentado en `docs/migracion-cra-vite.md`; corregir el `require()` de Firestore, renombrar `REACT_APP_*`→`VITE_*`). Elegir **un hosting canónico**.
- 🆕 Campos transversales en producto (`vendorId`/`nicheId`/`fulfillmentType`) con defaults + backfill (no destructivo).
- 🔧 Desnormalizar `ratingAverage`/`salesCount`/`viewsCount`; consolidar `getCategories` duplicado y los dos `AdminProductos`/`TiendaPage`.
- 🆕 **Búsqueda con Algolia/Typesense** + paginación real (sustituye filtrado client-side).
- 🔧 Inventario por variante/talla (`sizes[{size,stock}]`) con descuento transaccional en checkout.

### FASE 2 — Fidelización unificada (~4 semanas)
*Por qué: es el motor de uso diario y el diferencial; la base ya existe, solo hay que unificarla y asegurarla (Fase 0 ya movió la economía al servidor).*

- 🔧 Economía única (WalaCoins=puntos; kapiCoins=XP/racha) sobre `loyaltyLedger` + `loyaltyConfig/global`.
- 🆕 **Misiones diarias** (`missions`/`userMissions` + `generateDailyMissions`); convertir Wordle y Ball Sort en misiones que dan puntos; cablear `actionType` huérfanos (compra/reseña/visita/compartir).
- 🆕 **Racha global** con `streak freeze`; terminar `daily_visit`.
- 🆕 **Tiers/XP** con beneficios; `rewardsCatalog` dinámico + `userCoupons` integrados al checkout.
- 🔧 Push v2: migrar `sendToDevice`→`sendEachForMulticast` (HTTP v1), limpiar tokens inválidos, conectar copys admin↔engine, cablear deep link del tap, configurar service worker web, validar rol admin en envío manual.

### FASE 3 — Marketplace multi-vendor (~5–6 semanas)
- 🆕 Entidad `vendors` + rol `vendor` + panel `/vendedor`.
- 🆕 `order` maestro + `subOrders` + recompute server-side de totales/comisión.
- 🆕 Split de pago (Mercado Pago Marketplace / Stripe Connect) + `payouts` + `ledger`.
- 🆕 Envíos por zona reales (`shippingZones`); `AdminEnviosZonas`.
- 🔧 **Habilitar pago online real** (quitar gate `pruebas001@gmail.com`); webhooks Culqi/PayPal con idempotencia; PayPal capturado/validado en CF.
- 🆕 Páginas de nicho y vendor; jerarquía de categorías.

### FASE 4 — Personalizados como nicho POD escalable (~4 semanas)
- 🔧 **Arreglar render de producción** (productos simples) — *puede adelantarse a Fase 0 si la operación actual sufre.*
- 🆕 `blueprints` reutilizables; medidas físicas/DPI; validación de imprimibilidad.
- 🆕 Pipeline de arte de producción (PNG alta resolución / PDF con sangrado), persistido en Storage y referenciado en el pedido.
- 🔧 Consolidar los dos motores de edición (deprecar `YoryoPersonalizado/WALA_Editor_Export`).

### FASE 5 — Impulso, FOMO e inteligencia (~4 semanas)
- 🆕 Ruleta diaria + cofres con llaves (reusa sorteo ponderado), ofertas relámpago, "misterio del día".
- 🆕 `computeSegments` (RFM + ciclo de vida) → engine consulta segmentos en vez de full scan; disparadores "racha en riesgo" / "misión sin completar 19:00".
- 🆕 Campañas programables (`campaigns`), FCM topics por nicho/ciudad.
- 🆕 Antifraude completo (deviceIds, velocity, multicuenta) y panel de economía (inflación, DAU/WAU, retención D1/D7/D30, ROI de sumideros).

---

## 7. Decisiones técnicas recomendadas

| Decisión | Justificación |
|---|---|
| **CRA → Vite** ahora; evaluar **Next.js** después | CRA está deprecado; Vite da builds ~3–4× más rápidos y HMR. Next (SSR/ISR) interesa luego para SEO de fichas y landings dinámicas. |
| **Toda mutación de dinero/puntos en Cloud Functions** | Hoy es client-side y manipulable; el ledger + idempotencia es prerequisito para marketplace con dinero real. |
| **Búsqueda con Algolia/Typesense** (índice on-write) | El filtrado client-side descarga toda la colección; no escala a miles de productos multi-vendor ni soporta facets/relevancia. |
| **Split de pago: Mercado Pago Marketplace o Stripe Connect** | Culqi no soporta split nativo; ambos permiten retener comisión y automatizar payouts. MP es muy usado en Perú; Stripe ya está en deps. |
| **`loyaltyLedger` como única fuente de saldo** | Elimina la dualidad `monedas` vs `monedasActivas`, habilita auditoría, TTL real, antifraude y multi-nicho. |
| **Custom claims para roles** | Las reglas Firestore pueden leerlos directamente; elimina el desfase `adminUsers`/`adminRoles` y el backdoor. |
| **FCM HTTP v1 + topics + multicast** | `sendToDevice` está deprecado; topics evitan el full scan horario y escalan la retención diaria. |
| **App Check + paginación + índices** | Protege lecturas públicas masivas y controla costos Firestore. |
| **Proyectos Firebase separados (prod/staging)** | `pruebas-cd728` como prod es riesgo de gobernanza y entornos. |
| **Un único camino ERP** (CF mediadora) | Hoy el navegador escribe directo a un 2º proyecto Firebase; borrar el Express mock y el cliente REST no usado. |

---

## 8. Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Reglas Firestore fantasma** (repo ≠ desplegado) | Crítico: el repo no es fuente de verdad de seguridad | Auditar reglas reales en consola, versionarlas, desplegar desde repo con CI y tests `rules-unit-testing` (Fase 0). |
| **Farmeo/manipulación de economía** | Pérdida financiera directa | Mover earn/spend a CF idempotentes + ledger + reglas que bloqueen escritura cliente; reactivar validación en `secureClaimMonedas`. |
| **Pagos sin verificación server-side** (PayPal) y precio confiado al cliente | Cobros incorrectos / fraude | Recompute de totales y captura/validación en CF; webhooks con idempotencia. |
| **Migración multi-vendor rompe catálogo en producción** | Caída de la tienda | Estrategia aditiva con defaults + backfill por script; nunca migración destructiva; staging primero. |
| **Costos Firestore por full scans y lecturas públicas** | Gasto creciente / timeouts | App Check, paginación, índices, topics FCM, `computeSegments` cacheado, presupuestos/alertas GCP. |
| **Salida de arte POD insuficiente** (resolución/DPI) | Reclamos de producción, retrabajo manual | Pipeline de arte de producción + medidas físicas/DPI + validación de imprimibilidad (Fase 4, adelantable). |
| **Complejidad de dos motores de edición** | Bugs y mantenimiento doble | Consolidar en un solo editor; deprecar `YoryoPersonalizado`. |
| **Cambio de comportamiento de usuarios** (online vs WhatsApp) | El canal real es WhatsApp; forzar pago online puede friccionar | Habilitar pago online con feature flag por entorno y conservar WhatsApp como opción durante la transición. |
| **Dependencia de un ERP externo sin contrato de sync** | Estados de pago/producción descoordinados | CF mediadora + webhook de vuelta del ERP para conciliar `monedasEnEspera` y estados de sub-orden. |
| **CSS de temas crudo inyectado** (`dangerouslySetInnerHTML`) | Inyección vía temas WordPress | Sanitizar/whitelistear propiedades, bloquear `expression()`/`url(javascript:)`/`@import` externos, scoping estricto. |

---

### Cierre

Wala llega a esta etapa con **mucho más construido de lo que aparenta**: el editor POD, la maquinaria de gamificación y el page-builder son activos reales y diferenciales. El trabajo no es "construir un marketplace desde cero", sino **(1) sellar la seguridad y la economía** (Fase 0–2, innegociable), **(2) introducir las entidades que faltan** —vendedor, nicho, sub-orden, comisión, ledger— de forma **aditiva**, y **(3) cablear lo que ya existe a medias** (misiones, deep links, copys, render POD, referidos). Ese orden minimiza riesgo financiero y de producción mientras convierte el uso diario (juegos/misiones) en el motor de adquisición y conversión hacia las áreas de personalizados y marketplace general.