import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
// Los enlaces del kit (Boton con `to`, secciones…) navegan con el router.
import { ProveedorEnlaces } from './componentes/kit/Enlace';
// Y traducen sus textos con el mismo motor que <T> (en español no hace nada).
import { ProveedorTraduccion } from './componentes/kit/Traduccion';
// Una sola ventana de Confirmar para toda la tienda (useConfirmar en vez de confirm()).
import { ProveedorConfirmar } from './componentes/kit/Feedback';
import { useTranslatedText, useTranslatedHtml } from './i18n/useTranslatedText';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { CartProvider } from './contexts/CartContext';
import { ToastProvider } from './contexts/ToastContext';
import { VisualEditorProvider, useVisualEditor } from './pages/Tienda/contexts/VisualEditorContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { WishlistProvider } from './contexts/WishlistContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';

import AdminRoute from './components/AdminRoute/AdminRoute';
// Páginas que piden cuenta: sin sesión, al login y de vuelta (utils/rutaPrivada.js).
// /cuenta lo decide CuentaLayout, /admin AdminRoute y /ruleta su página.
import RutaPrivada from './components/RutaPrivada/RutaPrivada';
import RouteTracker from './components/analytics/RouteTracker';
import ReferralTracker from './components/analytics/ReferralTracker';
import PushLinkHandler from './components/common/PushLinkHandler/PushLinkHandler';
import ErrorBoundary from './components/common/ErrorBoundary/ErrorBoundary';
import AppErrorBoundary from './components/system/AppErrorBoundary';
import { initObservability } from './services/observability';
// Mientras llega una página: su esqueleto (paso 7, CARGA.md); con cargaVieja, PageLoading.
import CargandoRuta from './components/carga/CargandoRuta';
import AppPrefetcher from './components/common/AppPrefetcher/AppPrefetcher';
import NavProgressBar from './components/common/NavProgressBar/NavProgressBar';
import CustomFontsInjector from './components/common/CustomFontsInjector/CustomFontsInjector';
import { withEditorFonts } from './services/shared/fontResources';
import ScrollTracker from './components/analytics/ScrollTracker';
import ScrollToTop from './components/common/ScrollToTop/ScrollToTop';

import './App.css';

// ── Páginas principales y Layout Crítico (Carga Inmediata para evitar efecto Waterfall de Suspense) ──
import TiendaPage from './pages/Tienda/TiendaPage';
import DeepLinkHandler from './components/common/DeepLinkHandler';
// Marco con el kit (paso 2 de la migración): cada uno reemplaza a un componente
// viejo, que sigue en su sitio hasta borrarlo todo junto (guia/ELIMINAR.md).
import AvisoDelSistema from './components/marco/AvisoDelSistema';
import BarraDeAdmin from './components/marco/BarraDeAdmin';
import AvisoDeIdioma from './components/marco/AvisoDeIdioma';
import FlotantesDeLaTienda from './components/marco/FlotantesDeLaTienda';
// Cabecera con el kit (paso 7); con cabeceraVieja, Header.
import CabeceraDeTienda from './components/marco/CabeceraDeTienda';
// Barra inferior con el kit (paso 7); con barraVieja, BottomNav.
import BarraInferiorDeTienda from './components/marco/BarraInferiorDeTienda';
import { EN_VISTA_PREVIA_CALOR } from './utils/vistaPreviaCalor';

// ── Lo que no hace falta para ver la página: su propio archivo ────────────
// Se montan en el mismo sitio de siempre, pero su código llega en paralelo
// justo después del arranque en vez de ir en el archivo principal.
const Footer = lazy(() => import('./components/common/Footer'));
// Anuncio de campaña con el kit (paso 2; CampaignPopup, en guia/ELIMINAR.md).
const AnuncioDeCampana = lazy(() => import('./components/marco/AnuncioDeCampana'));
// El aviso de una invitación (el del kit; con campanasViejo, el de antes).
const AvisoInvitacion = lazy(() => import('./components/marco/AvisoInvitacionDeTienda'));
const FirebaseWarning = lazy(() => import('./components/common/FirebaseWarning'));
const RastreoCalor = lazy(() => import('./components/analytics/RastreoCalor'));

// ── Auto-recuperación de bundle obsoleto tras un deploy ───
// Si una pestaña tenía cacheado un build viejo y al navegar a una página lazy
// el chunk ya no existe (cambió de hash), la importación dinámica falla
// ("Failed to fetch dynamically imported module"). Recargamos UNA vez para traer
// los assets nuevos; el flag evita bucles de recarga.
if (typeof window !== 'undefined') {
  const reloadOnceForStaleChunk = () => {
    try {
      const KEY = 'wala_chunk_reload_ts';
      const last = Number(sessionStorage.getItem(KEY) || 0);

      if (Date.now() - last > 15000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  // Vite emite este evento cuando falla el preload de un chunk.
  window.addEventListener('vite:preloadError', (e) => {
    e?.preventDefault?.();
    reloadOnceForStaleChunk();
  });

  window.addEventListener('unhandledrejection', (e) => {
    const msg = String(e?.reason?.message || e?.reason || '');

    if (
      /Failed to fetch dynamically imported module|Failed to load module script|Importing a module script failed|error loading dynamically imported module/i.test(
        msg
      )
    ) {
      reloadOnceForStaleChunk();
    }
  });

  // ── Observabilidad (Fase 4) ──────────────────────────────────────────────
  // Registra handlers globales de error (window.onerror / unhandledrejection)
  // y Web Vitals. Es idempotente, fire-and-forget y a prueba de fallos: si algo
  // sale mal, la app se comporta exactamente como hoy.
  try {
    initObservability();
  } catch {
    /* no-op */
  }
}

// ── Páginas secundarias — lazy para no bloquear ──────────
const ProductPage = lazy(() => import('./pages/ProductPage'));
const PersonalizarPage = lazy(() => import('./pages/PersonalizarPage'));
const CrearStudioPage = lazy(() => import('./pages/Crear/CrearStudioPage'));
const ComboCrearPage = lazy(() => import('./pages/Crear/ComboCrearPage'));
const VerDisenoPage = lazy(() => import('./pages/Crear/VerDisenoPage'));
const CreacionPage = lazy(() => import('./pages/Crear/CreacionPage'));
const ComunidadPage = lazy(() => import('./pages/Comunidad/ComunidadPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const InvitarPage = lazy(() => import('./pages/InvitarPage'));
const CompleteProfilePage = lazy(() => import('./pages/CompleteProfilePage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PoliticasPrivacidadPage = lazy(() => import('./pages/PoliticasPrivacidadPage'));
const TerminosCondicionesPage = lazy(() => import('./pages/TerminosCondicionesPage'));
const LibroReclamacionesPage = lazy(() => import('./pages/LibroReclamacionesPage'));
const DynamicLandingPage = lazy(() => import('./pages/Tienda/DynamicLandingPage'));
const SubscriptionSurveyPage = lazy(() => import('./pages/SubscriptionSurveyPage'));
// "¿Cómo te fue con tu pedido?": llega con el aviso de pedido entregado.
const EncuestaEntregaPage = lazy(() => import('./components/encuesta/EncuestaEntregaDeTienda'));
const SubscriptionLandingPage = lazy(() => import('./pages/SubscriptionLandingPage'));
const NuevosUsuariosPage = lazy(() => import('./pages/NuevosUsuariosPage'));
const MinijuegosPage = lazy(() => import('./pages/Minijuegos/MinijuegosPage'));
// Estaba en el bloque de "carga inmediata" junto al layout, pero es una ruta
// de juego: 32 KB de pagina mas 99 KB de diccionario que nadie necesita para
// ver la tienda.
const WordlePage = lazy(() => import('./pages/Tienda/WordlePage'));
const RuletaPage = lazy(() => import('./pages/Minijuegos/RuletaPage'));
const BallSortPage = lazy(() => import('./pages/Minijuegos/BallSortPage'));
const GiftExperiencePage = lazy(() => import('./pages/GiftExperiencePage'));

// MussaPage retirado: /MUSSA ahora es la página de la marca vía DynamicLandingPage (/:slug).
const SearchPage = lazy(() => import('./pages/SearchPage'));
const SorteosPage = lazy(() => import('./pages/SorteosPage'));

// Página pública "Sorteo por suscripción" (auto-débito Culqi/PayPal). Rutas
// /suscrito-sorteo y /suscrito-sorteo/:slug. Debe ir ANTES del catch-all /:slug.
const SuscripcionSorteoPage = lazy(() => import('./pages/SuscripcionSorteoPage'));

// Página pública LINK-IN-BIO (constructor tipo Linktree). Ruta /l/:slug.
const LinkInBioPage = lazy(() => import('./pages/LinkInBioPage'));

// ── Admin Layout ─────────────────────────────────────────────────────────────
const AdminLayout = lazy(() => import('./components/AdminLayout/AdminLayout'));

// ── Secciones pesadas — lazy ─────────────────────────────────────────────────
const EditorPage = lazy(() => withEditorFonts(import('./pages/EditorPage')));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ResultadosLayout = lazy(() => import('./pages/admin/resultados/ResultadosLayout'));
const ResultadosResumen = lazy(() => import('./pages/admin/resultados/Resumen'));
const ResultadosProductos = lazy(() => import('./pages/admin/resultados/Productos'));
const ResultadosVisitantes = lazy(() => import('./pages/admin/resultados/Visitantes'));
const ResultadosClientes = lazy(() => import('./pages/admin/resultados/Clientes'));
const ResultadosOpiniones = lazy(() => import('./pages/admin/resultados/Opiniones'));
const ResultadosTecnico = lazy(() => import('./pages/admin/resultados/DetalleTecnico'));
const DashHeatmap = lazy(() => import('./pages/admin/dashboard/DashHeatmap'));
const DashOrigen = lazy(() => import('./pages/admin/dashboard/DashOrigen'));
const DashPaginas = lazy(() => import('./pages/admin/dashboard/DashPaginas'));
const DashUso = lazy(() => import('./pages/admin/dashboard/DashUso'));
const DashRecepcion = lazy(() => import('./pages/admin/dashboard/DashRecepcion'));

// ── Admin pages ───────────────────────────────────────────────────────────────
const AdminProductos = lazy(() => import('./pages/Tienda/admin/AdminProductos'));
const AdminInventario = lazy(() => import('./pages/Tienda/admin/AdminInventario'));
const RutasPrendasCrear = lazy(() => import('./pages/admin/RutasPrendasCrear'));
const AdminMockups = lazy(() => import('./pages/Tienda/admin/AdminMockups'));
const ImportarPlantillasYoryo = lazy(() => import('./pages/admin/plantillasYoryo/ImportarPlantillasYoryo'));
const AdminReferidos = lazy(() => import('./pages/admin/AdminReferidos'));
const AdminProductoFormV2 = lazy(() => import('./pages/Tienda/admin/AdminProductoFormV2'));
const AdminCategorias = lazy(() => import('./pages/admin/AdminCategorias'));
const AdminColecciones = lazy(() => import('./pages/admin/AdminColecciones'));
const AdminCatalogAttributes = lazy(() => import('./pages/admin/AdminCatalogAttributes'));
const AdminRecompensas = lazy(() => import('./pages/admin/AdminRecompensas'));
const AdminEnviosZonas = lazy(() => import('./pages/admin/AdminEnviosZonas'));
const AdminBlueprints = lazy(() => import('./pages/admin/AdminBlueprints'));
const AdminSorteos = lazy(() => import('./pages/admin/AdminSorteos'));
const AdminSorteoDetalle = lazy(() => import('./pages/admin/AdminSorteoDetalle'));

// Sorteo por suscripción (auto-débito): lista/editor de campañas + detalle.
const AdminSuscripcionSorteos = lazy(() => import('./pages/admin/AdminSuscripcionSorteos'));
const AdminSuscripcionDetalle = lazy(() => import('./pages/admin/AdminSuscripcionDetalle'));

const AdminWhatsApp = lazy(() => import('./pages/admin/AdminWhatsApp'));
const AdminDestacados = lazy(() => import('./pages/admin/AdminDestacados'));
const AdminCliparts = lazy(() => import('./pages/admin/AdminCliparts'));
const AdminMascota = lazy(() => import('./pages/admin/AdminMascota'));
const AdminBackups = lazy(() => import('./pages/admin/AdminBackups'));
const AdminConfiguracion = lazy(() => import('./pages/admin/AdminConfiguracion'));
const AdminCrearCuentasPedidos = lazy(() => import('./pages/admin/AdminCrearCuentasPedidos'));
const AdminRetos = lazy(() => import('./pages/admin/AdminRetos'));
const AdminMisiones = lazy(() => import('./pages/admin/AdminMisiones'));
const AdminPublicoProductos = lazy(() => import('./pages/admin/AdminPublicoProductos'));
const AdminWordlePage = lazy(() => import('./pages/admin/AdminWordlePage'));

// El panel del editor visual son 230 KB de codigo (mas react-easy-crop y el
// editor de navegacion) y arranca con `if (!isEditModeActive) return null`.
// Estaba montado de forma estatica en GlobalLayout: TODOS los visitantes se lo
// descargaban para no pintar nada. Ahora ni se pide hasta que un admin abre el
// editor. Con el kit (paso 8): EditorVisual elige el del kit o, con
// editorViejo, VisualEditorPanel; los dos llegan en su propio archivo.
const EditorVisual = lazy(() => import('./components/constructor/EditorVisual'));
// AdminNotifications importa recharts. Cargado de forma estatica arrastraba el
// chunk de graficas (413 KB) al arranque de TODOS los visitantes, aunque solo
// se usa en /admin/notificaciones. lazy() lo devuelve a su propio chunk.
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications/AdminNotifications'));
const AdminMarcas = lazy(() => import('./pages/admin/AdminMarcas'));

// Enlaces útiles (constructor tipo Linktree / link-in-bio).
const AdminEnlaces = lazy(() => import('./pages/admin/AdminEnlaces'));
const AdminEnlaceEditor = lazy(() => import('./pages/admin/AdminEnlaceEditor'));
const AdminLandingPages = lazy(() => import('./pages/Tienda/admin/AdminLandingPages'));
const AdminThemes = lazy(() => import('./pages/Tienda/admin/AdminThemes'));
const AdminRuletaPage = lazy(() => import('./pages/admin/AdminRuletaPage'));
const AdminBolitasPage = lazy(() => import('./pages/admin/AdminBolitasPage'));
const AdminEncuestas = lazy(() => import('./pages/admin/AdminEncuestas'));
const AdminPopups = lazy(() => import('./pages/admin/AdminPopups'));
const AdminFechasImportantesPage = lazy(() => import('./pages/admin/AdminFechasImportantesPage'));
const AdminLibroReclamaciones = lazy(() => import('./pages/admin/AdminLibroReclamaciones'));

// Gestión de Pagos (unifica Métodos de Pago + Generador de Enlaces + historial/analíticas).
const AdminGestionPagos = lazy(() => import('./pages/admin/AdminGestionPagos'));


const AppRedirect = lazy(() => import('./pages/AppRedirect'));
// Una dirección que no existe (GENERALES.md P22).
const NoEncontradaPage = lazy(() => import('./pages/NoEncontradaPage'));
const PagoRapidoPage = lazy(() => import('./pages/PagoRapidoPage'));

// ── Cuenta ────────────────────────────────────────────────────────────────────
const CuentaLayout = lazy(() => import('./pages/CuentaLayout'));
const CuentaResumenPage = lazy(() => import('./pages/cuenta/CuentaResumenPage'));
const CuentaAjustesPage = lazy(() => import('./pages/cuenta/CuentaAjustesPage'));
const PerfilPage = lazy(() => import('./pages/cuenta/PerfilPage'));
const CuentaCompraDetallePage = lazy(() => import('./pages/cuenta/CuentaCompraDetallePage'));

// "Mis Pedidos" y "Rastreo del Pedido" mostraban la MISMA lista (mismo hook
// usePedidos) en dos diseños distintos y sin enlace entre sí -confuso a
// propósito de una captura del usuario ("se repite 2 veces lo mismo")-.
// Se unificaron: CuentaRastreoPage (el diseño liviano tipo tarjeta+barra de
// progreso, ya enlazaba a CuentaCompraDetallePage) es ahora TAMBIÉN el
// contenido de /cuenta/pedidos; /cuenta/rastreo redirige ahí. La tarjeta
// densa vieja (CuentaPedidosPage/Results/PedidoCard) queda sin usar; sus
// acciones reales (pagar deuda, reclamar monedas, ver boleta) se movieron a
// CuentaCompraDetallePage vía <PedidoAcciones>.
const CuentaRastreoPage = lazy(() => import('./pages/cuenta/CuentaRastreoPage'));
const MisCreacionesPage = lazy(() => import('./pages/cuenta/MisCreacionesPage'));
const CuentaReferidosPage = lazy(() => import('./pages/cuenta/CuentaReferidosPage'));
const CuentaFechasImportantesPage = lazy(() => import('./pages/cuenta/CuentaFechasImportantesPage'));
const CatalogReward = lazy(() => import('./pages/cuenta/CatalogReward'));
const MisCuponesPage = lazy(() => import('./pages/cuenta/MisCuponesPage'));
const MisionesPage = lazy(() => import('./pages/cuenta/MisionesPage'));
const WishlistPrivatePage = lazy(() => import('./pages/cuenta/WishlistPage'));
const MisDireccionesPage = lazy(() => import('./pages/cuenta/MisDireccionesPage'));
const WishlistPublicPage = lazy(() => import('./pages/WishlistPublic/WishlistPublic'));
const GiftRegistryPage = lazy(() => import('./pages/GiftRegistry/GiftRegistryPage'));

// ── QueryClient optimizado ────────────────────────────────────────────────────
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 2,
      staleTime: 60 * 60 * 1000,   // 1 hour in memory
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      networkMode: 'offlineFirst', // Return cached data even offline
    },
  },
});

const GlobalLayout = ({ children }) => {
  const location = useLocation();
  const { isEditModeActive } = useVisualEditor();
  // Páginas que van solas, sin la cabecera, el pie ni los flotantes: la landing
  // de Regalos con amor y el Link en bio (/l/:slug, la página de la bio de las
  // redes: CAMPANAS.md).
  const esLinkEnBio = location.pathname.startsWith('/l/');
  const isIndependentRoute = location.pathname.startsWith('/regalos-con-amor') || esLinkEnBio;

  // Activar Heatmap Tracker globalmente (menos para admins: no son clientes y
  // su barra cambia la estructura de la página respecto a la del visitante).
  const { isAdmin } = useAuth();
  const rastreoCalor = (
    <Suspense fallback={null}>
      <RastreoCalor enabled={!isAdmin} batchSize={10} />
    </Suspense>
  );

  if (isIndependentRoute) {
    return (
      <div className="App independent-app">
        {rastreoCalor}
        {/* El Link en bio sigue contando la página vista, como con el marco. */}
        {esLinkEnBio && <RouteTracker />}
        <main style={{ width: '100%', minHeight: '100vh', padding: 0, margin: 0 }}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="App">
      {rastreoCalor}
      <AvisoDelSistema />
      <NavProgressBar />
      <RouteTracker />
      <PushLinkHandler />
      <ReferralTracker />
      {/* En la vista previa del mapa de calor no van avisos ni popups: la
          página tiene que verse como la vio el visitante, sin nada encima. */}
      {!EN_VISTA_PREVIA_CALOR && <Suspense fallback={null}><AvisoInvitacion /></Suspense>}
      <ScrollTracker />
      <BarraDeAdmin />
      {isEditModeActive && (
        <Suspense fallback={null}>
          <EditorVisual />
        </Suspense>
      )}

      {/* Punto de anclaje para BannerDeLaApp (portal): vive fuera de
          #main-content-area a propósito, para que el aviso de "Wala App"
          quede ANTES del Header en el DOM (en vez de ser lo primero dentro
          del contenido, después del Header). BannerDeLaApp sigue
          montado donde siempre — dentro de TiendaPage, con su misma lógica
          de visibilidad — solo que ahora hace portal hacia acá. */}
      <div id="app-top-banner-slot" />

      <CabeceraDeTienda />

      <main id="main-content-area">
        {children}
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
      <BarraInferiorDeTienda />

      <FlotantesDeLaTienda />

      <Suspense fallback={null}><FirebaseWarning /></Suspense>

      {/* Popup discreto de sugerencia de idioma (se muestra una sola vez). */}
      {!EN_VISTA_PREVIA_CALOR && <AvisoDeIdioma />}

      {/* Popups de campaña (encuesta, promos…) configurados en /admin/popups. */}
      {!EN_VISTA_PREVIA_CALOR && <Suspense fallback={null}><AnuncioDeCampana /></Suspense>}
    </div>
  );
};

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>


        {/* El idioma va por fuera de los avisos: así los toasts (que se dibujan
            en ToastProvider, por encima del resto) también se traducen. */}
        <LanguageProvider>
        <ToastProvider>
          <ThemeProvider>
              <AuthProvider>
                <NotificationsProvider>
                <WishlistProvider>
                  <VisualEditorProvider>
                    <CartProvider>
                      <LayoutProvider>
                        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                         <ProveedorEnlaces componente={Link}>
                         <ProveedorTraduccion texto={useTranslatedText} html={useTranslatedHtml}>
                         <ProveedorConfirmar>
                          <CustomFontsInjector routeFonts />
                          <DeepLinkHandler />
                          <ScrollToTop />

                          {/* Precarga solo cuando hay intención de navegar. */}
                          <AppPrefetcher />

                          <GlobalLayout>
                            <ErrorBoundary>
                              <Suspense fallback={<CargandoRuta />}>
                                <Routes>
                                  {/* Tienda abierta para todos */}
                                  <Route path="/" element={<TiendaPage />} />

                                  {/* /tienda usa el MISMO catálogo escalable que la home (TiendaPage deriva pageId='tienda'
                                      de la URL y monta el módulo sidebar_catalog con todos los filtros). Antes usaba la
                                      LegacyTiendaPage (solo categoría); unificado el 2026-06-25. */}
                                  <Route path="/tienda" element={<TiendaPage />} />

                                  <Route
                                    path="/encuesta-suscripcion"
                                    element={
                                      <Suspense fallback={<CargandoRuta />}>
                                        <RutaPrivada><SubscriptionSurveyPage /></RutaPrivada>
                                      </Suspense>
                                    }
                                  />

                                  <Route
                                    path="/opinar/:codigo"
                                    element={
                                      <Suspense fallback={<CargandoRuta />}>
                                        <EncuestaEntregaPage />
                                      </Suspense>
                                    }
                                  />

                                  <Route
                                    path="/suscripciones"
                                    element={
                                      <Suspense fallback={<CargandoRuta />}>
                                        <SubscriptionLandingPage />
                                      </Suspense>
                                    }
                                  />

                                  <Route path="/producto/:id" element={<ProductPage />} />
                                  <Route path="/personalizar" element={<PersonalizarPage />} />
                                  <Route path="/crear/:id" element={<CrearStudioPage />} />
                                  <Route path="/combo/:id" element={<ComboCrearPage />} />
                                  <Route path="/ver/:id" element={<VerDisenoPage />} />
                                  <Route path="/creacion/:id" element={<RutaPrivada><CreacionPage /></RutaPrivada>} />
                                  <Route path="/comunidad" element={<ComunidadPage />} />
                                  <Route path="/editor/:id" element={<EditorPage />} />
                                  <Route path="/carrito" element={<CartPage />} />
                                  <Route path="/checkout" element={<CheckoutPage />} />
                                  <Route path="/wishlist/:userCode" element={<WishlistPublicPage />} />
                                  <Route path="/regalar/:referralCode" element={<GiftRegistryPage />} />
                                  <Route path="/app" element={<AppRedirect />} />
                                  <Route path="/descargar" element={<AppRedirect />} />
                                  <Route path="/pago-rapido/:id" element={<PagoRapidoPage />} />

                                  <Route path="/pedidos" element={<Navigate to="/cuenta/pedidos" replace />} />

                                  <Route path="/cuenta" element={<CuentaLayout />}>
                                    {/* Antes redirigía directo a /cuenta/pedidos, saltándose cualquier
                                        vistazo general. Ahora es una grilla de accesos directos a TODAS
                                        las secciones (perfil, pedidos, recompensas, etc.) — mismo patrón
                                        que el "Cuenta" de AliExpress: al entrar ves todas las opciones,
                                        y cada una te lleva de un toque a su página exacta. */}
                                    <Route index element={<CuentaResumenPage />} />
                                    <Route path="ajustes" element={<CuentaAjustesPage />} />
                                    <Route path="perfil" element={<PerfilPage />} />
                                    <Route path="pedidos" element={<CuentaRastreoPage />} />
                                    <Route path="pedidos/:id" element={<CuentaCompraDetallePage />} />
                                    <Route path="direcciones" element={<MisDireccionesPage />} />
                                    {/* /cuenta/rastreo se unificó con "Mis Pedidos" (ver comentario junto al
                                        lazy import de CuentaRastreoPage); se conserva como redirect por si
                                        queda algún enlace/bookmark viejo apuntando ahí. */}
                                    <Route path="rastreo" element={<Navigate to="/cuenta/pedidos" replace />} />
                                    <Route path="creaciones" element={<MisCreacionesPage />} />
                                    <Route path="referidos" element={<CuentaReferidosPage />} />
                                    <Route path="fechas-importantes" element={<CuentaFechasImportantesPage />} />
                                    <Route path="misiones" element={<MisionesPage />} />
                                    <Route path="catalogo" element={<CatalogReward />} />
                                    <Route path="cupones" element={<MisCuponesPage />} />
                                    <Route path="wishlist" element={<WishlistPrivatePage />} />
                                  </Route>

                                  <Route path="/admin" element={<AdminRoute />}>
                                    <Route element={<AdminLayout />}>
                                      <Route index element={<AdminDashboard />} />

                                      <Route path="resultados" element={<ResultadosLayout />}>
                                        <Route index element={<ResultadosResumen />} />
                                        <Route path="productos" element={<ResultadosProductos />} />
                                        <Route path="visitantes" element={<ResultadosVisitantes />} />
                                        <Route path="clientes" element={<ResultadosClientes />} />
                                        <Route path="opiniones" element={<ResultadosOpiniones />} />
                                        <Route path="tecnico" element={<ResultadosTecnico />} />
                                      </Route>
                                      {/* Pantallas técnicas de Resultados (con su propia cabecera). */}
                                      <Route path="resultados/tecnico/mapa-de-calor" element={<DashHeatmap />} />
                                      <Route path="resultados/tecnico/paginas" element={<DashPaginas />} />
                                      <Route path="resultados/tecnico/uso" element={<DashUso />} />
                                      <Route path="resultados/tecnico/navegador" element={<DashOrigen />} />
                                      <Route path="recepcion-pedidos" element={<DashRecepcion />} />
                                      {/* Direcciones de antes de Resultados (2026-10-24): llevan a su lugar nuevo. */}
                                      <Route path="dashboard" element={<Navigate to="/admin/resultados" replace />} />
                                      <Route path="dashboard/heatmap" element={<Navigate to="/admin/resultados/tecnico/mapa-de-calor" replace />} />
                                      <Route path="dashboard/productos" element={<Navigate to="/admin/resultados/productos" replace />} />
                                      <Route path="dashboard/origen" element={<Navigate to="/admin/resultados/visitantes" replace />} />
                                      <Route path="dashboard/paginas" element={<Navigate to="/admin/resultados/tecnico/paginas" replace />} />
                                      <Route path="dashboard/categorias" element={<Navigate to="/admin/resultados/productos" replace />} />
                                      <Route path="dashboard/uso" element={<Navigate to="/admin/resultados/tecnico/uso" replace />} />
                                      <Route path="dashboard/recepcion" element={<Navigate to="/admin/recepcion-pedidos" replace />} />
                                      <Route path="usuarios-app" element={<Navigate to="/admin/resultados/clientes" replace />} />
                                      <Route path="usuarios-analytics" element={<Navigate to="/admin/resultados/clientes" replace />} />
                                      <Route path="usuarios-comportamiento" element={<Navigate to="/admin/resultados/clientes" replace />} />
                                      <Route path="interes-productos" element={<Navigate to="/admin/resultados/productos" replace />} />
                                      <Route path="respuestas-encuesta" element={<Navigate to="/admin/resultados/opiniones" replace />} />
                                      <Route path="encuesta-entregas" element={<Navigate to="/admin/resultados/opiniones" replace />} />

                                      <Route path="productos" element={<AdminProductos />} />
                                      {/* Los packs de Crear viven ahora en Productos (chip "Packs de Crear"). */}
                                      <Route path="combos-crear" element={<Navigate to="/admin/productos?ver=packs" replace />} />
                                      <Route path="prendas-crear/*" element={<RutasPrendasCrear />} />
                                      <Route path="inventario" element={<AdminInventario />} />
                                      <Route path="mockups" element={<AdminMockups />} />
                                      <Route path="plantillas-yoryo" element={<ImportarPlantillasYoryo />} />
                                      <Route path="productos/nuevo" element={<AdminProductoFormV2 />} />
                                      <Route path="productos/:id" element={<AdminProductoFormV2 />} />
                                      <Route path="categorias" element={<AdminCategorias />} />
                                      <Route path="colecciones" element={<AdminColecciones />} />
                                      <Route path="atributos-catalogo" element={<AdminCatalogAttributes />} />
                                      <Route path="recompensas" element={<AdminRecompensas />} />
                                      <Route path="envios" element={<AdminEnviosZonas />} />
                                      <Route path="blueprints" element={<AdminBlueprints />} />

                                      <Route path="whatsapp" element={<AdminWhatsApp />} />
                                      <Route path="referidos" element={<AdminReferidos />} />

                                      {/* Gestión de Pagos: módulo unificado (config + generar + historial). */}
                                      <Route path="gestion-pagos" element={<AdminGestionPagos />} />


                                      <Route path="libro-reclamaciones" element={<AdminLibroReclamaciones />} />
                                      <Route path="retos" element={<AdminRetos />} />
                                      <Route path="misiones" element={<AdminMisiones />} />
                                      <Route path="sorteos" element={<AdminSorteos />} />
                                      <Route path="sorteos/:id" element={<AdminSorteoDetalle />} />

                                      {/* Sorteo por suscripción (auto-débito): campañas + detalle. */}
                                      <Route path="sorteos-suscripcion" element={<AdminSuscripcionSorteos />} />
                                      <Route path="sorteos-suscripcion/:id" element={<AdminSuscripcionDetalle />} />

                                      {/* Enlaces útiles (constructor tipo Linktree): lista + editor. */}
                                      <Route path="enlaces" element={<AdminEnlaces />} />
                                      <Route path="enlaces/:id" element={<AdminEnlaceEditor />} />

                                      <Route path="destacados" element={<AdminDestacados />} />
                                      <Route path="zonas" element={<Navigate to="/admin" replace />} />
                                      <Route path="cliparts" element={<AdminCliparts />} />
                                      <Route path="mascota" element={<AdminMascota />} />
                                      <Route path="crear-cuentas-pedidos" element={<AdminCrearCuentasPedidos />} />
                                      <Route path="publico-productos" element={<AdminPublicoProductos />} />
                                      <Route path="wordle" element={<AdminWordlePage />} />
                                      <Route path="notificaciones" element={<AdminNotifications />} />
                                      <Route path="marcas" element={<AdminMarcas />} />
                                      {/* "Elementos con diseño" solo editaba las burbujas de categorías: ahora van en el editor de cada página. */}
                                      <Route path="elementos-diseno/*" element={<Navigate to="/admin/landing-pages" replace />} />
                                      <Route path="landing-pages" element={<AdminLandingPages />} />
                                      <Route path="temas" element={<AdminThemes />} />
                                      <Route path="ruleta" element={<AdminRuletaPage />} />
              <Route path="bolitas" element={<AdminBolitasPage />} />
                                      <Route path="backups" element={<AdminBackups />} />
                                      <Route path="configuracion" element={<AdminConfiguracion />} />
                                      <Route path="encuestas" element={<AdminEncuestas />} />
                                      <Route path="popups" element={<AdminPopups />} />
                                      <Route path="fechas-importantes" element={<AdminFechasImportantesPage />} />
                                    </Route>
                                  </Route>

                                  <Route path="/login" element={<LoginPage />} />
                                  <Route path="/registro" element={<RegisterPage />} />
                                  <Route path="/invitar/:codigo" element={<InvitarPage />} />
                                  <Route path="/completar-perfil" element={<CompleteProfilePage />} />
                                  <Route path="/palabra-del-dia" element={<WordlePage />} />
                                  <Route path="/minijuegos" element={<MinijuegosPage />} />
                                  <Route path="/ruleta" element={<RuletaPage />} />
                                  <Route path="/ball-sort" element={<BallSortPage />} />
                                  <Route path="/recuperar-contrasena" element={<ResetPasswordPage />} />
                                  <Route path="/politicas-privacidad" element={<PoliticasPrivacidadPage />} />
                                  <Route path="/terminos-y-condiciones" element={<TerminosCondicionesPage />} />
                                  {/* El registro enlazaba aquí y daba página no encontrada. */}
                                  <Route path="/terminos-condiciones" element={<Navigate to="/terminos-y-condiciones" replace />} />
                                  <Route path="/libro-de-reclamaciones" element={<LibroReclamacionesPage />} />
                                  <Route path="/regalos-con-amor" element={<NuevosUsuariosPage />} />
                                  <Route path="/nuevos-usuarios" element={<Navigate to="/regalos-con-amor" replace />} />
                                  <Route path="/regalo/:orderId" element={<GiftExperiencePage />} />

                                  {/* Mussa: la ruta hardcodeada se eliminó. Ahora /MUSSA (y /mussa,
                                      slug case-insensitive) cae en el catch-all /:slug -> DynamicLandingPage
                                      y resuelve la landingPage 'MUSSA' como página de marca editable. */}

                                  <Route path="/buscar" element={<SearchPage />} />
                                  {/* Nichos, vendedores y su panel: retirados el 2026-10-16 (nadie los usaba).
                                      Un enlace viejo va a la tienda. */}
                                  <Route path="/nicho/:slug" element={<Navigate to="/tienda" replace />} />
                                  <Route path="/nichos" element={<Navigate to="/tienda" replace />} />
                                  <Route path="/vendedor" element={<Navigate to="/tienda" replace />} />
                                  <Route path="/tienda-vendedor/:slug" element={<Navigate to="/tienda" replace />} />
                                  {/* Ofertas flash y el cofre diario: retirados el 2026-10-16. Un enlace viejo va a la tienda. */}
                                  <Route path="/ofertas" element={<Navigate to="/tienda" replace />} />
                                  <Route path="/sorteos" element={<SorteosPage />} />

                                  {/* Sorteo específico por slug (compartible desde lives). */}
                                  <Route path="/sorteos/:slug" element={<SorteosPage />} />

                                  {/* Sorteo por suscripción (auto-débito Culqi/PayPal). Página
                                      pública general + campaña por slug. DEBEN ir ANTES del
                                      catch-all /:slug para no ser interceptadas por landings. */}
                                  <Route path="/suscrito-sorteo" element={<SuscripcionSorteoPage />} />
                                  <Route path="/suscrito-sorteo/:slug" element={<SuscripcionSorteoPage />} />

                                  {/* Página pública LINK-IN-BIO (/l/:slug). DEBE ir ANTES
                                      del catch-all /:slug para no ser interceptada por las
                                      landing pages dinámicas. */}
                                  <Route path="/l/:slug" element={<LinkInBioPage />} />

                                  {/* Dynamic Landing Pages Interceptor */}
                                  <Route path="/:slug" element={<DynamicLandingPage />} />

                                  <Route path="*" element={<NoEncontradaPage antes="/cuenta" />} />
                                </Routes>
                              </Suspense>
                            </ErrorBoundary>
                          </GlobalLayout>
                         </ProveedorConfirmar>
                         </ProveedorTraduccion>
                         </ProveedorEnlaces>
                        </Router>
                      </LayoutProvider>
                    </CartProvider>
                  </VisualEditorProvider>
                </WishlistProvider>
                </NotificationsProvider>
              </AuthProvider>
          </ThemeProvider>
        </ToastProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;

// Force dev server update
