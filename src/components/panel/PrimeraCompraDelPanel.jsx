import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBrands } from '../../services/brands';
import { configPrimeraCompra, listaPrimeraCompra, revertirPremioPrimeraCompra } from '../../services/primeraCompra';
import { PaginaPrimeraCompraAdmin } from '../../componentes/kit/paginas/admin/Bienvenida';

/**
 * /admin/primera-compra: la promo "Tu primera compra puede salir gratis" con
 * PaginaPrimeraCompraAdmin del kit. Todo pasa por el servidor
 * (functions/primeraCompra.js): la config vive en loyaltyConfig y las fases y
 * premios en subcolecciones del perfil, que el navegador no puede leer.
 */
export default function PrimeraCompraDelPanel() {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ['admin-primera-compra-config'], queryFn: () => configPrimeraCompra() });
  const lista = useQuery({ queryKey: ['admin-primera-compra-lista'], queryFn: listaPrimeraCompra });
  const marcas = useQuery({ queryKey: ['brands'], queryFn: async () => (await getBrands()).data || [], staleTime: 300_000 });
  const error = config.error || lista.error;
  return (
    <PaginaPrimeraCompraAdmin
      config={config.data?.config}
      marcas={(marcas.data || []).map((m) => ({ id: m.id, nombre: m.name || m.nombre || m.id }))}
      premios={lista.data?.premios || []}
      fases={lista.data?.fases || []}
      cargando={config.isLoading || lista.isLoading}
      error={error ? error.message || 'No se pudo cargar la promo.' : undefined}
      onReintentar={() => { config.refetch(); lista.refetch(); }}
      onGuardar={async (cambios) => {
        const r = await configPrimeraCompra(cambios);
        queryClient.setQueryData(['admin-primera-compra-config'], r);
      }}
      onRevertir={async (p) => {
        await revertirPremioPrimeraCompra(p.invitadorUid, p.id);
        await queryClient.invalidateQueries({ queryKey: ['admin-primera-compra-lista'] });
      }}
    />
  );
}
