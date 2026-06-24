/**
 * Lógica PURA de la economía y utilidades de seguridad (Fase 0).
 * Sin dependencias de firebase-admin para poder testearla con Node puro
 * (functions/test/economyLogic.test.js). index.js importa de aquí.
 */
const crypto = require("crypto");

// Constantes de economía.
const KAPI_MONTHLY_CAP = 31;
const BALLSORT_REWARD = 2;
const STREAK_DATES_BONUS = 25;
const SURVEY_REWARD_MAX = 15; // máximo real de la encuesta (3 eventos x 5 monedas)
const REWARD_COINS_PER_ORDER = 10;

// ── Fechas en America/Lima (UTC-5, Perú no usa DST) ──────────────────────────
// `now` es inyectable (ms) para poder testear de forma determinista.
function limaNow(now = Date.now()) {
  return new Date(now - 5 * 60 * 60 * 1000);
}
function limaTodayStr(now = Date.now()) {
  return limaNow(now).toISOString().split("T")[0];
}
function limaWeekStartStr(now = Date.now()) {
  const lima = limaNow(now);
  const day = lima.getUTCDay();
  const diff = lima.getUTCDate() - day + (day === 0 ? -6 : 1); // lunes como inicio
  const monday = new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), diff));
  return monday.toISOString().split("T")[0];
}

// Resta `amount` de monedas y recorta monedasActivas FIFO (best-effort).
function applyDebit(userData, amount) {
  const monedas = Math.max(0, (userData.monedas || 0) - amount);
  let activas = Array.isArray(userData.monedasActivas)
    ? userData.monedasActivas.map((b) => ({ ...b }))
    : [];
  let remaining = amount;
  activas = activas.filter((b) => {
    if (remaining <= 0) return true;
    const take = Math.min(remaining, b.amount || 0);
    b.amount = (b.amount || 0) - take;
    remaining -= take;
    return b.amount > 0;
  });
  return { monedas, monedasActivas: activas };
}

// Contraseña aleatoria fuerte (H-03): nunca el DNI.
function randomPassword() {
  const base = crypto.randomBytes(24).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
  return base.slice(0, 20) + "Aa1!";
}

// Sorteo ponderado por `probability`. `rand` en [0,100). Determinista para tests.
function pickWeightedPrize(prizes, rand) {
  if (!Array.isArray(prizes) || prizes.length === 0) return null;
  let acc = 0;
  let selected = prizes[prizes.length - 1]; // fallback
  for (const p of prizes) {
    acc += Number(p.probability) || 0;
    if (rand <= acc) { selected = p; break; }
  }
  return selected;
}

// Verificación HMAC-SHA256 del webhook (H-03), comparación en tiempo constante.
function verifyWebhookSignature(rawBody, providedSig, secret) {
  if (!secret) return false;
  const provided = String(providedSig || "");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

module.exports = {
  KAPI_MONTHLY_CAP,
  BALLSORT_REWARD,
  STREAK_DATES_BONUS,
  SURVEY_REWARD_MAX,
  REWARD_COINS_PER_ORDER,
  limaNow,
  limaTodayStr,
  limaWeekStartStr,
  applyDebit,
  randomPassword,
  pickWeightedPrize,
  verifyWebhookSignature,
};
