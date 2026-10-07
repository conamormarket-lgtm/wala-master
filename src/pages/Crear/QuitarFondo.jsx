import React, { useEffect, useRef, useState } from 'react';
import { Wand2, Eraser, Brush, Undo2, Sparkles, Loader2 } from 'lucide-react';
import { cargarImagen } from '../../utils/prendaBase';
import { bordesVisibles, recortarImagen } from '../../services/crearArchivos';
import {
  TOLERANCIA_INICIAL, fondoAutomatico, analizarBorde, reconstruir, aplicarOperacion, pintarTrazo, componer, quedaAlgo,
} from './fondoPixeles';
import estilos from './RecorteImagen.module.css';
import styles from './QuitarFondo.module.css';

// Vista previa liviana; al aplicar se repite todo a tamaño de impresión.
const LADO_PREVIA = 1400;
// Tope del resultado: más que esto no mejora la impresión y pesa demasiado
// en el celular (35 cm a 300 dpi son ~4100 px).
const LADO_FINAL = 4000;
const TAMANO_INICIAL = 30;
// Tamaño del pincel (1–100) → radio relativo al lado mayor.
const radioDe = (tamano) => 0.004 + (tamano / 100) * 0.06;

const MODOS = [
  { id: 'varita', icono: Wand2, nombre: 'Varita' },
  { id: 'borrar', icono: Eraser, nombre: 'Borrador' },
  { id: 'restaurar', icono: Brush, nombre: 'Restaurar' },
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
 * retocan a mano. Devuelve la imagen sin fondo, ya sin bordes vacíos.
 *
 * onAplicar({ blob, ancho, alto, corte, factor }): `corte` es lo que quedó,
 * en píxeles de la imagen original, y `factor` cuántos píxeles del
 * resultado hay por píxel original (menos de 1 si se redujo).
 */
const QuitarFondo = ({ src, onCancelar, onAplicar }) => {
  const lienzoRef = useRef(null);
  const previaRef = useRef(null);
  const mascaraRef = useRef(null);
  const opsRef = useRef([]);
  const trazoRef = useRef(null);
  const cuadroRef = useRef(0);
  const [fuente, setFuente] = useState(null);
  const [modo, setModo] = useState('varita');
  const [tolerancia, setTolerancia] = useState(TOLERANCIA_INICIAL);
  const [tamano, setTamano] = useState(TAMANO_INICIAL);
  const [, setCambios] = useState(0);
  const [aviso, setAviso] = useState('');
  const [aplicando, setAplicando] = useState(false);

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

  const puntoDe = (e) => {
    const caja = lienzoRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - caja.left) / caja.width)),
      y: Math.min(1, Math.max(0, (e.clientY - caja.top) / caja.height)),
    };
  };

  const alPresionar = (e) => {
    if (!previaRef.current || aplicando) return;
    e.preventDefault();
    const p = puntoDe(e);
    if (modo === 'varita') {
      agregar({ t: 'varita', x: p.x, y: p.y, tol: tolerancia });
      setAviso('');
      return;
    }
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* sin captura: el trazo sigue igual */ }
    trazoRef.current = { t: 'trazo', modo, r: radioDe(tamano), puntos: [p] };
    pintarTrazo(previaRef.current, mascaraRef.current, trazoRef.current, 0);
    dibujar();
  };

  const alMover = (e) => {
    const trazo = trazoRef.current;
    if (!trazo) return;
    trazo.puntos.push(puntoDe(e));
    pintarTrazo(previaRef.current, mascaraRef.current, trazo, trazo.puntos.length - 1);
    dibujar();
  };

  const alSoltar = () => {
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

  const hayOps = opsRef.current.length > 0;
  const ultima = opsRef.current[opsRef.current.length - 1];
  const ajustaRelleno = ultima && (ultima.t === 'varita' || ultima.t === 'fondo');

  return (
    <div className={estilos.fondo} role="dialog" aria-modal="true" aria-labelledby="quitar-fondo-titulo" onClick={aplicando ? undefined : onCancelar}>
      <div className={estilos.ventana} onClick={(e) => e.stopPropagation()}>
        <h2 id="quitar-fondo-titulo" className={estilos.titulo}>Quitar fondo</h2>

        <div className={styles.modos} role="radiogroup" aria-label="Herramienta">
          {MODOS.map(({ id, icono: Icono, nombre }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={modo === id}
              className={`${styles.modo} ${modo === id ? styles.modoActivo : ''}`}
              onClick={() => setModo(id)}
            >
              <Icono size={16} aria-hidden="true" /> {nombre}
            </button>
          ))}
        </div>

        <p className={estilos.ayuda}>
          {modo === 'varita'
            ? 'Toca un color para borrar esa zona.'
            : modo === 'borrar'
              ? 'Pasa el dedo o el mouse por lo que quieras borrar.'
              : 'Pasa el dedo o el mouse para recuperar lo que se borró.'}
        </p>

        <div className={estilos.area}>
          {fuente ? (
            <canvas
              ref={lienzoRef}
              className={`${styles.lienzo} ${modo === 'varita' ? styles.cursorVarita : styles.cursorPincel}`}
              onPointerDown={alPresionar}
              onPointerMove={alMover}
              onPointerUp={alSoltar}
              onPointerCancel={alSoltar}
              aria-label="Imagen sin fondo"
            />
          ) : (
            <p className={estilos.ayuda}>{aviso || 'Cargando imagen…'}</p>
          )}
        </div>

        {fuente && aviso && <p className={estilos.aviso}>{aviso}</p>}

        {fuente && (
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
          <button type="button" className={estilos.secundario} onClick={deshacer} disabled={!hayOps || aplicando}>
            <Undo2 size={16} aria-hidden="true" /> Deshacer
          </button>
          <button type="button" className={estilos.texto} onClick={restablecer} disabled={!hayOps || aplicando}>
            Restablecer
          </button>
        </div>
        <div className={estilos.acciones}>
          <button type="button" className={estilos.secundario} onClick={onCancelar} disabled={aplicando}>Cancelar</button>
          <button type="button" className={estilos.principal} onClick={aplicar} disabled={!fuente || aplicando}>
            {aplicando ? <><Loader2 size={16} className={styles.girando} aria-hidden="true" /> Aplicando…</> : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuitarFondo;
