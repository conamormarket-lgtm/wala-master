import { getCollection } from './firebase/firestore';

/**
 * Servicio de datos para el VISOR DE MAPA DE CALOR.
 *
 * Lee la colección 'heatmap_events' (escrita por src/hooks/useHeatmapTracker.js).
 * Cada documento tiene la forma:
 *   {
 *     events: [{ x, y, pageX, pageY, screenWidth, screenHeight, path, elementInfo, time }],
 *     timestamp
 *   }
 *
 * Aplana todos los arrays .events, normaliza las coordenadas de clic respecto al
 * viewport (screenWidth/screenHeight) para poder pintarlas sobre un canvas de
 * proporción fija, y agrupa por 'path' (página).
 */

export const HEATMAP_COLLECTION = 'heatmap_events';

// Leemos solo los últimos N documentos para no traer toda la colección.
const DEFAULT_DOCS_LIMIT = 500;

function clamp01(n) {
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Normaliza un evento de clic individual a coordenadas 0..1 respecto al viewport.
 * Devuelve null si el evento no es válido / no se puede normalizar.
 */
function normalizePoint(ev) {
  if (!ev || typeof ev !== 'object') return null;

  const width = Number(ev.screenWidth);
  const height = Number(ev.screenHeight);
  if (!Number.isFinite(width) || width <= 0) return null;
  if (!Number.isFinite(height) || height <= 0) return null;

  const rawX = Number(ev.x);
  const rawY = Number(ev.y);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return null;

  const xNorm = clamp01(rawX / width);
  const yNorm = clamp01(rawY / height);
  if (xNorm === null || yNorm === null) return null;

  return { xNorm, yNorm, weight: 1 };
}

/**
 * Lee y agrega los clics de heatmap agrupados por página (path).
 *
 * @param {Object} [options]
 * @param {number} [options.docsLimit=500] Máximo de documentos a leer.
 * @returns {Promise<{
 *   paths: string[],
 *   pointsByPath: Record<string, Array<{xNorm:number,yNorm:number,weight:number}>>,
 *   topElementsByPath: Record<string, Array<{elementInfo:string,count:number}>>,
 *   totalClicks: number,
 *   totalDocs: number,
 *   error: (string|null)
 * }>}
 */
export async function getHeatmapByPage(options = {}) {
  const docsLimit = Number.isFinite(options.docsLimit) ? options.docsLimit : DEFAULT_DOCS_LIMIT;

  const { data, error } = await getCollection(
    HEATMAP_COLLECTION,
    [],
    { field: 'timestamp', direction: 'desc' },
    docsLimit
  );

  // pointsByPath: path -> [{xNorm,yNorm,weight}]
  const pointsByPath = {};
  // elementCountsByPath: path -> Map(elementInfo -> count)
  const elementCountsByPath = {};
  // clickCountByPath: path -> número total de clics (para ordenar las páginas)
  const clickCountByPath = new Map();

  let totalClicks = 0;
  const docs = data || [];

  docs.forEach((docData) => {
    const events = Array.isArray(docData?.events) ? docData.events : [];
    events.forEach((ev) => {
      const path = (ev && typeof ev.path === 'string' && ev.path.trim()) ? ev.path : 'unknown';

      const point = normalizePoint(ev);
      if (point) {
        if (!pointsByPath[path]) pointsByPath[path] = [];
        pointsByPath[path].push(point);
        totalClicks += 1;
        clickCountByPath.set(path, (clickCountByPath.get(path) || 0) + 1);
      }

      // Ranking de elementos clicados (aunque el punto no se pueda normalizar,
      // el elemento sigue siendo información útil si tenemos elementInfo).
      const elementInfo = (ev && typeof ev.elementInfo === 'string' && ev.elementInfo.trim())
        ? ev.elementInfo.trim()
        : null;
      if (elementInfo) {
        if (!elementCountsByPath[path]) elementCountsByPath[path] = new Map();
        const m = elementCountsByPath[path];
        m.set(elementInfo, (m.get(elementInfo) || 0) + 1);
      }
    });
  });

  // Ordenar las páginas por cantidad de clics (descendente).
  const paths = [...clickCountByPath.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([path]) => path);

  // Asegurar que cualquier path que solo tenga elementos (sin puntos válidos)
  // también aparezca en la lista de páginas.
  Object.keys(elementCountsByPath).forEach((path) => {
    if (!paths.includes(path)) paths.push(path);
  });

  // Construir el ranking de elementos por página.
  const topElementsByPath = {};
  Object.entries(elementCountsByPath).forEach(([path, map]) => {
    topElementsByPath[path] = [...map.entries()]
      .map(([elementInfo, count]) => ({ elementInfo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);
  });

  return {
    paths,
    pointsByPath,
    topElementsByPath,
    totalClicks,
    totalDocs: docs.length,
    error: error || null,
  };
}

export default getHeatmapByPage;
