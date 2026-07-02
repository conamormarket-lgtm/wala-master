# Modelo de datos WALA — Actual vs Objetivo

> Documento de arquitectura de datos. Fuente: lectura directa de `src/services/*` y
> `src/models/*.json` (estado real del código en producción `sistema-gestion-3b225`) + sección
> "3.4 Modelo de datos objetivo" de `docs/wala_synthesis.md`.
>
> **⚠️ Topología (corregida):** `sistema-gestion-3b225` es el ÚNICO proyecto de producción.
> El portal de clientes **y** el ERP comparten **el mismo proyecto Firebase y la misma base
> Firestore**. Por tanto las colecciones del ERP (`pedidos`, `pedidos_web`) y las de analytics
> (`analytics_events`, `analytics_sessions`, `analytics_user_summary`, `analytics_global_summary`)
> NO viven en un proyecto separado: están en `sistema-gestion-3b225` junto con las del portal y
> **deben estar cubiertas por las reglas Firestore de ese proyecto**. `pruebas-cd728` NO se usa.
>
> Acompaña a `firestore.indexes.json` (raíz del repo), que declara los índices
> compuestos que el código ACTUAL ya necesita.

> **Estado de implementación (rama `fase-0-seguridad`, EMULADOR local `demo-wala`, NO desplegado a `sistema-gestion-3b225`):**
> Buena parte del "Modelo OBJETIVO" de la §3 YA está implementado y verificado E2E en el
> emulador (Fases 2, 2b, 3, 4, 5). Las colecciones nuevas que ya existen en código se
> marcan abajo con ✅ y se documentan con sus **campos EXACTOS** en la nueva §3.4. Lo que
> sigue siendo objetivo de diseño (sin código) se mantiene como ⬜.
>
> Convención de estado: ✅ hecho y verificado · 🔧 parcial · ⬜ por hacer.
>
> Resumen de lo IMPLEMENTADO y verificado en emulador (verificado leyendo
> `functions/index.js` + `scripts/seed-emulator.js`):
> - **Fase 2 (fidelización diaria):** `loyaltyLedger`, `missions`, `userMissions`,
>   + campos `xp`/`dailyStreak`/`lastCheckInDate` en el doc de usuario (check-in,
>   misiones diarias). ✅
> - **Fase 2b (canje):** `rewardsCatalog`, `userCoupons` (cupón real `WALA-XXXXXX`). ✅
> - **Fase 3 (multi-vendor):** `niches` y `vendors` (ENTIDADES, sembradas y leídas en
>   checkout), `orders`, `subOrders`, `shippingZones`, `payouts`
>   (+ split de pago Mercado Pago Marketplace simulado). ✅
> - **Fase 4 (POD):** `blueprints` (base mínima del modelo objetivo). ✅
> - **Fase 5 (impulso/inteligencia):** `flashOffers` + campos `segment`/`lastChestDate`
>   server-only en el doc de usuario (cofre diario + segmentación RFM). ✅
> - **⬜ Aún objetivo (sin código):** `loyaltyConfig/global`, `tiers`, `ledger` contable,
>   `searchIndex` (Algolia/Typesense), `dailySpins`/`chests`/`segments` como colecciones
>   propias; y los campos objetivo que faltan en colecciones ya creadas (ver §3.4 / §3.5).
>
> **Aparte (NO es el marketplace objetivo):** el **sistema multi-marca** (`brandId` en
> `productos_wala`, `slug`+`categoryNav`+`categoryNavStyle` en `tienda_brands`,
> `landingPages/{slug}`+`pages/{slug}`, faceta `brand`) **SÍ está en producción** (frontend,
> Vercel). Ver **§3.6**.

---

## 0. Cómo desplegar los índices

El archivo `firestore.indexes.json` está en la raíz del repo y es válido para:

```powershell
# Proyecto PROD (default en .firebaserc = sistema-gestion-3b225)
firebase deploy --only firestore:indexes --project sistema-gestion-3b225
```

Importante sobre `firebase.json`: hoy el bloque `firestore` solo declara `rules`.
Firebase usa por convención `firestore.indexes.json` de la raíz aunque no esté
declarado, pero es recomendable hacerlo explícito para evitar ambigüedad:

```jsonc
"firestore": {
  "rules": "firebase/firestore.rules",
  "indexes": "firestore.indexes.json"
}
```

Los índices de las colecciones ERP (`pedidos` / `pedidos_web`) van en **este mismo
archivo** y se despliegan al **mismo proyecto** `sistema-gestion-3b225`, porque el ERP y el
portal comparten proyecto y base Firestore. (La documentación previa asumía un proyecto ERP
separado vía `REACT_APP_ERP_FIREBASE_*`; eso ya no aplica para producción.) Ver sección 2 y
la nota de topología arriba.

---

## 1. Colecciones ACTUALES (estado real del código)

Nombres reales tal como aparecen en `src/services/*`. **Todas viven en el ÚNICO proyecto de
producción `sistema-gestion-3b225`.** La etiqueta (PROD) marca las del portal y (ERP) las del
flujo ERP, pero **ambas comparten el mismo proyecto Firebase y la misma base Firestore** (no
hay proyecto ERP separado en producción), así que todas deben estar en las mismas reglas.

| Colección (real) | Proyecto | Propósito | Campos clave |
|---|---|---|---|
| `productos_wala` | PROD | Catálogo real de productos de la tienda/editor. | `name`, `price`, `salePrice`, `visible`, `featured`, `featuredOrder`, `categories[]`, `collections[]`, `tags[]`, `characters[]`, `vendors[]` (tag string, NO entidad), **`brandId`** (doc id de `tienda_brands`; **sistema multi-marca activo**, 1 producto = 1 marca; ausente/`''` = catálogo global — ver §3.6), `hasVariants`, `variants[]`, `mainImage`, `mainSizes[]`, `customizationViews[]`, `printAreas`, `isComboProduct`, `comboItems[]`, `inStock` (escalar global) · **(2026-07-01, soft-delete ✅)** `deleted`/`deletedAt` (+ `rescatado` si el tombstone lo creó el script de rescate) — **"eliminar" ya NO borra el doc ni sus fotos de Storage**: marca `{visible:false, deleted:true, deletedAt}` y vacía `searchTokens` (ver §3.8) |
| `tienda_categories` | PROD | Categorías visuales V2 (Hoodies, Polos…). | `name`, `imageUrl`, `order`, `createdAt`, `updatedAt` |
| `categories` | PROD | Categorías legacy. **Duplicado** de `tienda_categories`; `getCategories()` lee de aquí. | `name`, `order` |
| `tienda_collections` | PROD | Colecciones/campañas temporales (drops). | `name`, `imageUrl`, `order` |
| `tienda_brands` | PROD | **Marcas (sistema multi-marca, ver §3.6).** Cada producto pertenece a 1 marca (`productos_wala.brandId` = doc id de aquí). | `name`, `slug` (CamelCase/MAYÚS, match **case-insensitive** en ruteo), `logoUrl`, `order`, `bgColor`, `bgImage`, `bgOpacity`, `whatsappNumber`, `categoryNav[{categoryId,name,imageUrl,order}]` (nav de categorías con miniatura por marca, embebido — **OVERRIDE OPCIONAL**: si está vacío, el nav se **deriva automáticamente** de las categorías de los productos de la marca), `categoryNavStyle{align,animation}` (estilo del nav: `align ∈ left\|center\|right\|justify`, `animation ∈ static\|slider`; default `{center,static}` retrocompatible) |
| `landingPages/{slug}` | PROD | **Páginas dinámicas por slug (id === slug).** `getLandingPageBySlug` busca por `slug` y, si falla, hace **fallback case-insensitive** en memoria. `/:slug` → `DynamicLandingPage` → `TiendaPage pageIdOverride=slug`. Las marcas tienen una aquí (`ConAmor`/`MUSSA`/`MUEBLERIA`). | `slug`, `name`, `title?`, `themeId?`, `hideHeader?`, `hideFooter?`, `createdAt`, `updatedAt` |
| `pages/{slug}` | PROD | **Secciones (layout) de cada landing/página**, editadas en el editor visual. `TiendaPage` lee de aquí por `pageId` (= slug). Para una marca: contiene `categories_nav` + `sidebar_catalog` con su `settings.brandId`. | array `sections[{ type, settings }]` (tipos: `sidebar_catalog`, `categories_nav`, `product_grid`, `featured_products`, `hero`…) |
| `tienda_landing_pages` | PROD | **Modelo legacy** de landings (NO el que usa el ruteo `/:slug`; ese es `landingPages` arriba). | `title`, `slug`, `heroImage`, `theme{}`, `targetBrandId`, `targetCollectionId`, `isActive` |
| `tienda_mockups` | PROD | Prendas en blanco base para crear productos. | `name`, `category`, `baseImageUrl`, `variants[{colorName,colorHex,imageUrl}]` |
| `product_reviews` | PROD | Reseñas de producto + votos "útil". | `productId`, `userId`, `userName`, `rating`, `comment`, `imageUrls[]`, `helpfulVotes[]`, `createdAt` |
| `portal_clientes_users` | PROD | Perfil del cliente del portal + stats Wordle + economía de puntos + gamificación/segmentación. | `displayName`, `email`, `nombres`, `monedas`, `kapiCoins`, `wordlePlayed`, `wordleWins`, `wordleCurrentStreak`, `wordleMaxStreak`, `wordleTotalAttempts`, `lastWordleDate`, `wordleTodayAttempts`, `wordleTodayWon`, `referralCode` · **(Fase 5 ✅) campos nuevos:** `xp`, `dailyStreak`, `lastCheckInDate`, `segment` 🔒, `lastChestDate` 🔒 (🔒 = server-only, ver §3.4.8) |
| `portal_users` | PROD | **Colección "fantasma" por bug** (`referrals.js:205` y memoria del proyecto). El código de resolución de referidos consulta `portal_users` cuando debería ser `portal_clientes_users`. | `referralCode` |
| `wordle` | PROD | Registro por partida diaria (1 doc por `${uid}_${YYYY-MM-DD}`). | `userId`, `displayName`, `date`, `word`, `length`, `attempts`, `timeSeconds`, `won`, `currentStreak` |
| `wordle_daily_words` | PROD | Palabra del día (docId = fecha). | `word` |
| `referrals` | PROD | Embudo de referidos (sent→clicked→…→completed→claimed). | `referrerCode`, `orderId`, `status`, `earnedCoins`, `createdAt`, `clickedAt`, `completedAt`, `updatedAt` |
| `wishlists` | PROD | Lista de deseos por cliente (nombre real de la colección: `wishlists`, ver `WISHLIST_COLLECTION` en `src/services/wishlist.js`). | `userCode`, `items[]` · **(2026-07-01 ✅)** cada item guarda el **snapshot `price`** (`salePrice \|\| price` al momento de agregar) — así la lista y `/regalar` muestran precio aunque el producto se borre después (ver §3.8) |
| `suggested_packages` | PROD | Paquetes sugeridos por usuario. | `userId`, `isSelected` |
| `fechasImportantes` (servicio) | PROD | Fechas importantes del usuario. | `userId`, `isSelected` |
| `inventoryLogs` | PROD | Auditoría de cambios de stock. | `productId`, `productName`, `oldStock`, `newStock`, `userEmail`, `timestamp` (millis) |
| `enlaces_pago` | PROD | Enlaces de pago. **Reglas inseguras** (`allow update,delete: if true`, ver synthesis). | — |
| (ruleta) `PRIZES_COLLECTION` | PROD | Premios de ruleta. | `probability` |
| `pedidos` | ERP (mismo proyecto `sistema-gestion-3b225`) | Pedidos legacy/validados del ERP (incluye pedidos del portal ya aprobados). **Deben estar en las reglas Firestore del proyecto.** | `phone`, `dni`, `clienteNumeroDocumento`, `numeroPedido`, `createdAt`, `email`, `canalVenta`, `estadoGeneral`, `montoTotal`/`montoPendiente`, `pagado`/`estadoPago` |
| `pedidos_web` | ERP (mismo proyecto `sistema-gestion-3b225`) | Cola web de pedidos del portal (los crea el checkout vía `createWebOrder`, con `estadoValidacion:'pendiente'`, pendientes de validación manual). **Deben estar en las reglas Firestore del proyecto.** | `phone`, `dni`/`clienteNumeroDocumento` (normalizados) + `dniRaw`, `numeroPedido`, `createdAt`, `canalVenta:'Portal Web'`, `web:true`, `estadoGeneral:'Nuevo'`, `estadoValidacion`, `montoTotal`/`montoPendiente`, `productos` (mapa `item_N`) |
| `wala_pedidos` | **PROD (WALA-only)** — el ERP NO la toca | **FUENTE DE VERDAD del pedido del portal** (base interna independiente del ERP; nació como espejo anti-pérdida y se graduó a fuente de verdad con su propio `estadoWala`). Lo escribe `createWebOrder` (`src/services/erp/firebase.js`) en **fire-and-forget best-effort** tras guardar en `pedidos_web` (no demora ni rompe el checkout). **NO copia secretos de pago**, solo campos de display + estado. Servicio: `src/services/walaOrders.js`; el pago lo sincroniza también `functions/index.js` (`marcarWalaPedidoPagado`, **requiere redeploy**). **Límite:** solo cubre pedidos creados DESDE el deploy (29-06-2026). Detalle en §3.7. | `numeroPedido`, `portalPseudoOrderId`, `pedidoWebId`, `buyerUid`, `dni`/`dniRaw`/`clienteNumeroDocumento`, `clienteNombreCompleto`, `productos` (resumen; **desde 2026-07-01 cada línea conserva los snapshots** `urlImagen`/`urlImagenPersonalizada`/`textoPersonalizado`/`designId` si la línea los trae), `montoTotal`, `moneda`, `canalVenta:'Portal Web'`, `web:true`, **`estadoWala`** (`pendiente_pago`→`pagado`→…), **`pagado`**, `createdAt`, `fuente:'wala-mirror'`, `giftDetails`/`deliveryDate` (modo regalo, si vienen) · _al pagar se añaden_ `pagadoAt`/`metodoPago`/`montoPagado`/`estadoWalaUpdatedAt` |

> **Ciclo de vida del pedido (creación → pago → estado → visibilidad):** la lógica completa
> (en qué momento exacto se crea el documento, qué hace cada método de pago, cómo se DERIVA
> el estado y dónde se ve el pedido en cliente/admin) está en
> **[FLUJO-PEDIDOS.md](./FLUJO-PEDIDOS.md)**, con archivo:línea. Esta tabla solo describe las
> colecciones; el flujo va allí.
| `analytics_events` | PROD (analytics) | Eventos de analytics propios. **Mismo proyecto `sistema-gestion-3b225`; deben estar en las reglas.** | evento, sesión, ts, UTM, geo |
| `analytics_sessions` | PROD (analytics) | Sesiones de analytics (las crea `src/services/analytics/tracker.js`). **Mismo proyecto; deben estar en las reglas.** | `sessionKey`, `anonymousId`, `uid`, `email`, `displayName`, `referrer`, `userAgent`, `language`, `platform`, `timeZone`, `clientType` (APP/WEB) · **(2026-07-01 ✅)** `device`/`browser`/`os` (parser compartido `src/services/analytics/ua.js`) + `countryCode`/`countryName`/**`geoSource`** (`'ip'` = país real por IP \| `'fallback'` = aproximado; `detectCountry` nunca bloquea la UX) — ver §3.8 |
| `heatmap_events` | PROD (analytics) | Lotes de clics del mapa de calor (los escribe `src/hooks/useHeatmapTracker.js` por batch). | `events[]` (clics con coordenadas/viewport) · **(2026-07-01 ✅)** metadatos por lote: `sessionId`, `uid`, `clientType`, `device` — permiten filtrar el heatmap por app/web/dispositivo (los lotes históricos sin metadatos se avisan en la UI) |
| `analytics_daily/{YYYY-MM-DD}` | PROD (analytics) | **Pre-agregado diario** que lee el dashboard (lo genera `aggregateAnalyticsDaily`, `functions/analyticsDaily.js`). Regla añadida al repo (`read: if isAdmin(); write: if false`) — **NO desplegada aún**. | KPIs del día (sesiones/views/embudo/productos/páginas) · **(2026-07-01, requiere redeploy de la CF)** `byCountry` (solo `geoSource:'ip'`), `byCountryAprox` (por `timeZone`), `byDevice`/`byBrowser`/`byOS`, `byClientType`, `identitiesTotal`/`identitiesLoggedIn`/`identitiesAnon`, `funnelFull` (sin tope 5000), `topIdentities` (top 25/día) — ver §3.8 |
| `analytics_user_summary` | PROD (analytics) | Resumen agregado por usuario. **Mismo proyecto; deben estar en las reglas.** | uid, métricas agregadas |
| `analytics_global_summary` | PROD (analytics) | Resumen global agregado. **Mismo proyecto; deben estar en las reglas.** | métricas globales |

### Notas de inconsistencia ya detectadas (no inventadas)
- **Producto:** el modelo en `productos_wala_schema.json` usa `vendor` (string) y
  `inStock` global; el código (`products.js`) ya escribe `vendors[]` (array de tags).
  El `tienda_producto_schema.json` (V2, colección `products`) define `sizes` como
  `[{size, stock}]` y `category` como objeto — pero la tienda viva usa `productos_wala`
  con `mainSizes[]` / `variants[].sizes[]` planos. Hay 3 formas de "producto" conviviendo.
- **Categorías duplicadas:** `categories` (legacy, lo que lee `getCategories`) vs
  `tienda_categories` (V2). Las reglas Firestore además referencian `products`/`categories`
  que la tienda viva NO usa.
- **Economía escrita desde cliente:** `monedas` / `kapiCoins` se mutan desde el navegador;
  no hay ledger inmutable.

---

## 2. Índices compuestos que el CÓDIGO ACTUAL necesita

Un índice compuesto es obligatorio cuando una query combina (a) un `where` de igualdad
+ `orderBy` sobre otro campo, (b) dos o más `orderBy`, o (c) igualdad + rango (`>=`, `in`)
sobre campos distintos. Firestore resuelve solo: un único campo, o igualdad sobre el
mismo campo del rango.

| # | Colección | Query (servicio) | Campos del índice | En `firestore.indexes.json` |
|---|---|---|---|---|
| 1 | `product_reviews` | `getProductReviews` (`reviews.js`): `where productId == X` + `orderBy createdAt desc` | `productId ASC`, `createdAt DESC` | ✅ Sí (PROD) |
| 2 | `portal_clientes_users` | `getWordleRanking` (`wordle.js`): `orderBy wordleMaxStreak desc` + `orderBy wordleWins desc` | `wordleMaxStreak DESC`, `wordleWins DESC` | ✅ Sí (PROD) |
| 3 | `referrals` | `createReferralShare` (`referrals.js`): `where referrerCode ==` + `where createdAt >=` (rango) | `referrerCode ASC`, `createdAt ASC` | ✅ Sí (PROD) |
| 4 | `referrals` | `updateReferralToCompletedByOrder` (`referrals.js`): `where referrerCode ==` + `where status in [...]` + `where completedAt >=` | `referrerCode ASC`, `status ASC`, `completedAt ASC` | ✅ Sí (PROD) |
| 5 | `productos_wala` | `getFeaturedProducts` (`products.js`): `where featured == true` + `orderBy featuredOrder asc` | `featured ASC`, `featuredOrder ASC` | ✅ Sí (PROD) |
| 5b | `productos_wala` | **Multi-marca:** `getStoreProductsPage` con faceta `{type:'brand'}` (`facetToWhere` en `products.js`): `where brandId ==` + `orderBy createdAt desc` (catálogo paginado de una marca) | `brandId ASC`, `createdAt DESC` | ✅ Sí (PROD) |
| 6 | `pedidos` (ERP) | `searchOrdersInERP` (`erp/firebase.js`): `where phone ==` + `where dni ==` + `orderBy createdAt desc` | `phone ASC`, `dni ASC`, `createdAt DESC` | Mismo proyecto `sistema-gestion-3b225` (abajo) |
| 7 | `pedidos_web` (ERP) | `searchOrdersInERP` (`erp/firebase.js`): igual que #6 sobre `pedidos_web` | `phone ASC`, `dni ASC`, `createdAt DESC` | Mismo proyecto `sistema-gestion-3b225` (abajo) |

### Queries que NO requieren índice compuesto (verificado)
- `suggested_packages` / `fechasImportantes`: dos `where ==` de IGUALDAD solamente
  (`userId ==` + `isSelected ==`). Firestore lo resuelve con índices de campo único.
- `inventoryLogs`: un solo `orderBy timestamp desc`, sin `where`. Índice automático.
- `getReferralsByReferrer`: un solo `where referrerCode ==` (el orden se hace en memoria,
  ver comentario en `referrals.js:159`). Sin índice compuesto.
- `getInventoryLogs`, `getAllDailyWords`, ruleta `orderBy probability`: un solo criterio.
- `getWordleRankingToday`: descarga toda la colección `wordle` y filtra/ordena en cliente
  (a propósito, para evitar índices). Candidato a optimizar (ver objetivo).

### Índices ERP (`pedidos` / `pedidos_web`) — MISMO proyecto

Estos índices van al **mismo proyecto de producción `sistema-gestion-3b225`** (el ERP comparte
proyecto y base Firestore con el portal), no a un proyecto aparte. Lo más limpio es incluirlos
en el `firestore.indexes.json` raíz y desplegar con `--project sistema-gestion-3b225`.
Los bloques a añadir son:

```json
{
  "indexes": [
    {
      "collectionGroup": "pedidos",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "phone", "order": "ASCENDING" },
        { "fieldPath": "dni", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "pedidos_web",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "phone", "order": "ASCENDING" },
        { "fieldPath": "dni", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Despliegue (desde Google Cloud Shell, ya autenticado):

```bash
firebase deploy --only firestore:indexes --project sistema-gestion-3b225
```

(o crear ambos índices a mano desde la consola del proyecto ERP).

---

## 3. Modelo de datos OBJETIVO (marketplace multi-nicho)

Fuente: `docs/wala_synthesis.md` §3.4. La migración es **aditiva**: se extienden
documentos existentes con defaults y backfill; nunca se borra ni se rompe el catálogo
vivo en `sistema-gestion-3b225`.

### 3.1 Extensiones a colecciones existentes

| Colección | Cambio | Tipo |
|---|---|---|
| `productos_wala` | 🔧 **Parcial:** ya en uso/seed `vendorId` (FK string canónica), `nicheId`, `fulfillmentType` (`print_on_demand`\|`stock`\|… objetivo: `made_to_order`/`dropship`), `customizable`, `sku`. Backfill disponible en `scripts/backfill-vendor-niche.js`. **⬜ Aún objetivo:** `productionBlueprintId`, `commissionPctOverride`, `vendorSku`, `leadTimeDays`, `shippingProfileId`, métricas desnormalizadas `ratingAverage`/`ratingCount`/`salesCount`/`viewsCount`, reestructurar `sizes` → `[{size, stock}]`. | Extensión |
| `tienda_categories` / `categories` | Consolidar en UNA colección; jerarquizar con `parentId`, `level`, `nicheId`. | Extensión + consolidación |
| `portal_clientes_users` | El saldo deja de ser fuente de verdad: `monedas`/`kapiCoins` se derivan de `loyaltyLedger`. Se conservan campos pero se recalculan. | Extensión (semántica) |

### 3.2 Colecciones NUEVAS / rediseñadas

| Colección | Estado | Propósito y campos clave |
|---|---|---|
| `niches/{nicheId}` | ✅ **Implementada** (seed + leída en checkout) | Nichos/verticales. Campos REALES: `slug`, `name`, `type`, `commissionPct`, `active`, `order`, `imageUrl`. **⬜ Aún objetivo:** `theme`, `storefrontConfigId`. Detalle en §3.4.9. |
| `vendors/{vendorId}` | ✅ **Implementada** (entidad; seed + leída en checkout para `commissionPct`) — rediseño de tag-string `vendors[]` a ENTIDAD | Campos REALES: `name`, `displayName`, `slug`, `type` (`house`\|`pod`\|… objetivo: `reseller`/`self-fulfill`), `status`, `commissionPct`, `logoUrl`. **⬜ Aún objetivo:** `ownerUid`, `niches[]`, `payout{method,cci,walletPhone}`, `ratings{avg,count}`. Detalle en §3.4.9. |
| `blueprints/{id}` | ✅ **Implementada** (Fase 4, base mínima) — evolución de `productTypes`/`tienda_mockups` | Plantilla POD reutilizable. Campos REALES hoy: `name`, `baseGarment`, `printAreas[{name,widthCm,heightCm,dpi}]`, `decorationMethods[]`, `basePrintCost`, `active`, `order`. **⬜ Aún objetivo:** `mockupTemplates[]`, `variantMatrix`. Detalle en §3.4.4. |
| `orders/{orderId}` | ✅ **Implementada** (Fase 3, maestro) | Campos REALES: `buyerUid`, `status` (`pending_payment`\|`paid`), `totals{subtotal,shipping,commissionTotal,total}`, `subOrderIds[]`. Detalle en §3.4.1. |
| `subOrders/{id}` | ✅ **Implementada** (Fase 3, split por vendor) | Campos REALES: `orderId`, `buyerUid`, `vendorId`, `nicheId`, `items[]`, `vendorSubtotal`, `commissionPct`, `commissionAmount`, `vendorPayoutAmount`, `status`. **⬜ Aún objetivo:** `fulfillmentType`, `productionStage`, `erpPedidoId`. Detalle en §3.4.2. |
| `loyaltyLedger/{id}` | 🔧 **Parcial** (objetivo de diseño; el patrón "ledger inmutable" YA se usa en Fase 5 pero con otro nombre, ver nota) | `uid`, `type` (`earn`\|`spend`\|`expire`\|`adjust`), `source`, `amount`, `currency` (`points`\|`walacoins`\|`kapicoins`), `balanceAfter`, `refId`, `nicheId`, `idempotencyKey`, `createdAt`. Entrada inmutable; el saldo se deriva. Resuelve la divergencia `monedas` vs `monedasActivas`. **Nota:** el cofre diario (Fase 5) ya escribe entradas de ledger con `source: 'cofre_diario'` (ver §3.4.7); falta consolidar este diseño como fuente única de verdad. |
| `loyaltyConfig/global` | ⬜ Objetivo (sin código aún) | Tasas, topes diarios/mensuales, equivalencia puntos↔soles, TTL, feature flags. Hoy las constantes de Fase 2 siguen hardcodeadas en `functions/index.js` (`XP_CHECKIN=10`, `XP_MISSION=5`, hitos de racha D3=5/D7=15/D30=50, cofre 5..20). |
| `missions/{id}` | ✅ **Implementada** (Fase 2; generaliza `weeklyChallenges`) | Config de misión diaria. Campos REALES: `title`, `description`, `type` (`daily`), `actionKey`, `rewardPoints`, `active`, `order`. **⬜ Aún objetivo:** `scope` weekly/seasonal, `goal`, `tierMultiplier`, `segment`, `nicheTag`, `activeFrom`/`activeTo`. Detalle en §3.4.10. |
| `userMissions/{uid}_{YYYY-MM-DD}` | ✅ **Implementada** (Fase 2; colección TOP-LEVEL con id determinista, NO subcolección) | Instancia diaria por usuario. Campos REALES: `userId`, `date`, `items[{missionId,completed,claimedAt}]`. **⬜ Aún objetivo:** `progress`/`status`/`expiresAt` por ítem. Detalle en §3.4.10. |
| `tiers/{id}` | ⬜ Objetivo (sin código) | Niveles/XP con beneficios. (Hoy `xp` se acumula en el doc de usuario pero no hay colección de tiers.) |
| `rewardsCatalog/{id}` | ✅ **Implementada** (Fase 2b; ya NO hardcodeado) | Catálogo de canje dinámico. Campos REALES: `title`, `description`, `cost` (número, en puntos `monedas`), `value` (texto ref), `active`, `order`. Detalle en §3.4.10. |
| `userCoupons/{id}` | ✅ **Implementada** (Fase 2b; cupón real al canjear) | Cupones emitidos al canjear. Campos REALES: `uid`, `rewardId`, `title`, `code` (`WALA-XXXXXX`), `status` (`active`), `createdAt`. **⬜ Aún objetivo:** integración al checkout (consumo). Detalle en §3.4.10. |
| `shippingZones/{id}` | ✅ **Implementada** (Fase 3, base mínima) | Zona de envío → costo + tiempo. Campos REALES: `name`, `departamento`, `cost`, `etaDays`, `active`, `order`. **⬜ Aún objetivo:** desglose provincia/distrito/agencia y costo **por vendor** (hoy zona global). Sustituye la regla global S/15 / gratis > S/100 divergente entre `Cart.jsx` y `CheckoutPage.jsx`. Detalle en §3.4.3. |
| `payouts/{id}` | ✅ **Implementada** (Fase 3) | Pagos a vendors. Campos REALES: `vendorId`, `orderId`, `subOrderId`, `amount`, `status`. Detalle en §3.4.5. |
| `ledger/{id}` (contable) | ⬜ Objetivo (sin código) | Contable inmutable: venta, comisión, payout, reembolso. |
| `flashOffers/{id}` | ✅ **Implementada** (Fase 5) | Ofertas flash públicas. Campos REALES: `title`, `productId`, `discountPct`, `startsAt`, `endsAt`, `active`, `order`. Detalle en §3.4.6. |
| `dailySpins` / `chests` / `segments/{uid}` | ⬜ Objetivo (sin código) | Mecánicas de gamificación y segmentación independientes. **Nota:** el cofre diario y la segmentación RFM de Fase 5 NO usan colecciones propias: persisten en campos del doc de usuario (`lastChestDate`, `segment`), ver §3.4.8. |
| `searchIndex` (Algolia/Typesense, externo) | 🆕 Nuevo (no Firestore) | Docs planos con facets `nicheId`, `vendorId`, `categories`, `fulfillmentType`, `customizable`, `price`, `rating`. Reemplaza `searchProducts` (que hoy descarga toda la colección). |

### 3.3 Índices compuestos previsibles para el modelo OBJETIVO

No se incluyen aún en `firestore.indexes.json` (el código no existe), pero anticípalos:

| Colección | Query previsible | Índice |
|---|---|---|
| `productos_wala` | catálogo por nicho + orden por ventas | `nicheId ASC`, `salesCount DESC` |
| `productos_wala` | productos de un vendor visibles, recientes | `vendorId ASC`, `visible ASC`, `createdAt DESC` |
| `productos_wala` | filtro nicho + categoría (`array-contains`) + precio | `nicheId ASC`, `categories ARRAY`, `price ASC` |
| `subOrders` | cola de producción por vendor | `vendorId ASC`, `productionStage ASC`, `createdAt ASC` |
| `subOrders` | subórdenes de un pedido maestro | `orderId ASC`, `vendorId ASC` |
| `loyaltyLedger` | historial de saldo por usuario | `uid ASC`, `createdAt DESC` |
| `loyaltyLedger` | expiraciones pendientes (TTL real) | `uid ASC`, `type ASC`, `expiresAt ASC` |
| `userCoupons` | cupones vigentes del usuario | `uid ASC`, `status ASC`, `expiresAt ASC` |
| `missions` | misiones activas por scope/nicho | `scope ASC`, `active ASC`, `activeFrom ASC` |
| `shippingZones` | zona por vendor + ubicación | `vendorId ASC`, `departamento ASC`, `provincia ASC` |

> **Nota sobre lo IMPLEMENTADO:** `getDailyMissionsSecure` consulta `missions`
> con `where type=='daily'` + `where active==true` (dos igualdades → índice de campo
> único, NO requiere compuesto; el `order` se ordena en memoria). El checkout
> multi-vendor lee documentos por id (`vendors/{id}`, `shippingZones/{id}`,
> `productos_wala/{id}`) dentro de transacción, sin queries → tampoco requiere índices
> compuestos hoy. Los de la tabla siguen siendo previsibles para cuando haya listados.

---

## 3.4 Colecciones IMPLEMENTADAS y verificadas (EMULADOR `demo-wala`)

> Esta sección documenta con **campos EXACTOS** lo que ya existe en código
> (`functions/index.js`, `scripts/seed-emulator.js`, `src/services/*`). Estado:
> ✅ verificado E2E en emulador (rama `fase-0-seguridad`), ⬜ NO desplegado a prod.
> Todas las mutaciones de saldo/estado pasan por Cloud Functions idempotentes; las
> colecciones de gamificación/economía son **server-only** (las reglas bloquean la
> escritura desde el cliente).

### 3.4.1 `orders/{orderId}` (Fase 3, maestro) ✅

Creada por `createOrderWithSubordersSecure` (status `pending`) o por
`createCheckoutPreferenceSecure` (status `pending_payment`); confirmada a `paid` por
`confirmPaymentSecure`. Precios recalculados server-side (nunca se confía en el cliente).

```jsonc
{
  "buyerUid": "cliente-uid",
  "status": "pending_payment",          // pending_payment | pending | paid
  "totals": {
    "subtotal": 169.7,                  // Σ vendorSubtotal (sin envío)
    "shipping": 10,                     // shippingZones/{id}.cost
    "commissionTotal": 14.38,           // Σ commissionAmount de subOrders
    "total": 179.7                      // subtotal + shipping
  },
  "subOrderIds": ["<id1>", "<id2>"],
  "createdAt": "<serverTimestamp>"
}
```
⬜ Aún objetivo: `loyalty{coinsSpent,coinsEarned}`.

### 3.4.2 `subOrders/{id}` (Fase 3, split por vendedor) ✅

Una por `vendorId` presente en el carrito. `commissionPct` viene de
`vendors/{vendorId}.commissionPct`.

```jsonc
{
  "orderId": "<orderId>",
  "buyerUid": "cliente-uid",
  "vendorId": "estampados-lima",
  "nicheId": "ropa-personalizada",      // de productos_wala, puede ser null
  "items": [
    { "productId": "p3", "name": "Polo edición Lima", "qty": 2, "unitPrice": 59.9 }
  ],
  "vendorSubtotal": 119.8,
  "commissionPct": 12,
  "commissionAmount": 14.38,            // vendorSubtotal * pct / 100
  "vendorPayoutAmount": 105.42,         // vendorSubtotal - commissionAmount
  "status": "pending",
  "createdAt": "<serverTimestamp>"
}
```
⬜ Aún objetivo: `fulfillmentType`, `productionStage`, `erpPedidoId`.

### 3.4.3 `shippingZones/{id}` (Fase 3) ✅

Lectura pública, escritura admin. CRUD en `/admin/envios` (AdminEnviosZonas),
service `shippingZones.js`. Seed: `lima-metropolitana` (S/10, 2 días),
`provincias` (S/20, 5 días).

```jsonc
{ "name": "Lima Metropolitana", "departamento": "Lima", "cost": 10, "etaDays": 2, "active": true, "order": 0 }
```
⬜ Aún objetivo: provincia/distrito/agencia y costo **por vendor**.

### 3.4.4 `blueprints/{id}` (Fase 4 POD) ✅

Lectura pública, escritura admin. CRUD en `/admin/blueprints`, service `blueprints.js`.
Soporte de arte de producción en `src/utils/productionArt.js`
(`pxFromCm`, `exportProductionArtPNG`, `validatePrintResolution`; verificado 30cm@300dpi = 3543px).

```jsonc
{
  "name": "Polo clásico",
  "baseGarment": "polo",
  "printAreas": [
    { "name": "Frente",  "widthCm": 30, "heightCm": 40, "dpi": 300 },
    { "name": "Espalda", "widthCm": 30, "heightCm": 40, "dpi": 300 }
  ],
  "decorationMethods": ["DTG", "vinilo"],
  "basePrintCost": 8,                    // soles
  "active": true,
  "order": 0
}
```
⬜ Aún objetivo: `mockupTemplates[]`, `variantMatrix`; integrar productionArt en EditorPage.

### 3.4.5 `payouts/{id}` (Fase 3) ✅

Creados por `confirmPaymentSecure` (uno por subOrder pagada, idempotente). Escritura
solo admin/servidor. CRUD/lectura en `/admin/payouts`, service `payouts.js`.

```jsonc
{ "vendorId": "estampados-lima", "orderId": "<orderId>", "subOrderId": "<subOrderId>", "amount": 105.42, "status": "pending", "createdAt": "<serverTimestamp>" }
```

### 3.4.6 `flashOffers/{id}` (Fase 5) ✅

Lectura pública, escritura admin. CRUD en `/admin/flash-offers`, vitrina en `/ofertas`,
service `flashOffers.js`. Seed: `fo-polos-30` (p1, -30%), `fo-tazas-2x1` (p2, -50%).

```jsonc
{ "title": "Polos -30% hoy", "productId": "p1", "discountPct": 30, "startsAt": "<ISO>", "endsAt": "<ISO>", "active": true, "order": 0 }
```
⬜ Aún objetivo: countdown en home.

### 3.4.7 `loyaltyLedger/{id}` (Fase 2 — fuente de verdad del saldo) ✅

Entrada **inmutable, solo servidor** (helper `writeLedger` dentro de transacción).
La escriben: check-in en hitos (`source: 'checkin_d3'|'checkin_d7'|'checkin_d30'`),
misiones (`source: 'mision_<missionId>'`), canje de recompensa (`type:'spend'`,
`source: 'reward_<rewardId>'`) y cofre diario (`source: 'cofre_diario'`).

```jsonc
{
  "uid": "cliente-uid",
  "type": "earn",                       // earn | spend
  "amount": 5,
  "source": "cofre_diario",
  "balanceAfter": 55,                   // saldo de 'monedas' tras la operación
  "createdAt": "<serverTimestamp>"
}
```
⬜ Aún objetivo del diseño completo (§3.2): `currency` (points/walacoins/kapicoins),
`refId`, `nicheId`, `idempotencyKey`, `expiresAt`, tipos `expire`/`adjust`, y derivar
`monedas` 100% del ledger (hoy `monedas` se actualiza en paralelo en el doc de usuario).

### 3.4.8 Campos nuevos en `portal_clientes_users` (Fases 2 y 5) ✅

Extensión del doc de usuario. Los marcados 🔒 son **server-only** (las reglas
Firestore bloquean su escritura desde el cliente).

| Campo | Tipo | Quién lo escribe | Notas |
|---|---|---|---|
| `monedas` | number | servidor (Fase 2) y cliente (legacy) | Puntos canjeables; saldo. |
| `xp` | number | servidor (`dailyCheckInSecure` +10, `completeMissionSecure` +5) | Experiencia acumulativa, solo sube. |
| `dailyStreak` | object | servidor (`dailyCheckInSecure`) | `{ count, lastDate, freezeTokens }`. |
| `lastCheckInDate` | string `YYYY-MM-DD` (Lima) 🔒 | servidor | Idempotencia del check-in diario. |
| `segment` | string 🔒 | servidor (`computeSegmentsSecure`, solo admin) | `vip`\|`activo`\|`en_riesgo`\|`nuevo` (RFM sobre orders pagadas). |
| `lastChestDate` | string `YYYY-MM-DD` (Lima) 🔒 | servidor (`openDailyChestSecure`) | Idempotencia del cofre diario. |

Verificado: cofre 50→68 (+ 2da apertura `alreadyOpened`); segmentación processed 2 →
`{activo:1,nuevo:1}` (cliente=`activo`); cliente sin permiso → `PERMISSION_DENIED`.

### 3.4.9 `niches/{nicheId}` y `vendors/{vendorId}` (entidades) ✅

Sembradas y **leídas por id** en el checkout (vendor → `commissionPct`). Los productos
(`productos_wala`) ya llevan `vendorId` (FK string canónica) y `nicheId`.

```jsonc
// niches/regala-con-amor
{ "slug": "regala-con-amor", "name": "Regala Con Amor", "type": "general", "commissionPct": 0, "active": true, "order": 0, "imageUrl": "" }
// vendors/estampados-lima
{ "name": "Estampados Lima", "displayName": "Estampados Lima", "slug": "estampados-lima", "type": "pod", "status": "active", "commissionPct": 12, "logoUrl": "" }
```
⬜ Aún objetivo (vendors): `ownerUid`, `niches[]`, `payout{}`, `ratings{}`; rol vendor por claims.

### 3.4.10 Gamificación de fidelización: `missions`, `userMissions`, `rewardsCatalog`, `userCoupons` (Fases 2 y 2b) ✅

Funciones: `getDailyMissionsSecure`, `completeMissionSecure`, `dailyCheckInSecure`,
`redeemRewardSecure` (todas server-authoritative e idempotentes por día Lima / por estado).

```jsonc
// missions/m1 (config; lectura pública, escritura admin)
{ "title": "Visita diaria", "description": "Entra a la app hoy", "type": "daily", "actionKey": "visit", "rewardPoints": 2, "active": true, "order": 0 }

// userMissions/<uid>_<YYYY-MM-DD> (TOP-LEVEL, id determinista; escritura solo servidor)
{ "userId": "cliente-uid", "date": "2026-06-24", "items": [ { "missionId": "m1", "completed": true, "claimedAt": "<ISO>" } ] }

// rewardsCatalog/rw-stickers (lectura pública, escritura admin; cost en puntos 'monedas')
{ "title": "Pack de stickers", "description": "...", "cost": 30, "value": "Pack de stickers físico", "active": true, "order": 0 }

// userCoupons/<auto> (lectura dueño, escritura solo servidor)
{ "uid": "cliente-uid", "rewardId": "rw-stickers", "title": "Pack de stickers", "code": "WALA-7H2KQ9", "status": "active", "createdAt": "<serverTimestamp>" }
```
⬜ Aún objetivo: `tiers/{id}` (XP→niveles), consumir `userCoupons` en el checkout,
`missions` con scope weekly/seasonal + `goal`/`segment`/`nicheTag`.

### 3.4.11 Split de pago (Mercado Pago Marketplace, simulado) ✅

`createCheckoutPreferenceSecure` crea `orders` (`pending_payment`) + `subOrders`; con
`MERCADOPAGO_ACCESS_TOKEN` genera preferencia real con `marketplace_fee` = comisión
total; sin token → `init_point` simulado `/pago-demo/{orderId}`. `confirmPaymentSecure`
marca `paid` + crea `payouts` por vendedor (idempotente). `mercadoPagoWebhook` (HTTP)
para producción. service `src/services/payments.js`; rutas `/checkout-demo`, `/pago-demo/:orderId`.
Verificado simulado: order 179.7 / comisión 14.38 → `paid` + 2 payouts (49.9, 105.42).
⬜ Aún objetivo: cobro REAL (configurar `MERCADOPAGO_ACCESS_TOKEN`, `MP_WEBHOOK_URL`,
`MP_BACK_URL_BASE`), integrar `CheckoutPage` real a este flujo.

---

## 3.5 Pendiente (resumen consolidado)

Lo que sigue ⬜ (requiere servicios externos, navegador/editor o despliegue):

- **Despliegue:** nada está en `sistema-gestion-3b225`; todo verificado en build (Vite) + emulador.
- **Fase 3:** cobro REAL Mercado Pago (tokens/URLs), búsqueda Algolia/Typesense on-write
  (`searchIndex`), rol vendor por claims, integrar `CheckoutPage` real al flujo de split.
- **Fase 4:** integrar `productionArt` en EditorPage (arte de producción al agregar al
  carrito, recorte por área del blueprint, validar resolución), PDF de producción,
  fix de `finalCustomizedImage` para productos simples.
- **Fase 5:** push segmentado (FCM), campañas programadas (Cloud Scheduler),
  recomendación por IA, countdown de ofertas flash en home.
- **Economía:** consolidar `loyaltyLedger` como fuente ÚNICA de saldo + `loyaltyConfig/global`
  (sacar constantes hardcodeadas), `tiers`, consumo de `userCoupons` en checkout,
  `currency`/`expiryDate`/`idempotencyKey` en el ledger.
- **Datos:** `niches`/`vendors` con campos objetivo completos, `ledger` contable,
  consolidar `categories` ↔ `tienda_categories`, fix del bug `portal_users` (referrals.js).

---

## 3.6 Sistema multi-marca (Con Amor / MUSSA / MUEBLERIA) ✅ DESPLEGADO (frontend)

> Plan completo y commits en **[PLAN-MULTIMARCA.md](./PLAN-MULTIMARCA.md)**. Aquí solo el
> **modelo de datos**. Frontend DESPLEGADO (Vercel, 2026-06-28). Es **aditivo**: no rompe la
> tienda global; `brandId` ausente/`''` = catálogo global.

**Idea:** cada producto pertenece a **una** marca (`productos_wala.brandId` = doc id de
`tienda_brands`). Cada marca tiene su página `WALA.PE/<slug>`, su catálogo sidebar acotado a
sus productos y su nav de categorías con miniaturas.

### Campos que añade / usa

| Doc | Campo | Tipo | Notas |
|---|---|---|---|
| `productos_wala/{id}` | `brandId` | string | Doc id de `tienda_brands`. **1 producto = 1 marca.** Ausente/`''` = catálogo global. Lo escribe `setProductBrand` con **escritura parcial** (`updateDoc {brandId}` para asignar, `updateDoc {brandId: deleteField()}` para quitar). |
| `tienda_brands/{id}` | `slug` | string | `ConAmor`/`MUSSA`/`MUEBLERIA`. El ruteo hace match **case-insensitive**. |
| `tienda_brands/{id}` | `categoryNav` | array | `[{ categoryId, name, imageUrl, order }]` — burbujas del nav de categorías de la marca (normalizado en `brands.js`). **OVERRIDE opcional**: el nav por defecto es **automático** (se deriva de las categorías de los productos de la marca vía `getProductsByBrand` + `tienda_categories`); este array solo se usa si tiene items (para fijar orden/imágenes a mano). |
| `tienda_brands/{id}` | `categoryNavStyle` | object | `{ align, animation }` — **estilo del nav** de categorías de la marca (normalizado en `brands.js`, `normalizeCategoryNavStyle`). `align ∈ {left, center, right, justify}` (alineación de las burbujas; **solo aplica en modo estático**), `animation ∈ {static, slider}` (`slider` = auto-scroll tipo marquee, pausa al hover, respeta `prefers-reduced-motion`, no rompe el clic-para-filtrar). **Aditivo y retrocompatible**: ausente o inválido → default `{ align: 'center', animation: 'static' }` (= comportamiento actual). `TiendaPage` lee este campo y pasa `align`/`animation` a `VisualCategoryNav`. Editable (sincronizado) en *Elementos con diseño*, panel por marca e inline del editor visual. |
| `landingPages/{slug}` | doc | — | **id === slug**. Hace que `WALA.PE/<slug>` resuelva vía `/:slug` → `DynamicLandingPage`. |
| `pages/{slug}` | `sections[]` | array | Secciones de la página de la marca: `categories_nav` + `sidebar_catalog`, cada una con `settings.brandId`. |

### Faceta `brand` (server-side)

`getStoreProductsPage({ facet })` acepta **una** faceta server-side. `facetToWhere` (en
`src/services/products.js`) mapea `{ type:'brand', value }` → `where('brandId','==',value)`,
combinada con `orderBy('createdAt','desc')` (índice 5b de §2). Las demás facetas activas —en
particular la **categoría** elegida en el nav o el sidebar— se aplican como **filtro de cliente**
sobre la página recibida (límite de Firestore: 1 faceta + orderBy por query). `TiendaPage` deriva
`pageBrandId` de la sección `sidebar_catalog` y arranca `catalogFacet = { type:'brand', value }`.

### Brand IDs reales (producción `sistema-gestion-3b225`)

| Marca | `brandId` | slug |
|---|---|---|
| Con Amor (base, catálogo actual) | `m3P26agqw7BjeYTDjs6j` | `ConAmor` |
| MUSSA | `pMujqcyIIDUF2EdSSX5V` | `MUSSA` |
| MUEBLERIA | `RMLsCQGvLo7c3NHgfkLO` | `MUEBLERIA` |

> **Pendiente del dueño (datos, no código):** `node scripts/setup-marcas.js --apply` (crea
> `landingPages/MUSSA` y `/MUEBLERIA` + termina el backfill `brandId`), configurar las páginas
> MUSSA/MUEBLERIA en el editor visual y asignar productos a esas dos marcas (hoy todos = Con Amor).

---

## 3.7 `wala_pedidos` — FUENTE DE VERDAD de pedidos (base interna independiente del ERP) ✅ DESPLEGADO

> Base interna de WALA contra la desaparición de pedidos descrita en
> [FLUJO-PEDIDOS.md §4-bis](./FLUJO-PEDIDOS.md). Desplegada el **2026-06-29** en dos commits:
> - `68447dc` — nace el **ESPEJO** (red de seguridad anti-pérdida).
> - `1d8f639` — se gradúa a **FUENTE DE VERDAD**: gana un **estado propio `estadoWala`** que el
>   portal no degrada, y el **pago lo sincroniza el backend** (`functions/index.js`, requiere
>   redeploy).
>
> Sigue siendo **aditivo**: no cambia ninguna colección del ERP ni la lógica de pago/totales.

**Idea:** `wala_pedidos` es una colección **propiedad del lado WALA** que el ERP externo
(`aimunayerp.com`) **no lee ni borra**. Guarda una **copia** de cada pedido del portal **y su
estado propio `estadoWala`**, que pasa a ser la **fuente de verdad** del estado mostrado al
cliente, independiente del ERP. (*Decisión del dueño: "la base interna es la fuente de verdad; ya
no importan los pedidos viejos".*) Si el ERP borra/desmarca el doc de `pedidos_web` al aprobarlo,
la copia **sigue viva** y "Mis Compras"/"Recepción" la **rescatan**.

### `estadoWala` — ciclo de vida propio

Cada doc lleva `estadoWala` con su propio flujo, **independiente** del `estadoGeneral` del ERP:

```
  pendiente_pago  →  pagado  →  en_preparacion  →  enviado  →  entregado
                                                                  (cancelado = terminal alterno)
```

- Al **crear** el pedido nace **`pendiente_pago`** (`mirrorWebOrder`).
- El **pago** (Culqi/PayPal) lo mueve a **`pagado`** — desde el cliente (`markWalaOrderPagado`) y
  desde el **backend** (`functions/index.js` → `marcarWalaPedidoPagado`, ADITIVO/idempotente/best-effort).
- `en_preparacion` / `enviado` / `entregado` / `cancelado` quedan listos para que (FASE SIGUIENTE)
  el **ERP los actualice vía un endpoint con API KEY** que SOLO lea y actualice estado (jamás borre).
- Helpers en `src/services/walaOrders.js`: `ESTADOS_WALA`, `updateWalaOrderEstado`,
  `markWalaOrderPagado`, `estadoWalaADisplay({ label, color, paso })`.

> **No degrada lo ya avanzado:** `mirrorWebOrder` lee el doc antes de escribir; si el espejo ya
> existe, **conserva** `estadoWala`/`pagado`/`createdAt` y solo refresca los campos display. Y
> `derivarEstadoCompra` muestra el estado **más avanzado** entre el doc vivo del ERP y `estadoWala`
> (ver [FLUJO-PEDIDOS.md §3.4 y §4-bis.5](./FLUJO-PEDIDOS.md)).

### Cómo y cuándo se escribe

- Lo escribe **`createWebOrder`** (`src/services/erp/firebase.js`) **después** de guardar en
  `pedidos_web`, en modo **fire-and-forget best-effort**: va en `try/catch` y **nunca** demora
  ni hace fallar el checkout (si la copia falla, el pedido real ya quedó guardado igual).
- Servicio: **`src/services/walaOrders.js`** —
  - `mirrorWebOrder({ pedidoWebId, payload })` escribe la copia (y **no degrada** `estadoWala`/
    `pagado`/`createdAt` si ya existía — lee con `getDoc` antes de mergear).
  - `getWalaMirrorOrders({ userId, dni })` la lee para "Mis Compras".
  - `getAllWalaMirrorOrders()` la lee (sin filtro de usuario) para "Recepción".
  - `updateWalaOrderEstado` / `markWalaOrderPagado` actualizan `estadoWala` (idempotentes,
    best-effort, nunca lanzan); `estadoWalaADisplay` lo mapea a `{ label, color, paso }`.
- **El pago lo sincroniza el backend:** `functions/index.js` (`processCulqiPayment`,
  `culqiWebhook`, `capturePaypalOrderSecure`) llama `marcarWalaPedidoPagado` → `estadoWala:"pagado"`
  (ADITIVO/idempotente/best-effort; **requiere redeploy de esas functions**).
- **Idempotente:** doc id estable (`sanearDocId(numeroPedido || pedidoWebId)`) +
  `setDoc(..., { merge: true })`. Usa la misma instancia Firestore del ERP (`erpDb`).
- **NO copia secretos de pago.** Solo campos display ya calculados.
- **Snapshots visuales (2026-07-01, commit `88a3368`, ADITIVO):** cada línea de `productos`
  conserva `urlImagen` / `urlImagenPersonalizada` / `textoPersonalizado` / `designId` (solo si la
  línea los trae), y el doc conserva `giftDetails` / `deliveryDate` del modo regalo. Así el
  historial muestra la imagen y la personalización de lo comprado **aunque el producto se borre
  después del catálogo** (ver §3.8).

### Forma del documento

```jsonc
{
  // Claves de identidad / búsqueda
  "numeroPedido": "PD-xxxx",             // código de negocio del portal (pseudoOrderId)
  "portalPseudoOrderId": "PD-xxxx",
  "pedidoWebId": "<docId de pedidos_web>",
  "buyerUid": "cliente-uid",             // = userId del checkout (CheckoutPage.jsx:750), o null

  // Documento del cliente (normalizado + crudo) para casar en la lectura
  "dni": "12345678",                     // normalizado (trim + sin espacios)
  "dniRaw": "12345678",                  // valor tecleado original
  "clienteNumeroDocumento": "12345678",  // = dni normalizado
  "clienteNombreCompleto": "Nombre Cliente",

  // Productos RESUMIDOS (ligeros, sin imágenes pesadas)
  "productos": [
    { "productoId": null, "nombre": "Producto", "brandId": null, "cantidad": 1,
      "talla": null, "color": null, "precio": null, "subtotal": null, "personalizado": false }
  ],

  // Montos display (NO se recalcula nada; se copia el total ya calculado)
  "montoTotal": 179.7,
  "moneda": "PEN",

  // Marcadores de origen WALA (para esPedidoWala y la derivación de estado)
  "canalVenta": "Portal Web",
  "web": true,

  // ESTADO PROPIO DE WALA (FUENTE DE VERDAD, commit 1d8f639)
  // Al CREAR solo se escriben estos dos (mirrorWebOrder, walaOrders.js:192-193):
  "estadoWala": "pendiente_pago",        // pendiente_pago→pagado→en_preparacion→enviado→entregado | cancelado
  "pagado": false,

  // Metadatos del espejo
  "createdAt": "<serverTimestamp>",
  "fuente": "wala-mirror",              // distingue la copia de un pedido vivo

  // ── Campos que se AÑADEN SOLO AL PAGAR (no existen al crear) ────────────────
  // markWalaOrderPagado (cliente) o marcarWalaPedidoPagado (backend, functions/index.js):
  "pagadoAt": "<serverTimestamp>",      // al pagar
  "metodoPago": "culqi",                // 'culqi' | 'paypal' (informativo)
  "montoPagado": 179.7,                 // informativo (NO recalcula montos)
  "estadoWalaUpdatedAt": "<serverTimestamp>" // sello del último cambio de estadoWala
}
```

> **Qué se escribe y cuándo.** Al CREAR, `mirrorWebOrder` solo siembra `estadoWala:"pendiente_pago"`
> + `pagado:false` (más las claves/display); `pagadoAt`/`metodoPago`/`montoPagado`/`estadoWalaUpdatedAt`
> **NO existen** hasta que se paga. El **pago** los añade y pasa `estadoWala→"pagado"` —desde el
> cliente (`markWalaOrderPagado`) o desde el backend (`marcarWalaPedidoPagado` en `functions/index.js`,
> **requiere redeploy**)—. Cualquier cambio posterior de estado (`updateWalaOrderEstado`) sella
> `estadoWalaUpdatedAt`. Los estados `en_preparacion`/`enviado`/`entregado`/`cancelado` los actualizará
> el ERP en la FASE SIGUIENTE (endpoint con API KEY de solo lectura/actualización, aún no implementado).

### Cómo lo usan las vistas (lectura PRIMARIA + estado más avanzado)

- **Mis Compras** (`searchOrdersByDniInERP`, acepta `{ userId }`) y **Recepción**
  (`getWalaOrdersForAdmin`) leen `wala_pedidos` como fuente **PRIMARIA** (presencia garantizada) y
  fusionan con los pedidos vivos, **deduplicando por clave de negocio** (`numeroPedido ||
  portalPseudoOrderId || pedidoWebId || id`). Una clave "viva" solo cuenta si el doc **SIGUE siendo
  WALA** (`esPedidoWala`); así un pedido **desmarcado por el ERP** (`web:false`) **no suprime** su
  copia, y esta lo rescata. `usePedidos(dni, userId)` indexa su caché en memoria por `dni+userId`;
  `CuentaPedidosPage` y `CuentaCompraDetallePage` pasan el `uid`.
- **Estado MÁS AVANZADO entre ERP y WALA:** cuando coexisten el doc vivo del ERP y la copia, la
  lectura **adjunta** `estadoWala`/`pagado` al vivo (`_walaEstado`/`_walaPagado`) y
  `derivarEstadoCompra` (`src/utils/estadoCompra.js`) muestra el **más avanzado** de los dos sin
  degradar (ver [FLUJO-PEDIDOS.md §3.4](./FLUJO-PEDIDOS.md)). El pedido **solo-espejo** (rama
  `_fromMirror`/`fuente:'wala-mirror'`) toma su etiqueta de **su propio `estadoWala`**:
  `pendiente_pago` → "Por confirmar pago" (ámbar), `pagado` → "Pagado" (azul), `entregado` →
  "Entregado" (verde), etc. Como el pago marca `estadoWala:"pagado"` también en el espejo (§3.7
  abajo / [FLUJO-PEDIDOS.md §4-bis.9](./FLUJO-PEDIDOS.md)), un pedido pagado se ve azul aunque el
  ERP ya lo haya borrado de `pedidos_web`. _(Antes de `1d8f639` el solo-espejo se mostraba siempre
  verde "Confirmado"; ahora el color lo decide `estadoWala`.)_
- **Recepción** (`src/services/adminOrders.js` + `RecepcionPedidos.jsx`): incluye la copia,
  marcada **"Procesado en ERP"**.

### Límite conocido (importante)

La copia se crea **AL MOMENTO de la compra** → **solo protege pedidos creados DESDE el deploy**
(2026-06-29). Los pedidos **previos NO tienen copia**: si el ERP ya los borró de `pedidos_web`
**y** de `pedidos`, **no se pueden recuperar**. Decisión del dueño: la base interna es la fuente de
verdad y *"ya no importan los pedidos viejos"*.

### FASE SIGUIENTE (no implementada — el campo ya está listo)

- ⬜ **Endpoint con API KEY para el ERP**: que el ERP **LEA** y **SOLO ACTUALICE** `estadoWala`
  (avanzarlo a `en_preparacion`/`enviado`/`entregado`/`cancelado`) y **jamás borre**. `estadoWala`
  + `updateWalaOrderEstado` ya quedan listos; falta el endpoint y la credencial.

---

## 3.8 Integridad de historial + analítica enriquecida (ciclo 2026-07-01/02) ✅ DESPLEGADO (frontend)

> Ciclo de 4 fases (commits `88a3368` → `d293ea0`). Aquí solo el **modelo de datos**; el detalle
> funcional está en el [CHANGELOG](../../CHANGELOG.md), [FUNCIONES-ADMIN.md](./FUNCIONES-ADMIN.md)
> y [FUNCIONES-CLIENTE.md](./FUNCIONES-CLIENTE.md). Los agregados diarios nuevos **requieren
> redeploy** de `aggregateAnalyticsDaily`/`aggregateAnalyticsDailyBackfill` (ver
> [PENDIENTES.md](./PENDIENTES.md)).

### 3.8.1 Tombstone de producto (soft-delete en `productos_wala`)

"Eliminar" un producto (`deleteProduct`, `src/services/products.js`) ya **NO borra el documento ni
sus fotos de Storage**: escribe un **tombstone** y conserva todo lo que el historial necesita
(`name`, `mainImage`, `images`, `price`, `salePrice`, `brandId`, `variants`).

```jsonc
{
  // Lo que escribe deleteProduct sobre el doc existente:
  "visible": false,
  "deleted": true,
  "deletedAt": "<ISO string>",   // momento del borrado lógico
  "searchTokens": []             // vaciados: deja de salir en la búsqueda por Firestore

  // Solo en tombstones RECONSTRUIDOS por scripts/rescate-historial.js
  // (productos que ya habían sido borrados físicamente antes del ciclo):
  // "rescatado": true  — marca de que lo creó el script, no un borrado normal
}
```

- **Restaurar** (mostrar de nuevo desde `/admin/productos`) escribe `{ visible:true, deleted:false }`
  — sin productos "zombi" que sigan marcados como borrados.
- **`deleteProductPermanently`** conserva el borrado físico (doc + fotos) pero **NO tiene ningún
  llamador de UI**: solo uso deliberado por consola/script.
- **Lectores:** `getProductById` NO filtra por `deleted` (intencional: el historial necesita leer
  el tombstone); `useProducts` acepta **`includeHidden`** para que Mis Compras / wishlist /
  `/regalar` resuelvan nombre/imagen/precio de productos borrados. `ProductPage`/`EditorPage`
  muestran "Ya no está disponible" y bloquean la compra.
- **Script de rescate:** `scripts/rescate-historial.js` (dry-run por defecto; escribe solo con
  `--apply`; **SOLO toca `productos_wala` y `wishlists`**) reconstruye tombstones
  `{ name, price, mainImage:'', visible:false, deleted:true, deletedAt, rescatado:true }` desde
  los snapshots de wishlists/pedidos y limpia URLs de imagen muertas.

### 3.8.2 Snapshots que congelan lo comprado/deseado

| Dónde | Campo(s) | Quién lo escribe |
|---|---|---|
| Línea de pedido (`pedidos_web.productos` / espejo `wala_pedidos`) | `urlImagen` (imagen del producto AL COMPRAR) | checkout (`CheckoutPage`) / `mirrorWebOrder` |
| Espejo `wala_pedidos` (por línea) | `urlImagenPersonalizada`, `textoPersonalizado`, `designId` (aditivos) | `mirrorWebOrder` (`src/services/walaOrders.js`) |
| Espejo `wala_pedidos` (doc) | `giftDetails` / `deliveryDate` (modo regalo) | `mirrorWebOrder` |
| `wishlists.items[]` | `price` (= `salePrice \|\| price` al agregar) | `src/services/wishlist.js` |
| CF `getPublicGiftRegistry` | expone `price` por item (`price: it.price ?? null`) | `functions/index.js` (**redeploy ya hecho por el dueño**) |

### 3.8.3 Campos nuevos de analítica (P1, commit `66c6081`)

- **`analytics_sessions`** (sesiones nuevas): `device` / `browser` / `os` (parser compartido
  `src/services/analytics/ua.js`, el mismo en captura y lectura) + `countryCode` / `countryName` /
  **`geoSource`** (`'ip'` = país real por IP, `'fallback'` = aproximado; `detectCountry` en
  `src/services/geo.js` **nunca bloquea la UX** — caché síncrona o update en background). Fix de
  carrera: la creación de sesión se memoiza (no más sesiones dobles).
- **`heatmap_events`** (cada lote): `sessionId`, `uid`, `clientType`, `device` — habilitan los
  filtros del heatmap. Los lotes históricos sin metadatos se marcan con aviso en la UI.
- **`analytics_daily/{YYYY-MM-DD}`** (agregado por `functions/analyticsDaily.js`, ADITIVO —
  **requiere redeploy de la CF**): `byCountry` (solo sesiones `geoSource:'ip'`; el resto suma a
  "unknown"), `byCountryAprox` (aproximación histórica por `timeZone`), `byDevice` / `byBrowser` /
  `byOS`, `byClientType` (`{APP, WEB}`), `identitiesTotal` / `identitiesLoggedIn` /
  `identitiesAnon`, `funnelFull` (`views`/`productViews`/`addToCart`/`checkoutStart`/`purchases`,
  **sin el tope legacy de 5000 eventos**) y `topIdentities` (top **25**/día por vistas/tiempo).
  Mapas capados a 50 claves + "otros". Regla `analytics_daily` añadida a
  `firebase/firestore.rules` del repo (`read: if isAdmin(); write: if false`) — **NO desplegada**.

---

## 4. Nota de migración (aditiva, no destructiva)

1. **Defaults + backfill (no romper PROD):** cada `productos_wala` recibe
   `vendorId` (default vendor "casa") y `nicheId` (default `regala-con-amor`) en una
   pasada de backfill. El array legacy `vendors[]` se mantiene hasta migrar lectores;
   `vendorId` (string canónico) es la nueva FK.
2. **Crear entidades antes de referenciar:** poblar `vendors/{casa}` y
   `niches/{regala-con-amor}` ANTES del backfill para que las FK resuelvan.
3. **Economía:** sembrar `loyaltyConfig/global` con los valores hoy hardcodeados;
   generar `loyaltyLedger` a partir del saldo actual (1 entrada `adjust` de apertura
   por usuario con `balanceAfter = monedas` actuales) y, a partir de ahí, el saldo se
   deriva del ledger. Toda mutación de saldo pasa a Cloud Functions idempotentes
   (`idempotencyKey`).
4. **Categorías:** elegir `tienda_categories` como canónica, migrar referencias de
   `categories` (legacy) y luego retirar la duplicada.
5. **Índices:** desplegar `firestore.indexes.json` ANTES de soltar features que usen
   las nuevas queries; añadir los índices objetivo de §3.3 en el mismo archivo cuando
   se implementen.
6. **Bug a corregir en paralelo:** `referrals.js` consulta `portal_users` en vez de
   `portal_clientes_users` (colección fantasma). El índice de `referrals` ya queda listo;
   el fix del nombre de colección es de código.
