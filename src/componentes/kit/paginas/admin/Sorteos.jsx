import React, { useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, ShieldCheck, Smartphone, Sparkles, Ticket, Trophy, Users } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, useToast } from '../../Feedback';
import { Campo, Interruptor } from '../../Formulario';
import { CampoFecha } from '../../Fecha';
import { Etiqueta } from '../../Etiquetas';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, InsigniaEstado } from '../../piezas/admin/Datos';
import { HojaEdicion, GrupoCampos, CampoImagen, CampoDinero, ElegirUno } from '../../piezas/admin/Formularios';
import { Cifra, FilaCifras, BloqueMetrica, ColumnasMetricas } from '../../piezas/admin/Metricas';
import { PaginaListaAdmin } from './Lista';
import { FotoCelda } from './celdas';
import {
  slugDeSorteo, ESTADOS_SORTEO, REQUISITOS_APP, erroresDeSorteo, tipoDeSorteo, identificadorDe, erroresDeAjuste, normalizarBusqueda,
} from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Sorteos.module.css';

/*
 * D6a · Sorteos (/admin/sorteos y /admin/sorteos/:id): los sorteos gratis y
 * las rifas pagadas, y en el detalle los participantes, los tickets y chances
 * a mano y la elección de ganadores. El sorteo lo hace el servidor; aquí solo
 * se pide y se muestra el resultado con su evidencia.
 */

const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const errorDe = (err) => err?.message || 'Vuelve a intentar.';
const fechaCorta = (dia) => (/^\d{4}-\d{2}-\d{2}/.test(dia || '') ? new Date(`${dia}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : '');
const VACIO = {
  nombre: '', slug: '', descripcion: '', tipo: 'gratis', precioTicket: 0, requisitoApp: 'ninguno', numGanadores: 1,
  premioNombre: '', premioImagen: '', premioValor: 0, portada: '', inicio: '', fin: '', estado: 'borrador', chanceCompartir: false, chanceReferido: false,
};

/** Cómo se ve el sorteo en la tienda (la vista previa de la hoja). */
function MuestraSorteo({ d }) {
  return (
    <div className={s.muestra} aria-label="Vista previa del sorteo">
      {d.portada ? <img src={d.portada} alt="" className={s.muestraPortada} /> : <span className={s.muestraSinPortada}>Sin imagen principal</span>}
      <span className={s.muestraCuerpo}>
        <span className={s.muestraEtiquetas}>
          <InsigniaEstado estado={d.estado} estados={ESTADOS_SORTEO} />
          <Etiqueta tono="violeta">{tipoDeSorteo(d)}</Etiqueta>
        </span>
        <strong>{d.nombre || 'El título del sorteo'}</strong>
        <span className={s.nota}>{d.descripcion || 'Aquí va la descripción.'}</span>
        {d.premioNombre && <span className={s.premio}><Trophy aria-hidden="true" /> {d.premioNombre}{Number(d.premioValor) ? ` (S/ ${entero(d.premioValor)})` : ''}</span>}
      </span>
    </div>
  );
}

/**
 * Sorteos (/admin/sorteos).
 *  - sorteos: [sorteoDesdeFirestore] · cargando · error · onReintentar
 *  - onGuardar(datos, id?) · onEliminar(id) · subirImagen(blob, { alAvanzar }) → url
 *  - onDetalle(sorteo): participantes y ganadores · urlPublica(sorteo) ('/sorteos/{slug}') · dominio ('wala.pe')
 */
export function PaginaSorteosAdmin({ sorteos = [], cargando, error, onReintentar, onGuardar, onEliminar, subirImagen, onDetalle, urlPublica = (x) => `/sorteos/${x.slug}`, dominio = 'wala.pe' }) {
  return (
    <PaginaListaAdmin
      cabeza={{ icono: 'sorteos', tono: 'rosa', titulo: 'Sorteos y rifas', subtitulo: 'Sorteos gratis o rifas pagadas: el premio, quién participa y los ganadores.' }}
      registros={sorteos}
      cargando={cargando}
      error={error}
      onReintentar={onReintentar}
      unidad={['sorteo', 'sorteos']}
      buscarEn={(x) => `${x.nombre} ${x.premioNombre} ${x.slug}`}
      placeholder="Buscar un sorteo o su premio"
      filtros={[
        { id: 'estado', etiqueta: 'Estado', todos: 'Todos', opciones: [{ valor: 'activo', texto: 'Activos' }, { valor: 'borrador', texto: 'Borradores' }, { valor: 'cerrado', texto: 'Cerrados' }], filtrar: (x, v) => x.estado === v },
        { id: 'tipo', etiqueta: 'Tipo', todos: 'Gratis y rifas', opciones: [{ valor: 'gratis', texto: 'Gratis' }, { valor: 'pagado', texto: 'Rifas pagadas' }], filtrar: (x, v) => x.tipo === v },
      ]}
      columnas={[
        { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (x) => <FotoCelda src={x.portada || x.premioImagen} /> },
        { id: 'nombre', titulo: 'Sorteo', tarjeta: 'titulo', celda: (x) => <>{x.nombre}{x.premioNombre && <span className={l.sub}>Premio: {x.premioNombre}</span>}</> },
        { id: 'tipo', titulo: 'Tipo', ancho: 130, tarjeta: 'detalle', celda: (x) => tipoDeSorteo(x) },
        { id: 'fechas', titulo: 'Fechas', ancho: 150, tarjeta: 'detalle', celda: (x) => (x.inicio || x.fin ? `${fechaCorta(x.inicio) || '…'} – ${fechaCorta(x.fin) || '…'}` : <span className={l.sub}>Sin fechas</span>) },
        { id: 'participan', titulo: 'Participan', ancho: 110, alinear: 'fin', tarjeta: 'detalle', celda: (x) => <span className={l.numero}>{x.participantes == null ? '—' : entero(x.participantes)}<span className={l.sub}>{x.numGanadores} {x.numGanadores === 1 ? 'ganador' : 'ganadores'}</span></span> },
        { id: 'estado', titulo: 'Estado', ancho: 110, tarjeta: 'estado', celda: (x) => <InsigniaEstado estado={x.estado} estados={ESTADOS_SORTEO} /> },
      ]}
      vacio={{ titulo: 'Todavía no hay sorteos', texto: 'Crea el primero: el premio, las fechas y si es gratis o una rifa.' }}
      textos={{ creado: 'Sorteo creado', guardado: 'Sorteo guardado', eliminado: 'Sorteo eliminado' }}
      eliminar={{
        texto: (x) => `Se borra «${x.nombre}» y su página wala.pe/sorteos/${x.slug} deja de existir. No se puede deshacer.`,
        bloqueado: (x) => (x.estado === 'activo' && x.participantes ? 'Tiene participantes y está activo: ciérralo primero.' : null),
      }}
      masAcciones={(x) => [
        ...(onDetalle ? [{ id: 'detalle', etiqueta: 'Participantes y ganadores', Icono: Users, accion: () => onDetalle(x) }] : []),
        ...(x.slug ? [{ id: 'publica', etiqueta: 'Ver la página', Icono: ExternalLink, accion: () => window.open(urlPublica(x), '_blank', 'noopener') }] : []),
      ]}
      onGuardar={onGuardar}
      onEliminar={onEliminar}
      formulario={{
        nuevo: 'Nuevo sorteo',
        titulos: { nuevo: 'Nuevo sorteo', editar: 'Editar sorteo' },
        textoGuardar: { nuevo: 'Crear sorteo' },
        vacio: () => ({ ...VACIO }),
        desde: (x) => ({ ...VACIO, ...x }),
        validar: (d) => erroresDeSorteo(d),
        campos: ({ datos: d, cambiar, errores, idDe }) => (
          <>
            <GrupoCampos titulo="El sorteo">
              <Campo id={idDe('nombre')} etiqueta="Título" placeholder="Ej. Gran sorteo de aniversario" value={d.nombre} error={errores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
              <Campo etiqueta="Enlace" ayuda={`${dominio}/sorteos/${slugDeSorteo(d.slug || d.nombre) || 'tu-sorteo'} · sale del título; puedes cambiarlo.`} placeholder={slugDeSorteo(d.nombre) || 'sale-del-titulo'} value={d.slug} onChange={(e) => cambiar('slug', e.target.value)} />
              <Campo etiqueta="Descripción" multilinea={3} placeholder="Las condiciones y cómo se elige al ganador" value={d.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} />
            </GrupoCampos>
            <GrupoCampos titulo="Cómo se participa">
              <ElegirUno etiqueta="Tipo" opciones={[{ valor: 'gratis', texto: 'Gratis' }, { valor: 'pagado', texto: 'Rifa pagada' }]} valor={d.tipo} onElegir={(v) => v && cambiar('tipo', v)} />
              <div className={s.dos}>
                {d.tipo === 'pagado' && <CampoDinero id={idDe('precioTicket')} etiqueta="Precio del ticket" value={d.precioTicket} error={errores.precioTicket} onChange={(e) => cambiar('precioTicket', e.target.value)} />}
                <Campo etiqueta="La app" opciones={REQUISITOS_APP} value={d.requisitoApp} onChange={(e) => cambiar('requisitoApp', e.target.value)} />
                <Campo id={idDe('numGanadores')} etiqueta="Ganadores" type="number" inputMode="numeric" min={1} value={d.numGanadores} error={errores.numGanadores} onChange={(e) => cambiar('numGanadores', e.target.value)} />
              </div>
              <div className={s.dos}>
                <CampoFecha etiqueta="Empieza" valor={d.inicio} max={d.fin || undefined} onCambiar={(v) => cambiar('inicio', v)} />
                <CampoFecha id={idDe('fin')} etiqueta="Termina" valor={d.fin} min={d.inicio || undefined} error={errores.fin} onCambiar={(v) => cambiar('fin', v)} />
              </div>
              <Interruptor etiqueta="Una chance más por compartir" activo={d.chanceCompartir} onChange={(v) => cambiar('chanceCompartir', v)} />
              <Interruptor etiqueta="Una chance más por invitar a alguien" activo={d.chanceReferido} onChange={(v) => cambiar('chanceReferido', v)} />
            </GrupoCampos>
            <GrupoCampos titulo="El premio">
              <div className={s.dos}>
                <Campo etiqueta="Qué se gana" placeholder="Ej. Casaca de tu anime favorito" value={d.premioNombre} onChange={(e) => cambiar('premioNombre', e.target.value)} />
                <CampoDinero etiqueta="Cuánto vale" value={d.premioValor} onChange={(e) => cambiar('premioValor', e.target.value)} />
              </div>
              <CampoImagen etiqueta="Foto del premio" valor={d.premioImagen} onCambiar={(url) => cambiar('premioImagen', url)} subir={subirImagen} recorte="cuadrado" forma="cuadro" />
              <CampoImagen etiqueta="Imagen principal" ayuda="Arriba de la página del sorteo." valor={d.portada} onCambiar={(url) => cambiar('portada', url)} subir={subirImagen} forma="ancho" />
            </GrupoCampos>
            <GrupoCampos titulo="Estado">
              <ElegirUno etiqueta="Estado" opciones={[{ valor: 'borrador', texto: 'Borrador' }, { valor: 'activo', texto: 'Activo' }, { valor: 'cerrado', texto: 'Cerrado' }]} valor={d.estado} onElegir={(v) => v && cambiar('estado', v)} />
              <p className={s.nota}>{d.estado === 'borrador' ? 'Nadie lo ve todavía.' : d.estado === 'activo' ? 'Se ve en la tienda y se puede participar.' : 'Ya no se puede participar.'}</p>
              <MuestraSorteo d={d} />
            </GrupoCampos>
          </>
        ),
      }}
    />
  );
}

/* ── Piezas del detalle (también las usa el sorteo de suscripción) ── */

const AJUSTE_VACIO = { correo: '', telefono: '', dni: '', cantidad: 1, chances: 1, motivo: '' };

/**
 * Sumar tickets (`tipo` 'tickets') o dar/quitar chances ('chances') a una
 * persona, por correo, teléfono o DNI. `inicial`: los datos ya puestos (desde
 * una fila); se vuelve a montar con otra `key` para cambiarlos.
 *  - onEnviar({ correo?, telefono?, dni?, cantidad | chances, motivo? }) → promesa ({ chancesTotal })
 */
export function AjusteSorteo({ tipo, inicial, onEnviar }) {
  const toast = useToast();
  const [d, setD] = useState(inicial || AJUSTE_VACIO);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const cambiar = (k, v) => { setD((x) => ({ ...x, [k]: v })); setErrores({}); };
  const enviar = async () => {
    const e = erroresDeAjuste(d, tipo);
    if (Object.values(e).some(Boolean)) { setErrores(e); return; }
    setEnviando(true);
    try {
      const r = await onEnviar?.({ ...identificadorDe(d), ...(tipo === 'tickets' ? { cantidad: Number(d.cantidad) } : { chances: Number(d.chances), motivo: d.motivo.trim() || undefined }) });
      toast({ tipo: 'exito', titulo: tipo === 'tickets' ? 'Tickets sumados' : 'Chances actualizadas', texto: typeof r?.chancesTotal === 'number' ? `Ahora tiene ${entero(r.chancesTotal)} chances.` : undefined });
      setD(AJUSTE_VACIO);
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo', texto: errorDe(err) });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div className={s.ajuste}>
      <Campo etiqueta="Correo" type="email" placeholder="cliente@correo.com" value={d.correo} error={errores.correo} onChange={(e) => cambiar('correo', e.target.value)} />
      <div className={s.dos}>
        <Campo etiqueta="Teléfono" type="tel" placeholder="999888777" value={d.telefono} onChange={(e) => cambiar('telefono', e.target.value)} />
        <Campo etiqueta="DNI" inputMode="numeric" placeholder="12345678" value={d.dni} onChange={(e) => cambiar('dni', e.target.value)} />
      </div>
      {tipo === 'tickets' ? (
        <Campo etiqueta="Cuántos tickets" type="number" inputMode="numeric" min={1} value={d.cantidad} error={errores.cantidad} onChange={(e) => cambiar('cantidad', e.target.value)} />
      ) : (
        <div className={s.dos}>
          <Campo etiqueta="Chances" ayuda="Negativo resta." type="number" inputMode="numeric" value={d.chances} error={errores.chances} onChange={(e) => cambiar('chances', e.target.value)} />
          <Campo etiqueta="Por qué (opcional)" placeholder="Compensación, promo…" value={d.motivo} onChange={(e) => cambiar('motivo', e.target.value)} />
        </div>
      )}
      <Boton icono={tipo === 'tickets' ? <Ticket aria-hidden="true" /> : <Sparkles aria-hidden="true" />} cargando={enviando} onClick={enviar}>{tipo === 'tickets' ? 'Sumar tickets' : 'Aplicar chances'}</Boton>
    </div>
  );
}

const ListaGanadores = ({ ganadores, conPeso = false }) => (
  <ol className={s.ganadores}>
    {ganadores.map((g, i) => (
      <li key={g.uid || i}>
        <span className={s.puesto}>{i + 1}</span>
        <span className={s.ganadorTexto}><strong>{g.nombre || g.uid || '—'}</strong><span className={s.nota}>{[g.correo, g.telefono].filter(Boolean).join(' · ') || 'Sin contacto'}</span></span>
        {conPeso && typeof g.pesoUsado === 'number' && <span className={s.nota} title="Sus chances en el sorteo">{entero(g.pesoUsado)} chances</span>}
      </li>
    ))}
  </ol>
);

/**
 * Los ganadores de un sorteo: los de ahora, cuántos elegir, "Elegir
 * ganadores" / "Volver a elegir" y "Sortear sin estos" (los dos preguntan),
 * y el resultado con su evidencia en una hoja. Lo elige el servidor.
 *  - ganadores: los guardados · numGanadores (los del sorteo) · cargando
 *  - onDecidir({ numGanadores?, excluirUids? }) → { ganadores, drawId, seed, poolHash, totalElegibles }
 *  - quienes: entre quiénes ("todos los que cumplen las reglas")
 */
export function GanadoresSorteo({ ganadores: guardados = [], numGanadores = 1, onDecidir, cargando = false, quienes = 'todos los que cumplen las reglas', ayuda }) {
  const toast = useToast();
  const [cuantos, setCuantos] = useState('');
  const [preguntar, setPreguntar] = useState(null); // { excluir }
  const [resultado, setResultado] = useState(null);
  const ganadores = resultado?.ganadores || guardados;
  const n = Number(cuantos) > 0 ? Math.round(Number(cuantos)) : numGanadores || 1;
  const sortear = async (excluir) => {
    try {
      const r = await onDecidir?.({ numGanadores: Number(cuantos) > 0 ? n : undefined, excluirUids: excluir ? ganadores.map((g) => g.uid).filter(Boolean) : undefined });
      setResultado({ ganadores: [], ...r, abierto: true });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo sortear', texto: errorDe(err) });
    } finally {
      setPreguntar(null);
    }
  };
  return (
    <BloqueMetrica titulo="Los ganadores" ayuda={ayuda || `Los elige el servidor al azar entre ${quienes}, con más probabilidad para quien tiene más chances. Queda una evidencia para revisarlo.`}>
      {ganadores.length > 0 && <ListaGanadores ganadores={ganadores} />}
      <div className={s.sortear}>
        <Campo etiqueta="Cuántos ganadores" type="number" inputMode="numeric" min={1} placeholder={`${numGanadores || 1} (los del sorteo)`} value={cuantos} onChange={(e) => setCuantos(e.target.value)} />
        <Boton icono={<Trophy aria-hidden="true" />} disabled={!onDecidir || cargando} onClick={() => setPreguntar({ excluir: false })}>{ganadores.length ? 'Volver a elegir' : 'Elegir ganadores'}</Boton>
        {ganadores.length > 0 && <Boton variante="secundario" icono={<RefreshCw aria-hidden="true" />} onClick={() => setPreguntar({ excluir: true })}>Sortear sin estos</Boton>}
      </div>
      {resultado && <Boton tamano="sm" variante="fantasma" icono={<ShieldCheck aria-hidden="true" />} onClick={() => setResultado({ ...resultado, abierto: true })}>Ver la evidencia</Boton>}
      <Confirmar
        abierta={Boolean(preguntar)}
        titulo={preguntar?.excluir ? '¿Sortear de nuevo sin estos ganadores?' : ganadores.length ? '¿Volver a elegir ganadores?' : '¿Elegir los ganadores?'}
        texto={preguntar?.excluir
          ? `Se eligen ${n} ${n === 1 ? 'ganador nuevo' : 'ganadores nuevos'} entre los demás; los de ahora quedan fuera.`
          : `El servidor elige ${n} ${n === 1 ? 'ganador' : 'ganadores'} entre ${quienes}${ganadores.length ? ' y reemplaza a los de ahora' : ''}.`}
        confirmar={preguntar?.excluir ? 'Sortear sin estos' : 'Elegir ganadores'}
        onCancelar={() => setPreguntar(null)}
        onConfirmar={() => sortear(Boolean(preguntar?.excluir))}
      />
      <HojaEdicion abierta={Boolean(resultado?.abierto)} titulo="Ganadores del sorteo" subtitulo="Elegidos por el servidor" onCerrar={() => setResultado((r) => (r ? { ...r, abierto: false } : r))}>
        {resultado && (
          <div className={s.resultado}>
            {resultado.ganadores?.length ? <ListaGanadores ganadores={resultado.ganadores} conPeso /> : <Aviso tipo="aviso" compacto>El servidor no devolvió ganadores: ¿nadie cumplía las reglas?</Aviso>}
            <GrupoCampos titulo="La evidencia" ayuda="Con la semilla y la huella de la lista, cualquiera puede comprobar el resultado.">
              <dl className={s.evidencia}>
                <div><dt>Sorteo</dt><dd className={s.codigo}>{resultado.drawId || '—'}</dd></div>
                <div><dt>Podían ganar</dt><dd>{Number.isFinite(Number(resultado.totalElegibles)) ? entero(resultado.totalElegibles) : '—'}</dd></div>
                <div><dt>Semilla</dt><dd className={s.codigo}>{resultado.seed || '—'}</dd></div>
                {(resultado.poolHash || resultado.hashPool || resultado.hash) && <div><dt>Huella de la lista</dt><dd className={s.codigo}>{resultado.poolHash || resultado.hashPool || resultado.hash}</dd></div>}
              </dl>
            </GrupoCampos>
            {resultado.ganadores?.length > 0 && <Boton variante="secundario" icono={<RefreshCw aria-hidden="true" />} onClick={() => setPreguntar({ excluir: true })}>Sortear sin estos</Boton>}
          </div>
        )}
      </HojaEdicion>
    </BloqueMetrica>
  );
}

/** Lo que llena un formulario desde una fila: el correo, o si no el teléfono, o el DNI. */
export const datosDeAjuste = (p) => ({ ...AJUSTE_VACIO, correo: p.correo, telefono: p.correo ? '' : p.telefono, dni: p.correo || p.telefono ? '' : p.dni });

/* ── El detalle de un sorteo ───────────────────────────── */

/**
 * Un sorteo (/admin/sorteos/:id): participantes, tickets y chances a mano y los ganadores.
 *  - sorteo: sorteoDesdeFirestore · participantes: [participanteDesde] (los primeros 200)
 *  - cargando · error · onReintentar · urlLista · urlPublica
 *  - onSumarTickets({ correo?, telefono?, dni?, cantidad }) · onDarChances({ …, chances, motivo }) → { chancesTotal }
 *  - onDecidirGanadores({ numGanadores?, excluirUids? }) → { ganadores, drawId, seed, poolHash, totalElegibles }
 */
export function PaginaSorteoAdmin({ sorteo, participantes = [], cargando = false, error, onReintentar, urlLista = '/admin/sorteos', urlPublica, onSumarTickets, onDarChances, onDecidirGanadores }) {
  const [busqueda, setBusqueda] = useState('');
  const [ajuste, setAjuste] = useState({ tickets: 0, chances: 0, inicial: null });
  const filtrados = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    return participantes.filter((p) => !q || normalizarBusqueda(`${p.nombre} ${p.correo} ${p.telefono} ${p.dni}`).includes(q));
  }, [participantes, busqueda]);
  const totales = useMemo(() => participantes.reduce((t, p) => ({ tickets: t.tickets + p.tickets, chances: t.chances + p.chances, app: t.app + (p.app ? 1 : 0) }), { tickets: 0, chances: 0, app: 0 }), [participantes]);
  const total = sorteo?.participantes ?? participantes.length;
  const prellenar = (p, tipo) => setAjuste((a) => ({ ...a, [tipo]: a[tipo] + 1, inicial: datosDeAjuste(p) }));

  const cabeza = (
    <CabezaAdmin
      icono="sorteos"
      tono="rosa"
      titulo={sorteo?.nombre || 'Sorteo'}
      subtitulo={sorteo ? `${tipoDeSorteo(sorteo)}${sorteo.premioNombre ? ` · Premio: ${sorteo.premioNombre}` : ''}` : undefined}
      migas={[{ texto: 'Sorteos', to: urlLista }, { texto: sorteo?.nombre || 'Sorteo' }]}
      acciones={sorteo?.slug && urlPublica ? <Boton tamano="sm" variante="secundario" icono={<ExternalLink aria-hidden="true" />} onClick={() => window.open(urlPublica(sorteo), '_blank', 'noopener')}>Ver la página</Boton> : undefined}
    />
  );
  if (error) {
    return (
      <div className={s.pagina} data-componente="PaginaSorteoAdmin">
        {cabeza}
        <Aviso tipo="error" titulo="No pudimos cargar el sorteo" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RefreshCw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>}>{error}</Aviso>
      </div>
    );
  }

  return (
    <div className={s.pagina} data-componente="PaginaSorteoAdmin">
      {cabeza}
      <FilaCifras etiqueta="Resumen del sorteo">
        <Cifra nombre="Participan" valor={entero(total)} ayuda={sorteo?.estado ? ESTADOS_SORTEO[sorteo.estado]?.texto : undefined} cargando={cargando} />
        <Cifra nombre="Tickets" valor={entero(totales.tickets)} ayuda={total > participantes.length ? `Entre los ${entero(participantes.length)} que se ven` : undefined} tono="aviso" cargando={cargando} />
        <Cifra nombre="Chances" valor={entero(totales.chances)} tono="exito" cargando={cargando} />
        <Cifra nombre="Desde la app" valor={entero(totales.app)} tono="cielo" cargando={cargando} />
      </FilaCifras>

      <ColumnasMetricas>
        <GanadoresSorteo ganadores={sorteo?.ganadores} numGanadores={sorteo?.numGanadores} onDecidir={onDecidirGanadores} cargando={cargando} />
        <BloqueMetrica titulo="A mano" ayuda="Busca a la persona por correo, teléfono o DNI. Lo aplica el servidor.">
          <div className={s.ajustes}>
            <details open className={s.plegable}>
              <summary><Ticket aria-hidden="true" /> Sumar tickets</summary>
              <AjusteSorteo key={`t${ajuste.tickets}`} tipo="tickets" inicial={ajuste.inicial} onEnviar={onSumarTickets} />
            </details>
            <details className={s.plegable} open={ajuste.chances > 0 || undefined}>
              <summary><Sparkles aria-hidden="true" /> Dar o quitar chances</summary>
              <AjusteSorteo key={`c${ajuste.chances}`} tipo="chances" inicial={ajuste.inicial} onEnviar={onDarChances} />
            </details>
          </div>
        </BloqueMetrica>
      </ColumnasMetricas>

      <BloqueMetrica titulo="Participantes" ayuda={total > participantes.length ? `Se ven los primeros ${entero(participantes.length)} de ${entero(total)}. Al elegir ganadores, el servidor cuenta a todos.` : undefined}>
        <BarraFiltros busqueda={busqueda} onBusqueda={setBusqueda} placeholder="Buscar por nombre, correo, teléfono o DNI" total={cargando ? undefined : filtrados.length} unidad={['participante', 'participantes']} />
        <TablaAdmin
          etiqueta="Participantes"
          filas={filtrados}
          nombreDe={(p) => p.nombre || p.correo}
          cargando={cargando}
          vacio={participantes.length ? { titulo: 'Nadie coincide', texto: 'Busca otra cosa.' } : { titulo: 'Todavía nadie participa', texto: 'Cuando alguien entre al sorteo, aparece aquí.' }}
          acciones={(p) => [
            ...(onSumarTickets ? [{ id: 'tickets', etiqueta: 'Sumarle tickets', Icono: Ticket, accion: () => prellenar(p, 'tickets') }] : []),
            ...(onDarChances ? [{ id: 'chances', etiqueta: 'Darle o quitarle chances', Icono: Sparkles, accion: () => prellenar(p, 'chances') }] : []),
          ]}
          columnas={[
            { id: 'nombre', titulo: 'Participante', tarjeta: 'titulo', celda: (p) => <>{p.nombre || 'Sin nombre'}<span className={l.sub}>{p.correo || 'Sin correo'}</span></> },
            { id: 'contacto', titulo: 'Teléfono · DNI', tarjeta: 'detalle', celda: (p) => [p.telefono, p.dni].filter(Boolean).join(' · ') || <span className={l.sub}>—</span> },
            { id: 'tickets', titulo: 'Tickets', ancho: 100, alinear: 'fin', tarjeta: 'detalle', celda: (p) => <span className={l.numero}>{entero(p.tickets)}{p.pagados > 0 && <span className={l.sub}>{entero(p.pagados)} pagados</span>}</span> },
            { id: 'chances', titulo: 'Chances', ancho: 90, alinear: 'fin', tarjeta: 'detalle', celda: (p) => <span className={l.numero}>{entero(p.chances)}</span> },
            { id: 'origen', titulo: 'Desde', ancho: 100, tarjeta: 'estado', celda: (p) => (p.app ? <Etiqueta tono="violeta" icono={<Smartphone aria-hidden="true" />}>App</Etiqueta> : <Etiqueta tono="neutro">Web</Etiqueta>) },
          ]}
        />
      </BloqueMetrica>
    </div>
  );
}
