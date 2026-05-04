import React from 'react';
import { EyeIcon, EyeOffIcon, TrashIcon } from '../../common/Icons/Icons';
import styles from './BulkActions.module.css';

/**
 * Barra de acciones en masa que aparece cuando se seleccionan productos
 */
const BulkActions = ({
  selectedCount,
  onShowAll,
  onHideAll,
  onDeleteAll,
  onClearSelection,
  onExport,
  isProcessing = false
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className={styles.bulkActionsBar}>
      <div className={styles.bulkActionsContent}>
        <div className={styles.selectedInfo}>
          <strong>{selectedCount}</strong> producto{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={onShowAll}
            disabled={isProcessing}
            title="Mostrar productos seleccionados"
          >
            <EyeIcon size={16} />
            <span>Mostrar</span>
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={onHideAll}
            disabled={isProcessing}
            title="Ocultar productos seleccionados"
          >
            <EyeOffIcon size={16} />
            <span>Ocultar</span>
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.deleteBtn}`}
            onClick={onDeleteAll}
            disabled={isProcessing}
            title="Eliminar productos seleccionados"
          >
            <TrashIcon size={16} />
            <span>Eliminar</span>
          </button>
          {onExport && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={onExport}
              disabled={isProcessing}
              title="Exportar productos seleccionados"
            >
              <span>📥 Exportar</span>
            </button>
          )}
          <button
            type="button"
            className={styles.clearBtn}
            onClick={onClearSelection}
            disabled={isProcessing}
          >
            Limpiar selección
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(BulkActions);
