import React from 'react';
import { createPortal } from 'react-dom';
import { useBloquearScroll } from '../../hooks/useBloquearScroll';

/**
 * Fondo oscuro de una ventana (modal) de Crear. Va en un portal al final de
 * <body>: dentro de la página quedaba atrapada bajo el header y la barra de
 * admin por más z-index que tuviera. Mientras está abierta la página de
 * atrás no se mueve. Las props van al <div> del fondo (className, role,
 * onClick…).
 */
const CapaModal = ({ children, ...props }) => {
  useBloquearScroll();
  return createPortal(<div {...props}>{children}</div>, document.body);
};

export default CapaModal;
