import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getSurveyConfig, saveSurveyConfig, configEntregaPanel } from '../../services/encuestaConfig';
import { resumenEntregas } from '../../services/encuestaEntrega.mjs';
import { useGlobalToast } from '../../contexts/ToastContext';
// Mismo diseño que "Respuestas de la encuesta".
import styles from './AdminRespuestasEncuesta.module.css';

/* ============================================================================
 * "⭐ Encuesta de entregas": "¿Cómo te fue con tu pedido?"
 * ----------------------------------------------------------------------------
 * Arriba, la config (tienda_encuesta_config/global → entregaPanel): prendida o
 * no, monedas de premio y las opciones de "¿Qué podemos mejorar?". Abajo, las
 * respuestas: las lee el servidor (resultadosEncuestaEntrega), porque la
 * colección encuestas_entrega no tiene reglas para el navegador.
 * ========================================================================== */

const Barras = ({ items, base }) => {
  const tope = base || Math.max(1, ...items.map((x) => x.total));
  if (!items.length) return <p className={styles.vacio}>Sin respuestas todavía.</p>;
  return (
    <ul className={styles.barras}>
      {items.map((x) => (
        <li key={x.valor} className={styles.barra}>
          <span className={styles.barraTexto}>
            <span className={styles.barraValor}>{x.valor}</span>
            <span className={styles.barraTotal}>{x.total}</span>
          </span>
          <span className={styles.barraFondo} aria-hidden="true">
            <span className={styles.barraRelleno} style={{ width: `${Math.round((x.total / tope) * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
};

const RANGOS = [
  { id: 'todo', label: 'Todo', dias: 0 },
  { id: '7d', label: 'Últimos 7 días', dias: 7 },
  { id: '30d', label: 'Últimos 30 días', dias: 30 },
  { id: '90d', label: 'Últimos 90 días', dias: 90 },
];

const fecha = (ms) => (ms ? new Date(ms).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

const AdminEncuestaEntregas = () => {
  const toast = useGlobalToast();

  // ── Config ──
  const [cfg, setCfg] = useState(null);
  const [opcionesTexto, setOpcionesTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    getSurveyConfig().then(({ data }) => {
      const c = configEntregaPanel(data?.entregaPanel);
      setCfg(c);
      setOpcionesTexto(c.opcionesMejorar.join(', '));
    });
  }, []);
  const guardar = async () => {
    const entregaPanel = configEntregaPanel({
      ...cfg,
      opcionesMejorar: opcionesTexto.split(',').map((o) => o.trim()).filter(Boolean),
    });
    setGuardando(true);
    const { error } = await saveSurveyConfig({ entregaPanel });
    setGuardando(false);
    if (error) { toast.error('No se pudo guardar.'); return; }
    setCfg(entregaPanel);
    setOpcionesTexto(entregaPanel.opcionesMejorar.join(', '));
    toast.success('Encuesta de entregas guardada.');
  };

  // ── Respuestas ──
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-encuesta-entregas'],
    queryFn: async () => (await httpsCallable(getFunctions(), 'resultadosEncuestaEntrega')()).data,
    staleTime: 5 * 60 * 1000,
  });
  const [rango, setRango] = useState('todo');
  const [verTodos, setVerTodos] = useState(20);
  const enRango = useMemo(() => {
    const dias = RANGOS.find((r) => r.id === rango)?.dias || 0;
    const lista = data?.respuestas || [];
    return dias ? lista.filter((r) => r.fecha >= Date.now() - dias * 86400000) : lista;
  }, [data, rango]);
  const resumen = useMemo(() => resumenEntregas(enRango, cfg?.opcionesMejorar || []), [enRango, cfg]);

  return (
    <div className={styles.pagina}>
      <header className={styles.encabezado}>
        <div>
          <h1 className={styles.titulo}>⭐ Encuesta de entregas</h1>
          <p className={styles.subtitulo}>
            &quot;¿Cómo te fue con tu pedido?&quot;: llega con el aviso de pedido entregado y está en el detalle de
            cada pedido entregado (Mis pedidos). Una respuesta por pedido.
          </p>
        </div>
        <div className={styles.acciones}>
          <button type="button" className={styles.btnSecundario} onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Actualizando…' : '⟳ Actualizar'}
          </button>
        </div>
      </header>

      {cfg && (
        <article className={styles.card}>
          <h3>Configuración</h3>
          <label className={styles.nota}>
            <input type="checkbox" checked={cfg.activo} onChange={(e) => setCfg({ ...cfg, activo: e.target.checked })} />{' '}
            Encuesta prendida (apagada: el aviso de entregado vuelve a llevar a Mis pedidos y no se aceptan respuestas)
          </label>
          <label className={styles.nota}>
            Monedas por responder (0 a 50):{' '}
            <input type="number" min="0" max="50" value={cfg.monedas} onChange={(e) => setCfg({ ...cfg, monedas: Number(e.target.value) })} style={{ width: '5rem' }} />
          </label>
          <label className={styles.nota}>
            Opciones de &quot;¿Qué podemos mejorar?&quot; (separadas por comas; se eligen con un toque, varias):
            <input type="text" className={styles.buscar} value={opcionesTexto} onChange={(e) => setOpcionesTexto(e.target.value)} />
          </label>
          <div>
            <button type="button" className={styles.btnPrimario} onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </div>
        </article>
      )}

      {error && <p className={styles.error}>No se pudieron cargar las respuestas: {error.message}</p>}
      {isLoading && <p className={styles.vacio}>Cargando respuestas…</p>}

      {data && (
        <>
          <div className={styles.pestanas} role="group" aria-label="Rango de fechas">
            {RANGOS.map((r) => (
              <button key={r.id} type="button" className={rango === r.id ? styles.chipActivo : styles.chip} aria-pressed={rango === r.id} onClick={() => setRango(r.id)}>
                {r.label}
              </button>
            ))}
          </div>

          <section className={styles.kpis}>
            <div className={`${styles.kpi} ${styles.kpiDestacado}`}><span>{resumen.total}</span>respuestas</div>
            <div className={`${styles.kpi} ${styles.kpiDestacado}`}><span>{resumen.total ? `${resumen.promedio} ★` : '—'}</span>promedio</div>
            <div className={styles.kpi}><span>{resumen.total ? `${resumen.contentos}%` : '—'}</span>pusieron 4 o 5 estrellas</div>
          </section>

          <section className={styles.grid}>
            <article className={styles.card}>
              <h3>¿Cómo te fue con tu pedido?</h3>
              <Barras items={resumen.porEstrellas} base={resumen.total || 1} />
            </article>
            <article className={styles.card}>
              <h3>¿Qué podemos mejorar?</h3>
              <p className={styles.nota}>Pueden elegir varias: los totales no suman las respuestas.</p>
              <Barras items={resumen.mejorar} base={resumen.total || 1} />
            </article>
          </section>

          <h2 className={styles.seccion}>Comentarios ({resumen.comentarios.length})</h2>
          {resumen.comentarios.length === 0 ? (
            <p className={styles.vacio}>Todavía no hay comentarios.</p>
          ) : (
            <ul className={styles.cambios}>
              {resumen.comentarios.slice(0, verTodos).map((c) => (
                <li key={c.id} className={styles.cambio}>
                  <p className={styles.donde}>{'★'.repeat(c.estrellas)}{'☆'.repeat(5 - c.estrellas)} · Pedido {c.codigo} · {fecha(c.fecha)}</p>
                  <p>{c.comentario}</p>
                  <p className={styles.nota}>
                    {c.nombre || 'Sin nombre'}{c.email ? ` · ${c.email}` : ''}{c.mejorar.length ? ` · Mejorar: ${c.mejorar.join(', ')}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {resumen.comentarios.length > verTodos && (
            <button type="button" className={styles.btnSecundario} onClick={() => setVerTodos((n) => n + 30)}>
              Ver más ({resumen.comentarios.length - verTodos} restantes)
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default AdminEncuestaEntregas;
