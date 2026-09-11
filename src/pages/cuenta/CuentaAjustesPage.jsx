import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, LogOut } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { logout } from '../../services/firebase/auth';
import ThemeToggle from '../../components/common/ThemeToggle/ThemeToggle';
import FlagIcon from '../../components/i18n/FlagIcon';
import { T } from '../../i18n/useTranslatedText';
import styles from './CuentaAjustesPage.module.css';

// Mismo criterio que Header.jsx: las banderas las dibuja <FlagIcon> (SVG
// real; los emoji de bandera no se ven en Windows).
const LANG_NAMES = { es: 'Español', en: 'English', pt: 'Português (Brasil)' };

/**
 * Modo oscuro/claro e idioma vivían SOLO dentro del popup de "Mi cuenta" del
 * header — que en móvil está oculto (ese ícono no se muestra ahí, el
 * BottomNav ya tiene su propia pestaña "Mi cuenta"). Resultado: en móvil no
 * había ningún lugar para cambiar tema o idioma. Esta página es ese lugar,
 * alcanzable desde la grilla de /cuenta como cualquier otra sección.
 *
 * De paso resuelve otro hueco del mismo origen: tampoco había botón de
 * "Cerrar sesión" alcanzable en móvil (el único vivía en el sidebar de
 * escritorio, oculto <900px).
 */
const CuentaAjustesPage = () => {
  const { lang, setLang, available, t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className={styles.ajustes}>
      <section className={styles.section}>
        <h2 className={styles.sectionLabel}><T>Apariencia</T></h2>
        <div className={styles.row}>
          <span className={styles.rowLabel}>
            <T>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</T>
          </span>
          <ThemeToggle />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionLabel}><T>Idioma</T></h2>
        <div className={styles.langList}>
          {available.map((code) => {
            const name = LANG_NAMES[code] || code.toUpperCase();
            const activo = lang === code;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={activo}
                onClick={() => setLang(code)}
                className={`${styles.langOption} ${activo ? styles.langOptionActive : ''}`}
              >
                <FlagIcon code={code} size={20} />
                <span>{name}</span>
                {activo && <Check size={16} strokeWidth={2.5} className={styles.langCheck} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </section>

      {user && (
        <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>{t('account.cerrarSesion', 'Cerrar sesión')}</span>
        </button>
      )}
    </div>
  );
};

export default CuentaAjustesPage;
