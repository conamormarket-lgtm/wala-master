import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fabric } from 'fabric';
import { useEditor } from '../../../contexts/EditorContext';
import { useDesignClipboard } from '../../../contexts/DesignClipboardContext';
import { EDITOR_FONTS, FONT_WEIGHT_NORMAL, FONT_WEIGHT_BOLD, FONT_STYLE_NORMAL, FONT_STYLE_ITALIC } from '../../../constants/fonts';
import { toDirectImageUrl, toCanvasImageUrl, ensureSingleImageUrl } from '../../../utils/imageUrl';
import { SHAPE_TYPES, renderShapeSVG, isPointInShape, loadCustomShape } from '../../../utils/shapeUtils';
import styles from './EditorCanvas.module.css';

const EditorCanvas = ({ productImage, printAreas = [], viewId, showZones = true, isCompact = false }) => {
  const canvasRef = useRef(null);
  // localCanvasRef: referencia propia de ESTA instancia de EditorCanvas.
  // Evita conflictos cuando hay múltiples EditorCanvas en el mismo EditorProvider.
  const localCanvasRef = useRef(null);
  // localCanvasReady: estado para disparar efectos reactivamente cuando el canvas local está listo.
  const [localCanvasReady, setLocalCanvasReady] = useState(false);
  const { canvas, setCanvas, setCanvasDimensions, layersByView, updateLayer, activeViewId, setActiveViewId, activePrintAreaId, setActivePrintAreaId, setSelectedLayer, removeLayer, selectedLayer, pushToHistory, handleUndo, handleRedo, clipboardLayers: localClipboard, setClipboardLayers: setLocalClipboard, addLayer } = useEditor();
  // Use global clipboard when available (across views), fallback to local
  const { globalClipboard, setGlobalClipboard } = useDesignClipboard();
  const clipboardLayers = globalClipboard.length > 0 ? globalClipboard : localClipboard;
  const setClipboardLayers = (layers) => { setGlobalClipboard(layers); setLocalClipboard(layers); };

  const viewIdToUse = viewId ?? activeViewId;

  // Reclamar el contexto canvas si somos la vista activa. Vital para layouts multi-canvas (montaje instantáneo)
  useEffect(() => {
    if (activeViewId === viewIdToUse && localCanvasReady && localCanvasRef.current) {
      setCanvas(localCanvasRef.current);
    }
  }, [activeViewId, viewIdToUse, localCanvasReady, setCanvas]);

  const layers = layersByView[viewIdToUse] || [];
  const layersByViewRef = useRef(layersByView);
  useEffect(() => { layersByViewRef.current = layersByView; }, [layersByView]);
  const DEFAULT_CANVAS_WIDTH = 500;
  const DEFAULT_CANVAS_HEIGHT = 600;
  const CANVAS_PADDING = 0; // Eliminado por completo para que la imagen toque los bordes del recuadro
  const [imageDimensions, setImageDimensions] = useState({
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
    totalW: DEFAULT_CANVAS_WIDTH + CANVAS_PADDING * 2,
    totalH: DEFAULT_CANVAS_HEIGHT + CANVAS_PADDING * 2,
    padding: CANVAS_PADDING
  });

  const imageDimensionsRef = useRef(imageDimensions);
  useEffect(() => {
    imageDimensionsRef.current = imageDimensions;
  }, [imageDimensions]);
  const [editingTextId, setEditingTextId] = useState(null);
  const [inlineFontSizeInput, setInlineFontSizeInput] = useState('40');
  const editingTextObjRef = useRef(null);
  const containerRef = useRef(null);
  // cssImgRef: imagen de referencia invisible con max-width:100%
  // igual que PrintAreasEditor. Usamos su offsetWidth para calcular canvasScale,
  // garantizando que ambas pestañas (Diseño y Zonas) rendericen la imagen al mismo tamaño exacto.
  const cssImgRef = useRef(null);
  const pendingActiveLayerIdRef = useRef(null);
  const lastImageSrcByLayerIdRef = useRef({});
  const loadingImageIdsRef = useRef(new Set());
  const [toolbarRect, setToolbarRect] = useState(null);
  const [canvasScale, setCanvasScale] = useState(1);
  // productImageDisplayUrl: URL directa para mostrar siempre la imagen con un <img> HTML normal.
  // Jamas usa Fabric.js para el fondo, eliminando problemas de CORS.
  const [productImageDisplayUrl, setProductImageDisplayUrl] = useState(null);

  const isCanvasValid = (c) => {
    if (!c) return false;
    try {
      const el = c.lowerCanvasEl || (typeof c.getElement === 'function' ? c.getElement() : null);
      return el && typeof document !== 'undefined' && document.contains(el);
    } catch {
      return false;
    }
  };

  const safeRenderAll = (c) => {
    if (!isCanvasValid(c)) return;
    try {
      c.renderAll();
    } catch (_) {
      /* canvas disposed or context lost (clearRect null) */
    }
  };

  const safeRequestRenderAll = (c) => {
    if (!isCanvasValid(c)) return;
    try {
      c.requestRenderAll();
    } catch (_) {
      /* canvas disposed or context lost */
    }
  };

  const updateScaleRef = useRef(null);
  const MOBILE_BREAKPOINT = 768;
  const MOBILE_CANVAS_HEIGHT = 360;
  const MOBILE_CANVAS_HEIGHT_SMALL = 300;

  const getContainerDimensions = () => {
    const el = containerRef.current;
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT;
    const padding = 16;
    if (isMobile && !isCompact) {
      const w = Math.max(el?.offsetWidth ?? 0, window.innerWidth - padding * 2);
      const h = Math.max(
        el?.offsetHeight ?? 0,
        window.innerWidth <= 480 ? MOBILE_CANVAS_HEIGHT_SMALL : MOBILE_CANVAS_HEIGHT
      );
      return { w: w || window.innerWidth - padding * 2, h: h || MOBILE_CANVAS_HEIGHT };
    }
    
    // En tarjetas compactas (1:1), si la altura no se pintó aún, usar el ancho para el aspecto cuadrado.
    const finalW = el?.offsetWidth || DEFAULT_CANVAS_WIDTH;
    const finalH = (isCompact && (!el?.offsetHeight || el.offsetHeight === 0)) ? finalW : (el?.offsetHeight || DEFAULT_CANVAS_HEIGHT);

    return {
      w: finalW,
      h: finalH
    };
  };

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !imageDimensions.width || !imageDimensions.height) return;
    const updateScale = () => {
      // Preferir cssImgRef.offsetWidth (misma lógica CSS que PrintAreasEditor)
      // para garantizar que ambas pestañas muestren la imagen al MISMO tamaño exacto.
      const cssImg = cssImgRef.current;
      let w;
      if (cssImg && cssImg.offsetWidth > 0) {
        // cssImg tiene max-width:100%
        w = cssImg.offsetWidth;
      } else {
        const dims = getContainerDimensions();
        w = dims.w;
      }

      const el = containerRef.current;
      const h = el && el.offsetHeight > 0 ? el.offsetHeight : getContainerDimensions().h;

      const scaleX = w > 0 ? w / imageDimensions.totalW : 1;
      const scaleY = h > 0 ? h / imageDimensions.totalH : 1;

      // Escala restrictiva en ambos ejes (X e Y) para encajar 100% en la pantalla orgánicamente
      const scale = Math.min(1, scaleX, scaleY);
      const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
      setCanvasScale(safeScale);
    };
    updateScaleRef.current = updateScale;
    updateScale();
    const roContainer = new ResizeObserver(updateScale);
    roContainer.observe(el);
    // Observar también la imagen de referencia CSS para detectar cambios de ancho
    const roCssImg = cssImgRef.current ? new ResizeObserver(updateScale) : null;
    if (roCssImg && cssImgRef.current) roCssImg.observe(cssImgRef.current);
    const onResize = () => updateScale();
    window.addEventListener('resize', onResize);
    return () => {
      roContainer.disconnect();
      if (roCssImg) roCssImg.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [imageDimensions.width, imageDimensions.height]);

  // En móvil el contenedor puede tener tamaño 0 en el primer paint; forzar recálculo con dimensiones de viewport
  useEffect(() => {
    const run = () => {
      if (updateScaleRef.current) updateScaleRef.current();
    };
    run();
    const t1 = setTimeout(run, 100);
    const t2 = setTimeout(run, 350);
    const t3 = setTimeout(run, 700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [imageDimensions.width, imageDimensions.height, productImage]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof document === 'undefined' || !document.contains(el)) return;
    if (typeof fabric === 'undefined' || !fabric.Canvas) {
      setCanvas(null);
      return;
    }
    let fabricCanvas = null;
    try {
      const isMobileDevice = typeof window !== 'undefined' && window.innerWidth <= 768;
      
      // Configuración global de controles de Fabric para mejor experiencia móvil vs desktop
      fabric.Object.prototype.set({
        transparentCorners: !isMobileDevice,
        cornerColor: isMobileDevice ? '#ffffff' : 'rgba(102,153,255,0.5)',
        cornerStrokeColor: isMobileDevice ? '#b4171e' : 'rgba(102,153,255,0.5)',
        borderColor: isMobileDevice ? '#b4171e' : 'rgba(102,153,255,0.75)',
        cornerSize: isMobileDevice ? 24 : 13,
        padding: isMobileDevice ? 10 : 0,
        cornerStyle: isMobileDevice ? 'circle' : 'rect',
        borderDashArray: isMobileDevice ? [4, 4] : null,
        rotatingPointOffset: isMobileDevice ? 30 : 40
      });

      const initialDims = imageDimensionsRef.current;
      fabricCanvas = new fabric.Canvas(el, {
        width: initialDims.totalW,
        height: initialDims.totalH,
        backgroundColor: 'transparent',
        selection: true,
        allowTouchScrolling: false, // Bloquea el scroll de la ventana al arrastrar dentro del canvas (evita que se descuadre la vista)
      });
      fabricCanvas.setDimensions({
        width: initialDims.totalW,
        height: initialDims.totalH
      });
      localCanvasRef.current = fabricCanvas;
      setLocalCanvasReady(true);
      setCanvas(fabricCanvas);

      // Crear zonas de personalización desde printAreas (tamaño inicial; el efecto de zonas las actualizará al cargar la imagen)
      const printAreasToRender = Array.isArray(printAreas)
        ? printAreas
        : [];

      printAreasToRender.forEach((area) => {
        const dims = imageDimensionsRef.current;
        const pa = {
          x: dims.padding + (dims.width * (area.x || 0)) / 100,
          y: dims.padding + (dims.height * (area.y || 0)) / 100,
          width: (dims.width * (area.width || 40)) / 100,
          height: (dims.height * (area.height || 40)) / 100,
        };

        const isActive = activePrintAreaId === area.id;
        const strokeColor = isActive ? 'rgba(180, 23, 30, 0.9)' : 'rgba(33, 150, 243, 0.6)';
        const strokeWidth = isActive ? 3 : 2;
        const strokeDashArray = isActive ? null : [8, 4];

        let printAreaShape;
        if (area.shape === SHAPE_TYPES.CIRCLE || area.shape === SHAPE_TYPES.SQUARE) {
          const radius = Math.min(pa.width, pa.height) / 2;
          printAreaShape = new fabric.Circle({
            left: pa.x + pa.width / 2,
            top: pa.y + pa.height / 2,
            radius: radius,
            fill: isActive ? 'rgba(180, 23, 30, 0.1)' : 'transparent',
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeDashArray: strokeDashArray,
            selectable: false,
            evented: showZones,
            hoverCursor: 'pointer',
            originX: 'center',
            originY: 'center',
            printAreaId: area.id,
            visible: showZones,
            objectCaching: false,
            strokeUniform: true
          });
        } else if (area.shape === SHAPE_TYPES.ELLIPSE) {
          printAreaShape = new fabric.Ellipse({
            left: pa.x + pa.width / 2,
            top: pa.y + pa.height / 2,
            rx: pa.width / 2,
            ry: pa.height / 2,
            fill: isActive ? 'rgba(180, 23, 30, 0.1)' : 'transparent',
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeDashArray: strokeDashArray,
            selectable: false,
            evented: showZones,
            hoverCursor: 'pointer',
            originX: 'center',
            originY: 'center',
            printAreaId: area.id,
            visible: showZones,
            objectCaching: false,
            strokeUniform: true
          });
        } else if (area.shape === SHAPE_TYPES.HEART) {
          // Para corazón, usar un path SVG
          const pathData = renderShapeSVG(SHAPE_TYPES.HEART, pa.width, pa.height);
          printAreaShape = new fabric.Path(pathData, {
            left: pa.x,
            top: pa.y,
            fill: isActive ? 'rgba(180, 23, 30, 0.1)' : 'transparent',
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeDashArray: strokeDashArray,
            selectable: false,
            evented: showZones,
            hoverCursor: 'pointer',
            scaleX: pa.width / 100,
            scaleY: pa.height / 100,
            printAreaId: area.id,
            visible: showZones,
            objectCaching: false,
            strokeUniform: true
          });
        } else if (area.shape === SHAPE_TYPES.CUSTOM && area.customShapeId) {
          // Para formas personalizadas, cargar el SVG path
          loadCustomShape(area.customShapeId).then(pathData => {
            if (pathData && fabricCanvas) {
              const customPath = new fabric.Path(pathData, {
                left: pa.x,
                top: pa.y,
                fill: isActive ? 'rgba(180, 23, 30, 0.1)' : 'transparent',
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                strokeDashArray: strokeDashArray,
                selectable: false,
                evented: showZones,
                hoverCursor: 'pointer',
                scaleX: pa.width / 100,
                scaleY: pa.height / 100,
                printAreaId: area.id,
                visible: showZones,
                objectCaching: false,
                strokeUniform: true
              });
              fabricCanvas.add(customPath);
              customPath.sendToBack();
              safeRenderAll(fabricCanvas);
            }
          });
          // Crear un rectángulo temporal mientras se carga
          printAreaShape = new fabric.Rect({
            left: pa.x,
            top: pa.y,
            width: pa.width,
            height: pa.height,
            fill: isActive ? 'rgba(180, 23, 30, 0.1)' : 'transparent',
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeDashArray: strokeDashArray,
            selectable: false,
            evented: showZones,
            hoverCursor: 'pointer',
            printAreaId: area.id,
            visible: showZones,
            objectCaching: false,
            strokeUniform: true
          });
        } else {
          // Rectángulo por defecto
          printAreaShape = new fabric.Rect({
            left: pa.x,
            top: pa.y,
            width: pa.width,
            height: pa.height,
            fill: isActive ? 'rgba(180, 23, 30, 0.1)' : 'transparent',
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeDashArray: strokeDashArray,
            selectable: false,
            evented: showZones,
            hoverCursor: 'pointer',
            printAreaId: area.id,
            visible: showZones,
            objectCaching: false,
            strokeUniform: true
          });
        }

        fabricCanvas.add(printAreaShape);
        printAreaShape.sendToBack();

        // Hacer clickeable para activar la zona
        printAreaShape.on('mousedown', (e) => {
          if (e.e && !e.e.ctrlKey && !e.e.metaKey) {
            setActivePrintAreaId(viewIdToUse, area.id);
            safeRenderAll(fabricCanvas);
          }
        });
      });

      const clampToPrintAreas = (obj) => {
        if (!obj.customId) return;
        const dims = imageDimensionsRef.current;
        const w = (obj.width || 0) * (obj.scaleX || 1);
        const h = (obj.height || 0) * (obj.scaleY || 1);
        const centerX = (obj.left ?? 0) + w / 2;
        const centerY = (obj.top ?? 0) + h / 2;

        // Verificar si el objeto está dentro de alguna zona
        let isInsideAnyZone = false;
        for (const area of printAreasToRender) {
          const pa = {
            x: (dims.padding || 0) + (dims.width * (area.x || 0)) / 100,
            y: (dims.padding || 0) + (dims.height * (area.y || 0)) / 100,
            width: (dims.width * (area.width || 40)) / 100,
            height: (dims.height * (area.height || 40)) / 100,
          };

          const areaWithCustom = {
            ...pa,
            customShapeId: area.customShapeId,
            customSvgPath: null // Se cargará cuando sea necesario
          };
          if (isPointInShape(centerX, centerY, area.shape, areaWithCustom)) {
            isInsideAnyZone = true;
            // Asegurar que el objeto completo esté dentro de la zona
            let left = obj.left ?? 0;
            let top = obj.top ?? 0;

            if (area.shape === SHAPE_TYPES.RECTANGLE || area.shape === SHAPE_TYPES.SQUARE) {
              left = Math.max(pa.x, Math.min(pa.x + pa.width - w, left));
              top = Math.max(pa.y, Math.min(pa.y + pa.height - h, top));
            } else {
              // Para formas circulares/elípticas, usar bounding box aproximado
              left = Math.max(pa.x, Math.min(pa.x + pa.width - w, left));
              top = Math.max(pa.y, Math.min(pa.y + pa.height - h, top));
            }

            obj.set({ left, top });
            break;
          }
        }

        // Si no está en ninguna zona (ej. arrastrando en el espacio intermedio), moverlo a la zona MÁS CERCANA (Efecto Magnético)
        if (!isInsideAnyZone && printAreasToRender.length > 0) {
          let nearestArea = printAreasToRender[0];
          let minDistance = Infinity;

          for (const area of printAreasToRender) {
             const paX = (dims.padding || 0) + (dims.width * (area.x || 0)) / 100;
             const paY = (dims.padding || 0) + (dims.height * (area.y || 0)) / 100;
             const paW = (dims.width * (area.width || 40)) / 100;
             const paH = (dims.height * (area.height || 40)) / 100;
             const areaCenterX = paX + paW / 2;
             const areaCenterY = paY + paH / 2;
             
             const distance = Math.sqrt(Math.pow(centerX - areaCenterX, 2) + Math.pow(centerY - areaCenterY, 2));
             if (distance < minDistance) {
               minDistance = distance;
               nearestArea = area;
             }
          }

          const pa = {
            x: (dims.padding || 0) + (dims.width * (nearestArea.x || 0)) / 100,
            y: (dims.padding || 0) + (dims.height * (nearestArea.y || 0)) / 100,
            width: (dims.width * (nearestArea.width || 40)) / 100,
            height: (dims.height * (nearestArea.height || 40)) / 100,
          };
          let left = Math.max(pa.x, Math.min(pa.x + pa.width - w, obj.left ?? pa.x));
          let top = Math.max(pa.y, Math.min(pa.y + pa.height - h, obj.top ?? pa.y));
          obj.set({ left, top });
          
          // Además, activamos la zona en la que acaba de caer magnéticamente para feedback visual
          if (activePrintAreaId !== nearestArea.id) {
            setActivePrintAreaId(viewIdToUse, nearestArea.id);
          }
        }

        obj.setCoords();
      };

      fabricCanvas.on('selection:created', (e) => {
        if (e.selected?.length > 1) setSelectedLayer(null);
        else if (e.selected?.[0]?.customId) setSelectedLayer(e.selected[0].customId);
      });
      fabricCanvas.on('selection:updated', (e) => {
        if (e.selected?.length > 1) setSelectedLayer(null);
        else if (e.selected?.[0]?.customId) setSelectedLayer(e.selected[0].customId);
      });
      fabricCanvas.on('selection:cleared', () => setSelectedLayer(null));

      fabricCanvas.on('object:modified', (e) => {
        const target = e.target;
        if (!target) return;

        pushToHistory(layersByViewRef.current);

        const saveSingleObj = (obj) => {
          if (!obj.customId) return;
          clampToPrintAreas(obj);
          const updates = {
            x: obj.left,
            y: obj.top,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            angle: obj.angle || 0,
            flipX: obj.flipX || false,
            flipY: obj.flipY || false,
            baseW: imageDimensionsRef.current.width,
            baseH: imageDimensionsRef.current.height,
          };
          if (obj.type === 'i-text' || obj.type === 'text') {
            updates.text = obj.text;
            updates.fontSize = obj.fontSize;
            updates.fontFamily = obj.fontFamily || 'Arial';
            updates.fontWeight = obj.fontWeight || FONT_WEIGHT_NORMAL;
            updates.fontStyle = obj.fontStyle || FONT_STYLE_NORMAL;
            updates.color = obj.fill;
            updates.textAlign = obj.textAlign;
          }
          updateLayer(viewIdToUse, obj.customId, updates);
        };

        if (target.type === 'activeSelection') {
          // Destrozar temporalmente la selección y forzar a Fabric a recalcular x/y
          // absolutos para cada objeto modificado en grupo
          const objs = target.getObjects();
          target.canvas.discardActiveObject();
          objs.forEach(saveSingleObj);

          // Re-empaquetar y re-seleccionar
          const sel = new fabric.ActiveSelection(objs, { canvas: target.canvas });
          target.canvas.setActiveObject(sel);
          target.canvas.requestRenderAll();
        } else {
          saveSingleObj(target);
        }
      });

      fabricCanvas.on('object:moving', (e) => {
        const target = e.target;
        const isMobileDeviceLocal = typeof window !== 'undefined' && window.innerWidth <= 768;
        const processObj = (obj) => {
          // En móvil, desactivamos clamp continuo por rendimiento. En desktop se mantiene activo.
          if (!isMobileDeviceLocal && obj.customId) clampToPrintAreas(obj);
          if (obj._tintOverlay) {
            obj._tintOverlay.set({ left: obj.left, top: obj.top });
            obj._tintOverlay.setCoords();
          }
        };

        if (target.type === 'activeSelection') {
          // Ignoramos clamping y overlays durante movimiento grupal para evitar destellos visuales.
        } else if (target) {
          processObj(target);
        }
      });

      fabricCanvas.on('object:scaling', (e) => {
        const target = e.target;
        const isMobileDeviceLocal = typeof window !== 'undefined' && window.innerWidth <= 768;
        const processObj = (obj) => {
          // En móvil, desactivamos clamp continuo por rendimiento. En desktop se mantiene activo.
          if (!isMobileDeviceLocal && obj.customId) clampToPrintAreas(obj);
          if (obj._tintOverlay) {
            const w = (obj.width || 100) * (obj.scaleX || 1);
            const h = (obj.height || 100) * (obj.scaleY || 1);
            obj._tintOverlay.set({ left: obj.left, top: obj.top, width: w, height: h, angle: obj.angle });
            obj._tintOverlay.setCoords();
          }
        };

        if (target.type === 'activeSelection') {
          // Ignorar mientras escala en grupo, similar a mover
        } else if (target) {
          processObj(target);
        }
      });

      fabricCanvas.on('object:rotating', (e) => {
        const target = e.target;
        if (target.type === 'activeSelection') return;
        if (target && target._tintOverlay) {
          target._tintOverlay.set({ left: target.left, top: target.top, angle: target.angle });
          target._tintOverlay.setCoords();
        }
      });
    } catch (err) {
      console.error('EditorCanvas: error init', err);
      setCanvas(null);
      if (fabricCanvas && typeof fabricCanvas.dispose === 'function') {
        try { fabricCanvas.dispose(); } catch (_) { }
      }
      localCanvasRef.current = null;
      setLocalCanvasReady(false);
      return;
    }

    return () => {
      if (fabricCanvas && typeof fabricCanvas.dispose === 'function') {
        try {
          fabricCanvas.dispose();
        } catch (_) { /* clearRect u otro error al desmontar */ }
      }
      setCanvas(null);
      localCanvasRef.current = null;
      setLocalCanvasReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- activePrintAreaId omitted to avoid recreating canvas on zone click; sync effect updates zone styles
  }, [viewIdToUse, printAreas, setCanvas, updateLayer, setSelectedLayer, pushToHistory, setActivePrintAreaId, showZones]);

  // Siempre mostrar la imagen de producto como <img> HTML nativo (sin CORS).
  // Fabric canvas siempre transparente, solo maneja capas interactivas.
  useEffect(() => {
    if (!productImage) {
      setProductImageDisplayUrl(null);
      const initialDims = {
        width: DEFAULT_CANVAS_WIDTH,
        height: DEFAULT_CANVAS_HEIGHT,
        totalW: DEFAULT_CANVAS_WIDTH + CANVAS_PADDING * 2,
        totalH: DEFAULT_CANVAS_HEIGHT + CANVAS_PADDING * 2,
        padding: CANVAS_PADDING
      };
      setImageDimensions(initialDims);
      setCanvasDimensions({ width: initialDims.totalW, height: initialDims.totalH });
      const lc = localCanvasRef.current;
      if (lc && isCanvasValid(lc)) {
        lc.setDimensions({ width: initialDims.totalW, height: initialDims.totalH });
        lc.setBackgroundColor('transparent', () => { safeRenderAll(localCanvasRef.current); });
        // Forzar renderizado de zonas con tamaño inicial (usar ref actual por si hubo unmount)
        setTimeout(() => {
          const c = localCanvasRef.current;
          if (c && isCanvasValid(c)) updateZonesAndLayers(c);
        }, 50);
      }
      return;
    }

    const displayUrl = (() => {
      const single = ensureSingleImageUrl(productImage);
      if (!single) return null;
      return toDirectImageUrl(single) || single;
    })();
    if (!displayUrl) {
      setProductImageDisplayUrl(null);
      const initialDims = {
        width: DEFAULT_CANVAS_WIDTH,
        height: DEFAULT_CANVAS_HEIGHT,
        totalW: DEFAULT_CANVAS_WIDTH + CANVAS_PADDING * 2,
        totalH: DEFAULT_CANVAS_HEIGHT + CANVAS_PADDING * 2,
        padding: CANVAS_PADDING
      };
      setImageDimensions(initialDims);
      setCanvasDimensions({ width: initialDims.totalW, height: initialDims.totalH });

      // Registrar dimensiones globalmente
      window.__FABRIC_CANVAS_DIMS = window.__FABRIC_CANVAS_DIMS || {};
      window.__FABRIC_CANVAS_DIMS[viewIdToUse] = { width: initialDims.width, height: initialDims.height };

      const lc = localCanvasRef.current;
      if (lc && isCanvasValid(lc)) {
        lc.setDimensions({ width: initialDims.totalW, height: initialDims.totalH });
        lc.setBackgroundColor('transparent', () => { safeRenderAll(localCanvasRef.current); });
        setTimeout(() => {
          const c = localCanvasRef.current;
          if (c && isCanvasValid(c)) updateZonesAndLayers(c);
        }, 50);
      }
      return;
    }
    setProductImageDisplayUrl(displayUrl);

    // Cargar imagen en elemento oculto solo para obtener dimensiones naturales.
    // USAR `displayUrl` EXACTAMENTE. Si usamos `toCanvasImageUrl` (uc?export=view), Google Drive
    // puede bloquearlo por CORS o escaneo de virus, causando que se aplique 500x600 y rompa todo.
    // Además, esto garantiza que las dimensiones naturales sean 100% idénticas a PrintAreasEditor.
    let cancelled = false;
    const measurer = document.createElement('img');

    measurer.onload = () => {
      if (cancelled) return;
      const w = measurer.naturalWidth || DEFAULT_CANVAS_WIDTH;
      const h = measurer.naturalHeight || DEFAULT_CANVAS_HEIGHT;
      // Añadimos un margen para que los bordes de las zonas no se corten
      const padding = CANVAS_PADDING;
      const totalW = w + padding * 2;
      const totalH = h + padding * 2;

      setImageDimensions({ width: w, height: h, totalW, totalH, padding });
      setCanvasDimensions({ width: totalW, height: totalH });

      // Registrar dimensiones globalmente
      window.__FABRIC_CANVAS_DIMS = window.__FABRIC_CANVAS_DIMS || {};
      window.__FABRIC_CANVAS_DIMS[viewIdToUse] = { width: w, height: h };

      const lc = localCanvasRef.current;
      if (lc && isCanvasValid(lc)) {
        lc.setDimensions({ width: totalW, height: totalH });
        lc.setBackgroundColor('transparent', () => { safeRenderAll(localCanvasRef.current); });
        setTimeout(() => {
          const c = localCanvasRef.current;
          if (c && isCanvasValid(c)) updateZonesAndLayers(c);
        }, 50);
      }
    };
    measurer.onerror = () => {
      if (cancelled) return;
      const initialDims = {
        width: DEFAULT_CANVAS_WIDTH,
        height: DEFAULT_CANVAS_HEIGHT,
        totalW: DEFAULT_CANVAS_WIDTH + CANVAS_PADDING * 2,
        totalH: DEFAULT_CANVAS_HEIGHT + CANVAS_PADDING * 2,
        padding: CANVAS_PADDING
      };
      setImageDimensions(initialDims);
      setCanvasDimensions({ width: initialDims.totalW, height: initialDims.totalH });

      // Registrar dimensiones globalmente
      window.__FABRIC_CANVAS_DIMS = window.__FABRIC_CANVAS_DIMS || {};
      window.__FABRIC_CANVAS_DIMS[viewIdToUse] = { width: initialDims.width, height: initialDims.height };

      const lc = localCanvasRef.current;
      if (lc && isCanvasValid(lc)) {
        lc.setDimensions({ width: initialDims.totalW, height: initialDims.totalH });
        lc.setBackgroundColor('transparent', () => { safeRenderAll(localCanvasRef.current); });
        setTimeout(() => {
          const c = localCanvasRef.current;
          if (c && isCanvasValid(c)) updateZonesAndLayers(c);
        }, 50);
      }
    };
    measurer.src = displayUrl;

    return () => { cancelled = true; };
  }, [localCanvasReady, productImage, setCanvasDimensions]);

  useEffect(() => {
    const lc = localCanvasRef.current;
    if (!lc || !isCanvasValid(lc) || !selectedLayer) return;
    const obj = lc.getObjects().find(o => o.customId === selectedLayer);
    if (obj && lc.getActiveObject() !== obj) {
      lc.setActiveObject(obj);
      safeRequestRenderAll(lc);
    }
  }, [canvas, selectedLayer, layers]);

  useEffect(() => {
    const lc = localCanvasRef.current;
    if (!lc) return;
    const handleKeyDown = (e) => {
      // Importante: No procesar atajos si este canvas no es el foco activo en pantalla global
      if (activeViewId !== viewIdToUse) {
         return; // Si no es el canvas marcado como activo temporalmente, ignoramos enteramente el teclado
      }

      const target = e.target;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (!isInput) {
          e.preventDefault();
          lc.discardActiveObject();
          if (e.shiftKey) handleRedo();
          else handleUndo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (!isInput && lc) {
          const active = lc.getActiveObject();
          if (!active) {
            // Solo limpiamos si este es el canvas activamente enfocado para evitar que otros canvas sin foco borren el clipboard
            if (containerRef.current && containerRef.current.contains(document.activeElement)) {
              setClipboardLayers([]);
            }
            return;
          }
          e.preventDefault();
          const ids = active.type === 'activeSelection'
            ? (active.get('objects') || []).map((o) => o.customId).filter(Boolean)
            : active.customId ? [active.customId] : [];
          const layerData = ids.map((id) => layers.find((l) => l.id === id)).filter(Boolean);
          const cloned = layerData.map((layer) => {
            const copy = JSON.parse(JSON.stringify(layer));
            delete copy.id;
            return copy;
          });
          setClipboardLayers(cloned);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (!isInput && lc && clipboardLayers.length > 0) {
          e.preventDefault();
          let lastId = null;
          
          let activeArea;
          if (activePrintAreaId && Array.isArray(printAreas)) {
             activeArea = printAreas.find(a => a.id === activePrintAreaId);
          }

          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          clipboardLayers.forEach(l => {
              const lx = l.x ?? 0;
              const ly = l.y ?? 0;
              if (lx < minX) minX = lx;
              if (ly < minY) minY = ly;
              if (lx > maxX) maxX = lx;
              if (ly > maxY) maxY = ly;
          });
          const groupCenterX = minX + (maxX - minX) / 2;
          const groupCenterY = minY + (maxY - minY) / 2;

          let deltaX = 15;
          let deltaY = 15;

          if (activeArea && imageDimensionsRef.current) {
             const { width, height, padding = 0 } = imageDimensionsRef.current;
             const zX = padding + (width * (activeArea.x || 0)) / 100;
             const zY = padding + (height * (activeArea.y || 0)) / 100;
             const zW = (width * (activeArea.width || 40)) / 100;
             const zH = (height * (activeArea.height || 40)) / 100;
             
             const isInside = groupCenterX >= zX && groupCenterX <= zX + zW && groupCenterY >= zY && groupCenterY <= zY + zH;
             if (!isInside) {
                 deltaX = (zX + zW / 2) - groupCenterX;
                 deltaY = (zY + zH / 2) - groupCenterY;
             }
          }

          clipboardLayers.forEach((layerData) => {
            const spawnX = (layerData.x ?? 0) + deltaX;
            const spawnY = (layerData.y ?? 0) + deltaY;

            const newId = addLayer(viewIdToUse, {
              ...layerData,
              x: spawnX,
              y: spawnY,
            });
            lastId = newId;
          });
          if (lastId) setSelectedLayer(lastId);
        }
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (!isInput && lc) {
          const active = lc.getActiveObject();
          if (active) {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            switch(e.key) {
               case 'ArrowUp': active.set('top', active.top - step); break;
               case 'ArrowDown': active.set('top', active.top + step); break;
               case 'ArrowLeft': active.set('left', active.left - step); break;
               case 'ArrowRight': active.set('left', active.left + step); break;
            }
            active.setCoords();
            lc.fire('object:modified', { target: active });
            safeRequestRenderAll(lc);
          }
        }
        return;
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (isInput) return;
      const active = lc.getActiveObject();
      if (!active) return;

      e.preventDefault();

      if (active.type === 'activeSelection') {
        const objs = active.getObjects();
        lc.discardActiveObject();
        objs.forEach(obj => {
          if (obj.customId) {
            lc.remove(obj);
            removeLayer(viewIdToUse, obj.customId);
          }
        });
      } else if (active.customId) {
        lc.remove(active);
        removeLayer(viewIdToUse, active.customId);
      }

      setSelectedLayer(null);
      safeRequestRenderAll(lc);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvas, viewIdToUse, removeLayer, setSelectedLayer, handleUndo, handleRedo, clipboardLayers, setClipboardLayers, addLayer, layers, activeViewId]);

  // Función centralizada para actualizar posiciones de zonas y capas
  const updateZonesAndLayers = (lc) => {
    if (!lc || !isCanvasValid(lc)) return;
    const { width, height, padding = 0 } = imageDimensionsRef.current;
    if (width === 0) return;

    const printAreasToRender = Array.isArray(printAreas)
      ? printAreas
      : [];

    // 1. Sincronizar Zonas (Dashed boxes)
    const existingZones = lc.getObjects().filter(obj => obj.printAreaId);
    existingZones.forEach(ez => {
      const area = printAreasToRender.find(a => a.id === ez.printAreaId);
      if (!area) {
        lc.remove(ez);
      } else {
        const pa = {
          x: padding + (width * (area.x || 0)) / 100,
          y: padding + (height * (area.y || 0)) / 100,
          width: (width * (area.width || 40)) / 100,
          height: (height * (area.height || 40)) / 100,
        };
        ez.set({
          left: (area.shape === 'circle' || area.shape === 'ellipse') ? pa.x + pa.width / 2 : pa.x,
          top: (area.shape === 'circle' || area.shape === 'ellipse') ? pa.y + pa.height / 2 : pa.y,
          width: pa.width,
          height: pa.height
        });
        if (area.shape === 'circle') ez.set({ radius: Math.min(pa.width, pa.height) / 2 });
        if (area.shape === 'ellipse') ez.set({ rx: pa.width / 2, ry: pa.height / 2 });
        ez.setCoords();
      }
    });

    safeRenderAll(lc);
  };

  useEffect(() => {
    const lc = localCanvasRef.current;
    if (!lc) return;
    const handleMouseDown = (e) => {
      // Registrar de inmediato que este producto/vista es el "Activo" en la pantalla
      if (typeof setActiveViewId === 'function' && activeViewId !== viewIdToUse) {
         setActiveViewId(viewIdToUse);
      }

      // Photoshop Alt-Drag mimic robusto para grupos multiselección e imágenes
      if (e.e?.altKey) {
        const target = e.target;
        if (!target) return;

        // Si se hizo clic teniendo un objeto/multiselección activa
        let idsToDuplicate = [];
        if (target.type === 'activeSelection' || target.type === 'group') {
          idsToDuplicate = (target.getObjects() || []).map(o => o.customId).filter(Boolean);
        } else if (target.customId) {
          idsToDuplicate = [target.customId];
        }

        if (idsToDuplicate.length === 0) return;

        const viewLayers = layersByViewRef.current[viewIdToUse] ?? [];
        idsToDuplicate.forEach(customId => {
          const layer = viewLayers.find((l) => l.id === customId);
          if (layer) {
            const duplicate = JSON.parse(JSON.stringify(layer));
            delete duplicate.id;
            
            // Usamos las coordenadas del estado React, que siempre son el origen absoluto perfecto
            duplicate.x = layer.x;
            duplicate.y = layer.y;
            
            addLayer(viewIdToUse, duplicate);
          }
        });
      }
    };
    lc.on('mouse:down', handleMouseDown);
    return () => lc.off('mouse:down', handleMouseDown);
  }, [canvas, viewIdToUse, addLayer, activeViewId, setActiveViewId]);

  // ── Cross-canvas drag ──────────────────────────────────────────────────────
  // When a layer is dragged outside this canvas, broadcast a custom DOM event
  // 'design:layer-drop' so sibling canvases can receive it.
  useEffect(() => {
    const lc = localCanvasRef.current;
    const container = containerRef.current;
    if (!lc || !container) return;

    const handleMouseUp = (fabEvt) => {
      const obj = fabEvt.target;
      if (!obj) return;
      const isGroup = obj.type === 'activeSelection';
      if (!isGroup && !obj.customId) return;

      const nativeEvt = fabEvt.e;
      if (!nativeEvt) return;

      const canvasRect = container.getBoundingClientRect();
      const cx = nativeEvt.clientX;
      const cy = nativeEvt.clientY;
      const outsideCanvas =
        cx < canvasRect.left || cx > canvasRect.right ||
        cy < canvasRect.top || cy > canvasRect.bottom;

      if (!outsideCanvas) return;

      const viewLayers = layersByViewRef.current[viewIdToUse] ?? [];
      const dropObjects = isGroup ? obj.getObjects() : [obj];
      const packagedLayers = dropObjects.map(o => viewLayers.find(l => l.id === o.customId)).filter(Boolean);

      if (packagedLayers.length === 0) return;

      const eventDetail = { 
        layers: JSON.parse(JSON.stringify(packagedLayers)), 
        dropX: cx, 
        dropY: cy, 
        sourceViewId: viewIdToUse,
        handled: false 
      };
      
      window.dispatchEvent(new CustomEvent('design:layer-drop', { detail: eventDetail }));
      
      // Si el conjunto de capas cayó efectivamente en otro Canvas (de otro producto del combo)
      if (eventDetail.handled) {
        if (isGroup) lc.discardActiveObject();
        dropObjects.forEach(child => {
           if (child.customId) {
              lc.remove(child);
              removeLayer(viewIdToUse, child.customId);
           }
        });
        lc.discardActiveObject();
        safeRequestRenderAll(lc);
      }
    };

    lc.on('mouse:up', handleMouseUp);
    return () => lc.off('mouse:up', handleMouseUp);
  }, [canvas, viewIdToUse, removeLayer]);

  // Listen for drops FROM other canvases into this one
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleExternalDrop = (evt) => {
      const detail = evt.detail ?? {};
      // Soporte retrocompatible "layer" para 1 solo item, o "layers" array para multiselections
      const isSingle = !!detail.layer;
      const inLayers = isSingle ? [detail.layer] : (detail.layers || []);
      
      const { dropX, dropY, sourceViewId } = detail;
      if (inLayers.length === 0 || sourceViewId === viewIdToUse) return;

      const canvasRect = container.getBoundingClientRect();
      const inside =
        dropX >= canvasRect.left && dropX <= canvasRect.right &&
        dropY >= canvasRect.top && dropY <= canvasRect.bottom;
      if (!inside) return;

      detail.handled = true; // Avisar al canvas anterior que hemos recibido el elemento para que lo borre

      const { padding = 0 } = imageDimensions;
      const scaleVal = canvasScale || 1;
      const relX = Math.max(0, (dropX - canvasRect.left) / scaleVal - padding);
      const relY = Math.max(0, (dropY - canvasRect.top) / scaleVal - padding);

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      inLayers.forEach(l => {
          if ((l.x ?? 0) < minX) minX = (l.x ?? 0);
          if ((l.y ?? 0) < minY) minY = (l.y ?? 0);
          if ((l.x ?? 0) > maxX) maxX = (l.x ?? 0);
          if ((l.y ?? 0) > maxY) maxY = (l.y ?? 0);
      });
      const groupCenterX = minX + (maxX - minX) / 2;
      const groupCenterY = minY + (maxY - minY) / 2;

      // Desplazamiento desde el centro lógico del grupo hacia su nueva coordenada de click del ratón (relX, relY)
      const dropDeltaX = relX - groupCenterX;
      const dropDeltaY = relY - Math.max(0, groupCenterY);

      inLayers.forEach(layer => {
         const incoming = JSON.parse(JSON.stringify(layer));
         delete incoming.id;
         incoming.x = (layer.x ?? 0) + dropDeltaX;
         incoming.y = (layer.y ?? 0) + dropDeltaY;
         
         // Permitir que retenga offset y layout al 100%
         incoming.baseW = imageDimensions.width;
         incoming.baseH = imageDimensions.height;
         addLayer(viewIdToUse, incoming);
      });
    };

    window.addEventListener('design:layer-drop', handleExternalDrop);
    return () => window.removeEventListener('design:layer-drop', handleExternalDrop);
  }, [canvas, viewIdToUse, addLayer, imageDimensions, canvasScale]);

  useEffect(() => {
    const lc = localCanvasRef.current;
    const { totalW, totalH, padding = 0 } = imageDimensions;
    if (!lc || !isCanvasValid(lc) || totalW === 0 || totalH === 0) return;
    try {
      const printAreasToRender = Array.isArray(printAreas)
        ? printAreas
        : [];

      // Eliminar zonas existentes que no están en printAreas
      const existingZones = lc.getObjects().filter(obj => obj.printAreaId);
      const currentZoneIds = printAreasToRender.map(a => a.id);
      existingZones.forEach(zone => {
        if (!currentZoneIds.includes(zone.printAreaId)) {
          lc.remove(zone);
        }
      });

      // Actualizar o crear zonas con cálculo robusto de padding
      printAreasToRender.forEach((area) => {
        const dims = imageDimensions;
        const padding = dims.padding || 0;
        const pa = {
          x: padding + (dims.width * (area.x || 0)) / 100,
          y: padding + (dims.height * (area.y || 0)) / 100,
          width: (dims.width * (area.width || 40)) / 100,
          height: (dims.height * (area.height || 40)) / 100,
        };

        const isActive = activePrintAreaId === area.id;
        const strokeColor = isActive ? 'rgba(180, 23, 30, 0.9)' : 'rgba(33, 150, 243, 0.6)';
        const strokeWidth = isActive ? 3 : 2;
        const strokeDashArray = isActive ? null : [8, 4];
        const fillColor = isActive ? 'rgba(180, 23, 30, 0.1)' : 'transparent';

        const existingZone = lc.getObjects().find(obj => obj.printAreaId === area.id);

        if (existingZone) {
          // Actualizar zona existente con estado activo
          if (area.shape === SHAPE_TYPES.CIRCLE || area.shape === SHAPE_TYPES.SQUARE) {
            const radius = Math.min(pa.width, pa.height) / 2;
            existingZone.set({
              left: pa.x + pa.width / 2,
              top: pa.y + pa.height / 2,
              radius: radius,
              fill: fillColor,
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              strokeDashArray: strokeDashArray,
              evented: showZones,
              visible: showZones,
              hoverCursor: 'pointer',
              originX: 'center',
              originY: 'center',
              objectCaching: false,
              strokeUniform: true
            });
          } else if (area.shape === SHAPE_TYPES.ELLIPSE) {
            existingZone.set({
              left: pa.x + pa.width / 2,
              top: pa.y + pa.height / 2,
              rx: pa.width / 2,
              ry: pa.height / 2,
              fill: fillColor,
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              strokeDashArray: strokeDashArray,
              evented: showZones,
              visible: showZones,
              hoverCursor: 'pointer',
              originX: 'center',
              originY: 'center',
              objectCaching: false,
              strokeUniform: true
            });
          } else {
            existingZone.set({
              left: pa.x,
              top: pa.y,
              width: pa.width,
              height: pa.height,
              fill: fillColor,
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              strokeDashArray: strokeDashArray,
              evented: showZones,
              visible: showZones,
              hoverCursor: 'pointer',
              originX: 'left',
              originY: 'top',
              objectCaching: false,
              strokeUniform: true
            });
          }
          existingZone.setCoords();

          // Asegurar que tiene el evento de click
          existingZone.off('mousedown');
          existingZone.on('mousedown', (e) => {
            if (e.e && !e.e.ctrlKey && !e.e.metaKey) {
              setActivePrintAreaId(viewIdToUse, area.id);
              safeRenderAll(lc);
            }
          });
        } else {
          // Crear nueva zona si no existe
          let newZone;
          if (area.shape === SHAPE_TYPES.CIRCLE || area.shape === SHAPE_TYPES.SQUARE) {
            const radius = Math.min(pa.width, pa.height) / 2;
            newZone = new fabric.Circle({
              left: pa.x + pa.width / 2,
              top: pa.y + pa.height / 2,
              radius: radius,
              fill: fillColor,
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              strokeDashArray: strokeDashArray,
              selectable: false,
              evented: showZones,
              hoverCursor: 'pointer',
              originX: 'center',
              originY: 'center',
              printAreaId: area.id,
              visible: showZones,
              objectCaching: false,
              strokeUniform: true
            });
          } else if (area.shape === SHAPE_TYPES.ELLIPSE) {
            newZone = new fabric.Ellipse({
              left: pa.x + pa.width / 2,
              top: pa.y + pa.height / 2,
              rx: pa.width / 2,
              ry: pa.height / 2,
              fill: fillColor,
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              strokeDashArray: strokeDashArray,
              selectable: false,
              evented: showZones,
              hoverCursor: 'pointer',
              originX: 'center',
              originY: 'center',
              printAreaId: area.id,
              visible: showZones,
              objectCaching: false,
              strokeUniform: true
            });
          } else if (area.shape === SHAPE_TYPES.HEART) {
            const pathData = renderShapeSVG(SHAPE_TYPES.HEART, pa.width, pa.height);
            newZone = new fabric.Path(pathData, {
              left: pa.x,
              top: pa.y,
              fill: fillColor,
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              strokeDashArray: strokeDashArray,
              selectable: false,
              evented: showZones,
              hoverCursor: 'pointer',
              scaleX: pa.width / 100,
              scaleY: pa.height / 100,
              printAreaId: area.id,
              visible: showZones,
              objectCaching: false,
              strokeUniform: true
            });
          } else if (area.shape === SHAPE_TYPES.CUSTOM && area.customShapeId) {
            // Para formas personalizadas, cargar el SVG path
            loadCustomShape(area.customShapeId).then(pathData => {
              if (pathData && lc && isCanvasValid(lc)) {
                const customPath = new fabric.Path(pathData, {
                  left: pa.x,
                  top: pa.y,
                  fill: fillColor,
                  stroke: strokeColor,
                  strokeWidth: strokeWidth,
                  strokeDashArray: strokeDashArray,
                  selectable: false,
                  evented: showZones,
                  hoverCursor: 'pointer',
                  scaleX: pa.width / 100,
                  scaleY: pa.height / 100,
                  printAreaId: area.id,
                  visible: showZones,
                  objectCaching: false,
                  strokeUniform: true
                });
                lc.add(customPath);
                customPath.sendToBack();
                customPath.on('mousedown', (e) => {
                  if (e.e && !e.e.ctrlKey && !e.e.metaKey) {
                    setActivePrintAreaId(viewIdToUse, area.id);
                    safeRenderAll(lc);
                  }
                });
                safeRenderAll(lc);
              }
            });
            // Crear un rectángulo temporal mientras se carga
            newZone = new fabric.Rect({
              left: pa.x,
              top: pa.y,
              width: pa.width,
              height: pa.height,
              fill: fillColor,
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              strokeDashArray: strokeDashArray,
              selectable: false,
              evented: showZones,
              hoverCursor: 'pointer',
              printAreaId: area.id,
              visible: showZones,
              objectCaching: false,
              strokeUniform: true,
              originX: 'left',
              originY: 'top'
            });
          } else {
            newZone = new fabric.Rect({
              left: pa.x,
              top: pa.y,
              width: pa.width,
              height: pa.height,
              fill: fillColor,
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              strokeDashArray: strokeDashArray,
              selectable: false,
              evented: showZones,
              hoverCursor: 'pointer',
              printAreaId: area.id,
              visible: showZones,
              objectCaching: false,
              strokeUniform: true,
              originX: 'left',
              originY: 'top'
            });
          }
          lc.add(newZone);
          newZone.sendToBack();
          newZone.on('mousedown', (e) => {
            if (e.e && !e.e.ctrlKey && !e.e.metaKey) {
              setActivePrintAreaId(viewIdToUse, area.id);
              safeRenderAll(lc);
            }
          });
        }
      });
      safeRenderAll(lc);

      // Sincronizar layers: actualizar objetos existentes in situ para no perder selección ni modo edición
      const activeArea = activePrintAreaId
        ? printAreasToRender.find(a => a.id === activePrintAreaId)
        : null;
      const areaToUse = activeArea || printAreasToRender[0];
      const defaultPa = {
        x: (imageDimensions.padding || 0) + (imageDimensions.width * (areaToUse.x || 0)) / 100,
        y: (imageDimensions.padding || 0) + (imageDimensions.height * (areaToUse.y || 0)) / 100,
        width: (imageDimensions.width * (areaToUse.width || 40)) / 100,
        height: (imageDimensions.height * (areaToUse.height || 40)) / 100,
      };
      const defaultLeft = defaultPa.x + defaultPa.width / 2 - 50;
      const defaultTop = defaultPa.y + defaultPa.height / 2 - 25;

      const layerIds = new Set(layers.map((l) => l.id));
      const existingObjects = lc.getObjects().filter((o) => o.customId && !o.printAreaId && !o._isTintOverlay);

      // Eliminar solo los objetos cuya capa ya no existe
      existingObjects.forEach((obj) => {
        if (!layerIds.has(obj.customId)) {
          // Eliminar también el overlay de tinte si existe
          if (obj._tintOverlay) {
            try { lc.remove(obj._tintOverlay); } catch (_) { }
            obj._tintOverlay = null;
          }
          lc.remove(obj);
          if (editingTextId === obj.customId) {
            setEditingTextId(null);
            editingTextObjRef.current = null;
          }
        }
      });

      layers.forEach((rawLayer) => {
        const layer = { ...rawLayer };
        const dW = imageDimensions.width;
        const dH = imageDimensions.height;
        // Si el layer viene de otra vista (ej. con "Copiar a todos") y el tamaño original de 
        // la prenda es distinto, adaptamos coordenadas exactas proporcionalmente
        if (layer.baseW && dW && layer.baseW !== dW && layer.x != null) {
          const rX = dW / layer.baseW;
          const rY = dH / (layer.baseH || layer.baseW);
          layer.x = layer.x * rX;
          if (layer.y != null) layer.y = layer.y * rY;
          layer.scaleX = (layer.scaleX ?? 1) * rX;
          layer.scaleY = (layer.scaleY ?? 1) * rY;
        }

        const existing = lc.getObjects().find((o) => o.customId === layer.id);

        if (layer.type === 'text') {
          if (existing && (existing.type === 'i-text' || existing.type === 'text')) {
            // Actualizar in situ para no deseleccionar ni salir de edición
            const isEditing = existing.isEditing === true;
            const isGrouped = existing.group && existing.group.type === 'activeSelection';
            existing.set({
              ...(isEditing ? {} : { text: layer.text || 'Texto' }),
              fontSize: layer.fontSize || 40,
              fill: layer.color || '#000000',
              fontFamily: layer.fontFamily || 'Arial',
              fontWeight: layer.fontWeight || FONT_WEIGHT_NORMAL,
              fontStyle: layer.fontStyle || FONT_STYLE_NORMAL,
              textAlign: layer.textAlign || 'left',
              ...(isGrouped ? {} : {
                left: layer.x ?? defaultPa.x + 20,
                top: layer.y ?? defaultPa.y + 20,
                scaleX: layer.scaleX ?? 1,
                scaleY: layer.scaleY ?? 1,
                angle: layer.angle || 0,
                flipX: layer.flipX || false,
                flipY: layer.flipY || false,
              }),
              editable: !(typeof window !== 'undefined' && window.innerWidth <= 768)
            });
            existing.setCoords();
            safeRequestRenderAll(lc);
          } else {
            const TextClass = fabric.IText || fabric.Text;
            // Use saved position if it exists; only fall back to default for brand-new layers
            const initLeft = layer.x != null ? layer.x : defaultLeft;
            const initTop = layer.y != null ? layer.y : defaultTop;
            const text = new TextClass(layer.text || 'Texto', {
              left: initLeft,
              top: initTop,
              fontSize: layer.fontSize || 40,
              fill: layer.color || '#000000',
              fontFamily: layer.fontFamily || 'Arial',
              fontWeight: layer.fontWeight || FONT_WEIGHT_NORMAL,
              fontStyle: layer.fontStyle || FONT_STYLE_NORMAL,
              textAlign: layer.textAlign || 'left',
              scaleX: layer.scaleX ?? 1,
              scaleY: layer.scaleY ?? 1,
              angle: layer.angle || 0,
              flipX: layer.flipX || false,
              flipY: layer.flipY || false,
              customId: layer.id,
              editable: !(typeof window !== 'undefined' && window.innerWidth <= 768) // Previene que se abra el SO keyboard nativo en móvil
            });
            lc.add(text);
            // Only call updateLayer for truly new layers (no saved x,y)
            if (rawLayer.x == null || rawLayer.y == null) {
              updateLayer(viewIdToUse, layer.id, { x: initLeft, y: initTop, baseW: imageDimensions.width, baseH: imageDimensions.height });
            }
            if (text.isEditing !== undefined) {
              text.on('editing:entered', () => {
                setEditingTextId(layer.id);
                editingTextObjRef.current = text;
              });
              text.on('editing:exited', () => {
                updateLayer(viewIdToUse, layer.id, {
                  text: text.text,
                  fontSize: text.fontSize,
                  fontFamily: text.fontFamily || 'Arial',
                  fontWeight: text.fontWeight || FONT_WEIGHT_NORMAL,
                  fontStyle: text.fontStyle || FONT_STYLE_NORMAL,
                  color: text.fill,
                  textAlign: text.textAlign || 'left',
                  x: text.left,
                  y: text.top,
                  scaleX: text.scaleX,
                  scaleY: text.scaleY,
                  angle: text.angle,
                  baseW: imageDimensionsRef.current.width,
                  baseH: imageDimensionsRef.current.height,
                });
                setEditingTextId(null);
                editingTextObjRef.current = null;
              });
            }
          }
        } else if (layer.type === 'image' && layer.src) {
          const rawUrl = ensureSingleImageUrl(layer.src);
          const imageUrl = toDirectImageUrl(rawUrl);

          if (!imageUrl) return;
          const applyTintFilter = (fabricImg) => {
            if (!fabricImg) return;

            // Si la capa tiene color, sobreescribimos el método _render 
            // para dibujarla en un canvas virtual y aplicar source-atop sin requerir CORS
            if (layer.tintColor) {
              if (!fabricImg._originalRender) {
                fabricImg._originalRender = fabricImg._render.bind(fabricImg);
              }
              fabricImg.tintColor = layer.tintColor;
              fabricImg.tintOpacity = layer.tintOpacity ?? 1;

              fabricImg._render = function (ctx) {
                if (!this.tintColor || !this._element) {
                  this._originalRender(ctx);
                  return;
                }
                const w = this.width;
                const h = this.height;
                const offCanvas = document.createElement('canvas');
                offCanvas.width = w;
                offCanvas.height = h;
                const offCtx = offCanvas.getContext('2d');

                // 1. Dibujar imagen original
                offCtx.drawImage(this._element, 0, 0, w, h);
                // 2. Aplicar color encima de los pixeles no transparentes
                offCtx.globalCompositeOperation = 'source-atop';
                offCtx.fillStyle = this.tintColor;
                offCtx.globalAlpha = this.tintOpacity ?? 1;
                offCtx.fillRect(0, 0, w, h);

                // 3. Llevar al lienzo de FabricJS
                ctx.drawImage(offCanvas, -w / 2, -h / 2, w, h);
              };
            } else {
              // Limpiar tinte restaurando render original y eliminando estado
              if (fabricImg._originalRender) {
                fabricImg._render = fabricImg._originalRender;
                fabricImg._originalRender = undefined;
              }
              fabricImg.tintColor = null;
              fabricImg.tintOpacity = null;
            }
          };

          if (existing && existing.type === 'image') {
            const lastSrc = lastImageSrcByLayerIdRef.current[layer.id];
            if (lastSrc !== layer.src) {
              existing.setSrc(imageUrl, () => {
                const el = existing._element ?? existing.getElement?.();
                const hasValid = el && typeof el.naturalWidth === 'number' && el.naturalWidth > 0;
                const isGrouped = existing.group && existing.group.type === 'activeSelection';
                if (!isGrouped) {
                  existing.set({
                    left: layer.x ?? defaultPa.x + 20,
                    top: layer.y ?? defaultPa.y + 20,
                    scaleX: layer.scaleX ?? 1,
                    scaleY: layer.scaleY ?? 1,
                    angle: layer.angle || 0,
                    flipX: layer.flipX || false,
                    flipY: layer.flipY || false,
                  });
                }
                if (hasValid) {
                  if (layer.maskShape === 'circle') {
                    existing.clipPath = new fabric.Circle({
                      radius: Math.min(existing.width, existing.height) / 2,
                      originX: 'center',
                      originY: 'center',
                    });
                  } else if (layer.maskShape === 'square') {
                    existing.clipPath = new fabric.Rect({
                      width: existing.width,
                      height: existing.height,
                      originX: 'center',
                      originY: 'center',
                    });
                  } else {
                    existing.clipPath = null;
                  }
                }
                applyTintFilter(existing);
                existing.setCoords();
                safeRenderAll(lc);
              });
              lastImageSrcByLayerIdRef.current = { ...lastImageSrcByLayerIdRef.current, [layer.id]: layer.src };
            } else {
              const isGrouped = existing.group && existing.group.type === 'activeSelection';
              if (!isGrouped) {
                existing.set({
                  left: layer.x ?? defaultPa.x + 20,
                  top: layer.y ?? defaultPa.y + 20,
                  scaleX: layer.scaleX ?? 1,
                  scaleY: layer.scaleY ?? 1,
                  angle: layer.angle || 0,
                  flipX: layer.flipX || false,
                  flipY: layer.flipY || false,
                });
              }
              applyTintFilter(existing);
              existing.setCoords();
            }
          } else {
            const tempLayerId = layer.id;
            if (loadingImageIdsRef.current.has(tempLayerId)) return;
            loadingImageIdsRef.current.add(tempLayerId);

            fabric.Image.fromURL(imageUrl, (img) => {
              loadingImageIdsRef.current.delete(tempLayerId);
              if (!img) return;

              const el = img._element ?? img.getElement?.();
              const hasValidElement = el && typeof el.naturalWidth === 'number' && el.naturalWidth > 0;
              const hasDimensions = typeof img.width === 'number' && typeof img.height === 'number' && img.width > 0 && img.height > 0;
              if (!hasValidElement && !hasDimensions) return;
              
              // Evitar redibujar si en este milisegundo ya se instanció de alguna forma síncrona/cacheada
              if (lc.getObjects().some(o => o.customId === tempLayerId)) return;

              // Obtener estado mas actualizado para sortear la condición de carrera
              const _latestLayer = (layersByViewRef.current[viewIdToUse] || []).find(l => l.id === tempLayerId) || rawLayer;
              const safeLayer = { ..._latestLayer };
              const currentW = imageDimensionsRef.current.width;
              const currentH = imageDimensionsRef.current.height;

              if (safeLayer.baseW && currentW && safeLayer.baseW !== currentW && safeLayer.x != null) {
                  const rX = currentW / safeLayer.baseW;
                  const rY = currentH / (safeLayer.baseH || safeLayer.baseW);
                  safeLayer.x = safeLayer.x * rX;
                  if (safeLayer.y != null) safeLayer.y = safeLayer.y * rY;
                  safeLayer.scaleX = (safeLayer.scaleX ?? 1) * rX;
                  safeLayer.scaleY = (safeLayer.scaleY ?? 1) * rY;
              }

              const initLeft = safeLayer.x != null ? safeLayer.x : defaultLeft;
              const initTop = safeLayer.y != null ? safeLayer.y : defaultTop;
              img.set({
                left: initLeft,
                top: initTop,
                scaleX: safeLayer.scaleX ?? 1,
                scaleY: safeLayer.scaleY ?? 1,
                angle: safeLayer.angle || 0,
                flipX: safeLayer.flipX || false,
                flipY: safeLayer.flipY || false,
                customId: safeLayer.id,
              });
              if (_latestLayer.x == null || _latestLayer.y == null) {
                updateLayer(viewIdToUse, safeLayer.id, { x: initLeft, y: initTop, baseW: currentW, baseH: currentH });
              }
              if (safeLayer.maskShape === 'circle') {
                const clipPath = new fabric.Circle({
                  radius: Math.min(img.width, img.height) / 2,
                  originX: 'center',
                  originY: 'center',
                });
                img.clipPath = clipPath;
              } else if (safeLayer.maskShape === 'square') {
                const clipPath = new fabric.Rect({
                  width: img.width,
                  height: img.height,
                  originX: 'center',
                  originY: 'center',
                });
                img.clipPath = clipPath;
              }
              lc.add(img);
              applyTintFilter(img);
              lastImageSrcByLayerIdRef.current = { ...lastImageSrcByLayerIdRef.current, [safeLayer.id]: safeLayer.src };
              safeRenderAll(lc);
            });
          }
        } else if (layer.type === 'shape') {
          if (existing && (existing.type === 'rect' || existing.type === 'circle' || existing.type === 'triangle')) {
            const isGrouped = existing.group && existing.group.type === 'activeSelection';
            existing.set({
              fill: layer.fill || '#000000',
              stroke: layer.stroke || null,
              ...(isGrouped ? {} : {
                left: layer.x ?? defaultPa.x + 20,
                top: layer.y ?? defaultPa.y + 20,
                scaleX: layer.scaleX ?? 1,
                scaleY: layer.scaleY ?? 1,
                angle: layer.angle || 0,
                flipX: layer.flipX || false,
                flipY: layer.flipY || false,
              })
            });
            existing.setCoords();
          } else {
            // Use saved position if it exists; only fall back to default for brand-new layers
            const initLeft = layer.x != null ? layer.x : defaultLeft;
            const initTop = layer.y != null ? layer.y : defaultTop;
            const opts = {
              left: initLeft,
              top: initTop,
              fill: layer.fill || '#000000',
              stroke: layer.stroke || null,
              scaleX: layer.scaleX ?? 1,
              scaleY: layer.scaleY ?? 1,
              angle: layer.angle || 0,
              flipX: layer.flipX || false,
              flipY: layer.flipY || false,
              customId: layer.id,
            };
            let obj;
            if (layer.shapeType === 'circle') {
              obj = new fabric.Circle({ radius: layer.radius ?? 40, ...opts });
            } else if (layer.shapeType === 'rectangle') {
              obj = new fabric.Rect({ width: layer.width ?? 80, height: layer.height ?? 60, ...opts });
            } else if (layer.shapeType === 'triangle') {
              obj = new fabric.Triangle({ width: 60, height: 60, ...opts });
            } else {
              obj = new fabric.Rect({ width: 80, height: 60, ...opts });
            }
            lc.add(obj);
            // Only persist position for truly new layers (no saved x,y)
            if (rawLayer.x == null || rawLayer.y == null) {
              updateLayer(viewIdToUse, layer.id, { x: initLeft, y: initTop, baseW: imageDimensions.width, baseH: imageDimensions.height });
            }
          }
        }
      });

      // Asegurar el orden de apilamiento correcto (Z-order)
      layers.forEach((layer) => {
        const obj = lc.getObjects().find((o) => o.customId === layer.id);
        if (obj) {
          obj.bringToFront();
          // El overlay de tinte también debe estar encima de la imagen
          if (obj._tintOverlay) obj._tintOverlay.bringToFront();
        }
      });

      safeRenderAll(lc);

      if (pendingActiveLayerIdRef.current) {
        const obj = lc.getObjects().find((o) => o.customId === pendingActiveLayerIdRef.current);
        if (obj) lc.setActiveObject(obj);
        safeRequestRenderAll(lc);
        pendingActiveLayerIdRef.current = null;
      }
    } catch (err) {
      console.warn('EditorCanvas: error syncing layers', err);
    }
  }, [canvas, layers, printAreas, imageDimensions.width, imageDimensions.height, activePrintAreaId, viewIdToUse, updateLayer, editingTextId, setActivePrintAreaId]);

  const getEditingTextObject = () => {
    if (!canvas || !editingTextId) return null;
    return canvas.getObjects().find(o => o.customId === editingTextId) || editingTextObjRef.current;
  };

  useEffect(() => {
    if (!editingTextId || !containerRef.current) {
      setToolbarRect(null);
      return;
    }
    const updateRect = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setToolbarRect({ top: rect.top, left: rect.left, width: rect.width });
      }
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [editingTextId]);

  // Sincronizar valor del input de tamaño cuando se abre el editor de texto
  useEffect(() => {
    if (editingTextId && canvas) {
      const obj = canvas.getObjects().find(o => o.customId === editingTextId) || editingTextObjRef.current;
      setInlineFontSizeInput(String(obj?.fontSize ?? 40));
    }
  }, [editingTextId, canvas]);

  const editingLayer = editingTextId ? layers.find((l) => l.id === editingTextId) : null;
  const inlineToolbarContent = editingTextId && canvas && toolbarRect && (
    <div
      className={styles.inlineTextToolbar}
      style={{
        position: 'fixed',
        top: Math.max(8, toolbarRect.top - 52),
        left: toolbarRect.left + toolbarRect.width / 2,
        transform: 'translate(-50%, 0)',
      }}
    >
      <div className={styles.inlineToolbarGroup}>
        <span className={styles.inlineToolbarLabel}>Alinear:</span>
        {[
          { value: 'left', title: 'Izquierda', svg: <path d="M0 2h20v1.5H0V2zm0 5h14v1.5H0V7zm0 5h20v1.5H0V12z" /> },
          { value: 'center', title: 'Centro', svg: <path d="M3 2h14v1.5H3V2zm1 5h12v1.5H4V7zm3 5h6v1.5H7V12z" /> },
          { value: 'right', title: 'Derecha', svg: <path d="M0 2h20v1.5H0V2zm6 5h14v1.5H6V7zM0 12h20v1.5H0V12z" /> }
        ].map(({ value, title, svg }) => {
          const currentAlign = getEditingTextObject()?.textAlign || 'left';
          const isActive = currentAlign === value;
          return (
            <button
              key={value}
              type="button"
              className={`${styles.inlineToolbarBtn} ${isActive ? styles.inlineToolbarBtnActive : ''}`}
              title={title}
              onClick={() => {
                const obj = getEditingTextObject();
                if (obj) {
                  obj.set('textAlign', value);
                  updateLayer(viewIdToUse, editingTextId, { textAlign: value });
                  safeRequestRenderAll(canvas);
                }
              }}
            >
              <svg width="18" height="14" viewBox="0 0 20 16" fill="currentColor" aria-hidden>
                {svg}
              </svg>
            </button>
          );
        })}
      </div>
      <div className={styles.inlineToolbarGroup}>
        <span className={styles.inlineToolbarLabel}>Color:</span>
        <input
          type="color"
          value={editingLayer?.color ?? getEditingTextObject()?.fill ?? '#000000'}
          onChange={(e) => {
            const obj = getEditingTextObject();
            const val = e.target.value;
            if (obj) {
              obj.set('fill', val);
              updateLayer(viewIdToUse, editingTextId, { color: val });
              safeRequestRenderAll(canvas);
            }
          }}
          className={styles.inlineColorInput}
        />
      </div>
      <div className={styles.inlineToolbarGroup}>
        <span className={styles.inlineToolbarLabel}>Estilo:</span>
        <button
          type="button"
          title="Negrita"
          className={`${styles.inlineToolbarBtn} ${(editingLayer?.fontWeight ?? getEditingTextObject()?.fontWeight ?? FONT_WEIGHT_NORMAL) === FONT_WEIGHT_BOLD ? styles.inlineToolbarBtnActive : ''}`}
          onClick={() => {
            const obj = getEditingTextObject();
            if (!obj) return;
            const next = (obj.fontWeight || FONT_WEIGHT_NORMAL) === FONT_WEIGHT_BOLD ? FONT_WEIGHT_NORMAL : FONT_WEIGHT_BOLD;
            obj.set('fontWeight', next);
            updateLayer(viewIdToUse, editingTextId, { fontWeight: next });
            safeRequestRenderAll(canvas);
          }}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          title="Cursiva"
          className={`${styles.inlineToolbarBtn} ${(editingLayer?.fontStyle ?? getEditingTextObject()?.fontStyle ?? FONT_STYLE_NORMAL) === FONT_STYLE_ITALIC ? styles.inlineToolbarBtnActive : ''}`}
          onClick={() => {
            const obj = getEditingTextObject();
            if (!obj) return;
            const next = (obj.fontStyle || FONT_STYLE_NORMAL) === FONT_STYLE_ITALIC ? FONT_STYLE_NORMAL : FONT_STYLE_ITALIC;
            obj.set('fontStyle', next);
            updateLayer(viewIdToUse, editingTextId, { fontStyle: next });
            safeRequestRenderAll(canvas);
          }}
        >
          <em>I</em>
        </button>
      </div>
      <div className={styles.inlineToolbarGroup}>
        <span className={styles.inlineToolbarLabel}>Fuente:</span>
        <select
          value={editingLayer?.fontFamily ?? getEditingTextObject()?.fontFamily ?? 'Arial'}
          onChange={(e) => {
            const obj = getEditingTextObject();
            const val = e.target.value;
            if (obj) {
              obj.set('fontFamily', val);
              updateLayer(viewIdToUse, editingTextId, { fontFamily: val });
              safeRequestRenderAll(canvas);
            }
          }}
          className={styles.inlineFontSelect}
        >
          {EDITOR_FONTS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className={styles.inlineToolbarGroup}>
        <span className={styles.inlineToolbarLabel}>Tamaño:</span>
        <input
          type="number"
          min={8}
          max={200}
          value={inlineFontSizeInput}
          onChange={(e) => {
            setInlineFontSizeInput(e.target.value);
            const v = parseInt(e.target.value, 10);
            if (Number.isNaN(v)) return;
            const val = Math.max(8, Math.min(200, v));
            const obj = getEditingTextObject();
            if (obj) {
              obj.set('fontSize', val);
              updateLayer(viewIdToUse, editingTextId, { fontSize: val });
              safeRequestRenderAll(canvas);
            }
          }}
          onBlur={() => {
            const obj = getEditingTextObject();
            if (obj) setInlineFontSizeInput(String(obj.fontSize ?? 40));
          }}
          className={styles.inlineFontSizeInput}
        />
      </div>
    </div>
  );

  const { totalW = imageDimensions.width, totalH = imageDimensions.height, padding = 0 } = imageDimensions;
  const scaledW = Math.round(totalW * canvasScale);
  const scaledH = Math.round(totalH * canvasScale);

  const innerContent = (
    <div
      className={styles.canvasWrapper}
      style={{
        width: scaledW,
        height: scaledH,
        position: 'relative',
        overflow: 'hidden', /* Oculto estrictamente para no deformar el responsive móvil */
        borderRadius: '8px'
      }}
    >
      {/* Contenedor Único Escalado: Sincroniza imagen y canvas al 100% */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: totalW,
          height: totalH,
          transform: `scale(${canvasScale})`,
          transformOrigin: 'top left',
          zIndex: 1,
        }}
      >
        {productImageDisplayUrl && (
          <img
            src={productImageDisplayUrl}
            alt=""
            className={styles.fallbackProductImage}
            style={{
              position: 'absolute',
              top: padding,
              left: padding,
              width: imageDimensions.width,
              height: imageDimensions.height,
              objectFit: 'contain',
              zIndex: 0,
              pointerEvents: 'none',
              display: 'block'
            }}
          />
        )}
        {/* Stable wrapper to prevent Fabric.js DOM manipulation from crashing React */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div ref={containerRef} className={styles.canvasContainer}>
        {/* Imagen de referencia CSS invisible: usa max-width:100% igual que PrintAreasEditor.
            Su offsetWidth se usa para calcular canvasScale, garantizando tamaños idénticos en ambas pestañas. */}
        {productImageDisplayUrl && (
          <img
            ref={cssImgRef}
            src={productImageDisplayUrl}
            alt=""
            aria-hidden="true"
            onLoad={() => { if (updateScaleRef.current) updateScaleRef.current(); }}
            style={{
              display: 'block',
              width: 'auto',
              maxWidth: '100%',
              height: 'auto',
              maxHeight: '100%',
              objectFit: 'contain',
              opacity: 0,
              pointerEvents: 'none',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: -1,
            }}
          />
        )}
        {innerContent}
      </div>
      {viewId === activeViewId && inlineToolbarContent && createPortal(inlineToolbarContent, document.body)}
    </>
  );
};

export default EditorCanvas;
