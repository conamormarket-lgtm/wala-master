import React, { useEffect, useRef, useState } from 'react';
import { Share2, Gamepad2, LogIn, RotateCcw } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio } from '../Feedback';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import CuentaRegresiva from '../CuentaRegresiva';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { BarraProgreso } from '../piezas/BarraProgreso';
import { CodigoCopiable } from '../piezas/Legales';
import { MarcoJuego, AyudaJuego, PremioJuego, ResultadoJuego, TextoResaltado, compartirTexto } from '../piezas/Juegos';
import { RuedaRuleta, HistorialRuleta } from '../piezas/Ruleta';
import { Texto, useTexto } from '../Traduccion';
import { anguloDeParada } from '../../../utils/ruletaModel';
import s from './Juegos.module.css';

/* ── Ruleta Semanal (/ruleta) ───────────────────────────── */

const SIN_HISTORIAL = [];

/**
 * La Ruleta Semanal: se gana un giro por semana con la racha de Kapi (7 días).
 * La racha se ve arriba de la rueda; el premio lo sortea el servidor y la
 * rueda para en su gajo (anguloDeParada).
 *  - premios: los de hoy, en el orden del servidor ({ id, nombre, etiqueta, color })
 *  - tema: { colores, colorAro, colorPuntero } · reglas: { vueltas, duracionGiroMs, modoDesbloqueo }
 *  - eleccion: { desbloqueada, girada, perdida, pendienteAnterior, dias }
 *  - historial: HistorialRuleta · hasta: ISO del próximo lunes (Lima)
 *  - onGirar(): promesa → { indice, total, premio: { tipo, texto, monedas }, cupon: { codigo, vence }, fecha }
 *    (si falla, lanza un Error con el mensaje para el cliente). `total`: los
 *    gajos de la rueda donde va a parar, si quien gira tuvo que cambiarla
 *    (el premio no estaba en la rueda cargada)
 *  - onParar(r): cuando la rueda se detiene, con lo que dio onGirar; si
 *    devuelve una promesa (las monedas volando), la hoja no se cierra hasta
 *    que termine
 *  - sesion · estado: 'cargando' | 'cerrada' | 'preparacion' | 'error'
 *    (con onReintentar) · error: un aviso bajo la rueda
 *  - resultadoInicial: lo de onGirar, para abrir la hoja sin girar (el modo diseño)
 *  - ayudaVista · onAyudaVista · urlLogin · urlCupones
 * Los textos pasan por la traducción.
 */
export function PaginaRuleta({
  premios = [], tema = {}, reglas = {}, eleccion = {}, historial: historialInicial = SIN_HISTORIAL, hasta, onGirar, onParar, sesion = true,
  estado, error: errorCarga, onReintentar, resultadoInicial = null, ayudaVista = true, onAyudaVista, urlLogin = '/login', urlCupones = '/cuenta/cupones',
}) {
  const [rotacion, setRotacion] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [girando, setGirando] = useState(false);
  const [ganado, setGanado] = useState(resultadoInicial);
  const [abierto, setAbierto] = useState(Boolean(resultadoInicial));
  const [entregando, setEntregando] = useState(false);
  const [historial, setHistorial] = useState(historialInicial);
  const [error, setError] = useState('');
  const [ayuda, setAyuda] = useState(!ayudaVista);
  const temporizador = useRef(null);
  useEffect(() => () => clearTimeout(temporizador.current), []);
  // El historial puede llegar después (o refrescarse): se toma mientras no se haya girado aquí.
  useEffect(() => { if (!ganado) setHistorial(historialInicial); }, [historialInicial]); // eslint-disable-line react-hooks/exhaustive-deps

  const siempre = reglas.modoDesbloqueo === 'siempre';
  const { desbloqueada = false, girada: giradaAntes = false, perdida = false, pendienteAnterior = false } = eleccion;
  const dias = Math.max(0, Math.min(7, Number(eleccion.dias) || 0));
  const girada = giradaAntes || Boolean(ganado);
  const premio = ganado?.premio;
  const nada = premio?.tipo === 'nada';
  const faltan = 7 - dias;
  let textoBoton = 'Girar la ruleta';
  if (girando) textoBoton = 'Girando…';
  else if (girada) textoBoton = 'Ya giraste esta semana';
  else if (!desbloqueada && perdida) textoBoton = 'Semana perdida';
  else if (!desbloqueada) textoBoton = `Bloqueada: te ${faltan === 1 ? 'falta 1 día' : `faltan ${faltan} días`}`;
  const t = {
    compartir: useTexto(premio?.texto ? `¡Gané ${premio.texto} en la Ruleta Semanal de Walá!` : undefined),
    premio: useTexto(premio?.texto),
  };

  if (estado === 'cargando') return <EsqueletoPagina forma="ruleta" />;

  const ayudaNodo = (
    <AyudaJuego
      abierta={ayuda}
      onCerrar={() => { setAyuda(false); onAyudaVista?.(); }}
      boton="Entendido"
      intro={siempre ? 'Un giro por semana, cortesía de la casa. Los premios cambian según el día.' : 'La ruleta no se juega: se gana. Es el premio de mantener tu racha con Kapi toda la semana.'}
      pasos={siempre
        ? ['Tienes un giro cada semana, sin condiciones.', 'Al girar, se acaba hasta la semana siguiente.']
        : ['Alimenta a Kapi todos los días, de lunes a domingo.', 'Si te saltas un día, la semana se pierde y el contador vuelve a empezar el lunes.', 'Al completar los 7 días ganas un giro.', 'Un giro por semana: al girar, se acaba hasta la siguiente.']}
      pie="Si ganas el giro y no lo usas, no lo pierdes: sigue disponible durante la semana siguiente. El premio lo decide el servidor y se acredita solo en tu cuenta."
    />
  );

  if (!sesion || estado === 'cerrada' || estado === 'preparacion' || estado === 'error') {
    let vacio;
    if (!sesion) {
      vacio = (
        <EstadoVacio imagen={CARAS_KAPI.feliz} titulo={<Texto>Inicia sesión para girar la ruleta</Texto>} texto={<Texto>La ruleta es el premio de tu racha con Kapi: entra para ver cuántos días llevas.</Texto>}>
          <Boton to={urlLogin} icono={<LogIn aria-hidden="true" />}><Texto>Iniciar sesión</Texto></Boton>
        </EstadoVacio>
      );
    } else if (estado === 'error') {
      vacio = (
        <EstadoVacio imagen={CARAS_KAPI.triste} titulo={<Texto>No pudimos cargar la ruleta</Texto>} texto={<Texto>{errorCarga || 'Revisa tu conexión e inténtalo otra vez.'}</Texto>}>
          {onReintentar && <Boton onClick={onReintentar} icono={<RotateCcw aria-hidden="true" />}><Texto>Reintentar</Texto></Boton>}
          <Boton to="/minijuegos" variante="secundario" icono={<Gamepad2 aria-hidden="true" />}><Texto>Ver otros juegos</Texto></Boton>
        </EstadoVacio>
      );
    } else {
      vacio = (
        <EstadoVacio
          imagen={CARAS_KAPI.triste}
          titulo={<Texto>{estado === 'cerrada' ? 'La ruleta está cerrada por ahora' : 'La ruleta está en preparación'}</Texto>}
          texto={<Texto>Tu progreso no se pierde: cuando la abramos, tu giro seguirá aquí esperándote.</Texto>}
        >
          <Boton to="/minijuegos" icono={<Gamepad2 aria-hidden="true" />}><Texto>Ver otros juegos</Texto></Boton>
        </EstadoVacio>
      );
    }
    return (
      <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
        <MarcoJuego titulo="Ruleta Semanal" onAyuda={() => setAyuda(true)} ancho="md">
          {vacio}
        </MarcoJuego>
        {ayudaNodo}
      </BloqueSeccion>
    );
  }

  const girar = async () => {
    setGirando(true);
    setError('');
    try {
      const r = await onGirar?.();
      const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const vueltas = reducir ? 1 : Math.max(2, Math.min(12, Number(reglas.vueltas) || 4));
      const ms = reducir ? 600 : Math.max(1500, Math.min(10000, Number(reglas.duracionGiroMs) || 3500));
      const indice = Math.max(0, r?.indice ?? 0);
      setDuracion(ms);
      setRotacion((actual) => actual - (actual % 360) + anguloDeParada(indice, r?.total || premios.length, vueltas));
      temporizador.current = setTimeout(async () => {
        setGirando(false);
        setGanado(r);
        setAbierto(true);
        setHistorial((h) => [{ id: `nuevo-${Date.now()}`, tipo: r?.premio?.tipo, texto: r?.premio?.texto, cupon: r?.cupon?.codigo, fecha: r?.fecha || 'hoy' }, ...h]);
        if (!onParar) return;
        setEntregando(true);
        try { await onParar(r); } catch { /* lo avisa quien entrega */ } finally { setEntregando(false); }
      }, ms + 120);
    } catch (e) {
      setGirando(false);
      setError(e?.message || 'Ocurrió un error al girar la ruleta.');
    }
  };

  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
        <MarcoJuego titulo="Ruleta Semanal" onAyuda={() => setAyuda(true)}>
          <div className={s.ruleta} data-componente="PaginaRuleta">
            <div className={s.zonaRueda}>
              {!siempre && (
                <div className={s.racha}>
                  <BarraProgreso pasos valor={dias} max={7} etiqueta={<Texto>Tu racha con Kapi</Texto>} />
                  <p className={s.rachaNota}>
                    <Texto>
                      {girada ? 'Ya usaste el giro de esta semana.'
                        : desbloqueada ? (pendienteAnterior ? 'Este giro es el que ganaste la semana pasada. ¡Aprovéchalo!' : '¡Completaste la semana! Tu giro te espera.')
                          : perdida ? 'Perdiste un día esta semana. El lunes empieza otra.'
                            : 'Alimenta a Kapi cada día: al séptimo, la ruleta se abre.'}
                    </Texto>
                  </p>
                </div>
              )}
              <RuedaRuleta premios={premios} colores={tema.colores} colorAro={tema.colorAro} colorPuntero={tema.colorPuntero} imagenCentro={tema.imagenCentro} rotacion={rotacion} duracion={duracion} />
              {(errorCarga || error) && <Aviso tipo="error" compacto><Texto>{error || errorCarga}</Texto></Aviso>}
              <div className={s.controles}>
                <Boton tamano="lg" bloque brillo={desbloqueada && !girada && !girando} cargando={girando} disabled={!desbloqueada || girada || girando} onClick={girar}>
                  {textoBoton}
                </Boton>
                {girada && hasta && <p className={s.notaSuave}><CuentaRegresiva hasta={hasta} variante="frase" etiqueta="Vuelve el lunes, en" textoFin="¡Ya empezó otra semana!" /></p>}
              </div>
            </div>
            <aside className={s.lado}>
              <HistorialRuleta historial={historial} urlCupones={urlCupones} />
            </aside>
          </div>
        </MarcoJuego>
      </BloqueSeccion>
      {ayudaNodo}
      <ResultadoJuego
        abierta={abierto}
        onCerrar={() => setAbierto(false)}
        ocupado={entregando}
        titulo={nada ? '¡Casi!' : '¡Felicidades!'}
        tituloHoja="Tu giro"
        imagen={nada ? CARAS_KAPI.triste : CARAS_KAPI.feliz}
        texto={(
          <p>
            {nada
              ? <Texto>{premio?.texto || 'Esta vez no salió premio.'}</Texto>
              : <TextoResaltado resaltar={[t.premio]}>{`Ganaste ${premio?.texto || ''}.`}</TextoResaltado>}
          </p>
        )}
        acciones={(
          <>
            {!nada && (
              <Boton bloque icono={<Share2 aria-hidden="true" />} onClick={() => compartirTexto(t.compartir)}><Texto>Compartir mi premio</Texto></Boton>
            )}
            <Boton bloque variante="secundario" onClick={() => setAbierto(false)} disabled={entregando}><Texto>Entendido</Texto></Boton>
          </>
        )}
      >
        {premio?.tipo === 'monedas' && <PremioJuego estado={entregando ? 'acreditando' : 'acreditado'} monto={premio.monedas} />}
        {ganado?.cupon && (
          <CodigoCopiable codigo={ganado.cupon.codigo} rotulo="Tu cupón" detalle={ganado.cupon.vence ? `Válido hasta el ${ganado.cupon.vence}` : undefined} />
        )}
        {premio?.tipo === 'manual' && <p className={s.notaSuave}><Texto>Nos pondremos en contacto contigo para entregártelo.</Texto></p>}
        {ganado?.cupon && <Boton to={urlCupones} variante="fantasma" tamano="sm"><Texto>Ver mis cupones</Texto></Boton>}
      </ResultadoJuego>
    </>
  );
}
