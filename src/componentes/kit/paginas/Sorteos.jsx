import React, { useState } from 'react';
import { LogIn, Share2, Ticket, Star, Sparkles, Download, ArrowRight, Trophy, Repeat, Receipt, Gift, CheckCircle2 } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio, HojaInferior } from '../Feedback';
import { Campo, Cantidad, Casilla } from '../Formulario';
import { Chip, Etiqueta } from '../Etiquetas';
import { Pestanas } from '../Navegacion';
import { Enlace } from '../Enlace';
import { Sello, Trazo } from '../Marca';
import { Estallido } from '../Efectos';
import { BloqueSeccion, TituloSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { TarjetaCuenta, Estadistica, ListaDatos } from '../piezas/Cuenta';
import { FormaGanar, EnlaceInvitacion } from '../piezas/Referidos';
import { CamposDatosPersonales, validarPerfil } from '../piezas/DatosPersonales';
import { PagoTarjeta, PagoPaypal } from '../piezas/Pago';
import { BotonGoogle, SeparadorAcceso } from '../piezas/Acceso';
import { FotoProducto } from '../piezas/FotoProducto';
import { CabezaSorteo, ListaGanadores, TarjetaPlan, TarjetaAliado } from '../piezas/Sorteos';
import s from './Sorteos.module.css';

/*
 * Los sorteos: el sorteo del momento (/sorteos y /sorteos/:slug, gratis o
 * con tickets) y la campaña por suscripción (/suscrito-sorteo, cobro
 * automático). Participar y pagar lo hace el servidor; la página solo pide
 * los datos y muestra cómo va.
 */

const soles = (n, moneda = 'PEN') => `${moneda === 'USD' ? 'US$' : 'S/'} ${Number(n || 0).toFixed(2)}`;

/* ── El sorteo (/sorteos) ───────────────────────────────── */

/**
 * Un sorteo: el premio con su cuenta atrás, tu participación, cómo sumar
 * chances, quién ganó y el botón para participar (abajo y pegado en el
 * celular). Los datos se piden en una hoja; con tickets, ahí mismo se paga.
 *  - sorteo: { premio, imagen, descripcion, tipo: 'gratis' | 'pagado',
 *    precioTicket, moneda, numGanadores, hasta (ISO), cerrado, participantes,
 *    reglas: { compartir, referido, appExtra, appObligatorio }, ganadores: [{ id, nombre }] }
 *  - participacion: { tickets, chances, compartio } (null si aún no participa)
 *  - sesion · yo (uid) · enApp · urlLogin · urlApp
 *  - urlInvitacion: tu link para sumar chances con referidos
 *  - datosIniciales: { nombre, tipoDocumento, documento, telefono, correo } (el perfil)
 *  - onParticipar(datos): promesa (gratis) · onComprar({ datos, cantidad }):
 *    promesa → { monto, moneda } (el servidor fija el monto)
 *  - onPagarTarjeta(), onPagarPaypal(): promesas · onCompartir(): promesa (+1 chance)
 *  - estado: 'cargando' | 'error' | 'vacio'
 */
export function PaginaSorteo({
  sorteo = {}, participacion, sesion = true, yo, enApp = false, urlLogin = '/login', urlApp = '/descargar', urlInvitacion,
  datosIniciales = {}, onParticipar, onComprar, onPagarTarjeta, onPagarPaypal, onCompartir, estado,
}) {
  const [hoja, setHoja] = useState(false);
  const [datos, setDatos] = useState(() => ({ tipoDocumento: 'DNI', ...datosIniciales }));
  const [errores, setErrores] = useState({});
  const [cantidad, setCantidad] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [compra, setCompra] = useState(null);
  const [compartiendo, setCompartiendo] = useState(false);

  if (estado === 'cargando') return <EsqueletoPagina forma="sorteo" />;
  if (estado === 'error' || estado === 'vacio') {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <EstadoVacio
          imagen={estado === 'error' ? CARAS_KAPI.triste : CARAS_KAPI.feliz}
          titulo={estado === 'error' ? 'No pudimos cargar el sorteo' : 'Pronto habrá sorteos'}
          texto={estado === 'error' ? 'Revisa tu conexión e inténtalo otra vez.' : 'Aún no hay un sorteo activo. ¡Vuelve pronto para participar y ganar!'}
        >
          <Boton to="/tienda" variante="secundario">Ver la tienda</Boton>
        </EstadoVacio>
      </BloqueSeccion>
    );
  }

  const pagado = sorteo.tipo === 'pagado';
  const moneda = sorteo.moneda || 'PEN';
  const reglas = sorteo.reglas || {};
  const ganadores = sorteo.ganadores || [];
  const soyGanador = Boolean(yo) && ganadores.some((g) => g.id === yo);
  const participa = Boolean(participacion);

  const abrir = () => { setError(''); setCompra(null); setHoja(true); };
  const enviar = async () => {
    const e = validarPerfil({ ...datos, pais: 'PE' });
    setErrores(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    setError('');
    try {
      if (pagado) setCompra(await onComprar?.({ datos, cantidad }));
      else { await onParticipar?.(datos); setHoja(false); }
    } catch (err) {
      setError(err?.message || 'No se pudo registrar tu participación. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };
  const pagar = (fn) => async () => { await fn?.(); setHoja(false); setCompra(null); };

  let accion;
  if (!sesion) accion = <Boton to={urlLogin} bloque tamano="lg" icono={<LogIn aria-hidden="true" />}>Inicia sesión para participar</Boton>;
  else if (sorteo.cerrado) accion = <Boton bloque tamano="lg" disabled>El sorteo ya cerró</Boton>;
  else if (reglas.appObligatorio && !enApp) {
    accion = (
      <div className={s.accionApp}>
        <p>Este sorteo solo está disponible desde la app de Walá.</p>
        <Boton to={urlApp} bloque tamano="lg" icono={<Download aria-hidden="true" />}>Descargar la app</Boton>
      </div>
    );
  } else if (participa && !pagado) accion = <Boton bloque tamano="lg" disabled icono={<CheckCircle2 aria-hidden="true" />}>Ya estás participando</Boton>;
  else {
    accion = (
      <>
        {pagado && <p className={s.precioTicket}>{soles(sorteo.precioTicket, moneda)} por ticket</p>}
        <Boton bloque tamano="lg" brillo icono={<Ticket aria-hidden="true" />} onClick={abrir}>
          {pagado ? (participa ? 'Comprar más tickets' : 'Quiero participar') : '¡Participar gratis!'}
        </Boton>
      </>
    );
  }

  // [icono, título, texto, lo que suma]
  const formas = [
    pagado ? ['regalo', 'Cada ticket cuenta', 'Cada ticket pagado suma 1 chance para el sorteo.', '+1 por ticket'] : ['regalo', 'Participar', 'Participar te da 1 chance.', '+1'],
    reglas.appExtra && ['estrella', 'Desde la app', 'Entrar desde la app de Walá te da 1 chance extra.', '+1'],
    reglas.compartir && ['corazon', 'Compartir', 'Compartir el sorteo te suma 1 chance (una vez).', '+1'],
    reglas.referido && ['mano', 'Invitar', 'Ganas 1 chance por cada amigo que participe con tu link.', '+1 por amigo'],
  ].filter(Boolean);

  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '1rem' }}>
        <div className={s.sorteo} data-componente="PaginaSorteo">
          <CabezaSorteo
            premio={sorteo.premio}
            imagen={sorteo.imagen}
            descripcion={sorteo.descripcion}
            precio={pagado ? `${soles(sorteo.precioTicket, moneda)} por ticket` : 'Gratis'}
            ganadores={sorteo.numGanadores}
            hasta={sorteo.hasta}
            cerrado={sorteo.cerrado}
            participantes={sorteo.participantes}
          />
          {soyGanador && (
            <div className={s.ganaste} role="status">
              <span className={s.ganasteSello}>
                <Sello tamano={60} tono="oro"><Trophy aria-hidden="true" /></Sello>
                <Estallido disparo="gane" forma="confeti" cantidad={14} distancia={56} />
              </span>
              <div>
                <p className={s.ganasteTitulo}>¡Felicidades, ganaste!<Trazo className={s.trazo} /></p>
                <p>Pronto nos contactaremos contigo para entregarte tu premio.</p>
              </div>
            </div>
          )}
        </div>
      </BloqueSeccion>

      <BloqueSeccion ajustes={{ paddingTop: '0.5rem', paddingBottom: '2.5rem' }}>
        <div className={s.columnas}>
            {participa && (
              <TarjetaCuenta icono={<Ticket aria-hidden="true" />} titulo="Tu participación" subtitulo={sorteo.cerrado ? 'El sorteo ya cerró.' : 'Estás participando.'}>
                <div className={s.cifras}>
                  <Estadistica icono={<Ticket aria-hidden="true" />} etiqueta={pagado ? 'Tickets pagados' : 'Tickets'} valor={participacion.tickets ?? 1} />
                  <Estadistica icono={<Star aria-hidden="true" />} tono="oro" etiqueta="Chances" valor={participacion.chances ?? 1} />
                </div>
              </TarjetaCuenta>
            )}
            {participa && !sorteo.cerrado && (reglas.compartir || (reglas.referido && urlInvitacion)) && (
              <TarjetaCuenta icono={<Sparkles aria-hidden="true" />} titulo="Suma más chances" subtitulo="Cada chance es una oportunidad más de ganar.">
                {reglas.compartir && (
                  participacion.compartio
                    ? <p className={s.hecho}><CheckCircle2 aria-hidden="true" /> Ya sumaste tu chance por compartir.</p>
                    : (
                      <div className={s.compartir}>
                        <p>Comparte este sorteo y gana <strong>1 chance</strong> (una sola vez).</p>
                        <Boton variante="secundario" icono={<Share2 aria-hidden="true" />} cargando={compartiendo} onClick={async () => { setCompartiendo(true); try { await onCompartir?.(); } finally { setCompartiendo(false); } }}>
                          Compartir y ganar 1 chance
                        </Boton>
                      </div>
                    )
                )}
                {reglas.referido && urlInvitacion && (
                  <div className={s.compartir}>
                    <p>Tu link: ganas <strong>1 chance</strong> por cada persona que participe con él.</p>
                    <EnlaceInvitacion url={urlInvitacion} onCopiar={() => navigator.clipboard?.writeText(urlInvitacion)} />
                  </div>
                )}
              </TarjetaCuenta>
            )}
            {ganadores.length > 0 && sorteo.cerrado && (
              <TarjetaCuenta icono={<Trophy aria-hidden="true" />} tono="oro" titulo={ganadores.length === 1 ? 'Quién ganó' : 'Quiénes ganaron'}>
                <ListaGanadores ganadores={ganadores} yo={yo} />
              </TarjetaCuenta>
            )}
            <TarjetaCuenta icono={<Star aria-hidden="true" />} titulo="Cómo ganar más chances">
              <div className={s.formas}>
                {formas.map(([icono, titulo, texto, premio]) => <FormaGanar key={titulo} icono={icono} titulo={titulo} premio={premio}>{texto}</FormaGanar>)}
                {reglas.appObligatorio && <Aviso tipo="info" compacto>Este sorteo solo se juega desde la app.</Aviso>}
              </div>
            </TarjetaCuenta>
        </div>
        <div className={s.accion} data-componente="AccionSorteo">{accion}</div>
      </BloqueSeccion>

      <HojaInferior
        abierta={hoja}
        onCerrar={() => { if (!enviando) setHoja(false); }}
        titulo={compra ? 'Elige cómo pagar' : 'Tus datos para participar'}
        pie={!compra && (
          <Boton bloque cargando={enviando} onClick={enviar}>{pagado ? 'Continuar al pago' : 'Participar'}</Boton>
        )}
      >
        {compra ? (
          <div className={s.pago}>
            <p className={s.pagoResumen}><strong>{cantidad} {cantidad === 1 ? 'ticket' : 'tickets'}</strong> · {soles(compra.monto, compra.moneda)}</p>
            <p className={s.nota}>El monto lo confirma el servidor.</p>
            <PagoTarjeta monto={compra.monto} moneda={compra.moneda || moneda} onPagar={pagar(onPagarTarjeta)} />
            <SeparadorAcceso>o paga desde el extranjero</SeparadorAcceso>
            <PagoPaypal montoUsd={compra.montoUsd || compra.monto / 3.75} equivalente={`≈ ${soles(compra.monto)}`} onPagar={pagar(onPagarPaypal)} />
          </div>
        ) : (
          <div className={s.formulario}>
            <p className={s.nota}>Con estos datos {pagado ? 'generamos tu ticket' : 'validamos tu participación'} y te contactamos si ganas.</p>
            <CamposDatosPersonales datos={{ ...datos, pais: 'PE' }} onCambiar={(c, v) => { setDatos((d) => ({ ...d, [c]: v })); setErrores((x) => ({ ...x, [c]: undefined })); }} errores={errores} cumpleanos={false} disabled={enviando} />
            <Campo etiqueta="Correo (opcional)" type="email" value={datos.correo || ''} onChange={(e) => setDatos((d) => ({ ...d, correo: e.target.value }))} disabled={enviando} />
            {pagado && (
              <div className={s.tickets}>
                <span>Tickets</span>
                <Cantidad valor={cantidad} onChange={setCantidad} min={1} max={99} />
                <strong>{soles(cantidad * (sorteo.precioTicket || 0), moneda)}</strong>
              </div>
            )}
            {error && <Aviso tipo="error" compacto>{error}</Aviso>}
          </div>
        )}
      </HojaInferior>
    </>
  );
}

/* ── Sorteo por suscripción (/suscrito-sorteo) ──────────── */

const ESTADOS_SUSCRIPCION = {
  activo: { texto: 'Activa', tono: 'exito' },
  pendiente_pago: { texto: 'Pendiente de pago', tono: 'aviso' },
  vencido: { texto: 'Vencida', tono: 'peligro' },
  cancelado: { texto: 'Cancelada', tono: 'neutro' },
};

const PESTANAS_CUENTA = [
  { id: 'suscripcion', texto: 'Mi suscripción' },
  { id: 'chances', texto: 'Mis chances' },
  { id: 'recibos', texto: 'Mis recibos' },
];

/**
 * La campaña del sorteo por suscripción: planes con cobro automático, los
 * premios, quienes ya ganaron, los descuentos de marcas aliadas y, con
 * sesión, tu cuenta (suscripción, chances y recibos). Suscribirse va en una
 * hoja: entrar con Google, los datos y la autorización del cobro, y pagar.
 *  - campana: { titulo, descripcion, suscriptores, planes: [{ id, nombre,
 *    intervalo, meses, precio, precioUsd, chances, beneficios, destacado }],
 *    premios: [{ nombre, imagen }], ganadores: [{ id, nombre, premio, fecha, foto }],
 *    aliados: [{ id, marca, titulo, descuento, ubicacion, categoria, imagen, url }] }
 *  - suscripcion: { estado, plan, metodo, vigente, proximo, chances } (null: no tiene)
 *  - recibos: [{ id, fecha, monto }] · sesion · usuario: { nombre, email }
 *  - onGoogle(): promesa · onPagarTarjeta({ plan, datos }), onPagarPaypal({ plan, datos }):
 *    promesas → { pendiente } · onCancelar(): promesa
 *  - estado: 'cargando' | 'noDisponible'
 */
export function PaginaSuscripcionSorteo({
  campana = {}, suscripcion, recibos = [], sesion = false, usuario, onGoogle, onPagarTarjeta, onPagarPaypal, onCancelar, estado,
}) {
  const [plan, setPlan] = useState(null);
  const [paso, setPaso] = useState('datos');
  const [nombre, setNombre] = useState(usuario?.nombre || '');
  const [autoriza, setAutoriza] = useState(false);
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [categoria, setCategoria] = useState('todas');
  const [pestana, setPestana] = useState('suscripcion');
  const [cancelar, setCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  if (estado === 'cargando') return <EsqueletoPagina forma="suscripcionSorteo" />;
  if (estado === 'noDisponible') {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <EstadoVacio imagen={CARAS_KAPI.triste} titulo="No disponible" texto="Este sorteo por suscripción no está disponible por ahora. ¡Vuelve pronto!">
          <Boton to="/tienda" variante="secundario">Ver la tienda</Boton>
        </EstadoVacio>
      </BloqueSeccion>
    );
  }

  const planes = campana.planes || [];
  const aliados = campana.aliados || [];
  const categorias = [...new Set(aliados.map((a) => a.categoria).filter(Boolean))];
  const vistos = categoria === 'todas' ? aliados : aliados.filter((a) => a.categoria === categoria);
  const elegir = (p) => { setPlan(p); setPaso(sesion ? 'datos' : 'cuenta'); setError(''); setAutoriza(false); };
  const cerrar = () => setPlan(null);
  const continuar = () => {
    if (!nombre.trim()) { setError('Escribe al menos tus nombres.'); return; }
    if (!autoriza) { setError('Autoriza el cobro automático para continuar.'); return; }
    setError('');
    setPaso('pago');
  };
  const pagar = (fn) => async () => {
    const r = await fn?.({ plan, datos: { nombre, email: usuario?.email } });
    if (r?.pendiente) setPaso('pendiente');
    else cerrar();
  };
  const meses = (m) => (m === 1 ? 'cada mes' : `cada ${m} meses`);
  const enlaces = [['#planes', 'Planes'], campana.premios?.length && ['#premios', 'Premios'], ['#ganadores', 'Ganadores'], aliados.length && ['#beneficios', 'Beneficios'], sesion && ['#mi-cuenta', 'Mi cuenta']].filter(Boolean);
  const est = ESTADOS_SUSCRIPCION[suscripcion?.estado];

  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '1rem' }}>
        <div className={s.campana} data-componente="PaginaSuscripcionSorteo">
          <header className={s.portada}>
            <Sello tamano={56} girar={-10}><Repeat aria-hidden="true" /></Sello>
            <h1 className={s.portadaTitulo}>{campana.titulo}<Trazo className={s.trazoClaro} /></h1>
            {campana.descripcion && <p className={s.portadaTexto}>{campana.descripcion}</p>}
            {campana.suscriptores != null && <p className={s.portadaCuenta}><strong>{Number(campana.suscriptores).toLocaleString('es-PE')}</strong> suscriptores participando</p>}
            <Boton to="#planes" tamano="lg" variante="contorno" iconoFin={<ArrowRight aria-hidden="true" />} style={{ '--b-fondo': '#fff', '--b-fondo-hover': '#fff', '--b-texto': '#4c1d95', '--b-borde': 'transparent' }}>Quiero suscribirme</Boton>
          </header>
          <nav className={s.anclas} aria-label="Secciones">
            {enlaces.map(([url, texto]) => <Enlace key={url} to={url} className={s.ancla}>{texto}</Enlace>)}
          </nav>
        </div>
      </BloqueSeccion>

      <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '1.5rem', anchorId: 'planes' }}>
        <TituloSeccion titulo="Elige tu plan" subtitulo="Cobro automático y participas en cada sorteo. Mientras más tiempo suscrito, más chances de ganar." subrayado />
        {planes.length ? (
          <ul className={s.planes}>
            {planes.map((p) => (
              <li key={p.id}>
                <TarjetaPlan
                  nombre={p.nombre}
                  intervalo={p.intervalo}
                  precio={soles(p.precio)}
                  precioUsd={p.precioUsd ? `$ ${Number(p.precioUsd).toFixed(2)}` : undefined}
                  alMes={p.meses > 1 ? soles(p.precio / p.meses) : undefined}
                  chances={p.chances}
                  beneficios={p.beneficios}
                  destacado={p.destacado}
                  onElegir={() => elegir(p)}
                />
              </li>
            ))}
          </ul>
        ) : <p className={s.nota}>Todavía no hay planes.</p>}
      </BloqueSeccion>

      {campana.premios?.length > 0 && (
        <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '1.5rem', anchorId: 'premios' }}>
          <TituloSeccion titulo="Premios" subtitulo="Esto es lo que puedes ganar siendo suscriptor." />
          <ul className={s.premios}>
            {campana.premios.map((p) => (
              <li key={p.nombre}>
                <FotoProducto src={p.imagen} relleno="8%" className={s.premioFoto} respaldo={<Gift aria-hidden="true" />} />
                <strong>{p.nombre}</strong>
              </li>
            ))}
          </ul>
        </BloqueSeccion>
      )}

      <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '1.5rem', anchorId: 'ganadores' }}>
        <TituloSeccion titulo="Ganadores" subtitulo="Ya ganaron. La próxima puede ser tu vez." />
        {campana.ganadores?.length ? <ListaGanadores ganadores={campana.ganadores} /> : <p className={s.nota}>Pronto anunciaremos a quienes ganen primero.</p>}
      </BloqueSeccion>

      {aliados.length > 0 && (
        <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '1.5rem', anchorId: 'beneficios' }}>
          <TituloSeccion titulo="Beneficios para suscriptores" subtitulo="Descuentos exclusivos en marcas aliadas." />
          {categorias.length > 1 && (
            <div className={s.filtros}>
              {['todas', ...categorias].map((c) => <Chip key={c} activo={categoria === c} onClick={() => setCategoria(c)}>{c === 'todas' ? 'Todas' : c}</Chip>)}
            </div>
          )}
          <ul className={s.aliados}>{vistos.map((a) => <li key={a.id}><TarjetaAliado {...a} /></li>)}</ul>
        </BloqueSeccion>
      )}

      {sesion && (
        <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '2.5rem', anchorId: 'mi-cuenta' }}>
          <TarjetaCuenta icono={<Receipt aria-hidden="true" />} titulo="Mi cuenta">
            <Pestanas opciones={PESTANAS_CUENTA} valor={pestana} onChange={setPestana} etiqueta="Mi cuenta" />
            {pestana === 'suscripcion' && (!suscripcion ? (
              <div className={s.sinSuscripcion}>
                <p>Aún no tienes una suscripción en esta campaña.</p>
                <Boton to="#planes" variante="secundario">Ver los planes</Boton>
              </div>
            ) : (
              <div className={s.miSuscripcion}>
                <ListaDatos datos={[
                  { etiqueta: 'Estado', valor: est && <Etiqueta tono={est.tono}>{est.texto}</Etiqueta> },
                  { etiqueta: 'Plan', valor: suscripcion.plan },
                  { etiqueta: 'Método de pago', valor: suscripcion.metodo },
                  { etiqueta: 'Vigente hasta', valor: suscripcion.vigente },
                  { etiqueta: 'Próximo cobro', valor: suscripcion.proximo },
                ]}
                />
                {['activo', 'pendiente_pago'].includes(suscripcion.estado) && (cancelar ? (
                  <Aviso
                    tipo="aviso"
                    titulo="¿Cancelar el cobro automático?"
                    accion={(
                      <div className={s.botones}>
                        <Boton variante="secundario" tamano="sm" onClick={() => setCancelar(false)}>No, mantener</Boton>
                        <Boton variante="peligro" tamano="sm" cargando={cancelando} onClick={async () => { setCancelando(true); try { await onCancelar?.(); setCancelar(false); } finally { setCancelando(false); } }}>Sí, cancelar</Boton>
                      </div>
                    )}
                  >
                    No se harán más cobros. Sigues participando hasta el fin del periodo ya pagado.
                  </Aviso>
                ) : <Boton variante="fantasma" tamano="sm" onClick={() => setCancelar(true)}>Cancelar suscripción</Boton>)}
              </div>
            ))}
            {pestana === 'chances' && (
              <Estadistica grande icono={<Star aria-hidden="true" />} tono="oro" etiqueta="Chances acumuladas" valor={suscripcion?.chances ?? 0} nota="Cada ciclo pagado te suma chances según tu plan. Solo quienes tienen la suscripción vigente pueden ganar." />
            )}
            {pestana === 'recibos' && (recibos.length
              ? <ListaDatos datos={recibos.map((r) => ({ etiqueta: r.fecha, valor: r.monto }))} />
              : <p className={s.nota}>Aún no tienes recibos de cobro.</p>)}
          </TarjetaCuenta>
        </BloqueSeccion>
      )}

      <HojaInferior abierta={Boolean(plan)} onCerrar={cerrar} titulo={paso === 'pendiente' ? 'Casi listo' : `Suscribirme: ${plan?.nombre || ''}`}>
        {plan && (
          <div className={s.formulario}>
            {paso !== 'pendiente' && (
              <p className={s.pagoResumen}><strong>{plan.nombre}</strong> · {soles(plan.precio)} {meses(plan.meses || 1)}</p>
            )}
            {paso === 'cuenta' && (
              <>
                <p>Inicia sesión para suscribirte y participar. Es rápido con Google.</p>
                <BotonGoogle cargando={entrando} onClick={async () => { setEntrando(true); try { await onGoogle?.(); setPaso('datos'); } finally { setEntrando(false); } }} />
              </>
            )}
            {paso === 'datos' && (
              <>
                <Campo etiqueta="Nombres" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" />
                <Campo etiqueta="Correo" value={usuario?.email || ''} readOnly ayuda="El de tu cuenta: ahí llegan los recibos." />
                <Casilla
                  activo={autoriza}
                  onChange={setAutoriza}
                  etiqueta={<>Autorizo el cobro automático de <strong>{soles(plan.precio)}</strong> {meses(plan.meses || 1)} hasta que cancele mi suscripción.</>}
                />
                {error && <Aviso tipo="error" compacto>{error}</Aviso>}
                <Boton bloque onClick={continuar}>Continuar al pago</Boton>
              </>
            )}
            {paso === 'pago' && (
              <>
                <PagoTarjeta monto={plan.precio} texto={`Suscribirme (${soles(plan.precio)})`} onPagar={pagar(onPagarTarjeta)} />
                <SeparadorAcceso>o paga desde el extranjero</SeparadorAcceso>
                <PagoPaypal montoUsd={plan.precioUsd || plan.precio / 3.75} onPagar={pagar(onPagarPaypal)} />
              </>
            )}
            {paso === 'pendiente' && (
              <div className={s.pendiente}>
                <Sello tamano={56} tono="oro"><Sparkles aria-hidden="true" /></Sello>
                <p><strong>Tu suscripción se está activando.</strong> Se activa sola cuando se confirme tu primer cobro; te avisamos por correo. ¡Gracias por suscribirte!</p>
                <Boton bloque onClick={cerrar}>Entendido</Boton>
              </div>
            )}
          </div>
        )}
      </HojaInferior>
    </>
  );
}
