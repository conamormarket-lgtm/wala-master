import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { logout } from '../../services/firebase/auth';
import { PaginaAjustes } from '../../componentes/kit/paginas/Cuenta';

/*
 * Ajustes (/cuenta/ajustes): modo noche (useTheme().toggle, como el botón de
 * siempre), el idioma (useLanguage) y, en el celular, cerrar sesión. Lo de
 * antes, en pages/cuenta/CuentaAjustesViejo.jsx (interruptor cuentaVieja).
 */

// Cada idioma con su nombre en su propio idioma (como antes) y un detalle.
const IDIOMAS = {
  es: { texto: 'Español', detalle: 'Perú' },
  en: { texto: 'English', detalle: 'Inglés' },
  pt: { texto: 'Português', detalle: 'Portugués (Brasil)' },
};

export default function AjustesDeCuenta() {
  const { lang, setLang, available } = useLanguage();
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
      idioma={lang}
      idiomas={available.map((codigo) => ({ valor: codigo, ...(IDIOMAS[codigo] || { texto: codigo.toUpperCase() }) }))}
      onIdioma={setLang}
      onCerrarSesion={cerrarSesion}
    />
  );
}
