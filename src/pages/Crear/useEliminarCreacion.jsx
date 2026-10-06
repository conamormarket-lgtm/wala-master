import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { eliminarCreacion } from '../../services/designs';
import { quitarBorradorDeCache } from './borradoresCache';
import styles from './EliminarCreacion.module.css';

/**
 * Eliminar una creación para siempre, con su confirmación. Lo usan la página
 * de la creación, Mis creaciones y "Tus creaciones" en Crear.
 *
 *   const { pedir, dialogo } = useEliminarCreacion({ alEliminar });
 *   pedir(diseno, { enPedido })  → abre la confirmación
 *   {dialogo}                    → se renderiza donde sea (va en un portal)
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

  const pedir = (diseno, { enPedido = false } = {}) => setPendiente({ diseno, enPedido });
  const cerrar = () => { if (!borrando) setPendiente(null); };

  useEffect(() => {
    if (!pendiente) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  });

  const enCarrito = pendiente
    ? (items || []).filter((i) => i.customization?.designId === pendiente.diseno.id)
    : [];
  const enPedido = Boolean(pendiente && (pendiente.enPedido || pendiente.diseno.enPedido));
  const esBorrador = pendiente?.diseno.estado === 'borrador';

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

  const dialogo = pendiente ? createPortal(
    <div className={styles.capa} role="dialog" aria-modal="true" aria-labelledby="eliminar-creacion-titulo" onClick={cerrar}>
      <div className={styles.caja} onClick={(e) => e.stopPropagation()}>
        <span className={styles.icono}><Trash2 size={22} aria-hidden="true" /></span>
        <h2 id="eliminar-creacion-titulo" className={styles.titulo}>
          {esBorrador ? '¿Eliminar este borrador?' : `¿Eliminar «${pendiente.diseno.name || 'Mi diseño'}»?`}
        </h2>
        <p>
          {enPedido
            ? 'Se borra de tus creaciones para siempre. Como ya está en un pedido, guardamos sus imágenes para imprimirlo.'
            : 'Se borra para siempre junto con sus imágenes. No se puede deshacer.'}
        </p>
        {enCarrito.length > 0 && <p>También se quitará de tu carrito.</p>}
        <button type="button" className={styles.eliminar} onClick={confirmar} disabled={borrando}>
          {borrando
            ? <><Loader2 size={18} className={styles.girando} aria-hidden="true" /> Eliminando…</>
            : <><Trash2 size={18} aria-hidden="true" /> Eliminar</>}
        </button>
        <button type="button" className={styles.cancelar} onClick={cerrar} disabled={borrando}>Cancelar</button>
      </div>
    </div>,
    document.body
  ) : null;

  return { pedir, dialogo, borrando };
};

export default useEliminarCreacion;
