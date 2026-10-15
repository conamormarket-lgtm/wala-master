import React, { useEffect, useRef, useState } from 'react';
import { Paintbrush, Users, User, Shirt, Upload, ShoppingBag } from 'lucide-react';
import { Enlace } from '../Enlace';
import { Etiqueta } from '../Etiquetas';
import { EtiquetaColgante, Sello, Trazo, Garabatos } from '../Marca';
import { soles } from '../TarjetaProducto';
import { FotoProducto } from './FotoProducto';
import s from './Crear.module.css';

/*
 * Piezas de Crear (/personalizar): la portada con los tres pasos, la tarjeta
 * de una prenda para diseñar, la de un combo y "¿Para cuántos?". Mismo
 * lenguaje que la tarjeta de producto: se inclina siguiendo al puntero, el
 * canto se ilumina y un barrido cruza la foto una vez (solo al pasar).
 */

/** Inclinación con el puntero (ratón), como TarjetaProducto y TarjetaCreacion. */
function useInclinar() {
  const ref = useRef(null);
  const mover = (e) => {
    if (e.pointerType !== 'mouse' || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    ref.current.style.setProperty('--mx', `${x * 100}%`);
    ref.current.style.setProperty('--my', `${y * 100}%`);
    ref.current.style.setProperty('--ry', `${(x - 0.5) * 8}deg`);
    ref.current.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
  };
  const salir = () => {
    ref.current?.style.setProperty('--rx', '0deg');
    ref.current?.style.setProperty('--ry', '0deg');
  };
  return { ref, onPointerMove: mover, onPointerLeave: salir };
}

/**
 * En el celular no hay "pasar el ratón": frente y espalda alternan solas
 * mientras la tarjeta se ve (useAlternarFotos de la tienda). Con ratón, el
 * cambio lo hace el CSS al pasar.
 */
function useAlternarSola(ref, activo) {
  const [espalda, setEspalda] = useState(false);
  useEffect(() => {
    const el = ref.current;
    const sinRaton = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches;
    const quieto = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!activo || !el || !sinRaton || quieto || typeof IntersectionObserver === 'undefined') return undefined;
    let t;
    const obs = new IntersectionObserver(([e]) => {
      clearInterval(t);
      if (e?.isIntersecting) t = setInterval(() => setEspalda((v) => !v), 2600);
      else setEspalda(false);
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => { obs.disconnect(); clearInterval(t); };
  }, [ref, activo]);
  return espalda;
}

/* ── Portada ─────────────────────────────────────────────── */

export const PASOS_CREAR = [
  { Icono: Shirt, titulo: 'Elige tu prenda', texto: 'Color y talla' },
  { Icono: Upload, titulo: 'Diseña', texto: 'Sube tu imagen o escribe un texto' },
  { Icono: ShoppingBag, titulo: 'Recíbela', texto: 'La imprimimos y te la enviamos' },
];

/**
 * La portada de Crear: el arte de Kapi diseñando (ancho en escritorio,
 * vertical en el celular) y, en el lado libre, el título con su trazo y los
 * tres pasos en sellos unidos por una costura punteada (como una prenda).
 *  - titulo, texto · pasos: [{ Icono, titulo, texto }] (PASOS_CREAR)
 *  - arte: { ancho, ancho1200, movil } las imágenes de /crear
 */
export function PortadaCrear({
  titulo = 'Crea tu prenda',
  texto = 'Elige una prenda, ponle tu imagen o tu frase y la imprimimos para ti.',
  pasos = PASOS_CREAR,
  arte = { ancho: '/crear/banner-crear.webp', ancho1200: '/crear/banner-crear-1200.webp', movil: '/crear/banner-crear-movil.webp' },
}) {
  return (
    <section className={s.portada} data-componente="PortadaCrear">
      <picture>
        <source media="(max-width: 768px)" srcSet={arte.movil} width="800" height="1067" />
        <img
          className={s.portadaArte}
          src={arte.ancho}
          srcSet={`${arte.ancho1200} 1200w, ${arte.ancho} 2172w`}
          sizes="(max-width: 1280px) 100vw, 1248px"
          alt=""
          aria-hidden="true"
          draggable={false}
          width="2172"
          height="724"
        />
      </picture>
      <div className={s.portadaTexto}>
        <Garabatos variante="titulo" className={s.portadaGarabatos} />
        <h1 className={s.portadaTitulo}>
          {titulo}
          <Trazo className={s.portadaTrazo} />
        </h1>
        <p className={s.portadaBajada}>{texto}</p>
        <ol className={s.pasos}>
          {pasos.map(({ Icono, titulo: t, texto: x }, i) => (
            <li key={t} className={s.paso} style={{ '--i': i }}>
              <span className={s.pasoSello}>
                <Sello tamano={42} girar={i % 2 ? 6 : -8}><Icono aria-hidden="true" /></Sello>
                <span className={s.pasoNumero} aria-hidden="true">{i + 1}</span>
              </span>
              <span className={s.pasoTextos}>
                <strong><span className={s.oculto}>{i + 1}. </span>{t}</strong>
                <span>{x}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Una prenda para diseñar ─────────────────────────────── */

/**
 * Una prenda base (polera, casaca…) para diseñar: frente y espalda (al pasar
 * el ratón, o solas en el celular), los lados que se pueden diseñar, sus
 * colores en puntos, "Desde S/" y "Diseñar".
 *  - nombre · frente, espalda (urls) · lados: ['Frente', 'Espalda']
 *  - colores: [{ id, nombre, fondo }] (fondo: color o degradado de bicolor)
 *  - precio · url · borrador (solo el admin: aún no se publica)
 */
export function TarjetaPrendaBase({ nombre, frente, espalda, lados = [], colores = [], precio, url, borrador = false }) {
  const inclinar = useInclinar();
  const fotoRef = useRef(null);
  const verEspalda = useAlternarSola(fotoRef, Boolean(frente && espalda));
  const visibles = colores.slice(0, 7);
  return (
    <Enlace to={url} className={s.tarjeta} data-componente="TarjetaPrendaBase" {...inclinar}>
      <span className={s.bordeLuz} aria-hidden="true" />
      <span ref={fotoRef} className={[s.foto, espalda && s.conEspalda, verEspalda && s.verEspalda].filter(Boolean).join(' ')}>
        <FotoProducto className={s.fotoFrente} src={frente} alt={nombre} relleno="6%" />
        {espalda && <FotoProducto className={s.fotoEspalda} src={espalda} alt="" relleno="6%" />}
        <span className={s.barrido} aria-hidden="true" />
        {borrador && <span className={s.etiquetas}><Etiqueta tono="aviso" sobreFoto>Borrador</Etiqueta></span>}
        {lados.length > 0 && <span className={s.lados} title="Lados que puedes diseñar">{lados.join(' + ')}</span>}
        {frente && espalda && (
          <span className={s.puntosFoto} aria-hidden="true"><i /><i /></span>
        )}
      </span>
      <span className={s.cuerpo}>
        <span className={s.nombre}>{nombre}</span>
        {visibles.length > 0 && (
          <span className={s.colores} aria-label={`${colores.length} ${colores.length === 1 ? 'color' : 'colores'}`}>
            {visibles.map((c, k) => <span key={c.id || k} className={s.color} style={{ background: c.fondo, '--k': k }} title={c.nombre} />)}
            {colores.length > 7 && <span className={s.colorMas}>+{colores.length - 7}</span>}
          </span>
        )}
        <span className={s.detalle}>{colores.length} {colores.length === 1 ? 'color' : 'colores'} · tu imagen o tu frase</span>
        <span className={s.pie}>
          <span className={s.precio}>
            <small>Desde</small>
            <strong>{soles(precio)}</strong>
          </span>
          <span className={s.cta}><Paintbrush aria-hidden="true" /> Diseñar</span>
        </span>
      </span>
    </Enlace>
  );
}

/* ── Un combo ────────────────────────────────────────────── */

/**
 * Un combo (pareja, trío, conjunto): sus prendas en abanico (se abren al
 * pasar el ratón), cuánto se ahorra en una etiqueta colgante, el precio del
 * paquete con el de por separado tachado y "Armar".
 *  - nombre · fotos: [url] (una por prenda) · prendas: ['Polera', 'Polera']
 *  - precio, sueltas (precio por separado) · url · borrador
 */
export function TarjetaComboCrear({ nombre, fotos = [], prendas = [], precio, sueltas, url, borrador = false }) {
  const inclinar = useInclinar();
  const ahorro = sueltas > precio ? sueltas - precio : 0;
  const nombres = [...new Set(prendas)];
  return (
    <Enlace to={url} className={s.tarjeta} data-componente="TarjetaComboCrear" {...inclinar}>
      <span className={s.bordeLuz} aria-hidden="true" />
      <span className={`${s.foto} ${s.fotoCombo}`}>
        <span className={s.abanico} style={{ '--n': fotos.length }}>
          {fotos.map((src, i) => <FotoProducto key={`${src}-${i}`} className={s.prenda} src={src} relleno="6%" style={{ '--i': i }} />)}
        </span>
        <span className={s.barrido} aria-hidden="true" />
        <span className={s.etiquetas}>
          {borrador && <Etiqueta tono="aviso" sobreFoto>Borrador</Etiqueta>}
          <Etiqueta tono="violeta" solida icono={<Users aria-hidden="true" />}>{fotos.length} prendas</Etiqueta>
        </span>
        {ahorro > 0 && (
          <EtiquetaColgante tono="magenta" tamano="sm" className={s.ahorro}>Ahorras {soles(ahorro)}</EtiquetaColgante>
        )}
      </span>
      <span className={s.cuerpo}>
        <span className={s.nombre}>{nombre}</span>
        <span className={s.detalle}>{nombres.join(' + ')} · cada una con su diseño</span>
        <span className={s.pie}>
          <span className={s.precio}>
            {ahorro > 0 && <small>Por separado <s>{soles(sueltas)}</s></small>}
            <strong>{soles(precio)}</strong>
          </span>
          <span className={s.cta}><Paintbrush aria-hidden="true" /> Armar</span>
        </span>
      </span>
    </Enlace>
  );
}

/* ── ¿Para cuántos? ──────────────────────────────────────── */

/**
 * "¿Para cuántos?": 1 son las prendas sueltas; 2, 3… los combos. La opción
 * elegida se pinta de violeta; las de combo llevan "Ahorras" en un sello.
 *  - opciones: [{ valor, texto, grupo }] (grupo: varias personas → ícono de dos)
 *  - valor · onCambiar(valor)
 */
export function ElegirPara({ opciones = [], valor, onCambiar }) {
  return (
    <div className={s.para} role="radiogroup" aria-label="¿Para cuántas personas?" data-componente="ElegirPara">
      {opciones.map((o) => {
        const activa = o.valor === valor;
        const Icono = o.grupo ? Users : User;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activa}
            className={[s.paraOpcion, activa && s.paraActiva].filter(Boolean).join(' ')}
            onClick={() => onCambiar?.(o.valor)}
          >
            <Icono aria-hidden="true" />
            {o.texto}
            {o.valor > 1 && <span className={s.paraAhorra}>Ahorras</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Nombre de cada opción de "¿Para cuántos?" (etiquetaPara de la tienda): si
 * los combos de ese tamaño mezclan prendas distintas son un conjunto para una
 * persona, no prendas iguales para varias.
 */
export const textoPara = (n, conjunto) => {
  if (n === 1) return 'Para ti';
  if (conjunto) return 'Conjunto';
  return n === 2 ? 'En pareja' : `Para ${n}`;
};
