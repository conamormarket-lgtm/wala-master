import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCollection } from '../../services/firebase/firestore';
import { PORTAL_USERS_COLLECTION } from '../../constants/userCollections';
import { getSurveyConfig, saveSurveyConfig, DEFAULT_SURVEY_CONFIG } from '../../services/encuestaConfig';
import { configConHistorial } from '../../services/encuestaHistorial.mjs';
import { useGlobalToast } from '../../contexts/ToastContext';
import {
  resumenEncuesta, fichaCliente, csvRespuestas,
  fechaEncuesta, filtrarPorFecha, porPeriodo, textoFechaEncuesta, diaLocal, embudoEncuesta, EMBUDO_DESDE,
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
// Marca de una pregunta que el admin quitó de la encuesta (enEncuesta: false
// o la casilla del presupuesto apagada): sus respuestas son de antes.
// '2026-10-23' → '23/10/2026'.
const fechaCorta = (dia) => (/^\d{4}-\d{2}-\d{2}/.test(dia || '') ? dia.slice(0, 10).split('-').reverse().join('/') : '');

const Retirada = ({ desde }) => (
  <span className={styles.retirada} title="Ya no sale en la encuesta. Las respuestas son de antes de quitarla.">
    Ya no se pregunta{fechaCorta(desde) && ` desde el ${fechaCorta(desde)}`}
  </span>
);

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

  // Embudo: los pasos de la encuesta (analytics_events, survey_step) en el mismo rango de fechas.
  const desdeEmbudo = rango.desde && rango.desde > EMBUDO_DESDE ? rango.desde : EMBUDO_DESDE;
  const { data: embudo, isLoading: cargandoEmbudo, error: errorEmbudo } = useQuery({
    queryKey: ['admin-embudo-encuesta', desdeEmbudo, rango.hasta],
    queryFn: async () => {
      const filtros = [
        { field: 'type', operator: '==', value: 'survey_step' },
        { field: 'clientTsMs', operator: '>=', value: new Date(`${desdeEmbudo}T00:00`).getTime() },
      ];
      if (rango.hasta) filtros.push({ field: 'clientTsMs', operator: '<=', value: new Date(`${rango.hasta}T23:59:59.999`).getTime() });
      const res = await getCollection('analytics_events', filtros);
      if (res.error) throw new Error(res.error);
      return embudoEncuesta(res.data || []);
    },
    staleTime: 5 * 60 * 1000,
  });
  // Pestaña "La encuesta actual" | "Cambiadas o retiradas".
  const [vista, setVista] = useState('actual');

  // "Volver a preguntarla": la misma pregunta vuelve a la encuesta (sus
  // respuestas de antes se suman a las nuevas). Lee la config guardada, la
  // cambia y guarda con el historial (se borra la fecha de retiro).
  const toast = useGlobalToast();
  const [reactivando, setReactivando] = useState('');
  const reactivar = async (clave, cambiar) => {
    if (!window.confirm('¿Volver a hacer esta pregunta en la encuesta? Sus respuestas de antes se suman a las nuevas.')) return;
    setReactivando(clave);
    try {
      const { data: actual, error: errorLeer } = await getSurveyConfig();
      if (errorLeer || !actual) throw new Error(errorLeer || 'No se encontró la encuesta.');
      const { error: errorGuardar } = await saveSurveyConfig(configConHistorial(cambiar(actual), actual));
      if (errorGuardar) throw new Error(errorGuardar);
      await refetch();
      toast.success('Listo: la pregunta vuelve a salir en la encuesta.');
    } catch (err) {
      toast.error(`No se pudo: ${err.message}`);
    } finally {
      setReactivando('');
    }
  };
  const activarCampo = (f) => ({ ...f, enEncuesta: true });
  const reactivarBasico = (id) => reactivar(`b-${id}`, (c) => ({
    ...c, basicDataPanel: { ...c.basicDataPanel, fields: c.basicDataPanel.fields.map((f) => (f.id === id ? activarCampo(f) : f)) },
  }));
  const reactivarGusto = (catId, id) => reactivar(`q-${catId}-${id}`, (c) => ({
    ...c,
    brandsPanel: {
      ...c.brandsPanel,
      categories: c.brandsPanel.categories.map((cat) => (cat.id === catId ? { ...cat, fields: cat.fields.map((f) => (f.id === id ? activarCampo(f) : f)) } : cat)),
    },
  }));
  const reactivarPresupuesto = () => reactivar('presupuesto', (c) => ({ ...c, personPanel: { ...c.personPanel, budget: true } }));
  const BotonReactivar = ({ clave, onClick }) => (
    <button type="button" className={`${styles.btnSecundario} ${styles.reactivar}`} onClick={onClick} disabled={Boolean(reactivando)}>
      {reactivando === clave ? 'Guardando…' : '↺ Volver a preguntarla'}
    </button>
  );
  const preguntas = useMemo(() => {
    if (!resumen) return null;
    const gustos = resumen.gustos.map((g) => ({
      ...g,
      actuales: g.preguntas.filter((q) => !q.retirada),
      retiradas: g.preguntas.filter((q) => q.retirada),
    }));
    const basicosRetirados = resumen.basicos.filter((b) => b.retirada);
    // Lo que cambió de texto: preguntas de "Sobre ti", de cada interés y el nombre del interés.
    const cambiadas = [
      ...resumen.basicos.filter((b) => b.antes.length).map((b) => ({ clave: `b-${b.id}`, donde: 'Sobre ti', ahora: b.label, antes: b.antes, retirada: b.retirada })),
      ...resumen.gustos.filter((g) => g.antes.length).map((g) => ({ clave: `g-${g.id}`, donde: 'Nombre de un interés', ahora: g.nombre, antes: g.antes })),
      ...gustos.flatMap((g) => g.preguntas.filter((q) => q.antes.length).map((q) => ({ clave: `q-${g.id}-${q.id}`, donde: `Interés · ${g.nombre}`, ahora: q.label, antes: q.antes, retirada: q.retirada }))),
    ];
    return {
      basicos: resumen.basicos.filter((b) => !b.retirada),
      basicosRetirados,
      gustos,
      cambiadas,
      retiradas: basicosRetirados.length + (resumen.presupuestoRetirado ? 1 : 0) + gustos.reduce((n, g) => n + g.retiradas.length, 0),
    };
  }, [resumen]);

  const fechas = useMemo(() => {
    if (!data) return null;
    const conFecha = data.usuarios.filter(fechaEncuesta);
    // Por día si el rango es corto; si no, por mes.
    const unidad = rango.desde && diasEntre(rango.desde, rango.hasta || diaLocal(Date.now())) <= 62 ? 'dia' : 'mes';
    return {
      sinFecha: data.usuarios.length - conFecha.length,
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

      {resumen && fechas && preguntas && (
        <>
          <section className={styles.kpis}>
            <div className={`${styles.kpi} ${styles.kpiDestacado}`}>
              <span>{data.usuarios.length}</span>
              clientes han realizado la encuesta (total)
            </div>
            {hayRango && (
              <div className={`${styles.kpi} ${styles.kpiDestacado}`}>
                <span>{enRango.length}</span>
                la realizaron en este rango de fechas
              </div>
            )}
            <div className={styles.kpi}>
              <span>{fechas.sinFecha}</span>
              con fecha desconocida (la llenaron antes del 29/06/2026)
            </div>
            <div className={styles.kpi}><span>{resumen.personas}</span>personas cargadas para regalar</div>
            <div className={styles.kpi}><span>{resumen.conCumpleanos}</span>clientes dieron su cumpleaños</div>
            <div className={styles.kpi}><span>{resumen.conPresupuesto}</span>personas con presupuesto{resumen.presupuestoRetirado && ' (ya no se pregunta)'}</div>
          </section>

          <article className={styles.card}>
            <h3>Embudo de la encuesta</h3>
            <p className={styles.nota}>
              Personas distintas que llegaron a cada paso, y su % sobre las que entraron. Se registra desde el{' '}
              {EMBUDO_DESDE.split('-').reverse().join('/')}: antes de esa fecha no hay datos de pasos.
            </p>
            {errorEmbudo && <p className={styles.error}>No se pudo cargar el embudo: {errorEmbudo.message}</p>}
            {cargandoEmbudo && <p className={styles.vacio}>Cargando el embudo…</p>}
            {embudo && (embudo[0].total === 0 ? (
              <p className={styles.vacio}>Nadie entró a la encuesta en este rango todavía.</p>
            ) : (
              <ul className={styles.barras}>
                {embudo.map((p) => (
                  <li key={p.id} className={`${styles.barra} ${p.aparte ? styles.embudoAparte : ''}`}>
                    <span className={styles.barraTexto}>
                      <span className={styles.barraValor}>
                        {p.label}{p.nota && <span className={styles.embudoNota}> · {p.nota}</span>}
                      </span>
                      <span className={styles.barraTotal}>{p.total} <span className={styles.embudoNota}>({p.porcentaje}%)</span></span>
                    </span>
                    <span className={styles.barraFondo} aria-hidden="true">
                      <span className={styles.barraRelleno} style={{ width: `${p.porcentaje}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            ))}
          </article>

          <article className={styles.card}>
            <h3>Encuestas completadas por {fechas.unidad === 'dia' ? 'día' : 'mes'}</h3>
            <p className={styles.nota}>
              Solo fechas reales. {fechas.sinFecha > 0 && `Los ${fechas.sinFecha} con fecha desconocida cuentan en el total, pero no aparecen al filtrar por fechas.`}
            </p>
            {fechas.periodos.length === 0
              ? <p className={styles.vacio}>Nadie completó la encuesta en este rango.</p>
              : <Barras items={fechas.periodos} max={fechas.periodos.length} />}
          </article>

          <div className={styles.pestanas} role="tablist" aria-label="Qué preguntas ver">
            <button type="button" role="tab" aria-selected={vista === 'actual'} className={vista === 'actual' ? styles.chipActivo : styles.chip} onClick={() => setVista('actual')}>
              La encuesta actual
            </button>
            <button type="button" role="tab" aria-selected={vista === 'cambios'} className={vista === 'cambios' ? styles.chipActivo : styles.chip} onClick={() => setVista('cambios')}>
              Cambiadas o retiradas ({preguntas.retiradas + preguntas.cambiadas.length})
            </button>
          </div>

          {vista === 'actual' ? (
            <>
              <p className={styles.nota}>
                Las preguntas en el orden en que las ve el cliente, con lo que van respondiendo. Se cambian
                desde <Link to="/admin/encuestas">Editar la encuesta</Link>.
              </p>

              <h2 className={styles.seccion}>Paso 1 · Sobre ti</h2>
              <p className={styles.nota}>El nombre no se pregunta: sale de su cuenta, donde es obligatorio.</p>
              <section className={styles.grid}>
                <article className={styles.card}>
                  <h3>Tu cumpleaños</h3>
                  <p className={styles.nota}>Solo se le pregunta a quien no lo tiene en su cuenta.</p>
                  <Barras
                    items={[{ valor: 'Lo tienen', total: resumen.conCumpleanos }, { valor: 'No lo tienen', total: resumen.clientes - resumen.conCumpleanos }]}
                    base={resumen.clientes || 1}
                  />
                </article>
                {preguntas.basicos.map((b) => (
                  <article key={b.id} className={styles.card}>
                    <h3>{b.label}</h3>
                    <p className={styles.nota}>{b.respondieron} respuestas</p>
                    <Barras items={b.opciones} base={b.respondieron || 1} />
                  </article>
                ))}
              </section>

              <h2 className={styles.seccion}>Paso 2 · ¿A quiénes sueles regalar?</h2>
              <section className={styles.grid}>
                <article className={styles.card}>
                  <h3>¿A quiénes suelen regalar?</h3>
                  <p className={styles.nota}>Clientes que marcaron cada grupo</p>
                  <Barras items={resumen.aQuien} base={resumen.clientes || 1} />
                </article>
              </section>

              <h2 className={styles.seccion}>Paso 3 · Cada persona</h2>
              <p className={styles.nota}>
                {resumen.personas} personas cargadas. Cada interés es un botón: al tocarlo salen sus preguntas.
              </p>
              <section className={styles.grid}>
                {!resumen.presupuestoRetirado && (
                  <article className={styles.card}>
                    <h3>¿Cuánto suelen gastar por regalo?</h3>
                    <p className={styles.nota}>{resumen.conPresupuesto} de {resumen.personas} personas tienen presupuesto</p>
                    <Barras items={resumen.presupuesto} />
                  </article>
                )}
                {preguntas.gustos.map((g) => (
                  <article key={g.id} className={styles.card}>
                    <p className={styles.donde}>Interés</p>
                    <h3>{g.nombre}</h3>
                    <p className={styles.nota}>{g.personas} personas lo marcaron</p>
                    {g.actuales.length === 0 && <p className={styles.nota}>Solo se marca: no tiene preguntas en la encuesta.</p>}
                    {g.actuales.map((q) => (
                      <div key={q.id} className={styles.pregunta}>
                        <p className={styles.preguntaTitulo}>
                          {q.label} <span>({q.respondieron})</span>
                          {q.refina && <span className={styles.ordena} title="Ordena las ideas de regalo, no busca productos por sí sola">solo ordena</span>}
                        </p>
                        <Barras items={q.top} max={10} />
                      </div>
                    ))}
                  </article>
                ))}
              </section>

              <h2 className={styles.seccion}>Al final · Promociones por WhatsApp</h2>
              <p className={styles.nota}>
                Solo se le pregunta a quien no lo tiene activado; si dice que no, se le pregunta "¿Estás seguro?".
                Incluye a quienes lo activaron o desactivaron en Mi perfil.
              </p>
              <section className={styles.grid}>
                <article className={styles.card}>
                  <h3>¿Te avisamos de promociones por WhatsApp?</h3>
                  <Barras
                    items={[
                      { valor: 'Sí, quieren recibirlas', total: resumen.whatsapp.si },
                      { valor: 'No quieren', total: resumen.whatsapp.no },
                      { valor: 'Todavía no respondieron', total: resumen.clientes - resumen.whatsapp.si - resumen.whatsapp.no },
                    ]}
                    base={resumen.clientes || 1}
                  />
                </article>
              </section>
            </>
          ) : (
            <>
              <p className={styles.nota}>
                Lo que ya no sale en la encuesta o cambió de texto. Las respuestas que se dieron antes del cambio
                se conservan y se ven aquí.
              </p>

              <h2 className={styles.seccion}>Ya no se preguntan</h2>
              {preguntas.retiradas === 0 && <p className={styles.vacio}>Todas las preguntas siguen en la encuesta.</p>}
              <section className={styles.grid}>
                {preguntas.basicosRetirados.map((b) => (
                  <article key={b.id} className={`${styles.card} ${styles.cardRetirada}`}>
                    <Retirada desde={b.retiradaEl} />
                    <p className={styles.donde}>Sobre ti</p>
                    <h3>{b.label}</h3>
                    <p className={styles.nota}>{b.respondieron} respuestas</p>
                    <Barras items={b.opciones} base={b.respondieron || 1} />
                    <BotonReactivar clave={`b-${b.id}`} onClick={() => reactivarBasico(b.id)} />
                  </article>
                ))}
                {resumen.presupuestoRetirado && (
                  <article className={`${styles.card} ${styles.cardRetirada}`}>
                    <Retirada desde={resumen.presupuestoRetiradoEl} />
                    <p className={styles.donde}>Cada persona</p>
                    <h3>¿Cuánto suelen gastar por regalo?</h3>
                    <p className={styles.nota}>{resumen.conPresupuesto} de {resumen.personas} personas tienen presupuesto</p>
                    <Barras items={resumen.presupuesto} />
                    <BotonReactivar clave="presupuesto" onClick={reactivarPresupuesto} />
                  </article>
                )}
                {preguntas.gustos.filter((g) => g.retiradas.length).map((g) => (
                  <article key={g.id} className={`${styles.card} ${styles.cardRetirada}`}>
                    <p className={styles.donde}>Interés · {g.nombre}</p>
                    {g.retiradas.map((q) => (
                      <div key={q.id} className={styles.pregunta}>
                        <Retirada desde={q.retiradaEl} />
                        <p className={styles.preguntaTitulo}>{q.label} <span>({q.respondieron})</span></p>
                        <Barras items={q.top} max={10} />
                        <BotonReactivar clave={`q-${g.id}-${q.id}`} onClick={() => reactivarGusto(g.id, q.id)} />
                      </div>
                    ))}
                  </article>
                ))}
              </section>

              <h2 className={styles.seccion}>Cambiaron de texto</h2>
              {preguntas.cambiadas.length === 0 ? (
                <p className={styles.vacio}>Ninguna pregunta cambió de texto.</p>
              ) : (
                <>
                  <p className={styles.nota}>Es la misma pregunta: sus respuestas de antes y de ahora se cuentan juntas.</p>
                  <ul className={styles.cambios}>
                    {preguntas.cambiadas.map((c) => (
                      <li key={c.clave} className={styles.cambio}>
                        <p className={styles.donde}>{c.donde}</p>
                        <p><strong>Ahora:</strong> {c.ahora}{c.retirada && <> <Retirada /></>}</p>
                        {c.antes.map((a, i) => (
                          <p key={i} className={styles.nota}>Antes: «{a.label}»{a.hasta && ` (hasta el ${fechaCorta(a.hasta)})`}</p>
                        ))}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

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
                    <span className={styles.nota}>📅 {textoFechaEncuesta(u)}</span>
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
