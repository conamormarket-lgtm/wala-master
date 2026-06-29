# Estado del proyecto WALA — Panorama ejecutivo

> Documento vivo de **estado general**. Resume qué es Wala, qué trabajo se ha hecho en esta
> iniciativa, en qué fase estamos, qué hay realmente desplegado y qué falta. Es el punto de
> entrada de alto nivel; el detalle vive en [PLAN-MAESTRO.md](./PLAN-MAESTRO.md),
> [FASE-0-SEGURIDAD.md](./FASE-0-SEGURIDAD.md), [PLAN-SEGURIDAD-REGLAS.md](./PLAN-SEGURIDAD-REGLAS.md),
> [MODELO-DATOS.md](./MODELO-DATOS.md), [BASELINE-PRODUCCION.md](./BASELINE-PRODUCCION.md),
> [DESPLIEGUE.md](./DESPLIEGUE.md), [DESPLIEGUE-ESTADO.md](./DESPLIEGUE-ESTADO.md),
> [FUNCIONES-CLIENTE.md](./FUNCIONES-CLIENTE.md), [FUNCIONES-ADMIN.md](./FUNCIONES-ADMIN.md) y la
> carpeta [`fases/`](./fases/README.md).
>
> **Convención de estado:** ✅ **HECHO** · 🔧 **EN PROGRESO / PARCIAL** · ⬜ **POR HACER**.
> En lo HECHO se anota además el estado real: **cerrado**, **parcial** o **residual**.
>
> Para el detalle de **qué puede hacer cada quién** en la app que ya está en vivo, ver
> [FUNCIONES-CLIENTE.md](./FUNCIONES-CLIENTE.md) (lo que ve y hace el cliente) y
> [FUNCIONES-ADMIN.md](./FUNCIONES-ADMIN.md) (lo que controla el administrador).

> ## 📌 Banner de estado (actualizado 2026-06-29)
>
> **CICLO 2026-06-29 — qué se desplegó (frontend por Vercel; partes que requieren redeploy de
> functions, marcadas):** seis frentes, todos **sin tocar carrito/precios/cobro**.
> **(1) `wala_pedidos` pasa de RESPALDO a FUENTE DE VERDAD** (`1d8f639`): nuevo campo
> **`estadoWala`** propio de WALA (`pendiente_pago → pagado → en_preparacion → enviado →
> entregado`, `cancelado` terminal) que el portal **NO degrada** cuando el ERP toca el doc;
> helpers en `src/services/walaOrders.js` (`updateWalaOrderEstado`/`markWalaOrderPagado`/
> `estadoWalaADisplay`/`ESTADOS_WALA`), `mirrorWebOrder` ya **no degrada** un espejo existente,
> "Mis Compras"/"Recepción" leen el espejo como **PRIMARIA** y muestran el **estado más avanzado**
> (`estadoCompra.js`), y los **3 puntos de pago** de `functions/index.js` (Culqi charge, webhook,
> PayPal capture) marcan `estadoWala:"pagado"` (**requiere redeploy de functions**). Encima de la
> **red de seguridad `wala_pedidos`** (`68447dc`, espejo WALA-only que el ERP no toca, escrito por
> `createWebOrder`, fusionado/rescatado en las lecturas por `userId`). **(2) MODO NOCHE** (`a442251`
> + 2º pase `649a42e`): tema **claro/oscuro/sistema** en toda la web + admin, interruptor luna/sol
> en el Header, `ThemeContext` (clave `localStorage` `wala-theme`, `system` por default),
> anti-FOUC en `index.html`, paleta `[data-theme="dark"]` en ~40 `.module.css` + 2 pases de
> contraste; respeta los `backgroundColor` inline del admin (sin `!important`). **(3) COMPRA
> DIRECTA** (`fbb53ab`): botones **"Comprar"** y **"Comprar todo el carrito"** en la ficha →
> `/checkout` directo (CartContext `options.selectOnly` + `selectAllItems`, reusa la selección
> "No comprar esta vez"). **(4) REGALOS v3** (`4f775a4`): `/regalar` con **tarjetas grandes de
> persona** (foto circular + nombre + relación + ocasiones + fecha), foto subida en la cuenta
> (`recipient.photoUrl` → Storage), expuesta por `getPublicGiftRegistry` (`recipientPhoto`/`roleKey`/
> `gender`, **requiere redeploy de functions**); conserva el **arrastre por Pointer Events**
> (`useGiftDrag`) sin parpadeo. **(5) CUENTA** (`e9ec48d`): tabs en **2 líneas** (desktop) + scroll
> con **"asomo"** (móvil) en `CuentaLayout`; **tarjeta de compra clickeable completa** en
> `CuentaPedidosPage`. **(6) ELEMENTOS CON DISEÑO v2** (`425e9ce`): `/admin/elementos-diseno` pasa
> a **catálogo de tarjetas con slug propio por elemento** (`registry.jsx` + `AdminElementoDisenoPage`
> + ruta `/:elementSlug`); el elemento "navegacion-categorias" gana **estilo del nav por marca**
> (`tienda_brands.categoryNavStyle = {align, animation}`: alineación izq/centro/der/justificado +
> modo estático/slider). **Las reglas vivas siguen 100 % abiertas** en `(default)` por el ERP
> compartido. Detalle en §2 (Pasos 11–14) y en las entradas 2026-06-29 del
> [CHANGELOG.md](../../CHANGELOG.md); modo noche en [MODO-NOCHE.md](./MODO-NOCHE.md), pedidos en
> [FLUJO-PEDIDOS.md](./FLUJO-PEDIDOS.md)/[MODELO-DATOS.md](./MODELO-DATOS.md).
>
> **DIAGNÓSTICO pedidos que "desaparecen" 2026-06-29 (solo docs/script, NO toca el portal):**
> síntoma = un pedido del portal **aparece** en "Mis Compras"/"Recepción" al crearse pero **días
> después YA NO se ve**. Tras leer todo `src/` + `functions/`, **concluyente**: **el portal NUNCA
> borra pedidos y NO es caché** (no hay **ningún** `deleteDoc`/`.delete()` contra `pedidos_web`/`pedidos`;
> `createWebOrder` hace un `addDoc` REAL y aborta antes de pagar si falla; `cachePedidos` es memoria
> sin TTL que muere al recargar). **Causa raíz:** el **ERP externo `aimunayerp.com`** —que comparte
> el MISMO proyecto/base `sistema-gestion-3b225` y entra por **Admin SDK ignorando las reglas**— al
> **"aprobar"/procesar** el pedido **BORRA** el doc de `pedidos_web` o le **quita los marcadores
> WALA** (`web→false`) o le **cambia el formato del DNI**; como ambas vistas **solo** leen
> `pedidos_web` (Mis Compras por **DNI exacto**, Recepción por **`esPedidoWala`**), deja de verse. Los
> "días después" = cuando el operador del ERP lo procesa. El pagado **probablemente no se pierde** (se
> mueve a la colección `pedidos`): **confirmar** con la nueva opción **`--buscar`** del script
> (`node scripts/diagnostico-pedidos.js --project sistema-gestion-3b225 --buscar PD-XXXX`, busca en
> **ambas** colecciones). **FIX lado WALA** (lectura, **no implementado**): robustecer `esPedidoWala`
> (no depender de `web===true`), buscar también por `userId`/email, guardar copia propia
> (`wala_orders`), distinguir "Aprobado" de "no existe". **FIX raíz (ERP, no es nuestro código):** que
> al aprobar **no borre** sino marque conservando `canalVenta:'Portal Web'` + DNI normalizado +
> `createdAt`. **⚠️ Aviso:** `firestore.rules.produccion:85` tiene `delete: if isAuth()` sobre
> `pedidos_web`; `firebase.json` apunta a la **restrictiva** `firestore.rules:209-213`
> (`delete: if isAdmin()`) — **confirmar que en prod esté la restrictiva**. Detalle completo en
> [FLUJO-PEDIDOS.md](./FLUJO-PEDIDOS.md) (§4-bis).
>
> **"Elementos con diseño" 2026-06-28 (desplegado, `fc8a0d2`):** cierre de la sesión multi-marca.
> Se le da al dueño un **lugar propio** para editar el **nav de categorías de cada marca** (las
> burbujas): **nueva sección admin `/admin/elementos-diseno`** (`AdminElementosDiseno`) con **enlace
> 🎨 "Elementos con diseño"** en el sidebar **debajo de "Recepción de Pedidos"** (gateada por
> `AdminRoute` + `canDesign`), selector de marca y **estructura de pestañas lista para crecer** (hoy:
> "Navegación por categorías"). El corazón es un **componente reutilizable `CategoryNavEditor`**: por
> burbuja edita **qué categoría filtra** (`categoryId`), **nombre** y **miniatura** (subir+recortar
> 1:1 a `brand_nav/{marca}/` o heredar de la categoría); agregar/quitar/reordenar; **"Generar
> automático"** (prellena desde las categorías de los productos de la marca vía `getProductsByBrand`)
> y **"Vaciar"** (`categoryNav=[]` → vuelve al nav automático). Guarda con
> `updateBrand(brandId,{categoryNav})` e invalida las cachés del nav. El **MISMO** editor se embebe
> **inline en el editor visual** (`VisualEditorPanel`) al elegir una sección "Navegación por
> categorías" con marca → cambios **sincronizados** (el `categoryNav` vive en la marca). **Frontend
> DESPLEGADO** por Vercel; **el backend NO requiere redeploy** (solo Firestore). **No toca
> carrito/precios/cobro.** Detalle en §2 (Paso 10).
>
> **Sistema MULTI-MARCA 2026-06-28 (frontend desplegado; falta correr `setup-marcas.js`):**
> cada producto pertenece a **una** marca (`brandId` = doc id de `tienda_brands`) y cada marca
> (**Con Amor / MUSSA / MUEBLERIA**) tiene su **página** (`WALA.PE/ConAmor`, `/MUSSA`,
> `/MUEBLERIA`, vía `/:slug` → `DynamicLandingPage`, **slug case-insensitive**), su **catálogo
> sidebar** filtrado solo a sus productos (faceta `brand` server-side + categoría en cliente), su
> **panel admin** (`AdminMarcaProductos`: asignar/quitar productos en lote + crear-con-marca) y su
> **nav de categorías con miniaturas** (`categoryNav` embebido en la marca) que al hacer clic
> **filtra el catálogo de esa marca sin navegar**. Se implementó en **6 fases (0–5)** cableando
> las 5 piezas que faltaban (el `brandId` ya estaba soportado end-to-end); ver
> [PLAN-MULTIMARCA.md](./PLAN-MULTIMARCA.md). **Frontend DESPLEGADO** por Vercel; **el backend NO
> requiere redeploy** (solo Firestore). **Pendiente del dueño (no de código):** correr
> `scripts/setup-marcas.js --apply` (crea las landingPages MUSSA/MUEBLERIA + backfill `brandId`),
> **configurar las páginas en el editor visual** y **asignar productos a MUSSA/MUEBLERIA**. Brand
> IDs: Con Amor `m3P26agqw7BjeYTDjs6j`, MUSSA `pMujqcyIIDUF2EdSSX5V`, MUEBLERIA
> `RMLsCQGvLo7c3NHgfkLO`. También en esta tanda: **ruteo de slug case-insensitive** (`212bf0f`),
> **sidebar con filtros colapsables** (`ac7e53d`) y **hero centrado** de la caja del subtítulo
> (`bd4b8df`). Commits `281823a`, `a687fd5`, `212bf0f`, `ac7e53d`, `5221ad5`. Detalle en §2 (Paso 9).
>
> **Fixes de pedidos 2026-06-28 (desplegados):** tanda de correcciones del **camino de pedidos**.
> (A — **visibilidad**) los pedidos **no aparecían en "Mis Compras"** porque `createWebOrder`
> guardaba el documento **sin normalizar** mientras el perfil filtra por el **DNI normalizado**
> (`where` exacto) → **FIX:** `createWebOrder` normaliza `clienteNumeroDocumento`/`dni`
> (trim + quita espacios) y guarda `dniRaw`; `searchOrdersByDniInERP` cae al **DNI crudo** si la
> búsqueda normalizada da 0 (rescata históricos). (B) `createWebOrder` estaba en un `try/catch`
> que **solo hacía `console.warn`** → si fallaba el guardado, **abría WhatsApp fingiendo éxito** y
> el pedido se perdía → **FIX:** **toast de error** + **abortar antes del paso de pago**. (C —
> **requiere redeploy, ya hecho por el dueño**) `processCulqiPayment` **cobraba pero NUNCA marcaba
> el pedido pagado** → indistinguible de impago → **FIX:** marca pagado en la rama de éxito con los
> **mismos 7 campos que el `culqiWebhook`** (`pagado`, `estadoPago:"pagado"`, `culqiChargeId`,
> `montoPagado`, `montoPendiente:0`, `pagadoAt`, `metodoPago:"culqi"`), best-effort e idempotente,
> sin tocar montos (el `culqiWebhook` ya lo hacía, pero **su URL no está registrada en el panel de
> Culqi** — pendiente del dueño como respaldo). Además, **enlace 📦 Recepción de Pedidos** en el
> sidebar admin (debajo de "Dashboard Analítica"). **No toca montos/Formik/cobro**; el camino de
> ÉXITO queda idéntico. Commits `de1594b`, `e84b6b1`, `09d86a9`. Detalle en §2 (Paso 8).
>
> **Sesión 2026-06-28 (desplegada):** dos frentes. (1) **Editor de texto enriquecido** en el
> editor visual: bloque reutilizable de alineación / subrayado / color de fondo / link en el
> texto + botón configurable, añadido a TODOS los editores de sección (hero, header, text,
> testimonials, map, marquee, carruseles), 100 % retrocompatible. (2) **Escalabilidad Fases
> 0–4 del plan [ESCALABILIDAD.md](./ESCALABILIDAD.md) desplegadas**: **Fase 1** — `manualChunks`
> parte el bundle de ~2.25 MB (app a ~619 KB) y el dashboard baja **−75 % de lecturas** (refetch
> 15 s→120 s); **Fase 0** — seguridad de pagos **seguro-por-defecto** (idempotencia Culqi por
> lock, firma de webhook y ownership **tras flags apagados**, PayPal **server-side** escrito) +
> **8 índices** + **`firebase/firestore.rules.propuesto`** (guardado, **NO desplegado**;
> precondición: PayPal server-side); **Fase 2** — **pre-agregación** de analítica
> (`analytics_daily` por CF diaria + dashboard que la lee con **fallback** al cálculo en vivo);
> **Fase 3** — **paginación con cursor** del catálogo + **búsqueda Firestore** (`searchTokens`) +
> imágenes lazy; **Fase 4** — **Lingva endurecido** (caché TTL, circuit-breaker) + **observabilidad**
> (error boundary global + Web Vitals → `analytics_events`). **DEPLOY EJECUTADO por el dueño en
> Cloud Shell:** **7 Cloud Functions** + **índices** + **2 backfills** (`createdAt`, que
> **recuperó 77 productos que estaban ocultos**, y `searchTokens`) sobre **123 productos**.
> **Decisiones:** búsqueda = **solo Firestore**, traducción = **Lingva** (no API de pago), CFs de
> dinero **en gen1**, y **deploy de backend = solo Cloud Shell** (`firebase-tools` se corta con
> `Premature close` bajo **Node 24**; automatizarlo desde la PC exigiría **Node 20/22 LTS**). **Las
> reglas vivas siguen 100 % abiertas** en `(default)` por el ERP compartido. **Cerrado y desplegado
> al final de la sesión:** **Recepción de Pedidos** (admin, organizar envíos) **con ENLACE en el
> menú lateral** (📦 Recepción de Pedidos, debajo de "Dashboard Analítica") + embebida + ruta
> `/admin/dashboard/recepcion`; **PayPal server-side** (código **completo y desplegado con el flag
> `VITE_PAYPAL_SERVER_SIDE` en OFF**; **activación PENDIENTE** — falta que el dueño consiga las
> credenciales de su app de PayPal); y un **botón de backfill de analítica** en el dashboard.
> **Flags de pago (estado real):** `CULQI_VERIFY_SIGNATURE=false` (apagado hasta tener el secret
> real de Culqi; `CULQI_WEBHOOK_SECRET` con placeholder pero **inerte**), `ENFORCE_PAYMENT_OWNERSHIP=true`
> **desplegado** (pendiente validar con una compra real). **Pendiente del dueño:** conseguir las
> credenciales de PayPal y activar el flag, activar `CULQI_VERIFY_SIGNATURE` con el secret real,
> validar el ownership con una compra real, y desplegar el `.propuesto` solo cuando PayPal
> server-side esté probado **y resuelta la auth del ERP**. Detalle en §2 (Paso 7).
>
> **Sesión 2026-06-27 (desplegada):** se desplegó a producción una tanda grande de
> **diseño/UX (design system liquid-glass "Aurora Violeta Serena"), tracking de precisión,
> checkout internacional con moneda local/USD y auto-cobro, y varios fixes** — frontend por
> **Vercel** y las **Cloud Functions de cobro por Cloud Shell**. En la misma tanda se sumaron
> y desplegaron, **del lado del cliente**: **"Mis Compras" estilo MercadoLibre** (estado real
> pago + producción, lista + detalle por pedido), **registro de regalos por fecha `/regalar`**
> (drag-and-drop terminado), **carrito "No comprar esta vez"** (selección de items),
> **WhatsApp por marca + Plan B al cerrar Culqi** (número principal "Todo a WALA" + toggle
> multimarca), **tipos de documento DNI/CE/Pasaporte**, **i18n gratis ES/EN/PT**, **foto de
> perfil (Avatar Studio, sin Ready Player Me)**, **captura de cumpleaños** (con import opcional
> desde Google People API) y **carrusel de marcas** (forma/zoom/subir foto). Del lado **admin**
> se sumaron el **módulo Destacados** y un **dashboard de analítica enfocado SOLO en WALA**
> (más vendidos nativos vía `getTopSellingWala` desde `analytics_events`, gráfico Total/App/Web
> y tarjeta "Seguimiento de pedidos"); además la **traducción dinámica del catálogo** (gratis,
> vía Lingva) con banderas SVG, y el visor "Mis Compras" **filtrado a solo pedidos de WALA**.
> Pendiente del
> usuario: **registrar la URL de `culqiWebhook` en Culqi** y **verificar
> `REACT_APP_PAYPAL_CLIENT_ID` en Vercel** (si no, PayPal corre en SANDBOX); y **REDESPLEGAR
> `getPublicGiftRegistry`** por Cloud Shell (fix de wishlist vacía en `/regalar`). Detalle en
> §2 (Paso 6), §7 y en [FUNCIONES-CLIENTE.md](./FUNCIONES-CLIENTE.md). El registro de regalos
> por fecha ("Mis fechas especiales") **ya está implementado y desplegado** (deja de ser solo
> plan): ver [PLAN-FECHAS-ESPECIALES.md](./PLAN-FECHAS-ESPECIALES.md).
>
> **Wala ya está EN PRODUCCIÓN.** El **frontend (Vite) está en vivo en Vercel** (wala.pe, con
> **auto-deploy desde `master`** — la rama de trabajo `fase-0-seguridad` es hoy `master`) y el
> **backend está desplegado en el proyecto correcto y único `sistema-gestion-3b225`** (el
> portal de la tienda y el ERP/CRM "Sistema gestión" comparten ese proyecto y su base
> Firestore). `pruebas-cd728` quedó huérfano y **no se usa**.
>
> Están **hechas y desplegadas las Fases 0–5**: seguridad (claims, economía server-side),
> plataforma Vite + multi-vendor/nicho + búsqueda con facetas, fidelización diaria
> (misiones, racha, ledger, tiers, recompensas y canje), marketplace (subórdenes + comisión +
> envíos + payouts + split de pago Mercado Pago), POD (blueprints + arte de producción) e
> impulso (cofre diario + segmentación RFM + ofertas flash). Encima se sumaron la **venta
> internacional** (documento + país + teléfono internacional, PayPal para compradores del
> extranjero, aviso de envío 7–30 días) y un **dashboard de analítica v2 liquid-glass**
> (`/admin/dashboard`) con heatmap, tráfico, productos más vistos/vendidos y más. El **admin
> claim ya está asignado** y el panel `/admin` opera con normalidad.
>
> 🚨 **Lo más urgente que falta (seguridad — fuga de datos ACTIVA):** las **reglas vivas** de
> Firestore estaban **100 % abiertas** (`allow read, write: if true`). Como mitigación de
> emergencia se aplicó un **bloqueo de borrado (delete-block)**, pero **la lectura anónima de
> datos personales (PII) sigue abierta hoy**. Las **reglas completas ya están escritas y
> listas** (`firebase/firestore.rules.produccion`) pero **AÚN NO se han publicado**:
> publicarlas (con respaldo y prueba en el Rules Playground) es la **prioridad #1**. Ver
> [PLAN-SEGURIDAD-REGLAS.md](./PLAN-SEGURIDAD-REGLAS.md), §6 y §7.
>
> 👉 **Estado de despliegue detallado y "qué toca hacer": [DESPLIEGUE-ESTADO.md](./DESPLIEGUE-ESTADO.md).**
>
> **Super usuario local (solo emulador):** `admin@wala.test` / `wala1234` (admin) ·
> `cliente@wala.test` / `wala1234` (cliente).

---

## 1. Qué es Wala

Wala (marca legal **CATAS GROUP S.A.C. / "CON AMOR"**, también referida como "Regala Con
Amor") es un **marketplace peruano** construido sobre **React + Vite + Firebase +
Capacitor**, con el proyecto Firebase de producción `sistema-gestion-3b225` (portal + ERP
comparten ese proyecto y base Firestore; `pruebas-cd728` NO se usa). Hoy es, en la práctica,
una **tienda mono-marca con personalización print-on-demand 2D** más un sistema de
**fidelización diaria** ya en producción, y el objetivo de la iniciativa es convertirla en
un **marketplace multi-vendedor / multi-nicho estilo MercadoLibre + Temu con fidelización
diaria** (juegos, misiones, rachas, doble moneda canjeable).

Los tres **activos diferenciales** ya construidos son:

1. **Editor POD 2D** (fabric.js) — texto enriquecido, imágenes, cliparts, formas,
   multi-vista frente/espalda, zonas de impresión, undo/redo. Un mini-Printful funcional.
2. **Gamificación de retención** — Wordle diario, Ruleta semanal, Ball Sort, mascota
   KapiPet, retos, referidos y doble moneda (`monedas`/WalaCoins con TTL + `kapiCoins`).
3. **Page-builder no-code** + analytics/heatmap propios.

El diagnóstico completo (stack, capas, deuda técnica) está en
[PLAN-MAESTRO.md §1–§2](./PLAN-MAESTRO.md).

---

## 1.bis Resumen en una tabla: qué está HECHO y qué está PENDIENTE

Vista rápida para el dueño del negocio. El detalle está en las secciones siguientes.

### ✅ Lo que ya está HECHO y EN PRODUCCIÓN

| Bloque | Qué quedó funcionando | Dónde verlo |
|--------|-----------------------|-------------|
| **Fase 0 — Seguridad (código)** | Sin backdoor de admin; admin por *custom claims* (**ya asignado**); economía (monedas/puntos) gobernada desde el servidor, no desde el navegador; 44 tests verdes. | `/admin` (acceso con tu cuenta) |
| **Fase 1 — Plataforma** | Migración a Vite (web más rápida); base multi-vendedor / multi-nicho; **búsqueda con facetas/filtros**; páginas de búsqueda, nicho y panel de vendedor. | `/buscar`, `/nicho/...`, catálogo |
| **Fase 2 / 2b — Fidelización diaria** | Misiones diarias, **racha / check-in**, libro de puntos (`loyaltyLedger`), **niveles (tiers)**, catálogo de recompensas y **canje**. | Cuenta del cliente, misiones, recompensas |
| **Fase 3 — Marketplace** | Pedido con **subórdenes por vendedor**, comisión, **envíos por zona**, **payouts** y **split de pago Mercado Pago**. | `/admin/envios`, `/admin/payouts`, panel vendedor |
| **Fase 4 — POD (base)** | **Blueprints** (plantillas de prenda con áreas de impresión) y utilidades de **arte de producción** (resolución/DPI). | `/admin/blueprints` |
| **Fase 5 — Impulso** | **Cofre diario**, **segmentación RFM** de clientes (VIP/activo/en riesgo/nuevo) y **ofertas flash**. | `/ofertas`, `/admin/flash-offers` |
| **Venta internacional** | Documento + país + **teléfono internacional**, **PayPal** para compradores del extranjero, aviso de envío **7–30 días**. | Checkout |
| **Dashboard de analítica v2** | Panel liquid-glass con **heatmap**, tráfico, **productos más vistos / más vendidos**, origen, páginas, categorías, miniaturas; lecturas optimizadas (cuota). | `/admin/dashboard` |
| **Recepción de Pedidos (organizar envíos)** | Panel **solo-lectura** para preparar envíos: KPIs (por entregar, pendientes de pago, en producción, entregados, monto) + **tarjetas por pedido** con dirección de entrega, cliente, productos y **WhatsApp**. **Enlace en el menú lateral** (📦 Recepción de Pedidos, bajo "Dashboard Analítica") + embebida + ruta directa. | sidebar admin · `/admin/dashboard/recepcion` |
| **"Mis Compras" estilo MercadoLibre** | Lista + **detalle por pedido** con **estado real** (pago + producción), método de pago, productos, dirección y **WhatsApp al asesor de la marca**. **Fix 2026-06-28 (`de1594b`):** los pedidos ya **aparecen** (se normaliza el DNI al crearlos + fallback al DNI crudo para rescatar históricos); y si el guardado falla **ya no se abre WhatsApp fingiendo éxito**. **Fix 2026-06-28 (`e84b6b1`):** un pedido pagado con **Culqi ya queda marcado como pagado**. **2026-06-29 (`e9ec48d`):** la **tarjeta del pedido es clickeable completa** (al detalle). | `/cuenta/pedidos`, `/cuenta/pedidos/:id` |
| **Base interna FUENTE DE VERDAD de pedidos (`wala_pedidos` + `estadoWala`)** | **2026-06-29 (`68447dc`, `1d8f639`):** colección WALA-only **`wala_pedidos`** (espejo que el ERP NO toca) con su **propio `estadoWala`** (`pendiente_pago→pagado→en_preparacion→enviado→entregado`) que el portal **NO degrada**; "Mis Compras"/"Recepción" la leen como **PRIMARIA** y muestran el **estado más avanzado**. **Frontend desplegado**; **el pago la marca pagada solo tras redeploy de las 3 functions de pago** (pendiente del dueño). | `/cuenta/pedidos`, `/admin/dashboard/recepcion` |
| **Regalos por fecha "Mis fechas especiales"** | Registro de regalos público con **drag-and-drop** (arrastre por Pointer Events, sin parpadeo). **2026-06-29 (`4f775a4`):** cada fecha es una **tarjeta grande de persona** con **foto circular** (subida en la cuenta), nombre, relación, ocasiones y fecha. **Frontend desplegado**; la foto llega tras **redeploy de `getPublicGiftRegistry`** (pendiente del dueño). | `/regalar/:referralCode`, wishlist |
| **Compra directa (ficha de producto)** | **2026-06-29 (`fbb53ab`):** botones **"Comprar"** y **"Comprar todo el carrito"** que van **directo a la pasarela** (`/checkout`), reusando la selección de items "No comprar esta vez" (sin tocar el flujo de "Agregar al carrito"). | ficha de producto · `/checkout` |
| **Carrito "No comprar esta vez"** | Elegir qué pagar ahora y qué guardar para después sin borrar; el resto persiste tras pagar. | `/carrito`, `/checkout` |
| **Modo noche (claro/oscuro/sistema)** | **2026-06-29 (`a442251` + `649a42e`):** tema **claro/oscuro/sistema** en toda la web + admin, **interruptor luna/sol** en el Header, persistencia (`localStorage` `wala-theme`) y sin parpadeo al cargar; respeta los fondos inline del admin y garantiza contraste (2 pases). **Frontend desplegado**; NO requiere backend. | toda la web · Header |
| **Cuenta — navegación de tabs** | **2026-06-29 (`e9ec48d`):** tabs en **2 líneas** (desktop) + scroll con **"asomo"** (móvil, pista de deslizar). | `/cuenta/*` |
| **WhatsApp por marca + Plan B** | Número por marca, número principal "Todo a WALA" + toggle multimarca; al cerrar Culqi sin pagar, terminar por WhatsApp. | `/checkout`, `/admin/marcas` |
| **Sistema MULTI-MARCA (Con Amor / MUSSA / MUEBLERIA)** | **1 producto = 1 marca** (`brandId`); cada marca con **página propia** (`WALA.PE/ConAmor`, `/MUSSA`, `/MUEBLERIA`, slug case-insensitive), **catálogo sidebar filtrado**, **panel admin** (asignar/quitar en lote + crear-con-marca) y **nav de categorías con miniaturas** que filtra el catálogo de la marca sin navegar. **Frontend desplegado**; falta que el dueño corra `setup-marcas.js`, configure las páginas y asigne productos a MUSSA/MUEBLERIA. | `/:slug`, `/admin/marcas`, panel por marca |
| **"Elementos con diseño" (admin)** | Lugar propio para personalizar **elementos de diseño por marca**. **2026-06-29 (`425e9ce`):** **catálogo de tarjetas con slug propio por elemento** (`/admin/elementos-diseno/{slug}`); el nav de categorías se edita por marca (qué filtra / nombre / miniatura) y gana **"Estilo del nav"** (alineación + estático/slider, `categoryNavStyle` en `tienda_brands`). | `/admin/elementos-diseno` |
| **i18n gratis (ES/EN/PT) + perfil/cumpleaños** | Toggle de idioma (traductor nativo del navegador), tipos de documento DNI/CE/Pasaporte, **Avatar Studio** (sin Ready Player Me) y **captura de cumpleaños** (import opcional desde Google). | Header, `/cuenta/perfil`, checkout |
| **Despliegue real** | **Frontend en Vercel** (wala.pe, auto-deploy desde `master`); **Cloud Functions** e **índices** desplegados en `sistema-gestion-3b225`. | wala.pe |
| **Seguridad (mitigación viva)** | **Bloqueo de borrado (delete-block)** aplicado a las reglas vivas para frenar el destrozo anónimo. | Consola Firebase |

### ⬜ Lo que está PENDIENTE (por prioridad)

| Prioridad | Pendiente | Por qué importa |
|-----------|-----------|-----------------|
| **1 — CRÍTICA** | **Publicar las reglas de seguridad completas** (`firebase/firestore.rules.produccion`). | Hoy la **lectura anónima de datos personales (PII) sigue abierta**: cualquiera en internet puede leer clientes/pedidos. Es la única fuga grave que queda. |
| **1.bis — Alta (redeploy del ciclo 2026-06-29)** | **Redeploy de functions**: (a) las **3 de pago** (`processCulqiPayment`, `culqiWebhook`, `capturePaypalOrderSecure`) para que el pago marque `estadoWala:"pagado"` en `wala_pedidos`; (b) **`getPublicGiftRegistry`** para que la **foto/roleKey/gender** lleguen a `/regalar`. Por Cloud Shell. | El **frontend ya está desplegado**, pero hasta el redeploy el pago no marca el estado en la fuente de verdad y las tarjetas de `/regalar` no muestran foto. |
| **2 — Alta** | **Reestructurar el dashboard en páginas por área** (resumen, heatmap, productos, origen, páginas, categorías) con rutas propias; **arreglar el iframe de preview** (doble init de Firebase) y el **warning `willReadFrequently`** del canvas del heatmap. | El dashboard es hoy una sola página muy pesada; dividirlo lo hace usable y corrige errores de consola. |
| **3 — Media** | **Push v2 (FCM)**, **Cloud Scheduler / cron** de segmentación y campañas, **Algolia / Typesense** (búsqueda externa), **integración del editor POD** (arte / PDF de producción), **rol `vendor` por claims** y **scoping por dueño/rol en las reglas (Fase C)**. | Son mejoras de alcance y automatización sobre lo ya construido; no bloquean la operación diaria. |

El desglose completo de pendientes (incluido lo bloqueado por servicios externos) está en §7;
los riesgos de seguridad residuales, en §6.

---

## 2. Cronología del trabajo realizado en esta iniciativa

Todo lo siguiente se realizó **en esta iniciativa**, en la rama `fase-0-seguridad` (hoy
`master`). El núcleo se construyó y **verificó en el emulador** y **ya está desplegado a
producción** (frontend en Vercel; functions e índices en `sistema-gestion-3b225`) — ver §5
para el estado exacto de despliegue. El orden refleja la secuencia real de trabajo.

### Paso 1 — Análisis multi-agente del repositorio *(✅ HECHO)*

- Auditoría estructurada de los **10 subsistemas** del repo mediante agentes, volcada en
  [`docs/wala/analisis-subsistemas.json`](./analisis-subsistemas.json) (1419 líneas).
- Resultado: el diagnóstico honesto del estado real (tienda mono-marca, economía en
  cliente, reglas Firestore desalineadas, CRA deprecado, `pruebas-cd728` como prod) que
  alimentó el plan maestro y el runbook de seguridad.

### Paso 2 — Respaldo, documentación y runbooks operativos *(✅ HECHO)*

- Commit **`c7c29ce`**: se creó toda la base documental y operativa de `docs/wala/` y
  `ops/`:
  - Documentos: `PLAN-MAESTRO.md`, `BASELINE-PRODUCCION.md`, `MODELO-DATOS.md`,
    `FASE-0-SEGURIDAD.md` (runbook con 11 hallazgos **H-01..H-11**), `DESPLIEGUE.md`,
    `README.md`, `analisis-subsistemas.json`.
  - Runbooks PowerShell en `ops/`: respaldo (`ops/backup/`), restauración
    (`ops/restore/`) y despliegue (`ops/deploy/`).
  - Infraestructura de despliegue: `firestore.indexes.json` (46 líneas) y ajuste de
    `firebase.json`.
- Filosofía fijada: **producción primero se respalda, después se toca** (ver
  [README.md](./README.md)).

### Paso 3 — Fase 0: Estabilización y seguridad *(✅ HECHO — parcial sobre 11 hallazgos)*

Tres commits que atacan los hallazgos críticos del runbook
[FASE-0-SEGURIDAD.md](./FASE-0-SEGURIDAD.md):

- **`3d53501`** — elimina el backdoor admin, introduce **custom claims**, valida pedidos
  ERP y reescribe reglas Firestore/Storage. Cierra/avanza **H-01, H-03, H-07, H-08, H-09**.
- **`9e84990`** — **economía server-authoritative**: mueve earn/spend/freeze/claim a Cloud
  Functions (+360 líneas en `functions/index.js`), adelgaza `AuthContext.jsx`, reescribe
  ruleta y ballSort para no escribir saldo desde el cliente. Avanza **H-02, H-05, H-06**.
- **`f0e4aa0`** — H-03 reforzado + fixes de revisión adversarial + **tests de economía**
  (`functions/test/economyLogic.test.js`, 44/44 verdes), extrae `functions/economyLogic.js`
  y endurece reglas.

Estado por hallazgo en §6. El **password = DNI** quedó resuelto migrando a magic link / set-password.

### Paso 4 — Fase 1: Plataforma y datos base *(🔧 EN PROGRESO)*

Cuatro commits que preparan el terreno multi-vendor y la velocidad:

- **`a3c4d66`** — **migración CRA → Vite** (build verificado). `public/index.html` → raíz,
  `package.json`/`package-lock.json` reescritos, `vite.config.js` nuevo (dev en puerto
  **3000**), `vercel.json` ajustado.
- **`a652f60`** — **base multi-vendor / multi-nicho + capa de búsqueda** (aditivo, no
  destructivo): `src/constants/marketplace.js` (defaults vendor `casa`, nicho
  `regala-con-amor`, `fulfillmentType`), servicios `niches.js`/`vendors.js`/`search.js` y
  extensión de `products.js`, `scripts/backfill-vendor-niche.js`, +1 línea en
  `firebase/firestore.rules`.
- **`f188260`** — **fix de runtime**: elimina los `require()` CommonJS que rompían con Vite
  en `Footer.jsx`, `TiendaPage.jsx` y `firebase/config.js`.
- **`0f2414f`** — **cablea búsqueda / nichos / vendedor a la UI**: rutas/páginas nuevas
  `SearchPage.jsx`, `NichePage.jsx`, `VendorPanel.jsx` y su registro en `App.jsx`.

### Paso 5 — Fases 2, 2b, 3, 4 y 5 (verificadas en emulador, luego desplegadas) *(✅ HECHO)*

Con la plataforma base lista, se construyó y **verificó E2E sobre el emulador `demo-wala`** el
núcleo del marketplace y la fidelización, y luego se **desplegó a producción** (functions e
índices en `sistema-gestion-3b225`; frontend en Vercel):

- **Fase 2 / 2b — Fidelización unificada (✅ base, local):** economía sobre `loyaltyLedger`,
  misiones/rachas y configuración de fidelización; consolidación en 2b.
- **Fase 3 — Marketplace multi-vendor (✅ core + split de pago, local):**
  `createOrderWithSubordersSecure` (recompute server-side, agrupado por vendedor, comisión y
  payout), colecciones `orders`/`subOrders`/`shippingZones`/`payouts`, UI `/admin/envios`,
  `/admin/payouts` y `VendorPanel`, y **split de pago Mercado Pago Marketplace en modo
  simulado** (`createCheckoutPreferenceSecure`, `confirmPaymentSecure`, `mercadoPagoWebhook`,
  rutas `/checkout-demo` y `/pago-demo/:orderId`). Detalle en §3.1.
- **Fase 4 — POD / arte de producción (🔧 base, local):** colección `blueprints` (CRUD
  `/admin/blueprints`, seed `bp-polo`) y `src/utils/productionArt.js` (DPI/export/validación).
- **Fase 5 — Impulso e inteligencia (✅ base, local):** `openDailyChestSecure` (cofre
  diario), `computeSegmentsSecure` (RFM solo admin) y `flashOffers` (CRUD `/admin/flash-offers`
  + vitrina `/ofertas`).

Verificado con el super usuario local `admin@wala.test` / `wala1234` (y cliente
`cliente@wala.test` / `wala1234`), y luego **desplegado a producción**. Después se sumaron la
**venta internacional** (commit `8191f5a`) y el **dashboard de analítica v2 liquid-glass**
(commits `ea25a82` y `84603db`). Lo que aún falta (publicar reglas, cobro real, búsqueda
externa, push v2, schedulers, integración editor/checkout, reestructurar el dashboard) está en §7.

### Paso 6 — Sesión 2026-06-27 — desplegado *(✅ HECHO — en producción)*

Sesión de **diseño/UX, tracking de precisión, checkout internacional y fixes**, toda
**desplegada a producción**: el **frontend** por **Vercel** (auto-deploy desde `master`) y las
**Cloud Functions** del checkout internacional por **Cloud Shell** a `sistema-gestion-3b225`.
Ocho commits (del CHANGELOG raíz, entrada 2026-06-27):

1. **`a4c884e` — Design system liquid-glass "Aurora Violeta Serena":** nuevo `src/theme/`
   (`tokens.css` glass/gradiente/violeta/chart + `motion.js` con presets) y librería
   `src/components/ui/` (11 componentes: GlassCard, GlassButton, GlassPanel, GlassModal,
   GlassInput, Badge, AuroraBackground, AnimatedNumber, Reveal/Stagger, GlassTooltip) +
   vitrina viva en **/admin/design**. Overhaul del **Dashboard/Analítica/Zonas calientes**:
   hub con KPIs animados + tendencia + conversión, **DashProductos** (vistos vs vendidos ERP),
   **DashCategorias** (líneas vendidas + vistas + conversión), nueva **DashUso**
   (**/admin/dashboard/uso**) y heatmap con mini-tarjetas + nº de clics + preview + etiquetas
   con emoji. (Esto **adelanta la Prioridad 2** de reestructurar el dashboard, ver §7.)
2. **`95c99d1` — Tracking de precisión (Pass 2):** `schema.js` +8 tipos de evento
   (`category_view`, `collection_view`, `editor_open`/`editor_save`, `minigame_start`/
   `minigame_complete`, `mission_complete`, `wishlist_add`); `tracker.js` +7 funciones;
   `eventData` enriquecido (`categoryId`/`collectionId`/`lineaProducto`) en `product_view`/
   `add_to_cart`/`purchase_complete`; agregaciones nuevas en `adminAnalytics`
   (`topCategoriesByViews`, `topCollectionsByViews`, `featureUsage`); eventos cableados en
   NichePage/EditorPage/Ruleta/BallSort/MisionesPage.
3. **`b7508c1` — Pulido del storefront con el design system:** PremiumProductCard
   (glass + hover + entrada al viewport + badge de descuento), esqueletos glass,
   HeroBanner/BrandMarquee/BestSellersRow (AuroraBackground + GlassButton + Reveal/Stagger),
   transición de página solo-opacidad, Header/BottomNav glass; Checkout/Cart/Perfil/
   CuentaPedidos en **modo conservador** (sin tocar la lógica de compra).
4. **`8fa1888` — Fix del checkout:** el botón de pago no avanzaba porque Formik bloqueaba en
   silencio (validación de DNI de 8 dígitos para Perú). Se **relajó la validación del
   documento** (≥3 caracteres, cualquier tipo) + aviso (toast) y scroll al primer campo con error.
5. **`8bb7293` — Auto-cobro por país + moneda local/USD:** `src/constants/currencies.js`
   (país→moneda con nombre natural), `src/services/fx.js` (lee `config/fx` con fallback +
   margen); CheckoutPage muestra la **moneda local** + "Pagarás X USD por PayPal" y **auto-abre
   Culqi** (Perú); PaypalCheckout cobra en `amountUsd` + corrige el update a `pedidos_web`.
   **Cloud Functions escritas y DESPLEGADAS por Cloud Shell:** `culqiWebhook` (marca
   `pedidos_web` pagado, idempotente), **recálculo de monto server-side** en
   `processCulqiPayment` (**cierra H-11**), `updateFxRate` (cron diario que puebla `config/fx`
   desde una API de FX).
6. **`c540614` — Fix de moneda local:** `penToLocal` indexaba por país pero `config/fx`
   guarda por código de moneda; + guard de monto mínimo de PayPal (1 USD).
7. **`33285b4` — Fix del parpadeo del menú del header:** cacheo de `storeConfig` en
   `localStorage` + no mostrar el menú por defecto mientras carga; + guarda del permiso de
   notificaciones (solo lo pide si `Notification.permission === 'default'`).
8. **`cf47546` — Wishlist en el header:** badge con la cantidad de productos en el corazón +
   tira de miniaturas en el desplegable de favoritos.

**Además, del lado del cliente (mismo despliegue, frontend por Vercel):**

- **"Mis Compras" estilo MercadoLibre:** lista (`CuentaPedidosPage`, `/cuenta/pedidos`) +
  **detalle por pedido** nuevo (`CuentaCompraDetallePage`, `/cuenta/pedidos/:id`) con un
  **estado de compra real** que combina **etapa de producción + pago** en
  `src/utils/estadoCompra.js` (`derivarEstadoCompra`, badge de color + etiqueta de método de
  pago). El detalle lee el pedido **CRUDO por id en ambas colecciones** (`getOrderByIdAnyCollection`
  sobre `pedidos` y `pedidos_web`) con fallback al `_raw` que `usePedidos` ahora adjunta a cada
  pedido normalizado. Incluye productos con miniatura, dirección, resumen (solo lectura) y
  **WhatsApp al asesor de la marca**.
- **Registro de regalos por fecha `/regalar/:referralCode` ("Mis fechas especiales"):**
  drag-and-drop **terminado y rediseñado** (`GiftRegistryPage`), miniaturas asignadas por
  fecha, fechas rotuladas con **nombre del tercero + relación** (incluido el cumpleaños del
  propio dueño), datos mínimos vía CF `getPublicGiftRegistry`. **Deja de ser solo plan.**
- **Carrito "No comprar esta vez":** flag `selected` en `CartContext`; el checkout solo cobra
  y registra lo seleccionado y conserva el resto tras pagar.
- **WhatsApp por marca + Plan B al cerrar Culqi:** `whatsappNumber` por marca en
  `tienda_brands`; al cerrar el modal de Culqi sin pagar aparece una tarjeta con **2 botones**
  (reabrir Culqi vía remontaje / terminar por WhatsApp); número principal **"Todo a WALA"**
  (`whatsapp_number_main`, fábrica `+51924426791`) y **toggle multimarca** (`whatsapp_multimarca`),
  ambos en `/admin/marcas`. Fix del **doble-popup** del auto-open de Culqi.
- **Tipos de documento DNI/CE/Pasaporte:** `src/constants/documentTypes.js` (Perú = lista
  cerrada; extranjero = campo abierto).
- **i18n gratis ES/EN/PT:** `src/i18n/dictionaries.js` + `src/contexts/LanguageContext.jsx`
  (fija `<html lang>` para el traductor nativo del navegador) + `LanguagePopup` y toggle en
  el Header. CTA **"Al carrito"** entre los strings traducidos.
- **Foto de perfil — Avatar Studio (sin Ready Player Me):** `src/components/profile/AvatarStudio.jsx`
  reemplaza el viejo avatar 3D.
- **Captura de cumpleaños (`birthDate`):** en `CompleteProfilePage` y `SubscriptionSurveyPage`,
  con **import opcional desde Google People API** (best-effort, no rompe el login;
  `src/services/firebase/auth.js`).
- **Carrusel de marcas (forma/zoom/subir foto):** `BrandMarquee` con forma de marco
  (círculo/cuadrado/estrella/pentágono), zoom y posición por item; subida de logo en
  `/admin/marcas`.
- **i18n — traducción DINÁMICA del catálogo (gratis):** `src/services/translate.js` traduce
  nombres/descripciones en runtime vía instancias públicas de **Lingva** (Google Translate
  gratis, con caché en `localStorage`, tolerante a fallos) usando el hook/componente
  `src/i18n/useTranslatedText.js` (`useTranslatedText` + `<T>`). El toggle del Header usa
  **banderas SVG** propias (`src/components/i18n/FlagIcon.jsx`, España/EEUU/Brasil; los emoji
  de bandera no renderizan en Windows). Esto **amplía** la base i18n gratis ES/EN/PT ya
  desplegada (diccionarios + traductor nativo del navegador).
- **"Mis Compras" filtrado a SOLO pedidos de WALA:** `usePedidos.js` filtra el ERP con
  `esPedidoWala` (`canalVenta:'Portal Web'`, o `web:true`/`activador:'portal_web'`/
  `vendedor:'Portal Web'`) para que el cliente vea únicamente sus compras hechas por el portal.

**Del lado del ADMIN (mismo despliegue):**

- **Módulo Destacados + más vendidos NATIVOS de WALA:** nueva fuente `getTopSellingWala`
  (`src/services/salesAnalytics.js`) que lee las compras propias de WALA desde
  `analytics_events` (`type:'purchase_complete'`) y rankea productos (cruzados SOLO contra
  `productos_wala`) y líneas. Admin **`/admin/destacados`** (`AdminDestacados.jsx`) para
  destacar/quitar/reordenar + sugerencias del top de ventas; sección reutilizable
  **`featured_carousel`** en el editor de páginas (render en `TiendaPage`).
- **Dashboard de analítica a SOLO-WALA:** `DashProductos`/`DashCategorias`/`MasVendidosSection`
  leen ventas/ingresos/pedidos/unidades/productos/líneas desde `getTopSellingWala`; el hub
  (`DashPaginas`) trae el gráfico de tráfico con **toggle Total/App/Web** y la tarjeta
  **"Seguimiento de pedidos (WALA)"**. (Sigue adelantando la **Prioridad 2**, ver §7.)
- **Fixes menores:** cursor del input en `/admin/marcas` y gráfica de tendencia con datos
  multi-día.

**Estado de despliegue real (2026-06-27):** lo anterior está **EN PRODUCCIÓN** — hay **mucho
ya desplegado** (frontend por Vercel + las Cloud Functions de cobro por Cloud Shell). Además,
en esta sesión:

- **Seguridad — reglas publicadas y REVERTIDAS:** se publicaron reglas de seguridad y se
  **revirtieron** porque rompían el ERP (el ERP **no usa Firebase Auth**; sus peticiones llegan
  **sin identidad**). Queda un **track de seguridad pendiente** (App Check o migrar el ERP a
  Firebase Auth) además de la fuga de PII por reglas abiertas (§6). Se **sembró `config/fx`**
  con tasas en vivo.
- **Pendiente del usuario (no de código):** **registrar la URL de `culqiWebhook`** en el panel
  de Culqi (estaba caído) y **verificar que `REACT_APP_PAYPAL_CLIENT_ID` esté en Vercel** (si
  no, **PayPal corre en SANDBOX**).

**Plan nuevo (POR IMPLEMENTAR):** se redactó [PLAN-FECHAS-ESPECIALES.md](./PLAN-FECHAS-ESPECIALES.md)
con el plan completo de **"Mis fechas especiales"** (registro de regalos por fecha, ruta
pública `/regalar/:referralCode`, con cuidado de privacidad: **no publicar hasta cerrar reglas
+ Cloud Function**) y **"Agregar todo al carrito"** en la wishlist. Ver §7 (Prioridades).

### Paso 7 — Sesión 2026-06-28 — Escalabilidad Fases 0–4 + texto enriquecido *(✅ HECHO — desplegado)*

Sesión de dos frentes: el **editor de texto enriquecido** y el **despliegue de las Fases 0–4
del plan de [ESCALABILIDAD.md](./ESCALABILIDAD.md)** (que ya existía como análisis; aquí se
implementó y desplegó). El **frontend** salió por **Vercel** (auto-deploy desde `master`); las
**Cloud Functions, los índices y dos backfills los EJECUTÓ EL DUEÑO por Cloud Shell** sobre
`sistema-gestion-3b225`. **Las reglas vivas siguen 100 % abiertas** en `(default)` por el ERP
compartido (ver §6). Detalle por commit en el [CHANGELOG.md](../../CHANGELOG.md) (entrada
2026-06-28).

**(1) Editor de texto enriquecido (`ae30cfa`):** bloque reutilizable **`TextStyleControl`**
(alineación izquierda/centro/derecha, **subrayado**, **color de fondo**, **link en el texto**) +
**`ButtonFieldsControl`** (texto/enlace del **botón**), añadidos a **todos** los editores de
sección con texto (hero, header, text, testimonials, map, marquee, carruseles) en
`VisualEditorPanel.jsx`. El render (`textStyleUtils.jsx`, `<TextoSeccion>`/`<BotonSeccion>`)
aplica los estilos y pinta el botón; `TiendaPage.jsx` pasa la config a cada sección.
**100 % retrocompatible:** con campos vacíos, las secciones se ven igual que hoy.

**(2) Escalabilidad — qué se desplegó por fase del plan:**

- **Fase 1 — quick wins (`1a82a0a`, frontend por Vercel):** `vite.config.js` con `manualChunks`
  parte el `index` de **~2.25 MB** en `react-vendor`/`firebase-vendor`/`charts`/`motion`/`paypal`/
  `fabric` (chunk de app a **~619 KB**, cacheable entre deploys); **dashboard −75 % de lecturas**
  (`AdminUsuariosAnalyticsPage` con refetch **15 s → 120 s**, sin background, `staleTime` 60 s).
- **Fase 0 — seguridad de pagos SEGURO POR DEFECTO (`1a82a0a`):** **S-4** idempotencia de
  `processCulqiPayment` (lock `culqiCharges/{tokenId}`); **S-2** firma del webhook Culqi tras el
  flag `CULQI_VERIFY_SIGNATURE` (OFF); **S-3** ownership de la confirmación tras
  `ENFORCE_PAYMENT_OWNERSHIP` (OFF); **S-1** PayPal **server-side** (`createPaypalOrderSecure`/
  `capturePaypalOrderSecure`) **escrito pero aún NO cableado al cliente**; **+8 índices**; **NUEVO
  `firebase/firestore.rules.propuesto`** (guardado, **NO desplegado** — cierra el `update`
  cliente-side de `pedidos_web`, **precondición** de tener PayPal server-side, y valida el
  `create` de `analytics_events`). Pagos verificados **sin cambio de comportamiento** con flags
  apagados.
- **Fase 2 — pre-agregación de analítica (`0011b70`, `8de5b50`):** CF **`aggregateAnalyticsDaily`**
  (`onSchedule` gen2, 00:20 Lima, query paginada por cursor, idempotente) escribe
  **`analytics_daily/{YYYY-MM-DD}`** ya sumado; + **`aggregateAnalyticsDailyBackfill`** (callable
  solo-admin). El dashboard (`analyticsDaily.js` + `dashShared.jsx`) lee N docs/día con
  **FALLBACK** a `getGlobalAnalytics` legacy si no hay docs. `getTopSellingWala` usa el índice
  `(type, clientTsMs)` server-side en vez de `limit(3000)`+memoria.
- **Fase 3 — catálogo y búsqueda (`37fc015`, `21ecbc6`):** **paginación con cursor** del catálogo
  (`getStoreProductsPage` + `useInfiniteQuery` en `TiendaPage` + `ProductGrid` con IntersectionObserver;
  **red de seguridad**: si la 1ª página sale vacía cae al catálogo completo, nunca queda vacío);
  **búsqueda SOLO Firestore** (`nameLower`+`searchTokens`, con fallback a memoria); **imágenes
  lazy** (`OptimizedImage`, `HeroBanner` `fetchpriority=high`). Scripts `backfill-product-createdat.js`
  y `backfill-search-tokens.js`.
- **Fase 4 — i18n + observabilidad (`21ecbc6`):** **Lingva endurecido** (caché v2 TTL 30 d,
  circuit-breaker por instancia, timeout 6 s, siempre cae al original); **`AppErrorBoundary`** global
  + **Web Vitals** (LCP/CLS) → `analytics_events` (`client_error`/`web_vital`, sin PII, throttle).
- **Fixes para Cloud Shell (`ceed174`, `66606dc`):** se quitaron índices inválidos (compuesto de
  un solo campo / `fieldPath` repetido) y los backfills pasaron a la **API modular** de
  `firebase-admin` (`applicationDefault()`+`getFirestore()`).

**(3) DEPLOY EJECUTADO por el dueño (Cloud Shell, `sistema-gestion-3b225`):** **7 Cloud Functions**
(incluye las de pagos con flags OFF, la CF gen2 de analítica y el callable de backfill) +
**índices** + **2 backfills** sobre **123 productos**: `createdAt` (**recuperó 77 productos que
estaban ocultos** del storefront por no tener fecha) y `searchTokens` (habilita la búsqueda
Firestore).

**(4) Decisiones de arquitectura:** **búsqueda = solo Firestore** (sin Algolia/Typesense por
ahora), **traducción = Lingva** (no Google Cloud Translation v3 de pago, solo se endurece la vía
gratis), **CFs de dinero en gen1** (Culqi/PayPal se mantienen en gen1 por estabilidad; gen2
queda para mayor tráfico).

**(5) Seguridad — reglas sin cambios:** **las reglas vivas siguen 100 % abiertas** en `(default)`
porque el **ERP comparte el proyecto y NO usa Firebase Auth**; el `.propuesto` está guardado pero
**NO desplegado**. Ver §6/§7.

**✅ Cerrado y desplegado al final de la sesión (`5903a6a`, `09d86a9`):**

- **Recepción de Pedidos (admin) — organización de ENVÍOS:** área **solo-lectura** para
  **organizar envíos** del portal WALA (`RecepcionPedidos.jsx` + `DashRecepcion.jsx` +
  `RecepcionPedidos.module.css`), sobre el hook `useAdminWalaOrders` y la capa `adminOrders.js`
  que lee `pedidos_web`+`pedidos` del ERP (solo los pedidos del portal, regla `esPedidoWala`).
  Tiene **tres accesos**: (1) **ENLACE en el menú lateral** — **📦 Recepción de Pedidos**, ubicado
  **debajo de "Dashboard Analítica"** en el grupo *Diseño de Tienda*
  (`src/components/AdminLayout/AdminLayout.jsx`); (2) **embebida al final** del dashboard de
  analíticas; y (3) **ruta directa** `/admin/dashboard/recepcion`. **Desplegado.**
- **PayPal server-side:** el **código está COMPLETO y DESPLEGADO con el flag `VITE_PAYPAL_SERVER_SIDE`
  en OFF** — `PaypalCheckout.jsx` invoca `createPaypalOrderSecure`/`capturePaypalOrderSecure` solo
  cuando el flag está en `'true'` (OFF por defecto, **sin cambio de comportamiento**). La **ACTIVACIÓN
  quedó PENDIENTE** (ver abajo): falta que el dueño consiga las **credenciales de su app de PayPal**.
  Se **removieron del `.env` unas credenciales de ejemplo** que se habían puesto por error (inertes
  porque el flag está OFF).
- **Botón de backfill de analítica** en el dashboard (`BackfillAnaliticaButton.jsx`) que dispara
  `aggregateAnalyticsDailyBackfill`. **Desplegado.**

**🔧 Flags de pago — estado real desplegado (`functions/.env.sistema-gestion-3b225`):**

- **`CULQI_VERIFY_SIGNATURE=false`** (S-2): se intentó con un **secret placeholder**, pero quedó
  **apagado** hasta tener el **secret real de Culqi**. `CULQI_WEBHOOK_SECRET` aún tiene un
  **placeholder** pero es **INERTE** (con `verify=false` no se valida ninguna firma).
- **`ENFORCE_PAYMENT_OWNERSHIP=true`** (S-3) **desplegado**. **Pendiente validar con una compra real.**

**⬜ Pendiente del DUEÑO (no de código):**

- **Conseguir las credenciales de PayPal y activar el flujo server-side:** crear/usar su app en
  `developer.paypal.com`, obtener **Client ID + Secret**, ponerlos en **`functions/.env`**
  (`PAYPAL_CLIENT_ID`/`PAYPAL_SECRET` + `PAYPAL_ENV='live'`), **redeploy** de las CFs, probar en
  sandbox y recién entonces **`VITE_PAYPAL_SERVER_SIDE=true` en Vercel** (+ redeploy del frontend).
- **Activar la firma del webhook Culqi (`CULQI_VERIFY_SIGNATURE=true`)** con el **secret real de Culqi**.
- **Validar `ENFORCE_PAYMENT_OWNERSHIP=true`** (ya desplegado) con una **compra real**.
- **Desplegar `firestore.rules.propuesto`** SOLO cuando PayPal server-side esté probado (cierra
  `pedidos_web`) **y** resuelto el track del ERP (App Check / migrar el ERP a Firebase Auth).
  **No desplegar el `.propuesto` sin resolver la auth del ERP / sin permiso.**

**🛠️ Nota de despliegue (automatización evaluada y descartada por ahora):** se evaluó que Claude
desplegara el backend **directo desde la PC del dueño**, pero **`firebase-tools` es INCOMPATIBLE con
Node 24** (instalado localmente): su cliente HTTP se corta con `Premature close` aunque el `fetch`
nativo de Node y `curl` SÍ funcionan contra los mismos endpoints — **no** es la red, ni el antivirus,
ni la clave, ni los permisos. **Decisión:** seguir desplegando por **Google Cloud Shell** (copiar/pegar);
para automatizarlo desde la PC en el futuro habría que **instalar Node 20/22 LTS**.

### Paso 8 — Sesión 2026-06-28 — Fixes del camino de pedidos *(✅ HECHO — desplegado)*

Tanda de **correcciones del camino de pedidos** (visibilidad en "Mis Compras" y estado de pago),
sobre la misma sesión 2026-06-28. El **frontend** salió por **Vercel** (auto-deploy desde
`master`); el **fix de Culqi (bug C) requiere redeploy del backend**, que **ya hizo el dueño**
por Cloud Shell (`firebase deploy --only functions:processCulqiPayment`). **No toca montos,
Formik ni el camino de cobro** — el camino de ÉXITO queda idéntico. Tres commits: `de1594b`,
`e84b6b1`, `09d86a9`. Detalle por commit en el [CHANGELOG.md](../../CHANGELOG.md) (entrada
2026-06-28, "FIXES DE PEDIDOS").

**Bug A — visibilidad de pedidos en "Mis Compras" (`de1594b`):** los pedidos **no aparecían**
porque `createWebOrder` (`src/services/erp/firebase.js`; la creación que comparten
WhatsApp/Culqi/PayPal) guardaba el documento **SIN normalizar**, mientras el perfil filtra por el
**DNI normalizado** con un `where` exacto → nunca casaban. **FIX:** `createWebOrder` **normaliza**
`clienteNumeroDocumento` y `dni` (trim + quita espacios, igual que `createOrderInERP`) para que
casen con el filtro del perfil, y **conserva el valor tecleado en `dniRaw`**. `searchOrdersByDniInERP`
cae a un **fallback con el DNI crudo** si la búsqueda normalizada da 0 resultados (**rescata los
pedidos históricos** guardados sin normalizar).

**Bug B — no tragar el fallo de guardado (`de1594b`):** `createWebOrder` estaba en un `try/catch`
que **solo hacía `console.warn`** → si el guardado fallaba, el flujo **abría WhatsApp fingiendo
éxito** y el pedido se perdía (el cliente creía que había comprado y nada quedaba guardado).
**FIX:** en `CheckoutPage.jsx`, si `createWebOrder` no devuelve `id` se muestra un **toast de
error** y se **aborta ANTES del paso de pago** (no se abre WhatsApp ni Culqi/PayPal). El camino de
ÉXITO queda idéntico; sin tocar montos/Formik/cobro.

**Bug C — Culqi marca el pedido como pagado (`e84b6b1`, requiere redeploy ya hecho por el dueño):**
`processCulqiPayment` (`functions/index.js`) **cobraba la tarjeta pero NUNCA marcaba el pedido como
pagado** → un pedido pagado con Culqi quedaba **indistinguible de uno impago** (`montoPendiente =
total`) y "Recepción de Pedidos" no podía separar pagados de "por confirmar pago". **FIX:** en la
**rama de ÉXITO** del cobro (tras tomar el lock `culqiCharges/{tokenId}`, reusando
`erpDb/coll/pedidoId` que la función ya tenía) marca el pedido en `pedidos_web` con los **MISMOS 7
campos que el `culqiWebhook`**: `pagado:true`, `estadoPago:"pagado"`, `culqiChargeId`,
`montoPagado`, `montoPendiente:0`, `pagadoAt`, `metodoPago:"culqi"`. Es **best-effort** (`try/catch`,
no falla la respuesta del cobro) e **idempotente** (bajo el lock S-4 y con los mismos campos que el
webhook → sin conflicto); **no toca `montoTotal` ni el monto del cobro**. Verificado con auditoría
adversarial de dinero. El `culqiWebhook` ya hacía esto, pero **su URL no está registrada en el panel
de Culqi** (pendiente del dueño como respaldo, ver §7 Prioridad 1.bis); este fix cierra la brecha
desde la propia confirmación del cobro.

**Acceso de admin (`09d86a9`):** enlace **📦 Recepción de Pedidos** en el menú lateral del admin
(`src/components/AdminLayout/AdminLayout.jsx`), debajo de "Dashboard Analítica", para entrar a
**organizar los envíos** sin hacer scroll hasta el final del dashboard. (Ya descrito en el Paso 7;
se reafirma aquí por pertenecer al camino de pedidos.)

**Sin cambios en el resto del estado:** flags de pago intactos (`CULQI_VERIFY_SIGNATURE=false`,
`ENFORCE_PAYMENT_OWNERSHIP=true` pendiente de validar con una compra real); **PayPal server-side**
sigue completo y desplegado con `VITE_PAYPAL_SERVER_SIDE` en **OFF** (pendiente de credenciales del
dueño); **las reglas vivas siguen 100 % abiertas** en `(default)` por el ERP compartido (**no
desplegar `firestore.rules.propuesto` sin resolver la auth del ERP / sin permiso**).

### Paso 9 — Sesión 2026-06-28 — Sistema MULTI-MARCA (Fases 0–5) *(✅ HECHO — frontend desplegado; `setup-marcas.js` pendiente del dueño)*

**Sistema multi-marca completo** sobre la misma sesión 2026-06-28: cada producto pertenece a
**una** marca (`brandId` = doc id de `tienda_brands`) y cada marca tiene su **página**, su
**catálogo sidebar filtrado**, su **panel admin** y su **nav de categorías con miniaturas**.
**No se inventó un modelo nuevo:** el ~80 % ya existía (el `brandId` estaba soportado end-to-end
con faceta server-side `{type:'brand'}`); se cablearon las **5 piezas** que faltaban (ver
[PLAN-MULTIMARCA.md](./PLAN-MULTIMARCA.md)). El **frontend** salió por **Vercel** (auto-deploy
desde `master`); **el backend NO requiere redeploy** (solo Firestore). **Las reglas vivas siguen
100 % abiertas** en `(default)` por el ERP compartido (§6). Detalle por commit en el
[CHANGELOG.md](../../CHANGELOG.md) (entrada 2026-06-28, "SISTEMA MULTI-MARCA").

**Decisiones del usuario** (fijadas antes de arrancar): **1 producto = 1 marca**; **todos los
productos actuales = Con Amor** (backfill); **`/mussa` se convierte en marca**; slug
`ConAmor`/`MUSSA`/`MUEBLERIA`; categorías por marca como **array embebido** (`categoryNav`).
**Brand IDs reales:** Con Amor `m3P26agqw7BjeYTDjs6j`, MUSSA `pMujqcyIIDUF2EdSSX5V`, MUEBLERIA
`RMLsCQGvLo7c3NHgfkLO`.

**Qué se desplegó por fase:**

- **Fase 0 — Datos (`281823a`, script, lo corre el dueño):** `scripts/setup-marcas.js`
  (idempotente, **DRY-RUN por defecto**, `--apply` para escribir): crea/reutiliza las 3 marcas con
  `slug` sin duplicar; **backfill** `brandId = <id de Con Amor>` a los `productos_wala` sin marca
  (solo `brandId`/`slug`, no precios/stock); crea las `landingPages/{slug}` (id === slug) para que
  `WALA.PE/ConAmor`/`/MUSSA`/`/MUEBLERIA` resuelvan vía `DynamicLandingPage`.
- **Fase 1 — `WALA.PE/ConAmor` (`a687fd5`):** setting `brandId` en `sidebar_catalog` (selector de
  marca en `VisualEditorPanel`, guarda `b.id`); `getProductsByBrand` en `products.js`; `TiendaPage`
  inicializa `catalogFacet = {type:'brand', value: brandId}` (marca server-side + categoría en
  cliente). **Red de seguridad:** `brandId` vacío = catálogo global (no rompe la home). Requiere
  índice `brandId + createdAt`.
- **Ruteo case-insensitive (`212bf0f`):** `getLandingPageBySlug` cae a comparación en minúsculas si
  el match exacto falla (`/CONAMOR` ≡ `ConAmor`); `TiendaPage` usa `pageIdOverride`.
- **Fase 2 — Panel admin por marca + sidebar colapsable (`ac7e53d`):** `AdminMarcaProductos.jsx`
  (lista por `getProductsByBrand`, **asignar/quitar marca en lote**, crear-con-marca vía
  `/admin/productos/nuevo?brandId=`); `setProductBrand` escribe parcial y al **quitar** hace
  `deleteField()` del `brandId`. Además, **sidebar con grupos de filtros COLAPSABLES**
  (`SidebarCatalogLayout.jsx`).
- **Fases 3–4–5 (`5221ad5`):** **nav de categorías por marca** — array `categoryNav:
  [{categoryId,name,imageUrl,order}]` embebido en `tienda_brands` (normalizado en `brands.js`),
  editado en `AdminMarcaProductos`; `categories_nav` (antes `null`) renderiza `VisualCategoryNav`
  (burbujas con miniatura). **Clic-filtra:** modo **filtro-local** — el clic empuja la faceta de
  categoría al sidebar de la misma página (filtra **sin navegar**). **MUSSA + MUEBLERIA operativas**
  (se resolvió la colisión de la `/mussa` hardcodeada convirtiéndola en marca).

- **Refinamiento del editor (`041742f` + `3f0627c`):** dos mejoras para que armar una página de
  marca sea **arrastrar y soltar**, no configurar dropdowns. (1) El menú **"Añadir Nuevo Módulo"**
  ahora ofrece, además de las genéricas, opciones **POR MARCA** (dinámicas, `getBrands`):
  **"Productos {Marca}"** (inserta `sidebar_catalog` con `brandId` + `title` preconfigurados) y
  **"Categorías {Marca}"** (inserta `categories_nav` con `brandId`) — el dueño arrastra el
  catálogo/nav de la marca **ya filtrado** sin tocar el dropdown (el label genérico de
  `sidebar_catalog` pasó a **"Catálogo (todas las marcas)"**). (2) El **nav de categorías es
  AUTOMÁTICO**: si el `categoryNav` manual de la marca está VACÍO, `categories_nav` deriva las
  burbujas de las **categorías que tienen los productos de la marca** (`getProductsByBrand` →
  categorías distintas) con su **imagen de `/admin/categorías`** (`tienda_categories.imageUrl`;
  sin imagen → burbuja con inicial + color); el clic filtra el catálogo de la página por esa
  categoría. El `categoryNav` manual queda como **override opcional**. Una página con
  `categories_nav` de una marca también **acota su catálogo a esa marca** (`pageBrandId` considera
  el nav). **No toca carrito/precios/cobro.**

**Otros fixes del mismo despliegue:** **hero centrado** de la CAJA del subtítulo según la
alineación de la sección (`bd4b8df`, `HeroBanner.jsx`).

**⬜ Pendiente del DUEÑO (no de código):**

- **Correr `scripts/setup-marcas.js --apply`** (Cloud Shell, `--project sistema-gestion-3b225`):
  crea las landingPages **MUSSA/MUEBLERIA** y hace el backfill `brandId` (ConAmor ya quedó como base).
- **Configurar las páginas en el editor visual**: arrastrar los módulos **"Productos {Marca}"** +
  **"Categorías {Marca}"** desde "Añadir Nuevo Módulo" (ya vienen filtrados a la marca; el **nav de
  categorías es automático** desde los productos, no hay que armarlo a mano).
- **Asignar productos a MUSSA / MUEBLERIA** desde el panel `AdminMarcaProductos` (hoy todos los
  productos son **Con Amor**). *(Como el nav es automático, asignar productos a la marca ya hace
  aparecer sus categorías en las burbujas.)*
- **Subir imágenes de categoría en `/admin/categorías`** (opcional) para que las burbujas del nav
  automático muestren miniatura en vez de la inicial.

---

### Paso 10 — Sesión 2026-06-28 — "Elementos con diseño" + editor reutilizable del nav de categorías *(✅ HECHO — desplegado)*

**Cierre de la sesión multi-marca:** se le da al dueño **un lugar propio** para personalizar el
**nav de categorías de cada marca** (las burbujas), con un **editor reutilizable** que se embebe en
**tres sitios** y un **espacio nuevo** preparado para sumar más "elementos con diseño" por marca.
**Frontend DESPLEGADO** por **Vercel** (auto-deploy desde `master`); **el backend NO requiere
redeploy** (el `categoryNav` vive en `tienda_brands`, solo Firestore). **No toca carrito, precios ni
cobro.** Build verde. Commit `fc8a0d2`. Detalle por commit en el
[CHANGELOG.md](../../CHANGELOG.md) (entrada 2026-06-28, "ELEMENTOS CON DISEÑO") y guía del dueño en
[FUNCIONES-ADMIN.md](./FUNCIONES-ADMIN.md).

**Qué se desplegó:**

- **Nueva sección admin "Elementos con diseño" (`fc8a0d2`):** página `/admin/elementos-diseno`
  (`src/pages/admin/AdminElementosDiseno.jsx`, ruta lazy en `App.jsx`) con **enlace 🎨 "Elementos
  con diseño"** en el sidebar (`AdminLayout.jsx`), **debajo de "📦 Recepción de Pedidos"** en el
  grupo *Diseño de Tienda*, gateada por `AdminRoute` + `canDesign` (Super Admin o `manage_design`).
  Tiene un **selector de marca** (`getBrands`) común y una **estructura de pestañas** (array
  `SECCIONES`) **lista para crecer**: hoy una pestaña, **"Navegación por categorías"** (monta el
  `CategoryNavEditor`); sumar futuros elementos por marca es añadir una entrada al array.
- **Editor reutilizable `CategoryNavEditor` (`fc8a0d2`):**
  `src/components/admin/CategoryNavEditor/CategoryNavEditor.jsx`, **autosuficiente** (carga sus datos
  con react-query). Edita el `categoryNav` de una marca **burbuja por burbuja**: (a) **qué categoría
  filtra** (`categoryId`, `<select>` de `tienda_categories`), (b) **nombre** y (c) **miniatura**
  (subir+**recortar 1:1** con `AdminImageCropper` a `brand_nav/{brandId}/...` vía `uploadFile`, **o
  heredar** la de la categoría). Además **agregar/quitar/reordenar**, **"Generar automático"**
  (prellena con las categorías de los productos de la marca, `getProductsByBrand`, como punto de
  partida editable) y **"Vaciar (volver a automático)"** (`categoryNav = []`). Guarda con
  `updateBrand(brandId, { categoryNav })` (asigna `order` por posición) e **invalida las cachés del
  nav** (`['brands']`, `['admin-brand-doc']`, `['categories-nav-brands']`). **Regla:** `categoryNav`
  con items = override manual; vacío = nav AUTOMÁTICO (derivado de los productos).
- **Mismo editor embebido inline en el editor visual (`fc8a0d2`):** en `VisualEditorPanel.jsx`, al
  seleccionar una sección **"Navegación por categorías"** (`categories_nav`) **con marca**, se
  embebe **inline el MISMO `CategoryNavEditor`**. Como el `categoryNav` **vive en la marca**, los
  cambios se **sincronizan** entre "Elementos con diseño", el panel por marca
  (`AdminMarcaProductos` → pestaña "Nav de categorías") y el editor visual, y se reflejan en **todas
  las páginas** que usen ese nav.

**Sin pendientes propios:** la feature está **completa y desplegada**; solo aplican los pendientes
del dueño ya listados en el Paso 9 (asignar productos a las marcas, subir imágenes de categoría
opcionales).

---

### Paso 11 — Sesión 2026-06-29 — "Elementos con diseño" v2 (catálogo de tarjetas) + estilo del nav por marca *(✅ HECHO — desplegado)*

Segunda iteración de **"Elementos con diseño"** sobre la base del Paso 10: la pantalla
`/admin/elementos-diseno` deja de ser un "hub de pestañas" y pasa a un **CATÁLOGO DE ELEMENTOS con
TARJETAS**, cada uno con **su propio slug y su propia página** `/admin/elementos-diseno/{slug}`; y el
nav de categorías gana un **"Estilo del nav" por marca** (alineación + estático/slider) que se aplica
en la tienda. **Frontend DESPLEGADO** por **Vercel**; **el backend NO requiere redeploy** (el nuevo
`categoryNavStyle` vive en `tienda_brands`, solo Firestore — **aditivo y retrocompatible**: sin el
campo, el nav se ve igual que hoy). **No toca carrito, precios ni cobro.** Commit `425e9ce`. Detalle
por commit en el [CHANGELOG.md](../../CHANGELOG.md) (entrada 2026-06-29, "ELEMENTOS CON DISEÑO v2");
guía del dueño en [FUNCIONES-ADMIN.md](./FUNCIONES-ADMIN.md) y modelo en
[MODELO-DATOS.md](./MODELO-DATOS.md) (§3.6).

**Qué se desplegó:**

- **Registro de elementos (`425e9ce`):** `src/pages/admin/elementosDiseno/registry.jsx` — array
  `ELEMENTOS_DISENO` de `{ slug, nombre, descripcion, icon, Editor }`. **Hoy 1 elemento**,
  **"Navegación por categorías"** (`slug: 'navegacion-categorias'`, editor
  `NavegacionCategoriasEditor`). Sumar otro elemento = añadir una entrada (aparece sola como tarjeta
  + ruta).
- **Landing como GRID DE TARJETAS (`425e9ce`):** `AdminElementosDiseno.jsx` se reescribe como grid,
  una tarjeta por elemento; al pulsar navega a **`/admin/elementos-diseno/{slug}`**. La **página por
  elemento** `AdminElementoDisenoPage.jsx` (ruta `/:elementSlug`) busca el elemento por slug y
  renderiza su `Editor` con encabezado + "Volver a Elementos con diseño" (slug desconocido → aviso).
- **"Estilo del nav" por marca (`425e9ce`):** **`categoryNavStyle` en `tienda_brands`**
  (`src/services/brands.js`): `{ align ∈ {left,center,right,justify}, animation ∈ {static,slider} }`,
  normalizado en `createBrand`/`updateBrand` (inválido → default), **default retrocompatible
  `{ center, static }`**. Sub-sección "Estilo del nav" en `CategoryNavEditor` (Alineación + Modo),
  guardada junto al `categoryNav` (`updateBrand(brandId, { categoryNav, categoryNavStyle })`) →
  **sincronizada** en los 3 sitios donde se embebe el editor. `VisualCategoryNav` lo aplica en la
  tienda: **estático** alinea las burbujas (colapsa a `flex-start` en overflow); **slider** = marquee
  en bucle que **pausa al hover** y respeta `prefers-reduced-motion`, sin romper el clic-para-filtrar.
  `TiendaPage.jsx` lee `categoryNavStyle` y pasa `align`/`animation`. *(La alineación solo aplica en
  modo estático.)*

**Sin pendientes propios** (aplican los del Paso 9).

---

### Paso 12 — Sesión 2026-06-29 — Red de seguridad y FUENTE DE VERDAD de pedidos (`wala_pedidos` + `estadoWala`) *(✅ HECHO — frontend desplegado; el pago requiere redeploy de functions)*

Dos movimientos encadenados sobre el camino de pedidos, ambos **100 % aditivos** (no tocan montos,
firma del pedido ni el marcado de `pedidos_web`):

**(a) Red de seguridad anti-pérdida (`68447dc`):** nueva colección WALA-only **`wala_pedidos`** (el
ERP **NO la toca**) con un **ESPEJO** de cada pedido del portal, escrito por `createWebOrder`
(`src/services/erp/firebase.js`) en **fire-and-forget best-effort** tras guardar en `pedidos_web`
(no demora ni puede romper el checkout; **no copia secretos de pago**). Servicio nuevo
`src/services/walaOrders.js` (`mirrorWebOrder`/`getWalaMirrorOrders`/`getAllWalaMirrorOrders`). Las
vistas **fusionan y rescatan** el espejo: "Mis Compras" (`searchOrdersByDniInERP` acepta `{userId}`,
deduplica por clave de negocio, **rescata** pedidos desmarcados por el ERP), `usePedidos(dni, userId)`,
"Recepción" (`adminOrders.js`). **Límite conocido:** el espejo solo protege pedidos creados **desde
este deploy**; la causa raíz sigue siendo del ERP (que borra al aprobar).

**(b) `wala_pedidos` pasa a FUENTE DE VERDAD (`1d8f639`) — decisión del dueño:** el espejo deja de ser
solo respaldo y cada pedido lleva **su propio `estadoWala`** (`pendiente_pago → pagado →
en_preparacion → enviado → entregado`, `cancelado` terminal) que el portal **NO degrada** cuando el
ERP toca el doc. Helpers nuevos en `walaOrders.js` (`ESTADOS_WALA`, `updateWalaOrderEstado`
idempotente/best-effort, `markWalaOrderPagado`, `estadoWalaADisplay`); `mirrorWebOrder` ya **no
degrada** un espejo existente (lee antes con `getDoc` y conserva `estadoWala`/`pagado`/`createdAt`);
"Mis Compras" y "Recepción" leen el espejo como **PRIMARIA** y `estadoCompra.js` muestra el **estado
más avanzado** entre la derivación histórica del ERP y `estadoWala`. **El pago marca pagado en la
fuente de verdad (requiere redeploy):** los **3 puntos de confirmación de pago** de
`functions/index.js` (`processCulqiPayment`, `culqiWebhook`, `capturePaypalOrderSecure`) llaman
`marcarWalaPedidoPagado(...)` (`estadoWala:"pagado"`), **aditivo / idempotente / best-effort**.
**Frontend DESPLEGADO** por **Vercel**; **el backend REQUIERE redeploy** (`firebase deploy --only
functions:processCulqiPayment,functions:culqiWebhook,functions:capturePaypalOrderSecure`). Commits
`68447dc`, `1d8f639`. Detalle del flujo en [FLUJO-PEDIDOS.md](./FLUJO-PEDIDOS.md) (§4-bis.5–§4-bis.9)
y modelo en [MODELO-DATOS.md](./MODELO-DATOS.md) (§3.7).

**⬜ Pendiente del DUEÑO:** **redeploy de las 3 functions de pago** (para que el pago marque
`estadoWala:"pagado"`). **FASE SIGUIENTE (no hecha, el campo ya está listo):** endpoint con API KEY
para que el ERP **LEA** y **SOLO ACTUALICE** el estado de `wala_pedidos` (jamás borre).

---

### Paso 13 — Sesión 2026-06-29 — MODO NOCHE (claro/oscuro/sistema en toda la web) *(✅ HECHO — desplegado)*

**Modo noche global** para la web pública y el admin: el visitante elige **claro / oscuro / seguir al
sistema**, con persistencia y sin parpadeo al cargar. **Frontend DESPLEGADO** por **Vercel**; **NO
requiere backend** (solo CSS + estado de cliente). **Respeta los `backgroundColor` inline** del admin
(sin `!important`) y garantiza **contraste** (fondo oscuro → texto claro). **No toca carrito, precios,
cobro ni datos.** Commits `a442251` (base) + `649a42e` (2º pase de contraste). Detalle en
[MODO-NOCHE.md](./MODO-NOCHE.md) y nota de cliente en [FUNCIONES-CLIENTE.md](./FUNCIONES-CLIENTE.md).

- **Motor del tema (`a442251`):** `ThemeProvider` (`src/contexts/ThemeContext.jsx`) con tres modos de
  intención **`light`/`dark`/`system`** (`system` = default, sigue `prefers-color-scheme` en vivo) y
  un tema efectivo que fija `data-theme` en `<html>`; **persistencia** en `localStorage` clave
  **`wala-theme`**. **Script anti-FOUC en `index.html`** fija el tema **antes** de React/CSS.
  **Interruptor luna/sol** (`src/components/common/ThemeToggle/`) en el Header (el primer clic invierte
  lo que el visitante ve, aunque venga de `system`).
- **Paleta y overrides (`a442251` + 2º pase `649a42e`):** red global en `src/styles/globals.css` que
  remapea `--gris-*`/`--blanco`/`--color-*` bajo `dark`, + **overrides `[data-theme="dark"]` por
  componente** en **~40 `.module.css`** (storefront, cuenta, header/footer/nav, UI Glass*, admin), con
  **2 pases de contraste** para asegurar legibilidad.

**Sin pendientes propios.**

---

### Paso 14 — Sesión 2026-06-29 — Compra directa + Regalos v3 + navegación de la Cuenta *(✅ HECHO — frontend desplegado; la foto de regalos requiere redeploy de functions)*

Tres mejoras de cara al cliente del mismo ciclo, **frontend por Vercel**, **sin tocar
carrito/precios/cobro**:

- **Compra directa (`fbb53ab`):** la ficha de producto gana **"Comprar"** y **"Comprar todo el
  carrito"** que van **directo a `/checkout`**. `CartContext` (`src/contexts/CartContext.jsx`) suma
  `addToCart(..., { selectOnly })` —deja ese item como ÚNICO seleccionado, **sin borrar** los demás—
  y `selectAllItems()`. En `ProductDetail.jsx`, `handleComprarAhora` agrega con
  `{selectOnly:true, silent:true}` + navega; `handleComprarCarrito` selecciona todo + navega (avisa si
  el carrito está vacío). Reusa la selección "No comprar esta vez"; **el camino de "Agregar al
  carrito" queda igual**.
- **Regalos v3 — foto + tarjetas grandes (`4f775a4`):** `/regalar` muestra cada fecha como **tarjeta
  grande de persona** (avatar con **foto circular** o inicial + nombre + chip de relación + **chips de
  ocasiones globales** + fecha). La foto se sube en la cuenta
  (`src/pages/cuenta/CuentaFechasImportantesPage.jsx`, `recipient.photoUrl` → `uploadFile` a Firebase
  Storage) y la expone `getPublicGiftRegistry` (`recipientPhoto`/`roleKey`/`gender`, dato mínimo sin
  PII sensible — **requiere redeploy de functions**). Conserva el **arrastre por Pointer Events**
  (`useGiftDrag` en `GiftRegistryPage.jsx`, ghost anclado al puntero, `draggable={false}` +
  `-webkit-user-drag:none` para matar el drag nativo) **sin parpadeo** (la tarjeta origen nunca se
  desmonta) — endurecido en `649a42e`. La tarjeta sigue siendo el control de selección (`role="radio"`).
- **Cuenta (`e9ec48d`):** tabs en **2 líneas** (desktop) + scroll con **"asomo"** (móvil: dos
  auto-scrolls suaves de ~56px al montar si no caben, como pista de deslizar) en
  `src/pages/CuentaLayout.jsx`; **tarjeta de compra clickeable completa** en
  `src/pages/cuenta/CuentaPedidosPage.jsx` (`role="link"` + `tabIndex` + `onClick`/`onKeyDown` →
  `/cuenta/pedidos/:id`, accesible por teclado).

Detalle por commit en el [CHANGELOG.md](../../CHANGELOG.md) (entradas 2026-06-29). **⬜ Pendiente del
DUEÑO:** **redeploy de `getPublicGiftRegistry`** para que la foto/roleKey/gender lleguen a la página
pública de `/regalar`.

---

## 3. Tabla resumen de fases (0–5)

> Todo lo marcado ✅ se **verificó primero en el emulador `demo-wala`** y **ya está desplegado
> a producción** (frontend en Vercel; Cloud Functions e índices en `sistema-gestion-3b225`).
> Lo único que NO está publicado son las **reglas de seguridad completas** (ver §6/§7).

| Fase | Objetivo | Estado | Entregables principales |
|------|----------|--------|-------------------------|
| **0 — Estabilización y seguridad** | Sellar dinero/puntos manipulables, eliminar backdoor, reglas reales, economía server-side. Bloqueante de todo lo demás. | ✅ **HECHO (parcial; reglas sin publicar)** | Commits `3d53501`, `9e84990`, `f0e4aa0`; custom claims (**admin claim asignado**); CFs de economía + 44 tests desplegadas. ⚠️ Las **reglas completas** (`firestore.rules.produccion`) están **listas pero NO publicadas** → fuga de PII (§6/§7). |
| **1 — Plataforma y datos base** | Migrar CRA→Vite, introducir `vendorId`/`nicheId`/`fulfillmentType` aditivos, búsqueda y paginación. | ✅ **HECHO (desplegado; búsqueda externa y backfill pendientes)** | Commits `a3c4d66`, `a652f60`, `f188260`, `0f2414f`; `vite.config.js`; servicios niches/vendors/search; páginas Search/Niche/Vendor. `backfill-vendor-niche.js` aún sin correr en prod. |
| **2 — Fidelización unificada** | Economía única sobre `loyaltyLedger`, misiones diarias, racha global, tiers/XP, push v2. | ✅ **HECHO (desplegado)** | `loyaltyLedger`, misiones/rachas y configuración de fidelización (verificadas en emulador y desplegadas). Push v2 (FCM) y campañas programadas pendientes (→ Fase 5 / §7). |
| **2b — Refuerzo de fidelización** | Tiers/niveles + catálogo de recompensas + canje, sobre la base de Fase 2. | ✅ **HECHO (desplegado)** | Tiers, catálogo de recompensas y canje. Verificado en emulador y desplegado. |
| **3 — Marketplace multi-vendor** | Entidad `vendors` + panel, `orders`/`subOrders`, split de pago, payouts, envíos por zona. | ✅ **HECHO (core + split desplegados; cobro real pendiente)** | `createOrderWithSubordersSecure`; colecciones `orders`/`subOrders`/`shippingZones`/`payouts`; UI `/admin/envios`, `/admin/payouts`, `VendorPanel`; **split Mercado Pago Marketplace (simulado)** (`createCheckoutPreferenceSecure`, `confirmPaymentSecure`, `mercadoPagoWebhook`). Cobro REAL, Algolia, rol vendor por claims e integración de `CheckoutPage` pendientes. |
| **4 — Personalizados como nicho POD** | Arte de producción real (DPI/PDF), `blueprints` reutilizables, consolidar editores. | 🔧 **PARCIAL (base desplegada)** | `blueprints` (CRUD `/admin/blueprints` + seed `bp-polo`); `src/utils/productionArt.js` (`pxFromCm`, `exportProductionArtPNG`, `validatePrintResolution`). Integración con `EditorPage`, PDF de producción y fix de `finalCustomizedImage` pendientes. |
| **5 — Impulso, FOMO e inteligencia** | Cofres diarios, segmentación RFM, campañas programables, ofertas flash, antifraude. | ✅ **HECHO (base desplegada)** | `openDailyChestSecure` (cofre diario), `computeSegmentsSecure` (RFM solo admin), `flashOffers` (CRUD `/admin/flash-offers` + vitrina `/ofertas`). Push v2 segmentado (FCM), campañas (Cloud Scheduler), recomendación IA y countdown en home pendientes. |

El detalle de cada fase está en la sección 6 del [PLAN-MAESTRO.md](./PLAN-MAESTRO.md) y en
el índice de [`fases/`](./fases/README.md).

### 3.1 Estado de implementación por fase (detalle verificado en emulador)

Leyenda: ✅ hecho y verificado · 🔧 parcial · ⬜ por hacer.

**Fase 3 — Marketplace multi-vendor (core local ✅ verificado E2E):**

- ✅ `createOrderWithSubordersSecure(items, shippingZoneId)`: recalcula precios server-side,
  agrupa por `vendorId`, crea `orders` (maestro) + `subOrders` con `vendorSubtotal`,
  `commissionPct`, `commissionAmount`, `vendorPayoutAmount`; envío por zona.
- ✅ Colecciones: `orders` `{ buyerUid, status, totals:{subtotal,shipping,commissionTotal,total}, subOrderIds }`,
  `subOrders` `{ orderId, buyerUid, vendorId, nicheId, items[], vendorSubtotal, commissionPct, commissionAmount, vendorPayoutAmount, status }`,
  `shippingZones` `{ name, departamento, cost, etaDays, active, order }`,
  `payouts` `{ vendorId, orderId, subOrderId, amount, status }`.
- ✅ UI: `/admin/envios` (AdminEnviosZonas), `/admin/payouts` (AdminPayouts), `VendorPanel`
  ve sus subórdenes; servicios `orders`/`shippingZones`/`payouts`.
- ✅ Reglas: `subOrders` (dueño/admin), `shippingZones` (pública/admin), `payouts` (admin),
  `orders` legible por `buyerUid`.
- ✅ Verificado E2E: carrito p1 (casa) + p3×2 (estampados-lima) → 1 `order` + 2 `subOrders`
  (casa com 0 / payout 49.9; estampados-lima com 12% = 14.38 / payout 105.42), envío 10,
  total **179.7**.
- ✅ **Split de pago (Mercado Pago Marketplace, simulado):** `createCheckoutPreferenceSecure`
  (`order` `pending_payment` + subórdenes; con `MERCADOPAGO_ACCESS_TOKEN` crea preferencia
  real con `marketplace_fee` = comisión total; sin token → `init_point` simulado
  `/pago-demo/:orderId`), `confirmPaymentSecure` (marca `paid` + crea payouts por vendedor,
  idempotente), `mercadoPagoWebhook` (HTTP, para producción). `services/payments.js`; rutas
  `/checkout-demo` y `/pago-demo/:orderId`. Verificado simulado: order 179.7 / comisión
  14.38 → `paid` + 2 payouts (49.9, 105.42).
- ⬜ Pendiente (servicios externos): cobro **REAL** (`MERCADOPAGO_ACCESS_TOKEN`,
  `MP_WEBHOOK_URL`, `MP_BACK_URL_BASE`), búsqueda Algolia/Typesense on-write, rol `vendor`
  por claims, integrar el checkout **REAL** (`CheckoutPage`) a este flujo.

**Fase 4 — POD / arte de producción (base ✅ verificada):**

- ✅ `blueprints` (colección, lectura pública / escritura admin):
  `{ name, baseGarment, printAreas:[{name,widthCm,heightCm,dpi}], decorationMethods:[], basePrintCost, active, order }`.
  `/admin/blueprints` (CRUD) + `services/blueprints.js`. Seed `bp-polo` (Polo clásico, 2
  áreas Frente/Espalda 30×40 cm @300 dpi).
- ✅ `src/utils/productionArt.js`: `pxFromCm(cm,dpi)`, `exportProductionArtPNG(fabricCanvas,{dpiMultiplier})`
  (export alta resolución), `validatePrintResolution({imgWidthPx,areaWidthCm,dpi})`.
  Verificado: 30 cm @300 dpi = 3543 px.
- ⬜ Pendiente (requiere editor/navegador): integrar `productionArt` en `EditorPage` (generar
  arte de producción al agregar al carrito, recorte por área del blueprint, validar
  resolución), generación de **PDF de producción**, fix de `finalCustomizedImage` para
  productos simples.

**Fase 5 — Impulso e inteligencia (base ✅ verificada E2E):**

- ✅ `openDailyChestSecure` (cofre diario): recompensa determinista 5–20 monedas una vez al
  día (Lima), idempotente por `lastChestDate`, ledger `source 'cofre_diario'`. Verificado:
  50 → 68 + 2ª apertura `alreadyOpened`.
- ✅ `computeSegmentsSecure` (**solo admin**): RFM sobre `orders` pagadas → segmento
  `vip` (monetary≥500 o freq≥3) / `activo` (freq≥1 y recency≤60) / `en_riesgo` (pedidos y
  recency>60) / `nuevo` (sin pedidos); escribe `portal_clientes_users/{uid}.segment`.
  Verificado: processed 2 → `{activo:1, nuevo:1}`, cliente = `activo`; cliente sin permiso →
  `PERMISSION_DENIED`.
- ✅ `flashOffers` (pública / admin): `{ title, productId, discountPct, startsAt, endsAt, active, order }`.
  `/admin/flash-offers` (CRUD + botón "Recalcular segmentos") + `/ofertas` (vitrina pública
  + botón Cofre diario). Servicios `flashOffers`/`chest`/`intelligence`. Reglas: `segment` y
  `lastChestDate` bloqueados al cliente (server-only). Seed de 2 ofertas.
- ⬜ Pendiente (servicios externos/scheduler): push segmentado (FCM), campañas programadas
  (Cloud Scheduler), recomendación por IA, countdown de ofertas flash en home.

---

## 4. Inventario de commits (rama `fase-0-seguridad`, `origin/master..HEAD`)

Del más nuevo al más viejo. Los stats son los reales del repositorio. Esta tabla cubre la
base de **fases 0–1**; el trabajo de fases 2–5 (núcleo de marketplace, pago simulado, POD y
fidelización) se resume en §2 (Paso 5) y §3.1.

| # | Commit | Fase | Qué hizo | Archivos clave |
|---|--------|------|----------|----------------|
| 8 | `0f2414f` | 1 | Cablea búsqueda/nichos/vendedor a la UI (rutas nuevas). | `src/App.jsx`, `src/pages/SearchPage.jsx`, `src/pages/NichePage.jsx`, `src/pages/VendorPanel.jsx` |
| 7 | `f188260` | 1 (fix) | Elimina `require()` CommonJS que rompía en runtime con Vite. | `src/components/common/Footer/Footer.jsx`, `src/pages/Tienda/TiendaPage.jsx`, `src/services/firebase/config.js` |
| 6 | `a652f60` | 1 | Base multi-vendor/multi-nicho + capa de búsqueda (aditivo). | `firebase/firestore.rules`, `scripts/backfill-vendor-niche.js`, `src/constants/marketplace.js`, `src/services/{niches,search,vendors,products}.js` |
| 5 | `a3c4d66` | 1 | Migración CRA → Vite (build verificado). | `index.html` (movido de `public/`), `package.json`, `package-lock.json`, `vercel.json`, `vite.config.js` |
| 4 | `f0e4aa0` | 0 | H-03 + fixes de revisión adversarial + tests de economía. | `firebase/firestore.rules`, `functions/economyLogic.js`, `functions/index.js`, `functions/test/economyLogic.test.js`, `src/App.jsx`, `src/components/common/Header/Header.jsx`, `src/services/accountFromOrder.js`, `src/services/firebase/ruleta.js` |
| 3 | `9e84990` | 0 | Economía server-authoritative (H-06). | `firebase/firestore.rules`, `functions/index.js` (+360), `src/contexts/AuthContext.jsx`, `src/pages/SubscriptionSurveyPage.jsx`, `src/services/firebase/ballSort.js`, `src/services/firebase/ruleta.js`, `src/services/referrals.js` |
| 2 | `3d53501` | 0 | Elimina backdoor admin, custom claims, valida pedidos ERP y reglas. | `firebase/firestore.rules`, `firebase/storage.rules`, `functions/index.js`, `functions/notificationsEngine.js`, `scripts/set-admin-claims.js`, `src/contexts/AuthContext.jsx`, `src/pages/LoginPage.jsx`, `src/services/referrals.js` |
| 1 | `c7c29ce` | Docs/Ops | Plan maestro, baseline, runbooks de respaldo/despliegue + índices. | `docs/wala/*` (7 docs + JSON), `firebase.json`, `firestore.indexes.json`, `ops/backup/*`, `ops/deploy/deploy.ps1`, `ops/restore/*` |

---

## 5. Estado de despliegue (actualizado 2026-06-26)

> ✅ **Wala ya está en producción.** El detalle vivo y "qué toca hacer" está en
> [DESPLIEGUE-ESTADO.md](./DESPLIEGUE-ESTADO.md); aquí va el resumen.

**Topología real:** el proyecto Firebase de producción es **`sistema-gestion-3b225`** (NO
`pruebas-cd728`, que quedó huérfano y no se usa). Es la misma base Firestore que comparte el
**ERP/CRM "Sistema gestión"** con el portal de la tienda. La web **wala.pe** la sirve **Vercel**
(proyecto `portal-clientes-regala-con-amor`), con **auto-deploy desde `master`**.

| Artefacto | Estado | Notas |
|-----------|--------|-------|
| **Frontend (wala.pe / Vercel)** | ✅ en vivo | Build Vite; auto-deploy desde `master`. Las variables de entorno se hornean en build (cambiar env exige Redeploy). |
| **Cloud Functions** | ✅ desplegadas | Economía, juegos/Kapi, misiones, cofre, pedidos. Se conservaron las funciones del ERP (no se borraron). |
| **Índices Firestore** | ✅ desplegados | Incluye el índice de Wordle. Se conservaron los del ERP/CRM. |
| **Admin claims** | ✅ asignado | La cuenta de administrador ya tiene `admin:true`; el panel `/admin` opera. |
| **Reglas Firestore** | ⛔ **PENDIENTE de publicar** | Las **reglas vivas siguen 100 % abiertas** salvo el **delete-block** de mitigación. Las reglas completas (`firebase/firestore.rules.produccion`) están **listas pero sin publicar** → **fuga de lectura/PII activa**. **Prioridad #1.** |
| **Secretos de Functions** | ⬜ pendiente | Sin `MERCADOPAGO_ACCESS_TOKEN`/Culqi/ERP en este proyecto → el cobro real y algún reclamo quedan en modo simulado o *fail-closed*. |
| **Storage** | ⏭️ omitido | Firebase Storage no activado; la app no lo usa en este proyecto. |

**Cómo se verificó antes de desplegar** (sigue siendo el respaldo de calidad):

- `vite build` correcto (migración Vite verificada). Dev en **http://localhost:3000**.
- **Emulador `demo-wala`** con seeds y flujos núcleo probados **E2E**: carrito → `order`
  multi-vendedor → `subOrders` → pago simulado → `payouts`; cofre diario; segmentación RFM.
- Tests de economía **44/44 verdes** (`npm run test:functions`).
- Revisión adversarial con agentes sobre los cambios de seguridad.
- Usuarios de prueba (solo emulador): `admin@wala.test` / `wala1234` y `cliente@wala.test` / `wala1234`.

**Lo que aún falta cerrar en backend** (detalle en §7):

- **Publicar las reglas completas** (`firestore.rules.produccion`) fusionándolas con/validando
  contra las del ERP, en el Rules Playground, con respaldo previo → cierra la fuga de PII.
- **Cobro real Mercado Pago** (secretos `MERCADOPAGO_ACCESS_TOKEN`, `MP_WEBHOOK_URL`,
  `MP_BACK_URL_BASE`) e integrar el checkout real al flujo de subórdenes/split.
- **Backfill multi-vendor/nicho** (`scripts/backfill-vendor-niche.js`): hasta correrlo, los
  productos sin `vendorId`/`nicheId` usan los defaults de `src/constants/marketplace.js`.

---

## 6. Riesgos residuales vigentes

Estos riesgos **siguen abiertos** (residuales o parciales), aun con las fases 0–5 ya en
producción. El **#1 es la fuga de PII por reglas abiertas** y es lo más urgente de cerrar.
Referencias al runbook [FASE-0-SEGURIDAD.md](./FASE-0-SEGURIDAD.md) y al plan de reglas
[PLAN-SEGURIDAD-REGLAS.md](./PLAN-SEGURIDAD-REGLAS.md).

| Riesgo | Hallazgo | Estado | Nota |
|--------|----------|--------|------|
| **🚨 Reglas vivas abiertas — fuga de PII activa** | H-07/H-09 | ⬜ **abierto (CRÍTICO)** | Las reglas vivas de `sistema-gestion-3b225` son `allow read, write: if true`. Se aplicó un **delete-block** de mitigación (frena el borrado anónimo), pero **cualquiera en internet puede LEER clientes/pedidos/PII**. Las reglas completas (`firebase/firestore.rules.produccion`) están **listas pero sin publicar**. **Cerrar primero.** |
| **`orders`/pedidos con `create` público** | — | ⬜ abierto | La creación de pedidos sigue abierta; debe pasar por CF con recompute de totales server-side. |
| **`product_reviews` con `update` laxo** | — | ⬜ abierto | La actualización de reseñas no está suficientemente restringida; riesgo de manipulación de rating. |
| **Sin scoping por dueño/rol en reglas (Fase C)** | — | 🔧 parcial | Las reglas completas listas bloquean el acceso anónimo, pero un usuario **logueado** todavía puede leer/escribir más de lo ideal. El cierre fino por dueño/rol y el rol `vendor` por claims es la Fase C. |
| **Desync `monedas` vs `monedasActivas`** | H-06 | 🔧 parcial | La economía se movió a CF, pero la dualidad escalar (`monedas`) vs lotes TTL (`monedasActivas`) sigue; se resuelve al adoptar `loyaltyLedger` (Fase 2). |
| **Desync `monedas` (gastable) vs `kapiCoins` (XP)** | H-06 | ⬜ abierto | El header suma ambas pero solo `monedas` se gasta; unificación pendiente (Fase 2). |
| **Verificación real de retos/misiones** | H-04/H-06 | ⬜ abierto | Los `actionType` (compra/reseña/visita/compartir) aún no tienen emisor verificado server-side; antifraude pendiente. |
| **PayPal capturado en cliente / precio confiado al cliente** | H-11 | 🔧 parcial | El flujo seguro **recalcula precios y comisiones server-side** (`createOrderWithSubordersSecure` / `createCheckoutPreferenceSecure`, Fase 3), pero el checkout REAL aún no está integrado y la captura/validación de pago real (Mercado Pago/PayPal) sigue pendiente de configurar. |
| **FCM `sendToDevice` deprecado** | H-10 | ⬜ abierto | Migración a `sendEachForMulticast` (HTTP v1 / push v2) pendiente (Fase 2/5). |
| **Password = DNI en webhook de cuentas** | H-03 | ✅ cerrado | Resuelto migrando a **magic link / set-password**; webhook con secreto y CORS restringido. |
| **Backdoor admin / emails hardcodeados** | H-01 | ✅ cerrado | Eliminado; admin vía custom claims. El **admin claim ya está asignado** en `sistema-gestion-3b225`. |

---

## 7. Qué falta (por prioridad)

Wala ya está en producción; lo siguiente es lo que queda, ordenado por urgencia.

### Prioridad 1 — Seguridad (hacer YA)

| Pendiente | Fase | Por qué importa |
|-----------|------|-----------------|
| **🚨 Publicar las reglas de seguridad completas** (`firebase/firestore.rules.produccion`) | 0 / C | Hoy hay **fuga de PII activa**: la lectura anónima de clientes/pedidos sigue abierta. Hay que **respaldar** las reglas vivas, **fusionar/validar** con las del ERP, probar en el **Rules Playground** y publicar. Es lo único catastrófico que queda. Ver [PLAN-SEGURIDAD-REGLAS.md](./PLAN-SEGURIDAD-REGLAS.md). |
| **🔐 Track de seguridad: App Check o migrar el ERP a Firebase Auth** | 0 / C | En la sesión 2026-06-27 se publicaron reglas y se **revirtieron** porque rompían el ERP: **el ERP no usa Firebase Auth y sus peticiones llegan sin identidad**, así que cualquier regla que exija autenticación lo rompe. Hay que **habilitar App Check** o **migrar el ERP a Firebase Auth** antes de poder cerrar las reglas sin romper el CRM. Es el desbloqueante real de la Prioridad 1. |

### Prioridad 1.bis — Cerrar el cobro real (operativo, del usuario — sesión 2026-06-27)

El checkout internacional con moneda local/USD ya está desplegado; faltan dos pasos **del
usuario** (no de código) para que el cobro quede 100 % en producción:

| Pendiente | Quién | Por qué importa |
|-----------|-------|-----------------|
| **Registrar la URL de `culqiWebhook` en el panel de Culqi** (ahora como **respaldo**) | Usuario | La Cloud Function `culqiWebhook` (marca `pedidos_web` pagado, idempotente) ya está desplegada, pero el panel de Culqi **estaba caído** y aún no tiene registrada su URL → Culqi no notifica el pago al backend. **Mitigado (2026-06-28, `e84b6b1`):** `processCulqiPayment` ahora marca el pedido pagado en la rama de éxito del cobro (mismos 7 campos que el webhook, idempotente), así que el estado de pago **ya no depende** de que el webhook esté registrado. Registrar la URL sigue siendo recomendable como **segundo canal de respaldo**. |
| **Verificar `REACT_APP_PAYPAL_CLIENT_ID` en Vercel** | Usuario | Si esa variable **no** está en Vercel, **PayPal corre en SANDBOX** (no cobra de verdad). Hay que confirmarla y hacer Redeploy (las env se hornean en build). |

### Prioridad 2 — Reestructurar el dashboard de analítica

> **Nota (sesión 2026-06-27):** el commit `a4c884e` **adelantó gran parte de esta prioridad**:
> el dashboard ya se partió en hub + **DashProductos** + **DashCategorias** + nueva **DashUso**
> (`/admin/dashboard/uso`), con KPIs animados y heatmap mejorado (mini-tarjetas, nº de clics,
> preview, etiquetas con emoji). Revisar qué sigue pendiente del iframe/`willReadFrequently`
> contra el código actual.
>
> **Nota (sesión 2026-06-28):** además se atacó el **costo** del dashboard (no solo su
> estructura): refetch **15 s→120 s** (−75 % de lecturas) y **pre-agregación diaria**
> `analytics_daily` con fallback (Fase 2 del plan de [ESCALABILIDAD.md](./ESCALABILIDAD.md)),
> que baja el dashboard de ~5.300 a ~30-90 lecturas/refresco cuando la CF diaria esté poblada.
> Para poblar los días históricos hay un **botón de backfill de analítica** en el dashboard
> (`BackfillAnaliticaButton.jsx` → `aggregateAnalyticsDailyBackfill`), ya **desplegado**.


| Pendiente | Fase | Por qué importa |
|-----------|------|-----------------|
| **Partir el dashboard en páginas por área** (resumen, heatmap, productos, origen, páginas, categorías) con **rutas propias** | Dashboard | Hoy `/admin/dashboard` es una sola página muy pesada. Separarla por área (cada una con su ruta) la hace usable y más rápida. |
| **Arreglar el iframe de preview del heatmap** (doble init de Firebase) | Dashboard | El preview de página dentro del `<iframe>` (en `HeatmapViewer.jsx`) carga la app de nuevo y **vuelve a inicializar Firebase** → errores en consola; hay que aislar el preview o evitar el doble init. |
| **Quitar el warning `willReadFrequently`** del canvas del heatmap | Dashboard | El canvas que dibuja el mapa de calor (`getContext('2d')` en `HeatmapViewer.jsx`) debe crearse con `{ willReadFrequently: true }` para no ensuciar la consola y mejorar el rendimiento. |

### Prioridad 3 — Alcance y automatización (sobre la base ya hecha)

| Pendiente | Fase | Por qué falta |
|-----------|------|---------------|
| **Push v2 (FCM HTTP v1)** segmentado | 2 / 5 | `sendToDevice` está deprecado; hay que migrar a `sendEachForMulticast` y conectar dispositivos reales. |
| **Cloud Scheduler / cron** de segmentación y campañas | 5 | Hoy la segmentación RFM (`computeSegmentsSecure`) se dispara a mano desde el panel; falta programarla y agendar campañas. |
| **Búsqueda con índice externo (Algolia / Typesense)** on-write | 1 / 3 | Hoy la búsqueda es la capa interna; el índice externo da relevancia y escala (requiere servicio + credenciales). |
| **Integrar el editor POD** (`productionArt` en `EditorPage`, **PDF de producción**, fix `finalCustomizedImage`) | 4 | Existe la **base** (`blueprints` + utilidades de arte); falta conectarla al editor en el navegador para generar el arte/PDF de producción. |
| **Rol `vendor` por custom claims** + **scoping por dueño/rol en reglas (Fase C)** | 3 / C | Cierre fino de permisos: que cada vendedor vea solo lo suyo y cada usuario solo sus datos. |
| **Cobro REAL Mercado Pago** + integrar checkout real | 3 | Configurar `MERCADOPAGO_ACCESS_TOKEN`, `MP_WEBHOOK_URL`, `MP_BACK_URL_BASE` y cablear `CheckoutPage` (hoy el split es **simulado** vía `/checkout-demo`, `/pago-demo/:orderId`). |
| **Recomendación por IA / countdown de ofertas flash en home** | 5 | Funcionalidad de producto sobre la base ya verificada. |
| **Backfill multi-vendor/nicho en prod** (`scripts/backfill-vendor-niche.js`) | 1 | Hasta correrlo, los productos sin `vendorId`/`nicheId` usan los defaults de `src/constants/marketplace.js`. Requiere `GOOGLE_APPLICATION_CREDENTIALS` de `sistema-gestion-3b225`. |
| **"Mis fechas especiales" + "Agregar todo al carrito"** (wishlist) — ✅ **HECHO / desplegado** (solo falta REDESPLEGAR una CF) | Cliente / Reglas | Registro de regalos por fecha en `/regalar/:referralCode` (drag-and-drop terminado) + atajo "🛒 Agregar todo al carrito": **ambos implementados y en producción**. La página pública lee datos mínimos por la Cloud Function `getPublicGiftRegistry` (sin PII directa). **Pendiente del usuario:** REDESPLEGAR `getPublicGiftRegistry` por Cloud Shell (corrige un bug por el que la wishlist salía vacía). Detalle en [PLAN-FECHAS-ESPECIALES.md](./PLAN-FECHAS-ESPECIALES.md) y [FUNCIONES-CLIENTE.md §7.4-bis](./FUNCIONES-CLIENTE.md). |

Los riesgos de seguridad residuales (más allá de la fuga de reglas) siguen en §6.

---

## 8. Cómo correr en local

Requisitos: **Node.js**. En la máquina del dueño hoy está instalado **Node 24**, que sirve para
`npm`/Vite/tests pero es **INCOMPATIBLE con `firebase-tools`** (su cliente HTTP se corta con
`Premature close`), por lo que **el deploy de backend NO se puede automatizar desde la PC** — se
hace por **Cloud Shell** (ver más abajo). Para automatizarlo desde la PC en el futuro habría que
instalar **Node 20/22 LTS**. Desde la raíz del repo:

```bash
npm install                 # instala dependencias (Vite + React)
npm run dev                 # servidor de desarrollo -> http://localhost:3000
npm run build               # build de producción (Vite) — verificado
npm run preview             # sirve el build para revisión
npm run test:functions      # tests de economía de Cloud Functions (44/44)
```

Scripts adicionales relevantes (`package.json`): `dev:3001` (Vite en puerto 3001),
`deploy:firestore-rules`, `deploy:storage-rules`, `deploy:functions`, `deploy:vercel` /
`deploy:vercel:prod`. El frontend se despliega solo (Vercel auto-deploy desde `master`); el
deploy de backend a `sistema-gestion-3b225` se hace desde **Google Cloud Shell** (copiar/pegar; ver
[DESPLIEGUE.md](./DESPLIEGUE.md)) porque `firebase-tools` no corre bien con el Node 24 local.
Recordatorio: **nunca** desplegar `firestore:rules` (ni `firestore.rules.propuesto`) sin
fusionar/validar antes contra las reglas vivas del ERP **y sin resolver la auth del ERP / sin permiso**.

**Variables de entorno (`.env`):** la app sigue usando el prefijo **`REACT_APP_*`** (no se
renombró a `VITE_*` en la migración; ver nota en `vite.config.js`). Se necesitan las claves
de Firebase del Portal (`REACT_APP_FIREBASE_*`), del ERP (`REACT_APP_ERP_FIREBASE_*`) y de
pagos/Cloudinary. Sin un `.env` válido la app arranca pero no conecta a backend.

Scripts con credenciales (requieren `GOOGLE_APPLICATION_CREDENTIALS` → service account de
`sistema-gestion-3b225`). El **bootstrap de admin ya se ejecutó** (el admin claim está
asignado); el **backfill de vendor/nicho aún NO se ha corrido**:

```bash
node scripts/set-admin-claims.js yorh001@gmail.com heyeru24@gmail.com   # bootstrap admin (ya hecho)
node scripts/backfill-vendor-niche.js --dry                            # simula backfill (pendiente)
node scripts/backfill-vendor-niche.js                                  # aplica backfill (pendiente)
```

---

## 9. Próximos pasos

Las **fases 0–5 ya están en producción**. El orden de lo que sigue es el de §7:

1. **🚨 Publicar las reglas de seguridad completas** (`firebase/firestore.rules.produccion`):
   respaldar las reglas vivas → fusionar/validar con las del ERP → probar en el Rules
   Playground → publicar → verificar portal **y** CRM. **Cierra la fuga de PII (lo más urgente).**
   Ver [PLAN-SEGURIDAD-REGLAS.md](./PLAN-SEGURIDAD-REGLAS.md).
2. **Reestructurar el dashboard** en páginas por área con rutas propias (resumen, heatmap,
   productos, origen, páginas, categorías); **arreglar el iframe de preview** (doble init de
   Firebase) y el **warning `willReadFrequently`** del canvas del heatmap.
3. **Cerrar residuales de Fase 0**: `orders create` público, `product_reviews update`,
   PayPal/precio server-side.
4. **Activar el cobro REAL (Fase 3):** configurar `MERCADOPAGO_ACCESS_TOKEN`,
   `MP_WEBHOOK_URL`, `MP_BACK_URL_BASE` e integrar `CheckoutPage` al flujo de subórdenes/split.
5. **Conectar servicios externos y automatización:** push v2 (FCM HTTP v1), Cloud Scheduler /
   cron para segmentación y campañas, índice de búsqueda (Algolia/Typesense); ejecutar
   `backfill-vendor-niche.js` y emitir el rol `vendor`; scoping por dueño/rol en reglas (Fase C).
6. **Cerrar Fase 4:** integrar `productionArt` en `EditorPage`, generar el PDF de producción
   y arreglar `finalCustomizedImage`.

Ver roadmap completo y decisiones técnicas en [PLAN-MAESTRO.md](./PLAN-MAESTRO.md); el detalle
de funciones por usuario, en [FUNCIONES-CLIENTE.md](./FUNCIONES-CLIENTE.md) y
[FUNCIONES-ADMIN.md](./FUNCIONES-ADMIN.md).
