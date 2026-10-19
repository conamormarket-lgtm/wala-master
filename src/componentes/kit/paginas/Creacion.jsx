import React, { useState } from 'react';
import { Paintbrush, Check, Users, ArrowRight, Trash2, Download, LogIn, Sparkles, EyeOff, RefreshCw } from 'lucide-react';
import Boton from '../Boton';
import Acordeon from '../Acordeon';
import { Aviso, EstadoVacio } from '../Feedback';
import { SelectorTalla, Cantidad } from '../Formulario';
import { EtiquetaColgante, Sello } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { soles } from '../TarjetaProducto';
import { MarcoFicha, Migas, PrecioFicha, ConfianzaCompra, TituloEditable } from '../piezas/Ficha';
import { GaleriaProducto } from '../piezas/GaleriaProducto';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { Texto, useTexto, useHtml } from '../Traduccion';
import s from './Creacion.module.css';

/*
 * Una creación del cliente (/creacion/:id): su "producto propio" hecho en
 * Crear, con la forma de una ficha de producto. Solo la ve su dueño. Se
 * compra desde aquí (talla y cantidad) sin volver al estudio, o se abre en el
 * estudio para editarla. Va dentro de MarcoTienda. Los textos (y la
 * descripción de la prenda) pasan por la traducción.
 */

const CONFIRMAR = {
  eliminar: { titulo: '¿Eliminar esta creación?', texto: 'Se borra para siempre junto con sus imágenes.', boton: 'Eliminar', peligro: true },
  publicar: { titulo: '¿Publicar en la comunidad?', texto: 'Se verá en Diseños de la comunidad y cualquiera podrá usarla como punto de partida. Tu creación no cambia.', boton: 'Publicar' },
  retirar: { titulo: '¿Retirar de la comunidad?', texto: 'Deja de verse en la galería. Puedes volver a publicarla cuando quieras.', boton: 'Retirar' },
  actualizar: { titulo: '¿Actualizar la publicación?', texto: 'La galería muestra tu creación tal como está ahora (nombre, fotos y diseño).', boton: 'Actualizar' },
};

/**
 * La ficha de una creación.
 *  - creacion: { nombre, prenda, fecha ("14 de octubre de 2026"), imagenes:
 *    [{ url, nombre }], color: { nombre, fondo }, lados: ['Frente'], zonas:
 *    [{ nombre, ancho, alto }] (cm), imagenConjunta, publicada }
 *  - precio, precioAntes · disponible (la prenda sigue a la venta) · agotado
 *  - lista: false si se guardó con una versión vieja (no se compra desde aquí)
 *  - tallas · talla · onTalla(t) (queda guardada en la creación)
 *  - combo: { nombre, url, onIr } si es parte de un combo suyo (onIr: al
 *    tocar "Ir al combo", antes de ir), o combosSugeridos:
 *    [{ id, nombre, piezas, precio, onUsar() }] ("Llévala en combo")
 *  - onAgregar({ talla, cantidad }) · onComprar({ talla, cantidad }): promesas
 *  - urlEditar · estadoEditar (el state con que el estudio vuelve aquí) ·
 *    onRenombrar(nombre) · onEliminar() · eliminar: { notas } (lo que hay que
 *    saber antes: en el carrito, publicada…) · descripcionPrenda (html)
 *  - comunidad: { estado: 'publicada' | null, onPublicar, onActualizar, onRetirar } (admin)
 *  - estado: 'cargando' | 'sinSesion' | 'noEncontrada' · urlLogin · urlCreaciones
 */
export function PaginaCreacion({
  creacion = {}, precio, precioAntes, disponible = true, agotado = false, lista = true,
  tallas = [], talla, onTalla, combo, combosSugeridos = [],
  onAgregar, onComprar, urlEditar, estadoEditar, onRenombrar, onEliminar, eliminar, descripcionPrenda, comunidad,
  estado, urlLogin = '/login', urlCreaciones = '/cuenta/creaciones',
}) {
  const [cantidad, setCantidad] = useState(1);
  const [avisoTalla, setAvisoTalla] = useState(false);
  const [cargando, setCargando] = useState(null);
  const [pregunta, setPregunta] = useState(null);
  const descripcion = useHtml(descripcionPrenda);
  const t = {
    base: useTexto(`Hecha sobre ${creacion.prenda || ''}${creacion.fecha ? ` · guardada el ${creacion.fecha}` : ''}`),
    detalles: useTexto('Detalles de tu creación'),
    sobre: useTexto('Sobre la prenda'),
    nota: useTexto('Incluye la impresión de todos tus diseños.'),
  };

  if (estado === 'cargando') return <EsqueletoPagina forma="producto" />;
  if (estado === 'sinSesion' || estado === 'noEncontrada') {
    const sin = estado === 'sinSesion';
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={s.estado}>
          <EstadoVacio
            imagen={sin ? CARAS_KAPI.feliz : CARAS_KAPI.triste}
            titulo={<Texto>{sin ? 'Inicia sesión para ver tu creación' : 'No encontramos esta creación'}</Texto>}
            texto={<Texto>{sin ? 'Tus creaciones se guardan en tu cuenta.' : 'Puede que se haya borrado o que sea de otra cuenta.'}</Texto>}
          >
            {sin
              ? <Boton to={urlLogin} icono={<LogIn aria-hidden="true" />}><Texto>Iniciar sesión</Texto></Boton>
              : <Boton to={urlCreaciones} icono={<Sparkles aria-hidden="true" />}><Texto>Ir a Mis creaciones</Texto></Boton>}
          </EstadoVacio>
        </div>
      </BloqueSeccion>
    );
  }

  const nombre = creacion.nombre || 'Mi creación';
  const sePuedeComprar = disponible && lista && !agotado;
  const listo = () => {
    if (tallas.length && !talla) { setAvisoTalla(true); return false; }
    return true;
  };
  const accion = async (cual, fn) => {
    if (!listo()) return;
    setCargando(cual);
    try { await fn?.({ talla, cantidad }); } finally { setCargando(null); }
  };
  const confirmar = async () => {
    setCargando('confirmar');
    try { await pregunta.accion?.(); } finally { setCargando(null); setPregunta(null); }
  };
  const enComunidad = comunidad?.estado === 'publicada' || creacion.publicada;

  const detalles = [
    {
      id: 'detalles',
      question: t.detalles,
      answer: (
        <div className={s.detalles}>
          <dl>
            <dt><Texto>Prenda</Texto></dt><dd>{creacion.prenda || '—'}</dd>
            {creacion.color?.nombre && <><dt><Texto>Color</Texto></dt><dd><Texto>{creacion.color.nombre}</Texto></dd></>}
            {creacion.zonas?.length > 0 && (
              <><dt><Texto>Impresión</Texto></dt><dd><ul>{creacion.zonas.map((z) => <li key={z.nombre}>{z.nombre}{z.ancho > 0 && z.alto > 0 ? ` · ${Math.round(z.ancho)} × ${Math.round(z.alto)} cm` : ''}</li>)}</ul></dd></>
            )}
          </dl>
          <p className={s.nota}><Texto>Al editarla y guardarla se actualiza esta misma creación.</Texto></p>
          {creacion.imagenConjunta && (
            <a href={creacion.imagenConjunta} target="_blank" rel="noopener noreferrer" className={s.enlace}><Download aria-hidden="true" /> <Texto>Ver imagen completa</Texto></a>
          )}
        </div>
      ),
    },
    descripcion && { id: 'prenda', question: t.sobre, answer: <div className={s.textoRico} dangerouslySetInnerHTML={{ __html: descripcion }} /> },
  ].filter(Boolean);

  return (
    <MarcoFicha componente="PaginaCreacion" galeria={<GaleriaProducto imagenes={creacion.imagenes || []} nombre={nombre} />}>
          {/* Migas ya traduce; el nombre de la creación no va (es del cliente: no se traduce). */}
          <Migas items={[{ texto: 'Mi cuenta', url: '/cuenta' }, { texto: 'Mis creaciones', url: urlCreaciones }]} />

          <div className={s.cabeza}>
            <EtiquetaColgante tono="violeta" tamano="sm" icono={<Sparkles aria-hidden="true" />}><Texto>Mi creación</Texto></EtiquetaColgante>
            <TituloEditable nombre={nombre} onRenombrar={onRenombrar} />
            <p className={s.base}>{t.base}</p>
            {enComunidad && <span className={s.publicada}><Users aria-hidden="true" /> <Texto>En la comunidad</Texto></span>}
          </div>

          {disponible && precio > 0 && <PrecioFicha precio={precio} precioAntes={precioAntes} nota={t.nota} />}

          {combo ? (
            <div className={s.combo}>
              <Sello tamano={38} girar={-8}><Users aria-hidden="true" /></Sello>
              <span className={s.comboTexto}>
                <strong><Texto>{combo.nombre ? `Es parte de tu combo ${combo.nombre}` : 'Es parte de tu combo'}</Texto></strong>
                <span><Texto>Cómprala junto a las demás prendas del combo, a precio de combo.</Texto></span>
              </span>
              <Boton to={combo.url} onClick={combo.onIr} tamano="sm" variante="contorno" iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Ir al combo</Texto></Boton>
            </div>
          ) : disponible && combosSugeridos.map((c) => (
            <div key={c.id} className={s.combo}>
              <Sello tamano={38} girar={-8}><Users aria-hidden="true" /></Sello>
              <span className={s.comboTexto}>
                <strong><Texto>Llévala en combo:</Texto> <Texto>{c.nombre}</Texto></strong>
                <span><Texto>{`${c.piezas} prendas por ${soles(c.precio)}. Usamos una copia de este diseño y luego lo cambias si quieres.`}</Texto></span>
              </span>
              <Boton tamano="sm" variante="contorno" iconoFin={<ArrowRight aria-hidden="true" />} cargando={cargando === c.id} onClick={async () => { setCargando(c.id); try { await c.onUsar?.(); } finally { setCargando(null); } }}><Texto>Usar en el combo</Texto></Boton>
            </div>
          ))}

          {!disponible && <Aviso tipo="aviso" compacto><Texto>Esta prenda ya no está disponible. Puedes ver tu creación, pero no comprarla.</Texto></Aviso>}

          {creacion.color?.nombre && (
            <div className={s.grupo}>
              <span className={s.rotulo}><Texto>Color:</Texto> <strong><Texto>{creacion.color.nombre}</Texto></strong></span>
              <span className={s.filaColor}>
                <span className={s.muestra} style={{ background: creacion.color.fondo }} title={creacion.color.nombre} />
                <span className={s.ayuda}><Texto>El color va con tu diseño. Para cambiarlo, edita el diseño.</Texto></span>
              </span>
            </div>
          )}

          {creacion.lados?.length > 0 && (
            <div className={s.grupo}>
              <span className={s.rotulo}><Texto>Lados con diseño</Texto></span>
              <span className={s.lados}>{creacion.lados.map((l) => <span key={l}><Check aria-hidden="true" /> <Texto>{l}</Texto></span>)}</span>
            </div>
          )}

          {disponible && tallas.length > 0 && (
            <div className={[s.grupo, avisoTalla && s.falta].filter(Boolean).join(' ')}>
              <SelectorTalla tallas={tallas} valor={talla} onChange={(t) => { setAvisoTalla(false); onTalla?.(t); }} />
              {avisoTalla && <p className={s.avisoTalla} role="alert"><Texto>Elige una talla para continuar.</Texto></p>}
            </div>
          )}

          {disponible && !lista && (
            <Aviso tipo="info" compacto><Texto>Esta creación se guardó con una versión anterior. Ábrela en el editor y vuelve a guardarla para poder comprarla desde aquí.</Texto></Aviso>
          )}

          {sePuedeComprar && (
            <div className={s.grupo}>
              <span className={s.rotulo}><Texto>Cantidad</Texto></span>
              <Cantidad valor={cantidad} onChange={setCantidad} />
            </div>
          )}

          <div className={s.botones}>
            {disponible && (
              <Boton bloque tamano="lg" disabled={!sePuedeComprar} cargando={cargando === 'agregar'} onClick={() => accion('agregar', onAgregar)}>
                <Texto>{agotado ? 'Agotado por ahora' : 'Agregar al carrito'}</Texto>
              </Boton>
            )}
            {urlEditar && <Boton to={urlEditar} state={estadoEditar} variante="contorno" tamano="lg" icono={<Paintbrush aria-hidden="true" />}><Texto>Editar diseño</Texto></Boton>}
          </div>
          {sePuedeComprar && (
            <Boton bloque tamano="lg" variante="secundario" cargando={cargando === 'comprar'} onClick={() => accion('comprar', onComprar)} iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Comprar ahora</Texto></Boton>
          )}

          <ConfianzaCompra />

          <Acordeon items={detalles} abiertoInicial="detalles" multiple variante="lista" />

          {pregunta ? (
            <Aviso
              tipo={pregunta.peligro ? 'error' : 'info'}
              titulo={<Texto>{pregunta.titulo}</Texto>}
              accion={(
                <span className={s.botonesAviso}>
                  <Boton tamano="sm" variante="fantasma" onClick={() => setPregunta(null)} disabled={cargando === 'confirmar'}><Texto>Cancelar</Texto></Boton>
                  <Boton tamano="sm" variante={pregunta.peligro ? 'peligro' : 'primario'} cargando={cargando === 'confirmar'} onClick={confirmar}><Texto>{pregunta.boton}</Texto></Boton>
                </span>
              )}
            >
              <Texto>{pregunta.texto}</Texto>
              {pregunta.notas?.length > 0 && <ul className={s.notas}>{pregunta.notas.map((n) => <li key={n}><Texto>{n}</Texto></li>)}</ul>}
            </Aviso>
          ) : (
            <div className={s.pie}>
              {comunidad && enComunidad && comunidad.onActualizar && (
                <Boton variante="fantasma" tamano="sm" icono={<RefreshCw aria-hidden="true" />} onClick={() => setPregunta({ ...CONFIRMAR.actualizar, accion: comunidad.onActualizar })}><Texto>Actualizar publicación</Texto></Boton>
              )}
              {comunidad && (enComunidad
                ? <Boton variante="fantasma" tamano="sm" icono={<EyeOff aria-hidden="true" />} onClick={() => setPregunta({ ...CONFIRMAR.retirar, accion: comunidad.onRetirar })}><Texto>Retirar de la comunidad</Texto></Boton>
                : <Boton variante="fantasma" tamano="sm" icono={<Users aria-hidden="true" />} onClick={() => setPregunta({ ...CONFIRMAR.publicar, accion: comunidad.onPublicar })}><Texto>Publicar en la comunidad</Texto></Boton>)}
              {onEliminar && (
                <button type="button" className={s.eliminar} onClick={() => setPregunta({ ...CONFIRMAR.eliminar, notas: eliminar?.notas, accion: onEliminar })}>
                  <Trash2 aria-hidden="true" /> <Texto>Eliminar creación</Texto>
                </button>
              )}
            </div>
          )}
    </MarcoFicha>
  );
}
