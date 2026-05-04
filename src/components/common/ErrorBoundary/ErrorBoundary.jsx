import React from 'react';
import styles from './ErrorBoundary.module.css';

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    const msg = error && typeof error.message === 'string' ? error.message : '';
    // Prevent some canvas errors from crashing the app
    if (msg.includes("reading 'clearRect')")) return null;
    
    // Auto-reload on ChunkLoadError (very common with lazy loading and new deployments)
    if (error && error.name === 'ChunkLoadError') {
      return { hasError: true, error, isChunkLoadError: true };
    }
    
    return { hasError: true, error, isChunkLoadError: false };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
    if (error && error.name === 'ChunkLoadError') {
      // Intentar refrescar automáticamente una sola vez
      const reloaded = sessionStorage.getItem('chunk_load_reload');
      if (!reloaded) {
        sessionStorage.setItem('chunk_load_reload', 'true');
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const message = err && typeof err.message === 'string' ? err.message : '';
      return (
        <div className={styles.container}>
          <h2 className={styles.title}>
            {this.state.isChunkLoadError ? 'Actualizando conectividad...' : 'Algo salió mal'}
          </h2>
          <p className={styles.message}>
            {this.state.isChunkLoadError 
              ? 'Detectamos una nueva versión de esta vista. Por favor, recarga la página.'
              : 'No se pudo cargar esta página. Intenta recargar o volver atrás.'}
          </p>
          {message && (
            <p className={styles.errorDetail} title={message}>
              {message.length > 120 ? message.slice(0, 120) + '…' : message}
            </p>
          )}
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              if (this.state.isChunkLoadError) {
                window.location.reload();
              } else {
                window.history.back();
              }
            }}
          >
            {this.state.isChunkLoadError ? 'Recargar página' : 'Volver atrás'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
