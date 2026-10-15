import React, { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { RotateCcw, User, Package, Settings, Gift, Ticket, Sparkles } from 'lucide-react';
import {
  PaginaTienda, MarcoTienda, PaginaCarrito, PaginaMinijuegos, juegosDelArcade, VentanaKapi, kapiDesdePerfil,
  retoDesdePerfil, PaginaBusqueda, sugerenciasDesdeBusqueda, grupoModalidad, ORDENES_BUSQUEDA, ordenarProductos,
  Pestanas, Chip, Interruptor, Boton, PantallaCarga, CapaCargando, EsqueletoPagina, FRASES_CARGA,
  BarraAdmin, AvisoSistema, BannerApp, BotonWhatsApp, KapiFlotante, PildoraRecompensa,
  VentanaCampana, AvisoIdioma, ProveedorEnlaces, PanelEditor, useBorrador, SeccionEditable, InsertarAqui,
  moverSeccion, duplicarSeccion, rutaDeMarca, tarjetaDesdeProducto, REGISTRO_SECCIONES, enlaceWhatsApp, gruposDeCatalogo, ETAPAS_PRODUCCION,
} from './kit';
import { empresa } from '../config/empresa';
import { msHastaMananaLima, msHastaLunesLima, limaTodayStr } from '../utils/fechaLima';
import { volarMonedasGanadas } from '../utils/animations';
import { CuentaDemo, MODULOS_CUENTA, ESTADOS_CUENTA, EncuestaDemo, ESTADOS_ENCUESTA, AccesoDemo, VISTAS_ACCESO, CrearDemo, ESTADOS_CREAR, ComunidadDemo, ESTADOS_COMUNIDAD, CreacionDemo, ESTADOS_CREACION, VerDisenoDemo, ESTADOS_VER } from './DemoCuenta';
import INICIO from './demo/inicio.json';
import TIENDA from './demo/tienda.json';
import cs from './ComponentesPage.module.css';
import s from './DemoTienda.module.css';

/*
 * Una tienda de prueba: el mismo marco (avisos, cabecera, pie, barra inferior
 * y flotantes) para todas las páginas, y los enlaces navegan entre ellas.
 *  - Inicio: las secciones de pages/home. Viendo como admin, "Editar esta
 *    página" abre el editor del builder sobre esta misma página.
 *  - Tienda (/tienda): las secciones de pages/tienda; el catálogo filtra
 *    con las listas reales (categorías, colecciones, etiquetas…). El menú
 *    Tienda de la cabecera lleva aquí con la categoría ya elegida.
 *  - Buscar (/buscar): resultados de los productos de tienda.json, de a 24
 *    con "Ver más" (como el cursor de la tienda); la cabecera sugiere mientras
 *    escribes (PanelBusqueda) y Enter lleva aquí.
 *  - Carrito: con los mismos productos reales.
 *  - Mi cuenta (/cuenta): MarcoCuenta con sus páginas (DemoCuenta.jsx):
 *    resumen, perfil, Mis pedidos, direcciones y ajustes; los enlaces del
 *    menú de la cuenta navegan entre ellas.
 *  - Minijuegos (Zona Arcade): las cuatro tarjetas con juegosDelArcade; con
 *    sesión, chips para ver cada estado (como el modo diseño de la tienda).
 * "Ver componentes" marca cada parte con su número y su componente; los
 * números son los de kit/guia/INICIO.md.
 * Datos: demo/inicio.json (copia de pages/home, pages/footer y una muestra
 * de productos_wala y tienda_brands) y demo/tienda.json (pages/tienda, 35
 * productos variados y las listas de filtros).
 */

const ROLES = [
  { id: 'visitante', texto: 'Visitante' },
  { id: 'sesion', texto: 'Con sesión' },
  { id: 'admin', texto: 'Admin' },
];

const PAGINAS = [
  { id: 'inicio', texto: 'Inicio', ruta: '/' },
  { id: 'tienda', texto: 'Tienda', ruta: '/tienda' },
  { id: 'crear', texto: 'Crear', ruta: '/personalizar' },
  { id: 'comunidad', texto: 'Comunidad', ruta: '/comunidad' },
  { id: 'creacion', texto: 'Una creación', ruta: '/creacion/' },
  { id: 'ver', texto: 'Ver diseño', ruta: '/ver/' },
  { id: 'minijuegos', texto: 'Minijuegos', ruta: '/minijuegos' },
  { id: 'buscar', texto: 'Buscar', ruta: '/buscar' },
  { id: 'carrito', texto: 'Carrito', ruta: '/carrito' },
  { id: 'cuenta', texto: 'Mi cuenta', ruta: '/cuenta' },
  { id: 'encuesta', texto: 'Encuesta', ruta: '/encuesta-suscripcion' },
  { id: 'acceso', texto: 'Acceso', ruta: '/login' },
];

/** Ruta de la tienda → página de esta demo (las demás solo avisan). */
const PAGINA_DE_RUTA = {
  '/': 'inicio', '/tienda': 'tienda', '/minijuegos': 'minijuegos', '/buscar': 'buscar', '/carrito': 'carrito', '/encuesta-suscripcion': 'encuesta', '/personalizar': 'crear', '/comunidad': 'comunidad',
  ...Object.fromEntries(MODULOS_CUENTA.map((m) => [m.ruta, 'cuenta'])),
  ...Object.fromEntries(VISTAS_ACCESO.map((v) => [v.ruta, 'acceso'])),
};

/** Pestaña de la barra inferior que se enciende en cada página. */
const PESTANA_DE_PAGINA = { inicio: 'inicio', tienda: 'tienda', minijuegos: 'juegos', buscar: 'tienda', carrito: 'tienda', cuenta: 'cuenta', acceso: 'cuenta', crear: 'crear', comunidad: 'crear', creacion: 'cuenta' };

/* Estados de la Zona Arcade para probar (como el modo diseño de la tienda). */
const RULETAS = [
  { id: 'bloqueada', texto: 'Ruleta bloqueada', ruleta: { dias: 0 } },
  { id: 'racha', texto: 'Racha 4/7', ruleta: { dias: 4, empezada: true } },
  { id: 'lista', texto: 'Lista para girar', ruleta: { dias: 7, empezada: true, desbloqueada: true } },
  { id: 'girada', texto: 'Girada', ruleta: { dias: 7, empezada: true, girada: true } },
  { id: 'perdida', texto: 'Semana perdida', ruleta: { dias: 3, empezada: true, perdida: true } },
];
const HECHOS = [['palabra', 'Palabra jugada'], ['kapi', 'Kapi alimentado'], ['bolitas', 'Bolitas hechas'], ['cargando', 'Cargando sesión']];

const EXTRAS = [
  ['aviso', 'Aviso del sistema'],
  ['app', 'Banner de la app'],
  ['idioma', 'Sugerencia de idioma'],
  ['campana', 'Ventana de campaña'],
  ['reto', 'Reto semanal'],
  ['triste', 'Kapi triste'],
];

/* Reto de ejemplo (mismos campos que globals/activeChallenge; hoy no hay uno
   activo en la tienda, así que este es inventado para ver el bloque). */
const RETO_DEMO = {
  challengeId: 'demo-comparte',
  title: 'Comparte tu diseño',
  description: 'Sube una historia con tu polera de Walá y pega aquí el enlace.',
  actionType: 'manual_story',
  goal: 1,
  rewardType: 'main',
  rewardCoins: 10,
};

/* Búsqueda de la demo: misma idea que services/search (sin tildes, por
   nombre, categoría o marca), sobre los productos de ejemplo. */
const sinTildes = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const POR_PAGINA = 24;
const casa = (p, q, nombresCategorias, nombresMarcas) => {
  if (!q) return true;
  const texto = sinTildes([p.name, ...(p.categories || []).map((c) => nombresCategorias[c]), nombresMarcas[p.brandId]].join(' '));
  return sinTildes(q).split(/\s+/).filter(Boolean).every((pal) => texto.includes(pal));
};
const contarPor = (lista, clave) => {
  const cuenta = new Map();
  lista.forEach((p) => [].concat(clave(p) || []).forEach((v) => v && cuenta.set(v, (cuenta.get(v) || 0) + 1)));
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([id, total]) => ({ id, total }));
};

/** Fecha (AAAA-MM-DD, Lima) de hace `dias` días. */
const haceDias = (dias) => {
  const d = new Date(`${limaTodayStr()}T12:00:00`);
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
};

const PIE_LEGAL = {
  empresa: { nombre: empresa.nombreComercial, email: empresa.email, telefono: empresa.telefono, direccion: empresa.domicilioFiscal },
  enlaces: [
    { texto: 'Términos y Condiciones', url: '/terminos-y-condiciones' },
    { texto: 'Políticas de Privacidad', url: '/politicas-de-privacidad' },
  ],
};

/* Menú de la cuenta: los mismos accesos que el header de la tienda
   (ACCESOS_RAPIDOS_HEADER sobre useCuentaNavGroups). */
const GRUPOS_CUENTA = [
  { titulo: 'Cuenta', items: [
    { to: '/cuenta/perfil', texto: 'Mi perfil', Icono: User },
    { to: '/cuenta/pedidos', texto: 'Mis pedidos', Icono: Package },
    { to: '/cuenta/ajustes', texto: 'Ajustes', Icono: Settings },
  ] },
  { titulo: 'Recompensas', items: [
    { to: '/cuenta/catalogo', texto: 'Catálogo de recompensas', Icono: Gift },
    { to: '/cuenta/cupones', texto: 'Mis cupones', Icono: Ticket },
  ] },
  { titulo: 'Personalización', items: [
    { to: '/cuenta/creaciones', texto: 'Mis creaciones', Icono: Sparkles },
  ] },
];
const PROMO_CUENTA = { titulo: 'Perfil de regalos', texto: 'Completa la encuesta', monedas: 15, url: '/encuesta-suscripcion', icono: 'moneda' };

const META_ENVIO = 150;
const { destacados, nuevos, ofertas } = INICIO.productos;

/** Producto de la tienda → fila del carrito / pedido / favoritos. */
const fila = (p, extra = {}) => {
  const t = tarjetaDesdeProducto(p);
  return { id: p.id, imagen: t.imagen, nombre: p.name, precio: t.precio, precioAntes: t.precioAntes, cantidad: 1, ...extra };
};

const CARRITO_INICIAL = [
  fila(destacados[0], { variante: 'Talla M' }),
  fila(ofertas.find((p) => !p.isComboProduct) || ofertas[0]),
].map((it) => ({ ...it, url: `/producto/${it.id}` }));

/* Fotos reales para recompensas y referidos de "Mi cuenta". */
const FOTOS_CUENTA = [ofertas[0], nuevos[1], destacados[2]].map((p) => ({ nombre: p.name, imagen: fila(p).imagen }));

/* Lista de deseos de "Mi cuenta": productos reales; uno ya no está en la tienda. */
const DESEOS = [
  ...[...nuevos.slice(0, 3), ofertas[1]].map((p, k) => ({
    id: p.id, crudo: p, producto: tarjetaDesdeProducto(p), guardado: ['hoy', 'ayer', 'hace 4 días', 'hace 9 días'][k], regalado: k === 2,
  })),
  { id: 'agotado', producto: { nombre: destacados[4]?.name, imagen: fila(destacados[4]).imagen }, guardado: 'hace 30 días', disponible: false },
];

const FAVORITOS = [...nuevos.slice(0, 4), ...ofertas.slice(0, 3)].map((p) => ({ id: p.id, nombre: p.name, imagen: fila(p).imagen }));

/* Pedidos de "Mis pedidos": uno sin pagar (5 pasos generales), uno en el
   taller (8 etapas) con deuda, uno en reparto, uno entregado y uno anulado. */
const PEDIDOS = [
  { codigo: 'PD-20481', fecha: '10 oct', paso: 0, pagoPendiente: true, items: [fila(destacados[1], { variante: 'Talla L' }), fila(nuevos[1])] },
  { codigo: 'PD-20455', fecha: '8 oct', paso: 4, pasos: ETAPAS_PRODUCCION, deuda: 45, estado: { texto: 'En estampado', tono: 'violeta' }, items: [fila(destacados[0], { variante: 'Talla M' })] },
  { codigo: 'PD-20377', fecha: '7 oct', paso: 6, pasos: ETAPAS_PRODUCCION, estado: { texto: 'En reparto', tono: 'violeta' }, entregaEstimada: 'mañana, 14 oct', items: [fila(destacados[3])] },
  { codigo: 'PD-19902', fecha: '28 sep', paso: 7, pasos: ETAPAS_PRODUCCION, estado: { texto: 'Finalizado', tono: 'exito' }, items: [fila(nuevos[2]), fila(destacados[2], { variante: 'Talla S' })] },
  { codigo: 'PD-19750', fecha: '20 sep', paso: 2, anulado: true, items: [fila(ofertas[2])] },
].map((p) => ({ ...p, id: p.codigo, urlDetalle: `/cuenta/pedidos/${p.codigo}`, total: p.items.reduce((a, it) => a + it.precio * it.cantidad, 0) }));

/** Nombre del componente que dibuja cada tipo de sección (para "Ver componentes"). */
const componenteDe = (tipo) => REGISTRO_SECCIONES[tipo]?.nombre || tipo;

/** Marca de una parte en "Ver componentes": número + componente.
 *  - rejilla: deja a sus hijos en columna con el espacio de la página
 *    (páginas de la cuenta, que devuelven varias piezas sueltas). */
function Parte({ n, nombre, children, bloque = true, rejilla = false }) {
  return (
    <div className={[bloque ? s.parte : s.parteEnLinea, rejilla && s.parteRejilla].filter(Boolean).join(' ')} data-etiqueta={`${n} · ${nombre}`}>
      {children}
    </div>
  );
}

export default function DemoTienda({ marcas = [], usuario, tema, cambiarTema, notificaciones, onLeer, onMarcarLeidas, onVerTodas, onAgregar, toast }) {
  const [rol, setRol] = useState('visitante');
  const [pagina, setPagina] = useState('inicio');
  const [extras, setExtras] = useState([]);
  const [anatomia, setAnatomia] = useState(false);
  const [pildora, setPildora] = useState(true);
  const [carrito, setCarrito] = useState(CARRITO_INICIAL);
  // Filtros del catálogo de /tienda (el menú Tienda llega con ?categoria=).
  const [filtros, setFiltros] = useState({});
  // Zona Arcade: qué está hecho hoy y en qué va la ruleta.
  const [hechos, setHechos] = useState(['kapi']);
  const [kapiAbierta, setKapiAbierta] = useState(false);
  // Búsqueda: término y marca de la URL, orden, filtros y páginas cargadas.
  const [consulta, setConsulta] = useState({ q: '', marca: '' });
  const [orden, setOrden] = useState('newest');
  const [filtrosBusqueda, setFiltrosBusqueda] = useState({});
  const [paginasBusqueda, setPaginasBusqueda] = useState(1);
  const [monedas, setMonedas] = useState(43);
  const [ruletaDemo, setRuletaDemo] = useState('racha');
  // Mi cuenta: qué módulo de /cuenta se ve y los estados para probar.
  const [rutaCuenta, setRutaCuenta] = useState('/cuenta');
  const [estadosCuenta, setEstadosCuenta] = useState([]);
  const [estadosEncuesta, setEstadosEncuesta] = useState([]);
  const [estadosCrear, setEstadosCrear] = useState([]);
  const [estadosComunidad, setEstadosComunidad] = useState([]);
  const [rutaCreacion, setRutaCreacion] = useState('/creacion/');
  const [estadosCreacion, setEstadosCreacion] = useState([]);
  const [estadosVer, setEstadosVer] = useState([]);
  const [rutaAcceso, setRutaAcceso] = useState('/login');
  // Ver la carga: 'marca' (primera vez), 'accion' (esperar una acción) o 'esqueleto' (cambio de página).
  const [carga, setCarga] = useState(null);
  const [cargaSaliendo, setCargaSaliendo] = useState(false);
  const verCarga = (tipo) => {
    if (marcoRef.current) marcoRef.current.scrollTop = 0;
    setCargaSaliendo(false);
    setCarga(tipo);
    if (tipo === 'marca') setTimeout(() => setCargaSaliendo(true), 4200);
    else setTimeout(() => setCarga(null), 4000);
  };
  const marcoRef = useRef(null);

  // Editor del builder (solo admin, sobre el inicio).
  const borrador = useBorrador(INICIO.secciones);
  const [editando, setEditando] = useState(false);
  const [seleccionada, setSeleccionada] = useState(null);
  const [resaltada, setResaltada] = useState(null);
  const [insertarEn, setInsertarEn] = useState(null);
  const [vistaEditor, setVistaEditor] = useState('escritorio');
  const [guardando, setGuardando] = useState(false);

  const conSesion = rol !== 'visitante';
  const esAdmin = rol === 'admin';
  const enEditor = esAdmin && editando && pagina === 'inicio';
  const ver = (x) => extras.includes(x);
  const alternar = (x) => setExtras((xs) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]));
  const avisar = useCallback((titulo, texto) => toast({ tipo: 'info', titulo, texto, duracion: 2200 }), [toast]);

  const irA = useCallback((id) => {
    setPagina(id);
    if (marcoRef.current) marcoRef.current.scrollTop = 0;
  }, []);

  // Los enlaces de la tienda de prueba navegan entre sus páginas; los demás
  // avisan adónde irían.
  const navegar = useRef(null);
  navegar.current = (to) => {
    const [ruta, query = ''] = String(to || '').split('?');
    // El detalle de una compra (/cuenta/pedidos/PD-…) también es de la cuenta.
    if (ruta.startsWith('/cuenta/pedidos/')) { setRutaCuenta(ruta); irA('cuenta'); return; }
    // Una creación (/creacion/:id) es su propia página.
    if (ruta.startsWith('/creacion/')) { setRutaCreacion(ruta); irA('creacion'); return; }
    if (!PAGINA_DE_RUTA[ruta]) { avisar('En la tienda iría a', to); return; }
    if (ruta === '/buscar') {
      const p = new URLSearchParams(query);
      setConsulta({ q: p.get('q') || '', marca: p.get('brand') || '' });
      setFiltrosBusqueda({});
      setPaginasBusqueda(1);
    }
    if (PAGINA_DE_RUTA[ruta] === 'cuenta') setRutaCuenta(ruta);
    if (PAGINA_DE_RUTA[ruta] === 'acceso') setRutaAcceso(ruta);
    if (ruta === '/tienda') {
      const categoria = new URLSearchParams(query).get('categoria');
      setFiltros(categoria ? { categoria } : {});
    }
    irA(PAGINA_DE_RUTA[ruta]);
  };
  const EnlaceTienda = useMemo(() => forwardRef(function EnlaceTienda({ to, onClick, children, ...rest }, ref) {
    return (
      <a
        ref={ref}
        href={to}
        {...rest}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          e.preventDefault();
          navegar.current(to);
        }}
      >
        {children}
      </a>
    );
  }), []);

  const publicar = useCallback(() => {
    setGuardando(true);
    window.setTimeout(() => {
      setGuardando(false);
      borrador.marcarGuardado();
      toast({ tipo: 'exito', titulo: 'Página publicada', texto: 'Así la verán tus clientes.' });
    }, 900);
  }, [borrador, toast]);

  const visibles = useMemo(() => marcas.filter((m) => m.active !== false && m.visible !== false), [marcas]);

  // Kapi: el mismo perfil para el botón flotante, su ventana y la Zona Arcade.
  const kapiAlimentado = hechos.includes('kapi');
  const kapi = kapiDesdePerfil({
    lastKapiClaimDate: kapiAlimentado ? limaTodayStr() : haceDias(ver('triste') ? 5 : 1),
    kapiHappiness: ver('triste') ? 50 : 60,
    kapiTutorialVisto: true,
  });
  /* ── Búsqueda: sugerencias de la cabecera y resultados de /buscar ── */
  const nombresCategorias = useMemo(() => Object.fromEntries(TIENDA.categorias.map((c) => [c.id, c.name])), []);
  const nombresMarcas = useMemo(() => Object.fromEntries(marcas.map((m) => [m.id, m.name])), [marcas]);
  const ideasBusqueda = useMemo(() => contarPor(TIENDA.productos, (p) => p.categories)
    .slice(0, 5).map((c) => nombresCategorias[c.id]).filter(Boolean), [nombresCategorias]);
  const buscarSugerencias = useCallback(async (texto) => {
    await new Promise((r) => setTimeout(r, 120)); // lo que tardaría el catálogo
    const casan = TIENDA.productos.filter((p) => casa(p, texto, nombresCategorias, nombresMarcas));
    return sugerenciasDesdeBusqueda({
      productos: casan.slice(0, 6),
      marcas: contarPor(casan, (p) => p.brandId).slice(0, 5),
      categorias: contarPor(casan, (p) => p.categories).slice(0, 6),
      total: casan.length,
    }, { marcas: visibles, categorias: TIENDA.categorias, termino: texto });
  }, [nombresCategorias, nombresMarcas, visibles]);
  const resultados = useMemo(() => ordenarProductos(
    TIENDA.productos.filter((p) => casa(p, consulta.q, nombresCategorias, nombresMarcas) && (!consulta.marca || p.brandId === consulta.marca)),
    orden,
  ), [consulta, orden, nombresCategorias, nombresMarcas]);
  const gruposBusqueda = useMemo(() => [
    grupoModalidad(resultados),
    ...gruposDeCatalogo({
      categorias: TIENDA.categorias, colecciones: TIENDA.colecciones, marcas: visibles, tipos: TIENDA.tipos,
      etiquetas: TIENDA.etiquetas, personajes: TIENDA.personajes, productos: resultados, marcaActual: consulta.marca || undefined,
    }),
  ].filter(Boolean), [resultados, visibles, consulta.marca]);
  const marcaBusqueda = visibles.find((m) => m.id === consulta.marca);

  const alimentarKapi = async (boton) => {
    await new Promise((r) => setTimeout(r, 600)); // lo que tardaría el servidor
    setHechos((h) => (h.includes('kapi') ? h : [...h, 'kapi']));
    volarMonedasGanadas(boton, kapi.recompensa);
    setMonedas((m) => m + kapi.recompensa);
  };
  const gruposTienda = useMemo(() => gruposDeCatalogo({
    categorias: TIENDA.categorias,
    colecciones: TIENDA.colecciones,
    marcas: visibles,
    tipos: TIENDA.tipos,
    etiquetas: TIENDA.etiquetas,
    personajes: TIENDA.personajes,
    productos: TIENDA.productos,
  }), [visibles]);
  const enCarrito = carrito.reduce((a, it) => a + it.cantidad, 0);

  /* ── Marco: igual en todas las páginas ── */
  const cabecera = {
    enlaces: [
      { id: 'tienda', texto: 'Tienda', url: '/tienda', menu: 'tienda' },
      { id: 'crear', texto: 'Crear', url: '/personalizar' },
      { id: 'marcas', texto: 'Marcas', url: '/marcas', menu: 'marcas' },
      { id: 'minijuegos', texto: 'Minijuegos', url: '/minijuegos' },
    ],
    activo: ['tienda', 'minijuegos', 'crear'].includes(pagina) ? pagina : pagina === 'comunidad' ? 'crear' : null,
    menuTienda: {
      categorias: INICIO.categorias.slice(0, 10).map((c) => ({ id: c.categoryId, nombre: c.name, url: `/tienda?categoria=${c.categoryId}` })),
    },
    // Como la tienda: 6 a la vista y "Ver N marcas más" en el mismo menú.
    menuMarcas: { limite: 6, marcas: visibles.map((m) => ({ id: m.id, nombre: m.name, url: `/${rutaDeMarca(m)}`, logo: m.logoUrl })) },
    tema: tema === 'dark' ? 'noche' : 'claro',
    onTema: cambiarTema,
    usuario: conSesion ? usuario : null,
    gruposCuenta: GRUPOS_CUENTA,
    promoCuenta: pildora ? PROMO_CUENTA : undefined,
    onCerrarSesion: () => setRol('visitante'),
    monedas,
    notificaciones,
    onLeer,
    onMarcarLeidas,
    onVerTodas,
    favoritos: conSesion ? FAVORITOS : [],
    carrito,
    metaEnvio: META_ENVIO,
    onBuscar: (q) => navegar.current(q ? `/buscar?q=${encodeURIComponent(q)}` : '/buscar'),
    buscarSugerencias,
    // "Lo más buscado": las categorías con más productos (en la tienda,
    // también podrían ser los términos más buscados de la analítica).
    ideasBusqueda,
  };

  // En la encuesta y en el acceso Kapi ya está en la página (uno solo a la
  // vista) y la píldora distrae (o invita a la misma encuesta): no se muestran.
  const enEncuesta = pagina === 'encuesta' || pagina === 'acceso' || pagina === 'crear';
  const flotantes = {
    derecha: (
      <>
        <Parte n="M7" nombre="BotonWhatsApp" bloque={false}>
          <BotonWhatsApp numero={empresa.whatsapp} mensaje="¡Hola Walá! Tengo una consulta." />
        </Parte>
        {conSesion && !enEncuesta && (
          <Parte n="M8" nombre="KapiFlotante" bloque={false}>
            <KapiFlotante estado={kapi.estado} aviso={kapi.aviso} onAbrir={() => setKapiAbierta(true)} />
          </Parte>
        )}
      </>
    ),
    izquierda: conSesion && pildora && !enEncuesta && (
      <Parte n="M10" nombre="PildoraRecompensa" bloque={false}>
        <PildoraRecompensa titulo="Gana 15 monedas" texto="Completa tu perfil de regalos" monedas={15} to="/encuesta-suscripcion" onCerrar={() => setPildora(false)} />
      </Parte>
    ),
  };

  const arriba = (ver('aviso') || ver('app') || esAdmin) && (
    <>
      {ver('aviso') && (
        <Parte n="M1" nombre="AvisoSistema">
          <AvisoSistema tipo="aviso" onCerrar={() => alternar('aviso')}>Por fiestas patrias, los pedidos de esta semana salen el lunes.</AvisoSistema>
        </Parte>
      )}
      {ver('app') && (
        <Parte n="M2" nombre="BannerApp">
          <BannerApp url="https://play.google.com/store" onCerrar={() => alternar('app')} />
        </Parte>
      )}
      {esAdmin && (
        <Parte n="M3" nombre="BarraAdmin">
          <BarraAdmin
            editando={enEditor}
            onEditor={() => {
              if (enEditor) { setEditando(false); setSeleccionada(null); setInsertarEn(null); return; }
              irA('inicio');
              setEditando(true);
            }}
          />
        </Parte>
      )}
    </>
  );

  const marco = {
    contenida: true,
    arriba,
    cabecera,
    pie: INICIO.pie,
    pieLegal: PIE_LEGAL,
    barraInferior: { activo: PESTANA_DE_PAGINA[pagina], usuario: conSesion ? usuario : null, carrito: enCarrito },
    // Editando, los flotantes (WhatsApp, Kapi…) se esconden: taparían el panel.
    flotantes: enEditor ? undefined : flotantes,
  };

  /* ── Inicio: secciones del builder (con editor y "Ver componentes") ── */
  const { secciones, cambiar } = borrador;
  const total = secciones.length;
  const envolver = (enEditor || anatomia) ? (sec, nodo, i) => {
    let n = nodo;
    if (enEditor) {
      n = (
        <>
          <InsertarAqui indice={i} onInsertar={setInsertarEn} activo={insertarEn === i} />
          <SeccionEditable
            id={sec.id}
            tipo={sec.type}
            activa={seleccionada === sec.id}
            resaltada={resaltada === sec.id}
            primera={i === 0}
            ultima={i === total - 1}
            onEditar={(id) => { setInsertarEn(null); setSeleccionada(id); }}
            onMover={(id, d) => cambiar(moverSeccion(secciones, id, d))}
            onDuplicar={(id) => cambiar(duplicarSeccion(secciones, id))}
          >
            {n}
          </SeccionEditable>
        </>
      );
    }
    return anatomia ? <Parte n={`S${i + 1}`} nombre={`${componenteDe(sec.type)} (${sec.type})`}>{n}</Parte> : n;
  } : undefined;

  /* ── Tienda (/tienda): pages/tienda con el catálogo filtrando de verdad ── */
  const envolverTienda = anatomia
    ? (sec, nodo, i) => <Parte n={`S${i + 1}`} nombre={`${componenteDe(sec.type)} (${sec.type})`}>{nodo}</Parte>
    : undefined;
  const propsTienda = (sec) => (sec.type === 'sidebar_catalog' ? {
    grupos: gruposTienda,
    seleccion: filtros,
    onFiltrar: (grupo, valor) => setFiltros((f) => ({ ...f, [grupo]: valor })),
    filtrarAqui: true,
    // Como la tienda: el buscador del catálogo solo en la página de una marca.
    conBuscador: Boolean(sec.settings?.brandId),
  } : undefined);

  /* ── Minijuegos: la Zona Arcade con el estado elegido en los chips ── */
  const arcade = juegosDelArcade({
    sesion: conSesion,
    cargando: conSesion && hechos.includes('cargando'),
    palabraHecha: hechos.includes('palabra'),
    kapiReclamado: hechos.includes('kapi'),
    bolitasHechas: hechos.includes('bolitas'),
    ruleta: RULETAS.find((r) => r.id === ruletaDemo).ruleta,
    hasta: {
      manana: new Date(Date.now() + msHastaMananaLima()).toISOString(),
      lunes: new Date(Date.now() + msHastaLunesLima()).toISOString(),
    },
    onAlimentar: () => (hechos.includes('kapi')
      ? toast({ tipo: 'info', titulo: '¡Ya alimentaste a Kapi hoy!', texto: 'Vuelve mañana por su moneda.' })
      : setKapiAbierta(true)),
  });

  const formaEsqueleto = {
    tienda: 'tienda', buscar: 'busqueda', carrito: 'carrito', crear: 'crear', comunidad: 'comunidad', creacion: 'producto', minijuegos: 'minijuegos', encuesta: 'encuesta', acceso: 'acceso', cuenta: 'cuenta',
  }[pagina] || 'productos';
  // /cuenta/… → su módulo (el detalle de una compra usa el de pedidos).
  const moduloEsqueleto = {
    '/cuenta': 'resumen', '/cuenta/perfil': 'perfil', '/cuenta/direcciones': 'direcciones', '/cuenta/ajustes': 'ajustes',
    '/cuenta/catalogo': 'catalogo', '/cuenta/cupones': 'cupones', '/cuenta/misiones': 'misiones', '/cuenta/referidos': 'referidos',
    '/cuenta/creaciones': 'creaciones', '/cuenta/wishlist': 'deseos', '/cuenta/fechas-importantes': 'fechas',
  }[rutaCuenta] || (rutaCuenta.startsWith('/cuenta/pedidos') ? 'pedidos' : 'resumen');
  const contenido = carga === 'esqueleto' ? (
    // Cambio de página: la cabecera queda y abajo, la forma de la página que llega.
    <MarcoTienda {...marco} kapiEnPie={false}>
      <Parte n="M11" nombre="EsqueletoPagina">
        {/* El inicio, sección por sección (las del builder). */}
        {pagina === 'inicio'
          ? <EsqueletoPagina secciones={secciones.map((x) => x.type)} />
          : <EsqueletoPagina forma={formaEsqueleto} modulo={moduloEsqueleto} sesion={conSesion} />}
      </Parte>
    </MarcoTienda>
  ) : pagina === 'buscar' ? (
    // Sin resultados ya habla Kapi (el estado vacío): el pie no lo asoma (uno solo a la vista).
    <MarcoTienda {...marco} kapiEnPie={resultados.length > 0}>
      <Parte n="P4" nombre="PaginaBusqueda">
        <PaginaBusqueda
          termino={consulta.q}
          onBuscar={(q) => navegar.current(q ? `/buscar?q=${encodeURIComponent(q)}${consulta.marca ? `&brand=${consulta.marca}` : ''}` : '/buscar')}
          productos={resultados.slice(0, paginasBusqueda * POR_PAGINA)}
          hayMas={resultados.length > paginasBusqueda * POR_PAGINA}
          onCargarMas={() => setPaginasBusqueda((n) => n + 1)}
          grupos={gruposBusqueda}
          seleccion={filtrosBusqueda}
          onFiltrar={(grupo, valor) => setFiltrosBusqueda((f) => ({ ...f, [grupo]: valor }))}
          orden={orden}
          onOrden={setOrden}
          ordenes={ORDENES_BUSQUEDA}
          marcaFiltro={marcaBusqueda && { nombre: marcaBusqueda.name, urlTodo: consulta.q ? `/buscar?q=${encodeURIComponent(consulta.q)}` : '/buscar' }}
          catalogo={{ marcas: visibles, categorias: TIENDA.categorias, marcaActual: consulta.marca || null }}
          onAgregar={onAgregar}
          ideas={ideasBusqueda}
        />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'minijuegos' ? (
    <MarcoTienda {...marco}>
      <Parte n="P3" nombre="PaginaMinijuegos">
        <PaginaMinijuegos {...arcade} sesion={conSesion} cargando={conSesion && hechos.includes('cargando')} />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'tienda' ? (
    <PaginaTienda
      {...marco}
      secciones={TIENDA.secciones}
      productos={{ todos: TIENDA.productos }}
      categorias={TIENDA.categorias}
      marcas={marcas}
      onAgregar={onAgregar}
      propsPara={propsTienda}
      envolver={envolverTienda}
    />
  ) : pagina === 'inicio' ? (
    <PaginaTienda
      {...marco}
      secciones={secciones}
      productos={INICIO.productos}
      categorias={INICIO.categorias}
      marcas={marcas}
      onAgregar={onAgregar}
      propsPara={(sec) => (sec.type === 'faq_accordion' ? { contacto: enlaceWhatsApp(empresa.whatsapp, '¡Hola Walá! Tengo una duda.') } : undefined)}
      envolver={envolver}
    />
  ) : pagina === 'ver' ? (
    <MarcoTienda {...marco} kapiEnPie={!estadosVer.includes('noDisponible')}>
      <Parte n="P10" nombre="PaginaVerDiseno">
        <VerDisenoDemo estados={estadosVer} />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'creacion' ? (
    <MarcoTienda {...marco}>
      <Parte n="P9" nombre="PaginaCreacion">
        <CreacionDemo
          key={rutaCreacion}
          id={rutaCreacion.split('/')[2]}
          sesion={conSesion}
          esAdmin={esAdmin}
          estados={estadosCreacion}
          toast={toast}
          onIrA={(r) => navegar.current(r)}
        />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'comunidad' ? (
    <MarcoTienda {...marco} kapiEnPie={!estadosComunidad.includes('vacia')}>
      <Parte n="P8" nombre="PaginaComunidad">
        <ComunidadDemo estados={estadosComunidad} toast={toast} />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'crear' ? (
    // Kapi ya está en el arte de la portada: ni el pie ni el flotante lo repiten.
    <MarcoTienda {...marco} kapiEnPie={false}>
      <Parte n="P7" nombre="PaginaCrear">
        <CrearDemo sesion={conSesion} esAdmin={esAdmin} estados={estadosCrear} />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'acceso' ? (
    // Kapi asoma en el panel de la marca: el pie no lo muestra.
    <MarcoTienda {...marco} kapiEnPie={false}>
      {(() => {
        const v = VISTAS_ACCESO.find((x) => x.ruta === rutaAcceso) || VISTAS_ACCESO[0];
        return (
          <Parte n={v.n} nombre={v.componente}>
            <AccesoDemo
              ruta={rutaAcceso}
              toast={toast}
              onIrA={(r) => navegar.current(r)}
              onEntrar={() => setRol((r) => (r === 'visitante' ? 'sesion' : r))}
            />
          </Parte>
        );
      })()}
    </MarcoTienda>
  ) : pagina === 'encuesta' ? (
    // Kapi ya está en la portada (y en los estados): el pie no lo asoma.
    <MarcoTienda {...marco} kapiEnPie={false}>
      <Parte n="P6" nombre="PaginaEncuesta">
        <EncuestaDemo
          sesion={conSesion}
          usuario={usuario}
          estados={estadosEncuesta}
          fotos={FOTOS_CUENTA}
          onMonedas={(n) => setMonedas((m) => Math.max(0, m + n))}
          toast={toast}
          onIrA={(ruta) => navegar.current(ruta)}
        />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'cuenta' ? (
    // Sin sesión o sin datos, Kapi ya está en el estado vacío: el pie no lo asoma.
    <MarcoTienda {...marco} kapiEnPie={conSesion && !estadosCuenta.includes('vacio')}>
      <CuentaDemo
        ruta={rutaCuenta}
        sesion={conSesion}
        usuario={usuario}
        monedas={monedas}
        onMonedas={(n) => setMonedas((m) => Math.max(0, m + n))}
        fotos={FOTOS_CUENTA}
        deseos={DESEOS}
        onAgregar={(item) => (item.crudo ? onAgregar?.(item.crudo)?.() : false)}
        tema={tema}
        onTema={cambiarTema}
        onCerrarSesion={() => setRol('visitante')}
        estados={estadosCuenta}
        toast={toast}
        Parte={Parte}
        pedidos={PEDIDOS}
        recomendados={destacados.slice(3, 9)}
        catalogo={{ marcas: visibles, categorias: INICIO.categorias.map((c) => ({ id: c.categoryId, name: c.name })) }}
        onAgregarProducto={onAgregar}
        esAdmin={esAdmin}
        onIrATienda={() => irA('tienda')}
      />
    </MarcoTienda>
  ) : (
    <MarcoTienda {...marco}>
      {pagina === 'carrito' && (
        <Parte n="P1" nombre="PaginaCarrito">
          <PaginaCarrito
            items={carrito}
            onCantidad={(id, cantidad) => setCarrito((c) => c.map((it) => (it.id === id ? { ...it, cantidad } : it)))}
            onQuitar={(id) => setCarrito((c) => c.filter((it) => it.id !== id))}
            metaEnvio={META_ENVIO}
            recomendados={destacados.slice(3, 9)}
            onAgregar={onAgregar}
            onPagar={() => avisar('En la tienda iría al checkout', '/checkout')}
            onSeguirComprando={() => irA('inicio')}
            vacio={{ texto: 'Lo quitaste todo. Vuelve a llenarlo para seguir probando.', accion: <Boton icono={<RotateCcw aria-hidden="true" />} onClick={() => setCarrito(CARRITO_INICIAL)}>Restaurar carrito</Boton> }}
          />
        </Parte>
      )}
    </MarcoTienda>
  );

  return (
    <>
      <div className={cs.controlesInicio}>
        <div>
          <span className={cs.controlesTitulo}>Página</span>
          <Pestanas opciones={PAGINAS} valor={pagina} onChange={irA} etiqueta="Página de la tienda" />
        </div>
        <div>
          <span className={cs.controlesTitulo}>Ver como</span>
          <Pestanas opciones={ROLES} valor={rol} onChange={(r) => { setRol(r); if (r !== 'admin') setEditando(false); }} etiqueta="Ver la página como" />
        </div>
        {pagina === 'cuenta' && (
          <div>
            <span className={cs.controlesTitulo}>Sección de la cuenta</span>
            <div className={cs.controlesChips}>
              {MODULOS_CUENTA.map((m) => (
                <Chip key={m.ruta} tamano="sm" activo={rutaCuenta === m.ruta} onClick={() => { setRutaCuenta(m.ruta); if (marcoRef.current) marcoRef.current.scrollTop = 0; }}>{m.texto}</Chip>
              ))}
            </div>
            {conSesion && (
              <div className={cs.controlesChips}>
                {ESTADOS_CUENTA.map(([id, texto]) => (
                  <Chip key={id} tamano="sm" activo={estadosCuenta.includes(id)} onClick={() => setEstadosCuenta((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
                ))}
              </div>
            )}
          </div>
        )}
        {pagina === 'ver' && (
          <div>
            <span className={cs.controlesTitulo}>Estado</span>
            <div className={cs.controlesChips}>
              {ESTADOS_VER.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosVer.includes(id)} onClick={() => setEstadosVer((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'creacion' && (
          <div>
            <span className={cs.controlesTitulo}>Estado de la creación</span>
            <div className={cs.controlesChips}>
              {ESTADOS_CREACION.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosCreacion.includes(id)} onClick={() => setEstadosCreacion((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'comunidad' && (
          <div>
            <span className={cs.controlesTitulo}>Estado de la galería</span>
            <div className={cs.controlesChips}>
              {ESTADOS_COMUNIDAD.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosComunidad.includes(id)} onClick={() => setEstadosComunidad((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'crear' && (
          <div>
            <span className={cs.controlesTitulo}>Estado de Crear</span>
            <div className={cs.controlesChips}>
              {ESTADOS_CREAR.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosCrear.includes(id)} onClick={() => setEstadosCrear((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'acceso' && (
          <div>
            <span className={cs.controlesTitulo}>Pantalla</span>
            <div className={cs.controlesChips}>
              {VISTAS_ACCESO.map((v) => (
                <Chip key={v.ruta} tamano="sm" activo={rutaAcceso === v.ruta} onClick={() => { setRutaAcceso(v.ruta); if (marcoRef.current) marcoRef.current.scrollTop = 0; }}>{v.texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'encuesta' && conSesion && (
          <div>
            <span className={cs.controlesTitulo}>Estado de la encuesta</span>
            <div className={cs.controlesChips}>
              {ESTADOS_ENCUESTA.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosEncuesta.includes(id)} onClick={() => setEstadosEncuesta((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'minijuegos' && conSesion && (
          <div>
            <span className={cs.controlesTitulo}>Juegos de hoy</span>
            <div className={cs.controlesChips}>
              {HECHOS.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={hechos.includes(id)} onClick={() => setHechos((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]))}>{texto}</Chip>
              ))}
            </div>
            <div className={cs.controlesChips}>
              {RULETAS.map((r) => <Chip key={r.id} tamano="sm" activo={ruletaDemo === r.id} onClick={() => setRuletaDemo(r.id)}>{r.texto}</Chip>)}
            </div>
          </div>
        )}
        <div>
          <span className={cs.controlesTitulo}>Mostrar también</span>
          <div className={cs.controlesChips}>
            {EXTRAS.map(([id, texto]) => <Chip key={id} tamano="sm" activo={ver(id)} onClick={() => alternar(id)}>{texto}</Chip>)}
          </div>
        </div>
        <div>
          <span className={cs.controlesTitulo}>Ver la carga</span>
          <div className={cs.controlesChips}>
            <Chip tamano="sm" activo={carga === 'marca'} onClick={() => verCarga('marca')}>Primera vez (marca)</Chip>
            <Chip tamano="sm" activo={carga === 'esqueleto'} onClick={() => verCarga('esqueleto')}>Cambio de página (esqueleto de esta página)</Chip>
            <Chip tamano="sm" activo={carga === 'accion'} onClick={() => verCarga('accion')}>Esperando una acción (pago, landing…)</Chip>
          </div>
        </div>
        <div className={s.interruptor}>
          <Interruptor etiqueta="Ver componentes" descripcion="Cada parte con su número y su componente (guía en kit/guia)." activo={anatomia} onChange={setAnatomia} />
        </div>
      </div>

      <div className={[s.estudio, !enEditor && s.sinPanel].filter(Boolean).join(' ')}>
        <div ref={marcoRef} className={[s.lienzo, anatomia && s.anatomia].filter(Boolean).join(' ')}>
          <div className={[s.pagina, enEditor && s.paginaEditor, enEditor && vistaEditor === 'movil' && s.paginaMovil].filter(Boolean).join(' ')}>
            <ProveedorEnlaces componente={EnlaceTienda}>
              {contenido}
            </ProveedorEnlaces>
            {enEditor && <InsertarAqui indice={total} onInsertar={setInsertarEn} activo={insertarEn === total} />}
          </div>
          {carga === 'accion' && <CapaCargando texto="Procesando tu pago" detalle="No cierres esta página." />}
          {carga === 'marca' && (
            <PantallaCarga frases={FRASES_CARGA} saliendo={cargaSaliendo} onSalio={() => { setCarga(null); setCargaSaliendo(false); }} />
          )}
        </div>
        {enEditor && (
          <div className={s.lado}>
            <PanelEditor
              incrustado
              titulo="Inicio"
              secciones={secciones}
              onCambiar={cambiar}
              seleccionada={seleccionada}
              onSeleccionar={setSeleccionada}
              resaltada={resaltada}
              onResaltar={setResaltada}
              insertarEn={insertarEn}
              onInsertarEn={(i) => { setInsertarEn(i); if (i != null) setSeleccionada(null); }}
              fuentes={{
                marcas,
                categorias: INICIO.categorias.map((c) => ({ id: c.categoryId, name: c.name, imageUrl: c.imageUrl })),
                colecciones: [],
                subirArchivo: async (archivo) => ({ url: URL.createObjectURL(archivo) }),
              }}
              onGuardar={publicar}
              guardando={guardando}
              sinGuardar={borrador.sinGuardar}
              onDeshacer={borrador.deshacer}
              onRehacer={borrador.rehacer}
              puedeDeshacer={borrador.puedeDeshacer}
              puedeRehacer={borrador.puedeRehacer}
              vista={vistaEditor}
              onVista={setVistaEditor}
              onCerrar={() => setEditando(false)}
            />
          </div>
        )}
      </div>

      {ver('idioma') && (
        <div className={cs.avisoIdiomaDemo}>
          <AvisoIdioma
            idioma={{ codigo: 'EN', titulo: 'Looks like you speak English', texto: 'Do you want to see Walá in English?', cambiar: 'Switch to English' }}
            onCambiar={() => { alternar('idioma'); avisar('Idioma', 'En la tienda cambiaría a inglés'); }}
            onMantener={() => alternar('idioma')}
          />
        </div>
      )}

      {/* Como el popup de la tienda: solo la imagen, que es el botón. */}
      <VentanaCampana
        abierta={ver('campana')}
        onCerrar={() => alternar('campana')}
        formato="imagen"
        imagen="/images/popups/encuesta-conocerte-mejor.webp"
        titulo="Queremos conocerte mejor"
        onAccion={() => { alternar('campana'); avisar('En la tienda iría a', '/encuesta-suscripcion'); }}
      />
      {/* Kapi: como en la tienda, solo con sesión (sin perfil no hay mascota). */}
      {conSesion && (
        <VentanaKapi
          abierta={kapiAbierta}
          onCerrar={() => setKapiAbierta(false)}
          {...kapi}
          hasta={new Date(Date.now() + msHastaMananaLima()).toISOString()}
          onAlimentar={alimentarKapi}
          reto={ver('reto') ? { ...retoDesdePerfil(RETO_DEMO, {}), onEnviar: () => new Promise((r) => setTimeout(r, 800)) } : undefined}
        />
      )}
    </>
  );
}
