# Changelog — Wala

Registro de actualizaciones y funciones. Todo lo de abajo está en la rama
`fase-0-seguridad` y **verificado en local** (build + emulador); aún **no desplegado**
(pendiente acceso a Firebase). Detalle por fase en [`docs/wala/fases/`](docs/wala/fases/README.md).

Convención: ✅ hecho · 🔧 parcial · ⬜ por hacer.

---

## [Sin liberar] — Fase 2: Fidelización (core) ✅ (verificado en emulador)
Economía unificada (monedas = puntos; xp = experiencia) con **ledger de puntos**, **misiones
diarias** y **racha diaria**. Verificado E2E en el emulador (login cliente → callables →
monedas/xp/racha/ledger actualizados; idempotencia OK). UI en `/cuenta/misiones`.
- **Cloud Functions** (`functions/index.js`): `dailyCheckInSecure` (racha + bonos por hito D3/D7/D30 + xp),
  `getDailyMissionsSecure` (asigna/lee misiones del día), `completeMissionSecure` (otorga puntos+xp, idempotente).
  Helper `writeLedger()` y entradas de `loyaltyLedger` en TODAS las funciones de economía.
  Fix: uso de `FieldValue` modular (`firebase-admin/firestore`) — `admin.firestore.FieldValue` daba
  undefined en el emulador.
- **Reglas** (`firestore.rules`): colecciones `missions` (lectura pública/escritura admin),
  `userMissions` y `loyaltyLedger` (lectura dueño/escritura servidor); campos `xp`/`dailyStreak`/`lastCheckInDate` bloqueados al cliente.
- **Cliente**: `src/services/loyalty.js` (wrappers + `getLedger`), `src/pages/cuenta/MisionesPage.jsx`
  (racha + misiones del día + puntos), tab "Misiones" en `CuentaLayout`, ruta `/cuenta/misiones`.
- **Seed**: 3 misiones diarias + xp/racha en el cliente demo.
- ⬜ Pendiente Fase 2: niveles/tiers (UI), catálogo de recompensas dinámico (mover de hardcode a Firestore + admin), push v2 (deep links/topics), verificación de retos por triggers server-side.

## [Sin liberar] — Entorno local con Emulador de Firebase ✅
Permite ver y probar **todo** en local (catálogo, login, economía, guardado) sin tocar
producción. Ver [docs/wala/EMULADOR-LOCAL.md](docs/wala/EMULADOR-LOCAL.md).
- `firebase.json`: bloque `emulators` (auth 9099, firestore 8080, functions 5001, storage 9199, UI 4000).
- `src/services/firebase/config.js` y `src/services/erp/firebase.js`: en dev se conectan a los
  emuladores (proyecto demo `demo-wala`); en build usan el Firebase real. Flag `VITE_USE_EMULATORS`.
- `functions/index.js` `getErpDb()`: en el emulador usa el Firestore por defecto (sin exigir credenciales del ERP).
- `scripts/emulators.js`: lanza el emulador usando el JDK 21 portable automáticamente. → `npm run emulators`.
- `scripts/seed-emulator.js`: siembra datos de ejemplo (productos, nichos, vendedores, ruleta,
  reto, usuarios admin/cliente, pedido finalizado). → `npm run seed`.
- Usuarios demo: `admin@wala.test` / `cliente@wala.test` (pass `wala1234`).

## [Sin liberar] — Fase 1: Plataforma y base marketplace 🔧
- **CRA → Vite** (`vite.config.js`): dev en :3000, build ~18s (antes ~60-90s). Mantiene las env
  `REACT_APP_*` vía `define` (sin renombrar `.env`). Fix de `require()` CommonJS que rompía en runtime.
- **Base multi-vendor/nicho** (aditivo): `src/constants/marketplace.js` (defaults `casa` /
  `regala-con-amor`, `FULFILLMENT_TYPES`); `products.js` añade `vendorId`/`nicheId`/`fulfillmentType`;
  servicios `niches.js` y `vendors.js` (entidad); `scripts/backfill-vendor-niche.js`.
- **Búsqueda** `src/services/search.js` → `searchCatalog()` con facetas + paginación (seam para Algolia/Typesense).
- **Páginas:** `/buscar` (SearchPage), `/nicho/:slug` (NichePage), `/nichos` (NichesPage),
  `/vendedor` (VendorPanel), `/tienda-vendedor/:slug` (VendorStorefrontPage). Búsqueda accesible desde el header.
- **Admin:** `/admin/nichos` (AdminNichos) y `/admin/vendedores` (AdminVendors) CRUD; tagging de
  nicho/vendedor/tipo en `AdminProductoFormV2`.
- ⬜ Pendiente: conectar el grid de la home a `searchCatalog`; smoke test en navegador.

## [Sin liberar] — Fase 0: Estabilización y seguridad ✅ (11 hallazgos)
- **H-01/H-09** Backdoor admin eliminado; rol admin por **custom claims** (`setAdminClaim` +
  `scripts/set-admin-claims.js`); reglas `isAdmin()` por claim. 
- **H-02** `secureClaimMonedas`: valida el pedido contra el ERP (fail-closed) + monto server-side.
- **H-03** `ensureAccountFromOrder` (webhook) y `accountFromOrder.js` (cliente): contraseña
  aleatoria + correo de restablecimiento (ya no `password = DNI`); HMAC del webhook.
- **H-04** `sendManualPromoNotification`: exige admin.
- **H-05** Referidos: fix de colección; `claimReferralSecure` valida compra vía ERP + dedup global.
- **H-06** Economía **server-authoritative**: 9 Cloud Functions callable idempotentes —
  `feedKapiSecure`, `claimBallSortRewardSecure`, `spinRuletaSecure` (RNG server), `recordChallengeEventSecure`,
  `spendCoinsSecure`, `freezeCoinsSecure`, `grantSurveyRewardSecure`, `claimDatesStreakSecure`,
  `claimReferralSecure`. Campos de saldo bloqueados en reglas. Lógica pura en `functions/economyLogic.js`.
- **H-07/H-08** Reglas Firestore reescritas (colecciones reales; `enlaces_pago` solo admin).
- **H-10** FCM `sendEachForMulticast` + limpieza de tokens.
- **H-11** Culqi: exige secret real (sin dummy ni `REACT_APP_`) + valida monto.
- **Tests:** `functions/test/economyLogic.test.js` (44/44). Revisión adversarial con agentes aplicada.
- 🔧 Residuales documentados: `orders`/`product_reviews` (reglas), desync `monedas`/`monedasActivas` (TTL),
  verificación real de retos server-side, envío del correo H-03.

## Por hacer ⬜
Fases 2–5 (fidelización con ledger, marketplace multi-vendor con split de pago, POD con arte de
producción, impulso/FOMO + inteligencia) e infra (staging, CI/CD, App Check). Detalle en
[`docs/wala/fases/`](docs/wala/fases/README.md).
