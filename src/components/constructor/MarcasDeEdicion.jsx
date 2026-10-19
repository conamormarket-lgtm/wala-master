import React from 'react';
import { useVisualEditor } from '../../pages/Tienda/contexts/VisualEditorContext';
import { SeccionEditable, InsertarAqui } from '../../componentes/kit/editor/SeccionEditable';
import { ESQUEMAS_GLOBALES } from '../../componentes/kit/editor/esquemas';
import { ordenadas, moverSeccion, duplicarSeccion } from '../../componentes/kit/editor/operaciones';

/*
 * Lo que el editor del kit dibuja sobre la página mientras se edita (paso 8):
 * el marco de cada sección con su barra (nombre, subir, bajar, duplicar) y el
 * "+" entre secciones, que abre el catálogo del panel en ese lugar. Llega en
 * su propio archivo, cuando un admin abre el editor (EditableSection y
 * PuntoDeInsercion lo piden).
 */

/** Una parte editable de la página: una sección del builder (con tipo) o algo global (menú, buscador…). */
export function SeccionDeLaPagina({ sectionId, tipo, label, currentConfig, children }) {
  const { activeSection, hoveredSectionId, openEditorForSection, storeConfigDraft, updateSectionsDraft } = useVisualEditor();
  const lista = ordenadas(storeConfigDraft?.sections || []);
  const indice = tipo ? lista.findIndex((x) => x.id === sectionId) : -1;
  const global = !tipo ? ESQUEMAS_GLOBALES[sectionId] : null;
  return (
    <SeccionEditable
      id={sectionId}
      tipo={tipo}
      nombre={tipo ? undefined : global?.nombre || label}
      icono={global?.icono}
      activa={activeSection === sectionId}
      resaltada={hoveredSectionId === sectionId}
      primera={indice === 0}
      ultima={indice === lista.length - 1}
      onEditar={(id) => openEditorForSection(id, storeConfigDraft || currentConfig)}
      onMover={indice >= 0 ? (id, paso) => updateSectionsDraft(moverSeccion(lista, id, paso)) : undefined}
      onDuplicar={indice >= 0 ? (id) => updateSectionsDraft(duplicarSeccion(lista, id)) : undefined}
    >
      {children}
    </SeccionEditable>
  );
}

/** El "+" antes de la sección `indice` (o al final): abre el catálogo del panel. */
export function InsertarSeccion({ indice }) {
  const { insertarEn, setInsertarEn, closeEditor } = useVisualEditor();
  return (
    <InsertarAqui
      indice={indice}
      activo={insertarEn === indice}
      onInsertar={(i) => { closeEditor(); setInsertarEn(i); }}
    />
  );
}
