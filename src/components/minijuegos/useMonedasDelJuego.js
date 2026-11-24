import { useAuth } from '../../contexts/AuthContext';
import { tieneCuenta } from '../../utils/rutaPrivada';

/*
 * Las monedas para la barra del juego (MarcoJuego): en el celular, el juego va
 * a pantalla completa sin la cabecera (modo juego), así que el saldo y las
 * monedas que vuelan al ganar se muestran ahí. Sin cuenta, nada. El mismo
 * saldo que la cabecera (activeMainCoins); mientras llega, la píldora vacía.
 */
export default function useMonedasDelJuego() {
  const { user, userProfile, activeMainCoins, loading } = useAuth();
  if (!tieneCuenta(user)) return undefined;
  const cargando = loading || !userProfile || Boolean(userProfile._perfilNoCargado);
  return { saldo: cargando ? null : Math.floor(activeMainCoins || 0), cargando };
}
