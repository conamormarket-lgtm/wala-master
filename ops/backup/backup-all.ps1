#Requires -Version 7.0
<#
.SYNOPSIS
    Orquestador: corre los respaldos 01-04 en orden, con confirmacion y log.

.DESCRIPTION
    Ejecuta, COMPARTIENDO la misma marca de fecha:
      01-export-firestore.ps1   (Firestore PROD -> bucket GCS)
      02-export-auth.ps1        (Auth PROD -> JSON local)
      03-backup-storage.ps1     (Storage PROD -> carpeta local)
      04-snapshot-config.ps1    (reglas/config + manifiesto)

    Todo queda bajo backups/<date>/ y se escribe un log en backups/<date>/backup.log.

    Proyecto PROD: pruebas-cd728

.PARAMETER BackupBucket
    (OBLIGATORIO) Bucket GCS destino del export de Firestore (sin gs://).
    Ej: pruebas-cd728-backups

.PARAMETER StorageBucket
    Bucket de Firebase Storage a respaldar. Por defecto pruebas-cd728.appspot.com
    (verifica si tu proyecto usa pruebas-cd728.firebasestorage.app).

.PARAMETER ProjectId
    Project id PROD. Por defecto pruebas-cd728.

.PARAMETER OutDir
    Carpeta raiz de backups. Por defecto <repo>/backups.

.PARAMETER IncludeErp
    Si se pasa, tambien exporta Firestore del proyecto ERP (<ERP_PROJECT_ID>).

.PARAMETER Yes
    Salta la confirmacion interactiva (util para tareas programadas).

.EXAMPLE
    pwsh -File ops/backup/backup-all.ps1 -BackupBucket pruebas-cd728-backups

.EXAMPLE
    # Desatendido (tarea programada), con ERP incluido:
    pwsh -File ops/backup/backup-all.ps1 -BackupBucket pruebas-cd728-backups -IncludeErp -Yes
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupBucket,

    [string]$StorageBucket = 'pruebas-cd728.appspot.com',
    [string]$ProjectId     = 'pruebas-cd728',
    [string]$OutDir,
    [switch]$IncludeErp,
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'

$ScriptDir = $PSScriptRoot
$RepoRoot  = Resolve-Path (Join-Path $ScriptDir '..\..')
if (-not $OutDir) { $OutDir = Join-Path $RepoRoot 'backups' }

# UNA sola fecha para todos los pasos (consistencia de la carpeta del run).
$Date = Get-Date -Format 'yyyyMMdd-HHmmss'
$RunDir = Join-Path $OutDir $Date
$LogFile = Join-Path $RunDir 'backup.log'

# Crear carpeta del run para poder loguear desde el inicio.
New-Item -ItemType Directory -Path $RunDir -Force | Out-Null

# Logger: escribe a consola y al archivo de log.
function Write-Log {
    param([string]$Message, [string]$Color = 'Gray')
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $Message"
    Write-Host $line -ForegroundColor $Color
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' WALA - RESPALDO COMPLETO DE LA NUBE (orquestador)' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host "  Proyecto PROD   : $ProjectId"
Write-Host "  Bucket export   : gs://$BackupBucket"
Write-Host "  Bucket storage  : gs://$StorageBucket"
Write-Host "  Incluir ERP     : $IncludeErp"
Write-Host "  Carpeta destino : $RunDir"
Write-Host '============================================================' -ForegroundColor Cyan

# Confirmacion (salvo -Yes).
if (-not $Yes) {
    $resp = Read-Host 'Esto leera datos de PRODUCCION (pruebas-cd728). Continuar? (s/N)'
    if ($resp -notin @('s','S','y','Y')) {
        Write-Host 'Cancelado por el usuario.' -ForegroundColor Yellow
        exit 0
    }
}

Write-Log "=== INICIO RUN $Date ===" 'Cyan'
Write-Log "Proyecto PROD=$ProjectId  exportBucket=$BackupBucket  storageBucket=$StorageBucket  ERP=$IncludeErp"

# Resumen de pasos para el reporte final.
$results = [ordered]@{}

# Helper para correr cada paso, registrar resultado y NO abortar todo el run.
function Invoke-Step {
    param([string]$Name, [string]$Script, [string[]]$Arguments)
    Write-Log "--- $Name ---" 'Yellow'
    $path = Join-Path $ScriptDir $Script
    try {
        if (-not (Test-Path $path)) { throw "No existe el script $Script" }
        # Invocar el sub-script en el mismo proceso pwsh (& con splatting).
        & $path @Arguments
        if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) {
            throw "$Script termino con codigo $LASTEXITCODE"
        }
        $results[$Name] = 'OK'
        Write-Log "$Name -> OK" 'Green'
    }
    catch {
        $results[$Name] = "FALLO: $($_.Exception.Message)"
        Write-Log "$Name -> FALLO: $($_.Exception.Message)" 'Red'
    }
}

# ----------------------------------------------------------------------------
# 01 - Firestore PROD
# ----------------------------------------------------------------------------
Invoke-Step -Name '01 Firestore (PROD)' -Script '01-export-firestore.ps1' -Arguments @(
    '-BackupBucket', $BackupBucket, '-Date', $Date, '-ProjectId', $ProjectId
)

# 01b - Firestore ERP (opcional)
if ($IncludeErp) {
    Invoke-Step -Name '01 Firestore (ERP)' -Script '01-export-firestore.ps1' -Arguments @(
        '-BackupBucket', $BackupBucket, '-Date', $Date, '-Erp'
    )
}

# ----------------------------------------------------------------------------
# 02 - Auth PROD
# ----------------------------------------------------------------------------
Invoke-Step -Name '02 Auth (PROD)' -Script '02-export-auth.ps1' -Arguments @(
    '-OutDir', $OutDir, '-Date', $Date, '-ProjectId', $ProjectId
)

# ----------------------------------------------------------------------------
# 03 - Storage PROD
# ----------------------------------------------------------------------------
Invoke-Step -Name '03 Storage (PROD)' -Script '03-backup-storage.ps1' -Arguments @(
    '-Bucket', $StorageBucket, '-OutDir', $OutDir, '-Date', $Date
)

# ----------------------------------------------------------------------------
# 04 - Snapshot de configuracion + manifiesto
# ----------------------------------------------------------------------------
Invoke-Step -Name '04 Config snapshot' -Script '04-snapshot-config.ps1' -Arguments @(
    '-OutDir', $OutDir, '-Date', $Date, '-ProjectId', $ProjectId
)

# ----------------------------------------------------------------------------
# Resumen
# ----------------------------------------------------------------------------
Write-Log "=== RESUMEN RUN $Date ===" 'Cyan'
$anyFail = $false
foreach ($k in $results.Keys) {
    $v = $results[$k]
    $color = if ($v -eq 'OK') { 'Green' } else { 'Red'; }
    if ($v -ne 'OK') { $anyFail = $true }
    Write-Log ("  {0,-22} {1}" -f $k, $v) $color
}
Write-Log "Carpeta del run: $RunDir" 'Cyan'
Write-Log "Log: $LogFile" 'Cyan'
Write-Log "=== FIN RUN $Date ===" 'Cyan'

if ($anyFail) {
    Write-Host "`nUNO O MAS PASOS FALLARON. Revisa el log antes de tocar produccion." -ForegroundColor Red
    exit 1
}
else {
    Write-Host "`nRespaldo completo OK. Ya puedes proceder con el deploy." -ForegroundColor Green
    exit 0
}
