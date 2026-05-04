import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFonts } from '../../../services/fonts';

function getFontFormatFromUrl(url) {
  if (!url) return 'truetype';
  const u = url.toLowerCase();
  if (u.includes('.woff2')) return 'woff2';
  if (u.includes('.woff')) return 'woff';
  if (u.includes('.otf')) return 'opentype';
  return 'truetype';
}

const CustomFontsInjector = () => {
  const { data: customFontsData = [] } = useQuery({
    queryKey: ['fonts'],
    queryFn: async () => {
      const { data, error } = await getFonts();
      if (error) return [];
      return data;
    }
  });

  const customFonts = useMemo(
    () => (Array.isArray(customFontsData) ? customFontsData : []),
    [customFontsData]
  );

  useEffect(() => {
    const styleId = 'global-custom-fonts';
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
        // Usar font-display: swap para evitar bloqueos y asegurar que el texto sea visible pronto
        return `@font-face { font-family: "${family}"; src: url("${f.url}") format("${format}"); font-display: swap; }`;
      })
      .join('\n');
      
    el.textContent = rules;
    
    // NOTA: No destruimos el estilo al desmontar para asegurar que esté disponible 
    // en toda la app sin tener que repintar.
  }, [customFonts]);

  return null;
};

export default CustomFontsInjector;
