const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

const db = admin.firestore();
const messaging = admin.messaging();
const PORTAL_USERS_COLLECTION = "portal_clientes_users";

// Limpia de fcmTokens los tokens que FCM reporta como inválidos/no registrados (H-10).
const INVALID_TOKEN_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
];
async function removeInvalidTokens(userRef, tokens, response) {
  try {
    if (!response || !Array.isArray(response.responses)) return;
    const invalid = [];
    response.responses.forEach((r, i) => {
      if (!r.success && r.error && INVALID_TOKEN_CODES.includes(r.error.code)) {
        invalid.push(tokens[i]);
      }
    });
    if (invalid.length > 0) {
      await userRef.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalid) });
    }
  } catch (e) {
    console.warn("removeInvalidTokens error:", e.message);
  }
}

// Helper para validar reglas anti-spam globales (máximo 2 por día, horas 9:00 a 21:00)
const canSendPush = (userData, type, currentHourPeru) => {
  if (currentHourPeru < 9 || currentHourPeru >= 21) return false;

  const log = userData.antiSpamLog || [];
  const today = new Date().toISOString().split('T')[0];
  const todaysPushes = log.filter(l => l.date && l.date.startsWith(today));
  
  if (todaysPushes.length >= 2) return false;

  // Evitar duplicados del mismo tipo el mismo día
  if (todaysPushes.some(l => l.type === type)) return false;

  return true;
};

// Helper para enviar push
const sendPush = async (uid, tokens, title, body, type, userRef, currentLog) => {
  if (!tokens || tokens.length === 0) return false;

  const message = {
    tokens,
    notification: { title, body },
    data: { type }
  };

  try {
    const response = await messaging.sendEachForMulticast(message);

    // Limpiar tokens inválidos del usuario (H-10).
    await removeInvalidTokens(userRef, tokens, response);

    if (response.successCount > 0) {
      // Registrar in-app notification
      await db.collection(`users/${uid}/notifications`).add({
        title, body, type,
        read: false,
        createdAt: new Date().toISOString()
      });

      // Actualizar antiSpamLog
      const newLog = [...(currentLog || [])];
      newLog.push({ date: new Date().toISOString(), type });
      await userRef.update({ antiSpamLog: newLog });

      return true;
    }
  } catch (err) {
    console.warn(`Error sending push to ${uid}:`, err);
  }
  return false;
};

exports.notificationEngine = onSchedule({
  schedule: "0 * * * *", // Cada hora
  timeZone: "America/Lima"
}, async (event) => {
  console.log("Running notification engine...");
  
  const now = new Date();
  const currentHourPeru = now.getHours();

  try {
    // 1. Obtener configuraciones de copys (si existe)
    let settings = { categories: {}, copys: {} };
    const settingsDoc = await db.collection('notification_settings').doc('global').get();
    if (settingsDoc.exists) {
      settings = settingsDoc.data();
    }

    const usersSnapshot = await db.collection(PORTAL_USERS_COLLECTION).get();
    
    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      const uid = doc.id;
      const fcmTokens = data.fcmTokens || [];
      const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);

      if (fcmTokens.length === 0) continue; // No puede recibir push

      // -- REGLA 1: Carrito Abandonado --
      if (data.cart && data.cart.items && data.cart.items.length > 0 && data.cart.cartUpdatedAt) {
        const cartDate = new Date(data.cart.cartUpdatedAt);
        const diffHours = (now - cartDate) / (1000 * 60 * 60);
        let level = data.cart.abandonedLevel || 0;

        let sent = false;
        
        if (diffHours >= 48 && level < 3) {
           // 48h: Última oportunidad
           if (canSendPush(data, 'cart_48h', currentHourPeru)) {
              const copy = settings.copys?.cart_48h || "Última oportunidad. Tu carrito se vacía mañana. ¿Lo completamos?";
              sent = await sendPush(uid, fcmTokens, "🛒 Tu Carrito", copy, "cart_48h", userRef, data.antiSpamLog);
              if (sent) await userRef.update({ "cart.abandonedLevel": 3 });
           }
        } 
        else if (diffHours >= 24 && diffHours < 48 && level < 2) {
           // 24h
           if (canSendPush(data, 'cart_24h', currentHourPeru)) {
              const activeCoins = data.monedas || 0;
              const copy = activeCoins > 10 
                 ? `El box que elegiste sigue en tu carrito. Recuerda que tienes ${activeCoins} monedas disponibles 💰`
                 : "El box que elegiste sigue en tu carrito. ¿Terminamos de armarlo?";
              sent = await sendPush(uid, fcmTokens, "🛒 Tu Carrito", copy, "cart_24h", userRef, data.antiSpamLog);
              if (sent) await userRef.update({ "cart.abandonedLevel": 2 });
           }
        }
        else if (diffHours >= 1 && diffHours < 24 && level < 1) {
           // 1h
           if (canSendPush(data, 'cart_1h', currentHourPeru)) {
              const copy = settings.copys?.cart_1h || "Tu regalo te está esperando. ¿Terminamos? 📦";
              sent = await sendPush(uid, fcmTokens, "🛒 Tu Carrito", copy, "cart_1h", userRef, data.antiSpamLog);
              if (sent) await userRef.update({ "cart.abandonedLevel": 1 });
           }
        }

        if (sent) continue; // Si enviamos de carrito, saltamos otras reglas de menor prioridad para este usuario hoy
      }

      // -- REGLA 2: Retención Kapi --
      if (data.lastAppOpen) {
         const lastOpenDate = new Date(data.lastAppOpen);
         const diffDays = (now - lastOpenDate) / (1000 * 60 * 60 * 24);
         const lastName = data.displayName ? data.displayName.split(' ')[0] : 'Kapi';

         if (diffDays >= 14) {
            if (canSendPush(data, 'retention_14d', currentHourPeru)) {
               const activeCoins = data.monedas || 0;
               const copy = activeCoins > 0 
                  ? `Tienes ${activeCoins} monedas que se van a perder. Y Kapi está muy triste...`
                  : `Kapi te extraña mucho. Lleva varios días sin verte 😢`;
               await sendPush(uid, fcmTokens, "Kapi te extraña", copy, "retention_14d", userRef, data.antiSpamLog);
            }
         }
         else if (diffDays >= 7 && diffDays < 14) {
            if (canSendPush(data, 'retention_7d', currentHourPeru)) {
               const copy = `Kapi extraña a ${lastName}. Lleva ${Math.floor(diffDays)} días sin comer 😢`;
               await sendPush(uid, fcmTokens, "Mascota Hambrienta", copy, "retention_7d", userRef, data.antiSpamLog);
            }
         }
      }
    }
    
    console.log("Notification engine finished.");
  } catch (error) {
    console.error("Error in notificationEngine:", error);
  }
});

exports.sendManualPromoNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  }

  // Solo admins pueden enviar push masivos (H-04). Admin = custom claim o, como
  // puente de bootstrap, doc adminUsers/{uid} con role 'admin'.
  const isCallerAdmin = context.auth.token?.admin === true
    || (await db.collection('adminUsers').doc(context.auth.uid).get()
          .then((s) => s.exists && s.data().role === 'admin')
          .catch(() => false));
  if (!isCallerAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Solo un administrador puede enviar notificaciones.");
  }

  const { title, body, segment } = data;
  if (!title || !body) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan título o cuerpo de mensaje.");
  }

  try {
    let queryRef = db.collection(PORTAL_USERS_COLLECTION);
    const usersSnapshot = await queryRef.get();
    
    let count = 0;
    const now = new Date();

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const fcmTokens = userData.fcmTokens || [];
      if (fcmTokens.length === 0) continue;

      // Aplicar segmentación
      if (segment === 'vip') {
        const monedas = userData.monedas || 0;
        if (monedas < 50) continue;
      } else if (segment === 'inactive') {
        if (!userData.lastAppOpen) continue;
        const lastOpenDate = new Date(userData.lastAppOpen);
        const diffDays = (now - lastOpenDate) / (1000 * 60 * 60 * 24);
        if (diffDays < 30) continue;
      }

      // Enviar
      const message = {
        tokens: fcmTokens,
        notification: { title, body },
        data: { type: 'manual_promo' }
      };

      try {
        const response = await messaging.sendEachForMulticast(message);
        await removeInvalidTokens(doc.ref, fcmTokens, response);
        if (response.successCount > 0) {
          count++;
          // Guardar in-app notif
          await db.collection(`users/${doc.id}/notifications`).add({
            title, body, type: 'manual_promo',
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn('Error sending to ' + doc.id, e);
      }
    }

    return { success: true, count };
  } catch (error) {
    console.error(error);
    throw new functions.https.HttpsError("internal", "Error al enviar la promo");
  }
});
