import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Star, Trophy, LogIn } from 'lucide-react';
import { Estallido } from '../Efectos';
import { Pestanas } from '../Navegacion';
import Boton from '../Boton';
import { TextoResaltado } from './TextoResaltado';
import { Texto, useTexto } from '../Traduccion';
import { COLORES, CAPACIDAD, tramo, tuboListo } from './bolitasMotor.mjs';
import s from './Bolitas.module.css';

/*
 * Piezas de Las Bolitas de Kapi (/ball-sort): un tubo con sus bolitas. Las
 * reglas, los niveles y el solucionador están en bolitasMotor.mjs (puro, con
 * sus pruebas). Las bolitas viajan de un tubo a otro con `layoutId`
 * (framer-motion): la página envuelve los tubos en un <LayoutGroup>.
 */

export { COLORES, CAPACIDAD, tuboListo };
// Los nombres de antes (la demo y la guía los usan).
export const COLORES_BOLITAS = COLORES.map((c) => c.hex);
export const CAPACIDAD_TUBO = CAPACIDAD;

/** El color de una bolita: el del motor (`c`) o uno puesto a mano (`color`). */
export const colorDe = (b) => b.color || COLORES[b.c]?.hex;

const RESORTE = { type: 'spring', stiffness: 320, damping: 26, mass: 0.8 };

/**
 * Las estrellas de un nivel (de 0 a 3).
 *  - valor · tamano: 'sm' (el mapa) | 'md' (el nivel) | 'lg' (el resultado)
 *  - animar: entran una por una (el resultado)
 */
export function EstrellasNivel({ valor = 0, tamano = 'sm', animar = false }) {
  const etiqueta = useTexto(valor === 1 ? '1 de 3 estrellas' : `${valor} de 3 estrellas`);
  return (
    <span className={[s.estrellas, s[`estrellas_${tamano}`]].join(' ')} role="img" aria-label={etiqueta}>
      {[0, 1, 2].map((k) => (
        <motion.span
          key={k}
          className={k < valor ? s.estrellaLlena : s.estrellaVacia}
          initial={animar ? { scale: 0, rotate: -40 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: animar ? 0.25 + k * 0.2 : 0, type: 'spring', stiffness: 420, damping: 14 }}
        >
          <Star aria-hidden="true" />
        </motion.span>
      ))}
    </span>
  );
}

/**
 * El ranking del reto del día: hoy (menos movimientos) y la semana (más retos
 * hechos; empate, menos movimientos en total). Los nombres llegan cortos
 * ("Lucía R.") desde el servidor y van tal cual; el tuyo va marcado y, si
 * quedaste fuera de los primeros, se dice tu puesto.
 *  - ranking: { hoy: [{ puesto, nombre, movimientos, yo }],
 *    semanal: [{ puesto, nombre, completados, total, yo }],
 *    yo: { hoy, semana, jugadoresHoy, jugadoresSemana } } o null
 *  - cargando · sesion · urlLogin
 */
export function RankingBolitas({ ranking, cargando = false, sesion = true, urlLogin = '/login' }) {
  const [pestana, setPestana] = useState('hoy');
  const t = { tu: useTexto('Tú'), titulo: useTexto('Ranking del reto') };
  const lista = (pestana === 'hoy' ? ranking?.hoy : ranking?.semanal) || [];
  const puesto = pestana === 'hoy' ? ranking?.yo?.hoy : ranking?.yo?.semana;
  const total = pestana === 'hoy' ? ranking?.yo?.jugadoresHoy : ranking?.yo?.jugadoresSemana;
  const fuera = puesto && !lista.some((f) => f.yo);
  let cuerpo;
  if (cargando && !ranking) cuerpo = <p className={s.rankingVacio} role="status"><Texto>Cargando el ranking…</Texto></p>;
  else if (!lista.length) {
    cuerpo = (
      <p className={s.rankingVacio}>
        <Texto>{pestana === 'hoy' ? 'Nadie hizo el reto de hoy todavía. ¡Sé la primera persona!' : 'Todavía nadie hizo un reto esta semana.'}</Texto>
      </p>
    );
  } else {
    cuerpo = (
      <ol className={s.rankingLista}>
        {lista.map((f) => (
          <li key={`${f.puesto}-${f.nombre}`} className={f.yo ? s.rankingYo : undefined}>
            <span className={[s.rankingPuesto, f.puesto <= 3 && s[`podio${f.puesto}`]].filter(Boolean).join(' ')}>{f.puesto}</span>
            <span className={s.rankingNombre}>{f.nombre}{f.yo && <small>{t.tu}</small>}</span>
            <span className={s.rankingValor}>
              {pestana === 'hoy'
                ? <Texto>{f.movimientos === 1 ? '1 movimiento' : `${f.movimientos} movimientos`}</Texto>
                : <Texto>{`${f.completados === 1 ? '1 reto' : `${f.completados} retos`} · ${f.total} mov.`}</Texto>}
            </span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <section className={s.ranking} aria-label={t.titulo} data-componente="RankingBolitas">
      <p className={s.rankingTitulo}><Trophy aria-hidden="true" />{t.titulo}</p>
      <Pestanas opciones={[{ id: 'hoy', texto: 'Hoy' }, { id: 'semana', texto: 'Esta semana' }]} valor={pestana} onChange={setPestana} etiqueta="Ranking del reto" />
      {cuerpo}
      {fuera && (
        <p className={s.rankingNota}>
          <TextoResaltado resaltar={[puesto]}>{total ? `Vas en el puesto ${puesto} de ${total}.` : `Vas en el puesto ${puesto}.`}</TextoResaltado>
        </p>
      )}
      {!sesion && (
        <div className={s.rankingNota}>
          <Texto>Inicia sesión para aparecer en el ranking.</Texto>
          <Boton to={urlLogin} variante="secundario" tamano="sm" icono={<LogIn aria-hidden="true" />}><Texto>Iniciar sesión</Texto></Boton>
        </div>
      )}
    </section>
  );
}

/**
 * Una bolita (con su brillo). `oculta` se ve como "?"; `hielo` (movimientos
 * que le faltan para derretirse) la cubre de hielo con el número.
 */
export function Bolita({ color, id, levantada = false, chica = false, oculta = false, hielo = 0 }) {
  return (
    <motion.span
      layoutId={id}
      layout="position"
      transition={RESORTE}
      className={[s.bolita, chica && s.bolitaChica, oculta && s.oculta, hielo > 0 && s.congelada].filter(Boolean).join(' ')}
      style={oculta ? undefined : { '--bola': color }}
      animate={{ y: levantada ? -28 : 0, scale: levantada ? 1.06 : 1 }}
    >
      {oculta && <span className={s.signo} aria-hidden="true">?</span>}
      {hielo > 0 && <span className={s.hielo} aria-hidden="true">{hielo}</span>}
    </motion.span>
  );
}

/**
 * Un tubo: sus bolitas de abajo hacia arriba. Al elegirlo se levantan las de
 * arriba que se moverían juntas; si se puede soltar aquí, el tubo se marca.
 *  - bolas: [{ id, c | color, oculta, hielo }] · capacidad · elegido · destino · listo
 *  - cortina: el color que lo abre (índice) o null · pista: 'origen' | 'destino'
 *  - onClick · numero (para lectores de pantalla) · chico (la ayuda)
 */
export function TuboBolitas({ bolas = [], capacidad = CAPACIDAD, elegido = false, destino = false, listo = false, cortina = null, pista, onClick, numero, chico = false }) {
  const Etiqueta = onClick ? 'button' : 'span';
  const levantadas = elegido ? tramo(bolas) : 0;
  const colorCortina = cortina != null ? COLORES[cortina] : null;
  const estadoTubo = [
    listo && ', listo',
    elegido && ', elegido',
    colorCortina && `, cerrado hasta completar el ${colorCortina.nombre}`,
    pista && (pista === 'origen' ? ', pista: mueve desde aquí' : ', pista: suelta aquí'),
  ].filter(Boolean).join('');
  const etiqueta = useTexto(onClick ? `Tubo ${numero}: ${bolas.length} de ${capacidad}${estadoTubo}` : undefined);
  return (
    <Etiqueta
      type={onClick ? 'button' : undefined}
      className={[s.tubo, elegido && s.elegido, destino && s.destino, listo && s.listo, pista && s.pista, chico && s.tuboChico].filter(Boolean).join(' ')}
      style={{ '--capacidad': capacidad }}
      onClick={onClick}
      aria-label={etiqueta}
      aria-pressed={onClick ? elegido : undefined}
      data-componente={chico ? undefined : 'TuboBolitas'}
    >
      <span className={s.vidrio}>
        {bolas.map((b, k) => (
          <Bolita
            key={b.id}
            id={chico ? undefined : b.id}
            color={colorDe(b)}
            oculta={b.oculta}
            hielo={b.hielo}
            levantada={k >= bolas.length - levantadas}
            chica={chico}
          />
        ))}
        {colorCortina && (
          <span className={s.cortina} style={{ '--bola': colorCortina.hex }} aria-hidden="true">
            <Lock className={s.candado} />
            <span className={s.llave} />
          </span>
        )}
      </span>
      {listo && !chico && <Estallido disparo={`listo-${numero}`} forma="confeti" cantidad={10} distancia={40} colores={[colorDe(bolas[0] || {}), '#8b5cf6', '#f59e0b']} />}
    </Etiqueta>
  );
}
