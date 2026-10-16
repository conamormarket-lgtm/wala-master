import React, { useEffect, useRef, useState } from 'react';
import { useBloquearScroll } from './Efectos';
import s from './Cargando.module.css';

/*
 * Cargar en Walá: la etiqueta del logo se mece colgada de su cordón (como
 * una etiqueta de verdad). Es lo único que se mueve en bucle en todo el kit,
 * porque dice "algo está pasando". Solo transform y opacity, en CSS: siguen
 * fluidas aunque React esté ocupado montando la tienda.
 */

/** Duraciones de los ciclos (ms); deben coincidir con el CSS. */
const CICLO_VAIVEN = 2400;
const CICLO_BARRA = 1400;

/**
 * Fase compartida: dos cargas seguidas (la del inicio y la de la tienda) son
 * instancias distintas. Con un retraso negativo tomado del reloj de la
 * página, la segunda sigue el vaivén donde iba la primera y el relevo no se
 * nota (la idea de BrandLoader).
 */
function useFase() {
  const fase = useRef(null);
  if (fase.current === null) {
    const ahora = typeof performance !== 'undefined' ? performance.now() : 0;
    fase.current = { vaiven: `-${Math.round(ahora % CICLO_VAIVEN)}ms`, barra: `-${Math.round(ahora % CICLO_BARRA)}ms` };
  }
  return fase.current;
}

/** Frases de la carga de marca: van cambiando mientras se espera. */
export const FRASES_CARGA = ['Preparando tu tienda', 'Doblando las poleras', 'Calentando la plancha', 'Eligiendo los colores'];

/**
 * La pantalla de marca de la primera carga: el degradado del logo, la
 * etiqueta blanca meciéndose de su cordón, WALÁ, una barra que va y viene y
 * (si se pasan) frases que cambian cada 2,4 s.
 *  - frases: [texto] (FRASES_CARGA) o nada · pantallaCompleta: fija al
 *    viewport (en la tienda); sin ella llena su contenedor (demo, landing)
 *  - saliendo: true dispara la salida (se funde y se abre un poco hacia la
 *    tienda) y al terminar llama a onSalio · relevo: sale en seco (hay otra
 *    pantalla igual detrás)
 * Sin entrada animada: releva sin costura al splash estático de index.html.
 */
export function PantallaCarga({ frases, pantallaCompleta = false, saliendo = false, relevo = false, onSalio }) {
  const fase = useFase();
  const [frase, setFrase] = useState(0);
  useEffect(() => {
    if (!frases?.length || saliendo) return undefined;
    const t = setInterval(() => setFrase((n) => (n + 1) % frases.length), CICLO_VAIVEN);
    return () => clearInterval(t);
  }, [frases, saliendo]);
  // Si la transición no llega a terminar (pestaña en segundo plano), sale igual.
  useEffect(() => {
    if (!saliendo) return undefined;
    const t = setTimeout(() => onSalio?.(), relevo ? 0 : 700);
    return () => clearTimeout(t);
  }, [saliendo, relevo, onSalio]);
  return (
    <div
      className={[s.pantalla, pantallaCompleta && s.completa, saliendo && (relevo ? s.relevo : s.saliendo)].filter(Boolean).join(' ')}
      role="status"
      aria-label="Cargando"
      data-componente="PantallaCarga"
    >
      <div className={s.conjunto}>
        <img
          src="/assets/marca/splash-etiqueta.webp"
          width={246}
          height={330}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={s.etiqueta}
          style={{ animationDelay: fase.vaiven }}
        />
        <img src="/assets/marca/splash-wala.webp" width={368} height={160} alt="Walá" draggable={false} className={s.palabra} />
        <span className={s.pista} aria-hidden="true">
          <span className={s.barra} style={{ animationDelay: fase.barra }} />
        </span>
        {frases?.length > 0 && (
          <span key={frase} className={s.frase} aria-hidden="true">{frases[frase]}…</span>
        )}
      </div>
    </div>
  );
}

/**
 * La etiqueta del logo a color meciéndose y un texto en gris. Es la etiqueta
 * actual (la imagen del splash, pintada con el degradado como el logo de la
 * cabecera: por la W calada se ve el fondo). Es la pieza de CapaCargando y
 * sirve suelta en zonas chicas.
 *  - texto ('Cargando' por defecto; null = sin texto) · tamano: 'sm' | 'md' | 'lg'
 *  - bloque: ocupa su espacio y se centra (alto mínimo 240px)
 */
export function Cargando({ texto = 'Cargando', tamano = 'md', bloque = false }) {
  const fase = useFase();
  const medida = { sm: 20, md: 30, lg: 46 }[tamano] || 30;
  return (
    <div className={[s.cargando, s[`t_${tamano}`], bloque && s.bloque].filter(Boolean).join(' ')} role="status" data-componente="Cargando">
      <span className={s.mini} style={{ width: medida, animationDelay: fase.vaiven }} aria-hidden="true" />
      {texto ? <span className={s.texto}>{texto}<span className={s.puntos} aria-hidden="true"><i /><i /><i /></span></span> : <span className={s.oculto}>Cargando</span>}
    </div>
  );
}

/**
 * Esperar una acción (procesar un pago, verificar un documento, subir un
 * diseño, abrir una landing cuya forma aún no se conoce): la página se queda
 * a la vista, detrás de un velo claro, y encima una tarjeta con Cargando.
 * No es para cambiar de página: para eso está el esqueleto de la página
 * (Esqueletos.jsx), que ya muestra su forma.
 *  - texto ('Procesando') · detalle: una línea más chica debajo
 *  - pantallaCompleta: fija al viewport; sin ella cubre su contenedor
 */
export function CapaCargando({ texto = 'Procesando', detalle, pantallaCompleta = false }) {
  // Mientras se espera, la página no se mueve (el pago, quitar el fondo…):
  // ni la ventana ni un marco con scroll propio debajo de la capa.
  useBloquearScroll(true);
  const capa = useRef(null);
  useEffect(() => {
    const el = capa.current;
    if (!el) return undefined;
    const frenar = (e) => e.preventDefault();
    el.addEventListener('wheel', frenar, { passive: false });
    el.addEventListener('touchmove', frenar, { passive: false });
    return () => {
      el.removeEventListener('wheel', frenar);
      el.removeEventListener('touchmove', frenar);
    };
  }, []);
  return (
    <div ref={capa} className={[s.capa, pantallaCompleta && s.capaCompleta].filter(Boolean).join(' ')} data-componente="CapaCargando">
      <div className={s.capaTarjeta}>
        <Cargando texto={texto} tamano="lg" />
        {detalle && <p className={s.capaDetalle}>{detalle}</p>}
      </div>
    </div>
  );
}

// El esqueleto de una página (y de cada sección y componente) vive en Esqueletos.jsx.
