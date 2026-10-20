import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { useConfirmar } from '../../componentes/kit/Feedback';
import { eliminarMiComboConPrendas } from '../../services/misCombos';
import { retirarDeComunidad } from '../../services/comunidad';
import { disenosEnCarrito, leerMetaArmado, olvidarArmado } from './comboCrear';

/** Lo que se avisa antes de eliminar un combo (además de lo de siempre). */
export const notasEliminarCombo = (combo, items) => {
  const usadas = disenosEnCarrito(items);
  return [
    combo?.comunidad === 'publicada' && 'Está publicado en la comunidad: también se retira de la galería.',
    (items || []).some((i) => i.customization?.miComboId === combo?.id)
      || (combo?.piezas || []).some((p) => usadas.has(p.designId))
      ? 'Está en tu carrito: ahí sigue para que puedas comprarlo.' : null,
  ].filter(Boolean);
};

/**
 * Eliminar "Mi combo" (con su confirmación) desde Crear, Mis creaciones y Tus
 * borradores: se van el combo y sus prendas; si está comprado o en el carrito
 * se archiva (ver eliminarMiComboConPrendas). Devuelve los ids que ya no se
 * ven (el combo y las prendas borradas) y los de las creaciones sueltas que
 * se habían elegido para él (siguen en la lista).
 * Con `{ confirmado: true }` no pregunta (la tarjeta del kit ya lo hizo).
 */
export const useEliminarMiCombo = () => {
  const { user } = useAuth();
  const { items } = useCart();
  const toast = useGlobalToast();
  const confirmar = useConfirmar();
  const queryClient = useQueryClient();
  return async (combo, { confirmado = false } = {}) => {
    if (!user) return null;
    const nombre = combo.name || 'Mi combo';
    const notas = notasEliminarCombo(combo, items);
    if (!confirmado && !(await confirmar({
      titulo: `¿Eliminar el combo "${nombre}" y sus prendas?`,
      texto: ['Se borran también sus prendas. Si está en un pedido o en tu carrito, ahí conserva sus diseños.', ...notas].join(' '),
      confirmar: 'Eliminar',
      peligro: true,
    }))) return null;
    // Publicado: primero se retira (la publicación se busca por el id del
    // combo; sin él quedaba en la galería sin forma de retirarla).
    if (combo.comunidad === 'publicada') {
      const { error: errorRetirar } = await retirarDeComunidad(combo.id);
      if (errorRetirar) {
        toast.error(`No pudimos retirarlo de la comunidad, así que no lo eliminamos. ${errorRetirar}`);
        return null;
      }
    }
    const enCarrito = disenosEnCarrito(items);
    const { error, borradas, sueltas, archivado } = await eliminarMiComboConPrendas(user.uid, combo, { enCarrito });
    if (error) {
      toast.error(error);
      return null;
    }
    // El navegador recordaba este combo: al volver a abrirlo se seguía
    // guardando en uno que ya no existe (y lo diseñado se perdía).
    if (combo.comboId && leerMetaArmado(combo.comboId).miComboId === combo.id) olvidarArmado(combo.comboId);
    queryClient.removeQueries({ queryKey: ['creacion', combo.id] });
    queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['mis-borradores-crear'], refetchType: 'all' });
    toast.success(sueltas.length
      ? 'Combo eliminado. Las creaciones tuyas que elegiste para él siguen en tus creaciones.'
      : archivado ? 'Combo eliminado. Tu pedido o tu carrito conserva sus diseños.'
        : 'Combo eliminado con sus prendas.');
    return { quitadas: [combo.id, ...borradas], sueltas };
  };
};
