import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getHeatmapByPage } from '../../services/heatmapData';
import styles from './HeatmapViewer.module.css';

/**
 * VISOR DE MAPA DE CALOR (HeatmapViewer)
 *
 * Lee los clics agregados desde services/heatmapData.getHeatmapByPage(), permite
 * elegir una página (chips con NOMBRE legible + ruta + nº de clics) y muestra una
 * PREVIEW real de la página dentro de un <iframe src={path}> (misma-origen, wala.pe)
 * con el canvas del heatmap superpuesto encima (puntos escalados al tamaño del
 * iframe). Si el iframe falla o no carga, hace FALLBACK a un canvas sobre una
 * cuadrícula neutra.
 *
 * Panel lateral con el ranking de elementos más clicados (etiquetas legibles).
 * Estética liquid-glass, entrada con framer-motion. Sin props requeridas.
 */

// Proporción del lienzo de respaldo (16:10, similar a un viewport de escritorio).
const FALLBACK_W = 960;
const FALLBACK_H = 600;
// Radio base del blob de cada clic, como fracción del ancho del lienzo.
const BLOB_RADIUS_RATIO = 0.044;
// Tiempo máximo de espera a que el iframe cargue antes de asumir fallo.
const IFRAME_TIMEOUT_MS = 6000;

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

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);
  if (!points || points.length === 0) return;

  const radius = Math.max(14, Math.round(width * BLOB_RADIUS_RATIO));

  // Paso 1: acumulación de densidad en escala de grises.
  ctx.globalCompositeOperation = 'source-over';
  points.forEach((p) => {
    const cx = p.xNorm * width;
    const cy = p.yNorm * height;
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

export default function HeatmapViewer() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    paths: [],
    pageNames: {},
    pointsByPath: {},
    clicksByPath: {},
    topElementsByPath: {},
    totalClicks: 0,
    totalDocs: 0,
  });
  const [selectedPath, setSelectedPath] = useState(null);
  // Estado de la preview con iframe: 'loading' | 'ready' | 'failed'
  const [iframeState, setIframeState] = useState('loading');

  const canvasRef = useRef(null);
  const frameRef = useRef(null); // contenedor que define el tamaño de overlay
  const iframeTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const result = await getHeatmapByPage();
        if (!mounted) return;
        setData(result);
        setError(result.error || null);
        setSelectedPath(result.paths?.[0] || null);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || 'Error cargando el mapa de calor');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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
    if (!iframeSrc) {
      setIframeState('failed'); // sin ruta navegable -> fallback al canvas/grid
      return undefined;
    }
    setIframeState('loading');
    iframeTimerRef.current = setTimeout(() => {
      setIframeState((s) => (s === 'ready' ? s : 'failed'));
    }, IFRAME_TIMEOUT_MS);
    return () => {
      if (iframeTimerRef.current) {
        clearTimeout(iframeTimerRef.current);
        iframeTimerRef.current = null;
      }
    };
  }, [iframeSrc]);

  // (Re)dibuja el overlay del heatmap ajustado al tamaño REAL del contenedor.
  useEffect(() => {
    const redraw = () => {
      const frame = frameRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      let w = FALLBACK_W;
      let h = FALLBACK_H;
      if (frame) {
        const rect = frame.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          w = rect.width;
          h = rect.height;
        }
      }
      drawHeatmap(canvas, points, w, h);
    };

    redraw();

    // Redibuja al redimensionar el contenedor (responsive / cambio de layout).
    let ro;
    if (typeof ResizeObserver !== 'undefined' && frameRef.current) {
      ro = new ResizeObserver(() => redraw());
      ro.observe(frameRef.current);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', redraw);
    }
    return () => {
      if (ro) ro.disconnect();
      else if (typeof window !== 'undefined') window.removeEventListener('resize', redraw);
    };
  }, [points, iframeState]);

  const handleIframeLoad = () => {
    // 'load' dispara tanto en éxito como en about:blank; si hay src, lo damos por
    // bueno (el navegador no expone errores cross-doc por seguridad).
    if (iframeSrc) setIframeState('ready');
  };

  const handleIframeError = () => setIframeState('failed');

  const hasData = !loading && !error && data.totalClicks > 0;
  const maxElementCount = topElements.length > 0 ? topElements[0].count : 0;
  const showIframe = iframeState !== 'failed' && !!iframeSrc;

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
          <h2 className={styles.title}>Mapa de calor</h2>
          <p className={styles.subtitle}>
            Dónde hacen clic tus visitantes, página por página.
          </p>
        </div>
        {hasData && (
          <div className={styles.statsPill}>
            <span className={styles.statValue}>{data.totalClicks.toLocaleString('es-PE')}</span>
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
          Aún sin datos de heatmap. En cuanto tus visitantes empiecen a interactuar,
          verás aquí dónde hacen clic.
        </motion.div>
      )}

      {hasData && (
        <>
          <motion.div className={styles.pathSelector} variants={itemVariants}>
            {data.paths.map((path) => {
              const count = data.clicksByPath?.[path] ?? (data.pointsByPath[path] || []).length;
              const name = data.pageNames?.[path] || path;
              const active = path === selectedPath;
              return (
                <button
                  key={path}
                  type="button"
                  className={`${styles.pathChip} ${active ? styles.pathChipActive : ''}`}
                  onClick={() => setSelectedPath(path)}
                  title={`${name} — ${path}`}
                >
                  <span className={styles.pathChipMeta}>
                    <span className={styles.pathChipName}>{name}</span>
                    <span className={styles.pathChipRoute}>{path}</span>
                  </span>
                  <span className={styles.pathChipCount}>{count}</span>
                </button>
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
                <span className={styles.canvasCount}>{points.length} clics</span>
              </div>

              <div
                ref={frameRef}
                className={`${styles.canvasFrame} ${showIframe ? styles.canvasFrameLive : ''}`}
              >
                {/* PREVIEW real de la página (misma-origen wala.pe). */}
                {iframeSrc && iframeState !== 'failed' && (
                  <iframe
                    key={iframeSrc}
                    src={iframeSrc}
                    title={`Vista previa de ${pageName}`}
                    className={styles.previewFrame}
                    loading="lazy"
                    sandbox="allow-same-origin allow-scripts"
                    scrolling="no"
                    onLoad={handleIframeLoad}
                    onError={handleIframeError}
                  />
                )}

                {/* Capa de atenuación para que el calor resalte sobre la preview. */}
                {showIframe && <div className={styles.previewScrim} aria-hidden="true" />}

                {/* Canvas del heatmap superpuesto (no captura el puntero). */}
                <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

                {/* Spinner mientras carga el iframe. */}
                {showIframe && iframeState === 'loading' && (
                  <div className={styles.previewLoading}>
                    <span className={styles.spinner} aria-hidden="true" />
                  </div>
                )}

                {points.length === 0 && (
                  <div className={styles.canvasEmpty}>Sin clics ubicables en esta página.</div>
                )}
              </div>

              <div className={styles.legendRow}>
                <span className={styles.previewTag}>
                  {showIframe ? 'Sobre la página real' : 'Vista de cuadrícula'}
                </span>
                <div className={styles.legend}>
                  <span className={styles.legendLabel}>Menos</span>
                  <span className={styles.legendBar} aria-hidden="true" />
                  <span className={styles.legendLabel}>Más</span>
                </div>
              </div>
            </div>

            <div className={styles.sideCard}>
              <h3 className={styles.sideTitle}>Elementos más clicados</h3>
              {topElements.length === 0 ? (
                <p className={styles.sideEmpty}>Sin elementos registrados en esta página.</p>
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
