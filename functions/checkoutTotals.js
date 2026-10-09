"use strict";

// Cuánto se debe cobrar por un checkout, según el servidor. Espejo de la cuenta
// de CheckoutPage.jsx:
//   total = max(0, subtotal - monedas - cupón) + envío
// El envío se mide sobre el subtotal de los productos (src/constants/envio.js)
// y un cupón de envío gratis lo deja en cero. Las monedas tienen tope: la mitad
// del subtotal.
function totalEsperadoCheckout({
  subtotal, monedas = 0, descuentoCupon = 0, envioGratis = false,
  envioEstandar, envioGratisDesde,
}) {
  const sub = Math.max(0, Number(subtotal) || 0);
  const envio = envioGratis ? 0 : (sub > envioGratisDesde ? 0 : envioEstandar);
  const resto = Math.max(0, sub - Math.max(0, Number(monedas) || 0) - Math.max(0, Number(descuentoCupon) || 0));
  return { envio, total: Math.round((resto + envio) * 100) / 100 };
}

const topeMonedasCheckout = (subtotal) => Math.floor(Math.max(0, Number(subtotal) || 0) / 2);

// Margen para redondeos: cada línea de catálogo puede diferir en ±0,01 del
// precio del servidor (verificarPreciosYStock lo tolera).
const toleranciaCheckout = (unidades) => 0.05 + 0.01 * Math.max(0, Number(unidades) || 0);

module.exports = { totalEsperadoCheckout, topeMonedasCheckout, toleranciaCheckout };
