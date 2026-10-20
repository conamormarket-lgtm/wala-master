import React, { useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { logout } from '../../services/firebase/auth';
import { PaginaAjustes } from '../../componentes/kit/paginas/Cuenta';
import { brilloActivo, guardarBrillo, escucharBrillo } from '../../interactions/preferenciaBrillo.mjs';

/*
 * Ajustes (/cuenta/ajustes): modo noche (useTheme().toggle, como el botón de
 * siempre), el idioma (useLanguage) y, en el celular, el brillo mágico del
 * dedo (interactions/preferenciaBrillo.mjs) y cerrar sesión. Lo de
 * antes, en pages/cuenta/CuentaAjustesViejo.jsx (interruptor cuentaVieja).
 */

// Cada idioma con su nombre en su propio idioma (como antes) y un detalle.
const IDIOMAS = {
  es: { texto: 'Español', detalle: 'Perú' },
  en: { texto: 'English', detalle: 'Inglés' },
  pt: { texto: 'Português', detalle: 'Portugués (Brasil)' },
};

// El brillo sigue al dedo: el interruptor solo tiene sentido con pantalla táctil.
const conDedo = () => typeof window !== 'undefined'
  && (Boolean(window.Capacitor?.isNativePlatform?.()) || window.matchMedia('(pointer: coarse)').matches);

export default function AjustesDeCuenta() {
  const { lang, setLang, available } = useLanguage();
  const brillo = useSyncExternalStore(escucharBrillo, brilloActivo, () => true);
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const cerrarSesion = async () => {
    await logout();
    navigate('/');
  };

  return (
    <PaginaAjustes
      tema={theme}
      onTema={toggle}
      brillo={brillo}
      onBrillo={conDedo() ? guardarBrillo : undefined}
      idioma={lang}
      idiomas={available.map((codigo) => ({ valor: codigo, ...(IDIOMAS[codigo] || { texto: codigo.toUpperCase() }) }))}
      onIdioma={setLang}
      onCerrarSesion={cerrarSesion}
    />
  );
}
