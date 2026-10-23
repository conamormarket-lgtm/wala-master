import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Undo2, Redo2, Minus, Plus, Crosshair, Trash2, ImagePlus, Type, ZoomIn, ZoomOut, Keyboard, Check,
  Copy, ArrowUpToLine, ArrowDownToLine, RotateCw, FlipHorizontal, Crop, Eraser, Maximize2,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignLeft, AlignCenter, AlignRight, LoaderCircle, CheckCircle2, AlertTriangle,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, Pencil, Hand, Sparkles,
} from 'lucide-react';
import { Texto, useTexto } from '../Traduccion';
import Acordeon from '../Acordeon';
import { Chip } from '../Etiquetas';
import { Sello } from '../Marca';
import { BarraProgreso } from './BarraProgreso';
import { TituloEditable } from './Ficha';
import { imanAlMover, imanAlEscalar, enCm } from '../../../utils/guiasInteligentes';
import { BotonEstudio, CampoEstudio, CantidadEstudio, DeslizadorEstudio, SelectorColorEstudio, CasillaEstudio, InterruptorEstudio } from './ControlesEstudio';
import { PasoEstudio } from './PasoEstudio';
import { TextoResaltado } from './TextoResaltado';
import { Cargando } from '../Cargando';
export { PasoEstudio } from './PasoEstudio';
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
 *  - zonaActiva · seleccion: id de la capa elegida, o una lista si son varias
 *    · oscura: prenda oscura (las guías van en blanco) · guias: false para la
 *    foto final (sin zonas ni nada que tocar)
 *  - onElegirZona(id) · onElegirCapa(id, zonaId, { sumar }) (sumar: con Shift
 *    o Ctrl, suma o quita de la selección) · onMoverCapa(id, cambios)
 *    mientras se arrastra o se usan las asas · onSoltarCapa() al terminar
 *    (para deshacer)
 *  - Al arrastrar, guías rosadas e imán (como la tienda: utils/
 *    guiasInteligentes) contra la zona y los otros diseños; Alt lo apaga.
 *    onPasarCapa(id, zonaId, punto, { grupo, cambio }): se soltó sobre otra
 *    zona de este lado; cambio: { x, y } por cuánto multiplicar los tamaños
 *    (0–1 de la zona) para que se vea igual en la otra, y giro (grados)
 *  - onElegirVarias(ids, { sumar }): el recuadro del ratón sobre el fondo
 *  - onEncajar(id, cambios): un texto que se pasa del 96% de su zona se
 *    achica (sin un paso de deshacer propio)
 *  - editando: el texto que se escribe sobre la prenda · onEscribir(id,
 *    texto) · onTerminarTexto(id)
 *  - camaraSuave: el cambio de zoom se anima (el acercamiento automático)
 *  - Varias elegidas llevan una caja punteada: se arrastran tomándola de
 *    cualquier parte (Shift + clic suma o quita la que está debajo).
 *  - onArrastre({ activo, lado }): empieza y termina un arrastre; `lado` es
 *    el [data-soltar-lado] bajo el puntero (la página pone esos destinos,
 *    p. ej. "Suelta aquí para pasar a Espalda") · onPasarALado(ids, lado)
 *  - onMenu({ x, y, capaId, zonaId, punto }): clic derecho (x, y de la
 *    ventana; punto: 0–1 de la zona) · onDobleClic({ capaId, zonaId, punto })
 *  - onSoltarArchivo(archivo, zonaId): una imagen arrastrada desde la
 *    computadora; mientras se arrastra, "Suelta tu imagen en …"
 *  - zoom · camara: { x, y } (px) con zoom: la vista desplazada · onCamara({ x,
 *    y }) al arrastrar el fondo (con zoom) · moverVista: arrastrar mueve la
 *    vista (Espacio mantenida) · onRueda({ deltaX, deltaY, ctrl, shift, x, y })
 *    (x, y desde el centro del lienzo; la rueda no desplaza la página)
 *  - onGesto({ fase: 'inicio' | 'cambio' | 'fin', factor, giro, centro,
 *    desplazar }): dos dedos (factor: separación; giro: grados; centro: px
 *    desde el centro del lienzo; desplazar: cuánto se movió el punto medio,
 *    en 0–1 de la zona de lo elegido). La página decide: con una capa
 *    elegida la agranda, la gira y la mueve; si no, hace zoom.
 *  - cargando: "Cargando tu diseño…" encima (y aria-busy)
 *  - una capa elegida lleva asas: las esquinas agrandan desde la esquina
 *    contraria (con imán y "12 × 8 cm"), la de arriba gira (derecha cerca de
 *    90°; Shift, de 15° en 15°; muestra los grados)
 *  - encima: lo que va sobre el lienzo (empezar…)
 */
/** La zona mide 1000 unidades de ancho para las guías (como el lienzo de la tienda). */
const ANCHO_U = 1000;

/**
 * Un texto que se escribe sobre la prenda (doble clic, o uno nuevo en la
 * computadora). El contenido lo lleva el navegador: React no lo vuelve a
 * pintar mientras se escribe (así el cursor no salta).
 */
function TextoEnPrenda({ capa, seleccionar, onEscribir, onTerminar }) {
  const ref = useRef(null);
  const nombre = useTexto('Escribe tu texto');
  useLayoutEffect(() => {
    const el = ref.current;
    el.textContent = capa.texto || '';
    el.focus({ preventScroll: true });
    const rango = document.createRange();
    rango.selectNodeContents(el);
    if (!seleccionar) rango.collapse(false); // el cursor al final
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(rango);
    // Solo al empezar: lo que se escribe ya está en el DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span
      ref={ref}
      className={[s.texto, s.textoEditando].join(' ')}
      style={estiloTexto(capa)}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={nombre}
      spellCheck={false}
      onInput={(e) => onEscribir?.(e.currentTarget.innerText.replace(/\n$/, ''))}
      onBlur={() => onTerminar?.()}
      onKeyDown={(e) => {
        e.stopPropagation(); // las teclas son del texto, no del estudio
        if (e.key === 'Escape') e.currentTarget.blur();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}

export function LienzoPrenda({
  imagen, foto, tinte, voltear = false, anchoImg = 1000, altoImg = 1200, zonas = [], capas = {},
  zonaActiva, seleccion, oscura = false, guias = true, onElegirZona, onElegirCapa, onMoverCapa, onSoltarCapa,
  onMenu, onDobleClic, onSoltarArchivo, encima, zoom = 1, camara, onCamara, moverVista = false, onRueda, onGesto,
  cargando = false, className, onPasarCapa, onElegirVarias, onEncajar, editando, onEscribir, onTerminarTexto,
  camaraSuave = false, onArrastre, onPasarALado,
}) {
  const marco = useRef(null);
  const arrastre = useRef(null);
  const paneo = useRef(null);
  const toques = useRef(new Map());
  const gesto = useRef(null);
  const recuadro = useRef(null);
  const sinClic = useRef(false); // el clic que sigue a un recuadro no suelta lo elegido
  const [soltarEn, setSoltarEn] = useState(null);
  const [pasarA, setPasarA] = useState(null); // la zona a la que pasa la capa arrastrada
  // Lo que se está arrastrando: se ve entero (sin el recorte de su zona) y sin asas.
  const [moviendo, setMoviendo] = useState(null);
  // Sobre otra zona: cómo quedará lo que se suelta (más chico si no entra; un
  // texto en una manga, a lo largo). La copia lo muestra antes de soltar.
  const [vistaPrevia, setVistaPrevia] = useState(null); // { escala, giro }
  const [ayudas, setAyudas] = useState(null); // { zid, hu, cmPorU, lineas, etiqueta }
  const [rect, setRect] = useState(null); // el recuadro de selección (px del lienzo)
  const elegidas = Array.isArray(seleccion) ? seleccion : seleccion ? [seleccion] : [];
  // Los nombres y las ayudas de las capas, traducidos una vez (van dentro de listas).
  const nombreImagen = useTexto('Imagen');
  const nombreTexto = useTexto('Texto');
  const ayudaEscalar = useTexto('Arrastra para agrandar o achicar (Alt: sin imán)');
  const ayudaGirar = useTexto('Arrastra para girar (Shift: de 15° en 15°)');
  const ayudaVarias = useTexto('Arrastra para moverlas juntas (Shift + clic: sumar o quitar)');

  /* ── Medidas en pantalla ──
     La zona mide ANCHO_U unidades de ancho (como en la tienda): así las guías
     usan el mismo cálculo (utils/guiasInteligentes) aunque la zona esté girada. */
  const capaEnDom = (id) => (id ? marco.current?.querySelector(`[data-capa="${CSS.escape(id)}"]`) : null);
  const zonaEnDom = (zid) => marco.current?.querySelector(`[data-zona="${CSS.escape(zid)}"]`);
  /** De px de la ventana a 0–1 de la zona y al revés, con su giro y el zoom. */
  const geometria = (zid) => {
    const el = zonaEnDom(zid);
    const esc = marco.current?.querySelector('[data-escala]');
    if (!el || !esc) return null;
    const k = esc.getBoundingClientRect().width / (esc.offsetWidth || 1);
    const r = el.getBoundingClientRect();
    const z = zonas.find((x) => x.id === zid);
    const ang = ((z?.angulo || 0) * Math.PI) / 180;
    const w = el.offsetWidth * k;
    const h = el.offsetHeight * k;
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    return {
      zona: z, k, w, h, ang, c, wl: el.offsetWidth || 1, hl: el.offsetHeight || 1,
      hu: (ANCHO_U * el.offsetHeight) / (el.offsetWidth || 1),
      cmPorU: z?.anchoCm > 0 ? z.anchoCm / ANCHO_U : 0,
      aZona: (px, py) => {
        const dx = px - c.x;
        const dy = py - c.y;
        return { x: (dx * Math.cos(ang) + dy * Math.sin(ang)) / w + 0.5, y: (-dx * Math.sin(ang) + dy * Math.cos(ang)) / h + 0.5 };
      },
      aPantalla: (fx, fy) => {
        const dx = (fx - 0.5) * w;
        const dy = (fy - 0.5) * h;
        return { x: c.x + dx * Math.cos(ang) - dy * Math.sin(ang), y: c.y + dx * Math.sin(ang) + dy * Math.cos(ang) };
      },
    };
  };
  /** Tamaño de una capa (sin girar) en unidades de su zona: lo mide el DOM (el texto depende de la letra). */
  const tamanoU = (id, g) => {
    const el = capaEnDom(id);
    return el ? { w: (el.offsetWidth / g.wl) * ANCHO_U, h: (el.offsetHeight / g.wl) * ANCHO_U } : null;
  };
  /** Caja girada de una capa en unidades de su zona ({ x1, x2, y1, y2 }). */
  const cajaU = (capa, g, t = tamanoU(capa.id, g)) => {
    if (!t) return null;
    const a = ((capa.angulo || 0) * Math.PI) / 180;
    const ex = (Math.abs(Math.cos(a)) * t.w + Math.abs(Math.sin(a)) * t.h) / 2;
    const ey = (Math.abs(Math.sin(a)) * t.w + Math.abs(Math.cos(a)) * t.h) / 2;
    const cx = (capa.x ?? 0.5) * ANCHO_U;
    const cy = (capa.y ?? 0.5) * g.hu;
    return { x1: cx - ex, x2: cx + ex, y1: cy - ey, y2: cy + ey };
  };
  const unir = (cajas) => ({
    x1: Math.min(...cajas.map((b) => b.x1)), x2: Math.max(...cajas.map((b) => b.x2)),
    y1: Math.min(...cajas.map((b) => b.y1)), y2: Math.max(...cajas.map((b) => b.y2)),
  });
  /** Otra zona de este lado bajo un punto de la ventana. */
  const zonaEnPunto = (x, y, menos) => document.elementsFromPoint(x, y)
    .map((el) => el.closest?.('[data-zona]'))
    .find((el) => el && marco.current?.contains(el) && el.getAttribute('data-zona') !== menos)
    ?.getAttribute('data-zona') || null;
  /** Una etiqueta (cm o grados) bajo la caja, o encima si no entra. Px del lienzo. */
  const etiquetaBajo = (centro, medioAlto, texto) => {
    const m = marco.current.getBoundingClientRect();
    const abajo = centro.y + medioAlto + 20 + 18 < m.bottom;
    return { texto, x: centro.x - m.left, y: abajo ? centro.y + medioAlto + 20 - m.top : centro.y - medioAlto - 20 - 18 - m.top };
  };
  const vibrar = () => { try { navigator.vibrate?.(8); } catch { /* sin vibración */ } };
  const tolU = (g, tactil) => (tactil ? 10 : 6) / (g.w / ANCHO_U); // el imán: igual en pantalla con cualquier zoom

  // Las asas de lo elegido (una sola capa): su caja se mide en el DOM, porque
  // el tamaño de un texto depende de la letra (y cambia cuando la letra carga).
  const unaElegida = guias && onMoverCapa && elegidas.length === 1 && editando !== elegidas[0] ? elegidas[0] : null;
  const [caja, setCaja] = useState(null);
  const asa = useRef(null);
  useLayoutEffect(() => {
    const el = capaEnDom(unaElegida);
    const medir = () => {
      const nueva = el ? { id: unaElegida, w: el.offsetWidth, h: el.offsetHeight } : null;
      setCaja((c) => (c?.id === nueva?.id && c?.w === nueva?.w && c?.h === nueva?.h ? c : nueva));
    };
    medir();
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  });
  // Varias elegidas: una caja punteada alrededor, que se toma de cualquier
  // parte para moverlas juntas (como la tienda). Px del lienzo.
  const varias = guias && onMoverCapa && elegidas.length > 1;
  const [cajaVarias, setCajaVarias] = useState(null);
  // Se mide en cada render (las capas se mueven); si la caja no cambió, no se actualiza.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const m = varias && marco.current?.getBoundingClientRect();
    const rs = m ? elegidas.map((id) => capaEnDom(id)?.getBoundingClientRect()).filter(Boolean) : [];
    const nueva = rs.length > 1 ? {
      left: Math.round(Math.min(...rs.map((r) => r.left)) - m.left - 5),
      top: Math.round(Math.min(...rs.map((r) => r.top)) - m.top - 5),
      width: Math.round(Math.max(...rs.map((r) => r.right)) - Math.min(...rs.map((r) => r.left)) + 10),
      height: Math.round(Math.max(...rs.map((r) => r.bottom)) - Math.min(...rs.map((r) => r.top)) + 10),
    } : null;
    setCajaVarias((c) => (JSON.stringify(c) === JSON.stringify(nueva) ? c : nueva));
  });
  const ubicada = (id) => {
    for (const [zid, lista] of Object.entries(capas)) {
      const c = lista.find((x) => x.id === id);
      if (c) return { capa: c, zid };
    }
    return {};
  };
  // Un texto elegido que se pasa del 96% de su zona se achica (al escribir o
  // al agrandarlo), como en la tienda; girado 90°, se mide contra el alto.
  useLayoutEffect(() => {
    const id = Array.isArray(seleccion) ? (seleccion.length === 1 ? seleccion[0] : null) : seleccion;
    if (!guias || !onEncajar || !id) return;
    const { capa, zid } = ubicada(id);
    const el = capaEnDom(id);
    const ze = zid && zonaEnDom(zid);
    if (capa?.tipo !== 'texto' || !el || !ze) return;
    const derecho = Math.abs(Math.sin(((capa.angulo || 0) * Math.PI) / 180)) < 0.5;
    const limite = (derecho ? ze.offsetWidth : ze.offsetHeight) * 0.96;
    if (el.offsetWidth > limite * 1.01) onEncajar(id, { tamano: (capa.tamano ?? 0.18) * (limite / el.offsetWidth) });
  });

  /* ── Asas: las esquinas agrandan desde la esquina contraria, la de arriba gira ── */
  const ESQUINAS = { no: [-1, -1], ne: [1, -1], so: [-1, 1], se: [1, 1] };
  const empezarAsa = (e, tipo) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const { capa, zid } = ubicada(unaElegida);
    const el = capaEnDom(unaElegida);
    const g = capa && geometria(zid);
    if (!el || !g) return;
    const r = el.getBoundingClientRect();
    const centro = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const total = g.ang + ((capa.angulo || 0) * Math.PI) / 180;
    const rot = (vx, vy) => ({ x: vx * Math.cos(total) - vy * Math.sin(total), y: vx * Math.sin(total) + vy * Math.cos(total) });
    const medio = { w: (el.offsetWidth * g.k) / 2, h: (el.offsetHeight * g.k) / 2 };
    const a = {
      tipo, id: capa.id, zid, g, capa, centro, medio, tactil: e.pointerType === 'touch',
      a0: Math.atan2(e.clientY - centro.y, e.clientX - centro.x),
      t: tamanoU(capa.id, g),
      otras: (capas[zid] || []).filter((x) => x.id !== capa.id).map((x) => cajaU(x, g)).filter(Boolean),
    };
    if (tipo !== 'giro') {
      const [sx, sy] = ESQUINAS[tipo];
      const o = rot(-sx * medio.w, -sy * medio.h);
      const q = rot(sx * medio.w, sy * medio.h);
      a.fijo = { x: centro.x + o.x, y: centro.y + o.y };
      a.v0 = { x: q.x - o.x, y: q.y - o.y };
    }
    asa.current = a;
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* el puntero ya se soltó */ }
  };
  const moverAsa = (e) => {
    const a = asa.current;
    if (!a) return;
    e.stopPropagation();
    a.movio = true;
    const imagenCapa = a.capa.tipo === 'imagen';
    if (a.tipo === 'giro') {
      let angulo = (a.capa.angulo || 0) + ((Math.atan2(e.clientY - a.centro.y, e.clientX - a.centro.x) - a.a0) * 180) / Math.PI;
      if (e.shiftKey) angulo = Math.round(angulo / 15) * 15; // Shift: de 15° en 15°
      else if (Math.abs(angulo - Math.round(angulo / 90) * 90) < 4) angulo = Math.round(angulo / 90) * 90; // derecho
      angulo = Math.round(((angulo % 360) + 360) % 360);
      const ext = Math.max(a.medio.w, a.medio.h);
      setAyudas({ zid: a.zid, lineas: [], etiqueta: etiquetaBajo(a.centro, ext, `${angulo}°`) });
      onMoverCapa(a.id, { angulo });
      return;
    }
    // El largo a lo largo de la diagonal: no se voltea al pasar la esquina contraria.
    const v = { x: e.clientX - a.fijo.x, y: e.clientY - a.fijo.y };
    let factor = Math.max(0.05, (v.x * a.v0.x + v.y * a.v0.y) / (a.v0.x ** 2 + a.v0.y ** 2 || 1));
    const centroCon = (f) => ({ x: a.fijo.x + (a.centro.x - a.fijo.x) * f, y: a.fijo.y + (a.centro.y - a.fijo.y) * f });
    let lineas = [];
    // Imán al agrandar: solo derecho o a 90° (como la tienda); Alt lo apaga.
    const derecho = Math.abs(((a.capa.angulo || 0) % 90 + 90) % 90) < 0.5 || Math.abs(((a.capa.angulo || 0) % 90 + 90) % 90) > 89.5;
    if (derecho && !e.altKey && a.t) {
      const p = a.g.aZona(centroCon(factor).x, centroCon(factor).y);
      const caja = cajaU({ ...a.capa, x: p.x, y: p.y }, a.g, { w: a.t.w * factor, h: a.t.h * factor });
      const fp = a.g.aZona(a.fijo.x, a.fijo.y);
      const r = imanAlEscalar(caja, { left: fp.x * ANCHO_U, top: fp.y * a.g.hu }, a.otras, { wu: ANCHO_U, hu: a.g.hu }, tolU(a.g, a.tactil));
      if (r.factor !== 1) {
        factor *= r.factor;
        lineas = r.guias;
        if (!a.pegado && a.tactil) vibrar();
      }
      a.pegado = r.factor !== 1;
    }
    const c = centroCon(factor);
    const p = a.g.aZona(c.x, c.y);
    const medidas = a.t && a.g.cmPorU ? `${enCm(a.t.w * factor, a.g.cmPorU).replace(' cm', '')} × ${enCm(a.t.h * factor, a.g.cmPorU)}` : '';
    const ext = Math.abs(Math.sin(a.g.ang + ((a.capa.angulo || 0) * Math.PI) / 180)) * a.medio.w + Math.abs(Math.cos(a.g.ang + ((a.capa.angulo || 0) * Math.PI) / 180)) * a.medio.h;
    setAyudas({ zid: a.zid, hu: a.g.hu, cmPorU: a.g.cmPorU, lineas, etiqueta: medidas ? etiquetaBajo(c, ext * factor, medidas) : null });
    onMoverCapa(a.id, {
      x: p.x, y: p.y,
      ...(imagenCapa ? { ancho: Math.max(0.02, (a.capa.ancho ?? 0.8) * factor) } : { tamano: Math.max(0.01, (a.capa.tamano ?? 0.18) * factor) }),
    });
  };
  const soltarAsa = (e) => {
    const a = asa.current;
    if (!a) return;
    e.stopPropagation();
    asa.current = null;
    setAyudas(null);
    if (a.movio) onSoltarCapa?.();
  };
  const eventosAsa = (tipo) => ({
    onPointerDown: (e) => empezarAsa(e, tipo),
    onPointerMove: moverAsa,
    onPointerUp: soltarAsa,
    onPointerCancel: soltarAsa,
    onClick: (e) => e.stopPropagation(),
    onDoubleClick: (e) => e.stopPropagation(),
  });

  // Dos dedos (se miran en la fase de captura, antes que la capa o el fondo).
  const medirToques = () => {
    const [a, b] = [...toques.current.values()];
    const r = marco.current.getBoundingClientRect();
    const medio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return {
      d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      ang: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      medio,
      centro: { x: medio.x - (r.left + r.width / 2), y: medio.y - (r.top + r.height / 2) },
    };
  };
  const gestos = guias && onGesto ? {
    onPointerDownCapture: (e) => {
      if (e.pointerType !== 'touch') return;
      toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (toques.current.size !== 2) return;
      arrastre.current = null; // el segundo dedo convierte el arrastre en gesto
      paneo.current = null;
      setAyudas(null);
      setPasarA(null);
      const m = medirToques();
      // Con una capa elegida, el punto medio de los dedos también la mueve.
      const { zid } = elegidas.length === 1 ? ubicada(elegidas[0]) : {};
      const g = zid && geometria(zid);
      gesto.current = { d0: m.d, ang0: m.ang, g, p0: g ? g.aZona(m.medio.x, m.medio.y) : null };
      onGesto({ fase: 'inicio', factor: 1, giro: 0, centro: m.centro });
    },
    onPointerMoveCapture: (e) => {
      if (!toques.current.has(e.pointerId)) return;
      toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const gs = gesto.current;
      if (!gs || toques.current.size < 2) return;
      const m = medirToques();
      const p = gs.g ? gs.g.aZona(m.medio.x, m.medio.y) : null;
      onGesto({
        fase: 'cambio', factor: m.d / gs.d0, giro: m.ang - gs.ang0, centro: m.centro,
        desplazar: p ? { x: p.x - gs.p0.x, y: p.y - gs.p0.y } : undefined,
      });
    },
    onPointerUpCapture: (e) => {
      toques.current.delete(e.pointerId);
      if (gesto.current && toques.current.size < 2) { gesto.current = null; onGesto({ fase: 'fin' }); }
    },
    onPointerCancelCapture: (e) => {
      toques.current.delete(e.pointerId);
      if (gesto.current && toques.current.size < 2) { gesto.current = null; onGesto({ fase: 'fin' }); }
    },
  } : {};

  /** Dónde va una capa en su zona (la capa y, al arrastrarla, su copia sin recorte). */
  const estiloCapa = (c) => ({
    left: `${(c.x ?? 0.5) * 100}%`,
    top: `${(c.y ?? 0.5) * 100}%`,
    width: c.tipo === 'imagen' ? `${(c.ancho ?? 0.8) * 100}%` : undefined,
    transform: `translate(-50%, -50%) rotate(${c.angulo || 0}deg)${c.voltear ? ' scaleX(-1)' : ''}`,
  });
  const contenidoCapa = (c) => (c.tipo === 'imagen' ? (
    <img src={c.src} alt="" draggable={false} />
  ) : guias && editando === c.id ? (
    // Mientras se escribe, derecho (como la tienda); al terminar vuelve el arco.
    <TextoEnPrenda capa={{ ...c, curva: 0 }} seleccionar={c.texto === 'Tu texto'} onEscribir={(t) => onEscribir?.(c.id, t)} onTerminar={() => onTerminarTexto?.(c.id)} />
  ) : efectoNum(c.curva) ? (
    <TextoCurvo capa={c} />
  ) : (
    <span className={s.texto} style={estiloTexto(c)}>{c.texto}</span>
  ));

  /** Punto (0–1) de la zona bajo el puntero (con su giro). */
  const puntoEnZona = (e, zid) => {
    const g = geometria(zid);
    if (!g) return { x: 0.5, y: 0.5 };
    const p = g.aZona(e.clientX, e.clientY);
    return { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) };
  };

  /* ── Arrastrar: guías e imán (Alt lo apaga) y, al soltar sobre otra zona, pasa a ella ── */
  const empezar = (e, c, zonaId) => {
    if (editando === c.id) { e.stopPropagation(); return; } // escribiendo: el clic pone el cursor
    if (moverVista || e.button === 1) return; // se mueve la vista, no la capa
    if (e.button === 2) return; // el clic derecho abre el menú
    e.stopPropagation();
    const sumar = e.shiftKey || e.ctrlKey || e.metaKey;
    onElegirCapa?.(c.id, zonaId, { sumar, tactil: e.pointerType === 'touch' });
    if (!onMoverCapa || sumar) return;
    const g = geometria(zonaId);
    if (!g) return;
    const p = g.aZona(e.clientX, e.clientY);
    // Si es una de varias elegidas, se mueven juntas (el imán, si están en la misma zona).
    const grupo = elegidas.length > 1 && elegidas.includes(c.id) ? elegidas : [c.id];
    const lista = capas[zonaId] || [];
    const juntas = grupo.every((id) => lista.some((x) => x.id === id));
    const cajas = juntas ? lista.filter((x) => grupo.includes(x.id)).map((x) => cajaU(x, g)).filter(Boolean) : [];
    arrastre.current = {
      id: c.id, zonaId, g, grupo, juntas, solo: grupo.length === 1, texto: c.tipo === 'texto', tactil: e.pointerType === 'touch',
      dx: p.x - (c.x ?? 0.5), dy: p.y - (c.y ?? 0.5), x0: c.x ?? 0.5, y0: c.y ?? 0.5,
      cajaGrupo: cajas.length === grupo.length ? unir(cajas) : null,
      otras: juntas ? lista.filter((x) => !grupo.includes(x.id)).map((x) => cajaU(x, g)).filter(Boolean) : [],
      movio: false,
    };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* el puntero ya se soltó */ }
  };
  const mover = (e) => {
    const a = arrastre.current;
    if (!a) return;
    const p = a.g.aZona(e.clientX, e.clientY);
    let x = p.x - a.dx;
    let y = p.y - a.dy;
    let lineas = [];
    if (a.cajaGrupo && !e.altKey) {
      const dx = (x - a.x0) * ANCHO_U;
      const dy = (y - a.y0) * a.g.hu;
      const cajaAhora = { x1: a.cajaGrupo.x1 + dx, x2: a.cajaGrupo.x2 + dx, y1: a.cajaGrupo.y1 + dy, y2: a.cajaGrupo.y2 + dy };
      const r = imanAlMover(cajaAhora, a.otras, { wu: ANCHO_U, hu: a.g.hu }, tolU(a.g, a.tactil));
      x += r.dx / ANCHO_U;
      y += r.dy / a.g.hu;
      lineas = r.guias;
      if (lineas.length && !a.pegado && a.tactil) vibrar();
      a.pegado = lineas.length > 0;
    }
    // Sobre un destino de otro lado ("Suelta aquí para pasar a Espalda").
    const lado = onPasarALado
      ? document.elementsFromPoint(e.clientX, e.clientY).map((el) => el.closest?.('[data-soltar-lado]')).find(Boolean)?.getAttribute('data-soltar-lado') || null
      : null;
    if (!a.movio) setMoviendo(a.grupo);
    if (!a.movio || lado !== a.lado) onArrastre?.({ activo: true, lado });
    a.lado = lado;
    // Fuera de su zona y sobre otra de este lado: al soltar pasa a esa. Una
    // capa sola, por su centro; varias (de una misma zona), por el puntero.
    let destino = null;
    if (!lado && onPasarCapa) {
      if (a.solo && (x < 0 || x > 1 || y < 0 || y > 1)) {
        const enPantalla = a.g.aPantalla(x, y);
        destino = zonaEnPunto(enPantalla.x, enPantalla.y, a.zonaId);
      } else if (!a.solo && a.juntas) {
        const q = a.g.aZona(e.clientX, e.clientY);
        if (q.x < 0 || q.x > 1 || q.y < 0 || q.y > 1) destino = zonaEnPunto(e.clientX, e.clientY, a.zonaId);
      }
    }
    a.destino = destino;
    // Al pasar a otra zona conserva su tamaño y su giro en pantalla: las
    // medidas de la zona de origen pasan a las de la de destino.
    a.cambio = null;
    let previa = null;
    const g2 = destino && geometria(destino);
    if (g2) {
      a.cambio = { x: a.g.w / g2.w, y: a.g.h / g2.h, giro: ((a.g.ang - g2.ang) * 180) / Math.PI, largaDestino: (g2.zona?.proporcion || 0) > 1.8 };
      const capa = (capas[a.zonaId] || []).find((c) => c.id === a.id);
      if (a.solo && capa?.tipo === 'imagen') {
        const ancho = (capa.ancho ?? 0.8) * a.cambio.x;
        if (ancho > 0.9) previa = { escala: 0.9 / ancho, giro: 0 };
      } else if (a.solo && capa?.tipo === 'texto' && a.cambio.largaDestino && (a.g.zona?.proporcion || 0) <= 1.8 && !((capa.angulo || 0) % 180)) {
        previa = { escala: 1, giro: 90 };
      }
    }
    setVistaPrevia(previa);
    a.ultimo = { x, y };
    a.movio = true;
    setPasarA(destino);
    setAyudas(lineas.length ? { zid: a.zonaId, hu: a.g.hu, cmPorU: a.g.cmPorU, lineas } : null);
    onMoverCapa(a.id, a.solo ? { x: Math.min(1.5, Math.max(-0.5, x)), y: Math.min(1.5, Math.max(-0.5, y)) } : { x, y });
  };
  const soltar = () => {
    const a = arrastre.current;
    arrastre.current = null;
    setAyudas(null);
    setPasarA(null);
    setMoviendo(null);
    setVistaPrevia(null);
    if (!a?.movio) return;
    onArrastre?.({ activo: false });
    if (a.lado) { onPasarALado(a.grupo, a.lado); return; }
    if (a.destino) {
      const enPantalla = a.g.aPantalla(a.ultimo.x, a.ultimo.y);
      const g2 = geometria(a.destino);
      const punto = g2 ? g2.aZona(enPantalla.x, enPantalla.y) : { x: 0.5, y: 0.5 };
      onPasarCapa(a.id, a.destino, { x: Math.min(1, Math.max(0, punto.x)), y: Math.min(1, Math.max(0, punto.y)) }, { grupo: a.grupo, cambio: a.cambio });
      return;
    }
    if (a.solo) {
      // El centro vuelve a su zona y un texto que se pasa del borde vuelve adentro (como la tienda).
      let x = Math.min(1, Math.max(0, a.ultimo.x));
      let y = Math.min(1, Math.max(0, a.ultimo.y));
      const capa = (capas[a.zonaId] || []).find((c) => c.id === a.id);
      const b = a.texto && capa && cajaU({ ...capa, x, y }, a.g);
      if (b) {
        if (b.x2 - b.x1 > ANCHO_U) x = 0.5;
        else if (b.x1 < 0) x -= b.x1 / ANCHO_U;
        else if (b.x2 > ANCHO_U) x -= (b.x2 - ANCHO_U) / ANCHO_U;
        if (b.y2 - b.y1 > a.g.hu) y = 0.5;
        else if (b.y1 < 0) y -= b.y1 / a.g.hu;
        else if (b.y2 > a.g.hu) y -= (b.y2 - a.g.hu) / a.g.hu;
      }
      if (x !== a.ultimo.x || y !== a.ultimo.y) onMoverCapa(a.id, { x, y });
    }
    onSoltarCapa?.();
  };

  /** La caja de varias: se toma de cualquier parte; con Shift, suma o quita la de debajo. */
  const capaBajo = (e) => {
    const el = document.elementsFromPoint(e.clientX, e.clientY).find((x) => x.hasAttribute?.('data-capa') && marco.current?.contains(x));
    const id = el?.getAttribute('data-capa');
    return id ? { capa: ubicada(id).capa, zid: ubicada(id).zid } : {};
  };
  const empezarVarias = (e) => {
    if (e.button === 2) return;
    const bajo = capaBajo(e);
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      if (bajo.capa) onElegirCapa?.(bajo.capa.id, bajo.zid, { sumar: true });
      return;
    }
    // La que se arrastra: la de debajo del puntero o, en un hueco, la primera.
    const principal = bajo.capa && elegidas.includes(bajo.capa.id) ? bajo : ubicada(elegidas.find((id) => capaEnDom(id)));
    if (principal.capa) empezar(e, principal.capa, principal.zid);
  };

  /* ── Recuadro con el ratón sobre el fondo: elige lo que toca (Shift suma) ── */
  const empezarRecuadro = (e) => {
    if (!onElegirVarias || e.pointerType !== 'mouse' || e.button !== 0) return false;
    const m = marco.current.getBoundingClientRect();
    // Sin capturar el puntero todavía: un clic simple sigue llegando a la zona.
    recuadro.current = { x0: e.clientX, y0: e.clientY, m, sumar: e.shiftKey || e.ctrlKey || e.metaKey, activo: false, el: e.currentTarget, puntero: e.pointerId };
    return true;
  };
  const moverRecuadro = (e) => {
    const r = recuadro.current;
    if (!r) return false;
    if (!r.activo && Math.hypot(e.clientX - r.x0, e.clientY - r.y0) < 5) return true;
    if (!r.activo) {
      r.activo = true;
      try { r.el.setPointerCapture?.(r.puntero); } catch { /* el puntero ya se soltó */ }
    }
    r.x1 = e.clientX;
    r.y1 = e.clientY;
    setRect({ left: Math.min(r.x0, r.x1) - r.m.left, top: Math.min(r.y0, r.y1) - r.m.top, width: Math.abs(r.x1 - r.x0), height: Math.abs(r.y1 - r.y0) });
    return true;
  };
  const soltarRecuadro = () => {
    const r = recuadro.current;
    recuadro.current = null;
    if (!r) return false;
    setRect(null);
    if (!r.activo) return true;
    sinClic.current = true;
    setTimeout(() => { sinClic.current = false; }, 0);
    const caja = { l: Math.min(r.x0, r.x1), r: Math.max(r.x0, r.x1), t: Math.min(r.y0, r.y1), b: Math.max(r.y0, r.y1) };
    const ids = [...marco.current.querySelectorAll('[data-capa]')].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.left < caja.r && b.right > caja.l && b.top < caja.b && b.bottom > caja.t;
    }).map((el) => el.getAttribute('data-capa'));
    onElegirVarias(ids, { sumar: r.sumar });
    return true;
  };

  // Con zoom, arrastrar el fondo (o con Espacio, o el botón del medio) mueve la vista.
  const empezarPaneo = (e) => {
    if (!onCamara || !(zoom > 1 || moverVista || e.button === 1)) return false;
    if (e.button !== 0 && e.button !== 1) return false;
    e.preventDefault();
    paneo.current = { x0: e.clientX, y0: e.clientY, c0: camara || { x: 0, y: 0 } };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* el puntero ya se soltó */ }
    return true;
  };
  const moverPaneo = (e) => {
    const p = paneo.current;
    if (!p) return;
    onCamara({ x: p.c0.x + e.clientX - p.x0, y: p.c0.y + e.clientY - p.y0 });
  };
  const soltarPaneo = () => { paneo.current = null; };

  // La rueda no desplaza la página sobre el lienzo (necesita passive: false).
  useEffect(() => {
    const el = marco.current;
    if (!el || !onRueda || !guias) return undefined;
    const alRodar = (e) => {
      if (!(e.ctrlKey || e.metaKey) && zoom <= 1) return; // sin zoom, la rueda baja por la página
      e.preventDefault();
      const r = el.getBoundingClientRect();
      onRueda({ deltaX: e.deltaX, deltaY: e.deltaY, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, x: e.clientX - (r.left + r.width / 2), y: e.clientY - (r.top + r.height / 2) });
    };
    el.addEventListener('wheel', alRodar, { passive: false });
    return () => el.removeEventListener('wheel', alRodar);
  }, [onRueda, guias, zoom]);

  // Una imagen arrastrada desde la computadora: la zona bajo el puntero.
  const zonaBajo = (e) => document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-zona]')?.getAttribute('data-zona') || zonaActiva || zonas[0]?.id;
  const arrastrandoArchivo = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  const soltarArchivo = guias && onSoltarArchivo ? {
    onDragOver: (e) => { if (!arrastrandoArchivo(e)) return; e.preventDefault(); setSoltarEn(zonaBajo(e)); },
    onDragLeave: (e) => { if (!marco.current?.contains(e.relatedTarget)) setSoltarEn(null); },
    onDrop: (e) => {
      if (!arrastrandoArchivo(e)) return;
      e.preventDefault();
      const archivo = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
      const zid = zonaBajo(e);
      setSoltarEn(null);
      if (archivo) onSoltarArchivo(archivo, zid);
    },
  } : {};

  const espejo = voltear ? { transform: 'scaleX(-1)' } : undefined;
  const transformacion = zoom !== 1 || camara ? `translate(${camara?.x || 0}px, ${camara?.y || 0}px) scale(${zoom})` : undefined;
  return (
    <div
      ref={marco}
      className={[
        s.lienzo, oscura && s.oscura, (zoom > 1 || moverVista) && onCamara && s.lienzoPaneo,
        // Con algo elegido o con zoom, los dedos son del lienzo; si no, un dedo
        // desplaza la página y dos acercan la prenda (no la página).
        guias && onGesto && (elegidas.length || zoom > 1 ? s.lienzoGestos : s.lienzoPellizco), className,
      ].filter(Boolean).join(' ')}
      data-componente="LienzoPrenda"
      aria-busy={cargando || undefined}
      onPointerDown={guias ? (e) => { if (!empezarPaneo(e)) empezarRecuadro(e); } : undefined}
      onPointerMove={guias ? (e) => { if (!moverRecuadro(e)) moverPaneo(e); } : undefined}
      onPointerUp={guias ? (e) => { if (!soltarRecuadro(e)) soltarPaneo(e); } : undefined}
      onPointerCancel={guias ? (e) => { if (!soltarRecuadro(e)) soltarPaneo(e); } : undefined}
      onAuxClick={(e) => e.preventDefault()}
      {...gestos}
      {...soltarArchivo}
    >
      <div data-escala className={[s.lienzoEscala, camaraSuave && s.camaraSuave].filter(Boolean).join(' ')} style={{ aspectRatio: `${anchoImg} / ${altoImg}`, '--proporcion': anchoImg / altoImg, transform: transformacion }}>
        {/* Sin foto del color: la foto blanca teñida (el color recortado con su silueta + multiply). */}
        {!foto && tinte && <span className={s.tinte} style={{ ...espejo, background: tinte, WebkitMaskImage: `url("${imagen}")`, maskImage: `url("${imagen}")` }} aria-hidden="true" />}
        <img className={[s.prenda, !foto && tinte && s.prendaTenida].filter(Boolean).join(' ')} style={espejo} src={foto || imagen} alt="" draggable={false} />
        {/* En una prenda oscura el multiply apaga los pliegues: la foto vuelve, tenue, como luz. */}
        {!foto && tinte && oscura && <img className={s.luz} style={espejo} src={imagen} alt="" draggable={false} aria-hidden="true" />}
        {zonas.map((z) => {
          const activa = guias && z.id === zonaActiva;
          const conAsas = !moviendo && caja?.id === unaElegida && (capas[z.id] || []).find((c) => c.id === caja.id);
          const copias = moviendo ? (capas[z.id] || []).filter((c) => moviendo.includes(c.id)) : [];
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
                // Sus asas (o lo que se arrastra) quedan sobre las otras zonas.
                zIndex: copias.length ? 3 : conAsas ? 2 : undefined,
              }}
              onClick={guias ? () => { if (!sinClic.current) onElegirZona?.(z.id); } : undefined}
              onDoubleClick={guias && onDobleClic ? (e) => onDobleClic({ zonaId: z.id, punto: puntoEnZona(e, z.id) }) : undefined}
              onContextMenu={guias && onMenu ? (e) => { e.preventDefault(); onMenu({ x: e.clientX, y: e.clientY, zonaId: z.id, punto: puntoEnZona(e, z.id) }); } : undefined}
              role={guias ? 'button' : undefined}
              tabIndex={guias ? 0 : undefined}
              aria-label={guias ? `Zona ${z.nombre}` : undefined}
              aria-pressed={guias ? z.id === zonaActiva : undefined}
              onKeyDown={guias ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onElegirZona?.(z.id); } : undefined}
            >
              <div className={s.recorte}>
                {(capas[z.id] || []).map((c) => (
                  <span
                    key={c.id}
                    data-capa={c.id}
                    className={[
                      s.capa, guias && elegidas.includes(c.id) && s.capaElegida, guias && elegidas.length > 1 && elegidas.includes(c.id) && s.capaVarias,
                      moviendo?.includes(c.id) && s.capaOculta, // se ve su copia, abajo
                    ].filter(Boolean).join(' ')}
                    style={estiloCapa(c)}
                    onPointerDown={guias ? (e) => empezar(e, c, z.id) : undefined}
                    onPointerMove={guias ? mover : undefined}
                    onPointerUp={guias ? soltar : undefined}
                    onPointerCancel={guias ? soltar : undefined}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={guias && onDobleClic ? (e) => { e.stopPropagation(); if (editando !== c.id) onDobleClic({ capaId: c.id, zonaId: z.id }); } : undefined}
                    onContextMenu={guias && onMenu ? (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!elegidas.includes(c.id)) onElegirCapa?.(c.id, z.id, {});
                      onMenu({ x: e.clientX, y: e.clientY, capaId: c.id, zonaId: z.id });
                    } : undefined}
                    // Con el teclado: Tab llega a cada capa; Enter la elige (Shift+Enter la suma).
                    tabIndex={guias ? 0 : undefined}
                    role={guias ? 'button' : undefined}
                    aria-pressed={guias ? elegidas.includes(c.id) : undefined}
                    aria-label={guias ? (c.tipo === 'imagen' ? nombreImagen : `${nombreTexto} «${c.texto || ''}»`) : undefined}
                    onKeyDown={guias ? (e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      e.stopPropagation();
                      onElegirCapa?.(c.id, z.id, { sumar: e.shiftKey });
                    } : undefined}
                  >
                    {contenidoCapa(c)}
                  </span>
                ))}
              </div>
              {copias.map((c) => (
                // Al arrastrar: una copia sin el recorte de la zona, que sigue al
                // puntero aunque salga de ella (hacia otra zona o al borde).
                <span
                  key={c.id}
                  className={[s.capa, s.capaArrastrada].join(' ')}
                  style={vistaPrevia ? { ...estiloCapa(c), transform: `${estiloCapa(c).transform} rotate(${vistaPrevia.giro}deg) scale(${vistaPrevia.escala})` } : estiloCapa(c)}
                  aria-hidden="true"
                >
                  {contenidoCapa(c)}
                </span>
              ))}
              {conAsas && (
                // Fuera del recorte: las asas se ven aunque la capa llegue al borde de la zona.
                <span
                  className={s.asas}
                  style={{
                    left: `${(conAsas.x ?? 0.5) * 100}%`,
                    top: `${(conAsas.y ?? 0.5) * 100}%`,
                    width: caja.w,
                    height: caja.h,
                    transform: `translate(-50%, -50%) rotate(${conAsas.angulo || 0}deg)`,
                    '--zoom': zoom,
                  }}
                  data-componente="AsasCapa"
                >
                  {Object.keys(ESQUINAS).map((esquina) => (
                    <span key={esquina} className={[s.asa, s[`asa_${esquina}`]].join(' ')} title={ayudaEscalar} {...eventosAsa(esquina)} />
                  ))}
                  <span className={s.asaGiro} title={ayudaGirar} {...eventosAsa('giro')} />
                </span>
              )}
              {activa && <span className={s.zonaNombre} style={z.angulo ? { transform: `translateX(-50%) rotate(${-z.angulo}deg)` } : undefined}><Texto>{z.nombre}</Texto></span>}
              {(soltarEn === z.id || pasarA === z.id) && <span className={s.zonaSoltar} aria-hidden="true" />}
              {pasarA === z.id && (
                <span className={s.zonaDestino} style={z.angulo ? { transform: `translateX(-50%) rotate(${-z.angulo}deg)` } : undefined} aria-live="polite">
                  <SoltarEnZona zona={z.nombre} />
                </span>
              )}
              {ayudas?.zid === z.id && ayudas.lineas?.length > 0 && (
                // Las guías rosadas: alineado con la zona o con otro diseño, y espacios iguales.
                <span className={s.guiasCapa} style={{ '--zoom': zoom }} aria-hidden="true">
                  {ayudas.lineas.map((l, i) => {
                    const pctX = (v) => `${(v / ANCHO_U) * 100}%`;
                    const pctY = (v) => `${(v / ayudas.hu) * 100}%`;
                    if (l.tipo === 'linea') {
                      return l.eje === 'x'
                        ? <span key={i} className={s.guiaV} style={{ left: pctX(l.valor), top: pctY(l.desde), height: pctY(l.hasta - l.desde) }} />
                        : <span key={i} className={s.guiaH} style={{ top: pctY(l.valor), left: pctX(l.desde), width: pctX(l.hasta - l.desde) }} />;
                    }
                    const cm = enCm(l.hasta - l.desde, ayudas.cmPorU);
                    return l.eje === 'x' ? (
                      <span key={i} className={s.espacioH} style={{ top: pctY(l.en), left: pctX(l.desde), width: pctX(l.hasta - l.desde) }}>{cm && <span className={s.espacioCm}>{cm}</span>}</span>
                    ) : (
                      <span key={i} className={s.espacioV} style={{ left: pctX(l.en), top: pctY(l.desde), height: pctY(l.hasta - l.desde) }}>{cm && <span className={s.espacioCm}>{cm}</span>}</span>
                    );
                  })}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {soltarEn && (
        <AvisoSoltarArchivo zona={zonas.find((z) => z.id === soltarEn)?.nombre} />
      )}
      {rect && <span className={s.recuadro} style={rect} aria-hidden="true" />}
      {cajaVarias && (
        <span
          className={s.cajaVarias}
          style={cajaVarias}
          title={ayudaVarias}
          data-componente="CajaVarias"
          onPointerDown={empezarVarias}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={onMenu ? (e) => {
            e.preventDefault();
            const bajo = capaBajo(e);
            onMenu({ x: e.clientX, y: e.clientY, capaId: bajo.capa?.id || elegidas[0], zonaId: bajo.zid });
          } : undefined}
        />
      )}
      {ayudas?.etiqueta && <span className={s.medida} style={{ left: ayudas.etiqueta.x, top: ayudas.etiqueta.y }} aria-live="polite">{ayudas.etiqueta.texto}</span>}
      {cargando && <CargandoLienzo />}
      {encima}
    </div>
  );
}

/** "Soltar en Pecho": la frase entera; el nombre de la zona, ya traducido, queda en negrita. */
function SoltarEnZona({ zona }) {
  const nombre = useTexto(zona);
  return <TextoResaltado resaltar={[nombre]}>{`Soltar en ${zona}`}</TextoResaltado>;
}

/**
 * La barra rápida bajo el lienzo: deshacer y rehacer; con algo elegido,
 * achicar, agrandar, centrar y quitar; siempre, + Imagen y + Texto; el zoom
 * y los atajos.
 *  - puedeDeshacer, puedeRehacer, onDeshacer, onRehacer · elegido (bool)
 *  - onAchicar, onAgrandar, onCentrar, onQuitar · onImagen, onTexto
 *  - zoom, onZoom(z) · onAtajos
 */
export const NIVELES_ZOOM = [1, 1.5, 2, 3, 4, 6, 8];
/** El nivel siguiente (o anterior) al zoom de ahora, aunque esté entre dos (Ctrl + rueda). */
export const zoomVecino = (zoom, sube) => (sube
  ? NIVELES_ZOOM.find((n) => n > zoom + 0.01) ?? NIVELES_ZOOM[NIVELES_ZOOM.length - 1]
  : [...NIVELES_ZOOM].reverse().find((n) => n < zoom - 0.01) ?? 1);

export function BarraLienzo({
  puedeDeshacer, puedeRehacer, onDeshacer, onRehacer, elegido = false,
  onAchicar, onAgrandar, onCentrar, onQuitar, onImagen, onTexto, zoom = 1, onZoom, onAtajos, onEditar,
  completa = false, onVerCompleta,
}) {
  const B = (props) => <BotonEstudio variante="fantasma" tamano="sm" soloIcono {...props} />;
  const nombreBarra = useTexto('Herramientas del lienzo');
  const verCompleta = useTexto('Ver la prenda completa (Shift+1)');
  return (
    <div className={s.barra} role="toolbar" aria-label={nombreBarra} data-componente="BarraLienzo">
      <span className={s.grupoBarra}>
        <B aria-label="Deshacer" icono={<Undo2 aria-hidden="true" />} disabled={!puedeDeshacer} onClick={onDeshacer} />
        <B aria-label="Rehacer" icono={<Redo2 aria-hidden="true" />} disabled={!puedeRehacer} onClick={onRehacer} />
      </span>
      {elegido && (
        <span className={s.grupoBarra}>
          <B aria-label="Achicar" icono={<Minus aria-hidden="true" />} onClick={onAchicar} />
          <B aria-label="Agrandar" icono={<Plus aria-hidden="true" />} onClick={onAgrandar} />
          <B aria-label="Centrar" icono={<Crosshair aria-hidden="true" />} onClick={onCentrar} />
          <BotonEstudio variante="fantasma" tamano="sm" soloIcono aria-label="Quitar" icono={<Trash2 aria-hidden="true" />} onClick={onQuitar} className={s.peligro} />
          {/* En el celular el panel queda debajo de la prenda: "Editar" baja hasta él. */}
          {onEditar && <BotonEstudio variante="secundario" tamano="sm" icono={<Pencil aria-hidden="true" />} onClick={onEditar} className={s.soloCelular}><Texto>{"Editar"}</Texto></BotonEstudio>}
          {/* En el teléfono, lo elegido acerca su zona: esto muestra la prenda entera (y vuelve). */}
          {onVerCompleta && (
            <B
              aria-label={completa ? 'Acercar a la zona' : 'Ver la prenda completa'}
              title={completa ? 'Acercar a la zona' : 'Ver la prenda completa'}
              icono={completa ? <ZoomIn aria-hidden="true" /> : <ZoomOut aria-hidden="true" />}
              onClick={onVerCompleta}
              className={s.soloTelefono}
            />
          )}
        </span>
      )}
      <span className={s.grupoBarra}>
        <BotonEstudio variante="contorno" tamano="sm" icono={<ImagePlus aria-hidden="true" />} onClick={onImagen}><Texto>{"Imagen"}</Texto></BotonEstudio>
        <BotonEstudio variante="contorno" tamano="sm" icono={<Type aria-hidden="true" />} onClick={onTexto}><Texto>{"Texto"}</Texto></BotonEstudio>
      </span>
      {/* En el celular se acerca con los dedos: el zoom queda para el ratón. */}
      <span className={[s.grupoBarra, s.grupoZoom].join(' ')}>
        <B aria-label="Alejar (Ctrl −)" icono={<ZoomOut aria-hidden="true" />} disabled={zoom <= 1} onClick={() => onZoom?.(zoomVecino(zoom, false))} />
        <button type="button" className={s.zoomValor} onClick={() => onZoom?.(1)} title={verCompleta}>{Math.round(zoom * 100)}%</button>
        <B aria-label="Acercar (Ctrl +)" icono={<ZoomIn aria-hidden="true" />} disabled={zoom >= NIVELES_ZOOM[NIVELES_ZOOM.length - 1]} onClick={() => onZoom?.(zoomVecino(zoom, true))} />
        {onAtajos && <B aria-label="Atajos de teclado" icono={<Keyboard aria-hidden="true" />} onClick={onAtajos} className={s.soloRaton} />}
      </span>
    </div>
  );
}

/**
 * Un paso del panel, con su número en un sello. Hecho, el sello pasa a menta
 * con un check: se ve de un vistazo cuánto falta.
 */
/**
 * Una opción grande con su sello: agregar una imagen o un texto, quitar el
 * fondo, recortar. La misma tarjeta punteada en el paso 3 y en el panel.
 *  - icono · tono (del Sello) · girar · titulo · detalle · onClick · disabled
 */
// solido: borde continuo. El punteado es para "agregar algo nuevo"; en una
// acción sobre lo elegido (Quitar fondo, Recortar) se leía como bloqueado.
export function OpcionSello({ icono, tono, girar = -8, titulo, detalle, onClick, disabled = false, solido = false }) {
  return (
    <button type="button" className={[s.agregarOpcion, solido && s.opcionSolida].filter(Boolean).join(' ')} onClick={onClick} disabled={disabled}>
      <Sello tamano={42} girar={girar} tono={tono}>{icono}</Sello>
      <strong><Texto>{titulo}</Texto></strong>
      {detalle && <small><Texto>{detalle}</Texto></small>}
    </button>
  );
}

const NIVELES_CALIDAD = {
  baja: { paso: 1, nombre: 'Borrosa', texto: 'Se verá borrosa a este tamaño. Achícala o usa una imagen más grande.', tono: 'mal' },
  regular: { paso: 2, nombre: 'Aceptable', texto: 'Si la achicas un poco se verá más nítida.', tono: 'aviso' },
  buena: { paso: 3, nombre: 'Nítida', texto: 'Se imprimirá con buena calidad.', tono: 'ok' },
};
NIVELES_CALIDAD.aceptable = NIVELES_CALIDAD.regular;

/**
 * Cómo se imprimirá una imagen a su tamaño: una barra de tres tramos
 * (borrosa · aceptable · nítida) y, si no está nítida, "Dejarla nítida", que
 * la achica justo hasta el tamaño en que se ve bien.
 *  - calidad: 'baja' | 'regular' | 'aceptable' | 'buena' · onNitida()
 */
export function MedidorCalidad({ calidad, onNitida }) {
  const n = NIVELES_CALIDAD[calidad];
  if (!n) return null;
  return (
    <div className={[s.medidor, s[`medidor_${n.tono}`]].join(' ')} data-componente="MedidorCalidad">
      <BarraProgreso pasos max={3} valor={n.paso} texto={<><Texto>Calidad de impresión</Texto>: <strong><Texto>{n.nombre}</Texto></strong></>} />
      <div className={s.medidorPie}>
        <p><Texto>{n.texto}</Texto></p>
        {n.paso < 3 && onNitida && (
          <BotonEstudio variante="contorno" tamano="sm" icono={<Sparkles aria-hidden="true" />} onClick={onNitida}><Texto>{"Dejarla nítida"}</Texto></BotonEstudio>
        )}
      </div>
    </div>
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
export function PasosEstudio({ colores = [], color, onColor, invertir, lados = [], zona, onZona, onImagen, onTexto, subiendo = false, donde, conDiseno = false }) {
  const actual = colores.find((c) => c.id === color);
  const tituloConDiseno = useTexto('Con diseño');
  return (
    <div className={s.pasos} data-componente="PasosEstudio">
      <PasoEstudio numero={1} titulo="Elige el color" detalle={actual?.nombre} hecho={Boolean(actual)}>
        <SelectorColorEstudio etiqueta="Color de la prenda" colores={colores} valor={actual?.nombre} onChange={(nombre) => onColor?.(colores.find((c) => c.nombre === nombre)?.id)} />
        {invertir && <InterruptorEstudio activo={invertir.activo} onChange={invertir.onCambiar} etiqueta="Invertir colores" descripcion={invertir.texto} />}
      </PasoEstudio>
      <PasoEstudio numero={2} titulo="¿Dónde va tu diseño?" hecho={Boolean(zona)}>
        {lados.map((l) => (
          <div key={l.nombre} className={s.lado}>
            <span className={s.ladoNombre}><Texto>{l.nombre}</Texto></span>
            <div className={s.chips}>
              {l.zonas.map((z) => (
                <Chip key={z.id} tamano="sm" activo={z.id === zona} onClick={() => onZona?.(z.id)}>
                  <Texto>{z.nombre}</Texto>{z.conDiseno && <span className={s.conDiseno} title={tituloConDiseno}><span className={s.oculto}>, <Texto>con diseño</Texto></span></span>}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </PasoEstudio>
      <PasoEstudio numero={3} titulo="Agrega tu imagen o tu texto" hecho={conDiseno}>
        <div className={s.agregar}>
          <OpcionSello icono={<ImagePlus aria-hidden="true" />} titulo="Subir imagen" detalle="Una foto o un logo" onClick={onImagen} disabled={subiendo} />
          <OpcionSello icono={<Type aria-hidden="true" />} tono="rosa" girar={6} titulo="Escribir texto" detalle="Un nombre o una frase" onClick={onTexto} />
        </div>
        {donde && <p className={s.donde}>{subiendo ? <Texto>Subiendo tu imagen…</Texto> : <><Texto>Se agrega en</Texto>: <strong><Texto>{donde}</Texto></strong></>}</p>}
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
  // Lo que muestran los deslizadores junto al número.
  const recta = useTexto('Recta');
  const arco = useTexto('Arco');
  const haciaAbajo = useTexto('Hacia abajo');
  const normal = useTexto('Normal');
  const colorLibre = (campo, porDefecto) => (
    <SelectorColorEstudio
      etiqueta={campo === 'contornoColor' ? 'Color del contorno' : 'Color de la sombra'}
      colores={COLORES_TEXTO}
      libre={{ hex: capa[campo] || porDefecto, onCambiar: (hex) => onCambiar?.({ [campo]: hex }) }}
    />
  );
  return (
    <div className={s.efectos} data-componente="EfectosTexto">
      <div className={s.grupoCampo}>
        <span className={s.rotulo}><Texto>{"Estilo de la letra"}</Texto></span>
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
              <Texto>{e.nombre}</Texto>
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
                <InterruptorEstudio
                  activo={contorno > 0}
                  etiqueta="Contorno"
                  onChange={(on) => onCambiar?.(on
                    ? { contorno: 8, contornoColor: capa.contornoColor || contrasteDe(capa.color) }
                    : { contorno: 0, sinRelleno: false })}
                />
                {contorno > 0 && (
                  <div className={s.efectoCuerpo}>
                    {colorLibre('contornoColor', '#FFFFFF')}
                    <DeslizadorEstudio etiqueta="Grosor" valor={contorno} min={1} max={25} onChange={(v) => onCambiar?.({ contorno: v })} />
                    <CasillaEstudio activo={Boolean(capa.sinRelleno)} onChange={(v) => onCambiar?.({ sinRelleno: v })} etiqueta="Letra transparente" descripcion="Solo se ve (y se imprime) el contorno." />
                  </div>
                )}
              </div>
              <div className={s.efecto}>
                <InterruptorEstudio
                  activo={sombra > 0}
                  etiqueta="Sombra"
                  onChange={(on) => onCambiar?.(on ? { sombra: 6, sombraColor: capa.sombraColor || contrasteDe(capa.color) } : { sombra: 0 })}
                />
                {sombra > 0 && (
                  <div className={s.efectoCuerpo}>
                    {colorLibre('sombraColor', '#111111')}
                    <DeslizadorEstudio etiqueta="Distancia" valor={sombra} min={1} max={20} onChange={(v) => onCambiar?.({ sombra: v })} />
                  </div>
                )}
              </div>
              <div className={s.efecto}>
                <DeslizadorEstudio
                  etiqueta="Curva"
                  valor={curva}
                  min={-100}
                  max={100}
                  formato={(v) => (v === 0 ? recta : v > 0 ? `${arco} ${v}` : `${haciaAbajo} ${-v}`)}
                  // Cerca del medio se queda recta: fácil de volver a 0.
                  onChange={(v) => onCambiar?.({ curva: Math.abs(v) < 5 ? 0 : v })}
                />
                {curva !== 0 && <BotonEstudio variante="fantasma" tamano="sm" onClick={() => onCambiar?.({ curva: 0 })}><Texto>{"Enderezar"}</Texto></BotonEstudio>}
              </div>
              <div className={s.efecto}>
                <DeslizadorEstudio
                  etiqueta="Espacio entre letras"
                  valor={espaciado}
                  min={-100}
                  max={800}
                  paso={10}
                  formato={(v) => (v === 0 ? normal : v > 0 ? `+${v}` : v)}
                  onChange={(v) => onCambiar?.({ espaciado: v })}
                />
              </div>
              {variasLineas && (
                <div className={s.efecto}>
                  <span className={s.rotulo}><Texto>{"Alineación"}</Texto></span>
                  <span className={s.chips}>
                    {[['left', AlignLeft, 'Izquierda'], ['center', AlignCenter, 'Centro'], ['right', AlignRight, 'Derecha']].map(([valor, Icono, nombre]) => (
                      <Chip key={valor} tamano="sm" activo={alineacion === valor} onClick={() => onCambiar?.({ alineacion: valor })} icono={<Icono aria-hidden="true" />}>
                        <span className={s.oculto}><Texto>{nombre}</Texto></span>
                      </Chip>
                    ))}
                  </span>
                  <DeslizadorEstudio etiqueta="Interlineado" valor={Number(capa.interlineado) || 1.05} min={0.7} max={2} paso={0.05} formato={(v) => v.toFixed(2)} onChange={(v) => onCambiar?.({ interlineado: v })} />
                </div>
              )}
            </div>
          ),
        }]}
      />
    </div>
  );
}

export const ALINEAR = [
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
 *    fuera y no se imprimirá · onImagen, onTexto: "Agregar otro" (sin soltar
 *    lo elegido, como en la tienda)
 */
export function PanelCapa({
  capa, zona, onCambiar, onListo, fuentes = [], calidad, onNitida,
  onCentrar, onAlinear, onQuitar, onDuplicar, onAdelante, onAtras,
  onRecortar, onQuitarFondo, onLlenar, zonas = [], onPasarAZona, sinSesion = false,
  anchoZonaCm, fueraDeZona = false, onImagen, onTexto, subiendo = false, puntosPorZona = 100, onAbrirFuentes,
}) {
  const zonaTraducida = useTexto(zona);
  if (!capa) return null;
  const imagen = capa.tipo === 'imagen';
  const tamano = capa.tamano ?? 0.18;
  const ancho = capa.ancho ?? 0.8;
  return (
    <div className={s.panelCapa} data-componente="PanelCapa">
      <div className={s.panelCabeza}>
        <div>
          <h2 className={s.panelTitulo}><TextoResaltado resaltar={[zonaTraducida]} envolver={(x, k) => <em key={k}>{x}</em>}>{`${imagen ? 'Tu imagen' : 'Tu texto'} en ${zona}`}</TextoResaltado></h2>
          <p className={s.panelAyuda}><Texto>{"Los cambios se ven en la prenda al instante."}</Texto></p>
        </div>
        {/* Quitar, aparte y como ícono: lejos de lo que se toca seguido. */}
        <span className={s.panelAcciones}>
          <BotonEstudio variante="fantasma" tamano="sm" soloIcono aria-label="Quitar" title="Quitar (Supr)" icono={<Trash2 aria-hidden="true" />} onClick={onQuitar} className={s.peligro} />
          <BotonEstudio tamano="sm" icono={<Check aria-hidden="true" />} onClick={onListo}><Texto>{"Listo"}</Texto></BotonEstudio>
        </span>
      </div>

      {imagen && <MedidorCalidad calidad={calidad} onNitida={onNitida} />}
      {fueraDeZona && <p className={[s.calidad, s.calidad_aviso].join(' ')}><Texto>{"Una parte queda fuera de la zona y no se imprimirá."}</Texto></p>}

      {!imagen && (
        <>
          {/* Crece solo con lo escrito, sin agarradera (Campo multilinea). */}
          <CampoEstudio etiqueta="Escribe tu texto" multilinea={2} maxLength={120} value={capa.texto || ''} onChange={(e) => onCambiar?.({ texto: e.target.value })} />
          {fuentes.length > 0 && (
            <div onFocusCapture={onAbrirFuentes}>
              <CampoEstudio etiqueta="Letra" opciones={fuentes.map((f) => ({ ...f, icono: <span className={s.muestraLetra} style={{ fontFamily: `'${f.valor}'` }}>Aa</span> }))} buscable value={capa.fuente} onChange={(e) => onCambiar?.({ fuente: e.target.value })} />
            </div>
          )}
          <div className={s.fila}>
            <div className={s.grupoCampo}>
              <span className={s.rotulo}><Texto>{anchoZonaCm ? 'Alto de la letra' : 'Tamaño de letra'}</Texto></span>
              {anchoZonaCm ? (
                // En cm de la prenda, como en la tienda: el alto de la letra.
                <CantidadEstudio
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
                <CantidadEstudio editable etiqueta="Tamaño de la letra" valor={Math.round(tamano * puntosPorZona)} min={4} max={Math.round(puntosPorZona * 0.6)} sufijo="pt" onChange={(v) => onCambiar?.({ tamano: v / puntosPorZona })} />
              )}
            </div>
            <div className={s.grupoCampo}>
              <span className={s.rotulo}><Texto>{"Estilo"}</Texto></span>
              <span className={s.chips}>
                <Chip tamano="sm" activo={Boolean(capa.negrita)} onClick={() => onCambiar?.({ negrita: !capa.negrita })}><b>N</b><span className={s.oculto}> <Texto>negrita</Texto></span></Chip>
                <Chip tamano="sm" activo={Boolean(capa.cursiva)} onClick={() => onCambiar?.({ cursiva: !capa.cursiva })}><i>C</i><span className={s.oculto}> <Texto>cursiva</Texto></span></Chip>
              </span>
            </div>
          </div>
          <SelectorColorEstudio
            etiqueta="Color de la letra"
            colores={COLORES_TEXTO}
            libre={{ hex: capa.color || '#111111', onCambiar: (hex) => onCambiar?.({ color: hex }) }}
          />
          <EfectosTexto capa={capa} onCambiar={onCambiar} />
        </>
      )}

      {imagen && (
        <>
          {/* El tamaño en un solo control (en cm de la prenda si la zona tiene medida). */}
          <div className={s.grupoCampo}>
            <span className={s.rotulo}><Texto>{anchoZonaCm ? 'Ancho de la imagen' : 'Tamaño'}</Texto></span>
            {anchoZonaCm ? (
              <CantidadEstudio
                editable
                etiqueta="Ancho de la imagen en centímetros"
                valor={Math.round(ancho * anchoZonaCm * 10) / 10}
                min={1}
                max={Math.round(anchoZonaCm * 2)}
                paso={1}
                decimales={1}
                sufijo="cm"
                onChange={(cm) => onCambiar?.({ ancho: cm / anchoZonaCm })}
              />
            ) : (
              <CantidadEstudio editable etiqueta="Tamaño de la imagen" valor={Math.round(ancho * 100)} min={5} max={200} paso={5} sufijo="%" onChange={(v) => onCambiar?.({ ancho: v / 100 })} />
            )}
          </div>
          <div className={s.grupoCampo}>
            <span className={s.rotulo}><Texto>{"Arreglar la imagen"}</Texto></span>
            <div className={s.agregar}>
              <OpcionSello solido icono={<Eraser aria-hidden="true" />} tono="rosa" titulo="Quitar fondo" detalle="Deja solo lo importante" onClick={onQuitarFondo} disabled={sinSesion || subiendo} />
              <OpcionSello solido icono={<Crop aria-hidden="true" />} girar={6} titulo="Recortar" detalle="Elige qué parte va" onClick={onRecortar} disabled={sinSesion || subiendo} />
            </div>
            {sinSesion && <span className={s.nota}><Texto>{"Inicia sesión para recortar o quitar el fondo."}</Texto></span>}
            {/* Bloqueados sin decir por qué parecían rotos (en una tablet con wifi lento la subida tarda). */}
            {!sinSesion && subiendo && <span className={s.nota} role="status"><Texto>{"Subiendo tu imagen… en un momento puedes recortarla o quitarle el fondo."}</Texto></span>}
          </div>
        </>
      )}

      <div className={s.grupoCampo}>
        <span className={s.rotulo}><Texto>{"Acomodar en la zona"}</Texto></span>
        {/* Dos bloques (acomodar | alinear) que bajan de línea enteros. */}
        <span className={s.acomodar}>
          <span className={s.grupoIconos}>
            <BotonEstudio variante="contorno" tamano="sm" soloIcono aria-label="Centrar" title="Centrar (C)" icono={<Crosshair aria-hidden="true" />} onClick={onCentrar} />
            {imagen && <BotonEstudio variante="contorno" tamano="sm" soloIcono aria-label="Llenar zona" title="Llenar zona" icono={<Maximize2 aria-hidden="true" />} onClick={onLlenar} />}
            {/* De 90° en 90°, como la tecla R de la tienda. */}
            <BotonEstudio variante="contorno" tamano="sm" soloIcono aria-label="Girar" title="Girar (R)" icono={<RotateCw aria-hidden="true" />} onClick={() => onCambiar?.({ angulo: (Math.round((capa.angulo || 0) / 90) * 90 + 90) % 360 })} />
          </span>
          <span className={s.grupoIconos}>
            {ALINEAR.map(([id, Icono, texto]) => (
              <BotonEstudio key={id} variante="contorno" tamano="sm" soloIcono aria-label={texto} title={texto} icono={<Icono aria-hidden="true" />} onClick={() => onAlinear?.(id)} />
            ))}
          </span>
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
                {imagen && <BotonEstudio variante="fantasma" tamano="sm" icono={<FlipHorizontal aria-hidden="true" />} onClick={() => onCambiar?.({ voltear: !capa.voltear })}><Texto>{"Voltear"}</Texto></BotonEstudio>}
                <BotonEstudio variante="fantasma" tamano="sm" icono={<ArrowUpToLine aria-hidden="true" />} onClick={onAdelante}><Texto>{"Traer adelante"}</Texto></BotonEstudio>
                <BotonEstudio variante="fantasma" tamano="sm" icono={<ArrowDownToLine aria-hidden="true" />} onClick={onAtras}><Texto>{"Enviar atrás"}</Texto></BotonEstudio>
                <BotonEstudio variante="fantasma" tamano="sm" icono={<Copy aria-hidden="true" />} onClick={onDuplicar}><Texto>{"Duplicar"}</Texto></BotonEstudio>
              </span>
              {zonas.length > 1 && (
                <div className={s.grupoCampo}>
                  <span className={s.rotulo}><Texto>{"Pasar a otra zona"}</Texto></span>
                  <span className={s.chips}>{zonas.map((z) => <Chip key={z.id} tamano="sm" onClick={() => onPasarAZona?.(z.id)}><Texto>{z.nombre}</Texto></Chip>)}</span>
                </div>
              )}
            </div>
          ),
        }]}
      />

      {(onImagen || onTexto) && (
        <div className={s.grupoCampo}>
          <span className={s.rotulo}><Texto>{"Agregar otro"}</Texto></span>
          <span className={s.chips}>
            {onImagen && <BotonEstudio variante="contorno" tamano="sm" icono={<ImagePlus aria-hidden="true" />} onClick={onImagen}><Texto>{"Imagen"}</Texto></BotonEstudio>}
            {onTexto && <BotonEstudio variante="contorno" tamano="sm" icono={<Type aria-hidden="true" />} onClick={onTexto}><Texto>{"Texto"}</Texto></BotonEstudio>}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Bajo la cabeza del estudio, al editar algo ya guardado: si es un borrador
 * (se guarda solo), cómo va ese guardado; si es una creación, "Estás
 * editando «nombre» ✎" (se renombra ahí mismo) y si hay cambios sin guardar.
 * Siempre, "Empezar uno nuevo".
 *  - esBorrador · estadoBorrador: 'guardando' | 'guardado' | 'error'
 *  - nombre · onRenombrar(nuevo): promesa · hayCambios · onEmpezarNuevo
 */
export function EstadoEdicion({ esBorrador = false, estadoBorrador = 'guardado', nombre, onRenombrar, hayCambios = false, onEmpezarNuevo }) {
  const borrador = {
    guardando: [LoaderCircle, 'Guardando borrador…', s.girando],
    error: [AlertTriangle, 'No pudimos guardar el borrador. Revisa tu conexión.', s.estadoError],
    guardado: [CheckCircle2, 'Borrador guardado: lo encuentras en Crear para continuarlo después.', s.estadoOk],
  }[estadoBorrador] || [];
  const [Icono, texto, clase] = borrador;
  const sinNombre = useTexto('tu creación');
  return (
    <div className={s.edicion} data-componente="EstadoEdicion">
      {esBorrador ? (
        <span className={s.edicionTexto} role="status">
          {Icono && <Icono aria-hidden="true" className={clase} />}
          <Texto>{texto}</Texto>
        </span>
      ) : (
        <span className={s.edicionTexto}>
          <span className={s.edicionNombre}><Texto>Estás editando</Texto>{' '}<TituloEditable nombre={nombre || sinNombre} onRenombrar={onRenombrar} como="strong" /></span>
          <span className={hayCambios ? s.sinGuardar : s.todoGuardado} role="status">
            <Texto>{hayCambios ? 'Tienes cambios sin guardar.' : 'Todo está guardado.'}</Texto>
          </span>
        </span>
      )}
      {onEmpezarNuevo && <BotonEstudio variante="fantasma" tamano="sm" icono={<Plus aria-hidden="true" />} onClick={onEmpezarNuevo}><Texto>{"Empezar uno nuevo"}</Texto></BotonEstudio>}
    </div>
  );
}

/**
 * El panel con varias capas elegidas (Shift o Ctrl + clic, Ctrl+A): alinear
 * entre ellas, el mismo espacio entre tres o más, centrar el grupo, duplicar
 * y quitar. Si están en zonas distintas, solo duplicar y quitar.
 *  - cantidad · mismaZona · onListo · onAlinear(donde) · onDistribuir('h' |
 *    'v') · onCentrar · onDuplicar · onQuitar
 */
export function PanelVarios({ cantidad, mismaZona = true, onListo, onAlinear, onDistribuir, onCentrar, onDuplicar, onQuitar }) {
  return (
    <div className={s.panelCapa} data-componente="PanelVarios">
      <div className={s.panelCabeza}>
        <div>
          <h2 className={s.panelTitulo}><Texto>{`${cantidad} elementos elegidos`}</Texto></h2>
          <p className={s.panelAyuda}><Texto>{"Se mueven juntos al arrastrar uno."}</Texto></p>
        </div>
        <BotonEstudio tamano="sm" icono={<Check aria-hidden="true" />} onClick={onListo}><Texto>{"Listo"}</Texto></BotonEstudio>
      </div>
      {mismaZona ? (
        <>
          <div className={s.grupoCampo}>
            <span className={s.rotulo}><Texto>{"Alinear entre ellos"}</Texto></span>
            <span className={s.alinear}>
              {ALINEAR.map(([id, Icono, texto]) => (
                <BotonEstudio key={id} variante="contorno" tamano="sm" soloIcono aria-label={texto} title={texto} icono={<Icono aria-hidden="true" />} onClick={() => onAlinear?.(id)} />
              ))}
            </span>
          </div>
          {cantidad > 2 && (
            <div className={s.grupoCampo}>
              <span className={s.rotulo}><Texto>{"Mismo espacio entre ellos"}</Texto></span>
              <span className={s.chips}>
                <BotonEstudio variante="contorno" tamano="sm" icono={<AlignHorizontalDistributeCenter aria-hidden="true" />} onClick={() => onDistribuir?.('h')}><Texto>{"De lado a lado"}</Texto></BotonEstudio>
                <BotonEstudio variante="contorno" tamano="sm" icono={<AlignVerticalDistributeCenter aria-hidden="true" />} onClick={() => onDistribuir?.('v')}><Texto>{"De arriba abajo"}</Texto></BotonEstudio>
              </span>
            </div>
          )}
        </>
      ) : (
        <p className={[s.calidad, s.calidad_aviso].join(' ')}><Texto>{"Están en zonas distintas: para alinearlos, elige solo los de una zona."}</Texto></p>
      )}
      <div className={s.grupoCampo}>
        <span className={s.rotulo}><Texto>{"El grupo"}</Texto></span>
        <span className={s.chips}>
          {mismaZona && <BotonEstudio variante="contorno" tamano="sm" icono={<Crosshair aria-hidden="true" />} onClick={onCentrar}><Texto>{"Centrar en la zona"}</Texto></BotonEstudio>}
          <BotonEstudio variante="contorno" tamano="sm" icono={<Copy aria-hidden="true" />} onClick={onDuplicar}><Texto>{"Duplicar"}</Texto></BotonEstudio>
          <BotonEstudio variante="contorno" tamano="sm" icono={<Trash2 aria-hidden="true" />} onClick={onQuitar} className={s.peligro}><Texto>{`Quitar los ${cantidad}`}</Texto></BotonEstudio>
        </span>
      </div>
    </div>
  );
}

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl';
export { MOD as MOD_ESTUDIO };

/** Los atajos del estudio en cuatro grupos (los de Crear). `lados`: los nombres de los lados, para 1, 2… */
const gruposAtajos = (lados = []) => [
  {
    titulo: 'General',
    atajos: [
      [[[MOD, 'Z']], 'Deshacer'],
      [[[MOD, 'Y'], [MOD, 'Shift', 'Z']], 'Rehacer'],
      [[[MOD, 'S']], 'Guardar'],
      [[['T']], 'Agregar texto'],
      [[['I']], 'Subir imagen'],
      [[[MOD, 'V']], 'Pegar una imagen copiada, un texto o lo que copiaste'],
      [[[MOD, 'A']], 'Elegir todo lo de este lado'],
      ...(lados.length > 1 ? [[[lados.slice(0, 9).map((_, i) => String(i + 1))], lados.slice(0, 9).join(' / ')]] : []),
      [[['?']], 'Ver estos atajos'],
    ],
  },
  {
    titulo: 'Zoom',
    atajos: [
      [[[MOD, '+'], [MOD, '−']], 'Acercar / alejar la prenda'],
      [[[MOD, '0'], ['Shift', '1']], 'Ver la prenda entera'],
      [[['Shift', '2']], 'Acercar a lo elegido'],
    ],
  },
  {
    titulo: 'Con algo elegido',
    atajos: [
      [[['←', '↑', '→', '↓']], 'Mover (con Shift, más rápido)'],
      [[['+'], ['−']], 'Agrandar / achicar'],
      [[['R']], 'Girar (Shift+R al otro lado)'],
      [[['C']], 'Centrar en la zona'],
      [[['F']], 'Voltear imagen'],
      [[[']'], ['[']], 'Adelante / atrás'],
      [[[MOD, 'D']], 'Duplicar'],
      [[[MOD, 'C'], [MOD, 'X']], 'Copiar / cortar'],
      [[['Supr']], 'Quitar'],
      [[['Esc']], 'Soltar la selección'],
    ],
  },
  {
    titulo: 'Con el ratón',
    atajos: [
      [[['Doble clic']], 'En la zona vacía: texto nuevo ahí · en una imagen: recortar'],
      [[['Clic derecho']], 'Más opciones'],
      [[['Shift', 'Clic'], [MOD, 'Clic']], 'Sumar o quitar de la selección'],
      [[[MOD, 'Rueda']], 'Zoom hacia el puntero (o pellizca en el trackpad)'],
      [[['Rueda']], 'Con zoom: subir / bajar por la prenda (Shift: a los costados)'],
      [[['Espacio', 'Arrastrar'], ['Botón del medio']], 'Mover la vista (con zoom)'],
      [[['Arrastrar una imagen']], 'Desde la computadora, a la zona donde la sueltas'],
    ],
  },
];

/** Los atajos de teclado del estudio, en grupos (va dentro de una HojaInferior). */
/**
 * La primera vez que se toca algo con el dedo, sobre la prenda: cómo moverlo,
 * agrandarlo, girarlo y escribir (como la tienda). Va en `encima` del lienzo.
 *  - onEntendido
 */
export function GuiaGestos({ onEntendido }) {
  const nombre = useTexto('Cómo editar con los dedos');
  return (
    // Sus toques no llegan al lienzo (no eligen ni mueven nada).
    <div className={s.guiaGestos} role="dialog" aria-label={nombre} data-componente="GuiaGestos" onPointerDown={(e) => e.stopPropagation()} onPointerDownCapture={(e) => e.stopPropagation()}>
      <ul>
        <LineaGesto icono={<Hand aria-hidden="true" />} fuerte="Un dedo:" texto="arrástralo para moverlo." />
        <LineaGesto icono={<Maximize2 aria-hidden="true" />} fuerte="Dos dedos:" texto="sepáralos o júntalos para agrandar o achicar, y gíralos para girarlo." />
        <LineaGesto icono={<Type aria-hidden="true" />} fuerte="Dos toques" texto="en un texto para escribirlo." />
        <LineaGesto icono={<ZoomIn aria-hidden="true" />} fuerte="Sin nada elegido," texto="dos dedos acercan la prenda." />
      </ul>
      <BotonEstudio bloque tamano="sm" onClick={onEntendido}><Texto>{"Entendido"}</Texto></BotonEstudio>
    </div>
  );
}

/** Una línea de la guía: la frase va entera y su comienzo (ya traducido) queda en negrita. */
function LineaGesto({ icono, fuerte, texto }) {
  const marca = useTexto(fuerte);
  return <li>{icono} <span><TextoResaltado resaltar={[marca]}>{`${fuerte} ${texto}`}</TextoResaltado></span></li>;
}

/** Las teclas que se escriben igual en todos los idiomas (y los símbolos) no se mandan a traducir. */
const TECLAS_IGUALES = new Set(['Ctrl', 'Shift', 'Esc', '⌘']);
const Tecla = ({ tecla }) => <kbd>{tecla.length > 1 && !TECLAS_IGUALES.has(tecla) ? <Texto>{tecla}</Texto> : tecla}</kbd>;

export function AtajosEstudio({ lados = [] }) {
  return (
    <div className={s.atajos} data-componente="AtajosEstudio">
      <div className={s.atajosGrupos}>
        {gruposAtajos(lados).map((g) => (
          <section key={g.titulo} className={s.atajosGrupo}>
            <h3 className={s.rotulo}><Texto>{g.titulo}</Texto></h3>
            <dl className={s.atajosLista}>
              {g.atajos.map(([combinaciones, que]) => (
                <React.Fragment key={que}>
                  <dt>
                    {/* Cada combinación entera en una línea; si no caben, la siguiente baja. */}
                    {combinaciones.map((teclas, i) => (
                      <span key={teclas.join('+')} className={s.atajoCombo}>
                        {i > 0 && <span className={s.atajoO}><Texto>o</Texto></span>}
                        {/* Las flechas son cualquiera de ellas, no una combinación: van sin "+". */}
                        {teclas.map((t, j) => <React.Fragment key={t}>{j > 0 && !teclas.every((x) => '←↑→↓'.includes(x)) && <span className={s.atajoMas}>+</span>}<Tecla tecla={t} /></React.Fragment>)}
                      </span>
                    ))}
                  </dt>
                  <dd><Texto>{que}</Texto></dd>
                </React.Fragment>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * "Cargando tu diseño" sobre la prenda, con la etiqueta de Walá (Cargando):
 * la misma en LienzoPrenda y sobre el lienzo de Fabric de la tienda.
 *  - opaco: el primer dibujo, cuando todavía no hay prenda debajo
 */
export function CargandoLienzo({ opaco = false }) {
  return (
    <div className={[s.cargandoDiseno, opaco && s.cargandoOpaco].filter(Boolean).join(' ')} aria-busy="true">
      <Cargando texto={<Texto>Cargando tu diseño</Texto>} tamano="md" sobreClaro />
    </div>
  );
}

/** "Suelta tu imagen en Pecho": la pastilla mientras se arrastra un archivo sobre la prenda. */
export function AvisoSoltarArchivo({ zona }) {
  const nombre = useTexto(zona);
  return (
    <p className={s.soltarAviso} role="status">
      <TextoResaltado resaltar={[nombre]}>{zona ? `Suelta tu imagen en ${zona}` : 'Suelta tu imagen en la prenda'}</TextoResaltado>
    </p>
  );
}
