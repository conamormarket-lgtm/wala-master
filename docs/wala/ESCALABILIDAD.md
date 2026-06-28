# ESCALABILIDAD — WALA

> Documento de arquitectura. Reúne tres análisis de solo lectura sobre el repo
> `wala-master` (Datos/Firestore, Frontend/Performance, Backend/Cloud Functions/Pagos/
> Seguridad) y los convierte en un plan accionable y priorizado para crecer de cientos a
> miles de usuarios y productos (objetivo "MercadoLibre + Temu" del
> [PLAN-MAESTRO.md](./PLAN-MAESTRO.md)) **sin reventar costos de Firestore/Storage ni la
> seguridad**.

- **Proyecto de producción:** `sistema-gestion-3b225` (un solo proyecto Firebase: portal +
  ERP + analytics comparten la MISMA base Firestore).
- **Stack relevante:** React + Vite, Firebase (Firestore/Auth/Storage), Cloud Functions
  (`firebase-functions@4.9.0`, mezcla gen1/gen2, Node 22), Vercel para hosting del frontend.
- **Esfuerzo:** S (horas), M (días), L (semana o más).
- **Prioridad:** **Crítica** (bloquea crecer o hay riesgo de pérdida de dinero/datos) ·
  **Alta** (cuello de botella real al 10x) · **Media** (importante al 100x o mejora de costo).

> Nota de método: las cifras (5.000 eventos por carga, bundle de 2.25 MB, 5.851 lecturas por
> refresco, etc.) están verificadas en el repo. Donde un análisis asumía algo que el código
> contradice, este documento corrige la premisa de forma explícita.

---

## 1. Resumen ejecutivo

WALA **ya está en producción** y funciona bien a la escala actual (decenas/cientos de
productos, tráfico bajo). Pero está construida con patrones que **escalan linealmente con el
catálogo y el tráfico**: carga todo el catálogo en el cliente, lee miles de eventos crudos de
analítica en cada refresco del dashboard, sirve imágenes a resolución completa desde Firebase
Storage y empaqueta el código en un único chunk de 2.25 MB. Nada de esto se nota hoy; **todo
se vuelve un muro al 10x–100x**, y el síntoma ya apareció (el histórico "Quota exceeded" en
analítica).

Los **cuatro cuellos de botella más urgentes** son:

1. **SEGURIDAD / PAGOS (Crítico, Fase 0):** PayPal se captura en el cliente y el navegador
   escribe directo a `pedidos_web` poniendo `montoDeuda: 0`; el webhook de Culqi **no
   verifica firma**; `confirmPaymentSecure` deja a cualquier usuario autenticado marcar
   pagada una orden ajena. Son rutas de **pérdida de dinero directa**, explotables hoy.
2. **DATOS / ANALÍTICA (Alto):** el dashboard admin lee hasta **~5.851 lecturas por
   refresco** (400 usuarios + 5.000 eventos + 300 + 150 + 1) y con una sola pestaña admin de
   fondo llega a **~636.000 lecturas/hora**. Además el límite de 5.000 eventos **rompe la
   correctitud** de las series a medida que crece el tráfico. Falta pre-agregación diaria.
3. **CATÁLOGO / BÚSQUEDA (Alto):** la tienda carga **todo** `productos_wala` en memoria y lo
   serializa a `localStorage` (tope duro ~5 MB); la búsqueda y los filtros son 100%
   client-side sobre el array completo. Con miles de productos esto es inviable.
4. **FRONTEND (Alto, ROI inmediato):** un único chunk `index` de **2.25 MB** (sin
   `manualChunks`) bloquea el primer render; las imágenes se sirven **full-res sin
   transformar** desde Firebase Storage (la optimización Cloudinary/Vercel está desactivada),
   con egress que crece linealmente con el tráfico.

El plan: **primero cerrar Fase 0 de seguridad/pagos** (riesgo de dinero), **en paralelo el
quick-win del bundle** (20 líneas de Vite), luego **pre-agregación de analítica** y
**paginación/búsqueda server-side del catálogo**, y después imágenes vía CDN. El detalle por
fases está en §11.

---

## 2. Seguridad y Pagos (Fase 0 — bloqueante)

> Esta sección es prerrequisito de todo lo demás y se conecta con
> [FASE-0-SEGURIDAD.md](./FASE-0-SEGURIDAD.md) y
> [PLAN-SEGURIDAD-REGLAS.md](./PLAN-SEGURIDAD-REGLAS.md). No se debe escalar tráfico con
> estas rutas abiertas: más tráfico = más superficie de fraude.

> **Premisa corregida:** el encargo asumía "reglas totalmente abiertas". **No es exacto.**
> `firebase/firestore.rules` (288 líneas) ya está bastante endurecido (catálogo público
> read / write admin, PII de usuarios por owner). El riesgo real son tres puntos concretos
> (analítica `create: if true`, lectura directa del ERP sin Auth, y una regla permisiva de
> `pedidos_web`). **Acción previa obligatoria:** confirmar que las reglas del repo son las
> **desplegadas** — el propio comentario de las líneas 7-9 advierte que pueden no coincidir.

| # | Problema | Impacto a escala | Solución | Esfuerzo | Área / archivos |
|---|----------|------------------|----------|----------|-----------------|
| S-1 | **PayPal capturado en cliente.** El monto USD se calcula en el navegador y, tras `actions.order.capture()`, el cliente escribe directo `{ montoDeuda: 0, conDeuda: false }` a `pedidos_web`. La regla `allow update: if isAdmin() \|\| request.resource.data.dni != null` lo permite con solo incluir un `dni`. | **Pérdida directa**: cualquiera con DevTools marca cualquier pedido como pagado sin pagar. El daño crece con el volumen de ventas. | Mover PayPal a server-side: CF `createPaypalOrderSecure` (monto recalculado del pedido, como ya hace `processCulqiPayment`/H-11) + CF `capturePaypalOrderSecure` que llame a la API de PayPal con el secret, verifique `status===COMPLETED` y monto, y SOLO entonces escriba vía Admin SDK. **Cerrar la regla** de `pedidos_web` a admin/CF. | **M** | `src/components/PaypalCheckout/PaypalCheckout.jsx`, `functions/index.js`, `firebase/firestore.rules:212` |
| S-2 | **Webhook Culqi sin verificar firma.** El bloque HMAC está comentado (`index.js:2228-2245`); aunque `CULQI_WEBHOOK_SECRET` esté configurado, solo loguea un warning y acepta el evento. | Cualquiera que conozca la URL POSTea un `charge.succeeded` falso con `metadata.pedidoId` y marca pedidos pagados sin pagar. | Activar `verifyWebhookSignature` (ya existe en `economyLogic.js:67`, usa `timingSafeEqual`), exigir `req.rawBody`, responder 401 si falla. Confirmar el nombre exacto de la cabecera con Culqi. | **S** | `functions/index.js:2215-2245` |
| S-3 | **`confirmPaymentSecure` confirmable por cualquiera.** Solo exige `requireAuth`; marca la orden `paid` y genera payouts sin validar dueño ni pago real. | Un usuario autenticado confirma el pago de una orden arbitraria → payouts indebidos. | En producción dejar la confirmación SOLO al webhook de MP; si se mantiene callable, exigir `buyerUid === auth.uid` y comprobar el estado real en MP. `simulated` solo en emulador. | **M** | `functions/index.js:1937` |
| S-4 | **`processCulqiPayment` no idempotente.** Reintento (doble click / retry de red) con el mismo `tokenId` intenta cobrar dos veces. | Riesgo de doble cobro en picos / mala red (mitigado en parte porque Culqi rechaza reuso de token). | Aceptar `idempotencyKey` del cliente y registrar `culqiCharges/{key}` antes de llamar a la API; o usar `pedidoId` como lock. | **S** | `functions/index.js:638` |
| S-5 | **Ingesta de analítica `create: if true`** y **lectura directa del ERP sin Auth** desde el cliente. | A escala: escritura anónima ilimitada a `analytics_events` (inflado de costos / spam) y scraping de PII del ERP (`pedidos`/`pedidos_web`: nombre, DNI, teléfono, dirección). | Endurecer reglas de `analytics_events` (validar forma/tamaño, rate-limit por App Check), mover lecturas del ERP a través de CFs con Auth. **Activar Firebase App Check** en toda la app. | **M** | `firebase/firestore.rules`, `src/services/analytics/tracker.js` |
| S-6 | **`getPublicGiftRegistry` pública sin rate-limit.** | Scraping masivo de wishlists/PII a escala. | Añadir rate-limit (App Check + límite por IP/uid) o cache server-side con throttling. | **S** | `functions/index.js:2472` |

> **Punto fuerte ya presente (no tocar, mantener):** `culqiWebhook` ES idempotente por
> `chargeId` (`culqiWebhookEvents/{chargeId}` con `runTransaction`+`t.create()`); las
> funciones de economía (`feedKapiSecure`, `dailyCheckInSecure`, etc.) son transaccionales e
> idempotentes por fecha Lima; `processCulqiPayment` recalcula el monto server-side (H-11).

---

## 3. Datos / Firestore — lecturas masivas y pre-agregación

| # | Problema | Impacto a escala | Solución | Esfuerzo | Área / archivos |
|---|----------|------------------|----------|----------|-----------------|
| D-1 | **`getGlobalAnalytics` agrega en memoria.** Cada cache-miss dispara 4 queries en paralelo + 1 realtime: 400 usuarios + 5.000 eventos + 300 sesiones + 150 realtime + 1 doc resumen = **~5.851 lecturas/refresco**. `AdminUsuariosAnalyticsPage` usa `refetchInterval: 15000` + `refetchIntervalInBackground: true`. | El cache de 30s absorbe la mitad → se paga el bloque pesado (~5.300 lecturas) **cada ~30s = ~636.000 lecturas/hora con una sola pestaña admin de fondo**. Es el motor del histórico "Quota exceeded". Y el límite de 5.000 eventos **rompe la correctitud**: con más tráfico cubren cada vez menos días, sesgando funnel/top/series al día más reciente. | (a) **Pre-agregación diaria**: CF `onSchedule` que recorra los eventos del día y escriba 1 doc `analytics_daily/{YYYY-MM-DD}` con contadores ya sumados. El dashboard lee N docs (7/30/90) en vez de 5.000 eventos → **de ~5.300 a ~30-90 lecturas/refresco (60-170x menos)**. (b) Quitar el `refetchInterval:15000` (subir a 60-120s o refetch manual): **-75% de lecturas hoy mismo**. (c) Mover el bloque realtime a su propio doc-resumen/contador. | (a) **L** · (b) **S** · (c) **M** | `src/services/adminAnalytics.js:668`, `src/pages/admin/AdminUsuariosAnalyticsPage.jsx:77`, `src/...dashShared.jsx` |
| D-2 | **`getTopSelling` / `getTopSellingWala`.** ERP: 2 colecciones × `MAX_ORDERS_PER_COLLECTION=400` = hasta **800 docs** (+ fallback que relee 400 si falta índice). Wala: `where type==purchase_complete limit(3000)` y filtra fecha **en memoria** = hasta **3.000 lecturas**. Techo combinado **~3.800 lecturas + catálogo completo** en el primer load. | Las "3.000 compras más recientes por inserción arbitraria" dejan de cubrir el rango pedido (misma rotura de correctitud que D-1). El costo escala con cada apertura de "Más Vendidos". | (a) **Contadores pre-agregados**: en `trackPurchaseComplete` (o la CF de creación de pedido) `FieldValue.increment()` sobre `sales_daily/{day}` y `product_sales/{productId}`. El ranking se lee de pocos docs ordenados. (b) Arreglo rápido sin pre-agregación: índice compuesto `type + clientTsMs` y filtrar el rango en la query (no `limit(3000)` + filtro en memoria). | (a) **L** · (b) **S** | `src/services/salesAnalytics.js:166,385`, `src/components/...MasVendidosSection.jsx` |
| D-3 | **Volumen de ESCRITURAS de tracking.** `trackPageView` y `trackRouteDwell` hacen **2 escrituras cada uno** (event + update session); `ensureAnalyticsSession` 2 en el primer hit. Una visita típica (5 page_view + 5 dwell + sesión + 2-3 eventos) ronda **~25 escrituras**. | A 100x visitas, las escrituras de analítica dominan el costo y compiten con escrituras de negocio. | Reducir escrituras: batch/throttle de `routeDwell`, no actualizar la sesión en cada page_view (escribir sesión cada N segundos o al `beforeunload`), considerar muestreo en eventos de baja señal (`scroll_depth`). App Check para frenar inflado anónimo. | **M** | `src/services/analytics/tracker.js:74,119,147` |
| D-4 | **Caché de catálogo en `localStorage`.** `getProducts([],null,null)` serializa el catálogo entero (`wala_products_cache_v2`); el `try/catch` silencioso falla sin avisar al superar ~5 MB. | Con docs gordos (`customizationViews`, `variants`, `comboItemCustomization`) revienta la cuota mucho antes de los 2.000 productos y el cache deja de funcionar en silencio. | Cachear solo IDs + campos de tarjeta (name, price, mainImage), o mover a IndexedDB (sin tope 5 MB), o confiar solo en React Query en memoria. Ver también §4. | **S** | `src/services/products.js:35-46` |

> Ver §5 para los **índices Firestore faltantes** que hoy hacen caer estas queries a
> fallbacks que leen de más.

---

## 4. Búsqueda y Catálogo

| # | Problema | Impacto a escala | Solución | Esfuerzo | Área / archivos |
|---|----------|------------------|----------|----------|-----------------|
| C-1 | **La tienda carga TODO el catálogo.** `TiendaPage` llama `getProducts([], null, null)` (sin límite); cada doc cruza `normalizeProductForRead` (función pesada) y se hidrata desde `localStorage`. | Con miles de productos: N lecturas Firestore por cold-load × visitantes, `JSON.stringify/parse` de varios MB en el hilo principal (jank), y el tope de 5 MB de localStorage. | **Paginación real con cursor**: ya existe `getProductsPaginated` (`products.js:285`) y `getCollectionPaginated`, **pero la home no los usa**. Migrar a `startAfter` + scroll infinito; nunca cargar todo. | **M** | `src/services/products.js:35,285`, `src/pages/TiendaPage.jsx:188,213` |
| C-2 | **Búsqueda 100% client-side.** `searchProducts` (`products.js:297`) lee toda la colección y filtra con `.includes()` en memoria; los filtros del sidebar también filtran el array completo en cada cambio de faceta. | Con miles de productos cada búsqueda = lectura completa del catálogo + re-render costoso. Es **bloqueante** para el plan "Temu/ML". | **Algolia / Typesense** (extensión Firestore→Algolia o función de sync sobre `productos_wala`): resuelve búsqueda, filtros y autocompletar sin lecturas masivas. Alternativa mínima: queries Firestore con prefijo + índice. | **M** | `src/services/products.js:297`, `src/components/...SidebarCatalogLayout.jsx:117` |
| C-3 | **El grid no virtualiza.** `ProductGrid` mantiene el array completo en RAM y hace "infinite scroll en RAM" (slice creciente); todos los productos cruzan normalización + filtros cliente. | Cientos de tarjetas = muchos nodos DOM + filtrado sobre array grande en cada interacción. | Virtualizar con `react-window` / `react-virtuoso` cuando el grid sea grande. Combinar con C-1 (paginación) para acotar también las lecturas. | **M** | `src/components/...ProductGrid.jsx:34` |
| C-4 | **Filtros por faceta en RAM.** Categoría/colección/marca/tag/personaje/tipo se filtran sobre el array completo. | Re-render costoso por faceta a escala. | Traducir filtros a queries Firestore (`array-contains`) con índices, no filtrar en RAM. | **M-L** | `src/components/...SidebarCatalogLayout.jsx` |

---

## 5. Índices Firestore — `firestore.indexes.json`

Solo hay **5 índices compuestos** definidos (product_reviews, portal_clientes_users wordle,
2× referrals, productos_wala featured). **Faltan índices clave**: hoy varias queries de
analítica caen a **fallbacks silenciosos que leen de más**, ocultando el costo, o fallan en
silencio. Sin estos índices no se pueden quitar los `limit(5000)`/`limit(3000)` en memoria
(la única forma de filtrar+ordenar server-side).

| Índice faltante | Para qué | Esfuerzo | Prioridad |
|-----------------|----------|----------|-----------|
| `analytics_events`: `type ASC, clientTsMs DESC` | Serie de tráfico y `getTopSellingWala` filtrando por rango sin traer 3.000 docs | S | Alta |
| `analytics_events`: `uid ASC, createdAt DESC` y `email ASC, createdAt DESC` | `getAnalyticsEventsForUser` (`adminAnalytics.js:574`) ya consulta por uid/email + orderBy → **hoy probablemente cae a error silencioso** | S | Alta |
| `analytics_sessions`: `lastSeenAtClientMs DESC`, `startedAtClientMs DESC` (+ filtros) | Realtime y rango de sesiones | S | Media |
| ERP `pedidos`/`pedidos_web`: índice para `where createdAt>= AND <= orderBy createdAt` | `getTopSelling` lo necesita; hoy lo enmascara el fallback de `:129` (lee 400 + filtra en memoria) | S | Media |

**Acción:** ejecutar las queries en un entorno con datos y dejar que Firestore genere los
enlaces "create index", o añadirlos a mano a `firestore.indexes.json` y desplegar (ver
[DESPLIEGUE.md](./DESPLIEGUE.md)).

---

## 6. Frontend — Bundle e Imágenes

| # | Problema | Impacto a escala | Solución | Esfuerzo | Área / archivos |
|---|----------|------------------|----------|----------|-----------------|
| F-1 | **Chunk inicial monolítico de 2.25 MB.** `vite.config.js` solo define `{ outDir: 'build' }`: **sin `manualChunks`, sin `chunkSizeWarningLimit`, sin vendor splitting**. El build real `index-*.js` = **2.256.440 bytes**. El route-splitting (`lazy`) sí existe y está bien, pero `firebase`, `react-query`, `framer-motion`, `react-router` y la cadena de providers/Header se funden en un único `index` que bloquea el primer render (`TiendaPage` es import estático). | En 3G/4G de gama media son varios segundos de parseo+ejecución antes del primer pixel → mal LCP, rebote y SEO. No empeora con más productos (es código), pero es el peor cuello de carga **hoy**, y cualquier cambio invalida los 2.25 MB enteros (sin caché entre deploys). | Añadir `manualChunks` en `vite.config.js` (firebase / vendor-react / vendor-motion / vendor-query) + `chunkSizeWarningLimit`. Parte el `index` en 4-5 chunks descargables en paralelo y **cacheables entre deploys**. Verificar que `framer-motion`, `fabric`, `react-quill`, `html2canvas`, `recharts` **nunca** entren al chunk crítico (solo en editor/admin lazy). | **S** | `vite.config.js:36-41`, `src/App.jsx:26,68-164` |
| F-2 | **Imágenes full-res sin transformar.** `OptimizedImage` genera `srcSet` + WebP/AVIF + `q_auto` **solo si la URL contiene `cloudinary.com`**, pero las imágenes **no son de Cloudinary**: el upload va a Firebase Storage. `utils/imageUrl.js` devuelve la URL tal cual ("Vercel quota exhausted (402)…"). Cada tarjeta descarga la imagen original (1-3 MB). El `srcSet`/WebP es **código muerto** para el catálogo real. | Grid de miles de productos sirviendo originales = ancho de banda enorme, LCP malo en móvil y **egress de Firebase Storage que crece linealmente con el tráfico** (riesgo de cuota, igual que pasó con Vercel). | Activar un CDN de transformación: (a) **Mover el upload a Cloudinary** (el componente ya está listo: srcSet+WebP+q_auto "gratis"); o (b) **extensión "Resize Images" de Firebase** (genera `_200x200`, `_800x800` al subir) + `srcSet` a esos sufijos; o un CDN de imágenes (imgix/Cloudflare Images). Mitigación S: generar y guardar un `thumbnailUrl` reducido al crear el producto. | **M** (S la mitigación) | `src/components/common/OptimizedImage/OptimizedImage.jsx`, `src/utils/imageUrl.js:57`, `src/services/firebase/storage.js:25`, `src/components/...ProductCard.jsx:206` |

---

## 7. Cloud Functions — generaciones, cold starts, concurrencia

29 funciones exportadas. **Mezcla de generaciones** (riesgo operativo): las
`https.onCall/onRequest` son **gen1** (concurrencia = 1 request por instancia); las
`onSchedule` (de `firebase-functions/v2/scheduler`) son **gen2** (Cloud Run). **Ninguna**
función declara `runWith` / memoria / `minInstances` / `maxInstances` (verificado por grep):
por defecto **256 MB, timeout 60s, `minInstances=0`**.

| # | Problema | Impacto a escala | Solución | Esfuerzo | Área / archivos |
|---|----------|------------------|----------|----------|-----------------|
| B-1 | **Cold starts en el camino del dinero.** `culqiWebhook`, `mercadoPagoWebhook`, `processCulqiPayment` arrancan en frío (1-3s en Node 22) tras inactividad, con `minInstances=0`. | En el pico de pago (o tras inactividad) el webhook puede acercarse al timeout; mala UX y reintentos. | `functions.runWith({ minInstances: 1, memory: '512MB', timeoutSeconds: 120 }).https.on...` en las funciones de dinero. | **S** | `functions/index.js` (638, 1952, 2215) |
| B-2 | **gen1 no soporta concurrencia.** Una campaña de fidelización diaria que dispara `dailyCheckInSecure`/`openDailyChestSecure` a miles de usuarios a la misma hora = muchos cold starts simultáneos, latencia y posible throttling. | Picos sincronizados (la fidelización diaria es exactamente eso) saturan el autoescalado gen1. | Migrar progresivamente a **gen2** (`firebase-functions/v2/https`, **ya incluido en la 4.9.0** — no requiere actualizar la dependencia): `concurrency>1`, `minInstances`, mejor autoescalado y precio. Empezar por las de mayor tráfico (economía diaria). | **M** | `functions/index.js` (economía) |
| B-3 | **Región por defecto.** Se despliega a `us-central1`; el RTT a Perú es alto. | Latencia añadida en cada llamada a CF a escala. | Fijar región explícita más cercana (`southamerica-east1` / São Paulo) donde aplique. | **S** | `functions/index.js` (config global) |
| B-4 | **`onSchedule` hacen scans de colección completa** (`resetKapiCoins`, `notifyWishlistBirthdays`, `rotateWeeklyChallenge`). | Con muchos usuarios, el scan completo crece en lecturas y tiempo, pudiendo exceder timeout. | Paginar/segmentar el scan (cursores por lote) o filtrar por índice (p.ej. solo cumpleaños del día). | **M** | `functions/index.js:376,436,506` |

---

## 8. i18n / Traducción

La base i18n (ES/EN/PT) y la traducción dinámica del catálogo **ya están desplegadas y son
GRATIS**: diccionarios estáticos + `LanguageContext`, y traducción dinámica vía **Lingva**
(`src/services/translate.js`, `useTranslatedText`/`<T>`) con caché en `localStorage`. Ver
[PLAN-I18N.md](./PLAN-I18N.md).

| # | Problema | Impacto a escala | Solución | Esfuerzo | Prioridad |
|---|----------|------------------|----------|----------|-----------|
| I-1 | **Lingva es gratuito pero no contractual** (instancias públicas, rate-limit/caídas) y la caché vive en `localStorage` (por dispositivo, tope ~5 MB, compite con el caché de catálogo en D-4). | Con tráfico/catálogo grande: traducciones lentas o fallidas, caché que se purga, retraducir lo mismo en cada dispositivo. | Migrar a **Google Cloud Translation v3 + caché en Firestore** (compartida entre todos los usuarios), como ya describe el PLAN-I18N. La caché compartida amortiza el costo por string traducido una sola vez. | **M** | Media |

---

## 9. Acoplamiento ERP

> **Premisa corregida:** el ERP **no** está hoy en un Firestore aparte. `getErpDb()`
> (`functions/index.js:44-63`) devuelve `null` si no hay `ERP_SERVICE_ACCOUNT`, y `.env`
> confirma `REACT_APP_ERP_FIREBASE_PROJECT_ID = sistema-gestion-3b225` = **el mismo proyecto
> que la app**. La separación "erpDb" existe en el código pero apunta al mismo sitio.

| # | Problema | Impacto a escala | Solución | Esfuerzo | Prioridad |
|---|----------|------------------|----------|----------|-----------|
| E-1 | **PII real del ERP bajo las mismas reglas que la app.** `pedidos`/`pedidos_web` (nombre, DNI, teléfono, dirección) viven en el mismo Firestore y comparten reglas; algunas lecturas se hacen directo desde el cliente. | Más tráfico/usuarios = mayor superficie de fuga y scraping de PII real (no una copia). | Mediar **todo** acceso a PII del ERP por Cloud Functions con Auth + reglas que nieguen lectura directa al cliente (ver S-5). A medio plazo, separar de verdad `erpDb` (proyecto/cuenta de servicio dedicada) para aislar PII y permisos. | **M-L** | Alta (seguridad) / Media (separación) |
| E-2 | **Acoplamiento de ranking de ventas al ERP** (`getTopSelling` lee `pedidos`/`pedidos_web` directo). | Cada vista de "Más Vendidos" golpea el ERP con cientos de lecturas. | Resuelto por D-2 (contadores pre-agregados): el ranking deja de depender de leer pedidos crudos del ERP. | (ver D-2) | Alta |

---

## 10. Observabilidad

Hoy el diagnóstico de costos/cuota es **reactivo** (se descubre por "Quota exceeded" y se
parchea subiendo/bajando `limit`). Falta instrumentación para anticipar el muro al 10x/100x.

| # | Problema | Impacto a escala | Solución | Esfuerzo | Prioridad |
|---|----------|------------------|----------|----------|-----------|
| O-1 | **Sin alertas de cuota Firestore/Storage** ni presupuesto. | El primer aviso de un problema de escala es la app caída por cuota. | Configurar **Budget Alerts** de GCP y alertas de uso de Firestore (lecturas/escrituras) y egress de Storage. | **S** | Alta |
| O-2 | **Sin métricas de bundle / Web Vitals reales.** | No se sabe el LCP/TTI real de usuarios hasta que se quejan. | Medir Web Vitals (p.ej. `web-vitals` → analítica propia o GA4) y vigilar el tamaño del bundle en CI. | **S** | Media |
| O-3 | **Sin trazas/alertas en CFs** (latencia, errores, cold starts en pagos). | Fallos de pago/economía pasan desapercibidos hasta el reclamo. | Alertas en Cloud Monitoring sobre error-rate y p95 de las CFs de dinero/economía; structured logging. | **S-M** | Alta (pagos) |

---

## 11. Plan recomendado por fases

> El orden prioriza **(1) no perder dinero/datos**, **(2) máximo ROI por esfuerzo**, **(3)
> quitar los muros de correctitud/costo antes de subir tráfico o catálogo**.

### Fase 0 — Seguridad y pagos (CRÍTICO, antes de cualquier campaña de tráfico)
Cierra rutas de pérdida de dinero explotables hoy. **No escalar tráfico hasta cerrarla.**
- **S-1** PayPal server-side + cerrar regla `pedidos_web` (**M**).
- **S-2** Verificar firma del webhook Culqi (**S**).
- **S-3** Blindar `confirmPaymentSecure` (**M**).
- **S-4** Idempotencia en `processCulqiPayment` (**S**).
- **S-5 / S-6** Endurecer reglas de analítica + ERP y **activar App Check**; rate-limit del
  gift registry (**M**).
- **Acción 0:** confirmar que las reglas del repo == reglas desplegadas.

### Fase 1 — Quick wins de costo/rendimiento (días, ROI inmediato)
Se pueden hacer en paralelo a Fase 0; casi todo es **S**.
- **F-1** `manualChunks` en Vite (20 líneas) → parte el bundle de 2.25 MB (**S**).
- **D-1b** Quitar `refetchInterval:15000` del dashboard → **-75% de lecturas** (**S**).
- **D-4** Dejar de serializar el catálogo entero a `localStorage` (**S**).
- **§5** Añadir los índices Firestore faltantes (quitan fallbacks que leen de más) (**S**).
- **O-1 / O-3** Budget Alerts + alertas en CFs de dinero (**S**).
- **B-1** `minInstances:1`/512MB en las CFs de pago (**S**).

### Fase 2 — Pre-agregación de datos (quita el muro de costo y de correctitud)
- **D-1a** CF `onSchedule` → `analytics_daily/{día}`: dashboard de ~5.300 a ~30-90 lecturas
  (**L**).
- **D-2a** Contadores de ventas (`sales_daily`, `product_sales`) con `increment()` (**L**).
- **D-3** Reducir/batchear escrituras de tracking (**M**).
- Resuelve también **E-2** (ranking deja de leer el ERP crudo).

### Fase 3 — Catálogo y búsqueda a escala (habilita "Temu/ML")
- **C-1** Paginación real con cursor en la tienda (usar `getProductsPaginated`) (**M**).
- **C-2** Búsqueda con **Algolia/Typesense** (bloqueante para el plan) (**M**).
- **C-3 / C-4** Virtualización del grid + filtros por faceta server-side (**M-L**).
- **F-2** Imágenes vía CDN (Cloudinary o Resize Images de Firebase) (**M**).

### Fase 4 — Robustez de plataforma (al acercarse al 100x)
- **B-2** Migrar CFs de mayor tráfico a **gen2** (concurrencia) (**M**).
- **B-3 / B-4** Región cercana + paginar los scans de `onSchedule` (**S/M**).
- **I-1** Traducción a Google Translation v3 + caché Firestore compartida (**M**).
- **E-1** Separar de verdad `erpDb` (proyecto/SA dedicado) para aislar PII (**M-L**).
- **O-2** Web Vitals reales + control de bundle en CI (**S**).

---

## 12. Tabla maestra de prioridades

| Prioridad | Ítems |
|-----------|-------|
| **Crítica** | S-1 (PayPal cliente), S-2 (firma Culqi), S-3 (`confirmPaymentSecure`) |
| **Alta** | S-4, S-5, S-6, D-1 (analítica 5.851 lecturas), D-2 (top selling), C-1 (cargar todo el catálogo), C-2 (búsqueda client-side), F-1 (bundle 2.25 MB), F-2 (imágenes full-res), §5 (índices `analytics_events`), B-1 (cold start en pagos), E-1 (PII ERP), E-2, O-1, O-3 |
| **Media** | D-3, D-4, C-3, C-4, B-2, B-3, B-4, I-1, O-2, §5 (índices sesiones/ERP) |

---

> **Recordatorio operativo:** ningún cambio de este plan se aplica directo a producción
> `sistema-gestion-3b225` sin respaldo previo (`ops/backup/`), prueba en staging y
> verificación, según el flujo del [README.md](./README.md). Pre-agregación, índices y reglas
> tocan datos/seguridad: respaldar **antes**.
