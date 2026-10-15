import React, { useMemo, useState } from 'react';
import { ShoppingBag, Paintbrush, ArrowRight, Share2, RotateCcw, PencilLine, Store } from 'lucide-react';
import Boton from '../Boton';
import Acordeon from '../Acordeon';
import Carrusel from '../Carrusel';
import TarjetaProducto from '../TarjetaProducto';
import { Enlace } from '../Enlace';
import { useTexto, useHtml } from '../Traduccion';
import { EstadoVacio, HojaInferior } from '../Feedback';
import { BloqueSeccion, TituloSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { FotoProducto } from '../piezas/FotoProducto';
import { GaleriaProducto } from '../piezas/GaleriaProducto';
import { MarcoFicha, Migas, PrecioFicha, ConfianzaCompra } from '../piezas/Ficha';
import { OpcionesProducto, opcionesDe } from '../piezas/OpcionesProducto';
import { Estrellas, ResumenOpiniones, TarjetaOpinion, FormularioOpinion } from '../piezas/Opiniones';
import s from './Producto.module.css';

/*
 * La ficha de un producto de la tienda (/producto/:id): la galería, el
 * precio, las opciones (color, talla, el color de cada prenda de un combo),
 * agregar, comprar o personalizar; la descripción, las opiniones y "También te
 * puede gustar". Usa el mismo marco que una creación y un combo
 * (piezas/Ficha) y los mismos selectores que "Agregar rápido"
 * (OpcionesProducto). Va dentro de MarcoTienda.
 */

const STOCK_BAJO = 10;
const POR_PAGINA = 4;

/**
 * La ficha del producto.
 *  - producto, opciones, varianteInicial, fotos: los de
 *    adaptadores.fichaProductoDesde
 *  - opiniones: { lista, total, promedio, porEstrella } (opinionesDesde) ·
 *    onOpinar({ puntuacion, texto, fotos }): promesa · onUtil(id)
 *  - relacionados: [props de TarjetaProducto] · onAgregarRelacionado(i)
 *  - onAgregar(eleccion) · onComprar(eleccion): promesas; eleccion = {
 *    variante, opcion, piezas: { [i]: color }, cantidad }
 *  - onPersonalizar(eleccion) (si es personalizable) · onCompartir() (con sesión)
 *  - carrito: cuántos hay ya (para "Ir a pagar mi carrito") · urlPagar
 *  - sesion · urlLogin
 *  - estado: 'cargando' | 'error' | 'noDisponible' · onReintentar · urlTienda
 */
export function PaginaProducto({
  producto = {}, opciones = {}, varianteInicial, fotos = {}, opiniones = {}, onOpinar, onUtil,
  relacionados = [], onAgregarRelacionado, onAgregar, onComprar, onPersonalizar, onCompartir,
  carrito = 0, urlPagar = '/checkout', sesion = false, urlLogin = '/login',
  estado, onReintentar, urlTienda = '/tienda',
}) {
  const { variantes = [], opciones: tallasBase = [], etiquetaOpcion = 'Talla', piezas = [] } = opciones;
  const [varId, setVarId] = useState(varianteInicial ?? variantes[0]?.id);
  const [opcion, setOpcion] = useState(null);
  const [colores, setColores] = useState(() => Object.fromEntries(piezas.map((p, i) => [i, p.colores.some((c) => c.nombre === p.color) ? p.color : p.colores[0]?.nombre])));
  const [cantidad, setCantidad] = useState(1);
  const [falta, setFalta] = useState(false);
  const [cargando, setCargando] = useState(null);
  const [escribiendo, setEscribiendo] = useState(false);
  const [filtro, setFiltro] = useState(null);
  const [mostradas, setMostradas] = useState(POR_PAGINA);
  const [foto, setFoto] = useState(null);

  // El nombre y la descripción vienen de los datos: pasan por la traducción de la tienda (si hay).
  const nombre = useTexto(producto.nombre);
  const descripcion = useHtml(producto.descripcion);
  const variante = variantes.find((v) => v.id === varId) || variantes[0];
  const lista = opcionesDe(variante, tallasBase);
  const galeria = (variante && fotos[variante.id]) || fotos.base || [];

  // La más útil (con al menos un voto) va primero, destacada.
  const { destacada, resto } = useMemo(() => {
    const todas = opiniones.lista || [];
    const mejor = [...todas].sort((a, b) => b.utiles - a.utiles || b.fotos.length - a.fotos.length)[0];
    const d = mejor?.utiles > 0 ? mejor : null;
    return { destacada: d, resto: todas.filter((o) => o !== d) };
  }, [opiniones.lista]);

  if (estado === 'cargando') return <EsqueletoPagina forma="producto" />;
  if (estado === 'error' || estado === 'noDisponible') {
    const error = estado === 'error';
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={s.estado}>
          <EstadoVacio
            imagen={CARAS_KAPI.triste}
            titulo={error ? 'No pudimos cargar el producto' : 'Este producto ya no está disponible'}
            texto={error ? 'Revisa tu conexión e inténtalo de nuevo.' : 'Lo retiramos del catálogo, pero tenemos muchas otras opciones esperándote.'}
          >
            {error
              ? <Boton icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>
              : <Boton to={urlTienda} icono={<Store aria-hidden="true" />}>Ir a la tienda</Boton>}
          </EstadoVacio>
        </div>
      </BloqueSeccion>
    );
  }

  const quedan = !producto.agotado && producto.stock > 0 && producto.stock <= STOCK_BAJO ? producto.stock : 0;
  const eleccion = { variante, opcion, piezas: colores, cantidad };
  const accion = async (cual, fn) => {
    if (lista.length && !opcion) { setFalta(true); return; }
    setCargando(cual);
    try { await fn?.(eleccion); } finally { setCargando(null); }
  };

  const conFiltro = filtro ? resto.filter((o) => o.puntuacion === filtro) : resto;
  const conFotos = (opiniones.lista || []).flatMap((o) => o.fotos).slice(0, 12);

  return (
    <>
      <MarcoFicha componente="PaginaProducto" galeria={<GaleriaProducto key={variante?.id || 'base'} imagenes={galeria} nombre={nombre} />}>
        <Migas items={[{ texto: 'Inicio', url: '/' }, producto.categoria && { texto: producto.categoria.nombre, url: producto.categoria.url }, { texto: nombre }].filter(Boolean)} />

        <div className={s.cabeza}>
          {producto.marca && (
            <Enlace to={producto.marca.url} className={s.marca}>
              {producto.marca.logo && <img src={producto.marca.logo} alt="" />}
              {producto.marca.nombre}
            </Enlace>
          )}
          <div className={s.tituloFila}>
            <h1 className={s.titulo}>{nombre}</h1>
            {sesion && onCompartir && (
              <Boton variante="contorno" tamano="sm" soloIcono aria-label="Compartir y ganar monedas" title="Compartir y ganar monedas" icono={<Share2 aria-hidden="true" />} onClick={onCompartir} />
            )}
          </div>
          {opiniones.total > 0 && (
            <Enlace to="#opiniones" className={s.puntaje}>
              <Estrellas valor={opiniones.promedio} tamano={15} />
              <strong>{opiniones.promedio.toFixed(1)}</strong>
              <span>({opiniones.total === 1 ? '1 opinión' : `${opiniones.total} opiniones`})</span>
            </Enlace>
          )}
        </div>

        <PrecioFicha precio={producto.precio} precioAntes={producto.precioAntes} />
        {quedan > 0 && <p className={s.quedan}>{quedan === 1 ? '¡Queda 1!' : `¡Quedan ${quedan}!`}</p>}

        {producto.combo?.length > 0 && (
          <div className={s.grupo}>
            <span className={s.rotulo}>Este conjunto incluye <em>({producto.combo.length})</em></span>
            <ul className={s.piezas}>
              {producto.combo.map((p, i) => (
                <li key={`${p.nombre}-${i}`}>
                  <FotoProducto className={s.piezaFoto} src={p.imagen} relleno="6%" />
                  <span>{p.nombre}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <OpcionesProducto
          variantes={variantes}
          varId={variante?.id}
          onVariante={(id) => { setVarId(id); setOpcion(null); }}
          opciones={tallasBase}
          etiquetaOpcion={etiquetaOpcion}
          opcion={opcion}
          onOpcion={(o) => { setOpcion(o); setFalta(false); }}
          notaOpcion={piezas.length > 1 ? `Se aplica a las ${piezas.length} prendas.` : undefined}
          piezas={piezas}
          colores={colores}
          onColorPieza={(i, c) => setColores((x) => ({ ...x, [i]: c }))}
          cantidad={cantidad}
          onCantidad={producto.agotado ? undefined : setCantidad}
          falta={falta}
        />

        {/* En el celular, agregar y personalizar quedan pegados abajo. */}
        <div className={s.compra}>
          <Boton bloque tamano="lg" icono={<ShoppingBag aria-hidden="true" />} disabled={producto.agotado} cargando={cargando === 'agregar'} onClick={() => accion('agregar', onAgregar)}>
            {producto.agotado ? 'Agotado por ahora' : 'Agregar al carrito'}
          </Boton>
          {producto.personalizable && onPersonalizar && (
            <Boton variante="contorno" tamano="lg" icono={<Paintbrush aria-hidden="true" />} onClick={() => onPersonalizar(eleccion)}>Personalizar</Boton>
          )}
        </div>
        {!producto.agotado && (
          <Boton bloque tamano="lg" variante="secundario" cargando={cargando === 'comprar'} onClick={() => accion('comprar', onComprar)} iconoFin={<ArrowRight aria-hidden="true" />}>Comprar ahora</Boton>
        )}
        {carrito > 0 && (
          <Enlace to={urlPagar} className={s.pagarCarrito}>Ir a pagar mi carrito ({carrito})</Enlace>
        )}

        <ConfianzaCompra />

        {descripcion && (
          <Acordeon
            variante="lista"
            abiertoInicial="descripcion"
            items={[{ id: 'descripcion', question: 'Descripción', answer: <div className={s.textoRico} dangerouslySetInnerHTML={{ __html: descripcion }} /> }]}
          />
        )}
      </MarcoFicha>

      <BloqueSeccion ajustes={{ paddingTop: '0.5rem', paddingBottom: '2rem' }}>
        <section id="opiniones" className={s.opiniones} data-componente="OpinionesProducto">
          <TituloSeccion titulo="Opiniones" subtitulo={opiniones.total ? 'Lo que dicen quienes ya lo tienen.' : undefined} />
          <div className={s.opinionesCuerpo}>
            <ResumenOpiniones
              promedio={opiniones.promedio || 0}
              total={opiniones.total || 0}
              porEstrella={opiniones.porEstrella}
              filtro={filtro}
              onFiltro={(n) => { setFiltro(n); setMostradas(POR_PAGINA); }}
              accion={!escribiendo && (
                <Boton variante="contorno" bloque icono={<PencilLine aria-hidden="true" />} onClick={() => setEscribiendo(true)}>Escribir una opinión</Boton>
              )}
            />
            <div className={s.opinionesLista}>
              {escribiendo && (
                <FormularioOpinion
                  sesion={sesion}
                  urlLogin={urlLogin}
                  onCancelar={() => setEscribiendo(false)}
                  onEnviar={async (o) => { await onOpinar?.(o); setEscribiendo(false); }}
                />
              )}
              {conFotos.length > 0 && !filtro && (
                <div className={s.fotosClientes}>
                  <span className={s.rotulo}>Fotos de clientes</span>
                  <div className={s.tiraFotos}>
                    {conFotos.map((f, i) => (
                      <button key={`${f}-${i}`} type="button" onClick={() => setFoto(f)} aria-label={`Ver la foto ${i + 1}`}><img src={f} alt="" loading="lazy" /></button>
                    ))}
                  </div>
                </div>
              )}
              {!opiniones.total && !escribiendo && (
                <p className={s.sinOpiniones}>Todavía nadie opinó. Si ya lo tienes, cuéntanos qué te pareció.</p>
              )}
              {destacada && !filtro && <TarjetaOpinion {...destacada} destacada onUtil={() => onUtil?.(destacada.id)} onFoto={setFoto} />}
              {conFiltro.slice(0, mostradas).map((o) => (
                <TarjetaOpinion key={o.id} {...o} onUtil={() => onUtil?.(o.id)} onFoto={setFoto} />
              ))}
              {conFiltro.length > mostradas && (
                <Boton variante="fantasma" onClick={() => setMostradas((n) => n + POR_PAGINA)}>Ver más opiniones ({conFiltro.length - mostradas})</Boton>
              )}
            </div>
          </div>
        </section>
      </BloqueSeccion>

      {relacionados.length > 0 && (
        <BloqueSeccion ajustes={{ paddingTop: '0.5rem', paddingBottom: '2.5rem' }}>
          <TituloSeccion titulo="También te puede gustar" />
          <Carrusel visibles={{ escritorio: 5, tablet: 3, movil: 2.15 }} espacio="0.85rem" etiqueta="También te puede gustar">
            {relacionados.map((p, i) => <TarjetaProducto key={p.url || i} {...p} onAgregar={onAgregarRelacionado?.(i)} />)}
          </Carrusel>
        </BloqueSeccion>
      )}

      <HojaInferior abierta={Boolean(foto)} onCerrar={() => setFoto(null)} titulo="Foto de un cliente">
        {foto && <img className={s.fotoGrande} src={foto} alt="" />}
      </HojaInferior>
    </>
  );
}
