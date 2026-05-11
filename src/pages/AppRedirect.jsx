import React, { useEffect } from 'react';

const AppRedirect = () => {
  useEffect(() => {
    // Redirige automáticamente a la Play Store
    window.location.replace('https://play.google.com/store/apps/details?id=com.wala.tienda');
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <h2 style={{ marginBottom: '1rem', color: '#111' }}>Redirigiendo a la Play Store...</h2>
      <p style={{ color: '#666' }}>
        Si la tienda no se abre automáticamente, <a href="https://play.google.com/store/apps/details?id=com.wala.tienda" style={{ color: '#0066cc', fontWeight: 'bold' }}>haz clic aquí</a>.
      </p>
    </div>
  );
};

export default AppRedirect;
