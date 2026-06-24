#Requires -Version 7.0
<#
.SYNOPSIS
    Toma un snapshot de la configuracion del proyecto (reglas, firebase.json,
    .firebaserc, codigo de functions) y genera un manifiesto con el estado actual
    de la nube y del entorno local.

.DESCRIPTION
    Copia a backups/<date>/config/:
      - firebase/firestore.rules
      - firebase/storage.rules
      - firebase.json
      - .firebaserc
      - functions/  (solo CODIGO: .js, package.json, package-lock.json; sin node_modules)
    Y escribe backups/<date>/config/MANIFEST.txt con:
      - git rev-parse HEAD + estado del working tree
      - versiones de node / npm / firebase-tools / gcloud
      - gcloud config (proyecto/cuenta activos)
      - firebase functions:list y firebase projects:list

    Proyecto PROD: pruebas-cd728

.PARAMETER OutDir
    Carpeta raiz de backups. Por defecto <repo>/backups.

.PARAMETER Date
    Marca de fecha (Get-Date por defecto).

.PARAMETER ProjectId
    Override del project id. Por defecto pruebas-cd728.

.EXAMPLE
    pwsh -File ops/backup/04-snapshot-config.ps1
#>
[CmdletBinding()]
param(
    [string]$OutDir,
    [string]$Date = (Get-Date -Format 'yyyyMMdd-HHmmss'),
    [string]$ProjectId = 'pruebas-cd728'
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) { $OutDir = Join-Path $RepoRoot 'backups' }

$ConfigDir = Join-Path (Join-Path $OutDir $Date) 'config'
$Manifest  = Join-Path $ConfigDir 'MANIFEST.txt'

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' WALA - Snapshot de configuracion + manifiesto' -ForegroundColor Cyan
Write-Host "  Proyecto : $ProjectId" -ForegroundColor Cyan
Write-Host "  Destino  : $ConfigDir" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

# Helper: agrega una seccion al manifiesto ejecutando un scriptblock y capturando
# su salida (o el error) sin abortar el script completo.
function Add-Section {
    param([string]$Title, [scriptblock]$Action)
    Add-Content -Path $Manifest -Value "`n===== $Title =====" -Encoding UTF8
    try {
        $out = & $Action 2>&1 | Out-String
        if ([string]::IsNullOrWhiteSpace($out)) { $out = '(sin salida)' }
        Add-Content -Path $Manifest -Value $out.TrimEnd() -Encoding UTF8
    }
    catch {
        Add-Content -Path $Manifest -Value "ERROR: $($_.Exception.Message)" -Encoding UTF8
    }
}

try {
    # Crear estructura de carpetas.
    if (-not (Test-Path $ConfigDir)) {
        New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    }

    # ------------------------------------------------------------------
    # 1) Copiar archivos de configuracion
    # ------------------------------------------------------------------
    Write-Host "`nCopiando archivos de configuracion..." -ForegroundColor Yellow
    $filesToCopy = @(
        'firebase\firestore.rules',
        'firebase\storage.rules',
        'firebase.json',
        '.firebaserc'
    )
    foreach ($rel in $filesToCopy) {
        $src = Join-Path $RepoRoot $rel
        if (Test-Path $src) {
            # Aplanar el nombre para no perder los de firebase\ (usar guion bajo).
            $destName = ($rel -replace '[\\/]', '_')
            Copy-Item -Path $src -Destination (Join-Path $ConfigDir $destName) -Force
            Write-Host "  OK  $rel" -ForegroundColor Green
        }
        else {
            Write-Warning "  No encontrado: $rel"
        }
    }

    # ------------------------------------------------------------------
    # 2) Copiar codigo de functions (sin node_modules)
    # ------------------------------------------------------------------
    Write-Host "`nCopiando codigo de functions (sin node_modules)..." -ForegroundColor Yellow
    $functionsSrc  = Join-Path $RepoRoot 'functions'
    $functionsDest = Join-Path $ConfigDir 'functions'
    if (Test-Path $functionsSrc) {
        New-Item -ItemType Directory -Path $functionsDest -Force | Out-Null
        # Copiar solo codigo y manifiestos; excluir node_modules y artefactos.
        Get-ChildItem -Path $functionsSrc -Recurse -File |
            Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
            ForEach-Object {
                $relPath = $_.FullName.Substring($functionsSrc.Length).TrimStart('\','/')
                $target  = Join-Path $functionsDest $relPath
                $targetDir = Split-Path $target -Parent
                if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
                Copy-Item -Path $_.FullName -Destination $target -Force
            }
        Write-Host '  OK  functions/ (codigo)' -ForegroundColor Green
    }
    else {
        Write-Warning '  Carpeta functions/ no encontrada.'
    }

    # ------------------------------------------------------------------
    # 3) Manifiesto
    # ------------------------------------------------------------------
    Write-Host "`nGenerando MANIFEST.txt..." -ForegroundColor Yellow
    Set-Content -Path $Manifest -Value "WALA - MANIFIESTO DE BACKUP" -Encoding UTF8
    Add-Content -Path $Manifest -Value "Fecha snapshot : $Date" -Encoding UTF8
    Add-Content -Path $Manifest -Value "Generado       : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')" -Encoding UTF8
    Add-Content -Path $Manifest -Value "Proyecto PROD  : $ProjectId" -Encoding UTF8
    Add-Content -Path $Manifest -Value "Repo root      : $RepoRoot" -Encoding UTF8

    # --- git ---
    Add-Section -Title 'GIT HEAD' -Action {
        Push-Location $RepoRoot
        try {
            & git rev-parse HEAD
            & git rev-parse --abbrev-ref HEAD
        } finally { Pop-Location }
    }
    Add-Section -Title 'GIT STATUS (porcelain)' -Action {
        Push-Location $RepoRoot
        try { & git status --porcelain } finally { Pop-Location }
    }
    Add-Section -Title 'GIT REMOTES' -Action {
        Push-Location $RepoRoot
        try { & git remote -v } finally { Pop-Location }
    }

    # --- versiones del entorno ---
    Add-Section -Title 'NODE / NPM' -Action {
        "node $(& node --version)"
        "npm  $(& npm --version)"
    }
    Add-Section -Title 'FIREBASE-TOOLS' -Action { & firebase --version }
    Add-Section -Title 'GCLOUD VERSION' -Action {
        if (Get-Command gcloud -ErrorAction SilentlyContinue) { & gcloud --version }
        else { 'gcloud no instalado' }
    }

    # --- estado de la nube ---
    Add-Section -Title 'GCLOUD CONFIG (proyecto/cuenta activos)' -Action {
        if (Get-Command gcloud -ErrorAction SilentlyContinue) { & gcloud config list }
        else { 'gcloud no instalado' }
    }
    Add-Section -Title 'FIREBASE PROJECTS' -Action { & firebase projects:list }
    # firebase functions:list (gen1/gen2) - inventario de funciones desplegadas.
    Add-Section -Title "FIREBASE FUNCTIONS LIST ($ProjectId)" -Action {
        & firebase functions:list --project $ProjectId
    }

    Write-Host "`nSnapshot de configuracion completado." -ForegroundColor Green
    Write-Host "  Carpeta : $ConfigDir" -ForegroundColor Green
    Write-Host "  Manifest: $Manifest" -ForegroundColor Green
}
catch {
    Write-Error "Fallo el snapshot de configuracion: $($_.Exception.Message)"
    exit 1
}
