import React, { useEffect, useRef, useState } from 'react';
import {
  Gamepad2, RotateCcw, Undo2, Eye, Plus, ArrowRight, Map as IconoMapa, Crown, Lock, ChevronLeft, ChevronRight,
  Flame, Gift, Volume2, VolumeX, Vibrate, VibrateOff, Star, Trophy, Shirt, Film, Swords, Check,
} from 'lucide-react';
import Boton from '../Boton';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { Aviso, HojaInferior } from '../Feedback';
import { Pestanas } from '../Navegacion';
import { Estallido } from '../Efectos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { BarraProgreso } from '../piezas/BarraProgreso';
import { MarcoJuego, BotonIrAlPanel, AyudaJuego, PremioJuego, ResultadoJuego, CifrasJuego, TextoResaltado } from '../piezas/Juegos';
import { EstrellasNivel } from '../piezas/Bolitas';
import { CanchaPichanga, MuestraPichanga, MuestraEstadio, TablaPichanga, EQUIPO_RIVAL, PERSONAJES } from '../piezas/Pichanga';
import { FondoPichanga, escenaDelMundoPichanga, escenaDelEstadio } from '../piezas/FondoPichanga';
import { efectoPichanga } from '../piezas/efectosPichanga';
import {
  progresoPichanga, nuevosDesbloqueos, desbloqueado, textoDesbloqueo, estrellasTotales,
  EQUIPOS_PICHANGA, PELOTAS_PICHANGA, ESTADIOS_PICHANGA,
} from '../piezas/pichangaProgreso.mjs';
import {
  simular, jugarTiro, partidaNivel, indicePelota, mundoDe, infoMundo, esJefe, estrellasPara, premioCofre,
  RACHA_COFRE, AYUDAS_PICHANGA, partidoNuevo, canchaPartido, despuesDelTiroPartido, jugadaDeKapi, GOLES_PARTIDO, PASES_MAX, toquesUsados,
} from '../piezas/pichangaMotor.mjs';
import { nivelPichanga, retoPichanga, TOTAL_NIVELES_PICHANGA } from '../piezas/pichangaNiveles.mjs';
import { Texto, useTexto } from '../Traduccion';
import s from './Juegos.module.css';
import c from '../piezas/Pichanga.module.css';

/* ── La Pichanga de Kapi (/pichanga) ───────────────────── */

// Lo que se guarda del jugador y el vestuario: piezas/pichangaProgreso.mjs.
export { PROGRESO_PICHANGA, progresoPichanga, unirProgresos } from '../piezas/pichangaProgreso.mjs';

const TOTAL = TOTAL_NIVELES_PICHANGA;
const ULTIMO_MUNDO = mundoDe(TOTAL);
const CANCHA_PARTIDO = canchaPartido();
/** El pasto del reto del día (el estadio de día). */
const PASTO_RETO = ['#4ade80', '#3fc574'];

/* Cómo se explica cada obstáculo la primera vez que aparece. */
const OBSTACULOS = {
  rivales: { titulo: 'Nuevo: el equipo de Michi', texto: 'Las chapas rojas son del equipo de Michi, el gato. Estorban, pero también se pueden empujar: úsalas para rebotar.' },
  conos: { titulo: 'Nuevo: conos', texto: 'Los conos naranjas no se mueven. La pelota rebota en ellos: búscale el ángulo.' },
  kapi: { titulo: 'Nuevo: Michi de arquero', texto: 'Michi cuida el arco y va de lado a lado mientras la pelota rueda. Míralo bien antes de tirar: se mueve después de que sueltas.' },
  barro: { titulo: 'Nuevo: barro', texto: 'En el barro todo frena. Tira con más fuerza o pasa por un costado.' },
  hielo: { titulo: 'Nuevo: hielo', texto: 'En el hielo todo resbala y llega más lejos. Tira suave.' },
  arcoChico: { titulo: 'Nuevo: arco chico', texto: 'Desde aquí el arco es más angosto. Apunta fino: los postes también rebotan.' },
};

const NOMBRE_AYUDA = { vista: ['vista del tiro', 'vistas del tiro'], repetir: ['tiro para repetir', 'tiros para repetir'], toque: ['toque de más', 'toques de más'] };
const textoAyuda = (tipo, n) => `${n} ${NOMBRE_AYUDA[tipo][n === 1 ? 0 : 1]}`;
const CLASE = { equipo: 'equipo', pelota: 'pelota', estadio: 'cancha' };

const buscar = (lista, id) => lista.find((i) => i.id === id) || lista[0];

/** ¿Se perdió ya con estos toques de más? (los penales: si ya no alcanzan los goles). */
const perdidaCon = (lv, partida, extras) => {
  if (partida.ganada) return false;
  if (lv.penales) return partida.goles + (lv.penales.tiros + extras - partida.tiros.length) < lv.penales.goles;
  return partida.tiros.length >= lv.toques + extras;
};

/** Una partida nueva: clave = el número del nivel o 'reto:AAAA-MM-DD'. */
const juegoNuevo = (clave) => {
  const lv = typeof clave === 'string' && clave.startsWith('reto:') ? retoPichanga(clave.slice(5)) : nivelPichanga(clave);
  if (!lv) return null;
  return { clave, lv, partida: partidaNivel(lv), pasados: [], usos: { vista: 0, repetir: 0, toque: 0 }, extras: 0, vistaActiva: false };
};

/** El mapa de un mundo: sus 20 niveles con las estrellas; candado en los que faltan; el jefe con corona. */
function MapaPichanga({ mundo, progreso, actual, onElegir, onMundo }) {
  const info = infoMundo(mundo);
  const ultimo = Math.min(mundoDe(Math.min(progreso.nivel, TOTAL)), ULTIMO_MUNDO);
  const niveles = Array.from({ length: info.hasta - info.desde + 1 }, (_, k) => info.desde + k);
  const ganadas = niveles.reduce((t, n) => t + (progreso.estrellas[n] || 0), 0);
  const t = { anterior: useTexto('Mundo anterior'), siguiente: useTexto('Mundo siguiente') };
  return (
    <div className={s.mapa} data-componente="MapaPichanga">
      <div className={s.mapaCabeza}>
        <Boton variante="fantasma" tamano="sm" soloIcono icono={<ChevronLeft aria-hidden="true" />} aria-label={t.anterior} disabled={mundo <= 1} onClick={() => onMundo(mundo - 1)} />
        <div className={s.mapaTitulo}>
          <p className={s.mundoNumero}><TextoResaltado resaltar={[mundo]}>{`Mundo ${mundo}`}</TextoResaltado></p>
          <p className={s.mundoNombre}><Texto>{info.nombre}</Texto></p>
          <p className={s.mundoEstrellas}><Star aria-hidden="true" className={s.estrellaTotal} /> {ganadas}/{niveles.length * 3}</p>
        </div>
        <Boton variante="fantasma" tamano="sm" soloIcono icono={<ChevronRight aria-hidden="true" />} aria-label={t.siguiente} disabled={mundo >= ultimo} onClick={() => onMundo(mundo + 1)} />
      </div>
      <ol className={s.mapaNiveles}>
        {niveles.map((n) => (
          <li key={n}>
            <NivelDelMapa n={n} estrellas={progreso.estrellas[n] || 0} abierto={n <= progreso.nivel} actual={n === actual} onElegir={onElegir} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function NivelDelMapa({ n, estrellas, abierto, actual, onElegir }) {
  const jefe = esJefe(n);
  let etiqueta = `Nivel ${n}${jefe ? ', jefe' : ''}`;
  if (!abierto) etiqueta += ', cerrado';
  else if (estrellas) etiqueta += `, ${estrellas} de 3 estrellas`;
  const aria = useTexto(etiqueta);
  return (
    <button
      type="button"
      className={[s.nivelMapa, jefe && s.nivelJefe, actual && s.nivelActual, !abierto && s.nivelCerrado].filter(Boolean).join(' ')}
      disabled={!abierto}
      onClick={() => onElegir(n)}
      aria-label={aria}
      aria-current={actual ? 'step' : undefined}
    >
      {jefe && <Crown className={s.corona} aria-hidden="true" />}
      {abierto ? <span className={s.nivelMapaNumero}>{n}</span> : <Lock className={s.candadoMapa} aria-hidden="true" />}
      {abierto && <EstrellasNivel valor={estrellas} />}
    </button>
  );
}

/** El vestuario: equipo, pelota y cancha del partido. Todo se elige; lo cerrado dice cómo se abre. */
function VestuarioPichanga({ abierto, onCerrar, progreso, onElegir }) {
  const [clase, setClase] = useState('equipo');
  const listas = { equipo: EQUIPOS_PICHANGA, pelota: PELOTAS_PICHANGA, estadio: ESTADIOS_PICHANGA };
  return (
    <HojaInferior
      abierta={abierto}
      onCerrar={onCerrar}
      titulo="Vestuario"
      pie={<Boton bloque onClick={onCerrar}><Texto>Listo</Texto></Boton>}
    >
      <div className={c.vestuario} data-componente="VestuarioPichanga">
        <Pestanas
          etiqueta="Qué elegir"
          opciones={[{ id: 'equipo', texto: 'Equipo' }, { id: 'pelota', texto: 'Pelota' }, { id: 'estadio', texto: 'Cancha' }]}
          valor={clase}
          onChange={setClase}
        />
        {clase === 'estadio' && <p className={s.notaSuave}><Texto>La cancha es la del partido contra Michi. Los niveles usan la de su mundo.</Texto></p>}
        <ul className={c.prendas}>
          {listas[clase].map((item) => {
            const libre = desbloqueado(item, progreso);
            const puesto = progreso[clase] === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={[c.prenda, puesto && c.prendaPuesta, !libre && c.prendaCerrada].filter(Boolean).join(' ')}
                  disabled={!libre}
                  aria-pressed={puesto}
                  onClick={() => onElegir(clase, item.id)}
                >
                  {clase === 'estadio'
                    ? <MuestraEstadio estadio={item} />
                    : <MuestraPichanga tipo={clase === 'pelota' ? 'pelota' : 'chapa'} item={item} />}
                  <span className={c.prendaNombre}><Texto>{item.nombre}</Texto></span>
                  <span className={c.prendaNota}>
                    {puesto && <><Check aria-hidden="true" /> <Texto>Puesto</Texto></>}
                    {!puesto && !libre && <><Lock aria-hidden="true" /> <Texto>{textoDesbloqueo(item)}</Texto></>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </HojaInferior>
  );
}

/** Lo que se acaba de desbloquear, en el resultado. */
function Desbloqueos({ lista }) {
  if (!lista?.length) return null;
  return (
    <div className={c.desbloqueos} data-componente="DesbloqueosPichanga">
      <p className={c.desbloqueosTitulo}><Gift aria-hidden="true" /> <Texto>¡Desbloqueaste algo nuevo para tu vestuario!</Texto></p>
      <ul>
        {lista.map(({ clase, item }) => (
          <li key={`${clase}-${item.id}`}>
            {clase === 'estadio' ? <MuestraEstadio estadio={item} tamano={40} /> : <MuestraPichanga tipo={clase === 'pelota' ? 'pelota' : 'chapa'} item={item} tamano={40} />}
            <span><Texto>{`${item.nombre} (${CLASE[clase]})`}</Texto></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * La Pichanga de Kapi: fútbol de chapas para jugar solo. Se arrastra desde una
 * de tus chapas hacia atrás, como una resortera, y se suelta: la chapa sale
 * hacia el otro lado y empuja la pelota. Niveles en mundos de 20 (el último,
 * penales contra Kapi), de 1 a 3 estrellas según los toques, ayudas por nivel,
 * una racha que abre cofres y un partido contra Kapi por turnos. El vestuario
 * se abre jugando (nada se compra).
 * Ganar un nivel o el reto del día da monedas una vez al día (lo comprueba el
 * servidor); sin cuenta se juega igual y el premio invita a entrar.
 *  - sesion · yaHoy (ya cobró hoy) · monto (2)
 *  - onGanar({ partida }): cobra; promesa → { monto } | { ya: true } (si falla,
 *    lanza). Solo con sesión y si no cobró hoy. `partida` es lo que el
 *    servidor comprueba: { modo: 'nivel' | 'reto', nivel | fecha, tiros: [[chapa, dx, dy]…], extras }
 *  - onRegistrar(partida): cada victoria con sesión después de cobrar (la
 *    misión, el reto y los rankings); lo que pase no se muestra
 *  - hoy ('AAAA-MM-DD', el día de Lima: sin él no hay reto)
 *  - rankings: { reto, niveles, goleadores } (ver getRankingPichanga) ·
 *    cargandoRankings: { [tabla]: bool } · onPedirRanking(tabla): para traerlo
 *  - progreso (ver PROGRESO_PICHANGA) · onProgreso(progreso): cada cambio, para guardarlo
 *  - onCompletar({ modo: 'nivel' | 'reto' | 'partido', … }): cada nivel o reto
 *    ganado y cada partido terminado (la analítica)
 *  - vistaInicial: 'juego' | 'mapa' · modoInicial: 'niveles' | 'reto' | 'partido'
 *  - ayudaVista · onAyudaVista · estado: 'cargando' · monedas: { saldo, cargando } (MarcoJuego)
 * Mientras se acredita, la hoja no se cierra. Los textos pasan por la traducción.
 */
export function PaginaPichanga({
  progreso, onProgreso, onCompletar, vistaInicial = 'juego', modoInicial = 'niveles', ayudaVista = true, onAyudaVista, estado, monedas,
  sesion = true, yaHoy = false, monto = 2, onGanar, onRegistrar, hoy, rankings = {}, cargandoRankings = {}, onPedirRanking, urlLogin = '/login',
}) {
  const [prog, setProg] = useState(() => progresoPichanga(progreso));
  const [modo, setModo] = useState(modoInicial);
  const [vista, setVista] = useState(vistaInicial);
  const [numero, setNumero] = useState(() => Math.min(progresoPichanga(progreso).nivel, TOTAL));
  const [mundoMapa, setMundoMapa] = useState(() => mundoDe(Math.min(progresoPichanga(progreso).nivel, TOTAL)));
  // Una partida por modo (niveles y reto): cambiar de pestaña no la pierde.
  const [juegos, setJuegos] = useState({});
  const [cobrado, setCobrado] = useState(yaHoy);
  const [premio, setPremio] = useState(null);
  const [partido, setPartido] = useState(partidoNuevo);
  const [anim, setAnim] = useState(null);
  const [ruta, setRuta] = useState(null);
  const [resaltar, setResaltar] = useState(null);
  const [pensando, setPensando] = useState(false);
  const [resultado, setResultado] = useState(false);
  const [logro, setLogro] = useState(null);
  const [finPartido, setFinPartido] = useState(null);
  const [sinToques, setSinToques] = useState(false);
  const [ayuda, setAyuda] = useState(!ayudaVista);
  const [explicar, setExplicar] = useState(null);
  const [aviso, setAviso] = useState(null);
  // El gol de ahora ({ id, tuyo }) para la cinta, el confeti y el sacudón.
  const [gol, setGol] = useState(null);
  const [caraArquero, setCaraArquero] = useState('feliz');
  // Las caras de cada equipo: tristes un rato después de recibir un gol.
  const [animos, setAnimos] = useState({ mia: 'feliz', rival: 'feliz' });
  const [vestuario, setVestuario] = useState(false);
  // El último progreso: lo que se guarda al terminar de rodar un tiro no
  // puede partir de una copia vieja (la ayuda gastada antes de tirar).
  const progRef = useRef(prog);
  progRef.current = prog;
  const finRef = useRef(null);
  const repeticion = useRef(null);
  const ultimoGolpe = useRef(0);
  const panelRef = useRef(null);
  const t = {
    sonido: useTexto(prog.sonido ? 'Silenciar' : 'Activar el sonido'),
    vibracion: useTexto(prog.vibracion ? 'Quitar la vibración' : 'Activar la vibración'),
  };

  const esJuegoNivel = modo === 'niveles' || modo === 'reto';
  const claveJuego = modo === 'reto' ? `reto:${hoy}` : numero;
  const juego = esJuegoNivel && juegos[modo]?.clave === claveJuego ? juegos[modo] : null;
  /** Cambia la partida del modo de ahora (o la de `m`). */
  const setJuego = (u, m = modo) => setJuegos((js) => ({ ...js, [m]: typeof u === 'function' ? u(js[m]) : u }));

  // El perfil puede llegar (o refrescarse) después: si ya cobró hoy, no se vuelve a intentar.
  useEffect(() => { if (yaHoy) setCobrado(true); }, [yaHoy]);

  // Los rankings se traen al entrar a cada modo (una vez; después los
  // refresca quien registra la partida).
  useEffect(() => {
    if (estado === 'cargando') return;
    if (modo === 'reto') onPedirRanking?.('reto');
    if (modo === 'niveles' && !rankings.niveles) onPedirRanking?.('niveles');
  }, [modo, estado]); // eslint-disable-line react-hooks/exhaustive-deps

  // El nivel (o el reto): se arma al cambiar de número o de modo.
  useEffect(() => {
    if (estado === 'cargando' || !esJuegoNivel || (modo === 'reto' && !hoy)) return;
    if (juego) return;
    const nuevo = juegoNuevo(claveJuego);
    if (!nuevo) return;
    setJuego(nuevo);
    setRuta(null);
    const obstaculo = nuevo.lv.obstaculos.find((o) => !prog.vistos.includes(o));
    if (obstaculo) setExplicar(obstaculo);
    else if (nuevo.lv.penales) setAviso(`¡Jefe! Penales contra Michi: mete ${nuevo.lv.penales.goles} de ${nuevo.lv.penales.tiros}.`);
  }, [claveJuego, modo, estado, Boolean(juego)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!aviso) return undefined;
    const id = setTimeout(() => setAviso(null), 2800);
    return () => clearTimeout(id);
  }, [aviso]);

  useEffect(() => {
    if (!gol) return undefined;
    const id = setTimeout(() => setGol(null), 1400);
    return () => clearTimeout(id);
  }, [gol]);

  /** Cambia el progreso y avisa para guardarlo (una vez por acción). */
  const guardar = (cambios) => {
    const nuevo = { ...progRef.current, ...cambios };
    progRef.current = nuevo;
    setProg(nuevo);
    onProgreso?.(nuevo);
    return nuevo;
  };
  const fx = (tipo, fuerza) => efectoPichanga(tipo, { fuerza, sonido: prog.sonido, vibracion: prog.vibracion });
  const alGolpe = (tipo, fuerza) => {
    // Los choques muy seguidos suenan una vez.
    const ahora = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (ahora - ultimoGolpe.current < 45) return;
    ultimoGolpe.current = ahora;
    fx(tipo, fuerza);
  };

  /** Hace rodar lo simulado; al terminar, `despues`. */
  const animar = (sim, cuerpos, t0, despues, velocidad = 1, tirador = null) => {
    const id = `${Date.now()}-${Math.random()}`;
    finRef.current = { id, despues };
    setAnim({ id, cuadros: sim.cuadros, golpes: sim.golpes, t0, velocidad, cuerpos, tirador, gol: sim.gol });
  };
  const alFinAnimacion = (id) => {
    if (finRef.current?.id !== id) return;
    const { despues } = finRef.current;
    finRef.current = null;
    setAnim(null);
    despues?.();
  };

  /* ── El turno de Kapi en el partido ── */
  useEffect(() => {
    if (modo !== 'partido' || partido.turno !== 'kapi' || partido.fin || anim || estado === 'cargando') return undefined;
    setPensando(true);
    let vivo = true;
    const ids = [];
    // Primero se ve "Kapi está pensando…"; después piensa (tarda un poco) y marca su chapa.
    ids.push(setTimeout(() => {
      if (!vivo) return;
      const tiro = jugadaDeKapi(partido.mesa, CANCHA_PARTIDO, { dificultad: prog.dificultad, pases: partido.pases || 0 });
      if (!tiro) { setPensando(false); return; }
      setResaltar(tiro[0]);
      ids.push(setTimeout(() => {
        if (!vivo) return;
        setResaltar(null);
        setPensando(false);
        tirarPartido(tiro, 'kapi');
      }, 500));
    }, 650));
    return () => { vivo = false; ids.forEach(clearTimeout); setPensando(false); setResaltar(null); };
  }, [modo, partido, anim, estado]); // eslint-disable-line react-hooks/exhaustive-deps

  if (estado === 'cargando' || (esJuegoNivel && !juego)) return <EsqueletoPagina forma="pichanga" />;

  const esPartido = modo === 'partido';
  const esReto = modo === 'reto';
  const equipo = buscar(EQUIPOS_PICHANGA, prog.equipo);
  const pelota = buscar(PELOTAS_PICHANGA, prog.pelota);
  const estadio = buscar(ESTADIOS_PICHANGA, prog.estadio);
  const mundo = mundoDe(numero);
  const infoM = infoMundo(mundo);
  // El escenario: el del mundo, el estadio del reto o la cancha elegida para el partido.
  const escena = esPartido ? escenaDelEstadio(prog.estadio) : esReto ? 'reto' : escenaDelMundoPichanga(mundo);
  const lv = juego?.lv;
  const partida = juego?.partida;
  const ocupado = Boolean(anim);
  const acreditando = premio?.estado === 'acreditando';
  const verMapa = vista === 'mapa' && modo === 'niveles';

  /* ── Ayudas del nivel ── */
  const quedanNivel = juego ? {
    vista: AYUDAS_PICHANGA.vista - juego.usos.vista,
    repetir: AYUDAS_PICHANGA.repetir - juego.usos.repetir,
    toque: AYUDAS_PICHANGA.toque - juego.usos.toque,
  } : { vista: 0, repetir: 0, toque: 0 };
  const quedan = {
    vista: quedanNivel.vista + prog.guardadas.vista,
    repetir: quedanNivel.repetir + prog.guardadas.repetir,
    toque: quedanNivel.toque + prog.guardadas.toque,
  };
  /** Gasta una ayuda: primero las del nivel, después las guardadas. → los usos nuevos. */
  const gastar = (tipo) => {
    if (quedanNivel[tipo] > 0) return { ...juego.usos, [tipo]: juego.usos[tipo] + 1 };
    guardar({ guardadas: { ...prog.guardadas, [tipo]: prog.guardadas[tipo] - 1 } });
    return juego.usos;
  };

  // Los toques gastados (los pases no cuentan).
  const tirosHechos = partida ? toquesUsados(partida) : 0;
  const toquesQuedan = lv ? Math.max(0, lv.toques + juego.extras - tirosHechos) : 0;
  const enJuego = tirosHechos > 0 && !partida?.ganada;

  /** Reiniciar o dejar un nivel empezado corta la racha. */
  const cortarRacha = () => {
    if (modo !== 'niveles' || !enJuego || !prog.racha) return;
    guardar({ racha: 0 });
    setAviso('Se cortó tu racha de victorias.');
  };

  /**
   * El premio de una victoria: sin cuenta invita a entrar; si ya cobró hoy,
   * solo se registra (misión y rankings); si no, cobra y las monedas vuelan.
   */
  const cobrar = async (partidaServidor) => {
    if (!sesion) { setPremio({ estado: 'sinSesion' }); return; }
    if (!onGanar) { setPremio(null); return; }
    if (cobrado) {
      setPremio({ estado: 'ya', texto: 'Ya ganaste tus monedas hoy. Puedes seguir jugando por gusto.' });
      Promise.resolve(onRegistrar?.(partidaServidor)).catch(() => {});
      return;
    }
    setPremio({ estado: 'acreditando' });
    try {
      const r = await onGanar({ partida: partidaServidor });
      setCobrado(true);
      setPremio(r?.ya ? { estado: 'ya' } : { estado: 'acreditado', monto: r?.monto || monto });
    } catch {
      setPremio({ estado: 'error' });
    }
  };

  const ganarReto = (retoJugado, final, extras) => {
    const toques = toquesUsados(final);
    const estrellas = estrellasPara(toques, retoJugado.par);
    const p = progRef.current;
    const mejorAntes = p.reto === retoJugado.reto;
    guardar({ reto: retoJugado.reto, goles: p.goles + final.goles });
    setFinPartido(null);
    setLogro({ reto: true, estrellas, toques, repetido: mejorAntes, desbloqueos: [] });
    onCompletar?.({ modo: 'reto', fecha: retoJugado.reto, toques, estrellas, tiros: final.tiros, extras });
    cobrar({ modo: 'reto', fecha: retoJugado.reto, tiros: final.tiros, extras });
    setTimeout(() => fx('ganar'), 700);
    setTimeout(() => setResultado(true), 1500);
  };

  const ganarNivel = (nivelJugado, final, extras) => {
    const p = progRef.current;
    const n = nivelJugado.numero;
    const toques = toquesUsados(final);
    const estrellas = estrellasPara(toques, nivelJugado.par);
    const antes = p.estrellas[n] || 0;
    const racha = p.racha + 1;
    const cofre = racha % RACHA_COFRE === 0 ? premioCofre() : null;
    const guardadas = cofre ? { ...p.guardadas, [cofre.tipo]: p.guardadas[cofre.tipo] + cofre.cantidad } : p.guardadas;
    const viejo = progresoPichanga(p);
    const nuevo = guardar({
      nivel: Math.max(p.nivel, n + 1), estrellas: { ...p.estrellas, [n]: Math.max(antes, estrellas) }, racha, guardadas, goles: p.goles + final.goles,
    });
    setFinPartido(null);
    setLogro({
      estrellas, toques, record: antes > 0 && estrellas > antes, cofre, racha, penales: Boolean(nivelJugado.penales),
      mundoCompleto: esJefe(n) ? mundoDe(n) : null, desbloqueos: nuevosDesbloqueos(viejo, progresoPichanga(nuevo)), numero: n,
    });
    onCompletar?.({ modo: 'nivel', nivel: n, toques, estrellas, tiros: final.tiros, extras });
    cobrar({ modo: 'nivel', nivel: n, tiros: final.tiros, extras });
    setTimeout(() => fx('ganar'), 700);
    if (cofre) setTimeout(() => fx('cofre'), 1500);
    setTimeout(() => setResultado(true), 1500);
  };

  /* ── Tirar en un nivel ── */
  const tirarNivel = (tiro) => {
    if (ocupado || !juego || partida.ganada || partida.perdida) return;
    const antes = juego;
    const { partida: nueva, sim } = jugarTiro(lv, partida, tiro, { extras: juego.extras, cuadros: true });
    const usos = antes.vistaActiva ? gastar('vista') : antes.usos;
    setRuta(null);
    fx('tiro');
    setCaraArquero('feliz');
    setAnimos({ mia: 'feliz', rival: 'feliz' });
    setJuego({ ...antes, usos, vistaActiva: false });
    animar(sim, partida.mesa.cuerpos, partida.mesa.t, () => {
      setJuego((j) => ({ ...j, partida: nueva, pasados: [...j.pasados, partida] }));
      const atajo = sim.golpes.some(([, tipo]) => tipo === 'kapi');
      if (sim.gol === 'arriba') {
        fx('gol');
        setGol({ id: Date.now(), tuyo: true });
        if (lv.def.kapi) setCaraArquero('triste');
        setAnimos({ mia: 'feliz', rival: 'triste' });
        repeticion.current = { sim, cuerpos: partida.mesa.cuerpos, t0: partida.mesa.t, tirador: tiro[0] };
        if (lv.penales && !nueva.ganada) setAviso(`¡Gol! Llevas ${nueva.goles} de ${lv.penales.goles}.`);
      } else if (lv.penales) {
        fx('fallo');
        setAviso(atajo ? '¡Atajó Michi!' : '¡Afuera!');
      } else if (nueva.ultimo?.autogol) {
        fx('golKapi');
        setAnimos({ mia: 'triste', rival: 'feliz' });
        setAviso('¡Autogol! La jugada vuelve atrás y el toque se gasta.');
      } else if (nueva.ultimo?.pase) {
        fx('pase');
        setAviso(`¡Pase! Ese toque es gratis (${nueva.pases}/${PASES_MAX}).`);
      } else if (atajo) {
        setAviso('¡Atajó Michi!');
      }
      if (nueva.ganada) (lv.reto ? ganarReto : ganarNivel)(lv, nueva, antes.extras);
      else if (nueva.perdida) { fx('fallo'); setSinToques(true); }
    }, 1, tiro[0]);
  };

  const alApuntar = (tiro) => {
    if (!juego?.vistaActiva || !tiro) { if (ruta) setRuta(null); return; }
    const sim = simular(partida.mesa, lv.def, tiro, { cuadros: true });
    const k = indicePelota(partida.mesa);
    setRuta(sim.cuadros.map((f) => f[k]));
  };

  const alternarVista = () => {
    if (ocupado || partida.ganada) return;
    if (!juego.vistaActiva && quedan.vista <= 0) return;
    setJuego({ ...juego, vistaActiva: !juego.vistaActiva });
    setRuta(null);
    if (!juego.vistaActiva) setAviso('Arrastra una chapa: verás por dónde va la pelota.');
  };

  const repetirTiro = () => {
    if (ocupado || !juego.pasados.length || partida.ganada || quedan.repetir <= 0) return;
    const usos = gastar('repetir');
    setJuego({ ...juego, usos, partida: juego.pasados[juego.pasados.length - 1], pasados: juego.pasados.slice(0, -1) });
    setSinToques(false);
    setRuta(null);
  };

  const toqueDeMas = () => {
    if (ocupado || partida.ganada || quedan.toque <= 0) return;
    const usos = gastar('toque');
    const extras = juego.extras + 1;
    setJuego({ ...juego, usos, extras, partida: { ...partida, perdida: perdidaCon(lv, partida, extras) } });
    setSinToques(false);
  };

  const reiniciar = () => {
    if (ocupado) return;
    cortarRacha();
    setJuego(juegoNuevo(claveJuego));
    setSinToques(false);
    setRuta(null);
  };

  const irANivel = (n) => {
    if (ocupado) return;
    if (n !== numero || modo !== 'niveles') cortarRacha();
    setModo('niveles');
    setNumero(n);
    setMundoMapa(mundoDe(n));
    setVista('juego');
    setResultado(false);
    setSinToques(false);
  };

  const siguiente = () => {
    if (ocupado || acreditando) return;
    setResultado(false);
    setPremio(null);
    if (esReto) { cambiarModo('niveles'); return; }
    if (numero >= TOTAL) {
      setAviso('¡Terminaste todos los niveles! Pronto llegan más mundos. Mientras, juega contra Michi.');
      return;
    }
    irANivel(numero + 1);
  };

  const repetirNivel = () => {
    if (acreditando) return;
    setResultado(false);
    setPremio(null);
    setJuego(juegoNuevo(claveJuego));
  };

  const verRepeticion = () => {
    const r = repeticion.current;
    if (!r || ocupado) return;
    setResultado(false);
    animar(r.sim, r.cuerpos, r.t0, () => setResultado(true), 0.4, r.tirador);
  };

  /* ── El partido ── */
  const terminarPartido = (final) => {
    const p = progRef.current;
    const viejo = progresoPichanga(p);
    const nuevo = guardar({
      partidos: { jugados: p.partidos.jugados + 1, ganados: p.partidos.ganados + (final.fin === 'yo' ? 1 : 0) },
      goles: p.goles + final.goles.yo,
    });
    setLogro(null);
    setFinPartido({ fin: final.fin, goles: final.goles, desbloqueos: nuevosDesbloqueos(viejo, progresoPichanga(nuevo)) });
    onCompletar?.({ modo: 'partido', fin: final.fin, goles: final.goles, dificultad: prog.dificultad });
    setTimeout(() => { fx(final.fin === 'yo' ? 'ganar' : final.fin === 'kapi' ? 'fallo' : 'silbato'); setResultado(true); }, 900);
  };

  function tirarPartido(tiro, quien) {
    const antes = partido;
    if (quien === 'yo' && (ocupado || antes.turno !== 'yo' || antes.fin)) return;
    const sim = simular(antes.mesa, CANCHA_PARTIDO, tiro, { cuadros: true });
    fx('tiro');
    setAnimos({ mia: 'feliz', rival: 'feliz' });
    animar(sim, antes.mesa.cuerpos, antes.mesa.t, () => {
      const nuevo = despuesDelTiroPartido({ ...antes, turno: quien }, sim, tiro);
      setPartido(nuevo);
      if (nuevo.pase && !nuevo.fin) {
        fx('pase');
        setAviso(quien === 'yo' ? `¡Pase! Vuelves a tirar (${nuevo.pases}/${PASES_MAX}).` : `Pase de Michi: vuelve a tirar (${nuevo.pases}/${PASES_MAX}).`);
      }
      if (sim.gol) {
        const mio = sim.gol === 'arriba';
        fx(mio ? 'gol' : 'golKapi');
        setGol({ id: Date.now(), tuyo: mio });
        setAnimos(mio ? { mia: 'feliz', rival: 'triste' } : { mia: 'triste', rival: 'feliz' });
        repeticion.current = { sim, cuerpos: antes.mesa.cuerpos, t0: antes.mesa.t, tirador: tiro[0] };
        let texto;
        if (mio) texto = quien === 'yo' ? '¡GOOOL!' : '¡Autogol de Michi!';
        else texto = quien === 'kapi' ? 'Gol de Michi.' : 'Uy, autogol.';
        setAviso(texto);
      }
      if (nuevo.fin) terminarPartido(nuevo);
    }, 1, tiro[0]);
  }

  const partidoOtraVez = () => {
    if (ocupado) return;
    setResultado(false);
    setFinPartido(null);
    setPartido(partidoNuevo());
    fx('silbato');
  };

  const cambiarDificultad = (d) => {
    if (d === prog.dificultad || ocupado) return;
    guardar({ dificultad: d });
    if ((partido.tiros.yo || partido.tiros.kapi) && !partido.fin) setAviso('Empieza un partido nuevo con la dificultad elegida.');
    setPartido(partidoNuevo());
  };

  const cambiarModo = (m) => {
    if (m === modo || ocupado || acreditando) return;
    setModo(m);
    setVista('juego');
    setResultado(false);
    setPremio(null);
    setSinToques(false);
    setRuta(null);
    if (m === 'partido' && !partido.tiros.yo && !partido.tiros.kapi) fx('silbato');
  };

  const elegirPrenda = (clase, id) => guardar({ [clase]: id });

  const cerrarExplicacion = () => {
    const tipo = explicar;
    setExplicar(null);
    if (!prog.vistos.includes(tipo)) guardar({ vistos: [...prog.vistos, tipo] });
    if (lv?.penales) setAviso(`¡Jefe! Penales contra Michi: mete ${lv.penales.goles} de ${lv.penales.tiros}.`);
  };

  /* ── Lo que se dibuja ── */
  const def = esPartido ? CANCHA_PARTIDO : lv.def;
  const mesa = esPartido ? partido.mesa : partida.mesa;
  const puedeTirar = !ocupado && !verMapa && (esPartido
    ? partido.turno === 'yo' && !partido.fin && !pensando
    : !partida.ganada && !partida.perdida);
  const guardadasTexto = Object.entries(prog.guardadas).filter(([, n]) => n > 0).map(([tipo, n]) => textoAyuda(tipo, n));
  const contador = (n) => <span className={s.cuentaAyuda} aria-hidden="true">{n}</span>;
  const obstaculo = explicar && OBSTACULOS[explicar];
  const estrellas = estrellasTotales(prog);

  const interruptores = (
    <>
      <BotonIrAlPanel destino={panelRef} etiqueta={esPartido ? 'Ver el partido' : 'Ver la racha'} icono={<Trophy aria-hidden="true" />} />
      <Boton variante="fantasma" tamano="sm" soloIcono aria-label={t.sonido} aria-pressed={prog.sonido} onClick={() => guardar({ sonido: !prog.sonido })}
        icono={prog.sonido ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
      />
      <Boton variante="fantasma" tamano="sm" soloIcono aria-label={t.vibracion} aria-pressed={prog.vibracion} onClick={() => guardar({ vibracion: !prog.vibracion })}
        icono={prog.vibracion ? <Vibrate aria-hidden="true" /> : <VibrateOff aria-hidden="true" />}
      />
    </>
  );

  const promesa = !sesion
    ? <PremioJuego estado="sinSesion" urlLogin={urlLogin} />
    : cobrado
      ? <PremioJuego estado="ya" texto="Ya ganaste tus monedas hoy. Puedes seguir jugando por gusto." />
      : <PremioJuego estado="promesa" monto={monto} texto="al pasar un nivel o el reto del día." />;

  let turnoTexto = null;
  if (esPartido) {
    if (partido.fin) turnoTexto = partido.fin === 'yo' ? '¡Ganaste!' : partido.fin === 'kapi' ? 'Ganó Michi' : 'Empate';
    else if (ocupado) turnoTexto = 'Rueda la pelota…';
    else if (partido.turno === 'kapi') turnoTexto = 'Michi está pensando…';
    else turnoTexto = partido.pases ? `Tu turno (pases ${partido.pases}/${PASES_MAX})` : 'Tu turno: arrastra una de tus chapas';
  }

  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }} className={s.seccionJuego}>
        <MarcoJuego titulo="La Pichanga de Kapi" onAyuda={() => setAyuda(true)} acciones={interruptores} monedas={monedas}>
          <div className={s.bolitas} data-componente="PaginaPichanga">
            <div className={[s.mesa, c.mesa].join(' ')}>
              <span className={s.adornos} aria-hidden="true">
                <FondoPichanga escena={escena} semilla={esReto ? hoy : esPartido ? prog.estadio : numero} jefe={!esPartido && Boolean(lv?.jefe) && !verMapa} />
              </span>
              <div className={s.modos}>
                <Pestanas
                  etiqueta="Modo de juego"
                  opciones={[
                    { id: 'niveles', texto: 'Niveles' },
                    ...(hoy ? [{ id: 'reto', texto: 'Reto del día' }] : []),
                    { id: 'partido', texto: 'Contra Michi' },
                  ]}
                  valor={modo}
                  onChange={cambiarModo}
                />
              </div>

              {verMapa ? (
                <>
                  <MapaPichanga mundo={mundoMapa} progreso={prog} actual={numero} onElegir={irANivel} onMundo={setMundoMapa} />
                  <div className={s.botonesMesa}>
                    <Boton icono={<ArrowRight aria-hidden="true" />} onClick={() => setVista('juego')}>
                      <TextoResaltado resaltar={[numero]}>{`Volver al nivel ${numero}`}</TextoResaltado>
                    </Boton>
                  </div>
                </>
              ) : (
                <>
                  {esPartido ? (
                    <div className={c.marcador} aria-live="polite">
                      <span className={c.lado}>
                        <MuestraPichanga item={equipo} tamano={30} />
                        <Texto>Tú</Texto>
                      </span>
                      <span className={c.goles}>{partido.goles.yo} – {partido.goles.kapi}</span>
                      <span className={c.lado}>
                        <Texto>Michi</Texto>
                        <MuestraPichanga item={EQUIPO_RIVAL} personaje="michi" tamano={30} />
                      </span>
                      <span className={c.turno}><Texto>{turnoTexto}</Texto></span>
                    </div>
                  ) : (
                    <div className={c.cabeza}>
                      <div className={c.cabezaTexto}>
                        <p className={c.cabezaMundo}>
                          {esReto ? <Texto>El mismo para todos, hoy</Texto> : (
                            <>
                              <TextoResaltado resaltar={[mundo]}>{`Mundo ${mundo}`}</TextoResaltado>
                              {' · '}<Texto>{infoM.nombre}</Texto>
                            </>
                          )}
                        </p>
                        <p className={c.cabezaNivel}>
                          {lv.jefe && <Crown className={s.coronaTitulo} aria-hidden="true" />}
                          {esReto ? <Texto>Reto del día</Texto> : (
                            <TextoResaltado resaltar={[numero]}>{lv.jefe ? `Nivel ${numero} · Penales` : `Nivel ${numero}`}</TextoResaltado>
                          )}
                        </p>
                        <p className={c.cabezaMeta}>
                          {lv.penales ? (
                            <TextoResaltado resaltar={[partida.goles, lv.penales.goles]}>{`Goles: ${partida.goles} de ${lv.penales.goles}`}</TextoResaltado>
                          ) : (
                            <>
                              {/* Las que llevaría con gol en el próximo toque (o las ganadas). */}
                              <EstrellasNivel valor={estrellasPara(partida.ganada ? tirosHechos : tirosHechos + 1, lv.par)} />
                              <TextoResaltado resaltar={[lv.par]}>{lv.par === 1 ? 'con gol de 1 toque' : `con ${lv.par} toques`}</TextoResaltado>
                              <span className={c.pases}><TextoResaltado resaltar={[partida.pases || 0]}>{`· Pases ${partida.pases || 0}/${PASES_MAX}`}</TextoResaltado></span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className={c.cabezaDerecha}>
                        <span className={[c.quedan, toquesQuedan <= 1 && c.quedanPocos].filter(Boolean).join(' ')}>
                          <TextoResaltado resaltar={[toquesQuedan]}>
                            {lv.penales ? (toquesQuedan === 1 ? 'Queda 1 tiro' : `Quedan ${toquesQuedan} tiros`) : (toquesQuedan === 1 ? 'Queda 1 toque' : `Quedan ${toquesQuedan} toques`)}
                          </TextoResaltado>
                        </span>
                        {!esReto && (
                          <Boton variante="secundario" tamano="sm" icono={<IconoMapa aria-hidden="true" />} onClick={() => { setMundoMapa(mundo); setVista('mapa'); }}>
                            <Texto>Mapa</Texto>
                          </Boton>
                        )}
                      </div>
                    </div>
                  )}
                  {esReto && prog.reto === hoy && !partida.ganada && (
                    <Aviso compacto tipo="exito"><Texto>Ya hiciste el reto de hoy. Puedes jugarlo otra vez para mejorar tu marca; mañana sale otro.</Texto></Aviso>
                  )}
                  <div key={gol ? `gol-${gol.id}` : 'cancha'} className={[c.zonaCancha, gol && c.temblor].filter(Boolean).join(' ')}>
                    <CanchaPichanga
                      def={def}
                      cuerpos={anim ? anim.cuerpos : mesa.cuerpos}
                      t={mesa.t}
                      equipo={equipo}
                      pelota={pelota}
                      pasto={esPartido ? estadio.pasto : esReto ? PASTO_RETO : infoM.pasto}
                      linea={esPartido ? estadio.linea : esReto ? 'rgba(255,255,255,0.85)' : infoM.linea}
                      escena={escena}
                      caraArquero={caraArquero}
                      animos={animos}
                      puedeTirar={puedeTirar}
                      onTiro={(tiro) => (esPartido ? tirarPartido(tiro, 'yo') : tirarNivel(tiro))}
                      onApuntar={esPartido ? undefined : alApuntar}
                      ruta={ruta}
                      animacion={anim}
                      onFinAnimacion={alFinAnimacion}
                      onGolpe={alGolpe}
                      resaltar={resaltar}
                      etiqueta={esPartido ? 'La cancha del partido contra Michi' : esReto ? 'La cancha del reto del día' : `La cancha del nivel ${numero}`}
                    />
                    {/* El confeti sale del arco; la cinta con el degradado de la marca. */}
                    <span className={c.fiestaArco} aria-hidden="true">
                      <Estallido disparo={gol?.tuyo ? gol.id : null} forma="confeti" cantidad={30} distancia={170} colores={['#8b5cf6', '#f472b6', '#fbbf24', '#60a5fa', '#34d399']} />
                    </span>
                    <div className={c.avisoCancha} aria-live="polite">
                      {aviso && <span key={aviso} className={s.mensaje}><Texto>{aviso}</Texto></span>}
                    </div>
                    {gol && (
                      <span key={gol.id} className={[c.gol, !gol.tuyo && c.golKapi].filter(Boolean).join(' ')} aria-hidden="true">
                        <img src={gol.tuyo ? PERSONAJES.kapi.feliz : PERSONAJES.michi.feliz} alt="" width="64" height="64" className={c.golKapiCara} />
                        <span className={c.golCinta}>{gol.tuyo ? '¡GOOOL!' : 'Gol de Michi'}</span>
                      </span>
                    )}
                  </div>

                  <div className={s.botonesMesa}>
                    {esPartido ? (
                      <Boton variante={partido.fin ? 'primario' : 'fantasma'} icono={<RotateCcw aria-hidden="true" />} onClick={partidoOtraVez} disabled={ocupado}>
                        <Texto>{partido.fin ? 'Otro partido' : 'Empezar de nuevo'}</Texto>
                      </Boton>
                    ) : partida.ganada ? (
                      <>
                        <Boton icono={<ArrowRight aria-hidden="true" />} onClick={siguiente} disabled={ocupado || acreditando}>
                          <Texto>{esReto ? 'Seguir con los niveles' : numero >= TOTAL ? 'Terminar' : 'Siguiente nivel'}</Texto>
                        </Boton>
                        {!resultado && <Boton variante="secundario" icono={<Eye aria-hidden="true" />} onClick={() => setResultado(true)} disabled={ocupado}><Texto>Ver resultado</Texto></Boton>}
                      </>
                    ) : (
                      <>
                        <Boton tamano="sm" variante={juego.vistaActiva ? 'primario' : 'secundario'} icono={<Eye aria-hidden="true" />} onClick={alternarVista} aria-pressed={juego.vistaActiva}
                          disabled={ocupado || (!juego.vistaActiva && quedan.vista <= 0)}
                        >
                          <Texto>Ver el tiro</Texto>{contador(quedan.vista)}
                        </Boton>
                        <Boton tamano="sm" variante="secundario" icono={<Undo2 aria-hidden="true" />} onClick={repetirTiro} disabled={ocupado || !juego.pasados.length || quedan.repetir <= 0}>
                          <Texto>Repetir tiro</Texto>{contador(quedan.repetir)}
                        </Boton>
                        <Boton tamano="sm" variante="secundario" icono={<Plus aria-hidden="true" />} onClick={toqueDeMas} disabled={ocupado || quedan.toque <= 0}>
                          <Texto>{lv.penales ? 'Un tiro más' : 'Un toque más'}</Texto>{contador(quedan.toque)}
                        </Boton>
                        <Boton tamano="sm" variante="fantasma" icono={<RotateCcw aria-hidden="true" />} onClick={reiniciar} disabled={ocupado}><Texto>Reiniciar</Texto></Boton>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <aside ref={panelRef} className={s.lado}>
              <div className={s.panel}>
                {esPartido ? (
                  <>
                    <CifrasJuego cifras={[
                      { etiqueta: 'Ganados', valor: prog.partidos.ganados },
                      { etiqueta: 'Jugados', valor: prog.partidos.jugados },
                    ]}
                    />
                    <div className={c.dificultad}>
                      <p className={s.rachaTitulo}><Swords aria-hidden="true" /> <Texto>Dificultad</Texto></p>
                      <Pestanas
                        etiqueta="Dificultad"
                        opciones={[{ id: 'facil', texto: 'Fácil' }, { id: 'normal', texto: 'Normal' }, { id: 'dificil', texto: 'Difícil' }]}
                        valor={prog.dificultad}
                        onChange={cambiarDificultad}
                      />
                    </div>
                    <p className={s.notaSuave}>
                      <TextoResaltado resaltar={[GOLES_PARTIDO]}>{`Por turnos: gana quien meta ${GOLES_PARTIDO} goles. Tú atacas hacia arriba.`}</TextoResaltado>
                    </p>
                  </>
                ) : esReto ? (
                  <>
                    {promesa}
                    <CifrasJuego cifras={[
                      { etiqueta: 'Reto', valor: (hoy || '').slice(5).split('-').reverse().join('/') },
                      { etiqueta: 'Toques', valor: tirosHechos },
                    ]}
                    />
                    <TablaPichanga
                      titulo="Ranking del reto"
                      sesion={sesion}
                      urlLogin={urlLogin}
                      cargando={{ hoy: cargandoRankings.reto, semana: cargandoRankings.reto }}
                      pestanas={[
                        {
                          id: 'hoy', texto: 'Hoy', lista: rankings.reto?.hoy, puesto: rankings.reto?.yo?.hoy, total: rankings.reto?.yo?.jugadoresHoy,
                          valor: (f) => (f.toques === 1 ? '1 toque' : `${f.toques} toques`),
                          vacio: 'Nadie hizo el reto de hoy todavía. ¡Sé la primera persona!',
                        },
                        {
                          id: 'semana', texto: 'Esta semana', lista: rankings.reto?.semanal, puesto: rankings.reto?.yo?.semana, total: rankings.reto?.yo?.jugadoresSemana,
                          valor: (f) => `${f.completados === 1 ? '1 reto' : `${f.completados} retos`} · ${f.total} toques`,
                          vacio: 'Todavía nadie hizo un reto esta semana.',
                        },
                      ]}
                    />
                  </>
                ) : (
                  <>
                    {promesa}
                    <CifrasJuego cifras={[
                      { etiqueta: 'Nivel', valor: `${numero}/${TOTAL}` },
                      { etiqueta: 'Estrellas', valor: estrellas },
                    ]}
                    />
                    <div className={s.rachaBolitas} data-componente="RachaPichanga">
                      <p className={s.rachaTitulo}>
                        <Flame aria-hidden="true" className={prog.racha ? s.llamaEncendida : s.llama} />
                        <TextoResaltado resaltar={[prog.racha]}>{`Racha de victorias: ${prog.racha}`}</TextoResaltado>
                      </p>
                      <BarraProgreso pasos valor={prog.racha % RACHA_COFRE} max={RACHA_COFRE} etiqueta={<Texto>Para el próximo cofre</Texto>} />
                      <p className={s.notaSuave}>
                        <TextoResaltado resaltar={[RACHA_COFRE]}>{`Gana ${RACHA_COFRE} niveles seguidos sin reiniciar y abre un cofre con ayudas.`}</TextoResaltado>
                      </p>
                      {guardadasTexto.length > 0 && (
                        <p className={s.guardadas}>
                          <Gift aria-hidden="true" />
                          <Texto>{`Guardadas: ${guardadasTexto.join(', ')}.`}</Texto>
                        </p>
                      )}
                    </div>
                    <TablaPichanga
                      titulo="Los mejores"
                      sesion={sesion}
                      urlLogin={urlLogin}
                      entrar="Inicia sesión para aparecer en los rankings."
                      cargando={{ niveles: cargandoRankings.niveles, goleadores: cargandoRankings.goleadores }}
                      onPestana={(id) => { if (!rankings[id]) onPedirRanking?.(id); }}
                      pestanas={[
                        {
                          id: 'niveles', texto: 'Top de niveles', lista: rankings.niveles?.top, puesto: rankings.niveles?.yo?.puesto, total: rankings.niveles?.yo?.jugadores,
                          valor: (f) => `Pasó el nivel ${f.nivel}`, nota: 'El nivel más alto que pasó cada persona.',
                          vacio: 'Todavía nadie pasó un nivel. ¡Sé la primera persona!',
                        },
                        {
                          id: 'goleadores', texto: 'Goleadores del mes', lista: rankings.goleadores?.top, puesto: rankings.goleadores?.yo?.puesto, total: rankings.goleadores?.yo?.jugadores,
                          valor: (f) => (f.goles === 1 ? '1 gol' : `${f.goles} goles`), nota: 'Goles de los niveles y del reto. Cada nivel cuenta una vez por día; se reinicia cada mes.',
                          vacio: 'Todavía nadie metió un gol este mes.',
                        },
                      ]}
                    />
                  </>
                )}
                <button type="button" className={c.vestuarioBoton} onClick={() => setVestuario(true)}>
                  <MuestraPichanga item={equipo} tamano={40} />
                  <span>
                    <strong><Texto>{equipo.nombre}</Texto></strong>
                    <small><Texto>Cambia tu equipo, tu pelota y tu cancha</Texto></small>
                  </span>
                  <Shirt aria-hidden="true" />
                </button>
              </div>
            </aside>
          </div>
        </MarcoJuego>
      </BloqueSeccion>

      <AyudaJuego
        abierta={ayuda}
        onCerrar={() => { setAyuda(false); onAyudaVista?.(); }}
        intro="Fútbol de chapas: mete la pelota en el arco de arriba empujándola con tus chapas."
        pasos={[
          'Toca una de tus chapas y arrastra hacia atrás, como una resortera. La flecha te dice hacia dónde sale y con cuánta fuerza.',
          'Suelta: tu chapa sale disparada, empuja la pelota y todo rebota en las bandas, los postes y las demás chapas.',
          'Cada nivel tiene pocos toques. Con menos toques ganas más estrellas (hasta 3). El último de cada mundo es una tanda de penales contra Michi, el arquero gato.',
          <TextoResaltado key="racha" resaltar={[RACHA_COFRE]}>
            {`Gana ${RACHA_COFRE} niveles seguidos sin reiniciar y abre un cofre: ayudas que se guardan para cuando se acaben las del nivel.`}
          </TextoResaltado>,
          'En «Contra Michi» juegas un partido de seis contra seis, por turnos: gana quien meta 3 goles.',
          `Si la pelota toca a otra de tus chapas, es pase: no gasta toque y en el partido vuelves a tirar (hasta ${PASES_MAX}). Cuidado con tu arco: un autogol devuelve la jugada y gasta el toque.`,
        ]}
        pie={(
          <TextoResaltado resaltar={[AYUDAS_PICHANGA.vista, AYUDAS_PICHANGA.repetir]}>
            {`En cada nivel tienes ${AYUDAS_PICHANGA.vista} vistas del tiro (ves por dónde irá la pelota), ${AYUDAS_PICHANGA.repetir} tiros para repetir y un toque de más. Jugando abres equipos, pelotas y canchas nuevas en el vestuario.`}
          </TextoResaltado>
        )}
      />

      <HojaInferior
        abierta={Boolean(obstaculo)}
        onCerrar={cerrarExplicacion}
        titulo={obstaculo?.titulo}
        pie={<Boton bloque onClick={cerrarExplicacion}><Texto>Entendido, a jugar</Texto></Boton>}
      >
        {obstaculo && <p className={s.ayudaTexto}><Texto>{obstaculo.texto}</Texto></p>}
      </HojaInferior>

      <HojaInferior
        abierta={sinToques && Boolean(partida?.perdida)}
        onCerrar={() => setSinToques(false)}
        titulo={lv?.penales ? 'Michi ganó los penales' : 'Se acabaron los toques'}
        pie={(
          <div className={s.accionesHoja}>
            {quedan.toque > 0 && <Boton bloque icono={<Plus aria-hidden="true" />} onClick={toqueDeMas}><Texto>{lv?.penales ? 'Un tiro más' : 'Un toque más'}</Texto></Boton>}
            {quedan.repetir > 0 && juego?.pasados.length > 0 && <Boton bloque variante="secundario" icono={<Undo2 aria-hidden="true" />} onClick={repetirTiro}><Texto>Repetir el último tiro</Texto></Boton>}
            <Boton bloque variante={quedan.toque > 0 ? 'fantasma' : 'primario'} icono={<RotateCcw aria-hidden="true" />} onClick={reiniciar}><Texto>Reiniciar el nivel</Texto></Boton>
          </div>
        )}
      >
        <p className={s.ayudaTexto}>
          <Texto>{lv?.penales ? 'Ya no alcanzan los tiros para los goles que faltan. Usa una ayuda o vuelve a intentarlo (eso corta la racha).' : 'No entró esta vez. Usa una ayuda o empieza el nivel de nuevo (eso corta la racha).'}</Texto>
        </p>
      </HojaInferior>

      <VestuarioPichanga abierto={vestuario} onCerrar={() => setVestuario(false)} progreso={prog} onElegir={elegirPrenda} />

      {finPartido ? (
        <ResultadoJuego
          abierta={resultado}
          onCerrar={() => setResultado(false)}
          ocupado={ocupado}
          titulo={finPartido.fin === 'yo' ? '¡Le ganaste a Michi!' : finPartido.fin === 'kapi' ? 'Esta vez ganó Michi' : '¡Empate!'}
          imagen={finPartido.fin === 'yo' ? CARAS_KAPI.feliz : finPartido.fin === 'kapi' ? CARAS_KAPI.triste : CARAS_KAPI.hambre}
          texto={(
            <div className={s.logro}>
              <p className={c.resultadoMarcador}>{`${finPartido.goles.yo} – ${finPartido.goles.kapi}`}</p>
              <p className={s.notaSuave}>
                <TextoResaltado resaltar={[prog.partidos.ganados, prog.partidos.jugados]}>{`Llevas ${prog.partidos.ganados} partidos ganados de ${prog.partidos.jugados}.`}</TextoResaltado>
              </p>
            </div>
          )}
          acciones={(
            <>
              <Boton bloque icono={<RotateCcw aria-hidden="true" />} onClick={partidoOtraVez}><Texto>Otro partido</Texto></Boton>
              {repeticion.current && <Boton bloque variante="secundario" icono={<Film aria-hidden="true" />} onClick={verRepeticion}><Texto>Ver el último gol</Texto></Boton>}
              <Boton bloque variante="fantasma" icono={<Gamepad2 aria-hidden="true" />} onClick={() => { setResultado(false); cambiarModo('niveles'); }}><Texto>Ir a los niveles</Texto></Boton>
            </>
          )}
        >
          <Desbloqueos lista={finPartido.desbloqueos} />
        </ResultadoJuego>
      ) : (
        <ResultadoJuego
          abierta={resultado && Boolean(logro)}
          onCerrar={() => setResultado(false)}
          ocupado={ocupado || acreditando}
          titulo={logro?.reto ? '¡Reto del día completado!' : logro?.penales ? '¡Le ganaste los penales a Michi!' : `¡Nivel ${logro?.numero} completado!`}
          imagen={CARAS_KAPI.feliz}
          texto={logro && (
            <div className={s.logro}>
              <EstrellasNivel valor={logro.estrellas} tamano="lg" animar />
              <p>
                <TextoResaltado resaltar={[logro.toques]}>
                  {logro.penales ? `Lo lograste en ${logro.toques} tiros.` : logro.toques === 1 ? '¡Gol de un toque!' : `Gol en ${logro.toques} toques.`}
                </TextoResaltado>
              </p>
              {logro.record && <p className={s.record}><Texto>¡Nuevo récord en este nivel!</Texto></p>}
              {logro.reto && sesion && <p className={s.notaSuave}><Texto>Tu mejor marca de hoy cuenta para el ranking del reto.</Texto></p>}
              {logro.estrellas < 3 && lv && (
                <p className={s.notaSuave}>
                  <TextoResaltado resaltar={[lv.par]}>{`Para 3 estrellas: ${lv.par} ${lv.penales ? 'tiros' : 'toques'} o menos.`}</TextoResaltado>
                </p>
              )}
              {logro.mundoCompleto && (
                <p className={s.mundoCompleto}>
                  <Texto>
                    {logro.mundoCompleto < ULTIMO_MUNDO
                      ? `¡Venciste al jefe! Se abre el mundo ${logro.mundoCompleto + 1}: ${infoMundo(logro.mundoCompleto + 1).nombre}.`
                      : '¡Venciste al último jefe! Pronto llegan más mundos.'}
                  </Texto>
                </p>
              )}
            </div>
          )}
          acciones={(
            <>
              <Boton bloque icono={<ArrowRight aria-hidden="true" />} onClick={siguiente} disabled={ocupado || acreditando}>
                <Texto>{logro?.reto ? 'Seguir con los niveles' : (logro?.numero || 0) >= TOTAL ? 'Terminar' : `Ir al nivel ${(logro?.numero || 0) + 1}`}</Texto>
              </Boton>
              {repeticion.current && <Boton bloque variante="secundario" icono={<Film aria-hidden="true" />} onClick={verRepeticion} disabled={ocupado || acreditando}><Texto>Ver la repetición</Texto></Boton>}
              {logro && logro.estrellas < 3 && (
                <Boton bloque variante="fantasma" icono={<RotateCcw aria-hidden="true" />} onClick={repetirNivel} disabled={ocupado || acreditando}>
                  <Texto>{logro.reto ? 'Mejorar mi marca' : 'Repetir por 3 estrellas'}</Texto>
                </Boton>
              )}
            </>
          )}
        >
          {logro?.cofre && (
            <div className={s.cofre} data-componente="CofrePichanga">
              <Gift aria-hidden="true" className={s.cofreIcono} />
              <div>
                <p className={s.cofreTitulo}>
                  <TextoResaltado resaltar={[logro.racha]}>{`¡Racha de ${logro.racha}! Abriste un cofre`}</TextoResaltado>
                </p>
                <p className={s.cofreTexto}><Texto>{`Ganaste ${textoAyuda(logro.cofre.tipo, logro.cofre.cantidad)}. Se guarda para cuando se acaben las del nivel.`}</Texto></p>
              </div>
            </div>
          )}
          {premio && <PremioJuego {...premio} urlLogin={urlLogin} />}
          <Desbloqueos lista={logro?.desbloqueos} />
        </ResultadoJuego>
      )}
    </>
  );
}
