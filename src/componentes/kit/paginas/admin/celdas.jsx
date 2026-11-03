import React from 'react';
import { ImageOff } from 'lucide-react';
import { Casilla } from '../../Formulario';
import { InsigniaEstado } from '../../piezas/admin/Datos';
import s from './Lista.module.css';

/*
 * Lo que se repite en las celdas y los formularios de las listas del admin:
 * la foto, las marcas de un registro y elegir marcas.
 */

/**
 * La foto de un registro (o el hueco sin foto).
 *  - forma: 'cuadro' | 'circulo' | 'ancha' (banners) · contener: sin recortar (logos) · tamano (44)
 */
export function FotoCelda({ src, forma = 'cuadro', contener = false, tamano = 44 }) {
  return (
    <span
      className={[s.foto, forma === 'circulo' && s.fotoCirculo, forma === 'ancha' && s.fotoAncha, contener && s.fotoContener].filter(Boolean).join(' ')}
      style={{ '--tam': `${tamano}px` }}
    >
      {src ? <img src={src} alt="" loading="lazy" /> : <ImageOff aria-hidden="true" />}
    </span>
  );
}

/**
 * Las marcas de un registro: sus logos y el nombre de la primera.
 *  - ids · marcas: [{ id, nombre, logo }] · sinMarcas: el texto sin ninguna
 *    ('Sin marca' en aviso; con `global`, 'Todas las marcas' neutro)
 */
export function MarcasCelda({ ids = [], marcas = [], global = false }) {
  const lista = ids.map((id) => marcas.find((m) => m.id === id)).filter(Boolean);
  if (!lista.length) {
    return global ? <span className={s.sub}>Todas las marcas</span> : <InsigniaEstado estado="pendiente">Sin marca</InsigniaEstado>;
  }
  return (
    <span className={s.marcas} title={lista.map((m) => m.nombre).join(', ')}>
      <span className={s.logos} aria-hidden="true">
        {lista.slice(0, 3).map((m) => (m.logo ? <img key={m.id} src={m.logo} alt="" loading="lazy" /> : <span key={m.id}>{m.nombre.slice(0, 1)}</span>))}
      </span>
      <span className={s.marcasTexto}>{lista[0].nombre}{lista.length > 1 ? ` +${lista.length - 1}` : ''}</span>
    </span>
  );
}

/** Un número con su nombre solo en la tarjeta ("Orden 3"): en la tabla lo dice la columna. */
export function NumeroCelda({ valor, nombre }) {
  return <span className={s.numero}><span className={s.soloTarjeta}>{nombre} </span>{valor}</span>;
}

/**
 * Elegir marcas: "Todas · Ninguna" y una casilla por marca.
 *  - marcas: [{ id, nombre }] · valor: [ids] · onCambiar(ids)
 */
export function ElegirMarcas({ marcas = [], valor = [], onCambiar }) {
  const alternar = (id, si) => onCambiar(si ? [...new Set([...valor, id])] : valor.filter((x) => x !== id));
  return (
    <>
      <div className={s.atajos}>
        <button type="button" onClick={() => onCambiar(marcas.map((m) => m.id))}>Todas</button>
        <button type="button" onClick={() => onCambiar([])}>Ninguna</button>
      </div>
      <div className={s.casillas}>
        {marcas.map((m) => (
          <Casilla key={m.id} etiqueta={m.nombre} activo={valor.includes(m.id)} onChange={(si) => alternar(m.id, si)} />
        ))}
      </div>
    </>
  );
}

/** Para ordenar por nombre en español. */
export const porNombre = (a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
/** Por el campo `orden` y, empatados, por nombre. */
export const porOrden = (a, b) => ((Number(a.orden) || 0) - (Number(b.orden) || 0)) || porNombre(a, b);
