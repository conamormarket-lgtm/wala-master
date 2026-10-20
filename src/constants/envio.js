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
 *
 * 2026-10-20: el envío gratis pasó de S/ 100 a S/ 200. El servidor sigue en
 * 100 a propósito hasta que la app de Android con 200 (1.3.24) esté en la
 * Play Store: la 1.3.23 lleva la web adentro con 100 y, con el servidor en
 * 200, sus pedidos de S/ 100-200 se rechazarían (cobra sin envío y el
 * servidor espera S/ 15 más). Con el servidor en 100, cobrar el envío nunca
 * se rechaza: solo se rechazan totales por DEBAJO de lo esperado.
 */
export const ENVIO_ESTANDAR = 15;
export const ENVIO_GRATIS_DESDE = 200;

/** Coste de envío para un subtotal de productos dado. */
export const costoEnvio = (subtotalProductos) =>
  (Number(subtotalProductos) || 0) > ENVIO_GRATIS_DESDE ? 0 : ENVIO_ESTANDAR;
