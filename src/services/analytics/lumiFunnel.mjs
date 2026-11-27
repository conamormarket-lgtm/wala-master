export const LUMI_FUNNEL_EVENT = 'lumi_funnel';
export const LUMI_JOURNEY_MAX_MS = 24 * 60 * 60 * 1000;
export const LUMI_STAGES = ['catalog', 'product', 'add', 'cart', 'payment', 'whatsapp'];
export const LUMI_ACTIONS = {
  catalog: 'Vio el catálogo', brand: 'Filtró por marca', product: 'Vio un producto',
  add: 'Agregó al carrito', cart: 'Vio el carrito', payment: 'Vio los medios de pago',
  copy_account: 'Copió una cuenta', payment_close: 'Cerró los medios de pago',
  payment_error: 'No pudo continuar al pago', whatsapp: 'Pulsó abrir WhatsApp',
};
const STORAGE_KEY = 'wala_lumi_funnel_v1';
const ACTIONS = Object.keys(LUMI_ACTIONS);

// Only catalog context, never customer names, phone numbers or receipt contents.
export function lumiDetails(input = {}) {
  input ||= {};
  const out = {};
  for (const key of ['productId', 'productName', 'brand', 'method', 'reason']) {
    if (typeof input[key] === 'string') out[key] = input[key].slice(0, 160);
  }
  for (const key of ['quantity', 'total']) {
    if (Number.isFinite(input[key]) && input[key] >= 0) out[key] = input[key];
  }
  return out;
}

/** One explicit Lumi journey per tab, starting at a rendered catalog.
 * Snapshots recover milestones after a failed write. Repeated actions do not
 * inflate unique visitors; adjacent identical renders within 30s are suppressed.
 */
export function createLumiFunnelTracker({ storage, send, now = Date.now, newId = () => globalThis.crypto.randomUUID() }) {
  let journey;
  const pending = new Map();
  const save = () => { try { storage?.setItem(STORAGE_KEY, JSON.stringify(journey)); } catch { /* memory fallback */ } };
  return async function record({ step, anonymousId, details = {} }) {
    if (!ACTIONS.includes(step) || !anonymousId) return false;
    const ts = now();
    if (!journey) { try { journey = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null'); } catch { /* no storage */ } }
    if (!journey?.journeyId || journey.anonymousId !== anonymousId || !Number.isFinite(journey.enteredAtMs)
      || ts < journey.enteredAtMs || ts - journey.enteredAtMs >= LUMI_JOURNEY_MAX_MS
      || journey.reached?.catalog !== journey.enteredAtMs || !Number.isInteger(journey.seq)
      || !Number.isInteger(journey.sentSeq) || journey.sentSeq < 0) journey = null;
    if (!journey) {
      if (step !== 'catalog') return false;
      journey = { journeyId: newId(), anonymousId, enteredAtMs: ts, reached: { catalog: ts }, seq: 0, sentSeq: 0 };
    }
    if (['payment', 'payment_error'].includes(step) && !Number.isFinite(journey.reached.cart)) return false;
    if (['whatsapp', 'copy_account', 'payment_close'].includes(step) && !Number.isFinite(journey.reached.payment)) return false;
    const clean = lumiDetails(details);
    const signature = JSON.stringify([step, clean]);
    if (journey.signature !== signature || ts - journey.lastAtMs >= 30_000) {
      journey.seq += 1;
      journey.lastAtMs = ts;
      journey.signature = signature;
      journey.step = step;
      journey.details = clean;
    }
    if (LUMI_STAGES.includes(step)) journey.reached[step] ??= ts;
    save();
    const current = journey;
    const seq = current.seq;
    if (current.sentSeq >= seq) return true;
    const key = `${current.journeyId}:${seq}`;
    if (pending.has(key)) return pending.get(key);
    const event = { type: LUMI_FUNNEL_EVENT, anonymousId, clientTsMs: current.lastAtMs,
      eventData: { version: 1, journeyId: current.journeyId, enteredAtMs: current.enteredAtMs,
        seq, step, reached: { ...current.reached }, details: clean } };
    const request = Promise.resolve().then(() => send(event)).then(result => {
      if (!result?.id || result.error) return false;
      current.sentSeq = Math.max(current.sentSeq, seq);
      save();
      return true;
    }).catch(() => false).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
}

/** Cohort: journeys entering in the selected period; no sum of daily uniques.
 * A visitor's row describes their latest journey, including backward navigation.
 */
export function aggregateLumiFunnel(events, { startDateMs = 0, endDateMs = Infinity } = {}) {
  const journeys = new Map();
  for (const event of events || []) {
    const d = event?.eventData, ts = event?.clientTsMs;
    if (event?.type !== LUMI_FUNNEL_EVENT || d?.version !== 1 || !event.anonymousId || !d.journeyId
      || !ACTIONS.includes(d.step) || !Number.isInteger(d.seq) || d.seq < 1 || !Number.isFinite(ts)
      || !Number.isFinite(d.enteredAtMs) || d.enteredAtMs < startDateMs || d.enteredAtMs > endDateMs
      || ts < d.enteredAtMs || ts > endDateMs || ts - d.enteredAtMs >= LUMI_JOURNEY_MAX_MS
      || d.reached?.catalog !== d.enteredAtMs) continue;
    const key = JSON.stringify([event.anonymousId, d.journeyId, d.enteredAtMs]);
    const j = journeys.get(key) || { anonymousId: event.anonymousId, journeyId: d.journeyId,
      enteredAtMs: d.enteredAtMs, reached: {}, lastAtMs: -1, seq: -1 };
    const reached = {};
    for (const step of LUMI_STAGES) {
      const time = d.reached[step];
      if (Number.isFinite(time) && time >= d.enteredAtMs && time <= ts) reached[step] = time;
    }
    if (!(reached.payment >= reached.cart)) delete reached.payment;
    if (!(reached.whatsapp >= reached.payment)) delete reached.whatsapp;
    if (LUMI_STAGES.includes(d.step) && !Number.isFinite(reached[d.step])) continue;
    if (['copy_account', 'payment_close'].includes(d.step) && !Number.isFinite(reached.payment)) continue;
    if (d.step === 'payment_error' && !Number.isFinite(reached.cart)) continue;
    for (const [step, time] of Object.entries(reached)) j.reached[step] = Math.min(j.reached[step] ?? Infinity, time);
    if (ts > j.lastAtMs || (ts === j.lastAtMs && d.seq > j.seq)) {
      Object.assign(j, { lastAtMs: ts, seq: d.seq, lastStep: d.step, details: lumiDetails(d.details) });
    }
    journeys.set(key, j);
  }
  const sets = Object.fromEntries(LUMI_STAGES.map(step => [step, new Set()]));
  const people = new Map();
  for (const j of journeys.values()) {
    for (const step of LUMI_STAGES) if (Number.isFinite(j.reached[step])) sets[step].add(j.anonymousId);
    j.furthest = LUMI_STAGES.filter(step => Number.isFinite(j.reached[step])).at(-1);
    const prior = people.get(j.anonymousId);
    if (!prior || j.lastAtMs > prior.lastAtMs || (j.lastAtMs === prior.lastAtMs && j.seq > prior.seq)) people.set(j.anonymousId, j);
  }
  return { total: Object.fromEntries(Object.entries(sets).map(([key, values]) => [key, values.size])),
    visitors: [...people.values()].sort((a, b) => b.lastAtMs - a.lastAtMs) };
}
