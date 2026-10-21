import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, MapPin, SlidersHorizontal } from 'lucide-react';
import Boton from './Boton';
import Marquesina from './Marquesina';
import Acordeon from './Acordeon';
import { TarjetaProductoEsqueleto, TarjetaDeCatalogo } from './TarjetaProducto';
import { Buscador, Campo, Selector } from './Formulario';
import { Chip } from './Etiquetas';
import { EstadoVacio, HojaInferior } from './Feedback';
import { TituloSeccion, tituloDesdeAjustes } from './Seccion';
import { precioEfectivo, limitesDePrecio, identidadDeMarca } from './adaptadores';
import { TextoCampo, BotonDeAjustes, fuenteDe, prefiereQuieto } from './SeccionesContenido';
import { toDirectImageUrl } from '../../utils/imageUrl';
import { atributosDeFoto } from '../../components/common/OptimizedImage/OptimizedImage';
import { EtiquetaColgante, Garabatos, Destello, Corazon, acento } from './Marca';
import { TarjetaCategoria, TarjetaCategoriaEsqueleto } from "./piezas/TarjetaCategoria";
import { Beneficio } from "./piezas/Beneficio";
import { FotoProducto } from "./piezas/FotoProducto";
import { OpcionesFiltro } from "./piezas/OpcionesFiltro";
import { PortadaMarca } from "./piezas/PortadaMarca";
import { TemaMarca } from "./piezas/TemaMarca";
import { Texto, useTexto } from './Traduccion';
import s from './SeccionesExtra.module.css';

/*
 * Resto de secciones del builder: banner principal, portada de marca, beneficios, mapa,
 * navegación de categorías, grillas de productos, catálogo con filtros y pie
 * de página. Mismos campos de `settings` que getDefaultSettings
 * (src/pages/Tienda/services/storefront.js). Lo que sale de consultas
 * (productos, categorías, estado de filtros) entra por props.
 */

/* ── Banner principal (hero_banner) ─────────────────────── */
const POSICION_VERTICAL = { 'flex-start': 'flex-start', top: 'flex-start', center: 'center', 'flex-end': 'flex-end', bottom: 'flex-end' };

/**
 * Imagen o video de fondo con título, subtítulo y botón encima.
 *  - primera: es lo primero de la página → la imagen se pide con prioridad.
 *  - onClicBoton: para medir clics (la tienda llama a trackBannerClick).
 */
/**
 * La portada de la página de una marca (brand_hero): el nombre y el logo son
 * los de la marca (se cambian en Marcas); la sección elige sus colores, el
 * estilo (foto, color o collage), la foto, la frase y el texto del botón, que
 * baja al catálogo. Es PortadaMarca dentro de TemaMarca. Sin marca no se dibuja.
 * Sin colores en la sección, los que la marca guardaba antes en Marcas.
 *  - ajustes: { color, color2, estilo, imagen, frase, buttonText }
 *  - marca: el doc de tienda_brands de la página
 *  - fotos (collage) · cuenta · ofertas · cuentaCategorias (sus sellos; no
 *    `categorias`, que SeccionDelKit guarda para las secciones de categorías) · urlBoton
 */
export function PortadaDeMarca({ ajustes = {}, marca, fotos = [], cuenta, ofertas, cuentaCategorias, urlBoton = '#catalogo' }) {
  if (!marca) return null;
  const { color, color2, frase } = identidadDeMarca(marca);
  return (
    <TemaMarca identidad={{ color: ajustes.color || color, color2: ajustes.color2 || color2 }}>
      <PortadaMarca
        nombre={marca.name}
        logo={marca.logoUrl}
        frase={ajustes.frase?.trim() ? ajustes.frase : frase}
        estilo={ajustes.estilo}
        imagen={ajustes.imagen}
        fotos={fotos}
        cuenta={cuenta}
        ofertas={ofertas}
        categorias={cuentaCategorias}
        urlBoton={urlBoton}
        textoBoton={ajustes.buttonText?.trim() || 'Ver productos'}
      />
      {/* "Ver productos" baja aquí si la página no tiene catálogo (lo que sigue a la portada). */}
      <span id="despues-de-la-portada" style={{ display: 'block', scrollMarginTop: '6rem' }} aria-hidden="true" />
    </TemaMarca>
  );
}

export function BannerPrincipal({ ajustes = {}, primera = false, onClicBoton }) {
  const {
    mediaType = 'image', mediaUrl, thumbnailUrl, title, subtitle, buttonText, buttonLink,
    textAlign = 'center', textPosition = 'center', overlayOpacity = 40, minHeight = '600px',
    titleColor, subtitleColor, buttonBgColor, buttonTextColor,
  } = ajustes;
  const video = useRef(null);
  const esVideo = mediaType === 'video' && mediaUrl;

  // El video de fondo solo corre mientras se ve (y nunca con "reducir movimiento").
  useEffect(() => {
    const v = video.current;
    if (!v || prefiereQuieto()) return undefined;
    v.muted = true;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.2 });
    io.observe(v);
    return () => io.disconnect();
  }, [mediaUrl, esVideo]);

  if (!mediaUrl && !title && !subtitle) return null;
  const velo = Math.min(100, Math.max(0, Number(overlayOpacity) || 0)) / 100;
  const alinear = { left: 'flex-start', right: 'flex-end' }[textAlign] || 'center';

  return (
    <div className={s.banner} style={{ '--alto': minHeight }}>
      <div className={s.bannerMedio}>
        {esVideo ? (
          <video ref={video} src={mediaUrl} poster={thumbnailUrl || undefined} muted loop playsInline preload="none" aria-hidden="true" />
        ) : mediaUrl ? (
          <img
            {...atributosDeFoto(toDirectImageUrl(mediaUrl), '100vw')}
            alt=""
            loading={primera ? 'eager' : 'lazy'}
            fetchpriority={primera ? 'high' : undefined}
            decoding="async"
          />
        ) : null}
      </div>
      <Garabatos variante="banner" className={s.bannerGarabatos} />
      <span
        className={s.bannerVelo}
        style={{ background: `linear-gradient(to bottom, rgba(0,0,0,${velo * 0.2}), rgba(0,0,0,${velo * 0.7}) 50%, rgba(0,0,0,${velo}))` }}
      />
      <div
        className={s.bannerTexto}
        style={{ justifyContent: POSICION_VERTICAL[textPosition] || 'center', alignItems: alinear, textAlign }}
      >
        {ajustes.eyebrow && <EtiquetaColgante tono="blanco" tamano="lg"><Texto>{ajustes.eyebrow}</Texto></EtiquetaColgante>}
        <TextoCampo ajustes={ajustes} campo="title" como="h1" className={s.bannerTitulo} style={{ color: titleColor || '#fff', ...fuenteDe(ajustes, 'title') }}>
          {title}
        </TextoCampo>
        <TextoCampo ajustes={ajustes} campo="subtitle" className={s.bannerSubtitulo} style={{ color: subtitleColor || '#fff', ...fuenteDe(ajustes, 'subtitle') }}>
          {subtitle}
        </TextoCampo>
        {buttonText && buttonLink && (
          <Boton
            to={buttonLink}
            tamano="lg"
            variante="contorno"
            onClick={onClicBoton}
            className={s.bannerBoton}
            style={{ '--b-fondo': buttonBgColor || '#fff', '--b-fondo-hover': buttonBgColor || '#fff', '--b-texto': buttonTextColor || '#111827', '--b-borde': 'transparent' }}
          >
            <Texto>{buttonText}</Texto>
          </Boton>
        )}
      </div>
    </div>
  );
}

/* ── Lista de beneficios (feature_list) ─────────────────── */
/**
 * Por qué elegirnos. La foto va como polaroid con cinta washi (como las
 * piezas "Crea tus recuerdos" de la marca); cada beneficio, numerado.
 * El ícono es un <IconoWala> (nombre guardado en `icon`; los emojis viejos se
 * traducen solos a su ícono).
 */
export function ListaBeneficios({ ajustes = {} }) {
  const items = (ajustes.items || []).filter((i) => i?.text);
  if (!items.length && !ajustes.title) return null;
  return (
    <div className={[s.beneficios, ajustes.imageUrl && s.beneficiosConFoto].filter(Boolean).join(' ')}>
      {ajustes.imageUrl && (
        <div className={s.beneficiosArte}>
          <figure className={s.polaroid}>
            <span className={s.washi} aria-hidden="true" />
            <FotoProducto className={s.polaroidFoto} src={toDirectImageUrl(ajustes.imageUrl)} alt={ajustes.imageAlt || ''} />
            {ajustes.imageAlt && <figcaption>{ajustes.imageAlt}</figcaption>}
          </figure>
          <Destello className={s.arte1} />
          <Destello className={s.arte2} />
          <Corazon className={s.arte3} />
        </div>
      )}
      <div>
        <TituloSeccion titulo={ajustes.title} subtitulo={ajustes.subtitle} antetitulo={ajustes.eyebrow} adorno />
        {items.length > 0 && (
          <ol className={s.beneficiosLista}>
            {items.map((it, k) => <Beneficio key={k} variante="fila" icono={it.icon} texto={it.text} numero={k + 1} />)}
          </ol>
        )}
        {ajustes.quote && (
          <blockquote className={s.cita}>
            <p><Texto>{ajustes.quote}</Texto></p>
            {ajustes.quoteAuthor && <cite>— {ajustes.quoteAuthor}</cite>}
          </blockquote>
        )}
      </div>
    </div>
  );
}

/* ── Ubicación (map_location) ───────────────────────────── */

/** Dirección del mapa: acepta la URL o el <iframe> entero que da Google Maps. Solo http(s). */
export function urlDeMapa(embed) {
  const crudo = String(embed || '').trim();
  const src = crudo.match(/src="([^"]+)"/)?.[1] || crudo;
  return /^https:\/\//i.test(src) ? src : '';
}

/** Sin título ni descripción guardados, los de siempre (como MapLocation). */
export function Ubicacion({ ajustes = {} }) {
  const { title = 'Encuéntranos', description = 'Visita nuestra tienda física', layout = 'mapRight', mapWidth = '50%', mapHeight = '400px' } = ajustes;
  const src = urlDeMapa(ajustes.embedUrl);
  const tituloMapa = useTexto(src ? title || 'Ubicación' : undefined);
  if (!src && !title) return null;
  const apilado = layout === 'mapTop' || layout === 'mapBottom';
  return (
    <div className={[s.mapa, s[layout] || s.mapRight].filter(Boolean).join(' ')} style={{ '--ancho-mapa': apilado ? '100%' : mapWidth, '--alto-mapa': mapHeight }}>
      <div className={s.mapaTexto}>
        <span className={s.mapaSello} aria-hidden="true"><MapPin /></span>
        {ajustes.eyebrow && <p className={s.mapaEtiqueta}><EtiquetaColgante tono="suave"><Texto>{ajustes.eyebrow}</Texto></EtiquetaColgante></p>}
        <TextoCampo ajustes={ajustes} campo="title" como="h2" className={s.mapaTitulo}>{title}</TextoCampo>
        {description && (
          <TextoCampo ajustes={ajustes} campo="description" como="div" className={s.mapaDescripcion}>
            <ul className={s.mapaDatos}>
              {String(description).split(/\n/).filter((l) => l.trim()).map((linea, k) => (
                <li key={k}>{k === 0 ? <MapPin aria-hidden="true" /> : <Clock aria-hidden="true" />}<span><Texto>{linea}</Texto></span></li>
              ))}
            </ul>
          </TextoCampo>
        )}
        <BotonDeAjustes ajustes={ajustes} />
      </div>
      <div className={s.mapaMarco}>
        {src ? (
          <iframe src={src} title={tituloMapa} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
        ) : (
          <span className={s.mapaVacio}><MapPin aria-hidden="true" /> <Texto>Falta el enlace de Google Maps</Texto></span>
        )}
      </div>
    </div>
  );
}

/* ── Navegación de categorías (categories_nav) ──────────── */

/**
 * Burbujas con miniatura. Dos modos, como en la tienda:
 *  - con `onSeleccionar`: filtran el catálogo de la misma página (botones);
 *    la primera es "Todos" (null).
 *  - sin él: enlazan a `?categoria=ID` (o a `url` si la categoría la trae).
 *  - activa: id de la categoría resaltada.
 *  - ajustes.align: 'left' | 'center' | 'right' | 'justify'
 *  - ajustes.animation: 'static' (fila deslizable) | 'slider' (cinta sin fin)
 */
export function NavCategorias({ ajustes: ajustesSeccion = {}, categorias = [], activa = null, onSeleccionar, cargando = false, estilo }) {
  // El estilo de la marca (categoryNavStyle, como en la tienda) manda sobre los de la sección.
  const ajustes = estilo ? { ...ajustesSeccion, ...estilo } : ajustesSeccion;
  const lista = (categorias || []).filter((c) => c?.name);
  const tTodos = useTexto('Todos');
  const tCategorias = useTexto('Categorías');
  if (cargando) {
    return (
      <div className={s.burbujas} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((k) => <TarjetaCategoriaEsqueleto key={k} />)}
      </div>
    );
  }
  if (!lista.length) return null;

  const filtra = typeof onSeleccionar === 'function';
  const burbuja = (c, k) => {
    const id = c.categoryId ?? c.id ?? null;
    return (
      <TarjetaCategoria
        key={`${id}-${k}`}
        forma="burbuja"
        nombre={c.name}
        imagen={c.imageUrl}
        todos={id == null}
        activa={activa === id}
        acento={acento(k - 1)}
        url={filtra ? undefined : c.url || (id ? `?categoria=${encodeURIComponent(id)}` : '?')}
        onClick={filtra ? () => onSeleccionar(id) : undefined}
      />
    );
  };
  const todas = [{ categoryId: null, name: tTodos }, ...lista];

  if (ajustes.animation === 'slider') {
    return (
      <Marquesina segundos={Math.max(18, todas.length * 3)} espacio="1rem" etiqueta="Categorías">
        {todas.map(burbuja)}
      </Marquesina>
    );
  }
  return (
    <nav aria-label={tCategorias} className={[s.burbujas, s[`alinear_${ajustes.align || 'center'}`]].filter(Boolean).join(' ')}>
      {todas.map(burbuja)}
    </nav>
  );
}

/* ── Grilla de productos (featured_products, product_grid) ─ */

/** Observa el final de la lista y pide más antes de llegar (como ProductGrid). */
function useCargarAlLlegar(activo, alLlegar) {
  const marca = useRef(null);
  useEffect(() => {
    const el = marca.current;
    if (!activo || !el) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) alLlegar(); }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [activo, alLlegar]);
  return marca;
}

/**
 * Productos en cuadrícula de alturas parejas.
 *  - productos: productos_wala (se traducen con tarjetaDesdeProducto).
 *  - cargando: muestra esqueletos.
 *  - hayMas / onCargarMas / cargandoMas: paginación de la tienda (cursor).
 *    Sin onCargarMas se muestran de 12 en 12 en memoria.
 *  - vacio: { titulo, texto } cuando no hay nada.
 *  - columnas: { escritorio, celular } fijas (las del admin, storeConfig.layout;
 *    grillaDesdeConfiguracion). Sin ellas, tantas como quepan.
 *  - segundaFoto: la segunda foto al pasar el ratón (true por defecto).
 *  - vacio.accion: { texto, url } → un botón en el estado vacío ("Volver al inicio").
 *  - error + onReintentar: no se pudo cargar (con "Reintentar").
 *  - finDeLista: "Has visto todos los productos" cuando ya no queda nada
 *    por mostrar (con o sin paginación, como ProductGrid).
 *  - tarjeta: la de la tienda; recibe también `indice` (las primeras cargan ya).
 *  - sinKapi: los avisos sin Kapi (la página ya muestra el flotante).
 * Si la lista quedó vacía pero el servidor tiene más (un filtro descartó lo
 * cargado), sigue pidiendo páginas en vez de decir que no hay nada.
 */
export function GrillaProductos({ ajustes = {}, productos = [], catalogo, cargando = false, hayMas, onCargarMas, cargandoMas, onAgregar, vacio, columnas, segundaFoto = true, tarjeta: Tarjeta = TarjetaDeCatalogo, error, onReintentar, finDeLista = true, sinKapi = false }) {
  const servidor = typeof onCargarMas === 'function';
  const [visibles, setVisibles] = useState(12);
  useEffect(() => { if (!servidor) setVisibles(12); }, [productos, servidor]);
  const lista = servidor ? productos : productos.slice(0, visibles);
  const quedan = servidor ? !!hayMas : visibles < productos.length;
  const pedirMas = useMemo(() => () => {
    if (servidor) { if (hayMas && !cargandoMas) onCargarMas(); } else setVisibles((v) => v + 12);
  }, [servidor, hayMas, cargandoMas, onCargarMas]);
  const marca = useCargarAlLlegar(quedan && !cargando, pedirMas);
  // EstadoVacio y Boton traducen lo suyo: les llegan tal cual.
  const tFin = useTexto('Has visto todos los productos');

  if (error && !cargando && !productos.length) {
    return (
      <EstadoVacio imagen={sinKapi ? null : undefined} titulo="No pudimos cargar los productos" texto={typeof error === 'string' ? error : 'Revisa tu conexión e inténtalo de nuevo.'}>
        {onReintentar && <Boton variante="secundario" onClick={onReintentar}>Reintentar</Boton>}
      </EstadoVacio>
    );
  }
  // Vacía pero con más en el servidor: esqueletos y seguir pidiendo.
  const esperandoMas = !cargando && !productos.length && servidor && (hayMas || cargandoMas);
  if (!cargando && !productos.length && !esperandoMas) {
    return vacio ? (
      <EstadoVacio imagen={sinKapi ? null : undefined} titulo={vacio.titulo || 'Próximamente más productos'} texto={vacio.texto}>
        {vacio.accion?.url && <Boton to={vacio.accion.url} variante="secundario"><Texto>{vacio.accion.texto || 'Volver al inicio'}</Texto></Boton>}
      </EstadoVacio>
    ) : null;
  }
  return (
    <>
      <TituloSeccion {...tituloDesdeAjustes(ajustes)} />
      <ul
        className={[s.grilla, Number(columnas?.celular) > 0 && s.colsCelular, Number(columnas?.escritorio) > 0 && s.colsEscritorio].filter(Boolean).join(' ')}
        style={columnas ? { '--cols-celular': Number(columnas.celular) || undefined, '--cols-escritorio': Number(columnas.escritorio) || undefined } : undefined}
      >
        {cargando
          ? Array.from({ length: 8 }, (_, k) => <li key={k}><TarjetaProductoEsqueleto /></li>)
          : lista.map((p, i) => (
            <li key={p.id}><Tarjeta producto={p} catalogo={catalogo} onAgregar={onAgregar} segundaFoto={segundaFoto} indice={i} /></li>
          ))}
        {(cargandoMas || esperandoMas) && Array.from({ length: 4 }, (_, k) => <li key={`m${k}`}><TarjetaProductoEsqueleto /></li>)}
      </ul>
      {quedan && !cargando && (
        <div ref={marca} className={s.cargarMas}>
          <Boton variante="secundario" cargando={cargandoMas} onClick={pedirMas}>Ver más productos</Boton>
        </div>
      )}
      {finDeLista && !quedan && !cargando && !cargandoMas && lista.length > 0 && (
        <p className={s.finLista}>{tFin}</p>
      )}
    </>
  );
}

/* ── Catálogo con filtros (sidebar_catalog) ─────────────── */

const RANGOS_PRECIO = [['', '50', 'Hasta S/ 50'], ['50', '100', 'S/ 50 – 100'], ['100', '', 'Más de S/ 100']];

/**
 * Catálogo: el título del builder arriba; en escritorio los filtros a la
 * izquierda (grupos plegables, pegados al bajar) y en el celular un botón
 * "Filtros" que abre la hoja inferior. Los elegidos quedan como chips.
 *
 *  - grupos: [{ id, titulo, opciones: [{ valor, nombre, cuenta? }], de?(producto) }]
 *    (gruposDeCatalogo los arma desde las listas de la tienda). `de` devuelve
 *    el valor (o valores) del producto para filtrar aquí mismo; sin `de` el
 *    filtrado lo hace la página (paginación en servidor).
 *  - seleccion / onFiltrar(grupoId, valor|null): controlado; sin ellos el
 *    catálogo guarda su propio estado. Una opción por grupo, como la tienda.
 *  - filtrarAqui: filtra en el navegador con `de` (por defecto solo cuando
 *    no es controlado). Con paginación en servidor la página filtra.
 *  - conBuscador: buscador por nombre arriba de la grilla (la tienda solo lo
 *    muestra en la página de una marca). busqueda / onBuscar: controlado.
 *  - buscarAlEscribir: con onBuscar, avisa en cada tecla (como el buscador
 *    de la marca) y no solo al enviar. "Limpiar todo" también borra el texto.
 *  - sinTraducir: ids de grupos cuyos nombres no se traducen (['marca']).
 *  - precio {min, max} / onPrecio: controlado. limitesPrecio {min, max}: lo
 *    que se ve de guía en los campos (sin él se calcula de los productos).
 *  - total: cuántos productos hay (con paginación en servidor); sin él se
 *    cuentan los de la lista. Con `hayMas`, la cuenta lleva "+" ("24+").
 *  - unidad: [singular, plural] de la cuenta (['resultado', 'resultados'] en
 *    la búsqueda; por defecto productos).
 *  - orden: { opciones: [{ valor, texto }], valor, onCambiar, etiqueta } →
 *    "Ordenar por" a la derecha de la barra (la página ordena la lista).
 *  - resto: como GrillaProductos (hayMas, onCargarMas, onAgregar…).
 */
export function CatalogoConFiltros({
  ajustes = {}, productos = [], grupos = [], seleccion, onFiltrar, filtrarAqui = !onFiltrar, conBuscador = true,
  busqueda, onBuscar, buscarAlEscribir = false, precio, onPrecio, limitesPrecio, total, unidad = ['producto', 'productos'], orden,
  sinTraducir = ['marca'], ...grilla
}) {
  const t = {
    filtros: useTexto('Filtros'),
    limpiar: useTexto('Limpiar'),
    limpiarTodo: useTexto('Limpiar todo'),
    unidad: [useTexto(unidad[0]), useTexto(unidad[1])],
    min: useTexto('Precio mínimo'),
    max: useTexto('Precio máximo'),
  };
  // El buscador, el selector, la hoja y la grilla vacía traducen lo suyo: les llega tal cual.
  const [propia, setPropia] = useState({});
  const [textoPropio, setTextoPropio] = useState('');
  const [precioPropio, setPrecioPropio] = useState({ min: '', max: '' });
  const [hoja, setHoja] = useState(false);
  // Sube al tocar "Limpiar todo": el campo de búsqueda vuelve a empezar vacío.
  const [vueltaBuscador, setVueltaBuscador] = useState(0);
  const sel = seleccion ?? propia;
  const texto = busqueda ?? textoPropio;
  const rango = precio ?? precioPropio;

  const elegir = (grupo, valor) => {
    if (onFiltrar) onFiltrar(grupo, valor);
    else setPropia((p) => ({ ...p, [grupo]: valor }));
  };
  const buscar = (t) => (onBuscar ? onBuscar(t) : setTextoPropio(t));
  const cambiarPrecio = (r) => (onPrecio ? onPrecio(r) : setPrecioPropio(r));

  const visibles = useMemo(() => {
    if (!filtrarAqui) return productos;
    const q = texto.trim().toLowerCase();
    const min = Number(rango.min) || 0;
    const max = Number(rango.max) || Infinity;
    return productos.filter((p) => {
      if (q && !String(p.name || '').toLowerCase().includes(q)) return false;
      const pr = precioEfectivo(p);
      if (pr < min || pr > max) return false;
      return grupos.every((g) => {
        const v = sel[g.id];
        if (v == null || !g.de) return true;
        return [].concat(g.de(p) ?? []).includes(v);
      });
    });
  }, [filtrarAqui, productos, texto, rango, grupos, sel]);

  const limites = limitesPrecio || limitesDePrecio(productos);
  const activos = grupos.flatMap((g) => {
    const v = sel[g.id];
    const op = v != null && g.opciones.find((o) => o.valor === v);
    return op ? [{ grupo: g.id, valor: v, nombre: op.nombre }] : [];
  });
  const hayPrecio = rango.min !== '' || rango.max !== '';
  const hayTexto = conBuscador && Boolean(texto.trim());
  const cuantos = activos.length + (hayPrecio ? 1 : 0) + (hayTexto ? 1 : 0);
  const limpiar = () => {
    activos.forEach((a) => elegir(a.grupo, null));
    cambiarPrecio({ min: '', max: '' });
    if (hayTexto) {
      buscar('');
      setVueltaBuscador((n) => n + 1);
    }
  };
  const cantidad = total ?? (filtrarAqui ? visibles.length : null);
  const nombreUnidad = cantidad === 1 ? t.unidad[0] : t.unidad[1];
  // El botón de la hoja: la frase entera en español (Boton la traduce).
  const verCantidad = `Ver ${cantidad}${grilla.hayMas ? '+' : ''} ${cantidad === 1 ? unidad[0] : unidad[1]}`;
  const elegidoEn = (g) => activos.find((a) => a.grupo === g)?.nombre;
  const textoPrecio = `S/ ${rango.min || 0} – ${rango.max || '∞'}`;

  // Abiertos al empezar: el primer grupo y los que ya tienen algo elegido.
  const abiertos = [grupos[0]?.id, ...activos.map((a) => a.grupo), hayPrecio && 'precio'].filter(Boolean);
  const filtros = (
    <div className={s.filtros}>
      <div className={s.filtrosCabeza}>
        <span className={s.filtrosSello} aria-hidden="true"><SlidersHorizontal /></span>
        <strong>{t.filtros}</strong>
        {cuantos > 0 && <button type="button" className={s.limpiar} onClick={limpiar}>{t.limpiar} ({cuantos})</button>}
      </div>
      <Acordeon
        variante="lista"
        multiple
        abiertoInicial={abiertos}
        items={[
          ...grupos.filter((g) => g.opciones?.length).map((g) => ({
            id: g.id,
            question: <Texto>{g.titulo}</Texto>,
            extra: elegidoEn(g.id) && <span className={s.filtroElegido}>{sinTraducir.includes(g.id) ? elegidoEn(g.id) : <Texto>{elegidoEn(g.id)}</Texto>}</span>,
            answer: <OpcionesFiltro opciones={g.opciones} elegida={sel[g.id] ?? null} onElegir={(v) => elegir(g.id, v)} sinTraducir={sinTraducir.includes(g.id)} />,
          })),
          {
            id: 'precio',
            question: 'Precio', // el Acordeon lo traduce
            extra: hayPrecio && <span className={s.filtroElegido}>{textoPrecio}</span>,
            answer: (
              <>
                <div className={s.opciones}>
                  {RANGOS_PRECIO.map(([min, max, nombre]) => {
                    const marcado = rango.min === min && rango.max === max;
                    return (
                      <Chip key={nombre} tamano="sm" activo={marcado} onClick={() => cambiarPrecio(marcado ? { min: '', max: '' } : { min, max })}><Texto>{nombre}</Texto></Chip>
                    );
                  })}
                </div>
                <div className={s.precio}>
                  <Campo type="number" inputMode="numeric" min="0" placeholder={limites ? String(limites.min) : 'Mín.'} aria-label={t.min} icono="S/" value={rango.min} onChange={(e) => cambiarPrecio({ ...rango, min: e.target.value })} />
                  <Campo type="number" inputMode="numeric" min="0" placeholder={limites ? String(limites.max) : 'Máx.'} aria-label={t.max} icono="S/" value={rango.max} onChange={(e) => cambiarPrecio({ ...rango, max: e.target.value })} />
                </div>
              </>
            ),
          },
        ]}
      />
    </div>
  );

  return (
    <>
      <TituloSeccion {...tituloDesdeAjustes(ajustes)} />
      <div className={s.catalogo}>
        <aside className={s.catalogoLado} aria-label={t.filtros}>{filtros}</aside>
        <div className={s.catalogoPrincipal}>
          <div className={s.catalogoBarra}>
            {/* Mientras llegan los primeros, sin cuenta (no "0 resultados" sobre los esqueletos). */}
            {cantidad != null && !grilla.cargando && (
              <p className={s.catalogoCuenta} role="status">
                <strong>{cantidad}{grilla.hayMas ? '+' : ''}</strong> {nombreUnidad}
              </p>
            )}
            {conBuscador && (
              <Buscador
                // key: "Limpiar todo" borra el texto también en el campo.
                key={vueltaBuscador}
                placeholder="Buscar en el catálogo"
                atajo={null}
                defaultValue={texto}
                onBuscar={buscar}
                onChange={onBuscar ? (buscarAlEscribir ? (e) => onBuscar(e.target.value) : undefined) : (e) => setTextoPropio(e.target.value)}
                className={s.catalogoBuscador}
              />
            )}
            {orden?.opciones?.length > 0 && (
              <Selector className={s.catalogoOrden} etiqueta={orden.etiqueta ?? 'Ordenar por'} opciones={orden.opciones} valor={orden.valor} onCambiar={orden.onCambiar} />
            )}
            <Boton variante="contorno" className={s.botonFiltros} icono={<SlidersHorizontal aria-hidden="true" />} onClick={() => setHoja(true)}>
              {t.filtros}{cuantos ? ` (${cuantos})` : ''}
            </Boton>
          </div>
          {cuantos > 0 && (
            <div className={s.chips}>
              {activos.map((a) => (
                <Chip key={`${a.grupo}-${a.valor}`} tamano="sm" onQuitar={() => elegir(a.grupo, null)}>{sinTraducir.includes(a.grupo) ? a.nombre : <Texto>{a.nombre}</Texto>}</Chip>
              ))}
              {hayPrecio && <Chip tamano="sm" onQuitar={() => cambiarPrecio({ min: '', max: '' })}>{textoPrecio}</Chip>}
              <button type="button" className={s.limpiar} onClick={limpiar}>{t.limpiarTodo}</button>
            </div>
          )}
          <GrillaProductos {...grilla} productos={visibles} vacio={grilla.vacio || { titulo: 'Nada coincide con tu búsqueda', texto: 'Prueba con otros filtros o quítalos.' }} />
        </div>
        <HojaInferior
          abierta={hoja}
          onCerrar={() => setHoja(false)}
          titulo="Filtros"
          pie={<Boton bloque onClick={() => setHoja(false)}>{cantidad != null ? verCantidad : 'Ver productos'}</Boton>}
        >
          <div className={s.filtrosEnHoja}>{filtros}</div>
        </HojaInferior>
      </div>
    </>
  );
}

// El pie de página (footer_columns) vive en piezas/Pie.jsx.
