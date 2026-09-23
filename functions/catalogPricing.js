"use strict";

// Compartido por validación del checkout, cupones y creación de pedidos.
// null y los textos vacíos significan "sin oferta", no un precio de S/0.
function precioDeCatalogo(p) {
  const price = Number(p.price);
  const rawSalePrice = p.salePrice;
  const hasSalePrice = typeof rawSalePrice === "number"
    || (typeof rawSalePrice === "string" && rawSalePrice.trim() !== "");
  const salePrice = hasSalePrice ? Number(rawSalePrice) : NaN;
  if (Number.isFinite(salePrice) && salePrice < price) return salePrice;
  return Number.isFinite(price) ? price : null;
}

module.exports = { precioDeCatalogo };
