import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HojaInferior } from './Feedback';
import s from './Desplegable.module.css';

/** ¿Hay ratón de verdad y pantalla ancha? (en la app de Capacitor: no). */
const conRaton = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
  window.matchMedia('(min-width: 761px)').matches;

/**
 * Base de todos los menús de la cabecera (tienda, monedas, cuenta,
 * favoritos, carrito, notificaciones).
 *
 * Con ratón: se abre al pasar por encima (con un pequeño retardo para que no
 * parpadee al cruzar la cabecera), se cierra al salir (con margen para llegar
 * al panel) y un clic lo deja fijo. Esc o un clic fuera lo cierran.
 *
 * En táctil (celular / app), según `alTocar`:
 *  - 'hoja':  abre el contenido en una hoja inferior nativa.
 *  - 'globo': lo muestra como globo bajo el botón (ayudas cortas).
 *  - 'nada':  no abre nada; el disparador hace lo suyo (p. ej. navegar al carrito).
 *
 * Props:
 *  - disparador(props): render del botón/enlace; hay que esparcir `props`.
 *  - children: nodo o función (cerrar) => nodo.
 *  - titulo: título de la hoja en móvil.
 *  - alinear: 'derecha' | 'izquierda' | 'centro'.  ancho: px del panel.
 *  - abierto / onAbiertoChange: control externo (para que solo haya uno abierto).
 */
export default function Desplegable({
  disparador,
  children,
  titulo,
  alTocar = 'hoja',
  alinear = 'derecha',
  ancho = 340,
  variante,
  abierto: abiertoControlado,
  onAbiertoChange,
  retrasoAbrir = 90,
  retrasoCerrar = 200,
}) {
  const id = useId();
  const [interno, setInterno] = useState(false);
  const [comoHoja, setComoHoja] = useState(false);
  const controlado = abiertoControlado !== undefined;
  const abierto = controlado ? abiertoControlado : interno;
  const cajaRef = useRef(null);
  const disparadorRef = useRef(null);
  const fijado = useRef(false);
  const reloj = useRef(0);

  const cambiar = useCallback((valor) => {
    if (!valor) fijado.current = false;
    if (controlado) onAbiertoChange?.(valor);
    else setInterno(valor);
  }, [controlado, onAbiertoChange]);

  const cerrar = useCallback(() => cambiar(false), [cambiar]);

  // Clic fuera o Esc (solo en modo panel; la hoja tiene los suyos).
  useEffect(() => {
    if (!abierto || comoHoja) return undefined;
    const fuera = (e) => { if (!cajaRef.current?.contains(e.target)) cerrar(); };
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      cerrar();
      disparadorRef.current?.focus?.();
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto, comoHoja, cerrar]);

  useEffect(() => () => window.clearTimeout(reloj.current), []);

  const entrar = (e) => {
    if (e.pointerType !== 'mouse' || !conRaton()) return;
    window.clearTimeout(reloj.current);
    if (abierto) return;
    reloj.current = window.setTimeout(() => {
      setComoHoja(false);
      cambiar(true);
    }, retrasoAbrir);
  };

  const salir = (e) => {
    if (e.pointerType !== 'mouse' || fijado.current || comoHoja) return;
    window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => cambiar(false), retrasoCerrar);
  };

  const pulsar = (e) => {
    window.clearTimeout(reloj.current);
    const raton = conRaton();
    if (!raton && alTocar === 'nada') return; // deja que el enlace navegue
    if (raton && alTocar === 'nada') { cerrar(); return; }
    e.preventDefault();
    const hoja = !raton && alTocar === 'hoja';
    setComoHoja(hoja);
    if (abierto && !hoja && fijado.current) {
      cerrar();
    } else {
      fijado.current = true;
      cambiar(true);
    }
  };

  const propsDisparador = {
    ref: disparadorRef,
    onClick: pulsar,
    'aria-expanded': abierto,
    'aria-haspopup': alTocar === 'nada' ? undefined : 'dialog',
    'aria-controls': abierto && !comoHoja ? id : undefined,
  };

  const contenido = typeof children === 'function' ? children(cerrar) : children;

  return (
    <div className={s.caja} ref={cajaRef} onPointerEnter={entrar} onPointerLeave={salir}>
      {disparador(propsDisparador)}

      <AnimatePresence>
        {abierto && !comoHoja && (
          <motion.div
            id={id}
            className={[s.panel, s[alinear], variante && s[variante]].filter(Boolean).join(' ')}
            style={{ width: ancho }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onPointerEnter={() => window.clearTimeout(reloj.current)}
          >
            {contenido}
          </motion.div>
        )}
      </AnimatePresence>

      {alTocar === 'hoja' && (
        <HojaInferior abierta={abierto && comoHoja} onCerrar={cerrar} titulo={titulo}>
          {contenido}
        </HojaInferior>
      )}
    </div>
  );
}
