import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LogIn, RotateCcw,
  Type, ImagePlus, ClipboardPaste, Clipboard, Copy, Undo2, Redo2, ArrowUpToLine, ArrowDownToLine, Crosshair,
  RotateCw, FlipHorizontal, Crop, Eraser, Maximize2, Trash2, Pencil, MousePointerSquareDashed,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
} from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio, HojaInferior } from '../Feedback';
import { CapaCargando } from '../Cargando';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { RecortarFoto } from '../piezas/RecortarFoto';
import { QuitarFondo } from '../piezas/QuitarFondo';
import { MenuContextual } from '../piezas/MenuContextual';
import { useAgregado } from '../piezas/Ficha';
import {
  LienzoPrenda, BarraLienzo, PasosEstudio, PanelCapa, PanelVarios, EstadoEdicion, AtajosEstudio, GuiaGestos, zoomVecino, NIVELES_ZOOM,
} from '../piezas/Estudio';
import { MarcoEstudio, InicioLienzoEstudio, EscenaEstudio, SoltarLados } from './MarcoEstudio';
import { HojasEstudio } from '../piezas/HojasEstudio';
import { CompraEstudio } from '../piezas/CompraEstudio';
import s from './Estudio.module.css';

/*
 * El estudio de Crear (/crear/:id): se elige el color, la zona y se pone una
 * imagen o un texto en la prenda; se guarda como creación, se descarga o se
 * agrega al carrito. Desde un combo, "Listo, usar en el combo" lo devuelve.
 * En la tienda el lienzo que se arrastra es fabric.js (CrearStudioPage); aquí
 * el diseño se lleva en el estado de la página y LienzoPrenda lo dibuja.
 * Los datos y lo que pasa al guardar o agregar llegan por props.
 */

const nuevoId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl';
const ZOOM_MAX = NIVELES_ZOOM[NIVELES_ZOOM.length - 1];
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const conRaton = () => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
const enTelefono = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
/** Una zona larga (una manga): el texto nuevo va girado, a lo largo. */
const esLarga = (z) => (z?.proporcion || 0) > 1.8;
/** Dónde va lo nuevo si la zona ya tiene algo: arriba y abajo del centro, como la tienda. */
const CORRIMIENTOS = [0, 0.22, -0.22, 0.36, -0.36];

/**
 * Medio ancho y medio alto aproximados de una capa (0–1 de su zona), para
 * alinear y repartir varias. La tienda los saca de fabric; aquí, de la imagen
 * (su ancho y su aspecto) o del texto (largo × tamaño de letra).
 */
const medidasDe = (c, proporcion = 1) => {
  if (c.tipo === 'imagen') {
    const medioAncho = (c.ancho ?? 0.8) / 2;
    return { medioAncho, medioAlto: (medioAncho * (c.aspecto || 1)) / (proporcion || 1) };
  }
  const lineas = String(c.texto || ' ').split('\n');
  const largo = Math.max(...lineas.map((l) => l.length), 1);
  const tamano = c.tamano ?? 0.18;
  return { medioAncho: Math.min(0.5, (largo * tamano * 0.55) / 2), medioAlto: (lineas.length * tamano * 0.6) / 2 / (proporcion || 1) };
};

/** "Frente · Pecho" (o solo "Espalda" si la zona se llama como su lado). */
const nombreZona = (z) => (!z ? '' : z.nombre === z.vista.nombre ? z.nombre : `${z.vista.nombre} · ${z.nombre}`);

/**
 * Calidad de impresión de una imagen, con la regla de la tienda
 * (calidadDeCapa): cuánto hay que estirar sus píxeles para el ancho que ocupa
 * en el archivo de impresión. Con la medida real de la zona, a 300 dpi; sin
 * ella, la zona entera son 3600 px.
 */
const anchoZonaPx = (zona) => (zona.anchoCm > 0 ? (zona.anchoCm / 2.54) * 300 : 3600);
const calidadPorDefecto = (capa, zona) => {
  if (capa?.tipo !== 'imagen' || !capa.px || !zona) return undefined;
  const estiramiento = ((capa.ancho ?? 0.8) * anchoZonaPx(zona)) / capa.px;
  return estiramiento <= 1.5 ? 'buena' : estiramiento <= 2.5 ? 'regular' : 'baja';
};

/** El ancho (en fracción de la zona) hasta el que una imagen se ve nítida: la misma regla. */
const anchoNitidoPorDefecto = (capa, zona) => (capa?.px && zona ? (1.5 * capa.px) / anchoZonaPx(zona) : null);

/** alto / ancho de una imagen: el que trae, o se mide al cargarla (null si no carga). */
const medirAspecto = (src) => new Promise((listo) => {
  if (!src || typeof Image === 'undefined') { listo(null); return; }
  const img = new Image();
  img.onload = () => listo(img.naturalWidth ? img.naturalHeight / img.naturalWidth : null);
  img.onerror = () => listo(null);
  img.src = src;
});

/**
 * ¿Una parte de la imagen queda fuera de su zona? (no se imprime). Del texto
 * no se sabe el ancho aquí: lo avisa la tienda con `fueraDeZona`.
 */
const fueraPorDefecto = (capa, zona) => {
  if (capa?.tipo !== 'imagen') return false;
  // Las esquinas giradas, en fracción de la zona (el alto, en anchos de zona).
  const prop = zona?.proporcion || 1;
  const w = capa.ancho ?? 0.8;
  const h = capa.aspecto ? w * capa.aspecto : 0;
  const a = ((capa.angulo || 0) * Math.PI) / 180;
  const ex = (Math.abs(Math.cos(a)) * w + Math.abs(Math.sin(a)) * h) / 2;
  const ey = (Math.abs(Math.sin(a)) * w + Math.abs(Math.cos(a)) * h) / 2 / prop;
  const x = capa.x ?? 0.5;
  const y = capa.y ?? 0.5;
  return x - ex < -0.01 || x + ex > 1.01 || (h > 0 && (y - ey < -0.01 || y + ey > 1.01));
};

/**
 * Después de recortar (o quitar el fondo, que también recorta lo vacío) la
 * imagen se queda donde estaba en la prenda: lo que quedó, del mismo tamaño
 * y en el mismo lugar, como en la tienda.
 *  - corte: px de la imagen original · natural: { w, h } de la original
 *  - proporcion: alto / ancho de la zona
 */
const reubicarTrasCorte = (capa, corte, natural, proporcion = 1) => {
  const ancho = capa.ancho ?? 0.8;
  const W = natural.w || 1;
  const H = natural.h || W;
  const altoEnZona = (ancho * H) / W / (proporcion || 1); // alto de la imagen, en fracción del alto de la zona
  return {
    ancho: ancho * (corte.w / W),
    x: (capa.x ?? 0.5) + ((corte.x + corte.w / 2) / W - 0.5) * ancho,
    y: (capa.y ?? 0.5) + ((corte.y + corte.h / 2) / H - 0.5) * altoEnZona,
    aspecto: corte.h / corte.w,
  };
};

/**
 * La página del estudio.
 *  - prenda: la de adaptadores.prendaEstudioDesde ({ nombre, precio,
 *    precioAntes, vistas, colores, tallas })
 *  - inicial: { color, vista, zona, capas, nombre } (al editar, al copiar o
 *    al partir de un diseño de la comunidad)
 *  - modo: 'nuevo' | 'editar' | 'plantilla' (con `plantilla`: su nombre)
 *  - combo: { nombre, numero, total, otras: { iguales: [n], conOtroDiseno: [n] } }
 *    si se diseña una prenda de un combo (otras: las prendas donde también se
 *    puede poner este diseño)
 *  - sesion · fuentes: [{ valor, texto, detalle }] para la lista de letras
 *  - onSubirImagen(archivo?): promesa → { src, px, aspecto } (o null si se
 *    cancela); sin archivo abre el selector; con él, uno pegado o soltado
 *  - onQuitarFondo(capa): promesa → src · onGuardar({ nombre, diseno }): promesa
 *    (puede resolver { urlCreacion }: "Ver mi creación" en la hoja de guardada)
 *  - onAgregar({ talla, cantidad, diseno }): promesa · onDescargar(diseno)
 *  - onUsarEnCombo(diseno, { copiarA: [n] }) · urlVolver, urlLogin, urlCreaciones
 *  - procesando: texto de lo que está haciendo la tienda (una capa de espera)
 *  - estado: 'cargando' | 'error' | 'noDisponible' · onReintentar · urlCrear
 *  - anchoNitidoDe(capa, zona) → hasta qué ancho (fracción de la zona) se ve
 *    nítida una imagen: "Dejarla nítida". La tienda pasa el suyo si cambia la
 *    regla de calidad.
 *  - calidadDe(capa, zona) → 'buena' | 'regular' | 'baja' y fueraDeZona(capa,
 *    zona) → bool: la tienda pasa los suyos (calidadDeCapa y el límite de
 *    fabric); sin ellos, una aproximación con la medida de la zona
 *  - motorFondo: las funciones de píxeles de quitar el fondo (en la tienda,
 *    pages/Crear/fondoPixeles.js). Con él, "Quitar fondo" abre el editor
 *    (QuitarFondo); sin él, se usa onQuitarFondo de un toque
 *  - onImagenEditada({ capa, blob }): promesa → src; sube la imagen recortada o
 *    sin fondo (en la tienda, a Storage). Sin ella, se usa una URL local.
 *  - requiereSesion: { imagen, carrito } (los dos true, como la tienda): sin
 *    sesión, subir una imagen o agregar al carrito pide entrar (la tienda
 *    guarda el diseño antes, así no se pierde) · urlRegistro
 *  - edición (modo 'editar'): esBorrador · estadoBorrador ('guardando' |
 *    'guardado' | 'error') · onRenombrar(nombre): promesa · onEmpezarNuevo.
 *    Guardar se apaga sin cambios ("Guardado") y, si ya estaba guardada,
 *    guarda sin preguntar el nombre.
 *  - agotado: "Agotado por ahora" · borradorAdmin: la prenda es un borrador
 *    (solo la ve el admin): aviso y no se compra
 *  - etiquetaVolver ("Volver a Mis creaciones"…) · onAviso({ tipo, titulo,
 *    texto }): avisos sueltos (el color cambió las zonas, cambios guardados)
 *  - cargandoDiseno: el diseño guardado aún llega (la prenda ya se ve)
 *  - guiaGestosVista: la guía de los dedos ya se vio (la tienda lo guarda en
 *    el aparato); sale la primera vez que se toca algo · onGuiaGestosVista()
 */
export function PaginaEstudio({
  prenda, inicial = {}, modo = 'nuevo', plantilla, combo, sesion = false, fuentes = [],
  onSubirImagen, onQuitarFondo, onGuardar, onAgregar, onDescargar, onUsarEnCombo,
  urlVolver = '/personalizar', urlLogin = '/login', urlRegistro = '/registro', urlCreaciones = '/cuenta/creaciones',
  estado, onReintentar, urlCrear = '/personalizar',
  calidadDe = calidadPorDefecto, anchoNitidoDe = anchoNitidoPorDefecto, fueraDeZona = fueraPorDefecto, motorFondo, onImagenEditada,
  requiereSesion = { imagen: true, carrito: true },
  esBorrador = false, estadoBorrador = 'guardado', onRenombrar, onEmpezarNuevo,
  agotado = false, borradorAdmin = false, etiquetaVolver = 'Volver', onAviso, procesando,
  cargandoDiseno = false, guiaGestosVista = false, onGuiaGestosVista,
}) {
  const colores = prenda?.colores || [];
  const [colorId, setColorId] = useState(inicial.color || colores.find((c) => !c.espejoDe)?.id);
  const color = colores.find((c) => c.id === colorId) || colores[0];
  const vistas = color?.vistas || prenda?.vistas || [];
  const [vistaId, setVistaId] = useState(inicial.vista || vistas[0]?.id);
  const vista = vistas.find((v) => v.id === vistaId) || vistas[0];
  const [zonaId, setZonaId] = useState(inicial.zona || vista?.zonas[0]?.id);
  const [historia, setHistoria] = useState({ pasado: [], capas: inicial.capas || {}, futuro: [] });
  const capas = historia.capas;
  // Una capa elegida (seleccion) o varias (varios, con dos o más).
  const [seleccion, setSeleccionUna] = useState(null);
  const [varios, setVarios] = useState([]);
  const setSeleccion = (id) => { setVarios([]); setSeleccionUna(id); };
  const elegidas = varios.length > 1 ? varios : seleccion ? [seleccion] : [];
  const [zoom, setZoomEstado] = useState(1);
  const [camara, setCamara] = useState({ x: 0, y: 0 });
  const setZoom = (z) => { const nz = limitar(z, 1, ZOOM_MAX); zoomAuto.current = false; setZoomEstado(nz); if (nz === 1) setCamara({ x: 0, y: 0 }); };
  const [espacio, setEspacio] = useState(false); // Espacio mantenida: arrastrar mueve la vista
  const [menu, setMenu] = useState(null); // { x, y, capaId, zonaId, punto }
  const portapapeles = useRef(null); // lo copiado: [{ capa, zonaId }]
  const pegadas = useRef(0); // cada pegado en la misma zona va un poco más corrido
  const [editando, setEditando] = useState(null); // el texto que se escribe sobre la prenda
  const [completa, setCompleta] = useState(false); // teléfono: la prenda entera aunque haya algo elegido
  const [camaraSuave, setCamaraSuave] = useState(false);
  const zoomAuto = useRef(false); // el zoom lo puso el acercamiento a la zona (no la persona)
  const [copiarA, setCopiarA] = useState([]); // combo: las otras prendas que llevan este diseño
  const [nombre, setNombre] = useState(inicial.nombre || '');
  const [hoja, setHoja] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [agregado, marcarAgregado] = useAgregado();
  const [talla, setTalla] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [recortando, setRecortando] = useState(null);
  const [sinFondo, setSinFondo] = useState(null); // la capa en el editor de quitar fondo
  const [motivoLogin, setMotivoLogin] = useState('guardar');
  // La "firma" del diseño (color + capas) al guardarlo: si la de ahora es otra,
  // hay cambios sin guardar. Una creación que se edita ya empieza guardada.
  const firmaDe = (c, cs) => JSON.stringify([c, cs]);
  const [firmaGuardada, setFirmaGuardada] = useState(() => (modo === 'editar' ? firmaDe(colorId, inicial.capas || {}) : null));
  const lienzoRef = useRef(null);
  const panelRef = useRef(null);
  const [guia, setGuia] = useState(false); // la guía de los dedos
  const guiaVista = useRef(guiaGestosVista);
  const [urlCreacion, setUrlCreacion] = useState(null); // la creación recién guardada
  const guardarRef = useRef(null); // Ctrl+S (guardar se arma más abajo, después de cargar)

  // Todas las zonas, con su lado, para buscar una capa o una zona por id.
  const todasLasZonas = useMemo(() => vistas.flatMap((v) => v.zonas.map((z) => ({ ...z, vista: v }))), [vistas]);
  const zona = todasLasZonas.find((z) => z.id === zonaId);
  const ubicar = (id) => {
    for (const [zid, lista] of Object.entries(capas)) {
      const c = lista.find((x) => x.id === id);
      if (c) return { capa: c, zonaId: zid };
    }
    return {};
  };
  const elegida = seleccion ? ubicar(seleccion) : {};
  const zonaElegida = todasLasZonas.find((z) => z.id === elegida.zonaId);

  /* Cambios con deshacer: `guardar` false mientras se arrastra (se guarda al soltar). */
  const arrastreInicio = useRef(null);
  const cambiarCapas = (fn, guardar = true) => setHistoria((h) => {
    const capasNuevas = fn(h.capas);
    if (!guardar) {
      if (!arrastreInicio.current) arrastreInicio.current = h.capas;
      return { ...h, capas: capasNuevas };
    }
    return { pasado: [...h.pasado.slice(-79), h.capas], capas: capasNuevas, futuro: [] };
  });
  // El ref se lee fuera del actualizador: React puede llamarlo dos veces.
  const soltar = () => {
    const antes = arrastreInicio.current;
    arrastreInicio.current = null;
    if (antes) setHistoria((h) => ({ pasado: [...h.pasado.slice(-79), antes], capas: h.capas, futuro: [] }));
  };
  const deshacer = () => setHistoria((h) => (h.pasado.length ? { pasado: h.pasado.slice(0, -1), capas: h.pasado[h.pasado.length - 1], futuro: [h.capas, ...h.futuro] } : h));
  const rehacer = () => setHistoria((h) => (h.futuro.length ? { pasado: [...h.pasado, h.capas], capas: h.futuro[0], futuro: h.futuro.slice(1) } : h));

  const cambiarCapa = (id, cambios, guardar = true) => cambiarCapas((cs) => Object.fromEntries(
    Object.entries(cs).map(([zid, lista]) => [zid, lista.map((c) => (c.id === id ? { ...c, ...cambios } : c))]),
  ), guardar);
  /** Un ajuste que hace el lienzo solo (el texto que no entra): va en el mismo paso de deshacer. */
  const encajar = (id, cambios) => setHistoria((h) => ({
    ...h,
    capas: Object.fromEntries(Object.entries(h.capas).map(([zid, lista]) => [zid, lista.map((c) => (c.id === id ? { ...c, ...cambios } : c))])),
  }));
  /** Quita una o varias capas (las elegidas, si no se dice cuáles). */
  const quitarCapas = (ids = elegidas) => {
    if (!ids.length) return;
    const fuera = new Set(ids);
    cambiarCapas((cs) => Object.fromEntries(Object.entries(cs).map(([zid, lista]) => [zid, lista.filter((c) => !fuera.has(c.id))])));
    setSeleccion(null);
  };
  const quitarCapa = (id) => quitarCapas([id]);
  /**
   * Agrega una capa en la zona (la elegida, si no se dice). Donde se hizo
   * doble clic, o al centro; si la zona ya tiene algo, un poco corrida para
   * que no quede encima (como la tienda).
   */
  const agregarCapa = (capa, { zid = zonaId, punto } = {}) => {
    const id = nuevoId();
    cambiarCapas((cs) => {
      const n = (cs[zid] || []).length;
      const pos = punto || { x: 0.5, y: limitar(0.5 + CORRIMIENTOS[n % CORRIMIENTOS.length], 0.1, 0.9) };
      return { ...cs, [zid]: [...(cs[zid] || []), { id, ...pos, ...capa }] };
    });
    if (zid !== zonaId) setZonaId(zid);
    setSeleccion(id);
    return id;
  };
  const escalar = (factor) => {
    const { capa } = elegida;
    if (!capa) return;
    if (capa.tipo === 'imagen') cambiarCapa(capa.id, { ancho: limitar((capa.ancho ?? 0.8) * factor, 0.02, 4) });
    else cambiarCapa(capa.id, { tamano: limitar((capa.tamano ?? 0.18) * factor, 0.01, 2) });
  };
  /** Contra los bordes de su zona (por su tamaño), como en la tienda. */
  const alinear = (donde) => {
    const { capa } = elegida;
    if (!capa) return;
    const { medioAncho, medioAlto } = medidasDe(capa, zonaElegida?.proporcion);
    const pos = {
      izquierda: { x: Math.min(0.5, medioAncho) }, centroH: { x: 0.5 }, derecha: { x: Math.max(0.5, 1 - medioAncho) },
      arriba: { y: Math.min(0.5, medioAlto) }, centroV: { y: 0.5 }, abajo: { y: Math.max(0.5, 1 - medioAlto) },
    }[donde];
    cambiarCapa(capa.id, pos);
  };
  const reordenar = (adelante) => cambiarCapas((cs) => {
    const lista = [...(cs[elegida.zonaId] || [])];
    const i = lista.findIndex((c) => c.id === seleccion);
    const [c] = lista.splice(i, 1);
    lista.splice(adelante ? lista.length : 0, 0, c);
    return { ...cs, [elegida.zonaId]: lista };
  });
  /** Duplica lo elegido (una o varias), un poco corrido; quedan elegidas las copias. */
  const duplicar = () => {
    const originales = elegidas.map(ubicar).filter((u) => u.capa);
    if (!originales.length) return;
    const copias = originales.map(({ capa, zonaId: zid }) => ({ zid, capa: { ...capa, id: nuevoId(), x: limitar((capa.x ?? 0.5) + 0.06, 0, 1), y: limitar((capa.y ?? 0.5) + 0.06, 0, 1) } }));
    cambiarCapas((cs) => copias.reduce((acc, { zid, capa }) => ({ ...acc, [zid]: [...(acc[zid] || []), capa] }), cs));
    const ids = copias.map((c) => c.capa.id);
    if (ids.length > 1) { setSeleccionUna(null); setVarios(ids); } else setSeleccion(ids[0]);
  };

  /* ── Varias elegidas ── */
  const capasElegidas = elegidas.map(ubicar).filter((u) => u.capa);
  const zonasDeElegidas = [...new Set(capasElegidas.map((u) => u.zonaId))];
  const mismaZona = zonasDeElegidas.length === 1 ? zonasDeElegidas[0] : null;
  const proporcionDe = (zid) => todasLasZonas.find((z) => z.id === zid)?.proporcion || 1;
  /**
   * "Llenar zona" (ajustarAZona en la tienda): lo más grande que entra
   * ENTERA en su zona, centrada y derecha. Antes solo llenaba el ancho y una
   * imagen más alta que la zona se salía arriba y abajo.
   */
  /** "Dejarla nítida": la achica justo hasta el ancho en que se imprime bien (en su lugar). */
  const dejarNitida = (id) => {
    const { capa, zonaId: zid } = ubicar(id);
    const nitido = anchoNitidoDe(capa, todasLasZonas.find((z) => z.id === zid));
    if (capa && nitido) cambiarCapa(id, { ancho: Math.min(capa.ancho ?? 0.8, nitido) });
  };

  const llenarZona = async (id) => {
    const { capa, zonaId } = ubicar(id);
    if (!capa) return;
    const aspecto = capa.aspecto || await medirAspecto(capa.src);
    const ancho = aspecto ? Math.min(1, proporcionDe(zonaId) / aspecto) : 1;
    cambiarCapa(id, { ancho, x: 0.5, y: 0.5, angulo: 0, ...(aspecto && !capa.aspecto && { aspecto }) });
  };
  /** Alinea las elegidas entre ellas (por sus bordes), como en la tienda. */
  const alinearVarios = (donde) => {
    if (!mismaZona) return;
    const prop = proporcionDe(mismaZona);
    const cajas = capasElegidas.map(({ capa }) => ({ capa, ...medidasDe(capa, prop) }));
    const izq = Math.min(...cajas.map((b) => (b.capa.x ?? 0.5) - b.medioAncho));
    const der = Math.max(...cajas.map((b) => (b.capa.x ?? 0.5) + b.medioAncho));
    const arr = Math.min(...cajas.map((b) => (b.capa.y ?? 0.5) - b.medioAlto));
    const aba = Math.max(...cajas.map((b) => (b.capa.y ?? 0.5) + b.medioAlto));
    const nuevos = Object.fromEntries(cajas.map((b) => [b.capa.id, {
      izquierda: { x: izq + b.medioAncho }, centroH: { x: (izq + der) / 2 }, derecha: { x: der - b.medioAncho },
      arriba: { y: arr + b.medioAlto }, centroV: { y: (arr + aba) / 2 }, abajo: { y: aba - b.medioAlto },
    }[donde]]));
    cambiarCapas((cs) => ({ ...cs, [mismaZona]: cs[mismaZona].map((c) => (nuevos[c.id] ? { ...c, ...nuevos[c.id] } : c)) }));
  };
  /** El mismo espacio entre tres o más (los extremos no se mueven). */
  const distribuir = (eje) => {
    if (!mismaZona || capasElegidas.length < 3) return;
    const k = eje === 'h' ? 'x' : 'y';
    const orden = [...capasElegidas].sort((a, b) => (a.capa[k] ?? 0.5) - (b.capa[k] ?? 0.5));
    const desde = orden[0].capa[k] ?? 0.5;
    const hasta = orden[orden.length - 1].capa[k] ?? 0.5;
    const paso = (hasta - desde) / (orden.length - 1);
    const nuevos = Object.fromEntries(orden.map((u, i) => [u.capa.id, desde + paso * i]));
    cambiarCapas((cs) => ({ ...cs, [mismaZona]: cs[mismaZona].map((c) => (c.id in nuevos ? { ...c, [k]: nuevos[c.id] } : c)) }));
  };
  /** Centra el grupo en la zona (se mueven juntos). */
  const centrarVarios = () => {
    if (!mismaZona) return;
    const xs = capasElegidas.map((u) => u.capa.x ?? 0.5);
    const ys = capasElegidas.map((u) => u.capa.y ?? 0.5);
    const dx = 0.5 - (Math.min(...xs) + Math.max(...xs)) / 2;
    const dy = 0.5 - (Math.min(...ys) + Math.max(...ys)) / 2;
    const ids = new Set(elegidas);
    cambiarCapas((cs) => ({ ...cs, [mismaZona]: cs[mismaZona].map((c) => (ids.has(c.id) ? { ...c, x: (c.x ?? 0.5) + dx, y: (c.y ?? 0.5) + dy } : c)) }));
  };
  /** Mover arrastrando: si la capa es parte de varias elegidas, se mueven todas juntas. */
  const moverCapa = (id, pos) => {
    if (!varios.includes(id)) { cambiarCapa(id, pos, false); return; }
    const { capa } = ubicar(id);
    if (!capa) return;
    const dx = pos.x - (capa.x ?? 0.5);
    const dy = pos.y - (capa.y ?? 0.5);
    const ids = new Set(varios);
    cambiarCapas((cs) => Object.fromEntries(Object.entries(cs).map(([zid, lista]) => [zid, lista.map((c) => (ids.has(c.id)
      ? { ...c, x: limitar((c.x ?? 0.5) + dx, 0, 1), y: limitar((c.y ?? 0.5) + dy, 0, 1) }
      : c))])), false);
  };

  /* ── Copiar, cortar y pegar (también de un lado al otro) ── */
  const copiar = () => {
    if (!capasElegidas.length) return;
    pegadas.current = 0;
    portapapeles.current = capasElegidas.map(({ capa, zonaId: zid }) => ({ capa, zonaId: zid }));
    onAviso?.({ tipo: 'info', titulo: capasElegidas.length > 1 ? `Copiaste ${capasElegidas.length} elementos` : 'Copiado' });
  };
  const cortar = () => { copiar(); quitarCapas(); };
  /** Pega lo copiado en la zona elegida (o en la suya, si sigue a la vista), un poco corrido. */
  const pegar = () => {
    const copiado = portapapeles.current;
    if (!copiado?.length) return;
    const enVista = new Set((vista?.zonas || []).map((z) => z.id));
    const destino = (zid) => (enVista.has(zid) ? zid : zonaId);
    pegadas.current += 1;
    const corrido = 0.04 * pegadas.current;
    const nuevas = copiado.map(({ capa, zonaId: zid }) => {
      const z = destino(zid);
      // En su zona, un poco corrido (cada vez más); en otra, al centro y que entre.
      return z === zid
        ? { zid: z, capa: { ...capa, id: nuevoId(), x: limitar((capa.x ?? 0.5) + corrido, 0, 1), y: limitar((capa.y ?? 0.5) + corrido, 0, 1) } }
        : { zid: z, capa: { ...capa, id: nuevoId(), x: 0.5, y: 0.5, ...(capa.tipo === 'imagen' && { ancho: Math.min(capa.ancho ?? 0.8, 0.8) }) } };
    });
    cambiarCapas((cs) => nuevas.reduce((acc, { zid, capa }) => ({ ...acc, [zid]: [...(acc[zid] || []), capa] }), cs));
    const ids = nuevas.map((n) => n.capa.id);
    if (ids.length > 1) { setSeleccionUna(null); setVarios(ids); } else setSeleccion(ids[0]);
  };
  /** Ctrl+A: todo lo de este lado. */
  const elegirTodo = () => {
    const ids = (vista?.zonas || []).flatMap((z) => (capas[z.id] || []).map((c) => c.id));
    if (ids.length > 1) { setSeleccionUna(null); setVarios(ids); } else if (ids.length) setSeleccion(ids[0]);
  };
  const pasarAZona = (destino) => {
    const { capa } = elegida;
    if (!capa) return;
    cambiarCapas((cs) => ({
      ...cs,
      [elegida.zonaId]: cs[elegida.zonaId].filter((c) => c.id !== capa.id),
      [destino]: [...(cs[destino] || []), { ...capa, x: 0.5, y: 0.5 }],
    }));
    const z = todasLasZonas.find((x) => x.id === destino);
    setZonaId(destino);
    if (z) setVistaId(z.vista.id);
  };

  /**
   * Arrastrada fuera de su zona y soltada sobre otra de este lado: pasa a esa
   * donde se soltó. Si no entra, al 90% y al centro; un texto en una zona
   * larga va girado (como la tienda). Un solo paso de deshacer.
   */
  const pasarCapa = (id, destino, punto, { grupo, cambio } = {}) => {
    const { capa, zonaId: origen } = ubicar(id);
    const z = todasLasZonas.find((x) => x.id === destino);
    if (!capa || !z) { soltar(); return; }
    // Con el mismo tamaño y giro en pantalla (las medidas van en fracción de la zona).
    const kx = cambio?.x || 1;
    const ky = cambio?.y || 1;
    const igual = (c) => ({
      ...c,
      ...(c.tipo === 'imagen' ? { ancho: (c.ancho ?? 0.8) * kx } : { tamano: (c.tamano ?? 0.18) * kx }),
      angulo: Math.round((((c.angulo || 0) + (cambio?.giro || 0)) % 360 + 360) % 360),
    });
    if (grupo?.length > 1) {
      // Varias: van juntas, con la misma distancia entre ellas.
      const movidas = grupo.map(ubicar).filter((u) => u.capa);
      const fuera = new Set(movidas.map((u) => u.capa.id));
      const nuevas = movidas.map(({ capa: c }) => ({
        ...igual(c),
        x: limitar(punto.x + ((c.x ?? 0.5) - (capa.x ?? 0.5)) * kx, 0, 1),
        y: limitar(punto.y + ((c.y ?? 0.5) - (capa.y ?? 0.5)) * ky, 0, 1),
      }));
      cambiarCapas((cs) => ({
        ...Object.fromEntries(Object.entries(cs).map(([zid, lista]) => [zid, lista.filter((c) => !fuera.has(c.id))])),
        [destino]: [...(cs[destino] || []).filter((c) => !fuera.has(c.id)), ...nuevas],
      }), false);
      soltar();
      setZonaId(destino);
      return;
    }
    // Si no entra, al 90% (la copia que se arrastraba ya lo mostraba así).
    let nueva = { ...igual(capa), ...punto };
    if (capa.tipo === 'imagen' && nueva.ancho > 0.9) nueva = { ...nueva, ancho: 0.9 };
    if (capa.tipo === 'texto' && esLarga(z) && !esLarga(todasLasZonas.find((x) => x.id === origen)) && !(capa.angulo % 180)) nueva = { ...nueva, angulo: 90 };
    cambiarCapas((cs) => ({ ...cs, [origen]: cs[origen].filter((c) => c.id !== id), [destino]: [...(cs[destino] || []), nueva] }), false);
    soltar();
    setZonaId(destino);
  };
  /**
   * Arrastradas hasta "Suelta aquí para pasar a Espalda": pasan a ese lado,
   * a la zona del mismo nombre (o a la primera), en el lugar donde estaban
   * antes de arrastrarlas. Si no entra, al 90% y al centro; un texto en una
   * manga va girado.
   */
  const pasarALado = (ids, ladoId) => {
    const lado = vistas.find((v) => v.id === ladoId);
    // Donde estaban antes del arrastre (el arrastre las llevó hasta el borde).
    const antes = Object.values(arrastreInicio.current || {}).flat();
    const movidas = ids.map(ubicar).filter((u) => u.capa).map((u) => {
      const previa = antes.find((c) => c.id === u.capa.id);
      return previa ? { ...u, capa: { ...u.capa, x: previa.x, y: previa.y } } : u;
    });
    if (!lado?.zonas.length || !movidas.length) { soltar(); return; }
    const destinos = movidas.map(({ zonaId: zid }) => {
      const antes = todasLasZonas.find((z) => z.id === zid);
      return lado.zonas.find((z) => z.nombre === antes?.nombre) || lado.zonas[0];
    });
    cambiarCapas((cs) => {
      const fuera = new Set(movidas.map((u) => u.capa.id));
      const nuevo = Object.fromEntries(Object.entries(cs).map(([zid, lista]) => [zid, lista.filter((c) => !fuera.has(c.id))]));
      movidas.forEach(({ capa }, i) => {
        const z = destinos[i];
        let c = { ...capa, x: limitar(capa.x ?? 0.5, 0, 1), y: limitar(capa.y ?? 0.5, 0, 1) };
        if (c.tipo === 'imagen' && (c.ancho ?? 0.8) > 0.9) c = { ...c, ancho: 0.9, x: 0.5, y: 0.5 };
        if (c.tipo === 'texto' && esLarga(z) && !(c.angulo % 180)) c = { ...c, angulo: 90 };
        nuevo[z.id] = [...(nuevo[z.id] || []), c];
      });
      return nuevo;
    }, false);
    soltar();
    setVistaId(lado.id);
    setZonaId(destinos[0].id);
    onAviso?.({ tipo: 'info', titulo: movidas.length > 1 ? `Pasaron a ${lado.nombre}` : `Pasó a ${lado.nombre}` });
  };
  const [arrastrando, setArrastrando] = useState(null); // { lado }: se arrastra algo (los destinos de otro lado se ven)

  /** El recuadro del ratón: lo que tocó (con Shift, se suma a lo elegido). */
  const elegirVarias = (ids, { sumar } = {}) => {
    const lista = sumar ? [...new Set([...elegidas, ...ids])] : ids;
    if (lista.length > 1) { setSeleccionUna(null); setVarios(lista); } else setSeleccion(lista[0] || null);
  };

  const elegirZona = (id) => {
    setZonaId(id);
    const z = todasLasZonas.find((x) => x.id === id);
    if (z && z.vista.id !== vista?.id) setVistaId(z.vista.id);
  };
  /** Con `sumar` (Shift o Ctrl + clic) suma o quita de las elegidas. Con el dedo, la primera vez, la guía. */
  const elegirCapa = (id, zid, { sumar, tactil } = {}) => {
    if (tactil && !guiaVista.current) { guiaVista.current = true; setGuia(true); }
    if (sumar) {
      const actuales = new Set(elegidas);
      if (actuales.has(id)) actuales.delete(id); else actuales.add(id);
      const lista = [...actuales];
      if (lista.length > 1) { setSeleccionUna(null); setVarios(lista); } else setSeleccion(lista[0] || null);
      return;
    }
    // Tocar una de varias elegidas (para arrastrarlas) no suelta las otras.
    if (varios.includes(id)) return;
    setSeleccion(id);
    if (zid) setZonaId(zid);
  };

  /** Sin sesión: la hoja de iniciar sesión, con el texto de para qué. */
  const pedirLogin = (motivo) => { setMotivoLogin(motivo); setHoja('login'); };

  /**
   * Cambia el color de la prenda, como la tienda (cambiarColorPrenda): el
   * texto negro o blanco pasa al que se lee sobre el nuevo color; lo que
   * estaba en una zona que el nuevo color no tiene (un bicolor) pasa a la de
   * igual nombre en ese lado o a la primera; la talla se borra si ya no está.
   */
  const cambiarColor = (id) => {
    const nuevo = colores.find((c) => c.id === id);
    if (!nuevo || nuevo.id === color?.id) return;
    setColorId(nuevo.id);
    const tallasNuevas = nuevo.tallas?.length ? nuevo.tallas : prenda?.tallas || [];
    if (talla && !tallasNuevas.includes(talla)) setTalla(null);
    const letra = nuevo.oscura ? '#FFFFFF' : '#111111';
    const otra = letra === '#111111' ? '#FFFFFF' : '#111111';
    const vistasNuevas = nuevo.vistas || prenda?.vistas || [];
    const idsNuevos = new Set(vistasNuevas.flatMap((v) => v.zonas.map((z) => z.id)));
    const movidas = [];
    let cambio = false;
    const siguiente = Object.fromEntries(Object.entries(capas).map(([zid, lista]) => [zid, lista.map((c) => {
      if (c.tipo !== 'texto' || String(c.color || '').toUpperCase() !== otra) return c;
      cambio = true;
      return { ...c, color: letra };
    })]));
    Object.keys(siguiente).forEach((zid) => {
      if (idsNuevos.has(zid) || !siguiente[zid]?.length) return;
      const antes = todasLasZonas.find((z) => z.id === zid);
      const lado = vistasNuevas.find((v) => v.id === antes?.vista.id) || vistasNuevas[0];
      const destino = lado?.zonas.find((z) => z.nombre === antes?.nombre) || lado?.zonas[0];
      if (!destino) return;
      siguiente[destino.id] = [...(siguiente[destino.id] || []), ...siguiente[zid]];
      delete siguiente[zid];
      cambio = true;
      if (antes && antes.nombre !== destino.nombre) movidas.push(`${antes.nombre} → ${destino.nombre}`);
    });
    const ladoActual = vistasNuevas.find((v) => v.id === vista?.id);
    if (ladoActual && !ladoActual.zonas.some((z) => z.id === zonaId)) setZonaId(ladoActual.zonas[0]?.id);
    if (movidas.length) {
      setSeleccion(null);
      onAviso?.({ tipo: 'info', titulo: `${nuevo.nombre} tiene otras zonas de impresión`, texto: `Tu diseño pasó de ${movidas.join(', ')}.` });
    }
    if (cambio) cambiarCapas(() => siguiente);
  };

  /**
   * Sube una imagen: la que se elige (onSubirImagen abre el selector) o un
   * archivo pegado o soltado sobre la prenda (onSubirImagen(archivo)). Va en
   * la zona donde se soltó; si la zona ya tiene algo, un poco más chica.
   */
  const subirImagen = async (archivo, zid = zonaId) => {
    if (!sesion && requiereSesion?.imagen) { pedirLogin('continuar'); return; }
    if (!onSubirImagen) return;
    setOcupado('subiendo');
    try {
      const r = await onSubirImagen(archivo instanceof Blob ? archivo : undefined);
      // Sin aspecto de la tienda, se mide: lo necesitan "Llenar zona", las guías y el aviso de fuera de zona.
      const aspecto = r?.src ? r.aspecto || await medirAspecto(r.src) : null;
      // Entra entera en su zona, como en la tienda: el 80% (o la mitad si ya hay algo) del ancho o del alto.
      const base = (capas[zid] || []).length ? 0.5 : 0.8;
      const ancho = aspecto ? Math.min(base, (base * proporcionDe(zid)) / aspecto) : base;
      if (r?.src) agregarCapa({ tipo: 'imagen', src: r.src, px: r.px, aspecto: aspecto || undefined, ancho }, { zid });
    } finally {
      setOcupado(null);
    }
  };
  /** Un texto nuevo (en la zona elegida, o donde se hizo doble clic). */
  const escribirTexto = ({ zid = zonaId, punto, texto = 'Tu texto', editar = true } = {}) => {
    const larga = esLarga(todasLasZonas.find((z) => z.id === zid));
    const id = agregarCapa({
      tipo: 'texto', texto, fuente: fuentes[0]?.valor, tamano: larga ? 0.5 : 0.2, negrita: true,
      color: color?.oscura ? '#FFFFFF' : '#111111', ...(larga && { angulo: 90 }),
    }, { zid, punto });
    // En la computadora se escribe ahí mismo, con todo elegido (como la tienda).
    if (editar && conRaton()) setEditando(id);
    return id;
  };
  /** Mientras se escribe sobre la prenda (un solo paso de deshacer al terminar). */
  const escribir = (id, texto) => cambiarCapa(id, { texto }, false);
  /** Al terminar de escribir: si quedó vacío, se quita. */
  const terminarTexto = (id) => {
    setEditando((e) => (e === id ? null : e));
    const { capa } = ubicar(id);
    if (capa && !String(capa.texto || '').trim()) {
      cambiarCapas((cs) => Object.fromEntries(Object.entries(cs).map(([zid, lista]) => [zid, lista.filter((c) => c.id !== id)])), false);
      setSeleccion(null);
    }
    soltar();
  };
  /** Lleva el foco al campo del texto elegido, para escribir (doble clic en un texto). */
  const escribirEnPanel = () => window.requestAnimationFrame(() => {
    const campo = document.querySelector('[data-componente="PanelCapa"] textarea');
    campo?.focus();
    campo?.select();
  });
  const quitarFondo = async () => {
    const { capa } = elegida;
    if (!capa) return;
    if (motorFondo) { setSinFondo(capa); return; }
    if (!onQuitarFondo) return;
    setOcupado('fondo');
    try {
      const src = await onQuitarFondo(capa);
      if (src) cambiarCapa(capa.id, { src });
    } finally {
      setOcupado(null);
    }
  };

  /** La imagen recortada o sin fondo reemplaza a la de la capa, en su lugar. */
  const aplicarEdicion = async (capa, { blob, corte, natural, px }) => {
    const zonaDeCapa = todasLasZonas.find((z) => (capas[z.id] || []).some((c) => c.id === capa.id));
    const src = onImagenEditada ? await onImagenEditada({ capa, blob }) : URL.createObjectURL(blob);
    if (!src) return;
    cambiarCapa(capa.id, { src, px, ...reubicarTrasCorte(capa, corte, natural, zonaDeCapa?.proporcion) });
  };

  /** Las opciones del menú del clic derecho, según lo que haya bajo el puntero (las de la tienda). */
  const opcionesMenu = () => {
    if (!menu) return [];
    const pegarOpcion = { id: 'pegar', etiqueta: 'Pegar', Icono: ClipboardPaste, atajo: `${MOD}+V`, deshabilitado: !portapapeles.current?.length, accion: pegar };
    if (varios.length > 1) {
      return [
        { id: 'duplicar', etiqueta: 'Duplicar', Icono: Copy, atajo: `${MOD}+D`, accion: duplicar },
        { id: 'copiar', etiqueta: 'Copiar', Icono: Clipboard, atajo: `${MOD}+C`, accion: copiar },
        pegarOpcion,
        'separador',
        ...(mismaZona ? [
          { id: 'centrar', etiqueta: 'Centrar en la zona', Icono: Crosshair, atajo: 'C', accion: centrarVarios },
          { id: 'izq', etiqueta: 'Alinear a la izquierda', Icono: AlignStartVertical, accion: () => alinearVarios('izquierda') },
          { id: 'centroH', etiqueta: 'Alinear al centro', Icono: AlignCenterVertical, accion: () => alinearVarios('centroH') },
          { id: 'der', etiqueta: 'Alinear a la derecha', Icono: AlignEndVertical, accion: () => alinearVarios('derecha') },
          { id: 'arriba', etiqueta: 'Alinear arriba', Icono: AlignStartHorizontal, accion: () => alinearVarios('arriba') },
          { id: 'medio', etiqueta: 'Alinear al medio', Icono: AlignCenterHorizontal, accion: () => alinearVarios('centroV') },
          { id: 'abajo', etiqueta: 'Alinear abajo', Icono: AlignEndHorizontal, accion: () => alinearVarios('abajo') },
          ...(varios.length > 2 ? [
            { id: 'distH', etiqueta: 'Mismo espacio de lado a lado', Icono: AlignHorizontalDistributeCenter, accion: () => distribuir('h') },
            { id: 'distV', etiqueta: 'Mismo espacio de arriba abajo', Icono: AlignVerticalDistributeCenter, accion: () => distribuir('v') },
          ] : []),
          'separador',
        ] : []),
        { id: 'quitar', etiqueta: `Quitar los ${varios.length}`, Icono: Trash2, atajo: 'Supr', peligro: true, accion: () => quitarCapas() },
      ];
    }
    const capa = menu.capaId ? ubicar(menu.capaId).capa : null;
    if (!capa) {
      return [
        { id: 'texto', etiqueta: 'Agregar texto aquí', Icono: Type, atajo: 'T', accion: () => { escribirTexto({ zid: menu.zonaId, punto: menu.punto }); escribirEnPanel(); } },
        { id: 'imagen', etiqueta: 'Subir imagen', Icono: ImagePlus, atajo: 'I', accion: () => subirImagen(undefined, menu.zonaId) },
        pegarOpcion,
        { id: 'todo', etiqueta: 'Elegir todo', Icono: MousePointerSquareDashed, atajo: `${MOD}+A`, accion: elegirTodo },
        'separador',
        { id: 'deshacer', etiqueta: 'Deshacer', Icono: Undo2, atajo: `${MOD}+Z`, deshabilitado: !historia.pasado.length, accion: deshacer },
        { id: 'rehacer', etiqueta: 'Rehacer', Icono: Redo2, atajo: `${MOD}+Y`, deshabilitado: !historia.futuro.length, accion: rehacer },
      ];
    }
    const imagen = capa.tipo === 'imagen';
    return [
      ...(!imagen ? [{ id: 'escribir', etiqueta: 'Editar texto', Icono: Pencil, atajo: 'Doble clic', accion: escribirEnPanel }] : []),
      { id: 'duplicar', etiqueta: 'Duplicar', Icono: Copy, atajo: `${MOD}+D`, accion: duplicar },
      { id: 'copiar', etiqueta: 'Copiar', Icono: Clipboard, atajo: `${MOD}+C`, accion: copiar },
      pegarOpcion,
      'separador',
      { id: 'adelante', etiqueta: 'Traer adelante', Icono: ArrowUpToLine, atajo: ']', accion: () => reordenar(true) },
      { id: 'atras', etiqueta: 'Enviar atrás', Icono: ArrowDownToLine, atajo: '[', accion: () => reordenar(false) },
      { id: 'centrar', etiqueta: 'Centrar en la zona', Icono: Crosshair, atajo: 'C', accion: () => cambiarCapa(capa.id, { x: 0.5, y: 0.5 }) },
      { id: 'girar', etiqueta: 'Girar', Icono: RotateCw, atajo: 'R', accion: () => girar(1) },
      ...(imagen ? [
        { id: 'voltear', etiqueta: 'Voltear', Icono: FlipHorizontal, atajo: 'F', accion: () => cambiarCapa(capa.id, { voltear: !capa.voltear }) },
        { id: 'recortar', etiqueta: 'Recortar', Icono: Crop, atajo: 'Doble clic', deshabilitado: !sesion, accion: () => setRecortando(capa) },
        { id: 'fondo', etiqueta: 'Quitar fondo', Icono: Eraser, deshabilitado: !sesion, accion: quitarFondo },
        { id: 'llenar', etiqueta: 'Llenar zona', Icono: Maximize2, accion: () => llenarZona(capa.id) },
      ] : []),
      'separador',
      { id: 'quitar', etiqueta: 'Quitar', Icono: Trash2, atajo: 'Supr', peligro: true, accion: () => quitarCapa(capa.id) },
    ];
  };

  /* ── Zoom y vista ── */
  /** Cambia el zoom dejando quieto el punto `p` (px desde el centro del lienzo). */
  const zoomEn = (zNuevo, p = { x: 0, y: 0 }) => {
    const z = limitar(zNuevo, 1, ZOOM_MAX);
    if (z === 1) { setZoom(1); return; }
    setCamara((c) => ({ x: p.x - (p.x - c.x) * (z / zoom), y: p.y - (p.y - c.y) * (z / zoom) }));
    setZoomEstado(z);
  };
  /** Shift+2: acerca a lo elegido (lo deja al centro). */
  const acercarAElegida = () => {
    const el = elegidas[0] && document.querySelector(`[data-componente="LienzoPrenda"] [data-capa="${elegidas[0]}"]`);
    const marco = lienzoRef.current?.querySelector('[data-componente="LienzoPrenda"]');
    if (!el || !marco) return;
    const r = el.getBoundingClientRect();
    const m = marco.getBoundingClientRect();
    const z = Math.max(2, zoom);
    // Punto de la capa sin zoom ni vista, desde el centro; luego, al centro con el zoom nuevo.
    const u = { x: (r.left + r.width / 2 - (m.left + m.width / 2) - camara.x) / zoom, y: (r.top + r.height / 2 - (m.top + m.height / 2) - camara.y) / zoom };
    setZoomEstado(z);
    setCamara({ x: -u.x * z, y: -u.y * z });
  };
  /** Rueda sobre el lienzo: con Ctrl (o el pellizco del trackpad), zoom hacia el puntero; con zoom, recorre la prenda. */
  const alRodar = ({ deltaX, deltaY, ctrl, shift, x, y }) => {
    if (ctrl) { zoomEn(zoom * Math.exp(-deltaY * 0.01), { x, y }); return; }
    if (zoom <= 1) return;
    setCamara((c) => (shift ? { x: c.x - (deltaY || deltaX), y: c.y } : { x: c.x - deltaX, y: c.y - deltaY }));
  };

  /**
   * Dos dedos: con algo elegido, lo agrandan o achican y lo giran (cerca de
   * un múltiplo de 90° se queda derecho, como en la tienda); sin nada, acercan
   * la prenda y la recorren. Se guarda una sola vez, al soltar.
   */
  const gestoBase = useRef(null);
  const alGesto = ({ fase, factor = 1, giro = 0, centro, desplazar }) => {
    if (fase === 'inicio') {
      const { capa } = elegida;
      gestoBase.current = capa
        ? { id: capa.id, imagen: capa.tipo === 'imagen', ancho: capa.ancho ?? 0.8, tamano: capa.tamano ?? 0.18, angulo: capa.angulo || 0, x: capa.x ?? 0.5, y: capa.y ?? 0.5 }
        : { zoom, camara, centro };
      return;
    }
    const b = gestoBase.current;
    if (!b) return;
    if (fase === 'fin') {
      gestoBase.current = null;
      if (b.id) soltar();
      return;
    }
    if (b.id) {
      let angulo = b.angulo + giro;
      const derecho = Math.round(angulo / 90) * 90;
      if (Math.abs(angulo - derecho) < 6) angulo = derecho;
      angulo = Math.round(((angulo % 360) + 360) % 360);
      // El punto medio de los dedos también la mueve.
      const pos = desplazar ? { x: limitar(b.x + desplazar.x, 0, 1), y: limitar(b.y + desplazar.y, 0, 1) } : {};
      cambiarCapa(b.id, b.imagen
        ? { ancho: limitar(b.ancho * factor, 0.02, 4), angulo, ...pos }
        : { tamano: limitar(b.tamano * factor, 0.01, 2), angulo, ...pos }, false);
      return;
    }
    // El punto de la prenda que estaba bajo los dedos los sigue.
    const z = limitar(b.zoom * factor, 1, ZOOM_MAX);
    if (z === 1) { setZoom(1); return; }
    const u = { x: (b.centro.x - b.camara.x) / b.zoom, y: (b.centro.y - b.camara.y) / b.zoom };
    setZoomEstado(z);
    setCamara({ x: centro.x - u.x * z, y: centro.y - u.y * z });
  };
  /**
   * Teléfono: con algo elegido, la vista se acerca a su zona (con una
   * animación corta, cuando se levanta el dedo); al soltarlo vuelve a la
   * prenda entera. "Ver la prenda completa" lo apaga. El zoom a mano manda.
   */
  const zonaDeLaElegida = elegida.zonaId;
  const dedoAbajo = useRef(false);
  useEffect(() => {
    const marco = lienzoRef.current?.querySelector('[data-componente="LienzoPrenda"]');
    const esc = marco?.querySelector('[data-escala]');
    const animar = (z, cam) => {
      setCamaraSuave(true);
      setZoomEstado(z);
      setCamara(cam);
      setTimeout(() => setCamaraSuave(false), 300);
    };
    if (!zonaDeLaElegida || completa || !enTelefono()) {
      if (zoomAuto.current) { zoomAuto.current = false; animar(1, { x: 0, y: 0 }); }
      return undefined;
    }
    if (zoom > 1 && !zoomAuto.current) return undefined; // el zoom que puso la persona
    const el = marco?.querySelector(`[data-zona="${CSS.escape(zonaDeLaElegida)}"]`);
    if (!el || !esc) return undefined;
    const acercar = () => {
      const z0 = todasLasZonas.find((x) => x.id === zonaDeLaElegida);
      const a = ((z0?.angulo || 0) * Math.PI) / 180;
      const bw = Math.abs(Math.cos(a)) * el.offsetWidth + Math.abs(Math.sin(a)) * el.offsetHeight;
      const bh = Math.abs(Math.sin(a)) * el.offsetWidth + Math.abs(Math.cos(a)) * el.offsetHeight;
      const z = limitar(Math.min(marco.clientWidth / (bw * 1.3), marco.clientHeight / (bh * 1.3)), 1, 3);
      const u = { x: el.offsetLeft + el.offsetWidth / 2 - esc.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 - esc.offsetHeight / 2 };
      zoomAuto.current = true;
      animar(z, { x: -u.x * z, y: -u.y * z });
    };
    // Si el dedo sigue abajo (arrastrando), espera a que se levante.
    if (dedoAbajo.current) {
      window.addEventListener('pointerup', acercar, { once: true });
      return () => window.removeEventListener('pointerup', acercar);
    }
    acercar();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonaDeLaElegida, completa]);
  useEffect(() => { if (!seleccion) setCompleta(false); }, [seleccion]);
  useEffect(() => {
    const abajo = (e) => { if (e.pointerType === 'touch') dedoAbajo.current = true; };
    const arriba = () => { dedoAbajo.current = false; };
    window.addEventListener('pointerdown', abajo, true);
    window.addEventListener('pointerup', arriba, true);
    window.addEventListener('pointercancel', arriba, true);
    return () => {
      window.removeEventListener('pointerdown', abajo, true);
      window.removeEventListener('pointerup', arriba, true);
      window.removeEventListener('pointercancel', arriba, true);
    };
  }, []);
  const cerrarGuia = () => { setGuia(false); onGuiaGestosVista?.(); };
  /** En el celular el panel queda debajo: "Editar" baja hasta él. */
  const irAlPanel = () => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  /** Girar de 90° en 90° (R) o hacia el otro lado (Shift+R). */
  const girar = (sentido = 1) => {
    const { capa } = elegida;
    if (!capa) return;
    cambiarCapa(capa.id, { angulo: ((Math.round((capa.angulo || 0) / 90) * 90 + 90 * sentido) % 360 + 360) % 360 });
  };
  /** Mueve lo elegido (una o varias) con las flechas. */
  const moverElegidas = (dx, dy) => {
    const ids = new Set(elegidas);
    cambiarCapas((cs) => Object.fromEntries(Object.entries(cs).map(([zid, lista]) => [zid, lista.map((c) => (ids.has(c.id)
      ? { ...c, x: limitar((c.x ?? 0.5) + dx, 0, 1), y: limitar((c.y ?? 0.5) + dy, 0, 1) }
      : c))])));
  };

  // Atajos de teclado (no mientras se escribe en un campo ni con una hoja abierta). Ver AtajosEstudio.
  const teclas = useRef(null);
  teclas.current = (e) => {
    if (e.target.isContentEditable || e.target.closest?.('input, textarea, select, [contenteditable], [role="dialog"], [role="menu"]')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (ctrl && tecla === 'z') { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); return; }
    if (ctrl && tecla === 'y') { e.preventDefault(); rehacer(); return; }
    if (ctrl && tecla === 's') { e.preventDefault(); guardarRef.current?.(); return; }
    if (ctrl && tecla === 'a') { e.preventDefault(); elegirTodo(); return; }
    if (ctrl && (tecla === '+' || tecla === '=')) { e.preventDefault(); setZoom(zoomVecino(zoom, true)); return; }
    if (ctrl && tecla === '-') { e.preventDefault(); setZoom(zoomVecino(zoom, false)); return; }
    if (ctrl && tecla === '0') { e.preventDefault(); setZoom(1); return; }
    // Ctrl+V lo atiende el evento de pegar (puede traer una imagen o un texto).
    if (ctrl && tecla === 'd') { e.preventDefault(); duplicar(); return; }
    if (ctrl && tecla === 'c') { if (elegidas.length) { e.preventDefault(); copiar(); } return; }
    if (ctrl && tecla === 'x') { if (elegidas.length) { e.preventDefault(); cortar(); } return; }
    if (ctrl || e.altKey) return;
    if (e.shiftKey && e.code === 'Digit1') { e.preventDefault(); setZoom(1); return; }
    if (e.shiftKey && e.code === 'Digit2') { e.preventDefault(); acercarAElegida(); return; }
    if (tecla === ' ' && !e.repeat) { e.preventDefault(); setEspacio(true); return; }
    if (tecla === '?') { e.preventDefault(); setHoja('atajos'); return; }
    if (tecla === 't') { e.preventDefault(); escribirTexto(); return; }
    if (tecla === 'i') { e.preventDefault(); subirImagen(); return; }
    if (/^[1-9]$/.test(tecla) && vistas[Number(tecla) - 1]) {
      const v = vistas[Number(tecla) - 1];
      setVistaId(v.id);
      if (!v.zonas.some((z) => z.id === zonaId)) setZonaId(v.zonas[0]?.id);
      setSeleccion(null);
      return;
    }
    if (tecla === 'Escape') { setSeleccion(null); return; }
    if (!elegidas.length) {
      // Con zoom y nada elegido, las flechas recorren la prenda.
      if (zoom > 1 && tecla.startsWith('Arrow')) {
        e.preventDefault();
        const paso = e.shiftKey ? 120 : 40;
        const [dx, dy] = { ArrowLeft: [paso, 0], ArrowRight: [-paso, 0], ArrowUp: [0, paso], ArrowDown: [0, -paso] }[tecla];
        setCamara((c) => ({ x: c.x + dx, y: c.y + dy }));
      }
      return;
    }
    if (tecla === 'Delete' || tecla === 'Backspace') { e.preventDefault(); quitarCapas(); return; }
    if (tecla.startsWith('Arrow')) {
      e.preventDefault();
      const paso = e.shiftKey ? 0.05 : 0.005; // como la tienda: 0,5% (con Shift, 5%)
      const [dx, dy] = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[tecla];
      moverElegidas(dx, dy);
      return;
    }
    if (varios.length > 1) {
      if (tecla === 'c') centrarVarios();
      return;
    }
    if (tecla === '+' || tecla === '=') escalar(1.05);
    else if (tecla === '-') escalar(1 / 1.05);
    else if (tecla === 'PageUp') { e.preventDefault(); reordenar(true); }
    else if (tecla === 'PageDown') { e.preventDefault(); reordenar(false); }
    else if (tecla === 'r') girar(e.shiftKey ? -1 : 1);
    else if (tecla === 'c') cambiarCapa(elegida.capa.id, { x: 0.5, y: 0.5 });
    else if (tecla === 'f' && elegida.capa?.tipo === 'imagen') cambiarCapa(elegida.capa.id, { voltear: !elegida.capa.voltear });
    else if (tecla === ']') reordenar(true);
    else if (tecla === '[') reordenar(false);
  };
  // Ctrl+V: una imagen copiada (de otra página o una captura), lo copiado aquí o un texto.
  const pegarEvento = useRef(null);
  pegarEvento.current = (e) => {
    if (estado || hoja || menu || e.target.isContentEditable || e.target.closest?.('input, textarea, [contenteditable], [role="dialog"]')) return;
    const archivo = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (archivo) { e.preventDefault(); subirImagen(archivo); return; }
    if (portapapeles.current?.length) { e.preventDefault(); pegar(); return; }
    const texto = (e.clipboardData?.getData('text/plain') || '').trim();
    if (texto && zona) { e.preventDefault(); escribirTexto({ texto: texto.slice(0, 120), editar: false }); }
  };
  useEffect(() => {
    const abajo = (e) => teclas.current(e);
    const arriba = (e) => { if (e.key === ' ') setEspacio(false); };
    const alPegar = (e) => pegarEvento.current(e);
    window.addEventListener('keydown', abajo);
    window.addEventListener('keyup', arriba);
    window.addEventListener('paste', alPegar);
    return () => {
      window.removeEventListener('keydown', abajo);
      window.removeEventListener('keyup', arriba);
      window.removeEventListener('paste', alPegar);
    };
  }, []);

  if (estado === 'cargando') return <EsqueletoPagina forma="estudio" sesion={sesion} />;
  if (estado === 'error' || estado === 'noDisponible' || !prenda) {
    const error = estado === 'error';
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={s.estado}>
          <EstadoVacio
            imagen={CARAS_KAPI.triste}
            titulo={error ? 'No pudimos abrir el estudio' : 'Esta prenda ya no se puede diseñar'}
            texto={error ? 'Revisa tu conexión e inténtalo de nuevo.' : 'Elige otra prenda en Crear y empieza tu diseño.'}
          >
            {error
              ? <Boton icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>
              : <Boton to={urlCrear}>Ir a Crear</Boton>}
          </EstadoVacio>
        </div>
      </BloqueSeccion>
    );
  }

  // Lo que el diseño lleva hoy: lados y zonas con algo.
  const conDiseno = new Set(Object.entries(capas).filter(([, l]) => l.length).map(([zid]) => zid));
  const ladosConDiseno = vistas.filter((v) => v.zonas.some((z) => conDiseno.has(z.id)));
  const vacio = conDiseno.size === 0;
  const diseno = { color: color?.id, capas, lados: ladosConDiseno.map((v) => v.nombre) };

  // El color: los originales en las muestras; el "al revés" se elige con el interruptor.
  const espejoDe = color?.espejoDe;
  const original = espejoDe ? colores.find((c) => c.id === espejoDe) : color;
  const alReves = colores.find((c) => c.espejoDe === original?.id);
  const muestras = colores.filter((c) => !c.espejoDe).map((c) => ({ id: c.id, nombre: c.nombre, hex: c.hex, claro: c.claro }));
  const fotoDelLado = (v) => color?.fotos?.[v.id];
  const tallas = color?.tallas?.length ? color.tallas : prenda.tallas || [];
  const precio = prenda.precio || 0;

  const lienzo = (props) => (
    <LienzoPrenda
      imagen={vista.imagen}
      foto={fotoDelLado(vista)}
      tinte={fotoDelLado(vista) || color?.blanco ? undefined : color?.tinte}
      voltear={color?.espejo}
      anchoImg={vista.anchoImg}
      altoImg={vista.altoImg}
      zonas={vista.zonas}
      capas={capas}
      oscura={color?.oscura}
      {...props}
    />
  );

  // Cambios sin guardar: contra lo último guardado (o, si nunca se guardó, contra vacío).
  const firmaActual = firmaDe(color?.id, capas);
  const hayCambios = firmaGuardada === null ? !vacio : firmaActual !== firmaGuardada;
  const yaGuardada = firmaGuardada !== null;

  const confirmarGuardar = async ({ conHoja = true } = {}) => {
    setOcupado('guardando');
    try {
      const r = await onGuardar?.({ nombre: nombre.trim() || `Mi ${prenda.nombre?.split(' ')[0]?.toLowerCase() || 'creación'}`, diseno });
      setUrlCreacion(r?.urlCreacion || null);
      setFirmaGuardada(firmaActual);
      if (conHoja) setHoja('guardada');
      else onAviso?.({ tipo: 'exito', titulo: 'Cambios guardados' });
    } finally {
      setOcupado(null);
    }
  };
  // Sin sesión pide entrar; si ya está guardada, guarda sin preguntar el nombre.
  const guardar = () => {
    if (!sesion) { pedirLogin('guardar'); return; }
    if (!hayCambios) return;
    if (yaGuardada) confirmarGuardar({ conHoja: false });
    else setHoja('guardar');
  };
  guardarRef.current = guardar;
  const agregar = async () => {
    if (borradorAdmin || agotado) return;
    if (!sesion && requiereSesion?.carrito) { pedirLogin('continuar'); return; }
    if (tallas.length && !talla) { setHoja('talla'); return; }
    setOcupado('agregando');
    try {
      await onAgregar?.({ talla, cantidad, diseno });
      setHoja(null);
      marcarAgregado();
    } finally {
      setOcupado(null);
    }
  };

  const aviso = borradorAdmin ? (
    <Aviso compacto tipo="aviso">Borrador: solo los administradores ven esta prenda. Publícala desde Admin → Productos para poder comprarla.</Aviso>
  ) : combo ? (
    <Aviso compacto tipo="info">{`Prenda ${combo.numero} de ${combo.total} de tu combo «${combo.nombre}». Al terminar, vuelve al combo con tu diseño.`}</Aviso>
  ) : modo === 'plantilla' ? (
    <Aviso compacto tipo="info">{`Partes del diseño «${plantilla || 'de la comunidad'}». Cámbiale el nombre, la foto o lo que quieras.`}</Aviso>
  ) : !sesion && modo !== 'editar' ? (
    <Aviso
      compacto
      tipo="info"
      icono={<LogIn aria-hidden="true" />}
      accion={!vacio ? <Boton variante="fantasma" tamano="sm" to={urlLogin}>Iniciar sesión</Boton> : undefined}
    >
      {vacio ? 'Puedes diseñar sin cuenta. Para subir una imagen o guardar, inicia sesión.' : 'Inicia sesión para guardar tu diseño como borrador y continuarlo después.'}
    </Aviso>
  ) : null;

  // En un combo: además, este diseño en las otras prendas (las que tienen otro, lo reemplaza).
  const otrasDelCombo = [...(combo?.otras?.iguales || []).map((n) => ({ n, reemplaza: false })), ...(combo?.otras?.conOtroDiseno || []).map((n) => ({ n, reemplaza: true }))];
  const avisos = (<>      {modo === 'editar' && sesion && (
        <div className={s.aviso}>
          <EstadoEdicion
            esBorrador={esBorrador}
            estadoBorrador={estadoBorrador}
            nombre={nombre || inicial.nombre}
            onRenombrar={onRenombrar ? async (n) => { await onRenombrar(n); setNombre(n); } : undefined}
            hayCambios={hayCambios}
            onEmpezarNuevo={onEmpezarNuevo}
          />
        </div>
      )}
      {aviso && <div className={s.aviso}>{aviso}</div>}

</>);
  const escena = (
        <EscenaEstudio
          escenaRef={lienzoRef}
          lados={vistas.map((v) => ({ id: v.id, nombre: v.nombre, cuenta: v.zonas.reduce((n, z) => n + (capas[z.id]?.length || 0), 0) }))}
          lado={vista.id}
          onLado={(id) => { setVistaId(id); const v = vistas.find((x) => x.id === id); if (v && !v.zonas.some((z) => z.id === zonaId)) setZonaId(v.zonas[0]?.id); setSeleccion(null); }}
          zona={zona ? nombreZona(zona) : undefined}
        >
          {lienzo({
            className: s.lienzo,
            zonaActiva: zonaId,
            seleccion: elegidas,
            zoom,
            camara,
            onCamara: setCamara,
            moverVista: espacio,
            onRueda: alRodar,
            onElegirZona: (id) => { elegirZona(id); setSeleccion(null); },
            onElegirCapa: elegirCapa,
            onMoverCapa: moverCapa,
            onSoltarCapa: soltar,
            onMenu: setMenu,
            onDobleClic: ({ capaId, zonaId: zid, punto }) => {
              if (!capaId) { escribirTexto({ zid, punto }); if (!conRaton()) escribirEnPanel(); return; }
              const { capa } = ubicar(capaId);
              setSeleccion(capaId);
              if (capa?.tipo === 'imagen') { if (sesion) setRecortando(capa); } else if (conRaton()) setEditando(capaId); else escribirEnPanel();
            },
            onSoltarArchivo: (archivo, zid) => subirImagen(archivo, zid),
            onGesto: alGesto,
            cargando: cargandoDiseno,
            onPasarCapa: pasarCapa,
            onElegirVarias: elegirVarias,
            onEncajar: encajar,
            editando,
            onEscribir: escribir,
            onTerminarTexto: terminarTexto,
            camaraSuave,
            onArrastre: vistas.length > 1 ? ({ activo, lado }) => setArrastrando(activo ? { lado: lado || null } : null) : undefined,
            onPasarALado: pasarALado,
            encima: arrastrando ? (
              // Mientras se arrastra algo: arriba de la prenda, a qué otro lado se puede pasar.
              <SoltarLados lados={vistas.filter((v) => v.id !== vista.id).map((v) => ({ id: v.id, nombre: v.nombre }))} activo={arrastrando.lado} />
            ) : guia ? <GuiaGestos onEntendido={cerrarGuia} /> : vacio && !cargandoDiseno && zona && zoom === 1 && (
              <InicioLienzoEstudio zona={nombreZona(zona)} onImagen={() => subirImagen()} onTexto={() => escribirTexto()} subiendo={ocupado === "subiendo"} />
            ),
          })}
          <BarraLienzo
            puedeDeshacer={historia.pasado.length > 0}
            puedeRehacer={historia.futuro.length > 0}
            onDeshacer={deshacer}
            onRehacer={rehacer}
            elegido={Boolean(elegida.capa)}
            onAchicar={() => escalar(1 / 1.12)}
            onAgrandar={() => escalar(1.12)}
            onCentrar={() => elegida.capa && cambiarCapa(elegida.capa.id, { x: 0.5, y: 0.5 })}
            onQuitar={() => elegida.capa && quitarCapa(elegida.capa.id)}
            onImagen={() => subirImagen()}
            onTexto={() => escribirTexto()}
            zoom={zoom}
            onZoom={setZoom}
            onAtajos={() => setHoja('atajos')}
            onEditar={irAlPanel}
            completa={completa}
            onVerCompleta={zoomAuto.current || completa ? () => setCompleta((c) => !c) : undefined}
          />
        </EscenaEstudio>

);
  const panel = (<>
            {varios.length > 1 ? (
              <PanelVarios
                cantidad={capasElegidas.length}
                mismaZona={Boolean(mismaZona)}
                onListo={() => setSeleccion(null)}
                onAlinear={alinearVarios}
                onDistribuir={distribuir}
                onCentrar={centrarVarios}
                onDuplicar={duplicar}
                onQuitar={() => quitarCapas()}
              />
            ) : elegida.capa ? (
              <PanelCapa
                key={elegida.capa.id}
                capa={elegida.capa}
                zona={nombreZona(zonaElegida)}
                fuentes={fuentes}
                calidad={calidadDe(elegida.capa, zonaElegida)}
                onNitida={() => dejarNitida(elegida.capa.id)}
                fueraDeZona={fueraDeZona(elegida.capa, zonaElegida)}
                anchoZonaCm={zonaElegida?.anchoCm}
                sinSesion={!sesion}
                onCambiar={(c) => cambiarCapa(elegida.capa.id, c)}
                onListo={() => setSeleccion(null)}
                onAchicar={() => escalar(1 / 1.12)}
                onAgrandar={() => escalar(1.12)}
                onCentrar={() => cambiarCapa(elegida.capa.id, { x: 0.5, y: 0.5 })}
                onAlinear={alinear}
                onQuitar={() => quitarCapa(elegida.capa.id)}
                onDuplicar={duplicar}
                onAdelante={() => reordenar(true)}
                onAtras={() => reordenar(false)}
                onLlenar={() => llenarZona(elegida.capa.id)}
                onRecortar={() => setRecortando(elegida.capa)}
                onQuitarFondo={quitarFondo}
                zonas={todasLasZonas.filter((z) => z.id !== elegida.zonaId).map((z) => ({ id: z.id, nombre: nombreZona(z) }))}
                onPasarAZona={pasarAZona}
                onImagen={() => subirImagen()}
                onTexto={() => escribirTexto()}
              />
            ) : (
              <PasosEstudio
                colores={muestras}
                color={original?.id}
                onColor={cambiarColor}
                invertir={alReves ? {
                  activo: Boolean(espejoDe),
                  texto: 'Los dos tonos cambian de lado.',
                  onCambiar: (v) => cambiarColor(v ? alReves.id : original.id),
                } : undefined}
                lados={vistas.map((v) => ({ nombre: v.nombre, zonas: v.zonas.map((z) => ({ id: z.id, nombre: z.nombre, conDiseno: conDiseno.has(z.id) })) }))}
                zona={zonaId}
                onZona={elegirZona}
                onImagen={() => subirImagen()}
                onTexto={() => escribirTexto()}
                subiendo={ocupado === 'subiendo'}
                donde={nombreZona(zona)}
                conDiseno={!vacio}
              />
            )}
</>);
  return (
    <MarcoEstudio nombre={prenda.nombre} color={color} lados={ladosConDiseno.map((v) => v.nombre)}
      precio={precio} precioAntes={prenda.precioAntes} sesion={sesion} urlVolver={urlVolver}
      etiquetaVolver={etiquetaVolver} urlCreaciones={urlCreaciones} panelRef={panelRef}
      avisos={avisos}
      lienzo={escena}
      panel={panel}
      compra={<CompraEstudio precio={precio} vacio={vacio} agotado={agotado} borradorAdmin={borradorAdmin}
        ocupado={ocupado} hayCambios={hayCambios} yaGuardada={yaGuardada} agregado={agregado}
        onGuardar={guardar} onDescargar={() => onDescargar?.(diseno)}
        onAgregar={combo ? () => onUsarEnCombo?.(diseno, { copiarA }) : agregar}
        combo={combo ? { opciones: otrasDelCombo.map(({ n, reemplaza }) => ({
          id: n, activo: copiarA.includes(n), etiqueta: 'Ponerlo también en la prenda ' + n,
          descripcion: reemplaza ? 'Reemplaza el diseño que ya tiene.' : undefined,
          onCambiar: (v) => setCopiarA((a) => v ? [...a,n] : a.filter((x) => x !== n)),
        })) } : undefined} />}
    >
      <HojasEstudio prenda={prenda.nombre} color={color?.nombre} precio={precio} tallas={tallas} talla={talla} onTalla={setTalla} cantidad={cantidad} onCantidad={setCantidad} ocupado={ocupado}
        pidiendoTalla={hoja === "talla"} onCerrarTalla={() => setHoja(null)} onComprar={agregar}
        guardando={hoja === "guardar"} onCerrarGuardar={() => setHoja(null)} nombre={nombre} onNombre={setNombre} onGuardar={() => confirmarGuardar()}
        vistaPrevia={hoja === "guardar" || hoja === "guardada" ? lienzo({ guias: false, className: s.lienzoMini }) : undefined}
        guardada={hoja === "guardada" ? { name: nombre.trim() || "Tu creación" } : null} onCerrarGuardada={() => setHoja(null)} urlCreacion={urlCreacion}
        onVolverCombo={combo ? () => { setHoja(null); onUsarEnCombo?.(diseno, { copiarA }); } : undefined}
        login={hoja === "login"} onCerrarLogin={() => setHoja(null)} urlLogin={urlLogin} urlRegistro={urlRegistro} motivoLogin={motivoLogin}
      />

      {/* Atajos de teclado. */}
      <HojaInferior abierta={hoja === 'atajos'} onCerrar={() => setHoja(null)} titulo="Atajos de teclado">
        <AtajosEstudio lados={vistas.map((v) => v.nombre)} />
      </HojaInferior>

      {/* Clic derecho (o toque largo): las opciones de lo que hay bajo el puntero. */}
      <MenuContextual
        abierto={Boolean(menu)}
        x={menu?.x}
        y={menu?.y}
        onCerrar={() => setMenu(null)}
        items={opcionesMenu()}
        titulo={varios.length > 1 ? `${varios.length} elementos` : menu?.capaId ? 'Lo elegido' : 'En esta zona'}
      />

      {/* Recortar: recuadro libre, conserva la transparencia y el lugar en la prenda. */}
      <RecortarFoto
        abierta={Boolean(recortando)}
        src={recortando?.src}
        forma="libre"
        onCancelar={() => setRecortando(null)}
        onListo={async (blob, { corte, natural }) => {
          if (blob) await aplicarEdicion(recortando, { blob, corte, natural, px: corte.w });
          setRecortando(null);
        }}
      />

      {motorFondo && (
        <QuitarFondo
          abierta={Boolean(sinFondo)}
          src={sinFondo?.src}
          motor={motorFondo}
          onCancelar={() => setSinFondo(null)}
          onAplicar={async (r) => {
            if (r) await aplicarEdicion(sinFondo, { blob: r.blob, corte: r.corte, natural: r.natural, px: r.ancho });
            setSinFondo(null);
          }}
        />
      )}

      {ocupado === 'fondo' && <CapaCargando texto="Quitando el fondo" detalle="Tarda unos segundos." />}
      {/* La tienda avisa lo que está haciendo ("Preparando el archivo de impresión (Frente · Pecho)…"). */}
      {procesando && <CapaCargando texto={procesando} detalle="No cierres esta página." />}

    </MarcoEstudio>
  );
}
