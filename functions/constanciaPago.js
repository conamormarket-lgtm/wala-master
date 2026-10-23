"use strict";

// ════════════════════════════════════════════════════════════════════════════
// Constancia de un pago online (Culqi: tarjeta o Yape; PayPal)
// ────────────────────────────────────────────────────────────────────────────
// Un pago de Cobranza en el ERP lleva la captura del comprobante. Un pago online
// no tiene captura (la pasarela solo le manda un correo al cliente), y en el ERP
// quedaba un pago de "portal-web" sin nada que mirar. Esta constancia hace de
// comprobante: es una imagen con lo que Culqi o PayPal confirmaron al servidor,
// y va en los mismos campos que la captura de Cobranza (comprobanteUrl /
// comprobantePath), así el ERP la muestra sin cambios.
//
// Lógica pura (datos → SVG), el paso a PNG con resvg y las fuentes de
// ./fuentes (Montserrat, OFL), y asegurarConstancia: la sube y la pega en el
// ERP. La llaman registrarPagoSaldo (index.js) y, para los pagos de antes,
// scripts/backfill-constancias-pago.js. Tests: test/constanciaPago.test.js.
// ════════════════════════════════════════════════════════════════════════════

const path = require("path");

const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** "23/10/2026, 17:35" en hora de Lima. */
function fechaHoraLima(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";
  const iso = new Date(d.getTime() - LIMA_OFFSET_MS).toISOString();
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}, ${iso.slice(11, 16)}`;
}

const soles = (n) => `S/ ${(Math.round(Number(n || 0) * 100) / 100).toFixed(2)}`;

/**
 * Con qué se pagó un cargo de Culqi: tarjeta (marca y últimos 4) o Yape.
 * Culqi no documenta la forma del cargo de Yape: se reconoce por el token
 * (ype_…) o por la palabra "yape" en la fuente del cargo.
 */
function medioDeCargoCulqi(charge, tokenId) {
  const s = (charge && charge.source) || {};
  const pistas = [tokenId, s.id, s.type, s.object, s.source_type, s.payment_method, charge && charge.payment_method]
    .filter(Boolean).join(" ").toLowerCase();
  if (/yape|(^|\s)ype_/.test(pistas)) return { tipo: "yape" };
  const ultimos = String(s.card_number || s.last_four || "").replace(/\D/g, "").slice(-4);
  const marca = String((s.iin && s.iin.card_brand) || s.card_brand || "").trim();
  return { tipo: "tarjeta", ...(marca && { marca }), ...(ultimos.length === 4 && { ultimos }) };
}

/** "Visa •••• 1111", "Yape", "PayPal". */
function textoMedio(metodo, medio) {
  if (metodo === "paypal") return "PayPal";
  if (medio && medio.tipo === "yape") return "Yape";
  if (medio && medio.tipo === "tarjeta") {
    const marca = medio.marca ? medio.marca : "Tarjeta";
    return medio.ultimos ? `${marca} •••• ${medio.ultimos}` : marca;
  }
  return "Tarjeta";
}

const nombrePasarela = (metodo) => (metodo === "paypal" ? "PayPal" : "Culqi");

/**
 * Lo que dice la constancia.
 * @param {object} p { numeroPedido, clienteNombre, montoPen, montoUsd?, metodo, medio?, pagoId, fecha, sourceType? }
 */
function datosConstancia(p) {
  const restante = p.sourceType === "restante";
  return {
    pedido: `#${String(p.numeroPedido || "").replace(/^#/, "")}`,
    concepto: p.sourceType === "adelanto" ? "Pago del pedido"
      : restante ? "Pago del saldo pendiente" : "Abono al saldo pendiente",
    monto: soles(p.montoPen),
    montoUsd: p.metodo === "paypal" && Number(p.montoUsd) > 0 ? `US$ ${Number(p.montoUsd).toFixed(2)}` : null,
    cliente: String(p.clienteNombre || "").trim(),
    medio: textoMedio(p.metodo, p.medio),
    fecha: fechaHoraLima(p.fecha),
    operacion: String(p.pagoId || ""),
    pasarela: nombrePasarela(p.metodo),
  };
}

const escapar = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const recortar = (s, max) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

// El logo de public/logo-wala.svg (con stop-color: el original trae stopColor de React).
const LOGO = `
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6"/><stop offset="100%" stop-color="#5B21B6"/>
    </linearGradient>
    <path id="tag" d="M 32 42 L 28 88 C 27 92 30 94 34 93 L 85 80 C 89 79 91 76 89 72 L 76 18 C 75 13 68 11 65 14 L 36 34 C 32 37 31 40 32 42 Z"/>
  </defs>
  <g transform="translate(40 34) scale(0.46)">
    <g transform="translate(100, 10) scale(1.4)">
      <use href="#tag" fill="url(#g)"/><circle cx="67" cy="23" r="6.5" fill="#FFFFFF"/>
      <path d="M 38 42 L 43 78 L 54 52 L 64 72 L 72 38" fill="none" stroke="#FFFFFF" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 68 20 C 72 -2, 98 0, 85 28" stroke="url(#g)" stroke-width="6" stroke-linecap="round" fill="none"/>
    </g>
    <text x="350" y="225" text-anchor="end" font-family="Montserrat" font-weight="900" font-size="88" fill="url(#g)" letter-spacing="-3">WALA</text>
    <g transform="translate(328, 122) scale(0.35) rotate(5)">
      <use href="#tag" fill="url(#g)"/><circle cx="67" cy="23" r="6.5" fill="#FFFFFF"/>
      <path d="M 38 42 L 43 78 L 54 52 L 64 72 L 72 38" fill="none" stroke="#FFFFFF" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 68 20 C 72 45, 95 35, 85 15" stroke="url(#g)" stroke-width="6" stroke-linecap="round" fill="none"/>
    </g>
  </g>`;

const ANCHO = 900;
const ALTO = 1200;

/** La constancia como SVG (900 × 1200, fondo blanco, logo arriba a la izquierda). */
function svgConstancia(d) {
  const filas = [
    ["Cliente", d.cliente ? recortar(d.cliente, 34) : "—"],
    ["Medio de pago", d.medio],
    ["Fecha y hora (Lima)", d.fecha],
    [`Código de operación (${d.pasarela})`, recortar(d.operacion, 40)],
    ["Confirmado por", `${d.pasarela}, al momento del cobro`],
  ];
  const y0 = 560;
  const alto = 92;
  const filasSvg = filas.map(([etiqueta, valor], i) => {
    const y = y0 + i * alto;
    return `
    <text x="64" y="${y}" font-family="Montserrat" font-weight="600" font-size="21" fill="#8A8399">${escapar(etiqueta)}</text>
    <text x="64" y="${y + 38}" font-family="Montserrat" font-weight="700" font-size="29" fill="#1F1235">${escapar(valor)}</text>
    ${i < filas.length - 1 ? `<rect x="64" y="${y + 62}" width="772" height="2" fill="#EEE9F6"/>` : ""}`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${ALTO}" width="${ANCHO}" height="${ALTO}">
  <rect width="${ANCHO}" height="${ALTO}" fill="#FFFFFF"/>
  ${LOGO}
  <rect x="566" y="58" width="290" height="56" rx="28" fill="url(#g)"/>
  <text x="711" y="95" text-anchor="middle" font-family="Montserrat" font-weight="900" font-size="22" fill="#FFFFFF" letter-spacing="1.5">PAGO CONFIRMADO</text>
  <text x="64" y="236" font-family="Montserrat" font-weight="900" font-size="56" fill="#1F1235" letter-spacing="-1">Constancia de pago</text>
  <text x="64" y="284" font-family="Montserrat" font-weight="600" font-size="27" fill="#5B5470">${escapar(`${d.concepto} · Pedido ${d.pedido}`)}</text>
  <rect x="48" y="320" width="804" height="${d.montoUsd ? 196 : 170}" rx="28" fill="#F5F0FF"/>
  <text x="84" y="370" font-family="Montserrat" font-weight="700" font-size="20" fill="#6D28D9" letter-spacing="2">MONTO PAGADO</text>
  <text x="80" y="456" font-family="Montserrat" font-weight="900" font-size="80" fill="#1F1235" letter-spacing="-2">${escapar(d.monto)}</text>
  ${d.montoUsd ? `<text x="84" y="496" font-family="Montserrat" font-weight="600" font-size="22" fill="#5B5470">${escapar(`Cobrado en PayPal: ${d.montoUsd}`)}</text>` : ""}
  ${filasSvg}
  <rect x="48" y="1062" width="804" height="2" fill="#EEE9F6"/>
  <text x="64" y="1108" font-family="Montserrat" font-weight="600" font-size="19" fill="#8A8399">${escapar(`Walá comprobó este cobro con ${d.pasarela} antes de registrarlo.`)}</text>
  <text x="64" y="1138" font-family="Montserrat" font-weight="600" font-size="19" fill="#8A8399">${escapar(`Búscalo en el panel de ${d.pasarela} con el código de operación.`)}</text>
</svg>`;
}

const FUENTES = ["400Regular", "600SemiBold", "700Bold", "900Black"]
  .map((p) => path.join(__dirname, "fuentes", `Montserrat_${p}.ttf`));

/** SVG → PNG (Buffer). resvg se carga recién aquí: solo lo usan los pagos. */
function pngDeSvg(svg) {
  const { Resvg } = require("@resvg/resvg-js");
  const resvg = new Resvg(svg, {
    background: "#FFFFFF",
    fitTo: { mode: "width", value: ANCHO },
    font: { fontFiles: FUENTES, loadSystemFonts: false, defaultFontFamily: "Montserrat" },
  });
  return resvg.render().asPng();
}

/** Ruta en Storage: la carpeta de comprobantes del pedido que usa el ERP. Fija por cobro. */
function rutaConstancia(numeroPedido, metodo, pagoId) {
  const limpio = (s) => String(s || "").replace(/[^\w-]/g, "_");
  return `comprobantes_pago/${limpio(numeroPedido)}/constancia_${limpio(metodo)}_${limpio(pagoId)}.png`;
}

const sha256 = (buf) => require("crypto").createHash("sha256").update(buf).digest("hex");
const urlDescarga = (bucket, ruta, token) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`;

/**
 * Sube la PNG a `ruta` sin pisar otra: el cobro y el webhook pueden llegar los
 * dos a la vez. Si ya existe, se usa esa (su token y sus bytes).
 */
async function subirSinPisar(bucket, ruta, png) {
  const archivo = bucket.file(ruta);
  const token = require("crypto").randomUUID();
  try {
    await archivo.save(png, {
      resumable: false,
      contentType: "image/png",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { cacheControl: "public, max-age=31536000", metadata: { firebaseStorageDownloadTokens: token } },
    });
    return { token, bytes: png };
  } catch (e) {
    if (e.code !== 412) throw e;
    const [[meta], [bytes]] = await Promise.all([archivo.getMetadata(), archivo.download()]);
    const previo = String((meta.metadata && meta.metadata.firebaseStorageDownloadTokens) || "").split(",")[0];
    if (!previo) throw new Error(`La constancia ${ruta} existe sin token de descarga.`);
    return { token: previo, bytes };
  }
}

/**
 * Pone la constancia de un pago online como comprobante del pago en el ERP:
 * en el movimiento de Finanzas (fp_transactions/{txId}) y en el pedido
 * (la entrada de cobranza.historialPagos con ese paymentId; en un pedido web,
 * comprobantesPago, que es lo que el ERP toma como comprobante del adelanto).
 * No hace nada si el movimiento ya tiene comprobante o todavía no existe.
 *
 * @param {object} p { db, bucket, FieldValue, coleccion, pedidoId, pago: { metodo, id, montoPen, montoUsd?, medio? }, txId }
 * @returns {Promise<string|null>} la URL de la constancia
 */
async function asegurarConstancia({ db, bucket, FieldValue, coleccion, pedidoId, pago, txId }) {
  const movRef = db.collection("fp_transactions").doc(txId);
  const pedidoRef = db.collection(coleccion).doc(String(pedidoId));
  const [mov, ped] = await Promise.all([movRef.get(), pedidoRef.get()]);
  if (!mov.exists || !ped.exists) return null;
  const m = mov.data() || {};
  if (m.comprobanteUrl) return m.comprobanteUrl;

  const pedido = ped.data() || {};
  const numeroPedido = pedido.numeroPedido || pedidoId;
  const entrada = ((pedido.cobranza && pedido.cobranza.historialPagos) || []).find((h) => h && h.paymentId === txId);
  const online = (pedido.pagosOnline || []).find((x) => x && String(x.id) === String(pago.id)) || {};
  const datos = datosConstancia({
    numeroPedido,
    clienteNombre: [pedido.clienteNombre, coleccion === "pedidos_web" ? pedido.clienteApellidos : ""].filter(Boolean).join(" "),
    montoPen: m.amount != null ? m.amount : pago.montoPen,
    montoUsd: pago.montoUsd != null ? pago.montoUsd : online.montoUsd,
    metodo: pago.metodo,
    medio: pago.medio || online.medio,
    pagoId: pago.id,
    fecha: (entrada && entrada.timestamp) || online.fecha || m.createdAt || new Date(),
    sourceType: m.sourceType,
  });
  const ruta = rutaConstancia(numeroPedido, pago.metodo, pago.id);
  const { token, bytes } = await subirSinPisar(bucket, ruta, pngDeSvg(svgConstancia(datos)));
  const url = urlDescarga(bucket.name, ruta, token);
  const hash = sha256(bytes);

  await db.runTransaction(async (t) => {
    const keyRef = db.collection("cobranzaPaymentKeys").doc(sha256(JSON.stringify([coleccion, String(pedidoId), hash])));
    const [movT, pedT] = [await t.get(movRef), await t.get(pedidoRef)];
    if (!movT.exists || movT.data().comprobanteUrl || !pedT.exists) return;
    t.update(movRef, { comprobanteUrl: url, comprobantePath: ruta, comprobanteHashes: [hash] });
    const actual = pedT.data() || {};
    if (coleccion === "pedidos_web") {
      const previos = Array.isArray(actual.comprobantesPago) ? actual.comprobantesPago : [];
      if (!previos.some((c) => c && c.fullPath === ruta)) {
        t.update(pedidoRef, { comprobantesPago: [...previos, { url, fullPath: ruta, timestamp: new Date().toISOString() }] });
      }
    } else {
      const historial = [...((actual.cobranza && actual.cobranza.historialPagos) || [])];
      const i = historial.findIndex((h) => h && h.paymentId === txId);
      if (i >= 0 && !historial[i].comprobanteUrl) {
        historial[i] = { ...historial[i], comprobanteUrl: url, comprobantePath: ruta, comprobanteHashes: [hash] };
        t.update(pedidoRef, { "cobranza.historialPagos": historial });
      }
      // Como Cobranza: la llave impide registrar otro pago con esta misma imagen.
      t.set(keyRef, { paymentId: txId, createdAt: FieldValue.serverTimestamp() });
    }
  });
  return url;
}

module.exports = {
  asegurarConstancia,
  fechaHoraLima,
  medioDeCargoCulqi,
  textoMedio,
  datosConstancia,
  svgConstancia,
  pngDeSvg,
  rutaConstancia,
};
