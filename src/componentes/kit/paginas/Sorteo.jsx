import React, { useEffect, useRef, useState } from 'react';
import { LogIn, Share2, Ticket, Star, Sparkles, Download, Trophy, CheckCircle2 } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio, HojaInferior } from '../Feedback';
import { Campo, Cantidad } from '../Formulario';
import { Sello, Trazo } from '../Marca';
import { Estallido } from '../Efectos';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { TarjetaCuenta, Estadistica } from '../piezas/Cuenta';
import { FormaGanar, EnlaceInvitacion } from '../piezas/Referidos';
import { CamposDatosPersonales, validarPerfil, tipoDocumentoPara } from '../piezas/DatosPersonales';
import { PagoTarjeta, PagoPaypal } from '../piezas/Pago';
import { SeparadorAcceso } from '../piezas/Acceso';
import { CabezaSorteo, ListaGanadores } from '../piezas/Sorteos';
import { TextoResaltado } from '../piezas/TextoResaltado';
import { Texto, useTexto } from '../Traduccion';
import s from './Sorteo.module.css';

/* ── El sorteo (/sorteos y /sorteos/:slug) ──────────────── */

const soles = (n, moneda = 'PEN') => `${moneda === 'USD' ? 'US$' : 'S/'} ${Number(n || 0).toFixed(2)}`;
const PERU = [{ valor: 'PE', texto: 'Perú', prefijo: '+51' }];

/**
 * Un sorteo: el premio con su cuenta atrás, tu participación, cómo sumar
 * chances, quién ganó y el botón para participar (abajo y pegado en el
 * celular). Los datos se piden en una hoja; con tickets, ahí mismo se paga.
 * Participar y pagar lo hace el servidor; la página solo pide los datos y
 * muestra cómo va.
 *  - sorteo: { premio, imagen, descripcion, tipo: 'gratis' | 'pagado',
 *    precioTicket, moneda, numGanadores, hasta (ISO), cerrado, participantes,
 *    reglas: { compartir, referido, appExtra, appObligatorio }, ganadores: [{ id, nombre }] }
 *  - participacion: { tickets, chances, compartio } (null si aún no participa)
 *  - sesion · yo (uid) · enApp · urlLogin · urlApp
 *  - urlInvitacion: tu link para sumar chances con referidos
 *  - datosIniciales: { nombre, pais, tipoDocumento, documento, telefono, correo } (el perfil)
 *  - paises: [{ valor, texto, prefijo }] (con varios se elige el país: fuera
 *    del Perú el documento y el celular son libres)
 *  - onParticipar(datos): promesa (gratis) · onComprar({ datos, cantidad }):
 *    promesa → { monto, moneda, montoUsd, … } (el servidor fija el monto: lo
 *    que devuelva se le pasa a los botones de pago)
 *  - Pagar: botonTarjeta(compra) y botonesPaypal(compra) son los de la tienda
 *    (Culqi y el SDK de PayPal); paypal: { procesando, error }. Sin ellos,
 *    onPagarTarjeta() / onPagarPaypal() (la demo). pagado: cambia (un id)
 *    cuando el servidor confirmó el pago: la hoja se cierra.
 *  - onCompartir(): promesa (+1 chance; si falla, lanza y se avisa)
 *  - aviso: { tipo, texto } sobre el botón (lo que dice la tienda: el
 *    referido aplicado, un error fuera de la hoja)
 *  - estado: 'cargando' | 'error' | 'vacio'
 * Los textos pasan por la traducción.
 */
export function PaginaSorteo({
  sorteo = {}, participacion, sesion = true, yo, enApp = false, urlLogin = '/login', urlApp = '/descargar', urlInvitacion,
  datosIniciales = {}, paises = PERU, onParticipar, onComprar, onPagarTarjeta, onPagarPaypal, botonTarjeta, botonesPaypal,
  paypal = {}, pagado, onCompartir, aviso, estado,
}) {
  const [hoja, setHoja] = useState(false);
  const [datos, setDatos] = useState(() => ({ pais: 'PE', tipoDocumento: 'DNI', ...datosIniciales }));
  const [errores, setErrores] = useState({});
  const [cantidad, setCantidad] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [compra, setCompra] = useState(null);
  const [compartiendo, setCompartiendo] = useState(false);
  const [errorCompartir, setErrorCompartir] = useState('');
  const pagadoAntes = useRef(pagado);

  // El servidor confirmó el pago (la tienda cambia `pagado`): se cierra la hoja.
  useEffect(() => {
    if (pagado && pagado !== pagadoAntes.current) { setHoja(false); setCompra(null); }
    pagadoAntes.current = pagado;
  }, [pagado]);

  const pagadoTipo = sorteo.tipo === 'pagado';
  const moneda = sorteo.moneda || 'PEN';
  const t = {
    porTicket: useTexto(`${soles(sorteo.precioTicket, moneda)} por ticket`),
    gratis: useTexto('Gratis'),
    hoja: useTexto(compra ? 'Elige cómo pagar' : 'Tus datos para participar'),
    tickets: useTexto(cantidad === 1 ? '1 ticket' : `${cantidad} tickets`),
    nota: useTexto(`Con estos datos ${pagadoTipo ? 'generamos tu ticket' : 'validamos tu participación'} y te contactamos si ganas.`),
    correo: useTexto('Correo (opcional)'),
  };

  if (estado === 'cargando') return <EsqueletoPagina forma="sorteo" />;
  if (estado === 'error' || estado === 'vacio') {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <EstadoVacio
          imagen={estado === 'error' ? CARAS_KAPI.triste : CARAS_KAPI.feliz}
          titulo={<Texto>{estado === 'error' ? 'No pudimos cargar el sorteo' : 'Pronto habrá sorteos'}</Texto>}
          texto={<Texto>{estado === 'error' ? 'Revisa tu conexión e inténtalo otra vez.' : 'Aún no hay un sorteo activo. ¡Vuelve pronto para participar y ganar!'}</Texto>}
        >
          <Boton to="/tienda" variante="secundario"><Texto>Ver la tienda</Texto></Boton>
        </EstadoVacio>
      </BloqueSeccion>
    );
  }

  const reglas = sorteo.reglas || {};
  const ganadores = sorteo.ganadores || [];
  // "Ganaste" solo cuando el sorteo cerró y ya hay ganadores.
  const soyGanador = Boolean(sorteo.cerrado) && Boolean(yo) && ganadores.some((g) => g.id === yo);
  const participa = Boolean(participacion);

  const abrir = () => { setError(''); setCompra(null); setHoja(true); };
  const enviar = async () => {
    const pais = datos.pais || 'PE';
    const listos = { ...datos, pais, tipoDocumento: tipoDocumentoPara(pais, datos.tipoDocumento) };
    const e = validarPerfil(listos);
    setErrores(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    setError('');
    try {
      if (pagadoTipo) setCompra(await onComprar?.({ datos: listos, cantidad }));
      else { await onParticipar?.(listos); setHoja(false); }
    } catch (err) {
      setError(err?.message || 'No se pudo registrar tu participación. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };
  const pagar = (fn) => async () => { await fn?.(); setHoja(false); setCompra(null); };
  const compartir = async () => {
    setCompartiendo(true);
    setErrorCompartir('');
    try { await onCompartir?.(); } catch (err) {
      setErrorCompartir(err?.message || 'No pudimos sumar tu chance. Inténtalo otra vez.');
    } finally { setCompartiendo(false); }
  };

  let accion;
  if (!sesion) accion = <Boton to={urlLogin} bloque tamano="lg" icono={<LogIn aria-hidden="true" />}><Texto>Inicia sesión para participar</Texto></Boton>;
  else if (sorteo.cerrado) accion = <Boton bloque tamano="lg" disabled><Texto>El sorteo ya cerró</Texto></Boton>;
  else if (reglas.appObligatorio && !enApp) {
    accion = (
      <div className={s.accionApp}>
        <p><Texto>Este sorteo solo está disponible desde la app de Walá.</Texto></p>
        <Boton to={urlApp} bloque tamano="lg" icono={<Download aria-hidden="true" />}><Texto>Descargar la app</Texto></Boton>
      </div>
    );
  } else if (participa && !pagadoTipo) accion = <Boton bloque tamano="lg" disabled icono={<CheckCircle2 aria-hidden="true" />}><Texto>Ya estás participando</Texto></Boton>;
  else {
    accion = (
      <>
        {pagadoTipo && <p className={s.precioTicket}>{t.porTicket}</p>}
        <Boton bloque tamano="lg" brillo icono={<Ticket aria-hidden="true" />} onClick={abrir}>
          <Texto>{pagadoTipo ? (participa ? 'Comprar más tickets' : 'Quiero participar') : '¡Participar gratis!'}</Texto>
        </Boton>
      </>
    );
  }

  // [icono, título, texto, lo que suma]
  const formas = [
    pagadoTipo ? ['regalo', 'Cada ticket cuenta', 'Cada ticket pagado suma 1 chance para el sorteo.', '+1 por ticket'] : ['regalo', 'Participar', 'Participar te da 1 chance.', '+1'],
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
            precio={pagadoTipo ? t.porTicket : t.gratis}
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
                <p className={s.ganasteTitulo}><Texto>¡Felicidades, ganaste!</Texto><Trazo className={s.trazo} /></p>
                <p><Texto>Pronto nos contactaremos contigo para entregarte tu premio.</Texto></p>
              </div>
            </div>
          )}
        </div>
      </BloqueSeccion>

      <BloqueSeccion ajustes={{ paddingTop: '0.5rem', paddingBottom: '2.5rem' }}>
        <div className={s.columnas}>
          {participa && (
            <TarjetaCuenta icono={<Ticket aria-hidden="true" />} titulo={<Texto>Tu participación</Texto>} subtitulo={<Texto>{sorteo.cerrado ? 'El sorteo ya cerró.' : 'Estás participando.'}</Texto>}>
              <div className={s.cifras}>
                <Estadistica icono={<Ticket aria-hidden="true" />} etiqueta={<Texto>{pagadoTipo ? 'Tickets pagados' : 'Tickets'}</Texto>} valor={participacion.tickets ?? 1} />
                <Estadistica icono={<Star aria-hidden="true" />} tono="oro" etiqueta={<Texto>Chances</Texto>} valor={participacion.chances ?? 1} />
              </div>
            </TarjetaCuenta>
          )}
          {participa && !sorteo.cerrado && (reglas.compartir || (reglas.referido && urlInvitacion)) && (
            <TarjetaCuenta icono={<Sparkles aria-hidden="true" />} titulo={<Texto>Suma más chances</Texto>} subtitulo={<Texto>Cada chance es una oportunidad más de ganar.</Texto>}>
              {reglas.compartir && (
                participacion.compartio
                  ? <p className={s.hecho}><CheckCircle2 aria-hidden="true" /> <Texto>Ya sumaste tu chance por compartir.</Texto></p>
                  : (
                    <div className={s.compartir}>
                      <p><TextoResaltado resaltar={['1 chance']}>Comparte este sorteo y gana 1 chance (una sola vez).</TextoResaltado></p>
                      <Boton variante="secundario" icono={<Share2 aria-hidden="true" />} cargando={compartiendo} onClick={compartir}>
                        <Texto>Compartir y ganar 1 chance</Texto>
                      </Boton>
                      {errorCompartir && <Aviso tipo="error" compacto>{errorCompartir}</Aviso>}
                    </div>
                  )
              )}
              {reglas.referido && urlInvitacion && (
                <div className={s.compartir}>
                  <p><TextoResaltado resaltar={['1 chance']}>Tu link: ganas 1 chance por cada persona que participe con él.</TextoResaltado></p>
                  <EnlaceInvitacion url={urlInvitacion} onCopiar={() => navigator.clipboard?.writeText(urlInvitacion)} />
                </div>
              )}
            </TarjetaCuenta>
          )}
          {ganadores.length > 0 && sorteo.cerrado && (
            <TarjetaCuenta icono={<Trophy aria-hidden="true" />} tono="oro" titulo={<Texto>{ganadores.length === 1 ? 'Quién ganó' : 'Quiénes ganaron'}</Texto>}>
              <ListaGanadores ganadores={ganadores} yo={yo} />
            </TarjetaCuenta>
          )}
          <TarjetaCuenta icono={<Star aria-hidden="true" />} titulo={<Texto>Cómo ganar más chances</Texto>}>
            <div className={s.formas}>
              {formas.map(([icono, titulo, texto, premio]) => <FormaGanar key={titulo} icono={icono} titulo={titulo} premio={premio}><Texto>{texto}</Texto></FormaGanar>)}
              {reglas.appObligatorio && <Aviso tipo="info" compacto>Este sorteo solo se juega desde la app.</Aviso>}
            </div>
          </TarjetaCuenta>
        </div>
        <div className={s.accion} data-componente="AccionSorteo">
          {aviso?.texto && <Aviso tipo={aviso.tipo || 'info'} compacto>{aviso.texto}</Aviso>}
          {accion}
        </div>
      </BloqueSeccion>

      <HojaInferior
        abierta={hoja}
        onCerrar={() => { if (!enviando && !paypal.procesando) setHoja(false); }}
        titulo={t.hoja}
        pie={!compra && (
          <Boton bloque cargando={enviando} onClick={enviar}><Texto>{pagadoTipo ? 'Continuar al pago' : 'Participar'}</Texto></Boton>
        )}
      >
        {compra ? (
          <div className={s.pago}>
            <p className={s.pagoResumen}><strong>{t.tickets}</strong> · {soles(compra.monto, compra.moneda)}</p>
            <p className={s.nota}><Texto>El monto lo confirma el servidor.</Texto></p>
            {botonTarjeta
              ? botonTarjeta(compra)
              : <PagoTarjeta monto={compra.monto} moneda={compra.moneda || moneda} onPagar={pagar(onPagarTarjeta)} />}
            <SeparadorAcceso>o paga desde el extranjero</SeparadorAcceso>
            <PagoPaypal
              montoUsd={compra.montoUsd || compra.monto / 3.75}
              equivalente={`≈ ${soles(compra.monto)}`}
              botones={botonesPaypal ? botonesPaypal(compra) : undefined}
              procesando={paypal.procesando}
              error={paypal.error}
              onPagar={pagar(onPagarPaypal)}
            />
          </div>
        ) : (
          <div className={s.formulario}>
            <p className={s.nota}>{t.nota}</p>
            <CamposDatosPersonales
              datos={datos}
              paises={paises}
              onCambiar={(c, v) => { setDatos((d) => ({ ...d, [c]: v })); setErrores((x) => ({ ...x, [c]: undefined })); }}
              errores={errores}
              cumpleanos={false}
              disabled={enviando}
            />
            <Campo etiqueta={t.correo} type="email" value={datos.correo || ''} onChange={(e) => setDatos((d) => ({ ...d, correo: e.target.value }))} disabled={enviando} />
            {pagadoTipo && (
              <div className={s.tickets}>
                <span><Texto>Tickets</Texto></span>
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
