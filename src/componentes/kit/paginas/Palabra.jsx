import React, { useEffect, useRef, useState } from 'react';
import { Share2, Gamepad2, Trophy } from 'lucide-react';
import Boton from '../Boton';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import CuentaRegresiva from '../CuentaRegresiva';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { MarcoJuego, AyudaJuego, PremioJuego, ResultadoJuego, CifrasJuego, TextoResaltado, compartirTexto } from '../piezas/Juegos';
import {
  TableroPalabra, TecladoPalabra, RankingPalabra, LeyendaPalabra, evaluarIntento, estadosDeTeclas, normalizarPalabra, INTENTOS_PALABRA,
} from '../piezas/Palabra';
import { Texto, useTexto } from '../Traduccion';
import s from './Juegos.module.css';

/* ── Palabra del día (/palabra-del-dia) ─────────────────── */

/**
 * La Palabra del día: 6 intentos para adivinar la palabra. Se escribe con el
 * teclado en pantalla o el de la computadora; se puede tocar una casilla para
 * corregirla.
 *  - objetivo: la palabra de hoy · esValida(palabra): ¿existe? (el diccionario)
 *  - inicial: { filas: ['CASAS', …], inicio } lo jugado hoy (se restaura; inicio:
 *    ms de la primera tecla, para el tiempo) y/o { terminada: { gano, intentos,
 *    palabra } } si el servidor dice que ya jugó
 *  - sesion · estadisticas: { jugadas, victorias, racha, mejorRacha }
 *  - ranking: { hoy, global } (RankingPalabra) · cargandoRanking
 *  - hasta: ISO de la próxima palabra (medianoche de Lima)
 *  - onIntento({ palabras, inicio }): tras cada intento enviado, todas las de
 *    hoy y cuándo empezó (para guardarlas y seguir después)
 *  - onTerminar({ gano, intentos, segundos }): guarda la partida y cobra;
 *    promesa → { monto, rapido } | { ya: true } | null. Si falla, lanza un
 *    Error con el mensaje para el cliente (con sesión se ve, gane o pierda)
 *  - ayudaVista: false la primera vez (la ayuda se abre sola) · onAyudaVista
 *  - estado: 'cargando'
 * Los textos pasan por la traducción.
 */
export function PaginaPalabra({
  objetivo = '', esValida, inicial = {}, sesion = false, estadisticas, ranking = {}, cargandoRanking = false, hasta,
  onIntento, onTerminar, ayudaVista = true, onAyudaVista, urlLogin = '/login', estado,
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
  const inicio = useRef(inicial.inicio || null);
  const tiempos = useRef([]);
  useEffect(() => () => tiempos.current.forEach(clearTimeout), []);
  const despues = (ms, fn) => { tiempos.current.push(setTimeout(fn, ms)); };
  const t = {
    faltan: useTexto('Faltan letras'),
    noExiste: useTexto('Esa palabra no está en el diccionario'),
    compartir: useTexto(`Adiviné la Palabra del día de Walá en ${intentos}/${INTENTOS_PALABRA}. ¿Te animas? wala.pe/palabra-del-dia`),
  };

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
    } catch (e) {
      if (sesion) setPremio({ estado: 'error', texto: e?.message });
    }
  };

  const tecla = (letra) => {
    if (!jugando || revelando >= 0) return;
    if (!inicio.current) inicio.current = Date.now();
    if (letra === 'BORRAR') {
      if (actual[indice]) setActual((a) => a.map((l, i) => (i === indice ? '' : l)));
      else if (indice > 0) { setActual((a) => a.map((l, i) => (i === indice - 1 ? '' : l))); setIndice(indice - 1); }
      return;
    }
    if (letra === 'ENVIAR') {
      if (actual.some((l) => !l)) { avisar(t.faltan); return; }
      const palabra = actual.join('');
      if (esValida && !esValida(palabra)) { avisar(t.noExiste); return; }
      const fila = { letras: [...actual], evaluacion: evaluarIntento(palabra, obj) };
      const n = filas.length + 1;
      setFilas((f) => [...f, fila]);
      onIntento?.({ palabras: [...filas.map((f) => f.letras.join('')), palabra], inicio: inicio.current });
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
    setActual((a) => a.map((l, i) => (i === indice ? letra : l)));
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
  const palabraFinal = terminadaAntes?.palabra || obj;
  const textoFinal = ganada ? (
    <p>
      <TextoResaltado resaltar={[intentos]}>
        {intentos === 1 ? 'Lo lograste en 1 intento.' : `Lo lograste en ${intentos} intentos.`}
      </TextoResaltado>
    </p>
  ) : (
    <p><Texto>La palabra era</Texto> <strong>{palabraFinal}</strong>.</p>
  );
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
                  <p className={s.finNota}>{nuevaPalabra || <Texto>Vuelve mañana para una palabra nueva.</Texto>}</p>
                  <Boton variante="secundario" icono={<Trophy aria-hidden="true" />} onClick={() => setResultado(true)}><Texto>Ver mi resultado</Texto></Boton>
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
          <TextoResaltado key="adivina" resaltar={[largo, INTENTOS_PALABRA]}>
            {`Adivina la palabra oculta de ${largo} letras. Tienes ${INTENTOS_PALABRA} intentos.`}
          </TextoResaltado>,
          'Escribe con el teclado de abajo (o con el de tu computadora) y pulsa Enviar. Toca una casilla para corregirla.',
          'Cada intento tiene que ser una palabra que exista.',
        ]}
        pie={sesion
          ? 'Hay una palabra nueva cada día a la medianoche (hora de Perú).'
          : 'Hay una palabra nueva cada día a la medianoche (hora de Perú). Inicia sesión para guardar tu racha y aparecer en el ranking.'}
      >
        <p className={s.ayudaTexto}><Texto>Después de cada intento, los colores te dicen qué tan cerca estuviste:</Texto></p>
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
              <Boton bloque icono={<Share2 aria-hidden="true" />} onClick={() => compartirTexto(t.compartir)}>
                <Texto>Compartir mi resultado</Texto>
              </Boton>
            )}
            <Boton bloque variante="secundario" to="/minijuegos" icono={<Gamepad2 aria-hidden="true" />} disabled={premio?.estado === 'acreditando'}><Texto>Ver otros juegos</Texto></Boton>
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
