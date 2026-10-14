import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCart } from '../../contexts/CartContext';
import { versionesReemplazadas, cuidarVersionesReemplazadas } from '../../services/misCombos';

/**
 * Las versiones anteriores de las prendas de los combos del cliente (ver
 * versionesReemplazadas) y su mantenimiento: una vez por visita, con las
 * creaciones y los borradores ya cargados, marca desde cuándo están fuera y
 * borra las que pasaron los días. `listo` = las dos listas cargaron bien (con
 * una a medias, una prenda en uso podría parecer reemplazada).
 */
export const useVersionesReemplazadas = ({ uid, creaciones, borradores, listo, alBorrar }) => {
  const { items } = useCart();
  const queryClient = useQueryClient();
  const hecho = useRef(null);
  // Sin repetidos: una lista puede traer también lo de la otra.
  const todos = useMemo(
    () => [...new Map([...creaciones, ...borradores].map((d) => [d.id, d])).values()],
    [creaciones, borradores],
  );
  const versiones = useMemo(() => versionesReemplazadas(todos), [todos]);

  useEffect(() => {
    if (!uid || !listo || hecho.current === uid) return;
    hecho.current = uid;
    const enCarrito = new Set((items || []).map((i) => i.customization?.designId).filter(Boolean));
    cuidarVersionesReemplazadas(uid, { todos, enCarrito }).then((borradas) => {
      if (!borradas.length) return;
      alBorrar?.(borradas);
      queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['mis-borradores-crear'], refetchType: 'all' });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, listo, todos]);

  return versiones;
};
