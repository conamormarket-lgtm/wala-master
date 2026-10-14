"use strict";

const { precioDeCatalogo } = require("./catalogPricing");

// Prendas del apartado "Crear" (esPrendaBase): a diferencia del resto de
// personalizados, su precio SÍ se puede reconstruir aquí. Es el de catálogo,
// que ya incluye los diseños en las zonas que el cliente quiera (precio único,
// como src/utils/prendaBase.js precioPersonalizado). Un costo por zona que haya
// quedado guardado de antes NO se suma: el navegador ya no lo cobra y el
// cliente vería "el precio cambió" en cada compra.
function precioDePrendaPersonalizada(product) {
  return precioDeCatalogo(product);
}

const redondear = (n) => Math.round(n * 100) / 100;

// Combos de Crear (esComboCrear): "Pareja", "Trío"... Un combo es un doc de
// productos_wala con su precio de paquete y sus piezas (comboCrear.piezas,
// una prenda de Crear cada una). En el pedido llega como una línea por pieza
// (así el ERP recibe los archivos de impresión y la prenda de cada una) con
// comboCrear: { comboId, grupo, pieza, de }. El precio de las piezas de un
// mismo grupo suma el del combo; cada pieza sigue consumiendo el stock de su
// prenda. El combo está oculto de la tienda (visible: false): se vende solo si
// comboCrear.publicado.
function gruposDeCombo(items) {
  const grupos = new Map();
  for (const item of items) {
    const combo = item && item.comboCrear;
    if (!combo || typeof combo !== "object") continue;
    const comboId = String(combo.comboId || "").trim();
    const clave = `${comboId}__${String(combo.grupo ?? "")}`;
    if (!grupos.has(clave)) grupos.set(clave, { comboId, nombre: item.combo || comboId, piezas: [] });
    grupos.get(clave).piezas.push(item);
  }
  return [...grupos.values()];
}

async function validarCombos(grupos, { db, reader, HttpsError }) {
  let subtotal = 0;
  if (!grupos.length) return subtotal;
  const ids = [...new Set(grupos.map((g) => g.comboId).filter(Boolean))];
  const snapshots = ids.length
    ? await reader.getAll(...ids.map((id) => db.collection("productos_wala").doc(id)), {
      fieldMask: ["price", "salePrice", "deleted", "esComboCrear", "comboCrear"],
    })
    : [];
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  for (const grupo of grupos) {
    const snapshot = byId.get(grupo.comboId);
    const combo = snapshot && snapshot.exists ? snapshot.data() || {} : null;
    const nombre = grupo.nombre;
    if (!combo || combo.esComboCrear !== true || combo.deleted === true || !combo.comboCrear || combo.comboCrear.publicado !== true) {
      throw new HttpsError("failed-precondition", `"${nombre}" ya no está disponible. Actualiza tu carrito.`);
    }
    const esperadas = Array.isArray(combo.comboCrear.piezas) ? combo.comboCrear.piezas : [];
    const piezas = [...grupo.piezas].sort((a, b) => Number(a.comboCrear.pieza) - Number(b.comboCrear.pieza));
    const cantidad = Math.max(1, Number(piezas[0].cantidad) || 1);
    const coinciden = piezas.length === esperadas.length
      && piezas.every((p, i) => String(p.productoId || "").trim() === String(esperadas[i] && esperadas[i].prendaId)
        && Number(p.comboCrear.pieza) === i
        && Math.max(1, Number(p.cantidad) || 1) === cantidad);
    if (!coinciden) {
      throw new HttpsError("failed-precondition", `"${nombre}" cambió. Vuelve a armarlo y agrégalo al carrito.`);
    }
    const price = precioDeCatalogo(combo);
    const precioCliente = piezas.reduce((total, p) => total + (Number(p.precio) || 0), 0);
    if (price === null) {
      throw new HttpsError("failed-precondition", `"${nombre}" ya no está disponible. Actualiza tu carrito.`);
    }
    if (Math.abs(price - precioCliente) > 0.01) {
      throw new HttpsError("failed-precondition",
        `El precio de "${nombre}" cambió a S/ ${price.toFixed(2)}. Vuelve a agregarlo al carrito.`);
    }
    subtotal += price * cantidad;
  }
  return subtotal;
}

// Una lectura por producto distinto, dentro de la transacción si se proporciona.
// El stock pertenece al producto: varias líneas/variantes consumen el mismo saldo.
//
// Devuelve { subtotal }: lo que valen los productos según el servidor. Con él
// prepareCheckoutPayment comprueba el TOTAL que se va a cobrar; antes solo se
// miraba el precio de cada línea y el total lo ponía el navegador.
//   - catálogo y prendas de Crear: el precio que calcula el servidor.
//   - otros personalizados: el que manda el cliente (el diseño se cobra aparte
//     y aquí no se puede reconstruir), pero nunca por debajo del de catálogo.
//   - líneas sin producto: solo pueden sumar (nunca precio negativo).
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
    let subtotal = 0;
    const sumar = (item, precio) => {
      const cantidad = Math.max(1, Number(item.cantidad) || 1);
      subtotal += Math.max(0, Number(precio) || 0) * cantidad;
    };
    for (const item of items) {
      if (item && !item.comboCrear && !String(item.productoId || "").trim()) sumar(item, item.precio);
    }
    if (!ids.length) {
      // Una pieza de combo siempre trae su prenda: sin ella no hay combo que cobrar.
      if (items.some((item) => item && item.comboCrear)) {
        throw new HttpsError("failed-precondition", "Tu combo está incompleto. Vuelve a armarlo.");
      }
      return { subtotal: redondear(subtotal) };
    }
    const refs = ids.map((id) => db.collection("productos_wala").doc(id));
    const reader = transaction || db;
    const snapshots = await reader.getAll(...refs, {
      fieldMask: ["price", "salePrice", "inStock", "visible", "deleted", "esPrendaBase", "prendaBase"],
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
      // Las piezas de un combo se cobran juntas, al precio del combo (abajo).
      if (item.comboCrear) continue;
      const clientPrice = Number(item.precio);
      if (item.personalizado && product.esPrendaBase === true) {
        const price = precioDePrendaPersonalizada(product);
        if (price !== null && Number.isFinite(clientPrice) && Math.abs(price - clientPrice) > 0.01) {
          throw new HttpsError("failed-precondition",
            `El precio de "${nombre}" cambió a S/ ${price.toFixed(2)}. Vuelve a agregarlo al carrito.`);
        }
        sumar(item, price !== null ? price : clientPrice);
      } else if (!item.personalizado) {
        const price = precioDeCatalogo(product);
        if (price !== null && Number.isFinite(clientPrice) && Math.abs(price - clientPrice) > 0.01) {
          throw new HttpsError("failed-precondition",
            `El precio de "${nombre}" cambió a S/ ${price.toFixed(2)}. Actualiza tu carrito.`);
        }
        sumar(item, price !== null ? price : clientPrice);
      } else {
        const price = precioDeCatalogo(product);
        sumar(item, Math.max(Number.isFinite(clientPrice) ? clientPrice : 0, price || 0));
      }
    }
    subtotal += await validarCombos(gruposDeCombo(items), { db, reader, HttpsError });
    return { subtotal: redondear(subtotal) };
  };
}

module.exports = { createCartValidator };
