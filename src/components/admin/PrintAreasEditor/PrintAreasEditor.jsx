import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import { createZoneId, preventOverlap, SHAPE_TYPES, renderShapeSVG, loadCustomShape } from '../../../utils/shapeUtils';
import { pointsToPath, pathToPoints, addPointToPath, removePointFromPath, findClosestPointOnSegment } from '../../../utils/pathUtils';
import ShapeSelector from '../ShapeSelector/ShapeSelector';
import Button from '../../common/Button';
import styles from './PrintAreasEditor.module.css';

// Componente para renderizar la forma de la zona (maneja formas personalizadas)
const ZoneShapeRenderer = ({ zone, isSelected, onPointClick, onPointRightClick, onEdgeClick }) => {
  const [customSvgPath, setCustomSvgPath] = useState(null);
  const [pathPoints, setPathPoints] = useState([]);

  useEffect(() => {
    if (zone.shape === SHAPE_TYPES.CUSTOM && zone.customShapeId) {
      loadCustomShape(zone.customShapeId).then(path => {
        if (path) setCustomSvgPath(path);
      });
    } else {
      setCustomSvgPath(null);
    }
  }, [zone.shape, zone.customShapeId]);

  // Parsear puntos del path si tiene freeDrawPath
  useEffect(() => {
    if (zone.freeDrawPath) {
      const points = pathToPoints(zone.freeDrawPath);
      setPathPoints(points);
    } else {
      setPathPoints([]);
    }
  }, [zone.freeDrawPath]);

  // Si tiene freeDrawPath, usarlo directamente
  const pathData = zone.freeDrawPath
    ? zone.freeDrawPath
    : zone.shape === SHAPE_TYPES.CUSTOM && customSvgPath
      ? customSvgPath
      : renderShapeSVG(zone.shape, 100, 100, zone.customShapeId, customSvgPath);

  // Obtener puntos del path para zonas con freeDrawPath
  const getPathPointsForZone = () => {
    if (!zone.freeDrawPath || !isSelected) return [];
    return pathPoints;
  };

  const points = getPathPointsForZone();

  return (
    <svg
      className={styles.zoneShape}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'visible'
      }}
    >
      <path
        d={pathData}
        fill="rgba(180, 23, 30, 0.15)"
        stroke="var(--rojo-principal, #b4171e)"
        strokeWidth="2"
        strokeDasharray={isSelected ? "0" : "8 4"}
        vectorEffect="non-scaling-stroke"
        onMouseDown={(e) => {
          if (onEdgeClick && zone.freeDrawPath && e.altKey) {
            e.stopPropagation();
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const svg = e.currentTarget.ownerSVGElement;
            if (!svg) return;
            const point = svg.createSVGPoint();
            point.x = e.clientX - rect.left;
            point.y = e.clientY - rect.top;
            const viewBox = svg.viewBox.baseVal;
            const x = (point.x / rect.width) * viewBox.width;
            const y = (point.y / rect.height) * viewBox.height;
            onEdgeClick(x, y);
          }
        }}
      />

      {/* Renderizar puntos si la zona está seleccionada y tiene freeDrawPath */}
      {isSelected && zone.freeDrawPath && points.length > 0 && points.map((point, index) => (
        <g key={index}>
          <circle
            cx={point.x}
            cy={point.y}
            r="2"
            fill="var(--rojo-principal, #b4171e)"
            stroke="#fff"
            strokeWidth="1"
            style={{ cursor: 'pointer' }}
            onMouseDown={(e) => {
              if (onPointClick) {
                e.stopPropagation();
                if (e.altKey) {
                  e.preventDefault();
                  onPointClick(index, true, e);
                }
                // Click normal sin Alt: no hacer nada (solo seleccionar la zona)
              }
            }}
            onContextMenu={(e) => {
              if (onPointRightClick) {
                e.preventDefault();
                e.stopPropagation();
                onPointRightClick(index);
              }
            }}
          />
        </g>
      ))}
    </svg>
  );
};

const PrintAreasEditor = ({
  imageUrl,
  printAreas = [],
  onChange,
  onSaveAndClose,
  controlsTargetId = null,
  hideControls = false
}) => {
  const instanceId = useRef(Math.random().toString(36).substr(2, 9)).current;
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const [targetElement, setTargetElement] = useState(null);

  useEffect(() => {
    if (controlsTargetId) {
      const el = document.getElementById(controlsTargetId);
      setTargetElement(el);
    } else {
      setTargetElement(null);
    }
  }, [controlsTargetId]);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [, setResizeHandle] = useState(null);
  const [showShapeSelector, setShowShapeSelector] = useState(false);
  const [zones, setZones] = useState(printAreas || []);
  const [rotation, setRotation] = useState({}); // { zoneId: angle }
  const [skew, setSkew] = useState({}); // { zoneId: { skewX, skewY } }
  const [history, setHistory] = useState([]); // Historial para undo
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [, setIsDuplicating] = useState(false);
  const [freeDrawMode, setFreeDrawMode] = useState(false); // Modo creación libre
  const [freeDrawPoints, setFreeDrawPoints] = useState([]); // Puntos del dibujo libre
  const [mousePos, setMousePos] = useState(null); // Seguir ratón para previsualización
  const [, setIsDrawingFree] = useState(false);
  const [editingPointIndex, setEditingPointIndex] = useState(null); // Índice del punto que se está editando
  const [editingZoneId, setEditingZoneId] = useState(null); // ID de la zona que se está editando
  const [isMouseOver, setIsMouseOver] = useState(false);

  // Efecto para detectar si una zona está siendo arrastrada HACIA este lienzo desde afuera
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'isDraggingZone' && e.newValue) {
        // Alguien está arrastrando afuera, este lienzo debe estar listo para recibir
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Guardar estado en historial
  const saveToHistory = (newZones, newRotation, newSkew) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      zones: JSON.parse(JSON.stringify(newZones)),
      rotation: JSON.parse(JSON.stringify(newRotation)),
      skew: JSON.parse(JSON.stringify(newSkew))
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setZones(prevState.zones);
      setRotation(prevState.rotation);
      setSkew(prevState.skew);
      setHistoryIndex(historyIndex - 1);
      if (onChange) {
        onChange(prevState.zones);
      }
    }
  };

  // Redo
  const handleRedo = () => {
    if (historyIndex >= 0 && historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setZones(nextState.zones);
      setRotation(nextState.rotation);
      setSkew(nextState.skew);
      setHistoryIndex(historyIndex + 1);
      if (onChange) {
        onChange(nextState.zones);
      }
    }
  };

  useEffect(() => {
    setZones(printAreas || []);
    // Inicializar rotación y skew desde printAreas si existen
    const initialRotation = {};
    const initialSkew = {};
    (printAreas || []).forEach(zone => {
      if (zone.rotation !== undefined) initialRotation[zone.id] = zone.rotation;
      if (zone.skewX !== undefined || zone.skewY !== undefined) {
        initialSkew[zone.id] = { skewX: zone.skewX || 0, skewY: zone.skewY || 0 };
      }
    });
    setRotation(initialRotation);
    setSkew(initialSkew);
    // Inicializar historial
    if (history.length === 0) {
      setHistory([{ zones: printAreas || [], rotation: initialRotation, skew: initialSkew }]);
      setHistoryIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from prop only when printAreas reference changes
  }, [printAreas]);

  const removeZone = (zoneId) => {
    const updatedZones = zones.filter(z => z.id !== zoneId);
    const updatedRotation = { ...rotation };
    const updatedSkew = { ...skew };
    delete updatedRotation[zoneId];
    delete updatedSkew[zoneId];
    setZones(updatedZones);
    setRotation(updatedRotation);
    setSkew(updatedSkew);
    if (selectedZoneId === zoneId) {
      setSelectedZoneId(null);
    }
    saveToHistory(updatedZones, updatedRotation, updatedSkew);
    if (onChange) {
      onChange(updatedZones);
    }
  };

  const handleUndoRef = useRef(handleUndo);
  const handleRedoRef = useRef(handleRedo);
  const removeZoneRef = useRef(removeZone);
  const zonesRef = useRef(zones);
  const selectedZoneIdRef = useRef(selectedZoneId);
  const rotationRef = useRef(rotation);
  const skewRef = useRef(skew);
  const isMouseOverRef = useRef(isMouseOver);

  handleUndoRef.current = handleUndo;
  handleRedoRef.current = handleRedo;
  removeZoneRef.current = removeZone;
  zonesRef.current = zones;
  selectedZoneIdRef.current = selectedZoneId;
  rotationRef.current = rotation;
  skewRef.current = skew;
  isMouseOverRef.current = isMouseOver;

  // Listener para teclas: Ctrl+Z, Ctrl+Shift+Z/Ctrl+Y, Suprimir/Backspace, Ctrl+C/V
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Solo actuar si el ratón está sobre este editor o hay una zona seleccionada
      // Para pegar, prioritariamente usamos el que tiene el ratón encima
      const isV = e.key.toLowerCase() === 'v';
      const isC = e.key.toLowerCase() === 'c';

      if (isV && !isMouseOverRef.current) return; // Solo pegar donde está el ratón
      if (isC && !selectedZoneIdRef.current) return; // Solo copiar si hay selección local

      const target = e.target;
      const isEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if (isEditable) return;

      // Ctrl+Z para undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndoRef.current();
        return;
      }

      // Ctrl+Shift+Z o Ctrl+Y para redo
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        handleRedoRef.current();
        return;
      }

      // Suprimir/Backspace para eliminar zona seleccionada
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedZoneIdRef.current && zonesRef.current.length > 0) {
          e.preventDefault();
          removeZoneRef.current(selectedZoneIdRef.current);
        }
        return;
      }

      // Copiar (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && isC && selectedZoneIdRef.current) {
        const zoneToCopy = zonesRef.current.find(z => z.id === selectedZoneIdRef.current);
        if (zoneToCopy) {
          const toCopyRaw = { ...zoneToCopy };
          if (rotationRef.current[selectedZoneIdRef.current] !== undefined) {
            toCopyRaw.rotation = rotationRef.current[selectedZoneIdRef.current];
          }
          if (skewRef.current[selectedZoneIdRef.current] !== undefined) {
            toCopyRaw.skew = skewRef.current[selectedZoneIdRef.current];
          }
          localStorage.setItem('copiedZone', JSON.stringify(toCopyRaw));
        }
        return;
      }

      // Pegar (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && isV) {
        const copiedRaw = localStorage.getItem('copiedZone');
        if (copiedRaw) {
          try {
            const copied = JSON.parse(copiedRaw);
            const newZone = {
              ...copied,
              id: createZoneId(),
              x: Math.max(0, Math.min(100 - (copied.width || 0), copied.x + 5)),
              y: Math.max(0, Math.min(100 - (copied.height || 0), copied.y + 5))
            };
            const updatedZones = [...zonesRef.current, newZone];
            setZones(updatedZones);
            setSelectedZoneId(newZone.id);
            if (copied.rotation !== undefined) setRotation(prev => ({ ...prev, [newZone.id]: copied.rotation }));
            if (copied.skew) setSkew(prev => ({ ...prev, [newZone.id]: copied.skew }));
            saveToHistory(updatedZones,
              { ...rotationRef.current, [newZone.id]: copied.rotation || 0 },
              { ...skewRef.current, [newZone.id]: copied.skew || { skewX: 0, skewY: 0 } }
            );
            if (onChange) onChange(updatedZones);
          } catch (err) {
            console.error('Error pasting zone:', err);
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveToHistory, onChange]);

  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;

    const updateSize = () => {
      if (imageRef.current && imageRef.current.offsetWidth > 0) {
        setImageSize({ width: imageRef.current.offsetWidth, height: imageRef.current.offsetHeight });
      }
    };

    // Si ya estaba cargada, actualizar ahora
    if (img.complete && img.offsetWidth > 0) {
      updateSize();
    }

    // ResizeObserver: detecta cuando el contenedor cambia de tamaño
    // (incluyendo cuando pasa de height:0/oculto a visible)
    const ro = new ResizeObserver(() => {
      updateSize();
    });
    ro.observe(img);

    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [imageUrl]);

  const handleImageLoad = () => {
    const img = imageRef.current;
    if (img) {
      setImageSize({ width: img.offsetWidth, height: img.offsetHeight });
    }
  };


  const getZoneStyle = (zone) => {
    if (imageSize.width === 0 || imageSize.height === 0) return {};
    const zoneRotation = rotation[zone.id] !== undefined ? rotation[zone.id] : (zone.rotation || 0);
    const zoneSkew = skew[zone.id] || { skewX: zone.skewX || 0, skewY: zone.skewY || 0 };

    const transforms = [];
    if (zoneRotation !== 0) {
      transforms.push(`rotate(${zoneRotation}deg)`);
    }
    if (zoneSkew.skewX !== 0 || zoneSkew.skewY !== 0) {
      transforms.push(`skew(${zoneSkew.skewX}deg, ${zoneSkew.skewY}deg)`);
    }

    return {
      left: `${zone.x}%`,
      top: `${zone.y}%`,
      width: `${zone.width}%`,
      height: `${zone.height}%`,
      transform: transforms.length > 0 ? transforms.join(' ') : 'none',
      transformOrigin: 'center center'
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

  const updateZone = (zoneId, updates, saveHistory = false) => {
    const updatedZones = zones.map(z => {
      if (z.id === zoneId) {
        const updated = { ...z, ...updates };
        // Sincronizar rotation y skew con el estado local
        let newRotation = rotation;
        let newSkew = skew;
        if (updates.rotation !== undefined) {
          newRotation = { ...rotation, [zoneId]: updates.rotation };
          setRotation(newRotation);
        }
        if (updates.skewX !== undefined || updates.skewY !== undefined) {
          newSkew = {
            ...skew,
            [zoneId]: {
              skewX: updates.skewX !== undefined ? updates.skewX : (skew[zoneId]?.skewX || z.skewX || 0),
              skewY: updates.skewY !== undefined ? updates.skewY : (skew[zoneId]?.skewY || z.skewY || 0)
            }
          };
          setSkew(newSkew);
        }
        if (saveHistory) {
          saveToHistory(updatedZones, newRotation, newSkew);
        }
        return updated;
      }
      return z;
    });
    setZones(updatedZones);
    if (onChange) {
      onChange(updatedZones);
    }
  };

  const addZone = (shapeType, customShapeId = null, x = null, y = null, freeDrawPath = null) => {
    if (shapeType === 'free-create') {
      // Activar modo de creación libre
      setFreeDrawMode(true);
      setFreeDrawPoints([]);
      setIsDrawingFree(false);
      return;
    }

    const newZone = {
      id: createZoneId(),
      shape: shapeType || SHAPE_TYPES.RECTANGLE,
      x: x !== null ? x : 30,
      y: y !== null ? y : 30,
      width: 40,
      height: 40
    };

    if (shapeType === SHAPE_TYPES.CUSTOM && customShapeId) {
      newZone.customShapeId = customShapeId;
    }

    // Si hay un path de dibujo libre, crear zona personalizada
    if (freeDrawPath) {
      newZone.shape = SHAPE_TYPES.CUSTOM;
      newZone.freeDrawPath = freeDrawPath; // Guardar el path directamente
      // Calcular bounding box del path para establecer x, y, width, height
      const pathBounds = getPathBounds(freeDrawPath);
      newZone.x = pathBounds.x;
      newZone.y = pathBounds.y;
      newZone.width = pathBounds.width;
      newZone.height = pathBounds.height;
    }

    // Añadir directamente la zona sin buscar overlap, 
    // lo cual estaba fallando si imageSize.width venía en 0 o similar.
    const updatedZones = [...zones, newZone];
    setZones(updatedZones);
    setSelectedZoneId(newZone.id);
    saveToHistory(updatedZones, rotation, skew);
    if (onChange) {
      onChange(updatedZones);
    }

    // Limpiar modo de dibujo libre
    setFreeDrawMode(false);
    setFreeDrawPoints([]);
  };

  // Calcular bounding box de un path SVG
  const getPathBounds = (pathString) => {
    // Parsear el path para encontrar min/max x e y
    const commands = pathString.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let currentX = 0, currentY = 0;

    commands.forEach(cmd => {
      const type = cmd[0];
      const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

      if (type === 'M' || type === 'm' || type === 'L' || type === 'l' || type === 'C' || type === 'c') {
        if (coords.length >= 2) {
          const x = type === type.toUpperCase() ? coords[0] : currentX + coords[0];
          const y = type === type.toUpperCase() ? coords[1] : currentY + coords[1];
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          currentX = x;
          currentY = y;
        }
        if (coords.length >= 6 && (type === 'C' || type === 'c')) {
          // Para curvas, también considerar los puntos de control
          const x = type === 'C' ? coords[4] : currentX + coords[4];
          const y = type === 'C' ? coords[5] : currentY + coords[5];
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          currentX = x;
          currentY = y;
        }
      }
    });

    const padding = 2; // Padding adicional
    return {
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      width: Math.min(100, maxX - minX + padding * 2),
      height: Math.min(100, maxY - minY + padding * 2)
    };
  };

  // Finalizar dibujo libre
  const finishFreeDraw = () => {
    if (freeDrawPoints.length < 2) {
      alert('Necesitas al menos 2 puntos para crear una zona');
      setFreeDrawMode(false);
      setFreeDrawPoints([]);
      return;
    }

    // 1. Calcular el cuadro delimitador (bounding box) real de los puntos dibujados
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    freeDrawPoints.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });

    // Añadir un pequeño margen (padding) para que los puntos no queden pegados al borde del cuadro
    const padding = 1.5;
    const zoneX = Math.max(0, minX - padding);
    const zoneY = Math.max(0, minY - padding);
    const zoneW = Math.min(100 - zoneX, (maxX - minX) + (padding * 2));
    const zoneH = Math.min(100 - zoneY, (maxY - minY) + (padding * 2));

    // 2. Normalizar los puntos para que sean relativos al cuadro (0-100)
    // Esto es crucial para que al renderizarse en el SVG del ZoneShapeRenderer
    // (que usa viewBox 0 0 100 100) coincidan exactamente con la posición en la imagen.
    const normalizedPoints = freeDrawPoints.map(p => ({
      ...p,
      x: ((p.x - zoneX) / zoneW) * 100,
      y: ((p.y - zoneY) / zoneH) * 100
    }));

    // 3. Crear el path SVG cerrado
    const pathString = pointsToPath(normalizedPoints, true);

    if (!pathString || pathString.trim() === '') {
      alert('Error al crear el path. Intenta de nuevo.');
      return;
    }

    // 4. Crear la zona con los datos normalizados
    const newZone = {
      id: createZoneId(),
      shape: SHAPE_TYPES.CUSTOM,
      freeDrawPath: pathString,
      x: zoneX,
      y: zoneY,
      width: zoneW,
      height: zoneH,
      rotation: 0,
      skewX: 0,
      skewY: 0
    };

    // Añadir directamente la zona
    const updatedZones = [...zones, newZone];
    setZones(updatedZones);
    setSelectedZoneId(newZone.id);
    saveToHistory(updatedZones, rotation, skew);
    if (onChange) {
      onChange(updatedZones);
    }

    // Limpiar modo de dibujo libre
    setFreeDrawMode(false);
    setFreeDrawPoints([]);
    setIsDrawingFree(false);
    setMousePos(null);
  };

  // Cancelar dibujo libre
  const cancelFreeDraw = () => {
    setFreeDrawMode(false);
    setFreeDrawPoints([]);
    setIsDrawingFree(false);
  };

  // Manejar click en punto de zona personalizada
  const handlePointClick = (zoneId, pointIndex, isAltKey, event) => {
    if (!event) return;

    if (isAltKey) {
      // Alt+click: iniciar deformación del punto
      event.preventDefault();
      event.stopPropagation();
      setEditingPointIndex(pointIndex);
      setEditingZoneId(zoneId);
      const zone = zones.find(z => z.id === zoneId);
      if (zone && zone.freeDrawPath) {
        const points = pathToPoints(zone.freeDrawPath);
        if (points[pointIndex]) {
          // Obtener posición inicial del punto en coordenadas de la imagen
          const point = getPercentFromEvent(event);
          if (point) {
            setDragStart({
              type: 'editPoint',
              zoneId,
              pointIndex,
              initialPoints: JSON.parse(JSON.stringify(points)),
              startX: point.x,
              startY: point.y,
              initialPointX: points[pointIndex].x,
              initialPointY: points[pointIndex].y
            });
            setIsDragging(true);
            setSelectedZoneId(zoneId);
          }
        }
      }
    }
    // Si no es Alt+click, no hacer nada (solo seleccionar la zona)
  };

  // Manejar click derecho en punto
  const handlePointRightClick = (zoneId, pointIndex) => {
    const zone = zones.find(z => z.id === zoneId);
    if (zone && zone.freeDrawPath) {
      const points = pathToPoints(zone.freeDrawPath);
      if (points.length > 2) {
        const updatedPoints = removePointFromPath(points, pointIndex);
        const pathString = pointsToPath(updatedPoints, true);
        updateZone(zoneId, { freeDrawPath: pathString }, true);
      }
    }
  };

  // Manejar click en borde de zona personalizada (Alt+click para añadir punto)
  const handleEdgeClick = (zoneId, x, y) => {
    const zone = zones.find(z => z.id === zoneId);
    if (zone && zone.freeDrawPath) {
      const points = pathToPoints(zone.freeDrawPath);
      if (points.length === 0) return;

      // Encontrar el segmento más cercano
      let closestSegment = null;
      let minDistance = Infinity;
      let segmentIndex = 0;

      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const result = findClosestPointOnSegment(x, y, p1, p2);

        if (result.distance < minDistance) {
          minDistance = result.distance;
          closestSegment = result.point;
          segmentIndex = i;
        }
      }

      if (minDistance < 8 && closestSegment) {
        const updatedPoints = addPointToPath(points, segmentIndex, closestSegment.x, closestSegment.y);
        const pathString = pointsToPath(updatedPoints, true);
        updateZone(zoneId, { freeDrawPath: pathString }, true);
      }
    }
  };

  const handleMouseDown = (e, zoneId = null, handle = null) => {
    if (!imageRef.current || imageSize.width === 0) return;
    const point = getPercentFromEvent(e);
    if (!point) return;

    if (handle === 'rotate') {
      // Rotar
      const zone = zones.find(z => z.id === zoneId);
      if (zone) {
        // Calcular centro de la zona en porcentajes
        const centerX = zone.x + zone.width / 2;
        const centerY = zone.y + zone.height / 2;

        // Calcular ángulo inicial desde el centro hasta el punto de inicio
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        const startAngle = Math.atan2(dy, dx) * (180 / Math.PI);

        setDragStart({
          type: 'rotate',
          zoneId,
          startAngle: startAngle,
          initialRotation: rotation[zoneId] || zone.rotation || 0
        });
        setIsDragging(true);
        setSelectedZoneId(zoneId);
      }
    } else if (handle) {
      // Redimensionar - detectar Shift para mantener aspect ratio
      const zone = zones.find(z => z.id === zoneId);
      if (zone) {
        setResizeHandle(handle);
        setDragStart({
          type: 'resize',
          zoneId,
          handle,
          startX: point.x,
          startY: point.y,
          zoneX: zone.x,
          zoneY: zone.y,
          zoneWidth: zone.width,
          zoneHeight: zone.height,
          allowDeform: !e.shiftKey, // Si Shift está presionado, mantener aspect ratio
          initialAspectRatio: zone.width / zone.height
        });
        setIsDragging(true);
        setSelectedZoneId(zoneId);
      }
    } else if (zoneId) {
      // Mover zona existente o duplicar con Alt
      const zone = zones.find(z => z.id === zoneId);
      if (zone) {
        if (e.altKey) {
          // Duplicar zona
          setIsDuplicating(true);
          const duplicatedZone = {
            ...zone,
            id: createZoneId(),
            x: zone.x + 5, // Desplazar ligeramente
            y: zone.y + 5
          };
          const updatedZones = [...zones, duplicatedZone];
          setZones(updatedZones);
          setSelectedZoneId(duplicatedZone.id);
          saveToHistory(updatedZones, rotation, skew);
          if (onChange) {
            onChange(updatedZones);
          }
          setDragStart({
            type: 'move',
            zoneId: duplicatedZone.id,
            offsetX: point.x - duplicatedZone.x,
            offsetY: point.y - duplicatedZone.y
          });
          setIsDragging(true);
        } else {
          // Mover zona existente
          setDragStart({
            type: 'move',
            zoneId,
            offsetX: point.x - zone.x,
            offsetY: point.y - zone.y
          });
          setIsDragging(true);
          setSelectedZoneId(zoneId);
        }
      }
    } else {
      if (freeDrawMode) {
        // Modo creación libre: agregar punto al dibujo (ya se maneja en imageOverlay)
        // No hacer nada aquí para evitar duplicados
        return;
      } else {
        // Crear nueva zona directamente (rectángulo por defecto)
        const newZone = {
          id: createZoneId(),
          shape: SHAPE_TYPES.RECTANGLE,
          x: Math.max(0, Math.min(100 - 40, point.x - 20)),
          y: Math.max(0, Math.min(100 - 40, point.y - 20)),
          width: 40,
          height: 40
        };
        const updatedZones = [...zones, newZone];
        setZones(updatedZones);
        setSelectedZoneId(newZone.id);
        saveToHistory(updatedZones, rotation, skew);
        if (onChange) {
          onChange(updatedZones);
        }
        // Iniciar movimiento inmediatamente
        setDragStart({
          type: 'move',
          zoneId: newZone.id,
          offsetX: point.x - newZone.x,
          offsetY: point.y - newZone.y
        });
        setIsDragging(true);
      }
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStart || !imageRef.current || imageSize.width === 0) return;
    const point = getPercentFromEvent(e);
    if (!point) return;

    // Actualizar allowDeform basado en Shift key durante el movimiento
    if (dragStart.type === 'resize' && dragStart.allowDeform !== !e.shiftKey) {
      setDragStart({ ...dragStart, allowDeform: !e.shiftKey });
    }

    if (dragStart.type === 'rotate') {
      const zone = zones.find(z => z.id === dragStart.zoneId);
      if (!zone) return;

      // Calcular centro de la zona en porcentajes
      const centerX = zone.x + zone.width / 2;
      const centerY = zone.y + zone.height / 2;

      // Calcular ángulo desde el centro hasta el punto actual
      const dx = point.x - centerX;
      const dy = point.y - centerY;
      const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);

      // Calcular diferencia de ángulo
      const deltaAngle = currentAngle - dragStart.startAngle;
      const newRotation = dragStart.initialRotation + deltaAngle;

      // Normalizar ángulo a -180 a 180
      let normalizedRotation = newRotation;
      while (normalizedRotation > 180) normalizedRotation -= 360;
      while (normalizedRotation < -180) normalizedRotation += 360;

      setRotation(prev => ({ ...prev, [dragStart.zoneId]: normalizedRotation }));
      updateZone(dragStart.zoneId, { rotation: normalizedRotation }, false); // No guardar historial durante el arrastre
    } else if (dragStart.type === 'move') {
      const zone = zones.find(z => z.id === dragStart.zoneId);
      if (!zone) return;

      let newX = point.x - dragStart.offsetX;
      let newY = point.y - dragStart.offsetY;

      // DETECTAR SI NOS SALIMOS DEL LIENZO (Transferencia Inter-Lienzo)
      // Si el ratón se sale de los bordes 0-100, notificamos globalmente para que el otro lienzo lo capture
      const outOfBoundsX = point.x < -5 || point.x > 105;
      const outOfBoundsY = point.y < -5 || point.y > 105;

      if (outOfBoundsX || outOfBoundsY) {
        const zoneToTransfer = zones.find(z => z.id === dragStart.zoneId);
        if (zoneToTransfer) {
          const transferData = {
            ...zoneToTransfer,
            rotation: rotation[dragStart.zoneId] || zoneToTransfer.rotation || 0,
            skew: skew[dragStart.zoneId] || { skewX: 0, skewY: 0 },
            dragRelX: dragStart.offsetX,
            dragRelY: dragStart.offsetY,
            sourceInstanceId: instanceId // Para evitar pegarse en sí mismo
          };
          localStorage.setItem('transferringZone', JSON.stringify(transferData));

          // Eliminar del lienzo actual (se está "yendo")
          const updatedZones = zones.filter(z => z.id !== dragStart.zoneId);
          setZones(updatedZones);
          if (onChange) onChange(updatedZones);

          setIsDragging(false);
          setDragStart(null);
          return;
        }
      }

      // Mantener dentro de los límites locales si no hay transferencia
      newX = Math.max(0, Math.min(100 - zone.width, newX));
      newY = Math.max(0, Math.min(100 - zone.height, newY));

      const updatedZone = { ...zone, x: newX, y: newY };
      const otherZones = zones.filter(z => z.id !== dragStart.zoneId);
      const adjustedZone = preventOverlap(updatedZone, otherZones, imageSize.width, imageSize.height);
      updateZone(dragStart.zoneId, adjustedZone, false); // No guardar historial durante el arrastre
    } else if (dragStart.type === 'resize') {
      const zone = zones.find(z => z.id === dragStart.zoneId);
      if (!zone) return;

      let newWidth = dragStart.zoneWidth;
      let newHeight = dragStart.zoneHeight;
      let newX = dragStart.zoneX;
      let newY = dragStart.zoneY;

      const deltaX = point.x - dragStart.startX;
      const deltaY = point.y - dragStart.startY;

      switch (dragStart.handle) {
        case 'nw':
          newWidth = Math.max(5, dragStart.zoneWidth - deltaX);
          newHeight = Math.max(5, dragStart.zoneHeight - deltaY);
          newX = Math.max(0, dragStart.zoneX + deltaX);
          newY = Math.max(0, dragStart.zoneY + deltaY);
          break;
        case 'ne':
          newWidth = Math.max(5, dragStart.zoneWidth + deltaX);
          newHeight = Math.max(5, dragStart.zoneHeight - deltaY);
          newY = Math.max(0, dragStart.zoneY + deltaY);
          break;
        case 'sw':
          newWidth = Math.max(5, dragStart.zoneWidth - deltaX);
          newHeight = Math.max(5, dragStart.zoneHeight + deltaY);
          newX = Math.max(0, dragStart.zoneX + deltaX);
          break;
        case 'se':
          newWidth = Math.max(5, dragStart.zoneWidth + deltaX);
          newHeight = Math.max(5, dragStart.zoneHeight + deltaY);
          break;
        case 'n':
          // Borde superior - solo altura
          newHeight = Math.max(5, dragStart.zoneHeight - deltaY);
          newY = Math.max(0, dragStart.zoneY + deltaY);
          break;
        case 's':
          // Borde inferior - solo altura
          newHeight = Math.max(5, dragStart.zoneHeight + deltaY);
          break;
        case 'w':
          // Borde izquierdo - solo ancho
          newWidth = Math.max(5, dragStart.zoneWidth - deltaX);
          newX = Math.max(0, dragStart.zoneX + deltaX);
          break;
        case 'e':
          // Borde derecho - solo ancho
          newWidth = Math.max(5, dragStart.zoneWidth + deltaX);
          break;
        default:
          break;
      }

      // Asegurar que no se salga de los límites
      if (newX + newWidth > 100) newWidth = 100 - newX;
      if (newY + newHeight > 100) newHeight = 100 - newY;

      // Si Shift está presionado o es círculo/cuadrado, mantener aspect ratio
      const shouldMaintainAspectRatio = !dragStart.allowDeform ||
        zone.shape === SHAPE_TYPES.CIRCLE ||
        zone.shape === SHAPE_TYPES.SQUARE;

      if (shouldMaintainAspectRatio) {
        // Mantener aspect ratio inicial
        const aspectRatio = dragStart.initialAspectRatio || (zone.width / zone.height);
        const avgSize = (newWidth + newHeight) / 2;
        newWidth = avgSize * aspectRatio;
        newHeight = avgSize / aspectRatio;

        // Ajustar posición si es necesario para mantener dentro de límites
        if (newX + newWidth > 100) {
          newWidth = 100 - newX;
          newHeight = newWidth / aspectRatio;
        }
        if (newY + newHeight > 100) {
          newHeight = 100 - newY;
          newWidth = newHeight * aspectRatio;
        }
      }

      updateZone(dragStart.zoneId, { x: newX, y: newY, width: newWidth, height: newHeight }, false); // No guardar historial durante el arrastre
    } else if (dragStart.type === 'editPoint') {
      // Editar punto de zona personalizada
      const zone = zones.find(z => z.id === dragStart.zoneId);
      if (zone && zone.freeDrawPath) {
        const points = [...dragStart.initialPoints];

        // Convertir coordenadas porcentuales de la imagen a coordenadas relativas dentro de la zona (0-100)
        // point.x y point.y están en porcentajes de la imagen completa
        // Necesitamos convertirlos a porcentajes relativos dentro de la zona
        const pointX = ((point.x - zone.x) / zone.width) * 100;
        const pointY = ((point.y - zone.y) / zone.height) * 100;

        if (points[dragStart.pointIndex]) {
          points[dragStart.pointIndex] = {
            ...points[dragStart.pointIndex],
            x: Math.max(0, Math.min(100, pointX)),
            y: Math.max(0, Math.min(100, pointY))
          };
          const pathString = pointsToPath(points, true);
          updateZone(dragStart.zoneId, { freeDrawPath: pathString }, false);
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      // Guardar en historial al finalizar el arrastre
      saveToHistory(zones, rotation, skew);
    }
    setIsDragging(false);
    setDragStart(null);
    setResizeHandle(null);
    setIsDuplicating(false);
    setEditingPointIndex(null);
    setEditingZoneId(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers are stable; avoid re-subscribing on every move
  }, [isDragging, dragStart, zones, imageSize]);

  // Capturar transferencia desde otro lienzo
  useEffect(() => {
    const checkTransfer = (e) => {
      // Si muevo el ratón y hay algo en transferencia que no es de este lienzo...
      const raw = localStorage.getItem('transferringZone');
      if (raw) {
        try {
          const data = JSON.parse(raw);
          if (data.sourceInstanceId !== instanceId) {
            const rect = imageRef.current?.getBoundingClientRect();
            if (!rect) return;

            // Si el ratón entró en mi área
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
              e.clientY >= rect.top && e.clientY <= rect.bottom) {

              const point = getPercentFromEvent(e);
              const newZone = {
                ...data,
                id: createZoneId(),
                x: point.x - (data.dragRelX || 20),
                y: point.y - (data.dragRelY || 20)
              };

              const updatedZones = [...zones, newZone];
              setZones(updatedZones);
              setSelectedZoneId(newZone.id);
              if (data.rotation !== undefined) setRotation(r => ({ ...r, [newZone.id]: data.rotation }));
              if (data.skew) setSkew(s => ({ ...s, [newZone.id]: data.skew }));

              // Limpiar transferencia y tomar el control del drag
              localStorage.removeItem('transferringZone');
              setDragStart({
                type: 'move',
                zoneId: newZone.id,
                offsetX: data.dragRelX || 20,
                offsetY: data.dragRelY || 20
              });
              setIsDragging(true);
              if (onChange) onChange(updatedZones);
            }
          }
        } catch (err) { /* ignore */ }
      }
    };

    if (!isDragging) {
      window.addEventListener('mousemove', checkTransfer);
      return () => window.removeEventListener('mousemove', checkTransfer);
    }
  }, [isDragging, zones, imageUrl, onChange]);

  const selectedZone = zones.find(z => z.id === selectedZoneId);

  const toolbarContent = (
    <div className={`${styles.toolbar} ${targetElement ? styles.toolbarVertical : ''}`}>
      <Button
        type="button"
        variant="primary"
        size="small"
        onClick={() => setShowShapeSelector(true)}
      >
        + Añadir Zona
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="small"
        onClick={handleUndo}
        disabled={historyIndex <= 0}
        title="Deshacer (Ctrl+Z)"
      >
        ↩ Deshacer
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="small"
        onClick={handleRedo}
        disabled={historyIndex < 0 || historyIndex >= history.length - 1}
        title="Rehacer (Ctrl+Shift+Z)"
      >
        ↪ Rehacer
      </Button>
      {zones.length > 0 && (
        <Button
          type="button"
          variant="secondary"
          size="small"
          onClick={() => {
            if (selectedZoneId) {
              removeZone(selectedZoneId);
            } else if (zones.length > 0) {
              removeZone(zones[0].id);
            }
          }}
          disabled={zones.length === 0}
          title="Eliminar zona (Suprimir)"
        >
          Eliminar Zona {selectedZoneId ? 'Seleccionada' : '(Primera)'}
        </Button>
      )}
      {!targetElement && (
        <span className={styles.toolbarHint}>
          Ctrl+Z deshacer · Ctrl+Shift+Z rehacer · Alt+arrastrar duplicar · Suprimir eliminar
        </span>
      )}
      <div className={styles.saveActions}>
        <Button
          type="button"
          variant="primary"
          size="small"
          onClick={() => {
            const toPersist = zones.map(z => ({
              ...z,
              rotation: rotation[z.id] !== undefined ? rotation[z.id] : (z.rotation ?? 0),
              skewX: skew[z.id]?.skewX !== undefined ? skew[z.id].skewX : (z.skewX ?? 0),
              skewY: skew[z.id]?.skewY !== undefined ? skew[z.id].skewY : (z.skewY ?? 0)
            }));
            if (onChange) onChange(toPersist);
          }}
          title="Guardar las zonas definidas"
        >
          Guardar
        </Button>
        {onSaveAndClose && (
          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={() => {
              const toPersist = zones.map(z => ({
                ...z,
                rotation: rotation[z.id] !== undefined ? rotation[z.id] : (z.rotation ?? 0),
                skewX: skew[z.id]?.skewX !== undefined ? skew[z.id].skewX : (z.skewX ?? 0),
                skewY: skew[z.id]?.skewY !== undefined ? skew[z.id].skewY : (z.skewY ?? 0)
              }));
              if (onChange) onChange(toPersist);
              setTimeout(() => onSaveAndClose(), 0);
            }}
            title="Guardar y cerrar el editor de zonas"
          >
            Guardar y cerrar
          </Button>
        )}
      </div>
    </div>
  );

  const controlsContent = selectedZone ? (
    <div className={styles.controls}>
      <h4 className={styles.controlsTitle}>Editar Zona Seleccionada</h4>
      <div className={styles.controlRow}>
        <label>Forma:</label>
        <select
          value={selectedZone.shape}
          onChange={(e) => {
            const updates = { shape: e.target.value };
            if (e.target.value !== SHAPE_TYPES.CUSTOM) {
              updates.customShapeId = null;
            }
            updateZone(selectedZoneId, updates);
          }}
          className={styles.select}
        >
          <option value={SHAPE_TYPES.RECTANGLE}>Rectángulo</option>
          <option value={SHAPE_TYPES.SQUARE}>Cuadrado</option>
          <option value={SHAPE_TYPES.CIRCLE}>Círculo</option>
          <option value={SHAPE_TYPES.ELLIPSE}>Elipse</option>
          <option value={SHAPE_TYPES.HEART}>Corazón</option>
          <option value={SHAPE_TYPES.CUSTOM}>Personalizada</option>
        </select>
      </div>
      <div className={styles.controlGrid}>
        <div className={styles.controlGroup}>
          <label>X (%):</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={selectedZone.x.toFixed(1)}
            onChange={(e) => updateZone(selectedZoneId, { x: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
            className={styles.input}
          />
        </div>
        <div className={styles.controlGroup}>
          <label>Y (%):</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={selectedZone.y.toFixed(1)}
            onChange={(e) => updateZone(selectedZoneId, { y: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
            className={styles.input}
          />
        </div>
        <div className={styles.controlGroup}>
          <label>Ancho (%):</label>
          <input
            type="number"
            min={5}
            max={100}
            step={0.1}
            value={selectedZone.width.toFixed(1)}
            onChange={(e) => {
              const newWidth = Math.max(5, Math.min(100, parseFloat(e.target.value) || 5));
              const newX = Math.min(selectedZone.x, 100 - newWidth);
              updateZone(selectedZoneId, { width: newWidth, x: newX });
            }}
            className={styles.input}
          />
        </div>
        <div className={styles.controlGroup}>
          <label>Alto (%):</label>
          <input
            type="number"
            min={5}
            max={100}
            step={0.1}
            value={selectedZone.height.toFixed(1)}
            onChange={(e) => {
              const newHeight = Math.max(5, Math.min(100, parseFloat(e.target.value) || 5));
              const newY = Math.min(selectedZone.y, 100 - newHeight);
              updateZone(selectedZoneId, { height: newHeight, y: newY });
            }}
            className={styles.input}
          />
        </div>
        <div className={styles.controlGroup}>
          <label>Rotación (°):</label>
          <input
            type="number"
            min={-180}
            max={180}
            step={1}
            value={Math.round((rotation[selectedZoneId] || selectedZone.rotation || 0))}
            onChange={(e) => {
              const newRotation = parseFloat(e.target.value) || 0;
              setRotation(prev => ({ ...prev, [selectedZoneId]: newRotation }));
              updateZone(selectedZoneId, { rotation: newRotation });
            }}
            className={styles.input}
          />
        </div>
        <div className={styles.controlGroup}>
          <label>Deformación X (°):</label>
          <input
            type="number"
            min={-45}
            max={45}
            step={1}
            value={Math.round((skew[selectedZoneId]?.skewX || selectedZone.skewX || 0))}
            onChange={(e) => {
              const newSkewX = parseFloat(e.target.value) || 0;
              const currentSkew = skew[selectedZoneId] || { skewX: selectedZone.skewX || 0, skewY: selectedZone.skewY || 0 };
              setSkew(prev => ({ ...prev, [selectedZoneId]: { ...currentSkew, skewX: newSkewX } }));
              updateZone(selectedZoneId, { skewX: newSkewX });
            }}
            className={styles.input}
          />
        </div>
        <div className={styles.controlGroup}>
          <label>Deformación Y (°):</label>
          <input
            type="number"
            min={-45}
            max={45}
            step={1}
            value={Math.round((skew[selectedZoneId]?.skewY || selectedZone.skewY || 0))}
            onChange={(e) => {
              const newSkewY = parseFloat(e.target.value) || 0;
              const currentSkew = skew[selectedZoneId] || { skewX: selectedZone.skewX || 0, skewY: selectedZone.skewY || 0 };
              setSkew(prev => ({ ...prev, [selectedZoneId]: { ...currentSkew, skewY: newSkewY } }));
              updateZone(selectedZoneId, { skewY: newSkewY });
            }}
            className={styles.input}
          />
        </div>
      </div>
    </div>
  ) : null;

  const infoContent = (
    <div className={styles.info}>
      <p className={styles.hint}>
        {zones.length === 0
          ? 'Haz clic en "Añadir Zona" para crear una zona de personalización, o haz clic directamente en la imagen.'
          : `Hay ${zones.length} zona${zones.length !== 1 ? 's' : ''} definida${zones.length !== 1 ? 's' : ''}. Cada zona es una capa donde puedes agregar diseños, letras, fotos, etc. Haz clic en una zona para seleccionarla y editarla.`}
      </p>
    </div>
  );

  if (hideControls) {
    return (
      <div
        className={styles.container}
        ref={containerRef}
        onMouseEnter={() => setIsMouseOver(true)}
        onMouseLeave={() => setIsMouseOver(false)}
      >
        <div className={styles.imageWrapper}>
          <img
            ref={imageRef}
            src={toDirectImageUrl(imageUrl)}
            alt="Vista del producto"
            onLoad={handleImageLoad}
            className={styles.image}
          />
          {zones.map((zone) => {
            const isSelected = zone.id === selectedZoneId;
            const zoneStyle = getZoneStyle(zone);
            return (
              <div
                key={zone.id}
                className={`${styles.zone} ${isSelected ? styles.zoneSelected : ''}`}
                style={zoneStyle}
                onMouseDown={(e) => handleMouseDown(e, zone.id)}
              >
                <ZoneShapeRenderer
                  zone={zone}
                  isSelected={isSelected}
                  onPointClick={(pointIndex, isAltKey) => handlePointClick(zone.id, pointIndex, isAltKey)}
                  onPointRightClick={(pointIndex) => handlePointRightClick(zone.id, pointIndex)}
                  onEdgeClick={(x, y) => handleEdgeClick(zone.id, x, y)}
                />
                {isSelected && (
                  <>
                    <div className={styles.resizeHandle} style={{ top: 0, left: 0 }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'nw')} />
                    <div className={styles.resizeHandle} style={{ top: 0, right: 0 }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'ne')} />
                    <div className={styles.resizeHandle} style={{ bottom: 0, left: 0 }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'sw')} />
                    <div className={styles.resizeHandle} style={{ bottom: 0, right: 0 }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'se')} />
                    <div className={styles.resizeHandle} style={{ top: 0, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'n')} />
                    <div className={styles.resizeHandle} style={{ bottom: 0, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => handleMouseDown(e, zone.id, 's')} />
                    <div className={styles.resizeHandle} style={{ top: '50%', left: 0, transform: 'translateY(-50%)' }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'w')} />
                    <div className={styles.resizeHandle} style={{ top: '50%', right: 0, transform: 'translateY(-50%)' }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'e')} />
                    <div className={styles.rotateHandle} style={{ top: '-30px', left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'rotate')} />
                  </>
                )}
                <div className={styles.zoneLabel}>
                  {zone.shape === SHAPE_TYPES.RECTANGLE ? 'Rectángulo' :
                    zone.shape === SHAPE_TYPES.SQUARE ? 'Cuadrado' :
                      zone.shape === SHAPE_TYPES.CIRCLE ? 'Círculo' :
                        zone.shape === SHAPE_TYPES.ELLIPSE ? 'Elipse' :
                          zone.shape === SHAPE_TYPES.HEART ? 'Corazón' : 'Zona'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.container}
      ref={containerRef}
      onMouseEnter={() => setIsMouseOver(true)}
      onMouseLeave={() => setIsMouseOver(false)}
    >
      {targetElement ? createPortal(
        <div className={styles.sidebarContent}>
          {toolbarContent}
          {controlsContent}
          {infoContent}
        </div>,
        targetElement
      ) : (
        toolbarContent
      )}

      {showShapeSelector && (
        <ShapeSelector
          onSelect={addZone}
          onClose={() => setShowShapeSelector(false)}
        />
      )}

      {/* Overlay de creación libre */}
      {freeDrawMode && (
        <div className={styles.freeDrawOverlay}>
          <div className={styles.freeDrawToolbar}>
            <p className={styles.freeDrawHint}>
              Dibuja la forma directamente sobre la imagen. Haz doble click o presiona "Finalizar" para terminar.
            </p>
            <div className={styles.freeDrawActions}>
              <Button variant="secondary" size="small" onClick={cancelFreeDraw}>
                Cancelar
              </Button>
              <Button variant="primary" size="small" onClick={finishFreeDraw} disabled={freeDrawPoints.length < 2}>
                Finalizar ({freeDrawPoints.length} puntos)
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.imageWrapper}>
        <img
          ref={imageRef}
          src={toDirectImageUrl(imageUrl)}
          alt="Vista del producto"
          onLoad={handleImageLoad}
          className={styles.image}
        />

        {zones.map((zone) => {
          const isSelected = zone.id === selectedZoneId;
          const zoneStyle = getZoneStyle(zone);

          return (
            <div
              key={zone.id}
              className={`${styles.zone} ${isSelected ? styles.zoneSelected : ''}`}
              style={zoneStyle}
              onMouseDown={(e) => handleMouseDown(e, zone.id)}
            >
              <ZoneShapeRenderer
                zone={zone}
                isSelected={isSelected}
                onPointClick={(pointIndex, isAltKey) => handlePointClick(zone.id, pointIndex, isAltKey)}
                onPointRightClick={(pointIndex) => handlePointRightClick(zone.id, pointIndex)}
                onEdgeClick={(x, y) => handleEdgeClick(zone.id, x, y)}
              />

              {isSelected && (
                <>
                  {/* Handles de esquinas */}
                  <div className={styles.resizeHandle} style={{ top: 0, left: 0 }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'nw')} />
                  <div className={styles.resizeHandle} style={{ top: 0, right: 0 }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'ne')} />
                  <div className={styles.resizeHandle} style={{ bottom: 0, left: 0 }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'sw')} />
                  <div className={styles.resizeHandle} style={{ bottom: 0, right: 0 }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'se')} />
                  {/* Handles de bordes */}
                  <div className={styles.resizeHandle} style={{ top: 0, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'n')} />
                  <div className={styles.resizeHandle} style={{ bottom: 0, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => handleMouseDown(e, zone.id, 's')} />
                  <div className={styles.resizeHandle} style={{ top: '50%', left: 0, transform: 'translateY(-50%)' }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'w')} />
                  <div className={styles.resizeHandle} style={{ top: '50%', right: 0, transform: 'translateY(-50%)' }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'e')} />
                  {/* Handle de rotación */}
                  <div className={styles.rotateHandle} style={{ top: '-30px', left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => handleMouseDown(e, zone.id, 'rotate')} />
                </>
              )}

              <div className={styles.zoneLabel}>
                {zone.shape === SHAPE_TYPES.RECTANGLE ? 'Rectángulo' :
                  zone.shape === SHAPE_TYPES.SQUARE ? 'Cuadrado' :
                    zone.shape === SHAPE_TYPES.CIRCLE ? 'Círculo' :
                      zone.shape === SHAPE_TYPES.ELLIPSE ? 'Elipse' :
                        zone.shape === SHAPE_TYPES.HEART ? 'Corazón' : 'Zona'}
              </div>
            </div>
          );
        })}

        {/* Path del dibujo libre */}
        {freeDrawMode && freeDrawPoints.length > 0 && (
          <svg
            className={styles.freeDrawPath}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 102
            }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path
              d={pointsToPath(freeDrawPoints, false)}
              fill="none"
              stroke="var(--rojo-principal, #b4171e)"
              strokeWidth="0.3"
              strokeDasharray="2 2"
            />
            {mousePos && (
              <line
                x1={freeDrawPoints[freeDrawPoints.length - 1].x}
                y1={freeDrawPoints[freeDrawPoints.length - 1].y}
                x2={mousePos.x}
                y2={mousePos.y}
                stroke="var(--rojo-principal, #b4171e)"
                strokeWidth="0.3"
                strokeDasharray="1 1"
              />
            )}
            {freeDrawPoints.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={index === 0 ? "1.5" : "0.5"}
                fill={index === 0 ? "var(--verde-exito, #28a745)" : "var(--rojo-principal, #b4171e)"}
                style={{
                  cursor: index === 0 ? 'pointer' : 'default',
                  pointerEvents: index === 0 ? 'auto' : 'none'
                }}
                onMouseDown={(e) => {
                  if (freeDrawMode && index === 0 && freeDrawPoints.length > 2) {
                    e.preventDefault();
                    e.stopPropagation();
                    finishFreeDraw();
                  }
                }}
              />
            ))}
          </svg>
        )}

        <div
          className={`${styles.imageOverlay} ${freeDrawMode ? styles.freeDrawMode : ''}`}
          onMouseMove={(e) => {
            if (freeDrawMode && freeDrawPoints.length > 0) {
              const point = getPercentFromEvent(e);
              if (point) setMousePos(point);
            }
          }}
          onMouseDown={(e) => {
            if (!freeDrawMode) {
              handleMouseDown(e);
            } else {
              // En modo creación libre, solo agregar puntos, no crear zonas
              const point = getPercentFromEvent(e);
              if (point) {
                if (freeDrawPoints.length > 2) {
                  const firstPt = freeDrawPoints[0];
                  const dist = Math.hypot(firstPt.x - point.x, firstPt.y - point.y);
                  if (dist < 3) {
                    finishFreeDraw();
                    return;
                  }
                }
                const newPoint = {
                  x: point.x,
                  y: point.y,
                  type: 'corner'
                };
                setFreeDrawPoints([...freeDrawPoints, newPoint]);
                setIsDrawingFree(true);
              }
            }
          }}
          onDoubleClick={(e) => {
            if (freeDrawMode) {
              e.preventDefault();
              e.stopPropagation();
              finishFreeDraw();
            }
          }}
        />
      </div>

      {!targetElement && (
        <>
          {controlsContent}
          {infoContent}
        </>
      )}
    </div>
  );
};

export default PrintAreasEditor;
