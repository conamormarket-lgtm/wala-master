import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProducts, updateProductField } from '../../services/products';
import { getTopSellingWala } from '../../services/salesAnalytics';
import { PaginaDestacados } from '../../componentes/kit/paginas/admin/Destacados';
import { productoAdminDesde } from '../../componentes/kit/adaptadoresAdmin';
import { useLectura, useInvalidar } from './comun';

const productosConOcultos = () => getProducts([], null, null, { includeHidden: true });

/*
 * /admin/destacados (D1): PaginaDestacados con los servicios de
 * AdminDestacados. Destacar pone el producto al final (el mayor orden + 1),
 * quitar deja featuredOrder en 0 y "Guardar orden" escribe 0, 1, 2… Lo más
 * vendido: getTopSellingWala de 30 días (15 min de caché, como antes).
 */
export default function DestacadosDelPanel() {
  const productos = useLectura(['admin-products'], productosConOcultos);
  const invalidar = useInvalidar();
  const top = useQuery({
    queryKey: ['top-selling-wala', 30],
    queryFn: () => getTopSellingWala({ days: 30, topLimit: 10 }),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });

  const lista = useMemo(() => (productos.datos || []).map(productoAdminDesde).filter(Boolean), [productos.datos]);
  const refrescar = () => invalidar(['admin-featured'], ['featured-products'], ['admin-destacados'], ['admin-products'], ['products']);
  const ultimo = () => Math.max(-1, ...lista.filter((p) => p.destacado).map((p) => Number(p.ordenDestacado) || 0));

  return (
    <PaginaDestacados
      productos={lista}
      cargando={productos.cargando}
      error={productos.error}
      onReintentar={productos.onReintentar}
      masVendidos={{
        filas: (top.data?.topByUnits || []).filter((f) => f.productId).map((f) => ({ id: f.productId, unidades: f.units })),
        cargando: top.isLoading,
        error: top.error ? top.error.message : top.data?.error || undefined,
        disponible: top.data?.available !== false,
      }}
      onDestacar={async (id) => {
        await updateProductField(id, { featured: true, featuredOrder: ultimo() + 1 });
        await refrescar();
      }}
      onQuitar={async (id) => {
        await updateProductField(id, { featured: false, featuredOrder: 0 });
        await refrescar();
      }}
      onGuardarOrden={async (ids) => {
        await Promise.all(ids.map((id, i) => updateProductField(id, { featured: true, featuredOrder: i })));
        await refrescar();
      }}
    />
  );
}
