import React from 'react';
import styles from './NuevoPedidoButton.module.css';

const WHATSAPP_NUMBER = '51912881722';

const NuevoPedidoButton = ({ nombreCliente }) => {
  const nombre = nombreCliente || 'Cliente';

  const mensaje = `Hola, soy ${nombre}. Quiero hacer un nuevo pedido personalizado.`;
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;

  return (
    <div className={styles.container}>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.button}
      >
        Solicitar un nuevo pedido
      </a>

      <p className={styles.text}>
        Puedes solicitar otro pedido personalizado cuando lo necesites. Te ayudaremos a revisar opciones, diseños y detalles.
      </p>
    </div>
  );
};

export default NuevoPedidoButton;