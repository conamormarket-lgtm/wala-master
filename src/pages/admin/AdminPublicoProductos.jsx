import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProducts } from '../../services/products';
import { getCategories } from '../../services/categories';
import { updateDocument } from '../../services/firebase/firestore';
import { PUBLICOS, publicoDe } from '../../utils/giftRecommender.mjs';
import { PLACEHOLDER_IMG } from '../../constants/placeholder';
import { useGlobalToast } from '../../contexts/ToastContext';
import styles from './AdminPublicoProductos.module.css';

/* ============================================================================
 * "👫 Para quién es cada producto"
 * ----------------------------------------------------------------------------
 * Marca cada producto como Mujer / Hombre / Unisex / Niños (campo `publico`
 * de productos_wala). Lo usa el buscador de ideas de regalo: un producto de
 * hombre no se le recomienda a una mujer, ni uno de niños a un adulto. Casi
 * ninguna ficha lo dice en su texto, por eso se marca acá, rápido, con un clic.
 * Se guarda al tocar el botón.
 * ========================================================================== */

const FILTROS = [
  { id: 'sin', label: 'Sin marcar' },
  { id: 'todos', label: 'Todos' },
  ...PUBLICOS.map((p) => ({ id: p.id, label: p.label })),
];

const AdminPublicoProductos = () => {
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState('sin');
  const [buscar, setBuscar] = useState('');
  const [categoria, setCategoria] = useState('');
  // Cambios ya guardados en esta visita (para pintar sin recargar todo).
  const [locales, setLocales] = useState({});
  const [guardando, setGuardando] = useState(null);

  const { data: productos = [], isLoading } = useQuery({
    queryKey: ['admin-publico-productos'],
    queryFn: async () => {
      const { data, error } = await getProducts([], null, null, { includeHidden: true });
      if (error) throw new Error(error);
      return (data || []).filter((p) => !p.deleted);
    },
    staleTime: 60 * 1000,
  });
  const [categorias, setCategorias] = useState([]);
  useEffect(() => {
    getCategories().then(({ data }) => setCategorias(data || [])).catch(() => {});
  }, []);
  const nombreCategoria = useMemo(() => Object.fromEntries(categorias.map((c) => [c.id, c.name])), [categorias]);

  const publicoActual = (p) => (p.id in locales ? locales[p.id] : (p.publico || ''));

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return productos.filter((p) => {
      const pub = publicoActual(p);
      if (filtro === 'sin' && pub) return false;
      if (!['sin', 'todos'].includes(filtro) && pub !== filtro) return false;
      if (categoria && !(p.categories || []).includes(categoria)) return false;
      if (q && !String(p.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [productos, filtro, buscar, categoria, locales]); // eslint-disable-line react-hooks/exhaustive-deps

  const sinMarcar = productos.filter((p) => !publicoActual(p)).length;

  const marcar = async (p, valor) => {
    const nuevo = publicoActual(p) === valor ? '' : valor; // tocar el mismo lo desmarca
    setGuardando(p.id);
    const { error } = await updateDocument('productos_wala', p.id, { publico: nuevo || null });
    setGuardando(null);
    if (error) {
      toast.error('No se pudo guardar.');
      return;
    }
    setLocales((prev) => ({ ...prev, [p.id]: nuevo }));
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  // Marcar en bloque todo lo que se está viendo (p. ej. filtrar "Relojes" y
  // marcarlos todos "Hombre" de una vez, en vez de uno por uno).
  const [masivo, setMasivo] = useState(false);
  const marcarTodos = async (valor) => {
    const etiqueta = PUBLICOS.find((x) => x.id === valor)?.label;
    if (!window.confirm(`¿Marcar los ${lista.length} productos que estás viendo como "${etiqueta}"?`)) return;
    setMasivo(true);
    let fallos = 0;
    const nuevos = {};
    for (let i = 0; i < lista.length; i += 20) {
      const grupo = lista.slice(i, i + 20);
      // eslint-disable-next-line no-await-in-loop
      const res = await Promise.all(grupo.map((p) => updateDocument('productos_wala', p.id, { publico: valor })));
      res.forEach((r, k) => { if (r.error) fallos += 1; else nuevos[grupo[k].id] = valor; });
    }
    setLocales((prev) => ({ ...prev, ...nuevos }));
    setMasivo(false);
    queryClient.invalidateQueries({ queryKey: ['products'] });
    if (fallos) toast.error(`${fallos} no se pudieron guardar.`);
    else toast.success(`Listo: ${Object.keys(nuevos).length} productos marcados como "${etiqueta}".`);
  };

  return (
    <div className={styles.pagina}>
      <header>
        <h1 className={styles.titulo}>👫 Para quién es cada producto</h1>
        <p className={styles.subtitulo}>
          Las ideas de regalo usan esto para no recomendar, por ejemplo, un reloj de hombre a una
          mujer. Marca cada producto con un clic; se guarda solo. Tocar de nuevo lo desmarca.
        </p>
      </header>

      <div className={styles.barra}>
        <div className={styles.chips} role="group" aria-label="Filtro">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`${styles.chip} ${filtro === f.id ? styles.chipActivo : ''}`}
              onClick={() => setFiltro(f.id)}
            >
              {f.label}{f.id === 'sin' ? ` (${sinMarcar})` : ''}
            </button>
          ))}
        </div>
        <select className={styles.select} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          type="search"
          className={styles.buscar}
          placeholder="Buscar producto…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
      </div>

      {lista.length > 1 && (
        <div className={styles.masivo}>
          <span>Marcar los {lista.length} que estás viendo como:</span>
          {PUBLICOS.map((op) => (
            <button key={op.id} type="button" className={styles.opcion} disabled={masivo} onClick={() => marcarTodos(op.id)}>
              {op.label}
            </button>
          ))}
          {masivo && <span className={styles.meta}>Guardando…</span>}
        </div>
      )}

      {isLoading ? (
        <p className={styles.meta}>Cargando productos…</p>
      ) : lista.length === 0 ? (
        <p className={styles.meta}>
          {filtro === 'sin' ? '¡Listo! Todos los productos de este filtro están marcados.' : 'No hay productos con este filtro.'}
        </p>
      ) : (
        <ul className={styles.lista}>
          {lista.map((p) => {
            const actual = publicoActual(p);
            const deducido = !actual ? publicoDe(p) : null;
            return (
              <li key={p.id} className={styles.fila}>
                <img
                  src={p.images?.[0] || p.mainImage || PLACEHOLDER_IMG}
                  alt=""
                  className={styles.img}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                />
                <div className={styles.info}>
                  <strong>{p.name}</strong>
                  <span className={styles.meta}>
                    {(p.categories || []).map((c) => nombreCategoria[c]).filter(Boolean).join(', ') || 'Sin categoría'}
                    {p.visible === false ? ' · oculto' : ''}
                    {deducido ? ` · parece de ${PUBLICOS.find((x) => x.id === deducido)?.label.toLowerCase()}` : ''}
                  </span>
                </div>
                <div className={styles.opciones} role="group" aria-label={`Para quién es ${p.name}`}>
                  {PUBLICOS.map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      disabled={guardando === p.id}
                      aria-pressed={actual === op.id}
                      className={`${styles.opcion} ${actual === op.id ? styles.opcionActiva : ''} ${!actual && deducido === op.id ? styles.opcionSugerida : ''}`}
                      onClick={() => marcar(p, op.id)}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AdminPublicoProductos;
