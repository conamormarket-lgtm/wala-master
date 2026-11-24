import React, { useMemo, useState } from 'react';
import { Aviso, EstadoVacio } from '../../Feedback';
import { Pestanas } from '../../Navegacion';
import { Hueso } from '../../Esqueletos';
import Boton from '../../Boton';
import { Cifra, FilaCifras, BloqueMetrica, ColumnasMetricas, SinDatos, ListaBarras } from '../../piezas/admin/Metricas';
import { GraficoTendencia } from '../../piezas/admin/Grafico';
import { ListaEnVivo, TarjetaEnlacesRotos } from '../../piezas/admin/Resultados';
import {
  traficoPorDia, seguimientoDePedidos, listasDePaginas, listasDeUso, listasDeNavegador, duracionCorta,
} from '../../adaptadoresAdmin';
import s from './Tecnico.module.css';

/*
 * D4d · Las pantallas técnicas de Resultados (van dentro de MarcoResultados,
 * sin pestañas): Páginas y tiempo, Uso y permanencia, Navegador y sistema
 * y el marco del Mapa de calor (el visor sigue siendo HeatmapViewer).
 */

const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const fechaDia = (k) => (k ? `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}` : '');
export const ORIGENES_TECNICOS = [{ id: 'todos', texto: 'Todos' }, { id: 'web', texto: 'Web' }, { id: 'app', texto: 'App' }];

/* Cargando, error o sin datos, igual en las tres pantallas. */
function Estado({ cargando, error, datos }) {
  if (error) return <Aviso tipo="error" titulo="No se pudieron cargar los datos">{error}</Aviso>;
  if (cargando && !datos) return <ColumnasMetricas><Hueso forma="bloque" alto={240} /><Hueso forma="bloque" alto={240} /></ColumnasMetricas>;
  if (!datos) return <EstadoVacio titulo="Sin datos todavía" texto="Cuando la tienda tenga visitas, aquí aparecen." />;
  return null;
}

/**
 * Páginas y tiempo: páginas vistas por día (todas, app o web), las rutas
 * más vistas, lo más buscado, los enlaces rotos y el seguimiento de pedidos.
 *  - datos (useGlobalAnalytics) · cargando · error · nombrePagina · rutaCorta
 *  - enlacesRotos: las props de TarjetaEnlacesRotos
 */
export function PaginaPaginasTecnica({ datos, cargando = false, error, nombrePagina, rutaCorta, enlacesRotos }) {
  const [modo, setModo] = useState('total');
  const serie = useMemo(() => traficoPorDia(datos?.eventsForCharts), [datos?.eventsForCharts]);
  const listas = useMemo(() => listasDePaginas(datos, { nombrePagina, rutaCorta }), [datos, nombrePagina, rutaCorta]);
  const pedidos = useMemo(() => seguimientoDePedidos(datos), [datos]);
  const estado = Estado({ cargando, error, datos });
  if (estado) return estado;

  const hayApp = serie.some((d) => d.valores.app > 0) || Number(datos.totalEvents?.app) > 0;
  const vistas = serie.reduce((a, d) => a + d.valores[modo], 0);
  const lider = listas.rutas[0];
  const modos = [{ id: 'total', texto: 'Todas' }, ...(hayApp ? [{ id: 'app', texto: 'App' }] : []), { id: 'web', texto: 'Web' }];

  return (
    <div className={s.pagina} data-componente="PaginaPaginasTecnica">
      <FilaCifras etiqueta="Páginas">
        <Cifra nombre={modo === 'total' ? 'Páginas vistas' : `Páginas vistas · ${modo === 'app' ? 'App' : 'Web'}`} valor={entero(vistas)} tono="violeta" />
        <Cifra nombre="Días con tráfico" valor={entero(serie.filter((d) => d.valores[modo] > 0).length)} tono="cielo" />
        <Cifra nombre="Ruta líder" valor={lider ? entero(lider.valor) : '—'} ayuda={lider?.nombre} tono="exito" />
        <Cifra nombre="Búsquedas" valor={entero(listas.totalBusquedas)} tono="aviso" />
      </FilaCifras>
      <BloqueMetrica titulo="Tráfico por día" acciones={<Pestanas etiqueta="Qué páginas vistas" opciones={modos} valor={modo} onChange={setModo} />}>
        <GraficoTendencia
          datos={serie.map((d) => ({ etiqueta: d.etiqueta, valores: { vistas: d.valores[modo] } }))}
          series={[{ id: 'vistas', nombre: 'Páginas vistas', tono: modo === 'app' ? 'menta' : 'violeta' }]}
          formato={entero}
          vacio="Sin tráfico en el rango elegido."
        />
      </BloqueMetrica>
      <ColumnasMetricas>
        <BloqueMetrica titulo="Páginas más vistas" ayuda="Landings y rutas por páginas vistas.">
          <ListaBarras filas={listas.rutas} vacio="Sin rutas registradas aún." />
        </BloqueMetrica>
        <BloqueMetrica titulo="Búsquedas" ayuda="Lo que más buscan tus visitantes." acciones={listas.totalBusquedas ? <span className={s.total}>{entero(listas.totalBusquedas)} en total</span> : null}>
          <ListaBarras filas={listas.busquedas} max={15} tono="menta" vacio="Sin búsquedas registradas aún." />
        </BloqueMetrica>
      </ColumnasMetricas>
      {enlacesRotos && <TarjetaEnlacesRotos {...enlacesRotos} />}
      <BloqueMetrica
        titulo="Seguimiento de pedidos"
        ayuda="Cuánto entran tus clientes a ver el estado de su pedido."
        acciones={pedidos.totalDwellMs ? <span className={s.total}>{duracionCorta(pedidos.totalDwellMs)} en total</span> : null}
      >
        {!pedidos.views && !pedidos.uniqueUsers ? <SinDatos>Aún nadie entró a ver el estado de su pedido.</SinDatos> : (
          <FilaCifras etiqueta="Seguimiento de pedidos">
            <Cifra nombre="Visitas al estado" valor={entero(pedidos.views)} tono="violeta" />
            <Cifra nombre="Personas distintas" valor={entero(pedidos.uniqueUsers)} tono="cielo" />
            <Cifra nombre="Tiempo promedio" valor={duracionCorta(pedidos.avgDwellMs)} tono="exito" />
          </FilaCifras>
        )}
      </BloqueMetrica>
    </div>
  );
}

/**
 * Uso y permanencia: las cifras por origen, quién vio más páginas, qué
 * áreas y funciones se usan, las rutas más vistas y con más tiempo, y lo más buscado.
 *  - datos (useDashboardAnalytics) · origen ('todos' | 'app' | 'web') · comparar · cargando · error
 *  - areas (deriveAppUsage con las vistas por origen) · nombrePagina · rutaCorta
 */
export function PaginaUsoTecnica({ datos, origen = 'todos', comparar = false, cargando = false, error, areas = [], nombrePagina, rutaCorta }) {
  const u = useMemo(() => listasDeUso({ datos, origen, areas, nombrePagina, rutaCorta }), [datos, origen, areas, nombrePagina, rutaCorta]);
  const estado = Estado({ cargando, error, datos });
  if (estado) return estado;
  const cov = datos.extendedCoverage || {};
  const diasSinTop = Math.max(0, (Number(cov.closedDocs) || 0) - (Number(cov.docsWithTopIdentities) || 0));
  const notas = [
    'Una identidad no es una persona exacta: la misma persona puede aparecer con cuenta y sin cuenta, o desde varios aparatos.',
    diasSinTop > 0 && `El rango incluye ${diasSinTop} ${diasSinTop === 1 ? 'día' : 'días'} sin este desglose${cov.firstTopIdentitiesDay ? ` (no hay datos antes del ${fechaDia(cov.firstTopIdentitiesDay)})` : ''}: los totales pueden estar incompletos.`,
    origen !== 'todos' && 'Este desglose no distingue app y web: es el total del rango.',
    comparar && 'La comparación con el periodo anterior no aplica a este desglose.',
  ].filter(Boolean);

  return (
    <div className={s.pagina} data-componente="PaginaUsoTecnica">
      {origen !== 'todos' && (
        <Aviso tipo="info" compacto>
          Solo {origen === 'app' ? 'la app' : 'la web'}: las cifras, las áreas y las rutas muestran ese corte cuando el dato lo trae{u.sinDesglose ? ' (parte de este rango no lo trae y va el total)' : ''}. Quién vio más, las funciones y las búsquedas son siempre el total.
        </Aviso>
      )}
      <FilaCifras etiqueta="Uso">
        {u.cifras.map((c, i) => <Cifra key={c.id} nombre={c.nombre} valor={c.valor} tono={['violeta', 'cielo', 'exito', 'aviso'][i]} />)}
      </FilaCifras>
      <BloqueMetrica titulo="Quién vio más páginas" ayuda="Las identidades con más páginas vistas en el rango.">
        <ListaBarras filas={u.visitantes} vacio={diasSinTop > 0 ? 'Sin datos de este desglose en el rango (días anteriores a medir las identidades).' : 'Aún sin visitas registradas en este rango.'} />
        {u.visitantes.length > 0 && notas.map((n) => <p key={n} className={s.nota}>{n}</p>)}
      </BloqueMetrica>
      <ColumnasMetricas>
        <BloqueMetrica titulo="Áreas más usadas" ayuda="Cómo se reparte el tráfico por zona de la tienda.">
          <ListaBarras filas={u.areas} vacio="Aún no hay tráfico suficiente para repartir por áreas." />
        </BloqueMetrica>
        <BloqueMetrica titulo="Uso de funciones" ayuda="Cuánto se usan las funciones clave.">
          <ListaBarras filas={u.funciones} max={8} tono="menta" vacio="Aún sin uso registrado de estas funciones." />
        </BloqueMetrica>
      </ColumnasMetricas>
      <ColumnasMetricas>
        <BloqueMetrica titulo="Rutas más visitadas" ayuda="Por número de páginas vistas.">
          <ListaBarras filas={u.rutasVistas} vacio="Sin rutas registradas aún." />
        </BloqueMetrica>
        <BloqueMetrica titulo="Mayor permanencia" ayuda="Las rutas donde más tiempo se pasa.">
          <ListaBarras filas={u.rutasTiempo} tono="menta" vacio="Sin tiempos de permanencia aún." />
        </BloqueMetrica>
      </ColumnasMetricas>
      <BloqueMetrica titulo="Búsquedas más frecuentes" ayuda="Lo que tus visitantes intentan encontrar.">
        <ListaBarras filas={u.busquedas} max={15} vacio="Sin búsquedas registradas aún." />
      </BloqueMetrica>
    </div>
  );
}

/**
 * Navegador y sistema: en vivo, aparatos, navegadores, sistemas, país
 * (confiable y aproximado), app o web con su cambio, fuentes, campañas,
 * regiones, quién está ahora y lo más buscado.
 *  - datos · anterior · comparar · cargando · error · nombrePagina (para "Ahora en la tienda")
 *  - periodoAnterior (texto: "los 30 días de antes")
 */
export function PaginaNavegadorTecnica({ datos, anterior, comparar = false, cargando = false, error, nombrePagina = (p) => p, periodoAnterior }) {
  const n = useMemo(() => listasDeNavegador({ datos, anterior, comparar }), [datos, anterior, comparar]);
  const enVivo = useMemo(() => (datos?.realtimeSessionsDetails || []).map((p) => ({
    id: p.id, quien: p.displayName || p.email, conCuenta: p.hasAccount, pagina: nombrePagina(p.lastPath), vistoMs: p.lastSeenAtMs,
  })), [datos?.realtimeSessionsDetails, nombrePagina]);
  const estado = Estado({ cargando, error, datos });
  if (estado) return estado;
  const busquedas = (datos.topSearches || []).slice(0, 12).map((x) => ({ id: x.query, nombre: x.query, valor: x.total, texto: entero(x.total) }));
  const cambio = n.cambioTipo;

  return (
    <div className={s.pagina} data-componente="PaginaNavegadorTecnica">
      <FilaCifras etiqueta="Navegador y sistema">
        {n.cifras.map((c, i) => <Cifra key={c.id} nombre={c.nombre} valor={c.valor} tono={['exito', 'violeta', 'cielo', 'aviso'][i]} />)}
      </FilaCifras>
      <div className={s.tres}>
        <BloqueMetrica titulo="Aparatos" ayuda="Computadora, celular y tablet."><ListaBarras filas={n.dispositivos} vacio="Sin datos de aparatos aún." /></BloqueMetrica>
        <BloqueMetrica titulo="Navegador" ayuda="Los navegadores más usados."><ListaBarras filas={n.navegadores} vacio="Sin datos de navegador aún." /></BloqueMetrica>
        <BloqueMetrica titulo="Sistema" ayuda="Desde qué sistema navegan."><ListaBarras filas={n.sistemas} vacio="Sin datos de sistema aún." /></BloqueMetrica>
      </div>
      <ColumnasMetricas>
        <BloqueMetrica titulo="País" ayuda="Por la conexión de cada visita (confiable).">
          <ListaBarras filas={n.paises} max={8} vacio="Sin datos de país antes de medirlo." />
          {n.diasSinPais > 0 && <p className={s.nota}>{n.primerDiaPais ? `No hay país antes del ${fechaDia(n.primerDiaPais)}: ` : ''}{n.diasSinPais} {n.diasSinPais === 1 ? 'día' : 'días'} del rango no lo incluyen.</p>}
          <h3 className={s.subtitulo}>Aproximado por la hora del aparato</h3>
          <ListaBarras filas={n.paisesAprox} max={8} tono="menta" vacio="Sin visitas antiguas que aproximar en este rango." />
          <p className={s.nota}>Aparte, para las visitas antiguas sin país: se deduce de la zona horaria del navegador (menos fiable, no se mezcla con lo de arriba).</p>
        </BloqueMetrica>
        <BloqueMetrica titulo="App o web" ayuda="Si entran desde la app instalada o desde el navegador.">
          <ListaBarras filas={n.tipos} vacio="Sin datos de sesiones en este rango." />
          {cambio && (cambio.sinDatos
            ? <p className={s.nota}>El periodo anterior ({periodoAnterior}) no tiene datos para comparar.</p>
            : <p className={s.nota}>Contra el periodo anterior{periodoAnterior ? ` (${periodoAnterior})` : ''}: App <b className={cambio.app?.bueno === false ? s.baja : s.sube}>{cambio.app?.texto || 'sin dato'}</b> · Web <b className={cambio.web?.bueno === false ? s.baja : s.sube}>{cambio.web?.texto || 'sin dato'}</b></p>)}
        </BloqueMetrica>
      </ColumnasMetricas>
      <div className={s.tres}>
        <BloqueMetrica titulo="De dónde llegan">
          <h3 className={s.subtitulo}>Fuentes</h3>
          <ListaBarras filas={n.fuentes} vacio="Solo tráfico directo." />
          <h3 className={s.subtitulo}>Campañas</h3>
          <ListaBarras filas={n.campanas} tono="menta" vacio="Sin campañas con utm registradas." />
          <h3 className={s.subtitulo}>Regiones</h3>
          <ListaBarras filas={n.regiones} vacio="Sin datos de regiones aún." />
        </BloqueMetrica>
        <BloqueMetrica titulo={<>Ahora en la tienda <span className={s.contador}>{entero(enVivo.length)}</span></>}>
          <ListaEnVivo personas={enVivo} max={12} />
        </BloqueMetrica>
        <BloqueMetrica titulo="Búsquedas"><ListaBarras filas={busquedas} max={12} vacio="Sin búsquedas registradas aún." /></BloqueMetrica>
      </div>
    </div>
  );
}

/**
 * El Mapa de calor: los filtros (origen, diseño, aparato), lo que se está
 * mostrando y sus avisos; el visor (HeatmapViewer: la página real en un
 * iframe y el calor encima) va de children.
 *  - origen · onOrigen · diseno ('todos' | 'actual') · onDiseno · ancho · onAncho
 *  - anchos: [{ id, texto }] (ANCHOS_PANTALLA; sin "Computadora" con la app)
 *  - clics · lotes · rango (texto) · truncado · maxDocs
 *  - sinOrigen: clics antiguos sin web/app · incluirSinOrigen · onIncluirSinOrigen
 */
export function PaginaMapaDeCalor({
  origen = 'todos', onOrigen, diseno = 'todos', onDiseno, ancho = 'todos', onAncho, anchos = [],
  clics = 0, lotes = 0, rango = '', truncado = false, maxDocs = 0, sinOrigen = 0, incluirSinOrigen = true, onIncluirSinOrigen, children,
}) {
  return (
    <div className={s.pagina} data-componente="PaginaMapaDeCalor">
      <div className={s.filtros}>
        <div className={s.filtro}><span>Origen</span><Pestanas etiqueta="Origen" opciones={ORIGENES_TECNICOS} valor={origen} onChange={onOrigen} /></div>
        <div className={s.filtro}><span>Diseño de la página</span><Pestanas etiqueta="Diseño de la página" opciones={[{ id: 'todos', texto: 'Todos' }, { id: 'actual', texto: 'Solo el actual' }]} valor={diseno} onChange={onDiseno} /></div>
        <div className={s.filtro}><span>{origen === 'app' ? 'Aparato (celular o tablet)' : 'Aparato'}</span><Pestanas etiqueta="Aparato" opciones={anchos} valor={ancho} onChange={onAncho} /></div>
      </div>
      <Aviso tipo="info" compacto>
        {entero(clics)} clics de {entero(lotes)} lotes ({rango}). Elige una página para ver dónde concentran la atención; los filtros se aplican al instante, sin lecturas nuevas.
      </Aviso>
      {truncado && <Aviso tipo="aviso" compacto>Este rango tiene demasiados lotes de clics: se muestran los {entero(maxDocs)} más recientes para que las lecturas sigan baratas. Acorta el rango para verlo completo.</Aviso>}
      {origen !== 'todos' && sinOrigen > 0 && (
        <Aviso tipo="aviso" compacto accion={<Boton tamano="sm" variante="contorno" onClick={() => onIncluirSinOrigen?.(!incluirSinOrigen)}>{incluirSinOrigen ? 'Dejarlos fuera' : 'Incluirlos'}</Boton>}>
          {entero(sinOrigen)} clics antiguos no guardaron si venían de la web o de la app {incluirSinOrigen ? 'y se están incluyendo igual.' : 'y quedaron fuera de este filtro.'}
        </Aviso>
      )}
      <div className={s.visor}>{children}</div>
    </div>
  );
}
