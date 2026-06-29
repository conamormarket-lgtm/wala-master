import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

/* =========================================================================
   ThemeContext — Modo Noche global de Walá
   -------------------------------------------------------------------------
   Gestiona el tema visual de TODA la página con tres "modos" de intención:

     mode  = "system" | "light" | "dark"   (lo que ELIGE el visitante)
     theme = "light"  | "dark"             (lo que se APLICA realmente)

   - "system" (default): sigue prefers-color-scheme del navegador y se
     RE-EVALÚA en vivo si el visitante cambia el modo de su sistema operativo.
   - "light"/"dark": elección fija del visitante; ignora el sistema.

   Persistencia: la elección se guarda en localStorage bajo la clave
   "wala-theme" (LS_KEY). Si nunca eligió nada, queda "system".

   Aplicación: se fija el atributo data-theme="dark"/"light" en
   <html> (document.documentElement). El CSS global reacciona a
   [data-theme="dark"]. El mismo atributo lo fija ANTES que React un script
   inline en index.html (anti-FOUC); aquí sólo lo mantenemos sincronizado.
   ========================================================================= */

// Clave de persistencia. DEBE coincidir con el script anti-FOUC de index.html.
const LS_KEY = 'wala-theme';

const ThemeContext = createContext(null);

// Lee la preferencia del sistema (modo oscuro del SO/navegador del visitante).
const getSystemTheme = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Lee el modo guardado por el visitante. Por defecto "system".
const getStoredMode = () => {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch (_) { /* localStorage no disponible (modo privado / SSR) */ }
  return 'system';
};

// Resuelve el tema EFECTIVO a partir del modo de intención.
const resolveTheme = (mode) => (mode === 'system' ? getSystemTheme() : mode);

// Aplica el tema al <html> para que el CSS global lo lea ([data-theme="dark"]).
const applyThemeToDOM = (theme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
};

export const ThemeProvider = ({ children }) => {
  // Estado de INTENCIÓN del visitante (lo que persiste).
  const [mode, setModeState] = useState(getStoredMode);
  // Estado EFECTIVO aplicado (light/dark), derivado de mode (+ sistema si "system").
  const [theme, setTheme] = useState(() => resolveTheme(getStoredMode()));

  // Cada vez que cambia el modo: recalcular el tema efectivo, aplicarlo al DOM
  // y persistir la elección del visitante.
  useEffect(() => {
    const next = resolveTheme(mode);
    setTheme(next);
    applyThemeToDOM(next);
    try { localStorage.setItem(LS_KEY, mode); } catch (_) { /* no-op */ }
  }, [mode]);

  // Mientras el modo sea "system", escuchar cambios del SO en vivo y reflejarlos.
  useEffect(() => {
    if (mode !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next = mql.matches ? 'dark' : 'light';
      setTheme(next);
      applyThemeToDOM(next);
    };
    // addEventListener moderno; fallback a addListener para navegadores viejos.
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else if (mql.addListener) mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else if (mql.removeListener) mql.removeListener(onChange);
    };
  }, [mode]);

  // setMode: fija una intención explícita ("system" | "light" | "dark").
  const setMode = useCallback((nextMode) => {
    if (nextMode === 'system' || nextMode === 'light' || nextMode === 'dark') {
      setModeState(nextMode);
    }
  }, []);

  // toggle: alterna entre claro y oscuro tomando como base el tema VISIBLE
  // ahora mismo (así el primer clic siempre "invierte" lo que el usuario ve,
  // aunque venga de "system"). El resultado se vuelve una elección fija.
  const toggle = useCallback(() => {
    setModeState((prevMode) => {
      const current = resolveTheme(prevMode);
      return current === 'dark' ? 'light' : 'dark';
    });
  }, []);

  const value = { theme, mode, toggle, setMode };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook de consumo. Devuelve { theme, mode, toggle(), setMode() }.
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback defensivo: si por error se usa fuera del Provider, no romper la app.
    return { theme: 'light', mode: 'system', toggle: () => {}, setMode: () => {} };
  }
  return ctx;
};

export default ThemeContext;
