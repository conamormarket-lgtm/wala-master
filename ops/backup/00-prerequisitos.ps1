#Requires -Version 7.0
<#
.SYNOPSIS
    Verifica e instala las herramientas necesarias para respaldar la nube de WALA
    (Firebase + Google Cloud) antes de tocar produccion.

.DESCRIPTION
    Proyecto Firebase de PRODUCCION (Portal): pruebas-cd728
    Proyecto Firebase ERP (separado): rellenar <ERP_PROJECT_ID> mas abajo.

    Este script NO toca la nube de forma destructiva. Solo:
      - Comprueba Node/npm.
      - Instala/verifica firebase-tools (npm global).
      - Verifica Google Cloud SDK (gcloud / gsutil).
      - Lanza 'firebase login' y 'gcloud auth login' si hace falta.
      - Fija el proyecto activo de gcloud a pruebas-cd728.

    IMPORTANTE: el usuario esta en Windows con PowerShell 7 (pwsh).
    Google Cloud SDK NO se puede instalar limpiamente con npm; hay que bajar el
    instalador oficial. Este script detecta su ausencia y da instrucciones.

.NOTES
    Ejecutar desde la raiz del repo:
        pwsh -File ops/backup/00-prerequisitos.ps1
#>

# Detener ante cualquier error no controlado.
$ErrorActionPreference = 'Stop'

# ----------------------------------------------------------------------------
# Parametros / constantes del proyecto
# ----------------------------------------------------------------------------
$ProjectId    = 'pruebas-cd728'      # Firebase PROD (Portal). Default en .firebaserc
$ErpProjectId = '<ERP_PROJECT_ID>'   # Firebase ERP (separado). Rellenar manualmente.

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' WALA - Prerequisitos de respaldo de la nube' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

# Funcion auxiliar: devuelve la ruta de un comando o $null si no existe.
function Get-CommandPath {
    param([string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

# ----------------------------------------------------------------------------
# 1) Node + npm (deberian existir: el usuario tiene Node v24, npm 11)
# ----------------------------------------------------------------------------
Write-Host "`n[1/5] Comprobando Node y npm..." -ForegroundColor Yellow
try {
    $nodeVer = (& node --version) 2>$null
    $npmVer  = (& npm --version) 2>$null
    if (-not $nodeVer) { throw 'Node no encontrado' }
    Write-Host "  Node: $nodeVer" -ForegroundColor Green
    Write-Host "  npm : $npmVer"  -ForegroundColor Green
}
catch {
    Write-Error "  Node/npm no estan disponibles. Instala Node LTS desde https://nodejs.org antes de continuar."
    exit 1
}

# ----------------------------------------------------------------------------
# 2) firebase-tools (CLI de Firebase) - se instala con npm global
# ----------------------------------------------------------------------------
Write-Host "`n[2/5] Comprobando firebase-tools..." -ForegroundColor Yellow
$firebasePath = Get-CommandPath 'firebase'
if (-not $firebasePath) {
    Write-Host '  firebase-tools NO esta instalado. Instalando globalmente con npm...' -ForegroundColor Magenta
    try {
        # Instalacion global. Puede pedir permisos; si falla, ejecutar pwsh como admin.
        & npm install -g firebase-tools
        if ($LASTEXITCODE -ne 0) { throw "npm install -g firebase-tools devolvio codigo $LASTEXITCODE" }
        $firebasePath = Get-CommandPath 'firebase'
    }
    catch {
        Write-Error "  No se pudo instalar firebase-tools: $($_.Exception.Message)"
        Write-Host  '  Instalalo manualmente:  npm install -g firebase-tools' -ForegroundColor Red
        exit 1
    }
}
try {
    $fbVer = (& firebase --version) 2>$null
    Write-Host "  firebase-tools: $fbVer  ($firebasePath)" -ForegroundColor Green
}
catch {
    Write-Warning '  No se pudo leer la version de firebase-tools, pero el binario existe.'
}

# ----------------------------------------------------------------------------
# 3) Google Cloud SDK (gcloud + gsutil) - NO se instala por npm
# ----------------------------------------------------------------------------
Write-Host "`n[3/5] Comprobando Google Cloud SDK (gcloud / gsutil)..." -ForegroundColor Yellow
$gcloudPath = Get-CommandPath 'gcloud'
$gsutilPath = Get-CommandPath 'gsutil'
if (-not $gcloudPath -or -not $gsutilPath) {
    Write-Warning '  Google Cloud SDK NO esta instalado (gcloud/gsutil no encontrados).'
    Write-Host '  No se puede instalar con npm. Opciones:' -ForegroundColor Red
    Write-Host '    A) Instalador oficial (recomendado en Windows):' -ForegroundColor Red
    Write-Host '       https://cloud.google.com/sdk/docs/install#windows' -ForegroundColor Red
    Write-Host '       Descarga GoogleCloudSDKInstaller.exe, marca "gsutil" y "bq" durante la instalacion.' -ForegroundColor Red
    Write-Host '    B) Si tienes winget:' -ForegroundColor Red
    Write-Host '       winget install --id Google.CloudSDK -e' -ForegroundColor Red
    Write-Host "`n  Tras instalar, ABRE UNA NUEVA terminal pwsh y vuelve a correr este script." -ForegroundColor Red
    # No abortamos del todo: firebase-tools ya quedo listo. Pero avisamos claramente.
    Write-Host '  (firebase-tools quedo listo; falta el SDK de Google Cloud para los pasos 01 y 03.)' -ForegroundColor Yellow
}
else {
    try {
        Write-Host "  gcloud: $gcloudPath" -ForegroundColor Green
        Write-Host "  gsutil: $gsutilPath" -ForegroundColor Green
        & gcloud --version | Select-Object -First 1 | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
    }
    catch {
        Write-Warning '  gcloud existe pero fallo al reportar version.'
    }
}

# ----------------------------------------------------------------------------
# 4) Autenticacion
# ----------------------------------------------------------------------------
Write-Host "`n[4/5] Autenticacion..." -ForegroundColor Yellow

# --- 4a. Firebase login ---
# 'firebase login:list' muestra las cuentas ya autenticadas. Si no hay, login interactivo.
try {
    $fbAccounts = (& firebase login:list) 2>&1 | Out-String
    if ($fbAccounts -match 'No authorized accounts' -or $fbAccounts -match 'No users') {
        Write-Host '  No hay sesion de Firebase. Lanzando firebase login (se abrira el navegador)...' -ForegroundColor Magenta
        & firebase login
        if ($LASTEXITCODE -ne 0) { Write-Warning '  firebase login fallo o se cancelo.' }
    }
    else {
        Write-Host '  Sesion de Firebase activa:' -ForegroundColor Green
        Write-Host "  $($fbAccounts.Trim())" -ForegroundColor Green
    }
}
catch {
    Write-Warning "  No se pudo comprobar la sesion de Firebase: $($_.Exception.Message)"
    Write-Host '  Ejecuta manualmente: firebase login' -ForegroundColor Red
}

# --- 4b. gcloud auth login + set project (solo si gcloud existe) ---
if ($gcloudPath) {
    try {
        # Lista cuentas activas. Si no hay ninguna ACTIVE, login interactivo.
        $activeAccount = (& gcloud auth list --filter=status:ACTIVE --format='value(account)') 2>$null
        if (-not $activeAccount) {
            Write-Host '  No hay cuenta activa en gcloud. Lanzando gcloud auth login (navegador)...' -ForegroundColor Magenta
            & gcloud auth login
            if ($LASTEXITCODE -ne 0) { Write-Warning '  gcloud auth login fallo o se cancelo.' }
        }
        else {
            Write-Host "  Cuenta gcloud activa: $activeAccount" -ForegroundColor Green
        }

        # Fijar el proyecto activo a PROD.
        Write-Host "  Fijando proyecto gcloud activo -> $ProjectId" -ForegroundColor Yellow
        & gcloud config set project $ProjectId
        if ($LASTEXITCODE -ne 0) { Write-Warning "  No se pudo fijar el proyecto $ProjectId en gcloud." }
        else { Write-Host "  Proyecto gcloud = $ProjectId" -ForegroundColor Green }
    }
    catch {
        Write-Warning "  Error en autenticacion de gcloud: $($_.Exception.Message)"
    }
}

# ----------------------------------------------------------------------------
# 5) (Opcional) Service Account en vez de login interactivo
# ----------------------------------------------------------------------------
# Para CI o tareas programadas (Programador de tareas de Windows) conviene NO
# depender de un login interactivo. En su lugar usa una cuenta de servicio:
#
#   1. En la consola de Google Cloud (proyecto pruebas-cd728):
#        IAM y administracion > Cuentas de servicio > Crear cuenta de servicio.
#      Asigna los roles minimos:
#        - roles/datastore.importExportAdmin   (export/import de Firestore)
#        - roles/storage.admin                 (leer/escribir buckets de GCS)
#   2. Crea una clave JSON y descargala (NO la subas a git; guardala fuera del repo).
#   3. Exporta la variable de entorno antes de correr los scripts 01-04:
#
#        $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\\ruta\\segura\\sa-pruebas-cd728.json'
#
#      Y autentica gcloud con esa clave (una sola vez por sesion):
#
#        gcloud auth activate-service-account --key-file=$env:GOOGLE_APPLICATION_CREDENTIALS
#        gcloud config set project pruebas-cd728
#
#      firebase-tools tambien respeta GOOGLE_APPLICATION_CREDENTIALS para comandos
#      no interactivos (auth:export, etc.).
# ----------------------------------------------------------------------------
if ($env:GOOGLE_APPLICATION_CREDENTIALS) {
    Write-Host "`n[5/5] GOOGLE_APPLICATION_CREDENTIALS detectada:" -ForegroundColor Yellow
    Write-Host "  $($env:GOOGLE_APPLICATION_CREDENTIALS)" -ForegroundColor Green
    if (-not (Test-Path $env:GOOGLE_APPLICATION_CREDENTIALS)) {
        Write-Warning '  El archivo de credenciales NO existe en esa ruta.'
    }
}
else {
    Write-Host "`n[5/5] (Sin service account) Usando login interactivo. Ver comentarios del script para configurar GOOGLE_APPLICATION_CREDENTIALS." -ForegroundColor Yellow
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host ' Prerequisitos comprobados.' -ForegroundColor Cyan
Write-Host " PROD: $ProjectId   ERP: $ErpProjectId" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
