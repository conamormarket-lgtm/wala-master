import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { getLandingPageBySlug } from './services/landingPages';
import { getThemeById } from './services/themes';
import { useLayoutContext } from '../../contexts/LayoutContext';
import { useVisualEditor } from './contexts/VisualEditorContext';
import TiendaPage from './TiendaPage';
import PageLoading from '../../components/common/PageLoading/PageLoading';
import { useAuth } from '../../contexts/AuthContext';
import './landing-mobile.css';

const DynamicLandingPage = () => {
  const { slug } = useParams();
  const { setHeaderVisible, setFooterVisible } = useLayoutContext();
  const { setActivePageId, storeConfigDraft } = useVisualEditor();
  const { loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [landingPage, setLandingPage] = useState(null);
  const [themeContent, setThemeContent] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchLandingPage = async () => {
      const page = await getLandingPageBySlug(slug);
      if (mounted) {
        if (page) {
          setLandingPage(page);
          setActivePageId(page.id);
          setHeaderVisible(!page.hideHeader);
          setFooterVisible(!page.hideFooter);
          
          if (page.themeId) {
            const theme = await getThemeById(page.themeId);
            if (theme && theme.cssContent) {
              setThemeContent(theme.cssContent);
            }
          }
        }
        setLoading(false);
      }
    };

    fetchLandingPage();

    return () => {
      mounted = false;
      // Restaurar visibilidad por defecto al salir de la landing page
      setHeaderVisible(true);
      setFooterVisible(true);
      setActivePageId('home');
    };
  }, [slug, setHeaderVisible, setFooterVisible, setActivePageId]);

  // Solo bloquear por auth al resolver el redirect cuando la LP no existe.
  // Si ya tenemos landing, NO remountar a PageLoading cuando authLoading
  // cambia (login anónimo / onAuthChange): ese unmount produce removeChild.
  if (loading) return <PageLoading />;

  if (!landingPage) {
    if (authLoading) return <PageLoading />;
    // Landing pública no encontrada: a home si hay sesión; si no, home también
    // (no mandar a /login: las LP deben ser visibles sin cuenta).
    return <Navigate to="/" replace />;
  }

  return (
    <div className={`landing-page-wrapper ${landingPage.hideHeader ? 'no-header' : ''}`} id="landing-theme-wrapper">
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
