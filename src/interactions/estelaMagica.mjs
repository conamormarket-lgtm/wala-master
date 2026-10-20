// Estela mágica: al deslizar el dedo queda una raya violeta que se afina y se
// apaga detrás de él, con destellos ✦ (y a veces un corazón, los garabatos de
// los banners de Walá) que brillan y se van. Al soltar, un puñado de destellos.
//
// Liviana a propósito: un solo <canvas> fijo, sin desenfoques (el "brillo" es
// una raya ancha y tenue debajo de otra fina), y el bucle de dibujo corre solo
// mientras queda algo vivo. No va pegada bajo el dedo: une los puntos por
// donde pasó, así que si el hilo principal se atrasa no salta, solo dibuja.

const VIDA_RAYA = 420;
const VIDA_DESTELLO = 680;
const ANCHO = 7;
const CADA_PX = 22;
const MAX_DESTELLOS = 48;
const MAX_ESCALA = 2;

const TONOS = {
  claro: {
    halo: '168, 85, 247', centro: ['124, 58, 237', '168, 85, 247'],
    destellos: ['#a855f7', '#ec4899', '#f59e0b', '#7c3aed', '#c026d3'],
  },
  oscuro: {
    halo: '168, 85, 247', centro: ['245, 243, 255', '233, 213, 255'],
    destellos: ['#ffffff', '#f0abfc', '#fde68a', '#c4b5fd', '#f9a8d4'],
  },
};

const azar = (min, max) => min + Math.random() * (max - min);

// ✦ de cuatro puntas, centrado en 0,0 y de radio r.
const estrella = (ctx, r) => {
  const c = r * 0.28;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(c, -c, r, 0);
  ctx.quadraticCurveTo(c, c, 0, r);
  ctx.quadraticCurveTo(-c, c, -r, 0);
  ctx.quadraticCurveTo(-c, -c, 0, -r);
  ctx.fill();
};

const corazon = (ctx, r) => {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.9);
  ctx.bezierCurveTo(-r * 1.3, 0, -r * 0.7, -r * 1.1, 0, -r * 0.35);
  ctx.bezierCurveTo(r * 0.7, -r * 1.1, r * 1.3, 0, 0, r * 0.9);
  ctx.fill();
};

// Puntos intermedios (Catmull-Rom) cada ~6 px entre los toques que llegan.
const suavizar = (pts) => {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[i + 2] || p2;
    const n = Math.min(8, Math.max(1, Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 6)));
    for (let k = 1; k <= n; k++) {
      const t = k / n; const t2 = t * t; const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (p2.x - p0.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (3 * p1.x - p0.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (p2.y - p0.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (3 * p1.y - p0.y - 3 * p2.y + p3.y) * t3),
        t: p1.t + (p2.t - p1.t) * t,
      });
    }
  }
  return out;
};

// Rellena la cinta: un borde de ida, la punta redonda y el otro de vuelta.
const cinta = (ctx, pts, anchos) => {
  const izq = []; const der = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x; const dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d; const ny = dx / d; const m = anchos[i] / 2;
    izq.push([pts[i].x + nx * m, pts[i].y + ny * m]);
    der.push([pts[i].x - nx * m, pts[i].y - ny * m]);
  }
  const punta = pts[pts.length - 1]; const cerca = pts[pts.length - 2];
  ctx.beginPath();
  ctx.moveTo(izq[0][0], izq[0][1]);
  for (let i = 1; i < izq.length; i++) ctx.lineTo(izq[i][0], izq[i][1]);
  const angulo = Math.atan2(punta.y - cerca.y, punta.x - cerca.x);
  // De la izquierda (ángulo + 90°) a la derecha (- 90°) pasando por delante.
  ctx.arc(punta.x, punta.y, anchos[anchos.length - 1] / 2, angulo + Math.PI / 2, angulo - Math.PI / 2, true);
  for (let i = der.length - 1; i >= 0; i--) ctx.lineTo(der[i][0], der[i][1]);
  ctx.closePath();
  ctx.fill();
};

export function crearEstela(view = window) {
  const doc = view.document;
  let canvas = null;
  let ctx = null;
  let escala = 1;
  let marco = 0;
  let puntos = [];
  let destellos = [];
  let tonos = TONOS.claro;
  let recorrido = 0;
  let largo = 0;
  let sucia = null;

  const medir = () => {
    if (!canvas) return;
    escala = Math.min(view.devicePixelRatio || 1, MAX_ESCALA);
    canvas.width = Math.round(view.innerWidth * escala);
    canvas.height = Math.round(view.innerHeight * escala);
    canvas.style.width = `${view.innerWidth}px`;
    canvas.style.height = `${view.innerHeight}px`;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    sucia = null;
  };
  const asegurarLienzo = () => {
    if (canvas) return;
    canvas = doc.createElement('canvas');
    canvas.className = 'wala-touch-estela';
    canvas.setAttribute('aria-hidden', 'true');
    doc.body.append(canvas);
    ctx = canvas.getContext('2d');
    medir();
  };

  const soltarDestello = (x, y, dx, dy, fuerza = 1) => {
    if (destellos.length >= MAX_DESTELLOS) destellos.shift();
    const d = Math.hypot(dx, dy) || 1;
    // Al costado de la raya (perpendicular), un poco al azar.
    const lado = azar(-11, 11);
    destellos.push({
      x: x + (-dy / d) * lado, y: y + (dx / d) * lado,
      vx: (-dx / d) * azar(0.01, 0.04) * fuerza + azar(-0.015, 0.015),
      vy: (-dy / d) * azar(0.01, 0.04) * fuerza - azar(0.01, 0.035),
      r: azar(3.2, 7) * (fuerza > 1 ? 1.15 : 1),
      giro: azar(0, Math.PI), vg: azar(-0.004, 0.004),
      color: tonos.destellos[(Math.random() * tonos.destellos.length) | 0],
      forma: Math.random() < 0.12 ? 'corazon' : Math.random() < 0.25 ? 'punto' : 'estrella',
      nace: view.performance.now(),
    });
  };

  const dibujar = () => {
    marco = 0;
    const ahora = view.performance.now();
    puntos = puntos.filter((p) => ahora - p.t < VIDA_RAYA);
    destellos = destellos.filter((d) => ahora - d.nace < VIDA_DESTELLO);

    // Borra solo lo que se pintó el cuadro anterior.
    if (sucia) ctx.clearRect(sucia.x0, sucia.y0, sucia.x1 - sucia.x0, sucia.y1 - sucia.y0);
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    const abarcar = (x, y, m) => {
      if (x - m < x0) x0 = x - m; if (y - m < y0) y0 = y - m;
      if (x + m > x1) x1 = x + m; if (y + m > y1) y1 = y + m;
    };

    // La raya: una cinta rellena de una vez (con tramos sueltos y
    // transparencia, cada unión se veía como una perla), de la cola vieja,
    // fina y transparente a la punta nueva y gruesa. El centro pasa por una
    // curva suave (Catmull-Rom) aunque los toques lleguen separados.
    const linea = suavizar(puntos);
    if (linea.length > 1) {
      const cola = linea[0]; const punta = linea[linea.length - 1];
      for (const [grosor, tono, alfa] of [[3.2, tonos.halo, 0.3], [0.55, tonos.centro[0], 0.95]]) {
        const anchos = linea.map((p, k) => {
          const vida = Math.max(0, 1 - (ahora - p.t) / VIDA_RAYA);
          return ANCHO * grosor * vida ** 0.8 * Math.min(1, (k + 1) / 6);
        });
        const relleno = ctx.createLinearGradient(cola.x, cola.y, punta.x, punta.y);
        relleno.addColorStop(0, `rgba(${tono}, 0)`);
        relleno.addColorStop(1, `rgba(${tono}, ${alfa})`);
        ctx.fillStyle = relleno;
        cinta(ctx, linea, anchos);
      }
      for (const p of linea) abarcar(p.x, p.y, ANCHO * 1.6 + 2);
    }

    // Destellos: crecen rápido, brillan y se achican mientras flotan.
    for (const d of destellos) {
      const t = (ahora - d.nace) / VIDA_DESTELLO;
      const paso = ahora - d.nace;
      const tam = d.r * (t < 0.25 ? t / 0.25 : 1 - ((t - 0.25) / 0.75) ** 1.6);
      if (tam <= 0.2) continue;
      const x = d.x + d.vx * paso; const y = d.y + d.vy * paso;
      ctx.save();
      ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      ctx.translate(x, y);
      ctx.rotate(d.giro + d.vg * paso);
      ctx.fillStyle = d.color;
      if (d.forma === 'estrella') estrella(ctx, tam);
      else if (d.forma === 'corazon') corazon(ctx, tam * 0.8);
      else { ctx.beginPath(); ctx.arc(0, 0, tam * 0.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      abarcar(x, y, d.r + 2);
    }

    sucia = Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
    if (puntos.length > 1 || destellos.length) marco = view.requestAnimationFrame(dibujar);
    else if (sucia) { ctx.clearRect(sucia.x0, sucia.y0, sucia.x1 - sucia.x0, sucia.y1 - sucia.y0); sucia = null; }
  };
  const pedirDibujo = () => { if (!marco) marco = view.requestAnimationFrame(dibujar); };

  return {
    empezar(x, y) {
      asegurarLienzo();
      tonos = doc.documentElement.getAttribute('data-theme') === 'dark' ? TONOS.oscuro : TONOS.claro;
      puntos = [{ x, y, t: view.performance.now() }];
      recorrido = 0;
      largo = 0;
    },
    agregar(x, y) {
      const ultimo = puntos[puntos.length - 1];
      const t = view.performance.now();
      if (!ultimo) { puntos.push({ x, y, t }); return; }
      const dx = x - ultimo.x; const dy = y - ultimo.y;
      const paso = Math.hypot(dx, dy);
      if (paso < 1.5) return;
      puntos.push({ x, y, t });
      recorrido += paso;
      largo += paso;
      while (recorrido >= CADA_PX) {
        recorrido -= CADA_PX;
        const k = 1 - recorrido / paso;
        soltarDestello(ultimo.x + dx * k, ultimo.y + dy * k, dx, dy);
      }
      pedirDibujo();
    },
    terminar() {
      const ultimo = puntos[puntos.length - 1];
      const anterior = puntos[puntos.length - 2];
      // El remate del hechizo: unos destellos donde se levantó el dedo.
      if (ultimo && anterior && largo > 60) {
        for (let i = 0; i < 4; i++) soltarDestello(ultimo.x, ultimo.y, azar(-1, 1), azar(-1, 1), 2.2);
      }
      largo = 0;
      pedirDibujo();
    },
    limpiar() {
      puntos = [];
      destellos = [];
      if (marco) { view.cancelAnimationFrame(marco); marco = 0; }
      if (ctx && sucia) ctx.clearRect(sucia.x0, sucia.y0, sucia.x1 - sucia.x0, sucia.y1 - sucia.y0);
      sucia = null;
    },
    medir,
    quitar() {
      this.limpiar();
      canvas?.remove();
      canvas = null;
      ctx = null;
    },
  };
}
