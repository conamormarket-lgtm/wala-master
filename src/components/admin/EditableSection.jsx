import React from 'react';
import { useVisualEditor } from '../../pages/Tienda/contexts/VisualEditorContext';
import styles from './EditableSection.module.css';

const EditableSection = ({ sectionId, currentConfig, label, children }) => {
  const { isEditModeActive, openEditorForSection, activeSection } = useVisualEditor();

  if (!isEditModeActive) {
    return <>{children}</>;
  }

  const isActive = activeSection === sectionId;

  const handleEditClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openEditorForSection(sectionId, currentConfig);
  };

  // Comprobar si hay contenido real. Si children es false o null, mostrar placeholder.
  const isChildrenEmpty = !children || (Array.isArray(children) && children.every(child => !child));

  return (
    <div className={`${styles.editableWrapper} ${isActive ? styles.active : ''} ${isChildrenEmpty ? styles.isEmpty : ''}`}>
      <div className={styles.overlay} onClick={handleEditClick}>
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
