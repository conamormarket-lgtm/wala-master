import React, { useState, useEffect, useRef } from 'react';
import { Filter, X } from 'lucide-react';
import ProductGrid from './ProductGrid';
import styles from './SidebarCatalogLayout.module.css';
// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line no-unused-vars
import { useQuery } from '@tanstack/react-query';
import { getCollections } from '../../../services/collections';
import { getBrands } from '../../../services/brands';
import { getTags } from '../../../services/tags';
import { getCharacters } from '../../../services/characters';
import { getProductTypes } from '../../../services/productTypes';
// i18n: t() para textos estáticos; <T> para nombres dinámicos de la BD.
import { useLanguage } from '../../../contexts/LanguageContext';
import { T } from '../../../i18n/useTranslatedText';

const SidebarCatalogLayout = ({
  productsData,
  productsLoading,
  productsError,
  emptyMessage,
  categories,
  layoutConfig,
  title,
  // ── Paginación servidor (Fase 3 · C-1) — opcionales, retrocompatibles ──
  // paginationProps     : { hasMore, onLoadMore, isFetchingMore } para el grid.
  // onServerFacetChange : empuja UNA faceta (categoría) al servidor para acotar
  //                       las páginas que se traen con cursor. Si no se pasa, el
  //                       filtrado sigue siendo 100% en cliente como antes.
  // serverFacet         : faceta actualmente filtrada en servidor (o null).
  paginationProps = {},
  onServerFacetChange,
  serverFacet = null,
  // ── Categoría controlada desde fuera (nav de categorías por marca) ─────
  // Si se pasa `controlledCategory` (string id o null) Y `onCategoryChange`,
  // la categoría activa del sidebar pasa a estar CONTROLADA por el padre
  // (TiendaPage): el estado vive arriba y se comparte con VisualCategoryNav,
  // de modo que pulsar una burbuja del nav y pulsar una categoría del sidebar
  // operan sobre el MISMO filtro de cliente. Si NO se pasan (caso de hoy), el
  // sidebar usa su estado interno EXACTAMENTE como antes (retrocompatible).
  controlledCategory,
  onCategoryChange,
}) => {
  const { t } = useLanguage();
  const isCategoryControlled = controlledCategory !== undefined && typeof onCategoryChange === 'function';
  const [internalCategory, setInternalCategory] = useState(null);
  // Categoría efectiva: la controlada por el padre o, si no, el estado interno.
  const activeCategory = isCategoryControlled ? (controlledCategory ?? null) : internalCategory;
  // Setter unificado: escribe arriba (controlado) o en el estado interno (no controlado).
  const setActiveCategory = (value) => {
    if (isCategoryControlled) onCategoryChange(value ?? null);
    else setInternalCategory(value);
  };
  const [activeCollection, setActiveCollection] = useState(null);
  const [activeBrand, setActiveBrand] = useState(null);
  const [activeTag, setActiveTag] = useState(null);
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [activeType, setActiveType] = useState(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // ── Grupos desplegables (acordeón) del sidebar ─────────────────────────
  // Guarda qué grupos están colapsados por id. Solo afecta la PRESENTACIÓN:
  // el filtrado de productos no cambia. Los grupos largos ('etiquetas',
  // 'personajes') arrancan colapsados para limpiar el sidebar; el resto abierto.
  const [gruposColapsados, setGruposColapsados] = useState({
    etiquetas: true,
    personajes: true,
  });
  const toggleGrupo = (id) => setGruposColapsados(g => ({ ...g, [id]: !g[id] }));

  // Prevenir scroll en el body cuando el drawer esté abierto
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileDrawerOpen]);

  // ── Sincroniza la categoría activa con la faceta de servidor ──────────
  // Cuando hay paginación por cursor (onServerFacetChange definido), al elegir
  // una categoría se acota la query del catálogo a esa categoría
  // (categories array-contains) para no traer páginas de productos que el filtro
  // de cliente descartaría. El resto de facetas (colección/marca/tag/personaje/
  // tipo) se siguen aplicando en cliente sobre las páginas cargadas.
  //
  // LÍMITE CONOCIDO (documentado): si un producto antiguo guardó la categoría
  // solo como `category` (string) y NO en `categories[]`, la query server-side
  // por `array-contains` no lo devolvería. El filtro de cliente conserva esa
  // ruta legacy (p.categoryId/p.category), por lo que NO se rompe el caso común;
  // solo afecta a docs legacy sin migrar bajo paginación con cursor. La búsqueda
  // facetada combinada a escala se delega a un motor externo (fuera de alcance).
  const serverFacetType = serverFacet?.type ?? null;
  const serverFacetValue = serverFacet?.value ?? null;
  useEffect(() => {
    if (typeof onServerFacetChange !== 'function') return;
    const nextValue = activeCategory || null;
    const nextType = activeCategory ? 'category' : null;
    // Evita re-disparar si la faceta de servidor ya coincide.
    if (nextValue === serverFacetValue && nextType === serverFacetType) return;
    onServerFacetChange(activeCategory ? { type: 'category', value: activeCategory } : null);
  }, [activeCategory, onServerFacetChange, serverFacetValue, serverFacetType]);

  const { data: collections } = useQuery({ queryKey: ['collections'], queryFn: async () => (await getCollections()).data });
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: async () => (await getBrands()).data });
  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: async () => (await getTags()).data });
  const { data: characters } = useQuery({ queryKey: ['characters'], queryFn: async () => (await getCharacters()).data });
  const { data: productTypes } = useQuery({ queryKey: ['productTypes'], queryFn: async () => (await getProductTypes()).data });

  const handleCategoryClick = (catId) => {
    setActiveCategory(catId === activeCategory ? null : catId);
    setIsMobileDrawerOpen(false);
  };

  const handleFilterClick = (setter, id) => {
    setter(prev => prev === id ? null : id);
    setIsMobileDrawerOpen(false);
  };

  // ¿Hay algún filtro activo? (categoría, colección/temporada, marca, tipo, etiqueta, personaje)
  const hasActiveFilters = !!(
    activeCategory || activeCollection || activeBrand ||
    activeType || activeTag || activeCharacter
  );

  // Resetea TODOS los filtros a su estado inicial.
  const clearAllFilters = () => {
    setActiveCategory(null);
    setActiveCollection(null);
    setActiveBrand(null);
    setActiveType(null);
    setActiveTag(null);
    setActiveCharacter(null);
    setIsMobileDrawerOpen(false);
  };

  const idOf = (c) => (c && typeof c === 'object') ? (c.id || c.slug || c.name || '') : c;

  // No existe un campo/colección propio de "temporadas" en el modelo de datos.
  // Las temporadas se modelan como colecciones (drops estacionales: Verano, Navidad, etc.),
  // p. ej. el placeholder del admin de Colecciones es "Summer 2024". Por eso derivamos
  // las temporadas de las mismas colecciones, separando por palabras clave estacionales.
  const SEASON_KEYWORDS = [
    'verano', 'invierno', 'otoño', 'otono', 'primavera',
    'navidad', 'navideno', 'fiestas', 'año nuevo', 'ano nuevo',
    'pascua', 'halloween', 'san valentín', 'san valentin', 'valentín', 'valentin',
    'día de la madre', 'dia de la madre', 'día del padre', 'dia del padre',
    'temporada', 'spring', 'summer', 'autumn', 'fall', 'winter', 'holiday', 'xmas', 'christmas', 'easter'
  ];
  // Raíces intencionalmente parciales: coinciden por prefijo de palabra
  // ('navideñ' -> 'navideña', 'navideño', 'navideñas'...).
  const SEASON_KEYWORD_PREFIXES = ['navideñ'];
  const isSeasonCollection = (c) => {
    const name = String((c && c.name) || '').toLowerCase();
    if (!name) return false;
    // Tokens del nombre separados por cualquier carácter que no sea letra
    // (incluye letras acentuadas y ñ). Evita falsos positivos por substring
    // (p. ej. 'fall' dentro de 'football').
    const tokens = name.split(/[^a-záéíóúüñ]+/i).filter(Boolean);
    const matchesKeyword = SEASON_KEYWORDS.some(k => {
      if (k.includes(' ')) {
        // Frases ('año nuevo', 'san valentín'): palabra completa con límites \b.
        const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`, 'i').test(name);
      }
      // Token único: coincidencia por palabra completa exacta.
      return tokens.includes(k);
    });
    if (matchesKeyword) return true;
    // Raíces parciales por prefijo de token.
    return SEASON_KEYWORD_PREFIXES.some(p => tokens.some(t => t.startsWith(p)));
  };

  const allCollections = collections || [];
  // Temporadas = colecciones cuyo nombre coincide con una palabra clave estacional.
  const seasonCollections = allCollections.filter(isSeasonCollection);
  // Colecciones (no estacionales). Si ninguna coincide como temporada, aquí salen todas.
  const nonSeasonCollections = seasonCollections.length > 0
    ? allCollections.filter(c => !isSeasonCollection(c))
    : allCollections;

  const filteredProducts = (productsData || []).filter(p => {
    if (activeCategory && p.categoryId !== activeCategory && p.category !== activeCategory && !(p.categories || []).map(idOf).includes(activeCategory)) return false;
    if (activeCollection && !(p.collections || []).map(idOf).includes(activeCollection)) return false;
    if (activeBrand && idOf(p.brandId) !== activeBrand) return false;
    if (activeTag && !(p.tags || []).map(idOf).includes(activeTag)) return false;
    if (activeCharacter && !(p.characters || []).map(idOf).includes(activeCharacter)) return false;
    if (activeType && idOf(p.productType) !== activeType) return false;
    return true;
  });

  // ── Componente interno: grupo plegable del sidebar (DRY) ───────────────
  // Renderiza el `.sidebarSection` con un encabezado clicable (h3 + chevron)
  // que alterna el colapso del grupo, y muestra `children` (la <ul>) solo si
  // el grupo NO está colapsado. `forzarAbierto` se usa cuando hay un filtro
  // activo dentro del grupo, para que la selección siempre quede visible.
  const GrupoSidebar = ({ id, titulo, forzarAbierto = false, children }) => {
    const abierto = forzarAbierto || !gruposColapsados[id];
    return (
      <div className={styles.sidebarSection}>
        <h3
          className={styles.grupoHeader}
          role="button"
          tabIndex={0}
          aria-expanded={abierto}
          onClick={() => toggleGrupo(id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleGrupo(id);
            }
          }}
        >
          <span>{titulo}</span>
          <span className={styles.grupoChevron} aria-hidden="true">{abierto ? '▾' : '▸'}</span>
        </h3>
        {abierto && children}
      </div>
    );
  };

  return (
    <div className={styles.catalogWrapper}>
      {title && <h2 className={styles.catalogTitle}>{title}</h2>}
      
      <div className={styles.catalogLayout}>
        {/* BOTÓN MÓVIL (Visible solo en CSS) */}
        <div className={styles.mobileFilterControls}>
          <button 
            className={styles.mobileFilterBtn} 
            onClick={() => setIsMobileDrawerOpen(true)}
          >
            <Filter size={18} /> Filtrar y Categorías
          </button>
        </div>

        {/* OVERLAY FONDO OSCURO (Móvil) */}
        <div 
          className={`${styles.drawerOverlay} ${isMobileDrawerOpen ? styles.overlayVisible : ''}`} 
          onClick={() => setIsMobileDrawerOpen(false)}
        />

        {/* SIDEBAR Izquierdo / Drawer Móvil */}
        <aside className={`${styles.sidebar} ${isMobileDrawerOpen ? styles.sidebarOpen : ''}`}>
          
          <div className={styles.drawerHeader}>
            <h3 style={{ margin: 0 }}>{t('cat.filtros', 'Filtros')}</h3>
            <button className={styles.closeDrawerBtn} onClick={() => setIsMobileDrawerOpen(false)}>
              <X size={24} color="#666" />
            </button>
          </div>

          {hasActiveFilters && (
            <div className={styles.sidebarSection} style={{ marginBottom: '1.5rem' }}>
              <button
                type="button"
                className={styles.mobileFilterBtn}
                onClick={clearAllFilters}
              >
                <X size={18} /> {t('cat.limpiarFiltros', 'Limpiar filtros')}
              </button>
            </div>
          )}

          <GrupoSidebar id="categorias" titulo={t('cat.categorias', 'Categorías')}>
            <ul className={styles.categoryList}>
              <li
                className={activeCategory === null ? styles.activeItem : ''}
                onClick={() => handleCategoryClick(null)}
              >
                {t('cat.todasCategorias', 'Todas las categorías')}
              </li>
              {(categories || []).map(cat => (
                <li
                  key={cat.id}
                  className={activeCategory === cat.id ? styles.activeItem : ''}
                  onClick={() => handleCategoryClick(cat.id)}
                >
                  <T>{cat.name}</T>
                </li>
              ))}
            </ul>
          </GrupoSidebar>

          {/* Temporadas: derivadas de las colecciones estacionales (mismo estado activeCollection). */}
          {seasonCollections.length > 0 && (
            <GrupoSidebar
              id="temporadas"
              titulo={t('cat.temporadas', 'Temporadas')}
              forzarAbierto={seasonCollections.some(c => c.id === activeCollection)}
            >
              <ul className={styles.categoryList}>
                <li className={activeCollection === null ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveCollection, null)}>{t('cat.todas', 'Todas')}</li>
                {seasonCollections.map(c => (
                  <li key={c.id} className={activeCollection === c.id ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveCollection, c.id)}>
                    <T>{c.name}</T>
                  </li>
                ))}
              </ul>
            </GrupoSidebar>
          )}

          {nonSeasonCollections.length > 0 && (
            <GrupoSidebar
              id="colecciones"
              titulo={t('cat.colecciones', 'Colecciones')}
              forzarAbierto={nonSeasonCollections.some(c => c.id === activeCollection)}
            >
              <ul className={styles.categoryList}>
                <li className={activeCollection === null ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveCollection, null)}>{t('cat.todas', 'Todas')}</li>
                {nonSeasonCollections.map(c => (
                  <li key={c.id} className={activeCollection === c.id ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveCollection, c.id)}>
                    <T>{c.name}</T>
                  </li>
                ))}
              </ul>
            </GrupoSidebar>
          )}
          
          {(brands || []).length > 0 && (
            <GrupoSidebar
              id="marcas"
              titulo={t('cat.marcas', 'Marcas')}
              forzarAbierto={!!activeBrand}
            >
              <ul className={styles.brandList}>
                <li className={activeBrand === null ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveBrand, null)}>{t('cat.todas', 'Todas')}</li>
                {(brands || []).map(b => (
                  <li key={b.id} className={activeBrand === b.id ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveBrand, b.id)}>
                    <T>{b.name}</T>
                  </li>
                ))}
              </ul>
            </GrupoSidebar>
          )}
          

          {(productTypes || []).length > 0 && (
            <GrupoSidebar
              id="tipoProducto"
              titulo={t('cat.tipoProducto', 'Tipo de Producto')}
              forzarAbierto={!!activeType}
            >
              <ul className={styles.categoryList}>
                <li className={activeType === null ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveType, null)}>{t('cat.todos', 'Todos')}</li>
                {(productTypes || []).map(pt => (
                  <li key={pt.id} className={activeType === pt.id ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveType, pt.id)}>
                    <T>{pt.name}</T>
                  </li>
                ))}
              </ul>
            </GrupoSidebar>
          )}

          {(tags || []).length > 0 && (
            <GrupoSidebar
              id="etiquetas"
              titulo={t('cat.etiquetas', 'Etiquetas')}
              forzarAbierto={!!activeTag}
            >
              <ul className={styles.categoryList}>
                <li className={activeTag === null ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveTag, null)}>{t('cat.todas', 'Todas')}</li>
                {(tags || []).map(tag => (
                  <li key={tag.id} className={activeTag === tag.id ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveTag, tag.id)}>
                    <T>{tag.name}</T>
                  </li>
                ))}
              </ul>
            </GrupoSidebar>
          )}

          {(characters || []).length > 0 && (
            <GrupoSidebar
              id="personajes"
              titulo={t('cat.personajes', 'Personajes')}
              forzarAbierto={!!activeCharacter}
            >
              <ul className={styles.categoryList}>
                <li className={activeCharacter === null ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveCharacter, null)}>{t('cat.todos', 'Todos')}</li>
                {(characters || []).map(c => (
                  <li key={c.id} className={activeCharacter === c.id ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveCharacter, c.id)}>
                    <T>{c.name}</T>
                  </li>
                ))}
              </ul>
            </GrupoSidebar>
          )}
        </aside>

        {/* MAIN Content */}
        <main className={styles.mainContent}>
          <ProductGrid
            products={filteredProducts || []}
            loading={productsLoading}
            error={productsError}
            emptyMessage={emptyMessage}
            categories={categories}
            layoutConfig={layoutConfig}
            {...paginationProps}
          />
        </main>
      </div>
    </div>
  );
};

export default SidebarCatalogLayout;
