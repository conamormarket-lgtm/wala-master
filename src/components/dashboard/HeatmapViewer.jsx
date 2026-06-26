import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getHeatmapByPage } from '../../services/heatmapData';
import styles from './HeatmapViewer.module.css';

/**
 * VISOR DE MAPA DE CALOR (HeatmapViewer)
 *
 * Lee los clics agregados desde services/heatmapData.getHeatmapByPage(), permite
 * elegir una página (los paths con más clics) y dibuja, sobre un <canvas> nativo,
 * "blobs" radiales por densidad de clics (rojo -> amarillo -> transparente).
 *
 * Panel lateral con el ranking de elementos más clicados de la página seleccionada.
 * Estética liquid-glass, entrada con framer-motion. Sin props requeridas.
 */

// Proporción del lienzo del heatmap (16:10, similar a un viewport de escritorio).
const CANVAS_W = 960;
const CANVAS_H = 600;
// Radio del blob de cada clic, en px del canvas.
const BLOB_RADIUS = 42;

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

function prettyPath(path) {
  if (!path || path === 'unknown') return 'Desconocida';
  return path;
}

/**
 * Dibuja el heatmap en el canvas:
 *  1) Pinta cada clic como un gradiente radial en escala de grises (alpha acumulada).
 *  2) Recorre los píxeles y mapea la intensidad acumulada a una rampa de color
 *     (transparente -> azul tenue -> verde -> amarillo -> rojo).
 */
function drawHeatmap(canvas, points) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  if (!points || points.length === 0) return;

  // Paso 1: acumulación de densidad en escala de grises.
  ctx.globalCompositeOperation = 'source-over';
  points.forEach((p) => {
    const cx = p.xNorm * CANVAS_W;
    const cy = p.yNorm * CANVAS_H;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, BLOB_RADIUS);
    // Alpha baja por clic para que la superposición construya densidad.
    grad.addColorStop(0, 'rgba(0,0,0,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, BLOB_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  });

  // Paso 2: recolorear según intensidad acumulada (canal alpha).
  const image = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
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
  // Tramos: 0 transparente -> 0.25 azul -> 0.5 verde -> 0.75 amarillo -> 1 rojo
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
  const [data, setData] = useState({ paths: [], pointsByPath: {}, topElementsByPath: {}, totalClicks: 0, totalDocs: 0 });
  const [selectedPath, setSelectedPath] = useState(null);
  const canvasRef = useRef(null);

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

  useEffect(() => {
    drawHeatmap(canvasRef.current, points);
  }, [points]);

  const hasData = !loading && !error && data.totalClicks > 0;
  const maxElementCount = topElements.length > 0 ? topElements[0].count : 0;

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
              const count = (data.pointsByPath[path] || []).length;
              const active = path === selectedPath;
              return (
                <button
                  key={path}
                  type="button"
                  className={`${styles.pathChip} ${active ? styles.pathChipActive : ''}`}
                  onClick={() => setSelectedPath(path)}
                  title={prettyPath(path)}
                >
                  <span className={styles.pathChipLabel}>{prettyPath(path)}</span>
                  <span className={styles.pathChipCount}>{count}</span>
                </button>
              );
            })}
          </motion.div>

          <motion.div className={styles.grid} variants={itemVariants}>
            <div className={styles.canvasCard}>
              <div className={styles.canvasHead}>
                <span className={styles.canvasPath}>{prettyPath(selectedPath)}</span>
                <span className={styles.canvasCount}>{points.length} clics</span>
              </div>
              <div className={styles.canvasFrame}>
                <canvas
                  ref={canvasRef}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  className={styles.canvas}
                />
                {points.length === 0 && (
                  <div className={styles.canvasEmpty}>Sin clics ubicables en esta página.</div>
                )}
              </div>
              <div className={styles.legend}>
                <span className={styles.legendLabel}>Menos</span>
                <span className={styles.legendBar} aria-hidden="true" />
                <span className={styles.legendLabel}>Más</span>
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
                        key={`${el.elementInfo}-${idx}`}
                        className={styles.rankItem}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.03 * idx, duration: 0.3 }}
                      >
                        <span className={styles.rankPos}>{idx + 1}</span>
                        <div className={styles.rankBody}>
                          <span className={styles.rankLabel} title={el.elementInfo}>
                            {el.elementInfo}
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
