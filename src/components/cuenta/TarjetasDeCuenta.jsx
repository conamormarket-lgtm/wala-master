import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { misTarjetas, borrarTarjeta } from '../../services/tarjetasGuardadas';
import { PaginaTarjetas } from '../../componentes/kit/paginas/Cuenta';

/*
 * Mis tarjetas (/cuenta/tarjetas): las que se guardaron al pagar en el
 * checkout (services/tarjetasGuardadas). Aquí solo se ven y se quitan.
 */
export default function TarjetasDeCuenta() {
  const { user } = useAuth();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const uid = user?.uid;
  const [quitando, setQuitando] = useState(null);

  const consulta = useQuery({
    queryKey: ['tarjetas', uid],
    queryFn: misTarjetas,
    enabled: Boolean(uid),
    staleTime: 0,
  });

  const quitar = async (id) => {
    setQuitando(id);
    try {
      await borrarTarjeta(id);
      queryClient.setQueryData(['tarjetas', uid], (d) => (d ? { ...d, tarjetas: d.tarjetas.filter((t) => t.id !== id) } : d));
      toast.success('Tarjeta quitada.');
    } catch (e) {
      toast.error(e?.message || 'No pudimos quitar la tarjeta. Inténtalo de nuevo.');
    } finally {
      setQuitando(null);
    }
  };

  return (
    <PaginaTarjetas
      tarjetas={consulta.data?.tarjetas || []}
      puede={consulta.data ? consulta.data.puede : true}
      cargando={!consulta.data}
      onQuitar={quitar}
      quitando={quitando}
    />
  );
}
