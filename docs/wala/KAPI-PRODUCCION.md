# Kapi en la tienda publicada

Kapi acompaña en `/`, `/home`, `/tienda`, `/personalizar`, `/carrito` y `/producto/:id`. Conserva los globos, las 20 animaciones aprobadas, las guías que señalan elementos, la búsqueda semántica y la comparación según presupuesto. Las tarjetas abren la ficha real en la misma pestaña. Lumi sigue como propuesta, sin activar este asistente en su página.

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
