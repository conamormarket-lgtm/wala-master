import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEditor } from '../../../contexts/EditorContext';
import { getCliparts } from '../../../services/cliparts';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import styles from './ClipartSelector.module.css';

const ClipartSelector = () => {
  const { product, addLayer, getDefaultPositionInPrintArea } = useEditor();
  const [activeTab, setActiveTab] = useState('global');
  const defaultPos = getDefaultPositionInPrintArea();

  const { data: globalCliparts = [], isLoading } = useQuery({
    queryKey: ['cliparts'],
    queryFn: async () => {
      const { data, error } = await getCliparts();
      if (error) return [];
      return data;
    },
  });

  const productCliparts = product?.productCliparts ?? [];

  const handleSelect = (url) => {
    addLayer(undefined, {
      type: 'image',
      src: toDirectImageUrl(url),
      x: defaultPos.x,
      y: defaultPos.y,
      scaleX: 1,
      scaleY: 1,
    });
  };

  const list = activeTab === 'global' ? globalCliparts : productCliparts;

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'global' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('global')}
        >
          Galería
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'product' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('product')}
        >
          Este producto
        </button>
      </div>
      {isLoading && activeTab === 'global' && <p className={styles.loading}>Cargando...</p>}
      <div className={styles.grid}>
        {list.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.thumb}
            onClick={() => handleSelect(item.url)}
            title={item.name || 'Clipart'}
          >
            <img src={toDirectImageUrl(item.url)} alt="" loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
          </button>
        ))}
      </div>
      {list.length === 0 && !isLoading && (
        <p className={styles.empty}>
          {activeTab === 'product' ? 'Este producto no tiene cliparts.' : 'No hay cliparts en la galería.'}
        </p>
      )}
    </div>
  );
};

export default ClipartSelector;
