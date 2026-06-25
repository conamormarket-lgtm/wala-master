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

## 4. Reglas de oro aprendidas (para no repetir errores)

- **Siempre desplegar con `--project sistema-gestion-3b225`** (ya corregido en `.firebaserc` y `package.json`).
- **Nunca** responder `y` (sí) a "borrar funciones/índices" → son del ERP/CRM. Siempre **`N`**.
- **Nunca** desplegar `firestore:rules` ni `storage` a este proyecto sin fusionar antes con lo vivo.
- Cambios de env en Vercel requieren **Redeploy** (Vite hornea las variables en build-time).
