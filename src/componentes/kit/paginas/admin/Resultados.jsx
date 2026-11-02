import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, EstadoVacio } from '../../Feedback';
import { Buscador, Interruptor } from '../../Formulario';
import { Pestanas } from '../../Navegacion';
import { Hueso } from '../../Esqueletos';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin } from '../../piezas/admin/Datos';
import { HojaEdicion } from '../../piezas/admin/Formularios';
import { FichaCliente, ListaCumpleanos } from '../../piezas/admin/Clientes';
import { Cifra, FilaCifras, BloqueMetrica, ColumnasMetricas, SinDatos, SelectorPeriodo, ListaBarras } from '../../piezas/admin/Metricas';
import { GraficoTendencia } from '../../piezas/admin/Grafico';
import { ListaAvisos, TablaComparativa, ListaEnVivo, TarjetaEnlacesRotos, ListaInteresados } from '../../piezas/admin/Resultados';
import {
  cifrasDelResumen, otrosCobrosDe, serieDeVisitas, porCienVisitas, PERIODOS_RESULTADOS, listasDeProductos, listasDeVisitantes, duracionCorta,
  quienDelCarrito, cumpleanosDe,
} from '../../adaptadoresAdmin';
import { urlWhatsApp, telefonoDePerfil, aceptoWhatsApp, mensajeProductoVisto, mensajeCarrito } from '../../../../utils/whatsappLink';
import l from './Lista.module.css';
import s from './Resultados.module.css';

/*
 * D4 · Resultados (/admin/resultados): cómo va la tienda. D4a: el marco
 * (periodo, comparar, actualizar y las pestañas) y el Resumen. Los datos
 * llegan como los arma useDashboardAnalytics; el kit no los lee.
 */

const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const hora = (ms) => (ms ? new Date(ms).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '');
const mayuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');

/**
 * El marco de las pestañas de Resultados.
 *  - periodo: { id (PERIODOS_RESULTADOS), etiqueta ('30 días', 'hoy'), contra ('el periodo anterior', 'ayer') }
 *  - onPeriodo(id) · desde · hasta · onFechas(desde, hasta) · hoy ('AAAA-MM-DD', el tope)
 *  - comparar · onComparar(si) · datosAl (ms) · actualizando · onActualizar()
 *  - pestanas: [{ id, texto }] (ya filtradas por permiso) · pestana · onPestana(id) · children
 */
export function MarcoResultados({
  periodo = {}, onPeriodo, desde, hasta, onFechas, hoy, comparar = false, onComparar, datosAl, actualizando = false, onActualizar,
  pestanas = [], pestana, onPestana, children,
}) {
  const subtitulo = ['Cómo va tu tienda', `${periodo.etiqueta || ''}${comparar ? ` comparado con ${periodo.contra}` : ''}`, datosAl && `datos al ${hora(datosAl)}`].filter(Boolean).join(' · ');
  return (
    <div className={s.pagina} data-componente="MarcoResultados">
      <CabezaAdmin
        icono="resultados"
        tono="oro"
        titulo="Resultados"
        subtitulo={subtitulo}
        acciones={onActualizar && <Boton tamano="sm" variante="secundario" icono={<RefreshCw aria-hidden="true" />} cargando={actualizando} onClick={onActualizar}>Actualizar</Boton>}
      />
      <div className={s.controles}>
        <SelectorPeriodo
          opciones={PERIODOS_RESULTADOS}
          valor={periodo.id}
          onCambiar={onPeriodo}
          desde={desde}
          hasta={hasta}
          onFechas={onFechas}
          max={hoy}
          comparar={comparar}
          onComparar={onComparar}
          textoComparar={`Comparar con ${periodo.contra || 'el periodo anterior'}`}
        />
      </div>
      {pestanas.length > 1 && (
        <div className={s.pestanas}>
          <Pestanas etiqueta="Secciones de Resultados" opciones={pestanas} valor={pestana} onChange={onPestana} />
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * El Resumen: cuatro cifras con su cambio, lo que conviene mejorar, las
 * visitas por día, de dónde vienen y quién está ahora.
 *  - datos · anterior (useDashboardAnalytics) · comparar · periodo: { dia ('hoy' | 'ayer' | null), contra, anteriorTexto }
 *  - cargando · error · avisos: [{ id, nivel, titulo, texto, to }] (cosasPorMejorar con su destino)
 *  - nombrePagina(path) → 'Tienda' (prettyRouteName) · verCanales (to: la pestaña Visitantes)
 *  - enlacesRotos: las props de TarjetaEnlacesRotos (sale solo si hay sin resolver)
 *  - ahora (para el aviso de "hoy va hasta las…")
 */
export function PaginaResumenResultados({
  datos, anterior, comparar = false, periodo = {}, cargando = false, error, avisos = [], nombrePagina = (p) => p,
  verCanales, enlacesRotos, ahora = Date.now(),
}) {
  const [canal, setCanal] = useState('');
  const canales = datos?.canales || [];
  const elegido = canal ? canales.find((c) => c.canal === canal) : null;
  const { cifras, comparativa, hayAnterior } = useMemo(() => cifrasDelResumen({ datos, anterior, comparar, canal: elegido }), [datos, anterior, comparar, elegido]);
  const otros = useMemo(() => otrosCobrosDe(datos?.otrosCobros), [datos?.otrosCobros]);
  const serie = useMemo(() => serieDeVisitas(datos?.visitasPorDia), [datos?.visitasPorDia]);
  const enVivo = useMemo(() => (datos?.realtimeSessionsDetails || []).map((p) => ({
    id: p.id, quien: p.displayName || p.email, conCuenta: p.hasAccount, pagina: nombrePagina(p.lastPath), vistoMs: p.lastSeenAtMs,
  })), [datos?.realtimeSessionsDetails, nombrePagina]);
  const rotosSinResolver = (enlacesRotos?.enlaces || []).filter((e) => !e.resueltaA).length;

  if (error) return <Aviso tipo="error" titulo="No se pudieron cargar los resultados">{error}</Aviso>;
  if (cargando && !datos) {
    return (
      <div className={s.resumen} aria-busy="true">
        <FilaCifras>{cifras.map((c) => <Cifra key={c.id} nombre={c.nombre} cargando />)}</FilaCifras>
        <ColumnasMetricas><Hueso forma="bloque" alto={220} /><Hueso forma="bloque" alto={220} /></ColumnasMetricas>
      </div>
    );
  }
  if (!datos) return <EstadoVacio titulo="Sin resultados todavía" texto="Cuando la tienda tenga visitas, aquí aparecen sus números." />;

  return (
    <div className={s.resumen} data-componente="PaginaResumenResultados">
      <FilaCifras etiqueta="Cómo va la tienda">
        {cifras.map((c) => <Cifra key={c.id} nombre={c.nombre} valor={c.valor} cambio={c.cambio} explicacion={c.explicacion} tono={{ visitas: 'violeta', pedidos: 'exito', ventas: 'aviso', conversion: 'cielo' }[c.id]} />)}
      </FilaCifras>

      {elegido && (
        <Aviso tipo="info" compacto accion={<Boton tamano="sm" variante="fantasma" onClick={() => setCanal('')}>Ver todas</Boton>}>
          Mostrando solo las visitas de {elegido.canal}.
        </Aviso>
      )}
      {otros && <p className={s.nota}><strong>Otros cobros: {otros.montos}</strong> ({otros.detalle}). No son pedidos de la tienda, por eso van aparte.</p>}
      {!datos.diasConResultados && (
        <Aviso tipo="aviso" compacto>Los pedidos y las ventas de este periodo todavía no están sumados. Se cuentan desde el 24/10/2026; para los días anteriores, usa «Reconstruir el resumen diario» en Detalle técnico.</Aviso>
      )}
      {comparar && !hayAnterior && <Aviso tipo="info" compacto>{mayuscula(periodo.contra)} todavía no tiene pedidos ni ventas sumados: no se puede comparar.</Aviso>}

      {comparativa.length > 0 && (
        <BloqueMetrica
          titulo={periodo.dia ? `${mayuscula(periodo.dia)} contra ${periodo.contra}` : 'Este periodo contra el anterior'}
          ayuda={periodo.dia === 'hoy' ? `Hoy va hasta las ${hora(ahora)}; ayer es el día completo. Es normal que hoy vaya por debajo hasta que acabe el día.` : periodo.anteriorTexto && `Periodo anterior: ${periodo.anteriorTexto}.`}
        >
          <TablaComparativa filas={comparativa} columnas={periodo.dia ? [mayuscula(periodo.dia), mayuscula(periodo.contra)] : undefined} />
        </BloqueMetrica>
      )}

      <ColumnasMetricas>
        <BloqueMetrica titulo="Cosas por mejorar"><ListaAvisos avisos={avisos} /></BloqueMetrica>
        <GraficoTendencia titulo="Visitas por día" datos={serie} series={[{ id: 'visitas', nombre: 'Visitas', tono: 'violeta' }]} formato={entero} vacio="Sin visitas en este periodo." />
      </ColumnasMetricas>

      <ColumnasMetricas>
        <BloqueMetrica
          titulo="De dónde vienen"
          ayuda="Los 3 canales con más visitas. Toca uno para ver los números solo de ahí."
          acciones={verCanales && <Boton tamano="sm" variante="fantasma" to={verCanales}>Ver todos</Boton>}
        >
          {!canales.length ? <SinDatos>Sin datos de origen en este periodo.</SinDatos> : (
            <ul className={s.canales}>
              {canales.slice(0, 3).map((c) => {
                const activo = canal === c.canal;
                return (
                  <li key={c.canal}>
                    <button type="button" className={activo ? s.canalActivo : s.canal} aria-pressed={activo} onClick={() => setCanal(activo ? '' : c.canal)}>
                      <span className={s.canalNombre}>{c.canal}</span>
                      <span><b>{entero(c.visitas)}</b> visitas</span>
                      <span><b>{entero(c.pedidos)}</b> pedidos</span>
                      <span><b>{porCienVisitas(c.pedidos, c.visitas).toLocaleString('es-PE', { maximumFractionDigits: 1 })}</b> de cada 100</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </BloqueMetrica>
        <BloqueMetrica titulo={<>Ahora en la tienda <span className={s.contador}>{entero(enVivo.length)}</span></>}>
          <ListaEnVivo personas={enVivo} />
        </BloqueMetrica>
      </ColumnasMetricas>

      {rotosSinResolver > 0 && <div id="enlaces"><TarjetaEnlacesRotos {...enlacesRotos} /></div>}
    </div>
  );
}

/* ── D4b · Productos y Visitantes ─────────────────────── */

/* Lo que se muestra mientras carga o si no se pudo, igual en las pestañas. */
function EstadoDePestana({ cargando, error, datos }) {
  if (error) return <Aviso tipo="error" titulo="No se pudieron cargar los datos">{error}</Aviso>;
  if (cargando && !datos) {
    return <ColumnasMetricas><Hueso forma="bloque" alto={260} /><Hueso forma="bloque" alto={260} /></ColumnasMetricas>;
  }
  if (!datos) return <EstadoVacio titulo="Sin resultados todavía" texto="Cuando la tienda tenga visitas, aquí aparecen sus números." />;
  return null;
}

const MAX_INTERESADOS = 20;

/**
 * Productos: qué se mira y qué se vende, quién se queda mirando (con su
 * WhatsApp si lo aceptó), líneas, colecciones, búsquedas, deseos y Crear.
 *  - datos (useDashboardAnalytics) · cargando · error
 *  - productoDe(id, nombre) → { nombre, imagen, producto } (del catálogo, con los ocultos; producto es el crudo, para el mensaje)
 *  - nombreCategoria(id) → nombre · perfiles: Map uid → perfil (getPerfilesPorUid) · cargandoPerfiles
 */
export function PaginaProductosResultados({ datos, cargando = false, error, productoDe, nombreCategoria, perfiles, cargandoPerfiles = false }) {
  const [medida, setMedida] = useState('ingresos');
  const [soloConPermiso, setSoloConPermiso] = useState(false);
  const listas = useMemo(() => listasDeProductos({ datos, productoDe, nombreCategoria, medida }), [datos, productoDe, nombreCategoria, medida]);
  const interesados = useMemo(() => (datos?.interes?.pares || []).slice(0, 60)
    .map((par) => ({ ...par, perfil: perfiles?.get?.(par.uid) || null }))
    .filter((par) => !soloConPermiso || aceptoWhatsApp(par.perfil))
    .slice(0, MAX_INTERESADOS)
    .map((par) => {
      const crudo = productoDe?.(par.productId)?.producto;
      const nombre = par.perfil?.displayName || par.nombre || 'Cliente';
      const telefono = telefonoDePerfil(par.perfil);
      const permiso = aceptoWhatsApp(par.perfil);
      return {
        id: `${par.uid}|${par.productId}`,
        nombre,
        producto: crudo?.name || productoDe?.(par.productId)?.nombre || 'Producto',
        tiempo: duracionCorta(par.dwellMs),
        vistoMs: par.ultimaMs,
        whatsapp: crudo && telefono && permiso ? urlWhatsApp(telefono, mensajeProductoVisto(nombre, crudo)) : null,
        motivo: cargandoPerfiles ? 'Cargando…' : !telefono ? 'Sin teléfono' : !permiso ? 'No aceptó WhatsApp' : '—',
      };
    }), [datos?.interes?.pares, perfiles, soloConPermiso, productoDe, cargandoPerfiles]);

  const estado = EstadoDePestana({ cargando, error, datos });
  if (estado) return estado;
  const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));

  return (
    <div className={s.resumen} data-componente="PaginaProductosResultados">
      {!datos.diasConResultados && (
        <Aviso tipo="aviso" compacto>Ventas, interés, deseos y Crear se suman desde el 24/10/2026. Para los días anteriores, usa «Reconstruir el resumen diario» en Detalle técnico.</Aviso>
      )}
      <ColumnasMetricas>
        <BloqueMetrica titulo="Más vistos" ayuda="Veces que abrieron la ficha del producto.">
          <ListaBarras filas={listas.vistos} vacio="Nadie abrió fichas de producto en este periodo." />
        </BloqueMetrica>
        <BloqueMetrica
          titulo="Más vendidos"
          ayuda="De los pedidos enviados desde la tienda y la app."
          acciones={<Pestanas etiqueta="Ordenar las ventas por" opciones={[{ id: 'ingresos', texto: 'Soles' }, { id: 'unidades', texto: 'Unidades' }]} valor={medida} onChange={setMedida} />}
        >
          <ListaBarras filas={listas.vendidos} tono="menta" vacio="Sin pedidos en este periodo." />
        </BloqueMetrica>
      </ColumnasMetricas>

      <BloqueMetrica titulo="Los que más miran" ayuda="Tiempo en la ficha de cada producto y quién se quedó mirando al menos 30 segundos. Escríbeles mientras lo tienen en mente.">
        <ColumnasMetricas>
          <ListaBarras filas={listas.masMirados} vacio="Sin tiempo registrado en fichas de producto." />
          <div className={s.interesados}>
            <Interruptor etiqueta="Solo quienes aceptaron WhatsApp" activo={soloConPermiso} onChange={setSoloConPermiso} />
            <ListaInteresados personas={interesados} vacio={soloConPermiso ? 'Nadie de este periodo aceptó recibir mensajes por WhatsApp.' : 'Nadie con cuenta se quedó mirando un producto.'} />
          </div>
        </ColumnasMetricas>
      </BloqueMetrica>

      <ColumnasMetricas>
        <BloqueMetrica titulo="Líneas más vistas"><ListaBarras filas={listas.lineasVistas} vacio="Los productos vistos no tienen línea asignada." /></BloqueMetrica>
        <BloqueMetrica titulo="Líneas más vendidas"><ListaBarras filas={listas.lineasVendidas} tono="menta" vacio="Sin pedidos en este periodo." /></BloqueMetrica>
      </ColumnasMetricas>
      <ColumnasMetricas>
        <BloqueMetrica titulo="Colecciones más vistas" ayuda="Cuando filtran la tienda por una colección o temporada."><ListaBarras filas={listas.colecciones} vacio="Nadie filtró por colección en este periodo." /></BloqueMetrica>
        <BloqueMetrica titulo="Lo más buscado" ayuda="Si algo se busca mucho y no lo tienes, es una idea de producto."><ListaBarras filas={listas.busquedas} vacio="Sin búsquedas en este periodo." /></BloqueMetrica>
      </ColumnasMetricas>
      <ColumnasMetricas>
        <BloqueMetrica titulo="Lista de deseos">
          <FilaCifras etiqueta="Lista de deseos">
            <Cifra nombre="Agregados" valor={entero(datos.deseos?.agregados?.total)} tono="violeta" />
            <Cifra nombre="Quitados" valor={entero(datos.deseos?.quitados?.total)} tono="neutro" />
          </FilaCifras>
          <ListaBarras filas={listas.deseos} vacio="Nadie agregó productos a su lista en este periodo." />
        </BloqueMetrica>
        <BloqueMetrica titulo="Crear" ayuda="El estudio donde diseñan su prenda.">
          <FilaCifras etiqueta="Crear">
            <Cifra nombre="Abrieron Crear" valor={entero(datos.crear?.aperturas?.total)} tono="violeta" />
            <Cifra nombre="Abrieron un combo" valor={entero(datos.crear?.aperturasCombo?.total)} tono="cielo" />
            <Cifra nombre="Creaciones guardadas" valor={entero(datos.crear?.guardados?.total)} tono="exito" />
          </FilaCifras>
        </BloqueMetrica>
      </ColumnasMetricas>
    </div>
  );
}

/**
 * Visitantes: quién viene y de dónde, canal por canal, país y con qué entran.
 *  - datos (useDashboardAnalytics) · cargando · error
 */
export function PaginaVisitantesResultados({ datos, cargando = false, error }) {
  const v = useMemo(() => listasDeVisitantes(datos), [datos]);
  const estado = EstadoDePestana({ cargando, error, datos });
  if (estado) return estado;
  return (
    <div className={s.resumen} data-componente="PaginaVisitantesResultados">
      <FilaCifras etiqueta="Visitantes">
        {v.cifras.map((c, i) => <Cifra key={c.id} nombre={c.nombre} valor={c.valor} ayuda={c.ayuda} tono={['violeta', 'cielo', 'exito', 'neutro', 'aviso'][i]} />)}
      </FilaCifras>
      <BloqueMetrica
        titulo="Canal por canal"
        ayuda="«Directo o sin dato»: escribieron la dirección, usaron un favorito o vinieron de una app que no dice de dónde (Instagram y WhatsApp suelen ocultarlo). Comparte tus enlaces con ?utm_source=instagram para saberlo."
      >
        <TablaAdmin
          etiqueta="Canales"
          filas={v.canales}
          nombreDe={(c) => c.canal}
          vacio={{ titulo: 'Sin datos de origen', texto: 'No hay visitas con su canal en este periodo.' }}
          columnas={[
            { id: 'canal', titulo: 'Canal', tarjeta: 'titulo', celda: (c) => c.canal },
            { id: 'visitas', titulo: 'Visitas', alinear: 'fin', tarjeta: 'detalle', celda: (c) => <span className={l.numero}>{c.visitas} <span className={l.sub}>{c.parte}</span></span> },
            { id: 'interaccion', titulo: 'Hicieron algo', alinear: 'fin', tarjeta: 'detalle', celda: (c) => c.interaccion },
            { id: 'pedidos', titulo: 'Pedidos', alinear: 'fin', tarjeta: 'detalle', celda: (c) => c.pedidos },
            { id: 'conversion', titulo: 'De cada 100 compran', alinear: 'fin', tarjeta: 'detalle', celda: (c) => c.conversion },
          ]}
        />
      </BloqueMetrica>
      <ColumnasMetricas>
        <BloqueMetrica titulo="País" ayuda={v.paisAproximado ? 'Aproximado por la hora del dispositivo (días anteriores a medir el país).' : undefined}>
          <ListaBarras filas={v.paises} vacio="Sin datos de país en este periodo." />
        </BloqueMetrica>
        <BloqueMetrica titulo="Con qué entran">
          <ListaBarras filas={v.dispositivos} vacio="Sin datos de dispositivo en este periodo." />
          <ListaBarras filas={v.clientes} tono="menta" vacio="Sin datos de app o web en este periodo." />
        </BloqueMetrica>
      </ColumnasMetricas>
    </div>
  );
}

/* ── D4c · Clientes y Opiniones ───────────────────────── */

const solesCentimos = (c) => `S/ ${((Number(c) || 0) / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaHoraCorta = (ms) => (ms ? new Date(ms).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

/* Escribirle a quien dejó su carrito: solo con su número y si aceptó WhatsApp; si no, por qué. */
function contactoDelCarrito(c, perfil, cargando) {
  if (!c.uid) return { motivo: 'Sin cuenta' };
  if (cargando) return { motivo: 'Cargando…' };
  const telefono = telefonoDePerfil(perfil);
  if (!telefono) return { motivo: 'Sin teléfono' };
  if (!aceptoWhatsApp(perfil)) return { motivo: 'No aceptó WhatsApp' };
  return { whatsapp: urlWhatsApp(telefono, mensajeCarrito(perfil?.displayName || c.displayName)) };
}

/**
 * Clientes: carritos abandonados con WhatsApp a quien lo aceptó, la lista
 * de clientes (buscar entre todos y abrir su ficha al costado) y los próximos cumpleaños.
 *  - datos (useDashboardAnalytics: abandonedCarts, carritosAbandonados, personas)
 *  - perfiles: Map uid → perfil de los carritos · cargandoPerfiles
 *  - cumpleanos (getDatosPersonalesAggregate: { proximosCumpleanos, truncated, docsLeidos }) · cargandoCumpleanos
 *  - clientes: [{ uid, nombre, email, dni, cartCount, cartUnits }] · cargandoClientes · errorClientes
 *  - hayMas · onMas() · cargandoMas · onBuscar(texto) (ya esperó a que deje de escribir; '' = la lista)
 *  - onPrepararBusqueda() → { revisados, actualizados } (reindexarBusquedaClientes)
 *  - ficha: las props de FichaCliente del abierto · onAbrir(cliente | null) · onPestanaFicha(id) · pestanaFicha
 *  - fechasImportantes (to)
 */
export function PaginaClientesResultados({
  datos, perfiles, cargandoPerfiles = false, cumpleanos, cargandoCumpleanos = false,
  clientes = [], cargandoClientes = false, errorClientes, hayMas = false, onMas, cargandoMas = false, onBuscar, onPrepararBusqueda,
  ficha = {}, onAbrir, pestanaFicha = 'resumen', onPestanaFicha, fechasImportantes,
}) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(null);
  const [preguntando, setPreguntando] = useState(false);
  const [preparando, setPreparando] = useState('');
  const buscando = texto.trim().length >= 2;

  // Espera a que deje de escribir antes de buscar (una consulta, no una por letra).
  useEffect(() => {
    const t = window.setTimeout(() => onBuscar?.(texto.trim().length >= 2 ? texto.trim() : ''), 400);
    return () => window.clearTimeout(t);
  }, [texto]); // eslint-disable-line react-hooks/exhaustive-deps

  const carritos = useMemo(() => (datos?.abandonedCarts || []).map((c) => ({
    id: c.id, quien: quienDelCarrito(c, perfiles?.get?.(c.uid)), valor: solesCentimos(c.lastCartValue), cuando: fechaHoraCorta(c.abandonedAtMs),
    ...contactoDelCarrito(c, perfiles?.get?.(c.uid), cargandoPerfiles),
  })), [datos?.abandonedCarts, perfiles, cargandoPerfiles]);
  const cumples = useMemo(() => cumpleanosDe(cumpleanos?.proximosCumpleanos), [cumpleanos]);
  const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));

  const abrir = (c) => { setAbierto(c); onAbrir?.(c); };
  const preparar = async () => {
    setPreguntando(false);
    setPreparando('Preparando…');
    try {
      const r = await onPrepararBusqueda?.();
      setPreparando(`Listo: ${entero(r?.revisados)} perfiles revisados, ${entero(r?.actualizados)} actualizados.`);
      onBuscar?.(texto.trim());
    } catch (err) {
      setPreparando(`No se pudo: ${err?.message || err}`);
    }
  };

  return (
    <div className={s.resumen} data-componente="PaginaClientesResultados">
      <FilaCifras etiqueta="Clientes">
        <Cifra nombre="Carritos abandonados" valor={entero(datos?.carritosAbandonados?.cantidad?.total)} ayuda={solesCentimos(datos?.carritosAbandonados?.valorCents?.total)} tono="aviso" />
        <Cifra nombre="Cumpleaños en 30 días" valor={cumpleanos ? entero(cumples.length) : '—'} tono="violeta" cargando={cargandoCumpleanos} />
        <Cifra nombre="Usaron la app" valor={datos?.personas ? entero(datos.personas.app) : '—'} ayuda="Personas en el periodo" tono="cielo" />
      </FilaCifras>

      <BloqueMetrica titulo="Carritos abandonados" ayuda="Agregaron productos y no terminaron el pedido. El botón abre WhatsApp con el mensaje listo; lo envías tú.">
        <TablaAdmin
          etiqueta="Carritos abandonados"
          filas={carritos}
          nombreDe={(c) => c.quien}
          vacio={{ titulo: 'Ningún carrito abandonado', texto: 'Nadie dejó su carrito en este periodo.' }}
          columnas={[
            { id: 'quien', titulo: 'Cliente', tarjeta: 'titulo', celda: (c) => c.quien },
            { id: 'valor', titulo: 'Valor', alinear: 'fin', ancho: 120, tarjeta: 'detalle', celda: (c) => <span className={l.numero}>{c.valor}</span> },
            { id: 'cuando', titulo: 'Cuándo', ancho: 160, tarjeta: 'detalle', celda: (c) => c.cuando },
            {
              id: 'escribir', titulo: 'Escribirle', ancho: 150, tarjeta: 'control',
              celda: (c) => (c.whatsapp
                ? <Boton tamano="sm" variante="secundario" to={c.whatsapp}>WhatsApp</Boton>
                : <span className={l.sub}>{c.motivo}</span>),
            },
          ]}
        />
      </BloqueMetrica>

      <ColumnasMetricas>
        <BloqueMetrica titulo="Clientes" ayuda="Toca un cliente para ver su ficha: lo que mira, su carrito, su lista de deseos y sus fechas.">
          <Buscador placeholder="Buscar por nombre, correo, DNI o teléfono" value={texto} onChange={(e) => setTexto(e.target.value)} onBuscar={(v) => setTexto(v)} />
          {buscando && !cargandoClientes && !clientes.length && onPrepararBusqueda && (
            <p className={s.nota}>
              Nadie coincide con «{texto.trim()}».{' '}
              <Boton tamano="sm" variante="fantasma" disabled={preparando === 'Preparando…'} onClick={() => setPreguntando(true)}>¿Falta alguien? Preparar la búsqueda</Boton>
            </p>
          )}
          {preparando && <p className={s.nota} aria-live="polite">{preparando}</p>}
          {cargandoClientes ? <SinDatos>Cargando clientes…</SinDatos> : errorClientes ? <SinDatos>No se pudieron cargar: {errorClientes}</SinDatos> : !clientes.length ? (
            !buscando && <SinDatos>Todavía no hay clientes.</SinDatos>
          ) : (
            <ul className={s.clientes}>
              {clientes.map((c) => (
                <li key={c.uid}>
                  <button type="button" className={abierto?.uid === c.uid ? s.clienteActivo : s.cliente} onClick={() => abrir(c)}>
                    <span className={s.clienteNombre}>{c.nombre || 'Sin nombre'}</span>
                    <span className={s.clienteDetalle}>{[c.email, c.dni].filter(Boolean).join(' · ')}{c.cartCount > 0 ? ` · ${entero(c.cartUnits)} en el carrito` : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!buscando && hayMas && <Boton tamano="sm" variante="secundario" cargando={cargandoMas} onClick={onMas}>Ver más clientes</Boton>}
        </BloqueMetrica>

        <BloqueMetrica
          titulo="Próximos cumpleaños"
          ayuda="De tus clientes y de las personas que agendaron, en los próximos 30 días."
          acciones={fechasImportantes && <Boton tamano="sm" variante="fantasma" to={fechasImportantes}>Fechas importantes</Boton>}
        >
          {cargandoCumpleanos ? <SinDatos>Cargando…</SinDatos> : <ListaCumpleanos cumpleanos={cumples} />}
          {cumpleanos?.truncated && <p className={s.nota}>Se revisaron los primeros {entero(cumpleanos.docsLeidos)} perfiles.</p>}
        </BloqueMetrica>
      </ColumnasMetricas>

      <HojaEdicion abierta={Boolean(abierto)} titulo={abierto?.nombre || 'Cliente'} subtitulo={abierto?.email} onCerrar={() => abrir(null)}>
        {abierto && <FichaCliente {...ficha} pestana={pestanaFicha} onPestana={onPestanaFicha} />}
      </HojaEdicion>
      <Confirmar
        abierta={preguntando}
        titulo="¿Preparar la búsqueda de clientes?"
        texto="Revisa todos los perfiles de clientes y les agrega lo necesario para buscarlos. Puede tardar un poco."
        confirmar="Preparar"
        onConfirmar={preparar}
        onCancelar={() => setPreguntando(false)}
      />
    </div>
  );
}

const ENCUESTAS = [
  { id: 'entregas', texto: 'Cómo les fue con su pedido' },
  { id: 'suscripcion', texto: 'Encuesta de regalos' },
];

/**
 * Opiniones: elegir la encuesta y, debajo, su pantalla (children). Las dos
 * encuestas se rehacen en el kit en D5 ("encuestas"); hasta entonces el
 * conector pone las de hoy (AdminEncuestaEntregas, AdminRespuestasEncuesta) embebidas.
 *  - encuesta ('entregas' | 'suscripcion') · onEncuesta(id) · children
 */
export function PaginaOpinionesResultados({ encuesta = 'entregas', onEncuesta, children }) {
  return (
    <div className={s.resumen} data-componente="PaginaOpinionesResultados">
      <div className={s.pestanas}><Pestanas etiqueta="Encuesta" opciones={ENCUESTAS} valor={encuesta} onChange={onEncuesta} /></div>
      {children}
    </div>
  );
}
