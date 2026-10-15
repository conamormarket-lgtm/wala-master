import React, { useEffect, useRef, useState } from 'react';
import { Wand2, Eraser, Brush, Hand, Undo2, Sparkles, ZoomIn, ZoomOut, Scan, RotateCcw } from 'lucide-react';
import Boton from '../Boton';
import { Chip } from '../Etiquetas';
import { Aviso, HojaInferior } from '../Feedback';
import { Deslizador } from '../Formulario';
import { cargarImagen, cajaVisible, recortarImagen } from '../imagenes';
import s from './QuitarFondo.module.css';

/*
 * Quitar el fondo de una imagen del diseño (el estudio). Si el borde es de
 * un color parejo (un logo sobre blanco) el fondo se quita apenas se abre;
 * después, la varita borra la zona del color que se toca y el borrador y
 * restaurar retocan a mano. Con zoom (rueda, botones o dos dedos) se llega a
 * los detalles: el pincel mide lo mismo en pantalla, así que al acercar es
 * más fino.
 *
 * La lógica de píxeles no vive aquí: llega en `motor` (en la tienda,
 * pages/Crear/fondoPixeles.js: TOLERANCIA_INICIAL, fondoAutomatico,
 * analizarBorde, reconstruir, aplicarOperacion, pintarTrazo, componer,
 * quedaAlgo). Lo hecho es una lista de operaciones en coordenadas 0–1: se ve
 * en una vista previa liviana y, al aplicar, se repite a tamaño real.
 */

const LADO_PREVIA = 2000;
const LADO_FINAL = 4000;
const TAMANO_INICIAL = 30;
const radioDe = (tamano) => 0.004 + (tamano / 100) * 0.06; // relativo al lado mayor, sin zoom
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const PASO_ZOOM = 1.25;
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

const HERRAMIENTAS = [
  { id: 'varita', Icono: Wand2, nombre: 'Varita', tecla: 'V', ayuda: 'Toca un color para borrar esa zona.' },
  { id: 'borrar', Icono: Eraser, nombre: 'Borrador', tecla: 'B', ayuda: 'Pasa el dedo o el ratón por lo que quieras borrar.' },
  { id: 'restaurar', Icono: Brush, nombre: 'Restaurar', tecla: 'R', ayuda: 'Pasa el dedo o el ratón para recuperar lo borrado.' },
  { id: 'mover', Icono: Hand, nombre: 'Mover', tecla: 'H', ayuda: 'Arrastra para moverte por la imagen ampliada.' },
];
const FONDOS = [['cuadros', 'Cuadros'], ['oscuro', 'Oscuro'], ['claro', 'Claro']];

/** Píxeles de una imagen a un lado máximo: { d, w, h, lienzo, ctx }. */
const leerPixeles = (fuente, ladoMax) => {
  const W = fuente.naturalWidth || fuente.width;
  const H = fuente.naturalHeight || fuente.height;
  const k = Math.min(1, ladoMax / Math.max(W, H));
  const w = Math.max(1, Math.round(W * k));
  const h = Math.max(1, Math.round(H * k));
  const lienzo = document.createElement('canvas');
  lienzo.width = w;
  lienzo.height = h;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(fuente, 0, 0, w, h);
  return { d: ctx.getImageData(0, 0, w, h).data, w, h, lienzo, ctx };
};

/**
 * - abierta · src · motor (ver arriba) · onCancelar
 * - onAplicar({ blob, ancho, alto, corte, factor, natural }): promesa;
 *   `corte` es lo que quedó (sin los bordes vacíos), en px de la imagen
 *   original (`natural`: { w, h }), y `factor`, px del resultado por px
 *   original. null si no se cambió nada.
 */
export function QuitarFondo({ abierta, src, motor, onCancelar, onAplicar }) {
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
  const [herramienta, setHerramienta] = useState('varita');
  const [tolerancia, setTolerancia] = useState(motor?.TOLERANCIA_INICIAL ?? 35);
  const [tamano, setTamano] = useState(TAMANO_INICIAL);
  const [, setCambios] = useState(0);
  const [aviso, setAviso] = useState('');
  const [aplicando, setAplicando] = useState(false);
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
      ctx.putImageData(motor.componer(previa, mascaraRef.current, ctx.createImageData(previa.w, previa.h)), 0, 0);
    });
  };
  const rehacer = () => {
    mascaraRef.current = motor.reconstruir(previaRef.current, opsRef.current);
    setCambios((n) => n + 1);
    dibujar();
  };
  const agregar = (op) => {
    opsRef.current = [...opsRef.current, op];
    motor.aplicarOperacion(previaRef.current, mascaraRef.current, op);
    setCambios((n) => n + 1);
    dibujar();
  };

  // Al abrir: leer la imagen y, si el borde es parejo, quitar el fondo solo.
  useEffect(() => {
    if (!abierta || !src || !motor) return undefined;
    let vigente = true;
    setFuente(null);
    setAviso('');
    setZoom(1);
    setDesplazo({ x: 0, y: 0 });
    setHerramienta('varita');
    opsRef.current = [];
    cargarImagen(src).then((img) => {
      if (!vigente) return;
      const previa = leerPixeles(img, LADO_PREVIA);
      previaRef.current = previa;
      mascaraRef.current = new Uint8Array(previa.w * previa.h).fill(255);
      const auto = motor.fondoAutomatico(previa);
      if (auto) {
        opsRef.current = [auto];
        motor.aplicarOperacion(previa, mascaraRef.current, auto);
        setAviso('Quitamos el fondo automáticamente. Si borró de más, toca Deshacer.');
      } else if (motor.analizarBorde(previa).transparente > 0.5) {
        setAviso('Esta imagen ya no tiene fondo. Puedes retocarla con el borrador.');
      } else {
        setAviso('Toca el fondo con la varita para borrarlo.');
      }
      setFuente(img);
    }).catch(() => vigente && setAviso('No pudimos abrir la imagen.'));
    return () => { vigente = false; cancelAnimationFrame(cuadroRef.current); };
  }, [abierta, src, motor]); // eslint-disable-line react-hooks/exhaustive-deps

  // El lienzo aparece después de cargar; la imagen entra entera en el visor.
  useEffect(() => {
    if (!fuente || !lienzoRef.current || !visorRef.current) return undefined;
    lienzoRef.current.width = previaRef.current.w;
    lienzoRef.current.height = previaRef.current.h;
    dibujar();
    const visor = visorRef.current;
    const medir = () => {
      const previa = previaRef.current;
      if (previa) setAjuste(Math.min(visor.clientWidth / previa.w, visor.clientHeight / previa.h) * 0.96);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(visor);
    return () => ro.disconnect();
  }, [fuente]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Zoom y desplazamiento ── */
  const limitarDesplazo = (d, z) => {
    const previa = previaRef.current;
    const k = vistaRef.current.ajuste;
    if (!previa || z <= 1) return { x: 0, y: 0 };
    const mx = (previa.w * k * z) / 2;
    const my = (previa.h * k * z) / 2;
    return { x: limitar(d.x, -mx, mx), y: limitar(d.y, -my, my) };
  };
  const fijarVista = (z, d) => {
    const nuevo = limitarDesplazo(d, z);
    vistaRef.current = { ...vistaRef.current, zoom: z, desplazo: nuevo };
    setZoom(z);
    setDesplazo(nuevo);
  };
  const desdeCentro = (x, y) => {
    const r = visorRef.current.getBoundingClientRect();
    return { x: x - (r.left + r.width / 2), y: y - (r.top + r.height / 2) };
  };
  /** Cambia el zoom dejando quieto el punto `p` (por defecto, el centro). */
  const zoomEn = (zNuevo, p = { x: 0, y: 0 }) => {
    const { zoom: z1, desplazo: d1 } = vistaRef.current;
    const z = limitar(zNuevo, ZOOM_MIN, ZOOM_MAX);
    fijarVista(z, { x: p.x - (p.x - d1.x) * (z / z1), y: p.y - (p.y - d1.y) * (z / z1) });
  };
  const ajustarVista = () => fijarVista(1, { x: 0, y: 0 });

  // Rueda (y pellizco del trackpad, que llega con Ctrl): acerca hacia el puntero.
  useEffect(() => {
    const visor = visorRef.current;
    if (!fuente || !visor) return undefined;
    const alRodar = (e) => {
      e.preventDefault();
      zoomEn(vistaRef.current.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), desdeCentro(e.clientX, e.clientY));
    };
    visor.addEventListener('wheel', alRodar, { passive: false });
    return () => visor.removeEventListener('wheel', alRodar);
  }, [fuente]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Pintar, mover y pellizcar ── */
  const puntoDe = (e, soloDentro = false) => {
    const c = lienzoRef.current.getBoundingClientRect();
    const x = (e.clientX - c.left) / c.width;
    const y = (e.clientY - c.top) / c.height;
    if (soloDentro && (x < 0 || y < 0 || x > 1 || y > 1)) return null;
    return { x: limitar(x, 0, 1), y: limitar(y, 0, 1) };
  };
  const alPresionar = (e) => {
    if (!previaRef.current || aplicando) return;
    punterosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { visorRef.current.setPointerCapture?.(e.pointerId); } catch { /* sin captura */ }
    if (punterosRef.current.size === 2) {
      // Dos dedos: se descarta el trazo a medias y se pellizca.
      if (trazoRef.current) { trazoRef.current = null; rehacer(); }
      const [a, b] = [...punterosRef.current.values()];
      gestoRef.current = { tipo: 'pinza', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: vistaRef.current.zoom, off0: vistaRef.current.desplazo, mid0: desdeCentro((a.x + b.x) / 2, (a.y + b.y) / 2) };
      return;
    }
    if (herramienta === 'mover' || espacioRef.current || e.button === 1) {
      e.preventDefault();
      gestoRef.current = { tipo: 'mover', x0: e.clientX, y0: e.clientY, off0: vistaRef.current.desplazo };
      setMoviendo(true);
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const p = puntoDe(e, true);
    if (!p) return;
    if (herramienta === 'varita') {
      agregar({ t: 'varita', x: p.x, y: p.y, tol: tolerancia });
      setAviso('');
      return;
    }
    trazoRef.current = { t: 'trazo', modo: herramienta, r: radioDe(tamano) / vistaRef.current.zoom, puntos: [p] };
    motor.pintarTrazo(previaRef.current, mascaraRef.current, trazoRef.current, 0);
    dibujar();
  };
  const alMover = (e) => {
    if (e.pointerType === 'mouse') {
      const r = visorRef.current.getBoundingClientRect();
      setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
    }
    if (punterosRef.current.has(e.pointerId)) punterosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestoRef.current;
    if (g?.tipo === 'pinza' && punterosRef.current.size >= 2) {
      const [a, b] = [...punterosRef.current.values()];
      const z = limitar(g.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / g.d0), ZOOM_MIN, ZOOM_MAX);
      const mid = desdeCentro((a.x + b.x) / 2, (a.y + b.y) / 2);
      const px = (g.mid0.x - g.off0.x) / g.z0;
      const py = (g.mid0.y - g.off0.y) / g.z0;
      fijarVista(z, { x: mid.x - px * z, y: mid.y - py * z });
      return;
    }
    if (g?.tipo === 'mover') {
      fijarVista(vistaRef.current.zoom, { x: g.off0.x + e.clientX - g.x0, y: g.off0.y + e.clientY - g.y0 });
      return;
    }
    const trazo = trazoRef.current;
    if (!trazo) return;
    trazo.puntos.push(puntoDe(e));
    motor.pintarTrazo(previaRef.current, mascaraRef.current, trazo, trazo.puntos.length - 1);
    dibujar();
  };
  const alSoltar = (e) => {
    punterosRef.current.delete(e.pointerId);
    const g = gestoRef.current;
    if (g) {
      if (g.tipo === 'mover' || punterosRef.current.size < 2) { gestoRef.current = null; setMoviendo(false); }
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
  const cambiarTolerancia = (v) => {
    setTolerancia(v);
    const ops = opsRef.current;
    const ultima = ops[ops.length - 1];
    if (ultima && (ultima.t === 'varita' || ultima.t === 'fondo')) {
      opsRef.current = [...ops.slice(0, -1), { ...ultima, tol: v }];
      rehacer();
    }
  };
  const quitarFondoAuto = () => {
    const { color } = motor.analizarBorde(previaRef.current);
    if (!color) { setAviso('Esta imagen ya no tiene fondo.'); return; }
    agregar({ t: 'fondo', color, tol: tolerancia });
    setAviso('');
  };
  const deshacer = () => { opsRef.current = opsRef.current.slice(0, -1); rehacer(); };
  const restablecer = () => { opsRef.current = []; setAviso(''); rehacer(); };

  const aplicar = async () => {
    if (!fuente || aplicando) return;
    if (!opsRef.current.length) { await onAplicar?.(null); return; }
    if (!motor.quedaAlgo(previaRef.current, mascaraRef.current)) {
      setAviso('Borraste toda la imagen. Toca Deshacer o Restaurar.');
      return;
    }
    setAplicando(true);
    await new Promise((r) => { setTimeout(r, 30); }); // que se vea "Aplicando…" antes del trabajo pesado
    try {
      const final = leerPixeles(fuente, LADO_FINAL);
      const mascara = motor.reconstruir(final, opsRef.current);
      final.ctx.putImageData(motor.componer(final, mascara, final.ctx.createImageData(final.w, final.h)), 0, 0);
      const factor = final.w / (fuente.naturalWidth || fuente.width);
      // Sin los bordes que quedaron vacíos: la imagen ocupa solo lo que se ve.
      const caja = cajaVisible(final.lienzo) || { x: 0, y: 0, w: final.w, h: final.h };
      const { blob, ancho, alto } = await recortarImagen(final.lienzo, caja);
      await onAplicar?.({
        blob, ancho, alto, factor,
        corte: { x: caja.x / factor, y: caja.y / factor, w: caja.w / factor, h: caja.h / factor },
        natural: { w: fuente.naturalWidth || fuente.width, h: fuente.naturalHeight || fuente.height },
      });
    } catch {
      setAviso('No pudimos procesar la imagen. Prueba con una más liviana.');
    } finally {
      setAplicando(false);
    }
  };

  // Teclado: V/B/R/H herramienta, [ ] pincel, + − 0 zoom, Espacio (mantenida)
  // mueve la vista, Ctrl+Z deshace, Enter aplica y Esc cancela.
  const teclasRef = useRef(null);
  teclasRef.current = (e) => {
    if (aplicando || e.isComposing) return;
    const t = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if ((e.ctrlKey || e.metaKey) && t === 'z') { e.preventDefault(); if (opsRef.current.length) deshacer(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (t === ' ') { e.preventDefault(); espacioRef.current = true; setEspacio(true); return; }
    if (t === 'Escape') { e.preventDefault(); onCancelar?.(); } else if (t === 'Enter') { e.preventDefault(); aplicar(); }
    else if (t === 'v') setHerramienta('varita');
    else if (t === 'b') setHerramienta('borrar');
    else if (t === 'r') setHerramienta('restaurar');
    else if (t === 'h') setHerramienta('mover');
    else if (t === '[') setTamano((n) => Math.max(1, n - 5));
    else if (t === ']') setTamano((n) => Math.min(100, n + 5));
    else if (t === '+' || t === '=') { e.preventDefault(); zoomEn(vistaRef.current.zoom * PASO_ZOOM); }
    else if (t === '-' || t === '_') { e.preventDefault(); zoomEn(vistaRef.current.zoom / PASO_ZOOM); }
    else if (t === '0') { e.preventDefault(); ajustarVista(); }
  };
  useEffect(() => {
    if (!abierta) return undefined;
    const abajo = (e) => teclasRef.current?.(e);
    const arriba = (e) => { if (e.key === ' ') { e.preventDefault(); espacioRef.current = false; setEspacio(false); } };
    window.addEventListener('keydown', abajo);
    window.addEventListener('keyup', arriba);
    return () => { window.removeEventListener('keydown', abajo); window.removeEventListener('keyup', arriba); };
  }, [abierta]);

  const hayOps = opsRef.current.length > 0;
  const ultima = opsRef.current[opsRef.current.length - 1];
  const ajustaRelleno = ultima && (ultima.t === 'varita' || ultima.t === 'fondo');
  const previa = previaRef.current;
  const aMano = herramienta === 'mover' || espacio;
  const conPincel = !aMano && (herramienta === 'borrar' || herramienta === 'restaurar');
  const diametro = previa ? 2 * radioDe(tamano) * Math.max(previa.w, previa.h) * ajuste : 0;
  const claseCursor = aMano ? (moviendo ? s.cursorMoviendo : s.cursorMano) : conPincel && cursor ? s.cursorOculto : s.cursorPuntero;
  const actual = HERRAMIENTAS.find((h) => h.id === herramienta);

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={() => !aplicando && onCancelar?.()}
      titulo="Quitar el fondo"
      pie={(
        <div className={s.pie}>
          <Boton variante="fantasma" onClick={onCancelar} disabled={aplicando} title="Cancelar (Esc)">Cancelar</Boton>
          <Boton onClick={aplicar} cargando={aplicando} disabled={!fuente} title="Aplicar (Enter)">Aplicar</Boton>
        </div>
      )}
    >
      <div className={s.quitar} data-componente="QuitarFondo">
        <div className={s.herramientas} role="group" aria-label="Herramienta">
          {HERRAMIENTAS.map(({ id, Icono, nombre, tecla }) => (
            <Chip key={id} tamano="sm" activo={herramienta === id} onClick={() => setHerramienta(id)} icono={<Icono aria-hidden="true" />}>
              {nombre}<span className={s.oculto}> (tecla {tecla})</span>
            </Chip>
          ))}
        </div>
        <p className={s.ayuda}>{actual?.ayuda} Acerca con la rueda del ratón o con dos dedos.</p>

        <div
          ref={visorRef}
          className={[s.visor, s[`visor_${fondoVista}`], claseCursor].join(' ')}
          onPointerDown={fuente ? alPresionar : undefined}
          onPointerMove={fuente ? alMover : undefined}
          onPointerUp={fuente ? alSoltar : undefined}
          onPointerCancel={fuente ? alSoltar : undefined}
          onPointerLeave={() => setCursor(null)}
          onAuxClick={(e) => e.preventDefault()}
          aria-busy={!fuente || aplicando}
        >
          {fuente ? (
            <canvas
              ref={lienzoRef}
              className={s.lienzo}
              aria-label="La imagen sin fondo"
              style={previa && ajuste ? {
                width: previa.w * ajuste,
                height: previa.h * ajuste,
                transform: `translate(calc(-50% + ${desplazo.x}px), calc(-50% + ${desplazo.y}px)) scale(${zoom})`,
                imageRendering: ajuste * zoom >= 2 ? 'pixelated' : 'auto',
              } : undefined}
            />
          ) : (
            <p className={s.ayuda}>{aviso || 'Cargando imagen…'}</p>
          )}
          {fuente && conPincel && cursor && !moviendo && (
            <span className={[s.pincel, herramienta === 'restaurar' && s.pincelRestaurar].filter(Boolean).join(' ')} style={{ left: cursor.x, top: cursor.y, width: diametro, height: diametro }} aria-hidden="true" />
          )}
        </div>

        {fuente && (
          <div className={s.vista}>
            <span className={s.zoom} role="group" aria-label="Zoom">
              <Boton variante="fantasma" tamano="sm" soloIcono aria-label="Alejar (−)" icono={<ZoomOut aria-hidden="true" />} onClick={() => zoomEn(zoom / PASO_ZOOM)} disabled={zoom <= ZOOM_MIN} />
              <span className={s.zoomValor}>{Math.round(zoom * 100)}%</span>
              <Boton variante="fantasma" tamano="sm" soloIcono aria-label="Acercar (+)" icono={<ZoomIn aria-hidden="true" />} onClick={() => zoomEn(zoom * PASO_ZOOM)} disabled={zoom >= ZOOM_MAX} />
              <Boton variante="fantasma" tamano="sm" icono={<Scan aria-hidden="true" />} onClick={ajustarVista} disabled={zoom === 1}>Ajustar</Boton>
            </span>
            <span className={s.fondos} role="radiogroup" aria-label="Fondo de la vista">
              {FONDOS.map(([id, nombre]) => (
                <button key={id} type="button" role="radio" aria-checked={fondoVista === id} aria-label={`Fondo ${nombre.toLowerCase()}`} title={`Fondo ${nombre.toLowerCase()}`} className={[s.fondo, s[`muestra_${id}`], fondoVista === id && s.fondoActivo].filter(Boolean).join(' ')} onClick={() => setFondoVista(id)} />
              ))}
            </span>
          </div>
        )}

        {fuente && aviso && <Aviso compacto tipo="info">{aviso}</Aviso>}

        {fuente && herramienta !== 'mover' && (
          herramienta === 'varita' ? (
            <Deslizador etiqueta={ajustaRelleno ? 'Tolerancia · ajusta el último borrado' : 'Tolerancia'} valor={tolerancia} min={5} max={100} onChange={cambiarTolerancia} disabled={aplicando} />
          ) : (
            <Deslizador etiqueta="Tamaño del pincel" valor={tamano} min={1} max={100} onChange={setTamano} disabled={aplicando} />
          )
        )}

        <div className={s.acciones}>
          <Boton variante="contorno" tamano="sm" icono={<Sparkles aria-hidden="true" />} onClick={quitarFondoAuto} disabled={!fuente || aplicando}>Quitar fondo</Boton>
          <Boton variante="contorno" tamano="sm" icono={<Undo2 aria-hidden="true" />} onClick={deshacer} disabled={!hayOps || aplicando} title="Deshacer (Ctrl+Z)">Deshacer</Boton>
          <Boton variante="fantasma" tamano="sm" icono={<RotateCcw aria-hidden="true" />} onClick={restablecer} disabled={!hayOps || aplicando}>Restablecer</Boton>
        </div>
      </div>
    </HojaInferior>
  );
}
