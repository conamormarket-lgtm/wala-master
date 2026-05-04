import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEditor } from '../../../contexts/EditorContext';
import { useAuth } from '../../../contexts/AuthContext';
import { EDITOR_FONTS, FONT_WEIGHT_NORMAL, FONT_WEIGHT_BOLD, FONT_STYLE_NORMAL, FONT_STYLE_ITALIC } from '../../../constants/fonts';
import { getFonts, createFont } from '../../../services/fonts';
import styles from './TextEditor.module.css';

const UPLOAD_FONT_VALUE = '__upload__';

function getFontFormatFromUrl(url) {
  if (!url) return 'truetype';
  const u = url.toLowerCase();
  if (u.includes('.woff2')) return 'woff2';
  if (u.includes('.woff')) return 'woff';
  if (u.includes('.otf')) return 'opentype';
  return 'truetype';
}

const TextEditor = ({ layerId }) => {
  const { layers, updateLayer } = useEditor();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const layer = layers.find(l => l.id === layerId);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFamily, setUploadFamily] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const { data: customFontsData = [] } = useQuery({
    queryKey: ['fonts'],
    queryFn: async () => {
      const { data, error } = await getFonts();
      if (error) return [];
      return data;
    }
  });
  const customFonts = React.useMemo(
    () => (Array.isArray(customFontsData) ? customFontsData : []),
    [customFontsData]
  );

  // Inyectar @font-face para fuentes personalizadas
  const styleId = 'custom-fonts-editor';
  useEffect(() => {
    let el = document.getElementById(styleId);
    if (customFonts.length === 0) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }
    const rules = customFonts
      .filter(f => f.url && (f.family || f.name))
      .map(f => {
        const family = (f.family || f.name).replace(/"/g, '\\"');
        const format = getFontFormatFromUrl(f.url);
        return `@font-face{font-family:"${family}";src:url("${f.url}") format("${format}");}`;
      })
      .join('');
    el.textContent = rules;
    return () => {
      const style = document.getElementById(styleId);
      if (style) style.remove();
    };
  }, [customFonts]);

  const handleFontChange = (e) => {
    const value = e.target.value;
    if (value === UPLOAD_FONT_VALUE) {
      setShowUploadModal(true);
      setUploadName('');
      setUploadFamily('');
      setUploadFile(null);
      setUploadError('');
      return;
    }
    updateLayer(layerId, { fontFamily: value });
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadName.trim()) {
      setUploadError('Nombre y archivo son obligatorios.');
      return;
    }
    setUploading(true);
    setUploadError('');
    const { error } = await createFont(uploadFile, uploadName.trim(), uploadFamily.trim() || undefined);
    setUploading(false);
    if (error) {
      setUploadError(error);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['fonts'] });
    const family = uploadFamily.trim() || uploadName.trim();
    updateLayer(layerId, { fontFamily: family });
    setShowUploadModal(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!layer || layer.type !== 'text') return null;

  const currentFontFamily = layer.fontFamily || 'Arial';
  const isBold = (layer.fontWeight || FONT_WEIGHT_NORMAL) === FONT_WEIGHT_BOLD;
  const isItalic = (layer.fontStyle || FONT_STYLE_NORMAL) === FONT_STYLE_ITALIC;
  const fontOptions = [
    ...EDITOR_FONTS.map(font => ({ value: font, label: font })),
    ...customFonts.map(f => ({ value: f.family || f.name, label: f.name })),
    ...(isAdmin ? [{ value: UPLOAD_FONT_VALUE, label: 'Subir tipografía...' }] : [])
  ];
  const selectValue = fontOptions.some(o => o.value === currentFontFamily && o.value !== UPLOAD_FONT_VALUE)
    ? currentFontFamily
    : (fontOptions.find(o => o.value !== UPLOAD_FONT_VALUE)?.value || 'Arial');

  return (
    <div className={styles.editor}>
      <div className={styles.field}>
        <label>Texto:</label>
        <input
          type="text"
          value={layer.text || ''}
          onChange={(e) => updateLayer(layerId, { text: e.target.value })}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label>Alineación:</label>
        <div className={styles.alignmentRow}>
          <button
            type="button"
            title="Izquierda"
            className={`${styles.alignmentBtn} ${(layer.textAlign || 'left') === 'left' ? styles.alignmentBtnActive : ''}`}
            onClick={() => updateLayer(layerId, { textAlign: 'left' })}
          >
            <svg width="20" height="16" viewBox="0 0 20 16" fill="currentColor" aria-hidden>
              <path d="M0 2h20v1.5H0V2zm0 5h14v1.5H0V7zm0 5h20v1.5H0V12z" />
            </svg>
          </button>
          <button
            type="button"
            title="Centro"
            className={`${styles.alignmentBtn} ${(layer.textAlign || 'left') === 'center' ? styles.alignmentBtnActive : ''}`}
            onClick={() => updateLayer(layerId, { textAlign: 'center' })}
          >
            <svg width="20" height="16" viewBox="0 0 20 16" fill="currentColor" aria-hidden>
              <path d="M3 2h14v1.5H3V2zm1 5h12v1.5H4V7zm3 5h6v1.5H7V12z" />
            </svg>
          </button>
          <button
            type="button"
            title="Derecha"
            className={`${styles.alignmentBtn} ${(layer.textAlign || 'left') === 'right' ? styles.alignmentBtnActive : ''}`}
            onClick={() => updateLayer(layerId, { textAlign: 'right' })}
          >
            <svg width="20" height="16" viewBox="0 0 20 16" fill="currentColor" aria-hidden>
              <path d="M0 2h20v1.5H0V2zm6 5h14v1.5H6V7zM0 12h20v1.5H0V12z" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.field}>
        <label>Fuente:</label>
        <select
          value={selectValue}
          onChange={handleFontChange}
          className={styles.select}
        >
          {fontOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label>Estilo:</label>
        <div className={styles.styleRow}>
          <button
            type="button"
            title="Negrita"
            className={`${styles.styleBtn} ${isBold ? styles.styleBtnActive : ''}`}
            onClick={() => updateLayer(layerId, { fontWeight: isBold ? FONT_WEIGHT_NORMAL : FONT_WEIGHT_BOLD })}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            title="Cursiva"
            className={`${styles.styleBtn} ${isItalic ? styles.styleBtnActive : ''}`}
            onClick={() => updateLayer(layerId, { fontStyle: isItalic ? FONT_STYLE_NORMAL : FONT_STYLE_ITALIC })}
          >
            <em>I</em>
          </button>
        </div>
      </div>

      <div className={styles.field}>
        <label>Tamaño (px):</label>
        <input
          type="number"
          min={8}
          max={200}
          value={layer.fontSize ?? 40}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isNaN(v)) updateLayer(layerId, { fontSize: Math.max(8, Math.min(200, v)) });
          }}
          className={styles.sizeInput}
        />
      </div>

      {showUploadModal && (
        <div className={styles.modalBackdrop} onClick={() => !uploading && setShowUploadModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h4 className={styles.modalTitle}>Subir tipografía</h4>
            <form onSubmit={handleUploadSubmit}>
              <div className={styles.field}>
                <label>Nombre para mostrar:</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  className={styles.input}
                  placeholder="Ej. Mi Fuente"
                />
              </div>
              <div className={styles.field}>
                <label>Nombre de familia (opcional):</label>
                <input
                  type="text"
                  value={uploadFamily}
                  onChange={e => setUploadFamily(e.target.value)}
                  className={styles.input}
                  placeholder="Para font-family en CSS"
                />
              </div>
              <div className={styles.field}>
                <label>Archivo (.ttf, .otf, .woff, .woff2):</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  className={styles.fileInput}
                />
              </div>
              {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.modalBtnSecondary} onClick={() => !uploading && setShowUploadModal(false)} disabled={uploading}>
                  Cancelar
                </button>
                <button type="submit" className={styles.modalBtnPrimary} disabled={uploading}>
                  {uploading ? 'Subiendo...' : 'Subir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextEditor;
