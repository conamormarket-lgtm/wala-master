// src/hooks/useAdminWalaOrders.js
//
// Hook React Query para el área admin "Recepción de Pedidos".
// Envuelve getWalaOrdersForAdmin (src/services/adminOrders.js) que lee SOLO-LECTURA
// los pedidos del portal WALA desde el ERP (colecciones pedidos_web + pedidos) y los
// normaliza al CONTRATO de tarjeta.
//
// Solo lo usan rutas /admin* (gateadas por AdminRoute → claim admin). No filtra por
// usuario: trae TODOS los pedidos del portal.

import { useQuery } from '@tanstack/react-query';
import { getWalaOrdersForAdmin } from '../services/adminOrders';

/**
 * @param {object} [params]
 * @param {number} [params.limitN=200]        - Máximo de docs leídos por colección.
 * @param {number|null} [params.sinceDays=null] - Solo pedidos de los últimos N días (null = sin límite de fecha).
 * @param {string|null} [params.estado=null]    - Filtra por estado.key (p.ej. 'entregado', 'en_preparacion').
 * @param {object} [options]                   - Overrides opcionales de useQuery (enabled, staleTime…).
 * @returns {import('@tanstack/react-query').UseQueryResult<{
 *   pedidos: Array<object>,
 *   resumen: { total:number, porEntregar:number, pendientesPago:number, enProduccion:number, entregados:number, montoTotal:number },
 *   available: boolean,
 *   error: string|null,
 * }>}
 */
export function useAdminWalaOrders(
  { limitN = 200, sinceDays = null, estado = null } = {},
  options = {}
) {
  return useQuery({
    // La key incluye los parámetros para no colisionar entre vistas/filtros.
    queryKey: ['admin-wala-orders', { limitN, sinceDays, estado }],
    queryFn: () => getWalaOrdersForAdmin({ limitN, sinceDays, estado }),
    // El ERP es lectura costosa; 2 min de frescura evita re-leer en cada montaje.
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
}

export default useAdminWalaOrders;
