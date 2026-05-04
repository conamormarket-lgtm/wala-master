import React from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';
import styles from './ToastContainer.module.css';

/**
 * Contenedor para múltiples toasts
 */
const ToastContainer = ({ toasts = [], onRemove }) => {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className={styles.container} role="region" aria-label="Notificaciones">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={onRemove}
        />
      ))}
    </div>,
    document.body
  );
};

export default ToastContainer;
