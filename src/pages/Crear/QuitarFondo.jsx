import React, { useEffect, useRef, useState } from 'react';
import {
  Wand2, Eraser, Brush, Hand, Undo2, Sparkles, Loader2, ZoomIn, ZoomOut, Scan,
} from 'lucide-react';
import { cargarImagen } from '../../utils/prendaBase';
import { bordesVisibles, recortarImagen } from '../../services/crearArchivos';
import {
  TOLERANCIA_INICIAL, fondoAutomatico, analizarBorde, reconstruir, aplicarOperacion, pintarTrazo, componer, quedaAlgo,
} from './fondoPixeles';
import estilos from './RecorteImagen.module.css';
import styles from './QuitarFondo.module.css';

// Vista previa (con detalle para el zoom); al aplicar se repite todo a
// tamaño de impresión.
const LADO_PREVIA = 2000;
// Tope del resultado: más que esto no mejora la impresión y pesa demasiado
// en el celular (35 cm a 300 dpi son ~4100 px).
const LADO_FINAL = 4000;
const TAMANO_INICIAL = 30;
// Tamaño del pincel (1–100) → radio relativo al lado mayor, sin zoom.
const radioDe = (tamano) => 0.004 + (tamano / 100) * 0.06;
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const PASO_ZOOM = 1.25;

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

const MODOS = [
  { id: 'varita', icono: Wand2, nombre: 'Varita', tecla: 'V' },
  { id: 'borrar', icono: Eraser, nombre: 'Borrador', tecla: 'B' },
  { id: 'restaurar', icono: Brush, nombre: 'Restaurar', tecla: 'R' },
  { id: 'mover', icono: Hand, nombre: 'Mover', tecla: 'H' },
];

// Fondo detrás de la imagen: con cuadros no se ve lo blanco, con oscuro sí.
const FONDOS_VISTA = [
  { id: 'cuadros', nombre: 'Cuadros' },
  { id: 'oscuro', nombre: 'Oscuro' },
  { id: 'claro', nombre: 'Claro' },
];

/** Píxeles de una imagen a un lado máximo dado: { d, w, h }. */
const leerPixeles = (fuente, ladoMax) => {
  const W = fuente.naturalWidth || fuente.width;
  const H = fuente.naturalHeight || fuente.height;
  const k = Math.min(1, ladoMax / Math.max(W, H));
  const w = Math.max(1, Math.round(W * k));
  const h = Math.max(1, Math.round(H * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(fuente, 0, 0, w, h);
  return { d: ctx.getImageData(0, 0, w, h).data, w, h, canvas, ctx };
};

/**
 * Borrador de fondo de una imagen del diseño. Si el borde es de un color
 * parejo (un logo sobre blanco), el fondo se quita apenas se abre. Después:
 * la varita borra la zona del color que se toca, el borrador y restaurar
 * retocan a mano. Con zoom (rueda, botones o dos dedos) se llega a los
 * detalles: el pincel mide lo mismo en pantalla, así que al acercar es más
 * fino. Devuelve la imagen sin fondo, ya sin bordes vacíos.
 *
 * onAplicar({ blob, ancho, alto, corte, factor }): `corte` es lo que quedó,
 * en píxeles de la imagen original, y `factor` cuántos píxeles del
 * resultado hay por píxel original (menos de 1 si se redujo).
 */
const QuitarFondo = ({ src, onCancelar, onAplicar }) => {
  const visorRef = useRef(null);
  const lienzoRef = useRef(null);
  const previaRef = useRef(null);
  const mascaraRef = useRef(null);
  const opsRef = useRef([]);
  const trazoRef = useRef(null);
  const cuadroRef = useRef(0);
  const punterosRef = useRef(new Map());
  const gestoRef = useRef(null);
  const espacioRef = useRef(false);
  const [fuente, setFuente] = useState(null);
  const [modo, setModo] = useState('varita');
  const [tolerancia, setTolerancia] = useState(TOLERANCIA_INICIAL);
  const [tamano, setTamano] = useState(TAMANO_INICIAL);
  const [, setCambios] = useState(0);
  const [aviso, setAviso] = useState('');
  const [aplicando, setAplicando] = useState(false);
  // Vista: zoom, desplazamiento (px desde el centro del visor) y escala que
  // hace entrar la imagen entera en el visor.
  const [zoom, setZoom] = useState(1);
  const [desplazo, setDesplazo] = useState({ x: 0, y: 0 });
  const [ajuste, setAjuste] = useState(0);
  const [fondoVista, setFondoVista] = useState('cuadros');
  const [cursor, setCursor] = useState(null);
  const [moviendo, setMoviendo] = useState(false);
  const [espacio, setEspacio] = useState(false);
  const vistaRef = useRef({ zoom: 1, desplazo: { x: 0, y: 0 }, ajuste: 0 });
  vistaRef.current = { zoom, desplazo, ajuste };

  const dibujar = () => {
    cancelAnimationFrame(cuadroRef.current);
    cuadroRef.current = requestAnimationFrame(() => {
      const previa = previaRef.current;
      const lienzo = lienzoRef.current;
      if (!previa || !lienzo) return;
      const ctx = lienzo.getContext('2d');
      ctx.putImageData(componer(previa, mascaraRef.current, ctx.createImageData(previa.w, previa.h)), 0, 0);
    });
  };

  const rehacer = () => {
    mascaraRef.current = reconstruir(previaRef.current, opsRef.current);
    setCambios((n) => n + 1);
    dibujar();
  };

  const agregar = (op) => {
    opsRef.current = [...opsRef.current, op];
    aplicarOperacion(previaRef.current, mascaraRef.current, op);
    setCambios((n) => n + 1);
    dibujar();
  };

  useEffect(() => {
    let vigente = true;
    cargarImagen(src)
      .then((img) => {
        if (!vigente) return;
        const previa = leerPixeles(img, LADO_PREVIA);
        previaRef.current = previa;
        mascaraRef.current = new Uint8Array(previa.w * previa.h).fill(255);
        setFuente(img);
        const auto = fondoAutomatico(previa);
        if (auto) {
          opsRef.current = [auto];
          aplicarOperacion(previa, mascaraRef.current, auto);
          setAviso('Quitamos el fondo automáticamente. Si borró de más, toca Deshacer.');
        } else if (analizarBorde(previa).transparente > 0.5) {
          setAviso('Esta imagen ya no tiene fondo. Puedes retocarla con el borrador.');
        } else {
          setAviso('Toca el fondo con la varita para borrarlo.');
        }
      })
      .catch(() => vigente && setAviso('No pudimos abrir la imagen.'));
    return () => {
      vigente = false;
      cancelAnimationFrame(cuadroRef.current);
    };
  }, [src]);

  // El lienzo aparece después de cargar: se pinta en cuanto existe.
  useEffect(() => {
    if (!fuente || !lienzoRef.current) return;
    lienzoRef.current.width = previaRef.current.w;
    lienzoRef.current.height = previaRef.current.h;
    dibujar();
  }, [fuente]);

  // La imagen entra entera en el visor (y se recalcula si cambia de tamaño).
  useEffect(() => {
    const visor = visorRef.current;
    if (!fuente || !visor) return undefined;
    const medir = () => {
      const previa = previaRef.current;
      if (!previa) return;
      setAjuste(Math.min(visor.clientWidth / previa.w, visor.clientHeight / previa.h) * 0.96);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(visor);
    return () => ro.disconnect();
  }, [fuente]);

  // ── Zoom y desplazamiento ────────────────────────────────────────────────
  /** Que la imagen no se vaya del visor: se puede mover hasta su borde. */
  const limitarDesplazo = (d, z) => {
    const previa = previaRef.current;
    const k = vistaRef.current.ajuste;
    if (!previa || z <= 1) return { x: 0, y: 0 };
    const mx = (previa.w * k * z) / 2;
    const my = (previa.h * k * z) / 2;
    return { x: limitar(d.x, -mx, mx), y: limitar(d.y, -my, my) };
  };

  const fijarVista = (z, d) => {
    const desplazoNuevo = limitarDesplazo(d, z);
    vistaRef.current = { ...vistaRef.current, zoom: z, desplazo: desplazoNuevo };
    setZoom(z);
    setDesplazo(desplazoNuevo);
  };

  /** Posición del puntero respecto del centro del visor. */
  const desdeCentro = (x, y) => {
    const r = visorRef.current.getBoundingClientRect();
    return { x: x - (r.left + r.width / 2), y: y - (r.top + r.height / 2) };
  };

  /** Cambia el zoom dejando quieto el punto `s` (por defecto, el centro). */
  const zoomEn = (zNuevo, s = { x: 0, y: 0 }) => {
    const { zoom: z1, desplazo: d1 } = vistaRef.current;
    const z = limitar(zNuevo, ZOOM_MIN, ZOOM_MAX);
    fijarVista(z, { x: s.x - (s.x - d1.x) * (z / z1), y: s.y - (s.y - d1.y) * (z / z1) });
  };

  const ajustarVista = () => fijarVista(1, { x: 0, y: 0 });

  // Rueda: acercar hacia donde apunta el mouse (también el pellizco del
  // trackpad, que llega como rueda con Ctrl). Necesita passive: false.
  useEffect(() => {
    const visor = visorRef.current;
    if (!fuente || !visor) return undefined;
    const alRodar = (e) => {
      e.preventDefault();
      zoomEn(vistaRef.current.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), desdeCentro(e.clientX, e.clientY));
    };
    visor.addEventListener('wheel', alRodar, { passive: false });
    return () => visor.removeEventListener('wheel', alRodar);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente]);

  // ── Pintar, mover y pellizcar ───────────────────────────────────────────
  /** Punto de la imagen (0–1) bajo el puntero, o null si cae afuera. */
  const puntoDe = (e, { soloDentro = false } = {}) => {
    const caja = lienzoRef.current.getBoundingClientRect();
    const x = (e.clientX - caja.left) / caja.width;
    const y = (e.clientY - caja.top) / caja.height;
    if (soloDentro && (x < 0 || y < 0 || x > 1 || y > 1)) return null;
    return { x: limitar(x, 0, 1), y: limitar(y, 0, 1) };
  };

  /** Un trazo a medio hacer se descarta (al empezar a pellizcar con dos dedos). */
  const descartarTrazo = () => {
    if (!trazoRef.current) return;
    trazoRef.current = null;
    rehacer();
  };

  const alPresionar = (e) => {
    if (!previaRef.current || aplicando) return;
    punterosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { visorRef.current.setPointerCapture?.(e.pointerId); } catch { /* sin captura */ }

    if (punterosRef.current.size === 2) {
      descartarTrazo();
      const [a, b] = [...punterosRef.current.values()];
      gestoRef.current = {
        tipo: 'pinza',
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        z0: vistaRef.current.zoom,
        off0: vistaRef.current.desplazo,
        mid0: desdeCentro((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
      return;
    }

    // Mover: herramienta Mano, barra espaciadora o botón central del mouse.
    if (modo === 'mover' || espacioRef.current || e.button === 1) {
      e.preventDefault();
      gestoRef.current = { tipo: 'mover', x0: e.clientX, y0: e.clientY, off0: vistaRef.current.desplazo };
      setMoviendo(true);
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const p = puntoDe(e, { soloDentro: true });
    if (!p) return;
    if (modo === 'varita') {
      agregar({ t: 'varita', x: p.x, y: p.y, tol: tolerancia });
      setAviso('');
      return;
    }
    // El pincel mide lo mismo en pantalla: con zoom, es más fino en la imagen.
    trazoRef.current = { t: 'trazo', modo, r: radioDe(tamano) / vistaRef.current.zoom, puntos: [p] };
    pintarTrazo(previaRef.current, mascaraRef.current, trazoRef.current, 0);
    dibujar();
  };

  const alMover = (e) => {
    if (e.pointerType === 'mouse') {
      const r = visorRef.current.getBoundingClientRect();
      setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
    }
    if (punterosRef.current.has(e.pointerId)) punterosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const gesto = gestoRef.current;
    if (gesto?.tipo === 'pinza' && punterosRef.current.size >= 2) {
      const [a, b] = [...punterosRef.current.values()];
      const z = limitar(gesto.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / gesto.d0), ZOOM_MIN, ZOOM_MAX);
      const mid = desdeCentro((a.x + b.x) / 2, (a.y + b.y) / 2);
      // El punto de la imagen que estaba bajo los dedos sigue bajo los dedos.
      const px = (gesto.mid0.x - gesto.off0.x) / gesto.z0;
      const py = (gesto.mid0.y - gesto.off0.y) / gesto.z0;
      fijarVista(z, { x: mid.x - px * z, y: mid.y - py * z });
      return;
    }
    if (gesto?.tipo === 'mover') {
      fijarVista(vistaRef.current.zoom, { x: gesto.off0.x + e.clientX - gesto.x0, y: gesto.off0.y + e.clientY - gesto.y0 });
      return;
    }
    const trazo = trazoRef.current;
    if (!trazo) return;
    trazo.puntos.push(puntoDe(e));
    pintarTrazo(previaRef.current, mascaraRef.current, trazo, trazo.puntos.length - 1);
    dibujar();
  };

  const alSoltar = (e) => {
    punterosRef.current.delete(e.pointerId);
    const gesto = gestoRef.current;
    if (gesto) {
      if (gesto.tipo === 'mover' || punterosRef.current.size < 2) {
        gestoRef.current = null;
        setMoviendo(false);
      }
      return;
    }
    const trazo = trazoRef.current;
    if (!trazo) return;
    trazoRef.current = null;
    opsRef.current = [...opsRef.current, trazo];
    setCambios((n) => n + 1);
    setAviso('');
  };

  /** La tolerancia ajusta el último relleno (varita o fondo) en vivo. */
  const cambiarTolerancia = (valor) => {
    setTolerancia(valor);
    const ops = opsRef.current;
    const ultima = ops[ops.length - 1];
    if (ultima && (ultima.t === 'varita' || ultima.t === 'fondo')) {
      opsRef.current = [...ops.slice(0, -1), { ...ultima, tol: valor }];
      rehacer();
    }
  };

  const quitarFondoAuto = () => {
    const { color } = analizarBorde(previaRef.current);
    if (!color) {
      setAviso('Esta imagen ya no tiene fondo.');
      return;
    }
    agregar({ t: 'fondo', color, tol: tolerancia });
    setAviso('');
  };

  const deshacer = () => {
    opsRef.current = opsRef.current.slice(0, -1);
    rehacer();
  };

  const restablecer = () => {
    opsRef.current = [];
    setAviso('');
    rehacer();
  };

  const aplicar = async () => {
    if (!fuente) return;
    if (!opsRef.current.length) {
      onAplicar(null);
      return;
    }
    if (!quedaAlgo(previaRef.current, mascaraRef.current)) {
      setAviso('Borraste toda la imagen. Toca Deshacer o Restaurar.');
      return;
    }
    setAplicando(true);
    // Deja pintar el "Aplicando…" antes del trabajo pesado.
    await new Promise((r) => setTimeout(r, 30));
    try {
      const final = leerPixeles(fuente, LADO_FINAL);
      const mascara = reconstruir(final, opsRef.current);
      final.ctx.putImageData(componer(final, mascara, final.ctx.createImageData(final.w, final.h)), 0, 0);
      const W = fuente.naturalWidth || fuente.width;
      const factor = final.w / W;
      // Sin los bordes que quedaron vacíos: la imagen ocupa solo lo que se ve.
      const caja = bordesVisibles(final.canvas) || { x: 0, y: 0, w: final.w, h: final.h };
      const { blob, ancho, alto } = await recortarImagen(final.canvas, caja);
      onAplicar({
        blob, ancho, alto, factor,
        corte: { x: caja.x / factor, y: caja.y / factor, w: caja.w / factor, h: caja.h / factor },
      });
    } catch {
      setAplicando(false);
      setAviso('No pudimos procesar la imagen. Prueba con una más liviana.');
    }
  };

  // Teclado: V/B/R/H cambian de herramienta, [ ] el tamaño del pincel,
  // + − 0 el zoom, la barra espaciadora (mantenida) mueve la vista,
  // Ctrl+Z deshace, Enter aplica y Esc cancela.
  const teclasRef = useRef(null);
  teclasRef.current = (e) => {
    if (aplicando || e.isComposing) return;
    const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if ((e.ctrlKey || e.metaKey) && tecla === 'z') { e.preventDefault(); if (opsRef.current.length) deshacer(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (tecla === ' ') {
      e.preventDefault();
      espacioRef.current = true;
      setEspacio(true);
      return;
    }
    if (tecla === 'Escape') { e.preventDefault(); onCancelar(); }
    else if (tecla === 'Enter') { e.preventDefault(); aplicar(); }
    else if (tecla === 'v') setModo('varita');
    else if (tecla === 'b') setModo('borrar');
    else if (tecla === 'r') setModo('restaurar');
    else if (tecla === 'h') setModo('mover');
    else if (tecla === '[') setTamano((t) => Math.max(1, t - 5));
    else if (tecla === ']') setTamano((t) => Math.min(100, t + 5));
    else if (tecla === '+' || tecla === '=') { e.preventDefault(); zoomEn(vistaRef.current.zoom * PASO_ZOOM); }
    else if (tecla === '-' || tecla === '_') { e.preventDefault(); zoomEn(vistaRef.current.zoom / PASO_ZOOM); }
    else if (tecla === '0') { e.preventDefault(); ajustarVista(); }
  };
  useEffect(() => {
    const alTeclear = (e) => teclasRef.current?.(e);
    const alSoltarTecla = (e) => {
      if (e.key !== ' ') return;
      e.preventDefault();
      espacioRef.current = false;
      setEspacio(false);
    };
    window.addEventListener('keydown', alTeclear);
    window.addEventListener('keyup', alSoltarTecla);
    return () => {
      window.removeEventListener('keydown', alTeclear);
      window.removeEventListener('keyup', alSoltarTecla);
    };
  }, []);

  const hayOps = opsRef.current.length > 0;
  const ultima = opsRef.current[opsRef.current.length - 1];
  const ajustaRelleno = ultima && (ultima.t === 'varita' || ultima.t === 'fondo');
  const previa = previaRef.current;
  const aMano = modo === 'mover' || espacio;
  const conPincel = !aMano && (modo === 'borrar' || modo === 'restaurar');
  const diametroPincel = previa ? 2 * radioDe(tamano) * Math.max(previa.w, previa.h) * ajuste : 0;
  const claseCursor = aMano
    ? (moviendo ? styles.cursorMoviendo : styles.cursorMano)
    : conPincel && cursor ? styles.cursorOculto : modo === 'varita' ? styles.cursorVarita : styles.cursorPincel;

  return (
    <div className={estilos.fondo} role="dialog" aria-modal="true" aria-labelledby="quitar-fondo-titulo" onClick={aplicando ? undefined : onCancelar}>
      <div className={`${estilos.ventana} ${styles.ventana}`} onClick={(e) => e.stopPropagation()}>
        <h2 id="quitar-fondo-titulo" className={estilos.titulo}>Quitar fondo</h2>

        <div className={styles.modos} role="radiogroup" aria-label="Herramienta">
          {MODOS.map(({ id, icono: Icono, nombre, tecla }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={modo === id}
              className={`${styles.modo} ${modo === id ? styles.modoActivo : ''}`}
              onClick={() => setModo(id)}
              title={`${nombre} (${tecla})`}
            >
              <Icono size={16} aria-hidden="true" /> {nombre}
            </button>
          ))}
        </div>

        <p className={estilos.ayuda}>
          {modo === 'varita' && 'Toca un color para borrar esa zona.'}
          {modo === 'borrar' && 'Pasa el dedo o el mouse por lo que quieras borrar.'}
          {modo === 'restaurar' && 'Pasa el dedo o el mouse para recuperar lo que se borró.'}
          {modo === 'mover' && 'Arrastra para moverte por la imagen ampliada.'}
          {' '}Acerca con la rueda del mouse o con dos dedos.
        </p>

        <div
          ref={visorRef}
          className={`${styles.visor} ${styles[`visor_${fondoVista}`]} ${claseCursor}`}
          onPointerDown={fuente ? alPresionar : undefined}
          onPointerMove={fuente ? alMover : undefined}
          onPointerUp={fuente ? alSoltar : undefined}
          onPointerCancel={fuente ? alSoltar : undefined}
          onPointerLeave={() => setCursor(null)}
          onAuxClick={(e) => e.preventDefault()}
        >
          {fuente ? (
            <canvas
              ref={lienzoRef}
              className={styles.lienzo}
              aria-label="Imagen sin fondo"
              style={previa && ajuste ? {
                width: previa.w * ajuste,
                height: previa.h * ajuste,
                transform: `translate(calc(-50% + ${desplazo.x}px), calc(-50% + ${desplazo.y}px)) scale(${zoom})`,
                // De cerca se ven los píxeles tal cual: el borde exacto.
                imageRendering: ajuste * zoom >= 2 ? 'pixelated' : 'auto',
              } : undefined}
            />
          ) : (
            <p className={`${estilos.ayuda} ${styles.cargando}`}>{aviso || 'Cargando imagen…'}</p>
          )}
          {fuente && conPincel && cursor && !moviendo && (
            <span
              className={`${styles.pincel} ${modo === 'restaurar' ? styles.pincelRestaurar : ''}`}
              style={{ left: cursor.x, top: cursor.y, width: diametroPincel, height: diametroPincel }}
              aria-hidden="true"
            />
          )}
        </div>

        {fuente && (
          <div className={styles.barraVista}>
            <div className={styles.zoom} role="group" aria-label="Zoom">
              <button type="button" className={styles.botonVista} onClick={() => zoomEn(zoom / PASO_ZOOM)} disabled={zoom <= ZOOM_MIN} aria-label="Alejar" title="Alejar (−)">
                <ZoomOut size={16} aria-hidden="true" />
              </button>
              <span className={styles.zoomValor}>{Math.round(zoom * 100)}%</span>
              <button type="button" className={styles.botonVista} onClick={() => zoomEn(zoom * PASO_ZOOM)} disabled={zoom >= ZOOM_MAX} aria-label="Acercar" title="Acercar (+)">
                <ZoomIn size={16} aria-hidden="true" />
              </button>
              <button type="button" className={styles.botonVista} onClick={ajustarVista} disabled={zoom === 1} title="Ver la imagen entera (0)">
                <Scan size={16} aria-hidden="true" /> Ajustar
              </button>
            </div>
            <div className={styles.fondosVista} role="radiogroup" aria-label="Fondo de la vista">
              {FONDOS_VISTA.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={fondoVista === f.id}
                  className={`${styles.botonFondo} ${styles[`muestra_${f.id}`]} ${fondoVista === f.id ? styles.botonFondoActivo : ''}`}
                  onClick={() => setFondoVista(f.id)}
                  title={`Fondo ${f.nombre.toLowerCase()}`}
                  aria-label={`Fondo ${f.nombre.toLowerCase()}`}
                />
              ))}
            </div>
          </div>
        )}

        {fuente && aviso && <p className={estilos.aviso}>{aviso}</p>}

        {fuente && modo !== 'mover' && (
          <label className={styles.control}>
            <span>
              {modo === 'varita' ? 'Tolerancia' : 'Tamaño del pincel'}
              {modo === 'varita' && ajustaRelleno && <small> · ajusta el último borrado</small>}
            </span>
            <input
              type="range"
              min={modo === 'varita' ? 5 : 1}
              max="100"
              value={modo === 'varita' ? tolerancia : tamano}
              onChange={(e) => (modo === 'varita' ? cambiarTolerancia(Number(e.target.value)) : setTamano(Number(e.target.value)))}
              disabled={aplicando}
            />
          </label>
        )}

        <div className={estilos.acciones}>
          <button type="button" className={estilos.secundario} onClick={quitarFondoAuto} disabled={!fuente || aplicando}>
            <Sparkles size={16} aria-hidden="true" /> Quitar fondo
          </button>
          <button type="button" className={estilos.secundario} onClick={deshacer} disabled={!hayOps || aplicando} title="Deshacer (Ctrl+Z)">
            <Undo2 size={16} aria-hidden="true" /> Deshacer
          </button>
          <button type="button" className={estilos.texto} onClick={restablecer} disabled={!hayOps || aplicando}>
            Restablecer
          </button>
        </div>
        <div className={estilos.acciones}>
          <button type="button" className={estilos.secundario} onClick={onCancelar} disabled={aplicando} title="Cancelar (Esc)">Cancelar</button>
          <button type="button" className={estilos.principal} onClick={aplicar} disabled={!fuente || aplicando} title="Aplicar (Enter)">
            {aplicando ? <><Loader2 size={16} className={styles.girando} aria-hidden="true" /> Aplicando…</> : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuitarFondo;
