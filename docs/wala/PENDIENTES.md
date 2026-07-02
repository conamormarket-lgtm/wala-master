# Pendientes del DUEÑO — qué desplegar / actualizar (Cloud Shell + consola)

> **Para el dueño (no requiere programar).** Esta es la lista corta y clara de lo que **falta
> hacer del lado de producción** para que lo construido en las sesiones del **2026-06-29**, del
> **2026-07-01/02** (integridad de datos + analítica), del **2026-07-02** (módulos **Sorteos/Rifas**
> y **Enlaces útiles**, §3.bis) y del **2026-07-02 (tarde)** (**Sorteo por suscripción** + Gestión de
> Pagos + Usuarios de la App, §3.ter — **ya casi todo desplegado**) quede 100 % activo. El **frontend ya está
> desplegado** (Vercel auto-deploy desde `master`); lo que queda es **backend** (Cloud Functions),
> un **script de rescate opcional** y un par de **confirmaciones de configuración**.
>
> Regla de oro del proyecto: **producción primero se respalda, después se toca** (ver
> [README.md](./README.md) y [ops/backup](../../ops/backup/README.md)). Y **nunca** se despliegan
> reglas (`firestore:rules`) tal cual sin fusionarlas con las del ERP (ver
> [PRUEBAS-Y-DEBUGGING.md §6](./PRUEBAS-Y-DEBUGGING.md) y
> [DESPLIEGUE-ESTADO.md](./DESPLIEGUE-ESTADO.md)).

**Proyecto de producción:** `sistema-gestion-3b225` (ÚNICO; NO `pruebas-cd728`). Portal y ERP
comparten ese proyecto y la misma base Firestore.

Leyenda: ✅ hecho · 🔧 parcial · ⬜ por hacer.

---

## 1. Desplegar las 2 Cloud Functions de AGREGACIÓN de analítica (sesión 2026-07-01) ✅ HECHO

**✅ EJECUTADO por el dueño el 2026-07-02** (junto con `getPublicGiftRegistry`): las 3 funciones
se actualizaron con "Successful update operation". Desde ese despliegue, el doc diario incluye los
desgloses nuevos. Los días ANTERIORES al despliegue siguen mostrando "sin datos" en los desgloses
salvo que se corra el backfill (§1-bis). Se conserva el comando por referencia:

En **Cloud Shell**, desde la carpeta del proyecto:

```bash
firebase deploy \
  --only functions:aggregateAnalyticsDaily,functions:aggregateAnalyticsDailyBackfill \
  --project sistema-gestion-3b225
```

- **Si te pregunta si borrar funciones/índices del ERP → responde `N` (No).** Son del ERP/CRM
  compartido (ver [DESPLIEGUE-ESTADO.md §4](./DESPLIEGUE-ESTADO.md)).
- Es **aditivo e idempotente**: la versión nueva agrega campos al doc diario
  (`byCountry`, `byCountryAprox`, `byDevice`/`byBrowser`/`byOS`, `byClientType`,
  `identitiesTotal`/`identitiesLoggedIn`/`identitiesAnon`, `funnelFull`, `topIdentities`);
  no toca pagos ni pedidos. Ver [MODELO-DATOS.md §3.8](./MODELO-DATOS.md).
- Desplegar **no rompe nada si tarda**: mientras tanto el dashboard sigue funcionando con los
  agregados viejos y sus avisos honestos.

### 1-bis. (Opcional) Backfill analítico del histórico ⬜

Tras el redeploy, puedes **re-agregar días pasados** llamando la función callable
`aggregateAnalyticsDailyBackfill` (solo admin; acepta `{ day }` o `{ fromDay, toDay }`, máximo
120 días por llamada). Eso añade a los días viejos los campos que el histórico permite —en
particular **`byCountryAprox`** (país aproximado por zona horaria) y el **embudo completo sin el
tope de 5000**—. Los campos que dependen de la **captura nueva** del cliente (`geoSource` por IP,
`device`/`browser`/`os` de sesión, metadatos del heatmap) **solo existen desde el 2026-07-01**:
para fechas anteriores seguirán los avisos de "sin datos", y es lo esperado.

---

## 2. Script de RESCATE del historial (productos borrados ANTES del soft-delete) ⬜

Desde el 2026-07-01, **"eliminar" un producto ya no borra nada físico** (soft-delete/tombstone; el
historial del cliente no se rompe). Pero los productos **borrados físicamente ANTES** de ese cambio
siguen dejando huecos (imagen rota / "S/ 0.00") en Mis Compras, wishlists y `/regalar`. Para
repararlos existe **`scripts/rescate-historial.js`**:

```bash
# 1) SIEMPRE primero en seco (no escribe nada, solo reporta):
node scripts/rescate-historial.js --project sistema-gestion-3b225

# 2) Si el reporte se ve bien, aplicar:
node scripts/rescate-historial.js --project sistema-gestion-3b225 --apply
```

- Reconstruye **tombstones** (`{ name, price, visible:false, deleted:true, deletedAt,
  rescatado:true }`) en `productos_wala` a partir de los snapshots de wishlists/pedidos, y limpia
  URLs de imagen muertas en las wishlists.
- **SOLO escribe en `productos_wala` y `wishlists`** (colecciones del portal). No toca pedidos,
  pagos ni nada del ERP.
- Es **idempotente**: una segunda corrida no duplica nada (los tombstones ya existen).
- **Respaldo antes de `--apply`** (regla de oro).

---

## 3. Cloud Functions de la sesión 2026-06-29 — estado 🔧

1. ✅ **`getPublicGiftRegistry` — redeploy HECHO por el dueño (2026-07-01).** La página pública
   `/regalar` ya recibe la **foto de la persona** (`recipientPhoto`/`roleKey`/`gender`) y el
   **precio snapshot** de cada item (`price`, añadido en el ciclo de integridad — evita el
   `S/ 0.00` en productos borrados).
2. 🔧 **Sync de pago a la FUENTE DE VERDAD** (`wala_pedidos.estadoWala`) — **confirmar si ya se
   desplegó**: son las 3 funciones de confirmación de pago (`processCulqiPayment`, `culqiWebhook`,
   `capturePaypalOrderSecure`, con `marcarWalaPedidoPagado`). Si aún no, en Cloud Shell:

   ```bash
   firebase deploy \
     --only functions:processCulqiPayment,functions:culqiWebhook,functions:capturePaypalOrderSecure \
     --project sistema-gestion-3b225
   ```

   **Cómo saber si falta:** paga un pedido de prueba y mira "Mis Compras" — si tras pagar sigue
   en "Por confirmar pago" al recargar, falta este redeploy (ver
   [PRUEBAS-Y-DEBUGGING.md](./PRUEBAS-Y-DEBUGGING.md)). Aditivo, idempotente y best-effort: no
   cambia montos ni la firma del pedido.

---

## 3.bis Cloud Functions de los módulos SORTEOS y ENLACES ÚTILES (sesión 2026-07-02) ⬜

> **Frontend YA en vivo** (Vercel): `/sorteos`, `/admin/sorteos`, `/admin/sorteos/:id`, `/l/:slug`,
> `/admin/enlaces`, `/admin/enlaces/:id`. Falta **solo** desplegar sus **Cloud Functions** desde Cloud Shell.

⬜ **Desplegar las 13 Cloud Functions de ambos módulos** (9 de Sorteos + 2 de Enlaces + las ramas
"sorteo" que ganaron `processCulqiPayment` y `culqiWebhook`). En **Cloud Shell**, desde la carpeta del
proyecto, **comando único**:

```bash
firebase deploy --only functions:participarSorteoGratis,functions:comprarTicketSorteoSecure,functions:asignarTicketsManual,functions:createPaypalTicketSorteoSecure,functions:capturePaypalTicketSorteoSecure,functions:decidirGanadoresSorteo,functions:sumarChanceCompartir,functions:claimRaffleReferralSecure,functions:grantRaffleChancesSecure,functions:processCulqiPayment,functions:culqiWebhook,functions:registrarClicEnlace,functions:registrarVisitaEnlace
```

- **Si te pregunta si borrar funciones/índices del ERP → responde `N` (No).** Borrar cualquier función
  fuera de la lista **tumbaría el ERP** (ver [DESPLIEGUE-ESTADO.md §4](./DESPLIEGUE-ESTADO.md)).
- Es **aditivo**: las 9 de Sorteos y las 2 de Enlaces son nuevas; `processCulqiPayment`/`culqiWebhook`
  solo ganan una **rama "sorteo"** y no cambian el camino de pago de pedidos.
- **Cómo saber si falta:** entra a `/sorteos` e intenta participar/comprar un ticket, o abre un `/l/:slug`
  y mira si suben las visitas/clics en la Analítica del editor. Si no responde, falta este despliegue.
- Detalle funcional en [SORTEOS-Y-RIFAS.md](./SORTEOS-Y-RIFAS.md) y [ENLACES-UTILES.md](./ENLACES-UTILES.md);
  comando y tabla en [DESPLIEGUE-ESTADO.md §3.bis](./DESPLIEGUE-ESTADO.md).

⬜ **Reglas Firestore de `sorteos` y `link_pages` — escritas pero NO desplegadas (solo con permiso).**
El repo (`firebase/firestore.rules`) ya contempla **`sorteos`** (read público / write admin; subcolecciones
`participantes`/`tickets`/shards `write: if false`) y **`link_pages`** (read público / write admin;
subcolección `clics` read público / `write: if false` — solo la CF vía Admin SDK escribe los contadores).
**NO desplegarlas a ciegas**: hay que **fusionarlas** con las reglas vivas del ERP y validarlas en Rules
Playground (misma precaución que el resto de §4). Regla dura: **nunca** `deploy --only firestore:rules` sin
permiso explícito del dueño.

---

## 3.ter Módulo SORTEO POR SUSCRIPCIÓN — casi listo, faltan 2 pasos del dueño 🔧

> **Todo lo de código YA está DESPLEGADO** (a diferencia de §3.bis): **frontend** (Vercel), las
> **9 Cloud Functions** (8 de suscripción + `processCulqiPayment` con el fix del enlace), las
> **reglas Firestore de suscripción** (deploy OK, acotado) y los **índices** `collectionGroup`. Ver
> [DESPLIEGUE-ESTADO.md §3.ter](./DESPLIEGUE-ESTADO.md). Quedan **solo 2 pasos del dueño**, ninguno
> de programación.

⬜ **(1) Registrar el webhook de PayPal.** `paypalSubscriptionWebhook` es **FAIL-CLOSED**: sin el
`PAYPAL_WEBHOOK_ID` verifica la firma y **rechaza todo** (así ningún cobro puede forjarse). Para
encenderlo:

1. En **PayPal Developer** → tu app → **Webhooks**, registrar la URL
   `https://us-central1-sistema-gestion-3b225.cloudfunctions.net/paypalSubscriptionWebhook`
   (eventos de **Billing subscription** / **Payment sale completed**).
2. Copiar el **Webhook ID** y ponerlo como `PAYPAL_WEBHOOK_ID` en
   `functions/.env.sistema-gestion-3b225` (mismo archivo de secretos que Culqi).
3. Redeploy solo del webhook, en Cloud Shell:

   ```bash
   firebase deploy --only functions:paypalSubscriptionWebhook --project sistema-gestion-3b225
   ```

⬜ **(2) Crear la campaña de suscripción** con slug **`suscrito-sorteo`** desde
**`/admin/sorteos-suscripcion`** (planes con `precioCentimos` en **céntimos PEN enteros**, premios,
beneficios, colores, `numGanadores`) y pasarla a **`estado: activo`**. Sin campaña, las páginas
públicas `/suscrito-sorteo` y `/suscrito-sorteo/:slug` no tienen qué mostrar.

- **Culqi / Perú NO necesita config extra**: usa el `CULQI_SECRET_KEY` ya presente y el CRON diario
  `cobrarSuscripcionesCulqi` (`0 9 * * *` America/Lima) cobra las renovaciones vencidas solo.
- **Cómo saber si funciona:** entra a `/suscrito-sorteo/suscrito-sorteo`, suscríbete con una tarjeta
  de prueba (Culqi) y verifica que aparezca en `/admin/sorteos-suscripcion/:id` como suscriptor
  `activo`; para PayPal, que el webhook registre el evento y lo deje `activo`.
- Detalle funcional en [SORTEO-POR-SUSCRIPCION.md](./SORTEO-POR-SUSCRIPCION.md).

> **Nota:** los módulos **Gestión de Pagos** (`/admin/gestion-pagos`) y **Usuarios de la App**
> (`/admin/usuarios-app`) del mismo ciclo **no requieren ningún paso del dueño**: son frontend +
> servicios ya desplegados (el fix del `enlaces_pago` viaja dentro de `processCulqiPayment`, ya
> desplegado en §3.ter).

---

## 4. Confirmar las REGLAS de Firestore en producción 🔧

> **NUNCA `deploy --only firestore:rules` sin consultar.** Tumbó el ERP una vez (base compartida
> sin Firebase Auth). Esta sección es para **CONFIRMAR**, no para desplegar a ciegas.

Hay **tres** archivos de reglas en el repo (`firebase/`), y es clave saber **cuál está vivo**:

| Archivo | Borrado de `wala_pedidos` y demás | Cuándo usarlo |
|---|---|---|
| **`firebase/firestore.rules`** | `delete: if isAdmin()` (modelo restrictivo, sin catch-all abierto) | ✅ **El que debe estar en producción** |
| `firebase/firestore.rules.produccion` | catch-all `match /{document=**} { allow read, write: if isAuth() }` → **`delete: if isAuth()`** | ⚠️ Modelo abierto a cualquier logueado |
| `firebase/firestore.rules.propuesto` | Cierra el `update` de `pedidos_web` | ⬜ **Guardado pero NO desplegado** |

- ⬜ **Confirmar que en producción esté el equivalente a `firebase/firestore.rules`**
  (`delete: if isAdmin()`) y **NO** `firestore.rules.produccion` (`delete: if isAuth()`). La
  colección **`wala_pedidos` es la FUENTE DE VERDAD y jamás debe poder borrarla un cliente
  logueado** — solo admin (o, idealmente, nadie).
- ⬜ **Nueva regla `analytics_daily` (sesión 2026-07-01):** el repo (`firebase/firestore.rules`)
  ya incluye `match /analytics_daily/{id} { allow read: if isAdmin(); allow write: if false; }`
  — **NO desplegada** (regla de la casa). Cuando toque un despliegue de reglas (fusionado con las
  del ERP y validado en Rules Playground), incluirla.
- ⬜ **`firestore.rules.propuesto` queda guardado pero NO se despliega todavía.**
  **Precondición:** que **PayPal esté validado server-side** (cierra el `update` de `pedidos_web`
  que hoy aún necesita el flujo de pago). Ver
  [PLAN-SEGURIDAD-REGLAS.md](./PLAN-SEGURIDAD-REGLAS.md) y
  [ESTADO-DEL-PROYECTO.md](./ESTADO-DEL-PROYECTO.md).
- Cualquier despliegue de reglas debe **fusionarse** antes con las reglas vivas del ERP/CRM (el
  repo no cubre las decenas de colecciones del ERP) y validarse en **Rules Playground**.

---

## 5. FASE SIGUIENTE — Endpoint con API KEY para el ERP ⬜

> **No hecha. El campo ya está listo; falta el endpoint/credencial.**

La base interna **`wala_pedidos`** ya es la **FUENTE DE VERDAD** con su propio `estadoWala`
(`pendiente_pago → pagado → en_preparacion → enviado → entregado`; `cancelado` terminal). El
siguiente paso es conectar el **ERP externo** para que la mantenga al día **sin poder borrarla**:

- ⬜ **Endpoint protegido con API KEY** que permita al ERP **LEER** los pedidos y **SOLO
  ACTUALIZAR el estado** (`estadoWala`) — **jamás borrar**.
- El frontend ya expone `updateWalaOrderEstado({ numeroPedido, pedidoWebId, estado, extra })` en
  `src/services/walaOrders.js` (idempotente, best-effort), así que la lógica de actualización ya
  existe; lo que falta es el **endpoint + la credencial** del lado del ERP.
- Detalle del flujo y del contrato en [FLUJO-PEDIDOS.md](./FLUJO-PEDIDOS.md) (§4-bis) y modelo en
  [MODELO-DATOS.md](./MODELO-DATOS.md) (§3.7).

---

## 6. Recordatorio de lo que NO toca la tanda 2026-07-01/02

- **No** hay cambios de **montos, pagos ni firma del pedido**: el soft-delete, los snapshots, la
  captura de analítica, el dashboard con filtros y el panel "Ver qué hacen los usuarios" son
  **aditivos**.
- **No** se desplegaron **reglas** ni **Storage** (la regla `analytics_daily` solo se añadió al
  repo).
- Todo el ciclo es **frontend ya en vivo** (Vercel) **salvo** las 2 functions de agregación (§1).
- El panel "👥 Ver qué hacen los usuarios" **no requiere índices Firestore nuevos**.

---

## 7. Checklist rápido (marca al terminar)

- [ ] Respaldo hecho antes de tocar producción (regla de oro).
- [x] `firebase deploy --only functions:aggregateAnalyticsDaily,functions:aggregateAnalyticsDailyBackfill --project sistema-gestion-3b225` — **hecho por el dueño el 2026-07-02**.
- [ ] Probado: al día siguiente (o tras un backfill del día anterior), en el dashboard aparecen **País / Dispositivo / Navegador / SO / App vs Web** y el **Top visitantes**.
- [ ] (Opcional) Backfill del histórico con `aggregateAnalyticsDailyBackfill` (§1-bis).
- [x] `node scripts/rescate-historial.js` dry-run + `--apply` — **hecho por el dueño el 2026-07-02**: 6 tombstones creados (Termo Stanley con price 90 recuperado, SITCH PURO BICOLOR, POLOS CON FOTO, COMBO CHIBIS, Taza Barcelona, Polera básica), 6 imágenes muertas limpiadas y 6 prices backfilleados en 4 wishlists. Hallazgo: de 10 032 docs en `pedidos`, **0 conservan marcadores WALA** (confirma que el ERP los quita al absorber).
- [x] Redeploy de `getPublicGiftRegistry` (foto + `price` en `/regalar`) — **hecho por el dueño**.
- [ ] Confirmado el estado del sync de pago (`estadoWala`): pagar un pedido y ver que en "Mis Compras" queda **"Pagado"** y **persiste**; si no, redeploy de las 3 funciones de pago (§3.2).
- [ ] Desplegadas las **13 Cloud Functions de Sorteos + Enlaces** con el comando único (§3.bis), respondiendo `N` a los prompts de borrado.
- [ ] Probado: en `/sorteos` se puede participar/comprar ticket y "Decidir ganadores"; en un `/l/:slug` suben visitas/clics en la Analítica del editor.
- [ ] Reglas de `sorteos` y `link_pages` **NO** desplegadas a ciegas (§3.bis / §4): solo con permiso, fusionadas con las del ERP y validadas en Rules Playground.
- [x] **Sorteo por suscripción**: 9 CFs + reglas de suscripción + índices `collectionGroup` **desplegados** (§3.ter / [DESPLIEGUE-ESTADO.md §3.ter](./DESPLIEGUE-ESTADO.md)).
- [ ] **Sorteo por suscripción — webhook de PayPal**: registrar la URL, poner `PAYPAL_WEBHOOK_ID` en `functions/.env.sistema-gestion-3b225` y **redeploy de `paypalSubscriptionWebhook`** (§3.ter). Culqi/Perú ya opera sin esto.
- [ ] **Sorteo por suscripción — crear la campaña** con slug `suscrito-sorteo` en `/admin/sorteos-suscripcion` y ponerla `activa` (§3.ter).
- [ ] Confirmado que producción tiene `firebase/firestore.rules` (`delete: if isAdmin()`) y **NO** `firestore.rules.produccion`.
- [ ] `firestore.rules.propuesto` **NO** desplegado (esperando PayPal server-side); la regla `analytics_daily` del repo queda para el próximo despliegue fusionado de reglas.
- [ ] (Futuro) Endpoint con API KEY para que el ERP actualice `estadoWala` sin borrar.

---

> Documentos relacionados: [PRUEBAS-Y-DEBUGGING.md](./PRUEBAS-Y-DEBUGGING.md) (qué probar tras
> desplegar), [DESPLIEGUE-ESTADO.md](./DESPLIEGUE-ESTADO.md) (qué está desplegado y qué falta),
> [DESPLIEGUE.md](./DESPLIEGUE.md) (procedimiento), [FLUJO-PEDIDOS.md](./FLUJO-PEDIDOS.md) y
> [MODELO-DATOS.md](./MODELO-DATOS.md) (`wala_pedidos`/`estadoWala`, tombstones y analítica §3.8),
> [PLAN-SEGURIDAD-REGLAS.md](./PLAN-SEGURIDAD-REGLAS.md) (las reglas) y
> [README.md](./README.md) (índice).
