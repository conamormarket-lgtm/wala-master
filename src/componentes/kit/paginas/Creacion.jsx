import React, { useState } from 'react';
import { Paintbrush, Truck, RefreshCw, ShieldCheck, Check, Users, ArrowRight, Trash2, Pencil, Download, LogIn, Sparkles, EyeOff } from 'lucide-react';
import Boton from '../Boton';
import Acordeon from '../Acordeon';
import { Enlace } from '../Enlace';
import { Aviso, EstadoVacio } from '../Feedback';
import { SelectorTalla, Cantidad } from '../Formulario';
import { EtiquetaColgante, Sello } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { soles } from '../TarjetaProducto';
import { GaleriaProducto } from '../piezas/GaleriaProducto';
import { CARAS_KAPI } from '../piezas/Flotantes';
import s from './Creacion.module.css';

/*
 * Una creación del cliente (/creacion/:id): su "producto propio" hecho en
 * Crear, con la forma de una ficha de producto. Solo la ve su dueño. Se
 * compra desde aquí (talla y cantidad) sin volver al estudio, o se abre en el
 * estudio para editarla. Va dentro de MarcoTienda.
 */

const CONFIRMAR = {
  eliminar: { titulo: '¿Eliminar esta creación?', texto: 'Se borra para siempre junto con sus imágenes.', boton: 'Eliminar', peligro: true },
  publicar: { titulo: '¿Publicar en la comunidad?', texto: 'Se verá en Diseños de la comunidad y cualquiera podrá usarla como punto de partida. Tu creación no cambia.', boton: 'Publicar' },
  retirar: { titulo: '¿Retirar de la comunidad?', texto: 'Deja de verse en la galería. Puedes volver a publicarla cuando quieras.', boton: 'Retirar' },
};

/**
 * La ficha de una creación.
 *  - creacion: { nombre, prenda, fecha ("14 de octubre de 2026"), imagenes:
 *    [{ url, nombre }], color: { nombre, fondo }, lados: ['Frente'], zonas:
 *    [{ nombre, ancho, alto }] (cm), imagenConjunta, publicada }
 *  - precio, precioAntes · disponible (la prenda sigue a la venta) · agotado
 *  - lista: false si se guardó con una versión vieja (no se compra desde aquí)
 *  - tallas · talla · onTalla(t) (queda guardada en la creación)
 *  - combo: { nombre, url } si es parte de un combo suyo, o combosSugeridos:
 *    [{ id, nombre, piezas, precio, onUsar() }] ("Llévala en combo")
 *  - onAgregar({ talla, cantidad }) · onComprar({ talla, cantidad }): promesas
 *  - urlEditar · onRenombrar(nombre) · onEliminar() · descripcionPrenda (html)
 *  - comunidad: { estado: 'publicada' | null, onPublicar, onRetirar } (admin)
 *  - estado: 'cargando' | 'sinSesion' | 'noEncontrada' · urlLogin · urlCreaciones
 */
export function PaginaCreacion({
  creacion = {}, precio, precioAntes, disponible = true, agotado = false, lista = true,
  tallas = [], talla, onTalla, combo, combosSugeridos = [],
  onAgregar, onComprar, urlEditar, onRenombrar, onEliminar, descripcionPrenda, comunidad,
  estado, urlLogin = '/login', urlCreaciones = '/cuenta/creaciones',
}) {
  const [cantidad, setCantidad] = useState(1);
  const [avisoTalla, setAvisoTalla] = useState(false);
  const [cargando, setCargando] = useState(null);
  const [editando, setEditando] = useState(null);
  const [pregunta, setPregunta] = useState(null);

  if (estado === 'cargando') return <EsqueletoPagina forma="producto" />;
  if (estado === 'sinSesion' || estado === 'noEncontrada') {
    const sin = estado === 'sinSesion';
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={s.estado}>
          <EstadoVacio
            imagen={sin ? CARAS_KAPI.feliz : CARAS_KAPI.triste}
            titulo={sin ? 'Inicia sesión para ver tu creación' : 'No encontramos esta creación'}
            texto={sin ? 'Tus creaciones se guardan en tu cuenta.' : 'Puede que se haya borrado o que sea de otra cuenta.'}
          >
            {sin
              ? <Boton to={urlLogin} icono={<LogIn aria-hidden="true" />}>Iniciar sesión</Boton>
              : <Boton to={urlCreaciones} icono={<Sparkles aria-hidden="true" />}>Ir a Mis creaciones</Boton>}
          </EstadoVacio>
        </div>
      </BloqueSeccion>
    );
  }

  const nombre = creacion.nombre || 'Mi creación';
  const sePuedeComprar = disponible && lista && !agotado;
  const descuento = precioAntes > precio ? Math.round((1 - precio / precioAntes) * 100) : 0;
  const listo = () => {
    if (tallas.length && !talla) { setAvisoTalla(true); return false; }
    return true;
  };
  const accion = async (cual, fn) => {
    if (!listo()) return;
    setCargando(cual);
    try { await fn?.({ talla, cantidad }); } finally { setCargando(null); }
  };
  const renombrar = async (e) => {
    e.preventDefault();
    const nuevo = editando.trim();
    if (nuevo && nuevo !== nombre) await onRenombrar?.(nuevo);
    setEditando(null);
  };
  const confirmar = async () => {
    setCargando('confirmar');
    try { await pregunta.accion?.(); } finally { setCargando(null); setPregunta(null); }
  };
  const enComunidad = comunidad?.estado === 'publicada' || creacion.publicada;

  const detalles = [
    {
      id: 'detalles',
      question: 'Detalles de tu creación',
      answer: (
        <div className={s.detalles}>
          <dl>
            <dt>Prenda</dt><dd>{creacion.prenda || '—'}</dd>
            {creacion.color?.nombre && <><dt>Color</dt><dd>{creacion.color.nombre}</dd></>}
            {creacion.zonas?.length > 0 && (
              <><dt>Impresión</dt><dd><ul>{creacion.zonas.map((z) => <li key={z.nombre}>{z.nombre}{z.ancho > 0 && z.alto > 0 ? ` · ${Math.round(z.ancho)} × ${Math.round(z.alto)} cm` : ''}</li>)}</ul></dd></>
            )}
          </dl>
          <p className={s.nota}>Al editarla y guardarla se actualiza esta misma creación.</p>
          {creacion.imagenConjunta && (
            <a href={creacion.imagenConjunta} target="_blank" rel="noopener noreferrer" className={s.enlace}><Download aria-hidden="true" /> Ver imagen completa</a>
          )}
        </div>
      ),
    },
    descripcionPrenda && { id: 'prenda', question: 'Sobre la prenda', answer: <div className={s.textoRico} dangerouslySetInnerHTML={{ __html: descripcionPrenda }} /> },
  ].filter(Boolean);

  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '2.5rem' }}>
      <div className={s.ficha} data-componente="PaginaCreacion">
        <div className={s.columnaGaleria}>
          <GaleriaProducto imagenes={creacion.imagenes || []} nombre={nombre} />
        </div>

        <section className={s.info}>
          <nav className={s.migas} aria-label="Estás en">
            <Enlace to="/cuenta">Mi cuenta</Enlace>
            <span aria-hidden="true">/</span>
            <Enlace to={urlCreaciones}>Mis creaciones</Enlace>
          </nav>

          <div className={s.cabeza}>
            <EtiquetaColgante tono="violeta" tamano="sm" icono={<Sparkles aria-hidden="true" />}>Mi creación</EtiquetaColgante>
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
                <Boton type="submit" tamano="sm" soloIcono aria-label="Guardar nombre" icono={<Check aria-hidden="true" />} />
              </form>
            ) : (
              <h1 className={s.titulo}>
                {nombre}
                {onRenombrar && (
                  <button type="button" className={s.lapiz} onClick={() => setEditando(nombre)} aria-label="Cambiar el nombre"><Pencil aria-hidden="true" /></button>
                )}
              </h1>
            )}
            <p className={s.base}>Hecha sobre {creacion.prenda}{creacion.fecha ? ` · guardada el ${creacion.fecha}` : ''}</p>
            {enComunidad && <span className={s.publicada}><Users aria-hidden="true" /> En la comunidad</span>}
          </div>

          {disponible && precio > 0 && (
            <div className={s.precioFila}>
              <strong className={s.precio}>{soles(precio)}</strong>
              {descuento > 0 && <s className={s.antes}>{soles(precioAntes)}</s>}
              {descuento > 0 && <span className={s.descuento}>-{descuento}%</span>}
            </div>
          )}
          {disponible && <p className={s.incluye}>Incluye la impresión de todos tus diseños.</p>}

          {combo ? (
            <div className={s.combo}>
              <Sello tamano={38} girar={-8}><Users aria-hidden="true" /></Sello>
              <span className={s.comboTexto}>
                <strong>Es parte de tu combo{combo.nombre ? ` ${combo.nombre}` : ''}</strong>
                <span>Cómprala junto a las demás prendas del combo, a precio de combo.</span>
              </span>
              <Boton to={combo.url} tamano="sm" variante="contorno" iconoFin={<ArrowRight aria-hidden="true" />}>Ir al combo</Boton>
            </div>
          ) : disponible && combosSugeridos.map((c) => (
            <div key={c.id} className={s.combo}>
              <Sello tamano={38} girar={-8}><Users aria-hidden="true" /></Sello>
              <span className={s.comboTexto}>
                <strong>Llévala en combo: {c.nombre}</strong>
                <span>{c.piezas} prendas por {soles(c.precio)}. Usamos una copia de este diseño y luego lo cambias si quieres.</span>
              </span>
              <Boton tamano="sm" variante="contorno" iconoFin={<ArrowRight aria-hidden="true" />} cargando={cargando === c.id} onClick={async () => { setCargando(c.id); try { await c.onUsar?.(); } finally { setCargando(null); } }}>Usar en el combo</Boton>
            </div>
          ))}

          {!disponible && <Aviso tipo="aviso" compacto>Esta prenda ya no está disponible. Puedes ver tu creación, pero no comprarla.</Aviso>}

          {creacion.color?.nombre && (
            <div className={s.grupo}>
              <span className={s.rotulo}>Color: <strong>{creacion.color.nombre}</strong></span>
              <span className={s.filaColor}>
                <span className={s.muestra} style={{ background: creacion.color.fondo }} title={creacion.color.nombre} />
                <span className={s.ayuda}>El color va con tu diseño. Para cambiarlo, edita el diseño.</span>
              </span>
            </div>
          )}

          {creacion.lados?.length > 0 && (
            <div className={s.grupo}>
              <span className={s.rotulo}>Lados con diseño</span>
              <span className={s.lados}>{creacion.lados.map((l) => <span key={l}><Check aria-hidden="true" /> {l}</span>)}</span>
            </div>
          )}

          {disponible && tallas.length > 0 && (
            <div className={[s.grupo, avisoTalla && s.falta].filter(Boolean).join(' ')}>
              <SelectorTalla tallas={tallas} valor={talla} onChange={(t) => { setAvisoTalla(false); onTalla?.(t); }} />
              {avisoTalla && <p className={s.avisoTalla} role="alert">Elige una talla para continuar.</p>}
            </div>
          )}

          {disponible && !lista && (
            <Aviso tipo="info" compacto>Esta creación se guardó con una versión anterior. Ábrela en el editor y vuelve a guardarla para poder comprarla desde aquí.</Aviso>
          )}

          {sePuedeComprar && (
            <div className={s.grupo}>
              <span className={s.rotulo}>Cantidad</span>
              <Cantidad valor={cantidad} onChange={setCantidad} />
            </div>
          )}

          <div className={s.botones}>
            {disponible && (
              <Boton bloque tamano="lg" disabled={!sePuedeComprar} cargando={cargando === 'agregar'} onClick={() => accion('agregar', onAgregar)}>
                {agotado ? 'Agotado por ahora' : 'Agregar al carrito'}
              </Boton>
            )}
            {urlEditar && <Boton to={urlEditar} variante="contorno" tamano="lg" icono={<Paintbrush aria-hidden="true" />}>Editar diseño</Boton>}
          </div>
          {sePuedeComprar && (
            <Boton bloque tamano="lg" variante="secundario" cargando={cargando === 'comprar'} onClick={() => accion('comprar', onComprar)} iconoFin={<ArrowRight aria-hidden="true" />}>Comprar ahora</Boton>
          )}

          <ul className={s.confianza}>
            <li><Truck aria-hidden="true" /> Envío a todo el país</li>
            <li><RefreshCw aria-hidden="true" /> Cambios y devoluciones</li>
            <li><ShieldCheck aria-hidden="true" /> Pago seguro</li>
          </ul>

          <Acordeon items={detalles} abiertoInicial="detalles" multiple variante="lista" />

          {pregunta ? (
            <Aviso
              tipo={pregunta.peligro ? 'error' : 'info'}
              titulo={pregunta.titulo}
              accion={(
                <span className={s.botonesAviso}>
                  <Boton tamano="sm" variante="fantasma" onClick={() => setPregunta(null)} disabled={cargando === 'confirmar'}>Cancelar</Boton>
                  <Boton tamano="sm" variante={pregunta.peligro ? 'peligro' : 'primario'} cargando={cargando === 'confirmar'} onClick={confirmar}>{pregunta.boton}</Boton>
                </span>
              )}
            >
              {pregunta.texto}
            </Aviso>
          ) : (
            <div className={s.pie}>
              {comunidad && (enComunidad
                ? <Boton variante="fantasma" tamano="sm" icono={<EyeOff aria-hidden="true" />} onClick={() => setPregunta({ ...CONFIRMAR.retirar, accion: comunidad.onRetirar })}>Retirar de la comunidad</Boton>
                : <Boton variante="fantasma" tamano="sm" icono={<Users aria-hidden="true" />} onClick={() => setPregunta({ ...CONFIRMAR.publicar, accion: comunidad.onPublicar })}>Publicar en la comunidad</Boton>)}
              {onEliminar && (
                <button type="button" className={s.eliminar} onClick={() => setPregunta({ ...CONFIRMAR.eliminar, accion: onEliminar })}>
                  <Trash2 aria-hidden="true" /> Eliminar creación
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </BloqueSeccion>
  );
}
