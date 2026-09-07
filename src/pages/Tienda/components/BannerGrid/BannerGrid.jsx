import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import styles from './BannerGrid.module.css';

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
 * Mosaico promocional con dos fuentes:
 * - manual: conserva el comportamiento histórico de banners con imagen.
 * - brands: se sincroniza con tienda_brands y enlaza a cada landing de marca.
 *
 * En modo `brands` el mosaico ya NO crece hacia abajo sin fin: se acota a DOS
 * FILAS y el resto se alcanza desplazándose en horizontal (ver .scroller en el
 * CSS). Con 6 marcas daba igual, pero con 20 la home se volvía interminable.
 * Las tarjetas son exactamente las mismas — solo cambia cómo se acomodan.
 */
const BannerGrid = ({ config = {}, items = [], brands = [], columns = 3, gap = '1rem' }) => {
  const automatic = config.dataSource === 'brands';
  const valid = automatic
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
    : (items || []).filter((it) => it && it.imageUrl);

  // ── Desplazamiento horizontal (solo modo marcas) ──────────────────────
  // Las flechas aparecen solo si hay algo fuera de vista, y cada una se apaga
  // al llegar a su extremo: con pocas marcas el bloque se ve igual que antes,
  // sin controles de adorno.
  const scrollerRef = useRef(null);
  const [puedeIzq, setPuedeIzq] = useState(false);
  const [puedeDer, setPuedeDer] = useState(false);

  const revisarBordes = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // 2px de margen: el ancho de scroll puede quedar en fracciones de píxel y
    // dejaría una flecha encendida que ya no desplaza nada.
    setPuedeIzq(el.scrollLeft > 2);
    setPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    revisarBordes();
    el.addEventListener('scroll', revisarBordes, { passive: true });
    // Al cambiar el ancho (rotar el móvil, redimensionar la ventana) puede
    // aparecer o desaparecer el desbordamiento.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(revisarBordes) : null;
    if (ro) ro.observe(el);
    return () => {
      el.removeEventListener('scroll', revisarBordes);
      if (ro) ro.disconnect();
    };
  }, [revisarBordes, valid.length]);

  const desplazar = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Casi una pantalla, dejando un resto visible como pista de que sigue.
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  if (valid.length === 0) return null;

  const cols = Math.min(4, Math.max(1, Number(columns) || 3));

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

  const celdas = valid.map((item, index) => {
    if (!automatic) {
      return renderLink(item, renderManualImage(item), styles.cell, item.id || index);
    }

    const palette = BRAND_PALETTES[index % BRAND_PALETTES.length];
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
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className={styles.brandVisual}>
          {item.imageUrl ? (
            <img src={toDirectImageUrl(item.imageUrl)} alt={item.alt} className={styles.brandLogo} loading="lazy" decoding="async" />
          ) : (
            <span className={styles.brandFallback} aria-hidden="true">{initials(item.name)}</span>
          )}
        </div>
        <div className={styles.brandCopy}>
          <span className={styles.brandEyebrow}>Universo Walá</span>
          {config.showBrandName !== false && (
            <h3 className={styles.brandName}>{item.name}</h3>
          )}
          <span className={styles.brandCta}>
            Explorar colección <span className={styles.brandArrow} aria-hidden="true">→</span>
          </span>
        </div>
      </>
    );
    return renderLink(
      item,
      content,
      `${styles.brandCell} ${index % 3 === 0 ? styles.brandFeatured : ''} ${
        config.brandCardStyle === 'outline'
          ? styles.brandOutline
          : config.brandCardStyle === 'uniform'
            ? styles.brandUniform
            : styles.brandEditorial
      }`,
      item.id || index,
      brandStyle
    );
  });

  const encabezado = (config.title || config.subtitle) && (
    <header className={styles.header}>
      {config.title && <h2 className={styles.title} style={{ color: config.titleColor || undefined }}>{config.title}</h2>}
      {config.subtitle && <p className={styles.subtitle} style={{ color: config.subtitleColor || undefined }}>{config.subtitle}</p>}
    </header>
  );

  // Modo manual: se mantiene EXACTAMENTE como estaba (mosaico que crece hacia
  // abajo). Son banners contados y puestos a mano; no hay nada que acotar.
  if (!automatic) {
    return (
      <div className={styles.section}>
        {encabezado}
        <div className={styles.grid} style={{ '--cols': cols, gap }}>
          {celdas}
        </div>
      </div>
    );
  }

  const sinDesborde = !puedeIzq && !puedeDer;

  return (
    <div className={styles.section}>
      {encabezado}
      <div className={styles.carousel}>
        <button
          type="button"
          className={`${styles.navButton} ${styles.navPrev}`}
          onClick={() => desplazar(-1)}
          disabled={!puedeIzq}
          hidden={sinDesborde}
          aria-label="Ver marcas anteriores"
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>

        <div
          className={styles.scroller}
          ref={scrollerRef}
          role="region"
          aria-label={config.title || 'Marcas'}
          tabIndex={0}
        >
          <div className={styles.rail} style={{ gap }}>
            {celdas}
          </div>
        </div>

        <button
          type="button"
          className={`${styles.navButton} ${styles.navNext}`}
          onClick={() => desplazar(1)}
          disabled={!puedeDer}
          hidden={sinDesborde}
          aria-label="Ver más marcas"
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default BannerGrid;
