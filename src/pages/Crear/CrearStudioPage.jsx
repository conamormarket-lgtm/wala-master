import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fabric } from 'fabric';
import {
  ArrowLeft, ImagePlus, Type, Trash2, Copy, FlipHorizontal, ArrowUpToLine, ArrowDownToLine,
  Crosshair, Maximize2, RotateCw, Bold, Italic, Save, ShoppingBag, Loader2, AlertTriangle, CheckCircle2, Info,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getPrendaBase } from '../../services/prendasBase';
import { getDesignById, saveDesign } from '../../services/designs';
import {
  prepararImagenCliente, subirImagenCliente, subirArchivoImpresion, subirVistaPrevia,
} from '../../services/crearArchivos';
import {
  UNIDADES_ZONA, leerPrendaBase, precioBase, precioPersonalizado, zonasConDiseno, listarZonas,
  dpiDeCapa, calidadDeDpi, cargarImagen, tintarImagen, fotoDeVista, requiereTenido, textoSobre, esColorBlanco,
  colorDisponible, tallasDeColor,
} from '../../utils/prendaBase';
import {
  FUENTES, asegurarFuente, asegurarFuentesDe, altoEnUnidades, crearObjeto, leerTransformacion,
  propiedadesTexto, renderizarImpresion, renderizarVistaPrevia, transformDeZona, rectDeZona,
  recorteDeZona, seSaleDeZona, ubicacion,
} from './renderDiseno';
import styles from './CrearStudioPage.module.css';

const VIOLETA = '#7C3AED';
const COLORES_TEXTO = ['#111111', '#FFFFFF', '#7C3AED', '#E11D48', '#F59E0B', '#10B981', '#2563EB', '#F472B6'];

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
const nuevoId = () => `capa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const claveBorrador = (id) => `crear_borrador_${id}`;

/** Controles de selección: grandes para el dedo, con el violeta de la marca. */
const estilizar = (obj) => {
  obj.set({
    borderColor: VIOLETA,
    cornerColor: '#FFFFFF',
    cornerStrokeColor: VIOLETA,
    cornerStyle: 'circle',
    transparentCorners: false,
    cornerSize: 14,
    touchCornerSize: 28,
    borderScaleFactor: 1.5,
    padding: 4,
    lockScalingFlip: true,
  });
  obj.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
};

/** Quita lo que solo sirve mientras se edita (marcas de subida) y las zonas vacías. */
const capasParaGuardar = (capasPorZona) => {
  const out = {};
  Object.entries(capasPorZona || {}).forEach(([zonaId, capas]) => {
    const limpias = (capas || [])
      .filter((c) => c.type !== 'image' || (c.src && !c.src.startsWith('blob:')))
      .map(({ subiendo, ...resto }) => resto);
    if (limpias.length) out[zonaId] = limpias;
  });
  return out;
};

const CrearStudioPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { addToCart } = useCart();
  const toast = useGlobalToast();
  const designIdParam = searchParams.get('designId');

  const { data: prenda, isLoading, error } = useQuery({
    queryKey: ['prenda-base', id],
    queryFn: async () => {
      const { data, error: err } = await getPrendaBase(id);
      if (err) throw new Error(err);
      return data;
    },
  });
  // Solo los colores que se pueden mostrar: un bicolor sin sus fotos no se ofrece.
  const cfg = useMemo(() => {
    if (!prenda) return null;
    const leida = leerPrendaBase(prenda);
    const listos = leida.colores.filter((c) => colorDisponible(c, leida.vistas));
    return { ...leida, colores: listos.length ? listos : leida.colores };
  }, [prenda]);
  const agotado = typeof prenda?.inStock === 'number' && prenda.inStock <= 0;
  // Un borrador (visible: false) solo lo ve el admin, para revisarlo antes de publicar.
  const borrador = prenda?.visible === false;
  const disponible = Boolean(prenda) && prenda.esPrendaBase === true && prenda.deleted !== true && (!borrador || isAdmin);

  const [vistaId, setVistaId] = useState(null);
  const [colorId, setColorId] = useState(null);
  const [talla, setTalla] = useState('');
  const [zonaId, setZonaId] = useState(null);
  // Capas agrupadas por zona de impresión: { [zonaId]: capa[] }.
  const [capasPorZona, setCapasPorZona] = useState({});
  const [seleccionId, setSeleccionId] = useState(null);
  const [version, setVersion] = useState(0);
  const [listo, setListo] = useState(false);
  const [anchoLienzo, setAnchoLienzo] = useState(0);
  const [subiendo, setSubiendo] = useState(0);
  const [procesando, setProcesando] = useState(null);
  const [designId, setDesignId] = useState(designIdParam || null);
  const [pedirLogin, setPedirLogin] = useState(false);
  const [avisoTalla, setAvisoTalla] = useState(false);
  const [fueraDeZona, setFueraDeZona] = useState(false);

  const contenedorRef = useRef(null);
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const transformsRef = useRef({});
  const zonaRef = useRef(null);
  const capasRef = useRef({});
  const vistaRef = useRef(null);
  const seleccionRef = useRef(null);
  const localSrcRef = useRef(new Map());
  const tokenRef = useRef(0);
  const inputArchivoRef = useRef(null);
  const tallasRef = useRef(null);

  vistaRef.current = vistaId;
  const zonaDe = (capaId) => Object.keys(capasRef.current)
    .find((zId) => (capasRef.current[zId] || []).some((c) => c.id === capaId)) || null;
  seleccionRef.current = seleccionId;

  const vista = cfg?.vistas.find((v) => v.id === vistaId) || cfg?.vistas[0] || null;
  const zona = vista?.zonas.find((z) => z.id === zonaId) || vista?.zonas[0] || null;
  zonaRef.current = zona?.id || null;
  const color = cfg?.colores.find((c) => c.id === colorId) || cfg?.colores[0] || null;
  const zonasPrenda = useMemo(() => (cfg ? listarZonas(cfg.vistas) : []), [cfg]);
  const zonaPorId = (zId) => zonasPrenda.find((z) => z.id === zId) || null;
  const capasVista = (vista?.zonas || []).flatMap((z) => capasPorZona[z.id] || []);
  const capaSel = capasVista.find((c) => c.id === seleccionId) || null;
  const zonaSel = capaSel ? zonaPorId(zonaDe(capaSel.id)) : null;
  const tallas = color ? tallasDeColor(color, cfg) : [];
  const zonasUsadas = useMemo(
    () => zonasConDiseno(capasPorZona).filter((z) => zonasPrenda.some((x) => x.id === z)),
    [zonasPrenda, capasPorZona]
  );
  const total = prenda ? precioPersonalizado(prenda, zonasUsadas) : 0;
  const srcDe = useCallback((capa) => localSrcRef.current.get(capa.id) || capa.src, []);

  // ── Pantalla completa en el celular (oculta header, footer y barra inferior)
  useEffect(() => {
    document.body.classList.add('mobile-editor-active');
    return () => document.body.classList.remove('mobile-editor-active');
  }, []);

  // ── Estado inicial: diseño guardado, borrador o valores por defecto ─────
  useEffect(() => {
    if (!cfg || listo || authLoading) return;
    let cancelado = false;
    const aplicar = async (estado) => {
      const capas = estado?.capasPorZona || estado?.capasPorVista || {};
      await asegurarFuentesDe(capas);
      if (cancelado) return;
      capasRef.current = capas;
      setCapasPorZona(capas);
      const vistaInicial = cfg.vistas.find((v) => v.id === estado?.vistaId) || cfg.vistas[0];
      setVistaId(vistaInicial?.id);
      setZonaId(vistaInicial?.zonas.some((z) => z.id === estado?.zonaId) ? estado.zonaId : vistaInicial?.zonas[0]?.id);
      setColorId(cfg.colores.some((c) => c.id === estado?.colorId) ? estado.colorId : cfg.colores[0]?.id);
      setTalla(cfg.tallas.includes(estado?.talla) ? estado.talla : '');
      setListo(true);
    };
    (async () => {
      if (designIdParam && user) {
        const { data: diseno } = await getDesignById(designIdParam);
        if (diseno && diseno.userId === user.uid && diseno.productId === id) {
          const colorGuardado = cfg.colores.find((c) => c.nombre === diseno.variant?.color || c.id === diseno.color?.id);
          const primeraZona = Object.keys(diseno.layersByView || {})[0];
          const vistaDeZona = cfg.vistas.find((v) => v.zonas.some((z) => z.id === primeraZona));
          return aplicar({
            capasPorZona: diseno.layersByView || {},
            vistaId: vistaDeZona?.id,
            zonaId: primeraZona,
            colorId: colorGuardado?.id,
            talla: diseno.variant?.size,
          });
        }
        setDesignId(null);
      }
      let borrador = null;
      try { borrador = JSON.parse(sessionStorage.getItem(claveBorrador(id)) || 'null'); } catch { /* sin borrador */ }
      return aplicar(borrador);
    })();
    return () => { cancelado = true; };
  }, [cfg, listo, authLoading, designIdParam, user, id]);

  // Las fuentes del selector se cargan en segundo plano para la vista previa.
  useEffect(() => { FUENTES.forEach((f) => { asegurarFuente(f); }); }, []);

  const guardarBorrador = useCallback(() => {
    try {
      sessionStorage.setItem(claveBorrador(id), JSON.stringify({
        vistaId, zonaId, colorId, talla, capasPorZona: capasParaGuardar(capasRef.current),
      }));
    } catch { /* almacenamiento lleno o bloqueado */ }
  }, [id, vistaId, zonaId, colorId, talla]);

  // Borrador de la pestaña: recargar o ir a iniciar sesión no borra el diseño.
  useEffect(() => {
    if (listo) guardarBorrador();
  }, [listo, capasPorZona, guardarBorrador]);

  // ── Capas (agrupadas por zona) ───────────────────────────────────────────
  const modificarCapas = useCallback((zId, fn, reconstruir = false) => {
    const next = { ...capasRef.current, [zId]: fn(capasRef.current[zId] || []) };
    capasRef.current = next;
    setCapasPorZona(next);
    if (reconstruir) setVersion((v) => v + 1);
  }, []);

  const objetoDe = (capaId) => fabricRef.current?.getObjects().find((o) => o.capaId === capaId) || null;

  /** ¿El objeto se sale de su zona? Lo que queda afuera no se imprime. */
  const revisarLimites = useCallback((obj) => {
    const t = obj?.zonaId && transformsRef.current[obj.zonaId];
    setFueraDeZona(Boolean(t) && seSaleDeZona(obj, t));
  }, []);

  /** Cambia propiedades de una capa y las refleja en el lienzo sin redibujar todo. */
  const editarCapa = useCallback((capaId, cambios) => {
    const zId = zonaDe(capaId);
    if (!zId) return;
    modificarCapas(zId, (capas) => capas.map((c) => (c.id === capaId ? { ...c, ...cambios } : c)));
    const obj = objetoDe(capaId);
    const lienzo = fabricRef.current;
    const t = transformsRef.current[zId];
    if (!obj || !lienzo || !t) return;
    let capa = (capasRef.current[zId] || []).find((c) => c.id === capaId);
    if (capa?.type === 'text') {
      obj.set(propiedadesTexto(capa));
      obj.initDimensions?.();
      // Un texto que crece al escribir se achica solo para seguir entrando en la
      // zona. Si está de costado (mangas), su largo se mide contra el alto.
      const deCostado = Math.abs(Math.round((capa.angulo || 0) / 90)) % 2 === 1;
      const [maxAncho, maxAlto] = deCostado ? [t.hu, t.wu] : [t.wu, t.hu];
      const escalaMax = Math.min((maxAncho * 0.96) / (obj.width || 1), (maxAlto * 0.96) / (obj.height || 1));
      if (capa.escalaX > escalaMax) {
        modificarCapas(zId, (capas) => capas.map((c) => (c.id === capaId ? { ...c, escalaX: escalaMax, escalaY: escalaMax } : c)));
        capa = { ...capa, escalaX: escalaMax, escalaY: escalaMax };
      }
    }
    obj.set(ubicacion(capa, t));
    obj.setCoords();
    lienzo.requestRenderAll();
    revisarLimites(obj);
  }, [modificarCapas, revisarLimites]);

  // ── Lienzo (fabric) ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!listo || !canvasElRef.current || fabricRef.current) return undefined;
    const lienzo = new fabric.Canvas(canvasElRef.current, {
      selection: false,
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      allowTouchScrolling: false,
    });
    fabricRef.current = lienzo;
    const alSeleccionar = (e) => {
      const obj = e.selected?.[0];
      setSeleccionId(obj?.capaId || null);
      if (obj?.zonaId) setZonaId(obj.zonaId);
      revisarLimites(obj);
    };
    lienzo.on('selection:created', alSeleccionar);
    lienzo.on('selection:updated', alSeleccionar);
    lienzo.on('selection:cleared', () => { setSeleccionId(null); setFueraDeZona(false); });
    // Tocar una zona vacía la elige: ahí irá lo próximo que se agregue.
    lienzo.on('mouse:down', (e) => {
      if (e.target?.guiaZona) setZonaId(e.target.guiaZona);
    });
    lienzo.on('object:modified', (e) => {
      const obj = e.target;
      const t = obj?.zonaId && transformsRef.current[obj.zonaId];
      if (!obj?.capaId || !t) return;
      const cambios = leerTransformacion(obj, t);
      modificarCapas(obj.zonaId, (capas) => capas.map((c) => (c.id === obj.capaId ? { ...c, ...cambios } : c)));
      revisarLimites(obj);
    });
    return () => {
      lienzo.dispose();
      fabricRef.current = null;
    };
  }, [listo, modificarCapas, revisarLimites]);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return undefined;
    const medir = () => setAnchoLienzo(Math.floor(el.clientWidth));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [listo]);

  /** Marca en el lienzo cuál es la zona elegida, sin redibujar todo. */
  const pintarGuias = useCallback(() => {
    const lienzo = fabricRef.current;
    if (!lienzo) return;
    const oscuro = color && !esColorBlanco(color.hex) && textoSobre(color.hex) === '#FFFFFF';
    lienzo.getObjects().forEach((o) => {
      if (!o.guiaZona) return;
      const activa = o.guiaZona === zonaRef.current;
      o.set({
        stroke: activa
          ? (oscuro ? 'rgba(255,255,255,0.95)' : 'rgba(124,58,237,0.95)')
          : (oscuro ? 'rgba(255,255,255,0.45)' : 'rgba(124,58,237,0.45)'),
        strokeWidth: activa ? 2 : 1.25,
        strokeDashArray: activa ? [7, 4] : [4, 5],
        fill: activa ? (oscuro ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.08)') : 'rgba(0,0,0,0.001)',
      });
    });
    lienzo.requestRenderAll();
  }, [color]);

  useEffect(() => { pintarGuias(); }, [zona?.id, pintarGuias]);

  // Redibuja todo al cambiar de vista, de color, de tamaño o de estructura.
  useEffect(() => {
    const lienzo = fabricRef.current;
    if (!lienzo || !vista || !color || anchoLienzo < 50) return;
    const token = ++tokenRef.current;
    (async () => {
      let img;
      try {
        img = await cargarImagen(fotoDeVista(vista, color));
      } catch {
        if (token === tokenRef.current) toast.error('No pudimos cargar la foto de la prenda.');
        return;
      }
      if (token !== tokenRef.current) return;
      const fuente = requiereTenido(vista, color) ? tintarImagen(img, color.hex) : img;

      const anchoImg = img.naturalWidth;
      const altoImg = img.naturalHeight;
      const proporcion = altoImg / anchoImg;
      // En pantallas bajas se limita el alto para que el lienzo quepa entero.
      const altoMax = Math.max(260, window.innerHeight * (window.innerWidth <= 768 ? 0.5 : 0.78));
      const ancho = Math.min(anchoLienzo, Math.floor(altoMax / proporcion));
      const margen = ancho * 0.04;
      const iw = ancho - margen * 2;
      const ih = iw * proporcion;
      lienzo.setDimensions({ width: ancho, height: Math.round(ih + margen * 2) });
      lienzo.clear();
      lienzo.backgroundColor = null;

      lienzo.add(new fabric.Image(fuente, {
        left: margen, top: margen, scaleX: iw / anchoImg, scaleY: ih / altoImg,
        selectable: false, evented: false, objectCaching: false,
      }));

      // Primero todas las guías (debajo), después los diseños de cada zona.
      const transforms = {};
      vista.zonas.forEach((z) => {
        const t = transformDeZona(z, { ox: margen, oy: margen, iw, ih, anchoImg, altoImg });
        transforms[z.id] = t;
        lienzo.add(rectDeZona(t, { selectable: false, evented: true, hoverCursor: 'pointer', guiaZona: z.id }));
      });
      transformsRef.current = transforms;

      for (const z of vista.zonas) {
        for (const capa of capasRef.current[z.id] || []) {
          let obj;
          try {
            obj = await crearObjeto(capa, transforms[z.id], srcDe);
          } catch {
            continue;
          }
          if (token !== tokenRef.current) return;
          obj.capaId = capa.id;
          obj.zonaId = z.id;
          obj.clipPath = recorteDeZona(transforms[z.id]);
          estilizar(obj);
          lienzo.add(obj);
        }
      }
      if (token !== tokenRef.current) return;
      pintarGuias();
      const sel = objetoDe(seleccionRef.current);
      if (sel) {
        lienzo.setActiveObject(sel);
        revisarLimites(sel);
      }
      lienzo.requestRenderAll();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista?.id, color?.id, anchoLienzo, version, listo]);

  // ── Acciones ─────────────────────────────────────────────────────────────
  const centroDe = (z) => ({ left: UNIDADES_ZONA / 2, top: altoEnUnidades(z) / 2 });

  const agregarTexto = async () => {
    if (!zona) return;
    // En una zona alargada (una manga) el texto va a lo largo, de costado.
    const alargada = altoEnUnidades(zona) > UNIDADES_ZONA * 1.8;
    const capa = {
      id: nuevoId(),
      type: 'text',
      text: 'Tu texto',
      fuente: 'Montserrat',
      color: esColorBlanco(color.hex) || textoSobre(color.hex) !== '#FFFFFF' ? '#111111' : '#FFFFFF',
      tamano: alargada ? 520 : Math.round(Math.min(170, altoEnUnidades(zona) * 0.25)),
      negrita: true,
      cursiva: false,
      escalaX: 1,
      escalaY: 1,
      angulo: alargada ? 90 : 0,
      ...centroDe(zona),
    };
    await asegurarFuente(capa.fuente);
    setSeleccionId(capa.id);
    modificarCapas(zona.id, (capas) => [...capas, capa], true);
  };

  const elegirImagen = () => {
    if (!user) {
      guardarBorrador();
      setPedirLogin(true);
      return;
    }
    inputArchivoRef.current?.click();
  };

  const alElegirArchivo = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo || !zona) return;
    const destino = zona;
    let capaId = null;
    try {
      const { blob, urlLocal, ancho, alto } = await prepararImagenCliente(archivo);
      capaId = nuevoId();
      localSrcRef.current.set(capaId, urlLocal);
      const escala = Math.min((0.8 * UNIDADES_ZONA) / ancho, (0.8 * altoEnUnidades(destino)) / alto);
      const capa = {
        id: capaId, type: 'image', src: '', subiendo: true, anchoNatural: ancho, altoNatural: alto,
        escalaX: escala, escalaY: escala, angulo: 0, flipX: false, ...centroDe(destino),
      };
      setSeleccionId(capaId);
      modificarCapas(destino.id, (capas) => [...capas, capa], true);
      setSubiendo((n) => n + 1);
      try {
        const url = await subirImagenCliente(user.uid, blob);
        modificarCapas(destino.id, (capas) => capas.map((c) => (c.id === capaId ? { ...c, src: url, subiendo: false } : c)));
      } finally {
        setSubiendo((n) => n - 1);
      }
    } catch (err) {
      toast.error(err?.message || 'No pudimos subir tu imagen.');
      if (capaId) modificarCapas(destino.id, (capas) => capas.filter((c) => c.id !== capaId), true);
    }
  };

  const eliminar = useCallback(() => {
    const capaId = seleccionRef.current;
    const zId = capaId && zonaDe(capaId);
    if (!zId) return;
    setSeleccionId(null);
    fabricRef.current?.discardActiveObject();
    modificarCapas(zId, (capas) => capas.filter((c) => c.id !== capaId), true);
  }, [modificarCapas]);

  const duplicar = () => {
    if (!capaSel || !zonaSel) return;
    const copia = { ...capaSel, id: nuevoId(), left: capaSel.left + 40, top: capaSel.top + 40 };
    if (localSrcRef.current.has(capaSel.id)) localSrcRef.current.set(copia.id, localSrcRef.current.get(capaSel.id));
    setSeleccionId(copia.id);
    modificarCapas(zonaSel.id, (capas) => [...capas, copia], true);
  };

  const mover = (haciaAdelante) => {
    if (!capaSel || !zonaSel) return;
    modificarCapas(zonaSel.id, (capas) => {
      const resto = capas.filter((c) => c.id !== capaSel.id);
      return haciaAdelante ? [...resto, capaSel] : [capaSel, ...resto];
    }, true);
  };

  /** Pasa la capa elegida a otra zona de la misma vista (centrada y ajustada). */
  const moverAZona = (destino) => {
    if (!capaSel || !zonaSel || destino.id === zonaSel.id) return;
    const ajuste = capaSel.type === 'image'
      ? Math.min((0.8 * UNIDADES_ZONA) / capaSel.anchoNatural, (0.8 * altoEnUnidades(destino)) / capaSel.altoNatural, capaSel.escalaX)
      : capaSel.escalaX;
    const movida = { ...capaSel, ...centroDe(destino), escalaX: ajuste, escalaY: ajuste, angulo: 0 };
    modificarCapas(zonaSel.id, (capas) => capas.filter((c) => c.id !== capaSel.id));
    modificarCapas(destino.id, (capas) => [...capas, movida], true);
    setZonaId(destino.id);
  };

  const centrar = () => capaSel && zonaSel && editarCapa(capaSel.id, centroDe(zonaSel));

  const ajustarAZona = () => {
    if (!capaSel || capaSel.type !== 'image' || !zonaSel) return;
    const escala = Math.min(UNIDADES_ZONA / capaSel.anchoNatural, altoEnUnidades(zonaSel) / capaSel.altoNatural);
    editarCapa(capaSel.id, { ...centroDe(zonaSel), escalaX: escala, escalaY: escala, angulo: 0 });
  };

  const cambiarFuente = async (fuente) => {
    if (!capaSel) return;
    await asegurarFuente(fuente);
    editarCapa(capaSel.id, { fuente });
  };

  // Supr / Retroceso borran la capa seleccionada (si no se está escribiendo).
  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      if (!seleccionRef.current) return;
      e.preventDefault();
      eliminar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [eliminar]);

  const cambiarVista = (vId) => {
    if (vId === vistaId) return;
    fabricRef.current?.discardActiveObject();
    setSeleccionId(null);
    setVistaId(vId);
    setZonaId(cfg.vistas.find((v) => v.id === vId)?.zonas[0]?.id || null);
  };

  const elegirZona = (zId) => {
    setZonaId(zId);
    // Si hay algo elegido en otra zona, se suelta: lo próximo va a la nueva.
    if (capaSel && zonaSel?.id !== zId) {
      fabricRef.current?.discardActiveObject();
      fabricRef.current?.requestRenderAll();
      setSeleccionId(null);
    }
  };

  // ── Guardar y comprar ────────────────────────────────────────────────────
  const irALogin = () => {
    guardarBorrador();
    navigate('/login', { state: { from: location.pathname + location.search } });
  };

  const renderizarVista = async (v, capas) => {
    const img = await cargarImagen(fotoDeVista(v, color));
    const fuente = requiereTenido(v, color) ? tintarImagen(img, color.hex) : img;
    return renderizarVistaPrevia({
      fuente, anchoImg: img.naturalWidth, altoImg: img.naturalHeight, vista: v, capasPorZona: capas, srcDe,
    });
  };

  const validar = () => {
    if (borrador) {
      toast.info('Es un borrador: publícala para poder comprarla.');
      return false;
    }
    if (!zonasUsadas.length) {
      toast.info('Agrega una imagen o un texto a tu diseño.');
      return false;
    }
    if (!user) {
      guardarBorrador();
      setPedirLogin(true);
      return false;
    }
    if (subiendo > 0) {
      toast.info('Espera a que termine de subir tu imagen.');
      return false;
    }
    return true;
  };

  const datosColor = () => ({ id: color.id, nombre: color.nombre, hex: color.hex });

  const vistasConCapas = (capas) => cfg.vistas.filter((v) => v.zonas.some((z) => capas[z.id]));

  const guardar = async () => {
    if (!validar()) return;
    setProcesando('Guardando tu diseño…');
    try {
      const capas = capasParaGuardar(capasRef.current);
      const primera = vistasConCapas(capas)[0];
      const previa = await renderizarVista(primera, capas);
      const previewUrl = await subirVistaPrevia(user.uid, previa, primera.id);
      const { id: guardadoId, error: err } = await saveDesign(user.uid, {
        designId: designId || undefined,
        productId: prenda.id,
        productName: prenda.name,
        layersByView: capas,
        variant: { size: talla, color: color.nombre },
        tipo: 'crear',
        previewUrl,
        color: datosColor(),
      });
      if (err) throw new Error(err);
      if (guardadoId && guardadoId !== designId) {
        setDesignId(guardadoId);
        navigate(`/crear/${id}?designId=${guardadoId}`, { replace: true });
      }
      toast.success('Diseño guardado en Mis creaciones.');
    } catch (err) {
      toast.error(`No pudimos guardar tu diseño: ${err?.message || err}`);
    } finally {
      setProcesando(null);
    }
  };

  const agregarAlCarrito = async () => {
    if (agotado) return;
    if (tallas.length && !talla) {
      setAvisoTalla(true);
      tallasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast.info('Elige tu talla.');
      return;
    }
    if (!validar()) return;
    try {
      const capas = capasParaGuardar(capasRef.current);
      const archivosImpresion = [];
      const vistasPrevias = [];
      for (const v of vistasConCapas(capas)) {
        const zonasConCapas = v.zonas.filter((z) => capas[z.id]);
        for (const z of zonasConCapas) {
          setProcesando(`Preparando el archivo de impresión (${v.nombre} · ${z.nombre})…`);
          const { blob, dpi } = await renderizarImpresion(capas[z.id], z, srcDe);
          const url = await subirArchivoImpresion(user.uid, blob, z.id);
          archivosImpresion.push({
            vista: z.id, vistaId: v.id, nombre: `${v.nombre} · ${z.nombre}`, url, anchoCm: z.anchoCm, altoCm: z.altoCm, dpi,
          });
        }
        setProcesando(`Preparando la vista previa (${v.nombre})…`);
        const previa = await renderizarVista(v, capas);
        const url = await subirVistaPrevia(user.uid, previa, v.id);
        vistasPrevias.push({ vista: v.id, nombre: v.nombre, url, zonas: zonasConCapas.map((z) => z.id) });
      }

      setProcesando('Agregando al carrito…');
      const usadas = Object.keys(capas);
      const precio = precioPersonalizado(prenda, usadas);
      const { id: guardadoId } = await saveDesign(user.uid, {
        designId: designId || undefined,
        productId: prenda.id,
        productName: prenda.name,
        layersByView: capas,
        variant: { size: talla, color: color.nombre },
        tipo: 'crear',
        previewUrl: vistasPrevias[0]?.url || '',
        color: datosColor(),
      });

      addToCart(
        // Sin variantes: el color y la talla van en la línea, y la foto es la
        // vista previa (las fotos de las variantes son la prenda en blanco).
        { ...prenda, id: prenda.id, variants: [], hasVariants: false, mainImage: vistasPrevias[0]?.url || prenda.mainImage || '' },
        { size: talla, color: color.nombre, colorHex: color.hex },
        {
          tipo: 'crear',
          layersByView: capas,
          vistasUsadas: usadas,
          zonas: usadas.map((zId) => {
            const z = zonaPorId(zId);
            return { id: zId, nombre: z ? `${z.vistaNombre} · ${z.nombre}` : zId };
          }),
          archivosImpresion,
          vistasPrevias,
          color: datosColor(),
          variant: { size: talla, color: color.nombre },
          finalPrice: precio,
          imageURL: vistasPrevias[0]?.url || '',
          designId: guardadoId || designId || '',
          isComboDesign: false,
        },
        1
      );
      try { sessionStorage.removeItem(claveBorrador(id)); } catch { /* nada */ }
      navigate('/carrito');
    } catch (err) {
      toast.error(`No pudimos preparar tu diseño: ${err?.message || err}`);
    } finally {
      setProcesando(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (isLoading || (cfg && !listo && disponible)) {
    return (
      <div className={styles.estado}>
        <Loader2 className={styles.girando} size={28} aria-hidden="true" />
        <p>Preparando tu prenda…</p>
      </div>
    );
  }

  if (error || !prenda || !disponible || !cfg?.vistas.length) {
    return (
      <div className={styles.estado}>
        <h1 className={styles.estadoTitulo}>Esta prenda no está disponible</h1>
        <p>Elige otra para empezar a crear.</p>
        <Link to="/personalizar" className={styles.botonPrincipal}>Ver prendas</Link>
      </div>
    );
  }

  const dpi = capaSel?.type === 'image' && zonaSel ? dpiDeCapa(capaSel, zonaSel) : null;
  const calidad = calidadDeDpi(dpi);
  const base = precioBase(prenda);

  return (
    <div className={styles.studio}>
      <div className={styles.barraSuperior}>
        <Link to="/personalizar" className={styles.volver} aria-label="Volver a las prendas">
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <div className={styles.tituloBloque}>
          <h1 className={styles.titulo}>{prenda.name}</h1>
          <span className={styles.subtitulo}>{color.nombre}{talla ? ` · Talla ${talla}` : ''}</span>
        </div>
        <span className={styles.precioMovil}>{soles(total)}</span>
      </div>

      {borrador && (
        <p className={styles.borrador}>
          Borrador: solo los administradores ven esta prenda. Publícala desde Admin → Productos.
        </p>
      )}

      <div className={styles.cuerpo}>
        <section className={styles.areaLienzo} aria-label="Lienzo de diseño">
          {cfg.vistas.length > 1 && (
            <div className={styles.vistas} role="tablist" aria-label="Vistas de la prenda">
              {cfg.vistas.map((v) => {
                const conDiseno = v.zonas.some((z) => zonasUsadas.includes(z.id));
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={v.id === vista.id}
                    className={`${styles.vistaTab} ${v.id === vista.id ? styles.vistaTabActiva : ''}`}
                    onClick={() => cambiarVista(v.id)}
                  >
                    {v.nombre}
                    {conDiseno && <span className={styles.puntoDiseno} aria-label="con diseño" />}
                  </button>
                );
              })}
            </div>
          )}

          <div ref={contenedorRef} className={styles.lienzoCaja}>
            <canvas ref={canvasElRef} />
          </div>

          <p className={styles.zonaInfo}>
            <Info size={14} aria-hidden="true" />
            {vista.zonas.length > 1
              ? 'Toca una zona punteada para elegir dónde va tu diseño.'
              : `Zona de impresión: ${zona.anchoCm} × ${zona.altoCm} cm`}
          </p>

        </section>

        <aside className={styles.panel}>
          <section className={styles.seccion} aria-label="Agregar al diseño">
            <h2 className={styles.seccionTitulo}>¿Dónde va tu diseño?</h2>
            <div className={styles.zonas} role="radiogroup" aria-label="Zona de impresión">
              {vista.zonas.map((z) => {
                const conDiseno = zonasUsadas.includes(z.id);
                return (
                  <button
                    key={z.id}
                    type="button"
                    role="radio"
                    aria-checked={z.id === zona.id}
                    className={`${styles.zonaChip} ${z.id === zona.id ? styles.zonaChipActiva : ''}`}
                    onClick={() => elegirZona(z.id)}
                  >
                    <span className={styles.zonaNombre}>
                      {z.nombre}
                      {conDiseno && <span className={styles.puntoDiseno} aria-label="con diseño" />}
                    </span>
                    <span className={styles.zonaDetalle}>
                      {z.anchoCm} × {z.altoCm} cm
                      {z.costo > 0 && <span className={styles.costoVista}>+{soles(z.costo)}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className={styles.agregar}>
              <button type="button" className={styles.botonAgregar} onClick={elegirImagen}>
                <ImagePlus size={20} aria-hidden="true" />
                Subir imagen
              </button>
              <button type="button" className={styles.botonAgregar} onClick={agregarTexto}>
                <Type size={20} aria-hidden="true" />
                Agregar texto
              </button>
              <input
                ref={inputArchivoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={alElegirArchivo}
              />
            </div>
            {subiendo > 0 && (
              <p className={styles.subiendo}><Loader2 size={14} className={styles.girando} aria-hidden="true" /> Subiendo tu imagen…</p>
            )}
          </section>
          {capaSel && (
            <section className={`${styles.seccion} ${styles.seccionCapa}`} aria-label="Elemento seleccionado">
              <div className={styles.seccionCabecera}>
                <h2 className={styles.seccionTitulo}>{capaSel.type === 'image' ? 'Imagen' : 'Texto'}</h2>
                <button type="button" className={styles.botonPeligro} onClick={eliminar}>
                  <Trash2 size={16} aria-hidden="true" /> Quitar
                </button>
              </div>

              {fueraDeZona && (
                <div className={`${styles.calidad} ${styles.calidad_regular}`}>
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>Una parte queda fuera de la zona de impresión y no se imprimirá.</span>
                </div>
              )}

              {capaSel.type === 'image' && calidad && (
                <div className={`${styles.calidad} ${styles[`calidad_${calidad}`]}`}>
                  {calidad === 'buena' ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
                  <span>
                    {calidad === 'buena' && 'Buena calidad de impresión.'}
                    {calidad === 'regular' && 'Calidad aceptable. Si la achicas un poco se verá más nítida.'}
                    {calidad === 'baja' && 'Se verá pixelada a este tamaño. Achícala o usa una imagen más grande.'}
                    <small> ({dpi} dpi)</small>
                  </span>
                </div>
              )}

              {capaSel.type === 'text' && (
                <>
                  <textarea
                    className={styles.textoInput}
                    value={capaSel.text}
                    rows={2}
                    maxLength={120}
                    aria-label="Texto"
                    onChange={(e) => editarCapa(capaSel.id, { text: e.target.value })}
                  />
                  <div className={styles.fuentes} role="listbox" aria-label="Tipografía">
                    {FUENTES.map((f) => (
                      <button
                        key={f}
                        type="button"
                        role="option"
                        aria-selected={capaSel.fuente === f}
                        className={`${styles.fuente} ${capaSel.fuente === f ? styles.fuenteActiva : ''}`}
                        style={{ fontFamily: `"${f}", sans-serif` }}
                        onClick={() => cambiarFuente(f)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className={styles.filaTexto}>
                    <div className={styles.coloresTexto} aria-label="Color del texto">
                      {COLORES_TEXTO.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`${styles.muestra} ${capaSel.color === c ? styles.muestraActiva : ''}`}
                          style={{ background: c }}
                          aria-label={`Color ${c}`}
                          onClick={() => editarCapa(capaSel.id, { color: c })}
                        />
                      ))}
                      <label className={styles.muestraLibre} aria-label="Otro color">
                        <input type="color" value={capaSel.color} onChange={(e) => editarCapa(capaSel.id, { color: e.target.value })} />
                      </label>
                    </div>
                    <div className={styles.estilos}>
                      <button
                        type="button"
                        aria-pressed={!!capaSel.negrita}
                        className={`${styles.icono} ${capaSel.negrita ? styles.iconoActivo : ''}`}
                        onClick={() => editarCapa(capaSel.id, { negrita: !capaSel.negrita })}
                        aria-label="Negrita"
                      >
                        <Bold size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-pressed={!!capaSel.cursiva}
                        className={`${styles.icono} ${capaSel.cursiva ? styles.iconoActivo : ''}`}
                        onClick={() => editarCapa(capaSel.id, { cursiva: !capaSel.cursiva })}
                        aria-label="Cursiva"
                      >
                        <Italic size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {zonaSel && vista.zonas.length > 1 && (
                <div className={styles.moverA}>
                  <span>Mover a:</span>
                  {vista.zonas.filter((z) => z.id !== zonaSel.id).map((z) => (
                    <button key={z.id} type="button" className={styles.zonaMini} onClick={() => moverAZona(z)}>
                      {z.nombre}
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.herramientas}>
                <button type="button" className={styles.herramienta} onClick={centrar}><Crosshair size={16} aria-hidden="true" />Centrar</button>
                <button
                  type="button"
                  className={styles.herramienta}
                  onClick={() => editarCapa(capaSel.id, { angulo: (Math.round((capaSel.angulo || 0) / 90) * 90 + 90) % 360 })}
                >
                  <RotateCw size={16} aria-hidden="true" />Girar
                </button>
                {capaSel.type === 'image' && (
                  <>
                    <button type="button" className={styles.herramienta} onClick={ajustarAZona}><Maximize2 size={16} aria-hidden="true" />Llenar zona</button>
                    <button type="button" className={styles.herramienta} onClick={() => editarCapa(capaSel.id, { flipX: !capaSel.flipX })}><FlipHorizontal size={16} aria-hidden="true" />Voltear</button>
                  </>
                )}
                <button type="button" className={styles.herramienta} onClick={() => mover(true)}><ArrowUpToLine size={16} aria-hidden="true" />Adelante</button>
                <button type="button" className={styles.herramienta} onClick={() => mover(false)}><ArrowDownToLine size={16} aria-hidden="true" />Atrás</button>
                <button type="button" className={styles.herramienta} onClick={duplicar}><Copy size={16} aria-hidden="true" />Duplicar</button>
              </div>
            </section>
          )}

          <section className={styles.seccion} aria-label="Color de la prenda">
            <h2 className={styles.seccionTitulo}>Color <span className={styles.valor}>{color.nombre}</span></h2>
            <div className={styles.coloresPrenda}>
              {cfg.colores.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`${styles.colorPrenda} ${c.id === color.id ? styles.colorPrendaActivo : ''}`}
                  style={{ background: c.hex2 ? `linear-gradient(135deg, ${c.hex} 50%, ${c.hex2} 50%)` : c.hex }}
                  aria-label={c.nombre}
                  aria-pressed={c.id === color.id}
                  title={c.nombre}
                  onClick={() => {
                    setColorId(c.id);
                    if (talla && !tallasDeColor(c, cfg).includes(talla)) setTalla('');
                  }}
                />
              ))}
            </div>
          </section>

          {tallas.length > 0 && (
            <section ref={tallasRef} className={styles.seccion} aria-label="Talla">
              <h2 className={styles.seccionTitulo}>
                Talla {talla && <span className={styles.valor}>{talla}</span>}
              </h2>
              <div className={styles.tallas}>
                {tallas.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={t === talla}
                    className={`${styles.talla} ${t === talla ? styles.tallaActiva : ''}`}
                    onClick={() => { setTalla(t); setAvisoTalla(false); }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {avisoTalla && <p className={styles.avisoTalla}>Elige una talla para continuar.</p>}
            </section>
          )}

          <section className={`${styles.seccion} ${styles.resumen}`} aria-label="Resumen de precio">
            <div className={styles.lineaPrecio}><span>{prenda.name}</span><span>{soles(base)}</span></div>
            {zonasPrenda.filter((z) => z.costo > 0 && zonasUsadas.includes(z.id)).map((v) => (
              <div key={v.id} className={styles.lineaPrecio}>
                <span>{v.vistaNombre === v.nombre ? v.nombre : `${v.vistaNombre} · ${v.nombre}`} <small>(costo extra)</small></span>
                <span>+ {soles(v.costo)}</span>
              </div>
            ))}
            <div className={`${styles.lineaPrecio} ${styles.lineaTotal}`}><span>Total</span><span>{soles(total)}</span></div>
          </section>

          <div className={styles.acciones}>
            <button type="button" className={styles.botonSecundario} onClick={guardar} disabled={!!procesando}>
              <Save size={18} aria-hidden="true" />
              Guardar
            </button>
            <button type="button" className={styles.botonPrincipal} onClick={agregarAlCarrito} disabled={!!procesando || agotado}>
              <ShoppingBag size={18} aria-hidden="true" />
              {agotado ? 'Agotado por ahora' : `Agregar al carrito · ${soles(total)}`}
            </button>
          </div>
        </aside>
      </div>

      {procesando && (
        <div className={styles.capaBloqueo} role="status" aria-live="polite">
          <div className={styles.cajaBloqueo}>
            <Loader2 size={28} className={styles.girando} aria-hidden="true" />
            <p>{procesando}</p>
          </div>
        </div>
      )}

      {pedirLogin && (
        <div className={styles.capaBloqueo} role="dialog" aria-modal="true" aria-labelledby="crear-login-titulo" onClick={() => setPedirLogin(false)}>
          <div className={styles.cajaBloqueo} onClick={(e) => e.stopPropagation()}>
            <h2 id="crear-login-titulo" className={styles.estadoTitulo}>Inicia sesión para continuar</h2>
            <p>Así guardamos tus imágenes y tu diseño. Tus textos y elecciones se quedan como los dejaste.</p>
            <button type="button" className={styles.botonPrincipal} onClick={irALogin}>Iniciar sesión</button>
            <button type="button" className={styles.botonTexto} onClick={() => setPedirLogin(false)}>Seguir diseñando</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrearStudioPage;
