import React from 'react';
import { Shirt, Upload, ShoppingBag } from 'lucide-react';
import { Sello, Trazo, Garabatos } from '../Marca';
import s from './Crear.module.css';

/*
 * Piezas de Crear (/personalizar): la portada con los tres pasos y el texto
 * de "¿Para cuántos?". Las prendas y los combos son TarjetaProducto (accion
 * "crear") y el selector, Chip: ya estaban en el kit.
 */

/* ── Portada ─────────────────────────────────────────────── */

export const PASOS_CREAR = [
  { Icono: Shirt, titulo: 'Elige tu prenda', texto: 'Color y talla' },
  { Icono: Upload, titulo: 'Diseña', texto: 'Sube tu imagen o escribe un texto' },
  { Icono: ShoppingBag, titulo: 'Recíbela', texto: 'La imprimimos y te la enviamos' },
];

/**
 * La portada de Crear: el arte de Kapi diseñando (ancho en escritorio,
 * vertical en el celular) y, en el lado libre, el título con su trazo y los
 * tres pasos en sellos unidos por una costura punteada (como una prenda).
 *  - titulo, texto · pasos: [{ Icono, titulo, texto }] (PASOS_CREAR)
 *  - arte: { ancho, ancho1200, movil } las imágenes de /crear
 */
export function PortadaCrear({
  titulo = 'Crea tu prenda',
  texto = 'Elige una prenda, ponle tu imagen o tu frase y la imprimimos para ti.',
  pasos = PASOS_CREAR,
  arte = { ancho: '/crear/banner-crear.webp', ancho1200: '/crear/banner-crear-1200.webp', movil: '/crear/banner-crear-movil.webp' },
}) {
  return (
    <section className={s.portada} data-componente="PortadaCrear">
      <picture>
        <source media="(max-width: 768px)" srcSet={arte.movil} width="800" height="1067" />
        <img
          className={s.portadaArte}
          src={arte.ancho}
          srcSet={`${arte.ancho1200} 1200w, ${arte.ancho} 2172w`}
          sizes="(max-width: 1280px) 100vw, 1248px"
          alt=""
          aria-hidden="true"
          draggable={false}
          width="2172"
          height="724"
        />
      </picture>
      <div className={s.portadaTexto}>
        <Garabatos variante="titulo" className={s.portadaGarabatos} />
        <h1 className={s.portadaTitulo}>
          {titulo}
          <Trazo className={s.portadaTrazo} />
        </h1>
        <p className={s.portadaBajada}>{texto}</p>
        <ol className={s.pasos}>
          {pasos.map(({ Icono, titulo: t, texto: x }, i) => (
            <li key={t} className={s.paso} style={{ '--i': i }}>
              <span className={s.pasoSello}>
                <Sello tamano={42} girar={i % 2 ? 6 : -8}><Icono aria-hidden="true" /></Sello>
                <span className={s.pasoNumero} aria-hidden="true">{i + 1}</span>
              </span>
              <span className={s.pasoTextos}>
                <strong><span className={s.oculto}>{i + 1}. </span>{t}</strong>
                <span>{x}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Nombre de cada opción de "¿Para cuántos?" (etiquetaPara de la tienda): si
 * los combos de ese tamaño mezclan prendas distintas son un conjunto para una
 * persona, no prendas iguales para varias.
 */
export const textoPara = (n, conjunto) => {
  if (n === 1) return 'Para ti';
  if (conjunto) return 'Conjunto';
  return n === 2 ? 'En pareja' : `Para ${n}`;
};
