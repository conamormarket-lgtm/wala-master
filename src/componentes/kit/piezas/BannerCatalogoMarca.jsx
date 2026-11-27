import React from 'react';
import { atributosDeFoto } from '../../../components/common/OptimizedImage/OptimizedImage';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import s from './BannerCatalogoMarca.module.css';

/** Banner compacto del catálogo: la portada y el logo originales de la marca. */
export function BannerCatalogoMarca({ nombre, logo, imagen, superpuesto }) {
  return (
    <section className={[s.banner, superpuesto && s.conSuperpuesto].filter(Boolean).join(' ')} aria-label={nombre} data-banner-catalogo="">
      {imagen && (
        <img
          className={s.productos}
          {...atributosDeFoto(toDirectImageUrl(imagen), '(max-width: 600px) 600px, 100vw')}
          alt={`Productos de ${nombre}`}
          loading="eager"
          decoding="async"
          fetchpriority="high"
        />
      )}
      <h1 className={s.logo}>
        {logo ? (
          <img {...atributosDeFoto(toDirectImageUrl(logo), '(max-width: 600px) 120px, 240px')} alt={nombre} loading="eager" decoding="async" />
        ) : nombre}
      </h1>
      {superpuesto && <div className={s.superpuesto}>{superpuesto}</div>}
    </section>
  );
}
