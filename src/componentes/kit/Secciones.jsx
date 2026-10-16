import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Boton from './Boton';
import Carrusel from './Carrusel';
import Marquesina from './Marquesina';
import CuentaRegresiva from './CuentaRegresiva';
import Acordeon from './Acordeon';
import { TarjetaDeCatalogo } from './TarjetaProducto';
import { Enlace } from './Enlace';
import { testimonioDesdeAjuste } from './adaptadores';
import { BloqueSeccion, TituloSeccion, tituloDesdeAjustes } from './Seccion';
import { EtiquetaColgante, Destello, acento } from './Marca';
import { IconoWala, iconoDesde } from './IconosWala';
import { Beneficio, TarjetaTestimonio, LogoMarca, TarjetaCategoria, StockBajo, TarjetaAyuda } from './piezas';
import { Encabezado, BloqueTexto, BloqueImagen, BloqueVideo, MosaicoBanners, FilaDestacados } from './SeccionesContenido';
import { BannerPrincipal, ListaBeneficios, Ubicacion, NavCategorias, GrillaProductos, CatalogoConFiltros, PiePagina } from './SeccionesExtra';
import s from './Secciones.module.css';

/*
 * Secciones del builder hechas con piezas del kit. Cada una recibe
 * `ajustes` = el `settings` que ya guarda Firestore (pages/{pageId}), con
 * los mismos nombres de campo (ver getDefaultSettings en
 * src/pages/Tienda/services/storefront.js). Los datos que vienen de
 * consultas (productos, categorías) entran aparte, ya traducidos.
 */

/* ── Barra de anuncios (announcement_bar) ───────────────── */

/** Separa un emoji del inicio del texto ("⚡ Ofertas…" → ⚡ + "Ofertas…"). */
const EMOJI_INICIAL = /^(\p{Extended_Pictographic}️?)\s*/u;
function separarIcono(texto = '') {
  const m = String(texto).match(EMOJI_INICIAL);
  return m ? { emoji: m[1], texto: String(texto).slice(m[0].length) } : { emoji: null, texto: String(texto) };
}

/** textAlign de cada mensaje (editor) → dónde queda en la barra. */
const ALINEAR_ANUNCIO = { left: 'flex-start', center: 'center', right: 'flex-end' };

/** Un mensaje: ícono de Walá (o imagen), texto con su estilo y "Ver →" si lleva enlace. */
function MensajeAnuncio({ m, acento, oculto = false }) {
  const { emoji, texto } = separarIcono(m.text);
  const icono = m.icon || (emoji && iconoDesde(emoji));
  const estilo = {
    fontFamily: m.fontFamily || undefined,
    fontSize: m.fontSize || undefined,
    fontWeight: m.bold ? 800 : undefined,
    fontStyle: m.italic ? 'italic' : undefined,
    textDecoration: m.underline ? 'underline' : undefined,
    background: m.textBg || undefined,
    padding: m.textBg ? '0.1em 0.4em' : undefined,
    borderRadius: m.textBg ? '6px' : undefined,
  };
  const cuerpo = (
    <>
      {m.imageUrl ? <img src={m.imageUrl} alt="" className={s.anuncioImagen} />
        : icono ? <IconoWala nombre={icono} tamano={24} sticker={false} className={s.anuncioIcono} />
          : emoji ? <span aria-hidden="true">{emoji}</span>
            : acento ? <Destello className={s.anuncioDestello} /> : null}
      <span className={s.anuncioTexto} style={estilo}>{texto}</span>
      {m.link && <span className={s.anuncioCta}>Ver <ArrowRight aria-hidden="true" /></span>}
    </>
  );
  return m.link
    ? <Enlace to={m.link} className={s.anuncio} tabIndex={oculto ? -1 : undefined}>{cuerpo}</Enlace>
    : <span className={s.anuncio}>{cuerpo}</span>;
}

/**
 * Barra de anuncios. Mismos campos que el builder:
 *  - variant: 'soft' (por defecto) | 'solid' | 'dark'; bgColor es el color de
 *    la barra (sólida) o su acento (suave y oscura); textColor, el texto en sólida.
 *  - density: 'compact' | 'comfortable'; showAccent: destello si no hay ícono.
 *  - animationType: 'fade' (uno a la vez: flechas, deslizar y puntos) | 'scroll' (cinta).
 *  - messages: [{ text, link, icon, imageUrl, fontFamily, fontSize, bold, italic, underline, textBg, textAlign }]
 *  - speed (ms): cada cuánto cambia (fade) o lo que tarda una vuelta (cinta).
 */
export function BarraAnuncios({ ajustes = {} }) {
  const {
    messages = [], speed = 4000, bgColor = '#7c3aed', textColor = '#ffffff', animationType = 'fade',
    variant = 'soft', density = 'compact', showAccent = true,
  } = ajustes;
  const mensajes = messages.filter((m) => m?.text);
  const [estado, setEstado] = useState({ i: 0, previo: null, dir: 1 });
  const pausa = useRef(false);
  const toque = useRef(null);
  const pila = useRef(null);
  const ultimo = useRef(0);
  const total = mensajes.length;
  const i = estado.i % Math.max(1, total);
  const intervalo = Math.max(2500, speed);
  // Cinta: speed (ms) es lo que tarda una vuelta, como en la tienda, pero sin
  // bajar de 4 s por mensaje para que se alcance a leer.
  const segundosCinta = Math.max(total * 4, (Number(speed) || 0) / 1000);

  const ir = (paso) => setEstado((e) => ({ i: (e.i + paso + total) % total, previo: e.i, dir: paso }));

  useEffect(() => {
    if (animationType !== 'fade' || total < 2) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(() => {
      // Tras tocar o deslizar, espera un ciclo entero para no pisar al usuario.
      if (pausa.current || document.hidden || Date.now() - ultimo.current < intervalo) return;
      ir(1);
    }, intervalo);
    return () => window.clearInterval(id);
  }, [animationType, total, intervalo]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Deslizar con el dedo: el mensaje sigue al dedo; al soltar pasa o vuelve. */
  const moverPila = (dx, conTransicion) => {
    const el = pila.current;
    if (!el) return;
    el.style.transition = conTransicion ? '' : 'none';
    el.style.transform = dx ? `translateX(${dx}px)` : '';
  };
  const alTocar = (e) => {
    toque.current = e.touches[0]?.clientX ?? null;
    pausa.current = true;
  };
  const alMover = (e) => {
    if (toque.current == null || total < 2) return;
    const dx = (e.touches[0]?.clientX ?? toque.current) - toque.current;
    moverPila(Math.max(-80, Math.min(80, dx * 0.6)), false);
  };
  const alSoltar = (e) => {
    pausa.current = false;
    ultimo.current = Date.now();
    if (toque.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? toque.current) - toque.current;
    toque.current = null;
    moverPila(0, true);
    if (total > 1 && Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
  };
  /** Posición de cada mensaje: el actual al centro, el que sale hacia su lado. */
  const posicion = (k) => {
    if (k === i) return 'activo';
    if (k === estado.previo) return estado.dir > 0 ? 'antes' : 'despues';
    return estado.dir > 0 ? 'despues' : 'antes';
  };

  if (!total) return null;
  const clase = [s.anuncios, s[`anuncio_${variant}`] || s.anuncio_soft, density === 'comfortable' && s.anuncioComodo].filter(Boolean).join(' ');

  return (
    <div
      className={clase}
      style={{ '--anuncio-color': bgColor, '--anuncio-texto': textColor }}
      role="region"
      aria-label="Anuncios"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') pausa.current = true; }}
      onPointerLeave={() => { pausa.current = false; }}
    >
      {animationType === 'scroll' ? (
        <Marquesina segundos={segundosCinta} espacio="0px" etiqueta="Anuncios">
          {mensajes.map((m, k) => (
            <span key={k} className={s.anuncioTramo}>
              <MensajeAnuncio m={m} acento={false} />
              <Destello className={s.anuncioSeparador} />
            </span>
          ))}
        </Marquesina>
      ) : (
        <div
          className={[s.anuncioFijo, total > 1 && s.anuncioConControles].filter(Boolean).join(' ')}
          onTouchStart={alTocar}
          onTouchMove={alMover}
          onTouchEnd={alSoltar}
          onTouchCancel={alSoltar}
        >
          {/* Todos los mensajes en la misma celda: la barra mide lo que el
              más largo y no salta de alto al cambiar. */}
          <div ref={pila} className={s.anuncioPila} aria-live="polite">
            {mensajes.map((m, k) => (
              <div key={k} className={s.anuncioItem} data-pos={posicion(k)} aria-hidden={k !== i || undefined} style={{ justifyContent: ALINEAR_ANUNCIO[m.textAlign] }}>
                <MensajeAnuncio m={m} acento={showAccent} oculto={k !== i} />
              </div>
            ))}
          </div>
          {total > 1 && (
            <div className={s.anuncioControles}>
              <button type="button" className={s.anuncioFlecha} onClick={() => ir(-1)} aria-label="Anuncio anterior">
                <ChevronLeft aria-hidden="true" />
              </button>
              <span className={s.anuncioPuntos} aria-hidden="true">
                {mensajes.map((_, k) => <span key={k} className={k === i ? s.anuncioPuntoActivo : undefined} />)}
              </span>
              <button type="button" className={s.anuncioFlecha} onClick={() => ir(1)} aria-label="Anuncio siguiente">
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Carrusel principal (hero_carousel) ─────────────────── */
export function HeroCarrusel({ ajustes = {} }) {
  const {
    slides = [], autoPlay = true, autoPlaySpeed = 5000, showArrows = true, showDots = true, pauseOnHover = true,
    heightDesktop = '450px', heightMobile = '350px', borderRadius = '16px',
  } = ajustes;
  const diapos = slides.filter((d) => d.imageUrl);
  if (!diapos.length) return null;

  return (
    <div className={s.hero} style={{ '--alto-escritorio': heightDesktop, '--alto-movil': heightMobile, '--radio': borderRadius }}>
      <Carrusel
        visibles={{ escritorio: 1, tablet: 1, movil: 1 }}
        espacio="0px"
        flechas={showArrows}
        puntos={showDots}
        autoplay={autoPlay ? autoPlaySpeed : 0}
        pausarConRaton={pauseOnHover !== false}
        variante="hero"
        etiqueta="Destacados"
      >
        {diapos.map((d, k) => {
          const pos = { left: 'flex-start', center: 'center', right: 'flex-end' }[d.contentPosition] || 'flex-start';
          const vert = { top: 'flex-start', center: 'center', bottom: 'flex-end' }[d.verticalPosition] || 'center';
          const contenido = (
            <>
              <picture>
                {d.mobileImageUrl && <source media="(max-width: 640px)" srcSet={d.mobileImageUrl} />}
                <img src={d.imageUrl} alt={d.alt || d.title || ''} loading={k === 0 ? 'eager' : 'lazy'} style={{ objectPosition: d.imagePosition || 'center' }} />
              </picture>
              <span className={s.heroVelo} style={{ background: d.overlayColor || '#111827', opacity: (d.overlayOpacity ?? 20) / 100 }} />
              {(d.title || d.subtitle || d.buttonText) && (
                <div className={s.heroTexto} style={{ alignItems: pos, justifyContent: vert, textAlign: d.contentPosition === 'center' ? 'center' : d.contentPosition === 'right' ? 'right' : 'left' }}>
                  {d.title && <h2 style={{ color: d.titleColor || '#fff' }}>{d.title}</h2>}
                  {d.subtitle && <p style={{ color: d.subtitleColor || '#fff' }}>{d.subtitle}</p>}
                  {d.buttonText && (
                    <Boton to={d.buttonLink || d.link} tamano="lg" variante="contorno" className={s.heroBoton} style={{ '--b-fondo': d.buttonBgColor || '#fff', '--b-fondo-hover': d.buttonBgColor || '#fff', '--b-texto': d.buttonTextColor || '#111827', '--b-borde': 'transparent' }}>
                      {d.buttonText}
                    </Boton>
                  )}
                </div>
              )}
            </>
          );
          return d.link && !d.buttonText
            ? <Enlace key={k} to={d.link} className={s.heroDiapo}>{contenido}</Enlace>
            : <div key={k} className={s.heroDiapo}>{contenido}</div>;
        })}
      </Carrusel>
    </div>
  );
}

/* ── Íconos de confianza (trust_badges) ─────────────────── */

export function InsigniasConfianza({ ajustes = {} }) {
  const badges = (ajustes.badges || []).filter((b) => b?.text);
  if (!badges.length) return null;
  return (
    <ul className={s.insignias}>
      {badges.map((b, k) => <Beneficio key={k} icono={b.icon} texto={b.text} />)}
    </ul>
  );
}

/* ── Carrusel de productos (featured / new_arrivals / sale / category / collection) ── */

/* Sin título guardado, el de la tienda vieja para estos tipos. */
const TITULOS_POR_TIPO = { new_arrivals_carousel: 'Novedades', sale_carousel: 'Ofertas' };

/**
 *  - tipo: el `type` de la sección (para el título por defecto)
 *  - tarjeta: la tarjeta de cada producto (por defecto, la del kit)
 */
export function CarruselProductos({ ajustes = {}, productos = [], catalogo, onAgregar, tipo, tarjeta: Tarjeta = TarjetaDeCatalogo }) {
  if (!productos.length) return null;
  // 1 a 8 a la vista, como en la tienda.
  const visibles = Math.min(8, Math.max(1, Number(ajustes.visibleItems) || 5));
  const titulo = ajustes.title || TITULOS_POR_TIPO[tipo];
  return (
    <>
      <TituloSeccion {...tituloDesdeAjustes({ ...ajustes, title: titulo })} />
      <Carrusel
        visibles={{ escritorio: visibles, tablet: Math.min(3, visibles), movil: visibles === 1 ? 1.1 : 2.15 }}
        espacio="0.85rem"
        autoplay={ajustes.autoPlay ? ajustes.autoPlaySpeed || 5000 : 0}
        etiqueta={titulo || 'Productos'}
      >
        {productos.map((p) => (
          <Tarjeta key={p.id} producto={p} catalogo={catalogo} onAgregar={onAgregar} />
        ))}
      </Carrusel>
    </>
  );
}

/* ── Ofertas flash (flash_sales) ────────────────────────── */

/** Mayor descuento entre los productos (para "Hasta -31%"). */
const mayorDescuento = (productos) => productos.reduce((max, p) => {
  const antes = Number(p.price) || 0;
  const ahora = Number(p.salePrice) || 0;
  return antes > 0 && ahora > 0 && ahora < antes ? Math.max(max, Math.round((1 - ahora / antes) * 100)) : max;
}, 0);

/**
 * Ofertas relámpago: un evento dentro de la página. Panel en la noche violeta
 * de Walá (en claro y en noche), rayo en sticker, etiqueta "Hasta -X%",
 * cuenta regresiva grande y, bajo cada producto, cuántos quedan.
 */
export function OfertaRelampago({ ajustes = {}, productos = [], catalogo, onAgregar, tarjeta: Tarjeta = TarjetaDeCatalogo }) {
  const [terminada, setTerminada] = useState(false);
  if (!productos.length || terminada) return null;
  const lista = productos.slice(0, 8);
  const hasta = mayorDescuento(lista);
  return (
    <div className={s.flash}>
      <span className={s.flashFranjas} aria-hidden="true" />
      <Destello className={s.flashChispa1} />
      <Destello className={s.flashChispa2} />
      <div className={s.flashCabeza}>
        <div className={s.flashTituloCaja}>
          <IconoWala nombre="rayo" tamano={58} girar={-10} className={s.flashRayo} />
          <div>
            {(ajustes.eyebrow || hasta > 0) && (
              <p className={s.flashEtiqueta}>
                <EtiquetaColgante tono="rojo">{ajustes.eyebrow || `Hasta -${hasta}%`}</EtiquetaColgante>
              </p>
            )}
            <h2 className={s.flashTitulo}>{ajustes.title || 'Ofertas relámpago'}</h2>
            {ajustes.subtitle && <p className={s.flashSubtitulo}>{ajustes.subtitle}</p>}
          </div>
        </div>
        <div className={s.flashReloj}>
          <span className={s.flashTermina}>Termina en</span>
          <CuentaRegresiva hasta={ajustes.endTime} variante="evento" etiqueta="Termina en" onTerminar={() => setTerminada(true)} />
        </div>
      </div>
      <Carrusel visibles={{ escritorio: 4, tablet: 3, movil: 2.15 }} espacio="0.85rem" etiqueta={ajustes.title || 'Ofertas'}>
        {lista.map((p) => (
          <div key={p.id} className={s.flashItem}>
            <Tarjeta producto={p} catalogo={catalogo} onAgregar={onAgregar} />
            <StockBajo stock={p.inStock} />
          </div>
        ))}
      </Carrusel>
      {ajustes.buttonText && ajustes.buttonLink && (
        <div className={s.flashPie}>
          <Boton to={ajustes.buttonLink} variante="contorno" style={{ '--b-fondo': '#fff', '--b-fondo-hover': '#fff', '--b-texto': '#14121c', '--b-borde': 'transparent' }}>{ajustes.buttonText}</Boton>
        </div>
      )}
    </div>
  );
}

/* ── Testimonios (testimonials) ─────────────────────────── */
export function Testimonios({ ajustes = {} }) {
  const lista = (ajustes.testimonials || []).filter((t) => t?.text);
  if (!lista.length) return null;
  return (
    <>
      <TituloSeccion {...tituloDesdeAjustes(ajustes)} adorno />
      <Carrusel visibles={{ escritorio: 3, tablet: 2, movil: 1.1 }} espacio="1rem" etiqueta="Opiniones de clientes">
        {lista.map((t, k) => (
          <TarjetaTestimonio key={k} {...testimonioDesdeAjuste(t)} giro={[-0.8, 0.6, -0.4, 0.9][k % 4]} />
        ))}
      </Carrusel>
    </>
  );
}

/* ── Preguntas frecuentes (faq_accordion) ───────────────── */
/**
 * Preguntas en acordeón y, al lado (o debajo en el celular), la tarjeta de
 * ayuda con Kapi.
 *  - contacto: URL para "Escríbenos" (en la tienda, el WhatsApp de la zona;
 *    llega por propsPara). Sin ella la tarjeta no lleva botón.
 */
export function PreguntasFrecuentes({ ajustes = {}, contacto, sinKapi = false }) {
  const items = (ajustes.items || []).filter((i) => i?.question);
  if (!items.length) return null;
  const dividido = (ajustes.layout || 'split') === 'split';
  return (
    <div className={dividido ? s.faqDividido : s.faqApilado}>
      <div className={s.faqTitulo}>
        <TituloSeccion {...tituloDesdeAjustes(ajustes)} alinear={dividido ? 'left' : ajustes.titleAlign || 'left'} />
      </div>
      <div className={s.faqPreguntas}>
        <Acordeon items={items} abiertoInicial={ajustes.defaultOpen ? true : false} />
      </div>
      <div className={s.faqAyuda}>
        <TarjetaAyuda
          texto="Kapi y el equipo te responden rapidito."
          accion={contacto ? { texto: 'Escríbenos', url: contacto } : undefined}
          imagen={sinKapi ? null : undefined}
        />
      </div>
    </div>
  );
}

/* ── Marcas en movimiento (marquee) ─────────────────────── */

/**
 * Logos en una cinta sin fin. Cada logo es un sticker con la forma, el zoom
 * y el encuadre que se eligen en el editor, y su nombre debajo.
 * `speed` viene en milisegundos (el editor guarda segundos × 1000).
 */
export function MarcasMarquesina({ ajustes = {} }) {
  const items = (ajustes.items || []).filter((m) => m?.imageUrl || m?.name);
  if (!items.length) return null;
  const velocidad = Number(ajustes.speed) || 30000;
  const segundos = velocidad > 1000 ? velocidad / 1000 : velocidad;
  return (
    <>
      <TituloSeccion titulo={ajustes.title ?? 'Empresas con las que trabajamos'} subtitulo={ajustes.subtitle} antetitulo={ajustes.eyebrow} alinear="center" />
      <Marquesina segundos={Math.max(10, segundos * (items.length / 6 || 1))} espacio="1.75rem" etiqueta="Marcas">
        {items.map((m, k) => (
          <LogoMarca
            key={k}
            nombre={m.name}
            imagen={m.imageUrl}
            alt={m.alt}
            url={m.link}
            forma={m.shape || 'square'}
            zoom={m.zoom}
            posX={m.posX}
            posY={m.posY}
            giro={k % 2 ? 4 : -4}
          />
        ))}
      </Marquesina>
    </>
  );
}

/* ── Cuadrícula de categorías (category_grid) ───────────── */

const ORDEN_CATEGORIAS = {
  products: (x, y) => (y.cuenta || 0) - (x.cuenta || 0),
  alphabetical: (x, y) => String(x.name || '').localeCompare(String(y.name || ''), 'es'),
};

/**
 * Categorías en cuadros o círculos.
 *  - categorias: las automáticas que pasa la página ([{ categoryId, name,
 *    imageUrl, imagenProducto, cuenta }], en el orden del admin). Con ellas
 *    se aplican sortMode, limit (6 por defecto) e imageSource ('product' usa
 *    imagenProducto si llega). Sin ellas, los items puestos a mano, todos.
 *  - Si hay menos categorías que columnas, se reparten en las que hay.
 */
export function GrillaCategorias({ ajustes = {}, categorias }) {
  const auto = Boolean(categorias);
  const base = auto ? [...categorias] : [...(ajustes.items || [])];
  if (auto && ORDEN_CATEGORIAS[ajustes.sortMode]) base.sort(ORDEN_CATEGORIAS[ajustes.sortMode]);
  const lista = auto ? base.slice(0, Math.min(12, Math.max(2, Number(ajustes.limit) || 6))) : base;
  if (!lista.length) return null;
  const columnas = Math.min(lista.length, Math.min(6, Math.max(2, Number(ajustes.columns) || 6)));
  const redonda = ajustes.cardStyle === 'round';
  // Sin imageSource guardado, la foto de un producto (como la tienda); si
  // falta la elegida, la otra.
  const deProducto = (ajustes.imageSource || 'product') === 'product';
  const fotoDe = (c) => (auto && deProducto ? c.imagenProducto || c.imageUrl : c.imageUrl || c.imagenProducto);
  return (
    <>
      <TituloSeccion {...tituloDesdeAjustes(ajustes)} />
      <ul className={s.categorias} style={{ '--columnas': columnas }}>
        {lista.map((c, k) => (
          <li key={c.categoryId || c.name}>
            <TarjetaCategoria
              forma={redonda ? 'circulo' : 'cuadro'}
              nombre={c.name}
              imagen={fotoDe(c)}
              url={c.url || `?categoria=${c.categoryId}`}
              cuenta={ajustes.showProductCount ? c.cuenta : undefined}
              detalle={c.detalle}
              fondo={c.backgroundColor || ajustes.tileBackgroundColor}
              acento={acento(k)}
              giro={k % 2 ? 2.5 : -2.5}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Registro: tipo de sección → componente ─────────────── */

/**
 * Tipos del builder que el kit ya sabe dibujar. `nombre` es el del
 * componente escrito a mano (el build minifica Componente.name); lo usan la
 * guía y "Ver componentes".
 */
export const REGISTRO_SECCIONES = {
  announcement_bar: { Componente: BarraAnuncios, nombre: 'BarraAnuncios', ancho: 'completo', sinRelleno: true },
  hero_carousel: { Componente: HeroCarrusel, nombre: 'HeroCarrusel' },
  trust_badges: { Componente: InsigniasConfianza, nombre: 'InsigniasConfianza' },
  featured_carousel: { Componente: CarruselProductos, nombre: 'CarruselProductos', productos: true },
  new_arrivals_carousel: { Componente: CarruselProductos, nombre: 'CarruselProductos', productos: true },
  sale_carousel: { Componente: CarruselProductos, nombre: 'CarruselProductos', productos: true },
  category_carousel: { Componente: CarruselProductos, nombre: 'CarruselProductos', productos: true },
  collection_carousel: { Componente: CarruselProductos, nombre: 'CarruselProductos', productos: true },
  flash_sales: { Componente: OfertaRelampago, nombre: 'OfertaRelampago', productos: true },
  testimonials: { Componente: Testimonios, nombre: 'Testimonios' },
  faq_accordion: { Componente: PreguntasFrecuentes, nombre: 'PreguntasFrecuentes' },
  marquee: { Componente: MarcasMarquesina, nombre: 'MarcasMarquesina' },
  category_grid: { Componente: GrillaCategorias, nombre: 'GrillaCategorias', categorias: true },
  header: { Componente: Encabezado, nombre: 'Encabezado' },
  text: { Componente: BloqueTexto, nombre: 'BloqueTexto' },
  image: { Componente: BloqueImagen, nombre: 'BloqueImagen' },
  video: { Componente: BloqueVideo, nombre: 'BloqueVideo' },
  banner_grid: { Componente: MosaicoBanners, nombre: 'MosaicoBanners', marcas: true },
  bestsellers_row: { Componente: FilaDestacados, nombre: 'FilaDestacados' },
  hero_banner: { Componente: BannerPrincipal, nombre: 'BannerPrincipal' },
  feature_list: { Componente: ListaBeneficios, nombre: 'ListaBeneficios' },
  map_location: { Componente: Ubicacion, nombre: 'Ubicacion' },
  // Compacta como en la tienda: las burbujas casi pegadas al banner y al catálogo.
  categories_nav: { Componente: NavCategorias, nombre: 'NavCategorias', categorias: true, relleno: '0.75rem' },
  featured_products: { Componente: GrillaProductos, nombre: 'GrillaProductos', productos: true },
  product_grid: { Componente: GrillaProductos, nombre: 'GrillaProductos', productos: true },
  sidebar_catalog: { Componente: CatalogoConFiltros, nombre: 'CatalogoConFiltros', productos: true },
  footer_columns: { Componente: PiePagina, nombre: 'PiePagina' },
};

/*
 * Fuera del kit a propósito: conversion_fold y landing_payment son de la
 * landing del reloj (cacherito) y siguen con su propio componente vía
 * `respaldo`.
 */

/**
 * Dibuja una página del builder: `secciones` = [{ id, type, order, settings }]
 * tal como están en Firestore. Cada una va envuelta en <BloqueSeccion>
 * (relleno y fondo genéricos). Tipos que el kit aún no tiene se ignoran
 * (o se delegan con `respaldo(seccion)`).
 *
 *  - productosPara(seccion) → productos de Firestore (productos_wala); la
 *    sección los traduce con tarjetaDesdeProducto.
 *  - categoriasPara(seccion) → [{ categoryId, name, imageUrl }]
 *  - marcasPara(seccion) → marcas de tienda_brands (banner_grid con
 *    dataSource 'brands'); la sección las traduce con tarjetaDesdeMarca.
 *  - catalogo → { marcas, categorias, marcaActual } para las tarjetas de
 *    producto (sello de la marca y nombre de la categoría); ver
 *    tarjetaDesdeProducto.
 *  - onAgregar(producto) → devuelve el handler del botón de esa tarjeta
 *  - propsPara(seccion) → props extra de esa sección que dependen de la
 *    página: { cargando, hayMas, onCargarMas } en grillas, { grupos,
 *    seleccion, onFiltrar } en el catálogo, { activa, onSeleccionar } en
 *    categories_nav, { onClicBoton } en hero_banner…
 *  - envolver(seccion, nodo, indice) → para el editor: envuelve cada sección
 *    (p. ej. con <SeccionEditable>) sin que RenderSecciones lo conozca.
 *  - tarjeta → la tarjeta de producto de la tienda ({ producto, catalogo,
 *    onAgregar, segundaFoto }); sin ella, TarjetaDeCatalogo del kit.
 */
/** Sin valor guardado (el 0 sí es un valor: la sección sin relleno). */
const vacio = (v) => v == null || v === '';

/**
 * Una sola sección del registro, dentro de su <BloqueSeccion>. Es lo que usa
 * RenderSecciones por cada una; la tienda la usa sola dentro de su propio
 * bucle (carga diferida, editor, secciones que no se dibujan).
 *  - seccion: { id, type, settings }  · primera: lo primero que se ve
 *  - productos, categorias, marcas: los datos de esa sección
 *  - catalogo, onAgregar, tarjeta: para las tarjetas de producto
 *  - el resto, props de esa sección (propsPara)
 * Devuelve null si el kit no tiene ese tipo.
 */
export function SeccionDelKit({ seccion, primera = false, productos, categorias, marcas, catalogo, onAgregar, tarjeta, ...props }) {
  const reg = REGISTRO_SECCIONES[seccion?.type];
  if (!reg) return null;
  const { Componente } = reg;
  const extra = {};
  if (reg.productos) Object.assign(extra, { productos: productos || [], onAgregar, catalogo, tipo: seccion.type, ...(tarjeta ? { tarjeta } : {}) });
  if (reg.categorias) extra.categorias = categorias;
  if (reg.marcas) extra.marcas = marcas || [];
  if (primera) extra.primera = true; // lo primero que se ve: sin carga diferida
  const ajustes = seccion.settings || {};
  return (
    <BloqueSeccion
      ajustes={reg.sinRelleno ? { ...ajustes, paddingTop: '0', paddingBottom: '0' }
        : reg.relleno ? { ...ajustes, paddingTop: vacio(ajustes.paddingTop) ? reg.relleno : ajustes.paddingTop, paddingBottom: vacio(ajustes.paddingBottom) ? reg.relleno : ajustes.paddingBottom }
          : ajustes}
      ancho={reg.ancho}
      pegado={reg.sinRelleno}
    >
      <Componente ajustes={ajustes} {...extra} {...props} />
    </BloqueSeccion>
  );
}

export function RenderSecciones({ secciones = [], productosPara, categoriasPara, marcasPara, catalogo, propsPara, onAgregar, respaldo, envolver, tarjeta }) {
  return [...secciones]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((sec, indice) => {
      const reg = REGISTRO_SECCIONES[sec.type];
      const conMarco = (nodo) => (envolver ? <React.Fragment key={sec.id}>{envolver(sec, nodo, indice)}</React.Fragment> : nodo);
      if (!reg) return conMarco(respaldo ? <React.Fragment key={sec.id}>{respaldo(sec)}</React.Fragment> : null);
      return conMarco(
        <SeccionDelKit
          key={sec.id}
          seccion={sec}
          primera={indice === 0}
          productos={reg.productos ? productosPara?.(sec) : undefined}
          categorias={reg.categorias ? categoriasPara?.(sec) : undefined}
          marcas={reg.marcas ? marcasPara?.(sec) : undefined}
          catalogo={catalogo}
          onAgregar={onAgregar}
          tarjeta={tarjeta}
          {...propsPara?.(sec)}
        />
      );
    });
}
