import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCollection } from '../../services/firebase/firestore';
import { PORTAL_USERS_COLLECTION } from '../../constants/userCollections';
import { getSurveyConfig, DEFAULT_SURVEY_CONFIG } from '../../services/encuestaConfig';
import { resumenEncuesta, fichaCliente, csvRespuestas } from '../../services/surveyResponses.mjs';
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

const AdminRespuestasEncuesta = () => {
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

  const resumen = useMemo(() => (data ? resumenEncuesta(data.usuarios, data.config) : null), [data]);

  const clientes = useMemo(() => {
    if (!data) return [];
    const q = buscar.trim().toLowerCase();
    return data.usuarios
      .map((u) => ({ u, nombre: u.displayName || u.surveyBasicData?.nombres || 'Sin nombre' }))
      .filter(({ u, nombre }) => !q || `${nombre} ${u.email || ''} ${u.phone || ''}`.toLowerCase().includes(q))
      .sort((a, b) => (b.u.giftRecipients?.length || 0) - (a.u.giftRecipients?.length || 0));
  }, [data, buscar]);

  const descargar = () => {
    if (!data) return;
    const csv = csvRespuestas(data.usuarios, data.config);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `respuestas-encuesta-${new Date().toISOString().slice(0, 10)}.csv`;
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

      {resumen && (
        <>
          <section className={styles.kpis}>
            <div className={styles.kpi}><span>{resumen.clientes}</span>clientes completaron la encuesta</div>
            <div className={styles.kpi}><span>{resumen.personas}</span>personas cargadas para regalar</div>
            <div className={styles.kpi}><span>{resumen.conCumpleanos}</span>clientes dieron su cumpleaños</div>
            <div className={styles.kpi}><span>{resumen.conPresupuesto}</span>personas con presupuesto</div>
          </section>

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
