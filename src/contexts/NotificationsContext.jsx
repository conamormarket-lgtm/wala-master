import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, obtenerMessaging } from '../services/firebase/config';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, arrayUnion, setDoc } from 'firebase/firestore';
import { PORTAL_USERS_COLLECTION } from '../constants/userCollections';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './AuthContext';
import { abrirLinkDePush, registrarApertura } from '../utils/pushLink';

// Service worker de notificaciones web, con su PROPIO scope para no pisar al de
// la PWA (/sw.js, scope "/"). La config pública de Firebase va en la URL.
const registrarSwMensajes = () => {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  const p = new URLSearchParams({
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || '',
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || '',
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.REACT_APP_FIREBASE_APP_ID || '',
  });
  return navigator.serviceWorker
    .register(`/firebase-messaging-sw.js?${p.toString()}`, { scope: '/firebase-cloud-messaging-push-scope' })
    .catch(() => null);
};
let onMessageRegistrado = false;

// setupPushNotifications corre más de una vez por sesión (el efecto y el
// requestPermission del header): el listener de "tocó la push" va una sola vez.
let listenerToqueRegistrado = false;

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

      // Al tocar la push se abre su link (producto, oferta, fechas…). Antes no
      // había listener y tocarla solo abría la app en la portada.
      if (!listenerToqueRegistrado) {
        listenerToqueRegistrado = true;
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const data = action?.notification?.data || {};
          registrarApertura({ notifId: data.notifId, campaignId: data.campaignId });
          abrirLinkDePush(data.link);
        });
      }
    } else {
      // Web: Firebase Cloud Messaging.
      // El SDK se trae AQUI, no arriba: solo hace falta si de verdad vamos a
      // registrar un token, y esto corre con la sesion ya iniciada. Importarlo
      // de forma estatica lo metia en el bundle de arranque de toda visita.
      if (typeof Notification === 'undefined') return;
      const messaging = await obtenerMessaging();
      if (!messaging) return;
      const { getToken, onMessage } = await import('firebase/messaging');

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
          // Sin VAPID propia se usa la de Firebase por defecto (antes se pasaba
          // 'TU_VAPID_KEY' y el token nunca se generaba: no había push web).
          const swRegistration = await registrarSwMensajes();
          if (!swRegistration) return;
          const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
          const currentToken = await getToken(messaging, {
            ...(vapidKey ? { vapidKey } : {}),
            serviceWorkerRegistration: swRegistration,
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

          // Con la pestaña abierta el service worker no muestra nada: se arma la
          // notificación acá y, al tocarla, lleva al link (y cuenta la apertura).
          if (!onMessageRegistrado) {
            onMessageRegistrado = true;
            onMessage(messaging, (payload) => {
              const data = payload?.data || {};
              const n = new Notification(payload?.notification?.title || 'Walá', {
                body: payload?.notification?.body || '',
                icon: '/logo192.png',
                image: payload?.notification?.image,
              });
              n.onclick = () => {
                window.focus();
                registrarApertura({ notifId: data.notifId, campaignId: data.campaignId });
                abrirLinkDePush(data.link);
                n.close();
              };
            });
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) console.warn('Error configurando notificaciones web:', error);
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

  // Tocar un aviso: se marca leído y cuenta como ABIERTO (markAllAsRead no).
  const abrirNotificacion = useCallback((notif) => {
    if (!user || !notif) return;
    if (!notif.read) markAsRead(notif.id);
    if (!notif.openedAt) registrarApertura({ notifId: notif.id });
  }, [user, markAsRead]);

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
    abrirNotificacion,
    requestPermission,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export default NotificationsContext;
