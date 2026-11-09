import React, { useEffect, useRef, useState } from 'react';
import {
  Gamepad2, RotateCcw, Undo2, Eye, Plus, ArrowRight, Map as IconoMapa, Crown, Lock, ChevronLeft, ChevronRight,
  Flame, Gift, Volume2, VolumeX, Vibrate, VibrateOff, Star, Trophy, Shirt, Film, Swords, Check,
} from 'lucide-react';
import Boton from '../Boton';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { HojaInferior } from '../Feedback';
import { Pestanas } from '../Navegacion';
import { Estallido } from '../Efectos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { BarraProgreso } from '../piezas/BarraProgreso';
import { MarcoJuego, BotonIrAlPanel, AyudaJuego, ResultadoJuego, CifrasJuego, TextoResaltado } from '../piezas/Juegos';
import { EstrellasNivel } from '../piezas/Bolitas';
import { CanchaPichanga, MuestraPichanga, MuestraEstadio, EQUIPO_KAPI } from '../piezas/Pichanga';
import { efectoPichanga } from '../piezas/efectosPichanga';
import {
  progresoPichanga, nuevosDesbloqueos, desbloqueado, textoDesbloqueo, estrellasTotales,
  EQUIPOS_PICHANGA, PELOTAS_PICHANGA, ESTADIOS_PICHANGA,
} from '../piezas/pichangaProgreso.mjs';
import {
  simular, jugarTiro, partidaNivel, indicePelota, mundoDe, infoMundo, esJefe, estrellasPara, premioCofre,
  RACHA_COFRE, AYUDAS_PICHANGA, partidoNuevo, canchaPartido, despuesDelTiroPartido, jugadaDeKapi, GOLES_PARTIDO,
} from '../piezas/pichangaMotor.mjs';
import { nivelPichanga, TOTAL_NIVELES_PICHANGA } from '../piezas/pichangaNiveles.mjs';
import { Texto, useTexto } from '../Traduccion';
import s from './Juegos.module.css';
import c from '../piezas/Pichanga.module.css';

/* ── La Pichanga de Kapi (/pichanga) ───────────────────── */

// Lo que se guarda del jugador y el vestuario: piezas/pichangaProgreso.mjs.
export { PROGRESO_PICHANGA, progresoPichanga, unirProgresos } from '../piezas/pichangaProgreso.mjs';

const TOTAL = TOTAL_NIVELES_PICHANGA;
const ULTIMO_MUNDO = mundoDe(TOTAL);
const CANCHA_PARTIDO = canchaPartido();

/* Cómo se explica cada obstáculo la primera vez que aparece. */
const OBSTACULOS = {
  rivales: { titulo: 'Nuevo: las chapas de Kapi', texto: 'Las chapas rojas son del equipo de Kapi. Estorban, pero también se pueden empujar: úsalas para rebotar.' },
  conos: { titulo: 'Nuevo: conos', texto: 'Los conos naranjas no se mueven. La pelota rebota en ellos: búscale el ángulo.' },
  kapi: { titulo: 'Nuevo: Kapi de arquero', texto: 'Kapi cuida el arco y va de lado a lado mientras la pelota rueda. Míralo bien antes de tirar: se mueve después de que sueltas.' },
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

const juegoNuevo = (n) => {
  const lv = nivelPichanga(n);
  return { clave: n, lv, partida: partidaNivel(lv), pasados: [], usos: { vista: 0, repetir: 0, toque: 0 }, extras: 0, vistaActiva: false };
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
        {clase === 'estadio' && <p className={s.notaSuave}><Texto>La cancha es la del partido contra Kapi. Los niveles usan la de su mundo.</Texto></p>}
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
 *  - progreso (ver PROGRESO_PICHANGA) · onProgreso(progreso): cada cambio, para guardarlo
 *  - onCompletar({ modo: 'nivel' | 'partido', … }): cada nivel ganado o partido
 *    terminado (la analítica). El nivel trae { nivel, toques, estrellas, tiros, extras }:
 *    lo que el servidor podrá comprobar
 *  - vistaInicial: 'juego' | 'mapa' · modoInicial: 'niveles' | 'partido'
 *  - ayudaVista · onAyudaVista · estado: 'cargando' · monedas: { saldo, cargando } (MarcoJuego)
 * Los textos pasan por la traducción.
 */
export function PaginaPichanga({
  progreso, onProgreso, onCompletar, vistaInicial = 'juego', modoInicial = 'niveles', ayudaVista = true, onAyudaVista, estado, monedas,
}) {
  const [prog, setProg] = useState(() => progresoPichanga(progreso));
  const [modo, setModo] = useState(modoInicial);
  const [vista, setVista] = useState(vistaInicial);
  const [numero, setNumero] = useState(() => Math.min(progresoPichanga(progreso).nivel, TOTAL));
  const [mundoMapa, setMundoMapa] = useState(() => mundoDe(Math.min(progresoPichanga(progreso).nivel, TOTAL)));
  const [juego, setJuego] = useState(null);
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
  const [gol, setGol] = useState(null);
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
    vestuario: useTexto('Vestuario'),
  };

  // El nivel: se arma al cambiar de número (y la primera vez).
  useEffect(() => {
    if (estado === 'cargando' || modo !== 'niveles') return;
    if (juego?.clave === numero) return;
    const nuevo = juegoNuevo(numero);
    setJuego(nuevo);
    setRuta(null);
    const obstaculo = nuevo.lv.obstaculos.find((o) => !prog.vistos.includes(o));
    if (obstaculo) setExplicar(obstaculo);
    else if (nuevo.lv.penales) setAviso(`¡Jefe! Penales contra Kapi: mete ${nuevo.lv.penales.goles} de ${nuevo.lv.penales.tiros}.`);
  }, [numero, modo, estado]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const animar = (sim, cuerpos, t0, despues, velocidad = 1) => {
    const id = `${Date.now()}-${Math.random()}`;
    finRef.current = { id, despues };
    setAnim({ id, cuadros: sim.cuadros, golpes: sim.golpes, t0, velocidad, cuerpos });
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
      const tiro = jugadaDeKapi(partido.mesa, CANCHA_PARTIDO, { dificultad: prog.dificultad });
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

  if (estado === 'cargando' || (modo === 'niveles' && !juego)) return <EsqueletoPagina forma="pichanga" />;

  const esPartido = modo === 'partido';
  const equipo = buscar(EQUIPOS_PICHANGA, prog.equipo);
  const pelota = buscar(PELOTAS_PICHANGA, prog.pelota);
  const estadio = buscar(ESTADIOS_PICHANGA, prog.estadio);
  const mundo = mundoDe(numero);
  const infoM = infoMundo(mundo);
  const lv = juego?.lv;
  const partida = juego?.partida;
  const ocupado = Boolean(anim);
  const verMapa = vista === 'mapa' && !esPartido;

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

  const tirosHechos = partida?.tiros.length || 0;
  const toquesQuedan = lv ? Math.max(0, lv.toques + juego.extras - tirosHechos) : 0;
  const enJuego = tirosHechos > 0 && !partida?.ganada;

  /** Reiniciar o dejar un nivel empezado corta la racha. */
  const cortarRacha = () => {
    if (!enJuego || !prog.racha) return;
    guardar({ racha: 0 });
    setAviso('Se cortó tu racha de victorias.');
  };

  const ganarNivel = (nivelJugado, final, extras) => {
    const p = progRef.current;
    const n = nivelJugado.numero;
    const toques = final.tiros.length;
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
    setJuego({ ...antes, usos, vistaActiva: false });
    animar(sim, partida.mesa.cuerpos, partida.mesa.t, () => {
      setJuego((j) => ({ ...j, partida: nueva, pasados: [...j.pasados, partida] }));
      const atajo = sim.golpes.some(([, tipo]) => tipo === 'kapi');
      if (sim.gol === 'arriba') {
        fx('gol');
        setGol(Date.now());
        repeticion.current = { sim, cuerpos: partida.mesa.cuerpos, t0: partida.mesa.t };
        if (lv.penales && !nueva.ganada) setAviso(`¡Gol! Llevas ${nueva.goles} de ${lv.penales.goles}.`);
      } else if (lv.penales) {
        fx('fallo');
        setAviso(atajo ? '¡Atajó Kapi!' : '¡Afuera!');
      }
      if (nueva.ganada) ganarNivel(lv, nueva, antes.extras);
      else if (nueva.perdida) { fx('fallo'); setSinToques(true); }
    });
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
    setJuego(juegoNuevo(numero));
    setSinToques(false);
    setRuta(null);
  };

  const irANivel = (n) => {
    if (ocupado) return;
    if (n !== numero || modo !== 'niveles') cortarRacha();
    setModo('niveles');
    setNumero(n);
    setMundoMapa(mundoDe(n));
    if (n !== numero) setJuego(null);
    setVista('juego');
    setResultado(false);
    setSinToques(false);
  };

  const siguiente = () => {
    if (ocupado) return;
    setResultado(false);
    if (numero >= TOTAL) {
      setAviso('¡Terminaste todos los niveles! Pronto llegan más mundos. Mientras, juega contra Kapi.');
      return;
    }
    irANivel(numero + 1);
  };

  const repetirNivel = () => {
    setResultado(false);
    setJuego(juegoNuevo(numero));
  };

  const verRepeticion = () => {
    const r = repeticion.current;
    if (!r || ocupado) return;
    setResultado(false);
    animar(r.sim, r.cuerpos, r.t0, () => setResultado(true), 0.4);
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
    animar(sim, antes.mesa.cuerpos, antes.mesa.t, () => {
      const nuevo = despuesDelTiroPartido({ ...antes, turno: quien }, sim);
      setPartido(nuevo);
      if (sim.gol) {
        const mio = sim.gol === 'arriba';
        fx(mio ? 'gol' : 'golKapi');
        if (mio) setGol(Date.now());
        repeticion.current = { sim, cuerpos: antes.mesa.cuerpos, t0: antes.mesa.t };
        let texto;
        if (mio) texto = quien === 'yo' ? '¡GOOOL!' : '¡Autogol de Kapi!';
        else texto = quien === 'kapi' ? 'Gol de Kapi.' : 'Uy, autogol.';
        setAviso(texto);
      }
      if (nuevo.fin) terminarPartido(nuevo);
    });
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
    if (m === modo || ocupado) return;
    if (m === 'partido') cortarRacha();
    setModo(m);
    setVista('juego');
    setResultado(false);
    setSinToques(false);
    setRuta(null);
    if (m === 'partido' && !partido.tiros.yo && !partido.tiros.kapi) fx('silbato');
  };

  const elegirPrenda = (clase, id) => guardar({ [clase]: id });

  const cerrarExplicacion = () => {
    const tipo = explicar;
    setExplicar(null);
    if (!prog.vistos.includes(tipo)) guardar({ vistos: [...prog.vistos, tipo] });
    if (lv?.penales) setAviso(`¡Jefe! Penales contra Kapi: mete ${lv.penales.goles} de ${lv.penales.tiros}.`);
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
      <Boton variante="fantasma" tamano="sm" soloIcono aria-label={t.vestuario} onClick={() => setVestuario(true)} icono={<Shirt aria-hidden="true" />} />
      <Boton variante="fantasma" tamano="sm" soloIcono aria-label={t.sonido} aria-pressed={prog.sonido} onClick={() => guardar({ sonido: !prog.sonido })}
        icono={prog.sonido ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
      />
      <Boton variante="fantasma" tamano="sm" soloIcono aria-label={t.vibracion} aria-pressed={prog.vibracion} onClick={() => guardar({ vibracion: !prog.vibracion })}
        icono={prog.vibracion ? <Vibrate aria-hidden="true" /> : <VibrateOff aria-hidden="true" />}
      />
    </>
  );

  let turnoTexto = null;
  if (esPartido) {
    if (partido.fin) turnoTexto = partido.fin === 'yo' ? '¡Ganaste!' : partido.fin === 'kapi' ? 'Ganó Kapi' : 'Empate';
    else if (ocupado) turnoTexto = 'Rueda la pelota…';
    else if (partido.turno === 'kapi') turnoTexto = 'Kapi está pensando…';
    else turnoTexto = 'Tu turno: arrastra una de tus chapas';
  }

  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }} className={s.seccionJuego}>
        <MarcoJuego titulo="La Pichanga de Kapi" onAyuda={() => setAyuda(true)} acciones={interruptores} monedas={monedas}>
          <div className={s.bolitas} data-componente="PaginaPichanga">
            <div className={[s.mesa, s.mesaMundo, c.mesa].join(' ')} style={{ '--mundo-a': '#dcfce7', '--mundo-b': '#ede9fe' }}>
              <span className={s.fiesta} aria-hidden="true">
                <Estallido disparo={gol} forma="confeti" cantidad={26} distancia={150} colores={['#8b5cf6', '#f472b6', '#fbbf24', '#60a5fa', '#34d399']} />
              </span>
              <div className={s.modos}>
                <Pestanas
                  etiqueta="Modo de juego"
                  opciones={[{ id: 'niveles', texto: 'Niveles' }, { id: 'partido', texto: 'Contra Kapi' }]}
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
                        <Texto>Kapi</Texto>
                        <MuestraPichanga item={EQUIPO_KAPI} tamano={30} />
                      </span>
                      <span className={c.turno}><Texto>{turnoTexto}</Texto></span>
                    </div>
                  ) : (
                    <div className={s.cabezaNivel}>
                      <div>
                        <p className={s.mundoLinea}>
                          <TextoResaltado resaltar={[mundo]}>{`Mundo ${mundo}`}</TextoResaltado>
                          {' · '}<Texto>{infoM.nombre}</Texto>
                        </p>
                        <p className={s.nivelTitulo}>
                          {lv.jefe && <Crown className={s.coronaTitulo} aria-hidden="true" />}
                          <TextoResaltado resaltar={[numero]}>{lv.jefe ? `Nivel ${numero} · Penales` : `Nivel ${numero}`}</TextoResaltado>
                        </p>
                        <p className={s.metaEstrellas}>
                          {lv.penales ? (
                            <TextoResaltado resaltar={[partida.goles, lv.penales.goles, toquesQuedan]}>
                              {`Goles: ${partida.goles} de ${lv.penales.goles} · quedan ${toquesQuedan} tiros`}
                            </TextoResaltado>
                          ) : (
                            <>
                              {/* Las que llevaría con gol en el próximo toque (o las ganadas). */}
                              <EstrellasNivel valor={estrellasPara(partida.ganada ? tirosHechos : tirosHechos + 1, lv.par)} tamano="md" />
                              <TextoResaltado resaltar={[lv.par]}>{lv.par === 1 ? '3 estrellas con gol de 1 toque' : `3 estrellas con ${lv.par} toques o menos`}</TextoResaltado>
                            </>
                          )}
                        </p>
                      </div>
                      <div className={c.cabezaDerecha}>
                        {!lv.penales && (
                          <span className={[c.quedan, toquesQuedan <= 1 && c.quedanPocos].filter(Boolean).join(' ')}>
                            <TextoResaltado resaltar={[toquesQuedan]}>{toquesQuedan === 1 ? 'Queda 1 toque' : `Quedan ${toquesQuedan} toques`}</TextoResaltado>
                          </span>
                        )}
                        <Boton variante="secundario" tamano="sm" icono={<IconoMapa aria-hidden="true" />} onClick={() => { setMundoMapa(mundo); setVista('mapa'); }}><Texto>Mapa</Texto></Boton>
                      </div>
                    </div>
                  )}

                  <div className={s.mensajeZona} aria-live="polite">
                    {aviso && <span key={aviso} className={s.mensaje}><Texto>{aviso}</Texto></span>}
                  </div>

                  <div className={c.zonaCancha}>
                    <CanchaPichanga
                      def={def}
                      cuerpos={anim ? anim.cuerpos : mesa.cuerpos}
                      t={mesa.t}
                      equipo={equipo}
                      pelota={pelota}
                      pasto={esPartido ? estadio.pasto : infoM.pasto}
                      linea={esPartido ? estadio.linea : infoM.linea}
                      puedeTirar={puedeTirar}
                      onTiro={(tiro) => (esPartido ? tirarPartido(tiro, 'yo') : tirarNivel(tiro))}
                      onApuntar={esPartido ? undefined : alApuntar}
                      ruta={ruta}
                      animacion={anim}
                      onFinAnimacion={alFinAnimacion}
                      onGolpe={alGolpe}
                      resaltar={resaltar}
                      etiqueta={esPartido ? 'La cancha del partido contra Kapi' : `La cancha del nivel ${numero}`}
                    />
                    {gol && <span key={gol} className={c.gol} aria-hidden="true">¡GOL!</span>}
                  </div>

                  <div className={s.botonesMesa}>
                    {esPartido ? (
                      <Boton variante={partido.fin ? 'primario' : 'fantasma'} icono={<RotateCcw aria-hidden="true" />} onClick={partidoOtraVez} disabled={ocupado}>
                        <Texto>{partido.fin ? 'Otro partido' : 'Empezar de nuevo'}</Texto>
                      </Boton>
                    ) : partida.ganada ? (
                      <>
                        <Boton icono={<ArrowRight aria-hidden="true" />} onClick={siguiente} disabled={ocupado}>
                          <Texto>{numero >= TOTAL ? 'Terminar' : 'Siguiente nivel'}</Texto>
                        </Boton>
                        {!resultado && <Boton variante="secundario" icono={<Eye aria-hidden="true" />} onClick={() => setResultado(true)} disabled={ocupado}><Texto>Ver resultado</Texto></Boton>}
                      </>
                    ) : (
                      <>
                        <Boton variante={juego.vistaActiva ? 'primario' : 'secundario'} icono={<Eye aria-hidden="true" />} onClick={alternarVista} aria-pressed={juego.vistaActiva}
                          disabled={ocupado || (!juego.vistaActiva && quedan.vista <= 0)}
                        >
                          <Texto>Ver el tiro</Texto>{contador(quedan.vista)}
                        </Boton>
                        <Boton variante="secundario" icono={<Undo2 aria-hidden="true" />} onClick={repetirTiro} disabled={ocupado || !juego.pasados.length || quedan.repetir <= 0}>
                          <Texto>Repetir tiro</Texto>{contador(quedan.repetir)}
                        </Boton>
                        <Boton variante="secundario" icono={<Plus aria-hidden="true" />} onClick={toqueDeMas} disabled={ocupado || quedan.toque <= 0}>
                          <Texto>{lv.penales ? 'Un tiro más' : 'Un toque más'}</Texto>{contador(quedan.toque)}
                        </Boton>
                        <Boton variante="fantasma" icono={<RotateCcw aria-hidden="true" />} onClick={reiniciar} disabled={ocupado}><Texto>Reiniciar</Texto></Boton>
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
                ) : (
                  <>
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
          'Cada nivel tiene pocos toques. Con menos toques ganas más estrellas (hasta 3). El último de cada mundo es una tanda de penales contra Kapi.',
          <TextoResaltado key="racha" resaltar={[RACHA_COFRE]}>
            {`Gana ${RACHA_COFRE} niveles seguidos sin reiniciar y abre un cofre: ayudas que se guardan para cuando se acaben las del nivel.`}
          </TextoResaltado>,
          'En «Contra Kapi» juegas un partido por turnos: gana quien meta 3 goles.',
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
        titulo={lv?.penales ? 'Kapi ganó los penales' : 'Se acabaron los toques'}
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
          titulo={finPartido.fin === 'yo' ? '¡Le ganaste a Kapi!' : finPartido.fin === 'kapi' ? 'Esta vez ganó Kapi' : '¡Empate!'}
          imagen={finPartido.fin === 'kapi' ? CARAS_KAPI.feliz : finPartido.fin === 'yo' ? CARAS_KAPI.triste : CARAS_KAPI.hambre}
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
          ocupado={ocupado}
          titulo={logro?.penales ? '¡Le ganaste los penales a Kapi!' : `¡Nivel ${logro?.numero} completado!`}
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
              <Boton bloque icono={<ArrowRight aria-hidden="true" />} onClick={siguiente} disabled={ocupado}>
                <Texto>{(logro?.numero || 0) >= TOTAL ? 'Terminar' : `Ir al nivel ${(logro?.numero || 0) + 1}`}</Texto>
              </Boton>
              {repeticion.current && <Boton bloque variante="secundario" icono={<Film aria-hidden="true" />} onClick={verRepeticion} disabled={ocupado}><Texto>Ver la repetición</Texto></Boton>}
              {logro && logro.estrellas < 3 && (
                <Boton bloque variante="fantasma" icono={<RotateCcw aria-hidden="true" />} onClick={repetirNivel} disabled={ocupado}><Texto>Repetir por 3 estrellas</Texto></Boton>
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
          <Desbloqueos lista={logro?.desbloqueos} />
        </ResultadoJuego>
      )}
    </>
  );
}
