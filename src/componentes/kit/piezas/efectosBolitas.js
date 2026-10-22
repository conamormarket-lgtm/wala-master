/*
 * Sonidos y vibración de Las Bolitas de Kapi. Los sonidos se arman en el
 * momento con Web Audio (sin archivos que bajar); la vibración usa
 * navigator.vibrate (en la app de Android pide el permiso VIBRATE del
 * manifiesto; en iPhone no hay). Si algo falla, el juego sigue en silencio.
 */

let contexto = null;

function audio() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!contexto) contexto = new Ctx();
  // El navegador lo deja suspendido hasta que la persona toca algo.
  if (contexto.state === 'suspended') contexto.resume().catch(() => {});
  return contexto;
}

/** Una nota corta: forma de onda, frecuencia (o de-a), cuándo empieza, cuánto dura y volumen. */
function nota(ctx, { onda = 'sine', desde, hasta = desde, inicio = 0, dura = 0.12, volumen = 0.1 }) {
  const t = ctx.currentTime + inicio;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = onda;
  osc.frequency.setValueAtTime(desde, t);
  if (hasta !== desde) osc.frequency.exponentialRampToValueAtTime(hasta, t + dura);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volumen, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dura);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dura + 0.02);
}

const arpegio = (ctx, notas, paso, volumen) => notas.forEach((f, k) => nota(ctx, { desde: f, inicio: k * paso, dura: paso * 2.2, volumen }));

const SONIDOS = {
  levantar: (ctx) => nota(ctx, { desde: 520, hasta: 760, dura: 0.08, volumen: 0.07 }),
  soltar: (ctx) => nota(ctx, { onda: 'triangle', desde: 320, hasta: 170, dura: 0.11, volumen: 0.14 }),
  error: (ctx) => nota(ctx, { onda: 'square', desde: 150, dura: 0.12, volumen: 0.04 }),
  listo: (ctx) => arpegio(ctx, [1047, 1319, 1568], 0.06, 0.08),
  ganar: (ctx) => arpegio(ctx, [523, 659, 784, 1047, 1319], 0.09, 0.1),
  cofre: (ctx) => arpegio(ctx, [1568, 1976, 2349, 3136], 0.05, 0.06),
  estrella: (ctx) => nota(ctx, { desde: 1319, hasta: 1760, dura: 0.15, volumen: 0.08 }),
};

const VIBRACIONES = {
  levantar: 8,
  soltar: 14,
  error: 40,
  listo: [20, 40, 20],
  ganar: [30, 50, 30, 50, 70],
  cofre: [15, 30, 15, 30, 15],
  estrella: 12,
};

/**
 * Lo que pasa en el juego, con su sonido y su vibración.
 *  - tipo: levantar | soltar | error | listo | ganar | cofre | estrella
 *  - sonido, vibracion: los interruptores de la persona
 */
export function efectoBolitas(tipo, { sonido = true, vibracion = true } = {}) {
  if (sonido) {
    try {
      const ctx = audio();
      if (ctx) SONIDOS[tipo]?.(ctx);
    } catch { /* sin sonido */ }
  }
  if (vibracion) {
    try { navigator.vibrate?.(VIBRACIONES[tipo]); } catch { /* sin vibración */ }
  }
}
