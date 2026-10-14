import React, { useEffect, useRef, useState } from 'react';
import { IsoWala } from './Marca';
import { TarjetaProductoEsqueleto } from './TarjetaProducto';
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
 * Cargando dentro de la tienda (cambio de página, una sección, una lista):
 * la etiqueta del logo a color meciéndose y un texto en gris. Reemplaza al
 * círculo que gira.
 *  - texto ('Cargando' por defecto; null = sin texto) · tamano: 'sm' | 'md' | 'lg'
 *  - bloque: ocupa su espacio y se centra (alto mínimo 240px)
 */
export function Cargando({ texto = 'Cargando', tamano = 'md', bloque = false }) {
  const fase = useFase();
  const medida = { sm: 22, md: 34, lg: 52 }[tamano] || 34;
  return (
    <div className={[s.cargando, s[`t_${tamano}`], bloque && s.bloque].filter(Boolean).join(' ')} role="status" data-componente="Cargando">
      <span className={s.mini} style={{ animationDelay: fase.vaiven }} aria-hidden="true">
        <IsoWala tamano={medida} />
      </span>
      {texto ? <span className={s.texto}>{texto}<span className={s.puntos} aria-hidden="true"><i /><i /><i /></span></span> : <span className={s.oculto}>Cargando</span>}
    </div>
  );
}

/**
 * Mientras llega una página (Suspense): la forma de la página con tarjetas
 * vacías que brillan, sin ningún círculo (el reemplazo de PageLoading).
 *  - tarjetas: cuántas (8) · titulo: con la barra del título arriba
 */
export function EsqueletoPagina({ tarjetas = 8, titulo = true }) {
  return (
    <div className={s.esqueleto} aria-busy="true" aria-label="Cargando página" data-componente="EsqueletoPagina">
      {titulo && (
        <div className={s.esqueletoCabeza} aria-hidden="true">
          <span />
          <span />
        </div>
      )}
      <div className={s.esqueletoRejilla}>
        {Array.from({ length: tarjetas }, (_, k) => <TarjetaProductoEsqueleto key={k} />)}
      </div>
    </div>
  );
}
