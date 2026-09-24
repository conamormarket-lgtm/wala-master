"use strict";

const { precioDeCatalogo } = require("./catalogPricing");

// Una lectura por producto distinto, dentro de la transacción si se proporciona.
// El stock pertenece al producto: varias líneas/variantes consumen el mismo saldo.
function createCartValidator({ db, HttpsError }) {
  return async function verificarPreciosYStock(productos, transaction) {
    const items = productos && typeof productos === "object" ? Object.values(productos) : [];
    const quantities = new Map();
    for (const item of items) {
      const id = String(item?.productoId || "").trim();
      if (!id) continue;
      const quantity = Math.max(1, Number(item.cantidad) || 1);
      quantities.set(id, (quantities.get(id) || 0) + quantity);
    }
    const ids = [...quantities.keys()];
    if (!ids.length) return;
    const refs = ids.map((id) => db.collection("productos_wala").doc(id));
    const reader = transaction || db;
    const snapshots = await reader.getAll(...refs, {
      fieldMask: ["price", "salePrice", "inStock", "visible", "deleted"],
    });
    const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));

    for (const item of items) {
      const id = String(item?.productoId || "").trim();
      if (!id) continue;
      const nombre = item.producto || id;
      const snapshot = byId.get(id);
      const product = snapshot?.exists ? snapshot.data() || {} : null;
      if (!product || product.deleted === true || product.visible === false) {
        throw new HttpsError("failed-precondition", `"${nombre}" ya no está disponible. Actualiza tu carrito.`);
      }
      const stock = Number(product.inStock);
      if (Number.isFinite(stock) && stock < quantities.get(id)) {
        throw new HttpsError("failed-precondition",
          `"${nombre}" ya no tiene stock suficiente (quedan ${Math.max(0, stock)}). Actualiza tu carrito.`);
      }
      if (!item.personalizado) {
        const price = precioDeCatalogo(product);
        const clientPrice = Number(item.precio);
        if (price !== null && Number.isFinite(clientPrice) && Math.abs(price - clientPrice) > 0.01) {
          throw new HttpsError("failed-precondition",
            `El precio de "${nombre}" cambió a S/ ${price.toFixed(2)}. Actualiza tu carrito.`);
        }
      }
    }
  };
}

module.exports = { createCartValidator };
