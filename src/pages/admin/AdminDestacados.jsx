import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFeaturedProducts, getProducts, updateProductField } from '../../services/products';
import { getTopSelling } from '../../services/salesAnalytics';
import Button from '../../components/common/Button';
import styles from './AdminDestacados.module.css';

const PLACEHOLDER = '/images/placeholder.svg';

const AdminDestacados = () => {
  const queryClient = useQueryClient();
  const [orderUpdates, setOrderUpdates] = useState({});
  const [search, setSearch] = useState('');

  // 1) Productos destacados actuales (para reordenar / quitar).
  const { data: featuredData, isLoading, error } = useQuery({
    queryKey: ['admin-featured'],
    queryFn: async () => {
      const { data, error: err } = await getFeaturedProducts();
      if (err) throw new Error(err);
      return data;
    }
  });

  // 2) Catálogo completo: se usa para cruzar el top de ventas (imagen/precio)
  //    y para la búsqueda de productos a destacar. Incluye ocultos para poder
  //    actuar sobre cualquier producto desde aquí.
  const { data: catalogData } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error: err } = await getProducts([], null, null, { includeHidden: true });
      if (err) throw new Error(err);
      return data;
    }
  });

  // 3) Top más vendidos REAL (últimos 30 días). Es caro (~800 lecturas del ERP),
  //    por eso staleTime alto (15 min) y NO se recalcula en cada render.
  const {
    data: topData,
    isLoading: topLoading,
    isFetching: topFetching,
    error: topError,
  } = useQuery({
    queryKey: ['admin-top-selling', 30],
    queryFn: () => getTopSelling({ days: 30, topLimit: 10 }),
    staleTime: 1000 * 60 * 15, // 15 min — evita recargas costosas
    gcTime: 1000 * 60 * 60,    // 1 h en caché
    refetchOnWindowFocus: false,
  });

  // Mutación única para destacar/quitar/reordenar. Invalida todas las cachés
  // relevantes para que tienda y admin reflejen el cambio.
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateProductField(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-featured'] });
      queryClient.invalidateQueries({ queryKey: ['featured-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-destacados'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setOrderUpdates({});
    },
    // Antes los fallos de escritura eran SILENCIOSOS: el admin creía que destacó
    // pero nada cambiaba. Avisamos el error para que se note y pueda reintentar.
    onError: (err) => {
      alert(`No se pudo guardar el cambio: ${err?.message || 'error desconocido'}`);
    }
  });

  const featured = featuredData ?? [];
  const catalog = catalogData ?? [];

  // Índice rápido del catálogo por id (para cruzar con el top de ventas).
  const catalogById = useMemo(() => {
    const map = new Map();
    catalog.forEach((p) => map.set(p.id, p));
    return map;
  }, [catalog]);

  // Set de ids destacados (para mostrar el estado correcto en cada botón).
  const featuredIds = useMemo(() => new Set(featured.map((p) => p.id)), [featured]);

  // Top por unidades cruzado con el catálogo (imagen/precio).
  const topByUnits = topData?.topByUnits ?? [];
  const topAvailable = topData?.available;

  // Resultados de búsqueda en catálogo (por nombre). Limitado para no saturar.
  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return catalog
      .filter((p) => (p.name || '').toLowerCase().includes(term))
      .slice(0, 12);
  }, [search, catalog]);

  const handleOrderChange = (productId, value) => {
    const num = parseInt(value, 10);
    if (!Number.isNaN(num)) setOrderUpdates((u) => ({ ...u, [productId]: num }));
  };

  const handleSaveOrder = (product) => {
    // Default a 0 si el producto no tiene featuredOrder, para no enviar undefined
    // a Firestore (rompería el orderBy de getFeaturedProducts).
    const base = product.featuredOrder ?? 0;
    const newOrder = orderUpdates[product.id] !== undefined ? orderUpdates[product.id] : base;
    updateMutation.mutate({
      id: product.id,
      data: { featured: true, featuredOrder: newOrder }
    });
  };

  const handleRemoveFeatured = (product) => {
    updateMutation.mutate({
      id: product.id,
      data: { featured: false, featuredOrder: 0 }
    });
  };

  // Destacar / quitar destacado desde el top de ventas o la búsqueda.
  // Al MARCAR enviamos featuredOrder: 0 SIEMPRE: getFeaturedProducts ordena por
  // featuredOrder en Firestore (orderBy EXCLUYE docs sin el campo), así que sin
  // este valor el producto se marcaba pero NUNCA aparecía en la lista.
  const handleToggleFeatured = (productId, makeFeatured) => {
    updateMutation.mutate({
      id: productId,
      data: makeFeatured
        ? { featured: true, featuredOrder: 0 }
        : { featured: false, featuredOrder: 0 }
    });
  };

  if (isLoading) return <p className={styles.loading}>Cargando destacados...</p>;
  if (error) return <p className={styles.error}>{error.message}</p>;

  const isBusy = updateMutation.isPending;

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Productos destacados</h1>
      <p className={styles.subtitle}>
        Reordena y quita destacados, consulta tus más vendidos reales y marca cualquier producto del catálogo.
      </p>

      {/* ---------- Buscador del catálogo ---------- */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Buscar producto y destacar</h2>
        <p className={styles.sectionHint}>
          Impulsa productos que aún no venden marcándolos como destacados.
        </p>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Buscar por nombre del producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search.trim() && (
          searchResults.length === 0 ? (
            <p className={styles.empty}>No se encontraron productos para &quot;{search.trim()}&quot;.</p>
          ) : (
            <ul className={styles.compactList}>
              {searchResults.map((p) => {
                const isFeat = featuredIds.has(p.id);
                return (
                  <li key={p.id} className={styles.compactItem}>
                    <div className={styles.compactImage}>
                      <img src={p.images?.[0] || PLACEHOLDER} alt={p.name} loading="lazy" />
                    </div>
                    <div className={styles.compactInfo}>
                      <span className={styles.compactName}>{p.name}</span>
                      <span className={styles.compactMeta}>
                        S/ {Number(p.price || 0).toFixed(2)}
                        {p.visible === false && <span className={styles.tagHidden}>oculto</span>}
                        {isFeat && <span className={styles.tagFeatured}>destacado</span>}
                      </span>
                    </div>
                    <Button
                      size="small"
                      variant={isFeat ? 'secondary' : 'primary'}
                      onClick={() => handleToggleFeatured(p.id, !isFeat)}
                      disabled={isBusy}
                    >
                      {isFeat ? 'Quitar' : 'Destacar'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )
        )}
      </section>

      {/* ---------- Referencia: Top más vendidos (ERP, 30 días) ---------- */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Top más vendidos <span className={styles.sectionTitleSub}>(últimos 30 días)</span>
        </h2>

        {topLoading ? (
          <p className={styles.loading}>Cargando ventas...</p>
        ) : topError ? (
          <p className={styles.empty}>No se pudieron cargar las ventas: {topError.message}</p>
        ) : !topAvailable ? (
          <p className={styles.empty}>Sin datos de ventas aún.</p>
        ) : topByUnits.length === 0 ? (
          <p className={styles.empty}>No hay ventas registradas en los últimos 30 días.</p>
        ) : (
          <>
            <div className={styles.tableHead} aria-hidden="true">
              <span className={styles.colRank}>#</span>
              <span className={styles.colProd}>Producto</span>
              <span className={styles.colNum}>Unid.</span>
              <span className={styles.colNum}>Monto</span>
              <span className={styles.colAction}></span>
            </div>
            <ul className={styles.compactList}>
              {topByUnits.map((row, idx) => {
                const prod = row.productId ? catalogById.get(row.productId) : null;
                const isFeat = prod ? featuredIds.has(prod.id) : false;
                const img = prod?.images?.[0] || PLACEHOLDER;
                const price = prod ? Number(prod.price || 0).toFixed(2) : null;
                return (
                  <li key={row.productId || `name-${idx}`} className={styles.topItem}>
                    <span className={styles.colRank}>{idx + 1}</span>
                    <div className={styles.compactImage}>
                      <img src={img} alt={row.name} loading="lazy" />
                    </div>
                    <div className={styles.compactInfo}>
                      <span className={styles.compactName}>{prod?.name || row.name}</span>
                      <span className={styles.compactMeta}>
                        {price !== null ? `S/ ${price}` : 'No está en catálogo'}
                        {isFeat && <span className={styles.tagFeatured}>destacado</span>}
                      </span>
                    </div>
                    <span className={styles.colNum} data-label="Unid.: ">{row.units}</span>
                    <span className={styles.colNum} data-label="Monto: ">S/ {Number(row.amount || 0).toFixed(2)}</span>
                    <span className={styles.colAction}>
                      {prod ? (
                        <Button
                          size="small"
                          variant={isFeat ? 'secondary' : 'primary'}
                          onClick={() => handleToggleFeatured(prod.id, !isFeat)}
                          disabled={isBusy}
                        >
                          {isFeat ? 'Quitar' : 'Destacar'}
                        </Button>
                      ) : (
                        <span className={styles.noProd}>—</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {topFetching && <p className={styles.refreshing}>Actualizando datos de ventas...</p>}
          </>
        )}
      </section>

      {/* ---------- Destacados actuales: reordenar + quitar ---------- */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Destacados actuales</h2>
        {featured.length === 0 ? (
          <p className={styles.empty}>
            No hay productos destacados. Usa el buscador o el top de ventas para marcar alguno.
          </p>
        ) : (
          <ul className={styles.list}>
            {featured.map((product) => (
              <li key={product.id} className={styles.item}>
                <div className={styles.itemImage}>
                  <img
                    src={product.images?.[0] || PLACEHOLDER}
                    alt={product.name}
                  />
                </div>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{product.name}</span>
                  <span className={styles.itemPrice}>S/ {Number(product.price || 0).toFixed(2)}</span>
                </div>
                <div className={styles.itemOrder}>
                  <label htmlFor={`order-${product.id}`}>Orden</label>
                  <input
                    id={`order-${product.id}`}
                    type="number"
                    min="0"
                    value={orderUpdates[product.id] !== undefined ? orderUpdates[product.id] : (product.featuredOrder ?? 0)}
                    onChange={(e) => handleOrderChange(product.id, e.target.value)}
                    className={styles.inputOrder}
                  />
                </div>
                <div className={styles.itemActions}>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => handleSaveOrder(product)}
                    disabled={isBusy}
                  >
                    Guardar orden
                  </Button>
                  <button
                    type="button"
                    className={styles.btnRemove}
                    onClick={() => handleRemoveFeatured(product)}
                    disabled={isBusy}
                  >
                    Quitar de destacados
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default AdminDestacados;
