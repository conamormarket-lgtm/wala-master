#Requires -Version 7.0
<#
.SYNOPSIS
    Exporta TODA la base Firestore a un bucket de Google Cloud Storage (GCS),
    con timestamp, antes de tocar produccion.

.DESCRIPTION
    Usa 'gcloud firestore export gs://...'. La exportacion es del lado servidor:
    Firestore escribe un volcado consistente directamente en el bucket GCS.
    NO descarga nada a disco local (para eso esta 03-backup-storage.ps1 con el
    bucket de Storage, que es distinto).

    Proyecto PROD: pruebas-cd728
    Proyecto ERP : <ERP_PROJECT_ID>  (usar el switch -Erp)

.PARAMETER BackupBucket
    Bucket GCS de DESTINO de los volcados (sin gs://). Debe existir y estar en la
    MISMA region/multiregion que Firestore. Ej: pruebas-cd728-backups

.PARAMETER Date
    Marca de fecha para la carpeta del volcado. Por defecto la fecha/hora actual
    (Get-Date) en formato yyyyMMdd-HHmmss.

.PARAMETER Erp
    Si se pasa, exporta el proyecto ERP (<ERP_PROJECT_ID>) en vez de PROD.

.PARAMETER ProjectId
    Override del project id. Por defecto pruebas-cd728 (o el ERP si -Erp).

.EXAMPLE
    pwsh -File ops/backup/01-export-firestore.ps1 -BackupBucket pruebas-cd728-backups

.EXAMPLE
    # Exportar el ERP a su propio bucket
    pwsh -File ops/backup/01-export-firestore.ps1 -Erp -BackupBucket erp-backups
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupBucket,

    [string]$Date = (Get-Date -Format 'yyyyMMdd-HHmmss'),

    [switch]$Erp,

    [string]$ProjectId
)

$ErrorActionPreference = 'Stop'

# ----------------------------------------------------------------------------
# Resolver project id
# ----------------------------------------------------------------------------
$ProdProjectId = 'pruebas-cd728'
$ErpProjectId  = '<ERP_PROJECT_ID>'

if (-not $ProjectId) {
    $ProjectId = if ($Erp) { $ErpProjectId } else { $ProdProjectId }
}

if ($ProjectId -eq '<ERP_PROJECT_ID>') {
    Write-Error 'El project id del ERP no esta configurado. Edita el script y pon el id real, o pasa -ProjectId <id>.'
    exit 1
}

# Normalizar bucket (quitar gs:// si lo pusieron y barras finales).
$BackupBucket = $BackupBucket -replace '^gs://', '' -replace '/+$', ''

# Carpeta destino del volcado: gs://<bucket>/firestore-export/<project>/<date>
$ExportPath = "gs://$BackupBucket/firestore-export/$ProjectId/$Date"

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' WALA - Export de Firestore' -ForegroundColor Cyan
Write-Host "  Proyecto : $ProjectId" -ForegroundColor Cyan
Write-Host "  Destino  : $ExportPath" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

# ----------------------------------------------------------------------------
# Comprobaciones previas
# ----------------------------------------------------------------------------
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Error 'gcloud no esta instalado. Corre primero 00-prerequisitos.ps1.'
    exit 1
}

# Verificar que el bucket de backups existe (gsutil ls del bucket raiz).
if (Get-Command gsutil -ErrorAction SilentlyContinue) {
    try {
        & gsutil ls -b "gs://$BackupBucket" *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "El bucket gs://$BackupBucket no existe o no tienes acceso."
            Write-Host  "Crealo (una vez) con:" -ForegroundColor Yellow
            Write-Host  "  gsutil mb -p $ProjectId -l us-central1 gs://$BackupBucket" -ForegroundColor Yellow
            Write-Host  '  (usa la MISMA region que tu Firestore)' -ForegroundColor Yellow
            exit 1
        }
    }
    catch {
        Write-Warning "No se pudo verificar el bucket: $($_.Exception.Message)"
    }
}

# ----------------------------------------------------------------------------
# Export
# ----------------------------------------------------------------------------
try {
    Write-Host "`nIniciando export (puede tardar varios minutos)..." -ForegroundColor Yellow
    # --async devuelve de inmediato con un nombre de operacion; lo omitimos para
    # esperar a que termine y poder confirmar exito. Quita el comentario de --async
    # si prefieres lanzar y seguir.
    & gcloud firestore export $ExportPath --project=$ProjectId
    # & gcloud firestore export $ExportPath --project=$ProjectId --async

    if ($LASTEXITCODE -ne 0) {
        throw "gcloud firestore export devolvio codigo $LASTEXITCODE"
    }

    Write-Host "`nExport de Firestore completado." -ForegroundColor Green
    Write-Host "  Ubicacion: $ExportPath" -ForegroundColor Green
    Write-Host "  Para restaurar (CON CUIDADO):" -ForegroundColor DarkGray
    Write-Host "    gcloud firestore import $ExportPath --project=$ProjectId" -ForegroundColor DarkGray
}
catch {
    Write-Error "Fallo el export de Firestore: $($_.Exception.Message)"
    Write-Host  'Causas comunes:' -ForegroundColor Red
    Write-Host  '  - Falta el rol roles/datastore.importExportAdmin en tu cuenta.' -ForegroundColor Red
    Write-Host  '  - El bucket esta en otra region que Firestore.' -ForegroundColor Red
    Write-Host  '  - La service account de Firestore no tiene acceso al bucket.' -ForegroundColor Red
    exit 1
}
