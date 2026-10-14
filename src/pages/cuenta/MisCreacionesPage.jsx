import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Plus, RotateCcw, History, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getDesignsByUser } from '../../services/designs';
import { usePedidos } from '../../hooks/usePedidos';
import MiCreacionCard, { MiCreacionCardSkeleton, fechaDeCreacion } from './components/MiCreacionCard';
import { useEliminarCreacion } from '../Crear/useEliminarCreacion';
import TusBorradores, { useBorradoresCrear } from '../Crear/TusBorradores';
import TarjetaMiCombo from '../Crear/TarjetaMiCombo';
import { esMiCombo, eliminarMiCombo, agruparCombos, recuperarVersion, diasParaBorrar, DIAS_VERSION_REEMPLAZADA } from '../../services/misCombos';
import { useVersionesReemplazadas } from '../Crear/useVersionesReemplazadas';
import styles from './MisCreacionesPage.module.css';
import { T } from '../../i18n/useTranslatedText';

const MisCreacionesPage = () => {
  const { user, userProfile } = useAuth();
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [intento, setIntento] = useState(0);

  const { pedir: pedirEliminar, dialogo: dialogoEliminar } = useEliminarCreacion({
    alEliminar: (d) => setDesigns((prev) => prev.filter((x) => x.id !== d.id)),
  });

  // Misma consulta (y caché) que usa <TusBorradores>: solo para saber si hay
  // borradores y separar las dos secciones con su título.
  const borradoresQuery = useBorradoresCrear(user?.uid);
  const borradores = useMemo(() => borradoresQuery.data || [], [borradoresQuery.data]);

  const dni = userProfile?.dni ? String(userProfile.dni).trim() : '';
  const { data: pedidosData, buscar: buscarPedidos } = usePedidos(dni);

  useEffect(() => {
    if (dni) {
      buscarPedidos(dni);
    }
  }, [dni, buscarPedidos]);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error: err } = await getDesignsByUser(user.uid);
      if (!cancelled) {
        setDesigns(Array.isArray(data) ? data : []);
        setError(err || null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, intento]);

  // La más reciente primero. getDesignsByUser ordena por updatedAt, pero las
  // creaciones antiguas no tienen esa fecha bien guardada (ver fechaDeCreacion).
  // Cada combo es UNA tarjeta: sus prendas no se repiten sueltas.
  const ordenados = useMemo(
    () => agruparCombos(designs, borradores).sort((a, b) => (fechaDeCreacion(b) || 0) - (fechaDeCreacion(a) || 0)),
    [designs, borradores]
  );
  const quitarCombo = async (combo) => {
    if (!window.confirm(`¿Quitar el combo "${combo.name || 'Mi combo'}"? Sus prendas siguen en tus creaciones.`)) return;
    const { error: err } = await eliminarMiCombo(combo.id);
    if (!err) setDesigns((prev) => prev.filter((x) => x.id !== combo.id));
  };

  // Versiones anteriores de las prendas de sus combos: ocultas, se recuperan
  // aquí y se borran solas a los días (ver versionesReemplazadas).
  const versiones = useVersionesReemplazadas({
    uid: user?.uid,
    creaciones: designs,
    borradores,
    listo: !loading && !error && borradoresQuery.isSuccess && !borradoresQuery.isFetching,
    alBorrar: (ids) => setDesigns((prev) => prev.filter((x) => !ids.includes(x.id))),
  });
  const [recuperando, setRecuperando] = useState(null);
  const recuperar = async (d) => {
    setRecuperando(d.id);
    const { error: err } = await recuperarVersion(d.id);
    setRecuperando(null);
    if (!err) setDesigns((prev) => prev.map((x) => (x.id === d.id ? { ...x, combo: null, reemplazadaEn: null } : x)));
  };

  const purchasedDesignIds = useMemo(() => {
    const ids = new Set();
    const pedidos = pedidosData?.pedidos || [];
    pedidos.forEach(pedido => {
      const items = pedido.productos || {};
      Object.values(items).forEach(item => {
        if (item.designId) ids.add(item.designId);
      });
    });
    return ids;
  }, [pedidosData]);

  if (!user) return null;

  const cantidad = ordenados.length;
  const hayBorradores = borradores.length > 0;

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.headerTexto}>
          <h1 className={styles.title}>
            <Sparkles className={styles.titleIcon} size={26} aria-hidden="true" />
            <T>Mis Creaciones</T>
          </h1>
          <p className={styles.subtitle}>
            {loading
              ? 'Tus diseños guardados, listos para comprar o seguir editando.'
              : cantidad > 0
                ? `${cantidad} ${cantidad === 1 ? 'diseño guardado' : 'diseños guardados'} · cómpralos o sigue editándolos cuando quieras.`
                : 'Aquí se guardan los diseños que creas.'}
          </p>
        </div>
        {(loading || cantidad > 0) && (
          <Link to="/personalizar" className={styles.primaryBtn}>
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
            Crear nuevo diseño
          </Link>
        )}
      </div>

      {loading ? (
        <ul className={styles.grid} aria-label="Cargando tus creaciones">
          {[1, 2, 3, 4, 5, 6].map((i) => <MiCreacionCardSkeleton key={i} />)}
        </ul>
      ) : error ? (
        <div className={styles.emptyState}>
          <h3><T>No pudimos cargar tus creaciones</T></h3>
          <p><T>Revisa tu conexión e inténtalo de nuevo.</T></p>
          <button type="button" className={styles.primaryBtn} onClick={() => setIntento((n) => n + 1)}>
            <RotateCcw size={17} aria-hidden="true" />
            Reintentar
          </button>
        </div>
      ) : cantidad === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Sparkles size={52} aria-hidden="true" />
          </div>
          <h3><T>Aún no tienes creaciones</T></h3>
          <p><T>Elige una prenda, ponle tu imagen o tu frase y guárdala: aquí la tendrás lista para comprar o seguir editando.</T></p>
          <Link to="/personalizar" className={styles.primaryBtn}>
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
            Empezar a crear
          </Link>
        </div>
      ) : (
        <section aria-label="Tus creaciones guardadas">
          {hayBorradores && (
            <div className={styles.seccionCabecera}>
              <h2 className={styles.seccionTitulo}><T>Guardadas</T></h2>
              <p className={styles.seccionAyuda}><T>Listas para comprar o seguir editando.</T></p>
            </div>
          )}
          <ul className={styles.grid}>
            {ordenados.map((d) => (esMiCombo(d) ? (
              <TarjetaMiCombo
                key={d.id}
                design={d}
                onEliminar={quitarCombo}
                onRenombrado={(id, nuevo) => setDesigns((prev) => prev.map((x) => (x.id === id ? { ...x, name: nuevo } : x)))}
                onComunidad={(id, estado) => setDesigns((prev) => prev.map((x) => (x.id === id ? { ...x, comunidad: estado } : x)))}
              />
            ) : (
              <MiCreacionCard
                key={d.id}
                design={d}
                isPurchased={purchasedDesignIds.has(d.id)}
                onEliminar={(diseno) => pedirEliminar(diseno, { enPedido: purchasedDesignIds.has(diseno.id) })}
                onRenombrado={(id, nuevo) => setDesigns((prev) => prev.map((x) => (x.id === id ? { ...x, name: nuevo } : x)))}
                onComunidad={(id, estado) => setDesigns((prev) => prev.map((x) => (x.id === id ? { ...x, comunidad: estado } : x)))}
              />
            )))}
          </ul>
        </section>
      )}

      {!loading && versiones.length > 0 && (
        <details className={styles.versiones}>
          <summary>
            <History size={17} aria-hidden="true" />
            Versiones anteriores de tus combos ({versiones.length})
          </summary>
          <p className={styles.versionesAyuda}>
            Son diseños que tus combos ya no usan (los cambiaste por otro). No salen en tus creaciones y se
            borran solos a los {DIAS_VERSION_REEMPLAZADA} días. Recupera los que quieras guardar.
          </p>
          <ul className={styles.versionesLista}>
            {versiones.map((d) => {
              const imagen = d.vistasPrevias?.[0]?.url || d.previewUrl || '';
              const dias = diasParaBorrar(d);
              const enPedido = d.enPedido === true || purchasedDesignIds.has(d.id);
              return (
                <li key={d.id} className={styles.version}>
                  {imagen ? <img src={imagen} alt="" className={styles.versionImagen} /> : <span className={styles.versionImagen} />}
                  <div className={styles.versionTexto}>
                    <strong>{d.name || 'Mi diseño'}</strong>
                    <span>
                      {d.combo?.nombre ? `${d.combo.nombre} · ` : ''}
                      {enPedido
                        ? 'Está en un pedido: no se borra sola'
                        : dias > 0 ? `Se borra en ${dias} ${dias === 1 ? 'día' : 'días'}` : 'Se borra hoy'}
                    </span>
                  </div>
                  <div className={styles.versionAcciones}>
                    <button type="button" className={styles.versionRecuperar} onClick={() => recuperar(d)} disabled={recuperando === d.id}>
                      Recuperar
                    </button>
                    <button
                      type="button"
                      className={styles.versionEliminar}
                      onClick={() => pedirEliminar(d, { enPedido })}
                      aria-label={`Eliminar ${d.name || 'este diseño'} ya`}
                      title="Eliminar ya"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {/* Los borradores van después: lo principal de esta sección son las
          creaciones terminadas. En Crear van primero (ahí se viene a diseñar). */}
      {!loading && (
        <div className={styles.borradoresDespues}>
          <TusBorradores uid={user.uid} />
        </div>
      )}
      {dialogoEliminar}
    </div>
  );
};

export default MisCreacionesPage;
