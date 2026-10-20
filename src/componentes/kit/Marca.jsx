import React from 'react';
import { Check } from 'lucide-react';
import s from './Marca.module.css';

/*
 * Lenguaje propio de Walá, sacado del logo y de los banners:
 *  - La ETIQUETA COLGANTE (la "W" vive en una etiqueta de precio con su hilo;
 *    hasta la tilde de la Á es una etiqueta). Es la pieza que hace que algo
 *    se vea "de Walá" y no de cualquier tienda.
 *  - La letra del logo: Montserrat 900 apretada (--fuente-marca).
 *  - Garabatos de los banners: destellos ✦, corazones y puntos de medio tono.
 *    Siempre quietos (sin bucles): dan vida sin gastar batería.
 */

/**
 * Pasteles de la marca (lila, rosa, oro, menta, cielo) para fondos que se
 * alternan: categorías, burbujas, destacados. Las fotos con fondo blanco se
 * funden con multiply y quedan sobre el color.
 */
export const PASTELES = ['#ede9fe', '#fce7f3', '#fef3c7', '#ccfbf1', '#e0f2fe'];
export const pastel = (k) => PASTELES[((k % PASTELES.length) + PASTELES.length) % PASTELES.length];

/**
 * Acentos (los mismos colores, más vivos) para aros y bordes. Las fotos de
 * producto NO van sobre color: con multiply el pastel teñía la prenda (una
 * polera blanca se veía lila). El color va alrededor, la foto en neutro.
 */
export const ACENTOS = ['#c4b5fd', '#f9a8d4', '#fcd34d', '#5eead4', '#7dd3fc'];
export const acento = (k) => ACENTOS[((k % ACENTOS.length) + ACENTOS.length) % ACENTOS.length];

/*
 * El logo actual de Walá, siempre desde sus imágenes oficiales (pintadas por
 * máscara, así toman el color que haga falta):
 *  - la etiqueta: /assets/marca/splash-etiqueta.webp (la del splash);
 *  - el logo entero: /assets/marca/logo-header-v2.webp (el de la cabecera),
 *    con la W de la etiqueta en logo-header-huecos-v2.webp.
 * La W va calada: por ella se ve el fondo (blanco en la tienda, violeta en un
 * panel de la marca), como en el logo real. Antes se dibujaban a mano en SVG
 * y no eran iguales al logo.
 */

/**
 * Isotipo: la etiqueta con la W. `tono` 'color' (degradado del logo),
 * 'blanco' (sobre fondos de color) o 'actual' (currentColor).
 *  - tamano: el ancho en px (el alto sale de la etiqueta, 246 × 330)
 *  - titulo: si se pasa, se anuncia como imagen ("Walá")
 */
export function IsoWala({ tamano = 32, tono = 'color', className, titulo }) {
  return (
    <span
      className={[s.iso, s[`iso_${tono}`], className].filter(Boolean).join(' ')}
      style={{ width: tamano }}
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    />
  );
}

/**
 * Logo completo (etiqueta + WALÁ con la etiquetita de tilde), el mismo de la
 * cabecera. `tono` 'color' (degradado, con la W blanca) o 'blanco' (sobre
 * fondos de color: la W deja ver el fondo).
 *  - tamano: escala del logo (30 ≈ el alto de la etiqueta; el logo mide
 *    1,3 veces eso de alto y lo ancho que le toque, 431 × 168)
 */
export function LogoWala({ tamano = 30, tono = 'color', className }) {
  return (
    <span
      className={[s.logo, tono === 'blanco' && s.logoBlanco, className].filter(Boolean).join(' ')}
      style={{ '--logo': `${tamano}px` }}
      role="img"
      aria-label="Walá"
    >
      <span className={s.logoForma} aria-hidden="true" />
      {tono !== 'blanco' && <span className={s.logoHuecos} aria-hidden="true" />}
    </span>
  );
}

/**
 * Etiqueta colgante: badge con forma de etiqueta de precio, agujero e hilo,
 * un poco inclinada (como la del logo). Para descuentos, "Nuevo",
 * antetítulos, "Universo Walá", "Compra verificada"…
 *  - tono: 'violeta' | 'magenta' | 'oro' | 'rojo' | 'blanco' | 'noche' | 'suave'
 *  - inclinar: grados (por defecto -4; 0 = derecha)
 *  - hilo: dibuja el hilo que sale del agujero
 *  - tamano: 'sm' | 'md' | 'lg'
 */
export function EtiquetaColgante({ tono = 'violeta', inclinar = -4, hilo = true, tamano = 'md', icono, className, children }) {
  return (
    <span
      className={[s.colgante, s[tono], s[tamano], hilo && s.conHilo, className].filter(Boolean).join(' ')}
      style={inclinar ? { '--inclinar': `${inclinar}deg` } : undefined}
    >
      <span className={s.cuerpo}>
        {icono}
        <span>{children}</span>
      </span>
    </span>
  );
}

/* ── Garabatos (decoración quieta, como en los banners) ── */

export function Destello({ className, style }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      <path d="M12 0c.6 5.6 2.6 9 12 12-9.4 3-11.4 6.4-12 12-.6-5.6-2.6-9-12-12C9.4 9 11.4 5.6 12 0Z" fill="currentColor" />
    </svg>
  );
}

export function Corazon({ className, style, contorno = false }) {
  return (
    <svg viewBox="0 0 24 22" className={className} style={style} aria-hidden="true">
      <path
        d="M12 21s-8.5-5.3-10.6-10.4C-.3 6.4 2.2 1.5 6.6 1.5c2.4 0 4.1 1.3 5.4 3.1 1.3-1.8 3-3.1 5.4-3.1 4.4 0 6.9 4.9 5.2 9.1C20.5 15.7 12 21 12 21Z"
        fill={contorno ? 'none' : 'currentColor'}
        stroke={contorno ? 'currentColor' : 'none'}
        strokeWidth={contorno ? 2 : 0}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Rejilla de puntos de medio tono (esquina de los banners). */
export function Puntos({ className, style, filas = 5, columnas = 7 }) {
  const puntos = [];
  for (let f = 0; f < filas; f += 1) {
    for (let c = 0; c < columnas; c += 1) {
      const r = 2.6 * (1 - c / (columnas + 1.5));
      puntos.push(<circle key={`${f}-${c}`} cx={6 + c * 10} cy={6 + f * 10 + (c % 2) * 5} r={Math.max(0.6, r)} />);
    }
  }
  return (
    <svg viewBox={`0 0 ${columnas * 10 + 2} ${filas * 10 + 8}`} className={className} style={style} fill="currentColor" aria-hidden="true">
      {puntos}
    </svg>
  );
}

/**
 * Racimo de garabatos para fondos de banners y bloques destacados.
 * variante: 'banner' (esquinas) | 'titulo' (al lado de un título) | 'pie'
 */
export function Garabatos({ variante = 'banner', className }) {
  return (
    <span className={[s.garabatos, s[`g_${variante}`], className].filter(Boolean).join(' ')} aria-hidden="true">
      <Destello className={s.g1} />
      <Destello className={s.g2} />
      <Corazon className={s.g3} contorno />
      <Corazon className={s.g4} />
      <Puntos className={s.g5} />
    </span>
  );
}

/** Subrayado a mano (trazo) para resaltar palabras en títulos. */
export function Trazo({ className }) {
  return (
    <svg viewBox="0 0 200 14" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d="M3 9.5C40 4 92 2.5 197 6.5" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M18 12.5C70 8.5 120 8 170 10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

/**
 * Sello: un ícono blanco en un círculo con el degradado del logo, girado como
 * los sellos de los banners. Es como Walá pone un ícono junto a un título o en
 * un acceso (nada de cuadritos lila).
 *  - children: el ícono (lucide u otro svg)
 *  - tamano: px del círculo (40) · girar: grados (-8; 0 = derecho)
 *  - tono: 'degradado' | 'suave' (lila con el ícono violeta: lo que no está
 *    elegido) | 'oro' | 'menta' | 'rosa' | 'bronce' | 'plata' (niveles)
 *    | 'peligro' (rojo: lo que no tiene vuelta, como eliminar)
 */
export function Sello({ children, tamano = 40, girar = -8, tono = 'degradado', className }) {
  return (
    <span
      className={[s.sello, tono !== 'degradado' && s[`sello_${tono}`], className].filter(Boolean).join(' ')}
      style={{ '--sello': `${tamano}px`, '--sello-giro': `${girar}deg` }}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

/**
 * El visto de Walá: un check blanco sobre el degradado del logo. Es la misma
 * marca en todo lo que se elige o se marca: la casilla (cuadro) y la opción
 * de una lista (círculo). Sin marcar, solo el borde; al marcarse, el check
 * entra girando un poco (solo transform y opacity).
 *  - activo · forma: 'circulo' | 'cuadro' · tamano: px (24) · className
 */
export function Visto({ activo = false, forma = 'circulo', tamano = 24, className }) {
  return (
    <span
      className={[s.visto, forma === 'cuadro' && s.vistoCuadro, activo && s.vistoActivo, className].filter(Boolean).join(' ')}
      style={{ '--visto': `${tamano}px` }}
      aria-hidden="true"
    >
      <Check className={s.vistoCheck} />
    </span>
  );
}
