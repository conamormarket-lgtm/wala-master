#Requires -Version 7.0
<#
.SYNOPSIS
    Respalda TODO el contenido del bucket de Firebase Storage a una carpeta
    local con timestamp, usando gsutil rsync.

.DESCRIPTION
    'gsutil -m rsync -r gs://<bucket> <carpeta-local>' descarga (sincroniza) todos
    los objetos del bucket de Storage a disco. -m = multihilo (paralelo), -r =
    recursivo.

    El bucket de Storage de WALA se configura por env var en la app
    (REACT_APP_FIREBASE_STORAGE_BUCKET). Por defecto, el de Firebase suele ser:
        pruebas-cd728.appspot.com
    pero proyectos creados recientemente usan el dominio nuevo:
        pruebas-cd728.firebasestorage.app
    VERIFICA cual es el real (consola de Firebase > Storage, o gsutil ls). Pasa el
    correcto con -Bucket.

.PARAMETER Bucket
    Bucket de Storage a respaldar (sin gs://).
    Por defecto: pruebas-cd728.appspot.com

.PARAMETER OutDir
    Carpeta raiz de backups. Por defecto <repo>/backups.

.PARAMETER Date
    Marca de fecha (Get-Date por defecto).

.PARAMETER Delete
    Si se pasa, agrega -d a rsync (borra en local lo que ya no esta en el bucket,
    espejo exacto). Por defecto NO se borra (mas seguro para backups acumulativos).

.EXAMPLE
    pwsh -File ops/backup/03-backup-storage.ps1

.EXAMPLE
    pwsh -File ops/backup/03-backup-storage.ps1 -Bucket pruebas-cd728.firebasestorage.app
#>
[CmdletBinding()]
param(
    [string]$Bucket = 'pruebas-cd728.appspot.com',
    [string]$OutDir,
    [string]$Date = (Get-Date -Format 'yyyyMMdd-HHmmss'),
    [switch]$Delete
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) { $OutDir = Join-Path $RepoRoot 'backups' }

# Normalizar bucket.
$Bucket = $Bucket -replace '^gs://', '' -replace '/+$', ''

# Carpeta destino: backups/<date>/storage/<bucket>
$StorageDir = Join-Path (Join-Path (Join-Path $OutDir $Date) 'storage') $Bucket

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' WALA - Backup de Firebase Storage' -ForegroundColor Cyan
Write-Host "  Bucket  : gs://$Bucket" -ForegroundColor Cyan
Write-Host "  Destino : $StorageDir" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if (-not (Get-Command gsutil -ErrorAction SilentlyContinue)) {
    Write-Error 'gsutil no esta instalado. Corre primero 00-prerequisitos.ps1.'
    exit 1
}

try {
    # Verificar que el bucket existe / hay acceso.
    & gsutil ls -b "gs://$Bucket" *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "El bucket gs://$Bucket no existe o no tienes acceso. Verifica el nombre (prueba .firebasestorage.app)."
        exit 1
    }

    # Crear carpeta local.
    if (-not (Test-Path $StorageDir)) {
        New-Item -ItemType Directory -Path $StorageDir -Force | Out-Null
    }

    # Construir argumentos de rsync.
    #   -m  : paralelo (multihilo)   -> va antes del subcomando
    #   -r  : recursivo
    #   -d  : (opcional) espejo exacto, borra local lo que no esta en remoto
    $rsyncArgs = @('-m', 'rsync', '-r')
    if ($Delete) {
        Write-Warning 'Modo -Delete: la carpeta local sera un ESPEJO exacto (se borra lo sobrante).'
        $rsyncArgs += '-d'
    }
    $rsyncArgs += @("gs://$Bucket", $StorageDir)

    Write-Host "`nSincronizando (puede tardar segun el tamano del bucket)..." -ForegroundColor Yellow
    Write-Host "  gsutil $($rsyncArgs -join ' ')" -ForegroundColor DarkGray
    & gsutil @rsyncArgs
    if ($LASTEXITCODE -ne 0) { throw "gsutil rsync devolvio codigo $LASTEXITCODE" }

    # Reporte de tamano.
    $count = (Get-ChildItem -Path $StorageDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
    Write-Host "`nBackup de Storage completado." -ForegroundColor Green
    Write-Host "  Archivos descargados: $count" -ForegroundColor Green
    Write-Host "  Carpeta: $StorageDir" -ForegroundColor Green
}
catch {
    Write-Error "Fallo el backup de Storage: $($_.Exception.Message)"
    Write-Host  'Si falla por permisos, tu cuenta necesita roles/storage.admin (o al menos objectViewer).' -ForegroundColor Red
    exit 1
}
