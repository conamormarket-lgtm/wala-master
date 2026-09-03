import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStoreProductsPage, getProductsByCategory } from '../../../../services/products';
import FeaturedCarousel from '../FeaturedCarousel/FeaturedCarousel';

/**
 * Carrusel de productos AUTO-CONTENIDO: hace su propia query según `source` y
 * reutiliza FeaturedCarousel (que se auto-oculta si no hay productos). Así se
 * puede añadir varias veces en el builder sin meter hooks dentro del loop de
 * render de TiendaPage.
 *
 * @param {'newest'|'sale'|'category'} source  Fuente de productos.
 * @param {string} categoryId  Categoría (solo para source='category').
 * @param {string} brandId     Marca de la página (acota los productos). '' = global.
 * @param {string} title       Título de la sección.
 * @param {object} config      Settings de la sección (estilos de título/botón).
 * @param {Array}  categories  Categorías (se pasan a las tarjetas).
 * @param {number} visibleItems / autoPlay / autoPlaySpeed  Config del carrusel.
 */
const ProductQueryCarousel = ({
  source = 'newest',
  categoryId = '',
  brandId = '',
  title,
  config,
  categories = [],
  visibleItems = 5,
  autoPlay = false,
  autoPlaySpeed = 5000,
}) => {
  const facet = brandId ? { type: 'brand', value: brandId } : null;

  const { data: products } = useQuery({
    queryKey: ['query-carousel', source, categoryId || null, brandId || null],
    queryFn: async () => {
      if (source === 'category') {
        const { data } = await getProductsByCategory(categoryId, brandId || null);
        return (data || []).slice(0, 24);
      }
      if (source === 'sale') {
        // No hay orden por descuento en el índice; traemos una página y filtramos
        // los que tienen precio de oferta válido (salePrice > 0 y < price).
        const res = await getStoreProductsPage({ facet, sort: 'newest', pageSize: 48 });
        const items = res?.items || [];
        return items
          .filter((p) => Number(p.salePrice) > 0 && Number(p.salePrice) < Number(p.price))
          .slice(0, 24);
      }
      // newest (por defecto): más recientes primero.
      const res = await getStoreProductsPage({ facet, sort: 'newest', pageSize: 12 });
      return res?.items || [];
    },
    enabled: source !== 'category' || !!categoryId,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <FeaturedCarousel
      title={title}
      config={config}
      products={products}
      categories={categories}
      visibleItems={visibleItems}
      autoPlay={autoPlay}
      autoPlaySpeed={autoPlaySpeed}
    />
  );
};

export default ProductQueryCarousel;
