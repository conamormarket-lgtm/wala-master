import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getProduct } from '../../services/products';
import { isComboProduct } from '../../utils/comboProductUtils';

/**
 * Las prendas de un combo (nombre, colores, tallas, fotos), con el mismo
 * orden que ProductDetail: la caché de React Query primero, la red solo si
 * hace falta.
 *  - activo: false para no pedirlas todavía ("Agregar rápido" cerrado)
 * → { porIndice: { [i]: producto }, porId: { [productId]: producto },
 *     listas: todas llegaron (sin eso no se agrega el combo),
 *     terminado: ya se pidieron todas (aunque alguna no haya llegado) }
 */
export default function usePiezasDelCombo(product, activo = true) {
  const queryClient = useQueryClient();
  const [porIndice, setPorIndice] = useState({});
  const [terminado, setTerminado] = useState(false);
  const esCombo = isComboProduct(product);
  const items = product?.comboItems;
  // Al volver a pedirlas por el mismo producto (se actualizó en segundo plano)
  // no se vuelve al esqueleto: solo con otro producto o al abrir la hoja.
  const pedidoDe = useRef(null);

  useEffect(() => {
    const cual = `${activo}-${product?.id}`;
    if (pedidoDe.current !== cual) { pedidoDe.current = cual; setTerminado(false); }
    if (!activo || !esCombo || !items?.length) { setPorIndice({}); setTerminado(true); return undefined; }
    let cancelado = false;
    (async () => {
      const resultados = await Promise.all(items.map(async (item, i) => {
        try {
          let sub = queryClient.getQueryData(['product', item.productId]);
          if (!sub) {
            const lista = queryClient.getQueryData(['products', null, '', 'name']);
            if (Array.isArray(lista)) sub = lista.find((p) => p.id === item.productId);
          }
          if (!sub) sub = (await getProduct(item.productId)).data;
          return sub ? { i, sub } : null;
        } catch (err) {
          console.warn('[usePiezasDelCombo] No se pudo cargar la prenda del combo', item.productId, err);
          return null;
        }
      }));
      if (cancelado) return;
      const siguiente = {};
      resultados.forEach((r) => { if (r) siguiente[r.i] = r.sub; });
      setPorIndice(siguiente);
      setTerminado(true);
    })();
    return () => { cancelado = true; };
  }, [activo, esCombo, product?.id, items, queryClient]);

  const porId = useMemo(
    () => Object.fromEntries(Object.entries(porIndice).map(([i, sub]) => [items?.[i]?.productId, sub]).filter(([k]) => k)),
    [porIndice, items],
  );
  const listas = !esCombo || (items || []).every((_, i) => porIndice[i]);
  return { porIndice, porId, listas, terminado };
}
