import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
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
  const groups = useCuentaNavGroups();

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
    </div>
  );
};

export default CuentaResumenPage;
