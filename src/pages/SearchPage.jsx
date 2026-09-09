import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchCatalog, searchProductsFirestore } from '../services/search';
import { getDocument } from '../services/firebase/firestore';
import { useVisualEditor } from './Tienda/contexts/VisualEditorContext';
import EditableSection from '../components/admin/EditableSection';
import { getCategories } from '../services/products';
import { getBrand } from '../services/brands';
import { FULFILLMENT_TYPES } from '../constants/marketplace';
import ProductCard from './Tienda/components/ProductCard/ProductCard';
import { Search, ArrowLeft } from 'lucide-react';
import styles from './SearchPage.module.css';
import { T } from '../i18n/useTranslatedText';

// Página de búsqueda/descubrimiento — usa el servicio de búsqueda por Firestore
// (searchProductsFirestore) con paginación por cursor (limit + startAfter). Las
// FACETAS se conservan filtrando en CLIENTE sobre los resultados acumulados, igual
// que antes. Si Firestore no puede resolver la query (pre-backfill / sin índice /
// término vacío), el servicio cae solo a la búsqueda en memoria: la página no se
// entera y sigue funcionando.
const PAGE_SIZE = 24;

// Textos de la pantalla. Se pueden cambiar desde el Editor Visual (sección
// "Buscador"), que los guarda en storeConfig/homePage.searchPage. Estos son los
// de reserva: lo que se ve mientras no haya nada guardado, y lo que vuelve si
// se borra un campo en el editor. NO se tocan los resultados ni los filtros:
// eso lo decide el catálogo, no un texto.
const TEXTOS_BUSCADOR = {
  titulo: 'Buscar productos',
  subtitulo: 'Escribe qué buscas y afina con los filtros.',
  marcador: '¿Qué buscas? (polo, taza, gorro...)',
  boton: 'Buscar',
  vacioTitulo: 'Sin resultados',
  vacioTexto: 'Prueba con otra palabra: una más corta o más general suele encontrar más.',
  vacioConFiltros: 'Prueba a quitar algún filtro o a buscar otra palabra.',
};

const priceOf = (p) => (p.salePrice != null ? p.salePrice : p.price) || 0;

// Ordenadores en cliente (la query Firestore ordena por nameLower; el orden visible
// se aplica aquí sobre los resultados acumulados, como las facetas).
const SORTERS = {
  newest: (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
  price: (a, b) => priceOf(a) - priceOf(b),
  'price-desc': (a, b) => priceOf(b) - priceOf(a),
  name: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
};

// Filtro de facetas en cliente sobre la página/acumulado (espeja matchesFacets de search.js).
const matchesFacets = (p, f = {}) => {
  if (f.fulfillmentType && p.fulfillmentType !== f.fulfillmentType) return false;
  if (f.nicheId && p.nicheId !== f.nicheId) return false;
  if (f.vendorId && p.vendorId !== f.vendorId) return false;
  if (f.brandId && p.brandId !== f.brandId) return false;
  return true;
};

const facetCounts = (items, key) => {
  const counts = {};
  for (const p of items) {
    const v = p[key];
    if (v == null || v === '') continue;
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
};

const SearchPage = () => {
  // Textos editables desde el Editor Visual. Mismo patrón que el pop-up de
  // cuenta: si el editor está abierto manda su borrador (para ver los cambios
  // al escribirlos) y, si no, lo guardado. Sin nada de eso, los de reserva.
  const { storeConfigDraft } = useVisualEditor();
  const { data: storeConfig } = useQuery({
    queryKey: ['store-config-custom'],
    queryFn: async () => {
      const { data, error } = await getDocument('storeConfig', 'homePage');
      if (error) return null;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
  const activeConfig = storeConfigDraft || storeConfig || {};
  const txt = { ...TEXTOS_BUSCADOR, ...(activeConfig.searchPage || {}) };

  const [params, setParams] = useSearchParams();
  const term = params.get('q') || '';
  // Filtro OPCIONAL de marca (multimarca): ?brand=<id de tienda_brands>. Lo agrega
  // el Header cuando la búsqueda se dispara DESDE una página de marca (brandActual),
  // para que el usuario no sea expulsado al catálogo global. Sin este parámetro
  // (búsqueda global / Con Amor) el comportamiento queda EXACTO como hoy.
  const brandFilter = params.get('brand') || '';
  const [input, setInput] = useState(term);
  const [sort, setSort] = useState('newest');
  const [facets, setFacets] = useState({});

  // Resultados ACUMULADOS por cursor + estado de paginación Firestore.
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  // Doc de la marca del filtro (solo para mostrar su nombre en el indicador). Sin
  // brandFilter no se pide nada (retrocompatible: sin marca = búsqueda global).
  const [brandInfo, setBrandInfo] = useState(null);

  // Token de petición: evita que respuestas viejas (de un término anterior)
  // sobrescriban las nuevas si llegan fuera de orden.
  const reqRef = useRef(0);

  useEffect(() => { getCategories().then((r) => setCategories(r.data || [])); }, []);
  useEffect(() => { setInput(term); }, [term]);

  useEffect(() => {
    if (!brandFilter) { setBrandInfo(null); return; }
    let mounted = true;
    getBrand(brandFilter).then((r) => { if (mounted) setBrandInfo(r?.data || null); });
    return () => { mounted = false; };
  }, [brandFilter]);

  // Al cambiar el término: reinicia acumulado y trae la primera página por cursor.
  useEffect(() => {
    const myReq = ++reqRef.current;
    setLoading(true);
    setItems([]);
    setCursor(null);
    setHasMore(false);
    searchProductsFirestore({ term, cursor: null, pageSize: PAGE_SIZE }).then((r) => {
      if (myReq !== reqRef.current) return; // respuesta obsoleta
      setItems(r.items || []);
      setCursor(r.lastDoc || null);
      setHasMore(Boolean(r.hasMore));
      setLoading(false);
    });
  }, [term]);

  // "Cargar más": siguiente página por cursor, se concatena al acumulado.
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const myReq = reqRef.current;
    setLoading(true);
    searchProductsFirestore({ term, cursor, pageSize: PAGE_SIZE }).then((r) => {
      if (myReq !== reqRef.current) return;
      setItems((prev) => prev.concat(r.items || []));
      setCursor(r.lastDoc || null);
      setHasMore(Boolean(r.hasMore));
      setLoading(false);
    });
  }, [term, cursor, hasMore, loading]);

  const submit = useCallback((e) => {
    e.preventDefault();
    // Conserva el filtro de marca (si vino en la URL) al re-buscar, para que el
    // usuario no "salga" de su tienda al escribir un nuevo término.
    const next = {};
    if (input) next.q = input;
    if (brandFilter) next.brand = brandFilter;
    setParams(next);
  }, [input, brandFilter, setParams]);

  const toggleFacet = (key, value) => {
    setFacets((f) => ({ ...f, [key]: f[key] === value ? undefined : value }));
  };

  // Facetado + orden EN CLIENTE sobre el acumulado (conserva el comportamiento de antes).
  // Si hay brandFilter (?brand=), se acota además a esa marca (client-side, sin
  // índices nuevos). Sin brandFilter, queda exactamente igual que hoy (global).
  const visible = useMemo(() => {
    const filtered = items.filter((p) =>
      p.visible !== false &&
      matchesFacets(p, facets) &&
      (!brandFilter || p.brandId === brandFilter)
    );
    return SORTERS[sort] ? filtered.slice().sort(SORTERS[sort]) : filtered;
  }, [items, facets, sort, brandFilter]);

  const facetData = useMemo(() => ({
    nicheId: facetCounts(items, 'nicheId'),
  }), [items]);

  // ¿Hay algún filtro puesto? Decide si se ofrece "limpiar" y qué decir cuando
  // la búsqueda no devuelve nada (no es lo mismo no encontrar nada que haberlo
  // escondido tú con un filtro).
  const hayFiltros = Boolean(facets.fulfillmentType || facets.nicheId);
  const limpiarFiltros = () => setFacets({});
  const claseChip = (activo) => `${styles.chip} ${activo ? styles.chipActivo : ''}`;

  return (
    <div className={styles.pagina}>
      {/* Lo editable es la PRESENTACIÓN de la búsqueda (títulos, marcador del
          campo, texto del vacío), no los resultados: eso lo decide el catálogo.
          En modo edición, este bloque se marca y al pulsarlo abre su formulario
          en el panel. Fuera de modo edición, EditableSection no pinta nada. */}
      <EditableSection sectionId="searchPage" currentConfig={activeConfig} label="Buscador">
      <header className={styles.cabecera}>
        <h1 className={styles.titulo}><T>{txt.titulo}</T></h1>
        {term ? (
          <p className={styles.consulta}>
            <T>Resultados para</T> <strong>«{term}»</strong>
          </p>
        ) : (
          <p className={styles.consulta}>
            <T>{txt.subtitulo}</T>
          </p>
        )}

        {/* Aviso de búsqueda acotada a una marca (?brand=). Sin ese parámetro no
            se pinta nada: la búsqueda es global, como siempre. */}
        {brandFilter && (
          <div className={styles.avisoMarca}>
            <span>
              <T>Buscando solo en</T> <strong>{brandInfo?.name || 'tu tienda'}</strong>
            </span>
            <Link
              to={term ? `/buscar?q=${encodeURIComponent(term)}` : '/buscar'}
              className={styles.avisoEnlace}
            >
              <T>Buscar en todo el catálogo</T>
            </Link>
          </div>
        )}
      </header>

      {/* ── Mandos: campo, botón y filtros, juntos en un panel ─────────────
          Buscar es manejar una consulta. Agrupar los controles los separa de
          los resultados; antes campo, filtros y contador iban sueltos uno
          detrás de otro y todo pesaba lo mismo. */}
      <section className={styles.panel}>
        <form onSubmit={submit} className={styles.formulario} role="search">
          <div className={styles.campoEnvoltorio}>
            <Search size={18} className={styles.lupa} aria-hidden="true" />
            <input
              className={styles.campo}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={txt.marcador}
              aria-label="Qué buscas"
            />
          </div>
          <button type="submit" className={styles.botonBuscar}>
            <T>{txt.boton}</T>
          </button>
        </form>

        {/* Facetas: tipo de cumplimiento (personalizado vs stock) y por nicho.
            Son <button aria-pressed>, no <span onClick>: antes no se podían
            enfocar con el teclado ni se anunciaban como controles. */}
        <div className={styles.filtros}>
          <span className={styles.filtrosTitulo}><T>Filtros</T></span>

          <button
            type="button"
            className={claseChip(facets.fulfillmentType === FULFILLMENT_TYPES.PRINT_ON_DEMAND)}
            aria-pressed={facets.fulfillmentType === FULFILLMENT_TYPES.PRINT_ON_DEMAND}
            onClick={() => toggleFacet('fulfillmentType', FULFILLMENT_TYPES.PRINT_ON_DEMAND)}
          >
            <T>Personalizado</T>
          </button>

          <button
            type="button"
            className={claseChip(facets.fulfillmentType === FULFILLMENT_TYPES.STOCK)}
            aria-pressed={facets.fulfillmentType === FULFILLMENT_TYPES.STOCK}
            onClick={() => toggleFacet('fulfillmentType', FULFILLMENT_TYPES.STOCK)}
          >
            <T>En stock</T>
          </button>

          {Object.keys(facetData.nicheId || {}).map((n) => (
            <button
              key={n}
              type="button"
              className={claseChip(facets.nicheId === n)}
              aria-pressed={facets.nicheId === n}
              onClick={() => toggleFacet('nicheId', n)}
            >
              {n} <span className={styles.chipCuenta}>({facetData.nicheId[n]})</span>
            </button>
          ))}

          {hayFiltros && (
            <button type="button" className={styles.limpiar} onClick={limpiarFiltros}>
              <T>Limpiar filtros</T>
            </button>
          )}
        </div>
      </section>
      </EditableSection>

      {/* ── Barra de resultados ─────────────────────────────────────────── */}
      <div className={styles.barra}>
        <span className={styles.conteo}>
          {loading && items.length === 0 ? (
            <T>Buscando…</T>
          ) : (
            <>
              <strong>{visible.length}{hasMore ? '+' : ''}</strong>{' '}
              <T>{visible.length === 1 ? 'resultado' : 'resultados'}</T>
            </>
          )}
        </span>

        <label className={styles.orden}>
          <T>Ordenar por</T>
          <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest"><T>Más nuevos</T></option>
            <option value="price"><T>Precio: menor a mayor</T></option>
            <option value="price-desc"><T>Precio: mayor a menor</T></option>
            <option value="name"><T>Nombre (A-Z)</T></option>
          </select>
        </label>
      </div>

      {/* ── Resultados ──────────────────────────────────────────────────── */}
      {loading && items.length === 0 ? (
        <p className={styles.cargando}><T>Buscando…</T></p>
      ) : visible.length === 0 ? (
        /* El mensaje de antes ("si el catálogo está vacío, conecta Firebase")
           era una nota para quien programa, y la leía el cliente. */
        <div className={styles.vacio}>
          <p className={styles.vacioTitulo}><T>{txt.vacioTitulo}</T></p>
          <p className={styles.vacioTexto}>
            <T>{hayFiltros ? txt.vacioConFiltros : txt.vacioTexto}</T>
          </p>
        </div>
      ) : (
        <div className={styles.rejilla}>
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} categories={categories} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className={styles.masEnvoltorio}>
          <button type="button" className={styles.botonMas} disabled={loading} onClick={loadMore}>
            {loading ? <T>Cargando…</T> : <T>Cargar más</T>}
          </button>
        </div>
      )}

      <Link to="/" className={styles.volver}>
        <ArrowLeft size={16} aria-hidden="true" />
        <T>Volver a la tienda</T>
      </Link>
    </div>
  );
};

export default SearchPage;
