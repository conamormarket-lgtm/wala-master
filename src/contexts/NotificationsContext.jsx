import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, messaging } from '../services/firebase/config';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, arrayUnion, setDoc } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { PORTAL_USERS_COLLECTION } from '../constants/userCollections';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './AuthContext';

/**
 * Antes esta lógica vivía en el hook `useNotifications` (src/hooks/), y cada
 * componente que lo llamaba abría SU PROPIO listener de Firestore y volvía a
 * pedir permiso de push. Con un solo consumidor (NotificationTray) no se
 * notaba, pero al sumar el resumen de notificaciones en la página de cuenta
 * (mobile) hubiera significado dos listeners en paralelo para el mismo
 * usuario. Se sube a Context: UN solo listener por sesión, y quien lo
 * necesite (el header, la cuenta) lee del mismo estado.
 */

const NotificationsContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications debe usarse dentro de NotificationsProvider');
  }
  return context;
};

export const NotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth() || { user: null };

  const setupPushNotifications = useCallback(async (uid) => {
    if (Capacitor.isNativePlatform()) {
      // Movil: Capacitor Push Notifications
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('User denied push notification permissions');
        return;
      }

      await PushNotifications.register();

      PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration success, token: ' + token.value);
        try {
          const userRef = doc(db, PORTAL_USERS_COLLECTION, uid);
          await setDoc(userRef, { fcmTokens: arrayUnion(token.value) }, { merge: true });
        } catch (err) {
          console.warn('Error saving capacitor token:', err);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ' + JSON.stringify(notification));
      });
    } else {
      // Web: Firebase Cloud Messaging
      if (!messaging) return;
      if (typeof Notification === 'undefined') return;

      try {
        // Solo pedimos permiso si NUNCA se decidió ('default'). Si ya está 'denied'
        // (o el navegador lo bloqueó) o 'granted', NO volvemos a llamar
        // requestPermission — eso evita el warning repetido de Chrome por insistir
        // tras un rechazo. Si ya está 'granted', seguimos directo a obtener el token.
        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }
        if (permission === 'granted') {
          const currentToken = await getToken(messaging, {
            vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY || 'TU_VAPID_KEY'
          });
          if (currentToken) {
            console.log('Web FCM token:', currentToken);
            try {
              const userRef = doc(db, PORTAL_USERS_COLLECTION, uid);
              await setDoc(userRef, { fcmTokens: arrayUnion(currentToken) }, { merge: true });
            } catch (err) {
              console.warn('Error saving web token:', err);
            }
          }

          // Escuchar mensajes en primer plano (Web)
          onMessage(messaging, (payload) => {
            console.log('Message received in foreground: ', payload);
            new Notification(payload.notification.title, {
              body: payload.notification.body,
              icon: '/logo192.png'
            });
          });
        }
      } catch (error) {
        console.warn('Error configurando notificaciones web:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    // Escuchar notificaciones in-app desde Firestore
    const q = query(
      collection(db, `users/${user.uid}/notifications`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = [];
      let unread = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        notifs.push({ id: docSnap.id, ...data });
        if (!data.read) unread++;
      });
      setNotifications(notifs);
      setUnreadCount(unread);
    });

    setupPushNotifications(user.uid);

    return () => unsubscribe();
  }, [user, setupPushNotifications]);

  const markAsRead = useCallback(async (notificationId) => {
    if (!user) return;
    try {
      const notifRef = doc(db, `users/${user.uid}/notifications`, notificationId);
      await updateDoc(notifRef, { read: true });
    } catch (error) {
      console.error('Error marcando notificación como leída', error);
    }
  }, [user]);

  const markAllAsRead = useCallback(() => {
    if (!user) return;
    notifications.filter((n) => !n.read).forEach((n) => markAsRead(n.id));
  }, [user, notifications, markAsRead]);

  const requestPermission = useCallback(() => {
    if (user) setupPushNotifications(user.uid);
  }, [user, setupPushNotifications]);

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    requestPermission,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export default NotificationsContext;
