import { isLumiCart, isLumiCatalogLandingPath, isLumiProduct } from '../../utils/catalogLanding.mjs';
import { createDocument } from '../firebase/firestore';
import { debeRegistrarAnalitica, ensureAnalyticsSession, getAnonymousId, getClientType } from './tracker';
import { createLumiFunnelTracker } from './lumiFunnel.mjs';

let record;
export function trackLumiFunnel(step, { location = window.location, ...details } = {}) {
  try {
    if (!debeRegistrarAnalitica()) return;
    const catalog = isLumiCatalogLandingPath(location.pathname);
    const product = isLumiProduct(location);
    const cart = isLumiCart(location);
    if (['catalog', 'brand'].includes(step) ? !catalog : step === 'product' ? !product : step === 'add' ? !(catalog || product) : !cart) return;
    if (!record) {
      let storage;
      try { storage = window.sessionStorage; } catch { /* memory fallback */ }
      record = createLumiFunnelTracker({ storage, send: async event => {
        const sessionId = await ensureAnalyticsSession({}, '/lumi/landing');
        if (!sessionId || !debeRegistrarAnalitica()) return null;
        return createDocument('analytics_events', { ...event, sessionId, clientType: getClientType() });
      } });
    }
    void record({ step, anonymousId: getAnonymousId(), details }).catch(() => {});
  } catch { /* Analytics never blocks shopping or the WhatsApp link. */ }
}
