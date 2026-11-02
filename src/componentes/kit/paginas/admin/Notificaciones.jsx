import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, Copy, Plus, RefreshCw, Save, Send, Trash2, X, XCircle } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, useToast } from '../../Feedback';
import { Campo, Interruptor } from '../../Formulario';
import { CampoFecha } from '../../Fecha';
import { Pestanas } from '../../Navegacion';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, InsigniaEstado, SelectorProductos } from '../../piezas/admin/Datos';
import { GrupoCampos, CampoImagen, ElegirUno } from '../../piezas/admin/Formularios';
import { FotoCelda } from './celdas';
import {
  CATEGORIAS_NOTIF, GRUPOS_AVISOS, vistaPreviaAviso, conDato, SEGMENTOS_NOTIF, ESTADOS_CAMPANA,
  ofertaDeProducto, programadaIso, erroresDeOferta, filaDeEstadistica,
} from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Notificaciones.module.css';

/*
 * D5d · Notificaciones (/admin/notificaciones): los avisos automáticos (qué
 * sale, en qué horario y con qué texto), las ofertas que se mandan a mano y
 * el historial. Datos y envíos por props; nada lee Firestore.
 */

const PESTANAS = [
  { id: 'automaticos', texto: 'Automáticos' },
  { id: 'ofertas', texto: 'Ofertas' },
  { id: 'historial', texto: 'Historial' },
];
// Qué interruptor apaga cada grupo de avisos.
const CATEGORIA_DE_GRUPO = { carrito: 'cart_abandoned', mirando: 'product_views', kapi: 'retention', encuesta: 'survey' };
const HORAS = Array.from({ length: 24 }, (_, h) => ({ valor: String(h), texto: `${String(h).padStart(2, '0')}:00` }));
const OFERTA_VACIA = {
  id: '', titulo: '', mensaje: '', enlace: '', imagen: '', segmento: 'all', productoId: '', productoNombre: '', cuando: 'ahora', dia: '', hora: '10',
};
const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fechaHora = (ms) => (ms ? new Date(ms).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const entero = (n) => (n == null ? '—' : new Intl.NumberFormat('es-PE').format(n));
const segmentoTexto = (v) => SEGMENTOS_NOTIF.find((x) => x.valor === v) || SEGMENTOS_NOTIF[0];
const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const errorDe = (err) => err?.message || 'Vuelve a intentar.';

/** Cómo llega una notificación al celular (la vista previa). */
function Notificacion({ titulo, texto, imagen }) {
  return (
    <div className={s.notif} aria-label="Vista previa de la notificación">
      <span className={s.notifApp}><img src="/logo-wala-192.png" alt="" /> Walá · ahora</span>
      <span className={s.notifCuerpo}>
        <span><strong>{titulo || 'El título'}</strong>{texto || 'Escribe el mensaje…'}</span>
        {imagen && <img src={imagen} alt="" />}
      </span>
    </div>
  );
}

/**
 * Notificaciones.
 *  - pestana + onPestana ('automaticos' | 'ofertas' | 'historial')
 *  - config: configNotificacionesDesde · cargandoConfig · errorConfig · onReintentarConfig ·
 *    onGuardarConfig(config) · onProbarAutomatico(clave, texto) → promesa { push, tieneApp }
 *  - guardadas: [campanaDesde] (notification_drafts) · onGuardarBorrador(datos, id?) → id ·
 *    onEliminarBorrador(id) · productos: [productoAdminDesde] · subirImagen(blob, { alAvanzar }) → url
 *  - onProbarOferta(datos) → { tieneApp } · onEnviarOferta(datos, { programadaIso, forzar }) →
 *    { programada, cuandoMs, push, campanita }; si el horario de ofertas no la deja salir,
 *    rechaza con un error que trae `motivo` ('promos_apagado' | 'promos_fuera_horario')
 *  - campanas: [campanaDesde] · estadisticas: [notification_stats crudo] · cargandoHistorial ·
 *    errorHistorial · onActualizarHistorial · onCancelarCampana(id)
 */
export function PaginaNotificacionesAdmin({
  pestana: pestanaFuera, onPestana,
  config, cargandoConfig = false, errorConfig, onReintentarConfig, onGuardarConfig, onProbarAutomatico,
  guardadas = [], onGuardarBorrador, onEliminarBorrador, productos = [], subirImagen, onProbarOferta, onEnviarOferta,
  campanas = [], estadisticas = [], cargandoHistorial = false, errorHistorial, onActualizarHistorial, onCancelarCampana,
}) {
  const [pestanaDentro, setPestanaDentro] = useState('automaticos');
  const pestana = pestanaFuera || pestanaDentro;
  const ir = (p) => (onPestana ? onPestana(p) : setPestanaDentro(p));
  const [oferta, setOferta] = useState(OFERTA_VACIA);
  const horarioOfertas = config?.horarios?.promos;

  return (
    <div className={s.pagina} data-componente="PaginaNotificacionesAdmin">
      <CabezaAdmin
        icono="notificaciones"
        tono="rosa"
        titulo="Notificaciones"
        subtitulo="Los avisos que salen solos, las ofertas que mandas tú y cómo les fue."
        acciones={pestana === 'historial' && onActualizarHistorial ? <Boton tamano="sm" variante="secundario" icono={<RefreshCw aria-hidden="true" />} cargando={cargandoHistorial} onClick={onActualizarHistorial}>Actualizar</Boton> : undefined}
        principal={pestana !== 'ofertas' ? { texto: 'Nueva oferta', Icono: Plus, onClick: () => { setOferta(OFERTA_VACIA); ir('ofertas'); } } : undefined}
      />
      <div className={s.pestanas}>
        <Pestanas etiqueta="Secciones de notificaciones" opciones={PESTANAS} valor={pestana} onChange={ir} />
      </div>
      {pestana === 'automaticos' && (
        <Automaticos config={config} cargando={cargandoConfig} error={errorConfig} onReintentar={onReintentarConfig} onGuardar={onGuardarConfig} onProbar={onProbarAutomatico} />
      )}
      {pestana === 'ofertas' && (
        <Ofertas
          oferta={oferta}
          setOferta={setOferta}
          horario={horarioOfertas}
          guardadas={guardadas}
          onGuardarBorrador={onGuardarBorrador}
          onEliminarBorrador={onEliminarBorrador}
          productos={productos}
          subirImagen={subirImagen}
          onProbar={onProbarOferta}
          onEnviar={onEnviarOferta}
        />
      )}
      {pestana === 'historial' && (
        <Historial
          campanas={campanas}
          estadisticas={estadisticas}
          cargando={cargandoHistorial}
          error={errorHistorial}
          onReintentar={onActualizarHistorial}
          onCancelar={onCancelarCampana}
          onReutilizar={(c) => { setOferta({ ...OFERTA_VACIA, ...c, id: '', cuando: 'ahora' }); ir('ofertas'); }}
        />
      )}
    </div>
  );
}

/* ── Avisos automáticos ────────────────────────────────── */

function Automaticos({ config, cargando, error, onReintentar, onGuardar, onProbar }) {
  const toast = useToast();
  const [datos, setDatos] = useState(config);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState('');
  useEffect(() => { setDatos(config); }, [config]);
  const sucio = Boolean(datos && config) && !mismo(datos, config);
  const malHorario = datos ? CATEGORIAS_NOTIF.filter((c) => datos.horarios[c.clave].desde >= datos.horarios[c.clave].hasta).map((c) => c.clave) : [];

  if (error) {
    return <Aviso tipo="error" titulo="No pudimos cargar la configuración" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RefreshCw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>}>{error} Mientras no cargue, no se puede guardar: pisaría lo que hay.</Aviso>;
  }
  if (cargando || !datos) return <p className={s.nota} aria-busy="true">Cargando la configuración…</p>;

  const activo = (clave, v) => setDatos((d) => ({ ...d, activos: { ...d.activos, [clave]: v } }));
  const horario = (clave, campo, v) => setDatos((d) => ({ ...d, horarios: { ...d.horarios, [clave]: { ...d.horarios[clave], [campo]: v } } }));
  const texto = (clave, variante, campo, v) => setDatos((d) => ({ ...d, textos: { ...d.textos, [clave]: { ...d.textos[clave], [variante]: { ...d.textos[clave][variante], [campo]: v } } } }));
  const segundo = (clave, si) => setDatos((d) => ({ ...d, textos: { ...d.textos, [clave]: { ...d.textos[clave], b: si ? { ...d.textos[clave].a } : null } } }));
  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar?.(datos);
      toast({ tipo: 'exito', titulo: 'Configuración guardada', texto: 'El motor la usa desde su próxima vuelta.' });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: errorDe(err) });
    } finally {
      setGuardando(false);
    }
  };
  const probar = async (clave, variante) => {
    setProbando(`${clave}.${variante}`);
    try {
      const r = await onProbar?.(clave, datos.textos[clave][variante]);
      toast({
        tipo: 'exito',
        titulo: 'Prueba enviada solo a ti',
        texto: r?.push > 0 ? 'Revisa la campanita y tu celular.' : r?.tieneApp ? 'Llegó a tu campanita; la push no llegó a tu celular.' : 'Revisa la campanita (tu cuenta no tiene la app).',
      });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo enviar la prueba', texto: errorDe(err) });
    } finally {
      setProbando('');
    }
  };

  return (
    <>
      <section className={s.seccion} aria-labelledby="notif-horarios">
        <h2 id="notif-horarios" className={s.subtitulo}>Qué avisos salen y en qué horario</h2>
        <p className={s.nota}>Apaga uno para que deje de enviarse. Las horas son de Lima.</p>
        <ul className={s.categorias}>
          {CATEGORIAS_NOTIF.map((c) => (
            <li key={c.clave} className={[s.categoria, !datos.activos[c.clave] && s.apagada].filter(Boolean).join(' ')}>
              <Interruptor etiqueta={c.nombre} descripcion={c.detalle} activo={datos.activos[c.clave]} onChange={(v) => activo(c.clave, v)} />
              <div className={s.horas}>
                <Campo etiqueta="Desde" type="time" value={datos.horarios[c.clave].desde} onChange={(e) => horario(c.clave, 'desde', e.target.value)} />
                <Campo etiqueta="Hasta" type="time" value={datos.horarios[c.clave].hasta} error={malHorario.includes(c.clave) ? 'Termina antes de empezar.' : undefined} onChange={(e) => horario(c.clave, 'hasta', e.target.value)} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={s.seccion} aria-labelledby="notif-textos">
        <h2 id="notif-textos" className={s.subtitulo}>Lo que dice cada aviso</h2>
        <p className={s.nota}>
          A la derecha ves cómo le llega al cliente. «+ Nombre» y «+ Monedas» ponen su nombre o cuántas monedas tiene (en la vista previa: «María» y «25»).
          Con un segundo texto, la mitad recibe cada uno y en el Historial ves cuál se abre más; cuando uno gane, déjalo como texto 1 y quita el otro.
        </p>
        {GRUPOS_AVISOS.map((g) => {
          const apagado = !datos.activos[CATEGORIA_DE_GRUPO[g.id]];
          return (
            <div key={g.id} className={s.grupo}>
              <h3 className={s.grupoTitulo}>{g.nombre}{apagado && <span className={s.apagadoTexto}> · apagado, no sale</span>}</h3>
              <p className={s.nota}>{g.detalle}</p>
              {g.avisos.map((a) => {
                const t = datos.textos[a.clave];
                return (
                  <article key={a.clave} className={s.aviso}>
                    <header className={s.avisoCabeza}>
                      <span><strong>{a.nombre}</strong><span className={s.nota}>{a.cuando}</span></span>
                      {t.b
                        ? <Boton tamano="sm" variante="fantasma" icono={<X aria-hidden="true" />} onClick={() => segundo(a.clave, false)}>Quitar el texto 2</Boton>
                        : <Boton tamano="sm" variante="secundario" icono={<Plus aria-hidden="true" />} onClick={() => segundo(a.clave, true)}>Probar un segundo texto</Boton>}
                    </header>
                    {['a', 'b'].filter((v) => t[v]).map((v) => (
                      <div key={v} className={s.variante}>
                        {t.b && <span className={s.varianteNombre}>{v === 'a' ? 'Texto 1 · lo recibe la mitad' : 'Texto 2 · lo recibe la otra mitad'}</span>}
                        <div className={s.editor}>
                          <div className={s.campos}>
                            <Campo etiqueta="Mensaje" placeholder="Ej. Tu regalo te está esperando." value={t[v].texto} onChange={(e) => texto(a.clave, v, 'texto', e.target.value)} />
                            <span className={s.datosBtns}>
                              {['nombre', 'monedas', ...(a.conProducto ? ['producto'] : [])].map((dato) => (
                                <Boton key={dato} tamano="sm" variante="fantasma" onClick={() => texto(a.clave, v, 'texto', conDato(t[v].texto, dato))}>+ {dato[0].toUpperCase() + dato.slice(1)}</Boton>
                              ))}
                            </span>
                            <div className={s.fraseEmoji}>
                              <Campo etiqueta="Frase final" ayuda="Invita a actuar." placeholder="Ej. ¿Terminamos tu compra?" value={t[v].frase} onChange={(e) => texto(a.clave, v, 'frase', e.target.value)} />
                              <Campo etiqueta="Emoji" ayuda="Al final." placeholder="🎁" value={t[v].emoji} maxLength={4} onChange={(e) => texto(a.clave, v, 'emoji', e.target.value)} />
                            </div>
                          </div>
                          <div className={s.previa}>
                            <Notificacion titulo={a.titulo} texto={vistaPreviaAviso(t[v])} />
                            {a.probable && onProbar && (
                              <Boton tamano="sm" variante="secundario" icono={<BellRing aria-hidden="true" />} cargando={probando === `${a.clave}.${v}`} disabled={Boolean(probando) || !t[v].texto.trim()} onClick={() => probar(a.clave, v)}>
                                Enviarme una prueba
                              </Boton>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </article>
                );
              })}
            </div>
          );
        })}
      </section>

      {sucio && (
        <div className={s.barraGuardar} role="region" aria-label="Cambios sin guardar">
          <span>{malHorario.length ? 'Revisa los horarios: uno termina antes de empezar.' : 'Tienes cambios sin guardar.'}</span>
          <Boton tamano="sm" variante="fantasma" onClick={() => setDatos(config)} disabled={guardando}>Descartar</Boton>
          <Boton tamano="sm" icono={<Save aria-hidden="true" />} cargando={guardando} disabled={malHorario.length > 0} onClick={guardar}>Guardar cambios</Boton>
        </div>
      )}
    </>
  );
}

/* ── Ofertas y novedades ───────────────────────────────── */

function Ofertas({ oferta: d, setOferta, horario, guardadas, onGuardarBorrador, onEliminarBorrador, productos, subirImagen, onProbar, onEnviar }) {
  const toast = useToast();
  const [errores, setErrores] = useState({});
  const [ocupado, setOcupado] = useState('');
  const [enviar, setEnviar] = useState(null); // { forzar, motivo } al preguntar
  const [borrar, setBorrar] = useState(null);
  const cambiar = (campo, v) => { setOferta((o) => ({ ...o, [campo]: v })); setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e)); };
  const programar = d.cuando === 'programar';
  const iso = programar ? programadaIso(d.dia, d.hora) : '';
  const seg = segmentoTexto(d.segmento);
  const fueraDeHorario = programar && horario && (() => {
    const hh = `${String(d.hora).padStart(2, '0')}:00`;
    return hh < horario.desde || hh >= horario.hasta;
  })();

  const revisar = (paraGuardar = false) => {
    const e = erroresDeOferta(d, Date.now(), paraGuardar);
    setErrores(e);
    const primero = ['titulo', 'mensaje', 'dia'].find((k) => e[k]);
    if (primero) document.getElementById(`oferta-${primero}`)?.focus();
    return !primero;
  };
  const con = async (que, fn) => {
    setOcupado(que);
    try { return await fn(); } finally { setOcupado(''); }
  };
  const probar = () => revisar(true) && con('probar', async () => {
    try {
      const r = await onProbar?.(d);
      toast({ tipo: 'exito', titulo: 'Prueba enviada solo a ti', texto: r?.tieneApp ? 'Revisa la campanita y tu celular.' : 'Revisa la campanita (tu cuenta no tiene la app).' });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo enviar la prueba', texto: errorDe(err) });
    }
  });
  const guardar = () => revisar(true) && con('guardar', async () => {
    try {
      const id = await onGuardarBorrador?.(d, d.id || undefined);
      if (!d.id && id) setOferta((o) => ({ ...o, id }));
      toast({ tipo: 'exito', titulo: d.id ? 'Guardada actualizada' : 'Guardada para después', texto: 'Está arriba, en «Guardadas».' });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: errorDe(err) });
    }
  });
  const mandar = async (forzar) => {
    try {
      const r = await onEnviar?.(d, { programadaIso: iso || null, forzar });
      toast(r?.programada
        ? { tipo: 'exito', titulo: 'Oferta programada', texto: `Sale el ${fechaHora(r.cuandoMs)}.` }
        : { tipo: 'exito', titulo: 'Oferta enviada', texto: `${entero(r?.push)} por push y ${entero(r?.campanita)} en la campanita.` });
      setOferta(OFERTA_VACIA);
      setEnviar(null);
    } catch (err) {
      const motivo = err?.motivo || err?.details?.motivo;
      if (!forzar && (motivo === 'promos_apagado' || motivo === 'promos_fuera_horario')) {
        setEnviar({ forzar: true, motivo });
        return;
      }
      setEnviar(null);
      toast({ tipo: 'error', titulo: 'No se pudo enviar la oferta', texto: errorDe(err) });
    }
  };

  return (
    <>
      {guardadas.length > 0 && (
        <section className={s.seccion} aria-labelledby="ofertas-guardadas">
          <h2 id="ofertas-guardadas" className={s.subtitulo}>Guardadas</h2>
          <p className={s.nota}>«Usar» la carga abajo para enviarla o programarla cuando quieras.</p>
          <ul className={s.guardadas}>
            {guardadas.map((g) => (
              <li key={g.id} className={[s.guardada, d.id === g.id && s.guardadaActiva].filter(Boolean).join(' ')}>
                {g.imagen && <FotoCelda src={g.imagen} tamano={44} />}
                <span className={s.guardadaTexto}><strong>{g.titulo}</strong><span>{g.mensaje}</span><span className={l.sub}>Para: {segmentoTexto(g.segmento).texto}</span></span>
                <span className={s.guardadaAcciones}>
                  <Boton tamano="sm" variante="secundario" onClick={() => { setOferta({ ...OFERTA_VACIA, ...g, cuando: 'ahora' }); setErrores({}); }}>{d.id === g.id ? 'En uso' : 'Usar'}</Boton>
                  <Boton soloIcono tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} aria-label={`Borrar «${g.titulo}»`} onClick={() => setBorrar(g)} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={s.oferta}>
        <div className={s.ofertaCampos}>
          {d.id && (
            <Aviso tipo="info" compacto accion={<Boton tamano="sm" variante="fantasma" onClick={() => setOferta(OFERTA_VACIA)}>Empezar una nueva</Boton>}>
              Estás usando una guardada: «Guardar» la actualiza.
            </Aviso>
          )}
          <GrupoCampos titulo="Anunciar un producto" ayuda="Opcional: llena el título, el mensaje, el enlace y la foto. Si está en oferta, lo dice.">
            {d.productoId && (
              <span className={s.producto}>
                Producto: <strong>{d.productoNombre}</strong>
                <Boton tamano="sm" variante="fantasma" icono={<X aria-hidden="true" />} onClick={() => setOferta((o) => ({ ...o, productoId: '', productoNombre: '' }))}>Quitar</Boton>
              </span>
            )}
            <SelectorProductos productos={productos} yaEstan={d.productoId ? [d.productoId] : []} accion="Anunciar este" accionHecha="Es este" limite={5} onElegir={async (p) => { setOferta((o) => ({ ...o, ...ofertaDeProducto(p) })); setErrores({}); }} />
          </GrupoCampos>
          <GrupoCampos titulo="La notificación">
            <Campo id="oferta-titulo" etiqueta="Título" maxLength={80} ayuda={`${d.titulo.length} de 80`} placeholder="Ej. 🔥 2x1 en cajas de regalo solo hoy" value={d.titulo} error={errores.titulo} onChange={(e) => cambiar('titulo', e.target.value)} />
            <Campo id="oferta-mensaje" etiqueta="Mensaje" multilinea={3} maxLength={300} placeholder="Lo que dice debajo del título" value={d.mensaje} error={errores.mensaje} onChange={(e) => cambiar('mensaje', e.target.value)} />
            <Campo etiqueta="Al tocarla abre (opcional)" placeholder="/producto/abc123, /tienda o https://…" value={d.enlace} onChange={(e) => cambiar('enlace', e.target.value)} />
            <CampoImagen etiqueta="Imagen (opcional)" valor={d.imagen} onCambiar={(url) => cambiar('imagen', url)} subir={subirImagen} conEnlace forma="cuadro" />
          </GrupoCampos>
          <GrupoCampos titulo="A quién y cuándo">
            <Campo etiqueta="Le llega a" opciones={SEGMENTOS_NOTIF.map((x) => ({ valor: x.valor, texto: x.texto, detalle: x.detalle }))} value={d.segmento} onChange={(e) => cambiar('segmento', e.target.value)} />
            <ElegirUno etiqueta="Cuándo" opciones={[{ valor: 'ahora', texto: 'Ahora' }, { valor: 'programar', texto: 'Un día y hora' }]} valor={d.cuando} onElegir={(v) => v && cambiar('cuando', v)} />
            {programar && (
              <>
                <div className={s.dos}>
                  <CampoFecha id="oferta-dia" etiqueta="Día" valor={d.dia} min={hoyIso()} error={errores.dia} onCambiar={(v) => cambiar('dia', v)} />
                  <Campo etiqueta="Hora" opciones={HORAS} value={String(d.hora)} onChange={(e) => cambiar('hora', e.target.value)} />
                </div>
                <p className={s.nota}>Sale en la primera vuelta del motor desde esa hora (corre cada hora en punto).</p>
                {fueraDeHorario && <Aviso tipo="aviso" compacto>Esa hora está fuera del horario de ofertas ({horario.desde} a {horario.hasta}): espera hasta que abra.</Aviso>}
              </>
            )}
          </GrupoCampos>
        </div>

        <aside className={s.ofertaLado} aria-label="Vista previa y envío">
          <Notificacion titulo={d.titulo} texto={d.mensaje} imagen={d.imagen} />
          <p className={s.nota}>Le llega a: <strong>{seg.texto}</strong> · {seg.detalle}. Push a quien tiene la app y en la campanita de todos.</p>
          <div className={s.ofertaAcciones}>
            {onProbar && <Boton variante="secundario" icono={<BellRing aria-hidden="true" />} cargando={ocupado === 'probar'} disabled={Boolean(ocupado)} onClick={probar}>Enviarme una prueba</Boton>}
            {onGuardarBorrador && <Boton variante="secundario" icono={<Save aria-hidden="true" />} cargando={ocupado === 'guardar'} disabled={Boolean(ocupado)} onClick={guardar}>{d.id ? 'Guardar cambios' : 'Guardar para después'}</Boton>}
            <Boton icono={<Send aria-hidden="true" />} disabled={Boolean(ocupado)} onClick={() => revisar() && setEnviar({ forzar: false })}>{programar ? 'Programar oferta' : 'Enviar ahora'}</Boton>
          </div>
        </aside>
      </div>

      <Confirmar
        abierta={Boolean(enviar)}
        titulo={enviar?.motivo ? '¿Enviarla igual?' : programar ? '¿Programar esta oferta?' : '¿Enviar esta oferta ahora?'}
        texto={enviar?.motivo === 'promos_apagado'
          ? '«Ofertas programadas» está apagado en Automáticos. Si la envías igual, sale ahora.'
          : enviar?.motivo === 'promos_fuera_horario'
            ? `Estás fuera del horario de ofertas (${horario?.desde || '10:00'} a ${horario?.hasta || '20:00'}). Si la envías igual, sale ahora.`
            : programar
              ? `Sale el ${fechaHora(Date.parse(iso))} para «${seg.texto}»: ${seg.detalle.toLowerCase()}.`
              : `Le llega ya a «${seg.texto}»: ${seg.detalle.toLowerCase()}. No se puede deshacer.`}
        confirmar={enviar?.motivo ? 'Enviar igual' : programar ? 'Programar' : 'Enviar ahora'}
        peligro={!programar}
        onCancelar={() => setEnviar(null)}
        onConfirmar={() => mandar(Boolean(enviar?.forzar))}
      />
      <Confirmar
        abierta={Boolean(borrar)}
        titulo="¿Borrar esta guardada?"
        texto={borrar ? `Se borra «${borrar.titulo}» de las guardadas. Las campañas ya enviadas no cambian.` : ''}
        confirmar="Borrar"
        peligro
        onCancelar={() => setBorrar(null)}
        onConfirmar={async () => {
          try {
            await onEliminarBorrador?.(borrar.id);
            if (d.id === borrar.id) setOferta((o) => ({ ...o, id: '' }));
            toast({ tipo: 'exito', titulo: 'Guardada borrada', texto: borrar.titulo });
          } catch (err) {
            toast({ tipo: 'error', titulo: 'No se pudo borrar', texto: errorDe(err) });
          } finally {
            setBorrar(null);
          }
        }}
      />
    </>
  );
}

/* ── Historial ─────────────────────────────────────────── */

const ESTADOS_MEJOR = {
  'Texto 1': { texto: 'Texto 1', tono: 'exito' },
  'Texto 2': { texto: 'Texto 2', tono: 'exito' },
  Empate: { texto: 'Empate', tono: 'neutro' },
  'Faltan envíos': { texto: 'Faltan envíos', tono: 'aviso' },
};

function Historial({ campanas, estadisticas, cargando, error, onReintentar, onCancelar, onReutilizar }) {
  const toast = useToast();
  const [cancelar, setCancelar] = useState(null);
  const filas = useMemo(() => estadisticas.map(filaDeEstadistica), [estadisticas]);
  const lado = (x) => (x ? <>{entero(x.abiertos)} de {entero(x.enviados)}<span className={l.sub}>{x.tasa} abiertos</span></> : <span className={l.sub}>—</span>);

  return (
    <>
      <section className={s.seccion} aria-labelledby="historial-textos">
        <h2 id="historial-textos" className={s.subtitulo}>¿Qué texto funciona mejor?</h2>
        <p className={s.nota}>Enviados y abiertos por aviso («abierto»: lo tocó en la campanita o en la push). Con 50 envíos por texto ya se puede comparar.</p>
        <TablaAdmin
          etiqueta="Avisos y sus textos"
          filas={filas}
          nombreDe={(f) => f.nombre}
          cargando={cargando}
          error={error}
          onReintentar={onReintentar}
          vacio={{ titulo: 'Todavía no hay envíos', texto: 'Cuando el motor mande avisos, aquí ves cuántos se abren.' }}
          columnas={[
            { id: 'aviso', titulo: 'Aviso', tarjeta: 'titulo', celda: (f) => f.nombre },
            { id: 'a', titulo: 'Texto 1', tarjeta: 'detalle', celda: (f) => lado(f.a) },
            { id: 'b', titulo: 'Texto 2', tarjeta: 'detalle', celda: (f) => lado(f.b) },
            { id: 'mejor', titulo: 'Gana', ancho: 150, tarjeta: 'estado', celda: (f) => (f.mejor ? <InsigniaEstado estado={f.mejor} estados={ESTADOS_MEJOR} /> : <span className={l.sub}>Un solo texto</span>) },
          ]}
        />
      </section>

      <section className={s.seccion} aria-labelledby="historial-campanas">
        <h2 id="historial-campanas" className={s.subtitulo}>Ofertas enviadas y programadas</h2>
        <p className={s.nota}>Las últimas 50. «Volver a usar» la carga en Ofertas para enviarla otra vez (no sale sola).</p>
        <TablaAdmin
          etiqueta="Ofertas enviadas"
          filas={campanas}
          nombreDe={(c) => c.titulo}
          cargando={cargando}
          error={error}
          onReintentar={onReintentar}
          onFila={onReutilizar}
          vacio={{ titulo: 'Todavía no hay ofertas', texto: 'Las que envíes o programes desde Ofertas aparecen aquí.' }}
          acciones={(c) => [
            { id: 'usar', etiqueta: 'Volver a usar', Icono: Copy, accion: () => onReutilizar(c) },
            ...(c.estado === 'scheduled' && onCancelar ? [{ id: 'cancelar', etiqueta: 'Cancelar el envío', Icono: XCircle, peligro: true, accion: () => setCancelar(c) }] : []),
          ]}
          columnas={[
            { id: 'foto', titulo: 'Foto', ancho: 64, tarjeta: 'foto', celda: (c) => <FotoCelda src={c.imagen} /> },
            { id: 'oferta', titulo: 'Oferta', tarjeta: 'titulo', celda: (c) => <>{c.titulo}<span className={l.sub}>{c.mensaje}</span></> },
            { id: 'fecha', titulo: 'Cuándo', ancho: 150, tarjeta: 'detalle', celda: (c) => fechaHora(c.fechaMs) },
            { id: 'para', titulo: 'Para', ancho: 120, tarjeta: 'detalle', celda: (c) => segmentoTexto(c.segmento).texto },
            { id: 'llego', titulo: 'Llegó', ancho: 150, tarjeta: 'detalle', celda: (c) => (c.campanita == null ? <span className={l.sub}>—</span> : <>{entero(c.push)} push<span className={l.sub}>{entero(c.campanita)} en la campanita</span></>) },
            { id: 'abiertas', titulo: 'Abiertas', ancho: 110, alinear: 'fin', tarjeta: 'detalle', celda: (c) => (c.abiertas == null ? <span className={l.sub}>—</span> : <span className={l.numero}>{entero(c.abiertas)}<span className={l.sub}>{c.tasa}</span></span>) },
            { id: 'estado', titulo: 'Estado', ancho: 120, tarjeta: 'estado', celda: (c) => <InsigniaEstado estado={c.estado} estados={ESTADOS_CAMPANA} /> },
          ]}
        />
      </section>

      <Confirmar
        abierta={Boolean(cancelar)}
        titulo="¿Cancelar el envío programado?"
        texto={cancelar ? `«${cancelar.titulo}» ya no sale (estaba para el ${fechaHora(cancelar.fechaMs)}). Puedes volver a programarla después.` : ''}
        confirmar="Cancelar el envío"
        cancelar="No"
        peligro
        onCancelar={() => setCancelar(null)}
        onConfirmar={async () => {
          try {
            await onCancelar?.(cancelar.id);
            toast({ tipo: 'exito', titulo: 'Envío cancelado', texto: cancelar.titulo });
          } catch (err) {
            toast({ tipo: 'error', titulo: 'No se pudo cancelar', texto: errorDe(err) });
          } finally {
            setCancelar(null);
          }
        }}
      />
    </>
  );
}
