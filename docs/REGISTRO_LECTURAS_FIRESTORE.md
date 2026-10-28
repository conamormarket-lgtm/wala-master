# Registro central de lecturas de Walá y SISTEMA GESTIÓN

El cliente observa respuestas existentes y envía contadores agrupados al receptor
`collectClientFirestoreReads` de `sistema-gestion-3b225`, región `us-central1`.
El receptor escribe eventos estructurados `firestore_client_reads_v1` en Cloud Logging.
No lee ni escribe Firestore, no consulta permisos en documentos y no modifica Storage.
Centralizar tiene tráfico HTTP, invocaciones y volumen de logs; no significa coste total cero.

## Publicación

1. Desde este repositorio, publicar **solo** el receptor:
   `firebase deploy --only functions:collectClientFirestoreReads --project sistema-gestion-3b225`.
   No desplegar reglas, índices, hosting ni el conjunto de funciones por esta tarea.
2. Publicar los clientes de Walá y SISTEMA GESTIÓN después del receptor.
   Usan automáticamente `https://us-central1-<projectId>.cloudfunctions.net/collectClientFirestoreReads`.
   En desarrollo/emuladores el envío está apagado. Las páginas ya abiertas necesitan cargar
   la versión nueva; no se fuerza ninguna recarga ni reconexión.
3. En un navegador de cada aplicación: `__firestoreReads.status()` muestra perfil,
   `await __firestoreReads.verifyConnection()` envía `diagnostic.zeroReads` con
   contadores en cero para verificar el receptor sin consultar Firestore.
   sesión, cola, pérdidas y estado del envío. `await __firestoreReads.flush()` permite enviar
   lo pendiente, sin consultar Firestore. En ERP sigue disponible `__fsStats()`.
4. Verificar eventos nuevos en Logs Explorer. Un build o una prueba local **no** confirma
   despliegue, recepción central ni reducción de facturación.

Para desactivar, reconstruir el cliente con `NEXT_PUBLIC_FIRESTORE_READ_TELEMETRY=false`
(ERP) o `VITE_FIRESTORE_READ_TELEMETRY=false` (Walá). No es una bandera leída desde la DB.

## Consultar y comparar equipos

Logs Explorer: <https://console.cloud.google.com/logs/query?project=sistema-gestion-3b225>

```text
jsonPayload.metric="firestore_client_reads_v1"
timestamp >= "2026-10-28T16:00:00Z"
timestamp < "2026-10-28T17:15:00Z"
```

11:00–12:00 de Lima equivale a 16:00–17:00 UTC. Ampliar el rango de recepción por
reintentos/envíos tardíos y filtrar los minutos de observación en el informe.
Puede agregarse `jsonPayload.app="sistema-gestion"`, `jsonPayload.device="..."` o
`jsonPayload.rows.collection="fp_transactions"`. Los detalles de Finanzas son
`/finanzas/dashboard`, `/finanzas/registros`, `/finanzas/reports`, etc.

Exportar los resultados como array JSON (o usar una cuenta con permiso de lectura de logs):

```powershell
gcloud logging read 'jsonPayload.metric="firestore_client_reads_v1" AND timestamp>="2026-10-28T16:00:00Z" AND timestamp<"2026-10-29T17:00:00Z"' --project=sistema-gestion-3b225 --limit=20000 --format=json > lecturas.json
node scripts/firestore-read-report.mjs lecturas.json --from 2026-10-28T16:00:00Z --to 2026-10-28T17:00:00Z --by minute,app,device,originScreen,collection
```

El informe elimina reenvíos duplicados mediante `app/session/batch`. `--json` exporta
todos los grupos; la tabla de consola muestra los 50 principales. Si el export alcanza
su límite, dividir el intervalo; la herramienta no puede detectar truncamiento del export.
Consultar logs no lee documentos de Firestore. La retención depende del bucket de logs
configurado en el proyecto; esta implementación no cambia IAM, retención ni sinks.

`device` es un identificador aleatorio de **perfil de navegador y origen**, renovado a los
30 días. No es el nombre del PC ni identifica a una persona; dos navegadores o dos apps
en el mismo PC pueden tener distintos IDs. `session` identifica una carga/pestaña.
Para reconocer un equipo basta comparar el ID de `__firestoreReads.status()` con el informe.

## Interpretación y cobertura

- `originScreen`: ruta normalizada al iniciar la consulta/listener. `activeScreen`: ruta
  al recibir el resultado. No prueban qué componente de fondo inició una consulta global.
- `serverDocuments`: documentos entregados en resultados sincronizados con servidor.
  Listeners cuentan cambios, no toda la colección en cada actualización.
- `initialServerDocuments`: tamaño de la primera respuesta sincronizada de un listener,
  incluso si sus documentos ya llegaron de caché. **No sumarlo a `serverDocuments`**.
- Caché, escrituras pendientes, eliminaciones, resultados vacíos y agregaciones tienen
  contadores separados. No se convierten los resultados de `count/sum` en lecturas facturadas.
- Consultas iguales con listeners simultáneos se contabilizan mediante un observador líder
  por query y fuente. Esto no deduplica otros perfiles, pestañas ni procesos.
- Incluye SDK web y la lectura REST de `pages` en el arranque público de Walá. Excluye
  Admin SDK/backend/Cloud Functions, versiones antiguas, otras aplicaciones y lecturas de
  reglas/índices/reconexiones que el SDK no permite atribuir con precisión.
- Estos registros son diagnósticos, **no la factura de Firebase**. Deben compararse con
  ventanas completas de Monitoring/Usage para explicar picos nuevos, no reconstruir los pasados.

## Límites y privacidad

Sin textos, documentos, filtros, teléfonos, correos, UIDs de Auth, IDs de documentos,
tokens ni URLs multimedia en el payload. Rutas dinámicas usan plantillas `:id`/`:slug`;
los documentos de una ruta de colección se sustituyen por `*`.

Se envía como máximo un lote por ciclo de 60 segundos mientras hay actividad, además
del envío al ocultar/cerrar la página. No hay ping vacío ni consulta de configuración.
Se conservan hasta 160 filas pendientes y 8 lotes en `sessionStorage` de esa pestaña,
con vencimiento de 24 horas y reintento progresivo hasta 15 minutos. Caídas, restricciones
del navegador o cierre brusco pueden perder eventos; `dropped` informa descartes por límite.
No se garantiza entrega exacta ni se reintentan lecturas del negocio.

El receptor valida esquema/tamaño/proyecto, limita instancias y aplica un freno por IP
en memoria (no es cuota distribuida). ERP exige un token del proyecto ya autenticado;
Walá público admite orígenes exactos de producción sin iniciar sesión para telemetría.
Los datos anónimos se marcan `authenticated:false` y son evidencia aportada por clientes,
no medición autoritativa. Orígenes de preview y apps nativas sin sesión no están incluidos
por defecto; los públicos propios adicionales se configuran en `READ_METRICS_PUBLIC_ORIGINS`.
No se guardan IPs ni tokens en el evento diagnóstico; la plataforma conserva sus logs HTTP habituales.

## Pruebas sin acceso a producción

```powershell
node --test functions/test/clientReadMetrics.test.js scripts/test/firestoreReadRecorder.test.mjs scripts/test/firestoreReadReport.test.mjs
node --experimental-vm-modules --test scripts/test/firestoreObserved.test.mjs
npm run test:performance
npm run test:startup
```

El SDK real se prueba con red desactivada. Los fallos de envío/Auth/almacenamiento se
simulan; ninguna prueba llama al receptor publicado, lee Firestore remoto ni envía multimedia.
