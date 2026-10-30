"use strict";

const { precioDeCatalogo } = require("./catalogPricing");
const { topeMonedasCheckout, pctMonedasDeMarca } = require("./checkoutTotals");

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
// comboCrear.publicado. Una pieza fija (`fija: true`, el reloj de un pack) es
// un producto de la tienda que va tal cual en el color del admin: llega sin
// diseño y en ese color.
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

function piezaFijaCoincide(item, esperada) {
  const color = String((esperada.color && esperada.color.nombre) || "").trim();
  return !item.personalizado && !String(item.designId || "").trim()
    && (!color || String(item.color || "").trim() === color);
}

async function validarCombos(grupos, { db, reader, HttpsError }) {
  const lineas = [];
  if (!grupos.length) return lineas;
  const ids = [...new Set(grupos.map((g) => g.comboId).filter(Boolean))];
  const snapshots = ids.length
    ? await reader.getAll(...ids.map((id) => db.collection("productos_wala").doc(id)), {
      fieldMask: ["price", "salePrice", "deleted", "esComboCrear", "comboCrear", "brandId"],
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
        && Math.max(1, Number(p.cantidad) || 1) === cantidad
        && (!esperadas[i].fija || piezaFijaCoincide(p, esperadas[i])));
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
    lineas.push({ importe: price * cantidad, brandId: combo.brandId || null });
  }
  return lineas;
}

// Una lectura por producto distinto, dentro de la transacción si se proporciona.
// El stock pertenece al producto: varias líneas/variantes consumen el mismo saldo.
//
// Devuelve { subtotal, topeMonedas }: lo que valen los productos según el
// servidor y cuántas monedas se pueden usar (el % de la marca de cada producto,
// ver checkoutTotals). Con ellos prepareCheckoutPayment comprueba el TOTAL que
// se va a cobrar; antes solo se miraba el precio de cada línea y el total lo
// ponía el navegador.
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
    const reader = transaction || db;
    // Cada línea con su marca: la marca la dice el producto, no el navegador.
    const lineas = [];
    const sumar = (item, precio, brandId = null) => {
      const cantidad = Math.max(1, Number(item.cantidad) || 1);
      lineas.push({ importe: Math.max(0, Number(precio) || 0) * cantidad, brandId });
    };
    // Lee el % de monedas de las marcas de las líneas y cierra la cuenta.
    const cerrar = async () => {
      const subtotal = lineas.reduce((tot, l) => tot + l.importe, 0);
      const marcaIds = [...new Set(lineas.map((l) => l.brandId).filter(Boolean))];
      const marcas = new Map();
      if (marcaIds.length) {
        const snaps = await reader.getAll(...marcaIds.map((id) => db.collection("tienda_brands").doc(id)), {
          fieldMask: ["topeMonedasPct"],
        });
        for (const snap of snaps) if (snap.exists) marcas.set(snap.id, snap.data() || {});
      }
      const topeMonedas = topeMonedasCheckout(lineas.map((l) => ({
        importe: l.importe, pct: pctMonedasDeMarca(l.brandId ? marcas.get(l.brandId) : null),
      })));
      return { subtotal: redondear(subtotal), topeMonedas };
    };
    for (const item of items) {
      if (item && !item.comboCrear && !String(item.productoId || "").trim()) sumar(item, item.precio);
    }
    if (!ids.length) {
      // Una pieza de combo siempre trae su prenda: sin ella no hay combo que cobrar.
      if (items.some((item) => item && item.comboCrear)) {
        throw new HttpsError("failed-precondition", "Tu combo está incompleto. Vuelve a armarlo.");
      }
      return { subtotal: redondear(lineas.reduce((tot, l) => tot + l.importe, 0)), topeMonedas: topeMonedasCheckout(lineas) };
    }
    const refs = ids.map((id) => db.collection("productos_wala").doc(id));
    const snapshots = await reader.getAll(...refs, {
      fieldMask: ["price", "salePrice", "inStock", "visible", "deleted", "esPrendaBase", "seVendeTalCual", "prendaBase", "brandId"],
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
      // Una prenda de Crear se vende solo diseñada (también cuando sale en la
      // tienda con "También en la tienda"): sin su creación es una prenda en
      // blanco que nadie pidió. Salvo que el admin la venda también tal cual
      // ("También se vende sin personalizar": la billetera de Yoryo).
      if (product.esPrendaBase === true && product.seVendeTalCual !== true && !item.personalizado && !String(item.designId || "").trim() && !item.vistasPersonalizadas) {
        throw new HttpsError("failed-precondition", `"${nombre}" se compra personalizado. Diséñalo en Crear y vuelve a agregarlo.`);
      }
      const clientPrice = Number(item.precio);
      if (item.personalizado && product.esPrendaBase === true) {
        const price = precioDePrendaPersonalizada(product);
        if (price !== null && Number.isFinite(clientPrice) && Math.abs(price - clientPrice) > 0.01) {
          throw new HttpsError("failed-precondition",
            `El precio de "${nombre}" cambió a S/ ${price.toFixed(2)}. Vuelve a agregarlo al carrito.`);
        }
        sumar(item, price !== null ? price : clientPrice, product.brandId || null);
      } else if (!item.personalizado) {
        const price = precioDeCatalogo(product);
        if (price !== null && Number.isFinite(clientPrice) && Math.abs(price - clientPrice) > 0.01) {
          throw new HttpsError("failed-precondition",
            `El precio de "${nombre}" cambió a S/ ${price.toFixed(2)}. Actualiza tu carrito.`);
        }
        sumar(item, price !== null ? price : clientPrice, product.brandId || null);
      } else {
        const price = precioDeCatalogo(product);
        sumar(item, Math.max(Number.isFinite(clientPrice) ? clientPrice : 0, price || 0), product.brandId || null);
      }
    }
    lineas.push(...await validarCombos(gruposDeCombo(items), { db, reader, HttpsError }));
    return cerrar();
  };
}

module.exports = { createCartValidator };
