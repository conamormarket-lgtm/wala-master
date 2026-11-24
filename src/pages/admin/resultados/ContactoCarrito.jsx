import React from 'react';
import { urlWhatsApp, telefonoDePerfil, aceptoWhatsApp, mensajeCarrito } from '../../../utils/whatsappLink';
import styles from './ContactoCarrito.module.css';

// El mensaje vive en utils/whatsappLink (lo usa también el kit del admin).
export { mensajeCarrito };

/**
 * Botón de WhatsApp de un carrito abandonado: solo con el número del cliente y
 * solo si aceptó recibir mensajes por WhatsApp en "Mi perfil"; si no, dice por qué.
 * cart: { uid, displayName }, perfil: doc de portal_clientes_users.
 */
export default function ContactoCarrito({ cart, perfil, cargando, claseNota = styles.nota }) {
  if (!cart.uid) return <span className={claseNota}>Sin cuenta</span>;
  if (cargando) return <span className={claseNota}>…</span>;
  const telefono = telefonoDePerfil(perfil);
  if (!telefono) return <span className={claseNota}>Sin teléfono</span>;
  if (!aceptoWhatsApp(perfil)) return <span className={claseNota}>No aceptó WhatsApp</span>;
  const nombre = perfil?.displayName || cart.displayName;
  return (
    <a
      href={urlWhatsApp(telefono, mensajeCarrito(nombre))}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.boton}
    >
      WhatsApp
    </a>
  );
}
