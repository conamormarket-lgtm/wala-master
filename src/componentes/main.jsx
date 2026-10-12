// Página aparte con el kit de componentes de Walá. Solo para verla en local
// (npm run dev -> http://localhost:3000/componentes.html). No monta App, ni
// Firebase, ni el router: así carga aunque el backend o Vercel estén caídos.
// No entra en el build de producción (vite solo empaqueta index.html).
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/variables.css';
import '../theme/tokens.css';
import '../styles/globals.css';
import ComponentesPage from './ComponentesPage';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ComponentesPage />
  </React.StrictMode>,
);
