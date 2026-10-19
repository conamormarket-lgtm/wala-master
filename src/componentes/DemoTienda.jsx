import React, { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { RotateCcw, User, Package, Settings, Gift, Ticket, Sparkles } from 'lucide-react';
import {
  PaginaTienda, PaginaMarca, PaginaNoEncontrada, PaginaDescargarApp, MarcoTienda, PaginaCarrito, PaginaMinijuegos, juegosDelArcade, VentanaKapi, kapiDesdePerfil,
  retoDesdePerfil, PaginaBusqueda, sugerenciasDesdeBusqueda, grupoModalidad, ORDENES_BUSQUEDA, ordenarProductos,
  Pestanas, Chip, Interruptor, Boton, PantallaCarga, CapaCargando, EsqueletoPagina, FRASES_CARGA,
  BarraAdmin, AvisoSistema, BannerApp, BotonWhatsApp, KapiFlotante, PildoraRecompensa,
  VentanaCampana, AvisoIdioma, AvisoInvitacion, ProveedorEnlaces, ProveedorTraduccion, PanelEditor, useBorrador, SeccionEditable, InsertarAqui,
  moverSeccion, duplicarSeccion, rutaDeMarca, tarjetaDesdeProducto, REGISTRO_SECCIONES, enlaceWhatsApp, gruposDeCatalogo, ESQUELETO_MARCA, ETAPAS_PRODUCCION,
} from './kit';
import { empresa } from '../config/empresa';
import { msHastaMananaLima, msHastaLunesLima, limaTodayStr } from '../utils/fechaLima';
import { volarMonedasGanadas } from '../utils/animations';
import CREAR_DATOS from './demo/crear.json';
import { ProductoDemo, ESTADOS_PRODUCTO, ABRIR_PRODUCTO } from './DemoProducto';
import { CheckoutDemo, ESTADOS_CHECKOUT } from './DemoCheckout';
import { traducirDemo, traducirHtmlDemo } from './demo/traduccionDemo';
import { RegalarDemo, VISTAS_REGALAR, ESTADOS_REGALAR, PagoRapidoDemo, ESTADOS_PAGO_RAPIDO } from './DemoRegalar';
import { ENVIO_ESTANDAR, ENVIO_GRATIS_DESDE } from '../constants/envio';
import { LegalesDemo, VISTAS_LEGALES, ESTADOS_LEGALES } from './DemoLegales';
import { JuegosDemo, VISTAS_JUEGOS, ESTADOS_JUEGOS } from './DemoJuegos';
import { CampanasDemo, VISTAS_CAMPANAS, ESTADOS_CAMPANAS } from './DemoCampanas';
import { CASOS_MARCA, ESTADOS_MARCA, datosMarca, casoDeRuta } from './DemoNavegar';
import { CuentaDemo, MODULOS_CUENTA, ESTADOS_CUENTA, EncuestaDemo, ESTADOS_ENCUESTA, AccesoDemo, VISTAS_ACCESO, CrearDemo, ESTADOS_CREAR, ComunidadDemo, ESTADOS_COMUNIDAD, CreacionDemo, ESTADOS_CREACION, VerDisenoDemo, ESTADOS_VER, CASOS_VER, ComboDemo, ESTADOS_COMBO, EstudioDemo, ESTADOS_ESTUDIO } from './DemoCuenta';
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
  { id: 'producto', texto: 'Un producto', ruta: '/producto/' },
  { id: 'crear', texto: 'Crear', ruta: '/personalizar' },
  { id: 'estudio', texto: 'Estudio', ruta: '/crear/' },
  { id: 'comunidad', texto: 'Comunidad', ruta: '/comunidad' },
  { id: 'creacion', texto: 'Una creación', ruta: '/creacion/' },
  { id: 'ver', texto: 'Ver diseño', ruta: '/ver/' },
  { id: 'combo', texto: 'Un combo', ruta: '/combo/' },
  { id: 'minijuegos', texto: 'Minijuegos', ruta: '/minijuegos' },
  { id: 'juego', texto: 'Un juego', ruta: '/palabra-del-dia' },
  { id: 'buscar', texto: 'Buscar', ruta: '/buscar' },
  { id: 'marca', texto: 'Página de marca', ruta: '/marca' },
  { id: 'legales', texto: 'Legales', ruta: '/libro-de-reclamaciones' },
  { id: 'campanas', texto: 'Sorteos y campañas', ruta: '/sorteos' },
  { id: 'carrito', texto: 'Carrito', ruta: '/carrito' },
  { id: 'checkout', texto: 'Checkout', ruta: '/checkout' },
  { id: 'regalar', texto: 'Regalar', ruta: '/wishlist/' },
  { id: 'pagoRapido', texto: 'Pago rápido', ruta: '/pago-rapido/' },
  { id: 'cuenta', texto: 'Mi cuenta', ruta: '/cuenta' },
  { id: 'encuesta', texto: 'Encuesta', ruta: '/encuesta-suscripcion' },
  { id: 'acceso', texto: 'Acceso', ruta: '/login' },
  { id: 'noEncontrada', texto: 'No encontrada', ruta: '/poleras-anime' },
  { id: 'descargar', texto: 'Descargar la app', ruta: '/descargar' },
];

/** Ruta de la tienda → página de esta demo (las demás solo avisan). */
/* Para los chips de "Un combo": los combos reales y un diseño de pareja. */
const CREAR_COMBOS = CREAR_DATOS.combos.map((c) => c.id);
const CREAR_PLANTILLA = (CREAR_DATOS.comunidad.find((d) => d.tipo === 'combo') || {}).id;
/* Para los chips del estudio: la polera, el polo y una creación suelta real. */
const CREAR_POLERA = (CREAR_DATOS.prendas.find((p) => p.name === 'Polera clásica') || CREAR_DATOS.prendas[0]).id;
const CREAR_POLO = (CREAR_DATOS.prendas.find((p) => p.name === 'Polo clásico') || CREAR_DATOS.prendas[0]).id;
const CREAR_SUELTA = (CREAR_DATOS.comunidad.find((d) => d.tipo !== 'combo' && d.productId === CREAR_POLERA) || {}).id;
const ABRIR_ESTUDIO = [
  ['Nuevo', `/crear/${CREAR_POLERA}`],
  ['Editar una creación', `/crear/${CREAR_POLERA}?designId=${CREAR_SUELTA}`],
  ['Desde la comunidad', `/crear/${CREAR_POLERA}?plantilla=${CREAR_SUELTA}`],
  ['Prenda de un combo', `/crear/${CREAR_POLERA}?combo=${CREAR_COMBOS[0]}&pieza=1`],
  ['Otra prenda (polo)', `/crear/${CREAR_POLO}`],
];

const PAGINA_DE_RUTA = {
  '/': 'inicio', '/tienda': 'tienda', '/descargar': 'descargar', '/app': 'descargar', '/minijuegos': 'minijuegos', '/buscar': 'buscar', '/carrito': 'carrito', '/checkout': 'checkout', '/encuesta-suscripcion': 'encuesta', '/personalizar': 'crear', '/comunidad': 'comunidad', '/ofertas': 'tienda', '/nichos': 'tienda',
  ...Object.fromEntries(VISTAS_LEGALES.map(([, r]) => [r, 'legales'])),
  ...Object.fromEntries(VISTAS_JUEGOS.map(([, r]) => [r, 'juego'])),
  ...Object.fromEntries(VISTAS_CAMPANAS.map(([, r]) => [r, 'campanas'])),
  ...Object.fromEntries(MODULOS_CUENTA.map((m) => [m.ruta, 'cuenta'])),
  ...Object.fromEntries(VISTAS_ACCESO.map((v) => [v.ruta, 'acceso'])),
};

/** Pestaña de la barra inferior que se enciende en cada página. */
const PESTANA_DE_PAGINA = { inicio: 'inicio', tienda: 'tienda', marca: 'tienda', juego: 'juegos', campanas: 'tienda', producto: 'tienda', checkout: 'tienda', regalar: 'tienda', pagoRapido: 'tienda', noEncontrada: 'tienda', descargar: 'tienda', minijuegos: 'juegos', buscar: 'tienda', carrito: 'tienda', cuenta: 'cuenta', acceso: 'cuenta', crear: 'crear', estudio: 'crear', comunidad: 'crear', creacion: 'cuenta', combo: 'crear' };

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
  ['invitacion', 'Aviso de invitación'],
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
    { texto: 'Políticas de Privacidad', url: '/politicas-privacidad' },
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

// La regla de la tienda (constants/envio): S/ 15, gratis en compras de MÁS de S/ 100.
const META_ENVIO = ENVIO_GRATIS_DESDE;
const { destacados, nuevos, ofertas } = INICIO.productos;

/** Producto de la tienda → fila del carrito / pedido / favoritos. */
const fila = (p, extra = {}) => {
  const t = tarjetaDesdeProducto(p);
  return { id: p.id, imagen: t.imagen, nombre: p.name, precio: t.precio, precioAntes: t.precioAntes, cantidad: 1, ...extra };
};

const CARRITO_INICIAL = [
  fila(destacados[0], { detalles: [{ etiqueta: 'Talla', valor: 'M' }] }),
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
  // "Ver en inglés": los textos de los datos pasan por un traductor de prueba.
  const [ingles, setIngles] = useState(false);
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
  const [casoVer, setCasoVer] = useState('pareja');
  const [rutaCombo, setRutaCombo] = useState('/combo/');
  const [rutaEstudio, setRutaEstudio] = useState(ABRIR_ESTUDIO[0][1]);
  const [rutaProducto, setRutaProducto] = useState(ABRIR_PRODUCTO[0][1]);
  const [estadosProducto, setEstadosProducto] = useState([]);
  const [estadosCheckout, setEstadosCheckout] = useState([]);
  const [estadosCarrito, setEstadosCarrito] = useState([]);
  const [rutaRegalar, setRutaRegalar] = useState(VISTAS_REGALAR[0][1]);
  const [estadosRegalar, setEstadosRegalar] = useState([]);
  const [estadosPagoRapido, setEstadosPagoRapido] = useState([]);
  // Descargar la app: en qué aparato se abre (la tienda lo sabría por el navegador).
  const [plataformaApp, setPlataformaApp] = useState('android');
  const [estadosEstudio, setEstadosEstudio] = useState([]);
  const [estadosCombo, setEstadosCombo] = useState([]);
  const [rutaAcceso, setRutaAcceso] = useState('/login');
  // Página de marca: identidad + plantilla (PaginaMarca).
  const [casoMarca, setCasoMarca] = useState('geeks');
  const [estadosMarca, setEstadosMarca] = useState([]);
  const [filtrosMarca, setFiltrosMarca] = useState({});
  const [rutaLegal, setRutaLegal] = useState(VISTAS_LEGALES[0][1]);
  const [estadosLegales, setEstadosLegales] = useState([]);
  const [rutaJuego, setRutaJuego] = useState(VISTAS_JUEGOS[0][1]);
  const [rutaCampana, setRutaCampana] = useState(VISTAS_CAMPANAS[0][1]);
  const [estadosCampana, setEstadosCampana] = useState([]);
  const [estadoInvitacion, setEstadoInvitacion] = useState('nueva');
  const [estadosJuego, setEstadosJuego] = useState([]);
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
  // Lo global del editor (en la tienda: storeConfig/homePage): el menú de la cabecera y el de cuenta.
  const [globalesDemo, setGlobalesDemo] = useState({
    header: { navLinks: [{ id: '1', text: 'Tienda', type: 'dropdown', url: '/tienda', isCategoryAuto: true }, { id: '2', text: 'Crear', type: 'link', url: '/personalizar' }] },
    accountPopup: { title: 'Tu cuenta Walá', description: 'Inicia sesión para ver tus pedidos.' },
  });
  const cambiarGlobal = (id) => (parche) => setGlobalesDemo((g) => ({ ...g, [id]: { ...g[id], ...parche } }));

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
    // Un combo (/combo/:id?nuevo=1 | ?mio= | ?plantilla=) también.
    if (ruta.startsWith('/combo/')) { setRutaCombo(to); irA('combo'); return; }
    // El estudio (/crear/:id?designId= | ?plantilla= | ?copiar= | ?combo=&pieza=).
    if (ruta.startsWith('/crear/')) { setRutaEstudio(to); irA('estudio'); return; }
    // La ficha de un producto (/producto/:id): cualquier tarjeta abre la suya.
    if (ruta.startsWith('/producto/')) { setRutaProducto(ruta); irA('producto'); return; }
    // Regalar: la lista de otra persona, sus fechas y abrir el regalo.
    if (/^\/(wishlist|regalar|regalo)\//.test(ruta)) { setRutaRegalar(ruta); irA('regalar'); return; }
    if (ruta.startsWith('/pago-rapido/')) { irA('pagoRapido'); return; }
    // Una invitación no tiene página: como la tienda, lleva al registro y el aviso queda arriba.
    // La invitación: su página (PaginaInvitacion). "Crear mi cuenta" sigue al registro con ?tipo=invitacion.
    if (ruta.startsWith('/invitar/')) { setRutaCampana(ruta); setEstadosCampana([]); irA('campanas'); return; }
    if (/(^|&)tipo=invitacion(&|$)/.test(query)) { setExtras((xs) => (xs.includes('invitacion') ? xs : [...xs, 'invitacion'])); setEstadoInvitacion('nueva'); }
    if (ruta.startsWith('/l/') || ruta.startsWith('/sorteos/') || ruta.startsWith('/suscrito-sorteo/')) { setRutaCampana(ruta.startsWith('/l/') ? ruta : ruta.replace(/\/[^/]+$/, '')); setEstadosCampana([]); irA('campanas'); return; }
    // Los nichos y los vendedores se retiraron: como la tienda, van a /tienda.
    if (/^\/(nicho|tienda-vendedor)\//.test(ruta) || ruta === '/nichos' || ruta === '/vendedor') { irA('tienda'); return; }
    // La página de una marca (/:slug): el diseño nuevo (PaginaMarca).
    if (casoDeRuta(ruta)) { setCasoMarca(casoDeRuta(ruta)); setFiltrosMarca({}); setEstadosMarca([]); irA('marca'); return; }
    if (!PAGINA_DE_RUTA[ruta]) { avisar('En la tienda iría a', to); return; }
    if (ruta === '/buscar') {
      const p = new URLSearchParams(query);
      setConsulta({ q: p.get('q') || '', marca: p.get('brand') || '' });
      setFiltrosBusqueda({});
      setPaginasBusqueda(1);
    }
    if (PAGINA_DE_RUTA[ruta] === 'cuenta') setRutaCuenta(ruta);
    if (PAGINA_DE_RUTA[ruta] === 'acceso') setRutaAcceso(ruta);
    if (PAGINA_DE_RUTA[ruta] === 'legales') setRutaLegal(ruta);
    if (PAGINA_DE_RUTA[ruta] === 'juego') { setRutaJuego(ruta); setEstadosJuego([]); }
    if (PAGINA_DE_RUTA[ruta] === 'campanas') { setRutaCampana(ruta); setEstadosCampana([]); }
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
    activo: ['tienda', 'minijuegos', 'crear'].includes(pagina) ? pagina : pagina === 'juego' ? 'minijuegos' : ['comunidad', 'combo', 'estudio'].includes(pagina) ? 'crear' : pagina === 'producto' ? 'tienda' : null,
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
  const enEncuesta = ['encuesta', 'acceso', 'crear', 'estudio', 'checkout', 'juego'].includes(pagina);
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

  const arriba = (ver('aviso') || ver('app') || ver('invitacion') || esAdmin) && (
    <>
      {ver('invitacion') && (
        <Parte n="M12" nombre="AvisoInvitacion">
          <AvisoInvitacion nombre="Isaac" estado={estadoInvitacion} plazo="hasta el jueves 16, 9:20 p. m." urlRegistro={pagina === 'acceso' ? null : '/registro'} onCerrar={() => alternar('invitacion')} />
        </Parte>
      )}
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
            // En la ficha, como en la tienda: editar ese producto en el panel.
            editarEn={pagina === 'producto' ? `/admin/productos/${rutaProducto.split('/producto/')[1] || ''}` : undefined}
            textoEditor={pagina === 'producto' ? 'Editar este producto' : undefined}
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

  /* ── Página de marca: identidad + plantilla (PaginaMarca) ── */
  const datosDeMarca = useMemo(() => datosMarca(casoMarca), [casoMarca]);
  const gruposMarca = useMemo(() => gruposDeCatalogo({
    categorias: TIENDA.categorias, colecciones: TIENDA.colecciones, marcas: visibles, tipos: TIENDA.tipos,
    etiquetas: TIENDA.etiquetas, personajes: TIENDA.personajes, productos: datosDeMarca.productos.todos, marcaActual: datosDeMarca.marca.id,
  }), [datosDeMarca, visibles]);
  // Como TiendaPage en una página de marca: las burbujas filtran el catálogo de la misma página.
  const propsMarca = (sec) => {
    if (sec.type === 'sidebar_catalog') {
      return { grupos: gruposMarca, seleccion: filtrosMarca, onFiltrar: (grupo, valor) => setFiltrosMarca((f) => ({ ...f, [grupo]: valor })), filtrarAqui: true, conBuscador: true };
    }
    if (sec.type === 'categories_nav') {
      return { activa: filtrosMarca.categoria || null, onSeleccionar: (id) => setFiltrosMarca((f) => ({ ...f, categoria: id || undefined })) };
    }
    return undefined;
  };

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
    noEncontrada: 'aviso', descargar: 'aviso',
    tienda: 'tienda', campanas: rutaCampana.startsWith('/invitar/') ? 'invitacion' : { '/sorteos': 'sorteo', '/suscrito-sorteo': 'suscripcionSorteo', '/suscripciones': 'landing' }[rutaCampana] || 'enlaces', juego: { '/ruleta': 'ruleta', '/ball-sort': 'bolitas' }[rutaJuego] || 'palabra', legales: rutaLegal === '/libro-de-reclamaciones' ? 'reclamaciones' : 'legal', producto: 'producto', checkout: 'checkout', buscar: 'busqueda', carrito: 'carrito', crear: 'crear', estudio: 'estudio', comunidad: 'comunidad', creacion: 'producto', combo: 'producto', ver: 'verDiseno', minijuegos: 'minijuegos', encuesta: 'encuesta', acceso: 'acceso', cuenta: 'cuenta',
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
        {pagina === 'inicio' || pagina === 'marca'
          ? <EsqueletoPagina secciones={pagina === 'marca' ? ESQUELETO_MARCA : secciones.map((x) => x.type)} />
          : <EsqueletoPagina forma={formaEsqueleto} modulo={moduloEsqueleto} sesion={conSesion} tarjetas={pagina === 'ver' ? CASOS_VER.find((c) => c[0] === casoVer)?.[2] : undefined} />}
      </Parte>
    </MarcoTienda>
  ) : pagina === 'campanas' ? (
    // El Link en bio va solo (es la página de la bio de Instagram o TikTok): sin cabecera, pie, barra ni flotantes.
    rutaCampana.startsWith('/l/') ? (
      <MarcoTienda {...marco} cabecera={null} pie={null} pieLegal={null} barraInferior={null} flotantes={undefined} kapiEnPie={false}>
        <Parte n="P21" nombre="PaginaEnlaces">
          <CampanasDemo ruta={rutaCampana} sesion={conSesion} usuario={usuario} estados={estadosCampana} toast={toast} />
        </Parte>
      </MarcoTienda>
    ) : (
      <MarcoTienda {...marco} kapiEnPie={!estadosCampana.some((e) => ['vacio', 'error', 'noDisponible', 'invalida'].includes(e))}>
        <Parte n={rutaCampana.startsWith('/invitar/') ? 'M12' : 'P21'} nombre={rutaCampana.startsWith('/invitar/') ? 'PaginaInvitacion' : { '/sorteos': 'PaginaSorteo', '/suscrito-sorteo': 'PaginaSuscripcionSorteo', '/suscripciones': 'PaginaSuscripciones' }[rutaCampana]}>
          <CampanasDemo ruta={rutaCampana} sesion={conSesion} usuario={usuario} estados={estadosCampana} toast={toast} />
        </Parte>
      </MarcoTienda>
    )
  ) : pagina === 'juego' ? (
    // Un juego es una herramienta: sin Kapi en el pie (aparece en el resultado).
    <MarcoTienda {...marco} kapiEnPie={false}>
      <Parte n="P20" nombre={{ '/ruleta': 'PaginaRuleta', '/ball-sort': 'PaginaBolitas' }[rutaJuego] || 'PaginaPalabra'}>
        <JuegosDemo key={rutaJuego} ruta={rutaJuego} sesion={conSesion} usuario={usuario} estados={estadosJuego} onMonedas={(n) => setMonedas((m) => m + n)} toast={toast} />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'legales' ? (
    // Privacidad y términos terminan con la tarjeta de ayuda (Kapi asomado): el pie no lo repite.
    <MarcoTienda {...marco} kapiEnPie={rutaLegal === '/libro-de-reclamaciones'}>
      <Parte n="P19" nombre={rutaLegal === '/libro-de-reclamaciones' ? 'PaginaReclamaciones' : 'PaginaLegal'}>
        <LegalesDemo ruta={rutaLegal} sesion={conSesion} usuario={usuario} estados={estadosLegales} />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'marca' ? (
    // La página de una marca sin armarla: su identidad (TemaMarca + portada) y la plantilla.
    <PaginaMarca
      {...marco}
      key={casoMarca}
      marca={datosDeMarca.marca}
      productos={estadosMarca.includes('sinProductos') ? { todos: [] } : datosDeMarca.productos}
      categorias={datosDeMarca.categorias}
      navPorMarca={datosDeMarca.navPorMarca}
      marcas={marcas}
      onAgregar={onAgregar}
      propsPara={propsMarca}
      envolver={envolverTienda}
      estado={estadosMarca.includes('cargando') ? 'cargando' : estadosMarca.includes('error') ? 'error' : undefined}
      onReintentar={() => avisar('Volviendo a cargar', 'La marca y sus productos.')}
    />
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
  ) : pagina === 'regalar' ? (
    <MarcoTienda {...marco} kapiEnPie={false}>
      <Parte n="P15" nombre={rutaRegalar.startsWith('/regalo/') ? 'PaginaRegaloSorpresa' : rutaRegalar.startsWith('/regalar/') ? 'PaginaRegalar' : 'PaginaListaPublica'}>
        <RegalarDemo key={rutaRegalar} ruta={rutaRegalar} estados={estadosRegalar} toast={toast} onCarrito={(item) => setCarrito((c) => [...c, item])} onIrA={(r) => navegar.current(r)} />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'noEncontrada' ? (
    // Una dirección que no existe (la propuesta: hoy la tienda manda al inicio sin avisar). Kapi ya está en la tarjeta.
    <MarcoTienda {...marco} kapiEnPie={false}>
      <Parte n="P22" nombre="PaginaNoEncontrada">
        <PaginaNoEncontrada ruta="/poleras-anime" onBuscar={(q) => navegar.current(`/buscar?q=${encodeURIComponent(q)}`)} />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'descargar' ? (
    // Descargar la app (/descargar, /app): la propuesta; hoy es un texto suelto que salta a la Play Store.
    <MarcoTienda {...marco}>
      <Parte n="P23" nombre="PaginaDescargarApp">
        <PaginaDescargarApp plataforma={plataformaApp} />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'pagoRapido' ? (
    // Un enlace de pago: sin la barra inferior ni Kapi en el pie (solo pagar).
    <MarcoTienda {...marco} barraInferior={null} kapiEnPie={false}>
      <Parte n="P16" nombre="PaginaPagoRapido">
        <PagoRapidoDemo sesion={conSesion} estados={estadosPagoRapido} toast={toast} />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'checkout' ? (
    // Pagar: sin la barra inferior (la compra manda) y sin Kapi en el pie.
    <MarcoTienda {...marco} barraInferior={null} kapiEnPie={false}>
      <Parte n="P14" nombre="PaginaCheckout">
        <CheckoutDemo items={carrito.filter((it) => it.seleccionado !== false)} sesion={conSesion} usuario={usuario} monedas={monedas} estados={estadosCheckout} toast={toast} onIrA={(r) => navegar.current(r)} />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'producto' ? (
    // Sin producto (error o retirado), Kapi ya está en el estado vacío.
    <MarcoTienda {...marco} kapiEnPie={!estadosProducto.some((e) => e === 'error' || e === 'noDisponible')}>
      <Parte n="P13" nombre="PaginaProducto">
        <ProductoDemo
          key={rutaProducto}
          ruta={rutaProducto}
          sesion={conSesion}
          estados={estadosProducto}
          marcas={marcas}
          carrito={enCarrito}
          onCarrito={(item) => setCarrito((c) => [...c, item])}
          onAgregar={onAgregar}
          toast={toast}
          onIrA={(r) => navegar.current(r)}
        />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'estudio' ? (
    // El estudio es una herramienta: sin pie, sin barra inferior ni flotantes
    // (taparían la prenda y la compra, que va pegada abajo en el celular).
    <MarcoTienda {...marco} pie={null} pieLegal={null} barraInferior={null} flotantes={undefined}>
      <Parte n="P12" nombre="PaginaEstudio">
        <EstudioDemo key={rutaEstudio} ruta={rutaEstudio} sesion={conSesion} estados={estadosEstudio} toast={toast} onIrA={(r) => navegar.current(r)} />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'combo' ? (
    <MarcoTienda {...marco}>
      <Parte n="P11" nombre="PaginaCombo">
        <ComboDemo key={rutaCombo} ruta={rutaCombo} sesion={conSesion} esAdmin={esAdmin} estados={estadosCombo} toast={toast} onIrA={(r) => navegar.current(r)} />
      </Parte>
    </MarcoTienda>
  ) : pagina === 'ver' ? (
    <MarcoTienda {...marco} kapiEnPie={!estadosVer.includes('noDisponible')}>
      <Parte n="P10" nombre="PaginaVerDiseno">
        <VerDisenoDemo key={casoVer} caso={casoVer} estados={estadosVer} />
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
        <CrearDemo sesion={conSesion} esAdmin={esAdmin} estados={estadosCrear} toast={toast} onIrA={(r) => navegar.current(r)} />
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
            items={carrito.map((it, k) => (k === 0 && estadosCarrito.includes('incompleto') ? { ...it, detalles: [], incompleto: 'talla', urlElegir: it.url } : it))}
            onCantidad={(id, cantidad) => setCarrito((c) => c.map((it) => (it.id === id ? { ...it, cantidad } : it)))}
            onQuitar={(id) => setCarrito((c) => c.filter((it) => it.id !== id))}
            onSeleccionar={(id, v) => setCarrito((c) => c.map((it) => (it.id === id ? { ...it, seleccionado: v } : it)))}
            onSeleccionarTodo={(v) => setCarrito((c) => c.map((it) => ({ ...it, seleccionado: v })))}
            onQuitarSeleccionados={() => setCarrito((c) => c.filter((it) => it.seleccionado === false))}
            onVaciar={() => setCarrito([])}
            pendiente={estadosCarrito.includes('pendiente') ? { codigo: 'PD-9QZ38Z' } : undefined}
            saldoMonedas={conSesion ? monedas : 0}
            metaEnvio={META_ENVIO}
            costoEnvio={ENVIO_ESTANDAR}
            recomendados={destacados.slice(3, 9)}
            onAgregar={onAgregar}
            onPagar={() => navegar.current('/checkout')}
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
        {pagina === 'campanas' && (
          <div>
            <span className={cs.controlesTitulo}>Cómo se abre</span>
            <div className={cs.controlesChips}>
              {VISTAS_CAMPANAS.map(([texto, r]) => (
                <Chip key={texto} tamano="sm" activo={rutaCampana === r} onClick={() => { setRutaCampana(r); setEstadosCampana([]); if (marcoRef.current) marcoRef.current.scrollTop = 0; }}>{texto}</Chip>
              ))}
            </div>
            <div className={cs.controlesChips}>
              {(ESTADOS_CAMPANAS[rutaCampana.startsWith('/l/') ? 'enlaces' : rutaCampana.startsWith('/invitar/') ? 'invitar' : rutaCampana] || []).map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosCampana.includes(id)} onClick={() => setEstadosCampana((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'juego' && (
          <div>
            <span className={cs.controlesTitulo}>Cómo se abre</span>
            <div className={cs.controlesChips}>
              {VISTAS_JUEGOS.map(([texto, r]) => (
                <Chip key={texto} tamano="sm" activo={rutaJuego === r} onClick={() => { setRutaJuego(r); setEstadosJuego([]); if (marcoRef.current) marcoRef.current.scrollTop = 0; }}>{texto}</Chip>
              ))}
            </div>
            <div className={cs.controlesChips}>
              {(ESTADOS_JUEGOS[rutaJuego] || []).map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosJuego.includes(id)} onClick={() => setEstadosJuego((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'legales' && (
          <div>
            <span className={cs.controlesTitulo}>Cómo se abre</span>
            <div className={cs.controlesChips}>
              {VISTAS_LEGALES.map(([texto, r]) => (
                <Chip key={texto} tamano="sm" activo={rutaLegal === r} onClick={() => { setRutaLegal(r); if (marcoRef.current) marcoRef.current.scrollTop = 0; }}>{texto}</Chip>
              ))}
            </div>
            <div className={cs.controlesChips}>
              {ESTADOS_LEGALES.filter(([id]) => id !== 'falla' || rutaLegal === '/libro-de-reclamaciones').map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosLegales.includes(id)} onClick={() => setEstadosLegales((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'marca' && (
          <div>
            <span className={cs.controlesTitulo}>Cómo se abre</span>
            <div className={cs.controlesChips}>
              {CASOS_MARCA.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={casoMarca === id} onClick={() => { setCasoMarca(id); setFiltrosMarca({}); if (marcoRef.current) marcoRef.current.scrollTop = 0; }}>{texto}</Chip>
              ))}
            </div>
            <div className={cs.controlesChips}>
              {ESTADOS_MARCA.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosMarca.includes(id)} onClick={() => setEstadosMarca((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'regalar' && (
          <div>
            <span className={cs.controlesTitulo}>Cómo se abre</span>
            <div className={cs.controlesChips}>
              {VISTAS_REGALAR.map(([texto, r]) => (
                <Chip key={texto} tamano="sm" activo={rutaRegalar === r} onClick={() => setRutaRegalar(r)}>{texto}</Chip>
              ))}
            </div>
            <div className={cs.controlesChips}>
              {ESTADOS_REGALAR.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosRegalar.includes(id)} onClick={() => setEstadosRegalar((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'descargar' && (
          <div>
            <span className={cs.controlesTitulo}>Se abre desde</span>
            <div className={cs.controlesChips}>
              {[['android', 'Android'], ['iphone', 'iPhone'], ['computadora', 'Computadora']].map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={plataformaApp === id} onClick={() => setPlataformaApp(id)}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'pagoRapido' && (
          <div>
            <span className={cs.controlesTitulo}>Estado del enlace</span>
            <div className={cs.controlesChips}>
              {ESTADOS_PAGO_RAPIDO.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosPagoRapido.includes(id)} onClick={() => setEstadosPagoRapido((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'carrito' && (
          <div>
            <span className={cs.controlesTitulo}>Estado del carrito</span>
            <div className={cs.controlesChips}>
              {[['pendiente', 'Pedido esperando el pago'], ['incompleto', 'Falta una talla']].map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosCarrito.includes(id)} onClick={() => setEstadosCarrito((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
              <Chip tamano="sm" onClick={() => setCarrito(CARRITO_INICIAL)}>Restaurar carrito</Chip>
            </div>
          </div>
        )}
        {pagina === 'checkout' && (
          <div>
            <span className={cs.controlesTitulo}>Estado del checkout</span>
            <div className={cs.controlesChips}>
              {ESTADOS_CHECKOUT.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosCheckout.includes(id)} onClick={() => setEstadosCheckout((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'producto' && (
          <div>
            <span className={cs.controlesTitulo}>Cómo se abre</span>
            <div className={cs.controlesChips}>
              {ABRIR_PRODUCTO.map(([texto, r]) => (
                <Chip key={texto} tamano="sm" activo={rutaProducto === r} onClick={() => setRutaProducto(r)}>{texto}</Chip>
              ))}
            </div>
            <div className={cs.controlesChips}>
              {ESTADOS_PRODUCTO.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosProducto.includes(id)} onClick={() => setEstadosProducto((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'estudio' && (
          <div>
            <span className={cs.controlesTitulo}>Cómo se abre</span>
            <div className={cs.controlesChips}>
              {ABRIR_ESTUDIO.map(([texto, r]) => (
                <Chip key={texto} tamano="sm" activo={rutaEstudio === r} onClick={() => setRutaEstudio(r)}>{texto}</Chip>
              ))}
            </div>
            <div className={cs.controlesChips}>
              {ESTADOS_ESTUDIO.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosEstudio.includes(id)} onClick={() => setEstadosEstudio((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'combo' && (
          <div>
            <span className={cs.controlesTitulo}>Cómo se abre</span>
            <div className={cs.controlesChips}>
              {[['Nuevo (vacío)', `/combo/${CREAR_COMBOS[0]}?nuevo=1`], ['Conjunto', `/combo/${CREAR_COMBOS[1]}?nuevo=1`], ['Desde la comunidad', `/combo/${CREAR_COMBOS[0]}?plantilla=${CREAR_PLANTILLA}`], ['Mi combo (guardado)', `/combo/${CREAR_COMBOS[0]}?mio=${CREAR_PLANTILLA}`]].map(([texto, r]) => (
                <Chip key={texto} tamano="sm" activo={rutaCombo === r} onClick={() => setRutaCombo(r)}>{texto}</Chip>
              ))}
            </div>
            <div className={cs.controlesChips}>
              {ESTADOS_COMBO.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadosCombo.includes(id)} onClick={() => setEstadosCombo((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
              ))}
            </div>
          </div>
        )}
        {pagina === 'ver' && (
          <div>
            <span className={cs.controlesTitulo}>Cómo se abre</span>
            <div className={cs.controlesChips}>
              {CASOS_VER.map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={casoVer === id} onClick={() => setCasoVer(id)}>{texto}</Chip>
              ))}
            </div>
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
          {ver('invitacion') && (
            <div className={cs.controlesChips}>
              {[['nueva', 'Invitación: sin cuenta'], ['aceptada', 'Invitación aceptada'], ['compra', 'Link de compra']].map(([id, texto]) => (
                <Chip key={id} tamano="sm" activo={estadoInvitacion === id} onClick={() => setEstadoInvitacion(id)}>{texto}</Chip>
              ))}
            </div>
          )}
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
        <div className={s.interruptor}>
          <Interruptor etiqueta="Ver en inglés" descripcion="Los textos de los datos (productos, títulos, descripciones) pasan por la traducción. Aquí, un diccionario de prueba." activo={ingles} onChange={setIngles} />
        </div>
      </div>

      <div className={[s.estudio, !enEditor && s.sinPanel].filter(Boolean).join(' ')}>
        <div ref={marcoRef} className={[s.lienzo, anatomia && s.anatomia].filter(Boolean).join(' ')}>
          <div className={[s.pagina, enEditor && s.paginaEditor, enEditor && vistaEditor === 'movil' && s.paginaMovil].filter(Boolean).join(' ')}>
            <ProveedorEnlaces componente={EnlaceTienda}>
              <ProveedorTraduccion texto={ingles ? traducirDemo : undefined} html={ingles ? traducirHtmlDemo : undefined}>
                {contenido}
              </ProveedorTraduccion>
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
              globales={[
                { id: 'header', esquema: 'header', ajustes: globalesDemo.header, onCambiar: cambiarGlobal('header') },
                { id: 'accountPopup', esquema: 'accountPopup', ajustes: globalesDemo.accountPopup, onCambiar: cambiarGlobal('accountPopup') },
                { id: 'pie', nombre: 'Pie de página', descripcion: 'En la tienda abre su propia página.', onAbrir: () => avisar('Pie de página', 'En la tienda, el panel pasa a editar el pie.') },
              ]}
              base={[{ type: 'hero_banner' }, { type: 'trust_badges' }, { type: 'featured_carousel' }, { type: 'faq_accordion' }]}
            />
          </div>
        )}
      </div>

      {ver('idioma') && (
        <div className={cs.avisoIdiomaDemo}>
          <AvisoIdioma
            idioma={{ codigo: 'EN', titulo: 'Looks like you speak English', texto: 'Do you want to see Walá in English?', cambiar: 'Switch to English' }}
            onCambiar={() => { alternar('idioma'); setIngles(true); }}
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
