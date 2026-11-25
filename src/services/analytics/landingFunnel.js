import { productoLandingDeCompra } from '../../utils/checkoutOrigin.mjs';
import { productRoute } from '../../utils/productRoute.mjs';
import { createDocument } from '../firebase/firestore';
import { debeRegistrarAnalitica, ensureAnalyticsSession, getAnonymousId, getClientType } from './tracker';
import { createLandingFunnelTracker } from './landingFunnel.mjs';

let record;
/** Fire-and-forget: analytics never blocks navigation, popups or payment. */
export function trackLandingFunnel(step, { location = window.location, productName } = {}) {
  try {
    if (!debeRegistrarAnalitica()) return;
    const landingId = productoLandingDeCompra(location);
    if (!landingId) return;
    const isLanding = productRoute(location.pathname)?.landing;
    if (step === 'landing' ? !isLanding : step === 'cart' ? !/^\/carrito\/?$/.test(location.pathname) : !/^\/checkout\/?$/.test(location.pathname)) return;
    if (!record) {
      let storage;
      try { storage = window.sessionStorage; } catch { /* Memory fallback. */ }
      record = createLandingFunnelTracker({ storage, send: async (event) => {
        const sessionId = await ensureAnalyticsSession();
        if (!debeRegistrarAnalitica()) return null;
        return createDocument('analytics_events', { ...event, sessionId, clientType: getClientType() });
      } });
    }
    void record({ step, landingId, anonymousId: getAnonymousId(), productName });
  } catch { /* Analytics must never interrupt a purchase. */ }
}
