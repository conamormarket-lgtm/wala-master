export const LANDING_FUNNEL_EVENT = 'landing_funnel';
export const LANDING_FUNNEL_STEPS = ['landing', 'cart', 'shipping', 'payment', 'card', 'whatsapp', 'paypal'];
export const LANDING_JOURNEY_MAX_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'wala_landing_funnel_v1';

/** One journey per landing and browser tab; only an actual landing view starts it.
 * Snapshots preserve reached steps if an earlier write failed. No customer data.
 * Explicit landing URLs keep ordinary checkouts outside this attribution.
 */
export function createLandingFunnelTracker({ storage, send, now = Date.now, newId = () => globalThis.crypto.randomUUID() }) {
  let journeys;
  const pending = new Map();
  function read() {
    if (journeys) return journeys;
    try { journeys = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}'); } catch { journeys = {}; }
    if (!journeys || typeof journeys !== 'object' || Array.isArray(journeys)) journeys = {};
    return journeys;
  }
  function save() {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(journeys)); } catch { /* Memory still works without storage. */ }
  }
  return async function record({ step, landingId, anonymousId, productName = '' }) {
    if (!LANDING_FUNNEL_STEPS.includes(step) || !landingId || !anonymousId) return false;
    const ts = now();
    const all = read();
    for (const [key, value] of Object.entries(all)) {
      if (!Number.isFinite(value?.enteredAtMs) || !value.journeyId || !value.reached || !value.sent || ts < value.enteredAtMs || ts - value.enteredAtMs >= LANDING_JOURNEY_MAX_MS || value.anonymousId !== anonymousId) delete all[key];
    }
    // Prefix guards special object property names supplied by a product slug.
    const key = `product:${landingId}`;
    let journey = all[key];
    if (!journey) {
      if (step !== 'landing') return false;
      journey = all[key] = { journeyId: newId(), landingId, anonymousId, enteredAtMs: ts, productName: String(productName).slice(0, 160), reached: {}, sent: {} };
    }
    if (step !== 'landing' && !journey.reached.landing) return false;
    if (step === 'payment' && !journey.reached.shipping) return false;
    if (['card', 'whatsapp', 'paypal'].includes(step) && !journey.reached.payment) return false;
    journey.reached[step] ||= ts;
    save();
    if (journey.sent[step]) return true;
    const requestKey = `${journey.journeyId}:${step}`;
    if (pending.has(requestKey)) return pending.get(requestKey);
    const event = {
      type: LANDING_FUNNEL_EVENT, anonymousId, clientTsMs: ts,
      eventData: { version: 1, journeyId: journey.journeyId, landingId, productName: journey.productName, enteredAtMs: journey.enteredAtMs, step, reached: { ...journey.reached } },
    };
    const request = Promise.resolve().then(() => send(event)).then((result) => {
      if (result?.error || !result?.id) return false;
      journey.sent[step] = true;
      save();
      return true;
    }).catch(() => false).finally(() => pending.delete(requestKey));
    pending.set(requestKey, request);
    return request;
  };
}

/** Unique browsers over the entire selected period (never sums daily uniques).
 * A cohort is journeys ENTERING in the period, with progress observed by its end.
 * Merge by journey before by person: visits to another landing cannot complete it.
 */
export function aggregateLandingFunnel(events, { startDateMs = 0, endDateMs = Infinity } = {}) {
  const journeys = new Map();
  for (const event of events || []) {
    const d = event?.eventData;
    const ts = event?.clientTsMs;
    if (event?.type !== LANDING_FUNNEL_EVENT || d?.version !== 1 || !event.anonymousId || !d.journeyId || !d.landingId) continue;
    if (!Number.isFinite(ts) || !Number.isFinite(d.enteredAtMs) || d.enteredAtMs < startDateMs || d.enteredAtMs > endDateMs || ts < d.enteredAtMs || ts > endDateMs || ts - d.enteredAtMs >= LANDING_JOURNEY_MAX_MS) continue;
    const key = JSON.stringify([event.anonymousId, d.landingId, d.journeyId, d.enteredAtMs]);
    const j = journeys.get(key) || { person: event.anonymousId, landingId: d.landingId, name: d.productName || d.landingId, enteredAtMs: d.enteredAtMs, reached: {} };
    for (const step of LANDING_FUNNEL_STEPS) {
      const time = d.reached?.[step];
      if (Number.isFinite(time) && time >= d.enteredAtMs && time <= ts && time <= endDateMs) j.reached[step] = Math.min(j.reached[step] ?? Infinity, time);
    }
    journeys.set(key, j);
  }
  const empty = () => Object.fromEntries([...LANDING_FUNNEL_STEPS, 'selected', 'directShipping'].map((s) => [s, new Set()]));
  const total = empty();
  const products = new Map();
  for (const j of journeys.values()) {
    const r = j.reached;
    if (r.landing !== j.enteredAtMs) continue;
    if (!products.has(j.landingId)) products.set(j.landingId, { landingId: j.landingId, name: j.name, counts: empty() });
    const counts = products.get(j.landingId).counts;
    const add = (step) => { total[step].add(j.person); counts[step].add(j.person); };
    add('landing');
    if (r.cart >= r.landing) add('cart');
    if (!(r.shipping >= r.landing)) continue;
    add('shipping');
    if (!(r.cart <= r.shipping)) add('directShipping');
    if (!(r.payment >= r.shipping)) continue;
    add('payment');
    let selected = false;
    for (const method of ['card', 'whatsapp', 'paypal']) {
      if (r[method] >= r.payment) { add(method); selected = true; }
    }
    if (selected) add('selected');
  }
  const sizes = (counts) => Object.fromEntries(Object.entries(counts).map(([key, people]) => [key, people.size]));
  return { total: sizes(total), products: [...products.values()].map((p) => ({ ...p, counts: sizes(p.counts) })).sort((a, b) => b.counts.landing - a.counts.landing || a.name.localeCompare(b.name)) };
}
