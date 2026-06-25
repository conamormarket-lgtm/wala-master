# Baseline de producción — WALA

> **Fecha del baseline:** `[FECHA]` _(rellenar con la fecha en que se congela este
> snapshot, p. ej. 2026-06-23)_

Este documento es el **snapshot del estado actual de producción** y sirve como respaldo
documental del punto de partida ("estado conocido bueno") antes de aplicar cambios. Si algo
se rompe, este es el estado al que se vuelve. Acompáñalo siempre de un respaldo real de datos
(ver [ops/backup/README.md](../../ops/backup/README.md)) y de un **commit/tag baseline en git**
(ver §8).

Todos los valores aquí provienen del repositorio en el momento del baseline. Los valores
sensibles (claves, secretos) **no** se documentan aquí; solo se listan los **nombres** de las
variables (ver §7).

---

## 1. Entornos y proyectos

| Entorno / servicio | Identificador | Notas |
|---|---|---|
| **Firebase — Producción (Portal + ERP)** | `sistema-gestion-3b225` | ÚNICO proyecto de producción, `default` en `.firebaserc`. Portal y ERP comparten **el mismo proyecto y la misma base Firestore**. Auth, usuarios, diseños, catálogo, fidelización, analytics y los pedidos del ERP (`pedidos`/`pedidos_web`). |
| **Firebase — ERP** | (mismo proyecto: `sistema-gestion-3b225`) | **No es un proyecto separado.** Las colecciones del ERP `pedidos` / `pedidos_web` (pipeline de producción) viven en `sistema-gestion-3b225`. Las variables `REACT_APP_ERP_FIREBASE_*` quedaron **obsoletas para producción**. |
| **Firebase — proyecto a NO usar** | `pruebas-cd728` | **No es producción.** Documentación previa lo trataba como PROD; es el proyecto equivocado. No desplegar ni respaldar ahí (ver incidente 2026-06-25 en [ESTADO-DEL-PROYECTO.md](./ESTADO-DEL-PROYECTO.md)). |
| **Vercel** | Proyecto `portal-clientes-regala-con-amor` | `projectId` `prj_uptUytGsDu5LfHikK8zVlWfA8VjI`, `orgId` `team_yhD2v1G3hjm0PjX8TvCdu4KV`. Definido en `.vercel/project.json`. |
| **Capacitor (app móvil)** | `appId` `com.wala.tienda`, `appName` `WALA` | `webDir` `build`. Android publicado (App Links verificados para wala.pe). |
| **Repositorio** | `github.com/conamormarket-lgtm/wala-master` | Ramas `master` y `dev`. Clon local en Windows. |
| **Storage bucket** | `sistema-gestion-3b225.appspot.com` _(verificar)_ | Puede ser `sistema-gestion-3b225.firebasestorage.app` según el formato del proyecto. Confirmar en Firebase Console antes de respaldar. |

---

## 2. Cloud Functions (Node 22)

Fuente: `functions/` (`firebase.json` → `functions.source = "functions"`).
`firebase-functions ^4.5.0` + `firebase-admin ^11.11.0`, mezcla de gen1 (`functions.https`)
y v2 (`onSchedule`). Son **10 funciones**:

| # | Función | Tipo / trigger | Notas de estado actual |
|---|---------|----------------|------------------------|
| 1 | `ensureAccountFromOrder` | HTTPS `onRequest` | Crea cuenta al crear pedido. **Sin verificación de secreto**, CORS abierto; contraseña = DNI. |
| 2 | `secureClaimMonedas` | Callable `onCall` | Reclamo de monedas por pedido. Validación de propiedad del pedido **comentada**. |
| 3 | `processCulqiPayment` | Callable `onCall` | Cargo Culqi server-side (usa `REACT_APP_CULQI_SECRET_KEY`). |
| 4 | `resetKapiCoins` | Schedule `"59 23 28-31 * *"` | Reset mensual de kapiCoins (último día del mes). |
| 5 | `notifyWishlistBirthdays` | Schedule `"0 9 * * *"` | Notifica fechas/wishlist; full scan de usuarios. |
| 6 | `rotateWeeklyChallenge` | Schedule | Rotación del reto semanal. |
| 7 | `submitChallengeEvidence` | Callable `onCall` | Envío de evidencia de reto. |
| 8 | `approveChallengeEvidence` | Callable `onCall` | Aprobación admin de evidencia. |
| 9 | `notificationEngine` | Schedule `"0 * * * *"` (horario) | Motor push (FCM). Usa `messaging.sendToDevice` (**API legacy deprecada**). En `notificationsEngine.js`. |
| 10 | `sendManualPromoNotification` | Callable `onCall` | Campañas manuales. **No valida rol admin.** En `notificationsEngine.js`. |

> Los puntos marcados ("sin verificación", "validación comentada", "no valida admin",
> "deprecada") son **riesgos conocidos** que documenta el baseline; se abordan en
> [FASE-0-SEGURIDAD.md](./FASE-0-SEGURIDAD.md). No son tareas de este snapshot, pero quedan
> registradas como parte del estado real.

---

## 3. Configuración de hosting (doble)

`firebase.json` define **Firebase Hosting** y en paralelo existe **Vercel**. Ambos sirven el
mismo `build`. Confirmar cuál atiende el dominio antes de desplegar.

### 3.1 Firebase Hosting
- `public`: `build`
- `ignore`: `firebase.json`, `**/.*`, `**/node_modules/**`
- `rewrites`: `**` → `/index.html` (SPA)
- Reglas: `firestore.rules` = `firebase/firestore.rules`, `storage.rules` = `firebase/storage.rules`

### 3.2 Vercel
- Proyecto `portal-clientes-regala-con-amor` (ids en §1)
- `.vercel/project.json` ya existe
- Scripts: `deploy:vercel` = `npx vercel`, `deploy:vercel:prod` = `npx vercel --prod`

---

## 4. Dominios

| Dominio | Uso |
|---|---|
| `wala.pe` | Dominio principal. App Links Android verificados contra este dominio. |

> Confirmar registros DNS y a qué hosting (Vercel o Firebase) resuelve `wala.pe` en el
> momento del baseline.

---

## 5. Stack y versiones

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend web | Create React App (`react-scripts`) | `5.0.1` (CRA, deprecado) |
| UI | React / React DOM | `^18.2.0` |
| Router | `react-router-dom` | `^6.30.3` |
| Editor de personalización | `fabric` | `^5.3.0` (fabric 5) |
| SDK Firebase (web) | `firebase` | `^10.7.0` |
| Cloud Functions runtime | Node | `22` |
| Cloud Functions libs | `firebase-functions` / `firebase-admin` | `^4.5.0` / `^11.11.0` |
| Móvil | Capacitor (`@capacitor/core`, `/android`) | `^8.2.0` |
| Pagos | `@paypal/react-paypal-js` / Stripe (deps) | `^9.3.0` / `^2.4.0` |
| Estado/datos | `@tanstack/react-query` | `^5.17.0` |
| Build | `cross-env CI=false react-scripts build` | — |
| Tooling local del usuario | Node `v24.17.0`, npm `11`, PowerShell 7 | `.npmrc` con `legacy-peer-deps=true` |

> No instalados localmente al momento del baseline: `firebase-tools`, `gcloud`, `gsutil`,
> `vercel` (se invocan vía `npx` o se instalan según `DESPLIEGUE.md`).

---

## 6. Capacitor (app móvil)

Fuente: `capacitor.config.ts`.

| Campo | Valor |
|---|---|
| `appId` | `com.wala.tienda` |
| `appName` | `WALA` |
| `webDir` | `build` |
| `backgroundColor` | `#7C3AED` |
| GoogleAuth `serverClientId` | `572322137024-0bl118c7mnuglq3fbnbdlhv5kg36dp9a.apps.googleusercontent.com` |
| SplashScreen | `launchShowDuration` 2500 ms, autohide, fade 300 ms |

---

## 7. Inventario de variables de entorno (solo nombres, sin valores)

El frontend CRA usa prefijo `REACT_APP_*`. Los valores reales viven en `.env` (no
versionado) y en la configuración de Vercel; **no se documentan aquí**.

### 7.1 Firebase — Portal (producción)
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_FIREBASE_MEASUREMENT_ID`
- `REACT_APP_FIREBASE_VAPID_KEY` _(push web / FCM)_

### 7.2 Firebase — ERP (variables obsoletas para producción)

> El ERP **no usa un proyecto Firebase separado** en producción: vive en
> `sistema-gestion-3b225` junto con el portal. Estos nombres `REACT_APP_ERP_FIREBASE_*`
> se conservan solo como inventario histórico del código.

- `REACT_APP_ERP_FIREBASE_API_KEY`
- `REACT_APP_ERP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_ERP_FIREBASE_PROJECT_ID`
- `REACT_APP_ERP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_ERP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_ERP_FIREBASE_APP_ID`
- `REACT_APP_ERP_FIREBASE_MEASUREMENT_ID`

### 7.3 ERP — API REST (cliente legacy)
- `REACT_APP_ERP_API_URL`
- `REACT_APP_ERP_API_KEY`
- `REACT_APP_ERP_TIMEOUT_MS`
- `REACT_APP_ERP_MAX_RETRIES`
- `REACT_APP_ERP_RETRY_DELAY_MS`

### 7.4 Pagos
- `REACT_APP_PAYPAL_CLIENT_ID`
- `REACT_APP_CULQI_PUBLIC_KEY` _(cliente)_
- `REACT_APP_CULQI_SECRET_KEY` _(usado por Cloud Function `processCulqiPayment`; secreto)_

### 7.5 Otras
- `REACT_APP_API_URL` _(base de API genérica, `src/utils/constants.js`)_

> Al separar entornos o migrar a Vite (roadmap), estos nombres cambiarán de prefijo
> (`REACT_APP_*` → `VITE_*`). Mientras tanto, el baseline los registra tal cual están hoy.

---

## 8. Recordatorio: fijar el baseline en git

Antes de cualquier cambio, congelar el punto de partida en el repositorio para poder volver:

1. Asegurarse de estar en el commit que corresponde a lo que hay desplegado en producción.
2. Crear un **tag de baseline** anotado, por ejemplo:

   ```powershell
   git tag -a baseline-prod-[FECHA] -m "Baseline de produccion congelado el [FECHA]"
   git push origin baseline-prod-[FECHA]
   ```

3. Anotar aquí el hash del commit y el nombre del tag:
   - **Commit baseline:** `[COMMIT_HASH]`
   - **Tag baseline:** `baseline-prod-[FECHA]`

4. Guardar junto a este documento la ubicación del respaldo de datos correspondiente
   (export de Firestore/Storage y copia de reglas) generado con `ops/backup/`.

> Con el tag de git + el export de datos + este snapshot documental, el estado de producción
> queda **completamente reproducible** y se puede revertir vía [ops/restore/](../../ops/restore/README.md).
