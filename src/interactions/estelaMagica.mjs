// El brillo mágico del dedo (el orbe al mantener y la estela al deslizar; el
// dibujo vive en estelaMotor.mjs). Esto solo pone el <canvas> fijo sobre la
// página y le pasa los toques.
//
// El dibujo corre en un Worker con OffscreenCanvas (estelaWorker.mjs): en el
// inicio, el hilo principal está ocupado con carruseles, fotos y React, y la
// estela que se dibujaba ahí iba a saltos. Si el navegador no tiene
// OffscreenCanvas o el Worker no carga, el mismo motor dibuja aquí.
//
// Cada toque viaja con su hora (event.timeStamp en el reloj absoluto): en las
// páginas pesadas llegan tarde y en lotes, y el motor los reparte como pasaron.
import { crearMotor } from './estelaMotor.mjs';

// Es luz difusa: no necesita la densidad completa de la pantalla. A 1.5 en vez
// de 2 son ~44% menos píxeles que la GPU recompone en cada cuadro.
const MAX_ESCALA = 1.5;

export function crearEstela(view = window) {
  const doc = view.document;
  const perf = view.performance;
  // La hora de un evento en el reloj absoluto (el mismo del Worker). Los
  // navegadores viejos daban timeStamp en ms desde 1970.
  const reloj = (ts) => (Number.isFinite(ts) && ts > 0 ? (ts > 1e12 ? ts : perf.timeOrigin + ts) : undefined);
  let canvas = null;
  let worker = null;
  let enviar = null;

  const medidas = () => ({
    ancho: view.innerWidth,
    alto: view.innerHeight,
    dpr: Math.min(view.devicePixelRatio || 1, MAX_ESCALA),
  });
  const nuevoLienzo = () => {
    canvas?.remove();
    canvas = doc.createElement('canvas');
    canvas.className = 'wala-touch-estela';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.width = `${view.innerWidth}px`;
    canvas.style.height = `${view.innerHeight}px`;
    doc.body.append(canvas);
    return canvas;
  };

  const enHiloPrincipal = () => {
    worker?.terminate();
    worker = null;
    const motor = crearMotor({
      lienzo: nuevoLienzo(),
      ahora: () => perf.timeOrigin + perf.now(),
      pedirMarco: (fn) => view.requestAnimationFrame(fn),
      cancelarMarco: (id) => view.cancelAnimationFrame(id),
    });
    const { ancho, alto, dpr } = medidas();
    motor.tamano(ancho, alto, dpr);
    enviar = (m) => {
      if (m.tipo === 'tamano') motor.tamano(m.ancho, m.alto, m.dpr);
      else if (m.tipo === 'presionar') motor.presionar(m.x, m.y, m.oscuro, m.t);
      else if (m.tipo === 'empezar') motor.empezar(m.x, m.y, m.t);
      else if (m.tipo === 'agregar') motor.agregar(m.xyt[0], m.xyt[1], m.xyt[2]);
      else if (m.tipo === 'soltar') motor.soltar(m.t);
      else if (m.tipo === 'cancelar') motor.cancelar();
      else if (m.tipo === 'limpiar') motor.limpiar();
    };
  };

  const asegurar = () => {
    if (enviar) return;
    const lienzo = nuevoLienzo();
    if (typeof lienzo.transferControlToOffscreen === 'function' && typeof view.Worker === 'function') {
      try {
        worker = new Worker(new URL('./estelaWorker.mjs', import.meta.url), { type: 'module' });
        const fuera = lienzo.transferControlToOffscreen();
        worker.postMessage({ tipo: 'iniciar', lienzo: fuera, ...medidas() }, [fuera]);
        enviar = (m) => worker?.postMessage(m);
        // Si el Worker no llega a cargar, se dibuja aquí (con otro lienzo: el
        // primero ya se entregó).
        worker.addEventListener('error', enHiloPrincipal, { once: true });
        return;
      } catch {
        worker?.terminate();
        worker = null;
      }
    }
    enHiloPrincipal();
  };

  const oscuro = () => doc.documentElement.getAttribute('data-theme') === 'dark';

  // ts: el timeStamp del evento táctil.
  return {
    presionar(x, y, ts) { asegurar(); enviar({ tipo: 'presionar', x, y, t: reloj(ts), oscuro: oscuro() }); },
    empezar(x, y, ts) { asegurar(); enviar({ tipo: 'empezar', x, y, t: reloj(ts) }); },
    agregar(x, y, ts) { enviar?.({ tipo: 'agregar', xyt: [x, y, reloj(ts)] }); },
    soltar(ts) { enviar?.({ tipo: 'soltar', t: reloj(ts) }); },
    cancelar() { enviar?.({ tipo: 'cancelar' }); },
    limpiar() { enviar?.({ tipo: 'limpiar' }); },
    medir() {
      if (!canvas) return;
      canvas.style.width = `${view.innerWidth}px`;
      canvas.style.height = `${view.innerHeight}px`;
      enviar?.({ tipo: 'tamano', ...medidas() });
    },
    quitar() {
      enviar?.({ tipo: 'limpiar' });
      worker?.terminate();
      worker = null;
      enviar = null;
      canvas?.remove();
      canvas = null;
    },
  };
}
