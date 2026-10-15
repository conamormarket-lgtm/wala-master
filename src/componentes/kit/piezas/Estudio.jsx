import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  Undo2, Redo2, Minus, Plus, Crosshair, Trash2, ImagePlus, Type, ZoomIn, ZoomOut, Keyboard, Check,
  Copy, ArrowUpToLine, ArrowDownToLine, RotateCw, FlipHorizontal, Crop, Eraser, Maximize2,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react';
import Boton from '../Boton';
import Acordeon from '../Acordeon';
import { Chip } from '../Etiquetas';
import { Campo, Cantidad, Casilla, Deslizador, Interruptor, SelectorColor } from '../Formulario';
import { Sello } from '../Marca';
import s from './Estudio.module.css';

/*
 * Piezas del estudio de Crear (/crear/:id): el lienzo de vista previa, la
 * barra rápida, los tres pasos y el panel de lo elegido (texto o imagen).
 * En la tienda el lienzo que se arrastra es fabric.js (CrearStudioPage);
 * aquí LienzoPrenda dibuja lo mismo para verlo y elegir, y todo lo demás
 * (paneles, botones, avisos) es el diseño que la tienda tomaría.
 */

/** Alto de una zona como fracción del alto de la foto (altoZonaFraccion). */
const altoZona = (z, anchoImg, altoImg) => (anchoImg && altoImg ? (z.w * anchoImg * z.proporcion) / altoImg : z.w);

/*
 * Los efectos del texto usan los mismos campos y unidades que el estudio de la
 * tienda (pages/Crear/renderDiseno.js, propiedadesTexto), así PanelCapa
 * recibe la capa de fabric tal cual:
 *  - contorno: grosor visible en % del tamaño de letra (contornoColor); va
 *    detrás de la letra. sinRelleno: la letra queda hueca (solo el contorno).
 *  - sombra: distancia en % del tamaño (sombraColor), sólida, sin desenfoque.
 *  - curva: −100 a 100 (∩ positiva, ∪ negativa) · espaciado: milésimas de
 *    letra · interlineado · alineacion: 'left' | 'center' | 'right'.
 */
const efectoNum = (v) => Number(v) || 0;

/** CSS de un texto recto en el lienzo (el tamaño va en cqw de su zona). */
const estiloTexto = (c) => {
  const contorno = efectoNum(c.contorno);
  const sombra = efectoNum(c.sombra);
  return {
    fontFamily: c.fuente ? `'${c.fuente}', var(--fuente-marca)` : undefined,
    fontSize: `${(c.tamano ?? 0.18) * 100}cqw`,
    color: contorno > 0 && c.sinRelleno ? 'transparent' : c.color,
    fontWeight: c.negrita ? 900 : 400,
    fontStyle: c.cursiva ? 'italic' : undefined,
    // El trazo va centrado en el borde: el doble, para que lo visible sea `contorno`.
    WebkitTextStroke: contorno > 0 ? `${(contorno * 2) / 100}em ${c.contornoColor || '#ffffff'}` : undefined,
    textShadow: sombra > 0 ? `${sombra / 100}em ${sombra / 100}em 0 ${c.sombraColor || '#111111'}` : undefined,
    letterSpacing: efectoNum(c.espaciado) ? `${efectoNum(c.espaciado) / 1000}em` : undefined,
    lineHeight: Number(c.interlineado) || 1.05,
    textAlign: c.alineacion || 'center',
  };
};

const LIMITE_CURVA = (300 * Math.PI) / 180;

/**
 * Un texto sobre un arco del largo justo del texto, como curvarTexto de la
 * tienda: se mide el texto y se arma el arco; un texto curvo va en una línea.
 * En SVG, con la letra a 100 unidades: así el contorno y la sombra escalan con
 * ella.
 */
function TextoCurvo({ capa: c }) {
  const medida = useRef(null);
  const dibujo = useRef(null);
  const [arco, setArco] = useState(null);
  const [caja, setCaja] = useState(null);
  const curva = Math.max(-100, Math.min(100, efectoNum(c.curva)));
  const texto = String(c.texto || ' ').replace(/\s*\n\s*/g, ' ');
  const contorno = efectoNum(c.contorno);
  const sombra = efectoNum(c.sombra);
  const espaciado = efectoNum(c.espaciado);
  const comun = {
    fontFamily: c.fuente ? `'${c.fuente}', var(--fuente-marca)` : undefined,
    fontWeight: c.negrita ? 900 : 400,
    fontStyle: c.cursiva ? 'italic' : undefined,
    fontSize: 100,
    letterSpacing: espaciado ? `${espaciado / 1000}em` : undefined,
    textAnchor: 'middle',
  };

  // 1) El arco del largo del texto (como curvarTexto).
  useLayoutEffect(() => {
    const el = medida.current;
    if (!el) return;
    const largo = Math.max(1, el.getComputedTextLength()) * 1.04 + 10;
    const angulo = (Math.abs(curva) / 100) * LIMITE_CURVA;
    const r = largo / angulo;
    const x = Math.sin(angulo / 2) * r;
    const y = Math.cos(angulo / 2) * r;
    const grande = angulo > Math.PI ? 1 : 0;
    setArco(curva > 0
      ? `M ${-x} ${-y} A ${r} ${r} 0 ${grande} 1 ${x} ${-y}`
      : `M ${-x} ${y} A ${r} ${r} 0 ${grande} 0 ${x} ${y}`);
  }, [texto, curva, espaciado, c.fuente, c.negrita, c.cursiva]);

  // 2) El recuadro de lo dibujado (con el contorno y la sombra), para el viewBox.
  useLayoutEffect(() => {
    if (!arco || !dibujo.current) return;
    const b = dibujo.current.getBBox();
    const borde = contorno + 4;
    setCaja({ x: b.x - borde, y: b.y - borde, w: b.width + borde * 2, h: b.height + borde * 2 });
  }, [arco, contorno, sombra, texto]);

  const id = `arco-${c.id}`;
  const linea = (props) => (
    <text {...comun} {...props}>
      <textPath href={`#${id}`} startOffset="50%">{texto}</textPath>
    </text>
  );
  return (
    <svg
      className={s.textoCurvo}
      viewBox={caja ? `${caja.x} ${caja.y} ${caja.w} ${caja.h}` : '0 0 1 1'}
      // La letra mide 100 unidades = tamano de la zona.
      style={{ width: caja ? `${(caja.w / 100) * (c.tamano ?? 0.18) * 100}cqw` : 0 }}
      aria-label={texto}
      role="img"
    >
      {/* Medida del texto en una línea (invisible). */}
      <text ref={medida} {...comun} x={0} y={-10000} opacity={0} aria-hidden="true">{texto}</text>
      {arco && (
        <g ref={dibujo}>
          <defs><path id={id} d={arco} /></defs>
          {sombra > 0 && (
            <g transform={`translate(${sombra} ${sombra})`}>
              {linea({ fill: c.sombraColor || '#111111', stroke: contorno > 0 ? (c.sombraColor || '#111111') : undefined, strokeWidth: contorno * 2, strokeLinejoin: 'round' })}
            </g>
          )}
          {contorno > 0 && linea({ fill: 'none', stroke: c.contornoColor || '#ffffff', strokeWidth: contorno * 2, strokeLinejoin: 'round' })}
          {linea({ fill: contorno > 0 && c.sinRelleno ? 'none' : (c.color || '#111111') })}
        </g>
      )}
    </svg>
  );
}

/**
 * La prenda de un lado con sus zonas punteadas y los diseños encima. Las
 * capas se arrastran con el dedo o el ratón dentro de su zona.
 *  - imagen: foto del lado (en blanco) · foto: la del color, si existe
 *  - tinte: color para teñir la foto blanca (cuando no hay foto del color)
 *  - voltear: bicolor al revés (la foto en espejo)
 *  - anchoImg, altoImg · zonas: [{ id, nombre, x, y, w, proporcion, angulo }]
 *  - capas: { [zonaId]: [{ id, tipo: 'imagen' | 'texto', src, texto, fuente,
 *    color, x, y (centro, 0–1 de la zona), ancho (0–1 de la zona), angulo,
 *    tamano (alto de letra, 0–1 del ancho de la zona), negrita, cursiva,
 *    contorno, sombra, voltear }] }
 *  - zonaActiva · seleccion: id de la capa elegida · oscura: prenda oscura
 *    (las guías van en blanco) · guias: false para la foto final (sin zonas)
 *  - onElegirZona(id) · onElegirCapa(id, zonaId) · onMoverCapa(id, { x, y })
 *    mientras se arrastra · onSoltarCapa() al terminar (para deshacer)
 *  - zoom · encima: lo que va sobre el lienzo (empezar, cargando…)
 */
export function LienzoPrenda({
  imagen, foto, tinte, voltear = false, anchoImg = 1000, altoImg = 1200, zonas = [], capas = {},
  zonaActiva, seleccion, oscura = false, guias = true, onElegirZona, onElegirCapa, onMoverCapa, onSoltarCapa,
  encima, zoom = 1, className,
}) {
  const arrastre = useRef(null);

  const empezar = (e, c, zonaId) => {
    e.stopPropagation();
    onElegirCapa?.(c.id, zonaId);
    if (!onMoverCapa) return;
    const caja = e.currentTarget.closest('[data-zona]').getBoundingClientRect();
    arrastre.current = { id: c.id, caja, dx: e.clientX - (caja.left + (c.x ?? 0.5) * caja.width), dy: e.clientY - (caja.top + (c.y ?? 0.5) * caja.height), movio: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const mover = (e) => {
    const a = arrastre.current;
    if (!a) return;
    const x = Math.min(1, Math.max(0, (e.clientX - a.dx - a.caja.left) / a.caja.width));
    const y = Math.min(1, Math.max(0, (e.clientY - a.dy - a.caja.top) / a.caja.height));
    a.movio = true;
    onMoverCapa(a.id, { x, y });
  };
  const soltar = () => {
    if (arrastre.current?.movio) onSoltarCapa?.();
    arrastre.current = null;
  };

  const espejo = voltear ? { transform: 'scaleX(-1)' } : undefined;
  return (
    <div className={[s.lienzo, oscura && s.oscura, className].filter(Boolean).join(' ')} data-componente="LienzoPrenda">
      <div className={s.lienzoEscala} style={{ aspectRatio: `${anchoImg} / ${altoImg}`, '--proporcion': anchoImg / altoImg, transform: zoom !== 1 ? `scale(${zoom})` : undefined }}>
        {/* Sin foto del color: la foto blanca teñida (el color recortado con su silueta + multiply). */}
        {!foto && tinte && <span className={s.tinte} style={{ ...espejo, background: tinte, WebkitMaskImage: `url("${imagen}")`, maskImage: `url("${imagen}")` }} aria-hidden="true" />}
        <img className={[s.prenda, !foto && tinte && s.prendaTenida].filter(Boolean).join(' ')} style={espejo} src={foto || imagen} alt="" draggable={false} />
        {/* En una prenda oscura el multiply apaga los pliegues: la foto vuelve, tenue, como luz. */}
        {!foto && tinte && oscura && <img className={s.luz} style={espejo} src={imagen} alt="" draggable={false} aria-hidden="true" />}
        {zonas.map((z) => {
          const activa = guias && z.id === zonaActiva;
          return (
            <div
              key={z.id}
              data-zona={z.id}
              className={[s.zona, !guias && s.sinGuia, activa && s.zonaActiva].filter(Boolean).join(' ')}
              style={{
                left: `${z.x * 100}%`,
                top: `${z.y * 100}%`,
                width: `${z.w * 100}%`,
                height: `${altoZona(z, anchoImg, altoImg) * 100}%`,
                transform: z.angulo ? `rotate(${z.angulo}deg)` : undefined,
              }}
              onClick={guias ? () => onElegirZona?.(z.id) : undefined}
              role={guias ? 'button' : undefined}
              tabIndex={guias ? 0 : undefined}
              aria-label={guias ? `Zona ${z.nombre}` : undefined}
              onKeyDown={guias ? (e) => { if (e.key === 'Enter') onElegirZona?.(z.id); } : undefined}
            >
              <div className={s.recorte}>
                {(capas[z.id] || []).map((c) => (
                  <span
                    key={c.id}
                    className={[s.capa, guias && c.id === seleccion && s.capaElegida].filter(Boolean).join(' ')}
                    style={{
                      left: `${(c.x ?? 0.5) * 100}%`,
                      top: `${(c.y ?? 0.5) * 100}%`,
                      width: c.tipo === 'imagen' ? `${(c.ancho ?? 0.8) * 100}%` : undefined,
                      transform: `translate(-50%, -50%) rotate(${c.angulo || 0}deg)${c.voltear ? ' scaleX(-1)' : ''}`,
                    }}
                    onPointerDown={guias ? (e) => empezar(e, c, z.id) : undefined}
                    onPointerMove={guias ? mover : undefined}
                    onPointerUp={guias ? soltar : undefined}
                    onPointerCancel={guias ? soltar : undefined}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.tipo === 'imagen' ? (
                      <img src={c.src} alt="" draggable={false} />
                    ) : efectoNum(c.curva) ? (
                      <TextoCurvo capa={c} />
                    ) : (
                      <span className={s.texto} style={estiloTexto(c)}>{c.texto}</span>
                    )}
                  </span>
                ))}
              </div>
              {activa && <span className={s.zonaNombre} style={z.angulo ? { transform: `translateX(-50%) rotate(${-z.angulo}deg)` } : undefined}>{z.nombre}</span>}
            </div>
          );
        })}
      </div>
      {encima}
    </div>
  );
}

/**
 * La barra rápida bajo el lienzo: deshacer y rehacer; con algo elegido,
 * achicar, agrandar, centrar y quitar; siempre, + Imagen y + Texto; el zoom
 * y los atajos.
 *  - puedeDeshacer, puedeRehacer, onDeshacer, onRehacer · elegido (bool)
 *  - onAchicar, onAgrandar, onCentrar, onQuitar · onImagen, onTexto
 *  - zoom, onZoom(z) · onAtajos
 */
export function BarraLienzo({
  puedeDeshacer, puedeRehacer, onDeshacer, onRehacer, elegido = false,
  onAchicar, onAgrandar, onCentrar, onQuitar, onImagen, onTexto, zoom = 1, onZoom, onAtajos,
}) {
  const NIVELES = [1, 1.5, 2, 3, 4];
  const i = NIVELES.indexOf(zoom);
  const B = (props) => <Boton variante="fantasma" tamano="sm" soloIcono {...props} />;
  return (
    <div className={s.barra} role="toolbar" aria-label="Herramientas del lienzo" data-componente="BarraLienzo">
      <span className={s.grupoBarra}>
        <B aria-label="Deshacer" icono={<Undo2 aria-hidden="true" />} disabled={!puedeDeshacer} onClick={onDeshacer} />
        <B aria-label="Rehacer" icono={<Redo2 aria-hidden="true" />} disabled={!puedeRehacer} onClick={onRehacer} />
      </span>
      {elegido && (
        <span className={s.grupoBarra}>
          <B aria-label="Achicar" icono={<Minus aria-hidden="true" />} onClick={onAchicar} />
          <B aria-label="Agrandar" icono={<Plus aria-hidden="true" />} onClick={onAgrandar} />
          <B aria-label="Centrar" icono={<Crosshair aria-hidden="true" />} onClick={onCentrar} />
          <Boton variante="fantasma" tamano="sm" soloIcono aria-label="Quitar" icono={<Trash2 aria-hidden="true" />} onClick={onQuitar} className={s.peligro} />
        </span>
      )}
      <span className={s.grupoBarra}>
        <Boton variante="contorno" tamano="sm" icono={<ImagePlus aria-hidden="true" />} onClick={onImagen}>Imagen</Boton>
        <Boton variante="contorno" tamano="sm" icono={<Type aria-hidden="true" />} onClick={onTexto}>Texto</Boton>
      </span>
      {/* En el celular se acerca con los dedos: el zoom queda para el ratón. */}
      <span className={[s.grupoBarra, s.grupoZoom].join(' ')}>
        <B aria-label="Alejar" icono={<ZoomOut aria-hidden="true" />} disabled={i <= 0} onClick={() => onZoom?.(NIVELES[Math.max(0, i - 1)])} />
        <button type="button" className={s.zoomValor} onClick={() => onZoom?.(1)} title="Ver la prenda completa">{Math.round(zoom * 100)}%</button>
        <B aria-label="Acercar" icono={<ZoomIn aria-hidden="true" />} disabled={i >= NIVELES.length - 1} onClick={() => onZoom?.(NIVELES[Math.min(NIVELES.length - 1, i + 1)])} />
        {onAtajos && <B aria-label="Atajos de teclado" icono={<Keyboard aria-hidden="true" />} onClick={onAtajos} className={s.soloRaton} />}
      </span>
    </div>
  );
}

/** Un paso del panel, con su número en un sello. */
export function PasoEstudio({ numero, titulo, detalle, children }) {
  return (
    <section className={s.paso} data-componente="PasoEstudio">
      <h2 className={s.pasoTitulo}>
        <Sello tamano={30} girar={numero % 2 ? -8 : 6}><b className={s.pasoNumero}>{numero}</b></Sello>
        <span>{titulo}{detalle && <em>: {detalle}</em>}</span>
      </h2>
      {children}
    </section>
  );
}

/**
 * Los tres pasos sin nada elegido: el color de la prenda, la zona donde va el
 * diseño (por lado) y agregar una imagen o un texto.
 *  - colores: [{ id, nombre, hex, claro }] · color (id) · onColor(id)
 *  - invertir: { activo, texto, onCambiar } (colores con versión al revés)
 *  - lados: [{ nombre, zonas: [{ id, nombre, conDiseno }] }] · zona · onZona(id)
 *  - onImagen, onTexto · subiendo · donde: "Frente · Pecho"
 */
export function PasosEstudio({ colores = [], color, onColor, invertir, lados = [], zona, onZona, onImagen, onTexto, subiendo = false, donde }) {
  const actual = colores.find((c) => c.id === color);
  return (
    <div className={s.pasos} data-componente="PasosEstudio">
      <PasoEstudio numero={1} titulo="Elige el color" detalle={actual?.nombre}>
        <SelectorColor etiqueta="Color de la prenda" colores={colores} valor={actual?.nombre} onChange={(nombre) => onColor?.(colores.find((c) => c.nombre === nombre)?.id)} />
        {invertir && <Interruptor activo={invertir.activo} onChange={invertir.onCambiar} etiqueta="Invertir colores" descripcion={invertir.texto} />}
      </PasoEstudio>
      <PasoEstudio numero={2} titulo="¿Dónde va tu diseño?">
        {lados.map((l) => (
          <div key={l.nombre} className={s.lado}>
            <span className={s.ladoNombre}>{l.nombre}</span>
            <div className={s.chips}>
              {l.zonas.map((z) => (
                <Chip key={z.id} tamano="sm" activo={z.id === zona} onClick={() => onZona?.(z.id)}>
                  {z.nombre}{z.conDiseno && <span className={s.conDiseno} title="Con diseño"><span className={s.oculto}>, con diseño</span></span>}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </PasoEstudio>
      <PasoEstudio numero={3} titulo="Agrega tu imagen o tu texto">
        <div className={s.agregar}>
          <button type="button" className={s.agregarOpcion} onClick={onImagen} disabled={subiendo}>
            <Sello tamano={42} girar={-8}><ImagePlus aria-hidden="true" /></Sello>
            <strong>Subir imagen</strong>
            <small>Una foto o un logo</small>
          </button>
          <button type="button" className={s.agregarOpcion} onClick={onTexto}>
            <Sello tamano={42} girar={6} tono="rosa"><Type aria-hidden="true" /></Sello>
            <strong>Escribir texto</strong>
            <small>Un nombre o una frase</small>
          </button>
        </div>
        {donde && <p className={s.donde}>{subiendo ? 'Subiendo tu imagen…' : <>Se agrega en: <strong>{donde}</strong></>}</p>}
      </PasoEstudio>
    </div>
  );
}

/** Los colores de la letra, el contorno y la sombra (los mismos de la tienda). */
export const COLORES_TEXTO = [
  ['Blanco', '#FFFFFF', true], ['Negro', '#111111'], ['Violeta', '#7C3AED'], ['Rojo', '#E11D48'],
  ['Ámbar', '#F59E0B'], ['Verde', '#10B981'], ['Azul', '#2563EB'], ['Rosa', '#F472B6'],
].map(([nombre, hex, claro]) => ({ nombre, hex, claro }));

/** Blanco o negro, el que más resalta junto a ese color. */
const contrasteDe = (hex = '#111111') => {
  const h = String(hex).replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.length === 3 ? h[i / 2] + h[i / 2] : h.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? '#111111' : '#FFFFFF';
};

// Estilos de un toque (los de EfectosTexto de la tienda). Todos se imprimen
// bien: sin degradados ni desenfoques.
const ESTILOS = [
  { id: 'normal', nombre: 'Normal', cambios: () => ({ contorno: 0, sombra: 0, curva: 0, espaciado: 0, sinRelleno: false }) },
  { id: 'contorno', nombre: 'Contorno', cambios: (c) => ({ contorno: 8, contornoColor: contrasteDe(c.color), sombra: 0 }) },
  { id: 'sombra', nombre: 'Sombra', cambios: (c) => ({ sombra: 6, sombraColor: contrasteDe(c.color), contorno: 0 }) },
  { id: 'arco', nombre: 'Arco', cambios: () => ({ curva: 45 }) },
  { id: 'sticker', nombre: 'Sticker', cambios: () => ({ contorno: 14, contornoColor: '#FFFFFF', sombra: 5, sombraColor: '#111111' }) },
];

/** Cuál de los estilos de un toque es la capa ahora (para marcarlo). */
const estiloDe = (c) => {
  const contorno = efectoNum(c.contorno);
  const sombra = efectoNum(c.sombra);
  if (efectoNum(c.curva) && !contorno && !sombra) return 'arco';
  if (contorno === 14 && sombra === 5) return 'sticker';
  if (contorno && !sombra) return 'contorno';
  if (sombra && !contorno) return 'sombra';
  if (!contorno && !sombra && !efectoNum(c.curva)) return 'normal';
  return null;
};

/**
 * El estilo de la letra: los cinco estilos de un toque y, plegado, lo fino:
 * contorno (color, grosor, letra hueca), sombra (color, distancia), curva
 * con "Enderezar", espacio entre letras y, con varias líneas, la alineación
 * y el interlineado. Los campos son los de la tienda (ver estiloTexto).
 *  - capa · onCambiar(cambios)
 */
export function EfectosTexto({ capa, onCambiar }) {
  const contorno = efectoNum(capa.contorno);
  const sombra = efectoNum(capa.sombra);
  const curva = efectoNum(capa.curva);
  const espaciado = efectoNum(capa.espaciado);
  const variasLineas = /\n/.test(capa.texto || '') && !curva;
  const alineacion = capa.alineacion || 'center';
  const activo = estiloDe(capa);
  const afinado = contorno > 0 || sombra > 0 || curva !== 0 || espaciado !== 0;
  const colorLibre = (campo, porDefecto) => (
    <SelectorColor
      etiqueta={campo === 'contornoColor' ? 'Color del contorno' : 'Color de la sombra'}
      colores={COLORES_TEXTO}
      libre={{ hex: capa[campo] || porDefecto, onCambiar: (hex) => onCambiar?.({ [campo]: hex }) }}
    />
  );
  return (
    <div className={s.efectos} data-componente="EfectosTexto">
      <div className={s.grupoCampo}>
        <span className={s.rotulo}>Estilo de la letra</span>
        <span className={s.estilos}>
          {ESTILOS.map((e) => (
            <button
              key={e.id}
              type="button"
              className={[s.estilo, activo === e.id && s.estiloActivo].filter(Boolean).join(' ')}
              onClick={() => onCambiar?.(e.cambios(capa))}
              aria-pressed={activo === e.id}
            >
              <span className={[s.estiloMuestra, s[`muestra_${e.id}`]].filter(Boolean).join(' ')}>Aa</span>
              {e.nombre}
            </button>
          ))}
        </span>
      </div>

      <Acordeon
        variante="lista"
        abiertoInicial={afinado ? 'fino' : false}
        items={[{
          id: 'fino',
          question: 'Personalizar contorno, sombra y curva',
          answer: (
            <div className={s.fino}>
              <div className={s.efecto}>
                <Interruptor
                  activo={contorno > 0}
                  etiqueta="Contorno"
                  onChange={(on) => onCambiar?.(on
                    ? { contorno: 8, contornoColor: capa.contornoColor || contrasteDe(capa.color) }
                    : { contorno: 0, sinRelleno: false })}
                />
                {contorno > 0 && (
                  <div className={s.efectoCuerpo}>
                    {colorLibre('contornoColor', '#FFFFFF')}
                    <Deslizador etiqueta="Grosor" valor={contorno} min={1} max={25} onChange={(v) => onCambiar?.({ contorno: v })} />
                    <Casilla activo={Boolean(capa.sinRelleno)} onChange={(v) => onCambiar?.({ sinRelleno: v })} etiqueta="Letra transparente" descripcion="Solo se ve (y se imprime) el contorno." />
                  </div>
                )}
              </div>
              <div className={s.efecto}>
                <Interruptor
                  activo={sombra > 0}
                  etiqueta="Sombra"
                  onChange={(on) => onCambiar?.(on ? { sombra: 6, sombraColor: capa.sombraColor || contrasteDe(capa.color) } : { sombra: 0 })}
                />
                {sombra > 0 && (
                  <div className={s.efectoCuerpo}>
                    {colorLibre('sombraColor', '#111111')}
                    <Deslizador etiqueta="Distancia" valor={sombra} min={1} max={20} onChange={(v) => onCambiar?.({ sombra: v })} />
                  </div>
                )}
              </div>
              <div className={s.efecto}>
                <Deslizador
                  etiqueta="Curva"
                  valor={curva}
                  min={-100}
                  max={100}
                  formato={(v) => (v === 0 ? 'Recta' : v > 0 ? `Arco ${v}` : `Hacia abajo ${-v}`)}
                  // Cerca del medio se queda recta: fácil de volver a 0.
                  onChange={(v) => onCambiar?.({ curva: Math.abs(v) < 5 ? 0 : v })}
                />
                {curva !== 0 && <Boton variante="fantasma" tamano="sm" onClick={() => onCambiar?.({ curva: 0 })}>Enderezar</Boton>}
              </div>
              <div className={s.efecto}>
                <Deslizador
                  etiqueta="Espacio entre letras"
                  valor={espaciado}
                  min={-100}
                  max={800}
                  paso={10}
                  formato={(v) => (v === 0 ? 'Normal' : v > 0 ? `+${v}` : v)}
                  onChange={(v) => onCambiar?.({ espaciado: v })}
                />
              </div>
              {variasLineas && (
                <div className={s.efecto}>
                  <span className={s.rotulo}>Alineación</span>
                  <span className={s.chips}>
                    {[['left', AlignLeft, 'Izquierda'], ['center', AlignCenter, 'Centro'], ['right', AlignRight, 'Derecha']].map(([valor, Icono, nombre]) => (
                      <Chip key={valor} tamano="sm" activo={alineacion === valor} onClick={() => onCambiar?.({ alineacion: valor })} icono={<Icono aria-hidden="true" />}>
                        <span className={s.oculto}>{nombre}</span>
                      </Chip>
                    ))}
                  </span>
                  <Deslizador etiqueta="Interlineado" valor={Number(capa.interlineado) || 1.05} min={0.7} max={2} paso={0.05} formato={(v) => v.toFixed(2)} onChange={(v) => onCambiar?.({ interlineado: v })} />
                </div>
              )}
            </div>
          ),
        }]}
      />
    </div>
  );
}

const ALINEAR = [
  ['izquierda', AlignStartVertical, 'Izquierda'], ['centroH', AlignCenterVertical, 'Al centro'], ['derecha', AlignEndVertical, 'Derecha'],
  ['arriba', AlignStartHorizontal, 'Arriba'], ['centroV', AlignCenterHorizontal, 'Al medio'], ['abajo', AlignEndHorizontal, 'Abajo'],
];

/**
 * El panel de lo elegido (una imagen o un texto): sus ajustes, que se ven en
 * la prenda al instante, y "Listo" para volver a los pasos.
 *  - capa (ver LienzoPrenda) · zona: nombre · onCambiar(cambios) · onListo
 *  - fuentes: [{ valor, texto, detalle (su grupo) }] · calidad: 'buena' | 'aceptable' | 'baja'
 *  - onAchicar, onAgrandar, onCentrar, onAlinear(donde), onQuitar, onDuplicar,
 *    onAdelante, onAtras, onRecortar, onQuitarFondo, onLlenar
 *  - zonas: [{ id, nombre }] · onPasarAZona(id) · sinSesion: recortar y quitar fondo apagados
 *  - anchoZonaCm: ancho real de la zona; con él, el tamaño de la letra va en
 *    cm (alto de la letra), como en la tienda · fueraDeZona: una parte queda
 *    fuera y no se imprimirá
 */
export function PanelCapa({
  capa, zona, onCambiar, onListo, fuentes = [], calidad,
  onAchicar, onAgrandar, onCentrar, onAlinear, onQuitar, onDuplicar, onAdelante, onAtras,
  onRecortar, onQuitarFondo, onLlenar, zonas = [], onPasarAZona, sinSesion = false,
  anchoZonaCm, fueraDeZona = false,
}) {
  if (!capa) return null;
  const imagen = capa.tipo === 'imagen';
  const tamano = capa.tamano ?? 0.18;
  const CALIDAD = {
    buena: ['ok', 'Se imprimirá con buena calidad.'],
    aceptable: ['aviso', 'Calidad aceptable. Si la achicas un poco se verá más nítida.'],
    regular: ['aviso', 'Calidad aceptable. Si la achicas un poco se verá más nítida.'],
    baja: ['mal', 'Se verá borrosa a este tamaño. Achícala o usa una imagen más grande.'],
  }[calidad];
  return (
    <div className={s.panelCapa} data-componente="PanelCapa">
      <header className={s.panelCabeza}>
        <div>
          <h2 className={s.panelTitulo}>{imagen ? 'Tu imagen' : 'Tu texto'} <em>en {zona}</em></h2>
          <p className={s.panelAyuda}>Los cambios se ven en la prenda al instante.</p>
        </div>
        <Boton tamano="sm" icono={<Check aria-hidden="true" />} onClick={onListo}>Listo</Boton>
      </header>

      {imagen && CALIDAD && <p className={[s.calidad, s[`calidad_${CALIDAD[0]}`]].join(' ')}>{CALIDAD[1]}</p>}
      {fueraDeZona && <p className={[s.calidad, s.calidad_aviso].join(' ')}>Una parte queda fuera de la zona y no se imprimirá.</p>}

      {!imagen && (
        <>
          <Campo
            etiqueta="Escribe tu texto"
            control={(aria) => (
              <textarea {...aria} className={s.areaTexto} rows={2} maxLength={120} value={capa.texto || ''} onChange={(e) => onCambiar?.({ texto: e.target.value })} />
            )}
          />
          {fuentes.length > 0 && (
            <Campo etiqueta="Letra" opciones={fuentes.map((f) => ({ ...f, icono: <span className={s.muestraLetra} style={{ fontFamily: `'${f.valor}'` }}>Aa</span> }))} buscable value={capa.fuente} onChange={(e) => onCambiar?.({ fuente: e.target.value })} />
          )}
          <div className={s.fila}>
            <div className={s.grupoCampo}>
              <span className={s.rotulo}>{anchoZonaCm ? 'Alto de la letra' : 'Tamaño de letra'}</span>
              {anchoZonaCm ? (
                // En cm de la prenda, como en la tienda: el alto de la letra.
                <Cantidad
                  editable
                  etiqueta="Alto de la letra en centímetros"
                  valor={Math.round(tamano * anchoZonaCm * 10) / 10}
                  min={0.3}
                  max={Math.round(anchoZonaCm * 0.6 * 10) / 10}
                  paso={0.5}
                  decimales={1}
                  sufijo="cm"
                  onChange={(cm) => onCambiar?.({ tamano: cm / anchoZonaCm })}
                />
              ) : (
                <Cantidad editable etiqueta="Tamaño de la letra" valor={Math.round(tamano * 100)} min={4} max={60} sufijo="pt" onChange={(v) => onCambiar?.({ tamano: v / 100 })} />
              )}
            </div>
            <div className={s.grupoCampo}>
              <span className={s.rotulo}>Estilo</span>
              <span className={s.chips}>
                <Chip tamano="sm" activo={Boolean(capa.negrita)} onClick={() => onCambiar?.({ negrita: !capa.negrita })}><b>N</b><span className={s.oculto}> negrita</span></Chip>
                <Chip tamano="sm" activo={Boolean(capa.cursiva)} onClick={() => onCambiar?.({ cursiva: !capa.cursiva })}><i>C</i><span className={s.oculto}> cursiva</span></Chip>
              </span>
            </div>
          </div>
          <SelectorColor
            etiqueta="Color de la letra"
            colores={COLORES_TEXTO}
            libre={{ hex: capa.color || '#111111', onCambiar: (hex) => onCambiar?.({ color: hex }) }}
          />
          <EfectosTexto capa={capa} onCambiar={onCambiar} />
        </>
      )}

      <div className={s.grupoCampo}>
        <span className={s.rotulo}>Ajustar</span>
        <span className={s.chips}>
          <Boton variante="contorno" tamano="sm" icono={<Minus aria-hidden="true" />} onClick={onAchicar}>Achicar</Boton>
          <Boton variante="contorno" tamano="sm" icono={<Plus aria-hidden="true" />} onClick={onAgrandar}>Agrandar</Boton>
          <Boton variante="contorno" tamano="sm" icono={<Crosshair aria-hidden="true" />} onClick={onCentrar}>Centrar</Boton>
          {imagen && <Boton variante="contorno" tamano="sm" icono={<Eraser aria-hidden="true" />} onClick={onQuitarFondo} disabled={sinSesion}>Quitar fondo</Boton>}
          {imagen && <Boton variante="contorno" tamano="sm" icono={<Crop aria-hidden="true" />} onClick={onRecortar} disabled={sinSesion}>Recortar</Boton>}
          {imagen && <Boton variante="contorno" tamano="sm" icono={<Maximize2 aria-hidden="true" />} onClick={onLlenar}>Llenar zona</Boton>}
          {/* De 90° en 90°, como la tecla R de la tienda. */}
          <Boton variante="contorno" tamano="sm" icono={<RotateCw aria-hidden="true" />} onClick={() => onCambiar?.({ angulo: (Math.round((capa.angulo || 0) / 90) * 90 + 90) % 360 })}>Girar</Boton>
          <Boton variante="contorno" tamano="sm" icono={<Trash2 aria-hidden="true" />} onClick={onQuitar} className={s.peligro}>Quitar</Boton>
        </span>
        {sinSesion && imagen && <span className={s.nota}>Inicia sesión para recortar o quitar el fondo.</span>}
      </div>

      <div className={s.grupoCampo}>
        <span className={s.rotulo}>Alinear en la zona</span>
        <span className={s.alinear}>
          {ALINEAR.map(([id, Icono, texto]) => (
            <Boton key={id} variante="contorno" tamano="sm" soloIcono aria-label={texto} title={texto} icono={<Icono aria-hidden="true" />} onClick={() => onAlinear?.(id)} />
          ))}
        </span>
      </div>

      <Acordeon
        variante="lista"
        items={[{
          id: 'mas',
          question: 'Más opciones',
          answer: (
            <div className={s.mas}>
              <span className={s.chips}>
                {imagen && <Boton variante="fantasma" tamano="sm" icono={<FlipHorizontal aria-hidden="true" />} onClick={() => onCambiar?.({ voltear: !capa.voltear })}>Voltear</Boton>}
                <Boton variante="fantasma" tamano="sm" icono={<ArrowUpToLine aria-hidden="true" />} onClick={onAdelante}>Traer adelante</Boton>
                <Boton variante="fantasma" tamano="sm" icono={<ArrowDownToLine aria-hidden="true" />} onClick={onAtras}>Enviar atrás</Boton>
                <Boton variante="fantasma" tamano="sm" icono={<Copy aria-hidden="true" />} onClick={onDuplicar}>Duplicar</Boton>
              </span>
              {zonas.length > 1 && (
                <div className={s.grupoCampo}>
                  <span className={s.rotulo}>Pasar a otra zona</span>
                  <span className={s.chips}>{zonas.map((z) => <Chip key={z.id} tamano="sm" onClick={() => onPasarAZona?.(z.id)}>{z.nombre}</Chip>)}</span>
                </div>
              )}
            </div>
          ),
        }]}
      />
    </div>
  );
}
