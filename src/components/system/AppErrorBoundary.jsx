import React from 'react';
import { reportClientError } from '../../services/observability/errorReporter';
import styles from './AppErrorBoundary.module.css';

// ── Observabilidad (Fase 4): ErrorBoundary GLOBAL ─────────────────────────────
// Captura errores de render en TODO el árbol principal, muestra un fallback
// amable y los REGISTRA (fire-and-forget) en analytics_events vía el reportador.
//
// Convive con el ErrorBoundary existente (components/common/ErrorBoundary):
// aquel mantiene la autorecuperación de chunks/Fabric; este es la red de
// seguridad externa que ademas registra el error. Si por alguna razón el
// boundary interno deja pasar un error, este lo atrapa sin que la app quede en
// blanco. Todo el registro va envuelto para no afectar el render.

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    const msg = error && typeof error.message === 'string' ? error.message : '';
    // Extensiones / Google Translate mutan el DOM → removeChild. No tumbar toda la app.
    if (
      error?.name === 'NotFoundError' ||
      msg.includes('removeChild') ||
      msg.includes('insertBefore') ||
      msg.includes('The node to be removed is not a child')
    ) {
      return null;
    }
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const msg = error && typeof error.message === 'string' ? error.message : '';
    if (
      error?.name === 'NotFoundError' ||
      msg.includes('removeChild') ||
      msg.includes('insertBefore')
    ) {
      try {
        // eslint-disable-next-line no-console
        console.warn('AppErrorBoundary: ignorando conflicto de DOM:', msg);
      } catch {
        /* no-op */
      }
      return;
    }
    try {
      // eslint-disable-next-line no-console
      console.error('AppErrorBoundary:', error, errorInfo);
    } catch {
      /* no-op */
    }
    try {
      const message = error && typeof error.message === 'string' ? error.message : String(error || '');
      const stack = error && typeof error.stack === 'string' ? error.stack : null;
      const componentStack = errorInfo && typeof errorInfo.componentStack === 'string'
        ? errorInfo.componentStack
        : null;
      reportClientError({ source: 'render', message, stack, componentStack });
    } catch {
      /* la observabilidad nunca rompe la app */
    }
  }

  handleReload() {
    try {
      window.location.reload();
    } catch {
      /* no-op */
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container} role="alert">
          <h2 className={styles.title}>Algo salió mal</h2>
          <p className={styles.message}>
            Ocurrió un problema inesperado. Por favor, recarga la página para continuar.
          </p>
          <button type="button" className={styles.button} onClick={this.handleReload}>
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default AppErrorBoundary;
