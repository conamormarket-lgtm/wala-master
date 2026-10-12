import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Star, BadgeCheck, ArrowRight, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Boton from './Boton';
import Carrusel from './Carrusel';
import Marquesina from './Marquesina';
import CuentaRegresiva from './CuentaRegresiva';
import Acordeon from './Acordeon';
import TarjetaProducto from './TarjetaProducto';
import { Enlace } from './Enlace';
import { tarjetaDesdeProducto } from './adaptadores';
import { BloqueSeccion, TituloSeccion, tituloDesdeAjustes } from './Seccion';
import { EtiquetaColgante, Destello, Puntos } from './Marca';
import { IconoWala, iconoDesde } from './IconosWala';
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

/** Un mensaje: ícono de Walá (o imagen), texto con su estilo y "Ver →" si lleva enlace. */
function MensajeAnuncio({ m, acento }) {
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
        : icono ? <IconoWala nombre={icono} tamano={24} sticker={false} girar={-8} className={s.anuncioIcono} />
          : emoji ? <span aria-hidden="true">{emoji}</span>
            : acento ? <Destello className={s.anuncioDestello} /> : null}
      <span className={s.anuncioTexto} style={estilo}>{texto}</span>
      {m.link && <span className={s.anuncioCta}>Ver <ArrowRight aria-hidden="true" /></span>}
    </>
  );
  return m.link
    ? <Enlace to={m.link} className={s.anuncio}>{cuerpo}</Enlace>
    : <span className={s.anuncio}>{cuerpo}</span>;
}

/**
 * Barra de anuncios. Mismos campos que el builder:
 *  - variant: 'soft' (por defecto) | 'solid' | 'dark'; bgColor es el color de
 *    la barra (sólida) o su acento (suave y oscura); textColor, el texto en sólida.
 *  - density: 'compact' | 'comfortable'; showAccent: destello si no hay ícono.
 *  - animationType: 'fade' (uno a la vez: flechas, deslizar y puntos) | 'scroll' (cinta).
 *  - messages: [{ text, link, icon, imageUrl, fontFamily, fontSize, bold, italic, underline, textBg }]
 */
export function BarraAnuncios({ ajustes = {} }) {
  const {
    messages = [], speed = 4000, bgColor = '#7c3aed', textColor = '#ffffff', animationType = 'fade',
    variant = 'soft', density = 'compact', showAccent = true,
  } = ajustes;
  const mensajes = messages.filter((m) => m?.text);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const pausa = useRef(false);
  const toque = useRef(null);
  const total = mensajes.length;

  const ir = (paso) => {
    setDir(paso);
    setI((x) => (x + paso + total) % total);
  };

  useEffect(() => {
    if (animationType !== 'fade' || total < 2) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(() => {
      if (pausa.current || document.hidden) return;
      setDir(1);
      setI((x) => (x + 1) % total);
    }, Math.max(2500, speed));
    return () => window.clearInterval(id);
  }, [animationType, total, speed]);

  if (!total) return null;
  const actual = mensajes[i % total];
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
      <Destello className={s.anuncioAdorno1} />
      <Puntos className={s.anuncioAdorno2} filas={3} columnas={8} />
      {animationType === 'scroll' ? (
        <Marquesina segundos={Math.max(14, total * 7)} espacio="2.5rem" etiqueta="Anuncios">
          {mensajes.map((m, k) => <MensajeAnuncio key={k} m={m} acento={showAccent} />)}
        </Marquesina>
      ) : (
        <div
          className={s.anuncioFijo}
          aria-live="polite"
          onTouchStart={(e) => { toque.current = e.touches[0]?.clientX ?? null; pausa.current = true; }}
          onTouchEnd={(e) => {
            pausa.current = false;
            if (toque.current == null || total < 2) return;
            const dx = (e.changedTouches[0]?.clientX ?? toque.current) - toque.current;
            toque.current = null;
            if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
          }}
        >
          {total > 1 && (
            <button type="button" className={`${s.anuncioFlecha} ${s.anuncioAnterior}`} onClick={() => ir(-1)} aria-label="Anuncio anterior">
              <ChevronLeft aria-hidden="true" />
            </button>
          )}
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={i}
              className={s.anuncioMarco}
              custom={dir}
              initial={{ opacity: 0, x: dir * 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -18 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <MensajeAnuncio m={actual} acento={showAccent} />
            </motion.div>
          </AnimatePresence>
          {total > 1 && (
            <>
              <button type="button" className={`${s.anuncioFlecha} ${s.anuncioSiguiente}`} onClick={() => ir(1)} aria-label="Anuncio siguiente">
                <ChevronRight aria-hidden="true" />
              </button>
              <span className={s.anuncioPuntos} aria-hidden="true">
                {mensajes.map((_, k) => <span key={k} className={k === i % total ? s.anuncioPuntoActivo : undefined} />)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Carrusel principal (hero_carousel) ─────────────────── */
export function HeroCarrusel({ ajustes = {} }) {
  const {
    slides = [], autoPlay = true, autoPlaySpeed = 5000, showArrows = true, showDots = true,
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
      {badges.map((b, k) => (
        <li key={k}>
          <IconoWala nombre={b.icon} tamano={46} girar={k % 2 ? 6 : -6} className={s.insigniaIcono} />
          <span>{b.text}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Carrusel de productos (featured / new_arrivals / sale / category / collection) ── */
export function CarruselProductos({ ajustes = {}, productos = [], onAgregar }) {
  if (!productos.length) return null;
  const visibles = Math.min(6, Math.max(2, Number(ajustes.visibleItems) || 5));
  return (
    <>
      <TituloSeccion {...tituloDesdeAjustes(ajustes)} />
      <Carrusel
        visibles={{ escritorio: visibles, tablet: Math.min(3, visibles), movil: 2.15 }}
        espacio="0.85rem"
        autoplay={ajustes.autoPlay ? ajustes.autoPlaySpeed || 5000 : 0}
        etiqueta={ajustes.title || 'Productos'}
      >
        {productos.map((p) => (
          <TarjetaProducto key={p.id} inclinar={false} {...tarjetaDesdeProducto(p)} onAgregar={onAgregar?.(p)} />
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

/** "¡Quedan 6!" con barra, solo cuando el stock es bajo (inStock numérico ≤ 20). */
function Quedan({ stock }) {
  const n = Number(stock);
  // Sin stock bajo igual se reserva el lugar: así todas las tarjetas miden lo mismo.
  if (!Number.isFinite(n) || n <= 0 || n > 20) return <div className={s.quedan} aria-hidden="true" />;
  return (
    <div className={s.quedan}>
      <span className={s.quedanTexto}>{n <= 5 ? <>¡Solo quedan <strong>{n}</strong>!</> : <>Quedan <strong>{n}</strong></>}</span>
      <span className={s.quedanBarra} aria-hidden="true"><span style={{ width: `${Math.max(8, (n / 20) * 100)}%` }} /></span>
    </div>
  );
}

/**
 * Ofertas relámpago: un evento dentro de la página. Panel en la noche violeta
 * de Walá (en claro y en noche), rayo en sticker, etiqueta "Hasta -X%",
 * cuenta regresiva grande y, bajo cada producto, cuántos quedan.
 */
export function OfertaRelampago({ ajustes = {}, productos = [], onAgregar }) {
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
            <TarjetaProducto inclinar={false} {...tarjetaDesdeProducto(p)} onAgregar={onAgregar?.(p)} />
            <Quedan stock={p.inStock} />
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
          <figure key={k} className={s.testimonio} style={{ '--giro': `${[-0.8, 0.6, -0.4, 0.9][k % 4]}deg` }}>
            <span className={s.comillas} aria-hidden="true">“</span>
            {t.topic && <p className={s.tema}>{t.topic}</p>}
            {t.rating > 0 && (
              <p className={s.estrellas} aria-label={`${t.rating} de 5 estrellas`}>
                {Array.from({ length: 5 }, (_, n) => <Star key={n} className={n < t.rating ? s.llena : undefined} aria-hidden="true" />)}
              </p>
            )}
            <blockquote>{t.text}</blockquote>
            <figcaption>
              {t.avatar ? <img src={t.avatar} alt="" /> : <span className={s.inicial}>{(t.author || '?')[0]}</span>}
              <span>
                <strong>{t.author}</strong>
                {(t.city || t.location) && <small>{t.city || t.location}</small>}
              </span>
              {t.verified && <span className={s.verificado}><EtiquetaColgante tono="verde" tamano="sm" icono={<BadgeCheck aria-hidden="true" />}>Verificada</EtiquetaColgante></span>}
            </figcaption>
          </figure>
        ))}
      </Carrusel>
    </>
  );
}

/* ── Preguntas frecuentes (faq_accordion) ───────────────── */
export function PreguntasFrecuentes({ ajustes = {} }) {
  const items = (ajustes.items || []).filter((i) => i?.question);
  if (!items.length) return null;
  const dividido = (ajustes.layout || 'split') === 'split';
  return (
    <div className={dividido ? s.faqDividido : undefined}>
      <div className={s.faqCabeza}>
        <TituloSeccion titulo={ajustes.title} subtitulo={ajustes.subtitle} antetitulo={ajustes.eyebrow} alinear={dividido ? 'left' : ajustes.titleAlign || 'left'} />
        {dividido && (
          <div className={s.faqKapi}>
            <img src="/assets/kapi/kapi-happy.webp" alt="" width="84" height="84" loading="lazy" decoding="async" />
            <p>¿Te quedó otra duda? <strong>Escríbenos</strong>, te respondemos rapidito.</p>
          </div>
        )}
      </div>
      <Acordeon items={items} abiertoInicial={ajustes.defaultOpen ? true : false} />
    </div>
  );
}

/* ── Marcas en movimiento (marquee) ─────────────────────── */
export function MarcasMarquesina({ ajustes = {} }) {
  const items = (ajustes.items || []).filter((m) => m?.imageUrl || m?.name);
  if (!items.length) return null;
  return (
    <>
      <TituloSeccion titulo={ajustes.title ?? 'Empresas con las que trabajamos'} alinear="center" />
      <Marquesina segundos={ajustes.speed || 30} espacio="2.5rem" etiqueta="Marcas">
        {items.map((m, k) => {
          const logo = (
            <span className={[s.marca, m.shape === 'circle' && s.marcaCirculo].filter(Boolean).join(' ')} title={m.name}>
              {m.imageUrl ? <img src={m.imageUrl} alt={m.alt || m.name || ''} loading="lazy" /> : <strong>{m.name}</strong>}
            </span>
          );
          return m.link ? <Enlace key={k} to={m.link}>{logo}</Enlace> : <React.Fragment key={k}>{logo}</React.Fragment>;
        })}
      </Marquesina>
    </>
  );
}

/* ── Cuadrícula de categorías (category_grid) ───────────── */
export function GrillaCategorias({ ajustes = {}, categorias }) {
  const lista = (categorias || ajustes.items || []).slice(0, ajustes.limit || 12);
  if (!lista.length) return null;
  const columnas = Math.min(6, Math.max(2, Number(ajustes.columns) || 6));
  const redonda = ajustes.cardStyle === 'round';
  return (
    <>
      <TituloSeccion {...tituloDesdeAjustes(ajustes)} />
      <ul className={[s.categorias, redonda && s.categoriasRedondas].filter(Boolean).join(' ')} style={{ '--columnas': columnas }}>
        {lista.map((c) => (
          <li key={c.categoryId || c.name}>
            <Enlace to={c.url || `?categoria=${c.categoryId}`} className={s.categoria}>
              <span className={s.categoriaFoto} style={{ background: c.backgroundColor || ajustes.tileBackgroundColor || undefined }}>
                {c.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" />}
              </span>
              <span className={s.categoriaNombre}>{c.name}</span>
              {ajustes.showProductCount && c.cuenta != null && <small>{c.cuenta} productos</small>}
            </Enlace>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Registro: tipo de sección → componente ─────────────── */

/** Tipos del builder que el kit ya sabe dibujar. */
export const REGISTRO_SECCIONES = {
  announcement_bar: { Componente: BarraAnuncios, ancho: 'completo', sinRelleno: true },
  hero_carousel: { Componente: HeroCarrusel },
  trust_badges: { Componente: InsigniasConfianza },
  featured_carousel: { Componente: CarruselProductos, productos: true },
  new_arrivals_carousel: { Componente: CarruselProductos, productos: true },
  sale_carousel: { Componente: CarruselProductos, productos: true },
  category_carousel: { Componente: CarruselProductos, productos: true },
  collection_carousel: { Componente: CarruselProductos, productos: true },
  flash_sales: { Componente: OfertaRelampago, productos: true },
  testimonials: { Componente: Testimonios },
  faq_accordion: { Componente: PreguntasFrecuentes },
  marquee: { Componente: MarcasMarquesina },
  category_grid: { Componente: GrillaCategorias, categorias: true },
  header: { Componente: Encabezado },
  text: { Componente: BloqueTexto },
  image: { Componente: BloqueImagen },
  video: { Componente: BloqueVideo },
  banner_grid: { Componente: MosaicoBanners, marcas: true },
  bestsellers_row: { Componente: FilaDestacados },
  hero_banner: { Componente: BannerPrincipal },
  feature_list: { Componente: ListaBeneficios },
  map_location: { Componente: Ubicacion },
  categories_nav: { Componente: NavCategorias, categorias: true },
  featured_products: { Componente: GrillaProductos, productos: true },
  product_grid: { Componente: GrillaProductos, productos: true },
  sidebar_catalog: { Componente: CatalogoConFiltros, productos: true },
  footer_columns: { Componente: PiePagina },
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
 *  - onAgregar(producto) → devuelve el handler del botón de esa tarjeta
 *  - propsPara(seccion) → props extra de esa sección que dependen de la
 *    página: { cargando, hayMas, onCargarMas } en grillas, { grupos,
 *    seleccion, onFiltrar } en el catálogo, { activa, onSeleccionar } en
 *    categories_nav, { onClicBoton } en hero_banner…
 *  - envolver(seccion, nodo, indice) → para el editor: envuelve cada sección
 *    (p. ej. con <SeccionEditable>) sin que RenderSecciones lo conozca.
 */
export function RenderSecciones({ secciones = [], productosPara, categoriasPara, marcasPara, propsPara, onAgregar, respaldo, envolver }) {
  return [...secciones]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((sec, indice) => {
      const reg = REGISTRO_SECCIONES[sec.type];
      const conMarco = (nodo) => (envolver ? <React.Fragment key={sec.id}>{envolver(sec, nodo, indice)}</React.Fragment> : nodo);
      if (!reg) return conMarco(respaldo ? <React.Fragment key={sec.id}>{respaldo(sec)}</React.Fragment> : null);
      const { Componente } = reg;
      const extra = {};
      if (reg.productos) extra.productos = productosPara?.(sec) || [];
      if (reg.categorias) extra.categorias = categoriasPara?.(sec);
      if (reg.marcas) extra.marcas = marcasPara?.(sec) || [];
      if (indice === 0) extra.primera = true; // lo primero que se ve: sin carga diferida
      if (reg.productos) extra.onAgregar = onAgregar;
      Object.assign(extra, propsPara?.(sec));
      const ajustes = sec.settings || {};
      return conMarco(
        <BloqueSeccion
          key={sec.id}
          ajustes={reg.sinRelleno ? { ...ajustes, paddingTop: '0', paddingBottom: '0' } : ajustes}
          ancho={reg.ancho}
        >
          <Componente ajustes={ajustes} {...extra} />
        </BloqueSeccion>
      );
    });
}
