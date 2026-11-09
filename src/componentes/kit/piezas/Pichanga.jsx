import React, { useEffect, useRef, useState } from 'react';
import { Trophy, LogIn } from 'lucide-react';
import Boton from '../Boton';
import { Hueso } from '../Esqueletos';
import { Pestanas } from '../Navegacion';
import { TextoResaltado } from './TextoResaltado';
import { Texto, useTexto } from '../Traduccion';
import { CARAS_KAPI_MINI } from './Flotantes';
import {
  ANCHO, ALTO, FONDO_ARCO, RADIO, MAX_TIRO, normalizarTiro, posicionKapi, postes,
} from './pichangaMotor.mjs';
import s from './Pichanga.module.css';
import b from './Bolitas.module.css';

/*
 * La cancha de La Pichanga de Kapi, dibujada en un canvas (liviano: solo se
 * redibuja cuando algo cambia o rueda; nada se anima en bucle). Se apunta
 * arrastrando desde una chapa tuya hacia atrás, como una resortera: la flecha
 * dice hacia dónde sale y con cuánta fuerza; al soltar, onTiro.
 */

/** Lo que se ve de la cancha (unidades del motor): un margen y los dos arcos. */
const VISTA = { x: -14, y: -FONDO_ARCO - 14, w: ANCHO + 28, h: ALTO + 2 * (FONDO_ARCO + 14) };
/** Cuánto del arrastre se vuelve tiro (con 125 unidades de arrastre, fuerza completa). */
const GANANCIA = MAX_TIRO / 125;

export const ASPECTO_CANCHA = `${VISTA.w} / ${VISTA.h}`;

/* La cara de Kapi para sus chapas y para el arquero (se baja una vez). */
let caraKapi = null;
const esperandoCara = new Set();
function cargarCara(alListo) {
  if (typeof Image === 'undefined') return null;
  if (caraKapi?.complete && caraKapi.naturalWidth) return caraKapi;
  esperandoCara.add(alListo);
  if (!caraKapi) {
    caraKapi = new Image();
    caraKapi.decoding = 'async';
    caraKapi.onload = () => { esperandoCara.forEach((f) => f()); esperandoCara.clear(); };
    caraKapi.src = CARAS_KAPI_MINI.feliz;
  }
  return null;
}

/* ── Dibujos sueltos ──────────────────────────────────── */

const circulo = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };

function estrella(ctx, x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 10; k += 1) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function sombra(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  circulo(ctx, x + r * 0.1, y + r * 0.14, r);
  ctx.fill();
}

function brillo(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.42, r * 0.36, r * 0.18, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Una huellita (la de la portada), centrada en x, y. */
function huella(ctx, x, y, r) {
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.28, r * 0.42, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy, rx, ry] of [[-0.5, -0.12, 0.17, 0.21], [-0.19, -0.42, 0.17, 0.22], [0.19, -0.42, 0.17, 0.22], [0.5, -0.12, 0.17, 0.21]]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * r, y + dy * r, rx * r, ry * r, dx * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** El borde de una tapita: los dientes plateados. */
function dientes(ctx, x, y, r) {
  const n = 21;
  ctx.beginPath();
  for (let k = 0; k < n * 2; k += 1) {
    const a = (k * Math.PI) / n;
    const rr = k % 2 ? r * 0.9 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = '#c3c8d0';
  ctx.fill();
  ctx.lineWidth = r * 0.05;
  ctx.strokeStyle = '#8b929c';
  ctx.stroke();
}

/**
 * Una chapa (una tapita con su borde plateado) con el dibujo de su equipo.
 *  - equipo: { colores: [fondo, detalle], dibujo, borde? } · cara: la imagen de Kapi (sus chapas)
 */
export function dibujarChapa(ctx, x, y, radio, equipo, cara = null) {
  sombra(ctx, x, y, radio);
  dientes(ctx, x, y, radio);
  const r = radio * 0.82;
  const [a, b] = equipo.colores;
  ctx.save();
  circulo(ctx, x, y, r);
  ctx.clip();
  ctx.fillStyle = a;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.fillStyle = b;
  switch (equipo.dibujo) {
    case 'huella':
      huella(ctx, x, y, r * 0.78);
      break;
    case 'franjas':
      for (let k = -2; k <= 2; k += 2) ctx.fillRect(x + k * r * 0.4 - r * 0.2, y - r, r * 0.4, 2 * r);
      break;
    case 'mitad':
      ctx.fillRect(x, y - r, r, 2 * r);
      break;
    case 'banda':
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 4);
      ctx.fillRect(-r, -r * 0.24, 2 * r, r * 0.48);
      break;
    case 'estrella':
      estrella(ctx, x, y, r * 0.55);
      ctx.fill();
      break;
    case 'aro':
      ctx.lineWidth = r * 0.18;
      ctx.strokeStyle = b;
      circulo(ctx, x, y, r * 0.52);
      ctx.stroke();
      break;
    case 'cara':
      if (cara) ctx.drawImage(cara, x - r * 0.95, y - r * 0.9, r * 1.9, r * 1.9);
      break;
    default:
      break;
  }
  ctx.restore();
  ctx.lineWidth = r * 0.1;
  ctx.strokeStyle = equipo.borde || 'rgba(255,255,255,0.35)';
  circulo(ctx, x, y, r - r * 0.05);
  ctx.stroke();
  brillo(ctx, x, y, r);
}

/** La pelota: fondo y parches. */
export function dibujarPelota(ctx, x, y, r, pelota) {
  sombra(ctx, x, y, r);
  const [a, b] = pelota.colores;
  ctx.fillStyle = a;
  circulo(ctx, x, y, r);
  ctx.fill();
  ctx.save();
  circulo(ctx, x, y, r);
  ctx.clip();
  ctx.fillStyle = b;
  circulo(ctx, x, y, r * 0.34);
  ctx.fill();
  for (let k = 0; k < 5; k += 1) {
    const ang = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    circulo(ctx, x + Math.cos(ang) * r * 0.98, y + Math.sin(ang) * r * 0.98, r * 0.3);
    ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  circulo(ctx, x, y, r);
  ctx.stroke();
  brillo(ctx, x, y, r);
}

/** Las chapas de Kapi (los rivales): rojas, como en la portada, con su cara. */
export const EQUIPO_KAPI = { colores: ['#ef4444', '#ffffff'], dibujo: 'cara' };

/* ── La cancha ───────────────────────────────────────── */

function dibujarZona(ctx, z) {
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(z.x, z.y, z.w, z.h, 26);
  else ctx.rect(z.x, z.y, z.w, z.h);
  if (z.tipo === 'barro') {
    ctx.fillStyle = 'rgba(121, 85, 50, 0.72)';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(78, 52, 30, 0.55)';
    // Manchas fijas (salen siempre igual para la misma zona).
    let semilla = (z.x * 31 + z.y * 17 + z.w) % 997;
    for (let k = 0; k < Math.ceil((z.w * z.h) / 2600); k += 1) {
      semilla = (semilla * 73 + 41) % 997;
      const px = z.x + (semilla / 997) * z.w;
      semilla = (semilla * 73 + 41) % 997;
      const py = z.y + (semilla / 997) * z.h;
      circulo(ctx, px, py, 4 + (semilla % 7));
      ctx.fill();
    }
  } else {
    ctx.fillStyle = 'rgba(224, 242, 254, 0.82)';
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    for (let k = -z.h; k < z.w; k += 46) {
      ctx.beginPath();
      ctx.moveTo(z.x + k, z.y + z.h);
      ctx.lineTo(z.x + k + z.h * 0.5, z.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function dibujarArco(ctx, ancho, arriba) {
  if (!ancho) return;
  const izq = ANCHO / 2 - ancho / 2;
  const y0 = arriba ? -FONDO_ARCO : ALTO;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(izq, y0, ancho, FONDO_ARCO);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = izq; x <= izq + ancho; x += 12) { ctx.moveTo(x, y0); ctx.lineTo(x, y0 + FONDO_ARCO); }
  for (let y = y0; y <= y0 + FONDO_ARCO; y += 12) { ctx.moveTo(izq, y); ctx.lineTo(izq + ancho, y); }
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  const linea = arriba ? 0 : ALTO;
  ctx.moveTo(izq, linea); ctx.lineTo(izq, arriba ? -FONDO_ARCO : ALTO + FONDO_ARCO);
  ctx.lineTo(izq + ancho, arriba ? -FONDO_ARCO : ALTO + FONDO_ARCO); ctx.lineTo(izq + ancho, linea);
  ctx.stroke();
}

function dibujarCampo(ctx, def, pasto, linea) {
  ctx.fillStyle = pasto[1];
  ctx.fillRect(VISTA.x, VISTA.y, VISTA.w, VISTA.h);
  // Franjas del pasto.
  for (let k = 0; k < 12; k += 1) {
    ctx.fillStyle = k % 2 ? pasto[1] : pasto[0];
    ctx.fillRect(0, k * (ALTO / 12), ANCHO, ALTO / 12);
  }
  for (const z of def.zonas) dibujarZona(ctx, z);
  ctx.strokeStyle = linea;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, ANCHO, ALTO);
  ctx.beginPath();
  ctx.moveTo(0, ALTO / 2); ctx.lineTo(ANCHO, ALTO / 2);
  ctx.stroke();
  circulo(ctx, ANCHO / 2, ALTO / 2, 72);
  ctx.stroke();
  for (const arriba of [true, false]) {
    const y = arriba ? 0 : ALTO;
    const s = arriba ? 1 : -1;
    ctx.strokeRect(120, Math.min(y, y + s * 150), 360, 150);
    ctx.strokeRect(205, Math.min(y, y + s * 56), 190, 56);
    ctx.fillStyle = linea;
    circulo(ctx, ANCHO / 2, y + s * 205, 4);
    ctx.fill();
  }
  dibujarArco(ctx, def.arcos.arriba, true);
  dibujarArco(ctx, def.arcos.abajo, false);
  for (const p of postes(def)) {
    ctx.fillStyle = '#ffffff';
    circulo(ctx, p.x, p.y, RADIO.poste);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.stroke();
  }
  for (const [x, y] of def.conos) {
    sombra(ctx, x, y, RADIO.cono);
    ctx.fillStyle = '#f97316';
    circulo(ctx, x, y, RADIO.cono);
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ffffff';
    circulo(ctx, x, y, RADIO.cono * 0.55);
    ctx.stroke();
  }
}

function dibujarKapi(ctx, pos, cara) {
  if (!pos) return;
  dibujarChapa(ctx, pos.x, pos.y, RADIO.kapi, { colores: ['#fde68a', '#facc15'], dibujo: 'cara', borde: '#ca8a04' }, cara);
}

/** La flecha del tiro, desde la chapa hacia donde sale. */
function dibujarApunte(ctx, c, dedo, tiro) {
  const [dx, dy] = tiro;
  const largo = Math.sqrt(dx * dx + dy * dy);
  const fuerza = largo / MAX_TIRO;
  // La liga hacia el dedo.
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(dedo.x, dedo.y);
  ctx.stroke();
  ctx.setLineDash([]);
  // La flecha: verde suave, amarilla, roja fuerte.
  const ux = dx / largo;
  const uy = dy / largo;
  const fin = 30 + fuerza * 170;
  const x1 = c.x + ux * (c.r + 4);
  const y1 = c.y + uy * (c.r + 4);
  const x2 = c.x + ux * (c.r + fin);
  const y2 = c.y + uy * (c.r + fin);
  const color = `hsl(${Math.round(130 - fuerza * 125)}, 85%, 50%)`;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2 + ux * 18, y2 + uy * 18);
  ctx.lineTo(x2 - uy * 13, y2 + ux * 13);
  ctx.lineTo(x2 + uy * 13, y2 - ux * 13);
  ctx.closePath();
  ctx.fill();
  ctx.lineCap = 'butt';
}

/**
 * La cancha.
 *  - def: la cancha armada (motor) · cuerpos: lo que se mueve, quieto · t: el
 *    reloj de Kapi (dónde está el arquero)
 *  - equipo, pelota: cómo se ven tus chapas y la pelota (vestuario) · pasto,
 *    linea: los colores del mundo o del estadio
 *  - puedeTirar: se puede apuntar con tus chapas · onTiro([chapa, dx, dy]) ·
 *    onApuntar(tiro | null): mientras se arrastra (para la vista del tiro)
 *  - ruta: [[x, y]] la trayectoria prevista de la pelota (la ayuda "Ver el tiro")
 *  - animacion: { id, cuadros, golpes, t0, velocidad } lo que rueda (lo arma
 *    simular); al terminar, onFinAnimacion(id). onGolpe(tipo, fuerza): cada
 *    choque (para el sonido)
 *  - resaltar: el índice de una chapa a marcar (la que va a tirar Kapi)
 */
export function CanchaPichanga({
  def, cuerpos, t = 0, equipo, pelota, pasto, linea, puedeTirar = false, onTiro, onApuntar, ruta,
  animacion, onFinAnimacion, onGolpe, resaltar = null, etiqueta = 'La cancha',
}) {
  const lienzo = useRef(null);
  const apunte = useRef(null); // { i, dedo: { x, y }, tiro }
  const cuadro = useRef(null); // { cuerpos, t } lo que se ve mientras rueda
  const props = useRef({});
  props.current = { def, cuerpos, t, equipo, pelota, pasto, linea, ruta, resaltar, puedeTirar };
  const nombre = useTexto(etiqueta);

  const dibujar = () => {
    const cv = lienzo.current;
    if (!cv || !cv.width) return;
    const ctx = cv.getContext('2d');
    const p = props.current;
    const escala = cv.width / VISTA.w;
    ctx.setTransform(escala, 0, 0, escala, -VISTA.x * escala, -VISTA.y * escala);
    const cara = cargarCara(dibujar);
    dibujarCampo(ctx, p.def, p.pasto, p.linea);
    const ahora = cuadro.current;
    const lista = ahora ? ahora.cuerpos : p.cuerpos;
    // La trayectoria prevista (debajo de todo lo que se mueve).
    if (p.ruta?.length > 1 && !ahora) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let k = 0; k < p.ruta.length; k += 4) {
        circulo(ctx, p.ruta[k][0], p.ruta[k][1], 3.2);
        ctx.fill();
      }
    }
    dibujarKapi(ctx, posicionKapi(p.def.kapi, ahora ? ahora.t : p.t), cara);
    lista.forEach((c, i) => {
      if (c.tipo === 'pelota') return;
      // Tus chapas, marcadas cuando puedes tirar.
      if (p.puedeTirar && !ahora && c.equipo === 'mia') {
        ctx.setLineDash([7, 6]);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2.5;
        circulo(ctx, c.x, c.y, c.r + 7);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (p.resaltar === i && !ahora) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 4;
        circulo(ctx, c.x, c.y, c.r + 8);
        ctx.stroke();
      }
      dibujarChapa(ctx, c.x, c.y, c.r, c.equipo === 'mia' ? p.equipo : EQUIPO_KAPI, cara);
    });
    const bola = lista.find((c) => c.tipo === 'pelota');
    if (bola) dibujarPelota(ctx, bola.x, bola.y, bola.r, p.pelota);
    const a = apunte.current;
    if (a?.tiro && !ahora) dibujarApunte(ctx, lista[a.i], a.dedo, a.tiro);
  };

  // El tamaño del canvas sigue al de la caja (nítido en cualquier pantalla).
  useEffect(() => {
    const cv = lienzo.current;
    if (!cv) return undefined;
    const ajustar = () => {
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      const w = Math.round(cv.clientWidth * dpr);
      const h = Math.round(cv.clientHeight * dpr);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
      dibujar();
    };
    ajustar();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(ajustar);
    ro.observe(cv);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lo quieto se redibuja cuando cambia.
  useEffect(() => { if (!cuadro.current) dibujar(); });

  // Lo que rueda: un paso del motor por cuadro (o menos, en cámara lenta).
  useEffect(() => {
    if (!animacion) return undefined;
    const { cuadros, golpes = [], t0 = 0, velocidad = 1, id } = animacion;
    const base = cuerpos;
    let pos = 0;
    let ultimo = null;
    let golpe = 0;
    let vivo = true;
    let raf = 0;
    const ver = (k) => {
      const i = Math.min(Math.floor(k), cuadros.length - 1);
      const j = Math.min(i + 1, cuadros.length - 1);
      const f = k - i;
      cuadro.current = {
        t: t0 + k,
        cuerpos: base.map((c, n) => ({
          ...c,
          x: cuadros[i][n][0] + (cuadros[j][n][0] - cuadros[i][n][0]) * f,
          y: cuadros[i][n][1] + (cuadros[j][n][1] - cuadros[i][n][1]) * f,
        })),
      };
      dibujar();
    };
    const avanzar = (ahora) => {
      if (!vivo) return;
      const dt = ultimo === null ? 1 / 60 : Math.min(0.05, (ahora - ultimo) / 1000);
      ultimo = ahora;
      pos += dt * 60 * velocidad;
      while (golpe < golpes.length && golpes[golpe][0] <= pos) {
        onGolpe?.(golpes[golpe][1], golpes[golpe][2]);
        golpe += 1;
      }
      if (pos >= cuadros.length - 1) {
        ver(cuadros.length - 1);
        cuadro.current = null;
        onFinAnimacion?.(id);
        return;
      }
      ver(pos);
      raf = requestAnimationFrame(avanzar);
    };
    raf = requestAnimationFrame(avanzar);
    return () => { vivo = false; cancelAnimationFrame(raf); cuadro.current = null; };
  }, [animacion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Apuntar ── */
  const enCancha = (e) => {
    const r = lienzo.current.getBoundingClientRect();
    return {
      x: VISTA.x + ((e.clientX - r.left) / r.width) * VISTA.w,
      y: VISTA.y + ((e.clientY - r.top) / r.height) * VISTA.h,
    };
  };

  const alBajar = (e) => {
    if (!puedeTirar || animacion) return;
    const d = enCancha(e);
    let mejor = null;
    cuerpos.forEach((c, i) => {
      if (c.equipo !== 'mia') return;
      const dist = Math.sqrt((c.x - d.x) ** 2 + (c.y - d.y) ** 2);
      if (dist <= c.r + 22 && (!mejor || dist < mejor.dist)) mejor = { i, dist };
    });
    if (!mejor) return;
    e.preventDefault();
    try { lienzo.current.setPointerCapture?.(e.pointerId); } catch { /* sin captura: igual se apunta */ }
    apunte.current = { i: mejor.i, dedo: d, tiro: null };
  };

  const alMover = (e) => {
    const a = apunte.current;
    if (!a) return;
    const d = enCancha(e);
    const c = cuerpos[a.i];
    const tiro = normalizarTiro((c.x - d.x) * GANANCIA, (c.y - d.y) * GANANCIA);
    a.dedo = d;
    const antes = a.tiro;
    a.tiro = tiro;
    if (Boolean(antes) !== Boolean(tiro) || (tiro && (tiro[0] !== antes?.[0] || tiro[1] !== antes?.[1]))) {
      onApuntar?.(tiro ? [a.i, tiro[0], tiro[1]] : null);
    }
    dibujar();
  };

  const alSoltar = () => {
    const a = apunte.current;
    apunte.current = null;
    if (!a) return;
    onApuntar?.(null);
    if (a.tiro) onTiro?.([a.i, a.tiro[0], a.tiro[1]]);
    else dibujar();
  };

  return (
    <canvas
      ref={lienzo}
      className={[s.cancha, puedeTirar && s.canchaLista].filter(Boolean).join(' ')}
      style={{ aspectRatio: ASPECTO_CANCHA }}
      role="img"
      aria-label={nombre}
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      data-componente="CanchaPichanga"
    />
  );
}

/**
 * Una chapa o una pelota sola (el vestuario). tipo: 'chapa' | 'pelota'.
 */
export function MuestraPichanga({ tipo = 'chapa', item, tamano = 56 }) {
  const lienzo = useRef(null);
  useEffect(() => {
    let vivo = true;
    const pintar = () => {
      const cv = lienzo.current;
      if (!cv || !vivo) return;
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      cv.width = Math.round(tamano * dpr);
      cv.height = Math.round(tamano * dpr);
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, tamano, tamano);
      const r = tamano * 0.4;
      if (tipo === 'pelota') dibujarPelota(ctx, tamano / 2, tamano / 2, r * 0.8, item);
      else dibujarChapa(ctx, tamano / 2, tamano / 2, r, item, item.dibujo === 'cara' ? cargarCara(pintar) : null);
    };
    pintar();
    return () => { vivo = false; };
  }, [tipo, item, tamano]);
  return <canvas ref={lienzo} className={s.muestra} style={{ width: tamano, height: tamano }} aria-hidden="true" />;
}

/** Una cancha chica (el vestuario): las franjas del pasto y una línea. */
export function MuestraEstadio({ estadio, tamano = 56 }) {
  return (
    <span
      className={s.muestraEstadio}
      style={{
        width: tamano,
        height: tamano,
        background: `repeating-linear-gradient(180deg, ${estadio.pasto[0]} 0 10px, ${estadio.pasto[1]} 10px 20px)`,
        '--linea': estadio.linea,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Un ranking con pestañas (el reto: hoy y la semana; los niveles: el top y
 * los goleadores del mes), con el estilo de los de Las Bolitas.
 *  - titulo · pestanas: [{ id, texto, lista: [{ puesto, nombre, yo, … }],
 *    valor: (fila) => texto, vacio, puesto, total, nota }]
 *  - cargando: { [id]: bool } (sin lista todavía: esqueleto) · onPestana(id):
 *    al cambiar de pestaña (para traer esa lista)
 *  - sesion · urlLogin · entrar: el texto para invitar a entrar
 */
export function TablaPichanga({ titulo, pestanas = [], cargando = {}, onPestana, sesion = true, urlLogin = '/login', entrar = 'Inicia sesión para aparecer en el ranking.' }) {
  const [activa, setActiva] = useState(pestanas[0]?.id);
  const t = { tu: useTexto('Tú'), titulo: useTexto(titulo) };
  const p = pestanas.find((x) => x.id === activa) || pestanas[0];
  if (!p) return null;
  const lista = p.lista || [];
  const fuera = p.puesto && !lista.some((f) => f.yo);
  let cuerpo;
  if (cargando[p.id] && !p.lista) {
    cuerpo = (
      <ol className={b.rankingLista} aria-busy="true">
        {[0, 1, 2, 3].map((k) => (
          <li key={k}><Hueso forma="circulo" ancho="1.6rem" alto="1.6rem" /><Hueso ancho={`${70 - k * 10}%`} /><Hueso ancho="3.2rem" /></li>
        ))}
      </ol>
    );
  } else if (!lista.length) {
    cuerpo = <p className={b.rankingVacio}><Texto>{p.vacio}</Texto></p>;
  } else {
    cuerpo = (
      <ol className={b.rankingLista}>
        {lista.map((f) => (
          <li key={`${f.puesto}-${f.nombre}`} className={f.yo ? b.rankingYo : undefined}>
            <span className={[b.rankingPuesto, f.puesto <= 3 && b[`podio${f.puesto}`]].filter(Boolean).join(' ')}>{f.puesto}</span>
            <span className={b.rankingNombre}>{f.nombre}{f.yo && <small>{t.tu}</small>}</span>
            <span className={b.rankingValor}><Texto>{p.valor(f)}</Texto></span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <section className={b.ranking} aria-label={t.titulo} data-componente="TablaPichanga">
      <p className={b.rankingTitulo}><Trophy aria-hidden="true" />{t.titulo}</p>
      {pestanas.length > 1 && (
        <Pestanas
          opciones={pestanas.map((x) => ({ id: x.id, texto: x.texto }))}
          valor={p.id}
          onChange={(id) => { setActiva(id); onPestana?.(id); }}
          etiqueta={titulo}
        />
      )}
      {p.nota && <p className={b.rankingNota}><Texto>{p.nota}</Texto></p>}
      {cuerpo}
      {fuera && (
        <p className={b.rankingNota}>
          <TextoResaltado resaltar={[p.puesto]}>{p.total ? `Vas en el puesto ${p.puesto} de ${p.total}.` : `Vas en el puesto ${p.puesto}.`}</TextoResaltado>
        </p>
      )}
      {!sesion && (
        <div className={b.rankingNota}>
          <Texto>{entrar}</Texto>
          <Boton to={urlLogin} variante="secundario" tamano="sm" icono={<LogIn aria-hidden="true" />}><Texto>Iniciar sesión</Texto></Boton>
        </div>
      )}
    </section>
  );
}
