import React from 'react';
import { useEditor } from '../../../contexts/EditorContext';
import styles from './ColorPicker.module.css';

const ColorPicker = ({ layerId, fillKey = 'color' }) => {
  const { layers, updateLayer } = useEditor();
  const layer = layers.find(l => l.id === layerId);

  if (!layer) return null;

  const value = layer[fillKey] ?? layer.color ?? '#000000';
  const update = (val) => updateLayer(layerId, { [fillKey]: val });

  const colors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'
  ];

  return (
    <div className={styles.picker}>
      <label>{fillKey === 'fill' ? 'Relleno:' : 'Color:'}</label>
      <div className={styles.colorGrid}>
        {colors.map(color => (
          <button
            key={color}
            className={`${styles.colorButton} ${value === color ? styles.active : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => update(color)}
            title={color}
          />
        ))}
      </div>
      <input
        type="color"
        value={value}
        onChange={(e) => update(e.target.value)}
        className={styles.colorInput}
      />
    </div>
  );
};

export default ColorPicker;
