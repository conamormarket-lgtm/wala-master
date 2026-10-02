/* Service worker de notificaciones web (Firebase Cloud Messaging).
 *
 * Recibe las push cuando la pestaña de Walá está cerrada o en segundo plano y
 * las muestra. Al tocarlas, Firebase abre el link que manda el servidor en
 * webpush.fcmOptions.link (el producto, la oferta, el pedido…).
 *
 * La configuración (pública) de Firebase llega por la URL de registro
 * (?apiKey=…&projectId=…), así no se repite a mano en este archivo. Lo
 * registra NotificationsContext con su propio scope para no reemplazar al
 * service worker de la PWA (/sw.js).
 */
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain') || undefined,
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
  try {
    firebase.initializeApp(firebaseConfig);
    // Con esto basta: los mensajes con `notification` los muestra el SDK solo,
    // y el clic abre webpush.fcmOptions.link.
    firebase.messaging();
  } catch (e) {
    console.log('[firebase-messaging-sw] no se pudo inicializar', e);
  }
}
