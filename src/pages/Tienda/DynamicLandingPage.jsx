import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useParams, useLocation, Navigate } from 'react-router-dom';
import { getLandingPageBySlug } from './services/landingPages';
import { getThemeById } from './services/themes';
import { useLayoutContext } from '../../contexts/LayoutContext';
import { useVisualEditor } from './contexts/VisualEditorContext';
import TiendaPage from './TiendaPage';
import { useAuth } from '../../contexts/AuthContext';
import BrandLoaderOverlay from '../../components/common/BrandLoader/BrandLoaderOverlay';
import './landing.css';

// Una landing que no existe (GENERALES.md P22): antes, al inicio sin avisar.
const NoEncontradaPage = lazy(() => import('../NoEncontradaPage'));

// Las landings de K-CHERO (reloj, billetera y el combo, más la URL vieja del
// reloj) se retiraron el 2026-10-19: sus enlaces (anuncios, compartidos) van
// a la tienda en vez de a una página vacía.
const LANDINGS_RETIRADAS = new Set([
  'reloj-kchero-2026', 'reloj-matador-pro-2026', 'billetera-kchero-2026', 'combo-reloj-billetera-2026',
]);

const DynamicLandingPage = () => {
  const { slug } = useParams();
  if (LANDINGS_RETIRADAS.has(String(slug || '').toLowerCase())) return <Navigate to="/tienda" replace />;
  return <LandingDinamica slug={slug} />;
};

const LandingDinamica = ({ slug }) => {
  const location = useLocation();
  const { setHeaderVisible, setFooterVisible } = useLayoutContext();
  const { setPaginaDelBuilder } = useVisualEditor();
  const { loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [landingPage, setLandingPage] = useState(null);
  const [themeContent, setThemeContent] = useState(null);

  // Oculta el header/footer de la tienda DE INMEDIATO. Si esperamos al fetch de
  // la landing, el cliente ve por un instante el chrome de WALA + el esqueleto
  // del catálogo. Tras el fetch se ajusta al valor real de la landing.
  useEffect(() => {
    setHeaderVisible(false);
    setFooterVisible(false);
  }, [setHeaderVisible, setFooterVisible]);

  useEffect(() => {
    let mounted = true;
    // Al saltar de una marca a otra este efecto se re-ejecuta pero `loading`
    // ya estaba en false, asi que se seguia viendo la landing ANTERIOR hasta
    // que llegaba la nueva. Volviendo a poner loading se muestra el
    // BrandLoader durante el salto, en vez de contenido de otra marca.
    setLoading(true);
    // Para el editor es una página del builder que aún carga: su id (el slug
    // guardado) lo registra TiendaPage cuando llega la landing.
    setPaginaDelBuilder('');
    const fetchLandingPage = async () => {
      try {
        const page = await getLandingPageBySlug(slug);
        if (mounted) {
          if (page) {
            setLandingPage(page);
            setHeaderVisible(!page.hideHeader);
            setFooterVisible(!page.hideFooter);

            if (page.themeId) {
              try {
                const theme = await getThemeById(page.themeId);
                if (theme && theme.cssContent) {
                  setThemeContent(theme.cssContent);
                }
              } catch (themeErr) {
                // El tema es cosmetico (CSS extra): si falla, la landing se
                // ve sin ese tema en vez de quedarse cargando para siempre.
                console.warn('No se pudo cargar el tema de la landing:', themeErr);
              }
            }
          } else {
            setPaginaDelBuilder(null);
          }
        }
      } catch (err) {
        // SIN este catch, un getLandingPageBySlug que rechaza (Firestore
        // caido, query mal formada, slug invalido) nunca llegaba a
        // `setLoading(false)`: el BrandLoaderOverlay (show relevo, sin
        // animacion de salida) se quedaba tapando la pantalla PARA SIEMPRE
        // -scroll bloqueado y cada click/tap tragado por el overlay invisible-.
        // Se loguea y se trata como "landing no encontrada" (misma UX que
        // hoy: redirige a home) en vez de dejar al usuario atrapado.
        console.error('Error al cargar la landing page:', err);
        if (mounted) setPaginaDelBuilder(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchLandingPage();

    return () => {
      mounted = false;
      // Restaurar visibilidad por defecto al salir de la landing page
      setHeaderVisible(true);
      setFooterVisible(true);
      setPaginaDelBuilder(null);
    };
  }, [slug, setHeaderVisible, setFooterVisible, setPaginaDelBuilder]);

  // Solo bloquear por auth al resolver el redirect cuando la LP no existe.
  // Si ya tenemos landing, NO remountar a PageLoading cuando authLoading
  // cambia (login anónimo / onAuthChange): ese unmount produce removeChild.

  // Mientras carga la landing NO mostramos el esqueleto del catálogo (PageLoading
  // dibuja tarjetas de producto y parece la tienda).
  //
  // Va el OVERLAY y no <BrandLoader/> suelto: el loader se dimensiona con
  // height:100%, y aqui el area de ruta no tiene alto definido, asi que
  // colapsaba a 0 y se veia la PANTALLA EN BLANCO — primero el vacio y solo
  // despues, ya montada TiendaPage, aparecia el logo de su propio overlay.
  // El overlay va por portal a document.body con position:fixed inset:0, no
  // depende de ningun ancestro, y ademas es el MISMO que usa TiendaPage: el
  // relevo entre los dos es invisible.
  if (loading) return <BrandLoaderOverlay show relevo />;

  if (!landingPage) {
    if (authLoading) return <BrandLoaderOverlay show relevo />;
    // Landing pública no encontrada: "No encontramos esta página" (con
    // generalesViejo, al inicio como antes; nunca a /login: las LP deben ser
    // visibles sin cuenta).
    return <Suspense fallback={<BrandLoaderOverlay show relevo />}><NoEncontradaPage antes="/" /></Suspense>;
  }

  // URL vieja de una landing renombrada (ej. /mussa → /lumi).
  if (landingPage.redirigirA) {
    return <Navigate to={`/${landingPage.redirigirA}${location.search}`} replace />;
  }

  return (
    <div className={`landing-page-wrapper ${landingPage.hideHeader ? 'no-header' : ''}`} id="landing-theme-wrapper" translate="no">
      {themeContent && (
        <style dangerouslySetInnerHTML={{ __html: themeContent }} />
      )}
      {/* 
        TiendaPage internamente usa la ruta para definir el pageId,
        así que ya renderizará las secciones correctas para esta landing.
      */}
      {/* pageBrandIdOverride: marca guardada en el doc landingPages. Si viene, TiendaPage
          la usa para acotar secciones a esa marca SIN inferirla de las secciones. Si la
          landing no tiene brandId (páginas antiguas), va vacío y TiendaPage infiere como hoy. */}
      <TiendaPage
        isLandingPage={true}
        pageIdOverride={landingPage.slug || landingPage.id}
        pageBrandIdOverride={landingPage.brandId || null}
      />
    </div>
  );
};

export default DynamicLandingPage;
