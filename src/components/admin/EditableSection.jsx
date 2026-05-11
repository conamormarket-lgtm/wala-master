import React from 'react';
import { useVisualEditor } from '../../pages/Tienda/contexts/VisualEditorContext';
import styles from './EditableSection.module.css';

const EditableSection = ({ sectionId, currentConfig, label, children }) => {
  const { isEditModeActive, openEditorForSection, activeSection, hoveredSectionId } = useVisualEditor();

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
