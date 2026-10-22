import React, { useEffect, useRef, useState } from 'react';
import { LayoutGroup } from 'framer-motion';
import {
  Gamepad2, RotateCcw, Undo2, Eye, Plus, Lightbulb, ArrowRight, Map as IconoMapa, Crown, Lock, ChevronLeft, ChevronRight,
  Flame, Gift, Volume2, VolumeX, Vibrate, VibrateOff, Star,
} from 'lucide-react';
import Boton from '../Boton';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { Aviso, HojaInferior } from '../Feedback';
import { Pestanas } from '../Navegacion';
import { Estallido } from '../Efectos';
import { FondoBolitas, escenaDelMundo } from '../piezas/FondoBolitas';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { BarraProgreso } from '../piezas/BarraProgreso';
import { MarcoJuego, AyudaJuego, PremioJuego, ResultadoJuego, CifrasJuego, TextoResaltado } from '../piezas/Juegos';
import {
  TuboBolitas, EstrellasNivel, RankingBolitas, MarcaBolitas, PatrocinioBolitas, CuponGanado, ProductosMarca,
} from '../piezas/Bolitas';
import { efectoBolitas } from '../piezas/efectosBolitas';
import { progresoBolitas } from '../piezas/bolitasProgreso.mjs';
import {
  nivel as nivelNumero, retoDelDia, puedeMover, mover, resuelto, tubosListos, hayMovimientos, agregarTubo, volverA, pista,
  cerrado, tramo, tuboListo, COLORES, mundoDe, infoMundo, esJefe, estrellasPara, metasEstrellas, premioCofre, RACHA_COFRE,
} from '../piezas/bolitasMotor.mjs';
import { Texto, useTexto } from '../Traduccion';
import s from './Juegos.module.css';

/* ── Las Bolitas de Kapi (/ball-sort) ───────────────────── */

/** Las ayudas de cada nivel (vuelven a estar completas al reiniciarlo). */
export const AYUDAS_BOLITAS = { deshacer: 5, tubo: 1, pista: 3 };

// Lo que se guarda del jugador y cómo se une lo del aparato con lo de la
// cuenta: piezas/bolitasProgreso.mjs (puro, con pruebas).
export { PROGRESO_BOLITAS, progresoBolitas, unirProgresos } from '../piezas/bolitasProgreso.mjs';

/* Cómo se explica cada obstáculo la primera vez que aparece. */
const OBSTACULOS = {
  ocultas: {
    titulo: 'Nuevo: bolitas ocultas',
    texto: 'Algunas bolitas se ven como «?». Su color aparece cuando quedan arriba de su tubo, y ya no se vuelve a tapar.',
    ejemplo: [{ id: 'o1', c: 1, oculta: true }, { id: 'o2', c: 2, oculta: true }, { id: 'o3', c: 0 }],
  },
  cortina: {
    titulo: 'Nuevo: tubos con cortina',
    texto: 'Un tubo con cortina no se puede usar. Se abre cuando completas un tubo del color que muestra la cortina.',
    ejemplo: [{ id: 'k1', c: 2 }, { id: 'k2', c: 3 }],
    cortina: 0,
  },
  hielo: {
    titulo: 'Nuevo: bolitas congeladas',
    texto: 'Una bolita congelada no se mueve. El número dice cuántos movimientos faltan para que se derrita: cualquier movimiento cuenta.',
    ejemplo: [{ id: 'h1', c: 1 }, { id: 'h2', c: 0, hielo: 3 }],
  },
};

const NOMBRE_AYUDA = { pista: ['pista', 'pistas'], tubo: ['tubo de más', 'tubos de más'], deshacer: ['para deshacer', 'para deshacer'] };
const textoAyuda = (tipo, n) => `${n} ${NOMBRE_AYUDA[tipo][n === 1 ? 0 : 1]}`;

/* Los niveles se arman una vez y quedan guardados: el siguiente se prepara
   mientras se ve el resultado, para que en el celular no haya espera. */
const armados = new Map();
function armado(modo, numero, fecha) {
  const clave = modo === 'reto' ? `reto:${fecha}` : `nivel:${numero}`;
  if (!armados.has(clave)) armados.set(clave, modo === 'reto' ? retoDelDia(fecha) : nivelNumero(numero));
  return armados.get(clave);
}
const enReposo = (fn) => {
  if (typeof window !== 'undefined' && window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 300);
};

/* Una partida: el estado, los pasos de antes (para deshacer), los movimientos
   que valen (deshacer los saca) y los tubos agregados: eso es lo que se manda
   al servidor para comprobarla. */
const partidaNueva = (lv, clave) => ({
  clave, nivel: lv, estado: lv.estado, pasados: [], jugadas: [], extras: 0, usos: { deshacer: 0, tubo: 0, pista: 0 }, pista: null, ganada: false,
});

/** Columnas de la mesa: una fila con pocos tubos, dos con muchos. */
const columnas = (n) => ({
  '--col-escritorio': n <= 6 ? n : Math.ceil(n / 2),
  '--col-movil': n <= 4 ? n : n <= 6 ? 3 : Math.ceil(n / 2),
});

/** Los colores del mundo para el fondo de la mesa (los de su marca, si tiene). */
const fondoMundo = (m, marca) => {
  if (marca?.color) return { '--mundo-a': marca.color, '--mundo-b': marca.color2 || marca.color };
  const { fondo } = infoMundo(m);
  return { '--mundo-a': fondo[0], '--mundo-b': fondo[1] };
};

/** La marca de un mundo: las de los mundos se repiten en orden (o ninguna). */
const marcaDelMundo = (marcas, m) => (marcas?.length ? marcas[(m - 1) % marcas.length] : null);

/**
 * El mapa de un mundo: sus 20 niveles con las estrellas ganadas; los que
 * faltan abrir, con candado; el último, el jefe.
 */
function MapaBolitas({ mundo, marca, progreso, actual, onElegir, onMundo, onClicMarca }) {
  const info = infoMundo(mundo);
  const ultimo = mundoDe(progreso.nivel);
  const niveles = Array.from({ length: info.hasta - info.desde + 1 }, (_, k) => info.desde + k);
  const ganadas = niveles.reduce((t, n) => t + (progreso.estrellas[n] || 0), 0);
  const t = { anterior: useTexto('Mundo anterior'), siguiente: useTexto('Mundo siguiente') };
  return (
    <div className={s.mapa} data-componente="MapaBolitas">
      <div className={s.mapaCabeza}>
        <Boton variante="fantasma" tamano="sm" soloIcono icono={<ChevronLeft aria-hidden="true" />} aria-label={t.anterior} disabled={mundo <= 1} onClick={() => onMundo(mundo - 1)} />
        <div className={s.mapaTitulo}>
          <p className={s.mundoNumero}><TextoResaltado resaltar={[mundo]}>{`Mundo ${mundo}`}</TextoResaltado></p>
          {marca
            ? <MarcaBolitas marca={marca} tamano="md" onClick={() => onClicMarca?.({ marcaId: marca.id, destino: 'marca' })} />
            : <p className={s.mundoNombre}><Texto>{info.nombre}</Texto></p>}
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

/**
 * Las Bolitas de Kapi: ordenar los colores en los tubos. Niveles en mundos de
 * 20 (el último, un jefe), de 1 a 3 estrellas según los movimientos, una
 * racha de victorias que abre cofres con ayudas, el reto del día, sonido y
 * vibración. Se toca un tubo para levantar las bolitas de arriba del mismo
 * color y otro para soltarlas (se mueven todas las que quepan). Desde el
 * nivel 12 aparecen los obstáculos. Ganar (un nivel o el reto) da monedas una
 * vez al día; sin cuenta se juega igual (el premio invita a entrar).
 *  - sesion · yaHoy (ya cobró hoy) · monto (2)
 *  - onGanar({ movimientos, partida }): cobra; promesa → { monto } | { ya: true }
 *    (si falla, lanza). Solo con sesión y si no cobró hoy. `partida` es lo que
 *    el servidor comprueba: { modo: 'nivel' | 'reto', nivel | fecha,
 *    movimientos: [[de, a]…], tubos }
 *  - onRegistrar(partida): cada victoria con sesión después de cobrar (la
 *    misión del día y el ranking del reto); lo que pase no se muestra
 *  - onCompletar({ modo, nivel | fecha, movimientos, estrellas }): cada victoria
 *  - progreso (ver PROGRESO_BOLITAS) · onProgreso(progreso): cada cambio, para guardarlo
 *  - hoy ('AAAA-MM-DD', el día de Lima: sin él no hay reto)
 *  - ranking (del reto: ver RankingBolitas) · cargandoRanking ·
 *    onPedirRanking(): al entrar al reto, para traerlo
 *  - marcasMundos: [{ id, nombre, logo, url, color, color2 }] las marcas de
 *    los mundos, en orden (se repiten): el mundo toma sus colores y su logo
 *  - patrocinio (del reto de hoy): { marca, texto, quedan }
 *  - onPedirProductos(marcaId) → promesa de [{ url, imagen, nombre, precio }]:
 *    al vencer el jefe de un mundo de marca o el reto patrocinado
 *  - onClicMarca({ marcaId, destino: 'marca' | 'producto' }): para las métricas
 *  - el resultado de onGanar / onRegistrar puede traer `cupon` (el del reto
 *    patrocinado): { code, titulo, texto, expiraEn, marcaNombre }
 *  - inicial: { estado, colores, par } para empezar en un tablero puesto (la demo)
 *  - vistaInicial: 'juego' | 'mapa' · ayudaVista · onAyudaVista · estado: 'cargando'
 * Mientras se acredita, la hoja no se cierra y no se pasa de nivel.
 * Los textos pasan por la traducción.
 */
export function PaginaBolitas({
  sesion = true, yaHoy = false, monto = 2, onGanar, onRegistrar, onCompletar, hoy, progreso, onProgreso,
  ranking, cargandoRanking = false, onPedirRanking,
  marcasMundos = [], patrocinio, onPedirProductos, onClicMarca,
  inicial, vistaInicial = 'juego', ayudaVista = true, onAyudaVista, urlLogin = '/login', estado,
}) {
  const [prog, setProg] = useState(() => progresoBolitas(progreso));
  const [modo, setModo] = useState('niveles');
  const [vista, setVista] = useState(vistaInicial);
  const [numero, setNumero] = useState(() => progresoBolitas(progreso).nivel);
  const [mundoMapa, setMundoMapa] = useState(() => mundoDe(progresoBolitas(progreso).nivel));
  const [partidas, setPartidas] = useState({});
  const [elegido, setElegidoEstado] = useState(null);
  // También en una referencia: dos toques seguidos (antes de que se vuelva a
  // pintar, en un celular lento) leen el tubo elegido de verdad.
  const elegidoRef = useRef(null);
  const setElegido = (i) => { elegidoRef.current = i; setElegidoEstado(i); };
  const [resultado, setResultado] = useState(false);
  const [premio, setPremio] = useState(null);
  const [logro, setLogro] = useState(null);
  const [cobrado, setCobrado] = useState(yaHoy);
  const [ayuda, setAyuda] = useState(!ayudaVista);
  const [explicar, setExplicar] = useState(null);
  const [atascado, setAtascado] = useState(false);
  const [aviso, setAviso] = useState(null);
  // Los productos de la marca que se muestran en el resultado: { marca, lista, cargando }.
  const [vitrina, setVitrina] = useState(null);
  const inicialUsado = useRef(false);
  const t = {
    sonido: useTexto(prog.sonido ? 'Silenciar' : 'Activar el sonido'),
    vibracion: useTexto(prog.vibracion ? 'Quitar la vibración' : 'Activar la vibración'),
  };

  // El perfil puede llegar (o refrescarse) después: si ya cobró hoy, no se vuelve a intentar.
  useEffect(() => { if (yaHoy) setCobrado(true); }, [yaHoy]);

  const clave = modo === 'reto' ? `reto:${hoy}` : `nivel:${numero}`;
  const p = partidas[modo]?.clave === clave ? partidas[modo] : null;

  // Arma el nivel después de pintar (lo que tarde no traba la página).
  useEffect(() => {
    if (estado === 'cargando' || p) return undefined;
    const id = setTimeout(() => {
      let lv;
      if (inicial && modo === 'niveles' && !inicialUsado.current) {
        inicialUsado.current = true;
        lv = { numero, mundo: mundoDe(numero), obstaculos: [], par: 99, colores: inicial.estado.tubos.length, ...inicial };
      } else lv = armado(modo, numero, hoy);
      setPartidas((todas) => ({ ...todas, [modo]: partidaNueva(lv, clave) }));
      const nuevo = lv.obstaculos?.find((o) => !prog.vistos.includes(o));
      if (nuevo) setExplicar(nuevo);
      else if (lv.jefe) setAviso('¡Nivel jefe! Un color más y todos los obstáculos que ya conoces.');
    }, 0);
    return () => clearTimeout(id);
  }, [clave, estado, p]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!aviso) return undefined;
    const id = setTimeout(() => setAviso(null), 2800);
    return () => clearTimeout(id);
  }, [aviso]);

  // El ranking del reto se trae al entrar al reto.
  useEffect(() => {
    if (modo === 'reto' && estado !== 'cargando') onPedirRanking?.();
  }, [modo, estado]); // eslint-disable-line react-hooks/exhaustive-deps

  if (estado === 'cargando' || !p) return <EsqueletoPagina forma="bolitas" />;

  /** Cambia el progreso y avisa para guardarlo (una vez por acción). */
  const guardar = (cambios) => {
    const nuevo = { ...prog, ...cambios };
    setProg(nuevo);
    onProgreso?.(nuevo);
  };
  const fx = (tipo) => efectoBolitas(tipo, { sonido: prog.sonido, vibracion: prog.vibracion });

  const ocupado = premio?.estado === 'acreditando';
  const actual = p.estado;
  const listos = tubosListos(actual);
  const colores = p.nivel.colores;
  const movidas = p.pasados.length;
  const esReto = modo === 'reto';
  const enJuego = movidas > 0 && !p.ganada;
  const quedanNivel = {
    deshacer: AYUDAS_BOLITAS.deshacer - p.usos.deshacer,
    tubo: AYUDAS_BOLITAS.tubo - p.usos.tubo,
    pista: AYUDAS_BOLITAS.pista - p.usos.pista,
  };
  // Lo que se puede usar: lo del nivel y, cuando se acaba, lo guardado de los cofres.
  const quedan = {
    deshacer: quedanNivel.deshacer + prog.guardadas.deshacer,
    tubo: quedanNivel.tubo + prog.guardadas.tubo,
    pista: quedanNivel.pista + prog.guardadas.pista,
  };
  const metas = metasEstrellas(p.nivel.par);
  const mundo = mundoDe(numero);
  const marcaMundo = marcaDelMundo(marcasMundos, mundo);
  const marcaMesa = esReto ? patrocinio?.marca : marcaMundo;
  const actualizar = (cambios) => setPartidas((todas) => ({ ...todas, [modo]: { ...todas[modo], ...cambios } }));

  /** Gasta una ayuda: primero las del nivel, después las guardadas. */
  const gastar = (tipo, cambiosPartida) => {
    if (quedanNivel[tipo] > 0) actualizar({ ...cambiosPartida, usos: { ...p.usos, [tipo]: p.usos[tipo] + 1 } });
    else {
      actualizar(cambiosPartida);
      guardar({ guardadas: { ...prog.guardadas, [tipo]: prog.guardadas[tipo] - 1 } });
    }
  };

  /** Reiniciar o dejar un nivel empezado corta la racha. */
  const cortarRacha = () => {
    if (esReto || !enJuego || !prog.racha) return;
    guardar({ racha: 0 });
    setAviso('Se cortó tu racha de victorias.');
  };

  const ganar = async (movs, jugadas) => {
    fx('ganar');
    // Un segundo para ver el confeti y los destellos sobre la mesa; después, la hoja.
    setTimeout(() => setResultado(true), 1000);
    const partida = esReto
      ? { modo: 'reto', fecha: hoy, movimientos: jugadas, tubos: p.extras }
      : { modo: 'nivel', nivel: numero, movimientos: jugadas, tubos: p.extras };
    // La marca cuyos productos se muestran: la del reto patrocinado o la del
    // mundo cuyo jefe se acaba de vencer.
    let vitrinaMarca = null;
    if (esReto) {
      onCompletar?.({ modo, fecha: hoy, movimientos: movs });
      guardar({ reto: hoy });
      setLogro({ reto: true });
      vitrinaMarca = patrocinio?.marca || null;
    } else {
      const estrellas = estrellasPara(movs, p.nivel.par);
      const antes = prog.estrellas[numero] || 0;
      const racha = prog.racha + 1;
      const cofre = racha % RACHA_COFRE === 0 ? premioCofre() : null;
      const guardadas = cofre ? { ...prog.guardadas, [cofre.tipo]: prog.guardadas[cofre.tipo] + cofre.cantidad } : prog.guardadas;
      guardar({ nivel: Math.max(prog.nivel, numero + 1), estrellas: { ...prog.estrellas, [numero]: Math.max(antes, estrellas) }, racha, guardadas });
      setLogro({ estrellas, record: antes > 0 && estrellas > antes, cofre, racha, mundoCompleto: esJefe(numero) ? mundo : null });
      onCompletar?.({ modo, nivel: numero, movimientos: movs, estrellas });
      if (cofre) setTimeout(() => fx('cofre'), 900);
      enReposo(() => armado('niveles', numero + 1));
      if (esJefe(numero)) vitrinaMarca = marcaMundo;
    }
    setVitrina(null);
    if (vitrinaMarca && onPedirProductos) {
      setVitrina({ marca: vitrinaMarca, lista: [], cargando: true });
      Promise.resolve(onPedirProductos(vitrinaMarca.id))
        .then((lista) => setVitrina({ marca: vitrinaMarca, lista: lista || [], cargando: false }))
        .catch(() => setVitrina({ marca: vitrinaMarca, lista: [], cargando: false }));
    }
    const conCupon = (r) => {
      if (r?.cupon) {
        setLogro((l) => ({ ...l, cupon: r.cupon }));
        if (esReto) guardar({ reto: hoy, cuponReto: hoy });
        setTimeout(() => fx('cofre'), 700);
      }
    };
    if (!sesion) { setPremio({ estado: 'sinSesion' }); return; }
    if (cobrado) {
      setPremio({ estado: 'ya', texto: 'Ya ganaste tus monedas hoy. Puedes seguir jugando por gusto.' });
      Promise.resolve(onRegistrar?.(partida)).then(conCupon).catch(() => {});
      return;
    }
    setPremio({ estado: 'acreditando' });
    try {
      const r = await onGanar?.({ movimientos: movs, partida });
      setCobrado(true);
      conCupon(r);
      setPremio(r?.ya ? { estado: 'ya' } : { estado: 'acreditado', monto: r?.monto || monto });
    } catch {
      setPremio({ estado: 'error' });
    }
  };

  const jugar = (de, a) => {
    const sig = mover(actual, de, a);
    const gano = resuelto(sig);
    const jugadas = [...p.jugadas, [de, a]];
    actualizar({ estado: sig, pasados: [...p.pasados, actual], jugadas, pista: null, ganada: gano });
    setElegido(null);
    if (gano) { ganar(movidas + 1, jugadas); return; }
    fx(tubosListos(sig) > listos ? 'listo' : 'soltar');
    if (!hayMovimientos(sig)) setAtascado(true);
  };

  const tocar = (i) => {
    if (p.ganada || ocupado) return;
    if (cerrado(actual, i)) {
      setElegido(null);
      fx('error');
      setAviso(`Este tubo se abre al completar el ${COLORES[actual.cortinas[i]].nombre}.`);
      return;
    }
    const tubo = actual.tubos[i];
    const sel = elegidoRef.current;
    if (sel === null) {
      if (!tubo.length) return;
      const arriba = tubo[tubo.length - 1];
      if (!tramo(tubo)) { fx('error'); setAviso(`Esa bolita está congelada: se derrite en ${arriba.hielo} movimientos.`); return; }
      fx('levantar');
      setElegido(i);
      return;
    }
    if (sel === i) { setElegido(null); return; }
    if (puedeMover(actual, sel, i)) { jugar(sel, i); return; }
    if (tubo.length && tramo(tubo)) { fx('levantar'); setElegido(i); } else { fx('error'); setElegido(null); }
  };

  const reiniciar = () => {
    if (ocupado) return;
    cortarRacha();
    actualizar(partidaNueva(p.nivel, clave));
    setElegido(null);
    setAtascado(false);
  };
  const deshacer = () => {
    if (!p.pasados.length || p.ganada || quedan.deshacer <= 0) return;
    gastar('deshacer', {
      estado: volverA(p.pasados[p.pasados.length - 1], actual), pasados: p.pasados.slice(0, -1), jugadas: p.jugadas.slice(0, -1), pista: null,
    });
    setElegido(null);
    setAtascado(false);
  };
  // El tubo de más también queda en los pasos de antes: deshacer no lo quita.
  const sumarTubo = () => {
    if (p.ganada || quedan.tubo <= 0) return;
    gastar('tubo', { estado: agregarTubo(actual), pasados: p.pasados.map(agregarTubo), extras: p.extras + 1, pista: null });
    setAtascado(false);
  };
  const pedirPista = () => {
    if (p.ganada || quedan.pista <= 0) return;
    const m = pista(actual);
    setElegido(null);
    if (!m) { setAviso('Desde aquí ya no tiene solución. Deshaz unos pasos o reinicia el nivel.'); return; }
    gastar('pista', { pista: m });
  };

  const irANivel = (n) => {
    if (ocupado) return;
    if (n !== numero) cortarRacha();
    setModo('niveles');
    setNumero(n);
    setVista('juego');
    setResultado(false);
    setPremio(null);
    setElegido(null);
    setAtascado(false);
  };
  const siguiente = () => {
    if (ocupado) return;
    setResultado(false);
    setPremio(null);
    setElegido(null);
    if (esReto) setModo('niveles');
    else irANivel(numero + 1);
  };
  const repetir = () => {
    if (ocupado) return;
    setResultado(false);
    setPremio(null);
    actualizar(partidaNueva(p.nivel, clave));
  };
  const cambiarModo = (m) => {
    if (m === modo || ocupado) return;
    setModo(m);
    setVista('juego');
    setElegido(null);
    setResultado(false);
    setAtascado(false);
  };
  const abrirMapa = () => {
    setMundoMapa(mundo);
    setVista('mapa');
    setElegido(null);
  };
  const cerrarExplicacion = () => {
    const tipo = explicar;
    setExplicar(null);
    if (!prog.vistos.includes(tipo)) guardar({ vistos: [...prog.vistos, tipo] });
  };

  const promesa = !sesion
    ? <PremioJuego estado="sinSesion" urlLogin={urlLogin} />
    : cobrado
      ? <PremioJuego estado="ya" texto="Ya ganaste tus monedas hoy. Puedes seguir jugando por gusto." />
      : <PremioJuego estado="promesa" monto={monto} texto="al pasar un nivel o el reto del día." />;
  const contador = (n) => <span className={s.cuentaAyuda} aria-hidden="true">{n}</span>;
  const obstaculo = explicar && OBSTACULOS[explicar];
  const guardadasTexto = Object.entries(prog.guardadas).filter(([, n]) => n > 0).map(([tipo, n]) => textoAyuda(tipo, n));
  const verMapa = vista === 'mapa' && !esReto;

  const interruptores = (
    <>
      <Boton variante="fantasma" tamano="sm" soloIcono aria-label={t.sonido} aria-pressed={prog.sonido} onClick={() => guardar({ sonido: !prog.sonido })}
        icono={prog.sonido ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
      />
      <Boton variante="fantasma" tamano="sm" soloIcono aria-label={t.vibracion} aria-pressed={prog.vibracion} onClick={() => guardar({ vibracion: !prog.vibracion })}
        icono={prog.vibracion ? <Vibrate aria-hidden="true" /> : <VibrateOff aria-hidden="true" />}
      />
    </>
  );

  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
        <MarcoJuego titulo="Las Bolitas de Kapi" onAyuda={() => setAyuda(true)} acciones={interruptores}>
          <div className={s.bolitas} data-componente="PaginaBolitas">
            <div
              className={[s.mesa, (!esReto || marcaMesa) && s.mesaMundo].filter(Boolean).join(' ')}
              style={esReto
                ? (marcaMesa?.color ? fondoMundo(1, marcaMesa) : undefined)
                : fondoMundo(verMapa ? mundoMapa : mundo, verMapa ? marcaDelMundo(marcasMundos, mundoMapa) : marcaMundo)}
            >
              {/* El fondo ilustrado: la escena del mundo (o de su marca), el
                  escenario del reto; los detalles cambian con cada nivel. */}
              <span className={s.adornos} aria-hidden="true">
                {(() => {
                  const marcaFondo = verMapa ? marcaDelMundo(marcasMundos, mundoMapa) : marcaMesa;
                  let escena;
                  if (marcaFondo) escena = 'marca';
                  else if (esReto) escena = 'reto';
                  else escena = escenaDelMundo(verMapa ? mundoMapa : mundo);
                  return (
                    <FondoBolitas
                      escena={escena}
                      semilla={esReto ? hoy : verMapa ? mundoMapa * 1000 : numero}
                      jefe={!esReto && !verMapa && Boolean(p.nivel.jefe)}
                      color={marcaFondo?.color}
                      color2={marcaFondo?.color2}
                    />
                  );
                })()}
              </span>
              {/* El confeti grande al ganar, desde el centro de la mesa. */}
              <span className={s.fiesta} aria-hidden="true">
                <Estallido
                  disparo={p.ganada ? `${clave}-${movidas}` : null}
                  forma="confeti"
                  cantidad={30}
                  distancia={160}
                  colores={['#8b5cf6', '#f472b6', '#fbbf24', '#60a5fa', '#34d399']}
                />
              </span>
              {hoy && (
                <div className={s.modos}>
                  <Pestanas
                    etiqueta="Modo de juego"
                    opciones={[{ id: 'niveles', texto: 'Niveles' }, { id: 'reto', texto: 'Reto del día' }]}
                    valor={modo}
                    onChange={cambiarModo}
                  />
                </div>
              )}

              {verMapa ? (
                <>
                  <MapaBolitas
                    mundo={mundoMapa}
                    marca={marcaDelMundo(marcasMundos, mundoMapa)}
                    progreso={prog}
                    actual={numero}
                    onElegir={irANivel}
                    onMundo={setMundoMapa}
                    onClicMarca={onClicMarca}
                  />
                  <div className={s.botonesMesa}>
                    <Boton icono={<ArrowRight aria-hidden="true" />} onClick={() => setVista('juego')}>
                      <TextoResaltado resaltar={[numero]}>{`Volver al nivel ${numero}`}</TextoResaltado>
                    </Boton>
                  </div>
                </>
              ) : (
                <>
                  {esReto ? (
                    <p className={s.nivelTitulo}><Texto>Reto del día</Texto></p>
                  ) : (
                    <div className={s.cabezaNivel}>
                      <div>
                        <p className={s.mundoLinea}>
                          <TextoResaltado resaltar={[mundo]}>{`Mundo ${mundo}`}</TextoResaltado>
                          {' · '}
                          {marcaMundo
                            ? <MarcaBolitas marca={marcaMundo} onClick={() => onClicMarca?.({ marcaId: marcaMundo.id, destino: 'marca' })} />
                            : <Texto>{infoMundo(mundo).nombre}</Texto>}
                        </p>
                        <p className={s.nivelTitulo}>
                          {p.nivel.jefe && <Crown className={s.coronaTitulo} aria-hidden="true" />}
                          <TextoResaltado resaltar={[numero]}>{p.nivel.jefe ? `Nivel ${numero} · Jefe` : `Nivel ${numero}`}</TextoResaltado>
                        </p>
                        <p className={s.metaEstrellas}>
                          {/* Las que llevaría si ganara ahora: bajan al pasarse de la meta. */}
                          <EstrellasNivel valor={estrellasPara(movidas, p.nivel.par)} tamano="md" />
                          <TextoResaltado resaltar={[metas.tres]}>{`3 estrellas con ${metas.tres} movimientos o menos`}</TextoResaltado>
                        </p>
                      </div>
                      <Boton variante="secundario" tamano="sm" icono={<IconoMapa aria-hidden="true" />} onClick={abrirMapa}><Texto>Mapa</Texto></Boton>
                    </div>
                  )}
                  {esReto && patrocinio?.marca && (
                    <PatrocinioBolitas
                      patrocinio={patrocinio}
                      sesion={sesion}
                      hecho={prog.cuponReto === hoy}
                      urlLogin={urlLogin}
                      onClicMarca={onClicMarca}
                    />
                  )}
                  {esReto && prog.reto === hoy && !p.ganada && (
                    <Aviso compacto tipo="exito"><Texto>Ya hiciste el reto de hoy. Puedes jugarlo otra vez; mañana sale otro.</Texto></Aviso>
                  )}
                  <div className={s.mensajeZona} aria-live="polite">
                    {aviso && <span key={aviso} className={s.mensaje}><Texto>{aviso}</Texto></span>}
                  </div>
                  <LayoutGroup>
                    <div className={[s.tubos, actual.tubos.length > 6 && s.tubosCompactos].filter(Boolean).join(' ')} style={columnas(actual.tubos.length)}>
                      {actual.tubos.map((tubo, i) => (
                        <TuboBolitas
                          key={i}
                          numero={i + 1}
                          bolas={tubo}
                          capacidad={actual.capacidad}
                          elegido={elegido === i}
                          destino={elegido !== null && puedeMover(actual, elegido, i)}
                          listo={!cerrado(actual, i) && tuboListo(tubo, actual.capacidad)}
                          cortina={actual.cortinas[i]}
                          pista={p.pista?.[0] === i ? 'origen' : p.pista?.[1] === i ? 'destino' : undefined}
                          onClick={() => tocar(i)}
                        />
                      ))}
                    </div>
                  </LayoutGroup>
                  <div className={s.botonesMesa}>
                    {p.ganada ? (
                      <>
                        <Boton icono={<ArrowRight aria-hidden="true" />} onClick={siguiente} disabled={ocupado}>
                          <Texto>{esReto ? 'Seguir con los niveles' : 'Siguiente nivel'}</Texto>
                        </Boton>
                        {!resultado && <Boton variante="secundario" icono={<Eye aria-hidden="true" />} onClick={() => setResultado(true)}><Texto>Ver resultado</Texto></Boton>}
                      </>
                    ) : (
                      <>
                        <Boton variante="secundario" icono={<Undo2 aria-hidden="true" />} onClick={deshacer} disabled={!movidas || quedan.deshacer <= 0}>
                          <Texto>Deshacer</Texto>{contador(quedan.deshacer)}
                        </Boton>
                        <Boton variante="secundario" icono={<Plus aria-hidden="true" />} onClick={sumarTubo} disabled={quedan.tubo <= 0}>
                          <Texto>Un tubo más</Texto>{contador(quedan.tubo)}
                        </Boton>
                        <Boton variante="secundario" icono={<Lightbulb aria-hidden="true" />} onClick={pedirPista} disabled={quedan.pista <= 0}>
                          <Texto>Pista</Texto>{contador(quedan.pista)}
                        </Boton>
                        <Boton variante="fantasma" icono={<RotateCcw aria-hidden="true" />} onClick={reiniciar}><Texto>Reiniciar</Texto></Boton>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            <aside className={s.lado}>
              <div className={s.panel}>
                {promesa}
                <CifrasJuego cifras={[
                  { etiqueta: esReto ? 'Reto' : 'Nivel', valor: esReto ? (hoy || '').slice(5).split('-').reverse().join('/') : numero },
                  { etiqueta: 'Movimientos', valor: movidas },
                ]}
                />
                <BarraProgreso pasos valor={listos} max={colores} etiqueta={<Texto>Tubos listos</Texto>} />
                {esReto ? (
                  <RankingBolitas ranking={ranking} cargando={cargandoRanking} sesion={sesion} urlLogin={urlLogin} />
                ) : (
                  <div className={s.rachaBolitas} data-componente="RachaBolitas">
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
                )}
              </div>
            </aside>
          </div>
        </MarcoJuego>
      </BloqueSeccion>

      <AyudaJuego
        abierta={ayuda}
        onCerrar={() => { setAyuda(false); onAyudaVista?.(); }}
        intro={(
          <TextoResaltado resaltar={[colores, actual.tubos.length]}>
            {`Hay ${colores} colores repartidos en ${actual.tubos.length} tubos. Los tubos vacíos son tu espacio para maniobrar.`}
          </TextoResaltado>
        )}
        pasos={[
          'Toca un tubo para levantar las bolitas de arriba del mismo color.',
          'Toca otro tubo para soltarlas ahí: viajan juntas todas las que quepan.',
          <TextoResaltado key="listo" resaltar={[actual.capacidad]}>
            {`Un tubo está listo cuando tiene sus ${actual.capacidad} bolitas del mismo color. Ganas cuando lo están todos.`}
          </TextoResaltado>,
          'Con menos movimientos ganas más estrellas (hasta 3). Cada mundo tiene 20 niveles y el último es un jefe.',
          <TextoResaltado key="racha" resaltar={[RACHA_COFRE]}>
            {`Gana ${RACHA_COFRE} niveles seguidos sin reiniciar y abre un cofre: pistas, tubos o deshacer que se guardan para cuando se acaben los del nivel.`}
          </TextoResaltado>,
        ]}
        pie={(
          <TextoResaltado resaltar={[AYUDAS_BOLITAS.deshacer, AYUDAS_BOLITAS.pista, `+${monto}`]}>
            {`En cada nivel tienes ${AYUDAS_BOLITAS.deshacer} para deshacer, un tubo de más y ${AYUDAS_BOLITAS.pista} pistas; «Reiniciar» las devuelve pero corta la racha. Desde el 12 aparecen obstáculos y cada día hay un reto nuevo. El premio (+${monto} monedas) se gana una vez al día.`}
          </TextoResaltado>
        )}
      >
        <p className={s.ayudaTexto}><strong><Texto>¿Dónde puedes soltar una bolita roja?</Texto></strong></p>
        <ul className={s.leyendaTubos}>
          <li><TuboBolitas chico capacidad={4} bolas={[]} /><span><Texto>Sí: el tubo está vacío.</Texto></span></li>
          <li><TuboBolitas chico capacidad={4} bolas={[{ id: 'a', c: 1 }, { id: 'b', c: 0 }]} /><span><Texto>Sí: arriba hay otra roja.</Texto></span></li>
          <li><TuboBolitas chico capacidad={4} bolas={[{ id: 'c', c: 0 }, { id: 'd', c: 2 }]} /><span><Texto>No: arriba hay otro color.</Texto></span></li>
        </ul>
      </AyudaJuego>

      <HojaInferior
        abierta={Boolean(obstaculo)}
        onCerrar={cerrarExplicacion}
        titulo={obstaculo?.titulo}
        pie={<Boton bloque onClick={cerrarExplicacion}><Texto>Entendido, a jugar</Texto></Boton>}
      >
        {obstaculo && (
          <div className={s.obstaculo}>
            <TuboBolitas chico capacidad={4} bolas={obstaculo.ejemplo} cortina={obstaculo.cortina ?? null} />
            <p className={s.ayudaTexto}><Texto>{obstaculo.texto}</Texto></p>
          </div>
        )}
      </HojaInferior>

      <HojaInferior
        abierta={atascado && !p.ganada}
        onCerrar={() => setAtascado(false)}
        titulo="Sin movimientos"
        pie={(
          <div className={s.accionesHoja}>
            {quedan.tubo > 0 && <Boton bloque icono={<Plus aria-hidden="true" />} onClick={sumarTubo}><Texto>Un tubo más</Texto></Boton>}
            {quedan.deshacer > 0 && movidas > 0 && <Boton bloque variante="secundario" icono={<Undo2 aria-hidden="true" />} onClick={deshacer}><Texto>Deshacer</Texto></Boton>}
            <Boton bloque variante={quedan.tubo > 0 ? 'fantasma' : 'primario'} icono={<RotateCcw aria-hidden="true" />} onClick={reiniciar}><Texto>Reiniciar el nivel</Texto></Boton>
          </div>
        )}
      >
        <p className={s.ayudaTexto}><Texto>Ya no queda ningún movimiento posible. Usa una ayuda o empieza el nivel de nuevo (eso corta la racha).</Texto></p>
      </HojaInferior>

      <ResultadoJuego
        abierta={resultado}
        onCerrar={() => setResultado(false)}
        ocupado={ocupado}
        titulo={esReto ? '¡Reto del día completado!' : `¡Nivel ${numero} completado!`}
        imagen={CARAS_KAPI.feliz}
        texto={(
          <div className={s.logro}>
            {logro?.estrellas > 0 && <EstrellasNivel valor={logro.estrellas} tamano="lg" animar />}
            <p>
              <TextoResaltado resaltar={[movidas]}>
                {movidas === 1 ? 'Lo resolviste en 1 movimiento.' : `Lo resolviste en ${movidas} movimientos.`}
              </TextoResaltado>
            </p>
            {logro?.record && <p className={s.record}><Texto>¡Nuevo récord en este nivel!</Texto></p>}
            {logro && logro.estrellas < 3 && (
              <p className={s.notaSuave}>
                <TextoResaltado resaltar={[metas.tres]}>{`Para 3 estrellas: ${metas.tres} movimientos o menos.`}</TextoResaltado>
              </p>
            )}
            {logro?.mundoCompleto && (
              <p className={s.mundoCompleto}>
                <TextoResaltado resaltar={[logro.mundoCompleto + 1]}>
                  {`¡Venciste al jefe! Se abre el mundo ${logro.mundoCompleto + 1}: ${infoMundo(logro.mundoCompleto + 1).nombre}.`}
                </TextoResaltado>
              </p>
            )}
          </div>
        )}
        acciones={(
          <>
            <Boton bloque icono={<ArrowRight aria-hidden="true" />} onClick={siguiente} disabled={ocupado}>
              <Texto>{esReto ? 'Seguir con los niveles' : `Ir al nivel ${numero + 1}`}</Texto>
            </Boton>
            {logro && logro.estrellas < 3 ? (
              <Boton bloque variante="secundario" icono={<RotateCcw aria-hidden="true" />} onClick={repetir} disabled={ocupado}><Texto>Repetir por 3 estrellas</Texto></Boton>
            ) : (
              <Boton bloque variante="secundario" to="/minijuegos" icono={<Gamepad2 aria-hidden="true" />} disabled={ocupado}><Texto>Ver otros juegos</Texto></Boton>
            )}
          </>
        )}
      >
        {logro?.cupon && <CuponGanado cupon={logro.cupon} />}
        {logro?.cofre && (
          <div className={s.cofre} data-componente="CofreBolitas">
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
        {vitrina && (
          <ProductosMarca marca={vitrina.marca} productos={vitrina.lista} cargando={vitrina.cargando} onClic={onClicMarca} />
        )}
      </ResultadoJuego>
    </>
  );
}
