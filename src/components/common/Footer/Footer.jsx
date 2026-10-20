import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../../hooks/useLoViejo';
import PieDeTienda from '../../marco/PieDeTienda';

// El pie de antes solo baja si hace falta (interruptor pieViejo, o el editor
// de antes, que dibuja sus controles dentro de ese pie).
const FooterViejo = lazy(() => import('./FooterViejo'));

/** El pie de página: PieDeTienda (el kit) o el de antes. INICIO.md M5. */
export default function Footer() {
  const pieViejo = useLoViejo('pie');
  const editorViejo = useLoViejo('editor');
  if (pieViejo || editorViejo) return <Suspense fallback={null}><FooterViejo /></Suspense>;
  return <PieDeTienda />;
}
