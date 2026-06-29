import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProductsByBrand, getProducts, setProductBrand } from '../../services/products';
import { PLACEHOLDER_IMG } from '../../constants/placeholder';
import { ArrowLeft, PlusCircle, Search, Loader2, PackagePlus, PackageMinus, X, CheckCircle2, Package, LayoutGrid } from 'lucide-react';
import Button from '../../components/common/Button';
// Editor compartido del nav de categorías por marca (reemplaza al antiguo
// BrandCategoryNavEditor interno; este sí invalida ['categories-nav-brands']).
import CategoryNavEditor from '../../components/admin/CategoryNavEditor/CategoryNavEditor';
import styles from './AdminMarcaProductos.module.css';

/**
 * Panel de GESTIÓN DE PRODUCTOS POR MARCA.
 *
 * Se abre desde AdminMarcas al pulsar "Gestionar productos" en una tarjeta de marca.
 * NO toca precios/stock/cobro: la única escritura sobre productos es el campo `brandId`
 * (asignar = brandId:<marca>, quitar = se REMUEVE el campo) vía setProductBrand(id, brandId),
 * que hace una escritura PARCIAL directa del doc sin re-normalizar el resto del producto.
 *
 * Estructura:
 *  - Cabecera con la marca y botón "Crear producto en {marca}" (abre el form preseleccionado).
 *  - Lista de productos YA asignados a la marca (getProductsByBrand) con quitar en lote.
 *  - Buscador + lista de productos NO asignados (getProducts) con asignar en lote.
 *
 * @param {{ brand: { id: string, name: string }, onBack: () => void }} props
 */
const AdminMarcaProductos = ({ brand, onBack }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Pestaña activa: 'productos' (gestión existente) o 'nav' (nav de categorías por marca).
  const [tab, setTab] = useState('productos');

  // Selecciones independientes para cada lista (asignados / disponibles).
  const [selectedToRemove, setSelectedToRemove] = useState(() => new Set());
  const [selectedToAdd, setSelectedToAdd] = useState(() => new Set());
  const [search, setSearch] = useState('');
  // Feedback efímero tras una operación en lote.
  const [feedback, setFeedback] = useState(null); // { type: 'ok'|'error', text }

  // Helper local de formato de precio (solo lectura, igual estilo que AdminProductos).
  const fmtPrice = (p) => `S/ ${Number(p || 0).toFixed(2)}`;

  // ── Productos YA asignados a esta marca ────────────────────────────────
  const {
    data: brandProducts,
    isLoading: loadingBrand,
    error: errorBrand,
  } = useQuery({
    queryKey: ['admin-brand-products', brand.id],
    queryFn: async () => {
      const { data, error } = await getProductsByBrand(brand.id);
      if (error) throw new Error(error);
      return data || [];
    },
  });

  // ── TODOS los productos (para elegir cuáles asignar) ───────────────────
  // Reutiliza getProducts (incluye ocultos para que el dueño pueda asignar
  // cualquier producto, no solo los visibles en tienda). Se filtra en cliente
  // a los que NO pertenecen a esta marca.
  const {
    data: allProducts,
    isLoading: loadingAll,
    error: errorAll,
  } = useQuery({
    queryKey: ['admin-all-products-min'],
    queryFn: async () => {
      const { data, error } = await getProducts([], null, null, { includeHidden: true });
      if (error) throw new Error(error);
      return data || [];
    },
  });

  // Productos disponibles para asignar = todos los que no son de esta marca,
  // filtrados por el término de búsqueda (nombre).
  const availableProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (allProducts || [])
      .filter((p) => (p.brandId || '') !== brand.id)
      .filter((p) => !term || (p.name || '').toLowerCase().includes(term));
  }, [allProducts, brand.id, search]);

  // Invalida las cachés relevantes tras escribir brandId.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-brand-products', brand.id] });
    queryClient.invalidateQueries({ queryKey: ['admin-all-products-min'] });
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  // ── Mutación en LOTE: cambia SOLO la marca (brandId) ────────────────────
  // setProductBrand hace una escritura PARCIAL directa del campo brandId (asignar)
  // o lo REMUEVE del documento (quitar, brandId vacío). No re-normaliza el resto
  // del producto, así que precio, stock, imágenes, variantes, etc. quedan intactos.
  const batchMutation = useMutation({
    mutationFn: async ({ ids, brandId }) => {
      let ok = 0;
      let fail = 0;
      // Secuencial para no saturar Firestore y poder contar con precisión.
      for (const id of ids) {
        const res = await setProductBrand(id, brandId);
        if (res?.error) fail += 1;
        else ok += 1;
      }
      return { ok, fail, brandId };
    },
    onSuccess: ({ ok, fail, brandId }) => {
      invalidate();
      const accion = brandId ? 'asignado(s)' : 'quitado(s)';
      setFeedback({
        type: fail ? 'error' : 'ok',
        text: fail
          ? `${ok} producto(s) ${accion}, ${fail} con error.`
          : `${ok} producto(s) ${accion} correctamente.`,
      });
      setSelectedToAdd(new Set());
      setSelectedToRemove(new Set());
      // Limpia el feedback tras unos segundos.
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (e) => {
      setFeedback({ type: 'error', text: e?.message || 'Error al guardar los cambios.' });
    },
  });

  // Ejecuta el lote: valida los ids seleccionados contra la lista de origen y
  // dispara la mutación con esos ids + el nuevo brandId. `products` es la fuente
  // de datos donde verificar que el doc existe (asignar = brand.id, quitar = '').
  const runBatch = (products, ids, brandId) => {
    if (!ids || ids.size === 0) return;
    const valid = new Set((products || []).map((p) => p.id));
    const targetIds = Array.from(ids).filter((id) => valid.has(id));
    if (targetIds.length === 0) return;
    batchMutation.mutate({ ids: targetIds, brandId });
  };

  // Alterna selección dentro de un Set (devuelve uno nuevo para re-render).
  const toggle = (setFn, set, id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFn(next);
  };

  // Selección masiva de la lista de disponibles (filtrada actual).
  const toggleAllAvailable = () => {
    if (selectedToAdd.size === availableProducts.length && availableProducts.length > 0) {
      setSelectedToAdd(new Set());
    } else {
      setSelectedToAdd(new Set(availableProducts.map((p) => p.id)));
    }
  };

  const handleCrearEnMarca = () => {
    // Abre el formulario de creación con la marca preseleccionada (?brandId=).
    navigate(`/admin/productos/nuevo?brandId=${brand.id}`);
  };

  const thumbOf = (p) => (Array.isArray(p.images) && p.images[0]) || p.mainImage || PLACEHOLDER_IMG;

  return (
    <div className={styles.panel}>
      {/* Cabecera */}
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={18} /> Volver a marcas
        </button>
        {tab === 'productos' && (
          <Button onClick={handleCrearEnMarca}>
            <span className={styles.btnInline}>
              <PlusCircle size={16} /> Crear producto en {brand.name}
            </span>
          </Button>
        )}
      </div>

      <div className={styles.headerBlock}>
        <h2 className={styles.brandHeading}>{brand.name}</h2>
        <p className={styles.brandSub}>
          {tab === 'productos'
            ? 'Asigna o quita productos de esta marca. Solo se cambia la marca del producto; el precio, el stock y la forma de cobro no se tocan.'
            : 'Arma las burbujas de categorías que verán tus clientes en la página de esta marca. Al pulsar una burbuja, el catálogo se filtra por esa categoría.'}
        </p>
      </div>

      {/* Pestañas: Productos (gestión existente) / Nav de categorías (nuevo) */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'productos' ? styles.tabActive : ''}`}
          onClick={() => setTab('productos')}
        >
          <Package size={16} /> Productos
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'nav' ? styles.tabActive : ''}`}
          onClick={() => setTab('nav')}
        >
          <LayoutGrid size={16} /> Nav de categorías
        </button>
      </div>

      {feedback && (
        <div className={feedback.type === 'ok' ? styles.feedbackOk : styles.feedbackError}>
          {feedback.type === 'ok' && <CheckCircle2 size={16} />} {feedback.text}
        </div>
      )}

      {/* ═══ PESTAÑA NAV DE CATEGORÍAS ═══ */}
      {/* Usa el editor compartido CategoryNavEditor: además de guardar en
          tienda_brands.categoryNav, invalida ['categories-nav-brands'] para que
          el storefront refresque el nav al instante. Trae su propio feedback. */}
      {tab === 'nav' && (
        <CategoryNavEditor brandId={brand.id} brandName={brand.name} />
      )}

      {/* ═══ PESTAÑA PRODUCTOS (gestión existente, intacta) ═══ */}
      {tab === 'productos' && (
      <>
      {/* ── SECCIÓN 1: Productos ya en la marca ── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>
            En esta marca ({brandProducts?.length ?? 0})
          </h3>
          {selectedToRemove.size > 0 && (
            <Button
              variant="secondary"
              onClick={() => runBatch(brandProducts, selectedToRemove, '')}
              disabled={batchMutation.isPending}
            >
              <span className={styles.btnInline}>
                <PackageMinus size={16} /> Quitar de la marca ({selectedToRemove.size})
              </span>
            </Button>
          )}
        </div>

        {loadingBrand && (
          <div className={styles.loading}><Loader2 size={18} className={styles.spin} /> Cargando productos…</div>
        )}
        {errorBrand && <div className={styles.errorBox}>{errorBrand.message}</div>}

        {!loadingBrand && !errorBrand && (brandProducts?.length ?? 0) === 0 && (
          <div className={styles.empty}>
            Esta marca todavía no tiene productos. Asígnale productos abajo o crea uno nuevo.
          </div>
        )}

        {!loadingBrand && (brandProducts?.length ?? 0) > 0 && (
          <ul className={styles.productList}>
            {brandProducts.map((p) => {
              const checked = selectedToRemove.has(p.id);
              return (
                <li
                  key={p.id}
                  className={`${styles.productRow} ${checked ? styles.rowSelected : ''}`}
                  onClick={() => toggle(setSelectedToRemove, selectedToRemove, p.id)}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(setSelectedToRemove, selectedToRemove, p.id)}
                    onClick={(e) => e.stopPropagation()}
                    className={styles.checkbox}
                  />
                  <img src={thumbOf(p)} alt={p.name} className={styles.thumb} loading="lazy" />
                  <div className={styles.prodInfo}>
                    <span className={styles.prodName}>{p.name || 'Sin nombre'}</span>
                    <span className={styles.prodPrice}>{fmtPrice(p.price)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── SECCIÓN 2: Añadir productos a la marca ── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Añadir productos a {brand.name}</h3>
          {selectedToAdd.size > 0 && (
            <Button
              onClick={() => runBatch(allProducts, selectedToAdd, brand.id)}
              disabled={batchMutation.isPending}
            >
              <span className={styles.btnInline}>
                <PackagePlus size={16} /> Asignar a {brand.name} ({selectedToAdd.size})
              </span>
            </Button>
          )}
        </div>

        <div className={styles.searchRow}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar producto por nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
            {search && (
              <button type="button" className={styles.clearSearch} onClick={() => setSearch('')}>
                <X size={14} />
              </button>
            )}
          </div>
          {availableProducts.length > 0 && (
            <button type="button" className={styles.selectAllBtn} onClick={toggleAllAvailable}>
              {selectedToAdd.size === availableProducts.length ? 'Quitar selección' : 'Seleccionar todos'}
            </button>
          )}
        </div>

        {loadingAll && (
          <div className={styles.loading}><Loader2 size={18} className={styles.spin} /> Cargando catálogo…</div>
        )}
        {errorAll && <div className={styles.errorBox}>{errorAll.message}</div>}

        {!loadingAll && !errorAll && availableProducts.length === 0 && (
          <div className={styles.empty}>
            {search
              ? 'Ningún producto coincide con la búsqueda.'
              : 'No hay más productos para asignar a esta marca.'}
          </div>
        )}

        {!loadingAll && availableProducts.length > 0 && (
          <ul className={styles.productList}>
            {availableProducts.map((p) => {
              const checked = selectedToAdd.has(p.id);
              return (
                <li
                  key={p.id}
                  className={`${styles.productRow} ${checked ? styles.rowSelected : ''}`}
                  onClick={() => toggle(setSelectedToAdd, selectedToAdd, p.id)}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(setSelectedToAdd, selectedToAdd, p.id)}
                    onClick={(e) => e.stopPropagation()}
                    className={styles.checkbox}
                  />
                  <img src={thumbOf(p)} alt={p.name} className={styles.thumb} loading="lazy" />
                  <div className={styles.prodInfo}>
                    <span className={styles.prodName}>{p.name || 'Sin nombre'}</span>
                    <span className={styles.prodPrice}>{fmtPrice(p.price)}</span>
                  </div>
                  {p.brandId && (
                    <span className={styles.otherBrandTag}>Otra marca</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </>
      )}
    </div>
  );
};

export default AdminMarcaProductos;
