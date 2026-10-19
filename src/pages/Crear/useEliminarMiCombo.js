import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { useConfirmar } from '../../componentes/kit/Feedback';
import { eliminarMiComboConPrendas } from '../../services/misCombos';

/**
 * Eliminar "Mi combo" (con su confirmación) desde Crear, Mis creaciones y Tus
 * borradores: se van el combo y sus prendas, salvo las que se usan en otro
 * lado (ver eliminarMiComboConPrendas). Devuelve los ids que ya no están (el
 * combo y las prendas borradas) y los de las prendas que quedaron sueltas.
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
    if (!confirmado && !(await confirmar({
      titulo: `¿Eliminar el combo "${nombre}" y sus prendas?`,
      texto: 'Las que uses en otro combo, en un pedido o en el carrito se quedan.',
      confirmar: 'Eliminar',
      peligro: true,
    }))) return null;
    const enCarrito = new Set((items || []).map((i) => i.customization?.designId).filter(Boolean));
    const { error, borradas, sueltas } = await eliminarMiComboConPrendas(user.uid, combo, { enCarrito });
    if (error) {
      toast.error(error);
      return null;
    }
    queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['mis-borradores-crear'], refetchType: 'all' });
    toast.success(sueltas.length
      ? `Combo eliminado. ${sueltas.length === 1 ? 'Una prenda se quedó' : `${sueltas.length} prendas se quedaron`} en tus creaciones porque las usas en otro lado.`
      : 'Combo eliminado con sus prendas.');
    return { quitadas: [combo.id, ...borradas], sueltas };
  };
};
