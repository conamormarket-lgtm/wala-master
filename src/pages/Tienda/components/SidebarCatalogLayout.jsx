import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { getProductsByBrand } from '../../../services/products';
// i18n: t() para textos estáticos; <T> para nombres dinámicos de la BD.
import { useLanguage } from '../../../contexts/LanguageContext';
import { T } from '../../../i18n/useTranslatedText';

const SidebarCatalogLayout = ({
  productsData,
  productsLoading,
  productsError,
  emptyMessage,
  categories,
  // ── Marca de la página (multimarca) ────────────────────────────────────
  // Si `brandId` está presente (página de marca tipo /MUSSA, /MUEBLERIA), el
  // sidebar AÍSLA sus facetas a esa marca: en vez de mostrar las listas
  // GLOBALES de categorías/colecciones/etiquetas/personajes/tipos (las de Con
  // Amor), DERIVA cada faceta SOLO de las taxonomías presentes en los productos
  // de la marca y las cruza con las listas globales para nombre/imagen (mismo
  // patrón que el categories_nav en TiendaPage.jsx:474-501). Si `brandId` es
  // null/ausente (Con Amor / páginas globales) el comportamiento es EXACTAMENTE
  // el de hoy: listas globales completas (retrocompatible).
  brandId = null,
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
  // ── Categoría inicial desde la URL (?categoria=ID) ─────────────────────
  // Antes, llegar a /tienda?categoria=ID (p.ej. desde el link de una
  // categoría en el mega menu "Tienda") filtraba el catalogo (via
  // getProductsByCategory en TiendaPage) pero el checkbox de "CATEGORÍAS"
  // en este sidebar NO se marcaba — quedaba en "Todas las categorías"
  // porque activeCategory nunca se enteraba del `categoria` de la URL (solo
  // cambia por click, ver setActiveCategory). Solo aplica cuando el sidebar
  // NO esta controlado por el padre (sin categories_nav): ahi el padre ya
  // maneja su propia categoria (navCategoryId), esto no interfiere.
  initialCategory,
}) => {
  const { t } = useLanguage();
  const isCategoryControlled = controlledCategory !== undefined && typeof onCategoryChange === 'function';
  const [internalCategory, setInternalCategory] = useState(initialCategory ?? null);

  useEffect(() => {
    if (isCategoryControlled) return; // el padre ya maneja la categoria (nav bubbles)
    setInternalCategory(initialCategory ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCategory]);
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
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // ── Grupos desplegables (acordeón) del sidebar ─────────────────────────
  // Guarda qué grupos están colapsados por id. Solo afecta la PRESENTACIÓN:
  // el filtrado de productos no cambia. Todos arrancan colapsados, como en un
  // catálogo grande, y cada selección activa fuerza visible solo su grupo.
  const [gruposColapsados, setGruposColapsados] = useState({
    categorias: true,
    temporadas: true,
    colecciones: true,
    marcas: true,
    tipoProducto: true,
    precio: true,
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

  // ── Productos de la marca para derivar las facetas (multimarca) ─────────
  // Solo cuando hay `brandId`. Igual que el categories_nav (TiendaPage.jsx:468),
  // se piden TODOS los productos de la marca (no las páginas paginadas que llegan
  // en productsData, que pueden estar incompletas) para conocer el conjunto REAL
  // de taxonomías presentes en la marca. Sin brandId no se pide nada (enabled:false)
  // y las facetas se quedan con las listas globales de hoy.
  const { data: brandProducts } = useQuery({
    queryKey: ['sidebar-brand-products', brandId],
    queryFn: async () => {
      const { data, error } = await getProductsByBrand(brandId);
      if (error || !Array.isArray(data)) return [];
      return data;
    },
    enabled: !!brandId,
    staleTime: 10 * 60 * 1000,
  });

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
    activeType || activeTag || activeCharacter || minPrice !== '' || maxPrice !== ''
  );

  // Resetea TODOS los filtros a su estado inicial.
  const clearAllFilters = () => {
    setActiveCategory(null);
    setActiveCollection(null);
    setActiveBrand(null);
    setActiveType(null);
    setActiveTag(null);
    setActiveCharacter(null);
    setMinPrice('');
    setMaxPrice('');
    setIsMobileDrawerOpen(false);
  };

  const idOf = (c) => (c && typeof c === 'object') ? (c.id || c.slug || c.name || '') : c;

  // ── AISLAMIENTO DE FACETAS POR MARCA (multimarca) ──────────────────────
  // Réplica del patrón del categories_nav (TiendaPage.jsx:474-501) para CADA
  // taxonomía. Cuando hay `brandId`:
  //   (1) se recolectan los ids DISTINTOS presentes en los PRODUCTOS de la marca
  //       (brandProducts), con la MISMA extracción idOf que usa el filtro de abajo;
  //   (2) se cruza cada id contra su lista GLOBAL (la fuente canónica del paso 1:
  //       categories=prop, collections/tags/characters/productTypes de los servicios)
  //       para obtener name/imageUrl, descartando huérfanos (id sin doc global);
  //   (3) se preserva el ORDEN de la lista global (filter sobre la global), de modo
  //       que el render no cambia salvo por las entradas ocultas.
  // Cuando NO hay `brandId`: se devuelve la lista global TAL CUAL (idéntico a hoy).
  //
  // Helper genérico: filtra `globalList` dejando solo los docs cuyo id esté en
  // `presentIds`. Si `brandId` es null/ausente, devuelve la global sin tocar.
  const filtrarPorMarca = (globalList, presentIds) => {
    const lista = globalList || [];
    if (!brandId) return lista; // Retrocompatible: sin marca, lista global completa.
    return lista.filter((doc) => presentIds.has(idOf(doc)));
  };

  // Conjuntos de ids presentes en los productos de la marca, por taxonomía.
  // Solo se calculan cuando hay brandId (si no, quedan vacíos pero no se usan).
  const idsPresentesMarca = useMemo(() => {
    const cats = new Set();
    const cols = new Set();
    const tgs = new Set();
    const chars = new Set();
    const types = new Set();
    if (brandId) {
      (brandProducts || []).forEach((p) => {
        // Categorías: array categories[] + fallback legacy (categoryId/category),
        // exactamente como el filtro de cliente de abajo y el nav.
        [
          ...(Array.isArray(p.categories) ? p.categories.map(idOf) : []),
          p.categoryId,
          p.category,
        ].forEach((c) => { const v = idOf(c); if (v) cats.add(v); });
        (Array.isArray(p.collections) ? p.collections : []).forEach((c) => { const v = idOf(c); if (v) cols.add(v); });
        (Array.isArray(p.tags) ? p.tags : []).forEach((c) => { const v = idOf(c); if (v) tgs.add(v); });
        (Array.isArray(p.characters) ? p.characters : []).forEach((c) => { const v = idOf(c); if (v) chars.add(v); });
        // productType es ESCALAR (products.js:269), no array.
        const pt = idOf(p.productType); if (pt) types.add(pt);
      });
    }
    return { cats, cols, tgs, chars, types };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, brandProducts]);

  // Listas EFECTIVAS que consume el render. Con brandId: acotadas a la marca.
  // Sin brandId: las globales de hoy (categories=prop; resto de los servicios).
  const categoriesEffective = filtrarPorMarca(categories, idsPresentesMarca.cats);
  const collectionsEffective = filtrarPorMarca(collections, idsPresentesMarca.cols);
  const tagsEffective = filtrarPorMarca(tags, idsPresentesMarca.tgs);
  const charactersEffective = filtrarPorMarca(characters, idsPresentesMarca.chars);
  const productTypesEffective = filtrarPorMarca(productTypes, idsPresentesMarca.types);

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

  // Con brandId, parte de las colecciones acotadas a la marca; sin brandId, de las
  // globales (collectionsEffective ya resuelve ambos casos). Temporadas/colecciones
  // se siguen derivando de aquí, por lo que también quedan aisladas por marca.
  const allCollections = collectionsEffective;
  // Temporadas = colecciones cuyo nombre coincide con una palabra clave estacional.
  const seasonCollections = allCollections.filter(isSeasonCollection);
  // Colecciones (no estacionales). Si ninguna coincide como temporada, aquí salen todas.
  const nonSeasonCollections = seasonCollections.length > 0
    ? allCollections.filter(c => !isSeasonCollection(c))
    : allCollections;

  const getEffectivePrice = (product) => {
    const regular = Number(product?.price) || 0;
    const sale = Number(product?.salePrice) || 0;
    return sale > 0 && (!regular || sale < regular) ? sale : regular;
  };

  const priceBounds = useMemo(() => {
    const source = brandId && (brandProducts || []).length > 0
      ? brandProducts
      : (productsData || []);
    const prices = source.map(getEffectivePrice).filter(price => price >= 0);
    if (prices.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }, [brandId, brandProducts, productsData]);

  const parsedMinPrice = minPrice === '' ? null : Number(minPrice);
  const parsedMaxPrice = maxPrice === '' ? null : Number(maxPrice);

  const filteredProducts = (productsData || []).filter(p => {
    if (activeCategory && p.categoryId !== activeCategory && p.category !== activeCategory && !(p.categories || []).map(idOf).includes(activeCategory)) return false;
    if (activeCollection && !(p.collections || []).map(idOf).includes(activeCollection)) return false;
    if (activeBrand && idOf(p.brandId) !== activeBrand) return false;
    if (activeTag && !(p.tags || []).map(idOf).includes(activeTag)) return false;
    if (activeCharacter && !(p.characters || []).map(idOf).includes(activeCharacter)) return false;
    if (activeType && idOf(p.productType) !== activeType) return false;
    const effectivePrice = getEffectivePrice(p);
    if (parsedMinPrice !== null && Number.isFinite(parsedMinPrice) && effectivePrice < parsedMinPrice) return false;
    if (parsedMaxPrice !== null && Number.isFinite(parsedMaxPrice) && effectivePrice > parsedMaxPrice) return false;
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
        {abierto && (
          <div className={styles.grupoContent}>
            {children}
          </div>
        )}
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

          <div className={styles.desktopFilterHeader}>
            <span className={styles.desktopFilterTitle}>
              <Filter size={17} aria-hidden="true" />
              {t('cat.filtros', 'Filtros')}
            </span>
            {hasActiveFilters && (
              <button type="button" className={styles.clearAllLink} onClick={clearAllFilters}>
                {t('cat.limpiar', 'Limpiar')}
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <div className={styles.mobileClearFilters}>
              <button
                type="button"
                className={styles.mobileFilterBtn}
                onClick={clearAllFilters}
              >
                <X size={18} /> {t('cat.limpiarFiltros', 'Limpiar filtros')}
              </button>
            </div>
          )}

          <GrupoSidebar
            id="categorias"
            titulo={t('cat.categorias', 'Categorías')}
            forzarAbierto={!!activeCategory}
          >
            <ul className={styles.categoryList}>
              <li
                className={activeCategory === null ? styles.activeItem : ''}
                onClick={() => handleCategoryClick(null)}
              >
                {t('cat.todasCategorias', 'Todas las categorías')}
              </li>
              {(categoriesEffective || []).map(cat => (
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

          <GrupoSidebar
            id="precio"
            titulo={t('cat.precio', 'Precio')}
            forzarAbierto={minPrice !== '' || maxPrice !== ''}
          >
            <div className={styles.priceFilter}>
              <div className={styles.priceInputs}>
                <label className={styles.priceField}>
                  <span>{t('cat.desde', 'Desde')}</span>
                  <span className={styles.priceInputWrap}>
                    <span aria-hidden="true">S/</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="1"
                      value={minPrice}
                      placeholder={String(priceBounds.min)}
                      aria-label={t('cat.precioMinimo', 'Precio mínimo')}
                      onChange={(e) => setMinPrice(e.target.value)}
                    />
                  </span>
                </label>
                <span className={styles.priceSeparator} aria-hidden="true">—</span>
                <label className={styles.priceField}>
                  <span>{t('cat.hasta', 'Hasta')}</span>
                  <span className={styles.priceInputWrap}>
                    <span aria-hidden="true">S/</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="1"
                      value={maxPrice}
                      placeholder={String(priceBounds.max)}
                      aria-label={t('cat.precioMaximo', 'Precio máximo')}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </span>
                </label>
              </div>
              {(minPrice !== '' || maxPrice !== '') && (
                <button
                  type="button"
                  className={styles.clearPriceBtn}
                  onClick={() => { setMinPrice(''); setMaxPrice(''); }}
                >
                  {t('cat.quitarPrecio', 'Quitar rango')}
                </button>
              )}
            </div>
          </GrupoSidebar>
          
          {/* El filtro "Marcas" NO se muestra dentro de la tienda de UNA marca
              (brandId): ahí la página ya está fijada a esa marca. Solo aparece en
              páginas globales (sin brandId), como hoy. */}
          {!brandId && (brands || []).length > 0 && (
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
          

          {(productTypesEffective || []).length > 0 && (
            <GrupoSidebar
              id="tipoProducto"
              titulo={t('cat.tipoProducto', 'Tipo de Producto')}
              forzarAbierto={!!activeType}
            >
              <ul className={styles.categoryList}>
                <li className={activeType === null ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveType, null)}>{t('cat.todos', 'Todos')}</li>
                {(productTypesEffective || []).map(pt => (
                  <li key={pt.id} className={activeType === pt.id ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveType, pt.id)}>
                    <T>{pt.name}</T>
                  </li>
                ))}
              </ul>
            </GrupoSidebar>
          )}

          {(tagsEffective || []).length > 0 && (
            <GrupoSidebar
              id="etiquetas"
              titulo={t('cat.etiquetas', 'Etiquetas')}
              forzarAbierto={!!activeTag}
            >
              <ul className={styles.categoryList}>
                <li className={activeTag === null ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveTag, null)}>{t('cat.todas', 'Todas')}</li>
                {(tagsEffective || []).map(tag => (
                  <li key={tag.id} className={activeTag === tag.id ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveTag, tag.id)}>
                    <T>{tag.name}</T>
                  </li>
                ))}
              </ul>
            </GrupoSidebar>
          )}

          {(charactersEffective || []).length > 0 && (
            <GrupoSidebar
              id="personajes"
              titulo={t('cat.personajes', 'Personajes')}
              forzarAbierto={!!activeCharacter}
            >
              <ul className={styles.categoryList}>
                <li className={activeCharacter === null ? styles.activeItem : ''} onClick={() => handleFilterClick(setActiveCharacter, null)}>{t('cat.todos', 'Todos')}</li>
                {(charactersEffective || []).map(c => (
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
            brandId={brandId}
            {...paginationProps}
          />
        </main>
      </div>
    </div>
  );
};

export default SidebarCatalogLayout;
