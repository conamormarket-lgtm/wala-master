import React from 'react';
import styles from './MapLocation.module.css';
import { TextoSeccion, BotonSeccion } from '../textStyleUtils.jsx';

const MapLocation = ({ config }) => {
  const {
    title = 'Encuéntranos',
    description = 'Visita nuestra tienda física',
    embedUrl = '',
    layout = 'mapRight', // mapRight, mapLeft, mapTop, mapBottom
    mapWidth = '50%',
    mapHeight = '400px'
  } = config || {};

  if (!embedUrl?.trim() && !title?.trim()) return null;

  // Extraer el src si el usuario pegó todo el <iframe> de Google Maps
  let finalSrc = embedUrl;
  const srcMatch = finalSrc.match(/src="([^"]+)"/);
  if (srcMatch && srcMatch[1]) {
    finalSrc = srcMatch[1];
  }

  // Determinar la clase de layout
  const layoutClass = styles[layout] || styles.mapRight;

  return (
    <div className={`${styles.container} ${layoutClass}`}>
      <div className={styles.textContent}>
        {/* Título y descripción con estilo editable (alineación/subrayado/fondo/enlace). */}
        <TextoSeccion settings={config} prefix="title" as="h2" className={styles.title}>
          {title}
        </TextoSeccion>
        <TextoSeccion settings={config} prefix="description" as="p" className={styles.description}>
          {description}
        </TextoSeccion>
        {/* Botón opcional: solo se renderiza si hay buttonText && buttonLink. */}
        <BotonSeccion settings={config} />
      </div>
      
      <div 
        className={styles.mapWrapper} 
        style={{ 
          width: layout === 'mapTop' || layout === 'mapBottom' ? '100%' : mapWidth,
          height: mapHeight 
        }}
      >
        {finalSrc ? (
          <iframe
            src={finalSrc}
            className={styles.mapIframe}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Google Maps Location"
          ></iframe>
        ) : (
          <div style={{width: '100%', height: '100%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999'}}>
            Añade la URL de Google Maps
          </div>
        )}
      </div>
    </div>
  );
};

export default MapLocation;
