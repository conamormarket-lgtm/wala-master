import React, { useState } from 'react';
import { Heart, Star, Plus, Check, Palette } from 'lucide-react';
import { Etiqueta } from './Etiquetas';
import s from './TarjetaProducto.module.css';

export const soles = (n) => `S/ ${n.toFixed(2)}`;

/**
 * Tarjeta de producto de la tienda.
 * Respecto a la actual: deseos y "agregar" a un toque sin entrar al producto,
 * precio anterior y % calculados juntos, puntuación, colores disponibles y
 * badges con una sola jerarquía (máximo dos arriba a la izquierda).
 */
export default function TarjetaProducto({
  imagen,
  imagenHover,
  nombre,
  categoria,
  precio,
  precioAntes,
  puntuacion,
  resenas,
  colores = [],
  nuevo = false,
  personalizable = false,
  agotado = false,
  vendidos,
  onAgregar,
}) {
  const [deseado, setDeseado] = useState(false);
  const [agregado, setAgregado] = useState(false);
  const descuento = precioAntes ? Math.round((1 - precio / precioAntes) * 100) : 0;

  const agregar = () => {
    setAgregado(true);
    onAgregar?.();
    window.setTimeout(() => setAgregado(false), 1600);
  };

  return (
    <article className={[s.tarjeta, agotado && s.agotado].filter(Boolean).join(' ')}>
      <div className={s.media}>
        <a href="#producto" className={s.enlaceImagen} aria-label={nombre}>
          <img src={imagen} alt="" className={s.img} loading="lazy" />
          {imagenHover && <img src={imagenHover} alt="" className={`${s.img} ${s.imgHover}`} loading="lazy" />}
        </a>

        <div className={s.badges}>
          {descuento > 0 && <Etiqueta tono="peligro" solida>-{descuento}%</Etiqueta>}
          {nuevo && <Etiqueta tono="violeta" solida>Nuevo</Etiqueta>}
          {personalizable && !nuevo && descuento === 0 && (
            <Etiqueta tono="violeta" icono={<Palette aria-hidden="true" />}>Tu diseño</Etiqueta>
          )}
        </div>

        <button
          type="button"
          className={[s.deseo, deseado && s.deseoActivo].filter(Boolean).join(' ')}
          aria-pressed={deseado}
          aria-label={deseado ? 'Quitar de deseos' : 'Agregar a deseos'}
          onClick={() => setDeseado((v) => !v)}
        >
          <Heart aria-hidden="true" />
        </button>

        {agotado ? (
          <span className={s.capaAgotado}>Agotado</span>
        ) : (
          <button
            type="button"
            className={[s.agregar, agregado && s.agregarOk].filter(Boolean).join(' ')}
            onClick={agregar}
            aria-label={agregado ? 'Agregado al carrito' : `Agregar ${nombre} al carrito`}
          >
            {agregado ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
            <span>{agregado ? 'Agregado' : 'Agregar'}</span>
          </button>
        )}
      </div>

      <div className={s.cuerpo}>
        {categoria && <p className={s.categoria}>{categoria}</p>}
        <h3 className={s.nombre}><a href="#producto">{nombre}</a></h3>

        {puntuacion != null && (
          <p className={s.puntuacion}>
            <Star aria-hidden="true" />
            <strong>{puntuacion.toFixed(1)}</strong>
            {resenas != null && <span>({resenas})</span>}
            {vendidos && <span className={s.vendidos}>· {vendidos} vendidos</span>}
          </p>
        )}

        <div className={s.pie}>
          <p className={s.precios}>
            <span className={[s.precio, descuento > 0 && s.precioOferta].filter(Boolean).join(' ')}>{soles(precio)}</span>
            {precioAntes && <s className={s.precioAntes}>{soles(precioAntes)}</s>}
          </p>
          {colores.length > 0 && (
            <ul className={s.colores} aria-label={`${colores.length} colores`}>
              {colores.slice(0, 4).map((c) => (
                <li key={c} style={{ background: c }} />
              ))}
              {colores.length > 4 && <li className={s.masColores}>+{colores.length - 4}</li>}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

/** Esqueleto con la misma silueta que la tarjeta, para la carga. */
export function TarjetaProductoEsqueleto() {
  return (
    <div className={s.tarjeta} aria-hidden="true">
      <div className={`${s.media} ${s.brillo}`} />
      <div className={s.cuerpo}>
        <span className={`${s.linea} ${s.brillo}`} style={{ width: '40%' }} />
        <span className={`${s.linea} ${s.brillo}`} style={{ width: '85%', height: 14 }} />
        <span className={`${s.linea} ${s.brillo}`} style={{ width: '55%', height: 14 }} />
        <span className={`${s.linea} ${s.brillo}`} style={{ width: '35%', height: 18, marginTop: 6 }} />
      </div>
    </div>
  );
}
