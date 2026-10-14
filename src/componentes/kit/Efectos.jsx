import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import s from './Efectos.module.css';

/** Curva firma de Walá (expo-out), la misma de --ease-signature. */
export const EASE = [0.16, 1, 0.3, 1];
export const RESORTE = { type: 'spring', stiffness: 420, damping: 34 };

/** Número que "corre" hasta su nuevo valor (precios, totales, saldos). */
export function useContador(valor, duracion = 0.7) {
  const [mostrado, setMostrado] = useState(valor);
  const actual = useRef(valor);
  const reducir = useReducedMotion();

  useEffect(() => {
    if (reducir) {
      actual.current = valor;
      setMostrado(valor);
      return undefined;
    }
    const ctrl = animate(actual.current, valor, {
      duration: duracion,
      ease: EASE,
      onUpdate: (v) => {
        actual.current = v;
        setMostrado(v);
      },
    });
    return () => ctrl.stop();
  }, [valor, duracion, reducir]);

  return mostrado;
}

/** true dentro de la app de Capacitor (Android/iOS), false en la web. */
export const esApp = () => typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());

/** Bloquea el scroll de la página mientras hay un modal abierto, sin saltos por la barra. */
export function useBloquearScroll(activo) {
  useEffect(() => {
    if (!activo) return undefined;
    const raiz = document.documentElement;
    const barra = window.innerWidth - raiz.clientWidth;
    const previo = { overflow: raiz.style.overflow, padding: raiz.style.paddingRight };
    raiz.style.overflow = 'hidden';
    if (barra > 0) raiz.style.paddingRight = `${barra}px`;
    return () => {
      raiz.style.overflow = previo.overflow;
      raiz.style.paddingRight = previo.padding;
    };
  }, [activo]);
}

/* Modales abiertos, del más viejo al de encima. "Atrás" cierra solo el de
   encima (una lista abierta dentro de una hoja no se lleva la hoja), y el
   history.back() de un modal que se cierra solo no cierra a los demás. */
const pilaModales = [];
let popsIgnorados = 0;
const alVolverGlobal = () => {
  if (popsIgnorados > 0) { popsIgnorados -= 1; return; }
  pilaModales[pilaModales.length - 1]?.();
};

/**
 * El botón "atrás" (Android en Capacitor, o el del navegador) cierra el modal
 * en vez de salir de la pantalla. Capacitor, sin un listener propio de
 * backButton, retrocede en el historial: por eso basta con apilar un estado.
 * Con varios modales uno encima de otro, cierra solo el de encima.
 */
export function useCerrarConAtras(activo, onCerrar) {
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  useEffect(() => {
    if (!activo) return undefined;
    let apilado = false;
    let porAtras = false;
    const alVolver = () => {
      porAtras = true;
      cerrar.current();
    };
    // Se apila un instante después: si el componente se monta y desmonta en
    // seguida (StrictMode lo hace en desarrollo, o un cierre inmediato), no
    // queda un history.back() pendiente que cierre la siguiente hoja.
    const t = window.setTimeout(() => {
      window.history.pushState({ walaModal: true }, '');
      apilado = true;
      if (pilaModales.length === 0) window.addEventListener('popstate', alVolverGlobal);
      pilaModales.push(alVolver);
    }, 0);
    return () => {
      window.clearTimeout(t);
      const i = pilaModales.indexOf(alVolver);
      if (i >= 0) pilaModales.splice(i, 1);
      if (apilado && !porAtras && window.history.state?.walaModal) {
        popsIgnorados += 1;
        window.history.back();
      }
      if (pilaModales.length === 0 && popsIgnorados === 0) window.removeEventListener('popstate', alVolverGlobal);
    };
  }, [activo]);
}

/** Guarda la posición del puntero en --mx / --my para luces que lo siguen. */
export function seguirPuntero(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
}

/**
 * Estallido de partículas desde el centro del padre (corazón, check, meta).
 * Cada vez que cambia `disparo` se repite. forma: 'punto' | 'confeti'.
 */
export function Estallido({
  disparo,
  cantidad = 8,
  distancia = 30,
  forma = 'punto',
  colores = ['#8b5cf6', '#f43f5e', '#f59e0b', '#10b981'],
}) {
  if (!disparo) return null;
  return (
    <span key={disparo} className={`${s.estallido} ${s[forma]}`} aria-hidden="true">
      {Array.from({ length: cantidad }, (_, i) => (
        <span
          key={i}
          style={{
            '--ang': `${(360 / cantidad) * i + (i % 2 ? 14 : 0)}deg`,
            '--dist': `${distancia * (i % 3 === 0 ? 1 : i % 3 === 1 ? 0.75 : 1.2)}px`,
            '--c': colores[i % colores.length],
            '--giro': `${(i % 2 ? 1 : -1) * (120 + i * 25)}deg`,
          }}
        />
      ))}
    </span>
  );
}

/** Aparece suave al entrar en pantalla (una sola vez). */
export function Revelar({ children, retraso = 0, y = 26, className, as = 'div', ...rest }) {
  const M = motion[as];
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.75, ease: EASE, delay: retraso }}
      {...rest}
    >
      {children}
    </M>
  );
}
