import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { EditorProvider } from './contexts/EditorContext';
import { ToastProvider } from './contexts/ToastContext';
import { VisualEditorProvider } from './pages/Tienda/contexts/VisualEditorContext';
import { LayoutProvider } from './contexts/LayoutContext';
import AdminRoute from './components/AdminRoute/AdminRoute';
import RouteTracker from './components/analytics/RouteTracker';
import ReferralTracker from './components/analytics/ReferralTracker';
import ErrorBoundary from './components/common/ErrorBoundary/ErrorBoundary';
import PageLoading from './components/common/PageLoading/PageLoading';
import AppPrefetcher from './components/common/AppPrefetcher/AppPrefetcher';
import NavProgressBar from './components/common/NavProgressBar/NavProgressBar';
import CustomFontsInjector from './components/common/CustomFontsInjector/CustomFontsInjector';
import './App.css';

// ── Páginas principales y Layout Crítico (Carga Inmediata para evitar efecto Waterfall de Suspense) ──
import TiendaPage from './pages/Tienda/TiendaPage';
import LegacyTiendaPage from './pages/LegacyTienda/LegacyTiendaPage';
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import WordlePage from './pages/Tienda/WordlePage';
import BottomNav from './components/common/BottomNav';
import WhatsAppButton from './components/common/WhatsAppButton';
import FirebaseWarning from './components/common/FirebaseWarning';
import DailyReward from './components/common/DailyReward/DailyReward';
import AdminBar from './components/common/AdminBar/AdminBar';
import VisualEditorPanel from './pages/Tienda/admin/VisualEditorPanel';

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
const DynamicLandingPage = lazy(() => import('./pages/Tienda/DynamicLandingPage'));
const SubscriptionSurveyPage = lazy(() => import('./pages/SubscriptionSurveyPage'));
const SubscriptionLandingPage = lazy(() => import('./pages/SubscriptionLandingPage'));

// ── Admin Layout ─────────────────────────────────────────────────────────────
const AdminLayout = lazy(() => import('./components/AdminLayout/AdminLayout'));

// ── Secciones pesadas — lazy ─────────────────────────────────────────────────
const EditorPage = lazy(() => import('./pages/EditorPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

// ── Admin pages ───────────────────────────────────────────────────────────────
const AdminProductos = lazy(() => import('./pages/Tienda/admin/AdminProductos'));
const AdminInventario = lazy(() => import('./pages/Tienda/admin/AdminInventario'));
const AdminMockups = lazy(() => import('./pages/Tienda/admin/AdminMockups'));
const AdminReferidos = lazy(() => import('./pages/admin/AdminReferidos'));
const AdminProductoFormV2 = lazy(() => import('./pages/Tienda/admin/AdminProductoFormV2'));
const AdminCategorias = lazy(() => import('./pages/admin/AdminCategorias'));
const AdminColecciones = lazy(() => import('./pages/admin/AdminColecciones'));

const AdminWhatsApp = lazy(() => import('./pages/admin/AdminWhatsApp'));
const AdminPagos = lazy(() => import('./pages/admin/AdminPagos'));
const AdminDestacados = lazy(() => import('./pages/admin/AdminDestacados'));
const AdminCliparts = lazy(() => import('./pages/admin/AdminCliparts'));
const AdminMascota = lazy(() => import('./pages/admin/AdminMascota'));
const AdminBackups = lazy(() => import('./pages/admin/AdminBackups'));
const AdminConfiguracion = lazy(() => import('./pages/admin/AdminConfiguracion'));
const AdminCrearCuentasPedidos = lazy(() => import('./pages/admin/AdminCrearCuentasPedidos'));
const AdminUsuariosAnalyticsPage = lazy(() => import('./pages/admin/AdminUsuariosAnalyticsPage'));
const AdminWordlePage = lazy(() => import('./pages/admin/AdminWordlePage'));
const AdminMarcas = lazy(() => import('./pages/admin/AdminMarcas'));
const AdminLandingPages = lazy(() => import('./pages/Tienda/admin/AdminLandingPages'));
const AdminThemes = lazy(() => import('./pages/Tienda/admin/AdminThemes'));
const AdminStoreEditor = lazy(() => import('./pages/Tienda/admin/AdminStoreEditor'));
const AdminEncuestas = lazy(() => import('./pages/admin/AdminEncuestas'));

const AppRedirect = lazy(() => import('./pages/AppRedirect'));

// ── Cuenta ────────────────────────────────────────────────────────────────────
const CuentaLayout = lazy(() => import('./pages/CuentaLayout'));
const PerfilPage = lazy(() => import('./pages/cuenta/PerfilPage'));
const CuentaPedidosPage = lazy(() => import('./pages/cuenta/CuentaPedidosPage'));
const MisCreacionesPage = lazy(() => import('./pages/cuenta/MisCreacionesPage'));
const CuentaReferidosPage = lazy(() => import('./pages/cuenta/CuentaReferidosPage'));

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

// ── Restricted route config for maintenance ─────────────────────────────────────
const RestrictedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  const isYorh = user?.email?.toLowerCase() === 'yorh001@gmail.com';
  if (isYorh) return children;
  return <Navigate to="/cuenta" replace />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomFontsInjector />
      {/* Prefetch silencioso en background cuando el navegador está libre */}
      <AppPrefetcher />
      <ToastProvider>
        <AuthProvider>
          <VisualEditorProvider>
            <CartProvider>
              <LayoutProvider>
                <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <div className="App">
                  <NavProgressBar />
                <RouteTracker />
                <ReferralTracker />

                <AdminBar />
                <VisualEditorPanel />
                <Header />

                <main id="main-content-area">
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoading />}>
                      <Routes>
                        {/* Tienda abierta para todos */}
                        <Route path="/" element={<TiendaPage />} />
                        <Route path="/tienda" element={<LegacyTiendaPage />} />
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
                        <Route path="/app" element={<AppRedirect />} />
                        <Route path="/descargar" element={<AppRedirect />} />

                        <Route path="/pedidos" element={<Navigate to="/cuenta/pedidos" replace />} />

                        <Route path="/cuenta" element={<CuentaLayout />}>
                          <Route index element={<Navigate to="/cuenta/pedidos" replace />} />
                          <Route path="perfil" element={<PerfilPage />} />
                          <Route path="pedidos" element={<CuentaPedidosPage />} />
                          <Route path="creaciones" element={<MisCreacionesPage />} />
                          <Route path="referidos" element={<CuentaReferidosPage />} />
                        </Route>

                        <Route path="/admin" element={<AdminRoute />}>
                          <Route element={<AdminLayout />}>
                            <Route index element={<AdminDashboard />} />
                            <Route path="productos" element={<AdminProductos />} />
                            <Route path="inventario" element={<AdminInventario />} />
                            <Route path="mockups" element={<AdminMockups />} />
                            <Route path="productos/nuevo" element={<AdminProductoFormV2 />} />
                            <Route path="productos/:id" element={<AdminProductoFormV2 />} />
                            <Route path="categorias" element={<AdminCategorias />} />
                            <Route path="colecciones" element={<AdminColecciones />} />

                            <Route path="whatsapp" element={<AdminWhatsApp />} />
                            <Route path="referidos" element={<AdminReferidos />} />
                            <Route path="pagos" element={<AdminPagos />} />
                            <Route path="destacados" element={<AdminDestacados />} />
                            <Route path="zonas" element={<Navigate to="/admin" replace />} />
                            <Route path="cliparts" element={<AdminCliparts />} />
                            <Route path="mascota" element={<AdminMascota />} />
                            <Route path="crear-cuentas-pedidos" element={<AdminCrearCuentasPedidos />} />
                            <Route path="usuarios-analytics" element={<AdminUsuariosAnalyticsPage />} />
                            <Route path="wordle" element={<AdminWordlePage />} />
                            <Route path="marcas" element={<AdminMarcas />} />
                            <Route path="landing-pages" element={<AdminLandingPages />} />
                            <Route path="temas" element={<AdminThemes />} />
                            <Route path="store-editor" element={<AdminStoreEditor />} />
                            <Route path="backups" element={<AdminBackups />} />
                            <Route path="configuracion" element={<AdminConfiguracion />} />
                            <Route path="encuestas" element={<AdminEncuestas />} />
                          </Route>
                        </Route>

                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/registro" element={<RegisterPage />} />
                        <Route path="/completar-perfil" element={<CompleteProfilePage />} />
                        <Route path="/palabra-del-dia" element={<WordlePage />} />
                        <Route path="/recuperar-contrasena" element={<ResetPasswordPage />} />
                        <Route path="/politicas-privacidad" element={<PoliticasPrivacidadPage />} />
                        <Route path="/terminos-y-condiciones" element={<TerminosCondicionesPage />} />
                        
                        {/* Dynamic Landing Pages Interceptor */}
                        <Route path="/:slug" element={<DynamicLandingPage />} />
                        
                        <Route path="*" element={<Navigate to="/cuenta" replace />} />
                      </Routes>
                    </Suspense>
                  </ErrorBoundary>
                </main>

                <Footer />
                <BottomNav />
                <WhatsAppButton />
                <DailyReward />
                <FirebaseWarning />
              </div>
                </Router>
              </LayoutProvider>
            </CartProvider>
          </VisualEditorProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
// Force dev server update
