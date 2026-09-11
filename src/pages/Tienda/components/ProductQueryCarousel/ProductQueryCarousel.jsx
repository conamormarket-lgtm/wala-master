import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStoreProductsPage, getProductsByCategory, getOnSaleProducts } from '../../../../services/products';
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
        // Query directa por salePrice (ver getOnSaleProducts): antes pedía
        // los 48 productos más NUEVOS y filtraba esos por oferta, así que
        // una oferta activa en un producto que no está entre los 48 más
        // recientes simplemente no aparecía — con un catálogo grande, la
        // sección podía quedar vacía aunque sí hubiera ofertas.
        const { data } = await getOnSaleProducts(brandId || null);
        return data || [];
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
      brandId={brandId}
    />
  );
};

export default ProductQueryCarousel;
