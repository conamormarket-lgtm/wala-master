# Estado de Despliegue — WALA (actualizado 2026-06-25)

> **Documento único de verdad** sobre qué está hecho, qué está desplegado y qué falta.
> Reemplaza cualquier banner anterior que dijera "nada desplegado".

## 0. Topología real de producción (IMPORTANTE)

- **Proyecto Firebase de producción = `sistema-gestion-3b225`** (NO `pruebas-cd728`).
- Es un **ERP/CRM grande y multi-tenant** (colecciones `clientes`, `chats_atc`, `mb_*`,
  `catalogo_ofertas`, `embudos_funnels`, `cobros_atribuidos`, `pedidos`, `pedidos_web`, etc.)
  que **comparte proyecto y base Firestore** con el portal de la tienda.
- La web **wala.pe** la sirve **Vercel** (proyecto `portal-clientes-regala-con-amor`), con
  `REACT_APP_FIREBASE_PROJECT_ID = sistema-gestion-3b225` (horneado en build → cambiar env exige Redeploy).
- `pruebas-cd728` quedó con funciones huérfanas de un deploy equivocado; **no se usa, no tocar**.

## 1. Fases de desarrollo (código) — TODAS HECHAS y verificadas en emulador

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Seguridad (claims, reglas, economía server-authoritative, 11 hallazgos) | ✅ |
| 1 | Plataforma: CRA→Vite, base multi-vendor/nicho, búsqueda con facetas, UI nichos/vendedores | ✅ |
| 2 | Fidelización core: misiones diarias, racha/check-in, ledger de puntos | ✅ |
| 2b | Tiers/niveles + catálogo de recompensas dinámico + canje | ✅ |
| 3 | Marketplace: pedido + sub-órdenes por vendedor + comisión + envíos + payouts | ✅ |
| 3 (pago) | Split de pago Mercado Pago (marketplace_fee) — simulado en local | ✅ |
| 4 | POD base: blueprints + utilidad de arte de producción | ✅ (base) |
| 5 | Impulso: cofre diario + segmentación RFM + ofertas flash | ✅ (base) |

Rama: `origin/fase-0-seguridad`. Último commit relevante: `35ba2a2` (fix de producción).

## 2. Estado de DESPLIEGUE a producción (`sistema-gestion-3b225`)

| Artefacto | Estado | Notas |
|---|---|---|
| **Frontend (wala.pe / Vercel)** | ✅ en vivo (commit `350c79a`) | ⏳ Falta **re-promover `35ba2a2`** para iconos PWA + placeholders locales |
| **Cloud Functions** | ✅ desplegadas (2026-06-25) | Kapi/juegos/misiones/cofre/pedidos OK. Se conservaron las 6 funciones del ERP (dije `N` a borrar) |
| **Índices Firestore** | ✅ desplegados | Índice de Wordle creado (tarda minutos en construirse). Se conservaron los del ERP/CRM |
| **Reglas Firestore** | ⛔ **NO desplegar tal cual** | El repo NO cubre las decenas de colecciones del ERP/CRM → las bloquearía. **Hay que FUSIONAR** con las reglas vivas |
| **Secretos de Functions** | ⬜ pendiente | Sin `CULQI_SECRET_KEY`/`ERP_SERVICE_ACCOUNT` en este proyecto → `processCulqiPayment` y `secureClaimMonedas` quedan *fail-closed* |
| **Admin claims** | ⬜ pendiente | Asignar `admin:true` a tu cuenta en `sistema-gestion-3b225` |
| **Storage** | ⏭️ omitido | Firebase Storage no activado; la app no lo usa en este proyecto |

## 3. Qué toca hacer (en orden)

1. **Verificar el Kapi y el Wordle en wala.pe** (ya deberían funcionar tras el deploy de funciones+índices).
2. **Re-promover el frontend `35ba2a2`** en Vercel → arregla el ícono de la app (PWA) y las imágenes rotas (placeholder local).
3. **Secretos de Functions** (Cloud Shell): crear `functions/.env.sistema-gestion-3b225` con
   `CULQI_SECRET_KEY` (pagos) y `ERP_SERVICE_ACCOUNT` (reclamo de monedas por pedido / referidos),
   opcional `MERCADOPAGO_ACCESS_TOKEN`+`MP_*`, `ERP_WEBHOOK_SECRET`+`ERP_ALLOWED_ORIGIN`; redeploy de functions.
   → Restaura Culqi y el reclamo de monedas por pedido.
4. **Reglas (con cuidado)**: exportar las **reglas vivas** de `sistema-gestion-3b225` desde la consola,
   **fusionar** nuestras colecciones de portal nuevas (flashOffers, missions, rewardsCatalog, niches,
   vendors, blueprints, loyaltyLedger, userMissions, subOrders, payouts, shippingZones, userCoupons,
   tiers…) en ellas **sin quitar** las del ERP/CRM, validar en Rules Playground y desplegar.
   → Habilita la lectura de las funciones nuevas del portal (ofertas, misiones, etc.) + cierra la economía.
5. **Admin claims** en `sistema-gestion-3b225` para tu cuenta → acceso al panel `/admin`.
6. **Pendientes que requieren servicios externos** (no urgentes): cobro real Mercado Pago, búsqueda
   Algolia/Typesense, push FCM segmentado, schedulers, integración del editor POD (Fase 4 arte/PDF).

## 3.bis Cloud Functions de los módulos SORTEOS y ENLACES ÚTILES (2026-07-02) ⬜

> **Frontend YA desplegado** (Vercel, auto-deploy desde `master`): `/sorteos`, `/admin/sorteos`,
> `/admin/sorteos/:id`, `/l/:slug`, `/admin/enlaces`, `/admin/enlaces/:id`. Falta **solo** desplegar
> las **Cloud Functions** de ambos módulos, que **el dueño ejecuta desde Cloud Shell**.

Son **13 funciones** (9 de Sorteos + 2 de Enlaces + las 2 de pago que ganaron una rama "sorteo"):

| Módulo | Cloud Functions |
|---|---|
| **Sorteos / Rifas** | `participarSorteoGratis`, `comprarTicketSorteoSecure`, `asignarTicketsManual`, `createPaypalTicketSorteoSecure`, `capturePaypalTicketSorteoSecure`, `decidirGanadoresSorteo`, `sumarChanceCompartir`, `claimRaffleReferralSecure`, `grantRaffleChancesSecure` |
| **Sorteos — pago (ramas nuevas)** | `processCulqiPayment` (rama `metadata.tipo==="sorteo"`, guardia anti-doble-cargo), `culqiWebhook` (rama sorteo, idempotencia por `chargeId`) |
| **Enlaces útiles** | `registrarClicEnlace`, `registrarVisitaEnlace` (únicos emisores de `link_click`/`link_page_view`) |

**Comando único de despliegue (desde la carpeta del proyecto en Cloud Shell):**

```bash
firebase deploy --only functions:participarSorteoGratis,functions:comprarTicketSorteoSecure,functions:asignarTicketsManual,functions:createPaypalTicketSorteoSecure,functions:capturePaypalTicketSorteoSecure,functions:decidirGanadoresSorteo,functions:sumarChanceCompartir,functions:claimRaffleReferralSecure,functions:grantRaffleChancesSecure,functions:processCulqiPayment,functions:culqiWebhook,functions:registrarClicEnlace,functions:registrarVisitaEnlace
```

- **Si te pregunta si borrar funciones/índices → responde `N` (No).** Son del ERP/CRM compartido; borrar
  cualquier función que no esté en la lista **tumbaría el ERP** (ver §4).
- Es **aditivo**: las 9 funciones de Sorteos y las 2 de Enlaces son nuevas; `processCulqiPayment` y
  `culqiWebhook` solo **ganan una rama "sorteo"** y no cambian el camino de pago de pedidos.
- **NUNCA** desplegar `firestore:rules` en el mismo golpe: las reglas de `sorteos` y `link_pages` están
  **escritas pero NO desplegadas** (la base es compartida con el ERP que corre **sin Firebase Auth**;
  desplegar reglas tumbó el ERP una vez). Regla dura: **no desplegar reglas sin permiso explícito del dueño.**
- Detalle funcional en [SORTEOS-Y-RIFAS.md](./SORTEOS-Y-RIFAS.md) y [ENLACES-UTILES.md](./ENLACES-UTILES.md);
  checklist del dueño en [PENDIENTES.md](./PENDIENTES.md).

## 3.ter Cloud Functions del módulo SORTEO POR SUSCRIPCIÓN (2026-07-02, tarde) ✅ DESPLEGADO

> **Todo DESPLEGADO** en este ciclo: **frontend** (Vercel), **9 Cloud Functions**, **reglas
> Firestore de suscripción** (el deploy de reglas salió **OK** esta vez, acotado a las colecciones
> nuevas) e **índices** `collectionGroup`. Queda **un solo paso del dueño**: registrar el webhook de
> PayPal (ver abajo).

Además del módulo de suscripción se sumaron **Gestión de Pagos** (`/admin/gestion-pagos`, unifica
métodos + generar enlace + historial/analíticas) y **Usuarios de la App** (`/admin/usuarios-app`);
ambos son **frontend + servicios**, no traen Cloud Functions propias (el fix del enlace vive en
`processCulqiPayment`, incluido en el comando de abajo).

Son **9 funciones** (8 nuevas de suscripción + `processCulqiPayment`, que ganó el marcado del
`enlaces_pago/{enlaceId}` como pagado):

| Módulo | Cloud Functions |
|---|---|
| **Sorteo por suscripción** | `crearSuscripcionCulqi`, `cobrarSuscripcionesCulqi` (`onSchedule "0 9 * * *"` America/Lima), `crearSuscripcionPaypal`, `confirmarSuscripcionPaypal`, `paypalSubscriptionWebhook`, `decidirGanadoresSuscripcion`, `cancelarSuscripcion`, `grantChancesSuscripcion` |
| **Pago (rama nueva)** | `processCulqiPayment` (marca `enlaces_pago/{enlaceId}` como pagado tras el cobro) |

**Comando único de despliegue (ya EJECUTADO por el dueño en Cloud Shell):**

```bash
firebase deploy --only functions:crearSuscripcionCulqi,functions:cobrarSuscripcionesCulqi,functions:crearSuscripcionPaypal,functions:confirmarSuscripcionPaypal,functions:paypalSubscriptionWebhook,functions:decidirGanadoresSuscripcion,functions:cancelarSuscripcion,functions:grantChancesSuscripcion,functions:processCulqiPayment --project sistema-gestion-3b225
```

Y los **índices** `collectionGroup` (también DESPLEGADOS):

```bash
firebase deploy --only firestore:indexes --project sistema-gestion-3b225
```

- **Índices desplegados:** `collectionGroup(suscriptores)` `(estado, proximoCobro)` — usado por el
  CRON `cobrarSuscripcionesCulqi` — y `(estado, vigenciaHasta)` — usado al elegir elegibles en
  `decidirGanadoresSuscripcion` (`firestore.indexes.json`).
- **Si te pregunta si borrar funciones/índices del ERP → responde `N` (No).** Borrar cualquiera fuera
  de la lista **tumbaría el ERP** (ver §4).
- Es **aditivo**: las 8 de suscripción son nuevas; `processCulqiPayment` solo suma el marcado del
  enlace y **no cambia** el camino de pago de pedidos ni el pago único.

### ⬜ PENDIENTE del dueño — registrar el webhook de PayPal (único paso que falta)

`paypalSubscriptionWebhook` es **FAIL-CLOSED**: sin `PAYPAL_WEBHOOK_ID` verifica la firma y **rechaza
todo**. Para activarlo:

1. En el panel de **PayPal Developer** → tu app → **Webhooks**, registrar la URL
   `https://us-central1-sistema-gestion-3b225.cloudfunctions.net/paypalSubscriptionWebhook` y
   suscribir los eventos de **Billing subscription** / **Payment sale completed**.
2. Copiar el **Webhook ID** que genera PayPal y ponerlo como `PAYPAL_WEBHOOK_ID` en
   `functions/.env.sistema-gestion-3b225` (mismo archivo de secretos que Culqi).
3. **Redeploy** solo del webhook:

   ```bash
   firebase deploy --only functions:paypalSubscriptionWebhook --project sistema-gestion-3b225
   ```

- **Culqi / Perú NO requiere config extra** (usa el `CULQI_SECRET_KEY` ya presente; el CRON diario
  cobra renovaciones sin más).
- **NUNCA** en el mismo golpe con `firestore:rules` de otras colecciones: aquí las reglas de
  suscripción **sí** se desplegaron OK porque van **acotadas** a las colecciones nuevas; el resto de
  reglas del ERP sigue bajo la regla dura (no desplegar sin permiso, ver §4).
- Detalle funcional en [SORTEO-POR-SUSCRIPCION.md](./SORTEO-POR-SUSCRIPCION.md); checklist del dueño en
  [PENDIENTES.md](./PENDIENTES.md).

## 4. Reglas de oro aprendidas (para no repetir errores)

- **Siempre desplegar con `--project sistema-gestion-3b225`** (ya corregido en `.firebaserc` y `package.json`).
- **Nunca** responder `y` (sí) a "borrar funciones/índices" → son del ERP/CRM. Siempre **`N`**.
- **Nunca** desplegar `firestore:rules` ni `storage` a este proyecto sin fusionar antes con lo vivo.
- Cambios de env en Vercel requieren **Redeploy** (Vite hornea las variables en build-time).
