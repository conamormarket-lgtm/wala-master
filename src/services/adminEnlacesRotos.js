// "Enlaces rotos" (dashboard/paginas): las direcciones que no existen y que la
// gente pidió (eventos page_not_found de analytics/enlacesRotos.js).
//
// Lee directo los page_not_found del rango (índice type + clientTsMs ya
// existente en firestore.indexes.json): son pocos, así que no hace falta
// sumarlos en analytics_daily. Junto con las landings, para marcar las
// direcciones que ya se resolvieron (se creó la landing o se redirigió).
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase/config';
import { getCollection } from './firebase/firestore';
import { ANALYTICS_COLLECTIONS } from './analytics/schema';
import { PAGE_NOT_FOUND } from './analytics/enlacesRotos';
import { agruparEnlacesRotos } from './analytics/enlacesRotosAgrupar.mjs';
import { getLandingPages } from '../pages/Tienda/services/landingPages';

const EVENTOS_LIMITE = 1000;

export async function getEnlacesRotos({ startDateMs, endDateMs }) {
  const [{ data: eventos, error }, landings] = await Promise.all([
    getCollection(
      ANALYTICS_COLLECTIONS.EVENTS,
      [
        { field: 'type', operator: '==', value: PAGE_NOT_FOUND },
        { field: 'clientTsMs', operator: '>=', value: startDateMs },
        { field: 'clientTsMs', operator: '<=', value: endDateMs },
      ],
      { field: 'clientTsMs', direction: 'desc' },
      EVENTOS_LIMITE
    ),
    getLandingPages(),
  ]);
  if (error) return { data: null, error };

  const enlaces = agruparEnlacesRotos(eventos || [], {
    landings,
    hostPropio: typeof window !== 'undefined' ? window.location.host : '',
  });
  return {
    data: {
      enlaces,
      visitas: (eventos || []).length,
      // Se leyeron solo los más recientes: los conteos se quedan cortos.
      truncado: (eventos || []).length >= EVENTOS_LIMITE,
      landings: landings
        .filter((l) => l.slug)
        .map((l) => ({ id: l.id, slug: l.slug, title: l.title || l.slug }))
        .sort((a, b) => a.title.localeCompare(b.title, 'es')),
    },
    error: null,
  };
}

// La dirección vieja pasa a llevar a esa landing: igual que al renombrarla
// (slugsAnteriores), DynamicLandingPage redirige a su URL actual.
export async function redirigirALanding(landingId, slug) {
  try {
    await updateDoc(doc(db, 'landingPages', landingId), {
      slugsAnteriores: arrayUnion(String(slug).toLowerCase()),
      updatedAt: new Date().toISOString(),
    });
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
}
