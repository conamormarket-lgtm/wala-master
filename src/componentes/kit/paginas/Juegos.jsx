import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGroup } from 'framer-motion';
import { Share2, Gamepad2, RotateCcw, Undo2, Eye, LogIn, Trophy } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio } from '../Feedback';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import CuentaRegresiva from '../CuentaRegresiva';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { BarraProgreso } from '../piezas/BarraProgreso';
import { CodigoCopiable } from '../piezas/Legales';
import { MarcoJuego, AyudaJuego, PremioJuego, ResultadoJuego, CifrasJuego } from '../piezas/Juegos';
import {
  TableroPalabra, TecladoPalabra, RankingPalabra, LeyendaPalabra, evaluarIntento, estadosDeTeclas, normalizarPalabra, INTENTOS_PALABRA,
} from '../piezas/Palabra';
import { RuedaRuleta, HistorialRuleta } from '../piezas/Ruleta';
import {
  TuboBolitas, nivelBolitas, puedeSoltar, moverBolita, tuboListo, nivelResuelto, COLORES_BOLITAS, CAPACIDAD_TUBO,
} from '../piezas/Bolitas';
import { anguloDeParada } from '../../../utils/ruletaModel';
import s from './Juegos.module.css';

/*
 * Los minijuegos por dentro: la Palabra del día (/palabra-del-dia), la
 * Ruleta Semanal (/ruleta) y Las Bolitas de Kapi (/ball-sort). Cada uno en
 * MarcoJuego, con "Cómo se juega" (se abre solo la primera vez) y la hoja del
 * resultado. El premio lo decide el servidor: la página solo dice cómo va.
 */

const compartir = async (texto) => {
  try {
    if (navigator.share) { await navigator.share({ text: texto }); return true; }
    await navigator.clipboard.writeText(texto);
    return true;
  } catch { return false; }
};

/* ── Palabra del día ────────────────────────────────────── */

/**
 * La Palabra del día: 6 intentos para adivinar la palabra. Se escribe con el
 * teclado en pantalla o el de la computadora; se puede tocar una casilla para
 * corregirla.
 *  - objetivo: la palabra de hoy · esValida(palabra): ¿existe? (el diccionario)
 *  - inicial: { filas: ['CASAS', …] } lo jugado hoy (se restaura) o
 *    { terminada: { gano, intentos, palabra } } si el servidor dice que ya jugó
 *  - sesion · estadisticas: { jugadas, victorias, racha, mejorRacha }
 *  - ranking: { hoy, global } (RankingPalabra) · cargandoRanking
 *  - hasta: ISO de la próxima palabra (medianoche de Lima)
 *  - onTerminar({ gano, intentos, segundos }): guarda la partida y cobra;
 *    promesa → { monto, rapido } | { ya: true } | null
 *  - ayudaVista: false la primera vez (la ayuda se abre sola) · onAyudaVista
 *  - estado: 'cargando'
 */
export function PaginaPalabra({
  objetivo = '', esValida, inicial = {}, sesion = false, estadisticas, ranking = {}, cargandoRanking = false, hasta,
  onTerminar, ayudaVista = true, onAyudaVista, urlLogin = '/login', estado,
}) {
  const obj = normalizarPalabra(objetivo);
  const largo = [...obj].length || 5;
  const [filas, setFilas] = useState(() => (inicial.filas || []).map((p) => ({ letras: [...normalizarPalabra(p)], evaluacion: evaluarIntento(p, obj) })));
  const terminadaAntes = inicial.terminada;
  const ganada = filas.some((f) => f.letras.join('') === obj) || Boolean(terminadaAntes?.gano);
  const jugando = !ganada && filas.length < INTENTOS_PALABRA && !terminadaAntes;
  const intentos = terminadaAntes?.intentos || filas.length;
  const [actual, setActual] = useState(() => Array(largo).fill(''));
  const [indice, setIndice] = useState(0);
  const [sacudir, setSacudir] = useState(0);
  const [mensaje, setMensaje] = useState(null);
  const [revelando, setRevelando] = useState(-1);
  const [ayuda, setAyuda] = useState(() => !ayudaVista && jugando);
  const [resultado, setResultado] = useState(() => !jugando);
  const [premio, setPremio] = useState(null);
  const [pestana, setPestana] = useState('hoy');
  const inicio = useRef(null);
  const tiempos = useRef([]);
  useEffect(() => () => tiempos.current.forEach(clearTimeout), []);
  const despues = (ms, fn) => { tiempos.current.push(setTimeout(fn, ms)); };

  const avisar = (texto) => {
    setSacudir((n) => n + 1);
    setMensaje({ texto, id: Date.now() });
    despues(1900, () => setMensaje((m) => (m && Date.now() - m.id >= 1800 ? null : m)));
  };

  const terminar = async (gano, n) => {
    const segundos = inicio.current ? Math.round((Date.now() - inicio.current) / 1000) : 0;
    setResultado(true);
    if (gano && !sesion) setPremio({ estado: 'sinSesion' });
    if (gano && sesion) setPremio({ estado: 'acreditando' });
    try {
      const r = await onTerminar?.({ gano, intentos: n, segundos });
      if (!gano || !sesion) return;
      if (r?.ya) setPremio({ estado: 'ya' });
      else if (r?.monto) setPremio({ estado: 'acreditado', monto: r.monto, texto: r.rapido ? 'acreditadas. ¡Bonus por acertar rápido!' : undefined });
      else setPremio(null);
    } catch {
      if (gano && sesion) setPremio({ estado: 'error' });
    }
  };

  const tecla = (t) => {
    if (!jugando || revelando >= 0) return;
    if (!inicio.current) inicio.current = Date.now();
    if (t === 'BORRAR') {
      if (actual[indice]) setActual((a) => a.map((l, i) => (i === indice ? '' : l)));
      else if (indice > 0) { setActual((a) => a.map((l, i) => (i === indice - 1 ? '' : l))); setIndice(indice - 1); }
      return;
    }
    if (t === 'ENVIAR') {
      if (actual.some((l) => !l)) { avisar('Faltan letras'); return; }
      const palabra = actual.join('');
      if (esValida && !esValida(palabra)) { avisar('Esa palabra no está en el diccionario'); return; }
      const fila = { letras: [...actual], evaluacion: evaluarIntento(palabra, obj) };
      const n = filas.length + 1;
      setFilas((f) => [...f, fila]);
      setRevelando(n - 1);
      setActual(Array(largo).fill(''));
      setIndice(0);
      const gano = palabra === obj;
      despues(largo * 140 + 520, () => {
        setRevelando(-1);
        if (gano || n >= INTENTOS_PALABRA) terminar(gano, n);
      });
      return;
    }
    setActual((a) => a.map((l, i) => (i === indice ? t : l)));
    // La siguiente casilla vacía (o la siguiente, si están todas llenas).
    const siguiente = actual.findIndex((l, i) => i > indice && !l);
    setIndice(siguiente >= 0 ? siguiente : Math.min(indice + 1, largo - 1));
  };

  // El teclado de la computadora.
  const teclaRef = useRef(tecla);
  teclaRef.current = tecla;
  useEffect(() => {
    if (estado === 'cargando') return undefined;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || ayuda || resultado) return;
      if (e.target?.closest?.('input, textarea, [contenteditable]')) return;
      if (e.key === 'Enter') { e.preventDefault(); teclaRef.current('ENVIAR'); } else if (e.key === 'Backspace') { e.preventDefault(); teclaRef.current('BORRAR'); } else if (/^[a-zñ]$/i.test(e.key)) teclaRef.current(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ayuda, resultado, estado]);

  if (estado === 'cargando') return <EsqueletoPagina forma="palabra" />;

  const cerrarAyuda = () => { setAyuda(false); onAyudaVista?.(); };
  const textoFinal = ganada
    ? <p>Lo lograste en <strong>{intentos}</strong> {intentos === 1 ? 'intento' : 'intentos'}.</p>
    : <p>La palabra era <strong>{terminadaAntes?.palabra || obj}</strong>.</p>;
  const nuevaPalabra = hasta && <CuentaRegresiva hasta={hasta} variante="frase" etiqueta="Nueva palabra en" textoFin="¡Ya hay palabra nueva!" />;

  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
        <MarcoJuego titulo="La Palabra del Día" onAyuda={() => setAyuda(true)}>
          <div className={s.palabra} data-componente="PaginaPalabra">
            <div className={s.juego}>
              <div className={s.mensajeZona} aria-live="polite">
                {mensaje && <span key={mensaje.id} className={s.mensaje}>{mensaje.texto}</span>}
              </div>
              <TableroPalabra largo={largo} filas={filas} actual={actual} indice={indice} onIndice={jugando ? setIndice : undefined} sacudir={sacudir} revelando={revelando} jugando={jugando} />
              {jugando ? (
                <TecladoPalabra estados={estadosDeTeclas(filas)} onTecla={tecla} />
              ) : revelando < 0 && (
                <div className={s.fin}>
                  {textoFinal}
                  <p className={s.finNota}>{nuevaPalabra || 'Vuelve mañana para una palabra nueva.'}</p>
                  <Boton variante="secundario" icono={<Trophy aria-hidden="true" />} onClick={() => setResultado(true)}>Ver mi resultado</Boton>
                </div>
              )}
            </div>
            <aside className={s.lado}>
              <RankingPalabra hoy={ranking.hoy} global={ranking.global} pestana={pestana} onPestana={setPestana} cargando={cargandoRanking} />
            </aside>
          </div>
        </MarcoJuego>
      </BloqueSeccion>

      <AyudaJuego
        abierta={ayuda}
        onCerrar={cerrarAyuda}
        pasos={[
          <>Adivina la palabra oculta de <strong>{largo}</strong> letras. Tienes <strong>{INTENTOS_PALABRA}</strong> intentos.</>,
          'Escribe con el teclado de abajo (o con el de tu computadora) y pulsa Enviar. Toca una casilla para corregirla.',
          'Cada intento tiene que ser una palabra que exista.',
        ]}
        pie={<>Hay una palabra nueva cada día a la medianoche (hora de Perú).{!sesion && ' Inicia sesión para guardar tu racha y aparecer en el ranking.'}</>}
      >
        <p className={s.ayudaTexto}>Después de cada intento, los colores te dicen qué tan cerca estuviste:</p>
        <LeyendaPalabra />
      </AyudaJuego>

      <ResultadoJuego
        abierta={resultado && revelando < 0}
        onCerrar={() => setResultado(false)}
        ocupado={premio?.estado === 'acreditando'}
        titulo={ganada ? '¡Lo lograste!' : 'Esta vez no'}
        imagen={ganada ? CARAS_KAPI.feliz : CARAS_KAPI.triste}
        texto={textoFinal}
        acciones={(
          <>
            {ganada && (
              <Boton bloque icono={<Share2 aria-hidden="true" />} onClick={() => compartir(`Adiviné la Palabra del día de Walá en ${intentos}/${INTENTOS_PALABRA}. ¿Te animas? wala.pe/palabra-del-dia`)}>
                Compartir mi resultado
              </Boton>
            )}
            <Boton bloque variante="secundario" to="/minijuegos" icono={<Gamepad2 aria-hidden="true" />}>Ver otros juegos</Boton>
          </>
        )}
      >
        {premio && <PremioJuego {...premio} urlLogin={urlLogin} texto={premio.estado === 'sinSesion' ? 'Inicia sesión para guardar tu racha, aparecer en el ranking y ganar monedas.' : premio.texto} />}
        {sesion && estadisticas && (
          <CifrasJuego cifras={[
            { etiqueta: 'Jugadas', valor: estadisticas.jugadas },
            { etiqueta: 'Victorias', valor: estadisticas.victorias },
            { etiqueta: 'Racha', valor: estadisticas.racha },
            { etiqueta: 'Mejor racha', valor: estadisticas.mejorRacha },
          ]}
          />
        )}
        {nuevaPalabra && <p className={s.notaSuave}>{nuevaPalabra}</p>}
      </ResultadoJuego>
    </>
  );
}

/* ── Ruleta Semanal ─────────────────────────────────────── */

/**
 * La Ruleta Semanal: se gana un giro por semana con la racha de Kapi (7 días).
 * La racha se ve arriba de la rueda; el premio lo sortea el servidor y la
 * rueda para en su gajo (anguloDeParada).
 *  - premios: los de hoy, en el orden del servidor ({ id, nombre, etiqueta, color })
 *  - tema: { colores, colorAro, colorPuntero } · reglas: { vueltas, duracionGiroMs, modoDesbloqueo }
 *  - eleccion: { desbloqueada, girada, perdida, pendienteAnterior, dias }
 *  - historial: HistorialRuleta · hasta: ISO del próximo lunes (Lima)
 *  - onGirar(): promesa → { indice, premio: { tipo, texto, monedas }, cupon: { codigo, vence } }
 *  - sesion · estado: 'cargando' | 'cerrada' | 'preparacion' · error
 *  - ayudaVista · onAyudaVista
 */
export function PaginaRuleta({
  premios = [], tema = {}, reglas = {}, eleccion = {}, historial: historialInicial = [], hasta, onGirar, sesion = true,
  estado, error: errorCarga, ayudaVista = true, onAyudaVista, urlLogin = '/login', urlCupones = '/cuenta/cupones',
}) {
  const [rotacion, setRotacion] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [girando, setGirando] = useState(false);
  const [ganado, setGanado] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [historial, setHistorial] = useState(historialInicial);
  const [error, setError] = useState('');
  const [ayuda, setAyuda] = useState(!ayudaVista);
  const temporizador = useRef(null);
  useEffect(() => () => clearTimeout(temporizador.current), []);

  const siempre = reglas.modoDesbloqueo === 'siempre';
  const { desbloqueada = false, girada: giradaAntes = false, perdida = false, pendienteAnterior = false } = eleccion;
  const dias = Math.max(0, Math.min(7, Number(eleccion.dias) || 0));
  const girada = giradaAntes || Boolean(ganado);

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

  if (!sesion || estado === 'cerrada' || estado === 'preparacion') {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
        <MarcoJuego titulo="Ruleta Semanal" onAyuda={() => setAyuda(true)} ancho="md">
          {!sesion ? (
            <EstadoVacio imagen={CARAS_KAPI.feliz} titulo="Inicia sesión para girar la ruleta" texto="La ruleta es el premio de tu racha con Kapi: entra para ver cuántos días llevas.">
              <Boton to={urlLogin} icono={<LogIn aria-hidden="true" />}>Iniciar sesión</Boton>
            </EstadoVacio>
          ) : (
            <EstadoVacio
              imagen={CARAS_KAPI.triste}
              titulo={estado === 'cerrada' ? 'La ruleta está cerrada por ahora' : 'La ruleta está en preparación'}
              texto="Tu progreso no se pierde: cuando la abramos, tu giro seguirá aquí esperándote."
            >
              <Boton to="/minijuegos" icono={<Gamepad2 aria-hidden="true" />}>Ver otros juegos</Boton>
            </EstadoVacio>
          )}
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
      setRotacion((actual) => actual - (actual % 360) + anguloDeParada(indice, premios.length, vueltas));
      temporizador.current = setTimeout(() => {
        setGirando(false);
        setGanado(r);
        setAbierto(true);
        setHistorial((h) => [{ id: `nuevo-${Date.now()}`, tipo: r?.premio?.tipo, texto: r?.premio?.texto, cupon: r?.cupon?.codigo, fecha: 'hoy' }, ...h]);
      }, ms + 120);
    } catch (e) {
      setGirando(false);
      setError(e?.message || 'Ocurrió un error al girar la ruleta.');
    }
  };

  const faltan = 7 - dias;
  let textoBoton = 'Girar la ruleta';
  if (girando) textoBoton = 'Girando…';
  else if (girada) textoBoton = 'Ya giraste esta semana';
  else if (!desbloqueada && perdida) textoBoton = 'Semana perdida';
  else if (!desbloqueada) textoBoton = `Bloqueada: te ${faltan === 1 ? 'falta 1 día' : `faltan ${faltan} días`}`;

  const premio = ganado?.premio;
  const nada = premio?.tipo === 'nada';
  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
        <MarcoJuego titulo="Ruleta Semanal" onAyuda={() => setAyuda(true)}>
          <div className={s.ruleta} data-componente="PaginaRuleta">
            <div className={s.zonaRueda}>
              {!siempre && (
                <div className={s.racha}>
                  <BarraProgreso pasos valor={dias} max={7} etiqueta="Tu racha con Kapi" />
                  <p className={s.rachaNota}>
                    {girada ? 'Ya usaste el giro de esta semana.'
                      : desbloqueada ? (pendienteAnterior ? 'Este giro es el que ganaste la semana pasada. ¡Aprovéchalo!' : '¡Completaste la semana! Tu giro te espera.')
                        : perdida ? 'Perdiste un día esta semana. El lunes empieza otra.'
                          : 'Alimenta a Kapi cada día: al séptimo, la ruleta se abre.'}
                  </p>
                </div>
              )}
              <RuedaRuleta premios={premios} colores={tema.colores} colorAro={tema.colorAro} colorPuntero={tema.colorPuntero} rotacion={rotacion} duracion={duracion} />
              {(errorCarga || error) && <Aviso tipo="error" compacto>{error || errorCarga}</Aviso>}
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
        titulo={nada ? '¡Casi!' : '¡Felicidades!'}
        tituloHoja="Tu giro"
        imagen={nada ? CARAS_KAPI.triste : CARAS_KAPI.feliz}
        texto={<p>{nada ? (premio?.texto || 'Esta vez no salió premio.') : <>Ganaste <strong>{premio?.texto}</strong>.</>}</p>}
        acciones={(
          <>
            {!nada && (
              <Boton bloque icono={<Share2 aria-hidden="true" />} onClick={() => compartir(`¡Gané ${premio?.texto} en la Ruleta Semanal de Walá!`)}>Compartir mi premio</Boton>
            )}
            <Boton bloque variante="secundario" onClick={() => setAbierto(false)}>Entendido</Boton>
          </>
        )}
      >
        {premio?.tipo === 'monedas' && <PremioJuego estado="acreditado" monto={premio.monedas} />}
        {ganado?.cupon && (
          <CodigoCopiable codigo={ganado.cupon.codigo} rotulo="Tu cupón" detalle={ganado.cupon.vence && `Válido hasta el ${ganado.cupon.vence}`} />
        )}
        {premio?.tipo === 'manual' && <p className={s.notaSuave}>Nos pondremos en contacto contigo para entregártelo.</p>}
        {ganado?.cupon && <Boton to={urlCupones} variante="fantasma" tamano="sm">Ver mis cupones</Boton>}
      </ResultadoJuego>
    </>
  );
}

/* ── Las Bolitas de Kapi ────────────────────────────────── */

/**
 * Las Bolitas de Kapi: ordenar los colores en los tubos. Se toca un tubo
 * para levantar su bolita de arriba y otro para soltarla; los tubos donde sí
 * se puede soltar se marcan. Ganar da monedas una vez al día.
 *  - sesion · yaHoy (ya cobró hoy) · monto (2)
 *  - onGanar({ movimientos }): promesa → { monto } | { ya: true }
 *  - colores, capacidad · nivelInicial (para repetir uno)
 *  - ayudaVista · onAyudaVista · estado: 'cargando'
 */
export function PaginaBolitas({
  sesion = true, yaHoy = false, monto = 2, onGanar, colores = COLORES_BOLITAS, capacidad = CAPACIDAD_TUBO, nivelInicial,
  ayudaVista = true, onAyudaVista, urlLogin = '/login', estado,
}) {
  const nuevo = useCallback(() => nivelBolitas({ colores, capacidad }), [colores, capacidad]);
  const [tubos, setTubos] = useState(() => nivelInicial || nuevo());
  const [elegido, setElegido] = useState(null);
  const [pasados, setPasados] = useState([]);
  const [resuelto, setResuelto] = useState(false);
  const [resultado, setResultado] = useState(false);
  const [premio, setPremio] = useState(null);
  const [cobrado, setCobrado] = useState(yaHoy);
  const [ayuda, setAyuda] = useState(!ayudaVista);
  const listos = useMemo(() => tubos.filter((t) => tuboListo(t, capacidad)).length, [tubos, capacidad]);

  if (estado === 'cargando') return <EsqueletoPagina forma="bolitas" />;

  const ganar = async (movimientos) => {
    setResuelto(true);
    setResultado(true);
    if (!sesion) { setPremio({ estado: 'sinSesion' }); return; }
    if (cobrado) { setPremio({ estado: 'ya' }); return; }
    setPremio({ estado: 'acreditando' });
    try {
      const r = await onGanar?.({ movimientos });
      setCobrado(true);
      setPremio(r?.ya ? { estado: 'ya' } : { estado: 'acreditado', monto: r?.monto || monto });
    } catch {
      setPremio({ estado: 'error' });
    }
  };

  const tocar = (i) => {
    if (resuelto) return;
    if (elegido === null) { if (tubos[i].length) setElegido(i); return; }
    if (elegido === i) { setElegido(null); return; }
    if (puedeSoltar(tubos, elegido, i, capacidad)) {
      const siguiente = moverBolita(tubos, elegido, i);
      setPasados((p) => [...p, tubos]);
      setTubos(siguiente);
      setElegido(null);
      if (nivelResuelto(siguiente, capacidad)) ganar(pasados.length + 1);
      return;
    }
    setElegido(tubos[i].length ? i : null);
  };

  const reiniciar = () => {
    setTubos(nuevo());
    setPasados([]);
    setElegido(null);
    setResuelto(false);
    setResultado(false);
    setPremio(null);
  };
  const deshacer = () => {
    if (!pasados.length || resuelto) return;
    setTubos(pasados[pasados.length - 1]);
    setPasados((p) => p.slice(0, -1));
    setElegido(null);
  };

  const promesa = !sesion
    ? <PremioJuego estado="sinSesion" urlLogin={urlLogin} />
    : cobrado
      ? <PremioJuego estado="ya" texto="Ya ganaste tus monedas hoy. Puedes seguir jugando por gusto." />
      : <PremioJuego estado="promesa" monto={monto} texto="al ordenar todos los tubos." />;

  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
        <MarcoJuego titulo="Las Bolitas de Kapi" onAyuda={() => setAyuda(true)}>
          <div className={s.bolitas} data-componente="PaginaBolitas">
            <div className={s.mesa}>
              <LayoutGroup>
                <div className={s.tubos} style={{ '--tubos': tubos.length }}>
                  {tubos.map((t, i) => (
                    <TuboBolitas
                      // eslint-disable-next-line react/no-array-index-key
                      key={i}
                      numero={i + 1}
                      bolas={t}
                      capacidad={capacidad}
                      elegido={elegido === i}
                      destino={elegido !== null && puedeSoltar(tubos, elegido, i, capacidad)}
                      listo={tuboListo(t, capacidad)}
                      onClick={() => tocar(i)}
                    />
                  ))}
                </div>
              </LayoutGroup>
              <div className={s.botonesMesa}>
                {resuelto ? (
                  <>
                    <Boton icono={<RotateCcw aria-hidden="true" />} onClick={reiniciar}>Jugar otra vez</Boton>
                    {!resultado && <Boton variante="secundario" icono={<Eye aria-hidden="true" />} onClick={() => setResultado(true)}>Ver resultado</Boton>}
                  </>
                ) : (
                  <>
                    <Boton variante="secundario" icono={<Undo2 aria-hidden="true" />} onClick={deshacer} disabled={!pasados.length}>Deshacer</Boton>
                    <Boton variante="fantasma" icono={<RotateCcw aria-hidden="true" />} onClick={reiniciar}>Otro nivel</Boton>
                  </>
                )}
              </div>
            </div>
            <aside className={s.lado}>
              <div className={s.panel}>
                {promesa}
                <CifrasJuego cifras={[{ etiqueta: 'Movimientos', valor: pasados.length }, { etiqueta: 'Tubos listos', valor: `${listos}/${colores.length}` }]} />
                <BarraProgreso pasos valor={listos} max={colores.length} etiqueta="Tubos listos" />
              </div>
            </aside>
          </div>
        </MarcoJuego>
      </BloqueSeccion>

      <AyudaJuego
        abierta={ayuda}
        onCerrar={() => { setAyuda(false); onAyudaVista?.(); }}
        intro={<>Hay <strong>{colores.length}</strong> colores repartidos en <strong>{tubos.length}</strong> tubos. Los tubos vacíos son tu espacio para maniobrar.</>}
        pasos={[
          'Toca un tubo para levantar su bolita de arriba.',
          'Toca otro tubo para soltarla ahí.',
          <>Un tubo está listo cuando tiene sus <strong>{capacidad}</strong> bolitas del mismo color. Ganas cuando lo están todos.</>,
        ]}
        pie={<>Mientras tienes una bolita levantada, los tubos donde sí puedes soltarla se marcan en verde. «Deshacer» vuelve un paso y «Otro nivel» reparte otra vez: el premio (<strong>+{monto} monedas</strong>) se gana una vez al día y sigue en juego.</>}
      >
        <p className={s.ayudaTexto}><strong>¿Dónde puedes soltar una bolita roja?</strong></p>
        <ul className={s.leyendaTubos}>
          <li><TuboBolitas chico capacidad={4} bolas={[]} /><span>Sí: el tubo está vacío.</span></li>
          <li><TuboBolitas chico capacidad={4} bolas={[{ id: 'a', color: colores[1] }, { id: 'b', color: colores[0] }]} /><span>Sí: arriba hay otra roja.</span></li>
          <li><TuboBolitas chico capacidad={4} bolas={[{ id: 'c', color: colores[0] }, { id: 'd', color: colores[2] }]} /><span>No: arriba hay otro color.</span></li>
        </ul>
      </AyudaJuego>

      <ResultadoJuego
        abierta={resultado}
        onCerrar={() => setResultado(false)}
        ocupado={premio?.estado === 'acreditando'}
        titulo="¡Nivel completado!"
        imagen={CARAS_KAPI.feliz}
        texto={<p>Lo resolviste en <strong>{pasados.length}</strong> {pasados.length === 1 ? 'movimiento' : 'movimientos'}.</p>}
        acciones={(
          <>
            <Boton bloque icono={<RotateCcw aria-hidden="true" />} onClick={reiniciar}>Jugar otra vez</Boton>
            <Boton bloque variante="secundario" to="/minijuegos" icono={<Gamepad2 aria-hidden="true" />}>Ver otros juegos</Boton>
          </>
        )}
      >
        {premio && <PremioJuego {...premio} urlLogin={urlLogin} />}
      </ResultadoJuego>
    </>
  );
}
