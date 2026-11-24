# Kapi en la tienda publicada

Kapi acompaña en `/`, `/home`, `/tienda`, `/personalizar`, `/carrito` y `/producto/:id`. Conserva los globos, las 20 animaciones aprobadas, las guías que señalan elementos, la búsqueda semántica y la comparación según presupuesto. Las tarjetas abren la ficha real en la misma pestaña. El sistema de [mascotas por marca](KAPI-MASCOTAS-POR-MARCA.md) incorpora a la cuyita de Lumi y habilita las páginas de marcas configuradas.

## Conexión y secretos

El navegador llama a `/__kapi/chat`. Vercel lo reescribe a la función `kapiAssistant` del proyecto Firebase `sistema-gestion-3b225`, región `us-central1`. La función usa Node 22 y consulta OpenAI y el catálogo publicado; el cliente nunca recibe la clave ni importa el backend.

`KAPI_OPENAI_API_KEY` se obtiene de Google Secret Manager mediante `runWith({secrets: [...]})`. No configurar esta clave como variable `VITE_*`, ni copiar `.wala-kapi.env` al repositorio. La configuración local permanece en el archivo privado del directorio personal. Para rotarla, usar la entrada interactiva de `firebase functions:secrets:set KAPI_OPENAI_API_KEY --project sistema-gestion-3b225` y redesplegar únicamente `functions:kapiAssistant`.

Se permiten solicitudes de navegador desde `https://www.wala.pe` y `https://wala.pe`. Los previews de Vercel no tienen acceso al chat público. El origen y el encabezado de cliente reducen solicitudes accidentales entre sitios; no sustituyen autenticación ni impiden que un cliente externo imite esos encabezados. El límite global del servidor restringe el consumo incluso en ese caso.

## Conversación y catálogo

Los módulos compartidos viven en `functions/kapi/`; `scripts/kapi-local` los reutiliza para desarrollo. El catálogo se lee con permisos públicos y utiliza las mismas reglas de visibilidad y precios de la tienda. Búsqueda: `text-embedding-3-small`, 512 dimensiones, seguida de revisión semántica. Conversación y selección: `gpt-6-luna`.

La pestaña conserva el último intercambio visual y un token de conversación cifrado y autenticado (AES-256-GCM, clave derivada mediante HKDF). El servidor valida ese token, no un historial enviado libremente por el navegador. Vence tras una hora sin renovar; una rotación de clave lo invalida. Las conversaciones no se escriben en Firestore. El texto necesario para contestar sí se envía a OpenAI.

`kapi_server` contiene únicamente contadores de uso y caché de embeddings del catálogo. Sus documentos y subcolecciones están fuera de la regla genérica del ERP y no tienen acceso de cliente, incluso con sesión iniciada. La función utiliza Admin SDK. No se guardan IP en claro ni claves en esos documentos.

## Límites iniciales

- 200 llamadas al proveedor por día UTC en toda la tienda, contando conversación, embeddings y revisión de búsqueda. Una pregunta puede consumir varias llamadas.
- 8 mensajes por minuto por grupo de IP, mediante 4096 grupos HMAC de tamaño fijo. Las colisiones y las IP compartidas pueden compartir límite. El proxy puede agrupar visitantes bajo la misma IP.
- Máximo 2 instancias, 512 MB, sin instancias mínimas; timeout de función 90 s y cancelación de consulta a los 60 s.
- Mensajes de hasta 1000 caracteres, cuerpo HTTP de hasta 60 KB. Sin pedidos, cambios de carrito ni acciones de compra desde la IA.

Los límites reducen el consumo pero no son una promesa de costo monetario fijo. Si se alcanza el cupo, se informa en el globo y siguen disponibles las guías y la tienda.

## Publicación y comprobación

La rama principal y de producción es `master`, en `conamormarket-lgtm/wala-master`. El proyecto Vercel activo es `wala-master` del equipo `conamors-projects`; el archivo histórico `.vercel/project.json` no identifica ese proyecto y no debe usarse para desplegar esta tienda.

Primero desplegar reglas y solo la función nueva, luego publicar la interfaz por Git:

```sh
firebase deploy --only firestore:rules --project sistema-gestion-3b225
firebase deploy --only functions:kapiAssistant --project sistema-gestion-3b225
node --test scripts/test/kapiBuild.test.mjs scripts/test/kapiPublic.test.mjs scripts/test/kapiLocal.test.mjs scripts/test/kapiSemanticSearch.test.mjs scripts/test/kapiComparison.test.mjs src/components/kapi-local/model.test.mjs
npm run build
```

`/__kapi/health` informa únicamente disponibilidad de configuración y proveedor. Comprobar en `https://www.wala.pe`: abrir Kapi, pedir un producto, seguir la tarjeta en la misma pestaña, explicar la ficha y recargar conservando la conversación; revisar móvil y escritorio. Los controles de prueba y tokens de uso quedan limitados a desarrollo. Los assets públicos se versionan bajo `/assets/kapi/companion-v1/`.

Para retirar la interfaz, revertir el commit de activación en `master` y verificar el despliegue. Para detener también el consumo del endpoint, deshabilitar o eliminar únicamente `kapiAssistant`; no revocar una clave compartida con otras aplicaciones sin revisar sus usos. Conservar las reglas que protegen `kapi_server`.

Validación previa a publicación: 51 pruebas correctas y build de Vercel completo. Backend desplegado y comprobado con búsqueda real de “espada voladora” y continuación sobre la ficha: ambas HTTP 200, con token cifrado. Origen ajeno y lectura pública de `kapi_server`: HTTP 403. Las reglas activas se cotejaron con las del repositorio antes y después del despliegue.

## Corrección de scroll y navegación

Kapi permanece anclado al hacer scroll, también con el globo cerrado. La guía oculta su señalamiento mientras se desplaza un contenedor que mueve el destino, y recalcula una vez tras 180 ms sin desplazamiento. El scroll interno de la conversación y los carruseles ajenos no provocan recolocación. Se retiró `flushSync` del scroll y los eventos de visual viewport sin cambio de geometría no reinician animaciones.

El cálculo descarta coordenadas duplicadas tras ajustarlas al viewport y selecciona el mejor resultado sin ordenar todas las alternativas. Las mediciones de contenido se detienen en 64 elementos visibles y excluyen los slides fuera del ancho de pantalla. En una muestra de la portada, la mediana del cálculo pasó de 2,44 ms a 0,62 ms; es una medida del algoritmo, no de la velocidad total de la web.

La cabecera y barra móvil identifican sus controles con `data-kapi-guide`. El menú administrable usa IDs generados, por lo que las anclas se asignan por destino/tipo de menú. La guía de Tienda apunta al control de navegación, no a anuncios ni enlaces del pie. Regresiones de scroll y navegación: `scripts/test/kapiScroll.test.mjs` (cuatro casos); suite completa: 58 pruebas, incluidas la carga tardía de contenido, la aparición de scrollbar, la apertura/cierre de globos alrededor de un personaje fijo y las órdenes verticales.

Al recargar se conserva la conversación sin enfocar automáticamente el input. Después de la primera colocación, las mediciones de la misma conversación mantienen el personaje y el lado del globo; únicamente se ajustan a los límites de la ventana. Las guías siguen pudiendo acercarse a su destino. El lugar inicial deja espacio para WhatsApp y los cuidados.

Abrir/cerrar la conversación o los controles no invalida el anclaje de Kapi. El anclaje se mantiene dentro de la misma ruta, incluso al terminar una guía. El globo limita su altura al espacio disponible alrededor del personaje; en móvil las respuestas largas usan scroll y, con poco espacio, la presentación compacta conserva el campo de mensaje. Las guías y las caminatas solicitadas siguen moviendo al personaje.

El panel permite caminar en las cuatro direcciones. Arriba/abajo avanzan 180 px por pulsación, con los mismos límites de ventana, animación y velocidad que el movimiento horizontal. «Llamar a Kapi» toma ambas coordenadas del clic/toque; el personaje camina hasta allí. Las órdenes independientes «sube», «baja», «más arriba» y «más abajo» se resuelven en el navegador sin consumir IA; las preguntas de productos o precios siguen pasando al asistente.

El componente original de cuidados (`components/marco/Kapi.jsx`) permanece montado junto al acompañante. Conserva el acceso por la cara de Walito, la alimentación, felicidad, monedas, retos y restricciones de sesión existentes. Al abrir su ventana se suspende visualmente el acompañante sin borrar la conversación; al cerrarla vuelve. Validación local de la apertura/cierre y presencia del botón de alimentación usando el modo diseño; sin ejecutar una alimentación ni modificar monedas de ninguna cuenta.
