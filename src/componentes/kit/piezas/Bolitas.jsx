import React from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { Estallido } from '../Efectos';
import { useTexto } from '../Traduccion';
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
