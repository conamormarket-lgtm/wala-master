import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { eliminarCreacion } from '../../services/designs';
import { comboQueUsa } from '../../services/misCombos';
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
 * Quien ya preguntó (la tarjeta del kit confirma sobre su foto) usa
 * `eliminar(diseno, { enPedido })` → true si se borró: lo mismo, sin la
 * ventana. `notasDe(diseno)` da lo que la confirmación tiene que decir.
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

  // Suelta o como prenda de un combo (la línea del combo no lleva designId
  // propio: antes no se veía y el combo quedaba con imágenes borradas).
  const enCarritoDe = (diseno) => (items || []).filter((i) => i.customization?.designId === diseno?.id
    || (i.customization?.piezas || []).some((p) => p?.designId === diseno?.id));
  const enPedido = Boolean(visto && (visto.enPedido || visto.diseno.enPedido));
  const esBorrador = visto?.diseno.estado === 'borrador';

  /** Lo que la confirmación tiene que decir además del texto (carrito, comunidad). */
  const notasDe = (diseno) => [
    enCarritoDe(diseno).length > 0 && (enCarritoDe(diseno).some((i) => i.customization?.piezas)
      ? 'La usa un combo de tu carrito: el combo también se quitará del carrito.'
      : 'También se quitará de tu carrito.'),
    diseno?.comunidad === 'publicada' && 'Está publicada en la comunidad: la publicación seguirá ahí. Para quitarla, retírala antes.',
  ].filter(Boolean);

  // Borra (ya confirmado): saca la creación del carrito, deja las listas al
  // día y avisa. Lo que está en un pedido conserva sus archivos.
  const eliminar = async (diseno, { enPedido: enPedidoDado = false } = {}) => {
    if (!user || !diseno) return false;
    const conservarArchivos = Boolean(enPedidoDado || diseno.enPedido);
    // Una prenda de un combo se cambia o se elimina desde su combo: borrada
    // sola, el combo quedaba apuntando a nada (sin poder publicarse ni
    // terminarse).
    if (diseno.combo?.id) {
      const combo = await comboQueUsa(user.uid, diseno.id);
      if (combo === undefined) {
        toast.error('No pudimos revisar tus combos. Inténtalo de nuevo.');
        return false;
      }
      if (combo) {
        toast.info(combo.archivado
          ? 'Es una prenda de un combo que eliminaste y está en un pedido o en tu carrito: se guarda para eso.'
          : `Es una prenda de tu combo «${combo.name || 'Mi combo'}»: cámbiala o elimina el combo desde ahí.`);
        return false;
      }
    }
    const deCarrito = enCarritoDe(diseno);
    const { error } = await eliminarCreacion(user.uid, diseno, { conservarArchivos });
    if (error) {
      toast.error(`No pudimos eliminar tu creación: ${error}`);
      return false;
    }
    deCarrito.forEach((i) => removeFromCart(i.id));
    quitarBorradorDeCache(queryClient, user.uid, diseno.id);
    queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['mis-borradores-crear'], refetchType: 'all' });
    queryClient.removeQueries({ queryKey: ['creacion', diseno.id] });
    toast.success(diseno.estado === 'borrador' ? 'Borrador eliminado.' : 'Creación eliminada.');
    alEliminar?.(diseno);
    return true;
  };

  const confirmar = async () => {
    if (!user || !pendiente) return;
    setBorrando(true);
    const hecho = await eliminar(pendiente.diseno, { enPedido });
    setBorrando(false);
    if (hecho) setPendiente(null);
  };

  // Mientras borra, Confirmar queda bloqueada (no se cierra) y el botón cargando.
  const notas = visto ? notasDe(visto.diseno) : [];
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

  return { pedir, dialogo, borrando, eliminar, notasDe };
};

export default useEliminarCreacion;
