import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './VisualCategoryNav.module.css';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';

/**
 * Navegación visual de categorías (burbujas con miniatura).
 *
 * DOS MODOS (retrocompatibles):
 *  1) MODO ENLACE (por defecto, cabecera global): NO se pasa `onSelectCategory`.
 *     Cada burbuja es un <Link to=/tienda?categoria=ID> y el activo se deriva de
 *     la URL. Es el comportamiento histórico — no cambia.
 *  2) MODO FILTRO LOCAL (storefront por marca): se pasa `onSelectCategory`.
 *     Cada burbuja es un <button> que llama onSelectCategory(cat.categoryId);
 *     la burbuja "Todos" llama onSelectCategory(null). El activo se resalta
 *     comparando con `activeCategory` (no con la URL). No navega: solo filtra
 *     el catálogo de la MISMA página en cliente.
 *
 * @param {Array}  categories       Items del nav. En modo enlace: {id,name,imageUrl}.
 *                                   En modo filtro: {categoryId,name,imageUrl}.
 * @param {boolean} loading         Muestra el skeleton.
 * @param {Function} onSelectCategory  (categoryId|null)=>void. Si está presente,
 *                                   activa el MODO FILTRO LOCAL.
 * @param {string|null} activeCategory  Categoría activa en modo filtro (para resaltar).
 * @param {'left'|'center'|'right'|'justify'} [align='center']  Alineación de las
 *                                   burbujas dentro del contenedor (justify-content).
 * @param {'static'|'slider'} [animation='static']  Modo de presentación:
 *                                   'static' = fila scrolleable (como hoy);
 *                                   'slider' = auto-scroll suave en bucle (marquee),
 *                                   sin romper el clic-para-filtrar.
 */

// Mapea la alineación al valor de justify-content del contenedor.
const ALIGN_TO_JUSTIFY = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
  justify: 'space-between',
};

const VisualCategoryNav = ({
  categories,
  loading,
  onSelectCategory,
  activeCategory = null,
  align = 'center',
  animation = 'static',
}) => {
  const location = useLocation();

  // ¿Estamos en modo filtro local? (hay handler de selección)
  const isFilterMode = typeof onSelectCategory === 'function';

  // Normaliza props de estilo (retrocompat: valores inválidos → default actual).
  const safeAlign = ALIGN_TO_JUSTIFY[align] ? align : 'center';
  const isSlider = animation === 'slider';
  // Clase de alineación para el track interno (no rompe el scroll en overflow:
  // usa auto-margins/justify que colapsan a flex-start cuando el contenido excede).
  const alignClass =
    safeAlign === 'left'
      ? styles.alignLeft
      : safeAlign === 'right'
      ? styles.alignRight
      : safeAlign === 'justify'
      ? styles.alignJustify
      : styles.alignCenter;

  // Activo según el modo: en filtro se compara con activeCategory; en enlace, con la URL.
  const isActive = (categoryId) => {
    if (isFilterMode) return activeCategory === categoryId;
    const params = new URLSearchParams(location.search);
    return params.get('categoria') === categoryId;
  };

  if (loading) {
    return (
      <div className={styles.skeletonContainer}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={styles.skeletonItem}></div>
        ))}
      </div>
    );
  }

  // Inicial (letra) para el placeholder cuando la categoría no tiene imageUrl.
  // Con el nav AUTO-derivado muchas categorías pueden no tener imagen: en vez de
  // una foto de stock no relacionada, mostramos una burbuja con la inicial del
  // nombre. Nunca rompe (sin nombre -> '·').
  const getInitial = (name) => {
    const trimmed = String(name || '').trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : '·';
  };

  // Color de fondo estable derivado del texto (mismo nombre -> mismo color), para
  // que las burbujas sin imagen no se vean todas iguales pero sí consistentes.
  const placeholderColor = (seed) => {
    const str = String(seed || '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 72%)`;
  };

  // Id de la categoría según el modo: en filtro usamos categoryId; en enlace, id.
  const getCatId = (cat) => (isFilterMode ? cat.categoryId : cat.id);

  // Icono "cuadrícula" reutilizado por la burbuja "Todos".
  const allIcon = (
    <div className={styles.allIcon}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
    </div>
  );

  // Renderiza el conjunto de burbujas (Todos + categorías). `keyPrefix` permite
  // duplicar el set en modo slider (clones para el marquee) con keys únicas. Los
  // clones NO se ocultan a clics: pulsarlos llama al mismo handler (no rompe el
  // clic-para-filtrar). En modo enlace se omite el "Todos" del clon para no repetir
  // un Link duplicado innecesario, pero las categorías sí se clonan.
  const renderItems = (keyPrefix = '') => (
    <>
      {/* Item "Todos" */}
      {isFilterMode ? (
        // Modo filtro: botón que limpia la categoría (null = sin filtro).
        <button
          type="button"
          key={`${keyPrefix}all`}
          className={`${styles.navItem} ${activeCategory === null ? styles.active : ''}`}
          style={{ background: 'none', border: 'none', padding: 0 }}
          onClick={() => onSelectCategory(null)}
        >
          <div className={styles.imageBubble}>{allIcon}</div>
          <span className={styles.label}>Todos</span>
        </button>
      ) : (
        // Modo enlace: link a la tienda global sin categoría.
        <Link
          key={`${keyPrefix}all`}
          to="/tienda"
          className={`${styles.navItem} ${location.pathname === '/tienda' && !location.search ? styles.active : ''}`}
        >
          <div className={styles.imageBubble}>{allIcon}</div>
          <span className={styles.label}>Todos</span>
        </Link>
      )}

      {/* Categorías */}
      {categories?.map((category, idx) => {
        const catId = getCatId(category);
        // Con imagen: miniatura real. Sin imagen (común en nav AUTO-derivado):
        // burbuja con la inicial del nombre y color estable (no rompe el layout).
        const bubble = (
          <>
            <div className={styles.imageBubble}>
              {category.imageUrl ? (
                <OptimizedImage
                  src={category.imageUrl}
                  alt={category.name}
                  containerClassName={styles.imageContainer}
                  className={styles.image}
                  objectFit="cover"
                />
              ) : (
                <div
                  className={styles.initialBubble}
                  style={{ backgroundColor: placeholderColor(category.name || catId) }}
                  aria-hidden="true"
                >
                  {getInitial(category.name)}
                </div>
              )}
            </div>
            <span className={styles.label}>{category.name}</span>
          </>
        );

        // Modo filtro: botón que fija la categoría de esta página (cliente).
        if (isFilterMode) {
          return (
            <button
              type="button"
              key={`${keyPrefix}${catId || idx}`}
              className={`${styles.navItem} ${isActive(catId) ? styles.active : ''}`}
              style={{ background: 'none', border: 'none', padding: 0 }}
              onClick={() => onSelectCategory(catId)}
            >
              {bubble}
            </button>
          );
        }

        // Modo enlace (retrocompat con la cabecera global).
        return (
          <Link
            key={`${keyPrefix}${catId || idx}`}
            to={`/tienda?categoria=${catId}`}
            className={`${styles.navItem} ${isActive(catId) ? styles.active : ''}`}
          >
            {bubble}
          </Link>
        );
      })}
    </>
  );

  // MODO SLIDER: las burbujas se desplazan solas en bucle (marquee). Se duplica el
  // set (copia 'a-' y 'b-') para que el bucle sea continuo: el track se traslada
  // -50% (= ancho de una copia) y al reiniciar el salto es invisible. Ambas copias
  // son clicables (mismo handler) → no rompe el clic-para-filtrar. La animación se
  // pausa al pasar el cursor. La alineación no aplica en este modo.
  if (isSlider) {
    return (
      <div className={`${styles.container} ${styles.sliderMode}`}>
        <nav className={styles.navWrapper}>
          <div className={styles.sliderViewport}>
            <div className={styles.sliderTrack}>
              <div className={styles.sliderGroup}>{renderItems('a-')}</div>
              <div className={styles.sliderGroup}>{renderItems('b-')}</div>
            </div>
          </div>
        </nav>
      </div>
    );
  }

  // MODO ESTÁTICO (por defecto): fila scrolleable. El track interno aplica la
  // alineación elegida (left/center/right/justify) con auto-margins/justify que
  // colapsan a flex-start cuando hay overflow → nunca clipea ni rompe el scroll.
  // Sin props (cabecera global) → alignCenter, idéntico al comportamiento histórico.
  return (
    <div className={styles.container}>
      <nav className={styles.navWrapper}>
        <div className={styles.scrollArea}>
          <div className={`${styles.scrollTrack} ${alignClass}`}>
            {renderItems()}
          </div>
        </div>
      </nav>
    </div>
  );
};

export default VisualCategoryNav;
