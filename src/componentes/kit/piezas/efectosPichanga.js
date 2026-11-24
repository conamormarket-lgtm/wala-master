/*
 * Sonidos y vibración de La Pichanga de Walito, como los de Las Bolitas: se
 * arman en el momento con Web Audio (sin archivos que bajar) y la vibración
 * usa navigator.vibrate (en iPhone no hay). Si algo falla, el juego sigue en
 * silencio.
 */

let contexto = null;

function audio() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!contexto) contexto = new Ctx();
  if (contexto.state === 'suspended') contexto.resume().catch(() => {});
  return contexto;
}

function nota(ctx, { onda = 'sine', desde, hasta = desde, inicio = 0, dura = 0.12, volumen = 0.1 }) {
  const t = ctx.currentTime + inicio;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = onda;
  osc.frequency.setValueAtTime(desde, t);
  if (hasta !== desde) osc.frequency.exponentialRampToValueAtTime(hasta, t + dura);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volumen, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dura);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dura + 0.02);
}

const arpegio = (ctx, notas, paso, volumen) => notas.forEach((f, k) => nota(ctx, { desde: f, inicio: k * paso, dura: paso * 2.2, volumen }));
// El volumen de un golpe según su fuerza (1 a 30).
const segun = (fuerza, base) => base * Math.min(1, 0.25 + (fuerza || 4) / 14);

const SONIDOS = {
  tiro: (ctx) => nota(ctx, { onda: 'triangle', desde: 420, hasta: 160, dura: 0.12, volumen: 0.1 }),
  pelota: (ctx, f) => nota(ctx, { onda: 'triangle', desde: 230, hasta: 90, dura: 0.1, volumen: segun(f, 0.18) }),
  choque: (ctx, f) => nota(ctx, { onda: 'square', desde: 900, hasta: 600, dura: 0.04, volumen: segun(f, 0.04) }),
  pared: (ctx, f) => nota(ctx, { desde: 140, hasta: 80, dura: 0.09, volumen: segun(f, 0.14) }),
  cono: (ctx, f) => nota(ctx, { onda: 'triangle', desde: 700, hasta: 500, dura: 0.06, volumen: segun(f, 0.08) }),
  poste: (ctx, f) => { nota(ctx, { onda: 'square', desde: 1250, dura: 0.18, volumen: segun(f, 0.035) }); nota(ctx, { desde: 1870, dura: 0.25, volumen: segun(f, 0.04) }); },
  kapi: (ctx, f) => nota(ctx, { desde: 300, hasta: 520, dura: 0.12, volumen: segun(f, 0.12) }),
  gol: (ctx) => { arpegio(ctx, [523, 659, 784, 1047, 1319, 1568], 0.08, 0.1); nota(ctx, { onda: 'sawtooth', desde: 220, hasta: 330, inicio: 0.05, dura: 0.7, volumen: 0.025 }); },
  golKapi: (ctx) => arpegio(ctx, [392, 330, 262], 0.12, 0.09),
  fallo: (ctx) => arpegio(ctx, [440, 370, 311], 0.1, 0.08),
  pase: (ctx) => arpegio(ctx, [784, 1047, 1319], 0.06, 0.08),
  silbato: (ctx) => { nota(ctx, { desde: 2300, hasta: 2500, dura: 0.16, volumen: 0.05 }); nota(ctx, { desde: 2300, hasta: 2600, inicio: 0.2, dura: 0.32, volumen: 0.05 }); },
  ganar: (ctx) => arpegio(ctx, [523, 659, 784, 1047, 1319], 0.09, 0.1),
  cofre: (ctx) => arpegio(ctx, [1568, 1976, 2349, 3136], 0.05, 0.06),
  error: (ctx) => nota(ctx, { onda: 'square', desde: 150, dura: 0.12, volumen: 0.04 }),
};

const VIBRACIONES = {
  tiro: 12,
  pelota: 10,
  poste: 25,
  kapi: 18,
  gol: [40, 60, 40, 60, 90],
  golKapi: [60, 40, 60],
  pase: [12, 30, 12],
  fallo: [50, 40, 50],
  ganar: [30, 50, 30, 50, 70],
  cofre: [15, 30, 15, 30, 15],
  error: 40,
};

/**
 * Lo que pasa en la cancha, con su sonido y su vibración.
 *  - tipo: tiro | pelota | choque | pared | cono | poste | kapi | gol | golKapi | fallo | pase | silbato | ganar | cofre | error
 *  - fuerza: la del golpe (los choques suenan más o menos fuerte)
 *  - sonido, vibracion: los interruptores de la persona
 */
export function efectoPichanga(tipo, { fuerza, sonido = true, vibracion = true } = {}) {
  if (sonido) {
    try {
      const ctx = audio();
      if (ctx) SONIDOS[tipo]?.(ctx, fuerza);
    } catch { /* sin sonido */ }
  }
  if (vibracion && VIBRACIONES[tipo]) {
    try { navigator.vibrate?.(VIBRACIONES[tipo]); } catch { /* sin vibración */ }
  }
}
