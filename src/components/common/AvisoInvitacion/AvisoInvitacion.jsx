import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { IconoWala } from '../../../componentes/kit/IconosWala';
import { Trazo } from '../../../componentes/kit/Marca';
import { useAuth } from '../../../contexts/AuthContext';
import useInvitacionReferido, { plazoLegible } from '../../../hooks/useInvitacionReferido';
import { BONO_BIENVENIDA_INVITACION } from '../../../services/referrals';
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
 * Qué decirle a quien llegó por un link, según el tipo:
 *  - invitación, sin cuenta: crear cuenta y recibir el bono de bienvenida.
 *  - invitación aceptada (cuenta nueva): ya tiene el bono; su primera compra
 *    (30 días) le suma a quien invitó.
 *  - link de producto / tienda, o invitación que no aplicó (ya tenía cuenta):
 *    comprar dentro de las 36 h.
 */
function textos(invitacion, conCuenta) {
  const { nombre, tipo, invitacion: estado, vence } = invitacion;
  const quien = nombre || 'quien te invitó';
  if (tipo === 'invitacion' && estado === 'aceptada') {
    return {
      detalle: `Ya tienes tus ${BONO_BIENVENIDA_INVITACION} monedas de bienvenida. Tu primera compra hasta ${plazoLegible(vence)} le suma monedas a ${quien}.`,
      corto: `Ya tienes tus ${BONO_BIENVENIDA_INVITACION} monedas de bienvenida.`,
    };
  }
  if (tipo === 'invitacion' && !estado && !conCuenta) {
    return {
      detalle: `Crea tu cuenta y recibe ${BONO_BIENVENIDA_INVITACION} monedas de bienvenida para tu primera compra.`,
      corto: `Crea tu cuenta y recibe ${BONO_BIENVENIDA_INVITACION} monedas.`,
      crearCuenta: true,
    };
  }
  return {
    detalle: `Compra hasta ${plazoLegible(vence)} y ${quien} gana monedas con tu pedido. A ti no te cuesta nada.`,
    corto: `Compra hasta ${plazoLegible(vence)} y ${quien} gana monedas.`,
  };
}

/**
 * Franja sobre la cabecera para quien llegó por un link de referido: "María te
 * invitó a Walá" y qué gana cada uno. Se ve en cada página mientras el link
 * siga vigente; se puede cerrar (vuelve en la próxima visita). En el checkout
 * no sale: ahí va NotaInvitacion, junto al total.
 */
const AvisoInvitacion = () => {
  const invitacion = useInvitacionReferido();
  const { user } = useAuth();
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
  const t = textos(invitacion, !!(user && !user.isAnonymous));
  const mostrarCrearCuenta = t.crearCuenta && pathname !== '/registro';

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
          <span className={`${styles.detalle} ${styles.soloAncho}`}>{t.detalle}</span>
          <span className={`${styles.detalle} ${styles.soloAngosto}`}>{t.corto}</span>
        </p>
        {mostrarCrearCuenta && (
          <Link to="/registro" className={styles.accion}>Crear cuenta</Link>
        )}
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
  const { nombre, tipo, invitacion: estado } = invitacion;
  const quien = nombre || 'quien te invitó';
  return (
    <div className={[styles.nota, className].filter(Boolean).join(' ')}>
      <IconoWala nombre="corazon" tamano={30} className={styles.icono} />
      <p className={styles.notaTexto}>
        {tipo === 'invitacion' && estado === 'aceptada'
          ? <>Es tu primera compra con la invitación de {nombre ? <strong>{nombre}</strong> : 'quien te invitó'}. Cuando la recibas, {quien} gana monedas.</>
          : nombre
            ? <>Compras con la invitación de <strong>{nombre}</strong>. Cuando recibas tu pedido, {nombre} gana monedas.</>
            : <>Compras con una invitación. Cuando recibas tu pedido, quien te invitó gana monedas.</>}
        {' '}A ti no te cuesta nada.
      </p>
    </div>
  );
};

export default AvisoInvitacion;
