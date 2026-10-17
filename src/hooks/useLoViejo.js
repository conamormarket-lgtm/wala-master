import { useQuery } from '@tanstack/react-query';
import { getDocument } from '../services/firebase/firestore';

/*
 * Interruptor de la migración al kit para lo delicado (pagos, carrito,
 * checkout): volver a lo de antes SIN publicar.
 *
 *  - Para todos: en Firestore, configuracion/kit_interruptores con el campo
 *    `<nombre>Viejo: true` (p. ej. pagosViejo, carritoViejo). Lo escribe un
 *    admin desde la consola; los visitantes lo ven al cargar (5 min de caché).
 *  - Para probar en un navegador: localStorage 'wala_kit_viejo' con los
 *    nombres separados por coma ("pagos,carrito").
 *
 * Sin documento, sin campo o si falla la lectura: lo nuevo (el kit).
 * La lista de interruptores y qué cubre cada uno: guia/MIGRACION.md.
 */
const CLAVE_LOCAL = 'wala_kit_viejo';

/** ¿Está puesto en este navegador? (localStorage; también lo mira el arranque de la tienda). */
export const forzadoLocal = (nombre) => {
  try {
    return String(window.localStorage.getItem(CLAVE_LOCAL) || '')
      .split(',').map((x) => x.trim()).includes(nombre);
  } catch {
    return false;
  }
};

export default function useLoViejo(nombre) {
  const { data } = useQuery({
    queryKey: ['kit-interruptores'],
    queryFn: async () => {
      const { data: doc } = await getDocument('configuracion', 'kit_interruptores');
      return doc || {};
    },
    staleTime: 5 * 60 * 1000,
  });
  return forzadoLocal(nombre) || data?.[`${nombre}Viejo`] === true;
}
