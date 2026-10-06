/**
 * Lógica PURA de "Fechas importantes": cuánto se paga por registrar fechas y
 * qué recordatorios tocan hoy. Sin firebase-admin para poder testearla con Node
 * puro (functions/test/fechasLogic.test.js). index.js importa de aquí.
 *
 * Las fechas viven en portal_clientes_users/{uid}.giftRecipients[] — el cliente
 * las escribe, así que acá NADA se confía: se valida cada evento antes de pagar.
 */

// 5 monedas por cada fecha nueva, con un TOPE de por vida de 50 (10 fechas).
// El tope evita "cosechar" monedas inventando fechas o borrando y volviendo a
// crear la misma persona (cada alta trae ids nuevos).
const DATE_REWARD_PER_EVENT = 5;
const DATES_REWARD_CAP = 50;
// Antes, la encuesta pagaba 5 por fecha con tope de 3 (15). A quien ya cobró
// eso se le dan por pagadas sus 3 primeras fechas para no pagarlas dos veces.
const LEGACY_PAID_EVENTS = 3;

// Días antes de la fecha en que se avisa.
const REMINDER_DAYS = [7, 1];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function fechaValida(str) {
  const m = ISO_DATE.exec(String(str || ""));
  if (!m) return false;
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31;
}

// Eventos que cuentan para pagar: persona con nombre, evento con id y fecha real.
function eventosValidos(giftRecipients) {
  const out = [];
  if (!Array.isArray(giftRecipients)) return out;
  for (const r of giftRecipients) {
    if (!r || typeof r.name !== "string" || !r.name.trim()) continue;
    if (!Array.isArray(r.events)) continue;
    for (const ev of r.events) {
      if (!ev || typeof ev.id !== "string" || !ev.id) continue;
      if (!fechaValida(ev.date)) continue;
      out.push({ recipient: r, event: ev });
    }
  }
  return out;
}

/**
 * Calcula el pago por fechas nuevas.
 * @param {object} u  doc del usuario (giftRecipients, datesRewardedIds, datesRewardTotal, surveyRewardClaimed)
 * @returns {{reward:number, rewardedIds:string[], total:number}}
 */
function calcularRecompensaFechas(u) {
  const user = u || {};
  const eventos = eventosValidos(user.giftRecipients);
  let pagados = Array.isArray(user.datesRewardedIds) ? [...user.datesRewardedIds] : null;
  let total = Number(user.datesRewardTotal) || 0;

  if (pagados === null) {
    pagados = [];
    // Usuario de la encuesta vieja: ya cobró hasta 3 fechas.
    if (user.surveyRewardClaimed === true) {
      eventos.slice(0, LEGACY_PAID_EVENTS).forEach(({ event }) => pagados.push(event.id));
      total = Math.max(total, LEGACY_PAID_EVENTS * DATE_REWARD_PER_EVENT);
    }
  }

  const yaPagados = new Set(pagados);
  let reward = 0;
  for (const { event } of eventos) {
    if (yaPagados.has(event.id)) continue;
    if (total + reward + DATE_REWARD_PER_EVENT > DATES_REWARD_CAP) break;
    reward += DATE_REWARD_PER_EVENT;
    yaPagados.add(event.id);
    pagados.push(event.id);
  }
  return { reward, rewardedIds: pagados, total: total + reward };
}

/**
 * Días hasta la próxima vez que cae (día/mes) `fecha` contando desde `hoy`.
 * Ambas en "YYYY-MM-DD". 0 = es hoy. Un 29-feb cae el 28-feb en años no bisiestos.
 */
function diasHastaProxima(fecha, hoy) {
  if (!fechaValida(fecha) || !fechaValida(hoy)) return null;
  const [, , mesF, diaF] = ISO_DATE.exec(fecha).map(Number);
  const [, anioH, mesH, diaH] = ISO_DATE.exec(hoy).map(Number);
  const base = Date.UTC(anioH, mesH - 1, diaH);
  const ocurrencia = (anio) => {
    const ultimoDia = new Date(Date.UTC(anio, mesF, 0)).getUTCDate();
    return Date.UTC(anio, mesF - 1, Math.min(diaF, ultimoDia));
  };
  let t = ocurrencia(anioH);
  if (t < base) t = ocurrencia(anioH + 1);
  return Math.round((t - base) / (24 * 60 * 60 * 1000));
}

function nombreEvento(ev) {
  if (ev.type === "Fecha Especial" && ev.customName) return ev.customName;
  return ev.type || "Fecha especial";
}

/**
 * Recordatorios que tocan hoy. `log` es un mapa { "<eventId>|<año>|<dias>": true }
 * de los ya enviados, para no repetir el mismo aviso.
 * @returns {Array<{key, dias, recipient, event, titulo, cuerpo}>}
 */
function recordatoriosDeHoy(giftRecipients, hoy, log, diasAviso = REMINDER_DAYS) {
  const enviados = log || {};
  // Configurables en el admin (storeConfig/fechasFestivas.recordatorioPersonalDias);
  // una lista vacía = el admin apagó estos avisos.
  const dias_ = Array.isArray(diasAviso) ? diasAviso : REMINDER_DAYS;
  const anio = String(hoy).slice(0, 4);
  const out = [];
  for (const { recipient, event } of eventosValidos(giftRecipients)) {
    const dias = diasHastaProxima(event.date, hoy);
    if (!dias_.includes(dias)) continue;
    const key = `${event.id}|${anio}|${dias}`;
    if (enviados[key]) continue;
    const quien = recipient.name.trim();
    const que = nombreEvento(event);
    const cuando = dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`;
    out.push({
      key,
      dias,
      recipient,
      event,
      titulo: `🎁 ${que} de ${quien} ${cuando}`,
      cuerpo: dias <= 1
        ? `Todavía llegas: mira los regalos que elegimos para ${quien}.`
        : `Te armamos ideas de regalo para ${quien}. Pide con tiempo y llega perfecto.`,
    });
  }
  return out;
}

module.exports = {
  DATE_REWARD_PER_EVENT,
  DATES_REWARD_CAP,
  LEGACY_PAID_EVENTS,
  REMINDER_DAYS,
  fechaValida,
  eventosValidos,
  calcularRecompensaFechas,
  diasHastaProxima,
  recordatoriosDeHoy,
};
