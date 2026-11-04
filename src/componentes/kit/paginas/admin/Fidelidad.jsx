import React, { useMemo, useState } from 'react';
import { Check, ExternalLink, MessageCircle, Rocket, Undo2, X } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, EstadoVacio, HojaInferior, useToast } from '../../Feedback';
import { Campo, Interruptor } from '../../Formulario';
import { Pestanas } from '../../Navegacion';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, CargarMas, InsigniaEstado, SelectorProductos } from '../../piezas/admin/Datos';
import { GrupoCampos, CampoImagen, CampoDinero } from '../../piezas/admin/Formularios';
import { Cifra, FilaCifras } from '../../piezas/admin/Metricas';
import { PaginaListaAdmin } from './Lista';
import { FotoCelda, porOrden } from './celdas';
import {
  ESTADOS_REFERIDO, ESTADOS_REFERENTE, resumenReferidos, ESTADOS_CANJE, resumenCanjes, RECOMPENSAS_RETO, recompensaDeReto, normalizarBusqueda,
  TIPOS_RECOMPENSA, RECOMPENSA_CON_PRODUCTO, RECOMPENSA_CON_VIGENCIA, beneficioDeRecompensa, erroresDeRecompensa,
} from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Fidelidad.module.css';

/*
 * D5 · Clientes y fidelidad. D5a: Referidos (seguimiento), Misiones diarias
 * y Retos semanales (catálogo, evidencias y el reto activo).
 */

const PASO = 50;
const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const fecha = (ms) => (ms ? new Date(ms).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fechaHora = (ms) => (ms ? new Date(ms).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

// Lo que se explica bajo "Qué da", según el tipo.
const AYUDA_TIPO = {
  manual: 'El cliente recibe un código y lo canjea con un asesor (envíos, algo físico…).',
  stickers_whatsapp: 'Digital: no se envía nada. El cliente los añade a WhatsApp desde la app de Walá y el canje queda entregado solo.',
  cupon: 'Al canjearla se genera un cupón que el cliente aplica solo, en el carrito.',
};

/* ── Referidos ─────────────────────────────────────────── */

/**
 * Referidos (/admin/referidos): una fila por persona que comparte su enlace,
 * con sus visitas dentro. Nadie aprueba nada: quien refirió reclama sus
 * monedas cuando el pedido queda Finalizado en el ERP; un Anulado no paga.
 *  - referidos: [referidoDesdeFirestore] (las cifras de arriba)
 *  - personas: [referentesDesde] · cargando · error · onReintentar
 */
export function PaginaReferidosAdmin({ referidos = [], personas = [], cargando = false, error, onReintentar }) {
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [visibles, setVisibles] = useState(PASO);
  const [abierta, setAbierta] = useState(null);
  const r = useMemo(() => resumenReferidos(referidos), [referidos]);
  const filtradas = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    return personas.filter((p) => (!estado || p.estado === estado) && (!q || normalizarBusqueda(
      `${p.codigo} ${p.nombre} ${p.visitas.map((v) => `${v.quien} ${v.pedido} ${v.enlace}`).join(' ')}`,
    ).includes(q)));
  }, [personas, busqueda, estado]);
  const persona = abierta ? personas.find((p) => p.id === abierta) : null;

  return (
    <div className={s.pagina} data-componente="PaginaReferidosAdmin">
      <CabezaAdmin icono="referidos" tono="rosa" titulo="Referidos" subtitulo="Quién comparte su enlace, quién entró por él y qué compró." />
      <Aviso tipo="info" compacto>
        Cada persona que abre un enlace cuenta aparte. Una compra le paga a quien compartió el 5 % del total (10 % si pasa de S/ 200) cuando el pedido queda Finalizado en el ERP; un Anulado no paga. Si llegó por una invitación y crea su cuenta, recibe 10 monedas y su primera compra paga 15 o el %, lo que sea mayor.
      </Aviso>
      <FilaCifras etiqueta="Resumen de referidos">
        <Cifra nombre="Comparten" valor={entero(r.personas)} ayuda={r.personas === 1 ? 'persona' : 'personas'} tono="violeta" cargando={cargando} />
        <Cifra nombre="Abrieron" valor={entero(r.entraron)} ayuda={`${entero(r.cuentas)} ${r.cuentas === 1 ? 'cuenta nueva' : 'cuentas nuevas'}`} tono="rosa" cargando={cargando} />
        <Cifra nombre="Compraron" valor={entero(r.compraron)} tono="exito" cargando={cargando} />
        <Cifra nombre="Monedas pagadas" valor={entero(r.pagadas)} ayuda={r.porPagar ? `${entero(r.porPagar)} por pagar (estimado)` : 'Nada por pagar'} tono="aviso" cargando={cargando} />
      </FilaCifras>
      <BarraFiltros
        busqueda={busqueda}
        onBusqueda={(t) => { setBusqueda(t); setVisibles(PASO); }}
        placeholder="Buscar por nombre, código, quién entró o pedido"
        filtros={[{ id: 'estado', etiqueta: 'Estado', todos: 'Todas', opciones: Object.entries(ESTADOS_REFERENTE).map(([valor, e]) => ({ valor, texto: e.texto })), valor: estado }]}
        onFiltro={(_, v) => { setEstado(v); setVisibles(PASO); }}
        total={cargando || error ? undefined : filtradas.length}
        unidad={['persona', 'personas']}
      />
      <TablaAdmin
        etiqueta="Personas que comparten"
        filas={filtradas.slice(0, visibles)}
        nombreDe={(p) => p.nombre || p.codigo}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        onFila={(p) => setAbierta(p.id)}
        accionFila="Ver las visitas de"
        vacio={personas.length ? { titulo: 'Nadie coincide', texto: 'Prueba con otro estado o busca otra cosa.' } : { titulo: 'Todavía no hay referidos', texto: 'Cuando alguien comparta su enlace, aparece aquí.' }}
        columnas={[
          { id: 'persona', titulo: 'Quién comparte', tarjeta: 'titulo', celda: (p) => <>{p.nombre || p.codigo}<span className={l.sub}>{p.nombre ? p.codigo : 'Sin perfil'}</span></> },
          { id: 'abrieron', titulo: 'Abrieron', alinear: 'fin', ancho: 120, tarjeta: 'detalle', celda: (p) => <span className={l.numero}><span className={l.soloTarjeta}>Abrieron </span>{entero(p.abrieron)}{p.sinAbrir > 0 && <span className={l.sub}>{entero(p.sinAbrir)} sin abrir</span>}</span> },
          { id: 'cuentas', titulo: 'Cuentas nuevas', alinear: 'fin', ancho: 130, tarjeta: 'detalle', celda: (p) => <span className={l.numero}><span className={l.soloTarjeta}>Cuentas nuevas </span>{entero(p.cuentas)}</span> },
          { id: 'compraron', titulo: 'Compraron', alinear: 'fin', ancho: 130, tarjeta: 'detalle', celda: (p) => <span className={l.numero}><span className={l.soloTarjeta}>Compraron </span>{entero(p.compraron)}{p.compraron > 0 && <span className={l.sub}>S/ {p.ventas.toFixed(2)}</span>}</span> },
          { id: 'monedas', titulo: 'Monedas', alinear: 'fin', ancho: 130, tarjeta: 'detalle', celda: (p) => (p.pagadas || p.porPagar ? <span className={l.numero}><span className={l.soloTarjeta}>Monedas </span>{entero(p.pagadas + p.porPagar)}{p.porPagar > 0 && <span className={l.sub}>{entero(p.porPagar)} estimado</span>}</span> : <span className={l.sub}><span className={l.soloTarjeta}>Monedas </span>—</span>) },
          { id: 'ultimo', titulo: 'Última vez', ancho: 130, tarjeta: 'detalle', celda: (p) => <span className={l.sub}><span className={l.soloTarjeta}>Última vez </span>{fecha(p.ultimoMs)}</span> },
          { id: 'estado', titulo: 'Estado', ancho: 150, tarjeta: 'estado', celda: (p) => <InsigniaEstado estado={p.estado} estados={ESTADOS_REFERENTE} /> },
        ]}
      />
      <CargarMas visibles={Math.min(visibles, filtradas.length)} total={filtradas.length} paso={PASO} onMas={() => setVisibles((v) => v + PASO)} unidad={['persona', 'personas']} />

      <HojaInferior abierta={Boolean(persona)} onCerrar={() => setAbierta(null)} titulo={persona ? persona.nombre || persona.codigo : ''} tamano="lg">
        {persona && <VisitasDeReferente persona={persona} />}
      </HojaInferior>
    </div>
  );
}

/** Dentro de la hoja: sus cifras y cada persona que entró por su enlace, de la más nueva a la más vieja. */
function VisitasDeReferente({ persona: p }) {
  return (
    <div className={s.referente}>
      <p className={l.sub}>
        Código <code className={s.codigo}>{p.codigo}</code>
        {' · '}{entero(p.abrieron)} {p.abrieron === 1 ? 'visita' : 'visitas'}
        {' · '}{entero(p.compraron)} {p.compraron === 1 ? 'compra' : 'compras'}
        {p.cuentas > 0 && <>{' · '}{entero(p.cuentas)} {p.cuentas === 1 ? 'cuenta nueva' : 'cuentas nuevas'}</>}
      </p>
      {p.visitas.length ? (
        <ul className={s.visitas}>
          {p.visitas.map((v) => (
            <li key={v.id} className={s.visita}>
              <div className={s.visitaQuien}>
                <strong>{v.quien || 'Visitante sin cuenta'}</strong>
                <span className={l.sub}>{v.enlace} · {fechaHora(v.creadoMs)}</span>
              </div>
              <div className={s.visitaPedido}>
                {v.pedido ? (
                  <>
                    <span className={l.numero}>S/ {v.venta.toFixed(2)}</span>
                    <span className={l.sub}>
                      Pedido {v.pedido}
                      {v.monedas != null && ` · ${entero(v.monedas)} monedas${v.estimado ? ' (estimado)' : ''}`}
                    </span>
                  </>
                ) : <span className={l.sub}>Sin compra</span>}
              </div>
              <InsigniaEstado estado={v.estado} estados={ESTADOS_REFERIDO} />
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVacio titulo="Nadie entró todavía" texto="Compartió su enlace, pero nadie lo abrió." />
      )}
      {p.sinAbrir > 0 && (
        <p className={l.sub}>
          Además, {entero(p.sinAbrir)} {p.sinAbrir === 1 ? 'enlace' : 'enlaces'} del sistema anterior que nadie abrió (antes se guardaba uno cada vez que pulsaba compartir).
        </p>
      )}
    </div>
  );
}

/* ── Misiones diarias ──────────────────────────────────── */

/**
 * Misiones diarias (/admin/misiones): tareas cortas que el cliente completa
 * cada día a cambio de monedas.
 *  - misiones: [misionDesdeFirestore] · verificaciones: [{ valor, texto }] (MISSION_ACTIONS)
 *  - cargando · error · onReintentar · onGuardar(datos, id?) · onEliminar(id)
 */
export function PaginaMisionesAdmin({ misiones = [], verificaciones = [], cargando, error, onReintentar, onGuardar, onEliminar }) {
  const textoVerificacion = (v) => verificaciones.find((x) => x.valor === v)?.texto || v;
  return (
    <PaginaListaAdmin
      cabeza={{ icono: 'misiones', tono: 'rosa', titulo: 'Misiones diarias', subtitulo: 'Tareas cortas que el cliente completa cada día a cambio de monedas.' }}
      registros={misiones}
      cargando={cargando}
      error={error}
      onReintentar={onReintentar}
      femenino
      unidad={['misión', 'misiones']}
      buscarEn={(m) => `${m.nombre} ${m.descripcion}`}
      placeholder="Buscar una misión"
      filtros={[{ id: 'estado', etiqueta: 'Estado', todos: 'Activas e inactivas', opciones: [{ valor: 'si', texto: 'Solo activas' }, { valor: 'no', texto: 'Solo inactivas' }], filtrar: (m, v) => (v === 'si' ? m.activa : !m.activa) }]}
      columnas={[
        { id: 'nombre', titulo: 'Misión', tarjeta: 'titulo', celda: (m) => <>{m.nombre}{m.descripcion && <span className={l.sub}>{m.descripcion}</span>}</> },
        { id: 'monedas', titulo: 'Da', ancho: 120, alinear: 'fin', tarjeta: 'detalle', celda: (m) => <span className={l.numero}>{entero(m.monedas)} monedas</span> },
        { id: 'verificacion', titulo: 'Cómo se comprueba', tarjeta: 'detalle', celda: (m) => (m.verificacion ? textoVerificacion(m.verificacion) : <span className={l.sub}>La marca el cliente</span>) },
        { id: 'orden', titulo: 'Orden', ancho: 80, alinear: 'fin', ordenable: true, celda: (m) => m.orden },
        { id: 'estado', titulo: 'Estado', ancho: 110, tarjeta: 'estado', celda: (m) => <InsigniaEstado estado={m.activa ? 'activo' : 'oculto'}>{m.activa ? 'Activa' : 'Inactiva'}</InsigniaEstado> },
      ]}
      ordenes={{ orden: porOrden }}
      ordenInicial={{ por: 'orden', dir: 'asc' }}
      vacio={{ titulo: 'Todavía no hay misiones', texto: 'La lista que ven tus clientes en «Mi cuenta › Misiones» se llena con las que actives aquí.' }}
      textos={{ creado: 'Misión creada', guardado: 'Misión guardada', eliminado: 'Misión eliminada' }}
      eliminar={{ texto: (m) => `Se borra «${m.nombre}». No se puede deshacer.` }}
      onGuardar={onGuardar}
      onEliminar={onEliminar}
      formulario={{
        nuevo: 'Nueva misión',
        titulos: { nuevo: 'Nueva misión', editar: 'Editar misión' },
        textoGuardar: { nuevo: 'Crear misión' },
        vacio: ({ registros }) => ({ nombre: '', descripcion: '', monedas: 0, orden: registros.length, activa: true, verificacion: '' }),
        desde: (m) => ({ ...m }),
        validar: (d) => ({ nombre: String(d.nombre).trim() ? undefined : 'Escribe el título de la misión.' }),
        campos: ({ datos, cambiar, errores, idDe }) => (
          <>
            <GrupoCampos titulo="La misión">
              <Campo id={idDe('nombre')} etiqueta="Título" placeholder="Ej. Visita el Catálogo de Recompensas" value={datos.nombre} error={errores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
              <Campo etiqueta="Descripción" multilinea={3} placeholder="Una línea de qué tiene que hacer" value={datos.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} />
            </GrupoCampos>
            <GrupoCampos titulo="Lo que da y dónde va" columnas={2}>
              <Campo etiqueta="Monedas" type="number" inputMode="numeric" min={0} sufijo="monedas" value={datos.monedas} onChange={(e) => cambiar('monedas', e.target.value)} />
              <Campo etiqueta="Orden" type="number" inputMode="numeric" min={0} value={datos.orden} onChange={(e) => cambiar('orden', e.target.value)} />
            </GrupoCampos>
            <GrupoCampos titulo="Cómo se comprueba">
              <Campo
                etiqueta="Verificación"
                opciones={[{ valor: '', texto: 'Ninguna: la marca el cliente' }, ...verificaciones]}
                value={datos.verificacion}
                onChange={(e) => cambiar('verificacion', e.target.value)}
              />
              <Aviso tipo={datos.verificacion ? 'info' : 'aviso'} compacto>
                {datos.verificacion
                  ? 'El servidor comprueba que el cliente de verdad lo hizo antes de darle las monedas.'
                  : 'Sin verificación, el cliente toca «Completar» y se le paga sin comprobar nada: úsalo solo para lo que no se puede verificar (como compartir en redes).'}
              </Aviso>
            </GrupoCampos>
            <GrupoCampos titulo="Estado">
              <Interruptor etiqueta="Activa" descripcion="Apagada no sale en «Mis misiones» (no se borra)." activo={datos.activa} onChange={(v) => cambiar('activa', v)} />
            </GrupoCampos>
          </>
        ),
      }}
    />
  );
}

/* ── Retos semanales ───────────────────────────────────── */

const PESTANAS_RETOS = [{ id: 'catalogo', texto: 'Catálogo' }, { id: 'evidencias', texto: 'Evidencias' }, { id: 'activo', texto: 'Reto activo' }];

/**
 * Retos semanales (/admin/retos): el catálogo, las evidencias por revisar
 * y el reto de esta semana.
 *  - retos: [retoDesdeFirestore] · activo (globals/activeChallenge) · evidencias: [evidenciaDesde]
 *  - cargando · error · onReintentar · onGuardar(datos, id?) · onEliminar(id)
 *  - onActivar(reto) · onAprobar(evidencia) · onRechazar(evidencia) → promesas
 *  - ahora (para las pruebas)
 */
export function PaginaRetosAdmin({ retos = [], activo, evidencias = [], cargando, error, onReintentar, onGuardar, onEliminar, onActivar, onAprobar, onRechazar, ahora: ahoraFuera }) {
  const toast = useToast();
  const [pestana, setPestana] = useState('catalogo');
  const [activando, setActivando] = useState(null);
  const [rechazando, setRechazando] = useState(null);
  const [trabajando, setTrabajando] = useState(null);
  const pestanas = (
    <div className={s.pestanas}>
      <Pestanas
        etiqueta="Secciones de retos"
        opciones={PESTANAS_RETOS.map((p) => ({ ...p, texto: p.id === 'evidencias' && evidencias.length ? `${p.texto} · ${evidencias.length}` : p.texto }))}
        valor={pestana}
        onChange={setPestana}
      />
    </div>
  );
  const cabeza = { icono: 'retos', tono: 'rosa', titulo: 'Retos semanales', subtitulo: 'Un reto por semana para todos, y las evidencias que mandan los clientes.' };

  const activar = async () => {
    const r = activando;
    setActivando(null);
    try {
      await onActivar?.(r);
      toast({ tipo: 'exito', titulo: 'Reto activado', texto: `«${r.nombre}» es el reto de esta semana.` });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se activó', texto: err?.message });
    }
  };
  const procesar = async (ev, aprobar) => {
    setRechazando(null);
    setTrabajando(ev.id);
    try {
      await (aprobar ? onAprobar : onRechazar)?.(ev);
      toast({ tipo: aprobar ? 'exito' : 'info', titulo: aprobar ? 'Evidencia aprobada' : 'Evidencia rechazada', texto: `${ev.quien} · ${ev.reto}` });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo', texto: err?.message });
    } finally {
      setTrabajando(null);
    }
  };

  const confirmarActivar = (
    <Confirmar
      abierta={Boolean(activando)}
      titulo={activando ? `¿Activar «${activando.nombre}» como el reto de esta semana?` : ''}
      texto="Lo ven todos los clientes desde ahora y por siete días; reemplaza al reto activo."
      confirmar="Activar"
      onConfirmar={activar}
      onCancelar={() => setActivando(null)}
    />
  );

  if (pestana === 'catalogo') {
    return (
      <>
        <PaginaListaAdmin
          cabeza={cabeza}
          antes={pestanas}
          registros={retos}
          cargando={cargando}
          error={error}
          onReintentar={onReintentar}
          unidad={['reto', 'retos']}
          buscarEn={(r) => `${r.nombre} ${r.accion}`}
          placeholder="Buscar un reto"
          columnas={[
            { id: 'nombre', titulo: 'Reto', tarjeta: 'titulo', celda: (r) => <>{r.nombre}{activo?.challengeId === r.id && <span className={l.sub}>Es el de esta semana</span>}</> },
            { id: 'accion', titulo: 'Qué cuenta', tarjeta: 'detalle', celda: (r) => <code className={s.codigo}>{r.accion}</code> },
            { id: 'meta', titulo: 'Meta', ancho: 80, alinear: 'fin', tarjeta: 'detalle', celda: (r) => r.meta },
            { id: 'recompensa', titulo: 'Da', tarjeta: 'detalle', celda: (r) => recompensaDeReto(r) },
          ]}
          vacio={{ titulo: 'Todavía no hay retos', texto: 'Crea el primero y actívalo para esta semana.' }}
          textos={{ creado: 'Reto creado', guardado: 'Reto guardado', eliminado: 'Reto eliminado' }}
          eliminar={{ texto: (r) => `Se borra «${r.nombre}» del catálogo.${activo?.challengeId === r.id ? ' El reto activo sigue hasta que venza.' : ''}` }}
          masAcciones={(r) => [{ id: 'activar', etiqueta: 'Activar esta semana', Icono: Rocket, accion: () => setActivando(r) }]}
          onGuardar={onGuardar}
          onEliminar={onEliminar}
          formulario={{
            nuevo: 'Nuevo reto',
            titulos: { nuevo: 'Nuevo reto', editar: 'Editar reto' },
            textoGuardar: { nuevo: 'Crear reto' },
            vacio: () => ({ nombre: '', descripcion: '', accion: '', meta: 1, monedas: 10, tipo: 'main' }),
            desde: (r) => ({ ...r }),
            validar: (d) => ({
              nombre: String(d.nombre).trim() ? undefined : 'Escribe el título del reto.',
              accion: String(d.accion).trim() ? undefined : 'Escribe qué acción cuenta (su id, como add_wishlist).',
              descripcion: String(d.descripcion).trim() ? undefined : 'Escribe una descripción corta.',
            }),
            campos: ({ datos, cambiar, errores, idDe }) => (
              <>
                <GrupoCampos titulo="El reto">
                  <Campo id={idDe('nombre')} etiqueta="Título" placeholder="Ej. Agrega 3 productos a tus deseos" value={datos.nombre} error={errores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
                  <Campo id={idDe('descripcion')} etiqueta="Descripción corta" multilinea={3} value={datos.descripcion} error={errores.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} />
                </GrupoCampos>
                <GrupoCampos titulo="Qué cuenta" columnas={2}>
                  <Campo id={idDe('accion')} etiqueta="Acción (id)" placeholder="Ej. add_wishlist" value={datos.accion} error={errores.accion} onChange={(e) => cambiar('accion', e.target.value)} />
                  <Campo etiqueta="Meta (cuántas veces)" type="number" inputMode="numeric" min={1} value={datos.meta} onChange={(e) => cambiar('meta', e.target.value)} />
                </GrupoCampos>
                <GrupoCampos titulo="Lo que da" columnas={2}>
                  <Campo etiqueta="Recompensa" opciones={RECOMPENSAS_RETO} value={datos.tipo} onChange={(e) => cambiar('tipo', e.target.value)} />
                  {datos.tipo === 'main' && <Campo etiqueta="Monedas" type="number" inputMode="numeric" min={0} sufijo="monedas" value={datos.monedas} onChange={(e) => cambiar('monedas', e.target.value)} />}
                </GrupoCampos>
              </>
            ),
          }}
        />
        {confirmarActivar}
      </>
    );
  }

  // Al momento de mirar (no desde que se abrió la página): un reto de 7 días no dice "quedan 8".
  const faltaMs = activo?.expiresAt ? Date.parse(activo.expiresAt) - (ahoraFuera ?? Date.now()) : null;
  const dias = faltaMs == null ? null : Math.ceil(faltaMs / 86400000);
  const quedan = faltaMs == null ? '' : faltaMs <= 0 ? 'Ya venció' : faltaMs < 86400000 ? 'Vence en menos de un día' : `Quedan ${dias} días`;
  return (
    <div className={s.pagina} data-componente="PaginaRetosAdmin">
      <CabezaAdmin {...cabeza} />
      {pestanas}
      {pestana === 'evidencias' && (
        <TablaAdmin
          etiqueta="Evidencias por revisar"
          filas={evidencias}
          nombreDe={(e) => `${e.quien} · ${e.reto}`}
          cargando={cargando}
          error={error}
          onReintentar={onReintentar}
          vacio={{ titulo: 'Nada por revisar', texto: 'Cuando un cliente mande su evidencia, aparece aquí.' }}
          columnas={[
            { id: 'foto', titulo: 'Evidencia', ancho: 72, tarjeta: 'foto', celda: (e) => (e.tipo === 'imagen' ? <FotoCelda src={e.url} /> : <FotoCelda />) },
            { id: 'quien', titulo: 'Cliente', tarjeta: 'titulo', celda: (e) => <>{e.quien}<span className={l.sub}>{e.reto}</span></> },
            { id: 'enviada', titulo: 'Enviada', ancho: 150, tarjeta: 'detalle', celda: (e) => fechaHora(e.enviadaMs) },
            { id: 'da', titulo: 'Si se aprueba', tarjeta: 'detalle', celda: (e) => recompensaDeReto({ tipo: e.tipoRecompensa, monedas: e.monedas }) },
            {
              id: 'acciones', titulo: 'Revisar', ancho: 300, tarjeta: 'control',
              celda: (e) => (
                <span className={s.revisar}>
                  {e.url && <Boton tamano="sm" variante="fantasma" icono={<ExternalLink aria-hidden="true" />} to={e.url}>{e.tipo === 'imagen' ? 'Ver foto' : 'Ver enlace'}</Boton>}
                  <Boton tamano="sm" variante="primario" icono={<Check aria-hidden="true" />} cargando={trabajando === e.id} disabled={Boolean(trabajando)} onClick={(ev) => { ev.stopPropagation(); procesar(e, true); }}>Aprobar</Boton>
                  <Boton tamano="sm" variante="contorno" icono={<X aria-hidden="true" />} disabled={Boolean(trabajando)} onClick={(ev) => { ev.stopPropagation(); setRechazando(e); }}>Rechazar</Boton>
                </span>
              ),
            },
          ]}
        />
      )}
      {pestana === 'activo' && (
        activo ? (
          <section className={s.activo}>
            <h2>{activo.title}</h2>
            {activo.description && <p>{activo.description}</p>}
            <dl className={s.datos}>
              <div><dt>Qué cuenta</dt><dd><code className={s.codigo}>{activo.actionType}</code> · meta {activo.goal}</dd></div>
              <div><dt>Da</dt><dd>{recompensaDeReto(activo)}</dd></div>
              <div><dt>Empezó</dt><dd>{fechaHora(Date.parse(activo.startedAt))}</dd></div>
              <div><dt>Vence</dt><dd>{fechaHora(Date.parse(activo.expiresAt))}{quedan && <span className={l.sub}>{quedan}</span>}</dd></div>
            </dl>
            <Boton variante="secundario" onClick={() => setPestana('catalogo')}>Cambiar de reto</Boton>
          </section>
        ) : (
          <EstadoVacio titulo="No hay un reto activo" texto="Elige uno del catálogo con «Activar esta semana».">
            <Boton variante="secundario" onClick={() => setPestana('catalogo')}>Ir al catálogo</Boton>
          </EstadoVacio>
        )
      )}
      <Confirmar
        abierta={Boolean(rechazando)}
        titulo={rechazando ? `¿Rechazar la evidencia de ${rechazando.quien}?` : ''}
        texto="No recibe la recompensa por esta evidencia."
        confirmar="Rechazar"
        peligro
        onConfirmar={() => procesar(rechazando, false)}
        onCancelar={() => setRechazando(null)}
      />
      {confirmarActivar}
    </div>
  );
}

/* ── Recompensas (D5b) ─────────────────────────────────── */

/**
 * Recompensas (/admin/recompensas): el catálogo que el cliente canjea con
 * sus monedas en «Mi cuenta». Cada una se entrega a mano o como un cupón.
 *  - recompensas: [recompensaDesdeFirestore] · productos: [productoAdminDesde] (para elegir uno)
 *  - subirImagen(blob, { alAvanzar }) → url · cargando · error · onReintentar
 *  - onGuardar(datos, id?) · onEliminar(id)
 */
export function PaginaRecompensasAdmin({ recompensas = [], productos = [], packsStickers = [], subirImagen, cargando, error, onReintentar, onGuardar, onEliminar, onGuardarOrden, pestanas }) {
  const tipoTexto = (v) => TIPOS_RECOMPENSA.find((x) => x.valor === v)?.texto || v;
  const queDa = (r) => <>{beneficioDeRecompensa(r) || tipoTexto(r.tipo)}{r.tipo === 'manual' && r.nota && <span className={l.sub}>Nota: {r.nota}</span>}</>;
  const estadoDe = (r) => <InsigniaEstado estado={r.activa ? 'activo' : 'oculto'}>{r.activa ? 'Activa' : 'Inactiva'}</InsigniaEstado>;
  return (
    <PaginaListaAdmin
      cabeza={{ icono: 'recompensas', tono: 'rosa', titulo: 'Recompensas', subtitulo: 'Lo que tus clientes canjean con sus monedas en «Mi cuenta».' }}
      antes={pestanas}
      registros={recompensas}
      cargando={cargando}
      error={error}
      onReintentar={onReintentar}
      femenino
      unidad={['recompensa', 'recompensas']}
      buscarEn={(r) => `${r.nombre} ${r.descripcion} ${r.productoNombre}`}
      placeholder="Buscar una recompensa"
      filtros={[
        { id: 'estado', etiqueta: 'Estado', todos: 'Activas e inactivas', opciones: [{ valor: 'si', texto: 'Solo activas' }, { valor: 'no', texto: 'Solo inactivas' }], filtrar: (r, v) => (v === 'si' ? r.activa : !r.activa) },
        { id: 'tipo', etiqueta: 'Qué da', todos: 'Todo', opciones: TIPOS_RECOMPENSA, filtrar: (r, v) => r.tipo === v },
      ]}
      columnas={[
        { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (r) => <FotoCelda src={r.imagen} /> },
        { id: 'nombre', titulo: 'Recompensa', tarjeta: 'titulo', celda: (r) => <>{r.nombre}{r.descripcion && <span className={l.sub}>{r.descripcion}</span>}</> },
        // Lo que cuesta se dice con su palabra: un número de monedas solo se lee como lo que se gana.
        { id: 'cuesta', titulo: 'Cuesta', ancho: 130, alinear: 'fin', tarjeta: 'detalle', celda: (r) => <span className={l.numero}>{entero(r.cuesta)} monedas</span> },
        { id: 'da', titulo: 'Da', tarjeta: 'detalle', celda: queDa },
        ...(onGuardarOrden ? [] : [{ id: 'orden', titulo: 'Orden', ancho: 80, alinear: 'fin', ordenable: true, celda: (r) => r.orden }]),
        { id: 'estado', titulo: 'Estado', ancho: 110, tarjeta: 'estado', celda: estadoDe },
      ]}
      // Con onGuardarOrden la lista se arrastra (como Marcas y Categorías): el
      // orden de aquí es el del catálogo de «Mi cuenta».
      ordenable={onGuardarOrden ? {
        etiqueta: 'Orden de las recompensas',
        onGuardar: onGuardarOrden,
        cabecera: (
          <span className={s.filaRecompensa}>
            <span>Foto</span>
            <span>Recompensa</span>
            <span className={s.filaCuesta}>Cuesta</span>
            <span className={s.filaDa}>Da</span>
            <span className={s.filaEstado}>Estado</span>
          </span>
        ),
        fila: (r) => (
          <span className={s.filaRecompensa}>
            <FotoCelda src={r.imagen} tamano={40} />
            <span className={s.filaTextos}>
              <strong>{r.nombre}</strong>
              {r.descripcion && <span className={l.sub}>{r.descripcion}</span>}
            </span>
            <span className={`${s.filaCuesta} ${l.numero}`}>{entero(r.cuesta)} monedas</span>
            <span className={s.filaDa}>{queDa(r)}</span>
            <span className={s.filaEstado}>{estadoDe(r)}</span>
          </span>
        ),
      } : undefined}
      ordenes={{ orden: porOrden }}
      ordenInicial={{ por: 'orden', dir: 'asc' }}
      vacio={{ titulo: 'Todavía no hay recompensas', texto: 'El catálogo que ven tus clientes en «Mi cuenta» se llena con las que actives aquí.' }}
      textos={{ creado: 'Recompensa creada', guardado: 'Recompensa guardada', eliminado: 'Recompensa eliminada' }}
      eliminar={{ texto: (r) => `Se borra «${r.nombre}» del catálogo. Los cupones que ya se canjearon siguen valiendo.` }}
      onGuardar={onGuardar}
      onEliminar={onEliminar}
      formulario={{
        nuevo: 'Nueva recompensa',
        titulos: { nuevo: 'Nueva recompensa', editar: 'Editar recompensa' },
        textoGuardar: { nuevo: 'Crear recompensa' },
        vacio: ({ registros }) => ({
          // Una nueva va al final.
          nombre: '', descripcion: '', cuesta: 0, nota: '', orden: registros.reduce((x, r) => Math.max(x, (Number(r.orden) || 0) + 1), 0), activa: true, tipo: 'manual',
          descuentoPct: 0, descuentoMonto: 0, topeDescuento: 0, productoId: '', productoNombre: '', vigenciaDias: 30, imagen: '',
        }),
        desde: (r) => ({ ...r }),
        validar: (d) => erroresDeRecompensa(d),
        campos: ({ datos, cambiar, errores, idDe }) => {
          const beneficio = beneficioDeRecompensa(datos);
          const conDescuento = datos.tipo === 'descuento' || datos.tipo === 'producto_descuento';
          const pct = Number(datos.descuentoPct) > 0;
          return (
            <>
              <GrupoCampos titulo="La recompensa">
                <Campo id={idDe('nombre')} etiqueta="Título" placeholder="Ej. Pack de stickers" value={datos.nombre} error={errores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
                <Campo etiqueta="Descripción" multilinea={3} placeholder="Una línea de qué es" value={datos.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} />
                <CampoImagen etiqueta="Imagen (opcional)" valor={datos.imagen} onCambiar={(url) => cambiar('imagen', url)} subir={subirImagen} recorte="cuadrado" forma="cuadro" />
              </GrupoCampos>
              <GrupoCampos titulo="Cuánto cuesta" columnas={onGuardarOrden ? 1 : 2}>
                <Campo etiqueta="Cuesta" type="number" inputMode="numeric" min={0} sufijo="monedas" value={datos.cuesta} onChange={(e) => cambiar('cuesta', e.target.value)} />
                {/* Con la lista para arrastrar, el orden no se escribe. */}
                {!onGuardarOrden && <Campo etiqueta="Orden" type="number" inputMode="numeric" min={0} value={datos.orden} onChange={(e) => cambiar('orden', e.target.value)} />}
              </GrupoCampos>
              <GrupoCampos titulo="Qué da" ayuda={AYUDA_TIPO[datos.tipo] || AYUDA_TIPO.cupon}>
                <Campo etiqueta="Tipo" opciones={TIPOS_RECOMPENSA} value={datos.tipo} onChange={(e) => { cambiar('tipo', e.target.value); if (e.target.value === 'stickers_whatsapp' && !datos.packId && packsStickers[0]) cambiar('packId', packsStickers[0].valor); }} />
                {datos.tipo === 'stickers_whatsapp' && (
                  <Campo id={idDe('packId')} etiqueta="Pack" opciones={packsStickers} value={datos.packId} error={errores.packId} onChange={(e) => cambiar('packId', e.target.value)} ayuda="Una sola vez por persona. Los añade a WhatsApp desde la app de Android; en la web le sale el enlace a Google Play." />
                )}
                {RECOMPENSA_CON_PRODUCTO.includes(datos.tipo) && (
                  <div className={s.producto}>
                    <span id={idDe('productoId')} tabIndex={-1} className={s.productoElegido}>
                      {datos.productoId ? <>Producto: <strong>{datos.productoNombre || datos.productoId}</strong></> : 'Todavía no elegiste el producto.'}
                    </span>
                    {errores.productoId && <p className={s.error}>{errores.productoId}</p>}
                    <SelectorProductos
                      productos={productos}
                      yaEstan={datos.productoId ? [datos.productoId] : []}
                      accion={datos.productoId ? 'Cambiar a este' : 'Elegir este'}
                      accionHecha="Es este"
                      limite={6}
                      onElegir={async (p) => { cambiar('productoId', p.id); cambiar('productoNombre', p.nombre); }}
                    />
                  </div>
                )}
                {conDescuento && (
                  <div className={s.dos}>
                    <Campo id={idDe('descuentoPct')} etiqueta="Descuento" type="number" inputMode="decimal" min={0} max={100} sufijo="%" value={datos.descuentoPct} error={errores.descuentoPct} onChange={(e) => cambiar('descuentoPct', e.target.value)} />
                    {datos.tipo === 'descuento' && (pct
                      ? <CampoDinero id={idDe('topeDescuento')} etiqueta="Hasta (tope)" value={datos.topeDescuento} error={errores.topeDescuento} onChange={(e) => cambiar('topeDescuento', e.target.value)} />
                      : <CampoDinero etiqueta="O un monto fijo" value={datos.descuentoMonto} onChange={(e) => cambiar('descuentoMonto', e.target.value)} />)}
                  </div>
                )}
                {RECOMPENSA_CON_VIGENCIA.includes(datos.tipo) && (
                  <Campo etiqueta="El cupón vence en" type="number" inputMode="numeric" min={1} sufijo="días" value={datos.vigenciaDias} onChange={(e) => cambiar('vigenciaDias', e.target.value)} />
                )}
                {beneficio && <p className={s.muestra}><span>El cliente verá:</span> {beneficio}</p>}
              </GrupoCampos>
              <GrupoCampos titulo="Para el equipo">
                <Campo etiqueta="Nota interna (opcional)" ayuda="Solo la ve el admin, no el cliente." placeholder="Ej. accesorio físico, código para el asesor…" value={datos.nota} onChange={(e) => cambiar('nota', e.target.value)} />
                <Interruptor etiqueta="Activa" descripcion="Apagada no se puede canjear (no se borra)." activo={datos.activa} onChange={(v) => cambiar('activa', v)} />
              </GrupoCampos>
            </>
          );
        },
      }}
    />
  );
}

/* ── Canjes de recompensas ─────────────────────────────── */

/**
 * Recompensas › Canjes: quién canjeó qué. Lo que se entrega a mano (el pack
 * de stickers) queda por entregar hasta que alguien lo marca; los cupones de
 * descuento y envío los usa el cliente en el carrito (aquí solo se ven).
 *  - canjes: [canjesDesde] · cargando · error · onReintentar
 *  - onEntregar(id, entregado) → promesa · pestanas: un nodo debajo de la cabecera
 */
export function PaginaCanjesAdmin({ canjes = [], cargando = false, error, onReintentar, onEntregar, pestanas }) {
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [visibles, setVisibles] = useState(PASO);
  const [procesando, setProcesando] = useState(null);
  const [deshacer, setDeshacer] = useState(null);
  const r = useMemo(() => resumenCanjes(canjes), [canjes]);
  const filtrados = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    return canjes.filter((c) => (!estado || c.estado === estado) && (!q || normalizarBusqueda(
      `${c.cliente} ${c.email} ${c.telefono} ${c.codigo} ${c.recompensa}`,
    ).includes(q)));
  }, [canjes, busqueda, estado]);

  const marcar = async (c, entregado) => {
    setProcesando(c.id);
    try {
      await onEntregar(c.id, entregado);
      toast({ tipo: 'exito', titulo: entregado ? 'Marcado como entregado' : 'Vuelve a estar por entregar', texto: `${c.recompensa} · ${c.cliente}` });
    } catch (e) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: e?.message || 'Inténtalo otra vez.' });
    } finally {
      setProcesando(null);
    }
  };

  return (
    <div className={s.pagina} data-componente="PaginaCanjesAdmin">
      <CabezaAdmin icono="recompensas" tono="rosa" titulo="Recompensas" subtitulo="Lo que tus clientes canjean con sus monedas en «Mi cuenta»." />
      {pestanas}
      <Aviso tipo="info" compacto>
        Lo que se entrega a mano queda aquí por entregar: escríbele al cliente, coordina el envío y márcalo entregado. Los stickers de WhatsApp se entregan solos cuando el cliente los añade desde la app, y los cupones de descuento y de envío gratis los usa él mismo en el carrito.
      </Aviso>
      <FilaCifras etiqueta="Resumen de canjes">
        <Cifra nombre="Por entregar" valor={entero(r.porEntregar)} tono="aviso" cargando={cargando} />
        <Cifra nombre="Entregados" valor={entero(r.entregados)} tono="exito" cargando={cargando} />
        <Cifra nombre="Cupones sin usar" valor={entero(r.sinUsar)} tono="violeta" cargando={cargando} />
        <Cifra nombre="Cupones usados" valor={entero(r.usados)} tono="neutro" cargando={cargando} />
      </FilaCifras>
      <BarraFiltros
        busqueda={busqueda}
        onBusqueda={(t) => { setBusqueda(t); setVisibles(PASO); }}
        placeholder="Buscar por cliente, teléfono, código o recompensa"
        filtros={[{ id: 'estado', etiqueta: 'Estado', todos: 'Todos', opciones: Object.entries(ESTADOS_CANJE).map(([valor, e]) => ({ valor, texto: e.texto })), valor: estado }]}
        onFiltro={(_, v) => { setEstado(v); setVisibles(PASO); }}
        total={cargando || error ? undefined : filtrados.length}
        unidad={['canje', 'canjes']}
      />
      <TablaAdmin
        etiqueta="Canjes"
        filas={filtrados.slice(0, visibles)}
        nombreDe={(c) => `${c.recompensa} de ${c.cliente}`}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        vacio={canjes.length ? { titulo: 'Ningún canje coincide', texto: 'Prueba con otro estado o busca otra cosa.' } : { titulo: 'Todavía nadie canjeó', texto: 'Cuando un cliente canjee una recompensa con sus monedas, aparece aquí.' }}
        columnas={[
          { id: 'cliente', titulo: 'Cliente', tarjeta: 'titulo', celda: (c) => <>{c.cliente}<span className={l.sub}>{c.telefono || c.email || 'Sin teléfono'}</span></> },
          { id: 'recompensa', titulo: 'Recompensa', tarjeta: 'detalle', celda: (c) => <>{c.recompensa}<span className={l.sub}>Código <code className={s.codigo}>{c.codigo}</code></span></> },
          { id: 'fecha', titulo: 'Canjeó', ancho: 140, tarjeta: 'detalle', celda: (c) => <span className={l.sub}><span className={l.soloTarjeta}>Canjeó el </span>{fechaHora(c.creadoMs)}</span> },
          {
            id: 'estado', titulo: 'Estado', ancho: 170, tarjeta: 'estado',
            celda: (c) => (
              <span className={s.canjeEstado}>
                <InsigniaEstado estado={c.estado} estados={ESTADOS_CANJE} />
                {c.estado === 'entregado' && c.entregadoMs && <span className={l.sub}>{fecha(c.entregadoMs)}{c.entregadoPor && ` · ${c.entregadoPor}`}</span>}
                {c.pedido && <span className={l.sub}>Pedido {c.pedido}</span>}
              </span>
            ),
          },
          {
            id: 'acciones', titulo: '', ancho: 260, alinear: 'fin', tarjeta: 'control',
            celda: (c) => (c.manual ? (
              <span className={s.canjeAcciones}>
                {c.whatsapp && c.estado === 'porEntregar' && (
                  <Boton tamano="sm" variante="contorno" icono={<MessageCircle aria-hidden="true" />} to={c.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</Boton>
                )}
                {c.estado === 'porEntregar'
                  ? <Boton tamano="sm" icono={<Check aria-hidden="true" />} cargando={procesando === c.id} onClick={() => marcar(c, true)}>Entregado</Boton>
                  : <Boton tamano="sm" variante="fantasma" icono={<Undo2 aria-hidden="true" />} disabled={procesando === c.id} onClick={() => setDeshacer(c)}>Deshacer</Boton>}
              </span>
            ) : null),
          },
        ]}
      />
      <CargarMas visibles={Math.min(visibles, filtrados.length)} total={filtrados.length} paso={PASO} onMas={() => setVisibles((v) => v + PASO)} unidad={['canje', 'canjes']} />
      <Confirmar
        abierta={Boolean(deshacer)}
        titulo="¿Volver a «por entregar»?"
        texto={deshacer ? `${deshacer.recompensa} de ${deshacer.cliente} vuelve a la lista de por entregar, y su cupón vuelve a estar activo en su cuenta.` : ''}
        confirmar="Sí, deshacer"
        onCancelar={() => setDeshacer(null)}
        onConfirmar={() => { const c = deshacer; setDeshacer(null); marcar(c, false); }}
      />
    </div>
  );
}

