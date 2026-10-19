import React from 'react';
import { motion } from 'framer-motion';
import { Estallido } from '../Efectos';
import { useTexto } from '../Traduccion';
import s from './Bolitas.module.css';

/*
 * Piezas de Las Bolitas de Kapi (/ball-sort): las reglas (puras) y un tubo
 * con sus bolitas. Las bolitas viajan de un tubo a otro con `layoutId`
 * (framer-motion): la página envuelve los tubos en un <LayoutGroup>.
 */

export const COLORES_BOLITAS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
export const CAPACIDAD_TUBO = 4;

/**
 * Un nivel nuevo: tantos tubos llenos como colores, mezclados, y dos vacíos
 * para maniobrar. `aleatorio` se puede pasar para repetir un nivel.
 */
export function nivelBolitas({ colores = COLORES_BOLITAS, capacidad = CAPACIDAD_TUBO, vacios = 2, aleatorio = Math.random } = {}) {
  const bolas = colores.flatMap((color, c) => Array.from({ length: capacidad }, (_, k) => ({ id: `b${c}-${k}`, color })));
  for (let i = bolas.length - 1; i > 0; i -= 1) {
    const j = Math.floor(aleatorio() * (i + 1));
    [bolas[i], bolas[j]] = [bolas[j], bolas[i]];
  }
  const tubos = colores.map((_, t) => bolas.slice(t * capacidad, (t + 1) * capacidad));
  // Si la mezcla dejó un tubo ya resuelto, se vuelve a mezclar.
  if (tubos.some((t) => tuboListo(t, capacidad))) return nivelBolitas({ colores, capacidad, vacios, aleatorio });
  return [...tubos, ...Array.from({ length: vacios }, () => [])];
}

/** Un tubo está listo con todas sus bolitas del mismo color. */
export const tuboListo = (tubo, capacidad = CAPACIDAD_TUBO) => tubo.length === capacidad && tubo.every((b) => b.color === tubo[0].color);

/** ¿Se puede soltar la bolita de arriba de `de` en `a`? (cabe y el de arriba es del mismo color, o está vacío) */
export function puedeSoltar(tubos, de, a, capacidad = CAPACIDAD_TUBO) {
  if (de == null || de === a) return false;
  const origen = tubos[de];
  const destino = tubos[a];
  if (!origen?.length || destino.length >= capacidad) return false;
  return !destino.length || destino[destino.length - 1].color === origen[origen.length - 1].color;
}

/** El nivel está resuelto cuando cada tubo con bolitas está listo. */
export const nivelResuelto = (tubos, capacidad = CAPACIDAD_TUBO) => tubos.every((t) => !t.length || tuboListo(t, capacidad));

/** Mueve la bolita de arriba de `de` a `a` (sin mirar las reglas). */
export function moverBolita(tubos, de, a) {
  const copia = tubos.map((t) => [...t]);
  copia[a].push(copia[de].pop());
  return copia;
}

const RESORTE = { type: 'spring', stiffness: 320, damping: 26, mass: 0.8 };

/** Una bolita (con su brillo). */
export function Bolita({ color, id, levantada = false, chica = false }) {
  return (
    <motion.span
      layoutId={id}
      layout="position"
      transition={RESORTE}
      className={[s.bolita, chica && s.bolitaChica].filter(Boolean).join(' ')}
      style={{ '--bola': color }}
      animate={{ y: levantada ? -28 : 0, scale: levantada ? 1.06 : 1 }}
    />
  );
}

/**
 * Un tubo: sus bolitas de abajo hacia arriba. La de arriba se levanta al
 * elegir el tubo; si se puede soltar aquí, el tubo se marca.
 *  - bolas: [{ id, color }] · capacidad · elegido · destino · listo
 *  - onClick · numero (para lectores de pantalla) · chico (la ayuda)
 */
export function TuboBolitas({ bolas = [], capacidad = CAPACIDAD_TUBO, elegido = false, destino = false, listo = false, onClick, numero, chico = false }) {
  const Etiqueta = onClick ? 'button' : 'span';
  const etiqueta = useTexto(onClick ? `Tubo ${numero}: ${bolas.length} de ${capacidad}${listo ? ', listo' : ''}${elegido ? ', elegido' : ''}` : undefined);
  return (
    <Etiqueta
      type={onClick ? 'button' : undefined}
      className={[s.tubo, elegido && s.elegido, destino && s.destino, listo && s.listo, chico && s.tuboChico].filter(Boolean).join(' ')}
      style={{ '--capacidad': capacidad }}
      onClick={onClick}
      aria-label={etiqueta}
      aria-pressed={onClick ? elegido : undefined}
      data-componente={chico ? undefined : 'TuboBolitas'}
    >
      <span className={s.vidrio}>
        {bolas.map((b, k) => <Bolita key={b.id} id={chico ? undefined : b.id} color={b.color} levantada={elegido && k === bolas.length - 1} chica={chico} />)}
      </span>
      {listo && !chico && <Estallido disparo={`listo-${numero}`} forma="confeti" cantidad={10} distancia={40} colores={[bolas[0]?.color, '#8b5cf6', '#f59e0b']} />}
    </Etiqueta>
  );
}
