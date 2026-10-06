import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCollection } from '../../services/firebase/firestore';
import { PORTAL_USERS_COLLECTION } from '../../constants/userCollections';
import { getSurveyConfig, DEFAULT_SURVEY_CONFIG } from '../../services/encuestaConfig';
import {
  resumenEncuesta, fichaCliente, csvRespuestas,
  fechaEncuesta, fechaEsEstimada, filtrarPorFecha, porPeriodo, textoFechaEncuesta, diaLocal,
} from '../../services/surveyResponses.mjs';
import styles from './AdminRespuestasEncuesta.module.css';

/* ============================================================================
 * "📋 Respuestas de la encuesta"
 * ----------------------------------------------------------------------------
 * Lo que contestaron los clientes en la encuesta de suscripción: resumen por
 * pregunta, a quiénes regalan, gustos más pedidos por conjunto (equipos,
 * animes, tipo de piel…), presupuesto, detalle por cliente y descarga en Excel.
 * Lee una vez los perfiles con la encuesta completa (react-query, 5 min).
 * ========================================================================== */

// Lista de barras (valor + total + % del máximo).
const Barras = ({ items, max = 8, base }) => {
  const lista = items.slice(0, max);
  const tope = base || Math.max(1, ...lista.map((x) => x.total));
  if (lista.length === 0) return <p className={styles.vacio}>Sin respuestas todavía.</p>;
  return (
    <ul className={styles.barras}>
      {lista.map((x) => (
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

// ── Rango de fechas ─────────────────────────────────────────────────────────
const RANGOS = [
  { id: 'todo', label: 'Todo' },
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: 'Últimos 7 días' },
  { id: '30d', label: 'Últimos 30 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mesPasado', label: 'Mes pasado' },
];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

function calcularRango(id) {
  const hoy = new Date();
  const dia = (d) => diaLocal(d.getTime());
  const haceDias = (n) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - n);
  switch (id) {
    case 'hoy': return { desde: dia(hoy), hasta: dia(hoy) };
    case '7d': return { desde: dia(haceDias(6)), hasta: dia(hoy) };
    case '30d': return { desde: dia(haceDias(29)), hasta: dia(hoy) };
    case 'mes': return { desde: dia(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: dia(hoy) };
    case 'mesPasado': return {
      desde: dia(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
      hasta: dia(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
    };
    default: return { desde: '', hasta: '' };
  }
}

const diasEntre = (desde, hasta) => Math.round((new Date(`${hasta}T00:00`) - new Date(`${desde}T00:00`)) / 86400000) + 1;

const etiquetaPeriodo = (valor, unidad) => {
  if (unidad === 'dia') {
    const [, m, d] = valor.split('-');
    return `${d}/${m}`;
  }
  const [y, m] = valor.split('-');
  return `${MESES[Number(m) - 1]} ${y}`;
};

const AdminRespuestasEncuesta = () => {
  const [rangoId, setRangoId] = useState('todo');
  const [rango, setRango] = useState({ desde: '', hasta: '' });
  const elegirRango = (id) => {
    setRangoId(id);
    setRango(calcularRango(id));
  };
  const cambiarFecha = (campo) => (e) => {
    setRangoId('personalizado');
    setRango((r) => ({ ...r, [campo]: e.target.value }));
  };
  const [buscar, setBuscar] = useState('');
  const [abierto, setAbierto] = useState(null);
  const [verTodos, setVerTodos] = useState(30);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-respuestas-encuesta'],
    queryFn: async () => {
      const [usuariosRes, configRes] = await Promise.all([
        getCollection(PORTAL_USERS_COLLECTION, [{ field: 'hasCompletedSurvey', operator: '==', value: true }]),
        getSurveyConfig(),
      ]);
      if (usuariosRes.error) throw new Error(usuariosRes.error);
      return {
        usuarios: usuariosRes.data || [],
        config: { ...DEFAULT_SURVEY_CONFIG, ...(configRes.data || {}) },
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const hayRango = Boolean(rango.desde || rango.hasta);
  const enRango = useMemo(
    () => (data ? filtrarPorFecha(data.usuarios, rango.desde, rango.hasta) : []),
    [data, rango.desde, rango.hasta],
  );
  const resumen = useMemo(() => (data ? resumenEncuesta(enRango, data.config) : null), [data, enRango]);

  const fechas = useMemo(() => {
    if (!data) return null;
    const conFecha = data.usuarios.filter(fechaEncuesta);
    // Por día si el rango es corto; si no, por mes.
    const unidad = rango.desde && diasEntre(rango.desde, rango.hasta || diaLocal(Date.now())) <= 62 ? 'dia' : 'mes';
    return {
      sinFecha: data.usuarios.length - conFecha.length,
      estimadas: enRango.filter(fechaEsEstimada).length,
      unidad,
      periodos: porPeriodo(enRango, unidad).map((p) => ({ ...p, valor: etiquetaPeriodo(p.valor, unidad) })),
    };
  }, [data, enRango, rango.desde, rango.hasta]);

  const clientes = useMemo(() => {
    if (!data) return [];
    const q = buscar.trim().toLowerCase();
    return enRango
      .map((u) => ({ u, nombre: u.displayName || u.surveyBasicData?.nombres || 'Sin nombre' }))
      .filter(({ u, nombre }) => !q || `${nombre} ${u.email || ''} ${u.phone || ''}`.toLowerCase().includes(q))
      .sort((a, b) => fechaEncuesta(b.u) - fechaEncuesta(a.u));
  }, [data, enRango, buscar]);

  const descargar = () => {
    if (!data) return;
    const csv = csvRespuestas(enRango, data.config);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    const sufijo = hayRango ? `${rango.desde || 'inicio'}_a_${rango.hasta || 'hoy'}` : new Date().toISOString().slice(0, 10);
    a.download = `respuestas-encuesta-${sufijo}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.pagina}>
      <header className={styles.encabezado}>
        <div>
          <h1 className={styles.titulo}>📋 Respuestas de la encuesta</h1>
          <p className={styles.subtitulo}>
            Lo que contestaron los clientes: sus datos, a quiénes regalan y los gustos de cada persona.
            Los gustos más pedidos te dicen qué productos conviene tener.
          </p>
        </div>
        <div className={styles.acciones}>
          <Link to="/admin/encuestas" className={styles.btnSecundario}>Editar la encuesta</Link>
          <button type="button" className={styles.btnSecundario} onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Actualizando…' : '⟳ Actualizar'}
          </button>
          <button type="button" className={styles.btnPrimario} onClick={descargar} disabled={!data}>
            ⬇ Descargar Excel (CSV)
          </button>
        </div>
      </header>

      {error && <p className={styles.error}>No se pudieron cargar las respuestas: {error.message}</p>}
      {isLoading && <p className={styles.vacio}>Cargando respuestas…</p>}

      {data && (
        <section className={styles.rango} aria-label="Rango de fechas">
          <div className={styles.rangoBotones}>
            {RANGOS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={rangoId === r.id ? styles.chipActivo : styles.chip}
                onClick={() => elegirRango(r.id)}
                aria-pressed={rangoId === r.id}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className={styles.rangoFechas}>
            <label>Desde <input type="date" value={rango.desde} max={rango.hasta || undefined} onChange={cambiarFecha('desde')} /></label>
            <label>Hasta <input type="date" value={rango.hasta} min={rango.desde || undefined} onChange={cambiarFecha('hasta')} /></label>
          </div>
        </section>
      )}

      {resumen && fechas && (
        <>
          <section className={styles.kpis}>
            <div className={`${styles.kpi} ${styles.kpiDestacado}`}>
              <span>{enRango.length}</span>
              {hayRango ? `completaron la encuesta en este rango (de ${data.usuarios.length} en total)` : 'clientes completaron la encuesta'}
            </div>
            <div className={styles.kpi}><span>{resumen.personas}</span>personas cargadas para regalar</div>
            <div className={styles.kpi}><span>{resumen.conCumpleanos}</span>clientes dieron su cumpleaños</div>
            <div className={styles.kpi}><span>{resumen.conPresupuesto}</span>personas con presupuesto</div>
          </section>

          {fechas.sinFecha === data.usuarios.length ? (
            <p className={styles.aviso}>
              Todavía no hay fechas guardadas: al filtrar por fechas no aparece nadie hasta que se complete la fecha de quienes ya la llenaron.
            </p>
          ) : (
            <article className={styles.card}>
              <h3>Encuestas completadas por {fechas.unidad === 'dia' ? 'día' : 'mes'}</h3>
              <p className={styles.nota}>
                {fechas.estimadas > 0 && `${fechas.estimadas} con fecha aproximada: la llenaron antes del 06/10/2026, cuando aún no se guardaba la fecha, y se dedujo de su visita a la encuesta. `}
                {!hayRango && fechas.sinFecha > 0 && `${fechas.sinFecha} sin fecha (no aparecen al filtrar por fechas).`}
              </p>
              {fechas.periodos.length === 0
                ? <p className={styles.vacio}>Nadie completó la encuesta en este rango.</p>
                : <Barras items={fechas.periodos} max={fechas.periodos.length} />}
            </article>
          )}

          <section className={styles.grid}>
            {resumen.basicos.map((b) => (
              <article key={b.id} className={styles.card}>
                <h3>{b.label}</h3>
                <p className={styles.nota}>{b.respondieron} respuestas</p>
                <Barras items={b.opciones} base={b.respondieron || 1} />
              </article>
            ))}
            <article className={styles.card}>
              <h3>¿A quiénes suelen regalar?</h3>
              <p className={styles.nota}>Clientes que marcaron cada grupo</p>
              <Barras items={resumen.aQuien} base={resumen.clientes || 1} />
            </article>
            <article className={styles.card}>
              <h3>¿Cuánto suelen gastar por regalo?</h3>
              <p className={styles.nota}>{resumen.conPresupuesto} de {resumen.personas} personas tienen presupuesto</p>
              <Barras items={resumen.presupuesto} />
            </article>
          </section>

          <h2 className={styles.seccion}>Gustos más pedidos</h2>
          <section className={styles.grid}>
            {resumen.gustos.map((g) => (
              <article key={g.id} className={styles.card}>
                <h3>{g.nombre}</h3>
                <p className={styles.nota}>{g.personas} personas con este conjunto</p>
                {g.preguntas.map((q) => (
                  <div key={q.id} className={styles.pregunta}>
                    <p className={styles.preguntaTitulo}>{q.label} <span>({q.respondieron})</span></p>
                    <Barras items={q.top} max={10} />
                  </div>
                ))}
              </article>
            ))}
          </section>

          <h2 className={styles.seccion}>Por cliente</h2>
          <input
            type="search"
            className={styles.buscar}
            placeholder="Buscar por nombre, correo o teléfono…"
            value={buscar}
            onChange={(e) => { setBuscar(e.target.value); setVerTodos(30); }}
          />
          <ul className={styles.clientes}>
            {clientes.slice(0, verTodos).map(({ u, nombre }) => {
              const id = u.id || u.uid;
              const abiertoAqui = abierto === id;
              const ficha = abiertoAqui ? fichaCliente(u, data.config) : null;
              return (
                <li key={id} className={styles.cliente}>
                  <button type="button" className={styles.clienteFila} onClick={() => setAbierto(abiertoAqui ? null : id)} aria-expanded={abiertoAqui}>
                    <span className={styles.clienteNombre}>{nombre}</span>
                    <span className={styles.nota}>{u.email || 'sin correo'}</span>
                    {fechaEncuesta(u) > 0 && (
                      <span className={styles.nota} title={fechaEsEstimada(u) ? 'Fecha aproximada' : 'Fecha exacta'}>
                        📅 {textoFechaEncuesta(u)}
                      </span>
                    )}
                    <span className={styles.badge}>{u.giftRecipients?.length || 0} personas</span>
                    <span aria-hidden="true">{abiertoAqui ? '▲' : '▼'}</span>
                  </button>
                  {ficha && (
                    <div className={styles.ficha}>
                      <div className={styles.fichaDatos}>
                        {ficha.telefono && <p><strong>Teléfono:</strong> {ficha.telefono}</p>}
                        {ficha.cumpleanos && <p><strong>Su cumpleaños:</strong> {ficha.cumpleanos}</p>}
                        {ficha.basicos.map((b) => <p key={b.label}><strong>{b.label}</strong> {b.valor}</p>)}
                        {ficha.aQuien.length > 0 && <p><strong>Regala a:</strong> {ficha.aQuien.join(', ')}</p>}
                      </div>
                      {ficha.personas.length === 0 ? (
                        <p className={styles.vacio}>No cargó personas.</p>
                      ) : (
                        <div className={styles.personas}>
                          {ficha.personas.map((p, i) => (
                            <div key={`${p.nombre}-${i}`} className={styles.persona}>
                              <p className={styles.personaNombre}>{p.nombre} <span>· {p.relacion}{p.genero ? ` · ${p.genero}` : ''}</span></p>
                              {p.fechas.length > 0 && <p className={styles.nota}>📅 {p.fechas.join(' · ')}</p>}
                              {p.presupuesto && <p className={styles.nota}>💰 {p.presupuesto}</p>}
                              {p.gustos.length === 0 ? (
                                <p className={styles.nota}>Sin gustos cargados.</p>
                              ) : p.gustos.map((g) => (
                                <p key={g.conjunto} className={styles.gusto}>
                                  <strong>{g.conjunto}:</strong>{' '}
                                  {g.respuestas.length ? g.respuestas.map((r) => r.valor).join(' · ') : 'marcado, sin respuestas'}
                                </p>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {clientes.length > verTodos && (
            <button type="button" className={styles.btnSecundario} onClick={() => setVerTodos((n) => n + 50)}>
              Ver más ({clientes.length - verTodos} restantes)
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default AdminRespuestasEncuesta;
