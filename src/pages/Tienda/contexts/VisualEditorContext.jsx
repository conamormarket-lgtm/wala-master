import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { setDocument, createDocument, getDocument } from '../../../services/firebase/firestore';
import { saveStorefrontConfig, getStorefrontConfig } from '../services/storefront';
import { getLockedPages } from '../../../services/lockedPages';
// Deshacer/rehacer del editor (paso 8): el borrador es toda la configuración.
import { useBorrador } from '../../../componentes/kit/editor/useBorrador';

const VisualEditorContext = createContext();

export const useVisualEditor = () => useContext(VisualEditorContext);

export const VisualEditorProvider = ({ children }) => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isEditModeActive, setIsEditModeActive] = useState(false);
  const [activeSection, setActiveSection] = useState(null); // 'heroBanner', 'layout', 'header'
  const [hoveredSectionId, setHoveredSectionId] = useState(null); // sectionId from drawer
  const [editorPosition, setEditorPosition] = useState('right'); // 'left', 'right', 'floating'
  
  const [activePageId, setActivePageId] = useState('home');

  // Borrador local (draft) de la configuración de la tienda: secciones de la
  // página + lo global (menú, cuenta, favoritos, buscador). Con deshacer y
  // rehacer, y sabe si hay cambios sin publicar.
  const borrador = useBorrador(null);
  const storeConfigDraft = borrador.secciones;
  const { reiniciar, cambiar } = borrador;
  const setStoreConfigDraft = reiniciar;
  const [isSaving, setIsSaving] = useState(false);
  // Dónde se insertará una sección nueva (el "+" de la página abre el catálogo del panel).
  const [insertarEn, setInsertarEn] = useState(null);

  // Modo vista móvil
  const [isPreviewMobile, setIsPreviewMobile] = useState(false);
  const toggleMobilePreview = () => setIsPreviewMobile(!isPreviewMobile);

  // Inyectar clase al body cuando se activa la previsualización móvil
  useEffect(() => {
    if (isEditModeActive && isPreviewMobile) {
      document.body.classList.add('mobile-preview-active');
    } else {
      document.body.classList.remove('mobile-preview-active');
    }
    return () => document.body.classList.remove('mobile-preview-active');
  }, [isEditModeActive, isPreviewMobile]);

  // Solo se permite el modo edición si el usuario es Admin
  useEffect(() => {
    if (!isAdmin && isEditModeActive) {
      setIsEditModeActive(false);
      setActiveSection(null);
    }
  }, [isAdmin, isEditModeActive]);

  // Precargar el borrador apenas se active el modo edición o se cambie la página activa
  useEffect(() => {
    let mounted = true;
    const loadDraft = async () => {
      if (isEditModeActive) {
        // Cargar configuración global (header, etc.) y secciones de la página actual
        const { data: globalData } = await getDocument('storeConfig', 'homePage');
        const { sections } = await getStorefrontConfig(activePageId);
        
        if (mounted) {
          setStoreConfigDraft({
            ...(globalData || {}),
            sections: sections || []
          });
        }
      } else {
        if (mounted) {
          setStoreConfigDraft(null);
          setActiveSection(null);
          setInsertarEn(null);
        }
      }
    };
    loadDraft();
    return () => { mounted = false; };
  }, [isEditModeActive, activePageId, setStoreConfigDraft]);

  const toggleEditMode = () => {
    setIsEditModeActive(!isEditModeActive);
    if (isEditModeActive) {
      setActiveSection(null);
    }
  };

  const openEditorForSection = async (sectionId, currentConfig) => {
    if (!isEditModeActive) return;
    setActiveSection(sectionId);
    if (!storeConfigDraft) {
      const safeConfig = currentConfig || {};
      setStoreConfigDraft(safeConfig);
      
      // Intentar precargar sections si no están en el currentConfig
      if (!safeConfig.sections) {
        const { sections } = await getStorefrontConfig(activePageId);
        setStoreConfigDraft(prev => ({ ...(prev || {}), sections: sections || [] }));
      }
    }
  };

  const closeEditor = () => {
    setActiveSection(null);
  };

  // `clave`: los cambios seguidos de un mismo campo cuentan como un solo paso al deshacer.
  const updateDraft = (sectionId, data, clave = `${sectionId}:${Object.keys(data || {}).join(',')}`) => {
    cambiar(prev => ({
      ...prev,
      [sectionId]: {
        ...prev?.[sectionId],
        ...data
      }
    }), clave);
  };

  const updateSectionsDraft = (newSections, clave) => {
    cambiar(prev => ({
      ...prev,
      sections: newSections
    }), clave);
  };

  // avisar: false = sin alert (el editor del kit avisa con un toast).
  const saveDraftToFirestore = async ({ avisar = true } = {}) => {
    if (!storeConfigDraft) return { error: 'No hay cambios' };

    // Verificar si la página está bloqueada
    const lockedPages = await getLockedPages();
    if (lockedPages.includes(activePageId)) {
      if (avisar) alert(`⚠️ Esta página (${activePageId}) está BLOQUEADA por el Administrador. No se pueden guardar cambios.`);
      return { error: 'Página bloqueada', bloqueada: true };
    }

    setIsSaving(true);
    
    // Guardar la configuración legacy temporalmente para asegurar retrocompatibilidad
    const { error: legacyError } = await setDocument('storeConfig', 'homePage', storeConfigDraft);
    
    // Convertir el heroBanner u otros módulos globales a secciones si es necesario
    let sectionsToSave = storeConfigDraft.sections || [];
    
    // Ahora guardamos usando la nueva colección de páginas
    const { error } = await saveStorefrontConfig(sectionsToSave, activePageId);
    
    // Crear un backup (Log)
    if (!error && !legacyError) {
      await createDocument('storeConfigLogs', {
        pageId: activePageId,
        config: storeConfigDraft,
        timestamp: new Date().toISOString(),
        user: isAdmin ? 'Admin' : 'Unknown',
        description: `Guardado desde el Editor Visual (Página: ${activePageId})`
      });
    }

    setIsSaving(false);
    if (!error && !legacyError) {
      borrador.marcarGuardado();
      // Invalidar la caché de react-query de la config de esta página para que el
      // cambio publicado se vea SIN refrescar (el query tiene staleTime alto y
      // refetchOnMount:false; sin esto, la vista pública seguía mostrando lo viejo).
      try {
        await queryClient.invalidateQueries({ queryKey: ['storefront-config', activePageId] });
        // 'home' también tiene fallback legacy en storefront/config.
        if (activePageId === 'home') {
          await queryClient.invalidateQueries({ queryKey: ['storefront-config', 'home'] });
        }
      } catch (e) {
        // La invalidación es best-effort; no debe romper el guardado.
        console.warn('[VisualEditor] invalidateQueries storefront-config:', e?.message || e);
      }
      return { success: true };
    }
    return { error: error || legacyError };
  };

  return (
    <VisualEditorContext.Provider
      value={{
        isEditModeActive,
        toggleEditMode,
        activeSection,
        hoveredSectionId,
        setHoveredSectionId,
        openEditorForSection,
        closeEditor,
        editorPosition,
        setEditorPosition,
        activePageId,
        setActivePageId,
        storeConfigDraft,
        setStoreConfigDraft,
        updateDraft,
        updateSectionsDraft,
        saveDraftToFirestore,
        isSaving,
        isPreviewMobile,
        toggleMobilePreview,
        // Editor del kit (paso 8).
        deshacer: borrador.deshacer,
        rehacer: borrador.rehacer,
        puedeDeshacer: borrador.puedeDeshacer,
        puedeRehacer: borrador.puedeRehacer,
        sinGuardar: borrador.sinGuardar,
        insertarEn,
        setInsertarEn
      }}
    >
      {children}
    </VisualEditorContext.Provider>
  );
};
