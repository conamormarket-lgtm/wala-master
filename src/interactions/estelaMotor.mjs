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
//
// En las páginas pesadas los toques llegan tarde y en lotes (el hilo principal
// los entrega cuando se desocupa). Por eso cada toque trae la hora en que pasó
// (no la de llegada) y la punta no salta al último: lo persigue un poco detrás
// y, si quedó atrás, recorre el hueco más rápido. Si los cuadros tardan, baja
// la calidad (menos destellos, sin la cinta ancha).

const VIDA_RAYA = 420;
const VIDA_DESTELLO = 680;
const ANCHO = 7;
// Un toque que llega más tarde que esto se toma como de hace TARDE_MAX ms.
const TARDE_MAX = 160;
// La punta va ~RETRASO_PUNTA ms detrás del último toque; para alcanzarlo corre
// hasta PRISA_MAX veces más rápido. Simulado a 1 px/ms con toques en lotes de
// 100 ms: el mayor salto por cuadro baja de 112 px a 48 px, y con toques
// fluidos la punta va a ~8 px del dedo (con 40 ms iba a 23).
const RETRASO_PUNTA = 24;
const PRISA_MAX = 3;
const CALIDAD = {
  alta: { maxDestellos: 48, cadaPx: 22, halo: true },
  baja: { maxDestellos: 20, cadaPx: 34, halo: false },
};
// Promedio de ms por cuadro para bajar o volver a subir la calidad.
const MS_LENTO = 24;
const MS_FLUIDO = 17;
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

// Puntos intermedios (Catmull-Rom) cada ~6 px entre los toques que llegan
// (`vista`: cuándo los alcanzó la punta; de eso depende cómo se apagan).
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
        vista: p1.vista + (p2.vista - p1.vista) * t,
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
  // { x, y, t: hora del toque, vista: hora en que la punta pasó por ahí }
  let puntos = [];
  let destellos = [];
  let orbe = null;
  let tonos = TONOS.claro;
  let cabeza = 0; // la hora de toque por la que va la punta
  let punta = null; // dónde quedó la punta en el cuadro anterior
  let recorrido = 0;
  let largo = 0;
  let remate = false;
  let sucia = null;
  let ultimoMarco = null;
  let msMarco = 16;
  let calidad = CALIDAD.alta;

  // La hora de un toque, en el reloj del motor: nunca en el futuro ni más
  // vieja que TARDE_MAX (un lote muy atrasado se aprieta en ese margen).
  const horaDe = (t) => {
    const ya = ahora();
    return Math.min(ya, Math.max(Number.isFinite(t) ? t : ya, ya - TARDE_MAX));
  };

  const soltarDestello = (x, y, dx, dy, fuerza = 1) => {
    while (destellos.length >= calidad.maxDestellos) destellos.shift();
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

  // La punta persigue al último toque (ver arriba). Devuelve los puntos ya
  // alcanzados más la punta, o null si no hay raya.
  const avanzarPunta = (t, dt) => {
    if (!puntos.length) return null;
    const ultimo = puntos[puntos.length - 1];
    const antes = cabeza;
    const atraso = ultimo.t - cabeza;
    if (atraso > 0) cabeza = Math.min(ultimo.t, cabeza + dt * Math.min(PRISA_MAX, Math.max(0.3, atraso / RETRASO_PUNTA)));
    // Cada toque alcanzado anota cuándo (repartido dentro del cuadro).
    for (const p of puntos) {
      if (p.vista != null) continue;
      if (p.t > cabeza) break;
      p.vista = cabeza > antes ? t - dt * ((cabeza - p.t) / (cabeza - antes)) : t;
    }
    let i = puntos.length - 1;
    while (i > 0 && puntos[i].t > cabeza) i -= 1;
    const a = puntos[i];
    const b = puntos[i + 1];
    const k = b ? (cabeza - a.t) / (b.t - a.t) : 0;
    // Quieta en el último toque, la punta se apaga con él (si no, quedaría un punto encendido).
    const nueva = b ? { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, vista: t } : { x: a.x, y: a.y, vista: a.vista };

    // Los destellos salen por donde pasa la punta, no por donde llegan los toques.
    if (punta) {
      const dx = nueva.x - punta.x; const dy = nueva.y - punta.y;
      const paso = Math.hypot(dx, dy);
      if (paso > 0) {
        recorrido += paso;
        while (recorrido >= calidad.cadaPx) {
          recorrido -= calidad.cadaPx;
          const f = 1 - recorrido / paso;
          soltarDestello(punta.x + dx * f, punta.y + dy * f, dx, dy);
        }
      }
    }
    punta = nueva;
    // El remate del hechizo, cuando la punta llega adonde se levantó el dedo.
    if (remate && !b) {
      remate = false;
      for (let n = 0; n < 4; n++) soltarDestello(nueva.x, nueva.y, azar(-1, 1), azar(-1, 1), 2.2);
    }

    // Se olvida lo ya apagado, menos el último alcanzado (de ahí sale la punta).
    let fuera = 0;
    while (fuera < i && t - puntos[fuera].vista >= VIDA_RAYA) fuera += 1;
    if (fuera) { puntos = puntos.slice(fuera); i -= fuera; }
    if (!b && t - a.vista >= VIDA_RAYA) { puntos = []; punta = null; return null; }
    const visibles = puntos.slice(0, i + 1);
    if (b) visibles.push(nueva);
    return visibles;
  };

  // Si los cuadros tardan (página pesada, celular lento), menos trabajo.
  const medirCalidad = (dt) => {
    msMarco = msMarco * 0.9 + dt * 0.1;
    if (calidad === CALIDAD.alta && msMarco > MS_LENTO) calidad = CALIDAD.baja;
    else if (calidad === CALIDAD.baja && msMarco < MS_FLUIDO) calidad = CALIDAD.alta;
  };

  const dibujar = () => {
    marco = 0;
    const t = ahora();
    const dt = ultimoMarco == null ? 16 : Math.min(50, t - ultimoMarco);
    if (ultimoMarco != null) medirCalidad(dt);
    ultimoMarco = t;
    destellos = destellos.filter((d) => t - d.nace < VIDA_DESTELLO);
    const visibles = avanzarPunta(t, dt);

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
    const linea = visibles ? suavizar(visibles) : [];
    if (linea.length > 1) {
      const cola = linea[0]; const extremo = linea[linea.length - 1];
      const pasadas = calidad.halo ? [[3.2, tonos.halo, 0.3], [0.55, tonos.centro[0], 0.95]] : [[0.55, tonos.centro[0], 0.95]];
      for (const [grosor, tono, alfa] of pasadas) {
        const anchos = linea.map((p, k) => {
          const vida = Math.max(0, 1 - (t - p.vista) / VIDA_RAYA);
          return ANCHO * grosor * vida ** 0.8 * Math.min(1, (k + 1) / 6);
        });
        const relleno = ctx.createLinearGradient(cola.x, cola.y, extremo.x, extremo.y);
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
    if (orbe || puntos.length || destellos.length) marco = pedirMarco(dibujar);
    else { borrar(); ultimoMarco = null; }
  };
  const pedirDibujo = () => { if (!marco) marco = pedirMarco(dibujar); };

  // tEvento: cuándo pasó (el toque puede llegar tarde); la salida se anima desde ahora.
  const terminarOrbe = (como, tEvento) => {
    if (!orbe || orbe.fin != null) return;
    const t = ahora();
    // Aún no se veía (toque rápido): se va sin dibujar nada.
    if (horaDe(tEvento) < orbe.t0 + RETRASO_ORBE) { orbe = null; return; }
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
    // t: la hora del toque en el reloj del motor (sin ella, la de llegada).
    presionar(x, y, oscuro, t) {
      tonos = oscuro ? TONOS.oscuro : TONOS.claro;
      orbe = { x, y, t0: horaDe(t), fin: null };
      pedirDibujo();
    },
    empezar(x, y, t) {
      terminarOrbe('deslizar', t);
      const h = horaDe(t);
      puntos = [{ x, y, t: h }];
      cabeza = h;
      punta = null;
      recorrido = 0;
      largo = 0;
      remate = false;
      pedirDibujo();
    },
    agregar(x, y, t) {
      const ultimo = puntos[puntos.length - 1];
      // Nunca antes que el anterior (los relojes pueden diferir un poco).
      const h = Math.max(horaDe(t), ultimo ? ultimo.t : -Infinity);
      if (!ultimo) {
        // La raya anterior ya se apagó con el dedo quieto: empieza otra aquí.
        puntos = [{ x, y, t: h }];
        cabeza = h;
        punta = null;
        pedirDibujo();
        return;
      }
      const paso = Math.hypot(x - ultimo.x, y - ultimo.y);
      if (paso < 1.5) return;
      puntos.push({ x, y, t: h });
      largo += paso;
      pedirDibujo();
    },
    soltar(t) {
      terminarOrbe('soltar', t);
      // El remate del hechizo (unos destellos donde se levantó el dedo) sale
      // cuando la punta llega ahí.
      remate = puntos.length > 1 && largo > 60;
      largo = 0;
      pedirDibujo();
    },
    cancelar() {
      terminarOrbe('cancelar');
      largo = 0;
      remate = false;
      pedirDibujo();
    },
    limpiar() {
      puntos = [];
      destellos = [];
      orbe = null;
      punta = null;
      remate = false;
      ultimoMarco = null;
      if (marco) { cancelarMarco(marco); marco = 0; }
      ctx.setTransform(escala, 0, 0, escala, 0, 0);
      borrar();
    },
  };
}
