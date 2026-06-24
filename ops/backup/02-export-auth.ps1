#Requires -Version 7.0
<#
.SYNOPSIS
    Exporta los usuarios de Firebase Authentication a un JSON local con timestamp.

.DESCRIPTION
    Usa 'firebase auth:export'. Vuelca TODOS los usuarios de Authentication
    (uid, email, telefono, providers, hashes de password, etc.) a un archivo.

    Proyecto PROD: pruebas-cd728

    NOTA DE SEGURIDAD: el JSON incluye hashes de contrasena y PII. Tratalo como
    secreto: no lo subas a git ni a almacenamiento compartido sin cifrar.
    (La carpeta backups/ deberia estar en .gitignore.)

.PARAMETER OutDir
    Carpeta raiz de backups. Por defecto <repo>/backups.

.PARAMETER Date
    Marca de fecha (Get-Date por defecto, formato yyyyMMdd-HHmmss).

.PARAMETER ProjectId
    Override del project id. Por defecto pruebas-cd728.

.EXAMPLE
    pwsh -File ops/backup/02-export-auth.ps1
#>
[CmdletBinding()]
param(
    [string]$OutDir,
    [string]$Date = (Get-Date -Format 'yyyyMMdd-HHmmss'),
    [string]$ProjectId = 'pruebas-cd728'
)

$ErrorActionPreference = 'Stop'

# Raiz del repo = dos niveles arriba de este script (ops/backup/ -> repo).
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) { $OutDir = Join-Path $RepoRoot 'backups' }

# Carpeta de destino: backups/<date>/auth
$AuthDir = Join-Path (Join-Path $OutDir $Date) 'auth'
$OutFile = Join-Path $AuthDir 'auth-users.json'
$HashCfg = Join-Path $AuthDir 'auth-hash-config.txt'

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' WALA - Export de Firebase Authentication' -ForegroundColor Cyan
Write-Host "  Proyecto : $ProjectId" -ForegroundColor Cyan
Write-Host "  Destino  : $OutFile" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Error 'firebase-tools no esta instalado. Corre primero 00-prerequisitos.ps1.'
    exit 1
}

try {
    # Crear la carpeta de destino si no existe.
    if (-not (Test-Path $AuthDir)) {
        New-Item -ItemType Directory -Path $AuthDir -Force | Out-Null
    }

    Write-Host "`nExportando usuarios..." -ForegroundColor Yellow
    # --format=json fuerza salida JSON. Sin --format genera el mismo JSON por
    # extension del archivo (.json).
    & firebase auth:export $OutFile --format=json --project $ProjectId
    if ($LASTEXITCODE -ne 0) { throw "firebase auth:export devolvio codigo $LASTEXITCODE" }

    # Aviso sobre los hashes de password para poder reimportar correctamente.
    $note = @"
NOTA: para reimportar usuarios conservando sus contrasenas necesitas los
parametros de hash del proyecto (algoritmo, signer key, salt separator, rounds,
mem cost). Obtenlos en la consola de Firebase:
  Authentication > (menu ...) > Configuracion de hash de contrasena de usuario.
Guardalos junto a este backup. El comando de import seria del estilo:
  firebase auth:import auth-users.json --project $ProjectId \\
    --hash-algo=SCRYPT --hash-key=... --salt-separator=... --rounds=8 --mem-cost=14
"@
    Set-Content -Path $HashCfg -Value $note -Encoding UTF8

    $size = (Get-Item $OutFile).Length
    Write-Host "`nExport de Auth completado." -ForegroundColor Green
    Write-Host "  Archivo: $OutFile ($([math]::Round($size/1KB,1)) KB)" -ForegroundColor Green
    Write-Host "  Recordatorio de hashes: $HashCfg" -ForegroundColor Green
    Write-Warning '  Contiene PII y hashes de password. NO lo subas a git.'
}
catch {
    Write-Error "Fallo el export de Authentication: $($_.Exception.Message)"
    exit 1
}
