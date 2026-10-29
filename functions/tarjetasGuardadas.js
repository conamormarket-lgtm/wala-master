"use strict";

/*
 * Tarjetas guardadas (Culqi). Walá no guarda el número: Culqi guarda la
 * tarjeta en un "cliente" suyo y nos da un id (crd_...) que solo sirve con
 * nuestra llave secreta. Aquí va lo que no toca la red; los llamados a Culqi y
 * a Firestore están en index.js.
 *
 * Dónde viven: culqiCharges/tarjetas_{uid} (el cliente de Culqi) y su
 * subcolección guardadas/{crd_...}. culqiCharges es solo de Walá en las reglas
 * y no tiene match propio: ninguna sesión la lee ni la escribe, solo el
 * servidor. Una colección nueva caería en la regla general del ERP (abierta a
 * cualquier sesión) y otra cuenta podría apuntar a una tarjeta ajena.
 */

const MAX_TARJETAS = 5;

const docTarjetas = (uid) => `tarjetas_${uid}`;

// Guardar tarjetas pide una cuenta de verdad: con correo y que no sea anónima.
// Con una tarjeta guardada se compra sin escribirla, así que la cuenta es la llave.
function puedeGuardarTarjetas(auth) {
  if (!auth || !auth.uid || !auth.token) return false;
  const proveedor = auth.token.firebase && auth.token.firebase.sign_in_provider;
  if (!proveedor || proveedor === "anonymous" || proveedor === "custom") return false;
  return Boolean(String(auth.token.email || "").trim());
}

// La tarjeta que devuelve Culqi (POST /cards) en lo que se muestra.
function datosDeTarjeta(card) {
  const c = card || {};
  const s = c.source || {};
  const iin = s.iin || {};
  const ultimos4 = String(s.last_four || s.card_number || "").replace(/\D/g, "").slice(-4);
  const bin = String(iin.bin || s.card_number || "").replace(/\D/g, "").slice(0, 6);
  return {
    culqiCardId: String(c.id || ""),
    marca: String(iin.card_brand || s.card_brand || "").trim() || "Tarjeta",
    ultimos4: ultimos4.length === 4 ? ultimos4 : "",
    tipo: String(iin.card_type || "").trim(),
    banco: String((iin.issuer && iin.issuer.name) || "").trim(),
    bin: bin.length === 6 ? bin : "",
  };
}

const esTarjetaCulqi = (card) => Boolean(card && card.object === "card" && /^crd_/.test(String(card.id || "")));

// Lo que el navegador ve de una tarjeta guardada (sin ids de Culqi del cliente).
function tarjetaParaCliente(id, d) {
  return {
    id,
    marca: d.marca || "Tarjeta",
    ultimos4: d.ultimos4 || "",
    tipo: d.tipo || "",
    banco: d.banco || "",
  };
}

// La misma tarjeta ya guardada (mismo bin y últimos 4): no se guarda dos veces.
function yaGuardada(guardadas, { bin, ultimos4 }) {
  if (!bin || !ultimos4) return false;
  return (guardadas || []).some((t) => t && t.bin === bin && t.ultimos4 === ultimos4);
}

// El id de un intento de cobro con tarjeta guardada: lo genera el navegador por
// clic y sirve de cerrojo (como el token en un cobro con tarjeta nueva).
const intentoValido = (x) => typeof x === "string" && /^[A-Za-z0-9_-]{12,80}$/.test(x);

const tarjetaIdValido = (x) => typeof x === "string" && /^crd_(test|live)_[A-Za-z0-9]{4,80}$/.test(x);

module.exports = {
  MAX_TARJETAS,
  docTarjetas,
  puedeGuardarTarjetas,
  datosDeTarjeta,
  esTarjetaCulqi,
  tarjetaParaCliente,
  yaGuardada,
  intentoValido,
  tarjetaIdValido,
};
