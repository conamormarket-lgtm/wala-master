import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Truck, ShieldCheck, Clock, CreditCard, RotateCcw, Heart, Star, CheckCircle2, Zap, BadgeCheck, Quote,
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
import { Encabezado, BloqueTexto, BloqueImagen, BloqueVideo, MosaicoBanners, FilaDestacados } from './SeccionesContenido';
import s from './Secciones.module.css';

/*
 * Secciones del builder hechas con piezas del kit. Cada una recibe
 * `ajustes` = el `settings` que ya guarda Firestore (pages/{pageId}), con
 * los mismos nombres de campo (ver getDefaultSettings en
 * src/pages/Tienda/services/storefront.js). Los datos que vienen de
 * consultas (productos, categorías) entran aparte, ya traducidos.
 */

/* ── Barra de anuncios (announcement_bar) ───────────────── */
export function BarraAnuncios({ ajustes = {} }) {
  const { messages = [], speed = 4000, bgColor = '#7c3aed', textColor = '#ffffff', animationType = 'fade' } = ajustes;
  const mensajes = messages.filter((m) => m?.text);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (animationType !== 'fade' || mensajes.length < 2) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(() => setI((x) => (x + 1) % mensajes.length), Math.max(2500, speed));
    return () => window.clearInterval(id);
  }, [animationType, mensajes.length, speed]);

  if (!mensajes.length) return null;
  const mensaje = (m) => (m.link ? <Enlace to={m.link} className={s.anuncioEnlace}>{m.text}</Enlace> : <span>{m.text}</span>);

  return (
    <div className={s.anuncios} style={{ '--anuncio-fondo': bgColor, '--anuncio-texto': textColor }} role="region" aria-label="Anuncios">
      {animationType === 'scroll' ? (
        <Marquesina segundos={Math.max(12, mensajes.length * 6)} espacio="3rem" etiqueta="Anuncios">
          {mensajes.map((m, k) => <span key={k} className={s.anuncio}>{mensaje(m)}</span>)}
        </Marquesina>
      ) : (
        <div className={s.anuncioFijo} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={i}
              className={s.anuncio}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {mensaje(mensajes[i % mensajes.length])}
            </motion.span>
          </AnimatePresence>
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
const ICONOS_CONFIANZA = { truck: Truck, shield: ShieldCheck, clock: Clock, credit_card: CreditCard, return: RotateCcw, heart: Heart, star: Star, check: CheckCircle2 };

export function InsigniasConfianza({ ajustes = {} }) {
  const badges = (ajustes.badges || []).filter((b) => b?.text);
  if (!badges.length) return null;
  return (
    <ul className={s.insignias}>
      {badges.map((b, k) => {
        const Icono = ICONOS_CONFIANZA[b.icon] || CheckCircle2;
        return (
          <li key={k}>
            <span className={s.insigniaIcono}><Icono aria-hidden="true" /></span>
            <span>{b.text}</span>
          </li>
        );
      })}
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
export function OfertaRelampago({ ajustes = {}, productos = [], onAgregar }) {
  const [terminada, setTerminada] = useState(false);
  if (!productos.length || terminada) return null;
  return (
    <div className={s.flash}>
      <div className={s.flashCabeza}>
        <h2 className={s.flashTitulo}><Zap aria-hidden="true" /> {ajustes.title || 'Ofertas relámpago'}</h2>
        <CuentaRegresiva hasta={ajustes.endTime} etiqueta="Termina en" onTerminar={() => setTerminada(true)} />
      </div>
      <Carrusel visibles={{ escritorio: 4, tablet: 3, movil: 2.15 }} espacio="0.85rem" etiqueta={ajustes.title || 'Ofertas'}>
        {productos.slice(0, 8).map((p) => (
          <TarjetaProducto key={p.id} inclinar={false} {...tarjetaDesdeProducto(p)} onAgregar={onAgregar?.(p)} />
        ))}
      </Carrusel>
    </div>
  );
}

/* ── Testimonios (testimonials) ─────────────────────────── */
export function Testimonios({ ajustes = {} }) {
  const lista = (ajustes.testimonials || []).filter((t) => t?.text);
  if (!lista.length) return null;
  return (
    <>
      <TituloSeccion {...tituloDesdeAjustes(ajustes)} />
      <Carrusel visibles={{ escritorio: 3, tablet: 2, movil: 1.1 }} espacio="1rem" etiqueta="Opiniones de clientes">
        {lista.map((t, k) => (
          <figure key={k} className={s.testimonio}>
            <Quote className={s.comillas} aria-hidden="true" />
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
              {t.verified && <span className={s.verificado}><BadgeCheck aria-hidden="true" /> Compra verificada</span>}
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
      <TituloSeccion titulo={ajustes.title} subtitulo={ajustes.subtitle} alinear={dividido ? 'left' : ajustes.titleAlign || 'left'} />
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
};

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
 */
export function RenderSecciones({ secciones = [], productosPara, categoriasPara, marcasPara, onAgregar, respaldo }) {
  return [...secciones]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((sec, indice) => {
      const reg = REGISTRO_SECCIONES[sec.type];
      if (!reg) return respaldo ? <React.Fragment key={sec.id}>{respaldo(sec)}</React.Fragment> : null;
      const { Componente } = reg;
      const extra = {};
      if (reg.productos) extra.productos = productosPara?.(sec) || [];
      if (reg.categorias) extra.categorias = categoriasPara?.(sec);
      if (reg.marcas) extra.marcas = marcasPara?.(sec) || [];
      if (indice === 0) extra.primera = true; // lo primero que se ve: sin carga diferida
      if (reg.productos) extra.onAgregar = onAgregar;
      const ajustes = sec.settings || {};
      return (
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
