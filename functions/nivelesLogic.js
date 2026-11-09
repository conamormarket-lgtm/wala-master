"use strict";

// ── Niveles de la cuenta (XP) ───────────────────────────────────────────────
// La XP solo sube: +10 al entrar a Misiones cada día, +5 por misión y +20 por
// cada pedido entregado (secureClaimMonedas). Al llegar a un nivel, una sola
// vez, se le deja un regalo en «Mis cupones» (origen 'nivel'). Los cupones de
// descuento respetan el tope de monedas de la marca (repartoTopeCupon), así que
// no hacen perder la venta.
// Mismos umbrales que src/constants/tiers.js: si cambian, cambiar los dos.

const XP_PEDIDO = 20;

const NIVELES = [
  { key: "bronce", nombre: "Bronce", min: 0 },
  { key: "plata", nombre: "Plata", min: 100 },
  { key: "oro", nombre: "Oro", min: 300 },
  { key: "diamante", nombre: "Diamante", min: 1000 },
];

// El regalo de cada nivel. `stickers`: además, el pack de WhatsApp de Walito.
const PREMIOS_NIVEL = {
  plata: { tipo: "envio_gratis", titulo: "Regalo Nivel Plata: envío gratis", descuentoPct: 0, topeDescuento: 0 },
  oro: { tipo: "descuento", titulo: "Regalo Nivel Oro: 10% de descuento", descuentoPct: 10, topeDescuento: 20 },
  diamante: { tipo: "descuento", titulo: "Regalo Nivel Diamante: 20% de descuento", descuentoPct: 20, topeDescuento: 50, stickers: "kapi" },
};
const VIGENCIA_REGALO_DIAS = 60;

function nivelDeXp(xp) {
  const n = Math.max(0, Number(xp) || 0);
  let actual = NIVELES[0];
  for (const nivel of NIVELES) if (n >= nivel.min) actual = nivel;
  return actual;
}

/**
 * Los regalos que tocan con esta XP: cada nivel alcanzado (sin contar Bronce)
 * que todavía no se premió. También los de antes (quien ya era Plata cuando
 * existió esto recibe su regalo la próxima vez que suma XP).
 * → [{ key, nombre, premio }] de menor a mayor.
 */
function regalosPendientes(xp, premiados = []) {
  const ya = new Set(Array.isArray(premiados) ? premiados : []);
  const n = Math.max(0, Number(xp) || 0);
  return NIVELES
    .filter((nv) => nv.min > 0 && n >= nv.min && !ya.has(nv.key) && PREMIOS_NIVEL[nv.key])
    .map((nv) => ({ key: nv.key, nombre: nv.nombre, premio: PREMIOS_NIVEL[nv.key] }));
}

module.exports = { XP_PEDIDO, NIVELES, PREMIOS_NIVEL, VIGENCIA_REGALO_DIAS, nivelDeXp, regalosPendientes };
