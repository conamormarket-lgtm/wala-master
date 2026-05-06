import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStorefrontConfig } from '../../../pages/Tienda/services/storefront';
import { useVisualEditor } from '../../../pages/Tienda/contexts/VisualEditorContext';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import styles from './Footer.module.css';

// Importamos algunos de los bloques que pueden renderizarse en el footer
// Para simplificar, implementaremos el renderizado directamente o reutilizaremos componentes
import OptimizedImage from '../OptimizedImage/OptimizedImage';

const Footer = () => {
  const location = useLocation();
  const { isEditModeActive, activePageId, setActivePageId, storeConfigDraft, updateSectionsDraft, activeSection, openEditorForSection } = useVisualEditor();
  const { isFooterVisible } = useLayoutContext();

  // Buscar la configuración del footer
  const { data: footerConfig, isLoading } = useQuery({
    queryKey: ['storefront-config', 'footer'],
    queryFn: async () => {
      const { sections, error } = await getStorefrontConfig('footer');
      if (error) throw new Error(error);
      return { sections: sections ?? [] };
    },
    staleTime: 10 * 60 * 1000,
  });

  if (!isFooterVisible) return null;

  const isEditingFooter = activePageId === 'footer';
  let displaySections = isEditingFooter ? (storeConfigDraft?.sections || []) : (footerConfig?.sections || []);

  const handleEditFooter = () => {
    setActivePageId('footer');
  };

  // Renderizador simple para los módulos del footer
  const renderSection = (section, index) => {
    const s = section.settings || {};
    
    // Si queremos que el usuario pueda insertar el nuevo módulo "+" aquí
    const ModuleInserter = ({ idx }) => {
      const [isOpen, setIsOpen] = useState(false);
      if (!isEditModeActive || !isEditingFooter) return null;
      
      const handleInsert = (type) => {
        const { getDefaultSettings } = require('../../../pages/Tienda/services/storefront');
        const newSections = [...displaySections];
        newSections.splice(idx, 0, {
          id: `section_${Date.now()}`,
          type,
          order: idx,
          settings: getDefaultSettings(type)
        });
        newSections.forEach((s, i) => s.order = i);
        updateSectionsDraft(newSections);
        setIsOpen(false);
      };

      return (
        <div style={{ position: 'relative', width: '100%', height: '20px', margin: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '2px', backgroundColor: '#8b5cf6', transform: 'translateY(-50%)', zIndex: 1 }}></div>
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center' }}>
            <button 
              onClick={() => setIsOpen(!isOpen)}
              style={{ backgroundColor: '#8b5cf6', color: 'white', width: '32px', height: '32px', borderRadius: '50%', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
            >+</button>
            {isOpen && (
              <div style={{ display: 'block', position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: 'white', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: '10px', width: 'max-content', marginTop: '10px', border: '1px solid #eee' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#666', fontWeight: 600, textAlign: 'center' }}>Insertar módulo:</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button onClick={() => handleInsert('footer_columns')} style={{ padding: '8px', cursor: 'pointer' }}>Columnas (Enlaces)</button>
                  <button onClick={() => handleInsert('text')} style={{ padding: '8px', cursor: 'pointer' }}>Texto</button>
                  <button onClick={() => handleInsert('image')} style={{ padding: '8px', cursor: 'pointer' }}>Imagen</button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    };

    let content = null;
    
    switch (section.type) {
      case 'footer_columns':
        content = (
          <div className={styles.content}>
            {(s.columns || []).map((col, i) => (
              <div key={col.id || i} className={styles.section}>
                {col.title && <h4>{col.title}</h4>}
                {col.type === 'text' && <p>{col.content}</p>}
                {col.type === 'links' && (
                  <ul>
                    {(col.links || []).map((link, j) => {
                      const linkStyle = {
                        color: link.color || 'inherit',
                        fontWeight: link.bold ? 'bold' : 'normal',
                        textDecoration: 'none' // Para asegurar que el color se note sin el subrayado por defecto
                      };
                      return (
                      <li key={j}>
                        {link.url?.startsWith('http') ? (
                          <a href={link.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>{link.text}</a>
                        ) : (
                          <Link to={link.url || '#'} style={linkStyle}>{link.text}</Link>
                        )}
                      </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        );
        break;
      case 'text':
        content = (
          <div style={{ textAlign: 'center', margin: '2rem 0', color: 'white' }}>
            {s.heading && <h3 style={{ marginBottom: '1rem' }}>{s.heading}</h3>}
            {s.content && <p>{s.content}</p>}
          </div>
        );
        break;
      case 'image':
        if (!s.url?.trim()) break;
        content = (
          <div style={{ textAlign: 'center', margin: '2rem 0' }}>
            <img src={s.url} alt={s.alt} style={{ maxWidth: '100%', height: 'auto', maxHeight: '200px' }} />
          </div>
        );
        break;
      default:
        content = null;
    }

    const isActive = activeSection === section.id;
    const isEditingThisSection = isEditModeActive && isEditingFooter && section.type !== 'dummy';

    return (
      <React.Fragment key={section.id}>
        <ModuleInserter idx={index} />
        {isEditingThisSection ? (
          <div 
            style={{ 
              position: 'relative', 
              outline: isActive ? '2px solid #8b5cf6' : '1px dashed rgba(139, 92, 246, 0.5)',
              cursor: 'pointer',
              padding: '10px',
              borderRadius: '8px'
            }}
            onClick={(e) => {
              e.stopPropagation();
              openEditorForSection(section.id, storeConfigDraft);
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isActive ? 'rgba(139, 92, 246, 0.05)' : 'transparent',
              zIndex: 1,
              borderRadius: '8px'
            }} />
            <div style={{ position: 'relative', zIndex: 2 }}>
              {content}
            </div>
          </div>
        ) : (
          content
        )}
      </React.Fragment>
    );
  };

  // Default fallback si no hay config
  if (!isLoading && displaySections.length === 0) {
    displaySections = [
      {
        id: 'default_footer',
        type: 'footer_columns',
        order: 0,
        settings: {
          columns: [
            { id: 'c1', title: 'Walá', content: 'Prendas personalizadas con amor y dedicación', type: 'text' },
            { id: 'c2', title: 'Enlaces', type: 'links', links: [
              { text: 'Tienda', url: '/tienda' },
              { text: 'Crear', url: '/personalizar' },
              { text: 'Mi cuenta', url: '/cuenta' },
              { text: 'Contacto WhatsApp', url: 'https://wa.me/51912881722' },
              { text: 'Políticas de Privacidad', url: '/politicas-privacidad' },
              { text: 'Términos y Condiciones', url: '/terminos-y-condiciones' }
            ]}
          ]
        }
      }
    ];
  }

  const pageId = location.pathname === '/' || location.pathname === '/home' ? 'home' : 
                 location.pathname.replace(/^\/+/, '').split('/')[0] || 'home';

  return (
    <footer id="site-footer" className={styles.footer} style={{ position: 'relative' }}>
      {isEditModeActive && !isEditingFooter && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, backdropFilter: 'blur(2px)' }}>
          <button 
            onClick={handleEditFooter}
            style={{ padding: '12px 24px', fontSize: '1.1rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontWeight: 'bold' }}
          >
            ✏️ Editar Pie de Página
          </button>
        </div>
      )}

      {isEditModeActive && isEditingFooter && (
        <div style={{ background: '#8b5cf6', color: 'white', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
          Estás editando el Pie de Página Global
          <button 
            onClick={() => setActivePageId(pageId)}
            style={{ marginLeft: '15px', padding: '4px 10px', borderRadius: '4px', border: '1px solid white', background: 'transparent', color: 'white', cursor: 'pointer' }}
          >
            Volver al Cuerpo
          </button>
        </div>
      )}

      <div className={styles.container}>
        {displaySections.map((section, index) => renderSection(section, index))}
        
        {/* ModuleInserter al final */}
        {isEditModeActive && isEditingFooter && renderSection({ id: 'dummy_inserter', type: 'dummy' }, displaySections.length)}

        <div className={styles.copyright} style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p>&copy; {new Date().getFullYear()} Walá. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
