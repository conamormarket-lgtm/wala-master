# FASE 0 — SEGURIDAD (server-authoritative) — **HECHA**

> Estado global de la fase: **HECHA** (verificada en LOCAL).
> Rama: `fase-0-seguridad`. Proyecto PROD del Portal: `pruebas-cd728` (es producción real pese al nombre). Proyecto ERP: separado, accedido vía cuenta de servicio en el secret `ERP_SERVICE_ACCOUNT`.
> Despliegue a Vercel/Firebase: **PENDIENTE** — el usuario aún no tiene acceso a la consola de Firebase. Todo lo de esta fase está validado en local (`vite build`, dev server en `http://localhost:3000`, suite de economía 44/44, y revisión adversarial con agentes). Mover a Vercel/Firebase es posterior.
>
> Este documento es el **registro de cierre** del runbook pre-implementación `docs/wala/FASE-0-SEGURIDAD.md` (los 11 hallazgos H-01..H-11). Para cada hallazgo se describe qué era, **qué fix se aplicó realmente** (nombres de función/archivo reales) y cómo verificarlo.

---

## 1. Objetivo de la fase

Cerrar la superficie de ataque crítica del Portal de clientes antes de construir cualquier feature nueva del marketplace (Fase 1+). En concreto:

1. **Eliminar el backdoor de administrador** y migrar TODA la autorización a **Firebase custom claims** (fuente de verdad única), tanto en cliente como en reglas Firestore/Storage.
2. **Hacer la economía server-authoritative**: ningún saldo (`monedas`, `kapiCoins`, `monedasActivas`, multiplicadores, etc.) se calcula ni se escribe desde el cliente; todo earn/spend pasa por Cloud Functions callable, transaccionales e idempotentes, y las reglas bloquean esos campos para el propio usuario.
3. **Asegurar la integración con el ERP**: validar la propiedad y el estado de los pedidos contra el Firebase del ERP antes de acuñar monedas (**fail-closed**), y autenticar el webhook de creación de cuentas con **HMAC-SHA256**.
4. **Cerrar fugas de credenciales y de pago**: quitar `password = DNI`, quitar el fallback dummy de Culqi, restringir reglas peligrosas (`enlaces_pago`).
5. **Sostener la disponibilidad de notificaciones**: migrar de la API FCM deprecada a `sendEachForMulticast` con limpieza de tokens inválidos.
6. **Resistir una revisión adversarial**: tras los fixes, un segundo pase de agentes buscó bypass y se corrigieron 12 hallazgos adicionales (referidos, DNI mutable, create con saldo, etc.).

Criterio de "hecho" de la fase: código en la rama, suite de tests de economía en verde (44/44), `vite build` y dev server sin errores, y los 11 hallazgos del runbook cerrados o con su residual explícitamente documentado y aceptado.

---

## 2. Commits que componen la fase

| Commit | Mensaje | Alcance |
|--------|---------|---------|
| `3d53501` | seguridad(fase-0): elimina backdoor admin, custom claims, valida pedidos ERP y reglas | H-01, H-02, H-03 (base), H-04, H-09, H-07, H-08 — `firestore.rules`, `storage.rules`, `functions/index.js`, `functions/notificationsEngine.js`, `scripts/set-admin-claims.js`, `AuthContext.jsx`, `LoginPage.jsx`, `referrals.js` |
| `9e84990` | seguridad(fase-0): H-06 economía server-authoritative | Las 9 Cloud Functions de economía (+360 líneas en `functions/index.js`), reglas con campos de saldo bloqueados, `AuthContext.jsx` (reescrito a llamadas a Functions), `SubscriptionSurveyPage.jsx`, `ballSort.js`, `ruleta.js`, `referrals.js` |
| `f0e4aa0` | seguridad(fase-0): H-03 + fixes de revisión adversarial + tests de economía | H-03 cierre en cliente (`accountFromOrder.js`), extracción de lógica pura a `functions/economyLogic.js`, suite `functions/test/economyLogic.test.js` (44/44), y los 12 fixes de la revisión adversarial; limpieza en `App.jsx` y `Header.jsx` |

> H-05, H-10 y H-11 se cierran repartidos entre `3d53501` y `f0e4aa0` (ver la tabla maestra). H-02/H-03/H-06 son las piezas más grandes y se construyeron en los tres commits.

---

## 3. Tabla maestra de los 11 hallazgos (estado final)

| ID | Severidad | Archivo(s) real(es) | Estado final |
|----|-----------|---------------------|--------------|
| H-01 | CRÍTICO | `src/pages/LoginPage.jsx`, `src/contexts/AuthContext.jsx`, `functions/index.js` (`setAdminClaim`), `scripts/set-admin-claims.js` | **CERRADO** |
| H-02 | CRÍTICO | `functions/index.js` (`secureClaimMonedas`, `getErpDb`) | **CERRADO** (fail-closed) |
| H-03 | CRÍTICO | `functions/index.js` (`ensureAccountFromOrder`), `functions/economyLogic.js` (`randomPassword`, `verifyWebhookSignature`), `src/services/accountFromOrder.js` | **PARCIAL** — HMAC y password aleatoria HECHAS; HMAC en modo transición (warn-not-fail si falta el secreto) |
| H-04 | CRÍTICO | `functions/notificationsEngine.js` (`sendManualPromoNotification`) | **CERRADO** |
| H-05 | ALTO | `src/services/referrals.js`, `functions/index.js` (`claimReferralSecure`) | **CERRADO** |
| H-06 | CRÍTICO | `functions/index.js` (9 callables de economía), `firebase/firestore.rules`, `src/contexts/AuthContext.jsx` | **CERRADO** |
| H-07 | CRÍTICO | `firebase/firestore.rules` | **CERRADO** |
| H-08 | CRÍTICO | `firebase/firestore.rules` (`enlaces_pago`) | **CERRADO** (reglas); webhook PayPal verificado = POR HACER (Fase 3) |
| H-09 | ALTO | `firebase/firestore.rules`, `firebase/storage.rules` | **PARCIAL** — claims como fuente de verdad; puente `adminUsers` aún presente |
| H-10 | MEDIO | `functions/notificationsEngine.js` | **CERRADO** |
| H-11 | MEDIO | `functions/index.js` (`processCulqiPayment`) | **PARCIAL** — sin dummy ni `REACT_APP_`, validación básica del monto; recálculo del monto contra el pedido real = RESIDUAL (Fase 3) |

---

## 4. Detalle por hallazgo

### H-01 — Backdoor de administrador hardcodeado — **CERRADO**

**Qué era.** En `src/pages/LoginPage.jsx` había un bloque que comparaba `email === 'AdminWalaPro' && password === 'LaClaveDeWala2020'`, seteaba `localStorage.adminWalaPro = 'true'` y redirigía a `/admin`. `AuthContext.jsx` derivaba `isAdmin` de ese flag de `localStorage` y de una lista de emails hardcodeados (`yorh001@gmail.com`, `heyeru24@gmail.com`). La clave viajaba dentro del bundle público.

**Fix realmente aplicado.**
- Se **eliminó por completo** el bloque del backdoor en `LoginPage.jsx`. Verificado: `grep` de `LaClaveDeWala2020`/`adminWalaPro`/`AdminWalaPro` en `src/pages/LoginPage.jsx` da **0 coincidencias**. El login ya solo navega a `/encuesta-suscripcion`, `/` o `/completar-perfil`.
- En `src/contexts/AuthContext.jsx` la autorización admin ahora viene del **token de Firebase Auth**: en el `onAuthChange` se hace `await firebaseUser.getIdTokenResult()` y se guarda `setIsAdminClaim(tokenResult.claims?.admin === true)` (`AuthContext.jsx:49-54`). El `isAdmin` final es `isAdminClaim || effectiveAdminPermissions.length > 0` (`AuthContext.jsx:204`), donde `effectiveAdminPermissions` sale de `adminRoles` (RBAC por email para permisos de UI) o de `['superadmin']` si hay claim. **Ya no se lee `localStorage` ni se comparan emails hardcodeados** para conceder admin.
- Se añadió la Cloud Function callable **`setAdminClaim`** (`functions/index.js:692-720`): exige que el llamante ya sea admin (`callerIsAdmin`) y ejecuta `auth.setCustomUserClaims(targetUid, { admin: true, role: 'superadmin' })` (o `{ admin: false }` para revocar). Acepta `targetUid` o `targetEmail`.
- Bootstrap inicial con **`scripts/set-admin-claims.js`** (cuenta de servicio): como al inicio nadie tiene el claim y `setAdminClaim` exige un admin previo, este script Node usa `admin.credential.applicationDefault()` (`GOOGLE_APPLICATION_CREDENTIALS`) y asigna `{ admin: true, role: 'superadmin' }` a los emails pasados por CLI. Soporta `--revoke`.
- Limpieza adicional (commit `f0e4aa0`): se borró `handleResetCoinsForTesting` (que comparaba `yorh001@gmail.com` y reseteaba `monedas`) de `Header.jsx` y la `RestrictedRoute` muerta de `App.jsx`.

**Verificación.**
- `grep -ri "LaClaveDeWala2020|adminWalaPro" src/` → 0 resultados (confirmado).
- En el navegador, `localStorage.setItem('adminWalaPro','true')` + recarga → NO concede `/admin` (la fuente es el claim del token).
- Un usuario sin claim `admin` no obtiene `isAdmin === true`.

---

### H-02 — `secureClaimMonedas` sin validación de pedido — **CERRADO (fail-closed)**

**Qué era.** La función callable solo exigía autenticación; toda la validación de propiedad y estado del pedido estaba **comentada**. Un usuario podía pasar cualquier `pedidoId` inventado y recibir monedas (acuñación infinita), y el `amount` lo fijaba el cliente.

**Fix realmente aplicado** (`functions/index.js:239-356`).
- **Acceso al Firebase del ERP**: `getErpDb()` (`functions/index.js:43-57`) inicializa una segunda app Admin (`admin.initializeApp({ credential: cert(sa) }, "erp")`) leyendo la cuenta de servicio del ERP del secret `ERP_SERVICE_ACCOUNT` (JSON). Si el secret no existe o no parsea, devuelve `null`.
- **Fail-closed**: si `getErpDb()` es `null`, `secureClaimMonedas` lanza `failed-precondition` (`functions/index.js:264-271`). Sin poder verificar el pedido, **no se acuña nada**.
- **Validación reactivada**: busca el pedido en las colecciones del ERP `pedidos_web` y `pedidos` por `pedidoId` (`:280-287`); si no existe → `not-found`. Comprueba **propiedad** por `orderData.userId === uid` o por DNI (`orderData.dni === userData.dni`) → si no, `permission-denied` (`:289-294`). Comprueba **estado** normalizando acentos y exigiendo `finalizado | entregado | completado` → si no, `failed-precondition` (`:296-301`).
- **Monto server-authoritative**: `const amount = REWARD_COINS_PER_ORDER;` (= 10, de `economyLogic.js`). Se **ignora** cualquier `amount` enviado por el cliente.
- **Idempotencia**: dentro de la transacción se verifica `userData.monedasReclamadas.includes(pedidoId)` → `already-exists`, y al acreditar se hace `arrayUnion(pedidoId)` (`:310-313`, `:346`). El `pedidoId` se normaliza a `String` una sola vez (`:248`) para evitar doble reclamo por `'123'` vs `123`.
- Las monedas se acreditan con TTL en `monedasActivas` (lotes con `expiresAt`, 90 días) además del campo global `monedas`.

**Verificación.**
- Sin `ERP_SERVICE_ACCOUNT` → la función rechaza (fail-closed). Esto es el estado actual en local/no-desplegado: el comportamiento seguro es "no acuñar".
- Con ERP configurado: `pedidoId` inexistente → `not-found`; pedido de otro usuario → `permission-denied`; pedido no finalizado → `failed-precondition`; segundo reclamo del mismo pedido → `already-exists`.

---

### H-03 — `ensureAccountFromOrder`: webhook sin auth, CORS `*`, password = DNI — **PARCIAL**

**Qué era.** Webhook `https.onRequest` con CORS `*`, que anunciaba el header `X-Webhook-Secret` pero nunca lo validaba, y creaba cuentas con la contraseña = DNI del cliente (semipúblico en Perú → toma de cuentas).

**Fix realmente aplicado** (`functions/index.js:127-233` + `functions/economyLogic.js` + `src/services/accountFromOrder.js`).
- **HMAC-SHA256** del webhook: el ERP firma el body crudo con `ERP_WEBHOOK_SECRET` y envía la firma hex en `X-Webhook-Signature`. La función recalcula con `verifyWebhookSignature(rawBody, sig, secret)` (`economyLogic.js:67-73`), que usa `crypto.createHmac('sha256', ...)` y compara con `crypto.timingSafeEqual` (tiempo constante; chequea longitud antes para no lanzar). Firma inválida → `401 INVALID_SIGNATURE` (`functions/index.js:150-158`).
- **CORS restringido**: se eliminó `Access-Control-Allow-Origin: *`. Solo se emite el header si `ERP_ALLOWED_ORIGIN` está configurado, más `Vary: Origin` (`:130-132`). El preflight ahora anuncia `X-Webhook-Signature` (no el viejo `X-Webhook-Secret`).
- **Password aleatoria, nunca el DNI**: se borró `buildPassword(dni)`. La cuenta se crea con `auth.createUser({ email, password: randomPassword(), displayName })` (`:191-195`). `randomPassword()` (`economyLogic.js:49-52`) genera 24 bytes aleatorios + sufijo `Aa1!`. Tras crear, se genera un **enlace de restablecimiento** con `auth.generatePasswordResetLink(email)` que se devuelve en la respuesta (`passwordSetupLink`) para que el cliente defina su propia contraseña. El DNI ya **no es obligatorio** (se guarda como dato, no como credencial).
- **Mismo fix en el cliente**: `src/services/accountFromOrder.js` (`ensureAccountFromOrderData`) usa `randomClientPassword()` (`window.crypto.getRandomValues` + `Aa1!`, `:92-98`) y `sendPasswordResetEmail(auth, email)` tras crear la cuenta (`:167-172`). Se eliminó la dependencia del DNI como password.

**Por qué PARCIAL.** La validación HMAC está en **modo transición**: si `ERP_WEBHOOK_SECRET` NO está configurado, la función registra un `console.warn` y **permite** la petición (`:159-164`), para no romper la integración con el ERP antes de coordinar la firma. El cierre total de H-03 requiere configurar el secret y que el ERP firme el payload. El código de verificación ya está listo y probado.

**Verificación.**
- `verifyWebhookSignature` cubierto por tests (firma válida/ inválida/ vacía/ null/ longitud distinta/ body distinto/ secret distinto). Ver §6.
- Con secret configurado: POST sin/ con firma inválida → `401`; con firma válida y email nuevo → crea cuenta con password aleatoria + `passwordSetupLink`.
- Login con el DNI como contraseña → falla (la password es aleatoria desconocida).

---

### H-04 — `sendManualPromoNotification` sin chequeo de admin — **CERRADO**

**Qué era.** Solo exigía autenticación; el chequeo de admin era un comentario. Cualquier usuario registrado podía disparar push + notificaciones in-app a toda la base.

**Fix realmente aplicado** (`functions/notificationsEngine.js:181-194`). Tras `context.auth`, se exige que el llamante sea admin: `context.auth.token?.admin === true` o, como puente de bootstrap, que exista `adminUsers/{uid}` con `role === 'admin'`. Si no, `permission-denied`.

**Verificación.** Usuario normal autenticado → `permission-denied`. Admin con claim → envía y retorna `{ success: true, count }`.

---

### H-05 — `referrals.js` → colección inexistente `portal_users` + acreditación desde cliente — **CERRADO**

**Qué era.** `referrals.js` escribía/consultaba la colección inexistente `portal_users` (la real es `portal_clientes_users`), por lo que el check de unicidad de `referralCode` nunca detectaba colisiones, y acreditaba monedas confiando en `earnedCoins`/`currentMonedas` del cliente.

**Fix realmente aplicado.**
- **Nombre de colección corregido**: en `src/services/referrals.js` ahora se usa `portal_clientes_users` (consulta de unicidad en `:196`, escritura en `:202`).
- **Acreditación movida a backend**: `claimReferralCoins(referralId)` (`:176-181`) ya no escribe saldo; invoca la callable `claimReferralSecure({ referralId })`.
- **`claimReferralSecure`** (`functions/index.js:1012-1092`): no confía en `status`/`earnedCoins` del doc de `referrals` (que es escribible por el cliente). Valida contra el ERP que el `orderId` del referido **exista y esté finalizado** (fail-closed si no hay ERP). Recompensa fija server-side `REFERRAL_REWARD = 10`. Bloquea **auto-referido** (el pedido no puede ser del propio referrer, por `userId` o DNI). **Dedup GLOBAL por pedido** con un lock `referralOrderClaims/{orderId}`: cada compra otorga UN solo premio de referido (al primero que reclame), no uno por usuario. Marca `status: 'claimed'` y hace `arrayUnion(orderId)` en `referralOrdersClaimed`.

**Verificación.** Crear dos referidos apuntando al mismo `orderId` → el segundo recibe `already-exists` (lock global). Reclamar el propio pedido → `permission-denied` (auto-referido). Acreditar desde el cliente directo a Firestore → bloqueado por reglas (campo `monedas` en `camposSaldo()`).

---

### H-06 — Economía escrita desde el cliente — **CERRADO**

**Qué era.** Todo `monedas`/`kapiCoins`/`monedasActivas`/`monedasEnEspera` se calculaba en el navegador y se persistía con `setDocument` directo. Saldos falsificables; además incoherencia con reglas que bloqueaban solo parte de los campos.

**Fix realmente aplicado: economía server-authoritative.** Se añadieron **9 Cloud Functions callable**, todas transaccionales (`db.runTransaction`) e idempotentes, en `functions/index.js`:

| Función | Qué hace | Idempotencia / anti-abuso |
|---------|----------|----------------------------|
| `feedKapiSecure` (`:738`) | +1 (o +2 con multiplicador `kapi_double_3d` vigente) a `kapiCoins`, sube `kapiHappiness`, actualiza racha semanal | 1 vez/día (`lastKapiClaimDate === today` → `already-exists`); tope mensual `KAPI_MONTHLY_CAP=31` |
| `claimBallSortRewardSecure` (`:781`) | +`BALLSORT_REWARD` (=2) a `monedas` | 1 vez/día (`lastBallSortReward`) |
| `spinRuletaSecure` (`:807`) | Gira la ruleta con **RNG server-side** (`pickWeightedPrize` sobre `ruletaPrizes`) y acredita si el premio es `Monedas` | Requiere 7 días de racha; 1 vez/semana (`lastRuletaSpinWeek`) |
| `recordChallengeEventSecure` (`:847`) | Avanza el progreso del reto semanal; al completar, acredita `rewardCoins` o el multiplicador | `count` forzado a 1 por llamada; no re-completa |
| `spendCoinsSecure` (`:898`) | Gasta monedas (canje) con débito FIFO `applyDebit` | Verifica saldo suficiente |
| `freezeCoinsSecure` (`:924`) | Congela monedas para un pedido (descuento en checkout); registra `historialMonedasEspera` | Verifica saldo; débito FIFO |
| `grantSurveyRewardSecure` (`:960`) | Bono de encuesta, `clamp` a `SURVEY_REWARD_MAX` (=15) | `surveyRewardClaimed` → ya reclamado |
| `claimDatesStreakSecure` (`:985`) | Bono `STREAK_DATES_BONUS` (=25) si ≥3 fechas únicas | `streakBonusReceived` → ya reclamado |
| `claimReferralSecure` (`:1012`) | Premio de referido (ver H-05) | Lock global `referralOrderClaims` |

- **El cliente solo invoca estas callables.** `AuthContext.jsx` se reescribió: `callFn(name, payload)` envuelve `httpsCallable`; `claimMonedas`, `spendMonedas`, `freezeMonedas`, `feedKapi`, `processChallengeEvent`, `grantSurveyReward`, `validateDatesStreak` llaman a las Functions y luego `reloadProfile()` relee el doc. Ya **no hay** `earnMainCoins`/`spendMonedas` que escriban saldo localmente.
- **Reglas que bloquean los campos de saldo** (`firestore.rules:31-42`): `camposSaldo()` enumera `monedas, monedasReclamadas, monedasEnEspera, historialMonedasEspera, role, monedasActivas, kapiCoins, kapiHappiness, lastKapiClaimDate, weeklyClaimsData, activeMultiplier, multiplierExpiresAt, weeklyChallengeProgress, lastBallSortReward, lastRuletaSpinWeek, streakBonusReceived, surveyRewardClaimed, referralOrdersClaimed`. La regla `update` para el propio usuario exige `noTocaCamposSensibles()` (vía `diff().affectedKeys().hasAny(...)`). Las Functions usan Admin SDK y evaden la regla.
- Clientes de juego (`ballSort.js`, `ruleta.js`) y `SubscriptionSurveyPage.jsx` se adaptaron a las callables (commit `9e84990`).

**Verificación.** Desde la consola del navegador, `setDoc(doc(db,'portal_clientes_users',miUid),{ monedas: 999999 })` → rechazado por reglas. Idem `kapiCoins`/`monedasActivas`. Las features de puntos siguen funcionando vía Functions.

> **Dependencia de despliegue crítica:** las reglas que bloquean `camposSaldo()` deben publicarse **después** de desplegar las 9 Functions; si se publican antes, los juegos/recompensas se romperían para usuarios legítimos (el cliente ya no puede escribir y aún no existe la Function). Ver §7.

---

### H-07 — Reglas con colecciones fantasma + campos sensibles incompletos — **CERRADO**

**Qué era.** Las reglas protegían `products`/`categories` (colecciones que nadie usa); las reales son `productos_wala` y `tienda_categories`. Además la lista de campos sensibles era incompleta.

**Fix realmente aplicado** (`firebase/firestore.rules`).
- Se añadieron matches a las **colecciones reales**: `productos_wala`, `tienda_categories`, y todo el catálogo/taxonomías (`tienda_collections`, `tienda_brands`, `tienda_mockups`, `tienda_themes`, `vendors`, `niches`, `storefront`, `configuracion`, etc.) con `read: if true; write: if isAdmin()` (`:55-81`). Los matches legacy `products`/`categories` quedan como **compat** explícito (`:84-85`).
- Se auditaron y añadieron reglas a las colecciones que faltaban: gamificación (`globals`, `weeklyChallenges`, `ruletaPrizes`, `wordle_daily_words`, `wordle`, `challengeEvidences`), `referrals`, `wishlists`, `product_reviews`, `adminRoles`, `notification_settings`, `analytics_kapi`, `referralOrderClaims`, ingestión pública (`heatmap_events`, `libro_reclamaciones`), y las subcolecciones `users/{uid}/notifications` y `portal_clientes_users/{uid}/notifications`. Lo no listado queda en **deny-by-default**.
- La lista de campos bloqueados se amplió (ver `camposSaldo()` en H-06).

**Verificación.** Admin escribe en `productos_wala` → permitido; usuario normal → denegado. Usuario intenta escribir `monedasActivas`/`kapiCoins` → denegado. Probar en el Rules Playground antes de confiar en producción.

---

### H-08 — `enlaces_pago` con `update`/`delete: if true` — **CERRADO (reglas); webhook PayPal POR HACER**

**Qué era.** `update, delete: if true` permitía a cualquiera marcar un enlace de pago como pagado o borrarlo (fraude/DoS).

**Fix realmente aplicado** (`firestore.rules:200-204`): `enlaces_pago` ahora tiene `read: if true` (ID no adivinable), `create: if isAdmin()` y **`update, delete: if isAdmin()`** (antes `if true`).

**POR HACER (Fase 3).** El estado `pagado` no debe poder fijarlo nadie por reglas; debe cambiarlo una Cloud Function que **verifique el webhook/IPN de PayPal**. Eso queda fuera de Fase 0.

**Verificación.** Cliente no admin intenta `update`/`delete` un `enlaces_pago` → `permission-denied`.

---

### H-09 — `isAdmin()` por documento Firestore en vez de claims — **PARCIAL**

**Qué era.** `isAdmin()` en reglas dependía de `adminUsers/{uid}.role == 'admin'`, inconsistente con el modelo por email/`localStorage` del cliente, y cara (1-2 lecturas por evaluación).

**Fix realmente aplicado.** `isAdmin()` en `firestore.rules:17-23` y `storage.rules:10-16` ahora prioriza el **custom claim**: `request.auth.token.admin == true`, con un **OR** al doc `adminUsers/{uid}` como **puente de bootstrap**. El cliente (`AuthContext`) y las Functions (`callerIsAdmin`, `setAdminClaim`, `sendManualPromoNotification`) usan la misma lógica claim-first.

**Por qué PARCIAL.** El puente `adminUsers` sigue presente a propósito (para no quedar bloqueados durante el bootstrap, ya que aún no se desplegó ni se corrió `set-admin-claims.js`). El cierre total = eliminar el OR a `adminUsers` una vez todos los admins tengan el claim. Documentado como deuda menor.

**Verificación.** Usuario con claim `admin` escribe en colecciones admin → OK; sin claim ni doc `adminUsers` → denegado.

---

### H-10 — FCM `sendToDevice()` deprecado — **CERRADO**

**Qué era.** `messaging.sendToDevice(tokens, payload)` (API legacy en retiro) en el motor de notificaciones y en la promo manual.

**Fix realmente aplicado** (`functions/notificationsEngine.js`). Ambos usos migraron a **`messaging.sendEachForMulticast({ tokens, notification, data })`** (`:59` y `:232`). Se añadió **`removeInvalidTokens(userRef, tokens, response)`** (`:15-30`) que recorre `response.responses`, detecta códigos de token inválido (`registration-token-not-registered`, `invalid-registration-token`, `invalid-argument`) y los limpia de `fcmTokens` con `arrayRemove`. Se decide éxito por `response.successCount`.

**Verificación.** Enviar a un token válido y otro inválido → entrega al válido y limpieza del inválido de `fcmTokens`.

---

### H-11 — `processCulqiPayment`: dummy key + monto del cliente — **PARCIAL**

**Qué era.** Fallback `"sk_test_dummy_key"`, lectura de `REACT_APP_CULQI_SECRET_KEY` (prefijo que se expone en el bundle), y `amount` fijado por el cliente sin validación.

**Fix realmente aplicado** (`functions/index.js:624-684`).
- **Sin fallback dummy y sin `REACT_APP_`**: `const secretKey = process.env.CULQI_SECRET_KEY;` y si falta → `failed-precondition` (la función aborta, no cobra) (`:644-648`).
- **Validación básica del monto** server-side: `Number.isInteger(amount) && amount > 0` (`:638-640`).

**Por qué PARCIAL / RESIDUAL.** Aún se confía en el `amount` que envía el cliente (en céntimos); el **recálculo del monto contra el pedido/carrito real** queda como RESIDUAL para Fase 3 (marcado con `TODO (H-11 / Fase 3)` en el código, `:636-637`). Sin pagos en producción todavía, el riesgo está contenido.

**Verificación.** Sin `CULQI_SECRET_KEY` → la función aborta. Monto no entero o ≤0 → `invalid-argument`.

---

## 5. Revisión adversarial (12 hallazgos) y su resolución

Tras aplicar los fixes de H-01..H-11, un segundo pase con agentes buscó bypass. Los hallazgos y su resolución (commit `f0e4aa0`, salvo indicación):

| # | Sev. | Hallazgo adversarial | Resolución |
|---|------|----------------------|------------|
| A1 | CRÍTICO | `claimReferralSecure` confiaba en `earnedCoins`/`status` del doc `referrals` (escribible por el cliente) | Ya no se confía en esos campos; se valida la compra contra el ERP (**fail-closed**), recompensa fija `REFERRAL_REWARD=10` server-side |
| A2 | CRÍTICO | Un mismo pedido podía cosechar premio de referido por varios usuarios | **Dedup GLOBAL por pedido**: lock `referralOrderClaims/{orderId}`; un solo premio por compra |
| A3 | ALTO | Auto-referido: referirse a uno mismo | Bloqueo si el pedido es del propio referrer (por `userId` o DNI) → `permission-denied` |
| A4 | ALTO | **DNI mutable**: cambiar el DNI para reclamar pedidos ajenos | `dniInmutable()` en reglas (`firestore.rules:50-52`): el DNI solo se fija si está vacío; una vez puesto es inmutable para el usuario |
| A5 | ALTO | **Bypass en create**: `setDoc(merge:true)` dispara `create` y permitía meter saldo al crear el perfil | `sinSaldoEnCreate()` (`firestore.rules:45-47`): el `create` de `users`/`portal_clientes_users` no puede incluir ningún campo de `camposSaldo()` |
| A6 | ALTO | `recordChallengeEventSecure` confiaba en `count` del cliente (inflar progreso de reto) | `count` **forzado a 1** por llamada (mitigación); verificación real vía triggers server-side = Fase 2 |
| A7 | MEDIO | Doble reclamo de pedido por `'123'` vs `123` (tipos) | `pedidoId` normalizado a `String` una sola vez en `secureClaimMonedas` (`:248`) |
| A8 | MEDIO | `SURVEY_REWARD_MAX` demasiado alto (50) permitía sobre-recompensa | Bajado a **15** (3 eventos × 5); `grantSurveyRewardSecure` hace `clamp` |
| A9 | MEDIO | `referralOrdersClaimed` no estaba en la lista de campos bloqueados | Añadido a `camposSaldo()` |
| A10 | LOW | `handleResetCoinsForTesting` en `Header.jsx` reseteaba monedas para `yorh001@gmail.com` (email hardcodeado + escritura de saldo) | Eliminado |
| A11 | LOW | `RestrictedRoute` muerta en `App.jsx` | Eliminada |
| A12 | INFO | Falta de cobertura de tests de la lógica sensible | Extracción a `economyLogic.js` + suite `economyLogic.test.js` (44/44) |

**Residuales aceptados** (documentados, fuera de Fase 0):
- `orders` `create` público (`firestore.rules:144`: `isAuthenticated() || request.resource.data.dni != null`) — necesario para checkout sin sesión; se endurecerá en Fase 1/2.
- `product_reviews` `update: if isAuthenticated()` sin restringir a `helpfulVotes` por `diff()` — Fase 2 (TODO en reglas).
- Posible **desync** entre `monedas` (global) y `monedasActivas` (lotes con TTL): el débito FIFO de `applyDebit` es best-effort; reconciliación en Fase 2.
- **Verificación real de retos**: `recordChallengeEventSecure` solo limita abuso (count=1); la prueba de que la acción ocurrió (onWrite de wishlist/compra/reseña) es Fase 2.
- H-03 HMAC en modo transición y H-11 recálculo de monto (ya descritos).

---

## 6. Tests

**Archivo:** `functions/test/economyLogic.test.js`. **Resultado:** `PASS 44/44` (ejecutado y confirmado: `node functions/test/economyLogic.test.js`).

- Sin dependencias externas: usa solo `assert` y `crypto` de Node (sin jest/mocha/firebase-admin), porque la lógica testeada se extrajo a `functions/economyLogic.js` (puro).
- Cobertura por unidad:
  - **Constantes** de economía (`KAPI_MONTHLY_CAP=31`, `BALLSORT_REWARD=2`, `STREAK_DATES_BONUS=25`, `SURVEY_REWARD_MAX=15`, `REWARD_COINS_PER_ORDER=10`).
  - **Fechas Lima** (`limaNow`, `limaTodayStr`, `limaWeekStartStr`): determinismo, cruce de medianoche Lima (UTC-5), inicio de semana en lunes, recorrido de 14 días.
  - **`applyDebit`** (débito FIFO): exacto, mayor al saldo (no baja de 0), sin campos, multi-lote parcial, agotamiento total, **no muta el input** (clona lotes).
  - **`randomPassword`**: longitud ≥6 en 50 llamadas, sufijo `Aa1!`, variedad de caracteres, dos llamadas distintas.
  - **`pickWeightedPrize`** (RNG ponderado de la ruleta): lista vacía/no-array → null, límites de probabilidad, fallback al último, determinismo.
  - **`verifyWebhookSignature`** (HMAC del webhook, H-03): firma válida/ inválida (mismo largo)/ vacía/ null/ longitud distinta/ body distinto/ secret distinto/ secret vacío.
- Nota: la lógica de las Cloud Functions con I/O (transacciones Firestore, ERP) **no** está cubierta por unit tests (requeriría emulador de Firebase); se verificó vía revisión adversarial y se probará con el emulador al desplegar.

Ejecución sugerida (PowerShell):
```powershell
node functions/test/economyLogic.test.js
# Esperado: PASS 44/44
```

---

## 7. Despliegue de esta fase (PENDIENTE — falta acceso a Firebase)

> **Estado:** nada desplegado. El usuario aún no tiene acceso a la consola de Firebase. Lo de abajo es el runbook a ejecutar cuando lo tenga. Prerrequisito: `npm install -g firebase-tools`, `firebase login`, `firebase use pruebas-cd728`.

### 7.1. Secrets necesarios

| Secret | Para qué | Hallazgo | Si falta |
|--------|----------|----------|----------|
| `ERP_SERVICE_ACCOUNT` | JSON de cuenta de servicio del ERP; habilita `getErpDb()` para validar pedidos/referidos | H-02, H-05 | `secureClaimMonedas`/`claimReferralSecure` **rechazan** (fail-closed) |
| `ERP_WEBHOOK_SECRET` | Secreto compartido para validar el HMAC del webhook `ensureAccountFromOrder` | H-03 | Webhook en modo transición: **warn, no exige firma** |
| `CULQI_SECRET_KEY` | Llave privada de Culqi (sin prefijo `REACT_APP_`) | H-11 | `processCulqiPayment` **aborta** (no cobra) |

Opcional: `ERP_ALLOWED_ORIGIN` (origen permitido por CORS en el webhook).

```powershell
firebase functions:secrets:set ERP_SERVICE_ACCOUNT
firebase functions:secrets:set ERP_WEBHOOK_SECRET
firebase functions:secrets:set CULQI_SECRET_KEY
```

### 7.2. Orden de despliegue (respeta dependencias)

El orden importa por la dependencia descrita en H-06 (las reglas bloquean los campos de saldo; las Functions deben existir antes para no romper juegos/recompensas) y por H-01/H-09 (los claims habilitan el resto de gates).

1. **Secrets** → `firebase functions:secrets:set ...` (los 3 de arriba).
2. **Functions** → `npm run deploy:functions` (= `firebase deploy --only functions`). Debe ir **antes** que las reglas de saldo.
3. **Reglas** → `npm run deploy:firestore-rules` y `npm run deploy:storage-rules`. Validar antes en el **Rules Playground**.
4. **Web** → `npm run build` (Vite) + despliegue a Vercel/Hosting.
5. **Bootstrap de admins** → `scripts/set-admin-claims.js` con la cuenta de servicio del Portal:
   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\serviceAccount-pruebas-cd728.json"
   node scripts/set-admin-claims.js yorh001@gmail.com heyeru24@gmail.com
   ```
   Los admins deben **cerrar sesión y volver a entrar** para refrescar el token (y que el claim surta efecto en cliente y reglas).

> Configuración relevante en `firebase.json`: `firestore.rules → firebase/firestore.rules`, `storage.rules → firebase/storage.rules`, `functions.source → functions`.

### 7.3. Verificación end-to-end post-despliegue (smoke tests)

- [ ] Bundle ya no contiene `LaClaveDeWala2020` ni `adminWalaPro` (H-01).
- [ ] No se puede acuñar moneda desde el cliente ni con pedido falso (H-02, H-06).
- [ ] Webhook sin firma → `401`; con firma válida → cuenta con password aleatoria + `passwordSetupLink` (H-03), una vez configurado `ERP_WEBHOOK_SECRET`.
- [ ] Usuario normal no puede enviar notificaciones masivas (H-04).
- [ ] Referido del mismo pedido reclamado dos veces → `already-exists`; auto-referido → `permission-denied` (H-05).
- [ ] `enlaces_pago` `update`/`delete` por no-admin → `permission-denied` (H-08).
- [ ] Push a token inválido lo limpia de `fcmTokens` (H-10).
- [ ] Sin `CULQI_SECRET_KEY` → `processCulqiPayment` aborta (H-11).

---

## 8. Cierre de la fase — checklist HECHO / PENDIENTE

**HECHO (en local / en código).**
- [x] Backdoor admin eliminado; `isAdmin` desde custom claims; `setAdminClaim` + `set-admin-claims.js` (H-01).
- [x] `secureClaimMonedas` valida pedido contra ERP, fail-closed, monto server-side, idempotente (H-02).
- [x] Webhook con HMAC (modo transición), CORS restringido, password aleatoria + reset link, en webhook y cliente (H-03).
- [x] `sendManualPromoNotification` exige admin (H-04).
- [x] Referidos corregidos: colección, callable, dedup global, anti auto-referido (H-05).
- [x] 9 Cloud Functions de economía server-authoritative; reglas con `camposSaldo()` bloqueados; `AuthContext` reescrito (H-06).
- [x] Reglas a colecciones reales + auditoría de colecciones (H-07).
- [x] `enlaces_pago` `update/delete: if isAdmin()` (H-08).
- [x] `isAdmin()` claim-first en reglas Firestore/Storage (H-09, con puente).
- [x] FCM `sendEachForMulticast` + limpieza de tokens (H-10).
- [x] Culqi sin dummy ni `REACT_APP_`, validación básica de monto (H-11).
- [x] 12 fixes de revisión adversarial.
- [x] Suite de economía 44/44; `vite build` y dev server OK.

**PENDIENTE (requiere acceso a Firebase).**
- [ ] Setear los 3 secrets (`ERP_SERVICE_ACCOUNT`, `ERP_WEBHOOK_SECRET`, `CULQI_SECRET_KEY`).
- [ ] Desplegar Functions → reglas → web → correr `set-admin-claims.js`.
- [ ] Coordinar con el ERP la firma HMAC del webhook (cierra H-03 al 100%).
- [ ] Smoke tests end-to-end (§7.3).

**RESIDUALES (Fase 1/2/3).**
- [ ] H-03: pasar HMAC de transición a obligatorio.
- [ ] H-08: webhook PayPal verificado para marcar `pagado` (Fase 3).
- [ ] H-09: eliminar el puente `adminUsers` cuando todos tengan claim.
- [ ] H-11: recalcular el monto de Culqi contra el pedido real (Fase 3).
- [ ] Verificación real de retos (triggers server-side) y reconciliación `monedas`/`monedasActivas` (Fase 2).
- [ ] Endurecer `orders` create y `product_reviews` update (Fase 1/2).
