import React, { useEffect, useState } from 'react';
import { Pencil, Check } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Texto } from '../Traduccion';
import { BloqueSeccion } from '../Seccion';
import { useContador } from '../Efectos';
import { IconoWala } from '../IconosWala';
import { soles } from '../TarjetaProducto';
import { FotoProducto } from './FotoProducto';
import s from './Ficha.module.css';

/*
 * Las partes de una ficha de compra (una creación, un combo y el producto de
 * la tienda): la galería a la izquierda que se queda a la vista al bajar, las
 * migas, el precio con su descuento, la línea de confianza y la barra de
 * compra que aparece abajo al bajar.
 */

/**
 * El marco: galería (columna izquierda, fija al bajar en escritorio) e
 * información a la derecha; en el celular, una debajo de la otra.
 *  - galeria: nodo (GaleriaProducto) · children: la información
 */
export function MarcoFicha({ galeria, children, componente }) {
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '2.5rem' }}>
      <div className={s.ficha} data-componente={componente}>
        <div className={s.columnaGaleria}>{galeria}</div>
        <section className={s.info}>{children}</section>
      </div>
    </BloqueSeccion>
  );
}

/** Migas: [{ texto, url }] (la última sin url, en gris). */
export function Migas({ items = [] }) {
  return (
    <nav className={s.migas} aria-label="Estás en" data-componente="Migas">
      {items.map((m, k) => (
        <React.Fragment key={m.texto}>
          {k > 0 && <span aria-hidden="true">/</span>}
          {m.url ? <Enlace to={m.url}><Texto>{m.texto}</Texto></Enlace> : <span className={s.actual}><Texto>{m.texto}</Texto></span>}
        </React.Fragment>
      ))}
    </nav>
  );
}

/**
 * El precio grande con la letra de la marca y, si hay, el de antes tachado y
 * el descuento en un sello inclinado con el degradado. Si el precio cambia
 * (otra variante, un combo completo), corre hasta el nuevo.
 *  - precio, precioAntes · nota: una línea debajo ("Incluye la impresión…")
 */
export function PrecioFicha({ precio, precioAntes, nota }) {
  const descuento = precioAntes > precio ? Math.round((1 - precio / precioAntes) * 100) : 0;
  const mostrado = useContador(Number(precio) || 0, 0.5);
  return (
    <div className={s.precioCaja} data-componente="PrecioFicha">
      <div className={s.precioFila}>
        <strong className={s.precio}>{soles(Math.round(mostrado * 100) / 100)}</strong>
        {descuento > 0 && <s className={s.antes}>{soles(precioAntes)}</s>}
        {descuento > 0 && <span key={descuento} className={s.descuento}>-{descuento}%</span>}
      </div>
      {nota && <p className={s.nota}>{nota}</p>}
    </div>
  );
}

const CONFIANZA = [
  ['camion', 'Envío a todo el país'],
  ['cambio', 'Cambios y devoluciones'],
  ['escudo', 'Pago seguro'],
];

/** Envío, cambios y pago seguro: la línea de confianza, con los íconos de Walá. */
export function ConfianzaCompra() {
  return (
    <ul className={s.confianza} data-componente="ConfianzaCompra">
      {CONFIANZA.map(([icono, texto]) => (
        <li key={icono}><IconoWala nombre={icono} tamano={34} /> <span>{texto}</span></li>
      ))}
    </ul>
  );
}

/**
 * La barra de compra que sube desde abajo cuando los botones de la ficha ya
 * no se ven (al leer la descripción o las opiniones): la foto, el nombre, lo
 * elegido, el precio y el botón. Solo en escritorio: en el celular la compra
 * ya va pegada abajo. Va al final de la página (se pega al fondo de la vista
 * mientras se baja por ella).
 *  - mirar: ref del bloque de compra · hasta: ref de lo que viene después
 *    (los relacionados, el pie): cuando asoma, la barra se va para no
 *    taparlo · imagen, nombre, detalle ("Perla · M"), precio · children: el botón
 */
export function BarraCompra({ mirar, hasta, imagen, nombre, detalle, precio, children }) {
  const [ver, setVer] = useState(false);
  useEffect(() => {
    const el = mirar?.current;
    if (!el) return undefined;
    // Se mide contra lo que se desplaza (la ventana o un marco con scroll
    // propio). Aparece cuando los botones quedaron arriba y se va cuando lo de
    // abajo (`hasta`) llega cerca de la barra. Se mide en cada desplazamiento
    // (no con IntersectionObserver: un salto largo lo dejaba sin enterarse).
    let raiz = el.parentElement;
    while (raiz && raiz !== document.body && !/(auto|scroll)/.test(getComputedStyle(raiz).overflowY)) raiz = raiz.parentElement;
    const objetivo = raiz && raiz !== document.body ? raiz : window;
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const r = objetivo === window ? { top: 0, bottom: window.innerHeight } : objetivo.getBoundingClientRect();
      const arriba = el.getBoundingClientRect().bottom < r.top;
      const alFinal = hasta?.current ? hasta.current.getBoundingClientRect().top < r.bottom + 120 : false;
      setVer(arriba && !alFinal);
    };
    const pedir = () => { if (!cuadro) cuadro = requestAnimationFrame(medir); };
    medir();
    // La ventana también: un marco con scroll propio se mueve con ella.
    const fuentes = objetivo === window ? [window] : [objetivo, window];
    fuentes.forEach((f) => f.addEventListener('scroll', pedir, { passive: true }));
    window.addEventListener('resize', pedir);
    return () => {
      cancelAnimationFrame(cuadro);
      fuentes.forEach((f) => f.removeEventListener('scroll', pedir));
      window.removeEventListener('resize', pedir);
    };
  }, [mirar, hasta]);
  return (
    <div className={s.barraAncla} data-componente="BarraCompra">
      <div className={[s.barraCompra, ver && s.barraVisible].filter(Boolean).join(' ')} aria-hidden={!ver}>
        <FotoProducto className={s.barraFoto} src={imagen} relleno="6%" />
        <div className={s.barraTexto}>
          <strong>{nombre}</strong>
          {detalle && <span>{detalle}</span>}
        </div>
        <strong className={s.barraPrecio}>{soles(precio)}</strong>
        {children}
      </div>
    </div>
  );
}

/**
 * Un nombre que se cambia ahí mismo: el texto con un lápiz al lado; al
 * tocarlo, un campo con "Guardar" (Escape cancela). Sin onRenombrar, solo el
 * texto.
 *  - nombre · onRenombrar(nuevo): promesa · como: 'h1' (título) | 'strong'
 */
export function TituloEditable({ nombre, onRenombrar, como: Etiqueta = 'h1' }) {
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const chico = Etiqueta !== 'h1';
  const guardar = async (e) => {
    e.preventDefault();
    const nuevo = editando.trim();
    if (!nuevo || nuevo === nombre) { setEditando(null); return; }
    setGuardando(true);
    try { await onRenombrar?.(nuevo); setEditando(null); } finally { setGuardando(false); }
  };
  if (editando !== null) {
    return (
      <form className={[s.renombrar, chico && s.renombrarChico].filter(Boolean).join(' ')} onSubmit={guardar}>
        <input
          className={s.renombrarCampo}
          value={editando}
          onChange={(e) => setEditando(e.target.value)}
          maxLength={60}
          aria-label="Nombre"
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditando(null); }}
        />
        <Boton type="submit" tamano="sm" soloIcono aria-label="Guardar nombre" cargando={guardando} icono={<Check aria-hidden="true" />} />
      </form>
    );
  }
  return (
    <Etiqueta className={chico ? s.nombreChico : s.titulo}>
      {nombre}
      {onRenombrar && (
        <button type="button" className={s.lapiz} onClick={() => setEditando(nombre || '')} aria-label="Cambiar el nombre"><Pencil aria-hidden="true" /></button>
      )}
    </Etiqueta>
  );
}

