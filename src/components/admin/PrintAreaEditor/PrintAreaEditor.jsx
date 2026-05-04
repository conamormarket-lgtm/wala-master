import React, { useRef, useState, useEffect } from 'react';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import styles from './PrintAreaEditor.module.css';

const PrintAreaEditor = ({ imageUrl, printArea, onChange }) => {
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [currentArea, setCurrentArea] = useState(printArea || { x: 10, y: 10, width: 80, height: 80 });

  useEffect(() => {
    if (imageRef.current && imageRef.current.complete) {
      const updateSize = () => {
        const img = imageRef.current;
        if (img) {
          setImageSize({ width: img.offsetWidth, height: img.offsetHeight });
        }
      };
      updateSize();
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, [imageUrl]);

  const handleImageLoad = () => {
    const img = imageRef.current;
    if (img) {
      setImageSize({ width: img.offsetWidth, height: img.offsetHeight });
    }
  };

  const getAreaStyle = () => {
    if (imageSize.width === 0 || imageSize.height === 0) return {};
    return {
      left: `${currentArea.x}%`,
      top: `${currentArea.y}%`,
      width: `${currentArea.width}%`,
      height: `${currentArea.height}%`
    };
  };

  const getPercentFromEvent = (e) => {
    if (!imageRef.current || imageSize.width === 0) return null;
    const rect = imageRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    };
  };

  const handleMouseDown = (e) => {
    if (!imageRef.current || imageSize.width === 0) return;
    const point = getPercentFromEvent(e);
    if (!point) return;
    
    // Verificar si el clic está dentro del área actual (para mover)
    const areaLeft = currentArea.x;
    const areaTop = currentArea.y;
    const areaRight = areaLeft + currentArea.width;
    const areaBottom = areaTop + currentArea.height;
    
    if (point.x >= areaLeft && point.x <= areaRight && point.y >= areaTop && point.y <= areaBottom) {
      // Mover el área
      setDragStart({ 
        type: 'move',
        offsetX: point.x - areaLeft,
        offsetY: point.y - areaTop
      });
    } else {
      // Crear nueva área desde este punto
      setDragStart({ 
        type: 'create',
        startX: point.x,
        startY: point.y
      });
    }
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStart || !imageRef.current || imageSize.width === 0) return;
    const point = getPercentFromEvent(e);
    if (!point) return;
    
    let newArea;
    
    if (dragStart.type === 'move') {
      // Mover el área manteniendo su tamaño
      newArea = {
        x: Math.max(0, Math.min(100 - currentArea.width, point.x - dragStart.offsetX)),
        y: Math.max(0, Math.min(100 - currentArea.height, point.y - dragStart.offsetY)),
        width: currentArea.width,
        height: currentArea.height
      };
    } else {
      // Crear/redimensionar área
      const x = Math.min(dragStart.startX, point.x);
      const y = Math.min(dragStart.startY, point.y);
      const width = Math.abs(point.x - dragStart.startX);
      const height = Math.abs(point.y - dragStart.startY);
      
      const minWidth = Math.max(5, width);
      const minHeight = Math.max(5, height);
      
      newArea = {
        x: Math.max(0, Math.min(100 - minWidth, x)),
        y: Math.max(0, Math.min(100 - minHeight, y)),
        width: Math.min(100 - x, minWidth),
        height: Math.min(100 - y, minHeight)
      };
    }
    
    setCurrentArea(newArea);
    if (onChange) onChange(newArea);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  useEffect(() => {
    if (isDragging) {
      const moveHandler = (e) => handleMouseMove(e);
      const upHandler = () => handleMouseUp();
      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', upHandler);
      return () => {
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
      };
    }
    // handleMouseMove/handleMouseUp are stable refs; deps intentionally minimal to avoid re-subscribing on every move
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, dragStart, currentArea, imageSize]);

  useEffect(() => {
    if (printArea) {
      setCurrentArea(printArea);
    }
  }, [printArea]);

  if (!imageUrl) {
    return <div className={styles.placeholder}>Sube una imagen para definir el área personalizable</div>;
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.imageWrapper}>
        <img
          ref={imageRef}
          src={toDirectImageUrl(imageUrl)}
          alt="Vista del producto"
          onLoad={handleImageLoad}
          className={styles.image}
        />
        <div
          className={styles.area}
          style={getAreaStyle()}
          onMouseDown={(e) => {
            e.stopPropagation();
            const point = getPercentFromEvent(e);
            if (point) {
              setDragStart({ 
                type: 'move',
                offsetX: point.x - currentArea.x,
                offsetY: point.y - currentArea.y
              });
              setIsDragging(true);
            }
          }}
        >
          <div className={styles.areaLabel}>
            Área personalizable
          </div>
        </div>
        <div
          className={styles.imageOverlay}
          onMouseDown={handleMouseDown}
        />
      </div>
      <div className={styles.info}>
        <p className={styles.hint}>
          Arrastra sobre la imagen para definir el área donde los clientes podrán personalizar.
        </p>
        <div className={styles.values}>
          <span>X: {currentArea.x.toFixed(1)}%</span>
          <span>Y: {currentArea.y.toFixed(1)}%</span>
          <span>Ancho: {currentArea.width.toFixed(1)}%</span>
          <span>Alto: {currentArea.height.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};

export default PrintAreaEditor;
