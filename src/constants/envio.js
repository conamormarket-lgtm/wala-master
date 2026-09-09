/**
 * Regla de envío, en un solo sitio.
 *
 * Estaba duplicada a mano en el carrito y en el checkout, y se separaron: el
 * carrito medía el umbral sobre el subtotal y el checkout sobre el subtotal ya
 * rebajado por las monedas. Resultado: el carrito prometía "Gratis" y la
 * pantalla de pago cobraba S/15.
 *
 * El umbral se mide SIEMPRE sobre el subtotal de los productos. Las monedas y
 * los cupones son formas de pagar, no rebajan lo que se ha comprado; si lo
 * hicieran, gastar monedas podría salir más caro que no gastarlas.
 *
 * OJO: functions/index.js tiene sus propias constantes (ENVIO_ESTANDAR /
 * ENVIO_GRATIS_DESDE) para valorar el cupón de envío gratis en servidor. Si se
 * cambian estos números, hay que cambiarlos allí también y desplegar functions.
 */
export const ENVIO_ESTANDAR = 15;
export const ENVIO_GRATIS_DESDE = 100;

/** Coste de envío para un subtotal de productos dado. */
export const costoEnvio = (subtotalProductos) =>
  (Number(subtotalProductos) || 0) > ENVIO_GRATIS_DESDE ? 0 : ENVIO_ESTANDAR;
