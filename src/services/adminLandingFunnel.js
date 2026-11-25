import { collection, getDocs, query, where, orderBy, limit } from './firebase/observed';
import { db } from './firebase/config';
import { aggregateLandingFunnel, LANDING_FUNNEL_EVENT } from './analytics/landingFunnel.mjs';

// Dedicated type/range query uses the existing type + clientTsMs index.
// A visible cap prevents an expensive read or silently reporting partial totals.
// Production rejects structured queries with a limit above 10 000, including
// the extra document used to detect truncation.
const MAX_EVENTS = 9000;
export async function getLandingFunnel(range) {
  const snap = await getDocs(query(collection(db, 'analytics_events'),
    where('type', '==', LANDING_FUNNEL_EVENT),
    where('clientTsMs', '>=', range.startDateMs),
    where('clientTsMs', '<=', range.endDateMs),
    orderBy('clientTsMs', 'desc'), limit(MAX_EVENTS + 1)));
  if (snap.size > MAX_EVENTS) throw new Error('Este periodo supera los 9 000 eventos de landing. Elige un rango de fechas más corto para ver cifras completas.');
  return aggregateLandingFunnel(snap.docs.map((doc) => doc.data()), range);
}
