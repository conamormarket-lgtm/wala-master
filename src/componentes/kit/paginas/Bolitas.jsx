import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGroup } from 'framer-motion';
import { Gamepad2, RotateCcw, Undo2, Eye } from 'lucide-react';
import Boton from '../Boton';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { BarraProgreso } from '../piezas/BarraProgreso';
import { MarcoJuego, AyudaJuego, PremioJuego, ResultadoJuego, CifrasJuego, TextoResaltado } from '../piezas/Juegos';
import {
  TuboBolitas, nivelBolitas, puedeSoltar, moverBolita, tuboListo, nivelResuelto, COLORES_BOLITAS, CAPACIDAD_TUBO,
} from '../piezas/Bolitas';
import { Texto } from '../Traduccion';
import s from './Juegos.module.css';

/* ── Las Bolitas de Kapi (/ball-sort) ───────────────────── */

/**
 * Las Bolitas de Kapi: ordenar los colores en los tubos. Se toca un tubo
 * para levantar su bolita de arriba y otro para soltarla; los tubos donde sí
 * se puede soltar se marcan. Ganar da monedas una vez al día; sin cuenta se
 * juega igual (el premio invita a entrar).
 *  - sesion · yaHoy (ya cobró hoy) · monto (2)
 *  - onGanar({ movimientos }): cobra; promesa → { monto } | { ya: true }
 *    (si falla, lanza). Solo con sesión y si no cobró hoy.
 *  - onCompletar({ movimientos }): cada nivel resuelto, con o sin premio
 *  - colores, capacidad · nivelInicial (para repetir uno)
 *  - ayudaVista · onAyudaVista · estado: 'cargando'
 * Mientras se acredita, la hoja no se cierra y no se reparte otro nivel.
 * Los textos pasan por la traducción.
 */
export function PaginaBolitas({
  sesion = true, yaHoy = false, monto = 2, onGanar, onCompletar, colores = COLORES_BOLITAS, capacidad = CAPACIDAD_TUBO, nivelInicial,
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
  // El perfil puede llegar (o refrescarse) después: si ya cobró hoy, no se vuelve a intentar.
  useEffect(() => { if (yaHoy) setCobrado(true); }, [yaHoy]);

  if (estado === 'cargando') return <EsqueletoPagina forma="bolitas" />;

  const ocupado = premio?.estado === 'acreditando';

  const ganar = async (movimientos) => {
    setResuelto(true);
    setResultado(true);
    onCompletar?.({ movimientos });
    if (!sesion) { setPremio({ estado: 'sinSesion' }); return; }
    if (cobrado) { setPremio({ estado: 'ya', texto: 'Ya ganaste tus monedas hoy. Puedes seguir jugando por gusto.' }); return; }
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
    if (ocupado) return;
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
  const movidas = pasados.length;

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
                    <Boton icono={<RotateCcw aria-hidden="true" />} onClick={reiniciar} disabled={ocupado}><Texto>Jugar otra vez</Texto></Boton>
                    {!resultado && <Boton variante="secundario" icono={<Eye aria-hidden="true" />} onClick={() => setResultado(true)}><Texto>Ver resultado</Texto></Boton>}
                  </>
                ) : (
                  <>
                    <Boton variante="secundario" icono={<Undo2 aria-hidden="true" />} onClick={deshacer} disabled={!pasados.length}><Texto>Deshacer</Texto></Boton>
                    <Boton variante="fantasma" icono={<RotateCcw aria-hidden="true" />} onClick={reiniciar}><Texto>Otro nivel</Texto></Boton>
                  </>
                )}
              </div>
            </div>
            <aside className={s.lado}>
              <div className={s.panel}>
                {promesa}
                <CifrasJuego cifras={[{ etiqueta: 'Movimientos', valor: movidas }, { etiqueta: 'Tubos listos', valor: `${listos}/${colores.length}` }]} />
                <BarraProgreso pasos valor={listos} max={colores.length} etiqueta={<Texto>Tubos listos</Texto>} />
              </div>
            </aside>
          </div>
        </MarcoJuego>
      </BloqueSeccion>

      <AyudaJuego
        abierta={ayuda}
        onCerrar={() => { setAyuda(false); onAyudaVista?.(); }}
        intro={(
          <TextoResaltado resaltar={[colores.length, tubos.length]}>
            {`Hay ${colores.length} colores repartidos en ${tubos.length} tubos. Los tubos vacíos son tu espacio para maniobrar.`}
          </TextoResaltado>
        )}
        pasos={[
          'Toca un tubo para levantar su bolita de arriba.',
          'Toca otro tubo para soltarla ahí.',
          <TextoResaltado key="listo" resaltar={[capacidad]}>
            {`Un tubo está listo cuando tiene sus ${capacidad} bolitas del mismo color. Ganas cuando lo están todos.`}
          </TextoResaltado>,
        ]}
        pie={(
          <TextoResaltado resaltar={[`+${monto}`]}>
            {`Mientras tienes una bolita levantada, los tubos donde sí puedes soltarla se marcan en verde. «Deshacer» vuelve un paso y «Otro nivel» reparte otra vez: el premio (+${monto} monedas) se gana una vez al día y sigue en juego.`}
          </TextoResaltado>
        )}
      >
        <p className={s.ayudaTexto}><strong><Texto>¿Dónde puedes soltar una bolita roja?</Texto></strong></p>
        <ul className={s.leyendaTubos}>
          <li><TuboBolitas chico capacidad={4} bolas={[]} /><span><Texto>Sí: el tubo está vacío.</Texto></span></li>
          <li><TuboBolitas chico capacidad={4} bolas={[{ id: 'a', color: colores[1] }, { id: 'b', color: colores[0] }]} /><span><Texto>Sí: arriba hay otra roja.</Texto></span></li>
          <li><TuboBolitas chico capacidad={4} bolas={[{ id: 'c', color: colores[0] }, { id: 'd', color: colores[2] }]} /><span><Texto>No: arriba hay otro color.</Texto></span></li>
        </ul>
      </AyudaJuego>

      <ResultadoJuego
        abierta={resultado}
        onCerrar={() => setResultado(false)}
        ocupado={ocupado}
        titulo="¡Nivel completado!"
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
            <Boton bloque icono={<RotateCcw aria-hidden="true" />} onClick={reiniciar} disabled={ocupado}><Texto>Jugar otra vez</Texto></Boton>
            <Boton bloque variante="secundario" to="/minijuegos" icono={<Gamepad2 aria-hidden="true" />} disabled={ocupado}><Texto>Ver otros juegos</Texto></Boton>
          </>
        )}
      >
        {premio && <PremioJuego {...premio} urlLogin={urlLogin} />}
      </ResultadoJuego>
    </>
  );
}
