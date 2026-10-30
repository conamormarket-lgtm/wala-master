"use strict";

// Compartido por validación del checkout, cupones y creación de pedidos.
// null, los textos vacíos y el 0 significan "sin oferta", no un precio de S/0:
// el admin guarda 0 cuando la oferta queda vacía (113 productos el
// 2026-10-30) y la tienda los muestra a precio normal (precioBase en
// src/utils/prendaBase.js). Contarlo como S/0 hacía fallar el pago con
// "el precio cambió a S/ 0.00".
function precioDeCatalogo(p) {
  const price = Number(p.price);
  const rawSalePrice = p.salePrice;
  const hasSalePrice = typeof rawSalePrice === "number"
    || (typeof rawSalePrice === "string" && rawSalePrice.trim() !== "");
  const salePrice = hasSalePrice ? Number(rawSalePrice) : NaN;
  if (Number.isFinite(salePrice) && salePrice > 0 && salePrice < price) return salePrice;
  return Number.isFinite(price) ? price : null;
}

module.exports = { precioDeCatalogo };
