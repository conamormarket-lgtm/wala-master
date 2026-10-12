import React, { useRef, useState } from 'react';
import { Heart, Star, Plus, Check, Palette } from 'lucide-react';
import { Etiqueta } from './Etiquetas';
import { Estallido } from './Efectos';
import s from './TarjetaProducto.module.css';

export const soles = (n) => `S/ ${n.toFixed(2)}`;

const INCLINACION = 7; // grados máximos

/**
 * Tarjeta de producto de la tienda.
 * Con ratón: se inclina hacia el puntero, un reflejo y el borde lo siguen,
 * y se ve la espalda de la prenda. En táctil: sin inclinación, el botón
 * "Agregar" siempre visible y respuesta al toque.
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
  inclinar = true,
  onAgregar,
}) {
  const ref = useRef(null);
  const temporizador = useRef(0);
  const [deseado, setDeseado] = useState(false);
  const [latidos, setLatidos] = useState(0);
  const [agregado, setAgregado] = useState(false);
  const [sumas, setSumas] = useState(0);
  const descuento = precioAntes ? Math.round((1 - precio / precioAntes) * 100) : 0;

  const mover = (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = ref.current;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
    if (inclinar) {
      el.style.setProperty('--ry', `${(x - 0.5) * INCLINACION * 2}deg`);
      el.style.setProperty('--rx', `${(0.5 - y) * INCLINACION * 2}deg`);
    }
  };

  const salir = () => {
    ref.current.style.setProperty('--rx', '0deg');
    ref.current.style.setProperty('--ry', '0deg');
  };

  const alternarDeseo = () => {
    if (!deseado) setLatidos((n) => n + 1);
    setDeseado(!deseado);
  };

  const agregar = () => {
    setAgregado(true);
    setSumas((n) => n + 1);
    onAgregar?.();
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setAgregado(false), 1600);
  };

  return (
    <article
      ref={ref}
      className={[s.tarjeta, agotado && s.agotado, inclinar && s.inclinable].filter(Boolean).join(' ')}
      onPointerMove={mover}
      onPointerLeave={salir}
    >
      <span className={s.bordeLuz} aria-hidden="true" />
      <div className={s.media}>
        <a href="#producto" className={s.enlaceImagen} aria-label={nombre}>
          <img src={imagen} alt="" className={s.img} loading="lazy" />
          {imagenHover && <img src={imagenHover} alt="" className={`${s.img} ${s.imgHover}`} loading="lazy" />}
        </a>
        <span className={s.reflejo} aria-hidden="true" />
        <span className={s.barrido} aria-hidden="true" />

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
          onClick={alternarDeseo}
        >
          <Heart aria-hidden="true" />
          <Estallido disparo={latidos} cantidad={10} distancia={26} colores={['#f43f5e', '#fb7185', '#8b5cf6', '#f59e0b']} />
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
            <span className={s.agregarIcono}>
              {agregado ? <Check key="ok" aria-hidden="true" /> : <Plus key="mas" aria-hidden="true" />}
            </span>
            <span>{agregado ? 'Listo' : 'Agregar'}</span>
            {sumas > 0 && <span key={sumas} className={s.masUno} aria-hidden="true">+1</span>}
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
            {vendidos && <span className={s.vendidos}>{vendidos} vendidos</span>}
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
    <div className={`${s.tarjeta} ${s.esqueleto}`} aria-hidden="true">
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
