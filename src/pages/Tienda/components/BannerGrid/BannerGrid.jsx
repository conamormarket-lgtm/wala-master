import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import styles from './BannerGrid.module.css';
import { T } from '../../../../i18n/useTranslatedText';

const brandSlug = (brand) => {
  if (brand?.slug) return String(brand.slug).replace(/^\/+|\/+$/g, '');
  return String(brand?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
};

const initials = (name) => String(name || '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((word) => word[0])
  .join('')
  .toUpperCase();

const BRAND_PALETTES = [
  ['#5b21b6', '#8b5cf6', '#ddd6fe'],
  ['#9f1239', '#f43f5e', '#ffe4e6'],
  ['#075985', '#0ea5e9', '#e0f2fe'],
  ['#065f46', '#10b981', '#d1fae5'],
  ['#9a3412', '#f97316', '#ffedd5'],
  ['#1e3a8a', '#4f46e5', '#e0e7ff'],
];

/**
 * Cuántas COLUMNAS caben de verdad según el ancho. El ajuste del builder
 * (`columns`) manda en escritorio; en pantallas chicas se recorta, porque 3
 * columnas en un móvil dejarían las tarjetas ilegibles.
 */
const columnasSegunAncho = (deseadas) => {
  if (typeof window === 'undefined') return deseadas;
  if (window.matchMedia('(max-width: 560px)').matches) return 1;
  if (window.matchMedia('(max-width: 900px)').matches) return Math.min(2, deseadas);
  return deseadas;
};

/**
 * Cómo se llena una página para que queden EXACTAMENTE dos filas.
 *
 * La cuenta no es "tantas tarjetas": la tarjeta ancha ocupa DOS columnas, así
 * que lo que hay que cuadrar son UNIDADES de columna (cols x 2 filas). Con 3
 * columnas y 6 tarjetas salían 8 unidades, o sea tres filas — que es lo que se
 * veía de más.
 *
 *   cols=3 -> 6 unidades: [ancha][angosta] / [angosta][ancha]  = 4 tarjetas
 *   cols=4 -> 8 unidades: [ancha][ang][ang] / [ang][ang][ancha] = 6 tarjetas
 *   cols=2 -> 4 unidades: [ancha] / [angosta][angosta]          = 3 tarjetas
 *   cols=1 -> 2 unidades: una debajo de otra, sin anchas        = 2 tarjetas
 *
 * `anchas` son las posiciones DENTRO de la página que llevan la tarjeta ancha;
 * al reiniciarse en cada página, todas se ven con el mismo ritmo.
 */
const EMPAQUE_POR_COLUMNAS = {
  1: { porPagina: 2, anchas: [] },
  2: { porPagina: 3, anchas: [0] },
  3: { porPagina: 4, anchas: [0, 3] },
  4: { porPagina: 6, anchas: [0, 5] },
};

const prefiereSinMovimiento = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Mosaico promocional con dos fuentes:
 * - manual: conserva el comportamiento histórico de banners con imagen.
 * - brands: se sincroniza con tienda_brands y enlaza a cada landing de marca.
 *
 * En modo `brands` el bloque ya NO crece hacia abajo sin fin ni deja tarjetas
 * cortadas en el borde: las marcas se reparten en PÁGINAS de dos filas, cada
 * una del ancho exacto del contenedor. Se pasa de página sola cada X segundos
 * (configurable en el builder), y también con las flechas o los puntos.
 *
 * Que la página mida justo el ancho del contenedor es lo que garantiza que
 * nunca se vea media tarjeta: no hay nada a medio salir, se ven las 6 (o las
 * que entren) completas y quietas.
 *
 * El patrón del mosaico se calcula DENTRO de cada página (índice local), así
 * cada una arranca con su tarjeta ancha y el ritmo ancha/angosta se repite
 * igual en todas.
 */
const BannerGrid = ({ config = {}, items = [], brands = [], columns = 3, gap = '1rem' }) => {
  const automatic = config.dataSource === 'brands';
  const valid = useMemo(() => (automatic
    ? (brands || [])
      .filter((brand) => brand?.name && brandSlug(brand) && brand.active !== false && brand.visible !== false)
      .map((brand) => ({
        id: brand.id || brandSlug(brand),
        name: brand.name,
        imageUrl: brand.logoUrl || brand.imageUrl || '',
        link: `/${brandSlug(brand)}`,
        alt: `Explorar productos de ${brand.name}`,
        backgroundColor: brand.bgColor || '',
        backgroundImage: brand.bgImage || '',
      }))
    : (items || []).filter((it) => it && it.imageUrl)), [automatic, brands, items]);

  const colsDeseadas = Math.min(4, Math.max(1, Number(columns) || 3));

  // ── Paginación (solo modo marcas) ─────────────────────────────────────
  const [cols, setCols] = useState(() => columnasSegunAncho(colsDeseadas));
  const [pagina, setPagina] = useState(0);
  const [enPausa, setEnPausa] = useState(false);

  useEffect(() => {
    const recalcular = () => setCols(columnasSegunAncho(colsDeseadas));
    recalcular();
    window.addEventListener('resize', recalcular);
    return () => window.removeEventListener('resize', recalcular);
  }, [colsDeseadas]);

  // Dos filas siempre: es el tope que pedía el bloque para no estirar la home.
  const empaque = EMPAQUE_POR_COLUMNAS[cols] || EMPAQUE_POR_COLUMNAS[3];
  const porPagina = empaque.porPagina;
  const paginas = useMemo(() => {
    const out = [];
    for (let i = 0; i < valid.length; i += porPagina) out.push(valid.slice(i, i + porPagina));
    return out;
  }, [valid, porPagina]);

  const total = paginas.length;

  // Si cambia el ancho (y con él cuántas caben), la página actual puede quedar
  // fuera de rango: se vería un hueco en blanco.
  useEffect(() => {
    setPagina((p) => (p > total - 1 ? Math.max(0, total - 1) : p));
  }, [total]);

  const autoPlay = config.autoPlay !== false;
  const velocidad = Math.max(2000, Number(config.autoPlaySpeed) || 6000);

  useEffect(() => {
    if (!automatic || !autoPlay || total <= 1 || enPausa || prefiereSinMovimiento()) return undefined;
    const id = setInterval(() => setPagina((p) => (p + 1) % total), velocidad);
    return () => clearInterval(id);
  }, [automatic, autoPlay, total, enPausa, velocidad]);

  const irA = useCallback((i) => {
    if (total <= 0) return;
    setPagina(((i % total) + total) % total);
  }, [total]);

  const renderManualImage = (it) => (
    <img
      src={toDirectImageUrl(it.imageUrl)}
      alt={it.alt || 'Banner'}
      className={styles.img}
      loading="lazy"
      decoding="async"
    />
  );

  const renderLink = (item, content, className, key, style) => {
    if (item.link && typeof item.link === 'string' && /^https?:\/\//i.test(item.link)) {
      return <a key={key} href={item.link} target="_blank" rel="noopener noreferrer" className={className} style={style}>{content}</a>;
    }
    if (item.link) return <Link key={key} to={item.link} className={className} style={style}>{content}</Link>;
    return <div key={key} className={className} style={style}>{content}</div>;
  };

  // indiceGlobal: para el número (01, 02…) y la paleta, que deben seguir la
  // lista completa. indiceEnPagina: para el ritmo ancha/angosta del mosaico,
  // que se reinicia en cada página para que todas se vean igual de llenas.
  const renderCelda = (item, indiceGlobal, indiceEnPagina) => {
    if (!automatic) {
      return renderLink(item, renderManualImage(item), styles.cell, item.id || indiceGlobal);
    }

    const palette = BRAND_PALETTES[indiceGlobal % BRAND_PALETTES.length];
    const brandStyle = {
      '--brand-start': item.backgroundColor || palette[0],
      '--brand-end': palette[1],
      '--brand-soft': palette[2],
      backgroundImage: item.backgroundImage
        ? `linear-gradient(120deg, rgba(15,23,42,.86), rgba(15,23,42,.34)), url(${toDirectImageUrl(item.backgroundImage)})`
        : undefined,
    };
    const content = (
      <>
        <span className={styles.worldNumber} aria-hidden="true">
          {String(indiceGlobal + 1).padStart(2, '0')}
        </span>
        <div className={styles.brandVisual}>
          {item.imageUrl ? (
            <img src={toDirectImageUrl(item.imageUrl)} alt={item.alt} className={styles.brandLogo} loading="lazy" decoding="async" />
          ) : (
            <span className={styles.brandFallback} aria-hidden="true">{initials(item.name)}</span>
          )}
        </div>
        <div className={styles.brandCopy}>
          <span className={styles.brandEyebrow}><T>Universo Walá</T></span>
          {config.showBrandName !== false && (
            <h3 className={styles.brandName}>{item.name}</h3>
          )}
          <span className={styles.brandCta}>
            <T>Explorar colección</T> <span className={styles.brandArrow} aria-hidden="true">→</span>
          </span>
        </div>
      </>
    );
    return renderLink(
      item,
      content,
      `${styles.brandCell} ${empaque.anchas.includes(indiceEnPagina) ? styles.brandFeatured : ''} ${
        config.brandCardStyle === 'outline'
          ? styles.brandOutline
          : config.brandCardStyle === 'uniform'
            ? styles.brandUniform
            : styles.brandEditorial
      }`,
      item.id || indiceGlobal,
      brandStyle
    );
  };

  if (valid.length === 0) return null;

  const encabezado = (config.title || config.subtitle) && (
    <header className={styles.header}>
      {config.title && <h2 className={styles.title} style={{ color: config.titleColor || undefined }}><T>{config.title}</T></h2>}
      {config.subtitle && <p className={styles.subtitle} style={{ color: config.subtitleColor || undefined }}><T>{config.subtitle}</T></p>}
    </header>
  );

  // Modo manual: se mantiene EXACTAMENTE como estaba (mosaico que crece hacia
  // abajo). Son banners contados y puestos a mano; no hay nada que acotar.
  if (!automatic) {
    return (
      <div className={styles.section}>
        {encabezado}
        <div className={styles.grid} style={{ '--cols': colsDeseadas, gap }}>
          {valid.map((item, index) => renderCelda(item, index, index))}
        </div>
      </div>
    );
  }

  const variasPaginas = total > 1;

  return (
    <div className={styles.section}>
      {encabezado}
      <div
        className={styles.carousel}
        onMouseEnter={() => setEnPausa(true)}
        onMouseLeave={() => setEnPausa(false)}
        onFocusCapture={() => setEnPausa(true)}
        onBlurCapture={() => setEnPausa(false)}
      >
        {variasPaginas && (
          <button
            type="button"
            className={`${styles.navButton} ${styles.navPrev}`}
            onClick={() => irA(pagina - 1)}
            aria-label="Marcas anteriores"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        )}

        <div className={styles.viewport}>
          <div
            className={styles.track}
            style={{ width: `${total * 100}%`, transform: `translateX(-${(100 / total) * pagina}%)` }}
          >
            {paginas.map((grupo, iPagina) => (
              <div
                className={styles.page}
                key={`pagina-${iPagina}`}
                style={{ width: `${100 / total}%` }}
                aria-hidden={iPagina !== pagina}
              >
                <div className={styles.grid} style={{ '--cols': cols, gap }}>
                  {grupo.map((item, iLocal) => renderCelda(item, iPagina * porPagina + iLocal, iLocal))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {variasPaginas && (
          <button
            type="button"
            className={`${styles.navButton} ${styles.navNext}`}
            onClick={() => irA(pagina + 1)}
            aria-label="Más marcas"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        )}
      </div>

      {variasPaginas && (
        <div className={styles.dots} role="tablist" aria-label="Páginas de marcas">
          {paginas.map((_, i) => (
            <button
              key={`punto-${i}`}
              type="button"
              role="tab"
              aria-selected={i === pagina}
              aria-label={`Página ${i + 1} de ${total}`}
              className={`${styles.dot} ${i === pagina ? styles.dotActive : ''}`}
              onClick={() => irA(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BannerGrid;
