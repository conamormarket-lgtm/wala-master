# Ficha de producto: validación local del 23/11/2026

Rama: `codex/ficha-producto-novaris-local`. El usuario indicó **continuar solo en local**: no se desplegó, fusionó ni publicó este trabajo.

## Resultado

- Editor compartido entre la ficha pública y crear/editar productos en Walá. Recomendados por búsqueda de nombre y miniatura, imagen de colección mediante subida o biblioteca, controles por archivo plegables.
- Mosaico flexible con 1–6 columnas, altura base, ancho/alto y columna inicial por pieza; tamaños propios en móvil. Se conservan los mosaicos clásicos existentes.
- Continuidad tras identificarse: conserva el borrador y la intención de añadir imagen, guardar o comprar. Una imagen pegada/arrastrada antes de entrar se conserva localmente y se retoma con un botón protegido contra doble clic.
- Medición de interacciones, personalizaciones, carrito, checkout, solicitudes y pagos confirmados. Los pagos proceden del servidor/ERP y se deduplican por pedido web, aunque lleguen desde ambas fuentes.

## Pruebas realizadas

| Prueba | Resultado |
| --- | --- |
| Suite de producto, mosaico, vídeos, servicios y analítica | 50 aprobadas, 0 fallos |
| Integración real con Firebase local: confirmación concurrente, deduplicación checkout/ERP y reglas | 1 aprobada; cliente sin sesión no lee, administrador cliente no escribe confirmaciones |
| Crear producto desde `/admin/productos/nuevo` | Guardó nombre, precio, stock, subtítulo y mosaico con foto + vídeo en Firestore local |
| Editar billetera existente | Guardó ficha de venta e imagen de colección subida a Storage local |
| Página pública del producto creado | Mostró la composición; vídeo con controles y sin reproducción automática |
| Invitado → texto y color → acceso → guardar → carrito | Conservó «Mi billetera QA», Marrón Coñac y la creación guardada en el carrito |
| Invitado → pegar PNG → acceso → continuar con imagen | Recuperó el archivo, lo subió a Storage local y creó la capa de imagen |
| Resultados → resumen | Mostró las métricas de prueba y distinguió solicitud de pago confirmado |
| Escritorio y móvil | Composición comprobada; vista móvil de 390 px sin desbordamiento horizontal |
| Compilación final | `vite build --mode preview` aprobada (18,83 s) |
| ESLint dirigido y `git diff --check` | Sin errores; permanecen advertencias previas de dependencia de efecto y variable sin uso |

La compilación conserva el aviso existente de chunks grandes. No se probó un cobro real ni la app Android. La medición probada utiliza eventos y pagos sintéticos locales; no son ventas reales.

## Entorno y evidencia

- Vista de catálogo: `http://127.0.0.1:5177/producto-preview.html?producto=yoryo-crear-billetera`.
- Aplicación con Firebase local: `http://127.0.0.1:5178`.
- Proyecto de emuladores: `demo-wala`; Auth 9099, Firestore 18080, Storage 9199. El puerto 8080 estaba ocupado por otra aplicación y se respetó.
- Los handlers de confirmación se ejecutaron directamente contra Firestore local, además de las pruebas unitarias. No se inició un emulador de pasarela de pago.
- Se aisló la caché Vite del servidor QA en `node_modules/.vite-qa-ficha` para evitar el error `Outdated Optimize Dep` al ejecutar dos servidores simultáneos.
- Evidencia: `C:\Users\YONELIA\Documents\Codex\wala-cierre-ficha-20261123\`: `tests-final.log`, `build-final.log`, `personalizacion-recuperada.jpg`, `imagen-recuperada.jpg`, `medicion-local.jpg`, `mosaico-billetera.jpg`, `verification.json`.

Prueba principal reproducible desde la raíz:

```powershell
node --experimental-vm-modules --test --test-concurrency=1 scripts/test/productDetails.test.mjs scripts/test/productVideos.test.mjs scripts/test/productMosaic.test.mjs scripts/test/dataServices.test.mjs scripts/test/analyticsResultadosCliente.test.mjs functions/test/productFunnel.test.js functions/test/analyticsDailyReads.test.js functions/test/analyticsResultados.test.js
```

Con los emuladores y la cuenta administrativa de prueba sembrada:

```powershell
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:18080'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
node --test scripts/test/productFunnel.emulator.test.mjs
```

## Publicación aplazada

Cuando se retome: preparar una entrega aislada de esta funcionalidad, porque el checkout también contiene trabajo independiente de telemetría y Kapi; revisar el diff, compilar con las claves públicas de pago del entorno y desplegar el frontend, las reglas de Firestore y las funciones `recordCheckoutPaymentAnalytics`, `recordErpPaymentAnalytics`, `aggregateAnalyticsDaily` y `aggregateAnalyticsToday`.

La conciliación cuenta el primer pago de pasarela o adelanto positivo de un pedido aprobado en ERP. No calcula ingresos netos de devoluciones ni reconstruye pagos anteriores al despliegue. El resumen de hoy se recalcula cada 30 minutos. Los contadores describen actividad del periodo, no personas únicas ni conversión de una misma cohorte.

Tras publicar habrá que comprobar un producto real y la llegada de confirmaciones al resumen. La sesión de Vercel también deberá renovarse entonces; no se reintentó después de la indicación de seguir solo en local.

## Corrección del mosaico vertical

Las tres imágenes originales miden 1086 × 1448 (3:4). La configuración de la vista previa colocaba dos en celdas de 360 × 120/150 px, reduciendo excesivamente las fotos con el ajuste completo. Se corrigió desde el editor: tres columnas con piezas iguales y proporción vertical 3:4; en móvil, una columna. El tamaño de las celdas sigue el ancho disponible y conserva el formato sin recortar la foto.

Se añadió `mosaicSizing: proportional` con proporciones seleccionables en Walá, incluyendo 3:4. Los datos anteriores conservan las alturas manuales hasta elegir una proporción. Comprobado tras guardar y recargar: 236 × 314,66 px por foto en la vista de escritorio y 350 × 466,66 px en móvil de 390 px, sin desbordamiento horizontal. Pasaron las 13 pruebas dirigidas, ESLint y la compilación preview (19,78 s). Evidencia: `mosaico-vertical-corregido.jpg`, `mosaico-vertical-movil.jpg` y `mosaico-build.log` en la misma carpeta de evidencia. Continúa exclusivamente en local.

## Proporción y ajuste por archivo

Se añadieron `media[].ratio` y `media[].fit` al normalizador, validador, contrato de datos, editor compartido y renderizado público. **Heredar del bloque** conserva el comportamiento anterior; **Original del archivo** utiliza sus dimensiones reales. También se puede elegir 1:1, 3:4, 4:5, 9:16 o 16:9 y mostrar completo o rellenar/recortar de forma independiente. Las alturas propias se calculan a partir del ancho disponible; los controles de alto manual se ocultan únicamente para la pieza que tenga proporción propia. Al ampliar, el archivo se ve completo.

- La billetera de vista previa quedó como ejemplo con foto vertical heredada, horizontal 16:9 recortada y cuadrada completa. Se guardó y recargó desde la interfaz.
- En móvil de 390 px se midieron piezas de 350 × 466,66, 350 × 196,88 y 350 × 350 px, separadas sin solaparse; el ancho del contenido coincidió con el viewport (382 px útiles).
- El producto de prueba `EI5bYhxuqijOVbtnS8Hy` se editó desde el formulario administrativo conectado a `demo-wala`. Firestore local conservó foto `portrait34/cover` y vídeo `auto/contain`. Se probó primero vídeo 9:16 y después Original; sus metadatos de 960 × 540 restituyeron 16:9, también al cambiar desde una proporción fija con el archivo ya cargado. Conserva controles y no se reproduce automáticamente.
- Pasaron 32 pruebas dirigidas de normalización, renderizado, edición/lectura de servicios, herencia y validación de valores. ESLint dirigido sin errores. Evidencia en `medios-individuales-tests.log`, `medios-individuales-build.log` y capturas `medios-individuales-*.jpg`.

No hubo publicaciones, cambios de reglas ni escrituras en producción.

## Reproducción configurable por vídeo

Cada vídeo de la composición admite `autoPlay`, `muted` y `loop`. Los archivos anteriores siguen con reproducción manual; activar autoplay inicia sin sonido. El editor compartido de creación/edición permite cambiar cada opción, con silencio obligatorio al iniciar automáticamente. El visitante conserva los controles nativos para pausar y activar audio. Los clips automáticos silenciosos no se pausan entre sí; ampliar pausa el mosaico de origen y cerrar reanuda sus clips automáticos. El evento manual de medición `video_play` excluye autoplay.

- La billetera local conserva las tres fotos y el vídeo de muestra de accesorios de 29,12 s, ahora con las tres opciones activadas. Se guardó y recargó tanto desde Editar composición como desde Probar formulario de producto.
- Se desactivaron las tres opciones desde el formulario: el vídeo quedó pausado, sin autoplay ni bucle; se reactivaron y volvió a arrancar silenciado. Se dejó guardada la configuración automática.
- Se comprobaron inicio automático y silencio en las vistas de 1280 px y 390 px, además de pausa del original al ampliar y reanudación al cerrar. El vídeo mantiene su proporción original 608 × 1080 y el móvil conserva dos columnas sin desbordamiento horizontal.
- Pasaron 36 pruebas dirigidas (normalización, valores booleanos, compatibilidad, renderizado, reproducción simultánea y persistencia de servicios), ESLint y build en modo preview. Evidencia: `video-autoplay-tests.log`, `video-autoplay-build.log` y `video-autoplay-editor.jpg` en la carpeta de evidencia local indicada arriba.

Continúa solo en local, en `codex/ficha-producto-novaris-local`.

## Incidencia pendiente: vídeo negro dentro del mosaico

Se observó de forma intermitente un vídeo negro en la celda aunque su tiempo de reproducción avanzaba; al ampliarlo sí se veía. La recarga restableció la imagen y no se volvió a reproducir durante la comprobación posterior. No se aplicó una corrección de código para esta incidencia: queda pendiente reproducirla y resolverla antes de considerar terminada la validación visual del vídeo.

El commit y push autorizados corresponden a esta rama de trabajo. El despliegue del frontend, las reglas y las funciones permanece aplazado.

## Verificación previa al commit

Se exportaron los archivos preparados para el commit a una carpeta independiente, excluyendo los cambios locales de Kapi y telemetría. Sobre ese conjunto pasaron 56 pruebas de composición, mosaico, vídeos, persistencia y medición; la compilación en modo `preview` terminó correctamente en 19,08 s, con el aviso existente de paquetes grandes. Registros: `commit-tests.log` y `commit-build.log` en la carpeta de evidencia. Esta comprobación no resuelve la incidencia visual intermitente descrita arriba ni sustituye la validación del despliegue.
