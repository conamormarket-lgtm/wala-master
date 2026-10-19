import { useQuery } from '@tanstack/react-query';
import { listarComunidad } from '../../services/comunidad';

/**
 * La galería (pública, sin sesión). Se vuelve a pedir cada vez que se muestra
 * (mientras, la de caché): con refetchOnMount: false global, una publicación
 * actualizada no se veía hasta recargar. El servidor ya la tiene en caché.
 */
export const useComunidad = () => useQuery({
  queryKey: ['comunidad'],
  queryFn: listarComunidad,
  staleTime: 60 * 1000,
  refetchOnMount: 'always',
});
