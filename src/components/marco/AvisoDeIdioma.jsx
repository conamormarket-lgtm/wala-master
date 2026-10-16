import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { AvisoIdioma } from '../../componentes/kit/piezas/Marco';

const CLAVE = 'wala_lang';

// Idioma a sugerir según el navegador (pt o, para cualquier otro, en); null
// si ya está en español.
const idiomaSugerido = () => {
  if (typeof navigator === 'undefined') return null;
  const base = String(navigator.language || '').toLowerCase().split('-')[0];
  if (base === 'es' || base === '') return null;
  return base === 'pt' ? 'pt' : 'en';
};

const hayIdiomaGuardado = () => {
  try {
    return Boolean(window.localStorage.getItem(CLAVE));
  } catch {
    return false;
  }
};

/*
 * Sugerencia de idioma (M12) con el kit. Mismas reglas que LanguagePopup:
 * sale una sola vez, si el navegador no está en español y todavía no hay
 * idioma guardado. Las dos respuestas lo guardan (setLang), así que no
 * vuelve a salir. Los textos son los del diccionario (lang.popup…).
 */
export default function AvisoDeIdioma() {
  const { setLang, t } = useLanguage();
  const [sugerido, setSugerido] = useState(null);

  // Se decide después de montar, como antes (sin parpadeos al hidratar).
  useEffect(() => {
    const s = idiomaSugerido();
    if (s && !hayIdiomaGuardado()) setSugerido(s);
  }, []);

  if (!sugerido) return null;

  const elegir = (codigo) => {
    setLang(codigo);
    setSugerido(null);
  };

  return (
    <AvisoIdioma
      flotante
      idioma={{
        codigo: sugerido.toUpperCase(),
        titulo: t('lang.popupTitle'),
        cambiar: t('lang.popupYes'),
        mantener: t('lang.popupOriginal'),
      }}
      onCambiar={() => elegir(sugerido)}
      onMantener={() => elegir('es')}
    />
  );
}
