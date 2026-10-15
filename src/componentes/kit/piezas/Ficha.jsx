import React, { useState } from 'react';
import { Truck, RefreshCw, ShieldCheck, Pencil, Check } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Texto } from '../Traduccion';
import { BloqueSeccion } from '../Seccion';
import { soles } from '../TarjetaProducto';
import s from './Ficha.module.css';

/*
 * Las partes de una ficha de compra (una creación, un combo y, a futuro, el
 * producto de la tienda): la galería a la izquierda que se queda a la vista
 * al bajar, las migas, el precio con su descuento y la línea de confianza.
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
    <nav className={s.migas} aria-label="Estás en">
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
 * el descuento en un sello inclinado con el degradado.
 *  - precio, precioAntes · nota: una línea debajo ("Incluye la impresión…")
 */
export function PrecioFicha({ precio, precioAntes, nota }) {
  const descuento = precioAntes > precio ? Math.round((1 - precio / precioAntes) * 100) : 0;
  return (
    <div className={s.precioCaja}>
      <div className={s.precioFila}>
        <strong className={s.precio}>{soles(precio)}</strong>
        {descuento > 0 && <s className={s.antes}>{soles(precioAntes)}</s>}
        {descuento > 0 && <span className={s.descuento}>-{descuento}%</span>}
      </div>
      {nota && <p className={s.nota}>{nota}</p>}
    </div>
  );
}

/** Envío, cambios y pago seguro: la línea de confianza debajo de los botones. */
export function ConfianzaCompra() {
  return (
    <ul className={s.confianza}>
      <li><Truck aria-hidden="true" /> Envío a todo el país</li>
      <li><RefreshCw aria-hidden="true" /> Cambios y devoluciones</li>
      <li><ShieldCheck aria-hidden="true" /> Pago seguro</li>
    </ul>
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

