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
