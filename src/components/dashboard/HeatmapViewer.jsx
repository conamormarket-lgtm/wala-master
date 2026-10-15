import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getHeatmapByPage } from '../../services/heatmapData';
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
 * Dibuja el heatmap en el canvas a la resolución indicada (w x h en px reales).
 * `points` ya vienen en px del lienzo: [{ cx, cy }].
 *  1) Pinta cada clic como un gradiente radial en escala de grises (alpha acumulada).
 *  2) Recolorea según la intensidad acumulada (rampa azul -> verde -> amarillo -> rojo).
 */
function drawHeatmap(canvas, points, w, h) {
  if (!canvas) return;
  const width = Math.max(1, Math.round(w));
  const height = Math.max(1, Math.round(h));

  // Ajustar el tamaño interno del canvas solo si cambió (evita reflows).
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  // willReadFrequently: true porque hacemos getImageData en cada redibujado
  // (recoloreado del heatmap). Evita el warning de rendimiento de Canvas2D.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);
  if (!points || points.length === 0) return;

  const radius = Math.max(14, Math.round(width * BLOB_RADIUS_RATIO));

  // Paso 1: acumulación de densidad en escala de grises.
  ctx.globalCompositeOperation = 'source-over';
  points.forEach(({ cx, cy }) => {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, 'rgba(0,0,0,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Paso 2: recolorear según intensidad acumulada (canal alpha).
  let image;
  try {
    image = ctx.getImageData(0, 0, width, height);
  } catch (e) {
    return; // Por seguridad (canvas "tainted"); no debería ocurrir aquí.
  }
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;
    const t = Math.min(1, alpha / 255);
    const [r, g, b, a] = ramp(t);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  ctx.putImageData(image, 0, 0);
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
  // Para el iframe usamos la ruta tal cual (relativa al mismo origen = wala.pe).
  const iframeSrc = selectedPath && selectedPath !== 'unknown' ? selectedPath : null;

  // Reinicia el estado del iframe cada vez que cambia la página seleccionada.
  useEffect(() => {
    if (iframeTimerRef.current) {
      clearTimeout(iframeTimerRef.current);
      iframeTimerRef.current = null;
    }
    retriesRef.current = 0;
    setPageHeight(0);
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
  const pantalla = PANTALLAS_PREVIEW[anchoPreview];
  const mezclaAnchos = ancho === 'todos' && points.some((p) => p.ancho && p.ancho !== anchoPreview);

  // Escala de la pantalla tipo al panel (nunca agranda) y alto de la página.
  // Sin alto real (respaldo o mientras carga) se estima con los clics viejos
  // más profundos, medidos en pantallas.
  const scale = frameW > 0 ? Math.min(1, frameW / pantalla.w, PREVIEW_MAX_H / pantalla.h) : 0;
  const pantallasEstimadas = points.reduce(
    (m, p) => (p.yFrac == null ? Math.max(m, p.yScreens) : m),
    1
  );
  const docH = pageHeight > 0
    ? Math.max(pageHeight, pantalla.h)
    : Math.round(pantalla.h * Math.min(pantallasEstimadas, FALLBACK_MAX_SCREENS));
  const stageW = pantalla.w * scale;
  const stageH = docH * scale;
  const viewH = pantalla.h * scale;

  // Clics en px del lienzo: los nuevos por su fracción del alto de la página;
  // los viejos (sin pageHeight) por pantallas bajadas, de forma aproximada.
  const pixelPoints = useMemo(
    () => points.map((p) => ({
      cx: p.xNorm * stageW,
      cy: (p.yFrac != null ? p.yFrac * docH : Math.min(p.yScreens * pantalla.h, docH)) * scale,
    })),
    [points, stageW, docH, pantalla.h, scale]
  );
  const clicsAproximados = useMemo(() => points.filter((p) => p.yFrac == null).length, [points]);

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

  // (Re)dibuja el heatmap sobre la página completa.
  useEffect(() => {
    if (stageW <= 0 || stageH <= 0) return;
    drawHeatmap(canvasRef.current, pixelPoints, stageW, stageH);
  }, [pixelPoints, stageW, stageH]);

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

  const handleIframeLoad = () => {
    // 'load' dispara tanto en éxito como en about:blank; si hay src, lo damos por
    // bueno (el navegador no expone errores cross-doc por seguridad).
    if (iframeSrc) {
      if (iframeTimerRef.current) {
        clearTimeout(iframeTimerRef.current);
        iframeTimerRef.current = null;
      }
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
    setPageHeight(0);
    setIframeState('loading');
    setIframeAttempt((n) => n + 1);
  };

  const maxElementCount = topElements.length > 0 ? topElements[0].count : 0;
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
                  <span className={styles.pageCardRoute}>{path}</span>
                </motion.button>
              );
            })}
          </motion.div>

          <motion.div className={styles.grid} variants={itemVariants}>
            <div className={styles.canvasCard}>
              <div className={styles.canvasHead}>
                <span className={styles.canvasPath} title={selectedPath}>
                  {pageName}
                  <span className={styles.canvasRoute}>{selectedPath}</span>
                </span>
                <Badge tone={showIframe ? 'success' : 'neutral'} size="sm">
                  {points.length.toLocaleString('es-PE')} clics
                </Badge>
              </div>

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
                  </div>

                  {/* Canvas del heatmap sobre la página completa (no captura el puntero). */}
                  <canvas
                    ref={canvasRef}
                    className={styles.canvas}
                    style={{ width: `${stageW}px`, height: `${stageH}px` }}
                    aria-hidden="true"
                  />
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

                {points.length === 0 && (
                  <div className={styles.canvasEmpty}><T>Sin clics ubicables en esta página.</T></div>
                )}
              </div>

              <div className={styles.legendRow}>
                <span className={styles.previewTag}>
                  {showIframe ? `Sobre la página real · vista ${pantalla.label}` : 'Vista de respaldo'}
                </span>
                <div className={styles.legend}>
                  <span className={styles.legendLabel}>Menos</span>
                  <span className={styles.legendBar} aria-hidden="true" />
                  <span className={styles.legendLabel}>Más</span>
                </div>
              </div>

              {(hayScroll || mezclaAnchos || clicsAproximados > 0) && (
                <div className={styles.canvasNotes}>
                  {hayScroll && <p>Desplázate dentro de la vista para recorrer toda la página.</p>}
                  {mezclaAnchos && (
                    <p>
                      Hay clics de varios anchos de pantalla sobre la vista {pantalla.label}: elige un
                      ancho arriba para verlos en su sitio exacto.
                    </p>
                  )}
                  {clicsAproximados > 0 && (
                    <p>
                      {clicsAproximados.toLocaleString('es-PE')} clics son anteriores al 15/10/2026 y no
                      guardaron el alto de la página: su altura es aproximada.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className={styles.sideCard}>
              <h3 className={styles.sideTitle}><T>Elementos más clicados</T></h3>
              {topElements.length === 0 ? (
                <p className={styles.sideEmpty}><T>Sin elementos registrados en esta página.</T></p>
              ) : (
                <ul className={styles.rankList}>
                  {topElements.map((el, idx) => {
                    const pct = maxElementCount > 0 ? (el.count / maxElementCount) * 100 : 0;
                    return (
                      <motion.li
                        key={`${el.label}-${idx}`}
                        className={styles.rankItem}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.03 * idx, duration: 0.3 }}
                      >
                        <span className={styles.rankPos}>{idx + 1}</span>
                        <div className={styles.rankBody}>
                          <span
                            className={`${styles.rankLabel} ${el.generic ? styles.rankLabelGeneric : ''}`}
                            title={el.label}
                          >
                            {el.label}
                          </span>
                          <span className={styles.rankTrack}>
                            <span className={styles.rankFill} style={{ width: `${pct}%` }} />
                          </span>
                        </div>
                        <span className={styles.rankCount}>{el.count}</span>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </motion.section>
  );
}
