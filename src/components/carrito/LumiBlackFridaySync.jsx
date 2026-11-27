import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { doc, onSnapshot } from '../../services/firebase/observed';
import { db } from '../../services/firebase/config';
import { clearProductCaches } from '../../services/products';
import { isLumiCart, isLumiProduct, isLumiCatalogLandingPath } from '../../utils/catalogLanding.mjs';
import { LUMI_BLACK_FRIDAY, LUMI_PRICE_QUERY_KEYS } from '../../utils/lumiBlackFriday.mjs';

/** One tiny public status document updates open catalog/product/cart screens
 * only after the server has committed the real catalog prices atomically. */
export default function LumiBlackFridaySync() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const handled = useRef(false);
  const enabled = isLumiCatalogLandingPath(location.pathname) || /^\/lumi\/?$/.test(location.pathname)
    || isLumiCart(location) || isLumiProduct(location);
  useEffect(() => {
    if (!enabled || !db || handled.current) return undefined;
    return onSnapshot(doc(db, 'storeConfig', LUMI_BLACK_FRIDAY.id), snapshot => {
      if (handled.current || snapshot.data()?.status !== 'complete') return;
      handled.current = true;
      clearProductCaches();
      void queryClient.invalidateQueries({ predicate: q => LUMI_PRICE_QUERY_KEYS.has(q.queryKey[0]), refetchType: 'all' });
    }, error => { console.warn('No se pudo sincronizar la promoción de Lumi:', error.code); });
  }, [enabled, queryClient]);
  return null;
}
