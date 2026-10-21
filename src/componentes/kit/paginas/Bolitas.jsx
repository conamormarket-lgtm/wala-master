import React, { useEffect, useRef, useState } from 'react';
import { LayoutGroup } from 'framer-motion';
import { Gamepad2, RotateCcw, Undo2, Eye, Plus, Lightbulb, ArrowRight } from 'lucide-react';
import Boton from '../Boton';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { Aviso, HojaInferior } from '../Feedback';
import { Pestanas } from '../Navegacion';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { BarraProgreso } from '../piezas/BarraProgreso';
import { MarcoJuego, AyudaJuego, PremioJuego, ResultadoJuego, CifrasJuego, TextoResaltado } from '../piezas/Juegos';
import { TuboBolitas } from '../piezas/Bolitas';
import {
  nivel as nivelNumero, retoDelDia, puedeMover, mover, resuelto, tubosListos, hayMovimientos, agregarTubo, volverA, pista,
  cerrado, tramo, tuboListo, COLORES,
} from '../piezas/bolitasMotor.mjs';
import { Texto } from '../Traduccion';
import s from './Juegos.module.css';

/* ── Las Bolitas de Kapi (/ball-sort) ───────────────────── */

/** Las ayudas de cada nivel (vuelven a estar completas al reiniciarlo). */
export const AYUDAS_BOLITAS = { deshacer: 5, tubo: 1, pista: 3 };

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

const partidaNueva = (lv, clave) => ({ clave, nivel: lv, estado: lv.estado, pasados: [], usos: { deshacer: 0, tubo: 0, pista: 0 }, pista: null, ganada: false });

/** Columnas de la mesa: una fila con pocos tubos, dos con muchos. */
const columnas = (n) => ({
  '--col-escritorio': n <= 7 ? n : Math.ceil(n / 2),
  '--col-movil': n <= 4 ? n : n <= 6 ? 3 : Math.ceil(n / 2),
});

/**
 * Las Bolitas de Kapi: ordenar los colores en los tubos, nivel por nivel o
 * en el reto del día. Se toca un tubo para levantar las bolitas de arriba del
 * mismo color y otro para soltarlas (se mueven todas las que quepan). Desde
 * el nivel 12 aparecen los obstáculos: bolitas ocultas, tubos con cortina y
 * bolitas congeladas. Cada nivel tiene ayudas contadas (deshacer, un tubo más
 * y pistas). Ganar (un nivel o el reto) da monedas una vez al día; sin cuenta
 * se juega igual (el premio invita a entrar).
 *  - sesion · yaHoy (ya cobró hoy) · monto (2)
 *  - onGanar({ movimientos }): cobra; promesa → { monto } | { ya: true }
 *    (si falla, lanza). Solo con sesión y si no cobró hoy.
 *  - onCompletar({ modo, nivel | fecha, movimientos }): cada victoria
 *  - nivel: en qué nivel va · onNivel(n): pasó al nivel n (guardarlo)
 *  - hoy ('AAAA-MM-DD', el día de Lima: sin él no hay reto) · retoHecho ·
 *    onRetoHecho
 *  - vistos: obstáculos ya explicados · onVisto(tipo)
 *  - inicial: { estado, colores } para empezar en un tablero puesto (la demo)
 *  - ayudaVista · onAyudaVista · estado: 'cargando'
 * Mientras se acredita, la hoja no se cierra y no se pasa de nivel.
 * Los textos pasan por la traducción.
 */
export function PaginaBolitas({
  sesion = true, yaHoy = false, monto = 2, onGanar, onCompletar,
  nivel = 1, onNivel, hoy, retoHecho = false, onRetoHecho, vistos = [], onVisto,
  inicial, ayudaVista = true, onAyudaVista, urlLogin = '/login', estado,
}) {
  const [modo, setModo] = useState('niveles');
  const [numero, setNumero] = useState(() => Math.max(1, nivel || 1));
  const [partidas, setPartidas] = useState({});
  const [elegido, setElegido] = useState(null);
  const [resultado, setResultado] = useState(false);
  const [premio, setPremio] = useState(null);
  const [cobrado, setCobrado] = useState(yaHoy);
  const [ayuda, setAyuda] = useState(!ayudaVista);
  const [explicar, setExplicar] = useState(null);
  const [atascado, setAtascado] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [explicados, setExplicados] = useState(() => new Set(vistos));
  const inicialUsado = useRef(false);

  // El perfil puede llegar (o refrescarse) después: si ya cobró hoy, no se vuelve a intentar.
  useEffect(() => { if (yaHoy) setCobrado(true); }, [yaHoy]);
  // Si el nivel guardado llega después (otra pestaña, la cuenta), se sigue desde ahí.
  useEffect(() => { if (nivel > numero && modo === 'niveles' && !partidas.niveles?.pasados.length) setNumero(nivel); }, [nivel]); // eslint-disable-line react-hooks/exhaustive-deps

  const clave = modo === 'reto' ? `reto:${hoy}` : `nivel:${numero}`;
  const p = partidas[modo]?.clave === clave ? partidas[modo] : null;

  // Arma el nivel después de pintar (lo que tarde no traba la página).
  useEffect(() => {
    if (estado === 'cargando' || p) return undefined;
    const id = setTimeout(() => {
      let lv;
      if (inicial && modo === 'niveles' && !inicialUsado.current) {
        inicialUsado.current = true;
        lv = { numero, obstaculos: [], colores: inicial.colores || inicial.estado.tubos.length, ...inicial };
      } else lv = armado(modo, numero, hoy);
      setPartidas((todas) => ({ ...todas, [modo]: partidaNueva(lv, clave) }));
      const nuevo = lv.obstaculos?.find((o) => !explicados.has(o));
      if (nuevo) setExplicar(nuevo);
    }, 0);
    return () => clearTimeout(id);
  }, [clave, estado, p]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!aviso) return undefined;
    const id = setTimeout(() => setAviso(null), 2600);
    return () => clearTimeout(id);
  }, [aviso]);

  if (estado === 'cargando' || !p) return <EsqueletoPagina forma="bolitas" />;

  const ocupado = premio?.estado === 'acreditando';
  const actual = p.estado;
  const listos = tubosListos(actual);
  const colores = p.nivel.colores;
  const movidas = p.pasados.length;
  const quedan = {
    deshacer: AYUDAS_BOLITAS.deshacer - p.usos.deshacer,
    tubo: AYUDAS_BOLITAS.tubo - p.usos.tubo,
    pista: AYUDAS_BOLITAS.pista - p.usos.pista,
  };
  const esReto = modo === 'reto';
  const actualizar = (cambios) => setPartidas((todas) => ({ ...todas, [modo]: { ...todas[modo], ...cambios } }));

  const ganar = async (movs) => {
    setResultado(true);
    onCompletar?.(esReto ? { modo, fecha: hoy, movimientos: movs } : { modo, nivel: numero, movimientos: movs });
    if (esReto) onRetoHecho?.();
    else {
      onNivel?.(numero + 1);
      enReposo(() => armado('niveles', numero + 1));
    }
    if (!sesion) { setPremio({ estado: 'sinSesion' }); return; }
    if (cobrado) { setPremio({ estado: 'ya', texto: 'Ya ganaste tus monedas hoy. Puedes seguir jugando por gusto.' }); return; }
    setPremio({ estado: 'acreditando' });
    try {
      const r = await onGanar?.({ movimientos: movs });
      setCobrado(true);
      setPremio(r?.ya ? { estado: 'ya' } : { estado: 'acreditado', monto: r?.monto || monto });
    } catch {
      setPremio({ estado: 'error' });
    }
  };

  const jugar = (de, a) => {
    const sig = mover(actual, de, a);
    const gano = resuelto(sig);
    actualizar({ estado: sig, pasados: [...p.pasados, actual], pista: null, ganada: gano });
    setElegido(null);
    if (gano) ganar(movidas + 1);
    else if (!hayMovimientos(sig)) setAtascado(true);
  };

  const tocar = (i) => {
    if (p.ganada || ocupado) return;
    if (cerrado(actual, i)) {
      setElegido(null);
      setAviso(`Este tubo se abre al completar el ${COLORES[actual.cortinas[i]].nombre}.`);
      return;
    }
    const tubo = actual.tubos[i];
    if (elegido === null) {
      if (!tubo.length) return;
      const arriba = tubo[tubo.length - 1];
      if (!tramo(tubo)) { setAviso(`Esa bolita está congelada: se derrite en ${arriba.hielo} movimientos.`); return; }
      setElegido(i);
      return;
    }
    if (elegido === i) { setElegido(null); return; }
    if (puedeMover(actual, elegido, i)) { jugar(elegido, i); return; }
    setElegido(tubo.length && tramo(tubo) ? i : null);
  };

  const reiniciar = () => {
    if (ocupado) return;
    actualizar(partidaNueva(p.nivel, clave));
    setElegido(null);
    setAtascado(false);
  };
  const deshacer = () => {
    if (!p.pasados.length || p.ganada || quedan.deshacer <= 0) return;
    actualizar({
      estado: volverA(p.pasados[p.pasados.length - 1], actual),
      pasados: p.pasados.slice(0, -1),
      usos: { ...p.usos, deshacer: p.usos.deshacer + 1 },
      pista: null,
    });
    setElegido(null);
    setAtascado(false);
  };
  // El tubo de más también queda en los pasos de antes: deshacer no lo quita.
  const sumarTubo = () => {
    if (p.ganada || quedan.tubo <= 0) return;
    actualizar({ estado: agregarTubo(actual), pasados: p.pasados.map(agregarTubo), usos: { ...p.usos, tubo: p.usos.tubo + 1 }, pista: null });
    setAtascado(false);
  };
  const pedirPista = () => {
    if (p.ganada || quedan.pista <= 0) return;
    const m = pista(actual);
    setElegido(null);
    if (!m) { setAviso('Desde aquí ya no tiene solución. Deshaz unos pasos o reinicia el nivel.'); return; }
    actualizar({ pista: m, usos: { ...p.usos, pista: p.usos.pista + 1 } });
  };

  const siguiente = () => {
    if (ocupado) return;
    setResultado(false);
    setPremio(null);
    setElegido(null);
    if (esReto) setModo('niveles');
    else setNumero((n) => n + 1);
  };
  const cambiarModo = (m) => {
    if (m === modo || ocupado) return;
    setModo(m);
    setElegido(null);
    setResultado(false);
    setAtascado(false);
  };
  const cerrarExplicacion = () => {
    const tipo = explicar;
    setExplicar(null);
    setExplicados((ya) => new Set(ya).add(tipo));
    onVisto?.(tipo);
  };

  const promesa = !sesion
    ? <PremioJuego estado="sinSesion" urlLogin={urlLogin} />
    : cobrado
      ? <PremioJuego estado="ya" texto="Ya ganaste tus monedas hoy. Puedes seguir jugando por gusto." />
      : <PremioJuego estado="promesa" monto={monto} texto="al pasar un nivel o el reto del día." />;
  const contador = (n) => <span className={s.cuentaAyuda} aria-hidden="true">{n}</span>;
  const obstaculo = explicar && OBSTACULOS[explicar];

  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
        <MarcoJuego titulo="Las Bolitas de Kapi" onAyuda={() => setAyuda(true)}>
          <div className={s.bolitas} data-componente="PaginaBolitas">
            <div className={s.mesa}>
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
              <p className={s.nivelTitulo}>
                {esReto
                  ? <Texto>Reto del día</Texto>
                  : <TextoResaltado resaltar={[numero]}>{`Nivel ${numero}`}</TextoResaltado>}
              </p>
              {esReto && retoHecho && !p.ganada && (
                <Aviso compacto tipo="exito"><Texto>Ya hiciste el reto de hoy. Puedes jugarlo otra vez; mañana sale otro.</Texto></Aviso>
              )}
              <div className={s.mensajeZona} aria-live="polite">
                {aviso && <span key={aviso} className={s.mensaje}><Texto>{aviso}</Texto></span>}
              </div>
              <LayoutGroup>
                <div className={[s.tubos, actual.tubos.length > 6 && s.tubosCompactos].filter(Boolean).join(' ')} style={columnas(actual.tubos.length)}>
                  {actual.tubos.map((t, i) => (
                    <TuboBolitas
                      key={i}
                      numero={i + 1}
                      bolas={t}
                      capacidad={actual.capacidad}
                      elegido={elegido === i}
                      destino={elegido !== null && puedeMover(actual, elegido, i)}
                      listo={!cerrado(actual, i) && tuboListo(t, actual.capacidad)}
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
                <p className={s.notaSuave}>
                  <TextoResaltado resaltar={[quedan.deshacer, quedan.tubo, quedan.pista]}>
                    {`En este nivel te quedan ${quedan.deshacer} para deshacer, ${quedan.tubo} tubo de más y ${quedan.pista} pistas.`}
                  </TextoResaltado>
                </p>
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
        ]}
        pie={(
          <TextoResaltado resaltar={[AYUDAS_BOLITAS.deshacer, AYUDAS_BOLITAS.pista, `+${monto}`]}>
            {`En cada nivel tienes ${AYUDAS_BOLITAS.deshacer} para deshacer, un tubo de más y ${AYUDAS_BOLITAS.pista} pistas; «Reiniciar» las devuelve. Cada nivel es más difícil, desde el 12 aparecen obstáculos y cada día hay un reto nuevo. El premio (+${monto} monedas) se gana una vez al día.`}
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
        <p className={s.ayudaTexto}><Texto>Ya no queda ningún movimiento posible. Usa una ayuda o empieza el nivel de nuevo.</Texto></p>
      </HojaInferior>

      <ResultadoJuego
        abierta={resultado}
        onCerrar={() => setResultado(false)}
        ocupado={ocupado}
        titulo={esReto ? '¡Reto del día completado!' : `¡Nivel ${numero} completado!`}
        imagen={CARAS_KAPI.feliz}
        texto={(
          <p>
            <TextoResaltado resaltar={[movidas]}>
              {movidas === 1 ? 'Lo resolviste en 1 movimiento.' : `Lo resolviste en ${movidas} movimientos.`}
            </TextoResaltado>
          </p>
        )}
        acciones={(
          <>
            <Boton bloque icono={<ArrowRight aria-hidden="true" />} onClick={siguiente} disabled={ocupado}>
              <Texto>{esReto ? 'Seguir con los niveles' : `Ir al nivel ${numero + 1}`}</Texto>
            </Boton>
            <Boton bloque variante="secundario" to="/minijuegos" icono={<Gamepad2 aria-hidden="true" />} disabled={ocupado}><Texto>Ver otros juegos</Texto></Boton>
          </>
        )}
      >
        {premio && <PremioJuego {...premio} urlLogin={urlLogin} />}
      </ResultadoJuego>
    </>
  );
}
