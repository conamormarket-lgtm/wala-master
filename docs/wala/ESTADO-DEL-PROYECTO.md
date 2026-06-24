# Estado del proyecto WALA — Panorama ejecutivo

> Documento vivo de **estado general**. Resume qué es Wala, qué trabajo se ha hecho en esta
> iniciativa, en qué fase estamos, qué hay realmente desplegado y qué falta. Es el punto de
> entrada de alto nivel; el detalle vive en [PLAN-MAESTRO.md](./PLAN-MAESTRO.md),
> [FASE-0-SEGURIDAD.md](./FASE-0-SEGURIDAD.md), [MODELO-DATOS.md](./MODELO-DATOS.md),
> [BASELINE-PRODUCCION.md](./BASELINE-PRODUCCION.md), [DESPLIEGUE.md](./DESPLIEGUE.md) y la
> carpeta [`fases/`](./fases/README.md).
>
> **Convención de estado:** ✅ **HECHO** · 🔧 **EN PROGRESO** · ⬜ **POR HACER**.
> En lo HECHO se anota además el estado real: **cerrado**, **parcial** o **residual**.

---

## 1. Qué es Wala

Wala (marca legal **CATAS GROUP S.A.C. / "CON AMOR"**, también referida como "Regala Con
Amor") es un **marketplace peruano** construido sobre **React + Vite + Firebase +
Capacitor**, con el proyecto Firebase de producción `pruebas-cd728`. Hoy es, en la práctica,
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

## 2. Cronología del trabajo realizado en esta iniciativa

Todo lo siguiente se realizó **en esta iniciativa**, en la rama `fase-0-seguridad`, y está
**verificado en LOCAL** (no desplegado — ver §5). El orden refleja la secuencia real de
trabajo.

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

---

## 3. Tabla resumen de fases (0–5)

| Fase | Objetivo | Estado | Entregables principales |
|------|----------|--------|-------------------------|
| **0 — Estabilización y seguridad** | Sellar dinero/puntos manipulables, eliminar backdoor, reglas reales, economía server-side. Bloqueante de todo lo demás. | ✅ **HECHO (parcial)** | Commits `3d53501`, `9e84990`, `f0e4aa0`; custom claims; `firestore.rules`/`storage.rules` reescritas; CFs de economía + 44 tests; `scripts/set-admin-claims.js`. |
| **1 — Plataforma y datos base** | Migrar CRA→Vite, introducir `vendorId`/`nicheId`/`fulfillmentType` aditivos, búsqueda y paginación. | 🔧 **EN PROGRESO** | Commits `a3c4d66`, `a652f60`, `f188260`, `0f2414f`; `vite.config.js`; servicios niches/vendors/search; `backfill-vendor-niche.js`; páginas Search/Niche/Vendor. |
| **2 — Fidelización unificada** | Economía única sobre `loyaltyLedger`, misiones diarias, racha global, tiers/XP, push v2. | ⬜ **POR HACER** | (Planificado) `missions`/`userMissions`, `loyaltyConfig/global`, FCM HTTP v1 multicast. |
| **3 — Marketplace multi-vendor** | Entidad `vendors` + rol vendedor + panel, `order`/`subOrders`, split de pago, payouts, envíos por zona. | ⬜ **POR HACER** | (Planificado) Mercado Pago Marketplace / Stripe Connect, `payouts`, `ledger`, `shippingZones`. |
| **4 — Personalizados como nicho POD** | Arte de producción real (DPI/PDF), `blueprints` reutilizables, consolidar editores. | ⬜ **POR HACER** | (Planificado) pipeline de arte, medidas físicas/DPI, deprecar `YoryoPersonalizado`. |
| **5 — Impulso, FOMO e inteligencia** | Ruleta diaria + cofres, segmentación RFM, campañas programables, antifraude completo. | ⬜ **POR HACER** | (Planificado) `computeSegments`, `campaigns`, panel de economía. |

El detalle de cada fase está en la sección 6 del [PLAN-MAESTRO.md](./PLAN-MAESTRO.md) y en
el índice de [`fases/`](./fases/README.md).

---

## 4. Inventario de commits (rama `fase-0-seguridad`, `origin/master..HEAD`)

Del más nuevo al más viejo. Los stats son los reales del repositorio.

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

## 5. Estado de despliegue

> ⛔ **Nada está desplegado todavía.** El usuario **aún no tiene acceso a Firebase**; mover
> a Vercel/Firebase es un paso **posterior**.

Todo el trabajo de las fases 0 y 1 está **verificado únicamente en LOCAL**:

- `vite build` ejecuta correctamente (migración Vite verificada).
- Servidor de desarrollo en **http://localhost:3000** (`vite.config.js` → `server.port: 3000`).
- Tests de economía: **44/44 verdes** (`npm run test:functions`).
- Revisión adversarial con agentes sobre los cambios de seguridad.

Consecuencias mientras no haya acceso a Firebase:

- Las **reglas Firestore/Storage** reescritas en el repo **no están desplegadas**: el riesgo
  de "reglas fantasma" (repo ≠ producción) sigue vigente hasta que se desplieguen desde el
  repo (ver [DESPLIEGUE.md](./DESPLIEGUE.md)).
- Las **Cloud Functions** de economía existen y pasan tests, pero **no corren en producción**;
  la economía real sigue gobernada por lo que esté desplegado hoy.
- Los scripts que requieren credenciales (`scripts/set-admin-claims.js`,
  `scripts/backfill-vendor-niche.js`) **no se han ejecutado**: necesitan
  `GOOGLE_APPLICATION_CREDENTIALS` apuntando a la cuenta de servicio de `pruebas-cd728`.
- El backfill multi-vendor/nicho **no se ha aplicado**; en runtime los productos sin
  `vendorId`/`nicheId` se leen con los defaults de `src/constants/marketplace.js`.

Secuencia de salida a producción cuando haya acceso: **respaldar** (`ops/backup/`) →
**staging** → **desplegar** reglas/functions/hosting por separado (`ops/deploy/`,
[DESPLIEGUE.md](./DESPLIEGUE.md)) → **verificar** → **rollback** si falla (`ops/restore/`).

---

## 6. Riesgos residuales vigentes

Estos riesgos **siguen abiertos** (residuales o parciales), aun después de las fases 0–1, y
deben cerrarse antes o durante las fases siguientes. Referencias al runbook
[FASE-0-SEGURIDAD.md](./FASE-0-SEGURIDAD.md).

| Riesgo | Hallazgo | Estado | Nota |
|--------|----------|--------|------|
| **Reglas no desplegadas (repo ≠ prod)** | H-07/H-09 | 🔧 residual | Reescritas en repo, pero sin acceso a Firebase no están en producción; el desfase real persiste hasta desplegar. |
| **`orders`/pedidos con `create` público** | — | ⬜ abierto | La creación de pedidos sigue abierta; debe pasar por CF con recompute de totales server-side. |
| **`product_reviews` con `update` laxo** | — | ⬜ abierto | La actualización de reseñas no está suficientemente restringida; riesgo de manipulación de rating. |
| **Desync `monedas` vs `monedasActivas`** | H-06 | 🔧 parcial | La economía se movió a CF, pero la dualidad escalar (`monedas`) vs lotes TTL (`monedasActivas`) sigue; se resuelve al adoptar `loyaltyLedger` (Fase 2). |
| **Desync `monedas` (gastable) vs `kapiCoins` (XP)** | H-06 | ⬜ abierto | El header suma ambas pero solo `monedas` se gasta; unificación pendiente (Fase 2). |
| **Verificación real de retos/misiones** | H-04/H-06 | ⬜ abierto | Los `actionType` (compra/reseña/visita/compartir) aún no tienen emisor verificado server-side; antifraude pendiente. |
| **PayPal capturado en cliente / precio confiado al cliente** | H-11 | ⬜ abierto | Falta captura/validación server-side y recompute de monto (Fase 3). |
| **FCM `sendToDevice` deprecado** | H-10 | ⬜ abierto | Migración a `sendEachForMulticast` (HTTP v1) pendiente (Fase 2). |
| **Password = DNI en webhook de cuentas** | H-03 | ✅ cerrado | Resuelto migrando a **magic link / set-password**; webhook con secreto y CORS restringido. |
| **Backdoor admin / emails hardcodeados** | H-01 | ✅ cerrado | Eliminado; admin vía custom claims (`scripts/set-admin-claims.js` para bootstrap). Queda pendiente **ejecutar** el bootstrap cuando haya acceso. |

---

## 7. Cómo correr en local

Requisitos: **Node.js** (no instalado actualmente en la máquina del usuario — instalar
primero). Desde la raíz del repo:

```bash
npm install                 # instala dependencias (Vite + React)
npm run dev                 # servidor de desarrollo -> http://localhost:3000
npm run build               # build de producción (Vite) — verificado
npm run preview             # sirve el build para revisión
npm run test:functions      # tests de economía de Cloud Functions (44/44)
```

Scripts adicionales relevantes (`package.json`): `dev:3001` (Vite en puerto 3001),
`deploy:firestore-rules`, `deploy:storage-rules`, `deploy:functions`, `deploy:vercel` /
`deploy:vercel:prod` (estos de despliegue **no se usan todavía** — sin acceso a Firebase/Vercel).

**Variables de entorno (`.env`):** la app sigue usando el prefijo **`REACT_APP_*`** (no se
renombró a `VITE_*` en la migración; ver nota en `vite.config.js`). Se necesitan las claves
de Firebase del Portal (`REACT_APP_FIREBASE_*`), del ERP (`REACT_APP_ERP_FIREBASE_*`) y de
pagos/Cloudinary. Sin un `.env` válido la app arranca pero no conecta a backend.

Scripts con credenciales (requieren `GOOGLE_APPLICATION_CREDENTIALS` → service account de
`pruebas-cd728`; **no ejecutados aún**):

```bash
node scripts/set-admin-claims.js yorh001@gmail.com heyeru24@gmail.com   # bootstrap admin
node scripts/backfill-vendor-niche.js --dry                            # simula backfill
node scripts/backfill-vendor-niche.js                                  # aplica backfill
```

---

## 8. Próximos pasos

1. **Obtener acceso a Firebase** (`pruebas-cd728`) — desbloquea todo lo de abajo.
2. **Respaldar producción** con `ops/backup/` y fijar el baseline
   ([BASELINE-PRODUCCION.md](./BASELINE-PRODUCCION.md)).
3. **Desplegar Fase 0 a staging y luego a prod** (reglas → functions → hosting, una pieza a
   la vez, [DESPLIEGUE.md](./DESPLIEGUE.md)); **ejecutar el bootstrap de admin** y verificar
   que las reglas desplegadas coinciden con el repo (cierra el riesgo de reglas fantasma).
4. **Cerrar residuales de Fase 0**: `orders create` público, `product_reviews update`,
   FCM v1, PayPal/precio server-side.
5. **Terminar Fase 1**: ejecutar `backfill-vendor-niche.js`, conectar la búsqueda a un
   índice real (Algolia/Typesense) y paginación, inventario por variante.
6. **Arrancar Fase 2** (fidelización unificada sobre `loyaltyLedger`), que resuelve de raíz
   los desyncs de monedas y habilita el antifraude de misiones.

Ver roadmap completo y decisiones técnicas en [PLAN-MAESTRO.md](./PLAN-MAESTRO.md).
