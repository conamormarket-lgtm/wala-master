import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Save, Download, ShoppingBag, CheckCircle2, LogIn, RotateCcw, Images } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio, HojaInferior } from '../Feedback';
import { Campo, Cantidad, SelectorTalla } from '../Formulario';
import { Pestanas } from '../Navegacion';
import { CapaCargando } from '../Cargando';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { soles } from '../TarjetaProducto';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { RecortarFoto } from '../piezas/RecortarFoto';
import { QuitarFondo } from '../piezas/QuitarFondo';
import { LienzoPrenda, BarraLienzo, PasosEstudio, PanelCapa, EstadoEdicion } from '../piezas/Estudio';
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

const ATAJOS = [
  ['Ctrl + Z', 'Deshacer'], ['Ctrl + Y', 'Rehacer'], ['Flechas', 'Mover lo elegido'],
  ['+ / −', 'Agrandar o achicar'], ['Supr', 'Quitar lo elegido'], ['Esc', 'Soltar lo elegido'],
];

/** "Frente · Pecho" (o solo "Espalda" si la zona se llama como su lado). */
const nombreZona = (z) => (!z ? '' : z.nombre === z.vista.nombre ? z.nombre : `${z.vista.nombre} · ${z.nombre}`);

/**
 * Calidad de impresión de una imagen, con la regla de la tienda
 * (calidadDeCapa): cuánto hay que estirar sus píxeles para el ancho que ocupa
 * en el archivo de impresión. Con la medida real de la zona, a 300 dpi; sin
 * ella, la zona entera son 3600 px.
 */
const calidadPorDefecto = (capa, zona) => {
  if (capa?.tipo !== 'imagen' || !capa.px || !zona) return undefined;
  const anchoZonaPx = zona.anchoCm > 0 ? (zona.anchoCm / 2.54) * 300 : 3600;
  const estiramiento = ((capa.ancho ?? 0.8) * anchoZonaPx) / capa.px;
  return estiramiento <= 1.5 ? 'buena' : estiramiento <= 2.5 ? 'regular' : 'baja';
};

/**
 * ¿Una parte de la imagen queda fuera de su zona? (no se imprime). Del texto
 * no se sabe el ancho aquí: lo avisa la tienda con `fueraDeZona`.
 */
const fueraPorDefecto = (capa) => {
  if (capa?.tipo !== 'imagen') return false;
  const medioAncho = (capa.ancho ?? 0.8) / 2;
  const medioAlto = capa.aspecto ? (medioAncho * capa.aspecto) : 0;
  const x = capa.x ?? 0.5;
  const y = capa.y ?? 0.5;
  return x - medioAncho < -0.01 || x + medioAncho > 1.01 || (medioAlto > 0 && (y - medioAlto < -0.01 || y + medioAlto > 1.01));
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
 *  - combo: { nombre, numero, total } si se diseña una prenda de un combo
 *  - sesion · fuentes: [{ valor, texto, detalle }] para la lista de letras
 *  - onSubirImagen(): promesa → { src, px } (o null si se cancela)
 *  - onQuitarFondo(capa): promesa → src · onGuardar({ nombre, diseno }): promesa
 *  - onAgregar({ talla, cantidad, diseno }): promesa · onDescargar(diseno)
 *  - onUsarEnCombo(diseno) · urlVolver, urlLogin, urlCreaciones
 *  - estado: 'cargando' | 'error' | 'noDisponible' · onReintentar · urlCrear
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
 */
export function PaginaEstudio({
  prenda, inicial = {}, modo = 'nuevo', plantilla, combo, sesion = false, fuentes = [],
  onSubirImagen, onQuitarFondo, onGuardar, onAgregar, onDescargar, onUsarEnCombo,
  urlVolver = '/personalizar', urlLogin = '/login', urlRegistro = '/registro', urlCreaciones = '/cuenta/creaciones',
  estado, onReintentar, urlCrear = '/personalizar',
  calidadDe = calidadPorDefecto, fueraDeZona = fueraPorDefecto, motorFondo, onImagenEditada,
  requiereSesion = { imagen: true, carrito: true },
  esBorrador = false, estadoBorrador = 'guardado', onRenombrar, onEmpezarNuevo,
  agotado = false, borradorAdmin = false, etiquetaVolver = 'Volver', onAviso,
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
  const [seleccion, setSeleccion] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [nombre, setNombre] = useState(inicial.nombre || '');
  const [hoja, setHoja] = useState(null);
  const [ocupado, setOcupado] = useState(null);
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
    return { pasado: [...h.pasado.slice(-29), h.capas], capas: capasNuevas, futuro: [] };
  });
  // El ref se lee fuera del actualizador: React puede llamarlo dos veces.
  const soltar = () => {
    const antes = arrastreInicio.current;
    arrastreInicio.current = null;
    if (antes) setHistoria((h) => ({ pasado: [...h.pasado.slice(-29), antes], capas: h.capas, futuro: [] }));
  };
  const deshacer = () => setHistoria((h) => (h.pasado.length ? { pasado: h.pasado.slice(0, -1), capas: h.pasado[h.pasado.length - 1], futuro: [h.capas, ...h.futuro] } : h));
  const rehacer = () => setHistoria((h) => (h.futuro.length ? { pasado: [...h.pasado, h.capas], capas: h.futuro[0], futuro: h.futuro.slice(1) } : h));

  const cambiarCapa = (id, cambios, guardar = true) => cambiarCapas((cs) => Object.fromEntries(
    Object.entries(cs).map(([zid, lista]) => [zid, lista.map((c) => (c.id === id ? { ...c, ...cambios } : c))]),
  ), guardar);
  const quitarCapa = (id) => {
    cambiarCapas((cs) => Object.fromEntries(Object.entries(cs).map(([zid, lista]) => [zid, lista.filter((c) => c.id !== id)])));
    setSeleccion(null);
  };
  const agregarCapa = (capa) => {
    const id = nuevoId();
    cambiarCapas((cs) => ({ ...cs, [zonaId]: [...(cs[zonaId] || []), { id, x: 0.5, y: 0.5, ...capa }] }));
    setSeleccion(id);
  };
  const escalar = (factor) => {
    const { capa } = elegida;
    if (!capa) return;
    if (capa.tipo === 'imagen') cambiarCapa(capa.id, { ancho: Math.min(1.5, Math.max(0.1, (capa.ancho ?? 0.8) * factor)) });
    else cambiarCapa(capa.id, { tamano: Math.min(0.6, Math.max(0.04, (capa.tamano ?? 0.18) * factor)) });
  };
  const alinear = (donde) => {
    const { capa } = elegida;
    if (!capa) return;
    const medio = capa.tipo === 'imagen' ? (capa.ancho ?? 0.8) / 2 : 0.3;
    const pos = {
      izquierda: { x: medio }, centroH: { x: 0.5 }, derecha: { x: 1 - medio },
      arriba: { y: 0.25 }, centroV: { y: 0.5 }, abajo: { y: 0.75 },
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
  const duplicar = () => {
    const { capa } = elegida;
    if (!capa) return;
    const id = nuevoId();
    cambiarCapas((cs) => ({ ...cs, [elegida.zonaId]: [...cs[elegida.zonaId], { ...capa, id, x: Math.min(1, (capa.x ?? 0.5) + 0.08), y: Math.min(1, (capa.y ?? 0.5) + 0.08) }] }));
    setSeleccion(id);
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

  const elegirZona = (id) => {
    setZonaId(id);
    const z = todasLasZonas.find((x) => x.id === id);
    if (z && z.vista.id !== vista?.id) setVistaId(z.vista.id);
  };
  const elegirCapa = (id, zid) => {
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

  const subirImagen = async () => {
    if (!sesion && requiereSesion?.imagen) { pedirLogin('continuar'); return; }
    if (!onSubirImagen) return;
    setOcupado('subiendo');
    try {
      const r = await onSubirImagen();
      if (r?.src) agregarCapa({ tipo: 'imagen', src: r.src, px: r.px, ancho: 0.8 });
    } finally {
      setOcupado(null);
    }
  };
  const escribirTexto = () => agregarCapa({
    tipo: 'texto', texto: 'Tu texto', fuente: fuentes[0]?.valor, tamano: 0.2, negrita: true,
    color: color?.oscura ? '#ffffff' : '#111111',
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

  // Atajos de teclado (no mientras se escribe en un campo).
  const teclas = useRef(null);
  teclas.current = (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); return; }
    if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); rehacer(); return; }
    if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); guardarRef.current?.(); return; }
    const { capa } = elegida;
    if (!capa) return;
    if (e.key === 'Escape') setSeleccion(null);
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); quitarCapa(capa.id); }
    else if (e.key === '+' || e.key === '=') escalar(1.1);
    else if (e.key === '-') escalar(0.9);
    else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const paso = e.shiftKey ? 0.05 : 0.01;
      const [dx, dy] = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
      cambiarCapa(capa.id, { x: Math.min(1, Math.max(0, (capa.x ?? 0.5) + dx)), y: Math.min(1, Math.max(0, (capa.y ?? 0.5) + dy)) });
    }
  };
  useEffect(() => {
    const f = (e) => teclas.current(e);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
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
      await onGuardar?.({ nombre: nombre.trim() || `Mi ${prenda.nombre?.split(' ')[0]?.toLowerCase() || 'creación'}`, diseno });
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
    } finally {
      setOcupado(null);
    }
  };

  const aviso = borradorAdmin ? (
    <Aviso compacto tipo="aviso">Borrador: solo los administradores ven esta prenda. Publícala desde Admin → Productos para poder comprarla.</Aviso>
  ) : combo ? (
    <Aviso compacto tipo="info">Prenda {combo.numero} de {combo.total} de tu combo «{combo.nombre}». Al terminar, vuelve al combo con tu diseño.</Aviso>
  ) : modo === 'plantilla' ? (
    <Aviso compacto tipo="info">Partes del diseño «{plantilla || 'de la comunidad'}». Cámbiale el nombre, la foto o lo que quieras.</Aviso>
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

  const accionPrincipal = combo ? (
    <Boton bloque icono={<CheckCircle2 aria-hidden="true" />} disabled={vacio} onClick={() => onUsarEnCombo?.(diseno)}>Listo, usar en el combo</Boton>
  ) : agotado ? (
    <Boton bloque disabled>Agotado por ahora</Boton>
  ) : (
    <Boton bloque icono={<ShoppingBag aria-hidden="true" />} disabled={vacio || borradorAdmin} cargando={ocupado === 'agregando'} onClick={agregar}>Agregar al carrito · {soles(precio)}</Boton>
  );

  return (
    <div className={s.pagina} data-componente="PaginaEstudio">
      <header className={s.cabeza}>
        <Boton to={urlVolver} variante="fantasma" tamano="sm" soloIcono aria-label={etiquetaVolver} title={etiquetaVolver} icono={<ArrowLeft aria-hidden="true" />} />
        <div className={s.titulo}>
          <h1>{prenda.nombre}</h1>
          <span className={s.subtitulo}>
            <span className={s.punto} style={{ background: color?.hex }} aria-hidden="true" />
            {color?.nombre}
            {ladosConDiseno.length > 0 && <> · {ladosConDiseno.map((v) => v.nombre).join(' + ')}</>}
          </span>
        </div>
        <span className={s.precio}>
          {soles(precio)}
          {prenda.precioAntes > precio && <s>{soles(prenda.precioAntes)}</s>}
        </span>
        {sesion && <Boton to={urlCreaciones} variante="fantasma" tamano="sm" icono={<Images aria-hidden="true" />} className={s.misCreaciones}>Mis creaciones</Boton>}
      </header>

      {modo === 'editar' && sesion && (
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

      <div className={s.cuerpo}>
        <section className={s.escena} aria-label="Tu prenda" ref={lienzoRef}>
          {vistas.length > 1 && (
            <Pestanas
              etiqueta="Lado de la prenda"
              opciones={vistas.map((v) => ({ id: v.id, texto: v.nombre, cuenta: v.zonas.reduce((n, z) => n + (capas[z.id]?.length || 0), 0) || undefined }))}
              valor={vista.id}
              onChange={(id) => { setVistaId(id); const v = vistas.find((x) => x.id === id); if (v && !v.zonas.some((z) => z.id === zonaId)) setZonaId(v.zonas[0]?.id); setSeleccion(null); }}
            />
          )}
          {lienzo({
            className: s.lienzo,
            zonaActiva: zonaId,
            seleccion,
            zoom,
            onElegirZona: (id) => { elegirZona(id); setSeleccion(null); },
            onElegirCapa: elegirCapa,
            onMoverCapa: (id, pos) => cambiarCapa(id, pos, false),
            onSoltarCapa: soltar,
            encima: vacio && zona && (
              <p className={s.empezar}>Elige una zona y agrega tu diseño</p>
            ),
          })}
          <BarraLienzo
            puedeDeshacer={historia.pasado.length > 0}
            puedeRehacer={historia.futuro.length > 0}
            onDeshacer={deshacer}
            onRehacer={rehacer}
            elegido={Boolean(elegida.capa)}
            onAchicar={() => escalar(0.9)}
            onAgrandar={() => escalar(1.1)}
            onCentrar={() => elegida.capa && cambiarCapa(elegida.capa.id, { x: 0.5, y: 0.5 })}
            onQuitar={() => elegida.capa && quitarCapa(elegida.capa.id)}
            onImagen={subirImagen}
            onTexto={escribirTexto}
            zoom={zoom}
            onZoom={setZoom}
            onAtajos={() => setHoja('atajos')}
          />
          {zona && <p className={s.zonaInfo}>Zona elegida: <strong>{nombreZona(zona)}</strong></p>}
        </section>

        <aside className={s.panel}>
          <div className={s.panelCuerpo}>
            {elegida.capa ? (
              <PanelCapa
                key={elegida.capa.id}
                capa={elegida.capa}
                zona={nombreZona(zonaElegida)}
                fuentes={fuentes}
                calidad={calidadDe(elegida.capa, zonaElegida)}
                fueraDeZona={fueraDeZona(elegida.capa, zonaElegida)}
                anchoZonaCm={zonaElegida?.anchoCm}
                sinSesion={!sesion}
                onCambiar={(c) => cambiarCapa(elegida.capa.id, c)}
                onListo={() => setSeleccion(null)}
                onAchicar={() => escalar(0.9)}
                onAgrandar={() => escalar(1.1)}
                onCentrar={() => cambiarCapa(elegida.capa.id, { x: 0.5, y: 0.5 })}
                onAlinear={alinear}
                onQuitar={() => quitarCapa(elegida.capa.id)}
                onDuplicar={duplicar}
                onAdelante={() => reordenar(true)}
                onAtras={() => reordenar(false)}
                onLlenar={() => cambiarCapa(elegida.capa.id, { ancho: 1, x: 0.5, y: 0.5 })}
                onRecortar={() => setRecortando(elegida.capa)}
                onQuitarFondo={quitarFondo}
                zonas={todasLasZonas.filter((z) => z.id !== elegida.zonaId).map((z) => ({ id: z.id, nombre: nombreZona(z) }))}
                onPasarAZona={pasarAZona}
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
                onImagen={subirImagen}
                onTexto={escribirTexto}
                subiendo={ocupado === 'subiendo'}
                donde={nombreZona(zona)}
              />
            )}
          </div>

          <div className={s.compra}>
            <div className={s.compraPrecio}>
              <span>{combo ? 'Precio en el combo' : 'Total'}</span>
              <strong>{combo ? 'Incluido' : soles(precio)}</strong>
            </div>
            {accionPrincipal}
            <div className={s.compraOtras}>
              {/* Sin cambios se apaga; si ya se guardó, dice "Guardado". */}
              <Boton
                variante="contorno"
                tamano="sm"
                icono={yaGuardada && !hayCambios ? <CheckCircle2 aria-hidden="true" /> : <Save aria-hidden="true" />}
                disabled={vacio || !hayCambios}
                cargando={ocupado === 'guardando' && hoja !== 'guardar'}
                onClick={guardar}
                title={hayCambios ? 'Guardar (Ctrl+S)' : 'No hay cambios por guardar'}
              >
                {yaGuardada && !hayCambios ? 'Guardado' : yaGuardada ? 'Guardar cambios' : 'Guardar'}
              </Boton>
              <Boton variante="fantasma" tamano="sm" icono={<Download aria-hidden="true" />} disabled={vacio} onClick={() => onDescargar?.(diseno)}>Descargar</Boton>
            </div>
            {vacio && <p className={s.compraNota}>Agrega una imagen o un texto para continuar.</p>}
          </div>
        </aside>
      </div>

      {/* Talla y cantidad antes de agregar. */}
      <HojaInferior
        abierta={hoja === 'talla'}
        onCerrar={() => setHoja(null)}
        titulo="Elige la talla"
        pie={<Boton bloque icono={<ShoppingBag aria-hidden="true" />} disabled={!talla} cargando={ocupado === 'agregando'} onClick={agregar}>Agregar · {soles(precio * cantidad)}</Boton>}
      >
        <div className={s.hojaTalla}>
          <p className={s.compraNota}>Incluye la impresión de todos tus diseños.</p>
          <SelectorTalla tallas={tallas} valor={talla} onChange={setTalla} />
          <div className={s.filaCantidad}>
            <span>Cantidad</span>
            <Cantidad valor={cantidad} onChange={setCantidad} min={1} max={20} />
          </div>
        </div>
      </HojaInferior>

      {/* Guardar: el nombre de la creación. */}
      <HojaInferior
        abierta={hoja === 'guardar'}
        onCerrar={() => setHoja(null)}
        titulo={modo === 'editar' ? 'Guardar los cambios' : 'Guarda tu creación'}
        pie={<Boton bloque icono={<Save aria-hidden="true" />} cargando={ocupado === 'guardando'} onClick={() => confirmarGuardar()}>Guardar</Boton>}
      >
        <div className={s.hojaGuardar}>
          <div className={s.miniatura}>{lienzo({ guias: false, className: s.lienzoMini })}</div>
          <Campo etiqueta="Ponle un nombre" placeholder="Ej.: Polera de mi equipo" maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} ayuda="Lo verás en Mis creaciones." />
        </div>
      </HojaInferior>

      {/* ¡Guardada! */}
      <HojaInferior
        abierta={hoja === 'guardada'}
        onCerrar={() => setHoja(null)}
        titulo="¡Creación guardada!"
        pie={(
          <div className={s.pieGuardada}>
            {!combo && <Boton bloque icono={<ShoppingBag aria-hidden="true" />} onClick={() => { setHoja(null); agregar(); }}>Agregar al carrito · {soles(precio)}</Boton>}
            <Boton bloque variante="contorno" icono={<Images aria-hidden="true" />} to={urlCreaciones}>Ver mis creaciones</Boton>
            <Boton bloque variante="fantasma" onClick={() => setHoja(null)}>Seguir diseñando</Boton>
          </div>
        )}
      >
        <div className={s.hojaGuardar}>
          <div className={s.miniatura}>{lienzo({ guias: false, className: s.lienzoMini })}</div>
          <p className={s.guardadaTexto}><strong>{nombre.trim() || 'Tu creación'}</strong> ya está en Mis creaciones. Puedes volver a editarla cuando quieras.</p>
        </div>
      </HojaInferior>

      {/* Sin sesión: guardar, subir una imagen o agregar al carrito piden entrar (el diseño no se pierde). */}
      <HojaInferior
        abierta={hoja === 'login'}
        onCerrar={() => setHoja(null)}
        titulo={motivoLogin === 'guardar' ? 'Inicia sesión para guardar' : 'Inicia sesión para continuar'}
        pie={(
          <div className={s.pieGuardada}>
            <Boton bloque icono={<LogIn aria-hidden="true" />} to={urlLogin}>Iniciar sesión</Boton>
            <Boton bloque variante="contorno" to={urlRegistro}>Crear una cuenta</Boton>
            <Boton bloque variante="fantasma" onClick={() => setHoja(null)}>Seguir diseñando</Boton>
          </div>
        )}
      >
        <div className={s.hojaLogin}>
          <img src={CARAS_KAPI.feliz} alt="" width="96" height="96" />
          <p>
            {motivoLogin === 'guardar'
              ? 'Tu diseño te espera aquí mismo: al volver lo encuentras tal cual y lo guardas en Mis creaciones.'
              : 'Así guardamos tus imágenes y tu diseño. Tus textos y elecciones se quedan como los dejaste.'}
          </p>
        </div>
      </HojaInferior>

      {/* Atajos de teclado. */}
      <HojaInferior abierta={hoja === 'atajos'} onCerrar={() => setHoja(null)} titulo="Atajos de teclado">
        <dl className={s.atajos}>
          {ATAJOS.map(([tecla, que]) => (
            <React.Fragment key={tecla}><dt><kbd>{tecla}</kbd></dt><dd>{que}</dd></React.Fragment>
          ))}
        </dl>
      </HojaInferior>

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
    </div>
  );
}
