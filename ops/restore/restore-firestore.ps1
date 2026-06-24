#requires -Version 7.0
<#
.SYNOPSIS
  Restaura (import) un export de Firestore desde Cloud Storage a un proyecto Firebase.

.DESCRIPTION
  Envuelve 'gcloud firestore import' con validaciones y DOBLE CONFIRMACION porque la
  operacion es DESTRUCTIVA.

  ADVERTENCIAS (leer ops/restore/README.md):
    * SOBREESCRIBE documentos por ID (reemplaza el documento completo del backup).
    * NO BORRA documentos creados despues del backup -> puede quedar estado hibrido.
    * pruebas-cd728 es PRODUCCION real. Ensaya primero en staging.
    * Captura una red de seguridad (export del estado actual) antes de ejecutar.

.PARAMETER Source
  Ruta gs:// del export a importar. Ej:
    gs://pruebas-cd728-backups/firestore/2026-06-20T03-00-00

.PARAMETER ProjectId
  Project ID destino. Default: pruebas-cd728 (PROD Portal).
  Para ERP usa su propio project id.

.PARAMETER CollectionIds
  (Opcional) Lista de colecciones a importar. Si se omite, importa TODO el export.
  Ej: -CollectionIds pedidos,pedidos_web,portal_clientes_users

.PARAMETER SkipSafetyExport
  (Opcional) Omite el export de red de seguridad del estado actual. NO recomendado.

.PARAMETER SafetyBucket
  (Opcional) Bucket gs:// donde guardar el export de red de seguridad del estado actual.
  Requerido salvo que uses -SkipSafetyExport.

.EXAMPLE
  ./restore-firestore.ps1 -Source gs://pruebas-cd728-backups/firestore/2026-06-20T03-00-00 `
      -SafetyBucket gs://pruebas-cd728-backups/firestore

.EXAMPLE
  ./restore-firestore.ps1 -Source gs://erp-backups/firestore/2026-06-20 `
      -ProjectId <ERP_PROJECT_ID> -CollectionIds pedidos,pedidos_web -SkipSafetyExport
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^gs://')]
    [string]$Source,

    [Parameter(Mandatory = $false)]
    [string]$ProjectId = 'pruebas-cd728',

    [Parameter(Mandatory = $false)]
    [string[]]$CollectionIds,

    [Parameter(Mandatory = $false)]
    [switch]$SkipSafetyExport,

    [Parameter(Mandatory = $false)]
    [ValidatePattern('^gs://')]
    [string]$SafetyBucket
)

$ErrorActionPreference = 'Stop'

function Write-Section($text) {
    Write-Host ''
    Write-Host ('=' * 70) -ForegroundColor DarkGray
    Write-Host $text -ForegroundColor Cyan
    Write-Host ('=' * 70) -ForegroundColor DarkGray
}

# --- 0. Verificar que gcloud existe ---------------------------------------
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host 'ERROR: no se encontro gcloud (Google Cloud SDK).' -ForegroundColor Red
    Write-Host 'Instala desde https://cloud.google.com/sdk/docs/install y ejecuta gcloud auth login.' -ForegroundColor Yellow
    exit 1
}

# --- 1. Resumen de la operacion -------------------------------------------
Write-Section 'RESTAURACION DE FIRESTORE (DESTRUCTIVO)'
Write-Host "  Origen (backup):   $Source"
Write-Host "  Proyecto destino:  $ProjectId"
if ($CollectionIds) {
    Write-Host "  Colecciones:       $($CollectionIds -join ', ')"
} else {
    Write-Host '  Colecciones:       TODAS las del export'
}
Write-Host ''
Write-Host '  RECORDATORIO:' -ForegroundColor Yellow
Write-Host '   - El import SOBREESCRIBE documentos por ID.' -ForegroundColor Yellow
Write-Host '   - NO borra documentos creados despues del backup (estado puede quedar hibrido).' -ForegroundColor Yellow
if ($ProjectId -eq 'pruebas-cd728') {
    Write-Host '   - DESTINO = pruebas-cd728 == PRODUCCION REAL.' -ForegroundColor Red
}

# --- 2. Verificar que el origen existe ------------------------------------
Write-Section '1/4  Verificando que el origen exista...'
$gsutilOk = $null -ne (Get-Command gsutil -ErrorAction SilentlyContinue)
if ($gsutilOk) {
    try {
        gsutil ls $Source | Out-Null
        Write-Host "OK: el origen responde ($Source)." -ForegroundColor Green
    } catch {
        Write-Host "ADVERTENCIA: no se pudo listar $Source. Verifica la ruta y permisos." -ForegroundColor Yellow
        Write-Host '          (gcloud firestore import requiere la carpeta que contiene el archivo .overall_export_metadata)' -ForegroundColor Yellow
    }
} else {
    Write-Host 'gsutil no disponible; se omite la verificacion previa del origen.' -ForegroundColor Yellow
}

# --- 3. PRIMERA confirmacion ----------------------------------------------
Write-Section '2/4  CONFIRMACION 1 de 2'
Write-Host 'Esta operacion es DESTRUCTIVA y sobreescribira datos en el proyecto destino.'
$c1 = Read-Host "Escribe el PROJECT ID destino exacto para continuar ($ProjectId)"
if ($c1 -ne $ProjectId) {
    Write-Host 'Cancelado: el project id no coincide.' -ForegroundColor Red
    exit 1
}

# --- 4. SEGUNDA confirmacion ----------------------------------------------
Write-Section '3/4  CONFIRMACION 2 de 2'
$phrase = 'RESTAURAR'
$c2 = Read-Host "Escribe '$phrase' (en mayusculas) para ejecutar el import"
if ($c2 -cne $phrase) {
    Write-Host "Cancelado: no se escribio '$phrase'." -ForegroundColor Red
    exit 1
}

# --- 5. Red de seguridad: export del estado actual ------------------------
if (-not $SkipSafetyExport) {
    if (-not $SafetyBucket) {
        Write-Host 'ERROR: falta -SafetyBucket para la red de seguridad (o usa -SkipSafetyExport bajo tu propio riesgo).' -ForegroundColor Red
        exit 1
    }
    Write-Section '4/4  Capturando red de seguridad (export del estado ACTUAL)...'
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $safetyDest = "$($SafetyBucket.TrimEnd('/'))/pre-restore-$stamp"
    Write-Host "  Export actual -> $safetyDest"
    $exportArgs = @('firestore', 'export', $safetyDest, '--project', $ProjectId)
    if ($CollectionIds) {
        $exportArgs += "--collection-ids=$($CollectionIds -join ',')"
    }
    & gcloud @exportArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'ERROR: fallo el export de red de seguridad. Se ABORTA antes de importar.' -ForegroundColor Red
        exit 1
    }
    Write-Host "OK: red de seguridad guardada en $safetyDest" -ForegroundColor Green
} else {
    Write-Section '4/4  Red de seguridad OMITIDA (-SkipSafetyExport)'
    Write-Host 'Continuas sin punto de retorno. Bajo tu responsabilidad.' -ForegroundColor Yellow
}

# --- 6. Ejecutar el import ------------------------------------------------
Write-Section 'Ejecutando gcloud firestore import...'
$importArgs = @('firestore', 'import', $Source, '--project', $ProjectId)
if ($CollectionIds) {
    $importArgs += "--collection-ids=$($CollectionIds -join ',')"
}
Write-Host "  > gcloud $($importArgs -join ' ')" -ForegroundColor DarkGray
& gcloud @importArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'ERROR: el import fallo. Revisa la salida de gcloud.' -ForegroundColor Red
    Write-Host 'Si dejaste el sistema en mantenimiento, NO lo reabras hasta resolver.' -ForegroundColor Yellow
    exit 1
}

Write-Section 'IMPORT COMPLETADO'
Write-Host 'Recuerda los pasos restantes del README:' -ForegroundColor Green
Write-Host '  - Restaurar Auth y Storage si corresponde.'
Write-Host '  - Confirmar reglas buenas desplegadas (no las de mantenimiento).'
Write-Host '  - Reanudar schedulers pausados.'
Write-Host '  - Smoke test (login, pedidos, saldo de monedas, imagenes).'
Write-Host ''
Write-Host 'NOTA: los documentos creados DESPUES del backup NO fueron borrados por este import.' -ForegroundColor Yellow
