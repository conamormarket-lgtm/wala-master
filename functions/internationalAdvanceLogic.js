"use strict";

const crypto = require("crypto");

const ADVANCE_TYPE = "tiktok_live_international_advance";
const ADVANCE_AMOUNT_USD = "20.00";
const ADVANCE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeCountry(value) {
  return String(value || "").trim().toUpperCase().slice(0, 2);
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function validateCreatePayload(data) {
  const body = data && typeof data === "object" ? data : {};
  const tenantId = String(body.tenantId || "").trim();
  const chatId = String(body.chatId || "").trim();
  const line = String(body.line || "").trim();
  const country = normalizeCountry(body.country);
  const phone = normalizePhone(body.phone);

  if (!tenantId || !chatId) throw new Error("tenantId y chatId son obligatorios.");
  if (!line) throw new Error("La línea de atención es obligatoria.");
  if (!country || country === "PE") throw new Error("El adelanto internacional no aplica a Perú.");
  if (!phone || phone.startsWith("+51")) {
    throw new Error("Se requiere un teléfono internacional válido.");
  }
  return { tenantId, chatId, line, country, phone };
}

function paymentLinkId(apiToken, idempotencyKey) {
  if (!apiToken || !idempotencyKey) throw new Error("No se puede derivar el enlace sin credenciales.");
  return crypto.createHmac("sha256", apiToken).update(String(idempotencyKey)).digest("hex").slice(0, 40);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function callbackSignature(secret, timestamp, rawBody) {
  return crypto.createHmac("sha256", String(secret || ""))
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

function isExpired(data, nowMs = Date.now()) {
  const raw = data && data.expiresAt;
  const expiresMs = raw && typeof raw.toMillis === "function"
    ? raw.toMillis()
    : Number(raw || 0);
  return !expiresMs || expiresMs <= nowMs;
}

module.exports = {
  ADVANCE_TYPE,
  ADVANCE_AMOUNT_USD,
  ADVANCE_TTL_MS,
  normalizeCountry,
  normalizePhone,
  validateCreatePayload,
  paymentLinkId,
  safeEqual,
  callbackSignature,
  isExpired,
};
