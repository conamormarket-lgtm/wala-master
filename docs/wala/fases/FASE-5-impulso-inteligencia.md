# FASE 5 — Impulso, FOMO e inteligencia

> **Estado global de la fase: BASE HECHA Y VERIFICADA E2E (emulador local) · resto POR HACER.**
> El **núcleo de impulso e inteligencia** está implementado y verificado de extremo a extremo en el emulador local (`demo-wala`, rama `fase-0-seguridad`, **no desplegado**): **cofre diario** (`openDailyChestSecure`), **segmentación RFM** (`computeSegmentsSecure`, solo admin) y **ofertas relámpago** (`flashOffers`) con su UI de admin (`/admin/flash-offers`) y vitrina pública (`/ofertas`). Lo que sigue POR HACER requiere servicios externos / scheduler (push segmentado FCM, campañas programadas con Cloud Scheduler, recomendación por IA, countdown en home) o piezas de fases previas (push v2 de Fase 2, webhook ERP de Fase 3).
>
> Documento de diseño a profundidad. Fuente: `docs/wala/PLAN-MAESTRO.md` §4.4 y §6 (FASE 5), `docs/wala/MODELO-DATOS.md` §3.2, y lectura directa del código real (`functions/notificationsEngine.js`, `functions/index.js`, `src/services/firebase/ruleta.js`, `functions/economyLogic.js`).
>
> Es la fase de **cierre del bucle de retención**: mecánicas de impulso/FOMO, **inteligencia de segmentación** que elimina los full-scans, **campañas programables** y **antifraude + panel de economía**. Se apoya en los cimientos de Fase 2 (ledger, config, tiers, push v2) y en el RNG server-side ya existente de la ruleta.

---

## 0. Punto de partida real

| Pieza | Estado | Evidencia |
|---|---|---|
| RNG ponderado server-side (reusable para ruleta diaria/cofres) | HECHO (Fase 0) | `pickWeightedPrize` (`functions/economyLogic.js:55`), `spinRuletaSecure` (`functions/index.js:807`) |
| Engine de push horario | EN PROGRESO | `notificationEngine` (`functions/notificationsEngine.js:85`) — **hace full scan** de `portal_clientes_users` cada corrida |
| `notifyWishlistBirthdays` | EN PROGRESO | `functions/index.js:422` — **full scan** diario |
| Validación de admin en envío manual | HECHO (Fase 0, H-04) | `sendManualPromoNotification` (`notificationsEngine.js:181`) |
| Push v2 (HTTP v1, deep links, topics, copys) | DEPENDE de Fase 2 | ver `docs/wala/fases/FASE-2-fidelizacion.md` §6 |
| **Cofre diario** (`openDailyChestSecure`) | ✅ HECHO Y VERIFICADO (emulador) | recompensa 5–20 monedas/día, idempotente por `lastChestDate`, ledger `source: 'cofre_diario'` |
| **Segmentación RFM** (`computeSegmentsSecure`, solo admin) | ✅ HECHO Y VERIFICADO (emulador) | RFM sobre `orders` pagadas → `portal_clientes_users/{uid}.segment` |
| **Ofertas relámpago** (`flashOffers` + `/admin/flash-offers` + `/ofertas`) | ✅ HECHO Y VERIFICADO (emulador) | CRUD admin, vitrina pública, 2 ofertas seed |
| Ruleta diaria, cofres con llaves/pity-timer | 🔧 PARCIAL | cofre **diario** hecho; cofres con **llaves + pity-timer** y ruleta diaria, POR HACER |
| Push segmentado (FCM) / campañas programables / topics | ⬜ POR HACER | requiere FCM + Cloud Scheduler |
| Antifraude completo + panel de economía | ⬜ POR HACER | — |

> Convención de estado: ✅ hecho y verificado · 🔧 parcial · ⬜ por hacer.

---

## 0.bis Estado de implementación (local, verificado E2E)

> Todo lo siguiente fue implementado y **verificado de extremo a extremo en el emulador local** (`demo-wala`, rama `fase-0-seguridad`, **no desplegado**). Usuarios de prueba: super usuario `admin@wala.test` / `wala1234`, cliente `cliente@wala.test` / `wala1234`. Build con `vite` + emuladores Firebase.

### A. Cofre diario — `openDailyChestSecure` ✅

- Recompensa **determinista** de **5–20 monedas**, **una sola vez por día** (zona horaria **Lima**).
- **Idempotente** por campo `lastChestDate`: una segunda apertura el mismo día responde `alreadyOpened` sin volver a acreditar.
- Acredita al ledger con `source: 'cofre_diario'`.
- **Servicio:** `src/services/...` (`services/chest`).
- **Verificación:** saldo inicial **50** → tras abrir cofre **68** (+18 monedas); segunda apertura el mismo día → `alreadyOpened` (sin doble crédito). ✔

### B. Segmentación RFM — `computeSegmentsSecure` (SOLO admin) ✅

- Calcula **RFM** sobre `orders` **pagadas** y deriva el `segment`:
  - **`vip`** → `monetary >= 500` **o** `frequency >= 3`.
  - **`activo`** → `frequency >= 1` **y** `recency <= 60` días.
  - **`en_riesgo`** → tiene pedidos pero `recency > 60` días.
  - **`nuevo`** → sin pedidos.
- Escribe el resultado en `portal_clientes_users/{uid}.segment`.
- **Solo admin:** un cliente sin permiso recibe `PERMISSION_DENIED`. El campo `segment` (y `lastChestDate`) están **bloqueados al cliente** en reglas (escritura **server-only**).
- **Servicio:** `services/intelligence`.
- **Verificación:** `processed 2` → `{ activo: 1, nuevo: 1 }`, el cliente queda `activo`; cliente invocando directamente → `PERMISSION_DENIED`. ✔

### C. Ofertas relámpago — `flashOffers` ✅

- Colección **pública (lectura) / admin (escritura)**: `{ title, productId, discountPct, startsAt, endsAt, active, order }`.
- **Admin:** `/admin/flash-offers` — CRUD de ofertas + botón **"Recalcular segmentos"** (dispara `computeSegmentsSecure`).
- **Vitrina pública:** `/ofertas` — lista ofertas + botón **"Cofre diario"** (dispara `openDailyChestSecure`).
- **Servicios:** `services/flashOffers`.
- **Seed:** 2 ofertas relámpago. ✔

### Reglas de seguridad (verificadas)

- `segment` y `lastChestDate` en `portal_clientes_users` → **bloqueados al cliente** (solo el servidor los escribe).
- `flashOffers` → **lectura pública**, **escritura admin**.

---

## 1. Objetivo

Maximizar frecuencia de uso y conversión, y dar **visibilidad y control** de la economía:

1. **Impulso / FOMO**: ruleta diaria + cofres con llaves (pity-timer), ofertas relámpago con stock/contador, "misterio del día".
2. **Inteligencia**: `computeSegments` (RFM + ciclo de vida) que **reemplaza los full-scans** del engine; disparadores de comportamiento ("racha en riesgo", "misión sin completar 19:00", carrito abandonado ya existente).
3. **Campañas programables** (`campaigns`) y **FCM topics** por nicho/ciudad.
4. **Antifraude completo** (deviceIds, velocity, multicuenta, referidos con device/IP compartidos) y **panel de economía** (emisión vs sumidero, DAU/WAU, retención D1/D7/D30, ROI de recompensas).

---

## 2. Alcance / entregables (POR HACER)

- `dailySpins` / `chests` (con llaves y pity-timer) reusando el sorteo ponderado existente.
- `flashOffers` (ofertas relámpago) con stock, contador y ventana temporal.
- CF `computeSegments` (cron) → `segments/{uid}`; el engine consulta segmentos en vez de escanear toda la colección.
- Disparadores de comportamiento sobre Fase 2 (racha en riesgo, misión incompleta a cierta hora).
- `campaigns` programables + envío por **FCM topics** (nicho/ciudad).
- Antifraude: `deviceIds`, `velocityScore`, límites por uid/día, bloqueo de referidos con device/IP compartido (refuerza `claimReferralSecure`).
- Panel de economía (admin) con métricas de emisión/sumidero/retención.

---

## 3. Modelo de datos

Referencia: `docs/wala/MODELO-DATOS.md` §3.2. Todo **POR HACER**.

### 3.1 `dailySpins/{id}` y `chests/{id}` (POR HACER)

- **`dailySpins`**: `{ uid, date, prizeId, prizeType, amount, pityCounter, createdAt }` — una tirada/día; reusa `pickWeightedPrize`.
- **`chests`**: `{ uid, type (bronce/plata/oro), requiredKeys, contents (sorteo ponderado), pityThreshold, openedAt }`. Llaves obtenidas en misiones/racha (Fase 2). **Pity-timer**: garantiza premio mayor tras N aperturas sin él.

### 3.2 `flashOffers/{id}` (POR HACER)

| Campo | Tipo | Descripción |
|---|---|---|
| `productId` | string | Producto en oferta. |
| `discountPct` | number | Descuento. |
| `stockLimit` | number | Unidades en oferta. |
| `sold` | number | Vendidas (contador FOMO). |
| `startsAt` / `endsAt` | timestamp | Ventana. |
| `nicheId` / `segment` | string\|null | Objetivo. |
| `active` | bool | — |

### 3.3 `segments/{uid}` (POR HACER) — reemplaza full-scans

| Campo | Tipo | Descripción |
|---|---|---|
| `uid` | string | Usuario. |
| `rfm` | map | `{ recency, frequency, monetary, score }`. |
| `lifecycle` | string | `new` \| `active` \| `at_risk` \| `churned` \| `vip`. |
| `tierId` | string | De Fase 2. |
| `flags` | map | `{ streakAtRisk, hasIncompleteMission, abandonedCart }`. |
| `topics[]` | array | Topics FCM suscritos (nicho/ciudad). |
| `computedAt` | timestamp | — |

### 3.4 `campaigns/{id}` (POR HACER)

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | string | — |
| `trigger` | string | `scheduled` \| `behavior` (racha en riesgo, misión incompleta) \| `manual`. |
| `schedule` | string\|null | Cron/fecha para programadas. |
| `targetSegment` / `targetTopic` | string | Objetivo (de `segments`/topics). |
| `copy` | map | `{ title, body, deepLink }` (copys que **sí** impactan el push, Fase 2 E2). |
| `status` | string | `draft` \| `scheduled` \| `sent`. |
| `stats` | map | `{ sent, delivered, opened }`. |

### 3.5 Antifraude en `portal_clientes_users` (extensión, POR HACER)

`deviceIds[]` (Capacitor), `velocityScore`, `dailyEarnByDevice` — insumos de límites de velocidad y detección de multicuenta.

### 3.6 Índices compuestos previsibles

| Colección | Query | Índice |
|---|---|---|
| `segments` | usuarios de un segmento/ciclo | `lifecycle ASC, computedAt DESC` |
| `flashOffers` | ofertas activas por nicho | `nicheId ASC, active ASC, endsAt ASC` |
| `campaigns` | campañas programadas pendientes | `status ASC, schedule ASC` |
| `dailySpins` | tirada del usuario por fecha | `uid ASC, date DESC` |

---

## 4. Tareas detalladas (checklist)

> ✅ hecho y verificado (emulador) · 🔧 parcial · ⬜ por hacer.

### Bloque A — Impulso / FOMO
- [ ] A1. Ruleta diaria: CF `spinDailySecure` reusando `pickWeightedPrize`; premios al `loyaltyLedger` (Fase 2). ⬜
- [x] A2🔧. **Cofre diario** (`openDailyChestSecure`) hecho y verificado (5–20 monedas/día, idempotente, ledger `cofre_diario`). **Pendiente:** cofres con **llaves + pity-timer** y llaves emitidas por misiones/racha (Fase 2). 🔧
- [x] A3🔧. `flashOffers` con **ventana temporal** + admin (`/admin/flash-offers`) + vitrina pública (`/ofertas`) hecho y verificado. **Pendiente:** **stock/contador FOMO** ("quedan N") y **cuenta regresiva** (countdown) en UI. 🔧
- [ ] A4. Banner "te faltan X puntos para [recompensa]" (usa saldo del ledger y `rewardsCatalog`). ⬜

### Bloque B — Inteligencia / segmentación
- [x] B1🔧. **`computeSegmentsSecure`** (SOLO admin) hecho y verificado: RFM sobre `orders` pagadas → `portal_clientes_users/{uid}.segment` (`vip`/`activo`/`en_riesgo`/`nuevo`). **Pendiente:** convertirlo en **cron diario** automático (hoy se dispara manualmente desde admin / botón "Recalcular segmentos"). 🔧
- [ ] B2. Refactor de `notificationEngine` (`notificationsEngine.js:85`) y `notifyWishlistBirthdays` (`index.js:422`) para **consultar `segments`** en vez de full-scan. ⬜
- [ ] B3. Disparadores de comportamiento: "racha en riesgo" (antes de medianoche Lima), "misión sin completar 19:00". ⬜

### Bloque C — Campañas y topics
- [ ] C1. Colección `campaigns` + admin CRUD (programadas/comportamiento/manual).
- [ ] C2. Suscripción a **FCM topics** por nicho/ciudad (sustituye envío 1-a-1 masivo).
- [ ] C3. CF programada que dispara campañas `scheduled` por topic/segmento.

### Bloque D — Antifraude completo
- [ ] D1. Registrar `deviceIds` (Capacitor) y `velocityScore`; límites por uid/día sobre el ledger.
- [ ] D2. Reforzar `claimReferralSecure`: no acreditar si referrer y referido comparten device/IP; exigir compra real verificada (se apoya en el webhook ERP de Fase 3).
- [ ] D3. Detección de multicuenta y alertas.

### Bloque E — Panel de economía
- [ ] E1. Métricas de **emisión vs sumidero** (sumas del `loyaltyLedger` por `source`/`type`).
- [ ] E2. DAU/WAU/MAU, retención D1/D7/D30, ROI de recompensas (`rewardsCatalog`).
- [ ] E3. Alertas de inflación (emisión > sumidero sostenida).

### Bloque F — Verificación
- [ ] F1. El engine ya no escanea toda la colección (medir lecturas Firestore antes/después).
- [ ] F2. Pity-timer garantiza premio mayor tras N aperturas.
- [ ] F3. Referido con device compartido → no acredita.

---

## 4.bis Pendiente Fase 5

> El núcleo (cofre diario, segmentación RFM, ofertas relámpago) está ✅ hecho y verificado en emulador. Lo que sigue **requiere servicios externos / scheduler** o piezas de fases previas, y por eso queda ⬜ POR HACER:

- ⬜ **Push segmentado (FCM):** enviar notificaciones por `segment` (apoyado en push v2 de Fase 2).
- ⬜ **Campañas programadas (Cloud Scheduler):** colección `campaigns` + CF programada que dispara por topic/segmento a la hora indicada.
- ⬜ **`computeSegments` como cron diario** automático (hoy se ejecuta manualmente desde admin).
- ⬜ **Recomendación por IA** (sugerencias personalizadas).
- ⬜ **Countdown de ofertas relámpago en home** + **stock/contador FOMO** ("quedan N").
- ⬜ **Ruleta diaria** (`spinDailySecure`) y **cofres con llaves + pity-timer**.
- ⬜ **Refactor de full-scans** (`notificationEngine`, `notifyWishlistBirthdays`) para consultar segmentos.
- ⬜ **Antifraude completo** (deviceIds, velocity, multicuenta, referidos con device/IP compartido) y **panel de economía** (emisión vs sumidero, DAU/WAU, retención, ROI de recompensas).
- ⬜ **Despliegue:** todo lo anterior verificado solo en build (`vite`) + emulador; aún **sin acceso a Firebase** para desplegar.

---

## 5. Criterios de aceptación

1. `notificationEngine` y `notifyWishlistBirthdays` **consultan `segments`** y no hacen full-scan de `portal_clientes_users` (verificable por reducción de lecturas Firestore).
2. La ruleta diaria y los cofres otorgan premios al `loyaltyLedger`; el **pity-timer** garantiza un premio mayor tras el umbral configurado.
3. Las ofertas relámpago muestran stock/contador reales y dejan de aplicarse al agotarse o expirar.
4. Una campaña programada se dispara por **topic/segmento** a la hora indicada y registra `stats`.
5. Un referido con device/IP compartido o sin compra verificada **no acredita** monedas.
6. El panel de economía muestra emisión vs sumidero, DAU/WAU y retención D1/D7/D30 a partir del ledger, y alerta ante inflación sostenida.

---

## 6. Dependencias

- **Depende fuertemente de Fase 2** (POR HACER): `loyaltyLedger` (premios y métricas), `loyaltyConfig` (parámetros), tiers (segmentación), **push v2** (topics, deep links, copys, FCM HTTP v1). Sin Fase 2 esta fase no tiene base.
- **Se apoya en Fase 3** (POR HACER): el webhook de vuelta del ERP da la "compra real verificada" que el antifraude de referidos necesita; topics por nicho requieren `niches` operativos.
- **Independiente de Fase 4**.
- Reutiliza directamente el RNG server-side ya existente (`pickWeightedPrize`, `spinRuletaSecure`) de Fase 0.

---

## 7. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| `computeSegments` costoso si recorre toda la base | Costo/timeout | Lotear; recomputar incrementalmente; cachear; correr fuera de horas pico. |
| Mecánicas de impulso inflan la economía | Devaluación de puntos | Premios al ledger con topes (`loyaltyConfig`); panel de economía vigilando emisión/sumidero; pity-timer acotado. |
| Topics FCM mal segmentados → spam | Desuscripciones / bloqueo FCM | Respetar anti-spam existente (máx 2/día, ventana 9–21h); pruebas de segmentación; opt-out por topic. |
| Antifraude con falsos positivos (device compartido legítimo, p.ej. familia) | Bloqueo de usuarios reales | Umbrales calibrados; revisión manual de casos límite; combinar señales (device + IP + comportamiento). |
| Métricas del panel inconsistentes si el ledger no es íntegro | Decisiones equivocadas | Construir el panel solo sobre `loyaltyLedger` (única fuente, Fase 2); reconciliación periódica. |
| FOMO percibido como manipulador | Daño de marca | Ofertas relámpago con stock/tiempo **reales**, no falsos contadores. |

---

## 8. Esfuerzo estimado

**~4 semanas** (coincide con PLAN-MAESTRO §6, FASE 5).

| Bloque | Estimado |
|---|---|
| A — Impulso/FOMO | ~1 sem |
| B — Segmentación (RFM) | ~1 sem |
| C — Campañas + topics | ~0.5 sem |
| D — Antifraude | ~0.75 sem |
| E — Panel de economía | ~0.5 sem |
| F — Verificación | ~0.25 sem |

> Punto fino: `computeSegments` (B) y el panel de economía (E) dependen de un ledger íntegro de Fase 2; no arrancar Fase 5 hasta cerrar la migración de apertura del ledger.
