import React, { useId, useMemo } from 'react';
import { azar, semillaDe } from './bolitasMotor.mjs';
import s from './FondoBolitas.module.css';

/*
 * El fondo ilustrado de la mesa de Las Bolitas de Kapi: una escena por mundo
 * (la del nombre del mundo), el escenario del reto o los colores de una marca.
 * Son dibujos SVG quietos (nada se mueve: diseño animado pero liviano), sin
 * imágenes que bajar. Las flores, ventanas, estrellas… cambian de lugar con la
 * semilla (el número de nivel), así cada nivel se ve un poco distinto. El
 * suelo queda abajo, donde se paran los tubos; arriba, un velo del color de la
 * mesa deja leer el título.
 */

/** Las escenas de los mundos, en el orden de MUNDOS (bolitasMotor). */
export const ESCENAS = ['jardin', 'playa', 'caramelo', 'neon', 'cristal', 'volcan', 'nubes', 'galaxia'];

/** La escena de un mundo (se repiten en orden después del último). */
export const escenaDelMundo = (m) => ESCENAS[(m - 1) % ESCENAS.length];

const ALEGRES = ['#f472b6', '#fbbf24', '#a78bfa', '#fb7185', '#60a5fa', '#34d399'];

/* Un destello de cuatro puntas (el de la marca), centrado en x, y. */
function Estrella({ x, y, r = 6, color = '#fff', opacidad = 1 }) {
  const d = `M${x} ${y - r}c${r * 0.05} ${r * 0.47} ${r * 0.22} ${r * 0.75} ${r} ${r}c-${r * 0.78} ${r * 0.25}-${r * 0.95} ${r * 0.53}-${r} ${r}c-${r * 0.05}-${r * 0.47}-${r * 0.22}-${r * 0.75}-${r}-${r}c${r * 0.78}-${r * 0.25} ${r * 0.95}-${r * 0.53} ${r}-${r}Z`;
  return <path d={d} fill={color} opacity={opacidad} />;
}

/* Una nube de tres bultos. */
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

/* Cosas repartidas con la semilla: n puntos entre x0-x1 y y0-y1. */
const repartir = (rnd, n, [x0, x1], [y0, y1]) => Array.from({ length: n }, (_, k) => ({
  k,
  x: x0 + ((x1 - x0) * (k + 0.2 + rnd() * 0.6)) / n,
  y: y0 + (y1 - y0) * rnd(),
  r: rnd(),
}));

/* ── Las escenas ── */

function Jardin({ rnd }) {
  return (
    <>
      <circle cx="335" cy="58" r="24" fill="#fde68a" />
      <circle cx="335" cy="58" r="34" fill="#fde68a" opacity="0.35" />
      <Nube x={70 + rnd() * 40} y={60} e={0.9} />
      <Nube x={230 + rnd() * 30} y={42} e={0.7} />
      <path d="M0 205 Q100 160 210 198 T400 186 V300 H0Z" fill="#bbf7d0" />
      <path d="M0 238 Q120 202 245 232 T400 222 V300 H0Z" fill="#86efac" />
      <path d="M0 262 Q140 246 280 262 T400 258 V300 H0Z" fill="#4ade80" opacity="0.6" />
      {repartir(rnd, 9, [8, 392], [246, 290]).map((f) => (
        <g key={f.k} transform={`translate(${f.x} ${f.y})`}>
          <path d="M0 0v10" stroke="#16a34a" strokeWidth="1.6" />
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 3.6} cy={Math.sin((a * Math.PI) / 180) * 3.6} r="2.8" fill={ALEGRES[f.k % ALEGRES.length]} />
          ))}
          <circle r="2" fill="#fef3c7" />
        </g>
      ))}
    </>
  );
}

function Playa({ rnd }) {
  return (
    <>
      <circle cx="300" cy="128" r="30" fill="#fdba74" />
      <circle cx="300" cy="128" r="42" fill="#fed7aa" opacity="0.5" />
      <Nube x={90 + rnd() * 50} y={58} e={0.8} />
      <rect x="0" y="160" width="400" height="90" fill="#7dd3fc" />
      <path d="M0 172 Q50 164 100 172 T200 172 T300 172 T400 172 V250 H0Z" fill="#38bdf8" opacity="0.55" />
      {[186, 204].map((y) => (
        <path key={y} d={`M0 ${y} q25 -6 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0`} fill="none" stroke="#fff" strokeWidth="2" opacity="0.6" />
      ))}
      <g transform={`translate(${60 + rnd() * 250} 160)`}>
        <path d="M-14 0h28l-5 7h-18Z" fill="#f472b6" />
        <path d="M0 -26v26M1 -24l13 20H1Z" stroke="#fff" fill="#fff" strokeWidth="1.5" />
      </g>
      <path d="M0 232 Q200 210 400 236 V300 H0Z" fill="#fde68a" />
      <path d="M0 262 Q200 248 400 264 V300 H0Z" fill="#fcd34d" opacity="0.6" />
      {repartir(rnd, 6, [10, 390], [244, 288]).map((c) => (c.r > 0.5 ? (
        <path key={c.k} transform={`translate(${c.x} ${c.y}) rotate(${c.r * 90})`} d="M0 -7l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" fill="#fb923c" />
      ) : (
        <path key={c.k} transform={`translate(${c.x} ${c.y})`} d="M-6 2a6 6 0 0 1 12 0Z" fill="#f9a8d4" />
      )))}
    </>
  );
}

function Caramelo({ rnd }) {
  return (
    <>
      <Nube x={300} y={50} e={0.8} color="#fff" />
      <path d="M0 208 Q90 168 190 204 T400 192 V300 H0Z" fill="#fbcfe8" />
      <path d="M0 240 Q130 210 260 238 T400 230 V300 H0Z" fill="#a7f3d0" />
      {/* Chupetines suaves y bajos: que no se confundan con las bolitas. */}
      {repartir(rnd, 5, [20, 380], [178, 200]).map((p) => (
        <g key={p.k} transform={`translate(${p.x} ${p.y})`} opacity="0.5">
          <rect x="-1.5" y="0" width="3" height={50} rx="1.5" fill="#fff" />
          <circle cy="-4" r={10 + p.r * 4} fill={ALEGRES[p.k % ALEGRES.length]} />
          <path d={`M0 -4m-${6 + p.r * 3} 0a${6 + p.r * 3} ${6 + p.r * 3} 0 1 1 ${3 + p.r * 2} ${5 + p.r * 2}`} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
      {repartir(rnd, 8, [6, 394], [254, 290]).map((g) => (
        <path key={g.k} transform={`translate(${g.x} ${g.y})`} d="M-7 4a7 8 0 0 1 14 0Z" fill={ALEGRES[(g.k + 2) % ALEGRES.length]} opacity="0.65" />
      ))}
    </>
  );
}

function Neon({ rnd }) {
  const edificios = [];
  let x = -10;
  while (x < 410) {
    const ancho = 30 + rnd() * 34;
    edificios.push({ x, ancho, alto: 70 + rnd() * 90, tono: rnd() > 0.5 ? '#7c3aed' : '#6d28d9' });
    x += ancho + 4;
  }
  return (
    <>
      <circle cx="80" cy="64" r="20" fill="#fef3c7" opacity="0.9" />
      {repartir(rnd, 7, [120, 400], [20, 110]).map((e) => <Estrella key={e.k} x={e.x} y={e.y} r={3 + e.r * 3} color="#fff" opacity={0.85} />)}
      {edificios.map((e, k) => (
        <g key={k}>
          <rect x={e.x} y={300 - e.alto} width={e.ancho} height={e.alto} fill={e.tono} rx="3" />
          {Array.from({ length: Math.floor((e.alto - 14) / 14) }, (_, f) => Array.from({ length: Math.floor((e.ancho - 8) / 10) }, (__, c) => (
            rnd() > 0.45 && <rect key={`${f}-${c}`} x={e.x + 6 + c * 10} y={300 - e.alto + 8 + f * 14} width="5" height="7" rx="1" fill={rnd() > 0.3 ? '#fde68a' : '#f0abfc'} />
          )))}
        </g>
      ))}
      <path d="M0 238 H400" stroke="#f472b6" strokeWidth="3" opacity="0.8" />
      <path d="M0 246 H400" stroke="#22d3ee" strokeWidth="2" opacity="0.7" />
      <rect x="0" y="252" width="400" height="48" fill="#4c1d95" />
    </>
  );
}

function Cristal({ rnd }) {
  const tonos = ['#67e8f9', '#c084fc', '#f0abfc', '#a5b4fc'];
  return (
    <>
      <path d="M0 0 H400 V26 L380 44 L360 22 L330 52 L300 20 L270 40 L240 18 L200 48 L170 20 L140 38 L110 16 L80 46 L50 22 L20 40 L0 24Z" fill="#c7d2fe" opacity="0.7" />
      <path d="M0 236 Q100 214 200 232 T400 224 V300 H0Z" fill="#a5b4fc" />
      <path d="M0 264 Q140 250 270 264 T400 258 V300 H0Z" fill="#818cf8" opacity="0.6" />
      {repartir(rnd, 6, [10, 390], [228, 262]).map((c) => {
        const alto = 34 + c.r * 46;
        return (
          <g key={c.k} transform={`translate(${c.x} ${c.y})`}>
            <path d={`M-9 0 L-4 -${alto} L0 -${alto + 10} L4 -${alto} L9 0Z`} fill={tonos[c.k % tonos.length]} opacity="0.92" />
            <path d={`M-14 2 L-11 -${alto * 0.55} L-7 -${alto * 0.62} L-5 2Z`} fill={tonos[(c.k + 1) % tonos.length]} opacity="0.85" />
            <path d={`M-2 -4 L0 -${alto + 4}`} stroke="#fff" strokeWidth="1.6" opacity="0.7" />
          </g>
        );
      })}
      {repartir(rnd, 5, [20, 380], [70, 200]).map((e) => <Estrella key={e.k} x={e.x} y={e.y} r={3 + e.r * 3} color={e.r > 0.5 ? '#fff' : '#67e8f9'} />)}
    </>
  );
}

function Volcan({ rnd }) {
  return (
    <>
      <Nube x={200} y={72} e={1.1} color="#fff" />
      <Nube x={232} y={54} e={0.8} color="#fce7f3" />
      <path d="M0 230 Q60 200 130 226 V300 H0Z" fill="#fed7aa" />
      <path d="M270 226 Q340 196 400 222 V300 H270Z" fill="#fed7aa" />
      <path d="M95 300 L180 132 Q200 112 220 132 L305 300Z" fill="#92400e" />
      <path d="M163 166 L180 132 Q200 112 220 132 L237 166 Q228 178 220 168 Q212 186 203 170 Q194 184 186 168 Q176 180 163 166Z" fill="#f9a8d4" />
      {repartir(rnd, 12, [130, 270], [190, 290]).map((c) => (
        <rect key={c.k} x={c.x} y={c.y} width="7" height="2.4" rx="1.2" fill={ALEGRES[c.k % ALEGRES.length]} transform={`rotate(${c.r * 180} ${c.x} ${c.y})`} />
      ))}
      <path d="M0 268 Q200 252 400 270 V300 H0Z" fill="#fdba74" opacity="0.7" />
    </>
  );
}

function Nubes({ rnd }) {
  const arcos = ['#fda4af', '#fde68a', '#a7f3d0', '#bae6fd', '#ddd6fe'];
  return (
    <>
      {arcos.map((c, k) => (
        <path key={c} d={`M${60 + k * 9} 250 A${140 - k * 9} ${140 - k * 9} 0 0 1 ${340 - k * 9} 250`} fill="none" stroke={c} strokeWidth="9" opacity="0.85" />
      ))}
      {repartir(rnd, 3, [30, 370], [50, 110]).map((n) => <Nube key={n.k} x={n.x} y={n.y} e={0.6 + n.r * 0.4} />)}
      <g fill="#fff">
        {repartir(rnd, 9, [-20, 420], [236, 256]).map((n) => <circle key={n.k} cx={n.x} cy={n.y} r={26 + n.r * 16} />)}
        <rect x="0" y="252" width="400" height="48" />
      </g>
      <g fill="#ede9fe" opacity="0.8">
        {repartir(rnd, 7, [-10, 410], [270, 282]).map((n) => <circle key={n.k} cx={n.x} cy={n.y} r={18 + n.r * 10} />)}
        <rect x="0" y="282" width="400" height="18" />
      </g>
    </>
  );
}

function Galaxia({ rnd }) {
  return (
    <>
      {repartir(rnd, 14, [0, 400], [10, 210]).map((e) => <Estrella key={e.k} x={e.x} y={e.y} r={2 + e.r * 4} color={e.r > 0.6 ? '#fde68a' : '#fff'} />)}
      {/* Planetas suaves: que no se confundan con las bolitas. */}
      <g transform={`translate(${290 + rnd() * 40} ${82})`} opacity="0.6">
        <circle r="22" fill="#f9a8d4" />
        <ellipse rx="36" ry="8" fill="none" stroke="#fde68a" strokeWidth="4" transform="rotate(-18)" />
      </g>
      <circle cx={60 + rnd() * 60} cy="120" r="9" fill="#93c5fd" opacity="0.55" />
      <path d="M0 244 Q200 214 400 246 V300 H0Z" fill="#ddd6fe" />
      {repartir(rnd, 5, [20, 380], [256, 286]).map((c) => <ellipse key={c.k} cx={c.x} cy={c.y} rx={6 + c.r * 8} ry={2.5 + c.r * 2} fill="#c4b5fd" />)}
    </>
  );
}

/* El reto del día: un escenario con reflectores y confeti quieto. */
function Reto({ rnd }) {
  return (
    <>
      {/* Tres reflectores desde arriba, abriéndose hacia el escenario. */}
      {[[60, 120], [200, 200], [340, 280]].map(([arriba, abajo]) => (
        <path key={arriba} d={`M${arriba - 7} 0 L${arriba + 7} 0 L${abajo + 55} 262 L${abajo - 55} 262Z`} fill="#fff" opacity="0.3" />
      ))}
      {repartir(rnd, 16, [0, 400], [20, 220]).map((c) => (
        <rect key={c.k} x={c.x} y={c.y} width="6" height="3" rx="1.5" fill={ALEGRES[c.k % ALEGRES.length]} opacity="0.85" transform={`rotate(${c.r * 180} ${c.x} ${c.y})`} />
      ))}
      <ellipse cx="200" cy="292" rx="260" ry="54" fill="#c4b5fd" />
      <ellipse cx="200" cy="292" rx="210" ry="38" fill="#a78bfa" opacity="0.6" />
    </>
  );
}

/* Una marca: sus colores, colinas y destellos. */
function Marca({ rnd, color, color2 }) {
  const c1 = color || '#a78bfa';
  const c2 = color2 || c1;
  return (
    <>
      {repartir(rnd, 6, [10, 390], [20, 180]).map((e) => <Estrella key={e.k} x={e.x} y={e.y} r={3 + e.r * 4} color={e.r > 0.5 ? '#fff' : c2} opacity={0.9} />)}
      <path d="M0 210 Q100 170 210 204 T400 192 V300 H0Z" style={{ fill: `color-mix(in srgb, ${c1} 35%, #fff)` }} />
      <path d="M0 240 Q120 208 250 236 T400 228 V300 H0Z" style={{ fill: `color-mix(in srgb, ${c2} 45%, #fff)` }} />
      <path d="M0 266 Q160 250 300 266 T400 262 V300 H0Z" style={{ fill: `color-mix(in srgb, ${c1} 55%, #fff)` }} opacity="0.7" />
    </>
  );
}

const DIBUJOS = { jardin: Jardin, playa: Playa, caramelo: Caramelo, neon: Neon, cristal: Cristal, volcan: Volcan, nubes: Nubes, galaxia: Galaxia, reto: Reto, marca: Marca };

const CIELOS = {
  jardin: ['#e0f2fe', '#f0fdf4'],
  playa: ['#bae6fd', '#fef3c7'],
  caramelo: ['#fbcfe8', '#fdf2f8'],
  neon: ['#c4b5fd', '#fbcfe8'],
  cristal: ['#e0e7ff', '#f5f3ff'],
  volcan: ['#fed7aa', '#fee2e2'],
  nubes: ['#ede9fe', '#e0f2fe'],
  galaxia: ['#c7d2fe', '#f5d0fe'],
  reto: ['#ede9fe', '#fce7f3'],
};

/**
 * El fondo de la mesa.
 *  - escena: una de ESCENAS, 'reto' o 'marca'
 *  - semilla: el número de nivel (o el día del reto): mueve los detalles
 *  - jefe: luz de atardecer (el último nivel del mundo)
 *  - color, color2: los de la marca (escena 'marca')
 */
export function FondoBolitas({ escena = 'jardin', semilla = 1, jefe = false, color, color2 }) {
  const id = useId().replace(/:/g, '');
  const Dibujo = DIBUJOS[escena] || Jardin;
  const cielo = escena === 'marca'
    ? [`color-mix(in srgb, ${color || '#a78bfa'} 22%, #fff)`, `color-mix(in srgb, ${color2 || color || '#a78bfa'} 12%, #fff)`]
    : CIELOS[escena] || CIELOS.jardin;
  // La semilla decide dónde va cada cosa: el mismo nivel se ve siempre igual.
  const dibujo = useMemo(
    () => <Dibujo rnd={azar(semillaDe(`fondo:${escena}:${semilla}`))} color={color} color2={color2} />,
    // Dibujo sale de escena (una tabla fija): no hace falta en la lista.
    [escena, semilla, color, color2],
  );
  // El dibujo va abajo y a todo el ancho (el suelo bajo los tubos); arriba,
  // el color del cielo sigue sin costura hasta el borde de la mesa.
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
