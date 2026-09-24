# Auditoría de datos y backend — 24 de septiembre de 2026

## Alcance y evidencia

Revisión del checkout local `wala-master-master`, sobre `72eeb8b`, con cambios locales
de esta auditoría. Se revisaron inicialización, consultas, escrituras, índices,
reglas, catálogo, pedidos, checkout, tareas programadas y analítica.

**Es un diagnóstico del código y del modelo declarado.** No se consultaron documentos
de producción, métricas de latencia, volúmenes, reglas efectivamente desplegadas ni
estado real de índices. No se ejecutaron cobros, migraciones o despliegues. Las pruebas
de concurrencia usan dobles del SDK; no sustituyen una prueba con reglas en emulador
ni mediciones de producción.

Los documentos anteriores `MODELO-DATOS.md` y `ESCALABILIDAD.md` mezclan fases pasadas
con objetivos futuros: por ejemplo, ya existen agregados diarios, paginación del
catálogo y filtro por fecha del ranking diario. No se contabilizan como mejoras nuevas.

## Estructura actual

| Área | Almacenamiento / ejecución | Observación |
|---|---|---|
| Frontend | React/Vite, SDK web de Firestore, Auth y Functions | Muchas consultas van directamente desde el navegador a Firestore. |
| Backend productivo declarado | `functions/index.js`, Node 22, Functions gen1 y gen2 | 72 exports en el archivo principal, cercano a 7.800 líneas; incluye pagos, fidelización, sorteos e integraciones. |
| Backend local | `backend/server.js` y `backend/data/mockData.js` | API Express de pruebas; optimizarla no mejora las rutas Firestore productivas. |
| Catálogo | `productos_wala`, `tienda_categories`, `categories`, `tienda_brands`, `tienda_collections` | Producto con imágenes, variantes y configuración de personalización embebidas. Las categorías actuales se unen con las legacy. |
| Configuración de tienda | `pages`, `landingPages`, `storefront`, `messages` | Coexisten configuración actual y fallbacks legacy; no se deben eliminar solo por similitud de nombres. |
| Pedidos activos | `pedidos_web`, `pedidos` | Cola web y flujo ERP. Se buscan por documento, con alias y formatos históricos. |
| Persistencia propia WALA | `wala_pedidos` | Conserva presencia/estado cuando el ERP transforma o retira la copia operativa. Es una duplicación con propósito. |
| Marketplace | `orders`, `subOrders`, `payouts`, `vendors`, `shippingZones` | Flujo distinto al pedido web/ERP; requiere preservar su contrato de precios y comisiones. |
| Pagos | `checkout_payment_intents`, `culqiCharges`, enlaces y registros de proveedor | Las intenciones separan preparación y creación del pedido pagado. |
| Perfiles y fidelización | `portal_clientes_users`, `loyaltyLedger`, `userMissions`, `userCoupons`, `wordle` | Hay historial/arrays dentro de perfiles y colecciones específicas. |
| Analítica | `analytics_events`, `analytics_sessions`, `analytics_daily`, resúmenes | Dashboard con agregados diarios y fallback a eventos crudos. |
| Índices | `firestore.indexes.json` | 25 índices compuestos y ninguna exención de campo declarada. Esto no prueba el estado desplegado. |

La configuración por defecto apunta a `sistema-gestion-3b225`. El ERP toma las variables
del portal salvo override explícito; se mantiene soporte para proyectos separados.

## Mejoras implementadas

| Problema comprobado | Corrección | Efecto verificable |
|---|---|---|
| Validación de carrito hacía `await get()` por cada línea, incluyendo productos repetidos. | `functions/cartValidation.js`: `getAll` por ID único, con proyección de precio, oferta, stock y visibilidad. Usa el lector transaccional cuando corresponde. | Una llamada agrupada en lugar de una por línea; un producto repetido se lee una vez por validación. Menor payload al omitir imágenes y configuración. La proyección no reduce por sí sola las lecturas facturadas. |
| Dos líneas podían pasar individualmente el control de stock aunque su suma lo excediera. | Se suma cantidad por producto antes de validar. También se rechazan productos ocultos o eliminados. | No permite eludir el control dividiendo el carrito. Esto sigue siendo validación, no reserva de stock entre compradores. |
| Portal y ERP creaban dos apps/conexiones para el mismo proyecto. El ERP no iniciaba sesión en su app separada. | Reutilizar app/Firestore del portal cuando el proyecto coincide. | Una instancia compartida, con sus credenciales y persistencia; proyecto distinto conserva instancia propia. |
| ERP solo activaba emulador en DEV, mientras portal también lo hacía en preview y por variable explícita. | Ambos usan `USE_EMULATORS` de la configuración principal. | Preview no selecciona una conexión ERP productiva mientras el portal apunta al emulador. |
| Búsqueda de pedidos esperaba primero `pedidos`, después `pedidos_web`, después espejo. | Consultar las tres fuentes independientes concurrentemente. Mantener fallbacks secuenciales dentro de cada colección. | Se elimina la suma de esperas entre fuentes sin multiplicar consultas de fallback ni perder IDs con ceros iniciales o copias históricas. |
| Consumidores con claves diferentes de React Query repetían la descarga completa del catálogo durante solicitudes simultáneas. | Compartir solo la lectura en curso de `getProducts()` sin filtros. | 20 solicitudes concurrentes al helper ejecutan una carga en prueba; al completarse, la próxima solicitud consulta de nuevo. Las listas públicas y de historial se normalizan por separado. |
| Una respuesta anterior a una edición podía repoblar localStorage después de invalidarlo. | Generación de caché y descarte de solicitudes pendientes al invalidar. | La respuesta antigua no reemplaza el caché de una lectura posterior a la edición. |
| Precarga completa del catálogo con clave distinta de la tienda, y claves desalineadas de destacados/configuración. | Quitar la precarga completa y alinear las dos claves con las de la tienda. | Desaparece una ruta de descarga completa innecesaria; se reutiliza la precarga ligera. Se corrige también la cancelación/repetición del efecto en StrictMode. |
| Agregación diaria esperaba eventos y luego sesiones. | Leer ambas fuentes en paralelo manteniendo ventana, paginación y cálculos. | Igual documento agregado; ninguna escritura parcial si una fuente falla. |

Ninguna mejora requiere índices nuevos, un backfill o una caché adicional con TTL.
Se conservaron la fórmula de precios del catálogo, confirmación de pagos, ledger y
reglas de fusión de estados. No se alteró `backend/` porque es un mock.

El criterio de paralelizar operaciones independientes y reducir campos transferidos
concuerda con las [prácticas oficiales de Firestore](https://firebase.google.com/docs/firestore/best-practices).
La firma transaccional de `getAll(...refs, { fieldMask })` se verificó también en las
declaraciones del SDK instalado en `functions/node_modules/@google-cloud/firestore`.

## Hallazgos pendientes, por prioridad

| Prioridad | Evidencia actual | Acción siguiente y condición |
|---|---|---|
| Crítica, integridad | `firebase/firestore.rules`, `pedidos_web`: update admite `request.resource.data.dni != null`. No limita los campos modificables. | Contrastar reglas desplegadas y enumerar escritores de todos los clientes/ERP. Mover cambios de pago/estado a operaciones autenticadas del servidor y probar reglas antes de cerrarlas. No se despliegan reglas compartidas a ciegas. |
| Alta, acceso | Lecturas de pedidos filtran por DNI, mientras reglas locales exigen `buyerUid` o admin. Compartir Auth no convierte una consulta por DNI en una consulta autorizada por propietario. | Normalizar propietarios históricos y adoptar queries por `buyerUid`, o endpoint autenticado que resuelva el historial. Requiere verificar cobertura real para no ocultar compras antiguas. |
| Alta, catálogo | `TiendaPage.jsx` mantiene una consulta completa para `facetProducts`, además del catálogo paginado; categorías automáticas y Header también requieren metadatos del catálogo. | Crear un resumen de facetas/categorías por marca, con actualización e invalidación desde todos los escritores. Solo entonces retirar las lecturas completas. Desactivarlas hoy haría desaparecer filtros válidos. |
| Alta, búsqueda | `search.js` vuelve a descargar el catálogo cuando la primera query no devuelve resultados o falla. `searchProducts` sigue filtrando una colección completa. | Verificar cobertura real de `searchTokens`/`nameLower`, ejecutar backfill idempotente si falta y retirar el fallback tras validar resultados. No interpretar un índice ausente como un catálogo vacío. |
| Alta, tareas periódicas | `notificationEngine` lee todos los perfiles cada hora, usa `getHours()` del servidor y acumula `antiSpamLog`. Segmentación también carga usuarios/pedidos completos. | Alinear reloj con Lima, seleccionar candidatos mediante campos/índices, paginar y procesar con concurrencia limitada. Probar deduplicación de notificaciones y contabilidad antes de cambiar ejecución. |
| Alta, informes | `salesAnalytics.js` limita a 400 pedidos por colección; fallback global de analytics lee hasta 5.000 eventos/300 sesiones. | Mostrar cobertura/truncamiento y usar agregados o paginación completa para totales. Verificar que `analytics_daily` exista para cada día solicitado; un límite no garantiza exactitud histórica. |
| Media, memoria | `analyticsDaily.fetchAllPaged` pagina la descarga, pero acumula todos los eventos/sesiones en arrays antes de agregar. | Agregador incremental que conserve deduplicación y contrato completo. Paginar no limita por sí solo la memoria total. |
| Media, escrituras | Variantes, diseños, imágenes y snapshots anidados se indexan automáticamente si no hay exenciones externas. | Medir tamaño de docs y fanout; excluir solo campos sin consultas en portal/ERP. No aplicar exenciones generales sin inventario de consumidores externos. |
| Media, consistencia | `createWebOrder` guarda `pedidos_web` y después el espejo con error tolerado. | Valorar batch atómico en servidor o outbox con reparación idempotente; ambas copias tienen funciones diferentes y no deben eliminarse. |
| Media, proveedores | `getPaypalAccessToken` solicita token OAuth en cada invocación. | Cache por instancia/credenciales hasta expiración con margen, solicitudes compartidas y recuperación de token inválido; nunca reintentar automáticamente un cobro incierto. |
| Media, mantenimiento | El archivo principal concentra 72 exports y muchos dominios. | Extraer por dominio con pruebas de contratos; medir arranque antes de afirmar que separar archivos elimina cold starts. La validación de carrito ya quedó separada. |

Estas tareas pendientes pueden afectar datos compartidos, cobertura histórica,
notificaciones o reglas de negocio; no se presentan como resueltas por los cambios
locales. El informe no afirma vulnerabilidad desplegada sin verificar sus reglas.

## Validación

- `npm run test:performance`: **20 pruebas pasan**. Incluye concurrencia, invalidación,
  lectura transaccional, stock acumulado, visibilidad, precio de combos, fallbacks de
  DNI, integración real de los servicios con SDK simulado, fusión de espejo, aislamiento
  de proyectos/emulador y preservación de agregados diarios.
- `npm run test:functions`: pasan las suites existentes de economía, anticipos,
  ruleta y precios de catálogo.
- `npm run test:meta-pixel`: **6 pruebas pasan** de compras confirmadas y deduplicación.
- `npm run build`: correcto. Persisten advertencias de CSS, imports estáticos/dinámicos
  y tamaño de chunks ajenos a estos cambios. El primer intento quedó limitado por
  permisos de esbuild en Windows; la ejecución fuera del sandbox terminó correctamente.
- `node --check` del backend y `git diff --check`: correctos.

Los tests prueban cambios en llamadas y resultados, **no una reducción porcentual de
latencia real**. No hay una línea base p50/p95 medida en producción en esta auditoría.

## Activación y medición

Los cambios quedan locales, sin commit/push ni despliegue. Para activarlos se necesita
publicar el frontend y desplegar las funciones afectadas: `prepareCheckoutPayment`,
`validateCartPricingSecure`, `aggregateAnalyticsDaily` y `aggregateAnalyticsDailyBackfill`.
No hace falta desplegar índices ni reglas para estas mejoras.

Antes/después del despliegue: comparar con la misma cuenta y catálogo los tiempos p50/p95
de apertura de tienda, Mis Compras y preparación del checkout; separar caché fría/caliente,
arranque frío/caliente de Functions y dispositivo/red. Registrar cantidad de solicitudes,
bytes, errores y duración de agregación. Contrastar ahorro con Firestore Usage/Query Insights;
contar llamadas al SDK no equivale automáticamente a lecturas facturadas.

Para cambios estructurales posteriores: inventario de colecciones, tamaños y formatos,
reglas e índices efectivos, consumidores ERP y cobertura de `buyerUid`/campos de búsqueda.
