import React from 'react';
import styles from './ProductCardSkeleton.module.css';

/**
 * ProductCardSkeleton — placeholder del tamaño/forma real de una
 * PremiumProductCard (foto 3:4 + título + precio), mismo lenguaje visual
 * (shimmer diagonal sobre base violeta translúcida) que ya usa PageLoading
 * como fallback de <Suspense>.
 *
 * Por qué existe: CollectionCarousel, FlashSales y FeaturedCarousel hacían
 * (o reciben por prop) su propio fetch de productos y, mientras tanto,
 * mostraban solo una línea de texto ("Cargando colección...") en vez de un
 * espacio del tamaño final — cuando los productos llegaban, la sección
 * "saltaba" de una línea de texto a una fila completa de tarjetas (layout
 * shift), y como cada carrusel resuelve en un instante distinto, se sentía
 * como que la página aparecía "a poco" (efecto popcorn). Con este skeleton
 * el espacio ya está ahí desde el principio: se ve un carrusel/fila real,
 * solo que placeholder, así que cuando los datos llegan las tarjetas se
 * revelan en su lugar en vez de empujar el layout.
 *
 * No trae su propio contenedor/grid: se usa DENTRO de las mismas clases de
 * layout que ya tiene cada carrusel (`.carouselItem`, `.flashSalesProducts`,
 * etc.) para heredar exactamente el mismo tamaño responsive que las
 * tarjetas reales, sin duplicar esas reglas.
 */
const ProductCardSkeleton = () => (
  <div className={styles.card} aria-hidden="true">
    <div className={styles.image} />
    <div className={styles.line} style={{ width: '75%' }} />
    <div className={styles.line} style={{ width: '40%' }} />
  </div>
);

export default ProductCardSkeleton;
