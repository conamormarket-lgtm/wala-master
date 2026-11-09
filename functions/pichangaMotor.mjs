// =========================================================================
// La Pichanga de Kapi — COPIA DE SERVIDOR
// -------------------------------------------------------------------------
// GENERADO por scripts/generar-motor-pichanga.js desde
// src/componentes/kit/piezas/pichangaMotor.mjs. No editar a mano.
// =========================================================================

/*
 * El motor de La Pichanga de Kapi (/pichanga): fútbol de chapas para jugar
 * solo. Puro (sin React): se prueba con `node --test`
 * (pichangaMotor.test.mjs) y el servidor podrá repetir cada partida con este
 * mismo archivo.
 *
 * La cancha mide ANCHO × ALTO (unidades propias, vertical: el arco que se
 * ataca está arriba, en y = 0). Hay chapas (las tuyas y las rivales), una
 * pelota, conos fijos, zonas de barro o hielo y, a veces, Kapi de arquero
 * (se mueve de lado a lado solo mientras algo rueda).
 *
 * Un tiro es [cuerpo, dx, dy]: la chapa (su índice en mesa.cuerpos) y hacia
 * dónde sale, con la fuerza en el largo (enteros, hasta MAX_TIRO). La física
 * va a paso fijo y redondea a 1/1024 en cada paso; solo usa sumas,
 * productos, divisiones y raíces (exactas en cualquier motor de JavaScript),
 * así que el mismo tiro da siempre lo mismo: en el celular, en la web y en el
 * servidor.
 */

export const ANCHO = 600;
export const ALTO = 900;
/** Fondo del arco (lo que entra la pelota detrás de la línea). */
export const FONDO_ARCO = 72;
export const ARCO_NORMAL = 210;
export const RADIO = { chapa: 38, pelota: 21, cono: 17, kapi: 40, poste: 8 };
const MASA = { chapa: 1, pelota: 0.55 };
/** El largo máximo de un tiro (lo que se arrastra, en unidades de la cancha). */
export const MAX_TIRO = 150;
/** Un arrastre más corto no es un tiro (se soltó sin querer). */
export const MIN_TIRO = 10;
const POTENCIA = 0.16; // velocidad por unidad de tiro (24 por paso al máximo)
const SUB = 3; // pasos internos por paso: nada atraviesa a nada
export const ROCE = { normal: 0.968, barro: 0.9, hielo: 0.988 };
const PARA = 0.06; // bajo esta velocidad, un cuerpo se detiene
const REBOTE = { cuerpo: 0.9, pared: 0.72, poste: 0.6, red: 0.25, kapi: 0.85, cono: 0.7 };
/** Un tiro no dura más que esto (pasos de 1/60 s): 20 s. */
export const MAX_PASOS = 1200;
/** Pasos por segundo (la página dibuja uno por cuadro). */
export const PASOS_POR_SEGUNDO = 60;

const q = (v) => Math.round(v * 1024) / 1024;

/* ── La mesa ──────────────────────────────────────────── */

/**
 * Una cancha armada (def): lo fijo de un nivel o un partido.
 *  - mias: [[x, y]] tus chapas · rivales: [[x, y]] las del equipo rival
 *  - portero, porteroRival: [x, y] la chapa que cuida cada arco (o null): es
 *    una chapa más (se tira igual), solo se dibuja con guantes
 *  - pelota: [x, y] · conos: [[x, y]] · zonas: [{ tipo: 'barro' | 'hielo', x, y, w, h }]
 *  - kapi: { x, y, rango, vel, fase } el arquero rival que va de lado a lado (o null)
 *  - arcos: { arriba, abajo } el ancho de cada arco (0: no hay). Abajo está
 *    tu arco: la pelota que entra ahí es un autogol
 */
export function definirCancha(d = {}) {
  return {
    mias: d.mias || [],
    portero: d.portero || null,
    rivales: d.rivales || [],
    porteroRival: d.porteroRival || null,
    pelota: d.pelota || [ANCHO / 2, ALTO / 2],
    conos: d.conos || [],
    zonas: d.zonas || [],
    kapi: d.kapi || null,
    arcos: { arriba: ARCO_NORMAL, abajo: ARCO_NORMAL, ...(d.arcos || {}) },
  };
}

/**
 * Lo que se mueve, al empezar: las chapas tuyas (índices 0…), la pelota y las
 * rivales. t es el reloj de Kapi (solo avanza mientras algo rueda).
 */
export function crearMesa(def, t = 0) {
  const chapa = (equipo, portero = false) => ([x, y]) => ({
    equipo, tipo: 'chapa', x, y, vx: 0, vy: 0, r: RADIO.chapa, m: MASA.chapa, ...(portero ? { portero: true } : {}),
  });
  return {
    t,
    cuerpos: [
      ...def.mias.map(chapa('mia')),
      ...(def.portero ? [chapa('mia', true)(def.portero)] : []),
      { equipo: null, tipo: 'pelota', x: def.pelota[0], y: def.pelota[1], vx: 0, vy: 0, r: RADIO.pelota, m: MASA.pelota },
      ...def.rivales.map(chapa('rival')),
      ...(def.porteroRival ? [chapa('rival', true)(def.porteroRival)] : []),
    ],
  };
}

/** El índice de la pelota en la mesa. */
export const indicePelota = (mesa) => mesa.cuerpos.findIndex((c) => c.tipo === 'pelota');
/** Los índices de las chapas de un equipo ('mia' | 'rival'). */
export const chapasDe = (mesa, equipo) => mesa.cuerpos.flatMap((c, i) => (c.equipo === equipo ? [i] : []));
/** Nada se mueve. */
export const quieta = (mesa) => mesa.cuerpos.every((c) => c.vx === 0 && c.vy === 0);

/**
 * Kapi de arquero en el momento t: va y vuelve entre x - rango y x + rango a
 * `vel` por paso, empezando en x + fase (hacia la derecha).
 */
export function posicionKapi(kapi, t) {
  if (!kapi) return null;
  const A = kapi.rango || 0;
  const vel = kapi.vel || 0;
  if (!A || !vel) return { x: kapi.x, y: kapi.y, vx: 0 };
  const P = 4 * A;
  let u = (t * vel + (kapi.fase || 0)) % P;
  if (u < 0) u += P;
  if (u < A) return { x: kapi.x + u, y: kapi.y, vx: vel };
  if (u < 3 * A) return { x: kapi.x + 2 * A - u, y: kapi.y, vx: -vel };
  return { x: kapi.x + u - P, y: kapi.y, vx: vel };
}

/** Los postes de los arcos: [{ x, y }]. */
export function postes(def) {
  const lista = [];
  const { arriba, abajo } = def.arcos;
  if (arriba) lista.push({ x: ANCHO / 2 - arriba / 2, y: 0 }, { x: ANCHO / 2 + arriba / 2, y: 0 });
  if (abajo) lista.push({ x: ANCHO / 2 - abajo / 2, y: ALTO }, { x: ANCHO / 2 + abajo / 2, y: ALTO });
  return lista;
}

/* ── El tiro ──────────────────────────────────────────── */

/**
 * Un arrastre como tiro: enteros, sin pasar de MAX_TIRO. Más corto que
 * MIN_TIRO → null (no es un tiro).
 */
export function normalizarTiro(dx, dy) {
  let x = Math.round(Number(dx) || 0);
  let y = Math.round(Number(dy) || 0);
  const largo2 = x * x + y * y;
  if (largo2 < MIN_TIRO * MIN_TIRO) return null;
  if (largo2 > MAX_TIRO * MAX_TIRO) {
    const f = MAX_TIRO / Math.sqrt(largo2);
    x = Math.round(x * f);
    y = Math.round(y * f);
    while (x * x + y * y > MAX_TIRO * MAX_TIRO) {
      if (Math.abs(x) >= Math.abs(y)) x -= Math.sign(x);
      else y -= Math.sign(y);
    }
  }
  return [x, y];
}

/** Un tiro desde un ángulo (radianes, 0 = derecha, -π/2 = arriba) y una fuerza de 0 a 1. */
export function tiroDesdeAngulo(cuerpo, angulo, fuerza) {
  const v = normalizarTiro(Math.cos(angulo) * fuerza * MAX_TIRO, Math.sin(angulo) * fuerza * MAX_TIRO);
  return v ? [cuerpo, v[0], v[1]] : null;
}

/** La mesa con el tiro dado (la chapa sale disparada). */
export function tirar(mesa, [i, dx, dy]) {
  const v = normalizarTiro(dx, dy);
  const cuerpos = mesa.cuerpos.map((c, k) => (k === i && v ? { ...c, vx: v[0] * POTENCIA, vy: v[1] * POTENCIA } : { ...c }));
  return { t: mesa.t, cuerpos };
}

/* ── La física ────────────────────────────────────────── */

function chocar(a, b, eventos) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const min = a.r + b.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return false;
  const d = Math.sqrt(d2);
  const nx = d > 0 ? dx / d : 1;
  const ny = d > 0 ? dy / d : 0;
  const ia = 1 / a.m;
  const ib = 1 / b.m;
  const suma = ia + ib;
  const sobra = min - d;
  a.x -= nx * sobra * (ia / suma);
  a.y -= ny * sobra * (ia / suma);
  b.x += nx * sobra * (ib / suma);
  b.y += ny * sobra * (ib / suma);
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn >= 0) return true;
  const j = (-(1 + REBOTE.cuerpo) * vn) / suma;
  a.vx -= j * ia * nx;
  a.vy -= j * ia * ny;
  b.vx += j * ib * nx;
  b.vy += j * ib * ny;
  eventos.push({ tipo: a.tipo === 'pelota' || b.tipo === 'pelota' ? 'pelota' : 'choque', fuerza: -vn, x: a.x + nx * a.r, y: a.y + ny * a.r });
  return true;
}

/** Contra algo que no se empuja (cono, poste, Kapi): solo rebota el cuerpo. */
function chocarFijo(c, fx, fy, fr, fvx, fvy, rebote, tipo, eventos) {
  const dx = c.x - fx;
  const dy = c.y - fy;
  const min = c.r + fr;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return;
  const d = Math.sqrt(d2);
  const nx = d > 0 ? dx / d : 0;
  const ny = d > 0 ? dy / d : 1;
  c.x = fx + nx * min;
  c.y = fy + ny * min;
  const vn = (c.vx - fvx) * nx + (c.vy - fvy) * ny;
  if (vn >= 0) return;
  c.vx -= (1 + rebote) * vn * nx;
  c.vy -= (1 + rebote) * vn * ny;
  eventos.push({ tipo, fuerza: -vn, x: c.x - nx * c.r, y: c.y - ny * c.r });
}

/** Las bandas, el fondo y la red de los arcos. */
function paredes(c, arcos, eventos) {
  const { r } = c;
  const golpe = (v) => { if (Math.abs(v) > 1) eventos.push({ tipo: 'pared', fuerza: Math.abs(v), x: c.x, y: c.y }); };
  if (c.x < r) { c.x = r; if (c.vx < 0) { golpe(c.vx); c.vx = -c.vx * REBOTE.pared; } }
  if (c.x > ANCHO - r) { c.x = ANCHO - r; if (c.vx > 0) { golpe(c.vx); c.vx = -c.vx * REBOTE.pared; } }
  // Un extremo: arriba (y = 0, el arco crece hacia y < 0) o abajo (y = ALTO).
  const extremo = (ancho, arriba) => {
    const izq = ANCHO / 2 - ancho / 2;
    const der = ANCHO / 2 + ancho / 2;
    const dentro = arriba ? c.y < 0 : c.y > ALTO;
    if (ancho && dentro) {
      // Dentro del arco: los costados y la red.
      if (c.x < izq + r) { c.x = izq + r; if (c.vx < 0) c.vx = -c.vx * REBOTE.red; }
      if (c.x > der - r) { c.x = der - r; if (c.vx > 0) c.vx = -c.vx * REBOTE.red; }
      if (arriba && c.y < -FONDO_ARCO + r) { c.y = -FONDO_ARCO + r; if (c.vy < 0) c.vy = -c.vy * REBOTE.red; }
      if (!arriba && c.y > ALTO + FONDO_ARCO - r) { c.y = ALTO + FONDO_ARCO - r; if (c.vy > 0) c.vy = -c.vy * REBOTE.red; }
      return;
    }
    // Solo la pelota entra al arco: para las chapas, la línea es pared.
    const enBoca = c.tipo === 'pelota' && ancho > 0 && c.x > izq && c.x < der;
    if (enBoca) return;
    if (arriba && c.y < r) { c.y = r; if (c.vy < 0) { golpe(c.vy); c.vy = -c.vy * REBOTE.pared; } }
    if (!arriba && c.y > ALTO - r) { c.y = ALTO - r; if (c.vy > 0) { golpe(c.vy); c.vy = -c.vy * REBOTE.pared; } }
  };
  extremo(arcos.arriba, true);
  extremo(arcos.abajo, false);
}

/** El roce del suelo donde está el cuerpo (el de la primera zona que lo contiene). */
function roceEn(c, zonas) {
  for (const z of zonas) {
    if (c.x >= z.x && c.x <= z.x + z.w && c.y >= z.y && c.y <= z.y + z.h) return ROCE[z.tipo] ?? ROCE.normal;
  }
  return ROCE.normal;
}

/**
 * Un paso (1/60 s). → { mesa, eventos, gol: null | 'arriba' | 'abajo', tocaron }.
 * eventos: [{ tipo: 'choque' | 'pelota' | 'pared' | 'poste' | 'cono' | 'kapi', fuerza, x, y }]
 * (para el sonido y los destellos). tocaron: los índices de las chapas que
 * tocaron la pelota en este paso (los pases). Con gol, la mesa queda como
 * estaba en ese instante.
 */
export function paso(mesa, def) {
  const cuerpos = mesa.cuerpos.map((c) => ({ ...c }));
  const eventos = [];
  const tocaron = [];
  const fijos = postes(def);
  let gol = null;
  for (let s = 1; s <= SUB && !gol; s += 1) {
    for (const c of cuerpos) {
      if (c.vx !== 0 || c.vy !== 0) {
        c.x += c.vx / SUB;
        c.y += c.vy / SUB;
      }
    }
    for (let i = 0; i < cuerpos.length; i += 1) {
      for (let j = i + 1; j < cuerpos.length; j += 1) {
        const a = cuerpos[i];
        const b = cuerpos[j];
        if (chocar(a, b, eventos) && (a.tipo === 'pelota' || b.tipo === 'pelota')) tocaron.push(a.tipo === 'pelota' ? j : i);
      }
    }
    const kapi = posicionKapi(def.kapi, mesa.t + s / SUB);
    for (const c of cuerpos) {
      for (const [x, y] of def.conos) chocarFijo(c, x, y, RADIO.cono, 0, 0, REBOTE.cono, 'cono', eventos);
      for (const p of fijos) chocarFijo(c, p.x, p.y, RADIO.poste, 0, 0, REBOTE.poste, 'poste', eventos);
      if (kapi) chocarFijo(c, kapi.x, kapi.y, RADIO.kapi, kapi.vx, 0, REBOTE.kapi, 'kapi', eventos);
      paredes(c, def.arcos, eventos);
    }
    // Es gol cuando el centro de la pelota cruza la línea (más de media
    // pelota adentro): así nunca se queda quieta "medio adentro" sin contar.
    const p = cuerpos.find((c) => c.tipo === 'pelota');
    if (def.arcos.arriba && p.y < 0) gol = 'arriba';
    else if (def.arcos.abajo && p.y > ALTO) gol = 'abajo';
  }
  for (const c of cuerpos) {
    const f = roceEn(c, def.zonas);
    c.vx *= f;
    c.vy *= f;
    if (c.vx * c.vx + c.vy * c.vy < PARA * PARA) { c.vx = 0; c.vy = 0; }
    c.x = q(c.x); c.y = q(c.y); c.vx = q(c.vx); c.vy = q(c.vy);
  }
  return { mesa: { t: mesa.t + 1, cuerpos }, eventos, gol, tocaron };
}

/*
 * El pase, en dos tiempos (como en Plato):
 *  1. Pegada: en el instante en que la pelota toca al compañero (el
 *     receptor), se queda pegada a él en ese mismo punto y se mueve con él
 *     mientras siga rodando.
 *  2. Órbita: cuando el receptor se detiene, la pelota queda quieta y él gira
 *     alrededor de ella hasta quedar detrás, mirando al arco que ataca (lista
 *     para patear). Si hay chapas en el camino, las empuja al pasar.
 * Sin trigonometría (solo sumas, productos y raíces): el giro usa el coseno y
 * el seno de ORBITA escritos como números, así da lo mismo en cualquier
 * motor de JavaScript y el servidor puede repetirlo.
 */
const ORBITA = { cos: 0.9928086358538663, sin: 0.11971220728891936 }; // 0,12 rad por paso

function unidad(x, y) {
  const l = Math.sqrt(x * x + y * y);
  return l > 0 ? [x / l, y / l] : [0, -1];
}

/** Pega la pelota al receptor: la deja a su lado (donde quedó el toque) y con su velocidad. */
function pegarPelota(mesa, control) {
  const cuerpos = mesa.cuerpos.map((c) => ({ ...c }));
  const c = cuerpos[control.receptor];
  const p = cuerpos[control.pelota];
  const d = c.r + p.r + 1;
  p.x = q(c.x + control.ux * d);
  p.y = q(c.y + control.uy * d);
  p.vx = c.vx;
  p.vy = c.vy;
  return { t: mesa.t, cuerpos };
}

/** Gira la dirección (x, y) un paso de órbita (0,12 rad) hacia un lado (giro ±1). */
function girar([x, y], giro) {
  return unidad(x * ORBITA.cos - giro * y * ORBITA.sin, giro * x * ORBITA.sin + y * ORBITA.cos);
}

/** Las vueltas de órbita como máximo (media vuelta son 27). */
const ORBITA_MAX = 60;

/**
 * Cómo será la órbita del receptor c alrededor de la pelota (bx, by): la
 * dirección final (detrás de la pelota mirando al arco; si ahí no cabe en la
 * cancha, la más parecida que sí cabe) y hacia qué lado girar (el que menos
 * choca con los bordes; si empatan, el más corto). → { ox, oy, tx, ty, giro }
 */
function planDeOrbita(c, p, bx, by) {
  const d = c.r + p.r + 1;
  const cabe = ([x, y]) => {
    const nx = bx + x * d;
    const ny = by + y * d;
    return nx >= c.r && nx <= ANCHO - c.r && ny >= c.r && ny <= ALTO - c.r;
  };
  const [gx, gy] = unidad(ANCHO / 2 - bx, (c.equipo === 'mia' ? 0 : ALTO) - by);
  let meta = [-gx, -gy];
  if (!cabe(meta)) {
    let a = meta;
    let b = meta;
    for (let k = 0; k < 27; k += 1) {
      a = girar(a, 1);
      b = girar(b, -1);
      if (cabe(a)) { meta = a; break; }
      if (cabe(b)) { meta = b; break; }
    }
  }
  const inicio = unidad(c.x - bx, c.y - by);
  const recorrido = (giro) => {
    let o = inicio;
    let fuera = 0;
    let pasos = 0;
    while (o[0] * meta[0] + o[1] * meta[1] < ORBITA.cos && pasos < ORBITA_MAX) {
      o = girar(o, giro);
      pasos += 1;
      if (!cabe(o)) fuera += 1;
    }
    return { fuera, pasos };
  };
  const izq = recorrido(1);
  const der = recorrido(-1);
  const giro = izq.fuera < der.fuera || (izq.fuera === der.fuera && izq.pasos <= der.pasos) ? 1 : -1;
  return { ox: inicio[0], oy: inicio[1], tx: meta[0], ty: meta[1], giro };
}

/**
 * Un paso de la órbita: el receptor da una vuelta corta alrededor de la
 * pelota (quieta) hacia el lado de atrás. La dirección la lleva el control
 * (no se calcula de dónde quedó la chapa): así un borde no la deja girando
 * en el mismo sitio. → { mesa, eventos, gol, tocaron, lista, ox, oy }.
 */
function pasoDeOrbita(mesa, def, control) {
  const cuerpos = mesa.cuerpos.map((c) => ({ ...c }));
  const c = cuerpos[control.receptor];
  const p = cuerpos[control.pelota];
  const d = c.r + p.r + 1;
  let { ox, oy } = control;
  const { tx, ty } = control;
  let lista = ox * tx + oy * ty >= ORBITA.cos || control.vueltas >= ORBITA_MAX;
  if (lista) {
    [ox, oy] = [tx, ty];
  } else {
    [ox, oy] = girar([ox, oy], control.giro);
    lista = ox * tx + oy * ty >= 0.99999;
  }
  const nx = Math.min(ANCHO - c.r, Math.max(c.r, control.bx + ox * d));
  const ny = Math.min(ALTO - c.r, Math.max(c.r, control.by + oy * d));
  // Se mueve con velocidad: así empuja a las chapas que estén en el camino.
  c.vx = nx - c.x;
  c.vy = ny - c.y;
  p.vx = 0;
  p.vy = 0;
  const r = paso({ t: mesa.t, cuerpos }, def);
  const despues = r.mesa.cuerpos.map((x) => ({ ...x }));
  const rc = despues[control.receptor];
  const rp = despues[control.pelota];
  rc.x = q(nx); rc.y = q(ny); rc.vx = 0; rc.vy = 0;
  rp.x = control.bx; rp.y = control.by; rp.vx = 0; rp.vy = 0;
  return { mesa: { t: r.mesa.t, cuerpos: despues }, eventos: r.eventos, gol: r.gol, tocaron: r.tocaron, lista, ox, oy };
}

/**
 * Un tiro completo: hasta que todo se detiene o hay gol.
 *  - iman: con pases disponibles, la primera vez que la pelota toca a un
 *    compañero de la chapa que tiró, hay pase: se pega a él y, cuando él se
 *    detiene, él la rodea hasta quedar listo para patear al arco. Ese
 *    compañero es el receptor y tira después
 * → { mesa, gol, pasos, tocaron, receptor, cuadros?, golpes? }. tocaron: las
 * chapas que tocaron la pelota (en orden, sin repetir); receptor: el índice
 * de la chapa que recibió el pase (o null). Si se piden los cuadros: las
 * posiciones [[x, y]…] de cada paso, para dibujar la trayectoria o la
 * repetición, y los golpes [[paso, tipo, fuerza, x, y]…], el más fuerte de cada
 * paso, para el sonido ('pase' cuando la pelota se pega).
 */
export function simular(mesa, def, tiro, { cuadros = false, iman = false } = {}) {
  const equipo = tiro ? mesa.cuerpos[tiro[0]]?.equipo : null;
  let control = null; // { receptor, pelota, ux, uy, fase: 'pegada' | 'orbita' | 'lista', bx, by, tx, ty }
  let m = tiro ? tirar(mesa, tiro) : mesa;
  const lista = cuadros ? [m.cuerpos.map((c) => [c.x, c.y])] : null;
  const golpes = cuadros ? [] : null;
  let gol = null;
  let pasos = 0;
  const tocaron = [];
  while (pasos < MAX_PASOS) {
    const r = control?.fase === 'orbita' ? pasoDeOrbita(m, def, control) : paso(m, def);
    m = r.mesa;
    pasos += 1;
    for (const k of r.tocaron) if (!tocaron.includes(k)) tocaron.push(k);
    if (r.gol) gol = r.gol;
    let pase = false;
    if (!gol && control) {
      if (control.fase === 'pegada') {
        m = pegarPelota(m, control);
        const rc = m.cuerpos[control.receptor];
        if (rc.vx === 0 && rc.vy === 0) {
          // Se detuvo: ahora la rodea hasta quedar detrás de la pelota, mirando al arco.
          const bola = m.cuerpos[control.pelota];
          const plan = planDeOrbita(rc, bola, bola.x, bola.y);
          control = { ...control, fase: 'orbita', bx: bola.x, by: bola.y, ...plan, vueltas: 0 };
        }
      } else if (control.fase === 'orbita') {
        control = r.lista
          ? { ...control, fase: 'lista' }
          : { ...control, ox: r.ox, oy: r.oy, vueltas: control.vueltas + 1 };
      }
    }
    // El pase: la pelota toca a un compañero de la que tiró.
    if (iman && !gol && !control && equipo) {
      const k = r.tocaron.find((n) => n !== tiro[0] && m.cuerpos[n]?.equipo === equipo);
      if (k !== undefined) {
        const kb = m.cuerpos.findIndex((c) => c.tipo === 'pelota');
        const rc = m.cuerpos[k];
        const bola = m.cuerpos[kb];
        const [ux, uy] = unidad(bola.x - rc.x, bola.y - rc.y);
        control = { receptor: k, pelota: kb, ux, uy, fase: 'pegada' };
        m = pegarPelota(m, control);
        pase = true;
      }
    }
    if (lista) {
      lista.push(m.cuerpos.map((c) => [c.x, c.y]));
      const pel = m.cuerpos.find((c) => c.tipo === 'pelota');
      if (pase) {
        golpes.push([pasos, 'pase', 10, Math.round(pel.x), Math.round(pel.y)]);
      } else {
        const fuerte = r.eventos.reduce((a, e) => (!a || e.fuerza > a.fuerza ? e : a), null);
        if (fuerte && fuerte.fuerza > 0.8) golpes.push([pasos, fuerte.tipo, fuerte.fuerza, Math.round(fuerte.x), Math.round(fuerte.y)]);
      }
    }
    if (gol) break;
    if (quieta(m) && (!control || control.fase === 'lista')) break;
  }
  // Si se pasó del tiempo (no debería), todo se detiene donde está.
  if (!gol && !quieta(m)) m = { t: m.t, cuerpos: m.cuerpos.map((c) => ({ ...c, vx: 0, vy: 0 })) };
  const receptor = control ? control.receptor : null;
  return lista ? { mesa: m, gol, pasos, tocaron, receptor, cuadros: lista, golpes } : { mesa: m, gol, pasos, tocaron, receptor };
}

/** Los pases que dan otro toque (por nivel) o seguir tirando (por turno, en el partido). */
export const PASES_MAX = 3;

/**
 * ¿Hubo pase? Con imán, si la pelota se pegó a un compañero (sim.receptor);
 * sin imán, si la pelota tocó otra chapa del mismo equipo que la que tiró
 * (la que tiró no cuenta).
 */
export function huboPase(mesa, tiro, sim) {
  if (sim.receptor != null) return true;
  const equipo = mesa.cuerpos[tiro[0]]?.equipo;
  return Boolean(equipo) && (sim.tocaron || []).some((k) => k !== tiro[0] && mesa.cuerpos[k]?.equipo === equipo);
}

/* ── Mundos, estrellas y cofres ───────────────────────── */

export const NIVELES_POR_MUNDO = 20;

/** Los mundos: nombre, el pasto (dos verdes de las franjas) y lo que trae. */
export const MUNDOS_PICHANGA = [
  { nombre: 'La canchita del barrio', pasto: ['#4caf50', '#43a047'], linea: 'rgba(255,255,255,0.75)' },
  { nombre: 'Invierno en el potrero', pasto: ['#7cb38a', '#6fa77e'], linea: 'rgba(255,255,255,0.85)' },
];

export const mundoDe = (n) => Math.ceil(n / NIVELES_POR_MUNDO);
export const esJefe = (n) => n > 0 && n % NIVELES_POR_MUNDO === 0;
export function infoMundo(m) {
  const base = MUNDOS_PICHANGA[(m - 1) % MUNDOS_PICHANGA.length];
  return { numero: m, ...base, desde: (m - 1) * NIVELES_POR_MUNDO + 1, hasta: m * NIVELES_POR_MUNDO };
}

/**
 * Las estrellas según los toques: igualar el par (lo que usa la solución del
 * motor) da 3; uno más, 2; más, 1.
 */
export const metasEstrellas = (par) => ({ tres: par, dos: par + 1 });
export function estrellasPara(toques, par) {
  if (toques <= par) return 3;
  return toques <= par + 1 ? 2 : 1;
}

/** Niveles seguidos ganados (sin reiniciar ni abandonar) para abrir un cofre. */
export const RACHA_COFRE = 3;
/** Las ayudas de cada nivel (vuelven completas al reiniciarlo). */
export const AYUDAS_PICHANGA = { vista: 2, repetir: 2, toque: 1 };

const PREMIOS_COFRE = [
  { tipo: 'vista', cantidad: 1, peso: 40 },
  { tipo: 'repetir', cantidad: 2, peso: 35 },
  { tipo: 'toque', cantidad: 1, peso: 25 },
];
/** Lo que trae un cofre: { tipo: 'vista' | 'repetir' | 'toque', cantidad }. */
export function premioCofre(rnd = Math.random) {
  const total = PREMIOS_COFRE.reduce((t, p) => t + p.peso, 0);
  let x = rnd() * total;
  for (const p of PREMIOS_COFRE) {
    x -= p.peso;
    if (x < 0) return { tipo: p.tipo, cantidad: p.cantidad };
  }
  return { tipo: 'vista', cantidad: 1 };
}

/* ── Azar con semilla ─────────────────────────────────── */

export function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Los niveles ──────────────────────────────────────── */

/** Lo que trae un nivel, para explicarlo la primera vez (en este orden). */
export const OBSTACULOS_PICHANGA = ['rivales', 'conos', 'kapi', 'barro', 'hielo', 'arcoChico'];

export function obstaculosDe(def) {
  const lista = [];
  if (def.rivales.length) lista.push('rivales');
  if (def.conos.length) lista.push('conos');
  if (def.kapi) lista.push('kapi');
  if (def.zonas.some((z) => z.tipo === 'barro')) lista.push('barro');
  if (def.zonas.some((z) => z.tipo === 'hielo')) lista.push('hielo');
  if (def.arcos.arriba && def.arcos.arriba < ARCO_NORMAL) lista.push('arcoChico');
  return lista;
}

/**
 * Un nivel listo para jugar, a partir de su dato y su solución comprobada:
 * { numero, mundo, jefe, def, par, toques, penales, obstaculos, solucion }.
 *  - par: los toques de la solución (las 3 estrellas)
 *  - toques: los que hay (par + 2), o null en los penales
 *  - penales: { tiros, goles } (el jefe: cada tiro empieza de cero)
 */
export function armarNivel(numero, dato, solucion) {
  const def = definirCancha(dato);
  const penales = dato.penales || null;
  const par = solucion?.par || (penales ? penales.goles : 1);
  return {
    numero,
    mundo: mundoDe(numero),
    jefe: esJefe(numero),
    def,
    par,
    toques: penales ? penales.tiros : par + 2,
    penales,
    obstaculos: obstaculosDe(def),
    solucion: solucion?.tiros || null,
  };
}

/* ── Una partida de un nivel ──────────────────────────── */

/**
 * La partida de un nivel: { mesa, tiros, pases, receptor, goles, ganada, perdida, ultimo }.
 * tiros: los que valen (repetir saca el último), para comprobarla. pases: los
 * tiros que no gastaron toque (la pelota se pegó a un compañero). receptor:
 * la chapa que recibió el último pase: el próximo tiro es con ella (o null).
 * ultimo: lo que pasó en el último tiro ({ pase, autogol }), para avisarlo.
 */
export const partidaNivel = (lv) => ({
  mesa: crearMesa(lv.def), tiros: [], pases: 0, receptor: null, goles: 0, ganada: false, perdida: false, ultimo: null,
});

/** Los toques que ya se gastaron (los pases no cuentan). */
export const toquesUsados = (partida) => partida.tiros.length - (partida.pases || 0);

/**
 * Cuántos toques quedan (con los extra de "Un toque más"). En los penales,
 * los tiros que quedan.
 */
export const toquesQuedan = (lv, partida, extras = 0) => Math.max(0, lv.toques + extras - toquesUsados(partida));

/**
 * Lo que queda después de un tiro ya simulado (sim: lo que devolvió simular).
 * En los penales, con gol o sin gol, todo vuelve a su lugar (el reloj de Kapi
 * sigue).
 */
export function despuesDelTiro(lv, partida, tiro, sim, extras = 0, respuesta = null) {
  const tiros = [...partida.tiros, tiro];
  const pasesAntes = partida.pases || 0;
  if (lv.penales) {
    const goles = partida.goles + (sim.gol === 'arriba' ? 1 : 0);
    const quedan = lv.penales.tiros + extras - tiros.length;
    const ganada = goles >= lv.penales.goles;
    return {
      mesa: crearMesa(lv.def, sim.mesa.t),
      tiros,
      pases: 0,
      receptor: null,
      goles,
      ganada,
      perdida: !ganada && goles + quedan < lv.penales.goles,
      ultimo: { pase: false, autogol: sim.gol === 'abajo' },
    };
  }
  // La respuesta de Michi (si hubo): un autogol suyo es gol tuyo; un gol suyo
  // en tu arco es como un autogol (la jugada vuelve atrás).
  const golRival = respuesta?.sim.gol || null;
  const ganada = sim.gol === 'arriba' || golRival === 'arriba';
  // Autogol: la jugada vuelve atrás (el reloj del arquero sigue) y el toque se gasta.
  const autogol = sim.gol === 'abajo';
  const golDeMichi = !autogol && golRival === 'abajo';
  const pase = !ganada && !autogol && pasesAntes < PASES_MAX && huboPase(partida.mesa, tiro, sim);
  const pases = pasesAntes + (pase ? 1 : 0);
  const ultimaMesa = respuesta ? respuesta.sim.mesa : sim.mesa;
  return {
    mesa: autogol || golDeMichi ? { t: ultimaMesa.t, cuerpos: partida.mesa.cuerpos.map((c) => ({ ...c })) } : ultimaMesa,
    tiros,
    pases,
    receptor: pase && sim.receptor != null ? sim.receptor : null,
    goles: ganada ? 1 : 0,
    ganada,
    perdida: !ganada && tiros.length - pases >= lv.toques + extras,
    ultimo: { pase, autogol, golDeMichi, autogolDeMichi: golRival === 'arriba' && sim.gol !== 'arriba', respondio: Boolean(respuesta) },
  };
}

/**
 * Un tiro "con efecto": el de la chapa i que le pega a la pelota del lado
 * justo para mandarla hacia `objetivo` ({ x, y }), con la fuerza dada (0 a 1;
 * sin fuerza, la que hace falta para llegar con impulso). Solo sumas,
 * productos y raíces: da lo mismo en cualquier lado. → [i, dx, dy] o null.
 */
export function tiroDirigido(mesa, i, objetivo, fuerza = null) {
  const c = mesa.cuerpos[i];
  const p = mesa.cuerpos[indicePelota(mesa)];
  const [ux, uy] = unidad(objetivo.x - p.x, objetivo.y - p.y);
  // Dónde tiene que pegar: detrás de la pelota, del lado contrario al objetivo.
  const px = p.x - ux * (c.r + p.r - 6);
  const py = p.y - uy * (c.r + p.r - 6);
  const vx = px - c.x;
  const vy = py - c.y;
  const largo = Math.sqrt(vx * vx + vy * vy);
  if (largo < 1) return null;
  const f = fuerza ?? Math.min(1, 0.4 + largo / 700);
  const v = normalizarTiro((vx / largo) * f * MAX_TIRO, (vy / largo) * f * MAX_TIRO);
  return v ? [i, v[0], v[1]] : null;
}

/**
 * La respuesta de Michi en un nivel o en el reto, después de tu toque: con
 * sus dos chapas más cerca de la pelota prueba despejarla hacia tu arco o
 * hacia la banda, y elige la que deja la pelota más lejos de su arco (un gol
 * en tu arco, mejor; un autogol, nunca). Sin azar ni trigonometría: el
 * servidor la repite igual. → el tiro, o null si no tiene chapas.
 */
export function respuestaRival(mesa, def) {
  const rivales = chapasDe(mesa, 'rival');
  if (!rivales.length) return null;
  const p = mesa.cuerpos[indicePelota(mesa)];
  const cerca = rivales
    .map((i) => ({ i, d: (mesa.cuerpos[i].x - p.x) ** 2 + (mesa.cuerpos[i].y - p.y) ** 2 }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, 2);
  const objetivos = [
    { x: ANCHO / 2, y: ALTO },
    { x: p.x < ANCHO / 2 ? 0 : ANCHO, y: Math.min(ALTO, p.y + 260) },
  ];
  let mejor = null;
  for (const { i } of cerca) {
    for (const objetivo of objetivos) {
      const tiro = tiroDirigido(mesa, i, objetivo);
      if (!tiro) continue;
      const sim = simular(mesa, def, tiro);
      const bola = sim.mesa.cuerpos[indicePelota(sim.mesa)];
      let valor = bola.y;
      if (sim.gol === 'abajo') valor = 100000;
      if (sim.gol === 'arriba') valor = -100000;
      if (!mejor || valor > mejor.valor) mejor = { tiro, valor };
    }
  }
  return mejor ? mejor.tiro : null;
}

/**
 * Un tiro de la persona en un nivel: simula, deja que Michi responda (si
 * tiene chapas y la jugada sigue) y aplica las reglas.
 * → { partida, sim, respuesta: { tiro, sim } | null }
 * Michi no responde si hubo gol, autogol o pase (sigues tú), ni si ese toque
 * fue el último (el nivel ya se perdió).
 */
export function jugarTiro(lv, partida, tiro, { extras = 0, cuadros = false } = {}) {
  const iman = !lv.penales && (partida.pases || 0) < PASES_MAX;
  const sim = simular(partida.mesa, lv.def, tiro, { cuadros, iman });
  let respuesta = null;
  if (!lv.penales && !sim.gol && sim.receptor == null) {
    const usados = partida.tiros.length + 1 - (partida.pases || 0);
    if (usados < lv.toques + extras) {
      const suyo = respuestaRival(sim.mesa, lv.def);
      if (suyo) respuesta = { tiro: suyo, sim: simular(sim.mesa, lv.def, suyo, { cuadros }) };
    }
  }
  return { partida: despuesDelTiro(lv, partida, tiro, sim, extras, respuesta), sim, respuesta };
}

/**
 * ¿Es un tiro válido de la persona? Una chapa suya, con fuerza; después de un
 * pase, la que lo recibió (receptor).
 */
export function tiroValido(mesa, tiro, receptor = null) {
  if (!Array.isArray(tiro) || tiro.length !== 3) return false;
  const [i, dx, dy] = tiro;
  if (receptor != null && i !== receptor) return false;
  return Number.isInteger(i) && mesa.cuerpos[i]?.equipo === 'mia' && Boolean(normalizarTiro(dx, dy));
}

/**
 * Repite una partida entera desde cero (lo que hará el servidor):
 * → { valida, ganada, toques, goles }. Un tiro que no vale, o seguir tirando
 * después de ganar o perder, la invalida.
 */
export function comprobarPartida(lv, tiros, extras = 0) {
  let partida = partidaNivel(lv);
  for (const tiro of tiros || []) {
    if (partida.ganada || partida.perdida || !tiroValido(partida.mesa, tiro, partida.receptor)) return { valida: false, ganada: false, toques: 0, goles: 0 };
    ({ partida } = jugarTiro(lv, partida, tiro, { extras }));
  }
  return { valida: true, ganada: partida.ganada, toques: toquesUsados(partida), goles: partida.goles, pases: partida.pases };
}

/* ── El partido (tu equipo contra el de Michi) ────────── */
/* En el código el rival sigue llamándose 'kapi' (goles.kapi, turno 'kapi'):
   así empezó el juego; en pantalla es el equipo de Michi. */

export const GOLES_PARTIDO = 3;
/** Tiros de cada uno como máximo: después, gana quien va arriba (o empate). */
export const TIROS_PARTIDO = 25;
export const DIFICULTADES = ['facil', 'normal', 'dificil'];

/** Tu formación (abajo); la del rival es la misma, al revés. */
const FORMACION = [[195, 740], [405, 740], [300, 640], [160, 560], [440, 560]];
const PORTERO = [300, 830];

/** La cancha del partido: dos arcos, seis chapas por lado (con su arquero). */
export const canchaPartido = () => definirCancha({
  mias: FORMACION,
  portero: PORTERO,
  rivales: FORMACION.map(([x, y]) => [ANCHO - x, ALTO - y]),
  porteroRival: [ANCHO - PORTERO[0], ALTO - PORTERO[1]],
  pelota: [ANCHO / 2, ALTO / 2],
  arcos: { arriba: ARCO_NORMAL, abajo: ARCO_NORMAL },
});

/**
 * Un partido nuevo: { mesa, goles: { yo, kapi }, tiros: { yo, kapi }, turno,
 * pases, receptor, fin }. receptor: la chapa que recibió el último pase (el
 * próximo tiro es con ella) o null.
 */
export const partidoNuevo = () => ({
  mesa: crearMesa(canchaPartido()),
  goles: { yo: 0, kapi: 0 },
  tiros: { yo: 0, kapi: 0 },
  turno: 'yo',
  pases: 0,
  receptor: null,
  fin: null,
});

/** Un tiro del partido (con el imán del pase si quedan pases en el turno). */
export const simularPartido = (partido, tiro, opciones = {}) => simular(partido.mesa, canchaPartido(), tiro, {
  ...opciones, iman: (partido.pases || 0) < PASES_MAX,
});

/**
 * Lo que queda después de un tiro del partido (sim: lo que devolvió simular;
 * tiro: el que se hizo). Gol arriba es tuyo; abajo, del rival (los autogoles
 * cuentan para el otro). Después de un gol, todo vuelve a su lugar y saca
 * quien lo recibió. Si hubo pase (la pelota se pegó a un compañero), el mismo
 * equipo vuelve a tirar con esa chapa (receptor), hasta PASES_MAX seguidos;
 * si no, el turno pasa.
 * fin: null | 'yo' | 'kapi' | 'empate'.
 */
export function despuesDelTiroPartido(partido, sim, tiro = null) {
  const quien = partido.turno;
  const goles = { ...partido.goles };
  if (sim.gol === 'arriba') goles.yo += 1;
  if (sim.gol === 'abajo') goles.kapi += 1;
  const tiros = { ...partido.tiros, [quien]: partido.tiros[quien] + 1 };
  let fin = null;
  if (goles.yo >= GOLES_PARTIDO) fin = 'yo';
  else if (goles.kapi >= GOLES_PARTIDO) fin = 'kapi';
  else if (tiros.yo >= TIROS_PARTIDO && tiros.kapi >= TIROS_PARTIDO) {
    fin = goles.yo > goles.kapi ? 'yo' : goles.kapi > goles.yo ? 'kapi' : 'empate';
  }
  const otro = quien === 'yo' ? 'kapi' : 'yo';
  const pase = !sim.gol && tiro && (partido.pases || 0) < PASES_MAX && huboPase(partido.mesa, tiro, sim);
  let turno = pase ? quien : otro;
  if (sim.gol === 'arriba') turno = 'kapi';
  if (sim.gol === 'abajo') turno = 'yo';
  return {
    mesa: sim.gol ? crearMesa(canchaPartido(), sim.mesa.t) : sim.mesa,
    goles,
    tiros,
    turno,
    pases: pase ? (partido.pases || 0) + 1 : 0,
    receptor: pase && sim.receptor != null ? sim.receptor : null,
    pase,
    fin,
  };
}

/** Qué tan buena es para Kapi una mesa después de su tiro (más, mejor). */
function valorParaKapi(sim) {
  if (sim.gol === 'abajo') return 100000 - sim.pasos;
  if (sim.gol === 'arriba') return -100000;
  const { cuerpos } = sim.mesa;
  const p = cuerpos.find((c) => c.tipo === 'pelota');
  // La pelota cerca de tu arco (abajo) y lejos del suyo.
  let v = p.y * 2 - Math.abs(p.x - ANCHO / 2) * (p.y > ALTO * 0.65 ? 0.6 : 0.15);
  if (p.y < ALTO * 0.3) v -= 400;
  // Que tenga una chapa suya cerca de la pelota (para el próximo tiro) y que
  // las tuyas no la tengan servida.
  let suya = Infinity;
  let tuya = Infinity;
  for (const c of cuerpos) {
    if (c.tipo !== 'chapa') continue;
    const d = Math.sqrt((c.x - p.x) ** 2 + (c.y - p.y) ** 2);
    if (c.equipo === 'rival') suya = Math.min(suya, d);
    else if (c.y > p.y) tuya = Math.min(tuya, d);
  }
  v -= Math.min(suya, 400) * 0.3;
  v += Math.min(tuya, 300) * 0.25;
  return v;
}

/**
 * El tiro de Michi en el partido. Prueba tiros "con efecto" (tiroDirigido)
 * con sus chapas mejor puestas: a tu arco (al centro y a las esquinas), de
 * pase a sus compañeros y de despeje a las bandas; más unos cuantos directos
 * a la pelota. Simula cada uno y elige el mejor (valorParaKapi). Un tiro que
 * ni toca la pelota casi no vale: así nunca se queda "sin hacer nada". Fácil
 * elige entre los mejores y apunta un poco peor (pero siempre tocando la
 * pelota); difícil, siempre el mejor. → [cuerpo, dx, dy]
 */
export function jugadaDeKapi(mesa, def, { dificultad = 'normal', rnd = Math.random, pases = 0, receptor = null } = {}) {
  const ajustes = {
    facil: { chapas: 2, fuerzas: [null, 0.8], abanico: 2, ruido: 0.07, entre: 4 },
    normal: { chapas: 3, fuerzas: [null, 0.75, 1], abanico: 3, ruido: 0.025, entre: 2 },
    dificil: { chapas: 4, fuerzas: [null, 0.65, 0.85, 1], abanico: 4, ruido: 0, entre: 1 },
  }[dificultad] || { chapas: 3, fuerzas: [null, 0.75, 1], abanico: 3, ruido: 0.025, entre: 2 };
  const kb = indicePelota(mesa);
  const p = mesa.cuerpos[kb];
  const rivales = chapasDe(mesa, 'rival');
  // Las que juegan: las más cerca de la pelota y la mejor puesta detrás de
  // ella (mirando a tu arco). Después de un pase, solo la que lo recibió.
  let cerca;
  if (receptor != null) cerca = [receptor];
  else {
    const porDistancia = rivales
      .map((i) => ({ i, d: (mesa.cuerpos[i].x - p.x) ** 2 + (mesa.cuerpos[i].y - p.y) ** 2 }))
      .sort((a, b) => a.d - b.d);
    cerca = porDistancia.slice(0, ajustes.chapas - 1).map((o) => o.i);
    const detras = porDistancia.find((o) => !cerca.includes(o.i) && mesa.cuerpos[o.i].y < p.y && o.d < 300 * 300);
    cerca.push((detras || porDistancia[ajustes.chapas - 1] || porDistancia[0]).i);
    cerca = [...new Set(cerca)];
  }
  const objetivos = [
    { x: ANCHO / 2, y: ALTO + 20 },
    { x: ANCHO / 2 - 70, y: ALTO + 20 },
    { x: ANCHO / 2 + 70, y: ALTO + 20 },
    { x: p.x < ANCHO / 2 ? 0 : ANCHO, y: Math.min(ALTO, p.y + 300) },
  ];
  const opciones = [];
  const probar = (tiro) => {
    if (!tiro) return;
    const sim = simular(mesa, def, tiro, { iman: pases < PASES_MAX });
    let valor = valorParaKapi(sim);
    // Un pase le da otro tiro: vale un poco más. Sin tocar la pelota, casi nada.
    if (!sim.gol && sim.receptor != null) valor += 140;
    if (!sim.tocaron.includes(tiro[0]) && !sim.gol) valor -= 900;
    opciones.push({ tiro, valor, toca: sim.tocaron.includes(tiro[0]) || Boolean(sim.gol) });
  };
  for (const i of cerca) {
    const c = mesa.cuerpos[i];
    // De pase: a los compañeros que estén más adelante que la pelota.
    const pasesA = pases < PASES_MAX
      ? rivales.filter((k) => k !== i && mesa.cuerpos[k].y > p.y + 40).map((k) => ({ x: mesa.cuerpos[k].x, y: mesa.cuerpos[k].y }))
      : [];
    for (const objetivo of [...objetivos, ...pasesA.slice(0, 2)]) {
      for (const f of ajustes.fuerzas) probar(tiroDirigido(mesa, i, objetivo, f));
    }
    // Y unos directos a la pelota, abriendo un poco el ángulo.
    const base = Math.atan2(p.y - c.y, p.x - c.x);
    for (let k = -ajustes.abanico; k <= ajustes.abanico; k += 1) probar(tiroDesdeAngulo(i, base + k * 0.1, 0.8));
  }
  opciones.sort((a, b) => b.valor - a.valor);
  const buenas = opciones.filter((o) => o.toca);
  const lista = buenas.length ? buenas : opciones;
  const elegida = lista[Math.floor(rnd() * Math.min(ajustes.entre, lista.length))] || lista[0];
  if (!elegida) return null;
  if (!ajustes.ruido) return elegida.tiro;
  // Un poco de mala puntería, sin dejar de tocar la pelota.
  const [i, dx, dy] = elegida.tiro;
  const angulo = Math.atan2(dy, dx) + (rnd() * 2 - 1) * ajustes.ruido;
  const fuerza = Math.sqrt(dx * dx + dy * dy) / MAX_TIRO;
  const torcido = tiroDesdeAngulo(i, angulo, fuerza);
  if (torcido) {
    const sim = simular(mesa, def, torcido, { iman: pases < PASES_MAX });
    if (sim.tocaron.includes(i) || sim.gol) return torcido;
  }
  return elegida.tiro;
}

/**
 * Los problemas de una cancha armada (para el que diseña niveles): algo fuera
 * de la cancha o encimado a otra cosa al empezar. [] si está bien.
 */
export function problemasDeCancha(def) {
  const mesa = crearMesa(def);
  const cosas = [
    ...mesa.cuerpos.map((c, i) => ({ nombre: `${c.tipo === 'pelota' ? 'pelota' : c.equipo}#${i}`, x: c.x, y: c.y, r: c.r })),
    ...def.conos.map(([x, y], i) => ({ nombre: `cono#${i}`, x, y, r: RADIO.cono })),
  ];
  const lista = [];
  for (const c of cosas) {
    if (c.x < c.r || c.x > ANCHO - c.r || c.y < c.r || c.y > ALTO - c.r) lista.push(`${c.nombre} fuera de la cancha`);
  }
  for (let i = 0; i < cosas.length; i += 1) {
    for (let j = i + 1; j < cosas.length; j += 1) {
      const a = cosas[i];
      const b = cosas[j];
      if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (a.r + b.r + 2) ** 2) lista.push(`${a.nombre} encima de ${b.nombre}`);
    }
  }
  const k = posicionKapi(def.kapi, 0);
  if (k) for (const c of cosas) if ((c.x - k.x) ** 2 + (c.y - k.y) ** 2 < (c.r + RADIO.kapi + 2) ** 2) lista.push(`${c.nombre} encima de Kapi`);
  return lista;
}
