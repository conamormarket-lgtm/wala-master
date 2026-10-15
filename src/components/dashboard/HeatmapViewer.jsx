import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getHeatmapByPage } from '../../services/heatmapData';
import { auth } from '../../services/firebase/config';
import { AnimatedNumber, Badge } from '../ui';
import styles from './HeatmapViewer.module.css';
import { T } from '../../i18n/useTranslatedText';

/**
 * VISOR DE MAPA DE CALOR (HeatmapViewer)
 *
 * DOS MODOS de datos (regla: el render NO duplica lógica de filtrado):
 *  - CONTROLADO (DashHeatmap): recibe por props `data` (la salida de
 *    aggregateHeatmapBatches, YA filtrada por rango/origen/dispositivo/ancho)
 *    más `loading`/`error`. Este componente solo PINTA.
 *  - AUTÓNOMO (retrocompatible): sin props hace su propia lectura única con
 *    getHeatmapByPage() al montar, como siempre.
 *
 * La UI ofrece:
 *  1) SELECTOR DE PÁGINAS como MINI-TARJETAS: cada una muestra el nombre legible
 *     de la página, su número grande de clics (AnimatedNumber) y una barra de
 *     intensidad (gradiente violeta proporcional al máximo). La activa se resalta.
 *     (Este selector ES el filtro de RUTA: agrupa y elige por `path`.)
 *  2) PREVIEW REAL de la página dentro de un <iframe src={path}> (misma-origen,
 *     wala.pe) cargada con el tamaño de una pantalla tipo (móvil, tablet o
 *     escritorio, según el ancho elegido) y escalada al panel. La vista se
 *     recorre con scroll como en el teléfono/PC: el iframe se queda fijo y se
 *     desplaza por dentro, y el canvas cubre la PÁGINA COMPLETA (alto que
 *     reporta el iframe con 'WALA_HEATMAP_SYNC'), así cada clic cae a la
 *     altura de la página en que se hizo. Timeout con reintentos; si no carga,
 *     FALLBACK elegante (fondo glass + iniciales/ícono de la página).
 *  3) Panel lateral con el ranking de elementos más clicados (etiquetas legibles
 *     con emoji, ya formateadas en heatmapData.deriveElementLabel).
 *
 * Estética liquid-glass del design system. Sin props requeridas.
 */

// Forma vacía y estable de los datos (evita optional chaining por todo el JSX).
const EMPTY_HEATMAP_DATA = {
  paths: [],
  pageNames: {},
  pointsByPath: {},
  clicksByPath: {},
  maxClicks: 0,
  topElementsByPath: {},
  totalClicks: 0,
  totalDocs: 0,
};

// Pantalla tipo con la que se carga la vista previa, según el ancho de pantalla.
const PANTALLAS_PREVIEW = {
  movil: { w: 390, h: 844, label: 'móvil' },
  tablet: { w: 820, h: 1180, label: 'tablet' },
  desktop: { w: 1280, h: 800, label: 'escritorio' },
};
// Alto máximo (px del panel) de la ventana por la que se ve la página.
const PREVIEW_MAX_H = 640;
// Tope del alto de página aceptado del iframe (evita lienzos gigantes).
const PAGE_MAX_H = 30000;
// Sin alto real (respaldo), la página estimada no pasa de estas pantallas.
const FALLBACK_MAX_SCREENS = 8;
// Radio base del blob de cada clic, como fracción del ancho del lienzo.
const BLOB_RADIUS_RATIO = 0.044;
// Tamaño (px del lienzo) de cada celda de la rejilla de densidad.
const DENSITY_CELL = 3;
// Máximo de resoluciones exactas que se ofrecen en el selector.
const MAX_RESOLUCIONES = 12;
// Elementos del ranking que se ven antes de "Ver todos".
const ELEMENTOS_INICIALES = 8;
// Tiempo máximo de espera a que el iframe cargue antes de asumir fallo.
const IFRAME_TIMEOUT_MS = 6000;
// Reintentos de carga del iframe antes de rendirse al fallback.
const IFRAME_MAX_RETRIES = 2;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

/**
 * Densidad de clics de un lienzo de w x h px (`points` en px: [{ cx, cy }]):
 * cada clic suma un núcleo suave en una rejilla de DENSITY_CELL px.
 * Se calcula aparte del pintado para que la página y la capa FIJA (barras que
 * no se mueven al hacer scroll) compartan el mismo máximo y sus colores se
 * puedan comparar.
 */
function calcularDensidad(points, w, h) {
  const width = Math.max(1, Math.round(w));
  const height = Math.max(1, Math.round(h));
  const gw = Math.ceil(width / DENSITY_CELL);
  const gh = Math.ceil(height / DENSITY_CELL);
  const densidad = new Float32Array(gw * gh);
  const r = Math.max(14, Math.round(width * BLOB_RADIUS_RATIO)) / DENSITY_CELL;
  const r2 = r * r;
  (points || []).forEach(({ cx, cy }) => {
    const gx = cx / DENSITY_CELL;
    const gy = cy / DENSITY_CELL;
    const x0 = Math.max(0, Math.floor(gx - r));
    const x1 = Math.min(gw - 1, Math.ceil(gx + r));
    const y0 = Math.max(0, Math.floor(gy - r));
    const y1 = Math.min(gh - 1, Math.ceil(gy + r));
    for (let y = y0; y <= y1; y += 1) {
      const dy = y + 0.5 - gy;
      for (let x = x0; x <= x1; x += 1) {
        const dx = x + 0.5 - gx;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r2) continue;
        const k = 1 - d2 / r2;
        densidad[y * gw + x] += k * k;
      }
    }
  });
  let max = 0;
  for (let i = 0; i < densidad.length; i += 1) {
    if (densidad[i] > max) max = densidad[i];
  }
  return { width, height, gw, gh, densidad, max };
}

/**
 * Pinta una densidad normalizada por `max` (el de TODOS los lienzos): la zona
 * más clicada es siempre la más roja, haya 5 o 500 clics. La raíz cuadrada
 * mantiene visibles los clics sueltos. Colorea (azul -> verde -> amarillo ->
 * rojo) en la rejilla y lo escala al lienzo.
 */
function pintarDensidad(canvas, d, max) {
  if (!canvas) return;
  // Ajustar el tamaño interno del canvas solo si cambió (evita reflows).
  if (canvas.width !== d.width) canvas.width = d.width;
  if (canvas.height !== d.height) canvas.height = d.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, d.width, d.height);
  if (max <= 0 || d.max <= 0) return;

  const rejilla = document.createElement('canvas');
  rejilla.width = d.gw;
  rejilla.height = d.gh;
  const rctx = rejilla.getContext('2d');
  if (!rctx) return;
  const image = rctx.createImageData(d.gw, d.gh);
  const data = image.data;
  for (let i = 0; i < d.densidad.length; i += 1) {
    if (d.densidad[i] <= 0) continue;
    const [cr, cg, cb, ca] = ramp(Math.sqrt(Math.min(1, d.densidad[i] / max)));
    const o = i * 4;
    data[o] = cr;
    data[o + 1] = cg;
    data[o + 2] = cb;
    data[o + 3] = ca;
  }
  rctx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(rejilla, 0, 0, d.gw * DENSITY_CELL, d.gh * DENSITY_CELL);
}

/**
 * Rampa de color tipo heatmap. t en 0..1.
 * Devuelve [r,g,b,a] (a en 0..255).
 */
function ramp(t) {
  const stops = [
    { p: 0.0, c: [69, 117, 255, 0] },
    { p: 0.25, c: [56, 132, 255, 150] },
    { p: 0.5, c: [16, 185, 129, 200] },
    { p: 0.75, c: [250, 204, 21, 230] },
    { p: 1.0, c: [239, 68, 68, 255] },
  ];
  for (let i = 1; i < stops.length; i += 1) {
    if (t <= stops[i].p) {
      const a = stops[i - 1];
      const b = stops[i];
      const span = b.p - a.p || 1;
      const k = (t - a.p) / span;
      return [
        Math.round(a.c[0] + (b.c[0] - a.c[0]) * k),
        Math.round(a.c[1] + (b.c[1] - a.c[1]) * k),
        Math.round(a.c[2] + (b.c[2] - a.c[2]) * k),
        Math.round(a.c[3] + (b.c[3] - a.c[3]) * k),
      ];
    }
  }
  return stops[stops.length - 1].c;
}

// Texto normalizado para comparar el elemento guardado con el de la página
// (mismo criterio que heatmapData.textoLegible, en minúsculas).
function normTexto(value) {
  return String(value || '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim()
    .toLowerCase();
}

// Clave del ranking 'Enlace:crear' -> { tipo: 'Enlace', texto: 'crear' }.
// Las claves 'sel:…' / 'tipo:…' son de elementos sin texto.
function partesDeClave(key) {
  const i = typeof key === 'string' ? key.indexOf(':') : -1;
  if (i < 0) return { tipo: '', texto: '' };
  const tipo = key.slice(0, i);
  if (tipo === 'sel' || tipo === 'tipo') return { tipo, texto: '' };
  return { tipo, texto: key.slice(i + 1) };
}

// Dónde buscar cada tipo en la página para ubicarlo por su texto.
const SELECTOR_POR_TIPO = {
  Enlace: 'a',
  'Botón': 'button, [role="button"]',
  Campo: 'input, textarea',
  Selector: 'select',
  'Opción': 'label',
};

// ¿Algún texto del elemento de la página es el texto guardado del clic?
// Con "…" (texto cortado a 40 caracteres) basta con que empiece igual. En las
// "Zonas" (clic en un recuadro o texto) basta con que uno contenga al otro.
function coincideTexto(textos, objetivo, tipo) {
  if (!objetivo) return true;
  const cortado = objetivo.endsWith('…');
  const base = cortado ? objetivo.slice(0, -1).trim() : objetivo;
  if (!base) return true;
  return textos.some((t) => {
    if (!t) return false;
    if (t === base) return true;
    if ((cortado || t.length > 40) && t.startsWith(base)) return true;
    return tipo === 'Zona' && (t.includes(base) || base.includes(t));
  });
}

// Textos con los que se puede reconocer un elemento: el visible, aria-label,
// title, alt de su imagen, y los mismos de su botón/enlace contenedor.
function textosDe(el) {
  const de = (n) => (n ? [
    normTexto(n.innerText || n.textContent),
    normTexto(n.getAttribute && n.getAttribute('aria-label')),
    normTexto(n.getAttribute && n.getAttribute('title')),
    normTexto(n.getAttribute && n.getAttribute('data-track')),
    normTexto(n.querySelector && n.querySelector('img[alt]')?.getAttribute('alt')),
  ] : []);
  const accionable = el.closest && el.closest('a, button, [role="button"], [data-track], [aria-label]');
  return [...de(el), ...(accionable && accionable !== el ? de(accionable) : [])].filter(Boolean);
}

// Caja visible del elemento en px de la página (con el iframe en scroll 0), o
// null si está oculto (menú cerrado, cajón fuera de pantalla, opacidad 0…).
function cajaVisible(win, el) {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0 || r.right <= 0 || r.left >= win.innerWidth) return null;
  const estilo = win.getComputedStyle(el);
  if (estilo.visibility === 'hidden' || Number(estilo.opacity) === 0) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height, fijo: esFijo(win, el) };
}

// ¿El elemento (o un contenedor suyo) se queda quieto en la PANTALLA al hacer
// scroll? Barra de abajo, botones flotantes (position: fixed) y la cabecera
// pegada arriba desde el inicio (sticky ya "enganchada" con el scroll en 0).
// Sus clics se pintan en una capa fija de la vista, no sobre la página: si no,
// el recuadro de la barra de abajo quedaba a mitad de la página al bajar.
function esFijo(win, el) {
  let n = el;
  while (n && n.nodeType === 1 && n !== win.document.body) {
    const estilo = win.getComputedStyle(n);
    if (estilo.position === 'fixed') return true;
    if (estilo.position === 'sticky') {
      const top = parseFloat(estilo.top);
      if (Number.isFinite(top) && Math.abs(n.getBoundingClientRect().top - top) < 2) return true;
    }
    n = n.parentElement;
  }
  return false;
}

// Por qué un elemento del ranking no se ve en la vista previa.
//  - Clic dentro de una ventana (modal, panel del buscador): en la vista previa
//    las ventanas están cerradas.
//  - Con texto: no hay ningún elemento así a la vista (vive en un menú o
//    ventana que se abre, o se quitó de la página).
//  - Sin texto: clic antiguo que no guardó en qué elemento fue.
function motivoNoVisible(el) {
  if (el.capa) {
    return {
      corto: `En la ventana «${el.capa}»`,
      largo: `Fue dentro de la ventana «${el.capa}», que en la vista previa está cerrada.`,
      ventana: true,
    };
  }
  if (el.texto && SELECTOR_POR_TIPO[el.tipo]) {
    return {
      corto: 'No está a la vista',
      largo: 'No está a la vista: estaba en una ventana o menú que se abre, o se quitó de la página.',
      ventana: false,
    };
  }
  return {
    corto: 'Sin ubicación exacta',
    largo: 'No se puede señalar: son clics antiguos que no guardaron en qué elemento fueron.',
    ventana: false,
  };
}

// Texto de un elemento del ranking ("Sin texto (2)" si no tiene).
function textoElemento(el) {
  if (el.texto) return el.texto;
  return el.sufijo ? `Sin texto (${el.sufijo})` : 'Sin texto';
}

// Ruta para mostrar: '/producto/:id' -> '/producto/…'.
function rutaVisible(path) {
  return typeof path === 'string' ? path.replace(/\/:[^/]+/g, '/…') : '';
}

/**
 * Iniciales para el fallback elegante (cuando el iframe no carga): toma las
 * primeras letras del nombre legible de la página.
 */
function initialsOf(name) {
  if (!name || typeof name !== 'string') return '🗺️';
  const words = name.replace(/[·/]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '🗺️';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * @param {Object}  props
 * @param {Object}  [props.data]         Modo CONTROLADO: salida de
 *                                       aggregateHeatmapBatches YA filtrada.
 *                                       Si llega, el visor NO lee Firestore.
 * @param {boolean} [props.loading]      Estado de carga externo (modo controlado).
 * @param {string}  [props.error]        Error externo (modo controlado).
 * @param {string}  [props.emptyMessage] Mensaje honesto para el estado vacío
 *                                       (p. ej. "sin clics para estos filtros").
 * @param {string}  [props.ancho]        Ancho de pantalla filtrado
 *                                       ('todos'|'movil'|'tablet'|'desktop'):
 *                                       elige la pantalla de la vista previa.
 */
export default function HeatmapViewer({
  data: dataProp = null,
  loading: loadingProp = false,
  error: errorProp = null,
  emptyMessage = null,
  ancho = 'todos',
}) {
  // Modo controlado = los datos llegan filtrados desde fuera (DashHeatmap).
  const controlled = dataProp != null;

  const [internalLoading, setInternalLoading] = useState(!controlled);
  const [internalError, setInternalError] = useState(null);
  const [internalData, setInternalData] = useState(EMPTY_HEATMAP_DATA);
  const [selectedPath, setSelectedPath] = useState(null);
  // 'todas' = todos los clics sobre una pantalla tipo (posición aproximada);
  // 'ANCHOxALTO' = solo los clics de esa resolución, en su pixel exacto.
  const [resolucion, setResolucion] = useState('todas');
  // Tema con el que se muestra la página en la vista previa.
  const [temaPreview, setTemaPreview] = useState('light');
  // Opacidad del calor (0.3..1): bajarla deja leer la página debajo.
  const [opacidadCalor, setOpacidadCalor] = useState(0.85);
  // Elementos medidos en la vista previa (px de la página, sin escalar):
  //   porSel:   ruta CSS del ancla -> { caja, textos }
  //   porTexto: clave del ranking -> cajas de los elementos con ese texto
  // null = aún sin medir.
  const [anclas, setAnclas] = useState(null);
  // Mostrar también los clics que no se pueden ubicar en la página actual.
  const [mostrarSinUbicar, setMostrarSinUbicar] = useState(false);
  // Ruta en la que está realmente la vista previa (si la página redirige,
  // p. ej. a /login, no coincide con la pedida).
  const [rutaIframe, setRutaIframe] = useState(null);
  // La vista previa muestra un aviso de "Iniciar sesión" en vez de la página.
  const [pideLogin, setPideLogin] = useState(false);
  // La app dentro de la vista previa no llegó a arrancar (sigue el splash):
  // { errores, sesion, controladaPorSW } para explicar por qué.
  const [sinArrancar, setSinArrancar] = useState(null);
  // Elemento del ranking elegido (su `key`): se señala en la vista previa.
  const [elegido, setElegido] = useState(null);
  const [verTodosElementos, setVerTodosElementos] = useState(false);
  const ultimoScrollElegido = useRef(null);

  // Resolución única de la fuente de datos según el modo.
  const data = controlled ? { ...EMPTY_HEATMAP_DATA, ...dataProp } : internalData;
  const loading = controlled ? Boolean(loadingProp) : internalLoading;
  const error = controlled ? (errorProp || null) : internalError;
  // Estado de la preview con iframe: 'loading' | 'ready' | 'failed'
  const [iframeState, setIframeState] = useState('loading');
  // Nº de intento actual (también fuerza el remount del iframe al reintentar).
  const [iframeAttempt, setIframeAttempt] = useState(0);
  // Alto de la página completa dentro del iframe (px sin escalar), reportado
  // por el propio iframe vía postMessage. 0 = aún no se sabe.
  const [pageHeight, setPageHeight] = useState(0);
  // Ancho disponible del marco (px), para escalar la pantalla tipo.
  const [frameW, setFrameW] = useState(0);

  const canvasRef = useRef(null);
  const canvasFijoRef = useRef(null); // calor de los elementos fijos (barra de abajo, cabecera)
  const frameRef = useRef(null); // ventana con scroll por la que se ve la página
  const iframeRef = useRef(null);
  const iframeTimerRef = useRef(null);
  const retriesRef = useRef(0);

  // Lectura propia SOLO en modo autónomo (retrocompatible). En modo controlado
  // los datos llegan ya filtrados por props y aquí no se lee nada.
  useEffect(() => {
    if (controlled) return undefined;
    let mounted = true;
    (async () => {
      setInternalLoading(true);
      try {
        const result = await getHeatmapByPage();
        if (!mounted) return;
        setInternalData(result);
        setInternalError(result.error || null);
      } catch (e) {
        if (!mounted) return;
        setInternalError(e?.message || 'Error cargando el mapa de calor');
      } finally {
        if (mounted) setInternalLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [controlled]);

  // Mantiene la RUTA seleccionada coherente con los datos vigentes (ambos
  // modos): si la página elegida desaparece al cambiar filtros/rango, cae a la
  // primera disponible; si sigue existiendo, se respeta la elección del admin.
  useEffect(() => {
    const paths = data.paths || [];
    if (paths.length === 0) {
      if (selectedPath !== null) setSelectedPath(null);
      return;
    }
    if (!selectedPath || !paths.includes(selectedPath)) {
      setSelectedPath(paths[0]);
    }
  }, [data.paths, selectedPath]);

  const points = useMemo(
    () => (selectedPath ? data.pointsByPath[selectedPath] || [] : []),
    [selectedPath, data.pointsByPath]
  );

  const topElements = useMemo(
    () => (selectedPath ? data.topElementsByPath[selectedPath] || [] : []),
    [selectedPath, data.topElementsByPath]
  );

  const pageName = selectedPath ? (data.pageNames[selectedPath] || selectedPath) : '';
  // Las páginas con código se agrupan ('/producto/:id'): la vista previa abre
  // la página concreta con más clics del grupo (misma-origen = wala.pe).
  const previewPath = selectedPath ? (data.previewPathByPath?.[selectedPath] || selectedPath) : null;
  const iframeSrc = previewPath && previewPath !== 'unknown' && !previewPath.includes('/:') ? previewPath : null;
  const variantes = selectedPath ? (data.variantesByPath?.[selectedPath] || 1) : 1;

  // Resoluciones exactas registradas en esta página (más clics primero).
  const resoluciones = useMemo(() => {
    const grupos = new Map();
    points.forEach((p) => {
      if (!p.sw || !p.sh) return;
      const key = `${p.sw}x${p.sh}`;
      const g = grupos.get(key);
      if (g) g.count += 1;
      else grupos.set(key, { key, w: p.sw, h: p.sh, count: 1 });
    });
    return [...grupos.values()].sort((a, b) => b.count - a.count).slice(0, MAX_RESOLUCIONES);
  }, [points]);
  const exacta = resoluciones.find((r) => r.key === resolucion) || null;

  // Si la resolución elegida no existe en la página/filtros vigentes, vuelve a 'todas'.
  useEffect(() => {
    if (resolucion !== 'todas' && !exacta) setResolucion('todas');
  }, [resolucion, exacta]);

  const visiblePoints = useMemo(
    () => (exacta ? points.filter((p) => p.sw === exacta.w && p.sh === exacta.h) : points),
    [exacta, points]
  );

  // Al cambiar de página no queda ningún elemento elegido.
  useEffect(() => {
    setElegido(null);
    setVerTodosElementos(false);
  }, [selectedPath]);

  // Reinicia el estado del iframe cada vez que cambia la página seleccionada.
  useEffect(() => {
    if (iframeTimerRef.current) {
      clearTimeout(iframeTimerRef.current);
      iframeTimerRef.current = null;
    }
    retriesRef.current = 0;
    setPageHeight(0);
    setRutaIframe(null);
    setPideLogin(false);
    setSinArrancar(null);
    setIframeAttempt(0);
    if (frameRef.current) frameRef.current.scrollTop = 0;
    if (!iframeSrc) {
      setIframeState('failed'); // sin ruta navegable -> fallback elegante
      return undefined;
    }
    setIframeState('loading');
    return undefined;
  }, [iframeSrc]);

  // Timeout + reintentos: si el iframe no avisa de 'ready' a tiempo, reintenta
  // (remontándolo) hasta agotar IFRAME_MAX_RETRIES; luego cae al fallback.
  useEffect(() => {
    if (!iframeSrc) return undefined;
    if (iframeState !== 'loading') return undefined;

    iframeTimerRef.current = setTimeout(() => {
      if (retriesRef.current < IFRAME_MAX_RETRIES) {
        retriesRef.current += 1;
        setIframeAttempt((n) => n + 1); // fuerza remount -> nuevo intento de carga
      } else {
        setIframeState('failed');
      }
    }, IFRAME_TIMEOUT_MS);

    return () => {
      if (iframeTimerRef.current) {
        clearTimeout(iframeTimerRef.current);
        iframeTimerRef.current = null;
      }
    };
  }, [iframeSrc, iframeState, iframeAttempt]);

  // Escucha el postMessage 'WALA_HEATMAP_SYNC' del iframe (lo emite
  // useHeatmapTracker cuando corre dentro del marco) con el alto de la página.
  useEffect(() => {
    const onMessage = (e) => {
      const payload = e?.data;
      if (!payload || payload.type !== 'WALA_HEATMAP_SYNC') return;
      // Solo el iframe de esta vista previa (no otro marco de la página).
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;
      const h = Number(payload.height);
      if (Number.isFinite(h) && h > 0) {
        setPageHeight(Math.min(PAGE_MAX_H, Math.round(h)));
      }
      try {
        setRutaIframe(iframeRef.current?.contentWindow?.location?.pathname || null);
      } catch {
        /* sin acceso al marco */
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Pantalla de la vista previa: la del ancho filtrado o, con 'todos', la del
  // ancho con más clics en esta página.
  const anchoPreview = useMemo(() => {
    if (PANTALLAS_PREVIEW[ancho]) return ancho;
    const cuenta = {};
    points.forEach((p) => {
      if (p.ancho) cuenta[p.ancho] = (cuenta[p.ancho] || 0) + 1;
    });
    let mejor = 'desktop';
    let max = 0;
    Object.entries(cuenta).forEach(([k, c]) => {
      if (c > max) {
        max = c;
        mejor = k;
      }
    });
    return mejor;
  }, [ancho, points]);
  const pantalla = exacta
    ? { w: exacta.w, h: exacta.h, label: `${exacta.w} × ${exacta.h}` }
    : PANTALLAS_PREVIEW[anchoPreview];

  // Escala de la pantalla tipo al panel (nunca agranda) y alto de la página.
  // Sin alto real (respaldo o mientras carga) se estima con los clics viejos
  // más profundos, medidos en pantallas.
  const scale = frameW > 0 ? Math.min(1, frameW / pantalla.w, PREVIEW_MAX_H / pantalla.h) : 0;
  const pantallasEstimadas = visiblePoints.reduce(
    (m, p) => (exacta ? Math.max(m, p.py / exacta.h) : p.yFrac == null ? Math.max(m, p.yScreens) : m),
    1
  );
  const docH = pageHeight > 0
    ? Math.max(pageHeight, pantalla.h)
    : Math.round(pantalla.h * Math.min(pantallasEstimadas, FALLBACK_MAX_SCREENS));
  const stageW = pantalla.w * scale;
  const stageH = docH * scale;
  const viewH = pantalla.h * scale;

  // Clics en px del lienzo, de lo más fiable a lo menos:
  //  1) ANCLA: el elemento clicado existe en la vista previa -> el punto va
  //     encima de él, en la misma posición relativa (vale para cualquier
  //     pantalla del visitante).
  //  2) Pantalla exacta: pageX/pageY tal cual (mismo layout que el visitante).
  //  3) 'Todas' sin ancla: fracción del alto de la página (o pantallas bajadas
  //     en los clics viejos) -> posición APROXIMADA.
  //
  // Cada clic se ubica sobre un elemento REAL de la página actual:
  //  1) su ancla (ruta CSS), si el elemento de esa ruta tiene el mismo texto
  //     que el clic (si la página cambió, la ruta puede apuntar a otra cosa);
  //  2) si no, el elemento con su mismo tipo y texto (sirve para los clics
  //     viejos sin ancla); con varios iguales, el más cercano a donde cayó.
  //  3) si no hay ninguno, el clic queda "sin ubicar": su elemento ya no está
  //     (se eliminó o cambió de texto) o es un clic viejo sin texto. Esos no
  //     se pintan (salvo que se pida), para no señalar cosas que no existen.
  const { pixelPoints, sinUbicar } = useMemo(() => {
    let sinUbicarN = 0;
    const lista = visiblePoints.map((p) => {
      const xAprox = exacta ? p.px : p.xNorm * pantalla.w;
      const yAprox = exacta
        ? Math.min(p.py, docH)
        : (p.yFrac != null ? p.yFrac * docH : Math.min(p.yScreens * pantalla.h, docH));
      // Altura del clic dentro de la PANTALLA del visitante (para elegir
      // entre candidatos fijos, que viven en la pantalla y no en la página).
      const yPantalla = (p.vy != null ? p.vy : 0.5) * pantalla.h;
      const enCaja = (a) => ({
        cx: (a.x + p.rx * a.w) * scale,
        cy: (a.fijo ? a.y + p.ry * a.h : Math.min(a.y + p.ry * a.h, docH)) * scale,
        el: p.el,
        caja: { x: a.x * scale, y: a.y * scale, w: a.w * scale, h: a.h * scale },
        fijo: Boolean(a.fijo),
        ubicado: true,
      });

      const { tipo, texto } = partesDeClave(p.el);
      const ancla = p.sel && anclas ? anclas.porSel.get(p.sel) : null;
      if (ancla && coincideTexto(ancla.textos, texto, tipo)) return enCaja(ancla.caja);

      const candidatos = p.el && anclas ? anclas.porTexto.get(p.el) : null;
      if (candidatos && candidatos.length > 0) {
        const distancia = (c) => Math.abs(c.y + c.h / 2 - (c.fijo ? yPantalla : yAprox));
        const cercano = candidatos.reduce((m, c) => (distancia(c) < distancia(m) ? c : m));
        return enCaja(cercano);
      }

      if (anclas) sinUbicarN += 1;
      return { cx: xAprox * scale, cy: yAprox * scale, el: p.el, caja: null, fijo: false, ubicado: !anclas };
    });
    return { pixelPoints: lista, sinUbicar: sinUbicarN };
  }, [visiblePoints, anclas, exacta, docH, pantalla.w, pantalla.h, scale]);

  // Claves del ranking que se encontraron en la página actual.
  const clavesEnPagina = useMemo(() => {
    if (!anclas) return null;
    const set = new Set(anclas.porTexto.keys());
    pixelPoints.forEach((p) => {
      if (p.ubicado && p.el) set.add(p.el);
    });
    return set;
  }, [anclas, pixelPoints]);

  // Mide el ancho disponible del marco (responsive / cambio de layout).
  const hasData = !loading && !error && data.totalClicks > 0;
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const medir = () => setFrameW(frame.clientWidth);
    medir();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir);
      return () => window.removeEventListener('resize', medir);
    }
    const ro = new ResizeObserver(medir);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [hasData]);

  // Con un elemento elegido, el calor muestra solo sus clics.
  const puntosCalor = useMemo(
    () => pixelPoints.filter((p) => (
      (!elegido || p.el === elegido) && (p.ubicado || mostrarSinUbicar)
    )),
    [elegido, pixelPoints, mostrarSinUbicar]
  );

  // Recuadros que señalan el elemento elegido: SOLO cajas de elementos reales
  // encontrados en la página (puede haber varias: el "Crear" del menú y el del
  // pie). Si no se encontró, no se inventa ningún recuadro: la barra lo avisa.
  const marcas = useMemo(() => {
    if (!elegido) return [];
    const cajas = new Map();
    puntosCalor.forEach((p) => {
      if (p.caja) {
        cajas.set(`${p.fijo ? 'f' : 'p'}|${Math.round(p.caja.x)}|${Math.round(p.caja.y)}`, { ...p.caja, fijo: p.fijo });
      }
    });
    return [...cajas.values()].sort((a, b) => a.y - b.y).slice(0, 6);
  }, [elegido, puntosCalor]);

  // (Re)dibuja el heatmap: la página completa en un lienzo y los elementos
  // fijos en otro dentro de la ventana (quieto al hacer scroll), con el mismo
  // máximo para que los colores se comparen.
  useEffect(() => {
    if (stageW <= 0 || stageH <= 0) return;
    const enPagina = calcularDensidad(puntosCalor.filter((p) => !p.fijo), stageW, stageH);
    const enPantalla = calcularDensidad(puntosCalor.filter((p) => p.fijo), stageW, viewH);
    const max = Math.max(enPagina.max, enPantalla.max);
    pintarDensidad(canvasRef.current, enPagina, max);
    pintarDensidad(canvasFijoRef.current, enPantalla, max);
  }, [puntosCalor, stageW, stageH, viewH]);

  // Al elegir un elemento: la vista baja hasta él (una sola vez por elección).
  useEffect(() => {
    if (!elegido) {
      ultimoScrollElegido.current = null;
      return;
    }
    if (marcas.length === 0 || ultimoScrollElegido.current === elegido) return;
    ultimoScrollElegido.current = elegido;
    const frame = frameRef.current;
    if (!frame) return;
    // Los recuadros fijos se ven siempre: solo se baja hasta uno de la página.
    const m = marcas.find((x) => !x.fijo);
    if (m) frame.scrollTo({ top: Math.max(0, m.y + m.h / 2 - viewH / 2), behavior: 'smooth' });
    // Si la vista no se ve entera (en pantallas angostas el ranking va debajo),
    // la página sube hasta ella para que se vea el recuadro y la barra.
    const r = frame.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) {
      frame.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [elegido, marcas, viewH]);

  // El iframe queda fijo en la ventana y se desplaza por dentro al mismo
  // ritmo que el scroll del marco, para que la página y el calor coincidan.
  const syncIframeScroll = useCallback(() => {
    const frame = frameRef.current;
    const win = iframeRef.current?.contentWindow;
    if (!frame || !win || scale <= 0) return;
    try {
      win.scrollTo({ top: frame.scrollTop / scale, left: 0, behavior: 'instant' });
    } catch {
      /* el iframe aún no está listo */
    }
  }, [scale]);

  useEffect(() => {
    syncIframeScroll();
  }, [syncIframeScroll, pageHeight, iframeState]);

  // Mide en la vista previa la caja de cada elemento clicado (ancla). Se mide
  // con el iframe arriba del todo (scroll 0) y se devuelve a su sitio en la
  // misma tarea, así no hay parpadeo: las barras fijas/sticky quedan en su
  // posición de inicio de página. Elementos ocultos o fuera de pantalla
  // (menús cerrados, cajones) no cuentan: esos clics usan las coordenadas.
  const medirAnclas = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    const doc = iframeRef.current?.contentDocument;
    if (!win || !doc) return;
    const porSel = new Map();
    const porTexto = new Map();
    const scrollAntes = win.scrollY;
    win.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    // 1) Anclas por ruta CSS.
    [...new Set(points.map((p) => p.sel).filter(Boolean))].forEach((sel) => {
      let el = null;
      try {
        el = doc.querySelector(sel);
      } catch {
        el = null;
      }
      const caja = el ? cajaVisible(win, el) : null;
      if (caja) porSel.set(sel, { caja, textos: textosDe(el) });
    });

    // 2) Elementos por su tipo y texto (enlaces, botones, campos…).
    const porTipo = {};
    [...new Set(points.map((p) => p.el).filter(Boolean))].forEach((key) => {
      const { tipo, texto } = partesDeClave(key);
      const selector = SELECTOR_POR_TIPO[tipo];
      if (!selector || !texto) return;
      if (!porTipo[tipo]) {
        porTipo[tipo] = [...doc.querySelectorAll(selector)]
          .map((el) => ({ caja: cajaVisible(win, el), textos: textosDe(el) }))
          .filter((c) => c.caja);
      }
      const encontrados = porTipo[tipo].filter((c) => coincideTexto(c.textos, texto, tipo)).map((c) => c.caja);
      if (encontrados.length > 0) porTexto.set(key, encontrados.slice(0, 10));
    });

    // 3) ¿La página muestra un "Iniciar sesión" en su contenido? Pasa en las
    //    páginas de cuenta cuando la vista previa se abre sin sesión.
    const contenido = doc.querySelector('#main-content-area') || doc.body;
    const enLogin = /^\/(login|registro)/.test(win.location.pathname);
    setPideLogin(!enLogin && [...contenido.querySelectorAll('a, button')].some((el) => {
      const t = normTexto(el.innerText || el.textContent);
      const esLogin = /^(iniciar|inicia) sesi[oó]n$|^ingresar$/.test(t) || (el.getAttribute('href') || '').endsWith('/login');
      return esLogin && Boolean(cajaVisible(win, el));
    }));

    win.scrollTo({ top: scrollAntes, left: 0, behavior: 'instant' });
    setAnclas({ porSel, porTexto });
  }, [points]);

  // Se mide al cargar y otra vez cuando la página termina de pintar contenido
  // (productos, imágenes) o cambia de tamaño de pantalla.
  useEffect(() => {
    if (iframeState !== 'ready') {
      setAnclas(null);
      return undefined;
    }
    const timers = [300, 1200, 3000].map((t) => setTimeout(medirAnclas, t));
    return () => timers.forEach(clearTimeout);
  }, [iframeState, medirAnclas, pageHeight, pantalla.w]);

  // Le pasa la sesión del panel a la página de la vista previa si arrancó sin
  // ella (ver window.__walaVistaPrevia en services/firebase/config.js): así las
  // páginas de cuenta se ven por dentro y no con el aviso de "Iniciar sesión".
  // Solo se pasa si de verdad falta: primero se espera a que Auth, dentro de
  // la vista previa, termine de recuperar su sesión guardada (puerta.listo).
  // Pasarla antes, a media carga, cambiaba la sesión mientras la página leía
  // su perfil y la dejaba cargando para siempre.
  // Devuelve false si aún no se pudo intentar (la puerta no existe todavía).
  const pasarSesion = useCallback(async () => {
    const win = iframeRef.current?.contentWindow;
    const puerta = win?.__walaVistaPrevia;
    if (!puerta || !auth?.currentUser) return false;
    try {
      await puerta.listo();
      // El iframe cambió mientras se esperaba (otra página): no tocar nada.
      if (iframeRef.current?.contentWindow !== win) return true;
      if (!puerta.tieneSesion()) await puerta.recibirSesion(auth.currentUser);
    } catch (e) {
      console.warn('[Mapa de calor] No se pudo pasar la sesión a la vista previa:', e?.message || e);
    }
    return true;
  }, []);

  // Un solo traspaso por carga del iframe (se reintenta solo si la puerta aún
  // no existía).
  useEffect(() => {
    if (iframeState !== 'ready') return undefined;
    let estado = 'pendiente';
    const intentar = async () => {
      if (estado !== 'pendiente') return;
      estado = 'en curso';
      estado = (await pasarSesion()) ? 'hecho' : 'pendiente';
    };
    const timers = [0, 1500, 4000].map((t) => setTimeout(intentar, t));
    return () => {
      estado = 'cancelado';
      timers.forEach(clearTimeout);
    };
  }, [iframeState, pasarSesion, iframeAttempt]);

  // ¿Arrancó la app dentro de la vista previa? Si a los 10 s sigue el splash
  // de index.html (#app-loading) y no hay app de React, se avisa con lo que
  // se sepa: errores del arranque (window.__erroresArranque, ver index.html),
  // si tenía sesión y si la sirvió el service worker. Se revisa otra vez a
  // los 25 s por si solo era lenta.
  useEffect(() => {
    if (iframeState !== 'ready') return undefined;
    const revisar = () => {
      try {
        const win = iframeRef.current?.contentWindow;
        const doc = iframeRef.current?.contentDocument;
        if (!win || !doc) return;
        const atascada = Boolean(doc.getElementById('app-loading')) && !doc.querySelector('#root .App');
        if (!atascada) {
          setSinArrancar(null);
          return;
        }
        const diagnostico = {
          errores: Array.isArray(win.__erroresArranque) ? [...win.__erroresArranque] : [],
          sesion: win.__walaVistaPrevia ? win.__walaVistaPrevia.tieneSesion() : null,
          controladaPorSW: Boolean(win.navigator?.serviceWorker?.controller),
          ruta: win.location.pathname,
        };
        console.warn('[Mapa de calor] La vista previa no arrancó:', diagnostico);
        setSinArrancar(diagnostico);
      } catch (e) {
        console.warn('[Mapa de calor] No se pudo revisar la vista previa:', e?.message || e);
      }
    };
    const timers = [10000, 25000].map((t) => setTimeout(revisar, t));
    return () => timers.forEach(clearTimeout);
  }, [iframeState, iframeAttempt]);

  // Aplica el tema claro/oscuro elegido a la página de la vista previa.
  const aplicarTemaPreview = useCallback(() => {
    try {
      iframeRef.current?.contentDocument?.documentElement?.setAttribute('data-theme', temaPreview);
    } catch {
      /* aún no cargó: onLoad lo vuelve a aplicar */
    }
  }, [temaPreview]);

  useEffect(() => {
    aplicarTemaPreview();
  }, [aplicarTemaPreview, iframeState]);

  // La vista previa acabó en otra página (redirigida): sus clics no coinciden
  // con lo que se ve.
  const normRuta = (r) => (r && r.length > 1 && r.endsWith('/') ? r.slice(0, -1) : r);
  const vistaRedirigida = Boolean(
    iframeSrc && rutaIframe && iframeState === 'ready' && normRuta(rutaIframe) !== normRuta(iframeSrc)
  );

  const handleIframeLoad = () => {
    // 'load' dispara tanto en éxito como en about:blank; si hay src, lo damos por
    // bueno (el navegador no expone errores cross-doc por seguridad).
    if (iframeSrc) {
      if (iframeTimerRef.current) {
        clearTimeout(iframeTimerRef.current);
        iframeTimerRef.current = null;
      }
      aplicarTemaPreview();
      setIframeState('ready');
    }
  };

  const handleIframeError = () => {
    if (retriesRef.current < IFRAME_MAX_RETRIES) {
      retriesRef.current += 1;
      setIframeAttempt((n) => n + 1);
    } else {
      setIframeState('failed');
    }
  };

  // Reintento manual desde el fallback.
  const handleRetry = () => {
    retriesRef.current = 0;
    setSinArrancar(null);
    setPageHeight(0);
    setIframeState('loading');
    setIframeAttempt((n) => n + 1);
  };

  const maxElementCount = topElements.length > 0 ? topElements[0].count : 0;
  const totalElementos = Math.max(
    data.clicksByPath?.[selectedPath] || 0,
    topElements.reduce((t, e) => t + e.count, 0)
  );
  const elementosVisibles = verTodosElementos ? topElements : topElements.slice(0, ELEMENTOS_INICIALES);
  const posElegido = elegido ? topElements.findIndex((e) => e.key === elegido) + 1 : 0;
  const elElegido = posElegido > 0 ? topElements[posElegido - 1] : null;
  const hayZonas = topElements.some((e) => e.tipo === 'Zona');

  // Si el elemento elegido sale del ranking (cambio de filtros), se suelta.
  useEffect(() => {
    if (elegido && !topElements.some((e) => e.key === elegido)) setElegido(null);
  }, [elegido, topElements]);
  const showIframe = iframeState !== 'failed' && !!iframeSrc;
  const maxClicks = data.maxClicks || 0;

  // El marco mide una pantalla tipo escalada (+2px de su borde, para que el
  // scroll del marco y el del iframe terminen juntos); hasta medirlo manda el
  // aspect-ratio del CSS.
  const frameStyle = viewH > 0 ? { height: `${viewH + 2}px` } : undefined;
  const hayScroll = stageH > viewH + 1;

  return (
    <motion.section
      className={styles.wrapper}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Orbes difuminados de fondo */}
      <div className={styles.blobA} aria-hidden="true" />
      <div className={styles.blobB} aria-hidden="true" />

      <motion.header className={styles.header} variants={itemVariants}>
        <div>
          <h2 className={styles.title}><T>Mapa de calor</T></h2>
          <p className={styles.subtitle}>
            Dónde hacen clic tus visitantes, página por página.
          </p>
        </div>
        {hasData && (
          <div className={styles.statsPill}>
            <AnimatedNumber
              className={styles.statValue}
              value={data.totalClicks}
              format={(v) => Math.round(v).toLocaleString('es-PE')}
            />
            <span className={styles.statLabel}>clics analizados</span>
          </div>
        )}
      </motion.header>

      {loading && (
        <motion.div className={styles.stateBox} variants={itemVariants}>
          <span className={styles.spinner} aria-hidden="true" />
          Cargando mapa de calor…
        </motion.div>
      )}

      {!loading && error && (
        <motion.div className={`${styles.stateBox} ${styles.errorBox}`} variants={itemVariants}>
          No se pudo cargar el mapa de calor.
          <span className={styles.errorDetail}>{String(error)}</span>
        </motion.div>
      )}

      {!loading && !error && data.totalClicks === 0 && (
        <motion.div className={styles.stateBox} variants={itemVariants}>
          <span className={styles.emptyIcon} aria-hidden="true">🗺️</span>
          {/* Mensaje honesto: el padre puede explicar si el vacío se debe a los
              filtros/rango elegidos (y no a la falta total de datos). */}
          {emptyMessage
            || 'Aún sin datos de heatmap. En cuanto tus visitantes empiecen a interactuar, verás aquí dónde hacen clic.'}
        </motion.div>
      )}

      {hasData && (
        <>
          {/* SELECTOR DE PÁGINAS como MINI-TARJETAS */}
          <motion.div
            className={styles.pageCards}
            variants={itemVariants}
            role="tablist"
            aria-label="Páginas con datos de mapa de calor"
          >
            {data.paths.map((path) => {
              const count = data.clicksByPath?.[path] ?? (data.pointsByPath[path] || []).length;
              const name = data.pageNames?.[path] || path;
              const active = path === selectedPath;
              const pct = maxClicks > 0 ? Math.max(6, Math.round((count / maxClicks) * 100)) : 0;
              return (
                <motion.button
                  key={path}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`${styles.pageCard} ${active ? styles.pageCardActive : ''}`}
                  onClick={() => setSelectedPath(path)}
                  title={`${name} — ${path}`}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className={styles.pageCardTop}>
                    <span className={styles.pageCardName}>{name}</span>
                    {active && <span className={styles.pageCardDot} aria-hidden="true" />}
                  </span>
                  <AnimatedNumber
                    className={styles.pageCardCount}
                    value={count}
                    format={(v) => Math.round(v).toLocaleString('es-PE')}
                  />
                  <span className={styles.pageCardCountLabel}>clics</span>
                  <span className={styles.pageCardTrack} aria-hidden="true">
                    <span className={styles.pageCardFill} style={{ width: `${pct}%` }} />
                  </span>
                  <span className={styles.pageCardRoute}>
                    {rutaVisible(path)}
                    {(data.variantesByPath?.[path] || 1) > 1 ? ` · ${data.variantesByPath[path]} páginas` : ''}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>

          <motion.div className={styles.grid} variants={itemVariants}>
            <div className={styles.canvasCard}>
              <div className={styles.canvasHead}>
                <span className={styles.canvasPath} title={selectedPath}>
                  {pageName}
                  <span className={styles.canvasRoute}>
                    {variantes > 1
                      ? `${variantes} páginas · vista previa de la más clicada`
                      : rutaVisible(selectedPath)}
                  </span>
                </span>
                <Badge tone={showIframe ? 'success' : 'neutral'} size="sm">
                  {visiblePoints.length.toLocaleString('es-PE')} clics
                </Badge>
              </div>

              <div className={styles.previewControls}>
                <label className={styles.controlField}>
                  <span className={styles.controlLabel}>Pantalla del visitante</span>
                  <select
                    className={styles.controlSelect}
                    value={exacta ? exacta.key : 'todas'}
                    onChange={(e) => setResolucion(e.target.value)}
                  >
                    <option value="todas">
                      Todas las pantallas · {points.length.toLocaleString('es-PE')} clics
                    </option>
                    {resoluciones.map((r) => (
                      <option key={r.key} value={r.key}>
                        Solo {r.w} × {r.h} · {r.count.toLocaleString('es-PE')} {r.count === 1 ? 'clic' : 'clics'}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.intensityField}>
                  <span className={styles.controlLabel}>Intensidad del calor</span>
                  <input
                    type="range"
                    min="0.3"
                    max="1"
                    step="0.05"
                    value={opacidadCalor}
                    onChange={(e) => setOpacidadCalor(Number(e.target.value))}
                    className={styles.intensityRange}
                    aria-label="Intensidad del calor sobre la página"
                  />
                </label>
                <div className={styles.themeToggle} role="group" aria-label="Tema de la vista previa">
                  {[
                    { value: 'light', label: 'Claro' },
                    { value: 'dark', label: 'Oscuro' },
                  ].map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className={`${styles.themeBtn} ${temaPreview === t.value ? styles.themeBtnActive : ''}`}
                      aria-pressed={temaPreview === t.value}
                      onClick={() => setTemaPreview(t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {vistaRedirigida && (
                <div className={styles.avisoRedirigida} role="status">
                  La vista previa terminó en <strong>{rutaIframe}</strong> en vez de esta página
                  {/login|registro/.test(rutaIframe) ? ' (pide iniciar sesión)' : ''}: el calor no
                  coincide con lo que se ve.
                </div>
              )}
              {sinArrancar && (
                <div className={styles.avisoRedirigida} role="alert">
                  <strong>La página no terminó de arrancar dentro de la vista previa.</strong>{' '}
                  {sinArrancar.errores.length > 0
                    ? 'Al arrancar dio este error:'
                    : 'No dio ningún error: se quedó esperando algo al arrancar.'}
                  {sinArrancar.errores.length > 0 && (
                    <ul className={styles.avisoLista}>
                      {sinArrancar.errores.slice(0, 3).map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  )}
                  <span className={styles.avisoDetalle}>
                    {sinArrancar.sesion === null
                      ? 'La app ni siquiera cargó su código.'
                      : sinArrancar.sesion ? 'Tenía tu sesión.' : 'No tenía sesión.'}
                    {sinArrancar.controladaPorSW ? ' La sirvió la caché del sitio (service worker).' : ''}
                  </span>
                  <span className={styles.avisoAcciones}>
                    <button type="button" className={styles.notaBoton} onClick={handleRetry}>Reintentar</button>
                    {iframeSrc && (
                      <a className={styles.notaBoton} href={iframeSrc} target="_blank" rel="noopener noreferrer">
                        Abrir la página en otra pestaña
                      </a>
                    )}
                  </span>
                </div>
              )}

              {!vistaRedirigida && pideLogin && (
                <div className={styles.avisoRedirigida} role="status">
                  Esta página pide iniciar sesión y la vista previa se abrió sin sesión: se ve el aviso
                  de login en vez de la página que vio el cliente. Los clics de lo que está detrás del
                  login no se pueden ubicar.
                </div>
              )}

              {elElegido && (
                <div className={styles.seleccionBar} role="status">
                  <span className={styles.seleccionNum}>{posElegido}</span>
                  <span className={styles.tipoChip}>{elElegido.tipo}</span>
                  <span className={styles.seleccionTexto} title={textoElemento(elElegido)}>
                    {textoElemento(elElegido)}
                  </span>
                  <span className={styles.seleccionInfo}>
                    {marcas.length > 0
                      ? `${puntosCalor.length.toLocaleString('es-PE')} ${puntosCalor.length === 1 ? 'clic' : 'clics'}${
                        marcas.length > 1 ? ` en ${marcas.length} lugares de la página (desplázate para verlos)` : ''
                      }`
                      : !anclas
                        ? 'Buscándolo en la página…'
                        : motivoNoVisible(elElegido).largo}
                  </span>
                  <button type="button" className={styles.seleccionQuitar} onClick={() => setElegido(null)}>
                    Ver todo el mapa
                  </button>
                </div>
              )}

              <div
                ref={frameRef}
                className={`${styles.canvasFrame} ${showIframe ? styles.canvasFrameLive : ''}`}
                style={frameStyle}
                onScroll={syncIframeScroll}
              >
                {/*
                  * PREVIEW real de la página (misma-origen wala.pe).
                  * Wala es una SPA client-side (Vite): el #root solo trae un splash y
                  * TODO el contenido lo pinta JavaScript. Sin 'allow-scripts' el iframe
                  * quedaría en blanco y la preview sería inservible (siempre fallback a
                  * cuadrícula). Por eso mantenemos 'allow-same-origin allow-scripts' y
                  * confiamos en (1) caché en memoria de Firestore dentro del iframe y
                  * (2) tracking desactivado dentro del iframe (IN_IFRAME) para evitar el
                  * conflicto del lock de persistencia, el doble-conteo y las escrituras
                  * 404/400. El propio iframe nos avisa de su altura con WALA_HEATMAP_SYNC.
                  *
                  * Escenario = la página completa a escala. La ventana (sticky) mide una
                  * pantalla y lleva el iframe; el canvas cubre todo el escenario.
                  */}
                <div className={styles.stage} style={{ width: `${stageW}px`, height: `${Math.max(stageH, viewH)}px` }}>
                  <div className={styles.stageViewport} style={{ height: `${viewH}px` }}>
                    {iframeSrc && iframeState !== 'failed' && (
                      <iframe
                        ref={iframeRef}
                        key={`${iframeSrc}#${iframeAttempt}`}
                        src={iframeSrc}
                        title={`Vista previa de ${pageName}`}
                        className={styles.previewFrame}
                        style={{
                          width: `${pantalla.w}px`,
                          height: `${pantalla.h}px`,
                          transform: `scale(${scale || 1})`,
                        }}
                        sandbox="allow-same-origin allow-scripts"
                        scrolling="no"
                        onLoad={handleIframeLoad}
                        onError={handleIframeError}
                      />
                    )}

                    {/* Capa de atenuación para que el calor resalte sobre la preview. */}
                    {showIframe && <div className={styles.previewScrim} aria-hidden="true" />}

                    {/* Calor y recuadros de los elementos FIJOS (barra de abajo,
                        cabecera, botones flotantes): viven en la ventana, que no
                        se mueve, igual que en el teléfono del visitante. */}
                    <canvas
                      ref={canvasFijoRef}
                      className={styles.canvas}
                      style={{
                        width: `${stageW}px`,
                        height: `${viewH}px`,
                        opacity: elegido ? Math.min(opacidadCalor, 0.4) : opacidadCalor,
                      }}
                      aria-hidden="true"
                    />
                    {marcas.filter((m) => m.fijo).map((m, i) => (
                      <div
                        key={`${elegido}-fijo-${i}`}
                        className={styles.marca}
                        style={{ left: `${m.x}px`, top: `${m.y}px`, width: `${m.w}px`, height: `${m.h}px` }}
                        aria-hidden="true"
                      >
                        <span className={styles.marcaNum}>{posElegido}</span>
                      </div>
                    ))}
                  </div>

                  {/* Canvas del heatmap sobre la página completa (no captura el puntero). */}
                  <canvas
                    ref={canvasRef}
                    className={styles.canvas}
                    style={{
                      width: `${stageW}px`,
                      height: `${stageH}px`,
                      // Con un elemento señalado, el calor se suaviza para leer el elemento.
                      opacity: elegido ? Math.min(opacidadCalor, 0.4) : opacidadCalor,
                    }}
                    aria-hidden="true"
                  />

                  {/* Recuadro(s) del elemento elegido en el ranking. */}
                  {marcas.filter((m) => !m.fijo).map((m, i) => (
                    <div
                      key={`${elegido}-${i}`}
                      className={styles.marca}
                      style={{ left: `${m.x}px`, top: `${m.y}px`, width: `${m.w}px`, height: `${m.h}px` }}
                      aria-hidden="true"
                    >
                      <span className={styles.marcaNum}>{posElegido}</span>
                    </div>
                  ))}
                </div>

                {/* Spinner mientras carga el iframe (con aviso de reintento). */}
                {showIframe && iframeState === 'loading' && (
                  <div className={styles.previewLoading}>
                    <span className={styles.spinner} aria-hidden="true" />
                    <span className={styles.previewLoadingText}>
                      {iframeAttempt > 0
                        ? `Reintentando vista previa (${iframeAttempt}/${IFRAME_MAX_RETRIES})…`
                        : 'Cargando vista previa…'}
                    </span>
                  </div>
                )}

                {/* FALLBACK elegante (glass + iniciales) cuando no hay preview. */}
                {!showIframe && (
                  <div className={styles.fallback}>
                    <span className={styles.fallbackBadge} aria-hidden="true">
                      {initialsOf(pageName)}
                    </span>
                    <span className={styles.fallbackName}>{pageName}</span>
                    <span className={styles.fallbackHint}>
                      {iframeSrc
                        ? 'No pudimos cargar la vista previa de esta página, pero el calor sigue siendo válido.'
                        : 'Esta página no tiene una vista previa navegable; mostramos el calor sobre una cuadrícula.'}
                    </span>
                    {iframeSrc && (
                      <button type="button" className={styles.fallbackRetry} onClick={handleRetry}>
                        Reintentar vista previa
                      </button>
                    )}
                  </div>
                )}

                {visiblePoints.length === 0 && (
                  <div className={styles.canvasEmpty}><T>Sin clics ubicables en esta página.</T></div>
                )}
              </div>

              <div className={styles.legendRow}>
                <span className={styles.previewTag}>
                  {showIframe
                    ? `Sobre la página real · ${exacta ? 'pantalla' : 'vista'} ${pantalla.label} · ${Math.round(scale * 100)}%`
                    : 'Vista de respaldo'}
                </span>
                <div className={styles.legend}>
                  <span className={styles.legendLabel}>Pocos clics</span>
                  <span className={styles.legendBar} aria-hidden="true" />
                  <span className={styles.legendLabel}>Lo más clicado</span>
                </div>
              </div>

              <div className={styles.canvasNotes}>
                <p>
                  El rojo marca la zona más clicada de esta página; el resto se compara con ella.
                  {hayScroll ? ' Desplázate dentro de la vista para recorrer toda la página.' : ''}
                </p>
                {sinUbicar > 0 && (
                  <p>
                    {sinUbicar.toLocaleString('es-PE')} de {visiblePoints.length.toLocaleString('es-PE')} clics no
                    se pueden ubicar en la página actual (fueron dentro de una ventana, su elemento no está a
                    la vista o son clics antiguos sin ubicación) y {mostrarSinUbicar ? 'se muestran en una posición aproximada.' : 'no se muestran.'}{' '}
                    <button
                      type="button"
                      className={styles.notaBoton}
                      onClick={() => setMostrarSinUbicar((v) => !v)}
                    >
                      {mostrarSinUbicar ? 'Ocultarlos' : 'Mostrarlos igual'}
                    </button>
                  </p>
                )}
              </div>
            </div>

            <div className={styles.sideCard}>
              <h3 className={styles.sideTitle}><T>Elementos más clicados</T></h3>
              {topElements.length === 0 ? (
                <p className={styles.sideEmpty}><T>Sin elementos registrados en esta página.</T></p>
              ) : (
                <>
                  <p className={styles.sideHint}>
                    Toca uno para verlo señalado en la página.
                    {hayZonas ? ' «Zona» es un clic fuera de un botón o enlace.' : ''}
                  </p>
                  <ul className={styles.rankList}>
                    {elementosVisibles.map((el, idx) => {
                      const pct = maxElementCount > 0 ? (el.count / maxElementCount) * 100 : 0;
                      const pctPagina = totalElementos > 0 ? Math.round((el.count / totalElementos) * 100) : 0;
                      const activo = el.key === elegido;
                      return (
                        <li key={el.key}>
                          <button
                            type="button"
                            className={`${styles.rankItem} ${activo ? styles.rankItemActive : ''}`}
                            aria-pressed={activo}
                            onClick={() => setElegido(activo ? null : el.key)}
                            title={`${el.tipo}: ${textoElemento(el)} · ${el.count} ${el.count === 1 ? 'clic' : 'clics'}`}
                          >
                            <span className={styles.rankPos}>{idx + 1}</span>
                            <span className={styles.rankBody}>
                              <span className={styles.rankTop}>
                                <span className={styles.tipoChip}>{el.tipo}</span>
                                <span className={`${styles.rankLabel} ${el.texto ? '' : styles.rankLabelGeneric}`}>
                                  {textoElemento(el)}
                                </span>
                              </span>
                              <span className={styles.rankTrack}>
                                <span className={styles.rankFill} style={{ width: `${pct}%` }} />
                              </span>
                              {clavesEnPagina && !clavesEnPagina.has(el.key) && (
                                <span
                                  className={motivoNoVisible(el).ventana ? styles.rankVentana : styles.rankAusente}
                                  title={motivoNoVisible(el).largo}
                                >
                                  {motivoNoVisible(el).corto}
                                </span>
                              )}
                            </span>
                            <span className={styles.rankCount}>
                              {el.count.toLocaleString('es-PE')}
                              <span className={styles.rankPct}>{pctPagina}%</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {topElements.length > ELEMENTOS_INICIALES && (
                    <button
                      type="button"
                      className={styles.verMas}
                      onClick={() => setVerTodosElementos((v) => !v)}
                    >
                      {verTodosElementos ? 'Ver menos' : `Ver los ${topElements.length}`}
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </motion.section>
  );
}
