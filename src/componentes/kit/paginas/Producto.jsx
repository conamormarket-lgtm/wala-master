import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ShoppingBag, Paintbrush, ArrowRight, Share2, RotateCcw, PencilLine, Store, Check } from 'lucide-react';
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
import { MarcoFicha, Migas, PrecioFicha, ConfianzaCompra, BarraCompra } from '../piezas/Ficha';
import { OpcionesProducto, tallasDe, verVariantes } from '../piezas/OpcionesProducto';
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
 * La galería de un combo con el color elegido de cada prenda (fotos.combo de
 * fichaProductoDesde): la portada, la foto de cada prenda en su color ("Ella ·
 * Melange") y las del producto, sin repetir. Si el color elegido no tiene
 * foto, va la de la prenda con el color que sí muestra ("Él · Negro"): así la
 * prenda no desaparece de la galería (en la tienda desaparece). Cada foto
 * sabe de qué prenda y color es (`pieza`, `color`) para saltar a ella.
 */
const galeriaCombo = (combo, piezas, colores) => {
  const lista = [];
  const poner = (url, pieza, color) => {
    const pz = piezas[pieza];
    const nombre = pz ? [pz.nombre, color].filter(Boolean).join(' · ') : '';
    const ya = lista.find((f) => f.url === url);
    if (!ya) lista.push({ url, nombre, corto: pz?.nombre, pieza, color });
    else if (pieza != null && ya.pieza == null) Object.assign(ya, { nombre, corto: pz?.nombre, pieza, color });
  };
  combo.portada.forEach((u) => poner(u));
  combo.piezas.forEach((f, i) => {
    const propias = f.porColor[colores[i]] || [];
    if (propias.length) propias.forEach((u) => poner(u, i, colores[i]));
    else f.general.forEach((u) => poner(u, i, Object.keys(f.porColor).find((c) => f.porColor[c].includes(u))));
  });
  combo.producto.forEach((u) => poner(u));
  return lista;
};

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
 *  - onVariante(variante): al abrir y en cada cambio de color o modelo (la
 *    analítica de la tienda mide cuánto se mira cada variante)
 *  - carrito: cuántos hay ya (para "Ir a pagar mi carrito") · urlPagar ·
 *    onPagarCarrito(): si se pasa, el enlace la llama en vez de navegar (la
 *    tienda elige todo el carrito antes de ir al checkout)
 *  - sesion · urlLogin
 *  - estado: 'cargando' | 'error' | 'noDisponible' · onReintentar · urlTienda
 */
export function PaginaProducto({
  producto = {}, opciones = {}, varianteInicial, fotos = {}, opiniones = {}, onOpinar, onUtil,
  relacionados = [], onAgregarRelacionado, onAgregar, onComprar, onPersonalizar, onCompartir, onVariante,
  carrito = 0, urlPagar = '/checkout', onPagarCarrito, sesion = false, urlLogin = '/login',
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
  const [agregado, setAgregado] = useState(false);
  // Al recolorear una prenda del combo, la galería salta a su foto en ese color.
  const [salto, setSalto] = useState(null);
  const compraRef = useRef(null);
  const opcionesRef = useRef(null);
  const finRef = useRef(null);
  const reloj = useRef(null);
  useEffect(() => () => clearTimeout(reloj.current), []);

  // El nombre y la descripción vienen de los datos: pasan por la traducción de la tienda (si hay).
  const nombre = useTexto(producto.nombre);
  const descripcion = useHtml(producto.descripcion);
  const variante = variantes.find((v) => v.id === varId) || variantes[0];
  const lista = tallasDe({ variante, opciones: tallasBase, piezas, colores });
  const galeria = useMemo(
    () => (fotos.combo ? galeriaCombo(fotos.combo, piezas, colores) : (variante && fotos[variante.id]) || fotos.base || []),
    [fotos, piezas, colores, variante],
  );
  useEffect(() => { if (variante) onVariante?.(variante); }, [variante?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const accion = async (cual, fn, desdeBarra = false) => {
    if (lista.length && !opcion) {
      setFalta(true);
      // Desde la barra de abajo la talla no se ve: se lleva la vista hasta ella.
      if (desdeBarra) opcionesRef.current?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    setCargando(cual);
    try {
      await fn?.(eleccion);
      // "¡Agregado!" un momento en el mismo botón, como confirmación.
      if (cual === 'agregar') {
        setAgregado(true);
        clearTimeout(reloj.current);
        reloj.current = setTimeout(() => setAgregado(false), 1800);
      }
    } finally { setCargando(null); }
  };
  const botonAgregar = (props, desdeBarra) => (
    <Boton
      tamano="lg"
      icono={agregado ? <Check key="hecho" className={s.hecho} aria-hidden="true" /> : <ShoppingBag aria-hidden="true" />}
      disabled={producto.agotado}
      cargando={cargando === 'agregar'}
      onClick={() => accion('agregar', onAgregar, desdeBarra)}
      {...props}
    >
      {producto.agotado ? 'Agotado por ahora' : agregado ? '¡Agregado!' : 'Agregar al carrito'}
    </Boton>
  );
  const detalle = [verVariantes(variantes) && variante?.nombre, piezas.length > 0 && piezas.map((_, i) => colores[i]).filter(Boolean).join(' + '), opcion || (lista.length ? `Elige ${etiquetaOpcion.toLowerCase()}` : null)].filter(Boolean).join(' · ');

  const conFiltro = filtro ? resto.filter((o) => o.puntuacion === filtro) : resto;
  const conFotos = (opiniones.lista || []).flatMap((o) => o.fotos).slice(0, 12);

  return (
    <>
      <MarcoFicha componente="PaginaProducto" galeria={<GaleriaProducto key={variante?.id || 'base'} imagenes={galeria} nombre={nombre} salto={salto} />}>
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
                  {/* La foto de la prenda en el color elegido (si ese color tiene). */}
                  <FotoProducto className={s.piezaFoto} src={fotos.combo?.piezas[i]?.porColor[colores[i]]?.[0] || p.imagen} relleno="6%" />
                  <span>{p.nombre}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div ref={opcionesRef} className={s.opciones}>
        <OpcionesProducto
          variantes={variantes}
          varId={variante?.id}
          onVariante={(id) => {
            setVarId(id);
            // La talla elegida se queda si el nuevo color también la tiene.
            if (!tallasDe({ variante: variantes.find((v) => v.id === id), opciones: tallasBase }).includes(opcion)) setOpcion(null);
          }}
          opciones={tallasBase}
          etiquetaOpcion={etiquetaOpcion}
          opcion={opcion}
          onOpcion={(o) => { setOpcion(o); setFalta(false); }}
          notaOpcion={piezas.length > 1 ? `Se aplica a las ${piezas.length} prendas.` : undefined}
          piezas={piezas}
          colores={colores}
          onColorPieza={(i, c) => {
            const nuevos = { ...colores, [i]: c };
            setColores(nuevos);
            // Solo si ese color tiene foto: si no, la galería se queda donde está.
            const k = fotos.combo ? galeriaCombo(fotos.combo, piezas, nuevos).findIndex((f) => f.pieza === i && f.color === c) : -1;
            if (k >= 0) setSalto((x) => ({ indice: k, vez: (x?.vez || 0) + 1 }));
            // Las tallas son las de los colores elegidos: si la elegida ya no está, se vuelve a elegir.
            if (!tallasDe({ opciones: tallasBase, piezas, colores: nuevos }).includes(opcion)) setOpcion(null);
          }}
          cantidad={cantidad}
          onCantidad={producto.agotado ? undefined : setCantidad}
          falta={falta}
        />
        </div>

        {/* En el celular, agregar y personalizar quedan pegados abajo. */}
        <div ref={compraRef} className={s.compra} data-compra-fija="">
          {botonAgregar({ bloque: true })}
          {producto.personalizable && onPersonalizar && (
            <Boton variante="contorno" tamano="lg" icono={<Paintbrush aria-hidden="true" />} onClick={() => onPersonalizar(eleccion)}>Personalizar</Boton>
          )}
        </div>
        {!producto.agotado && (
          <Boton bloque tamano="lg" variante="secundario" cargando={cargando === 'comprar'} onClick={() => accion('comprar', onComprar)} iconoFin={<ArrowRight aria-hidden="true" />}>Comprar ahora</Boton>
        )}
        {carrito > 0 && (
          <Enlace to={urlPagar} className={s.pagarCarrito} onClick={onPagarCarrito ? (e) => { e.preventDefault(); onPagarCarrito(); } : undefined}>Ir a pagar mi carrito ({carrito})</Enlace>
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

      {/* Desde aquí (los relacionados y el pie) la barra de compra ya no se muestra. */}
      <div ref={finRef} aria-hidden="true" />
      {relacionados.length > 0 && (
        <BloqueSeccion ajustes={{ paddingTop: '0.5rem', paddingBottom: '2.5rem' }}>
          <div data-componente="Carrusel · TarjetaProducto">
            <TituloSeccion titulo="También te puede gustar" />
            <Carrusel visibles={{ escritorio: 5, tablet: 3, movil: 2.15 }} espacio="0.85rem" etiqueta="También te puede gustar">
              {relacionados.map((p, i) => <TarjetaProducto key={p.url || i} {...p} onAgregar={onAgregarRelacionado?.(i)} />)}
            </Carrusel>
          </div>
        </BloqueSeccion>
      )}

      {!producto.agotado && (
        <BarraCompra mirar={compraRef} hasta={finRef} imagen={galeria[0]?.url} nombre={nombre} detalle={detalle} precio={producto.precio}>
          {botonAgregar({ tamano: 'md' }, true)}
        </BarraCompra>
      )}

      <HojaInferior abierta={Boolean(foto)} onCerrar={() => setFoto(null)} titulo="Foto de un cliente">
        {foto && <img className={s.fotoGrande} src={foto} alt="" />}
      </HojaInferior>
    </>
  );
}
