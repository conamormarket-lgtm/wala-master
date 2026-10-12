import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Boton from './Boton';
import Carrusel from './Carrusel';
import { Enlace } from './Enlace';
import { TituloSeccion, tituloDesdeAjustes } from './Seccion';
import { tarjetaDesdeMarca } from './adaptadores';
import { EtiquetaColgante, Garabatos, Trazo, Destello, pastel } from './Marca';
import { toDirectImageUrl } from '../../utils/imageUrl';
import s from './SeccionesContenido.module.css';

/*
 * Secciones de contenido del builder: encabezado, texto, imagen, video,
 * mosaico de banners o marcas y fila de destacados. Igual que Secciones.jsx,
 * reciben `ajustes` = el `settings` de Firestore con los mismos campos que
 * getDefaultSettings (src/pages/Tienda/services/storefront.js). Relleno y
 * fondo los pone <BloqueSeccion>; aquí solo va el contenido.
 */

/* ── Piezas comunes ─────────────────────────────────────── */

/*
 * Colores que el builder guardaba POR DEFECTO (#000 / #333 / #666). Casi
 * todas las secciones viejas los tienen, y en modo noche dejaban texto negro
 * sobre fondo negro. Se tratan como "sin color" para que mande el tema.
 */
const COLORES_DE_FABRICA = new Set(['#000', '#000000', '#333', '#333333', '#666', '#666666']);
export const colorPropio = (c) => {
  const v = String(c || '').trim().toLowerCase();
  return v && v !== 'transparent' && !COLORES_DE_FABRICA.has(v) ? c : undefined;
};

/** Fuente elegida en el editor para un campo (`${campo}FontSize`, …). */
export const fuenteDe = (a, campo) => ({
  fontFamily: a[`${campo}FontFamily`] || undefined,
  fontSize: a[`${campo}FontSize`] || undefined,
  fontWeight: a[`${campo}FontWeight`] || undefined,
  textTransform: a[`${campo}TextTransform`] || undefined,
});

/**
 * Un campo de texto con el estilo por campo del editor (contrato de
 * TextStyleControl): `${campo}Align`, `${campo}Underline`, `${campo}Bg` y
 * `${campo}Link`. Vacíos = texto normal.
 */
export function TextoCampo({ ajustes, campo, como: Etiqueta = 'p', className, style, children }) {
  if (children == null || children === '') return null;
  const fondo = colorPropio(ajustes[`${campo}Bg`]);
  const subrayado = !!ajustes[`${campo}Underline`];
  const enlace = ajustes[`${campo}Link`];

  let contenido = children;
  if (fondo || subrayado) {
    contenido = (
      <span className={fondo ? s.resaltado : undefined} style={{ background: fondo, textDecoration: subrayado ? 'underline' : undefined }}>
        {contenido}
      </span>
    );
  }
  if (enlace) contenido = <Enlace to={enlace} className={s.enlaceTexto}>{contenido}</Enlace>;

  return (
    <Etiqueta className={className} style={{ textAlign: ajustes[`${campo}Align`] || undefined, ...style }}>
      {contenido}
    </Etiqueta>
  );
}

/** Botón opcional de la sección (buttonText + buttonLink). Violeta liso salvo que el editor fije color. */
export function BotonDeAjustes({ ajustes }) {
  const { buttonText, buttonLink, buttonBgColor, buttonTextColor } = ajustes;
  if (!buttonText || !buttonLink) return null;
  const propio = buttonBgColor
    ? { '--b-fondo': buttonBgColor, '--b-fondo-hover': buttonBgColor, '--b-texto': buttonTextColor || '#fff', '--b-sombra': 'transparent' }
    : buttonTextColor ? { '--b-texto': buttonTextColor } : undefined;
  return (
    <Boton to={buttonLink} tamano="lg" iconoFin={<ArrowRight aria-hidden="true" />} className={s.boton} style={propio}>
      {buttonText}
    </Boton>
  );
}

/** Parte el título para pintar `resalte` (titleHighlight) en otro color, subrayado a mano. */
function conResalte(titulo, resalte, color) {
  const i = resalte ? titulo.indexOf(resalte) : -1;
  if (i < 0) return titulo;
  return (
    <>
      {titulo.slice(0, i)}
      <span className={s.resalte} style={{ color: color || undefined }}>
        {resalte}
        <Trazo className={s.trazo} />
      </span>
      {titulo.slice(i + resalte.length)}
    </>
  );
}

/* ── Encabezado (header) ────────────────────────────────── */
export function Encabezado({ ajustes = {} }) {
  const { title, subtitle, titleHighlight, titleHighlightColor, textAlign = 'center', compact } = ajustes;
  if (!title && !subtitle) return null;
  return (
    <div className={[s.encabezado, compact && s.compacto, textAlign === 'center' && s.centrado, textAlign === 'right' && s.derecha].filter(Boolean).join(' ')} style={{ textAlign }}>
      {ajustes.eyebrow && <p className={s.encabezadoEtiqueta}><EtiquetaColgante tono="suave">{ajustes.eyebrow}</EtiquetaColgante></p>}
      {!compact && textAlign === 'center' && <Garabatos variante="titulo" className={s.encabezadoGarabatos} />}
      <TextoCampo
        ajustes={ajustes}
        campo="title"
        como="h1"
        className={s.encabezadoTitulo}
        style={{ color: colorPropio(ajustes.titleColor), ...fuenteDe(ajustes, 'title') }}
      >
        {title ? conResalte(title, titleHighlight, titleHighlightColor) : null}
      </TextoCampo>
      <TextoCampo
        ajustes={ajustes}
        campo="subtitle"
        className={s.encabezadoSubtitulo}
        style={{ color: colorPropio(ajustes.subtitleColor), ...fuenteDe(ajustes, 'subtitle') }}
      >
        {subtitle}
      </TextoCampo>
      <BotonDeAjustes ajustes={ajustes} />
    </div>
  );
}

/* ── Texto (text) ───────────────────────────────────────── */
export function BloqueTexto({ ajustes = {} }) {
  const { heading, content, textAlign = 'left', maxWidth = '800px', compact } = ajustes;
  if (!heading && !content) return null;
  return (
    <div className={[s.texto, compact && s.compacto].filter(Boolean).join(' ')} style={{ textAlign, maxWidth }}>
      <TextoCampo
        ajustes={ajustes}
        campo="heading"
        como="h2"
        className={s.textoTitulo}
        style={{ color: colorPropio(ajustes.headingColor), ...fuenteDe(ajustes, 'heading') }}
      >
        {heading}
      </TextoCampo>
      <TextoCampo
        ajustes={ajustes}
        campo="content"
        como="div"
        className={s.textoCuerpo}
        style={{ color: colorPropio(ajustes.textColor), ...fuenteDe(ajustes, 'content') }}
      >
        {content}
      </TextoCampo>
      <BotonDeAjustes ajustes={ajustes} />
    </div>
  );
}

/* ── Imagen (image) ─────────────────────────────────────── */
const JUSTIFICAR = { left: 'flex-start', right: 'flex-end', center: 'center' };

/** `primera`: es la primera sección de la página → se carga sin esperar (es lo primero que se ve). */
export function BloqueImagen({ ajustes = {}, primera = false }) {
  const { url, alt = '', link, maxWidth = '100%', alignment = 'center', borderRadius } = ajustes;
  if (!url?.trim()) return null;
  const imagen = (
    <img
      src={toDirectImageUrl(url)}
      alt={alt}
      className={s.imagen}
      style={{ borderRadius: borderRadius || undefined }}
      loading={primera ? 'eager' : 'lazy'}
      fetchpriority={primera ? 'high' : undefined}
      decoding="async"
    />
  );
  return (
    <div className={s.imagenMarco} style={{ justifyContent: JUSTIFICAR[alignment] || 'center' }}>
      <div style={{ maxWidth, width: '100%' }}>
        {link?.trim() ? <Enlace to={link} className={s.imagenEnlace}>{imagen}</Enlace> : imagen}
      </div>
    </div>
  );
}

/* ── Video (video) ──────────────────────────────────────── */

/** Enlace de YouTube o Vimeo → dirección para incrustar (null si es un archivo de video). */
export function videoIncrustado(url) {
  const yt = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return /\/embed\//.test(url) ? url : null;
}

const FORMATOS_VIDEO = {
  '16:9': { proporcion: '16 / 9' },
  '1:1': { proporcion: '1 / 1', ancho: '600px' },
  '9:16': { proporcion: '9 / 16', ancho: '450px', alto: 'min(68dvh, 520px)' },
};

export const prefiereQuieto = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Video del builder. Los archivos (.mp4) se reproducen solo mientras se ven
 * (fuera de pantalla se pausan: ahorra batería y datos en la app) y no se
 * descargan hasta acercarse. Con "reducir movimiento" no arrancan solos y
 * muestran controles. YouTube/Vimeo van incrustados con carga diferida.
 *
 * Campos: url, poster, aspectRatio ('16:9' | '9:16' | '1:1' | 'auto'),
 * autoplay (por defecto sí, en silencio), loop (por defecto sí), controls.
 */
export function BloqueVideo({ ajustes = {} }) {
  const url = String(ajustes.url || '').trim();
  const video = useRef(null);
  const [quieto] = useState(prefiereQuieto);
  const automatico = ajustes.autoplay !== false && !quieto;
  const incrustado = url ? videoIncrustado(url) : null;

  useEffect(() => {
    const v = video.current;
    if (!v || !automatico) return undefined;
    v.muted = true; // el navegador solo deja arrancar solo a un video en silencio
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, [automatico, url]);

  if (!url) return null;
  const formato = FORMATOS_VIDEO[ajustes.aspectRatio] || (incrustado || ajustes.aspectRatio !== 'auto' ? FORMATOS_VIDEO['16:9'] : null);
  const controles = ajustes.controls === true || !automatico;
  const estilo = formato
    ? { aspectRatio: formato.proporcion, maxWidth: formato.ancho, maxHeight: formato.alto }
    : undefined;

  return (
    <div className={s.videoMarco} style={{ maxWidth: estilo?.maxWidth }}>
      <span className={`${s.videoCinta} ${s.videoCinta1}`} aria-hidden="true" />
      <span className={`${s.videoCinta} ${s.videoCinta2}`} aria-hidden="true" />
      <Destello className={s.videoChispa} />
    <div className={[s.video, formato && s.videoFijo].filter(Boolean).join(' ')} style={estilo}>
      {incrustado ? (
        <iframe
          title={ajustes.title || 'Video'}
          src={incrustado}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video
          ref={video}
          src={url}
          poster={ajustes.poster || undefined}
          className={controles ? undefined : s.videoSinToque}
          controls={controles}
          muted={automatico}
          loop={ajustes.loop !== false}
          playsInline
          preload={automatico ? 'none' : 'metadata'}
        />
      )}
    </div>
    </div>
  );
}

/* ── Mosaico de banners o marcas (banner_grid) ──────────── */

/* Colores de las tarjetas de marca sin color propio (bgColor). */
const PALETA_MARCAS = [
  ['#5b21b6', '#ddd6fe'],
  ['#9f1239', '#ffe4e6'],
  ['#075985', '#e0f2fe'],
  ['#065f46', '#d1fae5'],
  ['#9a3412', '#ffedd5'],
  ['#1e3a8a', '#e0e7ff'],
];

const iniciales = (nombre) => String(nombre || '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

function TarjetaMarca({ marca, indice, estilo, mostrarNombre }) {
  const [color, suave] = PALETA_MARCAS[indice % PALETA_MARCAS.length];
  return (
    <Enlace
      to={marca.url}
      className={[s.marca, estilo === 'outline' && s.marcaBorde].filter(Boolean).join(' ')}
      style={{
        '--marca-color': marca.color || color,
        '--marca-suave': suave,
        backgroundImage: marca.fondo && estilo !== 'outline'
          ? `linear-gradient(120deg, rgba(15,23,42,.86), rgba(15,23,42,.34)), url("${toDirectImageUrl(marca.fondo)}")`
          : undefined,
      }}
      aria-label={`Explorar ${marca.nombre}`}
    >
      <span className={s.marcaNumero} aria-hidden="true">{String(indice + 1).padStart(2, '0')}</span>
      {/* El logo cuelga de una etiqueta (como la del logo de Walá): sirve
          igual para logos cuadrados, redondos o con fondo transparente. */}
      <span className={s.marcaColgante}>
        <span className={s.marcaHilo} aria-hidden="true" />
        <span className={s.marcaLogo}>
          {marca.logo
            ? <img src={toDirectImageUrl(marca.logo)} alt="" loading="lazy" decoding="async" />
            : <span className={s.marcaIniciales} aria-hidden="true">{iniciales(marca.nombre)}</span>}
        </span>
      </span>
      <span className={s.marcaTexto}>
        <EtiquetaColgante tono={estilo === 'outline' ? 'violeta' : 'blanco'} tamano="sm" className={s.marcaEtiqueta}>Universo Walá</EtiquetaColgante>
        {mostrarNombre && <strong>{marca.nombre}</strong>}
        <span className={s.marcaCta}>Explorar colección <ArrowRight aria-hidden="true" /></span>
      </span>
    </Enlace>
  );
}

/**
 * Dos fuentes, como en el builder:
 *  - dataSource 'brands': tarjetas de las marcas (prop `marcas` = documentos
 *    de tienda_brands) en el carrusel del kit, con autoplay y puntos.
 *  - manual: banners con imagen puestos a mano, en cuadrícula.
 */
export function MosaicoBanners({ ajustes = {}, marcas = [] }) {
  const columnas = Math.min(4, Math.max(1, Number(ajustes.columns) || 3));
  const titulo = <TituloSeccion titulo={ajustes.title} subtitulo={ajustes.subtitle} alinear="center" />;

  if (ajustes.dataSource === 'brands') {
    const lista = (marcas || []).map(tarjetaDesdeMarca).filter(Boolean);
    if (!lista.length) return null;
    return (
      <>
        {titulo}
        <Carrusel
          visibles={{ escritorio: columnas, tablet: Math.min(2, columnas), movil: 1.15 }}
          espacio={ajustes.gap || '1rem'}
          puntos
          autoplay={ajustes.autoPlay !== false ? ajustes.autoPlaySpeed || 6000 : 0}
          etiqueta={ajustes.title || 'Marcas'}
        >
          {lista.map((m, i) => (
            <TarjetaMarca key={m.id} marca={m} indice={i} estilo={ajustes.brandCardStyle} mostrarNombre={ajustes.showBrandName !== false} />
          ))}
        </Carrusel>
      </>
    );
  }

  const banners = (ajustes.items || []).filter((b) => b?.imageUrl);
  if (!banners.length) return null;
  return (
    <>
      {titulo}
      <ul className={s.banners} style={{ '--columnas': columnas, '--espacio': ajustes.gap || '1rem' }}>
        {banners.map((b, k) => (
          <li key={b.id || k}>
            <Enlace to={b.link} className={s.banner}>
              <img src={toDirectImageUrl(b.imageUrl)} alt={b.alt || ''} loading="lazy" decoding="async" />
            </Enlace>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Fila de destacados (bestsellers_row) ───────────────── */
export function FilaDestacados({ ajustes = {} }) {
  const tarjetas = (ajustes.cards || []).filter((c) => c?.title || c?.imageUrl);
  if (!tarjetas.length) return null;
  return (
    <>
      <TituloSeccion {...tituloDesdeAjustes(ajustes)} />
      <Carrusel
        visibles={{ escritorio: Math.min(5, Math.max(3, tarjetas.length)), tablet: 3, movil: 2.3 }}
        espacio="0.75rem"
        etiqueta={ajustes.title || 'Destacados'}
      >
        {tarjetas.map((c, k) => (
          <Enlace key={c.id || k} to={c.link} className={s.destacado}>
            <span className={s.destacadoFoto} style={{ background: pastel(k) }}>
              <EtiquetaColgante tono={k === 0 ? 'oro' : 'violeta'} className={s.destacadoPuesto}>#{k + 1}</EtiquetaColgante>
              {c.imageUrl && <img src={toDirectImageUrl(c.imageUrl)} alt="" loading="lazy" decoding="async" draggable={false} />}
            </span>
            <span className={s.destacadoTexto}>
              {c.title && <strong style={{ textAlign: c.titleAlign || undefined }}>{c.title}</strong>}
              {c.subtitle && <small style={{ textAlign: c.subtitleAlign || undefined }}>{c.subtitle}</small>}
            </span>
          </Enlace>
        ))}
      </Carrusel>
    </>
  );
}
