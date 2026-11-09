import React, { useId, useMemo } from 'react';
import { azar } from './pichangaMotor.mjs';
import s from './FondoBolitas.module.css';

/*
 * El fondo ilustrado de La Pichanga de Walito, como el de Las Bolitas: una
 * escena por mundo (la canchita del barrio, el potrero en invierno), el
 * estadio del reto del día y las canchas del partido (las del vestuario). Son
 * dibujos SVG quietos (diseño animado pero liviano), sin imágenes que bajar;
 * los detalles cambian de lugar con la semilla (el nivel o el día). La mesita
 * de la cancha va encima; arriba, el velo del color de la página deja leer el
 * título (FondoBolitas.module.css).
 */

export const ESCENAS_PICHANGA = ['barrio', 'invierno', 'reto', 'noche', 'wala'];

/** La escena de un mundo (se repiten en orden). */
export const escenaDelMundoPichanga = (m) => ['barrio', 'invierno'][(m - 1) % 2];

/** La escena de una cancha del vestuario (el partido contra Walito). */
export const escenaDelEstadio = (id) => ({ barrio: 'barrio', invierno: 'invierno', noche: 'noche', violeta: 'wala' }[id] || 'barrio');

const ALEGRES = ['#f472b6', '#fbbf24', '#a78bfa', '#fb7185', '#60a5fa', '#34d399', '#f97316'];

function Destello({ x, y, r = 6, color = '#fff', opacidad = 1 }) {
  const d = `M${x} ${y - r}c${r * 0.05} ${r * 0.47} ${r * 0.22} ${r * 0.75} ${r} ${r}c-${r * 0.78} ${r * 0.25}-${r * 0.95} ${r * 0.53}-${r} ${r}c-${r * 0.05}-${r * 0.47}-${r * 0.22}-${r * 0.75}-${r}-${r}c${r * 0.78}-${r * 0.25} ${r * 0.95}-${r * 0.53} ${r}-${r}Z`;
  return <path d={d} fill={color} opacity={opacidad} />;
}

function Nube({ x, y, e = 1, color = '#fff', opacidad = 0.95 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${e})`} fill={color} opacity={opacidad}>
      <ellipse cx="0" cy="8" rx="30" ry="11" />
      <circle cx="-12" cy="2" r="11" />
      <circle cx="6" cy="-2" r="14" />
      <circle cx="20" cy="5" r="9" />
    </g>
  );
}

/** Una fila de banderines colgando entre dos puntos. */
function Banderines({ x0, x1, y, caida = 14, colores = ALEGRES, n = 12 }) {
  const punto = (t) => [x0 + (x1 - x0) * t, y + caida * 4 * t * (1 - t)];
  return (
    <g>
      <path d={`M${x0} ${y} Q${(x0 + x1) / 2} ${y + caida * 2} ${x1} ${y}`} stroke="#6b7280" strokeWidth="1" fill="none" />
      {Array.from({ length: n }, (_, k) => {
        const [x, yy] = punto((k + 0.5) / n);
        return <path key={k} d={`M${x - 5} ${yy} L${x + 5} ${yy} L${x} ${yy + 11}Z`} fill={colores[k % colores.length]} />;
      })}
    </g>
  );
}

/** Una tribuna: gradas con hinchas (puntitos de colores). */
function Tribuna({ rnd, y, alto = 70, color = '#c4b5fd', oscuro = false }) {
  const filas = 5;
  return (
    <g>
      <path d={`M-10 ${y + alto} L40 ${y} L360 ${y} L410 ${y + alto}Z`} fill={color} />
      {Array.from({ length: filas }, (_, f) => {
        const yy = y + 8 + (f * (alto - 12)) / filas;
        const margen = 40 - (f * 50) / filas;
        return (
          <g key={f}>
            <rect x={margen} y={yy + 9} width={400 - 2 * margen} height="2" fill={oscuro ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.5)'} />
            {Array.from({ length: 26 }, (_, k) => (
              <circle key={k} cx={margen + 6 + k * ((400 - 2 * margen - 12) / 25)} cy={yy + 4 + (rnd() - 0.5) * 2} r="3" fill={ALEGRES[Math.floor(rnd() * ALEGRES.length)]} opacity={oscuro ? 0.8 : 1} />
            ))}
          </g>
        );
      })}
    </g>
  );
}

/** Una torre de luces (sin brillo animado: solo el dibujo). */
function Reflector({ x, y, alto = 90, encendido = false }) {
  return (
    <g>
      {encendido && <path d={`M${x - 14} ${y + 4} L${x - 70} ${y + 150} L${x + 70} ${y + 150} L${x + 14} ${y + 4}Z`} fill="#fef9c3" opacity="0.13" />}
      <rect x={x - 2} y={y} width="4" height={alto} fill="#64748b" />
      <rect x={x - 16} y={y - 12} width="32" height="14" rx="3" fill="#475569" />
      {[0, 1, 2, 3].map((k) => <circle key={k} cx={x - 11 + k * 7.3} cy={y - 5} r="2.6" fill={encendido ? '#fef08a' : '#e2e8f0'} />)}
    </g>
  );
}

/* ── Las escenas ── */

function Barrio({ rnd }) {
  const casas = Array.from({ length: 7 }, (_, k) => ({ k, x: k * 60 - 8 + rnd() * 8, w: 46 + rnd() * 12, h: 40 + rnd() * 26, color: ALEGRES[(k * 3 + Math.floor(rnd() * 3)) % ALEGRES.length] }));
  return (
    <>
      <circle cx="330" cy="54" r="22" fill="#fde68a" />
      <circle cx="330" cy="54" r="32" fill="#fde68a" opacity="0.35" />
      <Nube x={70 + rnd() * 40} y={52} e={0.85} />
      <Nube x={210 + rnd() * 30} y={38} e={0.65} />
      <path d="M0 170 Q90 120 190 160 T400 150 V300 H0Z" fill="#bbf7d0" />
      {casas.map((c) => (
        <g key={c.k}>
          <rect x={c.x} y={232 - c.h} width={c.w} height={c.h} fill={c.color} opacity="0.85" />
          <path d={`M${c.x - 3} ${232 - c.h} L${c.x + c.w / 2} ${218 - c.h} L${c.x + c.w + 3} ${232 - c.h}Z`} fill="#9a3412" opacity="0.75" />
          <rect x={c.x + 8} y={240 - c.h} width="10" height="10" fill="#fef9c3" />
          <rect x={c.x + c.w - 18} y={240 - c.h} width="10" height="10" fill="#fef9c3" />
          <rect x={c.x + c.w / 2 - 5} y={218} width="10" height="14" fill="#7c2d12" opacity="0.7" />
        </g>
      ))}
      <Banderines x0={0} x1={400} y={150} caida={10} />
      <rect x="0" y="232" width="400" height="68" fill="#d6d3d1" />
      <rect x="0" y="232" width="400" height="6" fill="#a8a29e" />
      {Array.from({ length: 4 }, (_, k) => (
        <g key={k} transform={`translate(${20 + k * 110 + rnd() * 20} 250)`}>
          <rect x="-2" y="0" width="4" height="22" fill="#78350f" />
          <circle cx="0" cy="-4" r="13" fill="#22c55e" />
          <circle cx="-8" cy="2" r="9" fill="#16a34a" />
        </g>
      ))}
    </>
  );
}

function Invierno({ rnd }) {
  return (
    <>
      <path d="M0 190 L70 100 L120 150 L190 80 L260 160 L320 110 L400 180 V300 H0Z" fill="#c7d2fe" />
      <path d="M70 100 L55 120 L70 116 L84 124Z M190 80 L172 104 L190 98 L208 108Z M320 110 L304 130 L320 126 L336 132Z" fill="#fff" />
      {Array.from({ length: 34 }, (_, k) => <circle key={k} cx={rnd() * 400} cy={rnd() * 200} r={1.2 + rnd() * 2.2} fill="#fff" opacity="0.9" />)}
      <path d="M0 225 Q120 205 240 222 T400 214 V300 H0Z" fill="#f8fafc" />
      <path d="M0 252 Q150 238 300 252 T400 248 V300 H0Z" fill="#e0f2fe" />
      {Array.from({ length: 6 }, (_, k) => {
        const x = 15 + k * 72 + rnd() * 18;
        const e = 0.8 + rnd() * 0.5;
        return (
          <g key={k} transform={`translate(${x} 236) scale(${e})`}>
            <rect x="-2" y="0" width="4" height="10" fill="#78350f" />
            <path d="M0 -36 L14 -8 L-14 -8Z M0 -24 L17 4 L-17 4Z" fill="#166534" />
            <path d="M0 -36 L6 -24 L-6 -24Z M0 -24 L7 -12 L-7 -12Z" fill="#fff" />
          </g>
        );
      })}
      <g transform={`translate(${330 + rnd() * 30} 262)`}>
        <circle cx="0" cy="0" r="13" fill="#fff" />
        <circle cx="0" cy="-19" r="9" fill="#fff" />
        <circle cx="-3" cy="-21" r="1.3" fill="#1f2937" />
        <circle cx="3" cy="-21" r="1.3" fill="#1f2937" />
        <path d="M0 -18 L7 -17 L0 -16Z" fill="#f97316" />
        <rect x="-8" y="-12" width="16" height="3" fill="#ef4444" />
      </g>
    </>
  );
}

function Reto({ rnd }) {
  return (
    <>
      <Nube x={60 + rnd() * 30} y={40} e={0.7} />
      <Nube x={300 + rnd() * 30} y={30} e={0.6} />
      <Reflector x={30} y={60} />
      <Reflector x={370} y={60} />
      <Tribuna rnd={rnd} y={140} alto={84} color="#ddd6fe" />
      <Banderines x0={20} x1={380} y={134} caida={6} colores={['#7c3aed', '#ec4899', '#f59e0b', '#7c3aed', '#ffffff']} n={16} />
      <rect x="0" y="224" width="400" height="76" fill="#4ade80" />
      <rect x="0" y="224" width="400" height="5" fill="#16a34a" />
      {repartirDestellos(rnd, '#ffffff')}
    </>
  );
}

function Noche({ rnd }) {
  return (
    <>
      {Array.from({ length: 28 }, (_, k) => <Destello key={k} x={rnd() * 400} y={rnd() * 120} r={1.5 + rnd() * 3} color="#fef9c3" opacidad={0.5 + rnd() * 0.5} />)}
      <circle cx="320" cy="48" r="18" fill="#fef3c7" />
      <circle cx="328" cy="42" r="16" fill="#312e81" />
      <Reflector x={36} y={56} encendido />
      <Reflector x={364} y={56} encendido />
      <Tribuna rnd={rnd} y={144} alto={80} color="#4c1d95" oscuro />
      <rect x="0" y="224" width="400" height="76" fill="#14532d" />
    </>
  );
}

function Wala({ rnd }) {
  return (
    <>
      {Array.from({ length: 10 }, (_, k) => <Destello key={k} x={rnd() * 400} y={rnd() * 130} r={3 + rnd() * 5} color={k % 2 ? '#ffffff' : '#f9a8d4'} opacidad={0.9} />)}
      <Tribuna rnd={rnd} y={140} alto={84} color="#a78bfa" />
      <Banderines x0={10} x1={390} y={132} caida={8} colores={['#ffffff', '#f472b6', '#fbbf24']} n={18} />
      <rect x="0" y="224" width="400" height="76" fill="#7c3aed" />
      <rect x="0" y="224" width="400" height="5" fill="#5b21b6" />
    </>
  );
}

function repartirDestellos(rnd, color) {
  return Array.from({ length: 5 }, (_, k) => <Destello key={`d${k}`} x={20 + rnd() * 360} y={20 + rnd() * 90} r={3 + rnd() * 4} color={color} opacidad={0.8} />);
}

const DIBUJOS = { barrio: Barrio, invierno: Invierno, reto: Reto, noche: Noche, wala: Wala };

const CIELOS = {
  barrio: ['#bae6fd', '#fef9c3'],
  invierno: ['#c7d2fe', '#f0f9ff'],
  reto: ['#ede9fe', '#fce7f3'],
  noche: ['#1e1b4b', '#4c1d95'],
  wala: ['#c4b5fd', '#fbcfe8'],
};

/** Un número para cada texto (la semilla de los detalles). */
const semillaDe = (texto) => {
  let h = 2166136261;
  for (const ch of String(texto)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
};

/**
 * El fondo de la mesa de la Pichanga.
 *  - escena: una de ESCENAS_PICHANGA · semilla: el nivel o el día
 *  - jefe: luz de atardecer (los penales contra Walito)
 */
export function FondoPichanga({ escena = 'barrio', semilla = 1, jefe = false }) {
  const id = useId().replace(/:/g, '');
  const Dibujo = DIBUJOS[escena] || Barrio;
  const cielo = CIELOS[escena] || CIELOS.barrio;
  const dibujo = useMemo(
    () => <Dibujo rnd={azar(semillaDe(`pichanga:${escena}:${semilla}`))} />,
    [escena, semilla], // Dibujo sale de escena (una tabla fija)
  );
  return (
    <span className={[s.marco, jefe && s.jefe].filter(Boolean).join(' ')} style={{ background: cielo[0] }} data-escena={escena}>
      <svg className={s.fondo} viewBox="0 0 400 300" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <defs>
          <linearGradient id={`cielo-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: cielo[0] }} />
            <stop offset="1" style={{ stopColor: cielo[1] }} />
          </linearGradient>
        </defs>
        <rect width="400" height="300" fill={`url(#cielo-${id})`} />
        {dibujo}
      </svg>
    </span>
  );
}
