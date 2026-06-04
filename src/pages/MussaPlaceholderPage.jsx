import React from 'react';
import { useLocation } from 'react-router-dom';

const MussaPlaceholderPage = () => {
  const location = useLocation();

  return (
    <div style={{ padding: '100px 20px', textAlign: 'center', minHeight: '60vh' }}>
      <h1>Página en construcción: {location.pathname}</h1>
      <p>Texto vacío de momento, a futuro se pondrá diseño.</p>
    </div>
  );
};

export default MussaPlaceholderPage;
