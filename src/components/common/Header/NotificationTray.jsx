import React, { useEffect } from 'react';
import { Bell, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNotifications } from '../../../contexts/NotificationsContext';
import styles from './Header.module.css';
import { T } from '../../../i18n/useTranslatedText';

// `createdAt` llega como Timestamp de Firestore (server-generado): tiene
// .toDate(). Se tolera también un Date/ISO por si algún día se escribe
// desde otro lado, y cualquier cosa rara devuelve '' en vez de romper.
const haceCuanto = (createdAt) => {
  try {
    const fecha = createdAt?.toDate ? createdAt.toDate() : (createdAt ? new Date(createdAt) : null);
    if (!fecha || Number.isNaN(fecha.getTime())) return '';
    return formatDistanceToNow(fecha, { addSuffix: true, locale: es });
  } catch {
    return '';
  }
};

const NotificationTray = ({ isOpen = false, isBlocked = false, onToggle, className = '' }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, requestPermission } = useNotifications();

  useEffect(() => {
    // Pedir permiso al montar el componente si el usuario está logueado
    requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`${styles.accountDropdownContainer} ${isOpen ? styles.activeDropdown : ''} ${isBlocked ? styles.forceHideHover : ''} ${className}`}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label="Notificaciones"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <Bell strokeWidth={1.5} className={styles.icon} />
        {unreadCount > 0 && (
          <span className={styles.cartBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      <div className={`${styles.accountPopup} ${styles.cartPopupWidth} ${styles.mobileCenteredPopup}`}>
        <div className={styles.notifPanel}>
          <div className={styles.notifHeader}>
            <h3 className={styles.notifHeaderTitle}><T>Notificaciones</T></h3>
            {unreadCount > 0 && (
              <button type="button" className={styles.notifMarkAll} onClick={markAllAsRead}>
                <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                <T>Marcar todas</T>
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className={styles.notifEmpty}>
              <Bell size={28} strokeWidth={1.25} aria-hidden="true" />
              <p><T>No tienes notificaciones recientes.</T></p>
            </div>
          ) : (
            <ul className={styles.notifList}>
              {notifications.slice(0, 10).map((notif) => {
                const cuando = haceCuanto(notif.createdAt);
                return (
                  <li
                    key={notif.id}
                    className={`${styles.notifItem} ${notif.read ? '' : styles.notifItemUnread}`}
                    onClick={() => { if (!notif.read) markAsRead(notif.id); }}
                  >
                    {!notif.read && <span className={styles.notifDot} aria-hidden="true" />}
                    <div className={styles.notifItemBody}>
                      <h4 className={styles.notifItemTitle}>{notif.title}</h4>
                      <p className={styles.notifItemText}>{notif.body}</p>
                      {cuando && <span className={styles.notifItemTime}>{cuando}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationTray;
