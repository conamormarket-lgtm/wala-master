import React, { useEffect, useId, useRef, useState } from 'react';
import { Ticket } from 'lucide-react';
import { IconoWala } from '../IconosWala';
import { Enlace } from '../Enlace';
import { colorDeGajo } from '../../../utils/ruletaModel';
import { Texto, useTexto } from '../Traduccion';
import { atributosDeFoto } from '../../../components/common/OptimizedImage/OptimizedImage';
import s from './Ruleta.module.css';

/*
 * Piezas de La Ruleta de Walito (/ruleta): la rueda y lo que ya ganaste.
 * La rueda es la de components/ruleta/RuedaRuleta.jsx (mismo SVG, mismo
 * origen de ángulos que anguloDeParada), con el aro de luces y el ícono de cada premio.
 * Los textos (también los nombres de los premios) pasan por la traducción.
 */

const CENTRO = 100;
const R_GAJOS = 84; // los gajos
const R_ARO = 99; // el aro grueso, con las luces
const R_LUCES = 91.6;

const punto = (radio, grados) => {
  const rad = ((grados - 90) * Math.PI) / 180;
  return [CENTRO + radio * Math.cos(rad), CENTRO + radio * Math.sin(rad)];
};

const arcoGajo = (radio, desde, hasta) => {
  const [x1, y1] = punto(radio, desde);
  const [x2, y2] = punto(radio, hasta);
  return `M ${CENTRO} ${CENTRO} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${radio} ${radio} 0 ${hasta - desde > 180 ? 1 : 0} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
};

const textoOscuroSobre = (hex) => {
  const limpio = String(hex || '').replace('#', '');
  const full = limpio.length === 3 ? limpio.split('').map((c) => c + c).join('') : limpio.slice(0, 6);
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) > 155;
};

const recortar = (texto, max) => {
  const t = String(texto || '').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/* El nombre y lo que da (al pasar el ratón por el gajo). */
const descripcion = (p) => {
  const nombre = String(p?.nombre || p?.etiqueta || p?.texto || '').trim();
  const texto = String(p?.texto || '').trim();
  return texto && texto !== nombre ? `${nombre} · ${texto}` : nombre;
};

/* Un color más claro (k > 0) o más oscuro (k < 0), mezclándolo con blanco o negro. */
const mezclar = (hex, k) => {
  const limpio = String(hex || '').replace('#', '');
  const full = limpio.length === 3 ? limpio.split('').map((c) => c + c).join('') : limpio.slice(0, 6);
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return hex;
  const destino = k > 0 ? 255 : 0;
  const canal = (i) => Math.round(parseInt(full.slice(i, i + 2), 16) + (destino - parseInt(full.slice(i, i + 2), 16)) * Math.abs(k));
  return `#${[0, 2, 4].map((i) => canal(i).toString(16).padStart(2, '0')).join('')}`;
};

/*
 * El nombre del gajo en dos líneas, como en un concurso: lo que se gana en
 * grande y el resto debajo, chico («15» / «monedas», «Envío» / «gratis»).
 * Traducido y recortado a lo que cabe.
 */
function EtiquetaGajo({ texto, max, x, y, tam, color, volteado }) {
  const t = String(useTexto(texto) || '').trim();
  const partes = t.split(/\s+/);
  // «10 %» o «S/ 20» no se parten (un símbolo no va solo); «15 monedas», sí.
  const corta = partes.length === 2 && (partes[1].length <= 2 || /^\D{1,2}$/.test(partes[0]));
  const [primera = '', ...resto] = corta ? [t] : partes;
  const segunda = recortar(resto.join(' '), max);
  const grande = recortar(primera, Math.max(5, Math.ceil(max * 0.75)));
  const tamGrande = tam * (segunda ? 1.4 : 1.25);
  const tamChico = tam * 0.8;
  // Se voltea alrededor del medio del bloque (las dos líneas juntas).
  const medio = y - tamGrande * 0.35 + (segunda ? (tamChico * 1.15) / 2 : 0);
  return (
    <text x={x} y={y} transform={volteado ? `rotate(180 ${x} ${medio})` : undefined} textAnchor="middle" fill={color} className={s.etiqueta}>
      <tspan x={x} fontSize={tamGrande}>{grande}</tspan>
      {segunda && <tspan x={x} dy={tamChico * 1.15} fontSize={tamChico} className={s.etiquetaChica}>{segunda}</tspan>}
    </text>
  );
}

/** El ángulo (grados) al que está girado un elemento ahora mismo, en medio de su transición. */
const anguloActual = (el) => {
  const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform || '');
  if (!m) return 0;
  const [a, b] = m[1].split(',').map(Number);
  return (Math.atan2(b, a) * 180) / Math.PI;
};

/**
 * La rueda: un gajo por premio (en el orden que da el servidor), el aro con
 * luces, el puntero fijo arriba y el centro con el logo (o la imagen del admin).
 * Cada gajo lleva el ícono del premio en un sello blanco junto al borde y su
 * nombre en dos líneas. Mientras gira, las luces parpadean y el puntero hace
 * «tic» en cada gajo que pasa; quieta, no se mueve nada.
 *  - premios: [{ id, nombre, etiqueta, texto, icono, color }] (sin nombre ni
 *    etiqueta, el gajo dice el `texto`) · colores (la paleta del admin)
 *  - colorAro (separadores) · colorPuntero (el puntero, el aro y el centro)
 *  - imagenCentro: la del admin (si no, la W)
 *  - rotacion (grados, acumulada) · duracion (ms del giro; 0 = sin animar)
 */
export function RuedaRuleta({ premios = [], colores, colorAro = '#FFFFFF', colorPuntero = '#6D28D9', imagenCentro = '', rotacion = 0, duracion = 0 }) {
  const total = premios.length;
  const anguloGajo = total > 0 ? 360 / total : 360;
  const tamTexto = total <= 6 ? 8 : total <= 9 ? 6.6 : total <= 12 ? 5.6 : 4.8;
  const radioSello = total <= 6 ? 9.5 : total <= 9 ? 8.4 : total <= 12 ? 7 : 6;
  const maxCaracteres = total <= 3 ? 18 : total <= 6 ? 12 : total <= 9 ? 10 : 8;
  const luces = Math.min(24, Math.max(12, total * 2));
  const t = { con: useTexto(`Rueda con ${total} premios`), sin: useTexto('Rueda sin premios') };
  const id = useId().replace(/:/g, '');
  const disco = useRef(null);
  const puntero = useRef(null);
  const [girando, setGirando] = useState(false);

  // Mientras gira: las luces parpadean y el puntero hace «tic» al pasar cada
  // gajo (se lee el ángulo de la transición en cada cuadro, solo ese rato).
  useEffect(() => {
    if (!(duracion > 0) || !disco.current) return undefined;
    setGirando(true);
    const quieto = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let cuadro = 0;
    let previo = null;
    const mirar = () => {
      const gajo = Math.floor((((anguloActual(disco.current) % 360) + 360) % 360) / anguloGajo);
      if (previo !== null && gajo !== previo && puntero.current) {
        puntero.current.classList.remove(s.tic);
        void puntero.current.offsetWidth; // vuelve a empezar la animación
        puntero.current.classList.add(s.tic);
      }
      previo = gajo;
      cuadro = requestAnimationFrame(mirar);
    };
    if (!quieto && total > 1) cuadro = requestAnimationFrame(mirar);
    const fin = setTimeout(() => { setGirando(false); cancelAnimationFrame(cuadro); }, duracion + 80);
    return () => { clearTimeout(fin); cancelAnimationFrame(cuadro); };
  }, [rotacion]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={[s.rueda, girando && s.girando].filter(Boolean).join(' ')} data-componente="RuedaRuleta">
      <div className={s.puntero} aria-hidden="true">
        {/* El lienzo deja margen: la cabeza redonda (con su borde) sube hasta y = -2.6. */}
        <svg ref={puntero} viewBox="-1 -4 30 40" className={s.punteroForma}>
          <defs>
            <linearGradient id={`${id}-puntero`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={mezclar(colorPuntero, 0.35)} />
              <stop offset="1" stopColor={mezclar(colorPuntero, -0.3)} />
            </linearGradient>
          </defs>
          <path d="M14 34 L2.5 13 A 12 12 0 1 1 25.5 13 Z" fill={`url(#${id}-puntero)`} stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="14" cy="12.5" r="4.6" fill="#fff" />
        </svg>
      </div>
      <svg
        ref={disco}
        className={s.disco}
        viewBox="0 0 200 200"
        style={{ transform: `rotate(${rotacion}deg)`, transition: duracion > 0 ? `transform ${duracion}ms cubic-bezier(0.33, 1, 0.68, 1)` : 'none' }}
        role="img"
        aria-label={total ? `${t.con}: ${premios.map((p) => p.nombre || p.etiqueta || p.texto).join(', ')}` : t.sin}
      >
        <defs>
          <linearGradient id={`${id}-aro`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={mezclar(colorPuntero, 0.3)} />
            <stop offset="0.5" stopColor={colorPuntero} />
            <stop offset="1" stopColor={mezclar(colorPuntero, -0.35)} />
          </linearGradient>
          {/* Los gajos se oscurecen un poco hacia el borde: dan volumen. */}
          <radialGradient id={`${id}-hondo`}>
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.18" />
          </radialGradient>
        </defs>
        {/* El aro grueso con el degradado y sus luces. */}
        <circle cx={CENTRO} cy={CENTRO} r={R_ARO} fill={`url(#${id}-aro)`} />
        {Array.from({ length: luces }, (_, k) => {
          const [x, y] = punto(R_LUCES, (k * 360) / luces);
          return <circle key={`l-${k}`} cx={x} cy={y} r={total > 12 ? 1.7 : 2.1} className={k % 2 ? s.luzB : s.luzA} />;
        })}
        {total === 0 && <circle cx={CENTRO} cy={CENTRO} r={R_GAJOS} fill="var(--color-border)" />}
        {total === 1 && <circle cx={CENTRO} cy={CENTRO} r={R_GAJOS} fill={colorDeGajo(premios[0], 0, 1, colores)} />}
        {total > 1 && premios.map((p, i) => (
          <path key={p.id || i} d={arcoGajo(R_GAJOS, i * anguloGajo, (i + 1) * anguloGajo)} fill={colorDeGajo(p, i, total, colores)} stroke={colorAro} strokeWidth="1">
            <title>{descripcion(p)}</title>
          </path>
        ))}
        <circle cx={CENTRO} cy={CENTRO} r={R_GAJOS} fill={`url(#${id}-hondo)`} pointerEvents="none" />
        <circle cx={CENTRO} cy={CENTRO} r={R_GAJOS + 0.6} fill="none" stroke={colorAro} strokeWidth="1.6" />
        {premios.map((p, i) => {
          const centroGajo = i * anguloGajo + anguloGajo / 2;
          const color = textoOscuroSobre(colorDeGajo(p, i, total, colores)) ? '#1F2937' : '#FFFFFF';
          const icono = String(p.icono || '').trim();
          const ySello = CENTRO - R_GAJOS + 5 + radioSello;
          const y = icono ? ySello + radioSello + tamTexto * 1.45 + 1.5 : CENTRO - R_GAJOS + 7 + tamTexto * 1.4;
          // Se voltea según dónde queda el gajo con la rueda ya girada: así el
          // premio que para arriba se lee derecho.
          const donde = (((centroGajo + rotacion) % 360) + 360) % 360;
          const volteado = donde > 90 && donde < 270;
          return (
            <g key={`t-${p.id || i}`} transform={`rotate(${centroGajo} ${CENTRO} ${CENTRO})`}>
              {icono && (
                <g transform={volteado ? `rotate(180 ${CENTRO} ${ySello})` : undefined} aria-hidden="true">
                  <circle cx={CENTRO} cy={ySello} r={radioSello} className={s.sello} />
                  <text x={CENTRO} y={ySello} textAnchor="middle" dominantBaseline="central" fontSize={radioSello * 1.15} className={s.iconoGajo}>{icono}</text>
                </g>
              )}
              <EtiquetaGajo texto={p.etiqueta || p.nombre || p.texto} max={maxCaracteres} x={CENTRO} y={y} tam={tamTexto} color={color} volteado={volteado} />
            </g>
          );
        })}
      </svg>
      {/* El brillo no gira (si girara, delataría que es plano) y el centro se queda derecho. */}
      <span className={s.brillo} aria-hidden="true" />
      <span className={s.centro} style={{ '--aro': colorAro, '--puntero': colorPuntero }} aria-hidden="true">
        {imagenCentro ? <img {...atributosDeFoto(imagenCentro, '160px')} alt="" className={s.centroImagen} /> : 'W'}
      </span>
    </div>
  );
}

/** El ícono de Walá de cada tipo de premio (en vez de los emojis de la tienda). */
export const ICONO_PREMIO = {
  monedas: 'moneda',
  descuento: 'estrella',
  producto_descuento: 'estrella',
  producto_gratis: 'regalo',
  envio_gratis: 'camion',
  manual: 'regalo',
  nada: 'corazon',
};

/**
 * Lo que ya ganaste en la ruleta (los últimos giros).
 *  - historial: [{ id, tipo, texto, cupon, fecha ("8 sep") }]
 *  - urlCupones: "Ver mis cupones" si alguno trae cupón
 */
export function HistorialRuleta({ historial = [], urlCupones = '/cuenta/cupones' }) {
  const giros = useTexto(historial.length === 1 ? '1 giro' : `${historial.length} giros`);
  return (
    <section className={s.historial} aria-labelledby="historial-ruleta" data-componente="HistorialRuleta">
      <h2 id="historial-ruleta" className={s.historialTitulo}>
        <Texto>Tus premios</Texto> <small>{giros}</small>
      </h2>
      {historial.length ? (
        <ul className={s.historialLista}>
          {historial.map((h) => (
            <li key={h.id}>
              <IconoWala nombre={ICONO_PREMIO[h.tipo] || 'regalo'} tamano={34} />
              <span className={s.historialTexto}>
                <strong><Texto>{h.texto}</Texto></strong>
                {h.cupon && <code>{h.cupon}</code>}
              </span>
              {h.fecha && <small className={s.historialFecha}>{h.fecha}</small>}
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.historialVacio}><Texto>Todavía no has girado. Lo que ganes aparecerá aquí.</Texto></p>
      )}
      {historial.some((h) => h.cupon) && (
        <Enlace to={urlCupones} className={s.enlace}><Ticket aria-hidden="true" /> <Texto>Ver mis cupones</Texto></Enlace>
      )}
    </section>
  );
}
