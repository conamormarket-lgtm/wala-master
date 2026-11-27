import { collection, getDocs, query, where, orderBy, limit } from './firebase/observed';
import { db } from './firebase/config';
import { aggregateLumiFunnel, LUMI_FUNNEL_EVENT } from './analytics/lumiFunnel.mjs';

export async function getLumiFunnel(range) {
  const snap = await getDocs(query(collection(db, 'analytics_events'),
    where('type', '==', LUMI_FUNNEL_EVENT),
    where('clientTsMs', '>=', range.startDateMs), where('clientTsMs', '<=', range.endDateMs),
    orderBy('clientTsMs', 'desc'), limit(9001)));
  if (snap.size > 9000) throw new Error('Este periodo supera los 9 000 eventos de Lumi. Elige un rango de fechas más corto para ver cifras completas.');
  return aggregateLumiFunnel(snap.docs.map(doc => doc.data()), range);
}
