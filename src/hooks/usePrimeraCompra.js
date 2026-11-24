import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { tieneCuenta } from '../utils/rutaPrivada';
import { estadoPrimeraCompra } from '../services/primeraCompra';

export const CLAVE_PRIMERA_COMPRA = 'primeraCompra';

/**
 * La semana de bienvenida de la cuenta (promo "Tu primera compra puede salir
 * gratis"): { promo, fase, saldo, pendiente, enPausa, premios } o null (sin
 * cuenta, o mientras carga). La primera lectura de una cuenta nueva la empieza
 * en el servidor. Se comparte en toda la tienda (una sola llamada por minuto).
 */
export default function usePrimeraCompra() {
  const { user } = useAuth();
  const conCuenta = tieneCuenta(user);
  const { data, isLoading, refetch } = useQuery({
    queryKey: [CLAVE_PRIMERA_COMPRA, user?.uid],
    queryFn: estadoPrimeraCompra,
    enabled: conCuenta,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  return { bienvenida: conCuenta ? data || null : null, cargando: conCuenta && isLoading, recargar: refetch };
}
