import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { logout } from '../../services/firebase/auth';
import { useCuentaNavGroups } from './useCuentaNavGroups';
import styles from './CuentaResumenPage.module.css';

/**
 * Landing de /cuenta (antes: un redirect directo a /cuenta/pedidos, que se
 * saltaba cualquier vistazo general). Ahora es una grilla de accesos
 * directos a TODAS las secciones de la cuenta — mismo patrón que el "Cuenta"
 * de apps como AliExpress: apenas entrás ves todas las opciones, y cada una
 * te lleva de un toque a su página exacta (no a un menú intermedio).
 *
 * Los datos (rutas/íconos/etiquetas) son los mismos que usa el sidebar/
 * selector de CuentaLayout — ver useCuentaNavGroups, para que un ítem nuevo
 * no quede desincronizado entre los dos lugares.
 */
const CuentaResumenPage = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const groups = useCuentaNavGroups();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className={styles.resumen}>
      {groups.map((group) => (
        <section key={group.label} className={styles.group}>
          <h2 className={styles.groupLabel}>{t(group.label, group.labelFallback)}</h2>
          <div className={styles.grid}>
            {group.items.map((item) => (
              <Link key={item.to} to={item.to} className={styles.tile}>
                <span className={styles.tileIcon} aria-hidden="true">
                  <item.icon size={22} strokeWidth={1.75} />
                </span>
                <span className={styles.tileLabel}>{t(item.labelKey, item.label)}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* "Cerrar sesión" SOLO en móvil (≤860px): esta grilla es la pantalla que
          abre el tab "Mi cuenta" del BottomNav, así que es donde el usuario
          busca el logout. En escritorio (≥861px) el sidebar de CuentaLayout ya
          trae su propio "Cerrar sesión" siempre visible junto a esta grilla —
          por eso acá se oculta ahí (ver CuentaResumenPage.module.css), para no
          mostrarlo dos veces en la misma pantalla. Antes el único logout de
          móvil vivía enterrado dentro de /cuenta/ajustes y no "aparecía". */}
      {user && (
        <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>{t('account.cerrarSesion', 'Cerrar sesión')}</span>
        </button>
      )}
    </div>
  );
};

export default CuentaResumenPage;
