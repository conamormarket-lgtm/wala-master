// =========================================================================
// Rueda de la Ruleta — SVG
// -------------------------------------------------------------------------
// Sustituye a la rueda vieja, que era un `conic-gradient` con dos violetas
// fijos y, encima, un <div> rotado por premio con el texto en `nowrap`: los
// nombres largos se salían del disco y el `overflow:hidden` los cortaba a la
// mitad. En SVG cada gajo es un `path` de verdad, el texto se coloca sobre su
// radio y el color sale de la paleta configurada por el admin.
//
// Es SOLO presentación: no sabe de premios ganados, de elegibilidad ni de
// probabilidades. La usan la pantalla del cliente y la vista previa del admin,
// para que lo que el admin configura sea exactamente lo que el cliente ve.
// =========================================================================

import React from 'react';
import { colorDeGajo } from '../../utils/ruletaModel';
import styles from './RuedaRuleta.module.css';

const CENTRO = 100;
const RADIO = 96;

// Punto del círculo a `grados` medidos EN SENTIDO HORARIO DESDE LAS 12. Ese es
// el mismo origen que usa el cálculo del ángulo de parada, y el que marca el
// puntero: si se cambia aquí, la rueda para en el gajo equivocado.
const punto = (radio, grados) => {
  const rad = ((grados - 90) * Math.PI) / 180;
  return [CENTRO + radio * Math.cos(rad), CENTRO + radio * Math.sin(rad)];
};

const arcoGajo = (radio, desde, hasta) => {
  const [x1, y1] = punto(radio, desde);
  const [x2, y2] = punto(radio, hasta);
  const arcoGrande = hasta - desde > 180 ? 1 : 0;
  return `M ${CENTRO} ${CENTRO} L ${x1.toFixed(3)} ${y1.toFixed(3)} ` +
    `A ${radio} ${radio} 0 ${arcoGrande} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
};

// ¿El texto encima de este color debe ser oscuro? Se decide por luminancia
// percibida: la paleta la elige el admin y puede meter un amarillo sobre el que
// el blanco de siempre resultaría ilegible.
const textoOscuroSobre = (hex) => {
  const limpio = String(hex || '').replace('#', '');
  const full = limpio.length === 3
    ? limpio.split('').map((c) => c + c).join('')
    : limpio.slice(0, 6);
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 155;
};

// El gajo no da para un nombre largo. Se recorta con puntos suspensivos en vez
// de dejar que se salga del disco (que es lo que hacía la rueda vieja).
const recortar = (texto, max) => {
  const t = String(texto || '').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

// Texto completo del premio, para el <title> del gajo: el navegador lo enseña al
// dejar el ratón encima, que es la única forma de leer entero un nombre que en
// el gajo sale recortado. Va en <title> y no en un tooltip propio a posta: la
// rueda gira, y un tooltip anclado a un gajo tendría que seguir la rotación.
// Además el lector de pantalla lo lee.
const descripcionCompleta = (premio) => {
  const nombre = String(premio?.nombre || premio?.etiqueta || '').trim();
  const texto = String(premio?.texto || '').trim();
  if (texto && texto !== nombre) return `${nombre} · ${texto}`;
  return nombre;
};

const RuedaRuleta = ({
  premios = [],
  colores,
  colorAro = '#FFFFFF',
  colorPuntero,
  imagenCentro = '',
  rotacion = 0,
  duracionMs = 0,
  className = '',
}) => {
  const total = premios.length;
  const anguloGajo = total > 0 ? 360 / total : 360;

  // Con muchos gajos el texto tiene que encoger o se pisa con el de al lado.
  const tamTexto = total <= 6 ? 8 : total <= 9 ? 6.8 : total <= 12 ? 5.8 : 5;
  // Cuántas letras caben. Con dos o tres premios el gajo es enorme y recortar a
  // 16 dejaba nombres como "Inténtalo de nu…" sin motivo; con muchos, en cambio,
  // hay que apretar o se pisan entre ellos. El resto lo cuenta el <title> del
  // gajo, que enseña el nombre completo al pasar el ratón.
  const maxCaracteres = total <= 3 ? 22 : total <= 6 ? 16 : total <= 9 ? 13 : 10;
  const hayIconos = premios.some((p) => p.icono);

  return (
    <div className={`${styles.contenedor} ${className}`.trim()}>
      {/* El puntero vive fuera del SVG que gira: es lo único fijo de la rueda.
          La cabeza es un semicírculo de radio 11 centrado en (12, 11), así que
          llega justo a y=0. Antes estaba centrada en (12, 6) y el arco subía
          hasta y=-5, fuera del viewBox: la punta se veía cortada por arriba. */}
      <div className={styles.puntero} style={{ color: colorPuntero }} aria-hidden="true">
        <svg viewBox="0 0 24 30" width="28" height="35">
          <path d="M12 30 L1 11 A 11 11 0 1 1 23 11 Z" fill="currentColor" />
          <circle cx="12" cy="11" r="4.5" fill="rgba(255,255,255,0.9)" />
        </svg>
      </div>

      <svg
        className={styles.rueda}
        viewBox="0 0 200 200"
        style={{
          transform: `rotate(${rotacion}deg)`,
          // Sin duración, sin transición: así el admin puede pintar la vista
          // previa sin que la rueda se ponga a girar sola al cambiar un color.
          transition: duracionMs > 0
            ? `transform ${duracionMs}ms cubic-bezier(0.16, 0.9, 0.2, 1)`
            : 'none',
        }}
        role="img"
        aria-label={total > 0
          ? `Rueda con ${total} premios: ${premios.map((p) => p.nombre || p.etiqueta).join(', ')}`
          : 'Rueda sin premios'}
      >
        {total === 0 && (
          <circle cx={CENTRO} cy={CENTRO} r={RADIO} fill="var(--color-border, #e2e8f0)" />
        )}

        {/* Un solo premio: el `path` de arco degenera (el punto inicial y el
            final coinciden), así que el gajo se pinta como círculo entero. */}
        {total === 1 && (
          <circle cx={CENTRO} cy={CENTRO} r={RADIO} fill={colorDeGajo(premios[0], 0, 1, colores)}>
            <title>{descripcionCompleta(premios[0])}</title>
          </circle>
        )}

        {/* El <title> va en el gajo entero, no solo en la etiqueta: así el nombre
            completo sale dejando el ratón en cualquier punto del sector, y no
            hay que apuntar a un texto de seis píxeles de alto. */}
        {total > 1 && premios.map((premio, i) => (
          <path
            key={premio.id || i}
            d={arcoGajo(RADIO, i * anguloGajo, (i + 1) * anguloGajo)}
            fill={colorDeGajo(premio, i, total, colores)}
            stroke={colorAro}
            strokeWidth="0.6"
          >
            <title>{descripcionCompleta(premio)}</title>
          </path>
        ))}

        {/* Textos: se rota el grupo hasta el centro del gajo y la etiqueta se
            escribe cerca del aro. Los gajos de la mitad de abajo se voltean
            180°: sin eso, la mitad de los premios se leen boca abajo. */}
        {total > 0 && premios.map((premio, i) => {
          const centroGajo = i * anguloGajo + anguloGajo / 2;
          const fondo = colorDeGajo(premio, i, total, colores);
          const color = textoOscuroSobre(fondo) ? '#1F2937' : '#FFFFFF';
          // La posición es siempre la misma (arriba, junto al aro): es la
          // rotación del grupo la que lleva la etiqueta a su gajo. Lo único que
          // cambia es que en la mitad de abajo el texto se gira sobre sí mismo
          // para que no quede cabeza abajo.
          const volteado = centroGajo > 90 && centroGajo < 270;
          const yIcono = CENTRO - RADIO + 16;
          const yTexto = CENTRO - RADIO + (hayIconos ? 30 : 20);
          const voltear = (y) => (volteado ? `rotate(180 ${CENTRO} ${y})` : undefined);
          return (
            <g
              key={`t-${premio.id || i}`}
              transform={`rotate(${centroGajo} ${CENTRO} ${CENTRO})`}
            >
              {/* La etiqueta se pinta encima del gajo y se traga el ratón, así
                  que necesita su propio <title> o al pasar por encima del texto
                  —justo donde uno apunta— no saldría nada. */}
              <title>{descripcionCompleta(premio)}</title>
              {premio.icono && (
                <text
                  x={CENTRO}
                  y={yIcono}
                  transform={voltear(yIcono)}
                  textAnchor="middle"
                  fontSize={tamTexto * 1.5}
                  className={styles.icono}
                >
                  {premio.icono}
                </text>
              )}
              <text
                x={CENTRO}
                y={yTexto}
                transform={voltear(yTexto)}
                textAnchor="middle"
                fontSize={tamTexto}
                fill={color}
                className={styles.etiqueta}
              >
                {recortar(premio.etiqueta || premio.nombre, maxCaracteres)}
              </text>
            </g>
          );
        })}

        {/* Aro exterior y tapa central. */}
        <circle
          cx={CENTRO} cy={CENTRO} r={RADIO}
          fill="none" stroke={colorAro} strokeWidth="6"
        />
        <circle cx={CENTRO} cy={CENTRO} r="15" fill={colorAro} />
        {imagenCentro
          ? (
            <>
              <clipPath id="ruleta-centro">
                <circle cx={CENTRO} cy={CENTRO} r="12" />
              </clipPath>
              <image
                href={imagenCentro}
                x={CENTRO - 12} y={CENTRO - 12} width="24" height="24"
                clipPath="url(#ruleta-centro)"
                preserveAspectRatio="xMidYMid slice"
              />
            </>
          )
          : <circle cx={CENTRO} cy={CENTRO} r="9" fill={colorPuntero || '#6D28D9'} />}
      </svg>
    </div>
  );
};

export default RuedaRuleta;
