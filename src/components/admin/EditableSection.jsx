import React, { lazy, Suspense } from 'react';
import { useVisualEditor } from '../../pages/Tienda/contexts/VisualEditorContext';
import useLoViejo from '../../hooks/useLoViejo';
import styles from './EditableSection.module.css';

// El marco del editor del kit (paso 8): llega cuando un admin abre el editor.
const SeccionDeLaPagina = lazy(() => import('../constructor/MarcasDeEdicion').then((m) => ({ default: m.SeccionDeLaPagina })));

/*
 * Una parte de la página que se edita con el editor visual. Fuera del editor
 * no dibuja nada propio. En el editor del kit, el marco con su barra
 * (SeccionEditable); con editorViejo, el velo de antes.
 *  - tipo: el de la sección del builder (con él, la barra puede subirla,
 *    bajarla y duplicarla); sin él es algo global (menú, buscador…)
 */
const EditableSection = (props) => {
  const { isEditModeActive } = useVisualEditor();
  const editorViejo = useLoViejo('editor');
  if (!isEditModeActive) return <>{props.children}</>;
  if (editorViejo) return <SeccionVieja {...props} />;
  return (
    <Suspense fallback={props.children}>
      <SeccionDeLaPagina {...props} />
    </Suspense>
  );
};

const SeccionVieja = ({ sectionId, currentConfig, label, children }) => {
  const { openEditorForSection, activeSection, hoveredSectionId } = useVisualEditor();

  const isActive = activeSection === sectionId;

  const handleEditClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openEditorForSection(sectionId, currentConfig);
  };

  // Comprobar si hay contenido real. Si children es false o null, mostrar placeholder.
  const isChildrenEmpty = !children || (Array.isArray(children) && children.every(child => !child));

  const isHoveredFromDrawer = hoveredSectionId === sectionId;

  // Estilos inline garantizan que no haya problemas de CSS Modules o especificidad
  const overlayHoverStyle = isHoveredFromDrawer ? {
    border: '4px solid #3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    pointerEvents: 'none',
    zIndex: 99999,
    boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)'
  } : {};

  return (
    <div className={`${styles.editableWrapper} ${isActive ? styles.active : ''} ${isChildrenEmpty ? styles.isEmpty : ''}`}>
      <div className={styles.overlay} onClick={handleEditClick} style={overlayHoverStyle}>
        <div className={styles.editButton}>
          ✏️ Editar {label}
        </div>
      </div>
      {isChildrenEmpty ? (
        <div className={styles.emptyPlaceholder}>
          <span>⚠️ Sección Vacía: {label}</span>
          <small>Haz clic en Editar para configurar</small>
        </div>
      ) : (
        children
      )}
    </div>
  );
};

export default EditableSection;
