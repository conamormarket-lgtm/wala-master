import React, { useState } from 'react';
import { MapPin, Pencil, Trash2, Star } from 'lucide-react';
import { Sello } from '../Marca';
import { Texto, useTexto } from '../Traduccion';
import s from './TarjetaDireccion.module.css';

/**
 * Una dirección guardada (Mis direcciones; a futuro, también el checkout).
 * La principal lleva el sello del logo y su borde violeta; las demás, el pin
 * en lila. Eliminar pide confirmación en la misma tarjeta (sin
 * window.confirm).
 *  - nombre: quien recibe · direccion: la dirección exacta · lugar: distrito,
 *    provincia… (lugarLegible) · documento: "DNI 77208515" · telefono
 *  - principal
 *  - onPrincipal, onEditar, onEliminar: sin ellas no sale el botón
 *  - ocupada: mientras se guarda algo, los botones esperan
 */
export function TarjetaDireccion({ nombre, direccion, lugar, documento, telefono, principal = false, onPrincipal, onEditar, onEliminar, ocupada = false }) {
  const [confirmar, setConfirmar] = useState(false);
  const t = { editar: useTexto('Editar la dirección de'), eliminar: useTexto('Eliminar la dirección de') };
  return (
    <article className={[s.tarjeta, principal && s.principal].filter(Boolean).join(' ')} data-componente="TarjetaDireccion">
      <div className={s.cabeza}>
        <Sello tamano={36} tono={principal ? 'degradado' : 'suave'} girar={principal ? -8 : 0}><MapPin /></Sello>
        <div className={s.quien}>
          <h3 className={s.nombre}>{nombre || <Texto>Sin nombre</Texto>}</h3>
          {principal && <p className={s.esPrincipal}><Texto>Dirección principal</Texto></p>}
        </div>
      </div>
      <div className={s.lineas}>
        <p className={s.direccion}>{direccion}</p>
        {lugar && <p>{lugar}</p>}
        {(documento || telefono) && <p>{[documento, telefono].filter(Boolean).join(' · ')}</p>}
      </div>

      {confirmar ? (
        <div className={s.confirmar} role="alert">
          <p><Texto>¿Eliminar esta dirección?</Texto> {nombre && <strong>{nombre}</strong>}</p>
          <div className={s.confirmarBotones}>
            <button type="button" className={s.textoBoton} onClick={() => setConfirmar(false)}><Texto>Cancelar</Texto></button>
            <button type="button" className={`${s.textoBoton} ${s.peligro}`} disabled={ocupada} onClick={() => { setConfirmar(false); onEliminar(); }}>
              <Trash2 aria-hidden="true" /> <Texto>Sí, eliminar</Texto>
            </button>
          </div>
        </div>
      ) : (onPrincipal || onEditar || onEliminar) && (
        <div className={s.acciones}>
          {!principal && onPrincipal && (
            <button type="button" className={s.textoBoton} disabled={ocupada} onClick={onPrincipal}>
              <Star aria-hidden="true" /> <Texto>Usar como principal</Texto>
            </button>
          )}
          <span className={s.iconos}>
            {onEditar && (
              <button type="button" className={s.icono} disabled={ocupada} onClick={onEditar} aria-label={`${t.editar} ${nombre}`}>
                <Pencil aria-hidden="true" />
              </button>
            )}
            {onEliminar && (
              <button type="button" className={`${s.icono} ${s.iconoPeligro}`} disabled={ocupada} onClick={() => setConfirmar(true)} aria-label={`${t.eliminar} ${nombre}`}>
                <Trash2 aria-hidden="true" />
              </button>
            )}
          </span>
        </div>
      )}
    </article>
  );
}
