import React from 'react';
import { Ticket } from 'lucide-react';
import { IconoWala } from '../IconosWala';
import { Enlace } from '../Enlace';
import { colorDeGajo } from '../../../utils/ruletaModel';
import { Texto, useTexto } from '../Traduccion';
import { atributosDeFoto } from '../../../components/common/OptimizedImage/OptimizedImage';
import s from './Ruleta.module.css';

/*
 * Piezas de la Ruleta Semanal (/ruleta): la rueda y lo que ya ganaste.
 * La rueda es la de components/ruleta/RuedaRuleta.jsx (mismo SVG, mismo
 * origen de ángulos que anguloDeParada), sin los emojis de los gajos.
 * Los textos (también los nombres de los premios) pasan por la traducción.
 */

const CENTRO = 100;
const RADIO = 96;

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

/* El nombre de un gajo, traducido y recortado a lo que cabe. */
function TextoGajo({ texto, max }) {
  return recortar(useTexto(texto), max);
}

/**
 * La rueda: un gajo por premio (en el orden que da el servidor), el aro, el
 * puntero fijo arriba y el centro con el logo.
 *  - premios: [{ id, nombre, etiqueta, texto, color }] (sin nombre ni etiqueta,
 *    el gajo dice el `texto`) · colores (la paleta del admin)
 *  - colorAro, colorPuntero · imagenCentro: la del admin (si no, la W)
 *  - rotacion (grados, acumulada) · duracion (ms del giro; 0 = sin animar)
 */
export function RuedaRuleta({ premios = [], colores, colorAro = '#FFFFFF', colorPuntero = '#6D28D9', imagenCentro = '', rotacion = 0, duracion = 0 }) {
  const total = premios.length;
  const anguloGajo = total > 0 ? 360 / total : 360;
  const tamTexto = total <= 6 ? 8.4 : total <= 9 ? 7.2 : total <= 12 ? 6 : 5.2;
  const maxCaracteres = total <= 3 ? 22 : total <= 6 ? 16 : total <= 9 ? 13 : 10;
  const t = { con: useTexto(`Rueda con ${total} premios`), sin: useTexto('Rueda sin premios') };
  return (
    <div className={s.rueda} data-componente="RuedaRuleta">
      <div className={s.puntero} style={{ color: colorPuntero }} aria-hidden="true">
        <svg viewBox="0 0 24 30" width="30" height="38">
          <path d="M12 30 L1 11 A 11 11 0 1 1 23 11 Z" fill="currentColor" />
          <circle cx="12" cy="11" r="4.5" fill="rgba(255,255,255,0.9)" />
        </svg>
      </div>
      <svg
        className={s.disco}
        viewBox="0 0 200 200"
        style={{ transform: `rotate(${rotacion}deg)`, transition: duracion > 0 ? `transform ${duracion}ms cubic-bezier(0.33, 1, 0.68, 1)` : 'none' }}
        role="img"
        aria-label={total ? `${t.con}: ${premios.map((p) => p.nombre || p.etiqueta || p.texto).join(', ')}` : t.sin}
      >
        <circle cx={CENTRO} cy={CENTRO} r={RADIO + 3} fill={colorAro} />
        {total === 0 && <circle cx={CENTRO} cy={CENTRO} r={RADIO} fill="var(--color-border)" />}
        {total === 1 && <circle cx={CENTRO} cy={CENTRO} r={RADIO} fill={colorDeGajo(premios[0], 0, 1, colores)} />}
        {total > 1 && premios.map((p, i) => (
          <path key={p.id || i} d={arcoGajo(RADIO, i * anguloGajo, (i + 1) * anguloGajo)} fill={colorDeGajo(p, i, total, colores)} stroke={colorAro} strokeWidth="0.7">
            <title>{descripcion(p)}</title>
          </path>
        ))}
        {premios.map((p, i) => {
          const centroGajo = i * anguloGajo + anguloGajo / 2;
          const color = textoOscuroSobre(colorDeGajo(p, i, total, colores)) ? '#1F2937' : '#FFFFFF';
          const y = CENTRO - RADIO + 22;
          // Se voltea según dónde queda el gajo con la rueda ya girada: así el
          // premio que para arriba se lee derecho.
          const donde = (((centroGajo + rotacion) % 360) + 360) % 360;
          const volteado = donde > 90 && donde < 270;
          return (
            <g key={`t-${p.id || i}`} transform={`rotate(${centroGajo} ${CENTRO} ${CENTRO})`}>
              <text x={CENTRO} y={y} transform={volteado ? `rotate(180 ${CENTRO} ${y})` : undefined} textAnchor="middle" fontSize={tamTexto} fill={color} className={s.etiqueta}>
                <TextoGajo texto={p.etiqueta || p.nombre || p.texto} max={maxCaracteres} />
              </text>
            </g>
          );
        })}
      </svg>
      {/* El centro no gira: el logo (o la imagen del admin) se queda derecho. */}
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
