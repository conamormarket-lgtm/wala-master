# Compras por producto en Meta

Píxel: `1696511731424872`. El evento `Purchase` se envía desde el navegador
después de la confirmación de Culqi o de una captura completada de PayPal.

## Datos enviados

- `content_ids`: IDs de `productos_wala`, sin agregar talla/color al identificador.
- `contents`: lista de `{ id, quantity }`; variantes del mismo producto se agrupan.
- `content_type`: `product`.
- `content_name`: nombres de los productos.
- `num_items`: suma de las cantidades de los productos identificados.
- `order_id`: pedido confirmado por el servidor, o referencia del pedido local.
- `value` y `currency`: importe efectivamente cobrado y moneda de la pasarela.
- `eventID`: identificador estable del cobro para la protección contra repetidos.

Se usa el snapshot del pedido, no el carrito después de vaciarlo. Los combos
se identifican por su ID de catálogo; sus componentes de despacho no generan
compras adicionales. El checkout y las landings proporcionan los productos;
los pagos de saldo los incluyen cuando el pedido trae `productos`.
Los enlaces de pago genéricos sin productos conservan el evento de compra
general, sin inventar IDs a partir del concepto del pago.

No se envían datos del cliente, direcciones ni personalizaciones en estos
parámetros. La coincidencia avanzada automática de Meta es una configuración
independiente. Tampoco se envían precios unitarios: los precios de catálogo
están en PEN, PayPal cobra USD y el cobro puede incluir descuentos, envío o
solo un adelanto. No se modifica el importe del evento para que coincida con
la suma del catálogo.

Ejemplo: una unidad de `factos-polo-adicto-rosaditas` a S/45, con S/18 de monedas
y S/15 de envío, produce `value: 42`, `currency: 'PEN'`,
`content_ids: ['factos-polo-adicto-rosaditas']` y
`contents: [{ id: 'factos-polo-adicto-rosaditas', quantity: 1 }]`.

## Configurar el filtro en Meta

1. Publicar el frontend y comprobar una compra confirmada en **Probar eventos**
   y Meta Pixel Helper. Verificar IDs, cantidades, moneda e importe.
2. Crear una conversión personalizada con este píxel y el evento **Purchase**.
3. Filtrar por el parámetro **content_ids**, incluyendo cualquiera de los IDs
   elegidos para el grupo. No basar el filtro en visitar la página del producto.
4. Añadir esa conversión al informe de anuncios. Para usarla como objetivo de
   optimización, comprobar que Meta la habilite en la cuenta y campaña.

Un pedido con productos de dos grupos puede cumplir ambas reglas. Esto no
representa dos pedidos distintos. El valor sigue siendo el cobro completo;
no representa ingresos exclusivos del grupo. Si se usa un catálogo de Meta,
sus IDs deben coincidir con los enviados por la web.

El código no crea conversiones personalizadas en la cuenta de Meta ni añade
la API de conversiones. La entrega depende del navegador: encolar un evento
no demuestra que Meta lo recibió. Para pruebas locales sin enviar eventos
reales: `npm run test:meta-pixel`.
