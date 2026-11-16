# Kapi: prueba local de interacción

Abrir `http://127.0.0.1:3000/?kapiDemo=1` después de `npm run dev -- --host 127.0.0.1 --port 3000`.
Solo se activa con Vite en desarrollo y loopback, con el parámetro explícito. La activación dura en esa pestaña y acompaña la navegación por inicio, tienda, personalizar, carrito, minijuegos y fichas; no se activa en administración, cuentas ni checkout. `?kapiDemo=0` la desactiva. El código se versiona como prototipo local; no activa la mascota de IA en producción.

El checkout incluye `output/kapi-local/manifest.json` y los 41 archivos de animaciones y poses que utiliza. No hace falta generar imágenes para ejecutar la demo. Configura `OPENAI_API_KEY` en `.wala-kapi.env` dentro del directorio personal del sistema, fuera del checkout. No se incluye ninguna clave. Las capturas y JSON de verificación v9/v10 son evidencia de consultas de prueba a fichas públicas; los builds y los borradores gráficos quedan fuera del commit.

## Interacción actual

| Acción | Resultado |
|---|---|
| Entrar | Kapi saluda con un mensaje breve; el aviso inicial se recoge después de siete segundos de inactividad. |
| Tocar a Kapi | Abre la conversación con texto, accesos rápidos y recorrido. Volver a tocarlo la cierra. |
| Pedir un acceso | Camina, levanta la mano y mantiene la pose de señalar mientras explica en el globo. El globo se oculta mientras camina. |
| Abrir “Controles de Kapi” | Panel independiente con velocidad, pausa, llamada, ocultación y los 20 gestos. |
| Elegir un gesto | Se cierra el panel para ver la animación y su mensaje. |
| Cerrar el mensaje / Escape | Recoge el globo y Kapi vuelve de inmediato a reposo en su posición. Escape en controles solo cierra el panel y devuelve el foco. |
| Cambiar tamaño o desplazar la página | Recalcula la posición; un desplazamiento que invalide el recorrido interrumpe la caminata. |
| Tocar una tarjeta de producto | Abre `/producto/:id?kapiDemo=1` en la misma pestaña. Kapi continúa montado y recoge la conversación en un aviso breve para dejar ver la ficha. |
| “Explícame este producto” | Usa el ID de la ruta actual, verificado en el servidor, conservando gustos y presupuesto de la conversación. |
| Pedir código u otros temas ajenos | Redirige a productos y ayuda con Walá; no muestra scripts ni bloques de Markdown. |

La conversación usa OpenAI Responses (`gpt-6-luna`) desde el servidor local. Las guías y órdenes simples de animación siguen siendo locales. Kapi consulta el catálogo publicado en modo de solo lectura; no hace clic, compra ni escribe en Firebase por el usuario.

## Conversación con IA y catálogo (v5)

- La clave se lee exclusivamente en Node desde `C:\Users\YONELIA\.wala-kapi.env`, con la variable `OPENAI_API_KEY`. No se incluye en variables Vite ni en respuestas del servidor. Se trasladó fuera del checkout el archivo original `.wala-kapi.env.txt`; `.gitignore` cubre futuras copias accidentales. El middleware bloquea servir esos nombres por HTTP, también codificados.
- El servidor de desarrollo incorpora `/__kapi/health`, `/__kapi/chat` y GET `/__kapi/product/:id`. Acepta solo clientes de loopback y solicitudes del mismo origen; el POST requiere JSON y una cabecera propia. El plugin no expone endpoints en preview ni producción.
- El catálogo de `sistema-gestion-3b225` se consulta mediante Firestore REST público, sin credenciales administrativas. No cambia el entorno de Firebase del resto de la página, que conserva sus emuladores. La portada puede seguir mostrando un catálogo vacío mientras Kapi consulta los productos reales.
- Se leen campos públicos seleccionados de `productos_wala` y nombres de sus taxonomías. Caché en memoria de cinco minutos, una carga compartida, máximo 800 productos y 200 documentos por taxonomía. Si se supera el límite de productos, el resultado se marca parcial. Durante la prueba se encontraron 205 productos publicados.
- Visibilidad y precio reutilizan `esProductoDeTienda` y `precioDeCatalogo`. No se recomiendan ocultos, borrados, reemplazados ni agotados. Un dato de stock ausente se comunica como no confirmado. Tallas y colores listados no garantizan inventario por variante.
- Las herramientas de IA son `search_catalog`, `get_product` y `compare_products`. La búsqueda por significado usa embeddings y revisión de relevancia (v9, abajo). Se vuelven a consultar las fichas candidatas antes de recomendar y antes de mostrarlas. Las tarjetas imprimen precio/foto desde los datos verificados; el modelo no genera enlaces ni HTML. Solo se aceptan IDs obtenidos por herramientas y gestos/destinos de una lista cerrada.
- Las recomendaciones muestran hasta tres tarjetas con “Ver detalles”. Toda la tarjeta abre una ficha local en la misma pestaña con React Router; no consume otra consulta de IA. La ficha DEV muestra foto, precio, descripción y variantes del DTO público, sin habilitar compras ni cambiar los emuladores del resto del sitio. También permite consultar productos personalizables, sin abrir el editor de producción.
- Kapi permanece montado entre rutas y conserva el ID de sesión y el último intercambio en `sessionStorage` de esa pestaña, con caducidad de una hora, para restaurarlos al recargar. El servidor mantiene los últimos doce mensajes durante una hora de inactividad; reiniciar el servidor pierde esa memoria. “Nueva” inicia otra conversación. Se usa `store:false` en OpenAI; esto no equivale a una garantía de cero retención del proveedor.
- El cliente envía solo `currentProductId`, derivado de la ruta; el servidor vuelve a leer el producto publicado y añade contexto verificado para esa petición. No confía en descripciones o precios enviados por el navegador y no arrastra el contexto de una ficha anterior. El globo ofrece “Explícame este producto”.
- El ámbito de Kapi incluye productos, regalos, navegación y conversación social breve. Las solicitudes explícitas de scripts se redirigen localmente, sin gastar tokens. Otras solicitudes ajenas se clasifican mediante `in_scope`; la respuesta estructurada y un filtro de salida evitan mostrar código en el globo. El texto se solicita sin Markdown y se normalizan énfasis simples. Es una barrera de producto, no una garantía de clasificación perfecta ante cualquier mensaje.
- Mientras consulta, Kapi piensa. Al responder reproduce el gesto elegido. Cerrar el globo, usar Escape, ocultarlo o iniciar una guía cancela la solicitud y evita que una respuesta tardía vuelva a abrirlo. Las guías conservan la pose de señalar hasta el cierre. “Camina”, “saluda”, “duerme”, “despierta”, “siéntate”, “aplaude” y “celebra” se ejecutan sin llamar al modelo.
- Límite local: una consulta simultánea, doce mensajes por minuto y 200 llamadas a OpenAI por día UTC, incluidos embeddings y revisión de relevancia. El contador se guarda fuera del repo en `.wala-kapi-usage.json`. Cada turno admite hasta tres llamadas de conversación (1000 tokens de salida cada una) y dos búsquedas. Cada búsqueda usa como máximo una revisión (1600 tokens) y un embedding de la consulta; el índice procesa solo fichas nuevas/modificadas en lotes de 64, hasta 800 fichas. No se reintentan automáticamente errores del proveedor. Es un límite de solicitudes, no una garantía de gasto monetario.
- El globo mantiene su tamaño acotado con desplazamiento interno para las tarjetas; el campo de mensaje y el cierre permanecen separados del área desplazable. Los controles de animación siguen en su panel independiente, donde se muestra el consumo de tokens de la última respuesta.

Pruebas: `node --test scripts/test/kapiLocal.test.mjs src/components/kapi-local/model.test.mjs` (24 correctas). Cubren también un aumento de precio entre la selección del modelo y la última lectura: una recomendación que sale del presupuesto se retira. Una solicitud real de conexión respondió con 22 tokens. Se comprobaron recomendaciones reales de Naruto, reconocimiento de falta de coincidencias bajo S/80, seguimiento de talla M y regalos por menos de S/50. No se publicaron cambios ni se modificó el catálogo.

Validación visual de v5: conversación y tarjetas en 1440×900, 390×844, 320×640 y ventana baja de 390×380. Campo de mensaje y cierre accesibles en los tamaños medidos. Guía del buscador sin intersección del actor/globo con el objetivo en escritorio y móvil, con pose sostenida. Cierre de una consulta pendiente: 40 observaciones durante diez segundos, todas con globo cerrado y reposo. Evidencias en `output/kapi-local/desktop-ai-v5.jpg`, `mobile-ai-v5.jpg` y `verification-ai-v5.json`.

Compilación de preview correcta; sin endpoints, componente ni media de la demo en el paquete generado. Revisión de 658 archivos de código/compilación sin la clave privada. ESLint no pudo ejecutarse porque su paquete no está instalado en el `node_modules` existente.

## Navegación y contexto de producto (v7)

27 pruebas correctas con el mismo comando anterior: contexto actual verificado, cambio de ficha sin datos anteriores, rechazo de IDs inválidos, redirección de scripts sin API, filtrado de respuestas ajenas/código, restauración y caducidad de sesión, activación entre rutas. Compilación de preview correcta.

Comprobado en navegador: tarjeta de la espada LED hacia su ficha local en la misma pestaña, recuerdo del presupuesto de S/50 tras navegar, explicación con datos de esa ficha, restauración al recargar y continuidad al volver a inicio sin query y usar Atrás. “y el script?” y una tarea de historia se redirigieron a Walá. El botón de explicar funciona desde la ficha y desde el globo.

En escritorio se reserva una columna para la conversación abierta. En móvil de al menos 640px de alto se reserva una zona inferior para el globo y Kapi; la ficha se desplaza en la zona superior, sin superposición. Al cerrar, vuelve la lectura de página completa. El pie no invade la ficha larga. Verificaciones en 1440×900, 1024×768, 390×844 y 320×640. Evidencias: `product-context-desktop-v7.jpg`, `product-context-mobile-v7.jpg`, `scope-guard-v7.jpg` y `verification-product-context-v7.json`, bajo `output/kapi-local/`.

## Búsqueda por significado (v9)

Sustituye la equivalencia manual de la espada de v8. No hay diccionario de sinónimos por producto en la búsqueda local.

1. Kapi convierte la conversación en una solicitud completa en lenguaje natural, conservando atributos, exclusiones, gustos y presupuesto.
2. `text-embedding-3-small`, con 512 dimensiones, relaciona esa solicitud con las fichas públicas. El índice cubre el catálogo consultado (hasta 800 productos) y usa nombres, descripción, taxonomías y variantes; no envía imágenes ni datos administrativos. Recupera hasta 16 candidatos por similitud y hasta 8 por coincidencia literal complementaria.
3. El servidor vuelve a leer esos candidatos y aplica precio/disponibilidad. Una revisión con el modelo de conversación selecciona hasta ocho coincidencias o pide aclaración, con un fragmento literal de evidencia por cada ID. El servidor rechaza IDs ajenos y citas inventadas. La similitud por sí sola no produce tarjetas.
4. Kapi elige hasta tres opciones de los resultados verificados. Antes de mostrarlas se vuelven a comprobar precio, disponibilidad y cambios en el contenido de la ficha.

El índice persiste fuera del checkout en `C:\Users\YONELIA\.wala-kapi-search-index.json`. Contiene hashes y vectores de fichas públicas, sin clave ni conversaciones; la huella excluye precio/stock, que se consultan de nuevo. Se reutilizan fichas sin cambios y se retiran las eliminadas del snapshot. Caché de consultas solo en memoria: hasta 100, durante cinco minutos. La caché persistida se invalida por modelo/dimensiones/versión. Una búsqueda solo por presupuesto conserva el recorrido sin embeddings adicionales.

No se modifican productos, políticas, el recomendador compartido ni la integración de producción. No se relajan intencionalmente requisitos cuando falta una coincidencia. La revisión de significado sigue siendo una decisión del modelo: no garantiza comprender cualquier formulación ni atributos ausentes de la ficha. El catálogo se refresca cada cinco minutos y mantiene el indicador de lectura parcial.

Pruebas: `node --test scripts/test/kapiLocal.test.mjs scripts/test/kapiSemanticSearch.test.mjs src/components/kapi-local/model.test.mjs` (35 correctas). Cubren candidatos sin palabras comunes, índice incremental/persistente, caducidad, presupuesto/stock antes y después de leer, ambigüedad, evidencia, vectores inválidos, cancelación y cobro de todas las llamadas al proveedor.

Consultas reales verificadas: espada voladora; juguete en forma de espada que se mantenga en el aire; periféricos sin cables; calcar dibujos con una luz; referencia al ninja rubio de la aldea de la hoja. Se rechazaron coincidencias para espada sin luces y presupuesto máximo de S/10. Evidencia en `output/kapi-local/verification-semantic-v9.json`. Primera consulta, incluyendo el índice: 14,7 s y 31.576 tokens de embeddings; siguientes consultas de la muestra: 3,7–9,3 s y 0–32 tokens de embeddings. Son observaciones locales, no garantías de latencia ni estimaciones de precio.

Seguimiento real verificado: espada hasta S/50 y después “pero la quiero sin luces” conservó producto y presupuesto y devolvió cero tarjetas; tampoco se ofreció la espada al pedir cámara 4K y GPS. Diez consultas reales correctas entre ambas series; evidencia adicional en `output/kapi-local/verification-semantic-followup-v9.json`. Build de preview correcto y sin el buscador semántico en los archivos del cliente.

Referencias de implementación: [API de embeddings](https://developers.openai.com/api/reference/resources/embeddings/methods/create) y [guía de búsqueda con embeddings](https://developers.openai.com/api/docs/guides/embeddings).

## Comparaciones conversacionales (v10)

El botón «Comparar opciones» aparece después de mostrar dos o tres productos. También se puede preguntar «¿cuál me conviene?», «¿vale pagar más?» o cambiar el presupuesto o el uso por texto. Se mantienen los globos y los mismos assets de animación.

- `compare_products` consulta juntas entre dos y tres fichas ya mostradas o consultadas en el turno. La sesión recuerda hasta 30 IDs y el último presupuesto usado por búsqueda/comparación; un valor nulo reutiliza ese límite y `clear_budget` permite retirarlo cuando la persona lo solicita. El modelo interpreta las preferencias desde la conversación existente.
- `comparison.mjs` calcula en céntimos los importes, diferencia de precios, total y exceso sobre el presupuesto. La IA redacta la ventaja y el aspecto a considerar de cada opción. No puede devolver filas inventadas ni elegir como ganadora una opción agotada, sin precio o que supera el presupuesto comprobado.
- Una diferencia estética no equivale a mayor calidad. Si faltan preferencias o hay empate relevante, puede no haber ganadora. La redacción sigue dependiendo del modelo: los controles deterministas verifican IDs, precio y disponibilidad, no garantizan la exactitud de toda explicación generada.
- Las tarjetas destacan «La elegiría para ti», muestran motivos y señalan las alternativas fuera del presupuesto. Esas alternativas pueden aparecer para compararlas, pero no como ganadoras. Al cambiar precios, disponibilidad o características entre la consulta y la última lectura se retira la conclusión y se informa del cambio.
- El resumen y las tarjetas se desplazan dentro del globo; cierre e input quedan accesibles. Al mostrar una comparación se retiran los botones repetidos de comparar/explicar para liberar espacio. Las tarjetas conservan contraste al pasar el cursor.
- La comparación se guarda con el último intercambio de la pestaña, se restaura al recargar y permanece al navegar a la ficha en la misma pestaña. La ficha actual también puede aparecer entre las opciones comparadas.

Validación automatizada: `node --test scripts/test/kapiLocal.test.mjs scripts/test/kapiSemanticSearch.test.mjs scripts/test/kapiComparison.test.mjs src/components/kapi-local/model.test.mjs`: 42 pruebas correctas. Incluyen empate, céntimos, presupuesto recordado/retirado, selección inválida, relectura de tres fichas, cambio de precio y producto borrado. Build de preview correcto; la demo continúa excluida de producción.

Verificación real: comparación de tres casacas de igual precio, cambio de presupuesto que deja todas fuera y empate sin gustos de diseño. Por interfaz, comparación de proyector de dibujo y tina de juguete: recuerda S/50, calcula S/3.60 de diferencia y elige el proyector al saber que a la persona le gusta dibujar. Se comprobó restauración tras recarga, navegación a la ficha y regreso a reposo al cerrar. Verificación visual en 1440×900, 390×844, 320×640 y ventana baja de 390×380: sin desbordamiento horizontal, con input y cierre visibles. En los móviles de al menos 640 px de alto, la ficha permanece en su área superior separada del globo. Las explicaciones usan todo el ancho de la tarjeta, debajo de su cabecera con foto. Evidencias en `output/kapi-local/verification-comparison-v10.json`, `verification-comparison-tie-v10.json`, `verification-comparison-ui-v10.json`, `comparison-desktop-v10.jpg` y `comparison-mobile-v10.jpg`.

## Lumi: propuesta pendiente, sin activar

Alcance acordado: solo definir la idea de Lumi. Esta entrega no cambia su página, no activa Kapi en `/lumi` y no crea una mascota nueva.

La tienda ya distingue marcas mediante `tienda_brands`, `productos_wala.brandId` y la página publicada de cada marca. Lumi tiene slug `lumi` y un catálogo de cuidado de la piel. Es posible reutilizar el motor de conversación con un perfil por marca, sin crear una integración de IA distinta para cada personaje.

Propuesta de perfil:

1. **Identidad:** nombre, ilustraciones, animaciones, saludo y tono propios. Al entrar en Lumi, presentar una asesora de compras cercana; al salir, volver a Kapi. El diseño y nombre del personaje quedan pendientes.
2. **Contexto:** el servidor verifica la marca y limita búsqueda, detalles y comparaciones a su catálogo. No basta cambiar el texto del prompt. El perfil debe mantenerse al abrir una ficha de esa marca y distinguir cuando el usuario regresa a Walá general.
3. **Conversación:** preguntar una cosa a la vez sobre lo que busca, preferencias, productos que ya usa para evitar duplicados y presupuesto total. No reiniciar un cuestionario si ya se conocen esos datos; explicar el cambio de contexto sin arrastrar automáticamente un presupuesto de otro regalo o compra.
4. **Propuesta de compra:** ofrecer una selección breve, separar lo prioritario de lo opcional y sumar el conjunto desde el servidor. Poder decir «con lo que ya tienes, no necesitas añadir otro producto» y comparar antes de decidir. Si faltan datos relevantes de la ficha, reconocerlo.
5. **Acciones y reacciones:** abrir fichas, comparar, explicar el producto visible y señalar controles sin taparlos. Pensar mientras consulta, asentir al entender preferencias y señalar al explicar. Hablar al tocarla o al solicitar ayuda; una bienvenida breve no debe abrir sola una conversación larga.
6. **Límites de la asesoría:** orientación de compra basada en información publicada, sin diagnosticar, prometer resultados ni inventar compatibilidades o indicaciones clínicas. La persona decide qué comprar; agregar al carrito sería una etapa posterior solicitada explícitamente desde la interfaz.

Ejemplo de inicio:

> Persona: «Tengo S/150 y quiero empezar, pero ya tengo una hidratante».
>
> Asesora: «Tomemos en cuenta la que ya tienes para no repetir. ¿Qué te gustaría encontrar o mejorar en tu rutina?»
>
> Persona: «Busco una opción ligera y sencilla».
>
> Asesora: consulta las fichas y, cuando haya datos suficientes, compara opciones con motivos concretos, coste del conjunto y elementos opcionales. No asigna necesidades ni resultados antes de conocer el contexto.

Para implementar esta etapa faltaría definir personaje/tono, revisar la información disponible para asesorar y acordar cuándo ofrecer una selección de varios productos. El cambio de perfil y el filtro por marca requerirían pruebas propias antes de activarse.

## Espacio y posición

- Globo breve de hasta 224 px; se estrecha más en 320 px para poder colocarse junto al personaje.
- Conversación de hasta 300 px, únicamente al solicitarla. Con poco alto visible conserva cierre, respuesta y campo de texto; oculta los accesos secundarios y permite desplazar la respuesta larga.
- Personaje más pequeño en móvil, sin alterar las proporciones de los assets.
- Se evalúan juntos los rectángulos del cuerpo y del globo. El elemento señalado tiene una separación obligatoria de 12 px; también se reserva el espacio del menú inferior.
- Al señalar, se busca el espacio libre más cercano al objetivo, alineando la mano con el control cuando cabe a un lado. La posición anterior solo desempata opciones próximas; ya no se prioriza una esquina.
- Durante la explicación, títulos, párrafos, enlaces, botones y campos visibles son zonas protegidas para el cuerpo y el globo. Se incluyen encabezado, contenido y pie. Si no cabe la pareja sin cubrirlos, se recoge el globo; si tampoco cabe el cuerpo, se oculta temporalmente. En conversación o reposo se conserva la preferencia por espacios despejados.
- Kapi gira hacia el objetivo también después de un reajuste por scroll o tamaño. La colocación del globo y del personaje se resuelve conjuntamente antes de caminar, y esa misma posición se conserva al validar el destino.
- El globo puede ir encima, debajo o a un lado. Si no cabe sin obstruir el objetivo, se recoge. Si tampoco cabe el personaje, se oculta temporalmente.
- Se recalcula al desplazar, redimensionar o cambiar el tamaño del mensaje. El alto visible del navegador tiene en cuenta el teclado mediante VisualViewport.
- Los recorridos rodean tanto el elemento señalado como el contenido protegido cercano. Si no existe un recorrido libre o el punto de partida ya invade contenido, Kapi se recoloca brevemente oculto.
- La navegación guiada resalta el buscador, el acceso a Tienda, Crear o el carrito. Un objetivo fuera de pantalla no mantiene un globo flotando sin referencia.

## Animaciones y aislamiento

Se mantienen los 20 assets aprobados. Los derivados WebP de 224 px pesan 13.4 MB frente a 87.8 MB de los originales. Se conservan los tiempos y la transparencia. Solo cinco gestos se precargan; el resto llega al solicitarlo. Se respeta movimiento reducido y se usa una imagen estática al pausar.

Los originales y el preparador `output/kapi-local/prepare-assets.cjs` se conservan en la carpeta de trabajo donde se generaron, fuera de este commit. El repositorio incluye los derivados ya aprobados y su manifiesto. No están en `public/` ni entran en el paquete de producción. La demo sustituye al botón flotante habitual de Kapi mientras está activa.

La portada local usa emuladores por defecto. Sin ellos muestra contenido de respaldo y catálogo vacío. Esta prueba conserva esa configuración.

## Validación del ajuste

- Siete pruebas de Node: activación restringida, geometría en seis tamaños, ventana baja, falta de espacio, protección de título/botón en 320 px, rutas alrededor del objetivo y respuestas guionadas.
- Compilación Vite en modo preview correcta; componente y rutas de media de la demo ausentes del paquete generado.
- Navegador: los cuatro destinos en 390 × 844 y 1440 × 900, sin intersección de personaje ni globo con el objetivo.
- 320 × 640: carrito libre y preferencia por el espacio de la imagen del hero, dejando visibles título y botón de compra.
- 390 × 380: respuesta, cierre e input permanecen dentro del globo.
- Panel separado, selección de gesto y respuesta a “gracias Kapi” comprobados.
- Muestra de 261 cuadros durante el recorrido: ninguna intersección con el objetivo; el globo estuvo oculto en los 235 cuadros de caminata observados.
- Muestra de 261 cuadros durante desplazamiento de la página: ninguna intersección entre objetivo, personaje y globo.
- Comprobaciones locales de navegador; no equivalen a una prueba en teléfonos físicos.

Evidencias: `output/kapi-local/desktop-v2.jpg`, `mobile-v2.jpg`, `narrow-v2.jpg` y `verification-v2.json`.

## Validación de proximidad (v3)

- Once pruebas de Node correctas, incluyendo acercamiento desde ambas esquinas, elección del lado libre, contenido denso y recorrido que evita texto vecino.
- Los cuatro destinos comprobados en 1440 × 900, 390 × 844 y 320 × 640. Personaje y globo visibles, sin superposición con el objetivo ni con las zonas importantes medidas.
- Separaciones observadas entre el cuerpo y el objetivo: 16–18 px en escritorio; 16–86 px en móvil. Cuando hay texto o controles en el espacio inmediato, se conserva la separación adicional necesaria.
- Reajuste al cambiar de tamaño y al desplazar la página. Durante una guía, la nueva posición se confirma en el propio evento de scroll para evitar un fotograma con coordenadas anteriores.
- Compilación de preview correcta y demo excluida de los archivos de producción.
- Evidencias: `output/kapi-local/desktop-near-v3.jpg`, `mobile-near-v3.jpg`, `narrow-near-v3.jpg` y `verification-v3.json`.

## Gesto sostenido durante la explicación (v4)

- La guía reproduce los primeros 1120 ms del gesto aprobado (levantar el brazo) y conserva la pose final, sin pasar a hablar ni bajar el brazo por tiempo. Al cambiar de elemento repite la entrada del gesto al llegar al nuevo destino.
- Se reutiliza sin modificar el PNG aprobado `output/imagegen/kapi-senalar-v1/keyframes/kapi-08.png`, copiado a `assets/point-hold.png`. Conserva diseño, proporciones y transparencia. El preparador incluye esta copia y los metadatos `point.hold` y `point.holdAfter` para poder reproducir el resultado.
- Redimensionar, cambiar movimiento reducido, pausar o volver a la pestaña conserva la pose cuando sigue activa la explicación. Cerrar con X o Escape cancela la acción pendiente y restaura reposo; ya no inicia un paseo al cerrar.
- La animación completa de señalar continúa disponible como gesto de prueba en el panel independiente.
- Navegador: 60 observaciones durante 9.1 segundos con el globo abierto, todas con la pose sostenida y la misma imagen. Comprobados móvil, cambio de tamaño, movimiento reducido, cambio de paso del recorrido, cierre con X/Escape y cierre antes de terminar de levantar el brazo. El cierre anticipado permaneció en reposo y no reactivó el gesto pendiente.
- Las 11 pruebas existentes siguen correctas y la compilación de preview pasa. La prueba continúa restringida al entorno local.
- Evidencias: `output/kapi-local/point-hold-v4.jpg`, `mobile-point-hold-v4.jpg` y `verification-v4.json`.
