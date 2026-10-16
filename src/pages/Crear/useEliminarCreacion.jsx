import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { eliminarCreacion } from '../../services/designs';
import { quitarBorradorDeCache } from './borradoresCache';
// La confirmación con el kit (paso 3 de la migración; antes, CapaModal).
import { Confirmar } from '../../componentes/kit/Feedback';

/**
 * Eliminar una creación para siempre, con su confirmación. Lo usan la página
 * de la creación, Mis creaciones y "Tus creaciones" en Crear.
 *
 *   const { pedir, dialogo } = useEliminarCreacion({ alEliminar });
 *   pedir(diseno, { enPedido })  → abre la confirmación
 *   {dialogo}                    → se renderiza donde sea (Confirmar del kit)
 *
 * También quita la creación del carrito: sin ella, el artículo quedaría
 * apuntando a imágenes que ya no existen.
 */
export const useEliminarCreacion = ({ alEliminar } = {}) => {
  const { user } = useAuth();
  const { items, removeFromCart } = useCart();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const [pendiente, setPendiente] = useState(null);
  const [borrando, setBorrando] = useState(false);

  // El último pedido se recuerda para que la ventana se vaya con sus textos.
  const ultimo = useRef(null);
  if (pendiente) ultimo.current = pendiente;
  const visto = pendiente || ultimo.current;

  const pedir = (diseno, { enPedido = false } = {}) => setPendiente({ diseno, enPedido });
  const cerrar = () => { if (!borrando) setPendiente(null); };

  const enCarrito = visto
    ? (items || []).filter((i) => i.customization?.designId === visto.diseno.id)
    : [];
  const enPedido = Boolean(visto && (visto.enPedido || visto.diseno.enPedido));
  const esBorrador = visto?.diseno.estado === 'borrador';

  const confirmar = async () => {
    if (!user || !pendiente) return;
    const { diseno } = pendiente;
    setBorrando(true);
    const { error } = await eliminarCreacion(user.uid, diseno, { conservarArchivos: enPedido });
    setBorrando(false);
    if (error) {
      toast.error(`No pudimos eliminar tu creación: ${error}`);
      return;
    }
    enCarrito.forEach((i) => removeFromCart(i.id));
    quitarBorradorDeCache(queryClient, user.uid, diseno.id);
    queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['mis-borradores-crear'], refetchType: 'all' });
    queryClient.removeQueries({ queryKey: ['creacion', diseno.id] });
    setPendiente(null);
    toast.success(diseno.estado === 'borrador' ? 'Borrador eliminado.' : 'Creación eliminada.');
    alEliminar?.(diseno);
  };

  // Mientras borra, Confirmar queda bloqueada (no se cierra) y el botón cargando.
  const notas = [
    enCarrito.length > 0 && 'También se quitará de tu carrito.',
    visto?.diseno.comunidad === 'publicada' && 'Está publicada en la comunidad: la publicación seguirá ahí. Para quitarla, retírala antes.',
  ].filter(Boolean);
  const dialogo = (
    <Confirmar
      abierta={Boolean(pendiente)}
      titulo={!visto ? '' : esBorrador ? '¿Eliminar este borrador?' : `¿Eliminar «${visto.diseno.name || 'Mi diseño'}»?`}
      texto={enPedido
        ? 'Se borra de tus creaciones para siempre. Ya está en un pedido: el pedido conserva su diseño tal como lo compraste.'
        : 'Se borra para siempre junto con sus imágenes. No se puede deshacer.'}
      confirmar="Eliminar"
      peligro
      onConfirmar={confirmar}
      onCancelar={cerrar}
    >
      {notas.length ? notas.map((n) => <p key={n}>{n}</p>) : null}
    </Confirmar>
  );

  return { pedir, dialogo, borrando };
};

export default useEliminarCreacion;
