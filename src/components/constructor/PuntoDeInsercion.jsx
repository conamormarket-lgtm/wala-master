import React, { lazy, Suspense } from 'react';
import { useVisualEditor } from '../../pages/Tienda/contexts/VisualEditorContext';
import useLoViejo from '../../hooks/useLoViejo';

const InsertarSeccion = lazy(() => import('./MarcasDeEdicion').then((m) => ({ default: m.InsertarSeccion })));

/**
 * El "+" entre las secciones mientras se edita: el del kit (abre el catálogo
 * del panel) o, con editorViejo, el de antes (`viejo`, el menú de la página).
 * Fuera del editor no dibuja nada.
 */
export default function PuntoDeInsercion({ indice, viejo = null }) {
  const { isEditModeActive } = useVisualEditor();
  const editorViejo = useLoViejo('editor');
  if (!isEditModeActive) return null;
  if (editorViejo) return viejo;
  return <Suspense fallback={null}><InsertarSeccion indice={indice} /></Suspense>;
}
