# Optimización del arranque de Walá

Implementación sobre `84f85ad22abf07e64a72aa755cf58061e1226d52`. Las mediciones de este informe se realizaron localmente antes de la publicación. No modifica datos, reglas ni funciones de Firebase.

## Resultado medido

Comparación de dos compilaciones de producción: el commit anterior y el árbol de trabajo optimizado. Ambas se sirvieron localmente con la misma compresión de JavaScript, CSS y TTF, y consultaron la configuración pública real de Firebase. Cada primera visita utiliza un contexto nuevo de Edge, sin almacenamiento previo. Se hicieron dos mediciones por escenario.

| Tiempo desde la navegación | Antes | Optimizado |
| --- | ---: | ---: |
| Escritorio: retirada del loader | 4,314–5,865 s | 3,114–3,115 s |
| Escritorio: LCP | 3,648–5,492 s | 2,724–2,748 s |
| Móvil simulado: retirada del loader | 16,153–17,744 s | 7,153–7,348 s |
| Móvil simulado: LCP | 15,764–17,276 s | 4,436–4,444 s |
| Móvil: solicitudes en la ventana observada | 116–121 | 47 |

El promedio de retirada del loader móvil pasó de 16,949 a 7,251 segundos, aproximadamente un 57% menos en estas pruebas. El móvil se simuló con viewport 390×844, descarga de 1,6 Mbps, subida de 0,75 Mbps, 150 ms de latencia añadida y CPU cuatro veces más lenta. Escritorio: 1440×900, sin limitación añadida.

Son mediciones de laboratorio local con servicios públicos reales; no son tiempos observados de esta versión en producción, percentiles de usuarios ni una garantía para cualquier conexión. El tráfico se observó hasta aproximadamente dos segundos después de retirar el loader. Las conexiones abiertas de Firestore impiden interpretar los bytes completados como tráfico total o lecturas facturadas. Los ensayos iniciales sin configuración de Firebase y las iteraciones intermedias se excluyeron de esta comparación.

## Cambios

- **Configuración e imagen desde el HTML.** Vite incorpora un arranque pequeño que pide únicamente `pages/home.sections` o `pages/tienda.sections`, antes de descargar y ejecutar React/Firebase. El hero se precarga en cuanto llega esa respuesta, seleccionando la imagen móvil cuando corresponde. React consume esa respuesta una sola vez y aplica la misma migración de secciones que el lector anterior. Una lectura posterior vuelve al SDK para respetar cambios del administrador. El intento inicial tiene un límite de 2,5 segundos y fallback al lector existente; se excluyen rutas privadas, marcas, previews y builds con emuladores.
- **Lectura pública sin credenciales privilegiadas.** Se usan los identificadores públicos ya incluidos en la app. Las llamadas anónimas siguen sujetas a las reglas de Firestore, como describe la [documentación de Firebase REST](https://firebase.google.com/docs/firestore/use-rest-api). No se añaden secretos ni permisos. La máscara de campos limita la respuesta a `sections`, según la [API de lectura de documentos](https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/get).
- **Editor bajo demanda.** La ficha de producto ya no importa estáticamente el personalizador Yoryo. Las precargas de rutas responden a intención de navegación y respetan ahorro de datos. Se eliminó el hook de precarga automática anterior. Las fuentes del editor se registran antes de montar el módulo del canvas, con un límite de espera si un proveedor falla.
- **Fuentes según uso.** El HTML conserva las familias de interfaz. Las fuentes locales y el resto de familias del editor se solicitan al necesitarlas; una fuente local elegida para una sección pública no instala todas las demás. Se mantienen las fuentes configuradas por el administrador y la disponibilidad completa en modo edición. La portada medida no descargó Segoe, Fabric, AdminViewEditor ni el catálogo de formas.
- **Datos y secciones progresivos.** El catálogo completo deja de ser una consulta incondicional de la portada. Las secciones inferiores se activan cerca del viewport después de resolver la primera pantalla. Conservan su estado al volver a desplazarse y soportan saltos largos. Las categorías del menú se consultan al interactuar. El catálogo paginado conserva una fuente completa de facetas cuando esa sección se abre; búsqueda y marcas mantienen su ámbito propio.
- **Loader limitado a lo visible al entrar.** Espera configuración, cabecera, datos de la primera sección relevante e imagen principal. Las consultas de secciones inferiores ya no mantienen bloqueada la entrada. Se conservan los límites ante fallos. Los filtros quedan asociados a la página, evitando arrastrar una marca o categoría al navegar a otra.
- **Carrusel sin competencia inicial.** Las diapositivas ocultas no descargan sus imágenes hasta que termina la primera o el visitante las selecciona. El autoplay empieza después de cargar la primera imagen.

El catálogo completo aún puede descargarse al abrir categorías o facetas. Se aplaza esa necesidad y se comparte la consulta; no se afirma haber eliminado toda lectura completa durante una sesión. Un resumen materializado de facetas sería una optimización posterior del modelo de datos.

## Validación

- `npm run test:startup`: 12 pruebas.
- `npm run test:performance`: 23 pruebas, incluidas reutilización de respuesta HTML, fallback al SDK, precarga por intención y registro de fuentes previo al canvas.
- `npm run test:meta-pixel`: 6 pruebas; se conserva el contrato de compras confirmadas.
- Compilación de producción correcta. Persisten los avisos anteriores de CSS, chunks grandes y módulos importados tanto estática como dinámicamente.
- Navegador: portada, menú de categorías, secciones al desplazarse, producto, agregado al carrito anónimo, persistencia al navegar, apertura del canvas, catálogo de marca, retorno al inicio y primera página de `/tienda`.
- Se simuló un HTTP 503 en la lectura anticipada y la portada cargó mediante el SDK. No hubo errores JavaScript no capturados en los recorridos validados.

Las pruebas de navegador no guardaron diseños, enviaron pedidos ni ejecutaron cobros. La personalización Yoryo conserva su requisito de sesión; no se probó un guardado autenticado en producción.

La evidencia local está en `C:/Users/YONELIA/.codex/visualizations/2026/09/24/01a0d3d9-5d1d-7e31-be9b-85ded115dcfa/cold-start/`. La comparación utiliza los JSON `final-before-*`, `repeat-before-*`, `verified-after-*` y `repeat-after-*`; `navigation-checks.json` y `startup-fallback-checks.json` recogen las comprobaciones funcionales. `profile-compare.cjs` y `serve-builds.cjs` documentan el protocolo. Los JSON de red omiten parámetros de URL, cookies y cuerpos de respuesta.
