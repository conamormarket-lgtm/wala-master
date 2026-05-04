import { useQuery } from '@tanstack/react-query';
import { getMessage } from '../services/messages';
import { toDirectImageUrl, getPreviewImageUrl } from '../utils/mascotaImage';

const MASCOTA_KEY = 'mascota_kap_image_url';

/**
 * Devuelve la URL de la imagen de la mascota configurada en Admin > Mascota.
 * Para Drive devuelve thumbnail como principal y uc como fallback (probar la otra si una falla por CORS).
 */
export function useMascotaImageUrl() {
  const { data: savedUrl, isLoading } = useQuery({
    queryKey: ['mascota-image-url'],
    queryFn: async () => {
      const { data } = await getMessage(MASCOTA_KEY);
      return data?.trim() ?? '';
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const previewUrl = savedUrl ? getPreviewImageUrl(savedUrl) : '';
  const directUrl = savedUrl ? toDirectImageUrl(savedUrl) : '';
  // Para Drive: principal thumbnail, fallback uc (o al revés si prefieres)
  const src = previewUrl || directUrl || '';
  const fallbackSrc = (previewUrl && directUrl && previewUrl !== directUrl) ? directUrl : '';
  return { src: src || '', fallbackSrc: fallbackSrc || '', isLoading };
}
