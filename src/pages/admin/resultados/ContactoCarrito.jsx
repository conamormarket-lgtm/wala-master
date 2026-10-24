import React from 'react';
import { urlWhatsApp, telefonoDePerfil, aceptoWhatsApp } from '../../../utils/whatsappLink';
import styles from './ContactoCarrito.module.css';

// Sin emojis: WhatsApp de escritorio (Windows) los rompe al abrir un link wa.me.
export function mensajeCarrito(nombre) {
  const primerNombre = String(nombre || '').trim().split(' ')[0];
  return [
    `¡Hola${primerNombre ? ` ${primerNombre}` : ''}!`,
    'Vimos que dejaste productos en tu carrito de Walá. Siguen esperándote:',
    `${window.location.origin}/carrito`,
    '¿Te ayudamos a terminar tu pedido?',
  ].join('\n');
}

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
