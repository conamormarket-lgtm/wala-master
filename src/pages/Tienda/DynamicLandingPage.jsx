import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { getLandingPageBySlug } from './services/landingPages';
import { getThemeById } from './services/themes';
import { useLayoutContext } from '../../contexts/LayoutContext';
import { useVisualEditor } from './contexts/VisualEditorContext';
import TiendaPage from './TiendaPage';
import PageLoading from '../../components/common/PageLoading/PageLoading';
import { useAuth } from '../../contexts/AuthContext';

const DynamicLandingPage = () => {
  const { slug } = useParams();
  const { setHeaderVisible, setFooterVisible } = useLayoutContext();
  const { setActivePageId, storeConfigDraft } = useVisualEditor();
  const { isAuthenticated, loading: authLoading } = useAuth();
  
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

  if (loading || authLoading) return <PageLoading />;

  if (!landingPage) {
    // Redirigir a inicio si está logueado, o a login si no
    return isAuthenticated ? <Navigate to="/" replace /> : <Navigate to="/login" replace />;
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
      <TiendaPage />
    </div>
  );
};

export default DynamicLandingPage;
