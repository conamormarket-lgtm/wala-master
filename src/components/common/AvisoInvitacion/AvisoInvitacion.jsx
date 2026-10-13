import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { IconoWala } from '../../../componentes/kit/IconosWala';
import { Trazo } from '../../../componentes/kit/Marca';
import useInvitacionReferido, { plazoLegible } from '../../../hooks/useInvitacionReferido';
import styles from './AvisoInvitacion.module.css';

const CERRADO_KEY = 'wala_aviso_invitacion_cerrado';

const leerCerrado = () => {
  try { return sessionStorage.getItem(CERRADO_KEY); } catch { return null; }
};

// "María" con la letra del logo y su trazo a mano debajo; sin nombre, la
// palabra "invitación" recibe el mismo trato.
const Resaltado = ({ children }) => (
  <span className={styles.resaltado}>
    {children}
    <Trazo className={styles.trazo} />
  </span>
);

/**
 * Franja sobre la cabecera para quien llegó por un enlace de referido:
 * "María te invitó a Walá · Compra hasta mañana 9:20 p. m. y María gana
 * monedas con tu pedido". Se ve en cada página mientras el plazo de 36 h siga
 * abierto; se puede cerrar (vuelve en la próxima visita). En el checkout no
 * sale: ahí va NotaInvitacion, junto al total.
 */
const AvisoInvitacion = () => {
  const invitacion = useInvitacionReferido();
  const { pathname } = useLocation();
  const [cerrado, setCerrado] = useState(leerCerrado);
  const [destino, setDestino] = useState(null);

  // Mismo hueco que AppDownloadBanner (#app-top-banner-slot, antes del Header).
  useLayoutEffect(() => {
    setDestino(document.getElementById('app-top-banner-slot'));
  }, []);

  if (!invitacion || !destino || pathname.startsWith('/checkout')) return null;
  if (cerrado === invitacion.referralId) return null;

  const cerrar = () => {
    try { sessionStorage.setItem(CERRADO_KEY, invitacion.referralId); } catch { /* modo privado */ }
    setCerrado(invitacion.referralId);
  };
  const { nombre } = invitacion;

  return createPortal(
    <aside className={styles.aviso} aria-label="Invitación">
      <div className={styles.contenido}>
        <IconoWala nombre="regalo" tamano={36} className={styles.icono} />
        <p className={styles.texto}>
          <span className={styles.titulo}>
            {nombre
              ? <><Resaltado>{nombre}</Resaltado> te invitó a Walá</>
              : <>Llegaste con una <Resaltado>invitación</Resaltado></>}
          </span>
          <span className={styles.detalle}>
            Compra hasta {plazoLegible(invitacion.vence)} y {nombre || 'quien te invitó'} gana
            monedas<span className={styles.soloAncho}> con tu pedido. A ti no te cuesta nada</span>.
          </span>
        </p>
        <button type="button" className={styles.cerrar} onClick={cerrar} aria-label="Cerrar aviso de invitación">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>,
    destino
  );
};

/** Línea del resumen del checkout: con qué invitación se está comprando. */
export const NotaInvitacion = ({ className }) => {
  const invitacion = useInvitacionReferido();
  if (!invitacion) return null;
  const { nombre } = invitacion;
  return (
    <div className={[styles.nota, className].filter(Boolean).join(' ')}>
      <IconoWala nombre="corazon" tamano={30} className={styles.icono} />
      <p className={styles.notaTexto}>
        {nombre
          ? <>Compras con la invitación de <strong>{nombre}</strong>. Cuando recibas tu pedido, {nombre} gana monedas.</>
          : <>Compras con una invitación. Cuando recibas tu pedido, quien te invitó gana monedas.</>}
        {' '}A ti no te cuesta nada.
      </p>
    </div>
  );
};

export default AvisoInvitacion;
