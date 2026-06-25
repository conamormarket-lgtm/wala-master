# RUNBOOK DE DESPLIEGUE A LA NUBE — WALA / Portal de Clientes

> Objetivo: aplicar cambios sobre el sistema **ya desplegado** (Firebase PROD `sistema-gestion-3b225` + Vercel `portal-clientes-regala-con-amor` + App Android Capacitor) de forma segura, con respaldo previo, prueba en staging y rollback documentado.
>
> **Plataforma del operador:** Windows 11, PowerShell 7 (pwsh) para el trabajo local (build, git, Vercel). **El deploy a Firebase se ejecuta desde Google Cloud Shell** (ya autenticado contra `sistema-gestion-3b225`, sin `firebase login`). Donde un comando deba correr en Cloud Shell se indica explícitamente; el resto es pwsh.
>
> ## ⚠️ TOPOLOGÍA DE PROYECTOS (LEER PRIMERO)
>
> - **`sistema-gestion-3b225` es el ÚNICO proyecto de producción.** Portal de clientes **y** ERP comparten **el mismo proyecto Firebase y la misma base Firestore**. NO hay un proyecto Firebase separado para el ERP: las colecciones del portal (`productos_wala`, `portal_clientes_users`, economía/gamificación…) y las del ERP (`pedidos`, `pedidos_web`, `analytics_*`) conviven en `sistema-gestion-3b225` y deben estar **todas** en las mismas reglas Firestore.
> - **`pruebas-cd728` NO debe usarse.** Pese a documentación previa que lo trataba como "PROD", es un proyecto equivocado. No despliegues nada ahí (ver incidente 2026-06-25 en [ESTADO-DEL-PROYECTO.md](./ESTADO-DEL-PROYECTO.md)).
> - **`.firebaserc` default ahora apunta a `sistema-gestion-3b225`.** Todos los comandos `firebase deploy` de este runbook usan `--project sistema-gestion-3b225` para ser explícitos, aunque el default ya sea el correcto.
>
> **REGLA DE ORO:** Nunca despliegues a producción sin (1) respaldo reciente y (2) haberlo probado en STAGING. Ver sección 2.

---

## 0. Hechos del proyecto (referencia rápida)

| Artefacto | Valor |
|---|---|
| Repo raíz local | `C:\Users\heyer\OneDrive\Documents\Desarrollo de Software\wala-master` |
| Remoto git | `github.com/conamormarket-lgtm/wala-master` (ramas `master`, `dev`) |
| Firebase PROD (Portal + ERP) | project id **`sistema-gestion-3b225`** (default en `.firebaserc`). ÚNICO proyecto de producción: portal y ERP comparten proyecto y base Firestore. |
| Colecciones ERP | `pedidos` / `pedidos_web` viven en el MISMO proyecto `sistema-gestion-3b225` (no en un proyecto separado). Sus reglas e índices se gestionan junto con las del portal. |
| Proyecto a NO usar | **`pruebas-cd728`** — NO es producción; no desplegar ahí (ver incidente 2026-06-25). |
| Deploy de Firebase | se ejecuta desde **Google Cloud Shell** (ya autenticado contra `sistema-gestion-3b225`; no requiere `firebase login`). |
| Vercel | proyecto `portal-clientes-regala-con-amor` (projectId `prj_uptUytGsDu5LfHikK8zVlWfA8VjI`, orgId `team_yhD2v1G3hjm0PjX8TvCdu4KV`). `.vercel/project.json` ya existe. |
| Capacitor | appId `com.wala.tienda`, appName `WALA`, webDir `build` |
| Storage bucket | `sistema-gestion-3b225.appspot.com` (verificar; puede ser `sistema-gestion-3b225.firebasestorage.app`) |
| Cloud Functions runtime | **Node 22** (`functions/package.json` → `engines.node: "22"`) |

**`firebase.json`** define: `firestore.rules=firebase/firestore.rules`, `storage.rules=firebase/storage.rules`, `functions.source=functions`, `hosting.public=build` con rewrite SPA a `/index.html`.

> **NOTA IMPORTANTE sobre índices:** `firebase.json` **NO** tiene la clave `firestore.indexes` (solo `firestore.rules`). Para poder ejecutar `firebase deploy --only firestore:indexes` primero hay que añadir esa clave (ver sección 5.b). Sin ella, ese comando no despliega nada.

**Scripts reales en `package.json` que usaremos:**

| Script | Comando real |
|---|---|
| `npm run deploy:firestore-rules` | `node scripts/deploy-firestore-rules.js` (lee `REACT_APP_FIREBASE_PROJECT_ID` de `.env` y hace `firebase deploy --only firestore:rules --project <id>`) |
| `npm run deploy:storage-rules` | `node scripts/deploy-storage-rules.js` |
| `npm run deploy:functions` | `firebase deploy --only functions` |
| `npm run deploy:vercel` | `npx vercel` (preview) |
| `npm run deploy:vercel:prod` | `npx vercel --prod` |
| `npm run build` | `cross-env CI=false react-scripts build` |

---

## 1. Pre-requisitos (instalar, login, seleccionar proyecto)

El entorno local **NO** tiene instalados `firebase-tools`, `gcloud`, `gsutil` ni `vercel`. Instálalos una sola vez.

### 1.1 Node correcto (Node 22 para Functions)

Las Cloud Functions corren en **Node 22**. El usuario tiene Node v24 como global. Para emular/desplegar functions con la versión correcta, instala y usa `nvm-windows`:

```powershell
# Instalar nvm-windows (una vez): https://github.com/coreybutler/nvm-windows/releases
# Luego:
nvm install 22
nvm use 22
node -v   # debe imprimir v22.x
```

> El deploy de functions sube el código y Google Cloud lo construye con el runtime declarado en `functions/package.json`. Aun así, usa Node 22 localmente para que `npm --prefix functions ci` y cualquier emulación se comporten igual que producción.

### 1.2 Firebase CLI

> **El deploy a Firebase se hace desde Google Cloud Shell**, que ya trae `firebase-tools` instalado y la sesión autenticada contra `sistema-gestion-3b225` (no necesitas `firebase login`). Instalar la CLI local solo es útil para inspección/emulador en Windows.

```bash
# En Google Cloud Shell (ya autenticado):
firebase --version          # >= 13.x  (preinstalado)
firebase projects:list      # confirma que ves sistema-gestion-3b225
firebase use sistema-gestion-3b225
```

```powershell
# (Opcional) CLI local en Windows para inspección/emulador:
npm install -g firebase-tools
firebase --version
```

### 1.3 Google Cloud SDK (gcloud + gsutil) — para backups de Firestore/Storage

```powershell
# Instalar: https://cloud.google.com/sdk/docs/install (instalador Windows)
# Reabrir pwsh tras instalar para refrescar PATH.
gcloud --version
gcloud auth login
gcloud config set project sistema-gestion-3b225
gsutil version              # gsutil viene con el SDK
```

### 1.4 Vercel CLI

No es estrictamente necesario instalarlo global porque los scripts usan `npx vercel`, pero conviene:

```powershell
npm install -g vercel
vercel --version
vercel login               # misma org: team_yhD2v1G3hjm0PjX8TvCdu4KV
vercel link                # ya existe .vercel/project.json; confirma el vínculo
```

### 1.5 `.env` del proyecto

`scripts/deploy-firestore-rules.js` y `deploy-storage-rules.js` leen `REACT_APP_FIREBASE_PROJECT_ID` de `.env`. Verifica:

```powershell
Select-String -Path ".env" -Pattern "REACT_APP_FIREBASE_PROJECT_ID"
# Debe valer sistema-gestion-3b225 para PROD (o el id de staging cuando trabajes en staging).
```

---

## 2. REGLA DE ORO — Respaldo antes de deploy + probar en STAGING

**Orden obligatorio en cada cambio a producción:**

1. **Respaldo** completo (Firestore export + Storage + snapshot de reglas/índices + tag git).
2. **Probar en STAGING** (proyecto Firebase de staging + preview de Vercel).
3. Solo entonces, **deploy a PROD** del artefacto concreto.
4. **Verificación post-deploy** (smoke tests).
5. Si algo falla, **ROLLBACK** (sección 9).

### 2.1 Respaldo (ops/backup/backup-all.ps1)

Antes de CUALQUIER deploy a PROD ejecuta el script de respaldo:

```powershell
.\ops\backup\backup-all.ps1 -Project sistema-gestion-3b225
```

Qué debe respaldar (referencia; el script de backup vive aparte):

- **Firestore** → export a un bucket GCS:
  ```powershell
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  gcloud firestore export gs://sistema-gestion-3b225-backups/firestore/$stamp --project sistema-gestion-3b225
  ```
- **Storage** → copia del bucket:
  ```powershell
  gsutil -m cp -r gs://sistema-gestion-3b225.appspot.com gs://sistema-gestion-3b225-backups/storage/$stamp
  ```
- **Snapshot de reglas e índices actuales** (para rollback de reglas):
  ```powershell
  New-Item -ItemType Directory -Force ".\ops\backup\snapshots\$stamp" | Out-Null
  Copy-Item ".\firebase\firestore.rules" ".\ops\backup\snapshots\$stamp\"
  Copy-Item ".\firebase\storage.rules"   ".\ops\backup\snapshots\$stamp\"
  firebase firestore:indexes --project sistema-gestion-3b225 > ".\ops\backup\snapshots\$stamp\firestore.indexes.json"
  ```
- **Tag git del commit desplegado** (clave para rollback de functions/hosting):
  ```powershell
  git tag "deploy-prod-$stamp"; git push origin "deploy-prod-$stamp"
  ```

> Crea el bucket de backups una vez: `gsutil mb -p sistema-gestion-3b225 -l us-central1 gs://sistema-gestion-3b225-backups` (ajusta región a la del proyecto).

---

## 3. Crear proyecto Firebase de STAGING

La idea: un proyecto Firebase **independiente** que replique reglas, índices, functions y datos de ejemplo, sin tocar producción.

### 3.1 Crear el proyecto y registrarlo como alias

```powershell
# 1) Crear el proyecto (o usa la consola: console.firebase.google.com)
firebase projects:create wala-staging --display-name "WALA Staging"

# 2) Añadir alias en .firebaserc sin perder el default de PROD:
firebase use --add
#   -> selecciona wala-staging y dale el alias "staging"
#   -> el alias "default" debe seguir apuntando a sistema-gestion-3b225

firebase use staging        # cambia el proyecto activo a staging
firebase use default        # vuelve a PROD cuando termines
```

Tras esto `.firebaserc` debe verse así (no borres `default`):

```json
{
  "projects": {
    "default": "sistema-gestion-3b225",
    "staging": "wala-staging"
  }
}
```

### 3.2 Habilitar servicios en staging

En la consola del proyecto staging: habilita **Firestore**, **Storage**, **Authentication** (mismos métodos: Email/Password y Google), y **Functions** (requiere plan Blaze).

### 3.3 Envs de staging

- **Web (React/CRA):** crea `.env.staging` con las credenciales del proyecto staging:
  ```
  REACT_APP_FIREBASE_PROJECT_ID=wala-staging
  REACT_APP_FIREBASE_API_KEY=...
  REACT_APP_FIREBASE_AUTH_DOMAIN=wala-staging.firebaseapp.com
  REACT_APP_FIREBASE_STORAGE_BUCKET=wala-staging.appspot.com
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
  REACT_APP_FIREBASE_APP_ID=...
  # ERP de pruebas (si aplica):
  REACT_APP_ERP_FIREBASE_PROJECT_ID=<ERP_STAGING_PROJECT_ID>
  ```
  > Recuerda: `scripts/deploy-*-rules.js` leen `REACT_APP_FIREBASE_PROJECT_ID` de **`.env`**, no de `.env.staging`. Para desplegar reglas a staging usa directamente la CLI con `--project staging` (ver 5.a) o cambia temporalmente `.env`.

### 3.4 Sembrar datos de ejemplo (opcional)

Importa el último export de PROD a staging para probar con datos realistas:

```powershell
# Copia el export de PROD al bucket de staging y luego impórtalo:
gsutil -m cp -r gs://sistema-gestion-3b225-backups/firestore/<stamp> gs://wala-staging.appspot.com/seed/<stamp>
gcloud firestore import gs://wala-staging.appspot.com/seed/<stamp> --project wala-staging
```

---

## 4. Crear entorno Vercel preview/staging

Vercel ya distingue **Production** (rama `master`) de **Preview** (cualquier otra rama / despliegue manual sin `--prod`).

### 4.1 Preview manual (rápido)

```powershell
npm run deploy:vercel        # = npx vercel  -> crea un Preview Deployment con URL única
```

### 4.2 Variables de entorno por entorno en Vercel

Define las envs apuntando a **staging** solo para el scope Preview, y a **PROD** para Production:

```powershell
# Preview (apunta a Firebase staging):
vercel env add REACT_APP_FIREBASE_PROJECT_ID preview      # valor: wala-staging
vercel env add REACT_APP_FIREBASE_API_KEY preview
# ...resto de REACT_APP_FIREBASE_* y REACT_APP_ERP_FIREBASE_* para preview

# Production (apunta a sistema-gestion-3b225):
vercel env add REACT_APP_FIREBASE_PROJECT_ID production    # valor: sistema-gestion-3b225
# ...resto para production

vercel env ls                                              # revisa todo
```

> Regla práctica: el preview de Vercel usa envs de **staging**; el production de Vercel usa envs de **PROD**. Nunca mezcles.

---

## 5. Deploy por artefacto (a STAGING primero, luego PROD)

> En todos los comandos, `--project staging` despliega a staging y `--project sistema-gestion-3b225` (o `--project default`) a PROD. **Siempre prueba en staging antes.**

> ### Deploy granular a PROD (referencia rápida — desde Google Cloud Shell)
>
> Todos estos comandos van **a `sistema-gestion-3b225`** (portal + ERP comparten proyecto y base Firestore) y se ejecutan **desde Google Cloud Shell** (ya autenticado, sin `firebase login`). Se usa `--project sistema-gestion-3b225` de forma explícita aunque sea el default:
>
> ```bash
> # Reglas Firestore (vía script del repo; lee REACT_APP_FIREBASE_PROJECT_ID de .env):
> npm run deploy:firestore-rules
>
> # Funciones (todas):
> firebase deploy --only functions --project sistema-gestion-3b225
>
> # Índices Firestore (requiere la clave firestore.indexes en firebase.json, ver 5.b):
> firebase deploy --only firestore:indexes --project sistema-gestion-3b225
> ```
>
> ⚠️ Verifica SIEMPRE que el proyecto activo es `sistema-gestion-3b225` y **nunca** `pruebas-cd728` antes de cada `firebase deploy` (ver incidente 2026-06-25).

### (a) Reglas Firestore + Storage

```powershell
# STAGING:
firebase deploy --only firestore:rules,storage --project staging

# PROD (tras validar en staging):
firebase deploy --only firestore:rules,storage --project sistema-gestion-3b225
```

Alternativa con los scripts del repo (solo PROD, leen `REACT_APP_FIREBASE_PROJECT_ID` de `.env`):

```powershell
npm run deploy:firestore-rules
npm run deploy:storage-rules
```

> **Advertencia de reglas (deuda técnica conocida):** `firebase/firestore.rules` referencia colecciones `products`/`categories` que la app NO usa (usa `productos_wala` y `tienda_categories`), `enlaces_pago` tiene `allow update, delete: if true`, y la economía de puntos (`monedas`/`kapiCoins`) se escribe desde cliente. Si tu cambio toca reglas, revisa estos puntos antes de desplegar a PROD.

### (b) Índices Firestore

**Primero** añade la clave `firestore.indexes` a `firebase.json` (hoy no existe) y crea el archivo de índices:

```jsonc
// firebase.json -> bloque firestore
"firestore": {
  "rules": "firebase/firestore.rules",
  "indexes": "firebase/firestore.indexes.json"
}
```

Genera el archivo base a partir del estado actual del proyecto y luego despliega:

```powershell
# Exporta los índices existentes como punto de partida:
firebase firestore:indexes --project sistema-gestion-3b225 > firebase\firestore.indexes.json

# STAGING:
firebase deploy --only firestore:indexes --project staging

# PROD:
firebase deploy --only firestore:indexes --project sistema-gestion-3b225
```

> La creación de índices en Firestore es asíncrona: tras el deploy pueden tardar minutos en quedar `Enabled`. Verifica en la consola → Firestore → Índices.

### (c) Cloud Functions (Node 22)

```powershell
nvm use 22                              # IMPORTANTE: runtime correcto
npm --prefix functions ci              # instala deps exactas de functions/package-lock.json

# STAGING:
firebase deploy --only functions --project staging

# PROD:
firebase deploy --only functions --project sistema-gestion-3b225
# (equivale a: npm run deploy:functions, que despliega al proyecto activo/ default)
```

> **Plan Blaze** requerido para functions. La primera vez que despliegues a staging, habilita facturación en ese proyecto.
>
> **Funciones presentes:** `ensureAccountFromOrder`, `secureClaimMonedas`, `processCulqiPayment`, `resetKapiCoins` (schedule), `notifyWishlistBirthdays` (schedule), `rotateWeeklyChallenge` (schedule), `submitChallengeEvidence`, `approveChallengeEvidence`, `notificationEngine` (schedule horario), `sendManualPromoNotification`. Varias tienen deuda de seguridad (ver `docs/wala_synthesis.md`); si tu cambio toca una de ellas revisa primero esas notas.

### (d) Hosting / Web — HOSTING DOBLE

> **Atención:** el proyecto puede servirse por **DOS** hostings: **Vercel** (`portal-clientes-regala-con-amor`) y **Firebase Hosting** (`hosting.public=build` en `firebase.json`). Tener dos orígenes de la misma SPA causa divergencia (envs, cache, dominios).
>
> **RECOMENDACIÓN: elige UN hosting canónico.** Dado que `.vercel/project.json` ya existe y los scripts `deploy:vercel*` están en `package.json`, lo más simple es declarar **Vercel** como canónico y dejar Firebase Hosting solo como respaldo (o eliminarlo del flujo). Documenta la decisión y apunta el dominio a un único origen.

Se documentan **ambos**:

**Opción 1 — Vercel (recomendado como canónico):**
```powershell
# Preview / staging:
npm run deploy:vercel            # = npx vercel

# Producción:
npm run deploy:vercel:prod       # = npx vercel --prod
```
Vercel construye el sitio en su infraestructura usando las envs configuradas por entorno (sección 4.2). No necesitas `npm run build` local para Vercel.

**Opción 2 — Firebase Hosting:**
```powershell
npm run build                                   # genera ./build con cross-env CI=false

# STAGING:
firebase deploy --only hosting --project staging

# PROD:
firebase deploy --only hosting --project sistema-gestion-3b225
```
> El build de Firebase usa el `.env` local en tiempo de `npm run build`; asegúrate de que `REACT_APP_FIREBASE_PROJECT_ID` apunte al proyecto correcto ANTES de construir.

### (e) App Android (Capacitor)

```powershell
npm run build                    # genera ./build (webDir de Capacitor)
npx cap sync android             # copia web + plugins al proyecto android/
npx cap open android             # abre Android Studio
```

En Android Studio (o por gradle):

```powershell
# Compilar AAB de release por línea de comandos:
cd android
.\gradlew.bat bundleRelease      # genera android/app/build/outputs/bundle/release/app-release.aab
cd ..
```

Luego:
1. Firma el AAB con tu keystore de release (configurado en `android/app/build.gradle` o vía Play App Signing).
2. Sube `app-release.aab` a **Google Play Console** → pista interna/cerrada para probar antes de producción.
3. Promueve a producción en Play Console tras validar.

> Recuerda incrementar `versionCode`/`versionName` en `android/app/build.gradle` en cada release.

---

## 6. Despliegue selectivo de funciones individuales

Para desplegar una sola función (más rápido y con menor radio de impacto):

```powershell
nvm use 22
npm --prefix functions ci

# Una función concreta a PROD:
firebase deploy --only functions:secureClaimMonedas --project sistema-gestion-3b225

# Varias a la vez:
firebase deploy --only "functions:secureClaimMonedas,functions:processCulqiPayment" --project sistema-gestion-3b225
```

> Útil cuando arreglas una función con deuda de seguridad sin tocar las demás. Para schedules (p.ej. `notificationEngine`) el redeploy actualiza también el cron declarado en el código.

---

## 7. Verificación post-deploy (smoke tests)

Ejecuta estos en el entorno desplegado (primero staging, luego PROD). Apunta el navegador a la URL del deployment.

| # | Prueba | Esperado |
|---|---|---|
| 1 | **Login** (Email/Password y Google) | Entra correctamente; sin errores en consola del navegador. |
| 2 | **Listar productos** | Carga el catálogo desde `productos_wala`/`tienda_categories`. |
| 3 | **Checkout de prueba** | Crea pedido; pago de prueba (Culqi/Stripe sandbox) procesa sin error. |
| 4 | **Recibir push** | La app/instalación recibe una notificación (probar `sendManualPromoNotification` o el flujo de `notificationEngine`). |
| 5 | **Claim de monedas** | `secureClaimMonedas` acredita correctamente y no permite doble claim. |
| 6 | **Reglas** | Un usuario sin permisos NO puede escribir colecciones protegidas. |

Monitoreo:

```powershell
# Logs de functions en vivo:
firebase functions:log --project sistema-gestion-3b225
firebase functions:log --only secureClaimMonedas --project sistema-gestion-3b225
```

También: Consola Firebase (Functions → métricas/errores, Firestore → uso), y Vercel Dashboard (Deployments → Logs / Runtime Logs).

---

## 8. Smoke test rápido (copy-paste)

```powershell
# 1) Logs de las funciones críticas (últimas líneas):
firebase functions:log --only secureClaimMonedas,processCulqiPayment --project sistema-gestion-3b225

# 2) Estado de índices:
firebase firestore:indexes --project sistema-gestion-3b225

# 3) Último deployment de Vercel:
vercel ls portal-clientes-regala-con-amor
```

---

## 9. ROLLBACK por artefacto

> No existe `firebase functions:rollback`. El rollback de functions/hosting se hace **redeployando el commit previo** (por eso taggeamos en el backup, sección 2.1).

### 9.1 Cloud Functions

```powershell
git checkout deploy-prod-<stamp_anterior>     # o el SHA bueno conocido
nvm use 22
npm --prefix functions ci
firebase deploy --only functions --project sistema-gestion-3b225
git checkout master                           # vuelve a tu rama
```
Para una sola función: `firebase deploy --only functions:<nombre> --project sistema-gestion-3b225` desde el commit bueno.

### 9.2 Hosting Vercel

```powershell
vercel ls portal-clientes-regala-con-amor      # localiza el deployment bueno anterior
vercel promote <DEPLOYMENT_URL_o_ID>           # promueve ese deployment a Production
# alternativa: vercel rollback
```

### 9.3 Hosting Firebase

```powershell
# Opción A: consola Firebase -> Hosting -> historial de versiones -> "Restaurar" la anterior.
# Opción B: redeploy del build del commit bueno:
git checkout deploy-prod-<stamp_anterior>
npm run build
firebase deploy --only hosting --project sistema-gestion-3b225
git checkout master
```

### 9.4 Reglas Firestore / Storage

Redeploy del snapshot guardado en el backup:

```powershell
Copy-Item ".\ops\backup\snapshots\<stamp_anterior>\firestore.rules" ".\firebase\firestore.rules" -Force
Copy-Item ".\ops\backup\snapshots\<stamp_anterior>\storage.rules"   ".\firebase\storage.rules"   -Force
firebase deploy --only firestore:rules,storage --project sistema-gestion-3b225
```

### 9.5 Índices Firestore

Los índices se **añaden** sin downtime; un índice malo se borra desde la consola (Firestore → Índices → Eliminar) o redeployando un `firestore.indexes.json` sin él. Borrar un índice NO destruye datos.

### 9.6 Datos (Firestore / Storage)

Solo si un deploy corrompió datos. Restaura el export del backup:

```powershell
gcloud firestore import gs://sistema-gestion-3b225-backups/firestore/<stamp_anterior> --project sistema-gestion-3b225
gsutil -m cp -r gs://sistema-gestion-3b225-backups/storage/<stamp_anterior>/* gs://sistema-gestion-3b225.appspot.com
```
> CUIDADO: `import` de Firestore es destructivo sobre las colecciones importadas. Confirma el stamp correcto.

---

## 10. Checklist final imprimible

```
[ ] nvm use 22  (node -v == v22.x)
[ ] firebase login OK / vercel login OK / gcloud auth OK
[ ] git: rama y commit correctos; árbol limpio (git status)
[ ] RESPALDO ejecutado:  .\ops\backup\backup-all.ps1 -Project sistema-gestion-3b225
      [ ] export Firestore  [ ] copia Storage  [ ] snapshot reglas+indices  [ ] tag git deploy-prod-<stamp>
[ ] Probado en STAGING (firebase --project staging + Vercel preview)  -> smoke tests OK
[ ] Decisión de hosting canónico respetada (Vercel XOR Firebase)
[ ] Deploy a PROD del artefacto:
      [ ] reglas    firebase deploy --only firestore:rules,storage --project sistema-gestion-3b225
      [ ] indices   firebase deploy --only firestore:indexes --project sistema-gestion-3b225  (requiere clave en firebase.json)
      [ ] functions nvm use 22; npm --prefix functions ci; firebase deploy --only functions --project sistema-gestion-3b225
      [ ] web       npm run deploy:vercel:prod   (o npm run build; firebase deploy --only hosting)
      [ ] android   npm run build; npx cap sync android; gradlew bundleRelease; subir a Play Console
[ ] Verificación post-deploy: login / productos / checkout / push / claim monedas / reglas
[ ] Monitoreo: firebase functions:log --project sistema-gestion-3b225 + consolas
[ ] Plan de ROLLBACK a mano (commit bueno + stamp de backup anotados)
```

---

## 11. Atajo con el script de deploy

En lugar de recordar cada comando, usa `ops/deploy/deploy.ps1` (incluido en este repo):

```powershell
.\ops\deploy\deploy.ps1 -Target rules            -Project sistema-gestion-3b225
.\ops\deploy\deploy.ps1 -Target indexes          -Project sistema-gestion-3b225
.\ops\deploy\deploy.ps1 -Target functions        -Project sistema-gestion-3b225
.\ops\deploy\deploy.ps1 -Target hosting-firebase -Project sistema-gestion-3b225
.\ops\deploy\deploy.ps1 -Target hosting-vercel   -Project sistema-gestion-3b225
.\ops\deploy\deploy.ps1 -Target all              -Project sistema-gestion-3b225   # pedirá confirmación
```
