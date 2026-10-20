import React, { useRef, useState } from 'react';
import { Clock, Paintbrush, ShoppingBag, Trash2, Pencil, Check, RotateCw, ImageOff, Users, RefreshCw, EyeOff, ArrowRight, History } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Texto, useTexto } from '../Traduccion';
import { HojaInferior } from '../Feedback';
import { Etiqueta } from '../Etiquetas';
import { soles } from '../TarjetaProducto';
import { Sello } from '../Marca';
import { FotoProducto } from './FotoProducto';
import s from './Creaciones.module.css';

/* Lo que se pregunta antes de cada acción de la comunidad (AccionesComunidad). */
const COMUNIDAD = {
  publicar: {
    titulo: '¿Publicar en la comunidad?',
    texto: 'Se verá en Diseños de la comunidad, también sin iniciar sesión, y cualquiera podrá usarlo como punto de partida. Tu creación no cambia.',
    boton: 'Publicar',
    icono: Users,
  },
  actualizar: {
    titulo: '¿Actualizar la publicación?',
    texto: 'La comunidad verá la versión de ahora. Lo que otros ya hicieron con ella no cambia.',
    boton: 'Actualizar',
    icono: RefreshCw,
  },
  retirar: {
    titulo: '¿Retirar de la comunidad?',
    texto: 'Deja de verse en la galería. Lo que otros ya hicieron con ella sigue funcionando, y puedes volver a publicarla cuando quieras.',
    boton: 'Retirar',
    icono: EyeOff,
  },
};

/**
 * Una creación guardada (Mis creaciones; MiCreacionCard y TarjetaMiCombo en
 * la tienda). La foto muestra el frente y, al pasar el ratón (o con "Ver
 * espalda" en el celular), la espalda; un combo muestra sus prendas lado a
 * lado. Sobre la foto van como mucho dos etiquetas. Toda confirmación
 * (eliminar, publicar…) es una capa sobre la foto, sin ventanas del navegador.
 *  - nombre · imagen, imagenEspalda · imagenes: [url] (prendas de un combo)
 *  - foto: un nodo en lugar de la foto (los diseños del editor de antes, que
 *    se dibujan con sus capas en la tienda)
 *  - url: adónde lleva la foto (su página, el editor o el combo)
 *  - producto, color: { nombre, hex, fondo } (fondo: el CSS del punto, p. ej.
 *    un bicolor) · colores: [fondo] un punto por prenda (combos)
 *  - subtitulo: en vez de "producto · color" (el punto de color se queda)
 *  - fecha: "Guardada hace 3 días" (ya legible) · fechaCompleta: la fecha
 *    exacta, al pasar el ratón · precio, precioAntes (también en borradores)
 *  - comprado, disponible (false: ya no está), publicada, combo (texto corto
 *    de la etiqueta, como en la tarjeta de producto: "2", "Pareja"), lados
 *    ("Frente + Espalda")
 *  - aviso: texto en lugar del precio ("Este combo ya no se vende…")
 *  - urlEditar, urlComprar · borrador: un solo botón "Continuar" (urlEditar)
 *  - estadoEditar: el state del router al editar o continuar (p. ej.
 *    { desde: '/cuenta/creaciones' }: el estudio vuelve ahí con su flecha)
 *  - soloEditar: un solo botón "Editar" (los diseños del editor de antes)
 *  - onRenombrar(nombre), onEliminar(): promesas (si fallan, la página avisa)
 *  - eliminar: { titulo, texto, notas: [texto] } lo que dice la confirmación
 *    (sin él: lo de una creación, de un combo con sus prendas o de lo comprado)
 *  - comunidad: { estado: 'publicada' | 'retirada' | null, onPublicar,
 *    onActualizar, onRetirar } (promesas; solo para quien puede publicar)
 *  - usar: { url, autor, usos } un diseño de la comunidad (TarjetaComunidad):
 *    sin precio; "Por Walá", cuántos lo usaron y "Usar diseño"
 *  - vertical: nunca se acuesta (carruseles de Crear, como una tarjeta de producto)
 *  - combos: [{ id, nombre, piezas, precio, onLlevar }] los combos de su prenda:
 *    botón "Llevar en combo" que abre una hoja para elegir uno (se usa una copia)
 */
export function TarjetaCreacion({
  nombre, imagen, imagenEspalda, imagenes, foto, url, producto, color, colores, subtitulo, fecha, fechaCompleta, precio, precioAntes,
  comprado = false, disponible = true, publicada = false, combo, lados, aviso,
  urlEditar, urlComprar, estadoEditar, soloEditar = false, onRenombrar, onEliminar, eliminar, borrador = false, comunidad, usar, vertical = false, combos = [],
}) {
  const tNombreCampo = useTexto('Nombre de la creación');
  const tEditar = useTexto('Editar diseño');
  const tLlevar = useTexto('Llevar en combo (pareja, trío…)');
  const [espalda, setEspalda] = useState(false);
  const [pregunta, setPregunta] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [eligiendoCombo, setEligiendoCombo] = useState(false);
  const [llevando, setLlevando] = useState(null);
  const prendas = imagenes?.filter(Boolean) || [];
  // Un combo es combo aunque falte diseñar alguna prenda (un borrador "1 de
  // 2"): antes, con una sola foto, se veía y se eliminaba como una creación
  // suelta. Las prendas sin diseño van con su hueco.
  const esCombo = Boolean(combo) || prendas.length > 1;
  const fotosCombo = esCombo && (imagenes?.length || 0) > 1 ? imagenes : null;
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
    !disponible && <Etiqueta key="no" tono="peligro" sobreFoto><Texto>No disponible</Texto></Etiqueta>,
    borrador && esCombo && <Etiqueta key="borrador" tono="aviso" sobreFoto><Texto>Borrador</Texto></Etiqueta>,
    comprado && <Etiqueta key="comprado" tono="exito" sobreFoto icono={<Check aria-hidden="true" />}><Texto>Comprado</Texto></Etiqueta>,
    combo && <Etiqueta key="combo" tono="violeta" solida><Texto>{`Combo · ${combo}`}</Texto></Etiqueta>,
    enComunidad && <Etiqueta key="pub" tono="violeta" sobreFoto icono={<Users aria-hidden="true" />}><Texto>En la comunidad</Texto></Etiqueta>,
  ].filter(Boolean).slice(0, 2);

  const preguntar = (clave, accion) => setPregunta({ ...COMUNIDAD[clave], accion });
  // Un combo se lleva sus prendas (las que se usan en otro lado se quedan).
  const preguntarEliminar = () => setPregunta({
    titulo: eliminar?.titulo || (esCombo ? `¿Eliminar el combo «${nombre || 'Mi combo'}» y sus prendas?` : `¿Eliminar «${nombre || 'esta creación'}»?`),
    texto: eliminar?.texto || (esCombo
      ? 'Se borran también sus prendas. Si está en un pedido o en tu carrito, ahí conserva sus diseños.'
      : comprado
        ? 'Se borra de tus creaciones. Como ya está en un pedido, guardamos sus imágenes para imprimirlo.'
        : 'Se borra para siempre junto con sus imágenes.'),
    notas: eliminar?.notas || [],
    boton: 'Eliminar',
    icono: Trash2,
    peligro: true,
    accion: onEliminar,
  });
  const confirmar = async () => {
    setTrabajando(true);
    try { await pregunta.accion?.(); } finally { setTrabajando(false); setPregunta(null); }
  };
  const renombrar = async (e) => {
    e?.preventDefault?.();
    if (guardando) return;
    const nuevo = editando.trim();
    if (!nuevo || nuevo === nombre) { setEditando(null); return; }
    setGuardando(true);
    try { await onRenombrar?.(nuevo); setEditando(null); } finally { setGuardando(false); }
  };

  return (
    <article
      ref={ref}
      className={[s.creacion, !disponible && s.noDisponible, borrador && s.borrador, vertical && s.vertical, pregunta && s.preguntando].filter(Boolean).join(' ')}
      data-componente="TarjetaCreacion"
      onPointerMove={mover}
      onPointerLeave={salir}
    >
      <span className={s.bordeLuz} aria-hidden="true" />
      <div className={s.caja}>
        <div className={s.fotoMarco}>
          {fotosCombo ? (
            <div className={`${s.foto} ${s.fotoCombo}`}>
              <div className={s.prendas} style={{ '--n': fotosCombo.length }}>
                {fotosCombo.map((src, i) => (
                  <FotoProducto
                    key={`${i}-${src}`}
                    className={s.prenda}
                    src={src || undefined}
                    relleno="6%"
                    style={{ '--i': i }}
                    respaldo={<span className={s.porDisenar} title="Por diseñar"><Paintbrush aria-hidden="true" /></span>}
                  />
                ))}
              </div>
            </div>
          ) : (
            foto ? <div className={s.foto}>{foto}</div> : <FotoProducto
              className={[s.foto, imagenEspalda && s.conEspalda, espalda && s.verEspalda].filter(Boolean).join(' ')}
              src={imagen}
              alt=""
              respaldo={<span className={s.sinFoto}><ImageOff aria-hidden="true" /></span>}
            >
              {imagenEspalda && <img className={s.espalda} src={imagenEspalda} alt="" loading="lazy" draggable={false} />}
            </FotoProducto>
          )}
          <span className={s.barrido} aria-hidden="true" />
          {url && <Enlace to={url} state={borrador ? estadoEditar : undefined} className={s.fotoEnlace} aria-label={`Ver ${nombre || 'la creación'}`} />}
          {etiquetas.length > 0 && <div className={s.etiquetas}>{etiquetas}</div>}
          {onEliminar && (
            <button type="button" className={s.eliminar} onClick={preguntarEliminar} aria-label={`Eliminar ${nombre || 'esta creación'}`}>
              <Trash2 aria-hidden="true" />
            </button>
          )}
          {imagenEspalda && !fotosCombo && (
            <button type="button" className={s.girar} onClick={() => setEspalda((v) => !v)} aria-pressed={espalda}>
              <RotateCw aria-hidden="true" /> <Texto>{espalda ? 'Ver frente' : 'Ver espalda'}</Texto>
            </button>
          )}
          {lados && !imagenEspalda && !fotosCombo && <span className={s.lados}>{lados}</span>}
        </div>

        {/* La pregunta (eliminar, publicar…) ocupa el lugar del texto, en
            sólido; la foto queda arriba, atenuada, para ver qué se borra. */}
        <div className={s.zonaCuerpo}>
        <div className={s.cuerpo} aria-hidden={pregunta ? true : undefined}>
          {editando !== null ? (
            <form className={s.renombrar} onSubmit={renombrar}>
              <input
                className={s.renombrarCampo}
                value={editando}
                onChange={(e) => setEditando(e.target.value)}
                maxLength={60}
                aria-label={tNombreCampo}
                autoFocus
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditando(null); }}
                // Como antes: al salir del campo también se guarda (no si se toca el botón de guardar).
                onBlur={(e) => { if (!e.currentTarget.form?.contains(e.relatedTarget)) renombrar(); }}
              />
              <Boton type="submit" tamano="sm" soloIcono aria-label="Guardar nombre" cargando={guardando} icono={<Check aria-hidden="true" />} />
            </form>
          ) : (
            <h3 className={s.nombre}>
              <span>{nombre || <Texto>Sin nombre</Texto>}</span>
              {onRenombrar && (
                <button type="button" className={s.lapiz} onClick={() => setEditando(nombre || '')} aria-label="Cambiar el nombre">
                  <Pencil aria-hidden="true" />
                </button>
              )}
            </h3>
          )}
          <p className={s.producto}>
            {(colores?.length ? colores : [color?.fondo || color?.hex]).filter(Boolean).map((fondo, k) => (
              <span key={k} className={s.punto} style={{ background: fondo }} aria-hidden="true" />
            ))}
            {subtitulo ? <Texto>{subtitulo}</Texto> : (disponible || producto)
              ? [producto, color?.nombre].filter(Boolean).join(' · ')
              : <Texto>Este producto ya no está disponible</Texto>}
          </p>
          {fecha && <p className={s.fecha} title={fechaCompleta}><Clock aria-hidden="true" /> <Texto>{fecha}</Texto></p>}
          {usar?.usos > 0 && (
            <p className={s.fecha}><Users aria-hidden="true" /> <Texto>{usar.usos === 1 ? '1 persona lo usó' : `${usar.usos} personas lo usaron`}</Texto></p>
          )}
          {usar ? (
            <div className={s.pie}>
              <span className={s.autor}><Texto>Por</Texto> {usar.autor || 'Walá'}</span>
              <span className={s.acciones}>
                <Boton to={usar.url} tamano="sm" icono={<Paintbrush aria-hidden="true" />}><Texto>Usar diseño</Texto></Boton>
              </span>
            </div>
          ) : (
          <div className={s.pie}>
            {aviso ? <p className={s.aviso}><Texto>{aviso}</Texto></p> : precio != null && precio > 0 && disponible && (
              <span className={s.precios}>
                <strong>{soles(precio)}</strong>
                {precioAntes > precio && <s>{soles(precioAntes)}</s>}
              </span>
            )}
            <span className={s.acciones}>
              {combos.length > 0 && disponible && (
                <Boton variante="contorno" tamano="sm" soloIcono aria-label={tLlevar} title={tLlevar} icono={<Users aria-hidden="true" />} onClick={() => setEligiendoCombo(true)} />
              )}
              {/* Lo que ya no está en la tienda no se edita ni se compra. */}
              {borrador ? (
                urlEditar && disponible && <Boton to={urlEditar} state={estadoEditar} tamano="sm" iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Continuar</Texto></Boton>
              ) : soloEditar ? (
                urlEditar && disponible && <Boton to={urlEditar} state={estadoEditar} tamano="sm" icono={<Paintbrush aria-hidden="true" />}><Texto>Editar</Texto></Boton>
              ) : (
                <>
                  {urlEditar && disponible && <Boton to={urlEditar} state={estadoEditar} variante="contorno" tamano="sm" soloIcono aria-label={tEditar} title={tEditar} icono={<Paintbrush aria-hidden="true" />} />}
                  {urlComprar && disponible && <Boton to={urlComprar} tamano="sm" icono={<ShoppingBag aria-hidden="true" />}><Texto>Comprar</Texto></Boton>}
                </>
              )}
            </span>
            {comunidad && !borrador && (
              enComunidad ? (
                <span className={s.comunidad}>
                  <Boton variante="fantasma" tamano="sm" icono={<RefreshCw aria-hidden="true" />} onClick={() => preguntar('actualizar', comunidad.onActualizar)}><Texto>Actualizar</Texto></Boton>
                  <Boton variante="fantasma" tamano="sm" icono={<EyeOff aria-hidden="true" />} onClick={() => preguntar('retirar', comunidad.onRetirar)}><Texto>Retirar</Texto></Boton>
                </span>
              ) : (
                <button type="button" className={s.publicar} onClick={() => preguntar('publicar', comunidad.onPublicar)}>
                  <Users aria-hidden="true" /> <Texto>{comunidad.estado === 'retirada' ? 'Volver a publicar' : 'Publicar en la comunidad'}</Texto>
                </button>
              )
            )}
          </div>
          )}
        </div>
        {pregunta && (
          <div className={[s.confirmar, pregunta.peligro && s.confirmarPeligro].filter(Boolean).join(' ')} role="alertdialog" aria-label={pregunta.titulo}>
            <p className={s.confirmarTitulo}>
              {pregunta.icono && <Sello tamano={30} tono={pregunta.peligro ? 'peligro' : 'degradado'}><pregunta.icono /></Sello>}
              <strong><Texto>{pregunta.titulo}</Texto></strong>
            </p>
            <p><Texto>{pregunta.texto}</Texto></p>
            {(pregunta.notas || []).map((n) => <p key={n}><Texto>{n}</Texto></p>)}
            <div className={s.confirmarBotones}>
              <Boton variante="fantasma" tamano="sm" onClick={() => setPregunta(null)} disabled={trabajando}><Texto>Cancelar</Texto></Boton>
              <Boton variante={pregunta.peligro ? 'peligro' : 'primario'} tamano="sm" cargando={trabajando} onClick={confirmar}><Texto>{pregunta.boton}</Texto></Boton>
            </div>
          </div>
        )}
        </div>
      </div>
      {combos.length > 0 && (
        <HojaInferior abierta={eligiendoCombo} onCerrar={() => !llevando && setEligiendoCombo(false)} titulo="Llevar en combo">
          <p className={s.comboAyuda}><Texto>{`Usamos una copia de «${nombre || 'tu diseño'}»: tu creación sigue igual. En el combo le cambias el color o el diseño a cada prenda.`}</Texto></p>
          <ul className={s.comboLista}>
            {combos.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={s.comboOpcion}
                  disabled={Boolean(llevando)}
                  onClick={async () => { setLlevando(c.id); try { await c.onLlevar?.(); } finally { setLlevando(null); setEligiendoCombo(false); } }}
                >
                  <Users aria-hidden="true" />
                  <span><strong>{c.nombre}</strong><small>{c.piezas} <Texto>prendas</Texto> · {soles(c.precio)}</small></span>
                  {llevando === c.id ? <RotateCw className={s.girando} aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </HojaInferior>
      )}
    </article>
  );
}

/** Una versión anterior: recuperar o eliminar ya (con su confirmación en la fila). */
function FilaVersion({ id, nombre, imagen, combo, dias, enPedido, onRecuperar, onEliminar }) {
  const [confirmar, setConfirmar] = useState(false);
  const [trabajando, setTrabajando] = useState(null);
  const tEliminar = useTexto(`Eliminar ${nombre || 'este diseño'} ya`);
  const hacer = async (cual, accion) => {
    setTrabajando(cual);
    try { await accion?.(id); } finally { setTrabajando(null); setConfirmar(false); }
  };
  const detalle = enPedido
    ? 'Está en un pedido: no se borra sola'
    : dias > 0 ? `Se borra en ${dias} ${dias === 1 ? 'día' : 'días'}` : 'Se borra hoy';
  return (
    <li className={s.version}>
      <FotoProducto className={s.versionFoto} src={imagen} respaldo={<span className={s.sinFoto}><ImageOff aria-hidden="true" /></span>} />
      <span className={s.versionTextos}>
        <strong>{nombre || <Texto>Mi diseño</Texto>}</strong>
        <small>{combo ? `${combo} · ` : ''}<Texto>{detalle}</Texto></small>
      </span>
      {confirmar ? (
        <span className={s.versionAcciones} role="alert">
          <small><Texto>¿Eliminar ya? No se puede deshacer.</Texto></small>
          <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmar(false)} disabled={Boolean(trabajando)}><Texto>Cancelar</Texto></Boton>
          <Boton variante="peligro" tamano="sm" cargando={trabajando === 'eliminar'} onClick={() => hacer('eliminar', onEliminar)}><Texto>Eliminar</Texto></Boton>
        </span>
      ) : (
        <span className={s.versionAcciones}>
          {onRecuperar && <Boton variante="contorno" tamano="sm" cargando={trabajando === 'recuperar'} onClick={() => hacer('recuperar', onRecuperar)}><Texto>Recuperar</Texto></Boton>}
          {onEliminar && <Boton variante="fantasma" tamano="sm" soloIcono aria-label={tEliminar} title={tEliminar} icono={<Trash2 aria-hidden="true" />} onClick={() => setConfirmar(true)} disabled={Boolean(trabajando)} />}
        </span>
      )}
    </li>
  );
}

/**
 * Versiones anteriores de las prendas de los combos (las que un combo ya no
 * usa): no salen en las creaciones y se borran solas a los días. Se abre y
 * cierra (cerrada al llegar).
 *  - versiones: [{ id, nombre, imagen, combo (nombre), dias (que le quedan),
 *    enPedido (no se borra sola) }]
 *  - diasTotal: a los cuántos días se borran · onRecuperar(id), onEliminar(id): promesas
 */
export function VersionesAnteriores({ versiones = [], diasTotal = 7, onRecuperar, onEliminar }) {
  if (!versiones.length) return null;
  return (
    <details className={s.versiones} data-componente="VersionesAnteriores">
      <summary>
        <History aria-hidden="true" />
        <Texto>{`Versiones anteriores de tus combos (${versiones.length})`}</Texto>
      </summary>
      <p className={s.versionesAyuda}>
        <Texto>{`Son diseños que tus combos ya no usan (los cambiaste por otro). No salen en tus creaciones y se borran solos a los ${diasTotal} días. Recupera los que quieras guardar.`}</Texto>
      </p>
      <ul className={s.versionesLista}>
        {versiones.map((v) => <FilaVersion key={v.id} {...v} onRecuperar={onRecuperar} onEliminar={onEliminar} />)}
      </ul>
    </details>
  );
}
