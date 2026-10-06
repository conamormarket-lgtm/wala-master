import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProducts } from '../../services/products';
import { getCategories } from '../../services/categories';
import { getTags } from '../../services/tags';
import { getCollections } from '../../services/collections';
import { updateDocument } from '../../services/firebase/firestore';
import {
  PUBLICOS, EDADES, SINONIMOS, publicoDe, edadMinimaDe, equipoDe, textoProducto,
} from '../../utils/giftRecommender.mjs';
import { PLACEHOLDER_IMG } from '../../constants/placeholder';
import { useGlobalToast } from '../../contexts/ToastContext';
import styles from './AdminPublicoProductos.module.css';

/* ============================================================================
 * "🎯 Datos para recomendar" (antes "Para quién es cada producto")
 * ----------------------------------------------------------------------------
 * Los datos que usa el buscador de ideas de regalo (giftRecommender), marcados
 * en cada producto de productos_wala:
 *   publico     Mujer / Hombre / Unisex / Niños
 *   edadMinima  Todas las edades / Desde 13 / Solo adultos
 *   equipo      club o selección ("Alianza Lima"); solo se recomienda a sus hinchas
 * Lo que no está marcado se DEDUCE de las etiquetas y se muestra como sugerencia
 * (borde punteado). "Aceptar sugerencias" las guarda en bloque para revisarlas
 * de un vistazo. Se guarda al tocar cada opción.
 * ========================================================================== */

const marcado = (v) => v !== undefined && v !== null && v !== '';

const FILTROS = [
  { id: 'faltan', label: 'Faltan datos' },
  { id: 'todos', label: 'Todos' },
  { id: 'equipo', label: 'De un equipo' },
  { id: 'adultos', label: 'No para niños' },
];

const AdminPublicoProductos = () => {
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState('faltan');
  const [buscar, setBuscar] = useState('');
  const [categoria, setCategoria] = useState('');
  // Cambios ya guardados en esta visita: { [id]: { publico?, edadMinima?, equipo? } }.
  const [locales, setLocales] = useState({});
  const [guardando, setGuardando] = useState(null);
  const [borradorEquipo, setBorradorEquipo] = useState({});

  const { data: productos = [], isLoading } = useQuery({
    queryKey: ['admin-publico-productos'],
    queryFn: async () => {
      const { data, error } = await getProducts([], null, null, { includeHidden: true });
      if (error) throw new Error(error);
      return (data || []).filter((p) => !p.deleted);
    },
    staleTime: 60 * 1000,
  });
  const { data: dicts = {} } = useQuery({
    queryKey: ['admin-datos-recomendar-dicts'],
    queryFn: async () => {
      const [t, c] = await Promise.all([getTags(), getCollections()]);
      const aMapa = (lista) => Object.fromEntries((lista || []).map((x) => [x.id, x.name || '']));
      return { tags: aMapa(t.data), collections: aMapa(c.data) };
    },
    staleTime: 10 * 60 * 1000,
  });
  const [categorias, setCategorias] = useState([]);
  useEffect(() => {
    getCategories().then(({ data }) => setCategorias(data || [])).catch(() => {});
  }, []);
  const nombreCategoria = useMemo(() => Object.fromEntries(categorias.map((c) => [c.id, c.name])), [categorias]);

  // Producto con lo guardado en esta visita encima.
  const actual = (p) => ({ ...p, ...(locales[p.id] || {}) });

  // Estado de cada dato: valor marcado o sugerido.
  const datosDe = (p) => {
    const a = actual(p);
    const txt = textoProducto(a, dicts);
    const pubMarcado = marcado(a.publico) ? a.publico : '';
    const edad = edadMinimaDe(a, txt);
    const equipo = equipoDe(a, dicts);
    return {
      publico: pubMarcado,
      publicoSugerido: pubMarcado ? null : publicoDe({ ...a, publico: null }, txt),
      edad: edad.deducida ? null : edad.valor,
      edadSugerida: edad.deducida ? edad.valor : null,
      equipo: equipo.deducido ? '' : equipo.nombre,
      equipoSugerido: equipo.deducido ? equipo.nombre : '',
    };
  };
  const falta = (d) => !d.publico || d.edad === null || (!d.equipo && d.equipoSugerido);

  const equiposConocidos = useMemo(() => {
    const set = new Set(SINONIMOS.filter((g) => g.club).map((g) => g.canon.replace(/\b\w/g, (c) => c.toUpperCase())));
    productos.forEach((p) => {
      const e = equipoDe(p, dicts).nombre;
      if (e) set.add(e);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [productos, dicts]);

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return productos.filter((p) => {
      const d = datosDe(p);
      if (filtro === 'faltan' && !falta(d)) return false;
      if (filtro === 'equipo' && !(d.equipo || d.equipoSugerido)) return false;
      if (filtro === 'adultos' && (d.edad ?? d.edadSugerida) < 13) return false;
      if (categoria && !(p.categories || []).includes(categoria)) return false;
      if (q && !String(p.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [productos, filtro, buscar, categoria, locales, dicts]); // eslint-disable-line react-hooks/exhaustive-deps

  const conFaltantes = productos.filter((p) => falta(datosDe(p))).length;

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['gift-catalog-dicts'] });
  };

  const guardar = async (p, campos) => {
    setGuardando(p.id);
    const { error } = await updateDocument('productos_wala', p.id, campos);
    setGuardando(null);
    if (error) {
      toast.error('No se pudo guardar.');
      return false;
    }
    setLocales((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] || {}), ...campos } }));
    refrescar();
    return true;
  };

  // Tocar la opción ya marcada la desmarca (vuelve a la sugerencia).
  const marcarPublico = (p, valor) => guardar(p, { publico: datosDe(p).publico === valor ? null : valor });
  const marcarEdad = (p, valor) => guardar(p, { edadMinima: datosDe(p).edad === valor ? null : valor });
  const guardarEquipo = (p, valor) => {
    const limpio = String(valor || '').trim();
    if (limpio === datosDe(p).equipo) return;
    guardar(p, { equipo: limpio || null });
  };

  // Guarda, en lo que se está viendo, las sugerencias de lo que falta marcar.
  const [masivo, setMasivo] = useState(false);
  const aceptarSugerencias = async () => {
    const cambios = lista.map((p) => {
      const d = datosDe(p);
      const campos = {};
      if (!d.publico && d.publicoSugerido) campos.publico = d.publicoSugerido;
      if (d.edad === null) campos.edadMinima = d.edadSugerida;
      if (!d.equipo && d.equipoSugerido) campos.equipo = d.equipoSugerido;
      return { p, campos };
    }).filter((c) => Object.keys(c.campos).length);
    if (!cambios.length) {
      toast.success('No hay sugerencias pendientes en lo que estás viendo.');
      return;
    }
    if (!window.confirm(`¿Guardar las sugerencias de ${cambios.length} productos? Revisa antes las que tengan borde punteado.`)) return;
    setMasivo(true);
    let fallos = 0;
    const nuevos = {};
    for (let i = 0; i < cambios.length; i += 20) {
      const grupo = cambios.slice(i, i + 20);
      // eslint-disable-next-line no-await-in-loop
      const res = await Promise.all(grupo.map(({ p, campos }) => updateDocument('productos_wala', p.id, campos)));
      res.forEach((r, k) => {
        if (r.error) fallos += 1;
        else nuevos[grupo[k].p.id] = { ...(locales[grupo[k].p.id] || {}), ...grupo[k].campos };
      });
    }
    setLocales((prev) => ({ ...prev, ...nuevos }));
    setMasivo(false);
    refrescar();
    if (fallos) toast.error(`${fallos} no se pudieron guardar.`);
    else toast.success(`Listo: ${Object.keys(nuevos).length} productos con sus datos guardados.`);
  };

  // Marcar "para quién es" en bloque lo filtrado (p. ej. todos los relojes "Hombre").
  const marcarTodosPublico = async (valor) => {
    const etiqueta = PUBLICOS.find((x) => x.id === valor)?.label;
    if (!window.confirm(`¿Marcar los ${lista.length} productos que estás viendo como "${etiqueta}"?`)) return;
    setMasivo(true);
    let fallos = 0;
    const nuevos = {};
    for (let i = 0; i < lista.length; i += 20) {
      const grupo = lista.slice(i, i + 20);
      // eslint-disable-next-line no-await-in-loop
      const res = await Promise.all(grupo.map((p) => updateDocument('productos_wala', p.id, { publico: valor })));
      res.forEach((r, k) => {
        if (r.error) fallos += 1;
        else nuevos[grupo[k].id] = { ...(locales[grupo[k].id] || {}), publico: valor };
      });
    }
    setLocales((prev) => ({ ...prev, ...nuevos }));
    setMasivo(false);
    refrescar();
    if (fallos) toast.error(`${fallos} no se pudieron guardar.`);
    else toast.success(`Listo: ${Object.keys(nuevos).length} productos marcados como "${etiqueta}".`);
  };

  return (
    <div className={styles.pagina}>
      <header>
        <h1 className={styles.titulo}>🎯 Datos para recomendar</h1>
        <p className={styles.subtitulo}>
          Las ideas de regalo usan estos datos para no recomendar algo fuera de lugar: un reloj de hombre a una
          mujer, algo de adultos a un niño, o la casaca de un equipo a hincha de otro. Lo que tiene{' '}
          <span className={styles.leyendaSugerida}>borde punteado</span> es una sugerencia sacada de las etiquetas:
          tócala para confirmarla. Tocar de nuevo una opción la desmarca.
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
              aria-pressed={filtro === f.id}
            >
              {f.label}{f.id === 'faltan' ? ` (${conFaltantes})` : ''}
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

      {lista.length > 0 && (
        <div className={styles.masivo}>
          <button type="button" className={`${styles.opcion} ${styles.opcionActiva}`} disabled={masivo} onClick={aceptarSugerencias}>
            ✓ Aceptar sugerencias de los {lista.length} que estás viendo
          </button>
          {lista.length > 1 && (
            <>
              <span className={styles.separador}>o marcarlos todos como:</span>
              {PUBLICOS.map((op) => (
                <button key={op.id} type="button" className={styles.opcion} disabled={masivo} onClick={() => marcarTodosPublico(op.id)}>
                  {op.label}
                </button>
              ))}
            </>
          )}
          {masivo && <span className={styles.meta}>Guardando…</span>}
        </div>
      )}

      <datalist id="equipos-conocidos">
        {equiposConocidos.map((e) => <option key={e} value={e} />)}
      </datalist>

      {isLoading ? (
        <p className={styles.meta}>Cargando productos…</p>
      ) : lista.length === 0 ? (
        <p className={styles.meta}>
          {filtro === 'faltan' ? '¡Listo! Todos los productos de este filtro tienen sus datos.' : 'No hay productos con este filtro.'}
        </p>
      ) : (
        <ul className={styles.lista}>
          {lista.map((p) => {
            const d = datosDe(p);
            const ocupado = guardando === p.id || masivo;
            const valorEquipo = p.id in borradorEquipo ? borradorEquipo[p.id] : d.equipo;
            return (
              <li key={p.id} className={styles.fila}>
                <div className={styles.cabeza}>
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
                    </span>
                  </div>
                </div>

                <div className={styles.datos}>
                  <div className={styles.dato}>
                    <span className={styles.datoLabel}>Para quién</span>
                    <div className={styles.opciones} role="group" aria-label={`Para quién es ${p.name}`}>
                      {PUBLICOS.map((op) => (
                        <button
                          key={op.id}
                          type="button"
                          disabled={ocupado}
                          aria-pressed={d.publico === op.id}
                          className={`${styles.opcion} ${d.publico === op.id ? styles.opcionActiva : ''} ${d.publicoSugerido === op.id ? styles.opcionSugerida : ''}`}
                          onClick={() => marcarPublico(p, op.id)}
                        >
                          {op.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.dato}>
                    <span className={styles.datoLabel}>Edad</span>
                    <div className={styles.opciones} role="group" aria-label={`Edad para ${p.name}`}>
                      {EDADES.map((op) => (
                        <button
                          key={op.id}
                          type="button"
                          disabled={ocupado}
                          aria-pressed={d.edad === op.id}
                          className={`${styles.opcion} ${d.edad === op.id ? styles.opcionActiva : ''} ${d.edadSugerida === op.id ? styles.opcionSugerida : ''}`}
                          onClick={() => marcarEdad(p, op.id)}
                        >
                          {op.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.dato}>
                    <label className={styles.datoLabel} htmlFor={`equipo-${p.id}`}>Equipo</label>
                    <div className={styles.equipo}>
                      <input
                        id={`equipo-${p.id}`}
                        list="equipos-conocidos"
                        className={`${styles.equipoInput} ${!d.equipo && d.equipoSugerido ? styles.equipoSugerido : ''}`}
                        placeholder={d.equipoSugerido ? `Sugerido: ${d.equipoSugerido}` : 'Ninguno'}
                        value={valorEquipo}
                        disabled={ocupado}
                        onChange={(e) => setBorradorEquipo((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        onBlur={(e) => guardarEquipo(p, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      />
                      {!d.equipo && d.equipoSugerido && (
                        <button
                          type="button"
                          className={`${styles.opcion} ${styles.opcionSugerida}`}
                          disabled={ocupado}
                          onClick={() => {
                            setBorradorEquipo((prev) => ({ ...prev, [p.id]: d.equipoSugerido }));
                            guardar(p, { equipo: d.equipoSugerido });
                          }}
                        >
                          Usar
                        </button>
                      )}
                    </div>
                  </div>
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
