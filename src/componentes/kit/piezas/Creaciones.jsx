import React, { useRef, useState } from 'react';
import { Clock, Paintbrush, ShoppingBag, Trash2, Pencil, Check, RotateCw, ImageOff, Users, RefreshCw, EyeOff, ArrowRight } from 'lucide-react';
import Boton from '../Boton';
import { Etiqueta } from '../Etiquetas';
import { soles } from '../TarjetaProducto';
import { FotoProducto } from './FotoProducto';
import s from './Creaciones.module.css';

/* Lo que se pregunta antes de cada acción de la comunidad (AccionesComunidad). */
const COMUNIDAD = {
  publicar: {
    titulo: '¿Publicar en la comunidad?',
    texto: 'Se verá en Diseños de la comunidad, también sin iniciar sesión, y cualquiera podrá usarlo como punto de partida. Tu creación no cambia.',
    boton: 'Publicar',
  },
  actualizar: {
    titulo: '¿Actualizar la publicación?',
    texto: 'La comunidad verá la versión de ahora. Lo que otros ya hicieron con ella no cambia.',
    boton: 'Actualizar',
  },
  retirar: {
    titulo: '¿Retirar de la comunidad?',
    texto: 'Deja de verse en la galería. Lo que otros ya hicieron con ella sigue funcionando, y puedes volver a publicarla cuando quieras.',
    boton: 'Retirar',
  },
};

/**
 * Una creación guardada (Mis creaciones; MiCreacionCard y TarjetaMiCombo en
 * la tienda). La foto muestra el frente y, al pasar el ratón (o con "Ver
 * espalda" en el celular), la espalda; un combo muestra sus prendas lado a
 * lado. Sobre la foto van como mucho dos etiquetas. Toda confirmación
 * (eliminar, publicar…) es una capa sobre la foto, sin ventanas del navegador.
 *  - nombre · imagen, imagenEspalda · imagenes: [url] (prendas de un combo)
 *  - producto, color: { nombre, hex } · subtitulo: en vez de "producto · color"
 *  - fecha: "Guardada hace 3 días" (ya legible) · precio, precioAntes
 *  - comprado, disponible (false: ya no está), publicada, combo (texto corto
 *    de la etiqueta, como en la tarjeta de producto: "2", "Pareja"), lados
 *    ("Frente + Espalda")
 *  - aviso: texto en lugar del precio ("Este combo ya no se vende…")
 *  - urlEditar, urlComprar · borrador: un solo botón "Continuar" (urlEditar)
 *  - onRenombrar(nombre), onEliminar(): promesas
 *  - comunidad: { estado: 'publicada' | 'retirada' | null, onPublicar,
 *    onActualizar, onRetirar } (promesas; solo para quien puede publicar)
 *  - usar: { url, autor, usos } un diseño de la comunidad (TarjetaComunidad):
 *    sin precio; "Por Walá", cuántos lo usaron y "Usar diseño"
 *  - vertical: nunca se acuesta (carruseles de Crear, como una tarjeta de producto)
 */
export function TarjetaCreacion({
  nombre, imagen, imagenEspalda, imagenes, producto, color, subtitulo, fecha, precio, precioAntes,
  comprado = false, disponible = true, publicada = false, combo, lados, aviso,
  urlEditar, urlComprar, onRenombrar, onEliminar, borrador = false, comunidad, usar, vertical = false,
}) {
  const [espalda, setEspalda] = useState(false);
  const [pregunta, setPregunta] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const prendas = imagenes?.filter(Boolean) || [];
  // Como la tarjeta de producto: con ratón se inclina siguiendo al puntero
  // (4° como mucho) y el canto se ilumina donde está.
  const ref = useRef(null);
  const mover = (e) => {
    if (e.pointerType !== 'mouse' || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    ref.current.style.setProperty('--mx', `${x * 100}%`);
    ref.current.style.setProperty('--my', `${y * 100}%`);
    ref.current.style.setProperty('--ry', `${(x - 0.5) * 8}deg`);
    ref.current.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
  };
  const salir = () => {
    ref.current?.style.setProperty('--rx', '0deg');
    ref.current?.style.setProperty('--ry', '0deg');
  };
  const enComunidad = publicada || comunidad?.estado === 'publicada';

  // Etiquetas de la foto por importancia; solo las dos primeras.
  const etiquetas = [
    !disponible && <Etiqueta key="no" tono="peligro" sobreFoto>No disponible</Etiqueta>,
    borrador && prendas.length > 1 && <Etiqueta key="borrador" tono="aviso" sobreFoto>Borrador</Etiqueta>,
    comprado && <Etiqueta key="comprado" tono="exito" sobreFoto icono={<Check aria-hidden="true" />}>Comprado</Etiqueta>,
    combo && <Etiqueta key="combo" tono="violeta" solida>Combo · {combo}</Etiqueta>,
    enComunidad && <Etiqueta key="pub" tono="violeta" sobreFoto icono={<Users aria-hidden="true" />}>En la comunidad</Etiqueta>,
  ].filter(Boolean).slice(0, 2);

  const preguntar = (clave, accion) => setPregunta({ ...COMUNIDAD[clave], accion });
  const preguntarEliminar = () => setPregunta({
    titulo: `¿Eliminar «${nombre || 'esta creación'}»?`,
    texto: comprado
      ? 'Se borra de tus creaciones. Como ya está en un pedido, guardamos sus imágenes para imprimirlo.'
      : (prendas.length > 1 ? 'Se quita el combo. Sus prendas siguen en tus creaciones.' : 'Se borra para siempre junto con sus imágenes.'),
    boton: 'Eliminar',
    peligro: true,
    accion: onEliminar,
  });
  const confirmar = async () => {
    setTrabajando(true);
    try { await pregunta.accion?.(); } finally { setTrabajando(false); setPregunta(null); }
  };
  const renombrar = async (e) => {
    e.preventDefault();
    const nuevo = editando.trim();
    if (!nuevo || nuevo === nombre) { setEditando(null); return; }
    setGuardando(true);
    try { await onRenombrar?.(nuevo); setEditando(null); } finally { setGuardando(false); }
  };

  return (
    <article
      ref={ref}
      className={[s.creacion, !disponible && s.noDisponible, borrador && s.borrador, vertical && s.vertical].filter(Boolean).join(' ')}
      data-componente="TarjetaCreacion"
      onPointerMove={mover}
      onPointerLeave={salir}
    >
      <span className={s.bordeLuz} aria-hidden="true" />
      <div className={s.caja}>
        <div className={s.fotoMarco}>
          {prendas.length > 1 ? (
            <div className={`${s.foto} ${s.fotoCombo}`}>
              <div className={s.prendas} style={{ '--n': prendas.length }}>
                {prendas.map((src, i) => <FotoProducto key={src + i} className={s.prenda} src={src} relleno="6%" style={{ '--i': i }} />)}
              </div>
            </div>
          ) : (
            <FotoProducto
              className={[s.foto, imagenEspalda && s.conEspalda, espalda && s.verEspalda].filter(Boolean).join(' ')}
              src={imagen}
              alt=""
              respaldo={<span className={s.sinFoto}><ImageOff aria-hidden="true" /></span>}
            >
              {imagenEspalda && <img className={s.espalda} src={imagenEspalda} alt="" loading="lazy" draggable={false} />}
            </FotoProducto>
          )}
          <span className={s.barrido} aria-hidden="true" />
          {etiquetas.length > 0 && <div className={s.etiquetas}>{etiquetas}</div>}
          {onEliminar && (
            <button type="button" className={s.eliminar} onClick={preguntarEliminar} aria-label={`Eliminar ${nombre || 'esta creación'}`}>
              <Trash2 aria-hidden="true" />
            </button>
          )}
          {imagenEspalda && prendas.length < 2 && (
            <button type="button" className={s.girar} onClick={() => setEspalda((v) => !v)} aria-pressed={espalda}>
              <RotateCw aria-hidden="true" /> {espalda ? 'Ver frente' : 'Ver espalda'}
            </button>
          )}
          {lados && !imagenEspalda && prendas.length < 2 && <span className={s.lados}>{lados}</span>}
          {pregunta && (
            <div className={s.confirmar} role="alertdialog" aria-label={pregunta.titulo}>
              <p><strong>{pregunta.titulo}</strong></p>
              <p>{pregunta.texto}</p>
              <div className={s.confirmarBotones}>
                <Boton variante="fantasma" tamano="sm" onClick={() => setPregunta(null)} disabled={trabajando}>Cancelar</Boton>
                <Boton variante={pregunta.peligro ? 'peligro' : 'primario'} tamano="sm" cargando={trabajando} onClick={confirmar}>{pregunta.boton}</Boton>
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
                onFocus={(e) => e.currentTarget.select()}
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
            {subtitulo || (disponible ? (
              <>
                {color?.hex && <span className={s.punto} style={{ background: color.hex }} aria-hidden="true" />}
                {[producto, color?.nombre].filter(Boolean).join(' · ')}
              </>
            ) : 'Este producto ya no está disponible')}
          </p>
          {fecha && <p className={s.fecha}><Clock aria-hidden="true" /> {fecha}</p>}
          {usar?.usos > 0 && (
            <p className={s.fecha}><Users aria-hidden="true" /> {usar.usos === 1 ? '1 persona lo usó' : `${usar.usos} personas lo usaron`}</p>
          )}
          {usar ? (
            <div className={s.pie}>
              <span className={s.autor}>Por {usar.autor || 'Walá'}</span>
              <span className={s.acciones}>
                <Boton to={usar.url} tamano="sm" icono={<Paintbrush aria-hidden="true" />}>Usar diseño</Boton>
              </span>
            </div>
          ) : (
          <div className={s.pie}>
            {aviso ? <p className={s.aviso}>{aviso}</p> : !borrador && precio != null && disponible && (
              <span className={s.precios}>
                <strong>{soles(precio)}</strong>
                {precioAntes > precio && <s>{soles(precioAntes)}</s>}
              </span>
            )}
            <span className={s.acciones}>
              {borrador ? (
                urlEditar && disponible && <Boton to={urlEditar} tamano="sm" iconoFin={<ArrowRight aria-hidden="true" />}>Continuar</Boton>
              ) : (
                <>
                  {urlEditar && <Boton to={urlEditar} variante="contorno" tamano="sm" soloIcono aria-label="Editar diseño" icono={<Paintbrush aria-hidden="true" />} />}
                  {urlComprar && disponible && <Boton to={urlComprar} tamano="sm" icono={<ShoppingBag aria-hidden="true" />}>Comprar</Boton>}
                </>
              )}
            </span>
            {comunidad && !borrador && (
              enComunidad ? (
                <span className={s.comunidad}>
                  <Boton variante="fantasma" tamano="sm" icono={<RefreshCw aria-hidden="true" />} onClick={() => preguntar('actualizar', comunidad.onActualizar)}>Actualizar</Boton>
                  <Boton variante="fantasma" tamano="sm" icono={<EyeOff aria-hidden="true" />} onClick={() => preguntar('retirar', comunidad.onRetirar)}>Retirar</Boton>
                </span>
              ) : (
                <button type="button" className={s.publicar} onClick={() => preguntar('publicar', comunidad.onPublicar)}>
                  <Users aria-hidden="true" /> {comunidad.estado === 'retirada' ? 'Volver a publicar' : 'Publicar en la comunidad'}
                </button>
              )
            )}
          </div>
          )}
        </div>
      </div>
    </article>
  );
}
