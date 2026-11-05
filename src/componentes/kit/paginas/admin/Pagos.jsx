import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, RefreshCw } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, useToast } from '../../Feedback';
import { Campo } from '../../Formulario';
import { CampoFecha } from '../../Fecha';
import { Pestanas } from '../../Navegacion';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, CargarMas, InsigniaEstado } from '../../piezas/admin/Datos';
import { GrupoCampos, CampoDinero } from '../../piezas/admin/Formularios';
import { Cifra, FilaCifras } from '../../piezas/admin/Metricas';
import { GraficoTendencia } from '../../piezas/admin/Grafico';
import {
  PERIODOS_PAGOS, rangoDePeriodo, enlaceEnFiltro, resumenEnlaces, serieDiariaEnlaces, duracionCorta, enlaceNuevo,
  vidaDeEnlace, HORAS_ENLACE_PAGO,
} from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Pagos.module.css';
import { EsqueletoFormulario } from '../../Esqueletos';

/*
 * D3b · Gestión de pagos (/admin/gestion-pagos): el historial de los
 * enlaces de pago con sus cifras y su gráfico, generar uno nuevo y los
 * datos de Yape, Plin y WhatsApp que ve el cliente al pagar un saldo.
 */

const PASO = 50;
const PESTANAS = [
  { id: 'historial', texto: 'Historial' },
  { id: 'generar', texto: 'Nuevo enlace' },
  { id: 'ajustes', texto: 'Ajustes' },
];
const METODOS = [{ valor: 'culqi', texto: 'Culqi (S/)' }, { valor: 'paypal', texto: 'PayPal ($)' }];
const ESTADOS_ENLACE = { pagado: { texto: 'Pagado', tono: 'exito' }, pendiente: { texto: 'Pendiente', tono: 'aviso' }, vencido: { texto: 'Vencido', tono: 'neutro' } };

const dinero = (monto, moneda) => (monto == null ? '—' : `${moneda === 'USD' ? '$' : 'S/'} ${Number(monto).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const fechaHora = (ms) => (ms ? new Date(ms).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));

function copiar(texto, toast, que = 'Enlace copiado') {
  navigator.clipboard?.writeText(texto).catch(() => {});
  toast({ tipo: 'exito', titulo: que, texto });
}

/* ── Historial ─────────────────────────────────────────── */

function Historial({ enlaces, cargando, error, onActualizar, urlDe }) {
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [filtros, setFiltros] = useState({ estado: '', metodo: '', periodo: '' });
  const [fechas, setFechas] = useState({ desde: '', hasta: '' });
  const [visibles, setVisibles] = useState(PASO);
  const [copiado, setCopiado] = useState(null);

  const rango = rangoDePeriodo(filtros.periodo, fechas);
  const filtrados = useMemo(
    () => enlaces.filter((e) => enlaceEnFiltro(e, { estado: filtros.estado, metodo: filtros.metodo, rango, q: busqueda })),
    [enlaces, filtros, busqueda, rango[0], rango[1]], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const r = useMemo(() => resumenEnlaces(filtrados), [filtrados]);
  const serie = useMemo(() => serieDiariaEnlaces(filtrados), [filtrados]);
  const cobrado = [r.cobradoPEN > 0 && dinero(r.cobradoPEN, 'PEN'), r.cobradoUSD > 0 && dinero(r.cobradoUSD, 'USD')].filter(Boolean);
  const filtrar = (id, v) => { setFiltros((f) => ({ ...f, [id]: v })); setVisibles(PASO); };

  const copiarDe = (e) => {
    copiar(urlDe(e.id), toast);
    setCopiado(e.id);
    window.setTimeout(() => setCopiado((c) => (c === e.id ? null : c)), 1600);
  };

  return (
    <div className={s.bloques}>
      <FilaCifras etiqueta="Resumen de los enlaces">
        <Cifra nombre="Enlaces generados" valor={entero(r.generados)} tono="violeta" cargando={cargando} />
        <Cifra nombre="Pagados" valor={entero(r.pagados)} ayuda={[r.pendientes ? `${entero(r.pendientes)} pendiente${r.pendientes === 1 ? '' : 's'}` : 'Ninguno pendiente', r.vencidos ? `${entero(r.vencidos)} vencido${r.vencidos === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')} tono="exito" cargando={cargando} />
        <Cifra nombre="Conversión" valor={`${r.conversion.toLocaleString('es-PE', { maximumFractionDigits: 1 })} %`} ayuda="Pagados ÷ generados" tono="cielo" cargando={cargando} />
        <Cifra nombre="Cobrado" valor={cobrado[0] || 'S/ 0.00'} ayuda={cobrado[1] ? `y ${cobrado[1]}` : 'Soles por Culqi, dólares por PayPal'} tono="aviso" cargando={cargando} />
        <Cifra nombre="Tiempo hasta el pago" valor={duracionCorta(r.tiempoPromedio)} ayuda="En promedio" tono="neutro" cargando={cargando} />
      </FilaCifras>

      <BarraFiltros
        busqueda={busqueda}
        onBusqueda={(t) => { setBusqueda(t); setVisibles(PASO); }}
        placeholder="Buscar un concepto"
        filtros={[
          { id: 'estado', etiqueta: 'Estado', todos: 'Todos', opciones: [{ valor: 'pendiente', texto: 'Pendientes' }, { valor: 'pagado', texto: 'Pagados' }, { valor: 'vencido', texto: 'Vencidos (36 h)' }], valor: filtros.estado },
          { id: 'metodo', etiqueta: 'Método', todos: 'Culqi y PayPal', opciones: METODOS, valor: filtros.metodo },
          { id: 'periodo', etiqueta: 'Periodo', todos: 'Desde el inicio', opciones: PERIODOS_PAGOS, valor: filtros.periodo },
        ]}
        onFiltro={filtrar}
        total={cargando || error ? undefined : filtrados.length}
        unidad={['enlace', 'enlaces']}
      />
      {filtros.periodo === 'fechas' && (
        <div className={s.fechas}>
          <CampoFecha etiqueta="Desde" valor={fechas.desde} max={fechas.hasta || undefined} onCambiar={(v) => setFechas((f) => ({ ...f, desde: v }))} />
          <CampoFecha etiqueta="Hasta" valor={fechas.hasta} min={fechas.desde || undefined} onCambiar={(v) => setFechas((f) => ({ ...f, hasta: v }))} />
        </div>
      )}

      {!error && !cargando && (
        <GraficoTendencia
          titulo="Actividad por día"
          subtitulo="Enlaces generados y pagados (un pago cuenta el día en que se pagó)"
          datos={serie}
          series={[{ id: 'generados', nombre: 'Generados', tono: 'violeta' }, { id: 'pagados', nombre: 'Pagados', tono: 'menta' }]}
          formato={entero}
          forma="barras"
          vacio="Todavía no hay enlaces en este rango."
        />
      )}

      <TablaAdmin
        etiqueta="Enlaces de pago"
        filas={filtrados.slice(0, visibles)}
        nombreDe={(e) => e.concepto || 'Enlace'}
        cargando={cargando}
        error={error}
        onReintentar={onActualizar}
        vacio={enlaces.length
          ? { titulo: 'Ningún enlace coincide', texto: 'Prueba con otro estado, método o periodo.' }
          : { titulo: 'Todavía no hay enlaces', texto: 'Genera uno en la pestaña «Generar enlace».' }}
        acciones={(e) => [
          { id: 'copiar', etiqueta: 'Copiar enlace', Icono: Copy, accion: () => copiarDe(e) },
          { id: 'abrir', etiqueta: 'Abrir la página de pago', Icono: ExternalLink, accion: () => window.open(urlDe(e.id), '_blank', 'noopener') },
        ]}
        columnas={[
          { id: 'concepto', titulo: 'Concepto', tarjeta: 'titulo', celda: (e) => <>{e.concepto || '—'}<span className={l.sub}>Creado {fechaHora(e.createdMs)}</span></> },
          { id: 'monto', titulo: 'Monto', ancho: 120, alinear: 'fin', tarjeta: 'detalle', celda: (e) => <span className={l.numero}>{dinero(e.monto, e.moneda)}</span> },
          { id: 'metodo', titulo: 'Método', ancho: 90, tarjeta: 'detalle', celda: (e) => (e.metodo === 'culqi' ? 'Culqi' : e.metodo === 'paypal' ? 'PayPal' : '—') },
          {
            // Debajo, su tiempo de vida: cuánto le queda o cuándo venció (pasando el ratón, la fecha exacta).
            id: 'estado', titulo: 'Estado', ancho: 160, tarjeta: 'estado',
            celda: (e) => {
              const vida = vidaDeEnlace(e);
              return <><InsigniaEstado estado={e.estado} estados={ESTADOS_ENLACE} />{vida && <span className={l.sub} title={vida.titulo}>{vida.texto}</span>}</>;
            },
          },
          { id: 'pagado', titulo: 'Pagado', ancho: 170, tarjeta: 'detalle', celda: (e) => (e.estado === 'pagado' ? <>{fechaHora(e.pagadoMs)}<span className={l.sub}>en {duracionCorta(e.tiempoPagoMs)}</span></> : '—') },
          {
            id: 'copiar', titulo: 'Enlace', ancho: 110, tarjeta: 'control',
            celda: (e) => (
              <Boton tamano="sm" variante="secundario" icono={copiado === e.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} onClick={(ev) => { ev.stopPropagation(); copiarDe(e); }} aria-label={`Copiar el enlace de «${e.concepto || 'este cobro'}»`}>
                {copiado === e.id ? 'Copiado' : 'Copiar'}
              </Boton>
            ),
          },
        ]}
      />
      <CargarMas visibles={Math.min(visibles, filtrados.length)} total={filtrados.length} paso={PASO} onMas={() => setVisibles((v) => v + PASO)} unidad={['enlace', 'enlaces']} />
    </div>
  );
}

/* ── Generar ───────────────────────────────────────────── */

function Generar({ onGenerar, urlDe, onVerHistorial }) {
  const toast = useToast();
  const [datos, setDatos] = useState({ concepto: '', moneda: 'PEN', monto: '' });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState('');
  const [hecho, setHecho] = useState(null); // { url, concepto, monto, venceMs }
  const cambiar = (k, v) => { setDatos((d) => ({ ...d, [k]: v })); setErrores((e) => ({ ...e, [k]: undefined })); };

  const generar = async (ev) => {
    ev.preventDefault();
    const r = enlaceNuevo(datos);
    if (r.errores) { setErrores(r.errores); return; }
    setEnviando(true);
    setFallo('');
    try {
      const id = await onGenerar?.(r.datos);
      setHecho({ url: urlDe(id), concepto: r.datos.concepto, monto: dinero(r.datos.monto, r.datos.moneda), venceMs: Date.now() + HORAS_ENLACE_PAGO * 3600000 });
      setDatos((d) => ({ ...d, concepto: '', monto: '' }));
    } catch (err) {
      setFallo(err?.message || 'No se pudo crear el enlace. Vuelve a intentar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={s.angosto}>
      <form className={s.tarjeta} onSubmit={generar} noValidate>
        <GrupoCampos titulo="Un cobro que no es un pedido" ayuda={`Saldos extra, envíos al extranjero… El cliente paga con tarjeta en la página del enlace. El enlace dura ${HORAS_ENLACE_PAGO} horas: después dice que venció y hay que generar otro.`}>
          <Campo id="pago-concepto" etiqueta="Concepto" placeholder="Ej. Diferencia de envío a España" value={datos.concepto} error={errores.concepto} onChange={(e) => cambiar('concepto', e.target.value)} />
        </GrupoCampos>
        <GrupoCampos titulo="Cuánto" columnas={2}>
          <Campo etiqueta="Moneda" opciones={[{ valor: 'PEN', texto: 'Soles (S/) · Culqi' }, { valor: 'USD', texto: 'Dólares ($) · PayPal' }]} value={datos.moneda} onChange={(e) => cambiar('moneda', e.target.value)} />
          <CampoDinero id="pago-monto" etiqueta="Monto" moneda={datos.moneda === 'USD' ? '$' : 'S/'} value={datos.monto} error={errores.monto} onChange={(e) => cambiar('monto', e.target.value)} />
        </GrupoCampos>
        {fallo && <Aviso tipo="error" compacto>{fallo}</Aviso>}
        <div className={s.pie}>
          <Boton type="submit" icono={<Link2 aria-hidden="true" />} cargando={enviando}>Generar enlace</Boton>
        </div>
      </form>

      {hecho && (
        <section className={s.tarjeta} aria-live="polite">
          <Aviso tipo="exito" titulo="Enlace listo">
            {`Envíaselo a tu cliente: ${hecho.concepto} · ${hecho.monto}. Vence el ${new Date(hecho.venceMs).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} (dura ${HORAS_ENLACE_PAGO} h).`}
          </Aviso>
          <div className={s.enlace}>
            <input className={s.enlaceTexto} readOnly value={hecho.url} aria-label="El enlace de pago" onFocus={(e) => e.target.select()} />
            <Boton variante="secundario" icono={<Copy aria-hidden="true" />} onClick={() => copiar(hecho.url, toast)}>Copiar</Boton>
            <Boton variante="contorno" icono={<ExternalLink aria-hidden="true" />} to={hecho.url}>Abrir</Boton>
          </div>
          {onVerHistorial && <Boton variante="fantasma" tamano="sm" onClick={onVerHistorial}>Ver en el historial</Boton>}
        </section>
      )}
    </div>
  );
}

/* ── Ajustes ───────────────────────────────────────────── */

/* WhatsApp pone en negrita lo que va entre asteriscos: la muestra también. */
const conNegritas = (texto) => String(texto).split(/\*([^*\n]+)\*/g).map((parte, i) => (i % 2 ? <b key={i}>{parte}</b> : parte));

const VACIA = { yapeNumero: '', yapeTitular: '', plinNumero: '', plinTitular: '', whatsapp: '', mensaje: '' };

function Ajustes({ config, cargando, onGuardar }) {
  const toast = useToast();
  const [datos, setDatos] = useState(config || VACIA);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState('');
  useEffect(() => { if (config) setDatos(config); }, [config]);
  const cambios = config && Object.keys(VACIA).some((k) => (datos[k] || '') !== (config[k] || ''));
  const cambiar = (k) => (e) => setDatos((d) => ({ ...d, [k]: e.target.value }));
  const muestra = String(datos.mensaje || '').replaceAll('{id}', 'WALA-01820').replaceAll('{monto}', '45.00');

  const guardar = async (ev) => {
    ev.preventDefault();
    setGuardando(true);
    setFallo('');
    try {
      await onGuardar?.(datos);
      toast({ tipo: 'exito', titulo: 'Métodos de pago guardados' });
    } catch (err) {
      setFallo(err?.message || 'No se guardó. Vuelve a intentar.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className={s.angosto}><EsqueletoFormulario campos={4} /></div>;

  return (
    <form className={s.angosto} onSubmit={guardar}>
      <div className={s.tarjeta}>
        <GrupoCampos titulo="Yape" columnas={2}>
          <Campo etiqueta="Número" inputMode="tel" placeholder="Ej. 987 654 321" value={datos.yapeNumero} onChange={cambiar('yapeNumero')} />
          <Campo etiqueta="Titular" ayuda="Recomendado: el cliente lo ve al pagar." placeholder="Ej. Juan Pérez" value={datos.yapeTitular} onChange={cambiar('yapeTitular')} />
        </GrupoCampos>
        <GrupoCampos titulo="Plin" ayuda="Déjalo vacío si no usas Plin." columnas={2}>
          <Campo etiqueta="Número" inputMode="tel" placeholder="Ej. 987 654 321" value={datos.plinNumero} onChange={cambiar('plinNumero')} />
          <Campo etiqueta="Titular" placeholder="Ej. Juan Pérez" value={datos.plinTitular} onChange={cambiar('plinTitular')} />
        </GrupoCampos>
        <GrupoCampos titulo="Comprobantes por WhatsApp" ayuda="A este número mandan su comprobante quienes pagan un saldo.">
          <Campo etiqueta="Número de WhatsApp" inputMode="tel" placeholder="Ej. +51 987 654 321" value={datos.whatsapp} onChange={cambiar('whatsapp')} />
          <Campo etiqueta="Mensaje que se abre" ayuda="{id} es el pedido y {monto}, el saldo." multilinea={3} value={datos.mensaje} onChange={cambiar('mensaje')} />
          {muestra && <p className={s.muestra}><span>Así le llega:</span> {conNegritas(muestra)}</p>}
        </GrupoCampos>
      </div>
      {fallo && <Aviso tipo="error" compacto>{fallo}</Aviso>}
      <div className={s.pie}>
        <Boton type="submit" cargando={guardando} disabled={!cambios}>Guardar métodos de pago</Boton>
        {!cambios && <span className={l.sub}>Sin cambios</span>}
      </div>
    </form>
  );
}

/* ── La página ─────────────────────────────────────────── */

/**
 * Gestión de pagos.
 *  - pestana · onPestana (si no, la lleva la página; empieza en el historial)
 *  - enlaces: [normalizarEnlace] · cargando · actualizando · error · onActualizar()
 *  - urlDe(id) → el enlace que se copia (…/pago-rapido/{id})
 *  - onGenerar(datos de enlaceNuevo) → promesa con el id nuevo
 *  - config (configPagosDesde) · cargandoConfig · onGuardarConfig(config) → promesa
 */
export function PaginaPagos({
  pestana: pestanaFuera, onPestana, enlaces = [], cargando = false, actualizando = false, error, onActualizar,
  urlDe = (id) => `/pago-rapido/${id}`, onGenerar, config, cargandoConfig = false, onGuardarConfig,
}) {
  const [pestanaDentro, setPestanaDentro] = useState('historial');
  const pestana = pestanaFuera || pestanaDentro;
  const ir = (p) => (onPestana ? onPestana(p) : setPestanaDentro(p));

  return (
    <div className={s.pagina} data-componente="PaginaPagos">
      <CabezaAdmin
        icono="pagos"
        tono="menta"
        titulo="Gestión de pagos"
        subtitulo="Los enlaces de pago, cuánto se cobra con ellos y los datos de Yape, Plin y WhatsApp."
        acciones={pestana === 'historial' && onActualizar ? <Boton tamano="sm" variante="secundario" icono={<RefreshCw aria-hidden="true" />} cargando={actualizando} onClick={onActualizar}>Actualizar</Boton> : undefined}
        principal={pestana === 'historial' ? { texto: 'Generar enlace', Icono: Link2, onClick: () => ir('generar') } : undefined}
      />
      <div className={s.pestanas}>
        <Pestanas
          etiqueta="Secciones de pagos"
          opciones={PESTANAS}
          valor={pestana}
          onChange={ir}
        />
      </div>
      {pestana === 'historial' && <Historial enlaces={enlaces} cargando={cargando} error={error} onActualizar={onActualizar} urlDe={urlDe} />}
      {pestana === 'generar' && <Generar onGenerar={onGenerar} urlDe={urlDe} onVerHistorial={() => ir('historial')} />}
      {pestana === 'ajustes' && <Ajustes config={config} cargando={cargandoConfig} onGuardar={onGuardarConfig} />}
    </div>
  );
}
