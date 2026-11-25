# Embudo de las landings de producto

En **Resultados → Resumen**, «De la landing al pago» usa el rango de fechas del panel y permite elegir todas las landings o un producto concreto.

- Entrada: ficha disponible en `/producto/:id/landing` una vez cargada.
- Carrito: vista de `/carrito?landing=:id`; agregar un producto no equivale a verla.
- Envío: formulario visible, sin contar esqueletos de carga ni carritos vacíos.
- Opciones de pago: paso 1 del checkout, después de preparar correctamente la compra.
- Selección: clic en tarjeta nueva o guardada, WhatsApp de una o varias marcas, o PayPal internacional. Se mide la intención incluso si la pasarela falla; no se presenta como pago confirmado.

`Comprar ahora` omite el carrito. El avance a envío se compara con las entradas; pago con envío y selección con opciones de pago. Las barras también muestran el porcentaje sobre visitantes de la landing. Cada persona puede aparecer en varios métodos, pero solo una vez en el total de quienes eligieron.

## Atribución y lectura

El evento `analytics_events.type = landing_funnel`, versión 1, guarda la landing, un identificador de recorrido, las fechas de los pasos alcanzados y el identificador anónimo ya usado por Walá. No guarda datos de envío ni de tarjetas. Solo una entrada real inicia el recorrido; escribir manualmente `?landing=` no crea una visita. No se hereda el origen en checkouts ordinarios. Se aplican los filtros existentes de entorno, administradores y bots.

El recorrido dura como máximo 24 horas y vive en `sessionStorage` por landing. Recargas y retrocesos no generan nuevos pasos. Las escrituras incluyen los pasos anteriores, permitiendo recuperar un paso cuyo envío falló si se registra el siguiente. Un fallo de analítica nunca bloquea la compra.

La agregación une primero el recorrido y luego cuenta identificadores anónimos únicos en todo el periodo; no suma únicos diarios. La fecha de entrada debe estar dentro del rango y el avance debe ocurrir hasta su final. Una persona en varios productos cuenta una vez en el total y una vez en cada producto. Es una aproximación por navegador, sin unión de dispositivos ni de navegación privada. Las entradas anteriores a la publicación no se reconstruyen.

La consulta usa el índice existente `type ASC, clientTsMs DESC` y las reglas existentes de analítica: ingesta anónima, lectura administrativa. No requiere nuevas funciones, reglas ni índices. Lee solo el tipo y periodo elegidos, con un máximo de 9 000 eventos y un documento adicional para detectar truncación, siempre por debajo del límite de 10 000 de producción. Si se supera, muestra un error para acortar el periodo en lugar de mostrar totales parciales. El panel cachea un minuto y admite actualización manual.

## Validación local

`npm run test:landing-funnel` cubre deduplicación, comprar ahora, navegación ordinaria, origen por producto, orden temporal, cruce de días, caducidad, fallos de escritura, exclusiones, consultas acotadas y errores de lectura. Las regresiones de `scripts/test/productLanding.test.mjs` y `scripts/test/checkoutGuest.test.mjs` verifican las rutas y el checkout invitado; `npm run test:analytics` verifica la analítica previa.

Compilar con las variables de pagos del entorno correspondiente (en este checkout, `npx vite build --mode real`). La medición real está desactivada en localhost; las pruebas usan destinos en memoria y no crean pedidos, cobros ni mensajes. Al publicar el frontend comienza el registro de visitantes reales.
