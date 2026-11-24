/** Passive HTTP body-byte meter for this page's Firestore traffic. It does not
 * change requests, options, responses or retries. Bytes are decoded HTTP body
 * bytes (not compressed wire bytes or the billing SKU). No bodies/IDs are logged.
 */
const installed = new WeakMap();
export function installFirestoreTransportMeter({ observe, enabled, screen }, realm = globalThis) {
  if (installed.has(realm)) return installed.get(realm);
  const totals = {};
  const meter = { snapshot: () => ({ ...totals }) };
  installed.set(realm, meter);
  const encoder = new TextEncoder();
  function scope(input) {
    try {
      if (!enabled()) return null;
      const url = new URL(typeof input === 'string' ? input : input?.url || String(input), realm.location?.href);
      if (url.hostname !== 'firestore.googleapis.com') return null;
      const database = url.searchParams.get('database') || decodeURIComponent(url.pathname);
      const match = database.match(/projects\/([^/]+)\/databases\/([^/]+)/);
      if (!match) return null;
      const operation = url.pathname.match(/Firestore\/([A-Za-z]+)/)?.[1]
        || url.pathname.match(/documents:([A-Za-z]+)/)?.[1] || 'REST';
      return { project: match[1], database: match[2], collection: '(transport)', originScreen: screen(), operation: `http.${operation}` };
    } catch { return null; }
  }
  function record(info, counts) {
    try {
      if (info && enabled()) {
        for (const [name, count] of Object.entries(counts)) totals[name] = (totals[name] || 0) + count;
        const { operation, ...dimensions } = info;
        observe(dimensions, operation, counts);
      }
    } catch { /* passive */ }
  }
  const XHR = realm.XMLHttpRequest;
  if (XHR?.prototype) {
    const states = new WeakMap(), hooked = new WeakSet();
    const originalOpen = XHR.prototype.open, originalSend = XHR.prototype.send;
    function measure(xhr, final = false) {
      const state = states.get(xhr);
      if (!state || state.finished) return;
      try {
        if (!xhr.responseType || xhr.responseType === 'text') {
          const body = xhr.responseText || '';
          // Hold an incomplete UTF-16 surrogate until the next progress event.
          let end = body.length;
          if (!final && end && /[\uD800-\uDBFF]/.test(body[end - 1])) end--;
          if (end > state.characters) {
            const bytes = encoder.encode(body.slice(state.characters, end)).length;
            state.characters = end;
            record(state.scope, { transportResponseBytes: bytes });
          }
        } else if (final) {
          const bytes = xhr.response?.byteLength ?? xhr.response?.size;
          if (Number.isSafeInteger(bytes)) record(state.scope, { transportResponseBytes: bytes });
          else record(state.scope, { transportMeasurementErrors: 1 });
        }
      } catch { if (final) record(state.scope, { transportMeasurementErrors: 1 }); }
      if (final) {
        state.finished = true;
        record(state.scope, { transportResponses: 1, ...(xhr.status === 0 || xhr.status >= 400 ? { transportFailedResponses: 1 } : {}) });
      }
    }
    XHR.prototype.open = function(...args) {
      const result = originalOpen.apply(this, args);
      try {
        const info = scope(args[1]);
        if (info) {
          states.set(this, { scope: info, characters: 0, finished: false });
          if (!hooked.has(this)) {
            hooked.add(this);
            this.addEventListener('progress', () => measure(this));
            this.addEventListener('loadend', () => measure(this, true));
          }
        } else states.delete(this);
      } catch { /* passive */ }
      return result;
    };
    XHR.prototype.send = function(...args) {
      record(states.get(this)?.scope, { transportRequests: 1 });
      return originalSend.apply(this, args);
    };
  }
  if (typeof realm.fetch === 'function') {
    const originalFetch = realm.fetch;
    realm.fetch = function(...args) {
      const info = scope(args[0]);
      if (!info) return originalFetch.apply(this, args);
      record(info, { transportRequests: 1 });
      const pending = originalFetch.apply(this, args);
      // Observe a stream clone incrementally; never buffer a whole response or
      // await measurement before returning the identical business Response.
      void pending.then(response => {
        void (async () => {
          try {
            const reader = response.clone().body?.getReader();
            if (reader) for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              record(info, { transportResponseBytes: value.byteLength });
            }
            record(info, { transportResponses: 1, ...(!response.ok ? { transportFailedResponses: 1 } : {}) });
          } catch { record(info, { transportMeasurementErrors: 1 }); }
        })();
      }, () => record(info, { transportFailedResponses: 1 }));
      return pending;
    };
  }
  return meter;
}
