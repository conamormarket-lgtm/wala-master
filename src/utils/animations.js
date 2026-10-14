import { MONEDA_SRC } from '../components/common/Moneda/Moneda';

export const playCoinSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Frequency slide to simulate a coin 'ding'
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (err) {
    console.warn('AudioContext no soportado o interactuado aún');
  }
};

/** El contador visible de monedas (desktop y mobile tienen la clase, solo uno se ve). */
const destinoMonedas = () => {
  for (const el of document.querySelectorAll('.global-coins-target')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return document.querySelector('header');
};

const sinMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** "+N" que sube y se desvanece donde se ganaron las monedas. */
const etiquetaGanancia = (capa, x, y, amount) => {
  const et = document.createElement('span');
  et.textContent = `+${amount}`;
  et.setAttribute('aria-hidden', 'true');
  Object.assign(et.style, {
    position: 'absolute', left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, -50%)',
    padding: '0.2rem 0.6rem', borderRadius: '999px', background: '#fbbf24', color: '#2e1065',
    font: '900 1.05rem/1.2 Montserrat, Poppins, system-ui, sans-serif', letterSpacing: '-0.02em',
    boxShadow: '0 6px 14px -8px rgba(146, 64, 14, 0.8)', whiteSpace: 'nowrap',
  });
  capa.appendChild(et);
  if (!et.animate) { setTimeout(() => et.remove(), 900); return; }
  et.animate([
    { opacity: 0, transform: 'translate(-50%, -30%) scale(0.6) rotate(-6deg)' },
    { opacity: 1, transform: 'translate(-50%, -90%) scale(1.08) rotate(-6deg)', offset: 0.25 },
    { opacity: 1, transform: 'translate(-50%, -130%) scale(1) rotate(-4deg)', offset: 0.7 },
    { opacity: 0, transform: 'translate(-50%, -170%) scale(0.95) rotate(-4deg)' },
  ], { duration: 1100, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }).onfinish = () => et.remove();
};

/** El contador late cada vez que llega una moneda. */
const latir = (el) => {
  if (!el?.animate) return;
  el.animate([
    { transform: 'scale(1)' }, { transform: 'scale(1.14) rotate(-3deg)' }, { transform: 'scale(1)' },
  ], { duration: 260, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
};

/**
 * Monedas que vuelan desde (startX, startY) hasta el contador de la cabecera:
 * salen en abanico girando como monedas, suben en curva y bajan al saldo,
 * que late con cada una; un "+N" sube donde se ganaron. Solo transform y
 * opacity. Con "reducir movimiento", sin vuelo: el "+N" y los mismos eventos.
 *
 * Eventos (los usa la cabecera para el número): 'coins-animation-start' al
 * empezar, 'coin-reached-target' por cada moneda que llega (con su parte del
 * total) y 'coins-animation-end' al terminar.
 */
export const showFlyingCoins = (startX, startY, amount = 10) => {
  const numCoins = Math.max(1, Math.min(Math.round(amount), 10));
  const amoutPerCoin = amount / numCoins;

  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '9999', overflow: 'hidden',
  });
  document.body.appendChild(container);
  window.dispatchEvent(new CustomEvent('coins-animation-start', { detail: { amount } }));

  const targetEl = destinoMonedas();
  let targetX = window.innerWidth - 100;
  let targetY = 30;
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    targetX = rect.left + Math.min(rect.width / 2, 24);
    targetY = rect.top + rect.height / 2;
  }

  etiquetaGanancia(container, startX, startY - 10, amount);

  const terminar = () => {
    if (document.body.contains(container)) document.body.removeChild(container);
    window.dispatchEvent(new CustomEvent('coins-animation-end'));
  };

  // Sin movimiento (o sin Web Animations): las monedas "llegan" sin volar.
  if (sinMovimiento() || !container.animate) {
    for (let i = 0; i < numCoins; i += 1) {
      window.dispatchEvent(new CustomEvent('coin-reached-target', { detail: { amount: amoutPerCoin } }));
    }
    playCoinSound();
    setTimeout(terminar, 1200);
    return;
  }

  const separacion = 85;
  let llegadas = 0;
  for (let i = 0; i < numCoins; i += 1) {
    const coin = document.createElement('img');
    coin.src = MONEDA_SRC;
    coin.alt = '';
    coin.setAttribute('aria-hidden', 'true');
    Object.assign(coin.style, {
      position: 'absolute', left: `${startX}px`, top: `${startY}px`, width: '2.1rem', height: '2.1rem',
      marginLeft: '-1.05rem', marginTop: '-1.05rem', opacity: '0', willChange: 'transform, opacity',
      filter: 'drop-shadow(0 4px 6px rgba(146, 64, 14, 0.35))',
    });
    container.appendChild(coin);

    // Abanico: cada moneda sale con su ángulo hacia arriba.
    const abanico = numCoins === 1 ? 0 : ((i / (numCoins - 1)) - 0.5) * 1.6;
    const fuerza = 60 + Math.random() * 30;
    const sx = Math.sin(abanico) * fuerza;
    const sy = -Math.cos(abanico) * fuerza - 18;
    const dx = targetX - startX;
    const dy = targetY - startY;
    // Curva: un punto de control por encima del camino (arco).
    const cx = sx + (dx - sx) * 0.35;
    // Arco por encima del camino, sin salirse por arriba de la pantalla.
    const cy = Math.max(Math.min(sy, dy) - 120 - Math.random() * 60, 24 - startY);
    const punto = (k) => {
      const u = 1 - k;
      return [u * u * sx + 2 * u * k * cx + k * k * dx, u * u * sy + 2 * u * k * cy + k * k * dy];
    };
    const giros = 2 + Math.round(Math.random());
    const marcos = [
      { opacity: 0, transform: 'translate(0px, 0px) scale(0.2) rotateY(0deg)', offset: 0 },
      { opacity: 1, transform: `translate(${sx}px, ${sy}px) scale(1.15) rotateY(180deg)`, offset: 0.28 },
    ];
    for (let k = 1; k <= 6; k += 1) {
      const [x, y] = punto(k / 6);
      marcos.push({
        opacity: 1,
        transform: `translate(${x}px, ${y}px) scale(${1.15 - (0.6 * k) / 6}) rotateY(${180 + (giros * 360 * k) / 6}deg)`,
        offset: 0.28 + (0.72 * k) / 6 - (k === 6 ? 0 : 0.0001),
      });
    }
    marcos[marcos.length - 1].offset = 1;
    const anim = coin.animate(marcos, {
      duration: 1050 + Math.random() * 150,
      delay: i * separacion,
      easing: 'cubic-bezier(0.45, 0.05, 0.35, 1)',
      fill: 'forwards',
    });
    anim.onfinish = () => {
      coin.remove();
      llegadas += 1;
      playCoinSound();
      latir(targetEl);
      window.dispatchEvent(new CustomEvent('coin-reached-target', { detail: { amount: amoutPerCoin } }));
      if (llegadas === numCoins) setTimeout(terminar, 120);
    };
  }
};

/**
 * Anima las monedas ganadas volando hasta el contador de la cabecera.
 *
 * Es la ÚNICA forma correcta de avisar de que se han ganado monedas. Varias
 * pantallas lanzaban a mano el evento 'coins-animation-start' sin hacer volar
 * nada, y eso dejaba el contador roto: ese evento solo RESERVA monedas
 * (pendingCoinsRef) y el número sube cuando cada moneda aterriza
 * ('coin-reached-target'). Sin vuelo no hay aterrizaje ni cierre, así que la
 * reserva se quedaba en pie para siempre y el header dejaba de sincronizarse
 * con el saldo real hasta recargar la página.
 *
 * @param {Element|{currentTarget:Element}|null} origen Elemento (o evento) del
 *   que salen las monedas: normalmente el botón que se acaba de pulsar. Si no
 *   se puede ubicar, salen del centro de la pantalla.
 * @param {number} cantidad Monedas ganadas.
 */
export const volarMonedasGanadas = (origen, cantidad = 1) => {
  const n = Number(cantidad);
  if (!Number.isFinite(n) || n <= 0) return;

  const el = origen && origen.currentTarget ? origen.currentTarget : origen;
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  try {
    if (el && typeof el.getBoundingClientRect === 'function') {
      const r = el.getBoundingClientRect();
      // Un elemento oculto o desmontado da un rectángulo de 0x0: ahí es mejor
      // el centro de la pantalla que la esquina superior izquierda.
      if (r.width > 0 || r.height > 0) {
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
      }
    }
  } catch { /* elemento ya desmontado */ }

  showFlyingCoins(x, y, n);
};
