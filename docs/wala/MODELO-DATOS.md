# Modelo de datos WALA — Actual vs Objetivo

> Documento de arquitectura de datos. Fuente: lectura directa de `src/services/*` y
> `src/models/*.json` (estado real del código en producción `pruebas-cd728`) + sección
> "3.4 Modelo de datos objetivo" de `docs/wala_synthesis.md`.
>
> Acompaña a `firestore.indexes.json` (raíz del repo), que declara los índices
> compuestos que el código ACTUAL ya necesita.

---

## 0. Cómo desplegar los índices

El archivo `firestore.indexes.json` está en la raíz del repo y es válido para:

```powershell
# Proyecto PROD (default en .firebaserc = pruebas-cd728)
firebase deploy --only firestore:indexes
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

Los índices de la base ERP (colecciones `pedidos` / `pedidos_web`) NO están en este
archivo porque viven en un PROYECTO FIREBASE DISTINTO (`REACT_APP_ERP_FIREBASE_*`).
Ver sección 3: hay que desplegarlos apuntando a ese proyecto, o crearlos manualmente
desde la consola del ERP.

---

## 1. Colecciones ACTUALES (estado real del código)

Nombres reales tal como aparecen en `src/services/*`. Marcadas con (PROD) las del
proyecto principal `pruebas-cd728`; (ERP) las del proyecto Firebase separado.

| Colección (real) | Proyecto | Propósito | Campos clave |
|---|---|---|---|
| `productos_wala` | PROD | Catálogo real de productos de la tienda/editor. | `name`, `price`, `salePrice`, `visible`, `featured`, `featuredOrder`, `categories[]`, `collections[]`, `tags[]`, `characters[]`, `vendors[]` (tag string, NO entidad), `brandId`, `hasVariants`, `variants[]`, `mainImage`, `mainSizes[]`, `customizationViews[]`, `printAreas`, `isComboProduct`, `comboItems[]`, `inStock` (escalar global) |
| `tienda_categories` | PROD | Categorías visuales V2 (Hoodies, Polos…). | `name`, `imageUrl`, `order`, `createdAt`, `updatedAt` |
| `categories` | PROD | Categorías legacy. **Duplicado** de `tienda_categories`; `getCategories()` lee de aquí. | `name`, `order` |
| `tienda_collections` | PROD | Colecciones/campañas temporales (drops). | `name`, `imageUrl`, `order` |
| `tienda_brands` | PROD | Marcas premium. | `name`, `description`, `imageUrl`, `config{colorHex,bgOpacity,backgroundImageUrl}` |
| `tienda_landing_pages` | PROD | Landings dinámicas por slug. | `title`, `slug`, `heroImage`, `theme{}`, `targetBrandId`, `targetCollectionId`, `isActive` |
| `tienda_mockups` | PROD | Prendas en blanco base para crear productos. | `name`, `category`, `baseImageUrl`, `variants[{colorName,colorHex,imageUrl}]` |
| `product_reviews` | PROD | Reseñas de producto + votos "útil". | `productId`, `userId`, `userName`, `rating`, `comment`, `imageUrls[]`, `helpfulVotes[]`, `createdAt` |
| `portal_clientes_users` | PROD | Perfil del cliente del portal + stats Wordle + economía de puntos. | `displayName`, `email`, `nombres`, `monedas`, `kapiCoins`, `wordlePlayed`, `wordleWins`, `wordleCurrentStreak`, `wordleMaxStreak`, `wordleTotalAttempts`, `lastWordleDate`, `wordleTodayAttempts`, `wordleTodayWon`, `referralCode` |
| `portal_users` | PROD | **Colección "fantasma" por bug** (`referrals.js:205` y memoria del proyecto). El código de resolución de referidos consulta `portal_users` cuando debería ser `portal_clientes_users`. | `referralCode` |
| `wordle` | PROD | Registro por partida diaria (1 doc por `${uid}_${YYYY-MM-DD}`). | `userId`, `displayName`, `date`, `word`, `length`, `attempts`, `timeSeconds`, `won`, `currentStreak` |
| `wordle_daily_words` | PROD | Palabra del día (docId = fecha). | `word` |
| `referrals` | PROD | Embudo de referidos (sent→clicked→…→completed→claimed). | `referrerCode`, `orderId`, `status`, `earnedCoins`, `createdAt`, `clickedAt`, `completedAt`, `updatedAt` |
| `wishlist` | PROD | Lista de deseos por cliente. | `userCode`, items |
| `suggested_packages` | PROD | Paquetes sugeridos por usuario. | `userId`, `isSelected` |
| `fechasImportantes` (servicio) | PROD | Fechas importantes del usuario. | `userId`, `isSelected` |
| `inventoryLogs` | PROD | Auditoría de cambios de stock. | `productId`, `productName`, `oldStock`, `newStock`, `userEmail`, `timestamp` (millis) |
| `enlaces_pago` | PROD | Enlaces de pago. **Reglas inseguras** (`allow update,delete: if true`, ver synthesis). | — |
| (ruleta) `PRIZES_COLLECTION` | PROD | Premios de ruleta. | `probability` |
| `pedidos` | ERP | Pedidos legacy del ERP. | `phone`, `dni`, `clienteNumeroDocumento`, `numeroPedido`, `createdAt`, `email` |
| `pedidos_web` | ERP | Pedidos web del ERP. | `phone`, `dni`, `numeroPedido`, `createdAt` |

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
| 6 | `pedidos` (ERP) | `searchOrdersInERP` (`erp/firebase.js`): `where phone ==` + `where dni ==` + `orderBy createdAt desc` | `phone ASC`, `dni ASC`, `createdAt DESC` | ⚠️ Proyecto ERP (abajo) |
| 7 | `pedidos_web` (ERP) | `searchOrdersInERP` (`erp/firebase.js`): igual que #6 sobre `pedidos_web` | `phone ASC`, `dni ASC`, `createdAt DESC` | ⚠️ Proyecto ERP (abajo) |

### Queries que NO requieren índice compuesto (verificado)
- `suggested_packages` / `fechasImportantes`: dos `where ==` de IGUALDAD solamente
  (`userId ==` + `isSelected ==`). Firestore lo resuelve con índices de campo único.
- `inventoryLogs`: un solo `orderBy timestamp desc`, sin `where`. Índice automático.
- `getReferralsByReferrer`: un solo `where referrerCode ==` (el orden se hace en memoria,
  ver comentario en `referrals.js:159`). Sin índice compuesto.
- `getInventoryLogs`, `getAllDailyWords`, ruleta `orderBy probability`: un solo criterio.
- `getWordleRankingToday`: descarga toda la colección `wordle` y filtra/ordena en cliente
  (a propósito, para evitar índices). Candidato a optimizar (ver objetivo).

### Índices del proyecto ERP (desplegar aparte)

Crear estos en el proyecto Firebase del ERP (`REACT_APP_ERP_FIREBASE_*`), NO en PROD.
Contenido de un `firestore.indexes.erp.json` para ese proyecto:

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

Despliegue:

```powershell
firebase deploy --only firestore:indexes --project <ERP_PROJECT_ID> --config firebase.erp.json
```

(o crear ambos índices a mano desde la consola del proyecto ERP).

---

## 3. Modelo de datos OBJETIVO (marketplace multi-nicho)

Fuente: `docs/wala_synthesis.md` §3.4. La migración es **aditiva**: se extienden
documentos existentes con defaults y backfill; nunca se borra ni se rompe el catálogo
vivo en `pruebas-cd728`.

### 3.1 Extensiones a colecciones existentes

| Colección | Cambio | Tipo |
|---|---|---|
| `productos_wala` | + `vendorId` (FK string canónica, NO array), `nicheId`, `fulfillmentType` (`print_on_demand`\|`stock`\|`made_to_order`\|`dropship`), `productionBlueprintId`, `commissionPctOverride`, `vendorSku`, `leadTimeDays`, `shippingProfileId`. Métricas desnormalizadas: `ratingAverage`, `ratingCount`, `salesCount`, `viewsCount`. Reestructurar `sizes` → `[{size, stock}]`. | Extensión |
| `tienda_categories` / `categories` | Consolidar en UNA colección; jerarquizar con `parentId`, `level`, `nicheId`. | Extensión + consolidación |
| `portal_clientes_users` | El saldo deja de ser fuente de verdad: `monedas`/`kapiCoins` se derivan de `loyaltyLedger`. Se conservan campos pero se recalculan. | Extensión (semántica) |

### 3.2 Colecciones NUEVAS / rediseñadas

| Colección | Estado | Propósito y campos clave |
|---|---|---|
| `niches/{nicheId}` | 🆕 Nueva | Nichos/verticales: `slug`, `name`, `type`, `commissionPct`, `theme`, `storefrontConfigId`, `active`, `order`. |
| `vendors/{vendorId}` | 🔁 Rediseño (de tag-string `vendors[]` a ENTIDAD) | `displayName`, `ownerUid`, `status`, `type` (`pod`\|`reseller`\|`self-fulfill`\|`house`), `niches[]`, `commissionPct`, `payout{method,cci,walletPhone}`, `ratings{avg,count}`, `slug`, `logoUrl`. |
| `blueprints/{id}` | 🆕 Nueva (evolución de `productTypes`/`tienda_mockups`) | Plantilla POD reutilizable: `name`, `baseGarment`, `printAreas[]`, `mockupTemplates[]`, `variantMatrix`, `basePrintCost`, `decorationMethods[]`. Varios vendors POD publican sobre el mismo blueprint. |
| `orders/{orderId}` | 🆕 Nueva (maestro) | `buyerUid`, `status`, `totals`, `loyalty{coinsSpent,coinsEarned}`, `subOrders[]`. |
| `subOrders/{id}` | 🆕 Nueva (split por vendor) | `orderId`, `vendorId`, `nicheId`, `items[]`, `fulfillmentType`, `vendorSubtotal`, `commissionAmount`, `vendorPayoutAmount`, `productionStage`, `erpPedidoId`. |
| `loyaltyLedger/{id}` | 🆕 Nueva (**fuente de verdad del saldo**) | `uid`, `type` (`earn`\|`spend`\|`expire`\|`adjust`), `source`, `amount`, `currency` (`points`\|`walacoins`\|`kapicoins`), `balanceAfter`, `refId`, `nicheId`, `idempotencyKey`, `createdAt`. Entrada inmutable; el saldo se deriva. Resuelve la divergencia `monedas` vs `monedasActivas`. |
| `loyaltyConfig/global` | 🆕 Nueva (doc único) | Tasas, topes diarios/mensuales, equivalencia puntos↔soles, TTL, feature flags. Hoy hardcodeado (`REWARD_AMOUNT=2`, tope 31 kapiCoins, TTL 90 días). |
| `missions/{id}` | 🆕 Nueva (generaliza `weeklyChallenges`) | `scope` (`daily`\|`weekly`\|`seasonal`), `actionType`, `goal`, `rewardPoints`, `tierMultiplier`, `segment`, `nicheTag`, `activeFrom`/`activeTo`. |
| `users/{uid}/missions/{date}` (`userMissions`) | 🆕 Nueva (subcolección) | Instancia diaria de misión: `progress`, `status`, `expiresAt`. |
| `tiers/{id}` | 🆕 Nueva | Niveles/XP con beneficios. |
| `rewardsCatalog/{id}` | 🆕 Nueva (hoy hardcodeado en `CatalogReward.jsx`) | Catálogo de canje dinámico. |
| `userCoupons/{id}` | 🆕 Nueva | Cupones emitidos al canjear, integrados al checkout (hoy el canje "gasta" sin generar nada). |
| `shippingZones/{id}` | 🆕 Nueva | Departamento/provincia/distrito/agencia → costo + tiempo, **por vendor**. Sustituye la regla global S/15 / gratis > S/100 hoy duplicada y divergente entre `Cart.jsx` y `CheckoutPage.jsx`. |
| `payouts/{id}` | 🆕 Nueva | Pagos a vendors. |
| `ledger/{id}` (contable) | 🆕 Nueva | Contable inmutable: venta, comisión, payout, reembolso. |
| `dailySpins` / `chests` / `flashOffers` / `segments/{uid}` | 🆕 Nuevas | Mecánicas de gamificación y segmentación. |
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
