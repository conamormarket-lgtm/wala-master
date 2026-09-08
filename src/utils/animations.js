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

export const showFlyingCoins = (startX, startY, amount = 10) => {
  // Aseguramos que la cantidad de monedas visuales sea razonable (10 representara a las 10 monedas)
  const numCoins = Math.min(amount, 10);
  const amoutPerCoin = amount / numCoins;
  
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  document.body.appendChild(container);

  // Notify header to expect incoming coins
  window.dispatchEvent(new CustomEvent('coins-animation-start', { detail: { amount } }));

  // Buscamos el .global-coins-target visible (desktop y mobile tienen la clase, pero solo uno es visible)
  const candidates = document.querySelectorAll('.global-coins-target');
  let targetEl = null;
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      targetEl = el;
      break;
    }
  }
  if (!targetEl) targetEl = document.querySelector('header');
  let targetX = window.innerWidth - 100;
  let targetY = 30;

  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    targetX = rect.left + rect.width / 2;
    targetY = rect.top + rect.height / 2;
  }

  // Animation constants for "one by one"
  const staggerDelay = 120; // 120ms between each coin leaving
  const totalDuration = numCoins * staggerDelay + 1500;

  for (let i = 0; i < numCoins; i++) {
    setTimeout(() => {
      const coin = document.createElement('div');
      coin.textContent = '🪙';
      coin.style.position = 'absolute';
      coin.style.left = `${startX}px`;
      coin.style.top = `${startY}px`;
      coin.style.fontSize = '2.2rem';
      coin.style.opacity = '0';
      coin.style.transform = `translate(-50%, -50%) scale(0.1)`;
      container.appendChild(coin);

      // Movimiento inicial: saltito aleatorio
      const angle = (Math.random() - 0.5) * Math.PI; 
      const velocity = 50 + Math.random() * 40;
      const midX = startX + Math.sin(angle) * velocity;
      const midY = startY - Math.cos(angle) * velocity - 20;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Fase 1: Explode out
          coin.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          coin.style.opacity = '1';
          coin.style.transform = `translate(${midX - startX}px, ${midY - startY}px) scale(1.2)`;
          
          // Fase 2: Fly to target
          setTimeout(() => {
            coin.style.transition = 'all 0.45s cubic-bezier(0.55, 0.085, 0.68, 0.53)';
            coin.style.transform = `translate(${targetX - startX}px, ${targetY - startY}px) scale(0.6)`;
            
            // Llegó al objetivo
            setTimeout(() => {
              coin.style.opacity = '0';
              // Play sound and increment visual counter
              playCoinSound();
              window.dispatchEvent(new CustomEvent('coin-reached-target', { detail: { amount: amoutPerCoin } }));
            }, 400); 
          }, 350); 
        });
      });
    }, i * staggerDelay);
  }

  // Limpiar DOM al finalizar
  setTimeout(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
    window.dispatchEvent(new CustomEvent('coins-animation-end'));
  }, totalDuration);
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
