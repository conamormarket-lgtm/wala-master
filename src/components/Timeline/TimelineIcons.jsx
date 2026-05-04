import React from 'react';

const SIZE = 30;

const icons = {
  compra: (
    <path fill="currentColor" fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
  ),
  diseno: (
    <path fill="currentColor" d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  ),
  cobranza: (
    <path fill="currentColor" fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
  ),
  preparacion: (
    <path fill="currentColor" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
  ),
  estampado: (
    <path fill="currentColor" fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666.666 0 10-.717.013 5.05 5.05 0 00-8.54 2.064 1 1 0 01-1-1V3a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 11-2 0V4H6a3 3 0 00-3 3v6a3 3 0 006 3h2a3 3 0 006-3V7a3 3 0 00-3-3H9V3a1 1 0 011-1h2z" clipRule="evenodd" />
  ),
  empaquetado: (
    <path fill="currentColor" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm0 2h4v2H4V5zm0 4h4v2H4V9zm0 4h4v2H4v-2zm6-8h4v2h-4V5zm0 4h4v2h-4V9zm0 4h4v2h-4v-2z" />
  ),
  reparto: (
    <path fill="currentColor" d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
  ),
  finalizado: (
    <path fill="currentColor" fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  ),
};

export default function TimelineIcon({ stageKey, completed, isActual, conDeuda }) {
  const IconPath = icons[stageKey] || icons.compra;
  let color = 'var(--gris-texto-secundario)';
  if (completed) color = 'var(--blanco)';
  else if (isActual) color = conDeuda ? '#ef4444' : 'var(--verde-exito)';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      width={SIZE}
      height={SIZE}
      aria-hidden
      style={{ color, flexShrink: 0 }}
    >
      {IconPath}
    </svg>
  );
}
