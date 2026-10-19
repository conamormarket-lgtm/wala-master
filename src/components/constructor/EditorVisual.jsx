import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';

// Los dos se piden recién cuando un admin abre el editor (ninguno va en el
// archivo principal).
const EditorDeTienda = lazy(() => import('./EditorDeTienda'));
// El de antes, solo con el interruptor editorViejo (guia/ELIMINAR.md).
const VisualEditorPanel = lazy(() => import('../../pages/Tienda/admin/VisualEditorPanel'));

/** El panel del editor: el del kit (paso 8) o, con editorViejo, VisualEditorPanel. */
export default function EditorVisual() {
  const editorViejo = useLoViejo('editor');
  return (
    <Suspense fallback={null}>
      {editorViejo ? <VisualEditorPanel /> : <EditorDeTienda />}
    </Suspense>
  );
}
