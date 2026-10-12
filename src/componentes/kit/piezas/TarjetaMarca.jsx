import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Enlace } from '../Enlace';
import { EtiquetaColgante } from '../Marca';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import s from './TarjetaMarca.module.css';

/* Colores de las tarjetas de marca sin color propio (bgColor). */
const PALETA_MARCAS = [
  ['#5b21b6', '#ddd6fe'],
  ['#9f1239', '#ffe4e6'],
  ['#075985', '#e0f2fe'],
  ['#065f46', '#d1fae5'],
  ['#9a3412', '#ffedd5'],
  ['#1e3a8a', '#e0e7ff'],
];

const iniciales = (nombre) => String(nombre || '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/**
 * Tarjeta de una marca: color, número, logo colgando de una etiqueta y
 * "Explorar colección".
 *  - marca: { nombre, logo, url, color, fondo } (tarjetaDesdeMarca)
 *  - indice: posición (número 01, 02… y color de la paleta si no trae)
 *  - estilo: 'editorial' (de color) | 'outline' (con borde)
 *  - mostrarNombre
 */
export function TarjetaMarca({ marca, indice = 0, estilo = 'editorial', mostrarNombre = true }) {
  const [color, suave] = PALETA_MARCAS[indice % PALETA_MARCAS.length];
  return (
    <Enlace
      to={marca.url}
      className={[s.marca, estilo === 'outline' && s.marcaBorde].filter(Boolean).join(' ')}
      style={{
        '--marca-color': marca.color || color,
        '--marca-suave': suave,
        backgroundImage: marca.fondo && estilo !== 'outline'
          ? `linear-gradient(120deg, rgba(15,23,42,.86), rgba(15,23,42,.34)), url("${toDirectImageUrl(marca.fondo)}")`
          : undefined,
      }}
      aria-label={`Explorar ${marca.nombre}`}
    >
      <span className={s.marcaNumero} aria-hidden="true">{String(indice + 1).padStart(2, '0')}</span>
      {/* El logo cuelga de una etiqueta (como la del logo de Walá): sirve
          igual para logos cuadrados, redondos o con fondo transparente. */}
      <span className={s.marcaColgante}>
        <span className={s.marcaHilo} aria-hidden="true" />
        <span className={s.marcaLogo}>
          {marca.logo
            ? <img src={toDirectImageUrl(marca.logo)} alt="" loading="lazy" decoding="async" />
            : <span className={s.marcaIniciales} aria-hidden="true">{iniciales(marca.nombre)}</span>}
        </span>
      </span>
      <span className={s.marcaTexto}>
        <EtiquetaColgante tono={estilo === 'outline' ? 'violeta' : 'blanco'} tamano="sm" className={s.marcaEtiqueta}>Universo Walá</EtiquetaColgante>
        {mostrarNombre && <strong>{marca.nombre}</strong>}
        <span className={s.marcaCta}>Explorar colección <ArrowRight aria-hidden="true" /></span>
      </span>
    </Enlace>
  );
}
