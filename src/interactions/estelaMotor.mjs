// Motor del brillo mágico del dedo. Solo dibuja en un contexto 2D: no toca la
// página, así que corre igual en un Worker (OffscreenCanvas, ver
// estelaWorker.mjs) que en el hilo principal (el respaldo de estelaMagica.mjs).
//
//  - Mantener el dedo: un orbe de luz violeta que respira, con cuatro destellos
//    girando alrededor. Aparece a los 70 ms (el roce rápido deja actuar al kit).
//  - Soltar tras mantener: el orbe se abre y estalla en destellos.
//  - Deslizar: el orbe se apaga y sus destellos salen volando; queda la estela,
//    una raya que se afina y se apaga detrás, con destellos ✦, puntos y a veces
//    un corazón (los garabatos de los banners de Walá). Al soltar, un puñado más.
//
// Liviano: sin desenfoques (el brillo son degradados y una cinta ancha y tenue
// bajo otra fina), las formas son Path2D hechos una vez, solo se borra lo que
// se pintó y el bucle corre solo mientras queda algo vivo.

const VIDA_RAYA = 420;
const VIDA_DESTELLO = 680;
const ANCHO = 7;
const CADA_PX = 22;
const MAX_DESTELLOS = 48;
const RETRASO_ORBE = 70;
const ENTRADA_ORBE = 220;
const SALIDA_ORBE = 260;
const APAGADO_ORBE = 140;
const RADIO_ORBE = 20;
const ORBITA = 27;

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
const salirConRebote = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

// Formas de radio 1, hechas una vez; se escalan con la transformación.
const conPath2D = typeof Path2D === 'function';
const trazarEstrella = (p) => {
  const c = 0.28;
  p.moveTo(0, -1);
  p.quadraticCurveTo(c, -c, 1, 0);
  p.quadraticCurveTo(c, c, 0, 1);
  p.quadraticCurveTo(-c, c, -1, 0);
  p.quadraticCurveTo(-c, -c, 0, -1);
};
const trazarCorazon = (p) => {
  p.moveTo(0, 0.72);
  p.bezierCurveTo(-1.04, 0, -0.56, -0.88, 0, -0.28);
  p.bezierCurveTo(0.56, -0.88, 1.04, 0, 0, 0.72);
};
const FORMAS = conPath2D ? (() => {
  const estrella = new Path2D(); trazarEstrella(estrella);
  const corazon = new Path2D(); trazarCorazon(corazon);
  const punto = new Path2D(); punto.arc(0, 0, 0.4, 0, Math.PI * 2);
  return { estrella, corazon, punto };
})() : null;
const rellenarForma = (ctx, forma) => {
  if (FORMAS) { ctx.fill(FORMAS[forma]); return; }
  ctx.beginPath();
  if (forma === 'estrella') trazarEstrella(ctx);
  else if (forma === 'corazon') trazarCorazon(ctx);
  else ctx.arc(0, 0, 0.4, 0, Math.PI * 2);
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
  const n = pts.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x; const dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1;
    const m = anchos[i] / 2;
    if (i === 0) ctx.moveTo(pts[i].x - (dy / d) * m, pts[i].y + (dx / d) * m);
    else ctx.lineTo(pts[i].x - (dy / d) * m, pts[i].y + (dx / d) * m);
  }
  const punta = pts[n - 1]; const cerca = pts[n - 2];
  const angulo = Math.atan2(punta.y - cerca.y, punta.x - cerca.x);
  // De la izquierda (ángulo + 90°) a la derecha (- 90°) pasando por delante.
  ctx.arc(punta.x, punta.y, anchos[n - 1] / 2, angulo + Math.PI / 2, angulo - Math.PI / 2, true);
  for (let i = n - 1; i >= 0; i--) {
    const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x; const dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1;
    const m = anchos[i] / 2;
    ctx.lineTo(pts[i].x + (dy / d) * m, pts[i].y - (dx / d) * m);
  }
  ctx.closePath();
  ctx.fill();
};

/**
 * @param {object} o
 *  - lienzo: canvas u OffscreenCanvas · ahora(): reloj en ms
 *  - pedirMarco(fn) / cancelarMarco(id): requestAnimationFrame o su respaldo
 */
export function crearMotor({ lienzo, ahora, pedirMarco, cancelarMarco }) {
  const ctx = lienzo.getContext('2d');
  let escala = 1;
  let marco = 0;
  let puntos = [];
  let destellos = [];
  let orbe = null;
  let tonos = TONOS.claro;
  let recorrido = 0;
  let largo = 0;
  let sucia = null;

  const soltarDestello = (x, y, dx, dy, fuerza = 1) => {
    if (destellos.length >= MAX_DESTELLOS) destellos.shift();
    const d = Math.hypot(dx, dy) || 1;
    // Al costado de la raya (perpendicular), un poco al azar.
    const lado = fuerza > 1 ? 0 : azar(-11, 11);
    destellos.push({
      x: x + (-dy / d) * lado, y: y + (dx / d) * lado,
      vx: (-dx / d) * azar(0.01, 0.04) * fuerza + azar(-0.015, 0.015),
      vy: (-dy / d) * azar(0.01, 0.04) * fuerza - azar(0.01, 0.035),
      r: azar(3.2, 7) * (fuerza > 1 ? 1.15 : 1),
      giro: azar(0, Math.PI), vg: azar(-0.004, 0.004),
      color: tonos.destellos[(Math.random() * tonos.destellos.length) | 0],
      forma: Math.random() < 0.12 ? 'corazon' : Math.random() < 0.25 ? 'punto' : 'estrella',
      nace: ahora(),
    });
  };

  // Posición de los destellos que giran alrededor del orbe.
  const orbitales = (o, t) => {
    const giro = (t - o.t0) * 0.0012;
    return [0, 1, 2, 3].map((k) => {
      const a = giro + k * (Math.PI / 2) + (k % 2 ? 0.35 : 0);
      const radio = ORBITA * (k % 2 ? 0.86 : 1);
      return { x: o.x + Math.cos(a) * radio, y: o.y + Math.sin(a) * radio, a, k };
    });
  };
  // Los destellos del orbe se sueltan y siguen su vuelo (al deslizar o soltar).
  const liberarOrbitales = (o, t, fuerza) => {
    for (const p of orbitales(o, t)) {
      const tx = -Math.sin(p.a); const ty = Math.cos(p.a);
      soltarDestello(p.x, p.y, -tx, -ty, fuerza);
    }
  };

  const borrar = () => {
    if (sucia) ctx.clearRect(sucia.x0, sucia.y0, sucia.x1 - sucia.x0, sucia.y1 - sucia.y0);
    sucia = null;
  };

  const dibujar = () => {
    marco = 0;
    const t = ahora();
    puntos = puntos.filter((p) => t - p.t < VIDA_RAYA);
    destellos = destellos.filter((d) => t - d.nace < VIDA_DESTELLO);

    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.globalAlpha = 1;
    borrar();
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
          const vida = Math.max(0, 1 - (t - p.t) / VIDA_RAYA);
          return ANCHO * grosor * vida ** 0.8 * Math.min(1, (k + 1) / 6);
        });
        const relleno = ctx.createLinearGradient(cola.x, cola.y, punta.x, punta.y);
        relleno.addColorStop(0, `rgba(${tono}, 0)`);
        relleno.addColorStop(1, `rgba(${tono}, ${alfa})`);
        ctx.fillStyle = relleno;
        cinta(ctx, linea, anchos);
      }
      for (const p of linea) abarcar(p.x, p.y, ANCHO * 1.7 + 2);
    }

    // El orbe del dedo apoyado.
    if (orbe) {
      const o = orbe;
      const desde = o.t0 + RETRASO_ORBE;
      let tam = 0; let op = 0;
      if (o.fin == null) {
        if (t >= desde) { const a = Math.min(1, (t - desde) / ENTRADA_ORBE); tam = salirConRebote(a); op = Math.min(1, a * 1.6); }
      } else {
        const dur = o.como === 'soltar' ? SALIDA_ORBE : APAGADO_ORBE;
        const p = Math.min(1, (t - o.fin) / dur);
        tam = o.tamFin * (o.como === 'soltar' ? 1 + 0.7 * p : 1 - 0.3 * p);
        op = o.opFin * (1 - p);
        if (p >= 1) orbe = null;
      }
      if (orbe && op > 0) {
        const respira = 1 + 0.06 * Math.sin(((t - o.t0) / 1400) * Math.PI * 2);
        const r = RADIO_ORBE * tam * respira;
        const luz = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r * 1.7);
        luz.addColorStop(0, `rgba(${tonos.centro[0]}, ${op})`);
        luz.addColorStop(0.14, `rgba(${tonos.centro[0]}, ${0.9 * op})`);
        luz.addColorStop(0.26, `rgba(${tonos.halo}, ${0.6 * op})`);
        luz.addColorStop(0.55, `rgba(${tonos.halo}, ${0.24 * op})`);
        luz.addColorStop(1, `rgba(${tonos.halo}, 0)`);
        ctx.fillStyle = luz;
        ctx.beginPath();
        ctx.arc(o.x, o.y, r * 1.7, 0, Math.PI * 2);
        ctx.fill();
        // Un aro fino al soltar: la onda del toque.
        if (o.como === 'soltar') {
          ctx.strokeStyle = `rgba(${tonos.halo}, ${0.55 * op})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(o.x, o.y, r * 1.25, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (o.fin == null) {
          for (const p of orbitales(o, t)) {
            // Parpadean sin apagarse del todo (de 0,6 a 1).
            const brillo = 0.8 + 0.2 * Math.sin(t / 260 + p.k * 1.7);
            const lado = (3.4 + (p.k % 2 ? 1.2 : 2.6)) * brillo * Math.min(1, tam);
            const c = Math.cos(p.a); const s = Math.sin(p.a);
            ctx.globalAlpha = op;
            ctx.fillStyle = tonos.destellos[p.k];
            ctx.setTransform(escala * c * lado, escala * s * lado, -escala * s * lado, escala * c * lado, escala * p.x, escala * p.y);
            rellenarForma(ctx, 'estrella');
          }
          ctx.setTransform(escala, 0, 0, escala, 0, 0);
          ctx.globalAlpha = 1;
          o.tamVivo = tam; o.opVivo = op;
        }
        abarcar(o.x, o.y, r * 1.7 * 1.7 + ORBITA + 8);
      }
    }

    // Destellos: crecen rápido, brillan y se achican mientras flotan.
    for (const d of destellos) {
      const vida = (t - d.nace) / VIDA_DESTELLO;
      const paso = t - d.nace;
      const tam = d.r * (vida < 0.25 ? vida / 0.25 : 1 - ((vida - 0.25) / 0.75) ** 1.6);
      if (tam <= 0.2) continue;
      const x = d.x + d.vx * paso; const y = d.y + d.vy * paso;
      const g = d.giro + d.vg * paso;
      const c = Math.cos(g) * tam; const s = Math.sin(g) * tam;
      ctx.globalAlpha = vida < 0.7 ? 1 : 1 - (vida - 0.7) / 0.3;
      ctx.fillStyle = d.color;
      ctx.setTransform(escala * c, escala * s, -escala * s, escala * c, escala * x, escala * y);
      rellenarForma(ctx, d.forma);
      abarcar(x, y, d.r + 2);
    }
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.globalAlpha = 1;

    sucia = Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
    if (orbe || puntos.length > 1 || destellos.length) marco = pedirMarco(dibujar);
    else borrar();
  };
  const pedirDibujo = () => { if (!marco) marco = pedirMarco(dibujar); };

  const terminarOrbe = (como) => {
    if (!orbe || orbe.fin != null) return;
    const t = ahora();
    // Aún no se veía (toque rápido): se va sin dibujar nada.
    if (t < orbe.t0 + RETRASO_ORBE) { orbe = null; return; }
    orbe.fin = t;
    orbe.como = como;
    orbe.tamFin = orbe.tamVivo ?? 1;
    orbe.opFin = orbe.opVivo ?? 1;
    if (como === 'soltar') {
      liberarOrbitales(orbe, t, 1.6);
      for (let i = 0; i < 3; i++) soltarDestello(orbe.x, orbe.y, azar(-1, 1), azar(-1, 1), 2.2);
    } else if (como === 'deslizar') {
      liberarOrbitales(orbe, t, 1.2);
    }
  };

  return {
    tamano(ancho, alto, dpr) {
      escala = dpr;
      lienzo.width = Math.round(ancho * dpr);
      lienzo.height = Math.round(alto * dpr);
      sucia = null;
    },
    presionar(x, y, oscuro) {
      tonos = oscuro ? TONOS.oscuro : TONOS.claro;
      orbe = { x, y, t0: ahora(), fin: null };
      pedirDibujo();
    },
    empezar(x, y) {
      terminarOrbe('deslizar');
      puntos = [{ x, y, t: ahora() }];
      recorrido = 0;
      largo = 0;
      pedirDibujo();
    },
    agregar(x, y) {
      const ultimo = puntos[puntos.length - 1];
      const t = ahora();
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
    soltar() {
      terminarOrbe('soltar');
      const ultimo = puntos[puntos.length - 1];
      const anterior = puntos[puntos.length - 2];
      // El remate del hechizo: unos destellos donde se levantó el dedo.
      if (ultimo && anterior && largo > 60) {
        for (let i = 0; i < 4; i++) soltarDestello(ultimo.x, ultimo.y, azar(-1, 1), azar(-1, 1), 2.2);
      }
      largo = 0;
      pedirDibujo();
    },
    cancelar() {
      terminarOrbe('cancelar');
      largo = 0;
      pedirDibujo();
    },
    limpiar() {
      puntos = [];
      destellos = [];
      orbe = null;
      if (marco) { cancelarMarco(marco); marco = 0; }
      ctx.setTransform(escala, 0, 0, escala, 0, 0);
      borrar();
    },
  };
}
