// ──────────────────────────────────────────────────────────────────────────────
// LanguageContext — base de i18n GRATIS para Walá
//
// Provee el idioma actual, el setter persistente y la función de traducción `t`.
// El traductor nativo del navegador (gratis) se encarga del resto del contenido:
// al cambiar idioma fijamos `document.documentElement.lang`, lo que le indica al
// navegador en qué idioma está la página y habilita su traducción automática.
//
// NOTA: este provider NO muestra el popup de idioma; eso lo decide la UI usando
// `lang` y `available`. Aquí sólo se gestiona el estado y la persistencia.
// ──────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dictionaries } from '../i18n/dictionaries';

// Idiomas disponibles (deben existir como claves en `dictionaries`).
const AVAILABLE = ['es', 'en', 'pt'];
const DEFAULT_LANG = 'es';
const STORAGE_KEY = 'wala_lang';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage debe usarse dentro de LanguageProvider');
  }
  return context;
};

// Nombre legible de cada idioma. El código interno sigue siendo 'pt', pero el
// idioma representado es Portugués de Brasil (pt-BR).
export const LANG_DISPLAY_NAMES = {
  es: 'Español',
  en: 'English',
  pt: 'Português (Brasil)',
};

// Normaliza un código de idioma del navegador (p.ej. "en-US", "pt-BR", "pt") a
// uno de los soportados tomando sólo la parte base (antes del guion). Así tanto
// "pt-BR" como "pt" se mapean a 'pt' (Portugués de Brasil). Cualquier idioma
// desconocido cae a español.
const normalizeLang = (code) => {
  const base = String(code || '').toLowerCase().split('-')[0];
  return AVAILABLE.includes(base) ? base : DEFAULT_LANG;
};

// Determina el idioma inicial: primero localStorage, luego el del navegador.
// No muestra nada todavía (el popup lo maneja la UI).
const detectInitialLang = () => {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && AVAILABLE.includes(saved)) return saved;
  } catch {
    // localStorage puede fallar (modo privado, etc.); seguimos con la detección.
  }
  const navLang = typeof navigator !== 'undefined' ? navigator.language : DEFAULT_LANG;
  return normalizeLang(navLang);
};

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(detectInitialLang);

  // En el primer montaje, sincroniza el atributo lang del <html> con el idioma
  // actual para que el traductor nativo del navegador sepa el idioma de la página.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
    // Sólo en el montaje inicial; los cambios posteriores los hace setLang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambia el idioma: valida, persiste en localStorage y actualiza <html lang>.
  const setLang = useCallback((code) => {
    const next = AVAILABLE.includes(code) ? code : DEFAULT_LANG;
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Si localStorage no está disponible, el idioma vive sólo en memoria.
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next;
    }
  }, []);

  // Traducción: idioma actual -> español (fallback) -> fallback explícito -> clave.
  const t = useCallback((key, fallback) => {
    return (
      dictionaries[lang]?.[key] ||
      dictionaries[DEFAULT_LANG]?.[key] ||
      fallback ||
      key
    );
  }, [lang]);

  const value = {
    lang,
    setLang,
    t,
    available: AVAILABLE,
    // Nombre legible del idioma actual (p.ej. "Português (Brasil)" para 'pt').
    langName: LANG_DISPLAY_NAMES[lang] || lang,
    langNames: LANG_DISPLAY_NAMES,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export default LanguageContext;
