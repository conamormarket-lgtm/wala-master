import React from 'react';
import { ArrowLeft, HelpCircle, Check, AlertCircle, LogIn } from 'lucide-react';
import Boton from '../Boton';
import { HojaInferior } from '../Feedback';
import { GananciaMonedas } from '../Etiquetas';
import { Sello, Trazo } from '../Marca';
import { Cargando } from '../Cargando';
import s from './Juegos.module.css';

/*
 * Lo común de los minijuegos por dentro (Palabra del día, Ruleta, Bolitas):
 * el marco con "Volver" y "Cómo jugar", la hoja de ayuda, la hoja del
 * resultado y la línea del premio. Reemplazan a ArcadeShell y a los tres
 * modales hechos a mano.
 */

/**
 * La barra del juego: "Volver" (a la Zona Arcade), el título con su trazo y
 * "Cómo jugar"; debajo, el juego.
 *  - titulo · urlVolver · onAyuda · acciones (más botones a la derecha)
 *  - ancho: 'md' (760px) | 'lg' (1100px)
 */
export function MarcoJuego({ titulo, urlVolver = '/minijuegos', onAyuda, acciones, ancho = 'lg', children }) {
  return (
    <div className={[s.marco, ancho === 'md' && s.marcoMedio].filter(Boolean).join(' ')} data-componente="MarcoJuego">
      <div className={s.barra}>
        <Boton to={urlVolver} variante="fantasma" tamano="sm" icono={<ArrowLeft aria-hidden="true" />} className={s.volver} aria-label="Volver a la Zona Arcade">
          <span className={s.textoAncho}>Volver</span>
        </Boton>
        <h1 className={s.titulo}>{titulo}<Trazo className={s.trazo} /></h1>
        <div className={s.acciones}>
          {acciones}
          {onAyuda && (
            <Boton variante="secundario" tamano="sm" icono={<HelpCircle aria-hidden="true" />} onClick={onAyuda} aria-label="Cómo jugar">
              <span className={s.textoAncho}>Cómo jugar</span>
            </Boton>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * "Cómo se juega", en una hoja: una línea de entrada, los pasos numerados en
 * sellos, lo que haga falta mostrar (la leyenda de colores…) y una nota.
 *  - abierta, onCerrar · intro · pasos: [nodo] · children · pie (nota)
 *  - boton: texto del botón ("Entendido, a jugar")
 */
export function AyudaJuego({ abierta, onCerrar, intro, pasos = [], children, pie, boton = 'Entendido, a jugar' }) {
  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      titulo="Cómo se juega"
      pie={<Boton bloque onClick={onCerrar}>{boton}</Boton>}
    >
      <div className={s.ayuda} data-componente="AyudaJuego">
        {intro && <p className={s.ayudaIntro}>{intro}</p>}
        {pasos.length > 0 && (
          <ol className={s.pasos}>
            {pasos.map((p, k) => (
              // eslint-disable-next-line react/no-array-index-key
              <li key={k}>
                <Sello tamano={28} girar={k % 2 ? 6 : -8}><b className={s.pasoNumero}>{k + 1}</b></Sello>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        )}
        {children}
        {pie && <p className={s.ayudaPie}>{pie}</p>}
      </div>
    </HojaInferior>
  );
}

/**
 * La línea del premio de un juego, según cómo va la entrega.
 *  - estado: 'acreditando' | 'acreditado' | 'ya' (ya ganó hoy) | 'error' |
 *    'sinSesion' | 'promesa' (lo que se gana, antes de jugar)
 *  - monto · texto (reemplaza el texto por defecto) · urlLogin
 */
export function PremioJuego({ estado = 'promesa', monto, texto, urlLogin = '/login' }) {
  let cuerpo;
  if (estado === 'acreditando') {
    cuerpo = <Cargando tamano="sm" texto={texto || 'Acreditando tus monedas'} />;
  } else if (estado === 'acreditado') {
    cuerpo = <><GananciaMonedas monto={monto} /><span>{texto || 'acreditadas en tu cuenta.'}</span></>;
  } else if (estado === 'ya') {
    cuerpo = <><Check aria-hidden="true" className={s.premioIcono} /><span>{texto || 'Ya ganaste tus monedas hoy. Vuelve mañana por las siguientes.'}</span></>;
  } else if (estado === 'error') {
    cuerpo = <><AlertCircle aria-hidden="true" className={s.premioIcono} /><span>{texto || 'No pudimos acreditar tu premio. Inténtalo de nuevo más tarde.'}</span></>;
  } else if (estado === 'sinSesion') {
    cuerpo = (
      <>
        <span>{texto || 'Inicia sesión para ganar monedas con este juego.'}</span>
        <Boton to={urlLogin} variante="secundario" tamano="sm" icono={<LogIn aria-hidden="true" />}>Iniciar sesión</Boton>
      </>
    );
  } else {
    cuerpo = <><GananciaMonedas monto={monto} /><span>{texto}</span></>;
  }
  return (
    <p className={[s.premio, s[`premio_${estado}`]].filter(Boolean).join(' ')} role={estado === 'acreditando' ? 'status' : undefined} data-componente="PremioJuego">
      {cuerpo}
    </p>
  );
}

/**
 * La hoja del resultado: un sello o una cara de Kapi, el título con su trazo,
 * el texto, lo que se ganó y las acciones. Mientras se acreditan las monedas
 * no se cierra (`ocupado`).
 *  - abierta, onCerrar, ocupado · titulo · tituloHoja ("Tu resultado") · imagen
 *    (una cara de Kapi) o icono (en un sello) · texto (nodo) · children · acciones
 */
export function ResultadoJuego({ abierta, onCerrar, ocupado = false, titulo, tituloHoja = 'Tu resultado', imagen, icono, texto, children, acciones }) {
  const cerrar = () => { if (!ocupado) onCerrar?.(); };
  return (
    <HojaInferior abierta={abierta} onCerrar={cerrar} titulo={tituloHoja} pie={acciones && <div className={s.resultadoAcciones}>{acciones}</div>}>
      <div className={s.resultado} data-componente="ResultadoJuego">
        {imagen ? <img src={imagen} alt="" width="104" height="104" className={s.resultadoKapi} /> : icono && <Sello tamano={68}>{icono}</Sello>}
        <p className={s.resultadoTitulo}>{titulo}<Trazo className={s.trazo} /></p>
        {texto && <div className={s.resultadoTexto}>{texto}</div>}
        {children}
      </div>
    </HojaInferior>
  );
}

/**
 * Cifras del jugador (jugadas, victorias, rachas…) en cuadros.
 *  - cifras: [{ etiqueta, valor }]
 */
export function CifrasJuego({ cifras = [] }) {
  return (
    <dl className={s.cifras} data-componente="CifrasJuego">
      {cifras.map((c) => (
        <div key={c.etiqueta}>
          <dt>{c.etiqueta}</dt>
          <dd>{c.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
