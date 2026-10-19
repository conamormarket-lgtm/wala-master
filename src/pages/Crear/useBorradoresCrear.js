import { useQuery } from '@tanstack/react-query';
import { getBorradoresCrear } from '../../services/designs';
import { esperarGuardados } from './borradoresCache';

/**
 * Borradores del cliente en Crear (comparten caché con quien los pida).
 * Se vuelven a leer cada vez que se muestran (al retroceder desde el
 * estudio, por ejemplo) y esperan a que termine un guardado en curso.
 */
export const useBorradoresCrear = (uid) => useQuery({
  queryKey: ['mis-borradores-crear', uid],
  enabled: Boolean(uid),
  refetchOnMount: 'always',
  queryFn: async () => {
    await esperarGuardados();
    const { data } = await getBorradoresCrear(uid);
    return data || [];
  },
});
