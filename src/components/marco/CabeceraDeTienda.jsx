import React, { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWishlist } from '../../contexts/WishlistContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLayoutContext } from '../../contexts/LayoutContext';
import { useVisualEditor } from '../../pages/Tienda/contexts/VisualEditorContext';
import { getCategories, getProducts, getProductsByBrand, categoriasConProductos } from '../../services/products';
import { getBrands } from '../../services/brands';
import { getDocument } from '../../services/firebase/firestore';
import { getSearchSuggestions } from '../../services/search';
import { trackSearchQuery } from '../../services/analytics/tracker';
import { logout } from '../../services/firebase/auth';
import { registrarTextosSinTraducir } from '../../services/textosSinTraducir';
import { esAppNativa } from '../../utils/vistaPreviaCalor';
import { irALink } from '../../utils/pushLink';
import { tieneCuenta } from '../../utils/rutaPrivada';
import { ENVIO_GRATIS_DESDE } from '../../constants/envio';
import useLoViejo from '../../hooks/useLoViejo';
import { useGruposDeCuenta } from '../cuenta/gruposDeCuenta';
import EditableSection from '../admin/EditableSection';
import CustomFontsInjector from '../common/CustomFontsInjector/CustomFontsInjector';
import { MONEDA_SRC } from '../common/Moneda';
import { Cabecera } from '../../componentes/kit/Navegacion';
import { rutaDeMarca, sugerenciasDesdeBusqueda } from '../../componentes/kit/adaptadores';
import s from './CabeceraDeTienda.module.css';

// La cabecera de antes, solo con el interruptor cabeceraVieja (guia/ELIMINAR.md).
const Header = lazy(() => import('../common/Header'));

// La moneda se pide al arrancar: así casi siempre llega antes que el saldo y
// la píldora aparece entera (sin la moneda un instante después del número).
const monedaPrecargada = typeof window !== 'undefined' ? new Image() : null;
if (monedaPrecargada) monedaPrecargada.src = MONEDA_SRC;

// Los accesos del menú de cuenta (el resto, con "Ver toda mi cuenta"). La
// lista de deseos no: ya tiene su corazón en la cabecera.
const ACCESOS_RAPIDOS = new Set([
  '/cuenta/perfil', '/cuenta/pedidos', '/cuenta/ajustes', '/cuenta/catalogo', '/cuenta/cupones', '/cuenta/creaciones',
]);

// Rótulos estándar del menú → clave del diccionario; los propios del admin
// pasan por la traducción del kit.
const CLAVES_ENLACE = {
  tienda: 'nav.tienda', crear: 'nav.crear', categorias: 'nav.categorias', 'categorías': 'nav.categorias',
  marcas: 'nav.marcas', minijuegos: 'nav.minijuegos', cuenta: 'nav.cuenta', 'mi cuenta': 'nav.cuenta',
};

const NOMBRES_IDIOMA = { es: 'Español', en: 'English', pt: 'Português (Brasil)' };

// El menú de siempre si la página no guardó uno.
const ENLACES_POR_DEFECTO = [
  { id: '1', text: 'Tienda', type: 'dropdown', url: '/tienda', isCategoryAuto: true },
  { id: '2', text: 'Suscripciones', type: 'link', url: '/suscripciones' },
  { id: '3', text: 'Crear', type: 'link', url: '/personalizar' },
];

const CELULAR = '(max-width: 768px)';
const esCelular = () => typeof window !== 'undefined' && window.matchMedia?.(CELULAR).matches;
const rutaSinConsulta = (url) => String(url || '').split(/[?#]/)[0] || '/';
const fechaDe = (f) => {
  try {
    const d = f?.toDate ? f.toDate() : (f ? new Date(f) : null);
    return d && !Number.isNaN(d.getTime()) ? d : null;
  } catch {
    return null;
  }
};

/*
 * Cabecera (M4) con el kit. Mismas reglas y datos que Header.jsx:
 *  - No sale si la página la apaga (LayoutContext); pegada arriba bajo la barra
 *    de admin; en el celular publica su alto (--header-height).
 *  - El menú: storeConfig/homePage.header.navLinks (el borrador del editor si
 *    se está editando; mientras llega, la copia del navegador) + "Minijuegos".
 *    "Tienda": las categorías con productos, pedidas al abrir el menú; en la
 *    página de una marca, las suyas y "Ver todo" a la marca.
 *  - Monedas, notificaciones, favoritos y carrito de sus contextos; el
 *    buscador con sugerencias (acotado a la marca de la página).
 *  - Las fuentes propias de la página (CustomFontsInjector) y la caja del
 *    editor visual ("Menú de Navegación").
 * Diferencias a propósito (guia/INICIO.md): el logo también en la app, los
 * enlaces sin el color ni la letra que les ponía el admin, la sesión anónima
 * como sin sesión, y en la tablet dos filas (antes los íconos se salían).
 * Interruptor cabeceraVieja: vuelve Header.
 */
export default function CabeceraDeTienda() {
  const cabeceraVieja = useLoViejo('cabecera');
  const { isHeaderVisible } = useLayoutContext();
  if (cabeceraVieja) return <Suspense fallback={null}><Header /></Suspense>;
  if (!isHeaderVisible) return <SinCabecera />;
  return <CabeceraConDatos />;
}

/** Sin cabecera, su alto no cuenta (las páginas lo usan para su espacio de arriba). */
function SinCabecera() {
  useLayoutEffect(() => { document.documentElement.style.removeProperty('--header-height'); }, []);
  return null;
}

function CabeceraConDatos() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname, search } = location;
  const { items: itemsCarrito } = useCart();
  const { user, userProfile, activeMainCoins, loading: authCargando } = useAuth();
  const { wishlistItems } = useWishlist();
  const { lang, setLang, available, t } = useLanguage();
  const { notifications, markAllAsRead, abrirNotificacion, requestPermission, puedeActivarAvisos } = useNotifications();
  const { theme, toggle } = useTheme();
  const { storeConfigDraft, isEditModeActive, isPreviewMobile } = useVisualEditor();
  const gruposTodos = useGruposDeCuenta();
  const conCuenta = tieneCuenta(user);

  // ── Su alto (--header-height, lo usan las páginas para lo que va pegado
  //    debajo) y la forma: el corte del celular es el de la barra inferior.
  //    Se publica en todos los anchos: en la tablet tiene dos filas. (La
  //    cabecera vieja no podía en escritorio: su caja usaba esa variable.)
  const marcoRef = useRef(null);
  const [celular, setCelular] = useState(esCelular);
  useLayoutEffect(() => {
    const el = marcoRef.current;
    const consulta = window.matchMedia(CELULAR);
    const publicar = () => {
      setCelular(consulta.matches);
      if (el) document.documentElement.style.setProperty('--header-height', `${el.offsetHeight}px`);
    };
    publicar();
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publicar) : null;
    if (el) observador?.observe(el);
    consulta.addEventListener('change', publicar);
    return () => {
      observador?.disconnect();
      consulta.removeEventListener('change', publicar);
      document.documentElement.style.removeProperty('--header-height');
    };
  }, []);

  // ── Monedas: la píldora vacía mientras llegan el perfil y la imagen de la
  //    moneda; a los 4 s se muestra igual ("–" si el saldo aún no llegó).
  const [monedaLista, setMonedaLista] = useState(() => !monedaPrecargada || monedaPrecargada.complete);
  useEffect(() => {
    if (monedaLista || !monedaPrecargada) return undefined;
    const lista = () => setMonedaLista(true);
    monedaPrecargada.addEventListener('load', lista);
    monedaPrecargada.addEventListener('error', lista);
    if (monedaPrecargada.complete) lista();
    return () => {
      monedaPrecargada.removeEventListener('load', lista);
      monedaPrecargada.removeEventListener('error', lista);
    };
  }, [monedaLista]);
  const saldoCargando = authCargando || !userProfile || Boolean(userProfile._perfilNoCargado);
  const [esperaAgotada, setEsperaAgotada] = useState(false);
  const uid = user?.uid || null;
  useEffect(() => {
    setEsperaAgotada(false);
    if (!uid) return undefined;
    const espera = setTimeout(() => setEsperaAgotada(true), 4000);
    return () => clearTimeout(espera);
  }, [uid]);
  const monedasCargando = !esperaAgotada && (saldoCargando || !monedaLista);

  // ── Datos de la tienda (mismas claves de caché que el resto).
  const { data: categorias } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await getCategories()).data || [],
    staleTime: 15 * 60 * 1000,
  });
  const { data: marcas } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await getBrands()).data || [],
    staleTime: 15 * 60 * 1000,
  });
  const { data: configGuardada, isFetching: configLlegando } = useQuery({
    queryKey: ['store-config-custom'],
    queryFn: async () => {
      const { data, error } = await getDocument('storeConfig', 'homePage');
      if (error) return null;
      try { if (data) localStorage.setItem('wala_store_config', JSON.stringify(data)); } catch { /* sin almacenamiento */ }
      return data ?? null;
    },
    // La copia del navegador: el menú real aparece enseguida (sin el de por defecto un instante).
    placeholderData: () => {
      try {
        const copia = localStorage.getItem('wala_store_config');
        return copia ? JSON.parse(copia) : undefined;
      } catch {
        return undefined;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
  const config = storeConfigDraft || configGuardada || {};

  // Los nombres de marca no se traducen en ningún sitio.
  useEffect(() => { registrarTextosSinTraducir((marcas || []).map((b) => b?.name)); }, [marcas]);

  // ── La marca de la página (/<slug>): Con Amor cuenta como global.
  const primerTramo = (pathname.split('/')[1] || '').trim().toLowerCase();
  const marcaActual = useMemo(() => {
    if (!primerTramo || !marcas?.length) return null;
    const m = marcas.find((b) => primerTramo === String(b?.slug || '').trim().toLowerCase() || primerTramo === rutaDeMarca({ name: b?.name }));
    if (!m) return null;
    if (String(m.slug || '').trim().toLowerCase() === 'conamor' || rutaDeMarca({ name: m.name }) === 'conamor') return null;
    return m;
  }, [primerTramo, marcas]);
  const slugMarca = marcaActual ? String(marcaActual.slug || '').trim() : '';
  const categoriaActual = new URLSearchParams(search).get('categoria') || '';

  // ── El menú.
  let navLinks = config?.header?.navLinks;
  if (!navLinks?.length) navLinks = configGuardada === undefined && configLlegando ? [] : ENLACES_POR_DEFECTO;
  const hayMenuDeCategorias = navLinks.some((l) => l?.isCategoryAuto);
  const [pedirCategorias, setPedirCategorias] = useState(false);
  const { data: productosDelMenu, error: errorMenu, refetch: reintentarMenu } = useQuery({
    queryKey: ['storefront-category-grid-products', marcaActual?.id || 'global'],
    queryFn: async () => {
      const r = marcaActual?.id ? await getProductsByBrand(marcaActual.id) : await getProducts([], null, null);
      if (r.error) throw new Error(r.error);
      return r.data || [];
    },
    enabled: hayMenuDeCategorias && pedirCategorias,
    meta: { segundoPlano: true },
    staleTime: 15 * 60 * 1000,
  });
  const idsConProductos = useMemo(
    () => (productosDelMenu ? categoriasConProductos(productosDelMenu, marcaActual?.id || null) : undefined),
    [productosDelMenu, marcaActual],
  );
  const categoriasDelMenu = useMemo(() => {
    const conProducto = (id) => idsConProductos?.has(id);
    if (marcaActual) {
      return (Array.isArray(marcaActual.categoryNav) ? marcaActual.categoryNav : [])
        .filter((it) => it?.categoryId && conProducto(it.categoryId))
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .slice(0, 10)
        .map((it) => ({
          id: it.categoryId,
          nombre: it.name || categorias?.find((c) => c.id === it.categoryId)?.name || 'Categoría',
          url: `/${slugMarca}?categoria=${it.categoryId}`,
        }));
    }
    return (categorias || []).filter((c) => conProducto(c.id)).slice(0, 10)
      .map((c) => ({ id: c.id, nombre: c.name, url: `/tienda?categoria=${c.id}` }));
  }, [marcaActual, slugMarca, categorias, idsConProductos]);

  const marcasDelMenu = useMemo(() => (marcas || [])
    .filter((b) => b?.name && b.active !== false && b.visible !== false)
    .map((b) => ({ id: b.id, nombre: b.name, url: `/${rutaDeMarca(b)}`, logo: b.logoUrl || '' }))
    .filter((b) => b.url !== '/'), [marcas]);

  const traducirEnlace = (texto) => {
    const clave = CLAVES_ENLACE[String(texto || '').trim().toLowerCase()];
    return clave ? { texto: t(clave, texto), traducir: false } : { texto };
  };

  const enlaces = [
    ...navLinks.map((l) => {
      const base = { id: String(l.id), url: l.url || '/', ...traducirEnlace(l.text) };
      if (l.type !== 'dropdown') return l.type === 'link' ? base : null;
      if (l.isCategoryAuto) {
        return {
          ...base,
          menu: 'tienda',
          categoria: true,
          props: {
            categorias: categoriasDelMenu,
            activa: categoriaActual,
            cargando: !productosDelMenu && !errorMenu,
            error: Boolean(errorMenu) && !productosDelMenu,
            onReintentar: () => reintentarMenu(),
            verTodo: { texto: 'Ver todo el catálogo', url: marcaActual ? `/${slugMarca}` : '/tienda' },
          },
        };
      }
      if (l.isBrandAuto) return { ...base, menu: 'marcas', props: { marcas: marcasDelMenu, limite: 6, activa: marcaActual?.id } };
      const lista = l.autoCollectionId
        ? (categorias || []).slice(0, 10).map((c) => ({ id: c.id, nombre: c.name, url: `/tienda?coleccion=${l.autoCollectionId}&categoria=${c.id}` }))
        : (l.dropdownLinks || []).map((d) => ({ id: String(d.id), nombre: d.text, url: d.url || '/' }));
      return { ...base, menu: 'lista', props: { titulo: l.text, categorias: lista, verTodo: null } };
    }).filter(Boolean),
    { id: 'minijuegos', texto: t('nav.minijuegos', 'Minijuegos'), traducir: false, url: '/minijuegos' },
  ];
  const activo = enlaces.find((e) => !e.menu && rutaSinConsulta(e.url) === pathname)?.id || null;
  // Las categorías se piden al abrir su menú (no en cada página).
  const alAbrirMenu = (id) => {
    if (enlaces.find((e) => e.id === id)?.categoria) setPedirCategorias(true);
  };

  // ── Cuenta.
  const usuario = conCuenta ? {
    nombre: userProfile?.displayName || userProfile?.nombre || user?.displayName || user?.email?.split('@')[0] || '',
    email: user?.email || '',
    avatar: userProfile?.avatarConfig?.avatarUrl || user?.photoURL || null,
  } : null;
  const gruposCuenta = useMemo(() => gruposTodos
    .map((g) => ({ ...g, items: g.items.filter((it) => ACCESOS_RAPIDOS.has(it.to)) }))
    .filter((g) => g.items.length), [gruposTodos]);
  const sinEncuesta = conCuenta && userProfile && !userProfile._perfilNoCargado && !userProfile.hasCompletedSurvey;
  const popupCuenta = config?.accountPopup;
  const textosCuenta = popupCuenta ? {
    titulo: popupCuenta.title,
    descripcion: popupCuenta.description,
    login: popupCuenta.loginButtonText,
    registro: popupCuenta.registerButtonText,
    urlLogin: popupCuenta.loginButtonUrl,
    urlRegistro: popupCuenta.registerButtonUrl,
  } : undefined;
  const popupFavoritos = config?.favoritesPopup;
  const textosFavoritos = popupFavoritos ? {
    tituloInvitado: popupFavoritos.loggedOutTitle,
    textoInvitado: popupFavoritos.loggedOutText,
    tituloVacio: popupFavoritos.loggedInTitle,
    textoVacio: popupFavoritos.loggedInText,
    boton: popupFavoritos.buttonText,
    urlBoton: popupFavoritos.buttonLink,
  } : undefined;

  // ── Notificaciones.
  const notificaciones = useMemo(() => (notifications || []).slice(0, 10).map((n) => ({
    id: n.id,
    titulo: n.title,
    texto: n.body,
    imagen: n.image || undefined,
    fecha: fechaDe(n.createdAt),
    leida: Boolean(n.read),
    url: n.link || undefined,
    original: n,
  })), [notifications]);
  const [activando, setActivando] = useState(false);
  const activarAvisos = async () => {
    setActivando(true);
    try { await requestPermission(); } finally { setActivando(false); }
  };

  // ── Buscar (acotado a la marca de la página).
  const buscarSugerencias = useCallback(async (texto) => sugerenciasDesdeBusqueda(
    await getSearchSuggestions(texto),
    { marcas: marcas || [], categorias: categorias || [], termino: texto },
  ), [marcas, categorias]);
  const buscar = (termino) => {
    const params = new URLSearchParams();
    if (termino) {
      params.set('q', termino);
      try { trackSearchQuery(termino, user).catch(() => {}); } catch { /* sin analítica */ }
    }
    if (marcaActual?.id) params.set('brand', marcaActual.id);
    navigate(`/buscar${params.toString() ? `?${params}` : ''}`);
  };

  const cabecera = (
    <Cabecera
      // En la vista de celular del editor, con la forma del celular.
      celular={celular || (isEditModeActive && isPreviewMobile)}
      enlaces={enlaces}
      activo={activo}
      onAbrirMenu={alAbrirMenu}
      tema={theme}
      onTema={toggle}
      monedas={saldoCargando ? null : Math.floor(activeMainCoins || 0)}
      monedasCargando={monedasCargando}
      notificaciones={notificaciones}
      onLeer={(id, n) => {
        abrirNotificacion(n.original);
        if (n.url) irALink(navigate, n.url);
      }}
      onMarcarLeidas={markAllAsRead}
      limiteNotificaciones={10}
      vacioNotificaciones={{ titulo: 'Estás al día', texto: 'Cuando tengas ofertas, monedas o novedades de tus pedidos, aparecerán aquí.' }}
      avisoPush={puedeActivarAvisos ? { onActivar: activarAvisos, activando } : undefined}
      usuario={usuario}
      gruposCuenta={gruposCuenta}
      promoCuenta={sinEncuesta ? { titulo: 'Perfil de regalos', texto: 'Gana 15 monedas diciéndonos qué te gusta.', url: '/encuesta-suscripcion', monedas: 15, icono: 'regalo' } : undefined}
      onCerrarSesion={async () => { await logout(); navigate('/'); }}
      textosCuenta={textosCuenta}
      idiomas={usuario ? undefined : { opciones: available.map((c) => ({ codigo: c, nombre: NOMBRES_IDIOMA[c] || c.toUpperCase() })), actual: lang, onCambiar: setLang }}
      cuenta={!esAppNativa()}
      estadoLogin={{ from: pathname + search }}
      favoritos={usuario ? wishlistItems.map((w) => ({ id: w.productId, nombre: w.productName, imagen: w.productImage })) : []}
      urlFavoritos={usuario ? '/cuenta/wishlist' : '/login'}
      textosFavoritos={textosFavoritos}
      carrito={itemsCarrito.filter((i) => i.selected !== false).map((i) => ({
        id: i.id, nombre: i.productName || 'Producto', imagen: i.productImage, precio: Number(i.price) || 0, cantidad: Number(i.quantity) || 1,
      }))}
      urlPagar={null}
      metaEnvio={ENVIO_GRATIS_DESDE}
      onBuscar={buscar}
      buscarSugerencias={buscarSugerencias}
      ideasBusqueda={(categorias || []).slice(0, 5).map((c) => c.name).filter(Boolean)}
      placeholder="Buscar productos, marcas y categorías"
    />
  );

  return (
    <div ref={marcoRef} className={s.fija} data-componente="Cabecera">
      <CustomFontsInjector config={config} />
      {isEditModeActive ? (
        <EditableSection sectionId="header" currentConfig={config} label="Menú de Navegación">{cabecera}</EditableSection>
      ) : cabecera}
    </div>
  );
}
