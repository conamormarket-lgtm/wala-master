// ──────────────────────────────────────────────────────────────────────────────
// LanguagePopup — banner discreto de sugerencia de idioma
//
// Se muestra UNA sola vez: si el navegador del visitante NO está en español
// (navigator.language no empieza por 'es') Y todavía no hay preferencia guardada
// en localStorage ('wala_lang'), ofrecemos ver Walá en su idioma (inglés o
// portugués detectado) o mantener el español original.
//
// Al elegir cualquiera de las dos opciones, setLang() persiste la preferencia,
// con lo que la condición de arriba deja de cumplirse y el popup no vuelve a
// aparecer. Es mobile-first y usa el lenguaje glass del sistema de diseño.
// ──────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { GlassButton } from '../ui';
import styles from './LanguagePopup.module.css';

const STORAGE_KEY = 'wala_lang';

// Bandera (emoji, sin assets) por idioma. PT = portugués de Brasil (🇧🇷).
const LANG_FLAGS = { es: '🇵🇪', en: '🇺🇸', pt: '🇧🇷' };

// Mapea el idioma del navegador a uno soportado distinto del español.
// Devuelve null si el navegador ya está en español (no hay nada que sugerir).
const detectSuggestedLang = () => {
  if (typeof navigator === 'undefined') return null;
  const base = String(navigator.language || '').toLowerCase().split('-')[0];
  if (base === 'es' || base === '') return null; // ya está en español
  if (base === 'pt') return 'pt';
  // Cualquier otro idioma extranjero: ofrecemos inglés como puente universal.
  return 'en';
};

// ¿Hay ya una preferencia guardada? Si la hay, nunca mostramos el popup.
const hasSavedLang = () => {
  try {
    return Boolean(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
};

const LanguagePopup = () => {
  const { setLang, t } = useLanguage();
  const [visible, setVisible] = useState(false);
  // Idioma sugerido (en | pt) calculado una sola vez en el montaje.
  const [suggested, setSuggested] = useState(null);

  useEffect(() => {
    // Sólo decidimos mostrar el popup tras montar (evita parpadeos en SSR/hidratación).
    const sugerido = detectSuggestedLang();
    if (sugerido && !hasSavedLang()) {
      setSuggested(sugerido);
      setVisible(true);
    }
  }, []);

  if (!visible || !suggested) return null;

  // Al elegir, setLang persiste en localStorage -> la condición ya no se cumple
  // y el popup no vuelve a mostrarse en futuras visitas.
  const elegir = (code) => {
    setLang(code);
    setVisible(false);
  };

  return (
    <div className={styles.wrapper} role="dialog" aria-live="polite" aria-label={t('lang.popupTitle')}>
      <div className={styles.card}>
        <p className={styles.title}>{t('lang.popupTitle')}</p>
        <div className={styles.actions}>
          <GlassButton
            variant="primary"
            size="sm"
            onClick={() => elegir(suggested)}
          >
            {/* Bandera del idioma sugerido (🇺🇸 inglés / 🇧🇷 portugués de Brasil); decorativa. */}
            <span aria-hidden="true">{LANG_FLAGS[suggested]}</span> {t('lang.popupYes')}
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => elegir('es')}
          >
            {/* Bandera de Perú (español, idioma original); decorativa. */}
            <span aria-hidden="true">{LANG_FLAGS.es}</span> {t('lang.popupOriginal')}
          </GlassButton>
        </div>
      </div>
    </div>
  );
};

export default LanguagePopup;
