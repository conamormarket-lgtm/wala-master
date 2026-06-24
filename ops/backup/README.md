# Respaldo de la nube WALA (`ops/backup/`)

Scripts PowerShell 7 (`pwsh`) para respaldar **todo lo que NO esta en git** antes
de tocar produccion: Firestore, Authentication, Storage y la configuracion
(reglas + functions + manifiesto del estado de la nube).

> **Proyecto Firebase de PRODUCCION (Portal):** `pruebas-cd728`
> (es el `default` en `.firebaserc`; el nombre "pruebas" es enganoso, **es produccion real**).
>
> **Proyecto Firebase ERP (separado):** `<ERP_PROJECT_ID>` — rellenalo en los scripts
> (`00-prerequisitos.ps1`, `01-export-firestore.ps1`) o pasalo por parametro.

---

## 1. Que respalda cada script

| Script | Que hace | Destino |
|---|---|---|
| `00-prerequisitos.ps1` | Verifica/instala `firebase-tools`, verifica Google Cloud SDK (`gcloud`/`gsutil`), `firebase login`, `gcloud auth login` + set project | — |
| `01-export-firestore.ps1` | `gcloud firestore export` de PROD (y ERP con `-Erp`) | **Bucket GCS** `gs://<bucket>/firestore-export/<project>/<fecha>` |
| `02-export-auth.ps1` | `firebase auth:export` (usuarios + hashes) | `backups/<fecha>/auth/auth-users.json` |
| `03-backup-storage.ps1` | `gsutil -m rsync -r` del bucket de Storage | `backups/<fecha>/storage/<bucket>/` |
| `04-snapshot-config.ps1` | Copia reglas, `firebase.json`, `.firebaserc`, `functions/` (sin `node_modules`) + `MANIFEST.txt` | `backups/<fecha>/config/` |
| `backup-all.ps1` | Orquesta 01→04 con una sola fecha, confirmacion y log | `backups/<fecha>/` |

La exportacion de **Firestore** es del lado servidor y va a un **bucket de GCS**
(no a disco local). Todo lo demas queda en `backups/<fecha>/` dentro del repo.

---

## 2. Prerequisitos

- **PowerShell 7** (`pwsh`). El usuario ya lo tiene.
- **Node + npm** (ya instalados: Node v24, npm 11).
- **firebase-tools** — lo instala `00-prerequisitos.ps1` con `npm install -g firebase-tools`.
- **Google Cloud SDK** (`gcloud` + `gsutil`) — **NO** se instala por npm. Usa el
  instalador oficial:
  - <https://cloud.google.com/sdk/docs/install#windows> (marca `gsutil`), o
  - `winget install --id Google.CloudSDK -e`
  Tras instalar, **abre una terminal nueva** y vuelve a correr `00-prerequisitos.ps1`.

Primero corre siempre:

```powershell
pwsh -File ops/backup/00-prerequisitos.ps1
```

### Service account (para CI / tareas programadas)

Para backups desatendidos, en vez de login interactivo usa una cuenta de servicio:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\ruta\segura\sa-pruebas-cd728.json'
gcloud auth activate-service-account --key-file=$env:GOOGLE_APPLICATION_CREDENTIALS
gcloud config set project pruebas-cd728
```

No subas la clave JSON a git. Guardala fuera del repo.

---

## 3. Permisos IAM necesarios

La cuenta (usuario o service account) que ejecuta los backups necesita, sobre el
proyecto `pruebas-cd728` (y `<ERP_PROJECT_ID>` si respaldas el ERP):

| Operacion | Rol IAM minimo |
|---|---|
| Export de Firestore | `roles/datastore.importExportAdmin` |
| Leer/escribir buckets de GCS (export + rsync de Storage) | `roles/storage.admin` (o `roles/storage.objectViewer` solo para descargar Storage) |
| Listar functions / projects | `roles/viewer` o equivalente |

Ademas, la **service account interna de Firestore**
(`service-<PROJECT_NUMBER>@gcp-sa-firestore.iam.gserviceaccount.com`) debe poder
escribir en el bucket de exportacion. Si el bucket esta en el mismo proyecto suele
funcionar; si no, dale acceso de escritura.

Asignar un rol (ejemplo):

```powershell
gcloud projects add-iam-policy-binding pruebas-cd728 `
  --member="user:conamormarket@gmail.com" `
  --role="roles/datastore.importExportAdmin"
```

---

## 4. Crear el bucket de backups (una sola vez)

El export de Firestore necesita un bucket de GCS de DESTINO, en la **misma
region/multiregion** que tu Firestore:

```powershell
# Sustituye la region por la de tu Firestore (p.ej. us-central1, o nam5/eur3 si es multiregion).
gsutil mb -p pruebas-cd728 -l us-central1 gs://pruebas-cd728-backups
```

Recomendado: activa una **regla de ciclo de vida** para borrar backups antiguos
(p.ej. > 30 dias) y controlar costos.

---

## 5. Como correr

### Todo de una vez (recomendado antes de cada deploy)

```powershell
pwsh -File ops/backup/backup-all.ps1 -BackupBucket pruebas-cd728-backups
```

Con ERP incluido y sin confirmacion (desatendido):

```powershell
pwsh -File ops/backup/backup-all.ps1 -BackupBucket pruebas-cd728-backups -IncludeErp -Yes
```

Si tu bucket de Storage usa el dominio nuevo:

```powershell
pwsh -File ops/backup/backup-all.ps1 -BackupBucket pruebas-cd728-backups -StorageBucket pruebas-cd728.firebasestorage.app
```

### Paso a paso (individual)

```powershell
pwsh -File ops/backup/01-export-firestore.ps1 -BackupBucket pruebas-cd728-backups
pwsh -File ops/backup/01-export-firestore.ps1 -Erp -BackupBucket erp-backups   # ERP
pwsh -File ops/backup/02-export-auth.ps1
pwsh -File ops/backup/03-backup-storage.ps1
pwsh -File ops/backup/04-snapshot-config.ps1
```

Todos aceptan `-Date` (por defecto `Get-Date` en formato `yyyyMMdd-HHmmss`) por si
quieres alinear varios pasos a una misma marca.

---

## 6. Donde quedan los archivos

```
backups/
  20260623-091500/
    auth/      auth-users.json, auth-hash-config.txt
    storage/   <bucket>/...  (espejo del bucket de Storage)
    config/    firebase_firestore.rules, firebase_storage.rules,
               firebase.json, .firebaserc, functions/, MANIFEST.txt
    backup.log
```

El export de **Firestore** NO va aqui: queda en
`gs://<bucket>/firestore-export/<project>/<fecha>` (GCS). El `backup.log` y el
`MANIFEST.txt` registran la ubicacion.

> **Importante:** `backups/` contiene PII y hashes de password (Auth). Asegurate
> de que `backups/` este en `.gitignore` y NO se suba al repo ni a almacenamiento
> compartido sin cifrar.

---

## 7. Frecuencia recomendada

- **Antes de CADA deploy a produccion** (reglas, functions, hosting/Vercel):
  corre `backup-all.ps1`. Si algun paso falla, el orquestador sale con codigo 1
  y NO debes desplegar hasta resolverlo.
- **Diario programado:** registra una tarea en el Programador de tareas de Windows
  usando la service account (`-Yes` para desatendido). Ejemplo de accion:
  ```
  Programa : pwsh.exe
  Argumentos: -NoProfile -File "C:\...\wala-master\ops\backup\backup-all.ps1" -BackupBucket pruebas-cd728-backups -Yes
  ```
- **Retencion:** deja una regla de ciclo de vida en el bucket de GCS y limpia
  `backups/<fecha>` locales antiguos periodicamente.

---

## 8. Restauracion (referencia rapida, USAR CON CUIDADO)

- **Firestore:** `gcloud firestore import gs://<bucket>/firestore-export/<project>/<fecha> --project=pruebas-cd728`
- **Auth:** `firebase auth:import auth-users.json --project pruebas-cd728` (necesitas los
  parametros de hash; ver `auth-hash-config.txt`).
- **Storage:** `gsutil -m rsync -r <carpeta-local> gs://<bucket>` (revisa antes; sobreescribe).

La restauracion sobreescribe datos de produccion. Hazlo solo con plan y validacion.
