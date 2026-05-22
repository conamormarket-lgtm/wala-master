import React, { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../../hooks/useNotifications';
import styles from './Header.module.css';

const NotificationTray = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, requestPermission } = useNotifications();

  useEffect(() => {
    // Pedir permiso al montar el componente si el usuario está logueado
    requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.accountDropdownContainer}>
      <button className={styles.iconButton} aria-label="Notificaciones" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <Bell strokeWidth={1.5} className={styles.icon} />
        {unreadCount > 0 && (
          <span className={styles.cartBadge} style={{ backgroundColor: '#e74c3c' }}>{unreadCount}</span>
        )}
      </button>

      <div className={`${styles.accountPopup} ${styles.cartPopupWidth}`}>
        <div className={styles.accountPopupContent} style={{ padding: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Notificaciones</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead} 
                style={{ background: 'none', border: 'none', color: '#8b5cf6', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888', padding: '1rem 0' }}>No tienes notificaciones recientes.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {notifications.slice(0, 10).map((notif) => (
                <div 
                  key={notif.id} 
                  onClick={() => { if (!notif.read) markAsRead(notif.id); }}
                  style={{ 
                    padding: '0.75rem', 
                    backgroundColor: notif.read ? '#fff' : '#f0f4f8', 
                    borderRadius: '8px',
                    border: '1px solid #eee',
                    cursor: notif.read ? 'default' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: '#333' }}>{notif.title}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', lineHeight: '1.2' }}>{notif.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationTray;
