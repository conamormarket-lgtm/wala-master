import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Paintbrush, ArrowRight, Share2, RotateCcw, PencilLine, Store } from 'lucide-react';
import Boton from '../Boton';
import Acordeon from '../Acordeon';
import Carrusel from '../Carrusel';
import TarjetaProducto from '../TarjetaProducto';
import { Enlace } from '../Enlace';
import { Texto, useTexto, useHtml } from '../Traduccion';
import { EstadoVacio, HojaInferior } from '../Feedback';
import { BloqueSeccion, TituloSeccion } from '../Seccion';
import { EsqueletoPagina, Hueso, EsqueletoTexto } from '../Esqueletos';
import { IconoWala } from '../IconosWala';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { FotoProducto } from '../piezas/FotoProducto';
import { GaleriaProducto } from '../piezas/GaleriaProducto';
import { MarcoFicha, Migas, PrecioFicha, ConfianzaCompra, BarraCompra, useAgregado, IconoAgregar } from '../piezas/Ficha';
import { OpcionesProducto, tallasDe, tallasDePieza, faltaTalla, verVariantes } from '../piezas/OpcionesProducto';
import { Estrellas, ResumenOpiniones, TarjetaOpinion, FormularioOpinion } from '../piezas/Opiniones';
import { atributosDeFoto } from '../../../components/common/OptimizedImage/OptimizedImage';
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

/** Una foto de la tira de "Fotos de clientes" (su nombre para lectores, traducido). */
function FotoCliente({ foto, numero, onVer }) {
  const etiqueta = useTexto(`Ver la foto ${numero}`);
  return <button type="button" onClick={() => onVer(foto)} aria-label={etiqueta}><img {...atributosDeFoto(foto, '120px')} alt="" loading="lazy" /></button>;
}

/**
 * ¿Es la imagen "frente y espalda" de un producto? El admin la sube como
 * …/gallery_<fecha>_frente-espalda.png (WebP al subirla): se reconoce por el
 * nombre del archivo (en la URL de Storage, antes de la consulta).
 */
const esFrenteEspalda = (url) => /_frente-espalda\.\w+(\?|$)/i.test(String(url || ''));

/**
 * La galería de un combo con el color elegido de cada prenda (fotos.combo de
 * fichaProductoDesde): la portada, la foto de cada prenda en su color ("Ella ·
 * Melange") y las del producto, sin repetir. Si el color elegido no tiene
 * foto, va la de la prenda con el color que sí muestra ("Él · Negro"): así la
 * prenda no desaparece de la galería (en la tienda desaparece). Cada foto
 * sabe de qué prenda y color es (`pieza`, `color`) para saltar a ella.
 * La imagen "frente y espalda" de una prenda (la que se genera en el admin)
 * no va en el combo: cada prenda muestra sus fotos sueltas, todas iguales.
 * Solo si una prenda no tuviera otra foto en ese color, va esa.
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
    const todas = f.porColor[colores[i]] || [];
    const sueltas = todas.filter((u) => !esFrenteEspalda(u));
    const propias = sueltas.length ? sueltas : todas;
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
 *    (opiniones.cargando: todavía no llegan; va un esqueleto en su lugar)
 *  - onVerAbajo(): una vez, cuando las opiniones se acercan a la vista (la
 *    tienda las pide recién ahí, junto con los relacionados)
 *  - relacionados: [props de TarjetaProducto] · onAgregarRelacionado(i) ·
 *    tarjeta: otra tarjeta (la de la tienda) → <Tarjeta producto={r} indice={i} />
 *    con cada elemento de relacionados tal cual llega
 *  - fuentes(url) → { src, srcSet }: la foto que se pide y sus copias en
 *    varios tamaños (la tienda las tiene); sin ella, la URL tal cual
 *  - onAgregar(eleccion) · onComprar(eleccion): promesas (false: no se pudo); eleccion = {
 *    variante, opcion, piezas: { [i]: color }, tallas: { [i]: talla }, cantidad }
 *    (en un combo cada prenda lleva su talla en `tallas`)
 *  - onPersonalizar(eleccion) (si es personalizable) · textoPersonalizar
 *    ("Personalizable" para el personalizador de Yoryo) · onCompartir() (con sesión)
 *  - piezasCargando: las prendas de un combo todavía no llegan (sus colores
 *    van en esqueleto; al llegar, cada prenda abre con su color)
 *  - regalo: el aviso cuando se compra el regalo de una lista ("Estás
 *    comprando un regalo de una lista de deseos.")
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
  textoPersonalizar = 'Personalizar', piezasCargando = false, regalo, fuentes, tarjeta: Tarjeta, onVerAbajo,
}) {
  // tallaUnica: el combo lleva una talla para todas (lo elige el admin).
  const { variantes = [], opciones: tallasBase = [], etiquetaOpcion = 'Talla', piezas = [], tallaUnica = false } = opciones;
  const [varId, setVarId] = useState(varianteInicial ?? variantes[0]?.id);
  const [opcion, setOpcion] = useState(null);
  const [colores, setColores] = useState(() => Object.fromEntries(piezas.map((p, i) => [i, p.colores.some((c) => c.nombre === p.color) ? p.color : p.colores[0]?.nombre])));
  // La talla de cada prenda de un combo (una pareja puede ser de tallas distintas).
  const [tallas, setTallas] = useState({});
  const [cantidad, setCantidad] = useState(1);
  // Cuántas veces se intentó sin talla (0: no falta): cada intento la vuelve a sacudir.
  const [falta, setFalta] = useState(0);
  const [cargando, setCargando] = useState(null);
  const [escribiendo, setEscribiendo] = useState(false);
  const [filtro, setFiltro] = useState(null);
  const [mostradas, setMostradas] = useState(POR_PAGINA);
  const [fotoCliente, setFotoCliente] = useState(null);
  const [agregado, marcarAgregado] = useAgregado();
  // Al recolorear una prenda del combo, la galería salta a su foto en ese color.
  const [salto, setSalto] = useState(null);
  const compraRef = useRef(null);
  const opcionesRef = useRef(null);
  const finRef = useRef(null);
  const opinionesRef = useRef(null);
  const verAbajo = useRef(onVerAbajo);
  verAbajo.current = onVerAbajo;

  // Las prendas de un combo pueden llegar después: cada una abre con su color
  // (el del combo o el primero) sin pisar el que ya se eligió.
  const firmaPiezas = piezas.map((p) => p.colores.map((c) => c.nombre).join('|')).join('/');
  useEffect(() => {
    setColores((x) => {
      const n = { ...x };
      let cambio = false;
      piezas.forEach((p, i) => {
        if (p.colores.some((c) => c.nombre === n[i])) return;
        const v = p.colores.some((c) => c.nombre === p.color) ? p.color : p.colores[0]?.nombre;
        if (v !== n[i]) { n[i] = v; cambio = true; }
      });
      return cambio ? n : x;
    });
  }, [firmaPiezas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lo de abajo (opiniones, relacionados) se pide cuando se acerca a la vista.
  useEffect(() => {
    const el = opinionesRef.current;
    if (!el || !verAbajo.current) return undefined;
    if (typeof IntersectionObserver === 'undefined') { verAbajo.current(); return undefined; }
    const ojo = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) { ojo.disconnect(); verAbajo.current?.(); }
    }, { rootMargin: '300px 0px' });
    ojo.observe(el);
    return () => ojo.disconnect();
  }, [estado]);

  // El nombre y la descripción vienen de los datos: pasan por la traducción de la tienda (si hay).
  const nombre = useTexto(producto.nombre);
  const descripcion = useHtml(producto.descripcion);
  // Textos que van en atributos (aria-label, title, el título de una hoja).
  const textoCompartir = useTexto('Compartir y ganar monedas');
  const textoCargandoPiezas = useTexto('Cargando las prendas del combo');
  const textoCargandoOpiniones = useTexto('Cargando las opiniones');
  const variante = variantes.find((v) => v.id === varId) || variantes[0];
  const galeria = useMemo(() => {
    const lista = fotos.combo ? galeriaCombo(fotos.combo, piezas, colores) : (variante && fotos[variante.id]) || fotos.base || [];
    // Las copias de cada foto (si la tienda las da): la galería baja solo la que hace falta.
    if (!fuentes) return lista;
    return lista.map((f) => {
      const { src, srcSet } = fuentes(f.url) || {};
      return { ...f, url: src || f.url, srcSet };
    });
  }, [fotos, piezas, colores, variante, fuentes]);
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
            titulo={<Texto>{error ? 'No pudimos cargar el producto' : 'Este producto ya no está disponible'}</Texto>}
            texto={<Texto>{error ? 'Revisa tu conexión e inténtalo de nuevo.' : 'Lo retiramos del catálogo, pero tenemos muchas otras opciones esperándote.'}</Texto>}
          >
            {error
              ? <Boton icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}><Texto>Reintentar</Texto></Boton>
              : <Boton to={urlTienda} icono={<Store aria-hidden="true" />}><Texto>Ir a la tienda</Texto></Boton>}
          </EstadoVacio>
        </div>
      </BloqueSeccion>
    );
  }

  const quedan = !producto.agotado && producto.stock > 0 && producto.stock <= STOCK_BAJO ? producto.stock : 0;
  const eleccion = { variante, opcion, piezas: colores, tallas: tallaUnica ? {} : tallas, cantidad };
  const sinTalla = faltaTalla({ variante, opciones: tallasBase, piezas, colores, opcion, tallas, tallaUnica });
  const porPrenda = piezas.length > 0 && !tallaUnica;
  const accion = async (cual, fn) => {
    if (sinTalla) {
      setFalta((n) => n + 1);
      // Si la talla que falta no se ve (en el celular el botón va pegado
      // abajo, lejos de ella), se lleva la vista hasta la primera, ya marcada
      // (después de que React la pinte con su aviso).
      setTimeout(() => {
        const el = opcionesRef.current?.querySelector('[role="alert"]')?.parentElement || opcionesRef.current;
        const r = el?.getBoundingClientRect();
        if (!r || (r.top >= 80 && r.bottom <= window.innerHeight - 140)) return;
        el.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      }, 0);
      return;
    }
    setCargando(cual);
    try {
      const hecho = await fn?.(eleccion);
      // "¡Agregado!" un momento en el mismo botón, como confirmación (si no
      // se pudo agregar, onAgregar devuelve false).
      if (cual === 'agregar' && hecho !== false) marcarAgregado();
    } finally { setCargando(null); }
  };
  const botonAgregar = (props) => (
    <Boton
      tamano="lg"
      icono={<IconoAgregar agregado={agregado} />}
      disabled={producto.agotado}
      cargando={cargando === 'agregar'}
      onClick={() => producto.requierePersonalizacion ? onPersonalizar?.(eleccion) : accion('agregar', onAgregar)}
      {...props}
    >
      <Texto>{producto.agotado ? 'Agotado por ahora' : producto.requierePersonalizacion ? textoPersonalizar : agregado ? '¡Agregado!' : 'Agregar al carrito'}</Texto>
    </Boton>
  );
  const detalle = [
    verVariantes(variantes) && variante?.nombre,
    piezas.length > 0 && piezas.map((_, i) => [colores[i], porPrenda && tallas[i]].filter(Boolean).join(' ')).filter(Boolean).join(' + '),
    porPrenda ? null : opcion,
    sinTalla && `Elige ${etiquetaOpcion.toLowerCase()}`,
  ].filter(Boolean).join(' · ');
  const foto = (url) => (fuentes && url ? fuentes(url).src || url : url);

  const conFiltro = filtro ? resto.filter((o) => o.puntuacion === filtro) : resto;
  const conFotos = (opiniones.lista || []).flatMap((o) => o.fotos).slice(0, 12);

  return (
    <>
      <MarcoFicha componente="PaginaProducto" galeria={<GaleriaProducto key={variante?.id || 'base'} imagenes={galeria} nombre={nombre} salto={salto} />}>
        {/* Migas traduce cada miga: el nombre va sin traducir. */}
        <Migas items={[{ texto: 'Inicio', url: '/' }, producto.categoria && { texto: producto.categoria.nombre, url: producto.categoria.url }, { texto: producto.nombre }].filter(Boolean)} />

        <div className={s.cabeza}>
          {producto.marca && (
            <Enlace to={producto.marca.url} className={s.marca}>
              {producto.marca.logo && <img {...atributosDeFoto(producto.marca.logo, '64px')} alt="" />}
              {producto.marca.nombre}
            </Enlace>
          )}
          <div className={s.tituloFila}>
            <h1 className={s.titulo}>{nombre}</h1>
            {sesion && onCompartir && (
              <Boton variante="contorno" tamano="sm" soloIcono aria-label={textoCompartir} title={textoCompartir} icono={<Share2 aria-hidden="true" />} onClick={onCompartir} />
            )}
          </div>
          {opiniones.total > 0 && (
            <Enlace to="#opiniones" className={s.puntaje}>
              <Estrellas valor={opiniones.promedio} tamano={15} />
              <strong>{opiniones.promedio.toFixed(1)}</strong>
              <span>(<Texto>{opiniones.total === 1 ? '1 opinión' : `${opiniones.total} opiniones`}</Texto>)</span>
            </Enlace>
          )}
        </div>

        <PrecioFicha precio={producto.precio} precioAntes={producto.precioAntes} />
        {quedan > 0 && <p className={s.quedan}><Texto>{quedan === 1 ? '¡Queda 1!' : `¡Quedan ${quedan}!`}</Texto></p>}

        {producto.combo?.length > 0 && (
          <div className={s.grupo}>
            <span className={s.rotulo}><Texto>Este conjunto incluye</Texto> <em>({producto.combo.length})</em></span>
            <ul className={s.piezas}>
              {producto.combo.map((p, i) => (
                <li key={`${p.nombre}-${i}`}>
                  {/* La foto de la prenda en el color elegido (si ese color tiene). */}
                  <FotoProducto className={s.piezaFoto} src={foto(fotos.combo?.piezas[i]?.porColor[colores[i]]?.[0] || p.imagen)} relleno="6%" />
                  <span><Texto>{p.nombre}</Texto></span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div ref={opcionesRef} className={s.opciones}>
        {piezasCargando && (
          // Los colores de cada prenda, mientras llegan.
          <div className={s.grupo} role="status" aria-label={textoCargandoPiezas}>
            {(producto.combo || []).map((p, i) => (
              <span key={`${p.nombre}-${i}`} className={s.piezaCargando}>
                <Hueso ancho="40%" alto={12} />
                <span className={s.muestrasCargando}>{[0, 1, 2, 3, 4].map((k) => <Hueso key={k} forma="circulo" ancho={34} alto={34} />)}</span>
              </span>
            ))}
          </div>
        )}
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
          onOpcion={(o) => { setOpcion(o); setFalta(0); }}
          piezas={piezasCargando ? [] : piezas}
          colores={colores}
          onColorPieza={(i, c) => {
            const nuevos = { ...colores, [i]: c };
            setColores(nuevos);
            // Solo si ese color tiene foto: si no, la galería se queda donde está.
            const k = fotos.combo ? galeriaCombo(fotos.combo, piezas, nuevos).findIndex((f) => f.pieza === i && f.color === c) : -1;
            if (k >= 0) setSalto((x) => ({ indice: k, vez: (x?.vez || 0) + 1 }));
            // Las tallas son las del color elegido: si la elegida ya no está, se vuelve a elegir.
            if (tallas[i] && !tallasDePieza(piezas[i], c).includes(tallas[i])) setTallas((x) => ({ ...x, [i]: undefined }));
            if (opcion && !tallasDe({ opciones: tallasBase, piezas, colores: nuevos }).includes(opcion)) setOpcion(null);
          }}
          tallaUnica={tallaUnica}
          tallasPiezas={tallas}
          onTallaPieza={(i, t) => setTallas((x) => ({ ...x, [i]: t }))}
          cantidad={cantidad}
          onCantidad={producto.agotado ? undefined : setCantidad}
          falta={falta}
        />
        </div>

        {regalo && (
          <p className={s.regalo}>
            <IconoWala nombre="regalo" tamano={30} />
            <span><Texto>{regalo}</Texto></span>
          </p>
        )}

        {/* En el celular, agregar y personalizar quedan pegados abajo. */}
        <div ref={compraRef} className={s.compra} data-compra-fija="">
          {botonAgregar({ bloque: true })}
          {producto.personalizable && !producto.requierePersonalizacion && onPersonalizar && (
            <Boton variante="contorno" tamano="lg" icono={<Paintbrush aria-hidden="true" />} onClick={() => onPersonalizar(eleccion)}><Texto>{textoPersonalizar}</Texto></Boton>
          )}
        </div>
        {!producto.agotado && !producto.requierePersonalizacion && (
          <Boton bloque tamano="lg" variante="secundario" cargando={cargando === 'comprar'} onClick={() => accion('comprar', onComprar)} iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Comprar ahora</Texto></Boton>
        )}
        {carrito > 0 && (
          <Enlace to={urlPagar} className={s.pagarCarrito} onClick={onPagarCarrito ? (e) => { e.preventDefault(); onPagarCarrito(); } : undefined}><Texto>Ir a pagar mi carrito</Texto> ({carrito})</Enlace>
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
        <section ref={opinionesRef} id="opiniones" className={s.opiniones} data-componente="OpinionesProducto">
          <TituloSeccion titulo="Opiniones" subtitulo={opiniones.total ? 'Lo que dicen quienes ya lo tienen.' : undefined} />
          <div className={s.opinionesCuerpo}>
            <ResumenOpiniones
              promedio={opiniones.promedio || 0}
              total={opiniones.total || 0}
              porEstrella={opiniones.porEstrella}
              filtro={filtro}
              onFiltro={(n) => { setFiltro(n); setMostradas(POR_PAGINA); }}
              accion={!escribiendo && (
                <Boton variante="contorno" bloque icono={<PencilLine aria-hidden="true" />} onClick={() => setEscribiendo(true)}><Texto>Escribir una opinión</Texto></Boton>
              )}
            />
            <div className={s.opinionesLista}>
              {opiniones.cargando && !escribiendo && (
                <div className={s.opinionesCargando} role="status" aria-label={textoCargandoOpiniones}>
                  {[0, 1].map((k) => (
                    <span key={k} className={s.opinionCargando}>
                      <Hueso ancho="35%" alto={13} />
                      <EsqueletoTexto lineas={2} />
                    </span>
                  ))}
                </div>
              )}
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
                  <span className={s.rotulo}><Texto>Fotos de clientes</Texto></span>
                  <div className={s.tiraFotos}>
                    {conFotos.map((f, i) => (
                      <FotoCliente key={`${f}-${i}`} foto={f} numero={i + 1} onVer={setFotoCliente} />
                    ))}
                  </div>
                </div>
              )}
              {!opiniones.total && !opiniones.cargando && !escribiendo && (
                <p className={s.sinOpiniones}><Texto>Todavía nadie opinó. Si ya lo tienes, cuéntanos qué te pareció.</Texto></p>
              )}
              {destacada && !filtro && <TarjetaOpinion {...destacada} destacada onUtil={() => onUtil?.(destacada.id)} onFoto={setFotoCliente} />}
              {conFiltro.slice(0, mostradas).map((o) => (
                <TarjetaOpinion key={o.id} {...o} onUtil={() => onUtil?.(o.id)} onFoto={setFotoCliente} />
              ))}
              {conFiltro.length > mostradas && (
                <Boton variante="fantasma" onClick={() => setMostradas((n) => n + POR_PAGINA)}>{`Ver más opiniones (${conFiltro.length - mostradas})`}</Boton>
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
              {relacionados.map((p, i) => (Tarjeta
                ? <Tarjeta key={p.id || p.url || i} producto={p} indice={i} />
                : <TarjetaProducto key={p.url || i} {...p} onAgregar={onAgregarRelacionado?.(i)} />))}
            </Carrusel>
          </div>
        </BloqueSeccion>
      )}

      {!producto.agotado && (
        <BarraCompra mirar={compraRef} hasta={finRef} imagen={galeria[0]?.url} nombre={nombre} detalle={<Texto>{detalle}</Texto>} precio={producto.precio}>
          {botonAgregar({ tamano: 'md' })}
        </BarraCompra>
      )}

      <HojaInferior abierta={Boolean(fotoCliente)} onCerrar={() => setFotoCliente(null)} titulo="Foto de un cliente">
        {fotoCliente && <img className={s.fotoGrande} {...atributosDeFoto(fotoCliente, '100vw')} alt="" />}
      </HojaInferior>
    </>
  );
}
