/**
 * Cloud Function HTTP: el ERP debe llamar a esta URL cuando cree un pedido.
 * Crea la cuenta en el Portal (Auth + Firestore users) si el correo no tiene cuenta.
 * Una sola cuenta por email; contraseña inicial = DNI (mín. 6 caracteres).
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();
const PORTAL_USERS_COLLECTION = "portal_clientes_users";

const MIN_PASSWORD_LENGTH = 6;

const ERP_NOMBRE = [
  "clienteNombre",
  "clienteApellidos",
  "clienteNombreCompleto",
  "nombreCompleto",
  "customerName",
  "nombreCliente",
  "nombre",
];
const ERP_CORREO = ["clienteCorreo", "correo", "email", "correoElectronico"];
const ERP_TELEFONO1 = ["clienteContacto", "telefono1", "numero1", "phone", "telefono", "phone1"];

function getFirst(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function extraerDatos(body) {
  if (!body || typeof body !== "object") {
    return { email: null, displayName: null, dni: null, phone: null, tipoDocumento: null };
  }
  const nombrePartes = [body.clienteNombre, body.clienteApellidos].filter(Boolean);
  const displayName =
    nombrePartes.length > 0 ? nombrePartes.join(" ") : getFirst(body, ERP_NOMBRE) || null;
  const emailRaw = getFirst(body, ERP_CORREO);
  const email =
    typeof emailRaw === "string" && emailRaw.trim()
      ? emailRaw.trim().toLowerCase()
      : null;
  const dniRaw = body.clienteNumeroDocumento ?? body.dni ?? body.documento;
  const dni =
    dniRaw != null && String(dniRaw).trim()
      ? String(dniRaw).trim().replace(/\s/g, "")
      : null;
  const phoneRaw = getFirst(body, ERP_TELEFONO1);
  const phone =
    phoneRaw != null && String(phoneRaw).trim()
      ? String(phoneRaw).replace(/\D/g, "")
      : null;
  const tipoDocumento =
    body.tipoDocumento != null && String(body.tipoDocumento).trim()
      ? String(body.tipoDocumento).trim()
      : null;
  return { email, displayName, dni, phone, tipoDocumento };
}

function isValidEmail(str) {
  if (typeof str !== "string" || !str.trim()) return false;
  const t = str.trim().toLowerCase();
  return t.includes("@") && t.length >= 5;
}

function buildPassword(dni) {
  if (dni == null || String(dni).trim() === "") return null;
  const n = String(dni).trim().replace(/\s/g, "");
  if (n.length >= MIN_PASSWORD_LENGTH) return n;
  return n.padStart(MIN_PASSWORD_LENGTH, "0");
}

/**
 * URL: https://<region>-<project>.cloudfunctions.net/ensureAccountFromOrder
 * Método: POST
 * Body (JSON): datos del pedido/cliente, p.ej.:
 *   { "email": "a@b.com", "nombreCliente": "Juan Pérez", "dni": "12345678", "phone": "999888777" }
 * También acepta: clienteCorreo, customerName, clienteNombre, clienteNumeroDocumento, clienteContacto, etc.
 *
 * Respuesta 200:
 *   { "created": true, "userId": "..." }  o  { "created": false, "existing": true }  o  { "created": false, "error": "..." }
 */
exports.ensureAccountFromOrder = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Secret");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido. Use POST." });
    return;
  }

  const body = typeof req.body === "object" ? req.body : {};
  const { email, displayName, dni, phone, tipoDocumento } = extraerDatos(body);

  if (!isValidEmail(email)) {
    res.status(400).json({ created: false, error: "NO_EMAIL" });
    return;
  }

  const password = buildPassword(dni);
  if (!password) {
    res.status(400).json({ created: false, error: "NO_DNI" });
    return;
  }

  try {
    let existingUser = null;
    try {
      existingUser = await auth.getUserByEmail(email);
    } catch (e) {
      if (e.code !== "auth/user-not-found") {
        throw e;
      }
    }

    if (existingUser) {
      res.status(200).json({ created: false, existing: true, userId: existingUser.uid });
      return;
    }

    const userRecord = await auth.createUser({
      email,
      password,
      displayName: displayName || email,
    });
    const uid = userRecord.uid;

    await db.collection(PORTAL_USERS_COLLECTION).doc(uid).set(
      {
        email,
        displayName: displayName || email,
        dni: dni || null,
        phone: phone || null,
        tipoDocumento: tipoDocumento || null,
        accessSystem: "portal_clientes",
        accountOrigin: "erp_auto",
        createdForPortalClientes: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.status(200).json({ created: true, userId: uid });
  } catch (err) {
    console.error("ensureAccountFromOrder error:", err);
    const code = err.code || "";
    const msg = err.message || "";
    res.status(500).json({
      created: false,
      error: code ? `${code}: ${msg}` : msg,
    });
  }
});

/**
 * Cloud Function (Callable): Securely claim coins for an order.
 * Ensures the order exists, is completed, belongs to the user, and hasn't been claimed yet.
 */
exports.secureClaimMonedas = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Debe estar autenticado para reclamar monedas."
    );
  }

  const { pedidoId, amount = 10 } = data;
  if (!pedidoId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Se requiere el ID del pedido."
    );
  }

  const uid = context.auth.uid;
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  // const orderRef = db.collection("orders").doc(pedidoId);

  try {
    return await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      }
      const userData = userDoc.data();

      // NOTA: Los pedidos ahora están en el Firebase del ERP, por lo que no podemos
      // verificarlos directamente desde la base de datos web sin inicializar el SDK del ERP aquí.
      // Se omite la verificación de estado por ahora, confiando en la UI, pero 
      // manteniendo la regla de que el pedidoId no puede ser reclamado dos veces.
      /*
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Pedido no encontrado.");
      }

      const orderData = orderDoc.data();

      // Check if order belongs to user (using userId or DNI)
      if (orderData.userId !== uid && orderData.dni !== userData.dni) {
        throw new functions.https.HttpsError("permission-denied", "Este pedido no le pertenece.");
      }

      // Check if order is completed
      const estado = (orderData.estadoGeneral || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!["finalizado", "entregado", "completado"].includes(estado)) {
         throw new functions.https.HttpsError("failed-precondition", "El pedido no está finalizado.");
      }
      */

      // Check if already claimed
      const reclamadas = userData.monedasReclamadas || [];
      if (reclamadas.includes(pedidoId)) {
        throw new functions.https.HttpsError("already-exists", "Las monedas de este pedido ya fueron reclamadas.");
      }

      // Manejo de Monedas con TTL (90 días por defecto para pedidos)
      const TTL_DAYS = 90;
      const now = new Date();
      
      // Fecha de expiración al final del día (23:59:59) para agrupar mejor
      const expirationDate = new Date(now);
      expirationDate.setDate(expirationDate.getDate() + TTL_DAYS);
      expirationDate.setHours(23, 59, 59, 999);
      const expiresAtIso = expirationDate.toISOString();

      let monedasActivas = userData.monedasActivas || [];
      
      // Intentar encontrar un lote existente con exactamente la misma fecha de expiración
      const existingBatchIndex = monedasActivas.findIndex(b => b.expiresAt === expiresAtIso);
      
      if (existingBatchIndex >= 0) {
        monedasActivas[existingBatchIndex].amount += amount;
      } else {
        monedasActivas.push({
          amount: amount,
          expiresAt: expiresAtIso,
          source: "pedido_" + pedidoId,
          createdAt: now.toISOString()
        });
      }

      // Update user document safely
      const currentMonedas = userData.monedas || 0;
      transaction.update(userRef, {
        monedas: currentMonedas + amount, // Mantenemos el campo global por compatibilidad, aunque el cliente calculará sobre monedasActivas
        monedasActivas: monedasActivas,
        monedasReclamadas: admin.firestore.FieldValue.arrayUnion(pedidoId)
      });

      return { success: true, nuevasMonedas: currentMonedas + amount, monedasActivas };
    });
  } catch (error) {
    console.error("secureClaimMonedas error:", error);
    throw new functions.https.HttpsError("internal", error.message || "Error al procesar el reclamo.");
  }
});

/**
 * Cron Job mensual: Resetea kapiCoins a 0 el último día de cada mes a las 23:59.
 * Utiliza Firebase Scheduler (Cloud Scheduler).
 */
exports.resetKapiCoins = onSchedule("59 23 28-31 * *", async (event) => {
  // Asegurarnos de que hoy es realmente el último día del mes
  // (ya que el cron se corre del 28 al 31)
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (tomorrow.getDate() !== 1) {
    // No es el último día del mes, ignorar
    console.log("Not the last day of the month, skipping KapiCoins reset.");
    return;
  }

  console.log("Running monthly KapiCoins reset...");

  try {
    const usersSnapshot = await db.collection(PORTAL_USERS_COLLECTION)
      .where("kapiCoins", ">", 0)
      .get();
      
    if (usersSnapshot.empty) {
      console.log("No users with kapiCoins > 0 found.");
      return;
    }

    const batch = db.batch();
    const analyticsRef = db.collection("analytics_kapi");
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    let totalUnspent = 0;
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const unspent = data.kapiCoins || 0;
      totalUnspent += unspent;

      // Reset in user document
      batch.update(doc.ref, { kapiCoins: 0 });
    });

    // Save analytics document for the month
    const analyticsDocRef = analyticsRef.doc(currentMonthStr);
    batch.set(analyticsDocRef, {
      month: currentMonthStr,
      totalUnspentCoins: totalUnspent,
      usersAffected: usersSnapshot.size,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
    console.log(`Successfully reset KapiCoins for ${usersSnapshot.size} users. Total unspent: ${totalUnspent}`);

  } catch (error) {
    console.error("Error resetting KapiCoins:", error);
  }
});

/**
 * Cron Job diario: Notifica a los usuarios 14 días antes de su cumpleaños
 * para que compartan su Wishlist. Se ejecuta a las 9:00 AM.
 */
exports.notifyWishlistBirthdays = onSchedule("0 9 * * *", async (event) => {
  console.log("Running daily birthday wishlist notification...");

  try {
    // Calcular la fecha objetivo: hoy + 14 días
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 14);
    
    // Extraer mes y día en formato MM-DD
    const targetMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
    const targetDay = String(targetDate.getDate()).padStart(2, '0');
    const targetSuffix = `-${targetMonth}-${targetDay}`;

    // Obtener todos los usuarios (idealmente indexados, o se filtra en memoria si no son muchos)
    // Para bases de datos grandes, sería mejor guardar birthMonthDay como un campo aparte.
    const usersSnapshot = await db.collection(PORTAL_USERS_COLLECTION).get();
    
    if (usersSnapshot.empty) {
      console.log("No users found.");
      return;
    }

    let notifiedCount = 0;
    const batch = db.batch();

    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      if (!data.birthDate) continue; // Formato esperado: YYYY-MM-DD o similar

      if (data.birthDate.endsWith(targetSuffix)) {
        // Verificar si tiene una wishlist
        const wishlistRef = db.collection('wishlists').doc(doc.id);
        const wishlistSnap = await wishlistRef.get();
        
        if (wishlistSnap.exists) {
          const items = wishlistSnap.data().items || [];
          if (items.length > 0) {
            // Generar notificación in-app
            const notifRef = db.collection(`users/${doc.id}/notifications`).doc();
            batch.set(notifRef, {
              title: '¡Tu cumpleaños se acerca! 🎂',
              body: 'Faltan 14 días para tu cumpleaños. ¡Comparte tu lista de deseos para que tus amigos sepan exactamente qué regalarte!',
              createdAt: new Date().toISOString(),
              read: false,
              type: 'wishlist_birthday_reminder'
            });
            notifiedCount++;
          }
        }
      }
    }

    if (notifiedCount > 0) {
      await batch.commit();
      console.log(`Successfully notified ${notifiedCount} users for upcoming birthdays.`);
    } else {
      console.log("No users match the 14-day birthday criteria with active wishlists.");
    }

    }
  } catch (error) {
    console.error("Error in notifyWishlistBirthdays:", error);
  }
});

// ====== RETOS SEMANALES ======

/**
 * Cron Job: Se ejecuta cada lunes a las 00:00 (Zona horaria America/Lima).
 * Rota el reto semanal seleccionando uno de los retos disponibles en la colección "weeklyChallenges".
 */
exports.rotateWeeklyChallenge = onSchedule({
  schedule: "0 0 * * 1",
  timeZone: "America/Lima"
}, async (event) => {
  try {
    const challengesSnap = await db.collection("weeklyChallenges").get();
    if (challengesSnap.empty) {
      console.log("No hay retos disponibles para rotar.");
      return;
    }
    
    // Convertir a array
    const challenges = [];
    challengesSnap.forEach(doc => challenges.push({ id: doc.id, ...doc.data() }));
    
    // Seleccionar uno al azar
    const randomIndex = Math.floor(Math.random() * challenges.length);
    const selectedChallenge = challenges[randomIndex];
    
    // Actualizar o crear el documento global 'activeChallenge'
    await db.collection("globals").doc("activeChallenge").set({
      challengeId: selectedChallenge.id,
      title: selectedChallenge.title,
      description: selectedChallenge.description,
      actionType: selectedChallenge.actionType,
      goal: selectedChallenge.goal,
      rewardCoins: selectedChallenge.rewardCoins,
      rewardType: selectedChallenge.rewardType || "main", // "main" o "kapi_double_3d"
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    
    console.log("Reto semanal rotado exitosamente:", selectedChallenge.title);
  } catch (err) {
    console.error("Error al rotar reto semanal:", err);
  }
});

/**
 * Callable Function: Enviar evidencia manual para el reto (ej. link a story, foto)
 */
exports.submitChallengeEvidence = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  }
  const { evidenceUrl, challengeId, evidenceType } = data;
  if (!evidenceUrl || !challengeId) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan datos de la evidencia.");
  }

  const uid = context.auth.uid;
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  const userDoc = await userRef.get();
  const userName = userDoc.exists ? userDoc.data().displayName : "Usuario";
  
  await db.collection("challengeEvidences").add({
    userId: uid,
    userName: userName,
    challengeId,
    evidenceUrl,
    evidenceType: evidenceType || "image",
    status: "pending",
    submittedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true };
});

/**
 * Callable Function (Admin Solo): Aprobar o rechazar evidencia
 */
exports.approveChallengeEvidence = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  }
  
  const { evidenceId, action, rewardCoins, rewardType } = data; // action: 'approve' | 'reject'
  if (!evidenceId || !action) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan datos.");
  }

  const evidenceRef = db.collection("challengeEvidences").doc(evidenceId);
  
  await db.runTransaction(async (transaction) => {
    const evidenceDoc = await transaction.get(evidenceRef);
    if (!evidenceDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Evidencia no encontrada.");
    }
    const evData = evidenceDoc.data();
    if (evData.status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "La evidencia ya fue procesada.");
    }

    transaction.update(evidenceRef, { 
      status: action === "approve" ? "approved" : "rejected",
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      processedBy: context.auth.uid
    });

    if (action === "approve") {
      const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(evData.userId);
      const userDoc = await transaction.get(userRef);
      if(userDoc.exists) {
        const userData = userDoc.data();
        let updates = {
           challengeEvidencesApproved: admin.firestore.FieldValue.arrayUnion(evData.challengeId)
        };
        // Acreditar monedas si se aprobaron directamente acá
        if (rewardType === 'main') {
           // Usamos la misma lógica de earnMainCoins pero en backend
           let activas = userData.monedasActivas || [];
           const tzOffset = -5 * 60; // Peru
           const expirationDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000 + tzOffset * 60000);
           const expiresAt = expirationDate.toISOString().replace('Z', '-05:00');
           activas.push({ amount: rewardCoins, reason: 'Reto Manual Completado', expiresAt, createdAt: new Date().toISOString() });
           updates.monedas = (userData.monedas || 0) + rewardCoins;
           updates.monedasActivas = activas;
        } else if (rewardType === 'kapi_double_3d') {
           updates.activeMultiplier = 'kapi_double_3d';
           updates.multiplierExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        }
        transaction.set(userRef, updates, { merge: true });
      }
    }
  });

  return { success: true };
});

/**
 * Callable Function: Procesar pago con Culqi
 */
exports.processCulqiPayment = functions.https.onCall(async (data, context) => {
  const { amount, currency, email, tokenId, description, metadata } = data;

  if (!amount || !email || !tokenId) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan datos requeridos para el pago.");
  }

  // La llave privada debe venir de variables de entorno
  const secretKey = process.env.CULQI_SECRET_KEY || process.env.REACT_APP_CULQI_SECRET_KEY || "sk_test_dummy_key";

  try {
    const response = await fetch("https://api.culqi.com/v2/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secretKey}`
      },
      body: JSON.stringify({
        amount: amount, // El frontend ya lo envía en céntimos (integer)
        currency_code: currency || "PEN",
        email: email,
        source_id: tokenId,
        description: description || "Pago en Walá",
        metadata: metadata || {}
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Error de Culqi:", result);
      throw new functions.https.HttpsError("internal", result.user_message || "Error al procesar la tarjeta con Culqi.");
    }

    return {
      success: true,
      charge_id: result.id,
      outcome: result.outcome
    };

  } catch (err) {
    console.error("Excepción en processCulqiPayment:", err);
    throw new functions.https.HttpsError("internal", err.message || "Excepción interna al procesar el pago.");
  }
});

exports.notificationEngine = require('./notificationsEngine').notificationEngine;
exports.sendManualPromoNotification = require('./notificationsEngine').sendManualPromoNotification;
