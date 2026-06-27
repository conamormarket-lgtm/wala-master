# Changelog — Wala

Registro de actualizaciones y funciones, de lo más nuevo a lo más viejo. Las entradas más
recientes (**2026-06-25** y **2026-06-27**) ya están **desplegadas a producción**
(`sistema-gestion-3b225`): frontend por **Vercel** (auto-deploy desde `master`) y backend
(Cloud Functions / índices) por **Cloud Shell**. Las entradas más antiguas marcadas
`[Sin liberar]` se construyeron en la rama `fase-0-seguridad` (hoy `master`) y se
**verificaron en local** (build + emulador) antes de desplegarse en esas tandas. Detalle de
estado en [docs/wala/ESTADO-DEL-PROYECTO.md](docs/wala/ESTADO-DEL-PROYECTO.md); detalle por
fase en [`docs/wala/fases/`](docs/wala/fases/README.md).

Convención: ✅ hecho · 🔧 parcial · ⬜ por hacer.

---

## [2026-06-27] — DESPLEGADO A PRODUCCIÓN (Vercel + Cloud Functions vía Cloud Shell)
Sesión de UX/diseño, tracking, checkout internacional y fixes. **Frontend desplegado por Vercel** (auto-deploy desde `master`); las **Cloud Functions del punto 5 se desplegaron por Cloud Shell** a `sistema-gestion-3b225`. Detalle de estado en [docs/wala/ESTADO-DEL-PROYECTO.md](docs/wala/ESTADO-DEL-PROYECTO.md).
- ✅ `a4c884e` — **Design system liquid-glass "Aurora Violeta Serena"**: nuevo `src/theme/` (`tokens.css` glass/gradiente/violeta/chart + `motion.js` con presets) y librería `src/components/ui/` (11 componentes: GlassCard, GlassButton, GlassPanel, GlassModal, GlassInput, Badge, AuroraBackground, AnimatedNumber, Reveal/Stagger, GlassTooltip) + vitrina viva en **/admin/design**. Overhaul del Dashboard/Analítica/Zonas calientes: hub con KPIs animados + tendencia + conversión, **DashProductos** (vistos vs vendidos ERP), **DashCategorias** (líneas vendidas + vistas + conversión), nueva **DashUso** (**/admin/dashboard/uso**), heatmap con mini-tarjetas + nº de clics + preview + etiquetas con emoji.
- ✅ `95c99d1` — **Tracking de precisión (Pass 2)**: `schema.js` +8 tipos de evento (`category_view`, `collection_view`, `editor_open`/`editor_save`, `minigame_start`/`minigame_complete`, `mission_complete`, `wishlist_add`); `tracker.js` +7 funciones; `eventData` enriquecido (`categoryId`/`collectionId`/`lineaProducto`) en `product_view`/`add_to_cart`/`purchase_complete`; agregaciones nuevas en `adminAnalytics` (`topCategoriesByViews`, `topCollectionsByViews`, `featureUsage`); eventos cableados en NichePage/EditorPage/Ruleta/BallSort/MisionesPage.
- ✅ `b7508c1` — **Storefront con el design system**: PremiumProductCard (glass + hover + entrada al viewport + badge de descuento), esqueletos glass, HeroBanner/BrandMarquee/BestSellersRow (AuroraBackground + GlassButton + Reveal/Stagger), transición de página solo-opacidad, Header/BottomNav glass; Checkout/Cart/Perfil/CuentaPedidos en modo conservador (sin tocar la lógica de compra).
- ✅ `8fa1888` — **Fix del checkout**: el botón de pago no avanzaba porque Formik bloqueaba en silencio (validación de DNI de 8 dígitos para Perú). Se relajó la validación del documento (≥3 caracteres, cualquier tipo) + aviso (toast) y scroll al primer campo con error.
- ✅ `8bb7293` — **Auto-cobro por país + moneda local/USD**: `src/constants/currencies.js` (país→moneda con nombre natural), `src/services/fx.js` (lee `config/fx` con fallback + margen); CheckoutPage muestra la moneda local + "Pagarás X USD por PayPal" y auto-abre Culqi (Perú); PaypalCheckout cobra en `amountUsd` + corrige el update a `pedidos_web`. **Cloud Functions escritas y desplegadas por Cloud Shell**: `culqiWebhook` (marca `pedidos_web` pagado, idempotente), recálculo de monto server-side en `processCulqiPayment` (cierra H-11), `updateFxRate` (cron diario que puebla `config/fx` desde una API de FX).
- ✅ `c540614` — **Fix de moneda local**: `penToLocal` indexaba por país pero `config/fx` guarda por código de moneda; + guard de monto mínimo de PayPal (1 USD).
- ✅ `33285b4` — **Fix del parpadeo del menú del header**: cacheo de `storeConfig` en `localStorage` + no mostrar el menú por defecto mientras carga; + guarda del permiso de notificaciones (solo lo pide si `Notification.permission === 'default'`).
- ✅ `cf47546` — **Wishlist en el header**: badge con la cantidad de productos en el corazón + tira de miniaturas en el desplegable de favoritos.
- 🔧 **Seguridad**: se publicaron reglas y se **revirtieron** porque rompían el ERP (el ERP no usa Firebase Auth; sus peticiones llegan sin identidad). Track de seguridad **PENDIENTE**: App Check o migrar el ERP a Firebase Auth. Se sembró `config/fx` con tasas en vivo.
- ⬜ **Pendiente del usuario**: registrar la URL de `culqiWebhook` en el panel de Culqi (estaba caído) y verificar que `REACT_APP_PAYPAL_CLIENT_ID` esté en Vercel (si no, PayPal corre en SANDBOX).
- ✅ **"Mis fechas especiales" (registro de regalos por fecha, `/regalar/:referralCode`)**: implementado y funcionando — la página pública muestra las fechas especiales del dueño (de `giftRecipients[].events[]`) como selector de fecha de entrega + su wishlist; "Regalar este" arma el carrito en Modo Regalo con `deliveryDate`; el checkout preselecciona Modo Regalo y persiste `giftDetails.deliveryDate`; `markItemAsGifted` notifica al dueño. La privacidad la resuelve la Cloud Function `getPublicGiftRegistry` (datos mínimos, sin PII). Botones "📅 Mis fechas especiales" y "🛒 Agregar todo al carrito" añadidos a la wishlist. 🐛 **Fix**: los productos de la wishlist no cargaban en `/regalar` ("lista vacía") cuando el `userCode` no matcheaba la query; la CF ahora lee la wishlist por `doc.id = userId` como respaldo confiable — **pendiente que el usuario REDESPLIEGUE** `getPublicGiftRegistry` por Cloud Shell. Estado completo en [docs/wala/PLAN-FECHAS-ESPECIALES.md](docs/wala/PLAN-FECHAS-ESPECIALES.md).
- ✅ **Drag-and-drop de regalos TERMINADO y rediseñado** (`/regalar`, `src/pages/GiftRegistry/GiftRegistryPage.jsx`): pasó de "en progreso" a **hecho**. Cada producto es una tarjeta a medida (`GiftProductCard`) cuya **imagen es la zona de arrastre** y cuyo **nombre es un enlace** a la ficha. Soltar un producto sobre una fecha ya **no lo agrega al carrito**: lo **ASIGNA** a ese día (estado `assignments`), mostrando una **miniatura** bajo la fecha (con × para quitar); un botón **"Proceder a regalar (N)"** encima de la fecha agrega esos regalos al carrito (Modo Regalo + esa `deliveryDate`) y abre `/carrito`. Se conserva el botón fallback "Regalar este". 🐛 **Fix del drag nativo**: el arrastre lo gestiona un `motion.div` padre y la `<img>` lleva `draggable={false}` + CSS `-webkit-user-drag:none`, lo que eliminó la "imagen fantasma con URL" / cursor "denegado" del navegador.
- ✅ **Carrito — selección de items ("No comprar esta vez")**: patrón estándar Amazon/MercadoLibre/Falabella para elegir qué pagar ahora y qué guardar para después, sin borrar nada. `CartContext.jsx` (flag `selected` default `true`; `getTotalItems`/`getTotalPrice` excluyen `selected===false`; nuevos `toggleItemSelected` y `clearSelectedItems`); `CartItem.jsx` (botón "No comprar esta vez" / "✓ Comprar esta vez" + fila atenuada); `Cart.jsx` (aviso "N artículo(s) no se comprarán esta vez"); `CheckoutPage.jsx` (define `selectedItems` y lo usa para `prendasStr`, `productosMap`, `cantidad`, `esPersonalizado`, `imageURLs`, `markItemAsGifted`, mensaje de WhatsApp y analytics; el monto usa `getTotalPrice()` ya filtrado; tras pagar llama `clearSelectedItems()` en vez de `clearCart()` para que los no seleccionados PERSISTAN; bloquea el pago si no hay seleccionados). 🔎 **Verificación adversarial**: confirmó que solo se cobra/registra lo seleccionado y que los no comprados quedan en el carrito tras pagar. Detalle en [docs/wala/FUNCIONES-CLIENTE.md §6.1-bis](docs/wala/FUNCIONES-CLIENTE.md).

## [2026-06-25] — DESPLIEGUE A PRODUCCIÓN (sistema-gestion-3b225)
Ver detalle y pendientes en [docs/wala/DESPLIEGUE-ESTADO.md](docs/wala/DESPLIEGUE-ESTADO.md).
- ✅ **Cloud Functions** desplegadas al proyecto correcto `sistema-gestion-3b225` (no `pruebas-cd728`).
  Arregla el Kapi/juegos (feedKapiSecure y demás ya existen). Se conservaron las 6 funciones del ERP.
- ✅ **Índices** desplegados (Wordle). Se conservaron los del ERP/CRM (multi-tenant).
- 🛠️ Fix de incidente: `.firebaserc` default → `sistema-gestion-3b225`, `deploy:functions --project`,
  reglas completadas con `pedidos`/`pedidos_web`/`analytics_*` (sin romper ERP), iconos PWA en `public/icons/`,
  `via.placeholder.com` (caído) → `/images/placeholder.svg` local.
- ⬜ Pendiente: secretos de Functions (Culqi/ERP), **fusión** de reglas con las vivas del ERP/CRM,
  admin claims, re-promover frontend `35ba2a2`.

## [Sin liberar] — Fase 5: Impulso e inteligencia (base) ✅ (verificado E2E)
- **Cofre diario** `openDailyChestSecure` (callable): recompensa 5–20 monedas una vez por día (Lima),
  idempotente vía `lastChestDate`, escribe ledger `cofre_diario`. Página pública **/ofertas**.
- **Segmentación RFM** `computeSegmentsSecure` (solo admin): recencia/frecuencia/monto sobre `orders` pagadas →
  asigna `segment` (vip/activo/en_riesgo/nuevo) a cada usuario. Botón "Recalcular segmentos" en admin.
- **Ofertas flash** (`flashOffers`): admin **/admin/flash-offers** (CRUD) + vitrina en /ofertas. Regla pública/admin.
  Campos sensibles `segment`/`lastChestDate` bloqueados al cliente (solo servidor). Seed 2 ofertas.
- Verificado E2E: cofre 50→68 + idempotente; RFM {activo:1, nuevo:1}; cliente sin permiso de segmentar (PERMISSION_DENIED).
- ⬜ Pendiente Fase 5 (servicios externos / scheduler): push segmentado (FCM), campañas programadas
  (Cloud Scheduler), recomendación por IA, ofertas flash con countdown en home.

## [Sin liberar] — Fase 4: POD / arte de producción (base) ✅ (verificado en emulador)
- **Blueprints** (`blueprints`): prendas base imprimibles con `printAreas` (cm + dpi), `decorationMethods`,
  `basePrintCost`. Admin **/admin/blueprints** (CRUD) + `services/blueprints.js`. Regla pública/admin. Seed `bp-polo`.
- **Utilidad de arte** `src/utils/productionArt.js`: `pxFromCm(cm,dpi)`, `exportProductionArtPNG(canvas,{dpiMultiplier})`
  (export alta resolución del lienzo fabric), `validatePrintResolution(...)`. Verificado: 30cm@300dpi = 3543px.
- ⬜ Pendiente Fase 4 (requiere editor/navegador): integrar `productionArt` en EditorPage (generar arte al
  agregar al carrito, recorte por área del blueprint, PDF de producción), validar resolución de imágenes colocadas.

## [Sin liberar] — Fase 3: Split de pago (Mercado Pago Marketplace) ✅ (verificado E2E simulado)
Cobro con **comisión de marketplace** + creación de pedido y **payouts** por vendedor.
- **Functions**: `createCheckoutPreferenceSecure({items,shippingZoneId})` (recalcula carrito server-side,
  crea order `pending_payment` + subOrders; con `MERCADOPAGO_ACCESS_TOKEN` crea preferencia real de
  Mercado Pago con `marketplace_fee`=comisión total; sin token → init_point simulado para local),
  `confirmPaymentSecure({orderId})` (marca `paid` + genera `payouts` por vendedor, idempotente),
  `mercadoPagoWebhook` (HTTP, para producción).
- **Cliente**: `services/payments.js` + `/checkout-demo` y `/pago-demo/:orderId` (CheckoutDemoPage).
- **Reglas**: `orders` legible por `buyerUid`.
- Verificado E2E (simulado): order total 179.7 / comisión 14.38 → `paid` + 2 payouts (casa 49.9, estampados-lima 105.42).
- ⛔ Para cobro REAL: configurar `MERCADOPAGO_ACCESS_TOKEN` (+ `MP_WEBHOOK_URL`, `MP_BACK_URL_BASE`) — requiere cuenta Mercado Pago.

## [Sin liberar] — Fase 3: Marketplace multi-vendor (core local) ✅ (verificado E2E)
Pedido maestro + sub-órdenes por vendedor con comisión, envíos por zona y pagos a vendedores.
Verificado E2E: carrito p1(casa)+p3×2(estampados-lima) → order + 2 subOrders (casa com 0/payout 49.9;
estampados-lima com 12%=14.38/payout 105.42), shipping 10, total 179.7.
- **Cloud Function** `createOrderWithSubordersSecure({items, shippingZoneId})`: recalcula precios server-side,
  agrupa por vendorId, crea `orders` (maestro) + `subOrders` (con vendorSubtotal/commission/payout). Sin pago real.
- **Reglas**: `subOrders` (dueño/admin), `shippingZones` (pública/admin), `payouts` (admin).
- **Cliente/Admin**: `services/orders.js`, `services/shippingZones.js`, `services/payouts.js`;
  `/admin/envios` (AdminEnviosZonas, CRUD zonas), `/admin/payouts` (AdminPayouts, liquidación a vendedores);
  VendorPanel muestra las sub-órdenes del vendedor.
- **Seed**: 2 zonas de envío.
- ⬜ Pendiente Fase 3 (requiere servicios externos): split de pago real (Mercado Pago Marketplace / Stripe
  Connect), búsqueda Algolia/Typesense on-write, rol `vendor` por claims, integrar el checkout real a este flujo.

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
- **Fase 2b** ✅ (verificado E2E): niveles/tiers (`src/constants/tiers.js`, mostrados en MisionesPage con barra de progreso); **catálogo de recompensas dinámico** (`rewardsCatalog` en Firestore + admin `/admin/recompensas` + `services/rewardsCatalog.js`); canje server-side `redeemRewardSecure` (costo del catálogo, debita, ledger 'spend', genera `userCoupons` con code). Verificado: canje 30 pts → 50→20 + cupón.
- ⬜ Pendiente Fase 2: push v2 (deep links/topics; requiere FCM real, no emulable), verificación de retos por triggers server-side.

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
