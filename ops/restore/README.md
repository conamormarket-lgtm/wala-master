# WALA — Procedimiento de RESTAURACIÓN / ROLLBACK

> **Proyecto PROD (Portal):** `pruebas-cd728` (es PRODUCCIÓN real pese al nombre).
> **Proyecto ERP:** separado, `<ERP_PROJECT_ID>` (env `REACT_APP_ERP_FIREBASE_*`).
> **Hosting front (cliente):** Vercel — proyecto `portal-clientes-regala-con-amor`.
> **Hosting Firebase Hosting:** `firebase.json` apunta `public=build` (SPA). Si el front vive en Vercel, el rollback principal es en Vercel; Firebase Hosting solo si efectivamente se usa.

Este documento describe cómo **deshacer** un despliegue o restaurar datos a partir de un
snapshot/backup previo. Es el complemento inverso de `ops/backup/`.

---

## ⚠️ ADVERTENCIAS CRÍTICAS (leer antes de tocar nada)

1. **El import de Firestore (`gcloud firestore import`) SOBREESCRIBE por document ID y NO BORRA documentos nuevos.**
   - Si un documento existía en el backup, su versión actual será **reemplazada** por la del backup (merge a nivel de documento, no de campo: el documento completo se sustituye).
   - Si un documento fue **creado después** del backup (no existe en el backup), **NO se borra**: seguirá presente tras el import. El import no es un "reset al estado del backup", es un "restaurar/sobrescribir lo que estaba en el backup".
   - Consecuencia: tras restaurar puedes quedar con un estado **híbrido** (docs viejos del backup + docs nuevos posteriores). Para un estado limpio idéntico al backup hay que **borrar las colecciones afectadas primero** (ver Apéndice A) — operación aún más destructiva.

2. **Haz SIEMPRE el ensayo en STAGING / proyecto de pruebas primero.**
   - `pruebas-cd728` es producción. No practiques el procedimiento ahí.
   - Ideal: importar el backup a un proyecto temporal, validar, y solo entonces ejecutar en prod.

3. **Ventana de mantenimiento obligatoria.**
   - Pon la app en modo mantenimiento o avisa que habrá downtime. Si los usuarios escriben durante el import, generas conflictos y datos huérfanos.
   - Idealmente: **pausa las Cloud Functions schedule** (o despliega una versión que no escriba) y **bloquea escrituras** vía reglas Firestore temporales (allow write: if false) durante la restauración.

4. **El import de Auth (`firebase auth:import`) NO restaura passwords en claro.**
   - Solo restaura usuarios con su hash. El export previo (`firebase auth:export`) debe incluir los parámetros de hash (`hash-algo`, `hash-key`, etc.). Sin esos parámetros, los usuarios importados **no podrán iniciar sesión con su password**.
   - Recordatorio del sistema actual: `ensureAccountFromOrder` crea cuentas con **password = DNI**. Si pierdes el hash, esos usuarios deberán resetear su password.

5. **Storage rsync inverso BORRA en destino con `--delete`.**
   - `gsutil -m rsync -d -r <backup> gs://<bucket>` elimina del bucket los objetos que no estén en el backup. Úsalo con extremo cuidado; sin `-d` solo añade/actualiza pero deja basura nueva.

6. **Snapshots y commit deben corresponder al mismo punto en el tiempo.**
   - Reglas, functions y datos están acoplados. Restaurar datos viejos con reglas/functions nuevas (o al revés) puede romper validaciones. Revierte **infra (commit) y datos (backup) coherentes entre sí**.

7. **Anota project ID, timestamp del backup y commit en el registro de cambios antes de empezar.** Si algo sale mal necesitas saber el punto de partida exacto.

---

## Requisitos previos

Herramientas (el usuario NO las tiene instaladas por defecto):

```powershell
# Firebase CLI
npm install -g firebase-tools
firebase login

# Google Cloud SDK (incluye gcloud y gsutil) — instalar desde:
#   https://cloud.google.com/sdk/docs/install
gcloud auth login
gcloud config set project pruebas-cd728   # OJO: cambia a staging para ensayar

# Vercel CLI
npm install -g vercel
vercel login
```

Identifica primero el backup a restaurar:

```powershell
# Listar exports de Firestore disponibles en el bucket de backups
gsutil ls gs://<BUCKET_BACKUPS>/firestore/
# Ej: gs://pruebas-cd728-backups/firestore/2026-06-20T03-00-00/
```

---

## ORDEN DE PASOS (rollback completo)

El orden importa. De más seguro/reversible a más destructivo:

### Paso 0 — Congelar el sistema (ventana de mantenimiento)

1. Anuncia downtime.
2. (Opcional pero recomendado) Despliega reglas Firestore temporales de **solo lectura** para evitar escrituras durante el import:
   ```
   // firebase/firestore.rules (versión mantenimiento)
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} { allow read: if true; allow write: if false; }
     }
   }
   ```
   ```powershell
   firebase deploy --only firestore:rules --project pruebas-cd728
   ```
3. (Opcional) Pausa las funciones schedule para que no escriban (resetKapiCoins, notificationEngine, etc.):
   ```powershell
   gcloud scheduler jobs list --project pruebas-cd728
   gcloud scheduler jobs pause <JOB_NAME> --project pruebas-cd728 --location <REGION>
   ```

### Paso 1 — Revertir Vercel (front del cliente) — RÁPIDO y REVERSIBLE

Vercel guarda todos los deployments; el rollback es instantáneo y no destruye datos.

```powershell
# Ver deployments recientes
npx vercel ls portal-clientes-regala-con-amor

# Promover un deployment previo (bueno) a producción (rollback):
npx vercel rollback <DEPLOYMENT_URL_O_ID> --scope team_yhD2v1G3hjm0PjX8TvCdu4KV

# Alternativa: re-desplegar desde el commit bueno
#   git checkout <COMMIT_BUENO>
#   npm ci && npm run build
#   npx vercel --prod
```

> Verifica con `npx vercel inspect <DEPLOYMENT>` que el alias de producción apunta al deployment correcto.

### Paso 2 — Revertir Reglas (Firestore + Storage)

Desde el commit/snapshot bueno (las reglas viven en el repo: `firebase/firestore.rules`, `firebase/storage.rules`).

```powershell
git checkout <COMMIT_BUENO> -- firebase/firestore.rules firebase/storage.rules

# Desplegar SOLO reglas
firebase deploy --only firestore:rules,storage:rules --project pruebas-cd728
# (o usa los scripts del repo: npm run deploy:firestore-rules / npm run deploy:storage-rules)
```

> Nota: si en el Paso 0 pusiste reglas de mantenimiento (write:false), NO las dejes. Este paso las reemplaza por las reglas buenas reales.

### Paso 3 — Revertir Cloud Functions

```powershell
git checkout <COMMIT_BUENO> -- functions/
npm --prefix functions ci
firebase deploy --only functions --project pruebas-cd728

# Si solo necesitas revertir una función concreta:
firebase deploy --only functions:ensureAccountFromOrder --project pruebas-cd728
```

> Si una función nueva debe **eliminarse** (no solo revertir): `firebase functions:delete <NOMBRE> --project pruebas-cd728`.
> Functions corre en Node 22; asegúrate de tener esa versión activa al desplegar.

### Paso 4 — Restaurar Firestore (DESTRUCTIVO — usa el script)

Usa `ops/restore/restore-firestore.ps1` (doble confirmación). Internamente ejecuta:

```powershell
gcloud firestore import gs://<BUCKET>/firestore/<TIMESTAMP> --project <PROJECT_ID>
```

Recuerda la advertencia #1: **sobrescribe por ID, no borra docs nuevos.**
Si necesitas un estado idéntico al backup, primero borra las colecciones afectadas (Apéndice A) — paso adicional y aún más peligroso.

Para restaurar **solo** ciertas colecciones (si el backup fue selectivo):

```powershell
gcloud firestore import gs://<BUCKET>/firestore/<TIMESTAMP> `
  --collection-ids='pedidos,pedidos_web,portal_clientes_users' --project <PROJECT_ID>
```

> El ERP es proyecto separado: si restauras `pedidos`/`pedidos_web` del ERP, usa `--project <ERP_PROJECT_ID>` y su propio bucket de backup.

### Paso 5 — Restaurar Auth (usuarios)

```powershell
# El backup debe ser un export hecho con:
#   firebase auth:export users.json --format=json --project pruebas-cd728
# (guarda también los parámetros de hash que imprime el export)

firebase auth:import users.json `
  --hash-algo=<ALGO> --hash-key=<KEY> --salt-separator=<SEP> `
  --rounds=<N> --mem-cost=<M> `
  --project pruebas-cd728
```

> `auth:import` hace **upsert por UID**: actualiza/crea, **no borra** usuarios creados después del backup. Mismo principio que Firestore.
> Si omites los parámetros de hash, los passwords no funcionarán. Para CSV el formato difiere; prefiere JSON.

### Paso 6 — Restaurar Storage (objetos)

```powershell
# rsync inverso: del backup -> al bucket de producción.
# SIN -d: solo añade/actualiza (más seguro).
gsutil -m rsync -r gs://<BUCKET_BACKUPS>/storage/<TIMESTAMP> gs://<STORAGE_BUCKET>

# CON -d: deja el bucket EXACTAMENTE como el backup (BORRA lo que no esté en el backup). PELIGROSO.
# gsutil -m rsync -d -r gs://<BUCKET_BACKUPS>/storage/<TIMESTAMP> gs://<STORAGE_BUCKET>
```

> `<STORAGE_BUCKET>` = valor de `REACT_APP_FIREBASE_STORAGE_BUCKET`.
> Por defecto suele ser `pruebas-cd728.appspot.com`, pero proyectos recientes usan `pruebas-cd728.firebasestorage.app`. **VERIFICA el bucket real** antes:
> ```powershell
> gsutil ls -p pruebas-cd728
> ```

### Paso 7 — Reabrir el sistema

1. Confirma que las reglas buenas (no las de mantenimiento) están desplegadas (Paso 2).
2. Reanuda los schedulers pausados:
   ```powershell
   gcloud scheduler jobs resume <JOB_NAME> --project pruebas-cd728 --location <REGION>
   ```
3. Smoke test: login de cliente, ver pedidos, ver saldo de monedas/kapiCoins, carga de imágenes.
4. Cierra la ventana de mantenimiento y anuncia.

---

## Apéndice A — Reset limpio de una colección (MUY DESTRUCTIVO)

Solo si necesitas que la colección quede **idéntica** al backup (sin docs nuevos posteriores).
Hazlo ANTES del Paso 4 (import).

```powershell
# Requiere firebase-tools. Borra TODA la colección. No hay deshacer.
firebase firestore:delete <COLECCION> --recursive --project pruebas-cd728
# Confirma manualmente cuando lo pida. Luego ejecuta el import del Paso 4.
```

> Pondera el riesgo: si el import luego falla, te quedas sin la colección. Ten el backup verificado y, si es posible, un export fresco del estado actual (Apéndice B) por si necesitas volver.

## Apéndice B — Red de seguridad antes de restaurar

Antes de cualquier paso destructivo (4, 5, 6, A), captura el **estado ACTUAL** para poder volver a él:

```powershell
# Firestore actual -> bucket de backups con timestamp "pre-restore"
gcloud firestore export gs://<BUCKET_BACKUPS>/firestore/pre-restore-$(Get-Date -Format yyyyMMdd-HHmmss) --project pruebas-cd728

# Auth actual
firebase auth:export pre-restore-users.json --format=json --project pruebas-cd728

# Storage actual
gsutil -m rsync -r gs://<STORAGE_BUCKET> gs://<BUCKET_BACKUPS>/storage/pre-restore-$(Get-Date -Format yyyyMMdd-HHmmss)
```

Esto te da un punto de retorno si la restauración deja el sistema peor que antes.

## Apéndice C — Checklist rápida

- [ ] Confirmado backup correcto (timestamp + bucket) y commit bueno.
- [ ] Ensayo hecho en STAGING.
- [ ] Ventana de mantenimiento abierta; escrituras bloqueadas; schedulers pausados.
- [ ] Red de seguridad capturada (Apéndice B).
- [ ] Vercel revertido (Paso 1).
- [ ] Reglas revertidas (Paso 2).
- [ ] Functions revertidas (Paso 3).
- [ ] Firestore importado (Paso 4).
- [ ] Auth importado (Paso 5).
- [ ] Storage restaurado (Paso 6).
- [ ] Reglas buenas confirmadas + schedulers reanudados (Paso 7).
- [ ] Smoke test OK; mantenimiento cerrado.
