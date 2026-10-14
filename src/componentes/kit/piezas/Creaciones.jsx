import React, { useState } from 'react';
import { Clock, Paintbrush, ShoppingBag, Trash2, Pencil, Check, RotateCw, ImageOff } from 'lucide-react';
import Boton from '../Boton';
import { Etiqueta } from '../Etiquetas';
import { EtiquetaColgante } from '../Marca';
import { soles } from '../TarjetaProducto';
import { FotoProducto } from './FotoProducto';
import s from './Creaciones.module.css';

/**
 * Una creación guardada (Mis creaciones; MiCreacionCard en la tienda).
 * La foto muestra el frente y, al pasar el ratón (o con "Ver espalda" en el
 * celular), la espalda. Sobre la foto van como mucho dos etiquetas.
 *  - nombre · imagen, imagenEspalda · producto, color: { nombre, hex }
 *  - fecha: "Guardada hace 3 días" (ya legible) · precio, precioAntes
 *  - comprado, disponible (false: el producto ya no está), publicada, combo
 *    (nombre del combo), lados ("Frente + Espalda")
 *  - urlEditar, urlComprar
 *  - onRenombrar(nombre): promesa; con ella el nombre se edita en la tarjeta
 *  - onEliminar(): promesa; antes pide confirmar en la misma tarjeta
 *  - borrador: sin precio ni compra; un solo botón "Continuar" (urlEditar)
 */
export function TarjetaCreacion({
  nombre, imagen, imagenEspalda, producto, color, fecha, precio, precioAntes,
  comprado = false, disponible = true, publicada = false, combo, lados,
  urlEditar, urlComprar, onRenombrar, onEliminar, borrador = false,
}) {
  const [espalda, setEspalda] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Etiquetas de la foto por importancia; solo las dos primeras.
  const etiquetas = [
    !disponible && <Etiqueta key="no" tono="peligro" sobreFoto>No disponible</Etiqueta>,
    comprado && <Etiqueta key="comprado" tono="exito" sobreFoto icono={<Check aria-hidden="true" />}>Comprado</Etiqueta>,
    combo && <EtiquetaColgante key="combo" tono="magenta" tamano="sm">Combo · {combo}</EtiquetaColgante>,
    publicada && <Etiqueta key="pub" tono="violeta" sobreFoto>En la comunidad</Etiqueta>,
  ].filter(Boolean).slice(0, 2);

  const eliminar = async () => {
    setEliminando(true);
    try { await onEliminar?.(); } finally { setEliminando(false); setConfirmar(false); }
  };
  const renombrar = async (e) => {
    e.preventDefault();
    const nuevo = editando.trim();
    if (!nuevo || nuevo === nombre) { setEditando(null); return; }
    setGuardando(true);
    try { await onRenombrar?.(nuevo); setEditando(null); } finally { setGuardando(false); }
  };

  return (
    <article className={[s.creacion, !disponible && s.noDisponible, borrador && s.borrador].filter(Boolean).join(' ')} data-componente="TarjetaCreacion">
      <div className={s.caja}>
      <div className={s.fotoMarco}>
        <FotoProducto
          className={[s.foto, imagenEspalda && s.conEspalda, espalda && s.verEspalda].filter(Boolean).join(' ')}
          src={imagen}
          alt=""
          respaldo={<span className={s.sinFoto}><ImageOff aria-hidden="true" /></span>}
        >
          {imagenEspalda && <img className={s.espalda} src={imagenEspalda} alt="" loading="lazy" draggable={false} />}
        </FotoProducto>
        {etiquetas.length > 0 && <div className={s.etiquetas}>{etiquetas}</div>}
        {onEliminar && (
          <button type="button" className={s.eliminar} onClick={() => setConfirmar(true)} aria-label={`Eliminar ${nombre || 'esta creación'}`}>
            <Trash2 aria-hidden="true" />
          </button>
        )}
        {imagenEspalda && (
          <button type="button" className={s.girar} onClick={() => setEspalda((v) => !v)} aria-pressed={espalda}>
            <RotateCw aria-hidden="true" /> {espalda ? 'Ver frente' : 'Ver espalda'}
          </button>
        )}
        {lados && !imagenEspalda && <span className={s.lados}>{lados}</span>}
        {confirmar && (
          <div className={s.confirmar} role="alertdialog" aria-label="Eliminar creación">
            <p><strong>¿Eliminar «{nombre || 'esta creación'}»?</strong></p>
            <p>{comprado ? 'Se borra de tus creaciones. Como ya está en un pedido, guardamos sus imágenes para imprimirlo.' : 'Se borra para siempre junto con sus imágenes.'}</p>
            <div className={s.confirmarBotones}>
              <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmar(false)} disabled={eliminando}>Cancelar</Boton>
              <Boton variante="peligro" tamano="sm" cargando={eliminando} onClick={eliminar}>Eliminar</Boton>
            </div>
          </div>
        )}
      </div>

      <div className={s.cuerpo}>
        {editando !== null ? (
          <form className={s.renombrar} onSubmit={renombrar}>
            <input
              className={s.renombrarCampo}
              value={editando}
              onChange={(e) => setEditando(e.target.value)}
              maxLength={60}
              aria-label="Nombre de la creación"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Escape') setEditando(null); }}
            />
            <Boton type="submit" tamano="sm" soloIcono aria-label="Guardar nombre" cargando={guardando} icono={<Check aria-hidden="true" />} />
          </form>
        ) : (
          <h3 className={s.nombre}>
            <span>{nombre || 'Sin nombre'}</span>
            {onRenombrar && (
              <button type="button" className={s.lapiz} onClick={() => setEditando(nombre || '')} aria-label="Cambiar el nombre">
                <Pencil aria-hidden="true" />
              </button>
            )}
          </h3>
        )}
        <p className={s.producto}>
          {disponible ? (
            <>
              {color?.hex && <span className={s.punto} style={{ background: color.hex }} aria-hidden="true" />}
              {[producto, color?.nombre].filter(Boolean).join(' · ')}
            </>
          ) : 'Este producto ya no está disponible'}
        </p>
        {fecha && <p className={s.fecha}><Clock aria-hidden="true" /> {fecha}</p>}
        <div className={s.pie}>
          {!borrador && precio != null && disponible && (
            <span className={s.precios}>
              <strong>{soles(precio)}</strong>
              {precioAntes > precio && <s>{soles(precioAntes)}</s>}
            </span>
          )}
          <span className={s.acciones}>
            {borrador ? (
              urlEditar && <Boton to={urlEditar} tamano="sm" icono={<Paintbrush aria-hidden="true" />}>Continuar</Boton>
            ) : (
              <>
                {urlEditar && <Boton to={urlEditar} variante="contorno" tamano="sm" soloIcono aria-label="Editar diseño" icono={<Paintbrush aria-hidden="true" />} />}
                {urlComprar && disponible && <Boton to={urlComprar} tamano="sm" icono={<ShoppingBag aria-hidden="true" />}>Comprar</Boton>}
              </>
            )}
          </span>
        </div>
      </div>
      </div>
    </article>
  );
}
