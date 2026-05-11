import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { setDocument, createDocument, getDocument } from '../../../services/firebase/firestore';
import { saveStorefrontConfig, getStorefrontConfig } from '../services/storefront';
import { getLockedPages } from '../../../services/lockedPages';

const VisualEditorContext = createContext();

export const useVisualEditor = () => useContext(VisualEditorContext);

export const VisualEditorProvider = ({ children }) => {
  const { isAdmin } = useAuth();
  const [isEditModeActive, setIsEditModeActive] = useState(false);
  const [activeSection, setActiveSection] = useState(null); // 'heroBanner', 'layout', 'header'
  const [hoveredSectionId, setHoveredSectionId] = useState(null); // sectionId from drawer
  const [editorPosition, setEditorPosition] = useState('right'); // 'left', 'right', 'floating'
  
  const [activePageId, setActivePageId] = useState('home');

  // Borrador local (draft) de la configuración de la tienda. 
  const [storeConfigDraft, setStoreConfigDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

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
        }
      }
    };
    loadDraft();
    return () => { mounted = false; };
  }, [isEditModeActive, activePageId]);

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

  const updateDraft = (sectionId, data) => {
    setStoreConfigDraft(prev => ({
      ...prev,
      [sectionId]: {
        ...prev?.[sectionId],
        ...data
      }
    }));
  };

  const updateSectionsDraft = (newSections) => {
    setStoreConfigDraft(prev => ({
      ...prev,
      sections: newSections
    }));
  };

  const saveDraftToFirestore = async () => {
    if (!storeConfigDraft) return { error: 'No hay cambios' };

    // Verificar si la página está bloqueada
    const lockedPages = await getLockedPages();
    if (lockedPages.includes(activePageId)) {
      alert(`⚠️ Esta página (${activePageId}) está BLOQUEADA por el Administrador. No se pueden guardar cambios.`);
      return { error: 'Página bloqueada' };
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
        toggleMobilePreview
      }}
    >
      {children}
    </VisualEditorContext.Provider>
  );
};
