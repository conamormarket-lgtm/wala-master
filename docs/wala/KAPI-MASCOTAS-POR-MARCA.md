# Mascotas por marca

La conversación de Walá tiene un anfitrión general (Kapi) y especialistas configurados en **Administración → Marcas → Editar marca → Mascota de la marca**. Lumi incluye por defecto a Lumita, su cuyita. El nombre, saludo, especialidad, orientación, color, catálogo permitido y activación por tema o página se pueden editar ahí.

## Comportamiento

- El servidor elige el personaje por el significado del mensaje, la conversación reciente y la ficha o marca actual. No mantiene una lista manual de sinónimos.
- Un cambio claro de tema puede devolver la conversación a Kapi. Las respuestas breves, presupuestos y agradecimientos mantienen al especialista actual.
- El personaje saliente presenta al entrante, sale caminando y el siguiente entra y saluda. El cliente precarga el arte antes de la salida. Con movimiento reducido, omite el recorrido.
- Se conserva la sesión cifrada, el presupuesto registrado, las preferencias del historial y los productos vistos. La pestaña conserva el último intercambio visible y la identidad al recargar. El token mantiene su vigencia existente de una hora.
- Entrar a una página de marca habilitada activa su mascota. El globo pequeño presenta a la especialista; tocarla abre la conversación conservada. Las guías y posiciones usan el mismo mecanismo que Kapi.
- La cuyita consulta solo productos de Lumi por defecto. El administrador puede autorizar todo el catálogo. Esta restricción se aplica en el servidor a búsqueda, consulta directa, comparación y lectura final de los productos.
- La orientación cosmética se limita a las fichas disponibles: sin inventar ingredientes, diagnosticar ni prometer resultados. Una posible reacción adversa no se convierte en una recomendación de compra.

## Configuración y animaciones

Los datos se guardan en `tienda_brands/{id}.companion`. Solo administradores pueden modificarlos mediante las reglas existentes. Los documentos de marcas son públicos: **no colocar claves ni información confidencial en esta configuración**. El endpoint público `GET /__kapi/companions` omite el campo de orientación interna y no llama a OpenAI.

Lumi se reconoce por el nombre o slug normalizado `lumi`, sin migración de datos. Guardar `enabled: false` desactiva también ese valor por defecto. Las demás marcas necesitan una configuración explícita. Para un personaje propio se requieren imagen estática y seis animaciones GIF/WebP; opcionalmente se puede subir una pose estática señalando. Se conservan los archivos animados originales al subirlos, sin recortarlos.

El primer paquete de Lumi está en `public/assets/companions/lumi-v1/`: reposo, caminar, saludar, hablar, pensar y señalar, todos transparentes. Las otras reacciones reutilizan estos seis gestos; todavía no tienen animaciones propias de Lumi. Kapi conserva su paquete anterior completo.

Los atlas se generaron con ImageGen usando la referencia proporcionada y fondo transparente. `scripts/assets/build-lumi-companion.cjs` empaqueta los atlas locales de `output/imagegen/lumi-cuyita-v1/`, interpola poses con flujo óptico y exporta WebP y PNG. Los atlas y los prompts originales permanecen en esa carpeta local, excluida de Git. El empaquetado opcional requiere `sharp` y `@techstark/opencv-js`; `KAPI_ANIMATION_TOOLS` permite señalar su directorio de módulos.

## Separación de despliegues

El navegador importa únicamente módulos bajo `src/`. La configuración pura tiene una copia idéntica en `src/components/kapi-local/companionProfiles.mjs` y `functions/kapi/companionProfiles.mjs`; una prueba verifica su igualdad. El enrutamiento semántico y la clave permanecen en Functions. Esto permite mantener `functions/` excluido de Vercel.

Cada mensaje con más de un perfil disponible agrega una llamada corta de selección de personaje. Cuenta en el mismo límite de 200 llamadas diarias; la función no crea un presupuesto adicional ni una nueva clave. Los perfiles del catálogo tienen caché de 60 segundos.

Publicar primero la interfaz y los assets, y después desplegar únicamente `functions:kapiAssistant` al proyecto `sistema-gestion-3b225`. No se requieren cambios de reglas ni de secretos. Comprobar en `https://www.wala.pe`: skincare → Lumi, presupuesto en el siguiente mensaje, producto en la misma pestaña, vuelta a un regalo → Kapi, recarga, página de Lumi y móvil.
