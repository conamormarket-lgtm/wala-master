importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// La configuración de Firebase
const firebaseConfig = {
  // Los valores exactos se inyectarán o deben leerse desde un config estático, 
  // pero el Service Worker usualmente necesita inicializarse hardcodeado o importando un script.
  // Como esto depende del entorno, usaremos una versión simplificada. 
  // Para que funcione en tu PWA, asegúrate de colocar aquí los valores de tu entorno de prod,
  // o utilizar un mecanismo de inyección.
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

// Intenta inicializar solo si la URL actual no tiene params que inyecten config
try {
  // Por ahora lo dejamos listo para que lo configures con tus keys.
  // En un entorno dinámico, podrías pasar la config a través de la URL de registro del SW.
  // firebase.initializeApp(firebaseConfig);
  // const messaging = firebase.messaging();

  // messaging.onBackgroundMessage((payload) => {
  //   console.log('[firebase-messaging-sw.js] Received background message ', payload);
  //   const notificationTitle = payload.notification.title;
  //   const notificationOptions = {
  //     body: payload.notification.body,
  //     icon: '/logo192.png'
  //   };
  //   self.registration.showNotification(notificationTitle, notificationOptions);
  // });
} catch (e) {
  console.log("Error inicializando SW de Firebase", e);
}
