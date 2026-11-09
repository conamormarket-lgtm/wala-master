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
 * La cancha de La Pichanga de Kapi: una mesita de juguete (la bandeja violeta
 * de la portada) con el pasto adentro, dibujada en un canvas. Liviano: solo se
 * redibuja cuando algo cambia o rueda (nada se anima en bucle). Los efectos
 * salen de lo que hace la persona: el aro al tirar, la estela y el giro de la
 * pelota, los destellos de cada choque y la red que se estira con el gol.
 * Se apunta arrastrando desde una chapa tuya hacia atrás, como una
 * resortera; al soltar, onTiro.
 */

/** La bandeja: cuánto sobresale de la cancha (a los costados y detrás de los arcos). */
const BANDEJA = { lado: 30, fondo: FONDO_ARCO + 22, radio: 48 };
/** Lo que se ve (unidades del motor): la bandeja y un margen para su sombra. */
const VISTA = { x: -BANDEJA.lado - 8, y: -BANDEJA.fondo - 8, w: ANCHO + 2 * (BANDEJA.lado + 8), h: ALTO + 2 * (BANDEJA.fondo + 8) + 10 };
/** Cuánto del arrastre se vuelve tiro (con 125 unidades de arrastre, fuerza completa). */
const GANANCIA = MAX_TIRO / 125;
/** Los pasos que dura un destello de choque. */
const VIDA_DESTELLO = 16;

export const ASPECTO_CANCHA = `${VISTA.w} / ${VISTA.h}`;

/* Las caras de Kapi (sus chapas y el arquero): se bajan una vez. */
const caras = {};
const esperando = new Set();
function cara(tipo, alListo) {
  if (typeof Image === 'undefined') return null;
  const img = caras[tipo];
  if (img?.complete && img.naturalWidth) return img;
  if (alListo) esperando.add(alListo);
  if (!img) {
    const nueva = new Image();
    nueva.decoding = 'async';
    nueva.onload = () => { esperando.forEach((f) => f()); esperando.clear(); };
    nueva.src = CARAS_KAPI_MINI[tipo] || CARAS_KAPI_MINI.feliz;
    caras[tipo] = nueva;
  }
  return null;
}

/* ── Dibujos sueltos ──────────────────────────────────── */

const circulo = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };

function redondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function estrella(ctx, x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 10; k += 1) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function sombra(ctx, x, y, r, alto = 0.16) {
  ctx.fillStyle = 'rgba(20, 10, 40, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.08, y + r * alto + 2, r * 0.98, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
}

function brillo(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.3, y - r * 0.42, r * 0.38, r * 0.17, -0.5, 0, Math.PI * 2);
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

/** El borde de una tapita: los dientes plateados, con un lado en sombra. */
function dientes(ctx, x, y, r) {
  const n = 22;
  ctx.beginPath();
  for (let k = 0; k < n * 2; k += 1) {
    const a = (k * Math.PI) / n;
    const rr = k % 2 ? r * 0.9 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, '#eef1f5');
  g.addColorStop(0.55, '#b9c0ca');
  g.addColorStop(1, '#868e99');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = r * 0.04;
  ctx.strokeStyle = '#6b7280';
  ctx.stroke();
}

/**
 * Una chapa (una tapita con su borde plateado) con el dibujo de su equipo.
 *  - equipo: { colores: [fondo, detalle], dibujo, borde? } · imagen: la cara de Kapi (sus chapas)
 */
export function dibujarChapa(ctx, x, y, radio, equipo, imagen = null) {
  sombra(ctx, x, y, radio);
  dientes(ctx, x, y, radio);
  const r = radio * 0.8;
  const [a, b2] = equipo.colores;
  ctx.save();
  circulo(ctx, x, y, r);
  ctx.clip();
  ctx.fillStyle = a;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.fillStyle = b2;
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
      estrella(ctx, x, y, r * 0.58);
      ctx.fill();
      break;
    case 'aro':
      ctx.lineWidth = r * 0.18;
      ctx.strokeStyle = b2;
      circulo(ctx, x, y, r * 0.52);
      ctx.stroke();
      break;
    case 'cara':
      if (imagen) ctx.drawImage(imagen, x - r * 0.98, y - r * 0.92, r * 1.96, r * 1.96);
      break;
    default:
      break;
  }
  // El canto de la tapa: más oscuro abajo, como en relieve.
  const canto = ctx.createLinearGradient(x, y - r, x, y + r);
  canto.addColorStop(0, 'rgba(255,255,255,0.18)');
  canto.addColorStop(0.6, 'rgba(255,255,255,0)');
  canto.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = canto;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
  ctx.lineWidth = r * 0.09;
  ctx.strokeStyle = equipo.borde || 'rgba(255,255,255,0.4)';
  circulo(ctx, x, y, r - r * 0.05);
  ctx.stroke();
  brillo(ctx, x, y, r);
}

/** La pelota: fondo y parches, girada `giro` radianes (rueda al moverse). */
export function dibujarPelota(ctx, x, y, r, pelota, giro = 0) {
  sombra(ctx, x, y, r, 0.3);
  const [a, b2] = pelota.colores;
  ctx.fillStyle = a;
  circulo(ctx, x, y, r);
  ctx.fill();
  ctx.save();
  circulo(ctx, x, y, r);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(giro);
  ctx.fillStyle = b2;
  // El pentágono del centro y los cinco de alrededor (cortados por el borde).
  const penta = (cx, cy, rr, rot) => {
    ctx.beginPath();
    for (let k = 0; k < 5; k += 1) {
      const ang = rot + (k * 2 * Math.PI) / 5;
      ctx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
    }
    ctx.closePath();
    ctx.fill();
  };
  penta(0, 0, r * 0.36, -Math.PI / 2);
  for (let k = 0; k < 5; k += 1) {
    const ang = -Math.PI / 2 + (k * 2 * Math.PI) / 5 + Math.PI / 5;
    penta(Math.cos(ang) * r * 0.98, Math.sin(ang) * r * 0.98, r * 0.32, ang);
  }
  ctx.restore();
  // Relieve: más oscuro abajo a la derecha.
  const luz = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  luz.addColorStop(0, 'rgba(255,255,255,0.35)');
  luz.addColorStop(0.55, 'rgba(255,255,255,0)');
  luz.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = luz;
  circulo(ctx, x, y, r);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  circulo(ctx, x, y, r);
  ctx.stroke();
}

/** Las chapas de Kapi (los rivales): rojas, como en la portada, con su cara. */
export const EQUIPO_KAPI = { colores: ['#ef4444', '#ffffff'], dibujo: 'cara' };

/* ── La mesita ───────────────────────────────────────── */

/** La bandeja violeta: sombra, borde con relieve y el piso de adentro. */
function dibujarBandeja(ctx, tono) {
  const x = -BANDEJA.lado;
  const y = -BANDEJA.fondo;
  const w = ANCHO + 2 * BANDEJA.lado;
  const h = ALTO + 2 * BANDEJA.fondo;
  // La sombra sobre el suelo de la escena.
  ctx.fillStyle = 'rgba(30, 10, 60, 0.28)';
  redondeado(ctx, x + 4, y + 14, w, h, BANDEJA.radio);
  ctx.fill();
  // El canto (lo de abajo, más oscuro) y la cara de arriba.
  ctx.fillStyle = tono[2];
  redondeado(ctx, x, y + 8, w, h, BANDEJA.radio);
  ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, tono[0]);
  g.addColorStop(1, tono[1]);
  ctx.fillStyle = g;
  redondeado(ctx, x, y, w, h, BANDEJA.radio);
  ctx.fill();
  // El brillo del borde de arriba.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  redondeado(ctx, x + 3, y + 3, w - 6, h - 6, BANDEJA.radio - 3);
  ctx.stroke();
  // El piso de adentro (donde van los arcos).
  ctx.fillStyle = tono[3];
  redondeado(ctx, -12, -FONDO_ARCO - 8, ANCHO + 24, ALTO + 2 * FONDO_ARCO + 16, 26);
  ctx.fill();
}

/* El pasto: franjas, textura fija y, en invierno, escarcha. */
function dibujarPasto(ctx, pasto, escena) {
  ctx.save();
  redondeado(ctx, 0, 0, ANCHO, ALTO, 14);
  ctx.clip();
  for (let k = 0; k < 12; k += 1) {
    ctx.fillStyle = k % 2 ? pasto[1] : pasto[0];
    ctx.fillRect(0, k * (ALTO / 12), ANCHO, ALTO / 12);
  }
  // Textura: briznas cortas, siempre en el mismo lugar.
  let semilla = 7;
  const azarFijo = () => { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; };
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let k = 0; k < 260; k += 1) {
    const px = azarFijo() * ANCHO;
    const py = azarFijo() * ALTO;
    ctx.moveTo(px, py);
    ctx.lineTo(px + 2, py - 6);
  }
  ctx.stroke();
  if (escena === 'invierno') {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let k = 0; k < 140; k += 1) {
      circulo(ctx, azarFijo() * ANCHO, azarFijo() * ALTO, 1.5 + azarFijo() * 2.5);
      ctx.fill();
    }
  }
  // Sombra interior: el pasto queda un poco hundido en la bandeja.
  const borde = 22;
  for (const [x0, y0, x1, y1, w, h] of [[0, 0, 0, borde, ANCHO, borde], [0, ALTO, 0, ALTO - borde, ANCHO, -borde]]) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(0,0,0,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, h);
  }
  ctx.restore();
}

function dibujarZona(ctx, z) {
  ctx.save();
  redondeado(ctx, z.x, z.y, z.w, z.h, 30);
  if (z.tipo === 'barro') {
    ctx.fillStyle = 'rgba(121, 85, 50, 0.78)';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(78, 52, 30, 0.55)';
    let semilla = (z.x * 31 + z.y * 17 + z.w) % 997;
    for (let k = 0; k < Math.ceil((z.w * z.h) / 2200); k += 1) {
      semilla = (semilla * 73 + 41) % 997;
      const px = z.x + (semilla / 997) * z.w;
      semilla = (semilla * 73 + 41) % 997;
      const py = z.y + (semilla / 997) * z.h;
      ctx.beginPath();
      ctx.ellipse(px, py, 6 + (semilla % 9), 4 + (semilla % 5), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let k = 0; k < 6; k += 1) {
      circulo(ctx, z.x + ((k * 53) % z.w), z.y + ((k * 37) % z.h), 3);
      ctx.fill();
    }
  } else {
    const g = ctx.createLinearGradient(z.x, z.y, z.x + z.w, z.y + z.h);
    g.addColorStop(0, 'rgba(224, 242, 254, 0.92)');
    g.addColorStop(1, 'rgba(186, 230, 253, 0.85)');
    ctx.fillStyle = g;
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
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.35)';
    ctx.lineWidth = 2;
    redondeado(ctx, z.x + 1, z.y + 1, z.w - 2, z.h - 2, 29);
    ctx.stroke();
  }
  ctx.restore();
}

function dibujarLineas(ctx, def, linea) {
  ctx.strokeStyle = linea;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, ANCHO - 12, ALTO - 12);
  ctx.beginPath();
  ctx.moveTo(6, ALTO / 2); ctx.lineTo(ANCHO - 6, ALTO / 2);
  ctx.stroke();
  circulo(ctx, ANCHO / 2, ALTO / 2, 78);
  ctx.stroke();
  ctx.fillStyle = linea;
  circulo(ctx, ANCHO / 2, ALTO / 2, 5);
  ctx.fill();
  for (const arriba of [true, false]) {
    const y = arriba ? 6 : ALTO - 6;
    const sg = arriba ? 1 : -1;
    ctx.strokeRect(110, Math.min(y, y + sg * 160), 380, 160);
    ctx.strokeRect(195, Math.min(y, y + sg * 64), 210, 64);
    circulo(ctx, ANCHO / 2, y + sg * 215, 5);
    ctx.fill();
    // El arco del área.
    ctx.beginPath();
    ctx.arc(ANCHO / 2, y + sg * 215, 70, arriba ? 0.2 * Math.PI : 1.2 * Math.PI, arriba ? 0.8 * Math.PI : 1.8 * Math.PI);
    ctx.stroke();
  }
  // Las esquinas.
  for (const [x, y, a0] of [[6, 6, 0], [ANCHO - 6, 6, 0.5], [ANCHO - 6, ALTO - 6, 1], [6, ALTO - 6, 1.5]]) {
    ctx.beginPath();
    ctx.arc(x, y, 16, a0 * Math.PI, (a0 + 0.5) * Math.PI);
    ctx.stroke();
  }
  void def;
}

/**
 * Un arco con su red. `bulto`: { x, y, fuerza } donde la pelota estira la red
 * (o null).
 */
function dibujarArco(ctx, ancho, arriba, bulto) {
  if (!ancho) return;
  const izq = ANCHO / 2 - ancho / 2;
  const der = ANCHO / 2 + ancho / 2;
  const linea = arriba ? 0 : ALTO;
  const fondo = arriba ? -FONDO_ARCO : ALTO + FONDO_ARCO;
  const meter = 8; // el fondo de la red se ve un poco más angosto (perspectiva)
  // Hacia dónde empuja la pelota cada punto de la red.
  const empuje = (x, y) => {
    if (!bulto) return [x, y];
    const d = Math.sqrt((x - bulto.x) ** 2 + (y - bulto.y) ** 2);
    const f = Math.max(0, 1 - d / 70) * bulto.fuerza;
    return [x + ((x - bulto.x) / (d || 1)) * f * 5, y + (arriba ? -1 : 1) * f * 14];
  };
  // El piso del arco (sombra de la red).
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(izq, linea); ctx.lineTo(izq + meter, fondo); ctx.lineTo(der - meter, fondo); ctx.lineTo(der, linea);
  ctx.closePath();
  ctx.fill();
  // La red: hilos cruzados, estirados donde está la pelota.
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.4;
  const pasos = 8;
  for (let k = 0; k <= 16; k += 1) {
    const t = k / 16;
    ctx.beginPath();
    for (let j = 0; j <= pasos; j += 1) {
      const u = j / pasos;
      const x = izq + (der - izq) * t + (u * meter) * (1 - 2 * t);
      const y = linea + (fondo - linea) * u;
      const [px, py] = empuje(x, y);
      if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  for (let j = 1; j <= 5; j += 1) {
    const u = j / 5;
    ctx.beginPath();
    for (let k = 0; k <= 16; k += 1) {
      const t = k / 16;
      const x = izq + (der - izq) * t + (u * meter) * (1 - 2 * t);
      const y = linea + (fondo - linea) * u;
      const [px, py] = empuje(x, y);
      if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  // El marco: los palos de atrás, finos, y el travesaño grueso con sombra.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(izq, linea); ctx.lineTo(izq + meter, fondo); ctx.lineTo(der - meter, fondo); ctx.lineTo(der, linea);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(izq, linea + (arriba ? 4 : -4)); ctx.lineTo(der, linea + (arriba ? 4 : -4));
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(izq, linea); ctx.lineTo(der, linea);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function dibujarPostes(ctx, def) {
  for (const p of postes(def)) {
    sombra(ctx, p.x, p.y, RADIO.poste + 2);
    const g = ctx.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, RADIO.poste + 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = g;
    circulo(ctx, p.x, p.y, RADIO.poste + 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
  }
}

function dibujarConos(ctx, def) {
  for (const [x, y] of def.conos) {
    const r = RADIO.cono;
    sombra(ctx, x, y, r, 0.35);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 1, x, y, r);
    g.addColorStop(0, '#fdba74');
    g.addColorStop(1, '#ea580c');
    ctx.fillStyle = g;
    circulo(ctx, x, y, r);
    ctx.fill();
    ctx.lineWidth = r * 0.28;
    ctx.strokeStyle = '#ffffff';
    circulo(ctx, x, y, r * 0.58);
    ctx.stroke();
    ctx.fillStyle = '#9a3412';
    circulo(ctx, x, y, r * 0.22);
    ctx.fill();
  }
}

/** Kapi de arquero: una chapa grande con su cara (feliz o triste) y guantes. */
function dibujarKapi(ctx, pos, carita) {
  if (!pos) return;
  const r = RADIO.kapi;
  for (const lado of [-1, 1]) {
    ctx.fillStyle = '#f59e0b';
    circulo(ctx, pos.x + lado * r * 1.02, pos.y + r * 0.15, r * 0.3);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#b45309';
    ctx.stroke();
  }
  dibujarChapa(ctx, pos.x, pos.y, r, { colores: ['#fde68a', '#facc15'], dibujo: 'cara', borde: '#ca8a04' }, carita);
}

/** Un destello de choque: un aro que se abre y cuatro rayitas. */
function dibujarDestello(ctx, d, edad) {
  const vida = 1 - edad;
  if (vida <= 0) return;
  const color = d.tipo === 'poste' ? '255, 230, 120' : d.tipo === 'kapi' ? '253, 186, 116' : d.tipo === 'gol' ? '255, 255, 255' : '255, 255, 255';
  const grande = d.tipo === 'gol' ? 2.2 : d.tipo === 'poste' ? 1.4 : Math.min(1.2, 0.5 + (d.fuerza || 4) / 14);
  ctx.strokeStyle = `rgba(${color}, ${0.85 * vida})`;
  ctx.lineWidth = 3 * vida + 1;
  circulo(ctx, d.x, d.y, (10 + edad * 30) * grande);
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let k = 0; k < 4; k += 1) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const r0 = (14 + edad * 26) * grande;
    const r1 = r0 + 10 * vida * grande;
    ctx.beginPath();
    ctx.moveTo(d.x + Math.cos(a) * r0, d.y + Math.sin(a) * r0);
    ctx.lineTo(d.x + Math.cos(a) * r1, d.y + Math.sin(a) * r1);
    ctx.stroke();
  }
}

/** La flecha del tiro y el aro de fuerza alrededor de la chapa. */
function dibujarApunte(ctx, c, dedo, tiro) {
  const [dx, dy] = tiro;
  const largo = Math.sqrt(dx * dx + dy * dy);
  const fuerza = largo / MAX_TIRO;
  const color = `hsl(${Math.round(130 - fuerza * 125)}, 85%, 52%)`;
  // La liga hacia el dedo.
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(dedo.x, dedo.y);
  ctx.stroke();
  ctx.setLineDash([]);
  // El aro de fuerza.
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 9;
  circulo(ctx, c.x, c.y, c.r + 12);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r + 12, -Math.PI / 2, -Math.PI / 2 + fuerza * Math.PI * 2);
  ctx.stroke();
  // La flecha.
  const ux = dx / largo;
  const uy = dy / largo;
  const fin = 40 + fuerza * 180;
  const x1 = c.x + ux * (c.r + 20);
  const y1 = c.y + uy * (c.r + 20);
  const x2 = c.x + ux * (c.r + 20 + fin);
  const y2 = c.y + uy * (c.r + 20 + fin);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 14;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x2 + ux * 26, y2 + uy * 26);
  ctx.lineTo(x2 - uy * 19, y2 + ux * 19);
  ctx.lineTo(x2 + uy * 19, y2 - ux * 19);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2 + ux * 20, y2 + uy * 20);
  ctx.lineTo(x2 - uy * 13, y2 + ux * 13);
  ctx.lineTo(x2 + uy * 13, y2 - ux * 13);
  ctx.closePath();
  ctx.fill();
  // La guía: hacia dónde sigue.
  ctx.setLineDash([2, 12]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x2 + ux * 32, y2 + uy * 32);
  ctx.lineTo(x2 + ux * 150, y2 + uy * 150);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
}

/** Los colores de la bandeja (cara, cara, canto, piso) según la escena. */
const BANDEJAS = {
  noche: ['#6d28d9', '#4c1d95', '#2e1065', '#1e1b4b'],
  invierno: ['#a78bfa', '#7c3aed', '#5b21b6', '#4c1d95'],
  default: ['#a78bfa', '#7c3aed', '#5b21b6', '#4c1d95'],
};

/**
 * La cancha.
 *  - def: la cancha armada (motor) · cuerpos: lo que se mueve, quieto · t: el
 *    reloj de Kapi (dónde está el arquero)
 *  - equipo, pelota: cómo se ven tus chapas y la pelota (vestuario) · pasto,
 *    linea: los colores del mundo o del estadio · escena: la del fondo
 *    ('invierno' pone escarcha en el pasto; 'noche', la bandeja oscura)
 *  - caraArquero: 'feliz' | 'triste' (Kapi ataja o le meten gol)
 *  - puedeTirar: se puede apuntar con tus chapas · onTiro([chapa, dx, dy]) ·
 *    onApuntar(tiro | null): mientras se arrastra (para la vista del tiro)
 *  - ruta: [[x, y]] la trayectoria prevista de la pelota (la ayuda "Ver el tiro")
 *  - animacion: { id, cuadros, golpes, t0, velocidad, tirador, gol } lo que
 *    rueda (lo arma simular); al terminar, onFinAnimacion(id). onGolpe(tipo,
 *    fuerza): cada choque (para el sonido)
 *  - resaltar: el índice de una chapa a marcar (la que va a tirar Kapi)
 */
export function CanchaPichanga({
  def, cuerpos, t = 0, equipo, pelota, pasto, linea, escena, caraArquero = 'feliz', puedeTirar = false, onTiro, onApuntar, ruta,
  animacion, onFinAnimacion, onGolpe, resaltar = null, etiqueta = 'La cancha',
}) {
  const lienzo = useRef(null);
  const marco = useRef(null);
  const apunte = useRef(null); // { i, dedo: { x, y }, tiro }
  const cuadro = useRef(null); // lo que se ve mientras rueda
  const giro = useRef(0); // cuánto giró la pelota (queda girada al parar)
  const props = useRef({});
  props.current = { def, cuerpos, t, equipo, pelota, pasto, linea, escena, caraArquero, ruta, resaltar, puedeTirar };
  const nombre = useTexto(etiqueta);

  const dibujar = () => {
    const cv = lienzo.current;
    if (!cv || !cv.width) return;
    const ctx = cv.getContext('2d');
    const p = props.current;
    const escala = cv.width / VISTA.w;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(escala, 0, 0, escala, -VISTA.x * escala, -VISTA.y * escala);
    const feliz = cara('feliz', dibujar);
    const arquero = cara(p.caraArquero, dibujar) || feliz;
    const ahora = cuadro.current;
    dibujarBandeja(ctx, BANDEJAS[p.escena] || BANDEJAS.default);
    dibujarPasto(ctx, p.pasto, p.escena);
    for (const z of p.def.zonas) dibujarZona(ctx, z);
    dibujarLineas(ctx, p.def, p.linea);
    dibujarArco(ctx, p.def.arcos.arriba, true, ahora?.bulto?.arriba ? ahora.bulto : null);
    dibujarArco(ctx, p.def.arcos.abajo, false, ahora?.bulto && !ahora.bulto.arriba ? ahora.bulto : null);
    dibujarConos(ctx, p.def);
    const lista = ahora ? ahora.cuerpos : p.cuerpos;
    // La trayectoria prevista (debajo de todo lo que se mueve).
    if (p.ruta?.length > 1 && !ahora) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let k = 0; k < p.ruta.length; k += 4) {
        circulo(ctx, p.ruta[k][0], p.ruta[k][1], 4);
        ctx.fill();
      }
    }
    // El aro del tiro, donde salió la chapa.
    if (ahora?.impulso) {
      const { x, y, edad } = ahora.impulso;
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - edad)})`;
      ctx.lineWidth = 5 * (1 - edad) + 1;
      circulo(ctx, x, y, RADIO.chapa + 6 + edad * 40);
      ctx.stroke();
    }
    // La estela de la pelota.
    if (ahora?.estela?.length) {
      ahora.estela.forEach(([x, y], k) => {
        const f = (k + 1) / (ahora.estela.length + 1);
        ctx.fillStyle = `rgba(255,255,255,${0.35 * f})`;
        circulo(ctx, x, y, RADIO.pelota * (0.45 + 0.5 * f));
        ctx.fill();
      });
    }
    dibujarPostes(ctx, p.def);
    dibujarKapi(ctx, posicionKapi(p.def.kapi, ahora ? ahora.t : p.t), arquero);
    lista.forEach((c, i) => {
      if (c.tipo === 'pelota') return;
      if (p.puedeTirar && !ahora && c.equipo === 'mia') {
        ctx.setLineDash([8, 7]);
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 3;
        circulo(ctx, c.x, c.y, c.r + 8);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (p.resaltar === i && !ahora) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 5;
        circulo(ctx, c.x, c.y, c.r + 9);
        ctx.stroke();
      }
      dibujarChapa(ctx, c.x, c.y, c.r, c.equipo === 'mia' ? p.equipo : EQUIPO_KAPI, feliz);
    });
    const bola = lista.find((c) => c.tipo === 'pelota');
    if (bola) dibujarPelota(ctx, bola.x, bola.y, bola.r, p.pelota, giro.current);
    if (ahora?.destellos) for (const d of ahora.destellos) dibujarDestello(ctx, d, d.edad);
    const a = apunte.current;
    if (a?.tiro && !ahora) dibujarApunte(ctx, lista[a.i], a.dedo, a.tiro);
  };

  // La mesita entra entera en el lugar que tiene (a lo ancho y a lo alto) y
  // el canvas se ve nítido en cualquier pantalla.
  useEffect(() => {
    const cv = lienzo.current;
    const caja = marco.current;
    if (!cv || !caja) return undefined;
    const ajustar = () => {
      const anchoLibre = caja.clientWidth;
      const altoLibre = caja.clientHeight || anchoLibre / (VISTA.w / VISTA.h);
      const ancho = Math.floor(Math.min(anchoLibre, altoLibre * (VISTA.w / VISTA.h)));
      const alto = Math.floor(ancho * (VISTA.h / VISTA.w));
      cv.style.width = `${ancho}px`;
      cv.style.height = `${alto}px`;
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      const w = Math.round(ancho * dpr);
      const h = Math.round(alto * dpr);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
      dibujar();
    };
    ajustar();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(ajustar);
    ro.observe(caja);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lo quieto se redibuja cuando cambia.
  useEffect(() => { if (!cuadro.current) dibujar(); });

  // Lo que rueda: un paso del motor por cuadro (o menos, en cámara lenta). Con
  // gol, la pelota sigue un poco hasta la red y la estira.
  useEffect(() => {
    if (!animacion) return undefined;
    const { cuadros, golpes = [], t0 = 0, velocidad = 1, id, tirador = null, gol = null } = animacion;
    const base = cuerpos;
    const kb = base.findIndex((c) => c.tipo === 'pelota');
    // Lo que recorrió la pelota hasta cada paso (para que gire al rodar).
    const recorrido = [0];
    for (let k = 1; k < cuadros.length; k += 1) {
      const [x0, y0] = cuadros[k - 1][kb];
      const [x1, y1] = cuadros[k][kb];
      recorrido.push(recorrido[k - 1] + Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2));
    }
    const giro0 = giro.current;
    const ultimo = cuadros.length - 1;
    const extra = gol ? 16 : 0; // pasos de la pelota metiéndose en la red
    const fin = cuadros[ultimo][kb];
    const red = gol === 'abajo' ? ALTO + FONDO_ARCO - RADIO.pelota - 2 : -FONDO_ARCO + RADIO.pelota + 2;
    let pos = 0;
    let previo = null;
    let golpe = 0;
    let vivo = true;
    let raf = 0;
    const posEn = (k, n) => {
      const i = Math.min(Math.floor(k), ultimo);
      const j = Math.min(i + 1, ultimo);
      const f = Math.min(1, k - i);
      return [
        cuadros[i][n][0] + (cuadros[j][n][0] - cuadros[i][n][0]) * f,
        cuadros[i][n][1] + (cuadros[j][n][1] - cuadros[i][n][1]) * f,
      ];
    };
    const ver = (k) => {
      const enRed = Math.max(0, k - ultimo) / (extra || 1); // 0 → 1 después del gol
      const lista = base.map((c, n) => {
        let [x, y] = posEn(k, n);
        if (n === kb && enRed > 0) {
          const e = 1 - (1 - enRed) ** 3;
          y = fin[1] + (red - fin[1]) * e;
          x = fin[0];
        }
        return { ...c, x, y };
      });
      const bola = lista[kb];
      const kk = Math.min(k, ultimo);
      giro.current = giro0 + recorrido[Math.floor(kk)] / RADIO.pelota + (enRed > 0 ? enRed * 0.8 : 0);
      const estela = [];
      for (let s2 = 8; s2 >= 1; s2 -= 1) {
        const kp = kk - s2 * 1.5;
        if (kp >= 0) estela.push(posEn(kp, kb));
      }
      const destellos = golpes
        .filter((g) => g[0] <= kk + 0.5 && kk - g[0] < VIDA_DESTELLO && g[3] != null && (g[2] > 2 || g[1] === 'poste' || g[1] === 'kapi'))
        .map((g) => ({ tipo: g[1], fuerza: g[2], x: g[3], y: g[4], edad: (kk - g[0]) / VIDA_DESTELLO }));
      if (enRed > 0) destellos.push({ tipo: 'gol', x: bola.x, y: bola.y, edad: enRed * 0.9 });
      const impulso = tirador != null && k < 14 ? { x: cuadros[0][tirador][0], y: cuadros[0][tirador][1], edad: k / 14 } : null;
      const bulto = enRed > 0 || (gol && k > ultimo - 3)
        ? { x: bola.x, y: bola.y, fuerza: 1 - Math.max(0, enRed - 0.6) * 1.5, arriba: gol !== 'abajo' }
        : null;
      cuadro.current = { t: t0 + Math.min(k, ultimo), cuerpos: lista, estela: enRed > 0 ? [] : estela, destellos, impulso, bulto };
      dibujar();
    };
    const avanzar = (ahora) => {
      if (!vivo) return;
      const dt = previo === null ? 1 / 60 : Math.min(0.05, (ahora - previo) / 1000);
      previo = ahora;
      pos += dt * 60 * (pos > ultimo ? Math.min(velocidad, 0.6) : velocidad);
      while (golpe < golpes.length && golpes[golpe][0] <= pos) {
        onGolpe?.(golpes[golpe][1], golpes[golpe][2]);
        golpe += 1;
      }
      if (pos >= ultimo + extra) {
        ver(ultimo + extra);
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
      if (dist <= c.r + 26 && (!mejor || dist < mejor.dist)) mejor = { i, dist };
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
    <div ref={marco} className={s.marcoCancha}>
      <canvas
        ref={lienzo}
        className={[s.cancha, puedeTirar && s.canchaLista].filter(Boolean).join(' ')}
        role="img"
        aria-label={nombre}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        data-componente="CanchaPichanga"
      />
    </div>
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
      if (tipo === 'pelota') dibujarPelota(ctx, tamano / 2, tamano / 2, r * 0.8, item, 0.3);
      else dibujarChapa(ctx, tamano / 2, tamano / 2, r, item, item.dibujo === 'cara' ? cara('feliz', pintar) : null);
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
