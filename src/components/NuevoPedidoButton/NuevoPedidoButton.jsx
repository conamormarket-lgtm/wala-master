import React from 'react';
import { WHATSAPP_NUMBER, WHATSAPP_MESSAGE } from '../../utils/constants';
import styles from './NuevoPedidoButton.module.css';

const NuevoPedidoButton = ({ nombreCliente }) => {
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <div className={styles.container}>
      <a 
        href={whatsappUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className={styles.button}
      >
        HACER UN PEDIDO NUEVO
      </a>
      <p className={styles.subtexto}>
        <strong>{nombreCliente}</strong>, tenemos promociones y descuentos por ser uno de nuestros apreciados clientes.
      </p>
    </div>
  );
};

export default NuevoPedidoButton;
