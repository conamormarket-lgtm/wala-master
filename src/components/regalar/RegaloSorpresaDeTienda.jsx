import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOrderGiftDetails } from '../../services/erp/firebase';
import { PaginaRegaloSorpresa } from '../../componentes/kit/paginas/Regalar';

/*
 * Abrir un regalo (/regalo/:orderId), paso 6 de la migración:
 * PaginaRegaloSorpresa del kit. Lo de antes, en GiftExperienceViejo.jsx
 * (interruptor regalarViejo).
 *
 * La abre quien recibe el regalo, con o sin cuenta: obtenerRegaloSecure
 * devuelve solo para quién es, el mensaje y el sticker. En la app (Capacitor)
 * invita a la tienda; en la web, a descargar Walá (/descargar, sin recargar).
 * El Kapi flotante no sale aquí: el del sobre es el único a la vista.
 */

const enLaApp = () => Boolean(window.Capacitor?.isNativePlatform?.());

export default function RegaloSorpresaDeTienda() {
  const { orderId } = useParams();
  const { data: regalo, isPending } = useQuery({
    queryKey: ['regalo', orderId],
    queryFn: async () => (await getOrderGiftDetails(orderId)).data || null,
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(orderId),
  });

  let estado;
  if (isPending) estado = 'cargando';
  else if (!regalo) estado = 'noEncontrado';

  return (
    <PaginaRegaloSorpresa
      estado={estado}
      regalo={regalo ? { para: regalo.recipientName, mensaje: regalo.message, sticker: regalo.sticker || undefined } : undefined}
      enApp={enLaApp()}
    />
  );
}
