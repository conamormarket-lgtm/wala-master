import { useState, useEffect } from 'react';
import { db, messaging } from '../services/firebase/config';
import { collection, query, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext'; // Asumiendo que existe un AuthContext, si no, lo ajustaremos

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth() || { user: null }; // Fallback

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // 1. Escuchar notificaciones in-app desde Firestore
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

    // 2. Configurar FCM / Push Notifications
    setupPushNotifications(user.uid);

    return () => unsubscribe();
  }, [user]);

  const setupPushNotifications = async (uid) => {
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
        // Aquí deberías guardar el token en Firestore bajo el usuario
        // await setDoc(doc(db, `users/${uid}/fcmTokens`, token.value), { token: token.value, platform: 'capacitor' });
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
      
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Reemplaza con tu VAPID KEY de Firebase Console > Project Settings > Cloud Messaging > Web configuration
          const currentToken = await getToken(messaging, {
            vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY || 'TU_VAPID_KEY'
          });
          if (currentToken) {
            console.log('Web FCM token:', currentToken);
            // Guardar token en Firestore
          }
          
          // Escuchar mensajes en primer plano (Web)
          onMessage(messaging, (payload) => {
            console.log('Message received in foreground: ', payload);
            // Mostrar notificación nativa si la app está en primer plano
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
  };

  const markAsRead = async (notificationId) => {
    if (!user) return;
    try {
      const notifRef = doc(db, `users/${user.uid}/notifications`, notificationId);
      await updateDoc(notifRef, { read: true });
    } catch (error) {
      console.error('Error marcando notificación como leída', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unreadNotifs = notifications.filter(n => !n.read);
    unreadNotifs.forEach(n => markAsRead(n.id));
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    requestPermission: () => {
      if (user) setupPushNotifications(user.uid);
    }
  };
};
