# Changelog — Wala

Registro de actualizaciones y funciones, de lo más nuevo a lo más viejo. Las entradas más
recientes (**2026-06-25**, **2026-06-27** y **2026-06-28**) ya están **desplegadas a
producción** (`sistema-gestion-3b225`): frontend por **Vercel** (auto-deploy desde `master`)
y backend (Cloud Functions / índices / backfills) por **Cloud Shell**. Las entradas más antiguas marcadas
`[Sin liberar]` se construyeron en la rama `fase-0-seguridad` (hoy `master`) y se
**verificaron en local** (build + emulador) antes de desplegarse en esas tandas. Detalle de
estado en [docs/wala/ESTADO-DEL-PROYECTO.md](docs/wala/ESTADO-DEL-PROYECTO.md); detalle por
fase en [`docs/wala/fases/`](docs/wala/fases/README.md).

Convención: ✅ hecho · 🔧 parcial · ⬜ por hacer.

---

## [2026-06-28] — MULTI-MARCA en el EDITOR: secciones "Productos {Marca}" / "Categorías {Marca}" arrastrables + NAV DE CATEGORÍAS AUTOMÁTICO (deriva de los productos) (Vercel)
Refinamiento del sistema multi-marca sobre la misma sesión 2026-06-28: el dueño ahora arma una **página de marca** **arrastrando módulos ya filtrados** (sin tocar el dropdown "Marca de esta sección") y el **nav de categorías se genera SOLO** a partir de los productos de la marca. **Frontend DESPLEGADO** por **Vercel** (auto-deploy desde `master`); **el backend NO requiere redeploy** (solo Firestore). **No toca carrito, precios ni cobro.** Build verde. Detalle de estado en [docs/wala/ESTADO-DEL-PROYECTO.md](docs/wala/ESTADO-DEL-PROYECTO.md); plan en [PLAN-MULTIMARCA.md](docs/wala/PLAN-MULTIMARCA.md).

### Secciones por marca en "Añadir Nuevo Módulo"
- ✅ `041742f` — **El menú "Añadir Nuevo Módulo" del Editor Visual (`VisualEditorPanel.jsx`) ofrece opciones POR MARCA**, generadas **dinámicamente** desde `getBrands`. Para los dos tipos que filtran por marca, el `<select>` muestra un `<optgroup>` con: la opción **genérica** (global) + una opción **por cada marca**:
  - **"Productos {Marca}"** → inserta un **`sidebar_catalog`** con `brandId` + `title` ("Productos {Marca}") **preconfigurados**.
  - **"Categorías {Marca}"** → inserta un **`categories_nav`** con `brandId` preconfigurado.
  - Así el dueño **arrastra directo** el catálogo/nav de una marca **ya filtrado**, sin usar el dropdown "Marca de esta sección". `addSection(type, settingsOverride)` mezcla el override sobre los `getDefaultSettings`; la opción de marca se codifica en el `value` como JSON `{type, brandId, title}`. El resto de tipos quedan **igual**. **Retrocompatible** (secciones existentes y home/tienda intactas).
  - El label de `sidebar_catalog` en `SECTION_TYPES` (`storefront.js`) pasó de "Catálogo con Sidebar (Mercado Libre)" a **"Catálogo (todas las marcas)"** (la opción genérica = global; la de marca lleva el nombre de la marca).

### Nav de categorías AUTOMÁTICO por marca
- ✅ `3f0627c` — **`categories_nav` AUTO-deriva las burbujas** cuando el `categoryNav` manual de la marca (`tienda_brands`) está **VACÍO** (`TiendaPage.jsx`): recolecta las **categorías que tienen los PRODUCTOS de esa marca** (`getProductsByBrand` → ids de categoría DISTINTOS, con la **misma extracción `idOf`** que usa el sidebar al filtrar) y las **mapea a `tienda_categories`** (`getCategories`) para sacar nombre + imagen. **Las imágenes salen de `/admin/categorías`** (`tienda_categories.imageUrl`); **categoría sin imagen = burbuja con inicial + color estable** (`VisualCategoryNav.jsx`, ya no usa fotos de stock de Unsplash). **Clic en una burbuja filtra el catálogo de la página por esa categoría** (in-page: categoría como filtro de cliente, marca server-side; el id de la burbuja casa con el del filtro del sidebar). El `categoryNav` manual (panel de marca → pestaña "Nav de categorías") sigue como **OVERRIDE opcional** (orden e imágenes a mano).
- ✅ `3f0627c` (fix) — **Una página con `categories_nav` de una marca acota su catálogo a esa marca**: `pageBrandId` ahora considera también `categories_nav` (prioridad: el catálogo define la marca; si no hay catálogo de marca pero sí nav de marca, el nav la fija) → pulsar una burbuja del nav de la marca A **no** muestra esa categoría de **todas** las marcas cuando el catálogo es global.

## [2026-06-28] — SISTEMA MULTI-MARCA (Fases 0–5): Con Amor / MUSSA / MUEBLERIA con página, catálogo, panel y nav propios (Vercel; setup-marcas pendiente del dueño)
**Sistema multi-marca completo** sobre la misma sesión 2026-06-28: cada producto pertenece a **una** marca (`brandId` = doc id de `tienda_brands`) y cada marca tiene su **página** (`WALA.PE/ConAmor`, `/MUSSA`, `/MUEBLERIA`), su **catálogo sidebar filtrado** solo a sus productos, su **panel admin** para asignar productos y su **nav de categorías con miniaturas** que filtra el catálogo de esa marca. **No se inventó un modelo nuevo:** el ~80 % ya existía (el `brandId` ya estaba soportado end-to-end con faceta server-side `{type:'brand'}`); se **cablearon las 5 piezas** que faltaban (ver [PLAN-MULTIMARCA.md](docs/wala/PLAN-MULTIMARCA.md)). **Frontend DESPLEGADO** por **Vercel** (auto-deploy desde `master`); el **backend NO requiere redeploy** (solo Firestore). **Pendiente del dueño** (no de código): correr `setup-marcas.js --apply` (crea las landingPages MUSSA/MUEBLERIA + backfill `brandId`), configurar las páginas en el editor visual y asignar productos a MUSSA/MUEBLERIA. **Las reglas vivas siguen 100 % abiertas** en `(default)` por el ERP compartido. Detalle de estado en [docs/wala/ESTADO-DEL-PROYECTO.md](docs/wala/ESTADO-DEL-PROYECTO.md).

**Decisiones del usuario** (fijadas antes de arrancar, ver PLAN-MULTIMARCA): **1 producto = 1 marca**; **todos los productos actuales = Con Amor** (backfill); **`/mussa` se convierte en marca** (su slug); slug en formato `ConAmor`/`MUSSA`/`MUEBLERIA`; categorías por marca como **array embebido** (`categoryNav`). **Brand IDs reales:** Con Amor `m3P26agqw7BjeYTDjs6j`, MUSSA `pMujqcyIIDUF2EdSSX5V`, MUEBLERIA `RMLsCQGvLo7c3NHgfkLO`.

### Fase 0 — Datos (script, lo corre el dueño)
- ✅ `281823a` — **`scripts/setup-marcas.js`** (idempotente, **DRY-RUN por defecto**, `--apply` para escribir, `--project sistema-gestion-3b225`): (1) crea/reutiliza en `tienda_brands` las 3 marcas con `slug` (Con Amor/ConAmor, MUSSA, MUEBLERIA) sin duplicar (busca por slug o nombre, case-insensitive; añade el slug si falta); (2) **backfill** — a cada `productos_wala` con `brandId` vacío/ausente le pone `brandId = <id de Con Amor>` (no toca los que ya tienen marca; **solo `brandId`/`slug`**, no precios/stock); (3) crea las `landingPages/{slug}` (id === slug) para que las rutas `WALA.PE/ConAmor`/`/MUSSA`/`/MUEBLERIA` resuelvan vía `DynamicLandingPage`. **Pendiente del dueño correrlo con `--apply`.**

### Fase 1 — `WALA.PE/ConAmor` con su catálogo propio
- ✅ `a687fd5` — **`sidebar_catalog` filtrable por marca**: la sección gana un setting `brandId` (selector de marca en `VisualEditorPanel`, guarda `b.id` = doc id, no slug; `storefront.getDefaultSettings` lo expone). `getProductsByBrand(brandId)` en `products.js`. `TiendaPage` inicializa `catalogFacet = {type:'brand', value: brandId}` → el catálogo paginado trae **solo esa marca** server-side (`where('brandId','==',...)`), con la categoría como filtro de cliente. **Red de seguridad**: `brandId` vacío = **catálogo global** (no rompe la home). Requiere índice `brandId + createdAt`.

### Fixes de ruteo
- ✅ `212bf0f` — **Slug case-insensitive**: `getLandingPageBySlug` (`landingPages.js`) primero intenta el match exacto y, si falla, **compara en minúsculas** (ej. `/CONAMOR` vs slug `ConAmor`; Firestore no compara sin distinguir mayús/minús). `DynamicLandingPage`/`TiendaPage` usan `pageIdOverride` para resolver la página por slug. Así `WALA.PE/conamor`, `/ConAmor`, `/CONAMOR` resuelven igual.

### Fase 2 — Panel admin por marca + sidebar con filtros desplegables
- ✅ `ac7e53d` (parte multimarca) — **`AdminMarcaProductos.jsx`** (panel de productos por marca): lista vía `getProductsByBrand`, **asignar/quitar marca en lote**, y botón **"Crear producto en esta marca"** que abre `/admin/productos/nuevo?brandId=<id>` con la marca **preseleccionada** (`AdminProductoFormV2` ya soportaba `brandId`). `setProductBrand(id, brandId)` en `products.js` escribe el campo de forma **parcial** y, al **quitar** la marca, hace **`deleteField()`** del `brandId` (para que el producto vuelva al catálogo global, no a una marca vacía). `/admin/marcas` enlaza al detalle por marca.
- ✅ `ac7e53d` (parte sidebar) — **Sidebar con grupos de filtros COLAPSABLES** (`SidebarCatalogLayout.jsx`): los grupos de filtros del catálogo ahora se **despliegan/colapsan** para no saturar la barra lateral.

### Fases 3–4–5 — Nav de categorías por marca + clic-filtra + MUSSA/MUEBLERIA operativas
- ✅ `5221ad5` — **Nav de categorías con miniaturas por marca (Fase 3)**: array **`categoryNav: [{ categoryId, name, imageUrl, order }]`** embebido en `tienda_brands` (normalizado en `brands.js` `createBrand`/`updateBrand`), editado en el panel `AdminMarcaProductos` (pestaña "Nav de categorías"). La sección `categories_nav` (antes devolvía `null`) ahora renderiza **`VisualCategoryNav`** (burbujas con miniatura). **Clic-filtra (Fase 4)**: `VisualCategoryNav` en **modo filtro-local** — el clic en una burbuja **empuja la faceta de categoría** al sidebar de la misma página (filtra el catálogo de la marca **sin navegar**), compartiendo la categoría activa entre nav y sidebar. **MUSSA + MUEBLERIA operativas (Fase 5)**: `setup-marcas.js` extendido para crear sus landingPages; `App.jsx`/ruteo `/:slug` ya las resuelve (se resolvió la colisión de la `/mussa` hardcodeada convirtiéndola en marca). El panel `AdminMarcaProductos` quedó con **2 pestañas** (Productos + Nav de categorías).

### Otros fixes (mismo despliegue, frontend por Vercel)
- ✅ `bd4b8df` — **Hero: centrar la CAJA del subtítulo** (no solo el texto) según la alineación de la sección (`HeroBanner.jsx`). Antes la alineación solo afectaba al texto dentro de su caja; ahora la propia caja del subtítulo se centra/alinea con la sección.

## [2026-06-28] — FIXES DE PEDIDOS: visibilidad en "Mis Compras", no tragar el fallo de guardado, Culqi marca pagado, enlace de Recepción (Vercel + redeploy del dueño)
Tanda de **fixes del camino de pedidos** (visibilidad y estado de pago) sobre la misma sesión 2026-06-28. **Frontend** desplegado por **Vercel** (auto-deploy desde `master`); el **fix de Culqi (bug C) requiere redeploy del backend** — **ya lo hizo el dueño** por Cloud Shell (`firebase deploy --only functions:processCulqiPayment`). El resto es solo frontend. **No toca montos, Formik ni el camino de cobro** (el camino de ÉXITO queda idéntico). Detalle de estado en [docs/wala/ESTADO-DEL-PROYECTO.md](docs/wala/ESTADO-DEL-PROYECTO.md).

### Visibilidad de pedidos en "Mis Compras"
- ✅ `de1594b` (bug A — visibilidad) — **Los pedidos no aparecían en "Mis Compras"** porque `createWebOrder` (`src/services/erp/firebase.js`; la creación que comparten WhatsApp/Culqi/PayPal) guardaba el documento **SIN normalizar**, mientras el perfil filtra por el **DNI normalizado** con un `where` exacto → nunca casaban. **FIX:** `createWebOrder` ahora **normaliza** `clienteNumeroDocumento` y `dni` (trim + quita espacios, igual que `createOrderInERP`) para que casen con el filtro del perfil, y **conserva el valor tecleado en `dniRaw`**. `searchOrdersByDniInERP` suma un **fallback con el DNI crudo** si la búsqueda normalizada da 0 resultados (**rescata los pedidos históricos** guardados sin normalizar).
- ✅ `de1594b` (bug B — no tragar el fallo) — `createWebOrder` estaba dentro de un `try/catch` que **solo hacía `console.warn`** → si el guardado fallaba, el flujo **abría WhatsApp fingiendo éxito** y el pedido se perdía (el cliente creía que había comprado). **FIX:** en `CheckoutPage.jsx`, si `createWebOrder` no devuelve `id` se muestra un **toast de error** y se **aborta ANTES del paso de pago** (no se abre WhatsApp ni Culqi/PayPal). El camino de ÉXITO queda idéntico; sin tocar montos/Formik/cobro.

### Estado de pago — Culqi marca el pedido como pagado
- ✅ `e84b6b1` (bug C — **requiere redeploy, ya hecho por el dueño**) — `processCulqiPayment` (`functions/index.js`) **cobraba la tarjeta pero NUNCA marcaba el pedido como pagado** → un pedido pagado con Culqi quedaba **indistinguible de uno impago** (`montoPendiente = total`) y "Recepción de Pedidos" no podía separar pagados de "por confirmar pago". **FIX:** en la **rama de ÉXITO** del cobro (tras tomar el lock `culqiCharges/{tokenId}`, reusando `erpDb/coll/pedidoId` que la función ya tenía) marca el pedido en `pedidos_web` con los **MISMOS 7 campos que el `culqiWebhook`**: `pagado:true`, `estadoPago:"pagado"`, `culqiChargeId`, `montoPagado`, `montoPendiente:0`, `pagadoAt`, `metodoPago:"culqi"`. Es **best-effort** (`try/catch`, no falla la respuesta del cobro) e **idempotente** (bajo el lock S-4 y con los mismos campos que el webhook → sin conflicto); **no toca `montoTotal` ni el monto del cobro**. Verificado con auditoría adversarial de dinero. El `culqiWebhook` ya hacía esto, pero **su URL no está registrada en el panel de Culqi** (pendiente del dueño como respaldo, ver entrada 2026-06-27); este fix cierra la brecha desde la propia confirmación del cobro.

### Acceso de admin
- ✅ `09d86a9` — Enlace **📦 Recepción de Pedidos** en el menú lateral del admin (`src/components/AdminLayout/AdminLayout.jsx`), debajo de "Dashboard Analítica", para entrar a **organizar los envíos** sin hacer scroll hasta el final del dashboard. (Ya descrito en la entrada de Escalabilidad de hoy; se reafirma aquí por pertenecer al camino de pedidos.)

### Sin cambios en el resto del estado
- 🔧 **Flags de pago intactos:** `CULQI_VERIFY_SIGNATURE=false` (apagado hasta el secret real de Culqi; `CULQI_WEBHOOK_SECRET` con placeholder **inerte**), `ENFORCE_PAYMENT_OWNERSHIP=true` (desplegado, pendiente validar con una compra real).
- 🔧 **PayPal server-side** sigue **completo y desplegado con `VITE_PAYPAL_SERVER_SIDE` en OFF** — **pendiente de credenciales** del dueño (`developer.paypal.com`).
- 🔧 **Las reglas vivas siguen 100 % abiertas** en `(default)` por el ERP compartido. **No desplegar `firestore.rules.propuesto` sin resolver la auth del ERP (App Check / Firebase Auth) / sin permiso.**

### Documentación
- 📄 El **ciclo completo del pedido** (creación → pago → estado → visibilidad), incluidos estos tres fixes, quedó documentado con archivo:línea en **[docs/wala/FLUJO-PEDIDOS.md](docs/wala/FLUJO-PEDIDOS.md)** (enlazado desde [MODELO-DATOS.md](docs/wala/MODELO-DATOS.md) y el índice [docs/wala/README.md](docs/wala/README.md)).

## [2026-06-28] — ESCALABILIDAD Fases 0–4 + texto enriquecido (Vercel + DEPLOY del dueño por Cloud Shell)
Sesión doble: (1) **editor de texto enriquecido** en el editor visual y (2) **despliegue de las Fases 0–4 del plan de [ESCALABILIDAD](docs/wala/ESCALABILIDAD.md)** (bundle, seguridad de pagos seguro-por-defecto, pre-agregación de analítica, paginación/búsqueda de catálogo, observabilidad). El **frontend** se desplegó por **Vercel** (auto-deploy desde `master`); las **Cloud Functions, los índices y dos backfills los EJECUTÓ EL DUEÑO por Cloud Shell** sobre `sistema-gestion-3b225`. Detalle de estado en [docs/wala/ESTADO-DEL-PROYECTO.md](docs/wala/ESTADO-DEL-PROYECTO.md). **Las reglas vivas siguen 100 % abiertas** en `(default)` por el ERP compartido (ver más abajo y §6/§7 de ESTADO).

### Editor de texto enriquecido (editor visual)
- ✅ `ae30cfa` — **Texto enriquecido en TODOS los editores de sección** (`VisualEditorPanel.jsx`): bloque reutilizable **`TextStyleControl`** (alineación izq/centro/der, **subrayado**, **color de fondo**, **link en el texto**) + **`ButtonFieldsControl`** (texto/enlace del **botón**), añadidos a hero, header, text, testimonials, map, marquee y carruseles. `storefront.getDefaultSettings` suma los campos `<campo>Align/Underline/Bg/Link` + `buttonText/buttonLink`. El render (`textStyleUtils.jsx` con `<TextoSeccion>`/`<BotonSeccion>`) aplica alineación/subrayado/fondo, envuelve el texto en `Link`/`<a>` y pinta el botón; `TiendaPage.jsx` pasa la config a cada sección. **100 % retrocompatible**: con campos vacíos, las secciones se ven igual que hoy. Build verde.

### Escalabilidad — Fase 1 (quick wins, frontend por Vercel)
- ✅ `1a82a0a` (parte Fase 1) — **Split del bundle**: `vite.config.js` con `manualChunks` parte el `index` de **~2.25 MB** en `react-vendor`/`firebase-vendor`/`charts`/`motion`/`paypal`/`fabric` (el chunk de app baja a **~619 KB**), cacheable entre deploys. **Dashboard −75 % de lecturas**: `AdminUsuariosAnalyticsPage` pasa el refetch de **15 s → 120 s**, sin refetch en background y `staleTime` 60 s.

### Escalabilidad — Fase 0 (seguridad de pagos, SEGURO POR DEFECTO)
- ✅ `1a82a0a` (parte Fase 0) — **Seguridad de pagos seguro-por-defecto** (sin cambiar comportamiento hasta activar flags): **S-4 idempotencia** de `processCulqiPayment` (lock `culqiCharges/{tokenId}`); **S-2 firma del webhook Culqi** tras el flag `CULQI_VERIFY_SIGNATURE` (OFF por defecto); **S-3 ownership** de la confirmación de pago tras `ENFORCE_PAYMENT_OWNERSHIP` (OFF); **S-1 PayPal server-side** (`createPaypalOrderSecure`/`capturePaypalOrderSecure`) **escritas pero NO cableadas al cliente todavía**. **+8 índices** compuestos en `firestore.indexes.json` (`analytics_events`, `pedidos`/`pedidos_web`). **NUEVO `firebase/firestore.rules.propuesto`** — guardado, **NO desplegado**: cierra el `update` cliente-side de `pedidos_web` (precondición: tener `capturePaypalOrderSecure` cableada) y valida el `create` de `analytics_events`. Pagos verificados sin cambio de comportamiento con los flags apagados. `node --check` OK.

### Escalabilidad — Fase 2 (pre-agregación de analítica)
- ✅ `0011b70` / `8de5b50` — **Pre-agregación diaria de analítica**: CF **`aggregateAnalyticsDaily`** (`functions/analyticsDaily.js`, `onSchedule` gen2 a las 00:20 hora Lima) recorre el día anterior con **query paginada por cursor** (idempotente, `set` sin merge) y escribe **`analytics_daily/{YYYY-MM-DD}`** con los contadores ya sumados; + **`aggregateAnalyticsDailyBackfill`** (callable solo-admin, `{day}` o `{fromDay,toDay}`, tope 120 días). Funciones puras portadas a `functions/analyticsAggregations.js`. **Frontend (seguro antes de la CF)**: `src/services/analyticsDaily.js` (`getAnalyticsDailyRange` lee N docs diarios + el día en vivo, claves en hora Lima UTC-5 para casar los IDs) y `dashShared.jsx` con **FALLBACK** — si no hay docs diarios o falla, cae a `getGlobalAnalytics` legacy (dashboard intacto). `getTopSellingWala` usa el índice `(type, clientTsMs)` y filtra/ordena server-side en vez de `limit(3000)`+filtro en memoria (con fallback al comportamiento previo). Regla `analytics_daily` (read admin, write CF) añadida al `.propuesto` (aditiva y segura).

### Escalabilidad — Fase 3 (catálogo y búsqueda)
- ✅ `37fc015` — **Paginación con cursor + render incremental del catálogo** (no traer todo de una): `getStoreProductsPage({facet,sort,cursor,pageSize=24})` sobre `getCollectionPaginated` (`startAfter`+`limit`), orden y faceta server-side. **Red de seguridad**: si la 1ª página por defecto sale con 0 items (p. ej. docs sin `createdAt`), cae al catálogo completo → el storefront **nunca queda vacío**. `TiendaPage` usa `useInfiniteQuery`; `ProductGrid` con modo servidor (IntersectionObserver + "Cargar más", ~24 nodos/página). **+6 índices `productos_wala`**. Script `backfill-product-createdat.js` (lo corre el dueño): normaliza `createdAt` a Timestamp + `createdAtMs` + `visible:true`, idempotente, dry-run por defecto.
- ✅ `21ecbc6` (parte Fase 3) — **Búsqueda SOLO Firestore** (decisión del usuario): `products.js` escribe `nameLower`+`searchTokens` en create/update; `search.js` `searchProductsFirestore` (prefijo `nameLower` / `token array-contains`, paginado) con **FALLBACK a memoria** si faltan tokens/índice/0 resultados; `SearchPage` con "Cargar más" (fix: el cursor numérico de memoria no se cruza con el `startAfter` de Firestore). Script `backfill-search-tokens.js`. **Imágenes lazy**: la ruta principal ya usa `OptimizedImage` (lazy+async); `HeroBanner` con `fetchpriority=high`, `BrandMarquee`/`AnnouncementBar` con lazy/decoding (sin cambios de layout).

### Escalabilidad — Fase 4 (i18n endurecido + observabilidad)
- ✅ `21ecbc6` (parte Fase 4) — **Lingva endurecido** (sin tocar API): caché v2 con TTL 30 d, dedupe en vuelo, **circuit-breaker** por instancia (cooldown 60 s), timeout 6 s y SIEMPRE cae al texto original; `useTranslatedText` sin renders en bucle. **Observabilidad**: `AppErrorBoundary` global (envuelve Router/Suspense) que captura `window.onerror`/`unhandledrejection` → `analytics_events` tipo `client_error` (throttle 20/sesión, dedup 10 s, sin PII), y **Web Vitals** (LCP/CLS) vía `PerformanceObserver` nativo → `web_vital`. Todo fire-and-forget.

### Fixes de índices y backfills (correcciones para Cloud Shell)
- ✅ `ceed174` — **Fix de índices**: Firestore rechaza con HTTP 400 los compuestos de un solo campo (`productos_wala nameLower`) y los que repiten el mismo `fieldPath` (`analytics_sessions` ASC+DESC); se quitan (usan el índice de campo único automático) y se conserva el compuesto `searchTokens`+`nameLower`.
- ✅ `66606dc` — **Fix de scripts de backfill**: usan la API **modular** de `firebase-admin` (`require('firebase-admin/app').applicationDefault()` + `getFirestore()`) porque `admin.credential`/`admin.firestore` quedan `undefined` con el `firebase-admin` modular del entorno de Cloud Shell.

### DEPLOY EJECUTADO POR EL DUEÑO (Cloud Shell, `sistema-gestion-3b225`)
- ✅ **7 Cloud Functions** desplegadas (incluye las de pagos con flags OFF, la CF gen2 `aggregateAnalyticsDaily` y el callable de backfill).
- ✅ **Índices** desplegados (`analytics_events`, `pedidos`/`pedidos_web`, `productos_wala` array-contains+createdAt, `searchTokens`).
- ✅ **2 backfills corridos** sobre **123 productos**: `createdAt` (**recuperó 77 productos que estaban ocultos** del storefront por no tener fecha) y `searchTokens` (habilita la búsqueda Firestore).

### Decisiones de arquitectura (sesión 2026-06-28)
- **Búsqueda = SOLO Firestore** (no Algolia/Typesense por ahora): se descartó el índice externo para no añadir servicio/costo; la búsqueda usa `nameLower`+`searchTokens` con fallback a memoria.
- **Traducción = Lingva** (no Google Cloud Translation v3 de pago): se endurece la vía gratuita en vez de migrar a la API de pago.
- **CFs de dinero en gen1** (Culqi/PayPal): se mantienen en gen1 por estabilidad del camino del dinero; la migración a gen2 (concurrencia) queda para la base de mayor tráfico (Fase 4 del plan).
- **Despliegue de backend = SOLO Google Cloud Shell** (copiar/pegar): se evaluó que Claude desplegara directo desde la PC del dueño, pero **`firebase-tools` es INCOMPATIBLE con Node 24** (el que está instalado localmente): el cliente HTTP de `firebase-tools` se corta con `Premature close` aunque el `fetch` nativo de Node y `curl` SÍ funcionan contra los mismos endpoints — **no** es la red, ni el antivirus, ni la clave, ni los permisos, sino la incompatibilidad de la herramienta con esa versión de Node. Para automatizar el deploy desde la PC en el futuro habría que **instalar Node 20/22 LTS**. Mientras tanto, el backend se sigue desplegando por **Cloud Shell**.

### Seguridad (sin cambios en las reglas vivas)
- 🔧 **Las reglas vivas siguen 100 % abiertas** en la base `(default)` de `sistema-gestion-3b225` porque el **ERP comparte el proyecto y NO usa Firebase Auth** (sus peticiones llegan sin identidad). El `firestore.rules.propuesto` está **guardado pero NO desplegado**; su despliegue depende de la precondición PayPal server-side (cerrar `pedidos_web`) y del track de App Check / migrar el ERP a Firebase Auth (§6/§7 de ESTADO).

### ✅ Desplegado al final de la sesión (PayPal con flag OFF)
- ✅ `09d86a9` / `5903a6a` — **Recepción de Pedidos (admin)**: nueva área para **organizar envíos** del portal WALA (`RecepcionPedidos.jsx` + `DashRecepcion.jsx` + `RecepcionPedidos.module.css`), solo-lectura, consume `useAdminWalaOrders` (hook) sobre la capa `adminOrders.js` que lee `pedidos_web`+`pedidos` del ERP. Tiene **tres accesos**: (1) **ENLACE en el menú lateral** — **📦 Recepción de Pedidos**, ubicado **debajo de "Dashboard Analítica"** en el grupo *Diseño de Tienda* (`src/components/AdminLayout/AdminLayout.jsx`); (2) **embebida al final** del dashboard de analíticas; y (3) **ruta directa** `/admin/dashboard/recepcion`. **Desplegado.**
- 🔧 **PayPal server-side**: el **código está COMPLETO y DESPLEGADO con el flag `VITE_PAYPAL_SERVER_SIDE` en OFF** — `PaypalCheckout.jsx` invoca `createPaypalOrderSecure`/`capturePaypalOrderSecure` cuando el flag `VITE_PAYPAL_SERVER_SIDE === 'true'` (OFF por defecto, **sin cambio de comportamiento**; con el flag apagado el checkout usa el flujo PayPal cliente histórico). La **ACTIVACIÓN quedó PENDIENTE**: falta que el dueño **consiga las credenciales de su app de PayPal** (Client ID + Secret de `developer.paypal.com`) y las ponga en **`functions/.env`** (`PAYPAL_CLIENT_ID`/`PAYPAL_SECRET`, + `PAYPAL_ENV='live'` en producción) → **redeploy** de las CFs → recién entonces poner **`VITE_PAYPAL_SERVER_SIDE=true` en Vercel** y redeployar el frontend. ⚠️ Se **removieron del `.env` unas credenciales de ejemplo** que se habían puesto por error (eran **inertes** porque el flag está OFF, pero se quitaron para no dejar valores falsos).
- ✅ **Botón de backfill de analítica** en el dashboard (`BackfillAnaliticaButton.jsx` + `.module.css`) que dispara `aggregateAnalyticsDailyBackfill`. **Desplegado.**

### 🔧 Flags de pago — estado real en `functions/.env.sistema-gestion-3b225`
- 🔧 **`CULQI_VERIFY_SIGNATURE=false`** (S-2, firma del webhook Culqi): se intentó activar con un **secret placeholder**, pero quedó **apagado** hasta tener el **secret real de Culqi**. Por eso `CULQI_WEBHOOK_SECRET` aún tiene un **placeholder**, pero es **INERTE** (con `verify=false` no se valida ninguna firma).
- ✅ **`ENFORCE_PAYMENT_OWNERSHIP=true`** (S-3, ownership de la confirmación de pago) **desplegado**. **Pendiente validar con una compra real** (que el `buyerUid` autenticado coincida con la orden) antes de darlo por cerrado.

### ⬜ Pendiente del DUEÑO (no de código)
- ⬜ **Conseguir las credenciales de PayPal y activar el flujo server-side**: crear/usar su app en `developer.paypal.com`, obtener **Client ID + Secret**, ponerlos en **`functions/.env`** (`PAYPAL_CLIENT_ID`/`PAYPAL_SECRET` + `PAYPAL_ENV='live'`), **redeploy** de las CFs, probar en sandbox y recién entonces **`VITE_PAYPAL_SERVER_SIDE=true` en Vercel** (+ redeploy del frontend).
- ⬜ **Activar la firma del webhook Culqi (`CULQI_VERIFY_SIGNATURE=true`)** una vez que tenga el **secret real de Culqi** (reemplazar el placeholder de `CULQI_WEBHOOK_SECRET`) y lo haya validado contra un cobro real.
- 🔧 **Validar `ENFORCE_PAYMENT_OWNERSHIP=true`** (ya desplegado) con una **compra real** antes de darlo por cerrado.
- ⬜ **Desplegar `firestore.rules.propuesto`** SOLO cuando PayPal server-side esté probado (cierra el `update` de `pedidos_web`) y resuelto el track del ERP (App Check / Firebase Auth). **No desplegar el `.propuesto` sin resolver la auth del ERP / sin permiso.**
- ⬜ **(Opcional) Automatizar el deploy desde la PC del dueño**: requiere **instalar Node 20/22 LTS** (con Node 24 `firebase-tools` se corta con `Premature close`). Hasta entonces, el backend se despliega por **Cloud Shell**.

## [2026-06-27] — DESPLEGADO A PRODUCCIÓN (Vercel + Cloud Functions vía Cloud Shell)
Sesión grande de UX/diseño, tracking, checkout internacional, **fidelización/regalos, internacionalización, perfil** y fixes. **Frontend desplegado por Vercel** (auto-deploy desde `master`); las **Cloud Functions del checkout internacional se desplegaron por Cloud Shell** a `sistema-gestion-3b225`. Detalle de estado en [docs/wala/ESTADO-DEL-PROYECTO.md](docs/wala/ESTADO-DEL-PROYECTO.md) y de cara al cliente en [docs/wala/FUNCIONES-CLIENTE.md](docs/wala/FUNCIONES-CLIENTE.md).
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
- ✅ **"Mis Compras" estilo MercadoLibre (estado real pago + producción)**: la lista de pedidos (`CuentaPedidosPage.jsx`, ruta `/cuenta/pedidos`) y un **detalle por pedido** nuevo (`CuentaCompraDetallePage.jsx`, ruta `/cuenta/pedidos/:id`) muestran un **estado de compra unificado** derivado en `src/utils/estadoCompra.js` combinando DOS ejes — la **etapa de producción** (`estadoGeneral`/`status`/`estado`) y si está **pagado** — con badge de color y etiqueta de método de pago (tarjeta/Culqi, PayPal, "por validar" Yape/Plin/transf.). El detalle trae el pedido **CRUDO por id en ambas colecciones** vía `getOrderByIdAnyCollection` (lee `pedidos` y `pedidos_web`), con fallback al `_raw` que `usePedidos` ahora adjunta a cada pedido normalizado (la normalización descartaba productos/dirección/método de pago/numeroPedido). Incluye lista de productos con miniatura, dirección de entrega, resumen de totales (solo lectura, sin recálculo de cobro), "También te puede interesar" por categoría y **WhatsApp al asesor de la marca** (o número general de respaldo). Helpers `getProductosPedido`, `getCodigoPedido`, `derivarEstadoCompra`, `getBrandIdsDePedido`.
- ✅ **WhatsApp por marca + "Plan B" al cerrar Culqi**: cada marca puede tener su propio `whatsappNumber` (campo en `tienda_brands`, editable en `/admin/marcas`). En el checkout, si el cliente **cierra/cancela el modal de Culqi sin pagar** (`onClose` → `culqiClosed`), aparece una tarjeta de recuperación con **DOS botones grandes**: (a) **"Continuar comprando con tarjeta"** que **remonta** Culqi vía `culqiKey` y vuelve a auto-abrir el modal, y (b) **terminar la compra por WhatsApp**. 🐛 **Fix del doble-popup**: el auto-open de Culqi se dispara una sola vez con un `autoOpenedRef` (`CulqiCustomCheckout`) para no abrir dos modales. El número de destino por defecto es el **principal "Todo a WALA"** (`whatsapp_number_main`, fábrica `+51924426791`, configurable en `/admin/marcas`); con el **toggle de confirmación multimarca** (`whatsapp_multimarca`) activado, el pedido se reparte por marca (`waGroups`, un botón por asesor) y cada asesor recibe SOLO sus productos; desactivado, todo va al número principal.
- ✅ **Registro de regalos por fecha `/regalar/:referralCode` (drag-and-drop, miniaturas, nombre+relación)**: `GiftRegistryPage.jsx` rediseñada — cada producto es una tarjeta cuya **imagen se arrastra** (con `draggable={false}` + CSS `-webkit-user-drag:none` para matar la imagen fantasma del navegador) y cuyo **nombre es un enlace** a la ficha. Arrastrar sobre una fecha **ASIGNA** el producto a ese día (estado `assignments`), mostrando una **tira de miniaturas** bajo la fecha (cada una con × para quitarla); el botón **"Proceder a regalar (N) 🎁"** agrega esos regalos al carrito en Modo Regalo con la `deliveryDate`. Las fechas se rotulan con **nombre del tercero + relación con el dueño** (`construirLabel`, ej. "Cumpleaños de Mamá (Padre/Madre)") y también incluyen el **cumpleaños del propio dueño**. Datos mínimos vía la Cloud Function `getPublicGiftRegistry` (sin PII). (La encuesta `SubscriptionSurveyPage` captura los `giftRecipients[].events[]` con nombre/relación y el cumpleaños propio del dueño.)
- ✅ **Tipos de documento DNI / CE / Pasaporte (registro + checkout)**: nuevo módulo puro `src/constants/documentTypes.js` (`DOC_TYPES_PE` = DNI / Carnet de Extranjería (CE) / Pasaporte; `FOREIGN_DOC_LABEL`; `isPeru`, `getDocTypesForCountry`). Perú ofrece la lista cerrada; el extranjero usa un campo abierto único.
- ✅ **i18n GRATIS (ES / EN / PT) sin API de pago**: `src/i18n/dictionaries.js` (strings visibles de navegación/CTAs/cuenta por idioma) + `src/contexts/LanguageContext.jsx` (`lang`/`setLang`/`t`/`available`, persiste en `localStorage` y fija `document.documentElement.lang` para que el **traductor nativo del navegador** traduzca el resto gratis) + `LanguagePopup.jsx` ("¿Ver Walá en tu idioma?") y toggle ES/EN/PT en el Header. **CTA "Al carrito"** (`cta.addToCart`) entre los strings traducidos.
- ✅ **Foto de perfil — Avatar Studio (sin Ready Player Me)**: `src/components/profile/AvatarStudio.jsx` **reemplaza** el antiguo flujo de avatar 3D (Ready Player Me, descontinuado) por un configurador de avatar propio (tono de piel, peinado, ojos, boca, accesorio, peso/altura y "vestir" con productos del catálogo).
- ✅ **Captura de cumpleaños (`birthDate`)**: `CompleteProfilePage.jsx` y `SubscriptionSurveyPage.jsx` piden y guardan `birthDate` en el perfil. **Import opcional desde Google**: en el login con Google se pide el scope `user.birthday.read` y se lee el cumpleaños vía **People API** (gratis, best-effort, nunca rompe el login); se guarda en `localStorage` (`wala_google_birthday`) para precargarlo al completar el perfil (`src/services/firebase/auth.js`).
- ✅ **Carrusel de marcas (forma / zoom / subir foto)**: `BrandMarquee.jsx` renderiza cada logo con **forma de marco** configurable (círculo / cuadrado / estrella / pentágono vía `clip-path`), **zoom** y **posición** (`zoom`/`posX`/`posY`, retrocompatibles) sobre la imagen; `/admin/marcas` permite **subir la foto** del logo (`FileReader` → `logoUrl`).
- ✅ **MÓDULO DESTACADOS (más vendidos NATIVOS de WALA)**: nueva fuente `getTopSellingWala` en `src/services/salesAnalytics.js` que lee las compras propias de WALA desde `analytics_events` (eventos `type:'purchase_complete'`, filtro de rango en memoria para no exigir índice compuesto) y rankea productos por unidades/monto cruzándolos SOLO contra `productos_wala` (los inexistentes suman a totales pero no al ranking) y líneas por `lineaProducto`/`lineId`/`categoryId` (resuelve `categoryId`→nombre vía `categories`); cachés de productos/categorías a nivel de módulo. **Admin `/admin/destacados`** (`AdminDestacados.jsx`): destacar/quitar/reordenar productos + sugerencias desde el top de ventas nativo (30 días, `staleTime` 15 min); mutaciones con aviso de error (antes fallaban en silencio). **Sección reutilizable `featured_carousel`** ("Carrusel de Destacados (Slider)") en el editor de páginas (`VisualEditorPanel.jsx` + `storefront.js`), renderizada en `TiendaPage.jsx` con la misma lista de Productos Destacados.
- ✅ **Dashboard de analítica a SOLO-WALA**: `DashProductos`, `DashCategorias` y `MasVendidosSection` pasan a leer **ventas/ingresos/pedidos/unidades/productos/líneas** desde `getTopSellingWala` (negocio propio de WALA), en vez del ERP mezclado. El hub (`DashPaginas.jsx`) trae el **gráfico de tráfico con toggle Total / App / Web** (`TrendChart`) y una tarjeta **"Seguimiento de pedidos (WALA)"** (engagement sobre el estado del pedido: visitas, usuarios únicos).
- ✅ **i18n — traducción DINÁMICA del catálogo (gratis) + banderas SVG**: `src/services/translate.js` traduce contenido en runtime (nombres/descripciones de producto) vía instancias públicas de **Lingva** (proxy gratuito de Google Translate, con caché en `localStorage` y tolerante a fallos: si falla la red devuelve el texto original); hook/componente `src/i18n/useTranslatedText.js` (`useTranslatedText` + `<T>`) usados en ProductCard/PremiumProductCard/ProductDetail/CategoryNav/CartItem/SidebarCatalogLayout. El toggle de idioma del Header usa **banderas SVG dibujadas a mano** (`src/components/i18n/FlagIcon.jsx`, España/EEUU/Brasil) porque los emoji de bandera no renderizan en Windows.
- ✅ **"Mis Compras" filtrado a SOLO pedidos de WALA**: el visor de pedidos (`usePedidos.js`) ahora filtra el ERP con `esPedidoWala` (pedido de WALA = `canalVenta:'Portal Web'` — o `web:true` / `activador:'portal_web'` / `vendedor:'Portal Web'`), para que el cliente vea únicamente sus compras hechas por el portal y no otros pedidos del ERP.
- 🐛 **Fixes menores**: cursor del input en `/admin/marcas` (ya no salta al editar) y gráfica de tendencia con **datos multi-día** (puntos ocultos en reposo, visibles al pasar el cursor; tolera rangos de 1–2 días).

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
