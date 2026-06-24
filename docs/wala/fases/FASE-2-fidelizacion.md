# FASE 2 — Fidelización unificada

> **Estado global de la fase: POR HACER.**
> Documento de diseño a profundidad. Fuente: `docs/wala/PLAN-MAESTRO.md` §4 y §6 (FASE 2), `docs/wala/MODELO-DATOS.md` §3.2, y lectura directa del código real (`functions/index.js`, `functions/economyLogic.js`, `functions/notificationsEngine.js`, `src/contexts/AuthContext.jsx`, `src/services/firebase/{ruleta,ballSort}.js`, `src/components/common/KapiPet/KapiPet.jsx`).
>
> **Precondición ya satisfecha por Fase 0** (commits `3d53501`, `9e84990`, `f0e4aa0`): la economía dejó de ser client-side. Hoy existen y están desplegables las Cloud Functions callable `feedKapiSecure`, `claimBallSortRewardSecure`, `spinRuletaSecure`, `recordChallengeEventSecure`, `spendCoinsSecure`, `freezeCoinsSecure`, `grantSurveyRewardSecure`, `claimDatesStreakSecure`, `claimReferralSecure` (`functions/index.js:738-1092`), más la lógica pura testeada en `functions/economyLogic.js` (44/44 tests). Fase 2 **no reabre** ese trabajo: lo **consolida** sobre un ledger único y un config central, y cierra el **residual** explícito de Fase 0.

---

## 0. Residual heredado de Fase 0 que esta fase DEBE cerrar

El propio código deja anotado el agujero que queda abierto:

```js
// functions/index.js:850-852  (recordChallengeEventSecure)
// H-05: el conteo se FUERZA a 1 por llamada (no se confía en el cliente). La
// verificación real de que la acción ocurrió debe moverse a triggers server-side
// (p.ej. onWrite de wishlist/compra/reseña) en Fase 2; hoy esto solo limita el abuso.
```

| Residual | Dónde | Severidad | Cierre en Fase 2 |
|---|---|---|---|
| El progreso de retos se acredita por **autodeclaración del cliente** (`actionType` enviado por el front), solo limitado a +1/llamada | `functions/index.js:847-895` | ALTO (farmeo de monedas por reto) | Reemplazar por **emisores server-side**: triggers `onWrite`/`onCreate` sobre `wishlist`, reseñas (`product_reviews`), pedidos (webhook ERP) que emiten el evento de progreso. El cliente deja de poder declarar la acción. |
| Saldo en dos representaciones (`monedas` escalar vs `monedasActivas` lotes TTL) que pueden divergir; `calculateActiveCoins` ignora expiración | `src/contexts/AuthContext.jsx`, `functions/economyLogic.js:32-46` (`applyDebit`) | MEDIO (inconsistencia de saldo, TTL no real) | Sustituir por `loyaltyLedger` como única fuente de verdad. |
| Doble moneda confusa: el header suma `Math.floor(monedas)+kapiCoins` pero solo `monedas` se gasta | `AuthContext.jsx`, Header | MEDIO (UX/semántica) | Definir WalaCoins=puntos canjeables, kapiCoins=XP/racha no gastable. |
| Constantes de economía hardcodeadas (`KAPI_MONTHLY_CAP=31`, `BALLSORT_REWARD=2`, `REWARD_COINS_PER_ORDER=10`, TTL 90d) | `functions/economyLogic.js:9-13` | BAJO (rigidez) | Mover a `loyaltyConfig/global`. |
| Push: copys admin leídos como string (editar copys no afecta el push real); `sendToDevice` deprecado (H-10); tap del push no navega | `functions/notificationsEngine.js:35,196`, admin de copys | MEDIO (disponibilidad + retención) | Push v2 (ver §6). |

---

## 1. Objetivo

Unificar las mecánicas de fidelización **ya construidas y dispersas** (Wordle, Ruleta, Ball Sort, mascota KapiPet, retos semanales, referidos, encuesta, fechas importantes) en **un solo motor económico server-authoritative** con:

1. **Una economía de puntos única** — `WalaCoins` (= `monedas`) como puntos canjeables; `kapiCoins` reconvertido a **XP / racha** (no gastable) — derivada de un **ledger inmutable** (`loyaltyLedger`) y parametrizada por un **config central** (`loyaltyConfig/global`).
2. **Misiones diarias** rotables (`missions` + `userMissions`) generadas por cron, que convierten los minijuegos existentes en fuentes de puntos y cablean los `actionType` hoy huérfanos con **verificación real server-side**.
3. **Racha global** transversal con **streak freeze**, desacoplada de la ruleta.
4. **Tiers / XP** con beneficios (multiplicador de puntos, envío gratis desde umbral, cofres exclusivos).
5. **Catálogo de recompensas dinámico** (`rewardsCatalog`) + **cupones persistentes** (`userCoupons`) integrados al checkout.
6. **Push v2**: FCM HTTP v1 multicast, limpieza de tokens, deep links que navegan, copys editables que sí impactan el push, topics.

Esta es **la capa de uso diario** y el principal motor de retención/adquisición hacia Personalizados (Fase 4) y Marketplace (Fase 3).

---

## 2. Alcance / entregables

**Incluye (POR HACER):**
- `loyaltyLedger` como fuente de verdad del saldo; migración de apertura desde `monedas`/`kapiCoins` actuales.
- `loyaltyConfig/global` con todas las tasas/topes/TTL/feature flags hoy hardcodeados.
- Motor de misiones: colección `missions`, subcolección `users/{uid}/missions/{date}`, CF `generateDailyMissions` (cron 00:05 America/Lima), `claimMissionRewardSecure`.
- Reconversión de Wordle (sin recompensa hoy) y Ball Sort (+2/día) en misiones que otorgan puntos vía ledger.
- Emisores de eventos server-side que reemplazan la autodeclaración de retos (cierre del residual §0).
- Racha global `dailyStreak` + `streak freeze`; completar el `daily_visit` que quedó a medias en `KapiPet.jsx`.
- `tiers` + XP con multiplicador aplicado server-side en cada `earn`.
- `rewardsCatalog` dinámico (hoy hardcodeado en `CatalogReward.jsx`) + `userCoupons` integrados al checkout.
- Push v2 completo (FCM HTTP v1, tokens, deep links, copys, topics, service worker web, validación de rol admin en envío manual — esto último ya hecho en Fase 0, H-04).

**Excluye (otras fases):**
- Split de pago, comisiones, payouts, multi-vendor → **Fase 3**.
- Arte de producción POD, blueprints → **Fase 4**.
- Ruleta diaria, cofres, ofertas relámpago, `computeSegments`, campañas programables, antifraude completo y panel de economía → **Fase 5** (Fase 2 deja los cimientos: ledger, config, tiers, push v2).

---

## 3. Modelo de datos (colecciones nuevas / rediseñadas)

Referencia: `docs/wala/MODELO-DATOS.md` §3.2. Todas las colecciones de esta sección están marcadas **POR HACER**.

### 3.1 `loyaltyLedger/{id}` — fuente de verdad del saldo (POR HACER)

Entrada **inmutable**; el saldo se deriva sumando entradas. Resuelve la divergencia `monedas` vs `monedasActivas`.

| Campo | Tipo | Descripción |
|---|---|---|
| `uid` | string | Usuario dueño de la entrada. |
| `type` | string | `earn` \| `spend` \| `expire` \| `adjust`. |
| `source` | string | Origen: `mission:wordle`, `mission:ballsort`, `game:ruleta`, `order:earn`, `referral`, `survey`, `dates_streak`, `coupon_redeem`, `admin_adjust`, `opening_balance`, `tier_multiplier`. |
| `amount` | number | Positivo (earn/adjust+) o negativo (spend/expire). |
| `currency` | string | `points` (= WalaCoins) \| `xp` (= kapiCoins). |
| `balanceAfter` | number | Saldo resultante (denormalizado para auditoría). |
| `refId` | string | Id del documento que originó el movimiento (pedido, reto, cupón…). |
| `nicheId` | string\|null | Nicho asociado (para reporting; la fidelidad NUNCA se segmenta). |
| `idempotencyKey` | string | `uid + source + fecha[+refId]`; único, evita doble acreditación. |
| `expiresAt` | timestamp\|null | Para entradas `earn` con TTL (puntos caducan). |
| `createdAt` | timestamp | Inmutable. |

**Reglas:** `allow read: if request.auth.uid == resource.data.uid || isAdmin();` · `allow write: if false;` (solo Cloud Functions con Admin SDK escriben). Esto es **continuación natural** de la lista de campos bloqueados que Fase 0 puso en `firestore.rules` (H-06/H-07).

### 3.2 `loyaltyConfig/global` — doc único de parámetros (POR HACER)

Centraliza lo hoy hardcodeado en `functions/economyLogic.js:9-13` y `CatalogReward.jsx`.

| Campo | Tipo | Valor de arranque (de código actual) |
|---|---|---|
| `pointToSol` | number | `1` (1 punto = S/1 en checkout). |
| `maxRedeemPctOfOrder` | number | `0.5` (tope 50% del pedido, regla actual). |
| `pointsTtlDays` | number | `90`. |
| `kapiMonthlyCap` | number | `31` (`KAPI_MONTHLY_CAP`). |
| `ballSortReward` | number | `2` (`BALLSORT_REWARD`). |
| `rewardCoinsPerOrder` | number | `10` (`REWARD_COINS_PER_ORDER`). |
| `datesStreakBonus` | number | `25` (`STREAK_DATES_BONUS`). |
| `surveyRewardMax` | number | `15` (`SURVEY_REWARD_MAX`). |
| `dailyMissionCount` | number | `3`. |
| `streakFreezeTokensPerMonth` | number | `2`. |
| `featureFlags` | map | `{ dailyMissions, tiers, dynamicRewards, pushV2 }` bool. |

### 3.3 `missions/{id}` — plantillas de misión (POR HACER, generaliza `globals/activeChallenge`)

| Campo | Tipo | Descripción |
|---|---|---|
| `scope` | string | `daily` \| `weekly` \| `seasonal`. |
| `actionType` | string | `play_wordle`, `play_ballsort`, `spin_ruleta`, `make_purchase`, `write_review`, `add_wishlist`, `daily_visit`, `share_referral`. |
| `goal` | number | Meta (p.ej. 1 partida, 1 reseña). |
| `rewardPoints` | number | Puntos al completar. |
| `rewardXp` | number | XP al completar. |
| `tierMultiplierApplies` | bool | Si el multiplicador de tier aplica al reward. |
| `segment` | string\|null | Segmento objetivo (placeholder para Fase 5 / `computeSegments`). |
| `nicheTag` | string\|null | Nicho que la misión empuja. |
| `weight` | number | Peso para el sorteo diario de 3 misiones. |
| `active`, `activeFrom`, `activeTo` | bool/ts | Ventana de validez. |

### 3.4 `users/{uid}/missions/{date}` — instancia diaria (`userMissions`, POR HACER)

| Campo | Tipo | Descripción |
|---|---|---|
| `missionId` | string | FK a `missions`. |
| `actionType` | string | Copiado para evaluación rápida. |
| `goal` | number | Meta congelada al asignar. |
| `progress` | number | Avance actual. |
| `status` | string | `assigned` \| `completed` \| `claimed` \| `expired`. |
| `rewardPoints`, `rewardXp` | number | Congelados al asignar. |
| `expiresAt` | timestamp | Fin del día Lima. |

### 3.5 Racha y tiers en `portal_clientes_users` (extensión, POR HACER)

| Campo | Tipo | Descripción |
|---|---|---|
| `dailyStreak` | map | `{ count, lastDate (YYYY-MM-DD Lima), freezeTokens }` — racha global, desacoplada de `weeklyClaimsData`. |
| `xp` | number | Solo-sube; deriva el tier. (El saldo gastable se deriva del ledger; `monedas` se recalcula.) |
| `tierId` | string | FK a `tiers`. |

### 3.6 `tiers/{id}`, `rewardsCatalog/{id}`, `userCoupons/{id}` (POR HACER)

- **`tiers/{id}`**: `{ name (bronce/plata/oro/diamante), minXp, coinMultiplier, freeShippingThreshold, perks[], badgeUrl, order }`.
- **`rewardsCatalog/{id}`**: `{ name, type (coupon|product|shipping|chest), costPoints, value, stock, active, imageUrl, tierRequired }` — reemplaza el catálogo hardcodeado de `CatalogReward.jsx`.
- **`userCoupons/{id}`**: `{ uid, code, type, value, status (active|used|expired), minOrder, issuedFrom (rewardId), expiresAt, usedInOrderId }` — integrados al checkout (hoy el canje gasta sin generar nada).

### 3.7 Índices compuestos previsibles (añadir a `firestore.indexes.json`)

| Colección | Query | Índice |
|---|---|---|
| `loyaltyLedger` | historial por usuario | `uid ASC, createdAt DESC` |
| `loyaltyLedger` | expiraciones pendientes (TTL real) | `currency ASC, type ASC, expiresAt ASC` |
| `userCoupons` | cupones vigentes del usuario | `uid ASC, status ASC, expiresAt ASC` |
| `missions` | activas por scope | `scope ASC, active ASC, weight DESC` |

---

## 4. Mapeo: qué se reutiliza de lo ya construido

| Activo existente | Archivo real | Rol en el sistema unificado |
|---|---|---|
| Ball Sort `+2/día` | `src/services/firebase/ballSort.js`, CF `claimBallSortRewardSecure` (`functions/index.js:781`) | Misión diaria `play_ballsort`; el reward pasa a escribir en `loyaltyLedger`. |
| Wordle (sin recompensa hoy) | `src/services/wordle.js` | Misión diaria `play_wordle` que **sí otorga puntos**. |
| Ruleta (sorteo ponderado) | `src/services/firebase/ruleta.js`, CF `spinRuletaSecure` (`functions/index.js:807`), `pickWeightedPrize` (`economyLogic.js:55`) | Misión `spin_ruleta`; el RNG ya está server-side (reusable por ruleta diaria de Fase 5). |
| Mascota Kapi + feed | `src/components/common/KapiPet/KapiPet.jsx`, CF `feedKapiSecure` (`functions/index.js:738`) | Home de misiones diarias; el claim diario alimenta `dailyStreak`. |
| Retos | CF `recordChallengeEventSecure` (`functions/index.js:847`), `submitChallengeEvidence`/`approveChallengeEvidence` | Generalizar `globals/activeChallenge` → `missions`; reemplazar autodeclaración por emisores server-side. |
| Referidos | CF `claimReferralSecure` (`functions/index.js:1012`) | Misión social `share_referral`; fórmula de premio unificada en `loyaltyConfig`. |
| Encuesta | CF `grantSurveyRewardSecure` (`functions/index.js:960`) | Misión one-shot; reward al ledger. |
| Fechas importantes | CF `claimDatesStreakSecure` (`functions/index.js:985`) | Bonus de racha; al ledger. |

---

## 5. Tareas detalladas (checklist) — POR HACER

### Bloque A — Ledger y config (cimiento)
- [ ] A1. Crear `loyaltyConfig/global` y sembrarlo con los valores de `economyLogic.js:9-13` y de `CatalogReward.jsx`.
- [ ] A2. Crear módulo `functions/loyalty/ledger.js`: `appendEntry({uid,type,source,amount,currency,refId,idempotencyKey,expiresAt})` transaccional e idempotente; `getBalance(uid,currency)` por suma.
- [ ] A3. Migración de apertura: por cada usuario, una entrada `adjust`/`opening_balance` con `balanceAfter = monedas` actuales (y otra `xp` desde `kapiCoins`). Script en `scripts/`.
- [ ] A4. Refactor de las 9 CF `*Secure` existentes para que **escriban al ledger** en vez de mutar `monedas`/`kapiCoins` directo. Mantener firmas callable (no romper el front).
- [ ] A5. Reglas: `loyaltyLedger` y `loyaltyConfig` read-propio/admin, write solo CF. Ampliar lista de campos bloqueados en `portal_clientes_users` con `xp`, `tierId`, `dailyStreak`.
- [ ] A6. Job de **expiración real** (cron diario): emite entradas `expire` para puntos con `expiresAt` vencido (cierra el TTL que `calculateActiveCoins` ignora).

### Bloque B — Misiones
- [ ] B1. Colección `missions` + seed inicial (Wordle, BallSort, Ruleta, compra, reseña, wishlist, visita, referido).
- [ ] B2. CF `generateDailyMissions` (cron `5 0 * * *` America/Lima): asigna `dailyMissionCount` misiones a `users/{uid}/missions/{date}` por sorteo ponderado.
- [ ] B3. CF `claimMissionRewardSecure({date, missionId})`: valida `status==completed`, marca `claimed`, acredita al ledger con multiplicador de tier.
- [ ] B4. **Emisores server-side** (cierra residual §0): triggers `onCreate` de `wishlist` (→`add_wishlist`), `product_reviews` (→`write_review`), webhook ERP de pedido completado (→`make_purchase`); cada uno incrementa `progress` de la `userMission` correspondiente. **Eliminar** la confianza en `actionType` del cliente de `recordChallengeEventSecure`.
- [ ] B5. Cablear Wordle y Ball Sort: al ganar/completar, marcar progreso de la misión diaria.
- [ ] B6. UI: panel de misiones diarias en el home de KapiPet (3 tarjetas con progreso y botón reclamar).

### Bloque C — Racha y tiers
- [ ] C1. `dailyStreak` global: incrementar en el primer evento diario (visita/juego); romper si falta un día (fecha Lima vía `limaTodayStr`).
- [ ] C2. **Streak freeze**: gastar `freezeTokens` para no perder racha; recarga mensual según `loyaltyConfig`.
- [ ] C3. Completar `daily_visit` (quedó a medias en `KapiPet.jsx`).
- [ ] C4. `tiers` + seed; CF que recomputa `tierId` al cambiar `xp`; aplicar `coinMultiplier` server-side en cada `earn`.
- [ ] C5. UI: barra de progreso de racha y badge de tier en perfil/header.

### Bloque D — Recompensas y cupones
- [ ] D1. `rewardsCatalog` dinámico + admin CRUD; migrar el catálogo hardcodeado de `CatalogReward.jsx`.
- [ ] D2. CF `redeemRewardSecure({rewardId})`: descuenta puntos (ledger `spend`), emite `userCoupons`/producto/envío gratis según `type`, valida `tierRequired` y stock.
- [ ] D3. Integrar `userCoupons` al checkout: aplicar cupón válido, marcar `used` con `usedInOrderId` (cierra el bug de que el canje hoy gasta sin generar nada).

### Bloque E — Push v2 (cierra H-10 y residuales de notificaciones)
- [ ] E1. Migrar `messaging.sendToDevice` → `messaging.sendEachForMulticast` en `notificationsEngine.js:35,196`; limpiar tokens `registration-token-not-registered` de `fcmTokens`.
- [ ] E2. Conectar copys admin (`{a,b}`) con el engine (hoy se leen como string → editar copys no afecta el push real).
- [ ] E3. Deep link del tap: `pushNotificationActionPerformed` + `data.deepLink` → `DeepLinkHandler` (hoy el tap no navega).
- [ ] E4. Service worker web para push en navegador.
- [ ] E5. Topics FCM básicos (preparan campañas de Fase 5).

### Bloque F — Verificación
- [ ] F1. Tests de la lógica pura del ledger (extender `functions/test/economyLogic.test.js`).
- [ ] F2. Emulador: no se puede acreditar misión sin el evento real server-side.
- [ ] F3. Smoke: ganar Wordle → misión completa → reclamar → ledger `+earn` con multiplicador correcto.

---

## 6. Criterios de aceptación

1. El saldo mostrado al usuario se **deriva 100% de `loyaltyLedger`**; no quedan escrituras directas de `monedas`/`kapiCoins` fuera de las CF.
2. Intentar acreditar un reto/misión **sin el evento server-side** (p.ej. llamando `recordChallengeEventSecure` a mano) **no suma puntos**.
3. Wordle y Ball Sort otorgan puntos al ledger; el header muestra puntos canjeables (WalaCoins) y XP/tier por separado, sin sumarlos erróneamente.
4. La racha global sobrevive un día con `streak freeze` y se rompe correctamente al segundo día sin token (probado cerca de medianoche Lima).
5. Canjear una recompensa emite un `userCoupon` aplicable en checkout; el cupón pasa a `used` tras la compra.
6. Editar un copy en el admin **cambia** el texto del push real; el tap del push **navega** al deep link; un token inválido se limpia tras un envío.
7. Todos los parámetros económicos viven en `loyaltyConfig/global` (cambiar un valor ahí cambia el comportamiento sin redeploy de código).

---

## 7. Dependencias

- **Depende de Fase 0** (HECHO, commits `3d53501`/`9e84990`/`f0e4aa0`): economía server-authoritative, custom claims, reglas base, CF `*Secure`. Sin esto el ledger no tiene dónde apoyarse.
- **Depende de Fase 1** (HECHO, commits `a3c4d66`/`a652f60`/`f188260`/`0f2414f`): Vite, `nicheId` en producto (para `nicheTag`/reporting del ledger), base de búsqueda.
- **Habilita Fase 5**: ledger, `loyaltyConfig`, tiers y push v2 son prerrequisito de ruleta diaria/cofres, `computeSegments`, campañas y panel de economía.
- **Independiente** de Fase 3 y Fase 4 (pueden ir en paralelo), salvo el cupón de **envío gratis** que se integra mejor cuando exista `shippingZones` (Fase 3).

---

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Migración de apertura del ledger mal calculada → saldos alterados | Pérdida de confianza / dinero | Backup previo (ver `ops/backup/`); script idempotente con `opening_balance` único por uid; reconciliar suma del ledger vs `monedas` antes de cortar. |
| Emisores server-side duplican eventos (doble trigger) | Doble acreditación | `idempotencyKey` por evento; transacción con verificación de progreso ya contado. |
| Inflación de puntos al unificar fuentes | Devaluación de la economía | Topes diarios/mensuales en `loyaltyConfig`; panel de economía (Fase 5) para vigilar emisión vs sumidero. |
| `generateDailyMissions` full-scan de usuarios no escala | Costo/timeout | Lotear por páginas; en Fase 5 limitar a usuarios activos vía `segments`. |
| Confusión de usuarios al cambiar la semántica de kapiCoins (gastable→XP) | Quejas | Comunicar en app; convertir kapiCoins gastables previos a puntos en la migración. |
| Push v2 con service worker mal configurado | Pérdida de push web | Probar en staging; mantener Android (ya funcional) como canal principal durante la transición. |

---

## 9. Esfuerzo estimado

**~4 semanas** (coincide con el roadmap del PLAN-MAESTRO §6, FASE 2).

| Bloque | Estimado |
|---|---|
| A — Ledger y config | ~1 sem |
| B — Misiones + emisores server-side | ~1 sem |
| C — Racha y tiers | ~0.5 sem |
| D — Recompensas y cupones | ~0.5 sem |
| E — Push v2 | ~0.5 sem |
| F — Verificación/tests | ~0.5 sem |

> Riesgo de cronograma: la migración de apertura del ledger (A3) y los emisores server-side (B4) son los puntos finos; presupuestar holgura ahí.
