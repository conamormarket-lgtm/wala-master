import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getProduct } from '../../services/products';
import { isComboProduct } from '../../utils/comboProductUtils';

const combinar = (consultas) => ({
  productos: consultas.map((q) => q.data),
  terminado: consultas.every((q) => q.isFetched || q.isError),
});

/**
 * Las prendas actuales del combo, compartidas por tarjeta, ficha y compra.
 * La caché de React Query evita repetir lecturas y se revalida si envejece;
 * las copias de nombre/foto en comboItems solo sirven como respaldo visual.
 * activo: false mientras la tarjeta no se ve o la hoja está cerrada.
 */
export default function usePiezasDelCombo(product, activo = true) {
  const esCombo = isComboProduct(product);
  const items = esCombo ? product.comboItems || [] : [];
  const ids = [...new Set(items.map((it) => it.productId).filter(Boolean))];
  const datos = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['product', id],
      enabled: activo,
      staleTime: 60 * 1000,
      queryFn: async () => {
        const resultado = await getProduct(id);
        if (resultado.error || !resultado.data) throw new Error(resultado.error || 'Producto no encontrado');
        return resultado.data;
      },
    })),
    combine: combinar,
  });
  // combine conserva sus referencias si solo cambia el estado de la petición.
  // Así la ficha no vuelve a componer su galería en cada render.
  return useMemo(() => {
    const piezas = esCombo ? product?.comboItems || [] : [];
    const porId = {};
    if (activo) datos.productos.forEach((sub) => { if (sub) porId[sub.id] = sub; });
    const porIndice = {};
    piezas.forEach((it, i) => { if (porId[it.productId]) porIndice[i] = porId[it.productId]; });
    const listas = !esCombo || piezas.every((_, i) => porIndice[i]);
    return { porIndice, porId, listas, terminado: !activo || datos.terminado };
  }, [activo, esCombo, product?.comboItems, datos]);
}
