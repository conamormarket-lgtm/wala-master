import React from 'react';
import { useVisualEditor } from '../contexts/VisualEditorContext';
import Button from '../../../components/common/Button';
import { useQuery } from '@tanstack/react-query';
import { getCollections } from '../../../services/collections';
import { saveLandingPage } from '../services/landingPages';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import { SECTION_TYPES, getDefaultSettings } from '../services/storefront';
import styles from '../../../components/admin/VisualEditorPanel.module.css';
import { Eye, EyeOff, Settings2, Trash2, ChevronUp, ChevronDown, Plus, ArrowLeft, GripVertical, Save, X, LayoutTemplate, PanelLeft, Monitor, PanelRight } from 'lucide-react';

const TypographyControl = ({ label, prefix, settings, onChange }) => {
  return (
    <div style={{marginBottom: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '6px', border: '1px solid #e2e8f0'}}>
      <h5 style={{margin: '0 0 10px 0', fontSize: '0.9rem', color: '#334155'}}>{label}</h5>
      <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
        <div style={{flex: '1 1 45%'}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Fuente</label>
          <select value={settings[`${prefix}FontFamily`] || ''} onChange={e => onChange(`${prefix}FontFamily`, e.target.value)} style={{width: '100%', padding: '6px'}}>
            <option value="">Por defecto</option>
            <option value="'Inter', sans-serif">Inter</option>
            <option value="'Roboto', sans-serif">Roboto</option>
            <option value="'Poppins', sans-serif">Poppins</option>
            <option value="'Montserrat', sans-serif">Montserrat</option>
            <option value="'Outfit', sans-serif">Outfit</option>
            <option value="'Nunito', sans-serif">Nunito</option>
            <option value="'Raleway', sans-serif">Raleway</option>
            <option value="'Ubuntu', sans-serif">Ubuntu</option>
            <option value="'Playfair Display', serif">Playfair Display</option>
            <option value="'Merriweather', serif">Merriweather</option>
            <option value="'Lora', serif">Lora</option>
            <option value="'Oswald', sans-serif">Oswald</option>
          </select>
        </div>
        <div style={{flex: '1 1 45%'}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Tamaño</label>
          <input type="text" placeholder="Ej: 2rem o 24px" value={settings[`${prefix}FontSize`] || ''} onChange={e => onChange(`${prefix}FontSize`, e.target.value)} style={{width: '100%', padding: '6px'}} />
        </div>
        <div style={{flex: '1 1 45%'}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Grosor</label>
          <select value={settings[`${prefix}FontWeight`] || ''} onChange={e => onChange(`${prefix}FontWeight`, e.target.value)} style={{width: '100%', padding: '6px'}}>
            <option value="">Por defecto</option>
            <option value="300">Light (300)</option>
            <option value="400">Normal (400)</option>
            <option value="500">Medium (500)</option>
            <option value="600">Semibold (600)</option>
            <option value="700">Bold (700)</option>
            <option value="800">Extra Bold (800)</option>
            <option value="900">Black (900)</option>
          </select>
        </div>
        <div style={{flex: '1 1 45%'}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Transformar</label>
          <select value={settings[`${prefix}TextTransform`] || ''} onChange={e => onChange(`${prefix}TextTransform`, e.target.value)} style={{width: '100%', padding: '6px'}}>
            <option value="">Ninguno</option>
            <option value="uppercase">MAYÚSCULAS</option>
            <option value="lowercase">minúsculas</option>
            <option value="capitalize">Capitalizar</option>
          </select>
        </div>
      </div>
    </div>
  );
};

const BackgroundStylesControl = ({ settings, onChange }) => {
  return (
    <div style={{marginBottom: '15px', padding: '15px', background: '#f5f5f5', borderRadius: '6px', border: '1px solid #e2e8f0'}}>
      <h5 style={{margin: '0 0 10px 0', fontSize: '0.9rem', color: '#334155'}}>Fondo y Espaciado</h5>
      
      {/* Espaciado */}
      <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
        <div style={{flex: 1}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Padding Superior</label>
          <input type="text" placeholder="Ej: 2rem o 0" value={settings.paddingTop || '0rem'} onChange={e => onChange('paddingTop', e.target.value)} style={{width: '100%', padding: '6px'}} />
        </div>
        <div style={{flex: 1}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Padding Inferior</label>
          <input type="text" placeholder="Ej: 2rem o 0" value={settings.paddingBottom || '0rem'} onChange={e => onChange('paddingBottom', e.target.value)} style={{width: '100%', padding: '6px'}} />
        </div>
      </div>

      {/* Tipo de fondo */}
      <div style={{marginBottom: '10px'}}>
        <label style={{fontSize: '0.75rem', color: '#64748b'}}>Color Sólido</label>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px'}}>
          <input type="color" value={(!settings.backgroundColor || settings.backgroundColor === 'transparent') ? '#ffffff' : settings.backgroundColor} onChange={e => onChange('backgroundColor', e.target.value)} disabled={!settings.backgroundColor || settings.backgroundColor === 'transparent'} style={{height: '32px', padding: 0, width: '40px', cursor: (!settings.backgroundColor || settings.backgroundColor === 'transparent') ? 'not-allowed' : 'pointer'}} />
          <label style={{display: 'flex', alignItems: 'center', gap: '4px', margin: 0, fontSize: '0.85rem', cursor: 'pointer'}}>
            <input type="checkbox" checked={!settings.backgroundColor || settings.backgroundColor === 'transparent'} onChange={e => onChange('backgroundColor', e.target.checked ? 'transparent' : '#ffffff')} style={{margin: 0}} />
            Transparente
          </label>
        </div>
      </div>

      <div style={{marginBottom: '10px'}}>
        <label style={{fontSize: '0.75rem', color: '#64748b'}}>Wallpaper (URL de Imagen)</label>
        <input type="text" placeholder="https://..." value={settings.backgroundImageUrl || ''} onChange={e => onChange('backgroundImageUrl', e.target.value)} style={{width: '100%', padding: '6px'}} />
      </div>

      <div style={{marginBottom: '10px'}}>
        <label style={{fontSize: '0.75rem', color: '#64748b'}}>Gradiente CSS (Opcional)</label>
        <input type="text" placeholder="Ej: linear-gradient(90deg, #000, #fff)" value={settings.backgroundGradient || ''} onChange={e => onChange('backgroundGradient', e.target.value)} style={{width: '100%', padding: '6px'}} />
      </div>

      {(settings.backgroundImageUrl || settings.backgroundGradient) && (
        <>
          <div style={{marginBottom: '10px'}}>
            <label style={{fontSize: '0.75rem', color: '#64748b'}}>Difuminar Fondo (Blur px)</label>
            <input type="number" min="0" max="100" placeholder="Ej: 10" value={settings.backgroundBlur || ''} onChange={e => onChange('backgroundBlur', e.target.value)} style={{width: '100%', padding: '6px'}} />
          </div>
        </>
      )}

      <div>
        <label style={{fontSize: '0.75rem', color: '#64748b'}}>Filtro Oscuro/Color (Overlay)</label>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px'}}>
          <input type="color" value={settings.backgroundOverlay || '#000000'} onChange={e => onChange('backgroundOverlay', e.target.value)} disabled={!settings.backgroundOverlay} style={{height: '32px', padding: 0, width: '40px', cursor: !settings.backgroundOverlay ? 'not-allowed' : 'pointer'}} />
          <label style={{display: 'flex', alignItems: 'center', gap: '4px', margin: 0, fontSize: '0.85rem', cursor: 'pointer'}}>
            <input type="checkbox" checked={!settings.backgroundOverlay} onChange={e => onChange('backgroundOverlay', e.target.checked ? '' : 'rgba(0,0,0,0.5)')} style={{margin: 0}} />
            Sin filtro
          </label>
        </div>
      </div>
    </div>
  );
};

const VisualEditorPanel = () => {
  const { 
    isEditModeActive, 
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
    updateDraft,
    updateSectionsDraft,
    saveDraftToFirestore,
    isSaving
  } = useVisualEditor();

  const { isHeaderVisible, setHeaderVisible, isFooterVisible, setFooterVisible } = useLayoutContext();

  const { data: collections } = useQuery({
    queryKey: ['admin-collections'],
    queryFn: async () => {
      const { data } = await getCollections();
      return data || [];
    }
  });

  // --- Lógica de Arrastre (Drag) para Modo Flotante ---
  const [position, setPosition] = React.useState({ x: window.innerWidth - 380, y: 80 });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartPos = React.useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (editorPosition !== 'floating') return;
    if (e.target.closest('button')) return; // No arrastrar si hace clic en un botón
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = React.useCallback((e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartPos.current.x,
      y: e.clientY - dragStartPos.current.y
    });
  }, [isDragging]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);
  // ----------------------------------------------------

  if (!isEditModeActive) return null;

  const handleSave = async () => {
    const res = await saveDraftToFirestore();
    if (res.success) {
      alert('¡Cambios guardados en vivo!');
      closeEditor();
    } else {
      alert('Error guardando: ' + res.error);
    }
  };

  const moveSection = (index, direction) => {
    const sections = [...(storeConfigDraft?.sections || [])];
    if (direction === 'up' && index > 0) {
      [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
      sections.forEach((s, i) => s.order = i);
      updateSectionsDraft(sections);
    } else if (direction === 'down' && index < sections.length - 1) {
      [sections[index + 1], sections[index]] = [sections[index], sections[index + 1]];
      sections.forEach((s, i) => s.order = i);
      updateSectionsDraft(sections);
    }
  };

  const removeSection = (index) => {
    if(window.confirm('¿Eliminar esta sección?')) {
      const sections = [...(storeConfigDraft?.sections || [])];
      sections.splice(index, 1);
      sections.forEach((s, i) => s.order = i);
      updateSectionsDraft(sections);
    }
  };

  const addSection = (type) => {
    const sections = [...(storeConfigDraft?.sections || [])];
    sections.push({
      id: `section_${Date.now()}`,
      type,
      order: sections.length,
      settings: getDefaultSettings(type)
    });
    updateSectionsDraft(sections);
  };

  const renderPageBuilderOverview = () => {
    const sections = storeConfigDraft?.sections || [];
    
    return (
      <div className={styles.pageBuilder}>
        <p style={{marginBottom: '1rem', fontSize: '0.9rem', color: '#666'}}>
          Configurando página: <strong>{activePageId}</strong>
        </p>
        
        <div className={styles.sectionList}>
          {/* HEADER (Global) */}
          {(activePageId === 'home' || activePageId === 'tienda') && activePageId !== 'footer' && (
            <div className={styles.linkSummaryBox} style={{ borderLeft: '4px solid #8b5cf6', background: '#f8f5ff', marginBottom: '15px', flexDirection: 'column', alignItems: 'stretch', padding: '12px', opacity: !isHeaderVisible ? 0.6 : 1 }}>
              <div style={{marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                <div>
                  <strong style={{display: 'block', fontSize: '0.95rem'}}>Encabezado Global (Header)</strong>
                  <span style={{fontSize: '0.8rem', color: '#666'}}>Se muestra en todas las páginas</span>
                </div>
                {activePageId !== 'home' && activePageId !== 'tienda' && activePageId !== 'footer' && (
                  <button 
                    onClick={async () => {
                      const newVis = !isHeaderVisible;
                      setHeaderVisible(newVis);
                      import('../services/landingPages').then(async ({ getLandingPageBySlug, saveLandingPage }) => {
                        const lp = await getLandingPageBySlug(activePageId);
                        if (lp) {
                          saveLandingPage(lp.id, { hideHeader: !newVis });
                        }
                      });
                    }}
                    style={{ background: 'transparent', color: isHeaderVisible ? '#10b981' : '#ef4444', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title={isHeaderVisible ? "Ocultar Encabezado" : "Mostrar Encabezado"}
                  >
                    {isHeaderVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button disabled={!isHeaderVisible} style={{flex: 1, minWidth: '70px', padding: '6px 4px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: 500, opacity: isHeaderVisible ? 1 : 0.5}} onClick={() => openEditorForSection('header', storeConfigDraft)} title="Editar Navegación">Navegación</button>
                <button disabled={!isHeaderVisible} style={{flex: 1, minWidth: '60px', padding: '6px 4px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: 500, opacity: isHeaderVisible ? 1 : 0.5}} onClick={() => openEditorForSection('accountPopup', storeConfigDraft)} title="Editar Mi Cuenta">Cuenta</button>
                <button disabled={!isHeaderVisible} style={{flex: 1, minWidth: '60px', padding: '6px 4px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: 500, opacity: isHeaderVisible ? 1 : 0.5}} onClick={() => openEditorForSection('favoritesPopup', storeConfigDraft)} title="Editar Favoritos">Favoritos</button>
              </div>
            </div>
          )}

          {/* DYNAMIC SECTIONS */}
          {sections.length === 0 && (
            <div style={{textAlign: 'center', margin: '20px 0', padding: '20px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1'}}>
              <p style={{color: '#64748b', marginBottom: '15px', fontSize: '0.9rem'}}>Crea tu página arrastrando módulos o inicia rápido con una base.</p>
              <button 
                onClick={() => {
                  const newSections = [
                    { id: `section_${Date.now()}_1`, type: 'hero_banner', order: 0, settings: getDefaultSettings('hero_banner') },
                    { id: `section_${Date.now()}_2`, type: 'text_block', order: 1, settings: getDefaultSettings('text_block') }
                  ];
                  if (newSections[0].settings) {
                    newSections[0].settings.title = "¡Gran Oferta Especial!";
                    newSections[0].settings.subtitle = "Descripción corta para atrapar a tu cliente.";
                    newSections[0].settings.buttonText = "Comprar Ahora";
                  }
                  updateSectionsDraft(newSections);
                }}
                style={{ background: '#8b5cf6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                <LayoutTemplate size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Cargar Plantilla de Landing
              </button>
            </div>
          )}
          {sections.sort((a,b) => (a.order||0) - (b.order||0)).map((section, index) => {
            const typeLabel = SECTION_TYPES.find(t => t.id === section.type)?.label || section.type;
            return (
              <div 
                key={section.id} 
                className={`${styles.linkSummaryBox} ${hoveredSectionId === section.id ? styles.hoveredModuleInDrawer : ''}`} 
                style={{cursor: 'default'}}
                onMouseEnter={() => setHoveredSectionId(section.id)}
                onMouseLeave={() => setHoveredSectionId(null)}
              >
                <div style={{flex: 1}}>
                  <strong style={{display: 'block', fontSize: '0.95rem'}}>{typeLabel}</strong>
                  {section.settings?.title && (
                    <span style={{fontSize: '0.8rem', color: '#666'}}>{section.settings.title}</span>
                  )}
                </div>
                <div className={styles.linkSummaryActions}>
                  <button onClick={() => moveSection(index, 'up')} disabled={index === 0} title="Mover Arriba"><ChevronUp size={16} strokeWidth={1.5} /></button>
                  <button onClick={() => moveSection(index, 'down')} disabled={index === sections.length - 1} title="Mover Abajo"><ChevronDown size={16} strokeWidth={1.5} /></button>
                  <button onClick={() => openEditorForSection(section.id, storeConfigDraft)} title="Editar Configuración"><Settings2 size={16} strokeWidth={1.5} /></button>
                  <button onClick={() => removeSection(index)} className={styles.removeBtn} title="Eliminar"><Trash2 size={16} strokeWidth={1.5} /></button>
                </div>
              </div>
            );
          })}

          {/* FOOTER (Global) */}
          {(activePageId === 'home' || activePageId === 'tienda') && activePageId !== 'footer' && (
            <div className={styles.linkSummaryBox} style={{ borderLeft: '4px solid #8b5cf6', background: '#f8f5ff', marginTop: '15px', opacity: !isFooterVisible ? 0.6 : 1 }}>
              <div style={{flex: 1}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                  <div>
                    <strong style={{display: 'block', fontSize: '0.95rem'}}>Pie de Página Global (Footer)</strong>
                    <span style={{fontSize: '0.8rem', color: '#666'}}>Se muestra en todas las páginas</span>
                  </div>
                  {activePageId !== 'home' && activePageId !== 'tienda' && activePageId !== 'footer' && (
                    <button 
                      onClick={async () => {
                        const newVis = !isFooterVisible;
                        setFooterVisible(newVis);
                        import('../services/landingPages').then(async ({ getLandingPageBySlug, saveLandingPage }) => {
                          const lp = await getLandingPageBySlug(activePageId);
                          if (lp) {
                            saveLandingPage(lp.id, { hideFooter: !newVis });
                          }
                        });
                      }}
                      style={{ background: 'transparent', color: isFooterVisible ? '#10b981' : '#ef4444', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '10px' }}
                      title={isFooterVisible ? "Ocultar Pie de Página" : "Mostrar Pie de Página"}
                    >
                      {isFooterVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.linkSummaryActions}>
                <button disabled={!isFooterVisible} onClick={() => {
                  setActivePageId('footer');
                  closeEditor();
                  // Forzamos recarga para que tome el contexto
                  window.location.href = '/tienda?t=preview';
                }} title="Editar Diseño del Footer Global" style={{ opacity: !isFooterVisible ? 0.5 : 1 }}><Settings2 size={16} strokeWidth={1.5} /></button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.formGroup} style={{marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', paddingBottom: '1rem'}}>
          <label style={{ display: 'flex', alignItems: 'center', color: '#0f172a', fontWeight: '600', fontSize: '0.95rem', marginBottom: '0.5rem', marginTop: 0 }}>
            <Plus size={16} strokeWidth={2} style={{marginRight: 6, color: '#8b5cf6'}} /> Añadir Nuevo Módulo
          </label>
          <select 
            className={styles.typeSelect} 
            onChange={(e) => {
              if (e.target.value) {
                addSection(e.target.value);
                e.target.value = '';
              }
            }}
          >
            <option value="">-- Selecciona un módulo para añadir --</option>
            {SECTION_TYPES.map(type => (
              <option key={type.id} value={type.id}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  const renderForm = () => {
    if (!activeSection) {
      return renderPageBuilderOverview();
    }

    // Comprobar si activeSection es el ID de una sección dinámica en el array
    const dynamicSectionIndex = storeConfigDraft?.sections?.findIndex(s => s.id === activeSection);

    if (dynamicSectionIndex >= 0) {
      const section = storeConfigDraft.sections[dynamicSectionIndex];
      
      if (section.type === 'footer_columns') {
        const s = section.settings || {};
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>
              Editando: Pie de Página (Columnas)
            </h4>
            
            <p style={{fontSize: '0.85rem', color: '#666', marginBottom: '1rem'}}>
              Por defecto, el pie de página tiene columnas. Usa esta sección para configurar las columnas y enlaces.
            </p>
            
            {(s.columns || []).map((col, colIndex) => (
              <div key={colIndex} style={{background: '#f9f9f9', padding: '10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #eee'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <input 
                    type="text" 
                    placeholder="Título de la columna"
                    value={col.title || ''} 
                    onChange={e => {
                      const newSections = [...storeConfigDraft.sections];
                      newSections[dynamicSectionIndex].settings.columns[colIndex].title = e.target.value;
                      updateSectionsDraft(newSections);
                    }}
                    style={{padding: '6px', fontWeight: 'bold'}}
                  />
                  <button 
                    onClick={() => {
                      const newSections = [...storeConfigDraft.sections];
                      newSections[dynamicSectionIndex].settings.columns.splice(colIndex, 1);
                      updateSectionsDraft(newSections);
                    }}
                    style={{background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '1.2rem'}}
                  ><Trash2 size={16} strokeWidth={1.5} /></button>
                </div>

                <select 
                  value={col.type || 'text'} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.columns[colIndex].type = e.target.value;
                    if (e.target.value === 'links' && !newSections[dynamicSectionIndex].settings.columns[colIndex].links) {
                      newSections[dynamicSectionIndex].settings.columns[colIndex].links = [];
                    }
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginTop: '10px'}}
                >
                  <option value="text">Texto Simple</option>
                  <option value="links">Lista de Enlaces</option>
                </select>

                {col.type === 'text' && (
                  <textarea 
                    placeholder="Contenido"
                    value={col.content || ''} 
                    onChange={e => {
                      const newSections = [...storeConfigDraft.sections];
                      newSections[dynamicSectionIndex].settings.columns[colIndex].content = e.target.value;
                      updateSectionsDraft(newSections);
                    }}
                    style={{width: '100%', padding: '6px', marginTop: '10px', minHeight: '60px', fontFamily: 'inherit'}}
                  />
                )}

                {col.type === 'links' && (
                  <div style={{marginTop: '10px'}}>
                    {(col.links || []).map((link, linkIndex) => (
                      <div key={linkIndex} style={{display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px', padding: '10px', background: 'white', borderRadius: '4px', border: '1px solid #ddd'}}>
                        <input 
                          type="text" 
                          placeholder="Texto"
                          value={link.text || ''} 
                          onChange={e => {
                            const newSections = [...storeConfigDraft.sections];
                            newSections[dynamicSectionIndex].settings.columns[colIndex].links[linkIndex].text = e.target.value;
                            updateSectionsDraft(newSections);
                          }}
                          style={{width: '100%', padding: '6px', fontSize: '0.85rem'}}
                        />
                        <input 
                          type="text" 
                          placeholder="URL"
                          value={link.url || ''} 
                          onChange={e => {
                            const newSections = [...storeConfigDraft.sections];
                            newSections[dynamicSectionIndex].settings.columns[colIndex].links[linkIndex].url = e.target.value;
                            updateSectionsDraft(newSections);
                          }}
                          style={{width: '100%', padding: '6px', fontSize: '0.85rem'}}
                        />
                        
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px', width: '100%', marginTop: '5px'}}>
                          <label style={{display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem'}}>
                            Color:
                            <input 
                              type="color" 
                              value={link.color || '#ffffff'} 
                              onChange={e => {
                                const newSections = [...storeConfigDraft.sections];
                                newSections[dynamicSectionIndex].settings.columns[colIndex].links[linkIndex].color = e.target.value;
                                updateSectionsDraft(newSections);
                              }}
                              style={{padding: '0', width: '30px', height: '25px', cursor: 'pointer', border: '1px solid #ccc'}}
                            />
                          </label>
                          
                          <label style={{display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem'}}>
                            <input 
                              type="checkbox" 
                              checked={link.bold || false} 
                              onChange={e => {
                                const newSections = [...storeConfigDraft.sections];
                                newSections[dynamicSectionIndex].settings.columns[colIndex].links[linkIndex].bold = e.target.checked;
                                updateSectionsDraft(newSections);
                              }}
                              style={{margin: '0'}}
                            />
                            Negrita
                          </label>

                          <button 
                            onClick={() => {
                              const newSections = [...storeConfigDraft.sections];
                              newSections[dynamicSectionIndex].settings.columns[colIndex].links.splice(linkIndex, 1);
                              updateSectionsDraft(newSections);
                            }}
                            style={{marginLeft: 'auto', background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '1rem', padding: '0 5px'}}
                            title="Eliminar enlace"
                          ><Trash2 size={16} strokeWidth={1.5} /></button>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => {
                        const newSections = [...storeConfigDraft.sections];
                        if (!newSections[dynamicSectionIndex].settings.columns[colIndex].links) {
                          newSections[dynamicSectionIndex].settings.columns[colIndex].links = [];
                        }
                        newSections[dynamicSectionIndex].settings.columns[colIndex].links.push({ text: 'Nuevo Enlace', url: '/' });
                        updateSectionsDraft(newSections);
                      }}
                      style={{background: '#eee', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', marginTop: '5px'}}
                    ><Plus size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Añadir Enlace</button>
                  </div>
                )}
              </div>
            ))}

            <button 
              onClick={() => {
                const newSections = [...storeConfigDraft.sections];
                if (!newSections[dynamicSectionIndex].settings.columns) {
                  newSections[dynamicSectionIndex].settings.columns = [];
                }
                newSections[dynamicSectionIndex].settings.columns.push({ id: Date.now(), title: 'Nueva Columna', type: 'text', content: '' });
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', border: '1px dashed #ccc', background: 'transparent', padding: '10px', borderRadius: '6px', cursor: 'pointer'}}
            ><Plus size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Añadir Columna</button>
          </div>
        );
      }

      if (section.type === 'announcement_bar') {
        const s = section.settings || {};
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>
              Editando: Barra de Anuncios Superior
            </h4>
            
            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Color de Fondo</label>
                <input 
                  type="color" 
                  value={s.bgColor || '#000000'} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.bgColor = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', height: '40px', padding: 0}}
                />
              </div>
              <div style={{flex: 1}}>
                <label>Color de Texto</label>
                <input 
                  type="color" 
                  value={s.textColor || '#ffffff'} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.textColor = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', height: '40px', padding: 0}}
                />
              </div>
            </div>

            <label>Tipo de Animación</label>
            <select 
              value={s.animationType || 'fade'}
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.animationType = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '8px', marginBottom: '15px'}}
            >
              <option value="fade">Desvanecimiento (Fade)</option>
              <option value="scroll">Desplazamiento Continuo (Scroll)</option>
            </select>

            <label>Velocidad de Animación (segundos)</label>
            <input 
              type="number" 
              value={(s.speed || 3000) / 1000} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.speed = Number(e.target.value) * 1000;
                updateSectionsDraft(newSections);
              }}
              min="1"
              step="1"
              style={{width: '100%', padding: '8px', marginBottom: '15px'}}
            />

            <h5 style={{marginBottom: '10px', marginTop: '10px'}}>Mensajes</h5>
            {(s.messages || []).map((msg, msgIndex) => (
              <div key={msgIndex} style={{background: '#f9f9f9', padding: '10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #eee'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                  <strong>Mensaje {msgIndex + 1}</strong>
                  <button 
                    onClick={() => {
                      const newSections = [...storeConfigDraft.sections];
                      newSections[dynamicSectionIndex].settings.messages.splice(msgIndex, 1);
                      updateSectionsDraft(newSections);
                    }}
                    style={{background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '1.2rem'}}
                  ><Trash2 size={16} strokeWidth={1.5} /></button>
                </div>

                <label>Texto del anuncio</label>
                <input 
                  type="text" 
                  value={msg.text || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.messages[msgIndex].text = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />

                <label>URL del Enlace (Opcional)</label>
                <input 
                  type="text" 
                  value={msg.link || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.messages[msgIndex].link = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />

                <label>URL de Imagen/Ícono (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ej: https://.../icono.png"
                  value={msg.imageUrl || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.messages[msgIndex].imageUrl = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />

                <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                  <div style={{flex: 1}}>
                    <label>Tipografía</label>
                    <select 
                      value={msg.fontFamily || ''} 
                      onChange={e => {
                        const newSections = [...storeConfigDraft.sections];
                        newSections[dynamicSectionIndex].settings.messages[msgIndex].fontFamily = e.target.value;
                        updateSectionsDraft(newSections);
                      }}
                      style={{width: '100%', padding: '6px'}}
                    >
                      <option value="">Por defecto</option>
                      <option value="'Inter', sans-serif">Inter</option>
                      <option value="'Outfit', sans-serif">Outfit</option>
                      <option value="'Roboto', sans-serif">Roboto</option>
                      <option value="'Montserrat', sans-serif">Montserrat</option>
                    </select>
                  </div>
                  <div style={{flex: 1}}>
                    <label>Tamaño (px)</label>
                    <input 
                      type="number" 
                      value={msg.fontSize ? msg.fontSize.replace('px', '') : '14'} 
                      onChange={e => {
                        const newSections = [...storeConfigDraft.sections];
                        newSections[dynamicSectionIndex].settings.messages[msgIndex].fontSize = `${e.target.value}px`;
                        updateSectionsDraft(newSections);
                      }}
                      style={{width: '100%', padding: '6px'}}
                    />
                  </div>
                </div>

                <div style={{display: 'flex', gap: '10px', marginBottom: '5px'}}>
                  <label style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                    <input 
                      type="checkbox" 
                      checked={msg.bold || false} 
                      onChange={e => {
                        const newSections = [...storeConfigDraft.sections];
                        newSections[dynamicSectionIndex].settings.messages[msgIndex].bold = e.target.checked;
                        updateSectionsDraft(newSections);
                      }}
                      style={{margin: 0}}
                    />
                    <b>Negrita</b>
                  </label>
                  <label style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                    <input 
                      type="checkbox" 
                      checked={msg.italic || false} 
                      onChange={e => {
                        const newSections = [...storeConfigDraft.sections];
                        newSections[dynamicSectionIndex].settings.messages[msgIndex].italic = e.target.checked;
                        updateSectionsDraft(newSections);
                      }}
                      style={{margin: 0}}
                    />
                    <i>Cursiva</i>
                  </label>
                </div>
              </div>
            ))}

            <button 
              onClick={() => {
                const newSections = [...storeConfigDraft.sections];
                if (!newSections[dynamicSectionIndex].settings.messages) {
                  newSections[dynamicSectionIndex].settings.messages = [];
                }
                newSections[dynamicSectionIndex].settings.messages.push({ text: 'Nuevo Anuncio', link: '' });
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', border: '1px dashed #ccc', background: 'transparent', padding: '10px', borderRadius: '6px', cursor: 'pointer'}}
            ><Plus size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Añadir Mensaje</button>
          </div>
        );
      }

      if (section.type === 'testimonials') {
        const s = section.settings || {};
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>
              Editando: Testimonios / Opiniones
            </h4>

            <label>Título de la Sección</label>
            <input 
              type="text" 
              value={s.title || ''} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.title = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '15px'}}
            />

            <h5 style={{marginBottom: '10px'}}>Testimonios</h5>
            {(s.testimonials || []).map((testim, index) => (
              <div key={index} style={{background: '#f9f9f9', padding: '10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #eee'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                  <strong>Testimonio {index + 1}</strong>
                  <button 
                    onClick={() => {
                      const newSections = [...storeConfigDraft.sections];
                      newSections[dynamicSectionIndex].settings.testimonials.splice(index, 1);
                      updateSectionsDraft(newSections);
                    }}
                    style={{background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '1.2rem'}}
                  ><Trash2 size={16} strokeWidth={1.5} /></button>
                </div>

                <label>Nombre del Autor</label>
                <input 
                  type="text" 
                  value={testim.author || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.testimonials[index].author = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />

                <label>Texto / Opinión</label>
                <textarea 
                  value={testim.text || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.testimonials[index].text = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px', minHeight: '60px', fontFamily: 'inherit'}}
                />

                <label>Calificación (Estrellas 1-5)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="5" 
                  value={testim.rating || 5} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.testimonials[index].rating = Number(e.target.value);
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />
              </div>
            ))}

            <button 
              onClick={() => {
                const newSections = [...storeConfigDraft.sections];
                if (!newSections[dynamicSectionIndex].settings.testimonials) {
                  newSections[dynamicSectionIndex].settings.testimonials = [];
                }
                newSections[dynamicSectionIndex].settings.testimonials.push({ author: 'Nuevo Autor', text: 'Me encantó este producto.', rating: 5 });
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', border: '1px dashed #ccc', background: 'transparent', padding: '10px', borderRadius: '6px', cursor: 'pointer'}}
            ><Plus size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Añadir Testimonio</button>
          </div>
        );
      }

      if (section.type === 'video') {
        const s = section.settings || {};
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>
              Editando: Video Promocional
            </h4>

            <p style={{fontSize: '0.85rem', color: '#666', marginBottom: '1rem'}}>
              Pega un enlace directo de YouTube o la URL de un archivo MP4. El reproductor se adaptará automáticamente a pantalla completa.
            </p>

            <label>URL del Video (YouTube o MP4)</label>
            <input 
              type="text" 
              placeholder="Ej: https://www.youtube.com/watch?v=..."
              value={s.url || ''} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.url = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '15px'}}
            />

            <label>Relación de Aspecto (Formato)</label>
            <select 
              value={s.aspectRatio || '16:9'} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.aspectRatio = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '15px'}}
            >
              <option value="16:9">Horizontal Clásico (16:9)</option>
              <option value="9:16">Vertical / Shorts / TikTok (9:16)</option>
              <option value="1:1">Cuadrado (1:1)</option>
              <option value="auto">Automático (Solo MP4 nativo)</option>
            </select>

            <label>URL de la Portada (Opcional, solo para MP4)</label>
            <input 
              type="text" 
              placeholder="https://..."
              value={s.poster || ''} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.poster = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '15px'}}
            />

            <BackgroundStylesControl 
              settings={s} 
              onChange={(key, value) => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings[key] = value;
                updateSectionsDraft(newSections);
              }} 
            />

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Padding Superior</label>
                <input type="text" placeholder="Ej: 0rem" value={s.paddingTop || '0rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingTop = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
              <div style={{flex: 1}}>
                <label>Padding Inferior</label>
                <input type="text" placeholder="Ej: 0rem" value={s.paddingBottom || '0rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingBottom = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
            </div>
          </div>
        );
      }

      if (section.type === 'text') {
        const s = section.settings || {};
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>Editando: Bloque de Texto</h4>

            <fieldset style={{border: '1px solid #e2e8f0', borderRadius: '6px', padding: '15px', marginBottom: '15px'}}>
              <legend style={{fontWeight: 'bold', fontSize: '0.9rem', color: '#475569', padding: '0 5px'}}>Contenido Principal</legend>
              <label style={{fontSize: '0.85rem', color: '#64748b'}}>Título (Opcional)</label>
              <input type="text" placeholder="Escribe un título llamativo..." value={s.heading || ''} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.heading = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '8px', marginBottom: '15px', border: '1px solid #cbd5e1', borderRadius: '4px'}} />

              <label style={{fontSize: '0.85rem', color: '#64748b'}}>Párrafo</label>
              <textarea placeholder="Escribe aquí tu texto detallado..." value={s.content || ''} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.content = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '8px', minHeight: '120px', fontFamily: 'inherit', border: '1px solid #cbd5e1', borderRadius: '4px'}} />
            </fieldset>

            <fieldset style={{border: '1px solid #e2e8f0', borderRadius: '6px', padding: '15px', marginBottom: '15px'}}>
              <legend style={{fontWeight: 'bold', fontSize: '0.9rem', color: '#475569', padding: '0 5px'}}>Colores del Bloque</legend>
              <div style={{display: 'flex', gap: '15px', flexWrap: 'wrap'}}>
                <div style={{flex: '1 1 30%'}}>
                  <label style={{fontSize: '0.85rem', color: '#64748b'}}>Fondo</label>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px'}}>
                    <input type="color" value={s.backgroundColor === 'transparent' ? '#ffffff' : (s.backgroundColor || '#ffffff')} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.backgroundColor = e.target.value; updateSectionsDraft(newSections); }} disabled={s.backgroundColor === 'transparent'} style={{height: '32px', padding: 0, width: '40px', cursor: s.backgroundColor === 'transparent' ? 'not-allowed' : 'pointer'}} />
                    <label style={{display: 'flex', alignItems: 'center', gap: '4px', margin: 0, fontSize: '0.8rem', cursor: 'pointer', color: '#64748b'}}>
                      <input type="checkbox" checked={s.backgroundColor === 'transparent'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.backgroundColor = e.target.checked ? 'transparent' : '#ffffff'; updateSectionsDraft(newSections); }} style={{margin: 0}} />
                      Transparente
                    </label>
                  </div>
                </div>
                <div style={{flex: '1 1 30%'}}>
                  <label style={{fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '4px'}}>Color de Título</label>
                  <input type="color" value={s.headingColor || '#000000'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.headingColor = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', height: '32px', padding: 0, border: '1px solid #cbd5e1', borderRadius: '4px'}} />
                </div>
                <div style={{flex: '1 1 30%'}}>
                  <label style={{fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '4px'}}>Color de Párrafo</label>
                  <input type="color" value={s.textColor || '#333333'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.textColor = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', height: '32px', padding: 0, border: '1px solid #cbd5e1', borderRadius: '4px'}} />
                </div>
              </div>
            </fieldset>

            <fieldset style={{border: '1px solid #e2e8f0', borderRadius: '6px', padding: '15px', marginBottom: '15px'}}>
              <legend style={{fontWeight: 'bold', fontSize: '0.9rem', color: '#475569', padding: '0 5px'}}>Tipografía Avanzada</legend>
              <TypographyControl 
                label="Tipografía del Título" 
                prefix="heading" 
                settings={s} 
                onChange={(key, val) => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings[key] = val; updateSectionsDraft(newSections); }} 
              />
              
              <TypographyControl 
                label="Tipografía del Párrafo" 
                prefix="content" 
                settings={s} 
                onChange={(key, val) => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings[key] = val; updateSectionsDraft(newSections); }} 
              />
            </fieldset>

            <fieldset style={{border: '1px solid #e2e8f0', borderRadius: '6px', padding: '15px', marginBottom: '15px'}}>
              <legend style={{fontWeight: 'bold', fontSize: '0.9rem', color: '#475569', padding: '0 5px'}}>Estructura y Espaciado</legend>
              <div style={{display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap'}}>
                <div style={{flex: '1 1 45%'}}>
                  <label style={{fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '4px'}}>Alineación de texto</label>
                  <select value={s.textAlign || 'left'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.textAlign = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px'}}>
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                    <option value="justify">Justificado</option>
                  </select>
                </div>
                <div style={{flex: '1 1 45%'}}>
                  <label style={{fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '4px'}}>Ancho Máximo</label>
                  <input type="text" placeholder="Ej: 800px o 100%" value={s.maxWidth || '800px'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.maxWidth = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px'}} />
                </div>
              </div>

              <div style={{display: 'flex', gap: '15px', flexWrap: 'wrap'}}>
                <div style={{flex: '1 1 45%'}}>
                  <label style={{fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '4px'}}>Espaciado Arriba (Padding)</label>
                  <input type="text" placeholder="Ej: 2rem o 32px" value={s.paddingTop || '2rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingTop = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px'}} />
                </div>
                <div style={{flex: '1 1 45%'}}>
                  <label style={{fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '4px'}}>Espaciado Abajo (Padding)</label>
                  <input type="text" placeholder="Ej: 2rem o 32px" value={s.paddingBottom || '2rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingBottom = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px'}} />
                </div>
              </div>
            </fieldset>
          </div>
        );
      }

      if (section.type === 'image') {
        const s = section.settings || {};
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>Editando: Bloque de Imagen</h4>

            <label>URL de la Imagen</label>
            <input type="text" placeholder="https://..." value={s.url || ''} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.url = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px', marginBottom: '15px'}} />

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Texto Alternativo (Alt)</label>
                <input type="text" placeholder="Descripción para SEO" value={s.alt || ''} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.alt = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
              <div style={{flex: 1}}>
                <label>Enlace (Opcional)</label>
                <input type="text" placeholder="https://..." value={s.link || ''} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.link = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
            </div>

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Alineación</label>
                <select value={s.alignment || 'center'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.alignment = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}}>
                  <option value="left">Izquierda</option>
                  <option value="center">Centro</option>
                  <option value="right">Derecha</option>
                </select>
              </div>
              <div style={{flex: 1}}>
                <label>Ancho Máximo</label>
                <input type="text" placeholder="Ej: 100% o 500px" value={s.maxWidth || '100%'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.maxWidth = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
            </div>

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Radio de Borde</label>
                <input type="text" placeholder="Ej: 0px o 50%" value={s.borderRadius || '0px'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.borderRadius = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
              <div style={{flex: 1}}>
                <label>Color de Fondo</label>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <input type="color" value={s.backgroundColor === 'transparent' ? '#ffffff' : (s.backgroundColor || '#ffffff')} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.backgroundColor = e.target.value; updateSectionsDraft(newSections); }} disabled={s.backgroundColor === 'transparent'} style={{height: '32px', padding: 0, width: '40px', cursor: s.backgroundColor === 'transparent' ? 'not-allowed' : 'pointer'}} />
                  <label style={{display: 'flex', alignItems: 'center', gap: '4px', margin: 0, fontSize: '0.85rem', cursor: 'pointer'}}>
                    <input type="checkbox" checked={s.backgroundColor === 'transparent'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.backgroundColor = e.target.checked ? 'transparent' : '#ffffff'; updateSectionsDraft(newSections); }} style={{margin: 0}} />
                    Transparente
                  </label>
                </div>
              </div>
            </div>

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Padding Superior</label>
                <input type="text" placeholder="Ej: 0rem" value={s.paddingTop || '0rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingTop = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
              <div style={{flex: 1}}>
                <label>Padding Inferior</label>
                <input type="text" placeholder="Ej: 0rem" value={s.paddingBottom || '0rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingBottom = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
            </div>
          </div>
        );
      }

      if (section.type === 'map_location') {
        const s = section.settings || {};
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>
              Editando: Ubicación / Mapa
            </h4>

            <p style={{fontSize: '0.85rem', color: '#666', marginBottom: '1rem'}}>
              Pega el HTML "Insertar un mapa" de Google Maps y personaliza el texto de la tienda.
            </p>

            <h5 style={{marginBottom: '10px'}}>1. Google Maps</h5>
            <label>Código HTML (Embed) o URL</label>
            <textarea 
              placeholder='Ej: <iframe src="https://www.google.com/maps/embed?..." ...></iframe>'
              value={s.embedUrl || ''} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.embedUrl = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '15px', minHeight: '80px', fontFamily: 'monospace', fontSize: '12px'}}
            />

            <h5 style={{marginBottom: '10px'}}>2. Texto Adicional</h5>
            <label>Título</label>
            <input 
              type="text" 
              value={s.title || ''} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.title = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '10px'}}
            />
            <label>Descripción / Dirección</label>
            <textarea 
              value={s.description || ''} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.description = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '15px', minHeight: '60px', fontFamily: 'inherit'}}
            />

            <h5 style={{marginBottom: '10px', marginTop: '10px'}}>3. Diseño y Tamaño (Flexbox)</h5>
            
            <label>Posición del Mapa respecto al Texto</label>
            <select 
              value={s.layout || 'mapRight'} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.layout = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '10px'}}
            >
              <option value="mapRight">Texto a la Izquierda, Mapa a la Derecha</option>
              <option value="mapLeft">Mapa a la Izquierda, Texto a la Derecha</option>
              <option value="mapTop">Mapa Arriba, Texto Abajo (Apilados)</option>
              <option value="mapBottom">Texto Arriba, Mapa Abajo (Apilados)</option>
            </select>

            <label>Ancho del Mapa (Ej: 50%, 60%, 100%)</label>
            <input 
              type="text" 
              value={s.mapWidth || '50%'} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.mapWidth = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '10px'}}
            />

            <label>Alto del Mapa (Ej: 300px, 400px)</label>
            <input 
              type="text" 
              value={s.mapHeight || '400px'} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.mapHeight = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '15px'}}
            />
          </div>
        );
      }

      if (section.type === 'marquee') {
        const s = section.settings || {};
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>
              Editando: Carrusel de Logos / Marcas
            </h4>

            <label>Velocidad del Carrusel (segundos por ciclo)</label>
            <input 
              type="number" 
              value={(s.speed || 20000) / 1000} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.speed = Number(e.target.value) * 1000;
                updateSectionsDraft(newSections);
              }}
              min="5"
              step="1"
              style={{width: '100%', padding: '8px', marginBottom: '15px'}}
            />

            <h5 style={{marginBottom: '10px', marginTop: '10px'}}>Marcas</h5>
            {(s.items || []).map((item, itemIndex) => (
              <div key={itemIndex} style={{background: '#f9f9f9', padding: '10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #eee'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                  <strong>Marca {itemIndex + 1}</strong>
                  <button 
                    onClick={() => {
                      const newSections = [...storeConfigDraft.sections];
                      newSections[dynamicSectionIndex].settings.items.splice(itemIndex, 1);
                      updateSectionsDraft(newSections);
                    }}
                    style={{background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '1.2rem'}}
                  ><Trash2 size={16} strokeWidth={1.5} /></button>
                </div>

                <label>Nombre de la Marca (Texto debajo)</label>
                <input 
                  type="text" 
                  value={item.name || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.items[itemIndex].name = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />

                <label>URL de la Imagen (Logo circular)</label>
                <input 
                  type="text" 
                  placeholder="https://..."
                  value={item.imageUrl || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.items[itemIndex].imageUrl = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />

                <label>Enlace de Destino (Para imagen y texto)</label>
                <input 
                  type="text" 
                  placeholder="Ej: /tienda"
                  value={item.link || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.items[itemIndex].link = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />
              </div>
            ))}

            <button 
              onClick={() => {
                const newSections = [...storeConfigDraft.sections];
                if (!newSections[dynamicSectionIndex].settings.items) {
                  newSections[dynamicSectionIndex].settings.items = [];
                }
                newSections[dynamicSectionIndex].settings.items.push({ name: 'Nueva Marca', imageUrl: '', link: '' });
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', border: '1px dashed #ccc', background: 'transparent', padding: '10px', borderRadius: '6px', cursor: 'pointer', marginBottom: '15px'}}
            ><Plus size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Añadir Marca</button>

            <BackgroundStylesControl 
              settings={s} 
              onChange={(key, value) => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings[key] = value;
                updateSectionsDraft(newSections);
              }} 
            />

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Padding Superior</label>
                <input type="text" placeholder="Ej: 2rem" value={s.paddingTop || '2rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingTop = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
              <div style={{flex: 1}}>
                <label>Padding Inferior</label>
                <input type="text" placeholder="Ej: 2rem" value={s.paddingBottom || '2rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingBottom = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
            </div>
          </div>
        );
      }

      if (section.type === 'bestsellers_row') {
        const s = section.settings || {};
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>
              Editando: Lo Más Vendido (Fila de 5)
            </h4>

            <p style={{fontSize: '0.85rem', color: '#666', marginBottom: '1rem'}}>
              Esta sección muestra hasta 5 tarjetas destacadas (imágenes grandes sin espacios) para enlazar colecciones o productos principales.
            </p>

            <h5 style={{marginBottom: '10px', marginTop: '10px'}}>Tarjetas Destacadas</h5>
            {(s.cards || []).map((card, cardIndex) => (
              <div key={cardIndex} style={{background: '#f9f9f9', padding: '10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #eee'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                  <strong>Tarjeta {cardIndex + 1}</strong>
                  <button 
                    onClick={() => {
                      const newSections = [...storeConfigDraft.sections];
                      newSections[dynamicSectionIndex].settings.cards.splice(cardIndex, 1);
                      updateSectionsDraft(newSections);
                    }}
                    style={{background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '1.2rem'}}
                  ><Trash2 size={16} strokeWidth={1.5} /></button>
                </div>

                <label>Título (Encima de la foto)</label>
                <input 
                  type="text" 
                  value={card.title || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.cards[cardIndex].title = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />

                <label>Subtítulo (Breve descripción)</label>
                <input 
                  type="text" 
                  value={card.subtitle || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.cards[cardIndex].subtitle = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />

                <label>URL de la Imagen (Retrato/Vertical)</label>
                <input 
                  type="text" 
                  placeholder="https://..."
                  value={card.imageUrl || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.cards[cardIndex].imageUrl = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />

                <label>Enlace de Destino</label>
                <input 
                  type="text" 
                  placeholder="Ej: /tienda"
                  value={card.link || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.cards[cardIndex].link = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />
              </div>
            ))}

            {(s.cards || []).length < 5 && (
              <button 
                onClick={() => {
                  const newSections = [...storeConfigDraft.sections];
                  if (!newSections[dynamicSectionIndex].settings.cards) {
                    newSections[dynamicSectionIndex].settings.cards = [];
                  }
                  newSections[dynamicSectionIndex].settings.cards.push({ title: 'Nueva Tarjeta', subtitle: '', imageUrl: '', link: '' });
                  updateSectionsDraft(newSections);
                }}
                style={{width: '100%', border: '1px dashed #ccc', background: 'transparent', padding: '10px', borderRadius: '6px', cursor: 'pointer', marginBottom: '15px'}}
              ><Plus size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Añadir Tarjeta (Máx 5)</button>
            )}

            <BackgroundStylesControl 
              settings={s} 
              onChange={(key, value) => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings[key] = value;
                updateSectionsDraft(newSections);
              }} 
            />

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Padding Superior</label>
                <input type="text" placeholder="Ej: 2rem" value={s.paddingTop || '2rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingTop = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
              <div style={{flex: 1}}>
                <label>Padding Inferior</label>
                <input type="text" placeholder="Ej: 2rem" value={s.paddingBottom || '2rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingBottom = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
            </div>
          </div>
        );
      }

      if (section.type === 'header') {
        const s = section.settings || {};
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>Editando: Encabezado (Título)</h4>

            <label>Título Principal</label>
            <input type="text" value={s.title || ''} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.title = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px', marginBottom: '15px'}} />

            <label>Subtítulo</label>
            <textarea value={s.subtitle || ''} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.subtitle = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px', marginBottom: '15px', minHeight: '60px', fontFamily: 'inherit'}} />

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Color de Fondo</label>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <input type="color" value={s.backgroundColor === 'transparent' ? '#ffffff' : (s.backgroundColor || '#ffffff')} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.backgroundColor = e.target.value; updateSectionsDraft(newSections); }} disabled={s.backgroundColor === 'transparent'} style={{height: '32px', padding: 0, width: '40px', cursor: s.backgroundColor === 'transparent' ? 'not-allowed' : 'pointer'}} />
                  <label style={{display: 'flex', alignItems: 'center', gap: '4px', margin: 0, fontSize: '0.85rem', cursor: 'pointer'}}>
                    <input type="checkbox" checked={s.backgroundColor === 'transparent'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.backgroundColor = e.target.checked ? 'transparent' : '#ffffff'; updateSectionsDraft(newSections); }} style={{margin: 0}} />
                    Transparente
                  </label>
                </div>
              </div>
              <div style={{flex: 1}}>
                <label>Alineación</label>
                <select value={s.textAlign || 'center'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.textAlign = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}}>
                  <option value="left">Izquierda</option>
                  <option value="center">Centro</option>
                  <option value="right">Derecha</option>
                </select>
              </div>
            </div>

            <TypographyControl 
              label="Tipografía del Título" 
              prefix="title" 
              settings={s} 
              onChange={(key, val) => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings[key] = val; updateSectionsDraft(newSections); }} 
            />
            
            <TypographyControl 
              label="Tipografía del Subtítulo" 
              prefix="subtitle" 
              settings={s} 
              onChange={(key, val) => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings[key] = val; updateSectionsDraft(newSections); }} 
            />

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Color de Título</label>
                <input type="color" value={s.titleColor || '#000000'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.titleColor = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', height: '32px', padding: 0}} />
              </div>
              <div style={{flex: 1}}>
                <label>Color de Subtítulo</label>
                <input type="color" value={s.subtitleColor || '#666666'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.subtitleColor = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', height: '32px', padding: 0}} />
              </div>
            </div>

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Padding Superior</label>
                <input type="text" placeholder="Ej: 3rem" value={s.paddingTop || '3rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingTop = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
              <div style={{flex: 1}}>
                <label>Padding Inferior</label>
                <input type="text" placeholder="Ej: 2rem" value={s.paddingBottom || '2rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingBottom = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
            </div>
          </div>
        );
      }

      if (section.type === 'hero_banner') {
        const draft = section.settings || {};
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>
              Editando: Banner Principal (Hero)
            </h4>

            <label>Tipo de Medio</label>
            <select 
              value={draft.mediaType || 'image'} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.mediaType = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '10px'}}
            >
              <option value="image">Imagen Estática</option>
              <option value="gif">GIF Animado</option>
              <option value="video">Video (Autoplay)</option>
            </select>
            
            <label>URL del Medio</label>
            <input 
              type="text" 
              value={draft.mediaUrl || ''} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.mediaUrl = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '10px'}}
            />

            <h5 style={{marginBottom: '5px'}}>Posicionamiento del Texto</h5>
            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Horizontal</label>
                <select 
                  value={draft.textAlign || 'center'} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.textAlign = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px'}}
                >
                  <option value="left">Izquierda</option>
                  <option value="center">Centro</option>
                  <option value="right">Derecha</option>
                </select>
              </div>
              <div style={{flex: 1}}>
                <label>Vertical</label>
                <select 
                  value={draft.textPosition || 'center'} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.textPosition = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px'}}
                >
                  <option value="flex-start">Arriba</option>
                  <option value="center">Medio</option>
                  <option value="flex-end">Abajo</option>
                </select>
              </div>
            </div>
            
            <h5 style={{marginTop: '15px', marginBottom: '10px'}}>Textos y Enlaces</h5>
            <label>Título</label>
            <input 
              type="text" 
              value={draft.title || ''} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.title = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '10px'}}
            />
            
            <label>Subtítulo</label>
            <input 
              type="text" 
              value={draft.subtitle || ''} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.subtitle = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '15px'}}
            />

            <TypographyControl 
              label="Tipografía del Título" 
              prefix="title" 
              settings={draft} 
              onChange={(key, val) => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings[key] = val; updateSectionsDraft(newSections); }} 
            />
            
            <TypographyControl 
              label="Tipografía del Subtítulo" 
              prefix="subtitle" 
              settings={draft} 
              onChange={(key, val) => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings[key] = val; updateSectionsDraft(newSections); }} 
            />
            
            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Texto Botón</label>
                <input 
                  type="text" 
                  value={draft.buttonText || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.buttonText = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px'}}
                />
              </div>
              <div style={{flex: 1}}>
                <label>Enlace Botón</label>
                <input 
                  type="text" 
                  value={draft.buttonLink || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.buttonLink = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px'}}
                />
              </div>
            </div>

            <h5 style={{marginTop: '15px', marginBottom: '10px'}}>Estilos y Colores</h5>
            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Altura (minHeight)</label>
                <input 
                  type="text" 
                  value={draft.minHeight || '600px'} 
                  placeholder="Ej: 600px o 100vh"
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.minHeight = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px'}}
                />
              </div>
              <div style={{flex: 1}}>
                <label>Opacidad Fondo Oscuro (%)</label>
                <input 
                  type="number" 
                  min="0" max="100"
                  value={draft.overlayOpacity ?? 40} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.overlayOpacity = Number(e.target.value);
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px'}}
                />
              </div>
            </div>

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Color Título</label>
                <input type="color" value={draft.titleColor || '#ffffff'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.titleColor = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', height: '32px', padding: 0}} />
              </div>
              <div style={{flex: 1}}>
                <label>Color Subtítulo</label>
                <input type="color" value={draft.subtitleColor || '#ffffff'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.subtitleColor = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', height: '32px', padding: 0}} />
              </div>
            </div>

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Fondo Botón</label>
                <input type="color" value={draft.buttonBgColor || '#ffffff'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.buttonBgColor = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', height: '32px', padding: 0}} />
              </div>
              <div style={{flex: 1}}>
                <label>Texto Botón</label>
                <input type="color" value={draft.buttonTextColor || '#000000'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.buttonTextColor = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', height: '32px', padding: 0}} />
              </div>
            </div>
          </div>
        );
      }

      if (['featured_products', 'product_grid', 'sidebar_catalog'].includes(section.type)) {
        const s = section.settings || {};
        const titleLabel = section.type === 'sidebar_catalog' ? 'Título (Opcional)' : 'Título de la Sección';
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>
              Editando: {SECTION_TYPES.find(t => t.id === section.type)?.label || section.type}
            </h4>

            <label>{titleLabel}</label>
            <input 
              type="text" 
              value={s.title || ''} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.title = e.target.value;
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', padding: '6px', marginBottom: '15px'}}
            />

            <BackgroundStylesControl 
              settings={s} 
              onChange={(key, value) => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings[key] = value;
                updateSectionsDraft(newSections);
              }} 
            />

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Padding Superior</label>
                <input type="text" placeholder="Ej: 2rem" value={s.paddingTop || '2rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingTop = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
              <div style={{flex: 1}}>
                <label>Padding Inferior</label>
                <input type="text" placeholder="Ej: 2rem" value={s.paddingBottom || '2rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingBottom = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
            </div>
          </div>
        );
      }

      if (['collection_carousel', 'flash_sales'].includes(section.type)) {
        const s = section.settings || {};
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>
              Editando: {SECTION_TYPES.find(t => t.id === section.type)?.label || section.type}
            </h4>

            <label>Título de la Sección</label>
            <input type="text" value={s.title || ''} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.title = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px', marginBottom: '15px'}} />

            <label>Colección a Mostrar</label>
            <select value={s.collection || ''} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.collection = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px', marginBottom: '15px'}}>
              <option value="">-- Seleccionar Colección --</option>
              {collections?.map(col => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
            
            {section.type === 'flash_sales' && (
              <>
                <label>Fecha y Hora de Término</label>
                <input 
                  type="datetime-local" 
                  value={s.endTime ? new Date(s.endTime).toISOString().slice(0, 16) : ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.endTime = new Date(e.target.value).toISOString();
                    updateSectionsDraft(newSections);
                  }} 
                  style={{width: '100%', padding: '6px', marginBottom: '15px'}} 
                />
              </>
            )}

            <BackgroundStylesControl 
              settings={s} 
              onChange={(key, value) => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings[key] = value;
                updateSectionsDraft(newSections);
              }} 
            />

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Padding Superior</label>
                <input type="text" placeholder="Ej: 2rem" value={s.paddingTop || '2rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingTop = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
              <div style={{flex: 1}}>
                <label>Padding Inferior</label>
                <input type="text" placeholder="Ej: 2rem" value={s.paddingBottom || '2rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingBottom = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
            </div>
          </div>
        );
      }

      if (section.type === 'hero_carousel') {
        const s = section.settings || {};
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>
              Editando: Carrusel Principal (Slider)
            </h4>

            <label>Velocidad de Autoplay (ms)</label>
            <input 
              type="number" 
              value={s.autoPlaySpeed || 5000} 
              onChange={e => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings.autoPlaySpeed = Number(e.target.value);
                updateSectionsDraft(newSections);
              }}
              min="1000"
              step="500"
              style={{width: '100%', padding: '8px', marginBottom: '15px'}}
            />

            <h5 style={{marginBottom: '10px', marginTop: '10px'}}>Slides</h5>
            {(s.slides || []).map((slide, slideIndex) => (
              <div key={slideIndex} style={{background: '#f9f9f9', padding: '10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #eee'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                  <strong>Slide {slideIndex + 1}</strong>
                  <button 
                    onClick={() => {
                      const newSections = [...storeConfigDraft.sections];
                      newSections[dynamicSectionIndex].settings.slides.splice(slideIndex, 1);
                      updateSectionsDraft(newSections);
                    }}
                    style={{background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '1.2rem'}}
                  ><Trash2 size={16} strokeWidth={1.5} /></button>
                </div>

                <label>URL de la Imagen</label>
                <input 
                  type="text" 
                  placeholder="https://..."
                  value={slide.imageUrl || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.slides[slideIndex].imageUrl = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />

                <label>Enlace de Destino (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ej: /tienda"
                  value={slide.link || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.slides[slideIndex].link = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />
                
                <label>Texto Alternativo (Alt)</label>
                <input 
                  type="text" 
                  value={slide.alt || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.slides[slideIndex].alt = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />
              </div>
            ))}

            <button 
              onClick={() => {
                const newSections = [...storeConfigDraft.sections];
                if (!newSections[dynamicSectionIndex].settings.slides) {
                  newSections[dynamicSectionIndex].settings.slides = [];
                }
                newSections[dynamicSectionIndex].settings.slides.push({ imageUrl: '', link: '', alt: '' });
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', border: '1px dashed #ccc', background: 'transparent', padding: '10px', borderRadius: '6px', cursor: 'pointer', marginBottom: '15px'}}
            ><Plus size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Añadir Slide</button>

            <BackgroundStylesControl 
              settings={s} 
              onChange={(key, value) => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings[key] = value;
                updateSectionsDraft(newSections);
              }} 
            />

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Padding Superior</label>
                <input type="text" placeholder="Ej: 0rem" value={s.paddingTop || '0rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingTop = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
              <div style={{flex: 1}}>
                <label>Padding Inferior</label>
                <input type="text" placeholder="Ej: 0rem" value={s.paddingBottom || '0rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingBottom = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
            </div>
          </div>
        );
      }

      if (section.type === 'trust_badges') {
        const s = section.settings || {};
        const availableIcons = ['truck', 'shield', 'clock', 'credit_card', 'return', 'heart', 'star', 'check'];
        return (
          <div className={styles.formGroup}>
            <button className={styles.backBtn} onClick={() => closeEditor()}>
              <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
            </button>
            <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>
              Editando: Íconos de Confianza (Badges)
            </h4>

            <h5 style={{marginBottom: '10px', marginTop: '10px'}}>Insignias</h5>
            {(s.badges || []).map((badge, badgeIndex) => (
              <div key={badgeIndex} style={{background: '#f9f9f9', padding: '10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #eee'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                  <strong>Insignia {badgeIndex + 1}</strong>
                  <button 
                    onClick={() => {
                      const newSections = [...storeConfigDraft.sections];
                      newSections[dynamicSectionIndex].settings.badges.splice(badgeIndex, 1);
                      updateSectionsDraft(newSections);
                    }}
                    style={{background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '1.2rem'}}
                  ><Trash2 size={16} strokeWidth={1.5} /></button>
                </div>

                <label>Ícono</label>
                <select 
                  value={badge.icon || 'check'} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.badges[badgeIndex].icon = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                >
                  {availableIcons.map(icon => <option key={icon} value={icon}>{icon}</option>)}
                </select>

                <label>Texto Corto</label>
                <input 
                  type="text" 
                  value={badge.text || ''} 
                  onChange={e => {
                    const newSections = [...storeConfigDraft.sections];
                    newSections[dynamicSectionIndex].settings.badges[badgeIndex].text = e.target.value;
                    updateSectionsDraft(newSections);
                  }}
                  style={{width: '100%', padding: '6px', marginBottom: '10px'}}
                />
              </div>
            ))}

            <button 
              onClick={() => {
                const newSections = [...storeConfigDraft.sections];
                if (!newSections[dynamicSectionIndex].settings.badges) {
                  newSections[dynamicSectionIndex].settings.badges = [];
                }
                newSections[dynamicSectionIndex].settings.badges.push({ icon: 'check', text: 'Nueva Insignia' });
                updateSectionsDraft(newSections);
              }}
              style={{width: '100%', border: '1px dashed #ccc', background: 'transparent', padding: '10px', borderRadius: '6px', cursor: 'pointer', marginBottom: '15px'}}
            ><Plus size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Añadir Insignia</button>

            <BackgroundStylesControl 
              settings={s} 
              onChange={(key, value) => {
                const newSections = [...storeConfigDraft.sections];
                newSections[dynamicSectionIndex].settings[key] = value;
                updateSectionsDraft(newSections);
              }} 
            />

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={{flex: 1}}>
                <label>Padding Superior</label>
                <input type="text" placeholder="Ej: 2rem" value={s.paddingTop || '2rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingTop = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
              <div style={{flex: 1}}>
                <label>Padding Inferior</label>
                <input type="text" placeholder="Ej: 2rem" value={s.paddingBottom || '2rem'} onChange={e => { const newSections = [...storeConfigDraft.sections]; newSections[dynamicSectionIndex].settings.paddingBottom = e.target.value; updateSectionsDraft(newSections); }} style={{width: '100%', padding: '6px'}} />
              </div>
            </div>
          </div>
        );
      }

      // Para editar un modulo dinamico generico
      return (

        <div className={styles.formGroup}>
          <button className={styles.backBtn} onClick={() => closeEditor()}>
            <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
          </button>
          <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>
            Editando: {SECTION_TYPES.find(t => t.id === section.type)?.label || section.type}
          </h4>
          
          <label>Título / Encabezado</label>
          <input 
            type="text" 
            value={section.settings?.title || section.settings?.heading || ''} 
            onChange={e => {
              const newSections = [...storeConfigDraft.sections];
              const fieldToUpdate = newSections[dynamicSectionIndex].settings.title !== undefined ? 'title' : 'heading';
              newSections[dynamicSectionIndex].settings = { ...newSections[dynamicSectionIndex].settings, [fieldToUpdate]: e.target.value };
              updateSectionsDraft(newSections);
            }} 
          />
          <p style={{fontSize: '0.8rem', color: '#666', marginTop: '10px'}}>
            Nota: Para editar configuraciones más avanzadas de este módulo, actualmente requiere edición directa. 
            El Page Builder soporta reordenamiento y eliminación de módulos para esta página.
          </p>
        </div>
      );
    }

    if (activeSection === 'heroBanner') {
      const draft = storeConfigDraft?.heroBanner || {};
      return (
        <div className={styles.formGroup}>
          <label>Tipo de Medio</label>
          <select value={draft.mediaType || 'image'} onChange={e => updateDraft('heroBanner', { mediaType: e.target.value })}>
            <option value="image">Imagen Estática</option>
            <option value="gif">GIF Animado</option>
            <option value="video">Video (Autoplay)</option>
          </select>
          
          <label>URL del Medio</label>
          <input type="text" value={draft.mediaUrl || ''} onChange={e => updateDraft('heroBanner', { mediaUrl: e.target.value })} />
          
          <label>Título</label>
          <input type="text" value={draft.title || ''} onChange={e => updateDraft('heroBanner', { title: e.target.value })} />
          
          <label>Subtítulo</label>
          <input type="text" value={draft.subtitle || ''} onChange={e => updateDraft('heroBanner', { subtitle: e.target.value })} />
          
          <label>Texto Botón</label>
          <input type="text" value={draft.buttonText || ''} onChange={e => updateDraft('heroBanner', { buttonText: e.target.value })} />
          
          <label>Enlace Botón</label>
          <input type="text" value={draft.buttonLink || ''} onChange={e => updateDraft('heroBanner', { buttonLink: e.target.value })} />
        </div>
      );
    }

    if (activeSection === 'layout') {
      const draft = storeConfigDraft?.layout || {};
      return (
        <div className={styles.formGroup}>
          <label>Columnas en Escritorio</label>
          <select value={draft.productGridColumnsDesktop || 'auto'} onChange={e => updateDraft('layout', { productGridColumnsDesktop: e.target.value === 'auto' ? 'auto' : Number(e.target.value) })}>
            <option value="auto">Adaptable (Llenar espacio)</option>
            <option value="3">3 Columnas</option>
            <option value="4">4 Columnas</option>
            <option value="5">5 Columnas</option>
          </select>

          <label>Columnas en Móvil</label>
          <select value={draft.productGridColumnsMobile || 2} onChange={e => updateDraft('layout', { productGridColumnsMobile: Number(e.target.value) })}>
            <option value="1">1 Columna</option>
            <option value="2">2 Columnas</option>
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1rem' }}>
            <input 
              type="checkbox" 
              checked={draft.showHoverSecondaryMedia ?? true} 
              onChange={e => updateDraft('layout', { showHoverSecondaryMedia: e.target.checked })}
              style={{ width: 'auto', marginBottom: 0 }}
            />
            Media Swap al hacer hover
          </label>
        </div>
      );
    }

    if (activeSection === 'header') {
      const draft = storeConfigDraft?.header || {};
      const navLinks = draft.navLinks || [
        { id: '1', text: 'Tienda', type: 'dropdown', url: '/tienda', isCategoryAuto: true },
        { id: '2', text: 'Crear', type: 'link', url: '/personalizar' }
      ];

      return (
        <HeaderEditor 
          navLinks={navLinks} 
          onChange={(newLinks) => updateDraft('header', { navLinks: newLinks })} 
        />
      );
    }

    if (activeSection === 'accountPopup') {
      const draft = storeConfigDraft?.accountPopup || {
        title: 'Mi cuenta',
        description: 'Inicia sesión o crea una cuenta para ver tu perfil, pedidos y creaciones.',
        loginButtonText: 'Iniciar sesión',
        loginButtonUrl: '/login',
        registerButtonText: 'Crear cuenta',
        registerButtonUrl: '/registro',
        brands: [
          { id: 'add-btn', name: 'Añadir Marca', imageUrl: 'https://cdn-icons-png.flaticon.com/512/1237/1237946.png', url: '#' }
        ]
      };

      return (
        <AccountPopupEditor 
          config={draft} 
          onChange={(newConfig) => updateDraft('accountPopup', newConfig)} 
        />
      );
    }

    if (activeSection === 'favoritesPopup') {
      const draft = storeConfigDraft?.favoritesPopup || {
        loggedOutTitle: 'Tus Favoritos',
        loggedOutText: 'Aún no tienes artículos guardados. Inicia sesión para crear tu lista de deseos.',
        loggedInTitle: 'Tus Favoritos',
        loggedInText: 'Aún no has marcado nada como favorito.',
        buttonText: 'Mira lo que te puede interesar',
        buttonLink: '/tienda',
        fontFamily: '',
        fontSize: '14px',
        color: '#666666',
        bold: false,
        italic: false
      };

      return (
        <div className={styles.formGroup}>
          <button className={styles.backBtn} onClick={() => closeEditor()}>
            <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a los Módulos
          </button>
          <h4 style={{marginTop: '1rem', marginBottom: '1rem'}}>
            Editando: Pop-up de Favoritos
          </h4>

          <h5 style={{marginTop: '1rem'}}>Estado: Sin sesión iniciada</h5>
          <label>Título</label>
          <input type="text" value={draft.loggedOutTitle || ''} onChange={e => updateDraft('favoritesPopup', { loggedOutTitle: e.target.value })} />
          <label>Texto Informativo</label>
          <textarea value={draft.loggedOutText || ''} onChange={e => updateDraft('favoritesPopup', { loggedOutText: e.target.value })} style={{width: '100%', minHeight: '60px', padding: '8px'}} />

          <h5 style={{marginTop: '1.5rem'}}>Estado: Sesión iniciada</h5>
          <label>Título</label>
          <input type="text" value={draft.loggedInTitle || ''} onChange={e => updateDraft('favoritesPopup', { loggedInTitle: e.target.value })} />
          <label>Texto Informativo</label>
          <textarea value={draft.loggedInText || ''} onChange={e => updateDraft('favoritesPopup', { loggedInText: e.target.value })} style={{width: '100%', minHeight: '60px', padding: '8px'}} />

          <h5 style={{marginTop: '1.5rem'}}>Botón (Sesión iniciada)</h5>
          <label>Texto del Botón</label>
          <input type="text" value={draft.buttonText || ''} onChange={e => updateDraft('favoritesPopup', { buttonText: e.target.value })} />
          <label>URL Destino</label>
          <input type="text" value={draft.buttonLink || ''} onChange={e => updateDraft('favoritesPopup', { buttonLink: e.target.value })} />

          <h5 style={{marginTop: '1.5rem'}}>Estilos del Texto Informativo</h5>
          <div style={{display: 'flex', gap: '10px'}}>
            <div style={{flex: 1}}>
              <label>Tipografía</label>
              <select value={draft.fontFamily || ''} onChange={e => updateDraft('favoritesPopup', { fontFamily: e.target.value })} style={{width: '100%', padding: '6px'}}>
                <option value="">Por defecto</option>
                <option value="'Inter', sans-serif">Inter</option>
                <option value="'Outfit', sans-serif">Outfit</option>
                <option value="'Montserrat', sans-serif">Montserrat</option>
              </select>
            </div>
            <div style={{flex: 1}}>
              <label>Tamaño (ej: 14px)</label>
              <input type="text" value={draft.fontSize || ''} onChange={e => updateDraft('favoritesPopup', { fontSize: e.target.value })} />
            </div>
          </div>
          <label>Color</label>
          <input type="color" value={draft.color || '#666666'} onChange={e => updateDraft('favoritesPopup', { color: e.target.value })} style={{width: '100%', height: '40px', padding: 0, marginBottom: '10px'}} />
          <div style={{display: 'flex', gap: '10px'}}>
            <label style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
              <input type="checkbox" checked={draft.bold || false} onChange={e => updateDraft('favoritesPopup', { bold: e.target.checked })} style={{margin: 0}} />
              Negrita
            </label>
            <label style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
              <input type="checkbox" checked={draft.italic || false} onChange={e => updateDraft('favoritesPopup', { italic: e.target.checked })} style={{margin: 0}} />
              Cursiva
            </label>
          </div>
        </div>
      );
    }

    return <p>Sección desconocida.</p>;
  };

  return (
    <div 
      className={`${styles.panelWrapper} ${styles[editorPosition]}`}
      style={editorPosition === 'floating' ? { top: `${position.y}px`, right: 'auto', left: `${position.x}px` } : {}}
    >
      <div 
        className={styles.header}
        onMouseDown={handleMouseDown}
        style={{ cursor: editorPosition === 'floating' ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <h3 style={{ pointerEvents: 'none' }}>{activeSection ? `Editando: ${activeSection}` : 'Page Builder (Layout)'}</h3>
        <div className={styles.controls}>
          <button onClick={() => setEditorPosition('left')} title="Anclar a la Izquierda"><PanelLeft size={16} strokeWidth={1.5} /></button>
          <button onClick={() => setEditorPosition('floating')} title="Modo Flotante"><Monitor size={16} strokeWidth={1.5} /></button>
          <button onClick={() => setEditorPosition('right')} title="Anclar a la Derecha"><PanelRight size={16} strokeWidth={1.5} /></button>
        </div>
      </div>
      
      <div className={styles.body}>
        {renderForm()}
      </div>

      <div className={styles.footer}>
        <Button variant="primary" onClick={handleSave} disabled={isSaving} style={{ width: '100%' }}>
          {isSaving ? 'Guardando...' : 'Guardar y Publicar'}
        </Button>
      </div>
    </div>
  );
};

// Componente auxiliar para editar el Header
const HeaderEditor = ({ navLinks, onChange }) => {
  const [activeIndex, setActiveIndex] = React.useState(null);
  const { data: collections } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const { data } = await getCollections();
      return data || [];
    }
  });

  const updateLink = (index, updates) => {
    const newLinks = [...navLinks];
    newLinks[index] = { ...newLinks[index], ...updates };
    onChange(newLinks);
  };

  const addLink = () => {
    onChange([...navLinks, { id: Date.now().toString(), text: 'Nuevo Enlace', type: 'link', url: '/' }]);
  };

  const removeLink = (index) => {
    onChange(navLinks.filter((_, i) => i !== index));
  };

  if (activeIndex === null) {
    return (
      <div className={styles.headerEditor}>
        <p style={{fontSize: '0.85rem', color: '#666', marginBottom: '10px'}}>Selecciona un botón para personalizar sus estilos, enlaces y comportamiento.</p>
        {navLinks.map((link, index) => (
          <div key={link.id} className={styles.linkSummaryBox} onClick={() => setActiveIndex(index)}>
            <span style={{ fontWeight: link.bold ? 'bold' : 'normal', fontStyle: link.italic ? 'italic' : 'normal', fontFamily: link.fontFamily }}>
              {link.text}
            </span>
            <div className={styles.linkSummaryActions}>
              <span className={styles.editIcon}><Settings2 size={16} strokeWidth={1.5} /></span>
              <button 
                onClick={(e) => { e.stopPropagation(); removeLink(index); }} 
                className={styles.removeBtn}
                title="Eliminar botón"
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={addLink} style={{width: '100%', marginTop: '1rem', borderStyle: 'dashed'}}>
          <Plus size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Añadir Nuevo Botón
        </Button>
      </div>
    );
  }

  const link = navLinks[activeIndex];
  if (!link) {
    setActiveIndex(null);
    return null;
  }

  return (
    <div className={styles.headerEditor}>
      <button className={styles.backBtn} onClick={() => setActiveIndex(null)}>
        <ArrowLeft size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Volver a la lista
      </button>

      <div className={styles.linkEditorBox}>
        <h4 style={{margin: '0 0 15px 0', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>
          Editando: {link.text}
        </h4>

        <label>Texto del Botón</label>
        <input 
          type="text" 
          value={link.text} 
          onChange={e => updateLink(activeIndex, { text: e.target.value })}
          style={{marginBottom: '10px', width: '100%', padding: '8px'}}
        />

        <div className={styles.styleControls}>
          <div className={styles.formGroup} style={{flex: 1}}>
            <label>Color</label>
            <input 
              type="color" 
              value={link.color || '#000000'} 
              onChange={e => updateLink(activeIndex, { color: e.target.value })}
              style={{width: '100%', height: '35px', padding: '0', cursor: 'pointer'}}
            />
          </div>
          
          <div className={styles.formGroup} style={{flex: 2}}>
            <label>Tipografía</label>
            <select 
              value={link.fontFamily || ''} 
              onChange={e => updateLink(activeIndex, { fontFamily: e.target.value })}
            >
              <option value="">Por defecto</option>
              <option value="'Inter', sans-serif">Inter</option>
              <option value="'Outfit', sans-serif">Outfit</option>
              <option value="'Roboto', sans-serif">Roboto</option>
              <option value="'Montserrat', sans-serif">Montserrat</option>
            </select>
          </div>
        </div>

        <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
          <label style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
            <input 
              type="checkbox" 
              checked={link.bold || false} 
              onChange={e => updateLink(activeIndex, { bold: e.target.checked })}
              style={{margin: 0}}
            />
            <b>Negrita</b>
          </label>
          <label style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
            <input 
              type="checkbox" 
              checked={link.italic || false} 
              onChange={e => updateLink(activeIndex, { italic: e.target.checked })}
              style={{margin: 0}}
            />
            <i>Cursiva</i>
          </label>
        </div>

        <label>Comportamiento</label>
        <select 
          value={link.type} 
          onChange={e => updateLink(activeIndex, { type: e.target.value })}
          className={styles.typeSelect}
          style={{width: '100%', padding: '8px', marginBottom: '10px'}}
        >
          <option value="link">Enlace Simple (Al hacer click va a una página)</option>
          <option value="dropdown">Desplegable (Al pasar el ratón muestra más opciones)</option>
        </select>

        {link.type === 'link' && (
          <div className={styles.formGroup}>
            <label>URL de Destino</label>
            <input 
              type="text" 
              placeholder="Ej: /tienda"
              value={link.url || ''} 
              onChange={e => updateLink(activeIndex, { url: e.target.value })}
              style={{width: '100%', padding: '8px'}}
            />
          </div>
        )}

        {link.type === 'dropdown' && (
          <div className={styles.dropdownOptions} style={{background: '#f9f9f9', padding: '10px', borderRadius: '6px', marginTop: '10px'}}>
            <div className={styles.formGroup}>
              <label>URL Principal del Botón</label>
              <input 
                type="text" 
                placeholder="Ej: /tienda"
                value={link.url || ''} 
                onChange={e => updateLink(activeIndex, { url: e.target.value })}
                style={{width: '100%', padding: '8px', marginBottom: '10px'}}
              />
            </div>

            <label style={{display: 'flex', gap: '8px', fontSize: '0.9rem', marginBottom: '10px', fontWeight: 'bold'}}>
              <input 
                type="checkbox" 
                checked={link.isCategoryAuto || false} 
                onChange={e => updateLink(activeIndex, { isCategoryAuto: e.target.checked, autoCollectionId: null })}
                style={{margin: 0}}
              />
              Auto-rellenar con mis Categorías
            </label>

            {!link.isCategoryAuto && (
              <div className={styles.formGroup} style={{marginBottom: '10px'}}>
                <label style={{fontSize: '0.85rem'}}>O enlazar a una Colección para mostrar sus Categorías (Ej: Anime):</label>
                <select 
                  value={link.autoCollectionId || ''} 
                  onChange={e => updateLink(activeIndex, { autoCollectionId: e.target.value, dropdownLinks: [] })}
                  style={{width: '100%', padding: '6px'}}
                >
                  <option value="">-- No enlazar (Configurar sub-enlaces manualmente) --</option>
                  {collections?.map(col => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              </div>
            )}

            {!link.isCategoryAuto && !link.autoCollectionId && (
              <div className={styles.manualLinksArea}>
                <p style={{fontSize: '0.85rem', fontWeight: 'bold', margin: '10px 0 5px'}}>Sub-enlaces Manuales:</p>
                {(link.dropdownLinks || []).map((subLink, subIndex) => (
                  <div key={subLink.id} style={{display: 'flex', gap: '5px', marginBottom: '8px'}}>
                    <input 
                      type="text" 
                      placeholder="Texto"
                      value={subLink.text} 
                      onChange={e => {
                        const newSubLinks = [...link.dropdownLinks];
                        newSubLinks[subIndex].text = e.target.value;
                        updateLink(activeIndex, { dropdownLinks: newSubLinks });
                      }}
                      style={{width: '40%', padding: '6px'}}
                    />
                    <input 
                      type="text" 
                      placeholder="URL (/ruta)"
                      value={subLink.url} 
                      onChange={e => {
                        const newSubLinks = [...link.dropdownLinks];
                        newSubLinks[subIndex].url = e.target.value;
                        updateLink(activeIndex, { dropdownLinks: newSubLinks });
                      }}
                      style={{width: '50%', padding: '6px'}}
                    />
                    <button 
                      onClick={() => {
                        updateLink(activeIndex, { dropdownLinks: link.dropdownLinks.filter((_, i) => i !== subIndex) });
                      }}
                      style={{width: '10%', background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '1.2rem'}}
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    const currentSubs = link.dropdownLinks || [];
                    updateLink(activeIndex, { dropdownLinks: [...currentSubs, { id: Date.now().toString(), text: 'Nuevo', url: '/' }] });
                  }}
                  style={{fontSize: '0.8rem', padding: '0.4rem 0.8rem', marginTop: '5px'}}
                >
                  <Plus size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Añadir sub-enlace
                </Button>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};

// Componente auxiliar para editar el Account Popup
const AccountPopupEditor = ({ config, onChange }) => {
  const updateField = (field, value) => {
    onChange({ ...config, [field]: value });
  };

  const updateBrand = (index, updates) => {
    const newBrands = [...config.brands];
    newBrands[index] = { ...newBrands[index], ...updates };
    updateField('brands', newBrands);
  };

  const addBrand = () => {
    const newBrands = [...(config.brands || []), { id: Date.now().toString(), name: 'Nueva Marca', imageUrl: '', url: '#' }];
    updateField('brands', newBrands);
  };

  const removeBrand = (index) => {
    const newBrands = (config.brands || []).filter((_, i) => i !== index);
    updateField('brands', newBrands);
  };

  return (
    <div className={styles.headerEditor}>
      <label>Título del Pop-up</label>
      <input 
        type="text" 
        value={config.title || ''} 
        onChange={e => updateField('title', e.target.value)}
        style={{marginBottom: '10px', width: '100%', padding: '8px'}}
      />

      <label>Descripción</label>
      <textarea 
        value={config.description || ''} 
        onChange={e => updateField('description', e.target.value)}
        style={{marginBottom: '15px', width: '100%', padding: '8px', minHeight: '60px', fontFamily: 'inherit'}}
      />

      <h4 style={{margin: '0 0 10px 0', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Botón Primario (Iniciar Sesión)</h4>
      <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
        <div className={styles.formGroup} style={{flex: 1}}>
          <label>Texto</label>
          <input 
            type="text" 
            value={config.loginButtonText || ''} 
            onChange={e => updateField('loginButtonText', e.target.value)}
            style={{width: '100%', padding: '6px'}}
          />
        </div>
        <div className={styles.formGroup} style={{flex: 1}}>
          <label>URL</label>
          <input 
            type="text" 
            value={config.loginButtonUrl || ''} 
            onChange={e => updateField('loginButtonUrl', e.target.value)}
            style={{width: '100%', padding: '6px'}}
          />
        </div>
      </div>

      <h4 style={{margin: '0 0 10px 0', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Botón Secundario (Crear Cuenta)</h4>
      <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
        <div className={styles.formGroup} style={{flex: 1}}>
          <label>Texto</label>
          <input 
            type="text" 
            value={config.registerButtonText || ''} 
            onChange={e => updateField('registerButtonText', e.target.value)}
            style={{width: '100%', padding: '6px'}}
          />
        </div>
        <div className={styles.formGroup} style={{flex: 1}}>
          <label>URL</label>
          <input 
            type="text" 
            value={config.registerButtonUrl || ''} 
            onChange={e => updateField('registerButtonUrl', e.target.value)}
            style={{width: '100%', padding: '6px'}}
          />
        </div>
      </div>

      <h4 style={{margin: '0 0 10px 0', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Nuestras Marcas</h4>
      
      {(config.brands || []).map((brand, index) => (
        <div key={brand.id} className={styles.linkEditorBox} style={{marginBottom: '10px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
            <strong>Marca {index + 1}</strong>
            <button 
              onClick={() => removeBrand(index)} 
              className={styles.removeBtn}
              style={{background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '1.2rem'}}
              title="Eliminar marca"
            ><Trash2 size={16} strokeWidth={1.5} /></button>
          </div>
          
          <div className={styles.formGroup}>
            <label>Nombre (Texto alternativo)</label>
            <input 
              type="text" 
              value={brand.name || ''} 
              onChange={e => updateBrand(index, { name: e.target.value })}
              style={{width: '100%', padding: '6px'}}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>URL de la Imagen (Circular)</label>
            <input 
              type="text" 
              placeholder="Ej: https://.../logo.png"
              value={brand.imageUrl || ''} 
              onChange={e => updateBrand(index, { imageUrl: e.target.value })}
              style={{width: '100%', padding: '6px'}}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Enlace de Destino</label>
            <input 
              type="text" 
              placeholder="Ej: /coleccion/marca"
              value={brand.url || ''} 
              onChange={e => updateBrand(index, { url: e.target.value })}
              style={{width: '100%', padding: '6px'}}
            />
          </div>
        </div>
      ))}

      <Button variant="secondary" onClick={addBrand} style={{width: '100%', borderStyle: 'dashed'}}>
        <Plus size={16} strokeWidth={1.5} style={{marginRight: 6}} /> Añadir Marca / Botón
      </Button>
    </div>
  );
};

export default VisualEditorPanel;
