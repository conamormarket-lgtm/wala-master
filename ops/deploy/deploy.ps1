#requires -Version 7.0
<#
.SYNOPSIS
    Script de despliegue a la nube para WALA / Portal de Clientes.
    Envuelve los comandos reales de Firebase CLI y Vercel CLI (los mismos
    que estan en package.json) detras de un unico parametro -Target.

.DESCRIPTION
    Artefactos soportados (-Target):
      rules            -> reglas Firestore + Storage   (firebase deploy --only firestore:rules,storage)
      indexes          -> indices Firestore            (firebase deploy --only firestore:indexes)
      functions        -> Cloud Functions (Node 22)    (npm --prefix functions ci; firebase deploy --only functions)
      hosting-firebase -> Web via Firebase Hosting      (npm run build; firebase deploy --only hosting)
      hosting-vercel   -> Web via Vercel (produccion)   (npx vercel --prod)
      all              -> rules + indexes + functions + hosting-vercel (en orden)

    REGLA DE ORO: respaldar antes de desplegar a produccion y probar en STAGING.
    Este script RECUERDA correr el backup y EXIGE confirmacion para -Target all
    y para cualquier deploy al proyecto de produccion (pruebas-cd728).

.PARAMETER Target
    Que artefacto desplegar. Valores: rules | indexes | functions | hosting-firebase | hosting-vercel | all

.PARAMETER Project
    Project id de Firebase destino. Por defecto 'pruebas-cd728' (PRODUCCION).
    Usa 'staging' (o el alias que definiste con 'firebase use --add') para staging.

.PARAMETER Yes
    Salta las confirmaciones interactivas (uso en CI / no interactivo).
    USAR CON CUIDADO: omite la barrera de seguridad de produccion.

.EXAMPLE
    .\deploy.ps1 -Target rules -Project staging

.EXAMPLE
    .\deploy.ps1 -Target functions -Project pruebas-cd728

.EXAMPLE
    .\deploy.ps1 -Target all -Project pruebas-cd728

.NOTES
    Plataforma: Windows + PowerShell 7 (pwsh).
    Requisitos: firebase-tools, vercel, node 22 (nvm use 22). Ver docs/wala/DESPLIEGUE.md.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('rules', 'indexes', 'functions', 'hosting-firebase', 'hosting-vercel', 'all')]
    [string]$Target,

    [Parameter(Mandatory = $false)]
    [string]$Project = 'pruebas-cd728',

    [Parameter(Mandatory = $false)]
    [switch]$Yes
)

# Aborta a la primera de cambio: cualquier error termina el script.
$ErrorActionPreference = 'Stop'

# --- Constantes -------------------------------------------------------------
$PROD_PROJECT = 'pruebas-cd728'   # ojo: el nombre dice "pruebas" pero es PRODUCCION real

# Raiz del repo = dos niveles arriba de este script (ops/deploy/ -> repo).
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path

# --- Helpers ----------------------------------------------------------------
function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[AVISO] $Message" -ForegroundColor Yellow
}

function Invoke-Checked {
    # Ejecuta un comando externo y aborta si el exit code != 0.
    param([scriptblock]$Command, [string]$What)
    Write-Host "    $What" -ForegroundColor DarkGray
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Fallo el paso '$What' (exit code $LASTEXITCODE)."
    }
}

function Confirm-OrAbort {
    param([string]$Prompt)
    if ($Yes) {
        Write-Warn "Confirmacion omitida por -Yes: $Prompt"
        return
    }
    $answer = Read-Host "$Prompt  Escribe 'SI' para continuar"
    if ($answer -ne 'SI') {
        Write-Host 'Cancelado por el usuario.' -ForegroundColor Red
        exit 1
    }
}

function Test-Tool {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "No se encontro '$Name' en el PATH. Instalalo (ver docs/wala/DESPLIEGUE.md seccion 1)."
    }
}

# --- Recordatorios de seguridad ---------------------------------------------
function Show-BackupReminder {
    Write-Warn 'REGLA DE ORO: respalda antes de desplegar a produccion.'
    Write-Host '    Ejecuta primero:  .\ops\backup\backup-all.ps1 -Project pruebas-cd728' -ForegroundColor Yellow
    Write-Host '    Y prueba en STAGING (-Project staging) antes de tocar produccion.' -ForegroundColor Yellow
}

function Assert-NodeVersionForFunctions {
    # Las Cloud Functions corren en Node 22. Avisar si la version local no coincide.
    $nodeVer = (& node -v) 2>$null
    if ($nodeVer -notlike 'v22.*') {
        Write-Warn "Node local es $nodeVer pero Functions requiere Node 22. Ejecuta 'nvm use 22' antes de desplegar functions."
        Confirm-OrAbort 'Continuar de todos modos con la version actual de Node?'
    }
}

# --- Acciones por artefacto -------------------------------------------------
function Deploy-Rules {
    Write-Step "Desplegando reglas Firestore + Storage (proyecto: $Project)"
    Test-Tool 'firebase'
    Invoke-Checked { firebase deploy --only firestore:rules,storage --project $Project } 'firebase deploy --only firestore:rules,storage'
}

function Deploy-Indexes {
    Write-Step "Desplegando indices Firestore (proyecto: $Project)"
    Test-Tool 'firebase'
    Write-Warn "firebase.json debe tener la clave firestore.indexes apuntando a un .json de indices; si no existe, este comando no despliega nada (ver DESPLIEGUE.md seccion 5b)."
    Invoke-Checked { firebase deploy --only firestore:indexes --project $Project } 'firebase deploy --only firestore:indexes'
}

function Deploy-Functions {
    Write-Step "Desplegando Cloud Functions (Node 22) (proyecto: $Project)"
    Test-Tool 'firebase'
    Test-Tool 'npm'
    Assert-NodeVersionForFunctions
    # Instala dependencias exactas de functions/ antes de desplegar.
    Invoke-Checked { npm --prefix (Join-Path $RepoRoot 'functions') ci } 'npm --prefix functions ci'
    Invoke-Checked { firebase deploy --only functions --project $Project } 'firebase deploy --only functions'
}

function Deploy-HostingFirebase {
    Write-Step "Desplegando Web via Firebase Hosting (proyecto: $Project)"
    Test-Tool 'firebase'
    Test-Tool 'npm'
    Write-Warn 'HOSTING DOBLE: este proyecto tambien puede servirse por Vercel. Elige UN hosting canonico (ver DESPLIEGUE.md seccion 5d).'
    Write-Warn 'El build usa el .env local; asegurate de que REACT_APP_FIREBASE_PROJECT_ID apunte al proyecto correcto ANTES de construir.'
    # npm run build = cross-env CI=false react-scripts build (genera ./build)
    Invoke-Checked { npm run build --prefix $RepoRoot } 'npm run build'
    Invoke-Checked { firebase deploy --only hosting --project $Project } 'firebase deploy --only hosting'
}

function Deploy-HostingVercel {
    Write-Step 'Desplegando Web via Vercel (PRODUCCION)'
    Test-Tool 'npx'
    Write-Warn 'Vercel usa sus propias env vars por entorno (Production vs Preview). El parametro -Project (Firebase) NO aplica aqui.'
    # = npm run deploy:vercel:prod (npx vercel --prod). Para preview usa: npx vercel (sin --prod).
    Invoke-Checked { npx vercel --prod } 'npx vercel --prod'
}

# --- Programa principal -----------------------------------------------------
Write-Host '========================================' -ForegroundColor Magenta
Write-Host ' WALA - Deploy a la nube' -ForegroundColor Magenta
Write-Host "   Target : $Target" -ForegroundColor Magenta
Write-Host "   Project: $Project" -ForegroundColor Magenta
Write-Host '========================================' -ForegroundColor Magenta

Show-BackupReminder

# Barrera de seguridad: confirmacion para produccion y para 'all'.
$isProd = ($Project -eq $PROD_PROJECT)

if ($isProd) {
    Write-Warn "Estas apuntando a PRODUCCION ($PROD_PROJECT)."
    Confirm-OrAbort "Confirmas DESPLEGAR '$Target' a PRODUCCION ($PROD_PROJECT)? Asegurate de haber respaldado y probado en staging."
}

if ($Target -eq 'all') {
    Write-Warn "-Target all desplegara: rules + indexes + functions + hosting-vercel (en ese orden)."
    Confirm-OrAbort "Confirmas el deploy COMPLETO (all) al proyecto '$Project'?"
}

switch ($Target) {
    'rules'            { Deploy-Rules }
    'indexes'          { Deploy-Indexes }
    'functions'        { Deploy-Functions }
    'hosting-firebase' { Deploy-HostingFirebase }
    'hosting-vercel'   { Deploy-HostingVercel }
    'all' {
        # Orden recomendado: primero el backend (reglas/indices/functions),
        # luego el frontend (web). hosting-vercel es el canonico recomendado.
        Deploy-Rules
        Deploy-Indexes
        Deploy-Functions
        Deploy-HostingVercel
        Write-Warn 'NOTA: -Target all uso hosting-vercel (canonico). Si tu canonico es Firebase, ejecuta aparte: .\deploy.ps1 -Target hosting-firebase'
    }
}

Write-Host "`n==> Deploy de '$Target' completado." -ForegroundColor Green
Write-Host '    Siguiente paso: VERIFICACION post-deploy (login / productos / checkout / push / claim monedas).' -ForegroundColor Green
Write-Host '    Monitorea: firebase functions:log --project ' + $Project -ForegroundColor Green
