import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { EditorProvider } from './contexts/EditorContext';
import { ToastProvider } from './contexts/ToastContext';
import { VisualEditorProvider } from './pages/Tienda/contexts/VisualEditorContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { WishlistProvider } from './contexts/WishlistContext';
import AdminNotifications from './pages/admin/AdminNotifications/AdminNotifications';
import AdminRoute from './components/AdminRoute/AdminRoute';
import RouteTracker from './components/analytics/RouteTracker';
import ReferralTracker from './components/analytics/ReferralTracker';
import ErrorBoundary from './components/common/ErrorBoundary/ErrorBoundary';
import PageLoading from './components/common/PageLoading/PageLoading';
import AppPrefetcher from './components/common/AppPrefetcher/AppPrefetcher';
import NavProgressBar from './components/common/NavProgressBar/NavProgressBar';
import CustomFontsInjector from './components/common/CustomFontsInjector/CustomFontsInjector';
import { useHeatmapTracker } from './hooks/useHeatmapTracker';
import ScrollTracker from './components/analytics/ScrollTracker';
import './App.css';

// ── Páginas principales y Layout Crítico (Carga Inmediata para evitar efecto Waterfall de Suspense) ──
import TiendaPage from './pages/Tienda/TiendaPage';
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import WordlePage from './pages/Tienda/WordlePage';
import BottomNav from './components/common/BottomNav';
import WhatsAppButton from './components/common/WhatsAppButton';
import FirebaseWarning from './components/common/FirebaseWarning';
import KapiPet from './components/common/KapiPet/KapiPet';
import AdminBar from './components/common/AdminBar/AdminBar';
import PackageBubble from './components/common/PackageBubble/PackageBubble';
import VisualEditorPanel from './pages/Tienda/admin/VisualEditorPanel';
import DeepLinkHandler from './components/common/DeepLinkHandler';
import SystemAlert from './components/common/SystemAlert/SystemAlert';

// ── Páginas secundarias — lazy para no bloquear ──────────
const ProductPage = lazy(() => import('./pages/ProductPage'));
const PersonalizarPage = lazy(() => import('./pages/PersonalizarPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const CompleteProfilePage = lazy(() => import('./pages/CompleteProfilePage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PoliticasPrivacidadPage = lazy(() => import('./pages/PoliticasPrivacidadPage'));
const TerminosCondicionesPage = lazy(() => import('./pages/TerminosCondicionesPage'));
const LibroReclamacionesPage = lazy(() => import('./pages/LibroReclamacionesPage'));
const DynamicLandingPage = lazy(() => import('./pages/Tienda/DynamicLandingPage'));
const SubscriptionSurveyPage = lazy(() => import('./pages/SubscriptionSurveyPage'));
const SubscriptionLandingPage = lazy(() => import('./pages/SubscriptionLandingPage'));
const NuevosUsuariosPage = lazy(() => import('./pages/NuevosUsuariosPage'));
const MinijuegosPage = lazy(() => import('./pages/Minijuegos/MinijuegosPage'));
const RuletaPage = lazy(() => import('./pages/Minijuegos/RuletaPage'));
const BallSortPage = lazy(() => import('./pages/Minijuegos/BallSortPage'));
const GiftExperiencePage = lazy(() => import('./pages/GiftExperiencePage'));
const MussaPage = lazy(() => import('./pages/MussaPage'));
const RegalosCatasPage = lazy(() => import('./pages/RegalosCatasPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const NichePage = lazy(() => import('./pages/NichePage'));
const VendorPanel = lazy(() => import('./pages/VendorPanel'));
const NichesPage = lazy(() => import('./pages/NichesPage'));
const VendorStorefrontPage = lazy(() => import('./pages/VendorStorefrontPage'));
const CheckoutDemoPage = lazy(() => import('./pages/CheckoutDemoPage'));
const OfertasFlashPage = lazy(() => import('./pages/OfertasFlashPage'));

// ── Admin Layout ─────────────────────────────────────────────────────────────
const AdminLayout = lazy(() => import('./components/AdminLayout/AdminLayout'));

// ── Secciones pesadas — lazy ─────────────────────────────────────────────────
const EditorPage = lazy(() => import('./pages/EditorPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminDashboardAnalytics = lazy(() => import('./pages/admin/AdminDashboard'));

// ── Admin pages ───────────────────────────────────────────────────────────────
const AdminProductos = lazy(() => import('./pages/Tienda/admin/AdminProductos'));
const AdminInventario = lazy(() => import('./pages/Tienda/admin/AdminInventario'));
const AdminMockups = lazy(() => import('./pages/Tienda/admin/AdminMockups'));
const AdminReferidos = lazy(() => import('./pages/admin/AdminReferidos'));
const AdminProductoFormV2 = lazy(() => import('./pages/Tienda/admin/AdminProductoFormV2'));
const AdminCategorias = lazy(() => import('./pages/admin/AdminCategorias'));
const AdminColecciones = lazy(() => import('./pages/admin/AdminColecciones'));
const AdminNichos = lazy(() => import('./pages/admin/AdminNichos'));
const AdminVendors = lazy(() => import('./pages/admin/AdminVendors'));
const AdminRecompensas = lazy(() => import('./pages/admin/AdminRecompensas'));
const AdminEnviosZonas = lazy(() => import('./pages/admin/AdminEnviosZonas'));
const AdminPayouts = lazy(() => import('./pages/admin/AdminPayouts'));
const AdminBlueprints = lazy(() => import('./pages/admin/AdminBlueprints'));
const AdminFlashOffers = lazy(() => import('./pages/admin/AdminFlashOffers'));

const AdminWhatsApp = lazy(() => import('./pages/admin/AdminWhatsApp'));
const AdminPagos = lazy(() => import('./pages/admin/AdminPagos'));
const AdminDestacados = lazy(() => import('./pages/admin/AdminDestacados'));
const AdminCliparts = lazy(() => import('./pages/admin/AdminCliparts'));
const AdminMascota = lazy(() => import('./pages/admin/AdminMascota'));
const AdminBackups = lazy(() => import('./pages/admin/AdminBackups'));
const AdminConfiguracion = lazy(() => import('./pages/admin/AdminConfiguracion'));
const AdminCrearCuentasPedidos = lazy(() => import('./pages/admin/AdminCrearCuentasPedidos'));
const AdminRetos = lazy(() => import('./pages/admin/AdminRetos'));
const AdminUsuariosAnalyticsPage = lazy(() => import('./pages/admin/AdminUsuariosAnalyticsPage'));
const AdminWordlePage = lazy(() => import('./pages/admin/AdminWordlePage'));
const AdminMarcas = lazy(() => import('./pages/admin/AdminMarcas'));
const AdminLandingPages = lazy(() => import('./pages/Tienda/admin/AdminLandingPages'));
const AdminThemes = lazy(() => import('./pages/Tienda/admin/AdminThemes'));
const AdminStoreEditor = lazy(() => import('./pages/Tienda/admin/AdminStoreEditor'));
const AdminRuletaPage = lazy(() => import('./pages/admin/AdminRuletaPage'));
const AdminEncuestas = lazy(() => import('./pages/admin/AdminEncuestas'));
const AdminFechasImportantesPage = lazy(() => import('./pages/admin/AdminFechasImportantesPage'));
const AdminGeneradorPagos = lazy(() => import('./pages/admin/AdminGeneradorPagos'));
const AdminLibroReclamaciones = lazy(() => import('./pages/admin/AdminLibroReclamaciones'));

const AppRedirect = lazy(() => import('./pages/AppRedirect'));
const PagoRapidoPage = lazy(() => import('./pages/PagoRapidoPage'));

// ── Cuenta ────────────────────────────────────────────────────────────────────
const CuentaLayout = lazy(() => import('./pages/CuentaLayout'));
const PerfilPage = lazy(() => import('./pages/cuenta/PerfilPage'));
const CuentaPedidosPage = lazy(() => import('./pages/cuenta/CuentaPedidosPage'));
const MisCreacionesPage = lazy(() => import('./pages/cuenta/MisCreacionesPage'));
const CuentaReferidosPage = lazy(() => import('./pages/cuenta/CuentaReferidosPage'));
const CuentaFechasImportantesPage = lazy(() => import('./pages/cuenta/CuentaFechasImportantesPage'));
const CatalogReward = lazy(() => import('./pages/cuenta/CatalogReward'));
const MisionesPage = lazy(() => import('./pages/cuenta/MisionesPage'));
const WishlistPrivatePage = lazy(() => import('./pages/cuenta/WishlistPage'));
const WishlistPublicPage = lazy(() => import('./pages/WishlistPublic/WishlistPublic'));

// ── QueryClient optimizado ────────────────────────────────────────────────────
const queryClient = new QueryClient({
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
  const isIndependentRoute = location.pathname.startsWith('/regalos-con-amor');
  
  // Activar Heatmap Tracker globalmente
  useHeatmapTracker(true, 10); // Batch de 10 clics

  if (isIndependentRoute) {
    return (
      <div className="App independent-app">
        <main style={{ width: '100%', minHeight: '100vh', padding: 0, margin: 0 }}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="App">
      <SystemAlert />
      <NavProgressBar />
      <RouteTracker />
      <ReferralTracker />
      <ScrollTracker />
      <AdminBar />
      <VisualEditorPanel />
      <Header />
      <main id="main-content-area">
        {children}
      </main>
      <Footer />
      <BottomNav />
      <div className="floating-action-stack">
        <WhatsAppButton />
        <KapiPet />
        <PackageBubble />
      </div>

      <FirebaseWarning />
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomFontsInjector />
      {/* Prefetch silencioso en background cuando el navegador está libre */}
      <AppPrefetcher />
      <ToastProvider>
        <AuthProvider>
          <WishlistProvider>
            <VisualEditorProvider>
              <CartProvider>
                <LayoutProvider>
                  <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <DeepLinkHandler />
                <GlobalLayout>
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoading />}>
                      <Routes>
                        {/* Tienda abierta para todos */}
                        <Route path="/" element={<TiendaPage />} />
                        {/* /tienda usa el MISMO catálogo escalable que la home (TiendaPage deriva pageId='tienda'
                            de la URL y monta el módulo sidebar_catalog con todos los filtros). Antes usaba la
                            LegacyTiendaPage (solo categoría); unificado el 2026-06-25. */}
                        <Route path="/tienda" element={<TiendaPage />} />
                        <Route path="/encuesta-suscripcion" element={
                          <Suspense fallback={<PageLoading />}>
                            <SubscriptionSurveyPage />
                          </Suspense>
                        } />
                        <Route path="/suscripciones" element={
                          <Suspense fallback={<PageLoading />}>
                            <SubscriptionLandingPage />
                          </Suspense>
                        } />
                        <Route path="/producto/:id" element={<ProductPage />} />
                        <Route path="/personalizar" element={<PersonalizarPage />} />
                        <Route path="/editor/:id" element={<EditorPage />} />
                        <Route path="/carrito" element={<CartPage />} />
                        <Route path="/checkout" element={<CheckoutPage />} />
                        <Route path="/wishlist/:userCode" element={<WishlistPublicPage />} />
                        <Route path="/app" element={<AppRedirect />} />
                        <Route path="/descargar" element={<AppRedirect />} />
                        <Route path="/pago-rapido/:id" element={<PagoRapidoPage />} />

                        <Route path="/pedidos" element={<Navigate to="/cuenta/pedidos" replace />} />

                        <Route path="/cuenta" element={<CuentaLayout />}>
                          <Route index element={<Navigate to="/cuenta/pedidos" replace />} />
                          <Route path="perfil" element={<PerfilPage />} />
                          <Route path="pedidos" element={<CuentaPedidosPage />} />
                          <Route path="creaciones" element={<MisCreacionesPage />} />
                          <Route path="referidos" element={<CuentaReferidosPage />} />
                          <Route path="fechas-importantes" element={<CuentaFechasImportantesPage />} />
                          <Route path="misiones" element={<MisionesPage />} />
                          <Route path="catalogo" element={<CatalogReward />} />
                          <Route path="wishlist" element={<WishlistPrivatePage />} />
                        </Route>

                        <Route path="/admin" element={<AdminRoute />}>
                          <Route element={<AdminLayout />}>
                            <Route index element={<AdminDashboard />} />
                            <Route path="dashboard" element={<AdminDashboardAnalytics />} />
                            <Route path="productos" element={<AdminProductos />} />
                            <Route path="inventario" element={<AdminInventario />} />
                            <Route path="mockups" element={<AdminMockups />} />
                            <Route path="productos/nuevo" element={<AdminProductoFormV2 />} />
                            <Route path="productos/:id" element={<AdminProductoFormV2 />} />
                            <Route path="categorias" element={<AdminCategorias />} />
                            <Route path="colecciones" element={<AdminColecciones />} />
                            <Route path="nichos" element={<AdminNichos />} />
                            <Route path="vendedores" element={<AdminVendors />} />
                            <Route path="recompensas" element={<AdminRecompensas />} />
                            <Route path="envios" element={<AdminEnviosZonas />} />
                            <Route path="payouts" element={<AdminPayouts />} />
                            <Route path="blueprints" element={<AdminBlueprints />} />
                            <Route path="flash-offers" element={<AdminFlashOffers />} />

                            <Route path="whatsapp" element={<AdminWhatsApp />} />
                            <Route path="referidos" element={<AdminReferidos />} />
                            <Route path="pagos" element={<AdminPagos />} />
                            <Route path="generador-pagos" element={<AdminGeneradorPagos />} />
                            <Route path="libro-reclamaciones" element={<AdminLibroReclamaciones />} />
                            <Route path="retos" element={<AdminRetos />} />
                            <Route path="destacados" element={<AdminDestacados />} />
                            <Route path="zonas" element={<Navigate to="/admin" replace />} />
                            <Route path="cliparts" element={<AdminCliparts />} />
                            <Route path="mascota" element={<AdminMascota />} />
                            <Route path="crear-cuentas-pedidos" element={<AdminCrearCuentasPedidos />} />
                            <Route path="usuarios-analytics" element={<AdminUsuariosAnalyticsPage />} />
                            <Route path="wordle" element={<AdminWordlePage />} />
                            <Route path="notificaciones" element={<AdminNotifications />} />
                            <Route path="marcas" element={<AdminMarcas />} />
                            <Route path="landing-pages" element={<AdminLandingPages />} />
                            <Route path="temas" element={<AdminThemes />} />
                            <Route path="store-editor" element={<AdminStoreEditor />} />
                            <Route path="ruleta" element={<AdminRuletaPage />} />
                            <Route path="backups" element={<AdminBackups />} />
                            <Route path="configuracion" element={<AdminConfiguracion />} />
                            <Route path="encuestas" element={<AdminEncuestas />} />
                            <Route path="fechas-importantes" element={<AdminFechasImportantesPage />} />
                          </Route>
                        </Route>

                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/registro" element={<RegisterPage />} />
                        <Route path="/completar-perfil" element={<CompleteProfilePage />} />
                        <Route path="/palabra-del-dia" element={<WordlePage />} />
                        <Route path="/minijuegos" element={<MinijuegosPage />} />
                        <Route path="/ruleta" element={<RuletaPage />} />
                        <Route path="/ball-sort" element={<BallSortPage />} />
                        <Route path="/recuperar-contrasena" element={<ResetPasswordPage />} />
                        <Route path="/politicas-privacidad" element={<PoliticasPrivacidadPage />} />
                        <Route path="/terminos-y-condiciones" element={<TerminosCondicionesPage />} />
                        <Route path="/libro-de-reclamaciones" element={<LibroReclamacionesPage />} />
                        <Route path="/regalos-con-amor" element={<NuevosUsuariosPage />} />
                        <Route path="/nuevos-usuarios" element={<Navigate to="/regalos-con-amor" replace />} />
                        <Route path="/regalo/:orderId" element={<GiftExperiencePage />} />
                        
                        {/* Mussa */}
                        <Route path="/mussa" element={<MussaPage />} />
                        <Route path="/regalos-catas" element={<RegalosCatasPage />} />

                        {/* Fase 1: búsqueda con facetas y páginas de nicho (multi-vendor) */}
                        <Route path="/buscar" element={<SearchPage />} />
                        <Route path="/nicho/:slug" element={<NichePage />} />
                        <Route path="/nichos" element={<NichesPage />} />
                        <Route path="/vendedor" element={<VendorPanel />} />
                        <Route path="/tienda-vendedor/:slug" element={<VendorStorefrontPage />} />
                        <Route path="/checkout-demo" element={<CheckoutDemoPage />} />
                        <Route path="/pago-demo/:orderId" element={<CheckoutDemoPage />} />
                        <Route path="/ofertas" element={<OfertasFlashPage />} />

                        {/* Dynamic Landing Pages Interceptor */}
                        <Route path="/:slug" element={<DynamicLandingPage />} />
                        
                        <Route path="*" element={<Navigate to="/cuenta" replace />} />
                      </Routes>
                    </Suspense>
                  </ErrorBoundary>
                </GlobalLayout>
                </Router>
                </LayoutProvider>
              </CartProvider>
            </VisualEditorProvider>
          </WishlistProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
// Force dev server update
