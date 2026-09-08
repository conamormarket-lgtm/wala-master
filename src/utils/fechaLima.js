// Fechas en America/Lima (UTC-5, Perú no usa DST).
//
// El backend (functions/economyLogic.js) decide "hoy" y "el inicio de semana" en
// hora de Lima. El cliente venía usando unas veces la hora local del navegador y
// otras UTC, así que entre las 19:00 y las 23:59 (hora Perú) el front creía que
// ya era el día siguiente y mostraba mal el estado de los reclamos diarios.
// Este módulo replica exactamente los helpers del servidor para que ambos lados
// hablen del mismo día. `now` es inyectable (ms) para poder testear.

const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;

export const limaNow = (now = Date.now()) => new Date(now - LIMA_OFFSET_MS);

// 'YYYY-MM-DD' del día actual en Lima.
export const limaTodayStr = (now = Date.now()) => limaNow(now).toISOString().split('T')[0];

// 'YYYY-MM-DD' del día anterior en Lima (para rachas).
export const limaYesterdayStr = (now = Date.now()) => limaTodayStr(now - 24 * 60 * 60 * 1000);

// Día de la semana en Lima: 0 (domingo) - 6 (sábado).
export const limaDayOfWeek = (now = Date.now()) => limaNow(now).getUTCDay();

// 'YYYY-MM-DD' del lunes de la semana actual en Lima.
export const limaWeekStartStr = (now = Date.now()) => {
  const lima = limaNow(now);
  const day = lima.getUTCDay();
  const diff = lima.getUTCDate() - day + (day === 0 ? -6 : 1); // lunes como inicio
  const monday = new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), diff));
  return monday.toISOString().split('T')[0];
};

// Días completos entre dos fechas 'YYYY-MM-DD' de Lima. Se parsean como UTC a
// propósito: ambas cadenas YA son días de Lima, así que restarlas en UTC da la
// diferencia exacta sin que el huso del navegador meta ruido.
export const diasEntreFechasLima = (desde, hasta) => {
  if (!desde || !hasta) return 0;
  const a = Date.parse(desde + 'T00:00:00Z');
  const b = Date.parse(hasta + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
};

// Felicidad de Kapi HOY: baja 10 por cada día sin comer (sin contar el primero).
// Copia exacta de felicidadKapiHoy en functions/economyLogic.js — el servidor la
// persiste al alimentarlo y el cliente la usa para pintar la barra mientras tanto.
export const KAPI_HAPPINESS_STEP = 10;
export const felicidadKapiHoy = (felicidadGuardada, ultimaComida, hoy) => {
  const base = Math.max(0, Math.min(100, Number(felicidadGuardada) || 0));
  if (!ultimaComida) return base;
  const dias = diasEntreFechasLima(ultimaComida, hoy);
  if (dias <= 1) return base; // comió hoy o ayer: no decae
  return Math.max(0, base - KAPI_HAPPINESS_STEP * (dias - 1));
};
