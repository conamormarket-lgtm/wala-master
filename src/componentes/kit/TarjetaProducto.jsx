import React, { useRef, useState } from 'react';
import { Heart, Star, Plus, Check, Palette, SlidersHorizontal } from 'lucide-react';
import { Etiqueta } from './Etiquetas';
import { Estallido } from './Efectos';
import { Enlace } from './Enlace';
import { FotoProducto } from './piezas/FotoProducto';
import { LogoMarca } from './piezas/LogoMarca';
import { iniciales } from './piezas/Avatar';
import { EsqueletoProducto } from './Esqueletos';
import s from './TarjetaProducto.module.css';

// Formato peruano: separador de miles y 2 decimales (S/ 1,250.00).
const formatoSoles = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const soles = (n) => `S/ ${formatoSoles.format(n)}`;

const INCLINACION = 4; // grados máximos, suave
const STOCK_BAJO = 10; // desde aquí se avisa "¡Quedan N!"

/**
 * Qué hace el botón de la tarjeta según el producto (ver accionDeProducto):
 *  - agregar: no tiene opciones → se agrega directo (taza, llavero…).
 *  - elegir:  tiene color/estilo, talla, medida o es combo → abre el selector.
 *  - crear:   prenda base del estudio "Crear" → va a diseñarla.
 */
const ACCIONES = {
  agregar: { texto: 'Agregar', Icono: Plus, aria: 'Agregar al carrito:' },
  elegir: { texto: 'Elegir', Icono: SlidersHorizontal, aria: 'Elegir opciones de' },
  crear: { texto: 'Diseñar', Icono: Palette, aria: 'Diseñar' },
};

/**
 * Tarjeta de producto de la tienda.
 *
 * Fotos: casi todos los productos vienen con fondo blanco. La foto va sobre
 * un "escenario" gris muy claro y se mezcla con `multiply`, así el blanco de
 * la foto desaparece y todas las tarjetas se ven iguales (con o sin fondo).
 *
 * Alturas: cada fila del cuerpo reserva su alto (categoría 1 línea, nombre 2,
 * puntuación 1, precio anterior 1) aunque falte el dato. En una cuadrícula
 * todas las tarjetas quedan parejas.
 *
 * Con ratón: inclinación leve y la espalda de la prenda. En táctil: sin
 * inclinación, "Agregar" siempre visible y respuesta al toque.
 *
 *  - marca: { nombre, logo } → sello con el logo (solo en listados de varias
 *    marcas; dentro de la página de una marca no se pasa).
 *  - stock: unidades; "¡Quedan N!" aparece solo si son pocas (≤ STOCK_BAJO).
 *  - piezas: [{ nombre, imagen }] de un combo → etiqueta "Combo" y, con
 *    ratón, qué trae. Si el combo no trae `imagen`, sus piezas van como cartas.
 *
 *  - deseado, onDeseo(nuevo): el corazón controlado (WishlistContext); sin
 *    `deseado`, la tarjeta lo recuerda sola.
 *
 * Etiquetas de la foto, por importancia: descuento, Combo, Nuevo, Tu diseño.
 * En una tarjeta angosta (2 columnas del celular) van en tamaño chico (para no
 * llegar al corazón) y solo las dos primeras; si "Nuevo" queda fuera, pasa a la
 * línea de la categoría ("COMBOS · NUEVO").
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
  marca,
  stock,
  piezas = [],
  inclinar = true,
  url = '#producto',
  accion = 'agregar',
  onAgregar,
  deseado: deseadoProp,
  onDeseo,
}) {
  const ref = useRef(null);
  const temporizador = useRef(0);
  // Favorito: controlado si llega `deseado` (la lista de deseos real); si
  // no, la tarjeta lo recuerda sola (demo).
  const [deseadoLocal, setDeseadoLocal] = useState(false);
  const deseado = deseadoProp !== undefined ? Boolean(deseadoProp) : deseadoLocal;
  const [latidos, setLatidos] = useState(0);
  const [agregado, setAgregado] = useState(false);
  const [sumas, setSumas] = useState(0);
  const descuento = precioAntes ? Math.round((1 - precio / precioAntes) * 100) : 0;
  const quedan = Number(stock) > 0 && Number(stock) <= STOCK_BAJO ? Number(stock) : 0;
  const esCombo = piezas.length > 0;
  const tuDiseno = personalizable && !nuevo && !esCombo && descuento === 0;
  // Con descuento y combo, "Nuevo" es la tercera etiqueta: en la tarjeta
  // angosta no entra en la foto y pasa a la línea de la categoría.
  const nuevoEnLinea = nuevo && descuento > 0 && esCombo;
  // Combo sin foto propia: sus piezas juntas (la tienda compone una imagen
  // con ellas; aquí van como cartas, cada una sobre su escenario).
  const collage = imagen ? [] : piezas.filter((pz) => pz.imagen).slice(0, 3);

  const mover = (e) => {
    if (e.pointerType !== 'mouse' || !inclinar) return;
    const el = ref.current;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
    el.style.setProperty('--ry', `${(x - 0.5) * INCLINACION * 2}deg`);
    el.style.setProperty('--rx', `${(0.5 - y) * INCLINACION * 2}deg`);
  };

  const salir = () => {
    ref.current.style.setProperty('--rx', '0deg');
    ref.current.style.setProperty('--ry', '0deg');
  };

  const alternarDeseo = () => {
    if (!deseado) setLatidos((n) => n + 1);
    if (deseadoProp === undefined) setDeseadoLocal(!deseado);
    onDeseo?.(!deseado);
  };

  // Solo "agregar" (producto sin opciones) se marca como agregado en la
  // tarjeta. "elegir" abre el selector y "crear" va al estudio: eso lo
  // confirma quien recibe onAgregar. También si onAgregar devuelve false.
  const agregar = () => {
    if (onAgregar?.() === false || accion !== 'agregar') return;
    setAgregado(true);
    setSumas((n) => n + 1);
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
        <Enlace to={url} className={s.enlaceImagen} aria-label={nombre}>
          {imagen && <img src={imagen} alt="" className={s.img} loading="lazy" decoding="async" />}
          {imagen && imagenHover && <img src={imagenHover} alt="" className={`${s.img} ${s.imgHover}`} loading="lazy" decoding="async" />}
          {collage.length > 0 && (
            <span className={[s.collage, collage.length === 3 && s.collageTres].filter(Boolean).join(' ')} style={{ '--piezas': collage.length }}>
              {collage.map((pz, i) => <FotoProducto key={pz.nombre || i} className={s.collagePieza} src={pz.imagen} relleno="6%" />)}
            </span>
          )}
        </Enlace>
        <span className={s.barrido} aria-hidden="true" />

        {/* En orden de importancia: en una tarjeta angosta solo caben las dos
            primeras (CSS), así que "Nuevo" es la que sobra antes. */}
        <div className={s.badges}>
          {descuento > 0 && <Etiqueta tono="peligro" solida>-{descuento}%</Etiqueta>}
          {esCombo && <Etiqueta tono="violeta" solida>Combo · {piezas.length}</Etiqueta>}
          {nuevo && <Etiqueta tono="violeta" solida>Nuevo</Etiqueta>}
          {tuDiseno && (
            <Etiqueta tono="violeta" solida icono={<Palette aria-label="Personalizable" />}><span className={s.badgeTexto}>Tu diseño</span></Etiqueta>
          )}
        </div>

        {esCombo && (
          // Con 1 o 2 piezas, una fila por pieza. Con 3 o más, fotos en fila
          // (hasta 4 y "+N") y los nombres en un renglón: el panel no crece
          // y no tapa la foto aunque el combo traiga muchas piezas.
          <div className={[s.incluye, piezas.length >= 3 && s.incluyeCompacto].filter(Boolean).join(' ')} aria-hidden="true">
            <span className={s.incluyeTitulo}>{piezas.length >= 3 ? `Incluye ${piezas.length} piezas` : 'Incluye'}</span>
            {piezas.length >= 3 ? (
              <>
                <ul className={s.incluyeFotos}>
                  {piezas.slice(0, 4).map((pz, i) => (
                    <li key={pz.nombre || i}>
                      <FotoProducto className={s.incluyeFoto} src={pz.imagen} respaldo={iniciales(pz.nombre, 1) || '?'} />
                    </li>
                  ))}
                  {piezas.length > 4 && <li><span className={`${s.incluyeFoto} ${s.incluyeMas}`}>+{piezas.length - 4}</span></li>}
                </ul>
                <span className={s.incluyeNombres}>{piezas.map((pz) => pz.nombre).filter(Boolean).join(' · ')}</span>
              </>
            ) : (
              <ul>
                {piezas.map((pz, i) => (
                  <li key={pz.nombre || i}>
                    <FotoProducto className={s.incluyeFoto} src={pz.imagen} respaldo={iniciales(pz.nombre, 1) || '?'} />
                    <span className={s.incluyeNombre}>{pz.nombre}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {marca?.logo && (
          <LogoMarca variante="sello" className={s.sello} nombre={marca.nombre} imagen={marca.logo} />
        )}

        <button
          type="button"
          className={[s.deseo, deseado && s.deseoActivo].filter(Boolean).join(' ')}
          aria-pressed={deseado}
          aria-label={deseado ? 'Quitar de deseos' : 'Agregar a deseos'}
          onClick={alternarDeseo}
        >
          <Heart aria-hidden="true" />
          <Estallido disparo={latidos} cantidad={8} distancia={22} colores={['#f43f5e', '#fb7185', '#8b5cf6']} />
        </button>

        {agotado ? (
          <span className={s.capaAgotado}>Agotado</span>
        ) : (
          <button
            type="button"
            className={[s.agregar, agregado && s.agregarOk].filter(Boolean).join(' ')}
            onClick={agregar}
            aria-label={agregado ? 'Agregado al carrito' : `${ACCIONES[accion].aria} ${nombre}`}
          >
            <span className={s.agregarIcono}>
              {agregado ? <Check key="ok" aria-hidden="true" /> : React.createElement(ACCIONES[accion].Icono, { key: accion, 'aria-hidden': true })}
            </span>
            <span className={s.agregarTexto}>{agregado ? 'Agregado' : ACCIONES[accion].texto}</span>
            {sumas > 0 && <span key={sumas} className={s.masUno} aria-hidden="true">+1</span>}
          </button>
        )}
      </div>

      <div className={s.cuerpo}>
        <p className={s.categoria}>
          {categoria || ' '}
          {nuevoEnLinea && <span className={s.nuevoEnLinea}>{categoria ? ' · ' : ''}Nuevo</span>}
        </p>
        <h3 className={s.nombre}><Enlace to={url}>{nombre}</Enlace></h3>

        <p className={s.puntuacion}>
          {puntuacion != null ? (
            <>
              <Star aria-hidden="true" />
              <strong>{puntuacion.toFixed(1)}</strong>
              {resenas != null && <span>({resenas})</span>}
              {vendidos && <span className={s.vendidos}>· {vendidos} vendidos</span>}
            </>
          ) : quedan ? (
            <span className={s.quedan}>{quedan === 1 ? '¡Queda 1!' : `¡Quedan ${quedan}!`}</span>
          ) : nuevo ? (
            <span className={s.sinResenas}>Nuevo en Walá</span>
          ) : ' '}
        </p>

        <div className={s.pie}>
          <div className={s.precios}>
            <s className={s.precioAntes} aria-hidden={!precioAntes}>{precioAntes ? soles(precioAntes) : ' '}</s>
            <span className={[s.precio, descuento > 0 && s.precioOferta].filter(Boolean).join(' ')}>{soles(precio)}</span>
          </div>
          {colores.length > 0 && (
            <ul className={s.colores} aria-label={`${colores.length} colores`}>
              {colores.slice(0, 3).map((c) => (
                <li key={c} style={{ background: c }} />
              ))}
              {colores.length > 3 && <li className={s.masColores}>+{colores.length - 3}</li>}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

/** Esqueleto con la misma silueta que la tarjeta (el de Esqueletos.jsx, mismo brillo que todo el kit). */
export function TarjetaProductoEsqueleto() {
  return <EsqueletoProducto />;
}
