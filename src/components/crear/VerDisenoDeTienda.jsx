import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { PaginaVerDiseno } from '../../componentes/kit/paginas/VerDiseno';

/*
 * Ver diseño (/ver/:id) con el kit (paso 6, CREAR.md P10): el diseño que
 * pidió un cliente, para quien abre el enlace del WhatsApp (sin sesión). Lo
 * mismo que VerDisenoPage: verDisenoCompartido (el servidor solo responde
 * creaciones que ya están en un pedido o publicadas), 5 min de caché, un
 * reintento. Nuevo (del kit): "Copiar resumen" y la foto en grande.
 * Lo de antes: pages/Crear/VerDisenoViejo.jsx (interruptor crearViejo).
 */
export default function VerDisenoDeTienda() {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ['ver-diseno', id],
    queryFn: async () => (await httpsCallable(getFunctions(), 'verDisenoCompartido')({ id })).data,
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return (
    <PaginaVerDiseno
      titulo={q.data?.titulo}
      piezas={q.data?.piezas || []}
      cargando={q.isLoading}
      noDisponible={q.isError}
    />
  );
}
