import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, MapPin, SlidersHorizontal, MessageCircle, Music2, Mail } from 'lucide-react';
import Boton from './Boton';
import Marquesina from './Marquesina';
import Acordeon from './Acordeon';
import TarjetaProducto, { TarjetaProductoEsqueleto } from './TarjetaProducto';
import { Enlace } from './Enlace';
import { Buscador, Campo } from './Formulario';
import { Chip } from './Etiquetas';
import { EstadoVacio, HojaInferior } from './Feedback';
import { TituloSeccion, tituloDesdeAjustes } from './Seccion';
import { tarjetaDesdeProducto, precioEfectivo, limitesDePrecio } from './adaptadores';
import { TextoCampo, BotonDeAjustes, fuenteDe, prefiereQuieto } from './SeccionesContenido';
import { toDirectImageUrl } from '../../utils/imageUrl';
import { EtiquetaColgante, Garabatos, LogoWala, Destello, Corazon, acento } from './Marca';
import { TarjetaCategoria, TarjetaCategoriaEsqueleto, Beneficio, FotoProducto, OpcionesFiltro } from './piezas';
import s from './SeccionesExtra.module.css';

/*
 * Resto de secciones del builder: banner principal, beneficios, mapa,
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
            src={toDirectImageUrl(mediaUrl)}
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
        {ajustes.eyebrow && <EtiquetaColgante tono="blanco" tamano="lg">{ajustes.eyebrow}</EtiquetaColgante>}
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
            {buttonText}
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
            <p>{ajustes.quote}</p>
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

export function Ubicacion({ ajustes = {} }) {
  const { title, description, layout = 'mapRight', mapWidth = '50%', mapHeight = '400px' } = ajustes;
  const src = urlDeMapa(ajustes.embedUrl);
  if (!src && !title) return null;
  const apilado = layout === 'mapTop' || layout === 'mapBottom';
  return (
    <div className={[s.mapa, s[layout] || s.mapRight].filter(Boolean).join(' ')} style={{ '--ancho-mapa': apilado ? '100%' : mapWidth, '--alto-mapa': mapHeight }}>
      <div className={s.mapaTexto}>
        <span className={s.mapaSello} aria-hidden="true"><MapPin /></span>
        {ajustes.eyebrow && <p className={s.mapaEtiqueta}><EtiquetaColgante tono="suave">{ajustes.eyebrow}</EtiquetaColgante></p>}
        <TextoCampo ajustes={ajustes} campo="title" como="h2" className={s.mapaTitulo}>{title}</TextoCampo>
        {description && (
          <TextoCampo ajustes={ajustes} campo="description" como="div" className={s.mapaDescripcion}>
            <ul className={s.mapaDatos}>
              {String(description).split(/\n/).filter((l) => l.trim()).map((linea, k) => (
                <li key={k}>{k === 0 ? <MapPin aria-hidden="true" /> : <Clock aria-hidden="true" />}<span>{linea}</span></li>
              ))}
            </ul>
          </TextoCampo>
        )}
        <BotonDeAjustes ajustes={ajustes} />
      </div>
      <div className={s.mapaMarco}>
        {src ? (
          <iframe src={src} title={title || 'Ubicación'} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
        ) : (
          <span className={s.mapaVacio}><MapPin aria-hidden="true" /> Falta el enlace de Google Maps</span>
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
export function NavCategorias({ ajustes = {}, categorias = [], activa = null, onSeleccionar, cargando = false }) {
  const lista = (categorias || []).filter((c) => c?.name);
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
  const todas = [{ categoryId: null, name: 'Todos' }, ...lista];

  if (ajustes.animation === 'slider') {
    return (
      <Marquesina segundos={Math.max(18, todas.length * 3)} espacio="1rem" etiqueta="Categorías">
        {todas.map(burbuja)}
      </Marquesina>
    );
  }
  return (
    <nav aria-label="Categorías" className={[s.burbujas, s[`alinear_${ajustes.align || 'center'}`]].filter(Boolean).join(' ')}>
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
 */
export function GrillaProductos({ ajustes = {}, productos = [], catalogo, cargando = false, hayMas, onCargarMas, cargandoMas, onAgregar, vacio, columnas, segundaFoto = true }) {
  const servidor = typeof onCargarMas === 'function';
  const [visibles, setVisibles] = useState(12);
  useEffect(() => { if (!servidor) setVisibles(12); }, [productos, servidor]);
  const lista = servidor ? productos : productos.slice(0, visibles);
  const quedan = servidor ? !!hayMas : visibles < productos.length;
  const pedirMas = useMemo(() => () => {
    if (servidor) { if (hayMas && !cargandoMas) onCargarMas(); } else setVisibles((v) => v + 12);
  }, [servidor, hayMas, cargandoMas, onCargarMas]);
  const marca = useCargarAlLlegar(quedan && !cargando, pedirMas);

  if (!cargando && !productos.length) {
    return vacio ? <EstadoVacio titulo={vacio.titulo || 'Próximamente más productos'} texto={vacio.texto} /> : null;
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
          : lista.map((p) => (
            <li key={p.id}><TarjetaProducto {...tarjetaDesdeProducto(p, { catalogo })} {...(segundaFoto ? {} : { imagenHover: undefined })} onAgregar={onAgregar?.(p)} /></li>
          ))}
        {cargandoMas && Array.from({ length: 4 }, (_, k) => <li key={`m${k}`}><TarjetaProductoEsqueleto /></li>)}
      </ul>
      {quedan && !cargando && (
        <div ref={marca} className={s.cargarMas}>
          <Boton variante="secundario" cargando={cargandoMas} onClick={pedirMas}>Ver más productos</Boton>
        </div>
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
 *  - precio {min, max} / onPrecio: controlado. limitesPrecio {min, max}: lo
 *    que se ve de guía en los campos (sin él se calcula de los productos).
 *  - total: cuántos productos hay (con paginación en servidor); sin él se
 *    cuentan los de la lista.
 *  - resto: como GrillaProductos (hayMas, onCargarMas, onAgregar…).
 */
export function CatalogoConFiltros({
  ajustes = {}, productos = [], grupos = [], seleccion, onFiltrar, filtrarAqui = !onFiltrar, conBuscador = true,
  busqueda, onBuscar, precio, onPrecio, limitesPrecio, total, ...grilla
}) {
  const [propia, setPropia] = useState({});
  const [textoPropio, setTextoPropio] = useState('');
  const [precioPropio, setPrecioPropio] = useState({ min: '', max: '' });
  const [hoja, setHoja] = useState(false);
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
  const cuantos = activos.length + (hayPrecio ? 1 : 0);
  const limpiar = () => {
    activos.forEach((a) => elegir(a.grupo, null));
    cambiarPrecio({ min: '', max: '' });
  };
  const cantidad = total ?? (filtrarAqui ? visibles.length : null);
  const textoCantidad = cantidad === 1 ? '1 producto' : `${cantidad} productos`;
  const elegidoEn = (g) => activos.find((a) => a.grupo === g)?.nombre;
  const textoPrecio = `S/ ${rango.min || 0} – ${rango.max || '∞'}`;

  // Abiertos al empezar: el primer grupo y los que ya tienen algo elegido.
  const abiertos = [grupos[0]?.id, ...activos.map((a) => a.grupo), hayPrecio && 'precio'].filter(Boolean);
  const filtros = (
    <div className={s.filtros}>
      <div className={s.filtrosCabeza}>
        <span className={s.filtrosSello} aria-hidden="true"><SlidersHorizontal /></span>
        <strong>Filtros</strong>
        {cuantos > 0 && <button type="button" className={s.limpiar} onClick={limpiar}>Limpiar ({cuantos})</button>}
      </div>
      <Acordeon
        variante="lista"
        multiple
        abiertoInicial={abiertos}
        items={[
          ...grupos.filter((g) => g.opciones?.length).map((g) => ({
            id: g.id,
            question: g.titulo,
            extra: elegidoEn(g.id) && <span className={s.filtroElegido}>{elegidoEn(g.id)}</span>,
            answer: <OpcionesFiltro opciones={g.opciones} elegida={sel[g.id] ?? null} onElegir={(v) => elegir(g.id, v)} />,
          })),
          {
            id: 'precio',
            question: 'Precio',
            extra: hayPrecio && <span className={s.filtroElegido}>{textoPrecio}</span>,
            answer: (
              <>
                <div className={s.opciones}>
                  {RANGOS_PRECIO.map(([min, max, nombre]) => {
                    const marcado = rango.min === min && rango.max === max;
                    return (
                      <Chip key={nombre} tamano="sm" activo={marcado} onClick={() => cambiarPrecio(marcado ? { min: '', max: '' } : { min, max })}>{nombre}</Chip>
                    );
                  })}
                </div>
                <div className={s.precio}>
                  <Campo type="number" inputMode="numeric" min="0" placeholder={limites ? String(limites.min) : 'Mín.'} aria-label="Precio mínimo" icono="S/" value={rango.min} onChange={(e) => cambiarPrecio({ ...rango, min: e.target.value })} />
                  <Campo type="number" inputMode="numeric" min="0" placeholder={limites ? String(limites.max) : 'Máx.'} aria-label="Precio máximo" icono="S/" value={rango.max} onChange={(e) => cambiarPrecio({ ...rango, max: e.target.value })} />
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
        <aside className={s.catalogoLado} aria-label="Filtros">{filtros}</aside>
        <div className={s.catalogoPrincipal}>
          <div className={s.catalogoBarra}>
            {cantidad != null && (
              <p className={s.catalogoCuenta} role="status">
                <strong>{cantidad}</strong> {cantidad === 1 ? 'producto' : 'productos'}
              </p>
            )}
            {conBuscador && (
              <Buscador placeholder="Buscar en el catálogo" atajo={null} defaultValue={texto} onBuscar={buscar} onChange={onBuscar ? undefined : (e) => setTextoPropio(e.target.value)} className={s.catalogoBuscador} />
            )}
            <Boton variante="contorno" className={s.botonFiltros} icono={<SlidersHorizontal aria-hidden="true" />} onClick={() => setHoja(true)}>
              Filtros{cuantos ? ` (${cuantos})` : ''}
            </Boton>
          </div>
          {cuantos > 0 && (
            <div className={s.chips}>
              {activos.map((a) => (
                <Chip key={`${a.grupo}-${a.valor}`} tamano="sm" onQuitar={() => elegir(a.grupo, null)}>{a.nombre}</Chip>
              ))}
              {hayPrecio && <Chip tamano="sm" onQuitar={() => cambiarPrecio({ min: '', max: '' })}>{textoPrecio}</Chip>}
              <button type="button" className={s.limpiar} onClick={limpiar}>Limpiar todo</button>
            </div>
          )}
          <GrillaProductos {...grilla} productos={visibles} vacio={grilla.vacio || { titulo: 'Nada coincide con tu búsqueda', texto: 'Prueba con otros filtros o quítalos.' }} />
        </div>
        <HojaInferior
          abierta={hoja}
          onCerrar={() => setHoja(false)}
          titulo="Filtros"
          pie={<Boton bloque onClick={() => setHoja(false)}>{cantidad != null ? `Ver ${textoCantidad}` : 'Ver productos'}</Boton>}
        >
          <div className={s.filtrosEnHoja}>{filtros}</div>
        </HojaInferior>
      </div>
    </>
  );
}

/* ── Pie de página (footer_columns) ─────────────────────── */

/* Íconos de redes dibujados a trazo (lucide ya no trae marcas). */
const trazo = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const Instagram = (p) => <svg {...trazo} {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></svg>;
const Facebook = (p) => <svg {...trazo} {...p}><path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" /></svg>;
const Youtube = (p) => <svg {...trazo} {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="m10 9.5 4.5 2.5-4.5 2.5z" fill="currentColor" /></svg>;

const REDES = [
  [/instagram\./i, Instagram, 'Instagram'],
  [/facebook\.|fb\.com/i, Facebook, 'Facebook'],
  [/tiktok\./i, Music2, 'TikTok'],
  [/youtube\.|youtu\.be/i, Youtube, 'YouTube'],
  [/wa\.me|whatsapp/i, MessageCircle, 'WhatsApp'],
  [/^mailto:/i, Mail, 'Correo'],
];
const redDe = (url) => REDES.find(([re]) => re.test(url || '')) || [null, null, null];

/**
 * Columnas del pie: `type` 'text' (content), 'links' (links: [{ text, url,
 * color, bold }]) o 'social' (links con íconos según la red).
 *  - kapi: Kapi asomado por el borde (la página lo apaga si justo arriba ya
 *    hay otro Kapi, p. ej. la tarjeta de ayuda de Preguntas frecuentes)
 */
export function PiePagina({ ajustes = {}, pieLegal, kapi = true }) {
  const columnas = (ajustes.columns || []).filter((c) => c?.title || c?.content || c?.links?.length);
  if (!columnas.length) return null;
  return (
    <footer className={s.pie}>
      <Garabatos variante="pie" />
      {kapi && <img className={s.pieKapi} src="/assets/kapi/kapi-happy.webp" alt="" width="96" height="96" loading="lazy" decoding="async" />}
      <div className={s.pieMarca}>
        <LogoWala tamano={34} tono="blanco" />
        <EtiquetaColgante tono="magenta" tamano="sm">Hecho con amor en Perú</EtiquetaColgante>
      </div>
      <div className={s.pieColumnas}>
        {columnas.map((c, i) => (
          <div key={c.id || i} className={s.pieColumna}>
            {c.title && <h3>{c.title}</h3>}
            {c.type === 'text' && c.content && <p>{c.content}</p>}
            {c.type === 'links' && (
              <ul>
                {(c.links || []).filter((l) => l?.text).map((l, j) => (
                  <li key={j}>
                    <Enlace to={l.url} className={s.pieEnlace} style={{ color: l.color || undefined, fontWeight: l.bold ? 700 : undefined }}>{l.text}</Enlace>
                  </li>
                ))}
              </ul>
            )}
            {c.type === 'social' && (
              <ul className={s.redes}>
                {(c.links || []).filter((l) => l?.url).map((l, j) => {
                  const [, Icono, red] = redDe(l.url);
                  return (
                    <li key={j}>
                      <Enlace to={l.url} className={s.red} aria-label={l.text || red || l.url}>
                        {Icono ? <Icono aria-hidden="true" /> : (l.text || l.url)}
                      </Enlace>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
      {pieLegal && <div className={s.pieLegal}>{pieLegal}</div>}
    </footer>
  );
}
