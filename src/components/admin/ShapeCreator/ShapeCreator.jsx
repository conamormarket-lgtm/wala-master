import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createCustomShape } from '../../../services/customShapes';
import { pointsToPath, pathToPoints, addPointToPath, removePointFromPath, convertPointType, findClosestPointOnSegment, simplifyPath } from '../../../utils/pathUtils';
import Button from '../../common/Button/Button';
import styles from './ShapeCreator.module.css';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const ShapeCreator = ({ onSave, onClose, initialPath = null, initialName = '' }) => {
  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [selectedHandle, setSelectedHandle] = useState(null); // 'in' | 'out' | null
  const [isClosed, setIsClosed] = useState(false);
  const [mode, setMode] = useState('pen'); // 'pen' | 'select' | 'add' | 'delete'
  const [isDrawing, setIsDrawing] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [shapeName, setShapeName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState([]); // Historial para undo
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Guardar estado en historial
  const saveToHistory = (newPoints, newIsClosed) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      points: JSON.parse(JSON.stringify(newPoints)),
      isClosed: newIsClosed
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setPoints(prevState.points);
      setIsClosed(prevState.isClosed);
      setHistoryIndex(historyIndex - 1);
    }
  };

  // Inicializar desde path existente si se proporciona
  useEffect(() => {
    if (initialPath) {
      const parsedPoints = pathToPoints(initialPath);
      setPoints(parsedPoints);
      setIsClosed(initialPath.includes('Z') || initialPath.includes('z'));
      // Inicializar historial
      setHistory([{ points: parsedPoints, isClosed: initialPath.includes('Z') || initialPath.includes('z') }]);
      setHistoryIndex(0);
    } else {
      // Inicializar historial vacío
      setHistory([{ points: [], isClosed: false }]);
      setHistoryIndex(0);
    }
  }, [initialPath]);

  // Obtener coordenadas del mouse en el SVG
  const getSVGPoint = useCallback((e) => {
    if (!svgRef.current) return null;
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const point = svg.createSVGPoint();
    point.x = e.clientX - rect.left;
    point.y = e.clientY - rect.top;
    return point;
  }, []);

  // Manejar click en el lienzo
  const handleCanvasClick = (e) => {
    const point = getSVGPoint(e);
    if (!point) return;

    if (mode === 'pen') {
      // Crear nuevo punto
      const newPoint = {
        x: point.x,
        y: point.y,
        type: 'corner'
      };
      
      const updatedPoints = points.length === 0 ? [newPoint] : [...points, newPoint];
      setPoints(updatedPoints);
      saveToHistory(updatedPoints, isClosed);
    } else if (mode === 'add') {
      // Añadir punto en el segmento más cercano
      let closestSegment = null;
      let minDistance = Infinity;
      let segmentIndex = 0;

      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const result = findClosestPointOnSegment(point.x, point.y, p1, p2);
        
        if (result.distance < minDistance) {
          minDistance = result.distance;
          closestSegment = result.point;
          segmentIndex = i;
        }
      }

      if (minDistance < 20) {
        const newPoint = {
          x: closestSegment.x,
          y: closestSegment.y,
          type: 'corner'
        };
        const updatedPoints = addPointToPath(points, segmentIndex, newPoint.x, newPoint.y);
        setPoints(updatedPoints);
        saveToHistory(updatedPoints, isClosed);
      }
    } else if (mode === 'delete') {
      // Eliminar punto más cercano
      let closestIndex = -1;
      let minDistance = Infinity;

      points.forEach((p, i) => {
        const distance = Math.sqrt((point.x - p.x) ** 2 + (point.y - p.y) ** 2);
        if (distance < minDistance && distance < 15) {
          minDistance = distance;
          closestIndex = i;
        }
      });

      if (closestIndex >= 0) {
        const updatedPoints = removePointFromPath(points, closestIndex);
        setPoints(updatedPoints);
        if (selectedPointIndex === closestIndex) {
          setSelectedPointIndex(null);
        }
        saveToHistory(updatedPoints, isClosed);
      }
    }
  };

  // Manejar drag de punto
  const handlePointMouseDown = (e, index) => {
    e.stopPropagation();
    setSelectedPointIndex(index);
    setIsDrawing(true);
  };

  // Manejar drag de handle
  const handleHandleMouseDown = (e, pointIndex, handleType) => {
    e.stopPropagation();
    setSelectedPointIndex(pointIndex);
    setSelectedHandle(handleType);
    setIsDrawing(true);
  };

  // Manejar movimiento del mouse
  useEffect(() => {
    if (!isDrawing) return;

    const handleMouseMove = (e) => {
      const point = getSVGPoint(e);
      if (!point) return;

      if (selectedHandle && selectedPointIndex !== null) {
        // Mover handle
        const updatedPoints = [...points];
        const currentPoint = updatedPoints[selectedPointIndex];
        if (!currentPoint.handles) currentPoint.handles = {};
        if (!currentPoint.handles[selectedHandle]) {
          currentPoint.handles[selectedHandle] = { x: 0, y: 0 };
        }
        
        const handleX = point.x - currentPoint.x;
        const handleY = point.y - currentPoint.y;
        currentPoint.handles[selectedHandle] = { x: handleX, y: handleY };
        
        // Si es smooth, hacer el otro handle simétrico
        if (currentPoint.type === 'smooth') {
          const otherHandle = selectedHandle === 'in' ? 'out' : 'in';
          currentPoint.handles[otherHandle] = { x: -handleX, y: -handleY };
        }
        
        setPoints(updatedPoints);
      } else if (selectedPointIndex !== null) {
        // Mover punto
        const updatedPoints = [...points];
        updatedPoints[selectedPointIndex] = {
          ...updatedPoints[selectedPointIndex],
          x: point.x,
          y: point.y
        };
        setPoints(updatedPoints);
        // No guardar en historial durante el arrastre, solo al soltar
      }
    };

    const handleMouseUp = () => {
      if (isDrawing) {
        // Guardar en historial al finalizar el arrastre
        saveToHistory(points, isClosed);
      }
      setIsDrawing(false);
      setSelectedHandle(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isClosed/saveToHistory used inside handlers; full deps would re-run too often
  }, [isDrawing, selectedPointIndex, selectedHandle, points, getSVGPoint]);

  // Convertir tipo de punto
  const handleConvertPoint = () => {
    if (selectedPointIndex === null) return;
    const updatedPoints = [...points];
    updatedPoints[selectedPointIndex] = convertPointType(updatedPoints[selectedPointIndex]);
    setPoints(updatedPoints);
    saveToHistory(updatedPoints, isClosed);
  };

  // Cerrar path
  const handleClosePath = () => {
    setIsClosed(true);
    saveToHistory(points, true);
  };

  // Cargar imagen de fondo
  const handleImageLoad = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setBackgroundImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Escanear automáticamente
  const handleAutoScan = async () => {
    if (!backgroundImage) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.drawImage(img, 0, 0);
      
      // Convertir a escala de grises
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      // Aplicar threshold
      const threshold = 128;
      for (let i = 0; i < data.length; i += 4) {
        const value = data[i] > threshold ? 255 : 0;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      // Detectar contornos (algoritmo simplificado)
      const contours = detectContours(ctx, canvas.width, canvas.height);
      
      if (contours.length > 0) {
        // Usar el contorno más grande
        const largestContour = contours.reduce((a, b) => 
          a.length > b.length ? a : b
        );
        
        // Escalar puntos al tamaño del SVG
        const scaleX = CANVAS_WIDTH / canvas.width;
        const scaleY = CANVAS_HEIGHT / canvas.height;
        
        const scaledPoints = largestContour.map(p => ({
          x: p.x * scaleX,
          y: p.y * scaleY,
          type: 'corner'
        }));
        
        // Simplificar path
        const simplified = simplifyPath(scaledPoints, 3);
        setPoints(simplified);
        setIsClosed(true);
        saveToHistory(simplified, true);
      }
    };
    
    img.src = backgroundImage;
  };

  // Detectar contornos (algoritmo simplificado)
  const detectContours = (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const visited = new Set();
    const contours = [];
    
    const getPixel = (x, y) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return 255;
      const idx = (y * width + x) * 4;
      return data[idx];
    };
    
    const isEdge = (x, y) => {
      const pixel = getPixel(x, y);
      if (pixel === 255) return false;
      
      // Verificar si tiene un vecino blanco
      return getPixel(x - 1, y) === 255 || getPixel(x + 1, y) === 255 ||
             getPixel(x, y - 1) === 255 || getPixel(x, y + 1) === 255;
    };
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y}`;
        if (visited.has(key) || !isEdge(x, y)) continue;
        
        // Seguir el contorno
        const contour = [];
        let currentX = x;
        let currentY = y;
        const directions = [
          [1, 0], [1, 1], [0, 1], [-1, 1],
          [-1, 0], [-1, -1], [0, -1], [1, -1]
        ];
        
        do {
          contour.push({ x: currentX, y: currentY });
          visited.add(`${currentX},${currentY}`);
          
          let found = false;
          for (const [dx, dy] of directions) {
            const nx = currentX + dx;
            const ny = currentY + dy;
            const nKey = `${nx},${ny}`;
            
            if (!visited.has(nKey) && isEdge(nx, ny)) {
              currentX = nx;
              currentY = ny;
              found = true;
              break;
            }
          }
          
          if (!found) break;
        } while (contour.length < 10000 && (currentX !== x || currentY !== y));
        
        if (contour.length > 10) {
          contours.push(contour);
        }
      }
    }
    
    return contours;
  };

  // Guardar forma
  const handleSave = async () => {
    if (!shapeName.trim()) {
      alert('Por favor ingresa un nombre para la forma');
      return;
    }
    
    if (points.length < 2) {
      alert('La forma debe tener al menos 2 puntos');
      return;
    }
    
    setIsSaving(true);
    try {
      const pathString = pointsToPath(points, isClosed);
      
      if (initialPath) {
        // Actualizar forma existente (necesitaríamos el ID)
        // Por ahora, crear nueva
        const { error } = await createCustomShape({
          name: shapeName.trim(),
          svgPath: pathString
        });
        
        if (error) {
          alert('Error al guardar: ' + error);
          return;
        }
      } else {
        const { error } = await createCustomShape({
          name: shapeName.trim(),
          svgPath: pathString
        });
        
        if (error) {
          alert('Error al guardar: ' + error);
          return;
        }
      }
      
      if (onSave) {
        onSave();
      }
      if (onClose) {
        onClose();
      }
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Listener para Ctrl+Z
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleUndo is stable; avoid re-subscribing when history changes
  // eslint-disable-next-line react-hooks/exhaustive-deps -- handleUndo stable; avoid re-sub on history change
  }, [historyIndex, history]);

  const pathString = pointsToPath(points, isClosed);
  const selectedPoint = selectedPointIndex !== null ? points[selectedPointIndex] : null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Crear Forma Personalizada</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.toolbar}>
            <div className={styles.toolGroup}>
              <button
                type="button"
                className={`${styles.toolBtn} ${mode === 'pen' ? styles.active : ''}`}
                onClick={() => setMode('pen')}
                title="Pluma"
              >
                ✏️
              </button>
              <button
                type="button"
                className={`${styles.toolBtn} ${mode === 'select' ? styles.active : ''}`}
                onClick={() => setMode('select')}
                title="Seleccionar"
              >
                👆
              </button>
              <button
                type="button"
                className={`${styles.toolBtn} ${mode === 'add' ? styles.active : ''}`}
                onClick={() => setMode('add')}
                title="Añadir punto"
              >
                ➕
              </button>
              <button
                type="button"
                className={`${styles.toolBtn} ${mode === 'delete' ? styles.active : ''}`}
                onClick={() => setMode('delete')}
                title="Eliminar punto"
              >
                ➖
              </button>
            </div>
            
            <div className={styles.toolGroup}>
              <button
                type="button"
                className={styles.toolBtn}
                onClick={handleConvertPoint}
                disabled={selectedPointIndex === null}
                title="Convertir punto (smooth/corner)"
              >
                🔄
              </button>
              <button
                type="button"
                className={styles.toolBtn}
                onClick={handleClosePath}
                disabled={isClosed || points.length < 2}
                title="Cerrar path"
              >
                🔗
              </button>
            </div>
            
            <div className={styles.toolGroup}>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageLoad}
                className={styles.fileInput}
                id="image-upload"
              />
              <label htmlFor="image-upload" className={styles.toolBtn} title="Cargar imagen">
                🖼️
              </label>
              <button
                type="button"
                className={styles.toolBtn}
                onClick={handleAutoScan}
                disabled={!backgroundImage}
                title="Escanear automáticamente"
              >
                🔍
              </button>
            </div>
          </div>
          
          <div className={styles.canvasContainer}>
            <svg
              ref={svgRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className={styles.canvas}
              onClick={handleCanvasClick}
            >
              {/* Imagen de fondo */}
              {backgroundImage && (
                <image
                  href={backgroundImage}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  opacity={0.3}
                />
              )}
              
              {/* Path */}
              {points.length > 0 && (
                <path
                  d={pathString}
                  fill="rgba(180, 23, 30, 0.2)"
                  stroke="var(--rojo-principal, #b4171e)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              
              {/* Puntos y handles */}
              {points.map((point, index) => (
                <g key={index}>
                  {/* Líneas de handles */}
                  {point.handles?.in && (
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={point.x + point.handles.in.x}
                      y2={point.y + point.handles.in.y}
                      stroke="#666"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                  )}
                  {point.handles?.out && (
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={point.x + point.handles.out.x}
                      y2={point.y + point.handles.out.y}
                      stroke="#666"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                  )}
                  
                  {/* Handles */}
                  {point.handles?.in && (
                    <circle
                      cx={point.x + point.handles.in.x}
                      cy={point.y + point.handles.in.y}
                      r={6}
                      fill="#666"
                      className={styles.handle}
                      onMouseDown={(e) => handleHandleMouseDown(e, index, 'in')}
                    />
                  )}
                  {point.handles?.out && (
                    <circle
                      cx={point.x + point.handles.out.x}
                      cy={point.y + point.handles.out.y}
                      r={6}
                      fill="#666"
                      className={styles.handle}
                      onMouseDown={(e) => handleHandleMouseDown(e, index, 'out')}
                    />
                  )}
                  
                  {/* Punto */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={selectedPointIndex === index ? 8 : 6}
                    fill={selectedPointIndex === index ? '#b4171e' : '#333'}
                    stroke="#fff"
                    strokeWidth="2"
                    className={styles.point}
                    onMouseDown={(e) => handlePointMouseDown(e, index)}
                  />
                </g>
              ))}
            </svg>
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
          
          <div className={styles.controls}>
            <div className={styles.inputGroup}>
              <label>Nombre de la forma:</label>
              <input
                type="text"
                value={shapeName}
                onChange={(e) => setShapeName(e.target.value)}
                placeholder="Ej: Estrella, Flor, etc."
                className={styles.nameInput}
              />
            </div>
            
            {selectedPoint && (
              <div className={styles.pointInfo}>
                <p>Punto seleccionado: ({Math.round(selectedPoint.x)}, {Math.round(selectedPoint.y)})</p>
                <p>Tipo: {selectedPoint.type}</p>
              </div>
            )}
          </div>
        </div>
        
        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving || points.length < 2 || !shapeName.trim()}
            loading={isSaving}
          >
            Guardar Forma
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ShapeCreator;
