// =========================================================================
// Zona Arcade — Shell común (Walá Design System, «Aurora Violeta Serena»)
// -------------------------------------------------------------------------
// Antes cada minijuego traía su propia cabecera y su propio fondo, así que al
// saltar del hub a la ruleta o a las bolitas cambiaban el ancho, el margen y el
// enlace de volver. Este shell pone el mismo suelo en las tres pantallas: fondo
// de página del tema, ancho de contenido y una barra superior con un "volver"
// que cumple el área táctil mínima.
//
// Deliberadamente SOBRIO: sin fondos decorativos ni vidrio. Es una sección de
// tienda, no una landing; el color lo aportan las tarjetas, no el lienzo.
//
// Es solo presentación: no conoce reglas de juego ni de economía.
// =========================================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import styles from './ArcadeShell.module.css';
import { T } from '../../i18n/useTranslatedText';

/**
 * ArcadeShell — envoltorio visual de la Zona Arcade.
 *
 * @param {string}  [back]       Ruta del enlace "volver" (si falta, no hay barra).
 * @param {string}  [backLabel]  Texto del enlace "volver" (por defecto "Volver").
 * @param {string}  [title]      Título centrado de la barra superior.
 * @param {React.ReactNode} [acciones] Controles a la derecha de la barra. Si no
 *   los hay se pinta un hueco del mismo ancho, para que el título quede centrado.
 * @param {'md'|'lg'} [width='lg'] Ancho del contenido (md = pantallas de juego).
 * @param {string}  [className]  Clases extra del contenedor interno (al final).
 */
const ArcadeShell = ({
  back,
  backLabel = 'Volver',
  title,
  acciones,
  width = 'lg',
  className,
  children,
}) => {
  const clasesInner = [
    styles.inner,
    width === 'md' ? styles.widthMd : styles.widthLg,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.shell}>
      <div className={clasesInner}>
        {back && (
          <div className={styles.topBar}>
            {/* El aria-label va siempre porque en movil el texto se oculta para
                dejar sitio al titulo y a las acciones. */}
            <Link to={back} className={styles.backBtn} aria-label={backLabel}>
              <ArrowLeft size={18} aria-hidden="true" />
              <span className={styles.backTexto}><T>{backLabel}</T></span>
            </Link>
            {title && <h1 className={styles.topTitle}><T>{title}</T></h1>}
            {/* A la derecha van las acciones de la pantalla. Si no hay, queda un
                fantasma del mismo ancho que el botón de volver, que mantiene el
                título centrado sin el position:absolute que antes se solapaba
                con el enlace en móvil. */}
            {acciones
              ? <div className={styles.topAcciones}>{acciones}</div>
              : <span className={styles.topSpacer} aria-hidden="true" />}
          </div>
        )}

        {children}
      </div>
    </div>
  );
};

export default ArcadeShell;
