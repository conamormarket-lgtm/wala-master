import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fabric } from 'fabric';
import {
  ArrowLeft, ImagePlus, Images, Plus, Type, Trash2, Copy, FlipHorizontal, ArrowUpToLine, ArrowDownToLine,
  Crosshair, Maximize2, RotateCw, Crop, Eraser, Download, Bold, Italic, Save, ShoppingBag, Loader2, AlertTriangle, CheckCircle2, Info, Undo2, Redo2, Keyboard, Clipboard, ClipboardPaste, Pencil,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getPrendaBase } from '../../services/prendasBase';
import { getDesignById, saveDesign, guardarTallaCreacion } from '../../services/designs';
import {
  prepararImagenCliente, subirImagenCliente, subirArchivoImpresion, subirVistaPrevia, recortarImagen,
} from '../../services/crearArchivos';
import {
  UNIDADES_ZONA, leerPrendaBase, precioBase, precioPersonalizado, zonasConDiseno, listarZonas,
  calidadDeCapa, medidaZona, cargarImagen, tintarImagen, fotoDeVista, requiereTenido, textoSobre, esColorBlanco,
  colorDisponible, tallasDeColor, slug,
} from '../../utils/prendaBase';
import {
  FUENTES, asegurarFuente, asegurarFuentesDe, altoEnUnidades, crearObjeto, leerTransformacion,
  propiedadesTexto, renderizarImpresion, renderizarVistaPrevia, componerVistas, transformDeZona, rectDeZona,
  recorteDeZona, seSaleDeZona, ubicacion, desdeLienzo, aLienzo,
} from './renderDiseno';
import RecorteImagen from './RecorteImagen';
import QuitarFondo from './QuitarFondo';
import { itemDeCreacion } from './creacionCarrito';
import AtajosTeclado, { MOD } from './AtajosTeclado';
import MenuContextual from './MenuContextual';
import { registrarGuardado, ponerBorradorEnCache, quitarBorradorDeCache } from './borradoresCache';
import styles from './CrearStudioPage.module.css';

const VIOLETA = '#7C3AED';
// Con mouse se escribe directo sobre la prenda (doble clic). En el celular
// el teclado taparía la prenda: ahí se escribe en el panel.
const CON_MOUSE = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: fine)').matches);
// Distancia (px de pantalla) a la que un diseño se imanta al centro de su zona.
const IMAN_PX = 7;
const COLORES_TEXTO = ['#111111', '#FFFFFF', '#7C3AED', '#E11D48', '#F59E0B', '#10B981', '#2563EB', '#F472B6'];

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
const nuevoId = () => `capa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const claveBorrador = (id) => `crear_borrador_${id}`;

const aDataUrl = (blob) => new Promise((resolve, reject) => {
  const lector = new FileReader();
  lector.onload = () => resolve(lector.result);
  lector.onerror = () => reject(lector.error);
  lector.readAsDataURL(blob);
});
// Marca "vuelve de iniciar sesión": solo entonces (o al recargar) se recupera el borrador.
const claveVolver = (id) => `crear_volver_${id}`;

// ¿Ya se abrió el estudio en esta carga de la página? Solo la primera vista
// puede ser una recarga; luego, entrar a la prenda es empezar de cero.
let estudioAbierto = false;
const recargadaEn = (ruta) => {
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    return nav?.type === 'reload' && new URL(nav.name).pathname === ruta;
  } catch {
    return false;
  }
};

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

/**
 * Firma del diseño, para saber si cambió desde lo último guardado: capas y
 * color. La talla no es parte del diseño (se guarda sola). No cuenta lo que solo dice si una imagen terminó de
 * subirse, ni el orden de los campos, ni un false que equivale a no tenerlo.
 */
const firmaDiseno = (capasPorZona, colorId) => {
  const capas = Object.keys(capasPorZona || {}).sort()
    .filter((zId) => capasPorZona[zId]?.length)
    .map((zId) => [zId, capasPorZona[zId]]);
  return JSON.stringify({ capas, colorId: colorId || null }, (k, v) => {
    if (k === 'src' || k === 'subiendo' || v === false) return undefined;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]]));
    }
    return v;
  });
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
  const [recortando, setRecortando] = useState(null);
  const [quitandoFondo, setQuitandoFondo] = useState(null);
  const [verAtajos, setVerAtajos] = useState(false);
  // Menú del clic derecho: { x, y, capaId } sobre un diseño, o { x, y, zonaId, punto } en la zona.
  const [menu, setMenu] = useState(null);
  const cerrarMenu = useCallback(() => setMenu(null), []);
  const [soltando, setSoltando] = useState(false);
  const [historialInfo, setHistorialInfo] = useState({ puedeDeshacer: false, puedeRehacer: false });
  // Nombre de la creación (se pide al guardar) y aviso de "guardada".
  const [nombre, setNombre] = useState('');
  const [nombreEditado, setNombreEditado] = useState('');
  const [dialogoGuardar, setDialogoGuardar] = useState(false);
  const [guardada, setGuardada] = useState(null);
  // Firma de lo último guardado como creación (null = nunca se guardó).
  const [firmaGuardada, setFirmaGuardada] = useState(null);
  // Borrador en la cuenta: un diseño sin terminar se guarda solo mientras se
  // diseña, y se continúa desde Crear → Tus borradores.
  const [esBorrador, setEsBorrador] = useState(false);
  const [estadoBorrador, setEstadoBorrador] = useState(null);
  const queryClient = useQueryClient();

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
  // Lo del borrador va en refs: el autoguardado corre fuera del render (y
  // puede terminar después de salir del estudio).
  const designIdRef = useRef(designIdParam || null);
  const esBorradorRef = useRef(false);
  const guardandoRef = useRef(false);
  const colaBorradorRef = useRef(Promise.resolve());
  const timerBorradorRef = useRef(null);
  const firmaBorradorRef = useRef(null);
  const autoguardarRef = useRef(null);
  const montadoRef = useRef(true);
  // Talla guardada de la creación abierta (null si no es una creación guardada).
  const tallaGuardadaRef = useRef(null);
  // Deshacer / rehacer, portapapeles de capas y atajos de teclado.
  const historialRef = useRef({ pasado: [], futuro: [], actual: null });
  const restaurandoRef = useRef(false);
  const timerHistorialRef = useRef(null);
  const subidasRef = useRef(new Map());
  const portapapelesRef = useRef(null);
  const atajosRef = useRef(null);
  const alPegarRef = useRef(null);
  // Mouse: acciones que llaman los eventos del lienzo, lo que está bajo el
  // puntero, las guías de centrado y el texto recién creado que se escribe ya.
  const accionesRef = useRef({});
  const hoverRef = useRef(null);
  const guiasRef = useRef([]);
  const editarAlCrearRef = useRef(null);
  const recargadaRef = useRef(null);
  if (recargadaRef.current === null) recargadaRef.current = !estudioAbierto && recargadaEn(location.pathname);
  useEffect(() => { estudioAbierto = true; }, []);

  vistaRef.current = vistaId;
  const zonaDe = (capaId) => Object.keys(capasRef.current)
    .find((zId) => (capasRef.current[zId] || []).some((c) => c.id === capaId)) || null;
  seleccionRef.current = seleccionId;

  const vista = cfg?.vistas.find((v) => v.id === vistaId) || cfg?.vistas[0] || null;
  const zona = vista?.zonas.find((z) => z.id === zonaId) || vista?.zonas[0] || null;
  zonaRef.current = zona?.id || null;
  // Sin elección, la variante principal del producto (no la primera de la lista).
  const colorPrincipal = cfg?.colores.find((c) => c.id === prenda?.defaultVariantId) || cfg?.colores[0] || null;
  const color = cfg?.colores.find((c) => c.id === colorId) || colorPrincipal;
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
  // "Guardar" solo tiene sentido si hay algo nuevo: un diseño sin guardar
  // con contenido, o una creación que cambió desde que se guardó.
  const hayCambios = firmaGuardada === null
    ? zonasUsadas.length > 0
    : firmaDiseno(capasPorZona, color?.id) !== firmaGuardada;
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
      firmaBorradorRef.current = JSON.stringify({ capas: capasParaGuardar(capas), colorId: estado?.colorId, talla: estado?.talla || '' });
      const vistaInicial = cfg.vistas.find((v) => v.id === estado?.vistaId) || cfg.vistas[0];
      setVistaId(vistaInicial?.id);
      setZonaId(vistaInicial?.zonas.some((z) => z.id === estado?.zonaId) ? estado.zonaId : vistaInicial?.zonas[0]?.id);
      const principal = cfg.colores.find((c) => c.id === prenda?.defaultVariantId) || cfg.colores[0];
      const colorInicial = cfg.colores.some((c) => c.id === estado?.colorId) ? estado.colorId : principal?.id;
      const tallaInicial = cfg.tallas.includes(estado?.talla) ? estado.talla : '';
      setColorId(colorInicial);
      setTalla(tallaInicial);
      // Una creación guardada abre "sin cambios": Guardar se activa al cambiar algo.
      setFirmaGuardada(estado?.guardada ? firmaDiseno(capas, colorInicial) : null);
      tallaGuardadaRef.current = estado?.guardada ? tallaInicial : null;
      setListo(true);
    };
    (async () => {
      if (designIdParam && user) {
        const { data: diseno } = await getDesignById(designIdParam);
        if (diseno && diseno.userId === user.uid && diseno.productId === id) {
          const deBorrador = diseno.estado === 'borrador';
          esBorradorRef.current = deBorrador;
          setEsBorrador(deBorrador);
          const colorGuardado = cfg.colores.find((c) => c.nombre === diseno.variant?.color || c.id === diseno.color?.id);
          const primeraZona = Object.keys(diseno.layersByView || {})[0];
          const vistaDeZona = cfg.vistas.find((v) => v.zonas.some((z) => z.id === primeraZona));
          if (!deBorrador) setNombre(diseno.name || '');
          return aplicar({
            capasPorZona: diseno.layersByView || {},
            vistaId: vistaDeZona?.id,
            zonaId: primeraZona,
            colorId: colorGuardado?.id,
            talla: diseno.variant?.size,
            guardada: !deBorrador,
          });
        }
        designIdRef.current = null;
        setDesignId(null);
      }
      // La plantilla se abre limpia. El borrador solo vuelve si el cliente fue
      // a iniciar sesión a mitad del diseño o si recargó la página.
      let borrador = null;
      try {
        const vuelve = sessionStorage.getItem(claveVolver(id)) === '1';
        sessionStorage.removeItem(claveVolver(id));
        if (vuelve || recargadaRef.current) {
          borrador = JSON.parse(sessionStorage.getItem(claveBorrador(id)) || 'null');
        } else {
          sessionStorage.removeItem(claveBorrador(id));
        }
      } catch { /* sin borrador */ }
      return aplicar(borrador);
    })();
    return () => { cancelado = true; };
  }, [cfg, listo, authLoading, designIdParam, user, id]);

  // Las fuentes del selector se cargan en segundo plano para la vista previa.
  useEffect(() => { FUENTES.forEach((f) => { asegurarFuente(f); }); }, []);

  // El borrador es solo para un diseño nuevo sin guardar: una creación ya
  // guardada vive en la cuenta y no debe reaparecer al abrir la plantilla.
  const guardarBorrador = useCallback(() => {
    if (designId) return;
    try {
      sessionStorage.setItem(claveBorrador(id), JSON.stringify({
        vistaId, zonaId, colorId, talla, capasPorZona: capasParaGuardar(capasRef.current),
      }));
    } catch { /* almacenamiento lleno o bloqueado */ }
  }, [id, designId, vistaId, zonaId, colorId, talla]);

  // Borrador de la pestaña: recargar o ir a iniciar sesión no borra el diseño.
  useEffect(() => {
    if (listo) guardarBorrador();
  }, [listo, capasPorZona, guardarBorrador]);

  // En una creación guardada la talla se recuerda sola: no es parte del
  // diseño, así que no hace falta "Guardar" ni volver a generar imágenes.
  useEffect(() => {
    if (!listo || !user || !designId || esBorrador || tallaGuardadaRef.current === null) return;
    if (!talla || talla === tallaGuardadaRef.current) return;
    tallaGuardadaRef.current = talla;
    guardarTallaCreacion(designId, talla).then(({ error }) => {
      if (error) toast.error('No pudimos guardar la talla.');
      else queryClient.removeQueries({ queryKey: ['creacion', designId] });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talla]);

  // Con sesión, el diseño sin terminar se guarda en la cuenta unos segundos
  // después de cada cambio (y al salir del estudio, si quedó algo pendiente).
  useEffect(() => {
    if (!listo || !user) return;
    clearTimeout(timerBorradorRef.current);
    timerBorradorRef.current = setTimeout(() => {
      timerBorradorRef.current = null;
      autoguardarRef.current?.();
    }, 2000);
  }, [listo, user, capasPorZona, colorId, talla]);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      if (timerBorradorRef.current) {
        clearTimeout(timerBorradorRef.current);
        timerBorradorRef.current = null;
        autoguardarRef.current?.();
      }
    };
  }, []);

  // ── Deshacer / rehacer ───────────────────────────────────────────────────
  // Cada cambio del diseño es un paso; los que llegan seguidos (escribir,
  // mover con las flechas) se agrupan. Que una imagen termine de subirse no
  // cuenta: solo cambia su dirección, no el diseño.
  const firmaHistorial = (capas) => JSON.stringify(capas, (k, v) => (k === 'src' || k === 'subiendo' ? undefined : v));

  const actualizarHistorialInfo = () => {
    const h = historialRef.current;
    if (montadoRef.current) setHistorialInfo({ puedeDeshacer: h.pasado.length > 0, puedeRehacer: h.futuro.length > 0 });
  };

  const asentarHistorial = () => {
    clearTimeout(timerHistorialRef.current);
    timerHistorialRef.current = null;
    const h = historialRef.current;
    const ahora = capasRef.current;
    if (h.actual === null || firmaHistorial(ahora) === firmaHistorial(h.actual)) {
      h.actual = ahora;
      return;
    }
    h.pasado.push(h.actual);
    if (h.pasado.length > 80) h.pasado.shift();
    h.futuro = [];
    h.actual = ahora;
    actualizarHistorialInfo();
  };
  const asentarRef = useRef(null);
  asentarRef.current = asentarHistorial;

  useEffect(() => {
    if (!listo) return;
    if (restaurandoRef.current) {
      restaurandoRef.current = false;
      return;
    }
    if (historialRef.current.actual === null) {
      historialRef.current.actual = capasRef.current;
      return;
    }
    clearTimeout(timerHistorialRef.current);
    timerHistorialRef.current = setTimeout(() => asentarRef.current?.(), 400);
  }, [listo, capasPorZona]);

  useEffect(() => () => clearTimeout(timerHistorialRef.current), []);

  /** Vuelve a un paso del historial (con las imágenes que ya terminaron de subir). */
  const restaurar = (capas) => {
    const listas = Object.fromEntries(Object.entries(capas).map(([zId, lista]) => [zId, lista.map((c) => {
      if (c.type !== 'image' || (c.src && !c.subiendo)) return c;
      const url = subidasRef.current.get(c.id);
      return url ? { ...c, src: url, subiendo: false } : c;
    })]));
    restaurandoRef.current = true;
    capasRef.current = listas;
    setCapasPorZona(listas);
    historialRef.current.actual = listas;
    const sel = seleccionRef.current;
    if (sel && !Object.values(listas).some((l) => l.some((c) => c.id === sel))) {
      fabricRef.current?.discardActiveObject();
      setSeleccionId(null);
    }
    setVersion((v) => v + 1);
    actualizarHistorialInfo();
  };

  const deshacer = () => {
    asentarHistorial();
    const h = historialRef.current;
    if (!h.pasado.length) return;
    h.futuro.push(h.actual);
    restaurar(h.pasado.pop());
  };

  const rehacer = () => {
    asentarHistorial();
    const h = historialRef.current;
    if (!h.futuro.length) return;
    h.pasado.push(h.actual);
    restaurar(h.futuro.pop());
  };

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
      const props = propiedadesTexto(capa);
      // Mientras se escribe sobre la prenda, el texto ya está en el objeto.
      if (obj.isEditing) delete props.text;
      obj.set(props);
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
      fireRightClick: true,
      stopContextMenu: true,
    });
    fabricRef.current = lienzo;
    // fabric guarda la posición del lienzo en la página al crearse. Si algo de
    // arriba cambia de alto (o en el celular se desplaza el panel), los toques
    // caen desfasados: se recalcula justo antes de que fabric los procese.
    const contenedor = lienzo.wrapperEl;
    const recalcular = () => lienzo.calcOffset();
    ['mousedown', 'touchstart', 'pointerdown'].forEach((tipo) => contenedor.addEventListener(tipo, recalcular, true));
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
    // ── Mouse ──
    // Clic derecho: menú. Doble clic: escribir, recortar o texto nuevo.
    lienzo.on('mouse:down', (e) => { if (e.button === 3) accionesRef.current.abrirMenu?.(e); });
    lienzo.on('mouse:dblclick', (e) => accionesRef.current.dobleClic?.(e));
    // Ctrl + rueda (o pellizcar en el trackpad) cambia el tamaño de lo elegido.
    lienzo.on('mouse:wheel', (e) => {
      const ev = e.e;
      if (!(ev.ctrlKey || ev.metaKey) || !lienzo.getActiveObject()?.capaId) return;
      ev.preventDefault();
      ev.stopPropagation();
      accionesRef.current.escalar?.(ev.deltaY < 0 ? 1.05 : 1 / 1.05);
    });
    // Contorno de lo que está bajo el puntero (se ve qué se va a elegir).
    lienzo.on('mouse:over', (e) => {
      if (!e.target?.capaId) return;
      hoverRef.current = e.target;
      lienzo.requestRenderAll();
    });
    lienzo.on('mouse:out', (e) => {
      if (!e.target || e.target !== hoverRef.current) return;
      hoverRef.current = null;
      lienzo.requestRenderAll();
    });
    // Imán al centro de la zona al arrastrar (Alt lo desactiva).
    lienzo.on('object:moving', (e) => {
      const obj = e.target;
      const t = obj?.zonaId && transformsRef.current[obj.zonaId];
      guiasRef.current = [];
      if (!t || e.e?.altKey) return;
      const p = desdeLienzo(t, obj.left, obj.top);
      const tol = IMAN_PX / t.k;
      let { left, top } = p;
      if (Math.abs(left - t.wu / 2) < tol) {
        left = t.wu / 2;
        guiasRef.current.push([aLienzo(t, t.wu / 2, 0), aLienzo(t, t.wu / 2, t.hu)]);
      }
      if (Math.abs(top - t.hu / 2) < tol) {
        top = t.hu / 2;
        guiasRef.current.push([aLienzo(t, 0, t.hu / 2), aLienzo(t, t.wu, t.hu / 2)]);
      }
      if (guiasRef.current.length) {
        const q = aLienzo(t, left, top);
        obj.set({ left: q.x, top: q.y });
        obj.setCoords();
      }
    });
    // Al girar se imanta a 0°, 90°, 180°… y con Shift va de 15° en 15°.
    lienzo.on('object:rotating', (e) => {
      const obj = e.target;
      const base = (obj?.zonaId && transformsRef.current[obj.zonaId]?.ang) || 0;
      const rel = obj.angle - base;
      const paso = e.e?.shiftKey ? 15 : 90;
      const cerca = Math.round(rel / paso) * paso;
      if (e.e?.shiftKey || Math.abs(rel - cerca) < 4) obj.set({ angle: cerca + base });
    });
    lienzo.on('mouse:up', () => {
      if (!guiasRef.current.length) return;
      guiasRef.current = [];
      lienzo.requestRenderAll();
    });
    lienzo.on('after:render', ({ ctx }) => {
      const h = hoverRef.current;
      const hayHover = h && h !== lienzo.getActiveObject() && lienzo.getObjects().includes(h);
      if (!hayHover && !guiasRef.current.length) return;
      ctx.save();
      if (hayHover) {
        const pts = h.getCoords(true, true);
        ctx.strokeStyle = VIOLETA;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        pts.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
        ctx.closePath();
        ctx.stroke();
      }
      ctx.strokeStyle = '#EC4899';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      guiasRef.current.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
      ctx.restore();
    });
    // Escribir sobre la prenda: cada letra va a la capa (y al panel).
    lienzo.on('text:changed', (e) => {
      if (!e.target?.capaId) return;
      editarCapa(e.target.capaId, { text: e.target.text });
      accionesRef.current.mantenerEnZona?.(e.target.capaId);
    });
    // Un texto que quedó vacío al terminar de escribir se quita.
    lienzo.on('text:editing:exited', (e) => {
      const obj = e.target;
      if (obj?.capaId && !obj.text.trim()) accionesRef.current.quitarCapa?.(obj.capaId);
    });
    lienzo.on('object:modified', (e) => {
      const obj = e.target;
      const t = obj?.zonaId && transformsRef.current[obj.zonaId];
      if (!obj?.capaId || !t) return;
      const dentro = (tz) => {
        const p = desdeLienzo(tz, obj.left, obj.top);
        return p.left >= 0 && p.top >= 0 && p.left <= tz.wu && p.top <= tz.hu;
      };
      // Si el centro quedó sobre otra zona, el diseño pasa a esa zona.
      if (!dentro(t)) {
        const otra = Object.entries(transformsRef.current).find(([zId, tz]) => zId !== obj.zonaId && dentro(tz));
        if (otra) {
          const [destinoId, tz] = otra;
          const capa = (capasRef.current[obj.zonaId] || []).find((c) => c.id === obj.capaId);
          if (capa) {
            const movida = { ...capa, ...leerTransformacion(obj, tz) };
            // Llega con el tamaño que tenía en pantalla: se ajusta a la zona
            // nueva para que no quede recortado (en una manga, a lo largo).
            if (capa.type === 'text' && tz.hu > tz.wu * 1.8) movida.angulo = 90;
            const deCostado = Math.abs(Math.round((movida.angulo || 0) / 90)) % 2 === 1;
            const [maxAncho, maxAlto] = deCostado ? [tz.hu, tz.wu] : [tz.wu, tz.hu];
            const escalaMax = Math.min((maxAncho * 0.9) / (obj.width || 1), (maxAlto * 0.9) / (obj.height || 1));
            if (Math.abs(movida.escalaX) > escalaMax) {
              movida.escalaX = escalaMax * Math.sign(movida.escalaX || 1);
              movida.escalaY = escalaMax;
              movida.left = tz.wu / 2;
              movida.top = tz.hu / 2;
            }
            modificarCapas(obj.zonaId, (capas) => capas.filter((c) => c.id !== obj.capaId));
            modificarCapas(destinoId, (capas) => [...capas, movida], true);
            setZonaId(destinoId);
            return;
          }
        }
      }
      const cambios = leerTransformacion(obj, t);
      modificarCapas(obj.zonaId, (capas) => capas.map((c) => (c.id === obj.capaId ? { ...c, ...cambios } : c)));
      revisarLimites(obj);
    });
    return () => {
      ['mousedown', 'touchstart', 'pointerdown'].forEach((tipo) => contenedor.removeEventListener(tipo, recalcular, true));
      lienzo.dispose();
      fabricRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // clear() suelta la selección (y avisa "selection:cleared"): se recuerda
      // cuál estaba elegida para volver a elegirla al terminar.
      const elegida = seleccionRef.current;
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
            obj = await crearObjeto(capa, transforms[z.id], srcDe, { editable: CON_MOUSE });
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
      const sel = objetoDe(elegida);
      if (sel) {
        lienzo.setActiveObject(sel);
        revisarLimites(sel);
        // Texto recién creado con el mouse o con T: se escribe de una vez.
        if (editarAlCrearRef.current === sel.capaId && sel.enterEditing) {
          accionesRef.current.mantenerEnZona?.(sel.capaId);
          sel.enterEditing();
          sel.selectAll();
        }
      }
      editarAlCrearRef.current = null;
      hoverRef.current = null;
      lienzo.requestRenderAll();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista?.id, color?.id, anchoLienzo, version, listo]);

  // ── Acciones ─────────────────────────────────────────────────────────────
  const centroDe = (z) => ({ left: UNIDADES_ZONA / 2, top: altoEnUnidades(z) / 2 });

  /**
   * Agrega un texto. Por defecto en el centro de la zona elegida; con
   * `zonaId`/`punto` donde se hizo doble clic. Con `editar`, en escritorio
   * queda listo para escribir sobre la prenda.
   */
  const agregarTexto = async (textoInicial, { zonaId: zonaDestino, punto, editar = false } = {}) => {
    const destino = (zonaDestino && vista?.zonas.find((z) => z.id === zonaDestino)) || zona;
    if (!destino) return;
    // En una zona alargada (una manga) el texto va a lo largo, de costado.
    const alargada = altoEnUnidades(destino) > UNIDADES_ZONA * 1.8;
    const capa = {
      id: nuevoId(),
      type: 'text',
      text: typeof textoInicial === 'string' && textoInicial ? textoInicial : 'Tu texto',
      fuente: 'Montserrat',
      color: esColorBlanco(color.hex) || textoSobre(color.hex) !== '#FFFFFF' ? '#111111' : '#FFFFFF',
      tamano: alargada ? 520 : Math.round(Math.min(170, altoEnUnidades(destino) * 0.25)),
      negrita: true,
      cursiva: false,
      escalaX: 1,
      escalaY: 1,
      angulo: alargada ? 90 : 0,
      ...(punto
        ? {
          left: Math.min(UNIDADES_ZONA, Math.max(0, punto.left)),
          top: Math.min(altoEnUnidades(destino), Math.max(0, punto.top)),
        }
        : centroDe(destino)),
    };
    await asegurarFuente(capa.fuente);
    if (editar && CON_MOUSE) editarAlCrearRef.current = capa.id;
    if (destino.id !== zona?.id) setZonaId(destino.id);
    setSeleccionId(capa.id);
    modificarCapas(destino.id, (capas) => [...capas, capa], true);
  };

  /** Entra a escribir un texto directo sobre la prenda. */
  const escribirEnLienzo = (capaId) => {
    const obj = objetoDe(capaId);
    const lienzo = fabricRef.current;
    if (!obj?.enterEditing || !lienzo) return;
    lienzo.setActiveObject(obj);
    obj.enterEditing();
    obj.selectAll();
    lienzo.requestRenderAll();
  };

  const elegirImagen = () => {
    if (!user) {
      guardarBorrador();
      setPedirLogin(true);
      return;
    }
    inputArchivoRef.current?.click();
  };

  const alElegirArchivo = (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (archivo) subirArchivo(archivo);
  };

  /** Agrega una imagen a la zona elegida: del botón, arrastrada al lienzo o pegada. */
  const subirArchivo = async (archivo) => {
    if (!zona) return;
    if (!user) {
      guardarBorrador();
      setPedirLogin(true);
      return;
    }
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
        subidasRef.current.set(capaId, url);
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
    if (capaSel.subiendo) {
      toast.info('Espera a que termine de subir la imagen.');
      return;
    }
    const copia = { ...capaSel, id: nuevoId(), left: capaSel.left + 40, top: capaSel.top + 40 };
    if (localSrcRef.current.has(capaSel.id)) localSrcRef.current.set(copia.id, localSrcRef.current.get(capaSel.id));
    setSeleccionId(copia.id);
    modificarCapas(zonaSel.id, (capas) => [...capas, copia], true);
  };

  /** Copia la capa elegida (Ctrl+C). Devuelve si había algo que copiar. */
  const copiar = () => {
    if (!capaSel || !zonaSel) return false;
    if (capaSel.subiendo) {
      toast.info('Espera a que termine de subir la imagen.');
      return true;
    }
    portapapelesRef.current = { capa: { ...capaSel }, zonaId: zonaSel.id, src: localSrcRef.current.get(capaSel.id) };
    return true;
  };

  /** Pega la capa copiada en la zona elegida: corrida si es la misma zona, centrada si es otra. */
  const pegar = () => {
    const pp = portapapelesRef.current;
    if (!pp || !zona) return;
    let copia = { ...pp.capa, id: nuevoId() };
    if (pp.zonaId === zona.id) {
      copia = { ...copia, left: copia.left + 40, top: copia.top + 40 };
      // Pegar otra vez sigue corriéndola, como en cualquier editor.
      pp.capa = copia;
    } else {
      const ajuste = copia.type === 'image'
        ? Math.min((0.8 * UNIDADES_ZONA) / copia.anchoNatural, (0.8 * altoEnUnidades(zona)) / copia.altoNatural, copia.escalaX)
        : copia.escalaX;
      const alargada = altoEnUnidades(zona) > UNIDADES_ZONA * 1.8;
      copia = {
        ...copia, ...centroDe(zona), escalaX: ajuste, escalaY: ajuste,
        angulo: copia.type === 'text' && alargada ? 90 : copia.angulo,
      };
    }
    if (pp.src) localSrcRef.current.set(copia.id, pp.src);
    setSeleccionId(copia.id);
    modificarCapas(zona.id, (capas) => [...capas, copia], true);
    if (copia.type === 'text') setTimeout(() => editarCapa(copia.id, {}), 400);
  };

  /** La capa elegida tal como está ahora (no la del último render). */
  const capaActual = () => {
    const capaId = seleccionRef.current;
    const zId = capaId && zonaDe(capaId);
    return zId ? (capasRef.current[zId] || []).find((c) => c.id === capaId) || null : null;
  };

  const desplazar = (dx, dy) => {
    const capa = capaActual();
    if (capa) editarCapa(capa.id, { left: capa.left + dx, top: capa.top + dy });
  };

  const escalar = (factor) => {
    const capa = capaActual();
    if (!capa) return;
    const escalaX = Math.max(0.01, capa.escalaX * factor);
    editarCapa(capa.id, { escalaX, escalaY: Math.max(0.01, capa.escalaY * factor) });
  };

  const girar = (sentido = 1) => {
    const capa = capaActual();
    if (capa) editarCapa(capa.id, { angulo: (Math.round((capa.angulo || 0) / 90) * 90 + 90 * sentido + 360) % 360 });
  };

  const soltarSeleccion = () => {
    fabricRef.current?.discardActiveObject();
    fabricRef.current?.requestRenderAll();
    setSeleccionId(null);
  };

  const mover = (haciaAdelante) => {
    if (!capaSel || !zonaSel) return;
    modificarCapas(zonaSel.id, (capas) => {
      const resto = capas.filter((c) => c.id !== capaSel.id);
      return haciaAdelante ? [...resto, capaSel] : [capaSel, ...resto];
    }, true);
  };

  /** Pasa la capa elegida a otra zona, de esta vista o de otra (centrada y ajustada). */
  const moverAZona = (destino) => {
    if (!capaSel || !zonaSel || destino.id === zonaSel.id) return;
    const ajuste = capaSel.type === 'image'
      ? Math.min((0.8 * UNIDADES_ZONA) / capaSel.anchoNatural, (0.8 * altoEnUnidades(destino)) / capaSel.altoNatural, capaSel.escalaX)
      : capaSel.escalaX;
    const alargada = altoEnUnidades(destino) > UNIDADES_ZONA * 1.8;
    const movida = {
      ...capaSel, ...centroDe(destino), escalaX: ajuste, escalaY: ajuste,
      angulo: capaSel.type === 'text' && alargada ? 90 : 0,
    };
    modificarCapas(zonaSel.id, (capas) => capas.filter((c) => c.id !== capaSel.id));
    modificarCapas(destino.id, (capas) => [...capas, movida]);
    if (destino.vistaId && destino.vistaId !== vista.id) setVistaId(destino.vistaId);
    setZonaId(destino.id);
    // Un texto que pasa a una zona más chica se ajusta para entrar.
    setTimeout(() => { if (movida.type === 'text') editarCapa(movida.id, {}); }, 400);
    setVersion((v) => v + 1);
  };

  const centrar = () => capaSel && zonaSel && editarCapa(capaSel.id, centroDe(zonaSel));

  /**
   * Reemplaza la imagen de una capa por una nueva hecha a partir de ella
   * (recortada o sin fondo). `corte` es lo que quedó, en píxeles de la
   * imagen anterior, y `factor` cuántos píxeles nuevos hay por cada uno de
   * antes. Lo que quedó conserva su tamaño y su lugar en la prenda.
   */
  const reemplazarImagen = async (capa, { blob, ancho, alto, corte, factor = 1 }) => {
    const zId = zonaDe(capa.id);
    if (!zId) return;
    try {
      const anchoAntes = capa.anchoNatural;
      const altoAntes = capa.altoNatural;
      const dx = (corte.x + corte.w / 2 - anchoAntes / 2) * capa.escalaX * (capa.flipX ? -1 : 1);
      const dy = (corte.y + corte.h / 2 - altoAntes / 2) * capa.escalaY;
      const giro = ((capa.angulo || 0) * Math.PI) / 180;
      const cambios = {
        anchoNatural: ancho,
        altoNatural: alto,
        escalaX: capa.escalaX / factor,
        escalaY: capa.escalaY / factor,
        left: capa.left + dx * Math.cos(giro) - dy * Math.sin(giro),
        top: capa.top + dx * Math.sin(giro) + dy * Math.cos(giro),
        src: '',
        subiendo: true,
      };
      // Id nuevo: la imagen anterior sigue intacta en el historial (deshacer).
      const nuevaId = nuevoId();
      localSrcRef.current.set(nuevaId, URL.createObjectURL(blob));
      if (seleccionRef.current === capa.id) setSeleccionId(nuevaId);
      modificarCapas(zId, (capas) => capas.map((c) => (c.id === capa.id ? { ...c, ...cambios, id: nuevaId } : c)), true);
      setSubiendo((n) => n + 1);
      try {
        const url = await subirImagenCliente(user.uid, blob);
        subidasRef.current.set(nuevaId, url);
        modificarCapas(zId, (capas) => capas.map((c) => (c.id === nuevaId ? { ...c, src: url, subiendo: false } : c)));
      } finally {
        setSubiendo((n) => n - 1);
      }
    } catch (err) {
      toast.error(err?.message || 'No pudimos cambiar la imagen.');
    }
  };

  const aplicarRecorte = async (capa, corte) => {
    setRecortando(null);
    if (!corte) return;
    try {
      const img = await cargarImagen(srcDe(capa));
      // El recorte se mide en la imagen tal como se cargó (igual a anchoNatural).
      const escala = capa.anchoNatural / img.naturalWidth;
      const { blob, ancho, alto } = await recortarImagen(img, corte);
      await reemplazarImagen(capa, {
        blob, ancho, alto, factor: 1 / escala,
        corte: { x: corte.x * escala, y: corte.y * escala, w: corte.w * escala, h: corte.h * escala },
      });
    } catch (err) {
      toast.error(err?.message || 'No pudimos recortar la imagen.');
    }
  };

  const aplicarSinFondo = async (capa, resultado) => {
    setQuitandoFondo(null);
    if (!resultado) return;
    const img = await cargarImagen(srcDe(capa)).catch(() => null);
    // `corte` y `factor` vienen en píxeles de la imagen cargada.
    const escala = img ? capa.anchoNatural / img.naturalWidth : 1;
    const { corte, factor } = resultado;
    await reemplazarImagen(capa, {
      ...resultado,
      factor: factor / escala,
      corte: { x: corte.x * escala, y: corte.y * escala, w: corte.w * escala, h: corte.h * escala },
    });
  };

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

  // ── Atajos de teclado (escritorio) ───────────────────────────────────────
  // La lista completa está en AtajosTeclado.jsx (se abre con "?").
  useEffect(() => {
    const alTeclear = (e) => atajosRef.current?.(e);
    const alPegar = (e) => alPegarRef.current?.(e);
    window.addEventListener('keydown', alTeclear);
    window.addEventListener('paste', alPegar);
    return () => {
      window.removeEventListener('keydown', alTeclear);
      window.removeEventListener('paste', alPegar);
    };
  }, []);

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
    try { sessionStorage.setItem(claveVolver(id), '1'); } catch { /* almacenamiento bloqueado */ }
    navigate('/login', { state: { from: location.pathname + location.search } });
  };

  /** Todas las vistas de la prenda (con o sin diseño) en una sola imagen. */
  const imagenConjunta = async (capas, previasHechas = {}) => {
    const piezas = [];
    for (const v of cfg.vistas) {
      piezas.push({ nombre: v.nombre, blob: previasHechas[v.id] || await renderizarVista(v, capas) });
    }
    // Sin la talla: no se ve en la prenda y puede cambiar en cada compra.
    return componerVistas(piezas, { titulo: `${prenda.name} · ${color.nombre}` });
  };

  const descargarImagen = async () => {
    if (!zonasUsadas.length) {
      toast.info('Agrega una imagen o un texto a tu diseño.');
      return;
    }
    setProcesando('Preparando tu imagen…');
    try {
      // Incluye las imágenes que aún se están subiendo: se pintan desde el equipo.
      const capas = Object.fromEntries(Object.entries(capasRef.current).filter(([, c]) => c?.length));
      const blob = await imagenConjunta(capas);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `${slug(`${prenda.name} ${color.nombre}`)}-diseno.jpg`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      toast.error(`No pudimos preparar la imagen: ${err?.message || err}`);
    } finally {
      setProcesando(null);
    }
  };

  const renderizarVista = async (v, capas, ancho) => {
    const img = await cargarImagen(fotoDeVista(v, color));
    const fuente = requiereTenido(v, color) ? tintarImagen(img, color.hex) : img;
    return renderizarVistaPrevia({
      fuente, anchoImg: img.naturalWidth, altoImg: img.naturalHeight, vista: v, capasPorZona: capas, srcDe,
      ...(ancho && { ancho }),
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

  const nombrePorDefecto = () => `${prenda.name} ${color.nombre}`;

  /**
   * Genera todo lo de una creación: un archivo de impresión por zona con
   * diseño, una vista previa por lado y la imagen con todos los lados.
   */
  const generarArchivos = async (capas) => {
    const archivosImpresion = [];
    const vistasPrevias = [];
    const blobsPrevias = {};
    for (const v of vistasConCapas(capas)) {
      const zonasConCapas = v.zonas.filter((z) => capas[z.id]);
      for (const z of zonasConCapas) {
        setProcesando(`Preparando el archivo de impresión (${v.nombre} · ${z.nombre})…`);
        const medida = medidaZona(z, v);
        const { blob, ancho, alto } = await renderizarImpresion(capas[z.id], z, srcDe, medida);
        const url = await subirArchivoImpresion(user.uid, blob, z.id);
        archivosImpresion.push({
          vista: z.id, vistaId: v.id, nombre: `${v.nombre} · ${z.nombre}`, url, ancho, alto,
          ...(medida && { anchoCm: medida.anchoCm, altoCm: medida.altoCm }),
        });
      }
      setProcesando(`Preparando la vista previa (${v.nombre})…`);
      const previa = await renderizarVista(v, capas);
      blobsPrevias[v.id] = previa;
      const url = await subirVistaPrevia(user.uid, previa, v.id);
      vistasPrevias.push({ vista: v.id, nombre: v.nombre, url, zonas: zonasConCapas.map((z) => z.id) });
    }
    setProcesando('Uniendo las vistas…');
    const conjunta = await imagenConjunta(capas, blobsPrevias);
    const imagenConjuntaUrl = await subirVistaPrevia(user.uid, conjunta, 'conjunto');
    return { archivosImpresion, vistasPrevias, imagenConjunta: imagenConjuntaUrl };
  };

  /**
   * Guarda el diseño sin terminar como borrador en la cuenta. Solo un diseño
   * nuevo o un borrador: una creación ya guardada se actualiza con "Guardar",
   * que vuelve a generar sus archivos. Las llamadas van en cola para no
   * crear dos borradores a la vez.
   */
  const autoguardar = () => {
    colaBorradorRef.current = colaBorradorRef.current.then(async () => {
      if (!user || !prenda || !color || guardandoRef.current) return;
      if (designIdRef.current && !esBorradorRef.current) return;
      const capas = capasParaGuardar(capasRef.current);
      // Sin nada diseñado todavía no hay borrador que guardar.
      if (!designIdRef.current && !Object.keys(capas).length) return;
      const firma = JSON.stringify({ capas, colorId: color.id, talla });
      if (firma === firmaBorradorRef.current) return;
      if (montadoRef.current) setEstadoBorrador('guardando');
      let miniatura = '';
      try {
        const v = cfg.vistas.find((x) => x.zonas.some((z) => capas[z.id])) || cfg.vistas[0];
        miniatura = await aDataUrl(await renderizarVista(v, capas, 360));
      } catch { /* sin miniatura */ }
      if (guardandoRef.current) {
        if (montadoRef.current) setEstadoBorrador(null);
        return;
      }
      const datos = {
        productId: prenda.id,
        productName: prenda.name,
        name: nombrePorDefecto(),
        layersByView: capas,
        variant: { size: talla, color: color.nombre },
        tipo: 'crear',
        estado: 'borrador',
        color: datosColor(),
        miniatura,
      };
      // La lista de borradores se ve al día al instante (por si el cliente
      // ya retrocedió), sin esperar a que Firestore termine.
      if (designIdRef.current) ponerBorradorEnCache(queryClient, user.uid, { id: designIdRef.current, userId: user.uid, ...datos });
      const { id: guardadoId, error: err } = await saveDesign(user.uid, { designId: designIdRef.current || undefined, ...datos });
      if (err) throw new Error(err);
      firmaBorradorRef.current = firma;
      ponerBorradorEnCache(queryClient, user.uid, { id: guardadoId || designIdRef.current, userId: user.uid, ...datos });
      queryClient.invalidateQueries({ queryKey: ['mis-borradores-crear'], refetchType: 'all' });
      if (!designIdRef.current && guardadoId) {
        designIdRef.current = guardadoId;
        esBorradorRef.current = true;
        if (montadoRef.current) {
          setDesignId(guardadoId);
          setEsBorrador(true);
          // Recargar la página reabre este mismo borrador.
          navigate(`/crear/${id}?designId=${guardadoId}`, { replace: true });
        }
      }
      if (montadoRef.current) setEstadoBorrador('guardado');
    }).catch(() => {
      if (montadoRef.current) setEstadoBorrador('error');
    });
    registrarGuardado(colaBorradorRef.current);
    return colaBorradorRef.current;
  };
  autoguardarRef.current = autoguardar;

  /** Termina un autoguardado pendiente (antes de guardar o de empezar otro). */
  const terminarBorrador = async () => {
    if (timerBorradorRef.current) {
      clearTimeout(timerBorradorRef.current);
      timerBorradorRef.current = null;
      if (!guardandoRef.current) autoguardar();
    }
    await colaBorradorRef.current;
  };

  const empezarNuevo = async () => {
    await terminarBorrador();
    try { sessionStorage.removeItem(claveBorrador(id)); } catch { /* nada */ }
    window.location.assign(`/crear/${id}`);
  };

  /**
   * Genera y guarda la creación del cliente (en su cuenta, no en la
   * plantilla). Si venía de un borrador, el borrador pasa a ser la creación.
   */
  const guardarCreacion = async (nombreCreacion) => {
    await terminarBorrador();
    guardandoRef.current = true;
    try {
      return await generarYGuardar(nombreCreacion);
    } finally {
      guardandoRef.current = false;
    }
  };

  const generarYGuardar = async (nombreCreacion) => {
    const designIdActual = designIdRef.current;
    const capas = capasParaGuardar(capasRef.current);
    const archivos = await generarArchivos(capas);
    setProcesando('Guardando tu creación…');
    const creacion = {
      designId: designIdActual || undefined,
      productId: prenda.id,
      productName: prenda.name,
      name: (nombreCreacion || '').trim() || nombrePorDefecto(),
      layersByView: capas,
      variant: { size: talla, color: color.nombre },
      tipo: 'crear',
      estado: 'guardada',
      miniatura: '',
      previewUrl: archivos.imagenConjunta,
      color: datosColor(),
      ...archivos,
    };
    const { id: guardadoId, error: err } = await saveDesign(user.uid, creacion);
    if (err) throw new Error(err);
    const idFinal = guardadoId || designIdActual;
    designIdRef.current = idFinal;
    esBorradorRef.current = false;
    setDesignId(idFinal);
    setEsBorrador(false);
    setEstadoBorrador(null);
    if (idFinal !== designIdParam) navigate(`/crear/${id}?designId=${idFinal}`, { replace: true });
    quitarBorradorDeCache(queryClient, user.uid, idFinal);
    queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['mis-borradores-crear'], refetchType: 'all' });
    queryClient.removeQueries({ queryKey: ['creacion', idFinal] });
    setNombre(creacion.name);
    setFirmaGuardada(firmaDiseno(capasRef.current, color.id));
    tallaGuardadaRef.current = talla;
    // Ya está guardada: la próxima vez la plantilla se abre limpia.
    try { sessionStorage.removeItem(claveBorrador(id)); } catch { /* nada */ }
    return { ...creacion, id: idFinal };
  };

  const guardar = () => {
    if (!hayCambios) {
      toast.info(firmaGuardada === null ? 'Agrega una imagen o un texto a tu diseño.' : 'No hay cambios por guardar.');
      return;
    }
    if (!validar()) return;
    setNombreEditado(nombre || nombrePorDefecto());
    setDialogoGuardar(true);
  };

  const confirmarGuardar = async () => {
    setDialogoGuardar(false);
    try {
      const creacion = await guardarCreacion(nombreEditado);
      setGuardada(creacion);
    } catch (err) {
      toast.error(`No pudimos guardar tu creación: ${err?.message || err}`);
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
      const creacion = await guardarCreacion(nombre);
      setProcesando('Agregando al carrito…');
      addToCart(...itemDeCreacion({ prenda, creacion, talla }));
      try { sessionStorage.removeItem(claveBorrador(id)); } catch { /* nada */ }
      navigate('/carrito');
    } catch (err) {
      toast.error(`No pudimos preparar tu diseño: ${err?.message || err}`);
    } finally {
      setProcesando(null);
    }
  };

  // ── Atajos de teclado ────────────────────────────────────────────────────
  // Las ventanas (recortar, quitar fondo, guardar…) manejan sus propias teclas.
  const ventanaAbierta = Boolean(recortando || quitandoFondo || dialogoGuardar || pedirLogin || guardada || procesando || menu);
  const escribiendo = () => {
    const el = document.activeElement;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName) || Boolean(el?.isContentEditable);
  };

  atajosRef.current = (e) => {
    if (!listo || e.defaultPrevented || e.isComposing) return;
    if (verAtajos) {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        setVerAtajos(false);
      }
      return;
    }
    if (dialogoGuardar && e.key === 'Escape') {
      setDialogoGuardar(false);
      return;
    }
    if (ventanaAbierta) return;
    if (escribiendo()) {
      // Esc sale del cuadro de texto y deja usar los atajos.
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }
    const conMod = (e.ctrlKey || e.metaKey) && !e.getModifierState?.('AltGraph');
    const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (conMod) {
      if (tecla === 'z' && !e.shiftKey) { e.preventDefault(); deshacer(); }
      else if ((tecla === 'z' && e.shiftKey) || tecla === 'y') { e.preventDefault(); rehacer(); }
      else if (tecla === 's') { e.preventDefault(); guardar(); }
      else if (tecla === 'd') { e.preventDefault(); asentarHistorial(); duplicar(); }
      else if (tecla === 'c') { if (copiar()) e.preventDefault(); }
      else if (tecla === 'x') { if (copiar()) { e.preventDefault(); asentarHistorial(); eliminar(); } }
      // Ctrl+V llega como evento "paste" (ver alPegarRef).
      return;
    }
    if (e.altKey && !e.getModifierState?.('AltGraph')) return;

    if (tecla === '?') { e.preventDefault(); setVerAtajos(true); return; }
    if (tecla === 't') { e.preventDefault(); agregarTexto(undefined, { editar: true }); return; }
    if (tecla === 'i') { e.preventDefault(); elegirImagen(); return; }
    if (/^[1-9]$/.test(tecla) && cfg.vistas[Number(tecla) - 1]) {
      cambiarVista(cfg.vistas[Number(tecla) - 1].id);
      return;
    }

    if (!capaActual()) return;
    // Cada atajo es un paso propio para deshacer; solo las flechas seguidas se agrupan.
    if (!tecla.startsWith('Arrow')) asentarHistorial();
    const paso = e.shiftKey ? 50 : 5;
    const capa = capaActual();
    switch (tecla) {
      case 'Delete':
      case 'Backspace': e.preventDefault(); eliminar(); break;
      case 'Escape': soltarSeleccion(); break;
      case 'ArrowLeft': e.preventDefault(); desplazar(-paso, 0); break;
      case 'ArrowRight': e.preventDefault(); desplazar(paso, 0); break;
      case 'ArrowUp': e.preventDefault(); desplazar(0, -paso); break;
      case 'ArrowDown': e.preventDefault(); desplazar(0, paso); break;
      case '+':
      case '=': e.preventDefault(); escalar(1.05); break;
      case '-':
      case '_': e.preventDefault(); escalar(1 / 1.05); break;
      case 'r': e.preventDefault(); girar(e.shiftKey ? -1 : 1); break;
      case 'c': e.preventDefault(); centrar(); break;
      case 'f': if (capa.type === 'image') { e.preventDefault(); editarCapa(capa.id, { flipX: !capa.flipX }); } break;
      case 'PageUp':
      case ']': e.preventDefault(); mover(true); break;
      case 'PageDown':
      case '[': e.preventDefault(); mover(false); break;
      default: break;
    }
  };

  /** Ctrl+V: una imagen copiada (de otra página o una captura), una capa copiada o un texto. */
  alPegarRef.current = (e) => {
    if (!listo || ventanaAbierta || verAtajos || escribiendo()) return;
    const archivo = [...(e.clipboardData?.files || [])].find((f) => /^image\//.test(f.type));
    if (archivo) {
      e.preventDefault();
      subirArchivo(archivo);
      return;
    }
    if (portapapelesRef.current) {
      e.preventDefault();
      asentarHistorial();
      pegar();
      return;
    }
    const texto = (e.clipboardData?.getData('text/plain') || '').trim();
    if (texto && zona) {
      e.preventDefault();
      agregarTexto(texto.slice(0, 120));
    }
  };

  // ── Mouse: clic derecho, doble clic ──────────────────────────────────────
  const capaPorId = (capaId) => Object.values(capasRef.current).flat().find((c) => c.id === capaId) || null;

  /**
   * Si un texto se sale de su zona por un costado (al crecer mientras se
   * escribe, o creado junto al borde), se corre hacia adentro.
   */
  const mantenerEnZona = (capaId) => {
    const obj = objetoDe(capaId);
    const zId = zonaDe(capaId);
    const t = zId && transformsRef.current[zId];
    const capa = capaPorId(capaId);
    if (!obj || !t || !capa) return;
    obj.setCoords();
    const pts = obj.getCoords(true, true).map((pt) => desdeLienzo(t, pt.x, pt.y));
    const xs = pts.map((pt) => pt.left);
    const ys = pts.map((pt) => pt.top);
    const corrimiento = (min, max, limite) => {
      if (max - min > limite) return limite / 2 - (min + max) / 2;
      if (min < 0) return -min;
      if (max > limite) return limite - max;
      return 0;
    };
    const dx = corrimiento(Math.min(...xs), Math.max(...xs), t.wu);
    const dy = corrimiento(Math.min(...ys), Math.max(...ys), t.hu);
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) editarCapa(capaId, { left: capa.left + dx, top: capa.top + dy });
  };

  accionesRef.current = {
    escalar,
    mantenerEnZona,
    quitarCapa: (capaId) => {
      const zId = zonaDe(capaId);
      if (!zId) return;
      if (seleccionRef.current === capaId) setSeleccionId(null);
      modificarCapas(zId, (capas) => capas.filter((c) => c.id !== capaId), true);
    },
    abrirMenu: (e) => {
      const lienzo = fabricRef.current;
      const ev = e.e;
      const obj = e.target;
      if (!lienzo || !ev) return;
      if (obj?.capaId) {
        if (lienzo.getActiveObject() !== obj) {
          lienzo.setActiveObject(obj);
          lienzo.requestRenderAll();
        }
        setMenu({ x: ev.clientX, y: ev.clientY, capaId: obj.capaId });
        return;
      }
      const zId = obj?.guiaZona || null;
      if (zId) elegirZona(zId);
      else soltarSeleccion();
      const t = zId && transformsRef.current[zId];
      const pt = lienzo.getPointer(ev);
      setMenu({ x: ev.clientX, y: ev.clientY, capaId: null, zonaId: zId, punto: t ? desdeLienzo(t, pt.x, pt.y) : null });
    },
    dobleClic: (e) => {
      const obj = e.target;
      const lienzo = fabricRef.current;
      if (!lienzo) return;
      if (obj?.capaId) {
        const capa = capaPorId(obj.capaId);
        // El texto ya entra a escribir solo (fabric); la imagen abre Recortar.
        if (capa?.type === 'image' && user && !capa.subiendo) setRecortando(capa.id);
        return;
      }
      if (obj?.guiaZona && CON_MOUSE) {
        const t = transformsRef.current[obj.guiaZona];
        const pt = lienzo.getPointer(e.e);
        asentarHistorial();
        agregarTexto(undefined, { zonaId: obj.guiaZona, punto: desdeLienzo(t, pt.x, pt.y), editar: true });
      }
    },
  };

  const opcionesMenu = () => {
    if (!menu) return [];
    const pegarOpcion = {
      id: 'pegar', etiqueta: 'Pegar', icono: ClipboardPaste, atajo: `${MOD}+V`,
      deshabilitado: !portapapelesRef.current, accion: () => { asentarHistorial(); pegar(); },
    };
    const capa = menu.capaId ? capaPorId(menu.capaId) : null;
    if (!capa) {
      return [
        {
          id: 'texto', etiqueta: 'Agregar texto aquí', icono: Type, atajo: 'T',
          accion: () => { asentarHistorial(); agregarTexto(undefined, { zonaId: menu.zonaId, punto: menu.punto, editar: true }); },
        },
        { id: 'imagen', etiqueta: 'Subir imagen', icono: ImagePlus, atajo: 'I', accion: elegirImagen },
        pegarOpcion,
        'separador',
        { id: 'deshacer', etiqueta: 'Deshacer', icono: Undo2, atajo: `${MOD}+Z`, deshabilitado: !historialInfo.puedeDeshacer, accion: deshacer },
        { id: 'rehacer', etiqueta: 'Rehacer', icono: Redo2, atajo: `${MOD}+Y`, deshabilitado: !historialInfo.puedeRehacer, accion: rehacer },
      ];
    }
    const esImagen = capa.type === 'image';
    return [
      ...(capa.type === 'text' && CON_MOUSE
        ? [{ id: 'escribir', etiqueta: 'Editar texto', icono: Pencil, atajo: 'Doble clic', accion: () => escribirEnLienzo(capa.id) }]
        : []),
      { id: 'duplicar', etiqueta: 'Duplicar', icono: Copy, atajo: `${MOD}+D`, accion: () => { asentarHistorial(); duplicar(); } },
      { id: 'copiar', etiqueta: 'Copiar', icono: Clipboard, atajo: `${MOD}+C`, accion: copiar },
      pegarOpcion,
      'separador',
      { id: 'adelante', etiqueta: 'Traer adelante', icono: ArrowUpToLine, atajo: ']', accion: () => { asentarHistorial(); mover(true); } },
      { id: 'atras', etiqueta: 'Enviar atrás', icono: ArrowDownToLine, atajo: '[', accion: () => { asentarHistorial(); mover(false); } },
      { id: 'centrar', etiqueta: 'Centrar en la zona', icono: Crosshair, atajo: 'C', accion: () => { asentarHistorial(); centrar(); } },
      { id: 'girar', etiqueta: 'Girar', icono: RotateCw, atajo: 'R', accion: () => { asentarHistorial(); girar(1); } },
      ...(esImagen ? [
        {
          id: 'voltear', etiqueta: 'Voltear', icono: FlipHorizontal, atajo: 'F',
          accion: () => { asentarHistorial(); editarCapa(capa.id, { flipX: !capa.flipX }); },
        },
        { id: 'recortar', etiqueta: 'Recortar', icono: Crop, atajo: 'Doble clic', deshabilitado: !user, accion: () => setRecortando(capa.id) },
        { id: 'fondo', etiqueta: 'Quitar fondo', icono: Eraser, deshabilitado: !user || capa.subiendo, accion: () => setQuitandoFondo(capa.id) },
        { id: 'llenar', etiqueta: 'Llenar zona', icono: Maximize2, accion: () => { asentarHistorial(); ajustarAZona(); } },
      ] : []),
      'separador',
      { id: 'quitar', etiqueta: 'Quitar', icono: Trash2, atajo: 'Supr', peligro: true, accion: () => { asentarHistorial(); eliminar(); } },
    ];
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

  const vistaSel = zonaSel ? cfg.vistas.find((v) => v.id === zonaSel.vistaId) : null;
  const calidad = capaSel?.type === 'image' ? calidadDeCapa(capaSel, zonaSel, zonaSel && medidaZona(zonaSel, vistaSel)) : null;
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
        {user && (
          <Link to="/cuenta/creaciones" className={styles.misCreaciones} aria-label="Mis creaciones" title="Mis creaciones">
            <Images size={18} aria-hidden="true" />
            <span>Mis creaciones</span>
          </Link>
        )}
      </div>

      {designId && (
        <div className={styles.editando}>
          {esBorrador ? (
            <span className={styles.estadoBorrador} role="status">
              {estadoBorrador === 'guardando'
                ? <Loader2 size={15} className={styles.girando} aria-hidden="true" />
                : estadoBorrador === 'error'
                  ? <AlertTriangle size={15} aria-hidden="true" />
                  : <CheckCircle2 size={15} aria-hidden="true" />}
              {estadoBorrador === 'guardando'
                ? 'Guardando borrador…'
                : estadoBorrador === 'error'
                  ? 'No pudimos guardar el borrador. Revisa tu conexión.'
                  : 'Borrador guardado: lo encuentras en Crear para continuarlo después.'}
            </span>
          ) : (
            <span>
              Estás editando <strong>{nombre ? `«${nombre}»` : 'tu creación'}</strong>.{' '}
              {hayCambios ? 'Tienes cambios sin guardar.' : 'Todo está guardado.'}
            </span>
          )}
          <button type="button" className={styles.botonTexto} onClick={empezarNuevo}>
            <Plus size={16} aria-hidden="true" /> Empezar uno nuevo
          </button>
        </div>
      )}

      {!user && !authLoading && zonasUsadas.length > 0 && (
        <div className={styles.editando}>
          <span>Inicia sesión para guardar tu diseño como borrador y continuarlo después.</span>
          <button type="button" className={styles.botonTexto} onClick={irALogin}>Iniciar sesión</button>
        </div>
      )}

      {borrador && (
        <p className={styles.borrador}>
          Borrador: solo los administradores ven esta prenda. Publícala desde Admin → Productos.
        </p>
      )}

      <div className={styles.cuerpo}>
        <section
          className={styles.areaLienzo}
          aria-label="Lienzo de diseño"
          onDragOver={(e) => {
            if (![...e.dataTransfer.types].includes('Files')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setSoltando(true);
          }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setSoltando(false); }}
          onDrop={(e) => {
            if (![...e.dataTransfer.types].includes('Files')) return;
            e.preventDefault();
            setSoltando(false);
            const archivo = [...e.dataTransfer.files].find((f) => /^image\//.test(f.type));
            if (archivo) subirArchivo(archivo);
            else toast.info('Suelta una imagen PNG, JPG o WebP.');
          }}
        >
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
            {soltando && (
              <div className={styles.soltarAqui} aria-hidden="true">
                <ImagePlus size={28} />
                Suelta tu imagen en {zona?.nombre || 'la prenda'}
              </div>
            )}
          </div>

          <div className={styles.barraLienzo}>
            <button
              type="button"
              className={styles.botonBarra}
              onClick={deshacer}
              disabled={!historialInfo.puedeDeshacer}
              aria-label="Deshacer"
              title={`Deshacer (${MOD}+Z)`}
            >
              <Undo2 size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.botonBarra}
              onClick={rehacer}
              disabled={!historialInfo.puedeRehacer}
              aria-label="Rehacer"
              title={`Rehacer (${MOD}+Y)`}
            >
              <Redo2 size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`${styles.botonBarra} ${styles.botonAtajos}`}
              onClick={() => setVerAtajos(true)}
              title="Atajos de teclado (?)"
            >
              <Keyboard size={17} aria-hidden="true" /> Atajos
            </button>
          </div>

          <p className={styles.zonaInfo}>
            <Info size={14} aria-hidden="true" />
            {CON_MOUSE
              ? 'Doble clic para escribir sobre la prenda · Clic derecho para más opciones · Ctrl + rueda para cambiar el tamaño.'
              : vista.zonas.length > 1
                ? 'Toca una zona punteada para elegirla. Arrastra tu diseño a otra zona para pasarlo ahí.'
                : 'Ubica tu diseño dentro de la zona punteada.'}
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
                  </button>
                );
              })}
            </div>
            <div className={styles.agregar}>
              <button type="button" className={styles.botonAgregar} onClick={elegirImagen} title="Subir imagen (I) · también puedes arrastrarla o pegarla">
                <ImagePlus size={20} aria-hidden="true" />
                Subir imagen
              </button>
              <button type="button" className={styles.botonAgregar} onClick={() => agregarTexto(undefined, { editar: true })} title="Agregar texto (T)">
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
                <button type="button" className={styles.botonPeligro} onClick={eliminar} title="Quitar (Supr)">
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

              {zonaSel && zonasPrenda.length > 1 && (
                <div className={styles.moverA}>
                  <span>Pasar a:</span>
                  {zonasPrenda.filter((z) => z.id !== zonaSel.id).map((z) => (
                    <button key={z.id} type="button" className={styles.zonaMini} onClick={() => moverAZona(z)}>
                      {z.vistaId === vista.id || z.vistaNombre === z.nombre ? z.nombre : `${z.vistaNombre} · ${z.nombre}`}
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.herramientas}>
                <button type="button" className={styles.herramienta} onClick={centrar} title="Centrar (C)"><Crosshair size={16} aria-hidden="true" />Centrar</button>
                <button type="button" className={styles.herramienta} onClick={() => girar(1)} title="Girar (R)">
                  <RotateCw size={16} aria-hidden="true" />Girar
                </button>
                {capaSel.type === 'image' && (
                  <>
                    <button type="button" className={styles.herramienta} onClick={() => setRecortando(capaSel.id)} disabled={!user}><Crop size={16} aria-hidden="true" />Recortar</button>
                    <button type="button" className={styles.herramienta} onClick={() => setQuitandoFondo(capaSel.id)} disabled={!user || capaSel.subiendo}><Eraser size={16} aria-hidden="true" />Quitar fondo</button>
                    <button type="button" className={styles.herramienta} onClick={ajustarAZona}><Maximize2 size={16} aria-hidden="true" />Llenar zona</button>
                    <button type="button" className={styles.herramienta} onClick={() => editarCapa(capaSel.id, { flipX: !capaSel.flipX })} title="Voltear (F)"><FlipHorizontal size={16} aria-hidden="true" />Voltear</button>
                  </>
                )}
                <button type="button" className={styles.herramienta} onClick={() => mover(true)} title="Adelante (])"><ArrowUpToLine size={16} aria-hidden="true" />Adelante</button>
                <button type="button" className={styles.herramienta} onClick={() => mover(false)} title="Atrás ([)"><ArrowDownToLine size={16} aria-hidden="true" />Atrás</button>
                <button type="button" className={styles.herramienta} onClick={duplicar} title={`Duplicar (${MOD}+D)`}><Copy size={16} aria-hidden="true" />Duplicar</button>
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
            <div className={styles.lineaPrecio}><span>{prenda.name} personalizada</span><span>{soles(base)}</span></div>
            <p className={styles.incluye}>Incluye todos tus diseños, en las zonas que quieras.</p>
            <div className={`${styles.lineaPrecio} ${styles.lineaTotal}`}><span>Total</span><span>{soles(total)}</span></div>
          </section>

          <button type="button" className={styles.botonDescarga} onClick={descargarImagen} disabled={!!procesando}>
            <Download size={18} aria-hidden="true" />
            Descargar imagen ({cfg.vistas.length > 1 ? cfg.vistas.map((v) => v.nombre.toLowerCase()).join(' y ') : 'diseño'})
          </button>

          <div className={styles.acciones}>
            <button
              type="button"
              className={`${styles.botonSecundario} ${!hayCambios ? styles.sinCambios : ''}`}
              onClick={guardar}
              disabled={!!procesando || !hayCambios}
              title={hayCambios ? `Guardar (${MOD}+S)` : 'No hay cambios por guardar'}
            >
              {firmaGuardada !== null && !hayCambios
                ? <><CheckCircle2 size={18} aria-hidden="true" /> Guardado</>
                : <><Save size={18} aria-hidden="true" /> Guardar</>}
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

      {recortando && capaSel?.id === recortando && capaSel.type === 'image' && (
        <RecorteImagen
          src={srcDe(capaSel)}
          onCancelar={() => setRecortando(null)}
          onAplicar={(corte) => aplicarRecorte(capaSel, corte)}
        />
      )}

      {quitandoFondo && capaSel?.id === quitandoFondo && capaSel.type === 'image' && (
        <QuitarFondo
          src={srcDe(capaSel)}
          onCancelar={() => setQuitandoFondo(null)}
          onAplicar={(resultado) => aplicarSinFondo(capaSel, resultado)}
        />
      )}

      {verAtajos && <AtajosTeclado vistas={cfg.vistas} onCerrar={() => setVerAtajos(false)} />}

      {menu && <MenuContextual x={menu.x} y={menu.y} items={opcionesMenu()} onCerrar={cerrarMenu} />}

      {dialogoGuardar && (
        <div className={styles.capaBloqueo} role="dialog" aria-modal="true" aria-labelledby="crear-guardar-titulo" onClick={() => setDialogoGuardar(false)}>
          <form
            className={styles.cajaBloqueo}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); confirmarGuardar(); }}
          >
            <h2 id="crear-guardar-titulo" className={styles.estadoTitulo}>Guarda tu creación</h2>
            <p>Queda en tu cuenta, en Mis creaciones, con sus dos lados. Puedes comprarla o seguir editándola cuando quieras.</p>
            <label className={styles.campoNombre}>
              <span>Ponle un nombre</span>
              <input
                value={nombreEditado}
                maxLength={60}
                onChange={(e) => setNombreEditado(e.target.value)}
                autoFocus
              />
            </label>
            <button type="submit" className={styles.botonPrincipal}>Guardar creación</button>
            <button type="button" className={styles.botonTexto} onClick={() => setDialogoGuardar(false)}>Cancelar</button>
          </form>
        </div>
      )}

      {guardada && (
        <div className={styles.capaBloqueo} role="dialog" aria-modal="true" aria-labelledby="crear-guardada-titulo" onClick={() => setGuardada(null)}>
          <div className={styles.cajaBloqueo} onClick={(e) => e.stopPropagation()}>
            <h2 id="crear-guardada-titulo" className={styles.estadoTitulo}>¡Creación guardada!</h2>
            {guardada.imagenConjunta && <img src={guardada.imagenConjunta} alt={guardada.name} className={styles.imagenGuardada} />}
            <p><strong>{guardada.name}</strong></p>
            <Link to={`/creacion/${guardada.id}`} className={styles.botonPrincipal}>Ver mi creación</Link>
            <button type="button" className={styles.botonTexto} onClick={() => setGuardada(null)}>Seguir diseñando</button>
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
