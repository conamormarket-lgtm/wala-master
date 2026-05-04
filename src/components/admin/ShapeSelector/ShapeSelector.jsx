import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SHAPE_TYPES } from '../../../utils/shapeUtils';
import { getCustomShapes } from '../../../services/customShapes';
import ShapeCreator from '../ShapeCreator/ShapeCreator';
import styles from './ShapeSelector.module.css';

const ShapeSelector = ({ onSelect, onClose }) => {
  const [showCreator, setShowCreator] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: customShapesData = [], isLoading } = useQuery({
    queryKey: ['customShapes'],
    queryFn: async () => {
      const { data, error } = await getCustomShapes();
      if (error) return [];
      return data;
    }
  });

  const shapes = [
    { type: SHAPE_TYPES.RECTANGLE, label: 'Rectángulo', icon: '▭' },
    { type: SHAPE_TYPES.SQUARE, label: 'Cuadrado', icon: '▢' },
    { type: SHAPE_TYPES.CIRCLE, label: 'Círculo', icon: '○' },
    { type: SHAPE_TYPES.ELLIPSE, label: 'Elipse', icon: '◯' },
    { type: SHAPE_TYPES.HEART, label: 'Corazón', icon: '♥' }
  ];

  const handleSelect = (shapeType, customShapeId = null) => {
    if (onSelect) {
      if (shapeType === SHAPE_TYPES.CUSTOM) {
        onSelect(shapeType, customShapeId);
      } else {
        onSelect(shapeType);
      }
    }
    if (onClose) {
      onClose();
    }
  };

  const handleCreatorSave = () => {
    // Recargar formas personalizadas
    queryClient.invalidateQueries({ queryKey: ['customShapes'] });
    setShowCreator(false);
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <h3 className={styles.title}>Seleccionar forma de zona</h3>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </div>
          
          <div className={styles.shapesGrid}>
            {/* Formas predefinidas */}
            {shapes.map((shape) => (
              <button
                key={shape.type}
                type="button"
                className={styles.shapeOption}
                onClick={() => handleSelect(shape.type)}
              >
                <div className={styles.shapeIcon}>{shape.icon}</div>
                <span className={styles.shapeLabel}>{shape.label}</span>
              </button>
            ))}
            
            {/* Botón creación libre */}
            <button
              type="button"
              className={`${styles.shapeOption} ${styles.freeCreateButton}`}
              onClick={() => handleSelect('free-create')}
            >
              <div className={styles.shapeIcon}>✏️</div>
              <span className={styles.shapeLabel}>Creación libre</span>
            </button>
            
            {/* Botón crear forma */}
            <button
              type="button"
              className={`${styles.shapeOption} ${styles.createButton}`}
              onClick={() => setShowCreator(true)}
            >
              <div className={styles.shapeIcon}>➕</div>
              <span className={styles.shapeLabel}>Crear forma</span>
            </button>
            
            {/* Formas personalizadas */}
            {isLoading && (
              <div className={styles.loading}>Cargando formas personalizadas...</div>
            )}
            {customShapesData.map((customShape) => (
              <button
                key={customShape.id}
                type="button"
                className={styles.shapeOption}
                onClick={() => handleSelect(SHAPE_TYPES.CUSTOM, customShape.id)}
                title={customShape.name}
              >
                <svg
                  className={styles.customShapeIcon}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <path
                    d={customShape.svgPath || ''}
                    fill="var(--rojo-principal, #b4171e)"
                    stroke="none"
                  />
                </svg>
                <span className={styles.shapeLabel}>{customShape.name || 'Forma personalizada'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {showCreator && (
        <ShapeCreator
          onSave={handleCreatorSave}
          onClose={() => setShowCreator(false)}
        />
      )}
    </>
  );
};

export default ShapeSelector;
